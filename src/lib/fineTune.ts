/**
 * Training data for YOUR model, built from YOUR work in OmniFrame:
 * every Custom Effect you saved becomes a (brief -> effect JSON) example.
 * Export is OpenAI chat-format JSONL; submit goes to any OpenAI-compatible
 * fine-tune endpoint with your own key. Nothing leaves the browser until
 * you press Submit, and the key is never stored.
 */
import type { CustomEffect } from '../types'

export interface FineTuneDataset {
  jsonl: string
  examples: number
  estTokens: number
  warnings: string[]
}

export function buildFineTuneDataset(effects: CustomEffect[]): FineTuneDataset {
  const warnings: string[] = []
  const lines: string[] = []
  for (const fx of effects) {
    const clean: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(fx.effect || {})) {
      if (typeof v === 'number' && Number.isFinite(v)) clean[k] = Math.round(v * 1000) / 1000
      else if (typeof v === 'string') clean[k] = v
    }
    if (!Object.keys(clean).length) continue
    const messages = [
      { role: 'system', content: 'You design OmniFrame clip effects. Reply with effect JSON only.' },
      { role: 'user', content: `Create an OmniFrame effect called "${fx.name}".` },
      { role: 'assistant', content: JSON.stringify(clean) },
    ]
    lines.push(JSON.stringify({ messages }))
  }
  if (lines.length < 10) warnings.push(`Only ${lines.length} examples — fine-tune APIs want at least 10, and 50+ works far better. Save more Custom Effects first.`)
  if (!lines.length) warnings.push('No Custom Effects yet. Save some from the Effects panel and they become your training set.')
  const jsonl = lines.join('\n')
  return { jsonl, examples: lines.length, estTokens: Math.round(jsonl.length / 4), warnings }
}

export function downloadTextFile(name: string, text: string, type = 'application/jsonl') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
