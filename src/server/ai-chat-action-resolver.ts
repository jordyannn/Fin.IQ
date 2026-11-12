import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import type { Database } from "./db";
import { aiChatMessages } from "./db/schema";
import {
  type BudgetActionDraft,
  type ChatActionDraft,
  type MilestoneActionDraft,
  type RawLLMAction,
  type TransactionActionDraft,
  extractDraftsFromContent,
  replaceDraftsMarkerInContent,
} from "@/lib/ai-chat-actions";
import {
  detectAccount,
  detectCategory,
  detectTxType,
  extractAmountFromText,
  extractDateTimeFromText,
  findAllAmountsInText,
  parseMultipleItemsAndAmounts,
  smartParseIndonesianTransaction,
} from "@/lib/nlp-parser";
import { fuzzyMatchAccount, fuzzyMatchCategory } from "./trpc/router/import";
import {
  type DbExecutor,
  createVerifiedMilestone,
  createVerifiedTransaction,
  upsertVerifiedBudget,
} from "./financial-actions";

export interface UserEntityCatalog {
  ledgers: { id: string; name: string; currency: string | null }[];
  accounts: {
    id: string;
    name: string;
    group: string;
    currency: string | null;
    balance: number;
  }[];
  categories: { id: string; name: string; kind: string }[];
  currentMonthStr: string;
  referenceDate: Date;
}

function normalizeText(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function resolveLedger(
  requestedName: string | undefined,
  ledgersList: UserEntityCatalog["ledgers"]
): { id: string; name: string; currency: string } {
  const fallback = ledgersList[0];
  if (!fallback) {
    return { id: "", name: "Buku Kas Utama", currency: "IDR" };
  }

  const needle = normalizeText(requestedName);
  if (!needle) {
    return {
      id: fallback.id,
      name: fallback.name,
      currency: fallback.currency || "IDR",
    };
  }

  const exact = ledgersList.find((l) => l.name.toLowerCase() === needle);
  if (exact) {
    return { id: exact.id, name: exact.name, currency: exact.currency || "IDR" };
  }

  const partial = ledgersList.find(
    (l) =>
      l.name.toLowerCase().includes(needle) ||
      needle.includes(l.name.toLowerCase())
  );
  if (partial) {
    return {
      id: partial.id,
      name: partial.name,
      currency: partial.currency || "IDR",
    };
  }

  return {
    id: fallback.id,
    name: fallback.name,
    currency: fallback.currency || "IDR",
  };
}

function resolveAccountByName(
  requestedName: string | undefined,
  userAccounts: UserEntityCatalog["accounts"],
  excludeId?: string
): { id: string; name: string; currency: string } | null {
  const candidates = excludeId
    ? userAccounts.filter((a) => a.id !== excludeId)
    : userAccounts;

  if (candidates.length === 0) return null;

  if (requestedName && requestedName.trim()) {
    const matchedName = fuzzyMatchAccount(requestedName, candidates);
    const exact = candidates.find(
      (a) => a.name.toLowerCase() === matchedName.toLowerCase()
    );
    if (exact) {
      return {
        id: exact.id,
        name: exact.name,
        currency: exact.currency || "IDR",
      };
    }

    const q = requestedName.trim().toLowerCase();
    const loose = candidates.find(
      (a) =>
        a.name.toLowerCase().includes(q) || q.includes(a.name.toLowerCase())
    );
    if (loose) {
      return {
        id: loose.id,
        name: loose.name,
        currency: loose.currency || "IDR",
      };
    }
  }

  const first = candidates[0]!;
  return {
    id: first.id,
    name: first.name,
    currency: first.currency || "IDR",
  };
}

function resolveCategoryByName(
  requestedName: string | undefined,
  userCategories: UserEntityCatalog["categories"],
  preferredKind?: "expense" | "income"
): { id: string; name: string; kind: string } | null {
  const pool = preferredKind
    ? userCategories.filter((c) => c.kind === preferredKind)
    : userCategories;

  if (pool.length === 0) return null;

  if (requestedName && requestedName.trim()) {
    const matchedName = fuzzyMatchCategory(requestedName, pool);
    const exact = pool.find(
      (c) => c.name.toLowerCase() === matchedName.toLowerCase()
    );
    if (exact) return exact;

    const q = requestedName.trim().toLowerCase();
    const loose = pool.find(
      (c) =>
        c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase())
    );
    if (loose) return loose;
  }

  return pool[0]!;
}

