const https = require('https');

const API_KEY = 'AQ.Ab8RN6KvRIQjLCN51hmBd4xqep9-ktVXXWDATIuqU4MBsHQUOg';
const PROJECT_ID = '17421221073910810506'; // Fin-IQ Page Migration
const DESIGN_SYSTEM = 'assets/1e1ca4816b1c40c18caff3b1f7447d62';

function callMcp(toolName, args) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    });

    const req = https.request({
      hostname: 'stitch.googleapis.com',
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const desktopScreens = [
  {
    name: 'Desktop - 1. Overview Dashboard Utama',
    prompt: [
      'FULL DESKTOP WEB APPLICATION INTERFACE for "Fin.IQ" (Indonesian Wealth & Personal Finance App).',
      'DEVICE LAYOUT: Desktop view (1440px wide). Direct implementation of project code style and HTML structure.',
      '',
      '=== 1. DESKTOP LEFT SIDEBAR (w-64 bg-card border-r border-border) ===',
      '- Brand header: Logo Fin.IQ with emerald green sparkle icon, subtitle "Personal Finance".',
      '- Primary Nav Items (icon + text):',
      '  * Overview (active state: bg-primary/10 text-primary font-bold rounded-xl)',
      '  * Transaksi (icon Receipt)',
      '  * Fin.IQ AI (badge "AI" sparkle)',
      '  * Impor Transaksi (icon FileSpreadsheet)',
      '  * Analisis (icon PieChart)',
      '  * Kalender (icon Calendar)',
      '  * Akun Keuangan (icon Wallet)',
      '  * Kategori (icon Tags)',
      '  * Anggaran (icon PiggyBank)',
      '  * Laporan Tahunan (icon CalendarRange)',
      '- Bottom Sidebar section: User profile card "Jordy" (Pro Plan, avatar), Settings link, and theme toggle.',
      '',
      '=== 2. DESKTOP TOP BAR (h-16 border-b border-border px-8 flex justify-between items-center) ===',
      '- Left: Breadcrumbs "Dashboard > Overview" and Search input with shortcut badge "⌘K".',
      '- Right: Quick Ledger Selector "Buku Kas Utama", Notification Bell (with active red dot), and "+ Catat Transaksi" emerald pill button.',
      '',
      '=== 3. DESKTOP MAIN CONTENT (max-w-7xl mx-auto p-8 space-y-6) ===',
      '- SECTION A: Hero Portfolio Card (rounded-[32px] border border-border/70 bg-card p-7 shadow-sm):',
      '  * Top toolbar: Date filter dropdown ("Bulan Ini - Oktober 2026"), period prev/next buttons, Refresh icon.',
      '  * Main Stat: Label "TOTAL SALDO REKENING" with ShieldCheck icon, giant text-5xl font-black "Rp 248.520.000", badge "6 Akun Aktif".',
      '  * 3-Column Integrated Cash Flow Layer (grid grid-cols-3 gap-4 mt-4):',
      '    1. Cash Masuk: +Rp 15.000.000 (green TrendingUp, emerald-600 font-bold)',
      '    2. Cash Keluar: -Rp 4.250.000 (rose TrendingDown, rose-600 font-bold)',
      '    3. Selisih Arus Kas: +Rp 10.750.000 (badge "Surplus" emerald-500/15)',
      '',
      '- SECTION B: 2-Column Analytical Grid (grid grid-cols-12 gap-6):',
      '  * Left Column (col-span-8 space-y-6):',
      '    - Card Kurva Pertumbuhan Saldo: Interactive AreaChart line showing positive wealth growth trajectory over 30 days.',
      '    - Card Rincian Pengeluaran Terbesar per Kategori: Progress bars for Makanan (Rp 2.1jt, 49%), Transport (Rp 850rb, 20%), Tagihan (Rp 750rb, 18%), Belanja (Rp 550rb, 13%).',
      '  * Right Column (col-span-4 space-y-6):',
      '    - Card Alokasi Aset (Donut Chart & List): Investasi (57%), Bank Digital (38%), Kas (3%), E-Wallet (2%).',
      '    - Card 5 Transaksi Terakhir: Clean list with category icons, notes, and colored amounts, plus "Lihat Semua Transaksi" link.',
      '',
      'STYLING: Modern Tailwind CSS desktop fintech aesthetics, clean slate/neutral borders, vibrant #00B569 emerald green accents, Inter typography.'
    ].join('\n')
  },
  {
    name: 'Desktop - 2. Riwayat Mutasi & Filter Transaksi',
    prompt: [
      'FULL DESKTOP WEB APPLICATION INTERFACE for "Fin.IQ" - Transactions Management Page.',
      'DEVICE LAYOUT: Desktop view (1440px wide). Complete sidebar, topbar, and data-dense transactions view.',
      '',
      '=== 1. DESKTOP SIDEBAR === (Left sidebar with "Transaksi" active).',
      '=== 2. DESKTOP TOP BAR === (Search "⌘K", notifications, profile).',
      '',
      '=== 3. DESKTOP MAIN CONTENT (max-w-7xl mx-auto p-8 space-y-6) ===',
      '- Header row: Title "Riwayat Transaksi", subtitle "Kelola, cari, dan tinjau seluruh mutasi keuangan Anda", and buttons: "Scan Struk Nota", "Impor CSV", "+ Catat Transaksi".',
      '- Desktop Filter Toolbar (flex flex-wrap items-center gap-3 p-4 bg-card rounded-2xl border border-border):',
      '  * Search input (w-72 rounded-full) with search icon.',
      '  * Filter Tabs: "Semua", "Pengeluaran", "Pemasukan", "Transfer".',
      '  * Dropdowns: Filter Akun (BCA, Mandiri, GoPay), Filter Kategori, Filter Periode (Bulan Ini).',
      '  * Bulk action buttons: Export Excel/CSV, Hapus Terpilih.',
      '- 3-Stat Summary Cards Row (grid grid-cols-3 gap-4):',
      '  * Total Pemasukan: +Rp 15.000.000',
      '  * Total Pengeluaran: -Rp 4.250.000',
      '  * Arus Kas Bersih: +Rp 10.750.000 (Surplus)',
      '- Desktop Data Table / Dense Feed (bg-card rounded-2xl border border-border overflow-hidden):',
      '  * Table headers: Checkbox, Tanggal & Waktu, Kategori & Ikon, Deskripsi / Catatan, Akun / Rekening, Jenis (Badge), Nominal (Rupiah), Aksi.',
      '  * Row 1: 20 Okt 14:30 | Makanan (Icon) | Kopi Kenangan Sudirman | BCA Tabungan | Pengeluaran (Red badge) | -Rp 28.000 | Edit, Hapus',
      '  * Row 2: 20 Okt 09:00 | Pemasukan (Icon) | Gaji Pokok PT ABC | Mandiri Payroll | Pemasukan (Emerald badge) | +Rp 15.000.000 | Edit, Hapus',
      '  * Row 3: 19 Okt 19:15 | Belanja (Icon) | Supermarket GrandLucky | BCA Tabungan | Pengeluaran (Red badge) | -Rp 420.000 | Edit, Hapus',
      '  * Row 4: 18 Okt 10:00 | Transfer (Icon) | Top-up Reksa Dana | BCA -> Bibit | Transfer (Blue badge) | Rp 2.000.000 | Edit, Hapus',
      '  * Row 5: 17 Okt 08:30 | Transport (Icon) | Grab / Gojek | GoPay | Pengeluaran (Red badge) | -Rp 35.000 | Edit, Hapus',
      '- Pagination toolbar at bottom: "Menampilkan 1-10 dari 48 transaksi", Prev, 1, 2, 3, 4, Next buttons.',
      'STYLING: Sharp, readable data-dense fintech table, modern hover states, Inter typography, emerald green #00B569 highlights.'
    ].join('\n')
  },
  {
    name: 'Desktop - 3. Akun Keuangan & Manajemen Portofolio',
    prompt: [
      'FULL DESKTOP WEB APPLICATION INTERFACE for "Fin.IQ" - Financial Accounts & Portfolio Page.',
      'DEVICE LAYOUT: Desktop view (1440px wide). Complete sidebar, topbar, and account cards grid.',
      '',
      '=== 1. DESKTOP SIDEBAR === (Left sidebar with "Akun Keuangan" active).',
      '=== 2. DESKTOP TOP BAR ===',
      '',
      '=== 3. DESKTOP MAIN CONTENT (max-w-7xl mx-auto p-8 space-y-6) ===',
      '- Header row: Title "Akun & Portofolio Rekening", subtitle "Pantau saldo dan alokasi aset pada seluruh perbankan dan e-wallet", with buttons "Pindah Saldo Antar Akun" and "+ Tambah Akun Baru".',
      '- Net Worth Overview Hero (grid grid-cols-12 gap-6):',
      '  * Left Card (col-span-8 bg-card p-6 rounded-3xl border border-border):',
      '    - Label "TOTAL KEKAYAAN BERSIH" with eye toggle icon.',
      '    - Giant nominal: "Rp 248.520.000".',
      '    - Horizontal Stacked Bar visualizing asset allocation: Bank (38%), Investasi (57%), E-Wallet (2%), Kas (3%).',
      '  * Right Card (col-span-4 bg-primary/5 border border-primary/20 p-6 rounded-3xl flex flex-col justify-between):',
      '    - Title: "Kesehatan Likuiditas: Sangat Baik"',
      '    - Dana Darurat: 8.5 bulan pengeluaran tercukupi.',
      '    - CTA button: "Optimalkan Imbal Hasil".',
      '- Categorized Account Grid (4 Sections):',
      '  1. BANK DIGITAL & TABUNGAN (grid grid-cols-3 gap-4):',
      '     * BCA Prioritas: Rp 65.000.000 (Chip logo BCA, nomor rekening ****8891, status Aktif)',
      '     * Mandiri Payroll: Rp 30.000.000 (Chip logo Mandiri, nomor rekening ****2210)',
      '     * Kartu Kredit BCA: Limit Rp 25.000.000 (Tagihan Rp 3.200.000)',
      '  2. INVESTASI & PASAR MODAL (grid grid-cols-3 gap-4):',
      '     * Bibit Reksa Dana: Rp 85.000.000 (+12.4% return badge)',
      '     * Stockbit Portofolio Saham: Rp 55.000.000 (+8.2% return badge)',
      '  3. E-WALLET & KAS TUNAI (grid grid-cols-3 gap-4):',
      '     * GoPay: Rp 3.500.000',
      '     * OVO Cash: Rp 1.520.000',
      '     * Kas Tunai Dompet: Rp 8.500.000',
      'STYLING: Sleek credit-card-like components, crisp badges, modern emerald green fintech style.'
    ].join('\n')
  },
  {
    name: 'Desktop - 4. Impor Mutasi & Konverter Bank Cerdas',
    prompt: [
      'FULL DESKTOP WEB APPLICATION INTERFACE for "Fin.IQ" - Bank Statement CSV/Excel Importer Page.',
      'DEVICE LAYOUT: Desktop view (1440px wide). Complete sidebar, topbar, and desktop multi-step import studio.',
      '',
      '=== 1. DESKTOP SIDEBAR === (Left sidebar with "Impor Transaksi" active).',
      '=== 2. DESKTOP TOP BAR ===',
      '',
      '=== 3. DESKTOP MAIN CONTENT (max-w-7xl mx-auto p-8 space-y-6) ===',
      '- Header row: Title "Impor & Konversi Mutasi Bank", subtitle "Unggah e-statement format CSV atau Excel dari bank Anda untuk diubah otomatis menjadi transaksi rapi".',
      '- Stepper progress: 1. Unggah File (Selesai) -> 2. Pemetaan Kolom (Aktif) -> 3. Tinjau & Simpan.',
      '- Top Supported Format Badges: BCA (.csv), Mandiri (.xlsx), BRI (.csv), BNI (.pdf/csv), GoPay (.csv), OVO (.csv).',
      '- Desktop 2-Column Working Studio (grid grid-cols-12 gap-6):',
      '  * Left Column (col-span-4 space-y-4):',
      '    - File Dropzone Card: Dashed border, file icon "mutasi-bca-oktober-2026.csv (42 KB)", badge "Format BCA Terdeteksi Otomatis".',
      '    - Target Account Selector: "Masukkan ke: BCA Tabungan".',
      '    - Default Book: "Buku Kas Utama".',
      '    - AI Category Auto-match toggle (Active: 98% akurasi).',
      '  * Right Column (col-span-8 space-y-4):',
      '    - Card Tinjauan Data Terurai (Parsed Table Preview):',
      '      Header: "15 Transaksi Ditemukan | Total Debet: Rp 4.250.000 | Total Kredit: Rp 15.000.000".',
      '      Data Table with columns: Checkbox, Tanggal, Uraian / Keterangan Asli, Kategori Terprediksi (Editable dropdown), Tipe, Nominal.',
      '      Row items previewing parsed items with green match checkmarks.',
      '    - Bottom Actions: "Simpan 15 Transaksi ke Fin.IQ" (Primary Emerald Button) and "Batalkan".',
      'STYLING: Clean enterprise-grade spreadsheet & data import UI, modern tags, high readability.'
    ].join('\n')
  },
  {
    name: 'Desktop - 5. Asisten AI Finansial & Scanner Nota OCR',
    prompt: [
      'FULL DESKTOP WEB APPLICATION INTERFACE for "Fin.IQ" - AI Financial Copilot & Receipt Scanner Studio.',
      'DEVICE LAYOUT: Desktop view (1440px wide). Complete sidebar, topbar, and desktop split-screen AI workspace.',
      '',
      '=== 1. DESKTOP SIDEBAR === (Left sidebar with "Fin.IQ AI" active).',
      '=== 2. DESKTOP TOP BAR ===',
      '',
      '=== 3. DESKTOP MAIN CONTENT (max-w-7xl mx-auto p-8 space-y-6) ===',
      '- Header row: Title "Fin.IQ AI Studio", subtitle "Analisis cerdas pola pengeluaran, konsultasi strategi aset, dan pembaca nota otomatis dengan Google Gemini".',
      '- Top Segmented Mode Tabs: "1. Scanner Struk & Nota OCR", "2. Konsultasi Finansial Fin.IQ", "3. Input Cepat Bahasa Alami".',
      '- Desktop Split Studio (grid grid-cols-12 gap-6):',
      '  * Left Pane (col-span-6 bg-card rounded-3xl border border-border p-6 flex flex-col gap-4):',
      '    - Header: "Dokumen Struk Belanja (OCR)" with upload/drag zone.',
      '    - Viewport Image: High-res receipt preview with green AI bounding boxes highlighting "Total: Rp 84.500", "Tanggal: 20/10/2026", and itemized groceries.',
      '    - Extracted Items Table: Rincian item belanja, PPN 11%, dan kategori otomatis "Belanja Bulanan".',
      '    - Button: "Konfirmasi & Masukkan ke Buku Kas".',
      '  * Right Pane (col-span-6 bg-card rounded-3xl border border-border p-6 flex flex-col justify-between):',
      '    - Header: "Dialog Fin.IQ Copilot" with active online badge and model tag "Gemini 3.8 Flash".',
      '    - Chat Messages Feed:',
      '      * User: "Bagaimana performa cash flow saya bulan ini dibanding bulan lalu?"',
      '      * Fin.IQ AI: "Arus kas bersih Anda surplus Rp 10.750.000 (+14.8%). Anda berhasil menekan pengeluaran makan di luar hingga 22%. Saran: Alokasikan surplus Rp 3.500.000 ke portofolio reksa dana obligasi."',
      '    - Quick Prompt Pills: "Analisis langganan bulanan", "Cek dana darurat", "Simulasi beli rumah".',
      '    - Chat Input Box: Full-width input with voice icon, attachment icon, and emerald Send button.',
      'STYLING: Sleek dual-pane AI studio, luminous emerald gradients, clean markdown typography.'
    ].join('\n')
  }
];

async function run() {
  console.log(`Starting generation of ${desktopScreens.length} Desktop UI screens in project 'Fin-IQ Page Migration' (${PROJECT_ID})...\n`);

  for (let i = 0; i < desktopScreens.length; i++) {
    const screen = desktopScreens[i];
    console.log(`================================================================`);
    console.log(`[${i + 1}/${desktopScreens.length}] Generating: ${screen.name}`);
    console.log(`================================================================`);

    try {
      const res = await callMcp('generate_screen_from_text', {
        projectId: PROJECT_ID,
        designSystem: DESIGN_SYSTEM,
        deviceType: 'DESKTOP',
        modelId: 'GEMINI_3_8_FLASH',
        prompt: screen.prompt
      });

      if (res && res.result && !res.result.isError) {
        console.log(`✓ Selesai generate: ${screen.name}`);
      } else {
        console.error(`✗ Error on ${screen.name}:`, JSON.stringify(res, null, 2));
      }
    } catch (err) {
      console.error(`✗ Exception on ${screen.name}:`, err.message);
    }
  }

  console.log('\n================================================================');
  console.log('Semua tampilan Desktop UI Fin.IQ berhasil disalin ke Stitch!');
  console.log('================================================================');
}

run().catch(console.error);
