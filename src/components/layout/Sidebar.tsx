/* Geometric Minimalist Intelligence · Sidebar · Fin.IQ */
"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
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

interface Ripple {
  x: number;
  y: number;
  size: number;
  id: number;
}

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
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = Math.max(rect.width, rect.height) * 2.2;
    const id = Date.now() + Math.random();
    setRipples((prev) => [...prev.slice(-2), { x, y, size, id }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 600);
    onItemClick?.();
  };

  const isSmallIcon = item.iconName === "settings" || item.iconName === "integrity";

  return (
    <Link
      href={item.href}
      onClick={handleClick}
      {...(item.isAI ? { "data-tour": "ai-studio" } : {})}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative overflow-hidden flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-all group select-none",
        isActive
          ? "border-l-[3px] border-primary bg-emerald-500/12 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 font-bold shadow-2xs pl-2"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground active:scale-[0.98]",
        className
      )}
    >
      <GeometricIcon
        name={item.iconName}
        size={isSmallIcon ? "xs" : "sm"}
        active={isActive}
        className={cn(
          "transition-transform shrink-0",
          isActive ? "scale-105" : "opacity-70 group-hover:opacity-100"
        )}
      />
      <span className="truncate flex-1 font-medium">{displayLabel || item.label}</span>
      {item.isAI && (
        <span
          className={cn(
            "text-[9px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider shrink-0",
            isActive
              ? "bg-primary text-primary-foreground shadow-2xs"
              : "bg-secondary text-secondary-foreground"
          )}
        >
          AI
        </span>
      )}
      {ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 animate-button-click-ripple select-none"
          style={{
            left: r.x,
            top: r.y,
            width: r.size,
            height: r.size,
          }}
        />
      ))}
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
  const { t } = useTranslation();
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
      case "/integrity": return t.nav.integrity;
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
          1. USER ACCOUNT (Satu-satunya komponen di bagian atas sidebar)
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
          aria-label="Menu Profil Pengguna"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground text-xs font-black shrink-0 border border-emerald-300 dark:border-emerald-800 shadow-2xs group-hover:scale-105 transition-transform">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                {profile?.displayName || "Pengguna Fin.IQ"}
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
                Akun Aktif
              </span>
              <p className="font-bold text-foreground truncate text-sm mt-1">
                {profile?.displayName || "Pengguna Fin.IQ"}
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

              <Link
                href="/integrity"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onItemClick?.();
                }}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors font-medium"
              >
                <GeometricIcon name="integrity" size="xs" active />
                <span>{t.nav.integrity}</span>
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
          <p className="px-2 text-[10px] font-bold tracking-wider text-muted-foreground/80 uppercase mb-0.5">
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
          <p className="px-2 text-[10px] font-bold tracking-wider text-muted-foreground/80 uppercase mb-0.5">
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
