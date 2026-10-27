import { test, expect } from "@playwright/test";

test.describe("09. Fitur Halaman Laporan Tahunan UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/annual-report");
    await page.waitForLoadState("domcontentloaded");
  });

  test("halaman laporan tahunan memuat ringkasan performa tahunan", async ({ page }) => {
    await expect(page).toHaveURL(/.*annual-report.*/);

    // Judul laporan tahunan
    await expect(page.locator("text=/Laporan Tahunan|Annual Report|Rekapitulasi/i").first()).toBeVisible({ timeout: 10000 });

    // Pemilih tahun (misal: tombol tahun atau dropdown)
    const currentYear = new Date().getFullYear().toString();
    await expect(page.locator(`text=${currentYear}`).first()).toBeVisible();

    // Verifikasi 3 kartu KPI utama: Pemasukan Tahunan, Pengeluaran Tahunan, dan Akumulasi Saldo Bersih
    await expect(page.locator("text=/Total Pemasukan Tahunan/i").first()).toBeVisible();
    await expect(page.locator("text=/Total Pengeluaran Tahunan/i").first()).toBeVisible();
    await expect(page.locator("text=/Akumulasi Saldo Bersih/i").first()).toBeVisible();
  });
});
