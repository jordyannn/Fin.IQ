const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DESKTOP_DIR = path.join(ROOT_DIR, "public", "desktop");
const MOBILE_DIR = path.join(ROOT_DIR, "public", "mobile");
const AUTH_FILE = path.join(ROOT_DIR, "tests", "e2e", ".auth", "user.json");

// Pastikan folder public/desktop dan public/mobile bersih dan siap
[DESKTOP_DIR, MOBILE_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const PAGES = [
  {
    filename: "01-overview.png",
    url: "http://localhost:3000/overview",
    title: "Overview Dashboard & Bang Peci Mascot",
  },
  {
    filename: "02-transactions.png",
    url: "http://localhost:3000/transactions",
    title: "Daftar Transaksi & Riwayat Arus Kas",
  },
  {
    filename: "03-import.png",
    url: "http://localhost:3000/import",
    title: "Import Mutasi Bank (BCA/Mandiri) & Scan Struk OCR",
  },
  {
    filename: "04-accounts.png",
    url: "http://localhost:3000/accounts",
    title: "Manajemen Rekening Bank, E-Wallet & Kas Tunai",
  },
  {
    filename: "05-analytics.png",
    url: "http://localhost:3000/analytics",
    title: "Analitik Pengeluaran & Grafik Komparasi",
  },
  {
    filename: "06-ai-advisor.png",
    url: "http://localhost:3000/ai",
    title: "Fin.IQ AI Financial Advisor & Diagnosa Cerdas",
  },
  {
    filename: "07-budgets.png",
    url: "http://localhost:3000/budgets",
    title: "Kontrol Budget & Target Pengeluaran",
  },
  {
    filename: "08-calendar.png",
    url: "http://localhost:3000/calendar",
    title: "Kalender Finansial & Heatmap Arus Kas Harian",
  },
  {
    filename: "10-annual-report.png",
    url: "http://localhost:3000/annual-report",
    title: "Laporan Tahunan & Proyeksi Finansial",
  },
];

async function ensureAuthenticated(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("🔐 Autentikasi akun demo owner@finiq.app...");
  await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  await page.fill("input[type='email']", "owner@finiq.app");
  await page.fill("input[type='password']", "123456");
  await page.click("button[type='submit']");

  await page.waitForURL("**/overview", { timeout: 30000 });
  await page.evaluate(() => {
    localStorage.setItem("finiq_tour_welcomed", "true");
    localStorage.setItem("finiq_tour_completed", "true");
  });

  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
  await context.storageState({ path: AUTH_FILE });
  await context.close();
  console.log("✅ Autentikasi berhasil tersimpan.");
}

async function capture() {
  const browser = await chromium.launch({ headless: true });

  try {
    if (!fs.existsSync(AUTH_FILE)) {
      await ensureAuthenticated(browser);
    }

    // =========================================================================
    // 1. DESKTOP CAPTURES (1920x1080 Full HD, scale 2x Retina, 10s delay)
    // =========================================================================
    console.log("\n=======================================================");
    console.log("🖥️  MEMULAI SCREENSHOT DESKTOP (public/desktop/)...");
    console.log("⏳ Delay tunggu: 10 DETIK per halaman sebelum capture");
    console.log("=======================================================");

    const desktopContext = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
      storageState: AUTH_FILE,
    });

    const desktopPage = await desktopContext.newPage();

    await desktopPage.addInitScript(() => {
      localStorage.setItem("finiq_tour_welcomed", "true");
      localStorage.setItem("finiq_tour_completed", "true");
    });

    for (let i = 0; i < PAGES.length; i++) {
      const p = PAGES[i];
      console.log(`\n[Desktop ${i + 1}/10] 🌐 Membuka: ${p.title}`);
      console.log(`   URL: ${p.url}`);

      try {
        await desktopPage.goto(p.url, { waitUntil: "domcontentloaded", timeout: 45000 });
      } catch (e) {
        console.warn(`   Timeout navigation to ${p.url}, proceeding...`);
      }

      console.log(`   ⏳ Menunggu delay 10 detik agar chart, icon, dan maskot selesai render...`);
      await desktopPage.waitForTimeout(10000);

      // Tutup modal close jika ada
      await desktopPage.evaluate(() => {
        const modalCloses = document.querySelectorAll("button[aria-label='Close'], button[title='Close']");
        modalCloses.forEach((b) => b.click());
      });

      const outPath = path.join(DESKTOP_DIR, p.filename);
      await desktopPage.screenshot({ path: outPath, fullPage: false });
      console.log(`   📸 [OK] Tersimpan: public/desktop/${p.filename}`);
    }

    await desktopContext.close();

    // =========================================================================
    // 2. MOBILE CAPTURES (iPhone 14 Pro: 393 x 852, scale 3x Retina, 10s delay)
    // =========================================================================
    console.log("\n=======================================================");
    console.log("📱 MEMULAI SCREENSHOT MOBILE (public/mobile/)...");
    console.log("⏳ Delay tunggu: 10 DETIK per halaman sebelum capture");
    console.log("=======================================================");

    const mobileContext = await browser.newContext({
      viewport: { width: 393, height: 852 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      storageState: AUTH_FILE,
    });

    const mobilePage = await mobileContext.newPage();

    await mobilePage.addInitScript(() => {
      localStorage.setItem("finiq_tour_welcomed", "true");
      localStorage.setItem("finiq_tour_completed", "true");
    });

    for (let i = 0; i < PAGES.length; i++) {
      const p = PAGES[i];
      console.log(`\n[Mobile ${i + 1}/10] 🌐 Membuka: ${p.title}`);
      console.log(`   URL: ${p.url}`);

      try {
        await mobilePage.goto(p.url, { waitUntil: "domcontentloaded", timeout: 45000 });
      } catch (e) {
        console.warn(`   Timeout navigation to ${p.url}, proceeding...`);
      }

      console.log(`   ⏳ Menunggu delay 10 detik agar tampilan mobile dan navigasi stabil...`);
      await mobilePage.waitForTimeout(10000);

      await mobilePage.evaluate(() => {
        const modalCloses = document.querySelectorAll("button[aria-label='Close'], button[title='Close']");
        modalCloses.forEach((b) => b.click());
      });

      const outPath = path.join(MOBILE_DIR, p.filename);
      await mobilePage.screenshot({ path: outPath, fullPage: false });
      console.log(`   📸 [OK] Tersimpan: public/mobile/${p.filename}`);
    }

    await mobileContext.close();

    console.log("\n=======================================================");
    console.log("🎉 SEMUA 10 FOTO DESKTOP & 10 FOTO MOBILE BERHASIL DICAPTURE DENGAN DELAY 10 DETIK!");
    console.log("=======================================================");
  } finally {
    await browser.close();
  }
}

capture().catch((err) => {
  console.error("Gagal saat capture:", err);
  process.exit(1);
});
