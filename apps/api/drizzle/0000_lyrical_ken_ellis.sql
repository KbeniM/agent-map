CREATE TABLE `events` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`session_id` text NOT NULL,
	`at` text NOT NULL,
	`body` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_key_unique` ON `events` (`key`);--> statement-breakpoint
CREATE INDEX `events_session` ON `events` (`session_id`);--> statement-breakpoint
CREATE INDEX `events_at` ON `events` (`at`);--> statement-breakpoint
CREATE TABLE `hidden` (
	`session_id` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meta` (
	`name` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
