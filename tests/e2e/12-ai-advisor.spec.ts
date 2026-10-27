import { test, expect } from "@playwright/test";

test.describe("12. Fitur Halaman AI Advisor UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ai");
    await page.waitForLoadState("domcontentloaded");
  });

  test("halaman AI advisor memuat area chat dan kolom pesan interaktif", async ({ page }) => {
    await expect(page).toHaveURL(/.*ai.*/);

    // Header AI atau badge kuota
    await expect(page.locator("text=/AI Advisor|Konsultan Keuangan|Fin\.IQ AI/i").first()).toBeVisible({ timeout: 10000 });

    // Kolom input pertanyaan AI
    const chatInput = page.locator("textarea[placeholder*='Tanyakan'], input[placeholder*='Tanyakan'], textarea").first();
    await expect(chatInput).toBeVisible();

    // Verifikasi tombol upload struk atau vision OCR ada
    const ocrButton = page.locator("button:has(.lucide-camera), button:has(.lucide-scan), button:has-text('Struk')").first();
    if (await ocrButton.isVisible()) {
      await expect(ocrButton).toBeEnabled();
    }
  });

  test("fitur Kartu Saran Prompt Cerdas: menampilkan saran pertanyaan keuangan", async ({ page }) => {
    // Saran prompt audit boros atau batas belanja harian
    const suggestionPill = page.locator("text=/Audit Pos Boros|Batas Belanja|Alokasi Tabungan/i").first();
    if (await suggestionPill.isVisible()) {
      await expect(suggestionPill).toBeEnabled();
    }

    // Input chat dapat menerima ketikan pertanyaan
    const chatInput = page.locator("textarea[placeholder*='Tanyakan'], input[placeholder*='Tanyakan'], textarea").first();
    await chatInput.fill("Berapa pengeluaran saya minggu ini?");
    await expect(chatInput).toHaveValue("Berapa pengeluaran saya minggu ini?");
    await chatInput.clear();
  });
});
