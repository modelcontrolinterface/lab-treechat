import { useMemo } from 'react'
import ReactFlow, { Background, Controls } from 'reactflow'
import type { Edge, Node as FlowNode } from 'reactflow'
import type { TreeNode } from '../types'
import 'reactflow/dist/style.css'

type GraphViewProps = {
  nodes: TreeNode[]
  activeNodeId: string | null
  onSelectNode: (id: string) => void
}

export function GraphView({ nodes, activeNodeId, onSelectNode }: GraphViewProps) {
  const { flowNodes, edges } = useMemo(() => createFlowData(nodes, activeNodeId), [nodes, activeNodeId])

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">Overview</div>
          <div className="panel-subtitle">Click a node to update the active lineage.</div>
        </div>
      </div>
      <div className="graph-canvas">
        <ReactFlow
          fitView
          nodes={flowNodes}
          edges={edges}
          onNodeClick={(_, node) => onSelectNode(node.id)}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}

function createFlowData(nodes: TreeNode[], activeNodeId: string | null): {
  flowNodes: FlowNode[]
  edges: Edge[]
} {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const depthCache = new Map<string, number>()

  const getDepth = (nodeId: string | null | undefined): number => {
    if (!nodeId) return 0
    if (depthCache.has(nodeId)) return depthCache.get(nodeId)!
    const node = nodeMap.get(nodeId)
    if (!node) return 0
    const depth = getDepth(node.parentId) + 1
    depthCache.set(nodeId, depth)
    return depth
  }

  nodes.forEach((node) => getDepth(node.id))

  const groupedByDepth = new Map<number, TreeNode[]>()
  nodes.forEach((node) => {
    const depth = depthCache.get(node.id) ?? 0
    const bucket = groupedByDepth.get(depth) ?? []
    bucket.push(node)
    groupedByDepth.set(depth, bucket)
  })

  const flowNodes: FlowNode[] = []
  const columnWidth = 260
  const rowHeight = 140

  Array.from(groupedByDepth.entries())
    .sort(([a], [b]) => a - b)
    .forEach(([depth, group]) => {
      group
        .sort((a, b) => a.createdAt - b.createdAt)
        .forEach((node, index) => {
          const preview = node.content.length > 80 ? `${node.content.slice(0, 80)}…` : node.content
          flowNodes.push({
            id: node.id,
            data: { label: preview || '(empty message)' },
            position: { x: depth * columnWidth, y: index * rowHeight },
            style: {
              background: node.role === 'user' ? '#e5f0ff' : '#f5f5f5',
              border: node.id === activeNodeId ? '2px solid #3b82f6' : '1px solid #d1d5db',
              borderRadius: 12,
              padding: 12,
              color: '#0f172a',
              width: 220
            }
          })
        })
    })

  const edges: Edge[] = nodes
    .filter((node) => node.parentId)
    .map((node) => ({
      id: `${node.parentId}-${node.id}`,
      source: node.parentId!,
      target: node.id
    }))

  return { flowNodes, edges }
}
