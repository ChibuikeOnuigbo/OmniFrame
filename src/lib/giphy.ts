export interface GiphyResult {
  id: string
  title: string
  pageUrl: string
  previewUrl: string
  mp4Url: string
  width: number
  height: number
}

export type GifProvider = 'giphy' | 'klipy'
export const GIF_PROVIDER_KEY_EVENT = 'omniframe:gif-provider-keys'
const KEY_STORAGE: Record<GifProvider, string> = {
  giphy: 'omniframe.giphyApiKey',
  klipy: 'omniframe.klipyApiKey',
}

export function getGifProviderKey(provider: GifProvider): string {
  if (typeof window === 'undefined') return ''
  return sessionStorage.getItem(KEY_STORAGE[provider]) || ''
}

export function setGifProviderKey(provider: GifProvider, key: string): void {
  if (typeof window === 'undefined') return
  const normalized = key.trim()
  if (normalized) sessionStorage.setItem(KEY_STORAGE[provider], normalized)
  else sessionStorage.removeItem(KEY_STORAGE[provider])
  window.dispatchEvent(new CustomEvent(GIF_PROVIDER_KEY_EVENT, { detail: { provider } }))
}

type GiphyApiItem = {
  id?: string
  title?: string
  url?: string
  images?: {
    fixed_width?: { webp?: string; url?: string }
    original?: { mp4?: string; webp?: string; url?: string; width?: string; height?: string }
  }
}

export function parseGiphyResults(payload: unknown): GiphyResult[] {
  const data = (payload as { data?: GiphyApiItem[] } | null)?.data
  if (!Array.isArray(data)) return []
  return data.flatMap((item) => {
    const original = item.images?.original
    const mp4Url = original?.mp4
    const previewUrl = item.images?.fixed_width?.webp || item.images?.fixed_width?.url || original?.webp || original?.url
    if (!item.id || !mp4Url || !previewUrl) return []
    return [{
      id: item.id,
      title: item.title?.trim() || `GIPHY ${item.id}`,
      pageUrl: item.url || `https://giphy.com/gifs/${item.id}`,
      previewUrl,
      mp4Url,
      width: Number(original?.width) || 0,
      height: Number(original?.height) || 0,
    }]
  })
}

const firstString = (...values: unknown[]): string => values.find((value): value is string => typeof value === 'string' && /^https?:\/\//.test(value)) || ''
const nestedUrl = (value: unknown): string => {
  if (typeof value === 'string') return /^https?:\/\//.test(value) ? value : ''
  if (!value || typeof value !== 'object') return ''
  const item = value as Record<string, unknown>
  const direct = firstString(item.url, item.src)
  if (direct) return direct
  for (const child of Object.values(item)) {
    const found = nestedUrl(child)
    if (found) return found
  }
  return ''
}

/** Klipy has shipped both file.{hd,md,sm}.{mp4,webp,gif} and media_formats payloads. */
export function parseKlipyResults(payload: unknown): GiphyResult[] {
  const root = payload as Record<string, unknown> | null
  const outer = root?.data
  const items = Array.isArray(outer)
    ? outer
    : Array.isArray((outer as Record<string, unknown> | null)?.data)
      ? (outer as Record<string, unknown>).data as unknown[]
      : Array.isArray((outer as Record<string, unknown> | null)?.results)
        ? (outer as Record<string, unknown>).results as unknown[]
        : Array.isArray(root?.results) ? root.results as unknown[] : []
  return items.flatMap((raw) => {
    const item = raw as Record<string, any>
    const file = item.file || item.files || {}
    const formats = item.media_formats || {}
    const mp4Url = firstString(
      file?.hd?.mp4?.url, file?.md?.mp4?.url, file?.sm?.mp4?.url,
      formats?.mp4?.url, formats?.mediumgif?.url, item.mp4_url,
    ) || nestedUrl(item.mp4)
    const previewUrl = firstString(
      file?.sm?.webp?.url, file?.md?.webp?.url, file?.sm?.gif?.url,
      formats?.tinywebp?.url, formats?.tinygif?.url, item.preview_url, item.thumbnail_url,
    ) || nestedUrl(item.preview || item.thumbnail)
    const id = String(item.id || item.slug || '').trim()
    if (!id || !mp4Url || !previewUrl) return []
    const dims = file?.hd?.mp4 || file?.md?.mp4 || formats?.mp4 || {}
    return [{
      id,
      title: String(item.title || item.content_description || item.slug || `Klipy ${id}`).trim(),
      pageUrl: firstString(item.url, item.share_url) || `https://klipy.com/gifs/${encodeURIComponent(id)}`,
      previewUrl,
      mp4Url,
      width: Number(dims.width || item.width) || 0,
      height: Number(dims.height || item.height) || 0,
    }]
  })
}

export async function fetchGiphy(params: { apiKey: string; query?: string; signal?: AbortSignal; limit?: number }): Promise<GiphyResult[]> {
  const { apiKey, query = '', signal, limit = 18 } = params
  if (!apiKey.trim()) throw new Error('Enter a GIPHY API key to search.')
  const mode = query.trim() ? 'search' : 'trending'
  const url = new URL(`https://api.giphy.com/v1/gifs/${mode}`)
  url.searchParams.set('api_key', apiKey.trim())
  url.searchParams.set('limit', String(Math.max(1, Math.min(30, limit))))
  url.searchParams.set('rating', 'pg-13')
  if (query.trim()) url.searchParams.set('q', query.trim())
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(response.status === 403 ? 'GIPHY rejected this API key.' : `GIPHY request failed (${response.status}).`)
  return parseGiphyResults(await response.json())
}

export async function fetchKlipy(params: { apiKey: string; query?: string; signal?: AbortSignal; limit?: number }): Promise<GiphyResult[]> {
  const { apiKey, query = '', signal, limit = 18 } = params
  if (!apiKey.trim()) throw new Error('Enter a Klipy API key in Settings → AI & APIs.')
  const mode = query.trim() ? 'search' : 'trending'
  const url = new URL(`https://api.klipy.com/api/v1/${encodeURIComponent(apiKey.trim())}/gifs/${mode}`)
  url.searchParams.set('per_page', String(Math.max(1, Math.min(30, limit))))
  url.searchParams.set('page', '1')
  url.searchParams.set('customer_id', 'omniframe')
  if (query.trim()) url.searchParams.set('q', query.trim())
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Klipy rejected this API key.' : `Klipy request failed (${response.status}).`)
  return parseKlipyResults(await response.json())
}

export function fetchGifProvider(provider: GifProvider, params: { apiKey: string; query?: string; signal?: AbortSignal; limit?: number }): Promise<GiphyResult[]> {
  return provider === 'klipy' ? fetchKlipy(params) : fetchGiphy(params)
}

export function safeGiphyFileName(result: Pick<GiphyResult, 'title' | 'id'>): string {
  const base = result.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 56) || 'giphy'
  return `${base}-${result.id}.mp4`
}
