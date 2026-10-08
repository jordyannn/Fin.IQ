import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { ledgers, ledgerMembers, ledgerInvites } from "../../db/schema";
import { eq, and } from "drizzle-orm";

export const ledgersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const list = await ctx.db
      .select()
      .from(ledgers)
      .where(eq(ledgers.userId, ctx.userId));

    return list;
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Nama buku kas wajib diisi"),
        currency: z.string().default("IDR"),
        monthStartDay: z.number().min(1).max(28).default(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [newLedger] = await ctx.db
        .insert(ledgers)
        .values({
          userId: ctx.userId,
          name: input.name,
          currency: input.currency,
          monthStartDay: input.monthStartDay,
        })
        .returning();

      return newLedger;
    }),

  createInvite: protectedProcedure
    .input(
      z.object({
        ledgerId: z.string(),
        role: z.enum(["editor", "viewer"]).default("editor"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Generate 6-8 digit random invite code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 hari

      const [invite] = await ctx.db
        .insert(ledgerInvites)
        .values({
          code,
          ledgerId: input.ledgerId,
          invitedBy: ctx.userId,
          targetRole: input.role,
          expiresAt,
        })
        .returning();

      return invite;
    }),

  joinWithCode: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.db.query.ledgerInvites.findFirst({
        where: eq(ledgerInvites.code, input.code.toUpperCase()),
      });

      if (!invite) {
        throw new Error("Kode undangan tidak valid.");
      }
      if (invite.usedAt) {
        throw new Error("Kode undangan sudah pernah digunakan.");
      }
      if (new Date() > invite.expiresAt) {
        throw new Error("Kode undangan sudah kedaluwarsa.");
      }

      // Masukkan user ke ledger members
      await ctx.db.insert(ledgerMembers).values({
        ledgerId: invite.ledgerId,
        userId: ctx.userId,
        role: invite.targetRole,
      });

      // Tandai invite digunakan
      await ctx.db
        .update(ledgerInvites)
        .set({ usedAt: new Date(), usedBy: ctx.userId })
        .where(eq(ledgerInvites.code, invite.code));

      return { success: true, ledgerId: invite.ledgerId };
    }),
});
