import { describe, it, expect } from "vitest";
import { extractTextFromPdfBuffer } from "../../src/server/trpc/router/import";

describe("PDF Text Extractor", () => {
  it("harus mengekstrak teks mutasi dari buffer PDF", () => {
    // PDF sample base64 sederhana yang memuat stream teks 'Makan BCA 50000'
    const samplePdfB64 =
      "JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMzAwIDE0NF0vQ29udGVudHMgNCAwIFI+PmVuZG9iago0IDAgb2JqPDwvTGVuZ3RoIDUyPj5zdHJlYW0KQVQgL1YxIDEyIFRmIDUwIDUwIFRkIChNYWthbiBCQ0EgNTAwMDApIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTYgMDAwMDAgbiAKMDAwMDAwMDExMSAwMDAwIG4gCjAwMDAwMDAyMTIgMDAwMDAgbiAKdHJhaWxlcjw8L1NpemUgNT4+CnN0YXJ0eHJlZgoyODgKJSVFT0Y=";
    const buf = Buffer.from(samplePdfB64, "base64");
    const extracted = extractTextFromPdfBuffer(buf);

    expect(extracted).toContain("Makan BCA 50000");
  });
});

