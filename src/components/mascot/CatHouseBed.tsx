/* Hallmark · component: CatHouseBed · theme: Bibit-Fintech · genre: modern-minimal / cute-tactile */
"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Moon, Sun, Sparkles, BedDouble } from "lucide-react";
import { mascotSound } from "@/lib/mascot-sound";
import { useMascotStore } from "@/store/mascot.store";
import { useTranslation } from "@/i18n";

interface CatHouseBedProps {
  isSleeping: boolean;
  onWakeUp?: () => void;
  onSleep?: () => void;
  className?: string;
}

export function CatHouseBed({
  isSleeping,
  onWakeUp,
  onSleep,
  className = "",
}: CatHouseBedProps) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const { isDraggingMascot } = useMascotStore();

  const handleToggleSleep = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSleeping) {
      mascotSound.playChime();
      onWakeUp?.();
    } else {
      mascotSound.playPop();
      onSleep?.();
    }
  };

  const isDropTargetActive = isDraggingMascot && !isSleeping;

  return (
    <div
      id="cat-house-dropzone"
      data-walker-target="cathouse"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={isSleeping ? onWakeUp : undefined}
      className={`relative group select-none transition-all duration-300 rounded-2xl border bg-card/90 p-3.5 sm:p-5 backdrop-blur-md shadow-2xs overflow-hidden flex flex-row items-center justify-between gap-3 sm:gap-6 cursor-pointer active:scale-[0.995] ${
        isDropTargetActive
          ? "border-primary ring-4 ring-primary/25 bg-primary/10 shadow-lg scale-[1.01] animate-pulse"
          : isHovered && !isSleeping
          ? "border-primary/60 ring-2 ring-primary/30 bg-primary/5 scale-[1.005] shadow-xs"
          : "border-border/80 hover:border-primary/50 hover:shadow-xs"
      } ${className}`}
      title={
        isSleeping
          ? t.catHouse.sleepingTooltip
          : isDraggingMascot
          ? t.catHouse.dropTooltip
          : t.catHouse.readyTooltip
      }
    >
      {/* Background Ambient Glow */}
      <div
        className={`absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${
          isDropTargetActive
            ? "bg-primary/25"
            : isSleeping
            ? "bg-amber-500/10 dark:bg-amber-400/10"
            : "bg-primary/10"
        }`}
      />

      {/* Sisi Kiri: Informasi Rumah, Status, & Tombol Kontrol */}
      <div className="flex flex-col gap-1.5 sm:gap-2 min-w-0 z-10 flex-1 text-left">
        <div className="flex items-center justify-start gap-1.5 sm:gap-2">
          <span
            className={`flex h-2 w-2 rounded-full ${
              isDropTargetActive
                ? "bg-primary animate-ping"
                : isSleeping
                ? "bg-amber-500 animate-ping"
                : "bg-emerald-500 animate-pulse"
            }`}
          />
          <span
            className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full border transition-all ${
              isDropTargetActive
                ? "bg-primary/20 text-primary border-primary/40 animate-pulse"
                : isSleeping
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            }`}
          >
            {isDropTargetActive
              ? t.catHouse.dropHereStatus
              : isSleeping
              ? t.catHouse.sleepingStatus
              : t.catHouse.readyStatus}
          </span>
        </div>

        <div>
          <h4 className="text-sm sm:text-base font-extrabold text-foreground tracking-tight flex items-center justify-start gap-1.5">
            <span>{t.catHouse.title}</span>
            <span className="text-xs">🏡</span>
          </h4>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 max-w-md line-clamp-2 sm:line-clamp-none leading-snug">
            {isDropTargetActive ? (
              <span className="text-primary font-semibold animate-pulse">
                {t.catHouse.descDrop}
              </span>
            ) : isSleeping ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                {t.catHouse.descSleeping}
              </span>
            ) : (
              <span>
                {t.catHouse.descReady}
              </span>
            )}
          </p>
        </div>

        {/* Tombol Interaksi Bangunkan / Ajak Tidur */}
        <div className="pt-0.5 sm:pt-1 flex items-center justify-start gap-2">
          {isSleeping ? (
            <button
              type="button"
              onClick={handleToggleSleep}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:px-4 sm:py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs sm:text-sm shadow-xs hover:bg-primary/90 active:scale-95 transition-all cursor-pointer min-h-[44px]"
            >
              <Sun className="h-4 w-4 shrink-0" />
              <span className="inline sm:hidden">{t.catHouse.wakeUp}</span>
              <span className="hidden sm:inline">{t.catHouse.wakeUpFull}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleToggleSleep}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:px-4 sm:py-2.5 rounded-xl border border-input bg-background/80 hover:bg-muted text-foreground font-semibold text-xs sm:text-sm shadow-2xs active:scale-95 transition-all cursor-pointer min-h-[44px]"
            >
              <Moon className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="inline sm:hidden">{t.catHouse.putToSleep}</span>
              <span className="hidden sm:inline">{t.catHouse.putToSleepFull}</span>
            </button>
          )}

          {isHovered && !isSleeping && (
            <span className="text-[11px] font-medium text-primary flex items-center gap-1 animate-pulse hidden sm:inline-flex">
              <Sparkles className="h-3.5 w-3.5" />
              {t.catHouse.dropTooltip}
            </span>
          )}
        </div>
      </div>

      {/* Sisi Kanan: Tampilan 3D Rumah Kayu & Kasur Tidur Bang Peci */}
      <div
        id="cat-house-bed-target"
        className="relative flex items-center justify-center shrink-0 z-10 w-28 h-[96px] sm:w-52 sm:h-44 transition-transform duration-300 group-hover:scale-102"
      >
        {isSleeping && (
          <div className="absolute -top-2 right-4 sm:-top-3 sm:right-8 flex items-center pointer-events-none select-none z-30">
            <span className="text-[10px] sm:text-xs font-bold text-amber-500/90 dark:text-amber-400/90 animate-rpg-zzz-1">z</span>
            <span className="text-xs sm:text-sm font-black text-amber-500 dark:text-amber-300 animate-rpg-zzz-2 ml-1">Z</span>
            <span className="text-sm sm:text-base font-black text-amber-600 dark:text-amber-200 animate-rpg-zzz-3 ml-0.5">z</span>
          </div>
        )}

        <div
          className={`relative w-full h-full transition-all duration-300 ${
            isSleeping ? "animate-rpg-mascot-sleep" : ""
          }`}
        >
          <Image
            src={isSleeping ? "/mascot/cat-house-sleeping.png" : "/mascot/cat-house-empty.png"}
            alt={isSleeping ? t.catHouse.descSleeping : t.catHouse.title}
            fill
            sizes="(max-width: 640px) 112px, 208px"
            className="object-contain drop-shadow-md select-none pointer-events-none transition-all"
            priority
            unoptimized
          />
        </div>

        {isHovered && !isSleeping && (
          <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-primary/70 animate-pulse pointer-events-none" />
        )}
      </div>
    </div>
  );
}
