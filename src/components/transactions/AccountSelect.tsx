"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Wallet,
  CreditCard,
  ChevronDown,
  Check,
  Search,
  X,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AccountOption {
  id: string;
  name: string;
  balance?: number;
  group?: string | null;
  [key: string]: any;
}

export interface AccountSelectProps {
  accounts: AccountOption[];
  value?: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  align?: "left" | "right" | "auto";
}

export function AccountSelect({
  accounts,
  value,
  onChange,
  placeholder = "Pilih Akun...",
  className,
  disabled = false,
  align = "auto",
}: AccountSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [openUpward, setOpenUpward] = useState(false);
  const [openRightAligned, setOpenRightAligned] = useState(false);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.stopPropagation();
        e.preventDefault();
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        setOpenUpward(spaceBelow < 310 && spaceAbove > spaceBelow);

        if (align === "right") {
          setOpenRightAligned(true);
        } else if (align === "left") {
          setOpenRightAligned(false);
        } else {
          const spaceRight = window.innerWidth - rect.left;
          setOpenRightAligned(spaceRight < 320 || rect.right > window.innerWidth - 80);
        }
      }
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, align]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen && accounts.length > 4) {
      setHighlightedIndex(0);
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, accounts.length]);

  const selectedAcc = useMemo(() => {
    return accounts.find((a) => a.id === value);
  }, [accounts, value]);

  const filteredAccounts = useMemo(() => {
    if (!search.trim()) return accounts;
    const q = search.trim().toLowerCase();
    return accounts
      .filter((a) => a.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aLower = a.name.toLowerCase();
        const bLower = b.name.toLowerCase();
        if (aLower === q && bLower !== q) return -1;
        if (bLower === q && aLower !== q) return 1;
        if (aLower.startsWith(q) && !bLower.startsWith(q)) return -1;
        if (bLower.startsWith(q) && !aLower.startsWith(q)) return 1;
        return 0;
      });
  }, [accounts, search]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearch("");
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Prevent parent form submission
      e.preventDefault();
      e.stopPropagation();

      if (filteredAccounts.length > 0) {
        const target = filteredAccounts[highlightedIndex] || filteredAccounts[0];
        if (target) {
          handleSelect(target.id);
        }
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      if (filteredAccounts.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % filteredAccounts.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      if (filteredAccounts.length > 0) {
        setHighlightedIndex((prev) => (prev - 1 + filteredAccounts.length) % filteredAccounts.length);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
    }
  };

  const getAccountIcon = (accName: string) => {
    const lower = accName.toLowerCase();
    if (lower.includes("cash") || lower.includes("kas") || lower.includes("tunai") || lower.includes("dompet")) {
      return <Wallet className="h-3 w-3" />;
    }
    if (lower.includes("bca") || lower.includes("mandiri") || lower.includes("bri") || lower.includes("bni") || lower.includes("bank")) {
      return <Building2 className="h-3 w-3" />;
    }
    return <CreditCard className="h-3 w-3" />;
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-lg border border-input/80 bg-background/80 px-3 py-1.5 text-xs font-medium shadow-2xs transition-all",
          "hover:border-primary/50 hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary active:scale-[0.99]",
          isOpen && "border-primary ring-2 ring-primary/20 bg-muted/30",
          disabled && "opacity-50 cursor-not-allowed",
          !selectedAcc && "text-muted-foreground"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors",
              selectedAcc
                ? "bg-primary/10 border-primary/20 text-primary"
                : "bg-muted border-border text-muted-foreground"
            )}
          >
            {selectedAcc ? getAccountIcon(selectedAcc.name) : <CreditCard className="h-3.5 w-3.5" />}
          </div>

          <div className="flex flex-col min-w-0 text-left justify-center">
            <span className="truncate text-xs text-foreground font-semibold leading-tight">
              {selectedAcc ? selectedAcc.name : placeholder}
            </span>
            {selectedAcc ? (
              <span className="text-[10px] text-muted-foreground font-mono leading-none mt-0.5 tabular-nums">
                Rp {(selectedAcc.balance ?? 0).toLocaleString("id-ID")}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground/60 leading-none mt-0.5">
                Pilih sumber dana
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 shrink-0 ml-1.5",
            isOpen && "rotate-180 text-primary"
          )}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          className={cn(
            "absolute z-50 rounded-md border border-border bg-card p-2.5 shadow-level-2 animate-in fade-in zoom-in-95 duration-140 flex flex-col gap-2 text-card-foreground font-sans",
            "w-full min-w-[260px] sm:min-w-[300px] max-w-[calc(100vw-2rem)]",
            openRightAligned
              ? "right-0 left-auto origin-top-right"
              : "left-0 right-auto origin-top-left",
            openUpward
              ? "bottom-full mb-2 origin-bottom"
              : "top-full mt-2 origin-top"
          )}
        >
          {/* Search if more than 4 accounts */}
          {accounts.length > 4 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Cari nama akun..."
                className="h-8.5 w-full rounded-md bg-muted/40 pl-8.5 pr-8 text-xs font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary border border-border"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
                  title="Hapus pencarian"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* List Accounts dengan Scroller */}
          <div
            className="max-h-64 sm:max-h-72 overflow-y-auto overscroll-contain space-y-1 pr-1.5 pt-0.5 scroll-smooth
              [&::-webkit-scrollbar]:w-2
              [&::-webkit-scrollbar-track]:bg-muted/40
              [&::-webkit-scrollbar-track]:rounded-full
              [&::-webkit-scrollbar-thumb]:bg-muted-foreground/35
              [&::-webkit-scrollbar-thumb]:rounded-full
              hover:[&::-webkit-scrollbar-thumb]:bg-primary/70
              transition-colors"
          >
            {filteredAccounts.length > 0 ? (
              filteredAccounts.map((acc, idx) => {
                const isSelected = value === acc.id;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleSelect(acc.id)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-all group cursor-pointer",
                      isSelected
                        ? "bg-primary/15 text-primary font-bold border border-primary/25 shadow-xs"
                        : isHighlighted
                        ? "bg-muted text-foreground border border-border/60"
                        : "text-foreground font-medium hover:bg-muted/80 border border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/80 border-border text-muted-foreground group-hover:text-primary transition-colors"
                        )}
                      >
                        {getAccountIcon(acc.name)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-semibold">{acc.name.toUpperCase()}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Rp {(acc.balance ?? 0).toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                  </button>
                );
              })
            ) : (
              <div className="py-4 text-center text-xs text-muted-foreground">
                Akun &quot;{search}&quot; tidak ditemukan.
              </div>
            )}
          </div>

          {/* Bottom helper */}
          <div className="pt-1.5 border-t border-border/50 px-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{accounts.length} akun terdaftar</span>
            <span>Tekan Esc untuk tutup</span>
          </div>
        </div>
      )}
    </div>
  );
}
