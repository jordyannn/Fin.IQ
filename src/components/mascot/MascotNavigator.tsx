/* Hallmark · component: MascotNavigator · theme: Bibit-Fintech · genre: modern-minimal */
"use client";

import React, { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  useMascotStore,
  BASIC_TOUR_STEPS,
  TECHNICAL_TOUR_STEPS,
  TourStep,
} from "@/store/mascot.store";
import { mascotSound } from "@/lib/mascot-sound";
import {
  Sparkles,
  X,
  ChevronRight,
  ChevronLeft,
  Volume2,
  VolumeX,
  Compass,
  Lightbulb,
  CheckCircle2,
} from "lucide-react";

const RANDOM_TIPS = [
  "Rumus 50/30/20: 50% Kebutuhan pokok, 30% Keinginan, 20% Tabungan/Investasi! 💡",
  "Catat pengeluaran sesaat setelah beli kopi, jangan tunggu malam biar nggak lupa! ☕",
  "Punya nota belanja panjang? Pakai tombol Scan AI di pojok kanan atas! 📸",
  "Cek menu 'Anggaran' di awal bulan untuk mematok limit belanja pos makanan. 🛒",
  "Dana darurat ideal adalah minimal 3-6 kali pengeluaran bulananmu bos! 🛡️",
];

