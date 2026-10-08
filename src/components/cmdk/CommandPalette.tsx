"use client";

import React, { useEffect } from "react";
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
} from "lucide-react";

export function CommandPalette() {
  const router = useRouter();
  const {
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    openQuickAdd,
  } = useUIStore();
  const { theme, setTheme } = useTheme();

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
    router.push(path);
  };

  const handleAction = (action: () => void) => {
    setCommandPaletteOpen(false);
    action();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl rounded-2xl border bg-card text-card-foreground shadow-2xl overflow-hidden">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Ketik perintah atau cari menu..."
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          <button
            onClick={() => setCommandPaletteOpen(false)}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Command Groups */}
        <div className="max-h-96 overflow-y-auto p-2 text-xs">
          {/* Quick Actions */}
          <div className="px-2 py-1.5 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
            Aksi Cepat
          </div>
          <button
            onClick={() => handleAction(openQuickAdd)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
          >
            <Plus className="h-4 w-4 text-primary" />
            <span>Tambah Transaksi Baru</span>
            <kbd className="ml-auto rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              +
            </kbd>
          </button>
          <button
            onClick={() => handleAction(() => setTheme(theme === "dark" ? "light" : "dark"))}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
          >
            {theme === "dark" ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-indigo-500" />}
            <span>Ganti Tema ({theme === "dark" ? "Light Mode" : "Dark Mode"})</span>
          </button>

          {/* Navigation */}
          <div className="mt-2 px-2 py-1.5 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider border-t pt-2">
            Navigasi Halaman
          </div>
          <button
            onClick={() => navigateTo("/overview")}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
          >
            <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
            <span>Dashboard Overview</span>
          </button>
          <button
            onClick={() => navigateTo("/transactions")}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
          >
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <span>Daftar Transaksi</span>
          </button>
          <button
            onClick={() => navigateTo("/accounts")}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
          >
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span>Akun Keuangan (Cash, Blu, Dana)</span>
          </button>
          <button
            onClick={() => navigateTo("/analytics")}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
          >
            <PieChart className="h-4 w-4 text-muted-foreground" />
            <span>Laporan & Analisis</span>
          </button>
          <button
            onClick={() => navigateTo("/calendar")}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
          >
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Kalender Transaksi</span>
          </button>
          <button
            onClick={() => navigateTo("/budgets")}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
          >
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
            <span>Anggaran Bulanan</span>
          </button>
          <button
            onClick={() => navigateTo("/settings")}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-foreground hover:bg-muted font-medium transition-colors"
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span>Pengaturan & Keamanan 2FA</span>
          </button>
        </div>
      </div>
    </div>
  );
}
