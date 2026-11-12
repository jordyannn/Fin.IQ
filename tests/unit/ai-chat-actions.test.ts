import { describe, it, expect } from "vitest";
import {
  extractDraftsFromContent,
  parseRawFiniqActionsFromLLM,
  serializeDraftsMarker,
  stripActionTags,
  type ChatActionDraft,
} from "../../src/lib/ai-chat-actions";
import {
  dismissChatDraftInTransaction,
  executeChatDraftsInTransaction,
  extractFallbackActionDrafts,
  hasExplicitActionIntent,
  resolveRawActionsToDrafts,
  type UserEntityCatalog,
} from "../../src/server/ai-chat-action-resolver";

const SAMPLE_CATALOG: UserEntityCatalog = {
  ledgers: [
    { id: "ldg-main", name: "Buku Kas Utama", currency: "IDR" },
    { id: "ldg-biz", name: "Buku Kas Usaha", currency: "IDR" },
  ],
  accounts: [
    { id: "acc-bca", name: "Bank BCA", group: "bank", currency: "IDR", balance: 5_000_000 },
    { id: "acc-gopay", name: "GoPay", group: "ewallet", currency: "IDR", balance: 300_000 },
  ],
  categories: [
    { id: "cat-food", name: "Makanan & Minuman", kind: "expense" },
    { id: "cat-trans", name: "Transportasi", kind: "expense" },
    { id: "cat-salary", name: "Gaji", kind: "income" },
  ],
  currentMonthStr: "2026-11",
  referenceDate: new Date("2026-11-12T05:00:00.000Z"),
};

describe("AI Chat Action Contract & Persistence Markers", () => {
  it("serializes and extracts drafts safely even when notes contain HTML comment sequences (--)", () => {
    const drafts: ChatActionDraft[] = [
      {
        id: "d-1",
        kind: "transaction",
        status: "pending",
        txType: "expense",
        amount: 45000,
        currency: "IDR",
        happenedAt: "2026-11-12T05:00:00.000Z",
        note: "Kopi -- siang --> kantor",
        ledgerId: "ldg-main",
        ledgerName: "Buku Kas Utama",
        accountId: "acc-bca",
        accountName: "Bank BCA",
        categoryId: "cat-food",
        categoryName: "Makanan & Minuman",
        tags: ["ai-advisor"],
      },
    ];

    const marker = serializeDraftsMarker(drafts);
    const persisted = `### Ringkasan Eksekutif\nDraf siap dicatat.${marker}`;

    const extracted = extractDraftsFromContent(persisted);
    expect(extracted.cleanText).toBe("### Ringkasan Eksekutif\nDraf siap dicatat.");
    expect(extracted.drafts).toHaveLength(1);
    expect(extracted.drafts[0]).toMatchObject({
      id: "d-1",
      kind: "transaction",
      amount: 45000,
      note: "Kopi -- siang --> kantor",
      status: "pending",
    });
  });

  it("defensively strips truncated/corrupted [FINIQ_ACTIONS] JSON blocks and invalid non-positive amounts", () => {
    const truncatedOutput =
      "Analisis selesai.\n[FINIQ_ACTIONS]{\"actions\":[{\"kind\":\"transaction\",\"amount\":";
    const parsedBroken = parseRawFiniqActionsFromLLM(truncatedOutput);
    expect(parsedBroken.cleanText).toBe("Analisis selesai.");
    expect(parsedBroken.rawActions).toEqual([]);

    const mixedOutput = `Siap bos!
[FINIQ_ACTIONS]
{
  "actions": [
    {"kind": "transaction", "txType": "expense", "amount": -5000, "note": "Invalid negative"},
    {"kind": "budget", "amount": 0, "categoryName": "Makanan"},
    {"kind": "transaction", "txType": "expense", "amount": 35000, "accountName": "BCA", "categoryName": "Makanan", "note": "Nasi Goreng"},
    {"kind": "budget", "amount": 1500000, "categoryName": "Makanan", "month": "2026-11"},
    {"kind": "milestone", "title": "Dana Darurat", "targetAmount": 10000000, "trackingType": "account", "trackingName": "Bank BCA", "trackingDirection": "savings_goal", "deadline": "2026-12-31"}
  ]
}
[/FINIQ_ACTIONS]`;

    const parsedMixed = parseRawFiniqActionsFromLLM(mixedOutput);
    expect(parsedMixed.cleanText).toBe("Siap bos!");
    expect(parsedMixed.rawActions).toHaveLength(3);
    expect(stripActionTags(mixedOutput)).toBe("Siap bos!");
  });
});

