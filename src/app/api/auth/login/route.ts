import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, userProfiles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, createSessionToken } from "@/server/auth";
import {
  getCachedAuthUser,
  setCachedAuthUser,
  setCachedSession,
  checkLoginRateLimit,
  recordLoginAttempt,
  CachedAuthUser,
} from "@/lib/redis";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email dan kata sandi wajib diisi." },
        { status: 400 }
      );
    }

    const emailLower = String(email).trim().toLowerCase();

    // Dapatkan client IP untuk rate-limiting per-IP + Email
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const rateLimitIdentifier = `${ip}:${emailLower}`;

    // 0. RATE LIMITING VIA REDIS (Maks 5 percobaan gagal per 15 menit)
    const rateLimit = await checkLoginRateLimit(rateLimitIdentifier);
    if (!rateLimit.allowed) {
      const minutesRemaining = Math.ceil(rateLimit.retryAfterSeconds / 60);
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak percobaan masuk yang gagal. Silakan coba lagi dalam ${minutesRemaining} menit.`,
        },
        { status: 429 }
      );
    }

    let authUser: CachedAuthUser | null = null;
    let source: "redis" | "database" = "redis";

    // 1. REDIS-FIRST LOOKUP: Periksa memori Redis terlebih dahulu
    const cachedUser = await getCachedAuthUser(emailLower);

    if (cachedUser) {
      // CACHE HIT: Data user ditemukan di Redis, tidak perlu query database!
      authUser = cachedUser;
      source = "redis";
    } else {
      // CACHE MISS: Belum ada di Redis, ambil dari MySQL Database
      source = "database";
      const userRecords = await db
        .select()
        .from(users)
        .where(eq(users.email, emailLower))
        .limit(1);

      if (userRecords.length === 0) {
        await recordLoginAttempt(rateLimitIdentifier, false);
        return NextResponse.json(
          { success: false, error: "Email atau kata sandi tidak cocok." },
          { status: 401 }
        );
      }

      const dbUser = userRecords[0];

      // Ambil user profile dari DB
      const profileRecords = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, dbUser.id))
        .limit(1);

      const displayName =
        profileRecords[0]?.displayName ||
        dbUser.email.split("@")[0].charAt(0).toUpperCase() + dbUser.email.split("@")[0].slice(1);

      authUser = {
        id: dbUser.id,
        email: dbUser.email,
        passwordHash: dbUser.passwordHash,
        isEnabled: Boolean(dbUser.isEnabled),
        isAdmin: Boolean(dbUser.isAdmin),
        displayName,
        primaryCurrency: profileRecords[0]?.primaryCurrency || "IDR",
      };

      // Simpan user ke Redis agar request login berikutnya 100% membaca dari Redis (TTL 24 jam)
      await setCachedAuthUser(emailLower, authUser, 86400);
    }

    // 2. Validasi status akun
    if (!authUser.isEnabled) {
      return NextResponse.json(
        { success: false, error: "Akun Anda telah dinonaktifkan." },
        { status: 403 }
      );
    }

    // 3. Verifikasi kata sandi
    const isMatch = verifyPassword(String(password), authUser.passwordHash);
    if (!isMatch) {
      await recordLoginAttempt(rateLimitIdentifier, false);
      return NextResponse.json(
        { success: false, error: "Email atau kata sandi tidak cocok." },
        { status: 401 }
      );
    }

    // Login Sukses: Bersihkan catatan percobaan gagal di Redis
    await recordLoginAttempt(rateLimitIdentifier, true);

    // 4. Generate Session Token & Simpan Sesi ke Redis
    const token = createSessionToken({ userId: authUser.id, email: authUser.email });

    // Cache Session di Redis (30 hari) agar `/api/auth/me` dan middleware tidak membebani DB
    await setCachedSession(
      token,
      {
        userId: authUser.id,
        email: authUser.email,
        displayName: authUser.displayName,
        primaryCurrency: authUser.primaryCurrency,
        isAdmin: authUser.isAdmin,
        createdAt: Date.now(),
      },
      30 * 86400
    );

    const response = NextResponse.json({
      success: true,
      source, // Telemetri apakah login dilayani dari 'redis' atau 'database'
      user: {
        id: authUser.id,
        email: authUser.email,
        displayName: authUser.displayName,
        primaryCurrency: authUser.primaryCurrency,
      },
    });

    // Set cookie
    const isHttps =
      req.headers.get("x-forwarded-proto") === "https" || req.url.startsWith("https://");
    response.cookies.set("finiq_session", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      secure: isHttps,
    });

    return response;
  } catch (err: any) {
    console.error("Login API error:", err);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan internal pada server." },
      { status: 500 }
    );
  }
}
