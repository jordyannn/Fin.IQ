import { test, expect, Page } from "@playwright/test";
import path from "path";
import fs from "fs";

// Folder screenshot disimpan di public agar tidak terhapus saat Playwright dijalankan ulang
const SCREENSHOT_DIR = path.join(process.cwd(), "public", "mobile-screenshots");
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const MOBILE_VIEWPORTS = [
  { name: "iPhone-13", width: 390, height: 844 },
  { name: "iPhone-SE", width: 375, height: 667 },
];

const PAGES_TO_TEST = [
  { path: "/overview", name: "Overview" },
  { path: "/transactions", name: "Transactions" },
  { path: "/accounts", name: "Accounts" },
  { path: "/budgets", name: "Budgets" },
  { path: "/calendar", name: "Calendar" },
  { path: "/analytics", name: "Analytics" },
  { path: "/categories", name: "Categories" },
  { path: "/ai", name: "AI-Advisor" },
  { path: "/annual-report", name: "Annual-Report" },
  { path: "/ledgers", name: "Ledgers" },
  { path: "/import", name: "Import" },
  { path: "/settings", name: "Settings" },
];

async function checkNoHorizontalOverflow(page: Page, pageName: string, viewportName: string) {
  const overflowInfo = await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const bodyScrollWidth = document.body.scrollWidth;
    const isOverflowing = scrollWidth > docWidth + 1 || bodyScrollWidth > docWidth + 1;

    let culprits: Array<{ tag: string; id: string; className: string; rect: any }> = [];
    if (isOverflowing) {
      document.querySelectorAll("*").forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.right > docWidth + 2) {
          culprits.push({
            tag: el.tagName,
            id: el.id,
            className: (el.className || "").toString().slice(0, 100),
            rect: { left: rect.left, right: rect.right, width: rect.width },
          });
        }
      });
    }

    return {
      docWidth,
      scrollWidth,
      bodyScrollWidth,
      isOverflowing,
      culprits: culprits.slice(0, 10),
    };
  });

  if (overflowInfo.isOverflowing) {
    console.error(
      `[OVERFLOW DETECTED] Page: ${pageName} (${viewportName}) docWidth=${overflowInfo.docWidth}, scrollWidth=${overflowInfo.scrollWidth}, culprits:`,
      JSON.stringify(overflowInfo.culprits, null, 2)
    );
  }

  expect(
    overflowInfo.scrollWidth,
    `Page ${pageName} on ${viewportName} has horizontal overflow (scrollWidth: ${overflowInfo.scrollWidth} > docWidth: ${overflowInfo.docWidth})`
  ).toBeLessThanOrEqual(overflowInfo.docWidth + 1.5);
}

