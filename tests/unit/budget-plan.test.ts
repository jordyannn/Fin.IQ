import { describe, it, expect } from "vitest";
import {
  PLAN_SEGMENT_COLORS,
  computePeriodDaysInclusive,
  computePlanMetrics,
  parseMarkdownBudgetPlan,
  type PeriodBudgetPlan,
} from "../../src/lib/budget-plan";

const SAMPLE_MARKDOWN_PLAN = `Berikut adalah rincian target pemasukan dan batas pengeluaran per kategori untuk periode 13 November–31 Desember (49 hari) demi mencapai saldo akhir **Rp15.000.000**.

### 1. Target Pemasukan (Total: Rp11.639.500)

| Kategori Pemasukan | Nominal | Keterangan |
| --- | --- | --- |
| **Salary 19 November** | Rp3.000.000 | Mengunci Rp2.400.000 langsung ke tabungan |
| **Salary Desember** | Rp3.000.000 | Mengunci Rp1.500.000 langsung ke tabungan |
| **Part-Time (Estimasi Nov)** | Rp1.000.000 | 100% masuk tabungan target |
| **Part-Time Tambahan (Nov-Des)** | Rp2.000.000 | Target penghasilan tambahan ekstra |
| **Pekerjaan/Proyek Lainnya** | Rp2.639.500 | Target sisa untuk mencapai Rp15 juta |

### 2. Batas Pengeluaran / *Spending Cap* (Total: Rp2.400.000)

| Kategori Pengeluaran | Nominal | Strategi & Batasan |
| --- | --- | --- |
| **Transportasi** | Rp1.000.000 | Prioritas TransJakarta, gunakan Grab secara selektif |
| **Makanan & Groceries** | Rp1.050.000 | Belanja bahan makanan terencana, batasi jajan minimarket |
| **Kopi & Personal** | Rp150.000 | Hiburan skala kecil dan kebutuhan pribadi dasar |
| **Buffer / Tak Terduga** | Rp200.000 | Cadangan murni untuk pengeluaran mendesak |

### 3. Alokasi Pengeluaran Berdasarkan Waktu

| Periode Waktu | Batas Pengeluaran | Sumber Dana |
| --- | --- | --- |
| **13–18 November** | Rp300.000 | Menggunakan cash yang sudah ada saat ini |
| **19–30 November** | Rp600.000 | Diambil dari Salary November |
| **1–31 Desember** | Rp1.500.000 | Diambil dari Salary Desember |`;

