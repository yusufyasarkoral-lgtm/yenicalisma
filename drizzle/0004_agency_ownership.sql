CREATE TABLE `agencies` (`id` text PRIMARY KEY NOT NULL,`name` text NOT NULL,`created_at` text NOT NULL,`updated_at` text NOT NULL);
--> statement-breakpoint
CREATE TABLE `agency_users` (`id` text PRIMARY KEY NOT NULL,`agency_id` text NOT NULL REFERENCES `agencies`(`id`),`authenticated_user_id` text NOT NULL UNIQUE,`email` text NOT NULL DEFAULT '',`display_name` text NOT NULL DEFAULT '',`role` text NOT NULL DEFAULT 'member',`status` text NOT NULL DEFAULT 'active',`created_at` text NOT NULL,`updated_at` text NOT NULL);
--> statement-breakpoint
ALTER TABLE `quote_requests` ADD COLUMN `agency_id` text REFERENCES `agencies`(`id`);
--> statement-breakpoint
ALTER TABLE `quote_requests` ADD COLUMN `created_by_user_id` text REFERENCES `agency_users`(`id`);
--> statement-breakpoint
CREATE INDEX `idx_quote_requests_agency` ON `quote_requests` (`agency_id`,`updated_at`);
