import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { accounts, categories, transactions, ledgers } from "../../db/schema";
import { eq, sql } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { getEffectiveGeminiKey, generateWithFallback } from "../../gemini";
import { cleanNumericAmount } from "@/lib/utils";
import zlib from "zlib";
import * as XLSX from "xlsx";
import { generateOpenRouterCompletion } from "../../openrouter";

function decodePdfHex(hex: string): string {
  const clean = hex.replace(/[\s\r\n]+/g, "");
  let out = "";
  if (clean.length >= 4 && clean.startsWith("00")) {
    for (let i = 0; i < clean.length; i += 4) {
      const code = parseInt(clean.slice(i, i + 4), 16);
      if (code >= 32 && code <= 126) out += String.fromCharCode(code);
      else if (code === 10 || code === 13) out += " ";
    }
    if (out.trim()) return out;
  }
  for (let i = 0; i < clean.length; i += 2) {
    const code = parseInt(clean.slice(i, i + 2), 16);
    if (code >= 32 && code <= 126) out += String.fromCharCode(code);
    else if (code === 10 || code === 13) out += " ";
  }
  return out;
}

/**
 * Ekstraktor teks digital dari file PDF tanpa binary eksternal
 */
export function extractTextFromPdfBuffer(pdfBuffer: Buffer): string {
  const binary = pdfBuffer.toString("binary");
  const textChunks: string[] = [];

  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(binary)) !== null) {
    const rawStream = Buffer.from(match[1], "binary");
    let decompressed: Buffer;
    try {
      decompressed = zlib.inflateSync(rawStream);
    } catch {
      try {
        decompressed = zlib.inflateRawSync(rawStream);
      } catch {
        decompressed = rawStream;
      }
    }

    const text = decompressed.toString("latin1");

    // 1. Literal text Tj: (text) Tj
    const tjRegex = /\(([^)]*)\)\s*(?:Tj|'|")/g;
    let tjMatch: RegExpExecArray | null;
    while ((tjMatch = tjRegex.exec(text)) !== null) {
      if (tjMatch[1]) textChunks.push(tjMatch[1]);
    }

    // 2. Hex text Tj: <hex> Tj
    const hexTjRegex = /<([0-9a-fA-F\s]+)>\s*(?:Tj|'|")/g;
    while ((tjMatch = hexTjRegex.exec(text)) !== null) {
      const decoded = decodePdfHex(tjMatch[1]);
      if (decoded.trim()) textChunks.push(decoded.trim());
    }

    // 3. Array TJ: [ (text) 10 <hex> ] TJ
    const arrayTjRegex = /\[(.*?)\]\s*TJ/g;
    let atjMatch: RegExpExecArray | null;
    while ((atjMatch = arrayTjRegex.exec(text)) !== null) {
      const parts = atjMatch[1].match(/\(([^)]*)\)/g);
      if (parts) {
        textChunks.push(parts.map((p) => p.slice(1, -1)).join(" "));
      }
      const hexParts = atjMatch[1].match(/<([0-9a-fA-F\s]+)>/g);
      if (hexParts) {
        textChunks.push(hexParts.map((h) => decodePdfHex(h.slice(1, -1))).join(" "));
      }
    }
  }

  if (textChunks.length === 0) {
    const directTj = /\(([^)]+)\)\s*(?:Tj|'|"|TJ)/g;
    let dMatch: RegExpExecArray | null;
    while ((dMatch = directTj.exec(binary)) !== null) {
      textChunks.push(dMatch[1]);
    }
    const directHex = /<([0-9a-fA-F\s]{4,})>\s*(?:Tj|'|"|TJ)/g;
    while ((dMatch = directHex.exec(binary)) !== null) {
      const decoded = decodePdfHex(dMatch[1]);
      if (decoded.trim()) textChunks.push(decoded.trim());
    }
  }

  return textChunks
    .map((t) => t.replace(/\\([()\\])/g, "$1").trim())
    .filter(Boolean)
    .join(" ");
}

