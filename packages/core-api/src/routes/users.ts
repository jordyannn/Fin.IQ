import { Router, Response } from "express";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import {
  db,
  users,
  userProfiles,
  accounts,
  transactions,
  hashPassword,
  verifyPassword,
  invalidateAuthUser,
  encryptSecret,
  decryptSecret,
} from "@finiq/shared";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const userRoutes = Router();

// GET /users/profile
userRoutes.get("/profile", requireAuth, async (req, res: Response) => {
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
      message: "Akun pengguna tidak ditemukan.",
    });
  }

  const user = userRecords[0];

  let profileRecords = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  let profile = profileRecords[0];

  if (!profile) {
    const defaultName = user.email.split("@")[0] || "Pengguna Fin.IQ";
    await db.insert(userProfiles).values({
      userId,
      displayName: defaultName.charAt(0).toUpperCase() + defaultName.slice(1),
      primaryCurrency: "IDR",
      themePrimaryColor: "#00B569",
      totpEnabled: false,
    });

    profileRecords = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    profile = profileRecords[0];
  }

  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId));

  const totalBalance = userAccounts.reduce((acc, a) => acc + (a.balance || 0), 0);

  const txRecords = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(eq(transactions.userId, userId));

  const transactionCount = Number(txRecords[0]?.count || 0);

  const decryptedGeminiKey = profile?.geminiApiKey ? decryptSecret(profile.geminiApiKey) : null;

  return res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      displayName: profile?.displayName || "Pengguna Fin.IQ",
      avatarUrl: profile?.avatarUrl || null,
      primaryCurrency: profile?.primaryCurrency || "IDR",
      themePrimaryColor: profile?.themePrimaryColor || "#00B569",
      totpEnabled: profile?.totpEnabled || false,
      createdAt: user.createdAt,
      accountCount: userAccounts.length,
      transactionCount,
      totalBalance,
      geminiApiKeyMasked: decryptedGeminiKey
        ? `${decryptedGeminiKey.slice(0, 6)}••••${decryptedGeminiKey.slice(-4)}`
        : null,
      hasGeminiKey: Boolean(decryptedGeminiKey?.trim() || process.env.GEMINI_API_KEY),
      isPersonalKey: Boolean(decryptedGeminiKey?.trim()),
    },
  });
});

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2, "Nama minimal 2 karakter"),
  primaryCurrency: z.string().min(3).max(5).default("IDR"),
  themePrimaryColor: z.string().optional(),
});

// PATCH /users/profile
userRoutes.patch("/profile", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const input = updateProfileSchema.parse(req.body);

  const existing = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(userProfiles).values({
      userId,
      displayName: input.displayName,
      primaryCurrency: input.primaryCurrency,
      themePrimaryColor: input.themePrimaryColor || "#00B569",
    });
  } else {
    await db
      .update(userProfiles)
      .set({
        displayName: input.displayName,
        primaryCurrency: input.primaryCurrency,
        themePrimaryColor: input.themePrimaryColor || existing[0].themePrimaryColor,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, userId));
  }

  // Invalidate Redis user cache
  const userRec = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (userRec[0]?.email) {
    await invalidateAuthUser(userRec[0].email);
  }

  return res.json({
    success: true,
    message: "Profil berhasil diperbarui.",
  });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Kata sandi saat ini wajib diisi"),
  newPassword: z.string().min(6, "Kata sandi baru minimal 6 karakter"),
});

// POST /users/change-password
userRoutes.post("/change-password", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const input = changePasswordSchema.parse(req.body);

  const userRecords = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (userRecords.length === 0) {
    return res.status(404).json({
      success: false,
      error: "NotFound",
      message: "Pengguna tidak ditemukan.",
    });
  }

  const user = userRecords[0];
  const isValid = verifyPassword(input.currentPassword, user.passwordHash);
  if (!isValid) {
    return res.status(400).json({
      success: false,
      error: "BadRequest",
      message: "Kata sandi saat ini tidak cocok.",
    });
  }

  const newHash = hashPassword(input.newPassword);
  await db
    .update(users)
    .set({ passwordHash: newHash })
    .where(eq(users.id, userId));

  await invalidateAuthUser(user.email);

  return res.json({
    success: true,
    message: "Kata sandi Anda berhasil diperbarui.",
  });
});

// POST /users/gemini-key
userRoutes.post("/gemini-key", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const { apiKey } = z.object({ apiKey: z.string().trim().min(8) }).parse(req.body);

  const existing = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  const encryptedKey = encryptSecret(apiKey);

  if (existing.length === 0) {
    await db.insert(userProfiles).values({
      userId,
      displayName: "Pengguna Fin.IQ",
      geminiApiKey: encryptedKey,
    });
  } else {
    await db
      .update(userProfiles)
      .set({ geminiApiKey: encryptedKey, updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId));
  }

  return res.json({
    success: true,
    message: "API Key Google Gemini berhasil disimpan.",
  });
});

// DELETE /users/gemini-key
userRoutes.delete("/gemini-key", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;

  await db
    .update(userProfiles)
    .set({ geminiApiKey: null, updatedAt: new Date() })
    .where(eq(userProfiles.userId, userId));

  return res.json({
    success: true,
    message: "API Key Google Gemini berhasil diputuskan.",
  });
});
