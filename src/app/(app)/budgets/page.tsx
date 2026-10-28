"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronRight as ChevronRightIcon } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import { GeometricIcon } from "@/components/ui/GeometricIcon";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { CategorySelect } from "@/components/transactions/CategorySelect";

export default function BudgetsPage() {
  const utils = trpc.useUtils();
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");

  const { data: ledgersList } = trpc.ledgers.list.useQuery();
  const defaultLedgerId = ledgersList?.[0]?.id || "default";

  const { data: accountsData } = trpc.accounts.list.useQuery();

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
    <div className="flex flex-col gap-5 max-w-5xl mx-auto pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-[#A7F3D0]/40 flex items-center justify-center text-[#064E3B] shrink-0">
              <GeometricIcon name="budgets" className="h-4 w-4" />
            </div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-foreground">Perencanaan &amp; Anggaran</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Alokasi pagu dan plafon pengeluaran per kategori untuk periode {currentMonth}.
          </p>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary hover:bg-[#047857] text-white gap-2 shadow-xs text-xs rounded-xl font-bold h-10 px-4 active:scale-95 transition-all self-start sm:self-auto cursor-pointer"
        >
          <GeometricIcon name="plus" className="h-3.5 w-3.5" />
          <span>Pasang Batas Baru</span>
        </Button>
      </div>

      {/* Wireframe Screen 2: Dompet & Rekening Carousel */}
      {accountsData?.accounts && accountsData.accounts.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
                Dompet &amp; Rekening
              </span>
              <p className="text-[11px] text-muted-foreground">
                {accountsData.accounts.filter((a) => !a.isHidden).length} Rekening Aktif
              </p>
            </div>
            <Link
              href="/accounts"
              className="text-xs text-primary font-bold hover:underline flex items-center gap-1 active:scale-95"
            >
              <span>Lihat Semua</span>
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory py-1 -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
            {accountsData.accounts.filter((a) => !a.isHidden).map((acc) => (
              <Link
                key={acc.id}
                href="/accounts"
                className="flex flex-col justify-between p-3.5 rounded-2xl border border-border/80 bg-card shadow-2xs hover:border-primary/40 transition-all min-w-[140px] w-[150px] sm:w-[170px] shrink-0 snap-start active:scale-98"
              >
                <div className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center text-secondary-foreground mb-2">
                  <GeometricIcon name="accounts" size="xs" active />
                </div>
                <div>
                  <div className="font-black text-sm sm:text-base text-foreground tracking-tight">
                    {formatCurrency(acc.balance, acc.currency)}
                  </div>
                  <div className="text-[11px] font-semibold text-muted-foreground capitalize truncate mt-0.5">
                    {acc.name}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Total Plafon Anggaran</span>
            <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <GeometricIcon name="budgets" className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-2">
            {formatCurrency(budgetData?.totalBudget || 0)}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Target pagu belanja periode ini
          </span>
        </Card>

        <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Realisasi Belanja</span>
            <div className="h-8 w-8 rounded-xl bg-[#BA1A1A]/10 flex items-center justify-center text-[#BA1A1A]">
              <GeometricIcon name="trend-down" className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-[#BA1A1A] mt-2">
            {formatCurrency(budgetData?.totalSpent || 0)}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Akumulasi transaksi keluar tercatat
          </span>
        </Card>

        <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Sisa Alokasi Kas</span>
            <div className="h-8 w-8 rounded-xl bg-[#A7F3D0]/40 flex items-center justify-center text-[#064E3B]">
              <GeometricIcon name="trend-up" className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-[#059669] mt-2">
            {formatCurrency(budgetData?.totalRemaining || 0)}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            Dana yang masih aman dibelanjakan
          </span>
        </Card>
      </div>

      {/* Wireframe Screen 2: Budgets Header & List */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between pt-1">
          <div>
            <h2 className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
              Batas Anggaran Kategori
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Progres realisasi belanja terhadap plafon
            </p>
          </div>
          <Button
            onClick={() => setIsModalOpen(true)}
            size="sm"
            className="bg-primary hover:bg-[#047857] text-white gap-1.5 shadow-xs text-xs rounded-xl font-bold h-9 px-3 active:scale-95 transition-all cursor-pointer"
          >
            <GeometricIcon name="plus" className="h-3 w-3" />
            <span>+ Tambah</span>
          </Button>
        </div>
        {budgetData?.items?.map((item) => {
          const isOver = item.actualSpent > item.budgetAmount;

          return (
            <Card key={item.id} className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs transition-all hover:border-[#059669]/40">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                      {item.categoryName?.slice(0, 2).toUpperCase() || "UM"}
                    </div>
                    <span className="font-bold text-sm text-foreground">
                      {item.categoryName || "Umum"}
                    </span>
                    {isOver && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#BA1A1A] bg-[#BA1A1A]/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                        Melewati Plafon
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-foreground text-right">
                    <span className="font-bold text-foreground">{formatCurrency(item.actualSpent)}</span>
                    <span className="text-muted-foreground font-normal"> / {formatCurrency(item.budgetAmount)}</span>
                  </div>
                </div>

                <Progress
                  value={Math.min(item.percent, 100)}
                  indicatorColor={isOver ? "bg-[#BA1A1A]" : item.percent > 85 ? "bg-amber-500" : "bg-[#059669]"}
                  className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"
                />

                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] text-foreground">
                    {item.percent}% terserap
                  </span>
                  <span>
                    {isOver ? (
                      <span className="text-[#BA1A1A] font-semibold">Defisit: {formatCurrency(item.actualSpent - item.budgetAmount)}</span>
                    ) : (
                      <span>Sisa: <strong className="text-foreground">{formatCurrency(item.remaining)}</strong></span>
                    )}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}

        {(!budgetData?.items || budgetData.items.length === 0) && !isLoading && (
          <div className="p-10 text-center text-xs text-muted-foreground border border-dashed rounded-2xl border-border/80 bg-card/50">
            <div className="mx-auto h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-muted-foreground mb-2.5">
              <GeometricIcon name="budgets" className="h-5 w-5" />
            </div>
            Belum ada batasan anggaran tersimpan untuk bulan {currentMonth}.
            <div className="mt-3">
              <Button
                onClick={() => setIsModalOpen(true)}
                variant="outline"
                className="h-10 rounded-xl text-xs font-semibold border-[#059669] text-[#059669] hover:bg-[#A7F3D0]/20 px-4 active:scale-95"
              >
                Atur Plafon Pertama
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Atur Budget */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Tentukan Anggaran Kategori"
            className="relative w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-card border border-border/80 shadow-2xl p-5 text-card-foreground max-h-[90vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-5"
          >
            {/* Visual Drag Handle Pill on Mobile */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted-foreground/30 sm:hidden" />

            <h2 className="text-sm font-bold text-foreground mb-1">Tentukan Anggaran Kategori</h2>
            <p className="text-xs text-muted-foreground mb-3.5">
              Tentukan batas maksimum pengeluaran untuk periode {currentMonth}.
            </p>
            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-foreground">Kategori Pengeluaran</label>
                <div className="mt-1">
                  <CategorySelect
                    categories={categoriesList || []}
                    value={categoryId}
                    onChange={(newId) => setCategoryId(newId)}
                    txType="expense"
                    placeholder="Pilih Kategori Pengeluaran..."
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground">Nominal Anggaran Bulanan (IDR)</label>
                <Input
                  type="number"
                  placeholder="Contoh: 1500000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 h-9 rounded-md"
                  required
                />
              </div>

              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-1/2 rounded-md h-8 sm:h-9 text-xs"
                  onClick={() => setIsModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  className="w-1/2 bg-[#059669] hover:bg-[#047857] text-white rounded-md h-8 sm:h-9 text-xs font-semibold shadow-xs"
                >
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

