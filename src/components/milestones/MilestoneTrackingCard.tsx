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
  Pencil,
  ArrowRightLeft,
  RotateCcw,
} from "lucide-react";

function computeNextDateWindow(previousDeadline: Date | string): { nextStart: string; nextEnd: string } {
  const prevDate = new Date(previousDeadline);
  const nextStartDt = new Date(prevDate.getTime() + 24 * 60 * 60 * 1000);
  const nextStartWib = new Date(nextStartDt.getTime() + 7 * 60 * 60 * 1000);
  const year = nextStartWib.getUTCFullYear();
  const month = nextStartWib.getUTCMonth();
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
  const diffDays = Math.round((lastDayOfMonth.getTime() - nextStartWib.getTime()) / 86_400_000);

  let nextEndDt: Date;
  if (diffDays >= 7) {
    nextEndDt = lastDayOfMonth;
  } else {
    nextEndDt = new Date(nextStartDt.getTime() + 14 * 24 * 60 * 60 * 1000);
  }

  const startStr = nextStartDt.toISOString().slice(0, 10);
  const endStr = nextEndDt.toISOString().slice(0, 10);
  return { nextStart: startStr, nextEnd: endStr };
}

export interface MilestoneTrackingCardProps {
  hideHeaderAction?: boolean;
  onRequestCreateTarget?: () => void;
}

