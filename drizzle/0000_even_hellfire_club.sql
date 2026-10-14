CREATE TABLE `accounts` (
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
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`ledger_id` varchar(36) NOT NULL,
	`category_id` varchar(36),
	`month` varchar(20) NOT NULL,
	`amount` double NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `budgets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`kind` varchar(50) NOT NULL,
	`level` int NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`icon` varchar(100) DEFAULT 'wallet',
	`icon_type` varchar(50) DEFAULT 'lucide',
	`parent_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ledger_invites` (
	`code` varchar(64) NOT NULL,
	`ledger_id` varchar(36) NOT NULL,
	`invited_by` varchar(36) NOT NULL,
	`target_role` varchar(50) NOT NULL DEFAULT 'editor',
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp,
	`used_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ledger_invites_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `ledger_members` (
	`id` varchar(36) NOT NULL,
	`ledger_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`role` varchar(50) NOT NULL DEFAULT 'editor',
	`joined_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ledger_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_ledger_member_uniq` UNIQUE(`ledger_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `ledgers` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'IDR',
	`month_start_day` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ledgers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mcp_call_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`pat_id` varchar(36),
	`tool_name` varchar(100) NOT NULL,
	`status` varchar(50) NOT NULL,
	`error_message` text,
	`args_summary` text,
	`duration_ms` int DEFAULT 0,
	`called_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mcp_call_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `personal_access_tokens` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`prefix` varchar(20) NOT NULL,
	`scopes` json,
	`expires_at` timestamp,
	`last_used_at` timestamp,
	`revoked_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `personal_access_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `personal_access_tokens_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `recovery_codes` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`code_hash` varchar(255) NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recovery_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_changes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`ledger_id` varchar(36),
	`entity_type` varchar(100) NOT NULL,
	`entity_id` varchar(100) NOT NULL,
	`action` varchar(50) NOT NULL,
	`payload` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sync_changes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`color` varchar(30) DEFAULT '#64748b',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`ledger_id` varchar(36) NOT NULL,
	`tx_type` varchar(50) NOT NULL,
	`amount` double NOT NULL DEFAULT 0,
	`currency` varchar(10) NOT NULL DEFAULT 'IDR',
	`native_amount` double,
	`happened_at` timestamp NOT NULL DEFAULT (now()),
	`note` text,
	`account_id` varchar(36),
	`to_account_id` varchar(36),
	`category_id` varchar(36),
	`tags_json` json,
	`attachments_json` json,
	`exclude_from_stats` boolean NOT NULL DEFAULT false,
	`exclude_from_budget` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`display_name` varchar(255),
	`avatar_url` text,
	`primary_currency` varchar(10) NOT NULL DEFAULT 'IDR',
	`theme_primary_color` varchar(30) DEFAULT '#3b82f6',
	`totp_secret` varchar(255),
	`totp_enabled` boolean NOT NULL DEFAULT false,
	`gemini_api_key` text,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_profiles_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`is_admin` boolean NOT NULL DEFAULT false,
	`is_enabled` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budgets` ADD CONSTRAINT `budgets_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budgets` ADD CONSTRAINT `budgets_ledger_id_ledgers_id_fk` FOREIGN KEY (`ledger_id`) REFERENCES `ledgers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budgets` ADD CONSTRAINT `budgets_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `categories` ADD CONSTRAINT `categories_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ledger_invites` ADD CONSTRAINT `ledger_invites_ledger_id_ledgers_id_fk` FOREIGN KEY (`ledger_id`) REFERENCES `ledgers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ledger_invites` ADD CONSTRAINT `ledger_invites_invited_by_users_id_fk` FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ledger_invites` ADD CONSTRAINT `ledger_invites_used_by_users_id_fk` FOREIGN KEY (`used_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ledger_members` ADD CONSTRAINT `ledger_members_ledger_id_ledgers_id_fk` FOREIGN KEY (`ledger_id`) REFERENCES `ledgers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ledger_members` ADD CONSTRAINT `ledger_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ledgers` ADD CONSTRAINT `ledgers_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mcp_call_logs` ADD CONSTRAINT `mcp_call_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mcp_call_logs` ADD CONSTRAINT `mcp_call_logs_pat_id_personal_access_tokens_id_fk` FOREIGN KEY (`pat_id`) REFERENCES `personal_access_tokens`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `personal_access_tokens` ADD CONSTRAINT `personal_access_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recovery_codes` ADD CONSTRAINT `recovery_codes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sync_changes` ADD CONSTRAINT `sync_changes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tags` ADD CONSTRAINT `tags_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_ledger_id_ledgers_id_fk` FOREIGN KEY (`ledger_id`) REFERENCES `ledgers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_account_id_accounts_id_fk` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_to_account_id_accounts_id_fk` FOREIGN KEY (`to_account_id`) REFERENCES `accounts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_tx_ledger_time` ON `transactions` (`ledger_id`,`happened_at`);--> statement-breakpoint
CREATE INDEX `idx_tx_user_time` ON `transactions` (`user_id`,`happened_at`);