import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  personalAccessTokens,
  mcpCallLogs,
  accounts,
  categories,
  userProfiles,
  transactions,
  aiPromptHistory,
  aiChatSessions,
  aiChatMessages,
} from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { buildUserFinancialTelemetry, generateTelemetryFinancialAnswer } from "../../ai-telemetry";
import { GoogleGenAI } from "@google/genai";
import {
  smartParseIndonesianTransaction,
  cleanSpeechToNote,
  detectAccount,
  parseMultipleItemsAndAmounts,
  deduplicateTranscript,
} from "@/lib/nlp-parser";
import { fuzzyMatchAccount, fuzzyMatchCategory } from "./import";
import { formatInputIDR, formatDate, cleanNumericAmount } from "@/lib/utils";
import {
  GEMINI_AUDIO_MODEL,
  GEMINI_VISION_MODEL,
  generateWithFallback,
  getEffectiveGeminiKey,
  DEFAULT_GEMINI_API_KEY,
} from "../../gemini";
import {
  OPENROUTER_FREE_MODELS,
  DEFAULT_MODEL_ID,
  getAiQuota,
  consumeAiQuota,
  checkFinancialGuardrail,
  generateOpenRouterCompletion,
  GUARDRAIL_REFUSAL_MESSAGE,
} from "../../openrouter";

