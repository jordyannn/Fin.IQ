import { formatInputIDR } from "./utils";
import { DATASET_TAXONOMY } from "./taxonomy-dictionary";
import { DATASET_SLANG_AMOUNTS, normalizeSpokenIndonesian } from "./fin-iq-dataset-reference";

export interface ParsedTransactionResult {
  txType: "expense" | "income" | "transfer";
  amount: number;
  formattedAmount: string;
  accountHint: string;
  matchedAccountId?: string;
  toAccountHint?: string;
  matchedToAccountId?: string;
  categoryHint: string;
  matchedCategoryId?: string;
  happenedAt?: Date;
  happenedAtFormatted?: string;
  cleanNote: string;
  note: string; // alias for cleanNote
  rawText: string;
}

interface AccountItem {
  id: string;
  name: string;
  group?: string;
}

interface CategoryItem {
  id: string;
  name: string;
  kind?: string;
  parentId?: string | null;
}

interface ParserOptions {
  accounts?: AccountItem[];
  categories?: CategoryItem[];
  referenceDate?: Date;
}

/**
 * Ekstrak nominal uang dari teks bahasa Indonesia.
 * Menangani format: Rp 30.000, 30.000, 30000, 30rb, 30k, 2.5jt, tiga puluh ribu, dll.
 */
export function extractAmountFromText(text: string): number {
  if (!text) return 0;
  const lower = text.toLowerCase().trim();

  // 0. Pola Slang Nominal Bahasa Indonesia dari dataset (goceng, ceban, goban, cepek, seceng, gopek, dll.)
  for (const [slang, val] of Object.entries(DATASET_SLANG_AMOUNTS)) {
    const regex = new RegExp(`\\b${slang}\\b`, "i");
    if (regex.test(lower)) {
      return val;
    }
  }

  // 1. Pola dengan awalan Rp / nominal / seharga / sebesar diikuti angka bertitik/koma
  // Contoh: "Rp 30.000", "Rp. 30.000", "nominal Rp 30.000", "Rp 1.500.000"
  const rpDottedMatch = lower.match(/(?:rp|idr|nominal|sebesar|seharga)?\.?\s*(\d{1,3}(?:\.\d{3})+(?:,\d+)?)/i);
  if (rpDottedMatch) {
    const clean = rpDottedMatch[1].replace(/\./g, "").replace(",", ".");
    const val = parseFloat(clean);
    if (!isNaN(val) && val > 0) return val;
  }

  // 2. Pola juta: "2.5jt", "2,5 juta", "5 juta", "5jt"
  const jtMatch = lower.match(/(\d+(?:[\.,]\d+)?)\s*(?:jt|juta|million)\b/i);
  if (jtMatch) {
    const val = parseFloat(jtMatch[1].replace(",", ".")) * 1_000_000;
    if (!isNaN(val) && val > 0) return Math.round(val);
  }

  // 3. Pola ribu / k: "30rb", "30 ribu", "30k", "50.000 ribu"
  const rbMatch = lower.match(/(\d+(?:[\.,]\d+)?)\s*(?:rb|ribu|k)\b/i);
  if (rbMatch) {
    const rawNum = rbMatch[1].replace(/\./g, "").replace(",", ".");
    const val = parseFloat(rawNum) * 1_000;
    if (!isNaN(val) && val > 0) return Math.round(val);
  }

  // 4. Pola angka murni tanpa pemisah: "30000", "Rp 50000"
  const plainNumMatch = lower.match(/\b(?:rp|idr)?\.?\s*(\d{3,9})\b/i);
  if (plainNumMatch) {
    const val = parseInt(plainNumMatch[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // 5. Pola kata bahasa Indonesia (e.g. "tiga puluh ribu", "seratus lima puluh ribu")
  const wordMap: Record<string, number> = {
    nol: 0, kosong: 0,
    satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5,
    enam: 6, tujuh: 7, delapan: 8, sembilan: 9,
  };

  const words = lower.split(/[\s\-]+/);
  let total = 0;
  let currentGroup = 0;
  let currentUnit = 0;

  for (const w of words) {
    if (w === "seratus") {
      currentGroup += 100;
      currentUnit = 0;
    } else if (w === "seribu") {
      total += (currentGroup > 0 ? currentGroup : 1) * 1_000;
      currentGroup = 0;
      currentUnit = 0;
    } else if (w === "sejuta") {
      total += (currentGroup > 0 ? currentGroup : 1) * 1_000_000;
      currentGroup = 0;
      currentUnit = 0;
    } else if (w === "sepuluh") {
      currentGroup += 10;
      currentUnit = 0;
    } else if (w === "sebelas") {
      currentGroup += 11;
      currentUnit = 0;
    } else if (w === "belas") {
      currentGroup += 10 + (currentUnit > 0 ? currentUnit : 0);
      currentUnit = 0;
    } else if (w === "puluh") {
      currentGroup += (currentUnit > 0 ? currentUnit : 1) * 10;
      currentUnit = 0;
    } else if (w === "ratus") {
      currentGroup += (currentUnit > 0 ? currentUnit : 1) * 100;
      currentUnit = 0;
    } else if (w === "ribu") {
      const val = currentGroup + currentUnit;
      total += (val > 0 ? val : 1) * 1_000;
      currentGroup = 0;
      currentUnit = 0;
    } else if (w === "juta") {
      const val = currentGroup + currentUnit;
      total += (val > 0 ? val : 1) * 1_000_000;
      currentGroup = 0;
      currentUnit = 0;
    } else if (wordMap[w] !== undefined) {
      currentUnit = wordMap[w];
    }
  }

  total += currentGroup + currentUnit;
  return total > 0 ? total : 0;
}

/**
 * Deteksi tipe transaksi (expense, income, transfer) secara cerdas berbasis kosakata bahasa Indonesia
 */
export function detectTxType(text: string): "expense" | "income" | "transfer" {
  if (!text) return "expense";
  const lower = text.toLowerCase();

  // 1. Cek Pola Transfer
  // Kecualikan jika top up game/voucher (yang merupakan pengeluaran hiburan)
  const isTopUpGame = /(?:top\s*up|isi\s+ulang)\s+(?:diamond|dm|game|ml|mobile\s*legends|ff|free\s*fire|pubg|genshin|steam|roblox|robux)/i.test(lower);

  const transferExplicit = [
    "transfer", " tf ", "kirim uang ke", "tarik tunai", "setor tunai",
    "pindah saldo", "pindahin saldo", "pindahin uang", "pindahin dana", "pindahin duit",
    "pindah dana", "pindah uang", "pindah duit", "geser saldo", "geser dana",
    "mutasi ke", "antar rekening", "antar akun", "nabung ke", "masukin ke tabungan"
  ];

  const hasTransferVerb =
    lower.startsWith("tf ") ||
    lower.endsWith(" tf") ||
    transferExplicit.some((k) => lower.includes(k)) ||
    /(?:dari|from)\s+.*\s+(?:ke|to)\s+/i.test(lower) ||
    (/(?:pindahin|geser)\s+/i.test(lower) && /(?:ke|to)\s+/i.test(lower)) ||
    (!isTopUpGame && /(?:top\s*up|isi\s+saldo)\s+(?:ke\s+)?(?:dana|gopay|ovo|shopeepay|spay|linkaja|rekening|bank|e-?wallet)/i.test(lower));

  if (hasTransferVerb) {
    return "transfer";
  }

  // 2. Skoring Pemasukan vs Pengeluaran
  let incomeScore = 0;
  let expenseScore = 0;

  // Frasa santai & bahasa lokal kuat untuk pemasukan (Hadiah/Uang Saku/Rezeki/Keluarga)
  const casualIncomePatterns = [
    /dikasih\s+(?:duit|uang|dana|jajan|angpao|ongkos)/i,
    /diberi\s+(?:duit|uang|dana|jajan|angpao)/i,
    /dap[ae]t\s+(?:duit|uang|dana|jajan|angpao|transferan|kiriman|rezeki)/i,
    /nemu\s+(?:duit|uang)/i,
    /uang\s+(?:saku|jajan|bulanan|hadiah|kaget)\s+dari/i,
    /duit\s+(?:saku|jajan|bulanan|hadiah|kaget)\s+dari/i,
    /kiriman\s+(?:dari|ortu|orang\s*tua|ibu|ayah|mama|papa)/i,
    /transferan\s+(?:dari|ortu|orang\s*tua|ibu|ayah|mama|papa|teman|bos)/i,
    /ditransfer\s+(?:sama|oleh|dari)?\s*(?:mama|papa|ibu|ayah|ortu|orang\s*tua|bos|klien|teman)/i,
    /dikasih\s+(?:sama|oleh)?\s*(?:mama|papa|ibu|ayah|ortu|orang\s*tua|nenek|kakek|om|tante)/i,
    /salam\s+tempel/i,
    /amplop\s+dari/i,
    /cair(?:in|kan)?\s+(?:jht|bpjs|arisan|klaim|reimburse)/i
  ];

  for (const pattern of casualIncomePatterns) {
    if (pattern.test(lower)) {
      incomeScore += 16;
    }
  }

  // Eksplisit deklarasi berbobot tertinggi
  if (lower.includes("pemasukan")) incomeScore += 12;
  if (lower.includes("pengeluaran")) expenseScore += 12;
  if (lower.includes("uang masuk") || lower.includes("duit masuk") || lower.includes("dana masuk")) incomeScore += 8;
  if (lower.includes("uang keluar") || lower.includes("duit keluar") || lower.includes("dana keluar")) expenseScore += 8;

  // Kata kunci kuat Pemasukan
  const strongIncomeKeywords = [
    "gaji", "gajian", "payroll", "upah", "honor", "honorarium", "thr",
    "dividen", "deviden", "profit", "penjualan", "hasil jualan", "omset",
    "cashback", "refund", "reimburse", "reimbursement", "beasiswa", "klaim asuransi",
    "dapat bonus", "terima bonus", "dapat hadiah", "menang undian"
  ];

  // Kata kunci sedang Pemasukan
  const mediumIncomeKeywords = [
    "masuk", "terima", "diterima", "menerima", "dapat", "dapet", "cair",
    "bonus", "komisi", "insentif", "fee", "untung", "cuan", "laku",
    "uang saku", "uang jajan", "dikasih", "kiriman", "hibah", "angpao", "hadiah"
  ];

  // Kata kunci kuat Pengeluaran
  const strongExpenseKeywords = [
    "bayar", "membayar", "pembayaran", "beli", "membeli", "belanja",
    "tagihan", "cicilan", "angsuran", "sewa", "kontrak", "iuran",
    "checkout", "order", "pesan makanan", "isi bensin", "ganti oli"
  ];

  // Kata kunci sedang Pengeluaran
  const mediumExpenseKeywords = [
    "keluar", "makan", "minum", "jajan", "sarapan", "dinner", "lunch",
    "nongkrong", "ngopi", "ongkos", "tarif", "parkir", "tol", "karcis",
    "tiket", "servis", "bengkel", "obat", "sedekah", "zakat", "infaq",
    "donasi", "sumbangan", "traktir", "sawer", "denda", "tilang"
  ];

  for (const kw of strongIncomeKeywords) {
    if (lower.includes(kw)) incomeScore += 5;
  }
  for (const kw of mediumIncomeKeywords) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(lower) || lower.includes(kw)) incomeScore += 2;
  }

  for (const kw of strongExpenseKeywords) {
    if (lower.includes(kw)) expenseScore += 5;
  }
  for (const kw of mediumExpenseKeywords) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(lower) || lower.includes(kw)) expenseScore += 2;
  }

  if (incomeScore > expenseScore) {
    return "income";
  }

  return "expense";
}

