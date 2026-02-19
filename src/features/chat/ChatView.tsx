import type { SessionRecord } from "@/lib/db/schema"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Check, ChevronLeft, ChevronRight, Copy, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-7 w-7"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  )
}

export type ChatViewProps = {
  lineage: SessionRecord[]
  selectedSession: SessionRecord | null
  onBranch?: (sessionId: string) => void
  onFork?: (sessionId: string) => void
  onDelete?: (sessionId: string) => void
  onRegenerate?: (sessionId: string) => void
  onNavigateToSibling?: (sessionId: string) => void
  sessions?: SessionRecord[]
}

export function ChatView({ lineage, selectedSession, onBranch, onFork, onDelete, onRegenerate, onNavigateToSibling, sessions = [] }: ChatViewProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lineage, selectedSession?.status])

  // Helper to check if a session is root
  const isRoot = React.useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId)
    return !session?.parentId
  }, [sessions])

  // Helper to get siblings info for a session
  const getSiblingsInfo = React.useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session?.parentId) return null
    
    const siblings = sessions
      .filter(s => s.parentId === session.parentId)
      .sort((a, b) => {
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt ?? 0)
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt ?? 0)
        return aTime - bTime
      })
    
    if (siblings.length <= 1) return null
    
    const currentIndex = siblings.findIndex(s => s.id === sessionId)
    return {
      current: currentIndex + 1,
      total: siblings.length,
      prevId: currentIndex > 0 ? siblings[currentIndex - 1].id : null,
      nextId: currentIndex < siblings.length - 1 ? siblings[currentIndex + 1].id : null,
    }
  }, [sessions])

  const messages = lineage.flatMap((session) => {
    const items: Array<{ role: "user" | "assistant"; content: string; sessionId: string }> = []

    if (session.prompt) {
      items.push({
        role: "user",
        content: session.prompt,
        sessionId: session.id,
      })
    }

    if (session.response) {
      items.push({
        role: "assistant",
        content: session.response,
        sessionId: session.id,
      })
    }

    return items
  })

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-center text-muted-foreground">
        <div>
          <p className="text-lg font-semibold text-foreground">No messages yet</p>
          <p className="text-sm">Start by sending a prompt below</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto flex justify-center">
      <div className="container max-w-3xl px-8 py-6 pt-18">
        <div className="space-y-6 pb-48">
        {messages.map((msg, idx) => {
          const sessionIsRoot = isRoot(msg.sessionId)
          const isLastMessage = idx === messages.length - 1
          const siblingsInfo = msg.role === "user" ? getSiblingsInfo(msg.sessionId) : null
          
          return (
          <div key={`${msg.sessionId}-${msg.role}-${idx}`}>
            {msg.role === "user" ? (
              <div className="flex justify-end group relative">
                <div className="flex flex-col gap-2 items-end max-w-2xl">
                  <div className="rounded-lg px-4 py-3 bg-primary text-primary-foreground">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {siblingsInfo && onNavigateToSibling && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => siblingsInfo.prevId && onNavigateToSibling(siblingsInfo.prevId)}
                          disabled={!siblingsInfo.prevId}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="min-w-[3ch] text-center">{siblingsInfo.current}/{siblingsInfo.total}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => siblingsInfo.nextId && onNavigateToSibling(siblingsInfo.nextId)}
                          disabled={!siblingsInfo.nextId}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                    <CopyButton content={msg.content} />
                    {!sessionIsRoot && onFork && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => onFork(msg.sessionId)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full group relative">
                <div className="w-full text-sm leading-relaxed break-words markdown-content py-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
                <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <CopyButton content={msg.content} />
                  {!sessionIsRoot && onRegenerate && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => onRegenerate(msg.sessionId)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {!isLastMessage && onBranch && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => onBranch(msg.sessionId)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {!sessionIsRoot && onDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => onDelete(msg.sessionId)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )})}

        {selectedSession?.status === "processing" && (
          <div className="flex justify-start w-full">
            <div className="bg-transparent text-muted-foreground py-2">
              <div className="flex gap-2 items-center">
                <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
