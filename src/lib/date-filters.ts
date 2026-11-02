export type DateFilterPreset =
  | "this_month"
  | "today"
  | "last_7_days"
  | "last_30_days"
  | "last_month"
  | "this_year"
  | "all"
  | "custom";

export interface DateFilterResult {
  dateFrom?: string;
  dateTo?: string;
  periodLabel: string;
}

export function computeDateRange(
  preset: DateFilterPreset,
  currentMonth: Date = new Date(),
  customFrom?: string,
  customTo?: string,
  locale: "id" | "en" = "id"
): DateFilterResult {
  const now = new Date();
  const isEn = locale === "en";
  const intlLocale = isEn ? "en-US" : "id-ID";

  if (preset === "all") {
    return {
      dateFrom: undefined,
      dateTo: undefined,
      periodLabel: isEn ? "All Time" : "Semua Waktu",
    };
  }

  if (preset === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return {
      dateFrom: start.toISOString(),
      dateTo: end.toISOString(),
      periodLabel: isEn ? "Today" : "Hari Ini",
    };
  }

  if (preset === "last_7_days") {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return {
      dateFrom: start.toISOString(),
      dateTo: end.toISOString(),
      periodLabel: isEn ? "Last 7 Days" : "7 Hari Terakhir",
    };
  }

  if (preset === "last_30_days") {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return {
      dateFrom: start.toISOString(),
      dateTo: end.toISOString(),
      periodLabel: isEn ? "Last 30 Days" : "30 Hari Terakhir",
    };
  }

  if (preset === "this_month") {
    const yr = currentMonth.getFullYear();
    const mo = currentMonth.getMonth();
    const start = new Date(yr, mo, 1, 0, 0, 0);
    const end = new Date(yr, mo + 1, 0, 23, 59, 59, 999);
    const label = new Intl.DateTimeFormat(intlLocale, { month: "long", year: "numeric" }).format(currentMonth);
    return {
      dateFrom: start.toISOString(),
      dateTo: end.toISOString(),
      periodLabel: label,
    };
  }

  if (preset === "last_month") {
    const yr = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const mo = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const start = new Date(yr, mo, 1, 0, 0, 0);
    const end = new Date(yr, mo + 1, 0, 23, 59, 59, 999);
    const label = new Intl.DateTimeFormat(intlLocale, { month: "long", year: "numeric" }).format(start);
    return {
      dateFrom: start.toISOString(),
      dateTo: end.toISOString(),
      periodLabel: isEn ? `Last Month (${label})` : `Bulan Lalu (${label})`,
    };
  }

  if (preset === "this_year") {
    const yr = currentMonth.getFullYear();
    const start = new Date(yr, 0, 1, 0, 0, 0);
    const end = new Date(yr, 11, 31, 23, 59, 59, 999);
    return {
      dateFrom: start.toISOString(),
      dateTo: end.toISOString(),
      periodLabel: isEn ? `Year ${yr}` : `Tahun ${yr}`,
    };
  }

  if (preset === "custom") {
    const start = customFrom ? new Date(`${customFrom}T00:00:00`).toISOString() : undefined;
    const end = customTo ? new Date(`${customTo}T23:59:59.999`).toISOString() : undefined;
    let label = isEn ? "Custom" : "Kustom";
    if (customFrom && customTo) {
      label = isEn ? `${customFrom} to ${customTo}` : `${customFrom} s/d ${customTo}`;
    } else if (customFrom) {
      label = isEn ? `From ${customFrom}` : `Dari ${customFrom}`;
    } else if (customTo) {
      label = isEn ? `Until ${customTo}` : `Sampai ${customTo}`;
    }
    return {
      dateFrom: start,
      dateTo: end,
      periodLabel: label,
    };
  }

  return {
    dateFrom: undefined,
    dateTo: undefined,
    periodLabel: isEn ? "All Time" : "Semua Waktu",
  };
}
