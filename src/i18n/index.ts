"use client";

import { useI18nStore } from "@/store/i18n.store";
import { SupportedLocale, TranslationDictionary } from "./types";
import { id } from "./dictionaries/id";
import { en } from "./dictionaries/en";

const dictionaries: Record<SupportedLocale, TranslationDictionary> = {
  id,
  en,
};

export const MONTHS_SHORT_ID = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MEI",
  "JUN",
  "JUL",
  "AGU",
  "SEP",
  "OKT",
  "NOV",
  "DES",
] as const;

export const MONTHS_SHORT_EN = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

export function getDictionary(locale: SupportedLocale): TranslationDictionary {
  return dictionaries[locale] || dictionaries.id;
}

/**
 * Format nominal mata uang berbasis locale aktif
 * ID: Rp 1.000.000
 * EN: IDR 1,000,000 (atau $1,000,000 jika USD)
 */
export function formatLocalizedCurrency(
  amount: number,
  currency: string = "IDR",
  locale: SupportedLocale = "id",
  options?: { compact?: boolean }
): string {
  const isEn = locale === "en";

  if (currency === "IDR") {
    if (options?.compact) {
      if (Math.abs(amount) >= 1_000_000_000) {
        return isEn
          ? `IDR ${(amount / 1_000_000_000).toFixed(1)}B`
          : `Rp ${(amount / 1_000_000_000).toFixed(1)} M`;
      }
      if (Math.abs(amount) >= 1_000_000) {
        return isEn
          ? `IDR ${(amount / 1_000_000).toFixed(1)}M`
          : `Rp ${(amount / 1_000_000).toFixed(1)} jt`;
      }
      if (Math.abs(amount) >= 1_000) {
        return isEn
          ? `IDR ${(amount / 1_000).toFixed(0)}K`
          : `Rp ${(amount / 1_000).toFixed(0)} rb`;
      }
    }

    const hasFractions = amount % 1 !== 0;
    if (isEn) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "IDR",
        currencyDisplay: "code",
        minimumFractionDigits: hasFractions ? 2 : 0,
        maximumFractionDigits: hasFractions ? 2 : 0,
      }).format(amount);
    }

    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: hasFractions ? 2 : 0,
      maximumFractionDigits: hasFractions ? 2 : 0,
    }).format(amount);
  }

  // Non-IDR currencies (USD, SGD, etc.)
  const hasFractions = amount % 1 !== 0;
  return new Intl.NumberFormat(isEn ? "en-US" : "id-ID", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: hasFractions ? 2 : 0,
    maximumFractionDigits: hasFractions ? 2 : 0,
  }).format(amount);
}

/**
 * Format tanggal standar Fin.IQ: DD/MMM/YYYY
 * ID: 15/OKT/2026
 * EN: 15/OCT/2026
 */
export function formatLocalizedDate(
  date: string | Date | null | undefined,
  locale: SupportedLocale = "id"
): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";

  const day = String(d.getDate()).padStart(2, "0");
  const monthMap = locale === "en" ? MONTHS_SHORT_EN : MONTHS_SHORT_ID;
  const month = monthMap[d.getMonth()] || "JAN";
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Format tanggal dan waktu: DD/MMM/YYYY HH:mm
 */
export function formatLocalizedDateTime(
  date: string | Date | null | undefined,
  locale: SupportedLocale = "id"
): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";

  const day = String(d.getDate()).padStart(2, "0");
  const monthMap = locale === "en" ? MONTHS_SHORT_EN : MONTHS_SHORT_ID;
  const month = monthMap[d.getMonth()] || "JAN";
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Hook utama aplikasi untuk mengakses kamus i18n reaktif
 */
export function useTranslation() {
  const { locale, setLocale, toggleLocale } = useI18nStore();
  const t = getDictionary(locale);

  return {
    locale,
    setLocale,
    toggleLocale,
    t,
    formatCurrency: (amount: number, currency = "IDR", options?: { compact?: boolean }) =>
      formatLocalizedCurrency(amount, currency, locale, options),
    formatDate: (date: string | Date | null | undefined) =>
      formatLocalizedDate(date, locale),
    formatDateTime: (date: string | Date | null | undefined) =>
      formatLocalizedDateTime(date, locale),
  };
}

export * from "./types";