/**
 * Kamus Semantik & Objek Objek Transaksi Lengkap Bahasa Indonesia
 * Mencakup seluruh kategori dan subkategori standar BeeCount-Cloud / Fin.IQ
 */
const DETAILED_CATEGORY_KEYWORDS: Record<string, string[]> = {
  // Makanan & Minuman
  "Kopi & Minuman": ["kopi", "coffee", "espresso", "latte", "starbucks", "janji jiwa", "kopi kenangan", "kulo", "tomoro", "fore", "boba", "chatime", "teh", "es teh", "jus", "jus buah", "alpukat", "minuman"],
  "Makanan Cepat Saji": ["mcd", "mcdonalds", "kfc", "burger king", "richeese", "hokben", "hoka hoka bento", "a&w", "fast food"],
  "Restoran": ["restoran", "resto", "cafe", "rumah makan", "warung makan", "rm padang", "ayce", "all you can eat", "steak", "sushi", "ramen", "dimsum", "shabu", "kuliner"],
  "Makan Harian": ["makan", "sarapan", "makan siang", "makan malam", "warteg", "nasi uduk", "nasi kuning", "soto", "bakso", "mie ayam", "sate", "martabak", "pecel lele", "pecel", "ayam geprek", "nasgor", "nasi goreng", "bubur", "ayam", "mie", "ikan", "nasi"],
  "Kue & Bakery": ["roti", "kue", "bakery", "cake", "donat", "jco", "holland bakery", "roti o", "roti boy", "pastry", "brownies"],
  "Pizza & Western": ["pizza", "domino", "pizza hut", "pasta", "spaghetti", "burger"],
  "Es Krim & Dessert": ["es krim", "ice cream", "gelato", "mixue", "dessert", "puding", "waffle"],
  "Bar & Minuman": ["bar", "bir", "beer", "wine", "cocktail", "minuman keras", "clubbing", "lounge"],

  // Transportasi
  "Bahan Bakar & SPBU": ["bensin", "pertamax", "pertalite", "solar", "dexlite", "shell", "spbu", "pom bensin", "bbm", "isi bensin", "pom"],
  "Parkir & Tol": ["parkir", "karcis parkir", "juru parkir", "ongkos parkir", "tol", "e-toll", "tarif tol", "gerbang tol", "flazz"],
  "Taksi & Ojek Online": ["ojol", "gojek", "goride", "gocar", "grab", "grabbike", "grabcar", "maxim", "indrive", "taksi", "taxi", "bluebird", "ojek"],
  "Kereta & MRT / KRL": ["krl", "commuter line", "mrt", "lrt", "whoosh", "kereta cepat", "stasiun", "commuterline"],
  "Kereta Api Jarak Jauh": ["kereta api", "kai", "tiket kereta"],
  "Tiket Pesawat": ["pesawat", "tiket pesawat", "garuda", "lion air", "citilink", "airasia", "batik air", "flight"],
  "Bus & Angkot": ["bus", "bis", "angkot", "transjakarta", "busway", "damri", "travel"],
  "Mobil Pribadi": ["servis mobil", "oli mobil", "ganti oli", "bengkel mobil", "cuci mobil", "ban mobil", "aki mobil", "mobil"],
  "Sepeda": ["sepeda", "gowes", "servis sepeda"],

  // Belanja & Belanjaan
  "Supermarket & Minimarket": ["indomaret", "alfamart", "alfamidi", "superindo", "hypermart", "transmart", "supermarket", "minimarket", "pasar", "belanja bulanan"],
  "Belanja Online": ["shopee", "tokopedia", "tokped", "lazada", "blibli", "tiktok shop", "zalora", "amazon", "belanja online", "olshop"],
  "Pakaian & Busana": ["baju", "celana", "kaos", "t-shirt", "kemeja", "jaket", "sepatu", "sandal", "sneakers", "hoodie", "dress", "rok", "gamis", "hijab", "pakaian", "outfit", "sweater"],
  "Toko Kelontong": ["warung kelontong", "toko kelontong", "warung madura", "sembako", "beras", "telur", "minyak goreng", "gula", "garam"],
  "Mall & Pusat Belanja": ["mall", "plaza", "grand indonesia", "senayan city", "central park", "pvj"],
  "Aksesoris & Jam Tangan": ["jam tangan", "kacamata", "tas", "dompet", "ransel", "sabuk", "ikat pinggang", "topi"],
  "Perhiasan": ["emas", "perhiasan", "cincin", "kalung", "anting", "gelang", "berlian", "logam mulia"],

  // Kebutuhan Rumah
  "Laundry & Cuci Baju": ["laundry", "cuci baju", "cuci pakaian", "setrika", "dry clean", "laundromat"],
  "Kebersihan & Alat Cuci": ["sabun", "shampoo", "sampo", "odol", "pasta gigi", "deterjen", "pewangi", "soklin", "wipol", "rinso", "sikat gigi", "baygon", "alat cuci"],
  "Perabot & Rumah Tangga": ["perabotan", "furnitur", "kasur", "bantal", "sprei", "lemari", "meja", "kursi", "ikea", "informa", "perabot"],
  "Perbaikan & Tukang": ["tukang", "cat tembok", "pipa bocor", "genteng bocor", "renovasi", "servis rumah", "bor", "kunci", "perkakas"],
  "Listrik & Elektronik": ["elektronik", "kulkas", "mesin cuci", "kipas angin", "tv", "televisi", "blender", "ac", "service ac", "cuci ac"],
  "Hewan Peliharaan": ["kucing", "anjing", "pet shop", "petshop", "makanan kucing", "whiskas", "royal canin", "dokter hewan", "vet", "pasir kucing"],
  "Kebutuhan Bayi & Anak": ["popok", "pampers", "susu formula", "susu bayi", "botol susu", "dot", "baju bayi", "baby shop"],

  // Kesehatan & Medis
  "Obat & Apotek": ["obat", "apotek", "apotik", "kimia farma", "k24", "panadol", "paracetamol", "tolak angin", "bodrex", "promag", "betadine", "vitamin", "suplemen", "antangin"],
  "Klinik & Dokter": ["dokter", "periksa dokter", "klinik", "puskesmas", "bidan", "usg", "dokter gigi", "cabut gigi", "tambal gigi", "scaling"],
  "Rumah Sakit & Rawat": ["rumah sakit", "rs", "igd", "rawat inap", "rawat jalan", "kamar rawat", "operasi"],
  "Gym & Fitness": ["gym", "fitness", "fitnes", "f45", "celebrity fitness", "gold gym", "membership gym", "tempat gym", "senam", "yoga"],
  "Salon & Spa": ["salon", "spa", "creambath", "massage", "pijat", "refleksi", "lulur", "meni pedi", "kutek"],
  "Skincare & Perawatan": ["skincare", "serum", "toner", "facial wash", "sunscreen", "glowing", "ms glow", "somethinc", "pelembab", "moisturizer", "klinik kecantikan"],
  "Potong Rambut": ["potong rambut", "barbershop", "barber", "pangkas rambut", "cukur"],
  "Konseling & Mental": ["psikolog", "psikiater", "konseling", "terapi mental", "konsultasi jiwa"],

  // Tagihan & Finansial
  "Tagihan Listrik & Air": ["pln", "token listrik", "tagihan listrik", "pdam", "air pdam", "tagihan air", "bayar listrik", "bayar air"],
  "Internet & Wifi": ["indihome", "biznet", "first media", "wifi", "tagihan wifi", "myrepublic", "iconnet", "bayar internet"],
  "Pulsa & Paket Data": ["pulsa", "beli pulsa", "isi pulsa", "paket data", "paket internet", "kuota internet", "kuota", "telkomsel", "indosat", "im3", "xl", "axis", "tri", "smartfren", "byu"],
  "Biaya Administrasi Bank": ["biaya admin", "admin bank", "biaya transfer", "transfer fee", "denda kartu kredit", "materai"],
  "Donasi & Zakat": ["zakat", "zakat fitrah", "infaq", "infak", "sedekah", "donasi", "sumbangan", "kotak amal", "kitabisa", "panti asuhan", "sedekah subuh"],

  // Hiburan & Rekreasi
  "Film & Bioskop": ["bioskop", "xxi", "cgv", "cinepolis", "nonton film", "tiket bioskop", "netflix", "disney+", "film"],
  "Musik & Konser": ["spotify", "tiket konser", "konser musik", "konser", "apple music", "joox"],
  "Game & Voucher": ["game", "top up game", "topup game", "voucher game", "diamond", "mobile legends", "free fire", "pubg", "genshin", "steam", "ps5", "playstation", "nintendo", "robux"],
  "Sepak Bola & Olahraga": ["futsal", "sewa lapangan", "badminton", "bulutangkis", "tenis", "tenis meja", "golf", "renang", "gor", "jersey"],
  "Liburan & Wisata": ["liburan", "holiday", "hotel", "villa", "staycation", "tiket wisata", "pantai", "gunung", "traveling", "ancol", "dufan", "tiket masuk"],
  "Fotografi": ["foto studio", "fotografer", "cetak foto", "kamera", "lensa kamera"],
  "Seni & Hobi": ["lukisan", "cat air", "kanvas", "hobi", "figurine", "gundam", "tamiya", "lego"],

  // Pendidikan & Karir
  "Sekolah & Kuliah": ["spp", "uang sekolah", "ukt", "uang semester", "uang kuliah", "pendaftaran sekolah", "wisuda", "skripsi"],
  "Buku & Referensi": ["buku", "gramedia", "buku pelajaran", "novel", "komik", "alat tulis", "modul", "jurnal"],
  "Komputer & Perangkat": ["laptop", "mouse", "keyboard", "monitor", "printer", "harddisk", "ssd", "flashdisk", "aksesoris laptop", "gadget"],
  "Kursus Bahasa & Skill": ["kursus", "les privat", "bimbel", "bootcamp", "udemy", "toefl", "ielts", "duolingo", "pelatihan"],

  // Income:
  "Gaji Pokok Bulanan": ["gaji", "gajian", "payroll", "gaji bulanan", "gaji pokok", "slip gaji", "upah"],
  "Bonus Kerja & THR": ["bonus", "thr", "bonus thr", "bonus kinerja", "insentif akhir tahun", "bonus tahunan"],
  "Insentif & Komisi": ["komisi", "komisi penjualan", "insentif", "fee marketing"],
  "Uang Lembur": ["uang lembur", "lembur", "lemburan", "overtime"],
  "Hasil Bisnis & Dagang": ["omset", "penjualan", "hasil jualan", "toko laku", "hasil dagang", "revenue", "profit bisnis"],
  "Jasa Teknik & IT": ["freelance coding", "jasa website", "servis laptop", "jasa it", "pembuatan aplikasi"],
  "Jasa Desain & Kreatif": ["jasa desain", "desain grafis", "logo", "video editing", "foto wisuda", "konten kreator"],
  "Keuntungan Saham & Reksa Dana": ["cuan saham", "profit crypto", "reksa dana", "capital gain", "bibit", "ajaib"],
  "Bunga Tabungan & Deposito": ["bunga bank", "bunga deposito", "bagi hasil bank"],
  "Dividen & Bagi Hasil": ["dividen", "bagi hasil", "bagi keuntungan", "profit sharing"],
  "Sewa Kos / Properti": ["sewa kos", "uang kos", "uang kontrakan", "rental properti", "sewa rumah"],
  "Cashback & Reward Kartu": ["cashback", "reward poin", "promo cashback", "kupon belanja"],
  "Angpao & Hadiah Tunai": ["angpao", "angpau", "amplop kondangan", "hadiah uang", "kado uang", "uang kado"],
  "Hadiah & Rezeki": ["rezeki", "menang undian", "doorprize", "hadiah lomba", "juara lomba"],
  "Pekerjaan Sampingan / Freelance": ["freelance", "proyek sampingan", "side job", "kerja sampingan", "fee proyek", "uang jajan"],
  "Pengembalian Dana / Refund": ["refund", "pengembalian dana", "reimburse", "klaim kantor"],
  "Penjualan Barang Bekas": ["jual barang bekas", "jual second", "preloved", "jual hp bekas", "jual laptop bekas", "olx", "carousell", "barang bekas"],
};

