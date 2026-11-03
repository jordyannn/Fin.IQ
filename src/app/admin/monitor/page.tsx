"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import {
  LayoutDashboard,
  Users,
  Activity,
  Bot,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AdminHeader, DateRangePreset } from "@/components/admin/AdminHeader";
import { OverviewTab } from "@/components/admin/OverviewTab";
import { UsersTab } from "@/components/admin/UsersTab";
import { EventsTab } from "@/components/admin/EventsTab";
import { AiUsageTab } from "@/components/admin/AiUsageTab";

export default function AdminMonitorPage() {
  const router = useRouter();

  // Active Tab state
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "events" | "ai">("overview");

  // Date Range Filter state: default to "month", with support for "year", "all" (lifetime), etc.
  const [dateRange, setDateRange] = useState<DateRangePreset>("month");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Users tab states
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);

  // Events tab states
  const [eventFilter, setEventFilter] = useState("all");
  const [eventLimit, setEventLimit] = useState(50);

  // Calculate ISO dates for queries based on dateRange preset
  const dateParams = useMemo(() => {
    const now = new Date();
    let from: string | undefined = undefined;
    const to = now.toISOString();

    if (dateRange === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      from = start.toISOString();
    } else if (dateRange === "7d") {
      const start = new Date(now.getTime() - 7 * 86400000);
      from = start.toISOString();
    } else if (dateRange === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      from = start.toISOString();
    } else if (dateRange === "30d") {
      const start = new Date(now.getTime() - 30 * 86400000);
      from = start.toISOString();
    } else if (dateRange === "year") {
      // 1 Januari tahun berjalan (Tahunan)
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      from = start.toISOString();
    } else if (dateRange === "all") {
      // Sepanjang Waktu (Lifetime): from dibiarkan undefined agar menarik seluruh data
      from = undefined;
    }

    return { from, to };
  }, [dateRange]);

  // Query 1: Overview stats (auto-refresh 30s)
  const overviewQuery = trpc.admin.overviewStats.useQuery(dateParams, {
    refetchInterval: 30000,
    retry: 1,
  });

  // Query 2: Daily/Monthly trend
  const dailyTrendQuery = trpc.admin.dailyTrend.useQuery(dateParams, {
    refetchInterval: 30000,
  });

  // Query 3: Top pages
  const topPagesQuery = trpc.admin.topPages.useQuery(dateParams, {
    refetchInterval: 30000,
  });

  // Query 4: Top features
  const topFeaturesQuery = trpc.admin.topFeatures.useQuery(dateParams, {
    refetchInterval: 30000,
  });

  // Query 5: Demographics
  const demographicsQuery = trpc.admin.userDemographics.useQuery(undefined, {
    refetchInterval: 60000,
  });

  // Query 6: Users list (only fetch if users tab active)
  const usersQuery = trpc.admin.usersList.useQuery(
    {
      search: userSearch,
      page: userPage,
      pageSize: 15,
    },
    {
      enabled: activeTab === "users",
    }
  );

  // Query 7: Recent events
  const eventsQuery = trpc.admin.recentEvents.useQuery(
    {
      eventType: eventFilter,
      limit: eventLimit,
    },
    {
      enabled: activeTab === "events",
      refetchInterval: 15000,
    }
  );

  // Query 8: AI usage stats
  const aiStatsQuery = trpc.admin.aiUsageStats.useQuery(undefined, {
    enabled: activeTab === "ai",
    refetchInterval: 30000,
  });

  // Mutations
  const toggleEnabledMutation = trpc.admin.toggleUserEnabled.useMutation({
    onSuccess: () => {
      usersQuery.refetch();
    },
  });

  const toggleAdminMutation = trpc.admin.toggleUserAdmin.useMutation({
    onSuccess: () => {
      usersQuery.refetch();
    },
  });

  const isFetchingAny =
    overviewQuery.isFetching ||
    dailyTrendQuery.isFetching ||
    usersQuery.isFetching ||
    eventsQuery.isFetching ||
    aiStatsQuery.isFetching;

  const handleRefreshAll = () => {
    overviewQuery.refetch();
    dailyTrendQuery.refetch();
    topPagesQuery.refetch();
    topFeaturesQuery.refetch();
    demographicsQuery.refetch();
    if (activeTab === "users") usersQuery.refetch();
    if (activeTab === "events") eventsQuery.refetch();
    if (activeTab === "ai") aiStatsQuery.refetch();
    setLastUpdated(new Date());
  };

  // If user is not admin (FORBIDDEN), display clean access denied
  if (overviewQuery.error?.data?.code === "FORBIDDEN") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full p-6 text-center space-y-4 border-rose-500/30">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Akses Ditolak</h1>
          <p className="text-xs text-muted-foreground">
            Halaman ini khusus untuk administrator Fin.IQ. Akun Anda saat ini tidak memiliki hak akses admin.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Button asChild className="w-full bg-[#059669] hover:bg-[#047857] text-white">
              <Link href="/overview">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Kembali ke Aplikasi Utama
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                fetch("/api/auth/logout", { method: "POST" }).then(() => {
                  router.push("/login");
                  router.refresh();
                });
              }}
              className="w-full text-xs"
            >
              Keluar dan Masuk Akun Lain
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-foreground">
      {/* 1. Header */}
      <AdminHeader
        dateRange={dateRange}
        setDateRange={setDateRange}
        isFetching={isFetchingAny}
        onRefresh={handleRefreshAll}
        lastUpdated={lastUpdated}
      />

      {/* 2. Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 border-b border-border/70 pb-2 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
              activeTab === "overview"
                ? "bg-emerald-600 text-white shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Ringkasan & Traffic</span>
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
              activeTab === "users"
                ? "bg-emerald-600 text-white shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Kelola Pengguna</span>
          </button>

          <button
            onClick={() => setActiveTab("events")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
              activeTab === "events"
                ? "bg-emerald-600 text-white shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Log Aktivitas (Live)</span>
          </button>

          <button
            onClick={() => setActiveTab("ai")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
              activeTab === "ai"
                ? "bg-emerald-600 text-white shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Bot className="h-4 w-4" />
            <span>Penggunaan AI</span>
          </button>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <OverviewTab
            overviewStats={overviewQuery.data}
            dailyTrend={dailyTrendQuery.data}
            topPages={topPagesQuery.data}
            topFeatures={topFeaturesQuery.data}
            demographics={demographicsQuery.data}
            dateRange={dateRange}
            isLoading={overviewQuery.isLoading}
          />
        )}

        {/* Tab 2: Users Management */}
        {activeTab === "users" && (
          <UsersTab
            data={usersQuery.data}
            isLoading={usersQuery.isLoading}
            search={userSearch}
            setSearch={setUserSearch}
            page={userPage}
            setPage={setUserPage}
            onToggleEnabled={async (userId, currentEnabled) => {
              await toggleEnabledMutation.mutateAsync({ userId, enabled: currentEnabled });
            }}
            onToggleAdmin={async (userId, currentAdmin) => {
              await toggleAdminMutation.mutateAsync({ userId, isAdmin: currentAdmin });
            }}
          />
        )}

        {/* Tab 3: Events Log */}
        {activeTab === "events" && (
          <EventsTab
            events={eventsQuery.data}
            isLoading={eventsQuery.isLoading}
            filterType={eventFilter}
            setFilterType={setEventFilter}
            limit={eventLimit}
            setLimit={setEventLimit}
          />
        )}

        {/* Tab 4: AI Usage */}
        {activeTab === "ai" && (
          <AiUsageTab
            stats={aiStatsQuery.data}
            isLoading={aiStatsQuery.isLoading}
          />
        )}
      </main>
    </div>
  );
}
