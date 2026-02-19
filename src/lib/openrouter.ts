import type { SessionRecord } from "@/lib/db/schema"
import { fakeSummary } from "@/lib/summaries"

export type ModelOption = {
  id: string
  name: string
}

const DEFAULT_MODELS: ModelOption[] = [
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash" },
]

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1"

const referer = import.meta.env.VITE_APP_URL ?? window.location.origin
const appTitle = import.meta.env.VITE_APP_NAME ?? "LLM Client"

export async function fetchModelOptions(_: AbortSignal): Promise<ModelOption[]> {
  return DEFAULT_MODELS
}

export type PromptPayload = {
  prompt: string
  model: string
  context: SessionRecord[]
}

export type PromptResult = {
  response: string
  summary: string
}

export async function sendPrompt({ prompt, model, context }: PromptPayload): Promise<PromptResult> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
  const messages = buildMessages(context, prompt)

  if (!apiKey) {
    const synthetic = `Simulated response for ${model}: ${prompt.slice(0, 80)}`
    return {
      response: synthetic,
      summary: fakeSummary(prompt),
    }
  }

  const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": referer,
      "X-Title": appTitle,
    },
    body: JSON.stringify({
      model,
      messages,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenRouter error: ${response.status}`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const content = payload.choices?.[0]?.message?.content?.trim()

  return {
    response: content ?? "",
    summary: fakeSummary(prompt),
  }
}

function buildMessages(context: SessionRecord[], prompt: string) {
  const ancestry = [...context].sort((a, b) => (Number(a.createdAt) ?? 0) - (Number(b.createdAt) ?? 0))

  const historical = ancestry.flatMap((node) => {
    if (!node.prompt || !node.response) {
      return []
    }

    return [
      { role: "user", content: node.prompt },
      { role: "assistant", content: node.response },
    ]
  })

  return [...historical, { role: "user", content: prompt }]
}
