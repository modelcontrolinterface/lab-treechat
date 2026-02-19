import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useSessionManager } from "@/lib/useSessions";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";

import type { ModelOption } from "@/lib/openrouter";
import type { SessionRecord } from "@/lib/db/schema";

import { Button } from "@/components/ui/button";
import { Loader2, ArrowUp, Plus } from "lucide-react";
import { ChatView } from "@/features/chat/ChatView";
import { Textarea } from "@/components/ui/textarea";
import { GraphView } from "@/features/sessions/GraphView";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

function App() {
  const {
    sessions,
    selectedSession,
    prompt,
    setPrompt,
    sendMessage,
    models,
    modelsLoading,
    selectedModelId,
    setSelectedModelId,
    createBranch,
    createNewChat,
    navigateToSibling,
    navigateToSession,
    handleClone,
    handleEdit,
    handleDelete,
    handleRegenerate,
  } = useSessionManager()

  const navigate = useNavigate()
  const location = useLocation()
  
  const lineage = useMemo(() => {
    if (!selectedSession) {
      return []
    }

    const chain: typeof sessions = []
    const map = new Map(sessions.map((s) => [s.id, s]))

    let current: typeof selectedSession | null = selectedSession

    while (current) {
      chain.unshift(current)
      current = current.parentId ? map.get(current.parentId) ?? null : null
    }
    return chain
  }, [selectedSession, sessions])

  const isChatRoute = location.pathname.startsWith("/chat") || location.pathname === "/"
  const isContextRoute = location.pathname === "/context"

  const handleTabChange = (value: string) => {
    if (value === "chat") {
      if (selectedSession) {
        const lineageIds = lineage.map(s => s.id).join("/")
        navigate(`/chat/${lineageIds}`)
      } else {
        navigate("/chat")
      }
    } else if (value === "context") {
      navigate("/context")
    }
  }

  return (
    <div className="flex h-screen justify-center text-foreground">
      <div className="relative flex flex-col w-full">
        <div className="fixed top-0 left-0 right-0 z-20 flex bg-background/80 backdrop-blur-sm border-b border-border shadow-sm p-3">
          <div className="w-full flex items-center justify-between gap-2">
            <Button
              size="icon"
              className="h-9 w-9"
              onClick={createNewChat}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground">
              <button
                onClick={() => handleTabChange("chat")}
                className={cn(
                  "inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50",
                  isChatRoute 
                    ? "bg-background shadow-sm text-foreground dark:border-input dark:bg-input/30" 
                    : "text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground"
                )}
              >
                Conversation
              </button>
              <button
                onClick={() => handleTabChange("context")}
                className={cn(
                  "inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50",
                  isContextRoute 
                    ? "bg-background shadow-sm text-foreground dark:border-input dark:bg-input/30" 
                    : "text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground"
                )}
              >
                Context
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 pt-16 relative">
          <Routes>
            <Route path="/" element={
              <ChatRoute 
                lineage={lineage} 
                selectedSession={selectedSession}
                sessions={sessions}
                onBranch={createBranch}
                onClone={handleClone}
                onDelete={handleDelete}
                onRegenerate={handleRegenerate}
                onNavigateToSibling={navigateToSibling}
              />
            } />
            <Route path="/chat" element={
              <ChatRoute 
                lineage={lineage} 
                selectedSession={selectedSession}
                sessions={sessions}
                onBranch={createBranch}
                onClone={handleClone}
                onDelete={handleDelete}
                onRegenerate={handleRegenerate}
                onNavigateToSibling={navigateToSibling}
              />
            } />
            <Route path="/chat/*" element={
              <ChatRoute 
                lineage={lineage} 
                selectedSession={selectedSession}
                sessions={sessions}
                onBranch={createBranch}
                onClone={handleClone}
                onDelete={handleDelete}
                onRegenerate={handleRegenerate}
                onNavigateToSibling={navigateToSibling}
              />
            } />
            <Route path="/context" element={
              <GraphView
                sessions={sessions}
                onSelectSession={navigateToSession}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            } />
          </Routes>
        </div>

        {isChatRoute && (
          <div className="pointer-events-none fixed bottom-0 left-0 right-0 flex justify-center pb-6 bg-gradient-to-t from-background via-background/80 to-transparent pt-10 z-10">
            <PromptComposer
              prompt={prompt}
              onPromptChange={setPrompt}
              onSubmit={sendMessage}
              models={models}
              selectedModelId={selectedModelId}
              onSelectModel={setSelectedModelId}
              loadingModels={modelsLoading}
            />
          </div>
        )}
      </div>
    </div>
  )
}

type ChatRouteProps = {
  lineage: SessionRecord[]
  selectedSession: SessionRecord | null
  sessions: SessionRecord[]
  onBranch?: (sessionId: string) => void
  onClone?: (sessionId: string) => void
  onDelete?: (sessionId: string) => void
  onRegenerate?: (sessionId: string) => void
  onNavigateToSibling?: (sessionId: string) => void
}

function ChatRoute({ lineage, selectedSession, sessions, onBranch, onClone, onDelete, onRegenerate, onNavigateToSibling }: ChatRouteProps) {
  return (
    <div className="absolute inset-0 m-0 flex flex-col">
      <ChatView 
        lineage={lineage} 
        selectedSession={selectedSession}
        sessions={sessions}
        onBranch={onBranch}
        onFork={onClone}
        onDelete={onDelete}
        onRegenerate={onRegenerate}
        onNavigateToSibling={onNavigateToSibling}
      />
    </div>
  )
}

type PromptComposerProps = {
  prompt: string
  onPromptChange: (value: string) => void
  onSubmit: () => void
  models: ModelOption[]
  selectedModelId: string
  onSelectModel: (id: string) => void
  loadingModels: boolean
}

function PromptComposer({ prompt, onPromptChange, onSubmit, models, selectedModelId, onSelectModel, loadingModels }: PromptComposerProps) {
  const selectedModel = models.find((model) => model.id === selectedModelId) ?? models[0]
  const canSend = prompt.trim().length > 0

  return (
    <div className="pointer-events-auto w-full max-w-[42rem]">
      <div className="flex flex-col min-h-[120px] rounded-3xl cursor-text bg-card border border-border shadow-lg">
        <div className="flex-1 relative overflow-y-auto max-h-[168px]">
          <Textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            placeholder="Ask anything..."
            className="w-full p-4 border-0 bg-transparent dark:bg-transparent whitespace-pre-wrap break-words leading-6 resize-none outline-none focus-visible:ring-0 shadow-none"
            rows={6}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                onSubmit()
              }
            }}
          />
        </div>
        <div className="flex min-h-[40px] items-center gap-2 p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-sm text-muted-foreground hover:text-foreground rounded-full"
              >
                <span className="text-xs font-medium">{selectedModel?.name ?? "model"}</span>
                {loadingModels && <Loader2 className="ml-2 h-3 w-3 animate-spin" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 space-y-1">
              {models.map((model) => (
                <DropdownMenuItem
                  key={model.id}
                  onSelect={() => onSelectModel(model.id)}
                  className="text-xs py-1.5"
                >
                  {model.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="ml-auto flex items-center gap-3">
            <Button
              onClick={onSubmit}
              size="icon"
              className={cn(
                "rounded-full transition-colors duration-100 ease-out bg-primary",
                canSend ? "hover:bg-primary/90" : "opacity-60 cursor-not-allowed",
              )}
              disabled={!canSend}
              aria-label="Send message"
            >
              <ArrowUp className="h-4 w-4 text-primary-foreground" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
