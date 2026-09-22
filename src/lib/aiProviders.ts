export type AiProviderId = 'openrouter' | 'openai' | 'anthropic' | 'gemini' | 'mistral' | 'groq' | 'together' | 'deepseek' | 'xai' | 'custom'

export interface AiProviderDefinition {
  id: AiProviderId
  label: string
  endpoint: string
  defaultModel: string
  keyPrefixHint: string
  protocol: 'openai' | 'anthropic' | 'gemini'
  docsUrl: string
}

export const AI_PROVIDERS: AiProviderDefinition[] = [
  { id: 'openrouter', label: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-4o-mini', keyPrefixHint: 'Usually starts with sk-or-', protocol: 'openai', docsUrl: 'https://openrouter.ai/keys' },
  { id: 'openai', label: 'OpenAI', endpoint: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', keyPrefixHint: 'Usually starts with sk-', protocol: 'openai', docsUrl: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', label: 'Anthropic', endpoint: 'https://api.anthropic.com/v1', defaultModel: 'claude-3-5-haiku-latest', keyPrefixHint: 'Usually starts with sk-ant-', protocol: 'anthropic', docsUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'gemini', label: 'Google Gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-2.0-flash', keyPrefixHint: 'Google AI Studio API key', protocol: 'gemini', docsUrl: 'https://aistudio.google.com/app/apikey' },
  { id: 'mistral', label: 'Mistral', endpoint: 'https://api.mistral.ai/v1', defaultModel: 'mistral-small-latest', keyPrefixHint: 'Mistral API key', protocol: 'openai', docsUrl: 'https://console.mistral.ai/api-keys' },
  { id: 'groq', label: 'Groq', endpoint: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile', keyPrefixHint: 'Usually starts with gsk_', protocol: 'openai', docsUrl: 'https://console.groq.com/keys' },
  { id: 'together', label: 'Together AI', endpoint: 'https://api.together.xyz/v1', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', keyPrefixHint: 'Together API key', protocol: 'openai', docsUrl: 'https://api.together.ai/settings/api-keys' },
  { id: 'deepseek', label: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat', keyPrefixHint: 'Usually starts with sk-', protocol: 'openai', docsUrl: 'https://platform.deepseek.com/api_keys' },
  { id: 'xai', label: 'xAI', endpoint: 'https://api.x.ai/v1', defaultModel: 'grok-3-mini', keyPrefixHint: 'xAI API key', protocol: 'openai', docsUrl: 'https://console.x.ai/' },
  { id: 'custom', label: 'Custom (OpenAI-compatible)', endpoint: '', defaultModel: '', keyPrefixHint: 'Enter only the provider-issued API key', protocol: 'openai', docsUrl: '' },
]

export interface AiConnectionConfig { provider: AiProviderId; apiKey: string; model: string; endpoint?: string }

export async function testAiConnection(config: AiConnectionConfig, signal?: AbortSignal): Promise<void> {
  const provider = AI_PROVIDERS.find((item) => item.id === config.provider)
  if (!provider) throw new Error('Unknown AI provider.')
  const key = config.apiKey.trim()
  const model = config.model.trim()
  const base = (config.provider === 'custom' ? config.endpoint : provider.endpoint)?.trim().replace(/\/$/, '')
  if (!key) throw new Error('Enter an API key.')
  if (!model) throw new Error('Enter a model ID.')
  if (!base || !/^https:\/\//i.test(base)) throw new Error('Custom endpoint must be a valid HTTPS URL.')

  let response: Response
  if (provider.protocol === 'anthropic') {
    response = await fetch(`${base}/messages`, { method: 'POST', signal, headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'Reply OK' }] }) })
  } else if (provider.protocol === 'gemini') {
    response = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply OK' }] }], generationConfig: { maxOutputTokens: 1 } }) })
  } else {
    response = await fetch(`${base}/chat/completions`, { method: 'POST', signal, headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'Reply OK' }] }) })
  }
  if (!response.ok) {
    let detail = ''
    try { detail = String((await response.json() as { error?: { message?: string } }).error?.message ?? '') } catch { /* response was not JSON */ }
    throw new Error(detail || `Provider returned HTTP ${response.status}.`)
  }
}
