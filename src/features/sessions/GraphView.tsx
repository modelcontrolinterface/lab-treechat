import { useMemo, useState } from "react";
import type { SessionRecord } from "@/lib/db/schema";
import type { Edge, Node, NodeProps } from "@xyflow/react";
import { Background, Controls, MarkerType, ReactFlow, BackgroundVariant, Handle, Position } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type GraphViewProps = {
  sessions: SessionRecord[]
  onSelectSession?: (sessionId: string) => void
  onDelete: (sessionId: string) => void
  onEdit: (sessionId: string) => void
}

export function GraphView({ sessions, onSelectSession, onDelete, onEdit }: GraphViewProps) {
  const [deleteTarget, setDeleteTarget] = useState<SessionRecord | null>(null)

  const nodes = useMemo<Node[]>(() => {
    return sessions.map((session, index) => ({
      id: session.id,
      type: "sessionNode",
      position: {
        x: (session.depth ?? 0) * 200,
        y: index * 80,
      },
      data: {
        label: session.summary ?? session.title ?? "Untitled",
        onSelect: onSelectSession,
        onEdit,
        requestDelete: setDeleteTarget,
        session,
        sessionId: session.id,
        isRoot: !session.parentId,
      },
    }))
  }, [sessions, onSelectSession, onEdit])

  const edges = useMemo<Edge[]>(() => {
    return sessions
      .filter((session) => session.parentId)
      .map((session) => ({
        id: `${session.parentId}-${session.id}`,
        source: session.parentId!,
        target: session.id,
        type: "smoothstep",
        style: { stroke: "#888", strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#888",
        },
      }))
  }, [sessions])

  const nodeTypes = useMemo(() => ({
    sessionNode: SessionNode,
  }), [])

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        nodesDraggable={true}
        nodesConnectable={false}
        fitViewOptions={{ padding: 0.3 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete session</DialogTitle>
            <DialogDescription>This action removes the node and all of its descendants.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  onDelete(deleteTarget.id)
                }
                setDeleteTarget(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

type SessionNodeData = {
  label: string
  sessionId: string
  session: SessionRecord
  isRoot: boolean
  onSelect?: (sessionId: string) => void
  onEdit: (sessionId: string) => void
  requestDelete: (session: SessionRecord) => void
}

function SessionNode({ data }: NodeProps<Node<SessionNodeData>>) {
  const { label, sessionId, session, isRoot, onSelect, onEdit, requestDelete } = data

  return (
    <div
      className="px-4 py-2 rounded-lg bg-card border-2 border-border shadow-sm cursor-pointer hover:border-primary transition-colors relative group"
      onClick={() => onSelect?.(sessionId)}
    >
      {/* Target handle on the left - where edges connect TO this node */}
      {!isRoot && (
        <Handle
          type="target"
          position={Position.Left}
          className="!bg-muted-foreground !w-2 !h-2"
        />
      )}
      
      <p className="text-sm font-medium text-foreground truncate max-w-[150px]">
        {label}
      </p>

      {/* Action buttons - shown on hover, only for non-root nodes */}
      {!isRoot && (
        <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="secondary"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(sessionId)
            }}
            aria-label="Edit"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="destructive"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation()
              requestDelete(session)
            }}
            aria-label="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
      
      {/* Source handle on the right - where edges connect FROM this node */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-muted-foreground !w-2 !h-2"
      />
    </div>
  )
}

