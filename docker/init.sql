-- ============================================================================
-- Fin.IQ Database Initialization Script (Docker Entrypoint)
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Users & Authentication
CREATE TABLE IF NOT EXISTS `users` (
	`id` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`is_admin` boolean NOT NULL DEFAULT false,
	`is_enabled` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);

CREATE TABLE IF NOT EXISTS `user_profiles` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`display_name` varchar(255),
	`avatar_url` text,
	`primary_currency` varchar(10) NOT NULL DEFAULT 'IDR',
	`theme_primary_color` varchar(30) DEFAULT '#00B569',
	`totp_secret` varchar(255),
	`totp_enabled` boolean NOT NULL DEFAULT false,
	`gemini_api_key` text,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_profiles_user_id_unique` UNIQUE(`user_id`),
	CONSTRAINT `user_profiles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `recovery_codes` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`code_hash` varchar(255) NOT NULL,
	`used_at` timestamp NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `recovery_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `recovery_codes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `personal_access_tokens` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`prefix` varchar(20) NOT NULL,
	`scopes` json,
	`expires_at` timestamp NULL,
	`last_used_at` timestamp NULL,
	`revoked_at` timestamp NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `personal_access_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `personal_access_tokens_token_hash_unique` UNIQUE(`token_hash`),
	CONSTRAINT `personal_access_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- 2. Ledgers (Buku Kas) & Collaboration
