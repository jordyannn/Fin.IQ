import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { accounts, categories, transactions, ledgers } from "../../db/schema";
import { eq, sql } from "drizzle-orm";

export const importRouter = router({
  executeBatch: protectedProcedure
    .input(
      z.object({
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Resolve target ledger
      let targetLedgerId = input.targetLedgerId;
      if (!targetLedgerId) {
        const firstLedger = await ctx.db.query.ledgers.findFirst({
          where: eq(ledgers.userId, ctx.userId),
        });
        if (firstLedger) {
          targetLedgerId = firstLedger.id;
        } else {
          const [newLedger] = await ctx.db
            .insert(ledgers)
            .values({
              userId: ctx.userId,
              name: "Buku Kas Utama",
              currency: "IDR",
              monthStartDay: 1,
            })
            .returning();
          targetLedgerId = newLedger.id;
        }
      }

      // 2. Cache user accounts
      const userAccounts = await ctx.db.select().from(accounts).where(eq(accounts.userId, ctx.userId));
      const accountMap = new Map<string, (typeof userAccounts)[0]>();
      for (const a of userAccounts) {
        accountMap.set(a.name.toLowerCase().trim(), a);
      }

      let defaultAccount = userAccounts[0];
      if (input.defaultAccountId) {
        const found = userAccounts.find((a) => a.id === input.defaultAccountId);
        if (found) defaultAccount = found;
      }

      // 3. Cache user categories
      const userCategories = await ctx.db.select().from(categories).where(eq(categories.userId, ctx.userId));
      const categoryMap = new Map<string, (typeof userCategories)[0]>();
      for (const c of userCategories) {
        categoryMap.set(c.name.toLowerCase().trim(), c);
      }

      // 4. Deduplication timestamps
      const existingTxTimestamps = new Set<string>();
      if (input.dedupStrategy === "skip_duplicates") {
        const existingTx = await ctx.db
          .select({
            happenedAt: transactions.happenedAt,
            amount: transactions.amount,
            accountId: transactions.accountId,
          })
          .from(transactions)
          .where(eq(transactions.userId, ctx.userId));

        for (const t of existingTx) {
          const key = `${new Date(t.happenedAt).getTime()}_${t.amount}_${t.accountId}`;
          existingTxTimestamps.add(key);
        }
      }

      const accountsCreated: string[] = [];
      const categoriesCreated: string[] = [];
      const txToInsert: any[] = [];
      let skippedCount = 0;
      const balanceDeltas = new Map<string, number>();

      for (const item of input.items) {
        const rawDateObj = new Date(item.happenedAt);
        const happenedAtDate = isNaN(rawDateObj.getTime()) ? new Date() : rawDateObj;

        // Category resolution
        const catName = item.categoryName ? item.categoryName.trim() : "Umum";
        let matchedCat = categoryMap.get(catName.toLowerCase());
        if (!matchedCat) {
          const [newCat] = await ctx.db
            .insert(categories)
            .values({
              userId: ctx.userId,
              name: catName,
              kind: item.txType === "income" ? "income" : "expense",
              icon: "Receipt",
            })
            .returning();
          matchedCat = newCat;
          categoryMap.set(catName.toLowerCase(), newCat);
          categoriesCreated.push(catName);
        }

        // Account resolution
        const accName = item.accountName ? item.accountName.trim() : defaultAccount?.name || "cash";
        let matchedAccount = accountMap.get(accName.toLowerCase()) || defaultAccount;

        if (!matchedAccount) {
          const groupName = accName.toLowerCase().includes("bank") ? "Bank card" : "Cash";
          const [newAcc] = await ctx.db
            .insert(accounts)
            .values({
              userId: ctx.userId,
              name: accName,
              group: groupName,
              currency: "IDR",
              initialBalance: 0,
              balance: 0,
            })
            .returning();
          matchedAccount = newAcc;
          accountMap.set(accName.toLowerCase(), newAcc);
          accountsCreated.push(accName);
        }

        // To Account for transfer
        let matchedToAccount = null;
        if (item.txType === "transfer" && item.toAccountName) {
          const toName = item.toAccountName.trim();
          matchedToAccount = accountMap.get(toName.toLowerCase());
          if (!matchedToAccount) {
            const [newToAcc] = await ctx.db
              .insert(accounts)
              .values({
                userId: ctx.userId,
                name: toName,
                group: "Bank card",
                currency: "IDR",
                initialBalance: 0,
                balance: 0,
              })
              .returning();
            matchedToAccount = newToAcc;
            accountMap.set(toName.toLowerCase(), newToAcc);
            accountsCreated.push(toName);
          }
        }

        // Dedup check
        if (input.dedupStrategy === "skip_duplicates") {
          const dedupKey = `${happenedAtDate.getTime()}_${item.amount}_${matchedAccount.id}`;
          if (existingTxTimestamps.has(dedupKey)) {
            skippedCount++;
            continue;
          }
          existingTxTimestamps.add(dedupKey);
        }

        const tagsList = [...(item.tags || [])];
        if (input.autoTag && input.autoTag.trim()) {
          tagsList.push(input.autoTag.trim());
        }

        txToInsert.push({
          userId: ctx.userId,
          ledgerId: targetLedgerId,
          accountId: matchedAccount.id,
          toAccountId: matchedToAccount?.id || null,
          categoryId: matchedCat.id,
          txType: item.txType,
          amount: item.amount,
          nativeAmount: item.amount,
          currency: matchedAccount.currency || "IDR",
          happenedAt: happenedAtDate,
          note: item.note || null,
          tagsJson: tagsList,
        });

        // Track balance delta
        if (item.txType === "expense") {
          balanceDeltas.set(matchedAccount.id, (balanceDeltas.get(matchedAccount.id) || 0) - item.amount);
        } else if (item.txType === "income") {
          balanceDeltas.set(matchedAccount.id, (balanceDeltas.get(matchedAccount.id) || 0) + item.amount);
        } else if (item.txType === "transfer" && matchedToAccount) {
          balanceDeltas.set(matchedAccount.id, (balanceDeltas.get(matchedAccount.id) || 0) - item.amount);
          balanceDeltas.set(matchedToAccount.id, (balanceDeltas.get(matchedToAccount.id) || 0) + item.amount);
        }
      }

      // Batch insert transactions in chunks of 200
      const chunkSize = 200;
      for (let i = 0; i < txToInsert.length; i += chunkSize) {
        const chunk = txToInsert.slice(i, i + chunkSize);
        await ctx.db.insert(transactions).values(chunk);
      }

      // Update balances
      for (const [accId, delta] of balanceDeltas.entries()) {
        await ctx.db
          .update(accounts)
          .set({
            balance: sql`${accounts.balance} + ${delta}`,
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, accId));
      }

      return {
        success: true,
        createdCount: txToInsert.length,
        skippedCount,
        accountsCreated,
        categoriesCreated,
      };
    }),
});
