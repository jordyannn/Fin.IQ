"use client";

import React from "react";
import Link from "next/link";
import { useTranslation } from "@/i18n";
import { GeometricIcon, type GeometricIconName } from "@/components/ui/GeometricIcon";

interface ActionItem {
  id: string;
  label: string;
  icon: GeometricIconName;
  href: string;
  dataTour: string;
  isHighlighted?: boolean;
  badge?: {
    full: string;
    short: string;
  };
}

export function QuickActionRow() {
  const { t, locale } = useTranslation();
  const isEn = locale === "en";

  // Shortcuts aksi cepat halaman overview (Add Transaction dihapus karena sudah ada di Topbar/Nav)
  const actions: ActionItem[] = [
    {
      id: "import",
      label: t.quickActions.import,
      icon: "import",
      href: "/import",
      dataTour: "overview-import-hub",
      isHighlighted: true,
      badge: {
        full: "Excel · PDF",
        short: "XLS/PDF",
      },
    },
    {
      id: "ai",
      label: t.quickActions.ai,
      icon: "ai",
      href: "/ai",
      dataTour: "ai-shortcut",
    },
    {
      id: "budgets",
      label: t.quickActions.budget,
      icon: "budgets",
      href: "/budgets",
      dataTour: "budgets-shortcut",
    },
    {
      id: "analytics",
      label: t.quickActions.analytics,
      icon: "analytics",
      href: "/analytics",
      dataTour: "analytics-shortcut",
    },
    {
      id: "calendar",
      label: t.quickActions.calendar,
      icon: "calendar",
      href: "/calendar",
      dataTour: "calendar-shortcut",
    },
  ];

  return (
    <div
      data-tour="quick-actions-row"
      className="grid grid-cols-5 gap-2 sm:gap-3 w-full pt-1.5"
    >
      {actions.map((act) => {
        const isHighlighted = act.isHighlighted;

        return (
          <Link
            key={act.id}
            href={act.href}
            data-tour={act.dataTour}
            className="w-full h-full text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 select-none"
            title={
              isHighlighted
                ? (isEn
                    ? "Import transactions from Excel (.xlsx, .csv) and PDF bank statements"
                    : "Impor mutasi dari file Excel (.xlsx, .csv) dan e-statement PDF")
                : act.label
            }
          >
            <div
              className={`relative flex flex-col items-center justify-center gap-1.5 p-2 sm:p-2.5 rounded-xl transition-all duration-150 shadow-2xs group cursor-pointer active:scale-95 text-center h-full ${
                isHighlighted
                  ? "border border-emerald-500/40 dark:border-emerald-500/50 ring-1 ring-emerald-500/25 dark:ring-emerald-400/25 bg-gradient-to-b from-emerald-500/[0.08] to-card dark:from-emerald-500/[0.14] dark:to-card hover:border-emerald-500/80 hover:ring-emerald-500/45 hover:shadow-xs"
                  : "border border-border/80 bg-card hover:border-primary/50 hover:bg-primary/[0.03]"
              }`}
            >
              {/* Penanda Eye-Catching (Micro-Badge for Excel/PDF) */}
              {act.badge && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[8px] sm:text-[8.5px] font-mono font-extrabold uppercase tracking-tight bg-emerald-600 text-white dark:bg-emerald-500 dark:text-zinc-950 border border-emerald-400/40 shadow-2xs whitespace-nowrap leading-none select-none">
                  <span className="hidden xs:inline">{act.badge.full}</span>
                  <span className="xs:hidden">{act.badge.short}</span>
                </span>
              )}

              {/* Lis Luar Icon Container (Bespoke Double-Border Frame) */}
              <div
                className={`flex items-center justify-center shrink-0 transition-all duration-150 group-hover:scale-105 ${
                  isHighlighted
                    ? "h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-emerald-500/15 dark:bg-emerald-500/25 border border-emerald-500/35 ring-2 ring-emerald-500/15"
                    : "h-8 w-8 sm:h-9 sm:w-9"
                }`}
              >
                <GeometricIcon
                  name={act.icon}
                  size="md"
                  active={true}
                  className="transition-transform duration-150"
                />
              </div>

              {/* Action Label */}
              <span
                className={`text-[10px] sm:text-[11px] font-bold truncate max-w-full leading-tight transition-colors ${
                  isHighlighted
                    ? "font-extrabold text-emerald-700 dark:text-emerald-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-200"
                    : "text-foreground group-hover:text-primary"
                }`}
              >
                {act.label}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
