import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { milestones, accounts, categories, transactions } from "../../db/schema";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import { createVerifiedMilestone } from "../../financial-actions";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function toStartOfWibDay(date: Date): Date {
  const shifted = new Date(date.getTime() + WIB_OFFSET_MS);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
      WIB_OFFSET_MS
  );
}

function toEndOfWibDay(date: Date): Date {
  const shifted = new Date(date.getTime() + WIB_OFFSET_MS);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
      23,
      59,
      59,
      0
    ) - WIB_OFFSET_MS
  );
}

export const milestonesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const items = await ctx.db
      .select()
      .from(milestones)
      .where(eq(milestones.userId, ctx.userId))
      .orderBy(milestones.deadline);

    const result = await Promise.all(
      items.map(async (m) => {
        let currentAmount = 0;
        let trackingName = "";

        const startDate = toStartOfWibDay(new Date(m.createdAt));
        const endDate = toEndOfWibDay(new Date(m.deadline));

        if (m.trackingType === "account") {
          if (
            m.trackingDirection === "spending_limit" ||
            m.trackingDirection === "income_goal"
          ) {
            const targetTxType =
              m.trackingDirection === "spending_limit" ? "expense" : "income";

            if (m.trackingId === "all") {
              trackingName = "Semua Akun";
              const [agg] = await ctx.db
                .select({
                  total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
                })
                .from(transactions)
                .where(
                  and(
                    eq(transactions.userId, ctx.userId),
                    eq(transactions.txType, targetTxType),
                    ...(m.trackingDirection === "spending_limit"
                      ? [eq(transactions.excludeFromBudget, false)]
                      : []),
                    gte(transactions.happenedAt, startDate),
                    lte(transactions.happenedAt, endDate)
                  )
                );
              currentAmount = Number(agg?.total ?? 0);
            } else {
              const acc = await ctx.db.query.accounts.findFirst({
                where: and(eq(accounts.id, m.trackingId), eq(accounts.userId, ctx.userId)),
              });
              trackingName = acc?.name ?? "Account";

              const [agg] = await ctx.db
                .select({
                  total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
                })
                .from(transactions)
                .where(
                  and(
                    eq(transactions.userId, ctx.userId),
                    eq(transactions.accountId, m.trackingId),
                    eq(transactions.txType, targetTxType),
                    ...(m.trackingDirection === "spending_limit"
                      ? [eq(transactions.excludeFromBudget, false)]
                      : []),
                    gte(transactions.happenedAt, startDate),
                    lte(transactions.happenedAt, endDate)
                  )
                );
              currentAmount = Number(agg?.total ?? 0);
            }
          } else {
            // Target Saldo / Tabungan (savings_goal)
            if (m.trackingId === "all") {
              trackingName = "Semua Akun";
              const [agg] = await ctx.db
                .select({
                  total: sql<number>`coalesce(sum(${accounts.balance}), 0)`,
                })
                .from(accounts)
                .where(
                  and(
                    eq(accounts.userId, ctx.userId),
                    eq(accounts.isHidden, false)
                  )
                );
              currentAmount = Number(agg?.total ?? 0);
            } else {
              const acc = await ctx.db.query.accounts.findFirst({
                where: and(eq(accounts.id, m.trackingId), eq(accounts.userId, ctx.userId)),
              });
              currentAmount = acc?.balance ?? 0;
              trackingName = acc?.name ?? "Account";
            }
          }
        } else {
          const cat = await ctx.db.query.categories.findFirst({
            where: and(eq(categories.id, m.trackingId), eq(categories.userId, ctx.userId)),
          });
          trackingName = cat?.name ?? "Category";

          const txType = m.trackingDirection === "spending_limit" ? "expense" : "income";
          const [agg] = await ctx.db
            .select({
              total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
            })
            .from(transactions)
            .where(
              and(
                eq(transactions.userId, ctx.userId),
                eq(transactions.categoryId, m.trackingId),
                eq(transactions.txType, txType),
                ...(m.trackingDirection === "spending_limit"
                  ? [eq(transactions.excludeFromBudget, false)]
                  : []),
                gte(transactions.happenedAt, startDate),
                lte(transactions.happenedAt, endDate)
              )
            );
          currentAmount = Number(agg?.total ?? 0);
        }

        const rawPercent = m.targetAmount > 0 ? (currentAmount / m.targetAmount) * 100 : 0;
        const percent = Math.min(Math.max(Math.round(rawPercent), 0), 100);

        const now = new Date();
        const deadlineDate = new Date(m.deadline);
        const hasStarted = now.getTime() >= startDate.getTime();
        const daysUntilStart = hasStarted
          ? 0
          : Math.max(1, Math.ceil((startDate.getTime() - now.getTime()) / 86_400_000));
        const diffMs = endDate.getTime() - now.getTime();
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const durationDays = Math.max(
          1,
          Math.round((toStartOfWibDay(deadlineDate).getTime() - startDate.getTime()) / 86_400_000) +
            1
        );

        return {
          id: m.id,
          title: m.title,
          targetAmount: m.targetAmount,
          currentAmount,
          percent,
          rawPercent: Math.round(rawPercent),
          trackingType: m.trackingType as "account" | "category",
          trackingId: m.trackingId,
          trackingName,
          trackingDirection: m.trackingDirection as
            | "savings_goal"
            | "spending_limit"
            | "income_goal",
          startDate: m.createdAt,
          deadline: m.deadline,
          durationDays,
          hasStarted,
          daysUntilStart,
          daysLeft,
          isOverdue: daysLeft < 0 && !m.isCompleted,
          isCompleted: m.isCompleted,
          completedAt: m.completedAt,
          createdAt: m.createdAt,
        };
      })
    );

    return result;
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1, "Title is required").max(255),
        targetAmount: z.number().positive("Target amount must be positive"),
        trackingType: z.enum(["account", "category"]),
        trackingId: z.string().min(1, "Target ID is required"),
        trackingDirection: z
          .enum(["savings_goal", "spending_limit", "income_goal"])
          .default("savings_goal"),
        startDate: z.coerce.date().optional(),
        deadline: z.coerce.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const created = await createVerifiedMilestone(ctx.db, ctx.userId, input);
      return { id: created.id };
    }),

  toggleComplete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.milestones.findFirst({
        where: and(eq(milestones.id, input.id), eq(milestones.userId, ctx.userId)),
      });

      if (!existing) {
        throw new Error("Milestone not found");
      }

      const nextCompleted = !existing.isCompleted;
      await ctx.db
        .update(milestones)
        .set({
          isCompleted: nextCompleted,
          completedAt: nextCompleted ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(milestones.id, input.id));

      return { id: input.id, isCompleted: nextCompleted };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(milestones)
        .where(and(eq(milestones.id, input.id), eq(milestones.userId, ctx.userId)));

      return { success: true };
    }),
});

