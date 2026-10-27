import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import {
  db,
  users,
  userProfiles,
  ledgers,
  accounts,
  categories,
  hashPassword,
  verifyPassword,
  createSessionToken,
  checkLoginRateLimit,
  recordLoginAttempt,
  setCachedSession,
  deleteCachedSession,
} from "@finiq/shared";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { ipRateLimiter } from "../middleware/rate-limit";

export const authRoutes = Router();

const loginSchema = z.object({
  email: z.string().trim().email("Format email tidak valid"),
  password: z.string().min(1, "Kata sandi wajib diisi"),
});

const registerSchema = z.object({
  email: z.string().trim().email("Format email tidak valid"),
  password: z.string().min(6, "Kata sandi minimal 6 karakter"),
  displayName: z.string().trim().min(2, "Nama minimal 2 karakter"),
  primaryCurrency: z.string().default("IDR"),
});

// POST /auth/login - Protected with IP rate limiting and Redis brute-force protection
authRoutes.post("/login", ipRateLimiter({ maxRequests: 20, windowSeconds: 60, action: "login" }), async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const emailLower = input.email.toLowerCase();

  // 1. Check brute-force login rate limit via Redis
  const rateLimitKey = `${req.ip}:${emailLower}`;
  const rateLimitStatus = await checkLoginRateLimit(rateLimitKey);
  if (!rateLimitStatus.allowed) {
    return res.status(429).json({
      success: false,
      error: "TooManyAttempts",
      message: `Terlalu banyak percobaan login yang gagal. Silakan tunggu ${rateLimitStatus.retryAfterSeconds} detik.`,
      retryAfter: rateLimitStatus.retryAfterSeconds,
    });
  }

  // 2. Fetch user
  const userRecords = await db
    .select()
    .from(users)
    .where(eq(users.email, emailLower))
    .limit(1);

  if (userRecords.length === 0) {
    await recordLoginAttempt(rateLimitKey, false);
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Email atau kata sandi tidak sesuai.",
    });
  }

  const user = userRecords[0];

  if (!user.isEnabled) {
    return res.status(403).json({
      success: false,
      error: "Forbidden",
      message: "Akun Anda telah dinonaktifkan. Silakan hubungi admin.",
    });
  }

  // 3. Verify password
  const isValid = verifyPassword(input.password, user.passwordHash);
  if (!isValid) {
    await recordLoginAttempt(rateLimitKey, false);
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message: "Email atau kata sandi tidak sesuai.",
    });
  }

  // Reset failed login counter on success
  await recordLoginAttempt(rateLimitKey, true);

  // 4. Fetch profile
  const profileRecords = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);

  const profile = profileRecords[0];
  const displayName =
    profile?.displayName ||
    user.email.split("@")[0].charAt(0).toUpperCase() + user.email.split("@")[0].slice(1);
  const primaryCurrency = profile?.primaryCurrency || "IDR";

  // 5. Create JWT session token
  const token = createSessionToken({ userId: user.id, email: user.email });

  // 6. Cache active session in Redis
  await setCachedSession(token, {
    userId: user.id,
    email: user.email,
    displayName,
    primaryCurrency,
    isAdmin: user.isAdmin,
    createdAt: Date.now(),
  });

  return res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName,
      primaryCurrency,
      isAdmin: user.isAdmin,
    },
  });
});

