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
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "NVIDIA Nemotron 3 Ultra 550B",
    provider: "NVIDIA",
    tag: "Flagship 1M Ctx",
    description: "Model flagship 550B MoE dengan akurasi kalkulasi dan pemahaman telemetri tinggi.",
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    name: "NVIDIA Nemotron 3.5 Lightning",
    provider: "NVIDIA",
    tag: "Deep Reasoning",
    description: "Penalaran finansial mendalam untuk evaluasi target tabungan dan alokasi dana.",
  },
  {
    id: "nvidia/nemotron-3.5-super-vl:free",
    name: "NVIDIA Nemotron 3.5 Super VL",
    provider: "NVIDIA",
    tag: "Multimodal 1M",
    description: "Model kontekstual besar NVIDIA untuk sintesis riwayat transaksi panjang.",
  },
  {
    id: "baidu/ernie-5.5-flash-preview:free",
    name: "Baidu ERNIE 5.5 Flash",
    provider: "Baidu",
    tag: "Flash 1M Ctx",
    description: "Model respons cepat dengan jendela konteks 1M token untuk analisis kas menyeluruh.",
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
];

export const DEFAULT_MODEL_ID = "google/gemma-4-26b-a4b-it:free";

let liveFreeModelsCache: { expiresAt: number; models: FreeModelInfo[] } | null = null;

function formatOpenRouterProviderName(modelId: string): string {
  const prefix = modelId.split("/")[0] || "OpenRouter";
  const map: Record<string, string> = {
    google: "Google",
    nvidia: "NVIDIA",
    baidu: "Baidu",
    "dots-studio": "Dots Studio",
    recursive: "Recursive",
    cohere: "Cohere",
    thinkingmachines: "Thinking Machines",
    liquid: "LiquidAI",
    openai: "OpenAI",
    anthropic: "Anthropic",
    deepseek: "DeepSeek",
    qwen: "Qwen",
    "meta-llama": "Meta",
  };
  return map[prefix.toLowerCase()] || prefix;
}

/**
 * Mengambil daftar model `:free` live dari OpenRouter (dengan cache 15 menit)
 * digabungkan dengan daftar kurasi Fin.IQ agar user selalu melihat model aktif terbaru.
 */
export async function getAvailableOpenRouterModels(): Promise<FreeModelInfo[]> {
  if (liveFreeModelsCache && liveFreeModelsCache.expiresAt > Date.now()) {
    return liveFreeModelsCache.models;
  }

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/models", {
      signal: AbortSignal.timeout(3500),
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) {
      return OPENROUTER_FREE_MODELS;
    }

    const json = (await resp.json().catch(() => null)) as {
      data?: Array<{
        id?: string;
        name?: string;
        context_length?: number;
        description?: string;
      }>;
    } | null;

    const liveFree = (json?.data || []).filter(
      (m): m is { id: string; name?: string; context_length?: number; description?: string } =>
        Boolean(m?.id && m.id.endsWith(":free"))
    );

    if (liveFree.length === 0) {
      return OPENROUTER_FREE_MODELS;
    }

    const liveById = new Map(liveFree.map((m) => [m.id, m]));
    const merged: FreeModelInfo[] = [];
    const seenIds = new Set<string>();

    // Prioritaskan model kurasi yang masih hidup di katalog live (atau semua kurasi jika sedang transien)
    for (const curated of OPENROUTER_FREE_MODELS) {
      if (liveById.has(curated.id)) {
        merged.push(curated);
        seenIds.add(curated.id);
      }
    }

    // Tambahkan model `:free` live lainnya yang layak (skip ultra-tiny <= 3b agar akurasi angka tetap terjaga)
    for (const m of liveFree) {
      if (seenIds.has(m.id)) continue;
      if (/\b(1\.7b|2\.6b|1b|0\.5b)\b/i.test(m.id)) continue;
      const cleanName = (m.name || m.id).replace(/\s*\(free\)\s*$/i, "").trim();
      const ctxK = m.context_length ? `${Math.round(m.context_length / 1000)}K` : "Live";
      merged.push({
        id: m.id,
        name: cleanName,
        provider: formatOpenRouterProviderName(m.id),
        tag: `Live Free • ${ctxK}`,
        description:
          m.description?.split(".")[0]?.slice(0, 120) ||
          `Model gratis live di OpenRouter (${ctxK} token).`,
      });
      seenIds.add(m.id);
    }

    const finalModels = merged.length > 0 ? merged : OPENROUTER_FREE_MODELS;
    liveFreeModelsCache = {
      expiresAt: Date.now() + 15 * 60 * 1000,
      models: finalModels,
    };
    return finalModels;
  } catch {
    return OPENROUTER_FREE_MODELS;
  }
}

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

export interface OpenRouterHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

const DEFAULT_FALLBACK_ORDER = [
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3.5-lightning:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "baidu/ernie-5.5-flash-preview:free",
  "dots-studio/dots-3-note-preview:free",
  "recursive/flint-v1.0:free",
  "nvidia/nemotron-3.5-super-vl:free",
];

/**
 * Menyusun urutan model kandidat dengan memprioritaskan pilihan user (`requestedModel`),
 * baik model kurasi Fin.IQ maupun ID model OpenRouter kustom/live lainnya.
 */
export function resolveCandidateModels(
  requestedModel?: string,
  candidateModels?: string[]
): string[] {
  const cleanedRequested = requestedModel?.trim();
  const baseCandidates =
    candidateModels && candidateModels.length > 0
      ? candidateModels
      : [...(cleanedRequested ? [cleanedRequested] : []), ...DEFAULT_FALLBACK_ORDER];

  const ordered = cleanedRequested && !baseCandidates.includes(cleanedRequested)
    ? [cleanedRequested, ...baseCandidates]
    : baseCandidates;

  return ordered
    .map((m) => m.trim())
    .filter((val, idx, arr) => Boolean(val) && arr.indexOf(val) === idx);
}

