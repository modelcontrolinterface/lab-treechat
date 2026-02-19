import { asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid/non-secure";

import { sessions } from "@/lib/db/schema";
import { db, isDatabaseAvailable } from "@/lib/db/client";
import type { SessionInsert, SessionRecord } from "@/lib/db/schema";

const STORAGE_KEY = "lab-tree-sessions"

function readMemoryStore(): SessionRecord[] {
  if (typeof localStorage === "undefined") {
    return []
  }

  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as SessionRecord[]
    return parsed
  } catch (error) {
    console.warn("Failed to parse session cache", error)
    return []
  }
}

function writeMemoryStore(records: SessionRecord[]) {
  if (typeof localStorage === "undefined") {
    return
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

let memoryStore: SessionRecord[] = readMemoryStore()

function persistMemoryStore() {
  memoryStore.sort((a, b) => {
    const aTime = typeof a.createdAt === 'number' ? a.createdAt : 0
    const bTime = typeof b.createdAt === 'number' ? b.createdAt : 0
    return aTime - bTime
  })
  writeMemoryStore(memoryStore)
}

const now = () => Date.now()

function withDefaults(input: Partial<SessionInsert>): SessionRecord {
  const timestamp = now()
  return {
    id: input.id ?? nanoid(),
    parentId: input.parentId ?? null,
    rootId: input.rootId ?? input.parentId ?? null,
    title: input.title ?? "New Session",
    summary: input.summary ?? "Pending summary",
    prompt: input.prompt ?? null,
    response: input.response ?? null,
    model: input.model ?? "openrouter/auto",
    status: (input.status as SessionRecord["status"]) ?? "idle",
    depth: input.depth ?? 0,
    createdAt: input.createdAt instanceof Date
      ? input.createdAt
      : input.createdAt
        ? new Date(input.createdAt)
        : new Date(timestamp),
    updatedAt: input.updatedAt instanceof Date
      ? input.updatedAt
      : input.updatedAt
        ? new Date(input.updatedAt)
        : new Date(timestamp),
  }
}

export async function listSessions(): Promise<SessionRecord[]> {
  if (isDatabaseAvailable && db) {
    return db.select().from(sessions).orderBy(asc(sessions.createdAt))
  }

  return [...memoryStore]
}

export async function upsertSession(record: Partial<SessionInsert>): Promise<SessionRecord> {
  const next = withDefaults(record)

  if (isDatabaseAvailable && db) {
    await db.insert(sessions).values(next).onConflictDoUpdate({
      target: sessions.id,
      set: next,
    })
    return next
  }

  const existingIndex = memoryStore.findIndex((session) => session.id === next.id)

  if (existingIndex >= 0) {
    memoryStore[existingIndex] = next
  } else {
    memoryStore.push(next)
  }

  persistMemoryStore()
  return next
}

export async function updateSession(id: string, patch: Partial<SessionInsert>): Promise<SessionRecord | null> {
  if (isDatabaseAvailable && db) {
    const [updated] = await db
      .update(sessions)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, id))
      .returning()

    return updated ?? null
  }

  const target = memoryStore.find((session) => session.id === id)
  if (!target) {
    return null
  }

  Object.assign(target, patch, { updatedAt: now() })
  persistMemoryStore()
  return target
}

function collectDescendants(records: SessionRecord[], parentId: string): Set<string> {
  const queue = [parentId]
  const ids = new Set<string>()

  while (queue.length) {
    const current = queue.shift()!
    ids.add(current)

    records
      .filter((record) => record.parentId === current)
      .forEach((child) => queue.push(child.id))
  }

  return ids
}

export async function deleteSessionCascade(id: string): Promise<void> {
  if (isDatabaseAvailable && db) {
    // With SQLite we cascade manually as well.
    const all = await db.select().from(sessions)
    const targets = collectDescendants(all, id)

    for (const targetId of targets) {
      await db.delete(sessions).where(eq(sessions.id, targetId))
    }
    return
  }

  const targets = collectDescendants(memoryStore, id)
  memoryStore = memoryStore.filter((record) => !targets.has(record.id))
  persistMemoryStore()
}

export async function deleteChildrenSessions(id: string): Promise<void> {
  if (isDatabaseAvailable && db) {
    const all = await db.select().from(sessions)
    const targets = collectDescendants(all, id)
    targets.delete(id)

    for (const targetId of targets) {
      await db.delete(sessions).where(eq(sessions.id, targetId))
    }
    return
  }

  const targets = collectDescendants(memoryStore, id)
  targets.delete(id)
  memoryStore = memoryStore.filter((record) => !targets.has(record.id))
  persistMemoryStore()
}

export async function ensureRootSession(): Promise<SessionRecord> {
  const existing = (await listSessions()).find((session) => !session.parentId)

  if (existing) {
    return existing
  }

  const root = await upsertSession({
    title: "Root",
    summary: "Root",
    prompt: null,
    response: null,
    parentId: null,
    rootId: null,
    depth: 0,
    status: "idle",
  })

  return root
}

export async function forkSession(source: SessionRecord): Promise<SessionRecord> {
  const fork = await upsertSession({
    parentId: source.parentId ?? null,
    rootId: source.rootId ?? source.id,
    prompt: source.prompt,
    title: source.title ? `${source.title} (fork)` : "Fork",
    summary: source.summary,
    response: null,
    status: "idle",
    depth: source.depth ?? 0,
    model: source.model,
  })

  return fork
}
