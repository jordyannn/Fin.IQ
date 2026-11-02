import { describe, it, expect } from "vitest";
import {
  deduplicateTranscript,
  cleanSpeechToNote,
  smartParseIndonesianTransaction,
} from "@/lib/nlp-parser";
import { parseSpokenNumber } from "@/hooks/use-voice-input";

describe("Voice Recording Redundancy & Deduplication Tests", () => {
  describe("deduplicateTranscript()", () => {
    it("harus membersihkan kata tunggal yang berulang 3 kali (contoh bug 'kopi kopi kopi')", () => {
      expect(deduplicateTranscript("kopi kopi kopi")).toBe("kopi");
      expect(deduplicateTranscript("KOPI kopi Kopi")).toBe("KOPI");
    });

    it("harus membersihkan kata tunggal yang berulang 2 kali jika bukan kata ulang sah", () => {
      expect(deduplicateTranscript("kopi kopi")).toBe("kopi");
      expect(deduplicateTranscript("beli beli")).toBe("beli");
      expect(deduplicateTranscript("bca bca")).toBe("bca");
    });

    it("harus membersihkan kata berulang dengan tanda hubung tidak sah", () => {
      expect(deduplicateTranscript("kopi-kopi")).toBe("kopi");
      expect(deduplicateTranscript("beli-beli")).toBe("beli");
    });

    it("harus tetap mempertahankan kata ulang sah dalam Bahasa Indonesia (maksimal 2 kali)", () => {
      expect(deduplicateTranscript("oleh-oleh")).toBe("oleh-oleh");
      expect(deduplicateTranscript("oleh oleh")).toBe("oleh oleh");
      expect(deduplicateTranscript("jalan-jalan")).toBe("jalan-jalan");
      expect(deduplicateTranscript("jalan jalan sore")).toBe("jalan jalan sore");
      expect(deduplicateTranscript("hati-hati")).toBe("hati-hati");
      expect(deduplicateTranscript("gado-gado")).toBe("gado-gado");
      expect(deduplicateTranscript("cumi-cumi")).toBe("cumi-cumi");
    });

    it("harus membatasi kata ulang sah jika berulang lebih dari 2 kali akibat glitch mic", () => {
      expect(deduplicateTranscript("oleh oleh oleh")).toBe("oleh oleh");
      expect(deduplicateTranscript("makan makan makan makan")).toBe("makan makan");
    });

    it("harus membersihkan frasa berturut-turut yang terulang (n-gram repetitions)", () => {
      expect(deduplicateTranscript("beli kopi 25rb beli kopi 25rb")).toBe("beli kopi 25rb");
      expect(deduplicateTranscript("kopi 25rb kopi 25rb")).toBe("kopi 25rb");
      expect(deduplicateTranscript("50 ribu 50 ribu")).toBe("50 ribu");
      expect(deduplicateTranscript("sarapan pagi sarapan pagi")).toBe("sarapan pagi");
    });

    it("harus menangani tanda baca koma atau titik pada pengulangan kata", () => {
      expect(deduplicateTranscript("kopi, kopi, kopi")).toBe("kopi");
    });
  });

  describe("parseSpokenNumber() dengan input suara terulang", () => {
    it("tidak boleh melipatgandakan nominal saat kata angka terulang akibat bug mic", () => {
      // Tanpa deduplikasi, 'lima puluh ribu lima puluh ribu' di-parse menjadi 100000
      expect(parseSpokenNumber("lima puluh ribu lima puluh ribu")).toBe(50000);
      expect(parseSpokenNumber("50rb 50rb")).toBe(50000);
      expect(parseSpokenNumber("dua puluh lima ribu dua puluh lima ribu")).toBe(25000);
    });

    it("harus tetap mem-parse angka tunggal normal dengan tepat", () => {
      expect(parseSpokenNumber("lima puluh ribu")).toBe(50000);
      expect(parseSpokenNumber("goceng")).toBe(5000);
      expect(parseSpokenNumber("2,5 juta")).toBe(2500000);
    });
  });

  describe("cleanSpeechToNote() dengan input suara terulang", () => {
    it("harus menghasilkan catatan bersih 'Kopi' dari 'kopi kopi kopi'", () => {
      expect(cleanSpeechToNote("kopi kopi kopi")).toBe("Kopi");
    });

    it("harus menghasilkan catatan bersih dari kalimat transaksi yang mengandung kata terulang", () => {
      expect(cleanSpeechToNote("beli kopi kopi 25rb bayar pake bca")).toBe("Beli kopi");
      expect(cleanSpeechToNote("kopi kopi 25rb")).toBe("Kopi");
    });
  });

  describe("smartParseIndonesianTransaction() dengan input suara terulang", () => {
    it("harus mengekstrak transaksi secara tepat saat user bilang kopi tapi tertangkap 'kopi kopi kopi'", () => {
      const result = smartParseIndonesianTransaction("kopi kopi kopi 25rb bayar bca", {
        accounts: [
          { id: "acc-1", name: "BCA" },
          { id: "acc-2", name: "Kas Tunai" },
        ],
      });

      expect(result.amount).toBe(25000);
      expect(result.txType).toBe("expense");
      expect(result.cleanNote).toBe("Kopi");
      expect(result.note).toBe("Kopi");
      expect(result.accountHint.toLowerCase()).toContain("bca");
    });

    it("harus mengekstrak transaksi saat frasa berulang lengkap", () => {
      const result = smartParseIndonesianTransaction("beli bensin 50rb bayar cash beli bensin 50rb bayar cash", {
        accounts: [{ id: "acc-1", name: "Kas Tunai" }],
      });

      expect(result.amount).toBe(50000);
      expect(result.txType).toBe("expense");
      expect(result.cleanNote).toBe("Beli bensin");
    });
  });
});
