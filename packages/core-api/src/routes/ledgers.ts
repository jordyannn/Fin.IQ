import { Router, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { db, ledgers, ledgerMembers, ledgerInvites } from "@finiq/shared";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const ledgerRoutes = Router();

// GET /ledgers
ledgerRoutes.get("/", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;

  const list = await db
    .select()
    .from(ledgers)
    .where(eq(ledgers.userId, userId));

  return res.json({
    success: true,
    data: list,
  });
});

const createLedgerSchema = z.object({
  name: z.string().min(1, "Nama buku kas wajib diisi"),
  currency: z.string().default("IDR"),
  monthStartDay: z.number().min(1).max(28).default(1),
});

// POST /ledgers
ledgerRoutes.post("/", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const input = createLedgerSchema.parse(req.body);
  const id = crypto.randomUUID();

  await db.insert(ledgers).values({
    id,
    userId,
    name: input.name,
    currency: input.currency,
    monthStartDay: input.monthStartDay,
  });

  const newLedger = await db
    .select()
    .from(ledgers)
    .where(eq(ledgers.id, id))
    .limit(1);

  return res.status(201).json({
    success: true,
    data: newLedger[0],
  });
});

const createInviteSchema = z.object({
  ledgerId: z.string(),
  role: z.enum(["editor", "viewer"]).default("editor"),
});

// POST /ledgers/invite
ledgerRoutes.post("/invite", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const input = createInviteSchema.parse(req.body);

  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(ledgerInvites).values({
    code,
    ledgerId: input.ledgerId,
    invitedBy: userId,
    targetRole: input.role,
    expiresAt,
  });

  const invite = await db
    .select()
    .from(ledgerInvites)
    .where(eq(ledgerInvites.code, code))
    .limit(1);

  return res.status(201).json({
    success: true,
    data: invite[0],
  });
});

// POST /ledgers/join
ledgerRoutes.post("/join", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const { code } = z.object({ code: z.string() }).parse(req.body);

  const inviteRecords = await db
    .select()
    .from(ledgerInvites)
    .where(eq(ledgerInvites.code, code.toUpperCase()))
    .limit(1);

  if (inviteRecords.length === 0) {
    return res.status(404).json({
      success: false,
      error: "NotFound",
      message: "Kode undangan tidak valid.",
    });
  }

  const invite = inviteRecords[0];
  if (invite.usedAt) {
    return res.status(400).json({
      success: false,
      error: "AlreadyUsed",
      message: "Kode undangan sudah pernah digunakan.",
    });
  }

  if (new Date() > invite.expiresAt) {
    return res.status(400).json({
      success: false,
      error: "Expired",
      message: "Kode undangan sudah kedaluwarsa.",
    });
  }

  await db.insert(ledgerMembers).values({
    ledgerId: invite.ledgerId,
    userId,
    role: invite.targetRole,
  });

  await db
    .update(ledgerInvites)
    .set({ usedAt: new Date(), usedBy: userId })
    .where(eq(ledgerInvites.code, invite.code));

  return res.json({
    success: true,
    ledgerId: invite.ledgerId,
  });
});
