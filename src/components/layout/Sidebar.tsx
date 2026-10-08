"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Sparkles,
  ShieldCheck,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  { label: "Pengaturan & 2FA", href: "/settings", icon: Settings },
  { label: "Integritas Data", href: "/integrity", icon: ShieldCheck },
];

export function Sidebar({
  isMobile = false,
  onItemClick,
}: {
  isMobile?: boolean;
  onItemClick?: () => void;
}) {
  const pathname = usePathname();

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
        {/* Brand / Logo (Hidden on mobile if drawer already has header) */}
        {!isMobile && (
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-emerald-400 text-white shadow-md shadow-primary/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-foreground flex items-center gap-1.5">
                Fin.IQ
                <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                  Cloud
                </span>
              </h1>
              <p className="text-xs text-muted-foreground font-medium">Smart Financial Engine</p>
            </div>
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
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 font-semibold"
                    : "text-muted-foreground hover:bg-primary/10 hover:text-primary active:scale-[0.98]"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 transition-colors shrink-0",
                    isActive
                      ? "text-primary-foreground"
                      : "text-muted-foreground group-hover:text-primary"
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Group */}
      <div className="flex flex-col gap-1 border-t pt-4 mt-4">
        {secondaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onItemClick}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/15 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.98]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
