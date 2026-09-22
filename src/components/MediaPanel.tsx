import { useMemo, useRef, useState } from 'react'
import { Upload, Film, Music, AudioLines, Image as ImageIcon, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useEditor } from '../store'
import type { MediaAsset } from '../types'
import { formatClock } from '../lib/time'

type MediaFilter = 'all' | 'video' | 'image' | 'audio'

const FILTERS: Array<{ value: MediaFilter; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'video', label: 'Video' },
  { value: 'image', label: 'Image' },
  { value: 'audio', label: 'Audio' },
]

export function MediaPanel() {
  const assets = useEditor((s) => s.assets)
  const importFiles = useEditor((s) => s.importFiles)
  const fileInput = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<MediaFilter>('all')

  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return assets.filter((asset) => {
      const matchesType = filter === 'all' || asset.kind === filter
      const matchesQuery = !needle || asset.name.toLocaleLowerCase().includes(needle)
      return matchesType && matchesQuery
    })
  }, [assets, filter, query])

  const addToTimeline = (asset: MediaAsset) => {
    const st = useEditor.getState()
    const trackId = st.ensureTrack(asset.kind === 'audio' ? 'audio' : 'video')
    st.addClipToTrack(trackId, asset.id)
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length) importFiles(e.target.files)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-full" data-testid="media-library">
      <div className="p-3 pb-2 space-y-2">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-md bg-ink-800 border border-ink-700 text-xs font-medium hover:bg-ink-700 transition-colors"
        >
          <Upload size={15} /> Import media
        </button>
        <input id="panel-all-import-input" data-testid="panel-all-import-input" aria-label="Import media files" ref={fileInput} type="file" accept="video/*,image/*,audio/*" multiple hidden onChange={onPick} />

        <div className="flex items-center gap-1.5" role="search">
          <label className="relative flex-1 min-w-0">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" />
            <span className="sr-only">Search media</span>
            <input
              data-testid="media-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="w-full h-8 rounded-md border border-ink-700 bg-ink-900 pl-8 pr-2 text-xs text-ink-100 placeholder:text-ink-500 outline-none focus:border-brand/70"
            />
          </label>
          <label className="relative shrink-0" title="Filter by type">
            <span className="sr-only">Media type</span>
            <SlidersHorizontal size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <select
              data-testid="media-type-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value as MediaFilter)}
              className="h-8 w-[82px] appearance-none rounded-md border border-ink-700 bg-ink-900 pl-7 pr-1 text-[11px] text-ink-300 outline-none focus:border-brand/70"
              aria-label="Filter media by type"
            >
              {FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        {shown.length === 0 ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files)
            }}
            className="h-32 grid place-items-center rounded-lg border border-dashed border-ink-700 text-ink-500 text-xs text-center px-3"
          >
            {assets.length === 0 ? 'Drag & drop video, image or audio here' : 'No media matches this search'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {shown.map((a) => (
              <button
                key={a.id}
                type="button"
                draggable
                data-testid="media-asset"
                data-asset-kind={a.kind}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'copy'
                  e.dataTransfer.setData('application/x-omniframe-asset', a.id)
                }}
                onClick={() => addToTimeline(a)}
                title={`Add “${a.name}” to timeline`}
                className="group relative rounded-md overflow-hidden border border-ink-700 bg-ink-800 hover:border-brand transition-colors text-left"
              >
                <div className="aspect-video grid place-items-center bg-ink-900">
                  {a.kind === 'image' || (a.kind === 'video' && a.thumbnail) ? (
                    <img src={a.kind === 'image' ? a.url : a.thumbnail} alt={a.name} className="w-full h-full object-cover" />
                  ) : a.kind === 'video' ? (
                    <Film size={22} className="text-ink-500" />
                  ) : (
                    <div className="flex items-center -space-x-1 rounded-full border border-brand/20 bg-brand/10 px-2.5 py-2 text-brand/80 shadow-[0_0_18px_rgba(108,76,255,0.12)]">
                      <Music size={20} /><AudioLines size={15} />
                    </div>
                  )}
                  <span className="absolute top-1 right-1 grid place-items-center h-6 w-6 rounded bg-ink-950/80 text-brand opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus size={14} />
                  </span>
                </div>
                <div className="px-2 py-1.5">
                  <div className="text-[11px] text-ink-200 truncate">{a.name}</div>
                  <div className="text-[10px] text-ink-500 flex items-center gap-1">
                    {a.kind === 'image' ? <ImageIcon size={10} /> : a.kind === 'video' ? <Film size={10} /> : <><Music size={10} /><AudioLines size={10} /></>}
                    {formatClock(a.duration)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
