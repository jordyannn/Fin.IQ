"use client";

import React, { useState } from "react";
import Image from "next/image";
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
import { useTranslation } from "@/i18n";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export default function LoginPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const isEn = locale === "en";
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
        setErrorMessage(
          data.error ||
            (isEn
              ? "Failed to log in. Please check your email and password."
              : "Gagal masuk. Periksa kembali email dan kata sandi Anda.")
        );
        setIsLoading(false);
        return;
      }

      if (email.toLowerCase().trim() === "owner@finiq.app") {
        try {
          sessionStorage.setItem("finiq_demo_tour_trigger", "true");
          sessionStorage.removeItem("finiq_demo_session_welcomed");
          localStorage.removeItem("finiq_tour_completed");
          localStorage.removeItem("finiq_tour_welcomed");
          localStorage.removeItem("finiq_tech_tour_completed");
          localStorage.removeItem("finiq_tour_choice");
        } catch {}
      }

      const destination = data.user?.isAdmin ? "/admin/monitor" : "/overview";
      setSuccessMessage(
        data.user?.isAdmin
          ? (isEn ? "Signed in as Admin! Redirecting to monitor dashboard..." : "Masuk sebagai Admin! Mengarahkan ke dashboard monitor...")
          : (isEn ? "Signed in successfully! Redirecting to overview..." : "Berhasil masuk! Mengarahkan ke halaman ringkasan...")
      );
      setTimeout(() => {
        router.push(destination);
        router.refresh();
      }, 700);
    } catch {
      setErrorMessage(
        isEn
          ? "Connection error. Please try again."
          : "Terjadi gangguan koneksi. Silakan coba lagi."
      );
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage(
        isEn
          ? "Password confirmation does not match."
          : "Konfirmasi kata sandi tidak cocok."
      );
      return;
    }

    if (password.length < 6) {
      setErrorMessage(
        isEn
          ? "Password must be at least 6 characters."
          : "Kata sandi minimal harus 6 karakter."
      );
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
        setErrorMessage(
          data.error ||
            (isEn
              ? "Registration failed. Please try again."
              : "Pendaftaran gagal. Silakan coba lagi.")
        );
        setIsLoading(false);
        return;
      }

      setSuccessMessage(
        isEn
          ? "Account created successfully! Redirecting to dashboard..."
          : "Akun berhasil dibuat! Mengalihkan ke dashboard..."
      );
      setTimeout(() => {
        router.push("/overview");
        router.refresh();
      }, 700);
    } catch {
      setErrorMessage(
        isEn
          ? "Network error while registering account."
          : "Terjadi gangguan jaringan saat mendaftarkan akun."
      );
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
        try {
          sessionStorage.setItem("finiq_demo_tour_trigger", "true");
          sessionStorage.removeItem("finiq_demo_session_welcomed");
          localStorage.removeItem("finiq_tour_completed");
          localStorage.removeItem("finiq_tour_welcomed");
          localStorage.removeItem("finiq_tech_tour_completed");
          localStorage.removeItem("finiq_tour_choice");
        } catch {}

        setSuccessMessage(
          isEn
            ? "Signed in as Demo Account. Opening dashboard..."
            : "Masuk sebagai Akun Demo. Membuka dashboard..."
        );
        setTimeout(() => {
          router.push("/overview");
          router.refresh();
        }, 600);
      } else {
        setErrorMessage(
          data.error || (isEn ? "Failed to sign in to demo account." : "Gagal masuk akun demo.")
        );
        setIsLoading(false);
      }
    } catch {
      setErrorMessage(
        isEn
          ? "Error connecting demo account."
          : "Terjadi kendala saat menghubungkan akun demo."
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-6">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6 relative">
          <div className="absolute right-0 top-0">
            <LanguageSwitcher size="sm" />
          </div>
          <div className="flex flex-col items-center gap-2 mb-2">
            <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 flex items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-amber-500/10 border border-emerald-500/30 shadow-level-1 hover:scale-105 transition-all p-1">
              <Image
                src="/mascot/mascot-logo.png"
                alt="Fin.IQ Official Mascot Logo"
                width={76}
                height={76}
                className="object-contain drop-shadow-sm"
                priority
                unoptimized
              />
            </div>
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Fin<span className="text-[#059669]">.IQ</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground max-w-xs">
            {activeTab === "login" ? t.auth.loginSubtitle : t.auth.registerSubtitle}
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
              {t.auth.loginButton}
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
              {t.auth.registerButton}
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
                    placeholder="name@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-10 text-xs rounded-[10px]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {isEn ? "Password" : "Kata Sandi"}
                </label>
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
                {isLoading
                  ? isEn
                    ? "Processing..."
                    : "Memproses..."
                  : isEn
                  ? "Sign In to Fin.IQ"
                  : "Masuk ke Fin.IQ"}
              </Button>

              {/* Quick Demo Section */}
              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-border/60"></div>
                <span className="flex-shrink mx-3 text-[10px] uppercase text-muted-foreground font-semibold">
                  {isEn ? "Quick Demo Access" : "Akses Demo Cepat"}
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
                {isEn ? "Sign In Demo Account (Owner)" : "Masuk Akun Demo (Owner)"}
              </Button>
            </form>
          ) : (
            /* Form: REGISTER */
            <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {isEn ? "Full Name" : "Nama Lengkap"}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder={isEn ? "e.g. Jordan" : "Contoh: Jordan"}
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
                    placeholder="name@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-10 text-xs rounded-[10px]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    {isEn ? "Password" : "Kata Sandi"}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder={isEn ? "Min. 6 characters" : "Min. 6 digit"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 h-10 text-xs rounded-[10px]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    {isEn ? "Confirm Password" : "Ulangi Sandi"}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder={isEn ? "Confirm" : "Konfirmasi"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-9 h-10 text-xs rounded-[10px]"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {isEn ? "Primary Currency" : "Mata Uang Utama"}
                </label>
                <div className="relative">
                  <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full pl-9 pr-8 h-10 text-xs rounded-md border border-border bg-card text-foreground font-medium shadow-2xs transition-all hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="IDR">{isEn ? "IDR : Indonesian Rupiah" : "IDR : Rupiah Indonesia"}</option>
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
                {isLoading
                  ? isEn
                    ? "Registering..."
                    : "Mendaftarkan..."
                  : isEn
                  ? "Create New Account"
                  : "Daftar Akun Baru"}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </form>
          )}
        </Card>

        {/* Footer info */}
        <p className="text-[11px] text-center text-muted-foreground mt-6">
          {isEn
            ? "Fin.IQ : End-to-end encryption : Precision cash accounting"
            : "Fin.IQ : Enkripsi end-to-end : Pembukuan kas presisi"}
        </p>
      </div>
    </div>
  );
}

