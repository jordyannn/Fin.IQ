/**
 * Shared contract, calculations, and Markdown text importer for
 * multi-period Income Target + Spending Cap + Time-Window Budget Plans.
 */

export interface BudgetPlanIncomeItem {
  id: string;
  label: string;
  amount: number;
  note: string;
  categoryId?: string;
}

export interface BudgetPlanExpenseItem {
  id: string;
  label: string;
  amount: number;
  note: string;
  color: string;
  categoryId?: string;
}

export interface BudgetPlanTimeWindow {
  id: string;
  label: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  amount: number;
  sourceNote: string;
}

export interface PeriodBudgetPlan {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startingBalance?: number;
  targetEndingBalance: number;
  trackingAccountId: string; // "all" or account UUID
  incomeTargets: BudgetPlanIncomeItem[];
  expenseCaps: BudgetPlanExpenseItem[];
  timeWindows: BudgetPlanTimeWindow[];
  updatedAt: string;
}

export const PLAN_SEGMENT_COLORS = [
  "#93C5FD", // sky-300
  "#4ADE80", // green-400
  "#FACC15", // yellow-400
  "#FB7185", // rose-400
  "#A78BFA", // violet-400
  "#FB923C", // orange-400
  "#2DD4BF", // teal-400
];

const ID_MONTH_MAP: Record<string, number> = {
  januari: 1,
  jan: 1,
  january: 1,
  februari: 2,
  feb: 2,
  february: 2,
  maret: 3,
  mar: 3,
  march: 3,
  april: 4,
  apr: 4,
  mei: 5,
  may: 5,
  juni: 6,
  jun: 6,
  june: 6,
  juli: 7,
  jul: 7,
  july: 7,
  agustus: 8,
  agu: 8,
  agt: 8,
  aug: 8,
  august: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  oct: 10,
  october: 10,
  november: 11,
  nov: 11,
  desember: 12,
  des: 12,
  dec: 12,
  december: 12,
};

function makeLocalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Returns inclusive calendar day count between `startDate` and `endDate` (YYYY-MM-DD).
 */
