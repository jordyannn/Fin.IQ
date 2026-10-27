/* Hallmark · macrostructure: Stat-Led · theme: Bibit-Fintech · genre: modern-minimal · pre-emit critique: P5 H5 E5 S5 R5 V5 */
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { useTranslation } from "@/i18n";
import { DateFilterPreset, computeDateRange } from "@/lib/date-filters";
import { useUIStore } from "@/store/ui.store";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  ArrowRight,
  Banknote,
  CreditCard,
  Smartphone,
  Tags,
  Flame,
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
  FileSpreadsheet,
  Receipt,
  Sparkles,
  ChevronRight as ChevronRightIcon,
  RefreshCw,
  RotateCcw,
  Check,
  HelpCircle,
  ShieldCheck,
  UploadCloud,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { GeometricIcon } from "@/components/ui/GeometricIcon";
import {
  CategoryDetailModal,
  type CategoryDetailTarget,
} from "@/components/analytics/CategoryDetailModal";
import { CsvImportTutorialModal } from "@/components/import/CsvImportTutorialModal";
import { OverviewMascotMood } from "@/components/mascot/OverviewMascotMood";
import { MonthYearPicker, MONTHS_ID } from "@/components/ui/MonthYearPicker";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts";

const PIE_COLORS = [
  "#059669", // Primary Emerald
  "#10B981", // Emerald Light
  "#1B6B4F", // Secondary Forest
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#F59E0B", // Amber
  "#64748B", // Slate
];

