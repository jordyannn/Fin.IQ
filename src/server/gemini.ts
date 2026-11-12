import { TRPCError } from "@trpc/server";
import { userProfiles } from "./db/schema";
import { eq } from "drizzle-orm";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import crypto from "crypto";

export const GEMINI_MODEL = "gemini-3-flash-preview";
export const GEMINI_AUDIO_MODEL = "gemini-3-flash-preview";
export const GEMINI_VISION_MODEL = "gemini-3-flash-preview";

export const DEFAULT_GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
];

export const DEFAULT_GEMINI_API_KEY =
  process.env.GEMINI_API_KEY?.trim() ||
  process.env.GEMINI?.trim() ||
  "";

function decryptSecretIfNeeded(cipherText: string): string {
  if (!cipherText || !cipherText.startsWith("enc:v1:")) return cipherText;
  try {
    const parts = cipherText.split(":");
    if (parts.length !== 5) return "";
    const [, , ivHex, tagHex, dataHex] = parts;
    const secret =
      process.env.ENCRYPTION_KEY ||
      process.env.JWT_SECRET ||
      process.env.NEXTAUTH_SECRET ||
      "finiq-secret-key-32-chars-minimum-token-super-safe";
    const key = crypto.createHash("sha256").update(secret).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    let decrypted = decipher.update(dataHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted.trim();
  } catch {
    return "";
  }
}

export async function getEffectiveGeminiKey(ctx: { db: any; userId: string }): Promise<string> {
  const profileRecords = await ctx.db
    .select({ geminiApiKey: userProfiles.geminiApiKey })
    .from(userProfiles)
    .where(eq(userProfiles.userId, ctx.userId))
    .limit(1);

  const profile = profileRecords[0];
  const rawProfileKey = profile?.geminiApiKey?.trim() || "";
  const profileKey = decryptSecretIfNeeded(rawProfileKey);
  // Jika profil menyimpan OpenRouter key (sk-or-...), jangan gunakan untuk Gemini SDK
  const key =
    profileKey && !profileKey.startsWith("sk-or-")
      ? profileKey
      : process.env.GEMINI_API_KEY?.trim() ||
        process.env.GEMINI?.trim() ||
        DEFAULT_GEMINI_API_KEY;

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

function buildModelConfig(model: string, baseConfig: any, fastMode?: boolean): any {
  const config = baseConfig ? { ...baseConfig } : {};
  if (
    fastMode &&
    !config.thinkingConfig &&
    (model.startsWith("gemini-3-flash") ||
      model.startsWith("gemini-3.5-flash") ||
      model.startsWith("gemini-3.6-flash")) &&
    !model.includes("lite")
  ) {
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
  }
  return Object.keys(config).length > 0 ? config : undefined;
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
    timeoutMs?: number;
    fastMode?: boolean;
  }
) {
  const models =
    options.preferredModels && options.preferredModels.length > 0
      ? options.preferredModels.filter((m) => m !== "gemini-3.8-flash")
      : DEFAULT_GEMINI_MODELS;

  const finalModels = models.length > 0 ? models : DEFAULT_GEMINI_MODELS;
  const timeoutMs = options.timeoutMs ?? 28000;

  let lastError: any = null;
  for (const model of finalModels) {
    const modelConfig = buildModelConfig(model, options.config, options.fastMode);
    try {
      const callPromise = ai.models.generateContent({
        model,
        contents: options.contents,
        config: modelConfig,
      });
      const response = await Promise.race([
        callPromise,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout after ${timeoutMs}ms on model ${model}`)),
            timeoutMs
          )
        ),
      ]);
      return response;
    } catch (err: any) {
      const msg = err?.message || "Error";
      // Jika model menolak thinkingConfig, coba sekali tanpa thinkingConfig
      if (modelConfig?.thinkingConfig && /thinking/i.test(msg)) {
        try {
          const retryConfig = { ...modelConfig };
          delete retryConfig.thinkingConfig;
          const retryPromise = ai.models.generateContent({
            model,
            contents: options.contents,
            config: Object.keys(retryConfig).length > 0 ? retryConfig : undefined,
          });
          return await Promise.race([
            retryPromise,
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error(`Timeout after ${timeoutMs}ms on model ${model}`)),
                timeoutMs
              )
            ),
          ]);
        } catch (retryErr: any) {
          lastError = retryErr;
        }
      } else {
        lastError = err;
      }

      console.warn(
        `[Gemini Fallback] Model ${model} gagal (${lastError?.message || msg}), mencoba model berikutnya...`
      );

      // Jangan lanjut fallback jika API Key tidak valid
      if (
        /API_KEY_INVALID|API key not valid|PERMISSION_DENIED/i.test(
          String(lastError?.message || "")
        )
      ) {
        break;
      }
    }
  }

  throw lastError;
}
