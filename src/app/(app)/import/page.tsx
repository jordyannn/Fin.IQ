"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { detectCategory } from "@/lib/nlp-parser";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  RotateCcw,
  SlidersHorizontal,
  Download,
  Receipt,
  Layers,
  Sparkles,
  X,
  ExternalLink,
  Camera,
  ImagePlus,
  Trash2,
  Plus,
  Loader2,
  Filter,
  Check,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface FieldMapping {
  tx_type: string | null;
  amount: string | null;
  happened_at: string | null;
  category_name: string | null;
  subcategory_name: string | null;
  account_name: string | null;
  from_account_name: string | null;
  to_account_name: string | null;
  note: string | null;
  tags: string | null;
  currency: string | null;
}

// Regex patterns strictly inspired by BeeCount-Cloud generic parser
// Extended with Indonesian terms (tanggal, nominal, keterangan, akun, dll.)
const PATTERNS: Record<keyof FieldMapping, RegExp> = {
  tx_type: /^(type|jenis|tipe|kind|kategori\s*transaksi|tx_type|收[\/／]?支|类型)$/i,
  amount: /(amount|nominal|jumlah|harga|total|debit|kredit|amt|sum|nilai|金额)/i,
  happened_at: /(tanggal|waktu|date|time|happened|timestamp|created_at|when|时间|日期)/i,
  category_name: /^(category|kategori|pos|klasifikasi|cat|main_cat|类别|分类)$/i,
  subcategory_name: /(subcategory|subkategori|sub-kategori|sub_cat|子分类)/i,
  account_name: /^(account|akun|rekening|dompet|wallet|bank|metode|pembayaran|账户|支付方式)$/i,
  from_account_name: /(from_account|dari\s*akun|asal|sumber|转出)/i,
  to_account_name: /(to_account|ke\s*akun|tujuan|dest|转入)/i,
  note: /(note|catatan|keterangan|deskripsi|description|memo|remarks|rincian|商品|备注)/i,
  tags: /(tag|tags|label|tanda|标签)/i,
  currency: /^(currency|mata\s*uang|valuta|curr|币种)$/i,
};

function matchColumn(headers: string[], pattern: RegExp, taken: Set<string>): string | null {
  for (const h of headers) {
    if (taken.has(h)) continue;
    if (pattern.test((h || "").trim())) {
      taken.add(h);
      return h;
    }
  }
  return null;
}

function autoSuggestMapping(headers: string[]): FieldMapping {
  const taken = new Set<string>();
  const mapping: FieldMapping = {
    tx_type: null,
    amount: null,
    happened_at: null,
    category_name: null,
    subcategory_name: null,
    account_name: null,
    from_account_name: null,
    to_account_name: null,
    note: null,
    tags: null,
    currency: null,
  };

  const priorityOrder: (keyof FieldMapping)[] = [
    "tx_type",
    "amount",
    "happened_at",
    "category_name",
    "subcategory_name",
    "account_name",
    "from_account_name",
    "to_account_name",
    "note",
    "tags",
    "currency",
  ];

  for (const key of priorityOrder) {
    mapping[key] = matchColumn(headers, PATTERNS[key], taken);
  }

  return mapping;
}

function parseDateString(raw: string): string {
  if (!raw) return new Date().toISOString();
  const trimmed = raw.trim();

  // Try direct Date parse
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d.toISOString();

  // Indonesian / European DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(
    /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 12;
    const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const seconds = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const parsed = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return new Date().toISOString();
}

function cleanAmount(raw: any): number {
  if (typeof raw === "number") return Math.abs(raw);
  if (!raw) return 0;
  const s = String(raw).trim();
  const cleaned = s.replace(/[^0-9.,-]/g, "");

  if (cleaned.includes(".") && cleaned.includes(",")) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      const norm = cleaned.replace(/\./g, "").replace(",", ".");
      return Math.abs(parseFloat(norm)) || 0;
    } else {
      const norm = cleaned.replace(/,/g, "");
      return Math.abs(parseFloat(norm)) || 0;
    }
  }

  if (cleaned.includes(",")) {
    if ((cleaned.match(/,/g) || []).length > 1) {
      return Math.abs(parseFloat(cleaned.replace(/,/g, ""))) || 0;
    }
    const parts = cleaned.split(",");
    if (parts[1].length === 3) {
      return Math.abs(parseFloat(cleaned.replace(",", ""))) || 0;
    }
    return Math.abs(parseFloat(cleaned.replace(",", "."))) || 0;
  }

  if (cleaned.includes(".")) {
    if ((cleaned.match(/\./g) || []).length > 1) {
      return Math.abs(parseFloat(cleaned.replace(/\./g, ""))) || 0;
    }
    const parts = cleaned.split(".");
    if (parts[1].length === 3) {
      return Math.abs(parseFloat(cleaned.replace(".", ""))) || 0;
    }
  }

  return Math.abs(parseFloat(cleaned)) || 0;
}

function normalizeTxType(raw: string): "expense" | "income" | "transfer" {
  const s = (raw || "").trim().toLowerCase();
  if (
    s.includes("in") ||
    s.includes("masuk") ||
    s.includes("pendapatan") ||
    s.includes("gaji") ||
    s.includes("收入")
  ) {
    return "income";
  }
  if (
    s.includes("transfer") ||
    s.includes("pindah") ||
    s.includes("kirim") ||
    s.includes("转账")
  ) {
    return "transfer";
  }
  return "expense";
}

interface ParsedFileTxItem {
  id: string;
  rowNumber: number;
  happenedAt: string;
  txType: "expense" | "income" | "transfer";
  amount: number;
  categoryName: string;
  isNlpDetected?: boolean;
  accountName: string;
  toAccountName?: string | null;
  note: string;
  tags: string[];
}

const STANDARD_CATEGORIES = [
  "Makanan & Minuman",
  "Kopi & Minuman",
  "Restoran & Kuliner",
  "Transportasi",
  "Bahan Bakar & SPBU",
  "Belanja",
  "Supermarket & Minimarket",
  "Tagihan & Utilitas",
  "Pulsa & Paket Data",
  "Kebutuhan Rumah",
  "Kesehatan & Medis",
  "Hiburan & Rekreasi",
  "Pendidikan & Karir",
  "Gaji & Pendapatan",
  "Bonus & THR",
  "Hasil Bisnis & Dagang",
  "Pekerjaan Sampingan / Freelance",
  "Hadiah & Rezeki",
  "Investasi & Dividen",
  "Transfer Saldo",
  "Umum",
];

function generateParsedItems(
  rows: string[][],
  mapping: FieldMapping,
  headers: string[],
  categoriesList: Array<{ id: string; name: string; kind?: string; parentId?: string | null }>,
  nlpEnabled: boolean,
  fallbackCatName?: string,
  existingItems?: ParsedFileTxItem[],
  manualEditedRowIds?: Set<string>
): ParsedFileTxItem[] {
  const getCol = (row: string[], key: keyof FieldMapping) => {
    const colName = mapping[key];
    if (!colName) return "";
    const colIdx = headers.indexOf(colName);
    return colIdx !== -1 ? (row[colIdx] || "").trim() : "";
  };

  const existingMap = new Map<string, ParsedFileTxItem>();
  if (existingItems) {
    for (const item of existingItems) {
      existingMap.set(item.id, item);
    }
  }

  const items: ParsedFileTxItem[] = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowId = `file-tx-${idx + 1}`;
    const rowNumber = idx + 2;

    const rawType = getCol(row, "tx_type");
    const txType = normalizeTxType(rawType);
    const amount = cleanAmount(getCol(row, "amount"));
    const rawDate = getCol(row, "happened_at");
    const isoDate = parseDateString(rawDate);
    const rawCat = getCol(row, "category_name");
    const subCat = getCol(row, "subcategory_name");
    const rawFullCat = subCat ? `${rawCat} / ${subCat}` : rawCat;
    const accName = getCol(row, "account_name") || getCol(row, "from_account_name") || "cash";
    const toAccName = getCol(row, "to_account_name") || null;
    const note = getCol(row, "note");
    const tagsRaw = getCol(row, "tags");
    const tagList = tagsRaw
      ? tagsRaw.split(/[,;]/).map((t) => t.trim()).filter(Boolean)
      : [];

    // Check if previously manually edited by user
    if (manualEditedRowIds && manualEditedRowIds.has(rowId) && existingMap.has(rowId)) {
      const prev = existingMap.get(rowId)!;
      items.push({
        ...prev,
        rowNumber,
        happenedAt: isoDate,
        txType,
        amount,
        accountName: accName,
        toAccountName: toAccName,
        note: note || "-",
        tags: tagList,
      });
      continue;
    }

    let categoryName = rawFullCat ? rawFullCat.trim() : "";
    let isNlpDetected = false;

    const isGenericOrMissing =
      !rawCat ||
      /^(umum|lain-lain|lainnya|uncategorized|-|transaksi|mutasi|expense|income|pengeluaran|pemasukan)$/i.test(
        rawCat.trim()
      );

    if (nlpEnabled && txType !== "transfer") {
      const textToAnalyze = [note, rawCat].filter(Boolean).join(" ").trim();
      if (textToAnalyze && (isGenericOrMissing || !rawCat)) {
        const detected = detectCategory(textToAnalyze, txType, categoriesList);
        if (detected.matchedCategoryId) {
          const matched = categoriesList.find((c) => c.id === detected.matchedCategoryId);
          if (matched) {
            categoryName = matched.name;
            isNlpDetected = true;
          }
        } else if (detected.categoryHint) {
          categoryName = detected.categoryHint;
          isNlpDetected = true;
        }
      }
    }

    if (!categoryName) {
      if (fallbackCatName) {
        categoryName = fallbackCatName;
      } else {
        categoryName = txType === "income" ? "Gaji & Pendapatan" : "Umum";
      }
    }

    items.push({
      id: rowId,
      rowNumber,
      happenedAt: isoDate,
      txType,
      amount,
      categoryName,
      isNlpDetected,
      accountName: accName,
      toAccountName: toAccName,
      note: note || "-",
      tags: tagList,
    });
  }

  return items;
}

