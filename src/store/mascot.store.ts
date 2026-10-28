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
    description: "Ringkasan pemasukan, pengeluaran, dan sisa saldo periode ini.",
    mascotExpression: "bicara",
    speechQuote: "Saldo hijau berarti kas surplus.",
    position: "bottom",
  },
  {
    id: "quick-add",
    targetAttr: "data-tour='quick-add'",
    title: "2. Catat Transaksi",
    description: "Catat manual, lewat suara, atau foto struk belanja.",
    mascotExpression: "cuan",
    speechQuote: "Bisa ketik atau foto struk.",
    position: "bottom",
  },
  {
    id: "date-filter",
    targetAttr: "data-tour='date-filter'",
    title: "3. Filter Periode",
    description: "Filter data per bulan, tahun, atau rentang tanggal.",
    mascotExpression: "analisis",
    speechQuote: "Bisa cek data bulan lalu.",
    position: "bottom",
  },
  {
    id: "ai-studio",
    targetAttr: "data-tour='ai-studio'",
    title: "4. AI Advisor",
    description: "Tanya analisis pengeluaran, pergerakan arus kas, atau konsultasi anggaran.",
    mascotExpression: "analisis",
    speechQuote: "Tanya apa saja soal keuanganmu.",
    position: "right",
  },
  {
    id: "sidebar-nav",
    targetAttr: "data-tour='sidebar-nav'",
    title: "5. Menu Navigasi",
    description: "Akses rekening, pos anggaran, dan laporan keuangan.",
    mascotExpression: "stabil",
    speechQuote: "Semua halaman ada di bilah kiri.",
    position: "right",
  },
];

export const TECHNICAL_TOUR_STEPS: TourStep[] = [
  {
    id: "tech-sparkline",
    targetAttr: "data-tour='overview-sparkline'",
    title: "1. Tren Saldo",
    description: "Grafik saldo harian mengikuti uang masuk dan keluar.",
    mascotExpression: "tech-analisis",
    speechQuote: "Pantau arah pergerakan saldo.",
    position: "bottom",
  },
  {
    id: "tech-habits",
    targetAttr: "data-tour='overview-habit-stats'",
    title: "2. Rata-Rata Harian",
    description: "Rata-rata pengeluaran harian dan rasio tabungan yang tersisa.",
    mascotExpression: "tech-teori",
    speechQuote: "Bantu kontrol belanja harian.",
    position: "bottom",
  },
  {
    id: "tech-import",
    targetAttr: "data-tour='overview-import-hub'",
    title: "3. Impor Rekening",
    description: "Unggah file mutasi bank atau CSV untuk mencatat otomatis.",
    mascotExpression: "tech-penjelasan",
    speechQuote: "Mendukung CSV dan PDF mutasi bank.",
    position: "bottom",
  },
  {
    id: "tech-ranks",
    targetAttr: "data-tour='overview-expense-ranks'",
    title: "4. Pos Terbesar",
    description: "Kategori dengan pengeluaran paling tinggi pada periode ini.",
    mascotExpression: "tech-warning",
    speechQuote: "Cek pos yang paling banyak makan dana.",
    position: "top",
  },
  {
    id: "tech-heatmap",
    targetAttr: "data-tour='overview-heatmap'",
    title: "5. Kalender Aktivitas",
    description: "Kalender frekuensi belanja. Warna makin pekat berarti transaksi makin sering.",
    mascotExpression: "tech-acc",
    speechQuote: "Lihat hari-hari paling sering belanja.",
    position: "top",
  },
];

// Alias for backward compatibility
export const TOUR_STEPS = BASIC_TOUR_STEPS;

