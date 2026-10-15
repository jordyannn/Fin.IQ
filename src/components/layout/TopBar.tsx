/* Hallmark · component: TopBar · theme: Bibit-Fintech · genre: modern-minimal */
"use client";

import React from "react";
import { Search } from "lucide-react";
import { useUIStore } from "@/store/ui.store";

export function TopBar() {
  const { toggleCommandPalette } = useUIStore();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border/60 bg-card/85 px-3.5 sm:px-6 backdrop-blur-md">
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Search Bar — tetap di TopBar. Semua komponen lain pindah ke Sidebar. */}
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
      </div>
    </header>
  );
}
