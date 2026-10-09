import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { personalAccessTokens, mcpCallLogs } from "../../db/schema";
import { eq, desc } from "drizzle-orm";

export const aiRouter = router({
  parseTextToTransaction: protectedProcedure
    .input(z.object({ text: z.string().min(2) }))
    .mutation(async ({ input }) => {
      // Natural Language parsing (Regex + heuristic)
      // Contoh: "Makan siang 25000 pakai cash" atau "Beli bensin 50rb pake blu"
      const lower = input.text.toLowerCase();

      // Extract amount
      let amount = 0;
      const rbMatch = lower.match(/(\d+[\.,]?\d*)\s*(?:rb|ribu|k)\b/i);
      const jtMatch = lower.match(/(\d+[\.,]?\d*)\s*(?:jt|juta|m)\b/i);
      const numMatch = lower.match(/\b(?:rp|idr)?\s*(\d{4,9})\b/i);

      if (rbMatch) {
        amount = parseFloat(rbMatch[1].replace(",", ".")) * 1000;
      } else if (jtMatch) {
        amount = parseFloat(jtMatch[1].replace(",", ".")) * 1000000;
      } else if (numMatch) {
        amount = parseFloat(numMatch[1]);
      }

      // Detect Account
      let accountHint = "cash";
      if (lower.includes("blu") || lower.includes("bca") || lower.includes("bank")) {
        accountHint = "blu";
      } else if (lower.includes("dana") || lower.includes("ewallet") || lower.includes("gopay")) {
        accountHint = "dana";
      }

      // Detect Type
      let txType: "expense" | "income" | "transfer" = "expense";
      if (lower.includes("gaji") || lower.includes("dapat") || lower.includes("terima") || lower.includes("masuk")) {
        txType = "income";
      } else if (lower.includes("transfer") || lower.includes("tarik tunai") || lower.includes("pindah")) {
        txType = "transfer";
      }

      // Detect Category hint
      let categoryHint = "Makanan & Minuman";
      if (lower.includes("bensin") || lower.includes("gojek") || lower.includes("grab") || lower.includes("parkir")) {
        categoryHint = "Transportasi";
      } else if (lower.includes("belanja") || lower.includes("beli") || lower.includes("shopee") || lower.includes("tokopedia")) {
        categoryHint = "Belanja";
      } else if (lower.includes("listrik") || lower.includes("wifi") || lower.includes("air") || lower.includes("pulsa")) {
        categoryHint = "Tagihan & Utilitas";
      } else if (lower.includes("gaji")) {
        categoryHint = "Gaji & Pendapatan";
      }

      return {
        amount,
        txType,
        accountHint,
        categoryHint,
        note: input.text,
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
});
