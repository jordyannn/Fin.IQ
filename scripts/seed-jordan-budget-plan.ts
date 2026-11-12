import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../src/server/db";
import {
  accounts,
  categories,
  ledgers,
  milestones,
  syncChanges,
  users,
} from "../src/server/db/schema";
import { PLAN_SEGMENT_COLORS, type PeriodBudgetPlan } from "../src/lib/budget-plan";

const TARGET_EMAIL = "jordan@gmail.com";
const DETERMINISTIC_PLAN_ID = "plan-jordan-nov-dec-2026";

function wibStart(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 0, 0, 0, 0) - 7 * 60 * 60 * 1000);
}

function wibEnd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 23, 59, 59, 0) - 7 * 60 * 60 * 1000);
}

async function main() {
  const user = await db.query.users.findFirst({
    where: eq(users.email, TARGET_EMAIL),
  });
  if (!user) {
    throw new Error(`User ${TARGET_EMAIL} not found in database.`);
  }

  const userLedger = await db.query.ledgers.findFirst({
    where: eq(ledgers.userId, user.id),
  });

  const userAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, user.id));

  const liquidBalance = userAccounts
    .filter((a) => !a.isHidden && a.includeInTotal !== false)
    .reduce((sum, a) => sum + (a.balance || 0), 0);

  const userCats = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, user.id));

  const findCat = (nameMatch: string, kind: "income" | "expense"): string | undefined => {
    const exact = userCats.find(
      (c) => c.kind === kind && c.name.toLowerCase() === nameMatch.toLowerCase()
    );
    if (exact) return exact.id;
    const partial = userCats.find(
      (c) => c.kind === kind && c.name.toLowerCase().includes(nameMatch.toLowerCase())
    );
    return partial?.id;
  };

  const salaryCatId = findCat("Salary", "income");
  const partTimeCatId = findCat("Part time", "income");
  const otherIncomeCatId = findCat("Pemasukan Lainnya", "income");

  const transportCatId = findCat("Transportasi", "expense");
  const foodCatId = findCat("Makanan & Minuman", "expense");
  const coffeeCatId = findCat("Kopi & Minuman", "expense");
  const bufferCatId = findCat("Pengeluaran Lainnya", "expense");

  const planPayload: PeriodBudgetPlan = {
    id: DETERMINISTIC_PLAN_ID,
    title: "Rencana Keuangan 13 Nov–31 Des 2026 (Target Rp15 Juta)",
    startDate: "2026-11-13",
    endDate: "2026-12-31",
    startingBalance: 5_760_500,
    targetEndingBalance: 15_000_000,
    trackingAccountId: "all",
    incomeTargets: [
      {
        id: "inc-salary-nov",
        label: "Salary 19 November",
        amount: 3_000_000,
        note: "Mengunci Rp2.400.000 langsung ke tabungan",
        categoryId: salaryCatId,
      },
      {
        id: "inc-salary-des",
        label: "Salary Desember",
        amount: 3_000_000,
        note: "Mengunci Rp1.500.000 langsung ke tabungan",
        categoryId: salaryCatId,
      },
      {
        id: "inc-parttime-nov",
        label: "Part-Time (Estimasi Nov)",
        amount: 1_000_000,
        note: "100% masuk tabungan target",
        categoryId: partTimeCatId,
      },
      {
        id: "inc-parttime-extra",
        label: "Part-Time Tambahan (Nov-Des)",
        amount: 2_000_000,
        note: "Target penghasilan tambahan ekstra",
        categoryId: partTimeCatId,
      },
      {
        id: "inc-other-projects",
        label: "Pekerjaan/Proyek Lainnya",
        amount: 2_639_500,
        note: "Target sisa untuk mencapai Rp15 juta",
        categoryId: otherIncomeCatId,
      },
    ],
    expenseCaps: [
      {
        id: "exp-transport",
        label: "Transportasi",
        amount: 1_000_000,
        note: "Prioritas TransJakarta, gunakan Grab secara selektif",
        color: PLAN_SEGMENT_COLORS[0]!,
        categoryId: transportCatId,
      },
      {
        id: "exp-food",
        label: "Makanan & Groceries",
        amount: 1_050_000,
        note: "Belanja bahan makanan terencana, batasi jajan minimarket",
        color: PLAN_SEGMENT_COLORS[1]!,
        categoryId: foodCatId,
      },
      {
        id: "exp-coffee",
        label: "Kopi & Personal",
        amount: 150_000,
        note: "Hiburan skala kecil dan kebutuhan pribadi dasar",
        color: PLAN_SEGMENT_COLORS[2]!,
        categoryId: coffeeCatId,
      },
      {
        id: "exp-buffer",
        label: "Buffer / Tak Terduga",
        amount: 200_000,
        note: "Cadangan murni untuk pengeluaran mendesak",
        color: PLAN_SEGMENT_COLORS[3]!,
        categoryId: bufferCatId,
      },
    ],
    timeWindows: [
      {
        id: "win-nov-13-18",
        label: "13–18 November",
        startDate: "2026-11-13",
        endDate: "2026-11-18",
        amount: 300_000,
        sourceNote: "Menggunakan cash yang sudah ada saat ini",
      },
      {
        id: "win-nov-19-30",
        label: "19–30 November",
        startDate: "2026-11-19",
        endDate: "2026-11-30",
        amount: 600_000,
        sourceNote: "Diambil dari Salary November",
      },
      {
        id: "win-dec-1-31",
        label: "1–31 Desember",
        startDate: "2026-12-01",
        endDate: "2026-12-31",
        amount: 1_500_000,
        sourceNote: "Diambil dari Salary Desember",
      },
    ],
    updatedAt: new Date().toISOString(),
  };

  // Upsert budget plan in sync_changes (update if exists, otherwise insert)
  const existingPlanRows = await db
    .select()
    .from(syncChanges)
    .where(
      and(
        eq(syncChanges.userId, user.id),
        eq(syncChanges.entityType, "budget_plan"),
        eq(syncChanges.entityId, DETERMINISTIC_PLAN_ID)
      )
    );

  if (existingPlanRows.length > 0) {
    const latestRow = existingPlanRows[existingPlanRows.length - 1]!;
    await db
      .update(syncChanges)
      .set({
        action: "update",
        payload: planPayload as unknown as Record<string, unknown>,
      })
      .where(eq(syncChanges.id, latestRow.id));
    console.log(`[Seed] Updated existing PeriodBudgetPlan (${DETERMINISTIC_PLAN_ID})`);
  } else {
    await db.insert(syncChanges).values({
      userId: user.id,
      ledgerId: userLedger?.id ?? null,
      entityType: "budget_plan",
      entityId: DETERMINISTIC_PLAN_ID,
      action: "create",
      payload: planPayload as unknown as Record<string, unknown>,
    });
    console.log(`[Seed] Created PeriodBudgetPlan (${DETERMINISTIC_PLAN_ID})`);
  }

  // Upsert date-bounded milestones for Semua Akun ("all")
  const desiredMilestones: {
    title: string;
    targetAmount: number;
    trackingType: "account" | "category";
    trackingId: string;
    trackingDirection: "savings_goal" | "spending_limit" | "income_goal";
    startYmd: string;
    endYmd: string;
  }[] = [
    {
      title: "Target Saldo Akhir Rp15 Juta (13 Nov–31 Des)",
      targetAmount: 15_000_000,
      trackingType: "account",
      trackingId: "all",
      trackingDirection: "savings_goal",
      startYmd: "2026-11-13",
      endYmd: "2026-12-31",
    },
    {
      title: "Target Pemasukan Total (13 Nov–31 Des)",
      targetAmount: 11_639_500,
      trackingType: "account",
      trackingId: "all",
      trackingDirection: "income_goal",
      startYmd: "2026-11-13",
      endYmd: "2026-12-31",
    },
    {
      title: "Batas Pengeluaran Total (13 Nov–31 Des)",
      targetAmount: 2_400_000,
      trackingType: "account",
      trackingId: "all",
      trackingDirection: "spending_limit",
      startYmd: "2026-11-13",
      endYmd: "2026-12-31",
    },
    {
      title: "Alokasi Pengeluaran 13–18 November",
      targetAmount: 300_000,
      trackingType: "account",
      trackingId: "all",
      trackingDirection: "spending_limit",
      startYmd: "2026-11-13",
      endYmd: "2026-11-18",
    },
    {
      title: "Alokasi Pengeluaran 19–30 November",
      targetAmount: 600_000,
      trackingType: "account",
      trackingId: "all",
      trackingDirection: "spending_limit",
      startYmd: "2026-11-19",
      endYmd: "2026-11-30",
    },
    {
      title: "Alokasi Pengeluaran 1–31 Desember",
      targetAmount: 1_500_000,
      trackingType: "account",
      trackingId: "all",
      trackingDirection: "spending_limit",
      startYmd: "2026-12-01",
      endYmd: "2026-12-31",
    },
  ];

  const existingMilestones = await db
    .select()
    .from(milestones)
    .where(eq(milestones.userId, user.id));

  for (const spec of desiredMilestones) {
    const existing = existingMilestones.find((m) => m.title === spec.title);
    const createdAt = wibStart(spec.startYmd);
    const deadline = wibEnd(spec.endYmd);

    if (existing) {
      await db
        .update(milestones)
        .set({
          targetAmount: spec.targetAmount,
          trackingType: spec.trackingType,
          trackingId: spec.trackingId,
          trackingDirection: spec.trackingDirection,
          createdAt,
          deadline,
        })
        .where(eq(milestones.id, existing.id));
      console.log(`[Seed] Updated milestone: ${spec.title}`);
    } else {
      await db.insert(milestones).values({
        id: crypto.randomUUID(),
        userId: user.id,
        title: spec.title,
        targetAmount: spec.targetAmount,
        trackingType: spec.trackingType,
        trackingId: spec.trackingId,
        trackingDirection: spec.trackingDirection,
        isCompleted: false,
        createdAt,
        deadline,
      });
      console.log(`[Seed] Inserted milestone: ${spec.title}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        email: TARGET_EMAIL,
        userId: user.id,
        liveLiquidBalance: liquidBalance,
        planId: DETERMINISTIC_PLAN_ID,
        milestonesCount: desiredMilestones.length,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error("[Seed Error]", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

