export type Conversation = {
  id: string
  title: string
  createdAt: number
}

export type TreeNode = {
  id: string
  conversationId: string
  parentId: string | null
  role: 'user' | 'assistant'
  content: string
  modelUsed: string
  createdAt: number
}
