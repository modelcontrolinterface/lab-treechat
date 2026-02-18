import type { TreeNode } from '../types'

type Props = {
  node: TreeNode
  active?: boolean
  onSelect?: (id: string) => void
}

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export function MessageBubble({ node, active, onSelect }: Props) {
  const isUser = node.role === 'user'
  return (
    <div
      className={`message-bubble ${isUser ? 'user' : 'assistant'} ${active ? 'active' : ''}`}
      onClick={() => onSelect?.(node.id)}
    >
      <div className="message-header">
        <span className="pill">{isUser ? 'User' : 'Assistant'}</span>
        <span className="timestamp">{formatTime(node.createdAt)}</span>
      </div>
      <div className="message-content">{node.content}</div>
      <div className="message-meta">Model: {node.modelUsed}</div>
    </div>
  )
}
