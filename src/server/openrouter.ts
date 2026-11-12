/**
 * OpenRouter AI Client & Guardrail Engine for Fin.IQ
 *
 * Provides:
 * 1. Default API key management for demo deployment (all users automatically connected).
 * 2. Curated OpenRouter Free-Tier Models list & multi-model fallback on rate limits (429).
 * 3. Strict 2-tier Financial Guardrail (heuristic pre-filter + system prompt enforcement).
 * 4. Fair-share Prompt Quota Limiter per user (e.g. 20 prompts per 24 hours).
 */

export const DEFAULT_OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY?.trim() ||
  process.env.OPENROUTER?.trim() ||
  "";

export interface FreeModelInfo {
  id: string;
  name: string;
  provider: string;
  tag: string;
  description: string;
}

export const OPENROUTER_FREE_MODELS: FreeModelInfo[] = [
  {
    id: "google/gemma-4-26b-a4b-it:free",
    name: "Google Gemma 4 26B",
    provider: "Google",
    tag: "Rekomendasi / Responsif",
    description: "Model cepat, stabil, dan sangat natural dalam memahami konteks keuangan Indonesia.",
  },
  {
    id: "google/gemma-4-31b-it:free",
    name: "Google Gemma 4 31B",
    provider: "Google",
    tag: "Komprehensif",
    description: "Model parameter besar Google dengan kapabilitas analitis komprehensif.",
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    name: "NVIDIA Nemotron 3.5 Lightning",
    provider: "NVIDIA",
    tag: "Deep Reasoning",
    description: "Penalaran finansial mendalam untuk evaluasi target tabungan dan alokasi dana.",
  },
  {
    id: "dots-studio/dots-3-note-preview:free",
    name: "Dots Studio 3 Note",
    provider: "Dots Studio",
    tag: "Analitis",
    description: "Sintesis data transaksi terstruktur dengan fokus laporan ringkas & objektif.",
  },
  {
    id: "recursive/flint-v1.0:free",
    name: "Recursive Flint v1.0",
    provider: "Recursive",
    tag: "Ultra Cepat",
    description: "Latensi minimal untuk analisis ringkas dan perbandingan pos pengeluaran.",
  },
  {
    id: "liquid/lfm-2.5-2.6b:free",
    name: "LiquidAI LFM 2.5",
    provider: "LiquidAI",
    tag: "Ringan & Cepat",
    description: "Model efisien untuk evaluasi cepat data transaksi.",
  },
];

export const DEFAULT_MODEL_ID = "google/gemma-4-26b-a4b-it:free";

import { and, eq, gte, count, sql } from "drizzle-orm";
import { aiChatMessages, aiPromptHistory, userProfiles } from "./db/schema";
import { decryptSecretIfNeeded } from "./gemini";

// ============================================================================
// 1. FAIR-SHARE PROMPT QUOTA SYSTEM (Database-Backed + GlobalIn-Memory Cache)
// ============================================================================

export const DAILY_PROMPT_LIMIT = 20;
const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 jam

declare global {
  // eslint-disable-next-line no-var
  var __finiq_user_quota_store__: Map<string, number[]> | undefined;
}

const userQuotaStore: Map<string, number[]> =
  globalThis.__finiq_user_quota_store__ ?? new Map<string, number[]>();

if (process.env.NODE_ENV !== "production") {
  globalThis.__finiq_user_quota_store__ = userQuotaStore;
}

/**
 * Membersihkan riwayat timestamp memory yang lebih lama dari 24 jam
 */
function cleanUserTimestamps(userId: string): number[] {
  const now = Date.now();
  const timestamps = userQuotaStore.get(userId) || [];
  const validTimestamps = timestamps.filter((ts) => now - ts < ROLLING_WINDOW_MS);
  userQuotaStore.set(userId, validTimestamps);
  return validTimestamps;
}

/**
 * Cek status kuota prompt user secara akurat (Database-backed + Memory fallback)
 */
