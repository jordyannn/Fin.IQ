import { test, expect } from "@playwright/test";

test.describe("08. Fitur Halaman Analisis & Grafik UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/analytics");
    await page.waitForLoadState("domcontentloaded");
  });

  test("halaman analisis memuat komponen visualisasi grafik", async ({ page }) => {
    await expect(page).toHaveURL(/.*analytics.*/);

    // Judul atau section analisis
    await expect(page.locator("text=/Analisis|Statistik|Komposisi/i").first()).toBeVisible({ timeout: 10000 });

    // Cek container visualisasi tren likuiditas dan distribusi pos
    const chartCard = page.locator("text=/Tren Likuiditas Bulanan|Distribusi Pos Kategori/i").first();
    await expect(chartCard).toBeVisible({ timeout: 8000 });

    const expenseBtn = page.locator("button:has-text('Pengeluaran')").first();
    const incomeBtn = page.locator("button:has-text('Pemasukan')").first();
    await expect(expenseBtn).toBeVisible();
    await expect(incomeBtn).toBeVisible();

    // Klik Pemasukan
    await incomeBtn.click();
    await expect(incomeBtn).toHaveClass(/bg-\[#059669\]|text-white/);

    // Kembalikan ke Pengeluaran
    await expenseBtn.click();
    await expect(expenseBtn).toHaveClass(/shadow-xs|font-bold/);
  });
});
