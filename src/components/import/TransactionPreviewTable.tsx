"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Trash2,
  Plus,
  Pencil,
  SlidersHorizontal,
  RotateCcw,
  Search,
  Check,
  X,
  Sparkles,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  CheckSquare,
  Square,
  Minus,
  HelpCircle,
  Eye,
  EyeOff,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatInputIDR, parseInputIDR } from "@/lib/utils";

export type PreviewColumnId =
  | "happenedAt"
  | "txType"
  | "amount"
  | "categoryName"
  | "accountName"
  | "toAccountName"
  | "note"
  | "tags";

export interface ColumnDefinition {
  id: PreviewColumnId;
  label: string;
  description: string;
  minWidth: string;
  defaultVisible: boolean;
}

export const ALL_COLUMNS: ColumnDefinition[] = [
  {
    id: "happenedAt",
    label: "Waktu / Tanggal",
    description: "Tanggal & waktu transaksi",
    minWidth: "w-36",
    defaultVisible: true,
  },
  {
    id: "txType",
    label: "Jenis Transaksi",
    description: "Pengeluaran, Pemasukan, atau Transfer",
    minWidth: "w-32",
    defaultVisible: true,
  },
  {
    id: "amount",
    label: "Nominal (Rp)",
    description: "Jumlah uang transaksi",
    minWidth: "w-36",
    defaultVisible: true,
  },
  {
    id: "categoryName",
    label: "Kategori",
    description: "Pos anggaran / klasifikasi pengeluaran",
    minWidth: "w-44",
    defaultVisible: true,
  },
  {
    id: "accountName",
    label: "Akun Asal",
    description: "Bank atau dompet digital sumber dana",
    minWidth: "w-40",
    defaultVisible: true,
  },
  {
    id: "toAccountName",
    label: "Akun Tujuan",
    description: "Rekening penerima (khusus transfer)",
    minWidth: "w-40",
    defaultVisible: true,
  },
  {
    id: "note",
    label: "Deskripsi Transaksi",
    description: "Keterangan, rincian, atau nama merchant",
    minWidth: "min-w-[200px]",
    defaultVisible: true,
  },
  {
    id: "tags",
    label: "Tag / Label",
    description: "Label pelengkap transaksi",
    minWidth: "w-32",
    defaultVisible: false,
  },
];

export interface ImportPreviewTxItem {
  id: string;
  rowNumber?: number;
  happenedAt: string;
  txType: "expense" | "income" | "transfer";
  amount: number;
  categoryName: string;
  isNlpDetected?: boolean;
  sourceConfidence?: "high" | "medium" | "ai";
  accountName: string;
  toAccountName?: string | null;
  note: string; // Deskripsi Transaksi
  tags?: string[];
  sourceImageIndex?: number;
}

export const STANDARD_CATEGORIES = [
  "Makanan & Minuman",
  "Kopi & Minuman",
  "Restoran & Kuliner",
  "Transportasi",
  "Bahan Bakar & SPBU",
  "Belanja",
  "Supermarket & Minimarket",
  "Tagihan & Utilitas",
  "Pulsa & Paket Data",
  "Kebutuhan Rumah",
  "Kesehatan & Medis",
  "Hiburan & Rekreasi",
  "Pendidikan & Karir",
  "Gaji & Pendapatan",
  "Bonus & THR",
  "Hasil Bisnis & Dagang",
  "Pekerjaan Sampingan / Freelance",
  "Hadiah & Rezeki",
  "Investasi & Dividen",
  "Transfer Saldo",
  "Umum",
];

interface TransactionPreviewTableProps<T extends ImportPreviewTxItem = ImportPreviewTxItem> {
  items: T[];
  onUpdateItems: (items: T[]) => void;
  onUpdateRow?: (id: string, updates: Partial<T>) => void;
  onDeleteRow?: (id: string) => void;
  onAddRow?: () => void;
  accounts?: Array<{ id: string; name: string; group?: string }>;
  categories?: Array<{ id: string; name: string; kind?: string }>;
  isNlpAvailable?: boolean;
  onRerunNlp?: () => void;
  defaultAccountName?: string;
  defaultCategoryName?: string;
  title?: string;
  subtitle?: string;
  variant?: "file" | "screenshot";
  onVisibleColumnsChange?: (visibleCols: PreviewColumnId[]) => void;
}

