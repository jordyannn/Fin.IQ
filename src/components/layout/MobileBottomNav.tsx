/* Geometric Minimalist Intelligence · MobileBottomNav · Fin.IQ */
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Menu } from "lucide-react";
import { GeometricIcon } from "@/components/ui/GeometricIcon";
import { useUIStore } from "@/store/ui.store";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { openQuickAdd, toggleSidebar } = useUIStore();
  const { t } = useTranslation();

  const leftItems = [
    { label: t.nav.overview, href: "/overview", iconName: "overview" as const },
    { label: t.nav.transactions, href: "/transactions", iconName: "transactions" as const },
  ];

  const rightItems = [
    { label: t.nav.budgets, href: "/budgets", iconName: "budgets" as const },
    { label: t.nav.settings, href: "/settings", iconName: "settings" as const },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-[calc(4.25rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] w-full items-center justify-around border-t border-border/70 bg-card/95 px-2 backdrop-blur-xl lg:hidden shadow-level-2 select-none touch-manipulation">
      {/* 2 Item Kiri: Beranda & Transaksi */}
      {leftItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/overview" && pathname?.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors w-16 min-h-[44px] active:scale-95 touch-manipulation",
              isActive
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <GeometricIcon
                name={item.iconName}
                size="sm"
                active={isActive}
                className={cn("transition-transform", isActive && "scale-110")}
              />
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-xs bg-primary" />
              )}
            </div>
            <span className="truncate max-w-[64px]">{item.label}</span>
          </Link>
        );
      })}

      {/* Floating Center Action Button (Quick Add - Circular FAB matching wireframe) */}
      <div className="relative -top-3.5 flex items-center justify-center">
        <button
          onClick={openQuickAdd}
          data-tour="quick-add"
          className="flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow-emerald transition-transform active:scale-90 border-4 border-background touch-manipulation cursor-pointer"
          aria-label={t.topbar.quickAdd}
        >
          <Plus className="h-6 w-6 stroke-[3px]" />
        </button>
      </div>

      {/* 2 Item Kanan: Anggaran & Pengaturan */}
      {rightItems.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors w-16 min-h-[44px] active:scale-95 touch-manipulation",
              isActive
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <GeometricIcon
                name={item.iconName}
                size="sm"
                active={isActive}
                className={cn("transition-transform", isActive && "scale-110")}
              />
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-xs bg-primary" />
              )}
            </div>
            <span className="truncate max-w-[64px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