export const TRANSACTION_TOUR_STEPS: TourStep[] = [
  {
    id: "modal-ai-tools",
    targetAttr: "data-tour='modal-ai-tools'",
    title: "1. Asisten Input Cepat AI",
    description:
      "Catat instan tanpa repot: Dikte suara, foto/scan struk belanja dengan kamera atau galeri, atau ketik kalimat seperti 'Makan siang 35rb pake BCA'.",
    mascotExpression: "tech-penjelasan",
    speechQuote: "Bisa dikte suara atau foto struk belanja!",
    position: "bottom",
  },
  {
    id: "modal-tx-type",
    targetAttr: "data-tour='modal-tx-type'",
    title: "2. Jenis Transaksi",
    description:
      "Pilih Pengeluaran (uang keluar), Pemasukan (uang masuk), atau Transfer antar rekening kas/bank/e-wallet milikmu.",
    mascotExpression: "cuan",
    speechQuote: "Pilih uang keluar, masuk, atau transfer.",
    position: "bottom",
  },
  {
    id: "modal-amount",
    targetAttr: "data-tour='modal-amount'",
    title: "3. Nominal Transaksi",
    description:
      "Ketik nominal uang transaksi di sini. Format Rupiah otomatis dirapikan, atau klik ikon mic kecil untuk dikte angka.",
    mascotExpression: "bicara",
    speechQuote: "Ketik nominal atau sebutkan angkanya.",
    position: "bottom",
  },  {
    id: "modal-date",
    targetAttr: "data-tour='modal-date'",
    title: "4. Tanggal & Waktu Transaksi",
    description:
      "Tentukan waktu transaksi jika mencatat pengeluaran lampau. Secara default otomatis terisi waktu saat ini (NOW), atau bisa dikte suara seperti 'kemarin sore'.",
    mascotExpression: "analisis",
    speechQuote: "Bisa atur tanggal lampau atau biarkan NOW.",
    position: "bottom",
  },

  {
    id: "modal-account-category",
    targetAttr: "data-tour='modal-account-category'",
    title: "5. Akun & Kategori",
    description:
      "Tentukan rekening/e-wallet sumber dana dan pos kategori belanja agar analisis keuanganmu akurat dan rapi.",
    mascotExpression: "analisis",
    speechQuote: "Pilih dompet dan kategorinya di sini.",
    position: "top",
  },
  {
    id: "modal-submit-action",
    targetAttr: "data-tour='modal-submit-action'",
    title: "6. Simpan Transaksi",
    description:
      "Ayo coba lengkapi form transaksi ini dan klik 'Simpan Transaksi'. Begitu transaksi berhasil dibukukan, Bang Peci akan langsung mengajakmu lanjut ke tur berikutnya!",
    mascotExpression: "cuan",
    speechQuote: "Isi nominal dan klik Simpan Transaksi!",
    position: "top",
  },
];

export type ActiveTourType = "basic" | "technical" | "transaction" | null;

interface MascotState {
  isTourActive: boolean;
  activeTourType: ActiveTourType;
  currentStepIndex: number;
  resumeBasicTourAfter: boolean;
  isBubbleOpen: boolean;
  isWelcomePromptOpen: boolean;
  isContinuationPromptOpen: boolean;
  isMuted: boolean;
  hasSeenWelcome: boolean;
  hasJustAddedTourTransaction: boolean;

  // Outfit persona: 'casual' (Bang Peci Santai) | 'analyst' (Bang Peci Kacamata)
  mascotOutfit: "casual" | "analyst";
  isTransforming: boolean;

  // Roaming & AI Advisor Companion
  isRoamingActive: boolean;
  isAIDrawerOpen: boolean;

  // Actions
  startTour: (type?: "basic" | "technical" | "transaction") => void;
  startBasicTour: () => void;
  startTechnicalTour: () => void;
  startTransactionTour: (fromBasicTour?: boolean) => void;
  completeTransactionTourSuccess: () => void;
  nextStep: () => void;
  prevStep: () => void;
  endTour: () => void;
  setStepIndex: (index: number) => void;
  resumeBasicTour: () => void;

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

  // Roaming & AI Drawer Actions
  toggleRoaming: () => void;
  setRoamingActive: (active: boolean) => void;
  setAIDrawerOpen: (open: boolean) => void;
  isSleeping: boolean;
  setIsSleeping: (sleeping: boolean) => void;
  isDraggingMascot: boolean;
  setIsDraggingMascot: (dragging: boolean) => void;
}