export function computePeriodDaysInclusive(
  startDate: string,
  endDate: string
): number {
  const s = Date.parse(`${startDate.slice(0, 10)}T00:00:00Z`);
  const e = Date.parse(`${endDate.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return 1;
  return Math.max(1, Math.round((e - s) / 86_400_000) + 1);
}

/**
 * Computes summary metrics for a PeriodBudgetPlan (matching UI & screenshot telemetry).
 */
export function computePlanMetrics(
  plan: Pick<
    PeriodBudgetPlan,
    | "startDate"
    | "endDate"
    | "startingBalance"
    | "targetEndingBalance"
    | "incomeTargets"
    | "expenseCaps"
  >,
  liveBalance?: number
) {
  const durationDays = computePeriodDaysInclusive(plan.startDate, plan.endDate);
  const totalIncomeTarget = plan.incomeTargets.reduce(
    (sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0),
    0
  );
  const totalExpenseCap = plan.expenseCaps.reduce(
    (sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0),
    0
  );
  const projectedSavingsSurplus = totalIncomeTarget - totalExpenseCap;
  const savingsRatioPercent =
    totalIncomeTarget > 0
      ? Math.round((projectedSavingsSurplus / totalIncomeTarget) * 100)
      : 0;
  const dailySpendLimit = Math.round(totalExpenseCap / Math.max(1, durationDays));
  const baseBalance =
    typeof liveBalance === "number" && Number.isFinite(liveBalance)
      ? liveBalance
      : (plan.startingBalance ?? 0);
  const projectedEndingBalance = baseBalance + projectedSavingsSurplus;

  return {
    durationDays,
    totalIncomeTarget,
    totalExpenseCap,
    projectedSavingsSurplus,
    savingsRatioPercent,
    dailySpendLimit,
    baseBalance,
    projectedEndingBalance,
  };
}

function parseRupiahNumber(raw: string): number {
  const match = raw.match(/(?:rp\.?\s*)?([\d.,]+)\s*(juta|jt|ribu|rb)?/i);
  if (!match) return 0;
  let numStr = match[1]!.trim();
  const unit = (match[2] || "").toLowerCase();

  if (unit === "juta" || unit === "jt") {
    const clean = numStr.replace(/\./g, "").replace(/,/g, ".");
    const parsed = Number(clean);
    return Number.isFinite(parsed) ? Math.round(parsed * 1_000_000) : 0;
  }
  if (unit === "ribu" || unit === "rb") {
    const clean = numStr.replace(/\./g, "").replace(/,/g, ".");
    const parsed = Number(clean);
    return Number.isFinite(parsed) ? Math.round(parsed * 1_000) : 0;
  }

  // Standard ID formatting uses dots as thousand separators (Rp15.000.000)
  // or commas in EN screenshots (Rp2,400,000)
  numStr = numStr.replace(/[.,]/g, "");
  const val = Number(numStr);
  return Number.isFinite(val) ? val : 0;
}

function toIsoYmd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDateRangeText(
  text: string,
  defaultYear: number
): { startDate: string; endDate: string } | null {
  // Pattern 1: "13 November–31 Desember" / "13 Nov - 31 Des 2026"
  const crossMonth = text.match(
    /(\d{1,2})\s+([a-zA-Z]+)(?:\s+(20\d{2}))?\s*[–—\-s/d]+\s*(\d{1,2})\s+([a-zA-Z]+)(?:\s+(20\d{2}))?/i
  );
  if (crossMonth) {
    const d1 = Number(crossMonth[1]);
    const m1 = ID_MONTH_MAP[crossMonth[2]!.toLowerCase()];
    const y1 = Number(crossMonth[3] || crossMonth[6] || defaultYear);
    const d2 = Number(crossMonth[4]);
    const m2 = ID_MONTH_MAP[crossMonth[5]!.toLowerCase()];
    const y2 = Number(crossMonth[6] || crossMonth[3] || defaultYear);
    if (m1 && m2 && d1 >= 1 && d1 <= 31 && d2 >= 1 && d2 <= 31) {
      return {
        startDate: toIsoYmd(y1, m1, d1),
        endDate: toIsoYmd(y2 < y1 || (y2 === y1 && m2 < m1) ? y1 + 1 : y2, m2, d2),
      };
    }
  }

  // Pattern 2: same-month range "13–18 November" / "1-31 Desember"
  const sameMonth = text.match(
    /(\d{1,2})\s*[–—\-]\s*(\d{1,2})\s+([a-zA-Z]+)(?:\s+(20\d{2}))?/i
  );
  if (sameMonth) {
    const d1 = Number(sameMonth[1]);
    const d2 = Number(sameMonth[2]);
    const m = ID_MONTH_MAP[sameMonth[3]!.toLowerCase()];
    const y = Number(sameMonth[4] || defaultYear);
    if (m && d1 >= 1 && d1 <= 31 && d2 >= 1 && d2 <= 31) {
      return {
        startDate: toIsoYmd(y, m, d1),
        endDate: toIsoYmd(y, m, d2),
      };
    }
  }

  return null;
}

function stripMarkdownFormatting(text: string): string {
  return text.replace(/[*_`]/g, "").trim();
}

/**
 * Parses a pasted Markdown / structured text financial plan (such as AI Advisor
 * tables for Income Targets, Spending Caps, and Time-Window Allocations) into
 * an editable `PeriodBudgetPlan`.
 */
