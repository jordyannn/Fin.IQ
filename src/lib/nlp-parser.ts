import { formatInputIDR } from "./utils";

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
  const transferKeywords = [
    "transfer", " tf ", "kirim uang ke", "tarik tunai", "pindah saldo", "pindahin ke",
    "pindah dana", "mutasi ke", "antar rekening"
  ];
  if (
    lower.startsWith("tf ") ||
    lower.endsWith(" tf") ||
    transferKeywords.some((k) => lower.includes(k)) ||
    /dari\s+.*\s+ke\s+/i.test(lower)
  ) {
    return "transfer";
  }

  // 2. Skoring Pemasukan vs Pengeluaran
  let incomeScore = 0;
  let expenseScore = 0;

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
    "bonus", "komisi", "insentif", "fee", "untung", "cuan", "laku", "top up", "topup",
    "uang saku", "uang jajan", "dikasih", "kiriman", "hibah"
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

interface CategoryKeywords {
  high: string[];
  medium: string[];
  low: string[];
}

/**
 * Kamus Semantik & Objek Objek Transaksi Sehari-hari Indonesia
 */
const SEMANTIC_CATEGORIES: Record<string, CategoryKeywords> = {
  "Makanan & Minuman": {
    high: [
      "kopi", "coffee", "kafe", "cafe", "starbucks", "janji jiwa", "kopi kenangan", "kulo", "tomoro",
      "point coffee", "fore", "boba", "chatime", "mixue", "teh", "es teh", "jus", "jus buah",
      "susu", "yoghurt", "yakult", "air mineral", "aqua", "le minerale", "nasgor", "nasi goreng",
      "nasi padang", "nasi uduk", "nasi kuning", "ayam goreng", "ayam bakar", "ayam geprek",
      "bebek goreng", "mie ayam", "bakmi", "indomie", "ramen", "bakso", "cuanki", "sate", "sate ayam",
      "sate kambing", "burger", "pizza", "mcd", "mcdonalds", "kfc", "richeese", "hokben", "burger king",
      "roti", "bakery", "roti o", "roti boy", "martabak", "terang bulan", "seblak", "batagor", "siomay",
      "cilok", "cireng", "gorengan", "pecel lele", "warteg", "angkringan", "chiki", "keripik", "snack"
    ],
    medium: [
      "makan", "makanan", "minum", "minuman", "sarapan", "siang", "malam", "dinner", "lunch",
      "nasi", "ayam", "mie", "ikan", "daging", "kue", "cemilan", "jajan", "jajanan", "resto",
      "restoran", "kantin", "food court", "kuliner", "indomaret", "alfamart", "family mart", "lawson"
    ],
    low: ["nongkrong", "lapar", "haus", "makan siang", "makan malam", "sarapan pagi"]
  },
  "Transportasi": {
    high: [
      "bensin", "pertalite", "pertamax", "solar", "dexlite", "shell", "spbu", "pom bensin",
      "ojol", "gojek", "goride", "gocar", "grab", "grabbike", "grabcar", "maxim", "indrive",
      "taksi", "taxi", "bluebird", "blue bird", "parkir", "karcis parkir", "tol", "e-toll",
      "krl", "commuter line", "mrt", "lrt", "busway", "transjakarta", "kereta", "tiket kereta",
      "whoosh", "pesawat", "tiket pesawat", "garuda", "lion air", "citilink", "airasia", "batik air",
      "ganti oli", "oli mesin", "tambal ban", "isi angin", "cuci motor", "cuci mobil", "helm",
      "sparepart", "onderdil", "aki motor", "aki mobil"
    ],
    medium: [
      "transport", "transportasi", "travel", "bengkel", "servis motor", "servis mobil", "angkot",
      "bus", "bis", "rental mobil", "sewa motor", "sewa mobil"
    ],
    low: ["ongkos", "jalan", "perjalanan"]
  },
  "Belanja & Kebutuhan": {
    high: [
      "baju", "celana", "sepatu", "tas", "kemeja", "kaos", "t-shirt", "jaket", "sweater", "hoodie",
      "rok", "gamis", "hijab", "sandal", "sneakers", "dompet", "ransel", "kacamata", "jam tangan",
      "skincare", "serum", "toner", "moisturizer", "sunscreen", "facial wash", "sabun", "shampoo",
      "sampo", "odol", "pasta gigi", "deodoran", "parfum", "makeup", "lipstik", "bedak", "kosmetik",
      "popok", "pampers", "deterjen", "belanja bulanan", "sayur", "buah", "beras", "minyak goreng",
      "shopee", "tokopedia", "tokped", "lazada", "tiktok shop", "blibli", "supermarket", "superindo",
      "hypermart", "transmart", "mall", "elektronik", "gadget", "casing hp", "charger", "kabel data",
      "headset", "earphone", "tws", "mouse", "keyboard", "laptop"
    ],
    medium: [
      "belanja", "pakaian", "shopping", "pasar", "minimarket", "beli barang", "kebutuhan rumah",
      "perabotan", "kasur", "bantal"
    ],
    low: ["beli", "pesan barang"]
  },
  "Tagihan & Utilitas": {
    high: [
      "token listrik", "tagihan listrik", "pln", "pdam", "tagihan air", "wifi", "indihome", "biznet",
      "first media", "myrepublic", "iconnet", "pulsa", "beli pulsa", "isi pulsa", "paket data",
      "paket internet", "kuota internet", "telkomsel", "indosat", "im3", "xl", "axis", "tri",
      "smartfren", "byu", "bpjs", "bpjs kesehatan", "bpjs ketenagakerjaan", "iuran rt", "iuran rw",
      "uang sampah", "pbb", "pajak motor", "pajak mobil", "uang kos", "bayar kos", "sewa kos",
      "kontrakan", "bayar kontrakan", "cicilan", "kpr", "paylater", "kartu kredit"
    ],
    medium: [
      "listrik", "air", "internet", "kuota", "iuran", "sampah", "utilitas", "utilities", "tagihan", "bill", "sewa"
    ],
    low: ["langganan", "bayar bulanan"]
  },
  "Kesehatan": {
    high: [
      "obat", "apotek", "apotik", "kimia farma", "k24", "century", "guardian", "watsons",
      "dokter", "klinik", "puskesmas", "rumah sakit", "rs", "igd", "vitamin", "suplemen",
      "panadol", "paracetamol", "tolak angin", "bodrex", "promag", "betadine", "perban", "plester",
      "masker medis", "cek darah", "cek lab", "dokter gigi", "tambal gigi", "cabut gigi", "scaling",
      "optik", "kacamata minus"
    ],
    medium: [
      "medis", "kesehatan", "health", "periksa dokter", "rawat inap", "rawat jalan"
    ],
    low: ["sakit", "berobat", "terapi"]
  },
  "Hiburan": {
    high: [
      "bioskop", "cinema", "xxi", "cgv", "cinepolis", "netflix", "spotify", "youtube premium",
      "disney+", "game", "topup game", "top up game", "diamond ml", "mobile legends", "free fire",
      "pubg", "genshin", "steam", "playstation", "ps5", "karaoke", "staycation", "hotel", "villa",
      "konser", "tiket konser", "dufan", "ancol", "taman safari", "wisata", "rekreasi"
    ],
    medium: [
      "nonton", "film", "liburan", "libur", "jalan-jalan", "entertain", "hiburan", "hobi"
    ],
    low: ["senang-senang", "refreshing"]
  },
  "Gaji & Pendapatan": {
    high: [
      "gaji", "gajian", "payroll", "upah", "honor", "honorarium", "fee", "bonus", "thr",
      "dividen", "komisi", "insentif", "proyek", "freelance", "lemburan", "penjualan", "omset",
      "hasil jualan", "cashback", "uang jajan", "kiriman uang", "uang saku"
    ],
    medium: [
      "pendapatan", "pemasukan", "income", "untung", "cuan", "refund"
    ],
    low: ["terima uang", "dapat duit"]
  },
  "Bonus & Investasi": {
    high: [
      "investasi", "saham", "reksadana", "bibit", "bareksa", "ajaib", "pluang", "crypto",
      "bitcoin", "btc", "eth", "binance", "indodax", "tokocrypto", "emas antam", "logam mulia",
      "deposito", "obligasi", "sukuk"
    ],
    medium: [
      "tabungan", "menabung", "nabung", "saving", "invest"
    ],
    low: ["simpan uang"]
  },
  "Pendidikan": {
    high: [
      "spp", "uang sekolah", "kuliah", "ukt", "uang semester", "skripsi", "wisuda", "les",
      "kursus", "bimbel", "ruangguru", "buku pelajaran", "alat tulis", "ujian", "sertifikasi",
      "bootcamp", "udemy"
    ],
    medium: [
      "sekolah", "pendidikan", "edukasi", "education", "buku", "belajar", "pelatihan"
    ],
    low: ["les anak"]
  },
  "Donasi & Sosial": {
    high: [
      "zakat", "zakat fitrah", "infaq", "infak", "sedekah", "donasi", "sumbangan", "kitabisa",
      "kotak amal", "amplop kondangan", "kado nikahan", "kado ultah", "traktiran", "angpau"
    ],
    medium: [
      "sosial", "hadiah", "kado", "traktir"
    ],
    low: ["kasih uang", "bantu teman"]
  }
};

