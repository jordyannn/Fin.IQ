/**
 * Shared client/server contract and helpers for AI Chat Action Drafts
 * (transactions, monthly category budgets, and financial milestones/targets).
 *
 * Drafts are persisted inline inside `ai_chat_messages.content` using an HTML
 * comment marker (`<!--FINIQ_DRAFTS:...-->`) so production deployments never
 * require DDL schema migrations.
 */

export type ChatActionDraftStatus = "pending" | "saved" | "dismissed";

export interface TransactionActionDraft {
  id: string;
  kind: "transaction";
  status: ChatActionDraftStatus;
  savedRecordId?: string;
  txType: "expense" | "income" | "transfer";
  amount: number;
  currency: string;
  happenedAt: string; // ISO string
  note: string;
  ledgerId: string;
  ledgerName: string;
  accountId: string;
  accountName: string;
  toAccountId?: string;
  toAccountName?: string;
  categoryId?: string;
  categoryName?: string;
  tags: string[];
}

export interface BudgetActionDraft {
  id: string;
  kind: "budget";
  status: ChatActionDraftStatus;
  savedRecordId?: string;
  ledgerId: string;
  ledgerName: string;
  categoryId: string;
  categoryName: string;
  month: string; // YYYY-MM
  amount: number;
}

export interface MilestoneActionDraft {
  id: string;
  kind: "milestone";
  status: ChatActionDraftStatus;
  savedRecordId?: string;
  title: string;
  targetAmount: number;
  trackingType: "account" | "category";
  trackingId: string;
  trackingName: string;
  trackingDirection: "savings_goal" | "spending_limit";
  deadline?: string; // ISO date string
}

export type ChatActionDraft =
  | TransactionActionDraft
  | BudgetActionDraft
  | MilestoneActionDraft;

export interface RawLLMTransactionAction {
  kind: "transaction";
  txType?: string;
  amount?: number;
  note?: string;
  accountName?: string;
  toAccountName?: string;
  categoryName?: string;
  ledgerName?: string;
  happenedAt?: string;
  tags?: string[];
}

export interface RawLLMBudgetAction {
  kind: "budget";
  amount?: number;
  categoryName?: string;
  ledgerName?: string;
  month?: string;
}

export interface RawLLMMilestoneAction {
  kind: "milestone";
  title?: string;
  targetAmount?: number;
  trackingType?: string;
  trackingName?: string;
  trackingDirection?: string;
  deadline?: string;
}

export type RawLLMAction =
  | RawLLMTransactionAction
  | RawLLMBudgetAction
  | RawLLMMilestoneAction;

const DRAFTS_MARKER_REGEX = /<!--FINIQ_DRAFTS:([A-Za-z0-9+/=_-]+)-->/g;
const FINIQ_ACTIONS_BLOCK_REGEX = /\[FINIQ_ACTIONS\]([\s\S]*?)\[\/FINIQ_ACTIONS\]/gi;
const FINIQ_ACTIONS_DANGLING_REGEX = /\[FINIQ_ACTIONS\][\s\S]*$/gi;

function utf8ToBase64(value: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64");
  }
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToUtf8(b64: string): string {
  const normalized = b64.replace(/-/g, "+").replace(/_/g, "/");
  if (typeof Buffer !== "undefined") {
    return Buffer.from(normalized, "base64").toString("utf8");
  }
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Removes `[FINIQ_ACTIONS]...[/FINIQ_ACTIONS]` blocks and `<!--FINIQ_DRAFTS:...-->`
 * persistence markers so chat markdown remains clean and readable.
 */
export function stripActionTags(text: string): string {
  if (!text) return "";
  return text
    .replace(DRAFTS_MARKER_REGEX, "")
    .replace(FINIQ_ACTIONS_BLOCK_REGEX, "")
    .replace(FINIQ_ACTIONS_DANGLING_REGEX, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Serializes drafts into an HTML comment marker safe for appending to
 * `ai_chat_messages.content`. Returns empty string when there are no drafts.
 */
export function serializeDraftsMarker(drafts: ChatActionDraft[]): string {
  if (!drafts || drafts.length === 0) return "";
  const encoded = utf8ToBase64(JSON.stringify(drafts));
  return `\n\n<!--FINIQ_DRAFTS:${encoded}-->`;
}

function isValidDraftObject(item: unknown): item is ChatActionDraft {
  if (!item || typeof item !== "object") return false;
  const record = item as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id) return false;
  if (
    record.status !== "pending" &&
    record.status !== "saved" &&
    record.status !== "dismissed"
  ) {
    return false;
  }

  if (record.kind === "transaction") {
    return (
      (record.txType === "expense" ||
        record.txType === "income" ||
        record.txType === "transfer") &&
      typeof record.amount === "number" &&
      Number.isFinite(record.amount) &&
      record.amount > 0 &&
      typeof record.accountId === "string" &&
      typeof record.ledgerId === "string"
    );
  }

  if (record.kind === "budget") {
    return (
      typeof record.amount === "number" &&
      Number.isFinite(record.amount) &&
      record.amount > 0 &&
      typeof record.categoryId === "string" &&
      typeof record.ledgerId === "string" &&
      typeof record.month === "string"
    );
  }

  if (record.kind === "milestone") {
    return (
      typeof record.title === "string" &&
      record.title.trim().length > 0 &&
      typeof record.targetAmount === "number" &&
      Number.isFinite(record.targetAmount) &&
      record.targetAmount > 0 &&
      (record.trackingType === "account" || record.trackingType === "category") &&
      (record.trackingDirection === "savings_goal" ||
        record.trackingDirection === "spending_limit")
    );
  }

  return false;
}

/**
 * Extracts persisted drafts and clean markdown text from `ai_chat_messages.content`.
 * Malformed markers are stripped without throwing.
 */
export function extractDraftsFromContent(rawContent: string): {
  cleanText: string;
  drafts: ChatActionDraft[];
} {
  if (!rawContent) {
    return { cleanText: "", drafts: [] };
  }

  const drafts: ChatActionDraft[] = [];
  const matches = Array.from(rawContent.matchAll(DRAFTS_MARKER_REGEX));
  for (const match of matches) {
    const payload = match[1];
    if (!payload) continue;
    try {
      const parsed = JSON.parse(base64ToUtf8(payload));
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (isValidDraftObject(item)) {
            drafts.push(item);
          }
        }
      }
    } catch {
      // Ignore corrupted marker payload gracefully
    }
  }

  return {
    cleanText: stripActionTags(rawContent),
    drafts,
  };
}

