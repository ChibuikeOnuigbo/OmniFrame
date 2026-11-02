import React, { useEffect, useMemo, useState } from 'react'
import { Box, Check, Download, ExternalLink, FolderOpen, HardDrive, Image, KeyRound, LayoutGrid, Loader2, Package, Search, X } from 'lucide-react'
import { useEditor } from '../store'
import {
  downloadStockImage,
  fetchPolyHavenModels,
  getStockProviderKey,
  LOCAL_LIBRARY_MODELS,
  resolvePolyHavenModelUrl,
  resolvePolyHavenImageUrl,
  searchStockImages,
  setStockProviderKey,
  type AssetLibrarySource,
  type LibraryModel,
  type StockImageResult,
  type StockProvider,
  type PolyHavenKind,
} from '../lib/assetLibrary'

const SOURCES: Array<{ id: AssetLibrarySource; label: string; note: string; icon: typeof Box }> = [
  { id: 'local', label: 'On this device', note: 'Bundled GLB models', icon: HardDrive },
  { id: 'polyhaven', label: 'Poly Haven', note: 'Complete CC0 model catalog', icon: Box },
  { id: 'unsplash', label: 'Unsplash', note: 'High-resolution photos', icon: Image },
  { id: 'pexels', label: 'Pexels', note: 'High-resolution photos', icon: Image },
]

function addModelToScene(model: LibraryModel, modelUrl: string): void {
  const state = useEditor.getState()
  const count = state.scene3DObjects.length
  state.addScene3DObject({
    id: `library-model-${Date.now().toString(36)}-${model.id.replace(/[^a-z0-9]+/gi, '-').slice(0, 32)}`,
    name: model.name,
    type: 'cube',
    modelUrl,
    sourceUrl: model.sourceUrl,
    attribution: model.author,
    license: model.license,
    position: { x: ((count % 5) - 2) * 1.4, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    color: '#a78bfa',
    roughness: 0.5,
    metalness: 0.1,
  })
  state.setIs3DMode(true)
  state.setLeftTab('threed')
}

async function addStockImageToTimeline(result: StockImageResult): Promise<void> {
  const blob = await downloadStockImage(result)
  const state = useEditor.getState()
  const assetId = `stock-${result.provider}-${result.id}-${Date.now().toString(36)}`
  state.addAsset({
    id: assetId,
    name: result.name,
    kind: 'image',
    url: URL.createObjectURL(blob),
    duration: 5,
    width: result.width,
    height: result.height,
    size: blob.size,
    thumbnail: result.thumbnailUrl,
    sourceUrl: result.pageUrl,
    attribution: `${result.author} / ${result.provider === 'unsplash' ? 'Unsplash' : 'Pexels'}`,
  })
  const trackId = state.createTrack('video')
  state.addClipToTrack(trackId, assetId, state.playhead)
}

async function addPolyHavenImageToTimeline(asset: LibraryModel, url: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`The Poly Haven ${asset.kind} could not be downloaded (${response.status}).`)
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
    const image = new window.Image()
    image.onload = () => resolve({ width: image.naturalWidth || asset.maxResolution || 4096, height: image.naturalHeight || asset.maxResolution || 4096 })
    image.onerror = () => resolve({ width: asset.maxResolution || 4096, height: asset.kind === 'hdri' ? Math.round((asset.maxResolution || 4096) / 2) : asset.maxResolution || 4096 })
    image.src = objectUrl
  })
  const state = useEditor.getState()
  const assetId = `polyhaven-${asset.kind}-${asset.id}-${Date.now().toString(36)}`
  state.addAsset({ id: assetId, name: asset.name, kind: 'image', url: objectUrl, duration: 5, width: dimensions.width, height: dimensions.height, size: blob.size, thumbnail: asset.thumbnail, sourceUrl: asset.sourceUrl, attribution: `${asset.author} / Poly Haven · CC0` })
  state.addClipToTrack(state.createTrack('video'), assetId, state.playhead)
}

