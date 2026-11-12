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
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n";
import {
  ImportCategoryPicker,
  ImportCategoryOption,
  resolveDefaultCategoryForType,
} from "@/components/import/ImportCategoryPicker";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatInputIDR,
  parseInputIDR,
} from "@/lib/utils";

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

export function getAllColumns(isEn: boolean): ColumnDefinition[] {
  return [
    {
      id: "happenedAt",
      label: isEn ? "Date" : "Tanggal",
      description: isEn ? "Transaction date & time" : "Tanggal & waktu transaksi",
      minWidth: "w-28",
      defaultVisible: true,
    },
    {
      id: "txType",
      label: isEn ? "Type" : "Jenis",
      description: isEn ? "Expense, Income, or Transfer" : "Pengeluaran, Pemasukan, atau Transfer",
      minWidth: "w-24",
      defaultVisible: true,
    },
    {
      id: "amount",
      label: isEn ? "Amount (Rp)" : "Nominal (Rp)",
      description: isEn ? "Transaction monetary amount" : "Jumlah uang transaksi",
      minWidth: "w-32",
      defaultVisible: true,
    },
    {
      id: "categoryName",
      label: isEn ? "Category" : "Kategori",
      description: isEn ? "Budget envelope / classification" : "Pos anggaran / klasifikasi",
      minWidth: "w-36",
      defaultVisible: true,
    },
    {
      id: "accountName",
      label: isEn ? "Account" : "Akun",
      description: isEn ? "Source bank or digital wallet" : "Bank atau dompet digital sumber dana",
      minWidth: "w-32",
      defaultVisible: true,
    },
    {
      id: "toAccountName",
      label: isEn ? "Destination" : "Akun Tujuan",
      description: isEn ? "Recipient account (transfer only)" : "Rekening penerima (khusus transfer)",
      minWidth: "w-32",
      defaultVisible: false,
    },
    {
      id: "note",
      label: isEn ? "Transaction Description" : "Deskripsi Transaksi",
      description: isEn ? "Notes, details, or merchant name" : "Keterangan, rincian, atau nama merchant",
      minWidth: "min-w-[160px]",
      defaultVisible: true,
    },
    {
      id: "tags",
      label: isEn ? "Tag / Label" : "Tag / Label",
      description: isEn ? "Transaction labels / tags" : "Label pelengkap transaksi",
      minWidth: "w-28",
      defaultVisible: false,
    },
  ];
}

