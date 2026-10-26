import { Router, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { db, categories } from "@finiq/shared";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth";

export const categoryRoutes = Router();

// GET /categories
categoryRoutes.get("/", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const kind = req.query.kind as string;

  const conditions = [eq(categories.userId, userId)];
  if (kind === "expense" || kind === "income") {
    conditions.push(eq(categories.kind, kind));
  }

  const list = await db
    .select()
    .from(categories)
    .where(and(...conditions))
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  return res.json({
    success: true,
    data: list,
  });
});

const createCatSchema = z.object({
  name: z.string().min(1, "Nama kategori wajib diisi"),
  kind: z.enum(["expense", "income"]),
  icon: z.string().default("wallet"),
  parentId: z.string().optional(),
});

// POST /categories
categoryRoutes.post("/", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const input = createCatSchema.parse(req.body);
  const id = crypto.randomUUID();

  await db.insert(categories).values({
    id,
    userId,
    name: input.name,
    kind: input.kind,
    icon: input.icon,
    parentId: input.parentId || null,
  });

  const newCategory = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);

  return res.status(201).json({
    success: true,
    data: newCategory[0],
  });
});

// DELETE /categories/:id
categoryRoutes.delete("/:id", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const id = req.params.id as string;

  await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));

  return res.json({
    success: true,
    message: "Kategori berhasil dihapus.",
  });
});
