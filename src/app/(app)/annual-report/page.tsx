"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import { GeometricIcon } from "@/components/ui/GeometricIcon";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function AnnualReportPage() {
  const [selectedYear] = useState(new Date().getFullYear());
  const { data: trendData, isLoading } = trpc.analytics.monthlyTrend.useQuery({ monthsCount: 12 });

  const totalAnnualIncome = trendData?.reduce((acc, curr) => acc + curr.income, 0) || 0;
  const totalAnnualExpense = trendData?.reduce((acc, curr) => acc + curr.expense, 0) || 0;
  const annualNet = totalAnnualIncome - totalAnnualExpense;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-[#A7F3D0]/40 flex items-center justify-center text-[#064E3B] shrink-0">
            <GeometricIcon name="annual-report" className="h-4 w-4" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Laporan Kinerja Tahunan ({selectedYear})
          </h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Rekapitulasi likuiditas, perputaran kas masuk dan belanja sepanjang 12 bulan terakhir.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        <Card className="rounded-md border border-border/80 bg-card p-4 sm:p-5 shadow-level-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Total Pemasukan Tahunan</span>
            <div className="h-7 w-7 rounded-sm bg-[#A7F3D0]/40 flex items-center justify-center text-[#064E3B]">
              <GeometricIcon name="trend-up" className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-[#059669] mt-2.5">
            {formatCurrency(totalAnnualIncome)}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Total kas masuk terealisasi
          </span>
        </Card>

        <Card className="rounded-md border border-border/80 bg-card p-4 sm:p-5 shadow-level-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Total Pengeluaran Tahunan</span>
            <div className="h-7 w-7 rounded-sm bg-[#BA1A1A]/10 flex items-center justify-center text-[#BA1A1A]">
              <GeometricIcon name="trend-down" className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-[#BA1A1A] mt-2.5">
            {formatCurrency(totalAnnualExpense)}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Total belanja dan pengeluaran
          </span>
        </Card>

        <Card className="rounded-md border border-border/80 bg-card p-4 sm:p-5 shadow-level-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Akumulasi Saldo Bersih</span>
            <div className="h-7 w-7 rounded-sm bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
              <GeometricIcon name="annual-report" className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className={`text-2xl font-bold tracking-tight mt-2.5 ${annualNet >= 0 ? "text-[#059669]" : "text-[#BA1A1A]"}`}>
            {formatCurrency(annualNet)}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Surplus atau selisih arus kas tahunan
          </span>
        </Card>
      </div>

      {/* Rincian Tabel */}
      <Card className="rounded-md border border-border/80 bg-card p-4 sm:p-5 shadow-level-1">
        <h2 className="font-bold text-sm text-foreground mb-3">Rincian Performa Keuangan Bulanan</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-slate-50/60 dark:bg-slate-900/60 font-semibold text-muted-foreground">
                <th className="p-2.5 sm:p-3">Periode</th>
                <th className="p-2.5 sm:p-3 text-right">Pemasukan</th>
                <th className="p-2.5 sm:p-3 text-right">Pengeluaran</th>
                <th className="p-2.5 sm:p-3 text-right">Selisih Bersih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {trendData?.map((m) => (
                <tr key={m.monthKey} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                  <td className="p-2.5 sm:p-3 font-semibold text-foreground">{m.label} ({m.monthKey})</td>
                  <td className="p-2.5 sm:p-3 text-right text-[#059669] font-medium">{formatCurrency(m.income)}</td>
                  <td className="p-2.5 sm:p-3 text-right">
                    <span className={`inline-flex px-2 py-0.5 rounded-sm text-xs font-bold ${m.net >= 0 ? "bg-emerald-500/10 text-[#059669]" : "bg-rose-500/10 text-[#BA1A1A]"}`}>
                      {m.net > 0 ? "+" : ""}
                      {formatCurrency(m.net)}
                    </span>
                  </td>
                </tr>
              ))}

              {(!trendData || trendData.length === 0) && !isLoading && (
                <tr>
                  <td colSpan={4} className="p-6 sm:p-8 text-center text-xs text-muted-foreground">
                    Belum ada data riwayat tahunan tercatat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

