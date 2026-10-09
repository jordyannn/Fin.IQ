import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { categories } from "../../db/schema";
import { eq, and, asc } from "drizzle-orm";

export const categoriesRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          kind: z.enum(["expense", "income"]).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(categories.userId, ctx.userId)];
      if (input?.kind) {
        conditions.push(eq(categories.kind, input.kind));
      }

      const list = await ctx.db
        .select()
        .from(categories)
        .where(and(...conditions))
        .orderBy(asc(categories.sortOrder), asc(categories.name));

      return list;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Nama kategori wajib diisi"),
        kind: z.enum(["expense", "income"]),
        icon: z.string().default("wallet"),
        parentId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = crypto.randomUUID();
      await ctx.db
        .insert(categories)
        .values({
          id,
          userId: ctx.userId,
          name: input.name,
          kind: input.kind,
          icon: input.icon,
          parentId: input.parentId || null,
        });

      const newCategory = await ctx.db.query.categories.findFirst({
        where: eq(categories.id, id),
      });

      return newCategory!;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(categories)
        .where(and(eq(categories.id, input.id), eq(categories.userId, ctx.userId)));

      return { success: true };
    }),
});