describe("Server Entity Resolution & Deterministic Fallback Extractor", () => {
  it("resolves LLM human entity names to real DB IDs for transactions, budgets, and milestones", () => {
    const { rawActions } = parseRawFiniqActionsFromLLM(`
[FINIQ_ACTIONS]{"actions":[
  {"kind":"transaction","txType":"expense","amount":50000,"accountName":"BCA","categoryName":"Makan","note":"Sate"},
  {"kind":"budget","amount":1200000,"categoryName":"Makanan","ledgerName":"Usaha","month":"2026-11"},
  {"kind":"milestone","title":"Dana Darurat","targetAmount":15000000,"trackingType":"account","trackingName":"BCA","trackingDirection":"savings_goal","deadline":"2026-12-31"}
]}[/FINIQ_ACTIONS]`);

    const drafts = resolveRawActionsToDrafts(rawActions, SAMPLE_CATALOG);
    expect(drafts).toHaveLength(3);

    expect(drafts[0]).toMatchObject({
      kind: "transaction",
      accountId: "acc-bca",
      categoryId: "cat-food",
      ledgerId: "ldg-main",
      amount: 50000,
    });
    expect(drafts[1]).toMatchObject({
      kind: "budget",
      categoryId: "cat-food",
      ledgerId: "ldg-biz",
      amount: 1200000,
    });
    expect(drafts[2]).toMatchObject({
      kind: "milestone",
      trackingType: "account",
      trackingId: "acc-bca",
      trackingDirection: "savings_goal",
      targetAmount: 15000000,
    });
  });

  it("extracts multi-item transactions & targets offline, while ignoring pure analytical questions", () => {
    expect(hasExplicitActionIntent("Bagaimana pengeluaran saya bulan ini?")).toBe(false);
    expect(
      extractFallbackActionDrafts("Bagaimana pengeluaran saya bulan ini?", SAMPLE_CATALOG)
    ).toEqual([]);

    const multiDrafts = extractFallbackActionDrafts(
      "Catat pengeluaran kopi 25rb dan nasi goreng 35rb pakai GoPay",
      SAMPLE_CATALOG
    );
    expect(multiDrafts).toHaveLength(2);
    expect(multiDrafts[0]).toMatchObject({
      kind: "transaction",
      amount: 25000,
      accountId: "acc-gopay",
    });
    expect(multiDrafts[1]).toMatchObject({
      kind: "transaction",
      amount: 35000,
      accountId: "acc-gopay",
    });

    const targetDrafts = extractFallbackActionDrafts(
      "Buatkan target dana darurat 10jt di BCA sampai 2026-12-31",
      SAMPLE_CATALOG
    );
    expect(targetDrafts).toHaveLength(1);
    expect(targetDrafts[0]).toMatchObject({
      kind: "milestone",
      targetAmount: 10000000,
      trackingId: "acc-bca",
      trackingDirection: "savings_goal",
      deadline: "2026-12-31",
    });
  });

  it("handles user without accounts gracefully by leaving accountId empty", () => {
    const emptyAccountsCatalog: UserEntityCatalog = {
      ...SAMPLE_CATALOG,
      accounts: [],
    };
    const drafts = resolveRawActionsToDrafts(
      [{ kind: "transaction", txType: "expense", amount: 20000, note: "Bakso" }],
      emptyAccountsCatalog
    );
    expect(drafts[0]).toMatchObject({
      kind: "transaction",
      accountId: "",
    });
  });
});

