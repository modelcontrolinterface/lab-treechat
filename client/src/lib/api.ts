import type { Conversation, TreeNode } from '../types'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error?.error ?? 'Request failed')
  }
  return res.json()
}

export async function createConversation(title: string): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  })

  return handleResponse<Conversation>(res)
}

export async function fetchNodes(conversationId: string): Promise<TreeNode[]> {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}/nodes`)
  return handleResponse<TreeNode[]>(res)
}

export async function sendMessage(payload: {
  conversationId: string
  parentId: string | null
  content: string
  model: string
}): Promise<{ user_node: TreeNode; assistant_node: TreeNode }> {
  const res = await fetch(`${API_BASE}/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversation_id: payload.conversationId,
      parent_id: payload.parentId,
      content: payload.content,
      model: payload.model
    })
  })

  return handleResponse(res)
}
