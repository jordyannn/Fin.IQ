"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import {
  Wallet,
  Plus,
  CreditCard,
  Banknote,
  Smartphone,
  EyeOff,
  Eye,
  Trash2,
  Edit2,
  SlidersHorizontal,
  CheckCircle2,
  X,
  Search,
  ArrowUpDown,
  CircleDollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EditAccountState {
  id: string;
  name: string;
  group: string;
  currency: string;
  balance: number;
  initialBalance: number;
  note: string;
  isHidden: boolean;
}

interface AdjustBalanceState {
  id: string;
  name: string;
  currentBalance: number;
  newBalance: number;
  currency: string;
}

export default function AccountsPage() {
  const utils = trpc.useUtils();

  // Search & filter tab
  const [filterTab, setFilterTab] = useState<"all" | "active" | "hidden">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // State tambah akun baru
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState("Bank card");
  const [newCurrency, setNewCurrency] = useState("IDR");
  const [newInitialBalance, setNewInitialBalance] = useState("");
  const [newNote, setNewNote] = useState("");

  // State edit akun lengkap
  const [editingAccount, setEditingAccount] = useState<EditAccountState | null>(null);

  // State sesuaikan saldo cepat
  const [adjustingAccount, setAdjustingAccount] = useState<AdjustBalanceState | null>(null);

  // Queries (ambil semua akun termasuk yang disembunyikan agar bisa dikelola)
  const { data: accountsData, isLoading } = trpc.accounts.list.useQuery({ includeHidden: true });

  // Mutations
  const createMutation = trpc.accounts.create.useMutation({
    onSuccess: () => {
      utils.accounts.invalidate();
      utils.analytics.invalidate();
      setIsAddOpen(false);
      setNewName("");
      setNewInitialBalance("");
      setNewNote("");
    },
  });

  const updateMutation = trpc.accounts.update.useMutation({
    onSuccess: () => {
      utils.accounts.invalidate();
      utils.analytics.invalidate();
      setEditingAccount(null);
    },
  });

  const adjustBalanceMutation = trpc.accounts.adjustBalance.useMutation({
    onSuccess: () => {
      utils.accounts.invalidate();
      utils.analytics.invalidate();
      setAdjustingAccount(null);
    },
  });

  const toggleHiddenMutation = trpc.accounts.update.useMutation({
    onSuccess: () => {
      utils.accounts.invalidate();
      utils.analytics.invalidate();
    },
  });

  const deleteMutation = trpc.accounts.delete.useMutation({
    onSuccess: () => {
      utils.accounts.invalidate();
      utils.analytics.invalidate();
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: newName.trim(),
      group: newGroup,
      currency: newCurrency,
      initialBalance: parseFloat(newInitialBalance) || 0,
      note: newNote.trim() || undefined,
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    updateMutation.mutate({
      id: editingAccount.id,
      name: editingAccount.name.trim(),
      group: editingAccount.group,
      currency: editingAccount.currency,
      balance: Number(editingAccount.balance),
      initialBalance: Number(editingAccount.initialBalance),
      note: editingAccount.note.trim() || undefined,
      isHidden: editingAccount.isHidden,
    });
  };

  const handleAdjustBalance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingAccount) return;

    adjustBalanceMutation.mutate({
      accountId: adjustingAccount.id,
      newBalance: Number(adjustingAccount.newBalance),
      note: `Penyesuaian saldo manual (${new Date().toLocaleDateString("id-ID")})`,
    });
  };

  // Filter list
  const filteredAccounts = (accountsData?.accounts || []).filter((acc) => {
    if (filterTab === "active" && acc.isHidden) return false;
    if (filterTab === "hidden" && !acc.isHidden) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        acc.name.toLowerCase().includes(q) ||
        acc.group.toLowerCase().includes(q) ||
        (acc.note && acc.note.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Akun Keuangan</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kelola dompet tunai, rekening bank, dan saldo e-wallet Anda. Klik kartu untuk langsung mengubah rincian atau menyesuaikan saldo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsAddOpen(true)}
            className="bg-primary hover:bg-primary/90 text-white gap-2 shadow-sm text-xs"
          >
            <Plus className="h-4 w-4" />
            Tambah Akun Baru
          </Button>
        </div>
      </div>

      {/* Ringkasan Total Saldo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2 bg-gradient-to-tr from-primary to-emerald-600 text-white p-6 rounded-3xl border-0 shadow-md shadow-primary/20 relative overflow-hidden">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white/85 uppercase tracking-wider">
                Total Seluruh Saldo Aktif
              </div>
              <div className="text-3xl sm:text-4xl font-black tracking-tight mt-1.5">
                {formatCurrency(accountsData?.totalBalance || 0)}
              </div>
              <p className="text-xs text-white/80 mt-1 font-medium">
                Tercatat di {accountsData?.accounts?.filter((a) => !a.isHidden).length || 0} akun aktif
              </p>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/25">
              <Wallet className="h-7 w-7 text-white" />
            </div>
          </div>
          {/* Subtle background decoration */}
          <div className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full bg-white/10 blur-xl pointer-events-none" />
        </Card>

        <Card className="p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Statistik Akun
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="p-3 bg-muted/40 rounded-xl">
                <div className="text-[11px] text-muted-foreground">Akun Aktif</div>
                <div className="text-xl font-bold mt-0.5 text-foreground">
                  {accountsData?.accounts?.filter((a) => !a.isHidden).length || 0}
                </div>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl">
                <div className="text-[11px] text-muted-foreground">Disembunyikan</div>
                <div className="text-xl font-bold mt-0.5 text-muted-foreground">
                  {accountsData?.accounts?.filter((a) => a.isHidden).length || 0}
                </div>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            Akun yang disembunyikan tidak akan muncul di input transaksi harian.
          </p>
        </Card>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-xl border w-full sm:w-auto">
          <button
            onClick={() => setFilterTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterTab === "all"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Semua ({accountsData?.accounts?.length || 0})
          </button>
          <button
            onClick={() => setFilterTab("active")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterTab === "active"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Aktif ({(accountsData?.accounts || []).filter((a) => !a.isHidden).length})
          </button>
          <button
            onClick={() => setFilterTab("hidden")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterTab === "hidden"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Disembunyikan ({(accountsData?.accounts || []).filter((a) => a.isHidden).length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Cari nama akun atau catatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAccounts.map((acc) => {
          const isCash = acc.group.toLowerCase().includes("cash");
          const isBank = acc.group.toLowerCase().includes("bank");
          const isEwallet =
            acc.group.toLowerCase().includes("alipay") || acc.name.toLowerCase().includes("dana");

          return (
            <Card
              key={acc.id}
              className={`group relative overflow-hidden transition-all duration-200 hover:border-primary hover:shadow-md cursor-pointer ${
                acc.isHidden ? "opacity-60 bg-muted/30 border-dashed" : "bg-card"
              }`}
              onClick={() =>
                setEditingAccount({
                  id: acc.id,
                  name: acc.name,
                  group: acc.group,
                  currency: acc.currency,
                  balance: acc.balance,
                  initialBalance: acc.initialBalance,
                  note: acc.note || "",
                  isHidden: acc.isHidden,
                })
              }
            >
              {/* Colored top accent line based on account group */}
              <div
                className={`h-1 w-full ${
                  isCash ? "bg-emerald-500" : isBank ? "bg-blue-500" : "bg-sky-500"
                }`}
              />

              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-sm ${
                      isCash
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : isBank
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                    }`}
                  >
                    {isCash && <Banknote className="h-5 w-5" />}
                    {isBank && <CreditCard className="h-5 w-5" />}
                    {isEwallet && <Smartphone className="h-5 w-5" />}
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold uppercase tracking-wider text-foreground">
                      {acc.name}
                    </CardTitle>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="secondary" className="text-[10px] px-2 py-0">
                        {acc.group}
                      </Badge>
                      {acc.isHidden && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-amber-600 border-amber-300">
                          Disembunyikan
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick actions (stop propagation so card click doesn't clash) */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() =>
                      setAdjustingAccount({
                        id: acc.id,
                        name: acc.name,
                        currentBalance: acc.balance,
                        newBalance: acc.balance,
                        currency: acc.currency,
                      })
                    }
                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    title="Sesuaikan Saldo Cepat"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() =>
                      setEditingAccount({
                        id: acc.id,
                        name: acc.name,
                        group: acc.group,
                        currency: acc.currency,
                        balance: acc.balance,
                        initialBalance: acc.initialBalance,
                        note: acc.note || "",
                        isHidden: acc.isHidden,
                      })
                    }
                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    title="Ubah Rincian Akun"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() =>
                      toggleHiddenMutation.mutate({ id: acc.id, isHidden: !acc.isHidden })
                    }
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                    title={acc.isHidden ? "Tampilkan Akun" : "Sembunyikan Akun"}
                  >
                    {acc.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Yakin ingin menghapus akun '${acc.name}'?`)) {
                        deleteMutation.mutate({ id: acc.id });
                      }
                    }}
                    className="p-1.5 text-muted-foreground hover:text-rose-600 rounded-lg transition-colors"
                    title="Hapus Akun"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardHeader>

              <CardContent className="pt-2">
                <div className="flex items-baseline justify-between mt-1">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Saldo Saat Ini
                    </div>
                    <div className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                      {formatCurrency(acc.balance, acc.currency)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-4 pt-3 border-t">
                  <span>Saldo Awal: {formatCurrency(acc.initialBalance, acc.currency)}</span>
                  <span className="font-semibold text-foreground px-1.5 py-0.5 bg-muted rounded">
                    {acc.currency}
                  </span>
                </div>

                {acc.note && (
                  <p className="text-[11px] text-muted-foreground mt-2 line-clamp-1 italic">
                    "{acc.note}"
                  </p>
                )}

                {/* Footer interactive button */}
                <div className="mt-4 pt-2 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() =>
                      setAdjustingAccount({
                        id: acc.id,
                        name: acc.name,
                        currentBalance: acc.balance,
                        newBalance: acc.balance,
                        currency: acc.currency,
                      })
                    }
                    className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                    Sesuaikan Saldo
                  </button>

                  <button
                    onClick={() =>
                      setEditingAccount({
                        id: acc.id,
                        name: acc.name,
                        group: acc.group,
                        currency: acc.currency,
                        balance: acc.balance,
                        initialBalance: acc.initialBalance,
                        note: acc.note || "",
                        isHidden: acc.isHidden,
                      })
                    }
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <Edit2 className="h-3 w-3" />
                    Ubah Rincian
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredAccounts.length === 0 && (
          <div className="col-span-full p-12 text-center text-xs text-muted-foreground border rounded-2xl border-dashed">
            {isLoading ? "Memuat akun..." : "Tidak ada akun keuangan yang cocok dengan filter."}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* Modal 1: Tambah Akun Baru */}
      {/* ========================================================================= */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-md rounded-2xl bg-card border shadow-2xl p-6 text-card-foreground">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div>
                <h2 className="text-base font-bold">Tambah Akun Baru</h2>
                <p className="text-[11px] text-muted-foreground">
                  Daftarkan dompet tunai atau rekening baru Anda.
                </p>
              </div>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-foreground">Nama Akun</label>
                <Input
                  type="text"
                  placeholder="Contoh: Dompet Utama, BCA, Mandiri, GoPay"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1 h-9"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground">Kelompok Akun</label>
                  <select
                    value={newGroup}
                    onChange={(e) => setNewGroup(e.target.value)}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-sm text-xs focus:outline-none"
                  >
                    <option value="Cash">Cash (Uang Tunai)</option>
                    <option value="Bank card">Bank card (Rekening Bank)</option>
                    <option value="Alipay">Alipay / E-Wallet</option>
                    <option value="Credit card">Credit card (Kartu Kredit)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-foreground">Mata Uang</label>
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value)}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-sm text-xs focus:outline-none"
                  >
                    <option value="IDR">IDR (Rupiah)</option>
                    <option value="USD">USD (Dollar AS)</option>
                    <option value="SGD">SGD (Dollar Singapura)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="MYR">MYR (Ringgit)</option>
                    <option value="JPY">JPY (Yen)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground">Saldo Awal</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={newInitialBalance}
                  onChange={(e) => setNewInitialBalance(e.target.value)}
                  className="mt-1 h-9"
                />
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  Nominal uang yang ada saat akun ini pertama kali mulai dicatat.
                </span>
              </div>

              <div>
                <label className="font-semibold text-foreground">Keterangan / Catatan (Opsional)</label>
                <Input
                  type="text"
                  placeholder="Misal: Nomor rekening atau catatan tambahan"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="mt-1 h-9"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-1/2"
                  onClick={() => setIsAddOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-1/2 bg-primary text-white"
                >
                  {createMutation.isPending ? "Menyimpan..." : "Simpan Akun"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modal 2: Edit Akun Lengkap (Nama, Kelompok, Saldo, Catatan, dsb.) */}
      {/* ========================================================================= */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-md rounded-2xl bg-card border shadow-2xl p-6 text-card-foreground">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div>
                <h2 className="text-base font-bold">Ubah Akun Keuangan</h2>
                <p className="text-[11px] text-muted-foreground">
                  Sesuaikan nama, tipe kelompok, atau koreksi saldo akun ini.
                </p>
              </div>
              <button
                onClick={() => setEditingAccount(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-foreground">Nama Akun</label>
                <Input
                  type="text"
                  value={editingAccount.name}
                  onChange={(e) =>
                    setEditingAccount({ ...editingAccount, name: e.target.value })
                  }
                  className="mt-1 h-9 font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground">Kelompok Akun</label>
                  <select
                    value={editingAccount.group}
                    onChange={(e) =>
                      setEditingAccount({ ...editingAccount, group: e.target.value })
                    }
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-sm text-xs focus:outline-none"
                  >
                    <option value="Cash">Cash (Uang Tunai)</option>
                    <option value="Bank card">Bank card (Rekening Bank)</option>
                    <option value="Alipay">Alipay / E-Wallet</option>
                    <option value="Credit card">Credit card (Kartu Kredit)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-foreground">Mata Uang</label>
                  <select
                    value={editingAccount.currency}
                    onChange={(e) =>
                      setEditingAccount({ ...editingAccount, currency: e.target.value })
                    }
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-sm text-xs focus:outline-none"
                  >
                    <option value="IDR">IDR (Rupiah)</option>
                    <option value="USD">USD (Dollar AS)</option>
                    <option value="SGD">SGD (Dollar Singapura)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="MYR">MYR (Ringgit)</option>
                    <option value="JPY">JPY (Yen)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground">
                  Saldo Saat Ini ({editingAccount.currency})
                </label>
                <Input
                  type="number"
                  value={editingAccount.balance}
                  onChange={(e) =>
                    setEditingAccount({
                      ...editingAccount,
                      balance: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="mt-1 h-9 font-bold text-sm"
                  required
                />
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  Ubah angka ini jika ingin menyelaraskan langsung dengan saldo riil di dompet atau bank Anda.
                </span>
              </div>

              <div>
                <label className="font-semibold text-foreground">
                  Saldo Awal ({editingAccount.currency})
                </label>
                <Input
                  type="number"
                  value={editingAccount.initialBalance}
                  onChange={(e) =>
                    setEditingAccount({
                      ...editingAccount,
                      initialBalance: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="mt-1 h-9"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground">Catatan</label>
                <Input
                  type="text"
                  value={editingAccount.note}
                  onChange={(e) =>
                    setEditingAccount({ ...editingAccount, note: e.target.value })
                  }
                  className="mt-1 h-9"
                  placeholder="Keterangan tambahan"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isHiddenCheckbox"
                  checked={editingAccount.isHidden}
                  onChange={(e) =>
                    setEditingAccount({ ...editingAccount, isHidden: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="isHiddenCheckbox" className="text-xs text-muted-foreground cursor-pointer">
                  Sembunyikan akun ini dari daftar transaksi harian
                </label>
              </div>

              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-1/2"
                  onClick={() => setEditingAccount(null)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="w-1/2 bg-primary text-white"
                >
                  {updateMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modal 3: Sesuaikan Saldo Cepat (Quick Balance Adjustment) */}
      {/* ========================================================================= */}
      {adjustingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-sm rounded-2xl bg-card border shadow-2xl p-6 text-card-foreground">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div>
                <h2 className="text-base font-bold">Sesuaikan Saldo</h2>
                <p className="text-[11px] text-muted-foreground">
                  Akun: <span className="font-semibold text-foreground">{adjustingAccount.name}</span>
                </p>
              </div>
              <button
                onClick={() => setAdjustingAccount(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustBalance} className="space-y-4 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl space-y-1">
                <div className="text-[10px] text-muted-foreground">Saldo Tercatat Saat Ini</div>
                <div className="text-lg font-bold text-foreground">
                  {formatCurrency(adjustingAccount.currentBalance, adjustingAccount.currency)}
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground">
                  Saldo Riil / Baru ({adjustingAccount.currency})
                </label>
                <Input
                  type="number"
                  value={adjustingAccount.newBalance}
                  onChange={(e) =>
                    setAdjustingAccount({
                      ...adjustingAccount,
                      newBalance: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="mt-1 h-10 font-extrabold text-base text-primary"
                  autoFocus
                  required
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Selisih:{" "}
                  <span
                    className={
                      adjustingAccount.newBalance - adjustingAccount.currentBalance >= 0
                        ? "text-emerald-600 font-semibold"
                        : "text-rose-600 font-semibold"
                    }
                  >
                    {adjustingAccount.newBalance - adjustingAccount.currentBalance >= 0 ? "+" : ""}
                    {formatCurrency(
                      adjustingAccount.newBalance - adjustingAccount.currentBalance,
                      adjustingAccount.currency
                    )}
                  </span>
                </span>
              </div>

              <div className="pt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-1/2"
                  onClick={() => setAdjustingAccount(null)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={adjustBalanceMutation.isPending}
                  className="w-1/2 bg-primary text-white"
                >
                  {adjustBalanceMutation.isPending ? "Menyimpan..." : "Update Saldo"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
