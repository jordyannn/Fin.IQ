const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const BASE_OUTPUT_DIR = path.join(ROOT_DIR, "public", "promo-footage");
const AUTH_FILE = path.join(ROOT_DIR, "tests", "e2e", ".auth", "user.json");
const MASCOT_DIR = path.join(ROOT_DIR, "public", "mascot");
const MOBILE_DIR = path.join(ROOT_DIR, "public", "mobile-screenshots");

const DIRS = {
  mascot: path.join(BASE_OUTPUT_DIR, "01_MASCOT_EKSPRESI_LUCU"),
  mascotSurplus: path.join(BASE_OUTPUT_DIR, "01_MASCOT_EKSPRESI_LUCU", "SURPLUS_CUAN"),
  mascotMinus: path.join(BASE_OUTPUT_DIR, "01_MASCOT_EKSPRESI_LUCU", "MINUS_BONCOS"),
  mascotAction: path.join(BASE_OUTPUT_DIR, "01_MASCOT_EKSPRESI_LUCU", "ANIMASI_RUTIN"),
  cashflow: path.join(BASE_OUTPUT_DIR, "02_FITUR_AGEN_CASHFLOW"),
  aiAdvisor: path.join(BASE_OUTPUT_DIR, "03_FITUR_AI_ADVISOR"),
  voice: path.join(BASE_OUTPUT_DIR, "04_FITUR_VOICE_TRANSACTION"),
  fotoBills: path.join(BASE_OUTPUT_DIR, "05_FITUR_FOTO_BILLS_OCR"),
  dualView: path.join(BASE_OUTPUT_DIR, "06_DUAL_VIEW_DESKTOP_MOBILE"),
  allFeatures: path.join(BASE_OUTPUT_DIR, "07_FITUR_LENGKAP_LAINNYA"),
};

