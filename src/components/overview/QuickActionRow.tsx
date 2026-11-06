"use client";

import React from "react";
import Link from "next/link";
import { useTranslation } from "@/i18n";
import { GeometricIcon, type GeometricIconName } from "@/components/ui/GeometricIcon";
import { useUIStore } from "@/store/ui.store";

interface ActionItem {
  id: string;
  label: string;
  icon: GeometricIconName;
  onClick?: () => void;
  href?: string;
  dataTour: string;
}

export function QuickActionRow() {
  const { t } = useTranslation();
  const { openQuickAdd } = useUIStore();

  // Menggunakan icon GeometricIcon persis yang ada di Sidebar navigasi
  const actions: ActionItem[] = [
    {
      id: "add-tx",
      label: t.quickActions.addTransaction,
      icon: "transactions", // Icon transaksi persis dari sidebar
      onClick: openQuickAdd,
      dataTour: "quick-add-shortcut",
    },
    {
      id: "import",
      label: t.quickActions.import,
      icon: "import", // Icon impor persis dari sidebar
      href: "/import",
      dataTour: "import-shortcut",
    },
    {
      id: "ai",
      label: t.quickActions.ai,
      icon: "ai", // Icon AI advisor persis dari sidebar
      href: "/ai",
      dataTour: "ai-shortcut",
    },
    {
      id: "budgets",
      label: t.quickActions.budget,
      icon: "budgets", // Icon anggaran persis dari sidebar
      href: "/budgets",
      dataTour: "budgets-shortcut",
    },
    {
      id: "analytics",
      label: t.quickActions.analytics,
      icon: "analytics", // Icon analisis persis dari sidebar
      href: "/analytics",
      dataTour: "analytics-shortcut",
    },
    {
      id: "calendar",
      label: t.quickActions.calendar,
      icon: "calendar", // Icon kalender persis dari sidebar
      href: "/calendar",
      dataTour: "calendar-shortcut",
    },
  ];

  return (
    <div
      data-tour="quick-actions-row"
      className="grid grid-cols-6 gap-2 sm:gap-3 w-full"
    >
      {actions.map((act) => {
        const itemContent = (
          <div className="flex flex-col items-center justify-center gap-1.5 p-2 sm:p-2.5 rounded-xl border border-border/80 bg-card hover:border-primary/50 hover:bg-primary/[0.03] transition-all duration-150 select-none shadow-2xs group cursor-pointer active:scale-95 text-center h-full">
            <div className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center shrink-0">
              <GeometricIcon
                name={act.icon}
                size="md"
                active={true}
                className="transition-transform duration-150 group-hover:scale-110"
              />
            </div>

            <span className="text-[10px] sm:text-[11px] font-bold text-foreground group-hover:text-primary transition-colors truncate max-w-full leading-tight">
              {act.label}
            </span>
          </div>
        );

        if (act.onClick) {
          return (
            <button
              key={act.id}
              type="button"
              onClick={act.onClick}
              data-tour={act.dataTour}
              className="w-full h-full text-left focus:outline-none"
            >
              {itemContent}
            </button>
          );
        }

        return (
          <Link
            key={act.id}
            href={act.href!}
            data-tour={act.dataTour}
            className="w-full h-full text-left focus:outline-none"
          >
            {itemContent}
          </Link>
        );
      })}
    </div>
  );
}
