import { primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const quotes = sqliteTable('quotes', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), agency: text('agency').notNull(), customer: text('customer').notNull(), insurer: text('insurer').notNull(), branch: text('branch').notNull(), amount: real('amount').notNull(), status: text('status').notNull(), notes: text('notes').notNull().default(''), createdAt: text('createdAt').notNull(),
}, (table) => [uniqueIndex('idx_quotes_owner_created').on(table.ownerId, table.createdAt)]);

export const agencies = sqliteTable('agencies', {
  id: text('id').primaryKey(), name: text('name').notNull(), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
});

export const agencyUsers = sqliteTable('agency_users', {
  id: text('id').primaryKey(), agencyId: text('agency_id').notNull().references(() => agencies.id), authenticatedUserId: text('authenticated_user_id').notNull().unique(), email: text('email').notNull().default(''), displayName: text('display_name').notNull().default(''), role: text('role').notNull().default('member'), status: text('status').notNull().default('active'), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
});

export const quoteRequests = sqliteTable('quote_requests', {
  id: text('id').primaryKey(), agency: text('agency').notNull(), agencyId: text('agency_id').references(() => agencies.id), createdByUserId: text('created_by_user_id').references(() => agencyUsers.id), branchKey: text('branch_key').notNull(), branchLabel: text('branch_label').notNull(), branchConfidence: real('branch_confidence').notNull(), status: text('status').notNull(), collectedFields: text('collected_fields').notNull(), missingRequiredFields: text('missing_required_fields').notNull(), missingRecommendedFields: text('missing_recommended_fields').notNull(), aiSummary: text('ai_summary').notNull(), confirmationRequested: real('confirmation_requested').notNull(), confirmedAt: text('confirmed_at').notNull(), quoteId: text('quote_id').notNull(), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, (table) => [uniqueIndex('idx_quote_requests_agency').on(table.agencyId, table.updatedAt)]);

export const quoteRequestMessages = sqliteTable('quote_request_messages', {
  id: text('id').primaryKey(), requestId: text('request_id').notNull().references(() => quoteRequests.id), role: text('role').notNull(), content: text('content').notNull(), extractedFields: text('extracted_fields').notNull().default('[]'), createdAt: text('created_at').notNull(),
}, (table) => [uniqueIndex('idx_quote_request_messages_request').on(table.requestId, table.createdAt)]);

export const quoteRequestAudit = sqliteTable('quote_request_audit', {
  id: text('id').primaryKey(), requestId: text('request_id').notNull().references(() => quoteRequests.id), fieldKey: text('field_key').notNull(), oldValue: text('old_value').notNull().default(''), newValue: text('new_value').notNull(), source: text('source').notNull(), createdAt: text('created_at').notNull(),
});

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(), quoteId: text('quote_id').references(() => quotes.id), quoteRequestId: text('quote_request_id').references(() => quoteRequests.id), filename: text('filename').notNull(), mime: text('mime').notNull(), size: real('size').notNull(), objectKey: text('object_key').notNull(), contentHash: text('content_hash').notNull(), category: text('category').notNull().default('Diğer'), source: text('source').notNull().default('Yükleme'), sourceMessageId: text('source_message_id').notNull().default(''), extractedText: text('extracted_text').notNull().default(''), readStatus: text('read_status').notNull().default('pending'), readNote: text('read_note').notNull().default(''), reviewStatus: text('review_status').notNull().default('pending'), createdAt: text('created_at').notNull(),
}, (table) => [uniqueIndex('idx_documents_quote_hash').on(table.quoteId, table.contentHash), uniqueIndex('idx_documents_request_hash').on(table.quoteRequestId, table.contentHash)]);

export const documentRules = sqliteTable('document_rules', {
  ownerId: text('owner_id').notNull(), branch: text('branch').notNull(), categories: text('categories').notNull(), updatedAt: text('updated_at').notNull(),
}, (table) => [primaryKey({ columns: [table.ownerId, table.branch] })]);
