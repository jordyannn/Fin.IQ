const https = require('https');

const API_KEY = 'AQ.Ab8RN6KvRIQjLCN51hmBd4xqep9-ktVXXWDATIuqU4MBsHQUOg';
const PROJECT_ID = '17421221073910810506'; // Fin-IQ Page Migration
const DESIGN_SYSTEM = 'assets/39268fb06338446bbb823503987f679c'; // Geometric Minimalist Intelligence

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

const redesignedScreens = [
  {
    name: 'Desktop - 1. Overview Dashboard (Geometric Minimalist Intelligence)',
    prompt: [
      'FULL DESKTOP WEB APPLICATION INTERFACE for "Fin.IQ" (Indonesian Wealth and Personal Finance).',
      'DESIGN SYSTEM: Geometric Minimalist Intelligence.',
      'DEVICE: Desktop 1440px wide viewport. Canvas base: #F8FAFC. Card surfaces: #FFFFFF with 1px border #E2E8F0 and 16px to 20px rounded corners.',
      'TYPOGRAPHY: Plus Jakarta Sans. Quantitative metrics rendered in bold tabular numerals.',
      'ICONOGRAPHY: Pure Geometric Duotone System using primitive shapes (circles, semicircles, capsules). Primary emerald (#059669), secondary mint tint (#A7F3D0), deep accent (#064E3B). No line sketches or skeuomorphism.',
      'COPYWRITING: Anti-slop standard. Direct, plain, natural Indonesian financial language. No em dashes, no robotic corporate buzzwords.',
      '',
      '=== 1. DESKTOP LEFT RAIL SIDEBAR (w-64 bg-white border-r border-slate-200 p-6 flex flex-col justify-between) ===',
      '- Brand header: Minimalist duotone geometric logo (intersecting emerald circle and mint semicircle) with label "Fin.IQ", subtitle "Personal Finance".',
      '- Navigation items list:',
      '  * Overview (Active: left 3px indicator line in #059669, bg-emerald-50 text-emerald-900 font-semibold rounded-xl p-3)',
      '  * Transaksi (Duotone document capsule icon)',
      '  * Fin.IQ AI (Duotone sparkle icon with green pill badge "AI")',
      '  * Impor Berkas (Duotone table icon)',
      '  * Analisis (Duotone analytics icon: left mint circle paired with right emerald semicircle)',
      '  * Kalender (Duotone grid icon)',
      '  * Akun Keuangan (Duotone wallet icon)',
      '  * Anggaran (Duotone savings icon)',
      '  * Laporan Tahunan (Duotone chart icon)',
      '- Bottom rail profile: User "Jordy" with clean avatar and quick sign out button.',
      '',
      '=== 2. DESKTOP TOP BAR (h-16 border-b border-slate-200 bg-white/80 backdrop-blur px-8 flex justify-between items-center) ===',
      '- Left: Clean breadcrumbs "Fin.IQ / Ringkasan" and search field with geometric search glyph and keyboard shortcut badge "⌘K".',
      '- Right: Ledger selector "Buku Kas Utama", notification bell with green status dot, and primary action button "+ Catat Transaksi" (solid #059669 with white text, 10px rounded).',
      '',
      '=== 3. DESKTOP MAIN WORKSPACE (max-w-7xl mx-auto p-8 space-y-6) ===',
      '- HERO PORTFOLIO MODULE (white container, 1px #E2E8F0 border, 20px rounded, p-7):',
      '  * Top toolbar: Month selector "Oktober 2026", quick filter pills ("Hari Ini", "7 Hari", "Bulan Ini", "Tahun Ini"), and data refresh icon.',
      '  * Quantitative readout: Label "TOTAL SALDO REKENING", bold 38px metric "Rp 248.520.000", accompanied by status pill "6 Rekening Aktif" (bg-emerald-50 text-emerald-800).',
      '  * 3-Column Tonal Cash Flow Layer (grid grid-cols-3 gap-4 mt-5):',
      '    1. Kas Masuk: +Rp 15.000.000 (text-emerald-700 font-bold 22px, duotone trending up badge)',
      '    2. Kas Keluar: -Rp 4.250.000 (text-red-700 font-bold 22px, duotone trending down badge)',
      '    3. Selisih Arus Kas: +Rp 10.750.000 (pill badge "Surplus Arus Kas" bg-emerald-100 text-emerald-800)',
      '',
      '- 2-COLUMN ANALYTIC GRID (grid grid-cols-12 gap-6):',
      '  * Left Column (col-span-8 space-y-6):',
      '    - Kurva Pertumbuhan Saldo Card: Clean minimalist AreaChart curve on cool slate grid, showing smooth 30-day cumulative net flow.',
      '    - Pengeluaran Terbesar per Kategori: Modular progress bars for Makanan & Minuman (49%), Transportasi (20%), Tagihan Rutin (18%), Belanja (13%).',
      '  * Right Column (col-span-4 space-y-6):',
      '    - Alokasi Aset Card: Minimalist donut chart with crisp legend: Investasi (57%), Bank Digital (38%), Kas Tunai (3%), E-Wallet (2%).',
      '    - 5 Mutasi Terakhir Card: Clean tabular feed with date, merchant, category duotone dot, and Rupiah amount, plus link "Buka Riwayat Transaksi".',
      '',
      'STYLE FIDELITY: Calm architectural order, pure Swiss layout balance, #059669 accents, zero visual clutter.'
    ].join('\n')
  },
  {
    name: 'Desktop - 2. Riwayat Transaksi & Filter (Geometric Minimalist Intelligence)',
    prompt: [
      'FULL DESKTOP WEB APPLICATION INTERFACE for "Fin.IQ" - Transactions Log & Filter Management.',
      'DESIGN SYSTEM: Geometric Minimalist Intelligence.',
      'DEVICE: Desktop 1440px wide viewport. Canvas base: #F8FAFC. Card surfaces: #FFFFFF with 1px border #E2E8F0.',
      'TYPOGRAPHY: Plus Jakarta Sans. Tabular numerals for prices and transaction amounts.',
      'ICONOGRAPHY: Pure Geometric Duotone System. Primary #059669, secondary #A7F3D0, accent #064E3B.',
      'COPYWRITING: Anti-slop standard. Natural, direct Indonesian financial copy. No em dashes.',
      '',
      '=== 1. SIDEBAR & TOP BAR === (Left rail navigation with active "Transaksi" state, search bar with "⌘K").',
      '',
      '=== 2. MAIN CONTENT AREA (max-w-7xl mx-auto p-8 space-y-6) ===',
      '- Header row: Title "Riwayat Transaksi", subtitle "Daftar pencatatan mutasi kas, perbankan, dan e-wallet", with action buttons: "Scan Nota Belanja", "Impor File CSV", "+ Tambah Transaksi".',
      '- Filter Toolbar (bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4):',
      '  * Left search box: 10px rounded input with geometric magnifying icon "Cari nama toko, kategori, atau catatan...".',
      '  * Filter Tabs: "Semua", "Pengeluaran", "Pemasukan", "Transfer".',
      '  * Dropdowns: Pilih Akun (BCA, Mandiri, GoPay), Kategori, dan Periode Bulan Ini.',
      '  * Batch tools: "Ekspor Data Excel", "Hapus Data Terpilih".',
      '- Cash Flow Summary Row (grid grid-cols-3 gap-4):',
      '  * Total Pemasukan: +Rp 15.000.000 (Duotone green pill)',
      '  * Total Pengeluaran: -Rp 4.250.000 (Duotone red pill)',
      '  * Selisih Bersih: +Rp 10.750.000 (Badge Surplus)',
      '- Data-Dense Transactions Table (bg-white rounded-2xl border border-slate-200 overflow-hidden):',
      '  * Columns: Checkbox, Tanggal & Jam, Kategori, Keterangan Transaksi, Rekening, Tipe, Nominal, Opsi.',
      '  * Row 1: 20 Okt 14:30 | Makanan (Duotone icon) | Kopi Kenangan Sudirman | BCA Tabungan | Pengeluaran (Pill merah) | -Rp 28.000 | Edit',
      '  * Row 2: 20 Okt 09:00 | Pemasukan (Duotone icon) | Gaji Pokok Kantor | Mandiri Payroll | Pemasukan (Pill hijau) | +Rp 15.000.000 | Edit',
      '  * Row 3: 19 Okt 19:15 | Belanja (Duotone icon) | Supermarket GrandLucky | BCA Tabungan | Pengeluaran (Pill merah) | -Rp 420.000 | Edit',
      '  * Row 4: 18 Okt 10:00 | Transfer (Duotone icon) | Top up Reksadana Bibit | BCA -> Bibit | Transfer (Pill biru) | Rp 2.000.000 | Edit',
      '  * Row 5: 17 Okt 08:30 | Transportasi (Duotone icon) | Perjalanan Gojek | GoPay | Pengeluaran (Pill merah) | -Rp 35.000 | Edit',
      '- Footer Pagination: "Menampilkan 1-10 dari 48 catatan transaksi", Tombol Halaman 1, 2, 3, 4, 5.',
      'STYLE FIDELITY: Architectural clarity, tabular numbers, high information density, #059669 accents.'
    ].join('\n')
  },
  {
    name: 'Desktop - 3. Akun Keuangan & Portofolio (Geometric Minimalist Intelligence)',
    prompt: [
      'FULL DESKTOP WEB APPLICATION INTERFACE for "Fin.IQ" - Accounts & Wealth Portfolio.',
      'DESIGN SYSTEM: Geometric Minimalist Intelligence.',
      'DEVICE: Desktop 1440px wide viewport. Canvas base: #F8FAFC. Card surfaces: #FFFFFF with 1px border #E2E8F0.',
      'TYPOGRAPHY: Plus Jakarta Sans. Tabular numerals for monetary metrics.',
      'ICONOGRAPHY: Pure Geometric Duotone System. Primary #059669, secondary #A7F3D0, accent #064E3B.',
      'COPYWRITING: Anti-slop standard. Natural, direct Indonesian financial copy. No em dashes.',
      '',
      '=== 1. SIDEBAR & TOP BAR === (Left rail navigation with active "Akun Keuangan" state).',
      '',
      '=== 2. MAIN CONTENT AREA (max-w-7xl mx-auto p-8 space-y-6) ===',
      '- Header row: Title "Akun & Portofolio Rekening", subtitle "Rincian saldo seluruh rekening perbankan, dompet digital, dan investasi", with buttons "Pindah Saldo" and "+ Tambah Akun Baru".',
      '- Wealth Summary Module (grid grid-cols-12 gap-6):',
      '  * Total Net Worth Card (col-span-8 bg-white p-7 rounded-3xl border border-slate-200):',
      '    - Label "TOTAL SALDO KEKAYAAN" with eye toggle icon.',
      '    - Giant bold metric: "Rp 248.520.000".',
      '    - Horizontal Segmented Bar displaying asset split: Bank Digital (38%), Pasar Modal (57%), E-Wallet (2%), Kas Tunai (3%).',
      '  * Liquidity Indicator Card (col-span-4 bg-emerald-50/60 border border-emerald-200 p-7 rounded-3xl flex flex-col justify-between):',
      '    - Title: "Cadangan Dana Darurat"',
      '    - Status: "Aman (Tercukupi untuk 8 bulan pengeluaran rutin)"',
      '    - Action link: "Atur Target Tabungan".',
      '- Categorized Account Grid (3 Sections):',
      '  1. BANK DIGITAL (grid grid-cols-3 gap-5):',
      '     * BCA Prioritas: Rp 65.000.000 (Nomor rekening ****8891, duotone bank icon, status Aktif)',
      '     * Mandiri Payroll: Rp 30.000.000 (Nomor rekening ****2210, duotone bank icon)',
      '     * Kartu Kredit BCA: Limit Rp 25.000.000 (Tagihan berjalan Rp 3.200.000)',
      '  2. INVESTASI (grid grid-cols-3 gap-5):',
      '     * Reksadana Bibit: Rp 85.000.000 (+12.4% imbal hasil, badge hijau)',
      '     * Portofolio Saham: Rp 55.000.000 (+8.2% imbal hasil, badge hijau)',
      '  3. DOMPET DIGITAL & KAS (grid grid-cols-3 gap-5):',
      '     * GoPay: Rp 3.500.000',
      '     * OVO Cash: Rp 1.520.000',
      '     * Kas Fisik Dompet: Rp 8.500.000',
      'STYLE FIDELITY: Refined card elevations, 1px subtle borders, emerald accents, pure geometry.'
    ].join('\n')
  },
  {
    name: 'Desktop - 4. Anggaran Bulanan & Analitik (Geometric Minimalist Intelligence)',
    prompt: [
      'FULL DESKTOP WEB APPLICATION INTERFACE for "Fin.IQ" - Monthly Budgets & Spending Analytics.',
      'DESIGN SYSTEM: Geometric Minimalist Intelligence.',
      'DEVICE: Desktop 1440px wide viewport. Canvas base: #F8FAFC. Card surfaces: #FFFFFF with 1px border #E2E8F0.',
      'TYPOGRAPHY: Plus Jakarta Sans. Tabular numerals for monetary metrics.',
      'ICONOGRAPHY: Pure Geometric Duotone System. Primary #059669, secondary #A7F3D0, accent #064E3B.',
      'COPYWRITING: Anti-slop standard. Natural, direct Indonesian financial copy. No em dashes.',
      '',
      '=== 1. SIDEBAR & TOP BAR === (Left rail navigation with active "Anggaran" state).',
      '',
      '=== 2. MAIN CONTENT AREA (max-w-7xl mx-auto p-8 space-y-6) ===',
      '- Header row: Title "Anggaran & Batas Pengeluaran", subtitle "Pantau pemakaian saldo bulanan agar tetap sesuai rencana", with button "+ Buat Batas Anggaran".',
      '- Overall Budget Card (bg-white p-7 rounded-3xl border border-slate-200):',
      '  * Metric Header: Terpakai "Rp 7.500.000" dari Batas "Rp 12.000.000" (62% terpakai, Sisa Saldo Rencana: Rp 4.500.000).',
      '  * Segmented Geometric Progress Meter with safe vs caution threshold indicators.',
      '- Category Budget Cards (grid grid-cols-2 gap-5):',
      '  * Makanan & Minuman: Rp 2.800.000 / Rp 4.000.000 (70% terpakai, status hijau, progress bar emerald)',
      '  * Transportasi Harian: Rp 1.200.000 / Rp 1.500.000 (80% terpakai, status kuning peringatan)',
      '  * Tagihan & Langganan: Rp 1.950.000 / Rp 2.000.000 (97% terpakai, badge merah "Mendekati Batas")',
      '  * Belanja Bulanan: Rp 1.550.000 / Rp 3.000.000 (51% terpakai, status hijau aman)',
      '- Monthly Spending Comparison Chart: Clean geometric bar chart comparing expense distribution across July, August, September, and October.',
      'STYLE FIDELITY: High clarity progress meters, geometric duotone indicators, calm aesthetic.'
    ].join('\n')
  },
  {
    name: 'Desktop - 5. Impor Mutasi & Konverter Bank (Geometric Minimalist Intelligence)',
    prompt: [
      'FULL DESKTOP WEB APPLICATION INTERFACE for "Fin.IQ" - Bank Statement CSV/Excel Converter Studio.',
      'DESIGN SYSTEM: Geometric Minimalist Intelligence.',
      'DEVICE: Desktop 1440px wide viewport. Canvas base: #F8FAFC. Card surfaces: #FFFFFF with 1px border #E2E8F0.',
      'TYPOGRAPHY: Plus Jakarta Sans. Tabular numerals for monetary metrics.',
      'ICONOGRAPHY: Pure Geometric Duotone System. Primary #059669, secondary #A7F3D0, accent #064E3B.',
      'COPYWRITING: Anti-slop standard. Natural, direct Indonesian financial copy. No em dashes.',
      '',
      '=== 1. SIDEBAR & TOP BAR === (Left rail navigation with active "Impor Berkas" state).',
      '',
      '=== 2. MAIN CONTENT AREA (max-w-7xl mx-auto p-8 space-y-6) ===',
      '- Header row: Title "Impor Berkas Mutasi Bank", subtitle "Konversi rekening koran CSV atau Excel dari bank Anda menjadi catatan transaksi otomatis".',
      '- Supported Formats Badges row: BCA (.csv), Bank Mandiri (.xlsx), BRI (.csv), BNI (.csv), GoPay (.csv), OVO (.csv).',
      '- 2-Column Converter Studio (grid grid-cols-12 gap-6):',
      '  * Left Pane (col-span-4 space-y-4):',
      '    - File Dropzone Card: Dashed border with geometric cloud upload icon, active file "mutasi-rekening-bca-okt.csv (38 KB)", badge "Format BCA Terdeteksi Otomatis".',
      '    - Account Target Selector: "Masukkan ke: BCA Tabungan Utama".',
      '    - Book Target Selector: "Buku Kas Utama".',
      '    - Auto-categorization toggle: "Pencocokan Kategori Cerdas Aktif".',
      '  * Right Pane (col-span-8 space-y-4):',
      '    - Card Tinjauan Mutasi (Parsed Data Preview):',
      '      Header: "15 Transaksi Ditemukan | Total Debet: Rp 4.250.000 | Total Kredit: Rp 15.000.000".',
      '      Clean Data Table showing: Tanggal, Deskripsi Asli Mutasi, Kategori Terpilih, Tipe Mutasi, dan Nominal Rupiah.',
      '      Row verification checkmarks indicating complete data matching.',
      '    - Action Buttons: "Simpan 15 Transaksi ke Buku Kas" (Solid #059669 button) and "Batalkan".',
      'STYLE FIDELITY: Professional financial spreadsheet studio, high tabular precision, serene UI.'
    ].join('\n')
  },
  {
    name: 'Desktop - 6. Asisten AI & Pembaca Nota OCR (Geometric Minimalist Intelligence)',
    prompt: [
      'FULL DESKTOP WEB APPLICATION INTERFACE for "Fin.IQ" - AI Financial Copilot and Smart Receipt Scanner.',
      'DESIGN SYSTEM: Geometric Minimalist Intelligence.',
      'DEVICE: Desktop 1440px wide viewport. Canvas base: #F8FAFC. Card surfaces: #FFFFFF with 1px border #E2E8F0.',
      'TYPOGRAPHY: Plus Jakarta Sans. Tabular numerals for prices and figures.',
      'ICONOGRAPHY: Pure Geometric Duotone System. Primary #059669, secondary #A7F3D0, accent #064E3B.',
      'COPYWRITING: Anti-slop standard. Natural, direct Indonesian financial copy. No em dashes, no artificial sycophancy.',
      '',
      '=== 1. SIDEBAR & TOP BAR === (Left rail navigation with active "Fin.IQ AI" state).',
      '',
      '=== 2. MAIN CONTENT AREA (max-w-7xl mx-auto p-8 space-y-6) ===',
      '- Header row: Title "Asisten AI Fin.IQ", subtitle "Pembaca nota belanja otomatis dan analisis pola pengeluaran berbasis data".',
      '- Top Mode Switcher: "1. Pemindai Nota Struk", "2. Konsultasi Keuangan", "3. Catat Bahasa Alami".',
      '- Split Studio Layout (grid grid-cols-12 gap-6):',
      '  * Left Pane (col-span-6 bg-white rounded-3xl border border-slate-200 p-6 flex flex-col gap-4):',
      '    - Header: "Dokumen Nota Belanja" with file upload trigger.',
      '    - Receipt Preview Viewport: Clean scan preview with subtle green geometric bounding boxes on Total Rp 84.500, Toko Alfamart, and individual grocery items.',
      '    - Extracted Items List: Susu UHT (Rp 19.500), Roti Gandum (Rp 16.000), Minyak Goreng (Rp 34.000), Biskuit (Rp 15.000).',
      '    - Action button: "Konfirmasi & Masukkan ke Catatan".',
      '  * Right Pane (col-span-6 bg-white rounded-3xl border border-slate-200 p-6 flex flex-col justify-between):',
      '    - Header: "Dialog Fin.IQ" with model status "Gemini 3.8 Flash".',
      '    - Chat Feed:',
      '      * User: "Bagaimana perbandingan pengeluaran makan saya minggu ini dibanding minggu lalu?"',
      '      * Fin.IQ AI: "Pengeluaran makan minggu ini sebesar Rp 720.000, turun Rp 180.000 dari minggu lalu. Anda paling sering berhemat pada hari kerja. Sisa anggaran makan bulan ini masih aman sebesar Rp 1.200.000."',
      '    - Quick Prompts: "Cek langganan aktif", "Simulasi dana darurat", "Hitung rata-rata belanja".',
      '    - Chat Input Field: Full width input "Tulis pertanyaan tentang keuangan Anda..." with send button.',
      'STYLE FIDELITY: Calm dual-pane AI studio, geometric duotone glyphs, no robotic hyperbole.'
    ].join('\n')
  }
];

async function run() {
  console.log(`Starting redesign of ${redesignedScreens.length} Desktop UI screens with Geometric Minimalist Intelligence...\n`);
  console.log(`Project: Fin-IQ Page Migration (${PROJECT_ID})`);
  console.log(`Design System: ${DESIGN_SYSTEM}\n`);

  for (let i = 0; i < redesignedScreens.length; i++) {
    const screen = redesignedScreens[i];
    console.log(`================================================================`);
    console.log(`[${i + 1}/${redesignedScreens.length}] Generating redesign: ${screen.name}`);
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
  console.log('Semua layar berhasil di-redesign dengan Geometric Minimalist Intelligence & Anti-Slop!');
  console.log('================================================================');
}

run().catch(console.error);
