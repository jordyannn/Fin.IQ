import { parseSpokenNumber } from "../src/hooks/use-voice-input";
import { cleanNumericAmount, parseInputIDR, formatCurrency, formatInputIDR } from "../src/lib/utils";
import { smartParseIndonesianTransaction, isConfidentDatasetMatch } from "../src/lib/nlp-parser";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

console.log("=== 1. TESTING parseSpokenNumber (Indonesian Voice NLP) ===");
const spokenTests = [
  { input: "lima puluh ribu", expected: 50000 },
  { input: "seratus dua puluh ribu", expected: 120000 },
  { input: "dua juta lima ratus ribu", expected: 2500000 },
  { input: "50rb", expected: 50000 },
  { input: "25k", expected: 25000 },
  { input: "2.5jt", expected: 2500000 },
  { input: "Rp 75.000", expected: 75000 },
  { input: "goceng", expected: 5000 },
  { input: "seceng", expected: 1000 },
  { input: "ceban", expected: 10000 },
  { input: "goban", expected: 50000 },
  { input: "cepek", expected: 100000 },
];

let spokenPass = 0;
for (const test of spokenTests) {
  const result = parseSpokenNumber(test.input);
  const ok = result === test.expected;
  if (ok) spokenPass++;
  console.log(`[${ok ? "PASS" : "FAIL"}] "${test.input}" => ${result} (expected ${test.expected})`);
}
console.log(`Spoken Number Tests: ${spokenPass}/${spokenTests.length} Passed.\n`);

console.log("=== 2. TESTING cleanNumericAmount (OCR & AI Sanitization) ===");
const cleanTests = [
  { input: 50000, expected: 50000 },
  { input: "50000", expected: 50000 },
  { input: "50.000", expected: 50000 },
  { input: "Rp 50.000", expected: 50000 },
  { input: "Rp 1.500.000,00", expected: 1500000 },
  { input: "25,000", expected: 25000 },
  { input: "Rp. 35.500", expected: 35500 },
  { input: 0, expected: 0 },
  { input: "", expected: 0 },
];

let cleanPass = 0;
for (const test of cleanTests) {
  const result = cleanNumericAmount(test.input);
  const ok = result === test.expected;
  if (ok) cleanPass++;
  console.log(`[${ok ? "PASS" : "FAIL"}] ${JSON.stringify(test.input)} => ${result} (expected ${test.expected})`);
}
console.log(`Clean Numeric Tests: ${cleanPass}/${cleanTests.length} Passed.\n`);

console.log("=== 3. TESTING smartParseIndonesianTransaction (Local NLP Parser) ===");
const nlpTests = [
  "Kopi kenangan 25rb bayar bca tadi siang",
  "Beli bensin 50 ribu cash",
  "Gaji bulanan 10 juta transfer masuk mandiri",
  "Goceng bayar parkir",
  "Goban makan siang di warteg",
];

const mockAccounts = [
  { id: "acc-1", name: "BCA", group: "bank" },
  { id: "acc-2", name: "Mandiri", group: "bank" },
  { id: "acc-3", name: "Kas Tunai", group: "cash" },
];

const mockCategories = [
  { id: "cat-1", name: "Makanan & Minuman", kind: "expense" },
  { id: "cat-2", name: "Transportasi", kind: "expense" },
  { id: "cat-3", name: "Gaji & Pendapatan", kind: "income" },
  { id: "cat-4", name: "Dining", kind: "expense" },
];

for (const phrase of nlpTests) {
  const result = smartParseIndonesianTransaction(phrase, {
    accounts: mockAccounts,
    categories: mockCategories,
  });
  console.log(`Input: "${phrase}"`);
  console.log(`  -> Amount: Rp ${result.amount.toLocaleString()}`);
  console.log(`  -> Type: ${result.txType}`);
  console.log(`  -> Account: ${result.accountHint || result.matchedAccountId || "-"}`);
  console.log(`  -> Category: ${result.categoryHint || result.matchedCategoryId || "-"}`);
  console.log(`  -> Note: ${result.cleanNote || result.note}`);
  console.log(`  -> Is Confident Match: ${isConfidentDatasetMatch(result)}`);
}

console.log("\n=== 4. TESTING GEMINI OCR LIVE VISION ===");
const apiKey = process.env.GEMINI_API_KEY || "AQ.Ab8RN6IGdjST8WXK9I-8LIULXF8TAcbXlz-NeN2H6d1v__yN8A";
const ai = new GoogleGenAI({ apiKey });

// 1x1 test pixel
const testBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

try {
  const res = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        inlineData: {
          data: testBase64,
          mimeType: "image/png",
        },
      },
      {
        text: `Ekstrak dokumen transaksi ke JSON:
{
  "documentType": "receipt",
  "txType": "expense",
  "amount": 45000,
  "merchantName": "Alfamart",
  "note": "Alfamart Belanja"
}`,
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });
  console.log("Gemini Vision OCR Response:", res.text?.trim());
  const parsed = JSON.parse(res.text?.trim() || "{}");
  const extractedAmount = cleanNumericAmount(parsed.amount);
  console.log("OCR Extracted & Cleaned Amount:", extractedAmount);
  if (extractedAmount === 45000) {
    console.log(">> OCR LIVE TEST: SUCCESS!");
  }
} catch (e) {
  console.error("OCR Live Test Error:", e.message || e);
}
