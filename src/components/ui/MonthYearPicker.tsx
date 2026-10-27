"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar as CalendarIcon,
  Check,
  RotateCcw,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const MONTHS_ID = [
  { index: 0, short: "Jan", name: "Januari" },
  { index: 1, short: "Feb", name: "Februari" },
  { index: 2, short: "Mar", name: "Maret" },
  { index: 3, short: "Apr", name: "April" },
  { index: 4, short: "Mei", name: "Mei" },
  { index: 5, short: "Jun", name: "Juni" },
  { index: 6, short: "Jul", name: "Juli" },
  { index: 7, short: "Agu", name: "Agustus" },
  { index: 8, short: "Sep", name: "September" },
  { index: 9, short: "Okt", name: "Oktober" },
  { index: 10, short: "Nov", name: "November" },
  { index: 11, short: "Des", name: "Desember" },
];

export interface MonthYearPickerProps {
  currentDate: Date;
  onSelectMonth: (date: Date) => void;
  isOpen: boolean;
  onClose: () => void;
  align?: "left" | "right" | "center";
  showFullCalendarLink?: boolean;
}

export function MonthYearPicker({
  currentDate,
  onSelectMonth,
  isOpen,
  onClose,
  align = "left",
  showFullCalendarLink = true,
}: MonthYearPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const currentYearNow = now.getFullYear();
  const currentMonthNow = now.getMonth();

  const [viewYear, setViewYear] = useState<number>(currentDate.getFullYear());

  // Sinkronisasi viewYear saat currentDate berubah
  useEffect(() => {
    setViewYear(currentDate.getFullYear());
  }, [currentDate]);

  // Click outside & Escape key listeners
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Generate daftar tahun (rentang 10 tahun sekitar tahun sekarang)
  const availableYears = Array.from({ length: 11 }, (_, i) => currentYearNow - 5 + i);

  const handlePrevYear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewYear((prev) => prev - 1);
  };

  const handleNextYear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewYear((prev) => prev + 1);
  };

  const handleSelectMonth = (monthIndex: number) => {
    const newDate = new Date(viewYear, monthIndex, 1);
    onSelectMonth(newDate);
    onClose();
  };

  const handleJumpToCurrentMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    setViewYear(today.getFullYear());
    onSelectMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onClose();
  };

  const handleJumpToLastMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    const lastMonthYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
    const lastMonthIndex = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
    setViewYear(lastMonthYear);
    onSelectMonth(new Date(lastMonthYear, lastMonthIndex, 1));
    onClose();
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute top-full mt-1.5 z-50 w-[290px] sm:w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border border-border/80 bg-card p-3.5 shadow-xl backdrop-blur-md transition-all animate-in fade-in-0 zoom-in-95 duration-150 select-none touch-manipulation",
        align === "right"
          ? "right-0 max-sm:right-auto max-sm:left-1/2 max-sm:-translate-x-1/2"
          : align === "center"
          ? "left-1/2 -translate-x-1/2"
          : "left-0 max-sm:left-1/2 max-sm:-translate-x-1/2"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Bar: Navigasi Tahun Langsung */}
      <div className="flex items-center justify-between gap-2 pb-3 mb-2.5 border-b border-border/60">
        <div className="flex items-center gap-1.5">
          <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-bold text-foreground">Pilih Bulan &amp; Tahun</span>
        </div>

        {/* Pemilih Tahun Cepat */}
        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-md border border-border/50">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handlePrevYear}
            className="h-7 w-7 sm:h-6 sm:w-6 rounded-sm text-muted-foreground hover:text-foreground hover:bg-background/80"
            title="Tahun sebelumnya"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          <select
            value={viewYear}
            onChange={(e) => setViewYear(Number(e.target.value))}
            className="h-7 sm:h-6 bg-transparent text-xs font-extrabold text-foreground cursor-pointer focus:outline-none px-1 text-center"
          >
            {availableYears.map((yr) => (
              <option key={yr} value={yr} className="bg-card text-foreground font-semibold">
                {yr}
              </option>
            ))}
          </select>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleNextYear}
            className="h-7 w-7 sm:h-6 sm:w-6 rounded-sm text-muted-foreground hover:text-foreground hover:bg-background/80"
            title="Tahun berikutnya"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Grid 12 Bulan: Langsung Klik Bulan yang Diinginkan */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {MONTHS_ID.map((m) => {
          const isSelected =
            currentDate.getFullYear() === viewYear &&
            currentDate.getMonth() === m.index;
          const isRealCurrentMonth =
            currentYearNow === viewYear && currentMonthNow === m.index;

          return (
            <button
              key={m.index}
              type="button"
              onClick={() => handleSelectMonth(m.index)}
              className={cn(
                "relative flex flex-col items-center justify-center py-2 px-1 min-h-[42px] sm:min-h-[38px] rounded-md text-xs transition-all duration-150 cursor-pointer border touch-manipulation active:scale-95",
                isSelected
                  ? "bg-primary text-white font-bold border-primary shadow-xs ring-2 ring-primary/25"
                  : isRealCurrentMonth
                  ? "border-primary/50 bg-primary/5 text-foreground font-bold hover:bg-primary/10 hover:border-primary"
                  : "border-border/60 bg-card/60 text-foreground hover:bg-muted/80 hover:border-border font-medium"
              )}
              title={`Pilih ${m.name} ${viewYear}`}
            >
              {/* Indikator Titik Hijau untuk Bulan Sekarang */}
              {isRealCurrentMonth && !isSelected && (
                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
              )}

              {/* Checkmark jika sedang terpilih */}
              {isSelected && (
                <span className="absolute top-1 right-1 text-white">
                  <Check className="h-3 w-3 stroke-[3]" />
                </span>
              )}

              <span className="text-xs font-bold leading-tight">{m.short}</span>
              <span
                className={`text-[10px] leading-tight truncate max-w-full ${
                  isSelected ? "text-white/80" : "text-muted-foreground"
                }`}
              >
                {m.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Baris Tombol Aksi Cepat (Bulan Ini, Bulan Lalu) */}
      <div className="flex items-center justify-between gap-1.5 pt-2.5 mt-2.5 border-t border-border/60 text-[11px]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleJumpToCurrentMonth}
            className="flex items-center gap-1 px-2 py-1 rounded-md font-semibold text-primary hover:bg-primary/10 transition-colors"
            title="Lompat ke bulan ini"
          >
            <Sparkles className="h-3 w-3 shrink-0" />
            Bulan Ini
          </button>
          <button
            type="button"
            onClick={handleJumpToLastMonth}
            className="flex items-center gap-1 px-2 py-1 rounded-md font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title="Lompat ke bulan lalu"
          >
            <RotateCcw className="h-3 w-3 shrink-0" />
            Bulan Lalu
          </button>
        </div>

        {showFullCalendarLink && (
          <Link
            href="/calendar"
            onClick={onClose}
            className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors py-1 px-1.5 rounded-md hover:bg-muted/60"
            title="Buka Kalender Transaksi Lengkap"
          >
            <span>Kalender</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
