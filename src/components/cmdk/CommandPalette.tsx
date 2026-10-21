"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/store/ui.store";
import { useTheme } from "next-themes";
import {
  Search,
  Plus,
  LayoutDashboard,
  Receipt,
  Wallet,
  PieChart,
  Calendar,
  PiggyBank,
  Settings,
  Sun,
  Moon,
  X,
  Camera,
  Sparkles,
  MessageSquareText,
  KeyRound,
  ArrowRight,
  Bot,
} from "lucide-react";

export function CommandPalette() {
  const router = useRouter();
  const {
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    openQuickAdd,
    openQuickAddWithScan,
  } = useUIStore();
  const { theme, setTheme } = useTheme();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "ai" | "nav">("all");

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const navigateTo = (path: string) => {
    setCommandPaletteOpen(false);
    setSearch("");
    router.push(path);
  };

  const handleAction = (action: () => void) => {
    setCommandPaletteOpen(false);
    setSearch("");
    action();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl rounded-md border bg-card text-card-foreground shadow-2xl overflow-hidden">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ketik perintah, tanya AI, atau cari menu..."
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="rounded p-1 text-muted-foreground hover:bg-muted text-xs"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setCommandPaletteOpen(false)}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b bg-muted/30 text-xs">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1">Filter:</span>
          <button
            onClick={() => setFilter("all")}
            className={`px-2.5 py-0.5 rounded-lg font-medium transition-all ${
              filter === "all" ? "bg-background text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setFilter("ai")}
            className={`px-2.5 py-0.5 rounded-lg font-medium transition-all flex items-center gap-1 ${
              filter === "ai"
                ? "bg-emerald-600 text-white shadow-sm font-semibold"
                : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            }`}
          >
            <Sparkles className="h-3 w-3" />
            Pilihan AI
          </button>
          <button
            onClick={() => setFilter("nav")}
            className={`px-2.5 py-0.5 rounded-lg font-medium transition-all ${
              filter === "nav" ? "bg-background text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Navigasi
          </button>
        </div>

        {/* Command Groups */}
        <div className="max-h-96 overflow-y-auto p-2 text-xs space-y-2">
          {/* AI Choices Section (shown in 'all' or 'ai' filter) */}
          {(filter === "all" || filter === "ai") && (
            <div>
              <div className="px-2 py-1 font-semibold text-emerald-600 dark:text-emerald-400 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Pilihan Fin.IQ AI (Gemini Studio)
              </div>

              {search.trim().length > 0 && (
                <button
                  onClick={() => navigateTo(`/ai?q=${encodeURIComponent(search.trim())}`)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-primary bg-primary/5 hover:bg-primary/10 font-semibold transition-colors mb-1 border border-primary/20"
                >
                  <MessageSquareText className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">Tanya AI: &quot;{search.trim()}&quot;</span>
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-primary">
                    Tanya <ArrowRight className="h-3 w-3" />
                  </span>
                </button>
              )}

              <button
                onClick={() => navigateTo("/ai")}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
              >
                <Bot className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Buka Fin.IQ AI Studio (Hub Utama)</span>
                <kbd className="ml-auto rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                  /ai
                </kbd>
              </button>

              <button
                onClick={() => handleAction(openQuickAddWithScan)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
              >
                <Camera className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Scan Struk / Bill Kasir (OCR Gemini)</span>
                <kbd className="ml-auto rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                  OCR
                </kbd>
              </button>

              <button
                onClick={() => handleAction(openQuickAdd)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
              >
                <Sparkles className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Dikte Suara &amp; Smart NLP Transaksi</span>
                <kbd className="ml-auto rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                  Voice
                </kbd>
              </button>

              <button
                onClick={() => navigateTo("/settings")}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
              >
                <KeyRound className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Sambungkan / Cek Token Gemini di Profil</span>
                <kbd className="ml-auto rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                  Token
                </kbd>
              </button>
            </div>
          )}

          {/* Quick Actions (shown in 'all' filter) */}
          {filter === "all" && (
            <div className="border-t pt-2">
              <div className="px-2 py-1 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                Aksi Cepat
              </div>
              <button
                onClick={() => handleAction(openQuickAdd)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
              >
                <Plus className="h-4 w-4 text-primary shrink-0" />
                <span>Catat Transaksi Manual</span>
                <kbd className="ml-auto rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                  +
                </kbd>
              </button>
              <button
                onClick={() => handleAction(() => setTheme(theme === "dark" ? "light" : "dark"))}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
              >
                {theme === "dark" ? <Sun className="h-4 w-4 text-amber-500 shrink-0" /> : <Moon className="h-4 w-4 text-indigo-500 shrink-0" />}
                <span>Ganti Tema ({theme === "dark" ? "Light Mode" : "Dark Mode"})</span>
              </button>
            </div>
          )}

          {/* Navigation (shown in 'all' or 'nav' filter) */}
          {(filter === "all" || filter === "nav") && (
            <div className="border-t pt-2">
              <div className="px-2 py-1 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                Navigasi Halaman
              </div>
              <button
                onClick={() => navigateTo("/ai")}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
              >
                <Sparkles className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Fin.IQ AI Studio</span>
              </button>
              <button
                onClick={() => navigateTo("/overview")}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
              >
                <LayoutDashboard className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Dashboard Overview</span>
              </button>
              <button
                onClick={() => navigateTo("/transactions")}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
              >
                <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Daftar Transaksi</span>
              </button>
              <button
                onClick={() => navigateTo("/accounts")}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
              >
                <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Akun Keuangan (Cash, Blu, Dana)</span>
              </button>
              <button
                onClick={() => navigateTo("/analytics")}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
              >
                <PieChart className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Laporan &amp; Analisis</span>
              </button>
              <button
                onClick={() => navigateTo("/calendar")}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
              >
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Kalender Transaksi</span>
              </button>
              <button
                onClick={() => navigateTo("/budgets")}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
              >
                <PiggyBank className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Anggaran Bulanan</span>
              </button>
              <button
                onClick={() => navigateTo("/settings")}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
              >
                <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Pengaturan, Profil &amp; Token AI</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
