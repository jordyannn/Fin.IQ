"use client";

import React from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  X,
  TrendingDown,
  TrendingUp,
  Tag,
  Wallet,
  Calendar,
  ExternalLink,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface CategoryDetailTarget {
  id: string;
  name: string;
  icon?: string | null;
  kind: "expense" | "income";
  total: number;
  percent: number;
}

interface CategoryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: CategoryDetailTarget | null;
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
}

export function CategoryDetailModal({
  isOpen,
  onClose,
  category,
  periodLabel,
  dateFrom,
  dateTo,
}: CategoryDetailModalProps) {
  const isExpense = category?.kind === "expense";

  const { data: txData, isLoading } = trpc.transactions.list.useQuery(
    {
      categoryId: category?.id,
      txType: category?.kind,
      dateFrom,
      dateTo,
      limit: 100,
    },
    {
      enabled: isOpen && !!category,
    }
  );

  if (!isOpen || !category) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-card-foreground">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-border/70 flex items-start justify-between gap-3 bg-muted/20">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                isExpense
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {isExpense ? (
                <TrendingDown className="h-5 w-5" />
              ) : (
                <TrendingUp className="h-5 w-5" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black truncate text-foreground">
                  {category.name}
                </h2>
                <Badge
                  variant={isExpense ? "destructive" : "default"}
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 ${
                    isExpense
                      ? "bg-rose-500/15 text-rose-600 hover:bg-rose-500/20 border-rose-500/20"
                      : "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20"
                  }`}
                >
                  {isExpense ? "Pengeluaran" : "Pemasukan"}
                </Badge>
              </div>

              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-medium">
                  <Calendar className="h-3.5 w-3.5" /> {periodLabel}
                </span>
                <span>•</span>
                <span className="font-semibold">{category.percent}% dari total</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
            title="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Total Stat Box */}
        <div className="px-5 sm:px-6 py-3.5 bg-muted/30 border-b border-border/60 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">
            Total Transaksi Periode Ini
          </span>
          <span
            className={`text-base font-black ${
              isExpense
                ? "text-rose-600 dark:text-rose-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {isExpense ? "-" : "+"}
            {formatCurrency(category.total)}
          </span>
        </div>

        {/* Transaction Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 divide-y divide-border/60 min-h-48">
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Memuat data transaksi...</span>
            </div>
          )}

          {!isLoading && (!txData?.items || txData.items.length === 0) && (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
              <Layers className="h-8 w-8 text-muted-foreground/40 stroke-1" />
              <p className="text-xs font-medium">
                Tidak ada transaksi untuk kategori <strong>{category.name}</strong> pada {periodLabel}.
              </p>
            </div>
          )}

          {!isLoading &&
            txData?.items?.map((tx) => (
              <div
                key={tx.id}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs hover:bg-muted/20 px-2 rounded-xl transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-bold text-foreground truncate">
                    {tx.note || "Tanpa Keterangan"}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>{formatDate(tx.happenedAt)}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-medium capitalize text-muted-foreground">
                      <Wallet className="h-3 w-3" /> {tx.accountName || "Kas"}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div
                    className={`font-black text-sm ${
                      isExpense
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {isExpense ? "-" : "+"}
                    {formatCurrency(tx.amount, tx.currency)}
                  </div>
                </div>
              </div>
            ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/70 flex items-center justify-between bg-card">
          <span className="text-[11px] text-muted-foreground">
            {txData?.items?.length || 0} catatan ditemukan
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs font-semibold"
            >
              Tutup
            </Button>
            <Link href="/transactions">
              <Button size="sm" className="text-xs font-semibold gap-1.5">
                Semua Transaksi <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
