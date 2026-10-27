import { test, expect } from "@playwright/test";

test.describe("11. Fitur Halaman Buku Kas & Kolaborasi (Ledgers) UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ledgers");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1:has-text('Buku Kas')").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=/IDR Awal Periode|Buku Kas/i").first()).toBeVisible({ timeout: 15000 });
  });

  test("halaman buku kas menampilkan buku kas utama dan tombol kolaborasi", async ({ page }) => {
    await expect(page).toHaveURL(/.*ledgers.*/);

    // Buku kas utama
    await expect(page.locator("text=/Buku Kas Utama|Buku Kas/i").first()).toBeVisible({ timeout: 10000 });

    // Form Buat Buku Kas Baru
    const newNameInput = page.locator("input[placeholder*='Nama buku kas']").first();
    await expect(newNameInput).toBeVisible({ timeout: 10000 });
    const createBtn = page.locator("button:has-text('Buat Buku')").first();
    await expect(createBtn).toBeVisible();

    // Form Akses Buku Kas Bersama (Kode Undangan)
    const codeInput = page.locator("input[placeholder*='CONTOH:']").first();
    await expect(codeInput).toBeVisible();
    const joinBtn = page.locator("button:has-text('Gabung ke Buku Kas')").first();
    await expect(joinBtn).toBeVisible();
  });

  test("fitur Buat Buku Kas Baru: mengisi nama buku kas baru dan submit form", async ({ page }) => {
    const uniqueLedgerName = "Kas Proyek " + Date.now().toString().slice(-4);
    const newNameInput = page.locator("input[placeholder*='Nama buku kas']").first();
    await expect(newNameInput).toBeVisible({ timeout: 10000 });
    await newNameInput.fill(uniqueLedgerName);
    await expect(newNameInput).toHaveValue(uniqueLedgerName);

    const createBtn = page.locator("button:has-text('Buat Buku')").first();
    await createBtn.click();

    // Verifikasi buku kas baru tampil pada daftar
    const ledgerItem = page.locator(`text=${uniqueLedgerName}`).first();
    await expect(ledgerItem).toBeVisible({ timeout: 20000 });
  });
});
