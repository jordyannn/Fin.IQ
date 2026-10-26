import { Router, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { eq, desc, and } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import {
  db,
  accounts,
  categories,
  transactions,
  aiChatSessions,
  aiChatMessages,
  aiPromptHistory,
} from "@finiq/shared";
import { requireAuth, AuthRequest } from "../middleware/auth";
import {
  DEFAULT_MODEL_ID,
  getAiQuota,
  consumeAiQuota,
  checkFinancialGuardrail,
  generateOpenRouterCompletion,
  GUARDRAIL_REFUSAL_MESSAGE,
} from "../lib/openrouter";
import { getEffectiveGeminiKey, generateWithFallback } from "../lib/gemini";

export const chatRoutes = Router();

function formatDateStr(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// GET /ai/chat/sessions
chatRoutes.get("/sessions", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;

  const sessions = await db
    .select({
      id: aiChatSessions.id,
      title: aiChatSessions.title,
      modelUsed: aiChatSessions.modelUsed,
      createdAt: aiChatSessions.createdAt,
      updatedAt: aiChatSessions.updatedAt,
    })
    .from(aiChatSessions)
    .where(eq(aiChatSessions.userId, userId))
    .orderBy(desc(aiChatSessions.updatedAt));

  return res.json({
    success: true,
    data: sessions,
  });
});

// GET /ai/chat/sessions/:id
chatRoutes.get("/sessions/:id", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const id = req.params.id as string;

  const sessionRecords = await db
    .select()
    .from(aiChatSessions)
    .where(and(eq(aiChatSessions.id, id), eq(aiChatSessions.userId, userId)))
    .limit(1);

  if (sessionRecords.length === 0) {
    return res.status(404).json({
      success: false,
      error: "NotFound",
      message: "Sesi percakapan tidak ditemukan.",
    });
  }

  const messages = await db
    .select({
      id: aiChatMessages.id,
      role: aiChatMessages.role,
      content: aiChatMessages.content,
      modelUsed: aiChatMessages.modelUsed,
      guardrailBlocked: aiChatMessages.guardrailBlocked,
      createdAt: aiChatMessages.createdAt,
    })
    .from(aiChatMessages)
    .where(eq(aiChatMessages.sessionId, id))
    .orderBy(aiChatMessages.createdAt);

  return res.json({
    success: true,
    data: {
      session: sessionRecords[0],
      messages,
    },
  });
});

// POST /ai/chat/sessions
chatRoutes.post("/sessions", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const { title, model } = z.object({
    title: z.string().optional(),
    model: z.string().optional(),
  }).parse(req.body);

  const sessionId = crypto.randomUUID();
  const sessionTitle = title?.trim() || "Percakapan Baru";
  const modelUsed = model || DEFAULT_MODEL_ID;

  await db.insert(aiChatSessions).values({
    id: sessionId,
    userId,
    title: sessionTitle,
    modelUsed,
  });

  return res.status(201).json({
    success: true,
    data: {
      id: sessionId,
      title: sessionTitle,
      modelUsed,
    },
  });
});

// DELETE /ai/chat/sessions/:id
chatRoutes.delete("/sessions/:id", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const id = req.params.id as string;

  await db
    .delete(aiChatSessions)
    .where(and(eq(aiChatSessions.id, id), eq(aiChatSessions.userId, userId)));

  return res.json({
    success: true,
    message: "Sesi percakapan berhasil dihapus.",
  });
});

// GET /ai/chat/history
chatRoutes.get("/history", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const limit = req.query.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10))) : 30;

  const history = await db
    .select({
      id: aiPromptHistory.id,
      question: aiPromptHistory.question,
      answer: aiPromptHistory.answer,
      modelUsed: aiPromptHistory.modelUsed,
      guardrailBlocked: aiPromptHistory.guardrailBlocked,
      createdAt: aiPromptHistory.createdAt,
    })
    .from(aiPromptHistory)
    .where(eq(aiPromptHistory.userId, userId))
    .orderBy(desc(aiPromptHistory.createdAt))
    .limit(limit);

  return res.json({
    success: true,
    data: history.reverse(),
  });
});

// DELETE /ai/chat/history
chatRoutes.delete("/history", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;

  await db.delete(aiPromptHistory).where(eq(aiPromptHistory.userId, userId));

  return res.json({
    success: true,
    message: "Riwayat percakapan berhasil dibersihkan.",
  });
});

