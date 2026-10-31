import React, { useMemo, useState } from 'react'
import { X, Search, Folder, LayoutGrid, Package, Plus } from 'lucide-react'
import { useEditor } from '../store'
import { PACK_ASSETS, PACK_BUNDLES, PACK_H, PACK_W, packAssetUrl, type PackAssetDef } from '../lib/desktopPack'

/**
 * Pack Browser — the Desktop Pack as a 95% Explorer-style window:
 * folder sidebar (bundles + sections), search, tag filters, and cards
 * whose previews show what is inside each pack. Clicking an asset adds
 * it at the playhead, exactly like the panel does.
 */
const SECTIONS: { id: string; label: string }[] = [
  { id: 'windows', label: 'Windows & Apps' },
  { id: 'apps', label: 'Apps & Phones' },
  { id: 'scenes', label: 'Scenes' },
  { id: 'cursors', label: 'Cursors' },
  { id: 'overlays', label: 'Overlays' },
]

function ensurePackAsset(def: PackAssetDef): string {
  const state = useEditor.getState()
  const assetId = `pack-${def.id}`
  if (!state.assets.some((a) => a.id === assetId)) {
    const url = packAssetUrl(def.id)
    state.addAsset({ id: assetId, name: def.name, kind: 'image', url, duration: 5, width: PACK_W, height: PACK_H, size: url.length })
  }
  return assetId
}

function addPackClip(def: PackAssetDef): void {
  const state = useEditor.getState()
  const assetId = ensurePackAsset(def)
  const trackId = state.createTrack('video')
  state.addClipToTrack(trackId, assetId, state.playhead)
}

function addBundle(bundleId: string): void {
  const bundle = PACK_BUNDLES.find((b) => b.id === bundleId)
  if (!bundle) return
  const state = useEditor.getState()
  const trackId = state.createTrack('video')
  for (const itemId of bundle.items) {
    const def = PACK_ASSETS.find((a) => a.id === itemId)
    if (def) {
      const assetId = ensurePackAsset(def)
      state.addClipToTrack(trackId, assetId, state.playhead)
    }
  }
}