/**
 * Deteksi dan cocokkan kategori menggunakan seluruh objek yang dibicarakan
 * Menyesuaikan dengan seluruh database kategori yang tersedia (parent & subkategori)
 */
export function detectCategory(
  text: string,
  txType: "expense" | "income" | "transfer",
  userCategories?: CategoryItem[]
): { categoryHint: string; matchedCategoryId?: string } {
  const lower = text.toLowerCase().trim();

  // Jika transfer, tidak butuh kategori
  if (txType === "transfer") {
    return { categoryHint: "Transfer" };
  }

  // Jika userCategories tidak tersedia
  if (!userCategories || userCategories.length === 0) {
    return { categoryHint: txType === "income" ? "Hadiah & Rezeki" : "Makanan & Minuman" };
  }

  // Filter kategori sesuai jenis transaksi (expense/income) dan bersihkan teks mandarin jika ada
  const targetCats = userCategories
    .filter((c) => !c.kind || c.kind === txType)
    .map((c) => ({
      ...c,
      cleanName: c.name
        .replace(/\s*[\(（][\u4e00-\u9fa5\s]+[\)）]/g, "")
        .replace(/[\u4e00-\u9fa5]+/g, "")
        .trim(),
    }));

  if (targetCats.length === 0) {
    const firstClean = userCategories[0].name
      .replace(/\s*[\(（][\u4e00-\u9fa5\s]+[\)）]/g, "")
      .replace(/[\u4e00-\u9fa5]+/g, "")
      .trim();
    return { categoryHint: firstClean, matchedCategoryId: userCategories[0].id };
  }

  // 1. Scoring semantik komprehensif menggunakan DATASET_TAXONOMY (79 subkategori & 12 induk)
  const GENERIC_WORDS = new Set(["uang", "duit", "dana", "saldo", "biaya", "tarif", "kantor", "rumah", "bulan", "hari", "tahun", "toko", "belanja"]);
  let bestDatasetEntry: (typeof DATASET_TAXONOMY)[0] | null = null;
  let maxDatasetScore = 0;

  for (const entry of DATASET_TAXONOMY) {
    if (entry.kind !== txType) continue;
    let score = 0;

    // Subcategory keywords
    const subWords = entry.sub.toLowerCase().split(/[\s&/,\-]+/).filter((w) => w.length >= 3);
    for (const w of subWords) {
      if (!GENERIC_WORDS.has(w) && lower.includes(w)) {
        score += 80 + w.length * 4;
      }
    }

    // Items match (spesifik dan bobot lebih besar untuk frasa lengkap)
    for (const item of entry.items) {
      const itemLower = item.toLowerCase();
      if (itemLower.length >= 3 && lower.includes(itemLower)) {
        const phraseWeight = itemLower.includes(" ") ? 150 : 70;
        score += phraseWeight + itemLower.length * 5;
      }
    }

    // Merchants / Actor match (e.g. Mama, Ibu, Ayah, Indomaret, dsb.)
    for (const merch of entry.merchants) {
      const merchLower = merch.toLowerCase();
      if (merchLower.length >= 2 && !GENERIC_WORDS.has(merchLower)) {
        const regex = new RegExp(`\\b${merchLower}\\b`, "i");
        if (regex.test(lower)) {
          score += 80 + merchLower.length * 3;
        }
      }
    }

    // Verbs match
    for (const verb of entry.verbs) {
      if (verb.length >= 3 && lower.includes(verb.toLowerCase())) {
        score += 30;
      }
    }

    if (score > maxDatasetScore) {
      maxDatasetScore = score;
      bestDatasetEntry = entry;
    }
  }

  // 2. Jika ada pemenang dari DATASET_TAXONOMY, cocokkan dengan kategori di database user
  if (bestDatasetEntry && maxDatasetScore > 0) {
    const targetSubLower = bestDatasetEntry.sub.toLowerCase();
    const targetParentLower = bestDatasetEntry.parent.toLowerCase();

    // Prioritas 1: Cocok persis dengan Subkategori dataset
    const exactSubCat = targetCats.find(
      (c) => c.cleanName.toLowerCase() === targetSubLower
    );
    if (exactSubCat) {
      return { categoryHint: exactSubCat.name, matchedCategoryId: exactSubCat.id };
    }

    // Prioritas 2: Cocok persis dengan Parent kategori dataset
    const exactParentCat = targetCats.find(
      (c) => c.cleanName.toLowerCase() === targetParentLower
    );
    if (exactParentCat) {
      return { categoryHint: exactParentCat.name, matchedCategoryId: exactParentCat.id };
    }

    // Prioritas 3: Kesamaan token / substring
    let bestMatchedUserCat: (typeof targetCats)[0] | null = null;
    let maxMatchSimilarity = 0;

    for (const cat of targetCats) {
      const catLower = cat.cleanName.toLowerCase();
      let sim = 0;
      if (catLower.includes(targetSubLower) || targetSubLower.includes(catLower)) {
        sim += 120;
      }
      if (catLower.includes(targetParentLower) || targetParentLower.includes(catLower)) {
        sim += 80;
      }
      const catTokens = catLower.split(/[\s&/,\-]+/).filter((t) => t.length >= 3 && !GENERIC_WORDS.has(t));
      for (const t of catTokens) {
        if (targetSubLower.includes(t) || targetParentLower.includes(t)) {
          sim += 30 + t.length * 2;
        }
      }

      if (sim > maxMatchSimilarity) {
        maxMatchSimilarity = sim;
        bestMatchedUserCat = cat;
      }
    }

    if (bestMatchedUserCat && maxMatchSimilarity > 0) {
      return { categoryHint: bestMatchedUserCat.name, matchedCategoryId: bestMatchedUserCat.id };
    }
  }

  // 3. Fallback scoring langsung ke kategori user jika dataset tidak match
  let bestDirectCat: (typeof targetCats)[0] | null = null;
  let maxDirectScore = 0;

  for (const cat of targetCats) {
    let score = 0;
    const catLower = cat.cleanName.toLowerCase();

    if (lower.includes(catLower)) {
      score += 60 + catLower.length * 2;
    }

    const tokens = catLower.split(/[\s&/,\-]+/).filter((t) => t.length >= 3 && !GENERIC_WORDS.has(t));
    for (const t of tokens) {
      if (lower.includes(t)) {
        score += 25 + t.length;
      }
    }

    if (cat.parentId && score > 0) {
      score += 10;
    }

    if (score > maxDirectScore) {
      maxDirectScore = score;
      bestDirectCat = cat;
    }
  }

  if (bestDirectCat && maxDirectScore > 0) {
    return { categoryHint: bestDirectCat.name, matchedCategoryId: bestDirectCat.id };
  }

  // 4. Default Fallback teraman
  const fallback =
    targetCats.find((c) =>
      txType === "income"
        ? c.cleanName.toLowerCase().includes("hadiah") ||
          c.cleanName.toLowerCase().includes("rezeki") ||
          c.cleanName.toLowerCase().includes("gaji") ||
          c.cleanName.toLowerCase().includes("lain")
        : c.cleanName.toLowerCase().includes("makan") ||
          c.cleanName.toLowerCase().includes("lain")
    ) || targetCats[0];

  return { categoryHint: fallback.name, matchedCategoryId: fallback.id };
}

