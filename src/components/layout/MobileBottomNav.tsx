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
    { label: t.nav.accounts, href: "/accounts", iconName: "accounts" as const },
  ];

  const isMenuRoutes = ![
    "/overview",
    "/transactions",
    "/accounts",
  ].some((r) => pathname === r || pathname?.startsWith(r));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-[calc(4.25rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] w-full items-center justify-around border-t border-border/70 bg-card/95 px-2 backdrop-blur-xl lg:hidden shadow-level-2 select-none touch-manipulation">
      {/* 2 Item Kiri */}
      {leftItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/overview" && pathname?.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors w-14 min-h-[44px] active:scale-95 touch-manipulation",
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
            <span>{item.label}</span>
          </Link>
        );
      })}

      {/* Floating Center Action Button (Quick Add) */}
      <div className="relative -top-3.5 flex items-center justify-center">
        <button
          onClick={openQuickAdd}
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow-emerald transition-transform active:scale-90 border-2 border-background touch-manipulation cursor-pointer"
          aria-label={t.topbar.quickAdd}
        >
          <Plus className="h-6 w-6 stroke-[3px]" />
        </button>
      </div>

      {/* Item Kanan (Akun) */}
      {rightItems.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors w-14 min-h-[44px] active:scale-95 touch-manipulation",
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
            <span>{item.label}</span>
          </Link>
        );
      })}

      {/* Tombol Menu / Laci Seluler */}
      <button
        onClick={toggleSidebar}
        data-tour="bottom-menu-toggle"
        className={cn(
          "flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors w-14 min-h-[44px] active:scale-95 cursor-pointer touch-manipulation",
          isMenuRoutes
            ? "text-primary font-bold"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Menu Lengkap"
      >
        <div className="relative">
          <Menu className={cn("h-5 w-5", isMenuRoutes && "stroke-[2.5px] text-primary scale-105")} />
          {isMenuRoutes && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-xs bg-primary" />
          )}
        </div>
        <span>Menu</span>
      </button>
    </nav>
  );
}