CREATE TABLE IF NOT EXISTS `ledgers` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'IDR',
	`month_start_day` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `ledgers_id` PRIMARY KEY(`id`),
	CONSTRAINT `ledgers_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `ledger_members` (
	`id` varchar(36) NOT NULL,
	`ledger_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`role` varchar(50) NOT NULL DEFAULT 'editor',
	`joined_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `ledger_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_ledger_member_uniq` UNIQUE(`ledger_id`,`user_id`),
	CONSTRAINT `ledger_members_ledger_id_ledgers_id_fk` FOREIGN KEY (`ledger_id`) REFERENCES `ledgers`(`id`) ON DELETE CASCADE,
	CONSTRAINT `ledger_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `ledger_invites` (
	`code` varchar(64) NOT NULL,
	`ledger_id` varchar(36) NOT NULL,
	`invited_by` varchar(36) NOT NULL,
	`target_role` varchar(50) NOT NULL DEFAULT 'editor',
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp NULL,
	`used_by` varchar(36) NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `ledger_invites_code` PRIMARY KEY(`code`),
	CONSTRAINT `ledger_invites_ledger_id_ledgers_id_fk` FOREIGN KEY (`ledger_id`) REFERENCES `ledgers`(`id`) ON DELETE CASCADE,
	CONSTRAINT `ledger_invites_invited_by_users_id_fk` FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `ledger_invites_used_by_users_id_fk` FOREIGN KEY (`used_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
);

-- 3. Akun Keuangan (Accounts)
CREATE TABLE IF NOT EXISTS `accounts` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`group` varchar(100) NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'IDR',
	`initial_balance` double NOT NULL DEFAULT 0,
	`balance` double NOT NULL DEFAULT 0,
	`note` text,
	`is_hidden` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `accounts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- 4. Kategori & Anggaran (Categories & Budgets)
CREATE TABLE IF NOT EXISTS `categories` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`kind` varchar(50) NOT NULL,
	`level` int NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`icon` varchar(100) DEFAULT 'wallet',
	`icon_type` varchar(50) DEFAULT 'lucide',
	`parent_id` varchar(36) NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `budgets` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`ledger_id` varchar(36) NOT NULL,
	`category_id` varchar(36) NULL,
	`month` varchar(20) NOT NULL,
	`amount` double NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `budgets_id` PRIMARY KEY(`id`),
	CONSTRAINT `budgets_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `budgets_ledger_id_ledgers_id_fk` FOREIGN KEY (`ledger_id`) REFERENCES `ledgers`(`id`) ON DELETE CASCADE,
	CONSTRAINT `budgets_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE
);

-- 5. Tags, Transaksi & Log
CREATE TABLE IF NOT EXISTS `tags` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`color` varchar(30) DEFAULT '#64748b',
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `transactions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`ledger_id` varchar(36) NOT NULL,
	`tx_type` varchar(50) NOT NULL,
	`amount` double NOT NULL DEFAULT 0,
	`currency` varchar(10) NOT NULL DEFAULT 'IDR',
	`native_amount` double NULL,
	`happened_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`note` text,
	`account_id` varchar(36) NULL,
	`to_account_id` varchar(36) NULL,
	`category_id` varchar(36) NULL,
	`tags_json` json NULL,
	`attachments_json` json NULL,
	`exclude_from_stats` boolean NOT NULL DEFAULT false,
	`exclude_from_budget` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `transactions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `transactions_ledger_id_ledgers_id_fk` FOREIGN KEY (`ledger_id`) REFERENCES `ledgers`(`id`) ON DELETE CASCADE,
	CONSTRAINT `transactions_account_id_accounts_id_fk` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE SET NULL,
	CONSTRAINT `transactions_to_account_id_accounts_id_fk` FOREIGN KEY (`to_account_id`) REFERENCES `accounts`(`id`) ON DELETE SET NULL,
	CONSTRAINT `transactions_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS `idx_tx_ledger_time` ON `transactions` (`ledger_id`,`happened_at`);
CREATE INDEX IF NOT EXISTS `idx_tx_user_time` ON `transactions` (`user_id`,`happened_at`);

CREATE TABLE IF NOT EXISTS `mcp_call_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`pat_id` varchar(36) NULL,
	`tool_name` varchar(100) NOT NULL,
	`status` varchar(50) NOT NULL,
	`error_message` text,
	`args_summary` text,
	`duration_ms` int DEFAULT 0,
	`called_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `mcp_call_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `mcp_call_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `mcp_call_logs_pat_id_personal_access_tokens_id_fk` FOREIGN KEY (`pat_id`) REFERENCES `personal_access_tokens`(`id`) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS `sync_changes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`ledger_id` varchar(36) NULL,
	`entity_type` varchar(100) NOT NULL,
	`entity_id` varchar(100) NOT NULL,
	`action` varchar(50) NOT NULL,
	`payload` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sync_changes_id` PRIMARY KEY(`id`),
	CONSTRAINT `sync_changes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- Default Initial Seed Data (Owner User, Buku Kas, Kategori & Akun Default)
-- ============================================================================

-- 1. Default User
INSERT IGNORE INTO `users` (`id`, `email`, `password_hash`, `is_admin`, `is_enabled`)
VALUES ('default-user-uuid-1', 'owner@finiq.app', '$2a$10$demo_finiq_hash_placeholder', true, true);

INSERT IGNORE INTO `user_profiles` (`id`, `user_id`, `display_name`, `primary_currency`, `theme_primary_color`)
VALUES ('default-profile-uuid-1', 'default-user-uuid-1', 'Owner Fin.IQ', 'IDR', '#00B569');

-- 2. Default Buku Kas (Ledger)
INSERT IGNORE INTO `ledgers` (`id`, `user_id`, `name`, `currency`, `month_start_day`)
VALUES ('default-ledger-uuid-1', 'default-user-uuid-1', 'Buku Kas Utama', 'IDR', 1);

-- 3. Default Kategori Transaksi
INSERT IGNORE INTO `categories` (`id`, `user_id`, `name`, `kind`, `icon`) VALUES
('cat-exp-1', 'default-user-uuid-1', 'Makanan & Minuman', 'expense', 'Utensils'),
('cat-exp-2', 'default-user-uuid-1', 'Transportasi', 'expense', 'Car'),
('cat-exp-3', 'default-user-uuid-1', 'Belanja Harian', 'expense', 'ShoppingBag'),
('cat-exp-4', 'default-user-uuid-1', 'Tagihan & Utilitas', 'expense', 'Zap'),
('cat-exp-5', 'default-user-uuid-1', 'Hiburan', 'expense', 'Gamepad2'),
('cat-exp-6', 'default-user-uuid-1', 'Kesehatan', 'expense', 'Activity'),
('cat-exp-7', 'default-user-uuid-1', 'Pendidikan', 'expense', 'GraduationCap'),
('cat-inc-1', 'default-user-uuid-1', 'Gaji Pokok', 'income', 'Banknote'),
('cat-inc-2', 'default-user-uuid-1', 'Pendapatan Tambahan', 'income', 'Briefcase'),
('cat-inc-3', 'default-user-uuid-1', 'Investasi / Bunga', 'income', 'TrendingUp'),
('cat-inc-4', 'default-user-uuid-1', 'Uang Masuk Lainnya', 'income', 'Wallet');

-- 4. Default Akun Keuangan
INSERT IGNORE INTO `accounts` (`id`, `user_id`, `name`, `group`, `currency`, `initial_balance`, `balance`, `note`) VALUES
('acc-1', 'default-user-uuid-1', 'Kas Dompet', 'Cash', 'IDR', 150000, 150000, 'Uang tunai fisik dompet'),
('acc-2', 'default-user-uuid-1', 'BCA / Bank Digital', 'Bank card', 'IDR', 3500000, 3500000, 'Rekening bank operasional'),
('acc-3', 'default-user-uuid-1', 'E-Wallet DANA', 'Alipay', 'IDR', 100000, 100000, 'Dompet digital');
