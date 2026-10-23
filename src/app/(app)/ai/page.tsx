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
  Info,
  PanelLeftClose,
  PanelLeft,
  Plus,
  MessageSquare,
  Trash2,
  ArrowUpRight,
  X,
  History,
  Sparkles,
} from "lucide-react";
import { AIMessageRenderer } from "@/components/ai/AIMessageRenderer";
import { useTranslation } from "@/i18n";

const SUGGESTIONS = [
  {
    title: "Audit Pos Boros & Kebocoran",
    desc: "Deteksi anomali mutasi dan pangkas pos pengeluaran terbesar.",
    prompt:
      "Audit pos pengeluaran terbesar saya: mana transaksi yang paling boros atau tidak wajar dan bagaimana cara memangkasnya?",
  },
  {
    title: "Batas Belanja Harian",
    desc: "Hitung jatah aman belanja harian agar kas surplus di akhir bulan.",
    prompt:
      "Hitung batas maksimal belanja harian saya agar sisa bulan ini tetap surplus dan tidak boncos.",
  },
  {
    title: "Alokasi Tabungan Pasti",
    desc: "Hitung nominal realistis yang aman disisihkan ke tabungan/reksadana.",
    prompt:
      "Berdasarkan pemasukan dan pola pengeluaran saya, berapa nominal pasti yang aman saya sisihkan ke tabungan bulan ini?",
  },
  {
    title: "Ketahanan Kas (Runway)",
    desc: "Hitung berapa bulan cadangan dana bertahan tanpa pemasukan baru.",
    prompt:
      "Dengan rata-rata pengeluaran saat ini, berapa bulan total saldo saya bisa bertahan jika tanpa pemasukan?",
  },
];

