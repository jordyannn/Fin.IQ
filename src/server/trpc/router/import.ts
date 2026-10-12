import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { accounts, categories, transactions, ledgers } from "../../db/schema";
import { eq, sql } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

function fuzzyMatchAccount(rawName: string | undefined, userAccounts: { id: string; name: string }[]): string {
  if (!rawName || !rawName.trim()) {
    return userAccounts[0]?.name || "Kas Tunai";
  }
  const clean = rawName.toLowerCase().trim();

  // 1. Exact match
  const exact = userAccounts.find((a) => a.name.toLowerCase().trim() === clean);
  if (exact) return exact.name;

  // 2. Substring match
  const sub = userAccounts.find((a) => {
    const aName = a.name.toLowerCase().trim();
    return aName.includes(clean) || clean.includes(aName);
  });
  if (sub) return sub.name;

  // 3. Known aliases in Indonesia
  const aliases: Record<string, string[]> = {
    blu: ["bca digital", "blubybcadigital", "blu bca"],
    bca: ["bank central asia", "klikbca", "m-bca", "mbca"],
    mandiri: ["livin", "livin' by mandiri", "bank mandiri"],
    bri: ["brimo", "bank rakyat indonesia"],
    bni: ["wondr", "bni mobile", "bank negara indonesia"],
    gopay: ["go-pay", "gojek"],
    ovo: ["ovo cash"],
    dana: ["dompet dana"],
    shopeepay: ["shopee pay", "spay", "shopee"],
    cash: ["tunai", "kas tunai", "dompet"],
    jago: ["bank jago", "kantong jago"],
    seabank: ["sea bank", "sea"],
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

function fuzzyMatchCategory(
  rawName: string | undefined,
  userCategories: { id: string; name: string; kind?: string }[]
): string {
  if (!rawName || !rawName.trim()) return "Umum";
  const clean = rawName.toLowerCase().trim();

  // 1. Exact match
  const exact = userCategories.find((c) => c.name.toLowerCase().trim() === clean);
  if (exact) return exact.name;

  // 2. Canonical dictionary match (e.g. "makanan & minuman" / "restoran" -> "Dining", "transportasi" -> "Transport")
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

  // 4. Fallback to existing user category
  return userCategories[0]?.name || "Umum";
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
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "GEMINI_API_KEY belum dikonfigurasi di server (.env.local). Silakan dapatkan API key gratis di Google AI Studio (https://aistudio.google.com/apikey).",
        });
      }

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
        "Dining, Beverage, Snacks, Transport, Daily Goods, Shopping, Utilities, Saving, Family, Beauty, Health, Education, entertain, invest job, paylater, Salary, Part time, Allowance, Umum";

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
          const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
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
            const rawAmount = Number(item.amount);
            if (isNaN(rawAmount) || rawAmount <= 0) continue;

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
      }

      // 3. Cache user categories
      const userCategories = await ctx.db.select().from(categories).where(eq(categories.userId, ctx.userId));
      const categoryMap = new Map<string, any>();
      for (const c of userCategories) {
        categoryMap.set(c.name.toLowerCase().trim(), c);
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
        const rawCat = item.categoryName ? item.categoryName.trim() : "Umum";
        const cleanCatName =
          rawCat
            .replace(/\s*[\(（][\u4e00-\u9fa5\s]+[\)）]/g, "")
            .replace(/[\u4e00-\u9fa5]+/g, "")
            .trim() || "Umum";

        let matchedCat = categoryMap.get(cleanCatName.toLowerCase());
        if (!matchedCat) {
          const resolvedName = fuzzyMatchCategory(cleanCatName, userCategories);
          matchedCat = categoryMap.get(resolvedName.toLowerCase());
        }
        if (!matchedCat && userCategories.length > 0) {
          // Fallback ke kategori user yang sesuai jenis transaksi
          const fallbackCat = userCategories.find(
            (c) => c.kind === (item.txType === "income" ? "income" : "expense")
          ) || userCategories[0];
          matchedCat = fallbackCat;
        }
        if (!matchedCat) {
          const newCatId = crypto.randomUUID();
          const newCat = {
            id: newCatId,
            userId: ctx.userId,
            name: cleanCatName,
            kind: item.txType === "income" ? "income" : "expense",
            icon: "Receipt",
          };
          await ctx.db.insert(categories).values(newCat);
          matchedCat = newCat;
          categoryMap.set(cleanCatName.toLowerCase(), newCat);
          categoriesCreated.push(cleanCatName);
        }

        // Account resolution
        const accName = item.accountName ? item.accountName.trim() : defaultAccount?.name || "cash";
        let matchedAccount = accountMap.get(accName.toLowerCase()) || defaultAccount;

        if (!matchedAccount) {
          const groupName = accName.toLowerCase().includes("bank") ? "Bank card" : "Cash";
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
          accountsCreated.push(accName);
        }

        // To Account for transfer
        let matchedToAccount = null;
        if (item.txType === "transfer" && item.toAccountName) {
          const toName = item.toAccountName.trim();
          matchedToAccount = accountMap.get(toName.toLowerCase());
          if (!matchedToAccount) {
            const newToAccId = crypto.randomUUID();
            const newToAcc = {
              id: newToAccId,
              userId: ctx.userId,
              name: toName,
              group: "Bank card",
              currency: "IDR",
              initialBalance: 0,
              balance: 0,
            };
            await ctx.db.insert(accounts).values(newToAcc);
            matchedToAccount = newToAcc;
            accountMap.set(toName.toLowerCase(), newToAcc);
            accountsCreated.push(toName);
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
        await ctx.db.insert(transactions).values(chunk);
      }

      // Update balances
      for (const [accId, delta] of balanceDeltas.entries()) {
        await ctx.db
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} + ${delta}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, accId));
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
