"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useTranslation } from "@/i18n";
import { GeometricIcon } from "@/components/ui/GeometricIcon";
import { Card } from "@/components/ui/card";

export default function AnalyticsPage() {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const { t, locale, formatCurrency } = useTranslation();
  const isEn = locale === "en";

  const { data: trendData, isLoading: isLoadingTrend } = trpc.analytics.monthlyTrend.useQuery({ monthsCount: 6 });
  const { data: categoryData, isLoading: isLoadingCategory } = trpc.analytics.categoryBreakdown.useQuery({ kind });

  return (
    <div className="flex flex-col gap-5">
      {/* Title */}
      <div>
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-[#A7F3D0]/40 flex items-center justify-center text-[#064E3B] shrink-0">
            <GeometricIcon name="analytics" className="h-4 w-4" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t.analytics.title}</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {t.analytics.subtitle}
        </p>
      </div>

      {/* Grid Charts & Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Tren Arus Kas 6 Bulan */}
        <Card className="rounded-md border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-[#A7F3D0]/40 flex items-center justify-center text-[#064E3B]">
                <GeometricIcon name="analytics" className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-xs sm:text-sm font-bold text-foreground">
                {t.analytics.trendTitle}
              </h2>
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t.analytics.last6Months}
            </span>
          </div>

          <div className="flex flex-col gap-3 mt-3.5">
            {trendData?.map((m) => {
              const isPositive = m.net >= 0;
              // Format localized month label if monthKey is in format "YYYY-MM"
              let localizedLabel = m.label;
              if (m.monthKey && m.monthKey.includes("-")) {
                const [yearStr, monthStr] = m.monthKey.split("-");
                const y = parseInt(yearStr, 10);
                const mon = parseInt(monthStr, 10) - 1;
                if (!isNaN(y) && !isNaN(mon)) {
                  localizedLabel = new Intl.DateTimeFormat(isEn ? "en-US" : "id-ID", { month: "long" }).format(new Date(y, mon, 1));
                }
              }

              return (
                <div key={m.monthKey} className="flex flex-col gap-2 rounded-md border border-border/60 p-3 bg-slate-50/50 dark:bg-slate-900/40">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground">
                      {localizedLabel} <span className="text-[10px] text-muted-foreground font-normal">({m.monthKey})</span>
                    </span>
                    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-sm ${isPositive ? "bg-[#059669]/10 text-[#059669]" : "bg-[#BA1A1A]/10 text-[#BA1A1A]"}`}>
                      {t.analytics.netDiff}: {formatCurrency(m.net)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center justify-between bg-white dark:bg-slate-800/80 p-2 rounded-sm border border-border/50">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-[#059669]">
                        <GeometricIcon name="trend-up" className="h-3 w-3" />
                        <span>{t.analytics.income}</span>
                      </div>
                      <span className="font-bold text-foreground">{formatCurrency(m.income)}</span>
                    </div>

                    <div className="flex items-center justify-between bg-white dark:bg-slate-800/80 p-2 rounded-sm border border-border/50">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-[#BA1A1A]">
                        <GeometricIcon name="trend-down" className="h-3 w-3" />
                        <span>{t.analytics.expense}</span>
                      </div>
                      <span className="font-bold text-foreground">{formatCurrency(m.expense)}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {(!trendData || trendData.length === 0) && !isLoadingTrend && (
              <div className="p-8 text-center text-xs text-muted-foreground">
                {isEn ? "No cash flow history records in this period yet." : "Belum ada rekaman histori arus kas pada rentang ini."}
              </div>
            )}
          </div>
        </Card>

        {/* Breakdown Kategori */}
        <Card className="rounded-md border border-border/80 bg-card p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-[#A7F3D0]/40 flex items-center justify-center text-[#064E3B]">
                <GeometricIcon name="categories" className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-xs sm:text-sm font-bold text-foreground">
                {t.analytics.categoryTitle}
              </h2>
            </div>

            {/* Duotone Selector Pill */}
            <div className="flex rounded-md bg-slate-100 dark:bg-slate-800 p-0.5 text-xs">
              <button
                onClick={() => setKind("expense")}
                className={`px-2.5 py-1 rounded-sm text-xs font-semibold transition-all ${
                  kind === "expense"
                    ? "bg-white dark:bg-slate-900 text-[#BA1A1A] shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.analytics.expenseTab}
              </button>
              <button
                onClick={() => setKind("income")}
                className={`px-2.5 py-1 rounded-sm text-xs font-semibold transition-all ${
                  kind === "income"
                    ? "bg-[#059669] text-white shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.analytics.incomeTab}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-3.5">
            {categoryData?.map((cat) => (
              <div key={cat.categoryId || cat.categoryName} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-2">
                    <span className="h-5 w-5 rounded-sm bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-[9px] text-slate-700 dark:text-slate-300">
                      {cat.categoryName?.slice(0, 2).toUpperCase() || "KT"}
                    </span>
                    {cat.categoryName}
                  </span>
                  <div className="text-right flex items-center">
                    <span className="font-bold text-foreground">{formatCurrency(cat.total)}</span>
                    <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-muted-foreground ml-1.5">
                      {cat.percent}%
                    </span>
                  </div>
                </div>

                {/* Meter visual */}
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      kind === "expense" ? "bg-[#BA1A1A]" : "bg-[#059669]"
                    }`}
                    style={{ width: `${Math.min(cat.percent, 100)}%` }}
                  />
                </div>
              </div>
            ))}

            {(!categoryData || categoryData.length === 0) && !isLoadingCategory && (
              <div className="p-10 text-center text-xs text-muted-foreground">
                {isEn
                  ? `No ${kind === "expense" ? "expense" : "income"} transactions recorded in this period.`
                  : `Belum ada transaksi ${kind === "expense" ? "pengeluaran" : "pemasukan"} tercatat pada periode ini.`}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