/**
 * Deteksi dan cocokkan kategori menggunakan seluruh objek yang dibicarakan
 */
export function detectCategory(
  text: string,
  txType: "expense" | "income" | "transfer",
  userCategories?: CategoryItem[]
): { categoryHint: string; matchedCategoryId?: string } {
  const lower = text.toLowerCase();

  // Jika transfer, tidak butuh kategori
  if (txType === "transfer") {
    return { categoryHint: "Transfer" };
  }

  // 1. Cek kecocokan langsung dengan nama kategori yang ada di userCategories
  if (userCategories && userCategories.length > 0) {
    const directMatch = userCategories
      .filter((c) => !c.kind || c.kind === txType)
      .find((c) => {
        const catNameLower = c.name.toLowerCase().trim();
        return lower.includes(catNameLower);
      });

    if (directMatch) {
      return { categoryHint: directMatch.name, matchedCategoryId: directMatch.id };
    }
  }

  // 2. Evaluasi seluruh objek yang dibicarakan dalam kalimat menggunakan kamus semantik komprehensif
  const scores: Record<string, number> = {};

  for (const [catName, { high, medium, low }] of Object.entries(SEMANTIC_CATEGORIES)) {
    // Filter jenis transaksi
    if (txType === "income") {
      if (catName !== "Gaji & Pendapatan" && catName !== "Bonus & Investasi") continue;
    } else {
      if (catName === "Gaji & Pendapatan") continue;
    }

    let score = 0;

    for (const kw of high) {
      if (lower.includes(kw)) {
        score += 5; // Objek spesifik (misal: "kopi", "pertamax", "token listrik", "panadol")
      }
    }
    for (const kw of medium) {
      if (lower.includes(kw)) {
        score += 2; // Objek umum (misal: "makan", "bensin", "obat", "belanja")
      }
    }
    for (const kw of low) {
      if (lower.includes(kw)) {
        score += 1;
      }
    }

    if (score > 0) {
      scores[catName] = score;
    }
  }

  // Tentukan kategori terbaik dari skor objek terbanyak
  let bestCategoryHint = txType === "income" ? "Gaji & Pendapatan" : "Makanan & Minuman";
  let maxScore = 0;

  for (const [catName, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestCategoryHint = catName;
    }
  }

  // 3. Cocokkan hasil semantik terbaik dengan userCategories di database
  let matchedCategoryId: string | undefined;
  if (userCategories && userCategories.length > 0) {
    const hintLower = bestCategoryHint.toLowerCase();
    const findMatchingUserCat = (cats: CategoryItem[]) => {
      return cats.find((c) => {
        const cLower = c.name.toLowerCase();
        return (
          cLower.includes(hintLower) ||
          hintLower.includes(cLower) ||
          (hintLower.includes("makan") && (cLower.includes("makan") || cLower.includes("dining") || cLower.includes("food") || cLower.includes("beverage") || cLower.includes("kuliner"))) ||
          (hintLower.includes("transport") && (cLower.includes("transport") || cLower.includes("kendaraan") || cLower.includes("bensin"))) ||
          (hintLower.includes("belanja") && (cLower.includes("belanja") || cLower.includes("shop") || cLower.includes("kebutuhan"))) ||
          (hintLower.includes("utilitas") && (cLower.includes("utilit") || cLower.includes("tagihan") || cLower.includes("bill") || cLower.includes("listrik"))) ||
          (hintLower.includes("kesehatan") && (cLower.includes("sehat") || cLower.includes("health") || cLower.includes("medis"))) ||
          (hintLower.includes("hiburan") && (cLower.includes("hibur") || cLower.includes("entertain") || cLower.includes("game"))) ||
          (hintLower.includes("pendidikan") && (cLower.includes("didik") || cLower.includes("sekolah") || cLower.includes("kuliah"))) ||
          (hintLower.includes("gaji") && (cLower.includes("gaji") || cLower.includes("income") || cLower.includes("pendapatan"))) ||
          (hintLower.includes("investasi") && (cLower.includes("invest") || cLower.includes("tabung") || cLower.includes("saving") || cLower.includes("bonus")))
        );
      });
    };

    let candidate = findMatchingUserCat(userCategories.filter((c) => !c.kind || c.kind === txType));
    if (!candidate) {
      candidate = findMatchingUserCat(userCategories);
    }

    if (candidate) {
      matchedCategoryId = candidate.id;
      bestCategoryHint = candidate.name;
    } else {
      // Fallback cerdas jika user belum memiliki kategori kustom tersebut (misal: Kesehatan/Hiburan ke Belanja)
      if (bestCategoryHint === "Kesehatan" || bestCategoryHint === "Hiburan") {
        const belanjaFallback = userCategories.find((c) => c.kind === "expense" && (c.name.toLowerCase().includes("belanja") || c.name.toLowerCase().includes("kebutuhan")));
        if (belanjaFallback) {
          matchedCategoryId = belanjaFallback.id;
          bestCategoryHint = belanjaFallback.name;
        }
      } else if (bestCategoryHint === "Pendidikan" || bestCategoryHint === "Donasi & Sosial") {
        const tagihanFallback = userCategories.find((c) => c.kind === "expense" && (c.name.toLowerCase().includes("tagihan") || c.name.toLowerCase().includes("kebutuhan")));
        if (tagihanFallback) {
          matchedCategoryId = tagihanFallback.id;
          bestCategoryHint = tagihanFallback.name;
        }
      }
    }
  }

  return { categoryHint: bestCategoryHint, matchedCategoryId };
}

