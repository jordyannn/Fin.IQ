/* Hallmark · store: mascot.store · theme: Bibit-Fintech · genre: modern-minimal */
import { create } from "zustand";
import { mascotSound } from "@/lib/mascot-sound";

export type MascotExpression =
  | "halo"
  | "bicara"
  | "cuan"
  | "analisis"
  | "stabil"
  | "hemat"
  | "boncos"
  | "sedih"
  | "bingung"
  | "tech-halo"
  | "tech-penjelasan"
  | "tech-analisis"
  | "tech-warning"
  | "tech-teori"
  | "tech-berpikir"
  | "tech-solusi"
  | "tech-acc"
  | "tech-rumit";

export interface TourStep {
  id: string;
  targetAttr: string;
  title: string;
  description: string;
  mascotExpression: MascotExpression;
  speechQuote: string;
  position?: "bottom" | "top" | "left" | "right" | "center";
}

export const BASIC_TOUR_STEPS: TourStep[] = [
  {
    id: "overview-hero",
    targetAttr: "data-tour='overview-hero'",
    title: "1. Monitor Arus Kas Bersih",
    description:
      "Di sini kamu bisa memantau apakah keuanganmu sedang surplus (cuan) atau defisit. Ekspresi saya akan langsung mencerminkan kondisi arus kasmu!",
    mascotExpression: "bicara",
    speechQuote: "Ini barometer kesehatan dompetmu, bos!",
    position: "bottom",
  },
  {
    id: "quick-add",
    targetAttr: "data-tour='quick-add'",
    title: "2. Catat Transaksi Super Kilat",
    description:
      "Klik tombol 'Tambah Transaksi' di sidebar untuk mencatat manual, atau gunakan fitur Scan Struk Nota bertenaga AI tanpa perlu repot mengetik.",
    mascotExpression: "cuan",
    speechQuote: "Ada nota belanja? Tinggal foto langsung beres!",
    position: "right",
  },
  {
    id: "date-filter",
    targetAttr: "data-tour='date-filter'",
    title: "3. Atur Rentang Waktu & Periode",
    description:
      "Pilih 'Bulan Ini', 'Tahun Ini', atau tanggal kustom untuk melihat analisis pengeluaran dalam rentang waktu yang kamu inginkan.",
    mascotExpression: "analisis",
    speechQuote: "Bisa intip keuangan bulan lalu juga loh!",
    position: "bottom",
  },
  {
    id: "ai-studio",
    targetAttr: "data-tour='ai-studio'",
    title: "4. Fin.IQ AI Studio Pintar",
    description:
      "Pusat kecerdasan finansial Fin.IQ! Klik menu 'Fin.IQ AI' di sidebar untuk konsultasi kesehatan kasmu, simulasi anggaran, atau analisis tren gaya hidup.",
    mascotExpression: "analisis",
    speechQuote: "Konsultasi finansial gratis 24 jam bersama AI!",
    position: "right",
  },
  {
    id: "sidebar-nav",
    targetAttr: "data-tour='sidebar-nav'",
    title: "5. Eksplorasi Menu Lengkap",
    description:
      "Kelola rekening bank & e-wallet di 'Akun Keuangan', buat batas pos belanja di 'Anggaran', dan cek grafik visual di 'Analisis'.",
    mascotExpression: "stabil",
    speechQuote: "Semua pos keuanganmu rapi teratur di sini!",
    position: "right",
  },
];