const askAssistantSchema = z.object({
  question: z.string().min(2, "Pertanyaan terlalu pendek"),
  model: z.string().optional(),
  sessionId: z.string().optional(),
  lang: z.enum(["id", "en"]).optional().default("id"),
});

// POST /ai/chat
chatRoutes.post("/", requireAuth, async (req, res: Response) => {
  const { userId } = req as AuthRequest;
  const input = askAssistantSchema.parse(req.body);

  let activeSessionId = input.sessionId;
  const modelId = input.model || DEFAULT_MODEL_ID;
  const isEnglish = input.lang === "en";

  if (!activeSessionId) {
    activeSessionId = crypto.randomUUID();
    const autoTitle =
      input.question.length > 40
        ? `${input.question.substring(0, 37)}...`
        : input.question;
    try {
      await db.insert(aiChatSessions).values({
        id: activeSessionId,
        userId,
        title: autoTitle,
        modelUsed: modelId,
      });
    } catch (sErr) {
      console.error("[Session Create Error]", sErr);
    }
  }

  try {
    await db.insert(aiChatMessages).values({
      sessionId: activeSessionId,
      userId,
      role: "user",
      content: input.question,
    });
  } catch (mErr) {
    console.error("[User Message Save Error]", mErr);
  }

  // 1. Guardrail Pre-filter
  const guardrail = checkFinancialGuardrail(input.question);
  if (guardrail.isOffTopic) {
    const refusalText = isEnglish
      ? "I apologize, but as the Fin.IQ AI Financial Advisor, I only provide analysis and consultation on personal finance, cash flows, transactions, and budget runway. Please submit a personal finance-related query."
      : guardrail.refusal || GUARDRAIL_REFUSAL_MESSAGE;

    try {
      await db.insert(aiChatMessages).values({
        sessionId: activeSessionId,
        userId,
        role: "assistant",
        content: refusalText,
        modelUsed: modelId,
        guardrailBlocked: true,
      });
      await db
        .update(aiChatSessions)
        .set({ updatedAt: new Date() })
        .where(eq(aiChatSessions.id, activeSessionId));
      await db.insert(aiPromptHistory).values({
        userId,
        question: input.question,
        answer: refusalText,
        modelUsed: modelId,
        guardrailBlocked: true,
      });
    } catch (dbErr) {
      console.error("[AI History Save Error]", dbErr);
    }

    return res.json({
      success: true,
      data: {
        answer: refusalText,
        modelUsed: modelId,
        quota: await getAiQuota(userId),
        guardrailBlocked: true,
        sessionId: activeSessionId,
      },
    });
  }

  // 2. Quota Check
  const quotaCheck = await consumeAiQuota(userId);
  if (!quotaCheck.allowed) {
    return res.status(429).json({
      success: false,
      error: "TooManyRequests",
      message: quotaCheck.message || "Batas kuota prompt demo harian Anda telah tercapai.",
    });
  }

  // 3. User Financial Telemetry Context
  const userAccounts = await db
    .select({ name: accounts.name, balance: accounts.balance, currency: accounts.currency })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  const totalBalance = userAccounts.reduce((acc, a) => acc + (a.balance || 0), 0);

  const recentTx = await db
    .select({
      txType: transactions.txType,
      amount: transactions.amount,
      happenedAt: transactions.happenedAt,
      note: transactions.note,
      categoryName: categories.name,
      accountName: accounts.name,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.happenedAt))
    .limit(30);

  const accountsInfo = userAccounts
    .map((a) => `${a.name}: Rp ${a.balance.toLocaleString("id-ID")}`)
    .join(", ");

  let totalExpenseRecent = 0;
  let totalIncomeRecent = 0;
  const categoryExpenseMap: Record<string, number> = {};

  for (const t of recentTx) {
    if (t.txType === "expense") {
      totalExpenseRecent += t.amount || 0;
      const cat = t.categoryName || "Umum";
      categoryExpenseMap[cat] = (categoryExpenseMap[cat] || 0) + (t.amount || 0);
    } else if (t.txType === "income") {
      totalIncomeRecent += t.amount || 0;
    }
  }

  const topCategories = Object.entries(categoryExpenseMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, amt]) => `${cat} (Rp ${amt.toLocaleString("id-ID")})`)
    .join(", ");

  const txInfo = recentTx
    .map(
      (t) =>
        `- [${t.txType.toUpperCase()}] Rp ${t.amount.toLocaleString("id-ID")} (${t.categoryName || "Umum"}): "${t.note || "-"}" pada ${formatDateStr(t.happenedAt)}`
    )
    .join("\n");

  const netCashFlowRecent = totalIncomeRecent - totalExpenseRecent;

  const systemPrompt = `Kamu adalah Fin.IQ Chief Financial Advisor, penasihat keuangan pribadi cerdas, analitis, dan berstandar industri perbankan/fintech modern di Indonesia.
TUGAS UTAMA:
Memberikan evaluasi keuangan yang TAJAM, KONKRET, MATEMATIS, dan MENYELESAIKAN MASALAH NYATA PENGGUNA berdasarkan data telemetri yang tersedia.

TELEMETRI KEUANGAN PENGGUNA:
- Total Saldo / Kekayaan Bersih: Rp ${totalBalance.toLocaleString("id-ID")}
- Rincian Akun: ${accountsInfo || "Belum ada akun"}
- Arus Kas 30 Transaksi Terakhir:
  * Total Pemasukan: Rp ${totalIncomeRecent.toLocaleString("id-ID")}
  * Total Pengeluaran: Rp ${totalExpenseRecent.toLocaleString("id-ID")}
  * Net Cash Flow: Rp ${netCashFlowRecent.toLocaleString("id-ID")}
- Top 5 Pengeluaran: ${topCategories || "Belum ada data"}
- Riwayat Transaksi Terakhir:
${txInfo || "Belum ada transaksi"}

Format jawaban rapi menggunakan Markdown. Berikan insight yang actionable dan solutif.`;

  const userPrompt = input.question;

  try {
    const result = await generateOpenRouterCompletion({
      model: modelId,
      systemPrompt,
      userPrompt,
    });

    try {
      await db.insert(aiChatMessages).values({
        sessionId: activeSessionId,
        userId,
        role: "assistant",
        content: result.text,
        modelUsed: result.modelUsed,
        guardrailBlocked: false,
      });
      await db
        .update(aiChatSessions)
        .set({ updatedAt: new Date() })
        .where(eq(aiChatSessions.id, activeSessionId));
      await db.insert(aiPromptHistory).values({
        userId,
        question: input.question,
        answer: result.text,
        modelUsed: result.modelUsed,
        guardrailBlocked: false,
      });
    } catch (dbErr) {
      console.error("[AI History Save Error]", dbErr);
    }

    return res.json({
      success: true,
      data: {
        answer: result.text,
        modelUsed: result.modelUsed,
        quota: await getAiQuota(userId),
        guardrailBlocked: false,
        sessionId: activeSessionId,
      },
    });
  } catch (err: any) {
    // Fallback to Gemini
    try {
      const geminiKey = await getEffectiveGeminiKey(userId);
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await generateWithFallback(ai, {
        preferredModels: ["gemini-3-flash-preview", "gemini-3.8-flash"],
        contents: `${systemPrompt}\n\n${userPrompt}`,
      });

      const answerText = response.text || "Tidak ada respon dari AI.";
      const modelUsedName = "gemini-3-flash-preview (Personal Fallback)";

      try {
        await db.insert(aiChatMessages).values({
          sessionId: activeSessionId,
          userId,
          role: "assistant",
          content: answerText,
          modelUsed: modelUsedName,
          guardrailBlocked: false,
        });
        await db
          .update(aiChatSessions)
          .set({ updatedAt: new Date() })
          .where(eq(aiChatSessions.id, activeSessionId));
        await db.insert(aiPromptHistory).values({
          userId,
          question: input.question,
          answer: answerText,
          modelUsed: modelUsedName,
          guardrailBlocked: false,
        });
      } catch (dbErr) {
        console.error("[AI History Save Error]", dbErr);
      }

      return res.json({
        success: true,
        data: {
          answer: answerText,
          modelUsed: modelUsedName,
          quota: await getAiQuota(userId),
          guardrailBlocked: false,
          sessionId: activeSessionId,
        },
      });
    } catch {
      return res.status(500).json({
        success: false,
        error: "InternalServerError",
        message: `Gagal memproses pertanyaan dengan AI: ${err.message || "Penyedia model sedang sibuk"}`,
      });
    }
  }
});
