import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import * as fs from "fs";
import * as path from "path";
import { db } from "../src/server/db";
import { users, ledgers, accounts, categories, transactions } from "../src/server/db/schema";
import { eq, and, sql } from "drizzle-orm";

interface CategoryDefinition {
  name: string;
  kind: "expense" | "income";
  icon: string;
  subcategories?: { name: string; icon: string }[];
}

const BEECOUNT_CATEGORIES: CategoryDefinition[] = [
  // ================= EXPENSE CATEGORIES =================
  {
    name: "Makanan & Minuman",
    kind: "expense",
    icon: "Utensils",
    subcategories: [
      { name: "Restoran", icon: "Utensils" },
      { name: "Makan Harian", icon: "Utensils" },
      { name: "Makanan Cepat Saji", icon: "Pizza" },
      { name: "Kopi & Minuman", icon: "Coffee" },
      { name: "Bar & Minuman", icon: "Wine" },
      { name: "Kue & Bakery", icon: "Cake" },
      { name: "Pizza & Western", icon: "Pizza" },
      { name: "Es Krim & Dessert", icon: "IceCream" },
    ],
  },
  {
    name: "Transportasi",
    kind: "expense",
    icon: "Car",
    subcategories: [
      { name: "Bahan Bakar & SPBU", icon: "Fuel" },
      { name: "Mobil Pribadi", icon: "Car" },
      { name: "Bus & Angkot", icon: "Bus" },
      { name: "Kereta & MRT / KRL", icon: "Train" },
      { name: "Taksi & Ojek Online", icon: "CarTaxiFront" },
      { name: "Tiket Pesawat", icon: "Plane" },
      { name: "Kereta Api Jarak Jauh", icon: "Train" },
      { name: "Sepeda", icon: "Bike" },
      { name: "Parkir & Tol", icon: "SquareParking" },
    ],
  },
  {
    name: "Belanja & Belanjaan",
    kind: "expense",
    icon: "ShoppingBag",
    subcategories: [
      { name: "Belanja Online", icon: "ShoppingCart" },
      { name: "Supermarket & Minimarket", icon: "Store" },
      { name: "Toko Kelontong", icon: "Store" },
      { name: "Mall & Pusat Belanja", icon: "Building" },
      { name: "Pakaian & Busana", icon: "Shirt" },
      { name: "Aksesoris & Jam Tangan", icon: "Watch" },
      { name: "Perhiasan", icon: "Gem" },
    ],
  },
  {
    name: "Hiburan & Rekreasi",
    kind: "expense",
    icon: "Gamepad2",
    subcategories: [
      { name: "Film & Bioskop", icon: "Film" },
      { name: "Musik & Konser", icon: "Music" },
      { name: "Game & Voucher", icon: "Gamepad2" },
      { name: "Sepak Bola & Olahraga", icon: "Trophy" },
      { name: "Liburan & Wisata", icon: "Palmtree" },
      { name: "Fotografi", icon: "Camera" },
      { name: "Seni & Hobi", icon: "Palette" },
    ],
  },
  {
    name: "Kebutuhan Rumah",
    kind: "expense",
    icon: "Home",
    subcategories: [
      { name: "Perabot & Rumah Tangga", icon: "Home" },
      { name: "Laundry & Cuci Baju", icon: "Sparkles" },
      { name: "Kebersihan & Alat Cuci", icon: "Sparkles" },
      { name: "Perbaikan & Tukang", icon: "Wrench" },
      { name: "Listrik & Elektronik", icon: "Zap" },
      { name: "Hewan Peliharaan", icon: "Dog" },
      { name: "Kebutuhan Bayi & Anak", icon: "Baby" },
    ],
  },
  {
    name: "Kesehatan & Medis",
    kind: "expense",
    icon: "HeartPulse",
    subcategories: [
      { name: "Rumah Sakit & Rawat", icon: "Building2" },
      { name: "Klinik & Dokter", icon: "Stethoscope" },
      { name: "Obat & Apotek", icon: "Pill" },
      { name: "Gym & Fitness", icon: "Dumbbell" },
      { name: "Salon & Spa", icon: "Sparkles" },
      { name: "Konseling & Mental", icon: "Brain" },
      { name: "Skincare & Perawatan", icon: "Sparkles" },
      { name: "Potong Rambut", icon: "Scissors" },
    ],
  },
  {
    name: "Pendidikan & Karir",
    kind: "expense",
    icon: "GraduationCap",
    subcategories: [
      { name: "Sekolah & Kuliah", icon: "GraduationCap" },
      { name: "Buku & Referensi", icon: "BookOpen" },
      { name: "Komputer & Perangkat", icon: "Laptop" },
      { name: "Pulsa & Paket Data", icon: "Phone" },
      { name: "Kursus Bahasa & Skill", icon: "Languages" },
      { name: "Alat Kantor & Riset", icon: "Briefcase" },
    ],
  },
  {
    name: "Tagihan & Finansial",
    kind: "expense",
    icon: "Receipt",
    subcategories: [
      { name: "Tagihan Listrik & Air", icon: "Zap" },
      { name: "Internet & Wifi", icon: "Wifi" },
      { name: "Donasi & Zakat", icon: "HeartHandshake" },
      { name: "Biaya Administrasi Bank", icon: "CreditCard" },
      { name: "Pengeluaran Lainnya", icon: "CircleEllipsis" },
    ],
  },

  // ================= INCOME CATEGORIES =================
  {
    name: "Gaji & Penghasilan Kerja",
    kind: "income",
    icon: "Briefcase",
    subcategories: [
      { name: "Gaji Pokok Bulanan", icon: "Coins" },
      { name: "Bonus Kerja & THR", icon: "Gift" },
      { name: "Insentif & Komisi", icon: "Trophy" },
      { name: "Uang Lembur", icon: "Clock" },
      { name: "Hasil Bisnis & Dagang", icon: "Building" },
      { name: "Jasa Teknik & IT", icon: "Laptop" },
      { name: "Jasa Desain & Kreatif", icon: "Palette" },
    ],
  },
  {
    name: "Investasi & Finansial",
    kind: "income",
    icon: "TrendingUp",
    subcategories: [
      { name: "Keuntungan Saham & Reksa Dana", icon: "TrendingUp" },
      { name: "Bunga Tabungan & Deposito", icon: "Landmark" },
      { name: "Dividen & Bagi Hasil", icon: "Coins" },
      { name: "Sewa Kos / Properti", icon: "Home" },
      { name: "Selisih Kurs Valas", icon: "ArrowLeftRight" },
      { name: "Cashback & Reward Kartu", icon: "CreditCard" },
    ],
  },
  {
    name: "Hadiah & Rezeki",
    kind: "income",
    icon: "Gift",
    subcategories: [
      { name: "Angpao & Hadiah Tunai", icon: "Gift" },
      { name: "Kado & Hadiah Acara", icon: "PartyPopper" },
      { name: "Penghargaan & Juara", icon: "Trophy" },
      { name: "Poin Loyalitas & Voucher", icon: "Ticket" },
    ],
  },
  {
    name: "Pemasukan Lainnya",
    kind: "income",
    icon: "Wallet",
    subcategories: [
      { name: "Pekerjaan Sampingan / Freelance", icon: "Laptop" },
      { name: "Pengembalian Dana / Refund", icon: "RotateCcw" },
      { name: "Klaim & Reimburse Kantor", icon: "FileText" },
      { name: "Penjualan Barang Bekas", icon: "Tag" },
      { name: "Pendapatan Lain-lain", icon: "CircleEllipsis" },
    ],
  },
];

