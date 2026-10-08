import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { transactions, accounts, categories } from "../../db/schema";
import { eq, and, desc, asc, gte, lte } from "drizzle-orm";

export const analyticsRouter = router({
  /**
   * Hero summary yang mendukung 3 scope: 'month' | 'year' | 'all'
   * serta habit stats (rata-rata harian, hari aktif, transaksi per hari)
   */
  heroSummary: protectedProcedure
    .input(
      z
        .object({
          scope: z.enum(["month", "year", "all"]).default("month"),
          period: z.string().optional(), // misal "2026-03" atau "2026"
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const scope = input?.scope || "month";
      const now = new Date();

      // Hitung rentang tanggal berdasarkan scope
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      if (scope === "month") {
        const periodStr = input?.period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const [y, m] = periodStr.split("-");
        const yr = parseInt(y, 10);
        const mo = parseInt(m, 10);
        startDate = new Date(yr, mo - 1, 1);
        endDate = new Date(yr, mo, 0, 23, 59, 59);
      } else if (scope === "year") {
        const yr = input?.period ? parseInt(input.period.split("-")[0], 10) : now.getFullYear();
        startDate = new Date(yr, 0, 1);
        endDate = new Date(yr, 11, 31, 23, 59, 59);
      }

      // Ambil transaksi untuk scope ini
      const conditions = [
        eq(transactions.userId, ctx.userId),
        eq(transactions.excludeFromStats, false),
      ];

      if (startDate && endDate) {
        conditions.push(gte(transactions.happenedAt, startDate));
        conditions.push(lte(transactions.happenedAt, endDate));
      }

      const txList = await ctx.db
        .select()
        .from(transactions)
        .where(and(...conditions))
        .orderBy(asc(transactions.happenedAt));

      let income = 0;
      let expense = 0;

      for (const tx of txList) {
        if (tx.txType === "income") income += tx.amount;
        if (tx.txType === "expense") expense += tx.amount;
      }

      const balance = income - expense;

      // Ambil semua akun untuk total kekayaan bersih
      const userAccounts = await ctx.db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, ctx.userId));
      const totalNetWorth = userAccounts.reduce((sum, a) => sum + a.balance, 0);

      // Ambil semua transaksi user sepanjang waktu untuk habit stats & hari aktif
      const allTx = await ctx.db
        .select({
          happenedAt: transactions.happenedAt,
        })
        .from(transactions)
        .where(eq(transactions.userId, ctx.userId))
        .orderBy(asc(transactions.happenedAt));

      const totalTxCount = allTx.length;
      let daysSinceFirstTx = 1;

      if (allTx.length > 0) {
        const firstDate = new Date(allTx[0].happenedAt);
        const diffDays = Math.max(1, Math.round((now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)));
        daysSinceFirstTx = diffDays;
      }

      // Rata-rata pengeluaran harian pada scope aktif
      const daysInScope =
        scope === "month"
          ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
          : scope === "year"
          ? 365
          : Math.max(1, daysSinceFirstTx);

      const dailyAvgExpense = Math.round(expense / Math.max(1, daysInScope));
      const txPerDay = (txList.length / Math.max(1, daysInScope)).toFixed(1);

      // Data Sparkline akumulatif (trend kurva saldo)
      let running = 0;
      const sparkline = txList.map((tx, idx) => {
        if (tx.txType === "income") running += tx.amount;
        if (tx.txType === "expense") running -= tx.amount;
        return {
          idx: idx + 1,
          date: new Date(tx.happenedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
          running,
        };
      });

      return {
        scope,
        income,
        expense,
        balance,
        totalNetWorth,
        totalTxCount,
        daysSinceFirstTx,
        dailyAvgExpense,
        txPerDay,
        sparkline,
      };
    }),

  /**
   * Komposisi Aset (Asset Composition Donut)
   */
  assetComposition: protectedProcedure.query(async ({ ctx }) => {
    const list = await ctx.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, ctx.userId), eq(accounts.isHidden, false)))
      .orderBy(desc(accounts.balance));

    const total = list.reduce((sum, a) => sum + Math.max(0, a.balance), 0);

    const items = list.map((acc) => ({
      id: acc.id,
      name: acc.name,
      group: acc.group,
      balance: acc.balance,
      currency: acc.currency,
      percent: total > 0 ? Math.round((Math.max(0, acc.balance) / total) * 100) : 0,
    }));

    return {
      total,
      items,
    };
  }),

  /**
   * Ranking Kategori (Top Categories List) dengan scope (month | year | all)
   */
  categoryRanks: protectedProcedure
    .input(
      z.object({
        scope: z.enum(["month", "year", "all"]).default("month"),
        kind: z.enum(["expense", "income"]).default("expense"),
        period: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      if (input.scope === "month") {
        const periodStr = input.period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const [y, m] = periodStr.split("-");
        const yr = parseInt(y, 10);
        const mo = parseInt(m, 10);
        startDate = new Date(yr, mo - 1, 1);
        endDate = new Date(yr, mo, 0, 23, 59, 59);
      } else if (input.scope === "year") {
        const yr = input.period ? parseInt(input.period.split("-")[0], 10) : now.getFullYear();
        startDate = new Date(yr, 0, 1);
        endDate = new Date(yr, 11, 31, 23, 59, 59);
      }

      const conditions = [
        eq(transactions.userId, ctx.userId),
        eq(transactions.txType, input.kind),
        eq(transactions.excludeFromStats, false),
      ];

      if (startDate && endDate) {
        conditions.push(gte(transactions.happenedAt, startDate));
        conditions.push(lte(transactions.happenedAt, endDate));
      }

      const txList = await ctx.db
        .select({
          amount: transactions.amount,
          categoryId: transactions.categoryId,
          categoryName: categories.name,
          categoryIcon: categories.icon,
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(and(...conditions));

      const map = new Map<string, { name: string; icon: string | null; total: number; count: number }>();
      let grandTotal = 0;

      for (const tx of txList) {
        const catKey = tx.categoryId || "uncategorized";
        const catName = tx.categoryName || "Lainnya";
        const entry = map.get(catKey) || { name: catName, icon: tx.categoryIcon, total: 0, count: 0 };
        entry.total += tx.amount;
        entry.count += 1;
        grandTotal += tx.amount;
        map.set(catKey, entry);
      }

      const ranks = Array.from(map.entries())
        .map(([id, data]) => ({
          id,
          name: data.name,
          icon: data.icon,
          total: data.total,
          count: data.count,
          percent: grandTotal > 0 ? Math.round((data.total / grandTotal) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total);

      return {
        grandTotal,
        ranks,
      };
    }),

  /**
   * Heatmap Tahunan 12 Bulan (Year Heatmap)
   */
  yearHeatmap: protectedProcedure
    .input(z.object({ year: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const year = input.year || new Date().getFullYear();
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59);

      const txList = await ctx.db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, ctx.userId),
            eq(transactions.excludeFromStats, false),
            gte(transactions.happenedAt, startDate),
            lte(transactions.happenedAt, endDate)
          )
        );

      // Siapkan 12 bulan
      const months = Array.from({ length: 12 }).map((_, i) => {
        const d = new Date(year, i, 1);
        const name = new Intl.DateTimeFormat("id-ID", { month: "short" }).format(d);
        return {
          monthIndex: i,
          monthName: name,
          expense: 0,
          income: 0,
          txCount: 0,
        };
      });

      for (const tx of txList) {
        const m = new Date(tx.happenedAt).getMonth();
        if (months[m]) {
          if (tx.txType === "expense") months[m].expense += tx.amount;
          if (tx.txType === "income") months[m].income += tx.amount;
          months[m].txCount += 1;
        }
      }

      return months;
    }),

  /**
   * Top Akun dan Top Tag Teraktif
   */
  topStats: protectedProcedure.query(async ({ ctx }) => {
    // Top Akun berdasarkan saldo dan transaksi
    const userAccounts = await ctx.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, ctx.userId), eq(accounts.isHidden, false)))
      .orderBy(desc(accounts.balance))
      .limit(5);

    // Ambil tag-tag yang tersimpan di transaksi
    const txWithTags = await ctx.db
      .select({ tagsJson: transactions.tagsJson })
      .from(transactions)
      .where(eq(transactions.userId, ctx.userId));

    const tagCounts = new Map<string, number>();
    for (const tx of txWithTags) {
      if (Array.isArray(tx.tagsJson)) {
        for (const t of tx.tagsJson) {
          const tagStr = String(t).trim();
          if (tagStr) {
            tagCounts.set(tagStr, (tagCounts.get(tagStr) || 0) + 1);
          }
        }
      }
    }

    const topTags = Array.from(tagCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      topAccounts: userAccounts,
      topTags,
    };
  }),

  // Legacy compatibility helpers
  summary: protectedProcedure.query(async ({ ctx }) => {
    const userAccounts = await ctx.db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, ctx.userId));
    const totalBalance = userAccounts.reduce((sum, a) => sum + a.balance, 0);

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const monthTx = await ctx.db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, ctx.userId),
          eq(transactions.excludeFromStats, false),
          gte(transactions.happenedAt, startDate),
          lte(transactions.happenedAt, endDate)
        )
      );

    let currentMonthIncome = 0;
    let currentMonthExpense = 0;
    for (const item of monthTx) {
      if (item.txType === "income") currentMonthIncome += item.amount;
      if (item.txType === "expense") currentMonthExpense += item.amount;
    }

    return {
      totalBalance,
      currentMonthIncome,
      currentMonthExpense,
      netSavings: currentMonthIncome - currentMonthExpense,
      savingsRate: currentMonthIncome > 0 ? Math.round(((currentMonthIncome - currentMonthExpense) / currentMonthIncome) * 100) : 0,
      accountCount: userAccounts.length,
    };
  }),

  monthlyTrend: protectedProcedure
    .input(z.object({ monthsCount: z.number().default(6) }).optional())
    .query(async ({ ctx, input }) => {
      const count = input?.monthsCount || 6;
      const months = [];
      const now = new Date();

      for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = new Intl.DateTimeFormat("id-ID", { month: "short" }).format(d);
        months.push({ monthKey, label, income: 0, expense: 0, net: 0 });
      }

      const startDate = new Date(now.getFullYear(), now.getMonth() - (count - 1), 1);
      const rows = await ctx.db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, ctx.userId),
            eq(transactions.excludeFromStats, false),
            gte(transactions.happenedAt, startDate)
          )
        );

      for (const tx of rows) {
        const d = new Date(tx.happenedAt);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const target = months.find((m) => m.monthKey === monthKey);
        if (target) {
          if (tx.txType === "income") target.income += tx.amount;
          if (tx.txType === "expense") target.expense += tx.amount;
          target.net = target.income - target.expense;
        }
      }

      return months;
    }),

  categoryBreakdown: protectedProcedure
    .input(z.object({ kind: z.enum(["expense", "income"]).default("expense"), month: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const currentMonthStr = input?.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const [year, month] = currentMonthStr.split("-");
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

      const txList = await ctx.db
        .select({
          amount: transactions.amount,
          categoryId: transactions.categoryId,
          categoryName: categories.name,
          categoryIcon: categories.icon,
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(
          and(
            eq(transactions.userId, ctx.userId),
            eq(transactions.txType, input?.kind || "expense"),
            eq(transactions.excludeFromStats, false),
            gte(transactions.happenedAt, startDate),
            lte(transactions.happenedAt, endDate)
          )
        );

      const map = new Map<string, { categoryName: string; categoryIcon: string | null; total: number }>();
      let totalAll = 0;

      for (const tx of txList) {
        const key = tx.categoryId || "uncategorized";
        const catName = tx.categoryName || "Lainnya";
        const existing = map.get(key) || { categoryName: catName, categoryIcon: tx.categoryIcon, total: 0 };
        existing.total += tx.amount;
        totalAll += tx.amount;
        map.set(key, existing);
      }

      const result = Array.from(map.entries()).map(([catId, data]) => ({
        categoryId: catId,
        categoryName: data.categoryName,
        categoryIcon: data.categoryIcon,
        total: data.total,
        percent: totalAll > 0 ? Math.round((data.total / totalAll) * 100) : 0,
      }));

      result.sort((a, b) => b.total - a.total);
      return result;
    }),
});