export async function getAiQuota(
  firstArg: any,
  secondArg?: string
): Promise<{
  limit: number;
  used: number;
  remaining: number;
  allowed: boolean;
  resetHours: number;
}> {
  let db: any = undefined;
  let userId = "";

  if (typeof firstArg === "string") {
    userId = firstArg;
    db = undefined;
  } else if (typeof secondArg === "string") {
    db = firstArg;
    userId = secondArg;
  }

  if (!userId) {
    return {
      limit: DAILY_PROMPT_LIMIT,
      used: 0,
      remaining: DAILY_PROMPT_LIMIT,
      allowed: true,
      resetHours: 0,
    };
  }

  const memoryTimestamps = cleanUserTimestamps(userId);
  let dbPromptCount = 0;
  let oldestDbDate: Date | null = null;

  if (db) {
    const since = new Date(Date.now() - ROLLING_WINDOW_MS);
    try {
      // 1. Hitung seluruh prompt pertanyaan user di riwayat sesi chat
      const chatStats = await db
        .select({
          total: count(),
          oldest: sql<Date | null>`min(${aiChatMessages.createdAt})`,
        })
        .from(aiChatMessages)
        .where(
          and(
            eq(aiChatMessages.userId, userId),
            eq(aiChatMessages.role, "user"),
            gte(aiChatMessages.createdAt, since)
          )
        );

      const chatCount = Number(chatStats[0]?.total) || 0;
      const oldestChat = chatStats[0]?.oldest ? new Date(chatStats[0].oldest) : null;

      // 2. Hitung juga dari audit log prompt history
      const historyStats = await db
        .select({
          total: count(),
          oldest: sql<Date | null>`min(${aiPromptHistory.createdAt})`,
        })
        .from(aiPromptHistory)
        .where(
          and(
            eq(aiPromptHistory.userId, userId),
            gte(aiPromptHistory.createdAt, since)
          )
        );

      const historyCount = Number(historyStats[0]?.total) || 0;
      const oldestHistory = historyStats[0]?.oldest ? new Date(historyStats[0].oldest) : null;

      dbPromptCount = Math.max(chatCount, historyCount);
      oldestDbDate = oldestChat || oldestHistory;
    } catch (dbErr) {
      console.warn("[getAiQuota] DB query fallback to memory:", dbErr);
    }
  }

  // Gunakan angka terbesar antara database riil dan memory tracking
  const used = Math.max(dbPromptCount, memoryTimestamps.length);
  const remaining = Math.max(0, DAILY_PROMPT_LIMIT - used);

  let resetHours = 0;
  let oldestMs: number | null = null;

  if (oldestDbDate) {
    const ms = new Date(oldestDbDate).getTime();
    if (!isNaN(ms)) oldestMs = ms;
  }

  if (!oldestMs && memoryTimestamps.length > 0) {
    oldestMs = memoryTimestamps[0];
  }

  if (oldestMs && used > 0) {
    const resetTime = oldestMs + ROLLING_WINDOW_MS;
    resetHours = Math.max(1, Math.ceil((resetTime - Date.now()) / (1000 * 60 * 60)));
  }

  return {
    limit: DAILY_PROMPT_LIMIT,
    used,
    remaining,
    allowed: remaining > 0,
    resetHours,
  };
}

/**
 * Konsumsi 1 kuota prompt jika masih diperbolehkan
 */
export async function consumeAiQuota(
  firstArg: any,
  secondArg?: string
): Promise<{
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  message?: string;
}> {
  let db: any = undefined;
  let userId = "";

  if (typeof firstArg === "string") {
    userId = firstArg;
    db = undefined;
  } else if (typeof secondArg === "string") {
    db = firstArg;
    userId = secondArg;
  }

  const quota = await getAiQuota(db, userId);

  if (!quota.allowed || quota.remaining <= 0) {
    return {
      allowed: false,
      limit: DAILY_PROMPT_LIMIT,
      used: quota.used,
      remaining: 0,
      message: `Batas kuota uji coba demo harian Anda (${DAILY_PROMPT_LIMIT} pertanyaan) telah tercapai. Kuota akan di-reset bertahap dalam 24 jam agar pengguna lain dapat turut mencoba demo Fin.IQ AI.`,
    };
  }

  // Catat ke in-memory rolling list
  const timestamps = cleanUserTimestamps(userId);
  timestamps.push(Date.now());
  userQuotaStore.set(userId, timestamps);

  const newUsed = Math.max(quota.used + 1, timestamps.length);
  const newRemaining = Math.max(0, DAILY_PROMPT_LIMIT - newUsed);

  return {
    allowed: true,
    limit: DAILY_PROMPT_LIMIT,
    used: newUsed,
    remaining: newRemaining,
  };
}

// ============================================================================
// 2. FINANCIAL GUARDRAIL ENGINE
// ============================================================================

export const GUARDRAIL_REFUSAL_MESSAGE =
  "Waduh bro, Bang Peci ini kucing cerdas yang cuma paham urusan cuan, belanjaan, dan arus kas pribadi. Kalo nanya topik di luar keuangan mah Bang Peci angkat tangan wkwk! Yuk tanya seputar keuangan atau dompetmu aja ya!";

