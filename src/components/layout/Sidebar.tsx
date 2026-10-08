"use client";

import React from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";

const navigationItems = [
  { label: "Overview", href: "/overview", icon: LayoutDashboard },
  { label: "Transaksi", href: "/transactions", icon: Receipt },
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

  const handleLogout = async () => {
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
        "flex flex-col justify-between select-none shrink-0",
        isMobile
          ? "w-full py-2 px-1"
          : "hidden lg:flex w-64 border-r bg-card/60 backdrop-blur-md px-4 py-6"
      )}
    >
      <div className="flex flex-col gap-5">
        {/* Brand */}
        {!isMobile && (
          <div className="px-3 py-1">
            <h1 className="text-xl font-black tracking-tight text-foreground">
              Fin.IQ
            </h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">Fintech Finance Engine</p>
          </div>
        )}

        {/* Navigation Groups */}
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
      </div>

      {/* Bottom Group */}
      <div className="flex flex-col gap-2 border-t pt-4 mt-4">
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

        {/* User Profile Card & Quick Logout */}
        <div className="flex items-center justify-between p-2.5 rounded-2xl bg-muted/40 border border-border/60 mt-1">
          <Link
            href="/settings"
            onClick={onItemClick}
            className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-[#00B569] dark:bg-emerald-950 dark:text-emerald-400 text-xs font-black shrink-0 border border-emerald-300 dark:border-emerald-800">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-foreground truncate">
                {profile?.displayName || "Pengguna"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {profile?.email || "owner@finiq.app"}
              </p>
            </div>
          </Link>

          <button
            onClick={handleLogout}
            title="Keluar dari akun"
            className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors ml-1"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
