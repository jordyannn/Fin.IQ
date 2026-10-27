import { test, expect } from "@playwright/test";

test.describe("06. Fitur Halaman Anggaran (Budgets) UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/budgets");
    await page.waitForLoadState("domcontentloaded");
  });

  test("halaman anggaran menampilkan ringkasan limit dan tombol atur anggaran", async ({ page }) => {
    await expect(page).toHaveURL(/.*budgets.*/);

    // Label Anggaran
    await expect(page.locator("text=/Anggaran|Budget|Limit Bulanan/i").first()).toBeVisible({ timeout: 10000 });

    // Tombol Atur / Tambah Anggaran
    const setBudgetBtn = page.locator("button:has-text('Pasang Batas Baru'), button:has-text('Atur Plafon Pertama'), button:has-text('Tambah Anggaran')").first();
    await expect(setBudgetBtn).toBeVisible({ timeout: 10000 });
    await setBudgetBtn.click();

    // Modal terbuka
    const modal = page.locator("div.fixed.inset-0:has-text('Tentukan Anggaran Kategori')").first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    const cancelBtn = modal.locator("button:has-text('Batal')").first();
    await cancelBtn.click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test("fitur Pasang Batas Anggaran: membuka dialog dan dapat mengisi nominal pagu", async ({ page }) => {
    const setBudgetBtn = page.locator("button:has-text('Pasang Batas Baru'), button:has-text('Atur Plafon Pertama')").first();
    await setBudgetBtn.click();

    const modal = page.locator("div.fixed.inset-0:has-text('Tentukan Anggaran Kategori')").first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Kolom nominal anggaran
    const amountInput = modal.locator("input[placeholder*='Contoh: 1500000'], input[type='number']").first();
    await expect(amountInput).toBeVisible();
    await amountInput.fill("1850000");
    await expect(amountInput).toHaveValue("1850000");

    // Tutup dialog
    const cancelBtn = modal.locator("button:has-text('Batal')").first();
    await cancelBtn.click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });
});
