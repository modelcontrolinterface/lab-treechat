export function fakeSummary(prompt: string): string {
  if (!prompt) {
    return "Awaiting prompt"
  }

  const trimmed = prompt.trim().replace(/\s+/g, " ")
  const snippet = trimmed.slice(0, 80)
  return `${snippet}${trimmed.length > 80 ? "…" : ""}`
}
