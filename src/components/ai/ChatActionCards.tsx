"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Edit3,
  Loader2,
  PiggyBank,
  Receipt,
  Save,
  Target,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import type { ChatActionDraft } from "@/lib/ai-chat-actions";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ChatActionCardsProps {
  sessionId?: string;
  messageId: string;
  drafts: ChatActionDraft[];
  isEn?: boolean;
  compact?: boolean;
  onDraftsUpdated?: (messageId: string, nextDrafts: ChatActionDraft[]) => void;
}

function toLocalDateTimeInput(isoStr?: string): string {
  const dt = isoStr ? new Date(isoStr) : new Date();
  if (Number.isNaN(dt.getTime())) return new Date().toISOString().slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function getDraftValidationError(
  draft: ChatActionDraft,
  isEn: boolean
): string | null {
  if (draft.kind === "transaction") {
    if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
      return isEn
        ? "Amount must be greater than 0."
        : "Nominal transaksi harus lebih dari Rp 0.";
    }
    if (!draft.accountId) {
      return isEn
        ? "No account selected. Select or create an account first."
        : "Belum ada akun dipilih. Pilih atau buat akun terlebih dahulu.";
    }
    if (
      draft.txType === "transfer" &&
      (!draft.toAccountId || draft.toAccountId === draft.accountId)
    ) {
      return isEn
        ? "Transfer destination must differ from source account."
        : "Pilih akun tujuan transfer yang berbeda dari akun asal.";
    }
    return null;
  }

  if (draft.kind === "budget") {
    if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
      return isEn
        ? "Budget amount must be greater than 0."
        : "Nominal anggaran harus lebih dari Rp 0.";
    }
    if (!draft.categoryId) {
      return isEn
        ? "Select an expense category first."
        : "Pilih kategori pengeluaran terlebih dahulu.";
    }
    return null;
  }

  if (!draft.title.trim()) {
    return isEn ? "Target title is required." : "Judul target wajib diisi.";
  }
  if (!Number.isFinite(draft.targetAmount) || draft.targetAmount <= 0) {
    return isEn
      ? "Target amount must be greater than 0."
      : "Nominal target harus lebih dari Rp 0.";
  }
  if (!draft.trackingId) {
    return isEn
      ? "Select tracked account or category."
      : "Pilih akun atau kategori yang dipantau.";
  }
  return null;
}

function buildOverridesFromDraft(draft: ChatActionDraft) {
  if (draft.kind === "transaction") {
    return {
      txType: draft.txType,
      amount: draft.amount,
      happenedAt: draft.happenedAt,
      note: draft.note,
      ledgerId: draft.ledgerId,
      accountId: draft.accountId,
      toAccountId: draft.toAccountId,
      categoryId: draft.categoryId,
    };
  }
  if (draft.kind === "budget") {
    return {
      ledgerId: draft.ledgerId,
      categoryId: draft.categoryId,
      month: draft.month,
      amount: draft.amount,
    };
  }
  return {
    title: draft.title,
    targetAmount: draft.targetAmount,
    trackingType: draft.trackingType,
    trackingId: draft.trackingId,
    trackingDirection: draft.trackingDirection,
    startDate: draft.startDate,
    deadline: draft.deadline,
  };
}

