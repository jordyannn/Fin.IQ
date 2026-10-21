import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format nominal Rupiah (IDR) standar Indonesia
 * Contoh: 3670000 -> "Rp 3.670.000"
 */
export function formatCurrency(
  amount: number,
  currency: string = "IDR",
  options?: { compact?: boolean }
): string {
  if (currency === "IDR") {
    if (options?.compact) {
      if (Math.abs(amount) >= 1_000_000_000) {
        return `Rp ${(amount / 1_000_000_000).toFixed(1)} M`;
      }
      if (Math.abs(amount) >= 1_000_000) {
        return `Rp ${(amount / 1_000_000).toFixed(1)} jt`;
      }
      if (Math.abs(amount) >= 1_000) {
        return `Rp ${(amount / 1_000).toFixed(0)} rb`;
      }
    }
    const hasFractions = amount % 1 !== 0;
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: hasFractions ? 2 : 0,
      maximumFractionDigits: hasFractions ? 2 : 0,
    }).format(amount);
  }

  const hasFractions = amount % 1 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: hasFractions ? 2 : 0,
    maximumFractionDigits: hasFractions ? 2 : 0,
  }).format(amount);
}

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

/**
 * Format tanggal standar Fin.IQ: DD/MMM/YYYY
 * Contoh: 15/OKT/2026, 01/JAN/2026
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";

  const day = String(d.getDate()).padStart(2, "0");
  const month = MONTHS_SHORT_ID[d.getMonth()] || "JAN";
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Format tanggal dan waktu standar Fin.IQ: DD/MMM/YYYY HH:mm
 * Contoh: 15/OKT/2026 14:30
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";

  const day = String(d.getDate()).padStart(2, "0");
  const month = MONTHS_SHORT_ID[d.getMonth()] || "JAN";
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Format string angka untuk ditampilkan di input field dengan pemisah ribuan (titik).
 * Contoh: "3670000" → "3.670.000", "50000" → "50.000"
 */
export function formatInputIDR(value: string): string {
  // Strip semua karakter non-digit
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return "";
  // Tambahkan pemisah ribuan (titik)
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Parse string berformat IDR kembali menjadi angka murni.
 * Contoh: "3.670.000" → 3670000, "50.000" → 50000
 */
export function parseInputIDR(formatted: string): number {
  const digits = formatted.replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}
