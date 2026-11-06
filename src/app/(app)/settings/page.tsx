"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Lock,
  LogOut,
  Save,
  Wallet,
  Receipt,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Globe,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/store/confirm.store";
import { GeometricIcon } from "@/components/ui/GeometricIcon";
import { useTranslation } from "@/i18n";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export default function SettingsPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const confirm = useConfirm();
  const { t, locale } = useTranslation();
  const isEn = locale === "en";

  // Gemini AI Key State
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiMsg, setGeminiMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const setGeminiKeyMutation = trpc.user.setGeminiKey.useMutation({
    onSuccess: (res) => {
      setGeminiMsg({ type: "success", text: res.message });
      setGeminiKeyInput("");
      utils.user.getProfile.invalidate();
      utils.user.testGeminiStatus.invalidate();
      setTimeout(() => setGeminiMsg(null), 4000);
    },
    onError: (err) => {
      setGeminiMsg({ type: "error", text: err.message });
      setTimeout(() => setGeminiMsg(null), 5000);
    },
  });

  const removeGeminiKeyMutation = trpc.user.removeGeminiKey.useMutation({
    onSuccess: (res) => {
      setGeminiMsg({ type: "success", text: res.message });
      utils.user.getProfile.invalidate();
      utils.user.testGeminiStatus.invalidate();
      setTimeout(() => setGeminiMsg(null), 3000);
    },
    onError: (err) => {
      setGeminiMsg({ type: "error", text: err.message });
      setTimeout(() => setGeminiMsg(null), 4000);
    },
  });

  const { data: geminiStatus } = trpc.user.testGeminiStatus.useQuery();

  // Profile Query
  const { data: profile, isLoading: isProfileLoading } = trpc.user.getProfile.useQuery();

  // Profile Form state
  const [displayName, setDisplayName] = useState("");
  const [currency, setCurrency] = useState("IDR");
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync profile data to state once loaded
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || "");
      setCurrency(profile.primaryCurrency || "IDR");
    }
  }, [profile]);

  // Update Profile Mutation
  const updateProfileMutation = trpc.user.updateProfile.useMutation({
    onSuccess: (res) => {
      setProfileMsg({ type: "success", text: res.message });
      utils.user.getProfile.invalidate();
      setTimeout(() => setProfileMsg(null), 3000);
    },
    onError: (err) => {
      setProfileMsg({ type: "error", text: err.message });
      setTimeout(() => setProfileMsg(null), 4000);
    },
  });

  // Password Change State
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const changePasswordMutation = trpc.user.changePassword.useMutation({
    onSuccess: (res) => {
      setPasswordMsg({ type: "success", text: res.message });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordChange(false);
      setTimeout(() => setPasswordMsg(null), 3000);
    },
    onError: (err) => {
      setPasswordMsg({ type: "error", text: err.message });
      setTimeout(() => setPasswordMsg(null), 4000);
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg({
        type: "error",
        text: isEn ? "New password confirmation does not match." : "Konfirmasi kata sandi baru tidak cocok.",
      });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({
        type: "error",
        text: isEn ? "New password must be at least 6 characters." : "Kata sandi baru minimal 6 karakter.",
      });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  // Logout handler
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const handleLogout = async () => {
    const ok = await confirm({
      title: isEn ? "Log out from Fin.IQ?" : "Keluar dari Akun Fin.IQ?",
      description: isEn
        ? "Your session will end and you will need to log back in to access bookkeeping."
        : "Sesi Anda akan diakhiri dan Anda perlu masuk kembali untuk mengakses pembukuan.",
      confirmText: isEn ? "Log Out" : "Keluar",
      cancelText: isEn ? "Cancel" : "Batal",
      variant: "warning",
      icon: "logout",
    });
    if (!ok) return;
    setIsLoggingOut(true);
    try {
      sessionStorage.removeItem("finiq_demo_session_welcomed");
      sessionStorage.removeItem("finiq_demo_tour_trigger");
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  // MCP / PAT Token Management
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
    <div className="flex flex-col gap-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-[#A7F3D0]/40 flex items-center justify-center text-[#064E3B] shrink-0">
            <GeometricIcon name="settings" className="h-4 w-4" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.settings.title}</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {t.settings.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Profil & Akun Card */}
        <Card className="p-4 sm:p-5 rounded-md shadow-level-1 border border-border/80 bg-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-border/60 mb-4 sm:mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#A7F3D0]/40 text-[#064E3B] font-black text-base border border-[#059669]/20">
                  {profile?.displayName
                    ? profile.displayName.substring(0, 2).toUpperCase()
                    : "FQ"}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-foreground">
                    {profile?.displayName || (isEn ? "Loading..." : "Memuat...")}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{profile?.email}</span>
                    <Badge className="bg-[#A7F3D0]/40 text-[#064E3B] text-[10px] px-2 py-0 border-none font-semibold rounded-sm">
                      {isEn ? "Active" : "Aktif"}
                    </Badge>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="text-xs font-semibold text-[#BA1A1A] hover:bg-[#BA1A1A]/10 border-[#BA1A1A]/30 rounded-sm gap-1.5 h-8 px-2.5"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{isEn ? "Log Out" : "Keluar"}</span>
              </Button>
            </div>

            {/* Profile Feedback message */}
            {profileMsg && (
              <div
                className={`flex items-center gap-2 p-2.5 mb-4 rounded-sm text-xs ${
                  profileMsg.type === "success"
                    ? "bg-[#A7F3D0]/30 text-[#064E3B] border border-[#059669]/20"
                    : "bg-[#BA1A1A]/10 text-[#BA1A1A] border border-[#BA1A1A]/20"
                }`}
              >
                {profileMsg.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{profileMsg.text}</span>
              </div>
            )}

            {/* Form edit profil */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateProfileMutation.mutate({
                  displayName: displayName.trim(),
                  primaryCurrency: currency,
                });
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="font-semibold text-foreground block mb-1">{isEn ? "Full Name" : "Nama Lengkap"}</label>
                <Input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={isEn ? "Your display name" : "Nama tampilan Anda"}
                  className="h-9 sm:h-10 text-xs rounded-md"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">{isEn ? "Primary Currency" : "Mata Uang Utama"}</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full h-9 sm:h-10 text-xs rounded-md border border-border bg-card text-foreground pl-3 pr-8 font-medium shadow-2xs transition-all hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="IDR">{isEn ? "IDR : Indonesian Rupiah (Rp)" : "IDR : Rupiah Indonesia (Rp)"}</option>
                  <option value="USD">USD : US Dollar ($)</option>
                  <option value="SGD">SGD : Singapore Dollar (S$)</option>
                  <option value="EUR">EUR : Euro (€)</option>
                  <option value="JPY">JPY : Japanese Yen (¥)</option>
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {isEn ? "Base currency for portfolio balances and report calculations." : "Mata uang dasar untuk kalkulasi saldo portofolio dan laporan."}
                </p>
              </div>

              {/* Ringkasan Akun & Keuangan */}
              <div className="grid grid-cols-2 gap-2.5 pt-3 border-t">
                <div className="p-3 rounded-sm bg-slate-50 dark:bg-slate-900 border border-border/50">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium">
                    <GeometricIcon name="accounts" className="h-3.5 w-3.5" />
                    {isEn ? "Total Accounts" : "Jumlah Akun"}
                  </div>
                  <div className="text-base font-extrabold text-foreground mt-1">
                    {profile?.accountCount || 0} {isEn ? "Accounts" : "Akun"}
                  </div>
                </div>

                <div className="p-3 rounded-sm bg-slate-50 dark:bg-slate-900 border border-border/50">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium">
                    <Receipt className="h-3.5 w-3.5 text-[#059669]" />
                    {isEn ? "Total Transactions" : "Total Transaksi"}
                  </div>
                  <div className="text-base font-extrabold text-foreground mt-1">
                    {profile?.transactionCount || 0} {isEn ? "Records" : "Data"}
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending || isProfileLoading}
                  className="w-full bg-[#059669] hover:bg-[#047857] text-white font-semibold h-9 sm:h-10 rounded-md shadow-level-1 gap-2"
                >
                  <Save className="h-4 w-4" />
                  {updateProfileMutation.isPending
                    ? (isEn ? "Saving..." : "Menyimpan...")
                    : (isEn ? "Save Profile Changes" : "Simpan Perubahan Profil")}
                </Button>
              </div>
            </form>
          </div>

          {/* Password Change Toggle */}
          <div className="pt-3.5 border-t mt-4">
            <button
              type="button"
              onClick={() => setShowPasswordChange(!showPasswordChange)}
              className="flex items-center justify-between w-full text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-[#059669]" />
                {isEn ? "Change Password" : "Ubah Kata Sandi"}
              </span>
              <span className="text-[11px] text-[#059669]">
                {showPasswordChange
                  ? (isEn ? "Close" : "Tutup")
                  : (isEn ? "Open Form" : "Buka Formulir")}
              </span>
            </button>

            {passwordMsg && (
              <div
                className={`flex items-center gap-2 p-2 mt-3 rounded-sm text-xs ${
                  passwordMsg.type === "success"
                    ? "bg-[#A7F3D0]/30 text-[#064E3B] border border-[#059669]/20"
                    : "bg-[#BA1A1A]/10 text-[#BA1A1A] border border-[#BA1A1A]/20"
                }`}
              >
                <span>{passwordMsg.text}</span>
              </div>
            )}

            {showPasswordChange && (
              <form onSubmit={handlePasswordSubmit} className="mt-3 space-y-2.5 text-xs animate-in fade-in">
                <div>
                  <label className="text-muted-foreground font-medium block mb-1">
                    {isEn ? "Current Password" : "Kata Sandi Saat Ini"}
                  </label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-9 text-xs rounded-md"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground font-medium block mb-1">
                      {isEn ? "New Password" : "Kata Sandi Baru"}
                    </label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={isEn ? "Min. 6 characters" : "Min. 6 digit"}
                      className="h-9 text-xs rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground font-medium block mb-1">
                      {isEn ? "Confirm New Password" : "Konfirmasi Sandi Baru"}
                    </label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={isEn ? "Repeat new password" : "Ulangi sandi baru"}
                      className="h-9 text-xs rounded-md"
                      required
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={changePasswordMutation.isPending}
                  className="w-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold h-9 rounded-md"
                >
                  {changePasswordMutation.isPending
                    ? (isEn ? "Processing..." : "Memproses...")
                    : (isEn ? "Update Password" : "Perbarui Kata Sandi")}
                </Button>
              </form>
            )}
          </div>
        </Card>

        {/* Google Gemini AI Studio Token Card */}
        <Card className="p-4 sm:p-5 rounded-md shadow-sm border-border/70 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#A7F3D0]/40 text-[#064E3B]">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-foreground">
                    AI Financial Advisor &amp; API Key
                  </h3>
                  <p className="text-[11px] text-muted-foreground">{isEn ? "OpenRouter (Recommended) & Google Gemini connection" : "Koneksi OpenRouter (Direkomendasikan) & Google Gemini"}</p>
                </div>
              </div>

              {geminiStatus?.connected ? (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-none font-semibold text-[10px] gap-1 rounded-sm">
                  <CheckCircle2 className="h-3 w-3" />
                  {geminiStatus.source === "personal"
                    ? (isEn ? "Personal Key Active" : "Key Pribadi Aktif")
                    : (isEn ? "Server AI Active" : "AI Aktif")}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] gap-1 rounded-sm">
                  <AlertCircle className="h-3 w-3" />
                  {isEn ? "Not Connected" : "Belum Terhubung"}
                </Badge>
              )}
            </div>

            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              {isEn
                ? "Fin.IQ uses OpenRouter with free-tier models (Gemma 4, Nemotron, Flint) by default. You can connect your own personal OpenRouter API Key (sk-or-v1-...) or Google Gemini API Key (AIzaSy...) for dedicated priority access."
                : "Fin.IQ menggunakan OpenRouter dengan model free-tier (Gemma 4, Nemotron, Flint) secara otomatis untuk setiap akun. Anda juga dapat memasukkan API Key pribadi OpenRouter (sk-or-v1-...) atau Google Gemini (AIzaSy...) untuk akses prioritas."}
            </p>

            {/* Token status feedback */}
            {geminiMsg && (
              <div
                className={`flex items-center gap-2 p-2.5 mb-4 rounded-sm text-xs ${
                  geminiMsg.type === "success"
                    ? "bg-[#A7F3D0]/30 text-[#064E3B] border border-[#059669]/20"
                    : "bg-[#BA1A1A]/10 text-[#BA1A1A] border border-[#BA1A1A]/20"
                }`}
              >
                {geminiMsg.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{geminiMsg.text}</span>
              </div>
            )}

            {/* Active Key Info */}
            {profile?.geminiApiKeyMasked && (
              <div className="p-3 rounded-sm bg-muted/40 border border-border/60 mb-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                    {isEn ? "Currently Saved Key" : "API Key Tersimpan Saat Ini"}
                  </span>
                  <span className="font-mono text-xs font-bold text-foreground">
                    {profile.geminiApiKeyMasked}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={removeGeminiKeyMutation.isPending}
                  onClick={async () => {
                    const ok = await confirm({
                      title: isEn ? "Disconnect AI API Key?" : "Putuskan API Key AI?",
                      description: isEn
                        ? "Your personal API Key will be removed from your account. AI features will fallback to server defaults."
                        : "API Key pribadi Anda akan dihapus dari akun. Fitur AI akan kembali menggunakan konfigurasi bawaan.",
                      confirmText: isEn ? "Disconnect" : "Putuskan Sambungan",
                      variant: "warning",
                      icon: "unlink",
                    });
                    if (ok) {
                      removeGeminiKeyMutation.mutate();
                    }
                  }}
                  className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 h-7 px-2.5 rounded-sm"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  {isEn ? "Disconnect" : "Putuskan"}
                </Button>
              </div>
            )}

            {/* Form Input Key */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!geminiKeyInput.trim()) return;
                setGeminiKeyMutation.mutate({ apiKey: geminiKeyInput.trim() });
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  {profile?.geminiApiKeyMasked
                    ? (isEn ? "Replace AI API Key" : "Ganti API Key AI")
                    : (isEn ? "Enter OpenRouter or Gemini API Key" : "Masukkan API Key OpenRouter atau Gemini")}
                </label>
                <div className="relative">
                  <Input
                    type={showGeminiKey ? "text" : "password"}
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    placeholder={isEn ? "Paste OpenRouter (sk-or-v1-...) or Gemini (AIzaSy...)" : "Tempel OpenRouter (sk-or-v1-...) atau Gemini (AIzaSy...)"}
                    className="h-9 sm:h-10 text-xs rounded-md pr-10 font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <Button
                  type="submit"
                  disabled={setGeminiKeyMutation.isPending || !geminiKeyInput.trim()}
                  className="bg-[#059669] hover:bg-[#047857] text-white font-semibold h-8 sm:h-9 px-4 rounded-md text-xs gap-1.5 shadow-level-1"
                >
                  {setGeminiKeyMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {isEn ? "Verifying Key..." : "Memverifikasi Key..."}
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      {isEn ? "Verify & Connect" : "Verifikasi & Sambungkan"}
                    </>
                  )}
                </Button>
                <div className="flex items-center gap-3 sm:ml-auto">
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-[#059669] hover:underline font-medium"
                  >
                    OpenRouter Keys
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <span className="text-muted-foreground/40 text-[11px]">•</span>
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-[#059669] hover:underline font-medium"
                  >
                    Google AI Studio
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </form>
          </div>

          <div className="pt-4 border-t mt-4 text-[11px] text-muted-foreground">
            {isEn
              ? <>Active AI Models: <span className="font-semibold text-foreground">Google Gemma 4, Nemotron 3.5, Gemini 3 Flash</span>. Auto-fallback ensures zero downtime for all accounts.</>
              : <>Model AI Aktif: <span className="font-semibold text-foreground">Google Gemma 4, Nemotron 3.5, Gemini 3 Flash</span>. Dilengkapi auto-fallback agar AI selalu aktif untuk setiap akun.</>}
          </div>
        </Card>

        {/* PAT & MCP Token Management Card */}
        <Card className="p-4 sm:p-5 rounded-md shadow-sm border-border/70 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 pb-3 border-b">
              <Key className="h-4 w-4 text-[#059669]" />
              <h3 className="font-extrabold text-base text-foreground">
                Personal Access Token (PAT / MCP)
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {isEn
                ? "API token to connect Fin.IQ with Claude Desktop, Cursor, or LLM agents via MCP protocol."
                : "Token API untuk menghubungkan Fin.IQ dengan Claude Desktop, Cursor, atau LLM Agent via protokol MCP."}
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
                placeholder={isEn ? "Token name (e.g. Claude Desktop)" : "Nama token (misal: Claude Desktop)"}
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                className="h-9 sm:h-10 text-xs rounded-md"
                required
              />
              <Button
                type="submit"
                disabled={createTokenMutation.isPending}
                className="bg-[#059669] hover:bg-[#047857] text-white font-semibold h-9 sm:h-10 px-4 rounded-md shadow-level-1 shrink-0"
              >
                {createTokenMutation.isPending ? "..." : (isEn ? "Generate" : "Generate")}
              </Button>
            </form>

            {/* Raw Token Display Modal/Banner */}
            {generatedRawToken && (
              <div className="mt-4 p-3 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-300 text-xs">
                <span className="font-bold text-amber-800 dark:text-amber-300">
                  {isEn ? "Save This Token (Displayed Only Once):" : "Simpan Token Ini (Hanya Muncul Sekali):"}
                </span>
                <div className="flex items-center gap-2 mt-1.5 font-mono text-[11px] bg-background p-2 rounded-sm border">
                  <span className="truncate">{generatedRawToken}</span>
                  <button onClick={handleCopy} className="ml-auto text-[#059669] p-1">
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Active Tokens List */}
            <div className="mt-4 space-y-2 text-xs">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {isEn ? "Active Tokens List" : "Daftar Token Aktif"}
              </div>
              {tokensList?.map((tok) => (
                <div key={tok.id} className="flex items-center justify-between p-2.5 rounded-sm border bg-muted/30">
                  <div>
                    <div className="font-semibold text-foreground">{tok.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{tok.prefix}...</div>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 rounded-sm">
                    {isEn ? "Active" : "Aktif"}
                  </Badge>
                </div>
              ))}
              {(!tokensList || tokensList.length === 0) && (
                <p className="text-[11px] text-muted-foreground italic py-2">
                  {isEn ? "No PAT generated yet." : "Belum ada PAT yang dibuat."}
                </p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t mt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#059669]" />
                  Two-Factor Authentication (2FA)
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isEn ? "TOTP protection (Google Authenticator)" : "Proteksi TOTP (Google Authenticator)"}
                </p>
              </div>
              <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-[10px] rounded-sm">
                {isEn ? "Available" : "Tersedia"}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Preferensi Bahasa / Language Preferences Card */}
        <Card className="p-4 sm:p-5 rounded-md shadow-sm border border-border/80 bg-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#A7F3D0]/40 text-[#064E3B]">
                  <Globe className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-foreground">
                    {t.settings.languageSection}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">{t.settings.languageDesc}</p>
                </div>
              </div>
              <Badge className="bg-[#A7F3D0]/40 text-[#064E3B] text-[10px] px-2 py-0 border-none font-semibold rounded-sm">
                {locale === "en" ? "English (EN)" : "Indonesia (ID)"}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              {locale === "en"
                ? "Fin.IQ uses clean, professional financial English with locale-adapted date and currency formatting."
                : "Fin.IQ menggunakan Bahasa Indonesia standar perbankan modern dengan format tanggal dan nominal angka yang disesuaikan."}
            </p>

            <div className="flex items-center justify-between p-3 rounded-md border border-border/70 bg-muted/30">
              <div>
                <div className="text-xs font-bold text-foreground">{t.settings.activeLanguage}</div>
                <div className="text-[11px] text-muted-foreground">
                  {locale === "en" ? "Active: English (EN)" : "Aktif: Bahasa Indonesia (ID)"}
                </div>
              </div>
              <LanguageSwitcher size="md" />
            </div>
          </div>

          <div className="pt-4 border-t mt-6 text-[11px] text-muted-foreground">
            {locale === "en"
              ? "Language preference is automatically saved to your browser session."
              : "Preferensi bahasa tersimpan otomatis di sesi peramban Anda."}
          </div>
        </Card>
      </div>

      {/* Audit Log MCP Calls */}
      <Card className="p-4 sm:p-5 rounded-md shadow-sm border-border/70">
        <div className="flex items-center gap-2 mb-2">
          <GeometricIcon name="ai" className="h-4 w-4" />
          <h3 className="font-extrabold text-base text-foreground">
            {isEn ? "AI / MCP Audit Logs" : "Audit Log Panggilan AI / MCP"}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {isEn
            ? "Audit history when AI tools read or record transactions automatically."
            : "Riwayat audit saat AI tools membaca atau mencatat transaksi secara otomatis."}
        </p>

        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                <th className="p-2.5 rounded-l-sm">{isEn ? "Time" : "Waktu"}</th>
                <th className="p-2.5">Tool Name</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 rounded-r-sm">{isEn ? "Arguments Summary" : "Ringkasan Argumen"}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {mcpLogs?.map((log) => (
                <tr key={log.id}>
                  <td className="p-2.5 text-muted-foreground">
                    {new Date(log.calledAt).toLocaleString(isEn ? "en-US" : "id-ID")}
                  </td>
                  <td className="p-2.5 font-mono font-semibold">{log.toolName}</td>
                  <td className="p-2.5">
                    <Badge variant={log.status === "ok" ? "income" : "destructive"} className="rounded-sm text-[10px]">
                      {log.status}
                    </Badge>
                  </td>
                  <td className="p-2.5 text-muted-foreground truncate max-w-xs">{log.argsSummary || "-"}</td>
                </tr>
              ))}
              {(!mcpLogs || mcpLogs.length === 0) && (
                <tr>
                  <td colSpan={4} className="p-6 sm:p-8 text-center text-muted-foreground">
                    {isEn ? "No AI tool call logs yet." : "Belum ada riwayat pemanggilan AI tool."}
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
