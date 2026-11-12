"use client";

import React, { useMemo, useState } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Edit3,
  FileText,
  Layers,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useTranslation } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PLAN_SEGMENT_COLORS,
  type BudgetPlanExpenseItem,
  type BudgetPlanIncomeItem,
  type BudgetPlanTimeWindow,
  type PeriodBudgetPlan,
  computePlanMetrics,
  parseMarkdownBudgetPlan,
} from "@/lib/budget-plan";

function createRowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getDefaultDraftPlan(liveBalance: number): PeriodBudgetPlan {
  const start = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    id: "",
    title: "Rencana Anggaran & Target Periode",
    startDate: start,
    endDate: end,
    startingBalance: Math.round(liveBalance),
    targetEndingBalance: 15_000_000,
    trackingAccountId: "all",
    incomeTargets: [
      { id: createRowId(), label: "Gaji / Pemasukan Utama", amount: 5_000_000, note: "" },
    ],
    expenseCaps: [
      {
        id: createRowId(),
        label: "Makanan & Kebutuhan Pokok",
        amount: 1_500_000,
        note: "",
        color: PLAN_SEGMENT_COLORS[0]!,
      },
    ],
    timeWindows: [],
    updatedAt: new Date().toISOString(),
  };
}

export function PeriodBudgetPlanner() {
  const { formatCurrency, formatDate, locale } = useTranslation();
  const isEn = locale === "en";
  const utils = trpc.useUtils();

  const { data: plansData, isLoading } = trpc.budgetPlans.list.useQuery();
  const { data: accountsData } = trpc.accounts.list.useQuery();
  const { data: categoriesList } = trpc.categories.list.useQuery();

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [showMarkdownImport, setShowMarkdownImport] = useState(false);
  const [markdownPasteText, setMarkdownPasteText] = useState("");
  const [editorError, setEditorError] = useState<string | null>(null);
  const [draftPlan, setDraftPlan] = useState<PeriodBudgetPlan>(() => getDefaultDraftPlan(0));

  const activeAccounts = useMemo(
    () => (accountsData?.accounts || []).filter((a) => !a.isHidden),
    [accountsData]
  );
  const totalLiveBalance = useMemo(
    () => activeAccounts.reduce((sum, a) => sum + (a.balance || 0), 0),
    [activeAccounts]
  );
  const incomeCategories = useMemo(
    () => (categoriesList || []).filter((c) => c.kind === "income"),
    [categoriesList]
  );
  const expenseCategories = useMemo(
    () => (categoriesList || []).filter((c) => c.kind === "expense"),
    [categoriesList]
  );

  const upsertMutation = trpc.budgetPlans.upsert.useMutation({
    onSuccess: () => {
      utils.budgetPlans.invalidate();
      setIsEditorOpen(false);
      setEditorError(null);
    },
    onError: (err) => setEditorError(err.message),
  });

  const deleteMutation = trpc.budgetPlans.delete.useMutation({
    onSuccess: () => {
      utils.budgetPlans.invalidate();
    },
  });

  const openCreateEditor = () => {
    setEditorError(null);
    setShowMarkdownImport(false);
    setMarkdownPasteText("");
    setDraftPlan(getDefaultDraftPlan(totalLiveBalance));
    setIsEditorOpen(true);
  };

  const openEditEditor = (plan: PeriodBudgetPlan) => {
    setEditorError(null);
    setShowMarkdownImport(false);
    setMarkdownPasteText("");
    setDraftPlan(JSON.parse(JSON.stringify(plan)) as PeriodBudgetPlan);
    setIsEditorOpen(true);
  };

  const handleApplyMarkdownImport = () => {
    if (!markdownPasteText.trim()) return;
    const parsed = parseMarkdownBudgetPlan(markdownPasteText, {
      categories: categoriesList || [],
    });
    setDraftPlan((prev) => ({
      ...parsed,
      id: prev.id,
      startingBalance: parsed.startingBalance ?? prev.startingBalance ?? totalLiveBalance,
      trackingAccountId: prev.trackingAccountId || "all",
    }));
    setShowMarkdownImport(false);
    setEditorError(null);
  };

  const handleSavePlan = (e: React.FormEvent) => {
    e.preventDefault();
    setEditorError(null);

    if (!draftPlan.title.trim()) {
      setEditorError(isEn ? "Plan title is required." : "Judul rencana wajib diisi.");
      return;
    }
    if (draftPlan.startDate > draftPlan.endDate) {
      setEditorError(
        isEn
          ? "Start date cannot be after end date."
          : "Tanggal mulai tidak boleh melewati tanggal selesai."
      );
      return;
    }
    if (!Number.isFinite(draftPlan.targetEndingBalance) || draftPlan.targetEndingBalance <= 0) {
      setEditorError(
        isEn
          ? "Ending balance target must be greater than 0."
          : "Target saldo akhir harus lebih dari Rp 0."
      );
      return;
    }

    const validIncomes = draftPlan.incomeTargets.filter(
      (i) => i.label.trim() && Number.isFinite(i.amount) && i.amount > 0
    );
    const validExpenses = draftPlan.expenseCaps.filter(
      (i) => i.label.trim() && Number.isFinite(i.amount) && i.amount > 0
    );
    const validWindows = draftPlan.timeWindows.filter(
      (w) =>
        w.label.trim() &&
        w.startDate <= w.endDate &&
        Number.isFinite(w.amount) &&
        w.amount > 0
    );

    upsertMutation.mutate({
      id: draftPlan.id || undefined,
      title: draftPlan.title.trim(),
      startDate: draftPlan.startDate,
      endDate: draftPlan.endDate,
      startingBalance:
        typeof draftPlan.startingBalance === "number" &&
        Number.isFinite(draftPlan.startingBalance)
          ? Math.round(draftPlan.startingBalance)
          : undefined,
      targetEndingBalance: Math.round(draftPlan.targetEndingBalance),
      trackingAccountId: draftPlan.trackingAccountId || "all",
      incomeTargets: validIncomes.map((i) => ({
        ...i,
        label: i.label.trim(),
        amount: Math.round(i.amount),
      })),
      expenseCaps: validExpenses.map((c, idx) => ({
        ...c,
        label: c.label.trim(),
        amount: Math.round(c.amount),
        color: c.color || PLAN_SEGMENT_COLORS[idx % PLAN_SEGMENT_COLORS.length]!,
      })),
      timeWindows: validWindows.map((w) => ({
        ...w,
        label: w.label.trim(),
        amount: Math.round(w.amount),
      })),
    });
  };

  const liveMetrics = useMemo(
    () =>
      computePlanMetrics(
        draftPlan,
        draftPlan.startingBalance ?? totalLiveBalance
      ),
    [draftPlan, totalLiveBalance]
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div>
          <h2 className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
            {isEn
              ? "Period Budget & Cash Target Planner"
              : "Perencanaan Target & Batas Pengeluaran Periode"}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {isEn
              ? "Combine multi-source income targets, category spending caps, and date-window allocations."
              : "Gabungkan target pemasukan, batas pengeluaran kategori, dan alokasi berdasarkan tanggal."}
          </p>
        </div>

        <Button
          onClick={openCreateEditor}
          size="sm"
          className="bg-primary hover:bg-[#047857] text-white gap-1.5 shadow-xs text-xs rounded-xl font-bold h-9 px-3 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{isEn ? "New Period Plan" : "Buat Rencana Periode"}</span>
        </Button>
      </div>

      {(!plansData || plansData.length === 0) && !isLoading && (
        <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-2xl border-border/80 bg-card/40">
          <Layers className="h-6 w-6 mx-auto mb-2 text-primary/70" />
          <p className="font-medium text-foreground/80">
            {isEn
              ? "No period budget plan yet. Create one manually or paste a Markdown table plan."
              : "Belum ada rencana budget periode. Buat manual atau tempel langsung tabel perencanaan teks/Markdown."}
          </p>
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              onClick={openCreateEditor}
              className="h-9 rounded-xl text-xs font-semibold border-primary/40 text-primary hover:bg-primary/5"
            >
              {isEn ? "Create / Import Plan" : "+ Buat / Impor Rencana"}
            </Button>
          </div>
        </div>
      )}

      {plansData?.map((entry) => {
        const {
          plan,
          metrics,
          liveBalance,
          actualIncomeTotal,
          actualExpenseTotal,
          incomeTargetsWithActual,
          expenseCapsWithActual,
          timeWindowsWithActual,
        } = entry;

        const endingProgressPct = Math.min(
          100,
          Math.max(
            0,
            Math.round((liveBalance / Math.max(1, plan.targetEndingBalance)) * 100)
          )
        );
        const showDetails = expandedSections[plan.id] ?? true;

        return (
          <Card
            key={plan.id}
            className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs space-y-4"
          >
            {/* Header Row */}
            <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-border/60">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
                    {plan.title}
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
                    <Calendar className="h-3 w-3" />
                    {formatDate(plan.startDate)} → {formatDate(plan.endDate)} ({metrics.durationDays}{" "}
                    {isEn ? "days" : "hari"})
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isEn ? "Daily max cap:" : "Batas harian maksimal:"}{" "}
                  <strong className="text-foreground font-mono">
                    {formatCurrency(metrics.dailySpendLimit)}/hari
                  </strong>{" "}
                  • {isEn ? "Live balance:" : "Saldo riil saat ini:"}{" "}
                  <strong className="text-foreground font-mono">
                    {formatCurrency(liveBalance)}
                  </strong>{" "}
                  → {isEn ? "Goal:" : "Target saldo akhir:"}{" "}
                  <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrency(plan.targetEndingBalance)}
                  </strong>{" "}
                  ({endingProgressPct}%)
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEditEditor(plan)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border/80 text-[11px] font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>{isEn ? "Edit" : "Edit"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        isEn
                          ? `Delete plan "${plan.title}"?`
                          : `Hapus rencana "${plan.title}"?`
                      )
                    ) {
                      deleteMutation.mutate({ id: plan.id });
                    }
                  }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title={isEn ? "Delete plan" : "Hapus rencana"}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* 3-Column Hero Summary (Mirrors Uploaded Screenshot) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 divide-y sm:divide-y-0 sm:divide-x divide-border/60 rounded-xl bg-muted/30 border border-border/60 p-3.5 text-center">
              <div className="pb-2 sm:pb-0 sm:pr-3">
                <span className="text-[11px] text-muted-foreground block">
                  Total pengeluaran ({metrics.durationDays} hari)
                </span>
                <span className="text-lg sm:text-xl font-black text-foreground tabular-nums mt-0.5 block">
                  {formatCurrency(metrics.totalExpenseCap)}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {isEn ? "Actual:" : "Terpakai:"} {formatCurrency(actualExpenseTotal)}
                </span>
              </div>

              <div className="py-2 sm:py-0 sm:px-3">
                <span className="text-[11px] text-muted-foreground block">
                  Sisa pemasukan (Target masuk ke tabungan)
                </span>
                <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5 block">
                  {formatCurrency(metrics.projectedSavingsSurplus)}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {isEn ? "Proj. Final:" : "Proyeksi Akhir:"}{" "}
                  {formatCurrency(metrics.projectedEndingBalance)}
                </span>
              </div>

              <div className="pt-2 sm:pt-0 sm:pl-3">
                <span className="text-[11px] text-muted-foreground block">
                  Rasio Tabungan Target
                </span>
                <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5 block">
                  {metrics.savingsRatioPercent}%
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {isEn ? "Inflow:" : "Masuk riil:"} {formatCurrency(actualIncomeTotal)}
                </span>
              </div>
            </div>

            {/* Total Pemasukan Target Banner */}
            <div className="rounded-xl border border-border/70 bg-background/80 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Total Pemasukan Target
              </span>
              <div className="flex items-center gap-3">
                <span className="text-sm sm:text-base font-black text-foreground font-mono tabular-nums">
                  {formatCurrency(metrics.totalIncomeTarget)}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                  {Math.min(
                    100,
                    Math.round(
                      (actualIncomeTotal / Math.max(1, metrics.totalIncomeTarget)) * 100
                    )
                  )}
                  % tercapai
                </span>
              </div>
            </div>

            {/* Rincian Pengeluaran Multi-Color Stacked Bar */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-bold text-foreground">
                  Rincian Pengeluaran
                </h4>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSections((prev) => ({
                      ...prev,
                      [plan.id]: !showDetails,
                    }))
                  }
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                >
                  <span>{showDetails ? "Ringkas" : "Detail Lengkap"}</span>
                  {showDetails ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              {/* Multi-segment bar */}
              {expenseCapsWithActual.length > 0 && (
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
                  {expenseCapsWithActual.map((cap) => (
                    <div
                      key={cap.id}
                      style={{
                        width: `${Math.max(2, cap.sharePercent)}%`,
                        backgroundColor: cap.color,
                      }}
                      title={`${cap.label}: ${formatCurrency(cap.amount)} (${cap.sharePercent}%)`}
                      className="h-full transition-all"
                    />
                  ))}
                </div>
              )}

              {/* Category rows */}
              <div className="space-y-2">
                {expenseCapsWithActual.map((cap) => {
                  const usedPct =
                    cap.amount > 0
                      ? Math.round((cap.actualSpent / cap.amount) * 100)
                      : 0;
                  const isOverCap = cap.actualSpent > cap.amount;
                  return (
                    <div
                      key={cap.id}
                      className="rounded-xl border border-border/60 bg-background/60 px-3 py-2 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cap.color }}
                          />
                          <span className="font-semibold text-foreground truncate">
                            {cap.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 tabular-nums font-mono">
                          <span className="text-[11px] text-muted-foreground">
                            {cap.sharePercent}%
                          </span>
                          <span className="font-bold text-foreground">
                            {formatCurrency(cap.amount)}
                          </span>
                        </div>
                      </div>
                      {showDetails && (
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-muted-foreground pl-4.5">
                          <span>{cap.note || "-"}</span>
                          {cap.categoryId && (
                            <span
                              className={`font-mono font-semibold ${
                                isOverCap
                                  ? "text-rose-500"
                                  : "text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              Terpakai: {formatCurrency(cap.actualSpent)} ({usedPct}%)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {showDetails && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Target Pemasukan Table */}
                {incomeTargetsWithActual.length > 0 && (
                  <div className="rounded-xl border border-border/70 bg-background/60 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                        Target Pemasukan
                      </span>
                      <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(metrics.totalIncomeTarget)}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {incomeTargetsWithActual.map((inc) => (
                        <div
                          key={inc.id}
                          className="text-[11px] border-t border-border/40 pt-1.5 flex items-start justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">
                              {inc.label}
                            </p>
                            {inc.note && (
                              <p className="text-[10px] text-muted-foreground">
                                {inc.note}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0 font-mono">
                            <p className="font-bold text-foreground">
                              {formatCurrency(inc.amount)}
                            </p>
                            {inc.categoryId && inc.actualAmount > 0 && (
                              <p className="text-[9px] text-emerald-600 dark:text-emerald-400">
                                Masuk: {formatCurrency(inc.actualAmount)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Alokasi Pengeluaran Berdasarkan Waktu */}
                {timeWindowsWithActual.length > 0 && (
                  <div className="rounded-xl border border-border/70 bg-background/60 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5 text-primary" />
                        Alokasi Berdasarkan Waktu
                      </span>
                      <span className="text-[11px] font-mono font-bold text-foreground">
                        {timeWindowsWithActual.length} Fase
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {timeWindowsWithActual.map((win) => {
                        const overWin = win.actualSpent > win.amount;
                        return (
                          <div
                            key={win.id}
                            className="text-[11px] border-t border-border/40 pt-1.5 flex items-start justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground">
                                {win.label}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {win.sourceNote ||
                                  `${formatDate(win.startDate)} → ${formatDate(win.endDate)}`}
                              </p>
                            </div>
                            <div className="text-right shrink-0 font-mono">
                              <p className="font-bold text-foreground">
                                {formatCurrency(win.amount)}
                              </p>
                              <p
                                className={`text-[9px] font-semibold ${
                                  overWin
                                    ? "text-rose-500"
                                    : "text-muted-foreground"
                                }`}
                              >
                                Realisasi: {formatCurrency(win.actualSpent)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] italic text-muted-foreground pt-1 border-t border-border/40">
              Jika surplus ({formatCurrency(metrics.projectedSavingsSurplus)}) ditambah saldo awal
              ({formatCurrency(plan.startingBalance ?? liveBalance)}), proyeksi akhir periode{" "}
              {formatDate(plan.endDate)} adalah{" "}
              <strong className="text-foreground not-italic">
                {formatCurrency(metrics.projectedEndingBalance)}
              </strong>
              .
            </p>
          </Card>
        );
      })}

      {/* Full Create / Edit Period Plan Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Editor Rencana Budget Periode"
            className="relative w-full max-w-2xl rounded-t-3xl sm:rounded-2xl bg-card border border-border/80 shadow-2xl p-5 text-card-foreground max-h-[92vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-5"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted-foreground/30 sm:hidden" />

            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {draftPlan.id
                    ? isEn
                      ? "Edit Period Plan"
                      : "Edit Rencana Budget Periode"
                    : isEn
                      ? "New Period Plan"
                      : "Buat Rencana Budget Periode"}
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowMarkdownImport((v) => !v)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-primary/40 bg-primary/5 text-primary text-[11px] font-semibold hover:bg-primary/10 cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>{isEn ? "Import Text/MD" : "Tempel Teks / Markdown"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Markdown Importer Box */}
            {showMarkdownImport && (
              <div className="mt-3 p-3 rounded-xl bg-muted/50 border border-border space-y-2 text-xs">
                <p className="text-[11px] text-muted-foreground">
                  Tempel rincian tabel Markdown (Target Pemasukan, Batas Pengeluaran, &amp; Alokasi
                  Waktu) lalu klik <strong>Isi Form Otomatis</strong>:
                </p>
                <textarea
                  rows={6}
                  value={markdownPasteText}
                  onChange={(e) => setMarkdownPasteText(e.target.value)}
                  placeholder="### 1. Target Pemasukan&#10;| Kategori Pemasukan | Nominal | Keterangan |..."
                  className="w-full rounded-lg border border-border bg-background p-2 text-[11px] font-mono focus:outline-none focus:border-primary"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMarkdownImport(false)}
                    className="h-7 text-[11px]"
                  >
                    Tutup
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyMarkdownImport}
                    className="h-7 text-[11px] bg-primary text-white"
                  >
                    Isi Form Otomatis
                  </Button>
                </div>
              </div>
            )}

            {editorError && (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-[11px] font-medium">
                {editorError}
              </div>
            )}

            <form onSubmit={handleSavePlan} className="mt-3.5 space-y-4 text-xs">
              {/* Top Core Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="font-semibold text-foreground block mb-1">
                    Judul Rencana
                  </label>
                  <Input
                    value={draftPlan.title}
                    onChange={(e) =>
                      setDraftPlan((p) => ({ ...p, title: e.target.value }))
                    }
                    className="h-9"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Dari Tanggal (Mulai)
                  </label>
                  <Input
                    type="date"
                    value={draftPlan.startDate}
                    onChange={(e) =>
                      setDraftPlan((p) => ({ ...p, startDate: e.target.value }))
                    }
                    className="h-9"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Sampai Tanggal (Akhir)
                  </label>
                  <Input
                    type="date"
                    value={draftPlan.endDate}
                    onChange={(e) =>
                      setDraftPlan((p) => ({ ...p, endDate: e.target.value }))
                    }
                    className="h-9"
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Saldo Awal Acuan (IDR)
                  </label>
                  <Input
                    type="number"
                    value={draftPlan.startingBalance ?? ""}
                    onChange={(e) =>
                      setDraftPlan((p) => ({
                        ...p,
                        startingBalance: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      }))
                    }
                    className="h-9 font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Target Saldo Akhir (IDR)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={draftPlan.targetEndingBalance || ""}
                    onChange={(e) =>
                      setDraftPlan((p) => ({
                        ...p,
                        targetEndingBalance: Number(e.target.value) || 0,
                      }))
                    }
                    className="h-9 font-mono"
                    required
                  />
                </div>
              </div>

              {/* Live Math Preview */}
              <div className="rounded-xl bg-muted/40 border border-border/70 p-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                <span>
                  Durasi: <strong>{liveMetrics.durationDays} hari</strong>
                </span>
                <span>
                  Target Masuk:{" "}
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(liveMetrics.totalIncomeTarget)}
                  </strong>
                </span>
                <span>
                  Batas Keluar:{" "}
                  <strong>{formatCurrency(liveMetrics.totalExpenseCap)}</strong> (
                  {formatCurrency(liveMetrics.dailySpendLimit)}/hr)
                </span>
                <span>
                  Rasio Tabungan: <strong>{liveMetrics.savingsRatioPercent}%</strong>
                </span>
              </div>

              {/* 1. Target Pemasukan Rows */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">
                    1. Target Pemasukan ({draftPlan.incomeTargets.length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftPlan((p) => ({
                        ...p,
                        incomeTargets: [
                          ...p.incomeTargets,
                          { id: createRowId(), label: "", amount: 0, note: "" },
                        ],
                      }))
                    }
                    className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    + Tambah Baris Pemasukan
                  </button>
                </div>

                {draftPlan.incomeTargets.map((row: BudgetPlanIncomeItem, idx: number) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-12 gap-1.5 items-center bg-muted/20 p-2 rounded-lg border border-border/50"
                  >
                    <input
                      type="text"
                      placeholder="Label (mis. Salary Nov)"
                      value={row.label}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraftPlan((p) => ({
                          ...p,
                          incomeTargets: p.incomeTargets.map((r, i) =>
                            i === idx ? { ...r, label: val } : r
                          ),
                        }));
                      }}
                      className="col-span-4 h-8 px-2 rounded border border-border bg-background text-[11px]"
                    />
                    <input
                      type="number"
                      min={1}
                      placeholder="Nominal"
                      value={row.amount || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setDraftPlan((p) => ({
                          ...p,
                          incomeTargets: p.incomeTargets.map((r, i) =>
                            i === idx ? { ...r, amount: val } : r
                          ),
                        }));
                      }}
                      className="col-span-3 h-8 px-2 rounded border border-border bg-background text-[11px] font-mono"
                    />
                    <select
                      value={row.categoryId || ""}
                      onChange={(e) => {
                        const val = e.target.value || undefined;
                        setDraftPlan((p) => ({
                          ...p,
                          incomeTargets: p.incomeTargets.map((r, i) =>
                            i === idx ? { ...r, categoryId: val } : r
                          ),
                        }));
                      }}
                      className="col-span-4 h-8 px-1.5 rounded border border-border bg-background text-[11px]"
                    >
                      <option value="">-- Kategori (Opsional) --</option>
                      {incomeCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftPlan((p) => ({
                          ...p,
                          incomeTargets: p.incomeTargets.filter((_, i) => i !== idx),
                        }))
                      }
                      className="col-span-1 flex justify-center text-muted-foreground hover:text-rose-500 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="text"
                      placeholder="Keterangan / strategi alokasi..."
                      value={row.note}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraftPlan((p) => ({
                          ...p,
                          incomeTargets: p.incomeTargets.map((r, i) =>
                            i === idx ? { ...r, note: val } : r
                          ),
                        }));
                      }}
                      className="col-span-12 h-7 px-2 rounded border border-border/60 bg-background text-[10px]"
                    />
                  </div>
                ))}
              </div>

              {/* 2. Batas Pengeluaran Kategori Rows */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">
                    2. Batas Pengeluaran Kategori ({draftPlan.expenseCaps.length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftPlan((p) => ({
                        ...p,
                        expenseCaps: [
                          ...p.expenseCaps,
                          {
                            id: createRowId(),
                            label: "",
                            amount: 0,
                            note: "",
                            color:
                              PLAN_SEGMENT_COLORS[
                                p.expenseCaps.length % PLAN_SEGMENT_COLORS.length
                              ]!,
                          },
                        ],
                      }))
                    }
                    className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    + Tambah Baris Pengeluaran
                  </button>
                </div>

                {draftPlan.expenseCaps.map((row: BudgetPlanExpenseItem, idx: number) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-12 gap-1.5 items-center bg-muted/20 p-2 rounded-lg border border-border/50"
                  >
                    <input
                      type="text"
                      placeholder="Kategori (mis. Transportasi)"
                      value={row.label}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraftPlan((p) => ({
                          ...p,
                          expenseCaps: p.expenseCaps.map((r, i) =>
                            i === idx ? { ...r, label: val } : r
                          ),
                        }));
                      }}
                      className="col-span-4 h-8 px-2 rounded border border-border bg-background text-[11px]"
                    />
                    <input
                      type="number"
                      min={1}
                      placeholder="Nominal"
                      value={row.amount || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setDraftPlan((p) => ({
                          ...p,
                          expenseCaps: p.expenseCaps.map((r, i) =>
                            i === idx ? { ...r, amount: val } : r
                          ),
                        }));
                      }}
                      className="col-span-3 h-8 px-2 rounded border border-border bg-background text-[11px] font-mono"
                    />
                    <select
                      value={row.categoryId || ""}
                      onChange={(e) => {
                        const val = e.target.value || undefined;
                        setDraftPlan((p) => ({
                          ...p,
                          expenseCaps: p.expenseCaps.map((r, i) =>
                            i === idx ? { ...r, categoryId: val } : r
                          ),
                        }));
                      }}
                      className="col-span-4 h-8 px-1.5 rounded border border-border bg-background text-[11px]"
                    >
                      <option value="">-- Kategori DB --</option>
                      {expenseCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftPlan((p) => ({
                          ...p,
                          expenseCaps: p.expenseCaps.filter((_, i) => i !== idx),
                        }))
                      }
                      className="col-span-1 flex justify-center text-muted-foreground hover:text-rose-500 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="text"
                      placeholder="Strategi & batasan..."
                      value={row.note}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraftPlan((p) => ({
                          ...p,
                          expenseCaps: p.expenseCaps.map((r, i) =>
                            i === idx ? { ...r, note: val } : r
                          ),
                        }));
                      }}
                      className="col-span-12 h-7 px-2 rounded border border-border/60 bg-background text-[10px]"
                    />
                  </div>
                ))}
              </div>

              {/* 3. Alokasi Berdasarkan Waktu Rows */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">
                    3. Alokasi Berdasarkan Waktu ({draftPlan.timeWindows.length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftPlan((p) => ({
                        ...p,
                        timeWindows: [
                          ...p.timeWindows,
                          {
                            id: createRowId(),
                            label: "",
                            startDate: p.startDate,
                            endDate: p.endDate,
                            amount: 0,
                            sourceNote: "",
                          },
                        ],
                      }))
                    }
                    className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    + Tambah Fase Tanggal
                  </button>
                </div>

                {draftPlan.timeWindows.map((win: BudgetPlanTimeWindow, idx: number) => (
                  <div
                    key={win.id}
                    className="grid grid-cols-12 gap-1.5 items-center bg-muted/20 p-2 rounded-lg border border-border/50"
                  >
                    <input
                      type="text"
                      placeholder="Periode (mis. 13-18 Nov)"
                      value={win.label}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraftPlan((p) => ({
                          ...p,
                          timeWindows: p.timeWindows.map((r, i) =>
                            i === idx ? { ...r, label: val } : r
                          ),
                        }));
                      }}
                      className="col-span-4 h-8 px-2 rounded border border-border bg-background text-[11px]"
                    />
                    <input
                      type="date"
                      value={win.startDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraftPlan((p) => ({
                          ...p,
                          timeWindows: p.timeWindows.map((r, i) =>
                            i === idx ? { ...r, startDate: val } : r
                          ),
                        }));
                      }}
                      className="col-span-3 h-8 px-1.5 rounded border border-border bg-background text-[10px]"
                    />
                    <input
                      type="date"
                      value={win.endDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraftPlan((p) => ({
                          ...p,
                          timeWindows: p.timeWindows.map((r, i) =>
                            i === idx ? { ...r, endDate: val } : r
                          ),
                        }));
                      }}
                      className="col-span-3 h-8 px-1.5 rounded border border-border bg-background text-[10px]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDraftPlan((p) => ({
                          ...p,
                          timeWindows: p.timeWindows.filter((_, i) => i !== idx),
                        }))
                      }
                      className="col-span-2 flex justify-center text-muted-foreground hover:text-rose-500 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      placeholder="Batas Rp"
                      value={win.amount || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setDraftPlan((p) => ({
                          ...p,
                          timeWindows: p.timeWindows.map((r, i) =>
                            i === idx ? { ...r, amount: val } : r
                          ),
                        }));
                      }}
                      className="col-span-4 h-7 px-2 rounded border border-border/60 bg-background text-[10px] font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Sumber dana..."
                      value={win.sourceNote}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraftPlan((p) => ({
                          ...p,
                          timeWindows: p.timeWindows.map((r, i) =>
                            i === idx ? { ...r, sourceNote: val } : r
                          ),
                        }));
                      }}
                      className="col-span-8 h-7 px-2 rounded border border-border/60 bg-background text-[10px]"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditorOpen(false)}
                  className="w-1/2 h-9 rounded-md text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={upsertMutation.isPending}
                  className="w-1/2 h-9 rounded-md bg-primary hover:bg-[#047857] text-white text-xs font-semibold"
                >
                  {upsertMutation.isPending ? "Menyimpan..." : "Simpan Rencana Periode"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

