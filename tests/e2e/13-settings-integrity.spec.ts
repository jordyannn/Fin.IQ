import { test, expect } from "@playwright/test";

test.describe("13. Fitur Halaman Pengaturan & Kesehatan Data UI", () => {
  test("halaman pengaturan memuat profil pengguna, ganti password, dan Gemini key", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("domcontentloaded");

    await expect(page).toHaveURL(/.*settings.*/);

    // Form profil
    await expect(page.locator("text=/Profil|Pengaturan|Akun/i").first()).toBeVisible({ timeout: 10000 });

    // Kolom nama pengguna
    const displayNameInput = page.locator("input[placeholder*='Nama'], input[name='displayName']").first();
    await expect(displayNameInput).toBeVisible();

    // Section ganti password atau Gemini API key
    await expect(page.locator("text=/Kata Sandi|Gemini|API Key/i").first()).toBeVisible();

    // Kolom input nama pengguna dapat menerima perubahan teks
    await displayNameInput.fill("Test FinIQ User");
    await expect(displayNameInput).toHaveValue("Test FinIQ User");
  });

  test("halaman kesehatan data memuat audit integritas saldo rekening dan status audit", async ({ page }) => {
    await page.goto("/integrity");
    await page.waitForLoadState("domcontentloaded");

    await expect(page).toHaveURL(/.*integrity.*/);

    // Judul Integritas
    await expect(page.locator("text=/Kesehatan Data|Integritas|Audit Saldo/i").first()).toBeVisible({ timeout: 10000 });

    // Verifikasi tabel atau kartu audit status saldo
    const statusCard = page.locator("text=/Status Kesehatan Database|Konsistensi Saldo/i").first();
    await expect(statusCard).toBeVisible({ timeout: 8000 });
  });
});
