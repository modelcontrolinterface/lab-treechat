import { Router } from 'express';
import { createUserAndAssistantNodes } from '../services/nodeService.js';

const router = Router();

router.post('/nodes', async (req, res) => {
  try {
    const { conversation_id, parent_id, content, model } = req.body ?? {};
    if (!conversation_id || typeof conversation_id !== 'string') {
      return res.status(400).json({ error: 'conversation_id is required' });
    }
    if (content === undefined || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'content is required' });
    }
    const modelName = typeof model === 'string' && model.trim().length > 0 ? model.trim() : 'gpt-4o-mini';
    const parentId = parent_id ? String(parent_id) : null;

    const result = await createUserAndAssistantNodes({
      conversationId: conversation_id,
      parentId,
      content: content.trim(),
      model: modelName
    });

    res.status(201).json({
      user_node: result.userNode,
      assistant_node: result.assistantNode
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error instanceof Error && error.message.includes('root')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create nodes' });
  }
});

export default router;
