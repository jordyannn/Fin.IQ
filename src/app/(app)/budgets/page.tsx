"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight as ChevronRightIcon,
  PiggyBank,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useTranslation } from "@/i18n";
import { GeometricIcon } from "@/components/ui/GeometricIcon";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { CategorySelect } from "@/components/transactions/CategorySelect";
import { MilestoneTrackingCard } from "@/components/milestones/MilestoneTrackingCard";
import { PeriodBudgetPlanner } from "@/components/budgets/PeriodBudgetPlanner";

type CreateModalMode = "budget" | "spending_limit" | "savings_goal" | "income_goal";

function getCurrentWibMonth(): string {
  const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return `${nowWib.getUTCFullYear()}-${String(nowWib.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getTodayWibDate(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getDefaultDeadlineDate(): string {
  const dt = new Date(Date.now() + 7 * 60 * 60 * 1000 + 30 * 24 * 60 * 60 * 1000);
  return dt.toISOString().slice(0, 10);
}

export default function BudgetsPage() {
  const { t, locale, formatCurrency } = useTranslation();
  const isEn = locale === "en";
  const utils = trpc.useUtils();

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentWibMonth);
  const [selectedLedgerId, setSelectedLedgerId] = useState<string>("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<CreateModalMode>("budget");
  const [formError, setFormError] = useState<string | null>(null);

  // Budget form state
  const [budgetCategoryId, setBudgetCategoryId] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");

  // Milestone form state (spending_limit | savings_goal | income_goal)
  const [targetTitle, setTargetTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [trackingType, setTrackingType] = useState<"account" | "category">("account");
  const [trackingId, setTrackingId] = useState("all");
  const [startDate, setStartDate] = useState<string>(getTodayWibDate);
  const [deadline, setDeadline] = useState<string>(getDefaultDeadlineDate);

  const { data: ledgersList } = trpc.ledgers.list.useQuery();
  const activeLedgerId = selectedLedgerId || ledgersList?.[0]?.id || "default";

  const { data: accountsData } = trpc.accounts.list.useQuery();
  const { data: allCategoriesList } = trpc.categories.list.useQuery();
  const expenseCategories = useMemo(
    () => (allCategoriesList || []).filter((c) => c.kind === "expense"),
    [allCategoriesList]
  );
  const incomeCategories = useMemo(
    () => (allCategoriesList || []).filter((c) => c.kind === "income"),
    [allCategoriesList]
  );

  const { data: budgetData, isLoading: isBudgetsLoading } = trpc.budgets.list.useQuery(
    {
      ledgerId: activeLedgerId,
      month: selectedMonth,
    },
    { enabled: Boolean(activeLedgerId) }
  );

  const { data: milestonesList } = trpc.milestones.list.useQuery();

  const milestoneSummary = useMemo(() => {
    const list = milestonesList || [];
    const completed = list.filter((m) => m.isCompleted).length;
    const active = list.length - completed;
    return { total: list.length, active, completed };
  }, [milestonesList]);

  const setBudgetMutation = trpc.budgets.set.useMutation({
    onSuccess: () => {
      utils.budgets.invalidate();
      utils.milestones.invalidate();
      utils.budgetPlans.invalidate();
      closeModal();
    },
    onError: (err) => setFormError(err.message),
  });

  const deleteBudgetMutation = trpc.budgets.delete.useMutation({
    onSuccess: () => {
      utils.budgets.invalidate();
      utils.budgetPlans.invalidate();
    },
  });

  const createMilestoneMutation = trpc.milestones.create.useMutation({
    onSuccess: () => {
      utils.milestones.invalidate();
      utils.budgets.invalidate();
      utils.budgetPlans.invalidate();
      closeModal();
    },
    onError: (err) => setFormError(err.message),
  });

  const resetForm = (mode: CreateModalMode) => {
    setFormError(null);
    setModalMode(mode);
    setBudgetCategoryId("");
    setBudgetAmount("");
    setTargetTitle("");
    setTargetAmount("");
    setStartDate(getTodayWibDate());
    setDeadline(getDefaultDeadlineDate());
    if (mode === "spending_limit") {
      setTrackingType(expenseCategories.length > 0 ? "category" : "account");
      setTrackingId(expenseCategories[0]?.id || "all");
    } else {
      setTrackingType("account");
      setTrackingId("all");
    }
  };

  const openModal = (initialMode: CreateModalMode = "budget") => {
    resetForm(initialMode);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormError(null);
  };

  const handleModeSwitch = (nextMode: CreateModalMode) => {
    setFormError(null);
    setModalMode(nextMode);
    if (nextMode === "spending_limit") {
      setTrackingType("category");
      setTrackingId(expenseCategories[0]?.id || "all");
    } else if (nextMode === "savings_goal" || nextMode === "income_goal") {
      setTrackingType("account");
      setTrackingId("all");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (modalMode === "budget") {
      const num = Number(budgetAmount);
      if (!budgetCategoryId) {
        setFormError(
          isEn
            ? "Please select an expense category."
            : "Pilih kategori pengeluaran terlebih dahulu."
        );
        return;
      }
      if (!Number.isFinite(num) || num <= 0) {
        setFormError(
          isEn
            ? "Budget amount must be greater than 0."
            : "Nominal pagu anggaran harus lebih dari Rp 0."
        );
        return;
      }
      setBudgetMutation.mutate({
        ledgerId: activeLedgerId,
        categoryId: budgetCategoryId,
        month: selectedMonth,
        amount: Math.round(num),
      });
      return;
    }

    const parsedTarget = Number(targetAmount);
    if (!targetTitle.trim()) {
      setFormError(
        isEn ? "Target title is required." : "Judul target wajib diisi."
      );
      return;
    }
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      setFormError(
        isEn
          ? "Target amount must be greater than 0."
          : "Nominal target harus lebih dari Rp 0."
      );
      return;
    }
    if (!trackingId) {
      setFormError(
        isEn
          ? "Please select an account or category to track."
          : "Pilih akun atau kategori yang ingin dipantau."
      );
      return;
    }
    const parsedStartDate = new Date(`${startDate}T00:00:00+07:00`);
    const parsedDate = new Date(`${deadline}T23:59:59+07:00`);
    if (!startDate || Number.isNaN(parsedStartDate.getTime())) {
      setFormError(
        isEn ? "Please enter a valid start date." : "Tanggal mulai tidak valid."
      );
      return;
    }
    if (!deadline || Number.isNaN(parsedDate.getTime())) {
      setFormError(
        isEn ? "Please enter a valid deadline date." : "Tanggal akhir tidak valid."
      );
      return;
    }
    if (parsedStartDate.getTime() > parsedDate.getTime()) {
      setFormError(
        isEn
          ? "Start date must be on or before end date."
          : "Tanggal mulai tidak boleh melewati tanggal akhir."
      );
      return;
    }

    createMilestoneMutation.mutate({
      title: targetTitle.trim(),
      targetAmount: Math.round(parsedTarget),
      trackingType,
      trackingId,
      trackingDirection: modalMode,
      startDate: parsedStartDate,
      deadline: parsedDate,
    });
  };

  const isSubmitting =
    setBudgetMutation.isPending || createMilestoneMutation.isPending;

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto pb-8">
      {/* Header + Unified Action + Filters */}
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-[#A7F3D0]/40 flex items-center justify-center text-[#064E3B] shrink-0">
                <GeometricIcon name="budgets" className="h-4 w-4" />
              </div>
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-foreground">
                {isEn
                  ? "Budgets & Financial Targets"
                  : "Anggaran & Target Keuangan"}
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isEn
                ? `Manage monthly category ceilings, spending limits, and savings goals in one view (${selectedMonth}).`
                : `Kelola pagu anggaran bulanan, batas pengeluaran, dan target tabungan secara terpadu (${selectedMonth}).`}
            </p>
          </div>

          <Button
            onClick={() => openModal("budget")}
            className="bg-primary hover:bg-[#047857] text-white gap-2 shadow-xs text-xs rounded-xl font-bold h-10 px-4 active:scale-95 transition-all self-start sm:self-auto cursor-pointer"
          >
            <GeometricIcon name="plus" className="h-3.5 w-3.5" />
            <span>
              {isEn ? "Add Budget / Target" : "+ Tambah Anggaran / Target"}
            </span>
          </Button>
        </div>

        {/* Synchronized Filter Bar (Ledger + Period Month) */}
        <div className="flex flex-wrap items-center gap-2.5 bg-card border border-border/80 rounded-2xl p-2.5 sm:px-3.5 shadow-2xs">
          <div className="flex items-center gap-2 flex-1 min-w-[180px]">
            <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
            <select
              aria-label={isEn ? "Select Ledger" : "Pilih Buku Kas"}
              value={activeLedgerId}
              onChange={(e) => setSelectedLedgerId(e.target.value)}
              className="flex-1 h-8 px-2.5 rounded-lg border border-border/80 bg-background text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
            >
              {ledgersList && ledgersList.length > 0 ? (
                ledgersList.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.currency})
                  </option>
                ))
              ) : (
                <option value="default">
                  {isEn ? "Default Ledger" : "Buku Kas Utama"}
                </option>
              )}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="budget-month-picker"
              className="text-[11px] font-semibold text-muted-foreground"
            >
              {isEn ? "Period:" : "Periode:"}
            </label>
            <input
              id="budget-month-picker"
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                if (e.target.value) setSelectedMonth(e.target.value);
              }}
              className="h-8 px-2.5 rounded-lg border border-border/80 bg-background text-xs font-mono font-semibold text-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Wallets & Accounts Carousel */}
      {accountsData?.accounts && accountsData.accounts.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
                {isEn ? "Wallets & Accounts" : "Dompet & Rekening"}
              </span>
              <p className="text-[11px] text-muted-foreground">
                {accountsData.accounts.filter((a) => !a.isHidden).length}{" "}
                {isEn ? "Active Accounts" : "Rekening Aktif"}
              </p>
            </div>
            <Link
              href="/accounts"
              className="text-xs text-primary font-bold hover:underline flex items-center gap-1 active:scale-95"
            >
              <span>{isEn ? "View All" : "Lihat Semua"}</span>
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory py-1 -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
            {accountsData.accounts
              .filter((a) => !a.isHidden)
              .map((acc) => (
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

      {/* Unified KPI Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {isEn ? "Monthly Ceiling" : "Total Plafon Bulanan"}
            </span>
            <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <GeometricIcon name="budgets" className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold tracking-tight text-foreground mt-2 tabular-nums">
            {formatCurrency(budgetData?.totalBudget || 0)}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            {isEn ? `Allocated for ${selectedMonth}` : `Alokasi pagu ${selectedMonth}`}
          </span>
        </Card>

        <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {isEn ? "Actual Spending" : "Realisasi Belanja"}
            </span>
            <div className="h-8 w-8 rounded-xl bg-[#BA1A1A]/10 flex items-center justify-center text-[#BA1A1A]">
              <GeometricIcon name="trend-down" className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold tracking-tight text-[#BA1A1A] mt-2 tabular-nums">
            {formatCurrency(budgetData?.totalSpent || 0)}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            {isEn ? "Recorded category outflow" : "Akumulasi belanja kategori"}
          </span>
        </Card>

        <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {isEn ? "Remaining Allocation" : "Sisa Alokasi Kas"}
            </span>
            <div className="h-8 w-8 rounded-xl bg-[#A7F3D0]/40 flex items-center justify-center text-[#064E3B]">
              <GeometricIcon name="trend-up" className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold tracking-tight text-[#059669] mt-2 tabular-nums">
            {formatCurrency(budgetData?.totalRemaining || 0)}
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            {isEn ? "Safe remaining headroom" : "Sisa ruang belanja aman"}
          </span>
        </Card>

        <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {isEn ? "Financial Targets" : "Target Keuangan"}
            </span>
            <div className="h-8 w-8 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400">
              <Target className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl font-bold tracking-tight text-foreground mt-2 tabular-nums">
            {milestoneSummary.active}{" "}
            <span className="text-xs font-semibold text-muted-foreground">
              {isEn ? "Active" : "Aktif"}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground mt-0.5 block">
            {milestoneSummary.completed}{" "}
            {isEn ? "targets achieved" : "target telah tercapai"}
          </span>
        </Card>
      </div>

      {/* Section 0: Rencana Anggaran Periode & Alokasi Waktu */}
      <PeriodBudgetPlanner />

      {/* Section 1: Target & Milestone Keuangan */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between pt-1">
          <div>
            <h2 className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
              {isEn
                ? "Financial Targets & Milestones"
                : "Target Tabungan & Batas Pengeluaran"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {isEn
                ? "Long-term savings goals and deadline-bound spending caps"
                : "Pantau target tabungan serta batas pengeluaran berbatas waktu"}
            </p>
          </div>
          <Button
            onClick={() => openModal("savings_goal")}
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs rounded-xl font-bold h-9 px-3 border-primary/40 text-primary hover:bg-primary/5 active:scale-95 transition-all cursor-pointer"
          >
            <GeometricIcon name="plus" className="h-3 w-3" />
            <span>{isEn ? "New Target" : "Tambah Target"}</span>
          </Button>
        </div>

        <MilestoneTrackingCard
          hideHeaderAction
          onRequestCreateTarget={() => openModal("savings_goal")}
        />
      </section>

      {/* Section 2: Monthly Category Budget Limits */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between pt-1">
          <div>
            <h2 className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
              {isEn ? "Category Budget Limits" : "Batas Anggaran Kategori Bulanan"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {isEn
                ? `Spending progress per category for ${selectedMonth}`
                : `Progres realisasi belanja per kategori periode ${selectedMonth}`}
            </p>
          </div>
          <Button
            onClick={() => openModal("budget")}
            size="sm"
            className="bg-primary hover:bg-[#047857] text-white gap-1.5 shadow-xs text-xs rounded-xl font-bold h-9 px-3 active:scale-95 transition-all cursor-pointer"
          >
            <GeometricIcon name="plus" className="h-3 w-3" />
            <span>{isEn ? "Set Ceiling" : "Atur Pagu"}</span>
          </Button>
        </div>

        {budgetData?.items?.map((item) => {
          const isOver = item.actualSpent > item.budgetAmount;

          return (
            <Card
              key={item.id}
              className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs transition-all hover:border-[#059669]/40 group"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold text-[11px] shrink-0">
                      {item.categoryName?.slice(0, 2).toUpperCase() ||
                        (isEn ? "GEN" : "UM")}
                    </div>
                    <span className="font-bold text-sm text-foreground truncate">
                      {item.categoryName || (isEn ? "General" : "Umum")}
                    </span>
                    {isOver && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#BA1A1A] bg-[#BA1A1A]/10 px-2.5 py-0.5 rounded-full border border-rose-500/20 shrink-0">
                        {t.budgets.statusOver}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-xs font-semibold text-foreground text-right tabular-nums">
                      <span className="font-bold text-foreground">
                        {formatCurrency(item.actualSpent)}
                      </span>
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        / {formatCurrency(item.budgetAmount)}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={deleteBudgetMutation.isPending}
                      onClick={() => {
                        const confirmMsg = isEn
                          ? `Delete monthly budget ceiling for "${item.categoryName || "Category"}"?`
                          : `Hapus pagu anggaran kategori "${item.categoryName || "Umum"}" periode ${selectedMonth}?`;
                        if (window.confirm(confirmMsg)) {
                          deleteBudgetMutation.mutate({ id: item.id });
                        }
                      }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-40"
                      title={isEn ? "Delete budget" : "Hapus pagu anggaran"}
                      aria-label={isEn ? "Delete budget" : "Hapus pagu anggaran"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <Progress
                  value={Math.min(item.percent, 100)}
                  indicatorColor={
                    isOver
                      ? "bg-[#BA1A1A]"
                      : item.percent > 85
                        ? "bg-amber-500"
                        : "bg-[#059669]"
                  }
                  className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"
                />

                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] text-foreground">
                    {item.percent}% {isEn ? "used" : "terserap"}
                  </span>
                  <span>
                    {isOver ? (
                      <span className="text-[#BA1A1A] font-semibold">
                        {isEn ? "Deficit: " : "Defisit: "}
                        {formatCurrency(item.actualSpent - item.budgetAmount)}
                      </span>
                    ) : (
                      <span>
                        {isEn ? "Remaining: " : "Sisa: "}
                        <strong className="text-foreground">
                          {formatCurrency(item.remaining)}
                        </strong>
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}

        {(!budgetData?.items || budgetData.items.length === 0) && !isBudgetsLoading && (
          <div className="p-10 text-center text-xs text-muted-foreground border border-dashed rounded-2xl border-border/80 bg-card/50">
            <div className="mx-auto h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-muted-foreground mb-2.5">
              <GeometricIcon name="budgets" className="h-5 w-5" />
            </div>
            {isEn
              ? `No monthly budget ceilings saved for ${selectedMonth}.`
              : `Belum ada pagu anggaran kategori tersimpan untuk periode ${selectedMonth}.`}
            <div className="mt-3">
              <Button
                onClick={() => openModal("budget")}
                variant="outline"
                className="h-10 rounded-xl text-xs font-semibold border-[#059669] text-[#059669] hover:bg-[#A7F3D0]/20 px-4 active:scale-95"
              >
                {isEn ? "Set First Ceiling" : "Atur Pagu Pertama"}
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Unified 3-Mode Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={
              isEn
                ? "Create Budget or Financial Target"
                : "Tambah Anggaran atau Target Keuangan"
            }
            className="relative w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-card border border-border/80 shadow-2xl p-5 text-card-foreground max-h-[92vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-5"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted-foreground/30 sm:hidden" />

            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <GeometricIcon name="budgets" size="sm" active />
                <h2 className="text-sm font-bold text-foreground">
                  {isEn
                    ? "New Budget / Financial Target"
                    : "Tambah Anggaran / Target"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 4-Mode Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/60 mt-3.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => handleModeSwitch("budget")}
                className={`py-2 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  modalMode === "budget"
                    ? "bg-card text-foreground shadow-2xs border border-border/70"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <PiggyBank className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {isEn ? "Monthly Cap" : "Pagu Bulanan"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleModeSwitch("spending_limit")}
                className={`py-2 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  modalMode === "spending_limit"
                    ? "bg-card text-foreground shadow-2xs border border-border/70"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Target className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {isEn ? "Spend Limit" : "Batas Belanja"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleModeSwitch("savings_goal")}
                className={`py-2 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  modalMode === "savings_goal"
                    ? "bg-card text-foreground shadow-2xs border border-border/70"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Wallet className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {isEn ? "Savings Goal" : "Target Nabung"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleModeSwitch("income_goal")}
                className={`py-2 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  modalMode === "income_goal"
                    ? "bg-card text-foreground shadow-2xs border border-border/70"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {isEn ? "Income Goal" : "Target Masuk"}
                </span>
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-[11px] font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs mt-3.5">
              {modalMode === "budget" ? (
                <>
                  <p className="text-[11px] text-muted-foreground">
                    {isEn
                      ? `Monthly spending ceiling per expense category (${selectedMonth}).`
                      : `Pagu pengeluaran bulanan per kategori pada periode ${selectedMonth}.`}
                  </p>

                  <div>
                    <label className="font-semibold text-foreground">
                      {isEn ? "Expense Category" : "Kategori Pengeluaran"}
                    </label>
                    <div className="mt-1">
                      <CategorySelect
                        categories={expenseCategories}
                        value={budgetCategoryId}
                        onChange={(newId) => setBudgetCategoryId(newId)}
                        txType="expense"
                        placeholder={
                          isEn
                            ? "Select Expense Category..."
                            : "Pilih Kategori Pengeluaran..."
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-foreground">
                      {isEn
                        ? "Monthly Ceiling (IDR)"
                        : "Nominal Pagu Bulanan (IDR)"}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      placeholder={isEn ? "e.g. 1500000" : "Contoh: 1500000"}
                      value={budgetAmount}
                      onChange={(e) => setBudgetAmount(e.target.value)}
                      className="mt-1 h-9 rounded-md font-mono"
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-muted-foreground">
                    {modalMode === "spending_limit"
                      ? isEn
                        ? "Cap total spending within your selected date window on any category or all accounts."
                        : "Batasi total pengeluaran pada rentang tanggal yang ditentukan di kategori atau semua akun."
                      : modalMode === "income_goal"
                        ? isEn
                          ? "Track cumulative income within your selected date window across accounts or income categories."
                          : "Pantau akumulasi pemasukan pada rentang tanggal yang ditentukan di seluruh akun atau kategori."
                        : isEn
                          ? "Track savings accumulation toward your goal with a clear date window."
                          : "Pantau akumulasi saldo tabungan menuju target hingga tanggal akhir."}
                  </p>

                  <div>
                    <label className="font-semibold text-foreground">
                      {isEn ? "Target Title" : "Judul Target"}
                    </label>
                    <Input
                      type="text"
                      value={targetTitle}
                      onChange={(e) => setTargetTitle(e.target.value)}
                      placeholder={
                        modalMode === "spending_limit"
                          ? isEn
                            ? "e.g. Spending Cap Nov-Dec"
                            : "Contoh: Batas Pengeluaran 13 Nov–31 Des"
                          : modalMode === "income_goal"
                            ? isEn
                              ? "e.g. Target Pemasukan Nov-Des"
                              : "Contoh: Target Pemasukan Nov–Des"
                            : isEn
                              ? "e.g. Ending Balance Rp15M"
                              : "Contoh: Saldo Akhir Rp 15 Juta"
                      }
                      className="mt-1 h-9 rounded-md"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-foreground">
                      {isEn ? "Target Amount (IDR)" : "Nominal Target (IDR)"}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                      placeholder="10000000"
                      className="mt-1 h-9 rounded-md font-mono"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="font-semibold text-foreground block mb-1">
                        {isEn ? "Track Based On" : "Pantau Berdasarkan"}
                      </label>
                      <select
                        value={trackingType}
                        onChange={(e) => {
                          const next = e.target.value as "account" | "category";
                          setTrackingType(next);
                          if (next === "account") {
                            setTrackingId("all");
                          } else {
                            setTrackingId(
                              (modalMode === "spending_limit"
                                ? expenseCategories[0]?.id
                                : modalMode === "income_goal"
                                  ? incomeCategories[0]?.id
                                  : allCategoriesList?.[0]?.id) || ""
                            );
                          }
                        }}
                        className="w-full h-9 px-2.5 rounded-md border border-border bg-background text-foreground text-xs"
                      >
                        <option value="account">
                          {isEn ? "Account Balance" : "Rekening / Semua Akun"}
                        </option>
                        <option value="category">
                          {isEn ? "Category" : "Kategori"}
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-foreground block mb-1">
                        {isEn ? "Select Entity" : "Pilih Target Pantauan"}
                      </label>
                      <select
                        value={trackingId}
                        onChange={(e) => setTrackingId(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-md border border-border bg-background text-foreground text-xs"
                        required
                      >
                        {trackingType === "account" ? (
                          <>
                            <option value="all">
                              {isEn ? "All Accounts" : "Semua Akun"}
                            </option>
                            {accountsData?.accounts
                              ?.filter((a) => !a.isHidden)
                              .map((acc) => (
                                <option key={acc.id} value={acc.id}>
                                  {acc.name}
                                </option>
                              ))}
                          </>
                        ) : (
                          <>
                            <option value="">
                              {isEn ? "-- Select --" : "-- Pilih Kategori --"}
                            </option>
                            {(modalMode === "spending_limit"
                              ? expenseCategories
                              : modalMode === "income_goal"
                                ? incomeCategories
                                : allCategoriesList || []
                            ).map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="font-semibold text-foreground">
                        {isEn ? "Start Date (From)" : "Dari Tanggal (Sebelum)"}
                      </label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="mt-1 h-9 rounded-md"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-foreground">
                        {isEn ? "End Date (Until)" : "Sampai Tanggal"}
                      </label>
                      <Input
                        type="date"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        className="mt-1 h-9 rounded-md"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-1/2 rounded-md h-9 text-xs"
                  onClick={closeModal}
                >
                  {t.common.cancel}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 bg-[#059669] hover:bg-[#047857] text-white rounded-md h-9 text-xs font-semibold shadow-xs"
                >
                  {isSubmitting
                    ? isEn
                      ? "Saving..."
                      : "Menyimpan..."
                    : isEn
                      ? "Save"
                      : "Simpan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
