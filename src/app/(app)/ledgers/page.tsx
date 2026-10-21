"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { UserPlus, KeyRound } from "lucide-react";
import { GeometricIcon } from "@/components/ui/GeometricIcon";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAlert } from "@/store/confirm.store";

export default function LedgersPage() {
  const utils = trpc.useUtils();
  const alert = useAlert();
  const [newLedgerName, setNewLedgerName] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [createdInvite, setCreatedInvite] = useState<string | null>(null);

  const { data: ledgersList } = trpc.ledgers.list.useQuery();

  const createLedgerMutation = trpc.ledgers.create.useMutation({
    onSuccess: () => {
      utils.ledgers.invalidate();
      setNewLedgerName("");
    },
  });

  const createInviteMutation = trpc.ledgers.createInvite.useMutation({
    onSuccess: (data) => {
      setCreatedInvite(data.code);
    },
  });

  const joinMutation = trpc.ledgers.joinWithCode.useMutation({
    onSuccess: () => {
      alert({
        title: "Berhasil Bergabung",
        description: "Buku kas kolaborasi kini telah terhubung ke akun Anda.",
        icon: "success",
      });
      utils.ledgers.invalidate();
      setInviteCodeInput("");
    },
    onError: (err) => {
      alert({
        title: "Gagal Bergabung",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-[#A7F3D0]/40 flex items-center justify-center text-[#064E3B] shrink-0">
            <GeometricIcon name="ledgers" className="h-4 w-4" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Buku Kas & Kolaborasi</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Pemisahan pembukuan kas (pribadi, operasional, atau usaha) serta akses anggota via kode unik.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Kolom Kiri: Daftar Buku Kas */}
        <div className="flex flex-col gap-3 sm:gap-4">
          <Card className="p-4 sm:p-5 rounded-md border border-border/80 bg-card shadow-level-1">
            <h2 className="font-bold text-sm text-foreground mb-3">Buat Buku Kas Baru</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newLedgerName.trim()) return;
                createLedgerMutation.mutate({ name: newLedgerName.trim() });
              }}
              className="flex gap-2 text-xs"
            >
              <Input
                type="text"
                placeholder="Nama buku kas (misal: Operasional Usaha, Tabungan Proyek)"
                value={newLedgerName}
                onChange={(e) => setNewLedgerName(e.target.value)}
                className="h-8 sm:h-9 rounded-md text-xs"
                required
              />
              <Button
                type="submit"
                size="sm"
                className="bg-[#059669] hover:bg-[#047857] text-white rounded-md font-semibold h-8 sm:h-9 px-3.5 shrink-0 shadow-level-1"
              >
                Buat Buku
              </Button>
            </form>
          </Card>

          <div className="flex flex-col gap-2.5">
            {ledgersList?.map((ledger) => (
              <Card key={ledger.id} className="p-3.5 sm:p-4 rounded-md border border-border/80 bg-card shadow-level-1 flex items-center justify-between transition-all hover:border-[#059669]/40">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-[#A7F3D0]/40 text-[#064E3B] flex items-center justify-center font-bold">
                    <GeometricIcon name="ledgers" className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{ledger.name}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-bold bg-secondary text-secondary-foreground border border-emerald-300 dark:border-emerald-800">
                        {ledger.currency}
                      </span>
                      <span>Awal Periode: Tgl {ledger.monthStartDay}</span>
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => createInviteMutation.mutate({ ledgerId: ledger.id, role: "editor" })}
                  className="text-xs gap-1.5 rounded-md font-semibold border-border/80 hover:bg-[#A7F3D0]/20 hover:text-[#064E3B] hover:border-[#059669]/40 h-8 px-2.5"
                >
                  <UserPlus className="h-3.5 w-3.5 text-[#059669]" />
                  Undang Rekan
                </Button>
              </Card>
            ))}
          </div>

          {createdInvite && (
            <div className="p-3.5 sm:p-4 rounded-md border border-[#059669]/30 bg-[#A7F3D0]/20 text-xs flex items-center justify-between shadow-level-1">
              <div>
                <span className="font-semibold text-[#064E3B]">Kode Undangan 6 Karakter:</span>
                <div className="mt-1.5">
                  <span className="inline-flex items-center px-3 py-1 rounded-md bg-white/70 dark:bg-emerald-950/60 border border-emerald-500/30 text-lg font-mono font-bold tracking-widest text-[#064E3B] dark:text-emerald-400">
                    {createdInvite}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Bagikan kode ini kepada rekan Anda untuk memberi akses ke buku kas ini.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Kolom Kanan: Masukkan Kode Invite */}
        <div className="flex flex-col gap-4">
          <Card className="p-4 sm:p-5 rounded-md border border-border/80 bg-card shadow-level-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-sm bg-[#A7F3D0]/40 flex items-center justify-center text-[#064E3B]">
                <KeyRound className="h-3.5 w-3.5" />
              </div>
              <h2 className="font-bold text-base text-foreground">
                Akses Buku Kas Bersama
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Masukkan kode undangan yang Anda terima untuk bergabung ke pembukuan rekan atau mitra.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!inviteCodeInput.trim()) return;
                joinMutation.mutate({ code: inviteCodeInput.trim() });
              }}
              className="space-y-3 text-xs"
            >
              <Input
                type="text"
                placeholder="CONTOH: X7K9P2"
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                className="h-10 text-center font-mono text-lg font-bold tracking-widest uppercase rounded-md"
                maxLength={8}
                required
              />
              <Button
                type="submit"
                disabled={joinMutation.isPending}
                className="w-full bg-[#059669] hover:bg-[#047857] text-white h-9 font-semibold rounded-md shadow-level-1"
              >
                {joinMutation.isPending ? "Memverifikasi..." : "Gabung ke Buku Kas"}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