export function fuzzyMatchAccount(rawName: string | undefined, userAccounts: { id: string; name: string }[]): string {
  if (!rawName || !rawName.trim()) {
    return userAccounts[0]?.name || "Kas Tunai";
  }
  const clean = rawName
    .toLowerCase()
    .replace(/\b(?:akun|rekening|rek|kartu|bank|dompet|saldo)\b/gi, "")
    .trim();

  // 1. Exact match
  const exact = userAccounts.find((a) => {
    const aName = a.name.toLowerCase().trim();
    return aName === clean || aName === rawName.toLowerCase().trim();
  });
  if (exact) return exact.name;

  // 2. Substring match
  const sub = userAccounts.find((a) => {
    const aName = a.name.toLowerCase().trim();
    return aName.includes(clean) || clean.includes(aName);
  });
  if (sub) return sub.name;

  // 3. Special direct alias for blu / blue
  if (clean === "blue" || clean === "blu" || clean.includes("blue") || clean.includes("blu")) {
    const bluMatch = userAccounts.find((a) => {
      const aName = a.name.toLowerCase();
      return (
        aName.includes("blu") ||
        aName.includes("blue") ||
        aName.includes("bca digital") ||
        aName === "blu"
      );
    });
    if (bluMatch) return bluMatch.name;
  }

  // 4. Known aliases in Indonesia
  const aliases: Record<string, string[]> = {
    blu: [
      "blue",
      "bca digital",
      "blubybcadigital",
      "blu bca",
      "blubca",
      "blu by bca digital",
      "kartu blu",
      "kartu blue",
    ],
    bca: ["bank central asia", "klikbca", "m-bca", "mbca", "tahapan bca"],
    mandiri: ["livin", "livin' by mandiri", "livin by mandiri", "bank mandiri"],
    bri: ["brimo", "bank rakyat indonesia", "bri mo"],
    bni: ["wondr", "bni mobile", "wondr by bni", "bank negara indonesia"],
    gopay: ["go-pay", "gojek", "gopay tabungan"],
    ovo: ["ovo cash"],
    dana: ["dompet dana", "e-wallet dana"],
    shopeepay: ["shopee pay", "spay", "shopee"],
    cash: ["tunai", "kas tunai", "dompet", "uang tunai", "kas", "fisik"],
    jago: ["bank jago", "kantong jago"],
    seabank: ["sea bank", "sea"],
    cimb: ["cimb niaga", "octo", "octo mobile", "octoclicks"],
    permata: ["permata bank", "permata me"],
    bsi: ["bank syariah indonesia", "bsi mobile"],
    danamon: ["bank danamon", "d-bank"],
    btn: ["bank tabungan negara", "btn mobile"],
    jenius: ["btpn", "bank btpn", "jenius btpn"],
    linkaja: ["link aja", "tcash"],
  };

  for (const [key, aliasList] of Object.entries(aliases)) {
    if (clean.includes(key) || aliasList.some((al) => clean.includes(al))) {
      const match = userAccounts.find((a) => {
        const aName = a.name.toLowerCase();
        return aName.includes(key) || aliasList.some((al) => aName.includes(al));
      });
      if (match) return match.name;
    }
  }

  // Fallback to rawName as is
  return rawName.trim();
}

import { CANONICAL_CATEGORY_MAP } from "@/lib/nlp-parser";

export function fuzzyMatchCategory(
  rawName: string | undefined,
  userCategories: { id: string; name: string; kind?: string }[]
): string {
  if (!rawName || !rawName.trim()) return "Umum";
  const clean = rawName.toLowerCase().trim();

  // 1. Exact match
  const exact = userCategories.find((c) => c.name.toLowerCase().trim() === clean);
  if (exact) return exact.name;

  // 2. Canonical dictionary match (e.g. "makanan & minuman" / "restoran" -> "Dining", "transport" -> "Transportasi")
  const canonicalName = CANONICAL_CATEGORY_MAP[clean];
  if (canonicalName) {
    const matchedCanonical = userCategories.find(
      (c) => c.name.toLowerCase().trim() === canonicalName.toLowerCase()
    );
    if (matchedCanonical) return matchedCanonical.name;
  }

  // 3. Substring match
  const sub = userCategories.find((c) => {
    const cName = c.name.toLowerCase().trim();
    return cName.includes(clean) || clean.includes(cName);
  });
  if (sub) return sub.name;

  // 4. Return raw name if no existing category matches, so new categories are preserved
  return rawName.trim();
}

