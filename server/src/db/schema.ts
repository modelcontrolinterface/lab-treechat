import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: integer('created_at').notNull()
});

export const nodes = sqliteTable(
  'nodes',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'),
    role: text('role', { enum: ['user', 'assistant'] }).notNull(),
    content: text('content').notNull(),
    modelUsed: text('model_used').notNull(),
    createdAt: integer('created_at').notNull()
  },
  (table) => ({
    conversationIdx: index('idx_nodes_conversation').on(table.conversationId),
    parentIdx: index('idx_nodes_parent').on(table.parentId),
    createdIdx: index('idx_nodes_created_at').on(table.createdAt)
  })
);

export type Conversation = InferSelectModel<typeof conversations>;
export type NewConversation = InferInsertModel<typeof conversations>;

export type Node = InferSelectModel<typeof nodes>;
export type NewNode = InferInsertModel<typeof nodes>;
