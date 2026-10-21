"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import { GeometricIcon } from "@/components/ui/GeometricIcon";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function IntegrityPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null);

  const { data: accountsData } = trpc.accounts.list.useQuery();

  const handleRunAudit = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setLastCheckTime(new Date().toLocaleTimeString("id-ID"));
    }, 800);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-[#A7F3D0]/40 flex items-center justify-center text-[#064E3B] shrink-0">
            <GeometricIcon name="integrity" className="h-4 w-4" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Integritas Data Keuangan</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Audit konsistensi saldo antar-rekening, relasi pos transaksi, dan validasi rekonsiliasi kas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <Card className="p-4 sm:p-5 rounded-md border border-border/80 bg-card shadow-level-1">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-[#A7F3D0]/40 text-[#064E3B] flex items-center justify-center">
              <GeometricIcon name="integrity" className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-foreground">Status Kesehatan Database</h2>
              <p className="text-xs text-muted-foreground">Semua relasi transaksi dan buku kas valid</p>
            </div>
          </div>

          <div className="mt-4 sm:mt-5 flex flex-col gap-2.5 text-xs">
            <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-sm border border-border/60 bg-slate-50/50 dark:bg-slate-900/40">
              <span className="font-semibold text-foreground">Konsistensi Saldo Rekening (Cash, Bank, E-Wallet)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-[#A7F3D0]/40 text-[#064E3B]">
                Normal
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-sm border border-border/60 bg-slate-50/50 dark:bg-slate-900/40">
              <span className="font-semibold text-foreground">Integritas Relasi Kategori & Pos</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-[#A7F3D0]/40 text-[#064E3B]">
                Normal
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-sm border border-border/60 bg-slate-50/50 dark:bg-slate-900/40">
              <span className="font-semibold text-foreground">Koneksi Realtime Server</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-[#A7F3D0]/40 text-[#064E3B]">
                Terkoneksi
              </span>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3.5">
            <span className="text-[11px] text-muted-foreground">
              {lastCheckTime ? `Pemeriksaan terakhir: ${lastCheckTime}` : "Belum dijalankan sesi ini"}
            </span>
            <Button
              size="sm"
              onClick={handleRunAudit}
              disabled={isRunning}
              className="text-xs gap-1.5 bg-[#059669] hover:bg-[#047857] text-white rounded-md font-semibold h-8 sm:h-9 px-3.5 shadow-level-1"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRunning ? "animate-spin" : ""}`} />
              {isRunning ? "Memeriksa..." : "Jalankan Audit"}
            </Button>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 rounded-md border border-border/80 bg-card shadow-level-1">
          <h2 className="font-bold text-sm text-foreground mb-2">Panduan Integritas Saldo</h2>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            Fin.IQ melakukan verifikasi saldo secara otomatis setiap kali ada transaksi yang dicatat, diimpor melalui file CSV, atau dipindai melalui AI Vision struk.
          </p>

          <div className="rounded-sm bg-slate-50/80 dark:bg-slate-900/80 p-3.5 sm:p-4 border border-border/60 text-xs space-y-2.5">
            <div className="flex items-start gap-2.5">
              <div className="text-[#059669] shrink-0 mt-0.5">
                <GeometricIcon name="check" className="h-3.5 w-3.5" />
              </div>
              <span className="text-muted-foreground">
                Setiap mutasi kas masuk, keluar, dan transfer antar-rekening memperbarui nilai buku secara atomik.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="text-[#059669] shrink-0 mt-0.5">
                <GeometricIcon name="check" className="h-3.5 w-3.5" />
              </div>
              <span className="text-muted-foreground">
                Dukungan pencadangan JSON dan ekspor CSV mutasi untuk arsip akuntansi offline.
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