/**
 * Replaces the persisted drafts marker inside an existing `ai_chat_messages.content`
 * while preserving the user-visible text.
 */
export function replaceDraftsMarkerInContent(
  rawContent: string,
  drafts: ChatActionDraft[]
): string {
  const cleanText = stripActionTags(rawContent);
  return `${cleanText}${serializeDraftsMarker(drafts)}`;
}

/**
 * Defensively parses `[FINIQ_ACTIONS]{"actions":[...]}[/FINIQ_ACTIONS]` blocks
 * from raw LLM output. Discards invalid/non-positive actions without throwing.
 */
export function parseRawFiniqActionsFromLLM(rawText: string): {
  cleanText: string;
  rawActions: RawLLMAction[];
} {
  if (!rawText) {
    return { cleanText: "", rawActions: [] };
  }

  const rawActions: RawLLMAction[] = [];
  const blocks = Array.from(rawText.matchAll(FINIQ_ACTIONS_BLOCK_REGEX));

  for (const block of blocks) {
    const inner = (block[1] ?? "").trim();
    if (!inner) continue;

    // Strip optional ```json fences the LLM may emit inside the tag
    const stripped = inner
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    try {
      const parsed = JSON.parse(stripped) as
        | { actions?: unknown[] }
        | unknown[];
      const candidates = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.actions)
          ? parsed.actions
          : [];

      for (const item of candidates) {
        if (!item || typeof item !== "object") continue;
        const obj = item as Record<string, unknown>;
        const kind = obj.kind;

        if (kind === "transaction") {
          const amount = Number(obj.amount);
          if (!Number.isFinite(amount) || amount <= 0) continue;
          rawActions.push({
            kind: "transaction",
            txType: typeof obj.txType === "string" ? obj.txType : undefined,
            amount,
            note: typeof obj.note === "string" ? obj.note : undefined,
            accountName:
              typeof obj.accountName === "string" ? obj.accountName : undefined,
            toAccountName:
              typeof obj.toAccountName === "string"
                ? obj.toAccountName
                : undefined,
            categoryName:
              typeof obj.categoryName === "string"
                ? obj.categoryName
                : undefined,
            ledgerName:
              typeof obj.ledgerName === "string" ? obj.ledgerName : undefined,
            happenedAt:
              typeof obj.happenedAt === "string" ? obj.happenedAt : undefined,
            tags: Array.isArray(obj.tags)
              ? obj.tags.filter((t): t is string => typeof t === "string")
              : undefined,
          });
        } else if (kind === "budget") {
          const amount = Number(obj.amount);
          if (!Number.isFinite(amount) || amount <= 0) continue;
          rawActions.push({
            kind: "budget",
            amount,
            categoryName:
              typeof obj.categoryName === "string"
                ? obj.categoryName
                : undefined,
            ledgerName:
              typeof obj.ledgerName === "string" ? obj.ledgerName : undefined,
            month: typeof obj.month === "string" ? obj.month : undefined,
          });
        } else if (kind === "milestone") {
          const targetAmount = Number(obj.targetAmount);
          if (!Number.isFinite(targetAmount) || targetAmount <= 0) continue;
          rawActions.push({
            kind: "milestone",
            title: typeof obj.title === "string" ? obj.title : undefined,
            targetAmount,
            trackingType:
              typeof obj.trackingType === "string"
                ? obj.trackingType
                : undefined,
            trackingName:
              typeof obj.trackingName === "string"
                ? obj.trackingName
                : undefined,
            trackingDirection:
              typeof obj.trackingDirection === "string"
                ? obj.trackingDirection
                : undefined,
            deadline:
              typeof obj.deadline === "string" ? obj.deadline : undefined,
          });
        }
      }
    } catch {
      // Edge case: corrupted or truncated JSON inside [FINIQ_ACTIONS] must not crash
    }
  }

  return {
    cleanText: stripActionTags(rawText),
    rawActions,
  };
}

