import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  parentId: text("parent_id"),
  rootId: text("root_id"),
  title: text("title"),
  summary: text("summary"),
  prompt: text("prompt"),
  response: text("response"),
  model: text("model"),
  status: text("status").default("idle"),
  depth: integer("depth").default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
})

export type SessionRecord = typeof sessions.$inferSelect
export type SessionInsert = typeof sessions.$inferInsert

export type SessionStatus = "idle" | "processing" | "completed" | "error"
