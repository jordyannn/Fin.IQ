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
  Plus,
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
  detectAccount,
  isConfidentDatasetMatch,
} from "@/lib/nlp-parser";
import { useConfirm, useAlert } from "@/store/confirm.store";
import { CategorySelect } from "./CategorySelect";
import { AccountSelect } from "./AccountSelect";

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
  const [nlpRecommendedCategory, setNlpRecommendedCategory] = useState<{
    name: string;
    kind: "expense" | "income";
  } | null>(null);

  const confirm = useConfirm();
  const alert = useAlert();

  // Queries
  const { data: accountsData } = trpc.accounts.list.useQuery();
  const { data: categoriesList } = trpc.categories.list.useQuery();

  // Mutation to create recommended category
  const createCategoryMutation = trpc.categories.create.useMutation({
    onSuccess: (newCat) => {
      utils.categories.invalidate();
      setCategoryId(newCat.id);
      setNlpRecommendedCategory(null);
    },
    onError: (err) => {
      alert({
        title: "Gagal Membuat Kategori",
        description: err.message || "Terjadi kesalahan saat membuat kategori.",
        variant: "destructive",
        icon: "alert",
      });
    },
  });

  const handleCreateRecommendedCategory = async (name: string, kind: "expense" | "income") => {
    const isApproved = await confirm({
      title: "Buat Kategori Rekomendasi?",
      description: `Kategori "${name}" belum ada di daftar kategori Anda. Apakah Anda ingin membuat kategori baru ini dan menyetujuinya untuk digunakan pada transaksi ini?`,
      confirmText: "Ya, Buat & Gunakan",
      cancelText: "Batal",
      variant: "warning",
      icon: "alert",
    });

    if (isApproved) {
      createCategoryMutation.mutate({
        name,
        kind,
      });
    }
  };

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
      setNlpRecommendedCategory(null);

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

  const applyParsedDataToForm = (data: any) => {
    if (data.amount > 0) {
      setAmount(data.formattedAmount || formatInputIDR(String(data.amount)));
    }
    if (data.txType) {
      setTxType(data.txType);
    }
    if (data.matchedAccountId) {
      setAccountId(data.matchedAccountId);
    } else if (accountsData?.accounts && data.accountHint) {
      const foundAcc = accountsData.accounts.find((a) =>
        a.name.toLowerCase().includes(data.accountHint.toLowerCase()) ||
        data.accountHint.toLowerCase().includes(a.name.toLowerCase())
      );
      if (foundAcc) setAccountId(foundAcc.id);
    }

    if (data.matchedToAccountId) {
      setToAccountId(data.matchedToAccountId);
    }

    if (data.matchedCategoryId) {
      setCategoryId(data.matchedCategoryId);
      setNlpRecommendedCategory(null);
    } else if (data.recommendedCategory && data.recommendedCategory.isNew) {
      setNlpRecommendedCategory({
        name: data.recommendedCategory.name,
        kind: data.recommendedCategory.kind,
      });
    } else if (categoriesList && data.categoryHint) {
      const foundCat = categoriesList
        .filter((c) => c.kind === data.txType)
        .find((c) =>
          c.name.toLowerCase().includes(data.categoryHint.toLowerCase()) ||
          data.categoryHint.toLowerCase().includes(c.name.toLowerCase())
        );
      if (foundCat) {
        setCategoryId(foundCat.id);
        setNlpRecommendedCategory(null);
      } else {
        const fallbackCat = categoriesList.find((c) => c.kind === data.txType);
        if (fallbackCat) setCategoryId(fallbackCat.id);
      }
    }

    if (data.happenedAtFormatted) {
      setHappenedAt(data.happenedAtFormatted);
    }

    if (data.cleanNote) {
      setNote(data.cleanNote);
    } else if (data.note) {
      setNote(data.note);
    }
  };

  const parseAudioMutation = trpc.ai.parseAudioWithGemini.useMutation({
    onSuccess: (data) => {
      applyParsedDataToForm(data);
    },
    onError: (err) => {
      console.warn("Fallback Gemini Native Audio gagal:", err.message);
    },
  });

  const applySmartSpeechParse = (
    transcript: string,
    audioBase64?: string,
    mimeType?: string
  ) => {
    const result = smartParseIndonesianTransaction(transcript, {
      accounts: accountsData?.accounts,
      categories: categoriesList,
    });

    applyParsedDataToForm(result);

    const isConfident = isConfidentDatasetMatch(result);
    if (!isConfident) {
      parseAudioMutation.mutate({
        audioBase64: audioBase64 || undefined,
        mimeType: mimeType || "audio/webm",
        transcript: transcript || undefined,
        clientTime: new Date().toISOString(),
      });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-card border border-border/80 shadow-2xl overflow-hidden text-card-foreground animate-in zoom-in-95 duration-150"
      >
        {/* Header - Fixed & Pinned at Top */}
        <div className="flex items-center justify-between border-b border-border/70 px-5 sm:px-6 py-3.5 shrink-0 bg-card z-10">
          <div>
            <h2 className="text-base font-bold text-foreground tracking-tight">Edit Transaksi</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Perbarui rincian, akun, atau nominal transaksi ini
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Modal Content Body */}
        <div
          className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4 overscroll-contain
            [&::-webkit-scrollbar]:w-2
            [&::-webkit-scrollbar-track]:bg-muted/20
            [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30
            [&::-webkit-scrollbar-thumb]:rounded-full
            hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50
            transition-colors"
        >

        {errorMessage && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {/* AI Voice Assistant Bar */}
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Dikte Suara Cerdas</p>
              <p className="text-[10px] text-muted-foreground">
                Ubah transaksi lewat suara (misal: &ldquo;Beli kopi 30rb pakai blu&rdquo;)
              </p>
            </div>
          </div>
          <VoiceMicButton
            size="sm"
            title="Dikte transaksi cerdas"
            onResult={(text) => applySmartSpeechParse(text)}
          />
        </div>

        <div className="flex flex-col gap-4">
          {/* Tipe Transaksi (Tabs) */}
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted/60 p-1 border border-border/50 text-xs">
            <button
              type="button"
              onClick={() => handleTxTypeChange("expense")}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-lg font-semibold transition-all duration-140 ease-out active:scale-[0.98] cursor-pointer",
                txType === "expense"
                  ? "bg-rose-600 text-white shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60 font-medium"
              )}
            >
              <ArrowDownLeft className="h-3.5 w-3.5" />
              <span>Pengeluaran</span>
            </button>
            <button
              type="button"
              onClick={() => handleTxTypeChange("income")}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-lg font-semibold transition-all duration-140 ease-out active:scale-[0.98] cursor-pointer",
                txType === "income"
                  ? "bg-emerald-600 text-white shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60 font-medium"
              )}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>Pemasukan</span>
            </button>
            <button
              type="button"
              onClick={() => handleTxTypeChange("transfer")}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-lg font-semibold transition-all duration-140 ease-out active:scale-[0.98] cursor-pointer",
                txType === "transfer"
                  ? "bg-blue-600 text-white shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60 font-medium"
              )}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span>Transfer</span>
            </button>
          </div>

          {/* Nominal Input */}
          <div>
            <div className="flex items-center justify-between h-6 mb-1.5">
              <label className="text-xs font-medium text-foreground/80">
                Nominal ({transaction.currency || "IDR"})
              </label>
              <VoiceMicButton
                size="xs"
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
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground select-none">
                Rp
              </span>
              <Input
                type="text"
                inputMode="numeric"
                min="0"
                value={amount}
                onChange={(e) => setAmount(formatInputIDR(e.target.value))}
                placeholder="0"
                className="h-11 rounded-lg border-input/80 pl-11 text-lg font-bold font-mono tabular-nums tracking-tight bg-background/80 shadow-2xs focus-visible:border-primary"
                required
              />
            </div>
          </div>

          {/* Waktu Transaksi */}
          <div>
            <div className="flex items-center justify-between h-6 mb-1.5">
              <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Waktu Transaksi
              </label>
              <VoiceMicButton
                size="xs"
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
              className="h-10 rounded-lg text-xs font-mono tabular-nums border-input/80 px-3 bg-background/80 shadow-2xs focus-visible:border-primary"
              required
            />
          </div>

          {/* Rekomendasi Kategori NLP (Jika Ditemukan Belum Ada di Daftar) */}
          {txType !== "transfer" && nlpRecommendedCategory && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent border border-emerald-500/25 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Rekomendasi Kategori NLP
                  </span>
                  <span className="text-xs font-bold text-foreground truncate">
                    &ldquo;{nlpRecommendedCategory.name}&rdquo; (Belum Ada)
                  </span>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  handleCreateRecommendedCategory(
                    nlpRecommendedCategory.name,
                    nlpRecommendedCategory.kind
                  )
                }
                className="h-8 px-3 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 gap-1.5 shadow-xs cursor-pointer transition-all active:scale-[0.98]"
              >
                <Plus className="h-3.5 w-3.5" />
                Buat Kategori
              </Button>
            </div>
          )}

          {/* Akun & Kategori Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Akun Sumber */}
            <div>
              <div className="flex items-center justify-between h-6 mb-1.5">
                <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                  {txType === "transfer" ? "Dari Akun" : "Akun Keuangan"}
                </label>
                <VoiceMicButton
                  size="xs"
                  title="Sebut akun (misal: Blu, Cash, BCA)"
                  onResult={(text) => {
                    if (accountsData?.accounts) {
                      const detected = detectAccount(text, accountsData.accounts);
                      if (detected.matchedAccountId) {
                        setAccountId(detected.matchedAccountId);
                      }
                    }
                  }}
                />
              </div>
              <AccountSelect
                accounts={accountsData?.accounts || []}
                value={accountId}
                onChange={setAccountId}
                placeholder="Pilih Akun..."
                align="left"
              />
            </div>

            {/* Akun Tujuan (Transfer) ATAU Kategori (Expense/Income) */}
            {txType === "transfer" ? (
              <div>
                <div className="flex items-center justify-between h-6 mb-1.5">
                  <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                    Ke Akun Tujuan
                  </label>
                  <VoiceMicButton
                    size="xs"
                    title="Sebut akun tujuan"
                    onResult={(text) => {
                      if (accountsData?.accounts) {
                        const targetAccounts = accountsData.accounts.filter((a) => a.id !== accountId);
                        const detected = detectAccount(text, targetAccounts);
                        if (detected.matchedAccountId) {
                          setToAccountId(detected.matchedAccountId);
                        }
                      }
                    }}
                  />
                </div>
                <AccountSelect
                  accounts={(accountsData?.accounts || []).filter((a) => a.id !== accountId)}
                  value={toAccountId}
                  onChange={setToAccountId}
                  placeholder="Pilih Akun Tujuan..."
                  align="right"
                />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between h-6 mb-1.5">
                  <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    Kategori
                  </label>
                  <VoiceMicButton
                    size="xs"
                    title="Sebut kategori (misal: Kopi, Bensin, Gaji, Belanja)"
                    onResult={(text) => {
                      if (categoriesList) {
                        const detected = detectCategory(text, txType, categoriesList);
                        if (detected.matchedCategoryId) {
                          setCategoryId(detected.matchedCategoryId);
                          setNlpRecommendedCategory(null);
                        } else if (detected.recommendedCategory && detected.recommendedCategory.isNew) {
                          setNlpRecommendedCategory({
                            name: detected.recommendedCategory.name,
                            kind: detected.recommendedCategory.kind,
                          });
                        }
                      }
                    }}
                  />
                </div>
                <CategorySelect
                  categories={categoriesList || []}
                  value={categoryId}
                  onChange={(newId) => {
                    setCategoryId(newId);
                    setNlpRecommendedCategory(null);
                  }}
                  txType={txType}
                  placeholder="Pilih Kategori..."
                  recommendedCategory={nlpRecommendedCategory}
                  onCreateRecommended={(name, kind) => handleCreateRecommendedCategory(name, kind)}
                  align="right"
                />
              </div>
            )}
          </div>

          {/* Catatan / Keterangan */}
          <div>
            <div className="flex items-center justify-between h-6 mb-1.5">
              <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                Catatan / Keterangan
              </label>
              <VoiceMicButton
                size="xs"
                title="Dikte transaksi cerdas (otomatis isi seluruh form)"
                onResult={(text, audioBase64, mimeType) => {
                  applySmartSpeechParse(text, audioBase64, mimeType);
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
              className="h-10 rounded-lg text-xs border border-input/80 bg-background/80 px-3 shadow-2xs focus-visible:border-primary"
            />
          </div>

        </div>
      </div>

      {/* Fixed Pinned Footer Actions */}
      <div className="border-t border-border/70 px-5 sm:px-6 py-3 shrink-0 bg-card/95 backdrop-blur-sm flex items-center justify-end gap-2.5 z-10">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={updateMutation.isPending}
          className="text-xs h-9 px-3.5 rounded-lg cursor-pointer transition-all active:scale-[0.98]"
        >
          Batal
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={updateMutation.isPending}
          className="bg-primary hover:bg-primary/90 text-white text-xs h-9 px-4 rounded-lg font-bold gap-1.5 shadow-xs cursor-pointer transition-all active:scale-[0.98]"
        >
          <Save className="h-3.5 w-3.5" />
          {updateMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
      </div>
    </form>
  </div>
);
}