/**
 * Sinonim dan kata kunci keluarga akun finansial di Indonesia
 */
const ACCOUNT_FAMILY_KEYWORDS: Record<string, string[]> = {
  rekening: [
    "rekening",
    "rek",
    "rekening bank",
    "tabungan",
    "atm",
    "bank",
    "rekening utama",
    "rekening tabungan",
    "rekening gaji",
    "rekening bca",
    "rekening blu",
  ],
  cash: [
    "cash",
    "kas",
    "tunai",
    "uang tunai",
    "kas tunai",
    "duit tunai",
    "uang cash",
    "bayar cash",
    "secara cash",
    "dompet",
  ],
  blu: ["blu", "blue", "bca digital", "blubca", "akun blue", "akun blu"],
  bca: ["bca", "bank bca", "klikbca", "tahapan bca"],
  mandiri: ["mandiri", "livin", "bank mandiri"],
  bri: ["bri", "brimo", "bank bri"],
  bni: ["bni", "bni mobile", "bank bni"],
  jago: ["jago", "bank jago"],
  dana: ["dana", "dompet dana"],
  gopay: ["gopay", "gojek", "go pay"],
  ovo: ["ovo"],
  shopeepay: ["shopeepay", "shopee", "spay", "shopee pay"],
  seabank: ["seabank", "sea bank"],
};

/**
 * Hitung skor kecocokan antara teks ucapan dengan sebuah akun
 */
function matchAccountScore(text: string, acc: AccountItem): number {
  const lower = text.toLowerCase().trim();
  const accName = acc.name.toLowerCase().trim();
  const accGroup = (acc.group || "").toLowerCase().trim();
  let score = 0;

  // 1. Direct exact / token name match
  const escapedName = accName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameRegex = new RegExp(`\\b${escapedName}\\b`, "i");
  if (nameRegex.test(lower)) {
    score += 150 + accName.length * 5;
    if (lower === accName) score += 200;
  } else if (lower.includes(accName)) {
    score += 80 + accName.length * 3;
  }

  // 2. Deteksi kata 'rekening', 'rek', 'tabungan', 'atm', 'bank'
  const hasRekening = /\b(rekening|rek|tabungan|atm|bank)\b/i.test(lower);
  if (hasRekening) {
    if (accName.includes("rekening") || accName.includes("rek") || accName.includes("tabungan") || accName.includes("bank")) {
      score += 260;
    } else if (
      accGroup.includes("bank") ||
      accGroup.includes("card") ||
      ["blu", "bca", "mandiri", "bri", "bni", "jago", "seabank", "cimb", "permata", "btn", "danamon", "bsi", "jenius"].includes(accName)
    ) {
      score += 190;
    }
  }

  // 3. Penanganan cerdas khusus cash vs kas tunai vs dompet
  const hasCash = /\bcash(?!back)\b/i.test(lower);
  const hasKasTunai = /\bkas\s*tunai\b/i.test(lower);
  const hasTunai = /\btunai\b/i.test(lower);
  const hasKas = /\bkas\b/i.test(lower);
  const hasDompet = /\bdompet\b/i.test(lower);

  if (hasCash) {
    if (accName === "cash") score += 200;
    else if (accName.includes("cash")) score += 140;
    else if (accName === "kas tunai" || accName === "kas") score += 60;
    else if (accGroup === "cash") score += 40;
  }

  if (hasKasTunai) {
    if (accName === "kas tunai") score += 200;
    else if (accName === "cash") score += 60;
    else if (accGroup === "cash") score += 40;
  } else if (hasTunai) {
    if (accName.includes("tunai")) score += 180;
    else if (accName === "cash") score += 70;
    else if (accGroup === "cash") score += 50;
  } else if (hasKas && !hasKasTunai) {
    if (accName === "kas") score += 180;
    else if (accName === "kas tunai") score += 120;
    else if (accName === "cash") score += 70;
  }

  if (hasDompet) {
    if (accName === "cash" || accName.includes("tunai") || accName.includes("dompet")) {
      score += 150;
    }
  }

  // 4. Pencocokan keluarga akun lainnya (blu, dana, gopay, dll.)
  for (const [familyKey, keywords] of Object.entries(ACCOUNT_FAMILY_KEYWORDS)) {
    if (familyKey === "cash" || familyKey === "rekening") continue;
    const isMember =
      accName.includes(familyKey) ||
      keywords.some((kw) => accName.includes(kw));

    if (isMember) {
      for (const kw of keywords) {
        const escapedKw = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const kwRegex = new RegExp(`\\b${escapedKw}\\b`, "i");
        if (kwRegex.test(lower)) {
          score += 100 + kw.length * 3;
          if (accName === kw) score += 100;
        }
      }
    }
  }

  return score;
}

/**
 * Deteksi dan cocokkan akun dari suara (mendukung pengeluaran, pemasukan, dan transfer antar akun)
 */
