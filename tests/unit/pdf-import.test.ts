import { describe, it, expect, vi, afterEach } from "vitest";
import zlib from "zlib";
import {
  importRouter,
  extractTextFromPdfBuffer,
  isReadablePdfText,
  extractTransactionsFromAiPayload,
  filterOutSummaryAndBalanceRows,
  fuzzyMatchAccount,
  parseHappenedAt,
  parseBankStatementTextLocally,
} from "../../src/server/trpc/router/import";
import {
  generateWithFallback,
  isFatalGeminiError,
  ensureGeminiReachable,
  isGeminiMarkedUnreachable,
  resetGeminiReachabilityCache,
} from "../../src/server/gemini";
import {
  generateOpenRouterCompletion,
  getEffectiveOpenRouterKey,
} from "../../src/server/openrouter";

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

describe("Gemini Fatal Bailout & OpenRouter PDF Fallback (k3s/Server)", () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetGeminiReachabilityCache();
    process.env = { ...origEnv };
  });

  it("harus langsung menghentikan retry model Gemini jika terkena geo-block atau network timeout", async () => {
    expect(isFatalGeminiError(new Error("FAILED_PRECONDITION: User location is not supported"))).toBe(true);
    expect(isFatalGeminiError(new Error("Timeout after 25000ms on model gemini-3-flash-preview"))).toBe(true);
    expect(isFatalGeminiError(new Error("fetch failed: ECONNREFUSED"))).toBe(true);
    expect(isFatalGeminiError(new Error("429 RESOURCE_EXHAUSTED"))).toBe(false);

    const generateContent = vi
      .fn()
      .mockRejectedValue(new Error("FAILED_PRECONDITION: User location is not supported"));
    const fakeAi = { models: { generateContent } } as any;

    await expect(
      generateWithFallback(fakeAi, {
        preferredModels: ["gemini-3-flash-preview", "gemini-3.5-flash", "gemini-3.6-flash"],
        contents: [{ text: "hello" }],
      })
    ).rejects.toThrow(/User location is not supported/);

    // Tidak boleh buang waktu mencoba 3 model berikutnya
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("harus mendukung personal sk-or- key di profil dan membersihkan blok <think> + mendukung plugins file-parser", async () => {
    const fakeDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ geminiApiKey: "sk-or-v1-personal-user-key" }],
          }),
        }),
      }),
    };
    const resolvedKey = await getEffectiveOpenRouterKey({ db: fakeDb, userId: "u1" });
    expect(resolvedKey).toBe("sk-or-v1-personal-user-key");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: '<think>reasoning trace</think>\n```json\n{"transactions":[{"note":"Kopi","amount":25000}]}\n```',
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await generateOpenRouterCompletion({
      apiKey: resolvedKey,
      candidateModels: ["baidu/ernie-5.5-flash-preview:free"],
      systemPrompt: "Extract JSON",
      plugins: [{ id: "file-parser", pdf: { engine: "pdf-text" } }],
      userContent: [
        { type: "text", text: "Extract" },
        { type: "file", file: { filename: "mutasi.pdf", file_data: "data:application/pdf;base64,JVBERi0=" } },
      ],
    });

    expect(res.modelUsed).toBe("baidu/ernie-5.5-flash-preview:free");
    expect(res.text).not.toContain("<think>");
    expect(res.text).toContain('"Kopi"');

    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.plugins).toEqual([{ id: "file-parser", pdf: { engine: "pdf-text" } }]);
    expect(sentBody.messages[1].content[1].type).toBe("file");
  });

  it("harus langsung memakai OpenRouter PDF file-parser sebagai default untuk PDF tanpa memanggil Gemini", async () => {
    process.env.GEMINI_API_KEY = "";
    process.env.GEMINI = "";
    process.env.OPENROUTER_API_KEY = "";
    process.env.OPENROUTER = "sk-or-v1-server-env-key";

    // Buat PDF valid dengan stream kosong (tidak ada teks terbaca oleh extractTextFromPdfBuffer)
    const emptyTextPdf = buildTestPdf([
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
      "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
      "3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj\n",
      "4 0 obj << /Length 2 >>\nstream\n  \nendstream\nendobj\n",
    ]);
    expect(extractTextFromPdfBuffer(emptyTextPdf)).toBe("");

    const fetchMock = vi.fn(async (url: string, init?: any) => {
      if (String(url).includes("generativelanguage.googleapis.com")) {
        throw new Error("Gemini tidak boleh dipanggil saat OpenRouter PDF sukses!");
      }
      const body = JSON.parse(init.body);
      expect(body.plugins).toEqual([{ id: "file-parser", pdf: { engine: "pdf-text" } }]);
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  detectedBank: "BCA",
                  summaryInfo: { totalIncome: 0, totalExpense: 25000, initialBalance: 100000, endingBalance: 75000 },
                  transactions: [
                    {
                      txType: "expense",
                      amount: 25000,
                      happenedAt: "2026-11-10T12:00:00",
                      categoryName: "Dining",
                      accountName: "BCA",
                      toAccountName: null,
                      note: "Kopi Kenangan",
                    },
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    // Mock DB: meski ada GEMINI key tersimpan, PDF harus langsung pakai OpenRouter default
    const mockCtx: any = {
      userId: "user-k3s-1",
      db: {
        select: () => ({
          from: () => ({
            where: () =>
              Object.assign(
                Promise.resolve([{ id: "acc-1", name: "BCA", group: "Bank", kind: "expense" }]),
                {
                  limit: async () => [{ geminiApiKey: "AIzaSyFakeServerKey" }],
                }
              ),
          }),
        }),
      },
    };

    const caller = importRouter.createCaller(mockCtx);
    const result = await caller.convertAnyDocument({
      fileName: "mutasi-bca.pdf",
      mimeType: "application/pdf",
      fileBase64: emptyTextPdf.toString("base64"),
    });

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].note).toBe("Kopi Kenangan");
    expect(result.transactions[0].amount).toBe(25000);
    expect(result.modelUsed).toContain("PDF Parser");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("openrouter.ai");
  });

  it("harus meng-cache status Gemini unreachable agar tidak probe ulang dan membatasi totalTimeoutMs OpenRouter", async () => {
    const headFetchMock = vi.fn().mockRejectedValue(new Error("TimeoutError: The operation timed out"));
    vi.stubGlobal("fetch", headFetchMock);

    const firstProbe = await ensureGeminiReachable(500);
    expect(firstProbe.reachable).toBe(false);
    expect(isGeminiMarkedUnreachable().unreachable).toBe(true);
    expect(headFetchMock).toHaveBeenCalledTimes(1);

    // Panggilan berikutnya harus langsung return dari cache (0 network call)
    const secondProbe = await ensureGeminiReachable(500);
    expect(secondProbe.reachable).toBe(false);
    expect(headFetchMock).toHaveBeenCalledTimes(1);

    // Uji totalTimeoutMs pada generateOpenRouterCompletion menghentikan loop saat budget habis
    let attempt = 0;
    const slowFetchMock = vi.fn().mockImplementation(async () => {
      attempt++;
      await new Promise((r) => setTimeout(r, 1400));
      return new Response(JSON.stringify({ error: { message: "rate limited" } }), { status: 429 });
    });
    vi.stubGlobal("fetch", slowFetchMock);

    await expect(
      generateOpenRouterCompletion({
        apiKey: "sk-or-v1-test",
        candidateModels: [
          "baidu/ernie-5.5-flash-preview:free",
          "nvidia/nemotron-3.5-super-vl:free",
          "nvidia/nemotron-3.5-lightning:free",
          "dots-studio/dots-3-note-preview:free",
        ],
        systemPrompt: "sys",
        userPrompt: "usr",
        timeoutMs: 2600,
        totalTimeoutMs: 2600,
      })
    ).rejects.toThrow();
    // Hanya sempat mencoba <= 2 model sebelum deadline 2600ms habis (tidak lanjut ke 4 model)
    expect(attempt).toBeLessThanOrEqual(2);
  });

  it("harus langsung berhenti pada 429 free-models-per-day dan menyelamatkan PDF teks via parser lokal tanpa memanggil Gemini", async () => {
    // 1. generateOpenRouterCompletion langsung berhenti pada percobaan pertama saat 429 free-models-per-day
    const dailyLimitFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: "Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day",
          },
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", dailyLimitFetch);

    await expect(
      generateOpenRouterCompletion({
        apiKey: "sk-or-v1-test",
        candidateModels: [
          "baidu/ernie-5.5-flash-preview:free",
          "nvidia/nemotron-3.5-super-vl:free",
          "nvidia/nemotron-3.5-lightning:free",
          "dots-studio/dots-3-note-preview:free",
        ],
        systemPrompt: "sys",
        userPrompt: "usr",
      })
    ).rejects.toThrow(/Limit harian model gratis OpenRouter/i);
    expect(dailyLimitFetch).toHaveBeenCalledTimes(1);

    // 2. Uji parseBankStatementTextLocally pada mutasi bank Indonesia (blu / BCA)
    const sampleStatement = [
      "Mutasi Rekening blu by BCA Digital",
      "Periode 01 Mar 2026 - 31 Mar 2026",
      "01 Mar 2026 Saldo Awal 1.000.000,00",
      "05/03/2026 QRIS Kopi Kenangan 25.000,00 DB 975.000,00",
      "10/03/2026 Gaji Bulanan PT Maju +5.000.000,00 5.975.000,00",
      "31 Mar 2026 Saldo Akhir 5.975.000,00",
    ].join("\n");

    const localParsed = parseBankStatementTextLocally(sampleStatement, "mutasi-blu.pdf");
    expect(localParsed.detectedBank).toBe("blu");
    expect(localParsed.transactions).toHaveLength(2);
    expect(localParsed.transactions[0]).toMatchObject({
      txType: "expense",
      amount: 25000,
      happenedAt: "2026-03-05",
    });
    expect(localParsed.transactions[1]).toMatchObject({
      txType: "income",
      amount: 5000000,
      happenedAt: "2026-03-10",
    });

    // 3. convertAnyDocument pada PDF teks asli yang terkena 429 harus berhasil lewat parser lokal
    //    DAN tidak pernah memanggil atau mem-probe Gemini ketika OPENROUTER_API_KEY aktif
    process.env.OPENROUTER_API_KEY = "sk-or-v1-test-env-key";
    process.env.GEMINI_API_KEY = "AIzaSyFakeServerKey";
    resetGeminiReachabilityCache();

    const statementStream =
      "BT /F1 12 Tf 72 720 Td (Mutasi Rekening BCA Periode Maret 2026) Tj " +
      "0 -20 Td (05/03/2026 QRIS Kopi Kenangan 25.000,00 DB 975.000,00) Tj " +
      "0 -20 Td (10/03/2026 Transfer Masuk Gaji +5.000.000,00 5.975.000,00) Tj ET";
    const textPdf = buildTestPdf([
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n",
      `4 0 obj\n<< /Length ${statementStream.length} >>\nstream\n${statementStream}\nendstream\nendobj\n`,
    ]);

    const onlyOrLimitFetch = vi.fn().mockImplementation(async (url: string) => {
      expect(String(url)).not.toContain("generativelanguage.googleapis.com");
      return new Response(
        JSON.stringify({ error: { message: "Rate limit exceeded: free-models-per-day" } }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", onlyOrLimitFetch);

    const mockCtx: any = {
      userId: "user-k3s-fallback",
      db: {
        select: () => ({
          from: () => ({
            where: () =>
              Object.assign(
                Promise.resolve([{ id: "acc-1", name: "BCA", group: "Bank", kind: "expense" }]),
                {
                  limit: async () => [{ geminiApiKey: "AIzaSyFakeServerKey", openrouterApiKey: null }],
                }
              ),
          }),
        }),
      },
    };

    const caller = importRouter.createCaller(mockCtx);
    const result = await caller.convertAnyDocument({
      fileName: "mutasi-bca.pdf",
      mimeType: "application/pdf",
      fileBase64: textPdf.toString("base64"),
    });

    expect(result.detectedBank).toBe("BCA");
    expect(result.transactions).toHaveLength(2);
    expect(result.modelUsed).toContain("Local PDF Parser");
    // Hanya 1 fetch ke OpenRouter (langsung berhenti saat 429 daily limit, tidak retry 7 model, tidak probe Gemini)
    expect(onlyOrLimitFetch).toHaveBeenCalledTimes(1);
    expect(String(onlyOrLimitFetch.mock.calls[0][0])).toContain("openrouter.ai");
  });
});
