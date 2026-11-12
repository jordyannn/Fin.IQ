export interface ClientAiModelInfo {
  id: string;
  name: string;
  provider: string;
  tag: string;
  description: string;
}

export const AI_MODEL_STORAGE_KEY = "finiq:ai:selectedModel";
export const AI_MODEL_EVENT = "finiq:ai-model-change";
export const DEFAULT_CLIENT_MODEL_ID = "google/gemma-4-26b-a4b-it:free";

export const FALLBACK_FREE_MODELS: ClientAiModelInfo[] = [
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

export function readStoredAiModelId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const val = window.localStorage.getItem(AI_MODEL_STORAGE_KEY)?.trim();
    return val || null;
  } catch {
    return null;
  }
}

export function writeStoredAiModelId(modelId: string): void {
  if (typeof window === "undefined") return;
  try {
    const cleaned = modelId.trim();
    if (!cleaned) return;
    window.localStorage.setItem(AI_MODEL_STORAGE_KEY, cleaned);
    window.dispatchEvent(new CustomEvent(AI_MODEL_EVENT, { detail: cleaned }));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function resolveActiveModelInfo(
  selectedModelId: string,
  models: ClientAiModelInfo[]
): ClientAiModelInfo {
  const matched = models.find((m) => m.id === selectedModelId);
  if (matched) return matched;
  if (selectedModelId.trim()) {
    const shortName = selectedModelId.split("/").pop() || selectedModelId;
    return {
      id: selectedModelId,
      name: shortName,
      provider: selectedModelId.split("/")[0] || "OpenRouter",
      tag: selectedModelId.endsWith(":free") ? "Free" : "Custom",
      description: `Model OpenRouter pilihan (${selectedModelId}).`,
    };
  }
  return models[0] || FALLBACK_FREE_MODELS[0];
}