export function MascotNavigator() {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const {
    isTourActive,
    activeTourType,
    currentStepIndex,
    isBubbleOpen,
    isWelcomePromptOpen,
    isContinuationPromptOpen,
    isMuted,
    mascotOutfit,
    isTransforming,
    startBasicTour,
    startTechnicalTour,
    nextStep,
    prevStep,
    endTour,
    setStepIndex,
    toggleBubble,
    setBubbleOpen,
    setWelcomePromptOpen,
    closeContinuationPrompt,
    chooseNgulikSendiri,
    toggleMute,
    markWelcomeAsSeen,
    toggleOutfit,
  } = useMascotStore();

  const [mounted, setMounted] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [showTooltipHint, setShowTooltipHint] = useState(false);

  // Check first-time visit on mount
  useEffect(() => {
    setMounted(true);
    try {
      const tourCompleted = localStorage.getItem("finiq_tour_completed");
      const tourWelcomed = localStorage.getItem("finiq_tour_welcomed");
      if (!tourCompleted && !tourWelcomed) {
        // Beri jeda 1.2 detik agar UI utama selesai render sebelum menyapa
        const timer = setTimeout(() => {
          setWelcomePromptOpen(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, [setWelcomePromptOpen]);

  // Otomatis kenakan outfit kacamata saat masuk ke halaman /analytics
  useEffect(() => {
    if (pathname === "/analytics" && mascotOutfit !== "analyst") {
      toggleOutfit(true);
    }
  }, [pathname, mascotOutfit, toggleOutfit]);

  // Periodic subtle tooltip hint every 45s if idle
  useEffect(() => {
    if (!mounted || isTourActive || isBubbleOpen || isWelcomePromptOpen || isContinuationPromptOpen) return;
    const interval = setInterval(() => {
      setShowTooltipHint(true);
      const hideTimer = setTimeout(() => setShowTooltipHint(false), 5000);
      return () => clearTimeout(hideTimer);
    }, 45000);
    return () => clearInterval(interval);
  }, [mounted, isTourActive, isBubbleOpen, isWelcomePromptOpen, isContinuationPromptOpen]);

  // Get active step list based on active tour type
  const activeSteps = activeTourType === "technical" ? TECHNICAL_TOUR_STEPS : BASIC_TOUR_STEPS;
  const currentStep: TourStep = activeSteps[currentStepIndex] || activeSteps[0];

  // Track target element during tour
  useEffect(() => {
    if (!isTourActive) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      const selector = `[${currentStep.targetAttr}]`;
      const el = document.querySelector(selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        // Scroll into view gently if outside visible viewport
        if (rect.top < 60 || rect.bottom > window.innerHeight) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } else {
        // If element is an overview element but user is on another page, navigate to overview
        if (currentStep.targetAttr.includes("overview")) {
          if (pathname !== "/overview") {
            startTransition(() => {
              router.push("/overview");
            });
          }
        }
        setTargetRect(null);
      }
    };

    updateRect();
    const handleResize = () => updateRect();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);

    const timer = setTimeout(updateRect, 300);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
      clearTimeout(timer);
    };
  }, [isTourActive, currentStepIndex, currentStep, pathname, router]);

  if (!mounted) return null;

  const nextTip = () => {
    mascotSound.playPop();
    setTipIndex((prev) => (prev + 1) % RANDOM_TIPS.length);
  };

  return (
    <>
      {/* =========================================================================
          1. FIRST TIME WELCOME MODAL POPUP
      ========================================================================= */}
      {isWelcomePromptOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative w-full max-w-md overflow-hidden rounded-md border border-primary/30 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Background Glow */}
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl pointer-events-none" />

            <button
              onClick={() => {
                markWelcomeAsSeen();
                mascotSound.playPop();
              }}
              className="absolute right-4 top-4 p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center text-center">
              {/* Mascot Animated Character */}
              <div className="relative w-36 h-32 my-1 animate-mascot-bounce-playful">
                <Image
                  src="/mascot/mascot-halo.png"
                  alt="Bang Peci Menyapa"
                  fill
                  sizes="144px"
                  className="object-contain drop-shadow-md"
                  priority
                  unoptimized
                />
              </div>

              <div className="mt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                  <Sparkles className="h-3 w-3" />
                  Pemandu Fin.IQ
                </span>
                <h3 className="text-xl font-extrabold tracking-tight text-foreground mt-2">
                  Halo! Kenalin, Aku Bang Peci 👋
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
                  Selamat datang di Fin.IQ! Biar nggak bingung, mau aku pandu keliling sebentar untuk kenalan sama fitur-fitur penting pencatatan keuanganmu?
                </p>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-col sm:flex-row items-center gap-2.5 w-full">
                <button
                  onClick={() => {
                    markWelcomeAsSeen();
                    startBasicTour();
                  }}
                  className="relative w-full flex-1 py-2.5 px-4 rounded-md font-bold text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 animate-button-ripple"
                >
                  <Compass className="h-4 w-4" />
                  Mulai Tur Panduan
                </button>
                <button
                  onClick={() => {
                    markWelcomeAsSeen();
                    mascotSound.playPop();
                  }}
                  className="w-full sm:w-auto py-2.5 px-4 rounded-md font-semibold text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  Nanti Saja
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          1.5. CONTINUATION PROMPT MODAL (Setelah Tur 1 Selesai)
      ========================================================================= */}
      {isContinuationPromptOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative w-full max-w-md overflow-hidden rounded-md border border-primary/30 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl pointer-events-none" />

            <button
              onClick={closeContinuationPrompt}
              className="absolute right-4 top-4 p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center text-center">
              {/* Animated Bang Peci with Glasses preview */}
              <div className="relative w-36 h-32 my-1 animate-mascot-bounce-playful">
                <Image
                  src="/mascot/mascot-tech-penjelasan.png"
                  alt="Bang Peci Mode Analis"
                  fill
                  sizes="144px"
                  className="object-contain drop-shadow-md"
                  priority
                  unoptimized
                />
              </div>

              <div className="mt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                  <CheckCircle2 className="h-3 w-3" />
                  Tur Dasar Selesai!
                </span>
                <h3 className="text-xl font-extrabold tracking-tight text-foreground mt-2">
                  Mau Lanjut Tur Teknis atau Ngulik Sendiri? 🧭
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
                  Hebat! Kamu sudah paham navigasi umum Fin.IQ. Sekarang kamu bisa lanjut ke <strong className="text-foreground">Tutorial Teknis</strong> (cara baca kurva fluktuasi kas, metrik habit harian, hub impor mutasi AI, dan audit pos boros), atau mau santai <strong className="text-foreground">ngulik sendiri</strong> dulu?
                </p>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-col sm:flex-row items-center gap-2.5 w-full">
                <button
                  onClick={() => {
                    startTechnicalTour();
                  }}
                  className="relative w-full flex-1 py-2.5 px-4 rounded-md font-bold text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 animate-button-ripple"
                >
                  <Compass className="h-4 w-4" />
                  Lanjut Tur Teknis 🚀
                </button>
                <button
                  onClick={chooseNgulikSendiri}
                  className="w-full sm:w-auto py-2.5 px-4 rounded-md font-semibold text-xs border border-border bg-card text-foreground hover:bg-muted transition-colors"
                >
                  Ngulik Sendiri Dulu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          2. SPOTLIGHT TOUR WALKTHROUGH OVERLAY (Tur 1 & Tur 2)
      ========================================================================= */}
      {isTourActive && (
        <div className="fixed inset-0 z-[150] pointer-events-none">
          {/* Dark Overlay with Target Element Cutout */}
          {targetRect ? (
            <>
              {/* 4 Blocker Divs that darken background and prevent outside clicks */}
              <div
                className="fixed top-0 left-0 right-0 bg-black/75 pointer-events-auto transition-all duration-300"
                style={{ height: `${Math.max(0, targetRect.top - 8)}px` }}
              />
              <div
                className="fixed left-0 right-0 bottom-0 bg-black/75 pointer-events-auto transition-all duration-300"
                style={{ top: `${targetRect.bottom + 8}px` }}
              />
              <div
                className="fixed left-0 bg-black/75 pointer-events-auto transition-all duration-300"
                style={{
                  top: `${Math.max(0, targetRect.top - 8)}px`,
                  height: `${targetRect.height + 16}px`,
                  width: `${Math.max(0, targetRect.left - 8)}px`,
                }}
              />
              <div
                className="fixed right-0 bg-black/75 pointer-events-auto transition-all duration-300"
                style={{
                  top: `${Math.max(0, targetRect.top - 8)}px`,
                  height: `${targetRect.height + 16}px`,
                  left: `${targetRect.right + 8}px`,
                }}
              />

              {/* Spotlight Frame with Gentle Radar Border & Calm Ripple Waves */}
              <div
                className="fixed transition-all duration-300 ease-out pointer-events-none rounded-md z-[155] animate-tour-radar"
                style={{
                  top: `${Math.max(0, targetRect.top - 8)}px`,
                  left: `${Math.max(0, targetRect.left - 8)}px`,
                  width: `${targetRect.width + 16}px`,
                  height: `${targetRect.height + 16}px`,
                }}
              >
                {/* 2 Calm & Slow Expanding Ripple Waves */}
                <span className="absolute -inset-1 rounded-md border border-[#059669]/50 animate-tour-ripple-1 pointer-events-none" />
                <span className="absolute -inset-2.5 rounded-md border border-[#059669]/30 animate-tour-ripple-2 pointer-events-none" />

                {/* Subtle Target Beacon Badge: "KLIK DI SINI" */}
                <div
                  className={`absolute z-20 flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm bg-[#059669] text-white text-[10px] font-bold shadow-md border border-white/50 tracking-wider pointer-events-none select-none transition-all ${
                    targetRect.top < 65 ? "-bottom-3.5 left-3" : "-top-3.5 left-3"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-xs bg-white/90 shadow-xs" />
                  <span>
                    {currentStep.targetAttr.includes("quick-add") ||
                    currentStep.targetAttr.includes("ai-studio") ||
                    currentStep.targetAttr.includes("filter")
                      ? "KLIK DI SINI"
                      : "AREA TARGET"}
                  </span>
                  <span className="text-[11px]">
                    {currentStep.targetAttr.includes("quick-add") ||
                    currentStep.targetAttr.includes("ai-studio") ||
                    currentStep.targetAttr.includes("filter")
                      ? "👆"
                      : "🎯"}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="fixed inset-0 bg-black/75 backdrop-blur-sm pointer-events-auto" />
          )}

          {/* Floating Guidance Card - Clamped to never overflow off-screen */}
          <div
            className="fixed z-[160] transition-all duration-300 pointer-events-auto"
            style={
              targetRect
                ? (() => {
                    const winW = typeof window !== "undefined" ? window.innerWidth : 1200;
                    const winH = typeof window !== "undefined" ? window.innerHeight : 800;
                    const cardW = Math.min(410, winW - 32);
                    const idealLeft = targetRect.left + targetRect.width / 2 - cardW / 2;
                    const clampedLeft = Math.max(16, Math.min(idealLeft, winW - cardW - 16));
                    const spaceBelow = winH - targetRect.bottom;
                    const top =
                      spaceBelow > 310
                        ? `${targetRect.bottom + 14}px`
                        : `${Math.max(14, targetRect.top - 290)}px`;

                    return {
                      top,
                      left: `${clampedLeft}px`,
                      width: `${cardW}px`,
                    };
                  })()
                : {
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "min(410px, calc(100vw - 32px))",
                  }
            }
          >
            <div className="relative overflow-hidden rounded-md border border-primary/30 bg-card p-5 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200">
              {/* Header: Bang Peci expression & Step Badge */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/70">
                <div className="flex items-center gap-2.5">
                  <div className={`relative w-12 h-12 shrink-0 flex items-center justify-center ${isTransforming ? 'animate-mascot-spin-flip' : 'animate-mascot-bounce-playful'}`}>
                    <Image
                      src={`/mascot/mascot-${currentStep.mascotExpression}.png`}
                      alt="Bang Peci"
                      fill
                      sizes="48px"
                      className="object-contain drop-shadow-sm"
                      unoptimized
                    />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-primary flex items-center gap-1 uppercase tracking-wider">
                      {activeTourType === "technical" ? "Modul Teknis" : "Panduan Dasar"} • Langkah {currentStepIndex + 1} dari {activeSteps.length}
                    </span>
                    <h4 className="font-extrabold text-sm sm:text-base text-foreground leading-tight">
                      {currentStep.title}
                    </h4>
                  </div>
                </div>

                <button
                  onClick={endTour}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                  title="Lewati Tur"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body: Explanation & Mascot Speech Bubble */}
              <div className="mt-3.5 space-y-2.5">
                <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                  {currentStep.description}
                </p>

                <div className="rounded-sm bg-primary/10 border border-primary/20 px-3 py-2 text-xs font-medium text-foreground flex items-center gap-2">
                  <span className="text-sm">💬</span>
                  <span className="italic font-semibold text-primary">
                    "{currentStep.speechQuote}"
                  </span>
                </div>
              </div>

              {/* Footer: Progress Dots & Buttons */}
              <div className="mt-5 flex items-center justify-between gap-3 pt-3 border-t border-border/70">
                {/* Step dots */}
                <div className="flex items-center gap-1.5">
                  {activeSteps.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setStepIndex(i)}
                      className={`h-2 rounded-xs transition-all ${
                        i === currentStepIndex
                          ? "w-6 bg-primary"
                          : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                      }`}
                      aria-label={`Ke Langkah ${i + 1}`}
                    />
                  ))}
                </div>

                {/* Prev & Next Controls */}
                <div className="flex items-center gap-2">
                  {currentStepIndex > 0 && (
                    <button
                      onClick={prevStep}
                      className="p-2 rounded-md border border-input text-foreground hover:bg-muted transition-colors text-xs font-semibold flex items-center gap-1"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Kembali
                    </button>
                  )}

                  <button
                    onClick={nextStep}
                    className="relative py-2 px-3.5 rounded-md font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-transform active:scale-95 flex items-center gap-1.5 animate-button-ripple"
                  >
                    {currentStepIndex === activeSteps.length - 1 ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Selesai!
                      </>
                    ) : (
                      <>
                        Lanjut
                        <ChevronRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. FLOATING INTERACTIVE BUBBLE (FAB) & MINI MENU
      ========================================================================= */}
      {!isTourActive && (
        <div className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-[90] flex flex-col items-end">
          {/* Subtle Teaser Hint Tooltip */}
          {showTooltipHint && !isBubbleOpen && (
            <div className="mb-2 mr-1 rounded-md border border-primary/30 bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200 flex items-center gap-2 max-w-xs">
              <span>👋 Butuh bantuan atau panduan? Klik Bang Peci!</span>
              <button
                onClick={() => setShowTooltipHint(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Interactive Menu Popover */}
          {isBubbleOpen && (
            <div className="mb-3 w-72 sm:w-80 overflow-hidden rounded-md border border-border/80 bg-card/95 p-4 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-border/70">
                <div className="flex items-center gap-2">
                  <div className={`relative w-9 h-9 shrink-0 flex items-center justify-center ${isTransforming ? 'animate-mascot-spin-flip' : 'animate-mascot-bounce-playful'}`}>
                    <Image
                      src={mascotOutfit === "analyst" ? "/mascot/mascot-tech-halo.png" : "/mascot/mascot-halo.png"}
                      alt="Bang Peci"
                      fill
                      sizes="36px"
                      className="object-contain drop-shadow-xs"
                      unoptimized
                    />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-foreground flex items-center gap-1.5">
                      Bang Peci
                      <span className="text-[10px] font-semibold text-primary px-1.5 py-0.2 rounded-sm bg-primary/10">
                        {mascotOutfit === "analyst" ? "Mode Analis 👓" : "Mode Santai 🧢"}
                      </span>
                    </h4>
                    <p className="text-[10px] text-muted-foreground">Navigator Finansial</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={toggleMute}
                    className="p-1 rounded-md text-muted-foreground hover:bg-muted"
                    title={isMuted ? "Bunyikan Suara" : "Bisukan Suara"}
                  >
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-primary" />}
                  </button>
                  <button
                    onClick={() => setBubbleOpen(false)}
                    className="p-1 rounded-md text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Random Tip Box */}
              <div className="mt-3 rounded-md bg-muted/60 border border-border/60 p-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground mb-1">
                  <span className="flex items-center gap-1 text-primary">
                    <Lightbulb className="h-3.5 w-3.5" />
                    Tips Bang Peci
                  </span>
                  <button
                    onClick={nextTip}
                    className="hover:underline text-[10px] font-semibold text-foreground"
                  >
                    Ganti Tip
                  </button>
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                  "{RANDOM_TIPS[tipIndex]}"
                </p>
              </div>

              {/* Menu Actions: Both Tour 1 and Tour 2, plus horizontal outfit flip! */}
              <div className="mt-3 space-y-1.5">
                <button
                  onClick={() => {
                    startBasicTour();
                    setBubbleOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-md border border-input bg-card hover:bg-muted/80 text-foreground font-bold text-xs transition-transform active:scale-98"
                >
                  <span className="flex items-center gap-2">
                    <Compass className="h-4 w-4 text-primary" />
                    Tur 1: Pengenalan Dasar (5 Langkah)
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>

                <button
                  onClick={() => {
                    startTechnicalTour();
                    setBubbleOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-md bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 shadow-sm transition-transform active:scale-98"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Tur 2: Bedah Teknis & Analisis (5 Langkah)
                  </span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>

                <button
                  onClick={() => toggleOutfit(true)}
                  className="w-full flex items-center justify-between p-2.5 rounded-md border border-input bg-card text-foreground font-semibold text-xs hover:bg-muted transition-colors"
                  title="Putar horizontal dan ubah outfit Bang Peci!"
                >
                  <span className="flex items-center gap-2">
                    <span>{mascotOutfit === "analyst" ? "👓" : "🧢"}</span>
                    <span>Outfit: {mascotOutfit === "analyst" ? "Mode Analis" : "Mode Santai"}</span>
                  </span>
                  <span className="text-[10px] font-bold text-primary underline">Putar 360°</span>
                </button>
              </div>
            </div>
          )}

          {/* Circular Floating Mascot Button */}
          <button
            onClick={toggleBubble}
            className="group relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border-2 border-primary bg-card shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 animate-mascot-float"
            aria-label="Buka Menu Asisten Bang Peci"
          >
            {/* Glowing Pulse Ring */}
            <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-60 pointer-events-none" />

            {/* Mascot Avatar Inside Bubble with Spin Flip & Bounce */}
            <div className={`relative h-11 w-11 sm:h-12 sm:w-12 flex items-center justify-center ${isTransforming ? 'animate-mascot-spin-flip' : 'animate-mascot-bounce-playful'}`}>
              <Image
                src={mascotOutfit === "analyst" ? "/mascot/mascot-tech-halo.png" : "/mascot/mascot-halo.png"}
                alt="Bang Peci Avatar"
                fill
                sizes="56px"
                className="object-contain drop-shadow-sm select-none pointer-events-none group-hover:rotate-6 transition-transform"
                priority
                unoptimized
              />
            </div>

            {/* Sparkle Badge */}
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-black shadow-md">
              <Sparkles className="h-3 w-3" />
            </span>
          </button>
        </div>
      )}
    </>
  );
}
