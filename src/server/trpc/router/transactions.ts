import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { transactions, accounts, categories, ledgers } from "../../db/schema";
import { eq, and, desc, sql, gte, lte, like, inArray, isNull } from "drizzle-orm";

export const transactionsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        ledgerId: z.string().optional(),
        accountId: z.string().optional(),
        categoryId: z.string().optional(),
        txType: z.enum(["expense", "income", "transfer"]).optional(),
        search: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(transactions.userId, ctx.userId)];

      if (input.ledgerId) {
        conditions.push(eq(transactions.ledgerId, input.ledgerId));
      }
      if (input.accountId) {
        conditions.push(eq(transactions.accountId, input.accountId));
      }
      if (input.categoryId) {
        if (input.categoryId === "uncategorized") {
          conditions.push(isNull(transactions.categoryId));
        } else {
          conditions.push(eq(transactions.categoryId, input.categoryId));
        }
      }
      if (input.txType) {
        conditions.push(eq(transactions.txType, input.txType));
      }
      if (input.dateFrom) {
        conditions.push(gte(transactions.happenedAt, new Date(input.dateFrom)));
      }
      if (input.dateTo) {
        conditions.push(lte(transactions.happenedAt, new Date(input.dateTo)));
      }
      if (input.search && input.search.trim().length > 0) {
        conditions.push(like(transactions.note, `%${input.search.trim()}%`));
      }

      const items = await ctx.db
        .select({
          id: transactions.id,
          txType: transactions.txType,
          amount: transactions.amount,
          currency: transactions.currency,
          happenedAt: transactions.happenedAt,
          note: transactions.note,
          accountId: transactions.accountId,
          toAccountId: transactions.toAccountId,
          categoryId: transactions.categoryId,
          tagsJson: transactions.tagsJson,
          excludeFromStats: transactions.excludeFromStats,
          excludeFromBudget: transactions.excludeFromBudget,
          accountName: accounts.name,
          categoryName: categories.name,
        })
        .from(transactions)
        .leftJoin(accounts, eq(transactions.accountId, accounts.id))
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(and(...conditions))
        .orderBy(desc(transactions.happenedAt))
        .limit(input.limit)
        .offset(input.offset);

      return {
        items,
        hasMore: items.length === input.limit,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        ledgerId: z.string(),
        txType: z.enum(["expense", "income", "transfer"]),
        amount: z.number().positive("Nominal harus lebih dari 0"),
        currency: z.string().default("IDR"),
        happenedAt: z.string().optional(),
        note: z.string().optional(),
        accountId: z.string(),
        toAccountId: z.string().optional(),
        categoryId: z.string().optional(),
        tags: z.array(z.string()).default([]),
        excludeFromStats: z.boolean().default(false),
        excludeFromBudget: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const date = input.happenedAt ? new Date(input.happenedAt) : new Date();
      const id = crypto.randomUUID();

      // Validasi & sanitasi kategori agar sinkron dengan jenis transaksi
      let finalCategoryId: string | null = null;
      if (input.txType !== "transfer" && input.categoryId) {
        const cat = await ctx.db.query.categories.findFirst({
          where: and(eq(categories.id, input.categoryId), eq(categories.userId, ctx.userId)),
        });
        if (cat && cat.kind === input.txType) {
          finalCategoryId = cat.id;
        } else {
          const fallbackCat = await ctx.db.query.categories.findFirst({
            where: and(eq(categories.kind, input.txType), eq(categories.userId, ctx.userId)),
          });
          finalCategoryId = fallbackCat?.id || null;
        }
      }

      await ctx.db
        .insert(transactions)
        .values({
          id,
          userId: ctx.userId,
          ledgerId: input.ledgerId,
          txType: input.txType,
          amount: input.amount,
          currency: input.currency,
          nativeAmount: input.amount,
          happenedAt: date,
          note: input.note,
          accountId: input.accountId,
          toAccountId: input.txType === "transfer" ? (input.toAccountId || null) : null,
          categoryId: finalCategoryId,
          tagsJson: input.tags,
          excludeFromStats: input.excludeFromStats,
          excludeFromBudget: input.excludeFromBudget,
        });

      // Update saldo akun
      if (input.txType === "expense") {
        await ctx.db
          .update(accounts)
          .set({ balance: sql`${accounts.balance} - ${input.amount}` })
          .where(eq(accounts.id, input.accountId));
      } else if (input.txType === "income") {
        await ctx.db
          .update(accounts)
          .set({ balance: sql`${accounts.balance} + ${input.amount}` })
          .where(eq(accounts.id, input.accountId));
      } else if (input.txType === "transfer" && input.toAccountId) {
        await ctx.db
          .update(accounts)
          .set({ balance: sql`${accounts.balance} - ${input.amount}` })
          .where(eq(accounts.id, input.accountId));
        await ctx.db
          .update(accounts)
          .set({ balance: sql`${accounts.balance} + ${input.amount}` })
          .where(eq(accounts.id, input.toAccountId));
      }

      const newTx = await ctx.db.query.transactions.findFirst({
        where: eq(transactions.id, id),
      });

      return newTx!;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        ledgerId: z.string().optional(),
        txType: z.enum(["expense", "income", "transfer"]),
        amount: z.number().positive("Nominal harus lebih dari 0"),
        currency: z.string().default("IDR"),
        happenedAt: z.string().optional(),
        note: z.string().optional(),
        accountId: z.string(),
        toAccountId: z.string().nullable().optional(),
        categoryId: z.string().nullable().optional(),
        tags: z.array(z.string()).default([]),
        excludeFromStats: z.boolean().default(false),
        excludeFromBudget: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Find existing transaction
      const existingTx = await ctx.db.query.transactions.findFirst({
        where: and(eq(transactions.id, input.id), eq(transactions.userId, ctx.userId)),
      });

      if (!existingTx) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Transaksi tidak ditemukan." });
      }

      // 2. Revert previous account balance effects
      if (existingTx.txType === "expense" && existingTx.accountId) {
        await ctx.db
          .update(accounts)
          .set({ balance: sql`${accounts.balance} + ${existingTx.amount}` })
          .where(eq(accounts.id, existingTx.accountId));
      } else if (existingTx.txType === "income" && existingTx.accountId) {
        await ctx.db
          .update(accounts)
          .set({ balance: sql`${accounts.balance} - ${existingTx.amount}` })
          .where(eq(accounts.id, existingTx.accountId));
      } else if (existingTx.txType === "transfer" && existingTx.accountId && existingTx.toAccountId) {
        await ctx.db
          .update(accounts)
          .set({ balance: sql`${accounts.balance} + ${existingTx.amount}` })
          .where(eq(accounts.id, existingTx.accountId));
        await ctx.db
          .update(accounts)
          .set({ balance: sql`${accounts.balance} - ${existingTx.amount}` })
          .where(eq(accounts.id, existingTx.toAccountId));
      }

      // 3. Apply new account balance effects
      if (input.txType === "expense") {
        await ctx.db
          .update(accounts)
          .set({ balance: sql`${accounts.balance} - ${input.amount}` })
          .where(eq(accounts.id, input.accountId));
      } else if (input.txType === "income") {
        await ctx.db
          .update(accounts)
          .set({ balance: sql`${accounts.balance} + ${input.amount}` })
          .where(eq(accounts.id, input.accountId));
      } else if (input.txType === "transfer" && input.toAccountId) {
        await ctx.db
          .update(accounts)
          .set({ balance: sql`${accounts.balance} - ${input.amount}` })
          .where(eq(accounts.id, input.accountId));
        await ctx.db
          .update(accounts)
          .set({ balance: sql`${accounts.balance} + ${input.amount}` })
          .where(eq(accounts.id, input.toAccountId));
      }

      const date = input.happenedAt ? new Date(input.happenedAt) : new Date();

      // 4. Validasi & sanitasi kategori agar sinkron dengan jenis transaksi
      let finalCategoryId: string | null = null;
      if (input.txType !== "transfer" && input.categoryId) {
        const cat = await ctx.db.query.categories.findFirst({
          where: and(eq(categories.id, input.categoryId), eq(categories.userId, ctx.userId)),
        });
        if (cat && cat.kind === input.txType) {
          finalCategoryId = cat.id;
        } else {
          const fallbackCat = await ctx.db.query.categories.findFirst({
            where: and(eq(categories.kind, input.txType), eq(categories.userId, ctx.userId)),
          });
          finalCategoryId = fallbackCat?.id || null;
        }
      }

      // 5. Update transaction row
      await ctx.db
        .update(transactions)
        .set({
          ledgerId: input.ledgerId || existingTx.ledgerId,
          txType: input.txType,
          amount: input.amount,
          currency: input.currency,
          nativeAmount: input.amount,
          happenedAt: date,
          note: input.note || null,
          accountId: input.accountId,
          toAccountId: input.txType === "transfer" ? (input.toAccountId || null) : null,
          categoryId: finalCategoryId,
          tagsJson: input.tags,
          excludeFromStats: input.excludeFromStats,
          excludeFromBudget: input.excludeFromBudget,
        })
        .where(and(eq(transactions.id, input.id), eq(transactions.userId, ctx.userId)));

      return { success: true, id: input.id };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tx = await ctx.db.query.transactions.findFirst({
        where: and(eq(transactions.id, input.id), eq(transactions.userId, ctx.userId)),
      });

      if (!tx) {
        throw new Error("Transaksi tidak ditemukan.");
      }

      // Rollback saldo
      if (tx.txType === "expense" && tx.accountId) {
        await ctx.db
          .update(accounts)
          .set({ balance: sql`${accounts.balance} + ${tx.amount}` })
          .where(eq(accounts.id, tx.accountId));
      } else if (tx.txType === "income" && tx.accountId) {
        await ctx.db
          .update(accounts)
          .set({ balance: sql`${accounts.balance} - ${tx.amount}` })
          .where(eq(accounts.id, tx.accountId));
      } else if (tx.txType === "transfer" && tx.accountId && tx.toAccountId) {
        await ctx.db
          .update(accounts)
          .set({ balance: sql`${accounts.balance} + ${tx.amount}` })
          .where(eq(accounts.id, tx.accountId));
        await ctx.db
          .update(accounts)
          .set({ balance: sql`${accounts.balance} - ${tx.amount}` })
          .where(eq(accounts.id, tx.toAccountId));
      }

      await ctx.db.delete(transactions).where(eq(transactions.id, input.id));

      return { success: true };
    }),

  batchDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      if (input.ids.length === 0) return { count: 0 };

      // Hapus transaksi
      await ctx.db
        .delete(transactions)
        .where(and(eq(transactions.userId, ctx.userId), inArray(transactions.id, input.ids)));

      return { count: input.ids.length };
    }),
});
