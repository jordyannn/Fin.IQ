import { test, expect } from "@playwright/test";

test.describe("04. Fitur Halaman Rekening & Akun UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/accounts", { waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(page.locator("text=/TOTAL SALDO/i").first()).toBeVisible({ timeout: 15000 });
    // Tunggu sampai akun ter-render (jumlah > 0)
    await expect(page.locator("button:has-text('Semua (')").first()).not.toHaveText("Semua (0)", { timeout: 30000 });
  });

  test("halaman rekening menampilkan daftar akun dan tombol tambah akun", async ({ page }) => {
    await expect(page).toHaveURL(/.*accounts.*/);

    // Judul atau header akun
    await expect(page.locator("h1:has-text('Akun'), h1").first()).toBeVisible({ timeout: 10000 });

    // Tombol Tambah Akun
    const addAccountBtn = page.locator("button:has-text('Tambah Akun Baru')").first();
    await expect(addAccountBtn).toBeVisible({ timeout: 10000 });

    // Verifikasi modal tambah akun terbuka dengan expect.toPass untuk toleransi hidrasi
    const modal = page.locator("div[role='dialog']:has-text('Tambah Akun Baru'), div.fixed.inset-0:has-text('Tambah Akun Baru')").first();
    await expect(async () => {
      if (!(await modal.isVisible())) {
        await addAccountBtn.click({ force: true });
      }
      await expect(modal).toBeVisible();
    }).toPass({ timeout: 20000 });

    // Cek input nama akun
    const nameInput = modal.locator("input[placeholder*='Contoh'], input[type='text']").first();
    await expect(nameInput).toBeVisible();

    // Klik tombol Batal untuk menutup modal
    const cancelBtn = modal.locator("button:has-text('Batal'), button:has(.lucide-x)").first();
    await cancelBtn.click();
    await expect(modal).not.toBeVisible({ timeout: 10000 });
  });

  test("fitur Filter Tab Akun: beralih antara filter Semua, Aktif, dan Disembunyikan", async ({ page }) => {
    const tabAll = page.locator("div.flex button:has-text('Semua (')").first();
    const tabActive = page.locator("div.flex button:has-text('Aktif (')").first();
    const tabHidden = page.locator("div.flex button:has-text('Disembunyikan (')").first();

    await expect(tabAll).toBeVisible();
    await expect(tabActive).toBeVisible();
    await expect(tabHidden).toBeVisible();

    // Klik tab Aktif
    await tabActive.click();
    await expect(tabActive).toHaveClass(/shadow-xs|font-bold/, { timeout: 10000 });

    // Klik tab Disembunyikan
    await tabHidden.click();
    await expect(tabHidden).toHaveClass(/shadow-xs|font-bold/, { timeout: 10000 });

    // Kembalikan ke Semua
    await tabAll.click();
    await expect(tabAll).toHaveClass(/shadow-xs|font-bold/, { timeout: 10000 });
  });

  test("fitur Tambah Akun Baru: mendaftarkan rekening baru lengkap dan tampil pada daftar akun", async ({ page }) => {
    const uniqueAccountName = "Bank Uji E2E " + Date.now().toString().slice(-4);

    const addAccountBtn = page.locator("button:has-text('Tambah Akun Baru')").first();
    await expect(addAccountBtn).toBeVisible({ timeout: 10000 });

    const modal = page.locator("div[role='dialog']:has-text('Tambah Akun Baru'), div.fixed.inset-0:has-text('Tambah Akun Baru')").first();
    await expect(async () => {
      if (!(await modal.isVisible())) {
        await addAccountBtn.click({ force: true });
      }
      await expect(modal).toBeVisible();
    }).toPass({ timeout: 20000 });

    // Isi nama akun
    const nameInput = modal.locator("input[placeholder*='Contoh: Dompet']").first();
    await nameInput.fill(uniqueAccountName);

    // Isi saldo awal
    const balanceInput = modal.locator("input[inputmode='numeric']").first();
    await balanceInput.fill("250000");

    // Submit akun
    const submitBtn = modal.locator("button:has-text('Simpan Akun')");
    await submitBtn.click();

    // Verifikasi modal tertutup
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    // Verifikasi akun baru muncul di halaman
    const searchInput = page.locator("input[placeholder*='Cari']").first();
    if (await searchInput.isVisible()) {
      await searchInput.fill(uniqueAccountName);
    }
    await expect(page.locator(`text=${uniqueAccountName}`).first()).toBeVisible({ timeout: 15000 });
  });

  test("fitur Sesuaikan Saldo: tombol Sesuaikan Saldo membuka dialog penyesuaian", async ({ page }) => {
    // Tombol Sesuaikan Saldo Cepat pada salah satu kartu akun
    const adjustBtn = page.locator("button[title='Sesuaikan Saldo Cepat'], button[aria-label='Sesuaikan Saldo Cepat']").first();
    await expect(adjustBtn).toBeVisible({ timeout: 15000 });
    await adjustBtn.click();

    const adjustModal = page.locator("div.fixed.inset-0:has-text('Sesuaikan Saldo')").first();
    await expect(adjustModal).toBeVisible({ timeout: 10000 });

    // Verifikasi input saldo baru ada
    const newBalInput = adjustModal.locator("input[inputmode='numeric']").first();
    await expect(newBalInput).toBeVisible();

    // Batal
    const cancelBtn = adjustModal.locator("button:has-text('Batal'), button:has(.lucide-x)").first();
    await cancelBtn.click();
    await expect(adjustModal).not.toBeVisible({ timeout: 10000 });
  });
});