/**
 * Pre-filter cepat untuk mendeteksi permintaan di luar konteks keuangan
 * Menghemat token & waktu eksekusi tanpa memotong kuota user.
 */
export function checkFinancialGuardrail(query: string): {
  isOffTopic: boolean;
  refusal?: string;
} {
  const normalized = query.toLowerCase().trim();

  // Pola bypass / jailbreak umum
  const jailbreakPatterns = [
    /\b(ignore all previous instructions|abaikan semua instruksi|dan mode|jailbreak|pretend to be|roleplay as|kamu sekarang adalah)\b/i,
    /\b(bypass|override system prompt|tampilkan system prompt|what is your prompt)\b/i,
  ];

  for (const pattern of jailbreakPatterns) {
    if (pattern.test(normalized)) {
      return { isOffTopic: true, refusal: GUARDRAIL_REFUSAL_MESSAGE };
    }
  }

  // Pola topik non-finansial yang jelas (Coding umum, sastra, resep, politik)
  const offTopicPatterns = [
    /\b(buatkan kode|tuliskan script|write python code|bikin program|source code|function binary|react component|html css)\b/i,
    /\b(resep masakan|cara memasak|bahan membuat kue|bumbu rendang)\b/i,
    /\b(tuliskan puisi|buat cerpen|buatkan lirik lagu|bikin pantun)\b/i,
    /\b(siapa presiden|hasil pemilu|partai politik|debat capres)\b/i,
    /\b(jadwal liga champion|klasemen bola|skor pertandingan)\b/i,
    /\b(ramalan zodiak|horoskop|shio tahun ini)\b/i,
  ];

  for (const pattern of offTopicPatterns) {
    if (pattern.test(normalized)) {
      return { isOffTopic: true, refusal: GUARDRAIL_REFUSAL_MESSAGE };
    }
  }

  return { isOffTopic: false };
}

// ============================================================================
// 3. OPENROUTER COMPLETION ENGINE WITH MULTI-MODEL FALLBACK
// ============================================================================

export type OpenRouterContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export const OPENROUTER_EXTRACTION_MODELS = [
  "baidu/ernie-5.5-flash-preview:free",
  "nvidia/nemotron-3.5-super-vl:free",
  "nvidia/nemotron-3.5-lightning:free",
  "dots-studio/dots-3-note-preview:free",
  "recursive/flint-v1.0:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
];

export const OPENROUTER_VISION_MODELS = [
  "nvidia/nemotron-3.5-super-vl:free",
  "dots-studio/dots-3-note-preview:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
];

export function getOpenRouterApiKeyFromEnv(): string {
  return (
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.OPENROUTER?.trim() ||
    DEFAULT_OPENROUTER_API_KEY ||
    ""
  );
}

/**
 * Mengambil OpenRouter API Key aktif: memprioritaskan key pribadi berawalan `sk-or-`
 * di profil user, lalu env OPENROUTER_API_KEY / OPENROUTER di runtime server.
 */
export async function getEffectiveOpenRouterKey(ctx?: {
  db: any;
  userId: string;
}): Promise<string> {
  if (ctx?.db && ctx?.userId) {
    try {
      const profileRecords = await ctx.db
        .select({ geminiApiKey: userProfiles.geminiApiKey })
        .from(userProfiles)
        .where(eq(userProfiles.userId, ctx.userId))
        .limit(1);

      const rawProfileKey = profileRecords[0]?.geminiApiKey?.trim() || "";
      const profileKey = decryptSecretIfNeeded(rawProfileKey);
      if (profileKey && profileKey.startsWith("sk-or-")) {
        return profileKey;
      }
    } catch {
      // Abaikan error DB saat lookup key opsional, lanjut ke env fallback
    }
  }

  return getOpenRouterApiKeyFromEnv();
}

