"use client";

import React, { useEffect, useState } from "react";
import {
  Search,
  Plus,
  Sun,
  Moon,
  BookOpen,
  Bell,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui.store";
import { useTheme } from "next-themes";
import { trpc } from "@/lib/trpc/client";

export function TopBar() {
  const { openQuickAdd, toggleCommandPalette, toggleSidebar } = useUIStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch ledgers
  const { data: ledgersList } = trpc.ledgers.list.useQuery();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border/60 bg-card/85 px-3.5 sm:px-6 backdrop-blur-md">
      {/* Left Area: Mobile Brand & Search Trigger */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Mobile Brand Badge */}
        <div className="flex lg:hidden items-center gap-2 mr-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-white font-black text-xs shadow-sm shadow-primary/25">
            FQ
          </div>
        </div>

        {/* Command Palette Trigger */}
        <button
          onClick={toggleCommandPalette}
          className="flex items-center gap-2 rounded-xl border border-input/70 bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:bg-muted/80 md:w-64 active:scale-98"
        >
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="hidden md:inline">Cari transaksi, menu...</span>
          <span className="md:hidden">Cari menu...</span>
          <kbd className="ml-auto hidden rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground md:inline-block">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Area: Actions, Quick Add & User */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Ledger Indicator */}
        <div className="hidden md:flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-3 py-1 text-xs font-semibold text-foreground">
          <BookOpen className="h-3.5 w-3.5 text-primary" />
          <span>{ledgersList?.[0]?.name || "Buku Kas Utama"}</span>
        </div>

        {/* Quick Add Button */}
        <Button
          onClick={openQuickAdd}
          size="sm"
          className="bg-primary hover:bg-primary/90 text-white font-medium shadow-sm gap-1.5 text-xs sm:text-sm px-3"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Tambah</span> Transaksi
        </Button>

        {/* Theme Toggle */}
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="text-muted-foreground hover:text-foreground h-9 w-9"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 transition-transform rotate-0 scale-100" />
            ) : (
              <Moon className="h-4 w-4 transition-transform rotate-0 scale-100" />
            )}
          </Button>
        )}

        {/* Profile Avatar */}
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/20 text-primary text-xs font-bold border border-primary/30">
          OW
        </div>
      </div>
    </header>
  );
}
