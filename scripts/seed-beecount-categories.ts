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
    name: "Makanan & Minuman (餐饮)",
    kind: "expense",
    icon: "Utensils",
    subcategories: [
      { name: "Restoran (餐厅)", icon: "Utensils" },
      { name: "Makan Harian (用餐)", icon: "Utensils" },
      { name: "Makanan Cepat Saji (快餐)", icon: "Pizza" },
      { name: "Kopi & Minuman (咖啡)", icon: "Coffee" },
      { name: "Bar & Minuman (酒吧)", icon: "Wine" },
      { name: "Kue & Bakery (蛋糕)", icon: "Cake" },
      { name: "Pizza & Western (披萨)", icon: "Pizza" },
      { name: "Es Krim & Dessert (冰淇淋)", icon: "IceCream" },
    ],
  },
  {
    name: "Transportasi (交通)",
    kind: "expense",
    icon: "Car",
    subcategories: [
      { name: "Bahan Bakar & SPBU (加油)", icon: "Fuel" },
      { name: "Mobil Pribadi (汽车)", icon: "Car" },
      { name: "Bus & Angkot (公交)", icon: "Bus" },
      { name: "Kereta & MRT / KRL (地铁)", icon: "Train" },
      { name: "Taksi & Ojek Online (出租车)", icon: "CarTaxiFront" },
      { name: "Tiket Pesawat (飞机)", icon: "Plane" },
      { name: "Kereta Api Jarak Jauh (火车)", icon: "Train" },
      { name: "Sepeda (自行车)", icon: "Bike" },
      { name: "Parkir & Tol (停车)", icon: "SquareParking" },
    ],
  },
  {
    name: "Belanja & Belanjaan (购物)",
    kind: "expense",
    icon: "ShoppingBag",
    subcategories: [
      { name: "Belanja Online (购物车)", icon: "ShoppingCart" },
      { name: "Supermarket & Minimarket (超市)", icon: "Store" },
      { name: "Toko Kelontong (商店)", icon: "Store" },
      { name: "Mall & Pusat Belanja (商场)", icon: "Building" },
      { name: "Pakaian & Busana (服装)", icon: "Shirt" },
      { name: "Aksesoris & Jam Tangan (手表)", icon: "Watch" },
      { name: "Perhiasan (珠宝)", icon: "Gem" },
    ],
  },
  {
    name: "Hiburan & Rekreasi (娱乐)",
    kind: "expense",
    icon: "Gamepad2",
    subcategories: [
      { name: "Film & Bioskop (电影)", icon: "Film" },
      { name: "Musik & Konser (音乐)", icon: "Music" },
      { name: "Game & Voucher (游戏)", icon: "Gamepad2" },
      { name: "Sepak Bola & Olahraga (足球)", icon: "Trophy" },
      { name: "Liburan & Wisata (娱乐)", icon: "Palmtree" },
      { name: "Fotografi (摄影)", icon: "Camera" },
      { name: "Seni & Hobi (艺术)", icon: "Palette" },
    ],
  },
  {
    name: "Kebutuhan Rumah (居家)",
    kind: "expense",
    icon: "Home",
    subcategories: [
      { name: "Perabot & Rumah Tangga (居家)", icon: "Home" },
      { name: "Laundry & Cuci Baju (洗衣)", icon: "Sparkles" },
      { name: "Kebersihan & Alat Cuci (清洁)", icon: "Sparkles" },
      { name: "Perbaikan & Tukang (维修)", icon: "Wrench" },
      { name: "Listrik & Elektronik (电工)", icon: "Zap" },
      { name: "Hewan Peliharaan (宠物)", icon: "Dog" },
      { name: "Kebutuhan Bayi & Anak (母婴)", icon: "Baby" },
    ],
  },
  {
    name: "Kesehatan & Medis (健康)",
    kind: "expense",
    icon: "HeartPulse",
    subcategories: [
      { name: "Rumah Sakit & Rawat (医院)", icon: "Building2" },
      { name: "Klinik & Dokter (医疗)", icon: "Stethoscope" },
      { name: "Obat & Apotek (药店)", icon: "Pill" },
      { name: "Gym & Fitness (健身)", icon: "Dumbbell" },
      { name: "Salon & Spa (美容)", icon: "Sparkles" },
      { name: "Konseling & Mental (心理)", icon: "Brain" },
      { name: "Skincare & Perawatan (护肤)", icon: "Sparkles" },
      { name: "Potong Rambut (理发)", icon: "Scissors" },
    ],
  },
  {
    name: "Pendidikan & Karir (教育)",
    kind: "expense",
    icon: "GraduationCap",
    subcategories: [
      { name: "Sekolah & Kuliah (学校)", icon: "GraduationCap" },
      { name: "Buku & Referensi (书籍)", icon: "BookOpen" },
      { name: "Komputer & Perangkat (电脑)", icon: "Laptop" },
      { name: "Pulsa & Paket Data (通讯)", icon: "Phone" },
      { name: "Kursus Bahasa & Skill (语言)", icon: "Languages" },
      { name: "Alat Kantor & Riset (科学)", icon: "Briefcase" },
    ],
  },
  {
    name: "Tagihan & Finansial (其他支出)",
    kind: "expense",
    icon: "Receipt",
    subcategories: [
      { name: "Tagihan Listrik & Air (水电)", icon: "Zap" },
      { name: "Internet & Wifi (网络)", icon: "Wifi" },
      { name: "Donasi & Zakat (捐赠)", icon: "HeartHandshake" },
      { name: "Biaya Administrasi Bank (手续费)", icon: "CreditCard" },
      { name: "Pengeluaran Lainnya (其他)", icon: "CircleEllipsis" },
    ],
  },

  // ================= INCOME CATEGORIES =================
  {
    name: "Gaji & Penghasilan Kerja (职业收入)",
    kind: "income",
    icon: "Briefcase",
    subcategories: [
      { name: "Gaji Pokok Bulanan (工资)", icon: "Coins" },
      { name: "Bonus Kerja & THR (奖金)", icon: "Gift" },
      { name: "Insentif & Komisi (提成)", icon: "Trophy" },
      { name: "Uang Lembur (加班费)", icon: "Clock" },
      { name: "Hasil Bisnis & Dagang (商务)", icon: "Building" },
      { name: "Jasa Teknik & IT (技术)", icon: "Laptop" },
      { name: "Jasa Desain & Kreatif (设计)", icon: "Palette" },
    ],
  },
  {
    name: "Investasi & Finansial (金融理财)",
    kind: "income",
    icon: "TrendingUp",
    subcategories: [
      { name: "Keuntungan Saham & Reksa Dana (投资)", icon: "TrendingUp" },
      { name: "Bunga Tabungan & Deposito (利息)", icon: "Landmark" },
      { name: "Dividen & Bagi Hasil (分红)", icon: "Coins" },
      { name: "Sewa Kos / Properti (租金)", icon: "Home" },
      { name: "Selisih Kurs Valas (汇率)", icon: "ArrowLeftRight" },
      { name: "Cashback & Reward Kartu (信用卡)", icon: "CreditCard" },
    ],
  },
  {
    name: "Hadiah & Rezeki (红包奖金)",
    kind: "income",
    icon: "Gift",
    subcategories: [
      { name: "Angpao & Hadiah Tunai (红包)", icon: "Gift" },
      { name: "Kado & Hadiah Acara (礼金)", icon: "PartyPopper" },
      { name: "Penghargaan & Juara (奖励)", icon: "Trophy" },
      { name: "Poin Loyalitas & Voucher (积分)", icon: "Ticket" },
    ],
  },
  {
    name: "Pemasukan Lainnya (其他收入)",
    kind: "income",
    icon: "Wallet",
    subcategories: [
      { name: "Pekerjaan Sampingan / Freelance (兼职)", icon: "Laptop" },
      { name: "Pengembalian Dana / Refund (退款)", icon: "RotateCcw" },
      { name: "Klaim & Reimburse Kantor (报销)", icon: "FileText" },
      { name: "Penjualan Barang Bekas (二手)", icon: "Tag" },
      { name: "Pendapatan Lain-lain (其他)", icon: "CircleEllipsis" },
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
