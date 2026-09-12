PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `documents_new` (
 `id` text PRIMARY KEY NOT NULL, `quote_id` text REFERENCES `quotes`(`id`), `quote_request_id` text REFERENCES `quote_requests`(`id`),
 `filename` text NOT NULL, `mime` text NOT NULL, `size` real NOT NULL, `object_key` text NOT NULL, `content_hash` text NOT NULL,
 `category` text NOT NULL DEFAULT 'Diğer', `source` text NOT NULL DEFAULT 'Yükleme', `source_message_id` text NOT NULL DEFAULT '',
 `extracted_text` text NOT NULL DEFAULT '', `read_status` text NOT NULL DEFAULT 'pending', `read_note` text NOT NULL DEFAULT '', `review_status` text NOT NULL DEFAULT 'pending', `created_at` text NOT NULL,
 CHECK ((quote_id IS NOT NULL) OR (quote_request_id IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `documents_new` SELECT id,quote_id,NULL,filename,mime,size,object_key,content_hash,category,source,source_message_id,extracted_text,read_status,read_note,review_status,created_at FROM `documents`;
--> statement-breakpoint
DROP TABLE `documents`;
--> statement-breakpoint
ALTER TABLE `documents_new` RENAME TO `documents`;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_documents_quote_hash` ON `documents` (`quote_id`,`content_hash`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_documents_request_hash` ON `documents` (`quote_request_id`,`content_hash`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
