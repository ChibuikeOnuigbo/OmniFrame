import { useEffect, useRef, useState } from 'react'
import { Download, ExternalLink, KeyRound, Loader2, Search, Sparkles, X } from 'lucide-react'
import { fetchGifProvider, GIF_PROVIDER_KEY_EVENT, getGifProviderKey, safeGiphyFileName, setGifProviderKey, type GifProvider, type GiphyResult } from '../lib/giphy'

export function GiphyBrowser({ importFiles, onClose }: { importFiles: (files: File[]) => Promise<void>; onClose: () => void }) {
  const envKeys: Record<GifProvider, string> = { giphy: String(import.meta.env.VITE_GIPHY_API_KEY || ''), klipy: String(import.meta.env.VITE_KLIPY_API_KEY || '') }
  const [provider, setProvider] = useState<GifProvider>('giphy')
  const [apiKey, setApiKey] = useState(() => getGifProviderKey('giphy') || envKeys.giphy)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GiphyResult[]>([])
  const [status, setStatus] = useState(apiKey ? 'Loading trending GIFs…' : 'Add a GIPHY or Klipy API key in Settings → AI & APIs.')
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)

  const run = async (nextQuery = query) => {
    controller.current?.abort()
    const key = apiKey.trim()
    if (!key) { setStatus(`Add a ${provider === 'giphy' ? 'GIPHY' : 'Klipy'} API key in Settings → AI & APIs.`); return }
    setGifProviderKey(provider, key)
    const abort = new AbortController()
    controller.current = abort
    setLoading(true)
    setStatus(nextQuery.trim() ? `Searching “${nextQuery.trim()}”…` : 'Loading trending GIFs…')
    try {
      const found = await fetchGifProvider(provider, { apiKey: key, query: nextQuery, signal: abort.signal })
      setResults(found)
      setStatus(found.length ? `${found.length} results from ${provider === 'giphy' ? 'GIPHY' : 'Klipy'}` : 'No GIFs matched this search.')
    } catch (error) {
      if ((error as Error).name !== 'AbortError') setStatus((error as Error).message)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (apiKey) void run('')
    return () => controller.current?.abort()
    // Initial trending load only; searches are explicit to avoid excess API calls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const syncKey = () => setApiKey(getGifProviderKey(provider) || envKeys[provider])
    syncKey()
    setResults([])
    setStatus((getGifProviderKey(provider) || envKeys[provider]) ? `Ready to load ${provider === 'giphy' ? 'GIPHY' : 'Klipy'} trending GIFs.` : `Add a ${provider === 'giphy' ? 'GIPHY' : 'Klipy'} API key in Settings → AI & APIs.`)
    window.addEventListener(GIF_PROVIDER_KEY_EVENT, syncKey)
    return () => window.removeEventListener(GIF_PROVIDER_KEY_EVENT, syncKey)
  }, [provider])

  const importResult = async (result: GiphyResult) => {
    setImporting(result.id)
    setStatus(`Downloading “${result.title}”…`)
    try {
      const response = await fetch(result.mp4Url)
      if (!response.ok) throw new Error(`Could not download GIF video (${response.status}).`)
      const file = new File([await response.blob()], safeGiphyFileName(result), { type: 'video/mp4' })
      await importFiles([file])
      setStatus(`Imported “${result.title}” as an editable MP4 clip.`)
    } catch (error) { setStatus((error as Error).message) }
    finally { setImporting(null) }
  }

  return (
    <section className="mx-3 mb-3 overflow-hidden rounded-xl border border-fuchsia-400/25 bg-gradient-to-b from-fuchsia-500/10 to-ink-950 shadow-lg" data-testid="giphy-browser">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Sparkles size={14} className="text-fuchsia-300" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white">GIF Library</p>
          <p className="text-[9px] text-ink-400">GIFs import as editable, timeline-ready MP4 clips</p>
        </div>
        <button type="button" aria-label="Close GIPHY" onClick={onClose} className="rounded p-1 text-ink-400 hover:bg-white/10 hover:text-white"><X size={14} /></button>
      </div>
      <div className="space-y-2 p-2.5">
        <div className="grid grid-cols-2 gap-1 rounded-md bg-black/25 p-1" role="tablist" aria-label="GIF provider">
          {(['giphy', 'klipy'] as const).map((id) => <button key={id} type="button" role="tab" aria-selected={provider === id} data-testid={`gif-provider-${id}`} onClick={() => setProvider(id)} className={`h-7 rounded text-[10px] font-semibold ${provider === id ? 'bg-fuchsia-500 text-white' : 'text-ink-400 hover:bg-white/10 hover:text-white'}`}>{id === 'giphy' ? 'GIPHY' : 'Klipy'}</button>)}
        </div>
        {!envKeys[provider] && (
          <label className="relative block">
            <KeyRound size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-500" />
            <span className="sr-only">{provider === 'giphy' ? 'GIPHY' : 'Klipy'} API key</span>
            <input type="password" value={apiKey} onChange={(event) => { setApiKey(event.target.value); setGifProviderKey(provider, event.target.value) }} placeholder={`${provider === 'giphy' ? 'GIPHY' : 'Klipy'} API key (also in Settings)`} className="h-8 w-full rounded-md border border-ink-700 bg-ink-950 pl-7 pr-2 text-[11px] text-white outline-none focus:border-fuchsia-400" data-testid={`${provider}-api-key`} />
          </label>
        )}
        <form className="flex gap-1.5" onSubmit={(event) => { event.preventDefault(); void run() }}>
          <label className="relative min-w-0 flex-1">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-500" />
            <span className="sr-only">Search {provider === 'giphy' ? 'GIPHY' : 'Klipy'}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="memes, reactions, stickers…" className="h-8 w-full rounded-md border border-ink-700 bg-ink-950 pl-7 pr-2 text-[11px] text-white outline-none focus:border-fuchsia-400" data-testid="giphy-search" />
          </label>
          <button type="submit" disabled={loading} className="grid h-8 w-8 place-items-center rounded-md bg-fuchsia-500 text-white hover:bg-fuchsia-400 disabled:opacity-50" aria-label={`Search ${provider === 'giphy' ? 'GIPHY' : 'Klipy'}`}>{loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}</button>
        </form>
        <p className="min-h-4 text-[9px] text-ink-400" role="status">{status}</p>
        {results.length > 0 && (
          <div className="grid max-h-64 grid-cols-3 gap-1.5 overflow-y-auto pr-1">
            {results.map((result) => (
              <article key={result.id} className="group relative aspect-square overflow-hidden rounded-md border border-white/10 bg-black">
                <img src={result.previewUrl} alt={result.title} loading="lazy" className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-gradient-to-t from-black/90 to-transparent p-1 pt-5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <a href={result.pageUrl} target="_blank" rel="noreferrer" title={`View on ${provider === 'giphy' ? 'GIPHY' : 'Klipy'}`} className="grid h-6 w-6 place-items-center rounded bg-black/70 text-white"><ExternalLink size={11} /></a>
                  <button type="button" disabled={Boolean(importing)} onClick={() => void importResult(result)} title="Import to OmniFrame" className="grid h-6 w-6 place-items-center rounded bg-fuchsia-500 text-white disabled:opacity-50">{importing === result.id ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}</button>
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="text-right text-[8px] font-semibold tracking-wide text-ink-500">Powered by {provider === 'giphy' ? 'GIPHY' : 'Klipy'}</p>
      </div>
    </section>
  )
}
