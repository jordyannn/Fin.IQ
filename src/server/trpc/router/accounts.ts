import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { accounts } from "../../db/schema";
import { eq, and, asc } from "drizzle-orm";

export const accountsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          includeHidden: z.boolean().default(false),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(accounts.userId, ctx.userId)];
      if (!input?.includeHidden) {
        conditions.push(eq(accounts.isHidden, false));
      }

      const list = await ctx.db
        .select()
        .from(accounts)
        .where(and(...conditions))
        .orderBy(asc(accounts.sortOrder), asc(accounts.name));

      // Calculate total assets
      const totalBalance = list.reduce((acc, curr) => acc + curr.balance, 0);

      return {
        accounts: list,
        totalBalance,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Nama akun wajib diisi"),
        group: z.string().default("Bank card"),
        currency: z.string().default("IDR"),
        initialBalance: z.number().default(0),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [newAccount] = await ctx.db
        .insert(accounts)
        .values({
          userId: ctx.userId,
          name: input.name,
          group: input.group,
          currency: input.currency,
          initialBalance: input.initialBalance,
          balance: input.initialBalance,
          note: input.note,
        })
        .returning();

      return newAccount;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        group: z.string().optional(),
        currency: z.string().optional(),
        balance: z.number().optional(),
        initialBalance: z.number().optional(),
        note: z.string().nullable().optional(),
        isHidden: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await ctx.db
        .update(accounts)
        .set({
          ...data,
          note: data.note === null ? null : data.note,
          updatedAt: new Date(),
        })
        .where(and(eq(accounts.id, id), eq(accounts.userId, ctx.userId)))
        .returning();

      return updated;
    }),

  adjustBalance: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        newBalance: z.number(),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, any> = {
        balance: input.newBalance,
        updatedAt: new Date(),
      };
      if (input.note !== undefined) {
        updateData.note = input.note;
      }

      const [updated] = await ctx.db
        .update(accounts)
        .set(updateData)
        .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, ctx.userId)))
        .returning();

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(accounts)
        .where(and(eq(accounts.id, input.id), eq(accounts.userId, ctx.userId)));

      return { success: true };
    }),
});
