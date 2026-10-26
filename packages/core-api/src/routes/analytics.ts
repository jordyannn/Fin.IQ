import { Router, Response } from "express";
import { z } from "zod";
import { db, transactions, accounts, categories } from "@finiq/shared";
import { eq, and, desc, asc, gte, lte } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const analyticsRoutes = Router();

function formatDateStr(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// GET /analytics/hero-summary
analyticsRoutes.get("/hero-summary", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const scope = (req.query.scope as string) || "this_month";
  const period = req.query.period as string | undefined;
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;

  const now = new Date();
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (dateFrom) startDate = new Date(dateFrom);
  if (dateTo) endDate = new Date(dateTo);

  if (!startDate && !endDate && scope !== "all") {
    if (scope === "month" || scope === "this_month") {
      const periodStr = period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const [y, m] = periodStr.split("-");
      const yr = parseInt(y, 10);
      const mo = parseInt(m, 10);
      startDate = new Date(yr, mo - 1, 1, 0, 0, 0, 0);
      endDate = new Date(yr, mo, 0, 23, 59, 59, 999);
    } else if (scope === "year" || scope === "this_year") {
      const yr = period ? parseInt(period.split("-")[0], 10) : now.getFullYear();
      startDate = new Date(yr, 0, 1, 0, 0, 0, 0);
      endDate = new Date(yr, 11, 31, 23, 59, 59, 999);
    }
  }

  const conditions = [eq(transactions.userId, userId)];
  if (startDate) conditions.push(gte(transactions.happenedAt, startDate));
  if (endDate) conditions.push(lte(transactions.happenedAt, endDate));

  const txList = await db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(asc(transactions.happenedAt));

  let income = 0;
  let expense = 0;
  let statsIncome = 0;
  let statsExpense = 0;

  for (const tx of txList) {
    if (tx.txType === "income") {
      income += tx.amount;
      if (!tx.excludeFromStats) statsIncome += tx.amount;
    } else if (tx.txType === "expense") {
      expense += tx.amount;
      if (!tx.excludeFromStats) statsExpense += tx.amount;
    }
  }

  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId));
  const totalNetWorth = userAccounts.reduce((sum, a) => sum + a.balance, 0);

  const allTx = await db
    .select({ happenedAt: transactions.happenedAt })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(asc(transactions.happenedAt));

  const totalTxCount = allTx.length;
  let daysSinceFirstTx = 1;

  if (allTx.length > 0) {
    const firstDate = new Date(allTx[0].happenedAt);
    daysSinceFirstTx = Math.max(1, Math.round((now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)));
  }

  const daysInScope = startDate && endDate
    ? Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
    : scope === "month"
    ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    : scope === "year"
    ? 365
    : Math.max(1, daysSinceFirstTx);

  const dailyAvgExpense = Math.round(expense / Math.max(1, daysInScope));
  const txPerDay = (txList.length / Math.max(1, daysInScope)).toFixed(1);

  let running = 0;
  const sparkline = txList.map((tx, idx) => {
    if (tx.txType === "income") running += tx.amount;
    if (tx.txType === "expense") running -= tx.amount;
    return {
      idx: idx + 1,
      date: formatDateStr(tx.happenedAt),
      running,
    };
  });

  return res.json({
    success: true,
    data: {
      scope,
      income,
      expense,
      balance: income - expense,
      statsIncome,
      statsExpense,
      statsBalance: statsIncome - statsExpense,
      totalNetWorth,
      totalTxCount,
      periodTxCount: txList.length,
      daysSinceFirstTx,
      dailyAvgExpense,
      txPerDay,
      sparkline,
    },
  });
});

// GET /analytics/asset-composition
analyticsRoutes.get("/asset-composition", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;

  const list = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isHidden, false)))
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

  return res.json({
    success: true,
    data: { total, items },
  });
});