function resolveIsoDate(rawDate: string | undefined, fallback: Date): string {
  if (rawDate && rawDate.trim()) {
    const parsed = new Date(rawDate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return fallback.toISOString();
}

function resolveDeadlineDate(
  rawDeadline: string | undefined,
  referenceDate: Date
): string {
  if (rawDeadline && rawDeadline.trim()) {
    const parsed = new Date(rawDeadline);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  const plus30 = new Date(referenceDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  return plus30.toISOString().slice(0, 10);
}

/**
 * Resolves raw LLM action objects (containing human entity names) into concrete
 * `ChatActionDraft` items backed by `ctx.userId`'s verified account/category/ledger IDs.
 */
export function resolveRawActionsToDrafts(
  rawActions: RawLLMAction[],
  catalog: UserEntityCatalog
): ChatActionDraft[] {
  const drafts: ChatActionDraft[] = [];

  for (const raw of rawActions) {
    if (raw.kind === "transaction") {
      const amount = Number(raw.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;

      const rawType = normalizeText(raw.txType);
      const txType: "expense" | "income" | "transfer" =
        rawType === "income" || rawType === "pemasukan"
          ? "income"
          : rawType === "transfer"
            ? "transfer"
            : "expense";

      const ledger = resolveLedger(raw.ledgerName, catalog.ledgers);
      const sourceAcc = resolveAccountByName(raw.accountName, catalog.accounts);

      let toAcc: { id: string; name: string; currency: string | null } | null = null;
      if (txType === "transfer") {
        // Only resolve destination if explicitly named & different from source
        if (raw.toAccountName && raw.toAccountName.trim()) {
          toAcc = resolveAccountByName(
            raw.toAccountName,
            catalog.accounts,
            sourceAcc?.id
          );
        } else if (catalog.accounts.length > 1 && sourceAcc) {
          toAcc =
            catalog.accounts.find((a) => a.id !== sourceAcc.id) ?? null;
        }
      }

      const category =
        txType === "transfer"
          ? null
          : resolveCategoryByName(raw.categoryName, catalog.categories, txType);

      const draft: TransactionActionDraft = {
        id: crypto.randomUUID(),
        kind: "transaction",
        status: "pending",
        txType,
        amount: Math.round(amount),
        currency: sourceAcc?.currency || ledger.currency || "IDR",
        happenedAt: resolveIsoDate(raw.happenedAt, catalog.referenceDate),
        note: (raw.note || "").trim() || "Transaksi via AI Advisor",
        ledgerId: ledger.id,
        ledgerName: ledger.name,
        accountId: sourceAcc?.id ?? "",
        accountName: sourceAcc?.name || raw.accountName || "",
        toAccountId: toAcc?.id,
        toAccountName: toAcc?.name,
        categoryId: category?.id,
        categoryName: category?.name,
        tags: raw.tags?.slice(0, 5) ?? ["ai-advisor"],
      };
      drafts.push(draft);
    } else if (raw.kind === "budget") {
      const amount = Number(raw.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;

      const ledger = resolveLedger(raw.ledgerName, catalog.ledgers);
      const cat = resolveCategoryByName(
        raw.categoryName,
        catalog.categories,
        "expense"
      );
      const month =
        raw.month && /^\d{4}-\d{2}$/.test(raw.month.trim())
          ? raw.month.trim()
          : catalog.currentMonthStr;

      const draft: BudgetActionDraft = {
        id: crypto.randomUUID(),
        kind: "budget",
        status: "pending",
        ledgerId: ledger.id,
        ledgerName: ledger.name,
        categoryId: cat?.id ?? "",
        categoryName: cat?.name || raw.categoryName || "",
        month,
        amount: Math.round(amount),
      };
      drafts.push(draft);
    } else if (raw.kind === "milestone") {
      const targetAmount = Number(raw.targetAmount);
      if (!Number.isFinite(targetAmount) || targetAmount <= 0) continue;

      const dirNorm = normalizeText(raw.trackingDirection);
      const trackingDirection: "savings_goal" | "spending_limit" | "income_goal" =
        dirNorm === "spending_limit" || dirNorm.includes("limit")
          ? "spending_limit"
          : dirNorm === "income_goal" ||
              dirNorm.includes("income") ||
              dirNorm.includes("pemasukan")
            ? "income_goal"
            : "savings_goal";

      const typeNorm = normalizeText(raw.trackingType);
      const trackingType: "account" | "category" =
        typeNorm === "category" ? "category" : "account";

      let trackingId = "all";
      let trackingName = "Semua Akun";

      if (trackingType === "category") {
        const cat = resolveCategoryByName(
          raw.trackingName || raw.title,
          catalog.categories,
          trackingDirection === "spending_limit" ? "expense" : undefined
        );
        trackingId = cat?.id ?? "";
        trackingName = cat?.name || raw.trackingName || "";
      } else {
        const requested = normalizeText(raw.trackingName);
        if (
          requested &&
          !requested.includes("semua") &&
          !requested.includes("all")
        ) {
          const acc = resolveAccountByName(raw.trackingName, catalog.accounts);
          if (acc) {
            trackingId = acc.id;
            trackingName = acc.name;
          }
        } else if (catalog.accounts.length === 1) {
          trackingId = catalog.accounts[0]!.id;
          trackingName = catalog.accounts[0]!.name;
        }
      }

      const resolvedStartDate = raw.startDate
        ? resolveDeadlineDate(raw.startDate, catalog.referenceDate)
        : undefined;

      const draft: MilestoneActionDraft = {
        id: crypto.randomUUID(),
        kind: "milestone",
        status: "pending",
        title: (raw.title || "").trim() || "Target Keuangan",
        targetAmount: Math.round(targetAmount),
        trackingType,
        trackingId,
        trackingName,
        trackingDirection,
        ...(resolvedStartDate ? { startDate: resolvedStartDate } : {}),
        deadline: resolveDeadlineDate(raw.deadline, catalog.referenceDate),
      };
      drafts.push(draft);
    }
  }

  return drafts;
}

const ACTION_COMMAND_REGEX =
  /\b(catat|catatkan|tambahkan|tambah|input|masukkan|simpan|rekam|buatkan|buat|bikin|setel|atur|terapkan|pasang|log|record|add|create|set|apply)\b/i;

const PURE_ANALYTICAL_START_REGEX =
  /^\s*(bagaimana|gimana|apa|apakah|berapa|kenapa|mengapa|tampilkan|lihat|cek|analisis|analisa|evaluasi|ringkas|prediksi|how|what|why|show|analyze|summary)\b/i;

/**
 * Returns true only when the user text contains an actionable intent to record
 * transactions, set monthly budgets, or create milestones. Pure analysis queries return false.
 */
export function hasExplicitActionIntent(question: string): boolean {
  const q = question.trim();
  if (!q) return false;
  const hasCommand = ACTION_COMMAND_REGEX.test(q);
  if (hasCommand) return true;

  // Even without imperative verb, explicit statements like "barusan beli kopi 25rb pakai BCA" count,
  // unless it starts as a pure analytical question.
  if (PURE_ANALYTICAL_START_REGEX.test(q)) return false;

  const hasTransactionCue =
    /\b(beli|bayar|jajan|makan|ngopi|terima gaji|dapat gaji|gajian|transfer ke|kirim ke)\b/i.test(
      q
    ) && extractAmountFromText(q) > 0;

  return hasTransactionCue;
}

/**
 * Deterministic offline fallback extractor invoked when Cloud AI fails/times out,
 * or to recover missed structured drafts from explicit user instructions.
 */
export function extractFallbackActionDrafts(
  question: string,
  catalog: UserEntityCatalog
): ChatActionDraft[] {
  if (!hasExplicitActionIntent(question)) {
    return [];
  }

  const lower = question.toLowerCase();
  const drafts: ChatActionDraft[] = [];

  const isBudgetRequest = /\b(anggaran|budget|pagu)\b/i.test(lower);
  const isMilestoneRequest =
    /\b(target|milestone|dana darurat|tabungan|batas pengeluaran|spending limit|goal)\b/i.test(
      lower
    );

  // Split multi-clause sentences by newline, semicolon, or " lalu " / " terus "
  const clauses = question
    .split(/(?:[\n;]+|\b(?:lalu|terus|kemudian|sekalian)\b)/i)
    .map((c) => c.trim())
    .filter((c) => c.length > 2);

  for (const clause of clauses) {
    const clauseLower = clause.toLowerCase();
    const clauseIsBudget = /\b(anggaran|budget|pagu)\b/i.test(clauseLower);
    const clauseIsMilestone =
      /\b(target|milestone|dana darurat|tabungan|batas pengeluaran|spending limit|goal)\b/i.test(
        clauseLower
      );

    if (clauseIsBudget && !clauseIsMilestone) {
      const amount = extractAmountFromText(clause);
      if (amount > 0) {
        const catRes = detectCategory(clause, "expense", catalog.categories);
        const cat = catRes.matchedCategoryId
          ? catalog.categories.find((c) => c.id === catRes.matchedCategoryId) ??
            null
          : resolveCategoryByName(
              catRes.categoryHint,
              catalog.categories,
              "expense"
            );
        const ledger = resolveLedger(clause, catalog.ledgers);
        const monthMatch = clause.match(/\b(20\d{2}-(?:0[1-9]|1[0-2]))\b/);

        drafts.push({
          id: crypto.randomUUID(),
          kind: "budget",
          status: "pending",
          ledgerId: ledger.id,
          ledgerName: ledger.name,
          categoryId: cat?.id ?? "",
          categoryName: cat?.name || catRes.categoryHint || "",
          month: monthMatch?.[1] || catalog.currentMonthStr,
          amount: Math.round(amount),
        });
        continue;
      }
    }

    if (clauseIsMilestone) {
      const amount = extractAmountFromText(clause);
      if (amount > 0) {
        const isSpendingLimit =
          /\b(batas|limit|maksimal|pengeluaran)\b/i.test(clauseLower) &&
          !/\b(tabungan|dana darurat|saving|terkumpul)\b/i.test(clauseLower);

        const isoDateMatch = clause.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
        const dateRes = extractDateTimeFromText(clause, catalog.referenceDate);
        const deadlineDate =
          isoDateMatch?.[1] ||
          (dateRes.happenedAt
            ? dateRes.happenedAt.toISOString().slice(0, 10)
            : resolveDeadlineDate(undefined, catalog.referenceDate));

        const accRes = detectAccount(clause, catalog.accounts);
        const acc = accRes.matchedAccountId
          ? catalog.accounts.find((a) => a.id === accRes.matchedAccountId) ??
            null
          : resolveAccountByName(accRes.accountHint, catalog.accounts);
        const cleanTitle = clause
          .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, "")
          .replace(
            /\b(buatkan|buat|bikin|setel|atur|tambah|tambahkan|catat|pasang|target|milestone)\b/gi,
            ""
          )
          .replace(/(?:rp\.?\s*)?[\d.,]+\s*(?:jt|juta|rb|ribu|k|m)?/gi, "")
          .replace(/\s+/g, " ")
          .trim();

        drafts.push({
          id: crypto.randomUUID(),
          kind: "milestone",
          status: "pending",
          title:
            cleanTitle.length >= 3
              ? cleanTitle.slice(0, 80)
              : isSpendingLimit
                ? "Batas Pengeluaran"
                : "Target Tabungan",
          targetAmount: Math.round(amount),
          trackingType: "account",
          trackingId: acc?.id || "all",
          trackingName: acc?.name || "Semua Akun",
          trackingDirection: isSpendingLimit ? "spending_limit" : "savings_goal",
          deadline: deadlineDate,
        });
        continue;
      }
    }

    // Check transaction clause (single or multiple items)
    if (isBudgetRequest && isMilestoneRequest) {
      // Already handled budget/milestone priority above if amount present
      const allAmts = findAllAmountsInText(clause);
      if (allAmts.length === 0) continue;
    }

    const multi = parseMultipleItemsAndAmounts(clause);
    if (multi && multi.items.length >= 2) {
      const parsedClause = smartParseIndonesianTransaction(clause, {
        accounts: catalog.accounts,
        categories: catalog.categories,
        referenceDate: catalog.referenceDate,
      });
      const ledger = resolveLedger(clause, catalog.ledgers);
      const sourceAcc = parsedClause.matchedAccountId
        ? catalog.accounts.find((a) => a.id === parsedClause.matchedAccountId) ??
          null
        : resolveAccountByName(parsedClause.accountHint, catalog.accounts);

      for (const item of multi.items) {
        if (!Number.isFinite(item.amount) || item.amount <= 0) continue;
        const itemType = detectTxType(item.name);
        const itemCatRes = detectCategory(
          item.name,
          itemType === "transfer" ? "expense" : itemType,
          catalog.categories
        );
        const itemCat =
          itemType === "transfer"
            ? null
            : itemCatRes.matchedCategoryId
              ? catalog.categories.find(
                  (c) => c.id === itemCatRes.matchedCategoryId
                ) ?? null
              : resolveCategoryByName(
                  itemCatRes.categoryHint,
                  catalog.categories,
                  itemType
                );

        drafts.push({
          id: crypto.randomUUID(),
          kind: "transaction",
          status: "pending",
          txType: itemType,
          amount: Math.round(item.amount),
          currency: sourceAcc?.currency || ledger.currency || "IDR",
          happenedAt: (
            parsedClause.happenedAt || catalog.referenceDate
          ).toISOString(),
          note: item.name,
          ledgerId: ledger.id,
          ledgerName: ledger.name,
          accountId: sourceAcc?.id ?? "",
          accountName: sourceAcc?.name ?? "",
          categoryId: itemCat?.id,
          categoryName: itemCat?.name,
          tags: ["ai-advisor"],
        });
      }
      continue;
    }

    const singleAmt = extractAmountFromText(clause);
    if (singleAmt > 0 && !clauseIsBudget && !clauseIsMilestone) {
      const parsed = smartParseIndonesianTransaction(clause, {
        accounts: catalog.accounts,
        categories: catalog.categories,
        referenceDate: catalog.referenceDate,
      });
      const ledger = resolveLedger(clause, catalog.ledgers);
      const sourceAcc = parsed.matchedAccountId
        ? catalog.accounts.find((a) => a.id === parsed.matchedAccountId) ?? null
        : resolveAccountByName(parsed.accountHint, catalog.accounts);

      let toAcc: { id: string; name: string } | null = null;
      if (parsed.txType === "transfer") {
        // Attempt to match a destination account mentioned after "ke"
        const keMatch = clause.match(/\bke\s+([a-z0-9\s-]{2,24})/i);
        toAcc = resolveAccountByName(
          keMatch?.[1],
          catalog.accounts,
          sourceAcc?.id
        );
      }

      const category =
        parsed.txType === "transfer"
          ? null
          : parsed.matchedCategoryId
            ? catalog.categories.find((c) => c.id === parsed.matchedCategoryId) ??
              null
            : resolveCategoryByName(
                parsed.categoryHint,
                catalog.categories,
                parsed.txType
              );

      drafts.push({
        id: crypto.randomUUID(),
        kind: "transaction",
        status: "pending",
        txType: parsed.txType,
        amount: Math.round(parsed.amount),
        currency:
          (sourceAcc && "currency" in sourceAcc ? sourceAcc.currency : null) ||
          ledger.currency ||
          "IDR",
        happenedAt: (parsed.happenedAt || catalog.referenceDate).toISOString(),
        note: parsed.note || clause.slice(0, 120),
        ledgerId: ledger.id,
        ledgerName: ledger.name,
        accountId: sourceAcc?.id ?? "",
        accountName: sourceAcc?.name ?? "",
        toAccountId: toAcc?.id,
        toAccountName: toAcc?.name,
        categoryId: category?.id,
        categoryName: category?.name,
        tags: ["ai-advisor"],
      });
    }
  }

  return drafts;
}

export interface ExecuteDraftOverrides {
  txType?: "expense" | "income" | "transfer";
  amount?: number;
  happenedAt?: string;
  note?: string;
  ledgerId?: string;
  accountId?: string;
  toAccountId?: string;
  categoryId?: string;
  month?: string;
  title?: string;
  targetAmount?: number;
  trackingType?: "account" | "category";
  trackingId?: string;
  trackingDirection?: "savings_goal" | "spending_limit" | "income_goal";
  startDate?: string;
  deadline?: string;
}

function mergeDraftWithOverrides(
  draft: ChatActionDraft,
  overrides?: ExecuteDraftOverrides
): ChatActionDraft {
  if (!overrides) return draft;
  if (draft.kind === "transaction") {
    return {
      ...draft,
      txType: overrides.txType ?? draft.txType,
      amount:
        overrides.amount !== undefined ? Math.round(overrides.amount) : draft.amount,
      happenedAt: overrides.happenedAt ?? draft.happenedAt,
      note: overrides.note ?? draft.note,
      ledgerId: overrides.ledgerId ?? draft.ledgerId,
      accountId: overrides.accountId ?? draft.accountId,
      toAccountId:
        overrides.toAccountId !== undefined
          ? overrides.toAccountId
          : draft.toAccountId,
      categoryId:
        overrides.categoryId !== undefined
          ? overrides.categoryId
          : draft.categoryId,
    };
  }
  if (draft.kind === "budget") {
    return {
      ...draft,
      ledgerId: overrides.ledgerId ?? draft.ledgerId,
      categoryId: overrides.categoryId ?? draft.categoryId,
      month: overrides.month ?? draft.month,
      amount:
        overrides.amount !== undefined ? Math.round(overrides.amount) : draft.amount,
    };
  }
  return {
    ...draft,
    title: overrides.title ?? draft.title,
    targetAmount:
      overrides.targetAmount !== undefined
        ? Math.round(overrides.targetAmount)
        : draft.targetAmount,
    trackingType: overrides.trackingType ?? draft.trackingType,
    trackingId: overrides.trackingId ?? draft.trackingId,
    trackingDirection: overrides.trackingDirection ?? draft.trackingDirection,
    startDate:
      overrides.startDate !== undefined ? overrides.startDate : draft.startDate,
    deadline: overrides.deadline ?? draft.deadline,
  };
}

async function runVerifiedDraftWrite(
  dbOrTx: DbExecutor,
  userId: string,
  draft: ChatActionDraft
): Promise<string> {
  if (draft.kind === "transaction") {
    const created = await createVerifiedTransaction(dbOrTx, userId, {
      ledgerId: draft.ledgerId,
      txType: draft.txType,
      amount: draft.amount,
      currency: draft.currency,
      happenedAt: draft.happenedAt,
      note: draft.note,
      accountId: draft.accountId,
      toAccountId: draft.toAccountId,
      categoryId: draft.categoryId,
      tags: draft.tags,
    });
    return created.id;
  }

  if (draft.kind === "budget") {
    const upserted = await upsertVerifiedBudget(dbOrTx, userId, {
      ledgerId: draft.ledgerId,
      categoryId: draft.categoryId,
      month: draft.month,
      amount: draft.amount,
    });
    return upserted.id;
  }

  const created = await createVerifiedMilestone(dbOrTx, userId, {
    title: draft.title,
    targetAmount: draft.targetAmount,
    trackingType: draft.trackingType,
    trackingId: draft.trackingId,
    trackingDirection: draft.trackingDirection,
    startDate: draft.startDate,
    deadline: draft.deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  return created.id;
}

/**
 * Atomically executes a single draft or a batch of drafts inside a DB transaction,
 * guaranteeing idempotency against double-clicks and verifying message ownership.
 */
export async function executeChatDraftsInTransaction(
  database: Pick<Database, "transaction">,
  userId: string,
  params: {
    sessionId: string;
    messageId: string;
    items: { draftId: string; overrides?: ExecuteDraftOverrides }[];
  }
) {
  return database.transaction(async (tx) => {
    const baseQuery = tx
      .select({
        id: aiChatMessages.id,
        content: aiChatMessages.content,
        userId: aiChatMessages.userId,
        sessionId: aiChatMessages.sessionId,
      })
      .from(aiChatMessages)
      .where(
        and(
          eq(aiChatMessages.id, params.messageId),
          eq(aiChatMessages.sessionId, params.sessionId),
          eq(aiChatMessages.userId, userId)
        )
      )
      .limit(1);

    const lockedQuery =
      typeof (baseQuery as unknown as { for?: (mode: "update") => typeof baseQuery }).for ===
      "function"
        ? (baseQuery as unknown as { for: (mode: "update") => typeof baseQuery }).for("update")
        : baseQuery;

    const rows = await lockedQuery;
    const messageRow = rows[0];
    if (!messageRow) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Pesan aksi AI tidak ditemukan atau bukan milik Anda.",
      });
    }

    const { drafts } = extractDraftsFromContent(messageRow.content);
    const results: {
      draftId: string;
      status: "saved";
      savedRecordId: string;
      alreadySaved: boolean;
    }[] = [];

    const updatedDrafts = [...drafts];
    let didMutate = false;

    for (const item of params.items) {
      const idx = updatedDrafts.findIndex((d) => d.id === item.draftId);
      if (idx === -1) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Draf aksi ${item.draftId} tidak ditemukan.`,
        });
      }

      const current = updatedDrafts[idx]!;
      if (current.status === "saved") {
        // Idempotent guard: double-click returns existing record without duplicating writes
        results.push({
          draftId: current.id,
          status: "saved",
          savedRecordId: current.savedRecordId || "",
          alreadySaved: true,
        });
        continue;
      }

      if (current.status === "dismissed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Draf ini sudah diabaikan dan tidak dapat disimpan.",
        });
      }

      const resolvedDraft = mergeDraftWithOverrides(current, item.overrides);
      const savedRecordId = await runVerifiedDraftWrite(tx, userId, resolvedDraft);

      updatedDrafts[idx] = {
        ...resolvedDraft,
        status: "saved",
        savedRecordId,
      };
      didMutate = true;

      results.push({
        draftId: current.id,
        status: "saved",
        savedRecordId,
        alreadySaved: false,
      });
    }

    if (didMutate) {
      const nextContent = replaceDraftsMarkerInContent(
        messageRow.content,
        updatedDrafts
      );
      await tx
        .update(aiChatMessages)
        .set({ content: nextContent })
        .where(
          and(
            eq(aiChatMessages.id, messageRow.id),
            eq(aiChatMessages.userId, userId)
          )
        );
    }

    return {
      results,
      drafts: updatedDrafts,
    };
  });
}

/**
 * Atomically marks a pending draft as `dismissed` inside `ai_chat_messages.content`.
 */
export async function dismissChatDraftInTransaction(
  database: Pick<Database, "transaction">,
  userId: string,
  params: { sessionId: string; messageId: string; draftId: string }
) {
  return database.transaction(async (tx) => {
    const baseQuery = tx
      .select({
        id: aiChatMessages.id,
        content: aiChatMessages.content,
      })
      .from(aiChatMessages)
      .where(
        and(
          eq(aiChatMessages.id, params.messageId),
          eq(aiChatMessages.sessionId, params.sessionId),
          eq(aiChatMessages.userId, userId)
        )
      )
      .limit(1);

    const lockedQuery =
      typeof (baseQuery as unknown as { for?: (mode: "update") => typeof baseQuery }).for ===
      "function"
        ? (baseQuery as unknown as { for: (mode: "update") => typeof baseQuery }).for("update")
        : baseQuery;

    const rows = await lockedQuery;
    const messageRow = rows[0];
    if (!messageRow) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Pesan aksi AI tidak ditemukan.",
      });
    }

    const { drafts } = extractDraftsFromContent(messageRow.content);
    const idx = drafts.findIndex((d) => d.id === params.draftId);
    if (idx === -1) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Draf aksi tidak ditemukan.",
      });
    }

    const target = drafts[idx]!;
    if (target.status === "saved") {
      return { drafts, status: "saved" as const };
    }

    const updatedDrafts = [...drafts];
    updatedDrafts[idx] = { ...target, status: "dismissed" };

    const nextContent = replaceDraftsMarkerInContent(
      messageRow.content,
      updatedDrafts
    );
    await tx
      .update(aiChatMessages)
      .set({ content: nextContent })
      .where(
        and(
          eq(aiChatMessages.id, messageRow.id),
          eq(aiChatMessages.userId, userId)
        )
      );

    return { drafts: updatedDrafts, status: "dismissed" as const };
  });
}
