"use client";

import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  ShieldCheck,
  Key,
  Bot,
  User,
  Plus,
  Copy,
  Check,
  Trash2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const [tokenName, setTokenName] = useState("");
  const [generatedRawToken, setGeneratedRawToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: tokensList } = trpc.ai.listTokens.useQuery();
  const { data: mcpLogs } = trpc.ai.listMcpLogs.useQuery({ limit: 10 });

  const createTokenMutation = trpc.ai.createToken.useMutation({
    onSuccess: (data) => {
      setGeneratedRawToken(data.rawToken);
      setTokenName("");
      utils.ai.listTokens.invalidate();
    },
  });

  const handleCopy = () => {
    if (generatedRawToken) {
      navigator.clipboard.writeText(generatedRawToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan & Keamanan</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Kelola profil akun, autentikasi 2FA, token integrasi MCP, dan riwayat akses AI.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profil & 2FA Card */}
        <Card className="p-6">
          <h3 className="font-bold text-base flex items-center gap-2 mb-4">
            <User className="h-4 w-4 text-primary" />
            Profil & Akun
          </h3>
          <div className="space-y-4 text-xs">
            <div>
              <label className="text-muted-foreground font-medium">Email Pengguna</label>
              <div className="font-semibold text-foreground text-sm mt-0.5">owner@finiq.app</div>
            </div>

            <div>
              <label className="text-muted-foreground font-medium">Mata Uang Utama</label>
              <div className="font-semibold text-foreground text-sm mt-0.5">IDR (Rupiah Indonesia)</div>
            </div>

            <div className="pt-3 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Two-Factor Authentication (2FA)
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Amankan akun Anda dengan kode TOTP (Google Authenticator).
                  </p>
                </div>
                <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                  Siap Diaktifkan
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* PAT & MCP Token Management */}
        <Card className="p-6">
          <h3 className="font-bold text-base flex items-center gap-2 mb-2">
            <Key className="h-4 w-4 text-primary" />
            Personal Access Token (PAT / MCP)
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Token API untuk menghubungkan Fin.IQ dengan Claude Desktop, Cursor, atau LLM Agent via protokol MCP.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!tokenName.trim()) return;
              createTokenMutation.mutate({ name: tokenName.trim() });
            }}
            className="flex gap-2 text-xs"
          >
            <Input
              type="text"
              placeholder="Nama token (misal: Claude Desktop)"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              className="h-9"
              required
            />
            <Button type="submit" size="sm" className="bg-primary text-white">
              Generate
            </Button>
          </form>

          {/* Raw Token Display Modal/Banner */}
          {generatedRawToken && (
            <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 text-xs">
              <span className="font-bold text-amber-800 dark:text-amber-300">Simpan Token Ini (Hanya Muncul Sekali):</span>
              <div className="flex items-center gap-2 mt-1.5 font-mono text-[11px] bg-background p-2 rounded border">
                <span className="truncate">{generatedRawToken}</span>
                <button onClick={handleCopy} className="ml-auto text-primary p-1">
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Active Tokens List */}
          <div className="mt-4 space-y-2 text-xs">
            {tokensList?.map((tok) => (
              <div key={tok.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
                <div>
                  <div className="font-semibold text-foreground">{tok.name}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{tok.prefix}...</div>
                </div>
                <Badge variant="outline" className="text-[10px]">Aktif</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Audit Log MCP Calls */}
      <Card className="p-6">
        <h3 className="font-bold text-base flex items-center gap-2 mb-2">
          <Bot className="h-4 w-4 text-primary" />
          Audit Log Panggilan AI / MCP
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Riwayat audit saat AI tools membaca atau mencatat transaksi.
        </p>

        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground">
                <th className="p-2.5">Waktu</th>
                <th className="p-2.5">Tool Name</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Ringkasan Argumen</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {mcpLogs?.map((log) => (
                <tr key={log.id}>
                  <td className="p-2.5 text-muted-foreground">{new Date(log.calledAt).toLocaleString("id-ID")}</td>
                  <td className="p-2.5 font-mono font-semibold">{log.toolName}</td>
                  <td className="p-2.5">
                    <Badge variant={log.status === "ok" ? "income" : "destructive"}>
                      {log.status}
                    </Badge>
                  </td>
                  <td className="p-2.5 text-muted-foreground truncate max-w-xs">{log.argsSummary || "-"}</td>
                </tr>
              ))}
              {(!mcpLogs || mcpLogs.length === 0) && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    Belum ada riwayat pemanggilan AI tool.
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
