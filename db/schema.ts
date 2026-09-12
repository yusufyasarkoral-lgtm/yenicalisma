import {sqliteTable,text,real,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const quotes=sqliteTable('quotes',{id:text('id').primaryKey(),agency:text('agency').notNull(),customer:text('customer').notNull(),insurer:text('insurer').notNull(),branch:text('branch').notNull(),amount:real('amount').notNull(),status:text('status').notNull(),notes:text('notes').notNull().default(''),createdAt:text('createdAt').notNull()});

export const documents=sqliteTable('documents',{
 id:text('id').primaryKey(),quoteId:text('quote_id').references(()=>quotes.id),quoteRequestId:text('quote_request_id'),
 filename:text('filename').notNull(),mime:text('mime').notNull(),size:real('size').notNull(),
 objectKey:text('object_key').notNull(),contentHash:text('content_hash').notNull(),
 category:text('category').notNull().default('Diğer'),source:text('source').notNull().default('Yükleme'),
 sourceMessageId:text('source_message_id').notNull().default(''),
 extractedText:text('extracted_text').notNull().default(''),readStatus:text('read_status').notNull().default('pending'),
 readNote:text('read_note').notNull().default(''),reviewStatus:text('review_status').notNull().default('pending'),
 createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('idx_documents_quote_hash').on(t.quoteId,t.contentHash)]);
export const documentRules=sqliteTable('document_rules',{
 branch:text('branch').primaryKey(),categories:text('categories').notNull(),updatedAt:text('updated_at').notNull(),
});
export const quoteRequests=sqliteTable('quote_requests',{id:text('id').primaryKey(),agency:text('agency').notNull(),branchKey:text('branch_key').notNull(),branchLabel:text('branch_label').notNull(),branchConfidence:real('branch_confidence').notNull(),status:text('status').notNull(),collectedFields:text('collected_fields').notNull(),missingRequiredFields:text('missing_required_fields').notNull(),missingRecommendedFields:text('missing_recommended_fields').notNull(),aiSummary:text('ai_summary').notNull(),confirmationRequested:real('confirmation_requested').notNull(),confirmedAt:text('confirmed_at').notNull(),quoteId:text('quote_id').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()});