export function ChatActionCards({
  sessionId,
  messageId,
  drafts,
  isEn = false,
  compact = false,
  onDraftsUpdated,
}: ChatActionCardsProps) {
  const utils = trpc.useUtils();
  const [localDrafts, setLocalDrafts] = useState<ChatActionDraft[]>(drafts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingDraftId, setSavingDraftId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    setLocalDrafts(drafts);
  }, [drafts]);

  const hasPending = localDrafts.some((d) => d.status === "pending");

  const { data: accountsRes } = trpc.accounts.list.useQuery(undefined, {
    enabled: hasPending || editingId !== null,
    staleTime: 60_000,
  });
  const { data: categoriesList } = trpc.categories.list.useQuery(undefined, {
    enabled: hasPending || editingId !== null,
    staleTime: 60_000,
  });
  const { data: ledgersList } = trpc.ledgers.list.useQuery(undefined, {
    enabled: hasPending || editingId !== null,
    staleTime: 60_000,
  });

  const userAccounts = accountsRes?.accounts ?? [];
  const userCategories = categoriesList ?? [];
  const userLedgers = ledgersList ?? [];

  const invalidateAfterMutation = () => {
    utils.transactions.invalidate();
    utils.accounts.invalidate();
    utils.analytics.invalidate();
    utils.budgets.invalidate();
    utils.milestones.invalidate();
    if (sessionId) {
      utils.ai.getChatSession.invalidate({ sessionId });
    }
  };

  const executeOneMutation = trpc.ai.executeChatActionDraft.useMutation({
    onSuccess: (res) => {
      setErrorText(null);
      setSavingDraftId(null);
      setEditingId(null);
      setLocalDrafts(res.drafts);
      onDraftsUpdated?.(messageId, res.drafts);
      invalidateAfterMutation();
    },
    onError: (err) => {
      setSavingDraftId(null);
      setErrorText(err.message);
    },
  });

  const executeBatchMutation = trpc.ai.executeChatActionBatch.useMutation({
    onSuccess: (res) => {
      setErrorText(null);
      setSavingDraftId(null);
      setEditingId(null);
      setLocalDrafts(res.drafts);
      onDraftsUpdated?.(messageId, res.drafts);
      invalidateAfterMutation();
    },
    onError: (err) => {
      setSavingDraftId(null);
      setErrorText(err.message);
    },
  });

  const dismissMutation = trpc.ai.dismissChatActionDraft.useMutation({
    onSuccess: (res) => {
      setErrorText(null);
      setSavingDraftId(null);
      setEditingId(null);
      setLocalDrafts(res.drafts);
      onDraftsUpdated?.(messageId, res.drafts);
      if (sessionId) {
        utils.ai.getChatSession.invalidate({ sessionId });
      }
    },
    onError: (err) => {
      setSavingDraftId(null);
      setErrorText(err.message);
    },
  });

  const pendingDrafts = useMemo(
    () => localDrafts.filter((d) => d.status === "pending"),
    [localDrafts]
  );

  const validPendingDrafts = useMemo(
    () =>
      pendingDrafts.filter((d) => getDraftValidationError(d, isEn) === null),
    [pendingDrafts, isEn]
  );

  if (!localDrafts || localDrafts.length === 0) return null;

  const updateLocalDraft = (
    draftId: string,
    updater: (prev: ChatActionDraft) => ChatActionDraft
  ) => {
    setLocalDrafts((prev) =>
      prev.map((d) => (d.id === draftId ? updater(d) : d))
    );
  };

  const handleSaveOne = (draft: ChatActionDraft) => {
    if (!sessionId || !messageId) return;
    const validationErr = getDraftValidationError(draft, isEn);
    if (validationErr) {
      setErrorText(validationErr);
      return;
    }
    setSavingDraftId(draft.id);
    executeOneMutation.mutate({
      sessionId,
      messageId,
      draftId: draft.id,
      overrides: buildOverridesFromDraft(draft),
    });
  };

  const handleSaveBatch = () => {
    if (!sessionId || !messageId || validPendingDrafts.length === 0) return;
    setSavingDraftId("batch");
    executeBatchMutation.mutate({
      sessionId,
      messageId,
      items: validPendingDrafts.map((d) => ({
        draftId: d.id,
        overrides: buildOverridesFromDraft(d),
      })),
    });
  };

  const handleDismissOne = (draftId: string) => {
    if (!sessionId || !messageId) return;
    setSavingDraftId(draftId);
    dismissMutation.mutate({
      sessionId,
      messageId,
      draftId,
    });
  };

  const isMutating =
    executeOneMutation.isPending ||
    executeBatchMutation.isPending ||
    dismissMutation.isPending;

  return (
    <div className="mt-3 pt-3 border-t border-border/50 space-y-2.5">
      {/* Header bar with Batch Save when >1 valid pending drafts exist */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-muted-foreground">
          {isEn
            ? `Action Drafts (${localDrafts.length})`
            : `Draf Aksi Konfirmasi (${localDrafts.length})`}
        </span>

        {validPendingDrafts.length > 1 && sessionId && (
          <button
            type="button"
            disabled={isMutating}
            onClick={handleSaveBatch}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary hover:bg-[#047857] text-white text-[11px] font-semibold shadow-2xs disabled:opacity-50 cursor-pointer transition-colors"
          >
            {savingDraftId === "batch" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            <span>
              {isEn
                ? `Save All (${validPendingDrafts.length})`
                : `Simpan Semua (${validPendingDrafts.length})`}
            </span>
          </button>
        )}
      </div>

      {errorText && (
        <div className="flex items-start gap-1.5 p-2 rounded-md bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-[11px]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{errorText}</span>
        </div>
      )}

      <div className="space-y-2">
        {localDrafts.map((draft) => {
          const isEditing = editingId === draft.id && draft.status === "pending";
          const validationError =
            draft.status === "pending"
              ? getDraftValidationError(draft, isEn)
              : null;

          const isSaved = draft.status === "saved";
          const isDismissed = draft.status === "dismissed";

          const kindBadge =
            draft.kind === "transaction"
              ? {
                  icon: Receipt,
                  label:
                    draft.txType === "expense"
                      ? isEn
                        ? "Expense"
                        : "Pengeluaran"
                      : draft.txType === "income"
                        ? isEn
                          ? "Income"
                          : "Pemasukan"
                        : "Transfer",
                  cls:
                    draft.txType === "income"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : draft.txType === "transfer"
                        ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
                }
              : draft.kind === "budget"
                ? {
                    icon: PiggyBank,
                    label: isEn ? "Monthly Budget" : "Anggaran Bulanan",
                    cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                  }
                : {
                    icon: Target,
                    label:
                      draft.trackingDirection === "spending_limit"
                        ? isEn
                          ? "Spending Limit"
                          : "Batas Pengeluaran"
                        : isEn
                          ? "Savings Target"
                          : "Target Tabungan",
                    cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
                  };

          const KindIcon = kindBadge.icon;

          return (
            <div
              key={draft.id}
              className={`rounded-lg border p-2.5 sm:p-3 transition-colors ${
                isSaved
                  ? "bg-emerald-500/5 border-emerald-500/25"
                  : isDismissed
                    ? "bg-muted/20 border-border/40 opacity-60"
                    : "bg-background/90 border-border/80"
              }`}
            >
              {/* Card Top Row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${kindBadge.cls}`}
                  >
                    <KindIcon className="h-3 w-3 shrink-0" />
                    <span>{kindBadge.label}</span>
                  </span>

                  {isSaved && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{isEn ? "Saved" : "Tersimpan"}</span>
                    </span>
                  )}
                  {isDismissed && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-medium">
                      {isEn ? "Dismissed" : "Diabaikan"}
                    </span>
                  )}
                </div>

                <span className="font-mono text-xs sm:text-sm font-bold text-foreground tabular-nums shrink-0">
                  {formatCurrency(
                    draft.kind === "milestone"
                      ? draft.targetAmount
                      : draft.amount,
                    draft.kind === "transaction" ? draft.currency : "IDR"
                  )}
                </span>
              </div>

              {/* Summary Details */}
              {!isEditing && (
                <div className="mt-1.5 text-[11px] text-muted-foreground space-y-0.5">
                  {draft.kind === "transaction" && (
                    <>
                      <p className="font-medium text-foreground truncate">
                        {draft.note || "-"}
                      </p>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>
                          {draft.accountName || (isEn ? "Select account" : "Pilih akun")}
                          {draft.txType === "transfer" && draft.toAccountName
                            ? ` → ${draft.toAccountName}`
                            : ""}
                        </span>
                        {draft.txType !== "transfer" && draft.categoryName && (
                          <span>• {draft.categoryName}</span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          • <Calendar className="h-2.5 w-2.5" />
                          {formatDate(draft.happenedAt)}
                        </span>
                      </p>
                    </>
                  )}

                  {draft.kind === "budget" && (
                    <>
                      <p className="font-medium text-foreground">
                        {draft.categoryName || "-"} ({draft.month})
                      </p>
                      <p>{draft.ledgerName || "Buku Kas Utama"}</p>
                    </>
                  )}

                  {draft.kind === "milestone" && (
                    <>
                      <p className="font-medium text-foreground">{draft.title}</p>
                      <p className="flex flex-wrap items-center gap-x-2">
                        <span>
                          {draft.trackingType === "category"
                            ? isEn
                              ? "Category"
                              : "Kategori"
                            : isEn
                              ? "Account"
                              : "Akun"}
                          : {draft.trackingName}
                        </span>
                        {draft.startDate && (
                          <span>
                            • {formatDate(draft.startDate)} →{" "}
                            {draft.deadline ? formatDate(draft.deadline) : "-"}
                          </span>
                        )}
                        {!draft.startDate && draft.deadline && (
                          <span>• Deadline: {formatDate(draft.deadline)}</span>
                        )}
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Inline Quick-Edit Form */}
              {isEditing && draft.kind === "transaction" && (
                <div className="mt-2.5 pt-2.5 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">
                      {isEn ? "Type" : "Tipe"}
                    </label>
                    <select
                      value={draft.txType}
                      onChange={(e) => {
                        const nextType = e.target.value as
                          | "expense"
                          | "income"
                          | "transfer";
                        const firstCat = userCategories.find(
                          (c) => c.kind === nextType
                        );
                        updateLocalDraft(draft.id, (d) =>
                          d.kind !== "transaction"
                            ? d
                            : {
                                ...d,
                                txType: nextType,
                                categoryId:
                                  nextType === "transfer"
                                    ? undefined
                                    : firstCat?.id,
                                categoryName:
                                  nextType === "transfer"
                                    ? undefined
                                    : firstCat?.name,
                              }
                        );
                      }}
                      className="w-full h-8 px-2 rounded border border-border bg-card text-foreground"
                    >
                      <option value="expense">Pengeluaran</option>
                      <option value="income">Pemasukan</option>
                      <option value="transfer">Transfer</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">
                      {isEn ? "Amount" : "Nominal"}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={draft.amount || ""}
                      onChange={(e) => {
                        const num = Number(e.target.value);
                        updateLocalDraft(draft.id, (d) =>
                          d.kind !== "transaction"
                            ? d
                            : { ...d, amount: Number.isFinite(num) ? num : 0 }
                        );
                      }}
                      className="w-full h-8 px-2 rounded border border-border bg-card text-foreground font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-muted-foreground mb-0.5">
                      {isEn ? "Note" : "Catatan"}
                    </label>
                    <input
                      type="text"
                      value={draft.note}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateLocalDraft(draft.id, (d) =>
                          d.kind !== "transaction" ? d : { ...d, note: val }
                        );
                      }}
                      className="w-full h-8 px-2 rounded border border-border bg-card text-foreground"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">
                      {draft.txType === "transfer"
                        ? isEn
                          ? "From Account"
                          : "Dari Akun"
                        : isEn
                          ? "Account"
                          : "Akun"}
                    </label>
                    <select
                      value={draft.accountId}
                      onChange={(e) => {
                        const acc = userAccounts.find(
                          (a) => a.id === e.target.value
                        );
                        updateLocalDraft(draft.id, (d) =>
                          d.kind !== "transaction"
                            ? d
                            : {
                                ...d,
                                accountId: acc?.id ?? "",
                                accountName: acc?.name ?? "",
                              }
                        );
                      }}
                      className="w-full h-8 px-2 rounded border border-border bg-card text-foreground"
                    >
                      <option value="">-- Pilih Akun --</option>
                      {userAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {draft.txType === "transfer" ? (
                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-0.5">
                        {isEn ? "To Account" : "Ke Akun"}
                      </label>
                      <select
                        value={draft.toAccountId || ""}
                        onChange={(e) => {
                          const acc = userAccounts.find(
                            (a) => a.id === e.target.value
                          );
                          updateLocalDraft(draft.id, (d) =>
                            d.kind !== "transaction"
                              ? d
                              : {
                                  ...d,
                                  toAccountId: acc?.id,
                                  toAccountName: acc?.name,
                                }
                          );
                        }}
                        className="w-full h-8 px-2 rounded border border-border bg-card text-foreground"
                      >
                        <option value="">-- Pilih Akun Tujuan --</option>
                        {userAccounts
                          .filter((a) => a.id !== draft.accountId)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-0.5">
                        {isEn ? "Category" : "Kategori"}
                      </label>
                      <select
                        value={draft.categoryId || ""}
                        onChange={(e) => {
                          const cat = userCategories.find(
                            (c) => c.id === e.target.value
                          );
                          updateLocalDraft(draft.id, (d) =>
                            d.kind !== "transaction"
                              ? d
                              : {
                                  ...d,
                                  categoryId: cat?.id,
                                  categoryName: cat?.name,
                                }
                          );
                        }}
                        className="w-full h-8 px-2 rounded border border-border bg-card text-foreground"
                      >
                        <option value="">-- Pilih Kategori --</option>
                        {userCategories
                          .filter((c) => c.kind === draft.txType)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">
                      {isEn ? "Ledger" : "Buku Kas"}
                    </label>
                    <select
                      value={draft.ledgerId}
                      onChange={(e) => {
                        const ldg = userLedgers.find(
                          (l) => l.id === e.target.value
                        );
                        updateLocalDraft(draft.id, (d) =>
                          d.kind !== "transaction"
                            ? d
                            : {
                                ...d,
                                ledgerId: ldg?.id ?? "",
                                ledgerName: ldg?.name ?? "",
                              }
                        );
                      }}
                      className="w-full h-8 px-2 rounded border border-border bg-card text-foreground"
                    >
                      {userLedgers.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">
                      {isEn ? "Date & Time" : "Tanggal & Jam"}
                    </label>
                    <input
                      type="datetime-local"
                      value={toLocalDateTimeInput(draft.happenedAt)}
                      onChange={(e) => {
                        const dt = new Date(e.target.value);
                        if (!Number.isNaN(dt.getTime())) {
                          updateLocalDraft(draft.id, (d) =>
                            d.kind !== "transaction"
                              ? d
                              : { ...d, happenedAt: dt.toISOString() }
                          );
                        }
                      }}
                      className="w-full h-8 px-2 rounded border border-border bg-card text-foreground"
                    />
                  </div>
                </div>
              )}

              {isEditing && draft.kind === "budget" && (
                <div className="mt-2.5 pt-2.5 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">
                      {isEn ? "Expense Category" : "Kategori Pengeluaran"}
                    </label>
                    <select
                      value={draft.categoryId}
                      onChange={(e) => {
                        const cat = userCategories.find(
                          (c) => c.id === e.target.value
                        );
                        updateLocalDraft(draft.id, (d) =>
                          d.kind !== "budget"
                            ? d
                            : {
                                ...d,
                                categoryId: cat?.id ?? "",
                                categoryName: cat?.name ?? "",
                              }
                        );
                      }}
                      className="w-full h-8 px-2 rounded border border-border bg-card text-foreground"
                    >
                      <option value="">-- Pilih Kategori --</option>
                      {userCategories
                        .filter((c) => c.kind === "expense")
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">
                      {isEn ? "Monthly Limit" : "Pagu Bulanan"}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={draft.amount || ""}
                      onChange={(e) => {
                        const num = Number(e.target.value);
                        updateLocalDraft(draft.id, (d) =>
                          d.kind !== "budget"
                            ? d
                            : { ...d, amount: Number.isFinite(num) ? num : 0 }
                        );
                      }}
                      className="w-full h-8 px-2 rounded border border-border bg-card text-foreground font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">
                      {isEn ? "Month" : "Bulan"}
                    </label>
                    <input
                      type="month"
                      value={draft.month}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateLocalDraft(draft.id, (d) =>
                          d.kind !== "budget" ? d : { ...d, month: val }
                        );
                      }}
                      className="w-full h-8 px-2 rounded border border-border bg-card text-foreground"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">
                      {isEn ? "Ledger" : "Buku Kas"}
                    </label>
                    <select
                      value={draft.ledgerId}
                      onChange={(e) => {
                        const ldg = userLedgers.find(
                          (l) => l.id === e.target.value
                        );
                        updateLocalDraft(draft.id, (d) =>
                          d.kind !== "budget"
                            ? d
                            : {
                                ...d,
                                ledgerId: ldg?.id ?? "",
                                ledgerName: ldg?.name ?? "",
                              }
                        );
                      }}
                      className="w-full h-8 px-2 rounded border border-border bg-card text-foreground"
                    >
                      {userLedgers.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {isEditing && draft.kind === "milestone" && (
                <div className="mt-2.5 pt-2.5 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-muted-foreground mb-0.5">
                      {isEn ? "Target Title" : "Judul Target"}
                    </label>
                    <input
                      type="text"
                      value={draft.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateLocalDraft(draft.id, (d) =>
                          d.kind !== "milestone" ? d : { ...d, title: val }
                        );
                      }}
                      className="w-full h-8 px-2 rounded border border-border bg-card text-foreground"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">
                      {isEn ? "Target Amount" : "Nominal Target"}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={draft.targetAmount || ""}
                      onChange={(e) => {
                        const num = Number(e.target.value);
                        updateLocalDraft(draft.id, (d) =>
                          d.kind !== "milestone"
                            ? d
                            : {
                                ...d,
                                targetAmount: Number.isFinite(num) ? num : 0,
                              }
                        );
                      }}
                      className="w-full h-8 px-2 rounded border border-border bg-card text-foreground font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">
                      {isEn ? "Start Date" : "Dari Tanggal"}
                    </label>
                    <input
                      type="date"
                      value={(draft.startDate || "").slice(0, 10)}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateLocalDraft(draft.id, (d) =>
                          d.kind !== "milestone" ? d : { ...d, startDate: val }
                        );
                      }}
                      className="w-full h-8 px-2 rounded border border-border bg-card text-foreground"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">
                      {isEn ? "End Date" : "Sampai Tanggal"}
                    </label>
                    <input
                      type="date"
                      value={(draft.deadline || "").slice(0, 10)}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateLocalDraft(draft.id, (d) =>
                          d.kind !== "milestone" ? d : { ...d, deadline: val }
                        );
                      }}
                      className="w-full h-8 px-2 rounded border border-border bg-card text-foreground"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">
                      {isEn ? "Mode" : "Jenis Target"}
                    </label>
                    <select
                      value={draft.trackingDirection}
                      onChange={(e) => {
                        const dir = e.target.value as
                          | "savings_goal"
                          | "spending_limit"
                          | "income_goal";
                        updateLocalDraft(draft.id, (d) =>
                          d.kind !== "milestone"
                            ? d
                            : { ...d, trackingDirection: dir }
                        );
                      }}
                      className="w-full h-8 px-2 rounded border border-border bg-card text-foreground"
                    >
                      <option value="savings_goal">Target Tabungan</option>
                      <option value="spending_limit">Batas Pengeluaran</option>
                      <option value="income_goal">Target Pemasukan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">
                      {isEn ? "Tracked Entity" : "Pantau Akun / Kategori"}
                    </label>
                    <select
                      value={`${draft.trackingType}:${draft.trackingId}`}
                      onChange={(e) => {
                        const [type, id] = e.target.value.split(":");
                        const trackingType =
                          type === "category" ? "category" : "account";
                        const trackingName =
                          id === "all"
                            ? "Semua Akun"
                            : trackingType === "account"
                              ? userAccounts.find((a) => a.id === id)?.name ||
                                "Akun"
                              : userCategories.find((c) => c.id === id)?.name ||
                                "Kategori";
                        updateLocalDraft(draft.id, (d) =>
                          d.kind !== "milestone"
                            ? d
                            : {
                                ...d,
                                trackingType,
                                trackingId: id || "all",
                                trackingName,
                              }
                        );
                      }}
                      className="w-full h-8 px-2 rounded border border-border bg-card text-foreground"
                    >
                      <option value="account:all">Akun: Semua Akun</option>
                      {userAccounts.map((a) => (
                        <option key={a.id} value={`account:${a.id}`}>
                          Akun: {a.name}
                        </option>
                      ))}
                      {userCategories.map((c) => (
                        <option key={c.id} value={`category:${c.id}`}>
                          Kategori: {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Validation warning */}
              {validationError && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Action buttons */}
              {draft.status === "pending" && sessionId && (
                <div
                  className={`mt-2.5 flex items-center justify-end gap-1.5 ${compact ? "flex-wrap" : ""}`}
                >
                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => handleDismissOne(draft.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border/80 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <X className="h-3 w-3" />
                    <span>{isEn ? "Dismiss" : "Abaikan"}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() =>
                      setEditingId((prev) =>
                        prev === draft.id ? null : draft.id
                      )
                    }
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border/80 text-[11px] font-medium text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>
                      {isEditing
                        ? isEn
                          ? "Done"
                          : "Selesai Edit"
                        : "Edit"}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isMutating || Boolean(validationError)}
                    onClick={() => handleSaveOne(draft)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary hover:bg-[#047857] text-white text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-40"
                  >
                    {savingDraftId === draft.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3" />
                    )}
                    <span>{isEn ? "Save" : "Simpan"}</span>
                  </button>
                </div>
              )}

              {isSaved && (
                <div className="mt-2 flex justify-end">
                  <Link
                    href={
                      draft.kind === "transaction"
                        ? "/transactions"
                        : "/budgets"
                    }
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                  >
                    <span>
                      {draft.kind === "transaction"
                        ? isEn
                          ? "View in Transactions"
                          : "Lihat di Transaksi"
                        : isEn
                          ? "View in Budgets & Targets"
                          : "Lihat di Anggaran & Target"}
                    </span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

