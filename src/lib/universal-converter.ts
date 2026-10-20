import { detectCategory } from "./nlp-parser";

export interface UniversalTxItem {
  id: string;
  rowNumber: number;
  happenedAt: string; // ISO 8601 string: YYYY-MM-DDTHH:mm:ss
  txType: "expense" | "income" | "transfer";
  amount: number;
  categoryName: string;
  accountName: string;
  toAccountName?: string | null;
  note: string;
  tags: string[];
  isNlpDetected?: boolean;
  sourceConfidence?: "high" | "medium" | "ai";
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, januari: 0, january: 0,
  feb: 1, februari: 1, february: 1,
  mar: 2, maret: 2, march: 2,
  apr: 3, april: 3,
  mei: 4, may: 4,
  jun: 5, juni: 5, june: 5,
  jul: 6, juli: 6, july: 6,
  agu: 7, ags: 7, agt: 7, agustus: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  okt: 9, oct: 9, oktober: 9, october: 9,
  nov: 10, november: 10,
  des: 11, dec: 11, desember: 11, december: 11,
};

/**
 * Normalisasi format tanggal universal (Indonesian & International)
 */
export function parseUniversalDate(raw: string | undefined): string {
  if (!raw || !raw.trim()) {
    return new Date().toISOString();
  }

  const s = raw.trim().replace(/^['"]|['"]$/g, "");
  const now = new Date();
  const currentYear = now.getFullYear();

  // 1. Cek format ISO standar (2026-10-15 atau 2026-10-15T08:30:00)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // 2. Format tanggal teks Indonesia/Inggris (misal: "15 Okt 2026", "15 Oktober 2026", "15-Okt-26")
  const textMonthMatch = s.match(/^(\d{1,2})[\s\-\/]([a-zA-Z]{3,10})[\s\-\/]?(\d{2,4})?(?:[\s,]+(\d{1,2}:\d{2}(?::\d{2})?))?/i);
  if (textMonthMatch) {
    const day = parseInt(textMonthMatch[1], 10);
    const mStr = textMonthMatch[2].toLowerCase();
    let month = MONTH_MAP[mStr];
    if (month === undefined) {
      const prefix = mStr.substring(0, 3);
      month = MONTH_MAP[prefix] ?? now.getMonth();
    }
    let yr = textMonthMatch[3] ? parseInt(textMonthMatch[3], 10) : currentYear;
    if (yr < 100) yr += 2000;

    let hour = 12, min = 0, sec = 0;
    if (textMonthMatch[4]) {
      const parts = textMonthMatch[4].split(":");
      hour = parseInt(parts[0], 10) || 12;
      min = parseInt(parts[1], 10) || 0;
      sec = parseInt(parts[2], 10) || 0;
    }
    const d = new Date(yr, month, day, hour, min, sec);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // 3. Format DD/MM/YYYY atau DD-MM-YYYY atau MM/DD/YYYY
  const parts = s.split(/[\/\-\.\s]/).filter(Boolean);
  if (parts.length >= 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    let p2 = parseInt(parts[2], 10);
    if (p2 < 100) p2 += 2000;

    // Jika p0 > 12, pasti DD/MM/YYYY
    if (p0 > 12 && p1 <= 12) {
      const d = new Date(p2, p1 - 1, p0, 12, 0, 0);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    // Jika p2 > 1900, default format Indonesia: DD/MM/YYYY
    if (p2 >= 1970 && p0 <= 31 && p1 <= 12) {
      const d = new Date(p2, p1 - 1, p0, 12, 0, 0);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    // Jika format YYYY/MM/DD
    if (p0 >= 1970 && p1 <= 12 && p2 <= 31) {
      const d = new Date(p0, p1 - 1, p2, 12, 0, 0);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }

  // 4. Format DD/MM (tanpa tahun, sering di mutasi BCA m-banking)
  if (parts.length === 2) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const d = new Date(currentYear, month - 1, day, 12, 0, 0);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }

  // Fallback native Date parse
  const fallback = new Date(s);
  return !isNaN(fallback.getTime()) ? fallback.toISOString() : new Date().toISOString();
}

/**
 * Normalisasi nominal uang dari string template apapun.
 * Mendeteksi titik/koma ribuan, simbol mata uang (Rp, IDR, $), dan suffix DB/CR.
 */
export function parseUniversalAmount(raw: string | number | undefined): {
  amount: number;
  suffixType?: "expense" | "income";
} {
  if (raw === undefined || raw === null) return { amount: 0 };
  if (typeof raw === "number") {
    return {
      amount: Math.abs(Math.round(raw)),
      suffixType: raw < 0 ? "expense" : undefined,
    };
  }

  let s = String(raw).trim();
  if (!s) return { amount: 0 };

  let suffixType: "expense" | "income" | undefined = undefined;

  // Cek suffix DB (Debit/Pengeluaran) atau CR (Kredit/Pemasukan) khas KlikBCA/Bank
  if (/\b(db|dr|debet|debit|out|keluar)\b/i.test(s)) {
    suffixType = "expense";
    s = s.replace(/\b(db|dr|debet|debit|out|keluar)\b/gi, "").trim();
  } else if (/\b(cr|kredit|credit|in|masuk)\b/i.test(s)) {
    suffixType = "income";
    s = s.replace(/\b(cr|kredit|credit|in|masuk)\b/gi, "").trim();
  }

  // Cek tanda kurung (50.000) yang biasa merepresentasikan angka negatif / expense
  if (/^\(.*\)$/.test(s)) {
    suffixType = "expense";
    s = s.replace(/[()]/g, "").trim();
  } else if (s.startsWith("-")) {
    suffixType = "expense";
    s = s.replace(/^-/, "").trim();
  } else if (s.startsWith("+")) {
    suffixType = "income";
    s = s.replace(/^\+/, "").trim();
  }

  // Hapus simbol mata uang dan karakter non-angka kecuali titik, koma, minus
  s = s.replace(/[^\d.,]/g, "").trim();
  if (!s) return { amount: 0, suffixType };

  // Analisis separator titik vs koma:
  // Contoh: 1.500.000,00 (Indonesia) vs 1,500,000.00 (US)
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  let finalNumber = 0;

  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // Indonesia: 1.500.000,00 -> titik ribuan, koma desimal
      const clean = s.replace(/\./g, "").replace(",", ".");
      finalNumber = parseFloat(clean);
    } else {
      // US: 1,500,000.00 -> koma ribuan, titik desimal
      const clean = s.replace(/,/g, "");
      finalNumber = parseFloat(clean);
    }
  } else if (hasComma && !hasDot) {
    // Bisa 1,500,000 (US ribuan) atau 50000,00 (ID desimal)
    const parts = s.split(",");
    if (parts.length > 2) {
      // 1,500,000
      finalNumber = parseFloat(s.replace(/,/g, ""));
    } else if (parts[1] && parts[1].length === 3) {
      // 50,000 -> ribuan
      finalNumber = parseFloat(s.replace(/,/g, ""));
    } else {
      // 50000,00 -> desimal
      finalNumber = parseFloat(parts[0]);
    }
  } else if (hasDot && !hasComma) {
    // Bisa 1.500.000 (ID ribuan) atau 50000.00 (US desimal)
    const parts = s.split(".");
    if (parts.length > 2) {
      // 1.500.000
      finalNumber = parseFloat(s.replace(/\./g, ""));
    } else if (parts[1] && parts[1].length === 3) {
      // 50.000 -> ribuan
      finalNumber = parseFloat(s.replace(/\./g, ""));
    } else if (parts[1] && (parts[1].length === 1 || parts[1].length === 2)) {
      // 50000.50 -> desimal
      finalNumber = parseFloat(s);
    } else {
      finalNumber = parseFloat(s.replace(/\./g, ""));
    }
  } else {
    finalNumber = parseFloat(s);
  }

  return {
    amount: isNaN(finalNumber) ? 0 : Math.abs(Math.round(finalNumber)),
    suffixType,
  };
}

/**
 * Deteksi nama bank atau akun dari nama file atau header mutasi
 */
export function detectBankHint(text: string): string | null {
  const s = text.toLowerCase();
  if (s.includes("bca digital") || s.includes("blu")) return "blu";
  if (s.includes("klikbca") || s.includes("bca") || s.includes("mybca")) return "BCA";
  if (s.includes("mandiri") || s.includes("livin")) return "Bank Mandiri";
  if (s.includes("brimo") || s.includes("bri")) return "Bank BRI";
  if (s.includes("bni") || s.includes("wondr")) return "Bank BNI";
  if (s.includes("gopay") || s.includes("gojek")) return "GoPay";
  if (s.includes("ovo")) return "OVO";
  if (s.includes("dana")) return "DANA";
  if (s.includes("shopeepay") || s.includes("spay")) return "ShopeePay";
  if (s.includes("jago")) return "Bank Jago";
  if (s.includes("seabank")) return "SeaBank";
  if (s.includes("jenius") || s.includes("btpn")) return "Jenius";
  if (s.includes("cash") || s.includes("tunai")) return "Kas Tunai";
  return null;
}

export interface UniversalParseResult {
  items: UniversalTxItem[];
  headers: string[];
  headerRowIndex: number;
  detectedBank: string | null;
  confidence: "high" | "medium" | "low";
  isSeparateDebitCredit: boolean;
  totalIncome: number;
  totalExpense: number;
}

/**
 * Parser Cerdas Heuristik untuk mengonversi baris tabel CSV/Excel apa saja ke Template Fin.IQ
 */
export function parseUniversalTable(
  rows: string[][],
  filename: string = "",
  options: {
    defaultAccountName?: string;
    userAccounts?: Array<{ id: string; name: string }>;
    userCategories?: Array<{ id: string; name: string; kind?: string }>;
  } = {}
): UniversalParseResult {
  if (!rows || rows.length < 2) {
    return {
      items: [],
      headers: [],
      headerRowIndex: -1,
      detectedBank: detectBankHint(filename),
      confidence: "low",
      isSeparateDebitCredit: false,
      totalIncome: 0,
      totalExpense: 0,
    };
  }

  const detectedBank = detectBankHint(filename);

  // 1. Temukan Baris Header (Mencari baris dalam 15 baris pertama yang memuat kata kunci transaksi)
  let headerRowIndex = -1;
  const HEADER_KEYWORDS = [
    "tanggal", "date", "waktu", "time",
    "keterangan", "deskripsi", "description", "uraian", "rincian", "narasi", "remarks", "memo", "transaksi",
    "nominal", "amount", "jumlah", "mutasi", "nilai", "total",
    "debet", "debit", "kredit", "credit", "db", "cr",
    "tipe", "type", "jenis", "saldo", "balance"
  ];

  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const row = rows[i].map((c) => (c || "").trim().toLowerCase());
    let matchCount = 0;
    for (const cell of row) {
      if (HEADER_KEYWORDS.some((kw) => cell.includes(kw))) {
        matchCount++;
      }
    }
    // Baris header biasanya memiliki >= 2 kata kunci relevan
    if (matchCount >= 2) {
      headerRowIndex = i;
      break;
    }
  }

  // Jika tidak ditemukan dengan kata kunci, ambil baris pertama yang memiliki >= 2 kolom non-kosong
  if (headerRowIndex === -1) {
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const nonEmp = rows[i].filter((c) => (c || "").trim().length > 0);
      if (nonEmp.length >= 2) {
        headerRowIndex = i;
        break;
      }
    }
  }

  if (headerRowIndex === -1) headerRowIndex = 0;

  const rawHeaders = rows[headerRowIndex].map((h, idx) => (h || "").trim() || `Kolom_${idx + 1}`);
  const lowerHeaders = rawHeaders.map((h) => h.toLowerCase());

  // 2. Pemetaan Kolom Fleksibel
  let dateColIdx = -1;
  let noteColIdx = -1;
  let singleAmountColIdx = -1;
  let debitColIdx = -1;
  let creditColIdx = -1;
  let typeColIdx = -1;
  let accountColIdx = -1;
  let categoryColIdx = -1;

  for (let idx = 0; idx < lowerHeaders.length; idx++) {
    const h = lowerHeaders[idx];

    // Kolom Tanggal
    if (dateColIdx === -1 && /(tanggal|date|waktu|time|happened|timestamp|tgl|trn_date|posting_date|valuta)/i.test(h)) {
      dateColIdx = idx;
      continue;
    }

    // Kolom Debit / Pengeluaran Terpisah
    if (debitColIdx === -1 && /(debet|debit|withdrawal|tarik|keluar|pengeluaran|db|dr|mutasi\s*debet)/i.test(h) && !h.includes("kredit") && !h.includes("credit")) {
      debitColIdx = idx;
      continue;
    }

    // Kolom Kredit / Pemasukan Terpisah
    if (creditColIdx === -1 && /(kredit|credit|deposit|setor|masuk|pemasukan|cr|mutasi\s*kredit)/i.test(h) && !h.includes("debet") && !h.includes("debit")) {
      creditColIdx = idx;
      continue;
    }

    // Kolom Nominal Tunggal
    if (singleAmountColIdx === -1 && /(nominal|amount|jumlah|total|harga|nilai|mutasi|amt|sum)/i.test(h) && !h.includes("saldo") && !h.includes("balance")) {
      singleAmountColIdx = idx;
      continue;
    }

    // Kolom Jenis / Tipe
    if (typeColIdx === -1 && /(jenis|tipe|type|kind|kategori\s*transaksi|d[\/／]?k|db[\/／]?cr|tx_type)/i.test(h)) {
      typeColIdx = idx;
      continue;
    }

    // Kolom Keterangan / Deskripsi
    if (noteColIdx === -1 && /(keterangan|deskripsi|description|uraian|rincian|narasi|note|remarks|memo|nama\s*merchant|merchant|transaksi)/i.test(h)) {
      noteColIdx = idx;
      continue;
    }

    // Kolom Akun / Rekening
    if (accountColIdx === -1 && /(account|akun|rekening|dompet|wallet|bank|metode)/i.test(h)) {
      accountColIdx = idx;
      continue;
    }

    // Kolom Kategori
    if (categoryColIdx === -1 && /(category|kategori|pos|klasifikasi|cat)/i.test(h)) {
      categoryColIdx = idx;
      continue;
    }
  }

  // Fallback jika tidak menemukan kolom tanggal: cari kolom pertama yang baris datanya berupa tanggal
  if (dateColIdx === -1 && rows.length > headerRowIndex + 1) {
    const sampleRow = rows[headerRowIndex + 1];
    for (let c = 0; c < sampleRow.length; c++) {
      const val = sampleRow[c] || "";
      if (/\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}/.test(val) || /^[a-z]{3}\s*\d{1,2}/i.test(val)) {
        dateColIdx = c;
        break;
      }
    }
  }

  // Fallback keterangan: jika belum ada, cari kolom string terpanjang
  if (noteColIdx === -1 && rows.length > headerRowIndex + 1) {
    const sampleRow = rows[headerRowIndex + 1];
    let maxLen = 0;
    for (let c = 0; c < sampleRow.length; c++) {
      if (c === dateColIdx || c === singleAmountColIdx || c === debitColIdx || c === creditColIdx) continue;
      const len = (sampleRow[c] || "").length;
      if (len > maxLen) {
        maxLen = len;
        noteColIdx = c;
      }
    }
  }

  const isSeparateDebitCredit = debitColIdx !== -1 && creditColIdx !== -1;

  // 3. Ekstraksi Baris Data
  const dataRows = rows.slice(headerRowIndex + 1);
  const items: UniversalTxItem[] = [];
  let totalIncome = 0;
  let totalExpense = 0;

  const defaultAccount =
    options.defaultAccountName ||
    detectedBank ||
    options.userAccounts?.[0]?.name ||
    "Kas Tunai";

  for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
    const row = dataRows[rIdx];
    // Lewati baris kosong atau baris saldo awal/ringkasan footer
    const rowText = row.join(" ").trim().toLowerCase();
    if (!rowText || rowText.includes("total mutasi") || rowText.includes("saldo awal") || rowText.includes("saldo akhir")) {
      continue;
    }

    let txType: "expense" | "income" | "transfer" = "expense";
    let amount = 0;

    // A. Mode Debit & Kredit Terpisah
    if (isSeparateDebitCredit) {
      const rawDebit = row[debitColIdx];
      const rawCredit = row[creditColIdx];

      const debVal = parseUniversalAmount(rawDebit).amount;
      const credVal = parseUniversalAmount(rawCredit).amount;

      if (credVal > 0 && debVal === 0) {
        txType = "income";
        amount = credVal;
      } else if (debVal > 0) {
        txType = "expense";
        amount = debVal;
      } else if (credVal > 0) {
        txType = "income";
        amount = credVal;
      }
    }
    // B. Mode Nominal Tunggal
    else if (singleAmountColIdx !== -1) {
      const rawAmt = row[singleAmountColIdx];
      const parsedAmt = parseUniversalAmount(rawAmt);
      amount = parsedAmt.amount;

      if (parsedAmt.suffixType) {
        txType = parsedAmt.suffixType;
      } else if (typeColIdx !== -1) {
        const rawType = (row[typeColIdx] || "").toLowerCase();
        if (/(in|masuk|kredit|cr|income|gaji|\+)/i.test(rawType)) {
          txType = "income";
        } else if (/(tf|transfer|kirim)/i.test(rawType)) {
          txType = "transfer";
        } else {
          txType = "expense";
        }
      }
    }
    // C. Jika hanya menemukan debit atau hanya credit
    else if (debitColIdx !== -1) {
      amount = parseUniversalAmount(row[debitColIdx]).amount;
      txType = "expense";
    } else if (creditColIdx !== -1) {
      amount = parseUniversalAmount(row[creditColIdx]).amount;
      txType = "income";
    }

    // Lewati baris yang tidak memiliki nominal valid
    if (amount <= 0) continue;

    // Tanggal
    const rawDate = dateColIdx !== -1 ? row[dateColIdx] : "";
    const isoDate = parseUniversalDate(rawDate);

    // Keterangan / Note
    let note = noteColIdx !== -1 ? (row[noteColIdx] || "").trim() : "";
    if (!note || note === "-") {
      // Gabungkan teks kolom non-angka sebagai keterangan
      const extraTexts: string[] = [];
      row.forEach((cell, idx) => {
        if (idx !== dateColIdx && idx !== singleAmountColIdx && idx !== debitColIdx && idx !== creditColIdx) {
          const c = (cell || "").trim();
          if (c && c.length > 2 && isNaN(Number(c))) extraTexts.push(c);
        }
      });
      note = extraTexts.join(" - ") || "Transaksi Impor";
    }

    // Deteksi transfer dari kata kunci keterangan (misal: "TRSF E-BANKING DB KE 12345")
    if (txType === "expense" && /(transfer ke|trsf ke|pindah dana|kirim uang|topup|top up)/i.test(note)) {
      // Jika transfer ke rekening lain
      // Biarkan tetap expense atau tandai transfer
    }

    // Akun
    let accountName = accountColIdx !== -1 ? (row[accountColIdx] || "").trim() : "";
    if (!accountName) {
      accountName = defaultAccount;
    }

    // Kategori
    let categoryName = categoryColIdx !== -1 ? (row[categoryColIdx] || "").trim() : "";
    let isNlpDetected = false;

    if (!categoryName || /^(umum|lain-lain|lainnya|uncategorized|-|transaksi|mutasi)$/i.test(categoryName)) {
      if (options.userCategories && options.userCategories.length > 0) {
        const detected = detectCategory(note, txType, options.userCategories);
        if (detected.matchedCategoryId) {
          const matched = options.userCategories.find((c) => c.id === detected.matchedCategoryId);
          if (matched) {
            categoryName = matched.name;
            isNlpDetected = true;
          }
        } else if (detected.categoryHint) {
          categoryName = detected.categoryHint;
          isNlpDetected = true;
        }
      }
    }

    if (!categoryName) {
      categoryName = txType === "income" ? "Gaji & Pendapatan" : "Umum";
    }

    if (txType === "income") totalIncome += amount;
    if (txType === "expense") totalExpense += amount;

    items.push({
      id: `univ-tx-${rIdx + 1}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      rowNumber: headerRowIndex + rIdx + 2,
      happenedAt: isoDate,
      txType,
      amount,
      categoryName,
      accountName,
      toAccountName: null,
      note,
      tags: [],
      isNlpDetected,
      sourceConfidence: "high",
    });
  }

  const confidence: "high" | "medium" | "low" =
    items.length > 0 && dateColIdx !== -1 && (isSeparateDebitCredit || singleAmountColIdx !== -1)
      ? "high"
      : items.length > 0
      ? "medium"
      : "low";

  return {
    items,
    headers: rawHeaders,
    headerRowIndex,
    detectedBank,
    confidence,
    isSeparateDebitCredit,
    totalIncome,
    totalExpense,
  };
}
