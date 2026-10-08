import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, userProfiles } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, createSessionToken } from "@/server/auth";

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
    const userRecords = await db
      .select()
      .from(users)
      .where(eq(users.email, emailLower))
      .limit(1);

    if (userRecords.length === 0) {
      return NextResponse.json(
        { success: false, error: "Email atau kata sandi tidak cocok." },
        { status: 401 }
      );
    }

    const user = userRecords[0];
    if (!user.isEnabled) {
      return NextResponse.json(
        { success: false, error: "Akun Anda telah dinonaktifkan." },
        { status: 403 }
      );
    }

    const isMatch = verifyPassword(String(password), user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: "Email atau kata sandi tidak cocok." },
        { status: 401 }
      );
    }

    // Get user profile
    const profileRecords = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);

    const displayName =
      profileRecords[0]?.displayName ||
      user.email.split("@")[0].charAt(0).toUpperCase() + user.email.split("@")[0].slice(1);

    // Create session token
    const token = createSessionToken({ userId: user.id, email: user.email });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName,
        primaryCurrency: profileRecords[0]?.primaryCurrency || "IDR",
      },
    });

    // Set secure cookie
    response.cookies.set("finiq_session", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      secure: process.env.NODE_ENV === "production",
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
