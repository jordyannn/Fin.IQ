import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/server/db";
import { categories, users } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

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

async function seedBeeCountCategories() {
  console.log("🐝 [Fin.IQ] Menyiapkan integrasi kategori lengkap dari BeeCount-Cloud...");

  const user = await db.query.users.findFirst();
  if (!user) {
    console.error("❌ User tidak ditemukan di database!");
    process.exit(1);
  }

  // Get current existing categories for user
  const existing = await db.query.categories.findMany({
    where: eq(categories.userId, user.id),
  });
  const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));

  let insertedCount = 0;

  for (const group of BEECOUNT_CATEGORIES) {
    let parentId: string | null = null;

    // Check if main category exists
    const groupLower = group.name.toLowerCase();
    const existingGroup = existing.find((c) => c.name.toLowerCase() === groupLower);

    if (existingGroup) {
      parentId = existingGroup.id;
    } else {
      parentId = crypto.randomUUID();
      await db
        .insert(categories)
        .values({
          id: parentId,
          userId: user.id,
          name: group.name,
          kind: group.kind,
          level: 1,
          icon: group.icon,
          parentId: null,
        });
      existingNames.add(groupLower);
      insertedCount++;
    }

    // Insert subcategories
    if (group.subcategories && parentId) {
      for (const sub of group.subcategories) {
        const subLower = sub.name.toLowerCase();
        if (!existingNames.has(subLower)) {
          await db.insert(categories).values({
            userId: user.id,
            name: sub.name,
            kind: group.kind,
            level: 2,
            icon: sub.icon,
            parentId: parentId,
          });
          existingNames.add(subLower);
          insertedCount++;
        }
      }
    }
  }

  console.log(`✅ Sukses menambahkan ${insertedCount} kategori BeeCount-Cloud ke Fin.IQ!`);
}

seedBeeCountCategories()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Gagal seeding kategori:", err);
    process.exit(1);
  });
