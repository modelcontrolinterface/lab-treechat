import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { Node, nodes } from '../db/schema.js';
import { getConversation, getExistingRoot, getNodesForConversation } from './conversationService.js';
import { generateAssistantMessage, LlmMessage } from './copilotService.js';

interface CreateNodeInput {
  conversationId: string;
  parentId: string | null;
  content: string;
  model: string;
}

export async function getNode(id: string): Promise<Node | undefined> {
  const result = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);
  return result[0];
}

export async function createUserAndAssistantNodes({
  conversationId,
  parentId,
  content,
  model
}: CreateNodeInput): Promise<{ userNode: Node; assistantNode: Node }> {
  const conversation = await getConversation(conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (parentId) {
    const parent = await getNode(parentId);
    if (!parent) {
      throw new Error('Parent node not found');
    }
    if (parent.conversationId !== conversationId) {
      throw new Error('Parent node belongs to another conversation');
    }
  } else {
    const existingRoot = await getExistingRoot(conversationId);
    if (existingRoot) {
      throw new Error('Conversation already has a root node');
    }
  }

  const now = Date.now();
  const userNode: Node = {
    id: randomUUID(),
    conversationId,
    parentId,
    role: 'user',
    content,
    modelUsed: model,
    createdAt: now
  };

  await db.insert(nodes).values(userNode);

  const lineage = await buildLineage(conversationId, parentId);
  const llmMessages: LlmMessage[] = [
    ...lineage.map((node) => ({ role: node.role, content: node.content })),
    { role: 'user', content }
  ];

  const assistantContent = await generateAssistantMessage(llmMessages, model);
  const assistantNode: Node = {
    id: randomUUID(),
    conversationId,
    parentId: userNode.id,
    role: 'assistant',
    content: assistantContent,
    modelUsed: model,
    createdAt: Date.now()
  };

  await db.insert(nodes).values(assistantNode);

  return { userNode, assistantNode };
}

export async function buildLineage(conversationId: string, leafId: string | null): Promise<Node[]> {
  if (!leafId) return [];
  const allNodes = await getNodesForConversation(conversationId);
  const map = new Map(allNodes.map((n) => [n.id, n]));
  const lineage: Node[] = [];
  let current: string | null = leafId;

  while (current) {
    const node = map.get(current);
    if (!node) break;
    lineage.push(node);
    current = node.parentId ?? null;
  }

  return lineage.reverse();
}
