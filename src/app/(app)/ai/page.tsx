"use client";

import React, { useState, useRef, useEffect, useTransition, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { compressImageToBase64 } from "@/lib/image-compressor";
import { smartParseIndonesianTransaction } from "@/lib/nlp-parser";
import {
  Sparkles,
  Camera,
  MessageSquareText,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Loader2,
  ArrowRight,
  Receipt,
  Eye,
  Trash2,
  Image as ImageIcon,
  Bot,
  Send,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  Wallet,
  Clock,
  Sparkle,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAlert, useConfirm } from "@/store/confirm.store";
import { GeometricIcon } from "@/components/ui/GeometricIcon";

function AIPageContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const utils = trpc.useUtils();
  const alert = useAlert();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<"ocr" | "chat" | "nlp">("ocr");

  // Gemini Connection Status
  const { data: geminiStatus, isLoading: isStatusLoading } = trpc.user.testGeminiStatus.useQuery();
  const { data: profile } = trpc.user.getProfile.useQuery();

  // Queries for accounts & categories
  const { data: accountsData } = trpc.accounts.list.useQuery();
  const { data: categoriesList } = trpc.categories.list.useQuery();
  const { data: ledgersList } = trpc.ledgers.list.useQuery();

  // --------------------------------------------------------------------------
  // TAB 1: OCR Bill & Struk Scanner State
  // --------------------------------------------------------------------------
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isScanningBill, setIsScanningBill] = useState(false);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [billError, setBillError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<any | null>(null);
  const [isSavingTx, setIsSavingTx] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const parseBillMutation = trpc.ai.parseBillReceipt.useMutation({
    onSuccess: (data) => {
      setIsScanningBill(false);
      setBillError(null);
      setScannedResult(data);
    },
    onError: (err) => {
      setIsScanningBill(false);
      setBillError(err.message || "Gagal memproses struk dengan Gemini AI.");
    },
  });

  const createTxMutation = trpc.transactions.create.useMutation({
    onSuccess: () => {
      setIsSavingTx(false);
      setSaveSuccessMsg("Transaksi berhasil dicatat ke Fin.IQ!");
      utils.transactions.invalidate();
      utils.accounts.invalidate();
      utils.analytics.invalidate();
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    },
    onError: (err) => {
      setIsSavingTx(false);
      alert({
        title: "Gagal Menyimpan Transaksi",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setBillError(null);
    setScannedResult(null);
    setSaveSuccessMsg(null);

    try {
      const { base64, mimeType, previewUrl } = await compressImageToBase64(file);
      setReceiptPreviewUrl(previewUrl);

      parseBillMutation.mutate({
        image: { base64, mimeType },
        clientTime: new Date().toISOString(),
      });
    } catch (err: any) {
      setIsScanningBill(false);
      setBillError(err.message || "Gagal mengompres gambar.");
    } finally {
      e.target.value = "";
    }
  };

  const handleSaveScannedTransaction = () => {
    if (!scannedResult) return;
    const defaultLedgerId = ledgersList?.[0]?.id || "default";
    const accId = scannedResult.matchedAccountId || accountsData?.accounts?.[0]?.id;

    if (!accId) {
      alert({
        title: "Akun Tidak Ditemukan",
        description: "Tidak ditemukan akun transaksi. Silakan buat akun terlebih dahulu.",
        variant: "warning",
      });
      return;
    }

    setIsSavingTx(true);
    createTxMutation.mutate({
      ledgerId: defaultLedgerId,
      txType: scannedResult.txType || "expense",
      amount: scannedResult.amount,
      accountId: accId,
      categoryId: scannedResult.matchedCategoryId || undefined,
      happenedAt: scannedResult.happenedAt || new Date().toISOString(),
      note: scannedResult.note || scannedResult.merchantName || "Struk Belanja Kasir",
    });
  };

  // --------------------------------------------------------------------------
  // TAB 2: Financial Chat Advisor State
  // --------------------------------------------------------------------------
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "assistant"; text: string; time: string }>
  >([
    {
      role: "assistant",
      text: "Halo! Saya Fin.IQ AI Financial Advisor. Saya siap membantu menganalisis pengeluaran Anda, memberi rekomendasi alokasi anggaran, atau menjawab pertanyaan seputar mutasi keuangan Anda.",
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [chatInput, setChatInput] = useState(initialQuery);

  const askAssistantMutation = trpc.ai.askFinancialAssistant.useMutation({
    onSuccess: (data) => {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.answer,
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    },
    onError: (err) => {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `⚠️ Maaf, terjadi kesalahan: ${err.message}`,
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    },
  });

  const handleSendChat = (questionText?: string) => {
    const q = (questionText || chatInput).trim();
    if (!q || askAssistantMutation.isPending) return;

    const userMsg = {
      role: "user" as const,
      text: q,
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");

    askAssistantMutation.mutate({ question: q });
  };

  useEffect(() => {
    if (initialQuery) {
      setActiveTab("chat");
      handleSendChat(initialQuery);
    }
  }, [initialQuery]);

  // --------------------------------------------------------------------------
  // TAB 3: Smart NLP Text Parser State
  // --------------------------------------------------------------------------
  const [nlpText, setNlpText] = useState("");
  const [nlpResult, setNlpResult] = useState<any | null>(null);

  const createCategoryMutation = trpc.categories.create.useMutation({
    onSuccess: (newCat) => {
      utils.categories.invalidate();
      if (nlpResult) {
        setNlpResult({
          ...nlpResult,
          matchedCategoryId: newCat.id,
          categoryHint: newCat.name,
          recommendedCategory: nlpResult.recommendedCategory
            ? { ...nlpResult.recommendedCategory, isNew: false }
            : undefined,
        });
      }
      if (scannedResult) {
        setScannedResult({
          ...scannedResult,
          matchedCategoryId: newCat.id,
          categoryHint: newCat.name,
          recommendedCategory: scannedResult.recommendedCategory
            ? { ...scannedResult.recommendedCategory, isNew: false }
            : undefined,
        });
      }
      alert({
        title: "Kategori Baru Disetujui & Dibuat",
        description: `Kategori "${newCat.name}" berhasil ditambahkan ke daftar kategori Anda.`,
        variant: "default",
        icon: "success",
      });
    },
    onError: (err) => {
      alert({
        title: "Gagal Membuat Kategori",
        description: err.message,
        variant: "destructive",
        icon: "alert",
      });
    },
  });

  const handleCreateRecommendedCategory = async (name: string, kind: "expense" | "income" = "expense") => {
    const isApproved = await confirm({
      title: "Buat Kategori Rekomendasi?",
      description: `Kategori "${name}" belum ada di daftar kategori Anda. Apakah Anda ingin membuat kategori baru ini dan menyetujuinya untuk digunakan pada transaksi ini?`,
      confirmText: "Ya, Buat & Setujui",
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

  const [nlpEngine, setNlpEngine] = useState<"local" | "gemini">("local");

  const parseTextLocalMutation = trpc.ai.parseTextToTransaction.useMutation({
    onSuccess: (data) => {
      setNlpResult(data);
    },
    onError: (err) => {
      console.warn("Local NLP sync warning:", err);
    },
  });

  const parseTextGeminiMutation = trpc.ai.parseTextWithGemini.useMutation({
    onSuccess: (data) => {
      setNlpResult(data);
    },
    onError: (err) => {
      // Fallback ke local parser jika Gemini gagal
      const fallbackLocal = smartParseIndonesianTransaction(nlpText.trim(), {
        accounts: accountsData?.accounts,
        categories: categoriesList,
      });
      setNlpResult({
        ...fallbackLocal,
        happenedAt: fallbackLocal.happenedAt ? fallbackLocal.happenedAt.toISOString() : new Date().toISOString(),
        usedGemini: false,
      });
    },
  });

  const handleParseNlp = (engine: "local" | "gemini" = nlpEngine) => {
    if (!nlpText.trim()) return;

    // 1. Eksekusi lokal instan di browser (0 ms latency)
    const instantLocal = smartParseIndonesianTransaction(nlpText.trim(), {
      accounts: accountsData?.accounts,
      categories: categoriesList,
    });
    setNlpResult({
      ...instantLocal,
      happenedAt: instantLocal.happenedAt ? instantLocal.happenedAt.toISOString() : new Date().toISOString(),
      usedGemini: false,
    });

    // 2. Kirim ke backend sesuai engine pilihan
    if (engine === "local") {
      parseTextLocalMutation.mutate({
        text: nlpText.trim(),
        clientTime: new Date().toISOString(),
      });
    } else {
      parseTextGeminiMutation.mutate({
        text: nlpText.trim(),
        clientTime: new Date().toISOString(),
      });
    }
  };

  const handleSaveNlpTransaction = () => {
    if (!nlpResult) return;
    const defaultLedgerId = ledgersList?.[0]?.id || "default";
    const accId = nlpResult.matchedAccountId || accountsData?.accounts?.[0]?.id;

    if (!accId) {
      alert({
        title: "Akun Belum Dipilih",
        description: "Harap pilih akun transaksi terlebih dahulu.",
        variant: "warning",
      });
      return;
    }

    setIsSavingTx(true);
    const txHappenedAt = nlpResult.happenedAt
      ? typeof nlpResult.happenedAt === "string"
        ? nlpResult.happenedAt
        : nlpResult.happenedAt.toISOString()
      : new Date().toISOString();

    createTxMutation.mutate({
      ledgerId: defaultLedgerId,
      txType: nlpResult.txType || "expense",
      amount: nlpResult.amount,
      accountId: accId,
      categoryId: nlpResult.matchedCategoryId || undefined,
      happenedAt: txHappenedAt,
      note: nlpResult.note || nlpText,
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-[#A7F3D0]/40 flex items-center justify-center text-[#064E3B] shrink-0">
              <GeometricIcon name="ai" className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Fin.IQ AI Studio
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-sm bg-[#A7F3D0]/30 text-[#064E3B] border border-[#059669]/20">
                  Gemini 3 Flash & 3.8
                </span>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pengenalan otomatis struk kasir (OCR), parsing bahasa natural, dan asisten keuangan personal.
              </p>
            </div>
          </div>
        </div>

        {/* Token Status Badge / Link */}
        <div className="flex items-center gap-2">
          {geminiStatus?.connected ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#A7F3D0]/30 border border-[#059669]/20 text-xs font-semibold text-[#064E3B]">
              <GeometricIcon name="check" className="h-3.5 w-3.5" />
              <span>Token Gemini Terhubung</span>
              {geminiStatus.maskedKey && (
                <span className="font-mono text-[10px] opacity-75">({geminiStatus.maskedKey})</span>
              )}
            </div>
          ) : (
            <Link href="/settings">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-md border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10">
                <AlertCircle className="h-3.5 w-3.5" />
                Sambungkan Kunci API
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Warning jika token belum terhubung */}
      {!geminiStatus?.connected && !isStatusLoading && (
        <Card className="p-4 rounded-md border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-3">
            <KeyRound className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-foreground">Token Google Gemini Belum Tersambung</h4>
              <p className="text-muted-foreground mt-0.5">
                Untuk menggunakan OCR Bill Scanner dan Financial Advisor, masukkan Google Gemini API Key Anda di Pengaturan Akun.
              </p>
            </div>
          </div>
          <Link href="/settings" className="shrink-0">
            <Button size="sm" className="bg-[#059669] hover:bg-[#047857] text-white text-xs rounded-md font-semibold gap-1.5 shadow-level-1">
              Sambungkan Sekarang
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </Card>
      )}

      {/* Feature Navigation Tabs */}
      <div className="flex items-center rounded-md bg-slate-100 dark:bg-slate-800/60 p-1 text-xs font-semibold self-start gap-1 border border-border/60">
        <button
          onClick={() => setActiveTab("ocr")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm transition-all ${
            activeTab === "ocr"
              ? "bg-white dark:bg-slate-900 text-foreground shadow-level-1 font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Camera className="h-3.5 w-3.5 text-[#059669]" />
          <span>Scan Struk Kasir (OCR)</span>
        </button>

        <button
          onClick={() => setActiveTab("chat")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm transition-all ${
            activeTab === "chat"
              ? "bg-white dark:bg-slate-900 text-foreground shadow-level-1 font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <GeometricIcon name="ai" className="h-3.5 w-3.5" />
          <span>Financial Advisor (Tanya AI)</span>
        </button>

        <button
          onClick={() => setActiveTab("nlp")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm transition-all ${
            activeTab === "nlp"
              ? "bg-white dark:bg-slate-900 text-foreground shadow-level-1 font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-3.5 w-3.5 text-[#059669]" />
          <span>Smart Text Parser</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: OCR BILL SCANNER */}
      {/* ==================================================================== */}
      {activeTab === "ocr" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Upload Area (Left) */}
          <Card className="lg:col-span-5 p-4 sm:p-5 rounded-md shadow-sm border-border/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b mb-4">
                <Receipt className="h-4 w-4 text-[#059669]" />
                <h3 className="font-extrabold text-sm text-foreground">Unggah Foto Struk / Bill</h3>
              </div>

              {/* Hidden input for Camera capture */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleReceiptFileChange}
              />

              {/* Hidden input for Gallery / Files */}
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleReceiptFileChange}
              />

              {/* Direct Camera vs Gallery Quick Action Buttons */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isScanningBill}
                  onClick={() => cameraInputRef.current?.click()}
                  className="h-8 sm:h-9 rounded-md text-xs font-semibold gap-2 border-border/80 hover:bg-[#A7F3D0]/20 hover:border-[#059669]/40 hover:text-[#064E3B] transition-all shadow-2xs cursor-pointer"
                >
                  <Camera className="h-3.5 w-3.5 text-[#059669]" />
                  <span>Buka Kamera</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isScanningBill}
                  onClick={() => galleryInputRef.current?.click()}
                  className="h-8 sm:h-9 rounded-md text-xs font-semibold gap-2 border-border/80 hover:bg-[#A7F3D0]/20 hover:border-[#059669]/40 hover:text-[#064E3B] transition-all shadow-2xs cursor-pointer"
                >
                  <ImageIcon className="h-3.5 w-3.5 text-[#059669]" />
                  <span>Buka Galeri</span>
                </Button>
              </div>

              {/* Drop / Click Box */}
              <div
                onClick={() => {
                  if (!isScanningBill) galleryInputRef.current?.click();
                }}
                className={`border-2 border-dashed rounded-md p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 min-h-[170px] ${
                  isScanningBill
                    ? "border-[#059669]/50 bg-[#A7F3D0]/10 cursor-not-allowed"
                    : "border-border hover:border-[#059669]/50 hover:bg-muted/40"
                }`}
              >
                {receiptPreviewUrl ? (
                  <div className="relative w-full max-h-56 overflow-hidden rounded-sm border">
                    <img
                      src={receiptPreviewUrl}
                      alt="Pratinjau Struk"
                      className="w-full h-auto object-contain max-h-56 mx-auto"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-semibold gap-1.5">
                      <Camera className="h-4 w-4" />
                      Ganti Foto Struk
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="h-11 w-11 rounded-md bg-[#A7F3D0]/40 text-[#064E3B] flex items-center justify-center">
                      <UploadCloud className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-foreground block">
                        Pilih Gambar atau Tarik File ke Sini
                      </span>
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">
                        Struk Alfamart, Indomaret, resto, café, bukti transfer QRIS, atau invoice PLN/wifi (PNG, JPG, WEBP).
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Progress atau Error */}
              {isScanningBill && (
                <div className="mt-4 flex items-center gap-3 p-3 rounded-sm border border-[#059669]/30 bg-[#A7F3D0]/10 text-xs text-[#064E3B] animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0 text-[#059669]" />
                  <span>Gemini AI sedang memindai dan mengekstrak rincian struk...</span>
                </div>
              )}

              {billError && (
                <div className="mt-4 flex items-center gap-2 p-3 rounded-sm border border-rose-500/30 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{billError}</span>
                </div>
              )}

              {saveSuccessMsg && (
                <div className="mt-4 flex items-center gap-2 p-3 rounded-sm border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t mt-4 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Resolusi otomatis dioptimalkan sebelum diunggah</span>
              {receiptPreviewUrl && !isScanningBill && (
                <button
                  type="button"
                  onClick={() => {
                    setReceiptPreviewUrl(null);
                    setScannedResult(null);
                  }}
                  className="text-rose-500 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Reset
                </button>
              )}
            </div>
          </Card>

          {/* Results Area (Right) */}
          <Card className="lg:col-span-7 p-4 sm:p-5 rounded-md shadow-sm border-border/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b mb-4">
                <div className="flex items-center gap-2">
                  <GeometricIcon name="ai" className="h-4 w-4" />
                  <h3 className="font-extrabold text-sm text-foreground">Hasil Analisis AI Vision Gemini</h3>
                </div>
                {scannedResult && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {scannedResult.documentType === "transfer_proof" && (
                      <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-600 bg-blue-500/10 rounded-sm">
                        💳 Bukti Transfer M-Banking
                      </Badge>
                    )}
                    {scannedResult.documentType === "bank_statement" && (
                      <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-600 bg-purple-500/10 rounded-sm">
                        📑 Riwayat Mutasi Rekening
                      </Badge>
                    )}
                    {scannedResult.documentType === "receipt" && (
                      <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 bg-emerald-500/10 rounded-sm">
                        🧾 Struk Belanja Kasir
                      </Badge>
                    )}
                    {scannedResult.documentType === "bill" && (
                      <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 bg-amber-500/10 rounded-sm">
                        ⚡ Tagihan / Faktur
                      </Badge>
                    )}
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-none font-semibold text-[10px] rounded-sm">
                      Berhasil Diekstrak
                    </Badge>
                  </div>
                )}
              </div>

              {scannedResult ? (
                <div className="space-y-3.5 text-xs">
                  {/* Highlight Nominal & Toko */}
                  <div className="p-3.5 sm:p-4 rounded-md bg-muted/40 border border-border/60 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-muted-foreground block">
                        {scannedResult.documentType === "transfer_proof"
                          ? "Nominal Transfer"
                          : scannedResult.documentType === "bank_statement"
                          ? "Transaksi Utama"
                          : scannedResult.documentType === "bill"
                          ? "Total Tagihan"
                          : "Grand Total Belanja"}
                      </span>
                      <span className={`text-xl font-black ${scannedResult.txType === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {formatCurrency(scannedResult.amount)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-muted-foreground block">
                        {scannedResult.documentType === "transfer_proof" ? "Penerima / Merchant" : "Merchant / Toko"}
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        {scannedResult.merchantName || scannedResult.note || "Transaksi Terdeteksi"}
                      </span>
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="p-2.5 sm:p-3 rounded-sm border bg-card">
                      <span className="text-[10px] text-muted-foreground block uppercase font-medium">Waktu Transaksi</span>
                      <span className="font-semibold text-foreground mt-0.5 block">
                        {formatDateTime(scannedResult.happenedAt)}
                      </span>
                    </div>
                    <div className="p-2.5 sm:p-3 rounded-sm border bg-card">
                      <span className="text-[10px] text-muted-foreground block uppercase font-medium">Saran Kategori</span>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="font-semibold text-foreground">
                          {scannedResult.categoryHint || "Umum"}
                        </span>
                        {scannedResult.recommendedCategory?.isNew && (
                          <button
                            type="button"
                            onClick={() =>
                              handleCreateRecommendedCategory(
                                scannedResult.recommendedCategory.name,
                                scannedResult.recommendedCategory.kind
                              )
                            }
                            className="px-2 py-0.5 rounded-sm text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="h-2.5 w-2.5" />
                            Buat Kategori
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="p-2.5 sm:p-3 rounded-sm border bg-card col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-muted-foreground block uppercase font-medium">Metode / Akun</span>
                      <span className="font-semibold text-foreground mt-0.5 block">
                        {scannedResult.accountHint || "Kas Tunai"}
                      </span>
                    </div>
                  </div>

                  {/* Line Items Breakdown jika ada (Multi-Product Bills) */}
                  {Array.isArray(scannedResult.items) && scannedResult.items.length > 0 && (
                    <div className="border rounded-md p-3 bg-card mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider block">
                          Daftar Produk Belanja ({scannedResult.items.length} produk)
                        </span>
                        <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-600 rounded-sm">
                          Multi-Product
                        </Badge>
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {scannedResult.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-none">
                            <span className="font-medium text-foreground truncate max-w-[220px]">
                              {item.qty ? `${item.qty}x ` : ""}{item.name}
                            </span>
                            <span className="font-mono text-muted-foreground font-semibold">
                              {item.price ? formatCurrency(item.price) : "-"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Multi-Transaction Statement Breakdown jika gambar mutasi rekening */}
                  {scannedResult.isMultipleTransactions && Array.isArray(scannedResult.transactions) && scannedResult.transactions.length > 1 && (
                    <div className="border rounded-md p-3 bg-card mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider block">
                          Daftar Mutasi Terdeteksi ({scannedResult.transactions.length} mutasi)
                        </span>
                        <Badge variant="outline" className="text-[9px] border-blue-500/30 text-blue-600 rounded-sm">
                          Riwayat M-Banking
                        </Badge>
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {scannedResult.transactions.map((tx: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-none">
                            <div className="flex flex-col min-w-0 pr-2">
                              <span className="font-semibold text-foreground truncate max-w-[220px]">
                                {tx.note || "Transaksi"}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDateTime(tx.happenedAt)} • {tx.accountHint || "Bank"}
                              </span>
                            </div>
                            <span className={`font-mono font-bold shrink-0 ${tx.txType === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                              {tx.txType === "income" ? "+ " : "- "}{formatCurrency(tx.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Catatan yang akan disimpan */}
                  <div className="p-3 rounded-sm border bg-card">
                    <span className="text-[10px] text-muted-foreground block uppercase font-medium">Catatan Otomatis</span>
                    <span className="font-medium text-foreground mt-0.5 block leading-relaxed">
                      {scannedResult.note}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-8 sm:p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <Receipt className="h-8 w-8 text-muted-foreground/40" />
                  <span className="text-xs">
                    {isScanningBill
                      ? "Sedang membaca dokumen finansial..."
                      : "Belum ada gambar yang dipindai. Unggah foto struk belanja, bukti transfer m-banking, atau mutasi rekening di sebelah kiri untuk melihat hasil ekstraksi AI."}
                  </span>
                </div>
              )}
            </div>

            {scannedResult && (
              <div className="pt-4 border-t mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Periksa kembali data sebelum menyimpan.
                </span>
                <Button
                  onClick={handleSaveScannedTransaction}
                  disabled={isSavingTx}
                  className="bg-[#059669] hover:bg-[#047857] text-white font-semibold h-8 sm:h-9 px-4 rounded-md text-xs gap-1.5 shadow-level-1"
                >
                  {isSavingTx ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Menyimpan Transaksi...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Simpan ke Transaksi
                    </>
                  )}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: FINANCIAL CHAT ADVISOR */}
      {/* ==================================================================== */}
      {activeTab === "chat" && (
        <Card className="p-4 sm:p-5 rounded-md shadow-sm border-border/70 flex flex-col h-[560px] sm:h-[600px] justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b mb-3">
              <div className="flex items-center gap-2">
                <GeometricIcon name="ai" className="h-4 w-4" />
                <h3 className="font-extrabold text-sm text-foreground">Fin.IQ Financial Advisor (Tanya AI)</h3>
              </div>
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 rounded-sm">
                Data Fin.IQ Riil Aktif
              </Badge>
            </div>

            {/* Quick Prompt Suggestion Pills */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="text-[10px] font-semibold text-muted-foreground mr-1">Pertanyaan Cepat:</span>
              {[
                "Berapa total pengeluaran saya bulan ini?",
                "Kategori mana yang paling boros?",
                "Beri saran tips hemat untuk bulan depan",
                "Bagaimana kondisi arus kas dan saldo akun saya?",
              ].map((suggestion, sIdx) => (
                <button
                  key={sIdx}
                  onClick={() => handleSendChat(suggestion)}
                  disabled={askAssistantMutation.isPending}
                  className="px-2.5 py-1 rounded-sm text-[11px] font-medium border border-border/70 bg-muted/30 hover:bg-muted/70 text-foreground transition-all hover:border-[#059669]/40"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Messages Feed */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 py-2">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 rounded-sm bg-[#A7F3D0]/40 text-[#064E3B] flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-md p-3 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-[#059669] text-white rounded-tr-none font-medium"
                      : "bg-muted/50 border border-border/60 text-foreground rounded-tl-none shadow-sm"
                  }`}
                >
                  <p>{msg.text}</p>
                  <span
                    className={`text-[9px] mt-1 block ${
                      msg.role === "user" ? "text-white/70 text-right" : "text-muted-foreground"
                    }`}
                  >
                    {msg.time}
                  </span>
                </div>
              </div>
            ))}

            {askAssistantMutation.isPending && (
              <div className="flex gap-2.5 items-center text-xs text-muted-foreground">
                <div className="h-7 w-7 rounded-sm bg-[#A7F3D0]/40 text-[#064E3B] flex items-center justify-center shrink-0 animate-pulse">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="p-2.5 rounded-md bg-muted/40 border border-border/50 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#059669]" />
                  <span>Fin.IQ AI sedang menganalisis data keuangan Anda...</span>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChat();
            }}
            className="pt-3 border-t flex items-center gap-2 mt-2"
          >
            <Input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Tanyakan analisis keuangan, tips budgeting, atau rincian transaksi..."
              className="h-9 sm:h-10 text-xs rounded-md"
              disabled={askAssistantMutation.isPending}
            />
            <Button
              type="submit"
              disabled={askAssistantMutation.isPending || !chatInput.trim()}
              className="bg-[#059669] hover:bg-[#047857] text-white font-semibold h-9 sm:h-10 px-4 rounded-md text-xs gap-1.5 shrink-0 shadow-level-1"
            >
              <Send className="h-3.5 w-3.5" />
              Kirim
            </Button>
          </form>
        </Card>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: SMART NLP TEXT PARSER */}
      {/* ==================================================================== */}
      {activeTab === "nlp" && (
        <Card className="p-4 sm:p-5 rounded-md shadow-sm border-border/70 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b mb-4 gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#059669]" />
                <h3 className="font-extrabold text-sm text-foreground">
                  Smart Indonesian Transaction Parser
                </h3>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-md text-[11px] border border-border/50">
                <button
                  type="button"
                  onClick={() => setNlpEngine("local")}
                  className={`px-2.5 py-1 rounded-sm font-bold transition-all ${
                    nlpEngine === "local"
                      ? "bg-[#059669] text-white shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  NLP Lokal (Instan)
                </button>
                <button
                  type="button"
                  onClick={() => setNlpEngine("gemini")}
                  className={`px-2.5 py-1 rounded-sm font-bold transition-all ${
                    nlpEngine === "gemini"
                      ? "bg-[#059669] text-white shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Gemini AI
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Ketik kalimat transaksi apa saja dalam bahasa Indonesia santai atau formal. AI akan memecah menjadi nominal, akun, kategori, dan waktu transaksi secara akurat.
            </p>

            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={nlpText}
                  onChange={(e) => setNlpText(e.target.value)}
                  placeholder="Contoh: Makan siang nasi padang 35rb bayar pakai BCA kemarin jam 12"
                  className="h-9 sm:h-10 text-xs rounded-md flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleParseNlp();
                    }
                  }}
                />
                <Button
                  onClick={() => handleParseNlp()}
                  disabled={
                    (nlpEngine === "local" ? parseTextLocalMutation.isPending : parseTextGeminiMutation.isPending) ||
                    !nlpText.trim()
                  }
                  className="bg-[#059669] hover:bg-[#047857] text-white font-semibold h-9 sm:h-10 px-4 rounded-md text-xs gap-1.5 shrink-0 shadow-level-1"
                >
                  {(nlpEngine === "local" ? parseTextLocalMutation.isPending : parseTextGeminiMutation.isPending) ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Ekstrak Kalimat
                </Button>
              </div>

              {/* Contoh kalimat instan */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
                <span>Coba klik:</span>
                {[
                  "Kopi kenangan 28rb bayar pakai qris gopay",
                  "Gajian bulanan 12 juta masuk ke BCA tadi pagi",
                  "Beli token listrik 100 ribu di indomaret",
                ].map((eg, egIdx) => (
                  <button
                    key={egIdx}
                    type="button"
                    onClick={() => {
                      setNlpText(eg);
                      handleParseNlp("local");
                    }}
                    className="underline hover:text-foreground"
                  >
                    &quot;{eg}&quot;
                  </button>
                ))}
              </div>
            </div>

            {/* Hasil Ekstraksi NLP */}
            {nlpResult && (
              <div className="mt-5 p-3.5 sm:p-4 rounded-md bg-muted/40 border border-border/60 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">Hasil Ekstraksi Transaksi</span>
                    <Badge variant="outline" className="text-[10px] font-mono text-[#059669] border-[#059669]/30 rounded-sm">
                      {nlpResult.usedGemini ? "Gemini AI" : "NLP Lokal (Instan)"}
                    </Badge>
                  </div>
                  <Badge variant={nlpResult.txType as any} className="text-[10px] uppercase rounded-sm">
                    {nlpResult.txType}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Nominal</span>
                    <span className="text-base font-black text-foreground block mt-0.5">
                      {formatCurrency(nlpResult.amount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Kategori</span>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="font-bold text-foreground">
                        {nlpResult.categoryHint || "Umum"}
                      </span>
                      {nlpResult.recommendedCategory?.isNew && (
                        <button
                          type="button"
                          onClick={() =>
                            handleCreateRecommendedCategory(
                              nlpResult.recommendedCategory.name,
                              nlpResult.recommendedCategory.kind
                            )
                          }
                          className="px-2 py-0.5 rounded-sm text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="h-2.5 w-2.5" />
                          Buat Kategori
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Akun Sumber</span>
                    <span className="font-bold text-foreground block mt-0.5">
                      {nlpResult.accountHint || "Kas Tunai"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Waktu</span>
                    <span className="font-bold text-foreground block mt-0.5">
                      {formatDateTime(nlpResult.happenedAt)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground truncate">
                    Catatan: <strong className="text-foreground">{nlpResult.note}</strong>
                  </span>
                  <Button
                    onClick={handleSaveNlpTransaction}
                    disabled={isSavingTx}
                    className="bg-[#059669] hover:bg-[#047857] text-white font-semibold h-8 px-3 rounded-md text-xs gap-1.5 shadow-level-1"
                  >
                    {isSavingTx ? "Menyimpan..." : "Simpan Transaksi"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t mt-4 text-[11px] text-muted-foreground">
            Ekstraksi kalimat otomatis mencocokkan nama akun dan kategori yang ada di akun Anda.
          </div>
        </Card>
      )}
    </div>
  );
}

export default function AIPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#059669]" />
          <p className="text-sm text-muted-foreground animate-pulse">Memuat Fin.IQ AI Studio...</p>
        </div>
      }
    >
      <AIPageContent />
    </Suspense>
  );
}

