/* Hallmark · component: OverviewMascotMood · theme: Bibit-Fintech · genre: modern-minimal */
"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { mascotSound } from "@/lib/mascot-sound";
import { Sparkles, Volume2, VolumeX, RefreshCw } from "lucide-react";
import { useMascotStore } from "@/store/mascot.store";
import { useTranslation } from "@/i18n";

interface OverviewMascotMoodProps {
  netCashflow: number;
  income: number;
  expense: number;
  periodLabel: string;
}

const CUAN_QUOTES_ID = [
  "Anjay cuan ngalir deras cuy! Jangan lupa sisihkan buat dana darurat ya.",
  "Alhamdulillah surplus! Saatnya tebelin tabungan atau invest, jangan langsung kalap checkout olshop.",
  "Arus kas ijo royo-royo! Pengeluaranmu bulan ini rapi banget, Bang Peci bangga.",
  "Gaya hidup terkendali, dompet pun berseri-seri! Mantap jiwa, lanjutkan bos.",
  "Dompet lagi tebel nih cuy! Pertahankan ritmenya biar gak ngenes makan mie instan pas tanggal tua.",
];

const CUAN_QUOTES_EN = [
  "Surplus cash flow is rolling in! Don't forget to build up your emergency fund! 🚀",
  "Great surplus! Excellent time to strengthen savings or investments. 💰",
  "Positive cash flow! Your expenses this period are well under control. 🌟",
  "Disciplined spending leads to financial freedom! Keep up the momentum! 👏",
];

const DEFICIT_QUOTES_ID = [
  "Waduh minus nih bos! Dompet mulai menjerit, rem dulu jajan kopi susunya ya.",
  "Pengeluaran lebih gede dari pemasukan nih cuy. Cek menu Anggaran sebelum ambyar.",
  "Jangan panik dulu bos! Masih ada waktu buat ngerem belanjaan dan bikin kas seimbang lagi.",
  "Boncos tipis-tipis? Tenang cuy, Bang Peci siap temani atur strategi hemat biar gak puyeng.",
  "Aduh dompet lagi bocor halus nih! Yuk ngobrol sama Bang Peci buat bedah pos mana yang bikin tekor.",
];

const DEFICIT_QUOTES_EN = [
  "Cash flow is in the red. Let's review non-essential expenses and tighten the belt! 💸",
  "Outflows exceed inflows for this period. Check the Budgets tab! 📉",
  "Stay calm! There is still time to economize and rebalance the books. 🛡️",
  "Minor burn? Bang Peci is here to help you formulate a recovery plan! 🧐",
];

const STABLE_QUOTES_ID = [
  "Arus kas pas seimbang! Pemasukan sama pengeluaran lagi kejar-kejaran nih.",
  "Kondisi aman sentosa, tapi usahain ada sisa surplus buat tabungan ya cuy.",
  "Ritme stabil bos! Tetep disiplin catat transaksi sekecil apa pun biar gak kecolongan.",
  "Nafas dompet lagi anteng. Jaga terus ritmenya biar gak mendadak jebol.",
];

const STABLE_QUOTES_EN = [
  "Cash flow is perfectly balanced! Inflows match outflows evenly. ⚖️",
  "Stable conditions. Aim for a small net surplus to fuel savings next month! 🛡️",
  "Steady rhythm! Keep up the discipline of logging every single transaction. ✨",
];

