"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { BookOpen, Plus, UserPlus, KeyRound, Check } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function LedgersPage() {
  const utils = trpc.useUtils();
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
      alert("Berhasil bergabung dengan buku kas bersama!");
      utils.ledgers.invalidate();
      setInviteCodeInput("");
    },
    onError: (err) => alert("Gagal bergabung: " + err.message),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Buku Kas & Kolaborasi</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Kelola buku kas terpisah (misal Pribadi vs Usaha) dan undang anggota via kode 6-digit.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kolom Kiri: Daftar Buku Kas */}
        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <h3 className="font-bold text-sm mb-3">Buat Buku Kas Baru</h3>
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
                placeholder="Nama buku kas (misal: Toko, Proyek)"
                value={newLedgerName}
                onChange={(e) => setNewLedgerName(e.target.value)}
                className="h-9"
                required
              />
              <Button type="submit" size="sm" className="bg-primary text-white">
                Buat
              </Button>
            </form>
          </Card>

          <div className="flex flex-col gap-3">
            {ledgersList?.map((ledger) => (
              <Card key={ledger.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">{ledger.name}</h4>
                    <p className="text-[11px] text-muted-foreground">
                      Mata uang: {ledger.currency} • Tgl Mulai Bulan: {ledger.monthStartDay}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => createInviteMutation.mutate({ ledgerId: ledger.id, role: "editor" })}
                  className="text-xs gap-1"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Buat Undangan
                </Button>
              </Card>
            ))}
          </div>

          {createdInvite && (
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 text-xs flex items-center justify-between">
              <div>
                <span className="font-semibold text-primary">Kode Undangan 6-Digit:</span>
                <div className="text-xl font-mono font-bold tracking-widest mt-1 text-foreground">
                  {createdInvite}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Berikan kode ini ke anggota untuk bergabung ke buku kas Anda.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Kolom Kanan: Masukkan Kode Invite */}
        <div className="flex flex-col gap-4">
          <Card className="p-6">
            <h3 className="font-bold text-base flex items-center gap-2 mb-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Gabung Buku Kas Bersama
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Punya kode undangan 6 digit dari rekan atau keluarga? Masukkan di sini untuk mengakses buku kas bersama.
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
                className="h-11 text-center font-mono text-lg font-bold tracking-widest uppercase"
                maxLength={8}
                required
              />
              <Button
                type="submit"
                disabled={joinMutation.isPending}
                className="w-full bg-primary text-white h-10 font-semibold"
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
