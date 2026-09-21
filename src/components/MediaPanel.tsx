import { useRef } from 'react'
import { Upload, Film, Music, Image as ImageIcon, Plus } from 'lucide-react'
import { useEditor } from '../store'
import type { MediaAsset } from '../types'
import { formatClock } from '../lib/time'

export function MediaPanel({ kind }: { kind: 'all' | 'audio' }) {
  const assets = useEditor((s) => s.assets)
  const importFiles = useEditor((s) => s.importFiles)
  const fileInput = useRef<HTMLInputElement>(null)

  const shown = assets.filter((a) => (kind === 'audio' ? a.kind === 'audio' : true))

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
    <div className="flex flex-col h-full">
      <div className="p-3">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-md bg-ink-800 border border-ink-700 text-xs font-medium hover:bg-ink-700 transition-colors"
        >
          <Upload size={15} />
          Import {kind === 'audio' ? 'audio' : 'media'}
        </button>
        <input id={`panel-${kind}-import-input`} data-testid={`panel-${kind}-import-input`} aria-label={`Import ${kind === 'audio' ? 'audio' : 'media'} files`} ref={fileInput} type="file" accept="video/*,image/*,audio/*" multiple hidden onChange={onPick} />
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
            Drag &amp; drop video, image or audio here
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
                    <Music size={22} className="text-ink-500" />
                  )}
                  <span className="absolute top-1 right-1 grid place-items-center h-6 w-6 rounded bg-ink-950/80 text-brand opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus size={14} />
                  </span>
                </div>
                <div className="px-2 py-1.5">
                  <div className="text-[11px] text-ink-200 truncate">{a.name}</div>
                  <div className="text-[10px] text-ink-500 flex items-center gap-1">
                    {a.kind === 'image' ? <ImageIcon size={10} /> : a.kind === 'video' ? <Film size={10} /> : <Music size={10} />}
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
