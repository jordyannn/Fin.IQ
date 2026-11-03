"use client";

import React from "react";
import {
  Users,
  Eye,
  MousePointer,
  LogIn,
  AlertTriangle,
  Activity,
  CalendarCheck,
  TrendingUp,
  Globe,
  Layers,
  Calendar,
  Infinity as InfinityIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatCard } from "./StatCard";
import { DateRangePreset } from "./AdminHeader";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

interface OverviewTabProps {
  overviewStats?: {
    totalUsers: number;
    newRegistrations: number;
    pageViews: number;
    logins: number;
    failedLogins: number;
    clicks: number;
    featuresUsed: number;
    dau: number;
    mau: number;
    totalTransactions: number;
  };
  dailyTrend?: Array<{
    date: string;
    pageViews: number;
    logins: number;
    clicks: number;
    registers: number;
    features: number;
  }>;
  topPages?: Array<{
    page: string;
    views: number;
    uniqueVisitors: number;
  }>;
  topFeatures?: Array<{
    name: string;
    type: string;
    count: number;
  }>;
  demographics?: {
    currencyDistribution: Array<{ currency: string; count: number }>;
    powerUsers: Array<{
      userId: string;
      email: string;
      displayName: string;
      txCount: number;
    }>;
  };
  dateRange?: DateRangePreset;
  isLoading: boolean;
}

