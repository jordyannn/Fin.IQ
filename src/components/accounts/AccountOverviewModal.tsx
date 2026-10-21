"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import {
  X,
  Wallet,
  CreditCard,
  Banknote,
  Smartphone,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  PieChart as PieChartIcon,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

export interface AccountAssetItem {
  id: string;
  name: string;
  group: string;
  balance: number;
  currency: string;
  percent: number;
}

interface AccountOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetData?: {
    total: number;
    items: AccountAssetItem[];
  };
}

const PIE_COLORS = [
  "#059669", // Fin.IQ Emerald Green
  "#3B82F6", // Blue
  "#F59E0B", // Amber
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#64748B", // Slate
];

export function AccountOverviewModal({
  isOpen,
  onClose,
  assetData,
}: AccountOverviewModalProps) {
  if (!isOpen) return null;

  const totalBalance = assetData?.total || 0;
  const accountsList = assetData?.items || [];

  const chartData = useMemo(() => {
    return accountsList
      .filter((a) => a.balance > 0)
      .map((acc, idx) => ({
        name: acc.name,
        value: acc.balance,
        percent: acc.percent,
        color: PIE_COLORS[idx % PIE_COLORS.length],
      }));
  }, [accountsList]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-3xl rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="p-5 sm:p-6 border-b border-border/60 flex items-center justify-between bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base sm:text-lg text-foreground tracking-tight">
                  Informasi & Grafik Akun Keuangan
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/20">
                  {accountsList.length} Akun
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Rincian saldo, alokasi kekayaan, dan grafik komposisi rekening
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body Scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs text-foreground">
          {/* Top Banner: Total Kekayaan & Visual Donut Chart */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 p-5 rounded-3xl bg-muted/30 border border-border/70 items-center">
            {/* Sisi Kiri: Angka Total Saldo */}
            <div className="md:col-span-6 flex flex-col gap-2">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" /> Total Saldo Rekening
              </span>
              <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                {formatCurrency(totalBalance)}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Akumulasi seluruh aset likuid di kas tunai, rekening bank, dan dompet digital Anda.
              </p>
            </div>

            {/* Sisi Kanan: Mini Donut Chart Recharts */}
            <div className="md:col-span-6 h-40 sm:h-44 w-full flex items-center justify-center relative">
              {chartData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        formatter={(value: any, name: any) => [
                          formatCurrency(Number(value)),
                          name,
                        ]}
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          borderColor: "var(--border)",
                          fontSize: "11px",
                          fontWeight: "600",
                          borderRadius: "12px",
                        }}
                      />
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={68}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Label in Donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Alokasi</span>
                    <span className="text-xs font-black text-foreground">{accountsList.length} Akun</span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">Belum ada saldo akun</div>
              )}
            </div>
          </div>

          {/* Section: Kartu-Kartu Akun (Inspirasi Desain Job Card: Simple, Ringan, User-Friendly) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-foreground flex items-center gap-1.5">
                <PieChartIcon className="h-4 w-4 text-primary" />
                Daftar Kartu Akun Keuangan
              </h3>
              <span className="text-xs text-muted-foreground font-semibold">
                Urutan Berdasarkan Saldo Terbesar
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {accountsList.map((acc, idx) => {
                const isCash = acc.group.toLowerCase().includes("cash");
                const isBank = acc.group.toLowerCase().includes("bank");
                const isEwallet =
                  acc.group.toLowerCase().includes("alipay") ||
                  acc.name.toLowerCase().includes("dana") ||
                  acc.name.toLowerCase().includes("gopay") ||
                  acc.name.toLowerCase().includes("ovo") ||
                  acc.name.toLowerCase().includes("shopee");

                const sliceColor = PIE_COLORS[idx % PIE_COLORS.length];

                return (
                  <div
                    key={acc.id}
                    className="flex flex-col justify-between p-4 rounded-2xl border border-border/70 bg-card hover:border-primary/40 hover:bg-primary/[0.015] hover:shadow-md transition-all duration-200"
                  >
                    {/* Top Row: Icon Badge & Group Pill */}
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border border-border/50 ${
                          isCash
                            ? "bg-emerald-500/15 text-emerald-600"
                            : isBank
                            ? "bg-blue-500/15 text-blue-600"
                            : isEwallet
                            ? "bg-amber-500/15 text-amber-600"
                            : "bg-primary/15 text-primary"
                        }`}
                      >
                        {isCash && <Banknote className="h-4 w-4" />}
                        {isBank && <CreditCard className="h-4 w-4" />}
                        {isEwallet && <Smartphone className="h-4 w-4" />}
                        {!isCash && !isBank && !isEwallet && <Wallet className="h-4 w-4" />}
                      </div>

                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-muted text-muted-foreground border border-border/50 capitalize">
                        {acc.group}
                      </span>
                    </div>

                    {/* Middle: Nama Akun & Mata Uang */}
                    <div className="my-3 flex flex-col gap-0.5">
                      <div className="text-sm font-bold text-foreground tracking-tight">
                        {acc.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-medium">
                        Mata Uang: {acc.currency || "IDR"} • Aktif
                      </div>
                    </div>

                    {/* Bottom Row: Saldo & Alokasi Persen Pill */}
                    <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                      <div className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
                        {formatCurrency(acc.balance, acc.currency)}
                      </div>

                      <span
                        className="text-[11px] font-bold px-2.5 py-1 rounded-xl text-white shadow-2xs"
                        style={{ backgroundColor: sliceColor }}
                      >
                        {acc.percent}% Alokasi
                      </span>
                    </div>
                  </div>
                );
              })}

              {accountsList.length === 0 && (
                <div className="col-span-2 py-8 text-center text-xs text-muted-foreground">
                  Belum ada akun terdaftar. Klik &ldquo;Kelola Akun Penuh&rdquo; untuk menambahkan rekening.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-border/60 flex items-center justify-between bg-muted/20 shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="rounded-xl text-xs font-semibold"
          >
            Tutup
          </Button>

          <Link href="/accounts" onClick={onClose}>
            <Button className="rounded-xl bg-primary hover:bg-primary/90 text-white font-bold gap-2 text-xs px-4 shadow-sm shadow-primary/25">
              <span>Buka Halaman Kelola Akun Penuh</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
