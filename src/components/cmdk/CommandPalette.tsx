"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/store/ui.store";
import { useTheme } from "next-themes";
import {
  Search,
  Plus,
  Sun,
  Moon,
  X,
  Camera,
  Sparkles,
  MessageSquareText,
  KeyRound,
  ArrowRight,
  Command,
} from "lucide-react";
import { GeometricIcon } from "@/components/ui/GeometricIcon";
import {
  MAIN_NAVIGATION_ITEMS,
  SECONDARY_NAVIGATION_ITEMS,
  ALL_NAVIGATION_ITEMS,
  NavItem,
} from "@/config/navigation";

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
  const [filter, setFilter] = useState<"all" | "nav" | "ai" | "action">("all");
  const [activeIndex, setActiveIndex] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Focus on open
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  // Filtered Navigation Items
  const filteredNavItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    let items: NavItem[] = [];
    if (filter === "nav") {
      items = MAIN_NAVIGATION_ITEMS;
    } else if (filter === "all") {
      items = ALL_NAVIGATION_ITEMS;
    } else {
      items = [];
    }

    if (!q) return items;

    return ALL_NAVIGATION_ITEMS.filter((item) => {
      const matchLabel = item.label.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchHref = item.href.toLowerCase().includes(q);
      const matchKeywords = item.keywords.some((kw) => kw.toLowerCase().includes(q));
      return matchLabel || matchDesc || matchHref || matchKeywords;
    });
  }, [search, filter]);

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

  const hasSearch = search.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        className="relative w-full max-w-xl rounded-md border border-border/80 bg-card text-card-foreground shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ==================================================================== */}
        {/* Search Input Bar */}
        {/* ==================================================================== */}
        <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3 bg-card">
          <GeometricIcon name="search" size="xs" active />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Cari menu, halaman, fitur, atau tanya AI..."
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground text-foreground"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="rounded-sm px-1.5 py-0.5 text-muted-foreground hover:bg-muted text-xs cursor-pointer"
            >
              Hapus
            </button>
          )}
          <button
            onClick={() => setCommandPaletteOpen(false)}
            className="rounded-sm p-1 text-muted-foreground hover:bg-muted cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ==================================================================== */}
        {/* Filter Tabs */}
        {/* ==================================================================== */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/60 bg-muted/30 text-xs overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1">Filter:</span>
          <button
            onClick={() => setFilter("all")}
            className={`px-2.5 py-1 rounded-sm font-semibold transition-all cursor-pointer ${
              filter === "all"
                ? "bg-background text-foreground shadow-2xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setFilter("nav")}
            className={`px-2.5 py-1 rounded-sm font-semibold transition-all cursor-pointer ${
              filter === "nav"
                ? "bg-background text-foreground shadow-2xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Menu Sidebar
          </button>
          <button
            onClick={() => setFilter("ai")}
            className={`px-2.5 py-1 rounded-sm font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              filter === "ai"
                ? "bg-emerald-600 text-white shadow-2xs font-bold"
                : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            }`}
          >
            <GeometricIcon name="ai" size="xs" active={filter === "ai"} />
            <span>Fitur AI</span>
          </button>
          <button
            onClick={() => setFilter("action")}
            className={`px-2.5 py-1 rounded-sm font-semibold transition-all cursor-pointer ${
              filter === "action"
                ? "bg-background text-foreground shadow-2xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Aksi Cepat
          </button>
        </div>

        {/* ==================================================================== */}
        {/* List of Results / Navigation */}
        {/* ==================================================================== */}
        <div ref={listRef} className="overflow-y-auto p-2 text-xs space-y-3 flex-1 scrollbar-none">
          {/* Direct Prompt to Ask AI Advisor when user is typing */}
          {hasSearch && (
            <div>
              <div className="px-2.5 py-1 font-bold text-emerald-600 dark:text-emerald-400 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <GeometricIcon name="ai" size="xs" active />
                <span>Konsultasi AI Advisor</span>
              </div>
              <button
                onClick={() => navigateTo(`/ai?q=${encodeURIComponent(search.trim())}`)}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-foreground bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/30 font-semibold transition-all group cursor-pointer text-left shadow-2xs"
              >
                <div className="h-7 w-7 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <GeometricIcon name="ai" size="xs" active />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold block truncate text-foreground">
                    Tanya AI: &quot;{search.trim()}&quot;
                  </span>
                  <span className="text-[10px] text-muted-foreground block truncate">
                    Buka AI Advisor dan minta analisis instan untuk topik ini
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                  Tanya <ArrowRight className="h-3 w-3" />
                </span>
              </button>
            </div>
          )}

          {/* Navigation Items (Synchronized with Sidebar) */}
          {(filter === "all" || filter === "nav") && filteredNavItems.length > 0 && (
            <div>
              <div className="px-2.5 py-1 font-bold text-muted-foreground uppercase text-[10px] tracking-wider flex items-center justify-between">
                <span>{hasSearch ? "Halaman & Menu Ditemukan" : "Menu & Halaman Sidebar"}</span>
                <span className="font-mono text-[9px] opacity-75">{filteredNavItems.length} menu</span>
              </div>

              <div className="space-y-0.5">
                {filteredNavItems.map((item) => (
                  <button
                    key={item.href}
                    onClick={() => navigateTo(item.href)}
                    className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-foreground hover:bg-muted/80 transition-colors cursor-pointer text-left group"
                  >
                    <div className="h-7 w-7 rounded-md bg-muted/60 border border-border/60 flex items-center justify-center shrink-0 group-hover:border-primary/40 group-hover:bg-primary/5 transition-all">
                      <GeometricIcon name={item.iconName} size="xs" active />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                          {item.label}
                        </span>
                        {item.isAI && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-sm bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                            AI
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground block truncate leading-tight mt-0.5">
                        {item.description}
                      </span>
                    </div>

                    <kbd className="ml-auto rounded-sm border border-border/80 bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shrink-0 hidden sm:inline-block">
                      {item.href}
                    </kbd>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI Features Section */}
          {(filter === "all" || filter === "ai") && !hasSearch && (
            <div className="border-t border-border/60 pt-2.5">
              <div className="px-2.5 py-1 font-bold text-emerald-600 dark:text-emerald-400 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <GeometricIcon name="ai" size="xs" active />
                <span>Fitur Cerdas Fin.IQ AI</span>
              </div>

              <div className="space-y-0.5">
                <button
                  onClick={() => navigateTo("/ai")}
                  className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-foreground hover:bg-muted/80 transition-colors cursor-pointer text-left group"
                >
                  <div className="h-7 w-7 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <GeometricIcon name="ai" size="xs" active />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-foreground block truncate">
                        Fin.IQ AI Financial Advisor
                      </span>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-sm bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                        Generative AI
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground block truncate leading-tight mt-0.5">
                      Konsultasi keuangan pribadi, audit pengeluaran, dan rekomendasi aksi nyata
                    </span>
                  </div>
                  <kbd className="ml-auto rounded-sm border border-border/80 bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    /ai
                  </kbd>
                </button>

                <button
                  onClick={() => navigateTo("/settings")}
                  className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-foreground hover:bg-muted/80 transition-colors cursor-pointer text-left group"
                >
                  <div className="h-7 w-7 rounded-md bg-muted/60 border border-border/60 flex items-center justify-center shrink-0">
                    <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-xs text-foreground block truncate">
                      Status &amp; Token API Key Gemini
                    </span>
                    <span className="text-[11px] text-muted-foreground block truncate leading-tight">
                      Kelola token Google Gemini di halaman profil dan pengaturan
                    </span>
                  </div>
                  <kbd className="ml-auto rounded-sm border border-border/80 bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    Token
                  </kbd>
                </button>
              </div>
            </div>
          )}

          {/* Quick Actions (shown in 'all' or 'action' filter) */}
          {(filter === "all" || filter === "action") && !hasSearch && (
            <div className="border-t border-border/60 pt-2.5">
              <div className="px-2.5 py-1 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                Aksi Cepat
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => handleAction(openQuickAdd)}
                  className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-foreground hover:bg-muted/80 transition-colors cursor-pointer text-left group"
                >
                  <div className="h-7 w-7 rounded-md bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                    <Plus className="h-3.5 w-3.5 stroke-[3px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-xs text-foreground block truncate">
                      Catat Transaksi Baru
                    </span>
                    <span className="text-[11px] text-muted-foreground block truncate leading-tight">
                      Input transaksi manual, transfer antar akun, atau pemasukan
                    </span>
                  </div>
                  <kbd className="ml-auto rounded-sm border border-border/80 bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    +
                  </kbd>
                </button>

                <button
                  onClick={() => handleAction(() => setTheme(theme === "dark" ? "light" : "dark"))}
                  className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-foreground hover:bg-muted/80 transition-colors cursor-pointer text-left group"
                >
                  <div className="h-7 w-7 rounded-md bg-muted/60 border border-border/60 flex items-center justify-center shrink-0">
                    {theme === "dark" ? (
                      <Sun className="h-3.5 w-3.5 text-amber-500" />
                    ) : (
                      <Moon className="h-3.5 w-3.5 text-indigo-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-xs text-foreground block truncate">
                      Ganti Tema ({theme === "dark" ? "Mode Terang" : "Mode Gelap"})
                    </span>
                    <span className="text-[11px] text-muted-foreground block truncate leading-tight">
                      Ubah tampilan tema antarmuka aplikasi
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Empty Search State */}
          {hasSearch && filteredNavItems.length === 0 && (
            <div className="p-8 text-center text-muted-foreground space-y-2">
              <GeometricIcon name="search" size="lg" className="mx-auto opacity-40" />
              <p className="text-xs font-medium">
                Tidak ada menu atau halaman yang cocok dengan &quot;<strong className="text-foreground">{search}</strong>&quot;.
              </p>
              <button
                type="button"
                onClick={() => navigateTo(`/ai?q=${encodeURIComponent(search.trim())}`)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline pt-1 cursor-pointer"
              >
                <GeometricIcon name="ai" size="xs" active />
                <span>Tanyakan kepada AI Advisor</span>
              </button>
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* Footer Shortcut Helper */}
        {/* ==================================================================== */}
        <div className="px-4 py-2 bg-muted/40 border-t border-border/60 text-[10px] text-muted-foreground flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-card border border-border font-mono">ESC</kbd> Tutup
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-card border border-border font-mono">⌘K</kbd> Buka Cepat
            </span>
          </div>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <GeometricIcon name="sparkles" size="xs" active />
            Fin.IQ Navigation Search
          </span>
        </div>
      </div>
    </div>
  );
}
