/**
 * Model equivalents catalog: for every capability OmniFrame can call, the
 * same-tier model on each provider, so switching providers never means
 * guessing a model ID. IDs drift over time — the provider's /models list
 * (fetched by the connection test) is the live source of truth; this table
 * is the curated starting point and the fine-tune base list.
 */
import type { AiProviderId } from './aiProviders'

export type ModelCapability = 'chat' | 'vision' | 'image' | 'video' | 'transcribe' | 'embed'

export const MODEL_CAPABILITIES: { id: ModelCapability; label: string; note: string }[] = [
  { id: 'chat', label: 'Chat / Assist', note: 'Naming, briefs, summaries, effect ideas' },
  { id: 'vision', label: 'Vision', note: 'Frame reading, scene description, QC checks' },
  { id: 'image', label: 'Image', note: 'Stills, thumbnails, overlay art' },
  { id: 'video', label: 'Video', note: 'Generated shots and inserts' },
  { id: 'transcribe', label: 'Transcribe', note: 'Speech to captions' },
  { id: 'embed', label: 'Embeddings', note: 'Library search and taste matching' },
]

export interface ModelEquivalent {
  provider: AiProviderId
  model: string
  tier: 'flagship' | 'fast' | 'budget'
  note?: string
}

/** capability -> same-job models per provider (equivalents). */
export const MODEL_EQUIVALENTS: Record<ModelCapability, ModelEquivalent[]> = {
  chat: [
    { provider: 'openai', model: 'gpt-4o', tier: 'flagship' },
    { provider: 'openai', model: 'gpt-4o-mini', tier: 'budget' },
    { provider: 'anthropic', model: 'claude-3-5-sonnet-latest', tier: 'flagship' },
    { provider: 'anthropic', model: 'claude-3-5-haiku-latest', tier: 'fast' },
    { provider: 'gemini', model: 'gemini-2.0-flash', tier: 'fast' },
    { provider: 'mistral', model: 'mistral-large-latest', tier: 'flagship' },
    { provider: 'mistral', model: 'mistral-small-latest', tier: 'budget' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', tier: 'fast' },
    { provider: 'together', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', tier: 'fast' },
    { provider: 'deepseek', model: 'deepseek-chat', tier: 'budget' },
    { provider: 'xai', model: 'grok-3', tier: 'flagship' },
    { provider: 'xai', model: 'grok-3-mini', tier: 'budget' },
    { provider: 'openrouter', model: 'openai/gpt-4o-mini', tier: 'budget', note: 'Aggregator — any routed model works' },
  ],
  vision: [
    { provider: 'openai', model: 'gpt-4o', tier: 'flagship' },
    { provider: 'anthropic', model: 'claude-3-5-sonnet-latest', tier: 'flagship' },
    { provider: 'gemini', model: 'gemini-2.0-flash', tier: 'fast' },
    { provider: 'groq', model: 'llama-3.2-90b-vision-preview', tier: 'fast' },
    { provider: 'together', model: 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo', tier: 'fast' },
    { provider: 'xai', model: 'grok-2-vision-latest', tier: 'flagship' },
    { provider: 'openrouter', model: 'openai/gpt-4o', tier: 'flagship' },
  ],
  image: [
    { provider: 'openai', model: 'gpt-image-1', tier: 'flagship' },
    { provider: 'gemini', model: 'imagen-3.0-generate-002', tier: 'flagship' },
    { provider: 'together', model: 'black-forest-labs/FLUX.1-schnell', tier: 'fast' },
    { provider: 'openrouter', model: 'black-forest-labs/flux-1.1-pro', tier: 'flagship' },
  ],
  video: [
    { provider: 'gemini', model: 'veo-2.0-generate-001', tier: 'flagship' },
    { provider: 'openrouter', model: 'google/veo-3', tier: 'flagship', note: 'Routed where available' },
  ],
  transcribe: [
    { provider: 'openai', model: 'gpt-4o-transcribe', tier: 'flagship' },
    { provider: 'openai', model: 'whisper-1', tier: 'budget' },
    { provider: 'groq', model: 'whisper-large-v3', tier: 'fast' },
    { provider: 'gemini', model: 'gemini-2.0-flash', tier: 'fast', note: 'Audio input via chat protocol' },
    { provider: 'together', model: 'openai/whisper-large-v3', tier: 'fast' },
  ],
  embed: [
    { provider: 'openai', model: 'text-embedding-3-small', tier: 'budget' },
    { provider: 'openai', model: 'text-embedding-3-large', tier: 'flagship' },
    { provider: 'mistral', model: 'mistral-embed', tier: 'budget' },
    { provider: 'gemini', model: 'text-embedding-004', tier: 'budget' },
    { provider: 'together', model: 'BAAI/bge-large-en-v1.5', tier: 'budget' },
  ],
}

export const equivalentsFor = (capability: ModelCapability, provider: AiProviderId): ModelEquivalent[] =>
  MODEL_EQUIVALENTS[capability].filter((m) => m.provider === provider)

export const equivalentAcrossProviders = (capability: ModelCapability, tier?: string): ModelEquivalent[] =>
  MODEL_EQUIVALENTS[capability].filter((m) => !tier || m.tier === tier)

/** Models a provider accepts as fine-tune bases (OpenAI-protocol submit). */
export const FINETUNE_BASES: Partial<Record<AiProviderId, string[]>> = {
  openai: ['gpt-4o-mini-2024-07-18', 'gpt-4o-2024-08-06', 'gpt-3.5-turbo-0125'],
  openrouter: [], // aggregator — fine-tune on the origin provider instead
  together: ['meta-llama/Llama-3.1-8B-Instruct', 'mistralai/Mistral-7B-Instruct-v0.3'],
  deepseek: [],
  mistral: ['open-mistral-7b'],
  groq: [],
  xai: [],
}