// POST /auth/register
authRoutes.post("/register", ipRateLimiter({ maxRequests: 10, windowSeconds: 60, action: "register" }), async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body);
  const emailLower = input.email.toLowerCase();

  // Check existing user
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, emailLower))
    .limit(1);

  if (existing.length > 0) {
    return res.status(409).json({
      success: false,
      error: "Conflict",
      message: "Email ini sudah terdaftar. Silakan gunakan email lain atau langsung masuk.",
    });
  }

  const hashedPassword = hashPassword(input.password);
  const newUserId = crypto.randomUUID();

  // Insert user
  await db.insert(users).values({
    id: newUserId,
    email: emailLower,
    passwordHash: hashedPassword,
    isAdmin: false,
    isEnabled: true,
  });

  // Insert profile
  await db.insert(userProfiles).values({
    userId: newUserId,
    displayName: input.displayName,
    primaryCurrency: input.primaryCurrency,
    themePrimaryColor: "#00B569",
    totpEnabled: false,
  });

  // Create default ledger
  const ledgerId = crypto.randomUUID();
  await db.insert(ledgers).values({
    id: ledgerId,
    userId: newUserId,
    name: "Buku Kas Utama",
    currency: input.primaryCurrency,
    monthStartDay: 1,
  });

  // Create initial cash account
  await db.insert(accounts).values({
    userId: newUserId,
    name: "Kas",
    group: "Cash",
    currency: input.primaryCurrency,
    initialBalance: 0,
    balance: 0,
    note: "Dompet kas utama",
  });

  // Seed starter categories
  const starterCategories = [
    { name: "Dining", kind: "expense" as const, icon: "Utensils" },
    { name: "Beverage", kind: "expense" as const, icon: "Coffee" },
    { name: "Snacks", kind: "expense" as const, icon: "Cookie" },
    { name: "Transportasi", kind: "expense" as const, icon: "Car" },
    { name: "Daily Goods", kind: "expense" as const, icon: "ShoppingBag" },
    { name: "Shopping", kind: "expense" as const, icon: "ShoppingCart" },
    { name: "Utilities", kind: "expense" as const, icon: "Zap" },
    { name: "Saving", kind: "expense" as const, icon: "PiggyBank" },
    { name: "Family", kind: "expense" as const, icon: "Heart" },
    { name: "Beauty", kind: "expense" as const, icon: "Sparkles" },
    { name: "Health", kind: "expense" as const, icon: "Activity" },
    { name: "Education", kind: "expense" as const, icon: "GraduationCap" },
    { name: "entertain", kind: "expense" as const, icon: "Gamepad2" },
    { name: "invest job", kind: "expense" as const, icon: "TrendingUp" },
    { name: "paylater", kind: "expense" as const, icon: "CreditCard" },
    { name: "Salary", kind: "income" as const, icon: "Banknote" },
    { name: "Part time", kind: "income" as const, icon: "Briefcase" },
    { name: "Allowance", kind: "income" as const, icon: "Wallet" },
    { name: "Umum", kind: "income" as const, icon: "Layers" },
  ];

  for (const cat of starterCategories) {
    await db.insert(categories).values({
      userId: newUserId,
      name: cat.name,
      kind: cat.kind,
      icon: cat.icon,
    });
  }

  const token = createSessionToken({ userId: newUserId, email: emailLower });

  await setCachedSession(token, {
    userId: newUserId,
    email: emailLower,
    displayName: input.displayName,
    primaryCurrency: input.primaryCurrency,
    isAdmin: false,
    createdAt: Date.now(),
  });

  return res.status(201).json({
    success: true,
    token,
    user: {
      id: newUserId,
      email: emailLower,
      displayName: input.displayName,
      primaryCurrency: input.primaryCurrency,
      isAdmin: false,
    },
  });
});

// GET /auth/me - Current logged-in user profile
authRoutes.get("/me", requireAuth, async (req: Request, res: Response) => {
  const { userId } = req as AuthRequest;

  const userRecords = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (userRecords.length === 0) {
    return res.status(404).json({
      success: false,
      error: "NotFound",
      message: "Pengguna tidak ditemukan",
    });
  }

  const profileRecords = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  const user = userRecords[0];
  const profile = profileRecords[0];

  return res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: profile?.displayName || user.email.split("@")[0],
      avatarUrl: profile?.avatarUrl || null,
      primaryCurrency: profile?.primaryCurrency || "IDR",
      themePrimaryColor: profile?.themePrimaryColor || "#00B569",
      isAdmin: user.isAdmin,
      totpEnabled: profile?.totpEnabled ?? false,
    },
  });
});

// POST /auth/logout - AUTOMATE REDIS SESSION DELETION
authRoutes.post("/logout", async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7).trim()
    : (req.body?.token as string);

  if (token) {
    // Delete session from Redis immediately and add to revoked blacklist
    await deleteCachedSession(token);
    console.log(`[Redis Session] Session ${token.substring(0, 16)}... automatically deleted & revoked.`);
  }

  return res.json({
    success: true,
    message: "Berhasil keluar dari akun. Sesi Redis telah dihapus.",
  });
});
