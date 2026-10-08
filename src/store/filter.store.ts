import { create } from "zustand";

interface FilterState {
  search: string;
  setSearch: (search: string) => void;
  txType: "all" | "expense" | "income" | "transfer";
  setTxType: (type: "all" | "expense" | "income" | "transfer") => void;
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;
  selectedCategoryId: string | null;
  setSelectedCategoryId: (id: string | null) => void;
  dateFrom: string | null;
  setDateFrom: (d: string | null) => void;
  dateTo: string | null;
  setDateTo: (d: string | null) => void;
  resetFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  search: "",
  setSearch: (search) => set({ search }),
  txType: "all",
  setTxType: (txType) => set({ txType }),
  selectedAccountId: null,
  setSelectedAccountId: (selectedAccountId) => set({ selectedAccountId }),
  selectedCategoryId: null,
  setSelectedCategoryId: (selectedCategoryId) => set({ selectedCategoryId }),
  dateFrom: null,
  setDateFrom: (dateFrom) => set({ dateFrom }),
  dateTo: null,
  setDateTo: (dateTo) => set({ dateTo }),
  resetFilters: () =>
    set({
      search: "",
      txType: "all",
      selectedAccountId: null,
      selectedCategoryId: null,
      dateFrom: null,
      dateTo: null,
    }),
}));