const STANDARD_ACCOUNTS_SEED = [
  { name: "Kas Tunai", group: "Cash", balance: 500000, note: "Dompet uang tunai utama" },
  { name: "Blu", group: "Bank card", balance: 4500000, note: "Rekening blu by BCA Digital" },
  { name: "DANA", group: "Alipay", balance: 350000, note: "E-wallet DANA" },
  { name: "GoPay", group: "Alipay", balance: 250000, note: "E-wallet GoPay" },
  { name: "BCA", group: "Bank card", balance: 12500000, note: "Rekening Bank Central Asia" },
];

async function seedSyntheticData() {
  console.log("🚀 [Fin.IQ] Memulai sinkronisasi akun, kategori, dan data sintetis untuk semua pengguna...");

  const allUsers = await db.select().from(users);
  console.log(`👥 Ditemukan ${allUsers.length} pengguna terdaftar.`);

  // Baca dataset sintetis dari dataset/fin_iq_dataset/transactions_all.csv
  const datasetCsvPath = path.join(process.cwd(), "dataset", "fin_iq_dataset", "transactions_all.csv");
  let syntheticRows: Array<{
    text: string;
    kind: "expense" | "income";
    category: string;
    subcategory: string;
    amount: number;
  }> = [];

  if (fs.existsSync(datasetCsvPath)) {
    console.log("📖 Membaca sample transaksi dari:", datasetCsvPath);
    const content = fs.readFileSync(datasetCsvPath, "utf-8");
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

    for (let i = 1; i < lines.length && syntheticRows.length < 500; i++) {
      const parts = lines[i].split(",");
      if (parts.length >= 7) {
        const text = parts[1]?.replace(/^"|"$/g, "").trim();
        const kind = parts[3]?.trim() === "income" ? ("income" as const) : ("expense" as const);
        const category = parts[4]?.replace(/^"|"$/g, "").trim();
        const subcategory = parts[5]?.replace(/^"|"$/g, "").trim();
        const amount = parseInt(parts[6]?.trim() || "0", 10);
        if (text && amount > 0) {
          syntheticRows.push({ text, kind, category, subcategory, amount });
        }
      }
    }
    console.log(`📊 Berhasil memuat ${syntheticRows.length} contoh transaksi sintetis.`);
  }

  for (const user of allUsers) {
    console.log(`\n========================================`);
    console.log(`👤 Memproses User: ${user.email} (${user.id})`);

    // 1. Pastikan Buku Kas / Ledger ada
    let userLedgers = await db.select().from(ledgers).where(eq(ledgers.userId, user.id));
    let primaryLedger = userLedgers[0];
    if (!primaryLedger) {
      const newLedgerId = crypto.randomUUID();
      await db.insert(ledgers).values({
        id: newLedgerId,
        userId: user.id,
        name: "Buku Kas Utama",
        currency: "IDR",
        monthStartDay: 1,
      });
      primaryLedger = { id: newLedgerId, userId: user.id, name: "Buku Kas Utama", currency: "IDR", monthStartDay: 1 } as any;
      console.log(`  📘 Dibuat Ledger default.`);
    }

    // 2. Pastikan Akun-Akun Standar Ada (termasuk Blu)
    const existingAccounts = await db.select().from(accounts).where(eq(accounts.userId, user.id));
    const existingAccMap = new Map<string, typeof existingAccounts[0]>();
    for (const a of existingAccounts) {
      existingAccMap.set(a.name.toLowerCase().trim(), a);
    }

    for (const seedAcc of STANDARD_ACCOUNTS_SEED) {
      const lower = seedAcc.name.toLowerCase().trim();
      let exists = existingAccMap.get(lower);
      // Cek variasi nama blu
      if (!exists && (lower === "blu" || lower === "blue")) {
        exists = existingAccMap.get("blu") || existingAccMap.get("blue");
      }
      if (!exists) {
        const newAccId = crypto.randomUUID();
        await db.insert(accounts).values({
          id: newAccId,
          userId: user.id,
          name: seedAcc.name,
          group: seedAcc.group,
          currency: "IDR",
          initialBalance: seedAcc.balance,
          balance: seedAcc.balance,
          note: seedAcc.note,
        });
        const createdAcc = {
          id: newAccId,
          userId: user.id,
          name: seedAcc.name,
          group: seedAcc.group,
          currency: "IDR",
          initialBalance: seedAcc.balance,
          balance: seedAcc.balance,
          note: seedAcc.note,
        } as any;
        existingAccMap.set(lower, createdAcc);
        console.log(`  💳 Menambahkan Akun '${seedAcc.name}' (${seedAcc.group}) Saldo: Rp ${seedAcc.balance.toLocaleString("id-ID")}`);
      } else {
        console.log(`  💳 Akun '${exists.name}' sudah ada.`);
      }
    }

    // 3. Pastikan Semua Kategori & Subkategori BeeCount / Dataset Ada
    const existingCats = await db.select().from(categories).where(eq(categories.userId, user.id));
    const catMap = new Map<string, typeof existingCats[0]>();
    for (const c of existingCats) {
      catMap.set(c.name.toLowerCase().trim(), c);
    }

    let addedCatCount = 0;
    for (const group of BEECOUNT_CATEGORIES) {
      let parentCat = catMap.get(group.name.toLowerCase().trim());
      if (!parentCat) {
        const parentId = crypto.randomUUID();
        await db.insert(categories).values({
          id: parentId,
          userId: user.id,
          name: group.name,
          kind: group.kind,
          level: 1,
          icon: group.icon,
          parentId: null,
        });
        parentCat = { id: parentId, userId: user.id, name: group.name, kind: group.kind, level: 1, icon: group.icon, parentId: null } as any;
        catMap.set(group.name.toLowerCase().trim(), parentCat);
        addedCatCount++;
      }

      if (group.subcategories) {
        for (const sub of group.subcategories) {
          const subLower = sub.name.toLowerCase().trim();
          if (!catMap.has(subLower)) {
            const subId = crypto.randomUUID();
            await db.insert(categories).values({
              id: subId,
              userId: user.id,
              name: sub.name,
              kind: group.kind,
              level: 2,
              icon: sub.icon,
              parentId: parentCat.id,
            });
            const subCat = { id: subId, userId: user.id, name: sub.name, kind: group.kind, level: 2, icon: sub.icon, parentId: parentCat.id } as any;
            catMap.set(subLower, subCat);
            addedCatCount++;
          }
        }
      }
    }
    if (addedCatCount > 0) {
      console.log(`  🏷️ Menambahkan ${addedCatCount} kategori & subkategori baru.`);
    } else {
      console.log(`  🏷️ Kategori lengkap (${existingCats.length} kategori).`);
    }

    // 4. Masukkan Data Sintetis jika Transaksi User Kurang dari 30
    const txCountRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(eq(transactions.userId, user.id));
    const currentTxCount = Number(txCountRes[0]?.count || 0);

    console.log(`  📊 Jumlah transaksi saat ini: ${currentTxCount}`);

    if (currentTxCount < 30 && syntheticRows.length > 0) {
      console.log(`  📥 Memasukkan 60 transaksi sintetis dari dataset Fin.IQ...`);

      const userAccountsList = Array.from(existingAccMap.values());
      const bluAcc = existingAccMap.get("blu") || existingAccMap.get("blue") || userAccountsList[0];
      const cashAcc = existingAccMap.get("kas tunai") || existingAccMap.get("cash") || userAccountsList[0];
      const danaAcc = existingAccMap.get("dana") || userAccountsList[0];
      const gopayAcc = existingAccMap.get("gopay") || userAccountsList[0];
      const bcaAcc = existingAccMap.get("bca") || bluAcc;

      const pickAccount = (subcat: string, kind: string) => {
        const sub = subcat.toLowerCase();
        if (kind === "income") return bluAcc.id;
        if (sub.includes("kopi") || sub.includes("makan") || sub.includes("cepat saji")) return bluAcc.id;
        if (sub.includes("spbu") || sub.includes("bensin") || sub.includes("pasar") || sub.includes("kelontong")) return cashAcc.id;
        if (sub.includes("ojek") || sub.includes("taksi") || sub.includes("pulsa") || sub.includes("game")) return gopayAcc.id;
        if (sub.includes("online") || sub.includes("belanja") || sub.includes("listrik")) return danaAcc.id;
        return bcaAcc.id;
      };

      // Buat 60 transaksi tersebar dalam 60 hari terakhir
      const now = new Date();
      let insertedTxCount = 0;

      // Ambil 60 sampel yang bervariasi
      const selectedSamples = syntheticRows.slice(0, 60);

      for (let idx = 0; idx < selectedSamples.length; idx++) {
        const item = selectedSamples[idx];
        const daysAgo = Math.floor((idx / selectedSamples.length) * 45); // 0 sampai 45 hari lalu
        const txDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 - (idx * 37 * 60 * 1000));

        // Cari kategori ID yang sesuai
        const matchedCat = catMap.get(item.subcategory.toLowerCase().trim()) || catMap.get(item.category.toLowerCase().trim());
        const accId = pickAccount(item.subcategory, item.kind);

        // Bersihkan note dari instruksi noise
        let cleanNote = item.text
          .replace(/^(?:tadi pagi|tadi siang|tadi malam|kemarin|malam ini|pas gajian|eh tolong catat|input pengeluaran|catat)\s+/gi, "")
          .replace(/\s*(=|sebesar|seharga|nominal)?\s*(?:rp|idr)?\.?\s*\d+[\.,\d]*\s*(?:rb|ribu|k|jt)?\s*(?:gan|ya|wkwk)?$/gi, "")
          .trim();
        if (!cleanNote || cleanNote.length < 3) cleanNote = item.subcategory;
        cleanNote = cleanNote.charAt(0).toUpperCase() + cleanNote.slice(1);

        await db.insert(transactions).values({
          id: crypto.randomUUID(),
          userId: user.id,
          ledgerId: primaryLedger.id,
          txType: item.kind,
          amount: item.amount,
          currency: "IDR",
          nativeAmount: item.amount,
          happenedAt: txDate,
          note: cleanNote,
          accountId: accId,
          categoryId: matchedCat ? matchedCat.id : null,
          tagsJson: [item.category.toLowerCase().replace(/\s+/g, "-")],
        });

        insertedTxCount++;
      }

      console.log(`  ✅ Berhasil memasukkan ${insertedTxCount} transaksi sintetis untuk ${user.email}!`);
    }
  }

  console.log(`\n🎉 [Fin.IQ] Sinkronisasi seluruh data sintetis selesai dengan sukses!`);
  process.exit(0);
}

seedSyntheticData().catch((err) => {
  console.error("❌ Gagal seeding data sintetis:", err);
  process.exit(1);
});
