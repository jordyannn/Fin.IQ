import { create } from "zustand";

interface UIState {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  isQuickAddOpen: boolean;
  openQuickAdd: () => void;
  openQuickAddWithScan: () => void;
  closeQuickAdd: () => void;
  quickAddAutoScan: boolean;
  setQuickAddAutoScan: (val: boolean) => void;

  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;

  activeLedgerId: string;
  setActiveLedgerId: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),

  isQuickAddOpen: false,
  quickAddAutoScan: false,
  openQuickAdd: () => set({ isQuickAddOpen: true, quickAddAutoScan: false }),
  openQuickAddWithScan: () => set({ isQuickAddOpen: true, quickAddAutoScan: true }),
  closeQuickAdd: () => set({ isQuickAddOpen: false, quickAddAutoScan: false }),
  setQuickAddAutoScan: (val) => set({ quickAddAutoScan: val }),

  isCommandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  toggleCommandPalette: () => set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),

  activeLedgerId: "default",
  setActiveLedgerId: (id) => set({ activeLedgerId: id }),
}));
