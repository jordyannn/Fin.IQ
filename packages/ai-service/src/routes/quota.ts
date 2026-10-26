import { Router, Response } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { getAiQuota } from "../lib/openrouter";

export const quotaRoutes = Router();

// GET /ai/quota
quotaRoutes.get("/", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const quota = await getAiQuota(userId);

  return res.json({
    success: true,
    data: quota,
  });
});