export function detectAccount(
  text: string,
  userAccounts?: AccountItem[]
): {
  accountHint: string;
  matchedAccountId?: string;
  toAccountHint?: string;
  matchedToAccountId?: string;
} {
  const lower = text.toLowerCase().trim();
  const isTransferTx = detectTxType(text) === "transfer";

  let fromHint = "";
  let toHint = "";

  // Helper untuk membersihkan hint akun dari angka nominal dan stopwords waktu
  const cleanAccountHint = (s: string) =>
    s
      .replace(/\b(?:\d+|rb|ribu|k|jt|juta|rp|idr|sebesar|sejumlah|nominal|pake|pakai|lewat|melalui|dari|ke|akun)\b/gi, "")
      .replace(/\b(?:pada|saat\s+ini|sekarang|hari\s+ini|kemarin|tadi|jam|pukul)\b/gi, "")
      .replace(/[\s,.\-—:]+/g, " ")
      .trim();

  // 1. Ekstraksi Pola Transfer
  // A. Top up [B] dari/pake/lewat [A]: to = B, from = A
  const topUpFromMatch = lower.match(/(?:top\s*up|isi\s+saldo)\s+([a-z0-9\s]+?)\s+(?:dari|pake|pakai|lewat|melalui)\s+([a-z0-9\s]+)/i);
  if (topUpFromMatch) {
    toHint = cleanAccountHint(topUpFromMatch[1]);
    fromHint = cleanAccountHint(topUpFromMatch[2]);
  }

  // B. Tarik tunai: dari [A] -> to = cash
  const tarikMatch = lower.match(/(?:tarik\s+tunai|tarik\s+di\s+atm|ambil\s+tunai)\s*(?:[\d\.,\w\s]+?)?\s*(?:dari|lewat|pake|pakai|di)\s+([a-z0-9\s]+)/i);
  if (!fromHint && tarikMatch) {
    fromHint = cleanAccountHint(tarikMatch[1]);
    toHint = "cash";
  }

  // C. Setor tunai: from = cash -> ke [B]
  const setorMatch = lower.match(/(?:setor\s+tunai|nabung|masuk(?:in)?\s+ke\s+tabungan)\s*(?:[\d\.,\w\s]+?)?\s*(?:ke|di)\s+([a-z0-9\s]+)/i);
  if (!fromHint && setorMatch) {
    fromHint = "cash";
    toHint = cleanAccountHint(setorMatch[1]);
  }

  // D. Pola "dari [A] ke [B]"
  const dariKeMatch = lower.match(/(?:dari|from)\s+([a-z0-9\s]+?)\s+(?:ke|to)\s+([a-z0-9\s]+)/i);
  if (!fromHint && dariKeMatch) {
    fromHint = cleanAccountHint(dariKeMatch[1]);
    toHint = cleanAccountHint(dariKeMatch[2]);
  }

  // E. Pola "ke [B] dari [A]"
  const keDariMatch = lower.match(/(?:ke|to)\s+([a-z0-9\s]+?)\s+(?:dari|from)\s+([a-z0-9\s]+)/i);
  if (!fromHint && keDariMatch) {
    toHint = cleanAccountHint(keDariMatch[1]);
    fromHint = cleanAccountHint(keDariMatch[2]);
  }

  // F. Pola "transfer [A] ke [B]"
  const transferABMatch = lower.match(/(?:transfer|pindahin|geser\s+saldo|mutasi)\s*(?:[\d\.,\w\s]+?)?\s*([a-z0-9\s]+?)\s+(?:ke|to)\s+([a-z0-9\s]+)/i);
  if (!fromHint && transferABMatch) {
    const rawA = cleanAccountHint(transferABMatch[1]);
    const rawB = cleanAccountHint(transferABMatch[2]);
    if (rawA && rawB) {
      fromHint = rawA;
      toHint = rawB;
    }
  }

  // G. Pola single "transfer ke [B]" atau "top up [B]"
  const transferKeMatch = lower.match(/(?:transfer|top\s*up|pindah(?:in)?|kirim|masukin)\s*(?:[\d\.,\w\s]+?)?\s*(?:ke|to)\s+([a-z0-9\s]+)/i);
  if (!fromHint && !toHint && transferKeMatch) {
    toHint = cleanAccountHint(transferKeMatch[1]);
  }

  // H. Pola single "transfer dari [A]"
  const transferDariMatch = lower.match(/(?:transfer|pindah(?:in)?|tarik)\s*(?:[\d\.,\w\s]+?)?\s*(?:dari|from)\s+([a-z0-9\s]+)/i);
  if (!fromHint && !toHint && transferDariMatch) {
    fromHint = cleanAccountHint(transferDariMatch[1]);
  }

  // I. Pola single "pake [A]" / "ke [A]" umum
  if (!fromHint && !toHint) {
    const singleAccountMatch = lower.match(/(?:pake|pakai|lewat|melalui|dengan|dari|akun)\s+([a-z0-9\s]+)/i);
    if (singleAccountMatch) {
      fromHint = cleanAccountHint(singleAccountMatch[1]);
    } else {
      fromHint = lower;
    }
  }

  if (!userAccounts || userAccounts.length === 0) {
    return {
      accountHint: fromHint || "cash",
      toAccountHint: toHint || undefined,
    };
  }

  // 2. Pencocokan akun asal (source account)
  let bestAcc: AccountItem | null = null;
  let maxScore = -1;

  for (const acc of userAccounts) {
    const sc = matchAccountScore(fromHint || lower, acc);
    if (sc > maxScore) {
      maxScore = sc;
      bestAcc = acc;
    }
  }

  // Fallback akun asal jika tidak ada skor positif
  if (!bestAcc || maxScore <= 0) {
    bestAcc =
      userAccounts.find((a) => a.name.toLowerCase() === "cash") ||
      userAccounts.find((a) => a.name.toLowerCase().includes("kas")) ||
      userAccounts[0];
  }

  // 3. Pencocokan akun tujuan (toAccount) untuk transaksi transfer
  let matchedToAccountId: string | undefined;
  let finalToAccountHint = toHint;

  if (isTransferTx) {
    let bestToAcc: AccountItem | null = null;
    let maxToScore = -1;

    if (toHint) {
      for (const acc of userAccounts) {
        if (bestAcc && acc.id === bestAcc.id) continue;
        const sc = matchAccountScore(toHint, acc);
        if (sc > maxToScore) {
          maxToScore = sc;
          bestToAcc = acc;
        }
      }
    }

    // Jika tidak ada akun tujuan spesifik atau skor 0, pilih akun kedua user yang berbeda dari akun asal
    if (!bestToAcc) {
      bestToAcc = userAccounts.find((a) => a.id !== bestAcc!.id) || null;
    }

    if (bestToAcc) {
      matchedToAccountId = bestToAcc.id;
      finalToAccountHint = bestToAcc.name;
    }
  }

  return {
    accountHint: bestAcc.name,
    matchedAccountId: bestAcc.id,
    toAccountHint: finalToAccountHint || undefined,
    matchedToAccountId,
  };
}

const MONTH_NAMES: Record<string, number> = {
  januari: 0, jan: 0,
  februari: 1, feb: 1,
  maret: 2, mar: 2,
  april: 3, apr: 3,
  mei: 4,
  juni: 5, jun: 5,
  juli: 6, jul: 6,
  agustus: 7, ags: 7, agu: 7,
  september: 8, sep: 8, sept: 8,
  oktober: 9, okt: 9,
  november: 10, nov: 10,
  desember: 11, des: 11,
};

const DAY_NAMES: Record<string, number> = {
  minggu: 0,
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  sabtu: 6,
};

const INDONESIAN_NUMBER_WORDS: Record<string, number> = {
  nol: 0, kosong: 0,
  satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5,
  enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10,
  sebelas: 11, "dua belas": 12, "tiga belas": 13, "empat belas": 14,
  "lima belas": 15, "enam belas": 16, "tujuh belas": 17, "delapan belas": 18,
  "sembilan belas": 19, "dua puluh": 20, "dua satu": 21, "dua dua": 22,
  "dua tiga": 23, "dua empat": 24, "dua lima": 25, "dua puluh lima": 25,
  "tiga puluh": 30, "tiga puluh lima": 35, "empat puluh": 40,
  "empat puluh lima": 45, "lima puluh": 50, "lima puluh lima": 55,
};

const INDONESIAN_DAY_WORDS: Record<string, number> = {
  satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5,
  enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10,
  sebelas: 11, "dua belas": 12, "tiga belas": 13, "empat belas": 14,
  "lima belas": 15, "enam belas": 16, "tujuh belas": 17, "delapan belas": 18,
  "sembilan belas": 19, "dua puluh": 20, "dua puluh satu": 21,
  "dua puluh dua": 22, "dua puluh tiga": 23, "dua puluh empat": 24,
  "dua puluh lima": 25, "dua puluh enam": 26, "dua puluh tujuh": 27,
  "dua puluh delapan": 28, "dua puluh sembilan": 29, "tiga puluh": 30,
  "tiga puluh satu": 31,
};

export function parseDayNumber(str: string): number | null {
  if (!str) return null;
  const clean = str.trim().toLowerCase().replace(/\s+/g, " ");
  const asInt = parseInt(clean, 10);
  if (!isNaN(asInt) && asInt >= 1 && asInt <= 31) return asInt;
  if (INDONESIAN_DAY_WORDS[clean]) return INDONESIAN_DAY_WORDS[clean];
  return null;
}

export function parseRelativeQuantity(str: string): number {
  if (!str) return 1;
  const clean = str.trim().toLowerCase();
  if (clean === "se" || clean === "satu") return 1;
  if (clean === "dua") return 2;
  if (clean === "tiga") return 3;
  if (clean === "empat") return 4;
  if (clean === "lima") return 5;
  if (clean === "enam") return 6;
  if (clean === "tujuh") return 7;
  if (clean === "delapan") return 8;
  if (clean === "sembilan") return 9;
  if (clean === "sepuluh") return 10;
  const val = parseInt(clean, 10);
  return isNaN(val) ? 1 : val;
}

