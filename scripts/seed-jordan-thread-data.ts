import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import * as fs from "fs";
import * as path from "path";
import { db, pool } from "../src/server/db";
import {
  users,
  userProfiles,
  ledgers,
  accounts,
  categories,
  transactions,
  aiChatSessions,
  aiChatMessages,
} from "../src/server/db/schema";
import { eq, and } from "drizzle-orm";
import { hashPassword, createSessionToken } from "../src/server/auth";

async function main() {
  console.log("🚀 [Fin.IQ] Memulai seeding data sintetis Jordan (@finiq.app) untuk thread Twitter...");

  const targetEmail = "jordan@finiq.app";

  // 1. Dapatkan atau Buat Pengguna Jordan
  let user = await db.query.users.findFirst({
    where: eq(users.email, targetEmail),
  });

  const validPasswordHash = hashPassword("123456");

  if (!user) {
    const newUserId = crypto.randomUUID();
    console.log(`👤 Membuat user baru: ${targetEmail} (${newUserId})`);
    await db.insert(users).values({
      id: newUserId,
      email: targetEmail,
      passwordHash: validPasswordHash,
      isAdmin: false,
      isEnabled: true,
    });
    user = { id: newUserId, email: targetEmail } as any;
  } else {
    console.log(`👤 Ditemukan user: ${user.email} (${user.id})`);
    // Pastikan password bisa login dengan '123456'
    await db
      .update(users)
      .set({ passwordHash: validPasswordHash, isEnabled: true })
      .where(eq(users.id, user.id));
  }

  const userId = user.id;

  // 2. Profil Pengguna Jordan (Usia 21 tahun, first jobber)
  const existingProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  if (!existingProfile) {
    await db.insert(userProfiles).values({
      id: crypto.randomUUID(),
      userId: userId,
      displayName: "Jordan",
      primaryCurrency: "IDR",
      themePrimaryColor: "#00B569",
    });
  } else {
    await db
      .update(userProfiles)
      .set({
        displayName: "Jordan",
        primaryCurrency: "IDR",
        themePrimaryColor: "#00B569",
      })
      .where(eq(userProfiles.userId, userId));
  }
  console.log("✅ Profil pengguna Jordan diperbarui.");

  // 3. Buku Kas / Ledger Utama
  let userLedger = await db.query.ledgers.findFirst({
    where: eq(ledgers.userId, userId),
  });

  if (!userLedger) {
    const newLedgerId = crypto.randomUUID();
    await db.insert(ledgers).values({
      id: newLedgerId,
      userId: userId,
      name: "Buku Kas Utama",
      currency: "IDR",
      monthStartDay: 1,
    });
    userLedger = { id: newLedgerId, userId, name: "Buku Kas Utama", currency: "IDR", monthStartDay: 1 } as any;
  }
  console.log(`📘 Ledger ID: ${userLedger.id}`);

  // 4. Bersihkan Transaksi, Chat, dan Data Lama Jordan agar Bersih & Idempoten
  console.log("🧹 Membersihkan data transaksi & sesi AI lama...");
  await db.delete(transactions).where(eq(transactions.userId, userId));
  await db.delete(aiChatMessages).where(eq(aiChatMessages.userId, userId));
  await db.delete(aiChatSessions).where(eq(aiChatSessions.userId, userId));
  await db.delete(accounts).where(eq(accounts.userId, userId));
  await db.delete(categories).where(eq(categories.userId, userId));

  // 5. Buat Akun Finansial (Tweet 5: Blu, Dana, GoPay, sampai Cash)
  console.log("💳 Membuat 4 Akun Finansial (Cash, Blu, Dana, GoPay)...");
  const accountsToCreate = [
    {
      key: "blu",
      name: "Blu",
      group: "Bank card",
      balance: 850000,
      initialBalance: 0,
      note: "Rekening blu by BCA Digital (Payroll & Impor Mutasi)",
      sortOrder: 1,
    },
    {
      key: "dana",
      name: "Dana",
      group: "Alipay",
      balance: 45000,
      initialBalance: 0,
      note: "E-Wallet DANA (Checkout Shopee)",
      sortOrder: 2,
    },
    {
      key: "gopay",
      name: "GoPay",
      group: "Alipay",
      balance: 25000,
      initialBalance: 0,
      note: "E-Wallet GoPay (GoFood & Ojol)",
      sortOrder: 3,
    },
    {
      key: "cash",
      name: "Cash",
      group: "Cash",
      balance: 40000,
      initialBalance: 0,
      note: "Dompet Tunai Fisik (Jajan Receh Pinggir Jalan)",
      sortOrder: 4,
    },
  ];

  const accountMap = new Map<string, string>();
  for (const acc of accountsToCreate) {
    const accId = crypto.randomUUID();
    await db.insert(accounts).values({
      id: accId,
      userId: userId,
      name: acc.name,
      group: acc.group,
      currency: "IDR",
      initialBalance: acc.initialBalance,
      balance: acc.balance,
      note: acc.note,
      sortOrder: acc.sortOrder,
      isHidden: false,
    });
    accountMap.set(acc.key, accId);
  }
  console.log("✅ 4 Akun Finansial berhasil dibuat (Total Saldo: Rp 960.000).");

  // 6. Buat Kategori yang Relevan dengan Micro-Spending Brief
  console.log("🏷️ Membuat Kategori Pengeluaran & Pemasukan...");
  const categoriesToCreate = [
    { key: "gaji", name: "Gaji & Pemasukan", kind: "income", icon: "Banknote" },
    { key: "nongkrong", name: "Nongkrong & Kafe", kind: "expense", icon: "Utensils" },
    { key: "kopi", name: "Kopi & Minuman", kind: "expense", icon: "Coffee" },
    { key: "makan_online", name: "Pesen Makan Online", kind: "expense", icon: "Pizza" },
    { key: "shopee", name: "Belanja Online & Shopee", kind: "expense", icon: "ShoppingCart" },
    { key: "kos", name: "Kebutuhan Kos & Rumah", kind: "expense", icon: "Home" },
    { key: "tagihan", name: "Tagihan & Utilitas", kind: "expense", icon: "Zap" },
    { key: "transport", name: "Transportasi & Ojol", kind: "expense", icon: "Car" },
    { key: "jajan_tunai", name: "Cemilan & Jajan Tunai", kind: "expense", icon: "Cookie" },
    { key: "admin", name: "Biaya Admin & Top-up", kind: "expense", icon: "CreditCard" },
  ];

  const categoryMap = new Map<string, string>();
  for (const cat of categoriesToCreate) {
    const catId = crypto.randomUUID();
    await db.insert(categories).values({
      id: catId,
      userId: userId,
      name: cat.name,
      kind: cat.kind,
      level: 1,
      icon: cat.icon,
      parentId: null,
    });
    categoryMap.set(cat.key, catId);
  }
  console.log("✅ Kategori berhasil dibuat.");

  // 7. Buat Transaksi Kronologis (1 November - 6 November 2026)
  console.log("📝 Memasukkan mutasi & transaksi sintetis (1-6 November 2026)...");

  interface RawTxItem {
    happenedAt: string; // ISO string
    txType: "income" | "expense" | "transfer";
    amount: number;
    accountKey: "blu" | "dana" | "gopay" | "cash";
    toAccountKey?: "blu" | "dana" | "gopay" | "cash";
    catKey?: string;
    note: string;
    tags?: string[];
    excludeFromStats?: boolean;
  }

  const rawTxList: RawTxItem[] = [
    // ------------------------------------------------------------------------
    // HARI 1: 1 November 2026 (HARI GAJIAN & MALAM NONGKRONG SANTAI)
    // ------------------------------------------------------------------------
    {
      happenedAt: "2026-11-01T09:00:00+07:00",
      txType: "income",
      amount: 5000000,
      accountKey: "blu",
      catKey: "gaji",
      note: "Gaji Bulanan PT Digital Finansial Utama",
      tags: ["payroll", "gaji"],
    },
    // Top-up & Tarik Tunai
    {
      happenedAt: "2026-11-01T17:30:00+07:00",
      txType: "transfer",
      amount: 100000,
      accountKey: "blu",
      toAccountKey: "cash",
      note: "Tarik Tunai ATM Blu BCA",
      excludeFromStats: true,
    },
    {
      happenedAt: "2026-11-01T17:35:00+07:00",
      txType: "transfer",
      amount: 320000,
      accountKey: "blu",
      toAccountKey: "gopay",
      note: "Top-up GoPay via Blu BCA",
      excludeFromStats: true,
    },
    {
      happenedAt: "2026-11-01T17:40:00+07:00",
      txType: "transfer",
      amount: 510000,
      accountKey: "blu",
      toAccountKey: "dana",
      note: "Top-up DANA via Blu BCA Virtual Account",
      excludeFromStats: true,
    },
    // Tweet 2: Malamnya langsung nongkrong santai bareng temen
    {
      happenedAt: "2026-11-01T20:30:00+07:00",
      txType: "expense",
      amount: 680000,
      accountKey: "blu",
      catKey: "nongkrong",
      note: "Nongkrong gajian bareng temen kantor (Holywings Resto & Bar)",
      tags: ["nongkrong", "gajian"],
    },
    {
      happenedAt: "2026-11-01T23:45:00+07:00",
      txType: "expense",
      amount: 42000,
      accountKey: "gopay",
      catKey: "transport",
      note: "GoCar pulang nongkrong larut malam",
      tags: ["ojol", "transport"],
    },

    // ------------------------------------------------------------------------
    // HARI 2: 2 November 2026 (Pengeluaran Tetap + Mulai Micro-Spending)
    // ------------------------------------------------------------------------
    {
      happenedAt: "2026-11-02T08:30:00+07:00",
      txType: "expense",
      amount: 24000,
      accountKey: "blu",
      catKey: "kopi",
      note: "Kopi Kenangan Mantan Large",
      tags: ["es-kopi", "micro-spending"],
    },
    {
      happenedAt: "2026-11-02T10:00:00+07:00",
      txType: "expense",
      amount: 1500000,
      accountKey: "blu",
      catKey: "kos",
      note: "Sewa Kos Bulanan Kamar AC",
      tags: ["kos", "fixed-cost"],
    },
    {
      happenedAt: "2026-11-02T10:30:00+07:00",
      txType: "expense",
      amount: 350000,
      accountKey: "blu",
      catKey: "tagihan",
      note: "Paket Data Unlimited & Token Listrik Kos",
      tags: ["tagihan", "utilitas"],
    },
    {
      happenedAt: "2026-11-02T11:00:00+07:00",
      txType: "expense",
      amount: 400000,
      accountKey: "blu",
      catKey: "kos",
      note: "Belanja Bulanan Supermarket (Sabun, Shampo, Stok Kos)",
      tags: ["supermarket", "bulanan"],
    },
    {
      happenedAt: "2026-11-02T12:30:00+07:00",
      txType: "expense",
      amount: 38000,
      accountKey: "gopay",
      catKey: "makan_online",
      note: "GoFood Ayam Geprek Sambal Korek + Nasi",
      tags: ["gofood", "makan-online"],
    },
    {
      happenedAt: "2026-11-02T12:31:00+07:00",
      txType: "expense",
      amount: 2000,
      accountKey: "gopay",
      catKey: "admin",
      note: "Biaya Jasa Aplikasi GoFood",
      tags: ["biaya-admin"],
    },
    {
      happenedAt: "2026-11-02T16:15:00+07:00",
      txType: "expense",
      amount: 28000,
      accountKey: "blu",
      catKey: "kopi",
      note: "Point Coffee Iced Caramel Macchiato",
      tags: ["es-kopi", "micro-spending"],
    },
    {
      happenedAt: "2026-11-02T21:30:00+07:00",
      txType: "expense",
      amount: 54000,
      accountKey: "dana",
      catKey: "shopee",
      note: "Shopee Checkout Case HP Bening + Lanyard",
      tags: ["shopee", "printilan"],
    },
    {
      happenedAt: "2026-11-02T21:31:00+07:00",
      txType: "expense",
      amount: 1000,
      accountKey: "dana",
      catKey: "admin",
      note: "Biaya Penanganan Shopee",
      tags: ["biaya-admin"],
    },

    // ------------------------------------------------------------------------
    // HARI 3: 3 November 2026 (Deretan Micro-Spending Tweet 3)
    // ------------------------------------------------------------------------
    {
      happenedAt: "2026-11-03T08:45:00+07:00",
      txType: "expense",
      amount: 24000,
      accountKey: "blu",
      catKey: "kopi",
      note: "Janji Jiwa Es Kopi Pokat",
      tags: ["es-kopi", "micro-spending"],
    },
    {
      happenedAt: "2026-11-03T13:10:00+07:00",
      txType: "expense",
      amount: 48000,
      accountKey: "gopay",
      catKey: "makan_online",
      note: "GoFood Nasi Padang Rendang Komplit",
      tags: ["gofood", "makan-online"],
    },
    {
      happenedAt: "2026-11-03T13:11:00+07:00",
      txType: "expense",
      amount: 2000,
      accountKey: "gopay",
      catKey: "admin",
      note: "Biaya Jasa Aplikasi GoFood",
      tags: ["biaya-admin"],
    },
    {
      happenedAt: "2026-11-03T15:40:00+07:00",
      txType: "expense",
      amount: 18000,
      accountKey: "cash",
      catKey: "jajan_tunai",
      note: "Gorengan Bakwan & Es Teh Manis pinggir jalan",
      tags: ["jajan-receh"],
    },
    {
      happenedAt: "2026-11-03T19:20:00+07:00",
      txType: "expense",
      amount: 35000,
      accountKey: "blu",
      catKey: "kopi",
      note: "Fore Coffee Butterscotch Sea Salt Latte",
      tags: ["es-kopi", "micro-spending"],
    },
    {
      happenedAt: "2026-11-03T22:10:00+07:00",
      txType: "expense",
      amount: 68000,
      accountKey: "dana",
      catKey: "shopee",
      note: "Shopee Checkout Kabel Type-C Braided 2 Meter",
      tags: ["shopee", "printilan"],
    },
    {
      happenedAt: "2026-11-03T22:11:00+07:00",
      txType: "expense",
      amount: 2500,
      accountKey: "dana",
      catKey: "admin",
      note: "Biaya Layanan Pembayaran Virtual Account",
      tags: ["biaya-admin"],
    },

    // ------------------------------------------------------------------------
    // HARI 4: 4 November 2026
    // ------------------------------------------------------------------------
    {
      happenedAt: "2026-11-04T09:00:00+07:00",
      txType: "expense",
      amount: 25000,
      accountKey: "blu",
      catKey: "kopi",
      note: "Kopi Tuku Es Kopi Susu Tetangga",
      tags: ["es-kopi", "tuku"],
    },
    {
      happenedAt: "2026-11-04T12:30:00+07:00",
      txType: "expense",
      amount: 45000,
      accountKey: "dana",
      catKey: "makan_online",
      note: "ShopeeFood Mie Gacoan Level 3 + Udang Keju",
      tags: ["shopeefood", "makan-online"],
    },
    {
      happenedAt: "2026-11-04T12:31:00+07:00",
      txType: "expense",
      amount: 2000,
      accountKey: "dana",
      catKey: "admin",
      note: "Biaya Jasa ShopeeFood",
      tags: ["biaya-admin"],
    },
    {
      happenedAt: "2026-11-04T15:15:00+07:00",
      txType: "expense",
      amount: 15000,
      accountKey: "cash",
      catKey: "jajan_tunai",
      note: "Cilok Kuah & Es Jeruk depan kantor",
      tags: ["jajan-receh"],
    },
    {
      happenedAt: "2026-11-04T18:30:00+07:00",
      txType: "expense",
      amount: 75000,
      accountKey: "blu",
      catKey: "nongkrong",
      note: "Nongkrong ngopi sore bareng anak desain (Kopi Nako)",
      tags: ["nongkrong", "kopi"],
    },
    {
      happenedAt: "2026-11-04T23:00:00+07:00",
      txType: "expense",
      amount: 59000,
      accountKey: "dana",
      catKey: "shopee",
      note: "Shopee Checkout Mousepad Estetik Meja Kerja",
      tags: ["shopee", "printilan"],
    },
    {
      happenedAt: "2026-11-04T23:01:00+07:00",
      txType: "expense",
      amount: 1000,
      accountKey: "dana",
      catKey: "admin",
      note: "Biaya Penanganan Shopee",
      tags: ["biaya-admin"],
    },

    // ------------------------------------------------------------------------
    // HARI 5: 5 November 2026
    // ------------------------------------------------------------------------
    {
      happenedAt: "2026-11-05T08:15:00+07:00",
      txType: "expense",
      amount: 28000,
      accountKey: "blu",
      catKey: "kopi",
      note: "Tomoro Coffee Oatside Aren Latte",
      tags: ["es-kopi", "tomoro"],
    },
    {
      happenedAt: "2026-11-05T12:15:00+07:00",
      txType: "expense",
      amount: 62000,
      accountKey: "gopay",
      catKey: "makan_online",
      note: "GoFood Paket Panas McD + McFlurry",
      tags: ["gofood", "mcd"],
    },
    {
      happenedAt: "2026-11-05T12:16:00+07:00",
      txType: "expense",
      amount: 3000,
      accountKey: "gopay",
      catKey: "admin",
      note: "Biaya Layanan & Ongkir GoFood",
      tags: ["biaya-admin"],
    },
    {
      happenedAt: "2026-11-05T16:00:00+07:00",
      txType: "expense",
      amount: 28000,
      accountKey: "blu",
      catKey: "kopi",
      note: "Kopi Kenangan Avocado Coffee",
      tags: ["es-kopi", "kenangan"],
    },
    {
      happenedAt: "2026-11-05T17:30:00+07:00",
      txType: "expense",
      amount: 20000,
      accountKey: "gopay",
      catKey: "transport",
      note: "GoRide pulang kantor pas hujan rintik",
      tags: ["ojol", "goride"],
    },
    {
      happenedAt: "2026-11-05T20:15:00+07:00",
      txType: "expense",
      amount: 180000,
      accountKey: "dana",
      catKey: "shopee",
      note: "Shopee Checkout Kaos Polos Oversize + Kaos Kaki",
      tags: ["shopee", "baju"],
    },
    {
      happenedAt: "2026-11-05T20:16:00+07:00",
      txType: "expense",
      amount: 2500,
      accountKey: "dana",
      catKey: "admin",
      note: "Biaya Layanan Virtual Account",
      tags: ["biaya-admin"],
    },
    {
      happenedAt: "2026-11-05T21:00:00+07:00",
      txType: "expense",
      amount: 42000,
      accountKey: "dana",
      catKey: "shopee",
      note: "Shopee Checkout Phone Desk Stand Holder",
      tags: ["shopee", "printilan"],
    },
    {
      happenedAt: "2026-11-05T21:01:00+07:00",
      txType: "expense",
      amount: 1000,
      accountKey: "dana",
      catKey: "admin",
      note: "Biaya Penanganan Shopee",
      tags: ["biaya-admin"],
    },
    {
      happenedAt: "2026-11-05T21:05:00+07:00",
      txType: "expense",
      amount: 6000,
      accountKey: "dana",
      catKey: "shopee",
      note: "Shopee Checkout Sticker Pack Estetik Laptop",
      tags: ["shopee", "printilan"],
    },
    {
      happenedAt: "2026-11-05T21:06:00+07:00",
      txType: "expense",
      amount: 1000,
      accountKey: "dana",
      catKey: "admin",
      note: "Biaya Penanganan Shopee",
      tags: ["biaya-admin"],
    },
    {
      happenedAt: "2026-11-05T22:30:00+07:00",
      txType: "expense",
      amount: 38000,
      accountKey: "gopay",
      catKey: "makan_online",
      note: "GoFood Martabak Mini Manis Coklat Keju",
      tags: ["gofood", "snack"],
    },
    {
      happenedAt: "2026-11-05T22:31:00+07:00",
      txType: "expense",
      amount: 2000,
      accountKey: "gopay",
      catKey: "admin",
      note: "Biaya Jasa GoFood",
      tags: ["biaya-admin"],
    },

    // ------------------------------------------------------------------------
    // HARI 6: 6 November 2026 (HARI INI - Pas kaget saldo recehan & buka Fin.IQ)
    // ------------------------------------------------------------------------
    {
      happenedAt: "2026-11-06T08:20:00+07:00",
      txType: "expense",
      amount: 20000,
      accountKey: "blu",
      catKey: "kopi",
      note: "Kopi Tuku Es Kopi Susu Tetangga",
      tags: ["es-kopi", "tuku"],
    },
    {
      happenedAt: "2026-11-06T12:00:00+07:00",
      txType: "expense",
      amount: 36000,
      accountKey: "gopay",
      catKey: "makan_online",
      note: "GoFood Soto Ayam Lamongan Komplit",
      tags: ["gofood", "makan-siang"],
    },
    {
      happenedAt: "2026-11-06T12:01:00+07:00",
      txType: "expense",
      amount: 2000,
      accountKey: "gopay",
      catKey: "admin",
      note: "Biaya Jasa Aplikasi GoFood",
      tags: ["biaya-admin"],
    },
    {
      happenedAt: "2026-11-06T14:00:00+07:00",
      txType: "expense",
      amount: 27000,
      accountKey: "cash",
      catKey: "jajan_tunai",
      note: "Jajan Roti Bakar Coklat & Kopi Botol",
      tags: ["jajan-receh"],
    },
    {
      happenedAt: "2026-11-06T15:30:00+07:00",
      txType: "expense",
      amount: 3000,
      accountKey: "blu",
      catKey: "admin",
      note: "Biaya Notifikasi SMS & Administrasi Bank",
      tags: ["biaya-admin"],
    },
  ];

  let insertedTxCount = 0;
  for (const item of rawTxList) {
    const accId = accountMap.get(item.accountKey)!;
    const toAccId = item.toAccountKey ? accountMap.get(item.toAccountKey) : null;
    const catId = item.catKey ? categoryMap.get(item.catKey) : null;

    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      userId: userId,
      ledgerId: userLedger.id,
      txType: item.txType,
      amount: item.amount,
      currency: "IDR",
      nativeAmount: item.amount,
      happenedAt: new Date(item.happenedAt),
      note: item.note,
      accountId: accId,
      toAccountId: toAccId,
      categoryId: catId,
      tagsJson: item.tags || [],
      excludeFromStats: Boolean(item.excludeFromStats),
    });
    insertedTxCount++;
  }
  console.log(`✅ Berhasil memasukkan ${insertedTxCount} transaksi sintetis.`);

  // 8. Buat Sesi & Pesan AI Assistant (Tweet 6: Drawer Asisten AI)
  console.log("🤖 Menyimpan percakapan Asisten AI (Bang Peci)...");
  const aiSessionId = crypto.randomUUID();

  await db.insert(aiChatSessions).values({
    id: aiSessionId,
    userId: userId,
    title: "Audit Pos Boros & Batas Belanja Harian",
    modelUsed: "google/gemini-2.5-flash",
  });

  const userQueryText =
    "Tolong audit pos belanja terbesar gue: mana pengeluaran yang paling bikin tekor atau boros, dan hitung batas maksimal jajan harian gue biar gak boncos di akhir bulan!";

  const aiAnswerText = `Halo bos Jordan! 👋 Gua udah bedah data mutasi rekening dan e-wallet lu (**Blu, GoPay, Dana, & Cash**). Ini diagnosa lengkap dan jurus penyelamat dompet lu:

---

### 🚨 1. BUKTI KEBOCORAN HALUS (MICRO-SPENDING AUDIT)
Berdasarkan mutasi seminggu terakhir setelah gajian, **bocoran terbesar lu BUKAN barang mewah atau liburan**, melainkan **kebocoran halus recehan**:

| Pos Pengeluaran | Frekuensi | Total Nominal | Catatan Diagnosa |
|---|---|---|---|
| ☕ **Es Kopi & Nongkrong** | 12x transaksi | **Rp 385.000** | Kopi Kenangan, Tuku, Fore, Janji Jiwa (rata-rata 2 cup/hari) |
| 🛵 **GoFood / ShopeeFood** | 14x pesanan | **Rp 680.000** | Pesen makan online pas mager di kos (ada ongkir & biaya resto) |
| 🛍️ **Shopee Printilan Receh** | 8x checkout | **Rp 380.000** | Casing HP, kabel, holder, printilan puluhan ribu yang numpuk |
| 💳 **Biaya Admin & Top-up** | 16x transaksi | **Rp 35.000** | Biaya top-up e-wallet Rp1.000 - Rp2.500 yang sering disepelein |

> ⚠️ **Total Micro-Spending:** Lu udah ngeluarin **Rp 1.480.000** hanya dalam 6 hari pertama untuk hal-hal kecil!

---

### 🛡️ 2. PERHITUNGAN BATAS BELANJA HARIAN (SAFE SPEND LIMIT)
Saat ini sisa saldo lu adalah:
- **Blu (BCA Digital):** Rp 850.000
- **Dana:** Rp 45.000
- **Cash (Dompet):** Rp 40.000
- **GoPay:** Rp 25.000
- **Total Saldo Aktif:** **Rp 960.000**

Sisa hari di bulan November: **24 hari** lagi.

🎯 **Biar ga boncos akhir bulan, budget jajan lu max Rp40.000 per hari.**

---

### 💡 3. JURUS BIAR GAK BONCOS (ACTION PLAN)
1. **Aturan 1 Cup Kopi:** Batasi ngopi maksimal 1x sehari (pilih opsi reguler ~Rp18.000) atau seduh kopi drip bag di kos.
2. **Karantina Keranjang Shopee 24 Jam:** Sebelum checkout barang receh, endapkan dulu 24 jam. Biasanya besoknya udah gak pengen.
3. **Makan Siang Terencana:** Alihkan minimal 1 pesanan GoFood per hari ke warteg/masak simple di kos (bisa hemat Rp25.000/hari).
4. **Top-up Sekaligus:** Jangan top-up Rp20rb berkali-kali biar gak kena potong biaya admin berkali-kali.

Tenang bos, lu masih tetap bisa jajan dan nongkrong asalkan disiplin sama jatah **Rp40.000/hari** ini! Semangat! 🚀`;

  // Pesan User
  await db.insert(aiChatMessages).values({
    id: crypto.randomUUID(),
    sessionId: aiSessionId,
    userId: userId,
    role: "user",
    content: userQueryText,
    createdAt: new Date("2026-11-06T15:45:00+07:00"),
  });

  // Pesan AI Assistant
  await db.insert(aiChatMessages).values({
    id: crypto.randomUUID(),
    sessionId: aiSessionId,
    userId: userId,
    role: "assistant",
    content: aiAnswerText,
    modelUsed: "google/gemini-2.5-flash",
    createdAt: new Date("2026-11-06T15:45:05+07:00"),
  });

  console.log("✅ Percakapan AI berhasil disimpan.");

  // 9. Simpan Storage State Jordan untuk Pengujian E2E & Screenshot Browser
  const sessionToken = createSessionToken({ userId: userId, email: targetEmail });
  const authState = {
    cookies: [
      {
        name: "finiq_session",
        value: sessionToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ],
    origins: [
      {
        origin: "http://localhost:3000",
        localStorage: [
          { name: "finiq_tour_welcomed", value: "true" },
          { name: "finiq_tour_completed", value: "true" },
        ],
      },
    ],
  };

  const jordanAuthPath = path.join(process.cwd(), "tests", "e2e", ".auth", "jordan.json");
  fs.writeFileSync(jordanAuthPath, JSON.stringify(authState, null, 2), "utf-8");
  console.log(`💾 Auth state tersimpan di: ${jordanAuthPath}`);

  console.log("\n🎉 [FIN.IQ] SEEDING DATA SINTETIS JORDAN SELESAI!");
  console.log("==================================================================");
  console.log("Akun Jordan:");
  console.log(`- Email: ${targetEmail}`);
  console.log("- Password: 123456");
  console.log("- Total Saldo: Rp 960.000");
  console.log("  * Blu: Rp 850.000");
  console.log("  * Dana: Rp 45.000");
  console.log("  * Cash: Rp 40.000");
  console.log("  * GoPay: Rp 25.000");
  console.log("- Arus Kas Bulan Ini:");
  console.log("  * Pemasukan: +Rp 5.000.000 (Gaji)");
  console.log("  * Pengeluaran: -Rp 4.040.000 (Kos, Tagihan, Nongkrong, Micro-Spending)");
  console.log("  * Arus Kas Bersih: +Rp 960.000");
  console.log("- Safe Spend Limit: Rp 960.000 / 24 hari = Rp 40.000/hari!");
  console.log("==================================================================");

  await pool.end();
}

main().catch((err) => {
  console.error("❌ Gagal seeding data Jordan:", err);
  process.exit(1);
});

