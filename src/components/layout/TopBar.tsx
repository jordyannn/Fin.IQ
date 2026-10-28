/* Geometric Minimalist Intelligence · TopBar · Fin.IQ */
"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { GeometricIcon } from "@/components/ui/GeometricIcon";
import { useUIStore } from "@/store/ui.store";
import { useTranslation } from "@/i18n";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export function TopBar() {
  const pathname = usePathname();
  const { toggleCommandPalette, toggleSidebar } = useUIStore();
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
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 w-full items-center justify-between border-b border-border/70 bg-card/95 px-3.5 sm:px-8 backdrop-blur-xl shadow-level-1 shrink-0 select-none">
      {/* Mobile Header: Toggle on left, Centered page title in middle, Actions on right */}
      {/* Desktop Header: Page Title on left, Search bar + Language + Quick Add on right */}
      
      {/* Left: Mobile Sidebar Menu Toggle & Desktop Page Title */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Tombol Buka Sidebar Mobile */}
        <button
          onClick={toggleSidebar}
          aria-label="Buka Menu Navigasi"
          data-tour="mobile-sidebar-toggle"
          className="flex lg:hidden h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/40 active:scale-95 transition-all shadow-2xs cursor-pointer touch-manipulation"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Desktop Page Title (Logo and Fin.IQ branding are in Sidebar) */}
        <div className="hidden lg:flex items-center">
          <h1 className="text-foreground font-black text-base lg:text-lg tracking-tight">
            {currentLabel}
          </h1>
        </div>
      </div>

      {/* Center: Mobile Centered Page Title */}
      <div className="flex lg:hidden flex-1 items-center justify-center min-w-0 px-2 text-center">
        <span className="text-xs sm:text-sm font-extrabold text-foreground truncate tracking-tight">
          {currentLabel}
        </span>
      </div>

      {/* Right: Search, Language Switcher, and Desktop Quick Add */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Language Switcher */}
        <LanguageSwitcher size="sm" />

        {/* Mobile Search Icon Button (Min touch target 44px) */}
        <button
          onClick={toggleCommandPalette}
          className="flex lg:hidden h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/40 active:scale-95 transition-all shadow-2xs cursor-pointer touch-manipulation"
          aria-label={t.topbar.searchPlaceholder}
        >
          <GeometricIcon name="search" size="xs" active />
        </button>

        {/* Desktop Full Search Bar */}
        <button
          onClick={toggleCommandPalette}
          className="hidden lg:flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-muted/50 w-44 lg:w-60 focus:outline-none focus:ring-2 focus:ring-primary/20 active:scale-98 shadow-2xs cursor-pointer"
          aria-label={t.topbar.searchPlaceholder}
        >
          <GeometricIcon name="search" size="xs" active />
          <span className="truncate">{t.topbar.searchPlaceholder}</span>
          <kbd className="ml-auto rounded-sm border border-border/80 bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>
    </header>
  );
}