// Ensure all directories exist
Object.values(DIRS).forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const copyFile = (src, dest) => {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied: ${path.basename(dest)}`);
  } else {
    console.warn(`File not found: ${src}`);
  }
};

async function organizeMascotAssets() {
  console.log("Organizing Mascot Expressive States (Surplus, Minus, Action)...");

  // SURPLUS & CUAN
  copyFile(path.join(MASCOT_DIR, "mascot-cuan.png"), path.join(DIRS.mascotSurplus, "bang_peci_cuan_koin_emas.png"));
  copyFile(path.join(MASCOT_DIR, "mascot-rpg-cuan.png"), path.join(DIRS.mascotSurplus, "bang_peci_badge_cuan_gemerlap.png"));
  copyFile(path.join(MASCOT_DIR, "mascot-rpg-happy.png"), path.join(DIRS.mascotSurplus, "bang_peci_senyum_bahagia.png"));
  copyFile(path.join(MASCOT_DIR, "mascot-hemat.png"), path.join(DIRS.mascotSurplus, "bang_peci_hemat_senyum.png"));
  copyFile(path.join(MASCOT_DIR, "mascot-analisis.png"), path.join(DIRS.mascotSurplus, "bang_peci_analisis_kacamata.png"));
  copyFile(path.join(MASCOT_DIR, "mascot-stabil.png"), path.join(DIRS.mascotSurplus, "bang_peci_kas_seimbang.png"));
  copyFile(path.join(MASCOT_DIR, "mascot-halo.png"), path.join(DIRS.mascotSurplus, "bang_peci_salam_ramah.png"));

  // MINUS & BONCOS
  copyFile(path.join(MASCOT_DIR, "mascot-boncos.png"), path.join(DIRS.mascotMinus, "bang_peci_boncos_pegang_kepala.png"));
  copyFile(path.join(MASCOT_DIR, "mascot-sedih.png"), path.join(DIRS.mascotMinus, "bang_peci_sedih_menangis_defisit.png"));
  copyFile(path.join(MASCOT_DIR, "mascot-bingung.png"), path.join(DIRS.mascotMinus, "bang_peci_bingung_dompet_kering.png"));
  copyFile(path.join(MASCOT_DIR, "mascot-tech-warning.png"), path.join(DIRS.mascotMinus, "bang_peci_warning_ekor_tegang.png"));
  copyFile(path.join(MASCOT_DIR, "mascot-rpg-sad.png"), path.join(DIRS.mascotMinus, "bang_peci_rpg_kecewa.png"));

  // ACTION & RUTIN
  copyFile(path.join(MASCOT_DIR, "cat-house-sleeping.png"), path.join(DIRS.mascotAction, "bang_peci_tidur_pulas_kasur.png"));
  copyFile(path.join(MASCOT_DIR, "cat-house-empty.png"), path.join(DIRS.mascotAction, "kasur_kucing_kosong.png"));
  copyFile(path.join(MASCOT_DIR, "mascot-rpg-walk-step1.png"), path.join(DIRS.mascotAction, "bang_peci_jalan_step1.png"));
  copyFile(path.join(MASCOT_DIR, "mascot-rpg-walk-step2.png"), path.join(DIRS.mascotAction, "bang_peci_jalan_step2.png"));
  copyFile(path.join(MASCOT_DIR, "mascot-rpg-wave.png"), path.join(DIRS.mascotAction, "bang_peci_melambaikan_tangan.png"));
  copyFile(path.join(MASCOT_DIR, "mascot-logo.png"), path.join(DIRS.mascotAction, "logo_bang_peci_official.png"));
}

async function captureAllFootage() {
  console.log("Launching Chromium to capture ALL live system features...");
  const browser = await chromium.launch({ headless: true });

  // 1. DESKTOP CONTEXT (1920x1080)
  const desktopContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    storageState: fs.existsSync(AUTH_FILE) ? AUTH_FILE : undefined,
  });
  const page = await desktopContext.newPage();

  try {
    // A. OVERVIEW & CASHFLOW
    console.log("Capturing Desktop: /overview...");
    await page.goto("http://localhost:3000/overview", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    // Full Overview
    await page.screenshot({ path: path.join(DIRS.dualView, "desktop_overview_full_dashboard.png") });
    await page.screenshot({ path: path.join(DIRS.cashflow, "desktop_overview_dashboard.png") });

    // Crop Net Cashflow Card
    const cashflowEl = await page.$("#walker-target-cashflow, [data-tour='overview-hero']");
    if (cashflowEl) {
      await cashflowEl.screenshot({ path: path.join(DIRS.cashflow, "desktop_card_net_cashflow_surplus.png") });
    }

    // Crop Bang Peci Interactive Mood Card
    const mascotMoodEl = await page.$("button[title*='Bang Peci']");
    if (mascotMoodEl) {
      const parentCard = await mascotMoodEl.evaluateHandle((el) => el.closest("div.relative.group") || el);
      if (parentCard) {
        await parentCard.screenshot({ path: path.join(DIRS.cashflow, "desktop_bang_peci_interactive_mood_card.png") });
      }
    }

    // B. VOICE TRANSACTION & FOTO BILLS MODAL
    console.log("Opening Quick Add Modal for Voice & Bills...");
    const quickAddBtn = await page.$('[data-tour="quick-add"]');
    if (quickAddBtn) {
      await quickAddBtn.click();
      await page.waitForTimeout(1000);

      // Full modal screenshot
      const modalDialog = await page.$('[role="dialog"]');
      if (modalDialog) {
        await modalDialog.screenshot({ path: path.join(DIRS.voice, "desktop_modal_catat_transaksi.png") });
        await modalDialog.screenshot({ path: path.join(DIRS.fotoBills, "desktop_modal_catat_transaksi.png") });
      }

      // Crop AI toolbar (Voice & Bills)
      const aiToolbar = await page.$('[data-tour="modal-ai-tools"]');
      if (aiToolbar) {
        await aiToolbar.screenshot({ path: path.join(DIRS.voice, "desktop_toolbar_dikte_suara_ai.png") });
        await aiToolbar.screenshot({ path: path.join(DIRS.fotoBills, "desktop_toolbar_kamera_galeri_struk.png") });
      }

      // Close modal
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // C. AI ADVISOR PAGE (/ai)
    console.log("Capturing Desktop: /ai (AI Advisor)...");
    await page.goto("http://localhost:3000/ai", { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(DIRS.aiAdvisor, "desktop_ai_advisor_studio_full.png") });

    // Crop AI Suggestion Chips (Audit Pos Boros, Batas Belanja Harian)
    const suggestionsGrid = await page.$("div.grid");
    if (suggestionsGrid) {
      await suggestionsGrid.screenshot({ path: path.join(DIRS.aiAdvisor, "desktop_ai_advisor_prompt_chips.png") });
    }

    // D. ACCOUNTS MANAGEMENT (/accounts)
    console.log("Capturing Desktop: /accounts...");
    await page.goto("http://localhost:3000/accounts", { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(DIRS.allFeatures, "desktop_accounts_cash_blu_dana.png") });

    // E. BUDGET MONITORING (/budgets)
    console.log("Capturing Desktop: /budgets...");
    await page.goto("http://localhost:3000/budgets", { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(DIRS.allFeatures, "desktop_budgets_progress_monitoring.png") });

    // F. ANALYTICS & REPORTS (/analytics)
    console.log("Capturing Desktop: /analytics...");
    await page.goto("http://localhost:3000/analytics", { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(DIRS.allFeatures, "desktop_analytics_breakdown_pos.png") });

    // G. CALENDAR TRANSACTIONS (/calendar)
    console.log("Capturing Desktop: /calendar...");
    await page.goto("http://localhost:3000/calendar", { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(DIRS.allFeatures, "desktop_calendar_mutasi_harian.png") });

    // H. IMPORT HUB (/import)
    console.log("Capturing Desktop: /import...");
    await page.goto("http://localhost:3000/import", { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(DIRS.allFeatures, "desktop_import_bank_csv_ocr.png") });

  } catch (err) {
    console.error("Desktop capture error:", err.message);
  } finally {
    await desktopContext.close();
  }

  // 2. MOBILE CONTEXT (iPhone 13 - 390x844)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    storageState: fs.existsSync(AUTH_FILE) ? AUTH_FILE : undefined,
  });
  const mobilePage = await mobileContext.newPage();

  try {
    console.log("Capturing Mobile PWA: /overview...");
    await mobilePage.goto("http://localhost:3000/overview", { waitUntil: "networkidle", timeout: 30000 });
    await mobilePage.waitForTimeout(2000);
    await mobilePage.screenshot({ path: path.join(DIRS.dualView, "mobile_overview_pwa_screen.png") });
    await mobilePage.screenshot({ path: path.join(DIRS.cashflow, "mobile_overview_cashflow.png") });

    // Open Quick Add on mobile
    const mobileAddBtn = await mobilePage.$('button:has(svg.lucide-plus), button[title*="Catat"], [data-tour="quick-add"]');
    if (mobileAddBtn) {
      await mobileAddBtn.click();
      await mobilePage.waitForTimeout(1000);
      await mobilePage.screenshot({ path: path.join(DIRS.voice, "mobile_voice_quick_add_modal.png") });
      await mobilePage.screenshot({ path: path.join(DIRS.fotoBills, "mobile_bills_quick_add_modal.png") });
      await mobilePage.keyboard.press("Escape");
    }

    // Mobile AI Advisor
    console.log("Capturing Mobile: /ai...");
    await mobilePage.goto("http://localhost:3000/ai", { waitUntil: "networkidle", timeout: 20000 });
    await mobilePage.waitForTimeout(1500);
    await mobilePage.screenshot({ path: path.join(DIRS.aiAdvisor, "mobile_ai_advisor_chat.png") });

    // Mobile Budgets & Accounts
    await mobilePage.goto("http://localhost:3000/budgets", { waitUntil: "networkidle", timeout: 20000 });
    await mobilePage.waitForTimeout(1000);
    await mobilePage.screenshot({ path: path.join(DIRS.allFeatures, "mobile_budgets_monitoring.png") });

    await mobilePage.goto("http://localhost:3000/accounts", { waitUntil: "networkidle", timeout: 20000 });
    await mobilePage.waitForTimeout(1000);
    await mobilePage.screenshot({ path: path.join(DIRS.allFeatures, "mobile_accounts_cash_blu_dana.png") });

  } catch (err) {
    console.error("Mobile capture error:", err.message);
  } finally {
    await mobileContext.close();
  }

  await browser.close();
}

function generateMasterIndex() {
  const readme = `================================================================================
KATALOG LENGKAP FOOTAGE FIN.IQ UNTUK GENERATE DI GOOGLE GEMINI / VIDS / VEO
Folder Root: public/promo-footage/
================================================================================

Folder ini telah ditata secara modular per fitur & ekspresi:

📁 01_MASCOT_EKSPRESI_LUCU/
   ├── SURPLUS_CUAN/
   │   ├── bang_peci_cuan_koin_emas.png       (Bang Peci tersenyum bangga pegang koin emas)
   │   ├── bang_peci_badge_cuan_gemerlap.png   (Badge koin emas melayang)
   │   ├── bang_peci_senyum_bahagia.png        (Muka bahagia berseri-seri)
   │   ├── bang_peci_hemat_senyum.png          (Ekspresi hemat bijak)
   │   ├── bang_peci_analisis_kacamata.png     (Kacamata analis data keuangan)
   │   ├── bang_peci_kas_seimbang.png          (Ekspresi stabil netral)
   │   └── bang_peci_salam_ramah.png           (Melambaikan tangan menyapa)
   ├── MINUS_BONCOS/
   │   ├── bang_peci_boncos_pegang_kepala.png  (Pusing pegang kepala, panik saldo tipis)
   │   ├── bang_peci_sedih_menangis_defisit.png(Menangis sedih arus kas bocor)
   │   ├── bang_peci_bingung_dompet_kering.png (Mata cengo uang habis ghaib)
   │   ├── bang_peci_warning_ekor_tegang.png   (Tanda seru waspada, ekor tegang kasih warning)
   │   └── bang_peci_rpg_kecewa.png            (Kecewa melihat belanja impulsif)
   └── ANIMASI_RUTIN/
       ├── bang_peci_tidur_pulas_kasur.png     (Tidur mendengkur Zzz di kasur bulat)
       ├── kasur_kucing_kosong.png             (Kasur kosong saat Bang Peci melompat bangun)
       ├── bang_peci_jalan_step1.png           (Kaki melangkah animasi jalan)
       ├── bang_peci_jalan_step2.png           (Kaki melangkah langkah kedua)
       └── logo_bang_peci_official.png         (Badge logo resmi)

📁 02_FITUR_AGEN_CASHFLOW/
   ├── desktop_overview_dashboard.png          (Dashboard lengkap analitik kas)
   ├── desktop_card_net_cashflow_surplus.png   (Zoom kartu metrik Net Cash Flow)
   ├── desktop_bang_peci_interactive_mood_card.png (Card mood: "Alhamdulillah surplus Rp 3.500.000!")
   └── mobile_overview_cashflow.png            (Tampilan arus kas di layar smartphone)

📁 03_FITUR_AI_ADVISOR/
   ├── desktop_ai_advisor_studio_full.png      (Layar studio AI konsultasi keuangan)
   ├── desktop_ai_advisor_prompt_chips.png     (Chips: Audit Pos Boros, Batas Belanja Harian, Alokasi Tabungan)
   └── mobile_ai_advisor_chat.png              (Chat AI konsultasi di smartphone)

📁 04_FITUR_VOICE_TRANSACTION/
   ├── desktop_modal_catat_transaksi.png       (Dialog input transaksi dengan mic AI)
   ├── desktop_toolbar_dikte_suara_ai.png      (Zoom tombol Dikte Suara dengan ikon Mic)
   └── mobile_voice_quick_add_modal.png        (Input suara versi mobile)

📁 05_FITUR_FOTO_BILLS_OCR/
   ├── desktop_modal_catat_transaksi.png       (Modal dengan tombol Kamera & Galeri Struk)
   ├── desktop_toolbar_kamera_galeri_struk.png (Zoom tombol Kamera & Galeri)
   └── mobile_bills_quick_add_modal.png        (Scan struk versi mobile PWA)

📁 06_DUAL_VIEW_DESKTOP_MOBILE/
   ├── desktop_overview_full_dashboard.png     (1920x1080 Retina Desktop Dashboard)
   └── mobile_overview_pwa_screen.png          (Mobile PWA responsif iPhone 13)

📁 07_FITUR_LENGKAP_LAINNYA/
   ├── desktop_budgets_progress_monitoring.png (Monitoring anggaran dengan batas belanja progress bar)
   ├── desktop_accounts_cash_blu_dana.png      (Multi-rekening: Cash, Blu BCA, Dana)
   ├── desktop_analytics_breakdown_pos.png     (Laporan & diagram persentase pengeluaran)
   ├── desktop_calendar_mutasi_harian.png      (Kalender mutasi transaksi harian)
   ├── desktop_import_bank_csv_ocr.png         (Hub impor file CSV dan mutasi rekening)
   ├── mobile_budgets_monitoring.png           (Anggaran versi smartphone)
   └── mobile_accounts_cash_blu_dana.png       (Multi-akun versi smartphone)

================================================================================
PETUNJUK PROMPT DI GOOGLE GEMINI:
Buka folder terkait, upload gambar screenshot-nya ke Gemini, lalu ketik prompt:
"Animate this UI screen and combine with the mascot character. Make the mascot react expressively to the financial data. Format 9:16 vertical video."
================================================================================
`;

  fs.writeFileSync(path.join(BASE_OUTPUT_DIR, "INDEX_KATALOG_FOOTAGE.txt"), readme, "utf-8");
  console.log("Created: INDEX_KATALOG_FOOTAGE.txt");
}

async function main() {
  await organizeMascotAssets();
  await captureAllFootage();
  generateMasterIndex();
  console.log("SUCCESS: All promo footage, interactive mascot states, AI advisor, Voice, Bills, and system features captured!");
}

main().catch(console.error);
