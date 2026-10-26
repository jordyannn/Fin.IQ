import { Router, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import {
  db,
  transactions,
  accounts,
  categories,
} from "@finiq/shared";
import { eq, and, desc, sql, gte, lte, like, inArray, isNull } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const transactionRoutes = Router();

// GET /transactions
transactionRoutes.get("/", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const {
    ledgerId,
    accountId,
    categoryId,
    txType,
    search,
    dateFrom,
    dateTo,
    limit = "50",
    offset = "0",
  } = req.query;

  const parsedLimit = Math.min(Math.max(1, parseInt(limit as string, 10) || 50), 500);
  const parsedOffset = Math.max(0, parseInt(offset as string, 10) || 0);

  const conditions = [eq(transactions.userId, userId)];

  if (ledgerId && typeof ledgerId === "string") {
    conditions.push(eq(transactions.ledgerId, ledgerId));
  }
  if (accountId && typeof accountId === "string") {
    conditions.push(eq(transactions.accountId, accountId));
  }
  if (categoryId && typeof categoryId === "string") {
    if (categoryId === "uncategorized") {
      conditions.push(isNull(transactions.categoryId));
    } else {
      conditions.push(eq(transactions.categoryId, categoryId));
    }
  }
  if (txType && (txType === "expense" || txType === "income" || txType === "transfer")) {
    conditions.push(eq(transactions.txType, txType));
  }
  if (dateFrom && typeof dateFrom === "string") {
    conditions.push(gte(transactions.happenedAt, new Date(dateFrom)));
  }
  if (dateTo && typeof dateTo === "string") {
    conditions.push(lte(transactions.happenedAt, new Date(dateTo)));
  }
  if (search && typeof search === "string" && search.trim().length > 0) {
    conditions.push(like(transactions.note, `%${search.trim()}%`));
  }

  const items = await db
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
    .limit(parsedLimit)
    .offset(parsedOffset);

  const allMatching = await db
    .select({
      txType: transactions.txType,
      amount: transactions.amount,
      excludeFromStats: transactions.excludeFromStats,
    })
    .from(transactions)
    .where(and(...conditions));

  let totalIncome = 0;
  let totalExpense = 0;
  let statsIncome = 0;
  let statsExpense = 0;

  for (const t of allMatching) {
    if (t.txType === "income") {
      totalIncome += t.amount;
      if (!t.excludeFromStats) statsIncome += t.amount;
    } else if (t.txType === "expense") {
      totalExpense += t.amount;
      if (!t.excludeFromStats) statsExpense += t.amount;
    }
  }

  return res.json({
    success: true,
    items,
    hasMore: items.length === parsedLimit,
    summary: {
      totalCount: allMatching.length,
      income: totalIncome,
      expense: totalExpense,
      net: totalIncome - totalExpense,
      statsIncome,
      statsExpense,
      statsNet: statsIncome - statsExpense,
    },
  });
});

const createTxSchema = z.object({
  ledgerId: z.string(),
  txType: z.enum(["expense", "income", "transfer"]),
  amount: z.number().positive("Nominal harus lebih dari 0"),
  currency: z.string().default("IDR"),
  happenedAt: z.union([z.string(), z.date()]).optional(),
  note: z.string().optional(),
  accountId: z.string(),
  toAccountId: z.string().optional(),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  excludeFromStats: z.boolean().default(false),
  excludeFromBudget: z.boolean().default(false),
});

// POST /transactions
transactionRoutes.post("/", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const input = createTxSchema.parse(req.body);

  const date = input.happenedAt ? new Date(input.happenedAt) : new Date();
  const id = crypto.randomUUID();

  let finalCategoryId: string | null = null;
  if (input.txType !== "transfer" && input.categoryId) {
    const cat = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, input.categoryId), eq(categories.userId, userId)))
      .limit(1);

    if (cat.length > 0 && cat[0].kind === input.txType) {
      finalCategoryId = cat[0].id;
    } else {
      const fallbackCat = await db
        .select()
        .from(categories)
        .where(and(eq(categories.kind, input.txType), eq(categories.userId, userId)))
        .limit(1);
      finalCategoryId = fallbackCat[0]?.id || null;
    }
  }

  await db.insert(transactions).values({
    id,
    userId,
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

  // Update account balance
  if (input.txType === "expense") {
    await db
      .update(accounts)
      .set({ balance: sql`${accounts.balance} - ${input.amount}` })
      .where(eq(accounts.id, input.accountId));
  } else if (input.txType === "income") {
    await db
      .update(accounts)
      .set({ balance: sql`${accounts.balance} + ${input.amount}` })
      .where(eq(accounts.id, input.accountId));
  } else if (input.txType === "transfer" && input.toAccountId) {
    await db
      .update(accounts)
      .set({ balance: sql`${accounts.balance} - ${input.amount}` })
      .where(eq(accounts.id, input.accountId));
    await db
      .update(accounts)
      .set({ balance: sql`${accounts.balance} + ${input.amount}` })
      .where(eq(accounts.id, input.toAccountId));
  }

  const newTx = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1);

  return res.status(201).json({
    success: true,
    data: newTx[0],
  });
});

