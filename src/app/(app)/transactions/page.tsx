"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EditTransactionModal, type TransactionToEdit } from "@/components/transactions/EditTransactionModal";

export default function TransactionsPage() {
  const { openQuickAdd } = useUIStore();
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<"expense" | "income" | "transfer" | undefined>(undefined);
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingTx, setEditingTx] = useState<TransactionToEdit | null>(null);

  // Queries
  const { data: accountsData } = trpc.accounts.list.useQuery();
  const { data: txData, isLoading, refetch } = trpc.transactions.list.useQuery({
    search: search.trim() || undefined,
    txType: selectedType,
    accountId: selectedAccountId || undefined,
    limit: 100,
  });

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

  const handleDelete = (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus transaksi ini?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Hapus ${selectedIds.length} transaksi yang dipilih?`)) {
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
      alert("Tidak ada transaksi untuk diekspor.");
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
          <h1 className="text-2xl font-bold tracking-tight">Daftar Transaksi</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Semua riwayat mutasi keuangan, filter multi-akun, dan ekspor data.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/import">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <UploadCloud className="h-3.5 w-3.5" />
              Impor CSV / Excel
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            Ekspor CSV
          </Button>
          <Button size="sm" onClick={openQuickAdd} className="bg-primary text-white gap-1.5 text-xs shadow-sm">
            <Plus className="h-3.5 w-3.5" />
            Catat Transaksi
          </Button>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari catatan transaksi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Tipe Selector */}
            <div className="flex items-center rounded-lg bg-muted p-1 text-xs">
              <button
                onClick={() => setSelectedType(undefined)}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  selectedType === undefined ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setSelectedType("expense")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  selectedType === "expense" ? "bg-rose-600 text-white shadow-sm" : "text-muted-foreground"
                }`}
              >
                Pengeluaran
              </button>
              <button
                onClick={() => setSelectedType("income")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  selectedType === "income" ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground"
                }`}
              >
                Pemasukan
              </button>
              <button
                onClick={() => setSelectedType("transfer")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  selectedType === "transfer" ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground"
                }`}
              >
                Transfer
              </button>
            </div>

            {/* Account Selector */}
            <select
              value={selectedAccountId || ""}
              onChange={(e) => setSelectedAccountId(e.target.value || undefined)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-medium shadow-sm focus:outline-none"
            >
              <option value="">Semua Akun (Cash, Blu, Dana)</option>
              {accountsData?.accounts?.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name.toUpperCase()}
                </option>
              ))}
            </select>

            <Button variant="ghost" size="icon" onClick={() => refetch()} className="h-9 w-9 text-muted-foreground">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Batch selection bar */}
        {selectedIds.length > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2 border border-primary/20 text-xs">
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
              className={`p-3.5 rounded-2xl transition-all border-border/70 ${
                isSelected ? "border-primary bg-primary/5" : "bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectOne(tx.id)}
                    className="rounded border-input h-4 w-4 text-primary focus:ring-primary mt-1"
                  />
                  <div
                    className={`h-9 w-9 rounded-2xl flex items-center justify-center shrink-0 ${
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
                      className="p-1 rounded-lg text-muted-foreground hover:text-[#00B569] hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
                      title="Edit Transaksi"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="p-1 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
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
          <Card className="p-8 text-center text-xs text-muted-foreground rounded-2xl">
            {isLoading ? "Memuat transaksi..." : "Tidak ada transaksi yang cocok dengan filter."}
          </Card>
        )}
      </div>

      {/* Desktop Transactions Table (>= md) */}
      <Card className="hidden md:block overflow-hidden rounded-2xl border-border/70">
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
                          className="p-1 rounded text-muted-foreground hover:text-[#00B569] hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
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
                    {isLoading ? "Memuat transaksi..." : "Tidak ada transaksi yang cocok dengan filter."}
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
