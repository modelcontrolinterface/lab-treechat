import { toast } from "sonner";
import { fakeSummary } from "@/lib/summaries";
import type { ModelOption } from "@/lib/openrouter";
import type { SessionRecord } from "@/lib/db/schema";
import { fetchModelOptions, sendPrompt } from "@/lib/openrouter";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    forkSession,
    listSessions,
    updateSession,
    upsertSession,
    ensureRootSession,
    deleteSessionCascade,
    deleteChildrenSessions,
} from "@/lib/db/session-repository"

export type SessionTab = "chat" | "context"

export function useSessionManager() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [activeTab, setActiveTab] = useState<SessionTab>("chat")
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [models, setModels] = useState<ModelOption[]>([])
  const [selectedModelId, setSelectedModelId] = useState<string>("openrouter/auto")
  const [modelsLoading, setModelsLoading] = useState(false)
  const [prompt, setPrompt] = useState("")

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      const root = await ensureRootSession()
      let existing = await listSessions()
      if (!mounted) return

      if (!existing.length) {
        existing = [root]
      }

      const rogueRoots = existing.filter((session) => !session.parentId && session.id !== root.id)
      if (rogueRoots.length) {
        await Promise.all(
          rogueRoots.map((session) =>
            updateSession(session.id, {
              parentId: root.id,
              rootId: root.id,
              depth: 1,
            }),
          ),
        )
        existing = await listSessions()
      }

      const sorted = sortSessions(existing)
      setSessions(sorted)
      const firstChild = sorted.find((session) => session.parentId === root.id)
      setSelectedSessionId(firstChild?.id ?? root.id)
    }

    bootstrap()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setModelsLoading(true)

    fetchModelOptions(controller.signal)
      .then((options) => {
        setModels(options)
        setSelectedModelId((current) => current ?? options[0]?.id ?? "openrouter/auto")
      })
      .catch(() => {})
      .finally(() => setModelsLoading(false))

    return () => controller.abort()
  }, [])

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? sessions[0] ?? null,
    [sessions, selectedSessionId],
  )

  const createBranch = useCallback(
    (targetId: string) => {
      const parent = sessions.find((session) => session.id === targetId)
      if (!parent) return
      
      setSelectedSessionId(targetId)
      
      const lineage = buildLineage(parent, sessions)
      const lineageIds = lineage.map(s => s.id).join("/")
      navigate(`/chat/${lineageIds}`)
      
      toast("Branch ready", {
        description: "Your next prompt will continue from this node.",
      })
    },
    [sessions, navigate],
  )

  const createNewChat = useCallback(() => {
    const root = sessions.find((session) => !session.parentId)
    if (!root) return
    
    setSelectedSessionId(root.id)
    setPrompt("")
    navigate("/chat")
    
    toast("New chat", {
      description: "Start a fresh conversation.",
    })
  }, [sessions, navigate])

  const navigateToSibling = useCallback((targetId: string) => {
    const target = sessions.find((session) => session.id === targetId)
    if (!target) return
    
    let deepest = target
    let children = sessions.filter(s => s.parentId === deepest.id)
    while (children.length > 0) {
      children.sort((a, b) => {
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt ?? 0)
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt ?? 0)
        return aTime - bTime
      })
      deepest = children[0]
      children = sessions.filter(s => s.parentId === deepest.id)
    }
    
    setSelectedSessionId(deepest.id)
    
    const lineage = buildLineage(deepest, sessions)
    const lineageIds = lineage.map(s => s.id).join("/")
    navigate(`/chat/${lineageIds}`)
  }, [sessions, navigate])

  const navigateToSession = useCallback((targetId: string) => {
    const target = sessions.find((session) => session.id === targetId)
    if (!target) return
    
    setSelectedSessionId(target.id)
    
    const lineage = buildLineage(target, sessions)
    const lineageIds = lineage.map(s => s.id).join("/")
    navigate(`/chat/${lineageIds}`)
  }, [sessions, navigate])

  const handleClone = useCallback(
    async (targetId: string) => {
      const source = sessions.find((session) => session.id === targetId)
      if (!source) return

      const forked = await forkSession(source)
      setSessions((prev) => sortSessions([...prev, forked]))
      setSelectedSessionId(forked.id)
      
      const lineage = buildLineage(forked, [...sessions, forked])
      const lineageIds = lineage.map(s => s.id).join("/")
      navigate(`/chat/${lineageIds}`)
      
      toast.success("Clone created", {
        description: "Edit the prompt and continue the branch.",
      })
    },
    [sessions, navigate],
  )

  const handleEdit = useCallback(
    async (targetId: string, promptUpdate?: string) => {
      const session = sessions.find((s) => s.id === targetId)
      if (!session) return
      
      if (promptUpdate === undefined) {
        setPrompt(session.prompt ?? "")
        
        if (session.parentId) {
          const parent = sessions.find((s) => s.id === session.parentId)
          if (parent) {
            setSelectedSessionId(parent.id)
            const lineage = buildLineage(parent, sessions)
            const lineageIds = lineage.map(s => s.id).join("/")
            navigate(`/chat/${lineageIds}`)
          }
        } else {
          setSelectedSessionId(null)
          navigate("/chat")
        }
        
        toast.info("Edit mode", {
          description: "Modify the prompt and submit to create a new branch.",
        })
        return
      }
      
      const updated = await updateSession(targetId, {
        prompt: promptUpdate,
        summary: fakeSummary(promptUpdate),
      })

      if (!updated) return

      setSessions((prev) => sortSessions(prev.map((session) => (session.id === targetId ? updated : session))))
      toast.success("Prompt updated")
    },
    [sessions, navigate],
  )

  const handleDelete = useCallback(async (targetId: string) => {
    await deleteSessionCascade(targetId)
    let removedSelection = false
    let fallbackId: string | null = null

    setSessions((prev) => {
      const targets = collectDescendantIds(prev, targetId, true)
      const next = prev.filter((record) => !targets.has(record.id))
      if (selectedSessionId && targets.has(selectedSessionId)) {
        removedSelection = true
        fallbackId = next.at(-1)?.id ?? null
      }
      return next
    })

    if (removedSelection) {
      setSelectedSessionId(fallbackId)
    }
    toast("Session deleted")
  }, [selectedSessionId])

  const handleDeleteChildren = useCallback(async (targetId: string) => {
    await deleteChildrenSessions(targetId)
    let removedSelection = false
    let fallbackId: string | null = null

    setSessions((prev) => {
      const targets = collectDescendantIds(prev, targetId, false)
      const next = prev.filter((record) => !targets.has(record.id))
      if (selectedSessionId && targets.has(selectedSessionId)) {
        removedSelection = true
        fallbackId = next.at(-1)?.id ?? null
      }
      return next
    })

    if (removedSelection) {
      setSelectedSessionId(fallbackId)
    }
    toast("Branch cleared")
  }, [selectedSessionId])

  const handleRegenerate = useCallback(async (targetId: string) => {
    const source = sessions.find((session) => session.id === targetId)
    if (!source || !source.prompt) return

    const parent = sessions.find((session) => session.id === source.parentId)
    if (!parent) return

    const draft = await upsertSession({
      parentId: parent.id,
      rootId: parent.rootId ?? parent.id,
      prompt: source.prompt,
      status: "processing",
      model: selectedModelId,
      depth: source.depth ?? (parent.depth ?? 0) + 1,
      title: source.title ?? (source.prompt.slice(0, 32) || "Prompt"),
      summary: fakeSummary(source.prompt),
    })

    setSessions((prev) => sortSessions([...prev, draft]))
    setSelectedSessionId(draft.id)

    const lineage = buildLineage(draft, [...sessions, draft])
    const lineageIds = lineage.map(s => s.id).join("/")
    navigate(`/chat/${lineageIds}`)

    try {
      const context = buildLineage(parent, sessions)
      const result = await sendPrompt({ prompt: source.prompt, model: selectedModelId, context })

      const completed = await updateSession(draft.id, {
        response: result.response,
        summary: result.summary,
        status: "completed",
      })

      if (completed) {
        setSessions((prev) => sortSessions(prev.map((session) => (session.id === draft.id ? completed : session))))
      }

      toast.success("Response regenerated")
    } catch (error) {
      console.error(error)
      const failed = await updateSession(draft.id, { status: "error" })
      if (failed) {
        setSessions((prev) => prev.map((session) => (session.id === draft.id ? failed : session)))
      }
      toast.error("Regeneration failed", { description: (error as Error).message })
    }
  }, [sessions, selectedModelId, navigate])

  const sendMessage = useCallback(async () => {
    const trimmed = prompt.trim()
    if (!trimmed) {
      return
    }

    const parent = selectedSession ?? sessions[0]
    if (!parent) {
      return
    }

    const draft = await upsertSession({
      parentId: parent.id,
      rootId: parent.rootId ?? parent.id,
      prompt: trimmed,
      status: "processing",
      model: selectedModelId,
      depth: (parent.depth ?? 0) + 1,
      title: trimmed.slice(0, 32) || "Prompt",
      summary: fakeSummary(trimmed),
    })

    setSessions((prev) => sortSessions([...prev, draft]))
    setPrompt("")
    setSelectedSessionId(draft.id)

    try {
      const context = buildLineage(parent, sessions)
      const result = await sendPrompt({ prompt: trimmed, model: selectedModelId, context })

      const completed = await updateSession(draft.id, {
        response: result.response,
        summary: result.summary,
        status: "completed",
      })

      if (completed) {
        setSessions((prev) => sortSessions(prev.map((session) => (session.id === draft.id ? completed : session))))
      }

      toast.success("Response ready")
    } catch (error) {
      console.error(error)
      const failed = await updateSession(draft.id, { status: "error" })
      if (failed) {
        setSessions((prev) => prev.map((session) => (session.id === draft.id ? failed : session)))
      }
      toast.error("Request failed", { description: (error as Error).message })
    }
  }, [prompt, selectedSession, sessions, selectedModelId])

  return {
    sessions,
    selectedSession,
    activeTab,
    setActiveTab,
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
    handleDeleteChildren,
    handleRegenerate,
    setSelectedSessionId,
  }
}

function sortSessions(records: SessionRecord[]) {
  return [...records].sort((a, b) => {
    const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt ?? 0)
    const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt ?? 0)
    return aTime - bTime
  })
}

function buildLineage(target: SessionRecord, records: SessionRecord[]) {
  const chain: SessionRecord[] = []
  let current: SessionRecord | undefined = target
  const map = new Map(records.map((record) => [record.id, record]))

  while (current) {
    chain.unshift(current)
    current = current.parentId ? map.get(current.parentId) ?? undefined : undefined
  }

  return chain
}

function collectDescendantIds(records: SessionRecord[], sourceId: string, includeSource = true) {
  const ids = new Set<string>()
  if (includeSource) {
    ids.add(sourceId)
  }

  function walk(parentId: string) {
    records
      .filter((record) => record.parentId === parentId)
      .forEach((child) => {
        ids.add(child.id)
        walk(child.id)
      })
  }

  walk(sourceId)
  return ids
}
