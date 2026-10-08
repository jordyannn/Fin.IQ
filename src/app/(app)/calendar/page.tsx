"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
          <h1 className="text-2xl font-bold tracking-tight">Kalender Transaksi</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tinjau rekap pengeluaran dan pemasukan harian dalam tampilan kalender bulanan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-bold min-w-36 text-center">{monthName}</span>
          <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="p-4 overflow-hidden">
        {/* Header Nama Hari */}
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-muted-foreground pb-2 border-b">
          {daysOfWeek.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Grid Tanggal */}
        <div className="grid grid-cols-7 gap-2 pt-2">
          {/* Empty cells sebelum tanggal 1 */}
          {Array.from({ length: startDayOfWeek }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-20 rounded-lg bg-muted/20" />
          ))}

          {/* Hari dalam bulan */}
          {Array.from({ length: totalDays }).map((_, idx) => {
            const dayNum = idx + 1;
            const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const daySummary = txByDay.get(dateKey);

            return (
              <div
                key={`day-${dayNum}`}
                className="h-20 p-2 rounded-lg border bg-card/60 flex flex-col justify-between hover:border-primary transition-all text-xs"
              >
                <div className="font-bold text-muted-foreground text-[11px]">{dayNum}</div>
                {daySummary ? (
                  <div className="flex flex-col gap-0.5 text-[10px]">
                    {daySummary.income > 0 && (
                      <span className="text-emerald-600 font-semibold truncate">
                        +{formatCurrency(daySummary.income, "IDR", { compact: true })}
                      </span>
                    )}
                    {daySummary.expense > 0 && (
                      <span className="text-rose-600 font-semibold truncate">
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
