"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronRight,
  Check,
  Search,
  Plus,
  X,
  Sparkles,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { useTranslation } from "@/i18n";
import {
  ImportCategoryOption,
  GroupedCategoryNode,
  buildFallbackOptions,
  buildHierarchicalCategories,
  resolveDefaultCategoryForType,
} from "./category-picker-utils";

export type { ImportCategoryOption, GroupedCategoryNode };
export {
  EXPENSE_STANDARD_GROUPS,
  INCOME_STANDARD_GROUPS,
  buildHierarchicalCategories,
  resolveDefaultCategoryForType,
} from "./category-picker-utils";

export interface ImportCategoryPickerProps {
  categories: ImportCategoryOption[];
  value: string;
  onChange: (value: string) => void;
  txType?: "expense" | "income" | "transfer" | "mixed";
  valueMode?: "name" | "id";
  allowEmptyOptionLabel?: string;
  placeholder?: string;
  compact?: boolean;
  allowCreate?: boolean;
  isNlpDetected?: boolean;
  className?: string;
}

export function ImportCategoryPicker({
  categories,
  value,
  onChange,
  txType = "expense",
  valueMode = "name",
  allowEmptyOptionLabel,
  placeholder,
  compact = false,
  allowCreate = true,
  isNlpDetected = false,
  className,
}: ImportCategoryPickerProps) {
  const { locale } = useTranslation();
  const isEn = locale === "en";

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(new Set());
  const [mixedKindTab, setMixedKindTab] = useState<"expense" | "income">("expense");
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState("");
  const [popoverCoords, setPopoverCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    openUpward: boolean;
  }>({ left: 0, width: 290, openUpward: false });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const effectiveKind: "expense" | "income" =
    txType === "income"
      ? "income"
      : txType === "expense"
      ? "expense"
      : mixedKindTab;

  // Temukan kategori terpilih (untuk label, icon, parent hint, serta auto-expand parent bila child aktif)
  const selectedMatch = useMemo(() => {
    if (!value) return null;
    const byKey = categories.find((c) =>
      valueMode === "id"
        ? c.id === value
        : c.name.toLowerCase() === value.toLowerCase()
    );
    if (byKey) return byKey;

    const allFallback = [...buildFallbackOptions("expense"), ...buildFallbackOptions("income")];
    return (
      allFallback.find((c) =>
        valueMode === "id"
          ? c.id === value
          : c.name.toLowerCase() === value.toLowerCase()
      ) || null
    );
  }, [categories, value, valueMode]);

  const selectedParent = useMemo(() => {
    if (!selectedMatch?.parentId) return null;
    return (
      categories.find((c) => c.id === selectedMatch.parentId) ||
      buildFallbackOptions(effectiveKind).find((c) => c.id === selectedMatch.parentId) ||
      null
    );
  }, [categories, selectedMatch, effectiveKind]);

  const groupedCategories = useMemo(() => {
    return buildHierarchicalCategories(categories, effectiveKind);
  }, [categories, effectiveKind]);

  const allNodesInKind = useMemo(() => {
    const items: Array<{ item: ImportCategoryOption; parentName: string | null }> = [];
    for (const grp of groupedCategories) {
      items.push({ item: grp.parent, parentName: null });
      for (const ch of grp.children) {
        items.push({ item: ch, parentName: grp.parent.name });
      }
    }
    return items;
  }, [groupedCategories]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return allNodesInKind.filter(
      ({ item, parentName }) =>
        item.name.toLowerCase().includes(q) ||
        (parentName && parentName.toLowerCase().includes(q))
    );
  }, [allNodesInKind, search]);

  const updatePopoverPosition = useCallback(() => {
    if (!triggerRef.current || typeof window === "undefined") return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(Math.max(rect.width, 290), window.innerWidth - 16);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < 330 && spaceAbove > spaceBelow;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - popoverWidth - 8);

    setPopoverCoords({
      top: openUpward ? undefined : rect.bottom + 6,
      bottom: openUpward ? window.innerHeight - rect.top + 6 : undefined,
      left,
      width: popoverWidth,
      openUpward,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Sinkronkan tab kind bila mixed dan kategori terpilih punya kind spesifik
    if (txType === "mixed" && selectedMatch?.kind === "income") {
      setMixedKindTab("income");
    } else if (txType === "mixed" && selectedMatch?.kind === "expense") {
      setMixedKindTab("expense");
    }

    // Default tampilkan kategori besar saja, KECUALI bila sub-kategori sedang aktif maka expand induknya saja
    if (selectedMatch?.parentId) {
      setExpandedParentIds(new Set([selectedMatch.parentId]));
    } else {
      setExpandedParentIds(new Set());
    }

    setSearch("");
    setIsCreatingCustom(false);
    setCustomCategoryInput("");
    updatePopoverPosition();

    const focusTimer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 40);

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = (e: Event) => {
      if (popoverRef.current && popoverRef.current.contains(e.target as Node)) {
        return;
      }
      updatePopoverPosition();
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [isOpen, txType, selectedMatch, updatePopoverPosition]);

  const toggleExpandParent = (e: React.MouseEvent, parentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  };

  const handleSelectOption = (item: ImportCategoryOption) => {
    onChange(valueMode === "id" ? item.id : item.name);
    setIsOpen(false);
  };

  const isSelectedItem = (item: ImportCategoryOption) =>
    valueMode === "id"
      ? value === item.id
      : value.toLowerCase() === item.name.toLowerCase();

  const isCustomOrNlpValue =
    Boolean(value) &&
    !allowEmptyOptionLabel &&
    !selectedMatch &&
    value.toLowerCase() !== "transfer saldo";

  // Jika mode transfer, tampilkan ringkas tanpa mencampur daftar kategori belanja/pemasukan
  if (txType === "transfer") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300 font-medium select-none",
          compact ? "h-7.5 px-2 text-[11px]" : "h-9 px-3 text-xs",
          className
        )}
      >
        <Tag className={compact ? "h-3 w-3 shrink-0" : "h-3.5 w-3.5 shrink-0"} />
        <span className="truncate">
          {value || (isEn ? "Transfer Saldo" : "Transfer Saldo")}
        </span>
      </div>
    );
  }

  const displayLabel = !value
    ? allowEmptyOptionLabel || placeholder || (isEn ? "-- Select Category --" : "-- Pilih Kategori --")
    : selectedMatch?.name || value;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={cn(
          "flex w-full items-center justify-between gap-1.5 rounded-md border border-input bg-background text-left font-medium shadow-2xs transition-colors cursor-pointer hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
          compact ? "h-7.5 px-2 text-xs" : "h-9 px-3 text-xs",
          isOpen && "border-primary ring-2 ring-primary/20",
          !value && "text-muted-foreground",
          className
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {value ? (
            <CategoryIcon
              icon={selectedMatch?.icon}
              name={selectedMatch?.name || value}
              className={cn(
                "shrink-0 text-muted-foreground",
                compact ? "h-3 w-3" : "h-3.5 w-3.5"
              )}
            />
          ) : (
            <Tag className={cn("shrink-0 text-muted-foreground", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
          )}
          <span className="truncate text-foreground">
            {displayLabel}
            {!compact && selectedParent ? (
              <span className="text-muted-foreground font-normal"> ({selectedParent.name})</span>
            ) : null}
          </span>
        </div>

        <ChevronDown
          className={cn(
            "shrink-0 text-muted-foreground transition-transform duration-150",
            compact ? "h-3 w-3" : "h-3.5 w-3.5",
            isOpen && "rotate-180 text-primary"
          )}
        />
      </button>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: popoverCoords.top,
              bottom: popoverCoords.bottom,
              left: popoverCoords.left,
              width: popoverCoords.width,
              zIndex: 9999,
            }}
            className="rounded-xl border border-border bg-card p-2.5 shadow-2xl text-card-foreground animate-in fade-in zoom-in-95 duration-120 flex flex-col gap-2"
          >
            {/* Header Tab khusus mode mixed (Bulk / Fallback) */}
            {txType === "mixed" ? (
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setMixedKindTab("expense")}
                  className={cn(
                    "py-1 rounded-md font-semibold transition-all cursor-pointer",
                    mixedKindTab === "expense"
                      ? "bg-card text-rose-600 shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isEn ? "Expense" : "Pengeluaran"}
                </button>
                <button
                  type="button"
                  onClick={() => setMixedKindTab("income")}
                  className={cn(
                    "py-1 rounded-md font-semibold transition-all cursor-pointer",
                    mixedKindTab === "income"
                      ? "bg-card text-emerald-600 shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isEn ? "Income" : "Pemasukan"}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-wider">
                <span
                  className={
                    effectiveKind === "income"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }
                >
                  {effectiveKind === "income"
                    ? isEn
                      ? "Income Categories"
                      : "Kategori Pemasukan"
                    : isEn
                    ? "Expense Categories"
                    : "Kategori Pengeluaran"}
                </span>
                <span className="text-muted-foreground font-normal normal-case">
                  {isEn ? "Main categories" : "Kategori utama"}
                </span>
              </div>
            )}

            {/* Search Input */}
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    if (searchResults.length > 0) {
                      handleSelectOption(searchResults[0].item);
                    }
                  }
                }}
                placeholder={isEn ? "Search category or subcategory..." : "Cari kategori / sub-kategori..."}
                className="h-8 w-full rounded-lg border border-border bg-muted/40 pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Category List Container */}
            <div className="max-h-64 overflow-y-auto overscroll-contain space-y-1 pr-1">
              {allowEmptyOptionLabel && !search.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer",
                    !value
                      ? "bg-primary/15 text-primary font-bold"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  <span className="truncate">{allowEmptyOptionLabel}</span>
                  {!value && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              )}

              {isCustomOrNlpValue && !search.trim() && (
                <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate font-semibold text-foreground">{value}</span>
                    <span className="text-[10px] text-emerald-600 shrink-0">
                      {isNlpDetected
                        ? isEn
                          ? "(NLP)"
                          : "(Prediksi)"
                        : isEn
                        ? "(New)"
                        : "(Baru)"}
                    </span>
                  </div>
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                </div>
              )}

              {search.trim() ? (
                searchResults.length > 0 ? (
                  searchResults.map(({ item, parentName }) => {
                    const active = isSelectedItem(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectOption(item)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer",
                          active
                            ? "bg-primary/15 text-primary font-bold"
                            : "text-foreground hover:bg-muted/70"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CategoryIcon
                            icon={item.icon}
                            name={item.name}
                            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="truncate font-medium">{item.name}</span>
                            {parentName && (
                              <span className="text-[10px] text-muted-foreground truncate">
                                {isEn ? `Subcategory of ${parentName}` : `Sub-kategori dari ${parentName}`}
                              </span>
                            )}
                          </div>
                        </div>
                        {active && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    {isEn ? `No category matches "${search}"` : `Tidak ada kategori "${search}"`}
                  </div>
                )
              ) : (
                groupedCategories.map(({ parent, children }) => {
                  const hasChildren = children.length > 0;
                  const isExpanded = expandedParentIds.has(parent.id);
                  const parentActive = isSelectedItem(parent);
                  const hasSelectedChild = children.some((ch) => isSelectedItem(ch));

                  return (
                    <div key={parent.id} className="space-y-0.5">
                      <div
                        className={cn(
                          "flex items-center justify-between rounded-lg border transition-colors",
                          parentActive
                            ? "bg-primary/15 border-primary/25 text-primary"
                            : hasSelectedChild
                            ? "bg-muted/50 border-border/60 text-foreground"
                            : "border-transparent hover:bg-muted/70 text-foreground"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectOption(parent)}
                          className="flex flex-1 items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold min-w-0 cursor-pointer"
                        >
                          <div
                            className={cn(
                              "flex h-5 w-5 items-center justify-center rounded-md shrink-0",
                              parentActive
                                ? "bg-primary text-white"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            <CategoryIcon
                              icon={parent.icon}
                              name={parent.name}
                              className="h-3 w-3"
                            />
                          </div>
                          <span className="truncate">{parent.name}</span>
                          {parentActive && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </button>

                        {hasChildren && (
                          <button
                            type="button"
                            onClick={(e) => toggleExpandParent(e, parent.id)}
                            title={
                              isExpanded
                                ? isEn
                                  ? "Hide subcategories"
                                  : "Tutup sub-kategori"
                                : isEn
                                ? `Show ${children.length} subcategories`
                                : `Lihat ${children.length} sub-kategori`
                            }
                            className={cn(
                              "mr-1.5 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors shrink-0 cursor-pointer",
                              isExpanded
                                ? "bg-primary/15 text-primary"
                                : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <span>{children.length} sub</span>
                            <ChevronRight
                              className={cn(
                                "h-3 w-3 transition-transform duration-150",
                                isExpanded && "rotate-90"
                              )}
                            />
                          </button>
                        )}
                      </div>

                      {/* Sub-kategori di dalam kategori besar saat dibuka */}
                      {hasChildren && isExpanded && (
                        <div className="ml-3.5 pl-2 border-l-2 border-primary/25 space-y-0.5 py-0.5">
                          {children.map((child) => {
                            const childActive = isSelectedItem(child);
                            return (
                              <button
                                key={child.id}
                                type="button"
                                onClick={() => handleSelectOption(child)}
                                className={cn(
                                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors cursor-pointer",
                                  childActive
                                    ? "bg-primary/15 text-primary font-bold"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                )}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <CategoryIcon
                                    icon={child.icon}
                                    name={child.name}
                                    className="h-3 w-3 shrink-0"
                                  />
                                  <span className="truncate">{child.name}</span>
                                </div>
                                {childActive && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
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

            {/* Footer Buat Kategori Baru (untuk mode nama di pratinjau impor) */}
            {allowCreate && valueMode === "name" && (
              <div className="pt-1.5 border-t border-border/60">
                {!isCreatingCustom ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingCustom(true);
                      setCustomCategoryInput(search.trim());
                    }}
                    className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{isEn ? "Create New Category..." : "Buat Kategori Baru..."}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      autoFocus
                      value={customCategoryInput}
                      onChange={(e) => setCustomCategoryInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.stopPropagation();
                          if (customCategoryInput.trim()) {
                            onChange(customCategoryInput.trim());
                            setIsOpen(false);
                          }
                        }
                      }}
                      placeholder={isEn ? "New category name..." : "Nama kategori baru..."}
                      className="h-7.5 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customCategoryInput.trim()) {
                          onChange(customCategoryInput.trim());
                          setIsOpen(false);
                        }
                      }}
                      className="h-7.5 rounded-md bg-primary px-2.5 text-[11px] font-semibold text-white hover:bg-primary/90 cursor-pointer"
                    >
                      {isEn ? "Add" : "Pakai"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
