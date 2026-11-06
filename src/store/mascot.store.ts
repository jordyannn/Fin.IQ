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
  titleEn?: string;
  description: string;
  descriptionEn?: string;
  mascotExpression: MascotExpression;
  speechQuote: string;
  speechQuoteEn?: string;
  position?: "bottom" | "top" | "left" | "right" | "center";
}

export const UNIFIED_TOUR_STEPS: TourStep[] = [
  {
    id: "overview-hero",
    targetAttr: "data-tour='overview-hero'",
    title: "1. Ringkasan Arus Kas & Saldo",
    titleEn: "1. Cash Flow & Balances",
    description: "Pantau pemasukan, pengeluaran, dan saldo kasmu secara real-time biar pembukuan selalu rapi!",
    descriptionEn: "Real-time summary of total income, expenses, and net cash balance for this period.",
    mascotExpression: "bicara",
    speechQuote: "Saldo surplus artinya arus kasmu aman terkendali!",
    speechQuoteEn: "A green balance means your finances are in surplus!",
    position: "bottom",
  },
  {
    id: "quick-add",
    targetAttr: "data-tour='quick-add'",
    title: "2. Catat Transaksi Cepat",
    titleEn: "2. Fast Transaction Entry",
    description: "Catat pengeluaran atau pemasukan sat-set: bisa diketik manual, lewat suara, atau tinggal jepret struk belanjaan!",
    descriptionEn: "Record income or expense manually, via AI voice dictation, or by scanning paper receipts.",
    mascotExpression: "cuan",
    speechQuote: "Tinggal sebut atau foto struknya, beres seketika!",
    speechQuoteEn: "You can type, dictate by voice, or snap a receipt photo.",
    position: "bottom",
  },
  {
    id: "date-filter",
    targetAttr: "data-tour='date-filter'",
    title: "3. Mesin Waktu Transaksi",
    titleEn: "3. Period Filter",
    description: "Mau intip mutasi bulan lalu, tahun ini, atau tanggal tertentu? Sekali klik langsung kebongkar!",
    descriptionEn: "Filter your bookkeeping by month, year, or select custom date ranges.",
    mascotExpression: "analisis",
    speechQuote: "Bisa intip mutasi masa lalu tanpa pusing, cuy!",
    speechQuoteEn: "Review last month's figures with just one click.",
    position: "bottom",
  },
  {
    id: "tech-sparkline",
    targetAttr: "data-tour='overview-sparkline'",
    title: "4. Pergerakan Saldo Harian",
    titleEn: "4. Daily Balance Trends",
    description: "Grafik visual gerak-gerik saldo dompetmu: keliatan jelas kapan saldo naik atau meluncur bebas!",
    descriptionEn: "Visual trajectory chart tracking your daily cash balance movement across spending and income.",
    mascotExpression: "tech-analisis",
    speechQuote: "Pantau nih saldomu lagi naik gunung apa meluncur bebas!",
    speechQuoteEn: "Monitor the trajectory and rhythm of your cash balance.",
    position: "bottom",
  },
  {
    id: "tech-habits",
    targetAttr: "data-tour='overview-habit-stats'",
    title: "5. Rata-Rata Jajan & Hobi Belanja",
    titleEn: "5. Daily Averages & Spending Habits",
    description: "Cek seberapa boros jajan harianmu dan sisa porsi tabungan biar gak boncos di tanggal tua!",
    descriptionEn: "Review your average daily expense and remaining savings ratio for strict cash control.",
    mascotExpression: "tech-teori",
    speechQuote: "Biar gak kaget saldo ludes, kontrol jajan kopimu di sini!",
    speechQuoteEn: "Helps you monitor and keep daily expenses in check.",
    position: "bottom",
  },
  {
    id: "tech-import",
    targetAttr: "data-tour='overview-import-hub'",
    title: "6. Impor Mutasi Kilat",
    titleEn: "6. Bank Statement & CSV Import",
    description: "Gak usah pegel ngetik satu-satu! Lempar file mutasi BCA, Mandiri, BRI, atau Excel ke sini, Bang Peci yang rapiin!",
    descriptionEn: "Upload bank statement PDFs or CSV files to automatically reconcile transactions without hassle.",
    mascotExpression: "tech-penjelasan",
    speechQuote: "Lempar mutasi bank ke sini, sat-set langsung rapi!",
    speechQuoteEn: "Supports bank statement CSVs, Excel, and PDFs.",
    position: "bottom",
  },
  {
    id: "tech-ranks",
    targetAttr: "data-tour='overview-expense-ranks'",
    title: "7. Pos Paling Rakus Nelen Saldo",
    titleEn: "7. Top Expense Categories",
    description: "Pos kategori belanja yang paling rakus nelen duitmu periode ini, waspada jangan sampe kecolongan!",
    descriptionEn: "Categories with the highest accumulated spend this period so you stay vigilant.",
    mascotExpression: "tech-warning",
    speechQuote: "Awas! Liat nih pos mana yang paling rakus ngabisin saldo!",
    speechQuoteEn: "Check which categories consume the most funds.",
    position: "top",
  },
  {
    id: "tech-heatmap",
    targetAttr: "data-tour='overview-heatmap'",
    title: "8. Kalender Tanggal Rawan Boros",
    titleEn: "8. Spending Activity Calendar",
    description: "Peta frekuensi belanja harian. Kotak makin pekat warnanya artinya hari itu kamu lagi kalap belanja, anjay!",
    descriptionEn: "Transaction frequency calendar. Darker colors highlight days with the most spending activity.",
    mascotExpression: "tech-acc",
    speechQuote: "Warna pekat tandanya hari itu dompetmu lagi terkuras abis!",
    speechQuoteEn: "See patterns of your most active spending days.",
    position: "top",
  },
  {
    id: "ai-studio",
    targetAttr: "data-tour='ai-studio'",
    title: "9. Bang Peci AI Advisor",
    titleEn: "9. AI Financial Advisor",
    description: "Lagi galau soal duit? Tanya Bang Peci! Mau minta audit pos boncos atau strategi nabung, dijawab jujur to-the-point!",
    descriptionEn: "Consult financial queries, request overspending audits, or ask for smart budget advice.",
    mascotExpression: "analisis",
    speechQuote: "Tanya Bang Peci apa aja soal duit, no jaim no halu!",
    speechQuoteEn: "Ask anything about your personal financial health.",
    position: "right",
  },
  {
    id: "sidebar-nav",
    targetAttr: "data-tour='sidebar-nav'",
    title: "10. Jurus Lengkap Fin.IQ",
    titleEn: "10. Full Navigation Menu",
    description: "Semua senjata rahasia Fin.IQ ngumpul di sidebar ini: Pos Anggaran, Brankas Rekening, Buku Kas, sampe Rapor Tahunan!",
    descriptionEn: "Access all modules: Budgets, Bank Accounts & Wallets, Categories, and Comprehensive Financial Reports.",
    mascotExpression: "stabil",
    speechQuote: "Semua jurus sakti Fin.IQ udah siap kamu jajal di sini!",
    speechQuoteEn: "All core financial tools are housed right in this sidebar.",
    position: "right",
  },
];