export const useMascotStore = create<MascotState>((set, get) => ({
  isTourActive: false,
  activeTourType: null,
  currentStepIndex: 0,
  resumeBasicTourAfter: false,
  isBubbleOpen: false,
  isWelcomePromptOpen: false,
  isContinuationPromptOpen: false,
  isMuted: typeof window !== "undefined" ? mascotSound.getMuted() : false,
  hasSeenWelcome: false,
  hasJustAddedTourTransaction: false,

  mascotOutfit: "casual",
  isTransforming: false,

  // Roaming & AI Drawer Initial State
  isRoamingActive: typeof window !== "undefined" ? localStorage.getItem("finiq_mascot_roaming_active") !== "false" : true,
  isAIDrawerOpen: false,
  isSleeping: false,
  isDraggingMascot: false,

  setIsSleeping: (sleeping: boolean) => {
    set({ isSleeping: sleeping });
  },

  setIsDraggingMascot: (dragging: boolean) => {
    set({ isDraggingMascot: dragging });
  },

  toggleRoaming: () => {
    const next = !get().isRoamingActive;
    try {
      localStorage.setItem("finiq_mascot_roaming_active", String(next));
    } catch {}
    set({ isRoamingActive: next });
    mascotSound.playPop();
  },

  setRoamingActive: (active: boolean) => {
    try {
      localStorage.setItem("finiq_mascot_roaming_active", String(active));
    } catch {}
    set({ isRoamingActive: active });
  },

  setAIDrawerOpen: (open: boolean) => {
    if (open) mascotSound.playChime();
    set({ isAIDrawerOpen: open });
  },

  startTour: (type = "basic") => {
    if (type === "technical") {
      get().startTechnicalTour();
    } else if (type === "transaction") {
      get().startTransactionTour(false);
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
      resumeBasicTourAfter: false,
      isBubbleOpen: false,
      isWelcomePromptOpen: false,
      isContinuationPromptOpen: false,
      hasJustAddedTourTransaction: false,
    });
  },

  startTechnicalTour: () => {
    // Trigger magical horizontal spin flip & transform to analyst outfit!
    get().setMascotOutfit("analyst", true);

    set({
      isTourActive: true,
      activeTourType: "technical",
      currentStepIndex: 0,
      resumeBasicTourAfter: false,
      isBubbleOpen: false,
      isWelcomePromptOpen: false,
      isContinuationPromptOpen: false,
      hasJustAddedTourTransaction: false,
    });
  },

  startTransactionTour: (fromBasicTour = false) => {
    mascotSound.playChime();
    set({
      isTourActive: true,
      activeTourType: "transaction",
      currentStepIndex: 0,
      resumeBasicTourAfter: fromBasicTour,
      isBubbleOpen: false,
      isWelcomePromptOpen: false,
      isContinuationPromptOpen: false,
      hasJustAddedTourTransaction: false,
    });
  },

  completeTransactionTourSuccess: () => {
    const { resumeBasicTourAfter } = get();
    mascotSound.playChime();

    if (resumeBasicTourAfter) {
      set({
        isTourActive: true,
        activeTourType: "basic",
        currentStepIndex: 2, // Step 3 in basic tour: date-filter
        resumeBasicTourAfter: false,
        isBubbleOpen: false,
        isContinuationPromptOpen: false,
        hasJustAddedTourTransaction: true,
      });
    } else {
      set({
        isTourActive: false,
        activeTourType: null,
        currentStepIndex: 0,
        resumeBasicTourAfter: false,
        isBubbleOpen: true,
        hasJustAddedTourTransaction: true,
      });
    }
  },

  resumeBasicTour: () => {
    mascotSound.playChime();
    set({
      isTourActive: true,
      activeTourType: "basic",
      currentStepIndex: 2, // Step 3: Rentang Waktu (date-filter)
      resumeBasicTourAfter: false,
      isBubbleOpen: false,
      isContinuationPromptOpen: false,
      hasJustAddedTourTransaction: false,
    });
  },

  nextStep: () => {
    const { currentStepIndex, activeTourType, resumeBasicTourAfter } = get();
    const steps =
      activeTourType === "technical"
        ? TECHNICAL_TOUR_STEPS
        : activeTourType === "transaction"
        ? TRANSACTION_TOUR_STEPS
        : BASIC_TOUR_STEPS;

    if (currentStepIndex < steps.length - 1) {
      mascotSound.playPop();
      set({ currentStepIndex: currentStepIndex + 1, hasJustAddedTourTransaction: false });
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
          hasJustAddedTourTransaction: false,
        });
      } else if (activeTourType === "transaction") {
        if (resumeBasicTourAfter) {
          get().resumeBasicTour();
        } else {
          set({
            isTourActive: false,
            activeTourType: null,
            currentStepIndex: 0,
            isBubbleOpen: true,
            hasJustAddedTourTransaction: false,
          });
        }
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
          hasJustAddedTourTransaction: false,
        });
      }
    }
  },

  prevStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      mascotSound.playPop();
      set({ currentStepIndex: currentStepIndex - 1, hasJustAddedTourTransaction: false });
    }
  },

  endTour: () => {
    mascotSound.playPop();
    const { activeTourType, resumeBasicTourAfter } = get();
    if (activeTourType === "basic") {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("finiq_tour_completed", "true");
        } catch {}
      }
    }
    if (activeTourType === "transaction" && resumeBasicTourAfter) {
      get().resumeBasicTour();
      return;
    }
    set({
      isTourActive: false,
      activeTourType: null,
      currentStepIndex: 0,
      resumeBasicTourAfter: false,
      hasJustAddedTourTransaction: false,
    });
  },

  setStepIndex: (index: number) => {
    const { activeTourType } = get();
    const steps =
      activeTourType === "technical"
        ? TECHNICAL_TOUR_STEPS
        : activeTourType === "transaction"
        ? TRANSACTION_TOUR_STEPS
        : BASIC_TOUR_STEPS;
    mascotSound.playPop();
    set({ currentStepIndex: Math.max(0, Math.min(index, steps.length - 1)), hasJustAddedTourTransaction: false });
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
