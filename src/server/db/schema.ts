import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Helper ID generator
const generateId = () => crypto.randomUUID();

// ============================================================================
// 1. Users & Authentication
// ============================================================================

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(generateId),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isAdmin: integer("is_admin", { mode: "boolean" }).default(false).notNull(),
  isEnabled: integer("is_enabled", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});

export const userProfiles = sqliteTable("user_profiles", {
  id: text("id").primaryKey().$defaultFn(generateId),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  primaryCurrency: text("primary_currency").default("IDR").notNull(),
  themePrimaryColor: text("theme_primary_color").default("#3b82f6"),
  totpSecret: text("totp_secret"),
  totpEnabled: integer("totp_enabled", { mode: "boolean" }).default(false).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});

export const recoveryCodes = sqliteTable("recovery_codes", {
  id: text("id").primaryKey().$defaultFn(generateId),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});

// ============================================================================
// 2. Ledgers (Multi-Buku Kas) & Collaboration
// ============================================================================

export const ledgers = sqliteTable("ledgers", {
  id: text("id").primaryKey().$defaultFn(generateId),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  currency: text("currency").default("IDR").notNull(),
  monthStartDay: integer("month_start_day").default(1).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});

export const ledgerMembers = sqliteTable(
  "ledger_members",
  {
    ledgerId: text("ledger_id")
      .notNull()
      .references(() => ledgers.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").default("editor").notNull(), // 'owner' | 'editor' | 'viewer'
    joinedAt: integer("joined_at", { mode: "timestamp" })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  (table) => ({
    pk: uniqueIndex("pk_ledger_members").on(table.ledgerId, table.userId),
  })
);

export const ledgerInvites = sqliteTable("ledger_invites", {
  code: text("code").primaryKey(),
  ledgerId: text("ledger_id")
    .notNull()
    .references(() => ledgers.id, { onDelete: "cascade" }),
  invitedBy: text("invited_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  targetRole: text("target_role").default("editor").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }),
  usedBy: text("used_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});

// ============================================================================
// 3. Accounts (Akun Finansial)
// ============================================================================

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey().$defaultFn(generateId),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  group: text("group").notNull(), // 'Cash' | 'Bank card' | 'Alipay' | 'Credit' | etc.
  currency: text("currency").default("IDR").notNull(),
  initialBalance: real("initial_balance").default(0).notNull(),
  balance: real("balance").default(0).notNull(),
  note: text("note"),
  isHidden: integer("is_hidden", { mode: "boolean" }).default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});

// ============================================================================
// 4. Categories & Tags
// ============================================================================

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey().$defaultFn(generateId),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // 'expense' | 'income'
  level: integer("level").default(1).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  icon: text("icon").default("wallet"),
  iconType: text("icon_type").default("lucide"),
  parentId: text("parent_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey().$defaultFn(generateId),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").default("#64748b"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});

// ============================================================================
// 5. Transactions
// ============================================================================

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey().$defaultFn(generateId),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ledgerId: text("ledger_id")
      .notNull()
      .references(() => ledgers.id, { onDelete: "cascade" }),
    txType: text("tx_type").notNull(), // 'expense' | 'income' | 'transfer'
    amount: real("amount").default(0).notNull(),
    currency: text("currency").default("IDR").notNull(),
    nativeAmount: real("native_amount"),
    happenedAt: integer("happened_at", { mode: "timestamp" })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
    note: text("note"),

    // Relasi Akun
    accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
    toAccountId: text("to_account_id").references(() => accounts.id, { onDelete: "set null" }),

    // Relasi Kategori
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),

    // Metadata & Flags
    tagsJson: text("tags_json", { mode: "json" }).default("[]"),
    attachmentsJson: text("attachments_json", { mode: "json" }).default("[]"),
    excludeFromStats: integer("exclude_from_stats", { mode: "boolean" }).default(false).notNull(),
    excludeFromBudget: integer("exclude_from_budget", { mode: "boolean" }).default(false).notNull(),

    createdAt: integer("created_at", { mode: "timestamp" })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  (table) => ({
    ledgerIdx: index("idx_tx_ledger_time").on(table.ledgerId, table.happenedAt),
    userIdx: index("idx_tx_user_time").on(table.userId, table.happenedAt),
  })
);

// ============================================================================
// 6. Budgets
// ============================================================================

export const budgets = sqliteTable("budgets", {
  id: text("id").primaryKey().$defaultFn(generateId),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  ledgerId: text("ledger_id")
    .notNull()
    .references(() => ledgers.id, { onDelete: "cascade" }),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "cascade" }),
  month: text("month").notNull(), // "YYYY-MM"
  amount: real("amount").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});

// ============================================================================
// 7. Security (PAT, MCP, Realtime Sync Log)
// ============================================================================

export const personalAccessTokens = sqliteTable("personal_access_tokens", {
  id: text("id").primaryKey().$defaultFn(generateId),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  prefix: text("prefix").notNull(),
  scopes: text("scopes", { mode: "json" }).default('["read", "write"]'),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});

export const mcpCallLogs = sqliteTable("mcp_call_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  patId: text("pat_id").references(() => personalAccessTokens.id, { onDelete: "set null" }),
  toolName: text("tool_name").notNull(),
  status: text("status").notNull(), // 'ok' | 'error'
  errorMessage: text("error_message"),
  argsSummary: text("args_summary"),
  durationMs: integer("duration_ms").default(0),
  calledAt: integer("called_at", { mode: "timestamp" })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});

export const syncChanges = sqliteTable("sync_changes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  ledgerId: text("ledger_id"),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(), // 'create' | 'update' | 'delete'
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .default(sql`(strftime('%s', 'now'))`)
    .notNull(),
});
