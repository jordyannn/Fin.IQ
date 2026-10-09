"use client";

import React, { useState } from "react";
import { useUIStore } from "@/store/ui.store";
import { trpc } from "@/lib/trpc/client";
import { useVoiceInput, parseSpokenNumber } from "@/hooks/use-voice-input";
import {
  X,
  Mic,
  MicOff,
  Sparkles,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatInputIDR, parseInputIDR } from "@/lib/utils";
import { VoiceMicButton } from "@/components/ui/VoiceMicButton";
import { smartParseIndonesianTransaction } from "@/lib/nlp-parser";

export function QuickAddModal() {
  const { isQuickAddOpen, closeQuickAdd } = useUIStore();
  const utils = trpc.useUtils();

  const [txType, setTxType] = useState<"expense" | "income" | "transfer">("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [happenedAt, setHappenedAt] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Queries
  const { data: accountsData } = trpc.accounts.list.useQuery();
  const { data: categoriesList } = trpc.categories.list.useQuery();
  const { data: ledgersList } = trpc.ledgers.list.useQuery();

  // Smart Voice & NLP parsing
  const applySmartSpeechParse = (transcript: string) => {
    // 1. Eksekusi lokal instan (0 ms latency)
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
      if (foundCat) setCategoryId(foundCat.id);
    }

    if (result.cleanNote) {
      setNote(result.cleanNote);
    } else {
      setNote(transcript);
    }

    // 2. Kirim ke backend mutation untuk memastikan sinkronisasi
    parseMutation.mutate({ text: transcript });
  };

  const parseMutation = trpc.ai.parseTextToTransaction.useMutation({
    onSuccess: (data) => {
      if (data.amount > 0) setAmount(data.formattedAmount || formatInputIDR(String(data.amount)));
      if (data.txType) setTxType(data.txType);
      if (data.cleanNote) setNote(data.cleanNote);
      else if (data.note) setNote(data.note);

      if (data.matchedAccountId) {
        setAccountId(data.matchedAccountId);
      } else if (accountsData?.accounts) {
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
      } else if (categoriesList) {
        const foundCat = categoriesList
          .filter((c) => c.kind === data.txType)
          .find((c) =>
            c.name.toLowerCase().includes(data.categoryHint.toLowerCase()) ||
            data.categoryHint.toLowerCase().includes(c.name.toLowerCase())
          );
        if (foundCat) setCategoryId(foundCat.id);
      }
    },
  });

  const { isListening, startListening, stopListening } = useVoiceInput((transcript) => {
    applySmartSpeechParse(transcript);
  });

  // Create mutation
  const createTxMutation = trpc.transactions.create.useMutation({
    onSuccess: () => {
      utils.transactions.invalidate();
      utils.accounts.invalidate();
      utils.analytics.invalidate();
      setIsSubmitting(false);
      resetForm();
      closeQuickAdd();
    },
    onError: (err) => {
      alert("Gagal menyimpan transaksi: " + err.message);
      setIsSubmitting(false);
    },
  });

  const resetForm = () => {
    setAmount("");
    setHappenedAt("");
    setNote("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseInputIDR(amount);
    if (!numAmount || numAmount <= 0) {
      alert("Harap masukkan nominal yang valid");
      return;
    }

    const defaultLedgerId = ledgersList?.[0]?.id || "default";
    const selectedAcc = accountId || accountsData?.accounts?.[0]?.id;

    if (!selectedAcc) {
      alert("Harap pilih akun transaksi");
      return;
    }

    setIsSubmitting(true);
    const txHappenedAt = happenedAt && happenedAt.trim()
      ? new Date(happenedAt).toISOString()
      : new Date().toISOString();

    createTxMutation.mutate({
      ledgerId: defaultLedgerId,
      txType,
      amount: numAmount,
      accountId: selectedAcc,
      toAccountId: txType === "transfer" ? toAccountId : undefined,
      categoryId: txType !== "transfer" ? (categoryId || categoriesList?.[0]?.id) : undefined,
      happenedAt: txHappenedAt,
      note,
    });
  };

  if (!isQuickAddOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-card border shadow-2xl overflow-hidden p-6 text-card-foreground">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">Catat Transaksi</h2>
              <p className="text-xs text-muted-foreground">Manual atau gunakan dikte suara AI</p>
            </div>
          </div>
          <button
            onClick={closeQuickAdd}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Voice AI Dikte Bar */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant={isListening ? "destructive" : "default"}
              size="icon"
              onClick={isListening ? stopListening : startListening}
              className={cn("h-9 w-9 rounded-full shadow-sm", isListening && "animate-pulse")}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <span className="text-xs font-medium text-foreground">
              {isListening
                ? "Mendengarkan... (misal: 'Beli bensin 50rb pake blu')"
                : "Tekan mic untuk input suara bahasa Indonesia"}
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Tipe Transaksi */}
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => setTxType("expense")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all",
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
              onClick={() => setTxType("income")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all",
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
              onClick={() => setTxType("transfer")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all",
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
              <label className="text-xs font-medium text-muted-foreground">Nominal (IDR)</label>
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
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-sm">
                Rp
              </span>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(formatInputIDR(e.target.value))}
                className="pl-10 text-lg font-bold tracking-tight h-12"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Tanggal & Waktu Transaksi (Opsional - Default NOW) */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Tanggal & Waktu
              </label>
              <span className="text-[10px] text-muted-foreground/80">
                {happenedAt ? "Waktu Kustom" : "Otomatis Saat Ini (NOW)"}
              </span>
            </div>
            <div className="relative mt-1 flex gap-2">
              <Input
                type="datetime-local"
                value={happenedAt}
                onChange={(e) => setHappenedAt(e.target.value)}
                className="h-10 text-xs flex-1"
              />
              {happenedAt ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setHappenedAt("")}
                  className="h-10 px-2.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
                  title="Kembalikan ke waktu sekarang (NOW)"
                >
                  Reset ke NOW
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    const offset = now.getTimezoneOffset() * 60000;
                    const localISOTime = new Date(now.getTime() - offset).toISOString().slice(0, 16);
                    setHappenedAt(localISOTime);
                  }}
                  className="h-10 px-2.5 text-xs text-primary font-medium shrink-0 bg-primary/5 border-primary/20 hover:bg-primary/10"
                  title="Pilih tanggal & jam spesifik"
                >
                  Atur Waktu
                </Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              *Jika dikosongkan, transaksi otomatis menggunakan tanggal dan jam saat ini (NOW).
            </p>
          </div>

          {/* Akun & Kategori */}
          <div className="grid grid-cols-2 gap-3">
            {/* Akun Sumber */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-muted-foreground">
                  {txType === "transfer" ? "Dari Akun" : "Akun"}
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
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Pilih Akun...</option>
                {accountsData?.accounts?.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name.toUpperCase()} (Rp {acc.balance.toLocaleString("id-ID")})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Akun atau Kategori */}
            {txType === "transfer" ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-muted-foreground">Ke Akun</label>
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
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  required
                >
                  <option value="">Pilih Akun Tujuan...</option>
                  {accountsData?.accounts
                    ?.filter((a) => a.id !== accountId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name.toUpperCase()}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-muted-foreground">Kategori</label>
                  <VoiceMicButton
                    size="sm"
                    title="Sebut kategori (misal: Makanan, Belanja)"
                    onResult={(text) => {
                      if (categoriesList) {
                        const lower = text.toLowerCase();
                        const found = categoriesList
                          .filter((c) => c.kind === txType)
                          .find((c) =>
                            c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())
                          );
                        if (found) setCategoryId(found.id);
                      }
                    }}
                  />
                </div>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Pilih Kategori...</option>
                  {categoriesList
                    ?.filter((c) => c.kind === txType)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* Catatan */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-muted-foreground">Catatan / Deskripsi</label>
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
              placeholder="Contoh: Sarapan pagi, beli bensin, dll."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-10 text-xs"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="w-1/3"
              onClick={closeQuickAdd}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-2/3 bg-primary text-white font-semibold"
            >
              {isSubmitting ? "Menyimpan..." : "Simpan Transaksi"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
