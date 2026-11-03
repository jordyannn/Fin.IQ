"use client";

import React, { useState } from "react";
import {
  Users,
  Search,
  Shield,
  ShieldAlert,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Calendar,
  CreditCard,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface UserItem {
  id: string;
  email: string;
  displayName: string;
  primaryCurrency: string;
  isAdmin: boolean;
  isEnabled: boolean;
  createdAt: Date | string;
  lastLoginAt: Date | string | null;
  transactionCount: number;
}

interface UsersTabProps {
  data?: {
    users: UserItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  isLoading: boolean;
  search: string;
  setSearch: (s: string) => void;
  page: number;
  setPage: (p: number) => void;
  onToggleEnabled: (userId: string, currentEnabled: boolean) => Promise<void>;
  onToggleAdmin: (userId: string, currentAdmin: boolean) => Promise<void>;
}

export function UsersTab({
  data,
  isLoading,
  search,
  setSearch,
  page,
  setPage,
  onToggleEnabled,
  onToggleAdmin,
}: UsersTabProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleToggleStatus = async (user: UserItem) => {
    if (processingId) return;
    const action = user.isEnabled ? "menonaktifkan" : "mengaktifkan";
    if (!confirm(`Apakah Anda yakin ingin ${action} akun ${user.email}?`)) {
      return;
    }

    setProcessingId(user.id);
    try {
      await onToggleEnabled(user.id, !user.isEnabled);
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleAdminRole = async (user: UserItem) => {
    if (processingId) return;
    const action = user.isAdmin ? "mencabut status admin dari" : "memberikan hak akses ADMIN kepada";
    if (!confirm(`Konfirmasi keamanan: Apakah Anda yakin ingin ${action} akun ${user.email}?`)) {
      return;
    }

    setProcessingId(user.id);
    try {
      await onToggleAdmin(user.id, !user.isAdmin);
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (val: Date | string | null) => {
    if (!val) return "-";
    const d = new Date(val);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Search & Stats Bar */}
      <Card className="p-4 border-border/80 bg-card">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari email pengguna..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-9 text-xs rounded-lg"
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground w-full sm:w-auto justify-between sm:justify-end">
            <span>
              Total: <strong className="text-foreground font-semibold">{data?.total ?? 0}</strong> akun
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1 || isLoading}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 text-xs">
                {page} / {data?.totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= (data?.totalPages || 1) || isLoading}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card className="border-border/80 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border/70 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Pengguna</th>
                <th className="py-3 px-4">Peran (Role)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Login Terakhir</th>
                <th className="py-3 px-4">Transaksi</th>
                <th className="py-3 px-4">Tgl Daftar</th>
                <th className="py-3 px-4 text-right">Aksi Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data && data.users.length > 0 ? (
                data.users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                    {/* User Profile */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                          {user.displayName.charAt(0) || user.email.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate max-w-[180px]">
                            {user.displayName}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3 px-4">
                      {user.isAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                          <Shield className="h-3 w-3" />
                          ADMIN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                          User Biasa
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      {user.isEnabled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                          Dinonaktifkan
                        </span>
                      )}
                    </td>

                    {/* Last Login */}
                    <td className="py-3 px-4 text-muted-foreground text-[11px]">
                      {formatDate(user.lastLoginAt)}
                    </td>

                    {/* Transaction Count */}
                    <td className="py-3 px-4">
                      <span className="font-semibold text-foreground">
                        {user.transactionCount.toLocaleString("id-ID")}
                      </span>
                    </td>

                    {/* Registered Date */}
                    <td className="py-3 px-4 text-muted-foreground text-[11px]">
                      {formatDate(user.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={processingId === user.id}
                          onClick={() => handleToggleStatus(user)}
                          className={`h-7 px-2 text-[11px] font-medium gap-1 ${
                            user.isEnabled
                              ? "text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                              : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                          }`}
                        >
                          {user.isEnabled ? (
                            <>
                              <UserX className="h-3.5 w-3.5" />
                              <span className="hidden md:inline">Nonaktifkan</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3.5 w-3.5" />
                              <span className="hidden md:inline">Aktifkan</span>
                            </>
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={processingId === user.id}
                          onClick={() => handleToggleAdminRole(user)}
                          className="h-7 px-2 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                          title={user.isAdmin ? "Cabut Admin" : "Jadikan Admin"}
                        >
                          <Shield className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                    {isLoading ? "Memuat data pengguna..." : "Tidak ada pengguna ditemukan."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

