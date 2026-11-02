import { DEVICE_MODEL_OPTIONS, OBJECT_ASSETS } from './transitionAssetCatalog'

export type AssetLibrarySource = 'local' | 'polyhaven' | 'unsplash' | 'pexels'
export type StockProvider = Extract<AssetLibrarySource, 'unsplash' | 'pexels'>

export interface LibraryModel {
  id: string
  name: string
  thumbnail?: string
  modelUrl?: string
  sourceUrl: string
  author: string
  license: string
  description: string
  categories: string[]
  polycount?: number
  maxResolution?: number
}

export interface StockImageResult {
  id: string
  provider: StockProvider
  name: string
  thumbnailUrl: string
  downloadUrl: string
  pageUrl: string
  author: string
  authorUrl: string
  width: number
  height: number
}

const STOCK_KEYS: Record<StockProvider, string> = {
  unsplash: 'omniframe.unsplashApiKey',
  pexels: 'omniframe.pexelsApiKey',
}

export function getStockProviderKey(provider: StockProvider): string {
  if (typeof sessionStorage === 'undefined') return ''
  return sessionStorage.getItem(STOCK_KEYS[provider]) || ''
}

export function setStockProviderKey(provider: StockProvider, value: string): void {
  if (typeof sessionStorage === 'undefined') return
  const key = value.trim()
  if (key) sessionStorage.setItem(STOCK_KEYS[provider], key)
  else sessionStorage.removeItem(STOCK_KEYS[provider])
}

export const LOCAL_LIBRARY_MODELS: LibraryModel[] = [
  ...DEVICE_MODEL_OPTIONS.map((item) => ({
    id: `device:${item.id}`,
    name: item.name,
    modelUrl: `/models/device_transitions/${item.id}.glb`,
    thumbnail: item.id.startsWith('tv_crt_') ? `/models/transition_assets/thumbnails/device_${item.id.replace('_ph', '')}.png` : undefined,
    sourceUrl: 'source' in item && item.source ? item.source : 'Bundled with OmniFrame',
    author: 'author' in item && item.author ? item.author : 'OmniFrame',
    license: 'license' in item && item.license ? item.license : 'Bundled asset',
    description: `${item.kind} model ready for the 3D and 2.5D viewport.`,
    categories: ['device', item.kind],
  })),
  ...Object.entries(OBJECT_ASSETS).map(([transitionId, item]) => ({
    id: `object:${item.model}`,
    name: item.name,
    modelUrl: `/models/transition_assets/${item.model}.glb`,
    thumbnail: `/models/transition_assets/thumbnails/${transitionId}.png`,
    sourceUrl: item.source,
    author: item.author,
    license: item.license,
    description: item.note,
    categories: ['object', 'transition'],
  })),
]

type PolyHavenAssetRecord = {
  name?: string
  categories?: string[]
  tags?: string[]
  authors?: Record<string, string>
  max_resolution?: [number, number]
  polycount?: number
  description?: string
  thumbnail_url?: string
}

let polyHavenCatalogPromise: Promise<LibraryModel[]> | null = null

/** Load Poly Haven's complete model index once, then search locally without API keys. */
export function fetchPolyHavenModels(): Promise<LibraryModel[]> {
  if (!polyHavenCatalogPromise) {
    polyHavenCatalogPromise = fetch('https://api.polyhaven.com/assets?t=models')
      .then(async (response) => {
        if (!response.ok) throw new Error(`Poly Haven catalog failed (${response.status}).`)
        const data = await response.json() as Record<string, PolyHavenAssetRecord>
        return Object.entries(data).map(([id, item]): LibraryModel => ({
          id,
          name: item.name || id.replace(/_/g, ' '),
          thumbnail: item.thumbnail_url,
          sourceUrl: `https://polyhaven.com/a/${encodeURIComponent(id)}`,
          author: Object.keys(item.authors || {}).join(', ') || 'Poly Haven contributors',
          license: 'CC0',
          description: item.description || 'Free CC0 3D model from Poly Haven.',
          categories: [...(item.categories || []), ...(item.tags || [])],
          polycount: item.polycount,
          maxResolution: item.max_resolution?.[0],
        })).sort((a, b) => a.name.localeCompare(b.name))
      })
      .catch((error) => {
        polyHavenCatalogPromise = null
        throw error
      })
  }
  return polyHavenCatalogPromise
}

