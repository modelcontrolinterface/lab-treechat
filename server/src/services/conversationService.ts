import { randomUUID } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { Conversation, conversations, Node, nodes } from '../db/schema.js';

export async function createConversation(title: string): Promise<Conversation> {
  const conversation: Conversation = {
    id: randomUUID(),
    title,
    createdAt: Date.now()
  };

  await db.insert(conversations).values(conversation);
  return conversation;
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  const result = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  return result[0];
}

export async function getNodesForConversation(conversationId: string): Promise<Node[]> {
  const result = await db
    .select()
    .from(nodes)
    .where(eq(nodes.conversationId, conversationId))
    .orderBy(nodes.createdAt);
  return result;
}

export async function getExistingRoot(conversationId: string): Promise<Node | undefined> {
  const result = await db
    .select()
    .from(nodes)
    .where(and(eq(nodes.conversationId, conversationId), isNull(nodes.parentId)))
    .limit(1);
  return result[0];
}
