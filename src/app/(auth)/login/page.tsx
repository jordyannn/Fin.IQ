"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ShieldCheck, ArrowRight, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [requires2FA, setRequires2FA] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate auth verification
    setTimeout(() => {
      setIsLoading(false);
      router.push("/overview");
    }, 600);
  };

  const handleQuickDemo = () => {
    setEmail("owner@finiq.app");
    setPassword("123456");
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      router.push("/overview");
    }, 400);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-tr from-background via-muted/40 to-background p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 text-white shadow-xl shadow-primary/30 mb-3">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Fin.IQ Cloud</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manajemen Keuangan Personal dengan Sinkronisasi Multi-Device
          </p>
        </div>

        <Card className="p-6 shadow-xl border-border/60 backdrop-blur-md">
          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            {!requires2FA ? (
              <>
                <div>
                  <label className="font-semibold text-muted-foreground">Email</label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="owner@finiq.app"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 h-10 text-xs"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-muted-foreground">Kata Sandi</label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 h-10 text-xs"
                      required
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="font-semibold text-muted-foreground">Kode Autentikasi 2FA</label>
                <Input
                  type="text"
                  placeholder="6 digit kode authenticator"
                  value={twoFaCode}
                  onChange={(e) => setTwoFaCode(e.target.value)}
                  className="h-10 text-center font-mono text-base font-bold tracking-widest mt-1"
                  maxLength={6}
                  required
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-white h-10 font-bold shadow-md mt-2"
            >
              {isLoading ? "Memproses..." : "Masuk ke Fin.IQ"}
            </Button>

            {/* Quick Demo Button */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-border"></div>
              <span className="flex-shrink mx-2 text-[10px] uppercase text-muted-foreground font-semibold">
                Atau
              </span>
              <div className="flex-grow border-t border-border"></div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleQuickDemo}
              className="w-full h-9 text-xs font-semibold gap-2 border-primary/30 text-primary hover:bg-primary/5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Quick Demo Login (Owner)
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
