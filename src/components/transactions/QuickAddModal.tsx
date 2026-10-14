/* Hallmark · component: QuickAddModal · theme: Bibit-Fintech · genre: modern-minimal · states: default, hover, focus, active, disabled, loading, error, success */
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
  Plus,
  RotateCcw,
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
  isConfidentDatasetMatch,
} from "@/lib/nlp-parser";
import { useAlert, useConfirm } from "@/store/confirm.store";
import { CategorySelect } from "./CategorySelect";
import { AccountSelect } from "./AccountSelect";

export function QuickAddModal() {
  const { isQuickAddOpen, closeQuickAdd, quickAddAutoScan, setQuickAddAutoScan } = useUIStore();
  const utils = trpc.useUtils();
  const alert = useAlert();
  const confirm = useConfirm();

  const [txType, setTxType] = useState<"expense" | "income" | "transfer">("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [nlpRecommendedCategory, setNlpRecommendedCategory] = useState<{
    name: string;
    kind?: "expense" | "income";
  } | null>(null);
  const [happenedAt, setHappenedAt] = useState("");
  const [note, setNote] = useState("");
  const [nlpInputText, setNlpInputText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mutation untuk membuat kategori rekomendasi NLP
  const createCategoryMutation = trpc.categories.create.useMutation({
    onSuccess: (newCat) => {
      utils.categories.invalidate();
      setCategoryId(newCat.id);
      setNlpRecommendedCategory(null);
    },
    onError: (err) => {
      alert({
        title: "Gagal Membuat Kategori",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateRecommendedCategory = async (catName: string, kind?: "expense" | "income") => {
    const targetKind = kind || (txType === "income" ? "income" : "expense");
    const ok = await confirm({
      title: "Buat Kategori Rekomendasi?",
      description: `Analisis NLP merekomendasikan kategori "${catName}" untuk transaksi ini, tetapi kategori ini belum ada di daftar kategori Anda. Apakah Anda setuju untuk membuat kategori baru "${catName}" dan langsung menggunakannya pada transaksi ini?`,
      confirmText: "Ya, Buat Kategori",
      cancelText: "Batal",
      variant: "default",
      icon: "help",
    });

    if (ok) {
      createCategoryMutation.mutate({
        name: catName,
        kind: targetKind,
        icon: "tag",
      });
    }
  };

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
    items?: Array<{ name: string; qty?: number; price?: number }>;
    tax?: number;
    discount?: number;
    documentType?: string;
    isMultipleTransactions?: boolean;
    transactions?: Array<any>;
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

  const [isAiParsingVoice, setIsAiParsingVoice] = useState(false);

  // Helper untuk mengisi seluruh form dari hasil parsing (lokal maupun AI)
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
      const foundAcc = accountsData.accounts.find(
        (a) =>
          a.name.toLowerCase().includes(data.accountHint.toLowerCase()) ||
          data.accountHint.toLowerCase().includes(a.name.toLowerCase())
      );
      if (foundAcc) setAccountId(foundAcc.id);
    }

    if (data.txType === "transfer") {
      if (data.matchedToAccountId) {
        setToAccountId(data.matchedToAccountId);
      } else if (accountsData?.accounts && data.toAccountHint) {
        const fromId = data.matchedAccountId || accountId || accountsData.accounts[0]?.id;
        const fallbackTo = accountsData.accounts.find(
          (a) =>
            a.id !== fromId &&
            (a.name.toLowerCase().includes(data.toAccountHint.toLowerCase()) ||
              data.toAccountHint.toLowerCase().includes(a.name.toLowerCase()))
        );
        if (fallbackTo) setToAccountId(fallbackTo.id);
      }
    } else {
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
          .find(
            (c) =>
              c.name.toLowerCase().includes(data.categoryHint.toLowerCase()) ||
              data.categoryHint.toLowerCase().includes(c.name.toLowerCase())
          );
        if (foundCat) {
          setCategoryId(foundCat.id);
          setNlpRecommendedCategory(null);
        } else {
          setNlpRecommendedCategory({
            name: data.categoryHint,
            kind: data.txType === "income" ? "income" : "expense",
          });
        }
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

  // Smart Voice & NLP parsing dengan Automatic Gemini 2.5 Flash Native Audio Fallback
  const applySmartSpeechParse = (
    transcript: string,
    audioBase64?: string,
    mimeType?: string
  ) => {
    // 1. Eksekusi lokal instan (0 ms latency)
    const result = smartParseIndonesianTransaction(transcript, {
      accounts: accountsData?.accounts,
      categories: categoriesList,
    });

    // Isi langsung form dengan hasil parsing lokal terbaik
    applyParsedDataToForm(result);

    // 2. Evaluasi apakah kata kunci transaksi cocok dengan dataset fin_iq
    const isConfident = isConfidentDatasetMatch(result);

    if (isConfident || !audioBase64) {
      // Kata kunci ditemukan di dataset fin_iq atau input berupa teks! Kirim ke backend mutation untuk sinkronisasi lokal
      parseMutation.mutate({ text: transcript, clientTime: new Date().toISOString() });
    } else {
      // Hanya fallback ke Gemini jika ada data rekaman audio nyata
      setIsAiParsingVoice(true);
      parseAudioMutation.mutate({
        audioBase64,
        mimeType: mimeType || "audio/webm",
        transcript: transcript || undefined,
        clientTime: new Date().toISOString(),
      });
    }
  };

  const parseMutation = trpc.ai.parseTextToTransaction.useMutation({
    onSuccess: (data) => {
      applyParsedDataToForm(data);
    },
  });

  const parseAudioMutation = trpc.ai.parseAudioWithGemini.useMutation({
    onSuccess: (data) => {
      setIsAiParsingVoice(false);
      applyParsedDataToForm(data);
    },
    onError: (err) => {
      setIsAiParsingVoice(false);
      console.warn("Fallback Gemini Native Audio gagal:", err.message);
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
        setNlpRecommendedCategory(null);
      } else if (data.recommendedCategory && data.recommendedCategory.isNew) {
        setNlpRecommendedCategory({
          name: data.recommendedCategory.name,
          kind: data.recommendedCategory.kind,
        });
      } else if (data.categoryHint) {
        const exists = categoriesList?.some(
          (c) => c.name.toLowerCase().trim() === data.categoryHint.toLowerCase().trim()
        );
        if (!exists) {
          setNlpRecommendedCategory({
            name: data.categoryHint,
            kind: data.txType === "income" ? "income" : "expense",
          });
        }
      }

      setScannedBillMeta({
        merchantName: data.merchantName,
        itemsSummary: data.itemsSummary,
        itemsCount: data.itemsCount || data.items?.length || 0,
        items: data.items || [],
        tax: data.tax,
        discount: data.discount,
        documentType: data.documentType,
        isMultipleTransactions: data.isMultipleTransactions,
        transactions: data.transactions || [],
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
      alert({
        title: "Format Gambar Tidak Didukung",
        description: "Harap pilih file gambar (JPG, PNG, atau WEBP).",
        variant: "warning",
      });
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

  const { isListening, isProcessing, startListening, stopListening } = useVoiceInput(
    (transcript, audioBase64, mimeType) => {
      applySmartSpeechParse(transcript, audioBase64, mimeType);
    }
  );

  const isVoiceBusy = isProcessing || isAiParsingVoice;

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
      alert({
        title: "Gagal Menyimpan Transaksi",
        description: err.message,
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  // ESC shortcut to close modal / nested modals safely
  useEffect(() => {
    if (!isQuickAddOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (previewModalOpen) {
          setPreviewModalOpen(false);
        } else if (showSourceChoiceModal) {
          setShowSourceChoiceModal(false);
        } else {
          closeQuickAdd();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isQuickAddOpen, previewModalOpen, showSourceChoiceModal, closeQuickAdd]);

  const defaultAccountId = accountsData?.accounts?.[0]?.id || "";
  const defaultExpenseCategoryId = categoriesList?.find((c) => c.kind === "expense")?.id || "";

  const hasDraftData = Boolean(
    (amount && amount.trim() !== "" && amount.trim() !== "0") ||
    (note && note.trim() !== "") ||
    (happenedAt && happenedAt.trim() !== "") ||
    receiptPreviewUrl ||
    scannedBillMeta ||
    toAccountId ||
    nlpRecommendedCategory ||
    txType !== "expense" ||
    (accountId && accountId !== defaultAccountId) ||
    (categoryId && categoryId !== defaultExpenseCategoryId)
  );

  const resetForm = () => {
    setTxType("expense");
    setAmount("");
    setHappenedAt("");
    setNote("");
    setToAccountId("");
    setReceiptPreviewUrl(null);
    setScannedBillMeta(null);
    setBillScanError(null);
    setNlpRecommendedCategory(null);
    setIsScanningBill(false);
    setShowSourceChoiceModal(false);

    if (accountsData?.accounts && accountsData.accounts.length > 0) {
      setAccountId(accountsData.accounts[0].id);
    } else {
      setAccountId("");
    }
    const defaultCat = categoriesList?.find((c) => c.kind === "expense");
    setCategoryId(defaultCat ? defaultCat.id : "");
  };

  const handleClearForm = async () => {
    if (!hasDraftData) return;
    const ok = await confirm({
      title: "Bersihkan Form Catat Transaksi?",
      description:
        "Semua input nominal, catatan, foto struk, dan pengaturan transaksi yang belum disimpan akan dikosongkan.",
      confirmText: "Ya, Bersihkan",
      cancelText: "Batal",
      variant: "destructive",
      icon: "trash",
    });

    if (ok) {
      resetForm();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseInputIDR(amount);
    if (!numAmount || numAmount <= 0) {
      alert({
        title: "Nominal Tidak Valid",
        description: "Harap masukkan nominal transaksi yang valid.",
        variant: "warning",
      });
      return;
    }

    const defaultLedgerId = ledgersList?.[0]?.id || "default";
    const selectedAcc = accountId || accountsData?.accounts?.[0]?.id;

    if (!selectedAcc) {
      alert({
        title: "Akun Belum Dipilih",
        description: "Harap pilih akun transaksi terlebih dahulu.",
        variant: "warning",
      });
      return;
    }

    if (txType === "transfer") {
      if (!toAccountId) {
        alert({
          title: "Akun Tujuan Belum Dipilih",
          description: "Harap pilih akun tujuan untuk transaksi transfer.",
          variant: "warning",
        });
        return;
      }
      if (selectedAcc === toAccountId) {
        alert({
          title: "Akun Tidak Boleh Sama",
          description: "Akun asal dan akun tujuan transfer tidak boleh sama.",
          variant: "warning",
        });
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={closeQuickAdd}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl bg-card border border-border/80 shadow-2xl overflow-hidden text-card-foreground animate-in zoom-in-95 duration-150"
      >
        {/* Header - Fixed & Pinned at Top */}
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0 bg-card z-10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Catat Transaksi</h2>
                {hasDraftData && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Draf Tersimpan
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Manual, dikte suara AI, atau scan struk</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {hasDraftData && (
              <button
                type="button"
                onClick={handleClearForm}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all border border-border/60 hover:border-destructive/30 cursor-pointer shadow-2xs"
                title="Bersihkan seluruh input form"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Bersihkan</span>
              </button>
            )}
            <button
              type="button"
              onClick={closeQuickAdd}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Tutup (Draf input tetap tersimpan)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Content Body */}
        <div
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4 overscroll-contain
            [&::-webkit-scrollbar]:w-2
            [&::-webkit-scrollbar-track]:bg-muted/20
            [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30
            [&::-webkit-scrollbar-thumb]:rounded-full
            hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50
            transition-colors"
        >
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

        {/* AI Assistant Quick Input Toolbar */}
        <div className="mt-4 rounded-xl border border-border/70 bg-muted/30 p-2.5">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold text-foreground">Asisten Input AI</span>
            </div>
            <span className="text-[10px] text-muted-foreground">Otomatis isi nominal & detail</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Dikte Suara */}
            <Button
              type="button"
              variant={isListening ? "destructive" : "outline"}
              size="sm"
              disabled={isVoiceBusy || isScanningBill}
              onClick={isListening ? stopListening : startListening}
              className={cn(
                "h-9 rounded-xl text-xs font-semibold gap-1.5 border-border/80 bg-card hover:bg-muted/80 transition-all shadow-2xs",
                isListening && "animate-pulse bg-rose-500 text-white border-rose-500 hover:bg-rose-600",
                isVoiceBusy && "border-primary/40 text-primary animate-pulse"
              )}
              title="Dikte transaksi lewat suara"
            >
              {isListening ? (
                <MicOff className="h-3.5 w-3.5 shrink-0" />
              ) : isVoiceBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
              ) : (
                <Mic className="h-3.5 w-3.5 text-primary shrink-0" />
              )}
              <span className="truncate">{isListening ? "Berhenti" : isVoiceBusy ? "AI Memproses..." : "Dikte"}</span>
            </Button>

            {/* Buka Kamera */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isScanningBill || isVoiceBusy}
              onClick={() => cameraInputRef.current?.click()}
              className="h-9 rounded-xl text-xs font-semibold gap-1.5 border-border/80 bg-card hover:bg-muted/80 hover:text-primary transition-all shadow-2xs cursor-pointer"
              title="Buka Kamera untuk foto struk atau mutasi"
            >
              {isScanningBill ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
              ) : (
                <Camera className="h-3.5 w-3.5 text-primary shrink-0" />
              )}
              <span className="truncate">Kamera</span>
            </Button>

            {/* Buka Galeri */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isScanningBill || isVoiceBusy}
              onClick={() => galleryInputRef.current?.click()}
              className="h-9 rounded-xl text-xs font-semibold gap-1.5 border-border/80 bg-card hover:bg-muted/80 hover:text-primary transition-all shadow-2xs cursor-pointer"
              title="Buka Galeri foto atau dokumen"
            >
              {isScanningBill ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
              ) : (
                <ImageIcon className="h-3.5 w-3.5 text-primary shrink-0" />
              )}
              <span className="truncate">Galeri</span>
            </Button>
          </div>

          {/* Quick NLP Text Parser Input Bar */}
          <div className="mt-2.5 flex items-center gap-1.5 pt-2 border-t border-border/50">
            <Input
              type="text"
              placeholder="Ketik transaksi: misal 'Beli makan 35rb pake bca tadi siang'..."
              value={nlpInputText}
              onChange={(e) => setNlpInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (nlpInputText.trim()) {
                    applySmartSpeechParse(nlpInputText.trim());
                    setNlpInputText("");
                  }
                }
              }}
              className="h-8 text-xs bg-background/90 rounded-xl"
            />
            <Button
              type="button"
              size="sm"
              disabled={!nlpInputText.trim()}
              onClick={() => {
                if (nlpInputText.trim()) {
                  applySmartSpeechParse(nlpInputText.trim());
                  setNlpInputText("");
                }
              }}
              className="h-8 px-3 rounded-xl text-xs font-bold bg-[#00B569] hover:bg-[#009E5B] text-white shrink-0 gap-1 cursor-pointer"
              title="Parse transaksi otomatis dengan NLP lokal"
            >
              <Sparkles className="h-3 w-3" />
              <span>Parse</span>
            </Button>
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
                <div className="flex items-center gap-1.5 flex-wrap">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-bold text-foreground truncate">
                    {scannedBillMeta?.documentType === "transfer_proof"
                      ? `Bukti Transfer: ${scannedBillMeta.merchantName || "M-Banking"}`
                      : scannedBillMeta?.isMultipleTransactions
                      ? `Mutasi: ${scannedBillMeta.merchantName || "M-Banking"}`
                      : scannedBillMeta?.merchantName || "Dokumen Keuangan Terbaca"}
                  </span>
                  {scannedBillMeta?.itemsCount && scannedBillMeta.itemsCount > 1 ? (
                    <span className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                      {scannedBillMeta.itemsCount} Produk
                    </span>
                  ) : null}
                  {scannedBillMeta?.isMultipleTransactions ? (
                    <span className="bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                      {scannedBillMeta.transactions?.length} Mutasi
                    </span>
                  ) : null}
                </div>
                <span className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                  {scannedBillMeta?.itemsSummary || "Data transaksi berhasil diekstrak dan diisi otomatis."}
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

        {/* Form Body Fields */}
        <div className="space-y-4 pt-1">
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
                className={cn("pl-10 text-lg font-bold tracking-tight h-12", amount && "pr-9")}
                required
                autoFocus
              />
              {amount && (
                <button
                  type="button"
                  onClick={() => setAmount("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  title="Hapus nominal"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
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

          {/* Rekomendasi Kategori NLP Banner */}
          {nlpRecommendedCategory && !categoriesList?.some((c) => c.name.toLowerCase().trim() === nlpRecommendedCategory.name.toLowerCase().trim()) && (
            <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent border border-emerald-500/30 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Rekomendasi Kategori NLP
                    </span>
                    <span className="text-[10px] text-muted-foreground/80">&bull; Belum ada di daftar</span>
                  </div>
                  <span className="text-xs font-bold text-foreground truncate">
                    &quot;{nlpRecommendedCategory.name}&quot;
                  </span>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => handleCreateRecommendedCategory(nlpRecommendedCategory.name, nlpRecommendedCategory.kind)}
                className="h-8 px-3 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 gap-1.5 shadow-sm cursor-pointer transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                Buat Kategori
              </Button>
            </div>
          )}

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
              <AccountSelect
                accounts={accountsData?.accounts || []}
                value={accountId}
                onChange={setAccountId}
                placeholder="Pilih Akun..."
              />
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
                <AccountSelect
                  accounts={(accountsData?.accounts || []).filter((a) => a.id !== accountId)}
                  value={toAccountId}
                  onChange={setToAccountId}
                  placeholder="Pilih Akun Tujuan..."
                />
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
                  onCreateRecommended={handleCreateRecommendedCategory}
                />
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
                onResult={(text, audioBase64, mimeType) => {
                  applySmartSpeechParse(text, audioBase64, mimeType);
                }}
              />
            </div>
            <div className="relative">
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
                className={cn("h-10 text-xs", note && "pr-8")}
              />
              {note && (
                <button
                  type="button"
                  onClick={() => setNote("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  title="Hapus catatan"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          </div>
        </div>

        {/* Fixed Pinned Footer Actions */}
        <div className="border-t border-border/70 px-6 py-3.5 shrink-0 bg-card/95 backdrop-blur-sm flex items-center justify-between gap-3 z-10">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!hasDraftData || isSubmitting}
              onClick={handleClearForm}
              className={cn(
                "rounded-xl h-10 px-3 text-xs font-semibold transition-colors gap-1.5 cursor-pointer",
                hasDraftData
                  ? "text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10"
                  : "opacity-40 cursor-not-allowed text-muted-foreground"
              )}
              title={hasDraftData ? "Bersihkan seluruh input form" : "Form masih kosong"}
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span>Bersihkan</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-xl h-10 text-xs font-semibold cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={closeQuickAdd}
              title="Tutup modal (Draf input tetap tersimpan)"
            >
              Batal
            </Button>
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 max-w-[240px] bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-10 text-xs shadow-md cursor-pointer transition-all"
          >
            {isSubmitting ? "Menyimpan..." : "Simpan Transaksi"}
          </Button>
        </div>
      </form>
    </div>
  );
}
