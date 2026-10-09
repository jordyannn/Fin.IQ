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
 * Deteksi tipe transaksi (expense, income, transfer)
 */
export function detectTxType(text: string): "expense" | "income" | "transfer" {
  const lower = text.toLowerCase();

  // Transfer check
  if (
    lower.includes("transfer") ||
    lower.includes(" tf ") ||
    lower.startsWith("tf ") ||
    lower.includes("tarik tunai") ||
    lower.includes("pindah saldo") ||
    lower.includes("pindahin ke") ||
    lower.includes("kirim uang ke") ||
    /dari\s+.*\s+ke\s+/i.test(lower)
  ) {
    return "transfer";
  }

  // Income check
  if (
    lower.includes("gaji") ||
    lower.includes("uang masuk") ||
    lower.includes("masuk duit") ||
    lower.includes("duit masuk") ||
    lower.includes("terima uang") ||
    lower.includes("dapat uang") ||
    lower.includes("dapet uang") ||
    lower.includes("bonus") ||
    lower.includes("thr") ||
    lower.includes("cashback") ||
    lower.includes("top up") ||
    lower.includes("topup") ||
    lower.includes("penjualan") ||
    lower.includes("dividen") ||
    lower.includes("cair") ||
    lower.includes("kembalian") ||
    lower.includes("pemasukan")
  ) {
    return "income";
  }

  // Expense check (default)
  return "expense";
}

/**
 * Kamus Semantik Kategori
 */
const SEMANTIC_CATEGORIES: Record<string, string[]> = {
  "Makanan & Minuman": [
    "kopi", "coffee", "cafe", "kafe", "starbucks", "teh", "boba", "jus", "minum", "minuman",
    "makan", "makanan", "sarapan", "siang", "malam", "dinner", "lunch", "nasi", "ayam", "mie",
    "bakso", "sate", "burger", "pizza", "roti", "kue", "snack", "cemilan", "jajan", "warteg",
    "resto", "restoran", "indomaret", "alfamart", "family mart", "lawson", "kantin", "food", "dining", "beverage"
  ],
  "Transportasi": [
    "bensin", "pertalite", "pertamax", "solar", "spbu", "pom bensin", "shell", "gojek", "goride",
    "gocar", "grab", "grabcar", "taksi", "taxi", "ojol", "parkir", "tol", "krl", "mrt", "busway",
    "kereta", "pesawat", "transport", "travel", "bengkel", "servis motor", "servis mobil"
  ],
  "Belanja": [
    "belanja", "baju", "celana", "sepatu", "tas", "pakaian", "jaket", "shopee", "tokopedia",
    "lazada", "tiktok shop", "mall", "supermarket", "hypermart", "superindo", "shopping", "beli barang"
  ],
  "Tagihan & Utilitas": [
    "pln", "listrik", "token", "pdam", "air", "wifi", "indihome", "biznet", "internet",
    "pulsa", "kuota", "paket data", "bpjs", "iuran", "sampah", "utilitas", "utilities"
  ],
  "Kesehatan": [
    "obat", "apotek", "apotik", "dokter", "klinik", "vitamin", "rumah sakit", "rs", "masker",
    "medis", "health"
  ],
  "Hiburan": [
    "nonton", "bioskop", "cinema", "xxi", "cgv", "netflix", "spotify", "youtube", "game",
    "steam", "playstation", "karaoke", "liburan", "wisata", "entertain"
  ],
  "Gaji & Pendapatan": [
    "gaji", "payroll", "upah", "honor", "bonus", "thr", "dividen", "komisi", "proyek",
    "freelance", "penjualan", "hasil jualan", "uang saku", "income"
  ],
  "Tabungan & Investasi": [
    "tabungan", "investasi", "reksadana", "saham", "crypto", "emas", "bibit", "bareksa", "saving"
  ],
};

