/* Geometric Minimalist Intelligence · Sidebar · Fin.IQ */
"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  ChevronsUpDown,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeometricIcon, type GeometricIconName } from "@/components/ui/GeometricIcon";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import {
  MAIN_NAVIGATION_ITEMS,
  SECONDARY_NAVIGATION_ITEMS,
  NavItem,
} from "@/config/navigation";
import { useTranslation } from "@/i18n";

const navigationItems = MAIN_NAVIGATION_ITEMS;
const secondaryItems = SECONDARY_NAVIGATION_ITEMS;

function NavItemLink({
  item,
  displayLabel,
  isActive,
  onItemClick,
  className,
}: {
  item: NavItem;
  displayLabel?: string;
  isActive: boolean;
  onItemClick?: () => void;
  className?: string;
}) {
  const isSmallIcon = item.iconName === "settings";

  return (
    <Link
      href={item.href}
      onClick={onItemClick}
      {...(item.isAI ? { "data-tour": "ai-studio" } : {})}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-all group select-none min-h-[36px]",
        isActive
          ? "bg-primary/10 text-primary font-semibold shadow-2xs"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground active:scale-[0.98]",
        className
      )}
    >
      <GeometricIcon
        name={item.iconName}
        size={isSmallIcon ? "xs" : "sm"}
        active={isActive}
        className={cn(
          "transition-transform shrink-0",
          isActive ? "scale-105" : "opacity-75 group-hover:opacity-100"
        )}
      />
      <span className="truncate flex-1">{displayLabel || item.label}</span>
      {item.isAI && (
        <span
          className={cn(
            "text-[9px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 transition-colors",
            isActive
              ? "bg-primary text-primary-foreground font-bold"
              : "bg-muted text-muted-foreground"
          )}
        >
          AI
        </span>
      )}
    </Link>
  );
}

