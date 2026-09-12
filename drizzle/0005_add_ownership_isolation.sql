-- Existing records remain hidden until an administrator assigns their real owner.
ALTER TABLE `quotes` ADD COLUMN `owner_id` text NOT NULL DEFAULT 'legacy-unassigned';
--> statement-breakpoint
CREATE INDEX `idx_quotes_owner_created` ON `quotes` (`owner_id`,`createdAt`);
--> statement-breakpoint
CREATE TABLE `document_rules_new` (
  `owner_id` text NOT NULL,
  `branch` text NOT NULL,
  `categories` text NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY(`owner_id`, `branch`)
);
--> statement-breakpoint
INSERT INTO `document_rules_new` (`owner_id`,`branch`,`categories`,`updated_at`)
SELECT 'legacy-unassigned', `branch`, `categories`, `updated_at` FROM `document_rules`;
--> statement-breakpoint
DROP TABLE `document_rules`;
--> statement-breakpoint
ALTER TABLE `document_rules_new` RENAME TO `document_rules`;
