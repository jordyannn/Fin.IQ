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
  "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";

export interface FreeModelInfo {
  id: string;
  name: string;
  provider: string;
  tag: string;
  description: string;
}

export const OPENROUTER_FREE_MODELS: FreeModelInfo[] = [
  {
    id: "minimax/minimax-m3.1-flash:free",
    name: "MiniMax M3.1 Flash",
    provider: "MiniMax",
    tag: "Rekomendasi / Responsif",
    description: "Model cepat, stabil, dan sangat natural dalam memahami konteks keuangan Indonesia.",
  },
  {
    id: "recursive/flint-v1.0:free",
    name: "Recursive Flint v1.0",
    provider: "Recursive",
    tag: "Ultra Cepat",
    description: "Latensi minimal untuk analisis ringkas dan perbandingan pos pengeluaran.",
  },
  {
    id: "dots-studio/dots-3-note-preview:free",
    name: "Dots Studio 3 Note",
    provider: "Dots Studio",
    tag: "Analitis",
    description: "Sintesis data transaksi terstruktur dengan fokus laporan ringkas & objektif.",
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    name: "NVIDIA Nemotron 3.5 Lightning",
    provider: "NVIDIA",
    tag: "Deep Reasoning",
    description: "Penalaran finansial mendalam untuk evaluasi target tabungan dan alokasi dana.",
  },
  {
    id: "google/gemma-4-31b-it:free",
    name: "Google Gemma 4 31B",
    provider: "Google",
    tag: "Komprehensif",
    description: "Model parameter besar Google dengan kapabilitas analitis komprehensif.",
  },
  {
    id: "google/gemma-4-26b-a4b-it:free",
    name: "Google Gemma 4 26B",
    provider: "Google",
    tag: "Seimbang",
    description: "Model dialog efisien dan seimbang untuk konsultasi harian.",
  },
];

export const DEFAULT_MODEL_ID = "minimax/minimax-m3.1-flash:free";

// ============================================================================
// 1. FAIR-SHARE PROMPT QUOTA SYSTEM (In-Memory Rolling 24 Hours)
// ============================================================================

export const DAILY_PROMPT_LIMIT = 20;
const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 jam

interface QuotaRecord {
  timestamps: number[];
}

const userQuotaStore = new Map<string, QuotaRecord>();

/**
 * Membersihkan riwayat timestamp yang lebih lama dari 24 jam
 */
function cleanUserTimestamps(userId: string): number[] {
  const now = Date.now();
  const record = userQuotaStore.get(userId);
  if (!record) return [];

  const validTimestamps = record.timestamps.filter((ts) => now - ts < ROLLING_WINDOW_MS);
  record.timestamps = validTimestamps;
  return validTimestamps;
}

/**
 * Cek status kuota prompt user
 */
export function getAiQuota(userId: string) {
  const validTimestamps = cleanUserTimestamps(userId);
  const used = validTimestamps.length;
  const remaining = Math.max(0, DAILY_PROMPT_LIMIT - used);

  let resetHours = 0;
  if (validTimestamps.length > 0) {
    const oldest = validTimestamps[0];
    const resetTime = oldest + ROLLING_WINDOW_MS;
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
export function consumeAiQuota(userId: string): {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  message?: string;
} {
  const validTimestamps = cleanUserTimestamps(userId);
  if (validTimestamps.length >= DAILY_PROMPT_LIMIT) {
    return {
      allowed: false,
      limit: DAILY_PROMPT_LIMIT,
      used: validTimestamps.length,
      remaining: 0,
      message: `Batas kuota uji coba demo harian Anda (${DAILY_PROMPT_LIMIT} pertanyaan) telah tercapai. Kuota akan di-reset bertahap dalam 24 jam agar pengguna lain dapat turut mencoba demo Fin.IQ AI.`,
    };
  }

  validTimestamps.push(Date.now());
  userQuotaStore.set(userId, { timestamps: validTimestamps });

  const used = validTimestamps.length;
  const remaining = Math.max(0, DAILY_PROMPT_LIMIT - used);

  return {
    allowed: true,
    limit: DAILY_PROMPT_LIMIT,
    used,
    remaining,
  };
}

// ============================================================================
// 2. FINANCIAL GUARDRAIL ENGINE
// ============================================================================

export const GUARDRAIL_REFUSAL_MESSAGE =
  "Maaf, sebagai Fin.IQ AI Financial Advisor saya hanya melayani analisis dan konsultasi terkait pengelolaan keuangan pribadi, arus kas, transaksi, dan anggaran Anda. Silakan ajukan pertanyaan seputar keuangan pribadi Anda.";

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

export async function generateOpenRouterCompletion(options: {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}): Promise<{ text: string; modelUsed: string }> {
  const targetModel =
    options.model && OPENROUTER_FREE_MODELS.some((m) => m.id === options.model)
      ? options.model
      : DEFAULT_MODEL_ID;

  // Daftar urutan fallback model free-tier jika model utama mengalami rate-limit (429)
  const candidateModels = [
    targetModel,
    "minimax/minimax-m3.1-flash:free",
    "recursive/flint-v1.0:free",
    "dots-studio/dots-3-note-preview:free",
    "nvidia/nemotron-3.5-lightning:free",
  ].filter((val, idx, arr) => arr.indexOf(val) === idx);

  let lastError: Error | null = null;

  for (const model of candidateModels) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DEFAULT_OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://finiq.app",
          "X-Title": "Fin.IQ Financial Advisor",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: options.systemPrompt },
            { role: "user", content: options.userPrompt },
          ],
          temperature: options.temperature ?? 0.3,
        }),
      });

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
      const content = data.choices?.[0]?.message?.content;
      if (typeof content === "string" && content.trim()) {
        return {
          text: content.trim(),
          modelUsed: model,
        };
      } else {
        lastError = new Error(`Respon model ${model} kosong.`);
      }
    } catch (fetchErr: any) {
      console.warn(`[OpenRouter Fallback] Gagal memanggil ${model}:`, fetchErr?.message || fetchErr);
      lastError = fetchErr;
    }
  }

  throw lastError || new Error("Semua penyedia model free-tier OpenRouter sedang sibuk. Silakan coba kembali beberapa saat lagi.");
}
