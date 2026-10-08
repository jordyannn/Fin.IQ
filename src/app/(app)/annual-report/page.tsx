"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import { CalendarRange, TrendingUp, TrendingDown, Award } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function AnnualReportPage() {
  const [selectedYear] = useState(new Date().getFullYear());
  const { data: trendData } = trpc.analytics.monthlyTrend.useQuery({ monthsCount: 12 });

  const totalAnnualIncome = trendData?.reduce((acc, curr) => acc + curr.income, 0) || 0;
  const totalAnnualExpense = trendData?.reduce((acc, curr) => acc + curr.expense, 0) || 0;
  const annualNet = totalAnnualIncome - totalAnnualExpense;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Laporan Tahunan ({selectedYear})</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Rekapitulasi performa finansial, rasio tabungan, dan total perputaran uang sepanjang tahun.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Pemasukan Tahunan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(totalAnnualIncome)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Pengeluaran Tahunan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">
              {formatCurrency(totalAnnualExpense)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Akumulasi Saldo Bersih</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${annualNet >= 0 ? "text-purple-600" : "text-rose-600"}`}>
              {formatCurrency(annualNet)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-bold text-sm mb-4">Rincian Performa Keuangan Bulanan</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                <th className="p-3">Bulan</th>
                <th className="p-3 text-right">Pemasukan</th>
                <th className="p-3 text-right">Pengeluaran</th>
                <th className="p-3 text-right">Surplus / Defisit</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {trendData?.map((m) => (
                <tr key={m.monthKey} className="hover:bg-muted/20">
                  <td className="p-3 font-semibold">{m.label} ({m.monthKey})</td>
                  <td className="p-3 text-right text-emerald-600 font-medium">{formatCurrency(m.income)}</td>
                  <td className="p-3 text-right text-rose-600 font-medium">{formatCurrency(m.expense)}</td>
                  <td className={`p-3 text-right font-bold ${m.net >= 0 ? "text-primary" : "text-rose-600"}`}>
                    {formatCurrency(m.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