export function buildOpenRouterMessages(options: {
  systemPrompt: string;
  userContent: string | OpenRouterContentPart[];
  history?: OpenRouterHistoryMessage[];
  mergeSystemIntoUser?: boolean;
}): Array<{ role: string; content: string | OpenRouterContentPart[] }> {
  const historyMessages = (options.history || [])
    .filter((m) => Boolean(m.content?.trim()))
    .map((m) => ({
      role: m.role,
      content: m.content.trim(),
    }));

  if (!options.mergeSystemIntoUser) {
    return [
      { role: "system", content: options.systemPrompt },
      ...historyMessages,
      { role: "user", content: options.userContent },
    ];
  }

  const sysPrefix = `[INSTRUKSI SISTEM]\n${options.systemPrompt}\n\n[DATA & PERTANYAAN PENGGUNA]\n`;
  const mergedUserContent: string | OpenRouterContentPart[] =
    typeof options.userContent === "string"
      ? `${sysPrefix}${options.userContent}`
      : [{ type: "text", text: sysPrefix }, ...options.userContent];

  return [...historyMessages, { role: "user", content: mergedUserContent }];
}

export async function generateOpenRouterCompletion(options: {
  model?: string;
  candidateModels?: string[];
  systemPrompt: string;
  userPrompt?: string;
  userContent?: string | OpenRouterContentPart[];
  history?: OpenRouterHistoryMessage[];
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

  const candidateModels = resolveCandidateModels(options.model, options.candidateModels);

  const timeoutMs = options.timeoutMs ?? 20000;
  const totalBudgetMs = options.totalTimeoutMs ?? Math.max(timeoutMs, 38000);
  const deadlineAt = Date.now() + totalBudgetMs;
  const userMessageContent = options.userContent ?? options.userPrompt ?? "";
  let lastError: Error | null = null;

  for (const model of candidateModels) {
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs < 2500) {
      lastError = lastError || new Error(`Batas waktu total OpenRouter (${totalBudgetMs}ms) tercapai.`);
      break;
    }

    let mergeSystemIntoUser = false;

    for (let compatPass = 0; compatPass < 2; compatPass++) {
      const passRemainingMs = deadlineAt - Date.now();
      if (passRemainingMs < 2000) break;

      try {
        const requestBody: Record<string, unknown> = {
          model,
          messages: buildOpenRouterMessages({
            systemPrompt: options.systemPrompt,
            userContent: userMessageContent,
            history: options.history,
            mergeSystemIntoUser,
          }),
          temperature: options.temperature ?? 0.3,
        };
        if (typeof options.maxTokens === "number") {
          requestBody.max_tokens = options.maxTokens;
        }
        if (options.plugins && options.plugins.length > 0) {
          requestBody.plugins = options.plugins;
        }

        const attemptTimeoutMs = Math.min(timeoutMs, passRemainingMs);
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
          const errJson = await response.json().catch(() => ({}));
          const rawMsg = errJson?.error?.message || "";
          console.warn(`[OpenRouter Fallback] Model ${model} rate-limited (429): ${rawMsg}`);
          if (/free-models-per-day|add \d+ credits/i.test(rawMsg)) {
            throw new Error(
              "Limit harian model gratis OpenRouter tercapai (50 request/hari). Tambahkan kredit OpenRouter atau ganti API Key di Pengaturan & Profil."
            );
          }
          lastError = new Error(`Model ${model} sedang sibuk (rate-limited upstream).`);
          break;
        }

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          const errMsg = errJson?.error?.message || `HTTP ${response.status}`;
          if (
            !mergeSystemIntoUser &&
            response.status === 400 &&
            /developer instruction|system role|system message|does not support system/i.test(errMsg)
          ) {
            console.warn(`[OpenRouter Compat] Model ${model} menolak system role, retry dengan merged prompt...`);
            mergeSystemIntoUser = true;
            continue;
          }
          console.warn(`[OpenRouter Fallback] Model ${model} error: ${errMsg}`);
          lastError = new Error(errMsg);
          break;
        }

        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content;
        if (typeof rawContent === "string" && rawContent.trim()) {
          const cleaned = rawContent
            .replace(/<think>[\s\S]*?<\/think>/gi, "")
            .trim();
          if (!cleaned) {
            lastError = new Error(`Respon model ${model} kosong setelah reasoning.`);
            break;
          }
          if (options.validateResponse && !options.validateResponse(cleaned)) {
            console.warn(`[OpenRouter Fallback] Model ${model} mengembalikan format/isi tidak lengkap, mencoba model berikutnya...`);
            lastError = new Error(`Respon model ${model} tidak memuat data yang diharapkan.`);
            break;
          }
          return {
            text: cleaned,
            modelUsed: model,
          };
        } else {
          lastError = new Error(`Respon model ${model} kosong.`);
          break;
        }
      } catch (fetchErr: any) {
        if (
          fetchErr?.message?.includes("Kunci API OpenRouter tidak valid") ||
          fetchErr?.message?.includes("Limit harian model gratis OpenRouter")
        ) {
          throw fetchErr;
        }
        console.warn(`[OpenRouter Fallback] Gagal memanggil ${model}:`, fetchErr?.message || fetchErr);
        lastError = fetchErr;
        break;
      }
    }
  }

  throw lastError || new Error("Semua penyedia model free-tier OpenRouter sedang sibuk. Silakan coba kembali beberapa saat lagi.");
}
