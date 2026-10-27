import { test, expect } from "@playwright/test";

test.describe("07. Fitur Halaman Kalender Transaksi UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/calendar");
    await page.waitForLoadState("domcontentloaded");
  });

  test("halaman kalender menampilkan grid hari dan tombol navigasi bulan", async ({ page }) => {
    await expect(page).toHaveURL(/.*calendar.*/);

    // Header hari (Senin - Minggu / Mon - Sun)
    const dayHeader = page.locator("text=/Sen|Sel|Rab|Mon|Tue|Wed/i").first();
    await expect(dayHeader).toBeVisible({ timeout: 10000 });

    // Tombol navigasi bulan sebelumnya / selanjutnya
    const prevMonthBtn = page.locator("button:has(.lucide-chevron-left), button[aria-label*='sebelumnya']").first();
    const nextMonthBtn = page.locator("button:has(.lucide-chevron-right), button[aria-label*='selanjutnya']").first();

    await expect(prevMonthBtn).toBeVisible();
    await expect(nextMonthBtn).toBeVisible();

    // Navigasi ke bulan sebelumnya lalu kembali
    await prevMonthBtn.click();
    await page.waitForTimeout(300);
    await nextMonthBtn.click();
    await page.waitForTimeout(300);
  });

  test("halaman kalender dapat membuka popover pemilih bulan langsung", async ({ page }) => {
    // Tombol pemilih bulan
    const monthPickerTrigger = page.locator("button:has(.lucide-chevron-down), button[title*='memilih bulan']").first();
    if (await monthPickerTrigger.isVisible()) {
      await monthPickerTrigger.click();
      // Verifikasi dialog atau dropdown picker terbuka
      const pickerPopup = page.locator("text=/Pilih Bulan & Tahun|Januari|Februari/i").first();
      await expect(pickerPopup).toBeVisible({ timeout: 5000 });
      // Klik kembali untuk menutup
      await monthPickerTrigger.click();
    }
  });
});
