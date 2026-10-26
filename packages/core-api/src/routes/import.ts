import { Router, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { db, accounts, categories, transactions, ledgers } from "@finiq/shared";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const importRoutes = Router();

const batchImportSchema = z.object({
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
});

// POST /import/batch
importRoutes.post("/batch", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const input = batchImportSchema.parse(req.body);

  // 1. Resolve target ledger
  let targetLedgerId = input.targetLedgerId;
  if (!targetLedgerId) {
    const existingLedgers = await db
      .select()
      .from(ledgers)
      .where(eq(ledgers.userId, userId))
      .limit(1);

    if (existingLedgers.length > 0) {
      targetLedgerId = existingLedgers[0].id;
    } else {
      const newLedgerId = crypto.randomUUID();
      await db.insert(ledgers).values({
        id: newLedgerId,
        userId,
        name: "Buku Kas Utama",
        currency: "IDR",
        monthStartDay: 1,
      });
      targetLedgerId = newLedgerId;
    }
  }

  // 2. Fetch existing accounts
  const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));
  const accountMap = new Map<string, any>();
  for (const a of userAccounts) {
    accountMap.set(a.name.toLowerCase().trim(), a);
    accountMap.set(a.id, a);
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
      userId,
      name: "Kas Tunai",
      group: "Cash",
      currency: "IDR",
      initialBalance: 0,
      balance: 0,
      note: "Dompet uang tunai utama",
    };
    await db.insert(accounts).values(initialAcc);
    defaultAccount = initialAcc as any;
    accountMap.set("kas tunai", initialAcc);
    accountMap.set(newAccId, initialAcc);
  }

  // 3. Fetch existing categories
  const userCategories = await db.select().from(categories).where(eq(categories.userId, userId));
  const categoryMap = new Map<string, any>();
  for (const c of userCategories) {
    categoryMap.set(`${c.kind}:${c.name.toLowerCase().trim()}`, c);
  }

  let insertedCount = 0;
  let skippedCount = 0;

  for (const item of input.items) {
    // Resolve account
    let acc = accountMap.get(item.accountName.toLowerCase().trim()) || defaultAccount;

    // Resolve or create category
    let catId: string | null = null;
    if (item.txType !== "transfer") {
      const catKey = `${item.txType}:${item.categoryName.toLowerCase().trim()}`;
      let cat = categoryMap.get(catKey);
      if (!cat) {
        const newCatId = crypto.randomUUID();
        const newCat = {
          id: newCatId,
          userId,
          name: item.categoryName.trim() || (item.txType === "income" ? "Pendapatan Lain" : "Pengeluaran Lain"),
          kind: item.txType,
          icon: item.txType === "income" ? "Banknote" : "ShoppingBag",
        };
        await db.insert(categories).values(newCat);
        categoryMap.set(catKey, newCat);
        cat = newCat;
      }
      catId = cat.id;
    }

    const txDate = new Date(item.happenedAt);
    const validDate = isNaN(txDate.getTime()) ? new Date() : txDate;

    // Resolve transfer toAccountId
    let toAccId: string | null = null;
    if (item.txType === "transfer" && item.toAccountName) {
      const toAcc = accountMap.get(item.toAccountName.toLowerCase().trim());
      if (toAcc) toAccId = toAcc.id;
    }

    const txTags = item.tags || [];
    if (input.autoTag && !txTags.includes(input.autoTag)) {
      txTags.push(input.autoTag);
    }

    const txId = crypto.randomUUID();

    await db.insert(transactions).values({
      id: txId,
      userId,
      ledgerId: targetLedgerId,
      txType: item.txType,
      amount: item.amount,
      currency: "IDR",
      nativeAmount: item.amount,
      happenedAt: validDate,
      note: item.note || null,
      accountId: acc.id,
      toAccountId: toAccId,
      categoryId: catId,
      tagsJson: txTags,
      excludeFromStats: false,
      excludeFromBudget: false,
    });

    // Update account balances
    if (item.txType === "expense") {
      await db
        .update(accounts)
        .set({ balance: sql`${accounts.balance} - ${item.amount}` })
        .where(eq(accounts.id, acc.id));
    } else if (item.txType === "income") {
      await db
        .update(accounts)
        .set({ balance: sql`${accounts.balance} + ${item.amount}` })
        .where(eq(accounts.id, acc.id));
    } else if (item.txType === "transfer" && toAccId) {
      await db
        .update(accounts)
        .set({ balance: sql`${accounts.balance} - ${item.amount}` })
        .where(eq(accounts.id, acc.id));
      await db
        .update(accounts)
        .set({ balance: sql`${accounts.balance} + ${item.amount}` })
        .where(eq(accounts.id, toAccId));
    }

    insertedCount++;
  }

  return res.status(201).json({
    success: true,
    insertedCount,
    skippedCount,
    targetLedgerId,
  });
});