const FALLBACK_FREE_MODELS = [
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
  const utils = trpc.useUtils();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const { t, locale } = useTranslation();

  // 1. Ambil Konfigurasi Model Free-Tier & Status Kuota
  const { data: aiConfig, refetch: refetchAiConfig } = trpc.ai.getAiConfig.useQuery(undefined, {
    staleTime: 1000 * 10,
  });

  const [localQuota, setLocalQuota] = useState<{
    limit: number;
    used: number;
    remaining: number;
    resetHours: number;
  } | null>(null);

  useEffect(() => {
    if (aiConfig?.quota) {
      setLocalQuota(aiConfig.quota);
    }
  }, [aiConfig?.quota]);

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

  const quota = localQuota || aiConfig?.quota || { limit: 20, used: 0, remaining: 20, resetHours: 0 };

  // ============================================================================
  // 2. SESSION & HISTORY STATE
  // ============================================================================
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setIsSidebarOpen(true);
    }
  }, []);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Daftar Sesi Percakapan Pengguna
  const { data: sessions = [], refetch: refetchSessions, isLoading: isSessionsLoading } =
    trpc.ai.listChatSessions.useQuery(undefined, {
      staleTime: 1000 * 15,
    });

  // Ambil Percakapan dari Sesi yang Aktif
  const { data: activeSessionData, isFetching: isSessionFetching } =
    trpc.ai.getChatSession.useQuery(
      { sessionId: activeSessionId! },
      {
        enabled: Boolean(activeSessionId),
        staleTime: 1000 * 30,
      }
    );

  const deleteSessionMutation = trpc.ai.deleteChatSession.useMutation({
    onSuccess: (_, variables) => {
      refetchSessions();
      if (activeSessionId === variables.sessionId) {
        handleNewSession();
      }
    },
  });

  const defaultWelcomeMessage: ChatMessage = {
    id: "welcome-msg",
    role: "assistant",
    text: `### Konsultasi Keuangan Aktif (OpenRouter Free Tier)
Data akun kas, saldo riil, dan 30 transaksi mutasi Anda telah terhubung secara otomatis.

Silakan pilih topik di bawah atau ketik pertanyaan langsung untuk menganalisis arus kas, pos anggaran, dan strategi finansial Anda.`,
    time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    modelUsed: activeModel.name,
  };

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([defaultWelcomeMessage]);
  const [chatInput, setChatInput] = useState(initialQuery);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Muat pesan dari activeSessionData ke chatMessages
  useEffect(() => {
    if (activeSessionId && activeSessionData?.messages) {
      if (activeSessionData.messages.length > 0) {
        const mapped: ChatMessage[] = activeSessionData.messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          text: m.content,
          time: new Date(m.createdAt).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          modelUsed: m.modelUsed || undefined,
          guardrailBlocked: m.guardrailBlocked,
        }));
        setChatMessages(mapped);
      } else {
        setChatMessages([defaultWelcomeMessage]);
      }
    }
  }, [activeSessionId, activeSessionData]);

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

      if (data.sessionId && activeSessionId !== data.sessionId) {
        setActiveSessionId(data.sessionId);
      }

      if (data.quota) {
        setLocalQuota(data.quota);
        utils.ai.getAiConfig.setData(undefined, (old) =>
          old ? { ...old, quota: data.quota } : old
        );
        utils.ai.getAiQuota.setData(undefined, data.quota);
      }

      utils.ai.getAiConfig.invalidate();
      utils.ai.getAiQuota.invalidate();
      refetchSessions();
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

      if (aiConfig?.quota) {
        setLocalQuota(aiConfig.quota);
      }
      utils.ai.getAiConfig.invalidate();
      utils.ai.getAiQuota.invalidate();
    },
  });

  const handleSendChat = (questionText?: string) => {
    const q = (questionText || chatInput).trim();
    if (!q || askAssistantMutation.isPending || quota.remaining <= 0) return;

    // Optimistic decrement for immediate visual feedback
    setLocalQuota((prev) => {
      const current =
        prev || aiConfig?.quota || { limit: 20, used: 0, remaining: 20, resetHours: 0 };
      const nextUsed = current.used + 1;
      return {
        ...current,
        used: nextUsed,
        remaining: Math.max(0, current.limit - nextUsed),
      };
    });

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: q,
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");

    askAssistantMutation.mutate({
      question: q,
      model: selectedModelId,
      sessionId: activeSessionId || undefined,
      lang: locale,
    });
  };

  useEffect(() => {
    if (initialQuery) {
      handleSendChat(initialQuery);
    }
  }, [initialQuery]);

  const handleNewSession = () => {
    setActiveSessionId(null);
    setChatMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        text: `### Sesi Baru Dimulai
Silakan ajukan pertanyaan baru seputar evaluasi pengeluaran, perbandingan pos anggaran, atau simulasi target tabungan Anda.`,
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

  const formatSessionTime = (dateInput: Date | string) => {
    const date = new Date(dateInput);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  };

  return (
    <div className="flex h-[calc(100dvh-12rem)] sm:h-[calc(100dvh-13rem)] lg:h-[calc(100vh-5.5rem)] max-w-6xl mx-auto gap-4">
      {/* ==================================================================== */}
      {/* 1. SIDEBAR RIWAYAT SESI AI (Interactive Sessions Drawer) */}
      {/* ==================================================================== */}
      {isSidebarOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden animate-in fade-in duration-200"
            onClick={() => setIsSidebarOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border p-0 shadow-2xl flex flex-col lg:static lg:z-auto lg:w-64 lg:rounded-lg lg:border lg:shadow-xs shrink-0 overflow-hidden animate-in slide-in-from-left duration-200 lg:animate-none">
            {/* Header Sidebar Sesi */}
            <div className="p-3 border-b border-border/70 flex items-center justify-between gap-2 shrink-0 bg-muted/20">
              <div className="flex items-center gap-1.5 min-w-0">
                <History className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs font-bold text-foreground truncate">
                  Riwayat Percakapan
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                  {sessions.length}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    handleNewSession();
                    if (typeof window !== "undefined" && window.innerWidth < 1024) {
                      setIsSidebarOpen(false);
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-md bg-primary text-white hover:bg-[#047857] active:scale-95 transition-all cursor-pointer shadow-xs"
                  title="Buat Sesi Chat Baru"
                >
                  <Plus className="h-3 w-3 stroke-[2.5]" />
                  <span>Baru</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted lg:hidden cursor-pointer"
                  title="Tutup riwayat"
                  aria-label="Tutup riwayat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* List Sesi Percakapan */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isSessionsLoading ? (
                <div className="p-4 text-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto mb-1" />
                  <span className="text-[11px] text-muted-foreground">Memuat riwayat...</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Belum ada riwayat sesi.</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    Ketik pertanyaan untuk memulai percakapan pertama Anda.
                  </p>
                </div>
              ) : (
                sessions.map((s) => {
                  const isActive = activeSessionId === s.id;
                  return (
                    <div
                      key={s.id}
                      className={`group relative flex items-center justify-between rounded-md p-2 text-xs transition-colors cursor-pointer ${
                        isActive
                          ? "bg-primary/10 text-primary font-bold border border-primary/30"
                          : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => {
                        setActiveSessionId(s.id);
                        if (typeof window !== "undefined" && window.innerWidth < 1024) {
                          setIsSidebarOpen(false);
                        }
                      }}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="truncate text-[11px] font-medium leading-tight">
                          {s.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 text-[9px] font-mono text-muted-foreground/70">
                          <span>{formatSessionTime(s.updatedAt)}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Hapus riwayat sesi ini?")) {
                            deleteSessionMutation.mutate({ sessionId: s.id });
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-rose-500/10 hover:text-rose-600 text-muted-foreground cursor-pointer"
                        title="Hapus sesi"
                        aria-label="Hapus sesi"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </>
      )}

      {/* ==================================================================== */}
      {/* 2. MAIN CHAT WORKSPACE */}
      {/* ==================================================================== */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        {/* EXECUTIVE HEADER & MODEL SWITCHER */}
        <header className="flex flex-col gap-2.5 pb-3 border-b border-border/70 shrink-0">
          {/* Top Line: Dedicated History Button + Title + New Session Button */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* Dedicated History Drawer Button */}
              <button
                type="button"
                onClick={() => setIsSidebarOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/80 bg-card hover:bg-muted text-xs font-semibold text-foreground shadow-2xs active:scale-95 transition-all cursor-pointer"
                title="Buka Riwayat Sesi Percakapan"
                aria-label="Buka Riwayat Sesi Percakapan"
              >
                <History className="h-4 w-4 text-primary shrink-0" />
                <span className="font-bold">Riwayat</span>
                <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-mono font-bold leading-none">
                  {sessions.length}
                </span>
              </button>

              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-foreground truncate">
                AI Advisor
              </h1>
            </div>

            {/* Quick New Session Action */}
            <button
              type="button"
              onClick={handleNewSession}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary hover:bg-[#047857] text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
              title="Mulai Sesi Chat Baru"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Chat Baru</span>
            </button>
          </div>

          {/* Sub Bar: Model Selector Dropdown & Quota Badge */}
          <div className="flex items-center justify-between gap-2 text-xs">
            {/* Model Switcher Dropdown (Hanya Free Tier) */}
            <div className="relative flex-1 min-w-0 max-w-[210px] sm:max-w-xs" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsModelDropdownOpen((v) => !v)}
                className="w-full inline-flex items-center justify-between gap-1.5 px-2.5 py-1 text-[11px] font-mono rounded-md border border-border/80 bg-muted/40 hover:bg-muted text-foreground transition-colors cursor-pointer select-none"
                title="Ganti Model AI (Khusus Free Tier)"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Cpu className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-sans font-medium truncate">
                    {activeModel.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                    Free
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground opacity-70" />
                </div>
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

            {/* Quota Badge */}
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono border shrink-0 ${
                quota.remaining <= 3
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-border/70 bg-muted/40 text-muted-foreground"
              }`}
              title="Batas pemakaian prompt demo gratis per 24 jam"
            >
              <Zap className="h-3 w-3 shrink-0" />
              <span>
                Kuota: <strong className="font-bold text-foreground">{quota.remaining}</strong>/{quota.limit}
              </span>
            </div>
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

        {/* CHAT STREAM */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 scrollbar-none">
          {isSessionFetching && (
            <div className="py-2 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Memuat percakapan sesi...</span>
            </div>
          )}

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
            <div className="pt-1.5 sm:pt-2">
              <div className="flex items-center justify-between mb-2 px-0.5">
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  Ide Analisis & Solusi Finansial
                </p>
                <span className="text-[10px] text-muted-foreground/60 font-mono hidden sm:inline">
                  Klik untuk evaluasi instan
                </span>
              </div>

              {/* Desktop / Tablet Grid */}
              <div className="hidden sm:grid sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendChat(s.prompt)}
                    className="p-3 rounded-lg border border-border/70 bg-card hover:bg-muted/60 hover:border-border transition-all text-left group active:scale-[0.99] cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                        {s.title}
                      </span>
                      <ArrowUpRight className="h-3 w-3 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" />
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-1 mt-1 font-sans">
                      {s.desc}
                    </p>
                  </button>
                ))}
              </div>

              {/* Mobile Compact Horizontal Scroll Chips */}
              <div className="flex sm:hidden items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendChat(s.prompt)}
                    className="shrink-0 px-3 py-1.5 rounded-full border border-border/80 bg-card hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all shadow-2xs"
                  >
                    <Sparkles className="h-3 w-3 text-primary shrink-0" />
                    <span className="whitespace-nowrap">{s.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* INPUT BAR */}
        <footer className="pt-2 sm:pt-3 border-t border-border/70 shrink-0">
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
                    ? "Batas kuota harian tercapai. Coba lagi besok."
                    : `Tanyakan analisis keuangan...`
                }
                className="w-full h-11 sm:h-10 px-3.5 text-xs rounded-xl sm:rounded-md bg-background border border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground transition-all placeholder:text-muted-foreground/60 pr-12 sm:pr-14 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                disabled={askAssistantMutation.isPending || quota.remaining <= 0}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground/60 hidden sm:inline select-none pointer-events-none">
                ↵ Enter
              </span>
            </div>

            <button
              type="submit"
              disabled={askAssistantMutation.isPending || !chatInput.trim() || quota.remaining <= 0}
              aria-label="Kirim Pesan"
              className="h-11 px-3.5 sm:h-10 sm:px-4 rounded-xl sm:rounded-md text-xs font-bold bg-primary hover:bg-[#047857] text-white shadow-xs transition-all active:scale-[0.95] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center justify-center gap-1.5"
            >
              {askAssistantMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Kirim</span>
            </button>
          </form>
        </footer>
      </main>
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
