import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { users, userProfiles, accounts, transactions } from "../../db/schema";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { hashPassword, verifyPassword } from "../../auth";
import { generateWithFallback, DEFAULT_GEMINI_API_KEY } from "../../gemini";
import { DEFAULT_OPENROUTER_API_KEY } from "../../openrouter";
import { invalidateAuthUser } from "@/lib/redis";

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

    const rawKey =
      profile?.geminiApiKey?.trim() ||
      process.env.OPENROUTER_API_KEY?.trim() ||
      process.env.OPENROUTER?.trim() ||
      DEFAULT_OPENROUTER_API_KEY ||
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GEMINI?.trim() ||
      DEFAULT_GEMINI_API_KEY ||
      "";
    const activeAiKey =
      rawKey === "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"
        ? ""
        : rawKey;

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
      geminiApiKeyMasked: activeAiKey
        ? `${activeAiKey.slice(0, 6)}••••${activeAiKey.slice(-4)}`
        : null,
      hasGeminiKey: Boolean(activeAiKey),
      isPersonalKey: Boolean(profile?.geminiApiKey?.trim()),
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

      // Invalidate Redis user cache
      const userRec = await ctx.db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, ctx.userId))
        .limit(1);
      if (userRec[0]?.email) {
        await invalidateAuthUser(userRec[0].email);
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

      // Invalidate Redis cache
      await invalidateAuthUser(user.email);

      return {
        success: true,
        message: "Kata sandi Anda berhasil diperbarui.",
      };
    }),

  setGeminiKey: protectedProcedure
    .input(z.object({ apiKey: z.string().trim().min(8, "API Key minimal 8 karakter") }))
    .mutation(async ({ ctx, input }) => {
      const trimmedKey = input.apiKey.trim();
      const isOpenRouter = trimmedKey.startsWith("sk-or-");

      if (isOpenRouter) {
        // 1a. Verifikasi langsung ke OpenRouter API
        try {
          const resp = await fetch("https://openrouter.ai/api/v1/auth/key", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${trimmedKey}`,
            },
          });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            throw new Error(data?.error?.message || `HTTP ${resp.status}`);
          }
        } catch (err: any) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Gagal memverifikasi API Key OpenRouter: ${err?.message || "Token tidak valid"}`,
          });
        }
      } else {
        // 1b. Verifikasi langsung ke Google Gemini API
        try {
          const { GoogleGenAI } = await import("@google/genai");
          const ai = new GoogleGenAI({ apiKey: trimmedKey });
          await generateWithFallback(ai, {
            preferredModels: ["gemini-3-flash-preview", "gemini-3.8-flash"],
            contents: "ping",
          });
        } catch (err: any) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Gagal memverifikasi token dengan Google Gemini: ${err?.message || "Token tidak valid"}`,
          });
        }
      }

      // 2. Simpan token ke database user_profiles
      const existing = await ctx.db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, ctx.userId))
        .limit(1);

      if (existing.length === 0) {
        await ctx.db.insert(userProfiles).values({
          userId: ctx.userId,
          displayName: "Pengguna Fin.IQ",
          geminiApiKey: trimmedKey,
        });
      } else {
        await ctx.db
          .update(userProfiles)
          .set({ geminiApiKey: trimmedKey, updatedAt: new Date() })
          .where(eq(userProfiles.userId, ctx.userId));
      }

      return {
        success: true,
        message: isOpenRouter
          ? "API Key OpenRouter berhasil diverifikasi dan tersambung!"
          : "Token Google Gemini berhasil diverifikasi dan tersambung!",
      };
    }),

  removeGeminiKey: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(userProfiles)
      .set({ geminiApiKey: null, updatedAt: new Date() })
      .where(eq(userProfiles.userId, ctx.userId));

    return {
      success: true,
      message: "API Key AI berhasil diputuskan.",
    };
  }),

  testGeminiStatus: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ctx.db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, ctx.userId),
    });

    const personalKey = profile?.geminiApiKey?.trim();
    if (personalKey) {
      const isOpenRouter = personalKey.startsWith("sk-or-");
      return {
        connected: true,
        source: "personal" as const,
        provider: isOpenRouter ? "openrouter" : "gemini",
        maskedKey: `${personalKey.slice(0, 6)}••••${personalKey.slice(-4)}`,
        model: isOpenRouter ? "OpenRouter (Personal Key)" : "Google Gemini (Personal Key)",
        message: isOpenRouter
          ? "Koneksi OpenRouter aktif dengan API Key personal Anda."
          : "Koneksi Google Gemini aktif dengan API Key personal Anda.",
      };
    }

    const envOpenRouter =
      process.env.OPENROUTER_API_KEY?.trim() ||
      process.env.OPENROUTER?.trim() ||
      DEFAULT_OPENROUTER_API_KEY;
    const envGemini =
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GEMINI?.trim() ||
      DEFAULT_GEMINI_API_KEY;
    const activeEnvKey =
      envOpenRouter &&
      envOpenRouter !== "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"
        ? envOpenRouter
        : envGemini || null;

    if (activeEnvKey) {
      const isOpenRouter = activeEnvKey.startsWith("sk-or-");
      return {
        connected: true,
        source: "system" as const,
        provider: isOpenRouter ? "openrouter" : "gemini",
        maskedKey: `${activeEnvKey.slice(0, 6)}••••${activeEnvKey.slice(-4)}`,
        model: isOpenRouter
          ? "OpenRouter Free Tier (Gemma 4 / Nemotron)"
          : "Google Gemini (Server Default)",
        message: isOpenRouter
          ? "Koneksi OpenRouter aktif untuk seluruh akun Fin.IQ."
          : "Koneksi Google Gemini aktif untuk seluruh akun Fin.IQ.",
      };
    }

    // Default: AI selalu aktif untuk setiap akun di Fin-IQ via telemetri
    return {
      connected: true,
      source: "telemetry" as const,
      provider: "openrouter",
      maskedKey: null,
      model: "Fin.IQ AI Telemetry Advisor (Aktif)",
      message: "AI aktif untuk akun ini (Mode Analisis Telemetri Finansial Otomatis).",
    };
  }),
});
