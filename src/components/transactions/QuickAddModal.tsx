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
  Compass,
} from "lucide-react";
import { useMascotStore } from "@/store/mascot.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatInputIDR, parseInputIDR, cleanNumericAmount } from "@/lib/utils";
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
import { useTranslation } from "@/i18n";
import { CategorySelect } from "./CategorySelect";
import { AccountSelect } from "./AccountSelect";

export function QuickAddModal() {
  const { isQuickAddOpen, closeQuickAdd, quickAddAutoScan, setQuickAddAutoScan } = useUIStore();
  const { startTransactionTour, isTourActive, activeTourType, completeTransactionTourSuccess } = useMascotStore();
  const utils = trpc.useUtils();
  const alert = useAlert();
  const { t, locale } = useTranslation();
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
  const [detectedItems, setDetectedItems] = useState<
    Array<{ name: string; amount: number; formattedAmount: string; qty?: number }>
  >([]);

  const handleRemoveDetectedItem = (indexToRemove: number) => {
    const updated = detectedItems.filter((_, idx) => idx !== indexToRemove);
    setDetectedItems(updated);
    if (updated.length > 0) {
      const newTotal = updated.reduce((sum, it) => sum + it.amount, 0);
      setAmount(formatInputIDR(String(newTotal)));
      const newNote = updated
        .map((it) => `${it.qty && it.qty > 1 ? `${it.qty}x ` : ""}${it.name} (Rp ${it.formattedAmount})`)
        .join(", ");
      setNote(newNote);
    } else {
      setAmount("");
      setNote("");
    }
  };

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
      title: `Buat Kategori "${catName}"?`,
      description: `Kategori "${catName}" belum terdaftar di pembukuan Anda. Buat kategori baru ini untuk jenis ${targetKind === "income" ? "Pemasukan" : "Pengeluaran"} dan gunakan pada transaksi ini?`,
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

  const { data: accountsData, isLoading: isLoadingAccounts } = trpc.accounts.list.useQuery();
  const { data: categoriesList, isLoading: isLoadingCategories } = trpc.categories.list.useQuery();
  const { data: ledgersList } = trpc.ledgers.list.useQuery();

  // Inisialisasi otomatis akun default ketika data akun dimuat
  useEffect(() => {
    if (!accountId && accountsData?.accounts && accountsData.accounts.length > 0) {
      setAccountId(accountsData.accounts[0].id);
    }
  }, [accountsData, accountId]);

  // Inisialisasi otomatis kategori default ketika daftar kategori dimuat
  useEffect(() => {
    if (!categoryId && categoriesList && categoriesList.length > 0) {
      const defaultCat = categoriesList.find((c) => c.kind === txType);
      if (defaultCat) setCategoryId(defaultCat.id);
    }
  }, [categoriesList, categoryId, txType]);

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
    } else if (accountsData?.accounts && (data.accountHint || data.rawText)) {
      const detected = detectAccount(data.accountHint || data.rawText, accountsData.accounts);
      if (detected.matchedAccountId) {
        setAccountId(detected.matchedAccountId);
      } else {
        const foundAcc = accountsData.accounts.find(
          (a) =>
            a.name.toLowerCase().includes((data.accountHint || "").toLowerCase()) ||
            (data.accountHint && (data.accountHint || "").toLowerCase().includes(a.name.toLowerCase()))
        );
        if (foundAcc) setAccountId(foundAcc.id);
      }
    }

    if (data.txType === "transfer") {
      if (data.matchedToAccountId) {
        setToAccountId(data.matchedToAccountId);
      } else if (accountsData?.accounts && (data.toAccountHint || data.rawText)) {
        const detected = detectAccount(data.toAccountHint || data.rawText, accountsData.accounts);
        if (detected.matchedToAccountId) {
          setToAccountId(detected.matchedToAccountId);
        } else {
          const fromId = data.matchedAccountId || accountId || accountsData.accounts[0]?.id;
          const fallbackTo = accountsData.accounts.find(
            (a) =>
              a.id !== fromId &&
              (a.name.toLowerCase().includes((data.toAccountHint || "").toLowerCase()) ||
                (data.toAccountHint && (data.toAccountHint || "").toLowerCase().includes(a.name.toLowerCase())))
          );
          if (fallbackTo) setToAccountId(fallbackTo.id);
        }
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

    if (data.items && Array.isArray(data.items) && data.items.length >= 2) {
      setDetectedItems(
        data.items.map((it: any) => {
          const amt = cleanNumericAmount(it.amount || it.price);
          return {
            name: (it.name || "Item").trim(),
            amount: amt,
            formattedAmount: it.formattedAmount || formatInputIDR(String(amt)),
            qty: it.qty,
          };
        })
      );
    } else if (!data.items || (Array.isArray(data.items) && data.items.length < 2)) {
      setDetectedItems([]);
    }

    if (data.cleanNote) {
      setNote(data.cleanNote);
    } else if (data.note) {
      setNote(data.note);
    }
  };

  // Smart Voice & NLP parsing dengan Automatic Gemini Flash Native Audio Fallback
  const applySmartSpeechParse = (
    transcript: string,
    audioBase64?: string,
    mimeType?: string
  ) => {
    const cleanText = (transcript || "").trim();
    if (!cleanText && !audioBase64) return;

    if (cleanText) {
      // 1. Eksekusi lokal instan (0 ms latency)
      const result = smartParseIndonesianTransaction(cleanText, {
        accounts: accountsData?.accounts,
        categories: categoriesList,
      });

      // Isi langsung form dengan hasil parsing lokal terbaik
      applyParsedDataToForm(result);

      // 2. Evaluasi apakah kata kunci transaksi cocok dengan dataset fin_iq
      const isConfident = isConfidentDatasetMatch(result);

      if (isConfident || !audioBase64) {
        // Kata kunci ditemukan di dataset fin_iq atau input berupa teks! Kirim ke backend mutation untuk sinkronisasi lokal
        if (cleanText.length >= 2) {
          parseMutation.mutate({ text: cleanText, clientTime: new Date().toISOString() });
        }
        return;
      }
    }

    // Hanya fallback ke Gemini jika ada data rekaman audio nyata
    if (audioBase64) {
      setIsAiParsingVoice(true);
      parseAudioMutation.mutate({
        audioBase64,
        mimeType: mimeType || "audio/webm",
        transcript: cleanText || undefined,
        clientTime: new Date().toISOString(),
      });
    }
  };

  const parseMutation = trpc.ai.parseTextToTransaction.useMutation({
    onSuccess: (data) => {
      applyParsedDataToForm(data);
    },
    onError: (err) => {
      console.warn("Sinkronisasi AI text parse:", err.message);
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

      if (data.items && data.items.length >= 2) {
        setDetectedItems(
          data.items.map((it: any) => {
            const itAmt = cleanNumericAmount(it.amount || it.price);
            return {
              name: (it.name || "Item").trim(),
              amount: itAmt,
              formattedAmount: it.formattedAmount || formatInputIDR(String(itAmt)),
              qty: it.qty,
            };
          })
        );
      } else if (data.transactions && data.transactions.length >= 2) {
        setDetectedItems(
          data.transactions.map((t: any) => ({
            name: t.note || "Transaksi",
            amount: t.amount,
            formattedAmount: t.formattedAmount || formatInputIDR(String(t.amount)),
          }))
        );
      } else {
        setDetectedItems([]);
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
    setDetectedItems([]);
    setBillScanError(null);
  };

  const {
    isListening,
    isProcessing,
    error: voiceError,
    startListening,
    stopListening,
  } = useVoiceInput((transcript, audioBase64, mimeType) => {
    applySmartSpeechParse(transcript, audioBase64, mimeType);
  });

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

      // Jika transaksi berhasil dibuat saat tour transaksi sedang aktif, lanjut flow tutor
      if (isTourActive && activeTourType === "transaction") {
        completeTransactionTourSuccess();
      }
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
    detectedItems.length > 0 ||
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
    setDetectedItems([]);
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
      const amountEl = document.querySelector<HTMLInputElement>(
        "[data-tour='modal-amount'] input, input[name='amount']"
      );
      if (amountEl) amountEl.focus();
      return;
    }

    if (isLoadingAccounts || !accountsData) {
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
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={() => {
        if (isTourActive && activeTourType === "transaction") return;
        closeQuickAdd();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Catat Transaksi"
        data-tour-modal="quick-add"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg max-h-[90vh] sm:max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-card border-t sm:border border-border/80 shadow-2xl overflow-hidden text-card-foreground animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200"
      >
        {/* Mobile Drag Indicator Bar */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0 bg-card select-none">
          <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header - Fixed & Pinned at Top */}
        <div className="flex items-center justify-between border-b border-border/70 px-5 sm:px-6 py-3.5 shrink-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary shrink-0">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground tracking-tight whitespace-nowrap">
                  {t.quickAdd.title}
                </h2>
                {hasDraftData && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Draf
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Manual, suara, atau foto struk</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => startTransactionTour(false)}
              className="h-9 px-2.5 sm:px-3 rounded-lg text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs touch-manipulation"
              title="Buka tutorial interaktif form transaksi"
            >
              <Compass className="h-3.5 w-3.5 text-primary" />
              <span>Tutorial</span>
            </button>
            <button
              type="button"
              onClick={closeQuickAdd}
              className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer active:scale-95 touch-manipulation"
              title="Tutup (Draf input tetap tersimpan)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
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
          <div data-tour="modal-ai-tools" className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-bold text-foreground">Bantuan AI & Cepat</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Dikte suara, scan struk, atau ketik teks</span>
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
                  "h-9 rounded-lg text-xs font-semibold gap-1.5 border-border/80 bg-card hover:bg-muted/80 transition-all shadow-2xs active:scale-[0.98] cursor-pointer",
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
                <span className="truncate">{isListening ? "Berhenti" : isVoiceBusy ? "Memproses..." : "Dikte"}</span>
              </Button>

              {/* Buka Kamera */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isScanningBill || isVoiceBusy}
                onClick={() => cameraInputRef.current?.click()}
                className="h-9 rounded-lg text-xs font-semibold gap-1.5 border-border/80 bg-card hover:bg-muted/80 hover:text-primary transition-all shadow-2xs cursor-pointer active:scale-[0.98]"
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
                className="h-9 rounded-lg text-xs font-semibold gap-1.5 border-border/80 bg-card hover:bg-muted/80 hover:text-primary transition-all shadow-2xs cursor-pointer active:scale-[0.98]"
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

            {voiceError && !isListening && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{voiceError}</span>
              </div>
            )}

            {/* Quick NLP Text Parser Input Bar */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/40">
              <Input
                type="text"
                placeholder="Ketik santai: 'Kopi 25rb bayar bca tadi siang'..."
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
                className="h-9 rounded-lg text-xs bg-background/90 border border-input/80 px-3 placeholder:text-muted-foreground/60 focus-visible:border-primary"
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
                className="h-8.5 px-3.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/90 text-white shrink-0 gap-1.5 cursor-pointer active:scale-[0.98] shadow-xs"
                title="Parse transaksi otomatis dengan NLP lokal"
              >
                <Sparkles className="h-3 w-3" />
                <span>Proses</span>
              </Button>
            </div>
          </div>

        {/* Bill Scanning Progress Indicator */}
        {isScanningBill && (
          <div className="mt-2.5 flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/10 text-xs animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin shrink-0 text-primary" />
            <div className="flex flex-col">
              <span className="font-semibold text-foreground">Membaca struk...</span>
              <span className="text-[11px] text-muted-foreground">
                Mendeteksi nominal, tanggal, dan nama toko.
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
          <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="relative max-w-md w-full max-h-[85vh] bg-card rounded-2xl overflow-hidden flex flex-col p-4 border border-border shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-border/70">
                <span className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                  <Receipt className="h-4 w-4 text-primary" />
                  Pratinjau Struk / Bukti
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-auto py-3 flex items-center justify-center bg-muted/20 rounded-xl mt-2 border border-border/50">
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
                  className="text-xs rounded-lg h-8 px-4"
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
            className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
            onClick={() => setShowSourceChoiceModal(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
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
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer"
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
                  className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl border border-border/80 hover:border-primary hover:bg-primary/5 transition-all text-center group cursor-pointer active:scale-[0.98]"
                >
                  <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Camera className="h-5.5 w-5.5" />
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
                  className="flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl border border-border/80 hover:border-primary hover:bg-primary/5 transition-all text-center group cursor-pointer active:scale-[0.98]"
                >
                  <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                    <ImageIcon className="h-5.5 w-5.5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground">Buka Galeri</span>
                    <span className="text-[10px] text-muted-foreground">Pilih dari album</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Form Body Fields */}
        <div className="space-y-4 pt-1">
          {/* Tipe Transaksi */}
          <div data-tour="modal-tx-type" className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted/60 p-1 border border-border/50">
            <button
              type="button"
              onClick={() => handleTxTypeChange("expense")}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all duration-140 ease-out active:scale-[0.98] cursor-pointer",
                txType === "expense"
                  ? "bg-rose-600 text-white shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60 font-medium"
              )}
            >
              <ArrowDownLeft className="h-3.5 w-3.5" />
              <span>{t.quickAdd.tabExpense}</span>
            </button>
            <button
              type="button"
              onClick={() => handleTxTypeChange("income")}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all duration-140 ease-out active:scale-[0.98] cursor-pointer",
                txType === "income"
                  ? "bg-emerald-600 text-white shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60 font-medium"
              )}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>{t.quickAdd.tabIncome}</span>
            </button>
            <button
              type="button"
              onClick={() => handleTxTypeChange("transfer")}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all duration-140 ease-out active:scale-[0.98] cursor-pointer",
                txType === "transfer"
                  ? "bg-blue-600 text-white shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60 font-medium"
              )}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span>{t.quickAdd.tabTransfer}</span>
            </button>
          </div>

          {/* Nominal Input */}
          <div data-tour="modal-amount">
            <div className="flex items-center justify-between h-6 mb-1.5">
              <label className="text-xs font-medium text-foreground/80">{t.quickAdd.amountLabel}</label>
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
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-sm select-none">
                {locale === "en" ? "IDR" : "Rp"}
              </span>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(formatInputIDR(e.target.value))}
                className={cn(
                  "h-11 rounded-lg border-input/80 pl-11 text-lg font-bold font-mono tabular-nums tracking-tight bg-background/80 shadow-2xs focus-visible:border-primary",
                  amount && "pr-9"
                )}
                required
                autoFocus
              />
              {amount && (
                <button
                  type="button"
                  onClick={() => setAmount("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer active:scale-95"
                  title="Hapus nominal"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Multi-Item Breakdown Card jika ada 2 atau lebih item dijumlahkan */}
            {detectedItems.length >= 2 && (
              <div className="mt-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 p-3 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-xs font-bold text-foreground">
                      {detectedItems.length} Item Terdeteksi (Dijumlahkan Otomatis)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-full font-mono shrink-0">
                    Total: Rp {amount}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Semua item di bawah dijumlahkan ke nominal transaksi dan otomatis dicantumkan di catatan.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {detectedItems.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-card border border-border/80 shadow-2xs text-foreground group"
                    >
                      <span className="font-semibold">{item.qty && item.qty > 1 ? `${item.qty}x ` : ""}{item.name}:</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        Rp {item.formattedAmount}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDetectedItem(idx)}
                        className="text-muted-foreground hover:text-rose-500 ml-0.5 p-0.5 rounded hover:bg-muted cursor-pointer active:scale-95 transition-colors"
                        title={`Hapus ${item.name} dari penjumlahan`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tanggal & Waktu Transaksi (Opsional - Default NOW) */}
          <div data-tour="modal-date">
            <div className="flex items-center justify-between h-6 mb-1.5">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <label className="text-xs font-medium text-foreground/80">Tanggal & Waktu</label>
              </div>
              <div className="flex items-center gap-2">
                {happenedAt ? (
                  <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                    Kustom
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">
                    Otomatis (Saat Ini)
                  </span>
                )}
                <VoiceMicButton
                  size="xs"
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
            <div className="relative flex gap-2">
              <Input
                type="datetime-local"
                value={happenedAt}
                onChange={(e) => setHappenedAt(e.target.value)}
                className="h-10 rounded-lg text-xs font-mono tabular-nums border-input/80 flex-1 px-3 bg-background/80 shadow-2xs focus-visible:border-primary"
              />
              {happenedAt ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setHappenedAt("")}
                  className="h-10 px-3 rounded-lg text-xs font-medium border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 flex items-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
                  title="Kembalikan ke waktu sekarang (NOW)"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset NOW</span>
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
                  className="h-10 px-3 rounded-lg text-xs font-medium border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary shrink-0 flex items-center gap-1.5 active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
                  title="Pilih tanggal & jam spesifik"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Atur Waktu</span>
                </Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              *Transaksi otomatis dicatat pada waktu saat ini jika tidak diatur.
            </p>
          </div>

          {/* Rekomendasi Kategori NLP Banner */}
          {nlpRecommendedCategory && !categoriesList?.some((c) => c.name.toLowerCase().trim() === nlpRecommendedCategory.name.toLowerCase().trim()) && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent border border-emerald-500/25 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
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
                className="h-8 px-3 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 gap-1.5 shadow-xs cursor-pointer transition-all active:scale-[0.98]"
              >
                <Plus className="h-3.5 w-3.5" />
                Buat Kategori
              </Button>
            </div>
          )}

          {/* Akun & Kategori */}
          <div data-tour="modal-account-category" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Akun Sumber */}
            <div>
              <div className="flex items-center justify-between h-6 mb-1.5">
                <label className="text-xs font-medium text-foreground/80">
                  {txType === "transfer" ? "Dari Akun" : "Akun"}
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

            {/* Target Akun atau Kategori */}
            {txType === "transfer" ? (
              <div>
                <div className="flex items-center justify-between h-6 mb-1.5">
                  <label className="text-xs font-medium text-foreground/80">Ke Akun</label>
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
                  <label className="text-xs font-medium text-foreground/80">Kategori</label>
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
                  onCreateRecommended={handleCreateRecommendedCategory}
                  align="right"
                />
              </div>
            )}
          </div>

          {/* Catatan */}
          <div>
            <div className="flex items-center justify-between h-6 mb-1.5">
              <label className="text-xs font-medium text-foreground/80">Catatan / Deskripsi</label>
              <VoiceMicButton
                size="xs"
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
                className={cn(
                  "h-10 rounded-lg text-xs border border-input/80 bg-background/80 px-3 shadow-2xs focus-visible:border-primary",
                  note && "pr-9"
                )}
              />
              {note && (
                <button
                  type="button"
                  onClick={() => setNote("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer active:scale-95"
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
        <div data-tour="modal-submit-action" className="border-t border-border/70 px-5 sm:px-6 py-3.5 pb-[max(0.875rem,calc(env(safe-area-inset-bottom,0px)+0.5rem))] shrink-0 bg-card/95 backdrop-blur-sm flex items-center justify-between gap-3 z-10">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!hasDraftData || isSubmitting}
              onClick={handleClearForm}
              className={cn(
                "rounded-lg h-9 px-3 text-xs font-semibold transition-all gap-1.5 cursor-pointer active:scale-[0.98]",
                hasDraftData
                  ? "text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10"
                  : "opacity-40 cursor-not-allowed text-muted-foreground"
              )}
              title={hasDraftData ? "Bersihkan seluruh input form" : "Form masih kosong"}
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span>{locale === "en" ? "Clear" : "Bersihkan"}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-lg h-9 px-3 text-xs font-semibold cursor-pointer text-muted-foreground hover:text-foreground active:scale-[0.98]"
              onClick={closeQuickAdd}
              title={locale === "en" ? "Close modal (draft remains saved)" : "Tutup modal (Draf input tetap tersimpan)"}
            >
              {t.common.cancel}
            </Button>
          </div>
          <Button
            type="submit"
            disabled={isSubmitting || isLoadingAccounts}
            className="flex-1 max-w-[240px] bg-primary hover:bg-primary/90 text-white font-bold rounded-lg h-9 text-xs shadow-xs cursor-pointer transition-all active:scale-[0.98]"
          >
            {isSubmitting ? t.quickAdd.saving : t.quickAdd.saveButton}
          </Button>
        </div>
      </form>
    </div>
  );
}
