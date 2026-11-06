import { TRPCError } from "@trpc/server";
import { userProfiles } from "./db/schema";
import { eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODEL = "gemini-3-flash-preview";
export const GEMINI_AUDIO_MODEL = "gemini-3-flash-preview";
export const GEMINI_VISION_MODEL = "gemini-3-flash-preview";

export async function getEffectiveGeminiKey(ctx: { db: any; userId: string }): Promise<string> {
  const profileRecords = await ctx.db
    .select({ geminiApiKey: userProfiles.geminiApiKey })
    .from(userProfiles)
    .where(eq(userProfiles.userId, ctx.userId))
    .limit(1);

  const profile = profileRecords[0];
  const profileKey = profile?.geminiApiKey?.trim();
  // Jika profil menyimpan OpenRouter key (sk-or-...), jangan gunakan untuk Gemini SDK
  const key =
    profileKey && !profileKey.startsWith("sk-or-")
      ? profileKey
      : process.env.GEMINI_API_KEY?.trim() || "";

  if (!key) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Anda belum menyambungkan Google Gemini API Key di profil. Silakan buka menu Pengaturan & Profil atau halaman AI untuk menyambungkan token Anda.",
    });
  }

  return key;
}

export async function getGeminiInstance(ctx: { db: any; userId: string }) {
  const apiKey = await getEffectiveGeminiKey(ctx);
  const ai = new GoogleGenAI({ apiKey });
  return { ai, apiKey, model: GEMINI_MODEL };
}

/**
 * Eksekusi generateContent dengan auto-fallback antar model Gemini yang tersedia
 */
export async function generateWithFallback(
  ai: GoogleGenAI,
  options: {
    preferredModels?: string[];
    contents: any;
    config?: any;
  }
) {
  const models = options.preferredModels && options.preferredModels.length > 0
    ? options.preferredModels
    : ["gemini-3-flash-preview", "gemini-3.8-flash"];

  let lastError: any = null;
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });
      return response;
    } catch (err: any) {
      console.warn(`[Gemini Fallback] Model ${model} gagal (${err?.message || "Error"}), mencoba model berikutnya...`);
      lastError = err;
    }
  }

  throw lastError;
}
