/* Geometric Minimalist Intelligence · MobileBottomNav · Fin.IQ */
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { GeometricIcon } from "@/components/ui/GeometricIcon";
import { useUIStore } from "@/store/ui.store";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { openQuickAdd } = useUIStore();
  const { t, locale } = useTranslation();
  const isEn = locale === "en";

  const leftItems = [
    { label: t.nav.overview, href: "/overview", iconName: "overview" as const },
    { label: t.nav.transactions, href: "/transactions", iconName: "transactions" as const },
  ];

  const rightItems = [
    { label: t.nav.budgets, href: "/budgets", iconName: "budgets" as const },
    { label: t.nav.settings, href: "/settings", iconName: "settings" as const },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 items-center w-full h-[calc(3.75rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] border-t border-border/70 bg-card/95 backdrop-blur-xl lg:hidden select-none touch-manipulation shadow-level-1"
      aria-label={isEn ? "Bottom Navigation" : "Navigasi Bawah"}
    >
      {/* 2 Item Kiri: Ringkasan & Transaksi */}
      {leftItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/overview" && pathname?.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 h-full min-h-[48px] text-[10px] tracking-tight transition-all active:scale-95 touch-manipulation group",
              isActive
                ? "text-primary font-bold"
                : "text-muted-foreground/80 hover:text-foreground font-medium"
            )}
          >
            <GeometricIcon
              name={item.iconName}
              size="sm"
              active={isActive}
              className={cn("transition-transform shrink-0", isActive && "scale-105")}
            />
            <span className="truncate max-w-[60px] leading-tight">{item.label}</span>
          </Link>
        );
      })}

      {/* Floating Center Action Button (Quick Add) */}
      <div className="flex items-center justify-center relative -top-3">
        <button
          type="button"
          onClick={openQuickAdd}
          data-tour="quick-add"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-md hover:bg-emerald-600 active:scale-90 transition-all border-2 border-background ring-1 ring-primary/20 touch-manipulation cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          aria-label={t.topbar.quickAdd}
        >
          <Plus className="h-5 w-5 stroke-[2.5px]" />
        </button>
      </div>

      {/* 2 Item Kanan: Anggaran & Pengaturan */}
      {rightItems.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 h-full min-h-[48px] text-[10px] tracking-tight transition-all active:scale-95 touch-manipulation group",
              isActive
                ? "text-primary font-bold"
                : "text-muted-foreground/80 hover:text-foreground font-medium"
            )}
          >
            <GeometricIcon
              name={item.iconName}
              size="sm"
              active={isActive}
              className={cn("transition-transform shrink-0", isActive && "scale-105")}
            />
            <span className="truncate max-w-[60px] leading-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
