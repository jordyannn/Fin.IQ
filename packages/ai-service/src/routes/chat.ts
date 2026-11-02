import { Router, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { eq, desc, and, gte, lte, asc } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import {
  db,
  accounts,
  categories,
  transactions,
  budgets,
  users,
  userProfiles,
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
  clientTime: z.string().optional(),
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

  // 3. User Financial Telemetry Context (Verified & Anti-Hallucination)
  const now = input.clientTime && !isNaN(new Date(input.clientTime).getTime())
    ? new Date(input.clientTime)
    : new Date();

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

  const monthNamesId = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const currentMonthNameId = monthNamesId[currentMonth];

  const startOfThisMonth = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
  const endOfThisMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
  const daysInMonth = endOfThisMonth.getDate();
  const currentDay = Math.min(now.getDate(), daysInMonth);
  const daysRemaining = Math.max(0, daysInMonth - currentDay);

  const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
  const endOfLastMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
  const lastMonthIdx = (currentMonth - 1 + 12) % 12;
  const lastMonthYear = startOfLastMonth.getFullYear();
  const lastMonthNameId = monthNamesId[lastMonthIdx];

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Profil
  const userRec = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  const profileRec = await db.select({ displayName: userProfiles.displayName }).from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  const userEmail = userRec[0]?.email || "pengguna@finiq.app";
  const userName = profileRec[0]?.displayName || userEmail.split("@")[0] || "Pengguna";

  // Akun
  const userAccounts = await db
    .select({ name: accounts.name, group: accounts.group, balance: accounts.balance, isHidden: accounts.isHidden })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  const totalBalance = userAccounts.reduce((acc, a) => acc + (a.balance || 0), 0);
  const accountsInfo = userAccounts.length > 0
    ? userAccounts.map((a) => `- ${a.name} (${a.group}): Rp ${Math.round(a.balance).toLocaleString("id-ID")}${a.isHidden ? " [Disembunyikan]" : ""}`).join("\n")
    : "- Belum ada akun";

  // Bulan Berjalan
  const currentMonthTx = await db
    .select({
      txType: transactions.txType,
      amount: transactions.amount,
      excludeFromStats: transactions.excludeFromStats,
      categoryName: categories.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.happenedAt, startOfThisMonth),
        lte(transactions.happenedAt, now)
      )
    );

  let incomeThisMonth = 0;
  let expenseThisMonth = 0;
  const catExpenseThisMonth: Record<string, number> = {};

  for (const t of currentMonthTx) {
    if (t.txType === "income" && !t.excludeFromStats) incomeThisMonth += t.amount || 0;
    else if (t.txType === "expense" && !t.excludeFromStats) {
      expenseThisMonth += t.amount || 0;
      const c = t.categoryName || "Umum";
      catExpenseThisMonth[c] = (catExpenseThisMonth[c] || 0) + (t.amount || 0);
    }
  }

  const netCashFlowThisMonth = incomeThisMonth - expenseThisMonth;
  const dailyAverageThisMonth = Math.round(expenseThisMonth / Math.max(1, currentDay));
  const safeDailySpendLimit = daysRemaining > 0
    ? Math.max(0, Math.round((netCashFlowThisMonth > 0 ? netCashFlowThisMonth : Math.max(0, totalBalance)) / daysRemaining))
    : 0;

  const topCategoriesThisMonth = Object.entries(catExpenseThisMonth)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([cat, amt]) => {
      const pct = expenseThisMonth > 0 ? Math.round((amt / expenseThisMonth) * 100) : 0;
      return `- ${cat}: Rp ${amt.toLocaleString("id-ID")} (${pct}%)`;
    })
    .join("\n");

  // Bulan Lalu
  const lastMonthTx = await db
    .select({
      txType: transactions.txType,
      amount: transactions.amount,
      excludeFromStats: transactions.excludeFromStats,
      categoryName: categories.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.happenedAt, startOfLastMonth),
        lte(transactions.happenedAt, endOfLastMonth)
      )
    );

  let incomeLastMonth = 0;
  let expenseLastMonth = 0;
  const catExpenseLastMonth: Record<string, number> = {};

  for (const t of lastMonthTx) {
    if (t.txType === "income" && !t.excludeFromStats) incomeLastMonth += t.amount || 0;
    else if (t.txType === "expense" && !t.excludeFromStats) {
      expenseLastMonth += t.amount || 0;
      const c = t.categoryName || "Umum";
      catExpenseLastMonth[c] = (catExpenseLastMonth[c] || 0) + (t.amount || 0);
    }
  }

  const netCashFlowLastMonth = incomeLastMonth - expenseLastMonth;
  const topCategoriesLastMonth = Object.entries(catExpenseLastMonth)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([cat, amt]) => {
      const pct = expenseLastMonth > 0 ? Math.round((amt / expenseLastMonth) * 100) : 0;
      return `- ${cat}: Rp ${amt.toLocaleString("id-ID")} (${pct}%)`;
    })
    .join("\n");

  // Rolling 30 Hari
  const rolling30Tx = await db
    .select({
      txType: transactions.txType,
      amount: transactions.amount,
      excludeFromStats: transactions.excludeFromStats,
      categoryName: categories.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.happenedAt, thirtyDaysAgo),
        lte(transactions.happenedAt, now)
      )
    );

  let incomeRolling30 = 0;
  let expenseRolling30 = 0;
  const catExpenseRolling30: Record<string, number> = {};

  for (const t of rolling30Tx) {
    if (t.txType === "income" && !t.excludeFromStats) incomeRolling30 += t.amount || 0;
    else if (t.txType === "expense" && !t.excludeFromStats) {
      expenseRolling30 += t.amount || 0;
      const c = t.categoryName || "Umum";
      catExpenseRolling30[c] = (catExpenseRolling30[c] || 0) + (t.amount || 0);
    }
  }

  const netCashFlowRolling30 = incomeRolling30 - expenseRolling30;
  const topCategoriesRolling30 = Object.entries(catExpenseRolling30)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([cat, amt]) => {
      const pct = expenseRolling30 > 0 ? Math.round((amt / expenseRolling30) * 100) : 0;
      return `- ${cat}: Rp ${amt.toLocaleString("id-ID")} (${pct}%)`;
    })
    .join("\n");

  // Budgets
  const userBudgets = await db
    .select({ amount: budgets.amount, categoryName: categories.name })
    .from(budgets)
    .leftJoin(categories, eq(budgets.categoryId, categories.id))
    .where(and(eq(budgets.userId, userId), eq(budgets.month, currentMonthStr)));

  const budgetsInfo = userBudgets.length > 0
    ? userBudgets.map((b) => {
        const cat = b.categoryName || "Umum";
        const spent = catExpenseThisMonth[cat] || 0;
        const remaining = b.amount - spent;
        const pct = Math.round((spent / Math.max(1, b.amount)) * 100);
        return `- Pos ${cat}: Budget Rp ${b.amount.toLocaleString("id-ID")} | Terpakai Rp ${spent.toLocaleString("id-ID")} (${pct}%) | Sisa Rp ${remaining.toLocaleString("id-ID")}`;
      }).join("\n")
    : "Belum ada anggaran khusus bulan ini.";

  // Mutasi Terakhir (Completed, happenedAt <= now)
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
    .where(and(eq(transactions.userId, userId), lte(transactions.happenedAt, now)))
    .orderBy(desc(transactions.happenedAt))
    .limit(25);

  const txInfo = recentTx.length > 0
    ? recentTx
        .map(
          (t) =>
            `- [${formatDateStr(t.happenedAt)}] [${t.txType.toUpperCase()}] Rp ${t.amount.toLocaleString("id-ID")} (${t.categoryName || "Umum"} | Akun: ${t.accountName || "Kas"}): "${t.note || "-"}"`
        )
        .join("\n")
    : "Belum ada transaksi.";

  // Mutasi Terjadwal / Masa Depan (happenedAt > now)
  const upcomingTx = await db
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
    .where(and(eq(transactions.userId, userId), gte(transactions.happenedAt, now)))
    .orderBy(asc(transactions.happenedAt))
    .limit(10);

  const upcomingTxInfo = upcomingTx.length > 0
    ? upcomingTx.map(t => `- [${formatDateStr(t.happenedAt)}] [${t.txType.toUpperCase()}] Rp ${t.amount.toLocaleString("id-ID")} (${t.categoryName || "Umum"} | Akun: ${t.accountName || "Kas"}): "${t.note || "-"}"`).join("\n")
    : "Tidak ada transaksi terjadwal mendatang.";

  const dateNowStr = formatDateStr(now);

  const systemPrompt = `Kamu adalah Fin.IQ Chief Financial Advisor, penasihat keuangan pribadi cerdas, analitis, dan berstandar industri perbankan/fintech modern di Indonesia.
TUGAS UTAMA:
Memberikan evaluasi keuangan yang TAJAM, KONKRET, MATEMATIS, dan MENYELESAIKAN MASALAH NYATA PENGGUNA berdasarkan data telemetri yang tersedia.

ATURAN KEBENARAN DATA MUTLAK (ANTI-HALUSINASI):
1. Kamu WAJIB menggunakan HANYA angka, nama akun, saldo, dan riwayat mutasi aktual milik pengguna yang tercantum pada data telemetri.
2. DILARANG KERAS mengarang transaksi, berasumsi di luar data, atau meniru contoh fiktif.
3. Bedakan antara transaksi yang SUDAH TERJADI (happenedAt <= saat ini) dengan TRANSAKSI TERJADWAL/MENDATANG (happenedAt > saat ini). Transaksi terjadwal adalah komitmen pengeluaran di masa depan, BUKAN pengeluaran masa lalu.
4. Gunakan struktur eksekutif 3 bagian:
   ### Ringkasan Eksekutif
   ### Temuan & Analisis Data
   ### Langkah Solutif & Aksi Konkret`;

  const userPrompt = `DATA TELEMETRI KEUANGAN PENGGUNA TERVERIFIKASI FIN.IQ:
1. IDENTITAS AKUN: ${userName} (${userEmail}) | Waktu: ${dateNowStr} (Hari ke-${currentDay} di ${currentMonthNameId} ${currentYear}, sisa ${daysRemaining} hari)
2. TOTAL SALDO & AKUN: Rp ${totalBalance.toLocaleString("id-ID")}
${accountsInfo}
3. ARUS KAS BULAN BERJALAN (${currentMonthNameId} ${currentYear}):
   - Pemasukan: Rp ${incomeThisMonth.toLocaleString("id-ID")} | Pengeluaran: Rp ${expenseThisMonth.toLocaleString("id-ID")} | Net: Rp ${netCashFlowThisMonth.toLocaleString("id-ID")}
   - Rata-rata Harian: Rp ${dailyAverageThisMonth.toLocaleString("id-ID")}/hari | Estimasi Batas Harian Aman Sisa Bulan: Rp ${safeDailySpendLimit.toLocaleString("id-ID")}/hari
   - Top Pengeluaran Bulan Ini:
${topCategoriesThisMonth || "     (Belum ada pengeluaran)"}
4. ARUS KAS BULAN LALU (${lastMonthNameId} ${lastMonthYear}) [POLA BULANAN PENUH]:
   - Pemasukan: Rp ${incomeLastMonth.toLocaleString("id-ID")} | Pengeluaran: Rp ${expenseLastMonth.toLocaleString("id-ID")} | Net: Rp ${netCashFlowLastMonth.toLocaleString("id-ID")}
   - Top Pengeluaran Bulan Lalu:
${topCategoriesLastMonth || "     (Tidak ada data)"}
5. ARUS KAS ROLLING 30 HARI TERAKHIR:
   - Pemasukan: Rp ${incomeRolling30.toLocaleString("id-ID")} | Pengeluaran: Rp ${expenseRolling30.toLocaleString("id-ID")} | Net: Rp ${netCashFlowRolling30.toLocaleString("id-ID")}
   - Top Pengeluaran:
${topCategoriesRolling30 || "     (Tidak ada data)"}
6. TARGET ANGGARAN (BUDGETS):
${budgetsInfo}
7. SAMPEL 25 MUTASI TRANSAKSI TERAKHIR (SUDAH TERJADI):
${txInfo}
8. TRANSAKSI MENDATANG / TERJADWAL DI MASA DEPAN:
${upcomingTxInfo}

Pertanyaan Pengguna: "${input.question}"`;

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