/**
 * Pemetaan fonetik akun umum di Indonesia
 */
const ACCOUNT_PHONETIC_MAP: Record<string, string> = {
  blue: "blu",
  blu: "blu",
  "bca digital": "blu",
  cash: "kas",
  tunai: "kas",
  "kas tunai": "kas",
  dompet: "kas",
  shopee: "shopeepay",
  spay: "shopeepay",
  shopeepay: "shopeepay",
  gopay: "gopay",
  gojek: "gopay",
  ovo: "ovo",
  dana: "dana",
  jago: "jago",
  bca: "bca",
  mandiri: "mandiri",
  bri: "bri",
  bni: "bni",
  seabank: "seabank",
};

/**
 * Deteksi dan cocokkan akun dari suara
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
  const lower = text.toLowerCase();

  // 1. Cek transfer pola: "dari [akun A] ke [akun B]"
  const transferMatch = lower.match(/(?:dari|from)\s+([a-z0-9\s]+?)\s+(?:ke|to)\s+([a-z0-9\s]+)/i);
  let fromHint = "kas";
  let toHint = "";

  if (transferMatch) {
    fromHint = transferMatch[1].trim();
    toHint = transferMatch[2].trim();
  } else {
    // Normal akun hint
    for (const [phonetic, canonical] of Object.entries(ACCOUNT_PHONETIC_MAP)) {
      if (lower.includes(phonetic)) {
        fromHint = canonical;
        break;
      }
    }
  }

  // 2. Cocokkan dengan akun pengguna di database
  let matchedAccountId: string | undefined;
  let matchedToAccountId: string | undefined;

  if (userAccounts && userAccounts.length > 0) {
    const findAcc = (hint: string) => {
      const hLower = hint.toLowerCase();
      // Coba phonetic mapping dulu
      const mapped = ACCOUNT_PHONETIC_MAP[hLower] || hLower;
      return userAccounts.find((a) => {
        const aLower = a.name.toLowerCase();
        return (
          aLower.includes(hLower) ||
          hLower.includes(aLower) ||
          aLower.includes(mapped) ||
          mapped.includes(aLower)
        );
      });
    };

    const fromAcc = findAcc(fromHint);
    if (fromAcc) {
      matchedAccountId = fromAcc.id;
      fromHint = fromAcc.name;
    }

    if (toHint) {
      const toAcc = findAcc(toHint);
      if (toAcc) {
        matchedToAccountId = toAcc.id;
        toHint = toAcc.name;
      }
    }
  }

  return {
    accountHint: fromHint,
    matchedAccountId,
    toAccountHint: toHint || undefined,
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

/**
 * Ekstraksi Waktu & Tanggal Natural Language Bahasa Indonesia
 * Menangani: "saat ini", "sekarang", "kemarin", "semalam", "lusa", "besok",
 * "tadi pagi/siang/sore/malam", "jam 2 siang", "pukul 14.30", "jam setengah 2",
 * "tanggal 25 agustus 2026", "2 jam lalu", "30 menit lalu", "senin lalu", "bulan lalu", dll.
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
  const lower = text.toLowerCase();

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

  // 2. Tanggal eksplisit dengan nama bulan: "tanggal 25 agustus 2026", "25 agustus", "tgl 15 maret"
  const fullDateMatch = lower.match(
    /(?:tanggal|tgl\s*)?\b(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|ags|agu|sep|okt|nov|des)\b(?:\s*(\d{4}))?/i
  );
  if (fullDateMatch && !slashDateMatch) {
    hasMention = true;
    const d = parseInt(fullDateMatch[1], 10);
    const m = MONTH_NAMES[fullDateMatch[2].toLowerCase()];
    const y = fullDateMatch[3] ? parseInt(fullDateMatch[3], 10) : targetDate.getFullYear();
    targetDate.setFullYear(y);
    targetDate.setMonth(m);
    targetDate.setDate(d);
  } else if (!slashDateMatch) {
    // Tanggal angka saja: "tanggal 25", "tgl 5"
    const tglOnlyMatch = lower.match(/(?:tanggal|tgl)\s*(\d{1,2})\b/i);
    if (tglOnlyMatch) {
      hasMention = true;
      const d = parseInt(tglOnlyMatch[1], 10);
      targetDate.setDate(d);
    }
  }

  // 3. Cek relatif jam/menit lalu: "2 jam lalu", "30 menit yang lalu", "sejam lalu"
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

  // 4. Cek hari relatif
  if (
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
  } else if (
    lower.includes("minggu lalu") ||
    lower.includes("pekan lalu") ||
    lower.includes("1 minggu lalu") ||
    lower.includes("seminggu lalu")
  ) {
    hasMention = true;
    targetDate.setDate(targetDate.getDate() - 7);
  } else if (lower.includes("2 minggu lalu")) {
    hasMention = true;
    targetDate.setDate(targetDate.getDate() - 14);
  } else if (
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
    // targetDate tetap waktu saat ini
  }

  // 5. Cek hari dalam seminggu: "hari senin", "senin lalu", "rabu kemarin"
  const dayMatch = lower.match(
    /\b(?:hari\s+)?(senin|selasa|rabu|kamis|jumat|sabtu|minggu)(?:\s+(?:lalu|kemarin))?\b/i
  );
  if (dayMatch && !fullDateMatch && !slashDateMatch) {
    hasMention = true;
    const targetDayIndex = DAY_NAMES[dayMatch[1].toLowerCase()];
    const currentDayIndex = targetDate.getDay();
    let diff = currentDayIndex - targetDayIndex;
    if (diff <= 0) diff += 7; // Mundur ke hari tersebut di minggu lalu/terdekat
    targetDate.setDate(targetDate.getDate() - diff);
  }

  // 6. Cek jam eksplisit / verbal dengan parseClockFromIndonesian
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

  // 7. Cek bulan lalu / tahun lalu
  if (lower.includes("bulan lalu") || lower.includes("1 bulan lalu") || lower.includes("sebulan lalu")) {
    hasMention = true;
    targetDate.setMonth(targetDate.getMonth() - 1);
  } else if (lower.includes("2 bulan lalu")) {
    hasMention = true;
    targetDate.setMonth(targetDate.getMonth() - 2);
  }

  if (lower.includes("tahun lalu") || lower.includes("1 tahun lalu") || lower.includes("setahun lalu")) {
    hasMention = true;
    targetDate.setFullYear(targetDate.getFullYear() - 1);
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
  cleaned = cleaned.replace(/(?:1\s+|2\s+|se)?(?:minggu|pekan|bulan|tahun)\s*(?:yang\s*)?lalu/gi, "");

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
  const amount = extractAmountFromText(text);
  const txType = detectTxType(text);
  const { categoryHint, matchedCategoryId } = detectCategory(text, txType, options?.categories);
  const { accountHint, matchedAccountId, toAccountHint, matchedToAccountId } = detectAccount(text, options?.accounts);
  const { happenedAt, happenedAtFormatted } = extractDateTimeFromText(text, options?.referenceDate);
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
