import { TRPCError } from "@trpc/server";
import { userProfiles } from "./db/schema";
import { eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODEL = "gemini-3.8-flash";
export const GEMINI_AUDIO_MODEL = "gemini-3.8-flash";

export async function getEffectiveGeminiKey(ctx: { db: any; userId: string }): Promise<string> {
  const profileRecords = await ctx.db
    .select({ geminiApiKey: userProfiles.geminiApiKey })
    .from(userProfiles)
    .where(eq(userProfiles.userId, ctx.userId))
    .limit(1);

  const profile = profileRecords[0];
  const key = profile?.geminiApiKey?.trim() || process.env.GEMINI_API_KEY?.trim();

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
