import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import type { Database } from "./db";
import {
  accounts,
  budgets,
  categories,
  ledgers,
  milestones,
  transactions,
} from "./db/schema";

export type DbExecutor =
  | Database
  | Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface VerifiedTransactionInput {
  ledgerId: string;
  txType: "expense" | "income" | "transfer";
  amount: number;
  currency?: string;
  happenedAt?: string | Date;
  note?: string;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  tags?: string[];
  excludeFromStats?: boolean;
  excludeFromBudget?: boolean;
}

export interface VerifiedBudgetInput {
  ledgerId: string;
  categoryId: string;
  month: string; // YYYY-MM
  amount: number;
}

export interface VerifiedMilestoneInput {
  title: string;
  targetAmount: number;
  trackingType: "account" | "category";
  trackingId: string;
  trackingDirection: "savings_goal" | "spending_limit";
  deadline: string | Date;
}

async function resolveUserLedgerId(
  dbOrTx: DbExecutor,
  userId: string,
  requestedLedgerId: string
): Promise<string> {
  if (requestedLedgerId) {
    const owned = await dbOrTx.query.ledgers.findFirst({
      where: and(
        eq(ledgers.id, requestedLedgerId),
        eq(ledgers.userId, userId)
      ),
    });
    if (owned) return owned.id;
  }

  const fallback = await dbOrTx.query.ledgers.findFirst({
    where: eq(ledgers.userId, userId),
  });
  if (!fallback) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Buku kas user tidak ditemukan.",
    });
  }
  return fallback.id;
}

/**
 * Creates a verified transaction for `userId`, validating ownership of accounts,
 * category kind consistency, and ledger, then updates account balances atomically.
 */
export async function createVerifiedTransaction(
  dbOrTx: DbExecutor,
  userId: string,
  input: VerifiedTransactionInput
) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Nominal transaksi harus lebih dari 0.",
    });
  }

  const sourceAccount = await dbOrTx.query.accounts.findFirst({
    where: and(
      eq(accounts.id, input.accountId),
      eq(accounts.userId, userId)
    ),
  });
  if (!sourceAccount) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Akun asal tidak valid atau bukan milik Anda.",
    });
  }

  let validatedToAccountId: string | null = null;
  if (input.txType === "transfer") {
    if (!input.toAccountId || input.toAccountId === input.accountId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Akun tujuan transfer harus dipilih dan berbeda dari akun asal.",
      });
    }
    const targetAccount = await dbOrTx.query.accounts.findFirst({
      where: and(
        eq(accounts.id, input.toAccountId),
        eq(accounts.userId, userId)
      ),
    });
    if (!targetAccount) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Akun tujuan transfer tidak valid atau bukan milik Anda.",
      });
    }
    validatedToAccountId = targetAccount.id;
  }

  let finalCategoryId: string | null = null;
  if (input.txType !== "transfer") {
    if (input.categoryId) {
      const cat = await dbOrTx.query.categories.findFirst({
        where: and(
          eq(categories.id, input.categoryId),
          eq(categories.userId, userId)
        ),
      });
      if (cat && cat.kind === input.txType) {
        finalCategoryId = cat.id;
      }
    }
    if (!finalCategoryId) {
      const fallbackCat = await dbOrTx.query.categories.findFirst({
        where: and(
          eq(categories.kind, input.txType),
          eq(categories.userId, userId)
        ),
      });
      finalCategoryId = fallbackCat?.id ?? null;
    }
  }

  const targetLedgerId = await resolveUserLedgerId(
    dbOrTx,
    userId,
    input.ledgerId
  );

  const date = input.happenedAt ? new Date(input.happenedAt) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const id = crypto.randomUUID();

  await dbOrTx.insert(transactions).values({
    id,
    userId,
    ledgerId: targetLedgerId,
    txType: input.txType,
    amount: input.amount,
    currency: input.currency || sourceAccount.currency || "IDR",
    nativeAmount: input.amount,
    happenedAt: safeDate,
    note: input.note,
    accountId: sourceAccount.id,
    toAccountId: validatedToAccountId,
    categoryId: finalCategoryId,
    tagsJson: input.tags ?? [],
    excludeFromStats: input.excludeFromStats ?? false,
    excludeFromBudget: input.excludeFromBudget ?? false,
  });

  if (input.txType === "expense") {
    await dbOrTx
      .update(accounts)
      .set({ balance: sql`${accounts.balance} - ${input.amount}` })
      .where(and(eq(accounts.id, sourceAccount.id), eq(accounts.userId, userId)));
  } else if (input.txType === "income") {
    await dbOrTx
      .update(accounts)
      .set({ balance: sql`${accounts.balance} + ${input.amount}` })
      .where(and(eq(accounts.id, sourceAccount.id), eq(accounts.userId, userId)));
  } else if (input.txType === "transfer" && validatedToAccountId) {
    await dbOrTx
      .update(accounts)
      .set({ balance: sql`${accounts.balance} - ${input.amount}` })
      .where(and(eq(accounts.id, sourceAccount.id), eq(accounts.userId, userId)));
    await dbOrTx
      .update(accounts)
      .set({ balance: sql`${accounts.balance} + ${input.amount}` })
      .where(
        and(eq(accounts.id, validatedToAccountId), eq(accounts.userId, userId))
      );
  }

  const newTx = await dbOrTx.query.transactions.findFirst({
    where: eq(transactions.id, id),
  });
  return newTx!;
}

