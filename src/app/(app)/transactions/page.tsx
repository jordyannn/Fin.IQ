/* Hallmark · macrostructure: Feed / Data-Dense · theme: Bibit-Fintech · genre: modern-minimal · pre-emit critique: P5 H5 E5 S5 R5 V5 */
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { useTranslation } from "@/i18n";
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
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
import { MonthYearPicker } from "@/components/ui/MonthYearPicker";

export default function TransactionsPage() {
  const { openQuickAdd, openQuickAddWithScan } = useUIStore();
  const utils = trpc.useUtils();
  const confirm = useConfirm();
  const alert = useAlert();
  const { t, locale, formatCurrency, formatDateTime } = useTranslation();
  const isEn = locale === "en";

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
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

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
    return computeDateRange(datePreset, currentMonth, customDateFrom, customDateTo, locale);
  }, [datePreset, currentMonth, customDateFrom, customDateTo, locale]);

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
      title: isEn ? "Delete Transaction?" : "Hapus Transaksi?",
      description: isEn
        ? "This transaction will be permanently deleted and your account balance will be adjusted automatically."
        : "Transaksi ini akan dihapus secara permanen dan saldo akun Anda akan disesuaikan otomatis.",
      confirmText: isEn ? "Delete Transaction" : "Hapus Transaksi",
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
      title: isEn ? `Delete ${selectedIds.length} Selected Transactions?` : `Hapus ${selectedIds.length} Transaksi Terpilih?`,
      description: isEn
        ? `Are you sure you want to delete ${selectedIds.length} transactions at once? This action cannot be undone.`
        : `Apakah Anda yakin ingin menghapus ${selectedIds.length} transaksi sekaligus? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: isEn ? `Delete ${selectedIds.length} Transactions` : `Hapus ${selectedIds.length} Transaksi`,
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
        title: isEn ? "No Transactions" : "Tidak Ada Transaksi",
        description: isEn
          ? "There are no transactions to export matching current filters."
          : "Tidak ada transaksi yang dapat diekspor sesuai filter saat ini.",
        variant: "info",
        icon: "info",
      });
      return;
    }

    const headers = isEn
      ? ["ID", "Time", "Type", "Amount", "Currency", "Account", "Category", "Memo"]
      : ["ID", "Waktu", "Tipe", "Nominal", "Mata Uang", "Akun", "Kategori", "Catatan"];
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
          <h1 className="text-2xl font-bold tracking-tight">{t.transactions.title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t.transactions.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar sm:flex-wrap">
          <Link href="/import" className="shrink-0">
            <Button variant="outline" size="sm" className="gap-2 text-xs rounded-md">
              <GeometricIcon name="import" size="xs" active />
              {t.nav.importData}
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2 text-xs rounded-md shrink-0">
              <GeometricIcon name="ledgers" size="xs" active />
            {t.transactions.exportCsv}
          </Button>
          <Button
            variant="chip"
            size="sm"
            onClick={openQuickAddWithScan}
            className="gap-2 text-xs rounded-md shrink-0"
          >
            <GeometricIcon name="ai" size="xs" active />
            {isEn ? "Scan Receipt" : "Scan Struk"}
          </Button>
          <Button size="sm" onClick={openQuickAdd} className="bg-primary hover:bg-[#047857] text-white gap-2 text-xs shadow-xs rounded-md font-bold shrink-0">
            <Plus className="h-4 w-4 stroke-[3px]" />
            {t.transactions.addTransaction}
          </Button>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <Card className="p-4 space-y-3.5 rounded-2xl border-border/80 shadow-2xs">
        {/* Row 1: Search & Type Pills */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t.transactions.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8 text-xs h-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
                title={isEn ? "Clear search" : "Hapus pencarian"}
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
              {t.common.all}
            </button>
            <button
              onClick={() => setSelectedType("expense")}
              className={`px-3 py-1 rounded-md font-medium transition-all whitespace-nowrap ${
                selectedType === "expense"
                  ? "bg-rose-600 text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.common.expense}
            </button>
            <button
              onClick={() => setSelectedType("income")}
              className={`px-3 py-1 rounded-md font-medium transition-all whitespace-nowrap ${
                selectedType === "income"
                  ? "bg-emerald-600 text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.common.income}
            </button>
            <button
              onClick={() => setSelectedType("transfer")}
              className={`px-3 py-1 rounded-md font-medium transition-all whitespace-nowrap ${
                selectedType === "transfer"
                  ? "bg-blue-600 text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.common.transfer}
            </button>
          </div>
        </div>

        {/* Row 2: Deep Filters (Waktu, Buku Kas, Akun, Kategori, Reset) */}
        <div className="flex items-center gap-2 pt-1 text-xs overflow-x-auto no-scrollbar pb-1 w-full">
          {/* Preset Waktu & Tombol Kalender Interaktif */}
          <div className="relative flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsMonthPickerOpen((prev) => !prev)}
              className={`h-8 w-8 rounded-md border flex items-center justify-center transition-all shadow-2xs shrink-0 ${
                isMonthPickerOpen
                  ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 active:scale-95 cursor-pointer"
              }`}
              title={isEn ? "Open Month & Calendar Picker" : "Buka Pemilih Bulan & Kalender Langsung"}
              aria-label={isEn ? "Select Calendar Month" : "Pilih Bulan Kalender"}
            >
              <Calendar className="h-3.5 w-3.5" />
            </button>
            <select
              value={datePreset}
              onChange={(e) => {
                setDatePreset(e.target.value as DateFilterPreset);
                setIsMonthPickerOpen(false);
              }}
              className="h-8 rounded-md border border-border bg-card pl-2.5 pr-8 text-xs font-semibold shadow-2xs transition-all hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground shrink-0"
            >
              <option value="this_month">{t.dateFilter.thisMonth}</option>
              <option value="today">{t.dateFilter.today}</option>
              <option value="last_7_days">{t.dateFilter.last7Days}</option>
              <option value="last_30_days">{t.dateFilter.last30Days}</option>
              <option value="last_month">{t.dateFilter.lastMonth}</option>
              <option value="this_year">{t.dateFilter.thisYear}</option>
              <option value="all">{t.dateFilter.all}</option>
              <option value="custom">{t.dateFilter.custom}</option>
            </select>

            {/* MonthYearPicker Dropdown saat preset BUKAN this_month tapi tombol kalender diklik */}
            {datePreset !== "this_month" && isMonthPickerOpen && (
              <MonthYearPicker
                currentDate={currentMonth}
                onSelectMonth={(newDate) => {
                  setCurrentMonth(newDate);
                  setDatePreset("this_month");
                }}
                isOpen={isMonthPickerOpen}
                onClose={() => setIsMonthPickerOpen(false)}
                align="left"
              />
            )}
          </div>

          {/* Month Switcher (when this_month is selected) */}
          {datePreset === "this_month" && (
            <div className="relative flex items-center gap-1 rounded-md border border-input bg-background/80 px-1 py-0.5 shrink-0 shadow-2xs">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={handlePrevMonth}
                title={isEn ? "Previous month" : "Bulan sebelumnya"}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>

              {/* Direct Month Selector Trigger Button */}
              <button
                type="button"
                onClick={() => setIsMonthPickerOpen((prev) => !prev)}
                className="flex items-center gap-1 px-2 py-0.5 text-xs font-bold capitalize rounded-sm hover:bg-primary/10 hover:text-primary transition-all text-foreground select-none group cursor-pointer"
                title={isEn ? "Click to directly select month from calendar" : "Klik untuk memilih bulan secara langsung dari kalender"}
              >
                <CalendarDays className="h-3 w-3 text-primary group-hover:scale-105 transition-transform" />
                <span className="min-w-[80px] text-center">{periodLabel}</span>
                <ChevronDown className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>

              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={handleNextMonth}
                title={isEn ? "Next month" : "Bulan berikutnya"}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>

              {!isCurrentMonthNow && (
                <button
                  onClick={handleResetMonth}
                  className="px-1.5 py-0.5 text-[10px] font-medium text-primary hover:underline border-l border-border/60 pl-2 cursor-pointer whitespace-nowrap"
                  title={isEn ? "Back to current month" : "Kembali ke bulan saat ini"}
                >
                  {isEn ? "This Month" : "Bulan Ini"}
                </button>
              )}

              {/* Popover Kalender Pemilih Bulan & Tahun */}
              <MonthYearPicker
                currentDate={currentMonth}
                onSelectMonth={(newDate) => {
                  setCurrentMonth(newDate);
                  setDatePreset("this_month");
                }}
                isOpen={isMonthPickerOpen}
                onClose={() => setIsMonthPickerOpen(false)}
                align="left"
              />
            </div>
          )}

          {/* Custom Date Pickers */}
          {datePreset === "custom" && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                className="h-8 text-xs w-32 px-2"
                placeholder={isEn ? "From" : "Dari"}
              />
              <span className="text-muted-foreground text-[11px]">-</span>
              <Input
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
                className="h-8 text-xs w-32 px-2"
                placeholder={isEn ? "To" : "Sampai"}
              />
            </div>
          )}

          {/* Ledger / Buku Kas Selector */}
          {ledgersData && ledgersData.length > 0 && (
            <select
              value={selectedLedgerId || ""}
              onChange={(e) => setSelectedLedgerId(e.target.value || undefined)}
              className="h-8 rounded-md border border-border bg-card pl-2.5 pr-8 text-xs font-semibold shadow-2xs transition-all hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground shrink-0"
            >
              <option value="">{isEn ? "All Ledgers" : "Semua Buku Kas"}</option>
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
            className="h-8 rounded-md border border-border bg-card pl-2.5 pr-8 text-xs font-semibold shadow-2xs transition-all hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground shrink-0"
          >
            <option value="">{isEn ? "All Accounts" : "Semua Akun"}</option>
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
            className="h-8 rounded-md border border-border bg-card pl-2.5 pr-8 text-xs font-semibold shadow-2xs transition-all hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground shrink-0"
          >
            <option value="">{isEn ? "All Categories" : "Semua Kategori"}</option>
            <option value="uncategorized">{isEn ? "Uncategorized" : "Belum Berkategori"}</option>
            {expenseCategories.length > 0 && (
              <optgroup label={isEn ? "Expense" : "Pengeluaran"}>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
            {incomeCategories.length > 0 && (
              <optgroup label={isEn ? "Income" : "Pemasukan"}>
                {incomeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {/* Refresh & Reset Button */}
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
              title={isEn ? "Refresh data" : "Perbarui data"}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>

            {isAnyFilterActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetAllFilters}
                className="h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 gap-1.5 px-2.5 shrink-0"
                title={isEn ? "Reset all filters to default" : "Reset semua filter ke default"}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {isEn ? "Reset Filters" : "Reset Filter"}
              </Button>
            )}
          </div>
        </div>

        {/* Row 3: Info Jumlah Transaksi & Rentang Waktu */}
        <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-semibold text-[11px] bg-background">
              {summary.count} {isEn ? "Transactions" : "Transaksi"}
            </Badge>
            <span className="text-muted-foreground text-[11px]">
              {isEn ? "Range:" : "Rentang:"} <span className="font-medium text-foreground">{periodLabel}</span>
            </span>
          </div>
        </div>

        {/* Batch selection bar */}
        {selectedIds.length > 0 && (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2 border border-primary/20 text-xs">
            <span className="font-semibold text-primary">
              {selectedIds.length} {isEn ? "transactions selected" : "transaksi terpilih"}
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBatchDelete}
              className="h-7 text-xs gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isEn ? "Delete Selected" : "Hapus Terpilih"}
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
            <span>{isEn ? "Select All" : "Pilih Semua"} ({txData?.items?.length || 0})</span>
          </label>
          <span>{txData?.items?.length || 0} {isEn ? "Transactions" : "Transaksi"}</span>
        </div>

        {txData?.items?.map((tx) => {
          const isSelected = selectedIds.includes(tx.id);
          const isExpense = tx.txType === "expense";
          const isIncome = tx.txType === "income";

          return (
            <Card
              key={tx.id}
              className={`p-3.5 rounded-2xl transition-all border-border/80 shadow-2xs ${
                isSelected ? "border-primary bg-primary/5" : "bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectOne(tx.id)}
                    className="rounded border-input h-4 w-4 text-primary focus:ring-primary mt-1.5 cursor-pointer"
                  />
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isIncome
                        ? "bg-secondary text-secondary-foreground"
                        : isExpense
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {isIncome && <TrendingUp className="h-4 w-4" />}
                    {isExpense && <TrendingDown className="h-4 w-4" />}
                    {!isIncome && !isExpense && <ArrowUpDown className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs sm:text-sm text-foreground truncate">
                      {tx.note || tx.categoryName || (isEn ? "Transaction" : "Transaksi")}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
                      <span>{tx.categoryName || (isEn ? "General" : "Umum")}</span>
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
                    className={`font-black text-sm font-mono tabular-nums ${
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
                  <div className="flex items-center gap-1 mt-0.5">
                    <button
                      onClick={() => setEditingTx(tx as any)}
                      aria-label={isEn ? "Edit Transaction" : "Edit Transaksi"}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted active:scale-95 transition-all cursor-pointer"
                      title={isEn ? "Edit Transaction" : "Edit Transaksi"}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      aria-label={isEn ? "Delete Transaction" : "Hapus Transaksi"}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 active:scale-95 transition-all cursor-pointer"
                      title={isEn ? "Delete Transaction" : "Hapus Transaksi"}
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
            <span>{isLoading ? (isEn ? "Loading transactions..." : "Memuat transaksi...") : (isEn ? "No transactions match the filter." : "Tidak ada transaksi yang cocok dengan filter.")}</span>
            {!isLoading && isAnyFilterActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetAllFilters}
                className="h-7 text-xs gap-1.5 text-rose-500 hover:text-rose-600 rounded-sm"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {isEn ? "Reset All Filters" : "Reset Semua Filter"}
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
                <th className="p-3">{isEn ? "Time" : "Waktu"}</th>
                <th className="p-3">{isEn ? "Category & Memo" : "Kategori & Catatan"}</th>
                <th className="p-3">{isEn ? "Account" : "Akun"}</th>
                <th className="p-3 text-right">{isEn ? "Amount" : "Nominal"}</th>
                <th className="p-3 text-center">{isEn ? "Type" : "Tipe"}</th>
                <th className="p-3 text-center w-16">{isEn ? "Actions" : "Aksi"}</th>
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
                        {tx.note || (isEn ? "No memo" : "Tanpa catatan")}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {tx.categoryName || (isEn ? "General" : "Umum")}
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
                          title={isEn ? "Edit Transaction" : "Edit Transaksi"}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                          title={isEn ? "Delete Transaction" : "Hapus Transaksi"}
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
                      <span>{isLoading ? (isEn ? "Loading transactions..." : "Memuat transaksi...") : (isEn ? "No transactions match." : "Tidak ada transaksi yang cocok.")}</span>
                      {!isLoading && isAnyFilterActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleResetAllFilters}
                          className="h-7 text-xs gap-1.5 text-rose-500 hover:text-rose-600"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {isEn ? "Reset Filters" : "Reset Filter"}
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
