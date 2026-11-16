import { describe, it, expect } from "vitest";
import {
  createVerifiedMilestone,
  updateVerifiedMilestone,
  upsertVerifiedBudget,
} from "../../src/server/financial-actions";

function createMockDbExecutor() {
  const insertedBudgets: Record<string, unknown>[] = [];
  const updatedBudgets: Record<string, unknown>[] = [];
  const insertedMilestones: Record<string, unknown>[] = [];
  const updatedMilestones: Record<string, unknown>[] = [];

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
        findFirst: async (args?: any) => {
          if (insertedMilestones.length > 0) {
            const found = insertedMilestones[0] as any;
            return {
              ...found,
              id: found.id || "ms-1",
              userId: "user-1",
              trackingType: found.trackingType || "category",
              trackingId: found.trackingId || "cat-expense-1",
              trackingDirection: found.trackingDirection || "spending_limit",
              deadline: found.deadline || new Date("2026-11-30"),
              startDate: found.startDate || new Date("2026-11-01"),
              createdAt: found.createdAt || new Date("2026-11-01"),
            };
          }
          return null;
        },
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
    update: (tbl: any) => ({
      set: (patch: Record<string, unknown>) => ({
        where: async () => {
          if ("targetAmount" in patch || "customCurrentAmount" in patch || "title" in patch) {
            updatedMilestones.push(patch);
          } else {
            updatedBudgets.push(patch);
          }
        },
      }),
    }),
    delete: () => ({ where: async () => {} }),
    select: () => ({}) as any,
  };

  return { db: db as any, insertedBudgets, updatedBudgets, insertedMilestones, updatedMilestones };
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

  it("supports explicit startDate and trackingDirection='income_goal', and rejects startDate > deadline", async () => {
    const { db, insertedMilestones } = createMockDbExecutor();

    const incomeMilestone = await createVerifiedMilestone(db, "user-1", {
      title: "Target Pemasukan Nov-Des",
      targetAmount: 11_639_500,
      trackingType: "account",
      trackingId: "all",
      trackingDirection: "income_goal",
      startDate: "2026-11-13",
      deadline: "2026-12-31",
    });

    expect(incomeMilestone).toBeTruthy();
    expect(insertedMilestones).toHaveLength(1);
    expect(insertedMilestones[0]?.trackingDirection).toBe("income_goal");

    await expect(
      createVerifiedMilestone(db, "user-1", {
        title: "Rentang Tanggal Terbalik",
        targetAmount: 1_000_000,
        trackingType: "account",
        trackingId: "all",
        trackingDirection: "spending_limit",
        startDate: "2026-12-31",
        deadline: "2026-11-13",
      })
    ).rejects.toThrow(/tanggal mulai/i);
  });

  it("supports updating milestone, customizing filled amount (customCurrentAmount), and moving dates", async () => {
    const { db, insertedMilestones, updatedMilestones } = createMockDbExecutor();

    const created = await createVerifiedMilestone(db, "user-1", {
      title: "Buffer Pengeluaran 13-18 Nov",
      targetAmount: 200_000,
      trackingType: "category",
      trackingId: "cat-expense-1",
      trackingDirection: "spending_limit",
      startDate: "2026-11-13",
      deadline: "2026-11-18",
      customCurrentAmount: 50_000,
    });

    expect(created).toBeTruthy();
    expect(insertedMilestones[0]?.customCurrentAmount).toBe(50_000);

    // Update milestone: move to next dates (19-30 Nov) and reset customCurrentAmount to 0
    await updateVerifiedMilestone(db, "user-1", {
      id: created.id,
      title: "Buffer Pengeluaran 19-30 Nov",
      startDate: "2026-11-19",
      deadline: "2026-11-30",
      targetAmount: 150_000,
      customCurrentAmount: 0,
    });

    expect(updatedMilestones).toHaveLength(1);
    expect(updatedMilestones[0]?.title).toBe("Buffer Pengeluaran 19-30 Nov");
    expect(updatedMilestones[0]?.targetAmount).toBe(150_000);
    expect(updatedMilestones[0]?.customCurrentAmount).toBe(0);

    // Reset customCurrentAmount back to null (auto)
    await updateVerifiedMilestone(db, "user-1", {
      id: created.id,
      customCurrentAmount: null,
    });
    expect(updatedMilestones[1]?.customCurrentAmount).toBeNull();
  });
});

