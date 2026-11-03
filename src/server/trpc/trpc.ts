import { initTRPC, TRPCError } from "@trpc/server";
import { type Context } from "./context";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Middleware proteksi route
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Silakan login terlebih dahulu." });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);

// Middleware admin-only: cek isAdmin dari database
const isAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Silakan login terlebih dahulu." });
  }

  const userRecord = await ctx.db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, ctx.userId))
    .limit(1);

  if (!userRecord[0]?.isAdmin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Akses ditolak. Hanya admin yang diizinkan." });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      isAdmin: true,
    },
  });
});

export const adminProcedure = t.procedure.use(isAdmin);
