import { Router, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import {
  db,
  transactions,
  accounts,
  categories,
  ledgers,
  ledgerMembers,
} from "@finiq/shared";
import { eq, and, desc, sql, gte, lte, like, inArray, isNull, or } from "drizzle-orm";
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

// Helper anti-IDOR
async function verifyUserAccount(accountId: string, userId: string) {
  const acc = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);
  return acc.length > 0;
}

async function verifyUserLedger(ledgerId: string, userId: string) {
  const owned = await db
    .select({ id: ledgers.id })
    .from(ledgers)
    .where(and(eq(ledgers.id, ledgerId), eq(ledgers.userId, userId)))
    .limit(1);
  if (owned.length > 0) return true;

  const member = await db
    .select({ id: ledgerMembers.id })
    .from(ledgerMembers)
    .where(and(eq(ledgerMembers.ledgerId, ledgerId), eq(ledgerMembers.userId, userId)))
    .limit(1);
  return member.length > 0;
}

// POST /transactions
transactionRoutes.post("/", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const input = createTxSchema.parse(req.body);

  // 1. Verify ledger ownership / membership (Anti-IDOR)
  const hasLedgerAccess = await verifyUserLedger(input.ledgerId, userId);
  if (!hasLedgerAccess) {
    return res.status(403).json({
      success: false,
      error: "Forbidden",
      message: "Anda tidak memiliki akses ke buku kas ini.",
    });
  }

  // 2. Verify account ownership (Anti-IDOR)
  const hasAccountAccess = await verifyUserAccount(input.accountId, userId);
  if (!hasAccountAccess) {
    return res.status(404).json({
      success: false,
      error: "NotFound",
      message: "Rekening tidak ditemukan atau Anda tidak memiliki akses.",
    });
  }

  if (input.txType === "transfer") {
    if (!input.toAccountId) {
      return res.status(400).json({
        success: false,
        error: "BadRequest",
        message: "Rekening tujuan transfer wajib dipilih.",
      });
    }
    const hasToAccountAccess = await verifyUserAccount(input.toAccountId, userId);
    if (!hasToAccountAccess) {
      return res.status(404).json({
        success: false,
        error: "NotFound",
        message: "Rekening tujuan tidak ditemukan.",
      });
    }
  }

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

  // 3. Atomic Database Transaction (ACID)
  await db.transaction(async (tx) => {
    await tx.insert(transactions).values({
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

    // Update account balance atomically
    if (input.txType === "expense") {
      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} - ${input.amount}` })
        .where(eq(accounts.id, input.accountId));
    } else if (input.txType === "income") {
      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} + ${input.amount}` })
        .where(eq(accounts.id, input.accountId));
    } else if (input.txType === "transfer" && input.toAccountId) {
      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} - ${input.amount}` })
        .where(eq(accounts.id, input.accountId));
      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} + ${input.amount}` })
        .where(eq(accounts.id, input.toAccountId));
    }
  });

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

  // Verify account access (Anti-IDOR)
  const hasAccountAccess = await verifyUserAccount(input.accountId, userId);
  if (!hasAccountAccess) {
    return res.status(404).json({
      success: false,
      error: "NotFound",
      message: "Rekening tidak ditemukan atau Anda tidak memiliki akses.",
    });
  }

  if (input.txType === "transfer") {
    if (!input.toAccountId) {
      return res.status(400).json({
        success: false,
        error: "BadRequest",
        message: "Rekening tujuan transfer wajib dipilih.",
      });
    }
    const hasToAccess = await verifyUserAccount(input.toAccountId, userId);
    if (!hasToAccess) {
      return res.status(404).json({
        success: false,
        error: "NotFound",
        message: "Rekening tujuan transfer tidak ditemukan.",
      });
    }
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

  // Atomic Database Transaction: Revert old effects + Apply new effects + Update record
  await db.transaction(async (tx) => {
    // 1. Revert previous account balance effects
    if (existingTx.txType === "expense" && existingTx.accountId) {
      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} + ${existingTx.amount}` })
        .where(eq(accounts.id, existingTx.accountId));
    } else if (existingTx.txType === "income" && existingTx.accountId) {
      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} - ${existingTx.amount}` })
        .where(eq(accounts.id, existingTx.accountId));
    } else if (existingTx.txType === "transfer" && existingTx.accountId && existingTx.toAccountId) {
      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} + ${existingTx.amount}` })
        .where(eq(accounts.id, existingTx.accountId));
      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} - ${existingTx.amount}` })
        .where(eq(accounts.id, existingTx.toAccountId));
    }

    // 2. Apply new account balance effects
    if (input.txType === "expense") {
      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} - ${input.amount}` })
        .where(eq(accounts.id, input.accountId));
    } else if (input.txType === "income") {
      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} + ${input.amount}` })
        .where(eq(accounts.id, input.accountId));
    } else if (input.txType === "transfer" && input.toAccountId) {
      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} - ${input.amount}` })
        .where(eq(accounts.id, input.accountId));
      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} + ${input.amount}` })
        .where(eq(accounts.id, input.toAccountId));
    }

    // 3. Update transaction record
    await tx
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
  });

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

  const txData = existing[0];

  // Atomic Database Transaction: Rollback balance + delete record
  await db.transaction(async (tx) => {
    if (txData.txType === "expense" && txData.accountId) {
      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} + ${txData.amount}` })
        .where(eq(accounts.id, txData.accountId));
    } else if (txData.txType === "income" && txData.accountId) {
      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} - ${txData.amount}` })
        .where(eq(accounts.id, txData.accountId));
    } else if (txData.txType === "transfer" && txData.accountId && txData.toAccountId) {
      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} + ${txData.amount}` })
        .where(eq(accounts.id, txData.accountId));
      await tx
        .update(accounts)
        .set({ balance: sql`${accounts.balance} - ${txData.amount}` })
        .where(eq(accounts.id, txData.toAccountId));
    }

    await tx.delete(transactions).where(eq(transactions.id, id));
  });

  return res.json({
    success: true,
    message: "Transaksi berhasil dihapus dan saldo telah dipulihkan.",
  });
});

// POST /transactions/batch-delete
transactionRoutes.post("/batch-delete", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const { ids } = z.object({ ids: z.array(z.string()) }).parse(req.body);

  if (ids.length === 0) {
    return res.json({ success: true, count: 0 });
  }

  // Fetch all transactions to be deleted to properly revert their balance effects
  const toDelete = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), inArray(transactions.id, ids)));

  if (toDelete.length === 0) {
    return res.json({ success: true, count: 0 });
  }

  // Atomic Database Transaction: Rollback balances for all transactions, then delete them
  await db.transaction(async (tx) => {
    for (const t of toDelete) {
      if (t.txType === "expense" && t.accountId) {
        await tx
          .update(accounts)
          .set({ balance: sql`${accounts.balance} + ${t.amount}` })
          .where(eq(accounts.id, t.accountId));
      } else if (t.txType === "income" && t.accountId) {
        await tx
          .update(accounts)
          .set({ balance: sql`${accounts.balance} - ${t.amount}` })
          .where(eq(accounts.id, t.accountId));
      } else if (t.txType === "transfer" && t.accountId && t.toAccountId) {
        await tx
          .update(accounts)
          .set({ balance: sql`${accounts.balance} + ${t.amount}` })
          .where(eq(accounts.id, t.accountId));
        await tx
          .update(accounts)
          .set({ balance: sql`${accounts.balance} - ${t.amount}` })
          .where(eq(accounts.id, t.toAccountId));
      }
    }

    await tx
      .delete(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, ids)));
  });

  return res.json({
    success: true,
    count: toDelete.length,
    message: `${toDelete.length} transaksi berhasil dihapus dan seluruh saldo rekening dipulihkan.`,
  });
});
