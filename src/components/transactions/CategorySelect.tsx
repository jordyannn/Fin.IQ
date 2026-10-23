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
import { CategoryIcon } from "@/components/categories/CategoryIcon";

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
  align?: "left" | "right" | "auto";
}

interface FlattenedSearchItem {
  id: string;
  name: string;
  parentId?: string | null;
  parentName?: string | null;
  isParent: boolean;
  subCount?: number;
  icon?: string | null;
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
  align = "auto",
}: CategorySelectProps) {
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

      // Check available space below and right to decide opening direction
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        setOpenUpward(spaceBelow < 310 && spaceAbove > spaceBelow);

        if (align === "right" && window.innerWidth >= 640) {
          setOpenRightAligned(true);
        } else if (align === "left" || window.innerWidth < 640) {
          setOpenRightAligned(false);
        } else {
          // Auto: check if closer to right edge of viewport or container
          const spaceRight = window.innerWidth - rect.left;
          setOpenRightAligned(spaceRight < 340 || rect.right > window.innerWidth - 80);
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
    if (isOpen) {
      setHighlightedIndex(0);
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Filter categories by txType if provided
  const relevantCategories = useMemo(() => {
    if (txType === "transfer") return [];
    return categories.filter((c) => !c.kind || c.kind === txType);
  }, [categories, txType]);

  // Category lookup map for fast resolution
  const categoryMap = useMemo(() => {
    const map = new Map<string, CategoryOption>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  // Selected category info
  const selectedCat = useMemo(() => {
    return categories.find((c) => c.id === value);
  }, [categories, value]);

  const selectedParent = useMemo(() => {
    if (!selectedCat?.parentId) return null;
    return categories.find((c) => c.id === selectedCat.parentId);
  }, [categories, selectedCat]);

  // Group into Parents and Children (with orphan protection)
  const parentCategories = useMemo(() => {
    const validParentIds = new Set(relevantCategories.map((c) => c.id));
    return relevantCategories.filter((c) => !c.parentId || !validParentIds.has(c.parentId));
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

  // Flattened searchable list when search is active
  const searchResults = useMemo<FlattenedSearchItem[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];

    const results: FlattenedSearchItem[] = [];
    const addedIds = new Set<string>();

    // 1. Direct subcategory matches (most specific intent, e.g. "kopi")
    relevantCategories.forEach((c) => {
      if (c.parentId && c.name.toLowerCase().includes(q)) {
        const parent = categoryMap.get(c.parentId);
        results.push({
          id: c.id,
          name: c.name,
          parentId: c.parentId,
          parentName: parent?.name || null,
          isParent: false,
          icon: c.icon,
        });
        addedIds.add(c.id);
      }
    });

    // 2. Direct parent matches (e.g. "makan")
    parentCategories.forEach((p) => {
      if (p.name.toLowerCase().includes(q) && !addedIds.has(p.id)) {
        const children = childCategoriesMap.get(p.id) || [];
        results.push({
          id: p.id,
          name: p.name,
          parentId: null,
          parentName: null,
          isParent: true,
          subCount: children.length,
          icon: p.icon,
        });
        addedIds.add(p.id);

        // Also add non-added children of this parent as options
        children.forEach((ch) => {
          if (!addedIds.has(ch.id)) {
            results.push({
              id: ch.id,
              name: ch.name,
              parentId: p.id,
              parentName: p.name,
              isParent: false,
              icon: ch.icon,
            });
            addedIds.add(ch.id);
          }
        });
      }
    });

    // Sort: Exact match first, then startsWith, then contains
    return results.sort((a, b) => {
      const aLower = a.name.toLowerCase();
      const bLower = b.name.toLowerCase();
      if (aLower === q && bLower !== q) return -1;
      if (bLower === q && aLower !== q) return 1;
      if (aLower.startsWith(q) && !bLower.startsWith(q)) return -1;
      if (bLower.startsWith(q) && !aLower.startsWith(q)) return 1;
      return 0;
    });
  }, [search, relevantCategories, parentCategories, categoryMap, childCategoriesMap]);

  // Reset highlight when search query changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  const isRecommendedAlreadyInList = useMemo(() => {
    if (!recommendedCategory?.name) return true;
    const lower = recommendedCategory.name.toLowerCase().trim();
    return categories.some((c) => c.name.toLowerCase().trim() === lower);
  }, [categories, recommendedCategory]);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearch("");
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // CRITICAL: Stop propagation so parent modal form is NOT submitted!
      e.preventDefault();
      e.stopPropagation();

      if (search.trim()) {
        if (searchResults.length > 0) {
          const target = searchResults[highlightedIndex] || searchResults[0];
          if (target) {
            handleSelect(target.id);
          }
        } else if (onCreateRecommended) {
          onCreateRecommended(
            search.trim(),
            txType === "income" ? "income" : "expense"
          );
          setIsOpen(false);
          setSearch("");
        }
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      if (searchResults.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % searchResults.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      if (searchResults.length > 0) {
        setHighlightedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
      }
    } else if (e.key === "Escape") {
      // Close dropdown only, do NOT close the parent modal
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
    }
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
          !selectedCat && "text-muted-foreground"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors",
              selectedCat
                ? "bg-primary/10 border-primary/20 text-primary"
                : "bg-muted border-border text-muted-foreground"
            )}
          >
            <CategoryIcon
              icon={selectedCat?.icon}
              name={selectedCat?.name}
              className="h-3.5 w-3.5"
            />
          </div>

          <div className="flex flex-col min-w-0 text-left justify-center">
            <span className="truncate text-xs text-foreground font-semibold leading-tight">
              {selectedCat ? selectedCat.name : placeholder}
            </span>
            {selectedCat ? (
              <span className="text-[10px] text-muted-foreground leading-none mt-0.5 truncate">
                {selectedParent ? selectedParent.name : txType === "income" ? "Pemasukan" : "Pengeluaran"}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground/60 leading-none mt-0.5">
                Klasifikasi pos
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
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
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          className={cn(
            "absolute z-50 rounded-xl border border-border bg-card p-2.5 shadow-level-2 animate-in fade-in zoom-in-95 duration-140 flex flex-col gap-2 text-card-foreground font-sans",
            "w-full sm:w-[320px] max-w-[calc(100vw-2rem)]",
            openRightAligned
              ? "right-0 left-auto origin-top-right"
              : "left-0 right-auto origin-top-left",
            openUpward
              ? "bottom-full mb-2 origin-bottom"
              : "top-full mt-2 origin-top"
          )}
        >
          {/* Rekomendasi NLP Banner (Pinned) */}
          {recommendedCategory && !isRecommendedAlreadyInList && onCreateRecommended && (
            <div className="p-2.5 rounded-lg bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent border border-emerald-500/30 flex items-center justify-between gap-2 shadow-xs">
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

          {/* Search Input Bar - Perfectly Aligned Icon & Input */}
          <div className="relative flex items-center w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Cari kategori (kopi, makan, gaji...)"
              className="h-9 w-full rounded-lg bg-muted/40 pl-9 pr-9 text-xs font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary border border-border transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors active:scale-95 cursor-pointer"
                title="Hapus kata kunci pencarian"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* List Kategori Container */}
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
            {/* VIEW A: Search Results Active */}
            {search.trim() ? (
              searchResults.length > 0 ? (
                <div className="space-y-1">
                  <div className="px-1 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>Hasil Pencarian ({searchResults.length})</span>
                    <span className="text-[9px] lowercase font-normal">Tekan Enter untuk memilih</span>
                  </div>
                  {searchResults.map((item, idx) => {
                    const isSelected = value === item.id;
                    const isHighlighted = idx === highlightedIndex;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item.id)}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition-all group cursor-pointer",
                          isSelected
                            ? "bg-primary/15 text-primary font-bold border border-primary/25 shadow-xs"
                            : isHighlighted
                            ? "bg-muted text-foreground border border-border/60"
                            : "text-foreground font-medium hover:bg-muted/70 border border-transparent"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-lg text-xs shrink-0 transition-colors",
                              isSelected
                                ? "bg-primary text-white"
                                : item.isParent
                                ? "bg-muted text-muted-foreground group-hover:text-primary group-hover:bg-primary/10"
                                : "bg-muted/80 text-muted-foreground group-hover:text-foreground"
                            )}
                          >
                            <CategoryIcon
                              icon={item.icon}
                              name={item.name}
                              className="h-3.5 w-3.5"
                            />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="truncate font-semibold text-xs text-foreground">
                              {item.name}
                            </span>
                            {item.parentName && (
                              <span className="text-[10px] text-muted-foreground truncate">
                                Induk: {item.parentName}
                              </span>
                            )}
                            {item.isParent && (
                              <span className="text-[10px] text-muted-foreground/80">
                                Kategori Utama {item.subCount ? `(${item.subCount} sub)` : ""}
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* No Results Found: Inline Create Option */
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
                      className="text-xs font-bold text-primary hover:bg-primary/20 flex items-center gap-1 cursor-pointer bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/25 transition-all shadow-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Buat Kategori Baru &quot;{search.trim()}&quot;
                    </button>
                  )}
                </div>
              )
            ) : (
              /* VIEW B: Default Hierarchical View */
              parentCategories.map((parent) => {
                const children = childCategoriesMap.get(parent.id) || [];
                const isParentSelected = value === parent.id;

                return (
                  <div key={parent.id} className="space-y-0.5 mb-1.5">
                    {/* Parent Item */}
                    <button
                      type="button"
                      onClick={() => handleSelect(parent.id)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs transition-all group cursor-pointer",
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
                          <CategoryIcon
                            icon={parent.icon}
                            name={parent.name}
                            className="h-3.5 w-3.5"
                          />
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
                    {children.length > 0 && (
                      <div className="ml-3.5 pl-2.5 border-l-2 border-border/60 space-y-0.5 my-0.5">
                        {children.map((child) => {
                          const isChildSelected = value === child.id;
                          return (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => handleSelect(child.id)}
                              className={cn(
                                "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-all cursor-pointer",
                                isChildSelected
                                  ? "bg-primary/15 text-primary font-bold border border-primary/20 shadow-xs"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/70 border border-transparent"
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className={cn(
                                    "flex h-5 w-5 items-center justify-center rounded-md text-xs shrink-0 transition-colors",
                                    isChildSelected
                                      ? "bg-primary text-white"
                                      : "bg-muted/70 text-muted-foreground group-hover:text-foreground"
                                  )}
                                >
                                  <CategoryIcon
                                    icon={child.icon}
                                    name={child.name}
                                    className="h-3 w-3"
                                  />
                                </div>
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
            )}
          </div>

          {/* Bottom helper */}
          <div className="pt-1.5 border-t border-border/50 px-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{relevantCategories.length} kategori tersedia</span>
            <span>Tekan Esc untuk tutup</span>
          </div>
        </div>
      )}
    </div>
  );
}
