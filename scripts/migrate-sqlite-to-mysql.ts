import mysql from "mysql2/promise";
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`users\` (
    \`id\` varchar(36) NOT NULL,
    \`email\` varchar(255) NOT NULL,
    \`password_hash\` varchar(255) NOT NULL,
    \`is_admin\` boolean NOT NULL DEFAULT false,
    \`is_enabled\` boolean NOT NULL DEFAULT true,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`users_email_unique\` (\`email\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`user_profiles\` (
    \`id\` varchar(36) NOT NULL,
    \`user_id\` varchar(36) NOT NULL,
    \`display_name\` varchar(255) DEFAULT NULL,
    \`avatar_url\` text DEFAULT NULL,
    \`primary_currency\` varchar(10) NOT NULL DEFAULT 'IDR',
    \`theme_primary_color\` varchar(30) DEFAULT '#3b82f6',
    \`totp_secret\` varchar(255) DEFAULT NULL,
    \`totp_enabled\` boolean NOT NULL DEFAULT false,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`user_profiles_user_id_unique\` (\`user_id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`recovery_codes\` (
    \`id\` varchar(36) NOT NULL,
    \`user_id\` varchar(36) NOT NULL,
    \`code_hash\` varchar(255) NOT NULL,
    \`used_at\` timestamp NULL DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`ledgers\` (
    \`id\` varchar(36) NOT NULL,
    \`user_id\` varchar(36) NOT NULL,
    \`name\` varchar(255) NOT NULL,
    \`currency\` varchar(10) NOT NULL DEFAULT 'IDR',
    \`month_start_day\` int NOT NULL DEFAULT 1,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`ledger_members\` (
    \`id\` varchar(36) NOT NULL,
    \`ledger_id\` varchar(36) NOT NULL,
    \`user_id\` varchar(36) NOT NULL,
    \`role\` varchar(50) NOT NULL DEFAULT 'editor',
    \`joined_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`idx_ledger_member_uniq\` (\`ledger_id\`, \`user_id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`ledger_invites\` (
    \`code\` varchar(64) NOT NULL,
    \`ledger_id\` varchar(36) NOT NULL,
    \`invited_by\` varchar(36) NOT NULL,
    \`target_role\` varchar(50) NOT NULL DEFAULT 'editor',
    \`expires_at\` timestamp NOT NULL,
    \`used_at\` timestamp NULL DEFAULT NULL,
    \`used_by\` varchar(36) DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`code\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`accounts\` (
    \`id\` varchar(36) NOT NULL,
    \`user_id\` varchar(36) NOT NULL,
    \`name\` varchar(255) NOT NULL,
    \`group\` varchar(100) NOT NULL,
    \`currency\` varchar(10) NOT NULL DEFAULT 'IDR',
    \`initial_balance\` double NOT NULL DEFAULT 0,
    \`balance\` double NOT NULL DEFAULT 0,
    \`note\` text DEFAULT NULL,
    \`is_hidden\` boolean NOT NULL DEFAULT false,
    \`sort_order\` int NOT NULL DEFAULT 0,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`categories\` (
    \`id\` varchar(36) NOT NULL,
    \`user_id\` varchar(36) NOT NULL,
    \`name\` varchar(255) NOT NULL,
    \`kind\` varchar(50) NOT NULL,
    \`level\` int NOT NULL DEFAULT 1,
    \`sort_order\` int NOT NULL DEFAULT 0,
    \`icon\` varchar(100) DEFAULT 'wallet',
    \`icon_type\` varchar(50) DEFAULT 'lucide',
    \`parent_id\` varchar(36) DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`tags\` (
    \`id\` varchar(36) NOT NULL,
    \`user_id\` varchar(36) NOT NULL,
    \`name\` varchar(255) NOT NULL,
    \`color\` varchar(30) DEFAULT '#64748b',
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`transactions\` (
    \`id\` varchar(36) NOT NULL,
    \`user_id\` varchar(36) NOT NULL,
    \`ledger_id\` varchar(36) NOT NULL,
    \`tx_type\` varchar(50) NOT NULL,
    \`amount\` double NOT NULL DEFAULT 0,
    \`currency\` varchar(10) NOT NULL DEFAULT 'IDR',
    \`native_amount\` double DEFAULT NULL,
    \`happened_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`note\` text DEFAULT NULL,
    \`account_id\` varchar(36) DEFAULT NULL,
    \`to_account_id\` varchar(36) DEFAULT NULL,
    \`category_id\` varchar(36) DEFAULT NULL,
    \`tags_json\` json DEFAULT NULL,
    \`attachments_json\` json DEFAULT NULL,
    \`exclude_from_stats\` boolean NOT NULL DEFAULT false,
    \`exclude_from_budget\` boolean NOT NULL DEFAULT false,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    KEY \`idx_tx_ledger_time\` (\`ledger_id\`, \`happened_at\`),
    KEY \`idx_tx_user_time\` (\`user_id\`, \`happened_at\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`budgets\` (
    \`id\` varchar(36) NOT NULL,
    \`user_id\` varchar(36) NOT NULL,
    \`ledger_id\` varchar(36) NOT NULL,
    \`category_id\` varchar(36) DEFAULT NULL,
    \`month\` varchar(20) NOT NULL,
    \`amount\` double NOT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`personal_access_tokens\` (
    \`id\` varchar(36) NOT NULL,
    \`user_id\` varchar(36) NOT NULL,
    \`name\` varchar(255) NOT NULL,
    \`token_hash\` varchar(255) NOT NULL,
    \`prefix\` varchar(20) NOT NULL,
    \`scopes\` json DEFAULT NULL,
    \`expires_at\` timestamp NULL DEFAULT NULL,
    \`last_used_at\` timestamp NULL DEFAULT NULL,
    \`revoked_at\` timestamp NULL DEFAULT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`personal_access_tokens_token_hash_unique\` (\`token_hash\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`mcp_call_logs\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`user_id\` varchar(36) NOT NULL,
    \`pat_id\` varchar(36) DEFAULT NULL,
    \`tool_name\` varchar(100) NOT NULL,
    \`status\` varchar(50) NOT NULL,
    \`error_message\` text DEFAULT NULL,
    \`args_summary\` text DEFAULT NULL,
    \`duration_ms\` int DEFAULT 0,
    \`called_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS \`sync_changes\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`user_id\` varchar(36) NOT NULL,
    \`ledger_id\` varchar(36) DEFAULT NULL,
    \`entity_type\` varchar(100) NOT NULL,
    \`entity_id\` varchar(100) NOT NULL,
    \`action\` varchar(50) NOT NULL,
    \`payload\` json NOT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
];

function toDate(val: any): Date | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") {
    // If val is unix timestamp in seconds (typically 10 digits)
    if (val < 10000000000) {
      return new Date(val * 1000);
    }
    return new Date(val);
  }
  if (typeof val === "string") {
    const num = Number(val);
    if (!isNaN(num) && num > 1000000) {
      return toDate(num);
    }
    return new Date(val);
  }
  return new Date(val);
}

function toJsonString(val: any): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return JSON.stringify(parsed);
    } catch {
      return JSON.stringify(val);
    }
  }
  return JSON.stringify(val);
}

async function migrate() {
  console.log("🚀 Memulai migrasi SQLite -> Aiven MySQL...");

  const sqlite = createClient({ url: "file:finiq.db" });
  const mysqlConn = await mysql.createConnection({
    uri: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectTimeout: 30000,
  });

  try {
    console.log("1. Membuat tabel di Aiven MySQL...");
    for (const ddl of DDL_STATEMENTS) {
      await mysqlConn.query(ddl);
    }
    console.log("✅ Semua tabel berhasil dibuat/diverifikasi di MySQL!");

    await mysqlConn.query("SET FOREIGN_KEY_CHECKS = 0;");

    // 1. Users
    const usersRows = (await sqlite.execute("SELECT * FROM users")).rows;
    console.log(`2. Memigrasikan ${usersRows.length} users...`);
    for (const r of usersRows) {
      await mysqlConn.execute(
        `INSERT INTO users (id, email, password_hash, is_admin, is_enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE email=VALUES(email)`,
        [r.id, r.email, r.password_hash, Boolean(r.is_admin), Boolean(r.is_enabled), toDate(r.created_at)]
      );
    }

    // 2. User Profiles
    const profileRows = (await sqlite.execute("SELECT * FROM user_profiles")).rows;
    console.log(`3. Memigrasikan ${profileRows.length} user_profiles...`);
    for (const r of profileRows) {
      await mysqlConn.execute(
        `INSERT INTO user_profiles (id, user_id, display_name, avatar_url, primary_currency, theme_primary_color, totp_secret, totp_enabled, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE display_name=VALUES(display_name)`,
        [r.id, r.user_id, r.display_name, r.avatar_url, r.primary_currency || "IDR", r.theme_primary_color || "#3b82f6", r.totp_secret, Boolean(r.totp_enabled), toDate(r.updated_at)]
      );
    }

    // 3. Ledgers
    const ledgerRows = (await sqlite.execute("SELECT * FROM ledgers")).rows;
    console.log(`4. Memigrasikan ${ledgerRows.length} ledgers...`);
    for (const r of ledgerRows) {
      await mysqlConn.execute(
        `INSERT INTO ledgers (id, user_id, name, currency, month_start_day, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name)`,
        [r.id, r.user_id, r.name, r.currency || "IDR", r.month_start_day || 1, toDate(r.created_at)]
      );
    }

    // 4. Accounts
    const accountRows = (await sqlite.execute("SELECT * FROM accounts")).rows;
    console.log(`5. Memigrasikan ${accountRows.length} accounts...`);
    for (const r of accountRows) {
      await mysqlConn.execute(
        `INSERT INTO accounts (id, user_id, name, \`group\`, currency, initial_balance, balance, note, is_hidden, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE balance=VALUES(balance), name=VALUES(name)`,
        [r.id, r.user_id, r.name, r.group, r.currency || "IDR", Number(r.initial_balance || 0), Number(r.balance || 0), r.note, Boolean(r.is_hidden), Number(r.sort_order || 0), toDate(r.created_at), toDate(r.updated_at)]
      );
    }

    // 5. Categories
    const catRows = (await sqlite.execute("SELECT * FROM categories")).rows;
    console.log(`6. Memigrasikan ${catRows.length} categories...`);
    for (const r of catRows) {
      await mysqlConn.execute(
        `INSERT INTO categories (id, user_id, name, kind, level, sort_order, icon, icon_type, parent_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name)`,
        [r.id, r.user_id, r.name, r.kind, Number(r.level || 1), Number(r.sort_order || 0), r.icon || "wallet", r.icon_type || "lucide", r.parent_id || null, toDate(r.created_at)]
      );
    }

    // 6. Tags
    const tagRows = (await sqlite.execute("SELECT * FROM tags")).rows;
    console.log(`7. Memigrasikan ${tagRows.length} tags...`);
    for (const r of tagRows) {
      await mysqlConn.execute(
        `INSERT INTO tags (id, user_id, name, color, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name)`,
        [r.id, r.user_id, r.name, r.color, toDate(r.created_at)]
      );
    }

    // 7. Transactions
    const txRows = (await sqlite.execute("SELECT * FROM transactions")).rows;
    console.log(`8. Memigrasikan ${txRows.length} transactions...`);
    for (const r of txRows) {
      await mysqlConn.execute(
        `INSERT INTO transactions (id, user_id, ledger_id, tx_type, amount, currency, native_amount, happened_at, note, account_id, to_account_id, category_id, tags_json, attachments_json, exclude_from_stats, exclude_from_budget, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE amount=VALUES(amount)`,
        [
          r.id,
          r.user_id,
          r.ledger_id,
          r.tx_type,
          Number(r.amount || 0),
          r.currency || "IDR",
          r.native_amount ? Number(r.native_amount) : null,
          toDate(r.happened_at),
          r.note,
          r.account_id,
          r.to_account_id,
          r.category_id,
          toJsonString(r.tags_json) || "[]",
          toJsonString(r.attachments_json) || "[]",
          Boolean(r.exclude_from_stats),
          Boolean(r.exclude_from_budget),
          toDate(r.created_at),
        ]
      );
    }

    // 8. Budgets
    const budgetRows = (await sqlite.execute("SELECT * FROM budgets")).rows;
    console.log(`9. Memigrasikan ${budgetRows.length} budgets...`);
    for (const r of budgetRows) {
      await mysqlConn.execute(
        `INSERT INTO budgets (id, user_id, ledger_id, category_id, month, amount, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE amount=VALUES(amount)`,
        [r.id, r.user_id, r.ledger_id, r.category_id, r.month, Number(r.amount), toDate(r.created_at)]
      );
    }

    await mysqlConn.query("SET FOREIGN_KEY_CHECKS = 1;");

    console.log("\n🔍 Verifikasi hitungan data di Aiven MySQL:");
    const tablesToCheck = ["users", "user_profiles", "ledgers", "accounts", "categories", "transactions"];
    for (const t of tablesToCheck) {
      const [res]: any = await mysqlConn.query(`SELECT COUNT(*) as count FROM \`${t}\``);
      console.log(`  - ${t}: ${res[0].count} rows`);
    }

    console.log("\n🎉 Migrasi data berhasil dengan sempurna!");
  } finally {
    await mysqlConn.end();
  }
}

migrate().catch(console.error);
