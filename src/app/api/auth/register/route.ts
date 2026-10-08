import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, userProfiles, ledgers, accounts, categories } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, createSessionToken } from "@/server/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, displayName, primaryCurrency = "IDR" } = body;

    if (!email || !password || !displayName) {
      return NextResponse.json(
        { success: false, error: "Semua kolom pendaftaran wajib diisi." },
        { status: 400 }
      );
    }

    if (String(password).length < 6) {
      return NextResponse.json(
        { success: false, error: "Kata sandi minimal 6 karakter." },
        { status: 400 }
      );
    }

    const emailLower = String(email).trim().toLowerCase();

    // Check if email already registered
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, emailLower))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: "Email sudah terdaftar. Silakan gunakan email lain atau masuk." },
        { status: 409 }
      );
    }

    const newUserId = crypto.randomUUID();
    const hashedPassword = hashPassword(String(password));

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
      displayName: String(displayName).trim(),
      primaryCurrency: String(primaryCurrency),
      themePrimaryColor: "#00B569",
      totpEnabled: false,
    });

    // Create default ledger (Buku Kas Utama)
    const ledgerId = crypto.randomUUID();
    await db.insert(ledgers).values({
      id: ledgerId,
      userId: newUserId,
      name: "Buku Kas Utama",
      currency: String(primaryCurrency),
      monthStartDay: 1,
    });

    // Create initial cash account
    await db.insert(accounts).values({
      userId: newUserId,
      name: "Kas Tunai",
      group: "Cash",
      currency: String(primaryCurrency),
      initialBalance: 0,
      balance: 0,
      note: "Dompet uang tunai utama",
    });

    // Seed starter categories
    const starterCategories = [
      { name: "Makanan & Minuman", kind: "expense", icon: "Utensils" },
      { name: "Transportasi", kind: "expense", icon: "Car" },
      { name: "Belanja & Kebutuhan", kind: "expense", icon: "ShoppingBag" },
      { name: "Tagihan & Utilitas", kind: "expense", icon: "Receipt" },
      { name: "Gaji & Pendapatan", kind: "income", icon: "Briefcase" },
      { name: "Bonus & Investasi", kind: "income", icon: "TrendingUp" },
    ];

    for (const cat of starterCategories) {
      await db.insert(categories).values({
        userId: newUserId,
        name: cat.name,
        kind: cat.kind,
        icon: cat.icon,
      });
    }

    // Create session token
    const token = createSessionToken({ userId: newUserId, email: emailLower });

    const response = NextResponse.json({
      success: true,
      user: {
        id: newUserId,
        email: emailLower,
        displayName: String(displayName).trim(),
        primaryCurrency: String(primaryCurrency),
      },
    });

    // Set secure cookie
    response.cookies.set("finiq_session", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (err: any) {
    console.error("Register API error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mendaftarkan akun. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
