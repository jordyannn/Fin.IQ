"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Sun,
  Moon,
  BookOpen,
  User,
  Settings,
  ShieldCheck,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui.store";
import { useTheme } from "next-themes";
import { trpc } from "@/lib/trpc/client";

export function TopBar() {
  const router = useRouter();
  const { openQuickAdd, toggleCommandPalette } = useUIStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch ledgers and user profile
  const { data: ledgersList } = trpc.ledgers.list.useQuery();
  const { data: profile } = trpc.user.getProfile.useQuery();

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  const userInitials = profile?.displayName
    ? profile.displayName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "FQ";

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border/60 bg-card/85 px-3.5 sm:px-6 backdrop-blur-md">
      {/* Left Area: Mobile Brand & Search Trigger */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Mobile Brand Badge */}
        <div className="flex lg:hidden items-center gap-2 mr-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#00B569] text-white font-black text-xs shadow-sm shadow-emerald-500/25">
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

        {/* Interactive Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1.5 p-1 rounded-full hover:ring-2 hover:ring-[#00B569]/30 transition-all outline-none"
            aria-label="Buka menu profil"
          >
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-100 text-[#00B569] dark:bg-emerald-950 dark:text-emerald-400 text-xs font-black border border-emerald-300 dark:border-emerald-800 shadow-sm">
              {userInitials}
            </div>
            <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
          </button>

          {/* Dropdown Menu Modal */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-border/80 bg-card p-2 text-xs shadow-xl shadow-black/10 backdrop-blur-xl animate-in fade-in zoom-in-95 z-50">
              {/* Header */}
              <div className="px-3 py-2.5 border-b border-border/60">
                <p className="font-extrabold text-foreground truncate text-sm">
                  {profile?.displayName || "Pengguna Fin.IQ"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {profile?.email || "owner@finiq.app"}
                </p>
              </div>

              {/* Menu items */}
              <div className="py-1.5 space-y-0.5">
                <Link
                  href="/settings"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors font-medium"
                >
                  <User className="h-4 w-4 text-[#00B569]" />
                  <span>Profil &amp; Pengaturan</span>
                </Link>

                <Link
                  href="/integrity"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors font-medium"
                >
                  <ShieldCheck className="h-4 w-4 text-blue-500" />
                  <span>Integritas Database</span>
                </Link>
              </div>

              {/* Logout button */}
              <div className="pt-1.5 border-t border-border/60">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors font-semibold"
                >
                  <LogOut className="h-4 w-4 text-red-500" />
                  <span>Keluar Akun</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
