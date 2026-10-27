import { test, expect } from "@playwright/test";

test.describe("01. Fitur Autentikasi & Proteksi Sesi UI", () => {
  test("halaman login memiliki struktur form dan tab autentikasi lengkap", async ({ page }) => {
    await page.goto("/login");

    await expect(page).toHaveTitle(/Fin\.IQ/i);
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
    await expect(page.locator("button[type='submit']")).toBeVisible();
  });

  test("dapat beralih antara tab Masuk dan Daftar Akun Baru", async ({ page }) => {
    await page.goto("/login");

    // Klik tab Daftar
    const registerTab = page.locator("button", { hasText: /Daftar/i }).first();
    await registerTab.click();

    // Verifikasi input khusus pendaftaran muncul (misal: Konfirmasi Sandi atau Nama)
    const passwordInputs = page.locator("input[type='password']");
    await expect(passwordInputs).toHaveCount(2);

    // Kembali ke tab Masuk
    const loginTab = page.locator("button", { hasText: /Masuk/i }).first();
    await loginTab.click();
    await expect(page.locator("input[type='password']")).toHaveCount(1);
  });

  test("menampilkan pesan error saat login dengan kredensial salah", async ({ page }) => {
    await page.goto("/login");

    await page.locator("input[type='email']").fill("random_wrong_user@finiq.my.id");
    await page.locator("input[type='password']").fill("WrongPassword123!");
    await page.locator("button[type='submit']").click();

    // Tunggu alert / banner pesan error muncul
    const alertMessage = page.locator(".text-destructive, [role='alert'], .text-red-500, :text-matches('Gagal masuk|tidak sesuai', 'i')").first();
    await expect(alertMessage).toBeVisible({ timeout: 7000 });
  });

  test("pengunjung tanpa sesi otomatis dialihkan ke /login saat membuka rute privat", async ({ page }) => {
    await page.goto("/overview");
    await expect(page).toHaveURL(/.*login.*/);

    await page.goto("/transactions");
    await expect(page).toHaveURL(/.*login.*/);

    await page.goto("/accounts");
    await expect(page).toHaveURL(/.*login.*/);
  });
});