test.describe("Mobile-Friendly UI Testing Suite", () => {
  for (const vp of MOBILE_VIEWPORTS) {
    test.describe(`Viewport: ${vp.name} (${vp.width}x${vp.height})`, () => {
      test.use({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true,
      });

      test("01. Navigasi Bawah Seluler (MobileBottomNav) tampil dan fungsional", async ({ page }) => {
        await page.goto("/overview");
        await page.waitForLoadState("domcontentloaded");

        // MobileBottomNav harus terlihat di mobile
        const bottomNav = page.locator("nav.fixed.bottom-0");
        await expect(bottomNav).toBeVisible();

        // Tombol FAB Quick Add (+) di tengah
        const fabButton = bottomNav.locator("button[aria-label*='Tambah'], button:has(.lucide-plus)");
        await expect(fabButton).toBeVisible();

        // Link Ringkasan/Overview, Transaksi, Akun, dan Menu
        await expect(bottomNav.locator("text=/Ringkasan|Overview/i")).toBeVisible();
        await expect(bottomNav.locator("text=/Transaksi|Mutasi/i")).toBeVisible();
        await expect(bottomNav.locator("text=/Akun|Rekening/i")).toBeVisible();
        await expect(bottomNav.locator("text=Menu")).toBeVisible();

        // Screenshot navigasi bawah
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${vp.name}-01-bottom-nav.png`),
        });
      });

      test("02. Laci Navigasi Seluler (Drawer Menu) dapat dibuka dan ditutup dengan nyaman", async ({ page }) => {
        await page.goto("/overview");
        await page.waitForLoadState("domcontentloaded");

        const bottomNav = page.locator("nav.fixed.bottom-0");
        const menuBtn = bottomNav.locator("button:has-text('Menu')");
        await menuBtn.click();

        // Laci samping terbuka
        const drawer = page.locator("div.fixed.inset-0:has-text('Navigasi Seluler')");
        await expect(drawer).toBeVisible({ timeout: 5000 });

        // Cek link navigasi di dalam drawer
        await expect(drawer.locator("text=/Kategori|Anggaran|Kalender|Analitik/i").first()).toBeVisible();

        // Screenshot drawer di mobile
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${vp.name}-02-drawer-menu.png`),
        });

        // Tombol Tutup (X)
        const closeBtn = drawer.locator("button[aria-label='Tutup Menu']");
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();
        await expect(drawer).not.toBeVisible({ timeout: 5000 });
      });

      test("03. Modal Quick Add (+) pada layar mobile nyaman digunakan dan tombol tersubmit", async ({ page }) => {
        await page.goto("/overview");
        await page.waitForLoadState("domcontentloaded");

        // Klik FAB Quick Add
        const fabButton = page.locator("nav.fixed.bottom-0 button:has(.lucide-plus)");
        await fabButton.click();

        // Modal Quick Add muncul
        const modal = page.locator("form[role='dialog'][aria-label*='Catat Transaksi']");
        await expect(modal).toBeVisible({ timeout: 5000 });

        // Cek tidak ada horizontal overflow saat modal terbuka
        await checkNoHorizontalOverflow(page, "QuickAddModal", vp.name);

        // Cek elemen form utama
        const amountInput = modal.locator("input[inputmode='numeric']");
        await expect(amountInput).toBeVisible();

        // Cek tombol simpan terlihat dan berada dalam viewport
        const saveBtn = modal.locator("button[type='submit']");
        await expect(saveBtn).toBeVisible();
        const saveBox = await saveBtn.boundingBox();
        expect(saveBox).not.toBeNull();
        if (saveBox) {
          expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(vp.height + 5);
        }

        // Screenshot Quick Add Modal di mobile
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${vp.name}-03-quick-add-modal.png`),
        });

        // Tutup modal menggunakan tombol X pertama
        const closeBtn = modal.locator("button[title*='Tutup']").first();
        await closeBtn.click();
        await expect(modal).not.toBeVisible({ timeout: 5000 });
      });

      // Uji seluruh 13 halaman: pastikan tidak ada horizontal overflow & responsif
      for (const p of PAGES_TO_TEST) {
        test(`04. Halaman ${p.name} (${p.path}) bebas horizontal overflow dan nyaman di mobile`, async ({
          page,
        }) => {
          await page.goto(p.path, { waitUntil: "domcontentloaded", timeout: 45000 });
          await page.waitForTimeout(1000);

          // Verifikasi tidak ada horizontal overflow sama sekali
          await checkNoHorizontalOverflow(page, p.name, vp.name);

          // Screenshot halaman mobile
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `${vp.name}-page-${p.name.toLowerCase()}.png`),
            fullPage: false,
          });
        });
      }

      test("05. Halaman Transaksi di mobile menampilkan Card Feed bukan tabel yang rusak", async ({ page }) => {
        await page.goto("/transactions");
        await page.waitForLoadState("domcontentloaded");

        // Filter bar responsif
        const searchInput = page.locator("input[placeholder*='Cari']");
        await expect(searchInput).toBeVisible();

        // Mobile card feed harus aktif
        const mobileFeed = page.locator("div.block.md\\:hidden");
        await expect(mobileFeed).toBeVisible();

        // Tombol aksi Edit dan Hapus pada kartu transaksi memiliki ukuran yang cukup untuk disentuh
        const editBtn = page.locator("button[aria-label='Edit Transaksi']").first();
        if (await editBtn.isVisible()) {
          const box = await editBtn.boundingBox();
          expect(box?.width).toBeGreaterThanOrEqual(30);
          expect(box?.height).toBeGreaterThanOrEqual(30);

          // Klik edit untuk memastikan EditTransactionModal responsif di mobile
          await editBtn.click();
          const editModal = page.locator("div.fixed.inset-0:has-text('Ubah Transaksi')");
          await expect(editModal).toBeVisible({ timeout: 5000 });

          // Cek modal ubah transaksi bebas overflow
          await checkNoHorizontalOverflow(page, "EditTransactionModal", vp.name);

          // Screenshot modal edit transaksi
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `${vp.name}-05-edit-transaction-modal.png`),
          });

          // Tutup modal ubah transaksi
          const cancelBtn = editModal.locator("button:has-text('Batal')");
          await cancelBtn.click();
          await expect(editModal).not.toBeVisible({ timeout: 5000 });
        }
      });
    });
  }
});
