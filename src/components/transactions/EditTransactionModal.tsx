"use client";

import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  X,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Wallet,
  Tag,
  FileText,
  Save,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatInputIDR, parseInputIDR } from "@/lib/utils";
import { VoiceMicButton } from "@/components/ui/VoiceMicButton";
import { parseSpokenNumber } from "@/hooks/use-voice-input";
import {
  smartParseIndonesianTransaction,
  extractDateTimeFromText,
  detectCategory,
} from "@/lib/nlp-parser";

export interface TransactionToEdit {
  id: string;
  amount: number;
  currency: string;
  txType: "expense" | "income" | "transfer" | string;
  happenedAt: string | Date;
  note: string | null;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  accountName?: string | null;
  categoryName?: string | null;
}

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionToEdit | null;
}

export function EditTransactionModal({
  isOpen,
  onClose,
  transaction,
}: EditTransactionModalProps) {
  const utils = trpc.useUtils();

  const [txType, setTxType] = useState<"expense" | "income" | "transfer">("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [happenedAt, setHappenedAt] = useState("");
  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Queries
  const { data: accountsData } = trpc.accounts.list.useQuery();
  const { data: categoriesList } = trpc.categories.list.useQuery();

  // Sinkronisasi kategori ketika jenis transaksi berganti
  const handleTxTypeChange = (newType: "expense" | "income" | "transfer") => {
    setTxType(newType);
    if (newType === "transfer") {
      setCategoryId("");
    } else {
      const currentCat = categoriesList?.find((c) => c.id === categoryId);
      if (!currentCat || currentCat.kind !== newType) {
        const firstMatching = categoriesList?.find((c) => c.kind === newType);
        setCategoryId(firstMatching ? firstMatching.id : "");
      }
    }
  };

  // Pengelompokan hierarkis kategori untuk optgroup
  const activeCategories = (categoriesList || []).filter((c) => c.kind === txType);
  const parentCategories = activeCategories.filter((c) => !c.parentId);
  const childCategoriesMap = new Map<string, typeof activeCategories>();
  for (const cat of activeCategories) {
    if (cat.parentId) {
      const list = childCategoriesMap.get(cat.parentId) || [];
      list.push(cat);
      childCategoriesMap.set(cat.parentId, list);
    }
  }

  // Populate data when transaction changes
  useEffect(() => {
    if (transaction) {
      setTxType((transaction.txType as any) || "expense");
      setAmount(formatInputIDR(String(transaction.amount || "")));
      setAccountId(transaction.accountId || "");
      setToAccountId(transaction.toAccountId || "");
      setCategoryId(transaction.categoryId || "");
      setNote(transaction.note || "");
      setErrorMessage(null);

      try {
        const d = new Date(transaction.happenedAt);
        // Format to YYYY-MM-DDTHH:mm
        const offset = d.getTimezoneOffset() * 60000;
        const localISOTime = new Date(d.getTime() - offset).toISOString().slice(0, 16);
        setHappenedAt(localISOTime);
      } catch {
        setHappenedAt(new Date().toISOString().slice(0, 16));
      }
    }
  }, [transaction]);

  const updateMutation = trpc.transactions.update.useMutation({
    onSuccess: () => {
      utils.transactions.invalidate();
      utils.accounts.invalidate();
      utils.analytics.invalidate();
      onClose();
    },
    onError: (err) => {
      setErrorMessage(err.message || "Gagal memperbarui transaksi.");
    },
  });

  const applySmartSpeechParse = (transcript: string) => {
    const result = smartParseIndonesianTransaction(transcript, {
      accounts: accountsData?.accounts,
      categories: categoriesList,
    });

    if (result.amount > 0) {
      setAmount(result.formattedAmount);
    }
    if (result.txType) {
      setTxType(result.txType);
    }
    if (result.matchedAccountId) {
      setAccountId(result.matchedAccountId);
    } else if (accountsData?.accounts) {
      const foundAcc = accountsData.accounts.find((a) =>
        a.name.toLowerCase().includes(result.accountHint.toLowerCase()) ||
        result.accountHint.toLowerCase().includes(a.name.toLowerCase())
      );
      if (foundAcc) setAccountId(foundAcc.id);
    }

    if (result.matchedToAccountId) {
      setToAccountId(result.matchedToAccountId);
    }

    if (result.matchedCategoryId) {
      setCategoryId(result.matchedCategoryId);
    } else if (categoriesList) {
      const foundCat = categoriesList
        .filter((c) => c.kind === result.txType)
        .find((c) =>
          c.name.toLowerCase().includes(result.categoryHint.toLowerCase()) ||
          result.categoryHint.toLowerCase().includes(c.name.toLowerCase())
        );
      if (foundCat) {
        setCategoryId(foundCat.id);
      } else {
        const fallbackCat = categoriesList.find((c) => c.kind === result.txType);
        if (fallbackCat) setCategoryId(fallbackCat.id);
      }
    }

    if (result.happenedAtFormatted) {
      setHappenedAt(result.happenedAtFormatted);
    }

    if (result.cleanNote) {
      setNote(result.cleanNote);
    } else {
      setNote(transcript);
    }
  };

  if (!isOpen || !transaction) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const numAmount = parseInputIDR(amount);
    if (!numAmount || numAmount <= 0) {
      setErrorMessage("Nominal transaksi harus lebih dari 0.");
      return;
    }

    if (!accountId) {
      setErrorMessage("Harap pilih akun transaksi.");
      return;
    }

    if (txType === "transfer" && !toAccountId) {
      setErrorMessage("Harap pilih akun tujuan untuk transfer.");
      return;
    }

    if (txType === "transfer" && accountId === toAccountId) {
      setErrorMessage("Akun asal dan akun tujuan tidak boleh sama.");
      return;
    }

    let validCategoryId: string | null = null;
    if (txType !== "transfer") {
      const selected = categoriesList?.find((c) => c.id === categoryId && c.kind === txType);
      if (selected) {
        validCategoryId = selected.id;
      } else {
        const fallbackCat = categoriesList?.find((c) => c.kind === txType);
        validCategoryId = fallbackCat ? fallbackCat.id : null;
      }
    }

    updateMutation.mutate({
      id: transaction.id,
      txType,
      amount: numAmount,
      accountId,
      toAccountId: txType === "transfer" ? toAccountId : null,
      categoryId: validCategoryId,
      happenedAt: happenedAt ? new Date(happenedAt).toISOString() : undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border/80 shadow-2xl overflow-hidden p-6 text-card-foreground">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-base font-bold">Edit Transaksi</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Perbarui rincian, akun, atau nominal transaksi ini
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {/* AI Voice Assistant Bar */}
        <div className="mt-3 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground">Dikte Suara Cerdas</p>
              <p className="text-[10px] text-muted-foreground">
                Ubah transaksi lewat suara (misal: &ldquo;Beli kopi 30rb pakai blu&rdquo;)
              </p>
            </div>
          </div>
          <VoiceMicButton
            size="md"
            title="Dikte transaksi cerdas"
            onResult={(text) => applySmartSpeechParse(text)}
          />
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          {/* Tipe Transaksi (Tabs) */}
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-1 text-xs">
            <button
              type="button"
              onClick={() => handleTxTypeChange("expense")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-2 font-semibold transition-all",
                txType === "expense"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowDownLeft className="h-3.5 w-3.5" />
              Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => handleTxTypeChange("income")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-2 font-semibold transition-all",
                txType === "income"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Pemasukan
            </button>
            <button
              type="button"
              onClick={() => handleTxTypeChange("transfer")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-2 font-semibold transition-all",
                txType === "transfer"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Transfer
            </button>
          </div>

          {/* Nominal Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-foreground">
                Nominal ({transaction.currency || "IDR"})
              </label>
              <VoiceMicButton
                size="sm"
                title="Dikte nominal (misal: lima puluh ribu)"
                onResult={(text) => {
                  const num = parseSpokenNumber(text);
                  if (num) {
                    setAmount(formatInputIDR(String(num)));
                  }
                }}
              />
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                Rp
              </span>
              <Input
                type="text"
                inputMode="numeric"
                min="0"
                value={amount}
                onChange={(e) => setAmount(formatInputIDR(e.target.value))}
                placeholder="0"
                className="pl-11 text-base font-bold h-11"
                required
              />
            </div>
          </div>

          {/* Waktu Transaksi */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Waktu Transaksi
              </label>
              <VoiceMicButton
                size="sm"
                title="Dikte waktu (misal: saat ini, kemarin sore, 25 agustus)"
                onResult={(text) => {
                  const { happenedAtFormatted } = extractDateTimeFromText(text);
                  if (happenedAtFormatted) {
                    setHappenedAt(happenedAtFormatted);
                  }
                }}
              />
            </div>
            <Input
              type="datetime-local"
              value={happenedAt}
              onChange={(e) => setHappenedAt(e.target.value)}
              className="text-xs h-9"
              required
            />
          </div>

          {/* Akun & Kategori Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Akun Sumber */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                  {txType === "transfer" ? "Dari Akun" : "Akun Keuangan"}
                </label>
                <VoiceMicButton
                  size="sm"
                  title="Sebut akun (misal: Blu, Cash, BCA)"
                  onResult={(text) => {
                    if (accountsData?.accounts) {
                      const lower = text.toLowerCase();
                      const found = accountsData.accounts.find((a) =>
                        a.name.toLowerCase().includes(lower) || lower.includes(a.name.toLowerCase())
                      );
                      if (found) setAccountId(found.id);
                    }
                  }}
                />
              </div>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-sm text-xs focus:outline-none"
                required
              >
                <option value="">Pilih Akun...</option>
                {accountsData?.accounts?.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.group})
                  </option>
                ))}
              </select>
            </div>

            {/* Akun Tujuan (Transfer) ATAU Kategori (Expense/Income) */}
            {txType === "transfer" ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                    Ke Akun Tujuan
                  </label>
                  <VoiceMicButton
                    size="sm"
                    title="Sebut akun tujuan"
                    onResult={(text) => {
                      if (accountsData?.accounts) {
                        const lower = text.toLowerCase();
                        const found = accountsData.accounts
                          .filter((a) => a.id !== accountId)
                          .find((a) =>
                            a.name.toLowerCase().includes(lower) || lower.includes(a.name.toLowerCase())
                          );
                        if (found) setToAccountId(found.id);
                      }
                    }}
                  />
                </div>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-sm text-xs focus:outline-none"
                  required
                >
                  <option value="">Pilih Akun Tujuan...</option>
                  {accountsData?.accounts
                    ?.filter((a) => a.id !== accountId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.group})
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    Kategori
                  </label>
                  <VoiceMicButton
                    size="sm"
                    title="Sebut kategori (misal: Kopi, Bensin, Gaji, Belanja)"
                    onResult={(text) => {
                      if (categoriesList) {
                        const detected = detectCategory(text, txType, categoriesList);
                        if (detected.matchedCategoryId) {
                          setCategoryId(detected.matchedCategoryId);
                        }
                      }
                    }}
                  />
                </div>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-sm text-xs focus:outline-none"
                >
                  <option value="">Tanpa Kategori (Umum)</option>
                  {parentCategories.map((parent) => {
                    const children = childCategoriesMap.get(parent.id) || [];
                    if (children.length > 0) {
                      return (
                        <optgroup key={parent.id} label={parent.name}>
                          <option value={parent.id}>{parent.name} (Utama)</option>
                          {children.map((child) => (
                            <option key={child.id} value={child.id}>
                              &nbsp;&nbsp;• {child.name}
                            </option>
                          ))}
                        </optgroup>
                      );
                    }
                    return (
                      <option key={parent.id} value={parent.id}>
                        {parent.name}
                      </option>
                    );
                  })}
                  {/* Kategori anak tanpa parent yang terdaftar di parentCategories */}
                  {activeCategories
                    .filter((c) => c.parentId && !parentCategories.some((p) => p.id === c.parentId))
                    .map((orphan) => (
                      <option key={orphan.id} value={orphan.id}>
                        {orphan.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* Catatan / Keterangan */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                Catatan / Keterangan
              </label>
              <VoiceMicButton
                size="sm"
                title="Dikte transaksi cerdas (otomatis isi seluruh form)"
                onResult={(text) => {
                  applySmartSpeechParse(text);
                }}
              />
            </div>
            <Input
              type="text"
              placeholder="Contoh: Belanja bulanan, isi bensin, makan siang..."
              value={note}
              onChange={(e) => {
                const val = e.target.value;
                setNote(val);
                const lower = val.toLowerCase();
                if (lower.includes("pemasukan") || lower.includes("uang masuk") || lower.includes("gaji")) {
                  setTxType("income");
                } else if (lower.includes("pengeluaran") || lower.includes("uang keluar") || lower.includes("beli ") || lower.includes("bayar ")) {
                  setTxType("expense");
                }
              }}
              className="text-xs h-9"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 border-t pt-4 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={updateMutation.isPending}
              className="text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={updateMutation.isPending}
              className="bg-[#00B569] hover:bg-[#00B569]/90 text-white text-xs gap-1.5 shadow-sm"
            >
              <Save className="h-3.5 w-3.5" />
              {updateMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