export const aiRouter = router({
  parseTextToTransaction: protectedProcedure
    .input(z.object({ text: z.string().min(2), clientTime: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      // Ambil akun dan kategori milik user untuk pencocokan kontekstual
      const userAccounts = await ctx.db
        .select({ id: accounts.id, name: accounts.name, group: accounts.group })
        .from(accounts)
        .where(eq(accounts.userId, ctx.userId));

      const userCategories = await ctx.db
        .select({
          id: categories.id,
          name: categories.name,
          kind: categories.kind,
          parentId: categories.parentId,
        })
        .from(categories)
        .where(eq(categories.userId, ctx.userId));

      const cleanText = deduplicateTranscript(input.text);
      const result = smartParseIndonesianTransaction(cleanText, {
        accounts: userAccounts,
        categories: userCategories,
        referenceDate: input.clientTime ? new Date(input.clientTime) : new Date(),
      });

      return {
        ...result,
        happenedAt: result.happenedAt ? result.happenedAt.toISOString() : (input.clientTime || new Date().toISOString()),
        happenedAtFormatted: result.happenedAtFormatted || undefined,
        usedGemini: false,
      };
    }),

  parseAudioWithGemini: protectedProcedure
    .input(
      z.object({
        audioBase64: z.string().optional(),
        mimeType: z.string().default("audio/webm"),
        transcript: z.string().optional(),
        clientTime: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userAccounts = await ctx.db
        .select({ id: accounts.id, name: accounts.name, group: accounts.group })
        .from(accounts)
        .where(eq(accounts.userId, ctx.userId));

      const userCategories = await ctx.db
        .select({
          id: categories.id,
          name: categories.name,
          kind: categories.kind,
          parentId: categories.parentId,
        })
        .from(categories)
        .where(eq(categories.userId, ctx.userId));

      const rawSpeech = deduplicateTranscript(input.transcript?.trim() || "");

      // 1. Panggil Gemini 2.5 Flash Native Audio
      try {
        const apiKey = await getEffectiveGeminiKey(ctx);
        const ai = new GoogleGenAI({ apiKey });

        const accountNamesStr = userAccounts.map((a) => a.name).join(", ") || "Kas Tunai, Rekening BCA, GoPay";
        const categoryNamesStr =
          userCategories.map((c) => c.name).join(", ") ||
          "Dining, Beverage, Snacks, Transportasi, Daily Goods, Shopping, Utilities, Saving, Family, Beauty, Health, Education, entertain, paylater, Umum";

        const clientDate = input.clientTime ? new Date(input.clientTime) : new Date();
        const clientDateStr = clientDate.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

        const prompt = `Kamu adalah asisten AI keuangan cerdas Bahasa Indonesia untuk Fin.IQ.
Tugasmu adalah menganalisis ucapan pengguna (melalui rekaman audio native dan/atau transkripsi) untuk mengekstrak detail transaksi finansial.
Model AI: Gemini 2.5 Flash Native Audio Dialog.
Pengguna berbicara dalam BAHASA INDONESIA (bisa santai, bahasa gaul, atau formal).

SANGAT PENTING - ATURAN BAHASA & KATA:
- DILARANG MENERJEMAHKAN KE BAHASA INGGRIS. JANGAN PERNAH menerjemahkan ucapan pengguna ke Bahasa Inggris (contoh: JANGAN ubah "beli kopi" menjadi "buy coffee", JANGAN ubah "nasi padang" menjadi "padang rice", JANGAN ubah "bensin" menjadi "gasoline", JANGAN ubah "makan" menjadi "dining").
- "note" WAJIB menggunakan KATA ASLI APA ADANYA dari apa yang diucapkan pengguna dalam Bahasa Indonesia, cukup buang nominal harga, nama akun/metode bayar, dan kata instruksi/waktu. Contoh:
  - "Saya baru beli kopi dengan nominal Rp 30.000 pada waktu saat ini dengan akun blue" -> "Beli kopi"
  - "beli nasi padang 25rb pake blue" -> "Beli nasi padang"
  - "transfer ke dana 50rb dari akun blue" -> "Transfer ke Dana"
  - "top up gopay 100rb dari blu" -> "Top up GoPay"
  - "tj transportasi 3500" -> "Tj transportasi"
  - "allowance 135 rb" -> "Allowance"
  - "bensin pertamax 50rb pake cash" -> "Bensin pertamax"
- Jangan pernah mengubah nama makanan, barang, atau jasa menjadi bahasa Inggris!
- PEMBERSIHAN KATA BERULANG / REDUNDAN (GLITCH MIKROFON):
  Jika rekaman atau transkripsi terdengar pengulangan kata akibat glitch mikrofon (misal: "kopi kopi kopi", "beli beli", "bca bca", "50rb 50rb"), kamu WAJIB membersihkannya menjadi satu kata saja ("Beli kopi"). Tetap pertahankan kata ulang sah dalam Bahasa Indonesia seperti "oleh-oleh", "jalan-jalan", "hati-hati", "gado-gado", "cumi-cumi".

Konteks pengguna:
- Waktu saat ini: ${clientDateStr}
- Akun yang dimiliki pengguna di Fin.IQ: [${accountNamesStr}]
- Kategori yang dimiliki pengguna di Fin.IQ: [${categoryNamesStr}]
${rawSpeech ? `- Transkripsi teks apa adanya dari pengguna: "${rawSpeech}"` : ""}

TUGAS EKSTRAKSI:
Ekstrak transaksi dan kembalikan HANYA JSON valid dengan struktur:
{
  "txType": "expense" | "income" | "transfer",
  "amount": number,
  "note": string,
  "accountHint": string,
  "toAccountHint": string,
  "categoryHint": string,
  "isNewCategory": boolean,
  "suggestedParentCategory": string,
  "happenedAtIso": string or null,
  "isMultipleItems": boolean,
  "items": [
    {
      "name": string,
      "amount": number
    }
  ]
}

ATURAN DETAIL:
1. "amount": Angka bulat integer Rupiah (misal 50.000 -> 50000, 2.5jt -> 2500000, goban -> 50000, goceng -> 5000). Jika tidak ada angka, isi 0.
   SANGAT PENTING - TRANSAKSI MULTI-ITEM / BEBERAPA TRANSAKSI DALAM 1 UCAPAN:
   Jika pengguna menyebutkan 2 ATAU LEBIH item/transaksi (misal: "beli kopi dan nasi goreng 3 ribu dan 5 ribu", "kopi 3rb nasi goreng 5rb", "bensin 50rb dan makan siang 35rb"):
   - "amount" WAJIB MERUPAKAN HASIL PENJUMLAHAN DARI SEMUA NOMINAL TERSEBUT! (contoh: 3.000 + 5.000 = 8000).
   - "note" WAJIB MENULISKAN SEMUA 2 ATAU LEBIH ITEM TERSEBUT BESERTA NOMINALNYA (contoh: "Kopi (Rp 3.000), Nasi goreng (Rp 5.000)").
   - "isMultipleItems": true
   - "items": Masukkan rincian setiap item dan harganya, misal: [ { "name": "Kopi", "amount": 3000 }, { "name": "Nasi goreng", "amount": 5000 } ].
2. "txType":
   - "expense": pengeluaran/belanja/makan/beli barang/tagihan/bensin.
   - "income": pemasukan/gaji/angpao/hadiah/cuan/bonus/kiriman.
   - "transfer": transfer saldo/geser uang antar rekening/top up e-wallet dari bank.
3. "note": Ringkasan rapi dalam BAHASA INDONESIA sesuai kata yang diucapkan pengguna tanpa kata instruksi pembuka/waktu/akun. DILARANG MENERJEMAHKAN KE BAHASA INGGRIS!
4. "accountHint": Nama akun sumber yang paling sesuai dari daftar pengguna: [${accountNamesStr}]. Catatan: jika pengguna menyebut "blue" atau "blu" atau "bca digital", cocokkan dengan akun Blu atau BCA.
5. "toAccountHint": Jika transfer, nama akun tujuan dari daftar [${accountNamesStr}]. Jika bukan transfer, isi string kosong "".
6. "categoryHint" & "isNewCategory":
   - Jika transaksinya cocok dengan salah satu kategori yang sudah ada di [${categoryNamesStr}], gunakan nama kategori tersebut dan set "isNewCategory": false.
   - Jika belum ada kategori yang pas di daftar pengguna, berikan nama kategori baru yang spesifik & rapi dan set "isNewCategory": true.
7. "suggestedParentCategory": Kategori induk yang cocok jika "isNewCategory" bernilai true.
8. "happenedAtIso": Jika pengguna menyebutkan waktu khusus, konversikan ke format ISO 8601 (YYYY-MM-DDTHH:mm:ss). Jika tidak menyebutkan waktu, isi null.
9. Format jawaban WAJIB HANYA JSON murni tanpa markdown wrapping (\`\`\`json).`;

        const contents: any[] = [];
        if (input.audioBase64) {
          const cleanAudioBase64 = input.audioBase64.replace(/^data:audio\/[a-zA-Z0-9.+-]+;base64,/, "");
          contents.push({
            inlineData: {
              data: cleanAudioBase64,
              mimeType: input.mimeType || "audio/webm",
            },
          });
        }
        contents.push({ text: prompt });

        const response = await generateWithFallback(ai, {
          preferredModels: ["gemini-3-flash-preview", "gemini-3.8-flash"],
          contents,
          config: {
            responseMimeType: "application/json",
          },
        });

        const rawText = response.text || "{}";
        const cleanJsonStr = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
        const parsed = JSON.parse(cleanJsonStr);

        let amount = cleanNumericAmount(parsed.amount);
        let items: Array<{ name: string; amount: number; formattedAmount: string; qty?: number }> = [];

        // Evaluasi apakah Gemini mengekstrak multi-item
        if (Array.isArray(parsed.items) && parsed.items.length >= 2) {
          items = parsed.items.map((it: any) => {
            const itAmt = cleanNumericAmount(it.amount || it.price);
            return {
              name: (it.name || "Item").trim(),
              amount: itAmt,
              formattedAmount: formatInputIDR(String(itAmt)),
              qty: it.qty || 1,
            };
          });
          const itemsSum = items.reduce((s, it) => s + it.amount, 0);
          if (itemsSum > 0) {
            amount = itemsSum;
          }
        }

        // Cek juga deteksi multi-item dari NLP lokal untuk teks transkripsi (sangat presisi untuk "beli kopi dan nasi goreng 3 ribu dan 5 ribu")
        if (items.length < 2 && rawSpeech) {
          const localMulti = parseMultipleItemsAndAmounts(rawSpeech);
          if (localMulti && localMulti.items.length >= 2) {
            items = localMulti.items;
            amount = localMulti.totalAmount;
          }
        }

        const txType: "expense" | "income" | "transfer" =
          parsed.txType === "income" || parsed.txType === "transfer" ? parsed.txType : "expense";

        // Akun matching
        let matchedAccountId: string | undefined = undefined;
        let accountHint = parsed.accountHint || "";
        if (accountHint) {
          const matchedAccName = fuzzyMatchAccount(accountHint, userAccounts);
          const matchedAccObj = userAccounts.find(
            (a) => a.name.toLowerCase() === matchedAccName.toLowerCase()
          );
          if (matchedAccObj) {
            matchedAccountId = matchedAccObj.id;
            accountHint = matchedAccObj.name;
          }
        }
        // Fallback akun sumber menggunakan deteksi NLP lokal (akurasi tinggi untuk "blue", "blu", dsb)
        if (!matchedAccountId && rawSpeech) {
          const localAcc = detectAccount(rawSpeech, userAccounts);
          if (localAcc.matchedAccountId) {
            matchedAccountId = localAcc.matchedAccountId;
            accountHint = localAcc.accountHint;
          }
        }

        // Akun tujuan matching jika transfer
        let matchedToAccountId: string | undefined = undefined;
        let toAccountHint = parsed.toAccountHint || "";
        if (txType === "transfer") {
          if (toAccountHint) {
            const matchedToAccName = fuzzyMatchAccount(toAccountHint, userAccounts);
            const matchedToAccObj = userAccounts.find(
              (a) => a.name.toLowerCase() === matchedToAccName.toLowerCase()
            );
            if (matchedToAccObj) {
              matchedToAccountId = matchedToAccObj.id;
              toAccountHint = matchedToAccObj.name;
            }
          }
          if (!matchedToAccountId && rawSpeech) {
            const localAcc = detectAccount(rawSpeech, userAccounts);
            if (localAcc.matchedToAccountId) {
              matchedToAccountId = localAcc.matchedToAccountId;
              toAccountHint = localAcc.toAccountHint || "";
            }
          }
        }

        // Kategori matching & rekomendasi kategori baru
        let matchedCategoryId: string | undefined = undefined;
        let categoryHint = parsed.categoryHint || (txType === "income" ? "Umum" : "Dining");
        let recommendedCategory:
          | {
              name: string;
              parentName?: string;
              kind: "expense" | "income";
              isNew: boolean;
            }
          | undefined = undefined;

        if (txType !== "transfer") {
          const matchingCats = userCategories.filter((c) => !c.kind || c.kind === txType);
          const exactCat = matchingCats.find(
            (c) => c.name.toLowerCase().trim() === categoryHint.toLowerCase().trim()
          );

          if (exactCat && !parsed.isNewCategory) {
            matchedCategoryId = exactCat.id;
            categoryHint = exactCat.name;
          } else {
            const fuzzyCatName = fuzzyMatchCategory(categoryHint, matchingCats);
            const fuzzyCatObj = matchingCats.find(
              (c) => c.name.toLowerCase().trim() === fuzzyCatName.toLowerCase().trim()
            );

            if (fuzzyCatObj && !parsed.isNewCategory) {
              matchedCategoryId = fuzzyCatObj.id;
              categoryHint = fuzzyCatObj.name;
            } else {
              recommendedCategory = {
                name: parsed.categoryHint || "Umum",
                parentName: parsed.suggestedParentCategory || undefined,
                kind: txType === "income" ? "income" : "expense",
                isNew: true,
              };
              categoryHint = parsed.categoryHint || "Umum";
            }
          }
        }

        // Waktu transaksi
        let happenedAt: Date | undefined = undefined;
        let happenedAtFormatted: string | undefined = undefined;
        if (parsed.happenedAtIso) {
          const parsedDate = new Date(parsed.happenedAtIso);
          if (!isNaN(parsedDate.getTime())) {
            happenedAt = parsedDate;
            const yyyy = parsedDate.getFullYear();
            const mm = String(parsedDate.getMonth() + 1).padStart(2, "0");
            const dd = String(parsedDate.getDate()).padStart(2, "0");
            const hh = String(parsedDate.getHours()).padStart(2, "0");
            const min = String(parsedDate.getMinutes()).padStart(2, "0");
            happenedAtFormatted = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
          }
        }

        let note = parsed.note?.trim() || "";
        if (items.length >= 2) {
          // Susun deskripsi multi-item rapi dengan mencantumkan 2 atau lebih item beserta nominalnya
          note = items.map((it) => `${it.name} (Rp ${it.formattedAmount})`).join(", ");
        } else if (!note || note.toLowerCase() === rawSpeech.toLowerCase()) {
          note = cleanSpeechToNote(rawSpeech);
        } else {
          note = cleanSpeechToNote(note);
        }

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
          recommendedCategory,
          isDatasetMatch: true,
          happenedAt,
          happenedAtFormatted,
          cleanNote: note,
          note,
          rawText: rawSpeech,
          items: items.length > 0 ? items : undefined,
          isMultipleItems: items.length >= 2,
          usedGemini: true,
        };
      } catch (geminiErr: any) {
        console.warn(
          "Gemini 2.5 Flash Audio fallback warning, falling back to local NLP:",
          geminiErr?.message || geminiErr
        );
        const localResult = smartParseIndonesianTransaction(rawSpeech, {
          accounts: userAccounts,
          categories: userCategories,
          referenceDate: input.clientTime ? new Date(input.clientTime) : new Date(),
        });
        return {
          ...localResult,
          usedGemini: false,
        };
      }
    }),

  parseBillReceipt: protectedProcedure
    .input(
      z.object({
        image: z.object({
          base64: z.string(),
          mimeType: z.string().default("image/jpeg"),
        }),
        clientTime: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const apiKey = await getEffectiveGeminiKey(ctx);

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
        "Dining, Beverage, Snacks, Transportasi, Daily Goods, Shopping, Utilities, Saving, Family, Beauty, Health, Education, entertain, paylater, Umum";

      const currentYear = new Date().getFullYear();
      const cleanBase64 = input.image.base64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");

      const prompt = `Kamu adalah sistem AI Vision Keuangan paling canggih di Indonesia untuk aplikasi Fin.IQ.
Tugasmu adalah menganalisis gambar finansial apa pun:
1. STRUK BELANJA KASIR FISIK & DIGITAL (Alfamart, Indomaret, Superindo, supermarket, resto, kafe, apotek, SPBU, warung, mall) dengan SEMUA DAFTAR PRODUKNYA.
2. BUKTI TRANSFER & PEMBAYARAN MOBILE BANKING / E-WALLET (BCA, myBCA, Mandiri Livin, BRImo, Wondr BNI, Bank Jago, Seabank, Jenius, GoPay, OVO, DANA, ShopeePay, QRIS, dll).
3. RIWAYAT MUTASI REKENING / TRANSACTION HISTORY MOBILE BANKING (beberapa baris mutasi debit/kredit dalam 1 layar).
4. TAGIHAN / FAKTUR / INVOICE (PLN Pascabayar/Token, PDAM, Indihome/wifi, BPJS, Tokopedia, Shopee, e-commerce).

Daftar akun pengguna di aplikasi: ${accountNamesStr}.
Daftar kategori pengguna di aplikasi: ${categoryNamesStr}.

FORMAT OUTPUT:
Kembalikan HANYA 1 objek JSON murni:
{
  "documentType": "receipt" | "transfer_proof" | "bank_statement" | "bill",
  "txType": "expense" | "income",
  "amount": number,
  "merchantName": string,
  "happenedAt": "YYYY-MM-DDTHH:mm:ss",
  "suggestedCategory": string,
  "paymentMethod": string,
  "items": [
    {
      "name": string,
      "qty": number,
      "price": number
    }
  ],
  "tax": number,
  "serviceCharge": number,
  "discount": number,
  "note": string,
  "isMultipleTransactions": boolean,
  "transactions": [
    {
      "txType": "expense" | "income",
      "amount": number,
      "happenedAt": "YYYY-MM-DDTHH:mm:ss",
      "note": string,
      "categoryHint": string,
      "accountHint": string
    }
  ]
}

ATURAN EKSTRAKSI PENTING:
1. DETEKSI SEMUA PRODUK PADA STRUK BELANJA (CRITICAL):
   - WAJIB deteksi dan ekstrak SEMUA item/produk yang tercantum di struk, jangan ada yang terlewat!
   - Untuk setiap produk di dalam array "items":
     * "name": Nama produk yang jelas dan terbaca di struk (misal: "Indomie Goreng Ayam", "Susu Ultra 250ml", "Aqua 600ml", "Roti Tawar").
     * "qty": Jumlah kuantiti (integer positif, misal: 1, 2, 3).
     * "price": Harga total atau harga satuan barang dalam integer Rupiah.
   - Cantumkan SEMUA barang di struk ke dalam array "items", bukan cuma 1 barang pertama!

2. BUKTI TRANSFER & PEMBAYARAN MOBILE BANKING / QRIS:
   - "documentType": "transfer_proof"
   - Kenali bank / e-wallet asal (BCA, Mandiri, BRI, BNI, GoPay, DANA, OVO, ShopeePay, Seabank, Jago, dll).
   - "txType":
     * "expense": jika transfer keluar, pembayaran QRIS, belanja merchant, bayar tagihan.
     * "income": jika transfer masuk (dana diterima, top up masuk, kredit).
   - "amount": Nominal transaksi yang ditransfer atau dibayar (Rupiah integer positif).
   - "merchantName": Nama penerima uang atau nama toko QRIS (misal: "Budi Santoso", "Kopi Kenangan").
   - "note": Deskripsi rapi dan informatif, misal: "Transfer ke Budi Santoso (BCA)" atau "QRIS Kopi Kenangan".

3. DAFTAR MUTASI / RIWAYAT TRANSAKSI BANYAK BARIS DI M-BANKING / FOTO:
   - Jika gambar menampilkan screenshot daftar mutasi rekening dengan 2 atau lebih baris transaksi:
     * "documentType": "bank_statement"
     * "isMultipleTransactions": true
     * Masukkan SEMUA baris transaksi yang tertera ke dalam array "transactions":
       - txType: "expense" (jika DB / Debit / uang keluar / minus -) atau "income" (jika CR / Kredit / uang masuk / plus +).
       - amount: nominal baris tersebut.
       - note: nama merchant / pengirim / keterangan mutasi.
     * "amount" utama: JUMLAHKAN SELURUH NOMINAL BARIS MUTASI TERSEBUT (Total uang keluar/masuk).
     * "note" utama: Tuliskan SEMUA 2 atau lebih transaksi tersebut beserta nominalnya, misal: "Mutasi BCA: Kopi Kenangan (Rp 25.000), Indomaret (Rp 35.000)".

4. GRAND TOTAL AMOUNT (RUPIAH):
   - Untuk struk belanja / faktur: "amount" WAJIB merupakan GRAND TOTAL PENJUMLAHAN seluruh item belanja (setelah diskon/pajak jika ada).
   - "note": TULISKAN 2 ATAU LEBIH ITEM TERSEBUT DI CATATAN SECARA JELAS dengan rincian harga, misal: "Indomaret: Indomie Goreng (Rp 3.500), Aqua 600ml (Rp 4.000), Roti Tawar (Rp 12.000)" atau jika tanpa nama toko: "Indomie Goreng (Rp 3.500), Aqua 600ml (Rp 4.000), Roti Tawar (Rp 12.000)".
   - JANGAN mengambil nominal Tunai/Cash yang diserahkan ke kasir atau Kembalian!
   - Tanda titik (.) di Indonesia adalah pemisah ribuan (Rp 50.000 = 50000). Jangan membaca titik sebagai desimal!

5. "suggestedCategory":
   - Pilih satu kategori yang paling cocok HANYA dari daftar pengguna: [${categoryNamesStr}].
   - Jika struk belanja minimarket/supermarket, pilih kategori harian/groceries/Daily Goods/Shopping/Umum.
   - Jika kafe/makanan, pilih Dining/Beverage. Jika pulsa/listrik, pilih Utilities.

6. Jika gambar BUKAN dokumen transaksi/struk/mutasi yang valid:
   { "amount": 0, "merchantName": "", "note": "Tidak terdeteksi dokumen transaksi yang valid", "items": [], "transactions": [] }
`;

      const ai = new GoogleGenAI({ apiKey });
      let responseText = "";
      try {
        const response = await generateWithFallback(ai, {
          preferredModels: ["gemini-3-flash-preview", "gemini-3.8-flash"],
          contents: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: input.image.mimeType || "image/jpeg",
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
        responseText = response.text || "{}";
      } catch (genErr: any) {
        console.error("Gemini Vision OCR Error:", genErr);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Gagal membaca gambar dengan Gemini AI: ${genErr.message || "Unknown error"}`,
        });
      }

      const jsonStr = responseText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      let parsed: any = {};
      try {
        parsed = JSON.parse(jsonStr);
      } catch (jsonErr) {
        console.error("Failed to parse Gemini OCR output:", responseText);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Format respon Gemini AI tidak valid.",
        });
      }

      let amount = cleanNumericAmount(parsed.amount);

      // Hitung dari total belanja items jika ada
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      const itemsSum = items.reduce((sum: number, it: any) => {
        const itemPrice = cleanNumericAmount(it.price);
        const itemQty = Math.max(1, Math.round(Number(it.qty) || 1));
        return sum + itemPrice * itemQty;
      }, 0);

      // Jika amount <= 0 atau jika ada 2+ item dan selisih kecil dengan itemsSum, pastikan amount adalah total penjumlahan item
      if (amount <= 0 && itemsSum > 0) {
        amount = itemsSum;
      } else if (items.length >= 2 && itemsSum > 0 && Math.abs(amount - itemsSum) <= 500) {
        amount = itemsSum;
      }

      // Hitung total mutasi multi-transaksi jika ada
      const rawTxList = Array.isArray(parsed.transactions) ? parsed.transactions : [];
      if (rawTxList.length >= 2) {
        const totalTxSum = rawTxList.reduce((sum: number, t: any) => sum + cleanNumericAmount(t.amount), 0);
        if (totalTxSum > 0) {
          amount = totalTxSum;
        }
      } else if (amount <= 0 && rawTxList.length > 0) {
        amount = cleanNumericAmount(rawTxList[0].amount);
      }

      if (amount <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Tidak dapat mendeteksi nominal transaksi dari gambar. Pastikan foto struk, bukti transfer, atau mutasi terlihat jelas dan terbaca.",
        });
      }

      const matchedAccName = fuzzyMatchAccount(parsed.paymentMethod, userAccounts);
      const matchedAccount = userAccounts.find(
        (a) => a.name.toLowerCase().trim() === matchedAccName.toLowerCase().trim()
      );

      const matchedCatName = fuzzyMatchCategory(parsed.suggestedCategory, userCategories);
      const matchedCategory = userCategories.find(
        (c) => c.name.toLowerCase().trim() === matchedCatName.toLowerCase().trim()
      );
      const recommendedCategory = !matchedCategory && parsed.suggestedCategory ? {
        name: parsed.suggestedCategory,
        kind: (parsed.txType === "income" ? "income" : "expense") as "expense" | "income",
        isNew: true,
      } : undefined;

      let happenedAt = parsed.happenedAt;
      if (!happenedAt || isNaN(new Date(happenedAt).getTime())) {
        happenedAt = input.clientTime || new Date().toISOString();
      }

      let itemsSummary = "";
      if (items.length > 0) {
        itemsSummary = items
          .map((item: any) => `${item.qty && item.qty > 1 ? item.qty + "x " : ""}${item.name || "Item"}${item.price ? ` (${formatInputIDR(String(cleanNumericAmount(item.price)))})` : ""}`)
          .join(", ");
      }

      const merchant = (parsed.merchantName || "").trim();
      const rawNote = (parsed.note || "").trim();

      // Susun finalNote: Jika ada 2 atau lebih item, WAJIB tuliskan rincian item-item tersebut di deskripsi
      let finalNote = "";
      if (rawTxList.length >= 2) {
        const txNotes = rawTxList
          .map((t: any) => {
            const a = cleanNumericAmount(t.amount);
            const aStr = a > 0 ? ` (Rp ${formatInputIDR(String(a))})` : "";
            return `${t.note || "Transaksi"}${aStr}`;
          })
          .join(", ");
        finalNote = merchant ? `Mutasi ${merchant}: ${txNotes}` : `Mutasi: ${txNotes}`;
      } else if (items.length >= 2) {
        const formattedItems = items.map((it: any) => {
          const itemPrice = cleanNumericAmount(it.price);
          const priceStr = itemPrice > 0 ? ` (Rp ${formatInputIDR(String(itemPrice))})` : "";
          const qtyStr = it.qty && it.qty > 1 ? `${it.qty}x ` : "";
          return `${qtyStr}${it.name || "Item"}${priceStr}`;
        });
        const itemsListStr = formattedItems.join(", ");
        finalNote = merchant ? `${merchant}: ${itemsListStr}` : itemsListStr;
      } else if (items.length === 1) {
        const it = items[0];
        const itemPrice = cleanNumericAmount(it.price);
        const priceStr = itemPrice > 0 ? ` (Rp ${formatInputIDR(String(itemPrice))})` : "";
        const itemStr = `${it.qty && it.qty > 1 ? `${it.qty}x ` : ""}${it.name || "Item"}${priceStr}`;
        finalNote = merchant ? `${merchant}: ${itemStr}` : itemStr;
      } else if (rawNote) {
        finalNote = rawNote;
      } else if (merchant) {
        finalNote = `Transaksi di ${merchant}`;
      } else {
        finalNote = "Transaksi AI Vision";
      }

      if (finalNote.length > 250) {
        finalNote = finalNote.substring(0, 247) + "...";
      }

      // Format baris mutasi multi-transaksi jika ada
      const parsedTransactions = rawTxList
        .filter((t: any) => cleanNumericAmount(t.amount) > 0)
        .map((t: any) => {
          const tAmount = cleanNumericAmount(t.amount);
          const tMatchedAcc = fuzzyMatchAccount(t.accountHint || parsed.paymentMethod, userAccounts);
          const tFoundAcc = userAccounts.find(
            (a) => a.name.toLowerCase().trim() === tMatchedAcc.toLowerCase().trim()
          );
          const tMatchedCat = fuzzyMatchCategory(t.categoryHint || parsed.suggestedCategory, userCategories);
          const tFoundCat = userCategories.find(
            (c) => c.name.toLowerCase().trim() === tMatchedCat.toLowerCase().trim()
          );
          return {
            amount: tAmount,
            formattedAmount: formatInputIDR(String(tAmount)),
            txType: (t.txType === "income" ? "income" : "expense") as "expense" | "income",
            happenedAt: t.happenedAt || happenedAt,
            note: (t.note || "Transaksi Mutasi").substring(0, 250),
            accountHint: tMatchedAcc,
            matchedAccountId: tFoundAcc?.id || userAccounts[0]?.id,
            categoryHint: tMatchedCat,
            matchedCategoryId: tFoundCat?.id,
          };
        });

      const formattedReturnedItems = items.map((it: any) => {
        const itemPrice = cleanNumericAmount(it.price);
        return {
          name: (it.name || "Item").trim(),
          price: itemPrice,
          amount: itemPrice,
          formattedAmount: formatInputIDR(String(itemPrice)),
          qty: it.qty || 1,
        };
      });

      return {
        amount,
        formattedAmount: formatInputIDR(String(amount)),
        txType: (parsed.txType === "income" ? "income" : "expense") as "expense" | "income",
        happenedAt,
        merchantName: merchant,
        note: finalNote,
        categoryHint: matchedCatName,
        matchedCategoryId: matchedCategory?.id,
        recommendedCategory,
        accountHint: matchedAccName,
        matchedAccountId: matchedAccount?.id || userAccounts[0]?.id,
        items: formattedReturnedItems,
        itemsSummary,
        itemsCount: formattedReturnedItems.length,
        tax: Number(parsed.tax) || 0,
        serviceCharge: Number(parsed.serviceCharge) || 0,
        discount: Number(parsed.discount) || 0,
        documentType: (parsed.documentType || (parsedTransactions.length > 1 ? "bank_statement" : items.length > 0 ? "receipt" : "transfer_proof")) as "receipt" | "transfer_proof" | "bank_statement" | "bill",
        isMultipleTransactions: Boolean((parsed.isMultipleTransactions && parsedTransactions.length > 1) || formattedReturnedItems.length >= 2),
        isMultipleItems: formattedReturnedItems.length >= 2 || parsedTransactions.length >= 2,
        transactions: parsedTransactions,
      };
    }),

  listTokens: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: personalAccessTokens.id,
        name: personalAccessTokens.name,
        prefix: personalAccessTokens.prefix,
        createdAt: personalAccessTokens.createdAt,
        lastUsedAt: personalAccessTokens.lastUsedAt,
        revokedAt: personalAccessTokens.revokedAt,
      })
      .from(personalAccessTokens)
      .where(eq(personalAccessTokens.userId, ctx.userId))
      .orderBy(desc(personalAccessTokens.createdAt));
  }),

  createToken: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const rawToken = `bcmcp_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
      const prefix = rawToken.substring(0, 14);
      const id = crypto.randomUUID();

      await ctx.db
        .insert(personalAccessTokens)
        .values({
          id,
          userId: ctx.userId,
          name: input.name,
          prefix,
          tokenHash: "hash_" + rawToken,
        });

      const token = await ctx.db.query.personalAccessTokens.findFirst({
        where: eq(personalAccessTokens.id, id),
      });

      return {
        ...token!,
        rawToken, // Hanya ditampilkan 1x saat generate
      };
    }),

  listMcpLogs: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(mcpCallLogs)
        .where(eq(mcpCallLogs.userId, ctx.userId))
        .orderBy(desc(mcpCallLogs.calledAt))
        .limit(input.limit);
    }),

  getAiConfig: protectedProcedure.query(async ({ ctx }) => {
    const quota = await getAiQuota(ctx.db, ctx.userId);
    return {
      provider: "OpenRouter (Free Tier)",
      defaultModel: DEFAULT_MODEL_ID,
      availableModels: OPENROUTER_FREE_MODELS,
      quota,
    };
  }),

  getAiQuota: protectedProcedure.query(async ({ ctx }) => {
    return await getAiQuota(ctx.db, ctx.userId);
  }),

  listChatSessions: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: aiChatSessions.id,
        title: aiChatSessions.title,
        modelUsed: aiChatSessions.modelUsed,
        createdAt: aiChatSessions.createdAt,
        updatedAt: aiChatSessions.updatedAt,
      })
      .from(aiChatSessions)
      .where(eq(aiChatSessions.userId, ctx.userId))
      .orderBy(desc(aiChatSessions.updatedAt));
  }),

  getChatSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const sessionRecords = await ctx.db
        .select()
        .from(aiChatSessions)
        .where(
          and(
            eq(aiChatSessions.id, input.sessionId),
            eq(aiChatSessions.userId, ctx.userId)
          )
        )
        .limit(1);

      if (sessionRecords.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Sesi percakapan tidak ditemukan.",
        });
      }

      const messages = await ctx.db
        .select({
          id: aiChatMessages.id,
          role: aiChatMessages.role,
          content: aiChatMessages.content,
          modelUsed: aiChatMessages.modelUsed,
          guardrailBlocked: aiChatMessages.guardrailBlocked,
          createdAt: aiChatMessages.createdAt,
        })
        .from(aiChatMessages)
        .where(eq(aiChatMessages.sessionId, input.sessionId))
        .orderBy(aiChatMessages.createdAt);

      return {
        session: sessionRecords[0],
        messages,
      };
    }),

  createChatSession: protectedProcedure
    .input(
      z.object({
        title: z.string().optional(),
        model: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sessionId = crypto.randomUUID();
      const title = input.title?.trim() || "Percakapan Baru";
      const modelUsed = input.model || DEFAULT_MODEL_ID;

      await ctx.db.insert(aiChatSessions).values({
        id: sessionId,
        userId: ctx.userId,
        title,
        modelUsed,
      });

      return {
        id: sessionId,
        title,
        modelUsed,
      };
    }),

  deleteChatSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(aiChatSessions)
        .where(
          and(
            eq(aiChatSessions.id, input.sessionId),
            eq(aiChatSessions.userId, ctx.userId)
          )
        );
      return { success: true };
    }),

  getChatHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 30;
      const history = await ctx.db
        .select({
          id: aiPromptHistory.id,
          question: aiPromptHistory.question,
          answer: aiPromptHistory.answer,
          modelUsed: aiPromptHistory.modelUsed,
          guardrailBlocked: aiPromptHistory.guardrailBlocked,
          createdAt: aiPromptHistory.createdAt,
        })
        .from(aiPromptHistory)
        .where(eq(aiPromptHistory.userId, ctx.userId))
        .orderBy(desc(aiPromptHistory.createdAt))
        .limit(limit);

      return history.reverse();
    }),

  clearChatHistory: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .delete(aiPromptHistory)
      .where(eq(aiPromptHistory.userId, ctx.userId));
    return { success: true };
  }),

  askFinancialAssistant: protectedProcedure
    .input(
      z.object({
        question: z.string().min(2, "Pertanyaan terlalu pendek"),
        model: z.string().optional(),
        sessionId: z.string().optional(),
        lang: z.enum(["id", "en"]).optional().default("id"),
        clientTime: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Kelola Session ID
      let activeSessionId = input.sessionId;
      const modelId = input.model || DEFAULT_MODEL_ID;
      const isEnglish = input.lang === "en";

      if (!activeSessionId) {
        activeSessionId = crypto.randomUUID();
        const autoTitle =
          input.question.length > 40
            ? `${input.question.substring(0, 37)}...`
            : input.question;
        try {
          await ctx.db.insert(aiChatSessions).values({
            id: activeSessionId,
            userId: ctx.userId,
            title: autoTitle,
            modelUsed: modelId,
          });
        } catch (sErr) {
          console.error("[Session Create Error]", sErr);
        }
      }

      // Simpan prompt pengguna ke session
      try {
        await ctx.db.insert(aiChatMessages).values({
          sessionId: activeSessionId,
          userId: ctx.userId,
          role: "user",
          content: input.question,
        });
      } catch (mErr) {
        console.error("[User Message Save Error]", mErr);
      }

      // 1. GUARDRAIL PRE-FILTER: Cek apakah pertanyaan keluar dari konteks keuangan
      const guardrail = checkFinancialGuardrail(input.question);
      if (guardrail.isOffTopic) {
        const refusalText = isEnglish
          ? "I apologize, but as the Fin.IQ AI Financial Advisor, I only provide analysis and consultation on personal finance, cash flows, transactions, and budget runway. Please submit a personal finance-related query."
          : guardrail.refusal || GUARDRAIL_REFUSAL_MESSAGE;

        // Simpan respon penolakan guardrail ke session & audit history
        try {
          await ctx.db.insert(aiChatMessages).values({
            sessionId: activeSessionId,
            userId: ctx.userId,
            role: "assistant",
            content: refusalText,
            modelUsed: modelId,
            guardrailBlocked: true,
          });
          await ctx.db
            .update(aiChatSessions)
            .set({ updatedAt: new Date() })
            .where(eq(aiChatSessions.id, activeSessionId));
          await ctx.db.insert(aiPromptHistory).values({
            userId: ctx.userId,
            question: input.question,
            answer: refusalText,
            modelUsed: modelId,
            guardrailBlocked: true,
          });
        } catch (dbErr) {
          console.error("[AI History Save Error]", dbErr);
        }

        return {
          answer: refusalText,
          modelUsed: modelId,
          quota: await getAiQuota(ctx.db, ctx.userId),
          guardrailBlocked: true,
          sessionId: activeSessionId,
        };
      }

      // 2. LIMIT PROMPTING & RATE LIMITING PER USER
      const quotaCheck = await consumeAiQuota(ctx.db, ctx.userId);
      if (!quotaCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: quotaCheck.message || "Batas kuota prompt demo harian Anda telah tercapai.",
        });
      }

      // 3. AMBIL DATA TELEMETRI KEUANGAN PENGGUNA TERKINI (VERIFIED & ANTI-HALUSINASI)
      const telemetry = await buildUserFinancialTelemetry(
        ctx.db,
        ctx.userId,
        input.clientTime
      );

      const systemPrompt = isEnglish
        ? telemetry.systemPromptEn
        : telemetry.systemPromptId;
      const userPrompt = telemetry.getUserPrompt(input.question, isEnglish);

      // Cek apakah user memiliki API key personal (OpenRouter / Gemini)
      const userProfile = await ctx.db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, ctx.userId),
      });
      const userSavedKey = userProfile?.geminiApiKey?.trim();
      const userOpenRouterKey = userSavedKey?.startsWith("sk-or-") ? userSavedKey : undefined;
      const userGeminiKey =
        userSavedKey && !userSavedKey.startsWith("sk-or-")
          ? userSavedKey
          : undefined;

      let answerText = "";
      let modelUsedName = "";

      // 1. Coba OpenRouter (menggunakan personal key user jika ada, atau system key)
      try {
        const result = await generateOpenRouterCompletion({
          model: input.model,
          systemPrompt,
          userPrompt,
          temperature: 0.2,
          apiKey: userOpenRouterKey,
        });
        answerText = result.text;
        modelUsedName = result.modelUsed;
      } catch (openRouterErr: any) {
        console.warn("[askFinancialAssistant] OpenRouter error:", openRouterErr?.message);

        // 2. Coba Google Gemini jika user memiliki personal Gemini key atau ada env valid
        const systemGeminiKey =
          process.env.GEMINI_API_KEY?.trim() ||
          process.env.GEMINI?.trim() ||
          DEFAULT_GEMINI_API_KEY;
        const effectiveGeminiKey = userGeminiKey || systemGeminiKey || undefined;

        if (effectiveGeminiKey) {
          try {
            const ai = new GoogleGenAI({ apiKey: effectiveGeminiKey });
            const response = await generateWithFallback(ai, {
              preferredModels: ["gemini-3-flash-preview", "gemini-3.8-flash"],
              contents: `${systemPrompt}\n\n${userPrompt}`,
            });
            answerText = response.text || "Tidak ada respon dari AI.";
            modelUsedName = "Google Gemini (Personal Fallback)";
          } catch (geminiErr: any) {
            console.warn("[askFinancialAssistant] Gemini fallback error:", geminiErr?.message);
          }
        }

        // 3. Fallback Cerdas: Bang Peci Local Financial Telemetry Advisor (Zero-Crash Guarantee)
        // Setiap akun di Fin-IQ dijamin selalu mendapatkan analisa finansial komprehensif
        if (!answerText) {
          answerText = generateTelemetryFinancialAnswer(telemetry, input.question, isEnglish);
          modelUsedName = "Bang Peci Telemetry Advisor (Offline Mode)";
        }
      }

      // Simpan jawaban assistant ke session & audit history
      try {
        await ctx.db.insert(aiChatMessages).values({
          sessionId: activeSessionId,
          userId: ctx.userId,
          role: "assistant",
          content: answerText,
          modelUsed: modelUsedName,
          guardrailBlocked: false,
        });
        await ctx.db
          .update(aiChatSessions)
          .set({ updatedAt: new Date() })
          .where(eq(aiChatSessions.id, activeSessionId));
        await ctx.db.insert(aiPromptHistory).values({
          userId: ctx.userId,
          question: input.question,
          answer: answerText,
          modelUsed: modelUsedName,
          guardrailBlocked: false,
        });
      } catch (dbErr) {
        console.error("[AI History Save Error]", dbErr);
      }

      return {
        answer: answerText,
        modelUsed: modelUsedName,
        quota: await getAiQuota(ctx.db, ctx.userId),
        guardrailBlocked: false,
        sessionId: activeSessionId,
      };
    }),

  parseTextWithGemini: protectedProcedure
    .input(z.object({ text: z.string().min(2), clientTime: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const userAccounts = await ctx.db
        .select({ id: accounts.id, name: accounts.name, group: accounts.group })
        .from(accounts)
        .where(eq(accounts.userId, ctx.userId));

      const userCategories = await ctx.db
        .select({ id: categories.id, name: categories.name, kind: categories.kind })
        .from(categories)
        .where(eq(categories.userId, ctx.userId));

      try {
        const apiKey = await getEffectiveGeminiKey(ctx);

        const accountNamesStr = userAccounts.map((a) => a.name).join(", ") || "Kas Tunai, BCA";
        const categoryNamesStr = userCategories.map((c) => c.name).join(", ") || "Dining, Transportasi, Umum";

        const prompt = `Kamu adalah parser transaksi keuangan bahasa Indonesia untuk aplikasi Fin.IQ.
Ubah kalimat pengguna berikut menjadi 1 objek JSON transaksi:
"${input.text}"

Daftar akun pengguna: ${accountNamesStr}.
Daftar kategori pengguna: ${categoryNamesStr}.

FORMAT OUTPUT JSON:
{
  "txType": "expense" | "income" | "transfer",
  "amount": number,
  "happenedAt": "YYYY-MM-DDTHH:mm:ss",
  "categoryName": string,
  "accountName": string,
  "toAccountName": string | null,
  "note": string
}

ATURAN:
1. "amount": integer rupiah positif murni (contoh: 50rb = 50000, 1.5jt = 1500000).
2. "categoryName": pilih yang paling cocok dari [${categoryNamesStr}].
3. "accountName": pilih akun asal yang paling cocok dari [${accountNamesStr}].
4. "happenedAt": ISO datetime string ("YYYY-MM-DDTHH:mm:ss"). Jika disebut kemarin/tadi/besok, hitung dari ${input.clientTime || new Date().toISOString()}.
5. Kembalikan HANYA JSON.`;

        const ai = new GoogleGenAI({ apiKey });
        const response = await generateWithFallback(ai, {
          preferredModels: ["gemini-3-flash-preview", "gemini-3.8-flash"],
          contents: prompt,
          config: { responseMimeType: "application/json" },
        });

        const jsonStr = (response.text || "{}")
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();

        const parsed = JSON.parse(jsonStr);
        const amount = cleanNumericAmount(parsed.amount);

        const matchedAcc = fuzzyMatchAccount(parsed.accountName, userAccounts);
        const matchedCat = fuzzyMatchCategory(parsed.categoryName, userCategories);

        const foundAcc = userAccounts.find((a) => a.name.toLowerCase() === matchedAcc.toLowerCase());
        const foundCat = userCategories.find((c) => c.name.toLowerCase() === matchedCat.toLowerCase());

        const recommendedCategory = !foundCat && parsed.categoryName ? {
          name: parsed.categoryName,
          kind: (parsed.txType || "expense") as "expense" | "income",
          isNew: true,
        } : undefined;

        return {
          amount,
          formattedAmount: formatInputIDR(String(amount)),
          txType: (parsed.txType || "expense") as "expense" | "income" | "transfer",
          happenedAt: parsed.happenedAt || input.clientTime || new Date().toISOString(),
          note: parsed.note || input.text,
          accountHint: matchedAcc,
          matchedAccountId: foundAcc?.id || userAccounts[0]?.id,
          categoryHint: matchedCat,
          matchedCategoryId: foundCat?.id,
          recommendedCategory,
          usedGemini: true,
        };
      } catch (err: any) {
        console.warn("[parseTextWithGemini] Fallback ke rule-based NLP lokal:", err?.message || err);
        const localResult = smartParseIndonesianTransaction(input.text, {
          accounts: userAccounts,
          categories: userCategories,
          referenceDate: input.clientTime ? new Date(input.clientTime) : new Date(),
        });
        return {
          ...localResult,
          happenedAt: localResult.happenedAt ? localResult.happenedAt.toISOString() : (input.clientTime || new Date().toISOString()),
          happenedAtFormatted: localResult.happenedAtFormatted || undefined,
          usedGemini: false,
        };
      }
    }),
});
