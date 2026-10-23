"use client";

import React, { useEffect, useState } from "react";
import { useTranslation, SupportedLocale } from "@/i18n";
import { cn } from "@/lib/utils";
import { Globe } from "lucide-react";

interface LanguageSwitcherProps {
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md";
}

export function LanguageSwitcher({
  className,
  showIcon = true,
  size = "sm",
}: LanguageSwitcherProps) {
  const { locale, setLocale } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch on initial render
  if (!mounted) {
    return (
      <div
        className={cn(
          "inline-flex items-center rounded-md border border-border/80 bg-background/80 p-0.5 opacity-60",
          size === "sm" ? "h-8" : "h-9",
          className
        )}
      >
        <span className="px-2 text-xs font-semibold text-muted-foreground">ID</span>
        <span className="px-2 text-xs font-semibold text-muted-foreground">EN</span>
      </div>
    );
  }

  const handleSelect = (target: SupportedLocale) => {
    if (locale !== target) {
      setLocale(target);
    }
  };

  return (
    <div
      role="group"
      aria-label="Pilih Bahasa / Language Selector"
      className={cn(
        "inline-flex items-center rounded-md border border-border/80 bg-muted/40 p-0.5 transition-colors shadow-2xs select-none",
        size === "sm" ? "h-8 gap-0.5" : "h-9 gap-1",
        className
      )}
    >
      {showIcon && (
        <div className="flex items-center pl-1.5 pr-0.5 text-muted-foreground/80">
          <Globe className="h-3.5 w-3.5 stroke-[2px]" aria-hidden="true" />
        </div>
      )}

      {/* ID Option */}
      <button
        type="button"
        onClick={() => handleSelect("id")}
        aria-pressed={locale === "id"}
        className={cn(
          "relative flex items-center justify-center rounded-xs font-bold transition-all text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-95",
          size === "sm" ? "h-6.5 px-2 text-[11px]" : "h-7 px-2.5 text-xs",
          locale === "id"
            ? "bg-card text-foreground font-black shadow-xs border border-border/70"
            : "text-muted-foreground hover:text-foreground hover:bg-background/50"
        )}
      >
        <span>ID</span>
      </button>

      {/* EN Option */}
      <button
        type="button"
        onClick={() => handleSelect("en")}
        aria-pressed={locale === "en"}
        className={cn(
          "relative flex items-center justify-center rounded-xs font-bold transition-all text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-95",
          size === "sm" ? "h-6.5 px-2 text-[11px]" : "h-7 px-2.5 text-xs",
          locale === "en"
            ? "bg-card text-foreground font-black shadow-xs border border-border/70"
            : "text-muted-foreground hover:text-foreground hover:bg-background/50"
        )}
      >
        <span>EN</span>
      </button>
    </div>
  );
}
