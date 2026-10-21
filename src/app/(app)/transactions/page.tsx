/* Hallmark · macrostructure: Feed / Data-Dense · theme: Bibit-Fintech · genre: modern-minimal · pre-emit critique: P5 H5 E5 S5 R5 V5 */
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useUIStore } from "@/store/ui.store";
import {
  Search,
  Plus,
  Download,
  UploadCloud,
  Trash2,
  Filter,
  ArrowUpDown,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Pencil,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  RotateCcw,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { GeometricIcon } from "@/components/ui/GeometricIcon";
import { EditTransactionModal, type TransactionToEdit } from "@/components/transactions/EditTransactionModal";
import { DateFilterPreset, computeDateRange } from "@/lib/date-filters";
import { useConfirm, useAlert } from "@/store/confirm.store";

export default function TransactionsPage() {
  const { openQuickAdd, openQuickAddWithScan } = useUIStore();
  const utils = trpc.useUtils();
  const confirm = useConfirm();
  const alert = useAlert();

  // Filters state
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<"expense" | "income" | "transfer" | undefined>(undefined);
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | undefined>(undefined);

  // Date Filter state
  const [datePreset, setDatePreset] = useState<DateFilterPreset>("this_month");
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [customDateFrom, setCustomDateFrom] = useState<string>("");
  const [customDateTo, setCustomDateTo] = useState<string>("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingTx, setEditingTx] = useState<TransactionToEdit | null>(null);

  // Queries
  const { data: accountsData } = trpc.accounts.list.useQuery();
  const { data: categoriesData } = trpc.categories.list.useQuery();
  const { data: ledgersData } = trpc.ledgers.list.useQuery();

  const expenseCategories = useMemo(
    () => categoriesData?.filter((c) => c.kind === "expense") || [],
    [categoriesData]
  );
  const incomeCategories = useMemo(
    () => categoriesData?.filter((c) => c.kind === "income") || [],
    [categoriesData]
  );

  // Date calculation
  const { dateFrom, dateTo, periodLabel } = useMemo(() => {
    return computeDateRange(datePreset, currentMonth, customDateFrom, customDateTo);
  }, [datePreset, currentMonth, customDateFrom, customDateTo]);

  // Main Transaction Query with all filters
  const { data: txData, isLoading, refetch } = trpc.transactions.list.useQuery({
    search: search.trim() || undefined,
    txType: selectedType,
    accountId: selectedAccountId || undefined,
    categoryId: selectedCategoryId || undefined,
    ledgerId: selectedLedgerId || undefined,
    dateFrom,
    dateTo,
    limit: 100,
  });

  // Summary computed from backend aggregate query (or fallback to items)
  const summary = useMemo(() => {
    if (txData?.summary) {
      return {
        count: txData.summary.totalCount,
        income: txData.summary.income,
        expense: txData.summary.expense,
        net: txData.summary.net,
      };
    }

    let income = 0;
    let expense = 0;

    for (const item of txData?.items || []) {
      if (item.txType === "income") income += item.amount;
      if (item.txType === "expense") expense += item.amount;
    }

    return {
      count: txData?.items?.length || 0,
      income,
      expense,
      net: income - expense,
    };
  }, [txData?.summary, txData?.items]);

  const isCurrentMonthNow =
    currentMonth.getMonth() === new Date().getMonth() &&
    currentMonth.getFullYear() === new Date().getFullYear();

  const isAnyFilterActive =
    Boolean(search.trim()) ||
    selectedType !== undefined ||
    Boolean(selectedAccountId) ||
    Boolean(selectedCategoryId) ||
    Boolean(selectedLedgerId) ||
    datePreset !== "this_month" ||
    !isCurrentMonthNow ||
    Boolean(customDateFrom) ||
    Boolean(customDateTo);

  const handleResetAllFilters = () => {
    setSearch("");
    setSelectedType(undefined);
    setSelectedAccountId(undefined);
    setSelectedCategoryId(undefined);
    setSelectedLedgerId(undefined);
    setDatePreset("this_month");
    setCustomDateFrom("");
    setCustomDateTo("");
    setCurrentMonth(new Date());
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  const handleResetMonth = () => {
    setCurrentMonth(new Date());
  };

  // Mutations
  const deleteMutation = trpc.transactions.delete.useMutation({
    onSuccess: () => {
      utils.transactions.invalidate();
      utils.accounts.invalidate();
      utils.analytics.invalidate();
    },
  });

  const batchDeleteMutation = trpc.transactions.batchDelete.useMutation({
    onSuccess: () => {
      setSelectedIds([]);
      utils.transactions.invalidate();
      utils.accounts.invalidate();
      utils.analytics.invalidate();
    },
  });

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Hapus Transaksi?",
      description: "Transaksi ini akan dihapus secara permanen dan saldo akun Anda akan disesuaikan otomatis.",
      confirmText: "Hapus Transaksi",
      variant: "destructive",
      icon: "trash",
    });
    if (ok) {
      deleteMutation.mutate({ id });
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    const ok = await confirm({
      title: `Hapus ${selectedIds.length} Transaksi Terpilih?`,
      description: `Apakah Anda yakin ingin menghapus ${selectedIds.length} transaksi sekaligus? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: `Hapus ${selectedIds.length} Transaksi`,
      variant: "destructive",
      icon: "trash",
    });
    if (ok) {
      batchDeleteMutation.mutate({ ids: selectedIds });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && txData?.items) {
      setSelectedIds(txData.items.map((t) => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Export CSV generator
  const handleExportCSV = () => {
    if (!txData?.items || txData.items.length === 0) {
      alert({
        title: "Tidak Ada Transaksi",
        description: "Tidak ada transaksi yang dapat diekspor sesuai filter saat ini.",
        variant: "info",
        icon: "info",
      });
      return;
    }

    const headers = ["ID", "Waktu", "Tipe", "Nominal", "Mata Uang", "Akun", "Kategori", "Catatan"];
    const rows = txData.items.map((tx) => [
      tx.id,
      new Date(tx.happenedAt).toISOString(),
      tx.txType,
      tx.amount,
      tx.currency,
      tx.accountName || "",
      tx.categoryName || "",
      `"${(tx.note || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `finiq_transaksi_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Title & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Riwayat Transaksi</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daftar pencatatan mutasi kas, perbankan, dan e-wallet dengan filter multi-akun.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/import">
            <Button variant="outline" size="sm" className="gap-2 text-xs rounded-md">
              <GeometricIcon name="import" size="xs" active />
              Impor CSV / Excel
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2 text-xs rounded-md">
            <GeometricIcon name="ledgers" size="xs" active />
            Ekspor CSV
          </Button>
          <Button
            variant="chip"
            size="sm"
            onClick={openQuickAddWithScan}
            className="gap-2 text-xs rounded-md"
          >
            <GeometricIcon name="ai" size="xs" active />
            Scan Struk / Bill
          </Button>
          <Button size="sm" onClick={openQuickAdd} className="bg-primary hover:bg-[#047857] text-white gap-2 text-xs shadow-xs rounded-md font-bold">
            <Plus className="h-4 w-4 stroke-[3px]" />
            Catat Transaksi
          </Button>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <Card className="p-4 space-y-3.5 shadow-sm">
        {/* Row 1: Search & Type Pills */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari catatan, merchant, keterangan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8 text-xs h-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
                title="Hapus pencarian"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Tipe Selector Pills */}
          <div className="flex items-center rounded-md bg-muted/60 p-1 text-xs self-start md:self-auto overflow-x-auto max-w-full">
            <button
              onClick={() => setSelectedType(undefined)}
              className={`px-3 py-1 rounded-md font-medium transition-all whitespace-nowrap ${
                selectedType === undefined
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setSelectedType("expense")}
              className={`px-3 py-1 rounded-md font-medium transition-all whitespace-nowrap ${
                selectedType === "expense"
                  ? "bg-rose-600 text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pengeluaran
            </button>
            <button
              onClick={() => setSelectedType("income")}
              className={`px-3 py-1 rounded-md font-medium transition-all whitespace-nowrap ${
                selectedType === "income"
                  ? "bg-emerald-600 text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pemasukan
            </button>
            <button
              onClick={() => setSelectedType("transfer")}
              className={`px-3 py-1 rounded-md font-medium transition-all whitespace-nowrap ${
                selectedType === "transfer"
                  ? "bg-blue-600 text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Transfer
            </button>
          </div>
        </div>

        {/* Row 2: Deep Filters (Waktu, Buku Kas, Akun, Kategori, Reset) */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          {/* Preset Waktu */}
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DateFilterPreset)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium shadow-sm focus:outline-none"
            >
              <option value="this_month">Bulan Ini</option>
              <option value="today">Hari Ini</option>
              <option value="last_7_days">7 Hari Terakhir</option>
              <option value="last_30_days">30 Hari Terakhir</option>
              <option value="last_month">Bulan Lalu</option>
              <option value="this_year">Tahun Ini</option>
              <option value="all">Semua Waktu</option>
              <option value="custom">Kustom Tanggal</option>
            </select>
          </div>

          {/* Month Switcher (when this_month is selected) */}
          {datePreset === "this_month" && (
            <div className="flex items-center gap-1 rounded-md border border-input bg-background/80 px-1 py-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={handlePrevMonth}
                title="Bulan sebelumnya"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-1.5 text-xs font-semibold capitalize min-w-[90px] text-center select-none">
                {periodLabel}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={handleNextMonth}
                title="Bulan berikutnya"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              {!isCurrentMonthNow && (
                <button
                  onClick={handleResetMonth}
                  className="px-1.5 py-0.5 text-[10px] font-medium text-primary hover:underline"
                  title="Kembali ke bulan saat ini"
                >
                  Bulan Ini
                </button>
              )}
            </div>
          )}

          {/* Custom Date Pickers */}
          {datePreset === "custom" && (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                className="h-8 text-xs w-32 px-2"
                placeholder="Dari"
              />
              <span className="text-muted-foreground text-[11px]">-</span>
              <Input
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
                className="h-8 text-xs w-32 px-2"
                placeholder="Sampai"
              />
            </div>
          )}

          {/* Ledger / Buku Kas Selector */}
          {ledgersData && ledgersData.length > 0 && (
            <select
              value={selectedLedgerId || ""}
              onChange={(e) => setSelectedLedgerId(e.target.value || undefined)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium shadow-sm focus:outline-none"
            >
              <option value="">Semua Buku Kas</option>
              {ledgersData.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}

          {/* Account Selector */}
          <select
            value={selectedAccountId || ""}
            onChange={(e) => setSelectedAccountId(e.target.value || undefined)}
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium shadow-sm focus:outline-none"
          >
            <option value="">Semua Akun</option>
            {accountsData?.accounts?.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name.toUpperCase()}
              </option>
            ))}
          </select>

          {/* Category Selector */}
          <select
            value={selectedCategoryId || ""}
            onChange={(e) => setSelectedCategoryId(e.target.value || undefined)}
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium shadow-sm focus:outline-none"
          >
            <option value="">Semua Kategori</option>
            <option value="uncategorized">Belum Berkategori</option>
            {expenseCategories.length > 0 && (
              <optgroup label="Pengeluaran">
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
            {incomeCategories.length > 0 && (
              <optgroup label="Pemasukan">
                {incomeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {/* Refresh & Reset Button */}
          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Perbarui data"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>

            {isAnyFilterActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetAllFilters}
                className="h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 gap-1.5 px-2.5"
                title="Reset semua filter ke default"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Filter
              </Button>
            )}
          </div>
        </div>

        {/* Row 3: Summary KPI / Ringkasan Arus Kas */}
        <div className="pt-2.5 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-semibold text-[11px] bg-background">
              {summary.count} Transaksi
            </Badge>
            <span className="text-muted-foreground text-[11px]">
              Rentang: <span className="font-medium text-foreground">{periodLabel}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-medium text-[11px] sm:text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <GeometricIcon name="trend-up" size="xs" active />
              <span>Masuk:</span>
              <span className="font-bold">+{formatCurrency(summary.income)}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <GeometricIcon name="trend-down" size="xs" active />
              <span>Keluar:</span>
              <span className="font-bold">-{formatCurrency(summary.expense)}</span>
            </div>
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm font-bold border ${
                summary.net >= 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
              }`}
            >
              <GeometricIcon name="sparkles" size="xs" active />
              <span>Arus Kas:</span>
              <span>
                {summary.net > 0 ? "+" : ""}
                {formatCurrency(summary.net)}
              </span>
            </div>
          </div>
        </div>

        {/* Batch selection bar */}
        {selectedIds.length > 0 && (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2 border border-primary/20 text-xs">
            <span className="font-semibold text-primary">
              {selectedIds.length} transaksi terpilih
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBatchDelete}
              className="h-7 text-xs gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Hapus Terpilih
            </Button>
          </div>
        )}
      </Card>

      {/* Mobile Transactions Feed (< md) */}
      <div className="block md:hidden space-y-2.5">
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <label className="flex items-center gap-2 cursor-pointer font-medium">
            <input
              type="checkbox"
              checked={
                !!txData?.items?.length &&
                selectedIds.length === txData.items.length
              }
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="rounded border-input h-4 w-4 text-primary focus:ring-primary"
            />
            <span>Pilih Semua ({txData?.items?.length || 0})</span>
          </label>
          <span>{txData?.items?.length || 0} Transaksi</span>
        </div>

        {txData?.items?.map((tx) => {
          const isSelected = selectedIds.includes(tx.id);
          const isExpense = tx.txType === "expense";
          const isIncome = tx.txType === "income";

          return (
            <Card
              key={tx.id}
              className={`p-3 rounded-md transition-all border-border/70 shadow-2xs ${
                isSelected ? "border-primary bg-primary/5" : "bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectOne(tx.id)}
                    className="rounded-xs border-input h-3.5 w-3.5 text-primary focus:ring-primary mt-1"
                  />
                  <div
                    className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${
                      isIncome
                        ? "bg-emerald-500/15 text-emerald-600"
                        : isExpense
                        ? "bg-rose-500/15 text-rose-600"
                        : "bg-blue-500/15 text-blue-600"
                    }`}
                  >
                    {isIncome && <TrendingUp className="h-4 w-4" />}
                    {isExpense && <TrendingDown className="h-4 w-4" />}
                    {!isIncome && !isExpense && <ArrowUpDown className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-foreground truncate">
                      {tx.note || tx.categoryName || "Transaksi"}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <span>{tx.categoryName || "Umum"}</span>
                      <span>•</span>
                      <span className="font-semibold uppercase text-foreground/80">{tx.accountName || "-"}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {formatDateTime(tx.happenedAt)}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <span
                    className={`font-black text-xs sm:text-sm ${
                      isExpense
                        ? "text-foreground"
                        : isIncome
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {isExpense && "- "}
                    {isIncome && "+ "}
                    {formatCurrency(tx.amount, tx.currency)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingTx(tx as any)}
                      className="p-1 rounded-sm text-muted-foreground hover:text-[#059669] hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
                      title="Edit Transaksi"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="p-1 rounded-sm text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                      title="Hapus Transaksi"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}

        {(!txData?.items || txData.items.length === 0) && (
          <Card className="p-8 text-center text-xs text-muted-foreground rounded-md flex flex-col items-center justify-center gap-2.5">
            <span>{isLoading ? "Memuat transaksi..." : "Tidak ada transaksi yang cocok dengan filter."}</span>
            {!isLoading && isAnyFilterActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetAllFilters}
                className="h-7 text-xs gap-1.5 text-rose-500 hover:text-rose-600 rounded-sm"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Semua Filter
              </Button>
            )}
          </Card>
        )}
      </div>

      {/* Desktop Transactions Table (>= md) */}
      <Card className="hidden md:block overflow-hidden rounded-md border-border/70 shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-muted/50 font-semibold text-muted-foreground">
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      !!txData?.items?.length &&
                      selectedIds.length === txData.items.length
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-input"
                  />
                </th>
                <th className="p-3">Waktu</th>
                <th className="p-3">Kategori & Catatan</th>
                <th className="p-3">Akun</th>
                <th className="p-3 text-right">Nominal</th>
                <th className="p-3 text-center">Tipe</th>
                <th className="p-3 text-center w-16">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {txData?.items?.map((tx) => {
                const isSelected = selectedIds.includes(tx.id);
                const isExpense = tx.txType === "expense";
                const isIncome = tx.txType === "income";

                return (
                  <tr
                    key={tx.id}
                    className={`hover:bg-muted/30 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                  >
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(tx.id)}
                        className="rounded border-input"
                      />
                    </td>
                    <td className="p-3 whitespace-nowrap text-muted-foreground">
                      {formatDateTime(tx.happenedAt)}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-foreground">
                        {tx.note || "Tanpa catatan"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {tx.categoryName || "Umum"}
                      </div>
                    </td>
                    <td className="p-3 font-semibold uppercase text-foreground">
                      {tx.accountName || "-"}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap font-bold">
                      <span
                        className={
                          isExpense
                            ? "text-rose-600 dark:text-rose-400"
                            : isIncome
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-blue-600 dark:text-blue-400"
                        }
                      >
                        {isExpense && "- "}
                        {isIncome && "+ "}
                        {formatCurrency(tx.amount, tx.currency)}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={tx.txType as any} className="text-[9px] uppercase px-1.5 py-0">
                        {tx.txType}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditingTx(tx as any)}
                          className="p-1 rounded text-muted-foreground hover:text-[#059669] hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
                          title="Edit Transaksi"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                          title="Hapus Transaksi"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {(!txData?.items || txData.items.length === 0) && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <span>{isLoading ? "Memuat transaksi..." : "Tidak ada transaksi yang cocok dengan filter."}</span>
                      {!isLoading && isAnyFilterActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleResetAllFilters}
                          className="h-7 text-xs gap-1.5 text-rose-500 hover:text-rose-600"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reset Semua Filter
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {/* Edit Transaction Modal */}
      <EditTransactionModal
        isOpen={!!editingTx}
        onClose={() => setEditingTx(null)}
        transaction={editingTx}
      />
    </div>
  );
}
