import {
  mysqlTable,
  varchar,
  int,
  double,
  boolean,
  timestamp,
  text,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// Helper ID generator
const generateId = () => crypto.randomUUID();

// ============================================================================
// 1. Users & Authentication
// ============================================================================

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(generateId),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const userProfiles = mysqlTable("user_profiles", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(generateId),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  displayName: varchar("display_name", { length: 255 }),
  avatarUrl: text("avatar_url"),
  primaryCurrency: varchar("primary_currency", { length: 10 }).default("IDR").notNull(),
  themePrimaryColor: varchar("theme_primary_color", { length: 30 }).default("#3b82f6"),
  totpSecret: varchar("totp_secret", { length: 255 }),
  totpEnabled: boolean("totp_enabled").default(false).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const recoveryCodes = mysqlTable("recovery_codes", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(generateId),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  codeHash: varchar("code_hash", { length: 255 }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================================
// 2. Ledgers (Multi-Buku Kas) & Collaboration
// ============================================================================

export const ledgers = mysqlTable("ledgers", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(generateId),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("IDR").notNull(),
  monthStartDay: int("month_start_day").default(1).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const ledgerMembers = mysqlTable(
  "ledger_members",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(generateId),
    ledgerId: varchar("ledger_id", { length: 36 })
      .notNull()
      .references(() => ledgers.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).default("editor").notNull(), // 'owner' | 'editor' | 'viewer'
    joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    memberUnique: uniqueIndex("idx_ledger_member_uniq").on(table.ledgerId, table.userId),
  })
);

export const ledgerInvites = mysqlTable("ledger_invites", {
  code: varchar("code", { length: 64 }).primaryKey(),
  ledgerId: varchar("ledger_id", { length: 36 })
    .notNull()
    .references(() => ledgers.id, { onDelete: "cascade" }),
  invitedBy: varchar("invited_by", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  targetRole: varchar("target_role", { length: 50 }).default("editor").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  usedBy: varchar("used_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================================
// 3. Accounts (Akun Finansial)
// ============================================================================

export const accounts = mysqlTable("accounts", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(generateId),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  group: varchar("group", { length: 100 }).notNull(), // 'Cash' | 'Bank card' | 'Alipay' | 'Credit' | etc.
  currency: varchar("currency", { length: 10 }).default("IDR").notNull(),
  initialBalance: double("initial_balance").default(0).notNull(),
  balance: double("balance").default(0).notNull(),
  note: text("note"),
  isHidden: boolean("is_hidden").default(false).notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================================
// 4. Categories & Tags
// ============================================================================

export const categories = mysqlTable("categories", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(generateId),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  kind: varchar("kind", { length: 50 }).notNull(), // 'expense' | 'income'
  level: int("level").default(1).notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
  icon: varchar("icon", { length: 100 }).default("wallet"),
  iconType: varchar("icon_type", { length: 50 }).default("lucide"),
  parentId: varchar("parent_id", { length: 36 }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const tags = mysqlTable("tags", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(generateId),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 30 }).default("#64748b"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================================
// 5. Transactions
// ============================================================================

export const transactions = mysqlTable(
  "transactions",
  {
    id: varchar("id", { length: 36 }).primaryKey().$defaultFn(generateId),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ledgerId: varchar("ledger_id", { length: 36 })
      .notNull()
      .references(() => ledgers.id, { onDelete: "cascade" }),
    txType: varchar("tx_type", { length: 50 }).notNull(), // 'expense' | 'income' | 'transfer'
    amount: double("amount").default(0).notNull(),
    currency: varchar("currency", { length: 10 }).default("IDR").notNull(),
    nativeAmount: double("native_amount"),
    happenedAt: timestamp("happened_at", { mode: "date" }).defaultNow().notNull(),
    note: text("note"),

    // Relasi Akun
    accountId: varchar("account_id", { length: 36 }).references(() => accounts.id, { onDelete: "set null" }),
    toAccountId: varchar("to_account_id", { length: 36 }).references(() => accounts.id, { onDelete: "set null" }),

    // Relasi Kategori
    categoryId: varchar("category_id", { length: 36 }).references(() => categories.id, { onDelete: "set null" }),

    // Metadata & Flags
    tagsJson: json("tags_json").$type<string[]>().$defaultFn(() => []),
    attachmentsJson: json("attachments_json").$type<any[]>().$defaultFn(() => []),
    excludeFromStats: boolean("exclude_from_stats").default(false).notNull(),
    excludeFromBudget: boolean("exclude_from_budget").default(false).notNull(),

    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    ledgerIdx: index("idx_tx_ledger_time").on(table.ledgerId, table.happenedAt),
    userIdx: index("idx_tx_user_time").on(table.userId, table.happenedAt),
  })
);

// ============================================================================
// 6. Budgets
// ============================================================================

export const budgets = mysqlTable("budgets", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(generateId),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  ledgerId: varchar("ledger_id", { length: 36 })
    .notNull()
    .references(() => ledgers.id, { onDelete: "cascade" }),
  categoryId: varchar("category_id", { length: 36 }).references(() => categories.id, { onDelete: "cascade" }),
  month: varchar("month", { length: 20 }).notNull(), // "YYYY-MM"
  amount: double("amount").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ============================================================================
// 7. Security (PAT, MCP, Realtime Sync Log)
// ============================================================================

export const personalAccessTokens = mysqlTable("personal_access_tokens", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(generateId),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
  prefix: varchar("prefix", { length: 20 }).notNull(),
  scopes: json("scopes").$type<string[]>().$defaultFn(() => ["read", "write"]),
  expiresAt: timestamp("expires_at", { mode: "date" }),
  lastUsedAt: timestamp("last_used_at", { mode: "date" }),
  revokedAt: timestamp("revoked_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const mcpCallLogs = mysqlTable("mcp_call_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  patId: varchar("pat_id", { length: 36 }).references(() => personalAccessTokens.id, { onDelete: "set null" }),
  toolName: varchar("tool_name", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(), // 'ok' | 'error'
  errorMessage: text("error_message"),
  argsSummary: text("args_summary"),
  durationMs: int("duration_ms").default(0),
  calledAt: timestamp("called_at", { mode: "date" }).defaultNow().notNull(),
});

export const syncChanges = mysqlTable("sync_changes", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  ledgerId: varchar("ledger_id", { length: 36 }),
  entityType: varchar("entity_type", { length: 100 }).notNull(),
  entityId: varchar("entity_id", { length: 100 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(), // 'create' | 'update' | 'delete'
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});