export function OverviewMascotMood({
  netCashflow,
  income,
  expense,
  periodLabel,
}: OverviewMascotMoodProps) {
  const { isMuted, toggleMute, startTour } = useMascotStore();
  const { t, locale, formatCurrency } = useTranslation();
  const isEn = locale === "en";

  const [clickCount, setClickCount] = useState(0);
  const [isWiggling, setIsWiggling] = useState(false);

  // Tentukan mood & ekspresi berdasarkan Arus Kas Bersih
  const { mood, mascotImg, badgeText, badgeColor, defaultQuote, statusEmoji } = useMemo(() => {
    if (netCashflow > 0) {
      return {
        mood: "cuan" as const,
        mascotImg: "/mascot/mascot-cuan.png",
        badgeText: t.mascotMood.surplusBadge,
        badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        defaultQuote: isEn
          ? `Solid surplus of ${formatCurrency(netCashflow)}! Savings reserves are expanding nicely! 🚀`
          : `Alhamdulillah surplus ${formatCurrency(netCashflow)}! Tabungan makin tebal nih, mantap jiwa bos!`,
        statusEmoji: "🤑",
      };
    } else if (netCashflow < 0) {
      const isSevere = expense > 0 && Math.abs(netCashflow) > expense * 0.5;
      return {
        mood: "deficit" as const,
        mascotImg: isSevere ? "/mascot/mascot-boncos.png" : "/mascot/mascot-sedih.png",
        badgeText: isSevere ? t.mascotMood.warningBadge : t.mascotMood.deficitBadge,
        badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
        defaultQuote: isEn
          ? `Notice: net outflow deficit of ${formatCurrency(Math.abs(netCashflow))}. Time to pause impulsive spendings! 💸`
          : `Waduh arus kas tekor minus ${formatCurrency(Math.abs(netCashflow))} nih cuy. Yuk rem jajan dulu ya!`,
        statusEmoji: isSevere ? "😡" : "🥺",
      };
    } else {
      return {
        mood: "stable" as const,
        mascotImg: "/mascot/mascot-stabil.png",
        badgeText: t.mascotMood.stableBadge,
        badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        defaultQuote: isEn
          ? `Cash flow is break-even. Maintain this discipline and avoid impulse purchases! ⚖️`
          : `Arus kas imbang seimbang nih bos. Jaga ritme dan tahan diri dari diskon olshop ya!`,
        statusEmoji: "👌",
      };
    }
  }, [netCashflow, expense, isEn, formatCurrency, t]);

  // Rotasi quote saat maskot diklik
  const activeQuote = useMemo(() => {
    if (clickCount === 0) return defaultQuote;
    const cuanList = isEn ? CUAN_QUOTES_EN : CUAN_QUOTES_ID;
    const deficitList = isEn ? DEFICIT_QUOTES_EN : DEFICIT_QUOTES_ID;
    const stableList = isEn ? STABLE_QUOTES_EN : STABLE_QUOTES_ID;
    const quotes = mood === "cuan" ? cuanList : mood === "deficit" ? deficitList : stableList;
    return quotes[clickCount % quotes.length];
  }, [clickCount, defaultQuote, mood, isEn]);

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
    <div className="relative group overflow-hidden rounded-md border border-border/70 bg-gradient-to-br from-card/90 via-card/70 to-muted/30 p-3.5 sm:p-4 backdrop-blur-md shadow-2xs transition-all hover:shadow-xs">
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
            title={isEn ? "Click Bang Peci for financial commentary!" : "Klik Bang Peci buat celetukan seru!"}
            aria-label="Bang Peci Fin.IQ"
          >
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
              <Image
                src={mascotImg}
                alt="Bang Peci - Fin.IQ Mascot"
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
                  • {isEn ? "Fin.IQ Assistant" : "Asisten Fin.IQ"}
                </span>
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm border ${badgeColor}`}>
                {badgeText}
              </span>
            </div>

            {/* Sound Toggle & Refresh Button */}
            <div className="flex items-center gap-1 text-muted-foreground">
              <button
                onClick={handleMascotClick}
                className="p-1 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                title={isEn ? "Next Quote" : "Ganti Celetukan"}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={toggleMute}
                className="p-1 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                title={isMuted ? (isEn ? "Unmute Mascot" : "Aktifkan Suara Maskot") : (isEn ? "Mute Mascot" : "Bisukan Suara Maskot")}
              >
                {isMuted ? <VolumeX className="h-3.5 w-3.5 text-muted-foreground" /> : <Volume2 className="h-3.5 w-3.5 text-primary" />}
              </button>
            </div>
          </div>

          {/* Dialog Bubble */}
          <div className="relative rounded-md border border-primary/20 bg-primary/5 dark:bg-primary/10 px-3 py-2 text-xs sm:text-sm text-foreground leading-relaxed shadow-2xs">
            <p className="font-medium text-foreground/90">
              "{activeQuote}"
            </p>
          </div>

          {/* Quick Footer: Context & Tour Trigger */}
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="truncate">
              {isEn ? "Cash evaluation for period: " : "Evaluasi kas periode: "}
              <span className="font-semibold text-foreground">{periodLabel}</span>
            </span>
            <button
              onClick={() => startTour("basic")}
              className="text-primary hover:underline font-semibold shrink-0 ml-2 flex items-center gap-1 text-[11px]"
            >
              <Sparkles className="h-3 w-3" />
              {isEn ? "Quick Tour" : "Tur Bareng Bang Peci"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
