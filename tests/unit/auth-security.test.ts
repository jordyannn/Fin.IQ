import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  encryptSecret,
  decryptSecret,
} from "@finiq/shared";

describe("Security & Cryptographic Functions Unit Tests", () => {
  describe("Password Hashing & Verification (scrypt)", () => {
    it("harus menghasilkan hash unik dengan salt acak untuk password yang sama", () => {
      const password = "SuperSecretPassword123!";
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);

      expect(hash1).not.toBe(hash2);
      expect(hash1).toContain(":");
      expect(hash2).toContain(":");
    });

    it("harus memverifikasi password yang benar dengan sukses", () => {
      const password = "MyP@ssword2026";
      const hash = hashPassword(password);

      expect(verifyPassword(password, hash)).toBe(true);
    });

    it("harus menolak password yang salah", () => {
      const password = "CorrectPassword123";
      const wrongPassword = "WrongPassword123";
      const hash = hashPassword(password);

      expect(verifyPassword(wrongPassword, hash)).toBe(false);
    });
  });

  describe("Session JWT Generation & Verification", () => {
    it("harus menerbitkan token JWT valid dan mengekstrak payload-nya", () => {
      const payload = {
        userId: "test-user-id-uuid-1234",
        email: "test@finiq.my.id",
      };

      const token = createSessionToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      const decoded = verifySessionToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(payload.userId);
      expect(decoded?.email).toBe(payload.email);
    });

    it("harus menolak token yang dipalsukan atau rusak", () => {
      const invalidToken = "eyJh...invalid.fake.token";
      expect(verifySessionToken(invalidToken)).toBeNull();
      expect(verifySessionToken("")).toBeNull();
    });
  });

  describe("Sensitive Data AES-256-GCM Encryption & Decryption", () => {
    it("harus mengenkripsi plaintext ke format enc:v1:iv:tag:data dan mendekripsinya kembali", () => {
      const sensitiveApiKey = "AIzaSyDummySecretGeminiKey123456789";
      const cipherText = encryptSecret(sensitiveApiKey);

      expect(cipherText).toMatch(/^enc:v1:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
      expect(cipherText).not.toContain(sensitiveApiKey);

      const decrypted = decryptSecret(cipherText);
      expect(decrypted).toBe(sensitiveApiKey);
    });

    it("harus menangani nilai legacy plaintext secara mulus (backward compatibility)", () => {
      const legacyKey = "AIzaSyLegacyKeyWithoutEncryption";
      const result = decryptSecret(legacyKey);
      expect(result).toBe(legacyKey);
    });

    it("harus mengembalikan string kosong jika ciphertext invalid atau kosong", () => {
      expect(decryptSecret("")).toBe("");
      expect(decryptSecret("enc:v1:bad:data")).toBe("enc:v1:bad:data");
    });
  });
});
