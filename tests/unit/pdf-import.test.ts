import { describe, it, expect } from "vitest";
import zlib from "zlib";
import {
  extractTextFromPdfBuffer,
  isReadablePdfText,
  extractTransactionsFromAiPayload,
  filterOutSummaryAndBalanceRows,
  fuzzyMatchAccount,
  parseHappenedAt,
} from "../../src/server/trpc/router/import";

function buildTestPdf(objects: string[]): Buffer {
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += obj;
  }
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

describe("PDF Text Extractor & Converter Helpers", () => {
  it("harus mengekstrak teks mutasi dari buffer PDF sederhana", () => {
    const samplePdfB64 =
      "JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMzAwIDE0NF0vQ29udGVudHMgNCAwIFI+PmVuZG9iago0IDAgb2JqPDwvTGVuZ3RoIDUyPj5zdHJlYW0KQVQgL1YxIDEyIFRmIDUwIDUwIFRkIChNYWthbiBCQ0EgNTAwMDApIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTYgMDAwMDAgbiAKMDAwMDAwMDExMSAwMDAwIG4gCjAwMDAwMDAyMTIgMDAwMDAgbiAKdHJhaWxlcjw8L1NpemUgNT4+CnN0YXJ0eHJlZgoyODgKJSVFT0Y=";
    const buf = Buffer.from(samplePdfB64, "base64");
    const extracted = extractTextFromPdfBuffer(buf);

    expect(extracted).toContain("Makan BCA 50000");
  });

  it("harus mengekstrak teks dari stream FlateDecode, tanda kurung escape, dan array TJ", () => {
    const contentStream = zlib.deflateSync(
      Buffer.from(
        "BT /F1 10 Tf 50 750 Td (TRSF \\(KOPI KENANGAN\\)) Tj T* [(01/10/2026) -250 (28.000) -200 (DB)] TJ ET",
        "utf8"
      )
    );
    const pdfBuf = buildTestPdf([
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
      `4 0 obj\n<< /Filter /FlateDecode /Length ${contentStream.length} >>\nstream\n${contentStream.toString("latin1")}\nendstream\nendobj\n`,
      "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    ]);

    const extracted = extractTextFromPdfBuffer(pdfBuf);
    expect(extracted).toContain("TRSF (KOPI KENANGAN)");
    expect(extracted).toContain("01/10/2026 28.000 DB");
  });

  it("harus mendekode CIDFont dengan ToUnicode CMap (format Chrome/E-Statement Bank)", () => {
    // Glyph IDs 0001..0004 mapped to 'B','C','A',' ' and range 0010..0013 -> '1','2','3','4'
    const cmap = zlib.deflateSync(
      Buffer.from(
        `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
4 beginbfchar
<0001> <0042>
<0002> <0043>
<0003> <0041>
<0004> <0020>
endbfchar
1 beginbfrange
<0010> <0013> <0031>
endbfrange
endcmap`,
        "utf8"
      )
    );
    const content = zlib.deflateSync(
      Buffer.from("BT /F1 12 Tf 40 700 Td <00010002000300040010001100120013> Tj ET", "utf8")
    );
    const pdfBuf = buildTestPdf([
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
      `4 0 obj\n<< /Filter /FlateDecode /Length ${content.length} >>\nstream\n${content.toString("latin1")}\nendstream\nendobj\n`,
      "5 0 obj\n<< /Type /Font /Subtype /Type0 /Encoding /Identity-H /ToUnicode 6 0 R >>\nendobj\n",
      `6 0 obj\n<< /Filter /FlateDecode /Length ${cmap.length} >>\nstream\n${cmap.toString("latin1")}\nendstream\nendobj\n`,
    ]);

    const extracted = extractTextFromPdfBuffer(pdfBuf);
    expect(extracted).toContain("BCA 1234");
    expect(isReadablePdfText(extracted)).toBe(true);
  });

  it("harus menolak teks acak/biner sebagai tidak terbaca oleh isReadablePdfText", () => {
    expect(isReadablePdfText("37%$1.&(175$/ $6,$ 7EN(67")).toBe(false);
    expect(isReadablePdfText("")).toBe(false);
    expect(isReadablePdfText("01/10/2026 TRSF KOPI KENANGAN 28.000 DB")).toBe(true);
  });

  it("harus mengekstrak transaksi dari payload AI berbentuk wrapper array maupun JSON terpotong", () => {
    const wrappedArray = JSON.stringify([
      {
        detectedBank: "BCA",
        transactions: [
          { txType: "EXPENSE", amount: 28000, happenedAt: "2026-10-01", note: "Kopi" },
        ],
      },
    ]);
    const res1 = extractTransactionsFromAiPayload(wrappedArray);
    expect(res1.detectedBank).toBe("BCA");
    expect(res1.transactions).toHaveLength(1);
    expect(res1.transactions[0].amount).toBe(28000);

    const truncatedJson =
      '```json\n{"detectedBank":"Mandiri","transactions":[{"txType":"expense","amount":50000,"happenedAt":"2026-10-02","note":"Makan"},{"txType":"income","amount":100';
    const res2 = extractTransactionsFromAiPayload(truncatedJson);
    expect(res2.detectedBank).toBe("Mandiri");
    expect(res2.transactions).toHaveLength(1);
    expect(res2.transactions[0].note).toBe("Makan");
  });

  it("harus mencocokkan nama bank resmi dan nomor rekening ke akun user dengan akurat", () => {
    const userAccs = [
      { id: "1", name: "Kas Tunai" },
      { id: "2", name: "BCA" },
      { id: "3", name: "blu" },
    ];
    expect(fuzzyMatchAccount("PT BANK CENTRAL ASIA Tbk", userAccs)).toBe("BCA");
    expect(fuzzyMatchAccount("1234567890", userAccs, "PT BANK CENTRAL ASIA Tbk")).toBe("BCA");
    expect(fuzzyMatchAccount("Bank", userAccs, "BCA Digital")).toBe("blu");
  });

  it("harus memparse format tanggal teks Indonesia dan DD/MM/YYYY", () => {
    const iso1 = parseHappenedAt("15 Okt 2026", 2026);
    expect(iso1.startsWith("2026-10-15")).toBe(true);
    const iso2 = parseHappenedAt("03/10", 2026);
    expect(iso2.startsWith("2026-10-03")).toBe(true);
  });

  it("harus menyaring baris Total Pemasukan / Pengeluaran / Saldo tapi mempertahankan Biaya Cek Saldo", () => {
    const items = [
      { txType: "income" as const, amount: 5867958, note: "Saldo Awal Periode" },
      { txType: "income" as const, amount: 2506790, note: "Total Pemasukan" },
      { txType: "expense" as const, amount: 2395748, note: "Total Pengeluaran" },
      { txType: "income" as const, amount: 5979000, note: "Saldo Akhir November" },
      { txType: "income" as const, amount: 2500000, note: "Transfer dari BRI Budi" },
      { txType: "income" as const, amount: 6790, note: "Bunga Bank" },
      { txType: "expense" as const, amount: 2000, note: "Biaya Cek Saldo" },
      { txType: "expense" as const, amount: 25000, note: "QRIS Kopi Kenangan" },
      { txType: "expense" as const, amount: 27000, note: "Ringkasan Transaksi" },
    ];

    const filtered = filterOutSummaryAndBalanceRows(items, {
      initialBalance: 5867958,
      totalIncome: 2506790,
      totalExpense: 2395748,
      endingBalance: 5979000,
    });

    expect(filtered.map((x) => x.note)).toEqual([
      "Transfer dari BRI Budi",
      "Bunga Bank",
      "Biaya Cek Saldo",
      "QRIS Kopi Kenangan",
    ]);
  });

  it("harus membuang baris rekap anonim yang jumlahnya sama dengan total di summaryInfo, tanpa membuang transaksi tunggal sah", () => {
    const withDuplicateTotal = [
      { txType: "income" as const, amount: 150000, note: "Transfer Masuk A" },
      { txType: "income" as const, amount: 50000, note: "Cashback" },
      { txType: "income" as const, amount: 200000, note: "Mutasi November" },
    ];
    const filteredDup = filterOutSummaryAndBalanceRows(withDuplicateTotal, {
      totalIncome: 200000,
      totalExpense: null,
    });
    expect(filteredDup.map((x) => x.note)).toEqual(["Transfer Masuk A", "Cashback"]);

    // Kasus 1 transaksi pemasukan sah yang nilainya sama persis dengan totalIncome
    const singleLegitIncome = [
      { txType: "income" as const, amount: 5000000, note: "Gaji Bulanan PT Maju" },
    ];
    const filteredSingle = filterOutSummaryAndBalanceRows(singleLegitIncome, {
      totalIncome: 5000000,
      totalExpense: null,
    });
    expect(filteredSingle).toHaveLength(1);
    expect(filteredSingle[0].note).toBe("Gaji Bulanan PT Maju");
  });

  it("harus mengekstrak summaryInfo bersama detectedBank dan transactions dari JSON AI", () => {
    const payload = JSON.stringify({
      detectedBank: "blu",
      summaryInfo: {
        totalIncome: 2506790,
        totalExpense: 2395748,
        initialBalance: 5867958.2,
        endingBalance: 5979000.2,
      },
      transactions: [
        {
          txType: "expense",
          amount: 2000,
          happenedAt: "2026-11-08T10:15:00",
          categoryName: "Lainnya",
          accountName: "blu",
          note: "Biaya Cek Saldo",
        },
      ],
    });
    const parsed = extractTransactionsFromAiPayload(payload);
    expect(parsed.detectedBank).toBe("blu");
    expect(parsed.summaryInfo?.totalIncome).toBe(2506790);
    expect(parsed.summaryInfo?.totalExpense).toBe(2395748);
    expect(parsed.transactions).toHaveLength(1);
  });
});