export function parseIndonesianNumber(str: string): number | null {
  if (!str) return null;
  const clean = str.trim().toLowerCase().replace(/\s+/g, " ");

  const asInt = parseInt(clean, 10);
  if (!isNaN(asInt) && asInt >= 0 && asInt <= 59) {
    return asInt;
  }

  if (clean === "seperempat") return 15;
  if (clean === "setengah") return 30;

  if (INDONESIAN_NUMBER_WORDS[clean] !== undefined) {
    return INDONESIAN_NUMBER_WORDS[clean];
  }

  // Pola puluhan majemuk: "dua puluh lima", "tiga puluh dua", dsb.
  const tensMatch = clean.match(
    /^(dua|tiga|empat|lima)\s+puluh(?:\s+(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan))?$/
  );
  if (tensMatch) {
    const tensMap: Record<string, number> = { dua: 20, tiga: 30, empat: 40, lima: 50 };
    const tens = tensMap[tensMatch[1]] || 0;
    const unit = tensMatch[2] ? INDONESIAN_NUMBER_WORDS[tensMatch[2]] || 0 : 0;
    return tens + unit;
  }

  // Pola belasan: "dua belas", "tiga belas", dsb.
  const belasMatch = clean.match(
    /^(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s+belas$/
  );
  if (belasMatch) {
    if (belasMatch[1] === "satu") return 11;
    const unit = INDONESIAN_NUMBER_WORDS[belasMatch[1]] || 0;
    return 10 + unit;
  }

  return null;
}

export function parseIndonesianHourNumber(str: string): number | null {
  const num = parseIndonesianNumber(str);
  if (num !== null && num >= 0 && num <= 24) {
    return num;
  }
  return null;
}

function applyModifierToHour(rawH: number, modifier?: string): number {
  let h = rawH;
  if (h === 24) return 0;
  if (h > 12) return h; // Sudah format 24 jam (13..23)

  const mod = modifier?.trim().toLowerCase();

  if (mod === "pagi" || mod === "subuh" || mod?.includes("dini hari")) {
    if (h === 12) h = 0; // "jam 12 subuh" = 00:00
  } else if (mod === "siang") {
    if (h >= 1 && h <= 5) h += 12; // "jam 1 s.d 5 siang" -> 13..17
    else if (h === 12) h = 12; // "jam 12 siang" -> 12:00
  } else if (mod === "sore" || mod === "petang") {
    if (h >= 1 && h <= 6) h += 12; // "jam 1 s.d 6 sore" -> 13..18
    else if (h === 12) h = 12;
  } else if (mod === "malam") {
    if (h === 12) h = 0; // "jam 12 malam" -> 00:00
    else if (h >= 6 && h <= 11) h += 12; // "jam 6 s.d 11 malam" -> 18..23
    else if (h >= 1 && h <= 5) h = h; // "jam 1 s.d 5 malam" -> 01:00..05:00 (dini hari/subuh)
  } else if (!mod) {
    // Tanpa modifier pada transaksi finansial harian:
    // Jam 1 s.d 5 hampir selalu jam siang/sore (13:00 - 17:00)
    if (h >= 1 && h <= 5) {
      h += 12;
    }
  }

  return h;
}

/**
 * Parsing Jam Natural Language Bahasa Indonesia
 * Menangani: "jam 2 siang", "jam dua siang", "pukul 14.30", "15:45", "jam setengah 3",
 * "jam 2 lewat 15", "jam 8 malam", "jam 7 pagi", "jam 12 malam", dll.
 */
export function parseClockFromIndonesian(text: string): { hour: number; minute: number; hasMatch: boolean } {
  if (!text) return { hour: 0, minute: 0, hasMatch: false };
  const lower = text.toLowerCase();

  // Deteksi konteks waktu di dalam kalimat untuk modifier fallback
  let sentenceContextMod: string | undefined = undefined;
  if (lower.includes("tadi pagi") || lower.includes("pagi tadi") || lower.includes("pagi ini") || lower.includes("kemarin pagi")) {
    sentenceContextMod = "pagi";
  } else if (lower.includes("tadi siang") || lower.includes("siang tadi") || lower.includes("siang ini") || lower.includes("kemarin siang")) {
    sentenceContextMod = "siang";
  } else if (lower.includes("tadi sore") || lower.includes("sore tadi") || lower.includes("sore ini") || lower.includes("kemarin sore")) {
    sentenceContextMod = "sore";
  } else if (lower.includes("tadi malam") || lower.includes("malam tadi") || lower.includes("semalam") || lower.includes("kemarin malam") || lower.includes("malam ini")) {
    sentenceContextMod = "malam";
  } else if (lower.includes("subuh")) {
    sentenceContextMod = "subuh";
  } else if (lower.includes("dini hari")) {
    sentenceContextMod = "dini hari";
  }

  // 1. Pola "setengah [jam]": "jam setengah 2 siang", "jam setengah dua", "setengah 8 malam", "setengah satu"
  const halfMatch = lower.match(
    /(?:pukul|jam)?\s*setengah\s+(\d{1,2}|dua\s+belas|sebelas|sepuluh|sembilan|delapan|tujuh|enam|lima|empat|tiga|dua|satu)(?:\s*(pagi|siang|sore|petang|malam|subuh|dini\s+hari))?(?:\s*(?:wib|wita|wit))?/i
  );
  if (halfMatch) {
    const rawH = parseIndonesianHourNumber(halfMatch[1]);
    if (rawH !== null) {
      const mod = halfMatch[2]?.toLowerCase() || sentenceContextMod;
      let h = rawH - 1; // "setengah 3" -> basis 2
      if (h < 0) h = 11;

      if (rawH === 1) {
        // "setengah 1" = 12:30 (siang) kecuali malam/dini hari
        if (mod === "malam" || mod === "subuh" || mod?.includes("dini hari")) {
          h = 0;
        } else {
          h = 12;
        }
      } else if (mod === "malam") {
        if (h >= 6 && h <= 11) h += 12;
      } else if (mod === "sore" || mod === "petang") {
        if (h >= 1 && h <= 6) h += 12;
      } else if (mod === "siang") {
        if (h >= 1 && h <= 5) h += 12;
      } else if (mod === "pagi" || mod === "subuh" || mod?.includes("dini hari")) {
        if (h === 12) h = 0;
      } else {
        // Tanpa modifier: rawH 2 s.d 6 -> siang/sore (13:30 - 17:30)
        if (rawH >= 2 && rawH <= 6) {
          h += 12;
        }
      }

      return { hour: h, minute: 30, hasMatch: true };
    }
  }

  // 2. Pola jam & menit format angka: "14:30", "14.30", "08.15 wib", "jam 14:30", "jam 08.00 pagi"
  // PENTING: Jangan cocokkan nominal ber-titik seperti "15.000" atau "20.000"!
  const colonTimeMatch = lower.match(
    /(?:(pukul|jam)\s+)?\b([01]?\d|2[0-3])([:.])([0-5]\d)(?!\d)(?:\s*(pagi|siang|sore|petang|malam|subuh|dini\s+hari))?(?:\s*(?:wib|wita|wit))?/i
  );
  if (colonTimeMatch) {
    const hasJamPrefix = !!colonTimeMatch[1];
    const rawH = parseInt(colonTimeMatch[2], 10);
    const sep = colonTimeMatch[3];
    const m = parseInt(colonTimeMatch[4], 10);
    const mod = colonTimeMatch[5]?.toLowerCase() || sentenceContextMod;
    const hasWib = /wib|wita|wit/i.test(colonTimeMatch[0]);

    if (sep === ":" || hasJamPrefix || mod || hasWib || rawH >= 13) {
      const h = applyModifierToHour(rawH, mod);
      return { hour: h, minute: m, hasMatch: true };
    }
  }

  // 3. Pola jam dengan kata/angka + lewat/lebih/kurang menit:
  // "jam 2 lewat 15", "jam 7 lebih 20", "jam 8 kurang 15 menit", "jam dua lewat sepuluh"
  const relativeMinMatch = lower.match(
    /(?:pukul|jam)\s*(\d{1,2}|dua\s+belas|tiga\s+belas|empat\s+belas|lima\s+belas|enam\s+belas|tujuh\s+belas|delapan\s+belas|sembilan\s+belas|dua\s+puluh|sebelas|sepuluh|sembilan|delapan|tujuh|enam|lima|empat|tiga|dua|satu)\s*(lewat|lebih|kurang)\s*(\d{1,2}|(?:dua|tiga|empat|lima)\s+puluh(?:\s+(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan))?|dua\s+belas|tiga\s+belas|empat\s+belas|lima\s+belas|enam\s+belas|tujuh\s+belas|delapan\s+belas|sembilan\s+belas|sebelas|sepuluh|seperempat|setengah|sembilan|delapan|tujuh|enam|lima|empat|tiga|dua|satu)(?:\s*menit)?(?:\s*(pagi|siang|sore|petang|malam|subuh|dini\s+hari))?(?:\s*(?:wib|wita|wit))?/i
  );
  if (relativeMinMatch) {
    const rawH = parseIndonesianHourNumber(relativeMinMatch[1]);
    if (rawH !== null) {
      const relType = relativeMinMatch[2].toLowerCase();
      let m = parseIndonesianNumber(relativeMinMatch[3]) || 0;
      let h = rawH;

      if (relType === "kurang") {
        h = h - 1;
        if (h < 0) h = 23;
        m = 60 - m;
      }

      const mod = relativeMinMatch[4]?.toLowerCase() || sentenceContextMod;
      h = applyModifierToHour(h, mod);

      return { hour: h, minute: m, hasMatch: true };
    }
  }

  // 4. Pola "jam/pukul [angka/kata]" + modifier:
  // "jam 2 siang", "jam dua siang", "pukul 8 malam", "jam 10", "jam 14", "jam sepuluh malam", "jam sembilan pagi"
  const standardMatch = lower.match(
    /(?:pukul|jam)\s*(\d{1,2}|dua\s+puluh(?:\s+(?:satu|dua|tiga|empat))?|dua\s+belas|tiga\s+belas|empat\s+belas|lima\s+belas|enam\s+belas|tujuh\s+belas|delapan\s+belas|sembilan\s+belas|dua\s+puluh|sebelas|sepuluh|sembilan|delapan|tujuh|enam|lima|empat|tiga|dua|satu)(?:\s*(?:tepat|pas))?(?:\s*(pagi|siang|sore|petang|malam|subuh|dini\s+hari))?(?:\s*(?:wib|wita|wit))?(?:\s*(?:tepat|pas))?/i
  );
  if (standardMatch) {
    const rawH = parseIndonesianHourNumber(standardMatch[1]);
    if (rawH !== null) {
      const mod = standardMatch[2]?.toLowerCase() || sentenceContextMod;
      const h = applyModifierToHour(rawH, mod);
      return { hour: h, minute: 0, hasMatch: true };
    }
  }

  // 5. Pola angka diikuti modifier tanpa kata jam: "2 siang", "8 malam", "10 pagi", "3 sore"
  const numModMatch = lower.match(/\b([1-9]|1[0-2])\s+(siang|sore|petang|malam|pagi|subuh)\b/i);
  if (numModMatch) {
    const rawH = parseInt(numModMatch[1], 10);
    const mod = numModMatch[2].toLowerCase();
    const h = applyModifierToHour(rawH, mod);
    return { hour: h, minute: 0, hasMatch: true };
  }

  return { hour: 0, minute: 0, hasMatch: false };
}

/**
 * Format Date ke format datetime-local HTML (YYYY-MM-DDTHH:mm)
 */
export function formatToDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yr = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hr = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yr}-${mo}-${day}T${hr}:${min}`;
}

const MONTH_REGEX_PART =
  "(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|ags|agu|sep|okt|nov|des)";

const DAY_WORD_REGEX_PART =
  "(?:tiga\\s+puluh\\s+satu|tiga\\s+puluh|dua\\s+puluh\\s+(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)|dua\\s+puluh|sembilan\\s+belas|delapan\\s+belas|tujuh\\s+belas|enam\\s+belas|lima\\s+belas|empat\\s+belas|tiga\\s+belas|dua\\s+belas|sebelas|sepuluh|sembilan|delapan|tujuh|enam|lima|empat|tiga|dua|satu|\\d{1,2})";

/**
 * Ekstraksi Waktu & Tanggal Natural Language Bahasa Indonesia
 * Menangani: "saat ini", "sekarang", "kemarin", "semalam", "lusa", "besok",
 * "3 hari yang lalu", "5 hari lalu", "seminggu yang lalu", "bulan lalu", "3 bulan lalu",
 * "tanggal 15 maret", "bulan maret tanggal 15", "tanggal lima belas maret",
 * "jam 2 siang", "pukul 14.30", "jam setengah 2", "2 jam lalu", dll.
 */
export function extractDateTimeFromText(
  text: string,
  referenceDate: Date = new Date()
): {
  happenedAt?: Date;
  happenedAtFormatted?: string;
  hasTimeMention: boolean;
} {
  if (!text) return { hasTimeMention: false };
  const lower = text.toLowerCase().trim();

  const targetDate = new Date(referenceDate.getTime());
  let hasMention = false;

  // 1. Format tanggal numerik: 25/08/2026 atau 25-08-2026
  const slashDateMatch = lower.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (slashDateMatch) {
    hasMention = true;
    const d = parseInt(slashDateMatch[1], 10);
    const m = parseInt(slashDateMatch[2], 10) - 1;
    let y = parseInt(slashDateMatch[3], 10);
    if (y < 100) y += 2000;
    targetDate.setFullYear(y);
    targetDate.setMonth(m);
    targetDate.setDate(d);
  }

  // 2. Pola tanggal dengan nama bulan eksplisit:
  // a) "[tanggal] [bulan] [tahun]" misal: "tanggal 15 maret 2026", "15 maret", "tanggal lima belas maret"
  const dateBeforeMonthRegex = new RegExp(
    `(?:pada\\s+)?(?:tanggal|tgl\\s*)?\\b(${DAY_WORD_REGEX_PART})\\s+${MONTH_REGEX_PART}\\b(?:\\s*(\\d{4}))?`,
    "i"
  );
  const dateBeforeMonthMatch = !slashDateMatch ? lower.match(dateBeforeMonthRegex) : null;

  // b) "bulan [nama_bulan] (tanggal [tgl])? ([tahun])?" misal: "bulan maret tanggal 15", "di bulan agustus tanggal 17", "pada bulan januari"
  const monthBeforeDateRegex = new RegExp(
    `(?:pada|di)?\\s*bulan\\s+${MONTH_REGEX_PART}(?:\\s*(?:tanggal|tgl)?\\s*(${DAY_WORD_REGEX_PART}))?(?:\\s*(\\d{4}))?`,
    "i"
  );
  const monthBeforeDateMatch = !slashDateMatch && !dateBeforeMonthMatch ? lower.match(monthBeforeDateRegex) : null;

  if (dateBeforeMonthMatch) {
    hasMention = true;
    const dayVal = parseDayNumber(dateBeforeMonthMatch[1]);
    const monthVal = MONTH_NAMES[dateBeforeMonthMatch[2].toLowerCase()];
    const yearVal = dateBeforeMonthMatch[3] ? parseInt(dateBeforeMonthMatch[3], 10) : targetDate.getFullYear();
    if (monthVal !== undefined) {
      targetDate.setFullYear(yearVal);
      targetDate.setMonth(monthVal);
      if (dayVal) targetDate.setDate(dayVal);
    }
  } else if (monthBeforeDateMatch) {
    hasMention = true;
    const monthVal = MONTH_NAMES[monthBeforeDateMatch[1].toLowerCase()];
    const dayVal = monthBeforeDateMatch[2] ? parseDayNumber(monthBeforeDateMatch[2]) : null;
    const yearVal = monthBeforeDateMatch[3] ? parseInt(monthBeforeDateMatch[3], 10) : targetDate.getFullYear();
    if (monthVal !== undefined) {
      targetDate.setFullYear(yearVal);
      targetDate.setMonth(monthVal);
      if (dayVal) {
        targetDate.setDate(dayVal);
      } else {
        targetDate.setDate(1);
      }
    }
  } else if (!slashDateMatch) {
    // Tanggal angka saja: "tanggal 25", "tgl 5"
    const tglOnlyMatch = lower.match(/(?:tanggal|tgl)\s*(\d{1,2})\b/i);
    if (tglOnlyMatch) {
      hasMention = true;
      const d = parseInt(tglOnlyMatch[1], 10);
      targetDate.setDate(d);
    }
  }

  // 3. Cek Relatif Hari Lalu: "3 hari yang lalu", "3 hari lalu", "tiga hari yang lalu", "kemarin lusa", "kemarin", dll.
  const daysAgoRegex =
    /\b(\d+|se|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\s*hari\s*(?:yang\s*)?lalu\b/i;
  const daysAgoMatch = lower.match(daysAgoRegex);

  if (daysAgoMatch) {
    hasMention = true;
    const numDays = parseRelativeQuantity(daysAgoMatch[1]);
    targetDate.setDate(targetDate.getDate() - numDays);
  } else if (
    lower.includes("kemarin lusa") ||
    lower.includes("dua hari lalu") ||
    lower.includes("2 hari lalu") ||
    lower.includes("2 hari yang lalu")
  ) {
    hasMention = true;
    targetDate.setDate(targetDate.getDate() - 2);
  } else if (
    lower.includes("kemarin") ||
    lower.includes("semalam") ||
    lower.includes("tadi malam") ||
    lower.includes("malam tadi")
  ) {
    hasMention = true;
    targetDate.setDate(targetDate.getDate() - 1);
  } else if (lower.includes("lusa")) {
    hasMention = true;
    targetDate.setDate(targetDate.getDate() + 2);
  } else if (lower.includes("besok")) {
    hasMention = true;
    targetDate.setDate(targetDate.getDate() + 1);
  }

  // 4. Cek Relatif Minggu / Pekan Lalu: "seminggu lalu", "2 minggu yang lalu", "3 minggu lalu"
  const weeksAgoRegex =
    /\b(\d+|se|satu|dua|tiga|empat|lima)\s*(?:minggu|pekan)\s*(?:yang\s*)?lalu\b/i;
  const weeksAgoMatch = lower.match(weeksAgoRegex);
  if (weeksAgoMatch) {
    hasMention = true;
    const numWeeks = parseRelativeQuantity(weeksAgoMatch[1]);
    targetDate.setDate(targetDate.getDate() - numWeeks * 7);
  } else if (lower.includes("minggu lalu") || lower.includes("pekan lalu") || lower.includes("seminggu lalu")) {
    hasMention = true;
    targetDate.setDate(targetDate.getDate() - 7);
  }

  // 5. Cek Relatif Bulan Lalu: "sebulan lalu", "1 bulan lalu", "3 bulan yang lalu", "6 bulan lalu"
  const monthsAgoRegex =
    /\b(\d+|se|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas)\s*bulan\s*(?:yang\s*)?lalu\b/i;
  const monthsAgoMatch = lower.match(monthsAgoRegex);
  if (monthsAgoMatch) {
    hasMention = true;
    const numMonths = parseRelativeQuantity(monthsAgoMatch[1]);
    targetDate.setMonth(targetDate.getMonth() - numMonths);
  } else if (lower.includes("bulan lalu") || lower.includes("sebulan lalu")) {
    hasMention = true;
    targetDate.setMonth(targetDate.getMonth() - 1);
  }

  // 6. Cek Relatif Tahun Lalu: "setahun lalu", "1 tahun lalu", "2 tahun yang lalu"
  const yearsAgoRegex =
    /\b(\d+|se|satu|dua|tiga|empat|lima)\s*tahun\s*(?:yang\s*)?lalu\b/i;
  const yearsAgoMatch = lower.match(yearsAgoRegex);
  if (yearsAgoMatch) {
    hasMention = true;
    const numYears = parseRelativeQuantity(yearsAgoMatch[1]);
    targetDate.setFullYear(targetDate.getFullYear() - numYears);
  } else if (lower.includes("tahun lalu") || lower.includes("setahun lalu")) {
    hasMention = true;
    targetDate.setFullYear(targetDate.getFullYear() - 1);
  }

  // 7. Cek penanda "saat ini" / "sekarang"
  if (
    lower.includes("saat ini") ||
    lower.includes("waktu saat ini") ||
    lower.includes("pada saat ini") ||
    lower.includes("sekarang") ||
    lower.includes("waktu sekarang") ||
    lower.includes("jam sekarang") ||
    lower.includes("hari ini") ||
    lower.includes("barusan") ||
    lower.includes("baru saja") ||
    lower.includes("seketika")
  ) {
    hasMention = true;
  }

  // 8. Cek hari dalam seminggu: "hari senin", "senin lalu", "rabu kemarin"
  const dayMatch = lower.match(
    /\b(?:hari\s+)?(senin|selasa|rabu|kamis|jumat|sabtu|minggu)(?:\s+(?:lalu|kemarin))?\b/i
  );
  if (dayMatch && !slashDateMatch && !dateBeforeMonthMatch && !monthBeforeDateMatch && !daysAgoMatch) {
    hasMention = true;
    const targetDayIndex = DAY_NAMES[dayMatch[1].toLowerCase()];
    const currentDayIndex = targetDate.getDay();
    let diff = currentDayIndex - targetDayIndex;
    if (diff <= 0) diff += 7;
    targetDate.setDate(targetDate.getDate() - diff);
  }

  // 9. Cek jam eksplisit / verbal dengan parseClockFromIndonesian
  const clock = parseClockFromIndonesian(lower);
  if (clock.hasMatch) {
    hasMention = true;
    targetDate.setHours(clock.hour, clock.minute, 0, 0);
  } else {
    // Modifier waktu bagian hari tanpa angka jam spesifik
    if (lower.includes("tadi pagi") || lower.includes("pagi tadi") || lower.includes("pagi ini")) {
      hasMention = true;
      targetDate.setHours(8, 0, 0, 0);
    } else if (lower.includes("tadi siang") || lower.includes("siang tadi") || lower.includes("siang ini")) {
      hasMention = true;
      targetDate.setHours(12, 30, 0, 0);
    } else if (
      lower.includes("tadi sore") ||
      lower.includes("sore tadi") ||
      lower.includes("sore ini") ||
      lower.includes("kemarin sore")
    ) {
      hasMention = true;
      targetDate.setHours(16, 30, 0, 0);
    } else if (
      lower.includes("tadi malam") ||
      lower.includes("malam tadi") ||
      lower.includes("semalam") ||
      lower.includes("malam ini") ||
      lower.includes("kemarin malam")
    ) {
      hasMention = true;
      targetDate.setHours(20, 0, 0, 0);
    } else if (lower.includes("kemarin pagi")) {
      hasMention = true;
      targetDate.setHours(8, 0, 0, 0);
    } else if (lower.includes("kemarin siang")) {
      hasMention = true;
      targetDate.setHours(12, 30, 0, 0);
    }
  }

  // 10. Cek relatif jam/menit lalu: "2 jam lalu", "30 menit yang lalu", "sejam lalu"
  const hoursAgoMatch = lower.match(/(?:(\d+)|se)\s*jam\s*(?:yang\s*)?lalu/i);
  if (hoursAgoMatch) {
    hasMention = true;
    const h = hoursAgoMatch[1] ? parseInt(hoursAgoMatch[1], 10) : 1;
    targetDate.setHours(targetDate.getHours() - h);
  }

  const minsAgoMatch = lower.match(/(\d+)\s*menit\s*(?:yang\s*)?lalu/i);
  if (minsAgoMatch) {
    hasMention = true;
    const m = parseInt(minsAgoMatch[1], 10);
    targetDate.setMinutes(targetDate.getMinutes() - m);
  }

  return {
    happenedAt: hasMention ? targetDate : undefined,
    happenedAtFormatted: hasMention ? formatToDateTimeLocal(targetDate) : undefined,
    hasTimeMention: hasMention,
  };
}

/**
 * Bersihkan catatan agar menjadi ringkas tanpa kata pengisi/instruksi suara
 * Contoh: "Saya baru beli kopi dengan nominal Rp 30.000 pada waktu saat ini dengan akun blue."
 * -> "Beli kopi"
 */
export function cleanSpeechToNote(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // 1. Hapus frasa pembuka
  cleaned = cleaned.replace(
    /^(?:saya\s+baru|baru\s+saja|barusan|tadi\s+saya|tadi|tolong\s+catatkan|tolong\s+catat|catatkan|catat\s+transaksi|catat)\s+/i,
    ""
  );

  // 2. Hapus pola tanggal numerik DULU sebelum regex angka nominal (misal: 25/08/2026)
  cleaned = cleaned.replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, "");

  // 3. Hapus pola tanggal kata: "tanggal 25 agustus 2026", "tgl 15 maret", "tanggal 15"
  cleaned = cleaned.replace(
    /(?:pada\s+)?(?:tanggal|tgl\s*)\s*\d{1,2}(?:\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|ags|agu|sep|okt|nov|des))?(?:\s*\d{4})?/gi,
    ""
  );
  cleaned = cleaned.replace(
    /\b\d{1,2}\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|ags|agu|sep|okt|nov|des)(?:\s*\d{4})?\b/gi,
    ""
  );

  // 4. Hapus pola deklarasi nominal: "dengan nominal Rp 30.000", "sebesar 30rb", "seharga 50.000"
  cleaned = cleaned.replace(
    /(?:dengan\s+nominal|nominal\s+sebesar|sebesar|seharga|nominalnya|harga)?\s*(?:rp|idr)?\.?\s*(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+[\.,]?\d*\s*(?:rb|ribu|k|jt|juta)|(?:\d{4,9}))/gi,
    ""
  );

  // Hapus pola nominal kata (e.g. "tiga puluh ribu")
  cleaned = cleaned.replace(
    /(?:dengan\s+nominal|sebesar|seharga)?\s*(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|dua\s+belas|seratus|seribu|sejuta)\s*(?:belas|puluh|ratus|ribu|juta)*/gi,
    ""
  );

  // 5. Hapus pola waktu jam: "jam 2 siang", "jam 14.30", "pukul 8 pagi", "jam setengah 2 siang", "jam 2 lewat 15"
  cleaned = cleaned.replace(
    /(?:pada\s+)?(?:pukul|jam)\s+setengah\s+\d{1,2}(?:\s*(?:pagi|siang|sore|malam))?/gi,
    ""
  );
  cleaned = cleaned.replace(
    /(?:pada\s+)?(?:pukul|jam)\s+\d{1,2}(?:[:.]\d{2}|\s+lewat\s+\d{1,2})?(?:\s*(?:pagi|siang|sore|malam))?/gi,
    ""
  );

  // 6. Hapus pola durasi lalu: "2 jam lalu", "30 menit yang lalu", "sejam lalu"
  cleaned = cleaned.replace(/(?:(\d+)|se)\s*jam\s*(?:yang\s*)?lalu/gi, "");
  cleaned = cleaned.replace(/\d+\s*menit\s*(?:yang\s*)?lalu/gi, "");

  // 7. Hapus penanda hari & bagian hari:
  cleaned = cleaned.replace(
    /(?:pada\s+)?(?:waktu\s+saat\s+ini|waktu\s+sekarang|jam\s+sekarang|saat\s+ini|sekarang\s+ini|hari\s+ini|sekarang)/gi,
    ""
  );
  cleaned = cleaned.replace(
    /(?:pada\s+)?(?:\d+|se|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\s*hari\s*(?:yang\s*)?lalu/gi,
    ""
  );
  cleaned = cleaned.replace(
    /(?:pada\s+)?(?:kemarin\s+lusa|dua\s+hari\s+lalu|2\s+hari\s+lalu|2\s+hari\s+yang\s+lalu)/gi,
    ""
  );
  cleaned = cleaned.replace(
    /(?:kemarin\s+(?:pagi|siang|sore|malam)|tadi\s+(?:pagi|siang|sore|malam)|(?:pagi|siang|sore|malam)\s+tadi|(?:pagi|siang|sore|malam)\s+ini)/gi,
    ""
  );
  cleaned = cleaned.replace(/(?:kemarin|semalam|lusa|besok)/gi, "");
  cleaned = cleaned.replace(
    /(?:pada\s+)?(?:hari\s+)?(?:senin|selasa|rabu|kamis|jumat|sabtu|minggu)(?:\s+(?:lalu|kemarin))?/gi,
    ""
  );
  cleaned = cleaned.replace(
    /(?:pada\s+)?(?:\d+|se|satu|dua|tiga|empat|lima)\s*(?:minggu|pekan)\s*(?:yang\s*)?lalu/gi,
    ""
  );
  cleaned = cleaned.replace(
    /(?:pada\s+)?(?:\d+|se|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas)\s*bulan\s*(?:yang\s*)?lalu/gi,
    ""
  );
  cleaned = cleaned.replace(
    /(?:pada\s+)?(?:\d+|se|satu|dua|tiga|empat|lima)\s*tahun\s*(?:yang\s*)?lalu/gi,
    ""
  );
  cleaned = cleaned.replace(
    /(?:pada|di)?\s*bulan\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|ags|agu|sep|okt|nov|des)(?:\s*(?:tanggal|tgl)?\s*[\w\d]+)?(?:\s*\d{4})?/gi,
    ""
  );

  // 8. Hapus deklarasi akun: "dengan akun blue", "pakai akun blu", "ke akun blu", "pake cash"
  cleaned = cleaned.replace(
    /(?:ke|dari|dengan|pake|pakai|menggunakan|lewat|melalui)\s+(?:akun\s+)?(?:blue|blu|cash|tunai|kas|dana|gopay|ovo|shopee|shopeepay|spay|bca|mandiri|bri|bni|jago|seabank|rekening\s+\w+)/gi,
    ""
  );
  cleaned = cleaned.replace(/(?:akun\s+)?(?:blue|blu|cash|tunai|dana|gopay|ovo|shopeepay|spay)\b/gi, "");

  // 9. Hapus kata penghubung/preposisi sisa di akhir atau awal: "pada", "di", "ke", "dengan", "dari"
  cleaned = cleaned.replace(/\b(?:ke|di|dari|pada|untuk|dengan|pake|pakai)\s*$/gi, "").trim();
  cleaned = cleaned.replace(/^(?:ke|di|dari|pada|untuk|dengan|pake|pakai)\s+/gi, "").trim();

  // Bersihkan spasi ganda, tanda baca berlebih di awal/akhir
  cleaned = cleaned
    .replace(/\s+/g, " ")
    .replace(/^[\s,.\-—:]+/, "")
    .replace(/[\s,.\-—:]+$/, "")
    .trim();

  // Jika setelah dibersihkan teksnya kosong, ambil kata kerja + objek pertama
  if (!cleaned || cleaned.length < 2) {
    const fallbackMatch = text.match(/(?:beli|bayar|makan|minum|jajan|transfer|kirim|gaji)\s+[\w\s]{2,20}/i);
    if (fallbackMatch) {
      cleaned = fallbackMatch[0].trim();
    } else {
      cleaned = text.trim();
    }
  }

  // Kapitalisasi huruf pertama
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Parser Utama Natural Language Transaksi Indonesia
 */
export function smartParseIndonesianTransaction(
  text: string,
  options?: ParserOptions
): ParsedTransactionResult {
  const normalized = normalizeSpokenIndonesian(text);
  const amount = extractAmountFromText(normalized) || extractAmountFromText(text);
  const txType = detectTxType(normalized);
  const { categoryHint, matchedCategoryId } = detectCategory(normalized, txType, options?.categories);
  const { accountHint, matchedAccountId, toAccountHint, matchedToAccountId } = detectAccount(normalized, options?.accounts);
  const { happenedAt, happenedAtFormatted } = extractDateTimeFromText(normalized, options?.referenceDate);
  const fullSpeech = text.trim();

  return {
    txType,
    amount,
    formattedAmount: amount > 0 ? formatInputIDR(String(amount)) : "",
    accountHint,
    matchedAccountId,
    toAccountHint,
    matchedToAccountId,
    categoryHint,
    matchedCategoryId,
    happenedAt,
    happenedAtFormatted,
    cleanNote: fullSpeech,
    note: fullSpeech,
    rawText: text,
  };
}
