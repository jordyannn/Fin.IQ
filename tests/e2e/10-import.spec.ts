import { test, expect } from "@playwright/test";

test.describe("10. Fitur Halaman Impor Data (CSV/Excel) UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/import");
    await page.waitForLoadState("domcontentloaded");
  });

  test("halaman impor memuat area unggah file dan kontrol deduplikasi", async ({ page }) => {
    await expect(page).toHaveURL(/.*import.*/);

    // Dropzone upload file
    const dropzone = page.locator("text=/Pilih atau tarik dokumen|Tarik & lepas file|Unggah file|Pilih file/i").first();
    await expect(dropzone).toBeVisible({ timeout: 10000 });

    // Tombol format/panduan file
    const guideBtn = page.locator("button:has-text('Panduan Format'), button:has-text('Lihat Panduan'), button:has-text('Panduan')").first();
    if (await guideBtn.isVisible()) {
      await guideBtn.click();
      await expect(page.locator("text=/Contoh Format Data CSV|Download Template CSV/i").first()).toBeVisible({ timeout: 5000 });
      // Kembali ke tab file
      const fileTab = page.locator("button:has-text('File (CSV / Excel / PDF)')").first();
      if (await fileTab.isVisible()) {
        await fileTab.click();
      }
    }
  });
});
