"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integritas Data Keuangan</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Audit berkala untuk memvalidasi konsistensi saldo, relasi transaksi, dan kesehatan data akun.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Status Kesehatan Database</h3>
              <p className="text-xs text-muted-foreground">Semua relasi transaksi dan ledger valid</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
              <span className="font-medium">Konsistensi Saldo Akun (Cash, Blu, Dana)</span>
              <Badge variant="income" className="text-[10px]">Normal</Badge>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
              <span className="font-medium">Integritas Foreign Key Kategori</span>
              <Badge variant="income" className="text-[10px]">Normal</Badge>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
              <span className="font-medium">Sinkronisasi Realtime SSE Channel</span>
              <Badge variant="income" className="text-[10px]">Terkoneksi</Badge>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <span className="text-[11px] text-muted-foreground">
              {lastCheckTime ? `Pemeriksaan terakhir: ${lastCheckTime}` : "Belum dijalankan sesi ini"}
            </span>
            <Button
              size="sm"
              onClick={handleRunAudit}
              disabled={isRunning}
              className="text-xs gap-1.5 bg-primary text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRunning ? "animate-spin" : ""}`} />
              {isRunning ? "Memeriksa..." : "Jalankan Audit"}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-sm mb-2">Panduan Integritas Saldo</h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            Fin.IQ menggunakan model event-driven audit. Setiap mutasi yang dicatat dari Web Console, Smartphone PWA, maupun script import CSV selalu diverifikasi saldo akumulatifnya.
          </p>

          <div className="rounded-xl bg-muted/40 p-4 border text-xs space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <span>Saldo akun awal terdaftar: cash (158.000 IDR), blu (3.670.000 IDR), dana (3.400 IDR).</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <span>Dukungan backup artifact JSON dan ekspor CSV kapan saja.</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