export default function OverviewPage() {
  const { openQuickAdd } = useUIStore();
  const utils = trpc.useUtils();
  const { t, formatCurrency, formatDate } = useTranslation();

  // Date Filter state - Disamakan dengan Transactions Page
  const [datePreset, setDatePreset] = useState<DateFilterPreset>("this_month");
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [customDateFrom, setCustomDateFrom] = useState<string>("");
  const [customDateTo, setCustomDateTo] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryDetailTarget | null>(null);
  const [isCsvTutorialOpen, setIsCsvTutorialOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  // Heatmap Carousel State (4 Halaman, 3 Bulan per Halaman)
  const [heatmapPage, setHeatmapPage] = useState<number>(() => {
    return Math.min(3, Math.max(0, Math.floor(new Date().getMonth() / 3)));
  });
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (diff > 50) {
      // Swipe kiri -> halaman berikutnya
      setHeatmapPage((prev) => (prev < 3 ? prev + 1 : 0));
    } else if (diff < -50) {
      // Swipe kanan -> halaman sebelumnya
      setHeatmapPage((prev) => (prev > 0 ? prev - 1 : 3));
    }
    setTouchStartX(null);
  };

  // Sinkronisasi otomatis halaman carousel saat pengguna memilih bulan tertentu
  React.useEffect(() => {
    if (datePreset === "this_month") {
      const targetPage = Math.floor(currentMonth.getMonth() / 3);
      setHeatmapPage(targetPage);
    }
  }, [currentMonth, datePreset]);

  // Perhitungan rentang tanggal dan label periode
  const { dateFrom, dateTo, periodLabel } = useMemo(() => {
    return computeDateRange(datePreset, currentMonth, customDateFrom, customDateTo);
  }, [datePreset, currentMonth, customDateFrom, customDateTo]);

  const isCurrentMonthNow =
    currentMonth.getMonth() === new Date().getMonth() &&
    currentMonth.getFullYear() === new Date().getFullYear();

  const handlePrevPeriod = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextPeriod = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleResetPeriod = () => setCurrentMonth(new Date());

  const handleResetAllFilters = () => {
    setDatePreset("this_month");
    setCurrentMonth(new Date());
    setCustomDateFrom("");
    setCustomDateTo("");
  };

  // TRPC Queries - Mengambil data transaksi yang SAMA PERSIS dengan Halaman Transaksi
  const {
    data: txListData,
    isLoading: isTxLoading,
    refetch: refetchTxList,
  } = trpc.transactions.list.useQuery({
    dateFrom,
    dateTo,
    limit: 500,
  });

  const {
    data: heroData,
    isLoading: isHeroLoading,
    refetch: refetchHero,
  } = trpc.analytics.heroSummary.useQuery({
    scope: datePreset,
    dateFrom,
    dateTo,
  });

  const { data: assetData } = trpc.analytics.assetComposition.useQuery();
  const { data: trendData } = trpc.analytics.monthlyTrend.useQuery({ monthsCount: 6 });
  const { data: expenseRanks, refetch: refetchExpense } = trpc.analytics.categoryRanks.useQuery({
    scope: datePreset,
    kind: "expense",
    dateFrom,
    dateTo,
  });
  const { data: incomeRanks, refetch: refetchIncome } = trpc.analytics.categoryRanks.useQuery({
    scope: datePreset,
    kind: "income",
    dateFrom,
    dateTo,
  });
  const { data: heatmapData } = trpc.analytics.yearHeatmap.useQuery({
    year: currentMonth.getFullYear(),
  });
  const { data: recentTxData } = trpc.transactions.list.useQuery({
    limit: 5,
  });

  // Summary identik dengan halaman Transaksi dan Arus Kas Bersih
  const summary = useMemo(() => {
    if (txListData?.summary) {
      return {
        count: txListData.summary.totalCount,
        income: txListData.summary.income,
        expense: txListData.summary.expense,
        net: txListData.summary.net,
      };
    }
    if (heroData) {
      return {
        count: heroData.periodTxCount,
        income: heroData.income,
        expense: heroData.expense,
        net: heroData.balance,
      };
    }
    return {
      count: 0,
      income: 0,
      expense: 0,
      net: 0,
    };
  }, [txListData?.summary, heroData]);

  // Total saldo user (akumulasi seluruh rekening) & daftar akun
  const totalUserBalance = heroData?.totalNetWorth ?? assetData?.total ?? 0;
  const accountsList = assetData?.items || [];

  // Data komposisi untuk Donut Chart Recharts langsung di halaman overview
  const accountChartData = useMemo(() => {
    return accountsList
      .filter((a) => a.balance > 0)
      .map((acc, idx) => ({
        name: acc.name,
        value: acc.balance,
        percent: acc.percent,
        color: PIE_COLORS[idx % PIE_COLORS.length],
      }));
  }, [accountsList]);

  // Sparkline kurva saldo akumulatif (dimulai dari 0 hingga exact summary.net)
  const sparklineData = useMemo(() => {
    if (!summary.count) return [];

    let list: Array<{ happenedAt: Date | string; amount: number; txType: string }> = [];
    if (txListData?.items && txListData.items.length > 0) {
      list = [...txListData.items].reverse();
    } else if (heroData?.sparkline && heroData.sparkline.length > 0) {
      return heroData.sparkline;
    }

    if (list.length === 0) return [];

    let running = 0;
    const points: Array<{ idx: number; date: string; running: number }> = [
      {
        idx: 0,
        date: "Mulai",
        running: 0,
      },
    ];

    list.forEach((tx, idx) => {
      if (tx.txType === "income") running += tx.amount;
      if (tx.txType === "expense") running -= tx.amount;
      points.push({
        idx: idx + 1,
        date: formatDate(tx.happenedAt),
        running,
      });
    });

    if (points.length > 1 && points[points.length - 1].running !== summary.net) {
      points[points.length - 1].running = summary.net;
    }

    return points;
  }, [txListData?.items, heroData?.sparkline, summary.count, summary.net]);

  // Statistik habit konsistensi (dihitung langsung dari data Arus Kas Bersih)
  const habitStats = useMemo(() => {
    const expense = summary.expense;
    const count = summary.count;
    const daysInScope = dateFrom && dateTo
      ? Math.max(1, Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)))
      : datePreset === "this_year"
      ? 365
      : datePreset === "all"
      ? Math.max(1, heroData?.daysSinceFirstTx || 30)
      : 30;

    const dailyAvg = Math.round(expense / Math.max(1, daysInScope));
    const txPerDay = (count / Math.max(1, daysInScope)).toFixed(1);
    const daysSinceFirst = heroData?.daysSinceFirstTx ?? 1;

    return {
      dailyAvg,
      txPerDay,
      daysSinceFirst,
    };
  }, [summary.expense, summary.count, dateFrom, dateTo, datePreset, heroData?.daysSinceFirstTx]);

  // Sinkronisasi data tren bulanan dengan data summary Arus Kas Bersih
  const synchronizedTrendData = useMemo(() => {
    if (!trendData || trendData.length === 0) return [];
    const selectedMonthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;
    return trendData.map((m) => {
      if (datePreset === "this_month" && m.monthKey === selectedMonthKey) {
        return {
          ...m,
          income: summary.income,
          expense: summary.expense,
          net: summary.net,
        };
      }
      return m;
    });
  }, [trendData, datePreset, currentMonth, summary]);

  // Sinkronisasi data aktivitas heatmap tahunan dengan data summary Arus Kas Bersih
  const synchronizedHeatmapData = useMemo(() => {
    if (!heatmapData || heatmapData.length === 0) return [];
    return heatmapData.map((m) => {
      const isSelectedMonth =
        datePreset === "this_month" &&
        currentMonth.getMonth() === m.monthIndex;

      if (isSelectedMonth) {
        return {
          ...m,
          income: summary.income,
          expense: summary.expense,
          txCount: summary.count,
        };
      }
      return m;
    });
  }, [heatmapData, datePreset, currentMonth, summary]);

  // Metadata Kuartal untuk 4 Halaman Carousel
  const quarterMetadata = [
    { page: 0, label: "Q1", title: "Kuartal 1", range: "Januari - Maret", shortRange: "Jan - Mar" },
    { page: 1, label: "Q2", title: "Kuartal 2", range: "April - Juni", shortRange: "Apr - Jun" },
    { page: 2, label: "Q3", title: "Kuartal 3", range: "Juli - September", shortRange: "Jul - Sep" },
    { page: 3, label: "Q4", title: "Kuartal 4", range: "Oktober - Desember", shortRange: "Okt - Des" },
  ];

  // Heatmap Data dibagi menjadi 4 Halaman Carousel (3 bulan per halaman)
  const heatmapPages = useMemo(() => {
    if (!synchronizedHeatmapData || synchronizedHeatmapData.length === 0) return [];
    return [
      synchronizedHeatmapData.slice(0, 3),   // Halaman 1 (Q1): Jan, Feb, Mar
      synchronizedHeatmapData.slice(3, 6),   // Halaman 2 (Q2): Apr, Mei, Jun
      synchronizedHeatmapData.slice(6, 9),   // Halaman 3 (Q3): Jul, Agu, Sep
      synchronizedHeatmapData.slice(9, 12),  // Halaman 4 (Q4): Okt, Nov, Des
    ];
  }, [synchronizedHeatmapData]);

  // Ranking Kategori dengan total disamakan persis dengan Arus Kas Bersih
  const effectiveExpenseRanks = useMemo(() => {
    const grandTotal = summary.expense;
    let ranks: Array<{ id: string; name: string; icon: string | null; total: number; count: number; percent?: number }> =
      expenseRanks?.ranks ? [...expenseRanks.ranks] : [];

    if (ranks.length === 0 && txListData?.items) {
      const map = new Map<string, { id: string; name: string; icon: string | null; total: number; count: number }>();
      for (const item of txListData.items) {
        if (item.txType === "expense") {
          const catId = item.categoryId || "uncategorized";
          const catName = item.categoryName || "Lainnya";
          const cur = map.get(catId) || { id: catId, name: catName, icon: null, total: 0, count: 0 };
          cur.total += item.amount;
          cur.count += 1;
          map.set(catId, cur);
        }
      }
      ranks = Array.from(map.values()).sort((a, b) => b.total - a.total);
    }

    const formattedRanks = ranks.map((r) => ({
      ...r,
      percent: grandTotal > 0 ? Math.round((r.total / grandTotal) * 100) : 0,
    }));

    return { grandTotal, ranks: formattedRanks };
  }, [expenseRanks?.ranks, txListData?.items, summary.expense]);

  const effectiveIncomeRanks = useMemo(() => {
    const grandTotal = summary.income;
    let ranks: Array<{ id: string; name: string; icon: string | null; total: number; count: number; percent?: number }> =
      incomeRanks?.ranks ? [...incomeRanks.ranks] : [];

    if (ranks.length === 0 && txListData?.items) {
      const map = new Map<string, { id: string; name: string; icon: string | null; total: number; count: number }>();
      for (const item of txListData.items) {
        if (item.txType === "income") {
          const catId = item.categoryId || "uncategorized";
          const catName = item.categoryName || "Lainnya";
          const cur = map.get(catId) || { id: catId, name: catName, icon: null, total: 0, count: 0 };
          cur.total += item.amount;
          cur.count += 1;
          map.set(catId, cur);
        }
      }
      ranks = Array.from(map.values()).sort((a, b) => b.total - a.total);
    }

    const formattedRanks = ranks.map((r) => ({
      ...r,
      percent: grandTotal > 0 ? Math.round((r.total / grandTotal) * 100) : 0,
    }));

    return { grandTotal, ranks: formattedRanks };
  }, [incomeRanks?.ranks, txListData?.items, summary.income]);

  const recentDisplayList = useMemo(() => {
    if (txListData?.items && txListData.items.length > 0) {
      return txListData.items.slice(0, 5);
    }
    return [];
  }, [txListData?.items]);

  const handleRefreshAll = () => {
    refetchTxList();
    refetchHero();
    refetchExpense();
    refetchIncome();
    utils.analytics.invalidate();
    utils.transactions.invalidate();
  };

  const isAnyFilterActive =
    datePreset !== "this_month" ||
    !isCurrentMonthNow ||
    Boolean(customDateFrom) ||
    Boolean(customDateTo);

  return (
    <div className="flex flex-col gap-5 sm:gap-6 max-w-6xl mx-auto pb-4">
      {/* =========================================================================
          1. HERO PORTOFOLIO FINTECH: SALDO USER, CASHFLOW TERPADU & KURVA
      ========================================================================= */}
      <div className="relative overflow-hidden rounded-md border border-border/70 bg-card p-4 sm:p-5 shadow-2xs transition-all flex flex-col gap-4">
        {/* Latar Aksen Mint Halus di Pojok Kanan Atas */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-md bg-primary/5 blur-3xl pointer-events-none" />

        {/* Baris 1: Toolbar Periode & Pemilih Tanggal */}
        <div data-tour="date-filter" className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Preset Waktu Dropdown & Tombol Kalender Interaktif */}
            <div className="relative flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsMonthPickerOpen((prev) => !prev)}
                className={`h-8 w-8 rounded-md border flex items-center justify-center transition-all shadow-2xs ${
                  isMonthPickerOpen
                    ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 active:scale-95 cursor-pointer"
                }`}
                title="Buka Pemilih Bulan & Kalender Langsung"
                aria-label="Pilih Bulan Kalender"
              >
                <Calendar className="h-3.5 w-3.5" />
              </button>
              <select
                value={datePreset}
                onChange={(e) => {
                  setDatePreset(e.target.value as DateFilterPreset);
                  setIsMonthPickerOpen(false);
                }}
                className="h-8 rounded-md border border-border bg-card pl-2.5 pr-8 text-xs font-semibold shadow-2xs transition-all hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground"
              >
                <option value="this_month">Bulan Ini</option>
                <option value="today">Hari Ini</option>
                <option value="last_7_days">7 Hari Terakhir</option>
                <option value="last_30_days">30 Hari Terakhir</option>
                <option value="last_month">Bulan Lalu</option>
                <option value="this_year">Tahun Ini</option>
                <option value="all">Semua Waktu</option>
                <option value="custom">Kustom Tanggal</option>
              </select>

              {/* MonthYearPicker Dropdown saat preset BUKAN this_month tapi tombol kalender diklik */}
              {datePreset !== "this_month" && datePreset !== "this_year" && isMonthPickerOpen && (
                <MonthYearPicker
                  currentDate={currentMonth}
                  onSelectMonth={(newDate) => {
                    setCurrentMonth(newDate);
                    setDatePreset("this_month");
                  }}
                  isOpen={isMonthPickerOpen}
                  onClose={() => setIsMonthPickerOpen(false)}
                  align="left"
                />
              )}
            </div>

            {/* Navigasi Periode Bulan (saat Bulan Ini aktif) */}
            {datePreset === "this_month" && (
              <div className="relative flex items-center gap-1 rounded-md border border-input bg-background/80 px-1.5 py-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-sm text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={handlePrevPeriod}
                  title="Bulan sebelumnya"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>

                {/* Tombol Pemilih Bulan Langsung (Bisa langsung klik nama bulan!) */}
                <button
                  type="button"
                  onClick={() => setIsMonthPickerOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold capitalize rounded-sm hover:bg-primary/10 hover:text-primary transition-all text-foreground select-none group cursor-pointer"
                  title="Klik untuk memilih bulan secara langsung dari kalender"
                >
                  <CalendarDays className="h-3.5 w-3.5 text-primary group-hover:scale-105 transition-transform" />
                  <span className="min-w-[80px] text-center">{periodLabel}</span>
                  <ChevronDown className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                </button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-sm text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={handleNextPeriod}
                  title="Bulan berikutnya"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>

                {!isCurrentMonthNow && (
                  <button
                    onClick={handleResetPeriod}
                    className="px-2 py-0.5 text-[10px] font-bold text-primary hover:underline rounded-sm border-l border-border/60 pl-2 cursor-pointer"
                    title="Kembali ke bulan saat ini"
                  >
                    Bulan Ini
                  </button>
                )}

                {/* Popover Kalender Pemilih Bulan & Tahun */}
                <MonthYearPicker
                  currentDate={currentMonth}
                  onSelectMonth={(newDate) => {
                    setCurrentMonth(newDate);
                    setDatePreset("this_month");
                  }}
                  isOpen={isMonthPickerOpen}
                  onClose={() => setIsMonthPickerOpen(false)}
                  align="left"
                />
              </div>
            )}

            {/* Navigasi Tahun (saat Tahun Ini aktif) */}
            {datePreset === "this_year" && (
              <div className="relative flex items-center gap-1 rounded-md border border-input bg-background/80 px-1.5 py-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-sm text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear() - 1, 0, 1))}
                  title="Tahun sebelumnya"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <button
                  type="button"
                  onClick={() => setIsMonthPickerOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold rounded-sm hover:bg-primary/10 hover:text-primary transition-all text-foreground cursor-pointer"
                  title="Pilih tahun atau bulan langsung"
                >
                  <span>Tahun {currentMonth.getFullYear()}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-sm text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear() + 1, 0, 1))}
                  title="Tahun berikutnya"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>

                {currentMonth.getFullYear() !== new Date().getFullYear() && (
                  <button
                    onClick={() => setCurrentMonth(new Date())}
                    className="px-2 py-0.5 text-[10px] font-bold text-primary hover:underline rounded-sm border-l border-border/60 pl-2 cursor-pointer"
                    title="Kembali ke tahun sekarang"
                  >
                    Tahun Sekarang
                  </button>
                )}

                <MonthYearPicker
                  currentDate={currentMonth}
                  onSelectMonth={(newDate) => {
                    setCurrentMonth(newDate);
                    setDatePreset("this_month");
                  }}
                  isOpen={isMonthPickerOpen}
                  onClose={() => setIsMonthPickerOpen(false)}
                  align="left"
                />
              </div>
            )}

            {/* Custom Date Pickers */}
            {datePreset === "custom" && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="h-8 text-xs w-32 px-2.5 rounded-md"
                  placeholder="Dari"
                />
                <span className="text-muted-foreground text-[11px]">-</span>
                <Input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="h-8 text-xs w-32 px-2.5 rounded-md"
                  placeholder="Sampai"
                />
              </div>
            )}
          </div>

          {/* Tombol Perbarui & Reset Filter */}
          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefreshAll}
              className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
              title="Perbarui data overview"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>

            {isAnyFilterActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetAllFilters}
                className="h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 gap-1.5 px-2.5 rounded-md font-bold"
                title="Reset semua filter ke Bulan Ini"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Filter
              </Button>
            )}
          </div>
        </div>

        {/* Baris 2: TOTAL SALDO REKENING & Tombol Catat Transaksi */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-muted-foreground flex items-center gap-2">
              <GeometricIcon name="bank" size="xs" active />
              <span>{t.overview.netBalance.toUpperCase()}</span>
            </span>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-foreground tracking-tight">
              {isHeroLoading ? "..." : formatCurrency(totalUserBalance)}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <span>Akumulasi saldo seluruh rekening kas, bank, dan dompet digital</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-bold bg-secondary text-secondary-foreground border border-emerald-300 dark:border-emerald-800">
                {accountsList.length} Akun Aktif
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              data-tour="quick-add"
              onClick={openQuickAdd}
              className="rounded-md bg-primary hover:bg-[#047857] text-white font-bold gap-2 text-xs sm:text-sm px-4 py-2 shadow-xs active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4 stroke-[3px]" />
              {t.quickAdd.title}
            </Button>
          </div>
        </div>

        {/* Baris 3: LAYER TERPADU (CASH MASUK, CASH KELUAR, DAN SELISIH DIGABUNG) */}
        <div data-tour="overview-hero" className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-md bg-muted/30 border border-border">
          {/* 1. Cash Masuk */}
          <div className="flex flex-col justify-between p-3.5 rounded-sm bg-card border border-border/80 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <GeometricIcon name="trend-up" size="xs" active />
                <span>{t.overview.totalIncome}</span>
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground">{periodLabel}</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
              +{formatCurrency(summary.income)}
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5">Total penerimaan periode ini</span>
          </div>

          {/* 2. Cash Keluar */}
          <div className="flex flex-col justify-between p-3.5 rounded-sm bg-card border border-border/80 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <GeometricIcon name="trend-down" size="xs" active />
                <span>{t.overview.totalExpense}</span>
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground">{periodLabel}</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400">
              -{formatCurrency(summary.expense)}
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5">Total pengeluaran periode ini</span>
          </div>

          {/* 3. Selisih (Arus Kas Bersih) */}
          <div className="flex flex-col justify-between p-3.5 rounded-sm bg-card border border-border/80 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <GeometricIcon name="sparkles" size="xs" active />
                <span>{t.overview.netCashFlow}</span>
              </span>
              {summary.net > 0 && (
                <span className="px-2 py-0.5 rounded-sm text-[10px] font-bold bg-secondary text-secondary-foreground border border-emerald-300 dark:border-emerald-800">
                  Surplus
                </span>
              )}
              {summary.net < 0 && (
                <span className="px-2 py-0.5 rounded-sm text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                  Defisit
                </span>
              )}
              {summary.net === 0 && (
                <span className="px-2 py-0.5 rounded-sm text-[10px] font-bold bg-muted text-muted-foreground">
                  Seimbang
                </span>
              )}
            </div>
            <div
              className={`text-lg sm:text-xl font-black ${
                summary.net > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : summary.net < 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-foreground"
              }`}
            >
              {summary.net > 0 ? "+" : ""}
              {formatCurrency(summary.net)}
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5">
              {summary.net > 0 ? "Pemasukan melampaui pengeluaran" : summary.net < 0 ? "Pengeluaran melampaui pemasukan" : "Arus kas seimbang"}
            </span>
          </div>
        </div>

        {/* Baris 4: EKSPLORASI LAYOUT KURVA ARUS KAS (Kurva Luas, Bernapas, dan Berorientasi Visual Modern) */}
        <div data-tour="overview-sparkline" className="p-3.5 sm:p-4 rounded-md bg-muted/20 border border-border/50 flex flex-col gap-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">
                  Kurva Pergerakan Arus Kas
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-sm bg-background border border-border/60 text-muted-foreground">
                  {summary.count} Transaksi
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Fluktuasi akumulatif pemasukan dan pengeluaran sepanjang {periodLabel}
              </p>
            </div>

            {/* Chips Metrik Kurva */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-muted-foreground">
                Mulai: <strong className="text-foreground">Rp 0</strong>
              </span>
              <span
                className={`font-bold ${
                  summary.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}
              >
                Posisi Akhir: {summary.net > 0 ? "+" : ""}{formatCurrency(summary.net)}
              </span>
            </div>
          </div>

          {/* Area Kurva Responsive */}
          {sparklineData.length > 0 ? (
            <div className="h-44 sm:h-52 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="balanceGradPos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.38} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="balanceGradNeg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ba1a1a" stopOpacity={0.38} />
                      <stop offset="95%" stopColor="#ba1a1a" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    stroke="#888888"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => {
                      if (Math.abs(v) >= 1000000) return `${(v / 1000000).toFixed(1)}jt`;
                      if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}rb`;
                      return String(v);
                    }}
                  />
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(val), "Arus Kas Bersih"]}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.date || ""}
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      fontSize: "11px",
                      fontWeight: "600",
                      borderRadius: "4px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="running"
                    stroke={summary.net >= 0 ? "#059669" : "#ba1a1a"}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill={summary.net >= 0 ? "url(#balanceGradPos)" : "url(#balanceGradNeg)"}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-32 flex flex-col items-center justify-center text-xs text-muted-foreground border rounded-md border-dashed bg-background/50 gap-1">
              <span>Belum ada transaksi di periode {periodLabel}</span>
              <span className="text-[11px] text-muted-foreground/75">Klik Catat Transaksi atau Impor Transaksi untuk mengisi data</span>
            </div>
          )}
        </div>

        {/* Bang Peci Mascot Companion */}
        <div className="pt-2 border-t border-border/60">
          <OverviewMascotMood
            netCashflow={summary.net}
            income={summary.income}
            expense={summary.expense}
            periodLabel={periodLabel}
          />
        </div>
      </div>

      {/* =========================================================================
          1.5. CONTAINER PROMOSI & AKSES CEPAT IMPOR TRANSAKSI / E-STATEMENT
      ========================================================================= */}
      <div
        data-tour="overview-import-hub"
        className="relative overflow-hidden rounded-md border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-card to-card dark:from-emerald-950/20 dark:via-card dark:to-card p-4 sm:p-5 shadow-2xs"
      >
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 rounded-md bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex flex-col gap-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-bold bg-secondary text-secondary-foreground border border-emerald-300 dark:border-emerald-800">
                <GeometricIcon name="sparkles" size="xs" active />
                Impor Data
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight leading-snug">
              Impor Rekening &amp; File Transaksi
            </h2>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Tarik mutasi dari berkas bank (BCA, Mandiri, BRI, BNI), e-wallet, atau spreadsheet langsung ke pembukuan.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
              <span className="px-2 py-0.5 rounded-sm bg-background/80 border border-border text-foreground font-medium flex items-center gap-1.5 shadow-2xs">
                <GeometricIcon name="transactions" size="xs" active />
                Mutasi Rekening
              </span>
              <span className="px-2 py-0.5 rounded-sm bg-background/80 border border-border text-foreground font-medium flex items-center gap-1.5 shadow-2xs">
                <GeometricIcon name="ledgers" size="xs" active />
                Excel (.xlsx) &amp; CSV
              </span>
              <span className="px-2 py-0.5 rounded-sm bg-background/80 border border-border text-foreground font-medium flex items-center gap-1.5 shadow-2xs">
                <GeometricIcon name="ai" size="xs" active />
                Foto Struk Kasir
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-2 shrink-0">
            <Link href="/import">
              <Button className="rounded-md bg-primary hover:bg-[#047857] text-white font-bold text-xs sm:text-sm px-4 py-2 shadow-xs gap-2 active:scale-95 transition-all">
                <GeometricIcon name="import" size="xs" active />
                <span>Impor Berkas</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>

            <Link
              href="/import?tab=tutorial"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-background/60 border border-border"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Format file yang didukung</span>
              <ChevronRightIcon className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. STATISTIK RINGKAS KONSISTENSI (3 Kartu Metrik)
      ========================================================================= */}
      <div
        data-tour="overview-habit-stats"
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        <Card className="p-3.5 rounded-md border-border/80 flex items-center gap-3 shadow-2xs">
          <div className="h-9 w-9 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <GeometricIcon name="trend-down" size="xs" active />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground font-semibold truncate">
              Rata-rata Pengeluaran
            </div>
            <div className="text-base font-extrabold text-foreground truncate">
              {formatCurrency(habitStats.dailyAvg)} / hari
            </div>
          </div>
        </Card>

        <Card className="p-3.5 rounded-md border-border/80 flex items-center gap-3 shadow-2xs">
          <div className="h-9 w-9 rounded-md bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
            <GeometricIcon name="transactions" size="xs" active />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground font-semibold truncate">
              Frekuensi Pencatatan
            </div>
            <div className="text-base font-extrabold text-foreground truncate">
              {habitStats.txPerDay} transaksi / hari
            </div>
          </div>
        </Card>

        <Card className="p-3.5 rounded-md border-border/80 flex items-center gap-3 shadow-2xs">
          <Link
            href="/calendar"
            className="h-9 w-9 rounded-md bg-secondary text-secondary-foreground flex items-center justify-center shrink-0 hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer"
            title="Buka Kalender Transaksi Lengkap"
          >
            <GeometricIcon name="calendar" size="xs" active />
          </Link>
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground font-semibold truncate">
              Konsistensi Catatan
            </div>
            <div className="text-base font-extrabold text-foreground truncate">
              {habitStats.daysSinceFirst} Hari Berjalan
            </div>
          </div>
        </Card>
      </div>

      {/* =========================================================================
          3. ALOKASI ASET & GRAFIK AKUN KEUANGAN (Grafik Tampil Langsung di Page) & TREN ARUS KAS
      ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Kartu Alokasi & Grafik Rekening Finansial */}
        <Card className="p-4 sm:p-5 rounded-md border-border/70 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center text-secondary-foreground">
                  <GeometricIcon name="accounts" size="xs" active />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-foreground">Grafik &amp; Alokasi Akun</h3>
                  <p className="text-[11px] text-muted-foreground">Komposisi visual &amp; rincian saldo rekening</p>
                </div>
              </div>
              <Link
                href="/accounts"
                className="text-xs text-primary hover:underline font-bold flex items-center gap-1"
                title="Buka halaman pengelolaan rekening"
              >
                Kelola Akun <ChevronRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Donut Chart Visualisasi Komposisi Akun Langsung di Halaman */}
            {accountChartData.length > 0 && (
              <div className="mb-3.5 p-3 rounded-md bg-muted/20 border border-border/50">
                <div className="h-44 sm:h-48 w-full flex items-center justify-center relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Tooltip
                        formatter={(value: any, name: any) => [
                          formatCurrency(Number(value)),
                          name,
                        ]}
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          borderColor: "var(--border)",
                          fontSize: "11px",
                          fontWeight: "600",
                          borderRadius: "4px",
                        }}
                      />
                      <Pie
                        data={accountChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={46}
                        outerRadius={68}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {accountChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            stroke="transparent"
                          />
                        ))}
                      </Pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>

                  {/* Label Total Saldo di Tengah Donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      Total Saldo
                    </span>
                    <span className="text-xs sm:text-sm font-black text-foreground">
                      {formatCurrency(totalUserBalance)}
                    </span>
                    <span className="text-[10px] font-semibold text-primary">
                      {accountChartData.length} Akun
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Daftar Akun & Persentase */}
            <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto pr-1">
              {assetData?.items?.map((acc, idx) => {
                const color = PIE_COLORS[idx % PIE_COLORS.length];

                return (
                  <Link
                    key={acc.id}
                    href="/accounts"
                    className="group flex flex-col gap-1.5 p-2 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-bold text-foreground">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <div className="h-6 w-6 rounded-md bg-secondary flex items-center justify-center shrink-0">
                          <GeometricIcon name="accounts" size="xs" active />
                        </div>
                        <span className="capitalize">{acc.name}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          ({acc.group})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-foreground">
                          {formatCurrency(acc.balance, acc.currency)}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-secondary text-primary">
                          {acc.percent}%
                        </span>
                        <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${acc.percent}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </Link>
                );
              })}

              {(!assetData?.items || assetData.items.length === 0) && (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Belum ada akun keuangan terdaftar.
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Tren Arus Kas Bulanan */}
        <Card className="p-4 sm:p-5 rounded-md border-border/70 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center text-secondary-foreground">
                  <GeometricIcon name="annual-report" size="xs" active />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-foreground">Tren Arus Kas (6 Bulan)</h3>
                  <p className="text-[11px] text-muted-foreground">Perbandingan pemasukan &amp; pengeluaran</p>
                </div>
              </div>
              <Link href="/analytics" className="text-xs text-primary hover:underline font-bold">
                Detail
              </Link>
            </div>

            <div className="h-56 sm:h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={synchronizedTrendData}>
                  <XAxis dataKey="label" fontSize={11} stroke="#888888" />
                  <YAxis
                    fontSize={10}
                    stroke="#888888"
                    tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const inc = (payload.find((p) => p.dataKey === "income")?.value as number) || 0;
                      const exp = (payload.find((p) => p.dataKey === "expense")?.value as number) || 0;
                      const net = inc - exp;
                      return (
                        <div className="rounded-md border border-border bg-card p-2.5 shadow-md text-xs flex flex-col gap-1 min-w-[150px]">
                          <div className="font-extrabold text-foreground pb-1 border-b border-border/60">
                            {label}
                          </div>
                          <div className="flex items-center justify-between gap-3 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <span>Masuk:</span>
                            <span>+{formatCurrency(inc)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3 text-rose-600 dark:text-rose-400 font-semibold">
                            <span>Keluar:</span>
                            <span>-{formatCurrency(exp)}</span>
                          </div>
                          <div
                            className={`flex items-center justify-between gap-3 font-extrabold pt-1 border-t border-border/60 ${
                              net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            <span>Arus Kas Bersih:</span>
                            <span>
                              {net > 0 ? "+" : ""}
                              {formatCurrency(net)}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="income" name="Pemasukan" fill="#059669" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Pengeluaran" fill="#ba1a1a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>

      {/* =========================================================================
          4. TRANSAKSI TERBARU (Mobile Feed Card)
      ========================================================================= */}
      <Card className="p-4 sm:p-5 rounded-md border-border/70 shadow-2xs">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center text-secondary-foreground">
              <GeometricIcon name="transactions" size="xs" active />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-foreground">Transaksi Terakhir</h3>
              <p className="text-[11px] text-muted-foreground">Catatan keuangan paling baru</p>
            </div>
          </div>
          <Link
            href="/transactions"
            className="text-xs text-primary hover:underline font-bold flex items-center gap-1"
          >
            Lihat Semua <ChevronRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-border/60">
          {recentDisplayList.map((tx: any) => {
            const isExpense = tx.txType === "expense";
            const isIncome = tx.txType === "income";

            return (
              <div
                key={tx.id}
                className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-muted/30 px-2 rounded-md transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${
                      isIncome
                        ? "bg-secondary text-secondary-foreground"
                        : isExpense
                        ? "bg-rose-500/10 text-rose-600"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {isIncome && <GeometricIcon name="trend-up" size="xs" active />}
                    {isExpense && <GeometricIcon name="trend-down" size="xs" active />}
                    {!isIncome && !isExpense && <GeometricIcon name="accounts" size="xs" active />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-foreground truncate">
                      {tx.categoryName || tx.note || "Transaksi Umum"}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                      <span>{formatDate(tx.happenedAt)}</span>
                      <span>•</span>
                      <span className="capitalize">{tx.accountName || "Kas"}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div
                    className={`font-black text-sm ${
                      isIncome
                        ? "text-emerald-600 dark:text-emerald-400"
                        : isExpense
                        ? "text-foreground"
                        : "text-blue-600"
                    }`}
                  >
                    {isIncome ? "+" : isExpense ? "-" : ""}
                    {formatCurrency(tx.amount, tx.currency)}
                  </div>
                  {tx.note && tx.categoryName && (
                    <div className="text-[10px] text-muted-foreground truncate max-w-36">
                      {tx.note}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {recentDisplayList.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Belum ada transaksi tercatat di periode <strong>{periodLabel}</strong>. Klik <strong>+ Catat Transaksi</strong> untuk memulai.
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          4.5. HEATMAP AKTIVITAS BULANAN (Data yearHeatmap)
          Redesign: Konsep Simple, Ringan, User-Friendly & Clean Card Spacing (Inspirasi Job Board Grid)
      ========================================================================= */}
      {/* =========================================================================
          4.5. HEATMAP AKTIVITAS BULANAN (Data yearHeatmap)
          Carousel 4 Halaman (3 Bulan per Halaman) • Simple, Ringan, User-Friendly
      ========================================================================= */}
      {heatmapData && heatmapData.length > 0 && (
        <Card data-tour="overview-heatmap" className="mt-6 sm:mt-8 p-4 sm:p-6 rounded-md border-border/70 shadow-2xs bg-card">
          {/* Header Section dengan Navigasi Carousel & Kuartal */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <Link
                href="/calendar"
                className="h-8 w-8 rounded-md bg-secondary hover:bg-primary/20 hover:border-primary flex items-center justify-center text-secondary-foreground hover:text-primary shrink-0 border border-emerald-300 dark:border-emerald-800 transition-all cursor-pointer group shadow-2xs"
                title="Buka Kalender Transaksi Lengkap (Klik untuk membuka)"
              >
                <GeometricIcon name="calendar" size="xs" active />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
                    Aktivitas Bulanan {currentMonth.getFullYear()}
                  </h3>
                  {/* Pemilih Tahun Cepat */}
                  <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-md border border-border/40">
                    <button
                      type="button"
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth(), 1))}
                      className="h-5 w-5 rounded-xs flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors"
                      title="Tahun sebelumnya"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                    <span className="text-[10px] font-extrabold px-1 text-foreground">
                      {currentMonth.getFullYear()}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear() + 1, currentMonth.getMonth(), 1))}
                      className="h-5 w-5 rounded-xs flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors"
                      title="Tahun berikutnya"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-secondary text-secondary-foreground">
                    Hal {heatmapPage + 1} / 4
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {quarterMetadata[heatmapPage]?.title} ({quarterMetadata[heatmapPage]?.range}) • Pilih bulan langsung di bawah atau geser carousel
                </p>
              </div>
            </div>

            {/* Quick Quarter Pills + Arrow Controls + Kalender Link */}
            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
              {/* Quarter Pills */}
              <div className="flex items-center gap-1 p-0.5 rounded-md bg-muted/60 border border-border/50">
                {quarterMetadata.map((q) => (
                  <button
                    key={q.page}
                    type="button"
                    onClick={() => setHeatmapPage(q.page)}
                    className={`px-3 py-1 text-xs font-bold rounded-sm transition-all ${
                      heatmapPage === q.page
                        ? "bg-primary text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                    }`}
                    title={`Buka ${q.title} (${q.range})`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>

              {/* Prev / Next Buttons */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  onClick={() => setHeatmapPage((prev) => (prev > 0 ? prev - 1 : 3))}
                  className="h-7 w-7 rounded-md border-border/70 hover:border-primary/50 hover:text-primary hover:bg-primary/5 active:scale-95 transition-all"
                  title="Halaman sebelumnya"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  onClick={() => setHeatmapPage((prev) => (prev < 3 ? prev + 1 : 0))}
                  className="h-7 w-7 rounded-md border-border/70 hover:border-primary/50 hover:text-primary hover:bg-primary/5 active:scale-95 transition-all"
                  title="Halaman berikutnya"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Tombol Akses Kalender Transaksi */}
              <Link
                href="/calendar"
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-border/70 bg-card hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-all text-muted-foreground"
                title="Buka Halaman Kalender Transaksi Lengkap"
              >
                <Calendar className="h-3 w-3 text-primary" />
                <span>Kalender Harian</span>
              </Link>
            </div>
          </div>

          {/* Baris Pemilih 12 Bulan Langsung (Direct Month Selector - Tidak Perlu Geser) */}
          <div className="flex items-center justify-between gap-1.5 mb-3 px-2 py-1.5 rounded-md bg-muted/30 border border-border/50 overflow-x-auto text-xs">
            <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap flex items-center gap-1 shrink-0">
              <Calendar className="h-3 w-3 text-primary" />
              Pilih Langsung:
            </span>
            <div className="flex items-center gap-1 overflow-x-auto py-0.5 flex-1 justify-start sm:justify-center">
              {MONTHS_ID.map((m) => {
                const isSelected =
                  datePreset === "this_month" &&
                  currentMonth.getMonth() === m.index;
                const isRealCurrentMonth =
                  new Date().getFullYear() === currentMonth.getFullYear() &&
                  new Date().getMonth() === m.index;

                return (
                  <button
                    key={m.index}
                    type="button"
                    onClick={() => {
                      setCurrentMonth(new Date(currentMonth.getFullYear(), m.index, 1));
                      setDatePreset("this_month");
                      setHeatmapPage(Math.floor(m.index / 3));
                    }}
                    className={`relative px-2 py-1 text-[11px] font-bold rounded-sm transition-all whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? "bg-primary text-white shadow-xs ring-1 ring-primary/40"
                        : isRealCurrentMonth
                        ? "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                    }`}
                    title={`Pilih ${m.name} ${currentMonth.getFullYear()}`}
                  >
                    {m.short}
                    {isRealCurrentMonth && !isSelected && (
                      <span className="inline-block ml-0.5 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Track Carousel 4 Halaman (Slider) */}
          <div
            className="overflow-hidden w-full select-none"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${heatmapPage * 100}%)` }}
            >
              {heatmapPages.map((pageMonths, pIdx) => (
                <div key={pIdx} className="w-full shrink-0 px-0.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                    {pageMonths.map((m) => {
                      const net = m.income - m.expense;
                      const isSelectedMonth =
                        datePreset === "this_month" &&
                        currentMonth.getMonth() === m.monthIndex;

                      const fullMonthName = new Intl.DateTimeFormat("id-ID", { month: "long" }).format(
                        new Date(currentMonth.getFullYear(), m.monthIndex, 1)
                      );

                      return (
                        <div
                          key={m.monthIndex}
                          onClick={() => {
                            setCurrentMonth(new Date(currentMonth.getFullYear(), m.monthIndex, 1));
                            setDatePreset("this_month");
                          }}
                          className={`relative overflow-hidden flex flex-col justify-between p-3.5 sm:p-4 rounded-md border transition-all duration-200 cursor-pointer text-left group shadow-2xs h-full min-h-[160px] ${
                            isSelectedMonth
                              ? "border-primary bg-primary/[0.04] ring-1 ring-primary/40 shadow-xs"
                              : "border-border/70 bg-card hover:bg-primary/[0.015] hover:border-primary/40"
                          }`}
                          title={`Klik untuk memfilter tampilan ke ${fullMonthName}`}
                        >
                          {/* Top Line Indicator saat bulan aktif / dibuka */}
                          <div
                            className={`absolute top-0 left-0 right-0 h-0.5 transition-all duration-300 ${
                              isSelectedMonth
                                ? "bg-primary"
                                : "bg-transparent group-hover:bg-primary/25"
                            }`}
                          />

                          {/* Top Bar: Nama Bulan & Status Badge (Surplus / Defisit / Seimbang / Kosong) */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-extrabold text-foreground tracking-tight group-hover:text-primary transition-colors truncate">
                                {fullMonthName}
                              </div>
                              <div className="text-[10px] font-medium text-muted-foreground mt-0.5 truncate">
                                Tahun {currentMonth.getFullYear()} • {m.txCount} transaksi
                              </div>
                            </div>

                            {/* Status Badge Keuangan */}
                            {m.txCount === 0 ? (
                              <span className="px-2.5 py-0.5 rounded-sm text-[10px] font-medium bg-muted/60 text-muted-foreground border border-border/40 shrink-0">
                                Kosong
                              </span>
                            ) : net > 0 ? (
                              <span className="px-2 py-0.5 rounded-sm text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                                Surplus
                              </span>
                            ) : net < 0 ? (
                              <span className="px-2 py-0.5 rounded-sm text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 shrink-0">
                                Defisit
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 shrink-0">
                                Seimbang
                              </span>
                            )}
                          </div>

                          {/* Middle Content: Tag Masuk & Keluar */}
                          <div className="my-2.5 grid grid-cols-2 gap-2">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 min-w-0">
                              <TrendingUp className="h-3 w-3 shrink-0" />
                              <span className="truncate">+{formatCurrency(m.income)}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-sm bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 min-w-0">
                              <TrendingDown className="h-3 w-3 shrink-0" />
                              <span className="truncate">-{formatCurrency(m.expense)}</span>
                            </span>
                          </div>

                          {/* Bottom Row: Arus Kas Bersih */}
                          <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2 mt-auto">
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                              Arus Kas Bersih
                            </span>
                            <span
                              className={`text-xs sm:text-sm font-extrabold tracking-tight ${
                                net > 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : net < 0
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-foreground"
                              }`}
                            >
                              {net > 0 ? "+" : ""}
                              {formatCurrency(net)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Carousel: Indicator Dots & Page Quick Navigation */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t border-border/60 text-xs">
            <div className="text-muted-foreground font-medium text-center sm:text-left text-[11px]">
              Menampilkan <span className="text-foreground font-bold">Halaman {heatmapPage + 1} dari 4</span> ({quarterMetadata[heatmapPage]?.range})
            </div>

            {/* Interactive Carousel Dots */}
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3].map((idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setHeatmapPage(idx)}
                  className={`transition-all duration-200 rounded-xs ${
                    heatmapPage === idx
                      ? "w-6 h-2 bg-primary"
                      : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                  }`}
                  title={`Ke Halaman ${idx + 1} (${quarterMetadata[idx]?.label})`}
                  aria-label={`Halaman ${idx + 1}`}
                />
              ))}
            </div>

            {/* Total Transaksi Info */}
            <div className="text-muted-foreground font-medium text-center sm:text-right text-[11px]">
              Total <strong className="text-foreground">{heatmapData.reduce((acc, m) => acc + m.txCount, 0)}</strong> transaksi tahun {currentMonth.getFullYear()}
            </div>
          </div>
        </Card>
      )}

      {/* =========================================================================
          5. RANKING KATEGORI (Pengeluaran vs Pemasukan)
      ========================================================================= */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
            <GeometricIcon name="categories" size="xs" active />
            Kategori Terbanyak
          </h3>

          <div className="text-xs text-muted-foreground font-semibold">
            Rentang: <strong className="text-foreground font-bold">{periodLabel}</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Pengeluaran */}
          <Card data-tour="overview-expense-ranks" className="p-4 sm:p-5 rounded-md border-border/80 shadow-2xs">
            <div className="flex items-center justify-between mb-3 border-b border-border/60 pb-2">
              <span className="font-extrabold text-xs uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
                <GeometricIcon name="trend-down" size="xs" active /> Pengeluaran Teratas
              </span>
              <span className="text-xs font-bold text-foreground">
                Total: {formatCurrency(effectiveExpenseRanks?.grandTotal || 0)}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {effectiveExpenseRanks?.ranks?.slice(0, 5).map((rank, idx) => (
                <button
                  key={rank.id}
                  type="button"
                  onClick={() =>
                    setSelectedCategory({
                      id: rank.id,
                      name: rank.name,
                      icon: rank.icon,
                      kind: "expense",
                      total: rank.total,
                      percent: rank.percent,
                    })
                  }
                  className="flex flex-col gap-1 text-xs text-left p-2 rounded-md hover:bg-muted/50 transition-all cursor-pointer group"
                  title={`Klik untuk melihat detail transaksi kategori ${rank.name}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground group-hover:text-rose-600 transition-colors flex items-center gap-1.5">
                      #{idx + 1} {rank.name}
                      <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </span>
                    <span className="font-extrabold text-foreground flex items-center">
                      {formatCurrency(rank.total)}
                      <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-sm bg-rose-500/10 text-rose-600 dark:text-rose-400 ml-1.5">
                        {rank.percent}%
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-rose-500 group-hover:bg-rose-600 transition-colors"
                      style={{ width: `${rank.percent}%` }}
                    />
                  </div>
                </button>
              ))}

              {(!effectiveExpenseRanks?.ranks || effectiveExpenseRanks.ranks.length === 0) && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Belum ada pengeluaran di cakupan ini.
                </div>
              )}
            </div>
          </Card>

          {/* Top Pemasukan */}
          <Card className="p-4 sm:p-5 rounded-md border-border/80 shadow-2xs">
            <div className="flex items-center justify-between mb-3 border-b border-border/60 pb-2">
              <span className="font-extrabold text-xs uppercase tracking-wider text-primary flex items-center gap-1.5">
                <GeometricIcon name="trend-up" size="xs" active /> Pemasukan Teratas
              </span>
              <span className="text-xs font-bold text-foreground">
                Total: {formatCurrency(effectiveIncomeRanks?.grandTotal || 0)}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {effectiveIncomeRanks?.ranks?.slice(0, 5).map((rank, idx) => (
                <button
                  key={rank.id}
                  type="button"
                  onClick={() =>
                    setSelectedCategory({
                      id: rank.id,
                      name: rank.name,
                      icon: rank.icon,
                      kind: "income",
                      total: rank.total,
                      percent: rank.percent,
                    })
                  }
                  className="flex flex-col gap-1 text-xs text-left p-2 rounded-md hover:bg-muted/50 transition-all cursor-pointer group"
                  title={`Klik untuk melihat detail transaksi kategori ${rank.name}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                      #{idx + 1} {rank.name}
                      <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </span>
                    <span className="font-extrabold text-foreground flex items-center">
                      {formatCurrency(rank.total)}
                      <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ml-1.5">
                        {rank.percent}%
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary group-hover:bg-primary/90 transition-colors"
                      style={{ width: `${rank.percent}%` }}
                    />
                  </div>
                </button>
              ))}

              {(!effectiveIncomeRanks?.ranks || effectiveIncomeRanks.ranks.length === 0) && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Belum ada pemasukan di cakupan ini.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Modal Detail Kategori (Filtered by Selected Period) */}
      <CategoryDetailModal
        isOpen={!!selectedCategory}
        onClose={() => setSelectedCategory(null)}
        category={selectedCategory}
        periodLabel={periodLabel}
        dateFrom={dateFrom || ""}
        dateTo={dateTo || ""}
      />

      {/* Modal Panduan & Tutorial Impor CSV */}
      <CsvImportTutorialModal
        isOpen={isCsvTutorialOpen}
        onClose={() => setIsCsvTutorialOpen(false)}
      />
    </div>
  );
}