export function PackBrowserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [folder, setFolder] = useState<string>('all') // 'all' | 'bundles' | section id
  const [tag, setTag] = useState<string>('all')
  const [bundleId, setBundleId] = useState<string | null>(null)

  const tags = useMemo(() => [...new Set(PACK_ASSETS.map((a) => a.group))].sort(), [])
  const assets = useMemo(() => {
    let list = PACK_ASSETS
    if (bundleId) {
      const b = PACK_BUNDLES.find((x) => x.id === bundleId)
      list = b ? b.items.map((id) => PACK_ASSETS.find((a) => a.id === id)).filter((a): a is PackAssetDef => !!a) : []
    } else if (folder !== 'all' && folder !== 'bundles') list = list.filter((a) => a.section === folder)
    if (tag !== 'all') list = list.filter((a) => a.group === tag)
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((a) => `${a.name} ${a.desc} ${a.group} ${a.section}`.toLowerCase().includes(q))
    return list
  }, [query, folder, tag, bundleId])
  const bundles = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? PACK_BUNDLES.filter((b) => `${b.name} ${b.desc}`.toLowerCase().includes(q)) : PACK_BUNDLES
  }, [query])

  if (!open) return null
  const activeBundle = bundleId ? PACK_BUNDLES.find((b) => b.id === bundleId) : null

  return (
    <div data-testid="pack-browser-modal" className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Desktop pack browser" className="flex h-[95vh] w-[95vw] flex-col overflow-hidden rounded-xl border border-ink-600 bg-ink-950 shadow-[0_32px_120px_rgba(0,0,0,.7)]" onClick={(e) => e.stopPropagation()}>
        {/* header: title + search + close */}
        <div className="flex items-center gap-3 border-b border-ink-800 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-white"><LayoutGrid size={16} className="text-brand-400" /> Pack Browser</span>
          <label className="relative min-w-0 flex-1 max-w-md">
            <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-500" />
            <input data-testid="pack-browser-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search packs, windows, cursors…" className="h-8 w-full rounded-md border border-ink-700 bg-ink-900 pl-7 pr-2 text-xs text-white outline-none focus:border-brand" />
          </label>
          <span className="text-[10px] text-ink-500">{assets.length} assets, {bundles.length} packs</span>
          <button type="button" data-testid="pack-browser-close" onClick={onClose} className="grid h-7 w-7 place-items-center rounded text-ink-400 hover:bg-ink-800 hover:text-white" aria-label="Close pack browser"><X size={15} /></button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* folder sidebar */}
          <aside className="w-56 shrink-0 space-y-3 overflow-y-auto border-r border-ink-800 p-3">
            <div>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-ink-500">Library</span>
              <button type="button" data-testid="pack-browser-folder-all" onClick={() => { setFolder('all'); setBundleId(null) }} className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] ${folder === 'all' && !bundleId ? 'bg-brand/20 text-white' : 'text-ink-300 hover:bg-ink-800'}`}><LayoutGrid size={12} /> All assets</button>
              <button type="button" data-testid="pack-browser-folder-bundles" onClick={() => { setFolder('bundles'); setBundleId(null) }} className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] ${folder === 'bundles' && !bundleId ? 'bg-brand/20 text-white' : 'text-ink-300 hover:bg-ink-800'}`}><Package size={12} /> Packs ({PACK_BUNDLES.length})</button>
              {SECTIONS.map((s) => (
                <button key={s.id} type="button" data-testid={`pack-browser-folder-${s.id}`} onClick={() => { setFolder(s.id); setBundleId(null) }} className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] ${folder === s.id && !bundleId ? 'bg-brand/20 text-white' : 'text-ink-300 hover:bg-ink-800'}`}>
                  <Folder size={12} /> {s.label} <span className="ml-auto text-[9px] text-ink-500">{PACK_ASSETS.filter((a) => a.section === s.id).length}</span>
                </button>
              ))}
            </div>
            <div>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-ink-500">Tags</span>
              <div className="flex flex-wrap gap-1">
                <button type="button" data-testid="pack-browser-tag-all" onClick={() => setTag('all')} className={`rounded-full border px-2 py-0.5 text-[9px] ${tag === 'all' ? 'border-brand bg-brand/25 text-white' : 'border-ink-700 text-ink-400 hover:border-brand'}`}>All</button>
                {tags.map((t) => (
                  <button key={t} type="button" data-testid={`pack-browser-tag-${t.toLowerCase().replace(/\s+/g, '-')}`} onClick={() => setTag(tag === t ? 'all' : t)} className={`rounded-full border px-2 py-0.5 text-[9px] ${tag === t ? 'border-brand bg-brand/25 text-white' : 'border-ink-700 text-ink-400 hover:border-brand'}`}>{t}</button>
                ))}
              </div>
            </div>
          </aside>

          {/* main area */}
          <div className="min-w-0 flex-1 overflow-y-auto p-4">
            {activeBundle ? (
              <div>
                <div className="mb-3 flex items-start gap-4">
                  {/* layered preview of what is inside the pack */}
                  <div className="relative h-36 w-64 shrink-0 overflow-hidden rounded-lg border border-ink-700 bg-ink-900" aria-hidden="true">
                    {activeBundle.items.slice(0, 4).map((id, i) => (
                      <img key={id} src={packAssetUrl(id)} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: i === 0 ? 1 : 0.85, transform: `translate(${i * 7}px, ${i * 5}px) scale(${1 - i * 0.05})` }} loading="lazy" />
                    ))}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white">{activeBundle.name}</h3>
                    <p className="mt-0.5 text-[11px] text-ink-400">{activeBundle.desc}, {activeBundle.items.length} layers, bottom first.</p>
                    <button type="button" data-testid={`pack-browser-add-bundle-${activeBundle.id}`} onClick={() => addBundle(activeBundle.id)} className="mt-2 flex items-center gap-1 rounded bg-brand px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-brand/85"><Plus size={12} /> Add whole pack at playhead</button>
                    <button type="button" data-testid="pack-browser-back" onClick={() => setBundleId(null)} className="mt-1.5 block text-[10px] text-ink-400 hover:text-white">← Back to browser</button>
                  </div>
                </div>
              </div>
            ) : folder === 'bundles' || folder === 'all' ? (
              <div className="mb-5">
                <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-ink-500">Packs — preview shows what is inside</span>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
                  {bundles.map((b) => (
                    <button key={b.id} type="button" data-testid={`pack-browser-bundle-${b.id}`} onClick={() => setBundleId(b.id)} className="group overflow-hidden rounded-lg border border-ink-800 bg-ink-900 text-left hover:border-brand">
                      <span className="relative block aspect-video overflow-hidden bg-ink-950">
                        {b.items.slice(0, 3).map((id, i) => (
                          <img key={id} src={packAssetUrl(id)} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: i === 0 ? 1 : 0.8, transform: `translate(${i * 6}px, ${i * 4}px) scale(${1 - i * 0.05})` }} loading="lazy" />
                        ))}
                        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-white">{b.items.length} layers</span>
                      </span>
                      <span className="block px-2 py-1.5">
                        <span className="block truncate text-[11px] font-medium text-ink-100">{b.name}</span>
                        <span className="block truncate text-[9px] text-ink-500">{b.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {!activeBundle && (
              <>
                <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-ink-500">{activeBundle ? 'In this pack' : folder === 'all' || folder === 'bundles' ? 'Assets' : SECTIONS.find((s) => s.id === folder)?.label}, click to add at playhead</span>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
                  {assets.map((a) => (
                    <button key={a.id} type="button" data-testid={`pack-browser-asset-${a.id}`} onClick={() => addPackClip(a)} className="group overflow-hidden rounded-lg border border-ink-800 bg-ink-900 text-left hover:border-brand" title={`${a.name} — ${a.desc}`}>
                      <span className="relative block aspect-video overflow-hidden bg-ink-950">
                        <img src={packAssetUrl(a.id)} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                      </span>
                      <span className="block px-2 py-1.5">
                        <span className="block truncate text-[11px] font-medium text-ink-100">{a.name}</span>
                        <span className="mt-0.5 flex gap-1">
                          <span className="rounded bg-ink-800 px-1 py-px text-[8px] uppercase tracking-wide text-ink-400">{a.group}</span>
                          <span className="rounded bg-ink-800 px-1 py-px text-[8px] uppercase tracking-wide text-ink-500">{a.section}</span>
                        </span>
                      </span>
                    </button>
                  ))}
                  {assets.length === 0 && <p className="text-[11px] text-ink-500" data-testid="pack-browser-empty">No assets match.</p>}
                </div>
              </>
            )}
            {activeBundle && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
                {assets.map((a) => (
                  <button key={a.id} type="button" data-testid={`pack-browser-asset-${a.id}`} onClick={() => addPackClip(a)} className="group overflow-hidden rounded-lg border border-ink-800 bg-ink-900 text-left hover:border-brand" title={`${a.name} — ${a.desc}`}>
                    <span className="relative block aspect-video overflow-hidden bg-ink-950">
                      <img src={packAssetUrl(a.id)} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                    </span>
                    <span className="block px-2 py-1.5">
                      <span className="block truncate text-[11px] font-medium text-ink-100">{a.name}</span>
                      <span className="mt-0.5 flex gap-1">
                        <span className="rounded bg-ink-800 px-1 py-px text-[8px] uppercase tracking-wide text-ink-400">{a.group}</span>
                        <span className="rounded bg-ink-800 px-1 py-px text-[8px] uppercase tracking-wide text-ink-500">{a.section}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
