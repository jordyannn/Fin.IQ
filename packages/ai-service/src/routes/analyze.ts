import { Router, Response } from "express";
import { z } from "zod";
import { db, accounts, categories } from "@finiq/shared";
import { eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { getEffectiveGeminiKey, generateWithFallback } from "../lib/gemini";

export const analyzeRoutes = Router();

// POST /ai/analyze/text - Parse raw text to structured transaction
analyzeRoutes.post("/text", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const { text, clientTime } = z.object({
    text: z.string().min(2),
    clientTime: z.string().optional(),
  }).parse(req.body);

  const userAccounts = await db
    .select({ id: accounts.id, name: accounts.name, group: accounts.group })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  const userCategories = await db
    .select({ id: categories.id, name: categories.name, kind: categories.kind })
    .from(categories)
    .where(eq(categories.userId, userId));

  try {
    const apiKey = await getEffectiveGeminiKey(userId);
    const accountNamesStr = userAccounts.map((a) => a.name).join(", ") || "Kas Tunai, BCA";
    const categoryNamesStr = userCategories.map((c) => c.name).join(", ") || "Dining, Transportasi, Umum";

    const prompt = `Kamu adalah parser transaksi keuangan bahasa Indonesia untuk aplikasi Fin.IQ.
Ubah kalimat pengguna berikut menjadi 1 objek JSON transaksi:
"${text}"

Daftar akun pengguna: ${accountNamesStr}.
Daftar kategori pengguna: ${categoryNamesStr}.

FORMAT OUTPUT JSON:
{
  "txType": "expense" | "income" | "transfer",
  "amount": number,
  "happenedAt": "YYYY-MM-DDTHH:mm:ss",
  "categoryName": string,
  "accountName": string,
  "toAccountName": string | null,
  "note": string
}

ATURAN:
1. "amount": integer rupiah positif murni (contoh: 50rb = 50000, 1.5jt = 1500000).
2. "categoryName": pilih yang paling cocok dari [${categoryNamesStr}].
3. "accountName": pilih akun asal yang paling cocok dari [${accountNamesStr}].
4. "happenedAt": ISO datetime string ("YYYY-MM-DDTHH:mm:ss"). Jika disebut kemarin/tadi/besok, hitung dari ${clientTime || new Date().toISOString()}.
5. Kembalikan HANYA JSON.`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await generateWithFallback(ai, {
      preferredModels: ["gemini-3-flash-preview", "gemini-3.8-flash"],
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const jsonStr = (response.text || "{}")
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(jsonStr);

    return res.json({
      success: true,
      data: parsed,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: "AnalyzeError",
      message: `Gagal menganalisis teks: ${err.message || "Penyedia AI sedang sibuk"}`,
    });
  }
});

// POST /ai/analyze/vision - Parse receipt image with Gemini Vision
analyzeRoutes.post("/vision", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const { imageBase64, mimeType = "image/jpeg" } = z.object({
    imageBase64: z.string(),
    mimeType: z.string().optional(),
  }).parse(req.body);

  const userAccounts = await db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  const userCategories = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.userId, userId));

  const accountNamesStr = userAccounts.map((a) => a.name).join(", ") || "Kas Tunai, BCA";
  const categoryNamesStr = userCategories.map((c) => c.name).join(", ") || "Dining, Shopping, Umum";

  const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");

  const prompt = `Kamu adalah sistem AI Vision Keuangan untuk aplikasi Fin.IQ di Indonesia.
Analisis struk belanja, bukti transfer, atau mutasi rekening ini dan ekstrak transaksi ke format JSON:
Daftar akun: ${accountNamesStr}
Daftar kategori: ${categoryNamesStr}

Kembalikan HANYA JSON:
{
  "documentType": "receipt" | "transfer_proof" | "bank_statement",
  "txType": "expense" | "income",
  "amount": number,
  "merchantName": string,
  "happenedAt": "YYYY-MM-DDTHH:mm:ss",
  "suggestedCategory": string,
  "paymentMethod": string,
  "note": string
}`;

  try {
    const apiKey = await getEffectiveGeminiKey(userId);
    const ai = new GoogleGenAI({ apiKey });

    const response = await generateWithFallback(ai, {
      preferredModels: ["gemini-3-flash-preview", "gemini-3.8-flash"],
      contents: [
        {
          inlineData: {
            data: cleanBase64,
            mimeType,
          },
        },
        { text: prompt },
      ],
      config: { responseMimeType: "application/json" },
    });

    const jsonStr = (response.text || "{}")
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(jsonStr);

    return res.json({
      success: true,
      data: parsed,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: "VisionError",
      message: `Gagal membaca gambar: ${err.message || "Penyedia AI sedang sibuk"}`,
    });
  }
});
