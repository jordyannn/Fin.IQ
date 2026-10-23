import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SupportedLocale } from "@/i18n/types";

interface I18nState {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  toggleLocale: () => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      locale: "id",
      setLocale: (locale) => set({ locale }),
      toggleLocale: () =>
        set((state) => ({
          locale: state.locale === "id" ? "en" : "id",
        })),
    }),
    {
      name: "finiq_locale",
    }
  )
);
