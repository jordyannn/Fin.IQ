/* Geometric Minimalist Intelligence · GeometricIcon · Fin.IQ */
"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type GeometricIconName =
  | "overview"
  | "transactions"
  | "ai"
  | "import"
  | "analytics"
  | "calendar"
  | "accounts"
  | "categories"
  | "budgets"
  | "ledgers"
  | "annual-report"
  | "settings"
  | "integrity"
  | "user"
  | "search"
  | "plus"
  | "trend-up"
  | "trend-down"
  | "wallet"
  | "bank"
  | "sparkles"
  | "check";

interface GeometricIconProps extends React.SVGAttributes<SVGSVGElement> {
  name: GeometricIconName;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  active?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: 16,
  sm: 18,
  md: 20,
  lg: 24,
  xl: 32,
};

export function GeometricIcon({
  name,
  size = "md",
  active = true,
  className,
  ...props
}: GeometricIconProps) {
  const px = SIZE_MAP[size] || 20;

  const primaryColor = active ? "#059669" : "currentColor";
  const secondaryColor = active ? "#A7F3D0" : "currentColor";
  const secondaryOpacity = active ? 0.95 : 0.35;
  const accentColor = active ? "#064E3B" : "currentColor";

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none", className)}
      aria-hidden="true"
      {...props}
    >
      {/* 1. OVERVIEW: Compact 4-quadrant dashboard grid */}
      {name === "overview" && (
        <>
          <rect x="3" y="3" width="7.5" height="10" rx="1.5" fill={primaryColor} />
          <rect x="13.5" y="3" width="7.5" height="5" rx="1.5" fill={secondaryColor} fillOpacity={secondaryOpacity} />
          <rect x="13.5" y="11" width="7.5" height="10" rx="1.5" fill={primaryColor} />
          <rect x="3" y="16" width="7.5" height="5" rx="1.5" fill={secondaryColor} fillOpacity={secondaryOpacity} />
        </>
      )}

      {/* 2. TRANSACTIONS: Process arrows of transfer / cashflow exchange */}
      {name === "transactions" && (
        <>
          {/* Top outgoing right arrow */}
          <rect x="3" y="6" width="11" height="2.5" rx="0.75" fill={secondaryColor} fillOpacity={secondaryOpacity} />
          <path d="M13 4L17 7.25L13 10.5V4Z" fill={secondaryColor} fillOpacity={secondaryOpacity} />
          {/* Bottom incoming left arrow */}
          <rect x="10" y="15" width="11" height="2.5" rx="0.75" fill={primaryColor} />
          <path d="M11 12.75L7 16.25L11 19.75V12.75Z" fill={primaryColor} />
        </>
      )}

      {/* 3. AI STUDIO: Crisp geometric star with neural spark cores */}
      {name === "ai" && (
        <>
          <path
            d="M12 2.5L14.2 9.8L21.5 12L14.2 14.2L12 21.5L9.8 14.2L2.5 12L9.8 9.8L12 2.5Z"
            fill={primaryColor}
          />
          <rect x="10.5" y="10.5" width="3" height="3" rx="0.5" fill={secondaryColor} />
          <rect x="17.5" y="4.5" width="2" height="2" rx="0.5" fill={secondaryColor} fillOpacity={secondaryOpacity} />
        </>
      )}

      {/* 4. IMPORT: Process file sheet with downward intake arrow */}
      {name === "import" && (
        <>
          {/* Tray / File container */}
          <path d="M4 14V19C4 19.55 4.45 20 5 20H19C19.55 20 20 19.55 20 19V14" stroke={secondaryColor} strokeWidth="2.2" strokeLinecap="square" />
          {/* Central download arrow */}
          <rect x="10.75" y="3" width="2.5" height="9" rx="0.75" fill={primaryColor} />
          <path d="M7.5 9.5L12 14.5L16.5 9.5H7.5Z" fill={primaryColor} />
        </>
      )}

      {/* 5. ANALYTICS: 3 crisp ascending bar pillars with baseline */}
      {name === "analytics" && (
        <>
          <rect x="3" y="13" width="4" height="7" rx="1" fill={secondaryColor} fillOpacity={secondaryOpacity} />
          <rect x="10" y="8" width="4" height="12" rx="1" fill={secondaryColor} fillOpacity={secondaryOpacity} />
          <rect x="17" y="3" width="4" height="17" rx="1" fill={primaryColor} />
          <rect x="2" y="20.5" width="20" height="1.5" rx="0.75" fill={accentColor} />
        </>
      )}

      {/* 6. CALENDAR: Boxy calendar sheet with date grid */}
      {name === "calendar" && (
        <>
          <rect x="3" y="4" width="18" height="17" rx="2" stroke={primaryColor} strokeWidth="2" fill="none" />
          <rect x="3" y="4" width="18" height="5" fill={primaryColor} />
          <rect x="7" y="2" width="2" height="3" rx="0.5" fill={secondaryColor} />
          <rect x="15" y="2" width="2" height="3" rx="0.5" fill={secondaryColor} />
          <rect x="6.5" y="12" width="2.5" height="2" rx="0.5" fill={secondaryColor} fillOpacity={secondaryOpacity} />
          <rect x="11" y="12" width="2.5" height="2" rx="0.5" fill={primaryColor} />
          <rect x="15.5" y="12" width="2.5" height="2" rx="0.5" fill={secondaryColor} fillOpacity={secondaryOpacity} />
          <rect x="6.5" y="16" width="2.5" height="2" rx="0.5" fill={primaryColor} />
          <rect x="11" y="16" width="2.5" height="2" rx="0.5" fill={secondaryColor} fillOpacity={secondaryOpacity} />
        </>
      )}

      {/* 7. ACCOUNTS / WALLET: Boxy card with EMV chip */}
      {(name === "accounts" || name === "wallet") && (
        <>
          <rect x="2.5" y="5" width="19" height="14" rx="2" fill={primaryColor} />
          <rect x="2.5" y="8.5" width="19" height="2.5" fill={accentColor} />
          <rect x="5.5" y="13.5" width="4.5" height="3" rx="0.75" fill={secondaryColor} fillOpacity={secondaryOpacity} />
          <rect x="15" y="14" width="4" height="2" rx="0.5" fill="#FFFFFF" fillOpacity={0.8} />
        </>
      )}

      {/* 8. CATEGORIES: Boxy faceted price tag with string hole */}
      {name === "categories" && (
        <>
          <path
            d="M3 4C3 3.45 3.45 3 4 3H11.5L21 12.5L12.5 21L3 11.5V4Z"
            fill={primaryColor}
          />
          <circle cx="7" cy="7" r="1.75" fill={secondaryColor} />
          <rect x="11" y="12" width="4" height="4" rx="0.5" fill={secondaryColor} fillOpacity={secondaryOpacity} />
        </>
      )}

      {/* 9. BUDGETS: Target meter and cash allocation box */}
      {name === "budgets" && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" stroke={primaryColor} strokeWidth="2" fill="none" />
          <rect x="6" y="14" width="12" height="4" rx="1" fill={primaryColor} />
          <rect x="6" y="9" width="7" height="3" rx="0.75" fill={secondaryColor} fillOpacity={secondaryOpacity} />
          <rect x="15" y="9" width="3" height="3" rx="0.5" fill={accentColor} />
        </>
      )}

      {/* 10. LEDGERS: Dual-leaf open accounting ledger with ruled entries */}
      {name === "ledgers" && (
        <>
          <rect x="3" y="4" width="8.5" height="16" rx="1" fill={secondaryColor} fillOpacity={secondaryOpacity} />
          <rect x="12.5" y="4" width="8.5" height="16" rx="1" fill={primaryColor} />
          {/* Ruled lines */}
          <rect x="5" y="7" width="4.5" height="1.5" rx="0.5" fill={accentColor} />
          <rect x="5" y="10.5" width="4.5" height="1.5" rx="0.5" fill={accentColor} />
          <rect x="14.5" y="7" width="4.5" height="1.5" rx="0.5" fill="#FFFFFF" fillOpacity={0.8} />
          <rect x="14.5" y="10.5" width="4.5" height="1.5" rx="0.5" fill="#FFFFFF" fillOpacity={0.8} />
          <rect x="14.5" y="14" width="4.5" height="1.5" rx="0.5" fill="#FFFFFF" fillOpacity={0.8} />
        </>
      )}

      {/* 11. ANNUAL REPORT: Annual document with upward growth chevron */}
      {name === "annual-report" && (
        <>
          <rect x="3.5" y="3" width="17" height="18" rx="2" fill={secondaryColor} fillOpacity={secondaryOpacity} />
          <path d="M7 16L11 11L14 14L17 8" stroke={primaryColor} strokeWidth="2.2" strokeLinecap="square" />
          <path d="M14 8H17V11" stroke={primaryColor} strokeWidth="2.2" strokeLinecap="square" />
        </>
      )}

      {/* 12. SETTINGS: Precision mechanical cog and slider controls */}
      {name === "settings" && (
        <>
          <rect x="3" y="7" width="18" height="2" rx="0.75" fill={secondaryColor} fillOpacity={secondaryOpacity} />
          <rect x="7" y="5" width="3" height="6" rx="1" fill={primaryColor} />
          <rect x="3" y="15" width="18" height="2" rx="0.75" fill={secondaryColor} fillOpacity={secondaryOpacity} />
          <rect x="14" y="13" width="3" height="6" rx="1" fill={primaryColor} />
        </>
      )}

      {/* 13. INTEGRITY: Shield with crisp geometric verification check */}
      {name === "integrity" && (
        <>
          <path
            d="M12 2.5L20 5.5V11C20 16 16.5 20 12 21.5C7.5 20 4 16 4 11V5.5L12 2.5Z"
            fill={primaryColor}
          />
          <path
            d="M8.5 11.5L10.5 14L15.5 8.5"
            stroke={secondaryColor}
            strokeWidth="2.4"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </>
      )}

      {/* 14. USER: Boxy minimalist profile avatar */}
      {name === "user" && (
        <>
          <rect x="8" y="3" width="8" height="8" rx="2" fill={primaryColor} />
          <path d="M4 19C4 16 7 14 12 14C17 14 20 16 20 19V21H4V19Z" fill={secondaryColor} fillOpacity={secondaryOpacity} />
        </>
      )}

      {/* 15. SEARCH: Precision geometric magnifying lens */}
      {name === "search" && (
        <>
          <rect x="3.5" y="3.5" width="11" height="11" rx="2.5" stroke={primaryColor} strokeWidth="2.5" fill="none" />
          <rect
            x="13"
            y="13"
            width="3"
            height="8"
            rx="1"
            transform="rotate(-45 13 13)"
            fill={secondaryColor}
            fillOpacity={secondaryOpacity}
          />
        </>
      )}

      {/* 16. PLUS: Crisp geometric square plus button */}
      {name === "plus" && (
        <>
          <rect x="10.75" y="4" width="2.5" height="16" rx="0.75" fill="currentColor" />
          <rect x="4" y="10.75" width="16" height="2.5" rx="0.75" fill="currentColor" />
        </>
      )}

      {/* 17. TREND UP: Compact boxy container with sharp upward arrow */}
      {name === "trend-up" && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" fill={secondaryColor} fillOpacity={secondaryOpacity} />
          <path d="M7 15L15 7M15 7H9.5M15 7V12.5" stroke={primaryColor} strokeWidth="2.2" strokeLinecap="square" />
        </>
      )}

      {/* 18. TREND DOWN: Compact boxy container with sharp downward arrow */}
      {name === "trend-down" && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" fill="#FEE2E2" />
          <path d="M7 9L15 17M15 17H9.5M15 17V11.5" stroke="#BA1A1A" strokeWidth="2.2" strokeLinecap="square" />
        </>
      )}

      {/* 19. BANK: Classical architectural facade with square pillars */}
      {name === "bank" && (
        <>
          <path d="M12 3L3 8H21L12 3Z" fill={primaryColor} />
          <rect x="5" y="10" width="2.5" height="7" rx="0.5" fill={secondaryColor} fillOpacity={secondaryOpacity} />
          <rect x="10.75" y="10" width="2.5" height="7" rx="0.5" fill={secondaryColor} fillOpacity={secondaryOpacity} />
          <rect x="16.5" y="10" width="2.5" height="7" rx="0.5" fill={secondaryColor} fillOpacity={secondaryOpacity} />
          <rect x="3" y="18.5" width="18" height="2.5" rx="0.5" fill={primaryColor} />
        </>
      )}

      {/* 20. SPARKLES: 4-point geometric star */}
      {name === "sparkles" && (
        <>
          <path d="M12 3L13.8 8.5L19 10.5L13.8 12.5L12 18L10.2 12.5L5 10.5L10.2 8.5L12 3Z" fill={primaryColor} />
          <rect x="16.5" y="4.5" width="2" height="2" rx="0.5" fill={secondaryColor} fillOpacity={secondaryOpacity} />
        </>
      )}

      {/* 21. CHECK: Geometric boxy checkmark */}
      {name === "check" && (
        <>
          <path
            d="M5 12L9.5 16.5L19 7"
            stroke={primaryColor}
            strokeWidth="2.5"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </>
      )}
    </svg>
  );
}