export const TECHNICAL_TOUR_STEPS: TourStep[] = [
  {
    id: "tech-intro",
    targetAttr: "data-tour='overview-hero'",
    title: "1. Mode Analis & Bedah Teknis",
    description:
      "Selamat datang di modul teknis Fin.IQ! Di sesi ini, saya (Bang Peci Mode Analis) akan membedah cara membaca grafik, rumus kas, hingga trik budgeting profesional.",
    mascotExpression: "tech-halo",
    speechQuote: "Kacamata terpasang, mari kita bedah datanya secara presisi!",
    position: "bottom",
  },
  {
    id: "tech-cashflow",
    targetAttr: "data-tour='overview-hero'",
    title: "2. Bedah Rumus Arus Kas & Saldo",
    description:
      "Perhatikan kartu Arus Kas Bersih: Pemasukan dikurangi Pengeluaran sama dengan Arus Kas Bersih (Surplus/Defisit). Ini rumus emas kesehatan finansialmu!",
    mascotExpression: "tech-teori",
    speechQuote: "Pemasukan - Pengeluaran = Surplus! Jangan sampai defisit ya!",
    position: "bottom",
  },
  {
    id: "tech-quickadd",
    targetAttr: "data-tour='quick-add'",
    title: "3. Input Transaksi & Scan Struk AI",
    description:
      "Pencatatan yang disiplin adalah kunci. Klik tombol 'Tambah Transaksi' di sidebar: pilih kas Pemasukan/Pengeluaran/Transfer, kategori pos belanja, atau scan OCR nota otomatis.",
    mascotExpression: "tech-penjelasan",
    speechQuote: "Catat setiap pengeluaran sekecil apapun biar data selalu akurat!",
    position: "right",
  },
  {
    id: "tech-sparkline",
    targetAttr: "data-tour='overview-sparkline'",
    title: "4. Cara Baca Kurva Kas & Sparkline",
    description:
      "Grafik area di kanan menunjukkan akumulasi kas harian. Garis yang menanjak hijau menandakan surplus bertambah, sedangkan turunan merah menandakan belanja besar.",
    mascotExpression: "tech-analisis",
    speechQuote: "Perhatikan tanjakan dan turunannya untuk membaca ritme uangmu!",
    position: "bottom",
  },
  {
    id: "tech-ranks",
    targetAttr: "data-tour='overview-expense-ranks'",
    title: "5. Analisis Peringkat Pos Boros",
    description:
      "Pantau 3 kategori teratas dengan persentase pengeluaran terbesar. Jika pos hiburan atau jajan mendominasi, saatnya melakukan rem anggaran!",
    mascotExpression: "tech-warning",
    speechQuote: "Pos teratas adalah tersangka utama kebocoran saldo dompet!",
    position: "top",
  },
  {
    id: "tech-heatmap",
    targetAttr: "data-tour='overview-heatmap'",
    title: "6. Konsistensi Kalender & Rekomendasi ACC",
    description:
      "Heatmap tahunan mencatat intensitas belanja tiap tanggal. Jaga ritme hematmu agar status anggaran selalu 'APPROVED AMAN' dan siap investasi!",
    mascotExpression: "tech-acc",
    speechQuote: "Disiplin terus biar rapor keuanganmu dapat cap APPROVED AMAN!",
    position: "top",
  },
];

// Alias for backward compatibility
export const TOUR_STEPS = BASIC_TOUR_STEPS;

interface MascotState {
  isTourActive: boolean;
  activeTourType: "basic" | "technical" | null;
  currentStepIndex: number;
  isBubbleOpen: boolean;
  isWelcomePromptOpen: boolean;
  isContinuationPromptOpen: boolean;
  isMuted: boolean;
  hasSeenWelcome: boolean;

  // Outfit persona: 'casual' (Bang Peci Santai) | 'analyst' (Bang Peci Kacamata)
  mascotOutfit: "casual" | "analyst";
  isTransforming: boolean;

  // Actions
  startTour: (type?: "basic" | "technical") => void;
  startBasicTour: () => void;
  startTechnicalTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  endTour: () => void;
  setStepIndex: (index: number) => void;

  toggleBubble: () => void;
  setBubbleOpen: (open: boolean) => void;
  setWelcomePromptOpen: (open: boolean) => void;
  openContinuationPrompt: () => void;
  closeContinuationPrompt: () => void;
  chooseNgulikSendiri: () => void;

  toggleMute: () => void;
  markWelcomeAsSeen: () => void;
  setMascotOutfit: (outfit: "casual" | "analyst", animate?: boolean) => void;
  toggleOutfit: (animate?: boolean) => void;
}