/**
 * Upserts a monthly category budget for `userId`, validating ownership of
 * ledger and expense category.
 */
export async function upsertVerifiedBudget(
  dbOrTx: DbExecutor,
  userId: string,
  input: VerifiedBudgetInput
) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Nominal anggaran harus lebih dari 0.",
    });
  }
  if (!/^\d{4}-\d{2}$/.test(input.month)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Format bulan anggaran harus YYYY-MM.",
    });
  }

  const cat = await dbOrTx.query.categories.findFirst({
    where: and(
      eq(categories.id, input.categoryId),
      eq(categories.userId, userId)
    ),
  });
  if (!cat || cat.kind !== "expense") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Kategori pengeluaran anggaran tidak valid.",
    });
  }

  const targetLedgerId = await resolveUserLedgerId(
    dbOrTx,
    userId,
    input.ledgerId
  );

  const existing = await dbOrTx.query.budgets.findFirst({
    where: and(
      eq(budgets.userId, userId),
      eq(budgets.ledgerId, targetLedgerId),
      eq(budgets.categoryId, cat.id),
      eq(budgets.month, input.month)
    ),
  });

  if (existing) {
    await dbOrTx
      .update(budgets)
      .set({ amount: input.amount })
      .where(and(eq(budgets.id, existing.id), eq(budgets.userId, userId)));

    const updated = await dbOrTx.query.budgets.findFirst({
      where: eq(budgets.id, existing.id),
    });
    return updated!;
  }

  const id = crypto.randomUUID();
  await dbOrTx.insert(budgets).values({
    id,
    userId,
    ledgerId: targetLedgerId,
    categoryId: cat.id,
    month: input.month,
    amount: input.amount,
  });

  const created = await dbOrTx.query.budgets.findFirst({
    where: eq(budgets.id, id),
  });
  return created!;
}

/**
 * Creates a verified milestone/target for `userId`, checking ownership of
 * the tracked account or category.
 */
export async function createVerifiedMilestone(
  dbOrTx: DbExecutor,
  userId: string,
  input: VerifiedMilestoneInput
) {
  const title = input.title.trim();
  if (!title) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Judul target keuangan tidak boleh kosong.",
    });
  }
  if (!Number.isFinite(input.targetAmount) || input.targetAmount <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Nominal target harus lebih dari 0.",
    });
  }

  if (input.trackingType === "account") {
    if (input.trackingId !== "all") {
      const acc = await dbOrTx.query.accounts.findFirst({
        where: and(
          eq(accounts.id, input.trackingId),
          eq(accounts.userId, userId)
        ),
      });
      if (!acc) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Akun yang dipantau target tidak valid.",
        });
      }
    }
  } else {
    const cat = await dbOrTx.query.categories.findFirst({
      where: and(
        eq(categories.id, input.trackingId),
        eq(categories.userId, userId)
      ),
    });
    if (!cat) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Kategori yang dipantau target tidak valid.",
      });
    }
  }

  const parsedDeadline = new Date(input.deadline);
  const safeDeadline = Number.isNaN(parsedDeadline.getTime())
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    : parsedDeadline;

  const id = crypto.randomUUID();
  await dbOrTx.insert(milestones).values({
    id,
    userId,
    title,
    targetAmount: input.targetAmount,
    trackingType: input.trackingType,
    trackingId: input.trackingId,
    trackingDirection: input.trackingDirection,
    deadline: safeDeadline,
    isCompleted: false,
  });

  const created = await dbOrTx.query.milestones.findFirst({
    where: eq(milestones.id, id),
  });

  return created ?? { id };
}
