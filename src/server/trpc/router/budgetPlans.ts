import crypto from "crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import {
  accounts,
  categories,
  ledgers,
  syncChanges,
  transactions,
} from "../../db/schema";
import {
  PLAN_SEGMENT_COLORS,
  type PeriodBudgetPlan,
  computePlanMetrics,
} from "@/lib/budget-plan";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function ymdToWibStart(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1, 0, 0, 0, 0) - WIB_OFFSET_MS);
}

function ymdToWibEnd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1, 23, 59, 59, 0) - WIB_OFFSET_MS);
}

const budgetPlanSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Judul rencana wajib diisi").max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD"),
  startingBalance: z.number().finite().nonnegative().optional(),
  targetEndingBalance: z.number().finite().positive("Target saldo akhir harus > 0"),
  trackingAccountId: z.string().min(1).default("all"),
  incomeTargets: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        amount: z.number().finite().positive(),
        note: z.string().default(""),
        categoryId: z.string().optional(),
      })
    )
    .default([]),
  expenseCaps: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        amount: z.number().finite().positive(),
        note: z.string().default(""),
        color: z.string().default(PLAN_SEGMENT_COLORS[0]!),
        categoryId: z.string().optional(),
      })
    )
    .default([]),
  timeWindows: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        amount: z.number().finite().positive(),
        sourceNote: z.string().default(""),
      })
    )
    .default([]),
});