export const useMascotStore = create<MascotState>((set, get) => ({
  isTourActive: false,
  activeTourType: null,
  currentStepIndex: 0,
  isBubbleOpen: false,
  isWelcomePromptOpen: false,
  isContinuationPromptOpen: false,
  isMuted: typeof window !== "undefined" ? mascotSound.getMuted() : false,
  hasSeenWelcome: false,

  mascotOutfit: "casual",
  isTransforming: false,

  startTour: (type = "basic") => {
    if (type === "technical") {
      get().startTechnicalTour();
    } else {
      get().startBasicTour();
    }
  },

  startBasicTour: () => {
    mascotSound.playChime();
    set({
      isTourActive: true,
      activeTourType: "basic",
      currentStepIndex: 0,
      isBubbleOpen: false,
      isWelcomePromptOpen: false,
      isContinuationPromptOpen: false,
    });
  },

  startTechnicalTour: () => {
    // Trigger magical horizontal spin flip & transform to analyst outfit!
    get().setMascotOutfit("analyst", true);

    set({
      isTourActive: true,
      activeTourType: "technical",
      currentStepIndex: 0,
      isBubbleOpen: false,
      isWelcomePromptOpen: false,
      isContinuationPromptOpen: false,
    });
  },

  nextStep: () => {
    const { currentStepIndex, activeTourType } = get();
    const steps = activeTourType === "technical" ? TECHNICAL_TOUR_STEPS : BASIC_TOUR_STEPS;

    if (currentStepIndex < steps.length - 1) {
      mascotSound.playPop();
      set({ currentStepIndex: currentStepIndex + 1 });
    } else {
      // Completed current tour!
      mascotSound.playChime();

      if (activeTourType === "basic") {
        // When basic tour finishes, prompt the user: Continue to technical tour or explore on own?
        set({
          isTourActive: false,
          currentStepIndex: 0,
          isContinuationPromptOpen: true,
          isBubbleOpen: false,
        });
      } else {
        // Technical tour completed!
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("finiq_tech_tour_completed", "true");
          } catch {}
        }
        set({
          isTourActive: false,
          currentStepIndex: 0,
          isBubbleOpen: true,
          isContinuationPromptOpen: false,
        });
      }
    }
  },

  prevStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      mascotSound.playPop();
      set({ currentStepIndex: currentStepIndex - 1 });
    }
  },

  endTour: () => {
    mascotSound.playPop();
    const { activeTourType } = get();
    if (activeTourType === "basic") {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("finiq_tour_completed", "true");
        } catch {}
      }
    }
    set({
      isTourActive: false,
      activeTourType: null,
      currentStepIndex: 0,
    });
  },

  setStepIndex: (index: number) => {
    const { activeTourType } = get();
    const steps = activeTourType === "technical" ? TECHNICAL_TOUR_STEPS : BASIC_TOUR_STEPS;
    mascotSound.playPop();
    set({ currentStepIndex: Math.max(0, Math.min(index, steps.length - 1)) });
  },

  toggleBubble: () => {
    const next = !get().isBubbleOpen;
    mascotSound.playPop();
    set({ isBubbleOpen: next });
  },

  setBubbleOpen: (open: boolean) => {
    set({ isBubbleOpen: open });
  },

  setWelcomePromptOpen: (open: boolean) => {
    if (open) mascotSound.playBloop();
    set({ isWelcomePromptOpen: open });
  },

  openContinuationPrompt: () => {
    mascotSound.playBloop();
    set({ isContinuationPromptOpen: true, isBubbleOpen: false });
  },

  closeContinuationPrompt: () => {
    set({ isContinuationPromptOpen: false });
  },

  chooseNgulikSendiri: () => {
    mascotSound.playPop();
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("finiq_tour_choice", "ngulik_sendiri");
      } catch {}
    }
    set({
      isContinuationPromptOpen: false,
      isBubbleOpen: true,
    });
  },

  toggleMute: () => {
    const newMuted = mascotSound.toggleMute();
    set({ isMuted: newMuted });
  },

  markWelcomeAsSeen: () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("finiq_tour_welcomed", "true");
      } catch {}
    }
    set({ hasSeenWelcome: true, isWelcomePromptOpen: false });
  },

  setMascotOutfit: (outfit: "casual" | "analyst", animate = false) => {
    if (animate) {
      mascotSound.playTransform();
      set({ isTransforming: true });
      // Switch outfit midway during spin (at 380ms)
      setTimeout(() => {
        set({ mascotOutfit: outfit });
      }, 380);
      // Finish spin animation (at 850ms)
      setTimeout(() => {
        set({ isTransforming: false });
      }, 850);
    } else {
      set({ mascotOutfit: outfit });
    }
  },

  toggleOutfit: (animate = true) => {
    const current = get().mascotOutfit;
    const next = current === "casual" ? "analyst" : "casual";
    get().setMascotOutfit(next, animate);
  },
}));