export const ALL_COLUMNS = getAllColumns(false);

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
  categories?: ImportCategoryOption[];
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
  title,
  subtitle,
  variant = "file",
  onVisibleColumnsChange,
}: TransactionPreviewTableProps<T>) {
  const { locale } = useTranslation();
  const isEn = locale === "en";

  const resolvedTitle = title || (isEn ? "Transaction Preview & Edit" : "Pratinjau & Edit Transaksi");
  const resolvedSubtitle = subtitle || (isEn ? "Manage, edit, add, and remove transaction rows or columns before importing into the system." : "Kelola, edit, tambah, dan hapus baris atau kolom transaksi sebelum diimpor ke sistem.");

  const allColumns = useMemo(() => getAllColumns(isEn), [isEn]);

  // Check if items contain any transfer transactions
  const hasTransfers = useMemo(() => items.some((it) => it.txType === "transfer"), [items]);

  // 1. Column Visibility State (Supports Deleting / Restoring any column)
  const [visibleColumns, setVisibleColumns] = useState<PreviewColumnId[]>(() => {
    const cols: PreviewColumnId[] = [
      "happenedAt",
      "txType",
      "amount",
      "categoryName",
      "accountName",
    ];
    if (items.some((it) => it.txType === "transfer")) {
      cols.push("toAccountName");
    }
    cols.push("note"); // Deskripsi Transaksi
    return cols;
  });

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
    const cols: PreviewColumnId[] = [
      "happenedAt",
      "txType",
      "amount",
      "categoryName",
      "accountName",
    ];
    if (hasTransfers) {
      cols.push("toAccountName");
    }
    cols.push("note");
    setVisibleColumns(cols);
  };

  // Deleted columns list for quick restore pills
  const deletedColumns = useMemo(() => {
    return allColumns.filter((col) => !visibleColumns.includes(col.id));
  }, [allColumns, visibleColumns]);

  // 2. Row Selection & Batch Operations (CRUD: Delete, Bulk Update)
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkAccount, setBulkAccount] = useState("");

  const selectedRowsTxType = useMemo<"expense" | "income" | "mixed">(() => {
    const selectedTypes = new Set<string>();
    for (const item of items) {
      if (selectedRowIds.has(item.id) && (item.txType === "expense" || item.txType === "income")) {
        selectedTypes.add(item.txType);
      }
    }
    if (selectedTypes.size === 1) {
      return selectedTypes.has("income") ? "income" : "expense";
    }
    return "mixed";
  }, [items, selectedRowIds]);

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
    if (
      window.confirm(
        isEn
          ? "Are you sure you want to remove all transaction rows from the preview?"
          : "Apakah Anda yakin ingin menghapus seluruh baris transaksi dari pratinjau?"
      )
    ) {
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
    defaultCategoryName || categories[0]?.name || (isEn ? "General" : "Umum")
  );
  const [newAccountName, setNewAccountName] = useState<string>(
    defaultAccountName || accounts[0]?.name || (isEn ? "Cash" : "Kas Tunai")
  );
  const [newToAccountName, setNewToAccountName] = useState<string>("");
  const [newNote, setNewNote] = useState<string>("");
  const [newTags, setNewTags] = useState<string>("");

  const handleOpenAddModal = () => {
    const now = new Date();
    setNewTxType("expense");
    setNewHappenedAt(now.toISOString().slice(0, 16));
    setNewAmount("50.000");
    setNewCategoryName(
      resolveDefaultCategoryForType(categories, "expense", defaultCategoryName || "")
    );
    setNewAccountName(defaultAccountName || accounts[0]?.name || (isEn ? "Cash" : "Kas Tunai"));
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
      categoryName: newCategoryName.trim() || (isEn ? "General" : "Umum"),
      accountName: newAccountName.trim() || (isEn ? "Cash" : "Kas Tunai"),
      toAccountName: newTxType === "transfer" ? newToAccountName.trim() || null : null,
      note: newNote.trim() || (isEn ? "Manual Transaction" : "Transaksi Manual"),
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
    setEditCategoryName(item.categoryName || (isEn ? "General" : "Umum"));
    setEditAccountName(item.accountName || (isEn ? "Cash" : "Kas Tunai"));
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
      categoryName: editCategoryName.trim() || (isEn ? "General" : "Umum"),
      accountName: editAccountName.trim() || (isEn ? "Cash" : "Kas Tunai"),
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
                {resolvedTitle}
              </h3>
              <Badge
                variant="secondary"
                className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/20"
              >
                {items.length} {isEn ? "Transactions Read" : "Transaksi Terbaca"}
              </Badge>
              {isNlpAvailable && (
                <Badge
                  variant="secondary"
                  className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 flex items-center gap-1 font-semibold"
                >
                  <Sparkles className="h-3 w-3" />
                  NLP AI {isEn ? "Ready" : "Siap"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{resolvedSubtitle}</p>
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
              title={isEn ? "Add new transaction row manually to preview" : "Tambah baris transaksi baru secara manual ke pratinjau"}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{isEn ? "Add Row" : "Tambah Baris"}</span>
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
                title={isEn ? "Configure, hide, or remove table columns" : "Atur, sembunyikan, atau hapus kolom tabel"}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>
                  {isEn ? "Manage Columns" : "Atur Kolom"} ({visibleColumns.length}/{allColumns.length})
                </span>
              </Button>

              {/* Column Manager Dropdown Menu */}
              {isColumnManagerOpen && (
                <div className="absolute right-0 mt-1 w-72 rounded-xl border border-border bg-popover shadow-xl p-3 z-50 text-xs animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between border-b pb-2 mb-2 font-bold text-foreground">
                    <span>{isEn ? "Manage Table Columns" : "Kelola Kolom Tabel"}</span>
                    <button
                      type="button"
                      onClick={() => setIsColumnManagerOpen(false)}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    {isEn
                      ? "Check to display or remove columns from the transaction preview:"
                      : "Centang untuk menampilkan atau hapus kolom dari pratinjau transaksi:"}
                  </p>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {allColumns.map((col) => {
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
                              title={isEn ? `Remove column ${col.label}` : `Hapus kolom ${col.label}`}
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
                      {isEn ? "Show All" : "Tampilkan Semua"}
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
                title={isEn ? "Re-detect categories with AI NLP based on transaction description" : "Deteksi ulang kategori dengan AI NLP berdasarkan deskripsi transaksi"}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{isEn ? "Rerun NLP Detection" : "Deteksi Ulang NLP"}</span>
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
                title={isEn ? "Delete all transaction rows in preview" : "Hapus semua baris transaksi di pratinjau"}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{isEn ? "Clear All" : "Hapus Semua"}</span>
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
                {isEn
                  ? `Hidden/Removed Columns (${deletedColumns.length}):`
                  : `Kolom Tersembunyi/Dihapus (${deletedColumns.length}):`}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {deletedColumns.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => handleRestoreColumn(col.id)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/20 text-amber-800 dark:text-amber-200 hover:bg-amber-500/30 transition-colors border border-amber-500/30"
                    title={isEn ? `Click to restore column ${col.label}` : `Klik untuk memulihkan kolom ${col.label}`}
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
              {isEn ? "Restore All Columns" : "Pulihkan Semua Kolom"}
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
                placeholder={isEn ? "Search description, category, account..." : "Cari deskripsi, kategori, akun..."}
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
                {isEn ? `All (${items.length})` : `Semua (${items.length})`}
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("expense")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  typeFilter === "expense"
                    ? "bg-rose-500 text-white shadow-2xs"
                    : "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                }`}
                title={isEn ? `Total Expense: Rp ${formatInputIDR(String(stats.expenseSum))}` : `Total Pengeluaran: Rp ${formatInputIDR(String(stats.expenseSum))}`}
              >
                {isEn
                  ? `Expense (${stats.expenseCount}${stats.expenseSum > 0 ? ` • Rp ${formatInputIDR(String(stats.expenseSum))}` : ""})`
                  : `Pengeluaran (${stats.expenseCount}${stats.expenseSum > 0 ? ` • Rp ${formatInputIDR(String(stats.expenseSum))}` : ""})`}
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("income")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  typeFilter === "income"
                    ? "bg-emerald-500 text-white shadow-2xs"
                    : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                }`}
                title={isEn ? `Total Income: Rp ${formatInputIDR(String(stats.incomeSum))}` : `Total Pemasukan: Rp ${formatInputIDR(String(stats.incomeSum))}`}
              >
                {isEn
                  ? `Income (${stats.incomeCount}${stats.incomeSum > 0 ? ` • Rp ${formatInputIDR(String(stats.incomeSum))}` : ""})`
                  : `Pemasukan (${stats.incomeCount}${stats.incomeSum > 0 ? ` • Rp ${formatInputIDR(String(stats.incomeSum))}` : ""})`}
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("transfer")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  typeFilter === "transfer"
                    ? "bg-sky-500 text-white shadow-2xs"
                    : "text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/20"
                }`}
                title={isEn ? `Total Transfer: Rp ${formatInputIDR(String(stats.transferSum))}` : `Total Transfer: Rp ${formatInputIDR(String(stats.transferSum))}`}
              >
                {isEn
                  ? `Transfer (${stats.transferCount}${stats.transferSum > 0 ? ` • Rp ${formatInputIDR(String(stats.transferSum))}` : ""})`
                  : `Transfer (${stats.transferCount}${stats.transferSum > 0 ? ` • Rp ${formatInputIDR(String(stats.transferSum))}` : ""})`}
              </button>
            </div>
          </div>

          {/* Row Display Limit Selector */}
          <div className="flex items-center gap-2 self-end sm:self-auto text-muted-foreground">
            <span>{isEn ? "Show:" : "Tampilkan:"}</span>
            <select
              value={previewLimit}
              onChange={(e) => setPreviewLimit(Number(e.target.value))}
              className="h-8 rounded-md border border-border bg-card pl-2.5 pr-7 text-xs font-semibold text-foreground shadow-2xs transition-all hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value={10}>{isEn ? "10 Rows" : "10 Baris"}</option>
              <option value={25}>{isEn ? "25 Rows" : "25 Baris"}</option>
              <option value={50}>{isEn ? "50 Rows" : "50 Baris"}</option>
              <option value={0}>{isEn ? `All (${filteredItems.length}) Rows` : `Semua (${filteredItems.length}) Baris`}</option>
            </select>
          </div>
        </div>

        {/* Selected Rows Bulk Action Bar */}
        {selectedRowIds.size > 0 && (
          <div className="px-5 py-3 bg-primary/10 border-b border-primary/20 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-3">
              <span className="font-bold text-primary flex items-center gap-1.5">
                <CheckSquare className="h-4 w-4" />
                {selectedRowIds.size} {isEn ? "transaction rows selected" : "baris transaksi dipilih"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRowIds(new Set())}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                {isEn ? "Deselect" : "Batal Pilih"}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Bulk Category Assign */}
              <div className="flex items-center gap-1.5">
                <div className="w-44">
                  <ImportCategoryPicker
                    categories={categories}
                    value={bulkCategory}
                    onChange={setBulkCategory}
                    txType={selectedRowsTxType}
                    compact
                    allowEmptyOptionLabel={isEn ? "-- Select Category --" : "-- Pilih Kategori --"}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!bulkCategory}
                  onClick={handleBatchApplyCategory}
                  className="h-7 text-xs font-semibold"
                >
                  {isEn ? "Apply Category" : "Terapkan Kategori"}
                </Button>
              </div>

              {/* Bulk Account Assign */}
              <div className="flex items-center gap-1.5">
                <select
                  value={bulkAccount}
                  onChange={(e) => {
                    if (e.target.value === "__NEW_ACCOUNT__") {
                      const newAcc = prompt(
                        isEn
                          ? "Enter new account name for bulk assign:"
                          : "Masukkan nama akun baru untuk massal:"
                      );
                      if (newAcc && newAcc.trim()) {
                        setBulkAccount(newAcc.trim());
                      }
                    } else {
                      setBulkAccount(e.target.value);
                    }
                  }}
                  className="h-7.5 rounded-md border border-border bg-card pl-2 pr-7 text-xs w-36 text-foreground shadow-2xs transition-all hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">{isEn ? "-- Select Account --" : "-- Pilih Akun --"}</option>
                  {bulkAccount &&
                    !accounts.some((a) => a.name.toLowerCase() === bulkAccount.toLowerCase()) && (
                      <option value={bulkAccount}>+ {bulkAccount} ({isEn ? "New" : "Baru"})</option>
                    )}
                  {accounts.map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                  <option value="__NEW_ACCOUNT__">
                    {isEn ? "+ Create New Account..." : "+ Buat Akun Baru..."}
                  </option>
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!bulkAccount}
                  onClick={handleBatchApplyAccount}
                  className="h-7 text-xs font-semibold"
                >
                  {isEn ? "Apply Account" : "Terapkan Akun"}
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
                {isEn
                  ? `Delete Selected (${selectedRowIds.size})`
                  : `Hapus Terpilih (${selectedRowIds.size})`}
              </Button>
            </div>
          </div>
        )}

        {/* Interactive Responsive Table (Visible in one screen on desktop) */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse table-auto">
            <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground font-semibold border-b border-border select-none">
              <tr>
                {/* Select All Checkbox */}
                <th className="px-2 py-2 w-9 text-center">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="p-1 rounded text-muted-foreground hover:text-foreground"
                    title={
                      selectedRowIds.size === filteredItems.length && filteredItems.length > 0
                        ? (isEn ? "Deselect all" : "Batal pilih semua")
                        : (isEn ? "Select all rows" : "Pilih semua baris")
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
                <th className="px-1.5 py-2 w-8 text-center font-mono">#</th>

                {/* Column: Tanggal */}
                {visibleColumns.includes("happenedAt") && (
                  <th className="px-2 py-2 w-28 whitespace-nowrap">
                    <div className="flex items-center justify-between gap-1 group">
                      <span>{isEn ? "Date" : "Tanggal"}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn("happenedAt")}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-0.5 rounded transition-opacity"
                        title={isEn ? "Remove Date column from preview" : "Hapus kolom Tanggal dari pratinjau"}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                )}

                {/* Column: Jenis Transaksi */}
                {visibleColumns.includes("txType") && (
                  <th className="px-2 py-2 w-24 whitespace-nowrap">
                    <div className="flex items-center justify-between gap-1 group">
                      <span>{isEn ? "Type" : "Jenis"}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn("txType")}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-0.5 rounded transition-opacity"
                        title={isEn ? "Remove Transaction Type column from preview" : "Hapus kolom Jenis Transaksi dari pratinjau"}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                )}

                {/* Column: Nominal */}
                {visibleColumns.includes("amount") && (
                  <th className="px-2 py-2 w-32 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1 group">
                      <span>{isEn ? "Amount (Rp)" : "Nominal (Rp)"}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn("amount")}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-0.5 rounded transition-opacity ml-1"
                        title={isEn ? "Remove Amount column from preview" : "Hapus kolom Nominal dari pratinjau"}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                )}

                {/* Column: Kategori */}
                {visibleColumns.includes("categoryName") && (
                  <th className="px-2 py-2 w-36 whitespace-nowrap">
                    <div className="flex items-center justify-between gap-1 group">
                      <span>{isEn ? "Category" : "Kategori"}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn("categoryName")}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-0.5 rounded transition-opacity"
                        title={isEn ? "Remove Category column from preview" : "Hapus kolom Kategori dari pratinjau"}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                )}

                {/* Column: Akun Asal */}
                {visibleColumns.includes("accountName") && (
                  <th className="px-2 py-2 w-32 whitespace-nowrap">
                    <div className="flex items-center justify-between gap-1 group">
                      <span>{isEn ? "Account" : "Akun"}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn("accountName")}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-0.5 rounded transition-opacity"
                        title={isEn ? "Remove Account column from preview" : "Hapus kolom Akun dari pratinjau"}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                )}

                {/* Column: Akun Tujuan (Transfer) */}
                {visibleColumns.includes("toAccountName") && (
                  <th className="px-2 py-2 w-32 whitespace-nowrap">
                    <div className="flex items-center justify-between gap-1 group">
                      <span>{isEn ? "Destination" : "Tujuan"}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn("toAccountName")}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-0.5 rounded transition-opacity"
                        title={isEn ? "Remove Destination Account column from preview" : "Hapus kolom Akun Tujuan dari pratinjau"}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                )}

                {/* Column: Deskripsi Transaksi (MANDATORY REQUEST - Flexibly fills remaining space) */}
                {visibleColumns.includes("note") && (
                  <th className="px-2 py-2 w-auto min-w-[160px]">
                    <div className="flex items-center justify-between gap-1 group">
                      <span className="font-bold text-foreground">
                        {isEn ? "Transaction Description" : "Deskripsi Transaksi"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn("note")}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-0.5 rounded transition-opacity"
                        title={isEn ? "Remove Transaction Description column from preview" : "Hapus kolom Deskripsi Transaksi dari pratinjau"}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                )}

                {/* Column: Tags */}
                {visibleColumns.includes("tags") && (
                  <th className="px-2 py-2 w-28 whitespace-nowrap">
                    <div className="flex items-center justify-between gap-1 group">
                      <span>{isEn ? "Tags" : "Tag"}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn("tags")}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-0.5 rounded transition-opacity"
                        title={isEn ? "Remove Tags column from preview" : "Hapus kolom Tag dari pratinjau"}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                )}

                {/* Actions Column */}
                <th className="px-2 py-2 w-16 text-center whitespace-nowrap">{isEn ? "Actions" : "Aksi"}</th>
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
                        {isEn ? "No Transaction Rows" : "Tidak Ada Baris Transaksi"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {searchQuery || typeFilter !== "all"
                          ? (isEn
                              ? "No transactions match your search filter or keywords."
                              : "Tidak ada transaksi yang cocok dengan filter atau kata kunci pencarian.")
                          : (isEn
                              ? "No transactions in preview yet. Click 'Add Row' to create a manual transaction."
                              : "Belum ada transaksi di pratinjau. Klik 'Tambah Baris' untuk membuat transaksi manual.")}
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
                          {isEn ? "Reset Search Filters" : "Reset Filter Pencarian"}
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
                      <td className="px-2 py-1.5 text-center">
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
                      <td className="px-1.5 py-1.5 text-center text-muted-foreground font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Cell: Happened At (Formatted as DD/MMM/YYYY) */}
                      {visibleColumns.includes("happenedAt") && (
                        <td className="px-2 py-1.5">
                          <div className="relative flex items-center w-full min-w-[105px]">
                            <div className="h-7.5 px-2 font-mono text-[11px] font-bold text-foreground bg-background rounded-md border border-input shadow-2xs w-full flex items-center justify-between pointer-events-none select-none">
                              <span className="tracking-tight">{formatDate(tx.happenedAt)}</span>
                              <Calendar className="h-3 w-3 text-muted-foreground opacity-60 ml-1 shrink-0" />
                            </div>
                            <input
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
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              title={isEn ? "Click to pick transaction date" : "Klik untuk memilih tanggal transaksi"}
                            />
                          </div>
                        </td>
                      )}

                      {/* Cell: Tx Type */}
                      {visibleColumns.includes("txType") && (
                        <td className="px-2 py-1.5">
                          <select
                            value={tx.txType}
                            onChange={(e) => {
                              const nextType = e.target.value as "expense" | "income" | "transfer";
                              const nextCat = resolveDefaultCategoryForType(
                                categories,
                                nextType,
                                tx.categoryName
                              );
                              handleCellUpdate(tx.id, {
                                txType: nextType,
                                categoryName: nextCat,
                              });
                            }}
                            className={`h-7.5 rounded-md border border-input px-1.5 text-[11px] font-bold focus:outline-none w-full ${
                              tx.txType === "expense"
                                ? "bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-900"
                                : tx.txType === "income"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-900"
                                : "bg-sky-500/10 text-sky-600 border-sky-200 dark:border-sky-900"
                            }`}
                          >
                            <option value="expense">{isEn ? "Expense" : "Pengeluaran"}</option>
                            <option value="income">{isEn ? "Income" : "Pemasukan"}</option>
                            <option value="transfer">Transfer</option>
                          </select>
                        </td>
                      )}

                      {/* Cell: Amount (Formatted with dots for readability) */}
                      {visibleColumns.includes("amount") && (
                        <td className="px-2 py-1.5 text-right">
                          <div className="relative flex items-center justify-end w-full">
                            <span className="absolute left-2 text-[10px] font-bold text-muted-foreground pointer-events-none select-none">
                              Rp
                            </span>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={tx.amount !== undefined && tx.amount !== null ? formatInputIDR(String(tx.amount)) : ""}
                              onChange={(e) => {
                                const parsed = parseInputIDR(e.target.value);
                                handleCellUpdate(tx.id, {
                                  amount: parsed,
                                });
                              }}
                              className={`h-7.5 text-xs font-bold w-full pl-6 pr-2 text-right bg-background shadow-2xs font-mono tracking-tight ${
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
                        <td className="px-2 py-1.5">
                          <div className="flex flex-col gap-0.5 w-full">
                            <ImportCategoryPicker
                              categories={categories}
                              value={tx.categoryName}
                              onChange={(newCat) => {
                                handleCellUpdate(tx.id, {
                                  categoryName: newCat,
                                  isNlpDetected: false,
                                });
                              }}
                              txType={tx.txType}
                              compact
                              isNlpDetected={tx.isNlpDetected}
                            />

                            {tx.isNlpDetected && (
                              <span className="inline-flex items-center gap-1 text-[8.5px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.2 rounded w-fit">
                                <Sparkles className="h-2 w-2" />
                                NLP
                              </span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Cell: Account Name */}
                      {visibleColumns.includes("accountName") && (
                        <td className="px-2 py-1.5">
                          <select
                            value={tx.accountName}
                            onChange={(e) => {
                              if (e.target.value === "__NEW_ACCOUNT__") {
                                const newAcc = prompt(
                                  isEn ? "Enter new account name:" : "Masukkan nama akun baru:"
                                );
                                if (newAcc && newAcc.trim()) {
                                  handleCellUpdate(tx.id, {
                                    accountName: newAcc.trim(),
                                  });
                                }
                              } else {
                                handleCellUpdate(tx.id, {
                                  accountName: e.target.value,
                                });
                              }
                            }}
                            className="h-7.5 rounded-md border border-input bg-background px-1.5 text-xs w-full focus:outline-none font-medium shadow-2xs truncate"
                          >
                            {accounts.map((acc) => (
                              <option key={acc.id} value={acc.name}>
                                {acc.name} {acc.group ? `(${acc.group})` : ""}
                              </option>
                            ))}
                            {tx.accountName &&
                              !accounts.some(
                                (a) =>
                                  a.name.toLowerCase() ===
                                  tx.accountName.toLowerCase()
                              ) && (
                                <option value={tx.accountName}>
                                  + {tx.accountName} ({isEn ? "New Account" : "Akun Baru"})
                                </option>
                              )}
                            <option value="__NEW_ACCOUNT__">
                              {isEn ? "+ Create New Account..." : "+ Buat Akun Baru..."}
                            </option>
                          </select>
                        </td>
                      )}

                      {/* Cell: To Account Name (Transfer) */}
                      {visibleColumns.includes("toAccountName") && (
                        <td className="px-2 py-1.5">
                          {tx.txType === "transfer" ? (
                            <select
                              value={tx.toAccountName || ""}
                              onChange={(e) => {
                                if (e.target.value === "__NEW_ACCOUNT__") {
                                  const newAcc = prompt(
                                    isEn ? "Enter new destination account name:" : "Masukkan nama akun tujuan baru:"
                                  );
                                  if (newAcc && newAcc.trim()) {
                                    handleCellUpdate(tx.id, {
                                      toAccountName: newAcc.trim(),
                                    });
                                  }
                                } else {
                                  handleCellUpdate(tx.id, {
                                    toAccountName: e.target.value || null,
                                  });
                                }
                              }}
                              className="h-7.5 rounded-md border border-input bg-background px-1.5 text-xs w-full focus:outline-none font-medium shadow-2xs truncate"
                            >
                              <option value="">{isEn ? "-- Destination Account --" : "-- Akun Tujuan --"}</option>
                              {accounts.map((acc) => (
                                <option key={acc.id} value={acc.name}>
                                  {acc.name}
                                </option>
                              ))}
                              {tx.toAccountName &&
                                !accounts.some(
                                  (a) =>
                                    a.name.toLowerCase() ===
                                    tx.toAccountName!.toLowerCase()
                                ) && (
                                  <option value={tx.toAccountName}>
                                    + {tx.toAccountName} ({isEn ? "New Account" : "Akun Baru"})
                                  </option>
                                )}
                              <option value="__NEW_ACCOUNT__">
                                {isEn ? "+ Create New Account..." : "+ Buat Akun Baru..."}
                              </option>
                            </select>
                          ) : (
                            <span className="text-[11px] text-muted-foreground italic px-2">
                              -
                            </span>
                          )}
                        </td>
                      )}

                      {/* Cell: Deskripsi Transaksi (MANDATORY REQUEST - Flexibly takes remaining space) */}
                      {visibleColumns.includes("note") && (
                        <td className="px-2 py-1.5">
                          <Input
                            type="text"
                            value={tx.note || ""}
                            onChange={(e) =>
                              handleCellUpdate(tx.id, {
                                note: e.target.value,
                              })
                            }
                            className="h-7.5 text-xs bg-background w-full min-w-[150px] font-medium placeholder:text-muted-foreground/60 shadow-2xs px-2"
                            placeholder={isEn ? "Write transaction note / description..." : "Tulis deskripsi / keterangan transaksi..."}
                          />
                        </td>
                      )}

                      {/* Cell: Tags */}
                      {visibleColumns.includes("tags") && (
                        <td className="px-2 py-1.5">
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
                            className="h-7.5 text-xs bg-background w-full min-w-[90px] px-2"
                            placeholder="tag1, tag2..."
                          />
                        </td>
                      )}

                      {/* Row Actions: Edit Modal & Delete */}
                      <td className="px-1.5 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          {/* Edit Row in Full Modal */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditModal(tx)}
                            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md p-0"
                            title={isEn ? "Edit this transaction row details" : "Edit rincian baris transaksi ini"}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>

                          {/* Delete Single Row */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSingleDelete(tx.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md p-0"
                            title={isEn ? "Delete this transaction row" : "Hapus baris transaksi ini"}
                          >
                            <Trash2 className="h-3 w-3" />
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
              {isEn
                ? `Showing ${Math.min(previewLimit, filteredItems.length)} of ${filteredItems.length} transactions.`
                : `Menampilkan ${Math.min(previewLimit, filteredItems.length)} dari ${filteredItems.length} transaksi.`}
            </span>
            <button
              type="button"
              onClick={() => setPreviewLimit(0)}
              className="font-bold text-primary hover:underline ml-1"
            >
              {isEn
                ? `Show All (${filteredItems.length}) Rows`
                : `Tampilkan Semua (${filteredItems.length}) Baris`}
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
                  {isEn ? "Add Transaction Row to Preview" : "Tambah Baris Transaksi ke Pratinjau"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isEn
                    ? "Manually add a new transaction to the table before importing."
                    : "Tambahkan transaksi baru secara manual ke tabel sebelum diimpor."}
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
                  {isEn ? "Transaction Type" : "Jenis Transaksi"} <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewTxType("expense");
                      setNewCategoryName((prev) =>
                        resolveDefaultCategoryForType(categories, "expense", prev)
                      );
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      newTxType === "expense"
                        ? "bg-rose-500 text-white border-rose-500 shadow-xs"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <ArrowDownLeft className="h-3.5 w-3.5" />
                    {isEn ? "Expense" : "Pengeluaran"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewTxType("income");
                      setNewCategoryName((prev) =>
                        resolveDefaultCategoryForType(categories, "income", prev)
                      );
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      newTxType === "income"
                        ? "bg-emerald-500 text-white border-emerald-500 shadow-xs"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    {isEn ? "Income" : "Pemasukan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewTxType("transfer");
                      setNewCategoryName((prev) =>
                        resolveDefaultCategoryForType(categories, "transfer", prev)
                      );
                    }}
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
                    {isEn ? "Amount (Rp)" : "Nominal (Rp)"} <span className="text-rose-500">*</span>
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
                      placeholder={isEn ? "e.g., 50.000" : "Contoh: 50.000"}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-foreground">
                      {isEn ? "Date / Time" : "Waktu / Tanggal"} <span className="text-rose-500">*</span>
                    </label>
                    {newHappenedAt && (
                      <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        {formatDateTime(newHappenedAt)}
                      </span>
                    )}
                  </div>
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
                  {isEn ? "Transaction Description" : "Deskripsi Transaksi"} <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="text"
                  required
                  placeholder={isEn ? "e.g., Morning Coffee, Monthly Salary, etc." : "Contoh: Beli Kopi Kenangan, Gaji Bulanan, dsb."}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="h-9 text-xs font-medium"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {isEn
                    ? "Transaction note or details for bookkeeping records."
                    : "Keterangan atau rincian transaksi untuk pencatatan di pembukuan."}
                </p>
              </div>

              {/* Kategori & Akun */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground mb-1 block">
                    {isEn ? "Transaction Category" : "Kategori Transaksi"}
                  </label>
                  <ImportCategoryPicker
                    categories={categories}
                    value={newCategoryName}
                    onChange={setNewCategoryName}
                    txType={newTxType}
                  />
                </div>

                <div>
                  <label className="font-semibold text-foreground mb-1 block">
                    {isEn ? "Source Account" : "Akun Asal"}
                  </label>
                  <select
                    value={newAccountName}
                    onChange={(e) => {
                      if (e.target.value === "__NEW_ACCOUNT__") {
                        const newAcc = prompt(
                          isEn ? "Enter new account name:" : "Masukkan nama akun baru:"
                        );
                        if (newAcc && newAcc.trim()) {
                          setNewAccountName(newAcc.trim());
                        }
                      } else {
                        setNewAccountName(e.target.value);
                      }
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-2xs text-xs focus:outline-none font-medium"
                  >
                    {newAccountName &&
                      !accounts.some((a) => a.name.toLowerCase() === newAccountName.toLowerCase()) && (
                        <option value={newAccountName}>+ {newAccountName} ({isEn ? "New" : "Baru"})</option>
                      )}
                    {accounts.map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name} ({a.group || (isEn ? "Account" : "Akun")})
                      </option>
                    ))}
                    <option value="__NEW_ACCOUNT__">
                      {isEn ? "+ Create New Account..." : "+ Buat Akun Baru..."}
                    </option>
                  </select>
                </div>
              </div>

              {/* Akun Tujuan jika transfer */}
              {newTxType === "transfer" && (
                <div>
                  <label className="font-semibold text-foreground mb-1 block">
                    {isEn ? "Destination Account" : "Akun Tujuan Transfer"} <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={newToAccountName}
                    onChange={(e) => {
                      if (e.target.value === "__NEW_ACCOUNT__") {
                        const newAcc = prompt(
                          isEn ? "Enter new destination account name:" : "Masukkan nama akun tujuan baru:"
                        );
                        if (newAcc && newAcc.trim()) {
                          setNewToAccountName(newAcc.trim());
                        }
                      } else {
                        setNewToAccountName(e.target.value);
                      }
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-2xs text-xs focus:outline-none font-medium"
                  >
                    <option value="">{isEn ? "-- Select Destination Account --" : "-- Pilih Akun Tujuan --"}</option>
                    {newToAccountName &&
                      !accounts.some((a) => a.name.toLowerCase() === newToAccountName.toLowerCase()) && (
                        <option value={newToAccountName}>+ {newToAccountName} ({isEn ? "New" : "Baru"})</option>
                      )}
                    {accounts.map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name} ({a.group || (isEn ? "Account" : "Akun")})
                      </option>
                    ))}
                    <option value="__NEW_ACCOUNT__">
                      {isEn ? "+ Create New Account..." : "+ Buat Akun Baru..."}
                    </option>
                  </select>
                </div>
              )}

              {/* Tag / Label */}
              <div>
                <label className="font-semibold text-foreground mb-1 block">
                  {isEn ? "Tags / Labels (Optional)" : "Tag / Label (Opsional)"}
                </label>
                <Input
                  type="text"
                  placeholder={isEn ? "e.g., breakfast, operational (comma separated)" : "Contoh: sarapan, operasional (pisahkan dengan koma)"}
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
                  {isEn ? "Cancel" : "Batal"}
                </Button>
                <Button
                  type="submit"
                  className="text-xs font-semibold bg-primary text-white hover:bg-primary/90"
                >
                  {isEn ? "Save to Preview" : "Simpan ke Pratinjau"}
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
                  {isEn ? "Edit Transaction Details" : "Edit Rincian Transaksi"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isEn
                    ? "Modify amount, category, account, or description of this transaction."
                    : "Ubah data nominal, kategori, akun, atau deskripsi transaksi ini."}
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
                  {isEn ? "Transaction Type" : "Jenis Transaksi"}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditTxType("expense");
                      setEditCategoryName((prev) =>
                        resolveDefaultCategoryForType(categories, "expense", prev)
                      );
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      editTxType === "expense"
                        ? "bg-rose-500 text-white border-rose-500 shadow-xs"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <ArrowDownLeft className="h-3.5 w-3.5" />
                    {isEn ? "Expense" : "Pengeluaran"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditTxType("income");
                      setEditCategoryName((prev) =>
                        resolveDefaultCategoryForType(categories, "income", prev)
                      );
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      editTxType === "income"
                        ? "bg-emerald-500 text-white border-emerald-500 shadow-xs"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    {isEn ? "Income" : "Pemasukan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditTxType("transfer");
                      setEditCategoryName((prev) =>
                        resolveDefaultCategoryForType(categories, "transfer", prev)
                      );
                    }}
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
                    {isEn ? "Amount (Rp)" : "Nominal (Rp)"} <span className="text-rose-500">*</span>
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
                      placeholder={isEn ? "e.g., 50.000" : "Contoh: 50.000"}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-foreground">
                      {isEn ? "Date / Time" : "Waktu / Tanggal"}
                    </label>
                    {editHappenedAt && (
                      <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        {formatDateTime(editHappenedAt)}
                      </span>
                    )}
                  </div>
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
                  {isEn ? "Transaction Description" : "Deskripsi Transaksi"}
                </label>
                <Input
                  type="text"
                  required
                  placeholder={isEn ? "Transaction description..." : "Keterangan transaksi..."}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="h-9 text-xs font-medium"
                />
              </div>

              {/* Kategori & Akun */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground mb-1 block">
                    {isEn ? "Transaction Category" : "Kategori Transaksi"}
                  </label>
                  <ImportCategoryPicker
                    categories={categories}
                    value={editCategoryName}
                    onChange={setEditCategoryName}
                    txType={editTxType}
                  />
                </div>

                <div>
                  <label className="font-semibold text-foreground mb-1 block">
                    {isEn ? "Source Account" : "Akun Asal"}
                  </label>
                  <select
                    value={editAccountName}
                    onChange={(e) => {
                      if (e.target.value === "__NEW_ACCOUNT__") {
                        const newAcc = prompt(
                          isEn ? "Enter new account name:" : "Masukkan nama akun baru:"
                        );
                        if (newAcc && newAcc.trim()) {
                          setEditAccountName(newAcc.trim());
                        }
                      } else {
                        setEditAccountName(e.target.value);
                      }
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-2xs text-xs focus:outline-none font-medium"
                  >
                    {editAccountName &&
                      !accounts.some((a) => a.name.toLowerCase() === editAccountName.toLowerCase()) && (
                        <option value={editAccountName}>+ {editAccountName} ({isEn ? "New" : "Baru"})</option>
                      )}
                    {accounts.map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name} ({a.group || (isEn ? "Account" : "Akun")})
                      </option>
                    ))}
                    <option value="__NEW_ACCOUNT__">
                      {isEn ? "+ Create New Account..." : "+ Buat Akun Baru..."}
                    </option>
                  </select>
                </div>
              </div>

              {/* Akun Tujuan jika transfer */}
              {editTxType === "transfer" && (
                <div>
                  <label className="font-semibold text-foreground mb-1 block">
                    {isEn ? "Destination Account" : "Akun Tujuan Transfer"}
                  </label>
                  <select
                    value={editToAccountName}
                    onChange={(e) => {
                      if (e.target.value === "__NEW_ACCOUNT__") {
                        const newAcc = prompt(
                          isEn ? "Enter new destination account name:" : "Masukkan nama akun tujuan baru:"
                        );
                        if (newAcc && newAcc.trim()) {
                          setEditToAccountName(newAcc.trim());
                        }
                      } else {
                        setEditToAccountName(e.target.value);
                      }
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-2xs text-xs focus:outline-none font-medium"
                  >
                    <option value="">{isEn ? "-- Select Destination Account --" : "-- Pilih Akun Tujuan --"}</option>
                    {editToAccountName &&
                      !accounts.some((a) => a.name.toLowerCase() === editToAccountName.toLowerCase()) && (
                        <option value={editToAccountName}>+ {editToAccountName} ({isEn ? "New" : "Baru"})</option>
                      )}
                    {accounts.map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name} ({a.group || (isEn ? "Account" : "Akun")})
                      </option>
                    ))}
                    <option value="__NEW_ACCOUNT__">
                      {isEn ? "+ Create New Account..." : "+ Buat Akun Baru..."}
                    </option>
                  </select>
                </div>
              )}

              {/* Tag / Label */}
              <div>
                <label className="font-semibold text-foreground mb-1 block">
                  {isEn ? "Tags / Labels" : "Tag / Label"}
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
                  {isEn ? "Cancel" : "Batal"}
                </Button>
                <Button
                  type="submit"
                  className="text-xs font-semibold bg-primary text-white hover:bg-primary/90"
                >
                  {isEn ? "Save Changes" : "Simpan Perubahan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
