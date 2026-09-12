CREATE TABLE `quote_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `agency` text NOT NULL,
  `branch_key` text NOT NULL DEFAULT '',
  `branch_label` text NOT NULL DEFAULT '',
  `branch_confidence` real NOT NULL DEFAULT 0,
  `status` text NOT NULL DEFAULT 'collecting_information',
  `collected_fields` text NOT NULL DEFAULT '{}',
  `missing_required_fields` text NOT NULL DEFAULT '[]',
  `missing_recommended_fields` text NOT NULL DEFAULT '[]',
  `ai_summary` text NOT NULL DEFAULT '',
  `confirmation_requested` integer NOT NULL DEFAULT 0,
  `confirmed_at` text NOT NULL DEFAULT '',
  `quote_id` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quote_request_messages` (
  `id` text PRIMARY KEY NOT NULL,
  `request_id` text NOT NULL REFERENCES `quote_requests`(`id`),
  `role` text NOT NULL,
  `content` text NOT NULL,
  `extracted_fields` text NOT NULL DEFAULT '[]',
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_quote_request_messages_request` ON `quote_request_messages` (`request_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `quote_request_audit` (
  `id` text PRIMARY KEY NOT NULL,
  `request_id` text NOT NULL REFERENCES `quote_requests`(`id`),
  `field_key` text NOT NULL,
  `old_value` text NOT NULL DEFAULT '',
  `new_value` text NOT NULL,
  `source` text NOT NULL,
  `created_at` text NOT NULL
);
