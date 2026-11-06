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

const SUGGESTIONS_ID = [
  {
    title: "Audit Pos Paling Boncos",
    desc: "Bongkar pos belanja mana yang paling rakus nelen duit dan cara ngeremnya.",
    prompt:
      "Tolong audit pos belanja terbesar gue: mana pengeluaran yang paling bikin tekor atau boros, dan gimana jurus konkret buat mangkasnya?",
  },
  {
    title: "Jatah Jajan Harian Aman",
    desc: "Hitung batas belanja harian biar akhir bulan tetep bisa makan enak.",
    prompt:
      "Hitung batas maksimal jajan harian gue biar sisa bulan ini tetep surplus dan gak boncos di tanggal tua!",
  },
  {
    title: "Alokasi Tabungan Pasti",
    desc: "Berapa duit riil yang aman gue sisihin ke tabungan/reksadana bulan ini?",
    prompt:
      "Berdasarkan cuan masuk dan pola pengeluaran riil gue, berapa nominal pasti yang aman disisihkan ke tabungan bulan ini?",
  },
  {
    title: "Nafas Dompet (Runway)",
    desc: "Kalo mendadak gak ada pemasukan, saldo bertahan berapa bulan nih?",
    prompt:
      "Dengan rata-rata pengeluaran gue sekarang, berapa bulan total saldo gue bisa bertahan kalo mendadak gak ada pemasukan baru?",
  },
];

const SUGGESTIONS_EN = [
  {
    title: "Audit Spending Leaks & Anomalies",
    desc: "Detect irregular expenses and trim down your biggest expense categories.",
    prompt:
      "Audit my largest spending categories: which transactions are excessive and how can I trim them?",
  },
  {
    title: "Daily Safe Spend Limit",
    desc: "Calculate a safe daily allowance to ensure a surplus cash balance by month-end.",
    prompt:
      "Calculate my maximum daily spending limit to stay in surplus and avoid overspending this month.",
  },
  {
    title: "Optimal Savings Allocation",
    desc: "Determine a realistic amount to safely set aside for savings or investments.",
    prompt:
      "Based on my income and spending habits, what is the exact safe amount I should save this month?",
  },
  {
    title: "Cash Runway Analysis",
    desc: "Calculate how many months your liquid reserves can sustain you without new income.",
    prompt:
      "With my current average spending, how many months can my total balance sustain without new income?",
  },
];

