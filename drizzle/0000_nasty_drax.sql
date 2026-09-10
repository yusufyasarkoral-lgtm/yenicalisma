CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`agency` text NOT NULL,
	`customer` text NOT NULL,
	`insurer` text NOT NULL,
	`branch` text NOT NULL,
	`amount` real NOT NULL,
	`status` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`createdAt` text NOT NULL
);
