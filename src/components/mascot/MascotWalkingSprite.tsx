/* Hallmark · component: MascotWalkingSprite · theme: Bibit-Fintech · genre: modern-minimal */
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";

export type FinancialStatusType = "surplus" | "warning" | "critical";

export interface MascotWalkingSpriteProps {
  financialStatus: FinancialStatusType;
  isWalking: boolean;
  isDragging?: boolean;
  isLanded?: boolean;
  isSleeping?: boolean;
  direction: 1 | -1; // 1 = right, -1 = left
  speechText?: string | null;
  onSpriteClick?: () => void;
  onWakeUp?: () => void;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerCancel?: (e: React.PointerEvent<HTMLDivElement>) => void;
  className?: string;
}

export function MascotWalkingSprite({
  financialStatus,
  isWalking,
  isDragging = false,
  isLanded = false,
  isSleeping = false,
  direction,
  speechText,
  onSpriteClick,
  onWakeUp,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  className = "",
}: MascotWalkingSpriteProps) {
  // 1. Animasi langkah kaki naik bergantian saat berjalan (kaki berbulu alami tanpa celana/sepatu)
  const [walkStep, setWalkStep] = useState<0 | 1>(0);

  useEffect(() => {
    if (!isWalking || isSleeping) {
      setWalkStep(0);
      return;
    }

    // Pergantian gambar langkah kaki naik setiap 320ms agar langkah terlihat hidup dan berirama
    const interval = setInterval(() => {
      setWalkStep((prev) => (prev === 0 ? 1 : 0));
    }, 320);

    return () => clearInterval(interval);
  }, [isWalking, isSleeping]);

  // 2. Animasi melambaikan tangan saat diam / santai di posisi atau saat di-hover kursor
  const [isWaving, setIsWaving] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);

  // Mata berkedip alami saat diam (setiap ~3.5 detik selama 160ms)
  useEffect(() => {
    if (isWalking || isDragging || isSleeping) {
      setIsBlinking(false);
      return;
    }

    let blinkTimeout: NodeJS.Timeout;
    let resetTimeout: NodeJS.Timeout;

    const scheduleBlink = () => {
      const nextInterval = 3200 + Math.random() * 2000;
      blinkTimeout = setTimeout(() => {
        setIsBlinking(true);
        resetTimeout = setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 160);
      }, nextInterval);
    };

    scheduleBlink();

    return () => {
      clearTimeout(blinkTimeout);
      clearTimeout(resetTimeout);
    };
  }, [isWalking, isDragging, isSleeping]);

  // Melambaikan tangan berkala secara otomatis atau saat di-hover oleh pengguna
  useEffect(() => {
    if (isWalking || isDragging || isSleeping) {
      setIsWaving(false);
      return;
    }

    // Jika pengguna sedang mengarahkan kursor (hover), langsung melambai ramah
    if (isHovered) {
      setIsWaving(true);
      return;
    }

    let waveTimer: NodeJS.Timeout;
    let resetTimer: NodeJS.Timeout;

    const scheduleWave = () => {
      // Tiap 6 - 9 detik sekali saat santai, Bang Peci melambaikan tangan ramah selama 2.2 detik
      const nextInterval = 6000 + Math.random() * 3000;
      waveTimer = setTimeout(() => {
        setIsWaving(true);
        resetTimer = setTimeout(() => {
          setIsWaving(false);
          scheduleWave();
        }, 2200);
      }, nextInterval);
    };

    scheduleWave();

    return () => {
      clearTimeout(waveTimer);
      clearTimeout(resetTimer);
    };
  }, [isWalking, isDragging, isSleeping, isHovered]);

  // 3. Tentukan gambar sprite 2D sesuai pose, kondisi keuangan, tidur, dan aksi interaktif:
  const spriteSrc = useMemo(() => {
    // A. Saat Sedang Tidur di Kasur Bulat Rumah Kucing:
    if (isSleeping) {
      return "/mascot/mascot-rpg-sleep.png";
    }

    // B. Saat Berjalan: langkah kaki kucing berbulu alami & ayunan tangan alami
    if (isWalking) {
      // Jika kondisi minus (defisit): wajah cemas & ekor tegang lurus ke atas!
      if (financialStatus === "critical") {
        return walkStep === 0
          ? "/mascot/mascot-rpg-walk-sad-1.png"
          : "/mascot/mascot-rpg-walk-sad-2.png";
      }
      return walkStep === 0
        ? "/mascot/mascot-rpg-walk-1.png"
        : "/mascot/mascot-rpg-walk-2.png";
    }

    // C. Saat Melambaikan Tangan saat Diam / Di-Hover
    if (isWaving) {
      return isBlinking
        ? "/mascot/mascot-rpg-wave-blink.png"
        : "/mascot/mascot-rpg-wave.png";
    }

    // D. Ekspresi Sesuai Kondisi Keuangan Saat Diam:
    // - Surplus: Wajah sangat senang, mata terpejam bahagia, memegang koin cuan emas!
    if (financialStatus === "surplus") {
      return "/mascot/mascot-rpg-happy.png";
    }
    // - Defisit/Kritis: Wajah sedih, telinga turun, mulut cemas & EKOR TEGANG KE ATAS!
    if (financialStatus === "critical") {
      return "/mascot/mascot-rpg-sad.png";
    }
    // - Warning / Evaluasi: Wajah analitis berpikir memegang kacamata
    if (financialStatus === "warning") {
      return "/mascot/mascot-rpg-warning.png";
    }

    // - Seimbang/Normal: Wajah tenang, mata terbuka ramah (berkedip berkala)
    if (isBlinking) {
      return "/mascot/mascot-rpg-front-blink.png";
    }
    return "/mascot/mascot-rpg-front.png";
  }, [isSleeping, isWalking, walkStep, isWaving, isBlinking, financialStatus]);

  // Animasi CSS dinamis (tidur, berjalan, melambai, idle bernapas, diangkat, atau mendarat)
  const activeAnimationClass = isSleeping
    ? "animate-rpg-mascot-sleep"
    : isDragging
    ? "animate-rpg-mascot-held"
    : isLanded
    ? "animate-rpg-mascot-land"
    : isWalking
    ? "animate-rpg-mascot-walk"
    : isWaving
    ? "animate-mascot-wave"
    : "animate-rpg-mascot-idle";

  return (
    <div
      className={`relative select-none touch-none ${className}`}
      style={{
        pointerEvents: "auto",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {/* =========================================================================
          1. SPEECH BUBBLE KONTEKSTUAL (MUNCUL BERKALA SAAT BERHENTI / DIKLIK)
      ========================================================================= */}
      {speechText && !isDragging && (
        <div
          className="absolute -top-16 left-1/2 -translate-x-1/2 z-35 pointer-events-auto whitespace-nowrap animate-in fade-in zoom-in-95 duration-200"
          style={{ transform: "translateX(-50%)" }}
        >
          <div
            onClick={isSleeping ? (onWakeUp || onSpriteClick) : onSpriteClick}
            className="relative max-w-[220px] sm:max-w-[270px] px-3 py-1.5 rounded-xl border border-primary/25 bg-card/95 text-foreground shadow-lg backdrop-blur-md text-[11px] font-semibold leading-snug cursor-pointer hover:border-primary/50 transition-all hover:scale-102"
          >
            <p className="line-clamp-2 text-foreground/95">{speechText}</p>
            {/* Bubble Tail Arrow */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-card border-r border-b border-primary/25 rotate-45" />
          </div>
        </div>
      )}

      {/* =========================================================================
          2. KARAKTER BANG PECI & ANIMASI KAKI BERJALAN + FLIP HORIZONTAL
      ========================================================================= */}
      <div
        className={`group relative flex flex-col items-center select-none ${
          isDragging ? "cursor-grabbing" : "cursor-grab active:cursor-grabbing"
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={
          isSleeping
            ? "Bang Peci sedang tidur pulas di kasurnya... Klik untuk bangunkan!"
            : "Arahkan kursor atau klik Bang Peci untuk konsultasi keuangan!"
        }
        aria-label="Bang Peci Pendamping Fin.IQ"
      >
        {/* Kontainer yang di-FLIP Horizontal sesuai arah hadap (Kiri vs Kanan) */}
        <div
          className="relative transition-transform duration-250 ease-out origin-bottom"
          style={{
            transform: `scaleX(${direction})`,
          }}
        >
          {/* Badan Karakter dengan Animasi Langkah / Idle / Melambai / Held / Land */}
          <div
            className={`relative w-20 h-24 sm:w-24 sm:h-28 transition-transform duration-200 origin-bottom ${activeAnimationClass}`}
          >
            <Image
              src={spriteSrc}
              alt="Bang Peci"
              fill
              sizes="(max-width: 640px) 80px, 96px"
              className="object-contain drop-shadow-md select-none pointer-events-none transition-all group-hover:brightness-105"
              priority
              unoptimized
              draggable={false}
            />

            {/* Partikel Jejak Langkah Halus saat Berjalan */}
            {isWalking && (
              <div className="absolute -bottom-0.5 -left-1 w-2.5 h-2 rounded-full bg-amber-200/60 dark:bg-amber-100/40 blur-[1px] animate-rpg-dust pointer-events-none" />
            )}

            {/* Balon Zzz Melayang saat Bang Peci Tidur di Kasur Bulat */}
            {isSleeping && !isDragging && (
              <div className="absolute -top-8 -right-2 flex items-center pointer-events-none select-none z-30">
                <span className="text-xs font-bold text-amber-500/90 dark:text-amber-400/90 animate-rpg-zzz-1">z</span>
                <span className="text-sm font-black text-amber-500 dark:text-amber-300 animate-rpg-zzz-2 ml-1">Z</span>
                <span className="text-base font-black text-amber-600 dark:text-amber-200 animate-rpg-zzz-3 ml-0.5">z</span>
              </div>
            )}

            {/* Mikro Emote Status Keuangan (Hanya saat Bangun) */}
            {!isDragging && !isSleeping && (
              <>
                {financialStatus === "surplus" && (
                  <span
                    className="absolute -top-1 -right-1 text-xs select-none pointer-events-none animate-bounce"
                    title="Kondisi Surplus Cuan!"
                  >
                    ✨
                  </span>
                )}
                {financialStatus === "critical" && (
                  <span
                    className="absolute top-4 -right-1.5 text-xs select-none pointer-events-none animate-pulse"
                    title="Kondisi Defisit Waspada"
                  >
                    💧
                  </span>
                )}
                {financialStatus === "warning" && (
                  <span
                    className="absolute -top-1 -right-1 text-xs select-none pointer-events-none animate-pulse"
                    title="Kondisi Seimbang / Evaluasi Pengeluaran"
                  >
                    💡
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* =========================================================================
            3. DYNAMIC GROUND SHADOW
        ========================================================================= */}
        <div
          className={`w-14 h-2.5 sm:w-16 sm:h-3 rounded-full bg-black/20 dark:bg-black/55 blur-[2px] -mt-1 transition-all duration-300 pointer-events-none ${
            isDragging
              ? "scale-50 opacity-20 translate-y-3"
              : isWalking
              ? "scale-x-85 opacity-40 animate-pulse"
              : "scale-x-100 opacity-60"
          }`}
        />
      </div>
    </div>
  );
}
