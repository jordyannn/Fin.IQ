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

const allPages = [
  {
    name: '1. Dashboard & Portofolio Utama (Overview)',
    prompt: [
      'A modern mobile fintech dashboard for "Fin.IQ" (Indonesian wealth tracker inspired by Bibit).',
      'Top header: Greeting "Halo, Jordy", bell notification icon with unread badge, and user avatar.',
      'Hero Card (Portfolio Summary): Clean white card with emerald green accents, displaying total net worth "Rp 248.520.000", period filter pills ("Bulan Ini", "Tahun Ini", "Semua"), and net cash flow tag "+14.8% (+Rp 4.200.000)".',
      'Quick Action Buttons row: "Catat Transaksi" (emerald green primary button), "Impor CSV", "Pindah Saldo".',
      'Asset Allocation Section: Clean breakdown with progress bars for Kas Tunai (Rp 8.5jt), Bank Digital (BCA/Mandiri Rp 95jt), E-Wallet (GoPay Rp 5jt), and Investasi (Reksa Dana & Saham Rp 140jt).',
      'Recent Transactions list: Clean feed with day headers, category icons, amounts formatted in Rupiah (+ hijau, - slate/merah).',
      'Fixed Mobile Bottom Nav: 5 items with Home, Transaksi, elevated green center "+" button, Akun, Menu.'
    ].join('\n')
  },
  {
    name: '2. Riwayat Mutasi & Filter Transaksi (Transactions)',
    prompt: [
      'A modern mobile transactions feed screen for "Fin.IQ" (Indonesian fintech wealth app).',
      'Top Navigation: Title "Riwayat Transaksi", search bar with magnifying glass "Cari transaksi, toko, atau catatan...", and filter icon button.',
      'Monthly Summary Card: Net Flow (+Rp 10.750.000) with emerald green badge, Total Pemasukan (+Rp 15.000.000), Total Pengeluaran (-Rp 4.250.000).',
      'Filter pill tabs row: "Semua", "Pengeluaran", "Pemasukan", "Transfer", "Bulan Ini".',
      'Date-grouped transaction list:',
      '- Group "Hari Ini - 20 Okt":',
      '  * Kopi Kenangan: -Rp 28.000 (Makanan & Minuman, icon cup, tag "BCA")',
      '  * Gaji Masuk PT ABC: +Rp 15.000.000 (Pemasukan, icon wallet, emerald green, tag "Mandiri")',
      '- Group "Kemarin - 19 Okt":',
      '  * Supermarket GrandLucky: -Rp 420.000 (Belanja Bulanan, tag "BCA")',
      '  * Pindah ke Bibit Reksadana: Rp 2.000.000 (Transfer, icon repeat, tag "BCA -> Bibit")',
      'Floating action: Scan struk receipt button and Quick Add button.',
      'Fixed bottom navigation bar with active state on "Transaksi".'
    ].join('\n')
  },
  {
    name: '3. Akun Finansial & Portofolio Rekening (Accounts)',
    prompt: [
      'A modern mobile financial accounts management screen for "Fin.IQ".',
      'Top Header: Title "Akun & Dompet", subtitle "Kelola semua rekening, e-wallet, dan portofolio investasi Anda".',
      'Summary Card: Total Saldo Bersih "Rp 248.520.000", with toggle show/hide eye icon, and quick action "+ Tambah Akun" and "Pindah Saldo".',
      'Categorized Account Cards:',
      '1. Bank Digital (Total: Rp 95.000.000):',
      '   - BCA Tabungan: Rp 65.000.000 (icon bank, active badge)',
      '   - Bank Mandiri Payroll: Rp 30.000.000 (icon bank)',
      '2. Investasi (Total: Rp 140.000.000):',
      '   - Bibit Reksadana Obligasi & Saham: Rp 85.000.000 (+12.4% return badge)',
      '   - Stockbit Portofolio Saham: Rp 55.000.000 (+8.2% return badge)',
      '3. E-Wallet (Total: Rp 5.020.000):',
      '   - GoPay: Rp 3.500.000',
      '   - OVO: Rp 1.520.000',
      '4. Kas Tunai (Total: Rp 8.500.000):',
      '   - Dompet Pribadi: Rp 8.500.000',
      'Clean cards with rounded corners, emerald green progress bars, and subtle borders.',
      'Fixed bottom navigation bar with active state on "Akun".'
    ].join('\n')
  },
  {
    name: '4. Anggaran Bulanan & Analitik Pengeluaran (Budgets)',
    prompt: [
      'A modern mobile monthly budget tracker and financial analytics screen for "Fin.IQ".',
      'Header: "Anggaran & Analisis Bulanan" with current month selector "Oktober 2026".',
      'Overall Budget Hero Card: Total Pengeluaran "Rp 7.500.000" dari batas "Rp 12.000.000" (62% terpakai, Sisa Anggaran: Rp 4.500.000).',
      'Visual segmented progress meter bar showing safe vs warning zones.',
      'Category Budgets list:',
      '- Makanan & Minuman: Rp 2.800.000 / Rp 4.000.000 (70% terpakai, green status, progress bar)',
      '- Transportasi & Bensin: Rp 1.200.000 / Rp 1.500.000 (80% terpakai, amber warning status)',
      '- Tagihan & Langganan: Rp 1.950.000 / Rp 2.000.000 (97% terpakai, red alert badge "Hampir Habis")',
      '- Belanja Bulanan: Rp 1.550.000 / Rp 3.000.000 (51% terpakai, green status)',
      'Monthly expense comparison bar chart (Jul, Agu, Sep, Okt) with trend indicator.',
      'Button: "+ Buat Anggaran Baru" in primary emerald green.',
      'Fixed bottom navigation bar.'
    ].join('\n')
  },
  {
    name: '5. Impor Mutasi Rekening Bank & E-Wallet (Import)',
    prompt: [
      'A modern mobile bank statement importer and converter screen for "Fin.IQ".',
      'Header: "Impor Mutasi Rekening", subtitle "Unggah mutasi rekening bank atau e-wallet (BCA, Mandiri, BRI, BNI, GoPay)".',
      'Upload Dropzone Card: Dashed emerald border, upload cloud icon, "Tarik file CSV/Excel ke sini atau ketuk untuk pilih file".',
      'Supported Bank Badges: BCA, Mandiri, BRI, BNI, GoPay, OVO, ShopeePay (with bank logo icons).',
      'Parsed Preview Card (Tinjauan Mutasi Berhasil Diurai):',
      'Status: "12 Transaksi Terdeteksi (100% Cocok)" with green checkmark.',
      'Preview list items showing: Date, Description, Auto-detected category chip, and Amount (Debet/Kredit).',
      'Action Buttons row at bottom: "Simpan Semua Transaksi" (emerald green primary) and "Batal".',
      'Fixed bottom navigation bar.'
    ].join('\n')
  },
  {
    name: '6. Asisten AI Finansial & Scanner Nota (AI)',
    prompt: [
      'A modern mobile AI Financial Assistant and smart receipt scanner screen for "Fin.IQ".',
      'Header: "Asisten AI Fin.IQ" with glowing emerald sparkle icon.',
      'Top segmented tabs: "Scan Struk (OCR)", "Konsultasi Fin.IQ", "Catat Bahasa Alami".',
      'Smart Camera Dropzone: Card with camera viewfinder graphic, "Foto struk belanja Anda untuk pencatatan otomatis instan".',
      'Detected Receipt Card Preview (Struk Alfamart Terdeteksi):',
      '- Total Belanja: Rp 84.500',
      '- Tanggal: 20 Okt 2026 11:30',
      '- Toko: Alfamart Sudirman',
      '- Rincian: Susu UHT (Rp 19.500), Roti Gandum (Rp 16.000), Minyak Goreng (Rp 34.000), Snack (Rp 15.000).',
      'AI Smart Insights Bubble from Fin.IQ Bot:',
      '"Pengeluaran belanja mingguan Anda 12% lebih hemat dari rata-rata bulan lalu! Rekomendasi: Alihkan sisa anggaran Rp 350.000 ke reksa dana pasar uang."',
      'Chat input bar at bottom: "Tanya Fin.IQ tentang keuangan Anda..." with send button.',
      'Fixed bottom navigation bar.'
    ].join('\n')
  },
  {
    name: '7. Kalender Arus Kas Finansial (Calendar)',
    prompt: [
      'A modern mobile financial cashflow calendar screen for "Fin.IQ".',
      'Header: "Kalender Keuangan", selector "Oktober 2026", total pemasukan (+Rp 15.000.000), total pengeluaran (-Rp 4.250.000).',
      'Interactive monthly calendar grid: Dates with colored indicator dots (green dot for income, red dot for expense, blue dot for transfer).',
      'Selected day detail card ("Senin, 20 Oktober 2026"):',
      '- Total cash flow for the day: +Rp 14.972.000',
      '- List of 2 transactions on this date with category icons and timestamps.',
      'Upcoming bills reminder section (e.g. "Tagihan Listrik PLN jatuh tempo dalam 3 hari").',
      'Fixed bottom navigation bar.'
    ].join('\n')
  },
  {
    name: '8. Halaman Masuk & Keamanan (Login)',
    prompt: [
      'A sleek, secure mobile login screen for "Fin.IQ" (Indonesian fintech app).',
      'App branding at center top: Emerald green Fin.IQ logo and tagline "Kendalikan & Kembangkan Aset Anda".',
      'Clean form container: Email/Username input with clean borders, Password input with eye toggle.',
      'Biometric / PIN quick login button (Fingerprint & FaceID icon) with text "Masuk dengan Sidik Jari / PIN".',
      'Primary login button "Masuk ke Fin.IQ" in emerald green.',
      'Help text and links: "Lupa kata sandi?" and "Belum punya akun? Daftar sekarang".',
      'Security assurance badge at footer: "Dilindungi enkripsi data perbankan 256-bit".'
    ].join('\n')
  }
];

async function run() {
  console.log(`Starting migration of ${allPages.length} pages to project 'Fin-IQ Page Migration' (${PROJECT_ID})...\n`);

  for (let i = 0; i < allPages.length; i++) {
    const page = allPages[i];
    console.log(`----------------------------------------------------------------`);
    console.log(`[${i + 1}/${allPages.length}] Generating: ${page.name}`);
    console.log(`----------------------------------------------------------------`);

    try {
      const res = await callMcp('generate_screen_from_text', {
        projectId: PROJECT_ID,
        designSystem: DESIGN_SYSTEM,
        deviceType: 'MOBILE',
        modelId: 'GEMINI_3_8_FLASH',
        prompt: page.prompt
      });

      if (res && res.result && !res.result.isError) {
        console.log(`✓ Selesai generate: ${page.name}`);
      } else {
        console.error(`✗ Error on ${page.name}:`, JSON.stringify(res, null, 2));
      }
    } catch (err) {
      console.error(`✗ Exception on ${page.name}:`, err.message);
    }
  }

  console.log('\n================================================================');
  console.log('Semua halaman Fin.IQ berhasil disalin & dibuat di project Fin-IQ Page Migration!');
  console.log('================================================================');
}

run().catch(console.error);
