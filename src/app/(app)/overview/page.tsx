"use client";

import React, { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency, formatDate } from "@/lib/utils";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

type HeroScope = "month" | "year" | "all";

export default function OverviewPage() {
  const { openQuickAdd } = useUIStore();
  const [scope, setScope] = useState<HeroScope>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [topCatScope, setTopCatScope] = useState<HeroScope>("month");

  // Format periode: YYYY-MM untuk month, YYYY untuk year
  const periodStr =
    scope === "month"
      ? `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`
      : `${currentDate.getFullYear()}`;

  const periodLabel =
    scope === "month"
      ? new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(currentDate)
      : String(currentDate.getFullYear());

  const handlePrevPeriod = () => {
    if (scope === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear() - 1, 0, 1));
    }
  };

  const handleNextPeriod = () => {
    if (scope === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear() + 1, 0, 1));
    }
  };

  const handleResetPeriod = () => setCurrentDate(new Date());

  // TRPC Queries
  const { data: heroData, isLoading: isHeroLoading } = trpc.analytics.heroSummary.useQuery({
    scope,
    period: periodStr,
  });

  const { data: assetData } = trpc.analytics.assetComposition.useQuery();
  const { data: trendData } = trpc.analytics.monthlyTrend.useQuery({ monthsCount: 6 });
  const { data: expenseRanks } = trpc.analytics.categoryRanks.useQuery({
    scope: topCatScope,
    kind: "expense",
    period: periodStr,
  });
  const { data: incomeRanks } = trpc.analytics.categoryRanks.useQuery({
    scope: topCatScope,
    kind: "income",
    period: periodStr,
  });
  const { data: heatmapData } = trpc.analytics.yearHeatmap.useQuery({
    year: currentDate.getFullYear(),
  });
  const { data: recentTxData } = trpc.transactions.list.useQuery({
    limit: 5,
  });

  return (
    <div className="flex flex-col gap-5 sm:gap-6 max-w-6xl mx-auto pb-4">
      {/* =========================================================================
          1. HERO PORTOFOLIO FINTECH (Inspirasi Bibit: Saldo Bersih & Aksi Cepat)
      ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card p-5 sm:p-7 shadow-sm transition-all">
        {/* Latar Aksen Mint Halus di Pojok Kanan Atas */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

        {/* Baris Atas: Sakelar Periode & Pemilih Tanggal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div className="flex items-center gap-1 rounded-2xl bg-muted/60 p-1 text-xs font-semibold self-start sm:self-auto">
            <button
              onClick={() => setScope("month")}
              className={`rounded-xl px-3 py-1.5 transition-all ${
                scope === "month"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Bulan Ini
            </button>
            <button
              onClick={() => setScope("year")}
              className={`rounded-xl px-3 py-1.5 transition-all ${
                scope === "year"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Tahun Ini
            </button>
            <button
              onClick={() => setScope("all")}
              className={`rounded-xl px-3 py-1.5 transition-all ${
                scope === "all"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Semua
            </button>
          </div>

          {/* Navigasi Periode Bulan/Tahun */}
          {scope !== "all" && (
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevPeriod}
                className="h-8 w-8 rounded-xl border-border/70 hover:bg-muted"
                aria-label="Periode sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <button
                onClick={handleResetPeriod}
                className="text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-muted/70 transition-colors min-w-32 text-center text-foreground"
                title="Kembali ke periode sekarang"
              >
                {periodLabel}
              </button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextPeriod}
                className="h-8 w-8 rounded-xl border-border/70 hover:bg-muted"
                aria-label="Periode berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Baris Tengah: Saldo Utama & Sparkline */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5 items-center">
          {/* Kolom Kiri: Angka Saldo Bersih & Kartu Arus Kas */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Total Saldo Bersih
              </span>
              <div
                className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mt-1.5 ${
                  (heroData?.balance || 0) >= 0 ? "text-foreground" : "text-rose-600"
                }`}
              >
                {isHeroLoading ? "..." : formatCurrency(heroData?.balance || 0)}
              </div>
            </div>

            {/* Kartu Pemasukan & Pengeluaran Berdampingan */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="flex flex-col p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" /> Pemasukan
                </span>
                <span className="text-base sm:text-lg font-extrabold text-foreground mt-1">
                  {formatCurrency(heroData?.income || 0)}
                </span>
              </div>

              <div className="flex flex-col p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <TrendingDown className="h-3.5 w-3.5" /> Pengeluaran
                </span>
                <span className="text-base sm:text-lg font-extrabold text-foreground mt-1">
                  {formatCurrency(heroData?.expense || 0)}
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

          {/* Kolom Kanan: Area Chart / Sparkline Pertumbuhan Saldo */}
          <div className="lg:col-span-5 h-44 sm:h-52 w-full flex flex-col justify-between p-2 rounded-2xl bg-muted/20 border border-border/40">
            <div className="flex items-center justify-between px-2 pt-1">
              <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
                Kurva Akumulasi Saldo
              </span>
              <span className="text-[11px] font-semibold text-primary">
                {heroData?.totalTxCount || 0} transaksi
              </span>
            </div>

            {heroData?.sparkline && heroData.sparkline.length > 0 ? (
              <div className="h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={heroData.sparkline}>
                    <defs>
                      <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00B569" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#00B569" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(val), "Saldo"]}
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
                      stroke="#00B569"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#balanceGrad)"
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
              {formatCurrency(heroData?.dailyAvgExpense || 0)} / hari
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
              {heroData?.txPerDay || 0} transaksi / hari
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
              {heroData?.daysSinceFirstTx || 1} Hari Berjalan
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
                <BarChart data={trendData || []}>
                  <XAxis dataKey="label" fontSize={11} stroke="#888888" />
                  <YAxis
                    fontSize={10}
                    stroke="#888888"
                    tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`}
                  />
                  <Tooltip
                    formatter={(val: any) => formatCurrency(val)}
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      fontSize: "11px",
                      borderRadius: "12px",
                      fontWeight: "600",
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
          {recentTxData?.items?.slice(0, 5).map((tx) => {
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

          {(!recentTxData?.items || recentTxData.items.length === 0) && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Belum ada transaksi tercatat. Klik <strong>+ Catat Transaksi</strong> untuk memulai.
            </div>
          )}
        </div>
      </Card>

      {/* =========================================================================
          5. RANKING KATEGORI (Pengeluaran vs Pemasukan)
      ========================================================================= */}
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary" />
            Kategori Terbanyak
          </h3>

          <div className="flex rounded-xl bg-muted/60 p-1 text-xs font-semibold">
            <button
              onClick={() => setTopCatScope("month")}
              className={`px-3 py-1 rounded-lg transition-all ${
                topCatScope === "month"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground"
              }`}
            >
              Bulan Ini
            </button>
            <button
              onClick={() => setTopCatScope("year")}
              className={`px-3 py-1 rounded-lg transition-all ${
                topCatScope === "year"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground"
              }`}
            >
              Tahun Ini
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Top Pengeluaran */}
          <Card className="p-5 sm:p-6 rounded-3xl border-border/70 shadow-xs">
            <div className="flex items-center justify-between mb-3.5 border-b border-border/60 pb-2.5">
              <span className="font-extrabold text-xs uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5" /> Pengeluaran Teratas
              </span>
              <span className="text-xs font-bold text-foreground">
                Total: {formatCurrency(expenseRanks?.grandTotal || 0)}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {expenseRanks?.ranks?.slice(0, 5).map((rank, idx) => (
                <div key={rank.id} className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">
                      #{idx + 1} {rank.name}
                    </span>
                    <span className="font-extrabold">
                      {formatCurrency(rank.total)} ({rank.percent}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-rose-500"
                      style={{ width: `${rank.percent}%` }}
                    />
                  </div>
                </div>
              ))}

              {(!expenseRanks?.ranks || expenseRanks.ranks.length === 0) && (
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
                Total: {formatCurrency(incomeRanks?.grandTotal || 0)}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {incomeRanks?.ranks?.slice(0, 5).map((rank, idx) => (
                <div key={rank.id} className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">
                      #{idx + 1} {rank.name}
                    </span>
                    <span className="font-extrabold">
                      {formatCurrency(rank.total)} ({rank.percent}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${rank.percent}%` }}
                    />
                  </div>
                </div>
              ))}

              {(!incomeRanks?.ranks || incomeRanks.ranks.length === 0) && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Belum ada pemasukan di cakupan ini.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
