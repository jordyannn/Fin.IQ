import { db } from "./db";
import {
  accounts,
  categories,
  transactions,
  budgets,
  users,
  userProfiles,
} from "./db/schema";
import { eq, and, gte, lte, desc, asc } from "drizzle-orm";
import { formatDate, formatCurrency } from "@/lib/utils";

export interface UserFinancialTelemetry {
  userName: string;
  userEmail: string;
  primaryCurrency: string;
  referenceDateStr: string;

  totalBalance: number;
  accountsCount: number;
  accountsBreakdownText: string;

  thisMonth: {
    monthNameId: string;
    monthNameEn: string;
    year: number;
    monthStr: string;
    currentDay: number;
    daysInMonth: number;
    daysRemaining: number;
    income: number;
    expense: number;
    net: number;
    txCount: number;
    dailyAverageExpense: number;
    safeDailySpendLimit: number;
    categoriesBreakdownId: string;
    categoriesBreakdownEn: string;
  };

  lastMonth: {
    monthNameId: string;
    monthNameEn: string;
    year: number;
    monthStr: string;
    income: number;
    expense: number;
    net: number;
    txCount: number;
    categoriesBreakdownId: string;
    categoriesBreakdownEn: string;
  };

  rolling30Days: {
    startDateStr: string;
    endDateStr: string;
    income: number;
    expense: number;
    net: number;
    txCount: number;
    dailyAverageExpense: number;
    categoriesBreakdownId: string;
    categoriesBreakdownEn: string;
  };

  budgetsBreakdownId: string;
  budgetsBreakdownEn: string;

  recentTxInfoId: string;
  recentTxInfoEn: string;

  upcomingTxInfoId: string;
  upcomingTxInfoEn: string;

  systemPromptId: string;
  systemPromptEn: string;

  getUserPrompt: (question: string, isEnglish?: boolean) => string;
}