export const BASIC_TOUR_STEPS: TourStep[] = UNIFIED_TOUR_STEPS;
export const TECHNICAL_TOUR_STEPS: TourStep[] = UNIFIED_TOUR_STEPS;
export const TOUR_STEPS = UNIFIED_TOUR_STEPS;

export const TRANSACTION_TOUR_STEPS: TourStep[] = [
  {
    id: "modal-ai-tools",
    targetAttr: "data-tour='modal-ai-tools'",
    title: "1. Asisten Input Kilat AI",
    titleEn: "1. AI Quick Assistant",
    description:
      "Mager ngetik? Dikte suara aja, jepret foto struk Indomaret/resto, atau ketik santai kayak 'Kopi susu 25rb pake GoPay'!",
    descriptionEn:
      "Record instantly: voice dictation, camera or gallery receipt scan, or type natural prompts like 'Lunch 35k with BCA'.",
    mascotExpression: "tech-penjelasan",
    speechQuote: "Bisa dikte suara atau jepret struk, sat-set banget!",
    speechQuoteEn: "You can speak or take photos of receipts!",
    position: "bottom",
  },
  {
    id: "modal-tx-type",
    targetAttr: "data-tour='modal-tx-type'",
    title: "2. Jenis Transaksi",
    titleEn: "2. Transaction Type",
    description:
      "Pilih jenis transaksi: Pengeluaran, Pemasukan, atau Pindah Dana antar-rekening milikmu.",
    descriptionEn:
      "Select Expense (money out), Income (money in), or Transfer between your cash, bank, or e-wallet accounts.",
    mascotExpression: "cuan",
    speechQuote: "Tentukan apakah ini transaksi Pengeluaran, Pemasukan, atau Pindah Dana!",
    speechQuoteEn: "Choose expense, income, or transfer.",
    position: "bottom",
  },
  {
    id: "modal-amount",
    targetAttr: "data-tour='modal-amount'",
    title: "3. Nominal Transaksi",
    titleEn: "3. Transaction Amount",
    description:
      "Masukkan nominal transaksi. Format Rupiah otomatis tertata rapi, atau sebutkan angkanya lewat suara!",
    descriptionEn:
      "Enter the transaction amount here. Currency formats dynamically, or tap the mic icon to dictate numbers.",
    mascotExpression: "bicara",
    speechQuote: "Ketik nominal transaksi atau sebutkan aja, Bang Peci dengerin kok!",
    speechQuoteEn: "Type the amount or dictate the numbers.",
    position: "bottom",
  },
  {
    id: "modal-date",
    targetAttr: "data-tour='modal-date'",
    title: "4. Tanggal Transaksi",
    titleEn: "4. Transaction Date & Time",
    description:
      "Pilih tanggal transaksi jika mencatat pengeluaran kemarin. Jika baru saja belanja, biarkan di waktu sekarang (NOW)!",
    descriptionEn:
      "Set the date if recording past expenses. Defaults to current time (NOW), or dictate like 'yesterday afternoon'.",
    mascotExpression: "analisis",
    speechQuote: "Bisa catat transaksi kemarin atau langsung gas sekarang!",
    speechQuoteEn: "Pick a custom date or keep it set to NOW.",
    position: "bottom",
  },
  {
    id: "modal-account-category",
    targetAttr: "data-tour='modal-account-category'",
    title: "5. Akun & Kategori",
    titleEn: "5. Account & Category",
    description:
      "Pilih akun sumber dana dan kategori transaksi biar catatan keuanganmu rapi dan presisi!",
    descriptionEn:
      "Choose the funding source account and spending category for clean and precise financial analytics.",
    mascotExpression: "analisis",
    speechQuote: "Pilih akun dan kategori biar catatan keuanganmu tepat sasaran!",
    speechQuoteEn: "Pick the source wallet and category here.",
    position: "top",
  },
  {
    id: "modal-submit-action",
    targetAttr: "data-tour='modal-submit-action'",
    title: "6. Simpan Transaksi",
    titleEn: "6. Save Transaction",
    description:
      "Klik tombol 'Simpan Transaksi'. Begitu transaksimu sukses tercatat, Bang Peci akan memandu langkahmu selanjutnya!",
    descriptionEn:
      "Complete this transaction form and click 'Save Transaction'. Once saved, Bang Peci will immediately guide you forward!",
    mascotExpression: "cuan",
    speechQuote: "Klik Simpan Transaksi biar catatan keuanganmu langsung tersimpan rapi!",
    speechQuoteEn: "Enter an amount and click Save Transaction!",
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
  isMiddleCheckpointOpen: boolean;
  hasPassedMiddleCheckpoint: boolean;
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
  openMiddleCheckpoint: () => void;
  closeMiddleCheckpoint: () => void;
  continueFromMiddleCheckpoint: () => void;
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
  isMiddleCheckpointOpen: false,
  hasPassedMiddleCheckpoint: false,
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
      hasPassedMiddleCheckpoint: false,
      resumeBasicTourAfter: false,
      isBubbleOpen: false,
      isWelcomePromptOpen: false,
      isMiddleCheckpointOpen: false,
      isContinuationPromptOpen: false,
      hasJustAddedTourTransaction: false,
    });
  },

  startTechnicalTour: () => {
    // Switch to analyst outfit and start at step 5 (advanced features)
    get().setMascotOutfit("analyst", true);

    set({
      isTourActive: true,
      activeTourType: "basic",
      currentStepIndex: 4,
      hasPassedMiddleCheckpoint: true,
      resumeBasicTourAfter: false,
      isBubbleOpen: false,
      isWelcomePromptOpen: false,
      isMiddleCheckpointOpen: false,
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
      isMiddleCheckpointOpen: false,
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
        currentStepIndex: 2, // Step 3 in unified tour: date-filter
        resumeBasicTourAfter: false,
        isBubbleOpen: false,
        isMiddleCheckpointOpen: false,
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
      currentStepIndex: 2, // Step 3: date-filter
      resumeBasicTourAfter: false,
      isBubbleOpen: false,
      isMiddleCheckpointOpen: false,
      isContinuationPromptOpen: false,
      hasJustAddedTourTransaction: false,
    });
  },

  nextStep: () => {
    const { currentStepIndex, activeTourType, resumeBasicTourAfter, hasPassedMiddleCheckpoint } = get();
    const steps =
      activeTourType === "transaction"
        ? TRANSACTION_TOUR_STEPS
        : UNIFIED_TOUR_STEPS;

    // Middle activity checkpoint: after Step 4 (index 3: Tren Saldo Harian)
    if (activeTourType === "basic" && currentStepIndex === 3 && !hasPassedMiddleCheckpoint) {
      mascotSound.playBloop();
      set({
        isMiddleCheckpointOpen: true,
        isContinuationPromptOpen: true,
      });
      return;
    }

    if (currentStepIndex < steps.length - 1) {
      mascotSound.playPop();
      set({ currentStepIndex: currentStepIndex + 1, hasJustAddedTourTransaction: false });
    } else {
      // Completed current tour!
      mascotSound.playChime();

      if (activeTourType === "transaction") {
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
        // Unified tour completed!
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("finiq_tour_completed", "true");
            localStorage.setItem("finiq_tech_tour_completed", "true");
          } catch {}
        }
        set({
          isTourActive: false,
          currentStepIndex: 0,
          isBubbleOpen: true,
          isMiddleCheckpointOpen: false,
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
      hasPassedMiddleCheckpoint: false,
      resumeBasicTourAfter: false,
      isMiddleCheckpointOpen: false,
      isContinuationPromptOpen: false,
      hasJustAddedTourTransaction: false,
    });
  },

  setStepIndex: (index: number) => {
    const { activeTourType } = get();
    const steps =
      activeTourType === "transaction"
        ? TRANSACTION_TOUR_STEPS
        : UNIFIED_TOUR_STEPS;
    mascotSound.playPop();
    const targetIdx = Math.max(0, Math.min(index, steps.length - 1));
    set({
      currentStepIndex: targetIdx,
      hasPassedMiddleCheckpoint: targetIdx >= 4 ? true : get().hasPassedMiddleCheckpoint,
      hasJustAddedTourTransaction: false,
    });
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
    set({ isContinuationPromptOpen: true, isMiddleCheckpointOpen: true, isBubbleOpen: false });
  },

  closeContinuationPrompt: () => {
    set({ isContinuationPromptOpen: false, isMiddleCheckpointOpen: false });
  },

  openMiddleCheckpoint: () => {
    mascotSound.playBloop();
    set({ isMiddleCheckpointOpen: true, isContinuationPromptOpen: true, isBubbleOpen: false });
  },

  closeMiddleCheckpoint: () => {
    set({ isMiddleCheckpointOpen: false, isContinuationPromptOpen: false });
  },

  continueFromMiddleCheckpoint: () => {
    mascotSound.playChime();
    set({
      isMiddleCheckpointOpen: false,
      isContinuationPromptOpen: false,
      hasPassedMiddleCheckpoint: true,
      currentStepIndex: 4, // moves to Step 5: tech-habits
      isTourActive: true,
      isBubbleOpen: false,
    });
  },

  chooseNgulikSendiri: () => {
    mascotSound.playPop();
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("finiq_tour_completed", "true");
        localStorage.setItem("finiq_tour_choice", "ngulik_sendiri");
      } catch {}
    }
    set({
      isTourActive: false,
      isMiddleCheckpointOpen: false,
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
