/* Hallmark · component: OverviewMascotMood · theme: Bibit-Fintech · genre: modern-minimal */
"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { formatCurrency } from "@/lib/utils";
import { mascotSound } from "@/lib/mascot-sound";
import { Sparkles, MessageCircle, Volume2, VolumeX, RefreshCw } from "lucide-react";
import { useMascotStore } from "@/store/mascot.store";

interface OverviewMascotMoodProps {
  netCashflow: number;
  income: number;
  expense: number;
  periodLabel: string;
}

const CUAN_QUOTES = [
  "Cuan mengalir deras bos! Jangan lupa sisihkan buat dana darurat ya! 🚀",
  "Alhamdulillah surplus! Saatnya perkuat tabungan atau investasi nih. 💰",
  "Arus kas positif! Pengeluaranmu bulan ini terkontrol dengan sangat baik. 🌟",
  "Gaya hidup terkendali, dompet pun berseri-seri! Lanjutkan bos! 👏",
];

const DEFICIT_QUOTES = [
  "Waduh minus nih bos! Yuk kita evaluasi dan rem jajan kopinya dulu. 💸",
  "Pengeluaran lagi lebih besar dari pemasukan. Cek menu Anggaran ya! 📉",
  "Jangan panik bos! Masih ada waktu buat hemat dan seimbangkan kas. 🛡️",
  "Boncos tipis-tipis? Tenang, Bang Peci siap temani atur strategi hemat! 🧐",
];

const STABLE_QUOTES = [
  "Arus kas pas seimbang! Pemasukan dan pengeluaran sama kuatnya. ⚖️",
  "Kondisi aman terkendali. Usahakan ada sisa surplus buat tabungan ya! 🛡️",
  "Ritme stabil bos! Tetap disiplin catat setiap transaksi kecil. ✨",
];

export function OverviewMascotMood({
  netCashflow,
  income,
  expense,
  periodLabel,
}: OverviewMascotMoodProps) {
  const { isMuted, toggleMute, startTour } = useMascotStore();
  const [clickCount, setClickCount] = useState(0);
  const [isWiggling, setIsWiggling] = useState(false);

  // Tentukan mood & ekspresi berdasarkan Arus Kas Bersih
  const { mood, mascotImg, badgeText, badgeColor, defaultQuote, statusEmoji } = useMemo(() => {
    if (netCashflow > 0) {
      return {
        mood: "cuan" as const,
        mascotImg: "/mascot/mascot-cuan.png",
        badgeText: "Surplus Cuan",
        badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        defaultQuote: `Alhamdulillah surplus ${formatCurrency(netCashflow)}! Tabungan makin tebal nih, mantap bos! 🚀`,
        statusEmoji: "🤑",
      };
    } else if (netCashflow < 0) {
      // Jika defisit sangat dalam (> 50% pengeluaran), pakai ekspresi boncos/marah
      const isSevere = expense > 0 && Math.abs(netCashflow) > expense * 0.5;
      return {
        mood: "deficit" as const,
        mascotImg: isSevere ? "/mascot/mascot-boncos.png" : "/mascot/mascot-sedih.png",
        badgeText: isSevere ? "Peringatan Boncos" : "Defisit Kas",
        badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        defaultQuote: `Waduh arus kas minus ${formatCurrency(Math.abs(netCashflow))}. Yuk rem belanja & jajan dulu ya! 💸`,
        statusEmoji: isSevere ? "😡" : "🥺",
      };
    } else {
      return {
        mood: "stable" as const,
        mascotImg: "/mascot/mascot-stabil.png",
        badgeText: "Kas Seimbang",
        badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        defaultQuote: `Arus kas imbang seimbang nih bos. Jaga terus ritme dan hindari belanja impulsif ya! ⚖️`,
        statusEmoji: "👌",
      };
    }
  }, [netCashflow, expense]);

  // Rotasi quote saat maskot diklik
  const activeQuote = useMemo(() => {
    if (clickCount === 0) return defaultQuote;
    const quotes = mood === "cuan" ? CUAN_QUOTES : mood === "deficit" ? DEFICIT_QUOTES : STABLE_QUOTES;
    return quotes[clickCount % quotes.length];
  }, [clickCount, defaultQuote, mood]);

  const handleMascotClick = () => {
    setIsWiggling(true);
    setClickCount((prev) => prev + 1);

    if (mood === "cuan") {
      mascotSound.playChime();
    } else if (mood === "deficit") {
      mascotSound.playSad();
    } else {
      mascotSound.playPop();
    }

    setTimeout(() => {
      setIsWiggling(false);
    }, 600);
  };

  return (
    <div className="relative group overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card/90 via-card/70 to-muted/30 p-3.5 sm:p-4 backdrop-blur-md shadow-sm transition-all hover:shadow-md">
      {/* Decorative Glow */}
      <div
        className={`absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors ${
          mood === "cuan"
            ? "bg-emerald-500"
            : mood === "deficit"
            ? "bg-rose-500"
            : "bg-amber-500"
        }`}
      />

      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3.5 relative z-10">
        {/* Interactive Mascot Avatar */}
        <div className="relative flex flex-col items-center shrink-0">
          <button
            onClick={handleMascotClick}
            className={`relative p-0 transition-transform duration-300 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              isWiggling ? "animate-mascot-wiggle" : "animate-mascot-bounce-playful"
            }`}
            title="Klik Bang Peci untuk celetukan finansial!"
            aria-label="Bang Peci Fin.IQ"
          >
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
              <Image
                src={mascotImg}
                alt="Bang Peci - Maskot Fin.IQ"
                fill
                sizes="(max-width: 640px) 112px, 128px"
                className="object-contain drop-shadow-md select-none pointer-events-none"
                priority
                unoptimized
              />
            </div>
          </button>
        </div>

        {/* Speech Bubble & Commentary */}
        <div className="flex-1 min-w-0 flex flex-col justify-between w-full">
          {/* Header Row: Name & Tag */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base text-foreground tracking-tight flex items-center gap-1.5">
                Bang Peci
                <span className="text-[10px] font-medium text-muted-foreground hidden sm:inline">
                  • Asisten Fin.IQ
                </span>
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                {badgeText}
              </span>
            </div>

            {/* Sound Toggle & Refresh Button */}
            <div className="flex items-center gap-1 text-muted-foreground">
              <button
                onClick={handleMascotClick}
                className="p-1 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                title="Ganti Celetukan"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={toggleMute}
                className="p-1 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                title={isMuted ? "Aktifkan Suara Maskot" : "Bisukan Suara Maskot"}
              >
                {isMuted ? <VolumeX className="h-3.5 w-3.5 text-muted-foreground" /> : <Volume2 className="h-3.5 w-3.5 text-primary" />}
              </button>
            </div>
          </div>

          {/* Dialog Bubble */}
          <div className="relative rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 px-3 py-2 text-xs sm:text-sm text-foreground leading-relaxed shadow-sm">
            <p className="font-medium text-foreground/90">
              "{activeQuote}"
            </p>
          </div>

          {/* Quick Footer: Context & Tour Trigger */}
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="truncate">
              Evaluasi kas periode: <span className="font-semibold text-foreground">{periodLabel}</span>
            </span>
            <button
              onClick={() => startTour("basic")}
              className="text-primary hover:underline font-semibold shrink-0 ml-2 flex items-center gap-1 text-[11px]"
            >
              <Sparkles className="h-3 w-3" />
              Panduan Pemula
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
