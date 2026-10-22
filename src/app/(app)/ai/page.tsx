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
  ArrowRight,
  KeyRound,
  Loader2,
} from "lucide-react";
import { AIMessageRenderer } from "@/components/ai/AIMessageRenderer";

const SUGGESTIONS = [
  "Berapa total pengeluaran bulan ini dan pos apa yang paling boros?",
  "Tampilkan tabel perbandingan pengeluaran per kategori beserta proporsinya.",
  "Evaluasi arus kas saya dan berikan 3 rekomendasi langkah hemat konkret.",
];

function AIAdvisorPageContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  // Gemini Connection Status
  const { data: geminiStatus, isLoading: isStatusLoading } = trpc.user.testGeminiStatus.useQuery();

  // Chat Advisor State
  const [chatMessages, setChatMessages] = useState<
    Array<{ id: string; role: "user" | "assistant"; text: string; time: string }>
  >([
    {
      id: "welcome-msg",
      role: "assistant",
      text: `### Konsultasi Keuangan Aktif
Data akun kas, saldo riil, dan 30 transaksi mutasi Anda telah terhubung.

Silakan pilih topik di bawah atau ketik pertanyaan langsung untuk menganalisis arus kas dan strategi finansial Anda.`,
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
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
        },
      ]);
    },
    onError: (err) => {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: `Gagal memproses data: ${err.message || "Koneksi ke Gemini terganggu."}`,
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    },
  });

  const handleSendChat = (questionText?: string) => {
    const q = (questionText || chatInput).trim();
    if (!q || askAssistantMutation.isPending) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: "user" as const,
      text: q,
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");

    askAssistantMutation.mutate({ question: q });
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
Silakan ajukan pertanyaan baru seputar evaluasi pengeluaran, perbandingan pos, atau strategi anggaran Anda.`,
        time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
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
      {/* 1. MINIMAL EXECUTIVE HEADER (Anti-Slop: Zero Decorative Bloat) */}
      {/* ==================================================================== */}
      <header className="flex items-center justify-between pb-3 border-b border-border/70 shrink-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-sm sm:text-base font-bold tracking-tight text-foreground">
            AI Advisor
          </h1>
          <span className="text-[11px] font-mono text-muted-foreground/80">
            Gemini 3 Flash
          </span>
        </div>

        <div className="flex items-center gap-2">
          {geminiStatus?.connected ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Aktif
            </span>
          ) : !isStatusLoading ? (
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:underline"
            >
              <KeyRound className="h-3 w-3" />
              Pasang API Key
            </Link>
          ) : null}

          <button
            type="button"
            onClick={handleResetChat}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-sm hover:bg-muted/70 flex items-center gap-1 cursor-pointer"
            title="Reset percakapan"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Mulai Baru</span>
          </button>
        </div>
      </header>

      {/* Warning banner jika API key belum terpasang */}
      {!geminiStatus?.connected && !isStatusLoading && (
        <div className="mt-3 p-3 rounded-md border border-amber-500/30 bg-amber-500/5 flex items-center justify-between text-xs shrink-0">
          <span className="text-foreground">
            Google Gemini API Key belum dipasang. Tambahkan token untuk mengaktifkan analisis.
          </span>
          <Link
            href="/settings"
            className="font-bold text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1 shrink-0 ml-3"
          >
            Pengaturan <ArrowRight className="h-3 w-3" />
          </Link>
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
              <div className="w-full max-w-[92%] sm:max-w-[88%] rounded-lg p-3.5 sm:p-4 text-xs bg-muted/30 border border-border/60 text-foreground group transition-colors">
                <AIMessageRenderer content={msg.text} />

                {/* Minimal Footer Toolbar */}
                <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>{msg.time}</span>
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
            <span>Menganalisis transaksi dan menyusun rekomendasi...</span>
          </div>
        )}

        {/* Suggestion Prompts (Only visible when conversation is short) */}
        {chatMessages.length <= 2 && !askAssistantMutation.isPending && (
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
              placeholder="Tanyakan analisis keuangan, pengeluaran, atau strategi hemat..."
              className="w-full h-10 px-3.5 text-xs rounded-md bg-background border border-border/80 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 text-foreground transition-all placeholder:text-muted-foreground/60 pr-14"
              disabled={askAssistantMutation.isPending}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground/60 hidden sm:inline select-none pointer-events-none">
              ↵ Enter
            </span>
          </div>

          <button
            type="submit"
            disabled={askAssistantMutation.isPending || !chatInput.trim()}
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
