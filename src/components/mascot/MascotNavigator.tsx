/* Hallmark · component: MascotNavigator · theme: Bibit-Fintech · genre: modern-minimal */
"use client";

import React, { useEffect, useState, useRef, useTransition } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
  useMascotStore,
  BASIC_TOUR_STEPS,
  TECHNICAL_TOUR_STEPS,
  TRANSACTION_TOUR_STEPS,
  TourStep,
} from "@/store/mascot.store";
import { useUIStore } from "@/store/ui.store";
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
  Receipt,
  Minimize2,
  Maximize2,
  Moon,
  Minus,
} from "lucide-react";

const RANDOM_TIPS = [
  "Aturan 50/30/20: 50% kebutuhan, 30% keinginan, 20% tabungan.",
  "Catat belanja langsung setelah transaksi biar tidak terlewat.",
  "Punya struk fisik? Scan lewat tombol Catat Transaksi.",
  "Atur batas anggaran di awal bulan untuk pos yang rawan boros.",
  "Siapkan dana darurat minimal 3 bulan biaya hidup rutin.",
];

export function MascotNavigator() {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const {
    isTourActive,
    activeTourType,
    currentStepIndex,
    resumeBasicTourAfter,
    isBubbleOpen,
    isWelcomePromptOpen,
    isContinuationPromptOpen,
    isMuted,
    mascotOutfit,
    isTransforming,
    startBasicTour,
    startTechnicalTour,
    startTransactionTour,
    nextStep,
    prevStep,
    endTour,
    setStepIndex,
    resumeBasicTour,
    toggleBubble,
    setBubbleOpen,
    setWelcomePromptOpen,
    closeContinuationPrompt,
    chooseNgulikSendiri,
    toggleMute,
    markWelcomeAsSeen,
    toggleOutfit,
  } = useMascotStore();

  const { isQuickAddOpen, openQuickAdd, isCommandPaletteOpen, isSidebarOpen } = useUIStore();
  const [mounted, setMounted] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [showTooltipHint, setShowTooltipHint] = useState(false);
  const [isCardMinimized, setIsCardMinimized] = useState(false);

  // Adaptive behavior states
  const [hasOpenDomModal, setHasOpenDomModal] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isUserMinimized, setIsUserMinimized] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Load user manual minimize preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("finiq_mascot_user_minimized");
      if (saved === "true") setIsUserMinimized(true);
    } catch {}
  }, []);

  const toggleUserMinimize = (val?: boolean) => {
    const next = typeof val === "boolean" ? val : !isUserMinimized;
    setIsUserMinimized(next);
    try {
      localStorage.setItem("finiq_mascot_user_minimized", String(next));
    } catch {}
    if (next) setBubbleOpen(false);
    mascotSound.playPop();
  };

  // 1. Universal modal & dialog detection in entire app
  useEffect(() => {
    if (!mounted) return;
    const checkModals = () => {
      const modalEl = document.querySelector(
        '[role="dialog"], [aria-modal="true"], [data-tour-modal]'
      );
      // Exclude MascotNavigator's own tour overlay
      const isAppModal = Boolean(modalEl && !modalEl.closest("[data-mascot-tour]"));
      setHasOpenDomModal(isAppModal);
    };

    checkModals();
    const observer = new MutationObserver(checkModals);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    return () => observer.disconnect();
  }, [mounted]);

  const isAnyModalActive = isQuickAddOpen || isCommandPaletteOpen || isSidebarOpen || hasOpenDomModal;

  // 2. Auto-close bubble menu & hints whenever any modal opens or route changes
  useEffect(() => {
    if (isAnyModalActive) {
      setBubbleOpen(false);
      setShowTooltipHint(false);
    }
  }, [isAnyModalActive, setBubbleOpen]);

  useEffect(() => {
    setBubbleOpen(false);
    setShowTooltipHint(false);
  }, [pathname, setBubbleOpen]);

  // 3. Close popover on outside click or Escape key
  useEffect(() => {
    if (!isBubbleOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setBubbleOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setBubbleOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isBubbleOpen, setBubbleOpen]);

  // 4. Scroll-responsive detection (dim/dock on scroll so it never blocks text or numbers)
  useEffect(() => {
    if (!mounted) return;
    let scrollTimer: NodeJS.Timeout;

    const handleScroll = () => {
      setIsScrolling(true);
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        setIsScrolling(false);
      }, 700);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimer);
    };
  }, [mounted]);

  // 5. Input focus detection (calm mode while typing)
  useEffect(() => {
    if (!mounted) return;
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        setIsInputFocused(true);
      }
    };
    const handleFocusOut = () => {
      setIsInputFocused(false);
    };
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, [mounted]);

  // If QuickAdd is closed while transaction tour with resumeBasicTourAfter is active, resume basic tour
  useEffect(() => {
    if (!isQuickAddOpen && isTourActive && activeTourType === "transaction") {
      if (resumeBasicTourAfter) {
        resumeBasicTour();
      } else {
        endTour();
      }
    }
  }, [isQuickAddOpen, isTourActive, activeTourType, resumeBasicTourAfter, resumeBasicTour, endTour]);

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
  const activeSteps =
    activeTourType === "technical"
      ? TECHNICAL_TOUR_STEPS
      : activeTourType === "transaction"
      ? TRANSACTION_TOUR_STEPS
      : BASIC_TOUR_STEPS;
  const currentStep: TourStep = activeSteps[currentStepIndex] || activeSteps[0];

  // Track target element during tour with smart scrolling so card never covers content
  useEffect(() => {
    if (!isTourActive) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      const selector = `[${currentStep.targetAttr}]`;
      const el = document.querySelector(selector);
      if (el) {
        if (activeTourType === "transaction") {
          el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        }
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);

        // Smart scrolling: ensure sufficient space for guidance card without obscuring the target
        if (currentStep.position === "right") {
          // Sidebar elements don't need vertical page scrolling
        } else if (currentStep.position === "top") {
          if (rect.top < 220 || rect.bottom > window.innerHeight - 30) {
            const elTop = el.getBoundingClientRect().top + window.scrollY;
            window.scrollTo({
              top: Math.max(0, elTop - (window.innerHeight - rect.height - 40)),
              behavior: "smooth",
            });
          }
        } else {
          // default position: bottom
          if (rect.top < 80 || rect.bottom > window.innerHeight - 220) {
            const elTop = el.getBoundingClientRect().top + window.scrollY;
            window.scrollTo({
              top: Math.max(0, elTop - 90),
              behavior: "smooth",
            });
          }
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

  // Helper to calculate card position so it NEVER covers the target element
  const getCardPositionStyle = (): React.CSSProperties => {
    if (!targetRect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(370px, calc(100vw - 32px))",
      };
    }

    const winW = typeof window !== "undefined" ? window.innerWidth : 1200;
    const winH = typeof window !== "undefined" ? window.innerHeight : 800;
    const cardW = Math.min(360, winW - 32);
    const cardH = isCardMinimized
      ? 74
      : currentStep.targetAttr.includes("quick-add") || activeTourType === "transaction"
      ? 280
      : 200;
    const positionPref = currentStep.position || "bottom";

    // Special smart positioning when inside QuickAddModal
    if (activeTourType === "transaction" || isQuickAddOpen) {
      const modalEl = document.querySelector("[data-tour-modal='quick-add']");
      const modalRect = modalEl?.getBoundingClientRect();

      // On desktop / wide screens, place guidance card side-by-side to the right of modal
      if (modalRect && winW >= 960) {
        const preferredLeft = modalRect.right + 14;
        if (preferredLeft + cardW <= winW - 14) {
          const idealTop = targetRect.top;
          const clampedTop = Math.max(16, Math.min(idealTop, winH - cardH - 16));
          return {
            top: `${clampedTop}px`,
            left: `${preferredLeft}px`,
            width: `${cardW}px`,
            maxHeight: `calc(100vh - 32px)`,
          };
        }
        const preferredLeftOnLeft = modalRect.left - cardW - 14;
        if (preferredLeftOnLeft >= 14) {
          const idealTop = targetRect.top;
          const clampedTop = Math.max(16, Math.min(idealTop, winH - cardH - 16));
          return {
            top: `${clampedTop}px`,
            left: `${preferredLeftOnLeft}px`,
            width: `${cardW}px`,
            maxHeight: `calc(100vh - 32px)`,
          };
        }
      }

      // On mobile or smaller screens: pin to bottom or top of viewport so it doesn't obscure the target
      const isTargetInUpperHalf = targetRect.top < winH / 2;
      const cardWidthMobile = Math.min(380, winW - 24);
      if (isTargetInUpperHalf) {
        return {
          bottom: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          width: `${cardWidthMobile}px`,
          maxHeight: `calc(50vh - 24px)`,
        };
      } else {
        return {
          top: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          width: `${cardWidthMobile}px`,
          maxHeight: `calc(50vh - 24px)`,
        };
      }
    }

    // If step is on sidebar (right positioning), place card completely to the right of the sidebar
    if (positionPref === "right") {
      const left = Math.min(winW - cardW - 16, targetRect.right + 16);
      const top = Math.max(
        16,
        Math.min(winH - cardH - 16, targetRect.top + targetRect.height / 2 - cardH / 2)
      );
      return {
        top: `${top}px`,
        left: `${left}px`,
        width: `${cardW}px`,
      };
    }

    // Horizontal centering relative to target
    const idealLeft = targetRect.left + targetRect.width / 2 - cardW / 2;
    const clampedLeft = Math.max(16, Math.min(idealLeft, winW - cardW - 16));

    const spaceBelow = winH - targetRect.bottom;
    const spaceAbove = targetRect.top;

    let top: number;
    if (positionPref === "top") {
      if (spaceAbove >= cardH + 16) {
        top = targetRect.top - cardH - 14;
      } else if (spaceBelow >= cardH + 16) {
        top = targetRect.bottom + 14;
      } else {
        top = Math.max(14, targetRect.top - cardH - 14);
      }
    } else {
      // Default: bottom
      if (spaceBelow >= cardH + 16) {
        top = targetRect.bottom + 14;
      } else if (spaceAbove >= cardH + 16) {
        top = targetRect.top - cardH - 14;
      } else {
        top = Math.min(winH - cardH - 14, targetRect.bottom + 14);
      }
    }

    const maxTop = Math.max(14, winH - cardH - 16);
    return {
      top: `${Math.max(14, Math.min(top, maxTop))}px`,
      left: `${clampedLeft}px`,
      width: `${cardW}px`,
    };
  };

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
        <div className="fixed inset-0 z-[120] print:hidden flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
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
                  Halo, saya Bang Peci
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
                  Mau tur singkat 1 menit untuk melihat fitur utama Fin.IQ?
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
                  Mulai Tur
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
                  Tur Dasar Selesai
                </span>
                <h3 className="text-xl font-extrabold tracking-tight text-foreground mt-2">
                  Lanjut ke Tur Analisis?
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
                  Tur berikutnya membahas kurva saldo harian, rata-rata belanja, dan impor mutasi bank.
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
                  Lanjut Tur Analisis
                </button>
                <button
                  onClick={chooseNgulikSendiri}
                  className="w-full sm:w-auto py-2.5 px-4 rounded-md font-semibold text-xs border border-border bg-card text-foreground hover:bg-muted transition-colors"
                >
                  Eksplor Sendiri
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          2. SPOTLIGHT TOUR WALKTHROUGH OVERLAY (Tur 1, Tur 2 & Tur Transaksi)
      ========================================================================= */}
      {isTourActive && (
        <div data-mascot-tour="true" className={`fixed inset-0 print:hidden ${isQuickAddOpen || activeTourType === "transaction" ? "z-[220]" : "z-[150]"} pointer-events-none`}>
          {/* Dark Overlay with Target Element Cutout */}
          {targetRect ? (
            <>
              {/* 4 Blocker Divs that darken background and prevent outside clicks */}
              <div
                className={`fixed top-0 left-0 right-0 ${activeTourType === "transaction" ? "bg-black/45" : "bg-black/75"} pointer-events-auto transition-all duration-300`}
                style={{ height: `${Math.max(0, targetRect.top - 8)}px` }}
              />
              <div
                className={`fixed left-0 right-0 bottom-0 ${activeTourType === "transaction" ? "bg-black/45" : "bg-black/75"} pointer-events-auto transition-all duration-300`}
                style={{ top: `${targetRect.bottom + 8}px` }}
              />
              <div
                className={`fixed left-0 ${activeTourType === "transaction" ? "bg-black/45" : "bg-black/75"} pointer-events-auto transition-all duration-300`}
                style={{
                  top: `${Math.max(0, targetRect.top - 8)}px`,
                  height: `${targetRect.height + 16}px`,
                  width: `${Math.max(0, targetRect.left - 8)}px`,
                }}
              />
              <div
                className={`fixed right-0 ${activeTourType === "transaction" ? "bg-black/45" : "bg-black/75"} pointer-events-auto transition-all duration-300`}
                style={{
                  top: `${Math.max(0, targetRect.top - 8)}px`,
                  height: `${targetRect.height + 16}px`,
                  left: `${targetRect.right + 8}px`,
                }}
              />

              {/* Spotlight Frame with Gentle Radar Border & Calm Ripple Waves */}
              <div
                className={`fixed transition-all duration-300 ease-out pointer-events-none rounded-md ${isQuickAddOpen || activeTourType === "transaction" ? "z-[225]" : "z-[155]"} animate-tour-radar`}
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

                {/* Subtle Target Beacon Badge: "PILIH DI SINI" */}
                <div
                  className={`absolute z-20 flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm bg-[#059669] text-white text-[10px] font-bold shadow-md border border-white/50 tracking-wider pointer-events-none select-none transition-all ${
                    targetRect.top < 65 ? "-bottom-3.5 left-3" : "-top-3.5 left-3"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-xs bg-white/90 shadow-xs" />
                  <span>
                    {currentStep.targetAttr.includes("quick-add") ||
                    currentStep.targetAttr.includes("ai-studio") ||
                    currentStep.targetAttr.includes("filter") ||
                    currentStep.targetAttr.includes("modal-ai-tools")
                      ? "PILIH DI SINI"
                      : "FOKUS"}
                  </span>
                  <span className="text-[11px]">
                    {currentStep.targetAttr.includes("quick-add") ||
                    currentStep.targetAttr.includes("ai-studio") ||
                    currentStep.targetAttr.includes("filter") ||
                    currentStep.targetAttr.includes("modal-ai-tools")
                      ? "👆"
                      : "🎯"}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className={`fixed inset-0 ${activeTourType === "transaction" ? "bg-black/50" : "bg-black/75"} backdrop-blur-sm pointer-events-auto`} />
          )}

          {/* Floating Guidance Card - Positioned smartly to never cover target content */}
          <div
            className={`fixed ${isQuickAddOpen || activeTourType === "transaction" ? "z-[230]" : "z-[160]"} transition-all duration-300 pointer-events-auto`}
            style={getCardPositionStyle()}
          >
            <div className="relative overflow-hidden rounded-md border border-primary/30 bg-card p-4 sm:p-5 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200 max-h-[calc(100vh-32px)] flex flex-col justify-between">
              {/* Header: Bang Peci expression & Step Badge */}
              <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-border/70 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className={`relative w-11 h-11 shrink-0 flex items-center justify-center ${isTransforming ? 'animate-mascot-spin-flip' : 'animate-mascot-bounce-playful'}`}>
                    <Image
                      src={`/mascot/mascot-${currentStep.mascotExpression}.png`}
                      alt="Bang Peci"
                      fill
                      sizes="44px"
                      className="object-contain drop-shadow-sm"
                      unoptimized
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-primary flex items-center gap-1 uppercase tracking-wider">
                      {activeTourType === "technical"
                        ? "Modul Teknis"
                        : activeTourType === "transaction"
                        ? "Tutorial Form Transaksi"
                        : "Panduan Dasar"} • Langkah {currentStepIndex + 1} dari {activeSteps.length}
                    </span>
                    <h4 className="font-extrabold text-sm sm:text-base text-foreground leading-tight">
                      {currentStep.title}
                    </h4>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      mascotSound.playPop();
                      setIsCardMinimized((prev) => !prev);
                    }}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                    title={isCardMinimized ? "Perbesar Panduan" : "Perkecil Panduan"}
                  >
                    {isCardMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={endTour}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                    title="Lewati Tur"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {isCardMinimized ? (
                /* Compact / Minimized View */
                <div className="mt-2 pt-2 border-t border-border/70 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground italic truncate max-w-[210px]">
                    💬 "{currentStep.speechQuote}"
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {currentStepIndex > 0 && (
                      <button
                        onClick={prevStep}
                        className="p-1 rounded-md border border-input text-foreground hover:bg-muted transition-colors text-xs font-semibold"
                        title="Kembali"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={nextStep}
                      className="py-1 px-2.5 rounded-md text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      {currentStepIndex === activeSteps.length - 1 ? "Selesai" : "Lanjut"}
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Body: Explanation & Mascot Speech Bubble */}
                  <div className="mt-3 space-y-2 overflow-y-auto pr-0.5">
                    <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed font-normal">
                      {currentStep.description}
                    </p>

                    <div className="rounded-sm bg-primary/10 border border-primary/20 px-2.5 py-1.5 text-xs font-medium text-foreground flex items-center gap-2">
                      <span className="text-xs">💬</span>
                      <span className="italic font-semibold text-primary">
                        "{currentStep.speechQuote}"
                      </span>
                    </div>

                    {/* Interactive prompt on quick-add step */}
                    {currentStep.targetAttr.includes("quick-add") && (
                      <div className="mt-2.5 p-2.5 rounded-md bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/25 space-y-1.5 animate-in fade-in duration-200">
                        <p className="font-bold text-xs text-foreground flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                          Coba catat transaksi sekarang?
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          Buka form transaksi dan pelajari fitur pencatatan bersama Bang Peci.
                        </p>
                        <div className="flex items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              openQuickAdd();
                              startTransactionTour(true);
                            }}
                            className="h-7 px-3 rounded-md text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-transform active:scale-95 flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Ya, Mau Transaksi
                          </button>
                          <button
                            type="button"
                            onClick={nextStep}
                            className="h-7 px-2.5 rounded-md text-xs font-semibold border border-input bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          >
                            Belum, Lanjut Tur
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer: Progress Dots & Buttons */}
                  <div className="mt-4 flex items-center justify-between gap-3 pt-3 border-t border-border/70 shrink-0">
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

                      {activeTourType === "transaction" && resumeBasicTourAfter && currentStepIndex === activeSteps.length - 1 && (
                        <button
                          type="button"
                          onClick={() => endTour()}
                          className="py-2 px-2.5 rounded-md text-xs font-semibold border border-input bg-card text-foreground hover:bg-muted transition-colors"
                          title="Selesaikan tutorial dan coba isi form transaksi sendiri"
                        >
                          Coba Simpan Sendiri
                        </button>
                      )}

                      <button
                        onClick={nextStep}
                        className="relative py-2 px-3.5 rounded-md font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-transform active:scale-95 flex items-center gap-1.5 animate-button-ripple"
                      >
                        {currentStepIndex === activeSteps.length - 1 ? (
                          activeTourType === "transaction" && resumeBasicTourAfter ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Lanjut Tur Utama 🚀
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Selesai!
                            </>
                          )
                        ) : (
                          <>
                            Lanjut
                            <ChevronRight className="h-3.5 w-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. FLOATING INTERACTIVE BUBBLE (FAB) & MINI MENU (ADAPTIF & NON-INTRUSIF)
      ========================================================================= */}
      {!isTourActive && (
        <div
          className={`fixed transition-all duration-300 ease-out print:hidden ${
            isAnyModalActive
              ? "bottom-3 sm:bottom-4 right-3 sm:right-4 z-[210]"
              : "bottom-20 lg:bottom-6 right-3.5 lg:right-6 z-[90]"
          } flex flex-col items-end pointer-events-none`}
        >
          {/* Subtle Teaser Hint Tooltip (only when no modal is open & not in quiet mode) */}
          {!isAnyModalActive && !isUserMinimized && showTooltipHint && !isBubbleOpen && (
            <div className="mb-2 mr-1 rounded-md border border-primary/30 bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200 flex items-center gap-2 max-w-xs pointer-events-auto">
              <span>Butuh panduan? Klik Bang Peci</span>
              <button
                onClick={() => setShowTooltipHint(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Interactive Menu Popover (only when no modal is open & not in quiet mode) */}
          {!isAnyModalActive && isBubbleOpen && (
            <div
              ref={popoverRef}
              className="mb-3 w-72 sm:w-80 max-w-[calc(100vw-28px)] overflow-hidden rounded-md border border-border/80 bg-card/95 p-4 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200 pointer-events-auto"
            >
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

              {/* Menu Actions */}
              <div className="mt-3 space-y-1.5">
                <button
                  onClick={() => {
                    startBasicTour();
                    setBubbleOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-md border border-input bg-card hover:bg-muted/80 text-foreground font-bold text-xs transition-transform active:scale-98 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Compass className="h-4 w-4 text-primary" />
                    Tur Dasar (5 Langkah)
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>

                <button
                  onClick={() => {
                    openQuickAdd();
                    startTransactionTour(false);
                    setBubbleOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-foreground font-bold text-xs transition-transform active:scale-98 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Panduan Form Transaksi (5 Langkah)
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>

                <button
                  onClick={() => {
                    startTechnicalTour();
                    setBubbleOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-md bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 shadow-sm transition-transform active:scale-98 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Tur Analisis (5 Langkah)
                  </span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>

                <button
                  onClick={() => toggleOutfit(true)}
                  className="w-full flex items-center justify-between p-2.5 rounded-md border border-input bg-card text-foreground font-semibold text-xs hover:bg-muted transition-colors cursor-pointer"
                  title="Ganti mode tampilan"
                >
                  <span className="flex items-center gap-2">
                    <span>{mascotOutfit === "analyst" ? "👓" : "🧢"}</span>
                    <span>Mode: {mascotOutfit === "analyst" ? "Analis" : "Santai"}</span>
                  </span>
                  <span className="text-[10px] font-bold text-primary underline">Ganti Mode</span>
                </button>

                {/* Mode Tenang / Perkecil Widget Action */}
                <button
                  onClick={() => toggleUserMinimize(true)}
                  className="w-full flex items-center justify-between p-2 rounded-md border border-dashed border-border/80 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground font-semibold text-xs transition-colors cursor-pointer mt-1"
                  title="Kecilkan widget Bang Peci agar tidak mengganggu layar"
                >
                  <span className="flex items-center gap-2">
                    <Moon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Mode Tenang (Perkecil)</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">Kecilkan</span>
                </button>
              </div>
            </div>
          )}

          {/* Floating Mascot Button: Adaptif & Non-Intrusif */}
          {isAnyModalActive ? (
            /* Condition A: Minimized discreet pill when ANY modal or dialog is open */
            <button
              onClick={() => {
                mascotSound.playPop();
                if (isQuickAddOpen) {
                  startTransactionTour(false);
                } else {
                  toggleBubble();
                }
              }}
              className="group pointer-events-auto relative flex h-8 items-center gap-1.5 pl-1.5 pr-2.5 rounded-full border border-emerald-500/30 bg-card/95 hover:bg-card text-foreground shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
              title={isQuickAddOpen ? "Klik untuk panduan form transaksi" : "Klik untuk membuka Bang Peci"}
              aria-label="Panduan Asisten Bang Peci"
            >
              <div className="relative h-5 w-5 shrink-0 flex items-center justify-center">
                <Image
                  src={mascotOutfit === "analyst" ? "/mascot/mascot-tech-halo.png" : "/mascot/mascot-halo.png"}
                  alt="Bang Peci Avatar"
                  fill
                  sizes="20px"
                  className="object-contain drop-shadow-xs select-none pointer-events-none"
                  unoptimized
                />
              </div>
              <span className="text-[11px] font-bold text-foreground/80 group-hover:text-primary transition-colors flex items-center gap-1">
                {isQuickAddOpen ? (
                  <>
                    <Compass className="h-3 w-3 text-primary" />
                    Panduan Form
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 text-primary" />
                    Bang Peci
                  </>
                )}
              </span>
            </button>
          ) : isUserMinimized ? (
            /* Condition B: Mode Tenang - Compact docked badge when minimized by user */
            <button
              onClick={() => toggleUserMinimize(false)}
              className="group pointer-events-auto relative flex h-8 items-center gap-1.5 pl-1.5 pr-2.5 rounded-full border border-border/80 bg-card/90 hover:bg-card text-foreground shadow-md backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer opacity-80 hover:opacity-100"
              title="Klik untuk perbesar Bang Peci"
              aria-label="Perbesar Asisten Bang Peci"
            >
              <div className="relative h-5 w-5 shrink-0 flex items-center justify-center">
                <Image
                  src={mascotOutfit === "analyst" ? "/mascot/mascot-tech-halo.png" : "/mascot/mascot-halo.png"}
                  alt="Bang Peci Avatar"
                  fill
                  sizes="20px"
                  className="object-contain drop-shadow-xs select-none pointer-events-none"
                  unoptimized
                />
              </div>
              <span className="text-[11px] font-bold text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />
                Bang Peci
              </span>
            </button>
          ) : (
            /* Condition C: Standard full-size FAB with smart scroll-dimming & calm-mode typing */
            <div className="relative group/btn pointer-events-auto">
              {/* Quick one-click minimize button on hover */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleUserMinimize(true);
                }}
                className="absolute -top-1.5 -left-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-card/90 border border-border/80 text-muted-foreground hover:text-foreground opacity-0 group-hover/btn:opacity-100 transition-opacity shadow-xs cursor-pointer hover:bg-muted"
                title="Kecilkan widget (Mode Tenang)"
                aria-label="Kecilkan widget"
              >
                <Minus className="h-3 w-3" />
              </button>

              <button
                onClick={toggleBubble}
                className={`group relative flex h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 items-center justify-center rounded-full border-2 border-primary bg-card shadow-2xl transition-all duration-300 ${
                  isScrolling
                    ? "opacity-30 scale-90 translate-y-1 hover:opacity-100 hover:scale-100"
                    : isInputFocused
                    ? "opacity-75 hover:opacity-100 hover:scale-105"
                    : "hover:scale-110 active:scale-95 animate-mascot-float"
                } focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40`}
                aria-label="Buka Menu Asisten Bang Peci"
              >
                {/* Glowing Pulse Ring (calmed during scrolling or typing) */}
                {!isInputFocused && !isScrolling && (
                  <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-60 pointer-events-none" />
                )}

                {/* Mascot Avatar Inside Bubble with Spin Flip & Bounce */}
                <div
                  className={`relative h-9 w-9 sm:h-11 sm:w-11 md:h-12 md:w-12 flex items-center justify-center ${
                    isTransforming
                      ? "animate-mascot-spin-flip"
                      : isInputFocused || isScrolling
                      ? ""
                      : "animate-mascot-bounce-playful"
                  }`}
                >
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
                <span className="absolute -top-1 -right-1 flex h-4 w-4 md:h-5 md:w-5 items-center justify-center rounded-full bg-primary text-white text-[9px] md:text-[10px] font-black shadow-md">
                  <Sparkles className="h-2.5 w-2.5 md:h-3 md:w-3" />
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
