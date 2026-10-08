"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import { PiggyBank, Plus, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

export default function BudgetsPage() {
  const utils = trpc.useUtils();
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");

  const { data: ledgersList } = trpc.ledgers.list.useQuery();
  const defaultLedgerId = ledgersList?.[0]?.id || "default";

  const { data: budgetData, isLoading } = trpc.budgets.list.useQuery({
    ledgerId: defaultLedgerId,
    month: currentMonth,
  });

  const { data: categoriesList } = trpc.categories.list.useQuery({ kind: "expense" });

  const setBudgetMutation = trpc.budgets.set.useMutation({
    onSuccess: () => {
      utils.budgets.invalidate();
      setIsModalOpen(false);
      setAmount("");
      setCategoryId("");
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!num || !categoryId) return;
    setBudgetMutation.mutate({
      ledgerId: defaultLedgerId,
      categoryId,
      month: currentMonth,
      amount: num,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Anggaran Bulanan</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kendalikan pengeluaran bulanan Anda per kategori (Periode: {currentMonth}).
          </p>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary text-white gap-2 shadow-sm text-xs"
        >
          <Plus className="h-4 w-4" />
          Atur Anggaran
        </Button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Anggaran</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(budgetData?.totalBudget || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Terpakai (Aktual)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {formatCurrency(budgetData?.totalSpent || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Sisa Anggaran</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(budgetData?.totalRemaining || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budgets List with Progress Bars */}
      <div className="flex flex-col gap-3">
        {budgetData?.items?.map((item) => {
          const isOver = item.actualSpent > item.budgetAmount;

          return (
            <Card key={item.id} className="p-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">
                      {item.categoryName || "Umum"}
                    </span>
                    {isOver && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded">
                        <AlertCircle className="h-3 w-3" /> Over Budget
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-medium">
                    <span className="font-bold">{formatCurrency(item.actualSpent)}</span> /{" "}
                    <span className="text-muted-foreground">{formatCurrency(item.budgetAmount)}</span>
                  </div>
                </div>

                <Progress
                  value={item.percent}
                  indicatorColor={isOver ? "bg-rose-600" : item.percent > 80 ? "bg-amber-500" : "bg-primary"}
                  className="h-2"
                />

                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{item.percent}% terpakai</span>
                  <span>Sisa: {formatCurrency(item.remaining)}</span>
                </div>
              </div>
            </Card>
          );
        })}

        {(!budgetData?.items || budgetData.items.length === 0) && (
          <div className="p-12 text-center text-xs text-muted-foreground border rounded-xl border-dashed">
            Belum ada anggaran yang diatur untuk bulan {currentMonth}. Klik tombol{" "}
            <button onClick={() => setIsModalOpen(true)} className="text-primary underline font-medium">
              + Atur Anggaran
            </button>{" "}
            untuk mulai!
          </div>
        )}
      </div>

      {/* Modal Atur Budget */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-card border shadow-2xl p-6 text-card-foreground">
            <h2 className="text-base font-bold mb-4">Atur Anggaran Kategori</h2>
            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="font-medium text-muted-foreground">Kategori Pengeluaran</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 font-medium shadow-sm focus:outline-none"
                  required
                >
                  <option value="">Pilih Kategori...</option>
                  {categoriesList?.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-muted-foreground">Nominal Anggaran Bulanan (IDR)</label>
                <Input
                  type="number"
                  placeholder="Contoh: 1500000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 h-10"
                  required
                />
              </div>

              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-1/2"
                  onClick={() => setIsModalOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" className="w-1/2 bg-primary text-white">
                  Simpan Anggaran
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
