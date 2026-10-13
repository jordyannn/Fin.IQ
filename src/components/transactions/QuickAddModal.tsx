"use client";

import React, { useState, useRef, useEffect } from "react";
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
  Camera,
  Receipt,
  Loader2,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatInputIDR, parseInputIDR } from "@/lib/utils";
import { VoiceMicButton } from "@/components/ui/VoiceMicButton";
import { compressImageToBase64 } from "@/lib/image-compressor";
import {
  smartParseIndonesianTransaction,
  extractDateTimeFromText,
  detectCategory,
  detectAccount,
} from "@/lib/nlp-parser";

export function QuickAddModal() {
  const { isQuickAddOpen, closeQuickAdd, quickAddAutoScan, setQuickAddAutoScan } = useUIStore();
  const utils = trpc.useUtils();

  const [txType, setTxType] = useState<"expense" | "income" | "transfer">("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [happenedAt, setHappenedAt] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bill Scanner state
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [showSourceChoiceModal, setShowSourceChoiceModal] = useState(false);
  const [isScanningBill, setIsScanningBill] = useState(false);
  const [billScanError, setBillScanError] = useState<string | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [scannedBillMeta, setScannedBillMeta] = useState<{
    merchantName?: string;
    itemsSummary?: string;
    itemsCount?: number;
    tax?: number;
    discount?: number;
  } | null>(null);

  // Queries
  const { data: accountsData } = trpc.accounts.list.useQuery();
  const { data: categoriesList } = trpc.categories.list.useQuery();
  const { data: ledgersList } = trpc.ledgers.list.useQuery();

  // Sinkronisasi kategori ketika jenis transaksi berganti
  const handleTxTypeChange = (newType: "expense" | "income" | "transfer") => {
    setTxType(newType);
    if (newType === "transfer") {
      setCategoryId("");
      if (!toAccountId && accountsData?.accounts && accountsData.accounts.length > 1) {
        const fromId = accountId || accountsData.accounts[0].id;
        const otherAcc = accountsData.accounts.find((a) => a.id !== fromId);
        if (otherAcc) setToAccountId(otherAcc.id);
      }
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

    if (result.txType === "transfer") {
      if (result.matchedToAccountId) {
        setToAccountId(result.matchedToAccountId);
      } else if (accountsData?.accounts) {
        const fromId = result.matchedAccountId || accountId || accountsData.accounts[0]?.id;
        const fallbackTo = accountsData.accounts.find((a) => a.id !== fromId);
        if (fallbackTo) setToAccountId(fallbackTo.id);
      }
    } else {
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
    }

    if (result.happenedAtFormatted) {
      setHappenedAt(result.happenedAtFormatted);
    }

    if (result.cleanNote) {
      setNote(result.cleanNote);
    } else {
      setNote(transcript);
    }

    // 2. Kirim ke backend mutation untuk memastikan sinkronisasi
    parseMutation.mutate({ text: transcript, clientTime: new Date().toISOString() });
  };

  const parseMutation = trpc.ai.parseTextToTransaction.useMutation({
    onSuccess: (data) => {
      if (data.amount > 0) setAmount(data.formattedAmount || formatInputIDR(String(data.amount)));
      if (data.txType) setTxType(data.txType);
      if (data.happenedAtFormatted) {
        setHappenedAt((prev) => prev || data.happenedAtFormatted || "");
      }
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

      if (data.txType === "transfer") {
        if (data.matchedToAccountId) {
          setToAccountId(data.matchedToAccountId);
        } else if (accountsData?.accounts) {
          const fromId = data.matchedAccountId || accountId || accountsData.accounts[0]?.id;
          const fallbackTo = accountsData.accounts.find((a) => a.id !== fromId);
          if (fallbackTo) setToAccountId(fallbackTo.id);
        }
      } else {
        if (data.matchedCategoryId) {
          setCategoryId(data.matchedCategoryId);
        } else if (categoriesList) {
          const foundCat = categoriesList
            .filter((c) => c.kind === data.txType)
            .find((c) =>
              c.name.toLowerCase().includes(data.categoryHint.toLowerCase()) ||
              data.categoryHint.toLowerCase().includes(c.name.toLowerCase())
            );
          if (foundCat) {
            setCategoryId(foundCat.id);
          } else {
            const fallbackCat = categoriesList.find((c) => c.kind === data.txType);
            if (fallbackCat) setCategoryId(fallbackCat.id);
          }
        }
      }
    },
  });

  // Auto-trigger pilihan sumber foto jika modal dibuka lewat tombol 'Scan Struk'
  useEffect(() => {
    if (isQuickAddOpen && quickAddAutoScan) {
      setQuickAddAutoScan(false);
      setShowSourceChoiceModal(true);
    }
  }, [isQuickAddOpen, quickAddAutoScan, setQuickAddAutoScan]);

  const parseBillMutation = trpc.ai.parseBillReceipt.useMutation({
    onSuccess: (data) => {
      setIsScanningBill(false);
      setBillScanError(null);

      if (data.formattedAmount) {
        setAmount(data.formattedAmount);
      }
      if (data.txType) {
        setTxType(data.txType);
      }
      if (data.note) {
        setNote(data.note);
      }
      if (data.happenedAt) {
        const d = new Date(data.happenedAt);
        if (!isNaN(d.getTime())) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const hh = String(d.getHours()).padStart(2, "0");
          const min = String(d.getMinutes()).padStart(2, "0");
          setHappenedAt(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
        }
      }
      if (data.matchedAccountId) {
        setAccountId(data.matchedAccountId);
      }
      if (data.matchedCategoryId) {
        setCategoryId(data.matchedCategoryId);
      }

      setScannedBillMeta({
        merchantName: data.merchantName,
        itemsSummary: data.itemsSummary,
        itemsCount: data.items?.length || 0,
        tax: data.tax,
        discount: data.discount,
      });
    },
    onError: (err) => {
      setIsScanningBill(false);
      setBillScanError(err.message || "Gagal memproses struk dengan Gemini AI.");
    },
  });

  const handleBillFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Harap pilih file gambar (JPG, PNG, atau WEBP).");
      return;
    }

    setIsScanningBill(true);
    setBillScanError(null);

    try {
      const { base64, mimeType, previewUrl } = await compressImageToBase64(file);
      setReceiptPreviewUrl(previewUrl);

      parseBillMutation.mutate({
        image: { base64, mimeType },
        clientTime: new Date().toISOString(),
      });
    } catch (err: any) {
      setIsScanningBill(false);
      setBillScanError(err.message || "Gagal memproses gambar.");
    } finally {
      e.target.value = "";
    }
  };

  const handleClearReceipt = () => {
    setReceiptPreviewUrl(null);
    setScannedBillMeta(null);
    setBillScanError(null);
  };

  const { isListening, isProcessing, startListening, stopListening } = useVoiceInput((transcript) => {
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
    setToAccountId("");
    setReceiptPreviewUrl(null);
    setScannedBillMeta(null);
    setBillScanError(null);
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

    if (txType === "transfer") {
      if (!toAccountId) {
        alert("Harap pilih akun tujuan untuk transfer");
        return;
      }
      if (selectedAcc === toAccountId) {
        alert("Akun asal dan akun tujuan transfer tidak boleh sama");
        return;
      }
    }

    setIsSubmitting(true);
    const txHappenedAt = happenedAt && happenedAt.trim()
      ? new Date(happenedAt).toISOString()
      : new Date().toISOString();

    let validCategoryId: string | undefined = undefined;
    if (txType !== "transfer") {
      const selected = categoriesList?.find((c) => c.id === categoryId && c.kind === txType);
      if (selected) {
        validCategoryId = selected.id;
      } else {
        const fallbackCat = categoriesList?.find((c) => c.kind === txType);
        validCategoryId = fallbackCat?.id;
      }
    }

    createTxMutation.mutate({
      ledgerId: defaultLedgerId,
      txType,
      amount: numAmount,
      accountId: selectedAcc,
      toAccountId: txType === "transfer" ? toAccountId : undefined,
      categoryId: validCategoryId,
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
              <p className="text-xs text-muted-foreground">Manual, dikte suara AI, atau scan struk</p>
            </div>
          </div>
          <button
            onClick={closeQuickAdd}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Hidden input for Camera capture (direct camera trigger on mobile) */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleBillFileChange}
        />

        {/* Hidden input for Gallery / Files */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleBillFileChange}
        />

        {/* AI Assistant Dual Action Bar */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Voice AI Button Card */}
          <div className="flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-2.5 transition-colors">
            <Button
              type="button"
              variant={isListening ? "destructive" : isProcessing ? "secondary" : "default"}
              size="icon"
              disabled={isProcessing || isScanningBill}
              onClick={isListening ? stopListening : startListening}
              className={cn(
                "h-8 w-8 rounded-full shadow-sm shrink-0 transition-all",
                isListening && "animate-pulse",
                isProcessing && "bg-primary/20 text-primary border border-primary/40 animate-pulse"
              )}
            >
              {isListening ? (
                <MicOff className="h-3.5 w-3.5" />
              ) : isProcessing ? (
                <Sparkles className="h-3.5 w-3.5 animate-spin text-primary" />
              ) : (
                <Mic className="h-3.5 w-3.5" />
              )}
            </Button>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground truncate">
                {isListening ? "Mendengarkan..." : isProcessing ? "Memproses..." : "Dikte Suara AI"}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                {isListening ? "Sebutkan transaksi" : "Tekan mic untuk bicara"}
              </span>
            </div>
          </div>

          {/* Bill / Receipt Scanner Button Card with Camera & Gallery */}
          <div
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-muted/40 p-2 transition-colors",
              isScanningBill && "opacity-75 border-primary/40 bg-primary/5"
            )}
          >
            <div
              className="flex items-center gap-2 min-w-0 cursor-pointer"
              onClick={() => {
                if (!isScanningBill) setShowSourceChoiceModal(true);
              }}
              title="Pilih cara scan struk"
            >
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {isScanningBill ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : (
                  <Receipt className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-foreground truncate">
                  {isScanningBill ? "Membaca..." : "AI Vision Struk"}
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {isScanningBill ? "Gemini aktif" : "Kamera / Galeri"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isScanningBill}
                onClick={() => cameraInputRef.current?.click()}
                className="h-7 px-2 text-[11px] rounded-lg gap-1 border-primary/20 text-primary hover:bg-primary/10 hover:border-primary/40 shadow-2xs"
                title="Buka Kamera untuk foto struk"
              >
                <Camera className="h-3 w-3" />
                <span>Kamera</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isScanningBill}
                onClick={() => galleryInputRef.current?.click()}
                className="h-7 px-2 text-[11px] rounded-lg gap-1 border-primary/20 text-primary hover:bg-primary/10 hover:border-primary/40 shadow-2xs"
                title="Pilih dari Galeri foto"
              >
                <ImageIcon className="h-3 w-3" />
                <span>Galeri</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Bill Scanning Progress Indicator */}
        {isScanningBill && (
          <div className="mt-2.5 flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/10 text-xs animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin shrink-0 text-primary" />
            <div className="flex flex-col">
              <span className="font-semibold text-foreground">Gemini AI sedang membaca struk...</span>
              <span className="text-[11px] text-muted-foreground">
                Mengekstrak total belanja, tanggal, nama toko & kategori otomatis.
              </span>
            </div>
          </div>
        )}

        {/* Scanned Receipt Success Banner */}
        {receiptPreviewUrl && !isScanningBill && (
          <div className="mt-2.5 flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="relative h-10 w-10 rounded-lg overflow-hidden border border-emerald-500/30 cursor-pointer group shrink-0"
                onClick={() => setPreviewModalOpen(true)}
                title="Perbesar struk"
              >
                <img
                  src={receiptPreviewUrl}
                  alt="Struk Preview"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Eye className="h-3 w-3 text-white" />
                </div>
              </div>
              <div className="min-w-0 flex flex-col">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-bold text-foreground truncate">
                    {scannedBillMeta?.merchantName || "Struk Belanja Terbaca"}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground truncate">
                  {scannedBillMeta?.itemsSummary || "Data berhasil diisi otomatis ke formulir"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPreviewModalOpen(true)}
                className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground"
              >
                <Eye className="h-3 w-3 mr-1" />
                Lihat
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleClearReceipt}
                className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                title="Hapus struk"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Bill Scan Error Alert */}
        {billScanError && !isScanningBill && (
          <div className="mt-2.5 flex items-center justify-between gap-2 p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="truncate">{billScanError}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowSourceChoiceModal(true)}
              className="h-6 text-[10px] px-2 text-rose-600 hover:bg-rose-500/20 shrink-0 font-medium"
            >
              Coba Lagi
            </Button>
          </div>
        )}

        {/* Modal Zoom Preview Struk */}
        {previewModalOpen && receiptPreviewUrl && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 animate-in fade-in">
            <div className="relative max-w-md w-full max-h-[85vh] bg-card rounded-2xl overflow-hidden flex flex-col p-4 border shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b">
                <span className="text-sm font-bold flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-primary" />
                  Pratinjau Struk / Bill
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="p-1 rounded-full text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-auto py-3 flex items-center justify-center bg-black/5 rounded-xl mt-2">
                <img
                  src={receiptPreviewUrl}
                  alt="Struk Belanja Penuh"
                  className="max-h-[60vh] object-contain rounded-lg"
                />
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setPreviewModalOpen(false)}
                  className="text-xs"
                >
                  Tutup
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Pilihan Sumber Foto Struk (Kamera vs Galeri) */}
        {showSourceChoiceModal && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
            onClick={() => setShowSourceChoiceModal(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Receipt className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Sumber Foto Struk</h3>
                    <p className="text-[11px] text-muted-foreground">Pilih cara mengambil foto struk / bill</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSourceChoiceModal(false)}
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowSourceChoiceModal(false);
                    cameraInputRef.current?.click();
                  }}
                  className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl border-2 border-border/70 hover:border-primary hover:bg-primary/5 transition-all text-center group cursor-pointer"
                >
                  <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Camera className="h-6 w-6" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground">Buka Kamera</span>
                    <span className="text-[10px] text-muted-foreground">Ambil foto langsung</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowSourceChoiceModal(false);
                    galleryInputRef.current?.click();
                  }}
                  className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl border-2 border-border/70 hover:border-primary hover:bg-primary/5 transition-all text-center group cursor-pointer"
                >
                  <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground">Buka Galeri</span>
                    <span className="text-[10px] text-muted-foreground">Pilih dari album foto</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Tipe Transaksi */}
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => handleTxTypeChange("expense")}
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
              onClick={() => handleTxTypeChange("income")}
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
              onClick={() => handleTxTypeChange("transfer")}
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Tanggal & Waktu
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground/80">
                  {happenedAt ? "Waktu Kustom" : "Otomatis Saat Ini (NOW)"}
                </span>
                <VoiceMicButton
                  size="sm"
                  title="Dikte waktu (misal: saat ini, kemarin sore, tanggal 15)"
                  onResult={(text) => {
                    const { happenedAtFormatted } = extractDateTimeFromText(text);
                    if (happenedAtFormatted) {
                      setHappenedAt(happenedAtFormatted);
                    }
                  }}
                />
              </div>
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
                      const detected = detectAccount(text, accountsData.accounts);
                      if (detected.matchedAccountId) {
                        setAccountId(detected.matchedAccountId);
                      }
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
                        const targetAccounts = accountsData.accounts.filter((a) => a.id !== accountId);
                        const detected = detectAccount(text, targetAccounts);
                        if (detected.matchedAccountId) {
                          setToAccountId(detected.matchedAccountId);
                        }
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
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Pilih Kategori...</option>
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