interface ScreenshotTxItem {
  id: string;
  txType: "expense" | "income" | "transfer";
  amount: number;
  happenedAt: string;
  categoryName: string;
  accountName: string;
  toAccountName?: string | null;
  note: string;
  sourceImageIndex?: number;
}

function toDatetimeLocalString(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

async function compressImageToBase64(
  file: File,
  maxWidth = 1600,
  quality = 0.85
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          const rawBase64 = (readerEvent.target?.result as string) || "";
          const clean = rawBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
          resolve({ base64: clean, mimeType: file.type || "image/jpeg" });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64 = dataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
        resolve({ base64, mimeType: "image/jpeg" });
      };
      img.onerror = () => reject(new Error("Gagal memuat file gambar untuk optimasi."));
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
    reader.readAsDataURL(file);
  });
}

export default function ImportPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<"file" | "screenshot">("file");

  // Screenshot states
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);
  const [screenshotPreviews, setScreenshotPreviews] = useState<string[]>([]);
  const [screenshotTxs, setScreenshotTxs] = useState<ScreenshotTxItem[]>([]);
  const [isParsingScreenshot, setIsParsingScreenshot] = useState(false);
  const [screenshotParseProgress, setScreenshotParseProgress] = useState("");
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  // File states
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [fileType, setFileType] = useState<"csv" | "excel">("csv");
  const [rawRows2D, setRawRows2D] = useState<string[][]>([]);

  // NLP & Category Selection states for File Tab
  const [fileTxs, setFileTxs] = useState<ParsedFileTxItem[]>([]);
  const fileTxsRef = useRef<ParsedFileTxItem[]>([]);
  fileTxsRef.current = fileTxs;
  const [enableNlpCategory, setEnableNlpCategory] = useState(true);
  const [previewLimit, setPreviewLimit] = useState<number>(25);
  const [bulkCategory, setBulkCategory] = useState<string>("");
  const [fallbackCategoryId, setFallbackCategoryId] = useState<string>("");
  const manualEditedRowIdsRef = useRef<Set<string>>(new Set());

  // Mapping states
  const [headers, setHeaders] = useState<string[]>([]);
  const [suggestedMapping, setSuggestedMapping] = useState<FieldMapping | null>(null);
  const [currentMapping, setCurrentMapping] = useState<FieldMapping | null>(null);
  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [mappingDraft, setMappingDraft] = useState<FieldMapping | null>(null);

  // Execution options
  const [targetLedgerId, setTargetLedgerId] = useState("");
  const [defaultAccountId, setDefaultAccountId] = useState("");
  const [dedupStrategy, setDedupStrategy] = useState<"skip_duplicates" | "insert_all">(
    "skip_duplicates"
  );
  const [autoTag, setAutoTag] = useState("");

  // Success state
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);

  // Queries
  const { data: ledgersData } = trpc.ledgers.list.useQuery();
  const { data: accountsData } = trpc.accounts.list.useQuery();
  const { data: categoriesData } = trpc.categories.list.useQuery();

  // Mutations
  const parseScreenshotMutation = trpc.import.parseScreenshot.useMutation();

  const executeBatchMutation = trpc.import.executeBatch.useMutation({
    onSuccess: (data) => {
      utils.transactions.invalidate();
      utils.accounts.invalidate();
      utils.analytics.invalidate();
      utils.categories.invalidate();
      setImportResult(data);
      setIsProcessing(false);
      setIsSuccessOpen(true);
    },
    onError: (err) => {
      setIsProcessing(false);
      alert(`Gagal mengeksekusi impor: ${err.message}`);
    },
  });

  // Screenshot handlers
  const handleScreenshotSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files).filter((f) =>
      /\.(png|jpe?g|webp|bmp|gif)$/i.test(f.name)
    );
    if (newFiles.length === 0) {
      alert("Format file tidak didukung. Silakan pilih gambar PNG, JPG, JPEG, atau WEBP.");
      return;
    }

    const combined = [...screenshotFiles, ...newFiles].slice(0, 10);
    setScreenshotFiles(combined);

    const previews: string[] = [];
    combined.forEach((file) => {
      previews.push(URL.createObjectURL(file));
    });
    setScreenshotPreviews(previews);
    setScreenshotError(null);
  };

  const handleRemoveScreenshot = (index: number) => {
    const updatedFiles = screenshotFiles.filter((_, i) => i !== index);
    setScreenshotFiles(updatedFiles);
    const updatedPreviews = screenshotPreviews.filter((_, i) => i !== index);
    setScreenshotPreviews(updatedPreviews);
  };

  const handleProcessScreenshots = async () => {
    if (screenshotFiles.length === 0) return;

    setIsParsingScreenshot(true);
    setScreenshotParseProgress(`Menyiapkan ${screenshotFiles.length} gambar...`);
    setScreenshotError(null);

    try {
      const preparedImages: Array<{ base64: string; mimeType: string }> = [];
      for (let i = 0; i < screenshotFiles.length; i++) {
        setScreenshotParseProgress(
          `Mengoptimalkan gambar ${i + 1} dari ${screenshotFiles.length}...`
        );
        const compressed = await compressImageToBase64(screenshotFiles[i]);
        preparedImages.push(compressed);
      }

      setScreenshotParseProgress("Gemini AI Vision sedang menganalisis transaksi di gambar...");

      const result = await parseScreenshotMutation.mutateAsync({
        images: preparedImages,
      });

      if (!result.transactions || result.transactions.length === 0) {
        setScreenshotError(
          "Tidak ditemukan transaksi yang jelas di gambar tersebut. Pastikan teks mutasi rekening atau struk terlihat tajam dan terbaca."
        );
        setIsParsingScreenshot(false);
        return;
      }

      const items: ScreenshotTxItem[] = result.transactions.map((tx, idx) => ({
        id: `sc-tx-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        txType: tx.txType,
        amount: tx.amount,
        happenedAt: tx.happenedAt,
        categoryName: tx.categoryName,
        accountName: tx.accountName,
        toAccountName: tx.toAccountName,
        note: tx.note,
        sourceImageIndex: tx.sourceImageIndex,
      }));

      setScreenshotTxs(items);
    } catch (err: any) {
      console.error("Error OCR Screenshot:", err);
      setScreenshotError(err.message || "Gagal memproses screenshot.");
    } finally {
      setIsParsingScreenshot(false);
      setScreenshotParseProgress("");
    }
  };

  const handleDeleteScreenshotTx = (id: string) => {
    setScreenshotTxs((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateScreenshotTx = (id: string, updates: Partial<ScreenshotTxItem>) => {
    setScreenshotTxs((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const handleAddManualScreenshotTx = () => {
    const defaultAcc = accountsData?.accounts?.[0]?.name || "Kas Tunai";
    const defaultCat = categoriesData?.[0]?.name || "Umum";
    const newTx: ScreenshotTxItem = {
      id: `manual-tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      txType: "expense",
      amount: 10000,
      happenedAt: new Date().toISOString(),
      categoryName: defaultCat,
      accountName: defaultAcc,
      toAccountName: null,
      note: "Catatan transaksi",
    };
    setScreenshotTxs((prev) => [newTx, ...prev]);
  };

  const handleResetScreenshot = () => {
    setScreenshotFiles([]);
    setScreenshotPreviews([]);
    setScreenshotTxs([]);
    setScreenshotError(null);
  };

  const handleExecuteScreenshotImport = async () => {
    if (screenshotTxs.length === 0) return;

    const validItems = screenshotTxs.filter((t) => t.amount > 0);
    if (validItems.length === 0) {
      alert("Semua transaksi memiliki nominal 0. Harap periksa nominal transaksi.");
      return;
    }

    setIsProcessing(true);
    setImportProgress({ done: 0, total: validItems.length });

    const chunkSize = 100;
    let totalCreated = 0;
    let totalSkipped = 0;
    const allAccountsCreated: string[] = [];
    const allCategoriesCreated: string[] = [];

    const payloadItems = validItems.map((item) => ({
      txType: item.txType,
      amount: item.amount,
      happenedAt: item.happenedAt,
      categoryName: item.categoryName || "Umum",
      accountName: item.accountName || (defaultAccountId ? "cash" : item.accountName),
      toAccountName: item.toAccountName || null,
      note: item.note || undefined,
      tags: ["ocr-screenshot"],
    }));

    try {
      for (let i = 0; i < payloadItems.length; i += chunkSize) {
        const slice = payloadItems.slice(i, i + chunkSize);
        setImportProgress({
          done: i,
          total: payloadItems.length,
        });

        const res = await utils.client.import.executeBatch.mutate({
          items: slice,
          targetLedgerId: targetLedgerId || undefined,
          defaultAccountId: defaultAccountId || undefined,
          dedupStrategy,
          autoTag: autoTag.trim() || undefined,
        });

        totalCreated += res.createdCount;
        totalSkipped += res.skippedCount;
        if (res.accountsCreated) allAccountsCreated.push(...res.accountsCreated);
        if (res.categoriesCreated) allCategoriesCreated.push(...res.categoriesCreated);
      }

      utils.transactions.invalidate();
      utils.accounts.invalidate();
      utils.analytics.invalidate();
      utils.categories.invalidate();

      setImportResult({
        createdCount: totalCreated,
        skippedCount: totalSkipped,
        accountsCreated: Array.from(new Set(allAccountsCreated)),
        categoriesCreated: Array.from(new Set(allCategoriesCreated)),
      });
      setIsSuccessOpen(true);
    } catch (err: any) {
      alert(`Gagal mengeksekusi impor: ${err.message || String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const screenshotStats = useMemo(() => {
    let expenseTotal = 0;
    let incomeTotal = 0;
    let expenseCount = 0;
    let incomeCount = 0;
    let transferCount = 0;

    for (const tx of screenshotTxs) {
      if (tx.txType === "expense") {
        expenseCount++;
        expenseTotal += tx.amount;
      } else if (tx.txType === "income") {
        incomeCount++;
        incomeTotal += tx.amount;
      } else {
        transferCount++;
      }
    }

    return {
      totalCount: screenshotTxs.length,
      expenseCount,
      expenseTotal,
      incomeCount,
      incomeTotal,
      transferCount,
    };
  }, [screenshotTxs]);

  // Client-side file processing
  const processFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const isExcel = ext === "xlsx" || ext === "xls";
    const isCsv = ext === "csv" || ext === "tsv";

    if (!isExcel && !isCsv) {
      alert("Hanya format file .csv, .tsv, .xlsx, atau .xls yang didukung.");
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);
    setFileType(isExcel ? "excel" : "csv");

    try {
      let rows: string[][] = [];

      if (isExcel) {
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: "array" });
        if (wb.SheetNames.length === 0) {
          alert("File Excel kosong atau tidak memiliki lembar sheet.");
          return;
        }
        const ws = wb.Sheets[wb.SheetNames[0]];
        const sheetData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
        rows = sheetData.map((row) =>
          row.map((cell) => (cell !== undefined && cell !== null ? String(cell) : ""))
        );
      } else {
        const text = await file.text();
        const cleaned = text.replace(/^\ufeff/, ""); // strip UTF-8 BOM
        const parsed = Papa.parse<string[]>(cleaned, {
          skipEmptyLines: "greedy",
        });
        rows = parsed.data || [];
      }

      if (rows.length < 2) {
        alert("File tidak memiliki cukup data atau hanya berisi 1 baris.");
        return;
      }

      // Find header row: look for row with >= 2 non-empty columns (BeeCount heuristic)
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const nonEmp = rows[i].filter((c) => (c || "").trim().length > 0);
        if (nonEmp.length >= 2) {
          headerRowIndex = i;
          break;
        }
      }

      const detectedHeaders = rows[headerRowIndex].map(
        (h, i) => h?.trim() || `Kolom_${i + 1}`
      );
      const dataRows = rows.slice(headerRowIndex + 1).filter((r) =>
        r.some((c) => (c || "").trim().length > 0)
      );

      const suggested = autoSuggestMapping(detectedHeaders);

      manualEditedRowIdsRef.current.clear();
      setHeaders(detectedHeaders);
      setRawRows2D(dataRows);
      setSuggestedMapping(suggested);
      setCurrentMapping(suggested);
      setMappingDraft(suggested);
    } catch (err: any) {
      alert(`Gagal membaca file: ${err.message || String(err)}`);
      setFileName("");
      setFileTxs([]);
      manualEditedRowIdsRef.current.clear();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // Sync fileTxs when rawRows2D, currentMapping, or categoriesData change
  useEffect(() => {
    if (!currentMapping || rawRows2D.length === 0 || headers.length === 0) {
      setFileTxs([]);
      return;
    }

    const fallbackCat = fallbackCategoryId
      ? categoriesData?.find((c) => c.id === fallbackCategoryId)?.name
      : undefined;

    const generated = generateParsedItems(
      rawRows2D,
      currentMapping,
      headers,
      categoriesData || [],
      enableNlpCategory,
      fallbackCat,
      fileTxsRef.current,
      manualEditedRowIdsRef.current
    );
    setFileTxs(generated);
  }, [rawRows2D, currentMapping, headers, categoriesData, enableNlpCategory, fallbackCategoryId]);

  // Handle single row category change
  const handleUpdateRowCategory = (id: string, newCatName: string) => {
    manualEditedRowIdsRef.current.add(id);
    setFileTxs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, categoryName: newCatName, isNlpDetected: false } : t))
    );
  };

  // Bulk apply category to all rows
  const handleApplyBulkCategory = () => {
    if (!bulkCategory || fileTxs.length === 0) return;
    setFileTxs((prev) =>
      prev.map((t) => {
        manualEditedRowIdsRef.current.add(t.id);
        return { ...t, categoryName: bulkCategory, isNlpDetected: false };
      })
    );
  };

  // Re-run NLP categorization across all rows from description/note
  const handleRerunNlp = () => {
    if (!currentMapping || rawRows2D.length === 0) return;
    manualEditedRowIdsRef.current.clear();
    const fallbackCat = fallbackCategoryId
      ? categoriesData?.find((c) => c.id === fallbackCategoryId)?.name
      : undefined;
    const generated = generateParsedItems(
      rawRows2D,
      currentMapping,
      headers,
      categoriesData || [],
      true, // force NLP
      fallbackCat,
      [],
      new Set()
    );
    setFileTxs(generated);
  };

  // Compute stats client-side from fileTxs
  const stats = useMemo(() => {
    if (fileTxs.length === 0) {
      return null;
    }

    const existingAccountNames = new Set(
      (accountsData?.accounts || []).map((a) => a.name.toLowerCase())
    );
    const existingCategoryNames = new Set(
      (categoriesData || []).map((c) => c.name.toLowerCase())
    );

    const fileAccounts = new Set<string>();
    const fileCategories = new Set<string>();
    const fileTags = new Set<string>();

    let expenseCount = 0;
    let expenseTotal = 0;
    let incomeCount = 0;
    let incomeTotal = 0;
    let transferCount = 0;

    let minDate: string | null = null;
    let maxDate: string | null = null;

    for (const tx of fileTxs) {
      if (tx.accountName) fileAccounts.add(tx.accountName);
      if (tx.toAccountName) fileAccounts.add(tx.toAccountName);
      if (tx.categoryName) fileCategories.add(tx.categoryName);
      tx.tags.forEach((t) => fileTags.add(t));

      if (tx.txType === "expense") {
        expenseCount++;
        expenseTotal += tx.amount;
      } else if (tx.txType === "income") {
        incomeCount++;
        incomeTotal += tx.amount;
      } else {
        transferCount++;
      }

      if (!minDate || tx.happenedAt < minDate) minDate = tx.happenedAt;
      if (!maxDate || tx.happenedAt > maxDate) maxDate = tx.happenedAt;
    }

    const newAccounts: string[] = [];
    const matchedAccounts: string[] = [];
    for (const a of fileAccounts) {
      if (existingAccountNames.has(a.toLowerCase())) {
        matchedAccounts.push(a);
      } else {
        newAccounts.push(a);
      }
    }

    const newCategories: string[] = [];
    const matchedCategories: string[] = [];
    for (const c of fileCategories) {
      if (existingCategoryNames.has(c.toLowerCase())) {
        matchedCategories.push(c);
      } else {
        newCategories.push(c);
      }
    }

    return {
      totalRows: fileTxs.length,
      timeRangeStart: minDate,
      timeRangeEnd: maxDate,
      totalSignedAmount: incomeTotal - expenseTotal,
      byType: {
        expenseCount,
        expenseTotal,
        incomeCount,
        incomeTotal,
        transferCount,
      },
      accounts: {
        newNames: newAccounts,
        matchedNames: matchedAccounts,
      },
      categories: {
        newNames: newCategories,
        matchedNames: matchedCategories,
      },
      tags: {
        newNames: Array.from(fileTags),
      },
    };
  }, [fileTxs, accountsData, categoriesData]);

  // Execute import using fileTxs with chosen / NLP-detected categories
  const handleExecuteImport = async () => {
    if (fileTxs.length === 0) return;

    const validItems = fileTxs.filter((t) => t.amount > 0);
    if (validItems.length === 0) {
      alert("Tidak ada transaksi valid dengan nominal > 0 yang dapat diimpor.");
      return;
    }

    const fallbackCat = fallbackCategoryId
      ? categoriesData?.find((c) => c.id === fallbackCategoryId)?.name
      : undefined;

    const itemsToImport = validItems.map((item) => ({
      txType: item.txType,
      amount: item.amount,
      happenedAt: item.happenedAt,
      categoryName: item.categoryName || fallbackCat || "Umum",
      accountName: item.accountName || (defaultAccountId ? "cash" : item.accountName),
      toAccountName: item.toAccountName || null,
      note: item.note && item.note !== "-" ? item.note : undefined,
      tags: item.tags,
    }));

    setIsProcessing(true);
    setImportProgress({ done: 0, total: itemsToImport.length });

    const chunkSize = 100;
    let totalCreated = 0;
    let totalSkipped = 0;
    const allAccountsCreated: string[] = [];
    const allCategoriesCreated: string[] = [];

    try {
      for (let i = 0; i < itemsToImport.length; i += chunkSize) {
        const slice = itemsToImport.slice(i, i + chunkSize);
        setImportProgress({
          done: i,
          total: itemsToImport.length,
        });

        const res = await utils.client.import.executeBatch.mutate({
          items: slice,
          targetLedgerId: targetLedgerId || undefined,
          defaultAccountId: defaultAccountId || undefined,
          dedupStrategy,
          autoTag: autoTag.trim() || undefined,
        });

        totalCreated += res.createdCount;
        totalSkipped += res.skippedCount;
        if (res.accountsCreated) allAccountsCreated.push(...res.accountsCreated);
        if (res.categoriesCreated) allCategoriesCreated.push(...res.categoriesCreated);
      }

      utils.transactions.invalidate();
      utils.accounts.invalidate();
      utils.analytics.invalidate();
      utils.categories.invalidate();

      setImportResult({
        createdCount: totalCreated,
        skippedCount: totalSkipped,
        accountsCreated: Array.from(new Set(allAccountsCreated)),
        categoriesCreated: Array.from(new Set(allCategoriesCreated)),
      });
      setIsSuccessOpen(true);
    } catch (err: any) {
      alert(`Gagal mengeksekusi impor: ${err.message || String(err)}`);
    } finally {
      setIsProcessing(false);
      setImportProgress(null);
    }
  };

  // Template download
  const handleDownloadTemplate = () => {
    const csvContent =
      "Tanggal,Jenis,Nominal,Kategori,Akun,Tujuan,Keterangan,Tag\n" +
      "2026-03-01 08:30,expense,25000,Makanan & Minuman,cash,,Sarapan pagi,kuliner;sarapan\n" +
      "2026-03-01 12:45,expense,50000,Transportasi,blu,,Bensin motor,operasional\n" +
      "2026-03-02 09:00,income,5000000,Gaji & Pendapatan,blu,,Gaji Bulanan,gaji\n" +
      "2026-03-02 14:00,transfer,150000,Transfer Saldo,blu,cash,Tarik tunai ATM,atm\n" +
      "2026-03-03 19:15,expense,35000,Tagihan & Pulsa,dana,,Paket data internet,pulsa\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "template-transaksi-finiq.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isMappingComplete =
    currentMapping?.tx_type && currentMapping?.amount && currentMapping?.happened_at;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/transactions">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Impor Transaksi</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeTab === "file"
                ? "Impor mutasi riwayat keuangan langsung dari file CSV atau Excel dengan pemetaan pintar."
                : "Ekstrak transaksi dari screenshot mutasi rekening, e-wallet, atau struk belanja fisik dengan AI Vision."}
            </p>
          </div>
        </div>

        {activeTab === "file" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            className="text-xs gap-1.5 self-start sm:self-auto"
          >
            <Download className="h-3.5 w-3.5" />
            Download Template CSV
          </Button>
        )}
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex gap-1.5 p-1.5 bg-muted/50 rounded-2xl w-fit border border-border/40">
        <button
          type="button"
          onClick={() => setActiveTab("file")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "file"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          File CSV / Excel
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("screenshot")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "screenshot"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Camera className="h-4 w-4 text-emerald-500" />
          Screenshot / Gambar
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            AI Vision
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CSV / Excel Import Flow */}
      {/* ========================================================================= */}
      {activeTab === "file" && (
        <>
          {/* Step 1: Upload / Drop Zone (jika belum ada file) */}
      {!fileName && (
        <Card className="border-dashed border-2 bg-card/60 transition-all hover:bg-card">
          <CardContent
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center p-12 text-center cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 shadow-sm">
              <UploadCloud className="h-8 w-8" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              Pilih atau seret file CSV / Excel ke sini
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Mendukung file <span className="font-semibold text-foreground">.CSV</span>,{" "}
              <span className="font-semibold text-foreground">.XLSX</span>, atau{" "}
              <span className="font-semibold text-foreground">.XLS</span>. Pemetaan kolom akun, nominal, jenis, dan tanggal diproses instan tanpa delay.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" /> Ekspor BeeCount-Cloud
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground flex items-center gap-1">
                <FileSpreadsheet className="h-3 w-3" /> Mutasi Bank (BCA, Mandiri, Jenius)
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" /> E-Wallet (GoPay, OVO, DANA)
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview & Configuration (saat file sudah diparse) */}
      {fileName && stats && (
        <div className="space-y-6 animate-in fade-in">
          {/* Top file indicator bar */}
          <Card className="p-4 bg-card shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                  {fileType === "excel" ? (
                    <FileSpreadsheet className="h-5 w-5" />
                  ) : (
                    <FileText className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{fileName}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {(fileSize / 1024).toFixed(1)} KB
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {isMappingComplete ? (
                      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Pemetaan kolom terdeteksi otomatis
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Ada kolom wajib yang belum terpetakan
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMappingOpen(true)}
                  className="text-xs gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Sesuaikan Pemetaan Kolom
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFileName("");
                    setRawRows2D([]);
                    setFileTxs([]);
                    manualEditedRowIdsRef.current.clear();
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Ganti File
                </Button>
              </div>
            </div>
          </Card>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                Total Baris Transaksi
              </div>
              <div className="text-2xl font-extrabold text-foreground mt-1">
                {stats.totalRows}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Baris data valid ditemukan di file
              </p>
            </Card>

            <Card className="p-4">
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                Rentang Waktu
              </div>
              <div className="text-sm font-bold text-foreground mt-1 truncate">
                {stats.timeRangeStart && stats.timeRangeEnd
                  ? `${formatDate(stats.timeRangeStart)} s/d ${formatDate(stats.timeRangeEnd)}`
                  : "-"}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Periode transaksi tercatat</p>
            </Card>

            <Card className="p-4">
              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                Total Nominal Bersih
              </div>
              <div
                className={`text-xl font-extrabold mt-1 ${
                  stats.totalSignedAmount >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {stats.totalSignedAmount >= 0 ? "+" : ""}
                {formatCurrency(stats.totalSignedAmount)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Selisih pemasukan - pengeluaran
              </p>
            </Card>
          </div>

          {/* Rincian Transaksi & Entitas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5">
              <CardTitle className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-3">
                Rincian Arus Kas
              </CardTitle>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b">
                  <span className="flex items-center gap-1.5 text-rose-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Pengeluaran ({stats.byType.expenseCount}x)
                  </span>
                  <span className="font-bold text-foreground">
                    {formatCurrency(stats.byType.expenseTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b">
                  <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Pemasukan ({stats.byType.incomeCount}x)
                  </span>
                  <span className="font-bold text-foreground">
                    {formatCurrency(stats.byType.incomeTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sky-600 font-medium">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    Transfer Antar-Akun
                  </span>
                  <span className="font-bold text-foreground">
                    {stats.byType.transferCount}x transaksi
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <CardTitle className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-3">
                Entitas Finansial yang Ditemukan
              </CardTitle>
              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex items-center justify-between text-muted-foreground mb-1">
                    <span>Akun / Rekening</span>
                    <span className="text-[11px]">
                      {stats.accounts.matchedNames.length} cocok, {stats.accounts.newNames.length} baru
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {stats.accounts.matchedNames.map((name: string) => (
                      <Badge key={name} variant="secondary" className="text-[10px]">
                        ✓ {name}
                      </Badge>
                    ))}
                    {stats.accounts.newNames.map((name: string) => (
                      <Badge
                        key={name}
                        variant="outline"
                        className="text-[10px] text-primary border-primary"
                      >
                        + Buat Baru: {name}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between text-muted-foreground mb-1">
                    <span>Kategori Transaksi</span>
                    <span className="text-[11px]">
                      {stats.categories.matchedNames.length} cocok,{" "}
                      {stats.categories.newNames.length} baru
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {stats.categories.matchedNames.slice(0, 6).map((name: string) => (
                      <Badge key={name} variant="secondary" className="text-[10px]">
                        ✓ {name}
                      </Badge>
                    ))}
                    {stats.categories.matchedNames.length > 6 && (
                      <span className="text-[10px] text-muted-foreground self-center">
                        +{stats.categories.matchedNames.length - 6} lainnya
                      </span>
                    )}
                    {stats.categories.newNames.slice(0, 4).map((name: string) => (
                      <Badge
                        key={name}
                        variant="outline"
                        className="text-[10px] text-primary border-primary"
                      >
                        + {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Sample / Interactive Transactions Preview Table */}
          <Card className="overflow-hidden shadow-sm">
            <CardHeader className="py-3 px-5 border-b bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                    Pratinjau & Pilihan Kategori Transaksi
                  </CardTitle>
                  <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 flex items-center gap-1 font-semibold">
                    <Sparkles className="h-3 w-3" />
                    Auto-Kategori NLP Aktif
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  NLP membaca deskripsi / keterangan otomatis untuk menentukan kategori. Anda juga dapat memilih opsi kategori per baris atau menerapkan sekaligus.
                </p>
              </div>

              <div className="flex items-center flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRerunNlp}
                  className="text-xs gap-1.5 h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 border-emerald-500/30"
                  title="Jalankan ulang prediksi NLP untuk seluruh baris berdasarkan deskripsi"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Deteksi Ulang NLP
                </Button>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Tampilkan:</span>
                  <select
                    value={previewLimit}
                    onChange={(e) => setPreviewLimit(Number(e.target.value))}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium focus:outline-none"
                  >
                    <option value={10}>10 Baris</option>
                    <option value={25}>25 Baris</option>
                    <option value={50}>50 Baris</option>
                    <option value={0}>Semua ({fileTxs.length}) Baris</option>
                  </select>
                </div>
              </div>
            </CardHeader>

            {/* Quick Bulk Assignment Toolbar */}
            <div className="px-5 py-2.5 bg-muted/10 border-b flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium">Terapkan Kategori ke Semua:</span>
                <select
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs w-48 focus:outline-none"
                >
                  <option value="">-- Pilih Kategori --</option>
                  {categoriesData && categoriesData.length > 0 && (
                    <optgroup label="Kategori Saya">
                      {categoriesData.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Kategori Standar">
                    {STANDARD_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!bulkCategory}
                  onClick={handleApplyBulkCategory}
                  className="h-8 text-xs font-semibold"
                >
                  Terapkan
                </Button>
              </div>

              <div className="flex items-center gap-2 text-muted-foreground">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={enableNlpCategory}
                    onChange={(e) => setEnableNlpCategory(e.target.checked)}
                    className="rounded border-input h-3.5 w-3.5 text-primary focus:ring-0 cursor-pointer"
                  />
                  <span>Gunakan NLP untuk Kategori Baru / Kosong</span>
                </label>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground font-semibold">
                  <tr>
                    <th className="px-3 py-2.5 w-12 text-center">Baris</th>
                    <th className="px-3 py-2.5 w-36">Waktu</th>
                    <th className="px-3 py-2.5 w-28">Jenis</th>
                    <th className="px-3 py-2.5 w-32 text-right">Nominal</th>
                    <th className="px-3 py-2.5 w-52">Kategori (Pilih Opsi)</th>
                    <th className="px-3 py-2.5 w-36">Akun</th>
                    <th className="px-3 py-2.5">Keterangan / Deskripsi (Dibaca NLP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(previewLimit === 0 ? fileTxs : fileTxs.slice(0, previewLimit)).map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-3 py-2 text-center text-muted-foreground font-mono text-[11px]">
                        L{tx.rowNumber}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground font-mono text-[11px] whitespace-nowrap">
                        {formatDate(tx.happenedAt)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-2 py-0 ${
                            tx.txType === "expense"
                              ? "bg-rose-500/10 text-rose-600 border-rose-200"
                              : tx.txType === "income"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-200"
                              : "bg-sky-500/10 text-sky-600 border-sky-200"
                          }`}
                        >
                          {tx.txType === "expense"
                            ? "Pengeluaran"
                            : tx.txType === "income"
                            ? "Pemasukan"
                            : "Transfer"}
                        </Badge>
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-bold tabular-nums whitespace-nowrap ${
                          tx.txType === "expense"
                            ? "text-rose-600"
                            : tx.txType === "income"
                            ? "text-emerald-600"
                            : "text-sky-600"
                        }`}
                      >
                        {tx.txType === "expense" ? "-" : tx.txType === "income" ? "+" : ""}
                        {formatCurrency(tx.amount)}
                      </td>

                      {/* Interactive Category Selector with Options & NLP Badge */}
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1 min-w-[170px]">
                          <select
                            value={tx.categoryName}
                            onChange={(e) => handleUpdateRowCategory(tx.id, e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs font-semibold focus:outline-none w-full shadow-sm cursor-pointer hover:border-primary/60 transition-colors"
                          >
                            <option value="">-- Pilih Kategori --</option>
                            {/* If current value is not in any predefined list, keep as unique option */}
                            {tx.categoryName &&
                              !categoriesData?.some(
                                (c) => c.name.toLowerCase() === tx.categoryName.toLowerCase()
                              ) &&
                              !STANDARD_CATEGORIES.some(
                                (s) => s.toLowerCase() === tx.categoryName.toLowerCase()
                              ) && (
                                <option value={tx.categoryName}>
                                  {tx.categoryName} {tx.isNlpDetected ? "✨ (Prediksi NLP)" : "(File)"}
                                </option>
                              )}
                            {categoriesData && categoriesData.length > 0 && (
                              <optgroup label="Kategori Saya">
                                {(tx.txType === "income"
                                  ? categoriesData.filter((c) => !c.kind || c.kind === "income")
                                  : categoriesData.filter((c) => !c.kind || c.kind === "expense")
                                ).map((c) => (
                                  <option key={c.id} value={c.name}>
                                    {c.name}
                                  </option>
                                ))}
                                {(tx.txType === "income"
                                  ? categoriesData.filter((c) => c.kind === "expense")
                                  : categoriesData.filter((c) => c.kind === "income")
                                ).map((c) => (
                                  <option key={c.id} value={c.name}>
                                    {c.name}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            <optgroup label="Kategori Standar">
                              {STANDARD_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </optgroup>
                          </select>

                          {tx.isNlpDetected && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded w-fit">
                              <Sparkles className="h-2.5 w-2.5" />
                              NLP AI
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2 text-xs">
                        {tx.txType === "transfer" && tx.toAccountName
                          ? `${tx.accountName} → ${tx.toAccountName}`
                          : tx.accountName}
                      </td>

                      <td className="px-3 py-2 text-muted-foreground truncate max-w-xs font-mono text-[11px]" title={tx.note}>
                        {tx.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {previewLimit !== 0 && previewLimit < fileTxs.length && (
              <div className="py-2.5 px-4 bg-muted/20 border-t text-center text-xs text-muted-foreground">
                Menampilkan {Math.min(previewLimit, fileTxs.length)} dari total {fileTxs.length} baris transaksi.{" "}
                <button
                  type="button"
                  onClick={() => setPreviewLimit(0)}
                  className="font-semibold text-primary hover:underline ml-1"
                >
                  Tampilkan Semua ({fileTxs.length}) Baris
                </button>
              </div>
            )}
          </Card>

          {/* Step 3: Execution Settings Card */}
          <Card className="p-6 bg-card border shadow-sm">
            <h3 className="text-sm font-bold text-foreground mb-4">
              Pengaturan Impor & Eksekusi
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="font-semibold text-foreground">Buku Kas Tujuan</label>
                <select
                  value={targetLedgerId}
                  onChange={(e) => setTargetLedgerId(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-sm text-xs focus:outline-none"
                >
                  <option value="">Buku Kas Utama (Default)</option>
                  {(Array.isArray(ledgersData) ? ledgersData : (ledgersData as any)?.ledgers)?.map(
                    (l: any) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="font-semibold text-foreground">
                  Akun Cadangan (Fallback)
                </label>
                <select
                  value={defaultAccountId}
                  onChange={(e) => setDefaultAccountId(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-sm text-xs focus:outline-none"
                >
                  <option value="">Otomatis dari data file</option>
                  {accountsData?.accounts?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.group})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  Digunakan jika baris transaksi tidak mencantumkan nama akun.
                </span>
              </div>

              <div>
                <label className="font-semibold text-foreground">
                  Kategori Cadangan (Fallback)
                </label>
                <select
                  value={fallbackCategoryId}
                  onChange={(e) => setFallbackCategoryId(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-sm text-xs focus:outline-none"
                >
                  <option value="">Otomatis (Umum / Deteksi NLP)</option>
                  {categoriesData?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.kind === "income" ? "Pemasukan" : "Pengeluaran"})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  Digunakan jika transaksi tidak memiliki kategori dan gagal dideteksi NLP.
                </span>
              </div>

              <div>
                <label className="font-semibold text-foreground">Strategi Duplikasi</label>
                <select
                  value={dedupStrategy}
                  onChange={(e) => setDedupStrategy(e.target.value as any)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-sm text-xs focus:outline-none"
                >
                  <option value="skip_duplicates">Lewati Transaksi Duplikat (Dianjurkan)</option>
                  <option value="insert_all">Impor Semua (Tanpa Cek Duplikat)</option>
                </select>
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  Mencegah pencatatan ganda jika file diimpor berulang kali.
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="w-full sm:w-72">
                <Input
                  type="text"
                  placeholder="Tambahkan tag otomatis (contoh: impor-maret)"
                  value={autoTag}
                  onChange={(e) => setAutoTag(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFileName("");
                    setRawRows2D([]);
                    setFileTxs([]);
                    manualEditedRowIdsRef.current.clear();
                  }}
                  className="w-1/2 sm:w-auto text-xs"
                >
                  Batal
                </Button>
                <Button
                  onClick={handleExecuteImport}
                  disabled={isProcessing || !isMappingComplete}
                  className="w-1/2 sm:w-auto bg-primary hover:bg-primary/90 text-white font-semibold text-xs shadow-md gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isProcessing
                    ? importProgress
                      ? `Mengimpor ${importProgress.done} / ${importProgress.total}...`
                      : "Sedang Memproses..."
                    : `Mulai Impor ${stats.totalRows} Transaksi`}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: Screenshot / OCR Vision Import Flow */}
      {/* ========================================================================= */}
      {activeTab === "screenshot" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Hidden image input */}
          <input
            ref={screenshotInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            multiple
            onChange={(e) => handleScreenshotSelect(e.target.files)}
            className="hidden"
          />

          {/* When no transactions parsed yet */}
          {screenshotTxs.length === 0 && (
            <>
              {/* Image Drop Zone when 0 files selected */}
              {screenshotFiles.length === 0 && (
                <Card className="border-dashed border-2 bg-card/60 transition-all hover:bg-card">
                  <CardContent
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleScreenshotSelect(e.dataTransfer.files);
                    }}
                    className="flex flex-col items-center justify-center p-12 text-center cursor-pointer"
                    onClick={() => screenshotInputRef.current?.click()}
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 mb-4 shadow-sm">
                      <ImagePlus className="h-8 w-8" />
                    </div>
                    <h3 className="text-base font-bold text-foreground">
                      Pilih atau seret screenshot mutasi / struk ke sini
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-lg">
                      Mendukung screenshot riwayat bank (blu, BCA, Mandiri, BRI, BNI), e-wallet (GoPay, OVO, DANA, ShopeePay), bukti transfer, atau foto struk kasir belanja fisik. AI Vision akan otomatis membaca nominal, tanggal, dan keterangannya.
                    </p>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground flex items-center gap-1">
                        <Camera className="h-3 w-3 text-emerald-500" /> Screenshot Bank (blu, BCA, Mandiri)
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground flex items-center gap-1">
                        <Receipt className="h-3 w-3 text-emerald-500" /> Struk Belanja & Kasir Fisik
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-emerald-500" /> E-Wallet & QRIS
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
                        Maksimal 10 gambar sekaligus
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Uploaded images gallery & CTA */}
              {screenshotFiles.length > 0 && (
                <div className="space-y-4">
                  <Card className="p-4 bg-card shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <Camera className="h-4 w-4 text-emerald-500" />
                          Screenshot Terpilih ({screenshotFiles.length} Gambar)
                        </h3>
                        <p className="text-[11px] text-muted-foreground">
                          Pastikan gambar riwayat transaksi atau struk terlihat jelas dan angka nominal terbaca.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {screenshotFiles.length < 10 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => screenshotInputRef.current?.click()}
                            disabled={isParsingScreenshot}
                            className="text-xs gap-1.5"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Tambah Gambar
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleResetScreenshot}
                          disabled={isParsingScreenshot}
                          className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                        >
                          Hapus Semua
                        </Button>
                      </div>
                    </div>

                    {/* Image thumbnails grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {screenshotPreviews.map((url, idx) => (
                        <div
                          key={idx}
                          className="group relative rounded-xl border bg-muted/20 overflow-hidden flex flex-col shadow-xs"
                        >
                          <div className="aspect-[3/4] w-full overflow-hidden bg-black/5 dark:bg-white/5 relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`Screenshot ${idx + 1}`}
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            />
                            {!isParsingScreenshot && (
                              <button
                                type="button"
                                onClick={() => handleRemoveScreenshot(idx)}
                                className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-rose-600 transition-colors shadow-sm cursor-pointer"
                                title="Hapus gambar ini"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="p-2 text-[10px]">
                            <div className="font-medium truncate text-foreground">
                              {screenshotFiles[idx]?.name || `Gambar ${idx + 1}`}
                            </div>
                            <div className="text-muted-foreground text-[9px]">
                              {((screenshotFiles[idx]?.size || 0) / 1024).toFixed(0)} KB
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Processing Status Banner */}
                  {isParsingScreenshot && (
                    <Card className="p-8 bg-emerald-500/5 border border-emerald-500/20 text-center space-y-3">
                      <Loader2 className="h-9 w-9 animate-spin text-emerald-600 mx-auto" />
                      <h4 className="text-sm font-bold text-foreground">
                        {screenshotParseProgress || "Gemini AI Vision sedang menganalisis gambar..."}
                      </h4>
                      <p className="text-xs text-muted-foreground max-w-md mx-auto">
                        Membaca mutasi tanggal, nominal, jenis debit/kredit, nama bank/merchant, dan mencocokkan akun Anda secara otomatis.
                      </p>
                    </Card>
                  )}

                  {/* Error Banner */}
                  {screenshotError && !isParsingScreenshot && (
                    <div className="p-4 bg-rose-500/10 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                      <div className="text-xs flex-1">
                        <p className="font-semibold text-rose-600">Gagal Membaca Screenshot</p>
                        <p className="text-muted-foreground mt-0.5">{screenshotError}</p>
                      </div>
                    </div>
                  )}

                  {/* Action CTA Button */}
                  {!isParsingScreenshot && (
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <Button
                        variant="outline"
                        onClick={handleResetScreenshot}
                        className="text-xs"
                      >
                        Batal
                      </Button>
                      <Button
                        onClick={handleProcessScreenshots}
                        className="bg-primary hover:bg-primary/90 text-white font-semibold text-xs shadow-md gap-2"
                      >
                        <Sparkles className="h-4 w-4 text-emerald-200" />
                        Baca Transaksi dengan AI Vision ({screenshotFiles.length} Gambar)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* When transactions HAVE been parsed from Screenshot */}
          {screenshotTxs.length > 0 && (
            <div className="space-y-6">
              {/* Top Bar with Reset Option */}
              <Card className="p-4 bg-card shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">
                          {screenshotTxs.length} Transaksi Terdeteksi oleh AI
                        </span>
                        <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                          {screenshotFiles.length} Gambar
                        </Badge>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Data telah diekstrak. Anda dapat memeriksa, mengedit nominal, kategori, atau menghapus baris sebelum disimpan.
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetScreenshot}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Upload Gambar Lain
                  </Button>
                </div>
              </Card>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-4 bg-card shadow-sm">
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Total Transaksi
                  </span>
                  <div className="text-xl font-bold mt-1 text-foreground">
                    {screenshotStats.totalCount}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Siap diimpor ke buku kas
                  </span>
                </Card>

                <Card className="p-4 bg-card shadow-sm">
                  <span className="text-[11px] text-rose-600 font-medium">Pengeluaran</span>
                  <div className="text-xl font-bold mt-1 text-rose-600">
                    -{formatCurrency(screenshotStats.expenseTotal)}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    {screenshotStats.expenseCount} transaksi
                  </span>
                </Card>

                <Card className="p-4 bg-card shadow-sm">
                  <span className="text-[11px] text-emerald-600 font-medium">Pemasukan</span>
                  <div className="text-xl font-bold mt-1 text-emerald-600">
                    +{formatCurrency(screenshotStats.incomeTotal)}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    {screenshotStats.incomeCount} transaksi
                  </span>
                </Card>

                <Card className="p-4 bg-card shadow-sm">
                  <span className="text-[11px] text-sky-600 font-medium">Transfer</span>
                  <div className="text-xl font-bold mt-1 text-sky-600">
                    {screenshotStats.transferCount}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    Perpindahan saldo
                  </span>
                </Card>
              </div>

              {/* Editable Table */}
              <Card className="overflow-hidden shadow-sm">
                <CardHeader className="py-3 px-5 border-b bg-muted/20 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                      Pratinjau & Edit Transaksi Hasil Pembacaan AI
                    </CardTitle>
                    <span className="text-[11px] text-muted-foreground">
                      Klik pada kolom untuk mengoreksi nominal, kategori, akun, atau keterangan secara langsung.
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddManualScreenshotTx}
                    className="text-xs gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Tambah Baris Manual
                  </Button>
                </CardHeader>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground font-semibold">
                      <tr>
                        <th className="px-3 py-2.5 w-10 text-center">#</th>
                        <th className="px-3 py-2.5 w-44">Waktu</th>
                        <th className="px-3 py-2.5 w-32">Jenis</th>
                        <th className="px-3 py-2.5 w-36 text-right">Nominal (Rp)</th>
                        <th className="px-3 py-2.5 w-40">Kategori</th>
                        <th className="px-3 py-2.5 w-44">Akun</th>
                        <th className="px-3 py-2.5">Keterangan / Merchant</th>
                        <th className="px-3 py-2.5 w-12 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {screenshotTxs.map((tx, idx) => (
                        <tr key={tx.id} className="hover:bg-muted/10 transition-colors">
                          <td className="px-3 py-2 text-center text-muted-foreground font-mono text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Waktu */}
                          <td className="px-3 py-2">
                            <Input
                              type="datetime-local"
                              value={toDatetimeLocalString(tx.happenedAt)}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val) {
                                  handleUpdateScreenshotTx(tx.id, {
                                    happenedAt: new Date(val).toISOString(),
                                  });
                                }
                              }}
                              className="h-8 text-xs font-mono w-44 bg-background"
                            />
                          </td>

                          {/* Jenis Transaksi */}
                          <td className="px-3 py-2">
                            <select
                              value={tx.txType}
                              onChange={(e) =>
                                handleUpdateScreenshotTx(tx.id, {
                                  txType: e.target.value as any,
                                })
                              }
                              className={`h-8 rounded-md border border-input px-2 text-xs font-semibold focus:outline-none w-32 ${
                                tx.txType === "expense"
                                  ? "bg-rose-500/10 text-rose-600 border-rose-200"
                                  : tx.txType === "income"
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-200"
                                  : "bg-sky-500/10 text-sky-600 border-sky-200"
                              }`}
                            >
                              <option value="expense">Pengeluaran</option>
                              <option value="income">Pemasukan</option>
                              <option value="transfer">Transfer</option>
                            </select>
                          </td>

                          {/* Nominal */}
                          <td className="px-3 py-2 text-right">
                            <Input
                              type="number"
                              min="0"
                              step="1000"
                              value={tx.amount || ""}
                              onChange={(e) =>
                                handleUpdateScreenshotTx(tx.id, {
                                  amount: Math.max(0, Number(e.target.value)),
                                })
                              }
                              className={`h-8 text-xs font-bold w-32 text-right bg-background ml-auto ${
                                tx.txType === "expense"
                                  ? "text-rose-600"
                                  : tx.txType === "income"
                                  ? "text-emerald-600"
                                  : "text-sky-600"
                              }`}
                            />
                          </td>

                          {/* Kategori */}
                          <td className="px-3 py-2">
                            <Input
                              type="text"
                              list="ocr-category-datalist"
                              value={tx.categoryName}
                              onChange={(e) =>
                                handleUpdateScreenshotTx(tx.id, {
                                  categoryName: e.target.value,
                                })
                              }
                              className="h-8 text-xs w-40 bg-background"
                              placeholder="Pilih/ketik kategori"
                            />
                          </td>

                          {/* Akun */}
                          <td className="px-3 py-2">
                            <div className="space-y-1">
                              <select
                                value={tx.accountName}
                                onChange={(e) =>
                                  handleUpdateScreenshotTx(tx.id, {
                                    accountName: e.target.value,
                                  })
                                }
                                className="h-8 rounded-md border border-input bg-background px-2 text-xs w-44 focus:outline-none"
                              >
                                {accountsData?.accounts?.map((acc) => (
                                  <option key={acc.id} value={acc.name}>
                                    {acc.name} ({acc.group})
                                  </option>
                                ))}
                                {!accountsData?.accounts?.some(
                                  (a) => a.name.toLowerCase() === tx.accountName.toLowerCase()
                                ) && (
                                  <option value={tx.accountName}>
                                    + {tx.accountName} (buat baru)
                                  </option>
                                )}
                              </select>

                              {/* To Account if transfer */}
                              {tx.txType === "transfer" && (
                                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <span>Ke:</span>
                                  <select
                                    value={tx.toAccountName || ""}
                                    onChange={(e) =>
                                      handleUpdateScreenshotTx(tx.id, {
                                        toAccountName: e.target.value || null,
                                      })
                                    }
                                    className="h-7 rounded-md border border-input bg-background px-2 text-[11px] w-36 focus:outline-none"
                                  >
                                    <option value="">-- Pilih Tujuan --</option>
                                    {accountsData?.accounts?.map((acc) => (
                                      <option key={acc.id} value={acc.name}>
                                        {acc.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Keterangan */}
                          <td className="px-3 py-2">
                            <Input
                              type="text"
                              value={tx.note}
                              onChange={(e) =>
                                handleUpdateScreenshotTx(tx.id, {
                                  note: e.target.value,
                                })
                              }
                              className="h-8 text-xs bg-background min-w-[180px]"
                              placeholder="Nama merchant atau deskripsi"
                            />
                          </td>

                          {/* Aksi Hapus */}
                          <td className="px-3 py-2 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteScreenshotTx(tx.id)}
                              className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                              title="Hapus baris ini"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Datalist for categories */}
                <datalist id="ocr-category-datalist">
                  {categoriesData?.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                  <option value="Makanan & Minuman" />
                  <option value="Belanja" />
                  <option value="Transportasi" />
                  <option value="Tagihan & Utilitas" />
                  <option value="Hiburan" />
                  <option value="Kesehatan" />
                  <option value="Gaji & Pendapatan" />
                  <option value="Transfer Saldo" />
                  <option value="Umum" />
                </datalist>
              </Card>

              {/* Execution Settings Card */}
              <Card className="p-6 bg-card border shadow-sm">
                <h3 className="text-sm font-bold text-foreground mb-4">
                  Pengaturan Impor & Eksekusi
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="font-semibold text-foreground">Buku Kas Tujuan</label>
                    <select
                      value={targetLedgerId}
                      onChange={(e) => setTargetLedgerId(e.target.value)}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-sm text-xs focus:outline-none"
                    >
                      <option value="">Buku Kas Utama (Default)</option>
                      {(Array.isArray(ledgersData) ? ledgersData : (ledgersData as any)?.ledgers)?.map(
                        (l: any) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-foreground">
                      Akun Cadangan (Fallback)
                    </label>
                    <select
                      value={defaultAccountId}
                      onChange={(e) => setDefaultAccountId(e.target.value)}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-sm text-xs focus:outline-none"
                    >
                      <option value="">Otomatis dari data transaksi</option>
                      {accountsData?.accounts?.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.group})
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">
                      Digunakan jika transaksi tidak mencantumkan nama akun.
                    </span>
                  </div>

                  <div>
                    <label className="font-semibold text-foreground">Strategi Duplikasi</label>
                    <select
                      value={dedupStrategy}
                      onChange={(e) => setDedupStrategy(e.target.value as any)}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-sm text-xs focus:outline-none"
                    >
                      <option value="skip_duplicates">Lewati Transaksi Duplikat (Dianjurkan)</option>
                      <option value="insert_all">Impor Semua (Tanpa Cek Duplikat)</option>
                    </select>
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">
                      Mencegah pencatatan ganda jika screenshot diproses ulang.
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="w-full sm:w-72">
                    <Input
                      type="text"
                      placeholder="Tambahkan tag otomatis (contoh: impor-ocr)"
                      value={autoTag}
                      onChange={(e) => setAutoTag(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      onClick={handleResetScreenshot}
                      className="w-1/2 sm:w-auto text-xs"
                    >
                      Batal
                    </Button>
                    <Button
                      onClick={handleExecuteScreenshotImport}
                      disabled={isProcessing || screenshotTxs.length === 0}
                      className="w-1/2 sm:w-auto bg-primary hover:bg-primary/90 text-white font-semibold text-xs shadow-md gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {isProcessing
                        ? importProgress
                          ? `Mengimpor ${importProgress.done} / ${importProgress.total}...`
                          : "Sedang Memproses..."
                        : `Mulai Impor ${screenshotTxs.length} Transaksi`}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* Field Mapping Dialog */}
      {/* ========================================================================= */}
      {isMappingOpen && mappingDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-xl rounded-2xl bg-card border shadow-2xl p-6 text-card-foreground max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div>
                <h2 className="text-base font-bold">Sesuaikan Pemetaan Kolom</h2>
                <p className="text-[11px] text-muted-foreground">
                  Cocokkan nama kolom di file Anda dengan data transaksi Fin.IQ.
                </p>
              </div>
              <button
                onClick={() => setIsMappingOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl text-[11px] text-muted-foreground">
                Tanda bintang (<span className="text-rose-500 font-bold">*</span>) wajib ditentukan
                agar transaksi dapat diproses dengan benar.
              </div>

              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-[160px_1fr] items-center gap-2">
                  <label className="font-semibold text-foreground">
                    Jenis Transaksi <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={mappingDraft.tx_type || ""}
                    onChange={(e) =>
                      setMappingDraft({ ...mappingDraft, tx_type: e.target.value || null })
                    }
                    className="h-8 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="">-- Tidak Dipetakan --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-[160px_1fr] items-center gap-2">
                  <label className="font-semibold text-foreground">
                    Nominal / Jumlah <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={mappingDraft.amount || ""}
                    onChange={(e) =>
                      setMappingDraft({ ...mappingDraft, amount: e.target.value || null })
                    }
                    className="h-8 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="">-- Tidak Dipetakan --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-[160px_1fr] items-center gap-2">
                  <label className="font-semibold text-foreground">
                    Tanggal & Waktu <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={mappingDraft.happened_at || ""}
                    onChange={(e) =>
                      setMappingDraft({ ...mappingDraft, happened_at: e.target.value || null })
                    }
                    className="h-8 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="">-- Tidak Dipetakan --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-[160px_1fr] items-center gap-2">
                  <label className="font-semibold text-foreground">Kategori Utama</label>
                  <select
                    value={mappingDraft.category_name || ""}
                    onChange={(e) =>
                      setMappingDraft({ ...mappingDraft, category_name: e.target.value || null })
                    }
                    className="h-8 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="">-- Tidak Dipetakan (Pakai Umum) --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-[160px_1fr] items-center gap-2">
                  <label className="font-semibold text-foreground">Subkategori (Opsional)</label>
                  <select
                    value={mappingDraft.subcategory_name || ""}
                    onChange={(e) =>
                      setMappingDraft({ ...mappingDraft, subcategory_name: e.target.value || null })
                    }
                    className="h-8 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="">-- Tidak Dipetakan --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-[160px_1fr] items-center gap-2">
                  <label className="font-semibold text-foreground">Akun / Rekening</label>
                  <select
                    value={mappingDraft.account_name || ""}
                    onChange={(e) =>
                      setMappingDraft({ ...mappingDraft, account_name: e.target.value || null })
                    }
                    className="h-8 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="">-- Tidak Dipetakan (Pakai Akun Default) --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-[160px_1fr] items-center gap-2">
                  <label className="font-semibold text-foreground">Akun Tujuan Transfer</label>
                  <select
                    value={mappingDraft.to_account_name || ""}
                    onChange={(e) =>
                      setMappingDraft({ ...mappingDraft, to_account_name: e.target.value || null })
                    }
                    className="h-8 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="">-- Tidak Dipetakan --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-[160px_1fr] items-center gap-2">
                  <label className="font-semibold text-foreground">Catatan / Deskripsi</label>
                  <select
                    value={mappingDraft.note || ""}
                    onChange={(e) =>
                      setMappingDraft({ ...mappingDraft, note: e.target.value || null })
                    }
                    className="h-8 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="">-- Tidak Dipetakan --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-[160px_1fr] items-center gap-2">
                  <label className="font-semibold text-foreground">Tag / Label</label>
                  <select
                    value={mappingDraft.tags || ""}
                    onChange={(e) =>
                      setMappingDraft({ ...mappingDraft, tags: e.target.value || null })
                    }
                    className="h-8 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="">-- Tidak Dipetakan --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-3 border-t flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMappingDraft({ ...suggestedMapping! })}
                className="text-xs text-muted-foreground gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset ke Rekomendasi
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsMappingOpen(false)}>
                  Batal
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setCurrentMapping(mappingDraft);
                    setIsMappingOpen(false);
                  }}
                  className="bg-primary text-white"
                >
                  Terapkan & Perbarui
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modal Sukses Impor */}
      {/* ========================================================================= */}
      {isSuccessOpen && importResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-md rounded-2xl bg-card border shadow-2xl p-6 text-card-foreground text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <h2 className="text-lg font-bold text-foreground">Impor Transaksi Selesai</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Data transaksi dari file telah berhasil dimasukkan ke dalam buku kas Fin.IQ Anda.
            </p>

            <div className="my-5 p-4 bg-muted/40 rounded-xl space-y-2 text-xs text-left">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transaksi Ditambahkan:</span>
                <span className="font-bold text-emerald-600">
                  {importResult.createdCount} transaksi
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dilewati (Duplikat):</span>
                <span className="font-semibold text-muted-foreground">
                  {importResult.skippedCount} transaksi
                </span>
              </div>
              {importResult.accountsCreated?.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Akun Baru Dibuat:</span>
                  <span className="font-semibold text-foreground">
                    {importResult.accountsCreated.join(", ")}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="w-1/2 text-xs"
                onClick={() => router.push("/overview")}
              >
                Lihat Dashboard
              </Button>
              <Button
                className="w-1/2 bg-primary text-white text-xs font-semibold"
                onClick={() => router.push("/transactions")}
              >
                Buka Transaksi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
