const https = require('https');

const API_KEY = 'AQ.Ab8RN6KvRIQjLCN51hmBd4xqep9-ktVXXWDATIuqU4MBsHQUOg';
const PROJECT_ID = '5471651399424170758';
const DESIGN_SYSTEM = 'assets/9987ae61ae124318b17f090672db5903';

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

async function main() {
  console.log('--- Generating Screen 1: Overview Dashboard ---');
  const dashboardPrompt = [
    'A modern mobile fintech dashboard for "Fin.IQ" (Indonesian wealth & finance tracker inspired by Bibit).',
    'Top header: Greeting "Halo, Jordy", bell notification icon with badge, and profile avatar.',
    'Hero Card (Portfolio Summary): Clean white card with emerald green accents, displaying total net worth "Rp 248.520.000", period filter pills ("Bulan Ini", "Tahun Ini", "Semua"), and net cash flow tag "+14.8% (+Rp 4.200.000)".',
    'Quick Action Buttons row: "Catat Transaksi" (emerald green primary button), "Impor CSV", "Pindah Saldo".',
    'Asset Allocation Section: Clean breakdown with progress bars for Kas Tunai (Rp 8.5jt), Bank Digital (BCA/Mandiri Rp 95jt), E-Wallet (GoPay Rp 5jt), and Investasi (Reksa Dana & Saham Rp 140jt).',
    'Recent Transactions list: Clean feed with day headers, category icons, amounts formatted in Rupiah (+ hijau, - slate/merah).',
    'Fixed Mobile Bottom Nav: 5 items with Home, Transaksi, elevated green center "+" button, Akun, Menu.'
  ].join('\n');

  const res1 = await callMcp('generate_screen_from_text', {
    projectId: PROJECT_ID,
    designSystem: DESIGN_SYSTEM,
    deviceType: 'MOBILE',
    modelId: 'GEMINI_3_8_FLASH',
    prompt: dashboardPrompt
  });

  console.log('Result Screen 1:', JSON.stringify(res1, null, 2));
}

main().catch(console.error);
