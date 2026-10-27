import { describe, it, expect } from "vitest";
import request from "supertest";
import coreApp from "../../packages/core-api/src/index";
import aiApp from "../../packages/ai-service/src/index";

describe("Core API & AI Service Integration Tests (Supertest)", () => {
  describe("Core API /health", () => {
    it("harus merespons 200 OK dengan status layanan aktif", async () => {
      const res = await request(coreApp).get("/health");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status", "ok");
      expect(res.body).toHaveProperty("service", "core-api");
      expect(res.body).toHaveProperty("timestamp");
    });

    it("harus menyertakan header rate limit dari Redis / memory limiter", async () => {
      const res = await request(coreApp).get("/health");

      expect(res.headers).toHaveProperty("x-ratelimit-limit");
      expect(res.headers).toHaveProperty("x-ratelimit-remaining");
    });
  });

  describe("Autentikasi & Proteksi Endpoint Privat", () => {
    it("harus menolak request ke /transactions jika tanpa header Authorization (401)", async () => {
      const res = await request(coreApp).get("/transactions");

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("success", false);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("harus menolak request ke /transactions jika token Bearer palsu/rusak (401)", async () => {
      const res = await request(coreApp)
        .get("/transactions")
        .set("Authorization", "Bearer token_palsu_tidak_valid_12345");

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("success", false);
    });

    it("harus menolak login dengan kredensial salah (401)", async () => {
      const res = await request(coreApp)
        .post("/auth/login")
        .send({
          email: "user_palsu_tidak_ada@finiq.my.id",
          password: "password_salah_123",
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("success", false);
    });

    it("harus menolak request registrasi dengan format input tidak lengkap (400)", async () => {
      const res = await request(coreApp)
        .post("/auth/register")
        .send({
          email: "invalid-email-format",
          // missing password and displayName
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("success", false);
    });
  });

  describe("AI Service Endpoints", () => {
    it("harus merespons /health dengan status ok", async () => {
      const res = await request(aiApp).get("/health");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status", "ok");
      expect(res.body).toHaveProperty("service", "ai-service");
    });

    it("harus mengembalikan daftar kurasi model AI publik di /ai/models", async () => {
      const res = await request(aiApp).get("/ai/models");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(Array.isArray(res.body.data.models)).toBe(true);
      expect(res.body.data.models.length).toBeGreaterThan(0);
    });

    it("harus memblokir akses ke /ai/chat jika tanpa token autentikasi (401)", async () => {
      const res = await request(aiApp)
        .post("/ai/chat")
        .send({ question: "Berapa sisa uang saya?" });

      expect(res.status).toBe(401);
    });
  });
});
