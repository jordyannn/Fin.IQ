"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import {
  PieChart,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AnalyticsPage() {
  const [kind, setKind] = useState<"expense" | "income">("expense");

  const { data: trendData } = trpc.analytics.monthlyTrend.useQuery({ monthsCount: 6 });
  const { data: categoryData } = trpc.analytics.categoryBreakdown.useQuery({ kind });

  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analisis & Laporan</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Visualisasi tren arus kas bulanan dan persentase pengeluaran berdasarkan kategori.
        </p>
      </div>

      {/* Grid Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tren Arus Kas 6 Bulan */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Tren Arus Kas (6 Bulan Terakhir)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              {trendData?.map((m) => (
                <div key={m.monthKey} className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between font-semibold">
                    <span>{m.label} ({m.monthKey})</span>
                    <span className={m.net >= 0 ? "text-emerald-600" : "text-rose-600"}>
                      Net: {formatCurrency(m.net)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg">
                      <span className="flex items-center gap-1 text-emerald-600">
                        <TrendingUp className="h-3.5 w-3.5" /> Masuk
                      </span>
                      <span className="font-bold text-foreground">{formatCurrency(m.income)}</span>
                    </div>

                    <div className="flex items-center justify-between bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg">
                      <span className="flex items-center gap-1 text-rose-600">
                        <TrendingDown className="h-3.5 w-3.5" /> Keluar
                      </span>
                      <span className="font-bold text-foreground">{formatCurrency(m.expense)}</span>
                    </div>
                  </div>
                </div>
              ))}

              {(!trendData || trendData.length === 0) && (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Memuat data grafik tren...
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Breakdown Kategori */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              Distribusi Kategori
            </CardTitle>

            <div className="flex rounded-lg bg-muted p-0.5 text-xs">
              <button
                onClick={() => setKind("expense")}
                className={`px-2.5 py-1 rounded font-semibold transition-all ${
                  kind === "expense" ? "bg-rose-600 text-white shadow-sm" : "text-muted-foreground"
                }`}
              >
                Pengeluaran
              </button>
              <button
                onClick={() => setKind("income")}
                className={`px-2.5 py-1 rounded font-semibold transition-all ${
                  kind === "income" ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground"
                }`}
              >
                Pemasukan
              </button>
            </div>
          </CardHeader>

          <CardContent className="pt-2">
            <div className="flex flex-col gap-3">
              {categoryData?.map((cat) => (
                <div key={cat.categoryId || cat.categoryName} className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{cat.categoryName}</span>
                    <span className="font-bold">{formatCurrency(cat.total)} ({cat.percent}%)</span>
                  </div>

                  {/* Progress Bar visual */}
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        kind === "expense" ? "bg-rose-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${cat.percent}%` }}
                    />
                  </div>
                </div>
              ))}

              {(!categoryData || categoryData.length === 0) && (
                <div className="p-12 text-center text-xs text-muted-foreground">
                  Belum ada transaksi {kind === "expense" ? "pengeluaran" : "pemasukan"} di periode ini.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
