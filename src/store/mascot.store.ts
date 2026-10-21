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
    title: "1. Arus Kas",
    description:
      "Lihat total pemasukan, pengeluaran, dan saldo bersihmu periode ini.",
    mascotExpression: "bicara",
    speechQuote: "Angka hijau artinya kasmu surplus.",
    position: "bottom",
  },
  {
    id: "quick-add",
    targetAttr: "data-tour='quick-add'",
    title: "2. Catat Transaksi",
    description:
      "Tambah transaksi baru manual atau scan foto struk belanja.",
    mascotExpression: "cuan",
    speechQuote: "Bisa ketik nominal atau foto struk.",
    position: "bottom",
  },
  {
    id: "date-filter",
    targetAttr: "data-tour='date-filter'",
    title: "3. Rentang Waktu",
    description:
      "Pilih tampilan data bulan ini, tahun ini, atau tanggal tertentu.",
    mascotExpression: "analisis",
    speechQuote: "Bisa cek data bulan lalu juga.",
    position: "bottom",
  },
  {
    id: "ai-studio",
    targetAttr: "data-tour='ai-studio'",
    title: "4. Fin.IQ AI",
    description:
      "Tanya ringkasan keuangan, saran penghematan, atau cek pola belanja.",
    mascotExpression: "analisis",
    speechQuote: "Ketik pertanyaanmu di sini.",
    position: "right",
  },
  {
    id: "sidebar-nav",
    targetAttr: "data-tour='sidebar-nav'",
    title: "5. Menu Aplikasi",
    description:
      "Akses akun rekening, pos anggaran, dan laporan keuangan lengkap.",
    mascotExpression: "stabil",
    speechQuote: "Semua menu ada di bilah kiri ini.",
    position: "right",
  },
];

export const TECHNICAL_TOUR_STEPS: TourStep[] = [
  {
    id: "tech-sparkline",
    targetAttr: "data-tour='overview-sparkline'",
    title: "1. Tren Saldo",
    description:
      "Grafik perubahan saldo harian: garis naik saat ada pemasukan, dan turun saat ada belanja.",
    mascotExpression: "tech-analisis",
    speechQuote: "Melihat ritme keluar-masuk kas.",
    position: "bottom",
  },
  {
    id: "tech-habits",
    targetAttr: "data-tour='overview-habit-stats'",
    title: "2. Rata-rata Harian",
    description:
      "Rata-rata belanja per hari, frekuensi transaksi, dan persentase uang yang tersisa.",
    mascotExpression: "tech-teori",
    speechQuote: "Pantau rata-rata belanjamu tiap hari.",
    position: "bottom",
  },
  {
    id: "tech-import",
    targetAttr: "data-tour='overview-import-hub'",
    title: "3. Impor Berkas & CSV",
    description:
      "Unggah mutasi rekening bank atau file spreadsheet untuk mencatat banyak transaksi sekaligus.",
    mascotExpression: "tech-penjelasan",
    speechQuote: "Tinggal upload berkas rekening atau CSV.",
    position: "bottom",
  },
  {
    id: "tech-ranks",
    targetAttr: "data-tour='overview-expense-ranks'",
    title: "4. Kategori Terbesar",
    description:
      "Daftar pos belanja dengan total pengeluaran paling tinggi di periode ini.",
    mascotExpression: "tech-warning",
    speechQuote: "Cek kategori yang paling banyak makan biaya.",
    position: "top",
  },
  {
    id: "tech-heatmap",
    targetAttr: "data-tour='overview-heatmap'",
    title: "5. Kalender Aktivitas",
    description:
      "Intensitas transaksi per tanggal sepanjang tahun. Warna lebih pekat menandakan transaksi lebih banyak.",
    mascotExpression: "tech-acc",
    speechQuote: "Petakan tanggal belanja aktifmu.",
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
