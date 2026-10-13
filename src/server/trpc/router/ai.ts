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
} from "../../db/schema";
import { eq, desc } from "drizzle-orm";
import { smartParseIndonesianTransaction } from "@/lib/nlp-parser";
import { GoogleGenAI } from "@google/genai";
import { fuzzyMatchAccount, fuzzyMatchCategory } from "./import";
import { formatInputIDR } from "@/lib/utils";

async function getEffectiveGeminiKey(ctx: { db: any; userId: string }): Promise<string> {
  const profile = await ctx.db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, ctx.userId),
  });

  const key = profile?.geminiApiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Anda belum menyambungkan Google Gemini API Key di profil. Silakan buka Pengaturan & Profil atau halaman AI untuk menyambungkan token Anda.",
    });
  }
  return key;
}

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

      return smartParseIndonesianTransaction(input.text, {
        accounts: userAccounts,
        categories: userCategories,
        referenceDate: input.clientTime ? new Date(input.clientTime) : new Date(),
      });
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

3. DAFTAR MUTASI / RIWAYAT TRANSAKSI BANYAK BARIS DI M-BANKING:
   - Jika gambar menampilkan screenshot daftar mutasi rekening dengan 2 atau lebih baris transaksi:
     * "documentType": "bank_statement"
     * "isMultipleTransactions": true
     * Masukkan SEMUA baris transaksi yang tertera ke dalam array "transactions":
       - txType: "expense" (jika DB / Debit / uang keluar / minus -) atau "income" (jika CR / Kredit / uang masuk / plus +).
       - amount: nominal baris tersebut.
       - note: nama merchant / pengirim / keterangan mutasi.
     * Isi "amount" utama dengan nominal transaksi baris paling atas/terbaru.
     * Isi "note" utama dengan: "Mutasi [Bank]: [Keterangan baris 1]".

