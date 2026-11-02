const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const SHOWCASE_DIR = path.join(PUBLIC_DIR, "promo-showcase");
const FOOTAGE_DIR = path.join(PUBLIC_DIR, "promo-footage");
const JORDAN_AUTH = path.join(ROOT_DIR, "tests", "e2e", ".auth", "jordan.json");
const USER_AUTH = path.join(ROOT_DIR, "tests", "e2e", ".auth", "user.json");
const AUTH_FILE = fs.existsSync(JORDAN_AUTH) ? JORDAN_AUTH : USER_AUTH;

// Subfolders
const FOLDERS = {
  cashflow: path.join(SHOWCASE_DIR, "01_TIGA_KASUS_ARUS_KAS_EKSPRESI_MASCOT"),
  ai: path.join(SHOWCASE_DIR, "02_HIGHLIGHT_FITUR_AI"),
  mascot: path.join(SHOWCASE_DIR, "03_MASCOT_INTERAKTIF_JALAN_DI_PAGE"),
  dualView: path.join(SHOWCASE_DIR, "04_DUAL_VIEW_DESKTOP_DAN_MOBILE_SYNC"),
  intro: path.join(SHOWCASE_DIR, "05_INTRO_KREATIF_KOTA_FINIQ"),
  allFeatures: path.join(SHOWCASE_DIR, "06_SEMUA_FITUR_LENGKAP_FINIQ"),
};

// Ensure directories exist
Object.values(FOLDERS).forEach((f) => {
  if (!fs.existsSync(f)) fs.mkdirSync(f, { recursive: true });
});

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

