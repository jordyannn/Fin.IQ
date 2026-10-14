/* Hallmark · component: Sidebar · theme: Bibit-Fintech · genre: modern-minimal */
"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  PieChart,
  Calendar,
  Wallet,
  Tags,
  PiggyBank,
  BookOpen,
  CalendarRange,
  Settings,
  ShieldCheck,
  FileSpreadsheet,
  LogOut,
  Sparkles,
  User,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";

const navigationItems = [
  { label: "Overview", href: "/overview", icon: LayoutDashboard },
  { label: "Transaksi", href: "/transactions", icon: Receipt },
  { label: "Fin.IQ AI", href: "/ai", icon: Sparkles },
  { label: "Impor Transaksi", href: "/import", icon: FileSpreadsheet },
  { label: "Analisis", href: "/analytics", icon: PieChart },
  { label: "Kalender", href: "/calendar", icon: Calendar },
  { label: "Akun Keuangan", href: "/accounts", icon: Wallet },
  { label: "Kategori", href: "/categories", icon: Tags },
  { label: "Anggaran", href: "/budgets", icon: PiggyBank },
  { label: "Buku Kas", href: "/ledgers", icon: BookOpen },
  { label: "Laporan Tahunan", href: "/annual-report", icon: CalendarRange },
];

const secondaryItems = [
  { label: "Pengaturan & Profil", href: "/settings", icon: Settings },
  { label: "Integritas Data", href: "/integrity", icon: ShieldCheck },
];

export function Sidebar({
  isMobile = false,
  onItemClick,
}: {
  isMobile?: boolean;
  onItemClick?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: profile } = trpc.user.getProfile.useQuery();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsProfileMenuOpen(false);
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
    <aside
      className={cn(
        "flex flex-col select-none shrink-0",
        isMobile
          ? "w-full h-full py-1"
          : "hidden lg:flex w-64 h-screen sticky top-0 border-r border-border/60 bg-card/75 backdrop-blur-md px-4 py-5 z-20"
      )}
    >
      {/* Brand Header */}
      {!isMobile && (
        <div className="px-3 py-1 shrink-0 mb-1">
          <Link href="/overview" className="block group">
            <h1 className="text-xl font-black tracking-tight text-foreground group-hover:text-[#00B569] transition-colors">
              Fin.IQ
            </h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Fintech Finance Engine
            </p>
          </Link>
        </div>
      )}

      {/* Scrollable Navigation Area */}
      <div className="flex-1 overflow-y-auto pr-1 -mr-1 my-2 space-y-4">
        {/* Navigation Group: Main */}
        <nav className="flex flex-col gap-1">
          <p className="px-2 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase mb-1">
            Menu Utama
          </p>
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/overview" && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onItemClick}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all group",
                  isActive
                    ? "bg-[#00B569] text-white shadow-sm shadow-emerald-500/20 font-bold"
                    : "text-muted-foreground hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 hover:text-[#00B569] active:scale-[0.98]"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 transition-colors shrink-0",
                    isActive
                      ? "text-white"
                      : "text-muted-foreground group-hover:text-[#00B569]"
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Navigation Group: Secondary */}
        <div className="pt-2 border-t border-border/50">
          <p className="px-2 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase mb-1">
            Preferensi
          </p>
          <div className="flex flex-col gap-1">
            {secondaryItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onItemClick}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-emerald-50 dark:bg-emerald-950/50 text-[#00B569] font-bold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.98]"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fixed Profile Card & Dropup Menu at Bottom */}
      <div className="shrink-0 pt-3 border-t border-border/60 relative" ref={profileMenuRef}>
        {/* Dropup Popup Modal */}
        {isProfileMenuOpen && (
          <div className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border border-border/80 bg-card p-2 text-xs shadow-2xl shadow-black/15 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-150 z-50">
            {/* Header info */}
            <div className="px-3 py-2.5 border-b border-border/60">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-[#00B569] border border-emerald-500/20">
                  Akun Aktif
                </span>
                <span className="text-[10px] text-muted-foreground">Fin.IQ</span>
              </div>
              <p className="font-extrabold text-foreground truncate text-sm">
                {profile?.displayName || "Pengguna Fin.IQ"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {profile?.email || "owner@finiq.app"}
              </p>
            </div>

            {/* Menu Items */}
            <div className="py-1.5 space-y-0.5">
              <Link
                href="/settings"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onItemClick?.();
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors font-medium"
              >
                <User className="h-4 w-4 text-[#00B569]" />
                <span>Profil &amp; Pengaturan</span>
              </Link>

              <Link
                href="/integrity"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onItemClick?.();
                }}
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

        {/* Trigger Profile Button */}
        <button
          type="button"
          onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
          className={cn(
            "w-full flex items-center justify-between p-2.5 rounded-2xl border transition-all text-left outline-none group",
            isProfileMenuOpen
              ? "bg-muted border-[#00B569]/50 ring-2 ring-[#00B569]/20"
              : "bg-muted/40 hover:bg-muted/80 border-border/60 hover:border-border"
          )}
          aria-label="Menu Profil Pengguna"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-[#00B569] dark:bg-emerald-950 dark:text-emerald-400 text-xs font-black shrink-0 border border-emerald-300 dark:border-emerald-800 shadow-sm group-hover:scale-105 transition-transform">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-foreground truncate group-hover:text-[#00B569] transition-colors">
                {profile?.displayName || "Pengguna Fin.IQ"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {profile?.email || "owner@finiq.app"}
              </p>
            </div>
          </div>
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0 ml-1 group-hover:text-foreground transition-colors" />
        </button>
      </div>
    </aside>
  );
}
