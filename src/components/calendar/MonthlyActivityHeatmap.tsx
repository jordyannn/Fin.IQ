"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { useTranslation } from "@/i18n";
import { GeometricIcon } from "@/components/ui/GeometricIcon";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Calendar,
} from "lucide-react";
import { MONTHS_ID, MONTHS_EN } from "@/components/ui/MonthYearPicker";

interface MonthlyActivityHeatmapProps {
  currentDate?: Date;
  onSelectMonth?: (date: Date) => void;
}

export function MonthlyActivityHeatmap({
  currentDate = new Date(),
  onSelectMonth,
}: MonthlyActivityHeatmapProps) {
  const { t, formatCurrency, locale } = useTranslation();
  const isEn = locale === "en";

  const [activeYear, setActiveYear] = useState(currentDate.getFullYear());
  const [heatmapPage, setHeatmapPage] = useState<number>(() => {
    return Math.min(3, Math.max(0, Math.floor(currentDate.getMonth() / 3)));
  });
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const { data: heatmapData } = trpc.analytics.yearHeatmap.useQuery({
    year: activeYear,
  });

  const quarterMetadata = useMemo(
    () => [
      {
        page: 0,
        label: "Q1",
        title: isEn ? "Quarter 1" : "Kuartal 1",
        range: isEn ? "January - March" : "Januari - Maret",
      },
      {
        page: 1,
        label: "Q2",
        title: isEn ? "Quarter 2" : "Kuartal 2",
        range: isEn ? "April - June" : "April - Juni",
      },
      {
        page: 2,
        label: "Q3",
        title: isEn ? "Quarter 3" : "Kuartal 3",
        range: isEn ? "July - September" : "Juli - September",
      },
      {
        page: 3,
        label: "Q4",
        title: isEn ? "Quarter 4" : "Kuartal 4",
        range: isEn ? "October - December" : "Oktober - Desember",
      },
    ],
    [isEn]
  );

  const heatmapPages = useMemo(() => {
    if (!heatmapData || heatmapData.length === 0) return [];
    return [
      heatmapData.slice(0, 3),
      heatmapData.slice(3, 6),
      heatmapData.slice(6, 9),
      heatmapData.slice(9, 12),
    ];
  }, [heatmapData]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (diff > 50) {
      setHeatmapPage((prev) => (prev < 3 ? prev + 1 : 0));
    } else if (diff < -50) {
      setHeatmapPage((prev) => (prev > 0 ? prev - 1 : 3));
    }
    setTouchStartX(null);
  };

  if (!heatmapData || heatmapData.length === 0) return null;

  return (
    <Card className="p-4 sm:p-6 rounded-2xl border-border/80 shadow-2xs bg-card">
      {/* Header Section dengan Navigasi Carousel & Kuartal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center text-secondary-foreground shrink-0 border border-emerald-300 dark:border-emerald-800">
            <GeometricIcon name="calendar" size="xs" active />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
                {isEn ? "Monthly Activity" : "Aktivitas Bulanan"} {activeYear}
              </h3>
              {/* Quick Year Selector */}
              <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-md border border-border/40">
                <button
                  type="button"
                  onClick={() => setActiveYear((prev) => prev - 1)}
                  className="h-5 w-5 rounded-xs flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors cursor-pointer"
                  title={isEn ? "Previous year" : "Tahun sebelumnya"}
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="text-[10px] font-extrabold px-1 text-foreground">
                  {activeYear}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveYear((prev) => prev + 1)}
                  className="h-5 w-5 rounded-xs flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors cursor-pointer"
                  title={isEn ? "Next year" : "Tahun berikutnya"}
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {quarterMetadata[heatmapPage]?.title} ({quarterMetadata[heatmapPage]?.range})
            </p>
          </div>
        </div>

        {/* Quick Quarter Pills + Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <div className="flex items-center gap-1 p-0.5 rounded-md bg-muted/60 border border-border/50">
            {quarterMetadata.map((q) => (
              <button
                key={q.page}
                type="button"
                onClick={() => setHeatmapPage(q.page)}
                className={`px-3 py-1 text-xs font-bold rounded-sm transition-all cursor-pointer ${
                  heatmapPage === q.page
                    ? "bg-primary text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              type="button"
              onClick={() => setHeatmapPage((prev) => (prev > 0 ? prev - 1 : 3))}
              className="h-7 w-7 rounded-md border-border/70 hover:border-primary/50 hover:text-primary active:scale-95 transition-all cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              type="button"
              onClick={() => setHeatmapPage((prev) => (prev < 3 ? prev + 1 : 0))}
              className="h-7 w-7 rounded-md border-border/70 hover:border-primary/50 hover:text-primary active:scale-95 transition-all cursor-pointer"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Direct Month Selector */}
      <div className="flex items-center justify-between gap-1.5 mb-3 px-2 py-1.5 rounded-md bg-muted/30 border border-border/50 overflow-x-auto text-xs">
        <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap flex items-center gap-1 shrink-0">
          <Calendar className="h-3 w-3 text-primary" />
          {isEn ? "Direct Select:" : "Pilih Langsung:"}
        </span>
        <div className="flex items-center gap-1 overflow-x-auto py-0.5 flex-1 justify-start sm:justify-center">
          {(isEn ? MONTHS_EN : MONTHS_ID).map((m) => {
            const isCurrentM =
              new Date().getFullYear() === activeYear &&
              new Date().getMonth() === m.index;

            return (
              <button
                key={m.index}
                type="button"
                onClick={() => {
                  setHeatmapPage(Math.floor(m.index / 3));
                  if (onSelectMonth) {
                    onSelectMonth(new Date(activeYear, m.index, 1));
                  }
                }}
                className={`relative px-2 py-1 text-[11px] font-bold rounded-sm transition-all whitespace-nowrap cursor-pointer ${
                  isCurrentM
                    ? "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                }`}
              >
                {m.short}
                {isCurrentM && (
                  <span className="inline-block ml-0.5 w-1 h-1 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Track Carousel 4 Halaman */}
      <div
        className="overflow-hidden w-full select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${heatmapPage * 100}%)` }}
        >
          {heatmapPages.map((pageMonths, pIdx) => (
            <div key={pIdx} className="w-full shrink-0 px-0.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                {pageMonths.map((m) => {
                  const net = m.income - m.expense;
                  const fullMonthName = new Intl.DateTimeFormat(
                    isEn ? "en-US" : "id-ID",
                    { month: "long" }
                  ).format(new Date(activeYear, m.monthIndex, 1));

                  return (
                    <div
                      key={m.monthIndex}
                      onClick={() => {
                        if (onSelectMonth) {
                          onSelectMonth(new Date(activeYear, m.monthIndex, 1));
                        }
                      }}
                      className="relative overflow-hidden flex flex-col justify-between p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card hover:bg-primary/[0.015] hover:border-primary/40 transition-all duration-200 cursor-pointer text-left group shadow-2xs h-full min-h-[150px]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm sm:text-base font-extrabold text-foreground tracking-tight group-hover:text-primary transition-colors truncate">
                            {fullMonthName}
                          </div>
                          <div className="text-[10px] font-medium text-muted-foreground mt-0.5 truncate">
                            {isEn
                              ? `${m.txCount} transactions`
                              : `${m.txCount} transaksi`}
                          </div>
                        </div>

                        {/* Status Badge */}
                        {m.txCount === 0 ? (
                          <span className="px-2 py-0.5 rounded-sm text-[10px] font-medium bg-muted/60 text-muted-foreground border border-border/40 shrink-0">
                            {isEn ? "Empty" : "Kosong"}
                          </span>
                        ) : net > 0 ? (
                          <span className="px-2 py-0.5 rounded-sm text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                            Surplus
                          </span>
                        ) : net < 0 ? (
                          <span className="px-2 py-0.5 rounded-sm text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 shrink-0">
                            {isEn ? "Deficit" : "Defisit"}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 shrink-0">
                            {isEn ? "Balanced" : "Seimbang"}
                          </span>
                        )}
                      </div>

                      <div className="my-2.5 grid grid-cols-2 gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 min-w-0">
                          <TrendingUp className="h-3 w-3 shrink-0" />
                          <span className="truncate">+{formatCurrency(m.income)}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-sm bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 min-w-0">
                          <TrendingDown className="h-3 w-3 shrink-0" />
                          <span className="truncate">-{formatCurrency(m.expense)}</span>
                        </span>
                      </div>

                      <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2 mt-auto">
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {isEn ? "Net" : "Arus Kas"}
                        </span>
                        <span
                          className={`text-xs sm:text-sm font-extrabold tracking-tight ${
                            net > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : net < 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-foreground"
                          }`}
                        >
                          {net > 0 ? "+" : ""}
                          {formatCurrency(net)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Carousel */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t border-border/60 text-xs">
        <div className="text-muted-foreground font-medium text-[11px]">
          {isEn ? "Showing" : "Menampilkan"}{" "}
          <span className="text-foreground font-bold">
            {quarterMetadata[heatmapPage]?.title}
          </span>{" "}
          ({quarterMetadata[heatmapPage]?.range})
        </div>

        <div className="flex items-center gap-1.5">
          {[0, 1, 2, 3].map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setHeatmapPage(idx)}
              className={`transition-all duration-200 rounded-xs cursor-pointer ${
                heatmapPage === idx
                  ? "w-6 h-2 bg-primary"
                  : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"
              }`}
              title={`Page ${idx + 1}`}
            />
          ))}
        </div>

        <div className="text-muted-foreground font-medium text-[11px]">
          {isEn ? "Total " : "Total "}
          <strong className="text-foreground">
            {heatmapData.reduce((acc, m) => acc + m.txCount, 0)}
          </strong>{" "}
          {isEn ? `transactions in ${activeYear}` : `transaksi tahun ${activeYear}`}
        </div>
      </div>
    </Card>
  );
}

