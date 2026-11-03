"use client";

import React from "react";
import {
  Bot,
  Sparkles,
  ShieldAlert,
  MessageSquare,
  Users,
  Activity,
  Layers,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatCard } from "./StatCard";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

interface AiUsageTabProps {
  stats?: {
    totalPrompts: number;
    totalSessions: number;
    monthlyPrompts: number;
    blockedPrompts: number;
    modelDistribution: Array<{ model: string; count: number }>;
    topAiUsers: Array<{ userId: string; email: string; totalPrompts: number }>;
  };
  isLoading: boolean;
}

const BAR_COLORS = ["#059669", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"];

export function AiUsageTab({ stats, isLoading }: AiUsageTabProps) {
  const data = stats || {
    totalPrompts: 0,
    totalSessions: 0,
    monthlyPrompts: 0,
    blockedPrompts: 0,
    modelDistribution: [],
    topAiUsers: [],
  };

  const blockRate =
    data.totalPrompts > 0
      ? ((data.blockedPrompts / data.totalPrompts) * 100).toFixed(1)
      : "0";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Core AI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Prompt AI"
          value={data.totalPrompts}
          subtitle="Konsultasi sepanjang waktu"
          badge="Lifetime"
          badgeVariant="default"
          icon={Bot}
        />
        <StatCard
          title="Sesi Chat Multi-Turn"
          value={data.totalSessions}
          subtitle="Percakapan interaktif"
          badge="Advisor"
          badgeVariant="info"
          icon={MessageSquare}
        />
        <StatCard
          title="Prompt Bulan Ini"
          value={data.monthlyPrompts}
          subtitle="Beban AI bulan berjalan"
          badge="Active"
          badgeVariant="success"
          icon={Sparkles}
        />
        <StatCard
          title="Guardrail Blocked"
          value={data.blockedPrompts}
          subtitle={`${blockRate}% dari total query`}
          badge={data.blockedPrompts > 0 ? "Safety Filter" : "Clean"}
          badgeVariant={data.blockedPrompts > 0 ? "warning" : "success"}
          icon={ShieldAlert}
        />
      </div>

      {/* 2. Model Distribution & Safety Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Model Distribution Chart */}
        <Card className="p-5 border-border/80 bg-card">
          <h3 className="font-bold text-sm text-foreground flex items-center justify-between mb-2">
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-600" />
              Distribusi Model LLM
            </span>
            <span className="text-[11px] text-muted-foreground">Volume Pemanggilan</span>
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Model Google Gemini dan provider fallback yang digunakan untuk analisis keuangan
          </p>

          <div className="h-[240px] w-full">
            {data.modelDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.modelDistribution}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    dataKey="model"
                    type="category"
                    tick={{ fontSize: 10 }}
                    width={110}
                    tickFormatter={(val) => {
                      if (!val) return "default";
                      return val.length > 15 ? `${val.substring(0, 15)}...` : val;
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.1)",
                      fontSize: "12px",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="count" name="Jumlah Query" radius={[0, 4, 4, 0]}>
                    {data.modelDistribution.map((_, idx) => (
                      <Cell key={`cell-${idx}`} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Belum ada prompt AI yang tercatat.
              </div>
            )}
          </div>
        </Card>

        {/* Top AI Users */}
        <Card className="p-5 border-border/80 bg-card">
          <h3 className="font-bold text-sm text-foreground flex items-center justify-between mb-2">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-sky-600" />
              Pengguna AI Advisor Paling Aktif
            </span>
            <span className="text-[11px] text-muted-foreground">Prompt Terbanyak</span>
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Akun yang paling intensif memanfaatkan rekomendasi Fin.IQ AI Advisor
          </p>

          {data.topAiUsers.length > 0 ? (
            <div className="divide-y divide-border/50 text-xs">
              {data.topAiUsers.map((user, idx) => (
                <div key={user.userId} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-foreground truncate max-w-[200px]">
                      {user.email}
                    </span>
                  </div>
                  <span className="font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full">
                    {user.totalPrompts.toLocaleString("id-ID")} query
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Belum ada riwayat aktivitas AI.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

