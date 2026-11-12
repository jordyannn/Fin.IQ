import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { budgets, categories, transactions } from "../../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { upsertVerifiedBudget } from "../../financial-actions";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export const budgetsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        ledgerId: z.string(),
        month: z.string(), // "YYYY-MM"
      })
    )
    .query(async ({ ctx, input }) => {
      // 1. Ambil daftar budget untuk bulan ini
      const budgetItems = await ctx.db
        .select({
          id: budgets.id,
          categoryId: budgets.categoryId,
          categoryName: categories.name,
          categoryIcon: categories.icon,
          budgetAmount: budgets.amount,
          month: budgets.month,
        })
        .from(budgets)
        .leftJoin(categories, eq(budgets.categoryId, categories.id))
        .where(
          and(
            eq(budgets.userId, ctx.userId),
            eq(budgets.ledgerId, input.ledgerId),
            eq(budgets.month, input.month)
          )
        );

      // 2. Hitung pengeluaran aktual per kategori di bulan tersebut (zona WIB UTC+7)
      const [yearStr, monthStr] = input.month.split("-");
      const y = Number(yearStr);
      const m = Number(monthStr);
      const startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0) - WIB_OFFSET_MS);
      const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999) - WIB_OFFSET_MS);

      const actualSpentList = await ctx.db
        .select({
          categoryId: transactions.categoryId,
          totalSpent: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, ctx.userId),
            eq(transactions.ledgerId, input.ledgerId),
            eq(transactions.txType, "expense"),
            eq(transactions.excludeFromBudget, false),
            sql`${transactions.happenedAt} >= ${startDate}`,
            sql`${transactions.happenedAt} <= ${endDate}`
          )
        )
        .groupBy(transactions.categoryId);

      const spentMap = new Map<string, number>();
      for (const item of actualSpentList) {
        if (item.categoryId) {
          spentMap.set(item.categoryId, Number(item.totalSpent));
        }
      }

      // Gabungkan data
      const result = budgetItems.map((b) => {
        const spent = b.categoryId ? spentMap.get(b.categoryId) || 0 : 0;
        const remaining = b.budgetAmount - spent;
        const percent = b.budgetAmount > 0 ? Math.min(Math.round((spent / b.budgetAmount) * 100), 100) : 0;

        return {
          ...b,
          actualSpent: spent,
          remaining,
          percent,
        };
      });

      const totalBudget = result.reduce((acc, curr) => acc + curr.budgetAmount, 0);
      const totalSpent = result.reduce((acc, curr) => acc + curr.actualSpent, 0);

      return {
        items: result,
        totalBudget,
        totalSpent,
        totalRemaining: totalBudget - totalSpent,
      };
    }),

  set: protectedProcedure
    .input(
      z.object({
        ledgerId: z.string(),
        categoryId: z.string(),
        month: z.string(), // "YYYY-MM"
        amount: z.number().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return upsertVerifiedBudget(ctx.db, ctx.userId, input);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.budgets.findFirst({
        where: and(eq(budgets.id, input.id), eq(budgets.userId, ctx.userId)),
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pagu anggaran tidak ditemukan.",
        });
      }
      await ctx.db
        .delete(budgets)
        .where(and(eq(budgets.id, input.id), eq(budgets.userId, ctx.userId)));

      return { success: true, id: input.id };
    }),
});
