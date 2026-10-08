import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { users, userProfiles, ledgers, accounts, categories } from "../../db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { hashPassword, verifyPassword, createSessionToken } from "../../auth";

export const authRouter = router({
  login: publicProcedure
    .input(
      z.object({
        email: z.string().trim().email("Format email tidak valid"),
        password: z.string().min(1, "Kata sandi wajib diisi"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const emailLower = input.email.toLowerCase();

      const userRecords = await ctx.db
        .select()
        .from(users)
        .where(eq(users.email, emailLower))
        .limit(1);

      if (userRecords.length === 0) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Email atau kata sandi tidak sesuai.",
        });
      }

      const user = userRecords[0];

      if (!user.isEnabled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Akun Anda telah dinonaktifkan. Silakan hubungi admin.",
        });
      }

      const isValid = verifyPassword(input.password, user.passwordHash);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Email atau kata sandi tidak sesuai.",
        });
      }

      // Fetch or create profile
      const profileRecords = await ctx.db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, user.id))
        .limit(1);

      const displayName =
        profileRecords[0]?.displayName ||
        user.email.split("@")[0].charAt(0).toUpperCase() + user.email.split("@")[0].slice(1);

      // Create session token
      const token = createSessionToken({ userId: user.id, email: user.email });

      return {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          displayName,
          primaryCurrency: profileRecords[0]?.primaryCurrency || "IDR",
        },
      };
    }),

  register: publicProcedure
    .input(
      z.object({
        email: z.string().trim().email("Format email tidak valid"),
        password: z.string().min(6, "Kata sandi minimal 6 karakter"),
        displayName: z.string().trim().min(2, "Nama minimal 2 karakter"),
        primaryCurrency: z.string().default("IDR"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const emailLower = input.email.toLowerCase();

      // Check if user already exists
      const existing = await ctx.db
        .select()
        .from(users)
        .where(eq(users.email, emailLower))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email ini sudah terdaftar. Silakan gunakan email lain atau langsung masuk.",
        });
      }

      // Hash password and create user
      const hashedPassword = hashPassword(input.password);
      const newUserId = crypto.randomUUID();

      await ctx.db.insert(users).values({
        id: newUserId,
        email: emailLower,
        passwordHash: hashedPassword,
        isAdmin: false,
        isEnabled: true,
      });

      // Create profile
      await ctx.db.insert(userProfiles).values({
        userId: newUserId,
        displayName: input.displayName,
        primaryCurrency: input.primaryCurrency,
        themePrimaryColor: "#00B569",
        totpEnabled: false,
      });

      // Create default ledger (Buku Kas Utama)
      const ledgerId = crypto.randomUUID();
      await ctx.db.insert(ledgers).values({
        id: ledgerId,
        userId: newUserId,
        name: "Buku Kas Utama",
        currency: input.primaryCurrency,
        monthStartDay: 1,
      });

      // Create initial cash account
      await ctx.db.insert(accounts).values({
        userId: newUserId,
        name: "Kas Tunai",
        group: "Cash",
        currency: input.primaryCurrency,
        initialBalance: 0,
        balance: 0,
        note: "Dompet uang tunai utama",
      });

      // Seed starter categories
      const starterCategories = [
        { name: "Makanan & Minuman", kind: "expense", icon: "Utensils" },
        { name: "Transportasi", kind: "expense", icon: "Car" },
        { name: "Belanja & Kebutuhan", kind: "expense", icon: "ShoppingBag" },
        { name: "Tagihan & Utilitas", kind: "expense", icon: "Receipt" },
        { name: "Gaji & Pendapatan", kind: "income", icon: "Briefcase" },
        { name: "Bonus & Investasi", kind: "income", icon: "TrendingUp" },
      ];

      for (const cat of starterCategories) {
        await ctx.db.insert(categories).values({
          userId: newUserId,
          name: cat.name,
          kind: cat.kind,
          icon: cat.icon,
        });
      }

      // Create session token
      const token = createSessionToken({ userId: newUserId, email: emailLower });

      return {
        success: true,
        token,
        user: {
          id: newUserId,
          email: emailLower,
          displayName: input.displayName,
          primaryCurrency: input.primaryCurrency,
        },
      };
    }),

  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) {
      return null;
    }

    const userRecords = await ctx.db
      .select()
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1);

    if (userRecords.length === 0) {
      return null;
    }

    const profileRecords = await ctx.db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, ctx.userId))
      .limit(1);

    const user = userRecords[0];
    const profile = profileRecords[0];

    return {
      id: user.id,
      email: user.email,
      displayName: profile?.displayName || user.email.split("@")[0],
      avatarUrl: profile?.avatarUrl || null,
      primaryCurrency: profile?.primaryCurrency || "IDR",
      isAdmin: user.isAdmin,
    };
  }),

  logout: publicProcedure.mutation(async () => {
    return {
      success: true,
      message: "Berhasil keluar dari akun.",
    };
  }),
});