const FALLBACK_FREE_MODELS = [
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
  const isEn = locale === "en";
  const suggestions = isEn ? SUGGESTIONS_EN : SUGGESTIONS_ID;

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

  const [selectedModelId, setSelectedModelId] = useState<string>("google/gemma-4-26b-a4b-it:free");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync default model jika aiConfig termuat
  useEffect(() => {
    if (aiConfig?.defaultModel) {
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
      id: "google/gemma-4-26b-a4b-it:free",
      name: "Google Gemma 4 26B",
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
    text: isEn
      ? `### Financial Advisor Active (OpenRouter Free Tier)
All registered accounts, real balances, current & monthly cash flows, budgets, and recent transactions for your logged-in account are synchronized and ready for analysis.

Please select a topic below or type your question directly to analyze cash flow, budgets, and financial strategies.`
      : `### Konsultasi Keuangan Fin.IQ Aktif (OpenRouter Free Tier)
Seluruh akun kas, saldo riil, arus kas bulan berjalan, target anggaran, serta riwayat mutasi dari akun Anda yang sedang login telah terhubung secara akurat dan siap dianalisis.

Silakan pilih topik di bawah atau ketik pertanyaan langsung untuk menganalisis arus kas, pos anggaran, dan strategi finansial Anda.`,
    time: new Date().toLocaleTimeString(isEn ? "en-US" : "id-ID", { hour: "2-digit", minute: "2-digit" }),
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
          time: new Date(m.createdAt).toLocaleTimeString(isEn ? "en-US" : "id-ID", {
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
  }, [activeSessionId, activeSessionData, isEn]);

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
          time: new Date().toLocaleTimeString(isEn ? "en-US" : "id-ID", { hour: "2-digit", minute: "2-digit" }),
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
      let rawMsg = err.message || (isEn ? "Connection to AI interrupted." : "Koneksi ke AI terganggu.");
      if (
        rawMsg.includes("<!DOCTYPE") ||
        rawMsg.includes("is not valid JSON") ||
        rawMsg.includes("Unexpected token")
      ) {
        rawMsg = isEn
          ? "The AI server is experiencing high traffic or a temporary gateway delay. Please try resending your message."
          : "Layanan AI sedang mengalami lonjakan beban atau jeda koneksi gateway. Silakan kirim kembali pertanyaan Anda.";
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: isEn
            ? `Failed to process data: ${rawMsg}`
            : `Gagal memproses data: ${rawMsg}`,
          time: new Date().toLocaleTimeString(isEn ? "en-US" : "id-ID", { hour: "2-digit", minute: "2-digit" }),
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
      time: new Date().toLocaleTimeString(isEn ? "en-US" : "id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");

    askAssistantMutation.mutate({
      question: q,
      model: selectedModelId,
      sessionId: activeSessionId || undefined,
      lang: locale,
      clientTime: new Date().toISOString(),
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
        text: isEn
          ? `### New Session Started
Feel free to ask a new question regarding expense evaluations, budget comparisons, or savings projections.`
          : `### Halo bos! Sesi Baru Dimulai
Tanya apa aja ke Bang Peci seputar duitmu: evaluasi belanja, bedah pos boncos, atau jurus nabung cerdas. Dijawab to-the-point pake data riil!`,
        time: new Date().toLocaleTimeString(isEn ? "en-US" : "id-ID", { hour: "2-digit", minute: "2-digit" }),
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
      return date.toLocaleTimeString(isEn ? "en-US" : "id-ID", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString(isEn ? "en-US" : "id-ID", { day: "numeric", month: "short" });
  };

  return (
    <div className="flex h-[calc(100dvh-10.5rem)] sm:h-[calc(100dvh-11.5rem)] lg:h-[calc(100vh-5.5rem)] max-w-6xl mx-auto gap-4">
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
                  {isEn ? "Chat History" : "Riwayat Percakapan"}
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
                  title={isEn ? "Create New Chat Session" : "Buat Sesi Chat Baru"}
                >
                  <Plus className="h-3 w-3 stroke-[2.5]" />
                  <span>{isEn ? "New" : "Baru"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted lg:hidden cursor-pointer"
                  title={isEn ? "Close history" : "Tutup riwayat"}
                  aria-label={isEn ? "Close history" : "Tutup riwayat"}
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
                  <span className="text-[11px] text-muted-foreground">{isEn ? "Loading history..." : "Memuat riwayat..."}</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">{isEn ? "No chat history yet." : "Belum ada riwayat sesi."}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    {isEn ? "Type a prompt to start your first conversation." : "Ketik pertanyaan untuk memulai percakapan pertama Anda."}
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
                          if (confirm(isEn ? "Delete this chat session?" : "Hapus riwayat sesi ini?")) {
                            deleteSessionMutation.mutate({ sessionId: s.id });
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-rose-500/10 hover:text-rose-600 text-muted-foreground cursor-pointer"
                        title={isEn ? "Delete session" : "Hapus sesi"}
                        aria-label={isEn ? "Delete session" : "Hapus sesi"}
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
        {/* STREAMLINED HEADER (Single spacious row, no stacked or crowded buttons) */}
        <header className="flex items-center justify-between gap-2.5 pb-3 border-b border-border/70 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile History Drawer Toggle Button */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen((v) => !v)}
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/80 bg-card hover:bg-muted text-xs font-semibold text-foreground shadow-2xs active:scale-95 transition-all cursor-pointer min-h-[44px]"
              title={isEn ? "Open Conversation History" : "Buka Riwayat Percakapan"}
              aria-label={isEn ? "Open Conversation History" : "Buka Riwayat Percakapan"}
            >
              <History className="h-4 w-4 text-primary shrink-0" />
              <span className="font-bold">{isEn ? "History" : "Riwayat"}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-mono font-bold leading-none">
                {sessions.length}
              </span>
            </button>

            {/* Desktop Sidebar Toggle Button */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen((v) => !v)}
              className="hidden lg:inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border/70 bg-card hover:bg-muted text-muted-foreground hover:text-foreground shadow-2xs active:scale-95 transition-all cursor-pointer"
              title={isSidebarOpen ? (isEn ? "Hide History" : "Sembunyikan Riwayat") : (isEn ? "Show History" : "Tampilkan Riwayat")}
              aria-label={isSidebarOpen ? (isEn ? "Hide History" : "Sembunyikan Riwayat") : (isEn ? "Show History" : "Tampilkan Riwayat")}
            >
              {isSidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </button>

            {/* Title & Live Status Indicator */}
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-foreground truncate">
                AI Advisor
              </h1>
              <span className="hidden xs:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </span>
            </div>
          </div>

          {/* New Chat Action Button */}
          <button
            type="button"
            onClick={handleNewSession}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-[#047857] text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer shrink-0 min-h-[44px]"
            title={isEn ? "Start New Chat Session" : "Mulai Sesi Chat Baru"}
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span className="hidden xs:inline">{isEn ? "New Chat" : "Chat Baru"}</span>
            <span className="xs:hidden">{isEn ? "New" : "Baru"}</span>
          </button>
        </header>

        {/* CHAT STREAM */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 scrollbar-none">
          {isSessionFetching && (
            <div className="py-2 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{isEn ? "Loading session messages..." : "Memuat percakapan sesi..."}</span>
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
                      <span>{isEn ? "Fin.IQ Financial Guardrail Active" : "Guardrail Fin.IQ Keuangan Aktif"}</span>
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
                          <span className="text-emerald-600 dark:text-emerald-400 font-sans">{isEn ? "Copied" : "Tersalin"}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span className="font-sans">{isEn ? "Copy" : "Salin"}</span>
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
              <span>{isEn ? `Analyzing transactions with ${activeModel.name}...` : `Bang Peci lagi bedah transaksi pake ${activeModel.name}...`}</span>
            </div>
          )}

          {/* Suggestion Prompts (Only visible when conversation is short) */}
          {chatMessages.length <= 2 && !askAssistantMutation.isPending && quota.remaining > 0 && (
            <div className="pt-1.5 sm:pt-2">
              <div className="flex items-center justify-between mb-2 px-0.5">
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  {isEn ? "Analysis Ideas & Financial Strategies" : "Ide Analisis Cuan & Solusi Anti-Boncos"}
                </p>
                <span className="text-[10px] text-muted-foreground/60 font-mono hidden sm:inline">
                  {isEn ? "Click for instant evaluation" : "Klik untuk evaluasi instan"}
                </span>
              </div>

              {/* Desktop / Tablet Grid */}
              <div className="hidden sm:grid sm:grid-cols-2 gap-2">
                {suggestions.map((s, idx) => (
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
              <div className="flex sm:hidden items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {suggestions.map((s, idx) => (
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

        {/* INPUT BAR WITH DOCKED MODEL SELECTOR & QUOTA */}
        <footer className="pt-2 sm:pt-3 border-t border-border/70 shrink-0 space-y-2">
          {/* Quota Depleted Warning (Docked right above controls) */}
          {quota.remaining <= 0 && (
            <div className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/5 flex items-center gap-2 text-xs text-foreground animate-in fade-in duration-150">
              <Info className="h-4 w-4 text-rose-500 shrink-0" />
              <span className="text-[11px] leading-tight">
                {isEn ? "Your daily quota limit (20 questions) has been reached. It will reset tomorrow." : "Batas kuota harian Anda (20 pertanyaan) telah tercapai. Kuota akan di-reset bertahap besok."}
              </span>
            </div>
          )}

          {/* Model Selector & Quota Controls (Docked in composer thumb zone) */}
          <div className="flex items-center justify-between gap-2 text-xs">
            {/* Model Switcher Dropdown (Opens upwards seamlessly) */}
            <div className="relative flex-1 min-w-0 max-w-[210px] sm:max-w-xs" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsModelDropdownOpen((v) => !v)}
                className="w-full inline-flex items-center justify-between gap-1.5 px-2.5 py-1.5 text-[11px] font-mono rounded-lg border border-border/80 bg-muted/40 hover:bg-muted text-foreground transition-colors cursor-pointer select-none min-h-[36px] active:scale-[0.98]"
                title={isEn ? "Switch AI Model (Free Tier)" : "Ganti Model AI (Khusus Free Tier)"}
                aria-expanded={isModelDropdownOpen}
                aria-haspopup="true"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Cpu className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-sans font-medium truncate">
                    {activeModel.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                    Free
                  </span>
                  <ChevronDown
                    className={`h-3 w-3 text-muted-foreground opacity-70 transition-transform duration-150 ${
                      isModelDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {/* Dropdown Menu - Opens UPWARDS because it's situated at the bottom */}
              {isModelDropdownOpen && (
                <div className="absolute left-0 bottom-full mb-2 w-[calc(100vw-2.5rem)] max-w-xs sm:w-80 rounded-xl border border-border/80 bg-popover p-1.5 shadow-2xl shadow-black/20 z-50 animate-in fade-in zoom-in-95 duration-100 origin-bottom-left">
                  <div className="px-2 py-1.5 border-b border-border/60 mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                      {isEn ? "AI Model Selection (Free Tier)" : "Pilihan Model AI (Free Tier)"}
                    </span>
                    <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400">
                      OpenRouter Demo
                    </span>
                  </div>

                  <div className="max-h-60 sm:max-h-64 overflow-y-auto space-y-1 overscroll-contain">
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
                          className={`w-full text-left p-2 rounded-lg transition-colors text-xs cursor-pointer flex items-start justify-between gap-2 min-h-[44px] ${
                            isSelected
                              ? "bg-zinc-100 dark:bg-zinc-800/90 text-foreground font-medium"
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
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono border shrink-0 min-h-[36px] ${
                quota.remaining <= 3
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-border/70 bg-muted/40 text-muted-foreground"
              }`}
              title={isEn ? "Free demo prompt usage limit per 24 hours" : "Batas pemakaian prompt demo gratis per 24 jam"}
            >
              <Zap className="h-3.5 w-3.5 shrink-0" />
              <span>
                {isEn ? "Quota:" : "Kuota:"} <strong className="font-bold text-foreground">{quota.remaining}</strong>/{quota.limit}
              </span>
            </div>
          </div>

          {/* Form Input & Send Button */}
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
                    ? (isEn ? "Daily quota limit reached. Try again tomorrow." : "Batas kuota harian tercapai. Coba lagi besok.")
                    : (isEn ? "Ask about financial analysis..." : "Tanyakan analisis keuangan...")
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
              aria-label={isEn ? "Send Message" : "Kirim Pesan"}
              className="h-11 px-3.5 sm:h-10 sm:px-4 rounded-xl sm:rounded-md text-xs font-bold bg-primary hover:bg-[#047857] text-white shadow-xs transition-all active:scale-[0.95] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center justify-center gap-1.5 min-w-[44px]"
            >
              {askAssistantMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{isEn ? "Send" : "Kirim"}</span>
            </button>
          </form>
        </footer>
      </main>
    </div>
  );
}

export default function AIPage() {
  const { locale } = useTranslation();
  const isEn = locale === "en";

  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{isEn ? "Loading AI Advisor..." : "Memuat AI Advisor..."}</p>
        </div>
      }
    >
      <AIAdvisorPageContent />
    </Suspense>
  );
}
