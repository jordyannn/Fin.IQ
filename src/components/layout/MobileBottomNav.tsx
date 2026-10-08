"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Plus,
  Wallet,
  Menu,
} from "lucide-react";
import { useUIStore } from "@/store/ui.store";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { openQuickAdd, toggleSidebar } = useUIStore();

  const leftItems = [
    { label: "Home", href: "/overview", icon: LayoutDashboard },
    { label: "Transaksi", href: "/transactions", icon: Receipt },
  ];

  const rightItems = [
    { label: "Akun", href: "/accounts", icon: Wallet },
  ];

  const isMenuRoutes = ![
    "/overview",
    "/transactions",
    "/accounts",
  ].some((r) => pathname === r || pathname?.startsWith(r));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 w-full items-center justify-around border-t border-border/60 bg-card/95 px-3 backdrop-blur-xl lg:hidden shadow-lg shadow-black/5">
      {/* 2 Item Kiri */}
      {leftItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== "/overview" && pathname?.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors w-14 active:scale-95",
              isActive
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <Icon className={cn("h-5 w-5 transition-transform", isActive && "stroke-[2.5px] scale-105")} />
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
              )}
            </div>
            <span>{item.label}</span>
          </Link>
        );
      })}

      {/* Floating Center Action Button (Quick Add) */}
      <div className="relative -top-5 flex items-center justify-center">
        <button
          onClick={openQuickAdd}
          className="flex h-13 w-13 p-3 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/35 transition-transform active:scale-90 border-4 border-background"
          aria-label="Catat Transaksi Cepat"
        >
          <Plus className="h-6 w-6 stroke-[3px]" />
        </button>
      </div>

      {/* Item Kanan (Akun) */}
      {rightItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors w-14 active:scale-95",
              isActive
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <Icon className={cn("h-5 w-5 transition-transform", isActive && "stroke-[2.5px] scale-105")} />
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
              )}
            </div>
            <span>{item.label}</span>
          </Link>
        );
      })}

      {/* Tombol Menu / Laci Seluler */}
      <button
        onClick={toggleSidebar}
        className={cn(
          "flex flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors w-14 active:scale-95",
          isMenuRoutes
            ? "text-primary font-bold"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Menu Lengkap"
      >
        <div className="relative">
          <Menu className={cn("h-5 w-5", isMenuRoutes && "stroke-[2.5px] scale-105")} />
          {isMenuRoutes && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
          )}
        </div>
        <span>Menu</span>
      </button>
    </nav>
  );
}
