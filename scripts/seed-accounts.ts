import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/server/db";
import { users, userProfiles, ledgers, accounts, categories } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

interface SeedAccount {
  group: string;
  name: string;
  balance: number;
  currency: string;
  note?: string;
}

const seedAccounts: SeedAccount[] = [
  { group: "Cash", name: "cash", balance: 158000, currency: "IDR", note: "Uang tunai fisik" },
  { group: "Bank card", name: "blu", balance: 3670000, currency: "IDR", note: "Rekening blu by BCA Digital" },
  { group: "Alipay", name: "dana", balance: 3400, currency: "IDR", note: "E-wallet DANA" },
];

const defaultCategories = [
  { name: "Makanan & Minuman", kind: "expense", icon: "utensils" },
  { name: "Transportasi", kind: "expense", icon: "car" },
  { name: "Belanja", kind: "expense", icon: "shopping-bag" },
  { name: "Tagihan & Utilitas", kind: "expense", icon: "receipt" },
  { name: "Hiburan", kind: "expense", icon: "film" },
  { name: "Gaji & Pendapatan", kind: "income", icon: "banknote" },
  { name: "Bonus & Hadiah", kind: "income", icon: "gift" },
  { name: "Investasi", kind: "income", icon: "trending-up" },
];

async function main() {
  console.log("🌱 [Fin.IQ] Memulai seeding data awal...");

  try {
    // 1. Pastikan Default User ada
    const demoEmail = "owner@finiq.app";
    let existingUser = await db.query.users.findFirst({
      where: eq(users.email, demoEmail),
    });

    let userId: string;

    if (!existingUser) {
      console.log(`👤 Membuat demo user: ${demoEmail}`);
      userId = crypto.randomUUID();
      await db
        .insert(users)
        .values({
          id: userId,
          email: demoEmail,
          passwordHash: "demo_scrypt_hash_placeholder",
          isAdmin: true,
          isEnabled: true,
        });

      await db.insert(userProfiles).values({
        id: crypto.randomUUID(),
        userId: userId,
        displayName: "Owner Fin.IQ",
        primaryCurrency: "IDR",
        themePrimaryColor: "#3b82f6",
      });
    } else {
      userId = existingUser.id;
      console.log(`👤 User ditemukan: ${userId}`);
    }

    // 2. Pastikan Default Ledger ada
    let defaultLedger = await db.query.ledgers.findFirst({
      where: eq(ledgers.userId, userId),
    });

    if (!defaultLedger) {
      console.log("📘 Membuat Default Buku Kas (Ledger)...");
      const ledgerId = crypto.randomUUID();
      await db
        .insert(ledgers)
        .values({
          id: ledgerId,
          userId: userId,
          name: "Buku Kas Utama",
          currency: "IDR",
          monthStartDay: 1,
        });
      defaultLedger = (await db.query.ledgers.findFirst({
        where: eq(ledgers.id, ledgerId),
      }))!;
    }
    console.log(`📘 Ledger ID: ${defaultLedger.id}`);

    // 3. Seed Default Categories jika belum ada
    const existingCats = await db.query.categories.findMany({
      where: eq(categories.userId, userId),
    });

    if (existingCats.length === 0) {
      console.log("🏷️ Menyemai kategori default...");
      for (const cat of defaultCategories) {
        await db.insert(categories).values({
          userId: userId,
          name: cat.name,
          kind: cat.kind,
          icon: cat.icon,
        });
      }
    }

    // 4. Seed Initial Accounts (cash, blu, dana)
    console.log("💳 Menyemai Akun Keuangan:");
    for (const acc of seedAccounts) {
      const existingAccount = await db.query.accounts.findFirst({
        where: (t, { and, eq }) => and(eq(t.userId, userId), eq(t.name, acc.name)),
      });

      if (!existingAccount) {
        await db.insert(accounts).values({
          userId: userId,
          name: acc.name,
          group: acc.group,
          currency: acc.currency,
          initialBalance: acc.balance,
          balance: acc.balance,
          note: acc.note,
        });
        console.log(`  ✅ Akun '${acc.name}' (${acc.group}) dibuat dengan saldo: Rp ${acc.balance.toLocaleString("id-ID")}`);
      } else {
        console.log(`  ℹ️ Akun '${acc.name}' sudah ada (Saldo: Rp ${existingAccount.balance.toLocaleString("id-ID")})`);
      }
    }

    console.log("✨ [Fin.IQ] Seeding selesai dengan sukses!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Gagal melakukan seeding:", err);
    process.exit(1);
  }
}

main();
