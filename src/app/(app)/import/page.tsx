"use client";

import React, { useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency, formatDate } from "@/lib/utils";
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

export default function ImportPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File states
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [fileType, setFileType] = useState<"csv" | "excel">("csv");
  const [rawRows2D, setRawRows2D] = useState<string[][]>([]);

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

  // Mutation
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

      setHeaders(detectedHeaders);
      setRawRows2D(dataRows);
      setSuggestedMapping(suggested);
      setCurrentMapping(suggested);
      setMappingDraft(suggested);
    } catch (err: any) {
      alert(`Gagal membaca file: ${err.message || String(err)}`);
      setFileName("");
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

  // Compute stats and samples client-side from rawRows2D + currentMapping
  const { stats, samples } = useMemo(() => {
    if (!currentMapping || rawRows2D.length === 0 || headers.length === 0) {
      return { stats: null, samples: [] };
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

    const sampleList: any[] = [];

    const getCol = (row: string[], key: keyof FieldMapping) => {
      const colName = currentMapping[key];
      if (!colName) return "";
      const colIdx = headers.indexOf(colName);
      return colIdx !== -1 ? (row[colIdx] || "").trim() : "";
    };

    for (let idx = 0; idx < rawRows2D.length; idx++) {
      const row = rawRows2D[idx];

      const rawType = getCol(row, "tx_type");
      const txType = normalizeTxType(rawType);
      const amount = cleanAmount(getCol(row, "amount"));
      const rawDate = getCol(row, "happened_at");
      const isoDate = parseDateString(rawDate);
      const catName = getCol(row, "category_name") || "Lain-lain";
      const subCat = getCol(row, "subcategory_name");
      const fullCat = subCat ? `${catName} / ${subCat}` : catName;
      const accName = getCol(row, "account_name") || getCol(row, "from_account_name") || "cash";
      const toAccName = getCol(row, "to_account_name");
      const note = getCol(row, "note");
      const tagsRaw = getCol(row, "tags");
      const tagList = tagsRaw
        ? tagsRaw.split(/[,;]/).map((t) => t.trim()).filter(Boolean)
        : [];

      if (accName) fileAccounts.add(accName);
      if (toAccName) fileAccounts.add(toAccName);
      if (catName) fileCategories.add(catName);
      tagList.forEach((t) => fileTags.add(t));

      if (txType === "expense") {
        expenseCount++;
        expenseTotal += amount;
      } else if (txType === "income") {
        incomeCount++;
        incomeTotal += amount;
      } else {
        transferCount++;
      }

      if (!minDate || isoDate < minDate) minDate = isoDate;
      if (!maxDate || isoDate > maxDate) maxDate = isoDate;

      if (sampleList.length < 10) {
        sampleList.push({
          rowNumber: idx + 2,
          happenedAt: isoDate,
          txType,
          amount,
          categoryName: fullCat,
          accountName: accName,
          toAccountName: toAccName || null,
          note: note || "-",
          tags: tagList,
        });
      }
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
      stats: {
        totalRows: rawRows2D.length,
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
      },
      samples: sampleList,
    };
  }, [currentMapping, rawRows2D, headers, accountsData, categoriesData]);

  // Execute import
  const handleExecuteImport = async () => {
    if (!currentMapping || rawRows2D.length === 0) return;

    const getCol = (row: string[], key: keyof FieldMapping) => {
      const colName = currentMapping[key];
      if (!colName) return "";
      const colIdx = headers.indexOf(colName);
      return colIdx !== -1 ? (row[colIdx] || "").trim() : "";
    };

    const itemsToImport: any[] = [];

    for (const row of rawRows2D) {
      const rawType = getCol(row, "tx_type");
      const txType = normalizeTxType(rawType);
      const amount = cleanAmount(getCol(row, "amount"));
      if (amount <= 0) continue;

      const rawDate = getCol(row, "happened_at");
      const isoDate = parseDateString(rawDate);

      let catName = getCol(row, "category_name") || "Umum";
      const subCat = getCol(row, "subcategory_name");
      if (subCat) catName = `${catName} / ${subCat}`;

      const accName = getCol(row, "account_name") || getCol(row, "from_account_name") || "cash";
      const toAccName = getCol(row, "to_account_name") || null;
      const note = getCol(row, "note") || undefined;
      const tagsRaw = getCol(row, "tags");
      const tagList = tagsRaw
        ? tagsRaw.split(/[,;]/).map((t) => t.trim()).filter(Boolean)
        : [];

      itemsToImport.push({
        txType,
        amount,
        happenedAt: isoDate,
        categoryName: catName,
        accountName: accName,
        toAccountName: toAccName || null,
        note,
        tags: tagList,
      });
    }

    if (itemsToImport.length === 0) {
      alert("Tidak ada transaksi valid dengan nominal > 0 yang dapat diimpor.");
      return;
    }

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
              Impor mutasi riwayat keuangan langsung dari file CSV atau Excel dengan pemetaan pintar.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadTemplate}
          className="text-xs gap-1.5 self-start sm:self-auto"
        >
          <Download className="h-3.5 w-3.5" />
          Download Template CSV
        </Button>
      </div>

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

          {/* Sample 10 Transactions Table */}
          <Card className="overflow-hidden">
            <CardHeader className="py-3 px-5 border-b bg-muted/20 flex flex-row items-center justify-between">
              <CardTitle className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                Pratinjau Data (10 Transaksi Pertama)
              </CardTitle>
              <span className="text-[11px] text-muted-foreground">
                Menampilkan {samples.length} dari {stats.totalRows} baris
              </span>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground font-semibold">
                  <tr>
                    <th className="px-4 py-2.5">Baris</th>
                    <th className="px-4 py-2.5">Waktu</th>
                    <th className="px-4 py-2.5">Jenis</th>
                    <th className="px-4 py-2.5 text-right">Nominal</th>
                    <th className="px-4 py-2.5">Kategori</th>
                    <th className="px-4 py-2.5">Akun</th>
                    <th className="px-4 py-2.5">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {samples.map((tx, idx) => (
                    <tr key={idx} className="hover:bg-muted/10">
                      <td className="px-4 py-2 text-muted-foreground font-mono text-[11px]">
                        L{tx.rowNumber}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground font-mono text-[11px]">
                        {formatDate(tx.happenedAt)}
                      </td>
                      <td className="px-4 py-2">
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
                        className={`px-4 py-2 text-right font-bold tabular-nums ${
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
                      <td className="px-4 py-2 font-medium">{tx.categoryName}</td>
                      <td className="px-4 py-2">
                        {tx.txType === "transfer" && tx.toAccountName
                          ? `${tx.accountName} → ${tx.toAccountName}`
                          : tx.accountName}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground truncate max-w-xs">
                        {tx.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Step 3: Execution Settings Card */}
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
