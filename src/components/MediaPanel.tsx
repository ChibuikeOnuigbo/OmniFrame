import { useMemo, useRef, useState } from 'react'
import {
  Upload,
  Film,
  Music,
  AudioLines,
  Image as ImageIcon,
  Plus,
  Search,
  SlidersHorizontal,
  Play,
  MoreVertical,
  Info,
  X,
  Box,
} from 'lucide-react'
import { useEditor } from '../store'
import type { MediaAsset } from '../types'
import { formatClock } from '../lib/time'
import { getLayeredArtworkInfo } from '../lib/layeredArtworkMetadata'

type MediaFilter = 'all' | 'video' | 'image' | 'audio' | 'threed'

const FILTERS: Array<{ value: MediaFilter; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'video', label: 'Video' },
  { value: 'image', label: 'Image' },
  { value: 'audio', label: 'Audio' },
  { value: 'threed', label: '3D Objects' },
]

export function MediaPanel() {
  const assets = useEditor((s) => s.assets)
  const importFiles = useEditor((s) => s.importFiles)
  const mediaImportNotice = useEditor((s) => s.mediaImportNotice)
  const clearMediaImportNotice = useEditor((s) => s.clearMediaImportNotice)
  const setSourcePreviewAsset = useEditor((s) => s.setSourcePreviewAsset)
  const setMonitorMode = useEditor((s) => s.setMonitorMode)
  const sourcePreview = useEditor((s) => s.sourcePreview)
  const fileInput = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<MediaFilter>('all')
  const [infoAsset, setInfoAsset] = useState<MediaAsset | null>(null)
  const infoArtwork = infoAsset ? getLayeredArtworkInfo(infoAsset) : undefined

  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return assets.filter((asset) => {
      const matchesType =
        filter === 'all' ||
        (filter === 'threed'
          ? asset.kind === 'threed' || asset.name.endsWith('.obj') || asset.name.endsWith('.gltf') || asset.name.endsWith('.glb')
          : asset.kind === filter)
      const matchesQuery = !needle || asset.name.toLocaleLowerCase().includes(needle)
      return matchesType && matchesQuery
    })
  }, [assets, filter, query])

  const addToTimeline = (asset: MediaAsset, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const st = useEditor.getState()
    const trackId = st.ensureTrack(asset.kind === 'audio' ? 'audio' : 'video')
    st.addClipToTrack(trackId, asset.id, st.playhead)
  }

  const handlePreviewSource = (asset: MediaAsset) => {
    setSourcePreviewAsset(asset.id)
    setMonitorMode('source')
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length) importFiles(e.target.files)
    e.target.value = ''
  }

  const handleSafeDrop = (e: React.DragEvent) => {
    e.preventDefault()
    // Invariant: Internal timeline/asset drags must never become file imports!
    if (
      e.dataTransfer.types.includes('application/x-omniframe-asset') ||
      e.dataTransfer.types.includes('application/x-omniframe-timeline-item')
    ) {
      return
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      importFiles(e.dataTransfer.files)
    }
  }

  return (
    <div className="flex flex-col h-full" data-testid="media-library">
      <div className="p-2.5 pb-2" role="search">
        <input
          id="panel-all-import-input"
          data-testid="panel-all-import-input"
          aria-label="Import media files"
          ref={fileInput}
          type="file"
          accept="video/*,image/*,audio/*,.psd,.ora,.kra,.psb,.xcf,.clip,.cmc,.procreate,.afphoto,.afdesign,.pdn,.mdp,.rif,.ai"
          multiple
          hidden
          onChange={onPick}
        />

        {mediaImportNotice && (
          <div
            className="mt-2 flex items-start justify-between gap-2 rounded-md border border-brand/30 bg-brand/10 px-2 py-1.5 text-[10px] text-ink-200"
            role={mediaImportNotice.startsWith('Could not') ? 'alert' : 'status'}
            data-testid="media-import-notice"
          >
            <span>{mediaImportNotice}</span>
            <button
              type="button"
              aria-label="Dismiss import message"
              className="shrink-0 rounded px-1 text-ink-400 hover:text-white"
              onClick={clearMediaImportNotice}
            >
              ×
            </button>
          </div>
        )}
        <div className="mt-1.5 flex items-center gap-1.5">
          <input
            id="alight-xml-file"
            type="file"
            accept=".xml,text/xml"
            hidden
            data-testid="alight-xml-input"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try {
                const r = useEditor.getState().importAlightXml(await f.text())
                useEditor.setState({ mediaImportNotice: r.templateId ? `Template imported from XML: “${r.title}” (${r.templateId}) — apply it via applyTemplate / template_apply` : `Alight Motion “${r.title}”: ${r.layers} layers, ${r.mapped} AM effects mapped (${r.keyframed} keyframed props)` })
              } catch (err) {
                useEditor.setState({ mediaImportNotice: `Could not import Alight XML: ${(err as Error).message}` })
              }
            }}
          />
          <button
            type="button"
            data-testid="alight-xml-import"
            title="Open + read an Alight Motion v5 project XML: layers, effects and keyframes are imported (media layers become re-link placeholders)"
            className="flex-1 rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-[10px] font-medium text-ink-200 hover:border-brand/60 hover:text-white"
            onClick={() => document.getElementById('alight-xml-file')?.click()}
          >
            Import Alight XML
          </button>
          <button
            type="button"
            data-testid="alight-xml-export"
            title="Export the whole project as Alight Motion v5 dialect XML (OmniFrame re-imports it losslessly; AM reads the scene/layer skeleton)"
            className="flex-1 rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-[10px] font-medium text-ink-200 hover:border-brand/60 hover:text-white"
            onClick={() => {
              try {
                const st = useEditor.getState()
                const xml = st.exportAlightXml()
                const blob = new Blob([xml], { type: 'text/xml' })
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = `${(st.projectName || 'omniframe-project').replace(/[^\w.-]+/g, '_')}.xml`
                a.click()
                URL.revokeObjectURL(a.href)
                useEditor.setState({ mediaImportNotice: `Exported Alight XML: ${a.download}` })
              } catch (err) {
                useEditor.setState({ mediaImportNotice: `Could not export Alight XML: ${(err as Error).message}` })
              }
            }}
          >
            Export Alight XML
          </button>
          <button
            type="button"
            data-testid="template-xml-export"
            title="Export the most recently captured template (TEMPLATE MODE) as XML — full processing chain inside, re-importable via Import Alight XML"
            className="flex-1 rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-[10px] font-medium text-ink-200 hover:border-brand/60 hover:text-white"
            onClick={() => {
              const st = useEditor.getState()
              const t = st.templates[st.templates.length - 1]
              if (!t) { useEditor.setState({ mediaImportNotice: 'No captured template yet — use captureTemplate (or template_capture via MCP) first.' }); return }
              const xml = st.exportTemplateXml(t.id)
              if (!xml) return
              const blob = new Blob([xml], { type: 'text/xml' })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = `${t.name.replace(/[^\w.-]+/g, '_')}-template.xml`
              a.click()
              URL.revokeObjectURL(a.href)
              useEditor.setState({ mediaImportNotice: `Exported template XML: ${a.download} (${t.fieldCount} fields)` })
            }}
          >
            Export Template XML
          </button>
        </div>
        <div className="flex items-center gap-1.5">
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
              {FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            data-testid="media-import-btn"
            title="Import media files"
            aria-label="Import media files"
            onClick={() => fileInput.current?.click()}
            className="grid place-items-center h-8 w-8 shrink-0 rounded-md bg-amber-400 text-black hover:bg-amber-300 transition-colors shadow-xs ring-1 ring-amber-200/70"
          >
            <Upload size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        {shown.length === 0 ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleSafeDrop}
            className="h-32 grid place-items-center rounded-lg border border-dashed border-ink-700 text-ink-500 text-xs text-center px-3"
          >
            {assets.length === 0 ? 'Drag & drop video, image, audio, layered PSD, OpenRaster, or Krita .kra here' : 'No media matches this search'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {shown.map((a) => {
              const artwork = getLayeredArtworkInfo(a)
              const isSelectedSource = sourcePreview.assetId === a.id
              return (
                <div
                  key={a.id}
                  draggable
                  data-testid="media-asset"
                  data-asset-kind={a.kind}
                  data-asset-id={a.id}
                  data-asset-name={a.name}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'copy'
                    e.dataTransfer.setData('application/x-omniframe-asset', a.id)
                  }}
                  onClick={() => handlePreviewSource(a)}
                  className={`group relative rounded-md overflow-hidden border cursor-pointer transition-all text-left ${
                    isSelectedSource
                      ? 'border-brand ring-1 ring-brand bg-ink-800'
                      : 'border-ink-700 bg-ink-850 hover:border-ink-500 hover:bg-ink-800'
                  }`}
                >
                  <div className="aspect-video relative grid place-items-center bg-ink-950 overflow-hidden">
                    {a.kind === 'image' || (a.kind === 'video' && a.thumbnail) ? (
                      <img
                        src={a.kind === 'image' ? a.url : a.thumbnail}
                        alt={a.name}
                        draggable={false}
                        className="absolute inset-0 w-full h-full object-contain bg-ink-950 pointer-events-none select-none"
                      />
                    ) : a.kind === 'video' ? (
                      <Film size={22} className="text-ink-500 pointer-events-none" />
                    ) : (
                      <div className="flex items-center -space-x-1 rounded-full border border-brand/20 bg-brand/10 px-2.5 py-2 text-brand-400/80 shadow-[0_0_18px_rgba(108,76,255,0.12)] pointer-events-none">
                        <Music size={20} />
                        <AudioLines size={15} />
                      </div>
                    )}

                    {/* Preview Indicator Pill */}
                    {isSelectedSource && (
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-brand text-[9px] font-bold text-white shadow-md">
                        SOURCE
                      </span>
                    )}

                    {/* More Info / File Details Three-Dot Button */}
                    <button
                      type="button"
                      data-testid="asset-info-btn"
                      data-help="true"
                      title={`Media specifications for ${a.name}`}
                      aria-label={`Media specifications for ${a.name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setInfoAsset(a)
                      }}
                      className="absolute bottom-1 right-1 grid place-items-center h-6 w-6 rounded bg-ink-950/90 text-ink-300 hover:text-white border border-ink-700/80 opacity-0 group-hover:opacity-100 transition-all shadow-md z-10"
                    >
                      <MoreVertical size={13} />
                    </button>

                    {/* Explicit Add to Timeline Button */}
                    <button
                      type="button"
                      data-testid="add-to-timeline-btn"
                      title={`Add “${a.name}” to Timeline at playhead`}
                      aria-label={`Add ${a.name} to timeline`}
                      onClick={(e) => addToTimeline(a, e)}
                      className="absolute top-1 right-1 grid place-items-center h-6 w-6 rounded bg-ink-950/90 text-brand-400 border border-brand/40 opacity-0 group-hover:opacity-100 hover:scale-110 transition-all shadow-md z-10"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <div className="px-2 py-1.5">
                    <div className="text-[11px] text-ink-200 truncate font-medium" title={a.name}>{a.name}</div>
                    {artwork && (
                      <div className="mt-0.5 truncate text-[9px] text-brand-300/80" title={`${artwork.documentName}, ${artwork.groupPath?.join(' / ')}${artwork.groupPath?.length ? ' / ' : ''}${artwork.layerName}`}>
                        {artwork.sourceFormat.toUpperCase()} layer, {artwork.layerName}
                      </div>
                    )}
                    <div className="text-[10px] text-ink-500 flex items-center justify-between mt-0.5">
                      <span className="flex items-center gap-1 capitalize">
                        {a.kind === 'image' ? <ImageIcon size={10} /> : a.kind === 'video' ? <Film size={10} /> : <Music size={10} />}
                        {a.kind}
                      </span>
                      <span className="font-mono">{formatClock(a.duration)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* File Technical Metadata Dialog (Three-Dot More Info) */}
      {infoAsset && (
        <div
          role="dialog"
          aria-label="Media File Technical Specifications"
          data-testid="media-info-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-xl border border-ink-700 bg-ink-900 shadow-2xl p-4 space-y-3.5 text-xs text-ink-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-ink-800">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-brand-400 shrink-0" />
                <span className="font-semibold text-white text-sm">Media File Details</span>
              </div>
              <button
                type="button"
                data-testid="close-media-info-modal"
                onClick={() => setInfoAsset(null)}
                className="p-1 rounded text-ink-400 hover:text-white hover:bg-ink-800 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-2 text-[11px]">
              <div>
                <span className="text-ink-500 block text-[10px] uppercase font-mono">File Name</span>
                <span className="font-medium text-ink-100 break-all">{infoAsset.name}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-ink-800/80">
                <div>
                  <span className="text-ink-500 block text-[10px] uppercase font-mono">Format / Type</span>
                  <span className="capitalize text-brand-400 font-medium">{infoAsset.kind}</span>
                </div>
                <div>
                  <span className="text-ink-500 block text-[10px] uppercase font-mono">Duration</span>
                  <span className="font-mono text-ink-200">{formatClock(infoAsset.duration)} ({infoAsset.duration.toFixed(2)}s)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-ink-800/80">
                <div>
                  <span className="text-ink-500 block text-[10px] uppercase font-mono">Resolution</span>
                  <span className="font-mono text-ink-200">
                    {infoAsset.width && infoAsset.height ? `${infoAsset.width} × ${infoAsset.height}` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-ink-500 block text-[10px] uppercase font-mono">File Size</span>
                  <span className="font-mono text-ink-200">
                    {infoAsset.size ? `${(infoAsset.size / (1024 * 1024)).toFixed(2)} MB` : 'Stream Buffer'}
                  </span>
                </div>
              </div>

              {infoArtwork && (
                <div className="space-y-1 pt-1 border-t border-ink-800/80" data-testid="layered-artwork-details">
                  <span className="text-ink-500 block text-[10px] uppercase font-mono">Layered {infoArtwork.sourceFormat.toUpperCase()} source</span>
                  <div className="text-[10px] text-ink-300">{infoArtwork.documentName}, {[...(infoArtwork.groupPath || []), infoArtwork.layerName].join(' / ')}</div>
                  <div className="font-mono text-[10px] text-ink-400">
                    Canvas {infoArtwork.documentWidth}×{infoArtwork.documentHeight}, offset {infoArtwork.left},{infoArtwork.top}
                  </div>
                  <div className="text-[10px] text-ink-500">Imported as an independent raster layer; unsupported source-app features are not reconstructed.</div>
                </div>
              )}

              <div className="pt-1 border-t border-ink-800/80">
                <span className="text-ink-500 block text-[10px] uppercase font-mono">Decoder Pipeline</span>
                <span className="text-ink-400 text-[10px]">
                  {infoAsset.kind === 'video'
                    ? 'HTML5 VideoElement / Hardware WebCodecs (H.264/VP9/AV1)'
                    : infoAsset.kind === 'audio'
                    ? 'Web Audio AudioBuffer (48kHz Float32 mono/stereo)'
                    : '2D Canvas Raster Engine'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInfoAsset(null)}
                className="px-3 py-1.5 rounded-md bg-ink-800 hover:bg-ink-700 text-xs text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