type PolyHavenFile = { url?: string; size?: number }
type PolyHavenFormat = Record<string, PolyHavenFile>

/** Resolve the lightest browser-native GLTF from Poly Haven's file manifest. */
export async function resolvePolyHavenModelUrl(id: string): Promise<string> {
  const response = await fetch(`https://api.polyhaven.com/files/${encodeURIComponent(id)}`)
  if (!response.ok) throw new Error(`Poly Haven file manifest failed (${response.status}).`)
  const manifest = await response.json() as { gltf?: Record<string, { gltf?: PolyHavenFile } | PolyHavenFormat> }
  for (const resolution of ['1k', '2k', '4k']) {
    const entry = manifest.gltf?.[resolution] as { gltf?: PolyHavenFile } | undefined
    if (entry?.gltf?.url) return entry.gltf.url
  }
  throw new Error('This Poly Haven model has no browser-compatible GLTF file.')
}

export async function searchStockImages(provider: StockProvider, query: string, apiKey: string): Promise<StockImageResult[]> {
  const term = query.trim()
  if (!term) return []
  if (!apiKey.trim()) throw new Error(`Add a ${provider === 'unsplash' ? 'Unsplash' : 'Pexels'} API key in Settings → AI & APIs.`)

  if (provider === 'unsplash') {
    const url = new URL('https://api.unsplash.com/search/photos')
    url.searchParams.set('query', term)
    url.searchParams.set('per_page', '30')
    url.searchParams.set('orientation', 'landscape')
    const response = await fetch(url, { headers: { Authorization: `Client-ID ${apiKey.trim()}` } })
    if (!response.ok) throw new Error(response.status === 401 ? 'Unsplash rejected this API key.' : `Unsplash search failed (${response.status}).`)
    const data = await response.json() as { results?: Array<Record<string, any>> }
    return (data.results || []).map((item): StockImageResult => ({
      id: String(item.id), provider, name: item.alt_description || item.description || `Unsplash ${item.id}`,
      thumbnailUrl: item.urls?.small || item.urls?.thumb,
      downloadUrl: `${item.urls?.raw || item.urls?.full}&auto=format&fit=max&w=3840&q=92`,
      pageUrl: item.links?.html, author: item.user?.name || 'Unsplash contributor', authorUrl: item.user?.links?.html || 'https://unsplash.com',
      width: Number(item.width) || 3840, height: Number(item.height) || 2160,
    }))
  }

  const url = new URL('https://api.pexels.com/v1/search')
  url.searchParams.set('query', term)
  url.searchParams.set('per_page', '30')
  url.searchParams.set('orientation', 'landscape')
  const response = await fetch(url, { headers: { Authorization: apiKey.trim() } })
  if (!response.ok) throw new Error(response.status === 401 ? 'Pexels rejected this API key.' : `Pexels search failed (${response.status}).`)
  const data = await response.json() as { photos?: Array<Record<string, any>> }
  return (data.photos || []).map((item): StockImageResult => ({
    id: String(item.id), provider, name: item.alt || `Pexels ${item.id}`,
    thumbnailUrl: item.src?.medium || item.src?.small,
    downloadUrl: item.src?.original || item.src?.large2x,
    pageUrl: item.url, author: item.photographer || 'Pexels contributor', authorUrl: item.photographer_url || 'https://pexels.com',
    width: Number(item.width) || 3840, height: Number(item.height) || 2160,
  }))
}

export async function downloadStockImage(result: StockImageResult): Promise<Blob> {
  const response = await fetch(result.downloadUrl)
  if (!response.ok) throw new Error(`The full-resolution image could not be downloaded (${response.status}).`)
  const blob = await response.blob()
  if (!blob.type.startsWith('image/')) throw new Error('The provider returned a non-image file.')
  return blob
}
