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
import { GeometricIcon } from "@/components/ui/GeometricIcon";

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
          <div className="flex items-center gap-2.5 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#059669] text-white shadow-level-1">
              <GeometricIcon name="overview" className="h-5 w-5" />
            </div>
            <span className="text-2xl font-black tracking-tight text-foreground">
              Fin<span className="text-[#059669]">.IQ</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground max-w-xs">
            Buku kas presisi dan asisten intelijen finansial.
          </p>
        </div>

        {/* Auth Card */}
        <Card className="p-6 sm:p-7 shadow-level-2 border border-border/80 rounded-md bg-card">
          {/* Segmented Tab Controls */}
          <div className="grid grid-cols-2 p-1 mb-6 rounded-md bg-slate-100 dark:bg-slate-800/60 text-xs font-semibold border border-border/50">
            <button
              type="button"
              onClick={() => {
                setActiveTab("login");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2 rounded-sm transition-all ${
                activeTab === "login"
                  ? "bg-white dark:bg-slate-900 text-foreground shadow-sm font-bold"
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
              className={`py-2 rounded-sm transition-all ${
                activeTab === "register"
                  ? "bg-white dark:bg-slate-900 text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Daftar Akun Baru
            </button>
          </div>

          {/* Error & Success Feedback Banners */}
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-sm bg-[#BA1A1A]/10 border border-[#BA1A1A]/20 text-[#BA1A1A] text-xs animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-[#BA1A1A]" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-sm bg-[#A7F3D0]/30 border border-[#059669]/20 text-[#064E3B] text-xs animate-in fade-in">
              <GeometricIcon name="check" className="h-4 w-4 shrink-0" />
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
                    className="pl-9 h-10 text-xs rounded-[10px]"
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
                    className="pl-9 pr-9 h-10 text-xs rounded-[10px]"
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
                className="w-full bg-[#059669] hover:bg-[#047857] text-white h-10 font-semibold text-xs rounded-[10px] shadow-level-1 mt-2 transition-all active:scale-[0.99]"
              >
                {isLoading ? "Memproses..." : "Masuk ke Fin.IQ"}
              </Button>

              {/* Quick Demo Section */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-border/60"></div>
                <span className="flex-shrink mx-3 text-[10px] uppercase text-muted-foreground font-semibold">
                  Akses Demo Cepat
                </span>
                <div className="flex-grow border-t border-border/60"></div>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                onClick={handleQuickDemo}
                className="w-full h-10 text-xs font-semibold gap-2 border border-border/80 text-[#064E3B] bg-[#A7F3D0]/20 hover:bg-[#A7F3D0]/35 rounded-[10px]"
              >
                <GeometricIcon name="sparkles" className="h-3.5 w-3.5" />
                Masuk Akun Demo (Owner)
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
                    className="pl-9 h-10 text-xs rounded-[10px]"
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
                    className="pl-9 h-10 text-xs rounded-[10px]"
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
                      className="pl-9 h-10 text-xs rounded-[10px]"
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
                      className="pl-9 h-10 text-xs rounded-[10px]"
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
                    className="w-full pl-9 h-10 text-xs rounded-[10px] border border-input bg-background text-foreground px-3 font-medium focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] outline-none"
                  >
                    <option value="IDR">IDR : Rupiah Indonesia</option>
                    <option value="USD">USD : US Dollar</option>
                    <option value="SGD">SGD : Singapore Dollar</option>
                    <option value="EUR">EUR : Euro</option>
                    <option value="JPY">JPY : Japanese Yen</option>
                  </select>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#059669] hover:bg-[#047857] text-white h-10 font-semibold text-xs rounded-[10px] shadow-level-1 mt-2 transition-all active:scale-[0.99]"
              >
                {isLoading ? "Mendaftarkan..." : "Daftar Akun Baru"}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </form>
          )}
        </Card>

        {/* Footer info */}
        <p className="text-[11px] text-center text-muted-foreground mt-6">
          Fin.IQ : Enkripsi end-to-end : Pembukuan kas presisi
        </p>
      </div>
    </div>
  );
}

