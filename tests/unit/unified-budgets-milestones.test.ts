import { describe, it, expect } from "vitest";
import {
  createVerifiedMilestone,
  upsertVerifiedBudget,
} from "../../src/server/financial-actions";

function createMockDbExecutor() {
  const insertedBudgets: Record<string, unknown>[] = [];
  const updatedBudgets: Record<string, unknown>[] = [];
  const insertedMilestones: Record<string, unknown>[] = [];

  const db = {
    query: {
      accounts: {
        findFirst: async () => null,
      },
      categories: {
        findFirst: async () => ({
          id: "cat-expense-1",
          userId: "user-1",
          name: "Makanan",
          kind: "expense",
        }),
      },
      ledgers: {
        findFirst: async () => ({
          id: "ldg-1",
          userId: "user-1",
          name: "Buku Kas Utama",
          currency: "IDR",
        }),
      },
      budgets: {
        findFirst: async () =>
          insertedBudgets.length > 0 ? insertedBudgets[0] : null,
      },
      milestones: {
        findFirst: async () =>
          insertedMilestones.length > 0 ? insertedMilestones[0] : null,
      },
      transactions: {
        findFirst: async () => null,
      },
    },
    insert: () => ({
      values: async (row: Record<string, unknown>) => {
        if ("month" in row) {
          insertedBudgets.push(row);
        } else {
          insertedMilestones.push(row);
        }
      },
    }),
    update: () => ({
      set: (patch: Record<string, unknown>) => ({
        where: async () => {
          updatedBudgets.push(patch);
        },
      }),
    }),
    delete: () => ({ where: async () => {} }),
    select: () => ({}) as any,
  };

  return { db: db as any, insertedBudgets, updatedBudgets, insertedMilestones };
}

describe("Unified Budgets & Milestones Shared Actions", () => {
  it("upserts monthly category budgets and rejects invalid non-positive limits", async () => {
    const { db, insertedBudgets, updatedBudgets } = createMockDbExecutor();

    await expect(
      upsertVerifiedBudget(db, "user-1", {
        ledgerId: "ldg-1",
        categoryId: "cat-expense-1",
        month: "2026-11",
        amount: 0,
      })
    ).rejects.toThrow(/lebih dari 0/i);

    await upsertVerifiedBudget(db, "user-1", {
      ledgerId: "ldg-1",
      categoryId: "cat-expense-1",
      month: "2026-11",
      amount: 1_500_000,
    });
    expect(insertedBudgets).toHaveLength(1);

    await upsertVerifiedBudget(db, "user-1", {
      ledgerId: "ldg-1",
      categoryId: "cat-expense-1",
      month: "2026-11",
      amount: 2_000_000,
    });
    expect(updatedBudgets).toEqual([{ amount: 2_000_000 }]);
  });

  it("supports trackingId='all' for account milestones and rejects empty title or invalid trackingId", async () => {
    const { db, insertedMilestones } = createMockDbExecutor();

    const created = await createVerifiedMilestone(db, "user-1", {
      title: "Dana Darurat",
      targetAmount: 15_000_000,
      trackingType: "account",
      trackingId: "all",
      trackingDirection: "savings_goal",
      deadline: "2026-12-31",
    });

    expect(created).toBeTruthy();
    expect(insertedMilestones).toHaveLength(1);

    await expect(
      createVerifiedMilestone(db, "user-1", {
        title: "   ",
        targetAmount: 5_000_000,
        trackingType: "account",
        trackingId: "all",
        trackingDirection: "savings_goal",
        deadline: "2026-12-31",
      })
    ).rejects.toThrow(/judul/i);

    await expect(
      createVerifiedMilestone(db, "user-1", {
        title: "Akun Tidak Ada",
        targetAmount: 5_000_000,
        trackingType: "account",
        trackingId: "nonexistent-acc",
        trackingDirection: "savings_goal",
        deadline: "2026-12-31",
      })
    ).rejects.toThrow(/tidak valid/i);
  });
});