export function TransactionPreviewTable<T extends ImportPreviewTxItem = ImportPreviewTxItem>({
  items,
  onUpdateItems,
  onUpdateRow,
  onDeleteRow,
  onAddRow,
  accounts = [],
  categories = [],
  isNlpAvailable = false,
  onRerunNlp,
  defaultAccountName,
  defaultCategoryName,
  title = "Pratinjau & Edit Transaksi",
  subtitle = "Kelola, edit, tambah, dan hapus baris atau kolom transaksi sebelum diimpor ke sistem.",
  variant = "file",
  onVisibleColumnsChange,
}: TransactionPreviewTableProps<T>) {
  // 1. Column Visibility State (Supports Deleting / Restoring any column)
  const [visibleColumns, setVisibleColumns] = useState<PreviewColumnId[]>([
    "happenedAt",
    "txType",
    "amount",
    "categoryName",
    "accountName",
    "toAccountName",
    "note", // Deskripsi Transaksi
  ]);

  const [isColumnManagerOpen, setIsColumnManagerOpen] = useState(false);
  const columnManagerRef = useRef<HTMLDivElement>(null);

  // Notify parent on column changes
  useEffect(() => {
    onVisibleColumnsChange?.(visibleColumns);
  }, [visibleColumns, onVisibleColumnsChange]);

  // Close column manager on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        columnManagerRef.current &&
        !columnManagerRef.current.contains(event.target as Node)
      ) {
        setIsColumnManagerOpen(false);
      }
    }
    if (isColumnManagerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isColumnManagerOpen]);

  const handleDeleteColumn = (colId: PreviewColumnId) => {
    setVisibleColumns((prev) => prev.filter((id) => id !== colId));
  };

  const handleRestoreColumn = (colId: PreviewColumnId) => {
    if (!visibleColumns.includes(colId)) {
      setVisibleColumns((prev) => [...prev, colId]);
    }
  };

  const handleRestoreAllColumns = () => {
    setVisibleColumns([
      "happenedAt",
      "txType",
      "amount",
      "categoryName",
      "accountName",
      "toAccountName",
      "note",
      "tags",
    ]);
  };

  const handleResetDefaultColumns = () => {
    setVisibleColumns([
      "happenedAt",
      "txType",
      "amount",
      "categoryName",
      "accountName",
      "toAccountName",
      "note",
    ]);
  };

  // Deleted columns list for quick restore pills
  const deletedColumns = useMemo(() => {
    return ALL_COLUMNS.filter((col) => !visibleColumns.includes(col.id));
  }, [visibleColumns]);

  // 2. Row Selection & Batch Operations (CRUD: Delete, Bulk Update)
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkAccount, setBulkAccount] = useState("");

  const handleToggleSelectRow = (id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedRowIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(filteredItems.map((item) => item.id)));
    }
  };

  const handleBatchDeleteSelected = () => {
    if (selectedRowIds.size === 0) return;
    const remaining = items.filter((item) => !selectedRowIds.has(item.id));
    onUpdateItems(remaining);
    setSelectedRowIds(new Set());
  };

  const handleBatchApplyCategory = () => {
    if (!bulkCategory || selectedRowIds.size === 0) return;
    const updated = items.map((item) => {
      if (selectedRowIds.has(item.id)) {
        return { ...item, categoryName: bulkCategory, isNlpDetected: false };
      }
      return item;
    });
    onUpdateItems(updated);
  };

  const handleBatchApplyAccount = () => {
    if (!bulkAccount || selectedRowIds.size === 0) return;
    const updated = items.map((item) => {
      if (selectedRowIds.has(item.id)) {
        return { ...item, accountName: bulkAccount };
      }
      return item;
    });
    onUpdateItems(updated);
  };

  const handleClearAllRows = () => {
    if (window.confirm("Apakah Anda yakin ingin menghapus seluruh baris transaksi dari pratinjau?")) {
      onUpdateItems([]);
      setSelectedRowIds(new Set());
    }
  };

  // 3. Search & Filter State (CRUD: Read)
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income" | "transfer">("all");
  const [previewLimit, setPreviewLimit] = useState<number>(25);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Type filter
      if (typeFilter !== "all" && item.txType !== typeFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNote = (item.note || "").toLowerCase().includes(q);
        const matchCat = (item.categoryName || "").toLowerCase().includes(q);
        const matchAcc = (item.accountName || "").toLowerCase().includes(q);
        const matchToAcc = (item.toAccountName || "").toLowerCase().includes(q);
        const matchAmount = String(item.amount).includes(q);
        if (!matchNote && !matchCat && !matchAcc && !matchToAcc && !matchAmount) {
          return false;
        }
      }
      return true;
    });
  }, [items, typeFilter, searchQuery]);

  const displayedItems = useMemo(() => {
    if (previewLimit === 0) return filteredItems;
    return filteredItems.slice(0, previewLimit);
  }, [filteredItems, previewLimit]);

  // Statistics calculation
  const stats = useMemo(() => {
    let expenseSum = 0;
    let incomeSum = 0;
    let transferSum = 0;
    let expenseCount = 0;
    let incomeCount = 0;
    let transferCount = 0;

    for (const item of items) {
      if (item.txType === "expense") {
        expenseSum += item.amount;
        expenseCount++;
      } else if (item.txType === "income") {
        incomeSum += item.amount;
        incomeCount++;
      } else if (item.txType === "transfer") {
        transferSum += item.amount;
        transferCount++;
      }
    }

    return {
      total: items.length,
      expenseSum,
      incomeSum,
      transferSum,
      expenseCount,
      incomeCount,
      transferCount,
    };
  }, [items]);

  // 4. Modals State: Add Transaction Modal & Edit Transaction Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);

  // New Transaction Form State
  const [newTxType, setNewTxType] = useState<"expense" | "income" | "transfer">("expense");
  const [newHappenedAt, setNewHappenedAt] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16);
  });
  const [newAmount, setNewAmount] = useState<string>("50.000");
  const [newCategoryName, setNewCategoryName] = useState<string>(
    defaultCategoryName || categories[0]?.name || "Umum"
  );
  const [newAccountName, setNewAccountName] = useState<string>(
    defaultAccountName || accounts[0]?.name || "Kas Tunai"
  );
  const [newToAccountName, setNewToAccountName] = useState<string>("");
  const [newNote, setNewNote] = useState<string>("");
  const [newTags, setNewTags] = useState<string>("");

  const handleOpenAddModal = () => {
    const now = new Date();
    setNewTxType("expense");
    setNewHappenedAt(now.toISOString().slice(0, 16));
    setNewAmount("50.000");
    setNewCategoryName(defaultCategoryName || categories[0]?.name || "Umum");
    setNewAccountName(defaultAccountName || accounts[0]?.name || "Kas Tunai");
    setNewToAccountName("");
    setNewNote("");
    setNewTags("");
    setIsAddModalOpen(true);
  };

  const handleSaveNewTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmt = parseInputIDR(newAmount);
    const dateObj = new Date(newHappenedAt);
    const isoDate = isNaN(dateObj.getTime()) ? new Date().toISOString() : dateObj.toISOString();

    const tagList = newTags
      ? newTags
          .split(/[,;]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const newTx = {
      id: `manual-preview-tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      rowNumber: items.length + 1,
      happenedAt: isoDate,
      txType: newTxType,
      amount: cleanAmt,
      categoryName: newCategoryName.trim() || "Umum",
      accountName: newAccountName.trim() || "Kas Tunai",
      toAccountName: newTxType === "transfer" ? newToAccountName.trim() || null : null,
      note: newNote.trim() || "Transaksi Manual",
      tags: tagList,
    } as unknown as T;

    onUpdateItems([newTx, ...items]);
    setIsAddModalOpen(false);
  };

  // Edit Transaction Form State
  const [editTxType, setEditTxType] = useState<"expense" | "income" | "transfer">("expense");
  const [editHappenedAt, setEditHappenedAt] = useState<string>("");
  const [editAmount, setEditAmount] = useState<string>("");
  const [editCategoryName, setEditCategoryName] = useState<string>("");
  const [editAccountName, setEditAccountName] = useState<string>("");
  const [editToAccountName, setEditToAccountName] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");
  const [editTags, setEditTags] = useState<string>("");

  const handleOpenEditModal = (item: T) => {
    setEditingItem(item);
    setEditTxType(item.txType);
    try {
      const d = new Date(item.happenedAt);
      setEditHappenedAt(!isNaN(d.getTime()) ? d.toISOString().slice(0, 16) : "");
    } catch {
      setEditHappenedAt("");
    }
    setEditAmount(formatInputIDR(String(item.amount)));
    setEditCategoryName(item.categoryName || "Umum");
    setEditAccountName(item.accountName || "Kas Tunai");
    setEditToAccountName(item.toAccountName || "");
    setEditNote(item.note || "");
    setEditTags((item.tags || []).join(", "));
  };

  const handleSaveEditTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const cleanAmt = parseInputIDR(editAmount);
    const dateObj = new Date(editHappenedAt);
    const isoDate = isNaN(dateObj.getTime())
      ? editingItem.happenedAt
      : dateObj.toISOString();

    const tagList = editTags
      ? editTags
          .split(/[,;]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const updates = {
      txType: editTxType,
      happenedAt: isoDate,
      amount: cleanAmt,
      categoryName: editCategoryName.trim() || "Umum",
      accountName: editAccountName.trim() || "Kas Tunai",
      toAccountName: editTxType === "transfer" ? editToAccountName.trim() || null : null,
      note: editNote.trim() || "-",
      tags: tagList,
      isNlpDetected: false,
    } as unknown as Partial<T>;

    if (onUpdateRow) {
      onUpdateRow(editingItem.id, updates);
    } else {
      const updated = items.map((it) =>
        it.id === editingItem.id ? { ...it, ...updates } : it
      );
      onUpdateItems(updated);
    }

    setEditingItem(null);
  };

  // Helper for single row field update
  const handleCellUpdate = (id: string, updates: Partial<ImportPreviewTxItem>) => {
    if (onUpdateRow) {
      onUpdateRow(id, updates as unknown as Partial<T>);
    } else {
      const updated = items.map((it) => (it.id === id ? { ...it, ...updates } : it));
      onUpdateItems(updated);
    }
  };

  const handleSingleDelete = (id: string) => {
    if (onDeleteRow) {
      onDeleteRow(id);
    } else {
      onUpdateItems(items.filter((it) => it.id !== id));
    }
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Table Main Card */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Card Header & Primary Action Bar */}
        <div className="p-4 sm:p-5 border-b bg-muted/20 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                {title}
              </h3>
              <Badge
                variant="secondary"
                className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/20"
              >
                {items.length} Transaksi Terbaca
              </Badge>
              {isNlpAvailable && (
                <Badge
                  variant="secondary"
                  className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 flex items-center gap-1 font-semibold"
                >
                  <Sparkles className="h-3 w-3" />
                  NLP AI Siap
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>

          {/* Action Buttons: Add Row, Manage Columns, NLP, Clear All */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Create: Add Transaction Row Button */}
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleOpenAddModal}
              className="h-8 text-xs font-semibold gap-1.5 shadow-xs bg-primary text-white hover:bg-primary/90"
              title="Tambah baris transaksi baru secara manual ke pratinjau"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah Baris</span>
            </Button>

            {/* Column Manager Dropdown Button */}
            <div className="relative" ref={columnManagerRef}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsColumnManagerOpen(!isColumnManagerOpen)}
                className={`h-8 text-xs font-semibold gap-1.5 border-border ${
                  deletedColumns.length > 0
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                    : ""
                }`}
                title="Atur, sembunyikan, atau hapus kolom tabel"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Atur Kolom ({visibleColumns.length}/{ALL_COLUMNS.length})</span>
              </Button>

              {/* Column Manager Dropdown Menu */}
              {isColumnManagerOpen && (
                <div className="absolute right-0 mt-1 w-72 rounded-xl border border-border bg-popover shadow-xl p-3 z-50 text-xs animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between border-b pb-2 mb-2 font-bold text-foreground">
                    <span>Kelola Kolom Tabel</span>
                    <button
                      type="button"
                      onClick={() => setIsColumnManagerOpen(false)}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Centang untuk menampilkan atau hapus kolom dari pratinjau transaksi:
                  </p>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {ALL_COLUMNS.map((col) => {
                      const isVisible = visibleColumns.includes(col.id);
                      return (
                        <div
                          key={col.id}
                          className="flex items-center justify-between p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <label className="flex items-center gap-2 cursor-pointer flex-1 select-none">
                            <input
                              type="checkbox"
                              checked={isVisible}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleRestoreColumn(col.id);
                                } else {
                                  handleDeleteColumn(col.id);
                                }
                              }}
                              className="rounded border-input h-3.5 w-3.5 text-primary focus:ring-0 cursor-pointer"
                            />
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground text-[11px]">
                                {col.label}
                              </span>
                              <span className="text-[9px] text-muted-foreground">
                                {col.description}
                              </span>
                            </div>
                          </label>

                          {isVisible && (
                            <button
                              type="button"
                              onClick={() => handleDeleteColumn(col.id)}
                              className="p-1 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 transition-colors"
                              title={`Hapus kolom ${col.label}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2.5 mt-2 border-t flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleResetDefaultColumns}
                      className="text-[10px] text-muted-foreground hover:text-foreground font-medium"
                    >
                      Reset Default
                    </button>
                    <button
                      type="button"
                      onClick={handleRestoreAllColumns}
                      className="text-[10px] text-primary hover:underline font-semibold"
                    >
                      Tampilkan Semua
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Re-run NLP Button if supported */}
            {isNlpAvailable && onRerunNlp && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRerunNlp}
                className="text-xs gap-1.5 h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 border-emerald-500/30 font-semibold"
                title="Deteksi ulang kategori dengan AI NLP berdasarkan deskripsi transaksi"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Deteksi Ulang NLP</span>
              </Button>
            )}

            {/* Clear All Rows */}
            {items.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearAllRows}
                className="h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 gap-1 font-semibold"
                title="Hapus semua baris transaksi di pratinjau"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Hapus Semua</span>
              </Button>
            )}
          </div>
        </div>

        {/* Deleted Columns Quick-Restore Alert Banner */}
        {deletedColumns.length > 0 && (
          <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                <EyeOff className="h-3.5 w-3.5" />
                Kolom Tersembunyi/Dihapus ({deletedColumns.length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {deletedColumns.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => handleRestoreColumn(col.id)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/20 text-amber-800 dark:text-amber-200 hover:bg-amber-500/30 transition-colors border border-amber-500/30"
                    title={`Klik untuk memulihkan kolom ${col.label}`}
                  >
                    <span>{col.label}</span>
                    <Plus className="h-2.5 w-2.5" />
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRestoreAllColumns}
              className="h-6 px-2 text-[11px] text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 font-bold"
            >
              Pulihkan Semua Kolom
            </Button>
          </div>
        )}

        {/* Secondary Toolbar: Search, Filters, Stats & Limit */}
        <div className="p-4 bg-muted/10 border-b flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          {/* Search Box & Type Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Live Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari deskripsi, kategori, akun..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-7 text-xs bg-background"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Type Filters */}
            <div className="flex items-center gap-1 bg-background border border-input rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setTypeFilter("all")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  typeFilter === "all"
                    ? "bg-primary text-white shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Semua ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("expense")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  typeFilter === "expense"
                    ? "bg-rose-500 text-white shadow-2xs"
                    : "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                }`}
                title={`Total Pengeluaran: Rp ${formatInputIDR(String(stats.expenseSum))}`}
              >
                Pengeluaran ({stats.expenseCount}{stats.expenseSum > 0 ? ` • Rp ${formatInputIDR(String(stats.expenseSum))}` : ""})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("income")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  typeFilter === "income"
                    ? "bg-emerald-500 text-white shadow-2xs"
                    : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                }`}
                title={`Total Pemasukan: Rp ${formatInputIDR(String(stats.incomeSum))}`}
              >
                Pemasukan ({stats.incomeCount}{stats.incomeSum > 0 ? ` • Rp ${formatInputIDR(String(stats.incomeSum))}` : ""})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("transfer")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  typeFilter === "transfer"
                    ? "bg-sky-500 text-white shadow-2xs"
                    : "text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/20"
                }`}
                title={`Total Transfer: Rp ${formatInputIDR(String(stats.transferSum))}`}
              >
                Transfer ({stats.transferCount}{stats.transferSum > 0 ? ` • Rp ${formatInputIDR(String(stats.transferSum))}` : ""})
              </button>
            </div>
          </div>

          {/* Row Display Limit Selector */}
          <div className="flex items-center gap-2 self-end sm:self-auto text-muted-foreground">
            <span>Tampilkan:</span>
            <select
              value={previewLimit}
              onChange={(e) => setPreviewLimit(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs font-semibold focus:outline-none"
            >
              <option value={10}>10 Baris</option>
              <option value={25}>25 Baris</option>
              <option value={50}>50 Baris</option>
              <option value={0}>Semua ({filteredItems.length}) Baris</option>
            </select>
          </div>
        </div>

        {/* Selected Rows Bulk Action Bar */}
        {selectedRowIds.size > 0 && (
          <div className="px-5 py-3 bg-primary/10 border-b border-primary/20 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-3">
              <span className="font-bold text-primary flex items-center gap-1.5">
                <CheckSquare className="h-4 w-4" />
                {selectedRowIds.size} baris transaksi dipilih
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRowIds(new Set())}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                Batal Pilih
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Bulk Category Assign */}
              <div className="flex items-center gap-1.5">
                <select
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="h-7 rounded-md border border-input bg-background px-2 text-xs w-36 focus:outline-none"
                >
                  <option value="">-- Pilih Kategori --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  <optgroup label="Standar">
                    {STANDARD_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!bulkCategory}
                  onClick={handleBatchApplyCategory}
                  className="h-7 text-xs font-semibold"
                >
                  Terapkan Kategori
                </Button>
              </div>

              {/* Bulk Account Assign */}
              <div className="flex items-center gap-1.5">
                <select
                  value={bulkAccount}
                  onChange={(e) => setBulkAccount(e.target.value)}
                  className="h-7 rounded-md border border-input bg-background px-2 text-xs w-36 focus:outline-none"
                >
                  <option value="">-- Pilih Akun --</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!bulkAccount}
                  onClick={handleBatchApplyAccount}
                  className="h-7 text-xs font-semibold"
                >
                  Terapkan Akun
                </Button>
              </div>

              {/* Bulk Delete */}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleBatchDeleteSelected}
                className="h-7 text-xs font-bold gap-1 ml-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hapus Terpilih ({selectedRowIds.size})
              </Button>
            </div>
          </div>
        )}

        {/* Interactive Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground font-semibold border-b border-border select-none">
              <tr>
                {/* Select All Checkbox */}
                <th className="px-3 py-2.5 w-10 text-center">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="p-1 rounded text-muted-foreground hover:text-foreground"
                    title={
                      selectedRowIds.size === filteredItems.length && filteredItems.length > 0
                        ? "Batal pilih semua"
                        : "Pilih semua baris"
                    }
                  >
                    {selectedRowIds.size === filteredItems.length && filteredItems.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : selectedRowIds.size > 0 ? (
                      <Minus className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>

                {/* Row Number */}
                <th className="px-3 py-2.5 w-10 text-center">#</th>

                {/* Column: Waktu / Tanggal */}
                {visibleColumns.includes("happenedAt") && (
                  <th className="px-3 py-2.5 w-36">
                    <div className="flex items-center justify-between gap-1 group">
                      <span>Waktu / Tanggal</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn("happenedAt")}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-0.5 rounded transition-opacity"
                        title="Hapus kolom Waktu dari pratinjau"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                )}

                {/* Column: Jenis Transaksi */}
                {visibleColumns.includes("txType") && (
                  <th className="px-3 py-2.5 w-32">
                    <div className="flex items-center justify-between gap-1 group">
                      <span>Jenis</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn("txType")}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-0.5 rounded transition-opacity"
                        title="Hapus kolom Jenis Transaksi dari pratinjau"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                )}

                {/* Column: Nominal */}
                {visibleColumns.includes("amount") && (
                  <th className="px-3 py-2.5 w-36 text-right">
                    <div className="flex items-center justify-end gap-1 group">
                      <span>Nominal (Rp)</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn("amount")}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-0.5 rounded transition-opacity ml-1"
                        title="Hapus kolom Nominal dari pratinjau"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                )}

                {/* Column: Kategori */}
                {visibleColumns.includes("categoryName") && (
                  <th className="px-3 py-2.5 w-44">
                    <div className="flex items-center justify-between gap-1 group">
                      <span>Kategori</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn("categoryName")}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-0.5 rounded transition-opacity"
                        title="Hapus kolom Kategori dari pratinjau"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                )}

                {/* Column: Akun Asal */}
                {visibleColumns.includes("accountName") && (
                  <th className="px-3 py-2.5 w-40">
                    <div className="flex items-center justify-between gap-1 group">
                      <span>Akun / Rekening</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn("accountName")}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-0.5 rounded transition-opacity"
                        title="Hapus kolom Akun dari pratinjau"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                )}

                {/* Column: Akun Tujuan (Transfer) */}
                {visibleColumns.includes("toAccountName") && (
                  <th className="px-3 py-2.5 w-40">
                    <div className="flex items-center justify-between gap-1 group">
                      <span>Akun Tujuan</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn("toAccountName")}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-0.5 rounded transition-opacity"
                        title="Hapus kolom Akun Tujuan dari pratinjau"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                )}

                {/* Column: Deskripsi Transaksi (MANDATORY REQUEST) */}
                {visibleColumns.includes("note") && (
                  <th className="px-3 py-2.5 min-w-[220px]">
                    <div className="flex items-center justify-between gap-1 group">
                      <span className="font-bold text-foreground">
                        Deskripsi Transaksi
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn("note")}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-0.5 rounded transition-opacity"
                        title="Hapus kolom Deskripsi Transaksi dari pratinjau"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                )}

                {/* Column: Tags */}
                {visibleColumns.includes("tags") && (
                  <th className="px-3 py-2.5 w-32">
                    <div className="flex items-center justify-between gap-1 group">
                      <span>Tag / Label</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn("tags")}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-0.5 rounded transition-opacity"
                        title="Hapus kolom Tag dari pratinjau"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                )}

                {/* Actions Column */}
                <th className="px-3 py-2.5 w-20 text-center">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {displayedItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length + 3}
                    className="py-12 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <AlertTriangle className="h-8 w-8 text-amber-500" />
                      <p className="font-semibold text-foreground text-sm">
                        Tidak Ada Baris Transaksi
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {searchQuery || typeFilter !== "all"
                          ? "Tidak ada transaksi yang cocok dengan filter atau kata kunci pencarian."
                          : "Belum ada transaksi di pratinjau. Klik 'Tambah Baris' untuk membuat transaksi manual."}
                      </p>
                      {(searchQuery || typeFilter !== "all") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchQuery("");
                            setTypeFilter("all");
                          }}
                          className="mt-2 text-xs"
                        >
                          Reset Filter Pencarian
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                displayedItems.map((tx, idx) => {
                  const isSelected = selectedRowIds.has(tx.id);
                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-muted/20 transition-colors ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      {/* Checkbox Select */}
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectRow(tx.id)}
                          className="p-1 rounded text-muted-foreground hover:text-foreground"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </td>

                      {/* Row Index */}
                      <td className="px-3 py-2 text-center text-muted-foreground font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Cell: Happened At */}
                      {visibleColumns.includes("happenedAt") && (
                        <td className="px-3 py-2">
                          <Input
                            type="date"
                            value={tx.happenedAt ? tx.happenedAt.split("T")[0] : ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val) {
                                handleCellUpdate(tx.id, {
                                  happenedAt: new Date(val).toISOString(),
                                });
                              }
                            }}
                            className="h-8 text-xs font-mono w-32 bg-background shadow-2xs"
                          />
                        </td>
                      )}

                      {/* Cell: Tx Type */}
                      {visibleColumns.includes("txType") && (
                        <td className="px-3 py-2">
                          <select
                            value={tx.txType}
                            onChange={(e) =>
                              handleCellUpdate(tx.id, {
                                txType: e.target.value as any,
                              })
                            }
                            className={`h-8 rounded-md border border-input px-2 text-xs font-bold focus:outline-none w-32 ${
                              tx.txType === "expense"
                                ? "bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-900"
                                : tx.txType === "income"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-900"
                                : "bg-sky-500/10 text-sky-600 border-sky-200 dark:border-sky-900"
                            }`}
                          >
                            <option value="expense">Pengeluaran</option>
                            <option value="income">Pemasukan</option>
                            <option value="transfer">Transfer</option>
                          </select>
                        </td>
                      )}

                      {/* Cell: Amount (Formatted with dots for readability) */}
                      {visibleColumns.includes("amount") && (
                        <td className="px-3 py-2 text-right">
                          <div className="relative flex items-center justify-end w-36 ml-auto">
                            <span className="absolute left-2.5 text-[10px] font-bold text-muted-foreground pointer-events-none select-none">
                              Rp
                            </span>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={tx.amount ? formatInputIDR(String(tx.amount)) : ""}
                              onChange={(e) => {
                                const parsed = parseInputIDR(e.target.value);
                                handleCellUpdate(tx.id, {
                                  amount: parsed,
                                });
                              }}
                              className={`h-8 text-xs font-bold w-36 pl-8 text-right bg-background shadow-2xs font-mono tracking-tight ${
                                tx.txType === "expense"
                                  ? "text-rose-600 dark:text-rose-400"
                                  : tx.txType === "income"
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-sky-600 dark:text-sky-400"
                              }`}
                              placeholder="0"
                            />
                          </div>
                        </td>
                      )}

                      {/* Cell: Category */}
                      {visibleColumns.includes("categoryName") && (
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1 min-w-[160px]">
                            <select
                              value={tx.categoryName}
                              onChange={(e) =>
                                handleCellUpdate(tx.id, {
                                  categoryName: e.target.value,
                                  isNlpDetected: false,
                                })
                              }
                              className="h-8 rounded-md border border-input bg-background px-2 text-xs font-semibold focus:outline-none w-full shadow-2xs cursor-pointer hover:border-primary/60 transition-colors"
                            >
                              <option value="">-- Pilih Kategori --</option>
                              {tx.categoryName &&
                                !categories?.some(
                                  (c) =>
                                    c.name.toLowerCase() ===
                                    tx.categoryName.toLowerCase()
                                ) &&
                                !STANDARD_CATEGORIES.some(
                                  (s) =>
                                    s.toLowerCase() ===
                                    tx.categoryName.toLowerCase()
                                ) && (
                                  <option value={tx.categoryName}>
                                    {tx.categoryName}{" "}
                                    {tx.isNlpDetected
                                      ? "✨ (Prediksi NLP)"
                                      : "(Dokumen)"}
                                  </option>
                                )}
                              {categories && categories.length > 0 && (
                                <optgroup label="Kategori Saya">
                                  {categories.map((c) => (
                                    <option key={c.id} value={c.name}>
                                      {c.name}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              <optgroup label="Kategori Standar">
                                {STANDARD_CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                              </optgroup>
                            </select>

                            {tx.isNlpDetected && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded w-fit">
                                <Sparkles className="h-2.5 w-2.5" />
                                NLP AI
                              </span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Cell: Account Name */}
                      {visibleColumns.includes("accountName") && (
                        <td className="px-3 py-2">
                          <select
                            value={tx.accountName}
                            onChange={(e) =>
                              handleCellUpdate(tx.id, {
                                accountName: e.target.value,
                              })
                            }
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs w-36 focus:outline-none font-medium shadow-2xs"
                          >
                            {accounts.map((acc) => (
                              <option key={acc.id} value={acc.name}>
                                {acc.name} {acc.group ? `(${acc.group})` : ""}
                              </option>
                            ))}
                            {!accounts.some(
                              (a) =>
                                a.name.toLowerCase() ===
                                tx.accountName.toLowerCase()
                            )}
                            {tx.accountName && (
                              <option value={tx.accountName}>
                                + {tx.accountName} (buat baru)
                              </option>
                            )}
                          </select>
                        </td>
                      )}

                      {/* Cell: To Account Name (Transfer) */}
                      {visibleColumns.includes("toAccountName") && (
                        <td className="px-3 py-2">
                          {tx.txType === "transfer" ? (
                            <select
                              value={tx.toAccountName || ""}
                              onChange={(e) =>
                                handleCellUpdate(tx.id, {
                                  toAccountName: e.target.value || null,
                                })
                              }
                              className="h-8 rounded-md border border-input bg-background px-2 text-xs w-36 focus:outline-none font-medium shadow-2xs"
                            >
                              <option value="">-- Akun Tujuan --</option>
                              {accounts.map((acc) => (
                                <option key={acc.id} value={acc.name}>
                                  {acc.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic px-2">
                              -
                            </span>
                          )}
                        </td>
                      )}

                      {/* Cell: Deskripsi Transaksi (MANDATORY REQUEST) */}
                      {visibleColumns.includes("note") && (
                        <td className="px-3 py-2">
                          <Input
                            type="text"
                            value={tx.note || ""}
                            onChange={(e) =>
                              handleCellUpdate(tx.id, {
                                note: e.target.value,
                              })
                            }
                            className="h-8 text-xs bg-background min-w-[200px] font-medium placeholder:text-muted-foreground/60 shadow-2xs"
                            placeholder="Tulis deskripsi / keterangan transaksi..."
                          />
                        </td>
                      )}

                      {/* Cell: Tags */}
                      {visibleColumns.includes("tags") && (
                        <td className="px-3 py-2">
                          <Input
                            type="text"
                            value={(tx.tags || []).join(", ")}
                            onChange={(e) => {
                              const tagList = e.target.value
                                .split(",")
                                .map((t) => t.trim())
                                .filter(Boolean);
                              handleCellUpdate(tx.id, { tags: tagList });
                            }}
                            className="h-8 text-xs bg-background w-32"
                            placeholder="tag1, tag2..."
                          />
                        </td>
                      )}

                      {/* Row Actions: Edit Modal & Delete */}
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Edit Row in Full Modal */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditModal(tx)}
                            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                            title="Edit rincian baris transaksi ini"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          {/* Delete Single Row */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSingleDelete(tx.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg"
                            title="Hapus baris transaksi ini"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer: Pagination / Limit Indicator */}
        {previewLimit !== 0 && previewLimit < filteredItems.length && (
          <div className="py-2.5 px-4 bg-muted/20 border-t text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <span>
              Menampilkan {Math.min(previewLimit, filteredItems.length)} dari{" "}
              {filteredItems.length} transaksi.
            </span>
            <button
              type="button"
              onClick={() => setPreviewLimit(0)}
              className="font-bold text-primary hover:underline ml-1"
            >
              Tampilkan Semua ({filteredItems.length}) Baris
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: Tambah Baris Transaksi Baru (Create) */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl p-6 text-card-foreground">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Tambah Baris Transaksi ke Pratinjau
                </h3>
                <p className="text-xs text-muted-foreground">
                  Tambahkan transaksi baru secara manual ke tabel sebelum diimpor.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewTransaction} className="space-y-4 text-xs">
              {/* Jenis Transaksi Selector */}
              <div>
                <label className="font-semibold text-foreground mb-1 block">
                  Jenis Transaksi <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTxType("expense")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      newTxType === "expense"
                        ? "bg-rose-500 text-white border-rose-500 shadow-xs"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <ArrowDownLeft className="h-3.5 w-3.5" />
                    Pengeluaran
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTxType("income")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      newTxType === "income"
                        ? "bg-emerald-500 text-white border-emerald-500 shadow-xs"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Pemasukan
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTxType("transfer")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      newTxType === "transfer"
                        ? "bg-sky-500 text-white border-sky-500 shadow-xs"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    Transfer
                  </button>
                </div>
              </div>

              {/* Nominal & Waktu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground mb-1 block">
                    Nominal (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-muted-foreground pointer-events-none select-none">
                      Rp
                    </span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      required
                      value={newAmount ? formatInputIDR(newAmount) : ""}
                      onChange={(e) => setNewAmount(formatInputIDR(e.target.value))}
                      className="h-9 text-sm font-bold pl-9 font-mono"
                      placeholder="Contoh: 50.000"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-foreground mb-1 block">
                    Waktu / Tanggal <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="datetime-local"
                    required
                    value={newHappenedAt}
                    onChange={(e) => setNewHappenedAt(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Deskripsi Transaksi (MANDATORY REQUEST) */}
              <div>
                <label className="font-semibold text-foreground mb-1 block">
                  Deskripsi Transaksi <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="text"
                  required
                  placeholder="Contoh: Beli Kopi Kenangan, Gaji Bulanan, dsb."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="h-9 text-xs font-medium"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Keterangan atau rincian transaksi untuk pencatatan di pembukuan.
                </p>
              </div>

              {/* Kategori & Akun */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground mb-1 block">
                    Kategori Transaksi
                  </label>
                  <select
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-2xs text-xs focus:outline-none font-medium"
                  >
                    <optgroup label="Kategori Saya">
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Standar">
                      {STANDARD_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-foreground mb-1 block">
                    Akun Asal
                  </label>
                  <select
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-2xs text-xs focus:outline-none font-medium"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name} ({a.group || "Akun"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Akun Tujuan jika transfer */}
              {newTxType === "transfer" && (
                <div>
                  <label className="font-semibold text-foreground mb-1 block">
                    Akun Tujuan Transfer <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={newToAccountName}
                    onChange={(e) => setNewToAccountName(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-2xs text-xs focus:outline-none font-medium"
                  >
                    <option value="">-- Pilih Akun Tujuan --</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name} ({a.group || "Akun"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tag / Label */}
              <div>
                <label className="font-semibold text-foreground mb-1 block">
                  Tag / Label (Opsional)
                </label>
                <Input
                  type="text"
                  placeholder="Contoh: sarapan, operasional (pisahkan dengan koma)"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  className="text-xs font-semibold bg-primary text-white hover:bg-primary/90"
                >
                  Simpan ke Pratinjau
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Edit Baris Transaksi (Update) */}
      {/* ========================================================================= */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl p-6 text-card-foreground">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Edit Rincian Transaksi
                </h3>
                <p className="text-xs text-muted-foreground">
                  Ubah data nominal, kategori, akun, atau deskripsi transaksi ini.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTransaction} className="space-y-4 text-xs">
              {/* Jenis Transaksi Selector */}
              <div>
                <label className="font-semibold text-foreground mb-1 block">
                  Jenis Transaksi
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditTxType("expense")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      editTxType === "expense"
                        ? "bg-rose-500 text-white border-rose-500 shadow-xs"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <ArrowDownLeft className="h-3.5 w-3.5" />
                    Pengeluaran
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTxType("income")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      editTxType === "income"
                        ? "bg-emerald-500 text-white border-emerald-500 shadow-xs"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Pemasukan
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTxType("transfer")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      editTxType === "transfer"
                        ? "bg-sky-500 text-white border-sky-500 shadow-xs"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    Transfer
                  </button>
                </div>
              </div>

              {/* Nominal & Waktu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground mb-1 block">
                    Nominal (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-muted-foreground pointer-events-none select-none">
                      Rp
                    </span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      required
                      value={editAmount ? formatInputIDR(editAmount) : ""}
                      onChange={(e) => setEditAmount(formatInputIDR(e.target.value))}
                      className="h-9 text-sm font-bold pl-9 font-mono"
                      placeholder="Contoh: 50.000"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-foreground mb-1 block">
                    Waktu / Tanggal
                  </label>
                  <Input
                    type="datetime-local"
                    required
                    value={editHappenedAt}
                    onChange={(e) => setEditHappenedAt(e.target.value)}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Deskripsi Transaksi (MANDATORY REQUEST) */}
              <div>
                <label className="font-semibold text-foreground mb-1 block">
                  Deskripsi Transaksi
                </label>
                <Input
                  type="text"
                  required
                  placeholder="Keterangan transaksi..."
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="h-9 text-xs font-medium"
                />
              </div>

              {/* Kategori & Akun */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground mb-1 block">
                    Kategori Transaksi
                  </label>
                  <select
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-2xs text-xs focus:outline-none font-medium"
                  >
                    <optgroup label="Kategori Saya">
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Standar">
                      {STANDARD_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-foreground mb-1 block">
                    Akun Asal
                  </label>
                  <select
                    value={editAccountName}
                    onChange={(e) => setEditAccountName(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-2xs text-xs focus:outline-none font-medium"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name} ({a.group || "Akun"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Akun Tujuan jika transfer */}
              {editTxType === "transfer" && (
                <div>
                  <label className="font-semibold text-foreground mb-1 block">
                    Akun Tujuan Transfer
                  </label>
                  <select
                    value={editToAccountName}
                    onChange={(e) => setEditToAccountName(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-2xs text-xs focus:outline-none font-medium"
                  >
                    <option value="">-- Pilih Akun Tujuan --</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name} ({a.group || "Akun"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tag / Label */}
              <div>
                <label className="font-semibold text-foreground mb-1 block">
                  Tag / Label
                </label>
                <Input
                  type="text"
                  placeholder="tag1, tag2..."
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingItem(null)}
                  className="text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  className="text-xs font-semibold bg-primary text-white hover:bg-primary/90"
                >
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
