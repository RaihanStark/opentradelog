CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`firm` text DEFAULT 'topstep' NOT NULL,
	`broker` text DEFAULT 'csv' NOT NULL,
	`broker_account_id` text,
	`name` text NOT NULL,
	`phase` text DEFAULT 'COMBINE' NOT NULL,
	`size_label` text DEFAULT '50K' NOT NULL,
	`starting_balance` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_synced_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`trade_id` text,
	`journal_id` text,
	`kind` text NOT NULL,
	`path` text NOT NULL,
	`caption` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily_journals` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`trading_date` text NOT NULL,
	`game_plan` text,
	`checklist` text,
	`bias` text,
	`review` text,
	`what_worked` text,
	`what_to_improve` text,
	`mood_start` text,
	`mood_end` text,
	`realized_pnl` integer,
	`eod_balance` integer,
	`max_adverse` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_journal_account_date` ON `daily_journals` (`account_id`,`trading_date`);--> statement-breakpoint
CREATE TABLE `executions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`trade_id` text,
	`contract_id` text NOT NULL,
	`symbol` text NOT NULL,
	`side` integer NOT NULL,
	`size` integer NOT NULL,
	`price` real NOT NULL,
	`profit_and_loss` integer,
	`fees` integer DEFAULT 0 NOT NULL,
	`voided` integer DEFAULT false NOT NULL,
	`order_id` text,
	`executed_at` text NOT NULL,
	`source` text DEFAULT 'csv' NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_exec_account_time` ON `executions` (`account_id`,`executed_at`);--> statement-breakpoint
CREATE TABLE `instruments` (
	`id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`contract_id` text,
	`tick_size` real NOT NULL,
	`tick_value` integer NOT NULL,
	`point_value` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `instruments_symbol_unique` ON `instruments` (`symbol`);--> statement-breakpoint
CREATE TABLE `rule_configs` (
	`account_id` text PRIMARY KEY NOT NULL,
	`profile_key` text DEFAULT 'topstep' NOT NULL,
	`profit_target` integer DEFAULT 0 NOT NULL,
	`max_drawdown` integer DEFAULT 0 NOT NULL,
	`daily_loss_limit` integer DEFAULT 0 NOT NULL,
	`drawdown_mode` text DEFAULT 'EOD_TRAILING' NOT NULL,
	`drawdown_locks_at_start` integer DEFAULT true NOT NULL,
	`consistency_pct` real,
	`high_water_balance` integer DEFAULT 0 NOT NULL,
	`current_mll` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rule_events` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`type` text NOT NULL,
	`severity` text NOT NULL,
	`occurred_at` text NOT NULL,
	`balance_at_event` integer NOT NULL,
	`threshold_at_event` integer NOT NULL,
	`message` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sync_cursors` (
	`account_id` text PRIMARY KEY NOT NULL,
	`last_synced_at` text,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`instrument_id` text,
	`symbol` text NOT NULL,
	`direction` text NOT NULL,
	`qty` integer NOT NULL,
	`avg_entry_price` real NOT NULL,
	`avg_exit_price` real,
	`entry_at` text NOT NULL,
	`exit_at` text,
	`status` text NOT NULL,
	`gross_pnl` integer DEFAULT 0 NOT NULL,
	`fees` integer DEFAULT 0 NOT NULL,
	`net_pnl` integer DEFAULT 0 NOT NULL,
	`planned_stop` real,
	`risk_per_unit` integer,
	`initial_risk` integer,
	`r_multiple` real,
	`mood` text,
	`discipline_score` integer,
	`rule_adherence` integer,
	`setup_tag` text,
	`notes` text,
	`session_date` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_trade_account_exit` ON `trades` (`account_id`,`exit_at`);