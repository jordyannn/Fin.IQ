"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useTranslation } from "@/i18n";
import { GeometricIcon } from "@/components/ui/GeometricIcon";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Trash2,
  Calendar,
  X,
} from "lucide-react";

export function MilestoneTrackingCard() {
  const { t, formatCurrency, formatDate, locale } = useTranslation();
  const isEn = locale === "en";
  const utils = trpc.useUtils();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [trackingType, setTrackingType] = useState<"account" | "category">("category");
  const [trackingId, setTrackingId] = useState("");
  const [trackingDirection, setTrackingDirection] = useState<"savings_goal" | "spending_limit">("spending_limit");
  
  // Default deadline: 30 days ahead
  const defaultDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [deadline, setDeadline] = useState(defaultDeadline);

  // Queries
  const { data: milestonesData, isLoading } = trpc.milestones.list.useQuery();
  const { data: accountsData } = trpc.accounts.list.useQuery();
  const { data: categoriesData } = trpc.categories.list.useQuery();

  // Mutations
  const createMutation = trpc.milestones.create.useMutation({
    onSuccess: () => {
      utils.milestones.invalidate();
      setIsModalOpen(false);
      resetForm();
    },
  });

  const toggleCompleteMutation = trpc.milestones.toggleComplete.useMutation({
    onSuccess: () => {
      utils.milestones.invalidate();
    },
  });

  const deleteMutation = trpc.milestones.delete.useMutation({
    onSuccess: () => {
      utils.milestones.invalidate();
    },
  });

  const resetForm = () => {
    setTitle("");
    setTargetAmount("");
    setTrackingType("category");
    setTrackingId("");
    setTrackingDirection("spending_limit");
    setDeadline(defaultDeadline);
  };

  const handleOpenModal = () => {
    resetForm();
    // Pre-select first category or account
    if (categoriesData && categoriesData.length > 0) {
      setTrackingId(categoriesData[0].id);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(targetAmount);
    if (!title.trim() || isNaN(amount) || amount <= 0 || !trackingId) return;

    createMutation.mutate({
      title: title.trim(),
      targetAmount: amount,
      trackingType,
      trackingId,
      trackingDirection,
      deadline: new Date(deadline),
    });
  };

  const activeAccounts = accountsData?.accounts?.filter((a) => !a.isHidden) || [];
  const totalBalance = activeAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  const getPlaceholder = () => {
    if (trackingType === "account") {
      if (trackingDirection === "spending_limit") {
        return trackingId === "all"
          ? isEn
            ? "e.g. Max Monthly Total Spending"
            : "Contoh: Batas Total Pengeluaran Bulan Ini"
          : isEn
          ? "e.g. Limit Account Spending"
          : "Contoh: Batas Pengeluaran Rekening Ini";
      }
      return trackingId === "all"
        ? isEn
          ? "e.g. Total Net Worth Target"
          : "Contoh: Target Total Tabungan / Saldo Bersih"
        : isEn
        ? "e.g. Save 10M in Emergency Fund"
        : "Contoh: Target Saldo Tabungan Dana Darurat";
    }
    return trackingDirection === "spending_limit"
      ? isEn
        ? "e.g. Limit Coffee / Dining Out"
        : "Contoh: Batas Jajan Kopi / Kuliner"
      : isEn
      ? "e.g. Save 5M for Vacation"
      : "Contoh: Tabung 5jt Liburan";
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-secondary flex items-center justify-center text-secondary-foreground">
            <GeometricIcon name="budgets" size="xs" active />
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
              {t.milestones.title}
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className="text-xs text-primary font-bold hover:underline flex items-center gap-1.5 active:scale-95 cursor-pointer py-1 px-2 rounded-lg hover:bg-primary/5 transition-all"
        >
          <GeometricIcon name="plus" size="xs" active />
          <span>{t.milestones.addNew}</span>
        </button>
      </div>

      {/* Milestone List Card */}
      <div className="space-y-2.5">
        {milestonesData?.map((m) => {
          const isOverdue = m.isOverdue;
          const isCompleted = m.isCompleted;
          const isOverBudget =
            m.trackingDirection === "spending_limit" &&
            m.currentAmount > m.targetAmount &&
            !isCompleted;
          const displayPercent = (m as any).rawPercent ?? m.percent;

          return (
            <Card
              key={m.id}
              className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 shadow-2xs hover:shadow-xs group ${
                isCompleted
                  ? "border-emerald-500/40 bg-emerald-500/[0.03]"
                  : isOverBudget
                  ? "border-rose-500/40 bg-rose-500/[0.03]"
                  : isOverdue
                  ? "border-rose-500/40 bg-rose-500/[0.03]"
                  : "border-border/80 bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex flex-col gap-2.5">
                {/* Header: Title + Days Left / Status + Percentage */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleCompleteMutation.mutate({ id: m.id })}
                      className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        isCompleted
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "border-border hover:border-primary text-transparent hover:text-muted-foreground"
                      }`}
                      title={isCompleted ? (isEn ? "Mark as active" : "Buka kembali") : t.milestones.markDone}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3px]" />
                    </button>

                    <span
                      className={`font-bold text-xs sm:text-sm text-foreground truncate ${
                        isCompleted ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {m.title}
                    </span>

                    {/* Status Badge */}
                    {isCompleted ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 px-2 font-bold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 shrink-0"
                      >
                        ✓ {t.milestones.completed}
                      </Badge>
                    ) : isOverBudget ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 px-2 font-bold border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10 shrink-0"
                      >
                        {t.milestones.overBudget}
                      </Badge>
                    ) : isOverdue ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 px-2 font-bold border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10 shrink-0"
                      >
                        {t.milestones.overdue}
                      </Badge>
                    ) : (
                      <span className="text-[10px] font-semibold text-muted-foreground/80 shrink-0">
                        {m.daysLeft} {t.milestones.daysLeft}
                      </span>
                    )}
                  </div>

                  {/* Percentage Number Display */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-sm sm:text-base font-black tracking-tight ${
                        isCompleted
                          ? "text-emerald-600 dark:text-emerald-400"
                          : isOverBudget
                          ? "text-rose-500"
                          : m.percent > 85
                          ? "text-amber-500"
                          : "text-primary"
                      }`}
                    >
                      {displayPercent}%
                    </span>

                    {/* Quick Delete Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(t.milestones.deleteConfirm)) {
                          deleteMutation.mutate({ id: m.id });
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-rose-500 transition-opacity rounded cursor-pointer"
                      title={isEn ? "Delete" : "Hapus"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Clean Progress Bar (Simple & Minimalist) */}
                <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isCompleted
                        ? "bg-emerald-500"
                        : isOverBudget
                        ? "bg-rose-500"
                        : isOverdue
                        ? "bg-rose-500"
                        : m.percent > 85
                        ? "bg-amber-500"
                        : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(m.percent, 100)}%` }}
                  />
                </div>

                {/* Subtitle Info: Tracking target & Amount ratio */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="capitalize font-semibold text-foreground/80">
                      {m.trackingId === "all" ? t.milestones.allAccountsShort : m.trackingName}
                    </span>
                    <span>•</span>
                    <span className="text-[10px]">
                      {m.trackingDirection === "spending_limit"
                        ? t.milestones.spendingLimit
                        : t.milestones.savingsGoal}
                    </span>
                  </div>

                  <div className="font-semibold text-foreground/90 shrink-0">
                    <span>{formatCurrency(m.currentAmount)}</span>
                    <span className="text-muted-foreground font-normal">
                      {" / "}
                      {formatCurrency(m.targetAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}

        {/* Empty State */}
        {(!milestonesData || milestonesData.length === 0) && !isLoading && (
          <button
            type="button"
            onClick={handleOpenModal}
            className="w-full p-5 sm:p-6 text-center text-xs text-muted-foreground border border-dashed rounded-2xl border-border/80 bg-card/40 hover:border-primary/50 hover:bg-primary/[0.02] transition-all cursor-pointer flex flex-col items-center justify-center gap-2 group active:scale-99"
          >
            <GeometricIcon
              name="budgets"
              size="lg"
              active={true}
              className="group-hover:scale-110 transition-transform"
            />
            <span className="font-medium text-foreground/80 max-w-sm">
              {t.milestones.noMilestones}
            </span>
          </button>
        )}
      </div>

      {/* Modal Tambah Milestone */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-card border border-border/80 shadow-2xl p-5 text-card-foreground max-h-[90vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-5"
          >
            {/* Mobile Drag Indicator */}
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted-foreground/30 sm:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <GeometricIcon name="budgets" size="sm" active={true} />
                <h2 className="text-sm font-bold text-foreground">
                  {t.milestones.createMilestone}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
              {/* Title */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {t.milestones.milestoneTitle}
                </label>
                <Input
                  type="text"
                  placeholder={getPlaceholder()}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9 rounded-md"
                  required
                />
              </div>

              {/* Tracking Type Toggle: Account vs Category */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {t.milestones.trackBy}
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted/60 border border-border/60">
                  <button
                    type="button"
                    onClick={() => {
                      setTrackingType("category");
                      if (categoriesData && categoriesData.length > 0) {
                        setTrackingId(categoriesData[0].id);
                      }
                    }}
                    className={`py-1.5 px-3 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      trackingType === "category"
                        ? "bg-card text-foreground shadow-xs border border-border/60"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.milestones.category}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTrackingType("account");
                      setTrackingId("all");
                    }}
                    className={`py-1.5 px-3 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      trackingType === "account"
                        ? "bg-card text-foreground shadow-xs border border-border/60"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.milestones.account}
                  </button>
                </div>
              </div>

              {/* Target Selection Dropdown */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {trackingType === "account" ? t.milestones.account : t.milestones.category}
                </label>
                {trackingType === "account" ? (
                  <select
                    value={trackingId}
                    onChange={(e) => setTrackingId(e.target.value)}
                    className="w-full h-9 rounded-md border border-border bg-card px-2.5 text-xs font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  >
                    <option value="" disabled>
                      {t.milestones.selectAccount}
                    </option>
                    <option value="all">
                      🌐 {t.milestones.allAccounts} — Total: {formatCurrency(totalBalance)}
                    </option>
                    {activeAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.group}) — {formatCurrency(acc.balance, acc.currency)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={trackingId}
                    onChange={(e) => setTrackingId(e.target.value)}
                    className="w-full h-9 rounded-md border border-border bg-card px-2.5 text-xs font-semibold text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  >
                    <option value="" disabled>
                      {t.milestones.selectCategory}
                    </option>
                    {categoriesData?.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.kind === "expense" ? (isEn ? "Expense" : "Pengeluaran") : (isEn ? "Income" : "Pemasukan")})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Direction (Spending Limit vs Savings / Income Goal) */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {t.milestones.directionLabel}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTrackingDirection("spending_limit")}
                    className={`p-2 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      trackingDirection === "spending_limit"
                        ? "border-primary bg-primary/5 text-primary font-bold ring-1 ring-primary/30"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="font-bold">{t.milestones.spendingLimit}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {trackingType === "account"
                        ? trackingId === "all"
                          ? isEn
                            ? "Track max overall spending"
                            : "Pantau batas total pengeluaran semua akun"
                          : isEn
                          ? "Track max spending on this account"
                          : "Pantau batas pengeluaran rekening ini"
                        : isEn
                        ? "Track max expense limit"
                        : "Pantau batas maksimal pengeluaran"}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTrackingDirection("savings_goal")}
                    className={`p-2 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      trackingDirection === "savings_goal"
                        ? "border-primary bg-primary/5 text-primary font-bold ring-1 ring-primary/30"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="font-bold">{t.milestones.savingsGoal}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {trackingType === "account"
                        ? trackingId === "all"
                          ? isEn
                            ? "Track total net balance across all accounts"
                            : "Pantau target total saldo seluruh akun"
                          : isEn
                          ? "Track target balance on this account"
                          : "Pantau target saldo rekening ini"
                        : isEn
                        ? "Track target income"
                        : "Pantau target pemasukan"}
                    </div>
                  </button>
                </div>
              </div>

              {/* Target Amount */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {t.milestones.targetAmount} (IDR)
                </label>
                <Input
                  type="number"
                  placeholder={isEn ? "e.g. 5000000" : "Contoh: 5000000"}
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  className="h-9 rounded-md"
                  required
                  min="1"
                  step="any"
                />
              </div>

              {/* Deadline Date */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {t.milestones.deadline}
                </label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="h-9 rounded-md"
                  required
                />
              </div>

              {/* Footer Buttons */}
              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-1/2 rounded-xl h-9 text-xs font-semibold cursor-pointer"
                  onClick={() => setIsModalOpen(false)}
                >
                  {t.common.cancel}
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-1/2 bg-primary hover:bg-[#047857] text-white rounded-xl h-9 text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all"
                >
                  {createMutation.isPending ? t.common.loading : t.common.save}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

