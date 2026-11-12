import { describe, it, expect } from "vitest";
import {
  resolveCandidateModels,
  buildOpenRouterMessages,
} from "../../src/server/openrouter";
import {
  computeTelemetryWindow,
  generateTelemetryFinancialAnswer,
  type UserFinancialTelemetry,
} from "../../src/server/ai-telemetry";

describe("AI Advisor OpenRouter & Real Telemetry Grounding", () => {
  it("memprioritaskan model OpenRouter pilihan user baik curated maupun kustom", () => {
    const customCandidates = resolveCandidateModels("openai/gpt-4o-mini");
    expect(customCandidates[0]).toBe("openai/gpt-4o-mini");
    expect(customCandidates).toContain("google/gemma-4-26b-a4b-it:free");

    const flagshipCandidates = resolveCandidateModels("nvidia/nemotron-3-ultra-550b-a55b:free");
    expect(flagshipCandidates[0]).toBe("nvidia/nemotron-3-ultra-550b-a55b:free");
    expect(new Set(flagshipCandidates).size).toBe(flagshipCandidates.length);
  });

  it("menyertakan riwayat percakapan multi-turn dan mendukung merge system role saat kompatibilitas dibutuhkan", () => {
    const standardMsgs = buildOpenRouterMessages({
      systemPrompt: "SYSTEM_RULE",
      history: [
        { role: "user", content: "Pertanyaan 1" },
        { role: "assistant", content: "Jawaban 1" },
      ],
      userContent: "Pertanyaan 2",
      mergeSystemIntoUser: false,
    });

    expect(standardMsgs.map((m) => m.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);

    const mergedMsgs = buildOpenRouterMessages({
      systemPrompt: "SYSTEM_RULE",
      history: [{ role: "user", content: "Pertanyaan 1" }],
      userContent: "Pertanyaan 2",
      mergeSystemIntoUser: true,
    });

    expect(mergedMsgs.every((m) => m.role !== "system")).toBe(true);
    const lastUser = mergedMsgs[mergedMsgs.length - 1];
    expect(typeof lastUser.content).toBe("string");
    expect(lastUser.content as string).toContain("SYSTEM_RULE");
    expect(lastUser.content as string).toContain("Pertanyaan 2");
  });

  it("menghitung batas kalender lokal WIB (UTC+7) secara akurat agar transaksi hari ini tidak terpotong UTC", () => {
    // User bertanya jam 08:00 WIB (01:00 UTC) pada 12 November 2026
    const win = computeTelemetryWindow("2026-11-12T01:00:00.000Z", 420);

    expect(win.currentYear).toBe(2026);
    expect(win.currentMonth).toBe(10); // November (0-indexed)
    expect(win.currentDay).toBe(12);
    expect(win.currentMonthStr).toBe("2026-11");

    // 1 Nov 2026 00:00:00 WIB == 31 Okt 2026 17:00:00 UTC
    expect(win.startOfThisMonth.toISOString()).toBe("2026-10-31T17:00:00.000Z");

    // Akhir hari ini 12 Nov 2026 23:59:59.999 WIB == 12 Nov 2026 16:59:59.999 UTC
    // Transaksi siang ini misal 12:00 UTC (19:00 WIB) tetap <= endOfToday!
    const sameDayEveningTx = new Date("2026-11-12T12:00:00.000Z");
    expect(sameDayEveningTx.getTime()).toBeLessThanOrEqual(win.endOfToday.getTime());

    // Transaksi esok hari 13 Nov 2026 WIB > endOfToday (terjadwal)
    const tomorrowTx = new Date("2026-11-13T02:00:00.000Z");
    expect(tomorrowTx.getTime()).toBeGreaterThan(win.endOfToday.getTime());
  });

  it("fallback telemetri menggunakan data riil database termasuk all-time jika bulan berjalan kosong", () => {
    const telemetry: UserFinancialTelemetry = {
      userName: "Jordan",
      userEmail: "jordan@gmail.com",
      primaryCurrency: "IDR",
      referenceDateStr: "12 Nov 2026",
      totalBalance: 12500000,
      visibleBalance: 12500000,
      accountsCount: 2,
      ledgersCount: 1,
      accountsBreakdownText: "- BCA (Bank): Rp 10.000.000\n- Kas Tunai (Cash): Rp 2.500.000",
      thisMonth: {
        monthNameId: "November",
        monthNameEn: "November",
        year: 2026,
        monthStr: "2026-11",
        currentDay: 12,
        daysInMonth: 30,
        daysRemaining: 18,
        income: 0,
        expense: 0,
        net: 0,
        txCount: 0,
        dailyAverageExpense: 0,
        safeDailySpendLimit: 694444,
        categoriesBreakdownId: "",
        categoriesBreakdownEn: "",
      },
      lastMonth: {
        monthNameId: "Oktober",
        monthNameEn: "October",
        year: 2026,
        monthStr: "2026-10",
        income: 8000000,
        expense: 3200000,
        net: 4800000,
        txCount: 14,
        categoriesBreakdownId: "- Makan & Minum: Rp 1.800.000 (56%)",
        categoriesBreakdownEn: "- Food & Drink: IDR 1,800,000 (56%)",
      },
      rolling30Days: {
        startDateStr: "14 Okt 2026",
        endDateStr: "12 Nov 2026",
        income: 8000000,
        expense: 3200000,
        net: 4800000,
        txCount: 14,
        dailyAverageExpense: 106667,
        categoriesBreakdownId: "- Makan & Minum: Rp 1.800.000 (56%)",
        categoriesBreakdownEn: "- Food & Drink: IDR 1,800,000 (56%)",
      },
      allTime: {
        txCount: 14,
        income: 8000000,
        expense: 3200000,
        net: 4800000,
        monthlyHistoryId: "- 2026-10 (14 mutasi): Masuk Rp 8.000.000 | Keluar Rp 3.200.000",
        monthlyHistoryEn: "- 2026-10 (14 tx): In IDR 8,000,000 | Out IDR 3,200,000",
        topExpenseCategoriesId: "- Makan & Minum: Rp 1.800.000 (56%)",
        topExpenseCategoriesEn: "- Food & Drink: IDR 1,800,000 (56%)",
        topIncomeCategoriesId: "- Gaji: Rp 8.000.000 (100%)",
        topIncomeCategoriesEn: "- Salary: IDR 8,000,000 (100%)",
      },
      budgetsBreakdownId: "Belum ada target anggaran khusus.",
      budgetsBreakdownEn: "No specific category budgets configured yet.",
      recentTxInfoId: "- [25 Okt 2026] [EXPENSE] Rp 120.000 (Makan & Minum): \"Warteg\"",
      recentTxInfoEn: "- [25 Oct 2026] [EXPENSE] IDR 120,000 (Food & Drink): \"Warteg\"",
      upcomingTxInfoId: "Tidak ada transaksi terjadwal.",
      upcomingTxInfoEn: "No upcoming scheduled transactions.",
      systemPromptId: "",
      systemPromptEn: "",
      getUserPrompt: () => "",
    };

    const auditAnswer = generateTelemetryFinancialAnswer(
      telemetry,
      "Audit pos pengeluaran terbesar gue dong",
      false,
      "OpenRouter limit harian tercapai"
    );

    expect(auditAnswer).toContain("12.500.000");
    expect(auditAnswer).toContain("8.000.000");
    expect(auditAnswer).toContain("3.200.000");
    expect(auditAnswer).toContain("Makan & Minum");
    expect(auditAnswer).toContain("OpenRouter limit harian tercapai");
  });
});

