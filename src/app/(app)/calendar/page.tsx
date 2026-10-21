"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import { GeometricIcon } from "@/components/ui/GeometricIcon";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const totalDays = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay(); // 0 is Sunday

  const { data: txData } = trpc.transactions.list.useQuery({
    limit: 200,
  });

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthName = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(currentDate);

  // Group transactions by date string YYYY-MM-DD
  const txByDay = new Map<string, { income: number; expense: number; count: number }>();
  if (txData?.items) {
    for (const tx of txData.items) {
      const d = new Date(tx.happenedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const existing = txByDay.get(key) || { income: 0, expense: 0, count: 0 };
      if (tx.txType === "income") existing.income += tx.amount;
      if (tx.txType === "expense") existing.expense += tx.amount;
      existing.count += 1;
      txByDay.set(key, existing);
    }
  }

  const daysOfWeek = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-[#A7F3D0]/40 flex items-center justify-center text-[#064E3B] shrink-0">
              <GeometricIcon name="calendar" className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Kalender Transaksi</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Tinjau rekap pengeluaran dan pemasukan harian dalam tampilan kalender bulanan.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-md border border-border/60">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-7 w-7 rounded-sm">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-bold min-w-32 text-center text-foreground">{monthName}</span>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="h-7 w-7 rounded-sm">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Card className="p-3.5 sm:p-4 rounded-md border border-border/80 bg-card shadow-level-1 overflow-hidden">
        {/* Header Nama Hari */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-[11px] font-semibold text-muted-foreground pb-2 border-b border-border/60">
          {daysOfWeek.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Grid Tanggal */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 pt-2">
          {/* Empty cells sebelum tanggal 1 */}
          {Array.from({ length: startDayOfWeek }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-16 sm:h-20 rounded-sm bg-muted/20 border border-transparent" />
          ))}

          {/* Hari dalam bulan */}
          {Array.from({ length: totalDays }).map((_, idx) => {
            const dayNum = idx + 1;
            const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const daySummary = txByDay.get(dateKey);

            return (
              <div
                key={`day-${dayNum}`}
                className="h-16 sm:h-20 p-1.5 sm:p-2 rounded-sm border border-border/60 bg-card/60 flex flex-col justify-between hover:border-[#059669]/60 hover:bg-[#A7F3D0]/10 transition-all text-xs"
              >
                <div className="font-bold text-muted-foreground text-[10px] sm:text-[11px]">{dayNum}</div>
                {daySummary ? (
                  <div className="flex flex-col gap-0.5 text-[9px] sm:text-[10px]">
                    {daySummary.income > 0 && (
                      <span className="text-[#059669] font-bold truncate px-1.5 py-0.5 rounded-sm bg-emerald-500/10 border border-emerald-500/20">
                        +{formatCurrency(daySummary.income, "IDR", { compact: true })}
                      </span>
                    )}
                    {daySummary.expense > 0 && (
                      <span className="text-[#BA1A1A] font-bold truncate px-1.5 py-0.5 rounded-sm bg-rose-500/10 border border-rose-500/20">
                        -{formatCurrency(daySummary.expense, "IDR", { compact: true })}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-[10px] text-muted-foreground/30">-</div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
