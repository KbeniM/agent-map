CREATE TABLE IF NOT EXISTS `events` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`session_id` text NOT NULL,
	`at` text NOT NULL,
	`body` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `events_key_unique` ON `events` (`key`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `events_session` ON `events` (`session_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `events_at` ON `events` (`at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `hidden` (
	`session_id` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `meta` (
	`name` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