export function Sidebar({
  isMobile = false,
  onItemClick,
}: {
  isMobile?: boolean;
  onItemClick?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { t, locale } = useTranslation();
  const isEn = locale === "en";
  const [mounted, setMounted] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const getNavLabel = (href: string, fallback: string) => {
    switch (href) {
      case "/overview": return t.nav.overview;
      case "/transactions": return t.nav.transactions;
      case "/ai": return t.nav.aiAdvisor;
      case "/import": return t.nav.importData;
      case "/analytics": return t.nav.analytics;
      case "/calendar": return t.nav.calendar;
      case "/accounts": return t.nav.accounts;
      case "/categories": return t.nav.categories;
      case "/budgets": return t.nav.budgets;
      case "/ledgers": return t.nav.ledgers;
      case "/annual-report": return t.nav.annualReport;
      case "/settings": return t.nav.settings;
      default: return fallback;
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: profile } = trpc.user.getProfile.useQuery();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

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
      sessionStorage.removeItem("finiq_demo_session_welcomed");
      sessionStorage.removeItem("finiq_demo_tour_trigger");
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
          : "hidden lg:flex w-64 h-screen sticky top-0 border-r border-border/80 bg-card/90 backdrop-blur-md px-3.5 py-4 z-20 shadow-level-1"
      )}
    >
      {/* =====================================================================
          1. BRAND LOGO (Fin.IQ Official Mascot Brand)
      ===================================================================== */}
      <div className="flex items-center justify-between px-1 pb-3 mb-2.5 border-b border-border/60 shrink-0">
        <Link
          href="/overview"
          onClick={() => onItemClick?.()}
          className="flex items-center gap-2.5 group active:scale-95 transition-all"
        >
          <div className="relative h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-amber-500/10 dark:from-emerald-950/60 dark:to-emerald-900/30 border border-emerald-500/30 group-hover:border-emerald-500/60 shadow-2xs group-hover:scale-105 transition-all overflow-hidden p-0.5">
            <Image
              src="/mascot/mascot-logo.png"
              alt="Fin.IQ Official Mascot Logo"
              width={40}
              height={40}
              className="object-contain drop-shadow-2xs"
              priority
              unoptimized
            />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-base tracking-tight text-foreground flex items-center leading-none">
              Fin<span className="text-primary">.IQ</span>
            </span>
            <span className="text-[10px] text-muted-foreground font-medium mt-1 tracking-tight">
              Personal Finance AI
            </span>
          </div>
        </Link>
      </div>

      {/* =====================================================================
          2. USER ACCOUNT
      ===================================================================== */}
      <div className="relative mb-3 shrink-0" ref={profileMenuRef}>
        <button
          type="button"
          onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
          className={cn(
            "w-full flex items-center justify-between p-2 rounded-md border transition-all text-left outline-none group",
            isProfileMenuOpen
              ? "bg-muted border-primary/50 ring-2 ring-primary/20"
              : "bg-background/80 hover:bg-muted/70 border-border hover:border-border/90"
          )}
          aria-label={isEn ? "User Profile Menu" : "Menu Profil Pengguna"}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground text-xs font-black shrink-0 border border-emerald-300 dark:border-emerald-800 shadow-2xs group-hover:scale-105 transition-transform">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                {profile?.displayName || (isEn ? "Fin.IQ User" : "Pengguna Fin.IQ")}
              </p>
              <p className="text-[10px] text-muted-foreground truncate font-mono">
                {profile?.email || "owner@finiq.app"}
              </p>
            </div>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1 group-hover:text-foreground transition-colors" />
        </button>

        {/* Dropdown Menu */}
        {isProfileMenuOpen && (
          <div className="absolute top-full left-0 right-0 mt-1.5 rounded-md border border-border bg-card p-1.5 text-xs shadow-level-2 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150 z-50">
            <div className="px-2.5 py-2 border-b border-border/70">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-secondary text-secondary-foreground">
                {isEn ? "Active Account" : "Akun Aktif"}
              </span>
              <p className="font-bold text-foreground truncate text-sm mt-1">
                {profile?.displayName || (isEn ? "Fin.IQ User" : "Pengguna Fin.IQ")}
              </p>
              <p className="text-[11px] text-muted-foreground truncate font-mono">
                {profile?.email || "owner@finiq.app"}
              </p>
            </div>

            <div className="py-1 space-y-0.5">
              <Link
                href="/settings"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onItemClick?.();
                }}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors font-medium"
              >
                <GeometricIcon name="settings" size="xs" active />
                <span>{t.nav.settings}</span>
              </Link>
            </div>

            <div className="pt-1 border-t border-border/70">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors font-semibold"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{t.nav.logout}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          2. NAVIGATION SECTION (Pure Geometric Duotone Iconography)
      ===================================================================== */}
      <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-3 scrollbar-none">
        {/* Menu Utama */}
        <nav data-tour="sidebar-nav" className="flex flex-col gap-0.5">
          <p className="px-2.5 text-[11px] font-semibold text-muted-foreground/70 mb-1">
            {t.nav.mainMenu}
          </p>
          {navigationItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/overview" && pathname?.startsWith(item.href));

            return (
              <NavItemLink
                key={item.href}
                item={item}
                displayLabel={getNavLabel(item.href, item.label)}
                isActive={isActive}
                onItemClick={onItemClick}
              />
            );
          })}
        </nav>

        {/* Preferensi */}
        <div className="pt-2 border-t border-border/60">
          <p className="px-2.5 text-[11px] font-semibold text-muted-foreground/70 mb-1">
            {t.nav.preferences}
          </p>
          <div className="flex flex-col gap-0.5">
            {secondaryItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <NavItemLink
                  key={item.href}
                  item={item}
                  displayLabel={getNavLabel(item.href, item.label)}
                  isActive={isActive}
                  onItemClick={onItemClick}
                  className="py-1.5"
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* =====================================================================
          3. FOOTER SECTION (Mode Terang / Mode Gelap di bagian bawah)
      ===================================================================== */}
      {mounted && (
        <div className="pt-2.5 mt-auto border-t border-border/60 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="w-full justify-start gap-2.5 h-8.5 rounded-md text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-amber-400 shrink-0" />
            ) : (
              <Moon className="h-4 w-4 text-slate-700 shrink-0" />
            )}
            <span>{theme === "dark" ? t.nav.lightMode : t.nav.darkMode}</span>
          </Button>
        </div>
      )}
    </aside>
  );
}
