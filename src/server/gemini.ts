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

export function decryptSecretIfNeeded(cipherText: string): string {
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

const FATAL_GEMINI_ERROR_RE =
  /API_KEY_INVALID|API key not valid|PERMISSION_DENIED|FAILED_PRECONDITION|location is not supported|Timeout after|fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|UND_ERR_CONNECT_TIMEOUT/i;

const UNREACHABLE_GEMINI_ERROR_RE =
  /FAILED_PRECONDITION|location is not supported|Timeout after|fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|UND_ERR_CONNECT_TIMEOUT/i;

interface GeminiReachabilityState {
  reachable: boolean;
  checkedAt: number;
  until: number;
  reason?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __finiq_gemini_reachability__: GeminiReachabilityState | undefined;
}

const GEMINI_UNREACHABLE_TTL_MS = 10 * 60 * 1000;
const GEMINI_REACHABLE_TTL_MS = 5 * 60 * 1000;

export function markGeminiUnreachable(reason: string, ttlMs = GEMINI_UNREACHABLE_TTL_MS): void {
  const now = Date.now();
  globalThis.__finiq_gemini_reachability__ = {
    reachable: false,
    checkedAt: now,
    until: now + ttlMs,
    reason,
  };
}

export function isGeminiMarkedUnreachable(): { unreachable: boolean; reason?: string } {
  const state = globalThis.__finiq_gemini_reachability__;
  if (!state || Date.now() >= state.until) return { unreachable: false };
  return state.reachable ? { unreachable: false } : { unreachable: true, reason: state.reason };
}

export function resetGeminiReachabilityCache(): void {
  globalThis.__finiq_gemini_reachability__ = undefined;
}

/**
 * Probe cepat konektivitas ke endpoint Gemini agar server yang diblokir tidak menunggu 20-60 detik setiap request.
 */
export async function ensureGeminiReachable(
  probeTimeoutMs = 3000
): Promise<{ reachable: boolean; reason?: string }> {
  const state = globalThis.__finiq_gemini_reachability__;
  const now = Date.now();
  if (state && now < state.until) {
    return { reachable: state.reachable, reason: state.reason };
  }

  try {
    await fetch("https://generativelanguage.googleapis.com/", {
      method: "HEAD",
      signal: AbortSignal.timeout(probeTimeoutMs),
    });
    globalThis.__finiq_gemini_reachability__ = {
      reachable: true,
      checkedAt: now,
      until: now + GEMINI_REACHABLE_TTL_MS,
    };
    return { reachable: true };
  } catch (err: any) {
    const reason = err?.message || "Koneksi ke Gemini API timeout/terblokir";
    markGeminiUnreachable(reason);
    console.warn(`[Gemini Reachability] Endpoint Gemini tidak dapat dijangkau (${reason}), bypass selama 10 menit.`);
    return { reachable: false, reason };
  }
}

/**
 * Menentukan apakah error Gemini bersifat fatal/jaringan sehingga tidak perlu retry model lain.
 */
export function isFatalGeminiError(err: unknown): boolean {
  if (err instanceof TRPCError) {
    return (
      err.code === "PRECONDITION_FAILED" ||
      err.code === "BAD_REQUEST" ||
      err.code === "UNAUTHORIZED" ||
      err.code === "FORBIDDEN"
    );
  }
  const msg =
    typeof err === "string" ? err : String((err as { message?: unknown })?.message || err || "");
  return FATAL_GEMINI_ERROR_RE.test(msg);
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

      // Jangan lanjut fallback jika error bersifat fatal (API key invalid, geo-blocked, atau koneksi/timeout jaringan)
      if (isFatalGeminiError(lastError || msg)) {
        const errStr = String((lastError as any)?.message || msg || "");
        if (UNREACHABLE_GEMINI_ERROR_RE.test(errStr)) {
          markGeminiUnreachable(errStr);
        }
        break;
      }
    }
  }

  throw lastError;
}