export function MilestoneTrackingCard({
  hideHeaderAction = false,
  onRequestCreateTarget,
}: MilestoneTrackingCardProps = {}) {
  const { t, formatCurrency, formatDate, locale } = useTranslation();
  const isEn = locale === "en";
  const utils = trpc.useUtils();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [trackingType, setTrackingType] = useState<"account" | "category">("category");
  const [trackingId, setTrackingId] = useState("");
  const [trackingDirection, setTrackingDirection] = useState<
    "savings_goal" | "spending_limit" | "income_goal"
  >("spending_limit");

  // Default window: today -> 30 days ahead
  const defaultStartDate = new Date(Date.now() + 7 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const defaultDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [deadline, setDeadline] = useState(defaultDeadline);

  // Queries
  const { data: milestonesData, isLoading } = trpc.milestones.list.useQuery();
  const { data: accountsData } = trpc.accounts.list.useQuery();
  const { data: categoriesData } = trpc.categories.list.useQuery();

  type MilestoneItem = NonNullable<typeof milestonesData>[number];

  // Edit State
  const [editingMilestone, setEditingMilestone] = useState<MilestoneItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTargetAmount, setEditTargetAmount] = useState("");
  const [editTrackingType, setEditTrackingType] = useState<"account" | "category">("category");
  const [editTrackingId, setEditTrackingId] = useState("");
  const [editTrackingDirection, setEditTrackingDirection] = useState<
    "savings_goal" | "spending_limit" | "income_goal"
  >("spending_limit");
  const [editStartDate, setEditStartDate] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editIsCustomFilled, setEditIsCustomFilled] = useState(false);
  const [editCustomFilledAmount, setEditCustomFilledAmount] = useState("");

  // Rollover State (Pindahkan Buffer ke Tanggal Berikutnya)
  const [rolloverMilestone, setRolloverMilestone] = useState<MilestoneItem | null>(null);
  const [rolloverAction, setRolloverAction] = useState<"update_current" | "create_next">("create_next");
  const [rolloverTitle, setRolloverTitle] = useState("");
  const [rolloverStartDate, setRolloverStartDate] = useState("");
  const [rolloverDeadline, setRolloverDeadline] = useState("");
  const [rolloverTargetAmount, setRolloverTargetAmount] = useState("");
  const [rolloverCustomFilled, setRolloverCustomFilled] = useState("0");

  // Mutations
  const createMutation = trpc.milestones.create.useMutation({
    onSuccess: () => {
      utils.milestones.invalidate();
      setIsModalOpen(false);
      resetForm();
    },
  });

  const updateMutation = trpc.milestones.update.useMutation({
    onSuccess: () => {
      utils.milestones.invalidate();
      setEditingMilestone(null);
    },
  });

  const rolloverMutation = trpc.milestones.rollover.useMutation({
    onSuccess: () => {
      utils.milestones.invalidate();
      setRolloverMilestone(null);
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
    setStartDate(defaultStartDate);
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
    if (startDate && deadline && startDate > deadline) return;

    createMutation.mutate({
      title: title.trim(),
      targetAmount: amount,
      trackingType,
      trackingId,
      trackingDirection,
      startDate: startDate ? new Date(`${startDate}T00:00:00+07:00`) : undefined,
      deadline: new Date(`${deadline}T23:59:59+07:00`),
    });
  };

  const handleOpenEditModal = (m: MilestoneItem) => {
    setEditingMilestone(m);
    setEditTitle(m.title);
    setEditTargetAmount(String(m.targetAmount));
    setEditTrackingType(m.trackingType);
    setEditTrackingId(m.trackingId);
    setEditTrackingDirection(m.trackingDirection);

    const startStr = new Date(new Date(m.startDate).getTime() + 7 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const deadlineStr = new Date(new Date(m.deadline).getTime() + 7 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    setEditStartDate(startStr);
    setEditDeadline(deadlineStr);

    const isCustom = m.isCustomAmount;
    setEditIsCustomFilled(isCustom);
    setEditCustomFilledAmount(
      isCustom && m.customCurrentAmount !== null && m.customCurrentAmount !== undefined
        ? String(m.customCurrentAmount)
        : String(m.currentAmount || 0)
    );
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMilestone) return;
    const amount = parseFloat(editTargetAmount);
    if (!editTitle.trim() || isNaN(amount) || amount <= 0 || !editTrackingId) return;
    if (editStartDate && editDeadline && editStartDate > editDeadline) return;

    let customAmt: number | null = null;
    if (editIsCustomFilled) {
      const parsedCustom = parseFloat(editCustomFilledAmount);
      customAmt = !isNaN(parsedCustom) && parsedCustom >= 0 ? parsedCustom : 0;
    }

    updateMutation.mutate({
      id: editingMilestone.id,
      title: editTitle.trim(),
      targetAmount: amount,
      trackingType: editTrackingType,
      trackingId: editTrackingId,
      trackingDirection: editTrackingDirection,
      startDate: editStartDate ? new Date(`${editStartDate}T00:00:00+07:00`) : undefined,
      deadline: new Date(`${editDeadline}T23:59:59+07:00`),
      customCurrentAmount: customAmt,
    });
  };

  const handleOpenRolloverModal = (m: MilestoneItem) => {
    setRolloverMilestone(m);
    const windowDates = computeNextDateWindow(m.deadline);
    setRolloverStartDate(windowDates.nextStart);
    setRolloverDeadline(windowDates.nextEnd);
    setRolloverTitle(`${m.title} (${isEn ? "Next Period" : "Periode Berikutnya"})`);

    const remaining = Math.max(0, m.targetAmount - m.currentAmount);
    setRolloverTargetAmount(String(remaining > 0 ? remaining : m.targetAmount));
    setRolloverCustomFilled("0");
    setRolloverAction("create_next");
  };

  const handleRolloverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rolloverMilestone) return;
    const targetAmt = parseFloat(rolloverTargetAmount);
    if (isNaN(targetAmt) || targetAmt <= 0) return;
    if (rolloverStartDate && rolloverDeadline && rolloverStartDate > rolloverDeadline) return;

    const customFilled = parseFloat(rolloverCustomFilled);
    const safeCustom = !isNaN(customFilled) && customFilled >= 0 ? customFilled : 0;

    rolloverMutation.mutate({
      id: rolloverMilestone.id,
      action: rolloverAction,
      nextTitle: rolloverTitle.trim() || undefined,
      nextStartDate: new Date(`${rolloverStartDate}T00:00:00+07:00`),
      nextDeadline: new Date(`${rolloverDeadline}T23:59:59+07:00`),
      nextTargetAmount: targetAmt,
      nextCustomCurrentAmount: safeCustom,
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
      {!hideHeaderAction && (
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
            onClick={() =>
              onRequestCreateTarget ? onRequestCreateTarget() : handleOpenModal()
            }
            className="text-xs text-primary font-bold hover:underline flex items-center gap-1.5 active:scale-95 cursor-pointer py-1 px-2 rounded-lg hover:bg-primary/5 transition-all"
          >
            <GeometricIcon name="plus" size="xs" active />
            <span>{t.milestones.addNew}</span>
          </button>
        </div>
      )}

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
                    ) : (m as { hasStarted?: boolean; daysUntilStart?: number }).hasStarted === false ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 px-2 font-semibold border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-500/10 shrink-0"
                      >
                        {(m as { daysUntilStart?: number }).daysUntilStart === 1
                          ? isEn
                            ? "Starts tomorrow"
                            : "Mulai besok"
                          : isEn
                            ? `Starts in ${(m as { daysUntilStart?: number }).daysUntilStart}d`
                            : `Mulai ${(m as { daysUntilStart?: number }).daysUntilStart} hr lagi`}
                      </Badge>
                    ) : (
                      <span className="text-[10px] font-semibold text-muted-foreground/80 shrink-0">
                        {m.daysLeft} {t.milestones.daysLeft}
                      </span>
                    )}
                    {/* Custom Filled Badge */}
                    {m.isCustomAmount && (
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 px-1.5 font-bold border-primary/30 text-primary dark:text-emerald-400 bg-primary/10 shrink-0"
                        title={
                          isEn
                            ? `Custom filled amount (auto from transactions: ${formatCurrency(m.computedAmount)})`
                            : `Nominal terisi kustom (aktual transaksi: ${formatCurrency(m.computedAmount)})`
                        }
                      >
                        ✎ {t.milestones.customBadge}
                      </Badge>
                    )}
                  </div>

                  {/* Percentage Number Display + Action Buttons */}
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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

                    {/* Action Buttons: Rollover, Edit, Delete */}
                    <div className="flex items-center gap-0.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {/* Pindahkan Buffer ke Tanggal Berikutnya */}
                      <button
                        type="button"
                        onClick={() => handleOpenRolloverModal(m)}
                        className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors rounded cursor-pointer"
                        title={t.milestones.rollover}
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(m)}
                        className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors rounded cursor-pointer"
                        title={t.milestones.edit}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      {/* Quick Delete Button */}
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(t.milestones.deleteConfirm)) {
                            deleteMutation.mutate({ id: m.id });
                          }
                        }}
                        className="p-1 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors rounded cursor-pointer"
                        title={isEn ? "Delete" : "Hapus"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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

                {/* Subtitle Info: Tracking target, date range & Amount ratio */}
                <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="capitalize font-semibold text-foreground/80">
                      {m.trackingId === "all" ? t.milestones.allAccountsShort : m.trackingName}
                    </span>
                    <span>•</span>
                    <span className="text-[10px]">
                      {m.trackingDirection === "spending_limit"
                        ? t.milestones.spendingLimit
                        : m.trackingDirection === "income_goal"
                          ? isEn
                            ? "Income Target"
                            : "Target Pemasukan"
                          : t.milestones.savingsGoal}
                    </span>
                    <span className="hidden sm:inline">•</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono">
                      <Calendar className="h-2.5 w-2.5" />
                      {formatDate((m as { startDate?: Date | string }).startDate || m.createdAt)} →{" "}
                      {formatDate(m.deadline)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {m.trackingDirection === "spending_limit" && (
                      <span className="text-[10px] text-muted-foreground hidden sm:inline">
                        {t.milestones.remainingBuffer}:{" "}
                        <strong className="text-foreground/80 font-mono">
                          {formatCurrency(Math.max(0, m.targetAmount - m.currentAmount))}
                        </strong>
                        {" •"}
                      </span>
                    )}
                    <div className="font-semibold text-foreground/90 shrink-0 tabular-nums">
                      <span>{formatCurrency(m.currentAmount)}</span>
                      <span className="text-muted-foreground font-normal">
                        {" / "}
                        {formatCurrency(m.targetAmount)}
                      </span>
                    </div>
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
            onClick={() =>
              onRequestCreateTarget ? onRequestCreateTarget() : handleOpenModal()
            }
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                            ? "Max spending across all accounts"
                            : "Batas total pengeluaran seluruh akun"
                          : isEn
                            ? "Max spending on this account"
                            : "Batas belanja rekening ini"
                        : isEn
                          ? "Max category expense"
                          : "Batas maksimal kategori"}
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
                            ? "Target total ending balance"
                            : "Target total saldo akhir seluruh akun"
                          : isEn
                            ? "Target balance on this account"
                            : "Target saldo rekening ini"
                        : isEn
                          ? "Target category inflow"
                          : "Target saldo kategori"}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTrackingDirection("income_goal")}
                    className={`p-2 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      trackingDirection === "income_goal"
                        ? "border-primary bg-primary/5 text-primary font-bold ring-1 ring-primary/30"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="font-bold">
                      {isEn ? "Income Target" : "Target Pemasukan"}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {trackingType === "account"
                        ? trackingId === "all"
                          ? isEn
                            ? "Track total inflow across all accounts"
                            : "Total pemasukan semua akun di rentang tanggal"
                          : isEn
                            ? "Track inflow on this account"
                            : "Pemasukan rekening di rentang tanggal"
                        : isEn
                          ? "Track category income"
                          : "Pemasukan kategori di rentang tanggal"}
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

              {/* Start Date (Dari Tanggal / Sebelum) & Deadline Date (Sampai Tanggal) */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    {isEn ? "Start Date" : "Dari Tanggal"}
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    {isEn ? "End Date" : "Sampai Tanggal"}
                  </label>
                  <Input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="h-9 rounded-md"
                    required
                  />
                </div>
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

      {/* Modal Edit Milestone / Target */}
      {editingMilestone && (
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
                  {t.milestones.editMilestone}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingMilestone(null)}
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3.5 text-xs">
              {/* Title */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {t.milestones.milestoneTitle}
                </label>
                <Input
                  type="text"
                  placeholder={getPlaceholder()}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="h-9 rounded-md"
                  required
                />
              </div>

              {/* Tracking Type Toggle: Category vs Account */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {t.milestones.trackBy}
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted/60 border border-border/60">
                  <button
                    type="button"
                    onClick={() => {
                      setEditTrackingType("category");
                      if (categoriesData && categoriesData.length > 0) {
                        setEditTrackingId(categoriesData[0].id);
                      }
                    }}
                    className={`py-1.5 px-3 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      editTrackingType === "category"
                        ? "bg-card text-foreground shadow-xs border border-border/60"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.milestones.category}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditTrackingType("account");
                      setEditTrackingId("all");
                    }}
                    className={`py-1.5 px-3 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      editTrackingType === "account"
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
                  {editTrackingType === "account" ? t.milestones.account : t.milestones.category}
                </label>
                {editTrackingType === "account" ? (
                  <select
                    value={editTrackingId}
                    onChange={(e) => setEditTrackingId(e.target.value)}
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
                    value={editTrackingId}
                    onChange={(e) => setEditTrackingId(e.target.value)}
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

              {/* Direction */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {t.milestones.directionLabel}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditTrackingDirection("spending_limit")}
                    className={`p-2 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      editTrackingDirection === "spending_limit"
                        ? "border-primary bg-primary/5 text-primary font-bold ring-1 ring-primary/30"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="font-bold">{t.milestones.spendingLimit}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTrackingDirection("savings_goal")}
                    className={`p-2 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      editTrackingDirection === "savings_goal"
                        ? "border-primary bg-primary/5 text-primary font-bold ring-1 ring-primary/30"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="font-bold">{t.milestones.savingsGoal}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTrackingDirection("income_goal")}
                    className={`p-2 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      editTrackingDirection === "income_goal"
                        ? "border-primary bg-primary/5 text-primary font-bold ring-1 ring-primary/30"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="font-bold">{isEn ? "Income Target" : "Target Pemasukan"}</div>
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
                  value={editTargetAmount}
                  onChange={(e) => setEditTargetAmount(e.target.value)}
                  className="h-9 rounded-md"
                  required
                  min="1"
                  step="any"
                />
              </div>

              {/* Date Range: Dari Tanggal & Sampai Tanggal */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    {isEn ? "Start Date" : "Dari Tanggal"}
                  </label>
                  <Input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="h-9 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    {isEn ? "End Date" : "Sampai Tanggal"}
                  </label>
                  <Input
                    type="date"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="h-9 rounded-md"
                    required
                  />
                </div>
              </div>

              {/* CUSTOM YANG SUDAH KEISI (FILLED AMOUNT OVERRIDE) */}
              <div className="p-3 rounded-2xl border border-border/80 bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-foreground text-xs block">
                      {t.milestones.filledAmount}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {isEn
                        ? "Customize progress bar manually or move buffer"
                        : "Kustomisasi progres bar atau sesuaikan buffer"}
                    </span>
                  </div>
                  <div className="flex rounded-lg border border-border p-0.5 bg-card">
                    <button
                      type="button"
                      onClick={() => setEditIsCustomFilled(false)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                        !editIsCustomFilled
                          ? "bg-primary text-white shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.milestones.filledAuto}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditIsCustomFilled(true)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                        editIsCustomFilled
                          ? "bg-primary text-white shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.milestones.filledCustom}
                    </button>
                  </div>
                </div>

                {editIsCustomFilled ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={editCustomFilledAmount}
                        onChange={(e) => setEditCustomFilledAmount(e.target.value)}
                        placeholder="0"
                        className="h-9 rounded-md font-mono"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setEditCustomFilledAmount("0")}
                        className="px-2.5 h-9 rounded-md border border-border bg-card text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 cursor-pointer"
                        title={isEn ? "Reset filled to 0" : "Jadikan 0 (Buffer Kosong)"}
                      >
                        Rp 0
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {isEn
                        ? `Auto from transactions: ${formatCurrency(editingMilestone.computedAmount ?? 0)}`
                        : `Otomatis dari transaksi: ${formatCurrency(editingMilestone.computedAmount ?? 0)}`}
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {isEn ? "Calculated from transactions: " : "Dihitung dari riwayat transaksi: "}
                    <span className="font-bold text-foreground">
                      {formatCurrency(editingMilestone.computedAmount ?? 0)}
                    </span>
                  </p>
                )}
              </div>

              {/* Footer Buttons */}
              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-1/2 rounded-xl h-9 text-xs font-semibold cursor-pointer"
                  onClick={() => setEditingMilestone(null)}
                >
                  {t.common.cancel}
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="w-1/2 bg-primary hover:bg-[#047857] text-white rounded-xl h-9 text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all"
                >
                  {updateMutation.isPending ? t.common.loading : t.common.save}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pindahkan Buffer ke Tanggal Berikutnya (Rollover) */}
      {rolloverMilestone && (
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
                <div className="h-7 w-7 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <ArrowRightLeft className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-foreground">
                  {t.milestones.rolloverTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setRolloverMilestone(null)}
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRolloverSubmit} className="mt-4 space-y-3.5 text-xs">
              {/* Summary of Current Buffer */}
              <div className="p-3.5 rounded-2xl border border-primary/20 bg-primary/5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Target Saat Ini:
                  </span>
                  <span className="font-bold text-foreground truncate max-w-[200px]">
                    {rolloverMilestone.title}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Total Plafon / Terisi:</span>
                  <span className="font-medium text-foreground tabular-nums">
                    {formatCurrency(rolloverMilestone.targetAmount)} (terpakai {formatCurrency(rolloverMilestone.currentAmount)})
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-primary/15 text-xs font-bold text-primary">
                  <span>{t.milestones.remainingBuffer}:</span>
                  <span className="tabular-nums text-sm">
                    {formatCurrency(Math.max(0, rolloverMilestone.targetAmount - rolloverMilestone.currentAmount))}
                  </span>
                </div>
              </div>

              {/* Action Mode Choice */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Pilih Cara Pemindahan:
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setRolloverAction("create_next")}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      rolloverAction === "create_next"
                        ? "border-primary bg-primary/5 text-primary font-bold ring-1 ring-primary/30"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <span>✨</span>
                      <span>{t.milestones.actionCreateNext}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Target lama selesai rapi tercatat, dibuat target baru untuk tanggal berikutnya.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRolloverAction("update_current")}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      rolloverAction === "update_current"
                        ? "border-primary bg-primary/5 text-primary font-bold ring-1 ring-primary/30"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <span>🔄</span>
                      <span>{t.milestones.actionUpdateCurrent}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Menggeser rentang tanggal target yang sama langsung ke periode berikutnya.
                    </div>
                  </button>
                </div>
              </div>

              {/* New Title */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {t.milestones.milestoneTitle} Periode Baru
                </label>
                <Input
                  type="text"
                  value={rolloverTitle}
                  onChange={(e) => setRolloverTitle(e.target.value)}
                  className="h-9 rounded-md"
                  required
                />
              </div>

              {/* Date Range for New Period */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    {isEn ? "New Start Date" : "Dari Tanggal Baru"}
                  </label>
                  <Input
                    type="date"
                    value={rolloverStartDate}
                    onChange={(e) => setRolloverStartDate(e.target.value)}
                    className="h-9 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    {isEn ? "New End Date" : "Sampai Tanggal Baru"}
                  </label>
                  <Input
                    type="date"
                    value={rolloverDeadline}
                    onChange={(e) => setRolloverDeadline(e.target.value)}
                    className="h-9 rounded-md"
                    required
                  />
                </div>
              </div>

              {/* Target Nominal Periode Baru */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Target Nominal Periode Baru (IDR)
                </label>
                <Input
                  type="number"
                  min="1"
                  step="any"
                  value={rolloverTargetAmount}
                  onChange={(e) => setRolloverTargetAmount(e.target.value)}
                  className="h-9 rounded-md font-mono"
                  required
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Otomatis terisi sisa buffer (Rp {formatCurrency(Math.max(0, rolloverMilestone.targetAmount - rolloverMilestone.currentAmount))}), dapat Anda tambah/ubah jika perlu.
                </p>
              </div>

              {/* Terisi di Periode Baru */}
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Nominal Sudah Terisi di Periode Baru (IDR)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={rolloverCustomFilled}
                  onChange={(e) => setRolloverCustomFilled(e.target.value)}
                  className="h-9 rounded-md font-mono"
                  required
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Default 0 untuk memulai buffer bersih di tanggal berikutnya.
                </p>
              </div>

              {/* Footer Buttons */}
              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-1/2 rounded-xl h-9 text-xs font-semibold cursor-pointer"
                  onClick={() => setRolloverMilestone(null)}
                >
                  {t.common.cancel}
                </Button>
                <Button
                  type="submit"
                  disabled={rolloverMutation.isPending}
                  className="w-1/2 bg-primary hover:bg-[#047857] text-white rounded-xl h-9 text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all"
                >
                  {rolloverMutation.isPending ? t.common.loading : "Pindahkan Sekarang"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

