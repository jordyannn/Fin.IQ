/* Hallmark · component: MascotRoamingStage · theme: Bibit-Fintech · genre: modern-minimal */
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { MascotWalkingSprite, FinancialStatusType } from "./MascotWalkingSprite";
import { useMascotStore } from "@/store/mascot.store";
import { mascotSound } from "@/lib/mascot-sound";

interface MascotRoamingStageProps {
  financialStatus: FinancialStatusType;
  netCashflow: number;
  income: number;
  expense: number;
}

// Koleksi celetukan kontekstual Bang Peci saat patroli RPG 2D
const SURPLUS_ROAM_QUOTES = [
  "Alhamdulillah surplus! Tabungan makin tebal nih, mantap bos! 🚀",
  "Arus kas positif! Pengeluaran bulan ini terkontrol rapi. 💰",
  "Cuan mengalir stabil! Jangan lupa sisihkan dana darurat ya. ✨",
  "Gaya hidup sehat, dompet berseri-seri! Lanjutkan bos! 👏",
  "Patroli aman! Keuanganmu berada di jalur yang sangat baik. 🛡️",
];

const WARNING_ROAM_QUOTES = [
  "Arus kas pas seimbang! Jaga terus ritme belanja harianmu. ⚖️",
  "Kondisi aman terkendali, hindari belanja impulsif dulu ya! 🛡️",
  "Tetap disiplin catat transaksi, pos penting harus tetap aman. 🧐",
  "Patroli mendeteksi kas seimbang. Yuk perkuat pos tabungan! 💡",
];

const CRITICAL_ROAM_QUOTES = [
  "Waduh minus nih bos! Ekor Bang Peci tegang waspada! 💸",
  "Pengeluaran lagi lebih besar dari pemasukan. Cek menu Anggaran ya! 📉",
  "Boncos tipis-tipis? Tenang, klik aku buat tanya strategi hemat ke AI! 🛡️",
  "Bang Peci siap temani bedah pos pengeluaran yang bocor halus! 🧐",
];