// GET /analytics/category-ranks
analyticsRoutes.get("/category-ranks", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const scope = (req.query.scope as string) || "this_month";
  const kind = (req.query.kind as string) === "income" ? "income" : "expense";
  const period = req.query.period as string | undefined;
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;

  const now = new Date();
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (dateFrom) startDate = new Date(dateFrom);
  if (dateTo) endDate = new Date(dateTo);

  if (!startDate && !endDate && scope !== "all") {
    if (scope === "month" || scope === "this_month") {
      const periodStr = period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const [y, m] = periodStr.split("-");
      startDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1, 0, 0, 0, 0);
      endDate = new Date(parseInt(y, 10), parseInt(m, 10), 0, 23, 59, 59, 999);
    } else if (scope === "year" || scope === "this_year") {
      const yr = period ? parseInt(period.split("-")[0], 10) : now.getFullYear();
      startDate = new Date(yr, 0, 1, 0, 0, 0, 0);
      endDate = new Date(yr, 11, 31, 23, 59, 59, 999);
    }
  }

  const conditions = [
    eq(transactions.userId, userId),
    eq(transactions.txType, kind),
  ];
  if (startDate) conditions.push(gte(transactions.happenedAt, startDate));
  if (endDate) conditions.push(lte(transactions.happenedAt, endDate));

  const txList = await db
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

  return res.json({
    success: true,
    data: { grandTotal, ranks },
  });
});

// GET /analytics/year-heatmap
analyticsRoutes.get("/year-heatmap", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();

  const startDate = new Date(Date.UTC(year, 0, 1, -7, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, 11, 31, 16, 59, 59, 999));

  const txList = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.happenedAt, startDate),
        lte(transactions.happenedAt, endDate)
      )
    );

  const months = Array.from({ length: 12 }).map((_, i) => {
    const d = new Date(Date.UTC(year, i, 1));
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
    const d = new Date(tx.happenedAt.getTime() + 7 * 3600000);
    const m = d.getUTCMonth();
    if (months[m]) {
      if (tx.txType === "expense") months[m].expense += tx.amount;
      if (tx.txType === "income") months[m].income += tx.amount;
      months[m].txCount += 1;
    }
  }

  return res.json({
    success: true,
    data: months,
  });
});

// GET /analytics/top-stats
analyticsRoutes.get("/top-stats", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;

  const userAccounts = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isHidden, false)))
    .orderBy(desc(accounts.balance))
    .limit(5);

  const txWithTags = await db
    .select({ tagsJson: transactions.tagsJson })
    .from(transactions)
    .where(eq(transactions.userId, userId));

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

  return res.json({
    success: true,
    data: {
      topAccounts: userAccounts,
      topTags,
    },
  });
});

// GET /analytics/summary
analyticsRoutes.get("/summary", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;

  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId));
  const totalBalance = userAccounts.reduce((sum, a) => sum + a.balance, 0);

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const monthTx = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
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

  return res.json({
    success: true,
    data: {
      totalBalance,
      currentMonthIncome,
      currentMonthExpense,
      netSavings: currentMonthIncome - currentMonthExpense,
      savingsRate: currentMonthIncome > 0 ? Math.round(((currentMonthIncome - currentMonthExpense) / currentMonthIncome) * 100) : 0,
      accountCount: userAccounts.length,
    },
  });
});

// GET /analytics/monthly-trend
analyticsRoutes.get("/monthly-trend", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const count = req.query.monthsCount ? parseInt(req.query.monthsCount as string, 10) : 6;
  const months = [];
  const nowWib = new Date(Date.now() + 7 * 3600000);

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(nowWib.getUTCFullYear(), nowWib.getUTCMonth() - i, 1));
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("id-ID", { month: "short" }).format(d);
    months.push({ monthKey, label, income: 0, expense: 0, net: 0 });
  }

  const startD = new Date(Date.UTC(nowWib.getUTCFullYear(), nowWib.getUTCMonth() - (count - 1), 1, -7, 0, 0, 0));
  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.happenedAt, startD)
      )
    );

  for (const tx of rows) {
    const d = new Date(tx.happenedAt.getTime() + 7 * 3600000);
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const target = months.find((m) => m.monthKey === monthKey);
    if (target) {
      if (tx.txType === "income") target.income += tx.amount;
      if (tx.txType === "expense") target.expense += tx.amount;
      target.net = target.income - target.expense;
    }
  }

  return res.json({
    success: true,
    data: months,
  });
});

// GET /analytics/category-breakdown
analyticsRoutes.get("/category-breakdown", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const kind = (req.query.kind as string) === "income" ? "income" : "expense";
  const now = new Date();
  const currentMonthStr = (req.query.month as string) || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [year, month] = currentMonthStr.split("-");
  const startDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(parseInt(year, 10), parseInt(month, 10), 0, 23, 59, 59, 999);

  const txList = await db
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
        eq(transactions.userId, userId),
        eq(transactions.txType, kind),
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

  return res.json({
    success: true,
    data: result,
  });
});
