import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";
import { db } from "../src/server/db";
import { accounts, categories, transactions, ledgers, users } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

interface CSVRow {
  date: string;
  type: string; // expense, income, transfer
  amount: number;
  account: string; // cash, blu, dana
  toAccount?: string; // for transfer
  category?: string;
  note?: string;
  tags?: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const csvFilePath = args[0] || path.join(__dirname, "../sample-transactions.csv");

  console.log(`📥 [Fin.IQ] Menjalankan import transaksi dari: ${csvFilePath}`);

  if (!fs.existsSync(csvFilePath)) {
    console.log(`⚠️ File CSV '${csvFilePath}' tidak ditemukan.`);
    console.log(`📝 Membuat template contoh CSV di: ${csvFilePath}`);

    const sampleCSV = `date,type,amount,account,toAccount,category,note,tags
2026-03-01 10:30,expense,25000,cash,,Makanan & Minuman,Sarapan Nasi Uduk,sarapan;kuliner
2026-03-01 14:15,expense,50000,blu,,Transportasi,Isi bensin motor,operasional
2026-03-02 12:00,expense,15000,dana,,Makanan & Minuman,Kopi siang,ngopi
2026-03-03 09:00,income,5000000,blu,,Gaji & Pendapatan,Gaji Pokok Bulanan,gaji;kantor
2026-03-03 10:00,transfer,200000,blu,cash,,Tarik tunai ATM,atm;cash
2026-03-04 19:20,expense,85000,dana,,Belanja,Beli pulsa & paket data,pulsa
`;
    fs.writeFileSync(csvFilePath, sampleCSV, "utf-8");
    console.log("✅ File template contoh dibuat. Melanjutkan import data contoh...");
  }

  // 1. Dapatkan User & Ledger aktif
  const defaultUser = await db.query.users.findFirst();
  if (!defaultUser) {
    console.error("❌ Belum ada user di database! Jalankan `npm run seed:accounts` terlebih dahulu.");
    process.exit(1);
  }

  const defaultLedger = await db.query.ledgers.findFirst({
    where: eq(ledgers.userId, defaultUser.id),
  });
  if (!defaultLedger) {
    console.error("❌ Ledger tidak ditemukan. Jalankan `npm run seed:accounts` terlebih dahulu.");
    process.exit(1);
  }

  // 2. Fetch cache akun (cash, blu, dana)
  const userAccounts = await db.query.accounts.findMany({
    where: eq(accounts.userId, defaultUser.id),
  });
  const accountMap = new Map<string, typeof userAccounts[0]>();
  for (const acc of userAccounts) {
    accountMap.set(acc.name.toLowerCase(), acc);
  }

  // 3. Fetch cache kategori
  const userCategories = await db.query.categories.findMany({
    where: eq(categories.userId, defaultUser.id),
  });
  const categoryMap = new Map<string, typeof userCategories[0]>();
  for (const cat of userCategories) {
    categoryMap.set(cat.name.toLowerCase(), cat);
  }

  // 4. Baca file CSV
  const fileContent = fs.readFileSync(csvFilePath, "utf-8");
  const lines = fileContent.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length <= 1) {
    console.log("⚠️ File CSV kosong atau hanya memiliki header.");
    process.exit(0);
  }

  const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
  let importedCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 3) continue;

    const row: any = {};
    header.forEach((h, index) => {
      row[h] = values[index] || "";
    });

    const txType = (row.type || "expense").toLowerCase();
    const amount = parseFloat(row.amount) || 0;
    const accountName = (row.account || "cash").toLowerCase();
    const toAccountName = (row.toaccount || "").toLowerCase();
    const categoryName = (row.category || "").toLowerCase();
    const note = row.note || "";
    const happenedAt = row.date ? new Date(row.date) : new Date();
    const tagsList = row.tags ? row.tags.split(";").map((t: string) => t.trim()) : [];

    // Validasi akun
    const sourceAccount = accountMap.get(accountName);
    if (!sourceAccount) {
      console.warn(`  ⚠️ Baris ${i}: Akun '${accountName}' tidak ditemukan. Melewatkan...`);
      continue;
    }

    let targetAccount = null;
    if (txType === "transfer" && toAccountName) {
      targetAccount = accountMap.get(toAccountName);
    }

    // Validasi atau create kategori
    let catRecord = categoryMap.get(categoryName);
    if (!catRecord && categoryName) {
      const catId = crypto.randomUUID();
      await db
        .insert(categories)
        .values({
          id: catId,
          userId: defaultUser.id,
          name: row.category,
          kind: txType === "income" ? "income" : "expense",
        });
      catRecord = (await db.query.categories.findFirst({
        where: eq(categories.id, catId),
      })) || undefined;
      if (catRecord) {
        categoryMap.set(categoryName, catRecord);
      }
    }

    // Insert transaksi
    await db.insert(transactions).values({
      userId: defaultUser.id,
      ledgerId: defaultLedger.id,
      txType: txType,
      amount: amount,
      currency: "IDR",
      nativeAmount: amount,
      happenedAt: happenedAt,
      note: note,
      accountId: sourceAccount.id,
      toAccountId: targetAccount ? targetAccount.id : null,
      categoryId: catRecord ? catRecord.id : null,
      tagsJson: tagsList,
    });

    // Update saldo akun
    if (txType === "expense") {
      sourceAccount.balance -= amount;
      await db.update(accounts).set({ balance: sourceAccount.balance }).where(eq(accounts.id, sourceAccount.id));
    } else if (txType === "income") {
      sourceAccount.balance += amount;
      await db.update(accounts).set({ balance: sourceAccount.balance }).where(eq(accounts.id, sourceAccount.id));
    } else if (txType === "transfer" && targetAccount) {
      sourceAccount.balance -= amount;
      targetAccount.balance += amount;
      await db.update(accounts).set({ balance: sourceAccount.balance }).where(eq(accounts.id, sourceAccount.id));
      await db.update(accounts).set({ balance: targetAccount.balance }).where(eq(accounts.id, targetAccount.id));
    }

    importedCount++;
  }

  console.log(`\n🎉 Selesai! Berhasil mengimpor ${importedCount} transaksi ke dalam Fin.IQ.`);
  console.log("📊 Status Saldo Terkini:");
  for (const [name, acc] of accountMap.entries()) {
    console.log(`  - ${name.toUpperCase()}: Rp ${acc.balance.toLocaleString("id-ID")}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Terjadi kesalahan import:", err);
  process.exit(1);
});