export const budgetPlansRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const changeRows = await ctx.db
      .select()
      .from(syncChanges)
      .where(
        and(
          eq(syncChanges.userId, ctx.userId),
          eq(syncChanges.entityType, "budget_plan")
        )
      )
      .orderBy(asc(syncChanges.id));

    const latestByEntity = new Map<string, PeriodBudgetPlan>();
    for (const row of changeRows) {
      if (row.action === "delete") {
        latestByEntity.delete(row.entityId);
      } else if (row.payload && typeof row.payload === "object") {
        latestByEntity.set(row.entityId, row.payload as unknown as PeriodBudgetPlan);
      }
    }

    const plans = Array.from(latestByEntity.values()).sort((a, b) =>
      (b.updatedAt || "").localeCompare(a.updatedAt || "")
    );
    if (plans.length === 0) return [];

    const [userAccounts, userCategories] = await Promise.all([
      ctx.db
        .select({
          id: accounts.id,
          name: accounts.name,
          balance: accounts.balance,
          isHidden: accounts.isHidden,
        })
        .from(accounts)
        .where(eq(accounts.userId, ctx.userId)),
      ctx.db
        .select({
          id: categories.id,
          name: categories.name,
          kind: categories.kind,
          parentId: categories.parentId,
        })
        .from(categories)
        .where(eq(categories.userId, ctx.userId)),
    ]);

    // Map each category ID to root + direct children for rollup matching
    const childrenByParent = new Map<string, string[]>();
    for (const c of userCategories) {
      if (c.parentId) {
        const list = childrenByParent.get(c.parentId) || [];
        list.push(c.id);
        childrenByParent.set(c.parentId, list);
      }
    }
    const getCategoryFamilySet = (categoryId?: string): Set<string> => {
      const set = new Set<string>();
      if (!categoryId) return set;
      set.add(categoryId);
      for (const childId of childrenByParent.get(categoryId) || []) {
        set.add(childId);
      }
      return set;
    };

    const allVisibleBalance = userAccounts
      .filter((a) => !a.isHidden)
      .reduce((sum, a) => sum + (a.balance || 0), 0);

    const enriched = await Promise.all(
      plans.map(async (plan) => {
        const startBound = ymdToWibStart(plan.startDate);
        const endBound = ymdToWibEnd(plan.endDate);

        const accountScopeId =
          plan.trackingAccountId && plan.trackingAccountId !== "all"
            ? plan.trackingAccountId
            : null;

        const scopedBalance = accountScopeId
          ? userAccounts.find((a) => a.id === accountScopeId)?.balance ?? 0
          : allVisibleBalance;

        const periodTx = await ctx.db
          .select({
            txType: transactions.txType,
            amount: transactions.amount,
            accountId: transactions.accountId,
            categoryId: transactions.categoryId,
            happenedAt: transactions.happenedAt,
            excludeFromBudget: transactions.excludeFromBudget,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, ctx.userId),
              gte(transactions.happenedAt, startBound),
              lte(transactions.happenedAt, endBound)
            )
          );

        const filteredTx = accountScopeId
          ? periodTx.filter((t) => t.accountId === accountScopeId)
          : periodTx;

        const actualIncomeTotal = filteredTx
          .filter((t) => t.txType === "income")
          .reduce((sum, t) => sum + (t.amount || 0), 0);

        const actualExpenseTotal = filteredTx
          .filter((t) => t.txType === "expense" && !t.excludeFromBudget)
          .reduce((sum, t) => sum + (t.amount || 0), 0);

        const incomeTargetsWithActual = (plan.incomeTargets || []).map((row) => {
          const fam = getCategoryFamilySet(row.categoryId);
          const actual =
            fam.size > 0
              ? filteredTx
                  .filter(
                    (t) =>
                      t.txType === "income" &&
                      t.categoryId &&
                      fam.has(t.categoryId)
                  )
                  .reduce((sum, t) => sum + (t.amount || 0), 0)
              : 0;
          return { ...row, actualAmount: actual };
        });

        const totalExpenseCap = (plan.expenseCaps || []).reduce(
          (sum, c) => sum + (c.amount || 0),
          0
        );

        const expenseCapsWithActual = (plan.expenseCaps || []).map((row, idx) => {
          const fam = getCategoryFamilySet(row.categoryId);
          const actualSpent =
            fam.size > 0
              ? filteredTx
                  .filter(
                    (t) =>
                      t.txType === "expense" &&
                      !t.excludeFromBudget &&
                      t.categoryId &&
                      fam.has(t.categoryId)
                  )
                  .reduce((sum, t) => sum + (t.amount || 0), 0)
              : 0;
          const sharePercent =
            totalExpenseCap > 0
              ? Math.round((row.amount / totalExpenseCap) * 100)
              : 0;
          return {
            ...row,
            color: row.color || PLAN_SEGMENT_COLORS[idx % PLAN_SEGMENT_COLORS.length]!,
            sharePercent,
            actualSpent,
          };
        });

        const timeWindowsWithActual = (plan.timeWindows || []).map((win) => {
          const wStart = ymdToWibStart(win.startDate).getTime();
          const wEnd = ymdToWibEnd(win.endDate).getTime();
          const actualSpent = filteredTx
            .filter((t) => {
              if (t.txType !== "expense" || t.excludeFromBudget) return false;
              const ms = new Date(t.happenedAt).getTime();
              return ms >= wStart && ms <= wEnd;
            })
            .reduce((sum, t) => sum + (t.amount || 0), 0);
          return { ...win, actualSpent };
        });

        const metrics = computePlanMetrics(plan, scopedBalance);

        return {
          plan,
          metrics,
          liveBalance: scopedBalance,
          actualIncomeTotal,
          actualExpenseTotal,
          incomeTargetsWithActual,
          expenseCapsWithActual,
          timeWindowsWithActual,
        };
      })
    );

    return enriched;
  }),

  upsert: protectedProcedure
    .input(budgetPlanSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.startDate > input.endDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tanggal mulai tidak boleh melewati tanggal selesai.",
        });
      }

      const planId = input.id?.trim() || crypto.randomUUID();
      const userLedger = await ctx.db.query.ledgers.findFirst({
        where: eq(ledgers.userId, ctx.userId),
      });

      const normalized: PeriodBudgetPlan = {
        id: planId,
        title: input.title.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        startingBalance: input.startingBalance,
        targetEndingBalance: input.targetEndingBalance,
        trackingAccountId: input.trackingAccountId || "all",
        incomeTargets: input.incomeTargets,
        expenseCaps: input.expenseCaps.map((c, idx) => ({
          ...c,
          color: c.color || PLAN_SEGMENT_COLORS[idx % PLAN_SEGMENT_COLORS.length]!,
        })),
        timeWindows: input.timeWindows,
        updatedAt: new Date().toISOString(),
      };

      await ctx.db.insert(syncChanges).values({
        userId: ctx.userId,
        ledgerId: userLedger?.id ?? null,
        entityType: "budget_plan",
        entityId: planId,
        action: input.id ? "update" : "create",
        payload: normalized as unknown as Record<string, unknown>,
      });

      return normalized;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(syncChanges).values({
        userId: ctx.userId,
        ledgerId: null,
        entityType: "budget_plan",
        entityId: input.id,
        action: "delete",
        payload: { id: input.id, deletedAt: new Date().toISOString() },
      });

      return { success: true, id: input.id };
    }),
});