/**
 * Deteksi dan cocokkan kategori
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
    // Filter sesuai jenis (expense / income)
    const filtered = userCategories.filter((c) => !c.kind || c.kind === txType);

    for (const cat of filtered) {
      const catLower = cat.name.toLowerCase();
      // Jika nama kategori (e.g. "kopi", "makanan") muncul di teks
      if (lower.includes(catLower)) {
        return { categoryHint: cat.name, matchedCategoryId: cat.id };
      }
    }
  }

  // 2. Cek kamus semantik
  let bestCategoryHint = txType === "income" ? "Gaji & Pendapatan" : "Makanan & Minuman";
  let maxScore = 0;

  for (const [catName, keywords] of Object.entries(SEMANTIC_CATEGORIES)) {
    // Jika income, utamakan kategori income
    if (txType === "income" && catName !== "Gaji & Pendapatan" && catName !== "Tabungan & Investasi") {
      continue;
    }
    // Jika expense, hindari kategori income
    if (txType === "expense" && catName === "Gaji & Pendapatan") {
      continue;
    }

    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        // Beri bobot lebih tinggi untuk kata yang lebih spesifik (misal "kopi" > "beli")
        score += kw.length > 3 ? 2 : 1;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestCategoryHint = catName;
    }
  }

  // 3. Cocokkan hasil semantik terbaik dengan userCategories di database
  let matchedCategoryId: string | undefined;
  if (userCategories && userCategories.length > 0) {
    const hintLower = bestCategoryHint.toLowerCase();
    const candidate = userCategories
      .filter((c) => !c.kind || c.kind === txType)
      .find((c) => {
        const cLower = c.name.toLowerCase();
        return (
          cLower.includes(hintLower) ||
          hintLower.includes(cLower) ||
          (hintLower.includes("makan") && (cLower.includes("makan") || cLower.includes("dining") || cLower.includes("food") || cLower.includes("beverage"))) ||
          (hintLower.includes("transport") && cLower.includes("transport")) ||
          (hintLower.includes("belanja") && (cLower.includes("belanja") || cLower.includes("shop"))) ||
          (hintLower.includes("utilitas") && (cLower.includes("utilit") || cLower.includes("tagihan"))) ||
          (hintLower.includes("gaji") && (cLower.includes("gaji") || cLower.includes("income")))
        );
      });

    if (candidate) {
      matchedCategoryId = candidate.id;
      bestCategoryHint = candidate.name;
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
  } else if (lower.includes("kemarin") || lower.includes("semalam")) {
    hasMention = true;
    targetDate.setDate(targetDate.getDate() - 1);
    if (lower.includes("semalam")) {
      targetDate.setHours(20, 0, 0, 0);
    }
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

  // 6. Cek jam eksplisit: "jam 2 siang", "pukul 14.30", "jam 8 pagi", "jam 9 malam", "jam 10 lewat 15"
  const explicitHourMinMatch = lower.match(
    /(?:pukul|jam)\s*(\d{1,2})(?:[:.](\d{2})|\s+lewat\s+(\d{1,2}))?(?:\s*(pagi|siang|sore|malam))?/i
  );
  const halfHourMatch = lower.match(
    /(?:pukul|jam)\s*setengah\s*(\d{1,2})(?:\s*(pagi|siang|sore|malam))?/i
  );

  if (halfHourMatch) {
    hasMention = true;
    let hour = parseInt(halfHourMatch[1], 10) - 1; // "setengah 2" = 01:30
    if (hour < 0) hour = 11;
    const modifier = halfHourMatch[2]?.toLowerCase();
    if (modifier === "siang" && hour < 12) hour += 12;
    if (modifier === "sore" && hour < 12) hour += 12;
    if (modifier === "malam" && hour < 12) hour += 12;
    targetDate.setHours(hour, 30, 0, 0);
  } else if (explicitHourMinMatch) {
    hasMention = true;
    let hour = parseInt(explicitHourMinMatch[1], 10);
    const minute = explicitHourMinMatch[2]
      ? parseInt(explicitHourMinMatch[2], 10)
      : explicitHourMinMatch[3]
      ? parseInt(explicitHourMinMatch[3], 10)
      : 0;
    const modifier = explicitHourMinMatch[4]?.toLowerCase();

    if ((modifier === "siang" || modifier === "sore" || modifier === "malam") && hour < 12) {
      hour += 12;
    }
    targetDate.setHours(hour, minute, 0, 0);
  } else {
    // Modifier waktu bagian hari tanpa angka jam
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
    } else if (lower.includes("tadi malam") || lower.includes("malam tadi")) {
      hasMention = true;
      targetDate.setDate(targetDate.getDate() - 1);
      targetDate.setHours(20, 0, 0, 0);
    } else if (lower.includes("malam ini") || lower.includes("kemarin malam")) {
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
  const { happenedAt, happenedAtFormatted } = extractDateTimeFromText(text);
  const cleanNote = cleanSpeechToNote(text);

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
    cleanNote,
    note: cleanNote,
    rawText: text,
  };
}
