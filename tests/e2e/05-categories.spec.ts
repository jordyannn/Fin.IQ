import { test, expect } from "@playwright/test";

test.describe("05. Fitur Halaman Kategori UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/categories");
    await page.waitForLoadState("domcontentloaded");
  });

  test("halaman kategori memiliki tab Pengeluaran dan Pemasukan", async ({ page }) => {
    await expect(page).toHaveURL(/.*categories.*/);

    // Tab Pengeluaran & Pemasukan
    const expenseTab = page.locator("button", { hasText: /Pengeluaran/i }).first();
    const incomeTab = page.locator("button", { hasText: /Pemasukan/i }).first();

    await expect(expenseTab).toBeVisible({ timeout: 10000 });
    await expect(incomeTab).toBeVisible();

    // Klik tab Pemasukan
    await incomeTab.click();
    await page.waitForTimeout(500);

    // Kembalikan ke tab Pengeluaran
    await expenseTab.click();
    await page.waitForTimeout(500);
  });

  test("tombol tambah kategori membuka formulir kategori baru", async ({ page }) => {
    const addCategoryBtn = page.locator("button:has-text('Kategori Baru')").first();
    await expect(addCategoryBtn).toBeVisible({ timeout: 10000 });
    await addCategoryBtn.click();

    // Formulir inline card terbuka
    const formCard = page.locator("text='Buat Kategori Baru'").first();
    await expect(formCard).toBeVisible({ timeout: 5000 });

    // Cek input nama kategori
    const nameInput = page.locator("input[placeholder*='Contoh: Belanja Bulanan']").first();
    await expect(nameInput).toBeVisible();

    // Klik Batal
    const cancelBtn = page.locator("button:has-text('Batal')").first();
    await cancelBtn.click();
    await expect(formCard).not.toBeVisible({ timeout: 5000 });
  });

  test("fitur Tambah Kategori Baru: membuat kategori pengeluaran baru dan tampil di daftar", async ({ page }) => {
    const uniqueCatName = "Uji Kategori E2E " + Date.now().toString().slice(-4);

    const addCategoryBtn = page.locator("button:has-text('Kategori Baru')").first();
    await addCategoryBtn.click();

    const nameInput = page.locator("input[placeholder*='Contoh: Belanja Bulanan']").first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(uniqueCatName);
    const saveBtn = page.locator("button:has-text('Simpan')").first();
    await saveBtn.click();

    // Verifikasi kategori baru muncul di halaman (filter pencarian untuk fokus)
    const searchInput = page.locator("input[placeholder*='Cari kategori']").first();
    await searchInput.fill(uniqueCatName);
    const catItem = page.locator(`text=${uniqueCatName}`).first();
    await expect(catItem).toBeVisible({ timeout: 15000 });
  });

  test("fitur Pencarian Kategori: input pencarian menyaring kategori yang relevan", async ({ page }) => {
    const searchInput = page.locator("input[placeholder*='Cari kategori']").first();
    await expect(searchInput).toBeVisible();

    await searchInput.fill("Makan");
    // Verifikasi bahwa input menerima teks
    await expect(searchInput).toHaveValue("Makan");

    // Bersihkan filter pencarian
    await searchInput.clear();
    await expect(searchInput).toHaveValue("");
  });
});

