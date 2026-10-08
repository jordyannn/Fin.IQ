"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Register specific states
  const [displayName, setDisplayName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currency, setCurrency] = useState("IDR");

  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Gagal masuk. Periksa kembali email dan kata sandi Anda.");
        setIsLoading(false);
        return;
      }

      setSuccessMessage("Berhasil masuk! Mengarahkan ke halaman ringkasan...");
      setTimeout(() => {
        router.push("/overview");
        router.refresh();
      }, 700);
    } catch {
      setErrorMessage("Terjadi gangguan koneksi. Silakan coba lagi.");
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Kata sandi minimal harus 6 karakter.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          email: email.trim(),
          password,
          primaryCurrency: currency,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Pendaftaran gagal. Silakan coba lagi.");
        setIsLoading(false);
        return;
      }

      setSuccessMessage("Akun berhasil dibuat! Mengalihkan ke dashboard...");
      setTimeout(() => {
        router.push("/overview");
        router.refresh();
      }, 700);
    } catch {
      setErrorMessage("Terjadi gangguan jaringan saat mendaftarkan akun.");
      setIsLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setEmail("owner@finiq.app");
    setPassword("123456");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "owner@finiq.app", password: "123456" }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMessage("Masuk sebagai Akun Demo (Owner). Membuka dashboard...");
        setTimeout(() => {
          router.push("/overview");
          router.refresh();
        }, 600);
      } else {
        setErrorMessage(data.error || "Gagal masuk akun demo.");
        setIsLoading(false);
      }
    } catch {
      setErrorMessage("Terjadi kendala saat menghubungkan akun demo.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-6">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Fin.IQ
          </h1>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-xs">
            Manajemen Keuangan Personal Modern &amp; Cerdas
          </p>
        </div>

        {/* Auth Card */}
        <Card className="p-6 sm:p-7 shadow-lg border-border/70 rounded-2xl backdrop-blur-md">
          {/* Segmented Tab Controls */}
          <div className="grid grid-cols-2 p-1 mb-6 rounded-xl bg-muted/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveTab("login");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                activeTab === "login"
                  ? "bg-card text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("register");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                activeTab === "register"
                  ? "bg-card text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Daftar Akun Baru
            </button>
          </div>

          {/* Error & Success Feedback Banners */}
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-xs animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#00B569]" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form: LOGIN */}
          {activeTab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-foreground block mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-11 text-xs rounded-xl"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Kata Sandi</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-9 h-11 text-xs rounded-xl"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Toggle password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#00B569] hover:bg-[#009E5B] text-white h-11 font-bold text-sm rounded-xl shadow-md shadow-emerald-500/25 mt-2 transition-all active:scale-[0.99]"
              >
                {isLoading ? "Memproses..." : "Masuk ke Fin.IQ"}
              </Button>

              {/* Quick Demo Section */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-border"></div>
                <span className="flex-shrink mx-3 text-[10px] uppercase text-muted-foreground font-semibold">
                  Akses Cepat
                </span>
                <div className="flex-grow border-t border-border"></div>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                onClick={handleQuickDemo}
                className="w-full h-10 text-xs font-semibold gap-2 border-emerald-300 dark:border-emerald-800 text-[#00B569] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Quick Demo Login (Akun Owner)
              </Button>
            </form>
          ) : (
            /* Form: REGISTER */
            <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-foreground block mb-1">Nama Lengkap</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Contoh: Jordan"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="pl-9 h-10 text-xs rounded-xl"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-10 text-xs rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1">Kata Sandi</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="Min. 6 digit"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 h-10 text-xs rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1">Ulangi Sandi</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="Konfirmasi"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-9 h-10 text-xs rounded-xl"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">Mata Uang Utama</label>
                <div className="relative">
                  <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full pl-9 h-10 text-xs rounded-xl border border-input bg-background text-foreground px-3 font-medium focus:ring-2 focus:ring-primary/20 outline-none"
                  >
                    <option value="IDR">IDR — Rupiah Indonesia</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="SGD">SGD — Singapore Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="JPY">JPY — Japanese Yen</option>
                  </select>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#00B569] hover:bg-[#009E5B] text-white h-11 font-bold text-sm rounded-xl shadow-md shadow-emerald-500/25 mt-2 transition-all active:scale-[0.99]"
              >
                {isLoading ? "Mendaftarkan..." : "Daftar Akun Baru"}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </form>
          )}
        </Card>

        {/* Footer info */}
        <p className="text-[11px] text-center text-muted-foreground mt-6">
          Fin.IQ &bull; Keamanan data terenkripsi &bull; Standar Fintech Terpercaya
        </p>
      </div>
    </div>
  );
}
