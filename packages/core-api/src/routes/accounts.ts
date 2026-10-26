import { Router, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { db, accounts } from "@finiq/shared";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const accountRoutes = Router();

// GET /accounts
accountRoutes.get("/", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const includeHidden = req.query.includeHidden === "true";

  const conditions = [eq(accounts.userId, userId)];
  if (!includeHidden) {
    conditions.push(eq(accounts.isHidden, false));
  }

  const list = await db
    .select()
    .from(accounts)
    .where(and(...conditions))
    .orderBy(asc(accounts.sortOrder), asc(accounts.name));

  const totalBalance = list.reduce((acc, curr) => acc + curr.balance, 0);

  return res.json({
    success: true,
    accounts: list,
    totalBalance,
  });
});

const createAccountSchema = z.object({
  name: z.string().min(1, "Nama akun wajib diisi"),
  group: z.string().default("Bank card"),
  currency: z.string().default("IDR"),
  initialBalance: z.number().default(0),
  note: z.string().optional(),
});

// POST /accounts
accountRoutes.post("/", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const input = createAccountSchema.parse(req.body);
  const id = crypto.randomUUID();

  await db.insert(accounts).values({
    id,
    userId,
    name: input.name,
    group: input.group,
    currency: input.currency,
    initialBalance: input.initialBalance,
    balance: input.initialBalance,
    note: input.note,
  });

  const newAccount = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);

  return res.status(201).json({
    success: true,
    data: newAccount[0],
  });
});

const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  group: z.string().optional(),
  currency: z.string().optional(),
  balance: z.number().optional(),
  initialBalance: z.number().optional(),
  note: z.string().nullable().optional(),
  isHidden: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

// PATCH /accounts/:id
accountRoutes.patch("/:id", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const id = req.params.id as string;
  const input = updateAccountSchema.parse(req.body);

  await db
    .update(accounts)
    .set({
      ...input,
      note: input.note === null ? null : input.note,
      updatedAt: new Date(),
    })
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));

  const updated = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .limit(1);

  if (updated.length === 0) {
    return res.status(404).json({
      success: false,
      error: "NotFound",
      message: "Akun tidak ditemukan.",
    });
  }

  return res.json({
    success: true,
    data: updated[0],
  });
});

// POST /accounts/:id/adjust-balance
accountRoutes.post("/:id/adjust-balance", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const id = req.params.id as string;
  const { newBalance, note } = z.object({
    newBalance: z.number(),
    note: z.string().optional(),
  }).parse(req.body);

  const updateData: Record<string, any> = {
    balance: newBalance,
    updatedAt: new Date(),
  };
  if (note !== undefined) {
    updateData.note = note;
  }

  await db
    .update(accounts)
    .set(updateData)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));

  const updated = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .limit(1);

  return res.json({
    success: true,
    data: updated[0],
  });
});

// DELETE /accounts/:id
accountRoutes.delete("/:id", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const id = req.params.id as string;

  await db
    .delete(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));

  return res.json({
    success: true,
    message: "Akun berhasil dihapus.",
  });
});
