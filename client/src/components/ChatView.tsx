import { useState } from 'react'
import type { FormEvent } from 'react'
import type { TreeNode } from '../types'
import { MessageBubble } from './MessageBubble'

type ChatViewProps = {
  lineage: TreeNode[]
  activeNodeId: string | null
  onSelectNode: (id: string) => void
  onSend: (content: string) => void
  isSending: boolean
  model: string
  onModelChange: (model: string) => void
}

const models = ['gpt-4o-mini', 'gpt-4o', 'claude-3.5-sonnet']

export function ChatView({
  lineage,
  activeNodeId,
  onSelectNode,
  onSend,
  isSending,
  model,
  onModelChange
}: ChatViewProps) {
  const [draft, setDraft] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim() || isSending) return
    onSend(draft.trim())
    setDraft('')
  }

  return (
    <div className="chat-container">
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">Active Lineage</div>
            <div className="panel-subtitle">
              {lineage.length ? 'Messages from root to selected node' : 'No messages yet'}
            </div>
          </div>
          <label className="model-select">
            <span>Model</span>
            <select value={model} onChange={(e) => onModelChange(e.target.value)}>
              {models.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="scroll-area">
          {lineage.length === 0 ? (
            <div className="empty-state">Start chatting to create the first branch.</div>
          ) : (
            lineage.map((node) => (
              <MessageBubble
                key={node.id}
                node={node}
                active={node.id === activeNodeId}
                onSelect={onSelectNode}
              />
            ))
          )}
        </div>
      </div>

      <form className="input-card" onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your message..."
          rows={3}
        />
        <div className="input-actions">
          <div className="input-help">
            {activeNodeId ? 'Branching from selected node' : 'First message will become root'}
          </div>
          <button type="submit" disabled={isSending || !draft.trim()}>
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}
