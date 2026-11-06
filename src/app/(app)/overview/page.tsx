/* Hallmark · macrostructure: Stat-Led · theme: Bibit-Fintech · genre: modern-minimal · pre-emit critique: P5 H5 E5 S5 R5 V5 */
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { useTranslation } from "@/i18n";
import { DateFilterPreset, computeDateRange } from "@/lib/date-filters";
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
import { MascotRoamingStage } from "@/components/mascot/MascotRoamingStage";
import { CatHouseBed } from "@/components/mascot/CatHouseBed";
import { useMascotStore } from "@/store/mascot.store";
import { MonthYearPicker, MONTHS_ID, MONTHS_EN } from "@/components/ui/MonthYearPicker";
import { QuickActionRow } from "@/components/overview/QuickActionRow";
import { MilestoneTrackingCard } from "@/components/milestones/MilestoneTrackingCard";
import {
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
  const { isSleeping, setIsSleeping } = useMascotStore();
  const utils = trpc.useUtils();
  const { t, formatCurrency, formatDate, locale } = useTranslation();
  const isEn = locale === "en";

  // Date Filter state - Disamakan dengan Transactions Page
  const [datePreset, setDatePreset] = useState<DateFilterPreset>("this_month");
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [customDateFrom, setCustomDateFrom] = useState<string>("");
  const [customDateTo, setCustomDateTo] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryDetailTarget | null>(null);
  const [isCsvTutorialOpen, setIsCsvTutorialOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  // Perhitungan rentang tanggal dan label periode
  const { dateFrom, dateTo, periodLabel } = useMemo(() => {
    return computeDateRange(datePreset, currentMonth, customDateFrom, customDateTo, locale);
  }, [datePreset, currentMonth, customDateFrom, customDateTo, locale]);

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
          const catName = item.categoryName || (isEn ? "Others" : "Lainnya");
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
          const catName = item.categoryName || (isEn ? "Others" : "Lainnya");
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
    utils.milestones.invalidate();
  };

  const isAnyFilterActive =
    datePreset !== "this_month" ||
    !isCurrentMonthNow ||
    Boolean(customDateFrom) ||
    Boolean(customDateTo);

  return (
    <div className="flex flex-col gap-5 sm:gap-6 max-w-6xl mx-auto pb-4 relative min-h-screen">
      {/* 2D Autonomous Roaming Mascot (Bang Peci Petualang) */}
      <MascotRoamingStage
        financialStatus={summary.net > 0 ? "surplus" : summary.net < 0 ? "critical" : "warning"}
        netCashflow={summary.net}
        income={summary.income}
        expense={summary.expense}
      />
      {/* =========================================================================
          1. HERO PORTOFOLIO FINTECH: SALDO USER, CASHFLOW TERPADU & KURVA
      ========================================================================= */}
      {/* =========================================================================
          1. TOOLBAR FILTER PERIODE & PEMILIH KALENDER TERATAS
      ========================================================================= */}
      <div
        data-tour="date-filter"
        className="rounded-2xl border border-border/80 bg-card p-2.5 sm:p-3 shadow-2xs flex items-center justify-between gap-1.5 sm:gap-3 text-xs w-full overflow-x-auto no-scrollbar"
      >
        {/* Sisi Kiri: Navigasi Periode / Pemilih Bulan & Tahun */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Jika mode Bulan Ini aktif */}
          {datePreset === "this_month" && (
            <div
              data-tour="month-filter"
              className="relative flex items-center gap-0.5 sm:gap-1 rounded-md border border-input bg-background/90 px-1 py-0.5 shadow-2xs"
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-6 sm:w-6 rounded-sm text-muted-foreground hover:text-foreground cursor-pointer active:scale-95"
                onClick={handlePrevPeriod}
                title={isEn ? "Previous month" : "Bulan sebelumnya"}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>

              <button
                type="button"
                onClick={() => setIsMonthPickerOpen((prev) => !prev)}
                className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 text-xs font-bold capitalize rounded-sm hover:bg-primary/10 hover:text-primary transition-all text-foreground select-none group cursor-pointer active:scale-95"
                title={isEn ? "Click to pick a month directly from calendar" : "Klik untuk memilih bulan secara langsung dari kalender"}
              >
                <Calendar className="h-3.5 w-3.5 text-primary group-hover:scale-105 transition-transform shrink-0" />
                <span className="whitespace-nowrap font-bold">{periodLabel}</span>
                <ChevronDown className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-6 sm:w-6 rounded-sm text-muted-foreground hover:text-foreground cursor-pointer active:scale-95"
                onClick={handleNextPeriod}
                title={isEn ? "Next month" : "Bulan berikutnya"}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>

              {!isCurrentMonthNow && (
                <button
                  onClick={handleResetPeriod}
                  className="hidden xs:inline-block px-1.5 py-0.5 text-[10px] font-bold text-primary hover:underline rounded-sm border-l border-border/60 pl-1.5 cursor-pointer whitespace-nowrap"
                  title={isEn ? "Back to current month" : "Kembali ke bulan saat ini"}
                >
                  {t.dateFilter.thisMonth}
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

          {/* Jika mode Tahun Ini aktif */}
          {datePreset === "this_year" && (
            <div className="relative flex items-center gap-0.5 sm:gap-1 rounded-md border border-input bg-background/80 px-1 py-0.5 shadow-2xs">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-6 sm:w-6 rounded-sm text-muted-foreground hover:text-foreground cursor-pointer active:scale-95"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear() - 1, 0, 1))}
                title={isEn ? "Previous year" : "Tahun sebelumnya"}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>

              <button
                type="button"
                onClick={() => setIsMonthPickerOpen((prev) => !prev)}
                className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 text-xs font-bold rounded-sm hover:bg-primary/10 hover:text-primary transition-all text-foreground cursor-pointer active:scale-95 whitespace-nowrap"
                title={isEn ? "Choose year or month directly" : "Pilih tahun atau bulan langsung"}
              >
                <span>{isEn ? `Year ${currentMonth.getFullYear()}` : `Tahun ${currentMonth.getFullYear()}`}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-6 sm:w-6 rounded-sm text-muted-foreground hover:text-foreground cursor-pointer active:scale-95"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear() + 1, 0, 1))}
                title={isEn ? "Next year" : "Tahun berikutnya"}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>

              {currentMonth.getFullYear() !== new Date().getFullYear() && (
                <button
                  onClick={() => setCurrentMonth(new Date())}
                  className="hidden xs:inline-block px-1.5 py-0.5 text-[10px] font-bold text-primary hover:underline rounded-sm border-l border-border/60 pl-1.5 cursor-pointer whitespace-nowrap"
                  title={isEn ? "Back to current year" : "Kembali ke tahun sekarang"}
                >
                  {t.dateFilter.thisYear}
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
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                className="h-8 text-xs w-28 xs:w-32 px-2 rounded-md"
                placeholder={isEn ? "From" : "Dari"}
              />
              <span className="text-muted-foreground text-[11px]">-</span>
              <Input
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
                className="h-8 text-xs w-28 xs:w-32 px-2 rounded-md"
                placeholder={isEn ? "To" : "Sampai"}
              />
            </div>
          )}

          {/* Tombol Kalender Popover saat preset selain this_month & this_year */}
          {datePreset !== "this_month" && datePreset !== "this_year" && datePreset !== "custom" && (
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => setIsMonthPickerOpen((prev) => !prev)}
                className={`h-8 px-2.5 rounded-md border flex items-center gap-1.5 transition-all shadow-2xs text-xs font-semibold ${
                  isMonthPickerOpen
                    ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 active:scale-95 cursor-pointer"
                }`}
                title={isEn ? "Open Direct Month & Calendar Picker" : "Buka Pemilih Bulan & Kalender Langsung"}
              >
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span className="hidden xs:inline">{periodLabel}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>

              {isMonthPickerOpen && (
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
          )}
        </div>

        {/* Sisi Kanan: Preset Filter Dropdown & Tombol Refresh / Reset */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto">
          {/* Preset Dropdown */}
          <select
            value={datePreset}
            onChange={(e) => {
              setDatePreset(e.target.value as DateFilterPreset);
              setIsMonthPickerOpen(false);
            }}
            className="h-8 max-w-[95px] xs:max-w-[115px] sm:max-w-none rounded-md border border-border bg-card pl-2 pr-7 text-xs font-bold text-foreground shadow-2xs transition-all hover:border-primary/40 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary truncate"
          >
            <option value="this_month">{t.dateFilter.thisMonth}</option>
            <option value="today">{t.dateFilter.today}</option>
            <option value="last_7_days">{t.dateFilter.last7Days}</option>
            <option value="last_30_days">{t.dateFilter.last30Days}</option>
            <option value="last_month">{t.dateFilter.lastMonth}</option>
            <option value="this_year">{t.dateFilter.thisYear}</option>
            <option value="all">{t.dateFilter.allTime}</option>
            <option value="custom">{t.dateFilter.custom}</option>
          </select>

          {/* Tombol Perbarui */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefreshAll}
            className="h-8 w-8 rounded-md border border-border/80 bg-card text-muted-foreground hover:text-foreground shrink-0 shadow-2xs active:scale-95 cursor-pointer"
            title={isEn ? "Refresh overview data" : "Perbarui data overview"}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>

          {/* Tombol Reset Filter */}
          {isAnyFilterActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetAllFilters}
              className="h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 gap-1 px-2 rounded-md font-bold shrink-0 border border-rose-500/25 shadow-2xs cursor-pointer active:scale-95"
              title={isEn ? "Reset filter to This Month" : "Reset filter ke Bulan Ini"}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          )}
        </div>
      </div>

      {/* =========================================================================
          2. ALL-IN-ONE MASTER HERO CARD: TOTAL SALDO & ARUS KAS TERPADU (Option 2)
      ========================================================================= */}
      <div
        data-tour="overview-hero"
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-border/80 bg-card p-4 sm:p-6 shadow-2xs transition-all flex flex-col gap-4 sm:gap-5"
      >
        {/* Subtle accent mint background glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

        {/* Section Atas: Total Saldo User */}
        <div
          data-walker-target="saldo"
          id="walker-target-saldo"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <GeometricIcon name="bank" size="xs" active />
                <span>{t.overview.netBalance}</span>
              </span>
            </div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-foreground tracking-tight">
              {isHeroLoading ? "..." : formatCurrency(totalUserBalance)}
            </div>
          </div>

          {/* Status Badge Arus Kas Periode */}
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 self-start sm:self-center transition-all ${
                summary.net > 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : summary.net < 0
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                  : "bg-muted text-muted-foreground border border-border"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  summary.net > 0
                    ? "bg-emerald-500 animate-pulse"
                    : summary.net < 0
                    ? "bg-rose-500 animate-pulse"
                    : "bg-muted-foreground"
                }`}
              />
              <span>
                {summary.net > 0
                  ? (isEn ? "Surplus Cash Flow" : "Arus Kas Surplus")
                  : summary.net < 0
                  ? (isEn ? "Deficit Cash Flow" : "Arus Kas Defisit")
                  : (isEn ? "Balanced Cash Flow" : "Arus Kas Seimbang")}
              </span>
            </span>
          </div>
        </div>

        {/* Divider Halus */}
        <div className="border-t border-border/60 relative z-10" />

        {/* Section Bawah: 3 Pilar Arus Kas Sejajar (Pemasukan, Pengeluaran, Selisih) */}
        <div className="grid grid-cols-3 divide-x divide-border/60 relative z-10">
          {/* 1. Cash Masuk */}
          <div
            data-walker-target="income"
            id="walker-target-income"
            className="flex flex-col pr-2 xs:pr-3 sm:pr-4"
          >
            <div className="flex items-center gap-1 sm:gap-1.5 mb-1 text-muted-foreground">
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <GeometricIcon name="trend-up" size="xs" active />
              </div>
              <span className="text-[10px] xs:text-[11px] sm:text-xs font-semibold truncate">
                {t.overview.totalIncome}
              </span>
            </div>
            <div
              className="text-xs xs:text-sm sm:text-lg font-black text-emerald-600 dark:text-emerald-400 truncate"
              title={`+${formatCurrency(summary.income)}`}
            >
              +{formatCurrency(summary.income)}
            </div>
          </div>

          {/* 2. Cash Keluar */}
          <div
            data-walker-target="expense"
            id="walker-target-expense"
            className="flex flex-col px-2 xs:px-3 sm:px-4"
          >
            <div className="flex items-center gap-1 sm:gap-1.5 mb-1 text-muted-foreground">
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
                <GeometricIcon name="trend-down" size="xs" active />
              </div>
              <span className="text-[10px] xs:text-[11px] sm:text-xs font-semibold truncate">
                {t.overview.totalExpense}
              </span>
            </div>
            <div
              className="text-xs xs:text-sm sm:text-lg font-black text-rose-600 dark:text-rose-400 truncate"
              title={`-${formatCurrency(summary.expense)}`}
            >
              -{formatCurrency(summary.expense)}
            </div>
          </div>

          {/* 3. Selisih (Arus Kas Bersih) */}
          <div
            data-walker-target="cashflow"
            id="walker-target-cashflow"
            className="flex flex-col pl-2 xs:pl-3 sm:pl-4"
          >
            <div className="flex items-center gap-1 sm:gap-1.5 mb-1 text-muted-foreground">
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <GeometricIcon name="sparkles" size="xs" active />
              </div>
              <span className="text-[10px] xs:text-[11px] sm:text-xs font-semibold truncate">
                {t.overview.netCashFlow}
              </span>
            </div>
            <div
              className={`text-xs xs:text-sm sm:text-lg font-black truncate ${
                summary.net > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : summary.net < 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-foreground"
              }`}
              title={`${summary.net > 0 ? "+" : ""}${formatCurrency(summary.net)}`}
            >
              {summary.net > 0 ? "+" : ""}
              {formatCurrency(summary.net)}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3.5. BARIS AKSI CEPAT / SHORTCUTS (Quick Action Row)
      ========================================================================= */}
      <QuickActionRow />

      {/* =========================================================================
          3.6. TARGET & MILESTONE TRACKING PENGELUARAN (Milestone Tracking Card)
      ========================================================================= */}
      <MilestoneTrackingCard />

      {/* =========================================================================
          PONDOK NYAMAN & KASUR BULAT BANG PECI (Cat House & Donut Bed)
      ========================================================================= */}
      <CatHouseBed
        isSleeping={isSleeping}
        onWakeUp={() => setIsSleeping(false)}
        onSleep={() => setIsSleeping(true)}
      />

      {/* =========================================================================
          4. CAROUSEL DOMPET & REKENING (Your Wallet - Matching Wireframe Screen 1 & 2)
      ========================================================================= */}
      <div data-walker-target="accounts" id="walker-target-accounts" className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
            {t.overview.walletsAndAccounts}
          </h3>
          <Link
            href="/accounts"
            className="text-xs text-primary font-bold hover:underline flex items-center gap-1 active:scale-95"
          >
            <span>{t.common.manage}</span>
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Horizontal Carousel with Snapping & Safe Margins */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory py-1 -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
          {accountsList.map((acc, idx) => {
            const color = PIE_COLORS[idx % PIE_COLORS.length];
            return (
              <Link
                key={acc.id}
                href="/accounts"
                className="flex flex-col justify-between p-3.5 rounded-2xl border border-border/80 bg-card shadow-2xs hover:border-primary/40 transition-all min-w-[150px] w-[160px] sm:w-[180px] shrink-0 snap-start active:scale-98"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="h-8 w-8 rounded-xl bg-secondary flex items-center justify-center text-secondary-foreground">
                    <GeometricIcon name="accounts" size="xs" active />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-primary">
                    {acc.percent}%
                  </span>
                </div>
                <div>
                  <div className="font-black text-base sm:text-lg text-foreground tracking-tight">
                    {formatCurrency(acc.balance, acc.currency)}
                  </div>
                  <div className="text-xs font-semibold text-muted-foreground capitalize truncate mt-0.5">
                    {acc.name}
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mt-3">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${acc.percent}%`, backgroundColor: color }}
                  />
                </div>
              </Link>
            );
          })}
          {accountsList.length === 0 && (
            <div className="p-5 rounded-2xl border border-dashed border-border bg-card/50 text-xs text-muted-foreground text-center w-full">
              {t.overview.emptyAccounts}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          5. TRANSAKSI TERAKHIR (Recent Transactions - Matching Wireframe Screen 1)
      ========================================================================= */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
            {t.overview.recentTransactions}
          </h3>
          <Link
            href="/transactions"
            className="text-xs text-primary font-bold hover:underline flex items-center gap-1 active:scale-95"
          >
            <span>{t.common.viewAll}</span>
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>

        <Card className="p-2 sm:p-4 rounded-2xl border-border/80 shadow-2xs divide-y divide-border/60">
          {recentDisplayList.map((tx: any) => {
            const isExpense = tx.txType === "expense";
            const isIncome = tx.txType === "income";

            return (
              <div
                key={tx.id}
                className="py-3 px-2 flex items-center justify-between gap-3 text-xs hover:bg-muted/30 rounded-xl transition-colors min-h-[52px]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isIncome
                        ? "bg-secondary text-secondary-foreground"
                        : isExpense
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {isIncome && <GeometricIcon name="trend-up" size="xs" active />}
                    {isExpense && <GeometricIcon name="trend-down" size="xs" active />}
                    {!isIncome && !isExpense && <GeometricIcon name="accounts" size="xs" active />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-foreground truncate text-xs sm:text-sm">
                      {tx.categoryName || tx.note || (isEn ? "General Transaction" : "Transaksi Umum")}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate mt-0.5">
                      <span>{formatDate(tx.happenedAt)}</span>
                      <span>•</span>
                      <span className="capitalize">{tx.accountName || (isEn ? "Cash" : "Kas")}</span>
                      {tx.note && tx.categoryName && (
                        <>
                          <span>•</span>
                          <span className="truncate italic max-w-[120px]">{tx.note}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div
                    className={`font-black text-sm sm:text-base ${
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
                </div>
              </div>
            );
          })}

          {recentDisplayList.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              {isEn ? (
                <>No transactions recorded in <strong>{periodLabel}</strong>. Click <strong>+ Add Transaction</strong> to get started.</>
              ) : (
                <>Belum ada transaksi tercatat di periode <strong>{periodLabel}</strong>. Klik <strong>+ Catat Transaksi</strong> untuk memulai.</>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* =========================================================================
          4. ALOKASI ASET & GRAFIK AKUN KEUANGAN & TREN ARUS KAS
      ========================================================================= */}
      <div data-walker-target="chart" id="walker-target-chart" className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Kartu Alokasi & Grafik Rekening Finansial */}
        <Card className="p-4 sm:p-5 rounded-2xl border-border/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-secondary flex items-center justify-center text-secondary-foreground">
                  <GeometricIcon name="accounts" size="xs" active />
                </div>
                <h3 className="font-extrabold text-sm text-foreground">{isEn ? "Account Allocation & Chart" : "Grafik & Alokasi Akun"}</h3>
              </div>
              <Link
                href="/accounts"
                className="text-xs text-primary hover:underline font-bold flex items-center gap-1"
                title={isEn ? "Manage accounts" : "Buka halaman pengelolaan rekening"}
              >
                {t.common.manage} <ChevronRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Donut Chart Visualisasi Komposisi Akun Langsung di Halaman */}
            {accountChartData.length > 0 && (
              <div className="mb-3.5 p-3 rounded-xl bg-muted/20 border border-border/60">
                <div className="h-40 sm:h-44 w-full flex items-center justify-center relative">
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
                          borderRadius: "8px",
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
                </div>

                {/* Isi Saldo di Tengah Bawah Grafik */}
                <div className="mt-1 pt-2 border-t border-border/40 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    {isEn ? "Total Account Balance" : "Total Saldo Akun"}
                  </span>
                  <span className="text-sm sm:text-base font-black text-foreground tracking-tight mt-0.5">
                    {formatCurrency(totalUserBalance)}
                  </span>
                  <span className="text-[10px] font-semibold text-primary mt-0.5">
                    {accountChartData.length} {isEn ? "Accounts Registered" : "Akun Terdaftar"}
                  </span>
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
                    className="group flex flex-col gap-1.5 p-2 rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-bold text-foreground">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <div className="h-6 w-6 rounded-lg bg-secondary flex items-center justify-center shrink-0">
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
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-primary">
                          {acc.percent}%
                        </span>
                        <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
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
                  {isEn ? "No financial accounts registered yet." : "Belum ada akun keuangan terdaftar."}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Tren Arus Kas Bulanan */}
        <Card className="p-4 sm:p-5 rounded-2xl border-border/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-secondary flex items-center justify-center text-secondary-foreground">
                  <GeometricIcon name="annual-report" size="xs" active />
                </div>
                <h3 className="font-extrabold text-sm text-foreground">{isEn ? "Cash Flow Trend (6 Months)" : "Tren Arus Kas (6 Bulan)"}</h3>
              </div>
              <Link href="/analytics" className="text-xs text-primary hover:underline font-bold">
                {isEn ? "Details" : "Detail"}
              </Link>
            </div>

            <div className="h-56 sm:h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={synchronizedTrendData}>
                  <XAxis dataKey="label" fontSize={11} stroke="#888888" />
                  <YAxis
                    fontSize={10}
                    stroke="#888888"
                    tickFormatter={(v) => isEn ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000000).toFixed(1)}jt`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const inc = (payload.find((p) => p.dataKey === "income")?.value as number) || 0;
                      const exp = (payload.find((p) => p.dataKey === "expense")?.value as number) || 0;
                      const net = inc - exp;
                      return (
                        <div className="rounded-xl border border-border bg-card p-2.5 shadow-md text-xs flex flex-col gap-1 min-w-[150px]">
                          <div className="font-extrabold text-foreground pb-1 border-b border-border/60">
                            {label}
                          </div>
                          <div className="flex items-center justify-between gap-3 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <span>{isEn ? "Income:" : "Masuk:"}</span>
                            <span>+{formatCurrency(inc)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3 text-rose-600 dark:text-rose-400 font-semibold">
                            <span>{isEn ? "Expense:" : "Keluar:"}</span>
                            <span>-{formatCurrency(exp)}</span>
                          </div>
                          <div
                            className={`flex items-center justify-between gap-3 font-extrabold pt-1 border-t border-border/60 ${
                              net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            <span>{t.overview.netCashFlow}:</span>
                            <span>
                              {net > 0 ? "+" : ""}
                              {formatCurrency(net)}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="income" name={t.overview.totalIncome} fill="#059669" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name={t.overview.totalExpense} fill="#ba1a1a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>

      {/* =========================================================================
          5. RANKING KATEGORI (Pengeluaran vs Pemasukan)
      ========================================================================= */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
            <GeometricIcon name="categories" size="xs" active />
            {isEn ? "Top Categories" : "Kategori Terbanyak"}
          </h3>

          <div className="text-xs text-muted-foreground font-semibold">
            {isEn ? "Range:" : "Rentang:"} <strong className="text-foreground font-bold">{periodLabel}</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Pengeluaran */}
          <Card data-tour="overview-expense-ranks" className="p-4 sm:p-5 rounded-2xl border-border/80 shadow-2xs">
            <div className="flex items-center justify-between mb-3 border-b border-border/60 pb-2">
              <span className="font-bold text-xs text-rose-600 flex items-center gap-1.5">
                <GeometricIcon name="trend-down" size="xs" active /> {isEn ? "Top Expenses" : "Pengeluaran Teratas"}
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
                  className="flex flex-col gap-1 text-xs text-left p-2 rounded-xl hover:bg-muted/50 transition-all cursor-pointer group"
                  title={isEn ? `Click to view transaction details for ${rank.name}` : `Klik untuk melihat detail transaksi kategori ${rank.name}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground group-hover:text-rose-600 transition-colors flex items-center gap-1.5">
                      #{idx + 1} {rank.name}
                      <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </span>
                    <span className="font-extrabold text-foreground flex items-center">
                      {formatCurrency(rank.total)}
                      <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 ml-1.5">
                        {rank.percent}%
                      </span>
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-rose-500 group-hover:bg-rose-600 transition-colors"
                      style={{ width: `${rank.percent}%` }}
                    />
                  </div>
                </button>
              ))}

              {(!effectiveExpenseRanks?.ranks || effectiveExpenseRanks.ranks.length === 0) && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  {isEn ? "No expenses in this range yet." : "Belum ada pengeluaran di cakupan ini."}
                </div>
              )}
            </div>
          </Card>

          {/* Top Pemasukan */}
          <Card className="p-4 sm:p-5 rounded-2xl border-border/80 shadow-2xs">
            <div className="flex items-center justify-between mb-3 border-b border-border/60 pb-2">
              <span className="font-bold text-xs text-primary flex items-center gap-1.5">
                <GeometricIcon name="trend-up" size="xs" active /> {isEn ? "Top Income" : "Pemasukan Teratas"}
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
                  className="flex flex-col gap-1 text-xs text-left p-2 rounded-xl hover:bg-muted/50 transition-all cursor-pointer group"
                  title={isEn ? `Click to view transaction details for ${rank.name}` : `Klik untuk melihat detail transaksi kategori ${rank.name}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                      #{idx + 1} {rank.name}
                      <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </span>
                    <span className="font-extrabold text-foreground flex items-center">
                      {formatCurrency(rank.total)}
                      <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ml-1.5">
                        {rank.percent}%
                      </span>
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary group-hover:bg-primary/90 transition-colors"
                      style={{ width: `${rank.percent}%` }}
                    />
                  </div>
                </button>
              ))}

              {(!effectiveIncomeRanks?.ranks || effectiveIncomeRanks.ranks.length === 0) && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  {isEn ? "No income in this range yet." : "Belum ada pemasukan di cakupan ini."}
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
