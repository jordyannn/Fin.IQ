"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Tag,
  ChevronDown,
  Check,
  Search,
  Sparkles,
  Plus,
  X,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface CategoryOption {
  id: string;
  name: string;
  kind?: string;
  parentId?: string | null;
  icon?: string | null;
  iconType?: string | null;
  [key: string]: any;
}

export interface CategorySelectProps {
  categories: CategoryOption[];
  value?: string;
  onChange: (id: string) => void;
  txType?: "expense" | "income" | "transfer";
  placeholder?: string;
  recommendedCategory?: { name: string; kind?: "expense" | "income" } | null;
  onCreateRecommended?: (name: string, kind: "expense" | "income") => void;
  className?: string;
  disabled?: boolean;
}

export function CategorySelect({
  categories,
  value,
  onChange,
  txType = "expense",
  placeholder = "Pilih Kategori...",
  recommendedCategory,
  onCreateRecommended,
  className,
  disabled = false,
}: CategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const [openUpward, setOpenUpward] = useState(false);

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

      // Check available space below to decide opening direction
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        setOpenUpward(spaceBelow < 310 && spaceAbove > spaceBelow);
      }
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Filter categories by txType if provided
  const relevantCategories = useMemo(() => {
    if (txType === "transfer") return [];
    return categories.filter((c) => !c.kind || c.kind === txType);
  }, [categories, txType]);

  // Selected category info
  const selectedCat = useMemo(() => {
    return categories.find((c) => c.id === value);
  }, [categories, value]);

  const selectedParent = useMemo(() => {
    if (!selectedCat?.parentId) return null;
    return categories.find((c) => c.id === selectedCat.parentId);
  }, [categories, selectedCat]);

  // Group into Parents and Children
  const parentCategories = useMemo(() => {
    return relevantCategories.filter((c) => !c.parentId);
  }, [relevantCategories]);

  const childCategoriesMap = useMemo(() => {
    const map = new Map<string, CategoryOption[]>();
    relevantCategories.forEach((c) => {
      if (c.parentId) {
        const existing = map.get(c.parentId) || [];
        existing.push(c);
        map.set(c.parentId, existing);
      }
    });
    return map;
  }, [relevantCategories]);

  // Filtered by search
  const filteredParents = useMemo(() => {
    if (!search.trim()) return parentCategories;
    const q = search.toLowerCase();
    return parentCategories.filter((parent) => {
      if (parent.name.toLowerCase().includes(q)) return true;
      const children = childCategoriesMap.get(parent.id) || [];
      return children.some((ch) => ch.name.toLowerCase().includes(q));
    });
  }, [parentCategories, childCategoriesMap, search]);

  const isRecommendedAlreadyInList = useMemo(() => {
    if (!recommendedCategory?.name) return true;
    const lower = recommendedCategory.name.toLowerCase().trim();
    return categories.some((c) => c.name.toLowerCase().trim() === lower);
  }, [categories, recommendedCategory]);

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
          !selectedCat && "text-muted-foreground"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border",
              selectedCat
                ? "bg-primary/10 border-primary/20 text-primary"
                : "bg-muted border-border text-muted-foreground"
            )}
          >
            <Tag className="h-3 w-3" />
          </div>

          <span className="truncate text-left text-xs text-foreground font-semibold">
            {selectedCat ? (
              selectedParent ? (
                <>
                  <span className="text-muted-foreground font-normal">{selectedParent.name} &bull; </span>
                  {selectedCat.name}
                </>
              ) : (
                selectedCat.name
              )
            ) : (
              placeholder
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {recommendedCategory && !isRecommendedAlreadyInList && !selectedCat && (
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Ada rekomendasi NLP" />
          )}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180 text-primary"
            )}
          />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          onWheel={(e) => e.stopPropagation()}
          className={cn(
            "absolute left-0 z-50 w-full min-w-[300px] rounded-md border border-border/80 bg-card/98 backdrop-blur-md p-2.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-2 text-card-foreground",
            openUpward
              ? "bottom-full mb-2 origin-bottom shadow-[-4px_-8px_24px_rgba(0,0,0,0.18)]"
              : "top-full mt-2 origin-top shadow-[4px_12px_32px_rgba(0,0,0,0.2)]"
          )}
        >
          {/* Rekomendasi NLP Banner (Pinned) */}
          {recommendedCategory && !isRecommendedAlreadyInList && onCreateRecommended && (
            <div className="p-2.5 rounded-md bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent border border-emerald-500/30 flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Rekomendasi NLP
                  </span>
                  <span className="text-xs font-bold text-foreground truncate">
                    &quot;{recommendedCategory.name}&quot;
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateRecommended(
                    recommendedCategory.name,
                    recommendedCategory.kind || (txType === "income" ? "income" : "expense")
                  );
                }}
                className="h-7 px-2.5 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
              >
                <Plus className="h-3 w-3" />
                Buat
              </button>
            </div>
          )}

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kategori (ketik kopi, makan, hobi...)"
              className="h-8.5 w-full rounded-xl bg-muted/60 pl-8.5 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary border border-border/60"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* List Kategori dengan Scroller yang rapi & nyaman */}
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
            {filteredParents.length > 0 ? (
              filteredParents.map((parent) => {
                const children = childCategoriesMap.get(parent.id) || [];
                const q = search.toLowerCase();
                const filteredChildren = search.trim()
                  ? children.filter((ch) => ch.name.toLowerCase().includes(q))
                  : children;

                const isParentSelected = value === parent.id;

                return (
                  <div key={parent.id} className="space-y-0.5 mb-1.5">
                    {/* Parent Item */}
                    <button
                      type="button"
                      onClick={() => {
                        onChange(parent.id);
                        setIsOpen(false);
                        setSearch("");
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs transition-all group",
                        isParentSelected
                          ? "bg-primary/15 text-primary font-bold border border-primary/25 shadow-xs"
                          : "text-foreground font-semibold hover:bg-muted/80 border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-lg text-xs shrink-0 transition-colors",
                            isParentSelected
                              ? "bg-primary text-white"
                              : "bg-muted text-muted-foreground group-hover:text-primary group-hover:bg-primary/10"
                          )}
                        >
                          <Folder className="h-3.5 w-3.5" />
                        </div>
                        <span className="truncate">{parent.name}</span>
                        {children.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted/80 text-muted-foreground font-medium shrink-0">
                            {children.length}
                          </span>
                        )}
                      </div>
                      {isParentSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </button>

                    {/* Children Items */}
                    {filteredChildren.length > 0 && (
                      <div className="ml-3.5 pl-2.5 border-l-2 border-border/60 space-y-0.5 my-0.5">
                        {filteredChildren.map((child) => {
                          const isChildSelected = value === child.id;
                          return (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => {
                                onChange(child.id);
                                setIsOpen(false);
                                setSearch("");
                              }}
                              className={cn(
                                "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-all",
                                isChildSelected
                                  ? "bg-primary/15 text-primary font-bold border border-primary/20 shadow-xs"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/70 border border-transparent"
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full shrink-0",
                                    isChildSelected ? "bg-primary" : "bg-muted-foreground/40"
                                  )}
                                />
                                <span className="truncate">{child.name}</span>
                              </div>
                              {isChildSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-5 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <span>Tidak ada kategori &quot;{search}&quot;</span>
                {onCreateRecommended && search.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      onCreateRecommended(
                        search.trim(),
                        txType === "income" ? "income" : "expense"
                      );
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer bg-primary/10 px-3 py-1 rounded-lg border border-primary/20"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Buat Kategori Baru &quot;{search.trim()}&quot;
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Bottom helper */}
          <div className="pt-1.5 border-t border-border/50 px-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{relevantCategories.length} kategori tersedia</span>
            <span>Gulir untuk melihat lainnya</span>
          </div>
        </div>
      )}
    </div>
  );
}