describe("Atomic Execution, Double-Save Idempotency & Validation", () => {
  function createMockTransactionDb(initialDrafts: ChatActionDraft[]) {
    const state = {
      messageContent: `Konfirmasi aksi:${serializeDraftsMarker(initialDrafts)}`,
      insertedTransactions: [] as Record<string, unknown>[],
      accountBalance: 5_000_000,
      balanceUpdates: 0,
    };

    const makeExecutor = () => ({
      query: {
        accounts: {
          findFirst: async () => ({
            id: "acc-bca",
            userId: "user-1",
            name: "Bank BCA",
            currency: "IDR",
            balance: state.accountBalance,
          }),
        },
        categories: {
          findFirst: async () => ({
            id: "cat-food",
            userId: "user-1",
            name: "Makanan & Minuman",
            kind: "expense",
          }),
        },
        ledgers: {
          findFirst: async () => ({
            id: "ldg-main",
            userId: "user-1",
            name: "Buku Kas Utama",
            currency: "IDR",
          }),
        },
        transactions: {
          findFirst: async () => state.insertedTransactions[state.insertedTransactions.length - 1],
        },
        budgets: { findFirst: async () => null },
        milestones: { findFirst: async () => null },
      },
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                id: "msg-1",
                sessionId: "sess-1",
                userId: "user-1",
                content: state.messageContent,
              },
            ],
          }),
        }),
      }),
      insert: () => ({
        values: async (val: Record<string, unknown>) => {
          state.insertedTransactions.push(val);
        },
      }),
      update: () => ({
        set: (payload: Record<string, unknown>) => ({
          where: async () => {
            if (typeof payload.content === "string") {
              state.messageContent = payload.content;
            } else {
              state.balanceUpdates += 1;
            }
          },
        }),
      }),
      delete: () => ({ where: async () => {} }),
    });

    const mockDb = {
      transaction: async <T>(cb: (tx: any) => Promise<T>): Promise<T> => cb(makeExecutor()),
    };

    return { state, mockDb };
  }

  it("saves transaction once and prevents duplicate writes on double-click", async () => {
    const draft: ChatActionDraft = {
      id: "draft-1",
      kind: "transaction",
      status: "pending",
      txType: "expense",
      amount: 75000,
      currency: "IDR",
      happenedAt: "2026-11-12T05:00:00.000Z",
      note: "Makan siang",
      ledgerId: "ldg-main",
      ledgerName: "Buku Kas Utama",
      accountId: "acc-bca",
      accountName: "Bank BCA",
      categoryId: "cat-food",
      categoryName: "Makanan & Minuman",
      tags: ["ai-advisor"],
    };

    const { state, mockDb } = createMockTransactionDb([draft]);

    const first = await executeChatDraftsInTransaction(mockDb, "user-1", {
      sessionId: "sess-1",
      messageId: "msg-1",
      items: [{ draftId: "draft-1" }],
    });

    expect(first.results[0]!.alreadySaved).toBe(false);
    expect(state.insertedTransactions).toHaveLength(1);
    expect(state.balanceUpdates).toBe(1);
    expect(extractDraftsFromContent(state.messageContent).drafts[0]!.status).toBe("saved");

    // Second click on same draftId must be idempotent
    const second = await executeChatDraftsInTransaction(mockDb, "user-1", {
      sessionId: "sess-1",
      messageId: "msg-1",
      items: [{ draftId: "draft-1" }],
    });

    expect(second.results[0]!.alreadySaved).toBe(true);
    expect(state.insertedTransactions).toHaveLength(1);
    expect(state.balanceUpdates).toBe(1);
  });

  it("rejects transfer draft when source and destination accounts are identical", async () => {
    const draft: ChatActionDraft = {
      id: "draft-txf",
      kind: "transaction",
      status: "pending",
      txType: "transfer",
      amount: 100000,
      currency: "IDR",
      happenedAt: "2026-11-12T05:00:00.000Z",
      note: "Transfer invalid",
      ledgerId: "ldg-main",
      ledgerName: "Buku Kas Utama",
      accountId: "acc-bca",
      accountName: "Bank BCA",
      toAccountId: "acc-bca",
      toAccountName: "Bank BCA",
      tags: [],
    };

    const { mockDb } = createMockTransactionDb([draft]);

    await expect(
      executeChatDraftsInTransaction(mockDb, "user-1", {
        sessionId: "sess-1",
        messageId: "msg-1",
        items: [{ draftId: "draft-txf" }],
      })
    ).rejects.toThrow(/berbeda dari akun asal/i);
  });

  it("marks draft as dismissed and blocks future execution", async () => {
    const draft: ChatActionDraft = {
      id: "draft-dis",
      kind: "transaction",
      status: "pending",
      txType: "expense",
      amount: 20000,
      currency: "IDR",
      happenedAt: "2026-11-12T05:00:00.000Z",
      note: "Parkir",
      ledgerId: "ldg-main",
      ledgerName: "Buku Kas Utama",
      accountId: "acc-bca",
      accountName: "Bank BCA",
      tags: [],
    };

    const { mockDb } = createMockTransactionDb([draft]);

    const dismissed = await dismissChatDraftInTransaction(mockDb, "user-1", {
      sessionId: "sess-1",
      messageId: "msg-1",
      draftId: "draft-dis",
    });
    expect(dismissed.status).toBe("dismissed");

    await expect(
      executeChatDraftsInTransaction(mockDb, "user-1", {
        sessionId: "sess-1",
        messageId: "msg-1",
        items: [{ draftId: "draft-dis" }],
      })
    ).rejects.toThrow(/diabaikan/i);
  });
});

