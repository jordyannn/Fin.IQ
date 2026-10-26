import { Router, Response } from "express";
import { OPENROUTER_FREE_MODELS, DEFAULT_MODEL_ID } from "../lib/openrouter";

export const modelRoutes = Router();

// GET /ai/models
modelRoutes.get("/", (_req, res: Response) => {
  return res.json({
    success: true,
    data: {
      defaultModel: DEFAULT_MODEL_ID,
      models: OPENROUTER_FREE_MODELS,
    },
  });
});
