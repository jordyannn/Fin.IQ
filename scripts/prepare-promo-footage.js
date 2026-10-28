const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT_DIR, "public", "promo-footage");
const AUTH_FILE = path.join(ROOT_DIR, "tests", "e2e", ".auth", "user.json");
const MASCOT_DIR = path.join(ROOT_DIR, "public", "mascot");
const MOBILE_DIR = path.join(ROOT_DIR, "public", "mobile-screenshots");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const copyFile = (src, dest) => {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied: ${path.basename(dest)}`);
  } else {
    console.warn(`File not found: ${src}`);
  }
};

async function captureDesktopFootage() {
  console.log("Launching browser to capture desktop screenshots...");
  const browser = await chromium.launch({ headless: true });
  
  let contextOptions = {
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  };

  if (fs.existsSync(AUTH_FILE)) {
    contextOptions.storageState = AUTH_FILE;
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    console.log("Navigating to http://localhost:3000/overview...");
    await page.goto("http://localhost:3000/overview", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const desktopOverviewPath = path.join(OUTPUT_DIR, "03_desktop_dashboard_overview.png");
    await page.screenshot({ path: desktopOverviewPath });
    console.log("Captured: 03_desktop_dashboard_overview.png");

    const cashflowEl = await page.$("#walker-target-cashflow, [data-tour='overview-hero'], [data-walker-target='cashflow']");
    if (cashflowEl) {
      const cashflowPath = path.join(OUTPUT_DIR, "04_desktop_net_cashflow_card.png");
      await cashflowEl.screenshot({ path: cashflowPath });
      console.log("Captured: 04_desktop_net_cashflow_card.png");
    } else {
      const headerArea = await page.$("main > div:first-child");
      if (headerArea) {
        await headerArea.screenshot({ path: path.join(OUTPUT_DIR, "04_desktop_net_cashflow_card.png") });
      }
    }

    try {
      await page.goto("http://localhost:3000/accounts", { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "05_desktop_accounts.png") });
      console.log("Captured: 05_desktop_accounts.png");
    } catch (e) {
      console.warn("Could not capture accounts:", e.message);
    }

  } catch (err) {
    console.error("Error during screenshot capture:", err.message);
  } finally {
    await browser.close();
  }
}

async function organizeFootage() {
  console.log("Organizing assets into promo-footage folder...");

  copyFile(
    path.join(MASCOT_DIR, "mascot-boncos.png"),
    path.join(OUTPUT_DIR, "01_mascot_boncos.png")
  );

  copyFile(
    path.join(MASCOT_DIR, "cat-house-sleeping.png"),
    path.join(OUTPUT_DIR, "02_bang_peci_tidur_kasur.png")
  );
  copyFile(
    path.join(MASCOT_DIR, "cat-house-empty.png"),
    path.join(OUTPUT_DIR, "02_kasur_kucing_kosong.png")
  );
  copyFile(
    path.join(MASCOT_DIR, "mascot-halo.png"),
    path.join(OUTPUT_DIR, "02_bang_peci_halo.png")
  );
  copyFile(
    path.join(MASCOT_DIR, "mascot-logo.png"),
    path.join(OUTPUT_DIR, "02_logo_bang_peci.png")
  );

  copyFile(
    path.join(MOBILE_DIR, "iPhone-13-page-overview.png"),
    path.join(OUTPUT_DIR, "03_mobile_pwa_overview.png")
  );

  copyFile(
    path.join(MASCOT_DIR, "mascot-analisis.png"),
    path.join(OUTPUT_DIR, "04_bang_peci_analisis_kacamata.png")
  );
  copyFile(
    path.join(MASCOT_DIR, "mascot-cuan.png"),
    path.join(OUTPUT_DIR, "04_bang_peci_cuan_jempol.png")
  );
  copyFile(
    path.join(MASCOT_DIR, "mascot-tech-warning.png"),
    path.join(OUTPUT_DIR, "04_bang_peci_warning_boncos.png")
  );

  copyFile(
    path.join(MOBILE_DIR, "iPhone-13-03-quick-add-modal.png"),
    path.join(OUTPUT_DIR, "05_mobile_quick_add_suara_ocr.png")
  );
  copyFile(
    path.join(MOBILE_DIR, "iPhone-13-page-accounts.png"),
    path.join(OUTPUT_DIR, "05_mobile_multi_akun_cash_blu_dana.png")
  );
  copyFile(
    path.join(MOBILE_DIR, "iPhone-13-page-budgets.png"),
    path.join(OUTPUT_DIR, "05_mobile_budget_monitoring.png")
  );

  copyFile(
    path.join(MASCOT_DIR, "mascot-rpg-cuan.png"),
    path.join(OUTPUT_DIR, "06_bang_peci_cuan_outro.png")
  );
  copyFile(
    path.join(ROOT_DIR, "public", "icon-512.png"),
    path.join(OUTPUT_DIR, "06_icon_finiq_app.png")
  );

  const promptTxt = `================================================================================
KUMPULAN FOOTAGE & PROMPT RESMI FIN.IQ UNTUK GOOGLE GEMINI (VEO / VIDS / CHAT)
Folder: public/promo-footage/
================================================================================

PETUNJUK PENGGUNAAN:
1. Buka Gemini (gemini.google.com) atau Google Vids (vids.google.com).
2. Upload gambar aset sesuai nomor adegan (01 sampai 06).
3. Salin teks PROMPT GEMINI di bawah ini ke kotak chat/instruksi.

--------------------------------------------------------------------------------
SCENE 1: HOOK SATIR TANGGAL TUA (00:00 - 00:08)
File Aset:
- 01_mascot_boncos.png
Teks Prompt Gemini:
"Create a humorous 8-second motion scene. Start with an empty leather wallet blowing cold wind and floating receipts. Then pop in this mascot character (01_mascot_boncos.png) in panic holding its head. Large comic text pop-up: 'GAJI BARU 3 HARI, KOK DOMPET UDAH KERING?!'. Background should feel dramatic and comical with red warning alarm lighting. Vertical 9:16 aspect ratio."
Voiceover:
"Gaji baru masuk tiga hari... kok saldo udah kembali ke setelan pabrik?! Tenang, lu gak sendirian yang ngerasa uangnya hilang ghaib!"
--------------------------------------------------------------------------------

--------------------------------------------------------------------------------
SCENE 2: BANG PECI TURUN GUNUNG (00:08 - 00:20)
File Aset:
- 02_bang_peci_tidur_kasur.png
- 02_kasur_kucing_kosong.png
- 02_bang_peci_halo.png
- 02_logo_bang_peci.png
Teks Prompt Gemini:
"Animate a cute tuxedo cat wearing a black Indonesian peci cap waking up from a round cat bed (02_bang_peci_tidur_kasur.png), stretching, jumping playfully into the foreground, fixing its black peci, and waving hello with a friendly big smile (02_bang_peci_halo.png). Upbeat, bright modern fintech lighting, pop-art stickers: 'KENALIN: BANG PECI! Satpam Pribadi Arus Kas'. Vertical 9:16 format."
Voiceover:
"Kenalin, gua Bang Peci! Kucing yang bakal jadi satpam pribadi arus kas lu di Fin.IQ! Stop pusing mikirin duit sendirian, biar gua yang kawal dompet lu tiap hari!"
--------------------------------------------------------------------------------

--------------------------------------------------------------------------------
SCENE 3: DUAL-VIEW: DESKTOP & MOBILE PWA (00:20 - 00:35)
File Aset:
- 03_desktop_dashboard_overview.png
- 03_mobile_pwa_overview.png
Teks Prompt Gemini:
"Create a seamless 3D dual-screen showcase. In the upper half/background, display a sleek laptop showing the full fintech analytics dashboard (03_desktop_dashboard_overview.png). In the bottom/foreground, an iPhone slides in showing the clean mobile PWA interface (03_mobile_pwa_overview.png). Text overlay: 'LAPTOP LUAS, HP SAT-SET - SINKRON REALTIME'. Vertical 9:16 video."
Voiceover:
"Kerennya, Fin.IQ punya dua tampilan mantap! Mau evaluasi bulanan di Laptop dengan grafik lebar yang jernih? Ada! Mau catat sat-set pas di jalan lewat HP? Tinggal buka versi Mobile PWA-nya. Semuanya sinkron realtime!"
--------------------------------------------------------------------------------

--------------------------------------------------------------------------------
SCENE 4: FITUR UTAMA - AGEN CASHFLOW BANG PECI (00:35 - 00:52)
File Aset:
- 04_desktop_net_cashflow_card.png
- 04_bang_peci_analisis_kacamata.png
- 04_bang_peci_cuan_jempol.png
- 04_bang_peci_warning_boncos.png
Teks Prompt Gemini:
"Zoom into the financial net cashflow metric card (04_desktop_net_cashflow_card.png). Transition the cat mascot into wearing analyst spectacles (04_bang_peci_analisis_kacamata.png) examining green surplus numbers. Then show golden coins and thumbs up (04_bang_peci_cuan_jempol.png). Suddenly switch to caution mode with flashing amber warning border and alert mascot (04_bang_peci_warning_boncos.png) with text: 'OVERBUDGET! REM BELANJA!'. Vertical 9:16 video."
Voiceover:
"Nah, ini fitur jagoan gua: Agen Cashflow! Tiap hari gua patroli pantau saldo masuk dan keluar. Kalo lagi cuan surplus, gua kasih jempol. Tapi kalo pos kopi lu mulai boncos bocor halus... ekor gua langsung tegang kasih sinyal bahaya!"
--------------------------------------------------------------------------------

--------------------------------------------------------------------------------
SCENE 5: FITUR PENDUKUNG - AI VOICE, OCR STRUK & MULTI-AKUN (00:52 - 01:05)
File Aset:
- 05_mobile_quick_add_suara_ocr.png
- 05_mobile_multi_akun_cash_blu_dana.png
- 05_mobile_budget_monitoring.png
Teks Prompt Gemini:
"Fast-cut motion showcase of smart input features. Show the transaction dialog (05_mobile_quick_add_suara_ocr.png) with a glowing voice dictation wave icon, then a scanner laser effect capturing a paper receipt. Transition smoothly to the multi-account balance card showing Cash, Blu Bank, and Dana (05_mobile_multi_akun_cash_blu_dana.png). Dynamic, fast-paced modern fintech UI animation. Vertical 9:16."
Voiceover:
"Malas ngetik angka? Tinggal sebutin: 'Makan siang 35 ribu pake Blu'... atau cukup foto struk belanja lu, AI Fin.IQ langsung beresin! Saldo Cash, Bank Blu, sampe Dana lu auto-rapi tanpa ribet."
--------------------------------------------------------------------------------

--------------------------------------------------------------------------------
SCENE 6: CALL TO ACTION & PENUTUP (01:05 - 01:15)
File Aset:
- 06_bang_peci_cuan_outro.png
- 06_icon_finiq_app.png
Teks Prompt Gemini:
"Grand finale outro. The cat mascot (06_bang_peci_cuan_outro.png) cheerfully winks and points down toward a glowing emerald green button: 'COBA GRATIS SEKARANG - KLIK LINK DI BIO'. Fin.IQ logo glows at top. Confetti, gold sparkles, professional and inviting. Vertical 9:16 video."
Voiceover:
"Mulai hari ini, stop drama tanggal tua! Yuk naik kelas kelola duit bareng gua. Coba Fin.IQ gratis sekarang—klik link di bio ya!"
================================================================================
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, "PANDUAN_PROMPT_GEMINI_LENGKAP.txt"), promptTxt, "utf-8");
  console.log("Created: PANDUAN_PROMPT_GEMINI_LENGKAP.txt");
}

async function main() {
  organizeFootage();
  await captureDesktopFootage();
  console.log("All promo footage prepared successfully in:", OUTPUT_DIR);
}

main().catch(console.error);
