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
}

export function AccountSelect({
  accounts,
  value,
  onChange,
  placeholder = "Pilih Akun...",
  className,
  disabled = false,
}: AccountSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const selectedAcc = useMemo(() => {
    return accounts.find((a) => a.id === value);
  }, [accounts, value]);

  const filteredAccounts = useMemo(() => {
    if (!search.trim()) return accounts;
    const q = search.toLowerCase();
    return accounts.filter((a) => a.name.toLowerCase().includes(q));
  }, [accounts, search]);

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
          "flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background/80 px-3 py-2 text-xs font-medium shadow-2xs transition-all",
          "hover:border-primary/50 hover:bg-muted/40 focus:outline-none focus:ring-1 focus:ring-ring",
          isOpen && "border-primary ring-1 ring-primary/30 bg-muted/30",
          disabled && "opacity-50 cursor-not-allowed",
          !selectedAcc && "text-muted-foreground"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border",
              selectedAcc
                ? "bg-primary/10 border-primary/20 text-primary"
                : "bg-muted border-border text-muted-foreground"
            )}
          >
            {selectedAcc ? getAccountIcon(selectedAcc.name) : <CreditCard className="h-3 w-3" />}
          </div>

          <div className="flex flex-col min-w-0 text-left">
            <span className="truncate text-xs text-foreground font-semibold">
              {selectedAcc ? selectedAcc.name.toUpperCase() : placeholder}
            </span>
            {selectedAcc && (
              <span className="text-[10px] text-muted-foreground font-mono">
                Rp {(selectedAcc.balance ?? 0).toLocaleString("id-ID")}
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 shrink-0 ml-1",
            isOpen && "rotate-180 text-primary"
          )}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[260px] rounded-2xl border border-border/80 bg-card p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-1.5 text-card-foreground">
          {/* Search if more than 4 accounts */}
          {accounts.length > 4 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari akun..."
                className="h-8 w-full rounded-lg bg-muted/60 pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary border border-border/60"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* List Accounts */}
          <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
            {filteredAccounts.length > 0 ? (
              filteredAccounts.map((acc) => {
                const isSelected = value === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      onChange(acc.id);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-colors group",
                      isSelected
                        ? "bg-primary/10 text-primary font-bold"
                        : "text-foreground font-medium hover:bg-muted/80"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border",
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
              <div className="py-3 text-center text-xs text-muted-foreground">
                Akun tidak ditemukan.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
