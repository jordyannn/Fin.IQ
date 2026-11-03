"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Activity,
  RefreshCw,
  LogOut,
  LayoutDashboard,
  ShieldCheck,
  Calendar,
  Infinity as InfinityIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type DateRangePreset = "today" | "7d" | "month" | "30d" | "year" | "all";

export const DATE_PRESETS: { id: DateRangePreset; label: string; shortLabel: string }[] = [
  { id: "today", label: "Hari Ini", shortLabel: "Hari Ini" },
  { id: "7d", label: "7 Hari Terakhir", shortLabel: "7 Hari" },
  { id: "month", label: "Bulan Ini", shortLabel: "Bulan Ini" },
  { id: "30d", label: "30 Hari Terakhir", shortLabel: "30 Hari" },
  { id: "year", label: "Tahun Ini (Tahunan)", shortLabel: "Tahunan" },
  { id: "all", label: "Sepanjang Waktu (Lifetime)", shortLabel: "Lifetime" },
];

interface AdminHeaderProps {
  dateRange: DateRangePreset;
  setDateRange: (range: DateRangePreset) => void;
  isFetching: boolean;
  onRefresh: () => void;
  lastUpdated: Date;
}

export function AdminHeader({
  dateRange,
  setDateRange,
  isFetching,
  onRefresh,
  lastUpdated,
}: AdminHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur-md transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Brand & Badge */}
        <div className="flex items-center gap-3">
          <Link href="/admin/monitor" className="flex items-center gap-2.5 group">
            <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center p-0.5 shadow-2xs group-hover:scale-105 transition-transform">
              <Image
                src="/mascot/mascot-logo.png"
                alt="Fin.IQ Mascot"
                width={32}
                height={32}
                className="object-contain"
                unoptimized
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg tracking-tight text-foreground">
                  Fin<span className="text-[#059669]">.IQ</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="h-3 w-3" />
                  Admin Monitor
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground hidden sm:block">
                Traffic Analytics & Platform Operations
              </p>
            </div>
          </Link>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Live Status Indicator */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Live Sync (30s)</span>
          </div>

          {/* Date Range Selector: Desktop Buttons Group */}
          <div className="hidden lg:flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/60 text-xs">
            {DATE_PRESETS.map((preset) => {
              const isActive = dateRange === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => setDateRange(preset.id)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                    isActive
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={preset.label}
                >
                  {preset.id === "all" && <InfinityIcon className="h-3 w-3" />}
                  {preset.shortLabel}
                </button>
              );
            })}
          </div>

          {/* Date Range Selector: Compact Dropdown for Tablet & Mobile */}
          <div className="lg:hidden flex items-center">
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRangePreset)}
                className="pl-8 pr-3 py-1 bg-muted/70 border border-border/80 rounded-md text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                {DATE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isFetching}
            className="h-8 px-2.5 text-xs gap-1.5 border-border/80"
            title={`Terakhir diperbarui: ${lastUpdated.toLocaleTimeString("id-ID")}`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-emerald-600" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {/* Switch to User App */}
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-8 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Link href="/overview">
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Buka Aplikasi</span>
            </Link>
          </Button>

          {/* Logout */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="h-8 px-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:text-rose-700"
            title="Keluar Akun Admin"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
