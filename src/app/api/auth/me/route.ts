import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, userProfiles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { verifySessionToken } from "@/server/auth";

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

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: profile?.displayName || user.email.split("@")[0],
        avatarUrl: profile?.avatarUrl || null,
        primaryCurrency: profile?.primaryCurrency || "IDR",
        isAdmin: user.isAdmin,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ authenticated: false, error: err.message }, { status: 500 });
  }
}
