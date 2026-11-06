import { db, userProfiles, decryptSecret } from "@finiq/shared";
import { eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODEL = "gemini-3-flash-preview";
export const GEMINI_AUDIO_MODEL = "gemini-3-flash-preview";
export const GEMINI_VISION_MODEL = "gemini-3-flash-preview";

export const DEFAULT_GEMINI_API_KEY =
  process.env.GEMINI_API_KEY?.trim() ||
  process.env.GEMINI?.trim() ||
  "";

export async function getEffectiveGeminiKey(userId: string): Promise<string> {
  const profileRecords = await db
    .select({ geminiApiKey: userProfiles.geminiApiKey })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  const profile = profileRecords[0];
  const decryptedPersonalKey = profile?.geminiApiKey ? decryptSecret(profile.geminiApiKey).trim() : "";
  const key =
    (decryptedPersonalKey && !decryptedPersonalKey.startsWith("sk-or-") ? decryptedPersonalKey : "") ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GEMINI?.trim() ||
    DEFAULT_GEMINI_API_KEY;

  if (!key) {
    throw new Error(
      "Anda belum menyambungkan Google Gemini API Key di profil. Silakan buka menu Pengaturan & Profil atau halaman AI untuk menyambungkan token Anda."
    );
  }

  return key;
}

export async function getGeminiInstance(userId: string) {
  const apiKey = await getEffectiveGeminiKey(userId);
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