export function AssetLibraryModal({ open, onClose, onOpenPackBrowser }: { open: boolean; onClose: () => void; onOpenPackBrowser?: () => void }) {
  const [source, setSource] = useState<AssetLibrarySource>('local')
  const [query, setQuery] = useState('')
  const [polyKind, setPolyKind] = useState<PolyHavenKind>('model')
  const [polyAssets, setPolyAssets] = useState<Partial<Record<PolyHavenKind, LibraryModel[]>>>({})
  const [stockResults, setStockResults] = useState<StockImageResult[]>([])
  const [apiKeys, setApiKeys] = useState<Record<StockProvider, string>>(() => ({
    unsplash: getStockProviderKey('unsplash') || String(import.meta.env.VITE_UNSPLASH_API_KEY || ''),
    pexels: getStockProviderKey('pexels') || String(import.meta.env.VITE_PEXELS_API_KEY || ''),
  }))
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('Bundled models are ready offline.')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [addedId, setAddedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open || source !== 'polyhaven' || polyAssets[polyKind]?.length) return
    let cancelled = false
    setLoading(true)
    setStatus(`Indexing the complete Poly Haven ${polyKind === 'model' ? 'model' : polyKind === 'texture' ? 'texture' : 'HDRI'} catalog…`)
    fetchPolyHavenModels(polyKind)
      .then((models) => {
        if (cancelled) return
        setPolyAssets((catalogs) => ({ ...catalogs, [polyKind]: models }))
        const noun = polyKind === 'hdri' ? (models.length === 1 ? 'HDRI' : 'HDRIs') : `${polyKind}${models.length === 1 ? '' : 's'}`
        setStatus(`${models.length.toLocaleString()} CC0 ${noun} indexed. Search runs locally.`)
      })
      .catch((error) => { if (!cancelled) setStatus(error instanceof Error ? error.message : 'Poly Haven could not be reached.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, source, polyKind, polyAssets])

  useEffect(() => {
    if (!open || (source !== 'unsplash' && source !== 'pexels')) return
    const provider = source
    const term = query.trim()
    if (!term) {
      setStockResults([])
      setStatus(`Type a search to find 4K-capable ${provider === 'unsplash' ? 'Unsplash' : 'Pexels'} images.`)
      return
    }
    const timer = window.setTimeout(() => {
      let cancelled = false
      setLoading(true)
      setStatus(`Searching ${provider === 'unsplash' ? 'Unsplash' : 'Pexels'}…`)
      searchStockImages(provider, term, apiKeys[provider])
        .then((results) => {
          if (cancelled) return
          setStockResults(results)
          setStatus(results.length ? `${results.length} high-resolution images found.` : 'No images matched this search.')
        })
        .catch((error) => { if (!cancelled) { setStockResults([]); setStatus(error instanceof Error ? error.message : 'Image search failed.') } })
        .finally(() => { if (!cancelled) setLoading(false) })
      return () => { cancelled = true }
    }, 450)
    return () => window.clearTimeout(timer)
  }, [open, source, query, apiKeys])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const models = source === 'local' ? LOCAL_LIBRARY_MODELS : polyAssets[polyKind] || []
  const visibleModels = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matched = needle ? models.filter((item) => `${item.name} ${item.description} ${item.categories.join(' ')} ${item.author}`.toLowerCase().includes(needle)) : models
    return matched.slice(0, 180)
  }, [models, query])

  if (!open) return null
  const isStock = source === 'unsplash' || source === 'pexels'

  const importModel = async (model: LibraryModel) => {
    setBusyId(model.id)
    setStatus(model.modelUrl ? `Adding ${model.name}…` : `Resolving ${model.name} from Poly Haven…`)
    try {
      if (source === 'polyhaven' && model.kind && model.kind !== 'model') {
        const url = await resolvePolyHavenImageUrl(model.id, model.kind)
        await addPolyHavenImageToTimeline(model, url)
      } else {
        const url = model.modelUrl || await resolvePolyHavenModelUrl(model.id)
        addModelToScene(model, url)
      }
      setAddedId(model.id)
      setStatus(model.kind && model.kind !== 'model' ? `${model.name} imported as editable 2.5D timeline media.` : `${model.name} added to the 3D scene. Select the 3D tab to place and animate it.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'This model could not be added.')
    } finally {
      setBusyId(null)
    }
  }

  const importImage = async (result: StockImageResult) => {
    setBusyId(result.id)
    setStatus(`Downloading the full-resolution ${result.provider === 'unsplash' ? 'Unsplash' : 'Pexels'} image…`)
    try {
      await addStockImageToTimeline(result)
      setAddedId(result.id)
      setStatus(`${result.name} was imported and placed at the playhead.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The image could not be imported.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div data-testid="asset-library-modal" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-2 backdrop-blur-sm sm:p-5" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-label="3D and stock asset library" className="flex h-[95vh] w-[95vw] flex-col overflow-hidden rounded-xl border border-ink-600 bg-ink-950 shadow-[0_32px_120px_rgba(0,0,0,.75)]" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex min-h-14 items-center gap-3 border-b border-ink-800 px-4">
          <span className="flex shrink-0 items-center gap-2 text-sm font-semibold text-white"><FolderOpen size={17} className="text-brand-400" /> Asset Library</span>
          <label className="relative min-w-0 max-w-xl flex-1">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
            <input data-testid="asset-library-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isStock ? 'Auto-search photos, backgrounds, textures…' : 'Search models, authors, categories…'} className="h-9 w-full rounded-md border border-ink-700 bg-ink-900 pl-8 pr-3 text-xs text-white outline-none focus:border-brand" />
          </label>
          {onOpenPackBrowser && <button type="button" data-testid="asset-library-open-pack" onClick={onOpenPackBrowser} className="hidden h-8 items-center gap-1.5 rounded-md border border-ink-700 px-2.5 text-[11px] text-ink-200 hover:border-brand sm:flex"><Package size={13} /> Desktop Pack</button>}
          <button type="button" data-testid="asset-library-close" aria-label="Close asset library" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-ink-400 hover:bg-ink-800 hover:text-white"><X size={16} /></button>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="w-48 shrink-0 overflow-y-auto border-r border-ink-800 p-2.5 sm:w-60 sm:p-3">
            <p className="mb-1.5 px-2 text-[9px] font-semibold uppercase tracking-[.15em] text-ink-500">Locations</p>
            {SOURCES.map(({ id, label, note, icon: Icon }) => (
              <button key={id} type="button" data-testid={`asset-library-source-${id}`} onClick={() => { setSource(id); setAddedId(null); setStatus(id === 'local' ? 'Bundled models are ready offline.' : `Opening ${label}…`) }} className={`mb-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left ${source === id ? 'bg-brand/20 text-white' : 'text-ink-300 hover:bg-ink-800'}`}>
                <Icon size={15} className={source === id ? 'text-brand-300' : 'text-ink-500'} />
                <span className="min-w-0"><span className="block truncate text-[11px] font-medium">{label}</span><span className="hidden truncate text-[9px] text-ink-500 sm:block">{note}</span></span>
              </button>
            ))}
            <div className="my-3 border-t border-ink-800" />
            <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2 text-[9px] leading-relaxed text-emerald-200">
              Poly Haven assets are CC0. Photo cards keep a source link and creator credit.
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {isStock && (
              <div className="mb-3 flex flex-col gap-2 rounded-lg border border-ink-800 bg-ink-900/70 p-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-2"><KeyRound size={14} className="shrink-0 text-amber-300" /><div><p className="text-[11px] font-medium text-ink-100">{source === 'unsplash' ? 'Unsplash' : 'Pexels'} API key</p><p className="text-[9px] text-ink-500">Stored only in this browser tab. You can also set it in Settings → AI & APIs.</p></div></div>
                <input data-testid={`asset-library-${source}-key`} type="password" autoComplete="off" value={apiKeys[source]} onChange={(event) => { const value = event.target.value; setApiKeys((keys) => ({ ...keys, [source]: value })); setStockProviderKey(source, value) }} placeholder={`${source === 'unsplash' ? 'Unsplash access' : 'Pexels'} key`} className="h-8 w-full rounded-md border border-ink-700 bg-ink-950 px-2 text-[11px] text-white outline-none focus:border-brand sm:w-72" />
              </div>
            )}

            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h2 className="text-sm font-semibold text-white">{SOURCES.find((item) => item.id === source)?.label}</h2><p data-testid="asset-library-status" aria-live="polite" className="mt-0.5 text-[10px] text-ink-400">{status}</p></div>
              {loading && <Loader2 size={17} className="animate-spin text-brand-300" aria-label="Loading" />}
            </div>

            {source === 'polyhaven' && <div className="mb-3 flex w-fit rounded-md border border-ink-700 bg-ink-900 p-0.5" role="tablist" aria-label="Poly Haven asset type">{(['model', 'texture', 'hdri'] as const).map((kind) => <button key={kind} type="button" role="tab" aria-selected={polyKind === kind} data-testid={`asset-library-poly-${kind}`} onClick={() => { setPolyKind(kind); setAddedId(null) }} className={`h-7 rounded px-3 text-[10px] font-semibold ${polyKind === kind ? 'bg-brand text-white' : 'text-ink-400 hover:text-white'}`}>{kind === 'model' ? 'Models' : kind === 'texture' ? 'Textures' : 'HDRIs'}</button>)}</div>}

            {!isStock ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-3" data-testid="asset-library-model-grid">
                {visibleModels.map((model) => (
                  <article key={model.id} className="group overflow-hidden rounded-lg border border-ink-800 bg-ink-900 hover:border-brand/70">
                    <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-ink-800 to-ink-950">
                      {model.thumbnail ? <img src={model.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" /> : <Box size={42} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-ink-700" />}
                      <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-semibold text-white">{model.license}</span>
                    </div>
                    <div className="p-2.5"><h3 className="truncate text-[11px] font-semibold text-ink-100" title={model.name}>{model.name}</h3><p className="mt-0.5 truncate text-[9px] text-ink-500">{model.author}{model.polycount ? ` · ${model.polycount.toLocaleString()} polygons` : ''}</p>
                      <div className="mt-2 flex gap-1.5"><button type="button" data-testid={`asset-library-add-${model.id.replace(/[^a-z0-9]+/gi, '-')}`} disabled={!!busyId} onClick={() => void importModel(model)} className="flex h-7 flex-1 items-center justify-center gap-1 rounded bg-brand text-[10px] font-semibold text-white hover:bg-brand/85 disabled:opacity-50">{busyId === model.id ? <Loader2 size={11} className="animate-spin" /> : addedId === model.id ? <Check size={11} /> : <Download size={11} />}{addedId === model.id ? 'Added' : model.kind && model.kind !== 'model' ? 'Add as 2.5D' : 'Add to scene'}</button><a href={model.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open source for ${model.name}`} className="grid h-7 w-7 place-items-center rounded border border-ink-700 text-ink-400 hover:text-white"><ExternalLink size={11} /></a></div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3" data-testid="asset-library-photo-grid">
                {stockResults.map((result) => (
                  <article key={`${result.provider}-${result.id}`} className="group overflow-hidden rounded-lg border border-ink-800 bg-ink-900 hover:border-brand/70"><div className="relative aspect-video overflow-hidden bg-ink-800"><img src={result.thumbnailUrl} alt={result.name} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" /><span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[8px] text-white">{result.width} × {result.height}</span></div><div className="p-2.5"><h3 className="truncate text-[11px] font-semibold text-ink-100">{result.name}</h3><p className="mt-0.5 truncate text-[9px] text-ink-500">Photo by {result.author}</p><div className="mt-2 flex gap-1.5"><button type="button" data-testid={`asset-library-import-${result.provider}-${result.id}`} disabled={!!busyId} onClick={() => void importImage(result)} className="flex h-7 flex-1 items-center justify-center gap-1 rounded bg-brand text-[10px] font-semibold text-white hover:bg-brand/85 disabled:opacity-50">{busyId === result.id ? <Loader2 size={11} className="animate-spin" /> : addedId === result.id ? <Check size={11} /> : <Download size={11} />}{addedId === result.id ? 'Imported' : 'Import 4K'}</button><a href={result.pageUrl} target="_blank" rel="noreferrer" aria-label={`Open source for ${result.name}`} className="grid h-7 w-7 place-items-center rounded border border-ink-700 text-ink-400 hover:text-white"><ExternalLink size={11} /></a></div></div></article>
                ))}
              </div>
            )}

            {!loading && !isStock && visibleModels.length === 0 && <div className="grid h-48 place-items-center rounded-lg border border-dashed border-ink-700 text-xs text-ink-500">No models match this search.</div>}
            {!loading && isStock && query.trim() && stockResults.length === 0 && <div className="grid h-48 place-items-center rounded-lg border border-dashed border-ink-700 text-xs text-ink-500">{status}</div>}
          </main>
        </div>
        <footer className="flex min-h-8 items-center justify-between gap-2 border-t border-ink-800 px-4 text-[9px] text-ink-500"><span>Models remain editable scene objects. Photos become normal timeline media.</span><span className="flex items-center gap-1 text-emerald-400"><LayoutGrid size={10} /> 3D + 2.5D ready</span></footer>
      </section>
    </div>
  )
}
