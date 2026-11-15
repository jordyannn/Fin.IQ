"use client";

import React, { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("❌ [Global App Error]", error);
  }, [error]);

  const isServerActionOrReferenceError =
    error.message?.includes("Server Action") ||
    error.message?.includes("Server Reference") ||
    error.message?.includes("failed to find") ||
    error.digest?.includes("NEXT_REDIRECT");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
      <div className="w-full max-w-md p-6 sm:p-8 bg-card border border-border/80 rounded-2xl shadow-lg text-center space-y-5">
        <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <AlertCircle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight">
            {isServerActionOrReferenceError
              ? "Pembaruan Versi Terdeteksi"
              : "Terjadi Gangguan Sesi"}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isServerActionOrReferenceError
              ? "Versi terbaru Fin.IQ telah di-deploy ke server. Muat ulang halaman untuk memperbarui komponen aplikasi ke versi terkini."
              : "Aplikasi mengalami kendala sementara saat menghubungkan data. Silakan muat ulang atau kembali ke halaman awal."}
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 shadow-xs"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Muat Ulang Halaman
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/overview";
              }
            }}
            className="w-full sm:w-auto border-border"
          >
            <Home className="w-4 h-4 mr-2" />
            Ringkasan
          </Button>
        </div>
      </div>
    </div>
  );
}
