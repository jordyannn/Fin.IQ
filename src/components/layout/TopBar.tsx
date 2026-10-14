/* Hallmark · component: TopBar · theme: Bibit-Fintech · genre: modern-minimal */
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Sun,
  Moon,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui.store";
import { useTheme } from "next-themes";
import { trpc } from "@/lib/trpc/client";

export function TopBar() {
  const { openQuickAdd, toggleCommandPalette } = useUIStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch ledgers list for the top indicator
  const { data: ledgersList } = trpc.ledgers.list.useQuery();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border/60 bg-card/85 px-3.5 sm:px-6 backdrop-blur-md">
      {/* Left Area: Mobile Brand & Search Trigger */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Mobile Brand */}
        <div className="flex lg:hidden items-center mr-1">
          <span className="text-base font-black tracking-tight text-foreground">
            Fin.IQ
          </span>
        </div>

        {/* Command Palette Trigger */}
        <button
          onClick={toggleCommandPalette}
          className="flex items-center gap-2 rounded-xl border border-input/70 bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:bg-muted/80 md:w-64 active:scale-98"
        >
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="hidden md:inline">Cari transaksi, menu, AI...</span>
          <span className="md:hidden">Cari...</span>
          <kbd className="ml-auto hidden rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground md:inline-block">
            ⌘K
          </kbd>
        </button>

        {/* AI Studio Quick Button */}
        <Link href="/ai">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs rounded-xl font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 px-2.5"
            title="Buka Fin.IQ AI Studio"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#00B569]" />
            <span className="hidden sm:inline">AI Studio</span>
          </Button>
        </Link>
      </div>

      {/* Right Area: Actions, Quick Add & User */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Ledger Indicator */}
        <div className="hidden md:flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-xs font-semibold text-foreground">
          <BookOpen className="h-3.5 w-3.5 text-[#00B569]" />
          <span>{ledgersList?.[0]?.name || "Buku Kas Utama"}</span>
        </div>

        {/* Quick Add Button */}
        <Button
          onClick={openQuickAdd}
          size="sm"
          className="bg-[#00B569] hover:bg-[#009E5B] text-white font-semibold shadow-sm gap-1.5 text-xs sm:text-sm px-3.5 rounded-xl transition-transform active:scale-95"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span className="hidden sm:inline">Tambah</span> Transaksi
        </Button>

        {/* Theme Toggle */}
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="text-muted-foreground hover:text-foreground h-9 w-9 rounded-xl"
            aria-label="Toggle tema"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 transition-transform rotate-0 scale-100 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 transition-transform rotate-0 scale-100 text-slate-700" />
            )}
          </Button>
        )}
      </div>
    </header>
  );
}