describe("Period Budget Planner Helpers & Markdown Parser", () => {
  it("computes inclusive period days correctly (13 Nov -> 31 Dec = 49 days)", () => {
    expect(computePeriodDaysInclusive("2026-11-13", "2026-12-31")).toBe(49);
    expect(computePeriodDaysInclusive("2026-11-13", "2026-11-18")).toBe(6);
    expect(computePeriodDaysInclusive("2026-11-19", "2026-11-30")).toBe(12);
    expect(computePeriodDaysInclusive("2026-12-01", "2026-12-31")).toBe(31);
  });

  it("computes surplus, savings ratio, daily spending cap, and ending balance matching user plan", () => {
    const plan: PeriodBudgetPlan = {
      id: "plan-test",
      title: "Rencana Test",
      startDate: "2026-11-13",
      endDate: "2026-12-31",
      startingBalance: 5_760_500,
      targetEndingBalance: 15_000_000,
      trackingAccountId: "all",
      incomeTargets: [
        { id: "1", label: "Salary Nov", amount: 3_000_000, note: "" },
        { id: "2", label: "Salary Des", amount: 3_000_000, note: "" },
        { id: "3", label: "Part Time Nov", amount: 1_000_000, note: "" },
        { id: "4", label: "Part Time Extra", amount: 2_000_000, note: "" },
        { id: "5", label: "Proyek", amount: 2_639_500, note: "" },
      ],
      expenseCaps: [
        {
          id: "e1",
          label: "Transportasi",
          amount: 1_000_000,
          note: "",
          color: PLAN_SEGMENT_COLORS[0]!,
        },
        {
          id: "e2",
          label: "Makanan & Groceries",
          amount: 1_050_000,
          note: "",
          color: PLAN_SEGMENT_COLORS[1]!,
        },
        {
          id: "e3",
          label: "Kopi & Personal",
          amount: 150_000,
          note: "",
          color: PLAN_SEGMENT_COLORS[2]!,
        },
        {
          id: "e4",
          label: "Buffer",
          amount: 200_000,
          note: "",
          color: PLAN_SEGMENT_COLORS[3]!,
        },
      ],
      timeWindows: [],
      updatedAt: "2026-11-12T00:00:00.000Z",
    };

    const metrics = computePlanMetrics(plan, 5_760_500);
    expect(metrics.durationDays).toBe(49);
    expect(metrics.totalIncomeTarget).toBe(11_639_500);
    expect(metrics.totalExpenseCap).toBe(2_400_000);
    expect(metrics.projectedSavingsSurplus).toBe(9_239_500);
    expect(metrics.savingsRatioPercent).toBe(79);
    expect(metrics.dailySpendLimit).toBe(48_980);
    expect(metrics.baseBalance).toBe(5_760_500);
    expect(metrics.projectedEndingBalance).toBe(15_000_000);
    expect(
      plan.expenseCaps.map((c) =>
        Math.round((c.amount / metrics.totalExpenseCap) * 100)
      )
    ).toEqual([42, 44, 6, 8]);
  });

  it("parses the 3-section Indonesian Markdown plan into structured data and auto-matches categories", () => {
    const parsed = parseMarkdownBudgetPlan(SAMPLE_MARKDOWN_PLAN, {
      referenceYear: 2026,
      categories: [
        { id: "cat-salary", name: "Salary", kind: "income" },
        { id: "cat-pt", name: "Part time", kind: "income" },
        { id: "cat-trans", name: "Transportasi", kind: "expense" },
        { id: "cat-food", name: "Makanan & Minuman", kind: "expense" },
        { id: "cat-kopi", name: "Kopi & Minuman", kind: "expense" },
      ],
    });

    expect(parsed.startDate).toBe("2026-11-13");
    expect(parsed.endDate).toBe("2026-12-31");
    expect(parsed.targetEndingBalance).toBe(15_000_000);

    expect(parsed.incomeTargets).toHaveLength(5);
    expect(
      parsed.incomeTargets.reduce((sum, i) => sum + i.amount, 0)
    ).toBe(11_639_500);
    expect(parsed.incomeTargets[0]?.categoryId).toBe("cat-salary");
    expect(parsed.incomeTargets[2]?.categoryId).toBe("cat-pt");

    expect(parsed.expenseCaps).toHaveLength(4);
    expect(
      parsed.expenseCaps.reduce((sum, e) => sum + e.amount, 0)
    ).toBe(2_400_000);
    expect(parsed.expenseCaps[0]?.categoryId).toBe("cat-trans");
    expect(parsed.expenseCaps[2]?.categoryId).toBe("cat-kopi");

    expect(parsed.timeWindows).toHaveLength(3);
    expect(parsed.timeWindows[0]).toMatchObject({
      label: "13–18 November",
      startDate: "2026-11-13",
      endDate: "2026-11-18",
      amount: 300_000,
    });
    expect(parsed.timeWindows[1]).toMatchObject({
      label: "19–30 November",
      startDate: "2026-11-19",
      endDate: "2026-11-30",
      amount: 600_000,
    });
    expect(parsed.timeWindows[2]).toMatchObject({
      label: "1–31 Desember",
      startDate: "2026-12-01",
      endDate: "2026-12-31",
      amount: 1_500_000,
    });
  });
});
