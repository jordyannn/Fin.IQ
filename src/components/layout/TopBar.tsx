/* Geometric Minimalist Intelligence · TopBar · Fin.IQ */
"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Plus, Menu } from "lucide-react";
import { GeometricIcon } from "@/components/ui/GeometricIcon";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui.store";
import { useTranslation } from "@/i18n";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export function TopBar() {
  const pathname = usePathname();
  const { toggleCommandPalette, openQuickAdd, toggleSidebar } = useUIStore();
  const { t } = useTranslation();

  const getRouteLabel = () => {
    if (pathname === "/overview" || pathname === "/") return t.nav.overview;
    if (pathname.startsWith("/transactions")) return t.nav.transactions;
    if (pathname.startsWith("/ai")) return t.nav.aiAdvisor;
    if (pathname.startsWith("/import")) return t.nav.importData;
    if (pathname.startsWith("/analytics")) return t.nav.analytics;
    if (pathname.startsWith("/calendar")) return t.nav.calendar;
    if (pathname.startsWith("/accounts")) return t.nav.accounts;
    if (pathname.startsWith("/categories")) return t.nav.categories;
    if (pathname.startsWith("/budgets")) return t.nav.budgets;
    if (pathname.startsWith("/ledgers")) return t.nav.ledgers;
    if (pathname.startsWith("/annual-report")) return t.nav.annualReport;
    if (pathname.startsWith("/settings")) return t.nav.settings;
    if (pathname.startsWith("/integrity")) return t.nav.integrity;
    return t.common.appName;
  };

  const currentLabel = getRouteLabel();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border/70 bg-card/90 px-3 sm:px-8 backdrop-blur-md shadow-level-1">
      {/* Left: Breadcrumbs & Page Signpost */}
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
        {/* Mobile Sidebar Toggle Button */}
        <button
          type="button"
          onClick={toggleSidebar}
          data-tour="topbar-sidebar-toggle"
          className="flex lg:hidden h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 active:scale-95 transition-all -ml-1 cursor-pointer shrink-0"
          aria-label="Buka Menu Navigasi"
          title="Buka Menu Navigasi"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-medium">
          <span className="font-bold text-foreground">Fin.IQ</span>
          <span>/</span>
          <span className="text-foreground font-semibold">{currentLabel}</span>
        </div>
        <div className="sm:hidden font-bold text-sm text-foreground truncate max-w-[110px] xs:max-w-[140px]">
          {currentLabel}
        </div>
      </div>

      {/* Right: Language Switcher, Geometric Search Field & Quick Action */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Compact Segmented Language Switcher */}
        <LanguageSwitcher size="sm" />

        <button
          onClick={toggleCommandPalette}
          className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-muted/50 w-28 xs:w-36 sm:w-60 focus:outline-none focus:ring-2 focus:ring-primary/20 active:scale-98 shadow-2xs"
          aria-label={t.topbar.searchPlaceholder}
        >
          <GeometricIcon name="search" size="xs" active />
          <span className="truncate">{t.topbar.searchPlaceholder}</span>
          <kbd className="ml-auto hidden rounded-sm border border-border/80 bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground md:inline-block">
            ⌘K
          </kbd>
        </button>

        {/* Quick Add Button */}
        <Button
          size="sm"
          onClick={openQuickAdd}
          className="hidden sm:inline-flex rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1.5 text-xs h-8 sm:h-9 px-3 shadow-xs active:scale-95 transition-all"
        >
          <Plus className="h-3.5 w-3.5 stroke-[3px]" />
          <span>{t.topbar.quickAdd}</span>
        </Button>
      </div>
    </header>
  );
}
