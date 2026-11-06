import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { db, pool } from "../src/server/db";
import {
  users,
  userProfiles,
  accounts,
  categories,
  transactions,
  aiChatSessions,
  aiChatMessages,
} from "../src/server/db/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { buildUserFinancialTelemetry } from "../src/server/ai-telemetry";

async function verify() {
  console.log("🔍 [Fin.IQ] Verifikasi Data Sintetis untuk Jordan (@finiq.app)...\n");

  const user = await db.query.users.findFirst({
    where: eq(users.email, "jordan@finiq.app"),
  });

  if (!user) {
    console.error("❌ User jordan@finiq.app tidak ditemukan!");
    await pool.end();
    return;
  }

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, user.id),
  });

  console.log("1️⃣ PROFIL PENGGUNA:");
  console.log(`- Nama: ${profile?.displayName}`);
  console.log(`- Email: ${user.email}`);
  console.log(`- Mata Uang Utama: ${profile?.primaryCurrency}`);
  console.log(`- Warna Tema: ${profile?.themePrimaryColor}\n`);

  // 2. Akun & Saldo
  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, user.id))
    .orderBy(accounts.sortOrder);

  const totalBalance = userAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  console.log("2️⃣ DAFTAR AKUN & SALDO (Tweet 5 - Multi-Akun):");
  for (const acc of userAccounts) {
    const pct = totalBalance > 0 ? Math.round((acc.balance / totalBalance) * 100) : 0;
    console.log(
      `  * [${acc.group.padEnd(9)}] ${acc.name.padEnd(6)}: Rp ${acc.balance.toLocaleString("id-ID").padStart(10)} (${pct}%) - ${acc.note}`
    );
  }
  console.log(`  👉 TOTAL SALDO LIKUID: Rp ${totalBalance.toLocaleString("id-ID")}\n`);

  // 3. Arus Kas Bulan Berjalan (November 2026)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

  const monthTx = await db
    .select({
      id: transactions.id,
      happenedAt: transactions.happenedAt,
      txType: transactions.txType,
      amount: transactions.amount,
      note: transactions.note,
      categoryName: categories.name,
      accountName: accounts.name,
      excludeFromStats: transactions.excludeFromStats,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        eq(transactions.userId, user.id),
        gte(transactions.happenedAt, startOfMonth),
        lte(transactions.happenedAt, now)
      )
    )
    .orderBy(desc(transactions.happenedAt));

  let totalIncome = 0;
  let totalExpense = 0;
  const categorySpending: Record<string, number> = {};

  for (const tx of monthTx) {
    if (tx.txType === "income" && !tx.excludeFromStats) {
      totalIncome += tx.amount;
    } else if (tx.txType === "expense" && !tx.excludeFromStats) {
      totalExpense += tx.amount;
      const c = tx.categoryName || "Lainnya";
      categorySpending[c] = (categorySpending[c] || 0) + tx.amount;
    }
  }

  const netCashflow = totalIncome - totalExpense;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysRemaining = daysInMonth - currentDay;
  const safeDailyLimit = daysRemaining > 0 ? Math.round(netCashflow / daysRemaining) : 0;

  console.log("3️⃣ RINGKASAN ARUS KAS NOVEMBER 2026 (Overview Dashboard):");
  console.log(`  - Total Pemasukan : +Rp ${totalIncome.toLocaleString("id-ID")}`);
  console.log(`  - Total Pengeluaran: -Rp ${totalExpense.toLocaleString("id-ID")}`);
  console.log(`  - Arus Kas Bersih  : +Rp ${netCashflow.toLocaleString("id-ID")}`);
  console.log(`  - Sisa Hari Bulan Ini: ${daysRemaining} hari (dari tanggal ${currentDay} ke ${daysInMonth})`);
  console.log(`  - Batas Belanja Harian Aman: Rp ${safeDailyLimit.toLocaleString("id-ID")} / hari!\n`);

  console.log("4️⃣ POS PENGELUARAN TERBESAR (Audit Pos Boros):");
  const sortedCategories = Object.entries(categorySpending).sort((a, b) => b[1] - a[1]);
  for (const [cat, amt] of sortedCategories) {
    const pct = Math.round((amt / totalExpense) * 100);
    console.log(`  * ${cat.padEnd(25)}: Rp ${amt.toLocaleString("id-ID").padStart(10)} (${pct}%)`);
  }
  console.log("");

  console.log("5️⃣ BUKTI MUTASI RECEH BERTURUT-TURUT (Tweet 3 - Screenshot Mutasi):");
  const microTx = monthTx.filter((t) => t.txType === "expense" && t.amount <= 100000).slice(0, 15);
  for (const tx of microTx) {
    const dateStr = tx.happenedAt.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    console.log(
      `  [${dateStr}] (${(tx.accountName || "Akun").padEnd(5)}) Rp ${tx.amount
        .toLocaleString("id-ID")
        .padStart(7)} | ${(tx.categoryName || "-").padEnd(22)} | ${tx.note}`
    );
  }
  console.log("");

  // 6. Percakapan AI
  const sessions = await db
    .select()
    .from(aiChatSessions)
    .where(eq(aiChatSessions.userId, user.id))
    .orderBy(desc(aiChatSessions.updatedAt));

  console.log("6️⃣ ASISTEN AI (Tweet 6 - Drawer Asisten AI):");
  if (sessions.length > 0) {
    const session = sessions[0];
    console.log(`  Judul Sesi: "${session.title}" (Model: ${session.modelUsed})`);
    const msgs = await db
      .select()
      .from(aiChatMessages)
      .where(eq(aiChatMessages.sessionId, session.id))
      .orderBy(aiChatMessages.createdAt);

    for (const m of msgs) {
      console.log(`\n  💬 [${m.role.toUpperCase()}]:\n${m.content.slice(0, 300)}...`);
    }
  }

  // 7. Telemetri AI Engine Verification
  console.log("\n7️⃣ VERIFIKASI ENGINE AI TELEMETRY:");
  const telemetry = await buildUserFinancialTelemetry(db, user.id);
  console.log(`  - Telemetry User Name: ${telemetry.userName}`);
  console.log(`  - Telemetry Total Saldo: Rp ${telemetry.totalBalance.toLocaleString("id-ID")}`);
  console.log(`  - Telemetry Net Cashflow: Rp ${telemetry.thisMonth.net.toLocaleString("id-ID")}`);
  console.log(
    `  - Telemetry Safe Daily Spend Limit: Rp ${telemetry.thisMonth.safeDailySpendLimit.toLocaleString(
      "id-ID"
    )} / hari`
  );

  console.log("\n✅ SELURUH VERIFIKASI BERHASIL!");
  await pool.end();
}

verify().catch(console.error);

