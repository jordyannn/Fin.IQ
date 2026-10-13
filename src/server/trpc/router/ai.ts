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

      const prompt = `Kamu adalah sistem OCR dan analisis transaksi keuangan profesional di Indonesia untuk aplikasi Fin.IQ.
Tugasmu adalah menganalisis gambar struk belanja kasir fisik (Alfamart, Indomaret, supermarket, resto, kafe, warung), bukti transfer m-banking / QRIS, kuitansi, atau faktur/tagihan (bill/invoice PLN, PDAM, wifi, dsb.), lalu mengekstrak data transaksi menjadi format JSON tunggal.

Daftar akun pengguna di aplikasi: ${accountNamesStr}.
Daftar kategori pengguna di aplikasi: ${categoryNamesStr}.

FORMAT OUTPUT:
Kembalikan HANYA 1 objek JSON murni:
{
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
  "note": string
}

ATURAN EKSTRAKSI PENTING:
1. "amount":
   - Merupakan GRAND TOTAL akhir yang dibayar (angka integer bulat positif dalam Rupiah).
   - JANGAN mengambil Subtotal kotor sebelum diskon/pajak.
   - JANGAN mengambil nominal Tunai/Cash yang diserahkan ke kasir atau Kembalian!
   - Di Indonesia, titik (.) adalah pemisah ribuan (Rp 45.000 = 45000). Jangan membaca titik sebagai desimal!
2. "merchantName" & "note":
   - Nama toko/tempat/merchant atau penerbit tagihan (misal: "Indomaret", "Alfamart", "Kopi Kenangan", "PLN Pascabayar", "Starbucks").
   - Jika ada rincian belanja, buat "note" yang rapi dan informatif (misal: "Belanja di Indomaret" atau nama toko).
3. "happenedAt":
   - Tanggal & waktu transaksi dari struk (format ISO "YYYY-MM-DDTHH:mm:ss").
   - Jika jam tidak tertera, gunakan jam 12:00:00. Jika tahun tidak tertera, gunakan tahun ${currentYear}.
4. "suggestedCategory":
   - Pilih SATU nama yang paling cocok HANYA dari daftar kategori pengguna: [${categoryNamesStr}].
5. "paymentMethod":
   - Metode bayar yang tertera (misal: "TUNAI", "DEBIT BCA", "QRIS", "GOPAY", "MANDIRI", "DANA", "SHOPEEPAY", "KREDIT").
6. "items":
   - Daftar item/barang belanjaan jika tertera pada struk kasir.
7. Jika BUKAN gambar transaksi/struk/tagihan yang valid, kembalikan:
   { "amount": 0, "merchantName": "", "note": "Tidak terdeteksi struk transaksi", "items": [] }
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
        console.error("Gemini Bill OCR Error:", genErr);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Gagal membaca struk dengan Gemini AI: ${genErr.message || "Unknown error"}`,
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
            "Tidak dapat mendeteksi total transaksi dari gambar. Pastikan foto struk atau tagihan terlihat tajam dan terbaca.",
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

      let itemsSummary = "";
      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        itemsSummary = parsed.items
          .slice(0, 6)
          .map((item: any) => `${item.qty ? item.qty + "x " : ""}${item.name}`)
          .join(", ");
      }

      const merchant = (parsed.merchantName || "").trim();
      const rawNote = (parsed.note || "").trim();
      const finalNote = merchant || rawNote || "Belanja Struk";

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
        items: Array.isArray(parsed.items) ? parsed.items : [],
        itemsSummary,
        tax: Number(parsed.tax) || 0,
        serviceCharge: Number(parsed.serviceCharge) || 0,
        discount: Number(parsed.discount) || 0,
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
