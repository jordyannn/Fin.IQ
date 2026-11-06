import { test, expect } from "@playwright/test";

test.describe("02. Fitur Dashboard Overview UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/overview", { waitUntil: "domcontentloaded" });
    await page.locator("text=/Total Aset|Saldo Bersih|Arus Kas/i").first().waitFor({ state: "visible", timeout: 15000 });
  });

  test("menampilkan elemen kartu hero ringkasan keuangan utama", async ({ page }) => {
    // Verifikasi berada di halaman /overview
    await expect(page).toHaveURL(/.*overview.*/);

    // Kartu hero ringkasan (Total Saldo / Aset Bersih)
    const heroCard = page.locator("text=/Total Aset|Saldo Bersih|Arus Kas/i").first();
    await expect(heroCard).toBeVisible({ timeout: 10000 });

    // Pemasukan & Pengeluaran labels
    await expect(page.locator("text=/Pemasukan/i").first()).toBeVisible();
    await expect(page.locator("text=/Pengeluaran/i").first()).toBeVisible();
  });
  test("tombol Quick Add transaksi dapat diklik dan membuka modal transaksi", async ({ page }) => {
    // Dismiss Bang Peci mascot prompt if present
    const mascotDismiss = page.locator("button:has-text('Nanti Saja'), button:has-text('Tutup')").first();
    if (await mascotDismiss.isVisible({ timeout: 2500 }).catch(() => false)) {
      await mascotDismiss.click().catch(() => {});
    }

    // Tombol tambah transaksi cepat dengan data-tour selector
    const quickAddButton = page.locator("[data-tour='quick-add']:visible, button:has-text('Catat Transaksi'):visible").first();
    await expect(quickAddButton).toBeVisible({ timeout: 15000 });

    const modal = page.locator("form[data-tour-modal='quick-add']").first();
    // Gunakan expect.toPass untuk menjamin interaksi setelah hidrasi React tuntas
    await expect(async () => {
      if (!(await modal.isVisible())) {
        await quickAddButton.click({ force: true });
      }
      await expect(modal).toBeVisible();
    }).toPass({ timeout: 20000 });

    // Tutup modal kembali via tombol close atau Escape
    const closeBtn = modal.locator("button[title*='Tutup'], button:has(.lucide-x)").first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await expect(modal).not.toBeVisible({ timeout: 10000 });
  });

  test("komponen navigasi waktu (Month/Date Filter) dapat diakses", async ({ page }) => {
    // Filter tanggal atau pemilih bulan
    const dateSelector = page.locator("button:has-text('Bulan Ini'), button:has(.lucide-calendar), [data-tour='month-filter']").first();
    await expect(dateSelector).toBeVisible();
  });

  test("komponen transaksi terbaru atau alokasi kategori dimuat pada overview", async ({ page }) => {
    // Section transaksi terbaru atau alokasi kategori di area konten utama
    const recentOrCategorySection = page.locator("main").locator("text=/Transaksi Terbaru|Pengeluaran Terbesar|Alokasi|Kas Masuk|Kas Keluar|Saldo/i").first();
    await expect(recentOrCategorySection).toBeVisible({ timeout: 15000 });
  });
});
