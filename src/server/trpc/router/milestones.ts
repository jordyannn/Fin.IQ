import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { milestones, accounts, categories, transactions } from "../../db/schema";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";

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

        const startDate = new Date(m.createdAt);
        startDate.setHours(0, 0, 0, 0);

        if (m.trackingType === "account") {
          if (m.trackingDirection === "spending_limit") {
            // Target Pengeluaran (Batas Belanja Rekening / Semua Akun)
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
                    eq(transactions.txType, "expense"),
                    gte(transactions.happenedAt, startDate)
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
                    eq(transactions.txType, "expense"),
                    gte(transactions.happenedAt, startDate)
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
                gte(transactions.happenedAt, startDate)
              )
            );
          currentAmount = Number(agg?.total ?? 0);
        }

        const rawPercent = m.targetAmount > 0 ? (currentAmount / m.targetAmount) * 100 : 0;
        const percent = Math.min(Math.max(Math.round(rawPercent), 0), 100);

        const now = new Date();
        const deadlineDate = new Date(m.deadline);
        const diffMs = deadlineDate.getTime() - now.getTime();
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

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
          trackingDirection: m.trackingDirection as "savings_goal" | "spending_limit",
          deadline: m.deadline,
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
          .enum(["savings_goal", "spending_limit"])
          .default("savings_goal"),
        deadline: z.coerce.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = crypto.randomUUID();
      await ctx.db.insert(milestones).values({
        id,
        userId: ctx.userId,
        title: input.title.trim(),
        targetAmount: input.targetAmount,
        trackingType: input.trackingType,
        trackingId: input.trackingId,
        trackingDirection: input.trackingDirection,
        deadline: input.deadline,
        isCompleted: false,
      });

      return { id };
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