export const importRouter = router({
  parseScreenshot: protectedProcedure
    .input(
      z.object({
        images: z
          .array(
            z.object({
              base64: z.string(),
              mimeType: z.string().default("image/jpeg"),
            })
          )
          .min(1)
          .max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const apiKey = await getEffectiveGeminiKey(ctx);

      const ai = new GoogleGenAI({ apiKey });

      // Ambil daftar akun & kategori user untuk kontekstualisasi prompt AI
      const userAccounts = await ctx.db
        .select({ id: accounts.id, name: accounts.name, group: accounts.group })
        .from(accounts)
        .where(eq(accounts.userId, ctx.userId));

      const userCategories = await ctx.db
        .select({ id: categories.id, name: categories.name, kind: categories.kind })
        .from(categories)
        .where(eq(categories.userId, ctx.userId));

      const allExtracted: Array<{
        txType: "expense" | "income" | "transfer";
        amount: number;
        happenedAt: string;
        categoryName: string;
        accountName: string;
        toAccountName?: string | null;
        note: string;
        sourceImageIndex: number;
      }> = [];

      const currentYear = new Date().getFullYear();
      const accountNamesStr = userAccounts.map((a) => a.name).join(", ") || "Kas Tunai, BCA, GoPay";
      const categoryNamesStr =
        userCategories.map((c) => c.name).join(", ") ||
        "Dining, Beverage, Snacks, Transportasi, Daily Goods, Shopping, Utilities, Saving, Family, Beauty, Health, Education, entertain, invest job, paylater, Salary, Part time, Allowance, Umum";

      for (let i = 0; i < input.images.length; i++) {
        const img = input.images[i];
        const cleanBase64 = img.base64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");

        const prompt = `Kamu adalah sistem OCR dan analisis transaksi keuangan profesional untuk aplikasi Fin.IQ di Indonesia.
Tugasmu adalah menganalisis gambar mutasi rekening, riwayat transaksi bank/e-wallet (seperti BCA, Mandiri, BRI, blu BCA, BNI, GoPay, OVO, DANA, ShopeePay, Jenius, Seabank, Jago), bukti transfer, atau foto struk belanja kasir fisik, lalu mengekstrak SEMUA data transaksi yang tertera di gambar menjadi format JSON array.

Daftar akun pengguna di aplikasi: ${accountNamesStr}.
Daftar kategori pengguna di aplikasi: ${categoryNamesStr}.

FORMAT OUTPUT:
Kembalikan HANYA JSON array dengan objek transaksi:
[
  {
    "txType": "expense" | "income" | "transfer",
    "amount": number,
    "happenedAt": "YYYY-MM-DDTHH:mm:ss",
    "categoryName": string,
    "accountName": string,
    "toAccountName": string | null,
    "note": string
  }
]

ATURAN EKSTRAKSI PENTING:
1. txType:
   - "expense": uang keluar, debit, tanda minus (-), pembayaran QRIS, belanja merchant, potongan biaya admin, transfer keluar.
   - "income": uang masuk, kredit, tanda plus (+), gaji, cashback, refund, transfer masuk yang diterima.
   - "transfer": perpindahan dana antar rekening atau top up e-wallet.
2. amount:
   - Angka nominal murni positif dalam Rupiah (integer / number), BUKAN string. Contoh: 50000, 125000.
   - PERHATIKAN FORMAT INDONESIA: Tanda titik (.) adalah pemisah ribuan (Rp 50.000 = 50000, Rp 1.500.000 = 1500000). Jangan membaca titik sebagai desimal!
3. happenedAt:
   - Format tanggal ISO 8601 string: "YYYY-MM-DDTHH:mm:ss".
   - Jika jam dan menit tertera di mutasi (misal 09:07 WIB), sertakan jam tersebut dalam format 24 jam. Jika jam tidak tertera, gunakan jam 12:00:00 ("YYYY-MM-DDT12:00:00").
   - Jika tahun tidak tertera di gambar, gunakan tahun ${currentYear}.
4. categoryName:
   - WAJIB pilih dan cocokkan HANYA dari salah satu daftar kategori pengguna berikut: [${categoryNamesStr}]. Jangan gunakan nama kategori di luar daftar tersebut.
5. accountName:
   - Nama bank atau e-wallet asal transaksi (misal: "blu", "BCA", "Mandiri", "GoPay", "DANA", "ShopeePay"). Utamakan yang ada di daftar akun pengguna.
6. toAccountName:
   - Jika transaksi transfer/top up, isi nama bank/e-wallet/penerima tujuan. Jika bukan transfer, isi null.
7. note:
   - Keterangan ringkas transaksi, nama merchant, atau nama penerima/pengirim (misal: "Kopi Kenangan", "Transfer ke Budi", "Indomaret", "PLN Pascabayar", "Gaji Bulanan").
8. Jika gambar adalah struk belanja fisik (misal Alfamart, Indomaret, restoran):
   - Ambil Total Belanja akhir sebagai 1 transaksi expense.
   - Isi note dengan nama toko/merchant.
9. Jika TIDAK ADA transaksi yang ditemukan di gambar, kembalikan array kosong [].`;

        try {
          const response = await generateWithFallback(ai, {
            preferredModels: ["gemini-3-flash-preview", "gemini-3.8-flash"],
            contents: [
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: img.mimeType || "image/jpeg",
                },
              },
              {
                text: prompt,
              },
            ],
            config: {
              responseMimeType: "application/json",
            },
          });

          const rawText = response.text || "[]";
          const jsonStr = rawText
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();

          let parsedItems: any[] = [];
          try {
            const parsed = JSON.parse(jsonStr);
            parsedItems = Array.isArray(parsed) ? parsed : [parsed];
          } catch (jsonErr) {
            console.error("Gagal parse output JSON Gemini:", rawText, jsonErr);
            continue;
          }

          for (const item of parsedItems) {
            const rawAmount = cleanNumericAmount(item.amount);
            if (rawAmount <= 0) continue;

            const txType: "expense" | "income" | "transfer" =
              item.txType === "income" || item.txType === "transfer" ? item.txType : "expense";

            let happenedAtStr = item.happenedAt;
            if (!happenedAtStr || isNaN(new Date(happenedAtStr).getTime())) {
              happenedAtStr = new Date().toISOString();
            }

            const matchedAccName = fuzzyMatchAccount(item.accountName, userAccounts);
            const matchedToAccName =
              txType === "transfer" && item.toAccountName
                ? fuzzyMatchAccount(item.toAccountName, userAccounts)
                : item.toAccountName || null;
            const matchedCatName = fuzzyMatchCategory(item.categoryName, userCategories);

            allExtracted.push({
              txType,
              amount: Math.round(rawAmount),
              happenedAt: happenedAtStr,
              categoryName: matchedCatName,
              accountName: matchedAccName,
              toAccountName: matchedToAccName,
              note: (item.note || "").trim() || "Transaksi Screenshot",
              sourceImageIndex: i,
            });
          }
        } catch (genErr: any) {
          console.error(`Error memproses gambar ${i + 1} dengan Gemini:`, genErr);
          const errMsg = genErr?.message || String(genErr);
          if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
            throw new TRPCError({
              code: "TOO_MANY_REQUESTS",
              message: "Batas permintaan Gemini AI tercapai (Rate Limit). Silakan tunggu 1 menit lalu coba lagi.",
            });
          }
          if (errMsg.includes("API_KEY_INVALID") || errMsg.includes("INVALID_ARGUMENT") || errMsg.includes("API key not valid")) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "API Key Gemini tidak valid. Silakan periksa kembali GEMINI_API_KEY di .env.local.",
            });
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Gagal membaca screenshot: ${errMsg}`,
          });
        }
      }

      return {
        transactions: allExtracted,
        imageCount: input.images.length,
      };
    }),

  convertAnyDocument: protectedProcedure
    .input(
      z.object({
        fileBase64: z.string().optional(),
        fileText: z.string().optional(),
        fileName: z.string(),
        mimeType: z.string().default("text/plain"),
        defaultAccountId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userAccounts = await ctx.db
        .select({ id: accounts.id, name: accounts.name, group: accounts.group })
        .from(accounts)
        .where(eq(accounts.userId, ctx.userId));

      const userCategories = await ctx.db
        .select({ id: categories.id, name: categories.name, kind: categories.kind })
        .from(categories)
        .where(eq(categories.userId, ctx.userId));

      const accountNamesStr = userAccounts.map((a) => a.name).join(", ") || "Kas Tunai, BCA, GoPay";
      const categoryNamesStr =
        userCategories.map((c) => c.name).join(", ") ||
        "Umum, Makanan & Minuman, Transportasi, Belanja, Tagihan & Utilitas, Gaji & Pendapatan";

      const defaultAccountName = input.defaultAccountId
        ? userAccounts.find((a) => a.id === input.defaultAccountId)?.name
        : undefined;

      let cleanBase64 = (input.fileBase64 || "").replace(/^data:[a-zA-Z0-9.\/+-]+;base64,/, "");
      if (!cleanBase64 && input.fileText) {
        cleanBase64 = Buffer.from(input.fileText, "utf-8").toString("base64");
      }
      const currentYear = new Date().getFullYear();
      const isPdf =
        input.mimeType === "application/pdf" ||
        input.fileName.toLowerCase().endsWith(".pdf");
      const isExcel =
        input.fileName.toLowerCase().endsWith(".xlsx") ||
        input.fileName.toLowerCase().endsWith(".xls") ||
        input.mimeType.includes("spreadsheet") ||
        input.mimeType.includes("excel");

      // Ekstraksi teks dari berbagai tipe dokumen (PDF, Excel, CSV, Teks)
      let extractedDocText = "";

      if (isPdf && cleanBase64) {
        try {
          const pdfBuf = Buffer.from(cleanBase64, "base64");
          extractedDocText = extractTextFromPdfBuffer(pdfBuf);
        } catch (pdfErr) {
          console.warn("[convertAnyDocument] Gagal ekstraksi teks PDF lokal:", pdfErr);
        }
      } else if (isExcel && cleanBase64) {
        try {
          const excelBuf = Buffer.from(cleanBase64, "base64");
          const wb = XLSX.read(excelBuf, { type: "buffer" });
          const sheetsCsv: string[] = [];
          for (const sheetName of wb.SheetNames) {
            const sheet = wb.Sheets[sheetName];
            if (sheet) {
              sheetsCsv.push(`=== Sheet: ${sheetName} ===\n` + XLSX.utils.sheet_to_csv(sheet));
            }
          }
          extractedDocText = sheetsCsv.join("\n\n");
        } catch (excelErr) {
          console.warn("[convertAnyDocument] Gagal ekstraksi teks Excel:", excelErr);
        }
      }

      if (!extractedDocText) {
        if (input.fileText) {
          extractedDocText = input.fileText;
        } else if (cleanBase64) {
          try {
            extractedDocText = Buffer.from(cleanBase64, "base64").toString("utf-8");
          } catch {
            extractedDocText = cleanBase64;
          }
        }
      }

      const promptInstructions = `Kamu adalah sistem analisis dokumen keuangan dan konversi mutasi transaksi profesional untuk aplikasi Fin.IQ di Indonesia.
Tugasmu adalah menganalisis dokumen atau file mutasi keuangan yang diunggah (${input.fileName}) dengan template/format APAPUN (BCA, Mandiri Livin', BRImo, BNI, e-wallet, Jenius, rekening koran bank internasional, CSV acak, atau spreadsheet pengguna), lalu mengekstrak SELURUH baris data transaksi ke dalam format JSON standar Fin.IQ.

Daftar akun/rekening pengguna: [${accountNamesStr}].
Daftar kategori pengguna: [${categoryNamesStr}].
${defaultAccountName ? `Rekening default jika di dokumen tidak disebutkan: "${defaultAccountName}".` : ""}

ATURAN KONVERSI DOKUMEN:
1. Analisis struktur tabel dokumen:
   - Jika dokumen memiliki kolom Debit dan Kredit terpisah: Baris dengan nilai di Debit = "expense", baris dengan nilai di Kredit = "income".
   - Jika mutasi mencantumkan suffix "DB" (Debit) / "CR" (Kredit): DB = "expense", CR = "income".
   - Jika mutasi menggunakan minus (-) untuk pengeluaran: jadikan "expense" dengan amount positif.
   - Abaikan baris saldo awal, saldo akhir, total mutasi, atau header/footer laporan.
2. Nominal (amount):
   - Angka integer positif murni dalam Rupiah. Format Indonesia (titik sebagai pemisah ribuan) harus dibersihkan menjadi integer murni (contoh: "Rp 150.000,00" -> 150000).
3. Tanggal (happenedAt):
   - Format ISO 8601 string: "YYYY-MM-DDTHH:mm:ss".
   - Jika hanya ada tanggal tanpa jam, gunakan jam 12:00:00 ("YYYY-MM-DDT12:00:00").
   - Jika tanpa tahun, gunakan tahun ${currentYear}.
4. Kategori (categoryName):
   - Cocokkan dengan salah satu dari [${categoryNamesStr}] berdasarkan deskripsi/merchant transaksi.
5. Akun (accountName):
   - Jika di dokumen tertera nama bank/rekening (misal BCA, Mandiri, GoPay), gunakan nama tersebut atau cocokkan ke akun user. Jika tidak ada, gunakan ${
     defaultAccountName ? `"${defaultAccountName}"` : `akun user yang paling sesuai atau pertama`
   }.
6. Keterangan (note):
   - Bersihkan dan ambil rincian transaksi / nama merchant / keterangan mutasi secara ringkas dan informatif.

FORMAT OUTPUT:
Kembalikan HANYA objek JSON dengan format seperti ini:
{
  "detectedBank": "BCA / Bank Mandiri / dll (atau null)",
  "transactions": [
    {
      "txType": "expense" | "income" | "transfer",
      "amount": number,
      "happenedAt": "YYYY-MM-DDTHH:mm:ss",
      "categoryName": string,
      "accountName": string,
      "toAccountName": string | null,
      "note": string
    }
  ]
}`;

      let rawText = "";
      let modelUsedName = "";

      // 1. Prioritaskan Model OpenRouter untuk import PDF / Excel
      try {
        const docSnippet = extractedDocText ? extractedDocText.slice(0, 50000) : "";
        if (!docSnippet && isPdf) {
          throw new Error("Teks digital PDF kosong, mencoba fallback Gemini Vision/PDF.");
        }

        const openRouterRes = await generateOpenRouterCompletion({
          systemPrompt: promptInstructions,
          userPrompt: `Berikut adalah dokumen mutasi keuangan dari file "${input.fileName}" yang harus dikonversi ke format JSON Fin.IQ:\n\n=== ISI DOKUMEN ===\n${docSnippet || cleanBase64.slice(0, 50000)}\n\nIngat: HANYA kembalikan JSON valid sesuai struktur tanpa komentar Markdown atau teks pembuka.`,
          temperature: 0.1,
        });

        rawText = openRouterRes.text;
        modelUsedName = openRouterRes.modelUsed;
      } catch (openRouterErr: any) {
        console.warn("[convertAnyDocument] OpenRouter error, falling back to Gemini:", openRouterErr?.message);

        // 2. Fallback aman ke Google Gemini jika OpenRouter rate limited atau dokumen PDF scan murni
        try {
          const apiKey = await getEffectiveGeminiKey(ctx);
          const ai = new GoogleGenAI({ apiKey });

          let promptContent: any[] = [];
          if (isPdf && cleanBase64) {
            promptContent = [
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: "application/pdf",
                },
              },
              { text: promptInstructions },
            ];
          } else {
            promptContent = [
              {
                text: `${promptInstructions}\n\n=== ISI DOKUMEN (${input.fileName}) ===\n${(extractedDocText || cleanBase64).slice(0, 60000)}`,
              },
            ];
          }

          const geminiRes = await generateWithFallback(ai, {
            preferredModels: ["gemini-3-flash-preview", "gemini-3.8-flash"],
            contents: promptContent,
            config: {
              responseMimeType: "application/json",
            },
          });

          rawText = geminiRes.text || "{}";
          modelUsedName = "Google Gemini (Fallback)";
        } catch (geminiErr: any) {
          console.error("[convertAnyDocument] Both OpenRouter and Gemini failed:", geminiErr);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Gagal membaca dokumen dengan AI (OpenRouter & Gemini): ${openRouterErr?.message || geminiErr?.message}`,
          });
        }
      }

      try {
        const jsonStr = rawText
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();

        let parsedResult: any = {};
        try {
          parsedResult = JSON.parse(jsonStr);
        } catch (jsonErr) {
          const matchBraces = jsonStr.match(/\{[\s\S]*\}/);
          if (matchBraces) {
            try {
              parsedResult = JSON.parse(matchBraces[0]);
            } catch {
              // ignore
            }
          }
          if (!parsedResult || typeof parsedResult !== "object") {
            console.error("Gagal parse JSON converter:", rawText, jsonErr);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Format jawaban AI tidak dapat dibaca sebagai JSON valid.",
            });
          }
        }

        const rawList = Array.isArray(parsedResult)
          ? parsedResult
          : Array.isArray(parsedResult.transactions)
          ? parsedResult.transactions
          : [];

        const normalizedTxs: Array<{
          id: string;
          txType: "expense" | "income" | "transfer";
          amount: number;
          happenedAt: string;
          categoryName: string;
          accountName: string;
          toAccountName?: string | null;
          note: string;
        }> = [];

        for (let idx = 0; idx < rawList.length; idx++) {
          const item = rawList[idx];
          const rawAmount = cleanNumericAmount(item.amount);
          if (rawAmount <= 0) continue;

          const txType: "expense" | "income" | "transfer" =
            item.txType === "income" || item.txType === "transfer" ? item.txType : "expense";

          let happenedAtStr = item.happenedAt;
          if (!happenedAtStr || isNaN(new Date(happenedAtStr).getTime())) {
            happenedAtStr = new Date().toISOString();
          }

          const matchedAccName = fuzzyMatchAccount(
            item.accountName || defaultAccountName,
            userAccounts
          );
          const matchedToAccName =
            txType === "transfer" && item.toAccountName
              ? fuzzyMatchAccount(item.toAccountName, userAccounts)
              : item.toAccountName || null;
          const matchedCatName = fuzzyMatchCategory(item.categoryName, userCategories);

          normalizedTxs.push({
            id: `ai-conv-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            txType,
            amount: Math.round(rawAmount),
            happenedAt: happenedAtStr,
            categoryName: matchedCatName,
            accountName: matchedAccName,
            toAccountName: matchedToAccName,
            note: (item.note || "").trim() || "Transaksi Impor Dokumen",
          });
        }

        return {
          transactions: normalizedTxs,
          detectedBank: parsedResult.detectedBank || null,
          totalCount: normalizedTxs.length,
          modelUsed: modelUsedName,
        };
      } catch (postErr: any) {
        if (postErr instanceof TRPCError) throw postErr;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Gagal memproses hasil konversi: ${postErr?.message || postErr}`,
        });
      }
    }),

  executeBatch: protectedProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            txType: z.enum(["expense", "income", "transfer"]),
            amount: z.number().positive(),
            happenedAt: z.string(),
            categoryName: z.string(),
            accountName: z.string(),
            toAccountName: z.string().nullable().optional(),
            note: z.string().optional(),
            tags: z.array(z.string()).optional(),
          })
        ),
        targetLedgerId: z.string().optional(),
        defaultAccountId: z.string().optional(),
        dedupStrategy: z.enum(["skip_duplicates", "insert_all"]).default("skip_duplicates"),
        autoTag: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Resolve target ledger
      let targetLedgerId = input.targetLedgerId;
      if (!targetLedgerId) {
        const existingLedgers = await ctx.db
          .select()
          .from(ledgers)
          .where(eq(ledgers.userId, ctx.userId))
          .limit(1);

        if (existingLedgers.length > 0) {
          targetLedgerId = existingLedgers[0].id;
        } else {
          const newLedgerId = crypto.randomUUID();
          await ctx.db.insert(ledgers).values({
            id: newLedgerId,
            userId: ctx.userId,
            name: "Buku Kas Utama",
            currency: "IDR",
            monthStartDay: 1,
          });
          targetLedgerId = newLedgerId;
        }
      }

      // 2. Cache user accounts
      const userAccounts = await ctx.db.select().from(accounts).where(eq(accounts.userId, ctx.userId));
      const accountMap = new Map<string, any>();
      for (const a of userAccounts) {
        accountMap.set(a.name.toLowerCase().trim(), a);
        accountMap.set(a.id, a);
      }

      let defaultAccount = userAccounts[0];
      if (input.defaultAccountId) {
        const found = userAccounts.find((a) => a.id === input.defaultAccountId);
        if (found) defaultAccount = found;
      }

      if (!defaultAccount) {
        const newAccId = crypto.randomUUID();
        const initialAcc = {
          id: newAccId,
          userId: ctx.userId,
          name: "Kas Tunai",
          group: "Cash",
          currency: "IDR",
          initialBalance: 0,
          balance: 0,
        };
        await ctx.db.insert(accounts).values(initialAcc);
        defaultAccount = initialAcc as any;
        accountMap.set("kas tunai", initialAcc);
        accountMap.set("cash", initialAcc);
        accountMap.set(newAccId, initialAcc);
      }

      // 3. Cache user categories
      const userCategories = await ctx.db.select().from(categories).where(eq(categories.userId, ctx.userId));
      const categoryMap = new Map<string, any>();
      for (const c of userCategories) {
        categoryMap.set(c.name.toLowerCase().trim(), c);
        categoryMap.set(c.id, c);
      }

      // 4. Deduplication timestamps
      const existingTxTimestamps = new Set<string>();
      if (input.dedupStrategy === "skip_duplicates") {
        const existingTx = await ctx.db
          .select({
            happenedAt: transactions.happenedAt,
            amount: transactions.amount,
            accountId: transactions.accountId,
          })
          .from(transactions)
          .where(eq(transactions.userId, ctx.userId));

        for (const t of existingTx) {
          const key = `${new Date(t.happenedAt).getTime()}_${t.amount}_${t.accountId}`;
          existingTxTimestamps.add(key);
        }
      }

      const accountsCreated: string[] = [];
      const categoriesCreated: string[] = [];
      const txToInsert: any[] = [];
      let skippedCount = 0;
      const balanceDeltas = new Map<string, number>();

      for (const item of input.items) {
        const rawDateObj = new Date(item.happenedAt);
        const happenedAtDate = isNaN(rawDateObj.getTime()) ? new Date() : rawDateObj;

        // Category resolution
        const rawCat = item.categoryName ? item.categoryName.trim() : "";
        const cleanCatName =
          rawCat
            .replace(/\s*[\(（][\u4e00-\u9fa5\s]+[\)）]/g, "")
            .replace(/[\u4e00-\u9fa5]+/g, "")
            .trim();

        let matchedCat = null;
        if (cleanCatName) {
          // 1. Direct or cached match
          matchedCat = categoryMap.get(cleanCatName.toLowerCase()) || categoryMap.get(cleanCatName);

          // 2. Fuzzy match against existing categories (only if cleanCatName is not deliberately new)
          if (!matchedCat) {
            const resolvedName = fuzzyMatchCategory(cleanCatName, userCategories);
            if (resolvedName && resolvedName.toLowerCase() !== cleanCatName.toLowerCase()) {
              matchedCat = categoryMap.get(resolvedName.toLowerCase()) || categoryMap.get(resolvedName);
            }
          }
        }

        // 3. If not matched, check if it's a new custom category (not empty or generic 'umum')
        const isGenericCat = !cleanCatName || /^(umum|uncategorized|lainnya|lain-lain|-)$/i.test(cleanCatName);
        if (!matchedCat && !isGenericCat) {
          const newCatId = crypto.randomUUID();
          const newCat = {
            id: newCatId,
            userId: ctx.userId,
            name: cleanCatName,
            kind: item.txType === "income" ? ("income" as const) : ("expense" as const),
            icon: item.txType === "income" ? "TrendingUp" : "Receipt",
          };
          await ctx.db.insert(categories).values(newCat);
          matchedCat = newCat;
          categoryMap.set(cleanCatName.toLowerCase(), newCat);
          categoryMap.set(cleanCatName, newCat);
          categoryMap.set(newCatId, newCat);
          userCategories.push(newCat as any);
          if (!categoriesCreated.includes(cleanCatName)) {
            categoriesCreated.push(cleanCatName);
          }
        } else if (!matchedCat) {
          // Fallback to default user category only if generic or empty
          const fallbackCat = userCategories.find(
            (c) => c.kind === (item.txType === "income" ? "income" : "expense")
          ) || userCategories[0];
          matchedCat = fallbackCat;
        }

        // Account resolution
        const accName = item.accountName ? item.accountName.trim() : "";
        let matchedAccount = null;

        if (accName) {
          // 1. Direct or cached match
          matchedAccount =
            accountMap.get(accName.toLowerCase()) ||
            accountMap.get(accName);

          // 2. Fuzzy alias match only if mapped to an existing user account
          if (!matchedAccount) {
            const fuzzyName = fuzzyMatchAccount(accName, userAccounts);
            if (fuzzyName && fuzzyName.toLowerCase() !== accName.toLowerCase()) {
              matchedAccount = accountMap.get(fuzzyName.toLowerCase()) || accountMap.get(fuzzyName);
            }
          }
        }

        // 3. If account not found in user's accounts, and a valid account name was provided:
        // CREATE THE NEW ACCOUNT!
        const isGenericAcc = !accName || /^(kas tunai|cash|tunai|dompet|-)$/i.test(accName);
        if (!matchedAccount && !isGenericAcc) {
          const groupName = /(bank|bca|mandiri|bni|bri|cimb|jago|seabank|bsi|permata|danamon|btn|panin|mega)/i.test(accName)
            ? "Bank card"
            : /(gopay|ovo|dana|shopee|spay|linkaja|wallet|dompet)/i.test(accName)
            ? "E-Wallet"
            : "Cash";

          const newAccId = crypto.randomUUID();
          const newAcc = {
            id: newAccId,
            userId: ctx.userId,
            name: accName,
            group: groupName,
            currency: "IDR",
            initialBalance: 0,
            balance: 0,
          };
          await ctx.db.insert(accounts).values(newAcc);
          matchedAccount = newAcc;
          accountMap.set(accName.toLowerCase(), newAcc);
          accountMap.set(accName, newAcc);
          accountMap.set(newAccId, newAcc);
          userAccounts.push(newAcc as any);
          if (!accountsCreated.includes(accName)) {
            accountsCreated.push(accName);
          }
        } else if (!matchedAccount) {
          matchedAccount = defaultAccount;
        }

        // To Account for transfer
        let matchedToAccount = null;
        if (item.txType === "transfer" && item.toAccountName) {
          const toName = item.toAccountName.trim();
          matchedToAccount = accountMap.get(toName.toLowerCase()) || accountMap.get(toName);
          if (!matchedToAccount) {
            const fuzzyTo = fuzzyMatchAccount(toName, userAccounts);
            if (fuzzyTo && fuzzyTo.toLowerCase() !== toName.toLowerCase()) {
              matchedToAccount = accountMap.get(fuzzyTo.toLowerCase()) || accountMap.get(fuzzyTo);
            }
          }

          if (!matchedToAccount && toName) {
            const groupName = /(bank|bca|mandiri|bni|bri|cimb|jago|seabank|bsi|permata|danamon|btn|panin|mega)/i.test(toName)
              ? "Bank card"
              : /(gopay|ovo|dana|shopee|spay|linkaja|wallet|dompet)/i.test(toName)
              ? "E-Wallet"
              : "Cash";

            const newToAccId = crypto.randomUUID();
            const newToAcc = {
              id: newToAccId,
              userId: ctx.userId,
              name: toName,
              group: groupName,
              currency: "IDR",
              initialBalance: 0,
              balance: 0,
            };
            await ctx.db.insert(accounts).values(newToAcc);
            matchedToAccount = newToAcc;
            accountMap.set(toName.toLowerCase(), newToAcc);
            accountMap.set(toName, newToAcc);
            accountMap.set(newToAccId, newToAcc);
            userAccounts.push(newToAcc as any);
            if (!accountsCreated.includes(toName)) {
              accountsCreated.push(toName);
            }
          }
        }

        // Dedup check
        if (input.dedupStrategy === "skip_duplicates") {
          const dedupKey = `${happenedAtDate.getTime()}_${item.amount}_${matchedAccount.id}`;
          if (existingTxTimestamps.has(dedupKey)) {
            skippedCount++;
            continue;
          }
          existingTxTimestamps.add(dedupKey);
        }

        const tagsList = [...(item.tags || [])];
        if (input.autoTag && input.autoTag.trim()) {
          tagsList.push(input.autoTag.trim());
        }

        txToInsert.push({
          id: crypto.randomUUID(),
          userId: ctx.userId,
          ledgerId: targetLedgerId,
          accountId: matchedAccount.id,
          toAccountId: matchedToAccount?.id || null,
          categoryId: matchedCat.id,
          txType: item.txType,
          amount: item.amount,
          nativeAmount: item.amount,
          currency: matchedAccount.currency || "IDR",
          happenedAt: happenedAtDate,
          note: item.note || null,
          tagsJson: tagsList,
          createdAt: new Date(),
        });

        // Track balance delta
        if (item.txType === "expense") {
          balanceDeltas.set(matchedAccount.id, (balanceDeltas.get(matchedAccount.id) || 0) - item.amount);
        } else if (item.txType === "income") {
          balanceDeltas.set(matchedAccount.id, (balanceDeltas.get(matchedAccount.id) || 0) + item.amount);
        } else if (item.txType === "transfer" && matchedToAccount) {
          balanceDeltas.set(matchedAccount.id, (balanceDeltas.get(matchedAccount.id) || 0) - item.amount);
          balanceDeltas.set(matchedToAccount.id, (balanceDeltas.get(matchedToAccount.id) || 0) + item.amount);
        }
      }

      // Batch insert transactions in chunks of 200
      const chunkSize = 200;
      for (let i = 0; i < txToInsert.length; i += chunkSize) {
        const chunk = txToInsert.slice(i, i + chunkSize);
        if (chunk.length > 0) {
          await ctx.db.insert(transactions).values(chunk);
        }
      }

      // Update balances
      for (const [accId, delta] of balanceDeltas.entries()) {
        if (delta !== 0) {
          await ctx.db
            .update(accounts)
            .set({
              balance: sql`${accounts.balance} + ${delta}`,
              updatedAt: new Date(),
            })
            .where(eq(accounts.id, accId));
        }
      }

      return {
        success: true,
        createdCount: txToInsert.length,
        skippedCount,
        accountsCreated,
        categoriesCreated,
      };
    }),
});
