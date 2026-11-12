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

export const DEFAULT_GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
];

/**
 * Eksekusi generateContent dengan auto-fallback antar model Gemini yang tersedia
 */
export async function generateWithFallback(
  ai: GoogleGenAI,
  options: {
    preferredModels?: string[];
    contents: any;
    config?: any;
    timeoutMs?: number;
  }
) {
  const models = options.preferredModels && options.preferredModels.length > 0
    ? options.preferredModels.filter((m) => m !== "gemini-3.8-flash")
    : DEFAULT_GEMINI_MODELS;
  const finalModels = models.length > 0 ? models : DEFAULT_GEMINI_MODELS;
  const timeoutMs = options.timeoutMs ?? 28000;

  let lastError: any = null;
  for (const model of finalModels) {
    try {
      const response = await Promise.race([
        ai.models.generateContent({
          model,
          contents: options.contents,
          config: options.config,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms on model ${model}`)), timeoutMs)
        ),
      ]);
      return response;
    } catch (err: any) {
      console.warn(`[Gemini Fallback] Model ${model} gagal (${err?.message || "Error"}), mencoba model berikutnya...`);
      lastError = err;
    }
  }

  throw lastError;
}
