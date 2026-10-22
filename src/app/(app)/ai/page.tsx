"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import {
  Send,
  Copy,
  Check,
  RotateCcw,
  Loader2,
  ChevronDown,
  Shield,
  Zap,
  Cpu,
  Sparkles,
  Info,
} from "lucide-react";
import { AIMessageRenderer } from "@/components/ai/AIMessageRenderer";

const SUGGESTIONS = [
  "Berapa total pengeluaran bulan ini dan pos apa yang paling boros?",
  "Tampilkan tabel perbandingan pengeluaran per kategori beserta proporsinya.",
  "Evaluasi arus kas saya dan berikan 3 rekomendasi langkah hemat konkret.",
];

export const FALLBACK_FREE_MODELS = [
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

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
  modelUsed?: string;
  guardrailBlocked?: boolean;
}

function AIAdvisorPageContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  // 1. Ambil Konfigurasi Model Free-Tier & Status Kuota
  const { data: aiConfig, refetch: refetchAiConfig } = trpc.ai.getAiConfig.useQuery(undefined, {
    staleTime: 1000 * 30,
  });

  const availableModels =
    aiConfig?.availableModels && aiConfig.availableModels.length > 0
      ? aiConfig.availableModels
      : FALLBACK_FREE_MODELS;

  const [selectedModelId, setSelectedModelId] = useState<string>("minimax/minimax-m3.1-flash:free");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync default model jika aiConfig termuat
  useEffect(() => {
    if (aiConfig?.defaultModel && !selectedModelId) {
      setSelectedModelId(aiConfig.defaultModel);
    }
  }, [aiConfig]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeModel =
    availableModels.find((m) => m.id === selectedModelId) ||
    availableModels[0] || {
      id: "minimax/minimax-m3.1-flash:free",
      name: "MiniMax M3.1 Flash",
      tag: "Default / Responsif",
      description: "Model cepat dan stabil untuk analisis keuangan.",
    };

  const quota = aiConfig?.quota || { limit: 20, used: 0, remaining: 20, resetHours: 0 };

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-msg",
      role: "assistant",
      text: `### Konsultasi Keuangan Aktif (OpenRouter Free Tier)
Data akun kas, saldo riil, dan 30 transaksi mutasi Anda telah terhubung secara otomatis.

Silakan pilih model AI gratis di atas atau ketik pertanyaan langsung untuk menganalisis arus kas, pos anggaran, dan strategi finansial Anda.`,
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      modelUsed: activeModel.name,
    },
  ]);
  const [chatInput, setChatInput] = useState(initialQuery);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, searchParams]);

  const askAssistantMutation = trpc.ai.askFinancialAssistant.useMutation({
    onSuccess: (data) => {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: "assistant",
          text: data.answer,
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          modelUsed: data.modelUsed,
          guardrailBlocked: data.guardrailBlocked,
        },
      ]);
      // Segarkan kuota setelah pesan berhasil diproses
      refetchAiConfig();
    },
    onError: (err) => {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: `Gagal memproses data: ${err.message || "Koneksi ke AI terganggu."}`,
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      refetchAiConfig();
    },
  });

  const handleSendChat = (questionText?: string) => {
    const q = (questionText || chatInput).trim();
    if (!q || askAssistantMutation.isPending || quota.remaining <= 0) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: q,
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");

    askAssistantMutation.mutate({ question: q, model: selectedModelId });
  };

  useEffect(() => {
    if (initialQuery) {
      handleSendChat(initialQuery);
    }
  }, [initialQuery]);

  const handleResetChat = () => {
    setChatMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        text: `### Sesi Baru Dimulai
Silakan ajukan pertanyaan seputar evaluasi pengeluaran, perbandingan pos anggaran, atau simulasi target tabungan Anda.`,
        time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        modelUsed: activeModel.name,
      },
    ]);
    setChatInput("");
    inputRef.current?.focus();
  };

  const handleCopyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] max-w-4xl mx-auto">
      {/* ==================================================================== */}
      {/* 1. EXECUTIVE HEADER & MODEL SWITCHER (Anti-Slop: Zero Decorative Bloat) */}
      {/* ==================================================================== */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-border/70 shrink-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-sm sm:text-base font-bold tracking-tight text-foreground">
            AI Advisor
          </h1>

          {/* Model Switcher Dropdown (Hanya Free Tier) */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsModelDropdownOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono rounded-md border border-border/80 bg-muted/40 hover:bg-muted text-foreground transition-colors cursor-pointer select-none"
              title="Ganti Model AI (Khusus Free Tier)"
            >
              <Cpu className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-sans font-medium truncate max-w-[140px] sm:max-w-[180px]">
                {activeModel.name}
              </span>
              <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                Free
              </span>
              <ChevronDown className="h-3 w-3 text-muted-foreground ml-0.5 opacity-70" />
            </button>

            {/* Dropdown Menu */}
            {isModelDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 rounded-lg border border-border/80 bg-popover p-1.5 shadow-xl shadow-black/10 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2 py-1.5 border-b border-border/60 mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                    Pilihan Model AI (Free Tier)
                  </span>
                  <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400">
                    OpenRouter Demo
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1">
                  {availableModels.map((m) => {
                    const isSelected = m.id === selectedModelId;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedModelId(m.id);
                          setIsModelDropdownOpen(false);
                        }}
                        className={`w-full text-left p-2 rounded-md transition-colors text-xs cursor-pointer flex items-start justify-between gap-2 ${
                          isSelected
                            ? "bg-zinc-100 dark:bg-zinc-800/90 text-foreground"
                            : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[11px] truncate text-foreground">
                              {m.name}
                            </span>
                            {m.tag && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground">
                                {m.tag}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground/80 line-clamp-1 mt-0.5 font-sans">
                            {m.description}
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Toolbar: Quota Counter, Status, & Reset */}
        <div className="flex items-center gap-2 justify-between sm:justify-end">
          {/* Quota Badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-2 py-0.8 rounded text-[10px] font-mono border ${
              quota.remaining <= 3
                ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-border/70 bg-muted/40 text-muted-foreground"
            }`}
            title="Batas pemakaian prompt demo gratis per 24 jam"
          >
            <Zap className="h-2.5 w-2.5 shrink-0" />
            <span>
              Kuota Demo: <strong className="font-bold">{quota.remaining}</strong>/{quota.limit}
            </span>
          </div>

          {/* Reset Action */}
          <button
            type="button"
            onClick={handleResetChat}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-sm hover:bg-muted/70 flex items-center gap-1 cursor-pointer"
            title="Reset percakapan"
          >
            <RotateCcw className="h-3 w-3" />
            <span className="hidden sm:inline">Mulai Baru</span>
          </button>
        </div>
      </header>

      {/* Quota Depleted Warning Banner */}
      {quota.remaining <= 0 && (
        <div className="mt-2.5 p-3 rounded-md border border-rose-500/30 bg-rose-500/5 flex items-center gap-2 text-xs shrink-0 text-foreground">
          <Info className="h-4 w-4 text-rose-500 shrink-0" />
          <span>
            Batas kuota uji coba demo harian Anda (20 pertanyaan) telah tercapai. Kuota akan di-reset bertahap besok agar pengunjung lain dapat turut mencoba demo Fin.IQ AI.
          </span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. CHAT STREAM (Fluid & Distraction-Free Workspace) */}
      {/* ==================================================================== */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 scrollbar-none">
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" ? (
              <div
                className={`w-full max-w-[92%] sm:max-w-[88%] rounded-lg p-3.5 sm:p-4 text-xs border text-foreground group transition-colors ${
                  msg.guardrailBlocked
                    ? "bg-amber-500/5 border-amber-500/30"
                    : "bg-muted/30 border-border/60"
                }`}
              >
                {/* Guardrail Blocked Header */}
                {msg.guardrailBlocked && (
                  <div className="mb-2.5 pb-2 border-b border-amber-500/20 flex items-center gap-1.5 text-[10px] font-mono text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider">
                    <Shield className="h-3 w-3 shrink-0" />
                    <span>Guardrail Fin.IQ Keuangan Aktif</span>
                  </div>
                )}

                <AIMessageRenderer content={msg.text} />

                {/* Minimal Footer Toolbar */}
                <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <div className="flex items-center gap-2">
                    <span>{msg.time}</span>
                    {msg.modelUsed && (
                      <span className="text-[9px] text-muted-foreground/60 hidden sm:inline">
                        • {msg.modelUsed}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(msg.id, msg.text)}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-1.5 py-0.5 rounded-sm hover:bg-muted"
                  >
                    {copiedId === msg.id ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-sans">Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span className="font-sans">Salin</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="max-w-[85%] sm:max-w-[75%]">
                <div className="rounded-2xl rounded-tr-xs px-4 py-2 text-xs bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 font-medium leading-relaxed">
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
                <span className="text-[10px] text-muted-foreground block text-right font-mono mt-1 pr-1">
                  {msg.time}
                </span>
              </div>
            )}
          </div>
        ))}

        {/* Loading / Thinking Indicator */}
        {askAssistantMutation.isPending && (
          <div className="w-full max-w-[92%] sm:max-w-[88%] rounded-lg p-3.5 text-xs bg-muted/20 border border-border/50 text-muted-foreground flex items-center gap-2.5 animate-in fade-in duration-150">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Menganalisis transaksi dengan {activeModel.name}...</span>
          </div>
        )}

        {/* Suggestion Prompts (Only visible when conversation is short) */}
        {chatMessages.length <= 2 && !askAssistantMutation.isPending && quota.remaining > 0 && (
          <div className="pt-2">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">
              Ide Topik Cepat
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SUGGESTIONS.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendChat(s)}
                  className="p-2.5 rounded-md border border-border/70 bg-card hover:bg-muted/70 text-left text-xs text-foreground/90 transition-all active:scale-[0.98] cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ==================================================================== */}
      {/* 3. INPUT BAR (Crisp, High-Response Prompt Bar) */}
      {/* ==================================================================== */}
      <footer className="pt-3 border-t border-border/70 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendChat();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={
                quota.remaining <= 0
                  ? "Batas kuota harian tercapai. Silakan coba kembali besok."
                  : `Tanyakan analisis keuangan kepada ${activeModel.name}...`
              }
              className="w-full h-10 px-3.5 text-xs rounded-md bg-background border border-border/80 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 text-foreground transition-all placeholder:text-muted-foreground/60 pr-14 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={askAssistantMutation.isPending || quota.remaining <= 0}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground/60 hidden sm:inline select-none pointer-events-none">
              ↵ Enter
            </span>
          </div>

          <button
            type="submit"
            disabled={askAssistantMutation.isPending || !chatInput.trim() || quota.remaining <= 0}
            className="h-10 px-4 rounded-md text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all active:scale-[0.97] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-1.5"
          >
            {askAssistantMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Kirim</span>
          </button>
        </form>
      </footer>
    </div>
  );
}

export default function AIPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Memuat AI Advisor...</p>
        </div>
      }
    >
      <AIAdvisorPageContent />
    </Suspense>
  );
}