const updateTxSchema = z.object({
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
});

// PATCH /transactions/:id
transactionRoutes.patch("/:id", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const id = req.params.id as string;
  const input = updateTxSchema.parse(req.body);

  const existing = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .limit(1);

  if (existing.length === 0) {
    return res.status(404).json({
      success: false,
      error: "NotFound",
      message: "Transaksi tidak ditemukan.",
    });
  }

  const existingTx = existing[0];

  // Revert previous account balance effects
  if (existingTx.txType === "expense" && existingTx.accountId) {
    await db
      .update(accounts)
      .set({ balance: sql`${accounts.balance} + ${existingTx.amount}` })
      .where(eq(accounts.id, existingTx.accountId));
  } else if (existingTx.txType === "income" && existingTx.accountId) {
    await db
      .update(accounts)
      .set({ balance: sql`${accounts.balance} - ${existingTx.amount}` })
      .where(eq(accounts.id, existingTx.accountId));
  } else if (existingTx.txType === "transfer" && existingTx.accountId && existingTx.toAccountId) {
    await db
      .update(accounts)
      .set({ balance: sql`${accounts.balance} + ${existingTx.amount}` })
      .where(eq(accounts.id, existingTx.accountId));
    await db
      .update(accounts)
      .set({ balance: sql`${accounts.balance} - ${existingTx.amount}` })
      .where(eq(accounts.id, existingTx.toAccountId));
  }

  // Apply new account balance effects
  if (input.txType === "expense") {
    await db
      .update(accounts)
      .set({ balance: sql`${accounts.balance} - ${input.amount}` })
      .where(eq(accounts.id, input.accountId));
  } else if (input.txType === "income") {
    await db
      .update(accounts)
      .set({ balance: sql`${accounts.balance} + ${input.amount}` })
      .where(eq(accounts.id, input.accountId));
  } else if (input.txType === "transfer" && input.toAccountId) {
    await db
      .update(accounts)
      .set({ balance: sql`${accounts.balance} - ${input.amount}` })
      .where(eq(accounts.id, input.accountId));
    await db
      .update(accounts)
      .set({ balance: sql`${accounts.balance} + ${input.amount}` })
      .where(eq(accounts.id, input.toAccountId));
  }

  const date = input.happenedAt ? new Date(input.happenedAt) : new Date();

  let finalCategoryId: string | null = null;
  if (input.txType !== "transfer" && input.categoryId) {
    const cat = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, input.categoryId), eq(categories.userId, userId)))
      .limit(1);

    if (cat.length > 0 && cat[0].kind === input.txType) {
      finalCategoryId = cat[0].id;
    } else {
      const fallbackCat = await db
        .select()
        .from(categories)
        .where(and(eq(categories.kind, input.txType), eq(categories.userId, userId)))
        .limit(1);
      finalCategoryId = fallbackCat[0]?.id || null;
    }
  }

  await db
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
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));

  return res.json({
    success: true,
    id,
  });
});

// DELETE /transactions/:id
transactionRoutes.delete("/:id", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const id = req.params.id as string;

  const existing = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .limit(1);

  if (existing.length === 0) {
    return res.status(404).json({
      success: false,
      error: "NotFound",
      message: "Transaksi tidak ditemukan.",
    });
  }

  const tx = existing[0];

  // Rollback balance
  if (tx.txType === "expense" && tx.accountId) {
    await db
      .update(accounts)
      .set({ balance: sql`${accounts.balance} + ${tx.amount}` })
      .where(eq(accounts.id, tx.accountId));
  } else if (tx.txType === "income" && tx.accountId) {
    await db
      .update(accounts)
      .set({ balance: sql`${accounts.balance} - ${tx.amount}` })
      .where(eq(accounts.id, tx.accountId));
  } else if (tx.txType === "transfer" && tx.accountId && tx.toAccountId) {
    await db
      .update(accounts)
      .set({ balance: sql`${accounts.balance} + ${tx.amount}` })
      .where(eq(accounts.id, tx.accountId));
    await db
      .update(accounts)
      .set({ balance: sql`${accounts.balance} - ${tx.amount}` })
      .where(eq(accounts.id, tx.toAccountId));
  }

  await db.delete(transactions).where(eq(transactions.id, id));

  return res.json({
    success: true,
    message: "Transaksi berhasil dihapus.",
  });
});

// POST /transactions/batch-delete
transactionRoutes.post("/batch-delete", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const { ids } = z.object({ ids: z.array(z.string()) }).parse(req.body);

  if (ids.length === 0) {
    return res.json({ success: true, count: 0 });
  }

  await db
    .delete(transactions)
    .where(and(eq(transactions.userId, userId), inArray(transactions.id, ids)));

  return res.json({
    success: true,
    count: ids.length,
  });
});
