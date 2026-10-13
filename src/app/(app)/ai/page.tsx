"use client";

import React, { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { compressImageToBase64 } from "@/lib/image-compressor";
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
  Bot,
  Send,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  Wallet,
  Clock,
  Sparkle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function AIPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const utils = trpc.useUtils();
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
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      alert("Gagal menyimpan transaksi: " + err.message);
    },
  });

  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Harap pilih file gambar (JPG, PNG, atau WEBP).");
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
      alert("Tidak ditemukan akun transaksi. Silakan buat akun terlebih dahulu.");
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

  const parseTextGeminiMutation = trpc.ai.parseTextWithGemini.useMutation({
    onSuccess: (data) => {
      setNlpResult(data);
    },
    onError: (err) => {
      alert("Gagal memproses kalimat: " + err.message);
    },
  });

  const handleParseNlp = () => {
    if (!nlpText.trim()) return;
    parseTextGeminiMutation.mutate({
      text: nlpText.trim(),
      clientTime: new Date().toISOString(),
    });
  };

  const handleSaveNlpTransaction = () => {
    if (!nlpResult) return;
    const defaultLedgerId = ledgersList?.[0]?.id || "default";
    const accId = nlpResult.matchedAccountId || accountsData?.accounts?.[0]?.id;

    if (!accId) {
      alert("Harap pilih akun transaksi.");
      return;
    }

    setIsSavingTx(true);
    createTxMutation.mutate({
      ledgerId: defaultLedgerId,
      txType: nlpResult.txType || "expense",
      amount: nlpResult.amount,
      accountId: accId,
      categoryId: nlpResult.matchedCategoryId || undefined,
      happenedAt: nlpResult.happenedAt || new Date().toISOString(),
      note: nlpResult.note || nlpText,
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#00B569]/10 text-[#00B569]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                Fin.IQ AI Studio
                <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                  gemini-3.8-flash
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Kecerdasan buatan Google Gemini: Scan Struk Kasir (OCR), Smart NLP Parser, dan Financial Advisor.
              </p>
            </div>
          </div>
        </div>

        {/* Token Status Badge / Link */}
        <div className="flex items-center gap-2">
          {geminiStatus?.connected ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Token Gemini Terhubung</span>
              {geminiStatus.maskedKey && (
                <span className="font-mono text-[10px] opacity-75">({geminiStatus.maskedKey})</span>
              )}
            </div>
          ) : (
            <Link href="/settings">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10">
                <AlertCircle className="h-3.5 w-3.5" />
                Sambungkan Token di Profil
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Warning jika token belum terhubung */}
      {!geminiStatus?.connected && !isStatusLoading && (
        <Card className="p-4 rounded-2xl border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-3">
            <KeyRound className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-foreground">Token Google Gemini Belum Tersambung</h4>
              <p className="text-muted-foreground mt-0.5">
                Untuk menggunakan OCR Bill Scanner dan Financial Advisor, sambungkan Google Gemini API Key Anda di halaman Pengaturan &amp; Profil.
              </p>
            </div>
          </div>
          <Link href="/settings" className="shrink-0">
            <Button size="sm" className="bg-[#00B569] hover:bg-[#009E5B] text-white text-xs rounded-xl font-bold gap-1.5">
              Sambungkan Sekarang
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </Card>
      )}

      {/* Feature Navigation Tabs */}
      <div className="flex items-center rounded-xl bg-muted p-1 text-xs font-semibold self-start gap-1">
        <button
          onClick={() => setActiveTab("ocr")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${
            activeTab === "ocr"
              ? "bg-card text-foreground shadow-sm font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Camera className="h-3.5 w-3.5 text-primary" />
          <span>Scan Struk Kasir (OCR)</span>
        </button>

        <button
          onClick={() => setActiveTab("chat")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${
            activeTab === "chat"
              ? "bg-card text-foreground shadow-sm font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquareText className="h-3.5 w-3.5 text-primary" />
          <span>Financial Advisor (Tanya AI)</span>
        </button>

        <button
          onClick={() => setActiveTab("nlp")}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${
            activeTab === "nlp"
              ? "bg-card text-foreground shadow-sm font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-3.5 w-3.5 text-primary" />
          <span>Smart Text Parser</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: OCR BILL SCANNER */}
      {/* ==================================================================== */}
      {activeTab === "ocr" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Upload Area (Left) */}
          <Card className="lg:col-span-5 p-6 rounded-2xl shadow-sm border-border/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b mb-4">
                <Receipt className="h-4 w-4 text-[#00B569]" />
                <h3 className="font-extrabold text-sm text-foreground">Unggah Foto Struk / Bill</h3>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleReceiptFileChange}
              />

              {/* Drop / Click Box */}
              <div
                onClick={() => {
                  if (!isScanningBill) fileInputRef.current?.click();
                }}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 min-h-[200px] ${
                  isScanningBill
                    ? "border-primary/50 bg-primary/5 cursor-not-allowed"
                    : "border-border hover:border-primary/50 hover:bg-muted/40"
                }`}
              >
                {receiptPreviewUrl ? (
                  <div className="relative w-full max-h-56 overflow-hidden rounded-xl border">
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
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                      <UploadCloud className="h-6 w-6" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-foreground block">
                        Pilih Gambar atau Jepret Foto Struk
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
                <div className="mt-4 flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/10 text-xs text-primary animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>Gemini AI sedang memindai dan mengekstrak rincian struk...</span>
                </div>
              )}

              {billError && (
                <div className="mt-4 flex items-center gap-2 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{billError}</span>
                </div>
              )}

              {saveSuccessMsg && (
                <div className="mt-4 flex items-center gap-2 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400">
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
          <Card className="lg:col-span-7 p-6 rounded-2xl shadow-sm border-border/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#00B569]" />
                  <h3 className="font-extrabold text-sm text-foreground">Hasil Analisis OCR Gemini</h3>
                </div>
                {scannedResult && (
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-none font-semibold text-[10px]">
                    Berhasil Diekstrak
                  </Badge>
                )}
              </div>

              {scannedResult ? (
                <div className="space-y-4 text-xs">
                  {/* Highlight Nominal & Toko */}
                  <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-muted-foreground block">Grand Total Belanja</span>
                      <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                        {formatCurrency(scannedResult.amount)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-muted-foreground block">Merchant / Toko</span>
                      <span className="text-sm font-bold text-foreground">
                        {scannedResult.merchantName || scannedResult.note || "Toko Kasir"}
                      </span>
                    </div>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-xl border bg-card">
                      <span className="text-[10px] text-muted-foreground block uppercase font-medium">Waktu Transaksi</span>
                      <span className="font-semibold text-foreground mt-0.5 block">
                        {formatDateTime(scannedResult.happenedAt)}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl border bg-card">
                      <span className="text-[10px] text-muted-foreground block uppercase font-medium">Saran Kategori</span>
                      <span className="font-semibold text-foreground mt-0.5 block">
                        {scannedResult.categoryHint || "Umum"}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl border bg-card col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-muted-foreground block uppercase font-medium">Metode Pembayaran</span>
                      <span className="font-semibold text-foreground mt-0.5 block">
                        {scannedResult.accountHint || "Kas Tunai"}
                      </span>
                    </div>
                  </div>

                  {/* Line Items Breakdown jika ada */}
                  {Array.isArray(scannedResult.items) && scannedResult.items.length > 0 && (
                    <div className="border rounded-xl p-3 bg-card mt-3">
                      <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider block mb-2">
                        Rincian Item Belanja ({scannedResult.items.length} item)
                      </span>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {scannedResult.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-none">
                            <span className="font-medium text-foreground truncate max-w-[200px]">
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

                  {/* Catatan yang akan disimpan */}
                  <div className="p-3 rounded-xl border bg-card">
                    <span className="text-[10px] text-muted-foreground block uppercase font-medium">Catatan Mutasi</span>
                    <span className="font-medium text-foreground mt-0.5 block">
                      {scannedResult.note}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <Receipt className="h-8 w-8 text-muted-foreground/40" />
                  <span className="text-xs">
                    {isScanningBill
                      ? "Sedang membaca struk..."
                      : "Belum ada struk yang dipindai. Unggah gambar struk belanja di sebelah kiri untuk melihat hasil OCR."}
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
                  className="bg-[#00B569] hover:bg-[#009E5B] text-white font-bold h-9 px-4 rounded-xl text-xs gap-1.5"
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
        <Card className="p-6 rounded-2xl shadow-sm border-border/70 flex flex-col h-[600px] justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b mb-3">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-[#00B569]" />
                <h3 className="font-extrabold text-sm text-foreground">Fin.IQ Financial Advisor (Tanya AI)</h3>
              </div>
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">
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
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-border/70 bg-muted/30 hover:bg-muted/70 text-foreground transition-all hover:border-primary/40"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Messages Feed */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 py-2">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-primary text-white rounded-tr-none font-medium"
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
                <div className="h-7 w-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 animate-pulse">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="p-2.5 rounded-2xl bg-muted/40 border border-border/50 flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
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
              className="h-10 text-xs rounded-xl"
              disabled={askAssistantMutation.isPending}
            />
            <Button
              type="submit"
              disabled={askAssistantMutation.isPending || !chatInput.trim()}
              className="bg-[#00B569] hover:bg-[#009E5B] text-white font-bold h-10 px-4 rounded-xl text-xs gap-1.5 shrink-0"
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
        <Card className="p-6 rounded-2xl shadow-sm border-border/70 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b mb-4">
              <FileText className="h-4 w-4 text-[#00B569]" />
              <h3 className="font-extrabold text-sm text-foreground">
                Smart Indonesian Transaction Parser
              </h3>
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
                  className="h-10 text-xs rounded-xl flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleParseNlp();
                    }
                  }}
                />
                <Button
                  onClick={handleParseNlp}
                  disabled={parseTextGeminiMutation.isPending || !nlpText.trim()}
                  className="bg-[#00B569] hover:bg-[#009E5B] text-white font-bold h-10 px-4 rounded-xl text-xs gap-1.5 shrink-0"
                >
                  {parseTextGeminiMutation.isPending ? (
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
                    onClick={() => setNlpText(eg)}
                    className="underline hover:text-foreground"
                  >
                    &quot;{eg}&quot;
                  </button>
                ))}
              </div>
            </div>

            {/* Hasil Ekstraksi NLP */}
            {nlpResult && (
              <div className="mt-6 p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-bold text-foreground">Hasil Ekstraksi Transaksi</span>
                  <Badge variant={nlpResult.txType as any} className="text-[10px] uppercase">
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
                    <span className="font-bold text-foreground block mt-0.5">
                      {nlpResult.categoryHint || "Umum"}
                    </span>
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
                    className="bg-[#00B569] hover:bg-[#009E5B] text-white font-bold h-8 px-3 rounded-xl text-xs gap-1.5"
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