const PIE_COLORS = ["#059669", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#64748b"];

export function OverviewTab({
  overviewStats,
  dailyTrend = [],
  topPages = [],
  topFeatures = [],
  demographics,
  dateRange = "month",
  isLoading,
}: OverviewTabProps) {
  const stats = overviewStats || {
    totalUsers: 0,
    newRegistrations: 0,
    pageViews: 0,
    logins: 0,
    failedLogins: 0,
    clicks: 0,
    featuresUsed: 0,
    dau: 0,
    mau: 0,
    totalTransactions: 0,
  };

  const getRangeLabel = () => {
    switch (dateRange) {
      case "today":
        return "Hari Ini";
      case "7d":
        return "7 Hari Terakhir";
      case "month":
        return "Bulan Ini";
      case "30d":
        return "30 Hari Terakhir";
      case "year":
        return "Tahun Ini (Tahunan)";
      case "all":
        return "Sepanjang Waktu (Lifetime)";
      default:
        return "Bulan Ini";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Active Range Header Banner */}
      <div className="flex items-center justify-between bg-muted/40 px-3.5 py-2 rounded-xl border border-border/60 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          {dateRange === "all" ? (
            <InfinityIcon className="h-4 w-4 text-emerald-600" />
          ) : (
            <Calendar className="h-4 w-4 text-emerald-600" />
          )}
          <span>
            Rentang Waktu Terpilih:{" "}
            <strong className="text-foreground font-semibold">{getRangeLabel()}</strong>
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground hidden sm:inline">
          {dateRange === "all"
            ? "Menampilkan seluruh riwayat sejak platform diluncurkan"
            : dateRange === "year"
            ? "Menampilkan agregasi performa tahun berjalan"
            : "Data diperbarui otomatis setiap 30 detik"}
        </span>
      </div>

      {/* 1. Core Primary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Pengguna"
          value={stats.totalUsers}
          subtitle="Akun terdaftar di sistem"
          badge={`+${stats.newRegistrations} ${dateRange === "all" ? "total" : "di periode ini"}`}
          badgeVariant="success"
          icon={Users}
        />
        <StatCard
          title="Total Page Views"
          value={stats.pageViews}
          subtitle="Total impresi halaman"
          badge="Traffic"
          badgeVariant="info"
          icon={Eye}
        />
        <StatCard
          title="Sesi Masuk (Logins)"
          value={stats.logins}
          subtitle={stats.failedLogins > 0 ? `${stats.failedLogins} percobaan gagal` : "Semua login valid"}
          badge={stats.failedLogins > 0 ? `${stats.failedLogins} Gagal` : "Normal"}
          badgeVariant={stats.failedLogins > 0 ? "warning" : "success"}
          icon={LogIn}
        />
        <StatCard
          title="Interaksi & Klik"
          value={stats.clicks}
          subtitle={`${stats.featuresUsed} aksi fitur terpakai`}
          badge="Engagement"
          badgeVariant="default"
          icon={MousePointer}
        />
      </div>

      {/* 2. Secondary Metrics (DAU, MAU, Total Transaksi) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="p-4 bg-gradient-to-br from-emerald-500/10 via-card to-card border-emerald-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Daily Active Users (DAU)
              </p>
              <p className="text-2xl font-black mt-1 text-foreground">
                {stats.dau.toLocaleString("id-ID")}{" "}
                <span className="text-xs font-normal text-muted-foreground">pengguna unik hari ini</span>
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Activity className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-sky-500/10 via-card to-card border-sky-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                Monthly Active Users (MAU)
              </p>
              <p className="text-2xl font-black mt-1 text-foreground">
                {stats.mau.toLocaleString("id-ID")}{" "}
                <span className="text-xs font-normal text-muted-foreground">pengguna unik bulan ini</span>
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-600 dark:text-sky-400">
              <CalendarCheck className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-indigo-500/10 via-card to-card border-indigo-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Total Mutasi Finansial
              </p>
              <p className="text-2xl font-black mt-1 text-foreground">
                {stats.totalTransactions.toLocaleString("id-ID")}{" "}
                <span className="text-xs font-normal text-muted-foreground">transaksi di seluruh buku kas</span>
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* 3. Daily / Monthly Traffic Trends Chart */}
      <Card className="p-5 border-border/80 bg-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Tren Aktivitas (Traffic Trend) — {getRangeLabel()}
            </h3>
            <p className="text-xs text-muted-foreground">
              Volume Page Views, Sesi Masuk, dan Klik dalam rentang waktu {getRangeLabel().toLowerCase()}
            </p>
          </div>
        </div>

        <div className="h-[280px] w-full">
          {dailyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPageViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorLogins" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(val) => {
                    if (!val) return "";
                    // If YYYY-MM (e.g. for annual/lifetime view)
                    if (val.length === 7) {
                      const [y, m] = val.split("-");
                      const monthNames = [
                        "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
                        "Jul", "Agt", "Sep", "Okt", "Nov", "Des"
                      ];
                      const mIdx = parseInt(m, 10) - 1;
                      return `${monthNames[mIdx] || m} '${y.slice(2)}`;
                    }
                    // If YYYY-MM-DD
                    const parts = val.split("-");
                    return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : val;
                  }}
                  className="text-muted-foreground"
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    fontSize: "12px",
                    color: "#fff",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                <Area
                  type="monotone"
                  dataKey="pageViews"
                  name="Page Views"
                  stroke="#059669"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPageViews)"
                />
                <Area
                  type="monotone"
                  dataKey="logins"
                  name="Logins"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorLogins)"
                />
                <Area
                  type="monotone"
                  dataKey="clicks"
                  name="Clicks"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorClicks)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs">
              <Activity className="h-8 w-8 mb-2 opacity-40 animate-pulse" />
              <span>Belum ada data event tercatat dalam rentang ini. Data akan otomatis muncul saat pengguna beraktivitas.</span>
            </div>
          )}
        </div>
      </Card>

      {/* 4. Top Pages & Top Features Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Visited Pages */}
        <Card className="p-5 border-border/80 bg-card">
          <h3 className="font-bold text-sm text-foreground flex items-center justify-between mb-3">
            <span className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-emerald-600" />
              Halaman Terpopuler (Top Pages)
            </span>
            <span className="text-[11px] font-normal text-muted-foreground">Views & Unik</span>
          </h3>

          {topPages.length > 0 ? (
            <div className="divide-y divide-border/50 text-xs">
              {topPages.map((item, idx) => (
                <div key={item.page} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-muted flex items-center justify-center font-bold text-[10px] text-muted-foreground shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-mono text-xs truncate text-foreground font-medium">
                      {item.page}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-muted-foreground text-[11px]">
                      {item.uniqueVisitors} pengunjung
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      {item.views.toLocaleString("id-ID")} views
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Belum ada riwayat page view yang terekam.
            </div>
          )}
        </Card>

        {/* Top Features / Button Clicks */}
        <Card className="p-5 border-border/80 bg-card">
          <h3 className="font-bold text-sm text-foreground flex items-center justify-between mb-3">
            <span className="flex items-center gap-2">
              <MousePointer className="h-4 w-4 text-sky-600" />
              Fitur & Elemen Paling Diminati
            </span>
            <span className="text-[11px] font-normal text-muted-foreground">Frekuensi Pakai</span>
          </h3>

          {topFeatures.length > 0 ? (
            <div className="divide-y divide-border/50 text-xs">
              {topFeatures.map((item, idx) => (
                <div key={`${item.name}-${idx}`} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-muted flex items-center justify-center font-bold text-[10px] text-muted-foreground shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-medium truncate text-foreground">
                      {item.name}
                    </span>
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">
                      {item.type}
                    </span>
                  </div>
                  <div className="shrink-0">
                    <span className="font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full">
                      {item.count.toLocaleString("id-ID")} kali
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Belum ada riwayat aksi tombol/fitur yang terekam.
            </div>
          )}
        </Card>
      </div>

      {/* 5. User Demographics & Power Users */}
      {demographics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Currency Distribution */}
          <Card className="p-5 border-border/80 bg-card">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2 mb-2">
              <Globe className="h-4 w-4 text-emerald-600" />
              Mata Uang Pengguna
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Distribusi preferensi mata uang primer akun
            </p>

            <div className="h-[180px] w-full flex items-center justify-center">
              {demographics.currencyDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={demographics.currencyDistribution}
                      dataKey="count"
                      nameKey="currency"
                      cx="50%"
                      cy="50%"
                      outerRadius={65}
                      innerRadius={35}
                      label={(entry) => `${entry.currency}: ${entry.count}`}
                      labelLine={false}
                    >
                      {demographics.currencyDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-xs text-muted-foreground">Belum ada data mata uang.</div>
              )}
            </div>
          </Card>

          {/* Power Users */}
          <Card className="p-5 border-border/80 bg-card lg:col-span-2">
            <h3 className="font-bold text-sm text-foreground flex items-center justify-between mb-2">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-600" />
                Pengguna Teraktif (Power Users)
              </span>
              <span className="text-[11px] text-muted-foreground">Berdasarkan Total Mutasi</span>
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Akun yang paling aktif mencatat dan mengelola keuangan di Fin.IQ
            </p>

            <div className="divide-y divide-border/50 text-xs">
              {demographics.powerUsers.map((u, i) => (
                <div key={u.userId} className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-foreground">{u.displayName}</p>
                      <p className="text-[10px] text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                    {u.txCount.toLocaleString("id-ID")} transaksi
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
