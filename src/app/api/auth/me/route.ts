import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, userProfiles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { verifySessionToken } from "@/server/auth";
import { getCachedSession, setCachedSession } from "@/lib/redis";

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie");
    const match = cookieHeader?.match(/(^|;\s*)finiq_session=([^;]*)/);
    const sessionToken = match ? decodeURIComponent(match[2]) : null;

    if (!sessionToken) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const payload = verifySessionToken(sessionToken);
    if (!payload?.userId) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    // 1. REDIS-FIRST: Periksa sesi yang tersimpan di memori Redis
    const cachedSession = await getCachedSession(sessionToken);
    if (cachedSession) {
      return NextResponse.json({
        authenticated: true,
        source: "redis",
        user: {
          id: cachedSession.userId,
          email: cachedSession.email,
          displayName: cachedSession.displayName,
          primaryCurrency: cachedSession.primaryCurrency,
          isAdmin: cachedSession.isAdmin,
        },
      });
    }

    // 2. Jika tidak ada di Redis (Cache Miss), ambil dari Database
    const userRecords = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (userRecords.length === 0 || !userRecords[0].isEnabled) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const user = userRecords[0];
    const profileRecords = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);

    const profile = profileRecords[0];
    const displayName = profile?.displayName || user.email.split("@")[0];
    const primaryCurrency = profile?.primaryCurrency || "IDR";

    // Simpan kembali ke Redis agar request selanjutnya tidak menyentuh database
    await setCachedSession(
      sessionToken,
      {
        userId: user.id,
        email: user.email,
        displayName,
        primaryCurrency,
        isAdmin: Boolean(user.isAdmin),
        createdAt: Date.now(),
      },
      30 * 86400
    );

    return NextResponse.json({
      authenticated: true,
      source: "database",
      user: {
        id: user.id,
        email: user.email,
        displayName,
        avatarUrl: profile?.avatarUrl || null,
        primaryCurrency,
        isAdmin: user.isAdmin,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ authenticated: false, error: err.message }, { status: 500 });
  }
}