export async function generateOpenRouterCompletion(options: {
  model?: string;
  candidateModels?: string[];
  systemPrompt: string;
  userPrompt?: string;
  userContent?: string | OpenRouterContentPart[];
  temperature?: number;
  maxTokens?: number;
  plugins?: Array<{ id: string; [key: string]: unknown }>;
  apiKey?: string;
  timeoutMs?: number;
  totalTimeoutMs?: number;
  validateResponse?: (text: string) => boolean;
}): Promise<{ text: string; modelUsed: string }> {
  const activeKey = options.apiKey?.trim() || getOpenRouterApiKeyFromEnv();

  if (!activeKey) {
    throw new Error(
      "Kunci API OpenRouter belum dikonfigurasi. Silakan tambahkan OPENROUTER_API_KEY di environment server atau masukkan API Key OpenRouter (sk-or-...) di menu Pengaturan & Profil."
    );
  }

  const baseCandidates =
    options.candidateModels && options.candidateModels.length > 0
      ? options.candidateModels
      : [
          ...(options.model && OPENROUTER_FREE_MODELS.some((m) => m.id === options.model)
            ? [options.model]
            : []),
          "baidu/ernie-5.5-flash-preview:free",
          "recursive/flint-v1.0:free",
          "nvidia/nemotron-3.5-super-vl:free",
          "nvidia/nemotron-3.5-lightning:free",
          "dots-studio/dots-3-note-preview:free",
          "google/gemma-4-26b-a4b-it:free",
          "google/gemma-4-31b-it:free",
          "liquid/lfm-2.5-2.6b:free",
        ];

  const candidateModels = (
    options.model && !options.candidateModels?.includes(options.model) && OPENROUTER_FREE_MODELS.some((m) => m.id === options.model)
      ? [options.model, ...baseCandidates]
      : baseCandidates
  ).filter((val, idx, arr) => arr.indexOf(val) === idx);

  const timeoutMs = options.timeoutMs ?? 20000;
  const totalBudgetMs = options.totalTimeoutMs ?? Math.max(timeoutMs, 32000);
  const deadlineAt = Date.now() + totalBudgetMs;
  const userMessageContent = options.userContent ?? options.userPrompt ?? "";
  let lastError: Error | null = null;

  for (const model of candidateModels) {
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs < 2500) {
      lastError = lastError || new Error(`Batas waktu total OpenRouter (${totalBudgetMs}ms) tercapai.`);
      break;
    }

    try {
      const requestBody: Record<string, unknown> = {
        model,
        messages: [
          { role: "system", content: options.systemPrompt },
          { role: "user", content: userMessageContent },
        ],
        temperature: options.temperature ?? 0.3,
      };
      if (typeof options.maxTokens === "number") {
        requestBody.max_tokens = options.maxTokens;
      }
      if (options.plugins && options.plugins.length > 0) {
        requestBody.plugins = options.plugins;
      }

      const attemptTimeoutMs = Math.min(timeoutMs, remainingMs);
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(attemptTimeoutMs),
        headers: {
          Authorization: `Bearer ${activeKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://finiq.app",
          "X-Title": "Fin.IQ Financial Advisor",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 401) {
        const errJson = await response.json().catch(() => ({}));
        const rawMsg = errJson?.error?.message || "";
        console.warn(`[OpenRouter Auth Error] 401: ${rawMsg}`);
        throw new Error(
          "Kunci API OpenRouter tidak valid atau telah kedaluwarsa (OpenRouter: User not found). Silakan periksa kembali API Key Anda di Pengaturan & Profil."
        );
      }

      if (response.status === 429) {
        console.warn(`[OpenRouter Fallback] Model ${model} rate-limited (429), mencoba model cadangan...`);
        lastError = new Error(`Model ${model} sedang sibuk (rate-limited upstream).`);
        continue;
      }

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `HTTP ${response.status}`;
        console.warn(`[OpenRouter Fallback] Model ${model} error: ${errMsg}`);
        lastError = new Error(errMsg);
        continue;
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content;
      if (typeof rawContent === "string" && rawContent.trim()) {
        const cleaned = rawContent
          .replace(/<think>[\s\S]*?<\/think>/gi, "")
          .trim();
        if (!cleaned) {
          lastError = new Error(`Respon model ${model} kosong setelah reasoning.`);
          continue;
        }
        if (options.validateResponse && !options.validateResponse(cleaned)) {
          console.warn(`[OpenRouter Fallback] Model ${model} mengembalikan format/isi tidak lengkap, mencoba model berikutnya...`);
          lastError = new Error(`Respon model ${model} tidak memuat data yang diharapkan.`);
          continue;
        }
        return {
          text: cleaned,
          modelUsed: model,
        };
      } else {
        lastError = new Error(`Respon model ${model} kosong.`);
      }
    } catch (fetchErr: any) {
      if (fetchErr.message?.includes("Kunci API OpenRouter tidak valid")) {
        throw fetchErr;
      }
      console.warn(`[OpenRouter Fallback] Gagal memanggil ${model}:`, fetchErr?.message || fetchErr);
      lastError = fetchErr;
    }
  }

  throw lastError || new Error("Semua penyedia model free-tier OpenRouter sedang sibuk. Silakan coba kembali beberapa saat lagi.");
}