export function MascotRoamingStage({
  financialStatus,
  netCashflow,
  income,
  expense,
}: MascotRoamingStageProps) {
  const {
    isRoamingActive,
    setAIDrawerOpen,
    isSleeping,
    setIsSleeping,
    setIsDraggingMascot,
  } = useMascotStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Koordinat posisi karakter (dalam pixel relatif terhadap dashboard container)
  const [position, setPosition] = useState({ x: 60, y: 160 });
  const [direction, setDirection] = useState<1 | -1>(1); // 1 = Hadap Kanan, -1 = Hadap Kiri
  const [isWalking, setIsWalking] = useState(false);
  const [travelDuration, setTravelDuration] = useState(4.5);
  const [speechText, setSpeechText] = useState<string | null>(null);

  // Status Draggable & Interaksi
  const [isDragging, setIsDragging] = useState(false);
  const [isLanded, setIsLanded] = useState(false);

  const roamTimerRef = useRef<NodeJS.Timeout | null>(null);
  const walkEndTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sleepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const roamCountRef = useRef(0);
  const prevSleepingRef = useRef(isSleeping);

  const dragStateRef = useRef<{
    isDragging: boolean;
    startClientX: number;
    startClientY: number;
    initX: number;
    initY: number;
    hasMoved: boolean;
  }>({
    isDragging: false,
    startClientX: 0,
    startClientY: 0,
    initX: 60,
    initY: 160,
    hasMoved: false,
  });

  // Quotes pool based on status
  const quotes =
    financialStatus === "surplus"
      ? SURPLUS_ROAM_QUOTES
      : financialStatus === "critical"
      ? CRITICAL_ROAM_QUOTES
      : WARNING_ROAM_QUOTES;

  // Deteksi posisi Kasur Bulat Rumah Kucing di DOM relatif terhadap container
  const getCatHouseBedPos = useCallback(() => {
    const bedEl = document.getElementById("cat-house-bed-target");
    const containerEl = containerRef.current;
    if (!bedEl || !containerEl) return null;
    const bedRect = bedEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();
    return {
      x: Math.round(bedRect.left - containerRect.left + bedRect.width / 2 - 46),
      y: Math.round(bedRect.top - containerRect.top + bedRect.height / 2 - 58),
    };
  }, []);

  // Deteksi ukuran layar (mobile vs desktop)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Bersihkan semua timer roam & tidur saat unmount atau interaksi
  const clearRoamTimers = useCallback(() => {
    if (roamTimerRef.current) {
      clearTimeout(roamTimerRef.current);
      roamTimerRef.current = null;
    }
    if (walkEndTimerRef.current) {
      clearTimeout(walkEndTimerRef.current);
      walkEndTimerRef.current = null;
    }
  }, []);

  // Generate target waypoint 2D RPG yang santai, terukur, dan aman di dalam batas dashboard
  const getNextWaypoint = useCallback(
    (currentX: number, currentY: number): { targetX: number; targetY: number; willSleep?: boolean } => {
      if (!containerRef.current) return { targetX: 80, targetY: 200 };

      // Cek apakah saatnya mampir ke Rumah Kucing untuk tidur di kasur bulat
      roamCountRef.current += 1;
      const bedPos = getCatHouseBedPos();
      if (bedPos && roamCountRef.current >= 4 && Math.random() > 0.25) {
        roamCountRef.current = 0;
        return { targetX: bedPos.x, targetY: bedPos.y, willSleep: true };
      }

      const rect = containerRef.current.getBoundingClientRect();
      const maxX = Math.max(140, rect.width - 110);
      const maxY = Math.min(Math.max(260, rect.height - 140), 950);

      if (isMobile) {
        // Mobile Mode: Berpatroli di area dock / sela kartu yang nyaman
        const walkDist = 60 + Math.random() * 80;
        const dir = Math.random() > 0.5 ? 1 : -1;
        const targetX = Math.max(15, Math.min(maxX, currentX + dir * walkDist));
        const targetY = Math.max(80, Math.min(maxY - 30, currentY + (Math.random() - 0.5) * 40));
        return { targetX, targetY };
      }

      // Desktop Mode: Patroli santai RPG (jarak pendek-menengah 100px - 220px agar tidak teleportasi)
      const walkDist = 110 + Math.random() * 110;

      // Hitung sudut langkah dengan pembiasan jika mendekati batas layar
      let angle = Math.random() * Math.PI * 2;
      if (currentX < 70) angle = (Math.random() - 0.5) * Math.PI * 0.7; // dorong ke kanan
      else if (currentX > maxX - 70) angle = Math.PI + (Math.random() - 0.5) * Math.PI * 0.7; // dorong ke kiri
      if (currentY < 100) angle = Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.6; // dorong ke bawah
      else if (currentY > maxY - 70) angle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.6; // dorong ke atas

      let targetX = currentX + Math.cos(angle) * walkDist;
      let targetY = currentY + Math.sin(angle) * walkDist;

      targetX = Math.max(20, Math.min(maxX, targetX));
      targetY = Math.max(70, Math.min(maxY, targetY));

      return { targetX, targetY };
    },
    [isMobile, getCatHouseBedPos]
  );

  // Jadwalkan siklus patroli santai berikutnya
  const scheduleNextRoam = useCallback(
    (delayMs?: number) => {
      clearRoamTimers();

      // Jeda santai sebelum melangkah (6 sampai 9 detik agar tenang dan tidak gelisah)
      const idleTime = delayMs ?? (6500 + Math.random() * 3000);

      roamTimerRef.current = setTimeout(() => {
        if (dragStateRef.current.isDragging || isSleeping) return;

        setPosition((prevPos) => {
          const { targetX, targetY, willSleep } = getNextWaypoint(prevPos.x, prevPos.y);

          // Hitung jarak dan durasi melangkah santai (kecepatan pelan ~30 px/detik sesuai konsep RPG 2D)
          const distance = Math.hypot(targetX - prevPos.x, targetY - prevPos.y);
          // Durasi minimal 3.5s agar selalu pelan & anggun
          const duration = Math.max(3.5, distance / 30);

          // Arah hadap karakter (1 = kanan, -1 = kiri)
          const newDir: 1 | -1 = targetX >= prevPos.x ? 1 : -1;
          setDirection(newDir);
          setTravelDuration(duration);
          setIsWalking(true);
          setSpeechText(null); // Sembunyikan bubble saat mulai melangkah

          // Saat tiba di tujuan langkah:
          walkEndTimerRef.current = setTimeout(() => {
            setIsWalking(false);

            // Jika tujuan adalah kasur Rumah Kucing: langsung tidur di kasur bulat!
            if (willSleep) {
              setIsSleeping(true);
              mascotSound.playPop();
              setSpeechText("Hoaaam... Mau rebahan di kasur bulat bentar... Zzz 🐾");
              setTimeout(() => setSpeechText(null), 3500);

              // Bang Peci tidur selama 15 detik, lalu bangun dan lanjut roaming
              if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
              sleepTimerRef.current = setTimeout(() => {
                setIsSleeping(false);
                mascotSound.playChime();
                setSpeechText("Hoaaam... Segar! Bang Peci siap patroli lagi! 😸");
                setTimeout(() => setSpeechText(null), 4000);
                scheduleNextRoam(5000);
              }, 15000);
              return;
            }

            // 45% peluang celetukan kontekstual santai saat beristirahat di waypoint
            if (Math.random() > 0.4) {
              const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
              setSpeechText(randomQuote);

              // Auto-dismiss bubble setelah 4.5 detik
              setTimeout(() => {
                setSpeechText(null);
              }, 4500);
            }

            // Lanjut ke siklus patroli berikutnya
            scheduleNextRoam();
          }, duration * 1000);

          return { x: targetX, y: targetY };
        });
      }, idleTime);
    },
    [clearRoamTimers, getNextWaypoint, quotes, isSleeping, setIsSleeping]
  );

  // Mulai Autonomous Roaming saat mount atau status roaming aktif
  useEffect(() => {
    if (!isRoamingActive) {
      clearRoamTimers();
      setIsWalking(false);
      return;
    }

    if (!isSleeping) {
      scheduleNextRoam(4000);
    }

    return () => {
      clearRoamTimers();
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    };
  }, [isRoamingActive, isSleeping, scheduleNextRoam, clearRoamTimers]);

  // Efek transisi saat Bang Peci dibangunkan (dari tidur -> bangun)
  useEffect(() => {
    if (prevSleepingRef.current && !isSleeping) {
      const bedPos = getCatHouseBedPos();
      if (bedPos) {
        // Posisikan Bang Peci keluar di depan / samping rumah kucing
        setPosition({
          x: Math.max(20, bedPos.x - 60),
          y: Math.max(60, bedPos.y + 15),
        });
      }
      setIsLanded(true);
      setTimeout(() => setIsLanded(false), 450);
      mascotSound.playChime();
      setSpeechText("Hoaaam... Segar! Bang Peci siap patroli lagi! 😸");
      setTimeout(() => setSpeechText(null), 4000);
      scheduleNextRoam(4000);
    }
    prevSleepingRef.current = isSleeping;
  }, [isSleeping, getCatHouseBedPos, scheduleNextRoam]);

  // =========================================================================
  // HANDLER DRAG & DROP SENDIRI OLEH USER (Bisa Digeser Bebas di Layar)
  // =========================================================================
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Hanya tanggapi left click atau touch primer
    if (e.button !== 0) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    clearRoamTimers();
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);

    // Jika sedang tidur dan mulai digeser, otomatis terbangun
    if (isSleeping) {
      setIsSleeping(false);
    }

    setIsWalking(false);
    setSpeechText(null);
    setIsDraggingMascot(true);

    dragStateRef.current = {
      isDragging: true,
      startClientX: e.clientX,
      startClientY: e.clientY,
      initX: position.x,
      initY: position.y,
      hasMoved: false,
    };

    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.isDragging) return;

    const dx = e.clientX - dragStateRef.current.startClientX;
    const dy = e.clientY - dragStateRef.current.startClientY;

    // Deteksi ambang batas drag minimal (3px) untuk membedakan klik biasa vs geser
    if (!dragStateRef.current.hasMoved && Math.hypot(dx, dy) > 4) {
      dragStateRef.current.hasMoved = true;
    }

    if (dragStateRef.current.hasMoved) {
      const newX = dragStateRef.current.initX + dx;
      const newY = dragStateRef.current.initY + dy;

      // Batasi agar tidak keluar dari arena container dashboard
      const rect = containerRef.current?.getBoundingClientRect();
      const maxX = rect ? Math.max(120, rect.width - 100) : 800;
      const maxY = rect ? Math.max(180, rect.height - 130) : 1200;

      const clampedX = Math.max(10, Math.min(maxX, newX));
      const clampedY = Math.max(40, Math.min(maxY, newY));

      // Balik arah horizontal (flip) mengikuti arah geser user
      if (Math.abs(dx) > 4) {
        setDirection(dx > 0 ? 1 : -1);
      }

      setPosition({ x: clampedX, y: clampedY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.isDragging) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const wasDragged = dragStateRef.current.hasMoved;
    dragStateRef.current.isDragging = false;
    setIsDragging(false);
    setIsDraggingMascot(false);

    if (wasDragged) {
      // 1. Cek apakah di-drop di area Container Rumah Kucing (#cat-house-dropzone)
      const dropzoneEl = document.getElementById("cat-house-dropzone");
      let droppedInHouse = false;

      if (dropzoneEl) {
        const rect = dropzoneEl.getBoundingClientRect();
        const pad = 35; // margin toleransi ramah pengguna
        if (
          e.clientX >= rect.left - pad &&
          e.clientX <= rect.right + pad &&
          e.clientY >= rect.top - pad &&
          e.clientY <= rect.bottom + pad
        ) {
          droppedInHouse = true;
        }
      }

      // Fallback deteksi jarak euclidean ke target kasur rumah
      if (!droppedInHouse) {
        const bedPos = getCatHouseBedPos();
        if (bedPos && Math.hypot(position.x - bedPos.x, position.y - bedPos.y) < 130) {
          droppedInHouse = true;
        }
      }

      // Jika berhasil di-drop ke container rumah: langsung masuk & tidur di kasur!
      if (droppedInHouse) {
        const bedPos = getCatHouseBedPos();
        if (bedPos) {
          setPosition({ x: bedPos.x, y: bedPos.y });
        }
        setIsSleeping(true);
        mascotSound.playPop();
        setSpeechText(null);
        return;
      }

      // Efek mendarat / squash saat dilepas user di tempat lain
      setIsLanded(true);
      mascotSound.playPop();
      setTimeout(() => setIsLanded(false), 450);

      // Istirahat santai di posisi baru yang dipilih user selama 8 detik sebelum lanjut patroli
      scheduleNextRoam(8000);
    } else {
      // Jika hanya diklik tanpa digeser: buka AI Financial Advisor atau bangunkan
      if (isSleeping) {
        handleWakeUp();
      } else {
        handleMascotClick();
      }
    }
  };

  const handleWakeUp = () => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    setIsSleeping(false);
  };

  const handleMascotClick = () => {
    mascotSound.playChime();
    setSpeechText(null);
    setAIDrawerOpen(true);
  };

  // Jika roaming dimatikan, atau Bang Peci sedang tidur di rumahnya (dan tidak sedang di-drag):
  // Sembunyikan roaming sprite agar Bang Peci tampak benar-benar berada di dalam rumahnya (cat-house-sleeping.png)
  if (!isRoamingActive || (isSleeping && !isDragging)) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none z-20"
      aria-hidden="true"
    >
      {/* Karakter Bang Peci RPG 2D dengan Gerak GPU translate3d yang Super Halus & Slow */}
      <div
        className="absolute will-change-transform pointer-events-auto select-none"
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          transition:
            isWalking && !isDragging
              ? `transform ${travelDuration}s cubic-bezier(0.35, 0, 0.25, 1)`
              : "none",
        }}
      >
        <MascotWalkingSprite
          financialStatus={financialStatus}
          isWalking={isWalking}
          isDragging={isDragging}
          isLanded={isLanded}
          isSleeping={isSleeping}
          direction={direction}
          speechText={speechText}
          onSpriteClick={handleMascotClick}
          onWakeUp={handleWakeUp}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
    </div>
  );
}