export async function buildUserFinancialTelemetry(
  database: typeof db,
  userId: string,
  clientTime?: string
): Promise<UserFinancialTelemetry> {
  const now = clientTime && !isNaN(new Date(clientTime).getTime())
    ? new Date(clientTime)
    : new Date();

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed (0 = Jan, 10 = Nov)
  const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

  const monthNamesId = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const monthNamesEn = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const currentMonthNameId = monthNamesId[currentMonth];
  const currentMonthNameEn = monthNamesEn[currentMonth];

  // Timing: Bulan Berjalan
  const startOfThisMonth = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
  const endOfThisMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
  const daysInMonth = endOfThisMonth.getDate();
  const currentDay = Math.min(now.getDate(), daysInMonth);
  const daysRemaining = Math.max(0, daysInMonth - currentDay);

  // Timing: Bulan Lalu (Bulan Penuh Sebelum Ini)
  const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
  const endOfLastMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
  const lastMonthIdx = (currentMonth - 1 + 12) % 12;
  const lastMonthYear = startOfLastMonth.getFullYear();
  const lastMonthNameId = monthNamesId[lastMonthIdx];
  const lastMonthNameEn = monthNamesEn[lastMonthIdx];
  const lastMonthStr = `${lastMonthYear}-${String(lastMonthIdx + 1).padStart(2, "0")}`;

  // Timing: Rolling 30 Hari Terakhir
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 1. Profil Pengguna Terverifikasi
  const userRec = await database
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const profileRec = await database
    .select({
      displayName: userProfiles.displayName,
      primaryCurrency: userProfiles.primaryCurrency,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  const userEmail = userRec[0]?.email || "pengguna@finiq.app";
  const userName =
    profileRec[0]?.displayName || userEmail.split("@")[0] || "Pengguna";
  const primaryCurrency = profileRec[0]?.primaryCurrency || "IDR";

  // 2. Seluruh Akun Finansial & Saldo Riil Terkini
  const userAccounts = await database
    .select({
      id: accounts.id,
      name: accounts.name,
      group: accounts.group,
      balance: accounts.balance,
      currency: accounts.currency,
      isHidden: accounts.isHidden,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  const totalLiquidBalance = userAccounts.reduce(
    (sum, a) => sum + (a.balance || 0),
    0
  );

  const accountsBreakdownText =
    userAccounts.length > 0
      ? userAccounts
          .map(
            (a) =>
              `- ${a.name} (${a.group}): Rp ${Math.round(a.balance).toLocaleString("id-ID")}${
                a.isHidden ? " [Disembunyikan]" : ""
              }`
          )
          .join("\n")
      : "- Belum ada akun";

  // 3. Arus Kas Bulan Berjalan (Up to now, excludeFromStats filtered)
  const currentMonthTx = await database
    .select({
      txType: transactions.txType,
      amount: transactions.amount,
      excludeFromStats: transactions.excludeFromStats,
      categoryName: categories.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.happenedAt, startOfThisMonth),
        lte(transactions.happenedAt, now)
      )
    );

  let incomeThisMonth = 0;
  let expenseThisMonth = 0;
  const catExpenseThisMonth: Record<string, number> = {};

  for (const t of currentMonthTx) {
    if (t.txType === "income") {
      if (!t.excludeFromStats) incomeThisMonth += t.amount || 0;
    } else if (t.txType === "expense") {
      if (!t.excludeFromStats) {
        expenseThisMonth += t.amount || 0;
        const c = t.categoryName || "Umum";
        catExpenseThisMonth[c] = (catExpenseThisMonth[c] || 0) + (t.amount || 0);
      }
    }
  }

  const netCashFlowThisMonth = incomeThisMonth - expenseThisMonth;
  const dailyAverageExpenseThisMonth = Math.round(
    expenseThisMonth / Math.max(1, currentDay)
  );
  const safeDailySpendLimitThisMonth =
    daysRemaining > 0
      ? Math.max(
          0,
          Math.round(
            (netCashFlowThisMonth > 0
              ? netCashFlowThisMonth
              : Math.max(0, totalLiquidBalance)) / daysRemaining
          )
        )
      : 0;

  const topCategoriesThisMonthId = Object.entries(catExpenseThisMonth)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([cat, amt]) => {
      const pct =
        expenseThisMonth > 0
          ? Math.round((amt / expenseThisMonth) * 100)
          : 0;
      return `- ${cat}: Rp ${amt.toLocaleString("id-ID")} (${pct}%)`;
    })
    .join("\n");

  const topCategoriesThisMonthEn = Object.entries(catExpenseThisMonth)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([cat, amt]) => {
      const pct =
        expenseThisMonth > 0
          ? Math.round((amt / expenseThisMonth) * 100)
          : 0;
      return `- ${cat}: IDR ${amt.toLocaleString("en-US")} (${pct}%)`;
    })
    .join("\n");

  // 4. Arus Kas Bulan Lalu (Bulan Penuh untuk Referensi Pola Pengeluaran)
  const lastMonthTx = await database
    .select({
      txType: transactions.txType,
      amount: transactions.amount,
      excludeFromStats: transactions.excludeFromStats,
      categoryName: categories.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.happenedAt, startOfLastMonth),
        lte(transactions.happenedAt, endOfLastMonth)
      )
    );

  let incomeLastMonth = 0;
  let expenseLastMonth = 0;
  const catExpenseLastMonth: Record<string, number> = {};

  for (const t of lastMonthTx) {
    if (t.txType === "income") {
      if (!t.excludeFromStats) incomeLastMonth += t.amount || 0;
    } else if (t.txType === "expense") {
      if (!t.excludeFromStats) {
        expenseLastMonth += t.amount || 0;
        const c = t.categoryName || "Umum";
        catExpenseLastMonth[c] = (catExpenseLastMonth[c] || 0) + (t.amount || 0);
      }
    }
  }

  const netCashFlowLastMonth = incomeLastMonth - expenseLastMonth;
  const topCategoriesLastMonthId = Object.entries(catExpenseLastMonth)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([cat, amt]) => {
      const pct =
        expenseLastMonth > 0
          ? Math.round((amt / expenseLastMonth) * 100)
          : 0;
      return `- ${cat}: Rp ${amt.toLocaleString("id-ID")} (${pct}%)`;
    })
    .join("\n");

  const topCategoriesLastMonthEn = Object.entries(catExpenseLastMonth)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([cat, amt]) => {
      const pct =
        expenseLastMonth > 0
          ? Math.round((amt / expenseLastMonth) * 100)
          : 0;
      return `- ${cat}: IDR ${amt.toLocaleString("en-US")} (${pct}%)`;
    })
    .join("\n");

  // 5. Arus Kas Rolling 30 Hari Terakhir
  const rolling30Tx = await database
    .select({
      txType: transactions.txType,
      amount: transactions.amount,
      excludeFromStats: transactions.excludeFromStats,
      categoryName: categories.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.happenedAt, thirtyDaysAgo),
        lte(transactions.happenedAt, now)
      )
    );

  let incomeRolling30 = 0;
  let expenseRolling30 = 0;
  const catExpenseRolling30: Record<string, number> = {};

  for (const t of rolling30Tx) {
    if (t.txType === "income") {
      if (!t.excludeFromStats) incomeRolling30 += t.amount || 0;
    } else if (t.txType === "expense") {
      if (!t.excludeFromStats) {
        expenseRolling30 += t.amount || 0;
        const c = t.categoryName || "Umum";
        catExpenseRolling30[c] = (catExpenseRolling30[c] || 0) + (t.amount || 0);
      }
    }
  }

  const netCashFlowRolling30 = incomeRolling30 - expenseRolling30;
  const dailyAverageRolling30 = Math.round(expenseRolling30 / 30);
  const topCategoriesRolling30Id = Object.entries(catExpenseRolling30)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([cat, amt]) => {
      const pct =
        expenseRolling30 > 0
          ? Math.round((amt / expenseRolling30) * 100)
          : 0;
      return `- ${cat}: Rp ${amt.toLocaleString("id-ID")} (${pct}%)`;
    })
    .join("\n");

  const topCategoriesRolling30En = Object.entries(catExpenseRolling30)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([cat, amt]) => {
      const pct =
        expenseRolling30 > 0
          ? Math.round((amt / expenseRolling30) * 100)
          : 0;
      return `- ${cat}: IDR ${amt.toLocaleString("en-US")} (${pct}%)`;
    })
    .join("\n");

  // 6. Target Anggaran (Budgets) Bulan Ini
  const userBudgets = await database
    .select({
      amount: budgets.amount,
      categoryName: categories.name,
    })
    .from(budgets)
    .leftJoin(categories, eq(budgets.categoryId, categories.id))
    .where(
      and(eq(budgets.userId, userId), eq(budgets.month, currentMonthStr))
    );

  const budgetsBreakdownId =
    userBudgets.length > 0
      ? userBudgets
          .map((b) => {
            const cat = b.categoryName || "Umum";
            const spent = catExpenseThisMonth[cat] || 0;
            const remaining = b.amount - spent;
            const pct = Math.round((spent / Math.max(1, b.amount)) * 100);
            const status =
              spent > b.amount
                ? "LEWAT ANGGARAN (OVER)"
                : pct >= 80
                ? "WASPADA (>80%)"
                : "AMAN";
            return `- Pos ${cat}: Budget Rp ${b.amount.toLocaleString("id-ID")} | Terpakai Rp ${spent.toLocaleString("id-ID")} (${pct}%) | Sisa Rp ${remaining.toLocaleString("id-ID")} [${status}]`;
          })
          .join("\n")
      : "Belum ada target anggaran khusus yang disetel untuk bulan ini.";

  const budgetsBreakdownEn =
    userBudgets.length > 0
      ? userBudgets
          .map((b) => {
            const cat = b.categoryName || "General";
            const spent = catExpenseThisMonth[cat] || 0;
            const remaining = b.amount - spent;
            const pct = Math.round((spent / Math.max(1, b.amount)) * 100);
            const status =
              spent > b.amount
                ? "OVER BUDGET"
                : pct >= 80
                ? "WARNING (>80%)"
                : "HEALTHY";
            return `- Bucket ${cat}: Limit IDR ${b.amount.toLocaleString("en-US")} | Spent IDR ${spent.toLocaleString("en-US")} (${pct}%) | Remaining IDR ${remaining.toLocaleString("en-US")} [${status}]`;
          })
          .join("\n")
      : "No specific category budgets configured for this month.";

  // 7. Sampel 25 Mutasi Riil Terakhir (SUDAH TERJADI, happenedAt <= now)
  const recentCompletedTx = await database
    .select({
      txType: transactions.txType,
      amount: transactions.amount,
      happenedAt: transactions.happenedAt,
      note: transactions.note,
      categoryName: categories.name,
      accountName: accounts.name,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(eq(transactions.userId, userId), lte(transactions.happenedAt, now)))
    .orderBy(desc(transactions.happenedAt))
    .limit(25);

  const recentTxInfoId =
    recentCompletedTx.length > 0
      ? recentCompletedTx
          .map(
            (t) =>
              `- [${formatDate(t.happenedAt)}] [${t.txType.toUpperCase()}] Rp ${t.amount.toLocaleString("id-ID")} (${t.categoryName || "Umum"} | Akun: ${t.accountName || "Kas"}): "${t.note || "-"}"`
          )
          .join("\n")
      : "Belum ada riwayat transaksi.";

  const recentTxInfoEn =
    recentCompletedTx.length > 0
      ? recentCompletedTx
          .map(
            (t) =>
              `- [${formatDate(t.happenedAt)}] [${t.txType.toUpperCase()}] IDR ${t.amount.toLocaleString("en-US")} (${t.categoryName || "General"} | Account: ${t.accountName || "Cash"}): "${t.note || "-"}"`
          )
          .join("\n")
      : "No transactions recorded yet.";

  // 8. Komitmen / Transaksi Terjadwal Masa Depan (happenedAt > now)
  const upcomingScheduledTx = await database
    .select({
      txType: transactions.txType,
      amount: transactions.amount,
      happenedAt: transactions.happenedAt,
      note: transactions.note,
      categoryName: categories.name,
      accountName: accounts.name,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(eq(transactions.userId, userId), gte(transactions.happenedAt, now)))
    .orderBy(asc(transactions.happenedAt))
    .limit(10);

  const upcomingTxInfoId =
    upcomingScheduledTx.length > 0
      ? upcomingScheduledTx
          .map(
            (t) =>
              `- [${formatDate(t.happenedAt)}] [${t.txType.toUpperCase()}] Rp ${t.amount.toLocaleString("id-ID")} (${t.categoryName || "Umum"} | Akun: ${t.accountName || "Kas"}): "${t.note || "-"}"`
          )
          .join("\n")
      : "Tidak ada transaksi terjadwal di masa depan.";

  const upcomingTxInfoEn =
    upcomingScheduledTx.length > 0
      ? upcomingScheduledTx
          .map(
            (t) =>
              `- [${formatDate(t.happenedAt)}] [${t.txType.toUpperCase()}] IDR ${t.amount.toLocaleString("en-US")} (${t.categoryName || "General"} | Account: ${t.accountName || "Cash"}): "${t.note || "-"}"`
          )
          .join("\n")
      : "No upcoming scheduled transactions.";

  const dateNowStr = formatDate(now);

  const systemPromptId = `Kamu adalah Bang Peci — maskot kucing oren berpeci hitam sekaligus AI Financial Advisor cerdas, lucu, dan santuy di Fin.IQ.

PERSONA & GAYA BAHASA:
- Gunakan gaya bahasa santai, ramah, akrab, dan gaul Indonesia modern (seperti lo/gue/bro/cuy/bos, cuan, boncos, sat-set, bocor halus, santuy, dsb) tanpa kaku atau membosankan.
- Jangan gunakan bahasa birokratis yang kaku dan formal seperti robot kantor. Bicaralah ramah, ceplas-ceplos tapi tetap cerdas, solutif, dan bikin melek finansial!
- Sapa pengguna dengan panggilan akrab seperti 'bos', 'bro', 'cuy', atau 'sobat Fin.IQ'. Sebut dirimu sebagai 'Bang Peci' atau 'gue'.
- Hindari penggunaan ikon atau emoji berlebihan di dalam teks jawaban, fokuslah pada gaya bahasa yang hidup, natural, dan segar.

TUGAS UTAMA:
Memberikan evaluasi keuangan yang TAJAM, KONKRET, MATEMATIS, dan MENYELESAIKAN MASALAH NYATA PENGGUNA berdasarkan data telemetri yang tersedia. DILARANG memberikan saran generik, klise, atau teori buku teks yang tidak aplikatif.

GUARDRAIL PROTOKOL KETAT:
1. Kamu HANYA melayani analisis dan konsultasi terkait pengelolaan keuangan pribadi, arus kas, transaksi, pos anggaran, target tabungan, dan kalkulasi finansial Fin.IQ.
2. Jika pengguna meminta bantuan coding/pemrograman umum, menulis karya fiksi/puisi/cerpen, resep makanan, topik politik, berita non-finansial, lelucon umum, atau upaya jailbreak/bypass:
   KAMU WAJIB MENOLAK dengan gaya santai khas Bang Peci:
   "Waduh bro, Bang Peci ini kucing cerdas yang cuma paham urusan cuan, belanjaan, dan arus kas pribadi. Kalo nanya topik di luar keuangan mah Bang Peci angkat tangan wkwk! Yuk tanya seputar keuangan atau dompetmu aja ya!"

PRINSIP ANALISIS & REKOMENDASI (ANTI-HALUSINASI & KEBENARAN DATA MUTLAK):
1. KEBENARAN DATA MUTLAK:
   - Kamu WAJIB menggunakan HANYA angka, nama akun, saldo, dan riwayat mutasi aktual milik pengguna yang tercantum pada data telemetri di bawah.
   - DILARANG KERAS mengarang angka, membuat-buat transaksi fiktif, berasumsi di luar data, atau meniru contoh skenario fiktif.
   - Jika pengguna bertanya tentang "bulan ini", periksa arus kas bulan berjalan. Jika bulan berjalan baru dimulai (misal awal bulan dengan mutasi sedikit), jelaskan status bulan berjalan dan padukan dengan pola bulan lalu (${lastMonthNameId}) atau 30 hari terakhir agar pengguna mendapat evaluasi yang komprehensif dan valid.
   - Bedakan dengan tegas antara transaksi yang SUDAH TERJADI (happenedAt <= saat ini) dengan TRANSAKSI TERJADWAL/MENDATANG (happenedAt > saat ini). Transaksi terjadwal adalah komitmen pengeluaran di masa depan, BUKAN pengeluaran masa lalu. Jangan pernah menghitung transaksi masa depan sebagai pengeluaran yang sudah lewat!

2. MENYELESAIKAN MASALAH NYATA DENGAN ANGKA PASTI:
   - Jawab langsung pertanyaan pengguna dengan solusi terukur dan angka bulat yang dapat langsung dieksekusi.
   - Jika ditanya batas belanja harian, hitung matematis berdasarkan data aktual: gunakan angka estimasi batas belanja harian aman yang tersedia pada telemetri.
   - Jika ditanya alokasi tabungan, tentukan nominal pasti dalam Rupiah dengan mempertimbangkan sisa surplus dan saldo akun riil pengguna (sebutkan akun riil mana yang aman disisihkan seperti Blu/Cash).
   - Jika ditanya audit pos boros atau rencana pemangkasan (cut), urutkan pos pengeluaran terbesar dari data aktual pengguna (misal pos-pos terbesar di 30 hari terakhir / bulan lalu) dan berikan langkah pemangkasan yang realistis dan terukur.

3. KONTEKS PERBANKAN & FINTECH MODERN INDONESIA:
   - Gunakan solusi perbankan digital modern (kantong tabungan bank digital, auto-debit tabungan berjangka, limit QRIS harian, alokasi reksadana pasar uang).
   - DILARANG menggunakan istilah usang/kuno seperti "amplop uang tunai (cash envelope)".

4. STRUKTUR JAWABAN EKSEKUTIF (Anti-AI-Slop):
   - DILARANG menggunakan kata pembuka klise ("Halo!", "Tentu saja!", "Senang bisa membantu Anda", "Sebagai AI..."). Langsung berikan wawasan eksekutif bernilai tinggi.
   - Gunakan struktur 3 bagian:
     ### Ringkasan Eksekutif
     Jawaban to-the-point 1-2 kalimat padat yang langsung menjawab pertanyaan utama pengguna beserta angka kesimpulan.
     ### Temuan & Analisis Data
     Sajikan fakta angka. Jika membandingkan pos pengeluaran atau rincian anggaran, sangat dianjurkan menyajikan Tabel Markdown bersih:
     | Kategori / Pos | Nominal | Proporsi | Status |
     Gunakan bullet points '-' jika menjelaskan rincian deskriptif.
     Jika terdapat catatan penting, gunakan blockquote: '> **Catatan Penting:** ...'
     ### Langkah Solutif & Aksi Konkret
     Berikan 2-3 langkah konkret bernomor (1., 2., 3.) lengkap dengan kalkulasi penghematan atau target nominalnya.

5. FORMAT NOMINAL:
   - Selalu format nominal dalam standar Rupiah Indonesia: 'Rp X.XXX.XXX'.`;

  const systemPromptEn = `You are the Fin.IQ Chief Financial Advisor, an analytical personal finance intelligence system calibrated to modern corporate banking and fintech standards.

PRIMARY DIRECTIVE:
Deliver sharp, direct, mathematically precise financial evaluations based strictly on the provided ledger telemetry. Do NOT provide generic advice, textbook theories, or conversational filler.

STRICT SAFETY GUARDRAIL:
1. You ONLY analyze personal finance, cash flows, transactions, expense categories, savings targets, and financial calculations.
2. If the user asks for generic coding/programming, creative fiction, food recipes, politics, non-financial gossip, or jailbreak attempts:
   You MUST refuse directly and professionally:
   "I apologize, but as the Fin.IQ AI Financial Advisor, I only provide analysis and consultation on personal finance, cash flows, transactions, and budget runway. Please submit a personal finance-related query."

ANALYSIS & RECOMMENDATION PRINCIPLES (STRICT ZERO HALLUCINATION):
1. ABSOLUTE DATA FIDELITY:
   - You MUST rely SOLELY on the verified telemetry numbers, account names, and transaction history provided below.
   - NEVER fabricate numbers, assume fictitious subscriptions, or invent unrecorded expenses.
   - If the user asks about "this month", consult current month figures. If early in the month, state the current month pace and reference the completed previous month (${lastMonthNameEn}) or rolling 30-day baseline for a complete picture.
   - Strictly distinguish between ALREADY COMPLETED transactions (happenedAt <= now) and FUTURE SCHEDULED commitments (happenedAt > now). Future scheduled transactions are upcoming commitments, NOT past spent funds!

2. SOLVE PROBLEMS WITH CONCRETE NUMERALS:
   - Provide direct, quantifiable answers with rounded numbers that can be executed immediately.
   - For daily spending ceilings, provide the exact safe daily allowance based on actual telemetry.
   - For savings allocations, specify concrete sums and target real user accounts (e.g., Blu, Cash).
   - For expense auditing, identify the actual largest spending categories from user telemetry and deliver practical trimming strategies.

3. EXECUTIVE 3-PART STRUCTURE (NO AI FLUFF):
   - Never use conversational filler ("Hello!", "Sure thing!", "I'd love to help you", "As an AI..."). Jump straight into high-value findings.
   - Format response into 3 clean sections:
     ### Executive Summary
     1-2 concise sentences answering the user's primary query with key numeric takeaways.
     ### Telemetry & Findings
     State concrete facts. Use clean markdown tables when comparing figures:
     | Category / Bucket | Outflow | Allocation | Status |
     Use clean bullet points for specifics. If there is an anomaly or note, use a blockquote: '> **Critical Note:** ...'
     ### Actionable Directives
     Provide 2-3 numbered concrete steps with exact savings computations or target figures.

4. NUMERICAL FORMATTING:
   - Format numbers cleanly with standard currency prefixes (e.g., 'IDR 1,000,000').`;

  const getUserPrompt = (question: string, isEnglish?: boolean) => {
    if (isEnglish) {
      return `VERIFIED USER FINANCIAL TELEMETRY DATA:
1. AUTHENTICATED USER IDENTITY:
   - User Name: ${userName}
   - Logged-in Email: ${userEmail}
   - Primary Currency: ${primaryCurrency}
   - Current Reference Time: ${dateNowStr} (Day ${currentDay} of ${daysInMonth} in ${currentMonthNameEn} ${currentYear}, ${daysRemaining} days remaining)

2. TOTAL NET WORTH & ALL ACCOUNT BALANCES:
   - Total Liquid Balance: IDR ${totalLiquidBalance.toLocaleString("en-US")}
   - Account Balances Breakdown:
${accountsBreakdownText}

3. CURRENT MONTH CASH FLOW (${currentMonthNameEn} ${currentYear}):
   - Recorded Transactions This Month: ${currentMonthTx.length} items
   - Actual Inflow: IDR ${incomeThisMonth.toLocaleString("en-US")}
   - Actual Outflow: IDR ${expenseThisMonth.toLocaleString("en-US")}
   - Net Cash Flow: IDR ${netCashFlowThisMonth.toLocaleString("en-US")} (${netCashFlowThisMonth >= 0 ? "SURPLUS" : "DEFICIT"})
   - Daily Average Outflow: IDR ${dailyAverageExpenseThisMonth.toLocaleString("en-US")}/day
   - Safe Daily Spend Ceiling for Remaining Days: IDR ${safeDailySpendLimitThisMonth.toLocaleString("en-US")}/day
   - Category Outflows (${currentMonthNameEn}):
${topCategoriesThisMonthEn || "     (No outflows recorded yet this month)"}

4. PREVIOUS MONTH CASH FLOW (${lastMonthNameEn} ${lastMonthYear}) [FULL MONTH PATTERN]:
   - Actual Inflow: IDR ${incomeLastMonth.toLocaleString("en-US")}
   - Actual Outflow: IDR ${expenseLastMonth.toLocaleString("en-US")}
   - Net Cash Flow: IDR ${netCashFlowLastMonth.toLocaleString("en-US")} (${netCashFlowLastMonth >= 0 ? "SURPLUS" : "DEFICIT"})
   - Largest Outflow Categories (${lastMonthNameEn}):
${topCategoriesLastMonthEn || "     (No transactions recorded last month)"}

5. ROLLING 30-DAY CASH FLOW (Last 30 Days: ${formatDate(thirtyDaysAgo)} to ${dateNowStr}):
   - Inflow: IDR ${incomeRolling30.toLocaleString("en-US")}
   - Outflow: IDR ${expenseRolling30.toLocaleString("en-US")}
   - Net Cash Flow: IDR ${netCashFlowRolling30.toLocaleString("en-US")} (${netCashFlowRolling30 >= 0 ? "SURPLUS" : "DEFICIT"})
   - Daily Average Outflow: IDR ${dailyAverageRolling30.toLocaleString("en-US")}/day
   - Top 30-Day Expense Categories:
${topCategoriesRolling30En || "     (No outflows recorded)"}

6. ACTIVE BUDGETS THIS MONTH:
${budgetsBreakdownEn}

7. SAMPLE OF 25 MOST RECENT COMPLETED TRANSACTIONS (ALREADY OCCURRED):
${recentTxInfoEn}

8. UPCOMING SCHEDULED TRANSACTIONS (FUTURE COMMITMENTS):
(NOTE: The following items are scheduled in the future, NOT past spent funds)
${upcomingTxInfoEn}

User Query: "${question}"`;
    }

    return `DATA TELEMETRI KEUANGAN PENGGUNA TERVERIFIKASI FIN.IQ:
1. IDENTITAS AKUN LOGIN:
   - Nama Pengguna: ${userName}
   - Email Akun Login: ${userEmail}
   - Mata Uang Utama: ${primaryCurrency}
   - Waktu Permintaan Saat Ini: ${dateNowStr} (Hari ke-${currentDay} dari ${daysInMonth} hari di ${currentMonthNameId} ${currentYear}, sisa ${daysRemaining} hari)

2. TOTAL SALDO & RINCIAN SELURUH AKUN PENGGUNA:
   - Total Saldo Kas (Kekayaan Bersih): Rp ${totalLiquidBalance.toLocaleString("id-ID")}
   - Rincian Saldo Akun Pengguna:
${accountsBreakdownText}

3. ARUS KAS BULAN BERJALAN (${currentMonthNameId} ${currentYear}):
   - Jumlah Transaksi Bulan Ini: ${currentMonthTx.length} mutasi
   - Total Pemasukan Riil: Rp ${incomeThisMonth.toLocaleString("id-ID")}
   - Total Pengeluaran Riil: Rp ${expenseThisMonth.toLocaleString("id-ID")}
   - Arus Kas Bersih (Net Cash Flow): Rp ${netCashFlowThisMonth.toLocaleString("id-ID")} (${netCashFlowThisMonth >= 0 ? "SURPLUS" : "DEFISIT"})
   - Rata-rata Pengeluaran Harian Bulan Ini: Rp ${dailyAverageExpenseThisMonth.toLocaleString("id-ID")}/hari
   - Estimasi Batas Belanja Harian Aman Sisa Bulan Ini: Rp ${safeDailySpendLimitThisMonth.toLocaleString("id-ID")}/hari
   - Rincian Pos Pengeluaran Bulan Ini (${currentMonthNameId}):
${topCategoriesThisMonthId || "     (Belum ada mutasi pengeluaran di bulan berjalan)"}

4. ARUS KAS BULAN LALU (${lastMonthNameId} ${lastMonthYear}) [REFERENSI POLA BULANAN PENUH]:
   - Total Pemasukan: Rp ${incomeLastMonth.toLocaleString("id-ID")}
   - Total Pengeluaran: Rp ${expenseLastMonth.toLocaleString("id-ID")}
   - Arus Kas Bersih (Net Cash Flow): Rp ${netCashFlowLastMonth.toLocaleString("id-ID")} (${netCashFlowLastMonth >= 0 ? "SURPLUS" : "DEFISIT"})
   - Rincian Pos Pengeluaran Terbesar Bulan Lalu (${lastMonthNameId}):
${topCategoriesLastMonthId || "     (Tidak ada data mutasi bulan lalu)"}

5. ARUS KAS ROLLING 30 HARI TERAKHIR (30 Hari Terakhir: ${formatDate(thirtyDaysAgo)} s/d ${dateNowStr}):
   - Total Pemasukan: Rp ${incomeRolling30.toLocaleString("id-ID")}
   - Total Pengeluaran: Rp ${expenseRolling30.toLocaleString("id-ID")}
   - Arus Kas Bersih: Rp ${netCashFlowRolling30.toLocaleString("id-ID")} (${netCashFlowRolling30 >= 0 ? "SURPLUS" : "DEFISIT"})
   - Rata-rata Pengeluaran Harian 30 Hari: Rp ${dailyAverageRolling30.toLocaleString("id-ID")}/hari
   - Rincian Pengeluaran Terbesar 30 Hari Terakhir:
${topCategoriesRolling30Id || "     (Tidak ada data mutasi)"}

6. TARGET ANGGARAN (BUDGETS) BULAN INI:
${budgetsBreakdownId}

7. SAMPEL 25 MUTASI TRANSAKSI TERAKHIR (SUDAH TERJADI):
${recentTxInfoId}

8. TRANSAKSI MENDATANG / TERJADWAL DI MASA DEPAN (SCHEDULED/RECURRING):
(PERHATIAN: Transaksi di bawah ini dijadwalkan terjadi di masa mendatang, BUKAN pengeluaran masa lalu pengguna)
${upcomingTxInfoId}

Pertanyaan Pengguna: "${question}"`;
  };

  return {
    userName,
    userEmail,
    primaryCurrency,
    referenceDateStr: dateNowStr,
    totalBalance: totalLiquidBalance,
    accountsCount: userAccounts.length,
    accountsBreakdownText,
    thisMonth: {
      monthNameId: currentMonthNameId,
      monthNameEn: currentMonthNameEn,
      year: currentYear,
      monthStr: currentMonthStr,
      currentDay,
      daysInMonth,
      daysRemaining,
      income: incomeThisMonth,
      expense: expenseThisMonth,
      net: netCashFlowThisMonth,
      txCount: currentMonthTx.length,
      dailyAverageExpense: dailyAverageExpenseThisMonth,
      safeDailySpendLimit: safeDailySpendLimitThisMonth,
      categoriesBreakdownId: topCategoriesThisMonthId,
      categoriesBreakdownEn: topCategoriesThisMonthEn,
    },
    lastMonth: {
      monthNameId: lastMonthNameId,
      monthNameEn: lastMonthNameEn,
      year: lastMonthYear,
      monthStr: lastMonthStr,
      income: incomeLastMonth,
      expense: expenseLastMonth,
      net: netCashFlowLastMonth,
      txCount: lastMonthTx.length,
      categoriesBreakdownId: topCategoriesLastMonthId,
      categoriesBreakdownEn: topCategoriesLastMonthEn,
    },
    rolling30Days: {
      startDateStr: formatDate(thirtyDaysAgo),
      endDateStr: dateNowStr,
      income: incomeRolling30,
      expense: expenseRolling30,
      net: netCashFlowRolling30,
      txCount: rolling30Tx.length,
      dailyAverageExpense: dailyAverageRolling30,
      categoriesBreakdownId: topCategoriesRolling30Id,
      categoriesBreakdownEn: topCategoriesRolling30En,
    },
    budgetsBreakdownId,
    budgetsBreakdownEn,
    recentTxInfoId,
    recentTxInfoEn,
    upcomingTxInfoId,
    upcomingTxInfoEn,
    systemPromptId,
    systemPromptEn,
    getUserPrompt,
  };
}

/**
 * Fallback Cerdas: Bang Peci Local Financial Telemetry Advisor (Zero-Crash Guarantee)
 * Digunakan jika LLM upstream (OpenRouter/Gemini) mengalami kendala atau kunci API belum dipasang.
 */
export function generateTelemetryFinancialAnswer(
  telemetry: UserFinancialTelemetry,
  question: string,
  isEnglish: boolean = false
): string {
  const q = question.toLowerCase();
  const curr = telemetry.primaryCurrency || "IDR";
  const fmt = (val: number) => formatCurrency(val, curr);

  // 1. Audit Boros / Pengeluaran Terbesar / Kebocoran
  if (
    q.includes("boros") ||
    q.includes("audit") ||
    q.includes("bocor") ||
    q.includes("terbesar") ||
    q.includes("paling banyak") ||
    q.includes("leak") ||
    q.includes("waste")
  ) {
    if (isEnglish) {
      return (
        `### 🔍 Financial Audit: Spending & Leak Analysis\n\n` +
        `Hello **${telemetry.userName}**! Here is the audit of your recent cash flow:\n\n` +
        `- **Total Liquid Balance:** ${fmt(telemetry.totalBalance)}\n` +
        `- **Income This Month (${telemetry.thisMonth.monthNameEn}):** ${fmt(telemetry.thisMonth.income)}\n` +
        `- **Expense This Month:** ${fmt(telemetry.thisMonth.expense)}\n` +
        `- **Net Cash Flow:** ${fmt(telemetry.thisMonth.net)} ${telemetry.thisMonth.net < 0 ? "⚠️ *(Cash Deficit)*" : "✅ *(Surplus)*"}\n\n` +
        `#### 📊 Top Expense Categories:\n${telemetry.thisMonth.categoriesBreakdownEn || "No expenses recorded this month."}\n\n` +
        `#### 💡 Bang Peci's Recommendations:\n` +
        `1. **Cap Largest Categories:** Review your top spending category to trim non-essential items by at least 15-20%.\n` +
        `2. **Check Recurring Outflows:** Inspect subscriptions or irregular purchases in recent transaction logs.\n` +
        `3. **Daily Spend Target:** Keep daily expenses below **${fmt(telemetry.thisMonth.safeDailySpendLimit)}/day** for the rest of this month.` +
        `\n\n---\n> 💡 *Catatan Sistem: Analisis ini disajikan langsung dari data telemetri mutasi riil buku kas Anda. Untuk percakapan Generative AI multi-turn penuh via OpenRouter, Anda dapat menyambungkan API Key OpenRouter aktif di Pengaturan & Profil atau .env.local.*`
      );
    }
    return (
      `### 🔍 Audit Keuangan: Analisis Pos Boros & Kebocoran Kas\n\n` +
      `Halo bos **${telemetry.userName}**! Berikut hasil audit mutasi kas Anda bulan ini:\n\n` +
      `- **Total Saldo Seluruh Akun:** ${fmt(telemetry.totalBalance)}\n` +
      `- **Pemasukan Bulan Ini (${telemetry.thisMonth.monthNameId}):** ${fmt(telemetry.thisMonth.income)}\n` +
      `- **Pengeluaran Bulan Ini:** ${fmt(telemetry.thisMonth.expense)}\n` +
      `- **Arus Kas Bersih (Net):** ${fmt(telemetry.thisMonth.net)} ${telemetry.thisMonth.net < 0 ? "⚠️ *(Defisit Kas)*" : "✅ *(Surplus)*"}\n\n` +
      `#### 📊 Rincian Pos Pengeluaran Terbesar:\n${telemetry.thisMonth.categoriesBreakdownId || "Belum ada transaksi pengeluaran bulan ini."}\n\n` +
      `#### 💡 Rekomendasi Aksi Bang Peci:\n` +
      `1. **Evaluasi Pos Tertinggi:** Fokus pangkas pengeluaran pada pos teratas sebesar 15-20% terutama jika ada belanja konsumtif.\n` +
      `2. **Pantau Arus Kas Harian:** Jaga pengeluaran harian maksimal di kisaran **${fmt(telemetry.thisMonth.safeDailySpendLimit)}/hari** agar sisa bulan tidak defisit.\n` +
      `3. **Periksa Mutasi Kecil Berulang:** Waspadai kebocoran halus seperti jajan harian atau langganan yang tidak terpakai.` +
      `\n\n---\n> 💡 *Catatan Sistem: Analisis ini disajikan langsung dari data telemetri mutasi riil buku kas Anda. Untuk percakapan Generative AI multi-turn penuh via OpenRouter, Anda dapat menyambungkan API Key OpenRouter aktif di Pengaturan & Profil atau .env.local.*`
    );
  }

  // 2. Batas Belanja Harian / Safe Spend
  if (
    q.includes("batas belanja") ||
    q.includes("harian") ||
    q.includes("daily") ||
    q.includes("safe spend") ||
    q.includes("jatah") ||
    q.includes("boncos")
  ) {
    const daysLeft = Math.max(1, telemetry.thisMonth.daysRemaining);
    const safeLimit = telemetry.thisMonth.safeDailySpendLimit;
    const avgSpend = telemetry.thisMonth.dailyAverageExpense;
    const isExceeding = avgSpend > safeLimit && safeLimit > 0;

    if (isEnglish) {
      return (
        `### ☕ Daily Safe Spending Limit\n\n` +
        `Here is your daily allowance calculation for **${telemetry.thisMonth.monthNameEn} ${telemetry.thisMonth.year}**:\n\n` +
        `- **Safe Daily Spend Limit:** **${fmt(safeLimit)} / day**\n` +
        `- **Current Daily Average:** ${fmt(avgSpend)} / day ${isExceeding ? "⚠️ *(Exceeding safe target)*" : "✅ *(On track)*"}\n` +
        `- **Days Remaining in Month:** ${daysLeft} days\n` +
        `- **Month-to-Date Expense:** ${fmt(telemetry.thisMonth.expense)}\n\n` +
        `#### 💡 Bang Peci's Strategy:\n` +
        `Limit daily out-of-pocket spending to no more than **${fmt(safeLimit)}**. Any saved quota boosts your liquid savings at month-end!` +
        `\n\n---\n> 💡 *Catatan Sistem: Dihitung secara matematis dari data mutasi buku kas Anda via Fin.IQ Telemetri.*`
      );
    }
    return (
      `### ☕ Batas Belanja Harian & Panduan Kas Aman\n\n` +
      `Berikut perhitungan batas jatah belanja harian Anda untuk sisa bulan **${telemetry.thisMonth.monthNameId} ${telemetry.thisMonth.year}**:\n\n` +
      `- **Batas Aman Belanja Harian:** **${fmt(safeLimit)} / hari**\n` +
      `- **Rata-rata Pengeluaran Riil:** ${fmt(avgSpend)} / hari ${isExceeding ? "⚠️ *(Di atas batas aman)*" : "✅ *(Aman & Terkendali)*"}\n` +
      `- **Sisa Hari Bulan Ini:** ${daysLeft} hari ke depan\n` +
      `- **Total Pengeluaran Berjalan:** ${fmt(telemetry.thisMonth.expense)}\n\n` +
      `#### 💡 Strategi Eksekusi Bang Peci:\n` +
      `1. Batasi belanja harian (makan, jajan, transportasi) maksimal **${fmt(safeLimit)}/hari**.\n` +
      `2. ${isExceeding ? "Karena rata-rata harian saat ini lebih besar dari batas aman, prioritaskan tunda belanja barang non-primer." : "Pertahankan pola disiplin ini agar akhir bulan surplus!"}` +
      `\n\n---\n> 💡 *Catatan Sistem: Dihitung secara matematis dari data mutasi buku kas Anda via Fin.IQ Telemetri.*`
    );
  }

  // 3. Alokasi Tabungan Pasti / Investasi
  if (
    q.includes("tabungan") ||
    q.includes("menabung") ||
    q.includes("investasi") ||
    q.includes("saving") ||
    q.includes("alokasi")
  ) {
    const net = telemetry.thisMonth.net;
    const income = telemetry.thisMonth.income;
    const recommendedSave = Math.max(0, net > 0 ? Math.floor(net * 0.7) : Math.floor(income * 0.1));

    if (isEnglish) {
      return (
        `### 💰 Recommended Savings Allocation\n\n` +
        `Based on your cash flow for **${telemetry.thisMonth.monthNameEn}**:\n\n` +
        `- **Total Liquid Balance:** ${fmt(telemetry.totalBalance)}\n` +
        `- **Monthly Income:** ${fmt(income)}\n` +
        `- **Monthly Expense:** ${fmt(telemetry.thisMonth.expense)}\n` +
        `- **Net Surplus:** ${fmt(net)}\n\n` +
        `#### 🎯 Recommended Amount to Save:\n` +
        `**${fmt(recommendedSave)}** safe to set aside into high-yield savings or mutual funds.\n\n` +
        `#### 💡 Savings Rule:\n` +
        `Set aside funds immediately at the beginning of the cycle (pay yourself first) rather than waiting for leftovers at month-end.` +
        `\n\n---\n> 💡 *Catatan Sistem: Dihitung secara matematis dari data mutasi buku kas Anda via Fin.IQ Telemetri.*`
      );
    }
    return (
      `### 💰 Rekomendasi Alokasi Tabungan Pasti\n\n` +
      `Berdasarkan analisis arus kas Anda bulan **${telemetry.thisMonth.monthNameId}**:\n\n` +
      `- **Total Saldo Seluruh Rekening:** ${fmt(telemetry.totalBalance)}\n` +
      `- **Pemasukan Bulan Ini:** ${fmt(income)}\n` +
      `- **Pengeluaran Bulan Ini:** ${fmt(telemetry.thisMonth.expense)}\n` +
      `- **Surplus Kas Bersih:** ${fmt(net)}\n\n` +
      `#### 🎯 Nominal Tabungan yang Direkomendasikan:\n` +
      `Bang Peci merekomendasikan menyisihkan **${fmt(recommendedSave)}** langsung ke rekening tabungan terpisah atau reksadana pasar uang.\n\n` +
      `#### 💡 Tips Menabung Efektif:\n` +
      `Gunakan prinsip *Pay Yourself First* — pisahkan alokasi tabungan di awal periode bukan dari sisa belanja di akhir bulan!` +
      `\n\n---\n> 💡 *Catatan Sistem: Dihitung secara matematis dari data mutasi buku kas Anda via Fin.IQ Telemetri.*`
    );
  }

  // 4. Runway Kas / Ketahanan Saldo
  if (
    q.includes("runway") ||
    q.includes("ketahanan") ||
    q.includes("bertahan") ||
    q.includes("berapa bulan") ||
    q.includes("darurat") ||
    q.includes("sustain")
  ) {
    const monthlyBurn = telemetry.rolling30Days.expense || telemetry.thisMonth.expense || 1;
    const runwayMonths = (telemetry.totalBalance / Math.max(1, monthlyBurn)).toFixed(1);

    if (isEnglish) {
      return (
        `### 🛡️ Cash Runway Analysis (Emergency Sustainability)\n\n` +
        `Here is your financial runway based on liquid reserves:\n\n` +
        `- **Total Liquid Reserves:** ${fmt(telemetry.totalBalance)}\n` +
        `- **Average Monthly Expense:** ${fmt(monthlyBurn)}\n` +
        `- **Estimated Cash Runway:** **${runwayMonths} months**\n\n` +
        `#### 💡 Runway Assessment:\n` +
        `${Number(runwayMonths) >= 3 ? "✅ **Healthy!** Your liquid reserves exceed the recommended 3-month emergency fund threshold." : "⚠️ **Warning:** Your runway is below 3 months. Prioritize building up emergency reserves."}` +
        `\n\n---\n> 💡 *Catatan Sistem: Dihitung secara matematis dari data mutasi buku kas Anda via Fin.IQ Telemetri.*`
      );
    }
    return (
      `### 🛡️ Analisis Ketahanan Kas (Cash Runway)\n\n` +
      `Berikut evaluasi daya tahan cadangan kas Anda jika tanpa pemasukan baru:\n\n` +
      `- **Total Saldo Likuid:** ${fmt(telemetry.totalBalance)}\n` +
      `- **Rata-rata Pengeluaran Bulanan:** ${fmt(monthlyBurn)}\n` +
      `- **Ketahanan Kas (Runway):** **${runwayMonths} Bulan**\n\n` +
      `#### 💡 Penilaian Kesehatan Dana Darurat:\n` +
      `${Number(runwayMonths) >= 3 ? "✅ **Kondisi Sehat!** Cadangan likuid Anda memenuhi standar minimal dana darurat (3-6 bulan pengeluaran)." : "⚠️ **Perhatian:** Runway kas Anda masih di bawah 3 bulan. Prioritaskan mempertebal pos dana darurat sebelum konsumtif."}` +
      `\n\n---\n> 💡 *Catatan Sistem: Dihitung secara matematis dari data mutasi buku kas Anda via Fin.IQ Telemetri.*`
    );
  }

  // 5. Default General Financial Health Summary
  if (isEnglish) {
    return (
      `### 📊 Fin.IQ Financial Advisor Overview\n\n` +
      `Hello **${telemetry.userName}**! Here is an overview of your financial telemetry:\n\n` +
      `- **Total Balance:** ${fmt(telemetry.totalBalance)} across ${telemetry.accountsCount} account(s)\n` +
      `- **This Month (${telemetry.thisMonth.monthNameEn}):** Income ${fmt(telemetry.thisMonth.income)} | Expense ${fmt(telemetry.thisMonth.expense)} | Net ${fmt(telemetry.thisMonth.net)}\n` +
      `- **Safe Daily Allowance:** ${fmt(telemetry.thisMonth.safeDailySpendLimit)} / day\n\n` +
      `#### 📌 Accounts Breakdown:\n${telemetry.accountsBreakdownText || "No accounts found."}\n\n` +
      `#### 📌 Top Expenses This Month:\n${telemetry.thisMonth.categoriesBreakdownEn || "No expenses recorded."}\n\n` +
      `You can ask me to **Audit Pos Boros**, calculate **Batas Belanja Harian**, or assess **Ketahanan Kas (Runway)**!` +
      `\n\n---\n> 💡 *Catatan Sistem: Fin.IQ AI Advisor merespon via Analisis Telemetri Finansial. Untuk mengaktifkan percakapan multi-turn bebas OpenRouter, aktifkan API Key OpenRouter di menu Pengaturan & Profil atau .env.local.*`
    );
  }
  return (
    `### 📊 Ringkasan Konsultasi Fin.IQ AI Advisor\n\n` +
    `Halo bos **${telemetry.userName}**! Berikut gambaran kesehatan finansial Anda terkini:\n\n` +
    `- **Total Saldo:** ${fmt(telemetry.totalBalance)} (tersebar di ${telemetry.accountsCount} rekening/dompet)\n` +
    `- **Arus Kas Bulan Ini (${telemetry.thisMonth.monthNameId}):** Pemasukan ${fmt(telemetry.thisMonth.income)} | Pengeluaran ${fmt(telemetry.thisMonth.expense)} | Bersih: ${fmt(telemetry.thisMonth.net)}\n` +
    `- **Batas Belanja Harian Aman:** ${fmt(telemetry.thisMonth.safeDailySpendLimit)} / hari\n\n` +
    `#### 📌 Rincian Saldo Akun:\n${telemetry.accountsBreakdownText || "Belum ada akun terdaftar."}\n\n` +
    `#### 📌 Pos Pengeluaran Terbesar Bulan Ini:\n${telemetry.thisMonth.categoriesBreakdownId || "Belum ada transaksi pengeluaran."}\n\n` +
    `Silakan tanyakan topik spesifik seperti **Audit Pos Boros**, **Batas Belanja Harian**, **Alokasi Tabungan**, atau **Ketahanan Kas**!` +
    `\n\n---\n> 💡 *Catatan Sistem: Fin.IQ AI Advisor merespon via Analisis Telemetri Finansial. Untuk mengaktifkan percakapan multi-turn bebas OpenRouter, aktifkan API Key OpenRouter di menu Pengaturan & Profil atau .env.local.*`
  );
}
