import { Router, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { db, budgets, categories, transactions } from "@finiq/shared";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const budgetRoutes = Router();

// GET /budgets?ledgerId=xxx&month=YYYY-MM
budgetRoutes.get("/", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const ledgerId = req.query.ledgerId as string;
  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);

  if (!ledgerId) {
    return res.status(400).json({
      success: false,
      error: "BadRequest",
      message: "ledgerId query parameter wajib diisi",
    });
  }

  // 1. Fetch budget items
  const budgetItems = await db
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
        eq(budgets.userId, userId),
        eq(budgets.ledgerId, ledgerId),
        eq(budgets.month, month)
      )
    );

  // 2. Calculate actual spent per category
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  const startDate = new Date(year, m - 1, 1);
  const endDate = new Date(year, m, 0, 23, 59, 59);

  const actualSpentList = await db
    .select({
      categoryId: transactions.categoryId,
      totalSpent: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.ledgerId, ledgerId),
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

  return res.json({
    success: true,
    items: result,
    totalBudget,
    totalSpent,
    totalRemaining: totalBudget - totalSpent,
  });
});

const setBudgetSchema = z.object({
  ledgerId: z.string(),
  categoryId: z.string(),
  month: z.string(), // "YYYY-MM"
  amount: z.number().positive(),
});

// POST /budgets
budgetRoutes.post("/", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const input = setBudgetSchema.parse(req.body);

  const existing = await db
    .select()
    .from(budgets)
    .where(
      and(
        eq(budgets.userId, userId),
        eq(budgets.ledgerId, input.ledgerId),
        eq(budgets.categoryId, input.categoryId),
        eq(budgets.month, input.month)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(budgets)
      .set({ amount: input.amount })
      .where(eq(budgets.id, existing[0].id));

    const updated = await db
      .select()
      .from(budgets)
      .where(eq(budgets.id, existing[0].id))
      .limit(1);

    return res.json({
      success: true,
      data: updated[0],
    });
  }

  const id = crypto.randomUUID();
  await db.insert(budgets).values({
    id,
    userId,
    ledgerId: input.ledgerId,
    categoryId: input.categoryId,
    month: input.month,
    amount: input.amount,
  });

  const created = await db
    .select()
    .from(budgets)
    .where(eq(budgets.id, id))
    .limit(1);

  return res.status(201).json({
    success: true,
    data: created[0],
  });
});
