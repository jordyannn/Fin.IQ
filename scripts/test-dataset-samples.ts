/**
 * Script untuk memverifikasi dan menguji sample dari Fin.IQ Indonesian NLP Dataset
 * Lokasi dataset: dataset/fin_iq_dataset/
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { smartParseIndonesianTransaction } from "../src/lib/nlp-parser";
import { DATASET_TAXONOMY } from "../src/lib/taxonomy-dictionary";

async function main() {
  const datasetPath = path.join(process.cwd(), "dataset", "fin_iq_dataset", "transactions_test.jsonl");

  if (!fs.existsSync(datasetPath)) {
    console.error("Dataset tidak ditemukan di:", datasetPath);
    process.exit(1);
  }

  console.log("📂 Membuka dataset referensi:", datasetPath);
  console.log("📚 Kamus taksonomi terdaftar:", DATASET_TAXONOMY.length, "subkategori");

  const fileStream = fs.createReadStream(datasetPath, { encoding: "utf-8" });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let totalTested = 0;
  let correctKind = 0;
  let correctAmount = 0;
  let samples: any[] = [];

  const mockCategories = DATASET_TAXONOMY.map((t, idx) => ({
    id: `cat-${idx}`,
    name: t.sub,
    kind: t.kind,
  }));

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      const parsed = smartParseIndonesianTransaction(record.text, { categories: mockCategories });

      totalTested++;
      if (parsed.txType === record.kind) correctKind++;
      if (parsed.amount === record.amount) correctAmount++;

      if (samples.length < 5) {
        samples.push({
          text: record.text,
          expected: { kind: record.kind, sub: record.subcategory, amount: record.amount },
          actual: { kind: parsed.txType, catHint: parsed.categoryHint, amount: parsed.amount },
        });
      }

      if (totalTested >= 200) break; // Uji 200 sampel pertama
    } catch (e) {
      // Abaikan baris rusak
    }
  }

  console.log("\n--- HASIL EVALUASI 200 SAMPEL REFERENSI ---");
  console.log(`Total diuji         : ${totalTested}`);
  console.log(`Akurasi Jenis (Kind): ${((correctKind / totalTested) * 100).toFixed(1)}%`);
  console.log(`Akurasi Nominal     : ${((correctAmount / totalTested) * 100).toFixed(1)}%`);
  console.log("\nSampel Pengujian:");
  console.log(JSON.stringify(samples, null, 2));
}

main().catch(console.error);
