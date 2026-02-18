import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import './App.css'
import { ChatView } from './components/ChatView'
import { GraphView } from './components/GraphView'
import { createConversation, fetchNodes, sendMessage } from './lib/api'
import type { Conversation, TreeNode } from './types'

type Tab = 'chat' | 'overview'

function useActiveLineage(nodes: TreeNode[], activeNodeId: string | null): TreeNode[] {
  return useMemo(() => {
    if (!activeNodeId) return []
    const map = new Map(nodes.map((node) => [node.id, node]))
    const lineage: TreeNode[] = []
    let current = map.get(activeNodeId)
    while (current) {
      lineage.unshift(current)
      current = current.parentId ? map.get(current.parentId) : undefined
    }
    return lineage
  }, [activeNodeId, nodes])
}

function App() {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('chat')
  const [model, setModel] = useState('gpt-4o-mini')
  const queryClient = useQueryClient()

  useEffect(() => {
    createConversation('Tree Conversation')
      .then((conversation) => setConversation(conversation))
      .catch((error) => console.error(error))
  }, [])

  const nodesQuery = useQuery({
    queryKey: ['nodes', conversation?.id],
    queryFn: () => fetchNodes(conversation!.id),
    enabled: Boolean(conversation),
    refetchOnWindowFocus: false
  })

  useEffect(() => {
    if (nodesQuery.data && nodesQuery.data.length > 0 && !activeNodeId) {
      setActiveNodeId(nodesQuery.data[nodesQuery.data.length - 1].id)
    }
  }, [nodesQuery.data, activeNodeId])

  const lineage = useActiveLineage(nodesQuery.data ?? [], activeNodeId)

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      sendMessage({
        conversationId: conversation!.id,
        parentId: activeNodeId,
        content,
        model
      }),
    onSuccess: (result) => {
      setActiveNodeId(result.assistant_node.id)
      queryClient.invalidateQueries({ queryKey: ['nodes', conversation?.id] })
    }
  })

  const handleSend = (content: string) => {
    if (!conversation) return
    sendMutation.mutate(content)
  }

  const isLoading = !conversation || nodesQuery.isLoading

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <div className="app-title">Tree-Context-Inheritance</div>
          <div className="app-subtitle">
            Branching chat interface with Copilot-inspired context reconstruction.
          </div>
        </div>
        <div className="tabs">
          <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>
            Chat
          </button>
          <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>
            Overview
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="loader">Preparing conversation...</div>
      ) : nodesQuery.error ? (
        <div className="error">Failed to load nodes</div>
      ) : (
        <div className="content">
          {tab === 'chat' ? (
            <ChatView
              lineage={lineage}
              activeNodeId={activeNodeId}
              onSelectNode={setActiveNodeId}
              onSend={handleSend}
              isSending={sendMutation.isPending}
              model={model}
              onModelChange={setModel}
            />
          ) : (
            <GraphView
              nodes={nodesQuery.data ?? []}
              activeNodeId={activeNodeId}
              onSelectNode={(id) => {
                setActiveNodeId(id)
                setTab('chat')
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default App