async function main() {
  console.log("🚀 Memulai proses generate semua screenshot promo Fin.IQ...");
  const browser = await chromium.launch({ headless: true });

  // 1. DESKTOP CONTEXT
  const desktopContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    storageState: fs.existsSync(AUTH_FILE) ? AUTH_FILE : undefined,
  });
  const page = await desktopContext.newPage();

  try {
    console.log("📍 Membuka halaman /overview dengan akun Jordan...");
    await page.goto("http://localhost:3000/overview", { waitUntil: "domcontentloaded", timeout: 45000 });
    // Jeda 4.5 detik agar seluruh komponen, chart, font, dan animasi stabil sepenuhnya
    await wait(4500);

    // =========================================================================
    // BAGIAN 1: 3 KASUS ARUS KAS (MINUS, NETRAL, SURPLUS)
    // =========================================================================
    console.log("📸 Mengambil 3 Kasus Arus Kas dengan jeda stabil...");

    // Helper untuk update UI Overview
    const setScenario = async (type) => {
      await page.evaluate((t) => {
        const saldoEl = document.querySelector("#walker-target-saldo div.text-3xl, #walker-target-saldo div.text-4xl, #walker-target-saldo div.lg\\:text-5xl");
        const incomeEl = document.querySelector("#walker-target-income div.text-base, #walker-target-income div.text-xl");
        const expenseEl = document.querySelector("#walker-target-expense div.text-base, #walker-target-expense div.text-xl");
        const cashflowEl = document.querySelector("#walker-target-cashflow div.text-base, #walker-target-cashflow div.text-xl");
        const roamImg = document.querySelector("div.will-change-transform img");

        if (t === "minus") {
          if (saldoEl) saldoEl.textContent = "-Rp 994.098.333";
          if (incomeEl) {
            incomeEl.textContent = "+Rp 7.744.000";
            incomeEl.className = "text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 truncate";
          }
          if (expenseEl) {
            expenseEl.textContent = "-Rp 1.004.675.593";
            expenseEl.className = "text-base sm:text-xl font-black text-rose-600 dark:text-rose-400 truncate";
          }
          if (cashflowEl) {
            cashflowEl.textContent = "-Rp 996.931.593";
            cashflowEl.className = "text-base sm:text-xl font-black text-rose-600 dark:text-rose-400 truncate";
          }
          if (roamImg) roamImg.src = "/mascot/mascot-rpg-sad.png";
        } else if (t === "netral") {
          if (saldoEl) saldoEl.textContent = "Rp 5.250.000";
          if (incomeEl) {
            incomeEl.textContent = "+Rp 4.500.000";
            incomeEl.className = "text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 truncate";
          }
          if (expenseEl) {
            expenseEl.textContent = "-Rp 4.500.000";
            expenseEl.className = "text-base sm:text-xl font-black text-rose-600 dark:text-rose-400 truncate";
          }
          if (cashflowEl) {
            cashflowEl.textContent = "Rp 0 (Impas)";
            cashflowEl.className = "text-base sm:text-xl font-black text-amber-600 dark:text-amber-400 truncate";
          }
          if (roamImg) roamImg.src = "/mascot/mascot-analisis.png";
        } else if (t === "surplus") {
          if (saldoEl) saldoEl.textContent = "+Rp 18.750.000";
          if (incomeEl) {
            incomeEl.textContent = "+Rp 12.500.000";
            incomeEl.className = "text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 truncate";
          }
          if (expenseEl) {
            expenseEl.textContent = "-Rp 4.250.000";
            expenseEl.className = "text-base sm:text-xl font-black text-rose-600 dark:text-rose-400 truncate";
          }
          if (cashflowEl) {
            cashflowEl.textContent = "+Rp 8.250.000";
            cashflowEl.className = "text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 truncate";
          }
          if (roamImg) roamImg.src = "/mascot/mascot-rpg-cuan.png";
        }
      }, type);
      // Jeda 3 detik setelah ganti skenario agar seluruh render selesai stabil
      await wait(3000);
    };

    // 1. Minus
    await setScenario("minus");
    await page.screenshot({ path: path.join(FOLDERS.cashflow, "01_kasus_minus_boncos_bang_peci.png") });
    console.log("✅ 1. Kasus Minus Boncos selesai.");

    // 2. Netral
    await setScenario("netral");
    await page.screenshot({ path: path.join(FOLDERS.cashflow, "02_kasus_netral_seimbang_bang_peci.png") });
    console.log("✅ 2. Kasus Netral Seimbang selesai.");

    // 3. Surplus
    await setScenario("surplus");
    await page.screenshot({ path: path.join(FOLDERS.cashflow, "03_kasus_surplus_cuan_bang_peci.png") });
    console.log("✅ 3. Kasus Surplus Cuan selesai.");

    // =========================================================================
    // BAGIAN 2: MASCOT INTERAKTIF (JALAN-JALAN DI PAGE & RUMAH KUCING TIDUR)
    // =========================================================================
    console.log("📸 Mengambil aksi Bang Peci Jalan-jalan & Tidur di Kasur...");

    // 1. Bang Peci Berjalan-jalan Patroli
    await page.evaluate(() => {
      const container = document.querySelector("div.will-change-transform");
      if (container) {
        container.style.transform = "translate3d(480px, 320px, 0)";
        container.style.display = "block";
      }
    });
    await wait(2500);
    await page.screenshot({ path: path.join(FOLDERS.mascot, "01_bang_peci_roaming_patroli_dashboard.png") });

    // 2. Bang Peci Tidur di Kasur Pondok Kucing
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const sleepBtn = btns.find((b) => b.textContent.includes("Ajak Tidur"));
      if (sleepBtn) sleepBtn.click();
    });
    await wait(3000);
    await page.screenshot({ path: path.join(FOLDERS.mascot, "02_bang_peci_tidur_pulas_kasur_rumah.png") });

    // Bangunkan kembali
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const wakeBtn = btns.find((b) => b.textContent.includes("Bangunkan"));
      if (wakeBtn) wakeBtn.click();
    });
    await wait(2000);

    // =========================================================================
    // BAGIAN 3: HIGHLIGHT FITUR AI (SUARA, BILLS/STRUK, IMPORT EXCEL)
    // =========================================================================
    console.log("📸 Mengambil Highlight Fitur AI...");

    // Quick Add Modal untuk Suara dan Bills
    await page.evaluate(() => {
      const btn = document.querySelector('[data-tour="quick-add"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Catat Transaksi'));
      if (btn) btn.click();
    });
    await wait(3000);

      // A. Suara AI Dikte
      await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]');
        if (modal) {
          let banner = document.getElementById("ai-voice-demo-banner");
          if (!banner) {
            banner = document.createElement("div");
            banner.id = "ai-voice-demo-banner";
            banner.style.cssText = "margin-bottom: 14px; padding: 14px 18px; border-radius: 14px; background: rgba(5, 150, 105, 0.12); border: 2px solid #059669; display: flex; align-items: center; gap: 14px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.15);";
            banner.innerHTML = `
              <div style="width: 44px; height: 44px; border-radius: 50%; background: #059669; display: flex; align-items: center; justify-content: center; color: white; font-size: 22px; flex-shrink: 0; box-shadow: 0 0 16px rgba(5, 150, 105, 0.5);">🎙️</div>
              <div style="flex: 1;">
                <div style="font-weight: 800; font-size: 14px; color: #047857;">AI Voice Input Aktif: Mendengarkan Dikte Suara...</div>
                <div style="font-size: 13px; color: #065f46; font-style: italic; margin-top: 2px;">"Makan siang ayam geprek sambal matah 25 ribu bayar pakai Blu BCA"</div>
              </div>
              <span style="font-size: 11px; font-weight: 800; background: #059669; color: white; padding: 6px 10px; border-radius: 8px;">Auto Categorized ✨</span>
            `;
            const header = modal.querySelector("h2, div.flex.items-center.justify-between");
            if (header && header.parentElement) {
              header.parentElement.insertBefore(banner, header.nextSibling);
            }
          }
        }
      });
      await wait(2500);
      await page.screenshot({ path: path.join(FOLDERS.ai, "01_ai_voice_dikte_suara_transaksi.png") });

      // B. Bills / Scan Struk OCR
      await page.evaluate(() => {
        const banner = document.getElementById("ai-voice-demo-banner");
        if (banner) {
          banner.style.borderColor = "#2563eb";
          banner.style.background = "rgba(37, 99, 235, 0.12)";
          banner.style.boxShadow = "0 4px 12px rgba(37, 99, 235, 0.15)";
          banner.innerHTML = `
            <div style="width: 44px; height: 44px; border-radius: 50%; background: #2563eb; display: flex; align-items: center; justify-content: center; color: white; font-size: 22px; flex-shrink: 0; box-shadow: 0 0 16px rgba(37, 99, 235, 0.5);">📸</div>
            <div style="flex: 1;">
              <div style="font-weight: 800; font-size: 14px; color: #1d4ed8;">AI Vision OCR: Scan Struk Belanja Kasir</div>
              <div style="font-size: 13px; color: #1e40af; margin-top: 2px;">Merchant: <b>Indomaret Point Stasiun</b> • Total: <b>Rp 87.500</b> • 3 Item Belanja</div>
            </div>
            <span style="font-size: 11px; font-weight: 800; background: #2563eb; color: white; padding: 6px 10px; border-radius: 8px;">OCR Terverifikasi ⚡</span>
          `;
        }
      });
      await wait(2500);
      await page.screenshot({ path: path.join(FOLDERS.ai, "02_ai_bills_ocr_scan_struk.png") });

      // Tutup modal
      await page.keyboard.press("Escape");
      await wait(1500);

    // C. Import Excel & Bank CSV
    console.log("📍 Membuka halaman /import...");
    await page.goto("http://localhost:3000/import", { waitUntil: "domcontentloaded", timeout: 35000 });
    await wait(3500);
    await page.screenshot({ path: path.join(FOLDERS.ai, "03_ai_import_excel_csv_bank.png") });

    // D. AI Advisor Studio
    console.log("📍 Membuka halaman /ai (AI Financial Advisor)...");
    await page.goto("http://localhost:3000/ai", { waitUntil: "domcontentloaded", timeout: 35000 });
    await wait(3500);
    await page.screenshot({ path: path.join(FOLDERS.ai, "04_ai_advisor_studio_konsultasi.png") });

    // =========================================================================
    // BAGIAN 4: SEMUA FITUR LENGKAP LAINNYA DI FIN.IQ
    // =========================================================================
    console.log("📸 Mengambil semua halaman fitur sistem...");

    // 1. Overview Dashboard Utama
    await page.goto("http://localhost:3000/overview", { waitUntil: "domcontentloaded", timeout: 35000 });
    await wait(3500);
    await page.screenshot({ path: path.join(FOLDERS.allFeatures, "01_fitur_overview_dashboard_utama.png") });

    // 2. Multi-Akun
    await page.goto("http://localhost:3000/accounts", { waitUntil: "domcontentloaded", timeout: 35000 });
    await wait(3500);
    await page.screenshot({ path: path.join(FOLDERS.allFeatures, "02_fitur_multi_akun_cash_blu_dana.png") });

    // 3. Budgets / Anggaran
    await page.goto("http://localhost:3000/budgets", { waitUntil: "domcontentloaded", timeout: 35000 });
    await wait(3500);
    await page.screenshot({ path: path.join(FOLDERS.allFeatures, "03_fitur_monitoring_anggaran_budget.png") });

    // 4. Analitik & Grafik Pos
    await page.goto("http://localhost:3000/analytics", { waitUntil: "domcontentloaded", timeout: 35000 });
    await wait(3500);
    await page.screenshot({ path: path.join(FOLDERS.allFeatures, "04_fitur_analisis_grafik_breakdown_pos.png") });

    // 5. Kalender Mutasi
    await page.goto("http://localhost:3000/calendar", { waitUntil: "domcontentloaded", timeout: 35000 });
    await wait(3500);
    await page.screenshot({ path: path.join(FOLDERS.allFeatures, "05_fitur_kalender_mutasi_harian.png") });

    // 6. Import Hub
    await page.goto("http://localhost:3000/import", { waitUntil: "domcontentloaded", timeout: 35000 });
    await wait(3500);
    await page.screenshot({ path: path.join(FOLDERS.allFeatures, "06_fitur_import_mutasi_rekening_csv.png") });

  } catch (err) {
    console.error("❌ Terjadi error saat desktop capture:", err);
  } finally {
    await desktopContext.close();
  }

  // =========================================================================
  // BAGIAN 5: MOBILE PWA IPHONE 13
  // =========================================================================
  console.log("📱 Mengambil Mobile PWA iPhone 13 dengan jeda render...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    storageState: fs.existsSync(AUTH_FILE) ? AUTH_FILE : undefined,
  });
  const mobilePage = await mobileContext.newPage();

  try {
    await mobilePage.goto("http://localhost:3000/overview", { waitUntil: "domcontentloaded", timeout: 35000 });
    await wait(4000);
    await mobilePage.screenshot({ path: path.join(FOLDERS.dualView, "02_mobile_pwa_mockup_perspective.png") });
  } catch (err) {
    console.error("❌ Terjadi error saat mobile capture:", err);
  } finally {
    await mobileContext.close();
  }

  // =========================================================================
  // BAGIAN 6: CINEMATIC COMPOSITES (KOMPARASI 3 KASUS, DUAL VIEW SYNC, INTRO KOTA)
  // =========================================================================
  console.log("🎨 Menghasilkan Cinematic Composite Showcases...");

  const renderContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  });
  const compPage = await renderContext.newPage();

  // A. Komparasi 3 Kasus Side-by-Side (Minus, Netral, Surplus)
  const html3Cases = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
      body {
        width: 1920px; height: 1080px; overflow: hidden;
        background: radial-gradient(circle at 50% 20%, #0d1527 0%, #060913 100%);
        color: white; padding: 60px 80px; display: flex; flex-direction: column; justify-content: space-between;
      }
      .header { text-align: center; }
      .badge {
        display: inline-block; padding: 8px 18px; border-radius: 999px;
        background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35);
        color: #10b981; font-weight: 800; font-size: 14px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 14px;
      }
      h1 { font-size: 44px; font-weight: 900; letter-spacing: -1px; margin-bottom: 8px; }
      p.subtitle { color: #94a3b8; font-size: 20px; font-weight: 500; }
      
      .cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 36px; margin-top: 40px; }
      .case-card {
        background: rgba(255, 255, 255, 0.03); border-radius: 28px; border: 2px solid rgba(255, 255, 255, 0.08);
        padding: 36px 30px; display: flex; flex-direction: column; align-items: center; text-align: center;
        position: relative; backdrop-filter: blur(20px); transition: transform 0.3s ease;
      }
      .case-card.minus { border-color: rgba(244, 63, 94, 0.4); background: linear-gradient(180deg, rgba(244, 63, 94, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%); }
      .case-card.neutral { border-color: rgba(245, 158, 11, 0.4); background: linear-gradient(180deg, rgba(245, 158, 11, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%); }
      .case-card.surplus { border-color: rgba(16, 185, 129, 0.5); background: linear-gradient(180deg, rgba(16, 185, 129, 0.1) 0%, rgba(255, 255, 255, 0.02) 100%); }
      
      .case-tag { font-size: 13px; font-weight: 800; padding: 6px 14px; border-radius: 999px; margin-bottom: 20px; text-transform: uppercase; }
      .case-card.minus .case-tag { background: rgba(244, 63, 94, 0.2); color: #fb7185; }
      .case-card.neutral .case-tag { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
      .case-card.surplus .case-tag { background: rgba(16, 185, 129, 0.2); color: #34d399; }
      
      .mascot-avatar { width: 170px; height: 170px; object-fit: contain; margin-bottom: 24px; filter: drop-shadow(0 14px 20px rgba(0,0,0,0.5)); }
      .val-amount { font-size: 38px; font-weight: 900; letter-spacing: -0.5px; margin-bottom: 12px; }
      .case-card.minus .val-amount { color: #f43f5e; }
      .case-card.neutral .val-amount { color: #f59e0b; }
      .case-card.surplus .val-amount { color: #10b981; }
      
      .speech-bubble {
        background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 18px; padding: 18px 20px; font-size: 15px; line-height: 1.5; color: #e2e8f0; font-weight: 500;
      }
      .footer-note { text-align: center; color: #64748b; font-size: 15px; font-weight: 600; }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="badge">Dynamic Mascot Reactions</div>
      <h1>3 Skenario Arus Kas & Ekspresi Bang Peci</h1>
      <p class="subtitle">Bang Peci merespons kondisi finansialmu secara real-time dengan celetukan & ekspresi adaptif</p>
    </div>

    <div class="cards-grid">
      <!-- 1. MINUS -->
      <div class="case-card minus">
        <div class="case-tag">Kasus 1: Defisit / Arus Kas Minus</div>
        <img class="mascot-avatar" src="http://localhost:3000/mascot/mascot-boncos.png" />
        <div class="val-amount">-Rp 996.931.593</div>
        <div class="speech-bubble">"Waduh arus kas minus Rp 996.931.593. Yuk rem belanja & jajan dulu ya! 💸"</div>
      </div>

      <!-- 2. NETRAL -->
      <div class="case-card neutral">
        <div class="case-tag">Kasus 2: Impas / Arus Kas Seimbang</div>
        <img class="mascot-avatar" src="http://localhost:3000/mascot/mascot-stabil.png" />
        <div class="val-amount">Rp 0 (Impas)</div>
        <div class="speech-bubble">"Arus kas pas seimbang nih bos! Pemasukan & pengeluaran sama kuat. Tetap disiplin catat transaksi ya! ⚖️"</div>
      </div>

      <!-- 3. SURPLUS -->
      <div class="case-card surplus">
        <div class="case-tag">Kasus 3: Cuan / Arus Kas Positif</div>
        <img class="mascot-avatar" src="http://localhost:3000/mascot/mascot-cuan.png" />
        <div class="val-amount">+Rp 8.250.000</div>
        <div class="speech-bubble">"Alhamdulillah surplus Rp 8.250.000! Tabungan makin tebal, cuan berkah, mantap bos! 💰✨"</div>
      </div>
    </div>

    <div class="footer-note">Fin.IQ Smart Financial Assistant • Real-Time Financial Emotion Engine</div>
  </body>
  </html>
  `;
  await compPage.setContent(html3Cases);
  await wait(1000);
  await compPage.screenshot({ path: path.join(FOLDERS.cashflow, "04_komparasi_3_kasus_side_by_side.png") });
  console.log("✅ 04_komparasi_3_kasus_side_by_side.png selesai.");

  // B. Dual View Desktop Laptop & Mobile PWA Sync (Konsep C + Konsep A)
  const htmlDualView = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
      body {
        width: 1920px; height: 1080px; overflow: hidden;
        background: radial-gradient(circle at 50% 30%, #0e1e38 0%, #060913 100%);
        color: white; padding: 40px 60px; display: flex; flex-direction: column; justify-content: space-between;
      }
      .top-bar { display: flex; justify-content: space-between; align-items: center; }
      .brand { display: flex; align-items: center; gap: 14px; }
      .brand-logo { width: 44px; height: 44px; border-radius: 12px; background: #059669; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; }
      .brand-text { font-size: 26px; font-weight: 900; }
      .sync-pill {
        display: flex; align-items: center; gap: 10px; padding: 10px 22px; border-radius: 999px;
        background: rgba(16, 185, 129, 0.15); border: 1.5px solid rgba(16, 185, 129, 0.4);
        color: #34d399; font-weight: 800; font-size: 15px; animation: pulse 2s infinite;
      }
      
      .devices-stage {
        flex: 1; display: flex; align-items: center; justify-content: center; gap: 40px; position: relative; margin-top: 10px;
      }
      
      /* Laptop Frame */
      .laptop-wrapper {
        width: 1050px; height: 620px; background: #1e293b; border-radius: 20px; padding: 14px 14px 28px 14px;
        box-shadow: 0 30px 80px rgba(0,0,0,0.8), 0 0 40px rgba(16, 185, 129, 0.15); border: 2px solid rgba(255, 255, 255, 0.12);
        position: relative; display: flex; flex-direction: column;
      }
      .laptop-screen {
        width: 100%; flex: 1; border-radius: 12px; overflow: hidden; background: #0f172a; position: relative;
      }
      .laptop-screen img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
      .laptop-notch { width: 120px; height: 10px; background: #0f172a; border-radius: 0 0 10px 10px; position: absolute; top: 14px; left: 50%; transform: translateX(-50%); z-index: 10; }
      
      /* Mobile Frame (iPhone 13) */
      .phone-wrapper {
        width: 320px; height: 650px; background: #020617; border-radius: 46px; padding: 12px;
        box-shadow: 0 30px 80px rgba(0,0,0,0.9), 0 0 35px rgba(59, 130, 246, 0.25); border: 4px solid #334155;
        position: relative; display: flex; flex-direction: column;
      }
      .phone-screen {
        width: 100%; flex: 1; border-radius: 36px; overflow: hidden; background: #0f172a; position: relative;
      }
      .phone-screen img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
      .phone-island { width: 110px; height: 22px; background: #020617; border-radius: 20px; position: absolute; top: 20px; left: 50%; transform: translateX(-50%); z-index: 10; }
      
      /* Mascot walking between devices */
      .mascot-traveler {
        position: absolute; right: 280px; bottom: 40px; width: 220px; height: 220px; z-index: 30;
        filter: drop-shadow(0 20px 30px rgba(0,0,0,0.7)); animation: bounce 2s infinite ease-in-out;
      }
      .mascot-bubble {
        position: absolute; right: 240px; bottom: 250px; background: #059669; color: white; padding: 12px 18px;
        border-radius: 16px; font-weight: 800; font-size: 14px; box-shadow: 0 10px 25px rgba(5, 150, 105, 0.5); z-index: 35;
      }
      
      .bottom-info {
        display: flex; justify-content: space-between; align-items: center; padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.1); font-size: 15px; color: #94a3b8; font-weight: 600;
      }
      .features-row { display: flex; gap: 24px; color: #e2e8f0; }
      .feat-item { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="top-bar">
      <div class="brand">
        <div class="brand-logo">IQ</div>
        <div class="brand-text">Fin.IQ Cross-Platform Sync</div>
      </div>
      <div class="sync-pill">
        <span>⚡ Real-Time Cloud Sync: Mobile PWA ⟷ Desktop Web</span>
      </div>
    </div>

    <div class="devices-stage">
      <!-- Laptop Desktop Screen -->
      <div class="laptop-wrapper">
        <div class="laptop-notch"></div>
        <div class="laptop-screen">
          <img src="http://localhost:3000/promo-showcase/06_SEMUA_FITUR_LENGKAP_FINIQ/01_fitur_overview_dashboard_utama.png" />
        </div>
      </div>

      <!-- Smartphone Mobile Screen -->
      <div class="phone-wrapper">
        <div class="phone-island"></div>
        <div class="phone-screen">
          <img src="http://localhost:3000/promo-showcase/04_DUAL_VIEW_DESKTOP_DAN_MOBILE_SYNC/02_mobile_pwa_mockup_perspective.png" />
        </div>
      </div>

      <!-- Bang Peci Crossing -->
      <div class="mascot-bubble">"Catat di HP, otomatis update di Desktop! 🚀"</div>
      <img class="mascot-traveler" src="http://localhost:3000/mascot/mascot-cuan.png" />
    </div>

    <div class="bottom-info">
      <div>Konsep A (Maskot Petualang) + Konsep C (Dual-Screen Sync Multi-Device)</div>
      <div class="features-row">
        <div class="feat-item">🎙️ Dikte Suara AI</div>
        <div class="feat-item">📸 Bills OCR</div>
        <div class="feat-item">📊 Import Excel</div>
        <div class="feat-item">🐾 Maskot Interaktif</div>
      </div>
    </div>
  </body>
  </html>
  `;
  await compPage.setContent(htmlDualView);
  await wait(1200);
  await compPage.screenshot({ path: path.join(FOLDERS.dualView, "01_dual_view_desktop_laptop_dan_mobile_sync.png") });
  console.log("✅ 01_dual_view_desktop_laptop_dan_mobile_sync.png selesai.");

  // C. Intro Kreatif: Kota Fin.IQ Malam Hari & Bang Peci 3D
  const htmlIntroCity = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
      body {
        width: 1920px; height: 1080px; overflow: hidden;
        background: linear-gradient(135deg, #070b19 0%, #0a1733 50%, #05242d 100%);
        color: white; position: relative; display: flex; flex-direction: column; justify-content: space-between; padding: 60px 80px;
      }
      
      /* Neon Grid Floor */
      .grid-floor {
        position: absolute; bottom: 0; left: -50%; width: 200%; height: 450px;
        background-image: 
          linear-gradient(rgba(16, 185, 129, 0.25) 1px, transparent 1px),
          linear-gradient(90deg, rgba(16, 185, 129, 0.25) 1px, transparent 1px);
        background-size: 60px 60px;
        transform: perspective(600px) rotateX(65deg);
        transform-origin: bottom center;
        mask-image: linear-gradient(to top, rgba(0,0,0,1) 30%, transparent 100%);
      }
      
      /* City Skyline silhouettes */
      .city-skyline {
        position: absolute; bottom: 180px; left: 0; right: 0; height: 350px;
        display: flex; align-items: flex-end; justify-content: space-around; opacity: 0.25; z-index: 1;
      }
      .building { background: #1e293b; border-radius: 6px 6px 0 0; }
      
      /* Illuminated Fin.IQ Billboard */
      .billboard-container {
        position: absolute; top: 120px; right: 180px; width: 620px; height: 380px;
        background: rgba(15, 23, 42, 0.8); border: 3px solid #10b981; border-radius: 28px;
        box-shadow: 0 0 60px rgba(16, 185, 129, 0.4), inset 0 0 30px rgba(16, 185, 129, 0.2);
        padding: 24px; z-index: 5; display: flex; flex-direction: column; justify-content: space-between;
        backdrop-filter: blur(15px);
      }
      .billboard-header { display: flex; justify-content: space-between; align-items: center; }
      .billboard-tag { background: #10b981; color: #022c22; font-weight: 900; font-size: 13px; padding: 6px 14px; border-radius: 8px; text-transform: uppercase; }
      .billboard-title { font-size: 32px; font-weight: 900; line-height: 1.2; margin-top: 10px; }
      .billboard-stat { font-size: 42px; font-weight: 900; color: #34d399; margin: 10px 0; }
      .billboard-footer { font-size: 14px; color: #94a3b8; font-weight: 600; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px; }
      
      /* Mascot 3D walking on the futuristic city floor */
      .mascot-3d {
        position: absolute; bottom: 80px; left: 240px; width: 420px; height: 420px; z-index: 10;
        filter: drop-shadow(0 25px 35px rgba(0,0,0,0.8));
      }
      
      .hero-copy { max-width: 780px; z-index: 10; margin-top: 40px; }
      .badge { display: inline-block; padding: 8px 18px; border-radius: 999px; background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.4); color: #60a5fa; font-weight: 800; font-size: 14px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 20px; }
      h1 { font-size: 64px; font-weight: 900; line-height: 1.1; letter-spacing: -2px; margin-bottom: 20px; }
      h1 span { background: linear-gradient(90deg, #10b981, #38bdf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      p.desc { font-size: 22px; color: #94a3b8; line-height: 1.5; font-weight: 500; }
      
      .pills-bar { display: flex; gap: 16px; margin-top: 36px; }
      .pill { background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); padding: 12px 22px; border-radius: 14px; font-weight: 700; font-size: 16px; backdrop-filter: blur(10px); }
      
      .floating-coin { position: absolute; font-size: 50px; z-index: 6; filter: drop-shadow(0 10px 15px rgba(0,0,0,0.5)); }
    </style>
  </head>
  <body>
    <div class="grid-floor"></div>

    <!-- City Skyline -->
    <div class="city-skyline">
      <div class="building" style="width: 140px; height: 260px;"></div>
      <div class="building" style="width: 90px; height: 340px;"></div>
      <div class="building" style="width: 180px; height: 220px;"></div>
      <div class="building" style="width: 120px; height: 380px;"></div>
      <div class="building" style="width: 160px; height: 280px;"></div>
      <div class="building" style="width: 100px; height: 310px;"></div>
    </div>

    <!-- Floating Coins -->
    <div class="floating-coin" style="top: 180px; left: 140px;">🪙</div>
    <div class="floating-coin" style="top: 90px; right: 120px;">✨</div>
    <div class="floating-coin" style="top: 480px; right: 860px;">💎</div>

    <!-- Billboard Fin.IQ -->
    <div class="billboard-container">
      <div class="billboard-header">
        <div class="billboard-tag">LIVE METRICS BILLBOARD</div>
        <span style="color: #10b981; font-size: 18px;">● LIVE</span>
      </div>
      <div>
        <div class="billboard-title">Fin.IQ Cash Flow Engine</div>
        <div class="billboard-stat">+Rp 3.500.000</div>
        <p style="color: #cbd5e1; font-size: 15px;">Alhamdulillah Surplus! Arus kas positif terkontrol rapi.</p>
      </div>
      <div class="billboard-footer">
        Asisten Finansial Pintar • Didampingi Maskot Bang Peci 🐾
      </div>
    </div>

    <!-- Copywriting Kiri -->
    <div class="hero-copy">
      <div class="badge">Next-Gen FinTech Experience</div>
      <h1>Kelola Keuangan Jadi Hidup dengan <span>Fin.IQ</span></h1>
      <p class="desc">Aplikasi finansial personal pertama dengan kecerdasan AI suara, scanner struk kasir otomatis, impor mutasi bank, dan maskot interaktif yang menemani setiap langkah keuanganmu.</p>
      
      <div class="pills-bar">
        <div class="pill">🎙️ Dikte Suara AI</div>
        <div class="pill">📸 Scan Struk OCR</div>
        <div class="pill">📊 Import Excel & CSV</div>
        <div class="pill">🏡 Pondok & Kasur Kucing</div>
      </div>
    </div>

    <!-- 3D Mascot Walking Into The City -->
    <img class="mascot-3d" src="http://localhost:3000/mascot/mascot-halo.png" />
  </body>
  </html>
  `;
  await compPage.setContent(htmlIntroCity);
  await wait(1200);
  await compPage.screenshot({ path: path.join(FOLDERS.intro, "01_intro_sinematik_kota_malam_finiq.png") });
  console.log("✅ 01_intro_sinematik_kota_malam_finiq.png selesai.");

  // D. Full Character Sprite & Emotion Catalogue Bang Peci
  const htmlCatalogue = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
      body {
        width: 1920px; height: 1080px; overflow: hidden;
        background: radial-gradient(circle at 50% 20%, #111c33 0%, #060913 100%);
        color: white; padding: 50px 80px; display: flex; flex-direction: column; justify-content: space-between;
      }
      .header { text-align: center; }
      .badge { display: inline-block; padding: 8px 18px; border-radius: 999px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); color: #10b981; font-weight: 800; font-size: 14px; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; }
      h1 { font-size: 42px; font-weight: 900; margin-bottom: 6px; }
      p.sub { font-size: 18px; color: #94a3b8; }
      
      .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-top: 30px; }
      .sprite-card {
        background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px;
        padding: 22px; display: flex; flex-direction: column; align-items: center; text-align: center; backdrop-filter: blur(10px);
      }
      .sprite-img { width: 120px; height: 120px; object-fit: contain; margin-bottom: 14px; filter: drop-shadow(0 10px 14px rgba(0,0,0,0.5)); }
      .sprite-name { font-size: 17px; font-weight: 800; margin-bottom: 4px; color: #f8fafc; }
      .sprite-role { font-size: 13px; color: #38bdf8; font-weight: 700; margin-bottom: 8px; }
      .sprite-desc { font-size: 12px; color: #94a3b8; line-height: 1.4; }
      
      .footer { text-align: center; color: #64748b; font-size: 14px; font-weight: 600; }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="badge">Interactive Mascot Engine</div>
      <h1>Katalog Sprite &amp; Ragam Ekspresi Bang Peci</h1>
      <p class="sub">Setiap aksi pengguna dan perubahan arus kas mengaktifkan emosi maskot yang hidup</p>
    </div>

    <div class="grid">
      <!-- 1 -->
      <div class="sprite-card">
        <img class="sprite-img" src="http://localhost:3000/mascot/mascot-cuan.png" />
        <div class="sprite-name">Surplus Cuan</div>
        <div class="sprite-role">Koin Emas & Jempol</div>
        <div class="sprite-desc">Tampil bangga saat arus kas bulanan positif dan tabungan meningkat.</div>
      </div>
      <!-- 2 -->
      <div class="sprite-card">
        <img class="sprite-img" src="http://localhost:3000/mascot/mascot-boncos.png" />
        <div class="sprite-name">Peringatan Boncos</div>
        <div class="sprite-role">Pusing Pegang Kepala</div>
        <div class="sprite-desc">Aktif saat pengeluaran melebihi pemasukan untuk memberi sinyal waspada.</div>
      </div>
      <!-- 3 -->
      <div class="sprite-card">
        <img class="sprite-img" src="http://localhost:3000/mascot/mascot-stabil.png" />
        <div class="sprite-name">Kas Seimbang</div>
        <div class="sprite-role">Kacamata Analis</div>
        <div class="sprite-desc">Menganalisis kondisi kas impas dan memberikan saran pos tabungan.</div>
      </div>
      <!-- 4 -->
      <div class="sprite-card">
        <img class="sprite-img" src="http://localhost:3000/mascot/cat-house-sleeping.png" />
        <div class="sprite-name">Tidur di Pondok</div>
        <div class="sprite-role">Rebahan di Kasur Bulat</div>
        <div class="sprite-desc">Mendengkur Zzz santai saat istirahat dan siap dibangunkan kapan saja.</div>
      </div>
      <!-- 5 -->
      <div class="sprite-card">
        <img class="sprite-img" src="http://localhost:3000/mascot/mascot-rpg-walk-step1.png" />
        <div class="sprite-name">Animasi Jalan 1</div>
        <div class="sprite-role">Langkah Kaki Kanan</div>
        <div class="sprite-desc">Sprite RPG 2D saat berpatroli menjelajahi halaman dashboard.</div>
      </div>
      <!-- 6 -->
      <div class="sprite-card">
        <img class="sprite-img" src="http://localhost:3000/mascot/mascot-rpg-walk-step2.png" />
        <div class="sprite-name">Animasi Jalan 2</div>
        <div class="sprite-role">Langkah Kaki Kiri</div>
        <div class="sprite-desc">Gerakan GPU translate3d halus dengan bayangan kaki realistis.</div>
      </div>
      <!-- 7 -->
      <div class="sprite-card">
        <img class="sprite-img" src="http://localhost:3000/mascot/mascot-rpg-wave.png" />
        <div class="sprite-name">Salam Ramah</div>
        <div class="sprite-role">Melambaikan Tangan</div>
        <div class="sprite-desc">Menyambut user saat pertama kali membuka aplikasi dan tur panduan.</div>
      </div>
      <!-- 8 -->
      <div class="sprite-card">
        <img class="sprite-img" src="http://localhost:3000/mascot/cat-house-empty.png" />
        <div class="sprite-name">Kasur Kosong</div>
        <div class="sprite-role">Pondok Standby</div>
        <div class="sprite-desc">Dropzone aktif menyala saat Bang Peci di-drag untuk diajak tidur.</div>
      </div>
    </div>

    <div class="footer">Fin.IQ Character Engine • 100% Interaktif & Responsif</div>
  </body>
  </html>
  `;
  await compPage.setContent(htmlCatalogue);
  await wait(1200);
  await compPage.screenshot({ path: path.join(FOLDERS.mascot, "04_bang_peci_katalog_ekspresi_lengkap.png") });
  console.log("✅ 04_bang_peci_katalog_ekspresi_lengkap.png selesai.");

  await renderContext.close();
  await browser.close();
  console.log("🎉 SEMUA FOTO SHOWCASE BERHASIL DIGENERATE & DISIMPAN!");
}

main().catch(console.error);
