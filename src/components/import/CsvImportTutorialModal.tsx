"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  X,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  FileText,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CsvImportTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CsvImportTutorialModal({ isOpen, onClose }: CsvImportTutorialModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const sampleCsvContent = `Tanggal,Tipe,Kategori,Jumlah,Akun,Keterangan
2026-10-15,Pengeluaran,Makanan & Minuman,45000,Cash,Kopi & Makan Siang
2026-10-15,Pemasukan,Gaji,10000000,BCA,Gaji Bulanan
2026-10-14,Pengeluaran,Transportasi,25000,GoPay,Ongkos Ojek Online
2026-10-13,Pengeluaran,Belanja,150000,Bank Jago,Kebutuhan Rumah Tangga`;

  const handleDownloadTemplate = () => {
    const blob = new Blob([sampleCsvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "template_transaksi_finiq.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopySample = () => {
    navigator.clipboard.writeText(sampleCsvContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-2xl rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="p-5 sm:p-6 border-b border-border/60 flex items-center justify-between bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg text-foreground tracking-tight">
                Panduan & Tutorial Impor CSV
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cara mudah memasukkan ratusan transaksi dari Excel, Google Sheets, atau Bank
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body Scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs text-foreground">
          {/* Step 1: Format Kolom */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <span className="h-6 w-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-extrabold">
                1
              </span>
              <span>Format Kolom yang Didukung Fin.IQ</span>
            </div>
            <p className="text-muted-foreground leading-relaxed pl-8">
              Pastikan baris pertama file CSV Anda memiliki judul kolom. Fin.IQ memiliki sistem cerdas
              yang otomatis mengenali nama kolom bahasa Indonesia maupun Inggris:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-8 pt-1">
              <div className="p-3 rounded-2xl bg-muted/40 border border-border/60">
                <div className="font-bold text-foreground text-xs flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Kolom Wajib
                </div>
                <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
                  <li><strong>Tanggal</strong> (YYYY-MM-DD atau DD/MM/YYYY)</li>
                  <li><strong>Jumlah / Nominal</strong> (contoh: 50000 atau 50.000)</li>
                  <li><strong>Tipe</strong> (Pemasukan / Pengeluaran)</li>
                </ul>
              </div>

              <div className="p-3 rounded-2xl bg-muted/40 border border-border/60">
                <div className="font-bold text-foreground text-xs flex items-center gap-1.5 mb-1">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Kolom Opsional
                </div>
                <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
                  <li><strong>Kategori</strong> (Makanan, Transport, dll.)</li>
                  <li><strong>Akun / Rekening</strong> (BCA, Cash, GoPay, dll.)</li>
                  <li><strong>Keterangan / Catatan</strong> (rincian transaksi)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Step 2: Contoh Data CSV */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <span className="h-6 w-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-extrabold">
                  2
                </span>
                <span>Contoh Tabel Data CSV yang Valid</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopySample}
                  className="h-7 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Tersalin!" : "Salin Teks"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  className="h-7 text-[11px] font-bold bg-primary hover:bg-primary/90 text-white gap-1 px-2.5 rounded-xl shadow-xs"
                >
                  <Download className="h-3 w-3" />
                  Unduh Template CSV
                </Button>
              </div>
            </div>

            <div className="pl-8">
              <div className="overflow-x-auto rounded-2xl border border-border/70 bg-muted/20">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-muted/60 text-muted-foreground font-bold border-b border-border/60">
                    <tr>
                      <th className="py-2 px-3">Tanggal</th>
                      <th className="py-2 px-3">Tipe</th>
                      <th className="py-2 px-3">Kategori</th>
                      <th className="py-2 px-3">Jumlah</th>
                      <th className="py-2 px-3">Akun</th>
                      <th className="py-2 px-3">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-3 font-mono">2026-10-15</td>
                      <td className="py-2 px-3 text-rose-600 font-semibold">Pengeluaran</td>
                      <td className="py-2 px-3">Makanan & Minuman</td>
                      <td className="py-2 px-3 font-bold">45.000</td>
                      <td className="py-2 px-3">Cash</td>
                      <td className="py-2 px-3 text-muted-foreground">Kopi & Makan Siang</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-3 font-mono">2026-10-15</td>
                      <td className="py-2 px-3 text-emerald-600 font-semibold">Pemasukan</td>
                      <td className="py-2 px-3">Gaji</td>
                      <td className="py-2 px-3 font-bold">10.000.000</td>
                      <td className="py-2 px-3">BCA</td>
                      <td className="py-2 px-3 text-muted-foreground">Gaji Bulanan</td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2 px-3 font-mono">2026-10-14</td>
                      <td className="py-2 px-3 text-rose-600 font-semibold">Pengeluaran</td>
                      <td className="py-2 px-3">Transportasi</td>
                      <td className="py-2 px-3 font-bold">25.000</td>
                      <td className="py-2 px-3">GoPay</td>
                      <td className="py-2 px-3 text-muted-foreground">Ongkos Ojek Online</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Step 3: Tips & Kompatibilitas */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <span className="h-6 w-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-extrabold">
                3
              </span>
              <span>Tips Sukses Impor Transaksi</span>
            </div>
            <div className="pl-8 space-y-2 text-[11px] text-muted-foreground">
              <div className="flex items-start gap-2 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <span>
                  <strong>Deteksi Otomatis:</strong> Fin.IQ akan memetakan kolom secara otomatis. Anda
                  dapat meninjau (preview) dan mengubah mapping kolom sebelum menyimpan ke database.
                </span>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-2xl bg-muted/40 border border-border/60">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                <span>
                  <strong>Mutasi Bank (BCA / Mandiri / BRI / BNI):</strong> Export mutasi rekening ke
                  format CSV atau Excel (.xlsx), lalu upload langsung ke halaman impor Fin.IQ.
                </span>
              </div>
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
            Tutup Panduan
          </Button>

          <Link href="/import" onClick={onClose}>
            <Button className="rounded-xl bg-primary hover:bg-primary/90 text-white font-bold gap-2 text-xs px-4 shadow-sm shadow-primary/25">
              <span>Buka Halaman Impor</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
