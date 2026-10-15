/* Hallmark · macrostructure: Stat-Led · theme: Bibit-Fintech · genre: modern-minimal · pre-emit critique: P5 H5 E5 S5 R5 V5 */
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency, formatDate } from "@/lib/utils";
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
  Plus,
  ArrowRight,
  Banknote,
  CreditCard,
  Smartphone,
  Tags,
  Flame,
  Activity,
  BarChart3,
  PieChart,
  FileSpreadsheet,
  Receipt,
  Sparkles,
  ChevronRight as ChevronRightIcon,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CategoryDetailModal,
  type CategoryDetailTarget,
} from "@/components/analytics/CategoryDetailModal";
import { OverviewMascotMood } from "@/components/mascot/OverviewMascotMood";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";

export default function OverviewPage() {
  const { openQuickAdd } = useUIStore();
  const utils = trpc.useUtils();

  // Date Filter state - Disamakan dengan Transactions Page
  const [datePreset, setDatePreset] = useState<DateFilterPreset>("this_month");
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [customDateFrom, setCustomDateFrom] = useState<string>("");
  const [customDateTo, setCustomDateTo] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryDetailTarget | null>(null);

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
        date: new Date(tx.happenedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
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
          1. HERO PORTOFOLIO FINTECH (Inspirasi Bibit: Saldo Bersih & Aksi Cepat)
      ========================================================================= */}
      <div data-tour="overview-hero" className="relative overflow-hidden rounded-3xl border border-border/70 bg-card p-5 sm:p-7 shadow-sm transition-all">
        {/* Latar Aksen Mint Halus di Pojok Kanan Atas */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

        {/* Baris Atas: Toolbar Periode & Pemilih Tanggal (Disamakan dengan Halaman Transaksi) */}
        <div data-tour="date-filter" className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Preset Waktu Dropdown */}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as DateFilterPreset)}
                className="h-8 rounded-xl border border-input bg-background px-2.5 text-xs font-semibold shadow-xs focus:outline-none"
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
            </div>

            {/* Navigasi Periode Bulan (saat Bulan Ini aktif) */}
            {datePreset === "this_month" && (
              <div className="flex items-center gap-1 rounded-xl border border-input bg-background/80 px-1 py-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={handlePrevPeriod}
                  title="Bulan sebelumnya"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="px-1.5 text-xs font-semibold capitalize min-w-[90px] text-center select-none">
                  {periodLabel}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={handleNextPeriod}
                  title="Bulan berikutnya"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                {!isCurrentMonthNow && (
                  <button
                    onClick={handleResetPeriod}
                    className="px-1.5 py-0.5 text-[10px] font-medium text-primary hover:underline"
                    title="Kembali ke bulan saat ini"
                  >
                    Bulan Ini
                  </button>
                )}
              </div>
            )}

            {/* Custom Date Pickers */}
            {datePreset === "custom" && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="h-8 text-xs w-32 px-2 rounded-xl"
                  placeholder="Dari"
                />
                <span className="text-muted-foreground text-[11px]">-</span>
                <Input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="h-8 text-xs w-32 px-2 rounded-xl"
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
              className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
              title="Perbarui data overview"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>

            {isAnyFilterActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetAllFilters}
                className="h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 gap-1.5 px-2.5 rounded-xl"
                title="Reset semua filter ke Bulan Ini"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Filter
              </Button>
            )}
          </div>
        </div>

        {/* Ringkasan Arus Kas / KPI Bar (Sama Persis dengan Halaman Transaksi) */}
        <div className="pt-3 pb-3 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-semibold text-[11px] bg-background">
              {summary.count} Transaksi
            </Badge>
            <span className="text-muted-foreground text-[11px]">
              Rentang: <span className="font-medium text-foreground">{periodLabel}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 font-medium text-[11px] sm:text-xs">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              <span>Masuk:</span>
              <span className="font-bold">{formatCurrency(summary.income)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              <TrendingDown className="h-3.5 w-3.5 shrink-0" />
              <span>Keluar:</span>
              <span className="font-bold">{formatCurrency(summary.expense)}</span>
            </div>
            <div
              className={`flex items-center gap-1.5 font-bold ${
                summary.net >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              <span>Arus Kas:</span>
              <span>
                {summary.net > 0 ? "+" : ""}
                {formatCurrency(summary.net)}
              </span>
            </div>
          </div>
        </div>

        {/* Baris Tengah: Saldo Utama & Sparkline */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5 items-center">
          {/* Kolom Kiri: Arus Kas Bersih (Pemasukan - Pengeluaran Sesuai Periode) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Arus Kas Bersih ({periodLabel})
                </span>
                {summary.net > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    Surplus
                  </span>
                )}
                {summary.net < 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                    Defisit
                  </span>
                )}
                {summary.net === 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                    Seimbang
                  </span>
                )}
              </div>

              <div
                className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mt-1.5 ${
                  summary.net > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : summary.net < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-foreground"
                }`}
              >
                {isHeroLoading && isTxLoading
                  ? "..."
                  : summary.net > 0
                  ? `+${formatCurrency(summary.net)}`
                  : formatCurrency(summary.net)}
              </div>

              <p className="text-[11px] text-muted-foreground mt-1">
                Perbandingan pemasukan dikurangi pengeluaran periode ini
                {heroData?.totalNetWorth !== undefined && (
                  <span>
                    {" "}• Total saldo seluruh rekening:{" "}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(heroData.totalNetWorth)}
                    </span>
                  </span>
                )}
              </p>
            </div>

            {/* Kartu Pemasukan & Pengeluaran Berdampingan */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="flex flex-col p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" /> Pemasukan
                </span>
                <span className="text-base sm:text-lg font-extrabold text-foreground mt-1">
                  {formatCurrency(summary.income)}
                </span>
              </div>

              <div className="flex flex-col p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <TrendingDown className="h-3.5 w-3.5" /> Pengeluaran
                </span>
                <span className="text-base sm:text-lg font-extrabold text-foreground mt-1">
                  {formatCurrency(summary.expense)}
                </span>
              </div>
            </div>

            {/* Baris Aksi Cepat Fin.IQ (Fintech Buttons) */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                onClick={openQuickAdd}
                className="rounded-xl bg-primary hover:bg-primary/90 text-white font-bold gap-2 text-xs sm:text-sm px-4 shadow-sm shadow-primary/25 active:scale-95"
              >
                <Plus className="h-4 w-4 stroke-[3px]" />
                Catat Transaksi
              </Button>
              <Link href="/import">
                <Button
                  variant="outline"
                  className="rounded-xl border-border/80 text-foreground hover:bg-muted font-semibold gap-2 text-xs sm:text-sm px-3.5 active:scale-95"
                >
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  Impor Spreadsheet
                </Button>
              </Link>
              <Link href="/accounts">
                <Button
                  variant="ghost"
                  className="rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted font-semibold text-xs sm:text-sm px-3"
                >
                  Kelola Akun
                </Button>
              </Link>
            </div>
          </div>

          {/* Kolom Kanan: Area Chart / Sparkline Pertumbuhan Arus Kas */}
          <div data-tour="overview-sparkline" className="lg:col-span-5 h-44 sm:h-52 w-full flex flex-col justify-between p-2 rounded-2xl bg-muted/20 border border-border/40">
            <div className="flex items-center justify-between px-2 pt-1">
              <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
                Kurva Arus Kas Periode Ini
              </span>
              <span className={`text-[11px] font-bold ${summary.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {summary.count} tx • {summary.net > 0 ? "+" : ""}{formatCurrency(summary.net)}
              </span>
            </div>

            {sparklineData.length > 0 ? (
              <div className="h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparklineData}>
                    <defs>
                      <linearGradient id="balanceGradPos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00B569" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#00B569" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="balanceGradNeg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(val), "Arus Kas Bersih"]}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.date || ""}
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        fontSize: "11px",
                        fontWeight: "600",
                        borderRadius: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="running"
                      stroke={summary.net >= 0 ? "#00B569" : "#EF4444"}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill={summary.net >= 0 ? "url(#balanceGradPos)" : "url(#balanceGradNeg)"}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-xs text-muted-foreground border rounded-xl border-dashed">
                Belum ada transaksi di periode ini
              </div>
            )}
          </div>
        </div>

        {/* Bang Peci Mascot Companion - Dinamis Sesuai Arus Kas Bersih */}
        <div className="mt-5 pt-4 border-t border-border/60">
          <OverviewMascotMood
            netCashflow={summary.net}
            income={summary.income}
            expense={summary.expense}
            periodLabel={periodLabel}
          />
        </div>
      </div>

      {/* =========================================================================
          2. STATISTIK RINGKAS KONSISTENSI (3 Kartu Metrik)
      ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Card className="p-4 rounded-2xl border-border/70 flex items-center gap-3.5 shadow-xs">
          <div className="h-11 w-11 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <Flame className="h-5 w-5" />
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

        <Card className="p-4 rounded-2xl border-border/70 flex items-center gap-3.5 shadow-xs">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Activity className="h-5 w-5" />
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

        <Card className="p-4 rounded-2xl border-border/70 flex items-center gap-3.5 shadow-xs">
          <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CalendarDays className="h-5 w-5" />
          </div>
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
          3. ALOKASI ASET (Mirip Rekomendasi Portofolio Bibit) & TREN ARUS KAS
      ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Kartu Alokasi Rekening Finansial */}
        <Card className="p-5 sm:p-6 rounded-3xl border-border/70 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-foreground">Alokasi & Saldo Akun</h3>
                  <p className="text-[11px] text-muted-foreground">Porsi saldo kas, bank, dan dompet digital</p>
                </div>
              </div>
              <Link
                href="/accounts"
                className="text-xs text-primary hover:underline font-bold flex items-center gap-1"
              >
                Atur Akun <ChevronRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="flex flex-col gap-3.5">
              {assetData?.items?.map((acc) => {
                const isCash = acc.group.toLowerCase().includes("cash");
                const isBank = acc.group.toLowerCase().includes("bank");
                const isEwallet =
                  acc.group.toLowerCase().includes("alipay") ||
                  acc.name.toLowerCase().includes("dana") ||
                  acc.name.toLowerCase().includes("gopay");

                return (
                  <Link
                    key={acc.id}
                    href="/accounts"
                    className="group flex flex-col gap-1.5 p-2.5 rounded-2xl hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5 font-bold text-foreground">
                        <div
                          className={`h-7 w-7 rounded-xl flex items-center justify-center shrink-0 ${
                            isCash
                              ? "bg-emerald-500/15 text-emerald-600"
                              : isBank
                              ? "bg-blue-500/15 text-blue-600"
                              : "bg-amber-500/15 text-amber-600"
                          }`}
                        >
                          {isCash && <Banknote className="h-4 w-4" />}
                          {isBank && <CreditCard className="h-4 w-4" />}
                          {isEwallet && <Smartphone className="h-4 w-4" />}
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
                        <span className="text-[11px] font-bold text-primary min-w-8 text-right">
                          {acc.percent}%
                        </span>
                        <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                    {/* Visual Progress Bar ala Bibit */}
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${acc.percent}%` }}
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
        <Card className="p-5 sm:p-6 rounded-3xl border-border/70 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-foreground">Tren Arus Kas (6 Bulan)</h3>
                  <p className="text-[11px] text-muted-foreground">Perbandingan pemasukan & pengeluaran</p>
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
                        <div className="rounded-xl border border-border bg-card p-2.5 shadow-md text-xs flex flex-col gap-1 min-w-[150px]">
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
                  <Bar dataKey="income" name="Pemasukan" fill="#00B569" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" name="Pengeluaran" fill="#EF4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>

      {/* =========================================================================
          4. TRANSAKSI TERBARU (Mobile Feed Card)
      ========================================================================= */}
      <Card className="p-5 sm:p-6 rounded-3xl border-border/70 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
              <Receipt className="h-4 w-4" />
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
                className="py-3 flex items-center justify-between gap-3 text-xs hover:bg-muted/30 px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`h-9 w-9 rounded-2xl flex items-center justify-center shrink-0 ${
                      isIncome
                        ? "bg-emerald-500/15 text-emerald-600"
                        : isExpense
                        ? "bg-rose-500/15 text-rose-600"
                        : "bg-blue-500/15 text-blue-600"
                    }`}
                  >
                    {isIncome && <TrendingUp className="h-4 w-4" />}
                    {isExpense && <TrendingDown className="h-4 w-4" />}
                    {!isIncome && !isExpense && <Wallet className="h-4 w-4" />}
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
      ========================================================================= */}
      {heatmapData && heatmapData.length > 0 && (
        <Card data-tour="overview-heatmap" className="p-5 sm:p-6 rounded-3xl border-border/80 shadow-xs bg-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-foreground">
                  Aktivitas Bulanan {currentMonth.getFullYear()}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Arus kas & intensitas transaksi per bulan (klik bulan untuk filter cepat)
                </p>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground self-start sm:self-auto font-medium">
              Total {heatmapData.reduce((acc, m) => acc + m.txCount, 0)} transaksi tercatat
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {synchronizedHeatmapData.map((m) => {
              const net = m.income - m.expense;
              const isSelectedMonth =
                datePreset === "this_month" &&
                currentMonth.getMonth() === m.monthIndex;

              return (
                <div
                  key={m.monthIndex}
                  onClick={() => {
                    setCurrentMonth(new Date(currentMonth.getFullYear(), m.monthIndex, 1));
                    setDatePreset("this_month");
                  }}
                  className={`flex flex-col gap-2 p-3 rounded-2xl border transition-all cursor-pointer text-left group shadow-xs ${
                    isSelectedMonth
                      ? "border-primary bg-primary/[0.07] ring-1 ring-primary/40 shadow-sm"
                      : "border-border/80 bg-background/95 hover:bg-muted/40 hover:border-primary/40"
                  }`}
                  title={`Klik untuk memfilter tampilan ke ${m.monthName}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-foreground tracking-tight uppercase group-hover:text-primary transition-colors">
                      {m.monthName}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-muted text-foreground border border-border/50">
                      {m.txCount} tx
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 text-[11px] font-semibold border-y border-border/60 py-1.5 my-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-[10px]">Masuk</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        +{formatCurrency(m.income)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-[10px]">Keluar</span>
                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                        -{formatCurrency(m.expense)}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`text-[10px] font-extrabold px-2 py-1 rounded-lg text-center flex items-center justify-between ${
                      net > 0
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                        : net < 0
                        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                        : "bg-muted/70 text-muted-foreground border border-border/50"
                    }`}
                  >
                    <span className="text-[9px] uppercase tracking-wider font-semibold">Nett</span>
                    <span>{formatCurrency(net)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* =========================================================================
          5. RANKING KATEGORI (Pengeluaran vs Pemasukan)
      ========================================================================= */}
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary" />
            Kategori Terbanyak
          </h3>

          <div className="text-xs text-muted-foreground font-semibold">
            Rentang: <strong className="text-foreground font-bold">{periodLabel}</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Top Pengeluaran */}
          <Card data-tour="overview-expense-ranks" className="p-5 sm:p-6 rounded-3xl border-border/70 shadow-xs">
            <div className="flex items-center justify-between mb-3.5 border-b border-border/60 pb-2.5">
              <span className="font-extrabold text-xs uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5" /> Pengeluaran Teratas
              </span>
              <span className="text-xs font-bold text-foreground">
                Total: {formatCurrency(effectiveExpenseRanks?.grandTotal || 0)}
              </span>
            </div>

            <div className="flex flex-col gap-2">
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
                  className="flex flex-col gap-1.5 text-xs text-left p-2 -mx-2 rounded-xl hover:bg-muted/50 transition-all cursor-pointer group"
                  title={`Klik untuk melihat detail transaksi kategori ${rank.name}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground group-hover:text-rose-600 transition-colors flex items-center gap-1.5">
                      #{idx + 1} {rank.name}
                      <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </span>
                    <span className="font-extrabold text-foreground">
                      {formatCurrency(rank.total)}{" "}
                      <span className="text-muted-foreground font-semibold">({rank.percent}%)</span>
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
                  Belum ada pengeluaran di cakupan ini.
                </div>
              )}
            </div>
          </Card>

          {/* Top Pemasukan */}
          <Card className="p-5 sm:p-6 rounded-3xl border-border/70 shadow-xs">
            <div className="flex items-center justify-between mb-3.5 border-b border-border/60 pb-2.5">
              <span className="font-extrabold text-xs uppercase tracking-wider text-primary flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Pemasukan Teratas
              </span>
              <span className="text-xs font-bold text-foreground">
                Total: {formatCurrency(effectiveIncomeRanks?.grandTotal || 0)}
              </span>
            </div>

            <div className="flex flex-col gap-2">
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
                  className="flex flex-col gap-1.5 text-xs text-left p-2 -mx-2 rounded-xl hover:bg-muted/50 transition-all cursor-pointer group"
                  title={`Klik untuk melihat detail transaksi kategori ${rank.name}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                      #{idx + 1} {rank.name}
                      <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </span>
                    <span className="font-extrabold text-foreground">
                      {formatCurrency(rank.total)}{" "}
                      <span className="text-muted-foreground font-semibold">({rank.percent}%)</span>
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
    </div>
  );
}
