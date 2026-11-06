import { test, expect } from "@playwright/test";

test.describe("03. Fitur Halaman Transaksi UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/transactions", { waitUntil: "domcontentloaded" });
    await page.locator("h1:has-text('Transaksi'):visible, main").first().waitFor({ state: "visible", timeout: 15000 });
    // Pastikan query transaksi dan hidrasi React selesai
    await page.locator("text='Memuat transaksi...'").waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
  });

  test("halaman transaksi menampilkan filter tipe dan kontrol pencarian", async ({ page }) => {
    await expect(page).toHaveURL(/.*transactions.*/);

    // Filter tipe transaksi (Semua / Keluar / Masuk / Transfer)
    const filterAll = page.locator("button, [role='tab']", { hasText: /Semua|All/i }).first();
    await expect(filterAll).toBeVisible({ timeout: 10000 });

    // Kolom pencarian catatan
    const searchInput = page.locator("input[placeholder*='Cari'], input[type='search'], input[placeholder*='transaksi']").first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Kopi");
    await expect(searchInput).toHaveValue("Kopi");
    await searchInput.clear();
  });

  test("tombol buka dialog transaksi baru berfungsi dengan baik", async ({ page }) => {
    // Tombol Catat Transaksi di toolbar
    const addBtn = page.locator("button:has-text('Catat Transaksi')").first();
    await expect(addBtn).toBeVisible({ timeout: 15000 });

    // Verifikasi modal QuickAddModal terbuka dengan expect.toPass untuk toleransi hidrasi
    const modal = page.locator("form[data-tour-modal='quick-add']").first();
    await expect(async () => {
      if (!(await modal.isVisible())) {
        await addBtn.click({ force: true });
      }
      await expect(modal).toBeVisible();
    }).toPass({ timeout: 20000 });

    // Tutup modal via tombol close atau Escape
    const closeBtn = modal.locator("button[title*='Tutup'], button:has(.lucide-x)").first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await expect(modal).not.toBeVisible({ timeout: 10000 });
  });

  test("fitur QuickAddModal: parsing NLP lokal otomatis mengisi nominal dan catatan", async ({ page }) => {
    // Buka dialog Catat Transaksi
    const addBtn = page.locator("button:has-text('Catat Transaksi'), button:has-text('Tambah')").first();
    const modal = page.locator("form[data-tour-modal='quick-add']").first();
    await expect(async () => {
      if (!(await modal.isVisible())) {
        await addBtn.click({ force: true });
      }
      await expect(modal).toBeVisible();
    }).toPass({ timeout: 20000 });

    // Input bantuan NLP cerdas
    const nlpInput = modal.locator("input[placeholder*='Ketik santai']");
    await expect(nlpInput).toBeVisible();
    await nlpInput.fill("Kopi susu 18000");

    const processBtn = modal.locator("button:has-text('Proses')");
    await processBtn.click();

    // Verifikasi nominal otomatis terisi 18.000
    const amountInput = modal.locator("input[inputmode='numeric']");
    await expect(amountInput).toHaveValue("18.000");

    // Verifikasi catatan terisi
    const noteInput = modal.locator("input[placeholder*='Sarapan pagi']");
    await expect(noteInput).toHaveValue(/Kopi susu/i);

    // Tutup modal
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  });

  test("fitur QuickAddModal: beralih jenis transaksi (Pengeluaran, Pemasukan, Transfer) merubah struktur form", async ({ page }) => {
    const addBtn = page.locator("button:has-text('Catat Transaksi'), button:has-text('Tambah')").first();
    const modal = page.locator("form[data-tour-modal='quick-add']").first();
    await expect(async () => {
      if (!(await modal.isVisible())) {
        await addBtn.click({ force: true });
      }
      await expect(modal).toBeVisible();
    }).toPass({ timeout: 20000 });

    // Tab Pemasukan
    const incomeTab = modal.getByRole("button", { name: "Pemasukan", exact: true });
    await incomeTab.click();
    await expect(incomeTab).toHaveClass(/bg-emerald/);

    // Tab Transfer
    const transferTab = modal.getByRole("button", { name: "Transfer", exact: true });
    await transferTab.click();
    await expect(transferTab).toHaveClass(/bg-blue/);

    // Verifikasi input Ke Akun muncul pada Transfer
    await expect(modal.locator("text='Ke Akun'")).toBeVisible();

    // Kembali ke Pengeluaran
    const expenseTab = modal.getByRole("button", { name: "Pengeluaran", exact: true });
    await expenseTab.click();
    await expect(expenseTab).toHaveClass(/bg-rose/);
    await expect(modal.locator("text='Kategori'")).toBeVisible();

    await page.keyboard.press("Escape");
  });

  test("fitur QuickAddModal: mencatat transaksi pengeluaran baru dan tampil di daftar", async ({ page }) => {
    const uniqueNote = "E2E Uji Transaksi " + Date.now();

    const addBtn = page.locator("button:has-text('Catat Transaksi'), button:has-text('Tambah')").first();
    const modal = page.locator("form[data-tour-modal='quick-add']").first();
    await expect(async () => {
      if (!(await modal.isVisible())) {
        await addBtn.click({ force: true });
      }
      await expect(modal).toBeVisible();
    }).toPass({ timeout: 20000 });

    // Isi nominal
    const amountInput = modal.locator("input[inputmode='numeric']");
    await amountInput.fill("42000");

    // Isi catatan
    const noteInput = modal.locator("input[placeholder*='Sarapan pagi']");
    await noteInput.fill(uniqueNote);

    // Jika dropdown menampilkan "Pilih Akun...", klik dan pilih opsi pertama
    const accountTrigger = modal.locator("button:has-text('Pilih Akun...'), button:has-text('Pilih sumber dana')").first();
    if (await accountTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await accountTrigger.click();
      const firstAccOption = modal.locator("button.w-full, div.cursor-pointer").first();
      if (await firstAccOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstAccOption.click().catch(() => {});
      }
    }

    // Submit transaksi setelah akun dan kategori selesai di-resolve
    const submitBtn = modal.locator("button[type='submit']:has-text('Simpan'), button:has-text('Simpan Transaksi')").first();
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });
    await submitBtn.scrollIntoViewIfNeeded();
    await submitBtn.click();

    // Tunggu modal tertutup setelah mutasi tRPC selesai disimpan
    await expect(modal).not.toBeVisible({ timeout: 25000 });

    // Cari transaksi yang baru dibuat di kolom search
    const searchInput = page.locator("input[placeholder*='Cari'], input[type='search'], input[placeholder*='transaksi']").first();
    await searchInput.fill(uniqueNote);

    // Verifikasi transaksi baru muncul di tabel / list yang terlihat (desktop table)
    await expect(page.locator(`text=${uniqueNote}`).locator("visible=true").first()).toBeVisible({ timeout: 15000 });

    // Bersihkan search
    await searchInput.clear();
  });

  test("fitur QuickAddModal: tombol Bersihkan (Clear) memunculkan dialog dan mereset draft input", async ({ page }) => {
    const addBtn = page.locator("button:has-text('Catat Transaksi'), button:has-text('Tambah')").first();
    const modal = page.locator("form[data-tour-modal='quick-add']").first();
    await expect(async () => {
      if (!(await modal.isVisible())) {
        await addBtn.click({ force: true });
      }
      await expect(modal).toBeVisible();
    }).toPass({ timeout: 20000 });

    // Isi input nominal
    const amountInput = modal.locator("input[inputmode='numeric']");
    await amountInput.fill("77000");

    // Klik tombol Bersihkan
    const clearBtn = modal.locator("button:has-text('Bersihkan')");
    await expect(clearBtn).toBeEnabled();
    await clearBtn.click();

    // Dialog konfirmasi bersihkan muncul
    const confirmDialog = page.locator("div.fixed.inset-0:has-text('Bersihkan Form')").first();
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    // Klik Ya, Bersihkan
    const yaBtn = confirmDialog.locator("button:has-text('Ya, Bersihkan')");
    await yaBtn.click();

    // Verifikasi input nominal kembali kosong
    await expect(amountInput).toHaveValue("");

    await page.keyboard.press("Escape");
  });
});
