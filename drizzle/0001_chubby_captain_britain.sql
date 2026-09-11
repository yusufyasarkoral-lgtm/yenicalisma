CREATE TABLE `document_rules` (
	`branch` text PRIMARY KEY NOT NULL,
	`categories` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`size` real NOT NULL,
	`object_key` text NOT NULL,
	`content_hash` text NOT NULL,
	`category` text DEFAULT 'Diğer' NOT NULL,
	`source` text DEFAULT 'Yükleme' NOT NULL,
	`source_message_id` text DEFAULT '' NOT NULL,
	`extracted_text` text DEFAULT '' NOT NULL,
	`read_status` text DEFAULT 'pending' NOT NULL,
	`read_note` text DEFAULT '' NOT NULL,
	`review_status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_documents_quote_hash` ON `documents` (`quote_id`,`content_hash`);