4. GRAND TOTAL AMOUNT (RUPIAH):
   - Untuk struk belanja: Ambil GRAND TOTAL akhir setelah diskon/pajak (angka integer bulat positif dalam Rupiah).
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
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
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

      const amount = Math.round(Number(parsed.amount) || 0);
      if (amount <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Tidak dapat mendeteksi total transaksi dari gambar. Pastikan foto struk, bukti transfer, atau mutasi terlihat jelas dan terbaca.",
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

      let happenedAt = parsed.happenedAt;
      if (!happenedAt || isNaN(new Date(happenedAt).getTime())) {
        happenedAt = input.clientTime || new Date().toISOString();
      }

      const items = Array.isArray(parsed.items) ? parsed.items : [];
      let itemsSummary = "";
      if (items.length > 0) {
        itemsSummary = items
          .map((item: any) => `${item.qty && item.qty > 1 ? item.qty + "x " : ""}${item.name || "Item"}${item.price ? ` (${formatInputIDR(String(Math.round(item.price)))})` : ""}`)
          .join(", ");
      }

      const merchant = (parsed.merchantName || "").trim();
      const rawNote = (parsed.note || "").trim();

      let finalNote = "";
      if (merchant && items.length > 0) {
        // Rangkum merchant dan seluruh produk utama yang dibeli
        const itemNames = items
          .slice(0, 6)
          .map((it: any) => `${it.qty && it.qty > 1 ? it.qty + "x " : ""}${it.name}`)
          .join(", ");
        const moreCount = items.length > 6 ? ` (+${items.length - 6} item)` : "";
        finalNote = `${merchant}: ${itemNames}${moreCount}`;
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
      const rawTxList = Array.isArray(parsed.transactions) ? parsed.transactions : [];
      const parsedTransactions = rawTxList
        .filter((t: any) => Number(t.amount) > 0)
        .map((t: any) => {
          const tAmount = Math.round(Number(t.amount) || 0);
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

      return {
        amount,
        formattedAmount: formatInputIDR(String(amount)),
        txType: (parsed.txType === "income" ? "income" : "expense") as "expense" | "income",
        happenedAt,
        merchantName: merchant,
        note: finalNote,
        categoryHint: matchedCatName,
        matchedCategoryId: matchedCategory?.id,
        accountHint: matchedAccName,
        matchedAccountId: matchedAccount?.id || userAccounts[0]?.id,
        items,
        itemsSummary,
        itemsCount: items.length,
        tax: Number(parsed.tax) || 0,
        serviceCharge: Number(parsed.serviceCharge) || 0,
        discount: Number(parsed.discount) || 0,
        documentType: (parsed.documentType || (parsedTransactions.length > 1 ? "bank_statement" : items.length > 0 ? "receipt" : "transfer_proof")) as "receipt" | "transfer_proof" | "bank_statement" | "bill",
        isMultipleTransactions: Boolean(parsed.isMultipleTransactions && parsedTransactions.length > 1),
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

  askFinancialAssistant: protectedProcedure
    .input(z.object({ question: z.string().min(2, "Pertanyaan terlalu pendek") }))
    .mutation(async ({ ctx, input }) => {
      const apiKey = await getEffectiveGeminiKey(ctx);

      // Ambil ringkasan keuangan terkini user
      const userAccounts = await ctx.db
        .select({ name: accounts.name, balance: accounts.balance, currency: accounts.currency })
        .from(accounts)
        .where(eq(accounts.userId, ctx.userId));

      const totalBalance = userAccounts.reduce((acc, a) => acc + (a.balance || 0), 0);

      const recentTx = await ctx.db
        .select({
          txType: transactions.txType,
          amount: transactions.amount,
          happenedAt: transactions.happenedAt,
          note: transactions.note,
          categoryName: categories.name,
          accountName: accounts.name,
        })
        .from(transactions)
        .leftJoin(accounts, eq(transactions.accountId, accounts.id))
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(eq(transactions.userId, ctx.userId))
        .orderBy(desc(transactions.happenedAt))
        .limit(30);

      const accountsInfo = userAccounts
        .map((a) => `${a.name}: Rp ${a.balance.toLocaleString("id-ID")}`)
        .join(", ");
      const txInfo = recentTx
        .map(
          (t) =>
            `- [${t.txType.toUpperCase()}] Rp ${t.amount.toLocaleString("id-ID")} (${t.categoryName || "Umum"}): "${t.note || "-"}" pada ${new Date(t.happenedAt).toLocaleDateString("id-ID")}`
        )
        .join("\n");

      const prompt = `Kamu adalah Fin.IQ AI, asisten keuangan pribadi cerdas dan bersahabat di Indonesia.
Berikut data ringkasan keuangan riil pengguna:
- Total Saldo: Rp ${totalBalance.toLocaleString("id-ID")}
- Akun: ${accountsInfo || "Belum ada akun"}
- 30 Transaksi Terakhir:
${txInfo || "Belum ada transaksi"}

Pertanyaan Pengguna: "${input.question}"

Instruksi:
1. Jawab dalam Bahasa Indonesia yang ramah, ringkas, dan jelas.
2. Berikan analisis angka yang faktual jika pengguna menanyakan pengeluaran, pemasukan, atau perbandingan.
3. Berikan saran praktis yang dapat langsung diterapkan pengguna.
4. Gunakan format markdown yang rapi (bullet points / bold).`;

      const ai = new GoogleGenAI({ apiKey });
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
        });

        return {
          answer: response.text || "Tidak ada respon dari AI.",
        };
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Gagal memproses pertanyaan dengan Gemini: ${err.message || "Unknown error"}`,
        });
      }
    }),

  parseTextWithGemini: protectedProcedure
    .input(z.object({ text: z.string().min(2), clientTime: z.string().optional() }))
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

      const accountNamesStr = userAccounts.map((a) => a.name).join(", ") || "Kas Tunai, BCA";
      const categoryNamesStr = userCategories.map((c) => c.name).join(", ") || "Dining, Transportasi, Umum";
      const currentYear = new Date().getFullYear();

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
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: { responseMimeType: "application/json" },
        });

        const jsonStr = (response.text || "{}")
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();

        const parsed = JSON.parse(jsonStr);
        const amount = Math.round(Number(parsed.amount) || 0);

        const matchedAcc = fuzzyMatchAccount(parsed.accountName, userAccounts);
        const matchedCat = fuzzyMatchCategory(parsed.categoryName, userCategories);

        const foundAcc = userAccounts.find((a) => a.name.toLowerCase() === matchedAcc.toLowerCase());
        const foundCat = userCategories.find((c) => c.name.toLowerCase() === matchedCat.toLowerCase());

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
        };
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Gagal memproses teks dengan Gemini: ${err.message || "Unknown error"}`,
        });
      }
    }),
});
