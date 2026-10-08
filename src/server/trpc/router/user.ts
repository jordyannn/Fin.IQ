import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { users, userProfiles, accounts, transactions } from "../../db/schema";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { hashPassword, verifyPassword } from "../../auth";

export const userRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    // 1. Get user record
    const userRecords = await ctx.db
      .select()
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1);

    if (userRecords.length === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Akun pengguna tidak ditemukan.",
      });
    }

    const user = userRecords[0];

    // 2. Get user profile record, create default if missing
    let profileRecords = await ctx.db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, ctx.userId))
      .limit(1);

    let profile = profileRecords[0];

    if (!profile) {
      const defaultName = user.email.split("@")[0] || "Pengguna Fin.IQ";
      await ctx.db.insert(userProfiles).values({
        userId: ctx.userId,
        displayName: defaultName.charAt(0).toUpperCase() + defaultName.slice(1),
        primaryCurrency: "IDR",
        themePrimaryColor: "#00B569",
        totpEnabled: false,
      });

      profileRecords = await ctx.db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, ctx.userId))
        .limit(1);
      profile = profileRecords[0];
    }

    // 3. Count accounts & transactions
    const userAccounts = await ctx.db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, ctx.userId));

    const totalBalance = userAccounts.reduce((acc, a) => acc + (a.balance || 0), 0);

    const txRecords = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(eq(transactions.userId, ctx.userId));

    const transactionCount = Number(txRecords[0]?.count || 0);

    return {
      id: user.id,
      email: user.email,
      displayName: profile?.displayName || "Pengguna Fin.IQ",
      avatarUrl: profile?.avatarUrl || null,
      primaryCurrency: profile?.primaryCurrency || "IDR",
      themePrimaryColor: profile?.themePrimaryColor || "#00B569",
      totpEnabled: profile?.totpEnabled || false,
      createdAt: user.createdAt,
      accountCount: userAccounts.length,
      transactionCount,
      totalBalance,
    };
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        displayName: z.string().trim().min(2, "Nama minimal 2 karakter"),
        primaryCurrency: z.string().min(3).max(5).default("IDR"),
        themePrimaryColor: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, ctx.userId))
        .limit(1);

      if (existing.length === 0) {
        await ctx.db.insert(userProfiles).values({
          userId: ctx.userId,
          displayName: input.displayName,
          primaryCurrency: input.primaryCurrency,
          themePrimaryColor: input.themePrimaryColor || "#00B569",
        });
      } else {
        await ctx.db
          .update(userProfiles)
          .set({
            displayName: input.displayName,
            primaryCurrency: input.primaryCurrency,
            themePrimaryColor: input.themePrimaryColor || existing[0].themePrimaryColor,
            updatedAt: new Date(),
          })
          .where(eq(userProfiles.userId, ctx.userId));
      }

      return {
        success: true,
        message: "Profil berhasil diperbarui.",
      };
    }),

  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1, "Kata sandi saat ini wajib diisi"),
        newPassword: z.string().min(6, "Kata sandi baru minimal 6 karakter"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userRecords = await ctx.db
        .select()
        .from(users)
        .where(eq(users.id, ctx.userId))
        .limit(1);

      if (userRecords.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pengguna tidak ditemukan.",
        });
      }

      const user = userRecords[0];

      // Verify current password
      const isValid = verifyPassword(input.currentPassword, user.passwordHash);
      if (!isValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Kata sandi saat ini tidak cocok.",
        });
      }

      // Hash and update
      const newHash = hashPassword(input.newPassword);
      await ctx.db
        .update(users)
        .set({ passwordHash: newHash })
        .where(eq(users.id, ctx.userId));

      return {
        success: true,
        message: "Kata sandi Anda berhasil diperbarui.",
      };
    }),
});
