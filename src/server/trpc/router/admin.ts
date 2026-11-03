import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import {
  analyticsEvents,
  users,
  userProfiles,
  transactions,
  aiPromptHistory,
  aiChatSessions,
} from "../../db/schema";
import { eq, and, gte, lte, desc, asc, count, sql } from "drizzle-orm";

export const adminRouter = router({
  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 1: Overview — KPI Cards & Summaries (Supports Lifetime, Annual, Monthly, Daily)
  // ═══════════════════════════════════════════════════════════════════════════

  overviewStats: adminProcedure
    .input(
      z.object({
        from: z.string().optional(), // ISO string (undefined = Lifetime / All-Time)
        to: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const from = input.from ? new Date(input.from) : undefined;
      const to = input.to ? new Date(input.to) : now;

      // 1. Total Users overall (Lifetime)
      const [totalUsersRes] = await ctx.db
        .select({ count: count() })
        .from(users);

      // 2. New Registrations in selected period
      const [newRegistrationsRes] = await ctx.db
        .select({ count: count() })
        .from(users)
        .where(
          and(
            from ? gte(users.createdAt, from) : undefined,
            lte(users.createdAt, to)
          )
        );

      // 3. Page Views in period
      const [pageViewsRes] = await ctx.db
        .select({ count: count() })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.eventType, "page_view"),
            from ? gte(analyticsEvents.createdAt, from) : undefined,
            lte(analyticsEvents.createdAt, to)
          )
        );

      // 4. Successful Logins in period
      const [loginsRes] = await ctx.db
        .select({ count: count() })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.eventType, "login"),
            from ? gte(analyticsEvents.createdAt, from) : undefined,
            lte(analyticsEvents.createdAt, to)
          )
        );

      // 5. Failed Logins in period
      const [failedLoginsRes] = await ctx.db
        .select({ count: count() })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.eventType, "login_failed"),
            from ? gte(analyticsEvents.createdAt, from) : undefined,
            lte(analyticsEvents.createdAt, to)
          )
        );

      // 6. Clicks in period
      const [clicksRes] = await ctx.db
        .select({ count: count() })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.eventType, "click"),
            from ? gte(analyticsEvents.createdAt, from) : undefined,
            lte(analyticsEvents.createdAt, to)
          )
        );

      // 7. Feature Usage in period
      const [featuresRes] = await ctx.db
        .select({ count: count() })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.eventType, "feature_use"),
            from ? gte(analyticsEvents.createdAt, from) : undefined,
            lte(analyticsEvents.createdAt, to)
          )
        );

      // 8. DAU (Unique Active Users Today)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const [dauRes] = await ctx.db
        .select({
          count: sql<number>`COUNT(DISTINCT ${analyticsEvents.userId})`,
        })
        .from(analyticsEvents)
        .where(
          and(
            gte(analyticsEvents.createdAt, todayStart),
            sql`${analyticsEvents.userId} IS NOT NULL`
          )
        );

      // 9. MAU (Unique Active Users This Month)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const [mauRes] = await ctx.db
        .select({
          count: sql<number>`COUNT(DISTINCT ${analyticsEvents.userId})`,
        })
        .from(analyticsEvents)
        .where(
          and(
            gte(analyticsEvents.createdAt, monthStart),
            sql`${analyticsEvents.userId} IS NOT NULL`
          )
        );

      // 10. Total Transactions recorded across system
      const [totalTxRes] = await ctx.db
        .select({ count: count() })
        .from(transactions);

      return {
        totalUsers: Number(totalUsersRes?.count ?? 0),
        newRegistrations: Number(newRegistrationsRes?.count ?? 0),
        pageViews: Number(pageViewsRes?.count ?? 0),
        logins: Number(loginsRes?.count ?? 0),
        failedLogins: Number(failedLoginsRes?.count ?? 0),
        clicks: Number(clicksRes?.count ?? 0),
        featuresUsed: Number(featuresRes?.count ?? 0),
        dau: Number(dauRes?.count ?? 0),
        mau: Number(mauRes?.count ?? 0),
        totalTransactions: Number(totalTxRes?.count ?? 0),
      };
    }),

  // Daily / Monthly Trend for Line/Bar charts
  dailyTrend: adminProcedure
    .input(
      z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        interval: z.enum(["day", "month"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const from = input.from ? new Date(input.from) : undefined;
      const to = input.to ? new Date(input.to) : now;

      // Group by month if range is > 65 days or lifetime (no from)
      const isMonthly =
        input.interval === "month" ||
        !from ||
        to.getTime() - from.getTime() > 65 * 86400000;

      const dateFormat = isMonthly ? "%Y-%m" : "%Y-%m-%d";

      const rawRows = await ctx.db
        .select({
          dateStr: sql<string>`DATE_FORMAT(${analyticsEvents.createdAt}, ${dateFormat})`,
          eventType: analyticsEvents.eventType,
          total: count(),
        })
        .from(analyticsEvents)
        .where(
          and(
            from ? gte(analyticsEvents.createdAt, from) : undefined,
            lte(analyticsEvents.createdAt, to)
          )
        )
        .groupBy(
          sql`DATE_FORMAT(${analyticsEvents.createdAt}, ${dateFormat})`,
          analyticsEvents.eventType
        )
        .orderBy(asc(sql`DATE_FORMAT(${analyticsEvents.createdAt}, ${dateFormat})`));

      const dateMap = new Map<
        string,
        {
          date: string;
          pageViews: number;
          logins: number;
          clicks: number;
          registers: number;
          features: number;
        }
      >();

      for (const row of rawRows) {
        const d = row.dateStr;
        if (!dateMap.has(d)) {
          dateMap.set(d, {
            date: d,
            pageViews: 0,
            logins: 0,
            clicks: 0,
            registers: 0,
            features: 0,
          });
        }
        const item = dateMap.get(d)!;
        const total = Number(row.total);
        if (row.eventType === "page_view") item.pageViews += total;
        else if (row.eventType === "login") item.logins += total;
        else if (row.eventType === "click") item.clicks += total;
        else if (row.eventType === "register") item.registers += total;
        else if (row.eventType === "feature_use") item.features += total;
      }

      return Array.from(dateMap.values());
    }),

  // Top Pages
  topPages: adminProcedure
    .input(
      z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().min(1).max(50).default(8),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const from = input.from ? new Date(input.from) : undefined;
      const to = input.to ? new Date(input.to) : now;

      const rows = await ctx.db
        .select({
          page: analyticsEvents.eventName,
          views: count(),
          uniqueVisitors: sql<number>`COUNT(DISTINCT COALESCE(${analyticsEvents.userId}, ${analyticsEvents.sessionId}))`,
        })
        .from(analyticsEvents)
        .where(
          and(
            eq(analyticsEvents.eventType, "page_view"),
            from ? gte(analyticsEvents.createdAt, from) : undefined,
            lte(analyticsEvents.createdAt, to)
          )
        )
        .groupBy(analyticsEvents.eventName)
        .orderBy(desc(count()))
        .limit(input.limit);

      return rows.map((r) => ({
        page: r.page,
        views: Number(r.views),
        uniqueVisitors: Number(r.uniqueVisitors),
      }));
    }),

  // Top Features & Clicks
  topFeatures: adminProcedure
    .input(
      z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().min(1).max(50).default(8),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const from = input.from ? new Date(input.from) : undefined;
      const to = input.to ? new Date(input.to) : now;

      const rows = await ctx.db
        .select({
          name: analyticsEvents.eventName,
          type: analyticsEvents.eventType,
          count: count(),
        })
        .from(analyticsEvents)
        .where(
          and(
            sql`${analyticsEvents.eventType} IN ('feature_use', 'click')`,
            from ? gte(analyticsEvents.createdAt, from) : undefined,
            lte(analyticsEvents.createdAt, to)
          )
        )
        .groupBy(analyticsEvents.eventName, analyticsEvents.eventType)
        .orderBy(desc(count()))
        .limit(input.limit);

      return rows.map((r) => ({
        name: r.name,
        type: r.type,
        count: Number(r.count),
      }));
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 2: Users — User Management & Stats
  // ═══════════════════════════════════════════════════════════════════════════

  usersList: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(15),
      })
    )
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.pageSize;
      const searchPattern = input.search ? `%${input.search.trim().toLowerCase()}%` : null;

      const whereClause = searchPattern
        ? sql`LOWER(${users.email}) LIKE ${searchPattern}`
        : undefined;

      const userRows = await ctx.db
        .select({
          id: users.id,
          email: users.email,
          isAdmin: users.isAdmin,
          isEnabled: users.isEnabled,
          createdAt: users.createdAt,
          displayName: userProfiles.displayName,
          primaryCurrency: userProfiles.primaryCurrency,
        })
        .from(users)
        .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
        .where(whereClause)
        .orderBy(desc(users.createdAt))
        .limit(input.pageSize)
        .offset(offset);

      const [totalCountRes] = await ctx.db
        .select({ count: count() })
        .from(users)
        .where(whereClause);

      // Enrich users with activity metrics
      const enrichedUsers = await Promise.all(
        userRows.map(async (u) => {
          // Last login from analyticsEvents
          const [lastLoginRes] = await ctx.db
            .select({ createdAt: analyticsEvents.createdAt })
            .from(analyticsEvents)
            .where(
              and(
                eq(analyticsEvents.userId, u.id),
                eq(analyticsEvents.eventType, "login")
              )
            )
            .orderBy(desc(analyticsEvents.createdAt))
            .limit(1);

          // Total transactions
          const [txCountRes] = await ctx.db
            .select({ count: count() })
            .from(transactions)
            .where(eq(transactions.userId, u.id));

          return {
            id: u.id,
            email: u.email,
            displayName: u.displayName || u.email.split("@")[0],
            primaryCurrency: u.primaryCurrency || "IDR",
            isAdmin: Boolean(u.isAdmin),
            isEnabled: Boolean(u.isEnabled),
            createdAt: u.createdAt,
            lastLoginAt: lastLoginRes?.createdAt || null,
            transactionCount: Number(txCountRes?.count ?? 0),
          };
        })
      );

      return {
        users: enrichedUsers,
        total: Number(totalCountRes?.count ?? 0),
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(Number(totalCountRes?.count ?? 0) / input.pageSize),
      };
    }),

  toggleUserEnabled: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Prevent disabling the current admin itself
      if (input.userId === ctx.userId) {
        throw new Error("Anda tidak dapat menonaktifkan akun admin Anda sendiri.");
      }

      await ctx.db
        .update(users)
        .set({ isEnabled: input.enabled })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  toggleUserAdmin: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        isAdmin: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.userId && !input.isAdmin) {
        throw new Error("Anda tidak dapat mencabut akses admin Anda sendiri.");
      }

      await ctx.db
        .update(users)
        .set({ isAdmin: input.isAdmin })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 3: Events — Live Audit & Activity Stream
  // ═══════════════════════════════════════════════════════════════════════════

  recentEvents: adminProcedure
    .input(
      z.object({
        eventType: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const whereClause =
        input.eventType && input.eventType !== "all"
          ? eq(analyticsEvents.eventType, input.eventType)
          : undefined;

      const rows = await ctx.db
        .select({
          id: analyticsEvents.id,
          userId: analyticsEvents.userId,
          userEmail: users.email,
          sessionId: analyticsEvents.sessionId,
          eventType: analyticsEvents.eventType,
          eventName: analyticsEvents.eventName,
          metadata: analyticsEvents.metadata,
          ipAddress: analyticsEvents.ipAddress,
          createdAt: analyticsEvents.createdAt,
        })
        .from(analyticsEvents)
        .leftJoin(users, eq(analyticsEvents.userId, users.id))
        .where(whereClause)
        .orderBy(desc(analyticsEvents.createdAt))
        .limit(input.limit);

      return rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        userEmail: r.userEmail || "Anonymous / Guest",
        sessionId: r.sessionId,
        eventType: r.eventType,
        eventName: r.eventName,
        metadata: r.metadata,
        ipAddress: r.ipAddress || "-",
        createdAt: r.createdAt,
      }));
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 4: AI Usage & Telemetry Stats
  // ═══════════════════════════════════════════════════════════════════════════

  aiUsageStats: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    // 1. Total lifetime prompts & sessions
    const [totalPromptsRes] = await ctx.db
      .select({ count: count() })
      .from(aiPromptHistory);

    const [totalSessionsRes] = await ctx.db
      .select({ count: count() })
      .from(aiChatSessions);

    // 2. Month-to-date prompts
    const [monthlyPromptsRes] = await ctx.db
      .select({ count: count() })
      .from(aiPromptHistory)
      .where(gte(aiPromptHistory.createdAt, monthStart));

    // 3. Blocked prompts (Safety guardrail trigger)
    const [blockedPromptsRes] = await ctx.db
      .select({ count: count() })
      .from(aiPromptHistory)
      .where(eq(aiPromptHistory.guardrailBlocked, true));

    // 4. Model distribution
    const modelDistRows = await ctx.db
      .select({
        model: aiPromptHistory.modelUsed,
        count: count(),
      })
      .from(aiPromptHistory)
      .groupBy(aiPromptHistory.modelUsed)
      .orderBy(desc(count()));

    // 5. Top 5 AI Users by Prompt Volume
    const topAiUsersRows = await ctx.db
      .select({
        userId: aiPromptHistory.userId,
        email: users.email,
        totalPrompts: count(),
      })
      .from(aiPromptHistory)
      .innerJoin(users, eq(aiPromptHistory.userId, users.id))
      .groupBy(aiPromptHistory.userId, users.email)
      .orderBy(desc(count()))
      .limit(6);

    return {
      totalPrompts: Number(totalPromptsRes?.count ?? 0),
      totalSessions: Number(totalSessionsRes?.count ?? 0),
      monthlyPrompts: Number(monthlyPromptsRes?.count ?? 0),
      blockedPrompts: Number(blockedPromptsRes?.count ?? 0),
      modelDistribution: modelDistRows.map((m) => ({
        model: m.model || "default",
        count: Number(m.count),
      })),
      topAiUsers: topAiUsersRows.map((u) => ({
        userId: u.userId,
        email: u.email,
        totalPrompts: Number(u.totalPrompts),
      })),
    };
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // User Demographics & Engagement
  // ═══════════════════════════════════════════════════════════════════════════

  userDemographics: adminProcedure.query(async ({ ctx }) => {
    // 1. Currency distribution
    const currencyRows = await ctx.db
      .select({
        currency: userProfiles.primaryCurrency,
        count: count(),
      })
      .from(userProfiles)
      .groupBy(userProfiles.primaryCurrency)
      .orderBy(desc(count()));

    // 2. Power Users (Top Users by Transaction Count)
    const powerUsersRows = await ctx.db
      .select({
        userId: transactions.userId,
        email: users.email,
        displayName: userProfiles.displayName,
        txCount: count(),
      })
      .from(transactions)
      .innerJoin(users, eq(transactions.userId, users.id))
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .groupBy(transactions.userId, users.email, userProfiles.displayName)
      .orderBy(desc(count()))
      .limit(6);

    return {
      currencyDistribution: currencyRows.map((c) => ({
        currency: c.currency || "IDR",
        count: Number(c.count),
      })),
      powerUsers: powerUsersRows.map((p) => ({
        userId: p.userId,
        email: p.email,
        displayName: p.displayName || p.email.split("@")[0],
        txCount: Number(p.txCount),
      })),
    };
  }),
});
