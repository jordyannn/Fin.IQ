/* Hallmark · component: AIAdvisorDrawer · theme: Bibit-Fintech · genre: modern-minimal */
"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  X,
  Send,
  Loader2,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  ShieldAlert,
  PiggyBank,
  Coffee,
} from "lucide-react";
import { useMascotStore } from "@/store/mascot.store";
import { trpc } from "@/lib/trpc/client";
import { AIMessageRenderer } from "./AIMessageRenderer";
import { mascotSound } from "@/lib/mascot-sound";

interface QuickPrompt {
  id: string;
  icon: React.ElementType;
  title: string;
  query: string;
}

const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: "audit-boros",
    icon: ShieldAlert,
    title: "Audit Pos Boros",
    query: "Audit pos pengeluaran terbesar saya: mana transaksi yang paling boros atau tidak wajar dan bagaimana cara memangkasnya?",
  },
  {
    id: "batas-belanja",
    icon: Coffee,
    title: "Batas Belanja Harian",
    query: "Hitung batas maksimal belanja harian saya agar sisa bulan ini tetap surplus dan tidak boncos.",
  },
  {
    id: "alokasi-tabungan",
    icon: PiggyBank,
    title: "Alokasi Tabungan Pasti",
    query: "Berdasarkan pemasukan dan pola pengeluaran saya, berapa nominal pasti yang aman saya sisihkan ke tabungan bulan ini?",
  },
  {
    id: "runway-kas",
    icon: TrendingUp,
    title: "Ketahanan Kas (Runway)",
    query: "Dengan rata-rata pengeluaran saat ini, berapa bulan total saldo saya bisa bertahan jika tanpa pemasukan?",
  },
];

interface DrawerMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
}

export function AIAdvisorDrawer() {
  const { isAIDrawerOpen, setAIDrawerOpen } = useMascotStore();

  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<DrawerMessage[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content:
        "Halo bos! **Mau ngapain hari ini?** Bang Peci siap bantu bedah arus kas, audit pos pengeluaran, atau cari strategi biar tabungan makin tebal! 🚀",
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when drawer opens
  useEffect(() => {
    if (isAIDrawerOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isAIDrawerOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isAIDrawerOpen) {
        setAIDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAIDrawerOpen, setAIDrawerOpen]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const askAssistantMutation = trpc.ai.askFinancialAssistant.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: data.answer,
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      mascotSound.playPop();
    },
    onError: (err) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Maaf bos, terjadi kendala: ${err.message || "Koneksi ke AI terganggu."}`,
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    },
  });

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || askAssistantMutation.isPending) return;

    const userMsg: DrawerMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");

    askAssistantMutation.mutate({
      question: text,
      lang: "id",
    });
  };

  if (!isAIDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={() => setAIDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-over Drawer Container */}
      <aside
        className="relative z-50 flex flex-col w-full sm:max-w-md h-full bg-card border-l border-border/80 shadow-2xl animate-in slide-in-from-right duration-250 ease-out"
        role="dialog"
        aria-modal="true"
        aria-label="AI Financial Advisor Drawer"
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3.5 border-b border-border/70 bg-card/90 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-primary/10 border border-primary/20 shrink-0 flex items-center justify-center">
              <Image
                src="/mascot/mascot-tech-halo.png"
                alt="Bang Peci AI Advisor"
                fill
                sizes="40px"
                className="object-contain p-0.5"
                priority
                unoptimized
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-extrabold text-foreground tracking-tight">
                  AI Financial Advisor
                </h2>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Online
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium">
                Didukung Bang Peci &amp; Analisis Fin.IQ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Link
              href="/ai"
              onClick={() => setAIDrawerOpen(false)}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Buka Halaman Penuh AI Advisor"
            >
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <button
              onClick={() => setAIDrawerOpen(false)}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Tutup Panel (Esc)"
              aria-label="Tutup Panel AI Advisor"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Message Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed shadow-2xs ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground font-medium rounded-br-xs"
                    : "bg-muted/60 border border-border/70 text-foreground rounded-bl-xs"
                }`}
              >
                {msg.role === "assistant" ? (
                  <AIMessageRenderer content={msg.content} />
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 px-1">
                {msg.time}
              </span>
            </div>
          ))}

          {/* Quick Action Chips (Shown when only greeting is in chat) */}
          {messages.length <= 1 && (
            <div className="pt-2 animate-in fade-in duration-300">
              <span className="text-[11px] font-bold text-muted-foreground block mb-2">
                Pilih Topik Diskusi Cepat:
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {QUICK_PROMPTS.map((prompt) => {
                  const Icon = prompt.icon;
                  return (
                    <button
                      key={prompt.id}
                      type="button"
                      onClick={() => handleSend(prompt.query)}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border/80 bg-card hover:bg-muted/70 text-left transition-all active:scale-98 cursor-pointer group"
                    >
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-foreground leading-tight">
                        {prompt.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {askAssistantMutation.isPending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border/60 w-fit">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>Bang Peci sedang menganalisis data keuanganmu...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <footer className="p-3 border-t border-border/70 bg-card/95 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Tanya Bang Peci seputar keuangan..."
              className="flex-1 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-border/80 bg-muted/40 text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-background transition-all"
              disabled={askAssistantMutation.isPending}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || askAssistantMutation.isPending}
              className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer shrink-0"
              title="Kirim Pertanyaan"
              aria-label="Kirim Pertanyaan"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-2 px-1">
            <span>Jawaban AI berdasarkan riwayat transaksi lokalmu</span>
            <Link
              href="/ai"
              onClick={() => setAIDrawerOpen(false)}
              className="text-primary hover:underline font-semibold flex items-center gap-0.5"
            >
              <Sparkles className="h-2.5 w-2.5" />
              <span>Buka Layar Penuh</span>
            </Link>
          </div>
        </footer>
      </aside>
    </div>
  );
}
