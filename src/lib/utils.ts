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
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);
}

/**
 * Format tanggal standar Indonesia
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format(d);
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