export function parseMarkdownBudgetPlan(
  rawText: string,
  options?: {
    referenceYear?: number;
    defaultStartDate?: string;
    defaultEndDate?: string;
    categories?: { id: string; name: string; kind: string }[];
  }
): PeriodBudgetPlan {
  const refYear = options?.referenceYear ?? new Date().getFullYear();
  const lines = rawText.split(/\r?\n/);

  const topText = lines.slice(0, 6).join(" ");
  const range = parseDateRangeText(topText, refYear);
  const startDate = range?.startDate || options?.defaultStartDate || toIsoYmd(refYear, 11, 13);
  const endDate = range?.endDate || options?.defaultEndDate || toIsoYmd(refYear, 12, 31);

  const endBalanceMatch = rawText.match(
    /(?:saldo\s+akhir|target\s+saldo(?:\s+akhir)?)\s*[:\s*]*(Rp\.?\s*[\d.,]+(?:\s*(?:juta|jt))?)/i
  );
  const startBalanceMatch = rawText.match(
    /(?:saldo\s+awal|saldo\s+saat\s+ini)[^Rp\d]*(Rp\.?\s*[\d.,]+(?:\s*(?:juta|jt))?)/i
  );

  const parsedEndBal = endBalanceMatch ? parseRupiahNumber(endBalanceMatch[1]!) : 0;
  const parsedStartBal = startBalanceMatch ? parseRupiahNumber(startBalanceMatch[1]!) : 0;

  let section: "none" | "income" | "expense" | "time" = "none";
  const incomeTargets: BudgetPlanIncomeItem[] = [];
  const expenseCaps: BudgetPlanExpenseItem[] = [];
  const timeWindows: BudgetPlanTimeWindow[] = [];

  const matchCategory = (label: string, kind: "income" | "expense"): string | undefined => {
    const cats = (options?.categories || []).filter((c) => c.kind === kind);
    if (cats.length === 0) return undefined;
    const norm = label.toLowerCase();
    const direct = cats.find(
      (c) => norm.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(norm)
    );
    if (direct) return direct.id;
    // Keyword helpers
    if (kind === "expense") {
      if (/makan|grocer/i.test(norm)) {
        return cats.find((c) => /makan/i.test(c.name))?.id;
      }
      if (/kopi|minum/i.test(norm)) {
        return cats.find((c) => /kopi/i.test(c.name))?.id;
      }
      if (/buffer|tak terduga|darurat|lain/i.test(norm)) {
        return cats.find((c) => /lainnya/i.test(c.name))?.id;
      }
      if (/transport/i.test(norm)) {
        return cats.find((c) => /transport/i.test(c.name))?.id;
      }
    } else {
      if (/salary|gaji/i.test(norm)) {
        return cats.find((c) => /salary|gaji/i.test(c.name))?.id;
      }
      if (/part[\s-]*time/i.test(norm)) {
        return cats.find((c) => /part\s*time/i.test(c.name))?.id;
      }
      if (/proyek|pekerjaan|lain/i.test(norm)) {
        return cats.find((c) => /pemasukan lainnya|pendapatan lain/i.test(c.name))?.id;
      }
    }
    return undefined;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/target\s+pemasukan/i.test(line) && /^#{1,4}|^\d+\./.test(line)) {
      section = "income";
      continue;
    }
    if (/(?:batas\s+pengeluaran|spending\s+cap)/i.test(line) && /^#{1,4}|^\d+\./.test(line)) {
      section = "expense";
      continue;
    }
    if (/alokasi\s+pengeluaran\s+berdasarkan\s+waktu/i.test(line)) {
      section = "time";
      continue;
    }

    // Parse Markdown table rows: | col1 | col2 | col3 |
    if (!line.startsWith("|")) continue;
    if (/^\|\s*[-:]+/.test(line)) continue; // separator row

    const cols = line
      .split("|")
      .slice(1, -1)
      .map((c) => stripMarkdownFormatting(c));

    if (cols.length < 2) continue;
    const col0Lower = cols[0]!.toLowerCase();
    // Skip table header rows
    if (
      col0Lower.includes("kategori") ||
      col0Lower.includes("periode waktu")
    ) {
      continue;
    }

    const label = cols[0]!;
    const amount = parseRupiahNumber(cols[1] || "");
    const note = cols[2] || "";
    if (!label || amount <= 0) continue;

    if (section === "income") {
      incomeTargets.push({
        id: makeLocalId(),
        label,
        amount,
        note,
        categoryId: matchCategory(label, "income"),
      });
    } else if (section === "expense") {
      expenseCaps.push({
        id: makeLocalId(),
        label,
        amount,
        note,
        color: PLAN_SEGMENT_COLORS[expenseCaps.length % PLAN_SEGMENT_COLORS.length]!,
        categoryId: matchCategory(label, "expense"),
      });
    } else if (section === "time") {
      const wRange = parseDateRangeText(label, Number(startDate.slice(0, 4)) || refYear);
      timeWindows.push({
        id: makeLocalId(),
        label,
        startDate: wRange?.startDate || startDate,
        endDate: wRange?.endDate || endDate,
        amount,
        sourceNote: note,
      });
    }
  }

  return {
    id: makeLocalId(),
    title: `Rencana Target ${startDate} s/d ${endDate}`,
    startDate,
    endDate,
    startingBalance: parsedStartBal || undefined,
    targetEndingBalance: parsedEndBal || 15_000_000,
    trackingAccountId: "all",
    incomeTargets,
    expenseCaps,
    timeWindows,
    updatedAt: new Date().toISOString(),
  };
}

