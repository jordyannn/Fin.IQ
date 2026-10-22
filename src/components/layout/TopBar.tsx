/* Geometric Minimalist Intelligence · TopBar · Fin.IQ */
"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { GeometricIcon } from "@/components/ui/GeometricIcon";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui.store";

const ROUTE_LABELS: Record<string, string> = {
  "/overview": "Ringkasan",
  "/transactions": "Transaksi",
  "/ai": "AI Advisor",
  "/import": "Impor Data",
  "/analytics": "Analisis",
  "/calendar": "Kalender",
  "/accounts": "Akun",
  "/categories": "Kategori",
  "/budgets": "Anggaran",
  "/ledgers": "Buku Kas",
  "/annual-report": "Laporan Tahunan",
  "/settings": "Pengaturan",
  "/integrity": "Kesehatan Data",
};

export function TopBar() {
  const pathname = usePathname();
  const { toggleCommandPalette, openQuickAdd } = useUIStore();

  const currentLabel = ROUTE_LABELS[pathname] || "Fin.IQ";

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border/70 bg-card/90 px-4 sm:px-8 backdrop-blur-md shadow-level-1">
      {/* Left: Breadcrumbs & Page Signpost */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-medium">
          <span className="font-bold text-foreground">Fin.IQ</span>
          <span>/</span>
          <span className="text-foreground font-semibold">{currentLabel}</span>
        </div>
        <div className="sm:hidden font-bold text-sm text-foreground">
          {currentLabel}
        </div>
      </div>

      {/* Right: Geometric Search Field & Quick Action */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleCommandPalette}
          className="flex items-center gap-2.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-muted/50 w-44 sm:w-64 focus:outline-none focus:ring-2 focus:ring-primary/20 active:scale-98 shadow-2xs"
          aria-label="Cari transaksi atau menu"
        >
          <GeometricIcon name="search" size="xs" active />
          <span className="truncate">Cari transaksi atau menu...</span>
          <kbd className="ml-auto hidden rounded-sm border border-border/80 bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground md:inline-block">
            ⌘K
          </kbd>
        </button>

        {/* Quick Add Button */}
        <Button
          size="sm"
          onClick={openQuickAdd}
          className="hidden sm:inline-flex rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1.5 text-xs h-8 sm:h-9 px-3 shadow-xs active:scale-95 transition-all"
        >
          <Plus className="h-3.5 w-3.5 stroke-[3px]" />
          <span>Catat</span>
        </Button>
      </div>
    </header>
  );
}
