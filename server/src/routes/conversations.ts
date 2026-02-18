import { Router } from 'express';
import { createConversation, getConversation, getNodesForConversation } from '../services/conversationService.js';

const router = Router();

router.post('/conversations', async (req, res) => {
  try {
    const { title } = req.body ?? {};
    const safeTitle = typeof title === 'string' && title.trim().length > 0 ? title.trim() : 'New Conversation';
    const conversation = await createConversation(safeTitle);
    res.status(201).json(conversation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

router.get('/conversations/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const conversation = await getConversation(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load conversation' });
  }
});

router.get('/conversations/:id/nodes', async (req, res) => {
  const { id } = req.params;
  try {
    const nodes = await getNodesForConversation(id);
    res.json(nodes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load nodes' });
  }
});

export default router;
