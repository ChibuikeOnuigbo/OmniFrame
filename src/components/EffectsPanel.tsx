import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Layers,
  Play,
  Plus,
  Power,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react'
import { useEditor } from '../store'
import type { Clip, ClipEffect } from '../types'
import { activeEffectKeys, placedEffectLabels } from '../lib/adjustment'
import { applyLutStackToImageData, loadCubeLut, parseCubeLUT } from '../lib/lutEngine'
import { PanelSection } from './PanelSection'
import { previewClipEffect, previewClipPlayback, previewEffectLayer, previewLut } from '../lib/visualPreviewActions'

type LutItem = {
  id: string
  name: string
  file?: string
  description: string
  category: string
  swatch?: string
  tags?: string[]
  cubeText?: string
}

const DEFAULT_EFFECTS: ClipEffect = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  blur: 0,
  grayscale: 0,
  invert: 0,
  sepia: 0,
  hueRotate: 0,
}

let lutPreviewImagePromise: Promise<HTMLImageElement> | null = null

function loadLutPreviewImage() {
  if (!lutPreviewImagePromise) {
    lutPreviewImagePromise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.decoding = 'async'
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('LUT preview image could not be loaded'))
      image.src = '/assets/room/clean_room_background.png'
    }).catch((error) => {
      lutPreviewImagePromise = null
      throw error
    })
  }
  return lutPreviewImagePromise
}

function LutPreview({
  id,
  file,
  cubeText,
  swatch,
  category,
}: {
  id: string
  file?: string
  cubeText?: string
  swatch?: string
  category?: string
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const [image, lut] = await Promise.all([
          loadLutPreviewImage(),
          file
            ? loadCubeLut(file.startsWith('/') ? file : `/${file}`)
            : Promise.resolve(parseCubeLUT(cubeText || '')),
        ])
        const width = 160
        const height = 90
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) return
        const sourceWidth = image.naturalWidth
        const sourceHeight = image.naturalHeight
        const sourceAspect = sourceWidth / sourceHeight
        const targetAspect = width / height
        let sx = 0
        let sy = 0
        let sw = sourceWidth
        let sh = sourceHeight
        if (sourceAspect > targetAspect) {
          sw = sourceHeight * targetAspect
          sx = (sourceWidth - sw) / 2
        } else {
          sh = sourceWidth / targetAspect
          sy = (sourceHeight - sh) / 2
        }
        context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height)
        const pixels = context.getImageData(0, 0, width, height)
        applyLutStackToImageData(pixels, [{ lut, intensity: 1 }])
        context.putImageData(pixels, 0, 0)
        if (active) setPreviewUrl(canvas.toDataURL('image/jpeg', 0.84))
      } catch {
        // Keep the color swatch fallback if a local preview/LUT cannot load.
      }
    })()
    return () => { active = false }
  }, [cubeText, file])

  return (
    <span data-testid={`lut-preview-frame-${id}`} className="relative block h-11 w-full overflow-hidden bg-ink-950">
      {previewUrl ? (
        <img data-testid={`lut-preview-${id}`} src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${swatch || 'rgb(78, 104, 130)'} 0%, #182331 58%, #0c1018 100%)` }} />
      )}
      <span className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-black/75 to-transparent" />
      {category && <span className="absolute bottom-1 left-1.5 text-[9px] font-semibold uppercase tracking-wider text-white/90" aria-hidden="true">{category}</span>}
    </span>
  )
}

/** Built-in looks and user .cube imports, grouped as one first-party catalog. */
function LutGallery() {
  const lutLibrary = useEditor((s) => s.lutLibrary)
  const userLuts = useEditor((s) => s.userLuts)
  const loadLutLibrary = useEditor((s) => s.loadLutLibrary)
  const addUserLut = useEditor((s) => s.addUserLut)
  const removeUserLut = useEditor((s) => s.removeUserLut)
  const clearUserLuts = useEditor((s) => s.clearUserLuts)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const clips = useEditor((s) => s.clips)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)
  const [previewNotice, setPreviewNotice] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [showAllLooks, setShowAllLooks] = useState(false)
  const [lookDetailId, setLookDetailId] = useState<string | null>(null)

  useEffect(() => {
    void loadLutLibrary()
  }, [loadLutLibrary])

  const selected = clips.find((clip) => clip.id === selectedClipId)
  const categories = useMemo(
    () => ['All', ...Array.from(new Set(lutLibrary.luts.map((lut) => lut.category)))],
    [lutLibrary.luts],
  )
  const filteredBuiltins = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return lutLibrary.luts.filter((lut) => {
      const matchesCategory = category === 'All' || lut.category === category
      const searchable = `${lut.name} ${lut.description} ${lut.category} ${(lut.tags || []).join(' ')}`.toLowerCase()
      return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery))
    })
  }, [category, lutLibrary.luts, query])
  const filteredUploads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (category !== 'All' && category !== 'Uploaded') return []
    return userLuts.filter((lut) => !normalizedQuery || lut.name.toLowerCase().includes(normalizedQuery))
  }, [category, query, userLuts])
  const lookDetail = filteredBuiltins.find((lut) => lut.id === lookDetailId) ?? filteredBuiltins[0] ?? null
  const showFilteredBuiltins = showAllLooks || !!query.trim() || category !== 'All'
  const visibleBuiltins = showFilteredBuiltins ? filteredBuiltins : filteredBuiltins.slice(0, 12)

  const placementHint = selected?.kind === 'adjustment'
    ? `Preview on “${selected.name}”; Apply commits it to that layer.`
    : selected
      ? `Preview on selected clip “${selected.name}”; Apply commits the look.`
      : 'Preview on active footage as a temporary adjustment layer; Apply commits it.'

  const handlePreviewLook = (lut: Pick<LutItem, 'name' | 'id' | 'cubeText'>) => {
    const started = previewLut({ name: lut.name, builtin: lut.id && !lut.cubeText ? lut.id : undefined, cubeText: lut.cubeText })
    setPreviewNotice(started ? null : 'Add visible timeline footage to audition this look.')
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploadError(null)
    setUploadNotice(null)
    let failed = 0
    let imported = 0
    for (const file of Array.from(files)) {
      try {
        const text = await file.text()
        const name = file.name.replace(/\.cube$/i, '')
        if (!addUserLut(name, text)) {
          failed++
          continue
        }
        imported++
      } catch {
        failed++
      }
    }
    if (failed) setUploadError(`${failed} .cube file${failed === 1 ? '' : 's'} could not be loaded. Use a valid 3D LUT.`)
    if (imported) setUploadNotice(`${imported} LUT${imported === 1 ? '' : 's'} imported. Preview a tile, then Apply when it is ready.`)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleClearUploads = () => {
    if (!userLuts.length) return
    if (!window.confirm(`Remove all ${userLuts.length} uploaded LUTs from this browser? Looks already placed on clips will remain.`)) return
    clearUserLuts()
  }

  return (
    <div data-testid="lut-gallery" className="space-y-2.5">
      <p className="text-[10px] leading-snug text-ink-400" data-testid="lut-placement-hint">
        {placementHint} Set strength on an applied look in the controls below.
      </p>
      {uploadNotice && <p className="rounded border border-emerald-900/70 bg-emerald-950/25 px-2 py-1 text-[9px] text-emerald-200" role="status">{uploadNotice}</p>}
      {previewNotice && <p className="rounded border border-amber-900/70 bg-amber-950/25 px-2 py-1 text-[9px] text-amber-200" role="status">{previewNotice}</p>}

      <div data-testid="lut-search-section" role="group" aria-label="Find or import looks" className="flex items-center gap-1.5">
        <label className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-ink-800 bg-ink-950/70 px-2 focus-within:border-brand">
          <Search size={12} className="shrink-0 text-ink-500" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search LUT looks"
            data-testid="lut-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a look…"
            className="h-7 min-w-0 flex-1 bg-transparent text-[11px] text-ink-100 outline-none placeholder:text-ink-600"
          />
          {query && (
            <button type="button" aria-label="Clear LUT search" onClick={() => setQuery('')} className="text-ink-500 hover:text-white">
              <X size={11} />
            </button>
          )}
        </label>
        <button
          type="button"
          data-testid="upload-lut-btn"
          onClick={() => fileRef.current?.click()}
          title="Import one or more .cube 3D LUT files"
          className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-ink-700 bg-ink-800 px-2 text-[10px] text-ink-300 transition-colors hover:border-emerald-500 hover:text-white"
        >
          <Upload size={11} /> Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".cube,text/plain"
          multiple
          className="hidden"
          data-testid="upload-lut-input"
          onChange={(event) => void handleUpload(event.target.files)}
        />
      </div>

      <div data-testid="lut-style-section" className="flex flex-wrap gap-1" role="group" aria-label="Filter LUT looks by style">
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={category === item}
            data-testid={`lut-category-${item.toLowerCase().replace(/\s+/g, '-')}`}
            onClick={() => setCategory(item)}
            className={`min-h-6 rounded-full border px-2 text-[9px] transition-colors ${
              category === item
                ? 'border-brand bg-brand/20 text-white'
                : 'border-ink-800 bg-ink-950/40 text-ink-500 hover:border-ink-600 hover:text-ink-200'
            }`}
          >
            {item}
          </button>
        ))}
        {userLuts.length > 0 && (
          <button
            type="button"
            aria-pressed={category === 'Uploaded'}
            data-testid="lut-category-uploaded"
            onClick={() => setCategory('Uploaded')}
            className={`min-h-6 rounded-full border px-2 text-[9px] transition-colors ${
              category === 'Uploaded'
                ? 'border-emerald-500 bg-emerald-950/50 text-emerald-100'
                : 'border-ink-800 bg-ink-950/40 text-ink-500 hover:border-emerald-800 hover:text-emerald-100'
            }`}
          >
            Uploaded ({userLuts.length})
          </button>
        )}
      </div>

      {!lutLibrary.loaded && (
        <p className="text-[10px] text-ink-600" role="status">Loading built-in looks…</p>
      )}
      {lutLibrary.loaded && lutLibrary.luts.length === 0 && (
        <p className="rounded-md border border-amber-900/70 bg-amber-950/30 p-2 text-[10px] text-amber-200" role="status">
          The built-in LUT catalog could not be loaded. You can still import .cube files.
        </p>
      )}

      {(filteredBuiltins.length > 0 || filteredUploads.length > 0) ? (
        <>
          {filteredBuiltins.length > 0 && (
            <p data-testid="lut-look-description" className="min-h-9 rounded-md border border-ink-800 bg-ink-950/45 px-2 py-1.5 text-[10px] leading-snug text-ink-300">
              {lookDetail ? <><strong className="text-ink-100">{lookDetail.name}</strong> — {lookDetail.description}</> : 'Focus or hover a built-in look to read its description.'}
            </p>
          )}
          <div data-testid="lut-looks-section" role="group" aria-label="Available LUT looks">
            <div className="grid grid-cols-2 gap-1.5" data-testid="lut-look-grid">
          {visibleBuiltins.map((lut) => (
            <button
              key={lut.id}
              type="button"
              data-testid={`lut-tile-${lut.id}`}
              aria-describedby={`lut-desc-${lut.id}`}
              title={`Preview ${lut.name} — Apply from the monitor to commit. ${lut.description}`}
              onFocus={() => setLookDetailId(lut.id)}
              onMouseEnter={() => setLookDetailId(lut.id)}
              onClick={() => handlePreviewLook({ id: lut.id, name: lut.name })}
              className="group min-w-0 overflow-hidden rounded-md border border-ink-800 bg-ink-900/80 text-left transition-colors hover:border-brand hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <LutPreview id={lut.id} file={lut.file} swatch={lut.swatch} category={lut.category} />
              <span className="block truncate px-1.5 py-1.5 text-[10px] font-medium text-ink-100 group-hover:text-white">{lut.name}</span>
              <span id={`lut-desc-${lut.id}`} className="sr-only">{lut.description}</span>
            </button>
          ))}
          {filteredUploads.map((lut) => (
            <div key={lut.id} data-testid={`lut-tile-user-${lut.id}`} className="group relative min-w-0 overflow-hidden rounded-md border border-emerald-900/80 bg-ink-900/80 transition-colors hover:border-emerald-400">
              <button
                type="button"
                title={`Preview ${lut.name}; Apply from the monitor to commit.`}
                onClick={() => handlePreviewLook({ id: lut.id, name: lut.name, cubeText: lut.cubeText })}
                className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
              >
                <LutPreview id={`user-${lut.id}`} cubeText={lut.cubeText} swatch="rgb(42, 132, 104)" category="Uploaded" />
                <span className="block truncate px-1.5 pt-1 text-[10px] font-medium text-ink-100">{lut.name}</span>
                <span className="block px-1.5 pb-1 text-[9px] text-emerald-300/70">Imported .cube look</span>
              </button>
              <button
                type="button"
                aria-label={`Remove uploaded LUT ${lut.name}`}
                title={`Remove ${lut.name} from the uploaded catalog`}
                className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded bg-black/70 text-ink-400 opacity-0 transition-opacity hover:text-red-300 group-hover:opacity-100 focus:opacity-100"
                onClick={() => removeUserLut(lut.id)}
              >
                <X size={11} />
              </button>
            </div>
          ))}
          </div>
          {category === 'All' && !query.trim() && filteredBuiltins.length > 12 && (
            <button
              type="button"
              data-testid="lut-show-all"
              aria-expanded={showAllLooks}
              onClick={() => setShowAllLooks((expanded) => !expanded)}
              className="min-h-7 w-full rounded-md border border-ink-800 bg-ink-950/50 px-2 text-[10px] font-medium text-ink-300 transition-colors hover:border-brand hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {showAllLooks ? 'Show fewer looks' : `Show all ${filteredBuiltins.length} looks`}
            </button>
          )}
          </div>
        </>
      ) : (
        <p className="rounded-md border border-ink-800 bg-ink-950/40 p-2 text-[10px] text-ink-500" data-testid="lut-empty-state">
          {query ? 'No looks match that search.' : 'No uploaded LUTs yet. Import one or more .cube files.'}
        </p>
      )}

      {userLuts.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-t border-ink-800 pt-1.5">
          <span className="text-[9px] text-ink-600">{userLuts.length} uploaded look{userLuts.length === 1 ? '' : 's'} saved in this browser</span>
          <button
            type="button"
            data-testid="clear-uploaded-luts-btn"
            onClick={handleClearUploads}
            className="text-[9px] text-ink-500 underline decoration-ink-700 underline-offset-2 hover:text-red-300"
          >
            Clear uploads
          </button>
        </div>
      )}
      {uploadError && <p className="text-[10px] text-red-300" role="alert" data-testid="lut-upload-error">{uploadError}</p>}
    </div>
  )
}

/** A layer card can be selected to restore its timeline highlight and controls. */
function PlacedAdjustments() {
  const clips = useEditor((s) => s.clips)
  const tracks = useEditor((s) => s.tracks)
  const sequences = useEditor((s) => s.sequences)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const selectClip = useEditor((s) => s.selectClip)
  const setLutIntensity = useEditor((s) => s.setLutIntensity)
  const toggleLutEnabled = useEditor((s) => s.toggleLutEnabled)
  const removeLutFromClip = useEditor((s) => s.removeLutFromClip)
  const removeClip = useEditor((s) => s.removeClip)
  const carriers = clips.filter((clip) =>
    clip.kind === 'adjustment' ||
    (clip.adjustment?.luts?.length ?? 0) > 0 ||
    activeEffectKeys(clip.effects).length > 0,
  )

  if (!carriers.length) {
    return (
      <div className="rounded-md border border-dashed border-ink-800 px-2.5 py-3 text-center text-[10px] text-ink-500" data-testid="placed-adjustments-empty">
        No effects placed yet. Add a layer or apply a look above.
      </div>
    )
  }

  return (
    <div data-testid="placed-adjustments" className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Placed in this sequence</span>
        <span className="font-mono text-[9px] text-ink-600">{carriers.length}</span>
      </div>
      {carriers.map((clip) => {
        const labels = placedEffectLabels(clip, sequences)
        const trackName = tracks.find((track) => track.id === clip.trackId)?.name || 'Track'
        const isSelected = clip.id === selectedClipId
        const isLayer = clip.kind === 'adjustment'
        return (
          <div
            key={clip.id}
            data-testid={`placed-adjustment-${clip.id}`}
            data-selected={isSelected ? 'true' : 'false'}
            className={`rounded-md border p-2 transition-colors ${isSelected ? 'border-cyan-400/70 bg-cyan-950/30' : 'border-ink-800 bg-ink-950/35 hover:border-ink-600'}`}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => selectClip(clip.id)}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                title="Select this clip or layer to restore its timeline border and controls"
              >
                {isLayer ? <Layers size={12} className="shrink-0 text-cyan-300" /> : <Wand2 size={12} className="shrink-0 text-blue-300" />}
                <span className="truncate text-[11px] text-ink-100">{clip.name}</span>
              </button>
              {isLayer && (
                <button
                  type="button"
                  aria-label={`Delete adjustment layer ${clip.name}`}
                  title="Delete this adjustment layer from the timeline"
                  onClick={() => removeClip(clip.id)}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded text-ink-500 hover:bg-red-950/50 hover:text-red-300"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
            <div className="truncate pl-[18px] pt-0.5 text-[9px] text-ink-600" title={`${trackName} · ${labels.join(', ')}`}>
              {trackName} · {clip.start.toFixed(1)}s–{(clip.start + clip.duration).toFixed(1)}s{labels.length ? ` · ${labels.join(', ')}` : ''}
            </div>
            {(clip.adjustment?.luts?.length ?? 0) > 0 && (
              <div className="mt-1.5 space-y-1 border-t border-ink-800/70 pt-1.5">
                {clip.adjustment!.luts.map((lut) => (
                  <div key={lut.id} data-testid={`placed-lut-${lut.id}`} className="flex min-w-0 items-center gap-1">
                    <button
                      type="button"
                      data-testid={`lut-power-${lut.id}`}
                      aria-label={`${lut.enabled ? 'Disable' : 'Enable'} ${lut.name}`}
                      title={lut.enabled ? 'Disable look' : 'Enable look'}
                      onClick={() => toggleLutEnabled(clip.id, lut.id)}
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded ${lut.enabled ? 'text-emerald-300' : 'text-ink-600'}`}
                    >
                      <Power size={10} />
                    </button>
                    <button type="button" onClick={() => selectClip(clip.id)} className="min-w-0 flex-1 truncate text-left text-[10px] text-ink-300 hover:text-white" title={`Select ${clip.name}`}>
                      {lut.name}
                    </button>
                    <input
                      type="range"
                      data-testid={`lut-intensity-${lut.id}`}
                      aria-label={`${lut.name} intensity`}
                      min={0}
                      max={1}
                      step={0.05}
                      value={lut.intensity}
                      onChange={(event) => setLutIntensity(clip.id, lut.id, parseFloat(event.target.value))}
                      className="of-range w-16"
                    />
                    <span className="w-7 shrink-0 text-right text-[9px] tabular-nums text-ink-500">{Math.round(lut.intensity * 100)}%</span>
                    <button
                      type="button"
                      data-testid={`lut-remove-${lut.id}`}
                      aria-label={`Remove ${lut.name} from ${clip.name}`}
                      title={`Remove ${lut.name}`}
                      onClick={() => removeLutFromClip(clip.id, lut.id)}
                      className="grid h-5 w-5 shrink-0 place-items-center rounded text-ink-500 hover:text-red-300"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const EFFECT_LAYERS: Array<{ id: string; label: string; effect: ClipEffect }> = [
  { id: 'blur', label: 'Blur Layer', effect: { blur: 6 } },
  { id: 'bw', label: 'B&W Layer', effect: { grayscale: 1, contrast: 1.15 } },
  { id: 'invert', label: 'Invert Layer', effect: { invert: 1 } },
  { id: 'brighten', label: 'Brighten Layer', effect: { brightness: 1.25 } },
  { id: 'darken', label: 'Darken Layer', effect: { brightness: 0.75, contrast: 1.1 } },
  { id: 'warm', label: 'Warm Layer', effect: { saturation: 1.2, brightness: 1.05, sepia: 0.18 } },
  { id: 'cool', label: 'Cool Layer', effect: { saturation: 0.92, hueRotate: 205 } },
  { id: 'soft', label: 'Soft Layer', effect: { contrast: 0.9, saturation: 0.95 } },
]

function EffectLayerButtons() {
  const [notice, setNotice] = useState<string | null>(null)
  return (
    <div className="space-y-1.5" data-testid="effect-layer-presets">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Quick adjustment layers</div>
        <p className="mt-0.5 text-[10px] leading-snug text-ink-400">Click to audition from the clip start. Apply in the monitor to create the real layer clip.</p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {EFFECT_LAYERS.map((layer) => (
          <button
            key={layer.id}
            type="button"
            data-testid={`effect-layer-${layer.id}`}
            aria-label={`Preview ${layer.label}`}
            title={`Preview ${layer.label}; Apply in the monitor to place it above the footage`}
            onClick={() => setNotice(previewEffectLayer(layer.label, layer.effect) ? null : 'Add visible timeline footage to audition this layer.')}
            className="flex min-h-8 min-w-0 items-center gap-1.5 rounded-md border border-ink-800 bg-ink-950/50 px-2 py-1.5 text-left text-[10px] text-ink-300 transition-colors hover:border-cyan-500/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <Play size={10} className="shrink-0 text-cyan-400" />
            <span className="truncate">{layer.label}</span>
          </button>
        ))}
      </div>
      {notice && <p className="rounded border border-amber-900/70 bg-amber-950/25 px-2 py-1 text-[9px] text-amber-200" role="status">{notice}</p>}
    </div>
  )
}

const CONTROL_DEFS: Array<{ key: keyof ClipEffect; label: string; min: number; max: number; step: number; valueLabel?: (value: number) => string }> = [
  { key: 'brightness', label: 'Brightness', min: 0, max: 2, step: 0.05, valueLabel: (value) => `${Math.round(value * 100)}%` },
  { key: 'contrast', label: 'Contrast', min: 0, max: 2, step: 0.05, valueLabel: (value) => `${Math.round(value * 100)}%` },
  { key: 'saturation', label: 'Saturation', min: 0, max: 2, step: 0.05, valueLabel: (value) => `${Math.round(value * 100)}%` },
  { key: 'hueRotate', label: 'Hue rotate', min: 0, max: 360, step: 5, valueLabel: (value) => `${Math.round(value)}°` },
  { key: 'blur', label: 'Blur', min: 0, max: 20, step: 0.5, valueLabel: (value) => `${Math.round(value)}px` },
  { key: 'grayscale', label: 'Grayscale', min: 0, max: 1, step: 0.05, valueLabel: (value) => `${Math.round(value * 100)}%` },
  { key: 'invert', label: 'Invert', min: 0, max: 1, step: 0.05, valueLabel: (value) => `${Math.round(value * 100)}%` },
  { key: 'sepia', label: 'Sepia', min: 0, max: 1, step: 0.05, valueLabel: (value) => `${Math.round(value * 100)}%` },
]

function ClipEffectsControls({ clip }: { clip?: Clip }) {
  const setClipEffect = useEditor((s) => s.setClipEffect)
  const isLayer = clip?.kind === 'adjustment'
  if (!clip) {
    return (
      <div className="rounded-md border border-dashed border-ink-800 p-3 text-center" data-testid="clip-effects-empty">
        <SlidersHorizontal size={18} className="mx-auto mb-1.5 text-ink-600" />
        <p className="text-[10px] font-medium text-ink-300">Select a clip or adjustment layer</p>
        <p className="mt-0.5 text-[10px] leading-snug text-ink-400">Clip controls stay scoped to that clip; a timeline layer grades the composite below it.</p>
      </div>
    )
  }
  const effects: ClipEffect = { ...DEFAULT_EFFECTS, ...(clip.effects || {}) }
  const labels = activeEffectKeys(clip.effects)
  const reset = () => setClipEffect(clip.id, DEFAULT_EFFECTS)
  const presetEffects: Record<string, ClipEffect> = {
    cinematic: { contrast: 1.25, saturation: 1.15, brightness: 0.95, sepia: 0.1, hueRotate: 0 },
    noir: { grayscale: 1, contrast: 1.4, brightness: 0.9, sepia: 0, hueRotate: 0 },
    vintage: { sepia: 0.6, contrast: 0.9, brightness: 1.05, hueRotate: 0 },
    warm: { brightness: 1.05, saturation: 1.25, sepia: 0.25, hueRotate: 0 },
    cyberpunk: { hueRotate: 280, contrast: 1.35, saturation: 1.45, brightness: 1.0 },
    invert: { invert: 1, contrast: 1.2, brightness: 1.0 },
  }
  const previewPreset = (presetId: string, label: string) => {
    previewClipEffect(clip.id, label, presetEffects[presetId])
  }

  return (
    <div className="space-y-2" data-testid="clip-effects-controls">
      <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-ink-800 bg-ink-950/55 px-2 py-1.5">
        <div className="min-w-0">
          <span className="block text-[9px] font-semibold uppercase tracking-wider text-brand-300">{isLayer ? 'Selected adjustment layer' : 'Selected clip'}</span>
          <span className="block truncate text-[10px] text-ink-200" title={clip.name}>{clip.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            data-testid="preview-selected-clip-btn"
            onClick={() => previewClipPlayback(clip.id, `Current look · ${clip.name}`)}
            title="Play this clip from its beginning with its current look"
            aria-label={`Preview ${clip.name} from the beginning`}
            className="grid h-7 w-7 place-items-center rounded border border-brand/60 bg-brand/15 text-brand-300 hover:bg-brand hover:text-white"
          >
            <Play size={11} />
          </button>
          <button type="button" data-testid="reset-effects-btn" onClick={reset} title="Reset this clip's filter controls" className="flex h-7 shrink-0 items-center gap-1 rounded border border-ink-700 px-2 text-[9px] text-ink-400 hover:text-white">
            <RotateCcw size={10} /> Reset
          </button>
        </div>
      </div>
      <p className="text-[10px] leading-snug text-ink-400">
        Presets audition temporarily from the clip start; Apply in the monitor to commit. Sliders below edit the selected {isLayer ? 'layer' : 'clip'} live.
      </p>
      <div className="grid grid-cols-3 gap-1">
        {[
          { id: 'cinematic', label: 'Cinematic' },
          { id: 'noir', label: 'Film noir' },
          { id: 'vintage', label: 'Vintage' },
          { id: 'warm', label: 'Warm' },
          { id: 'cyberpunk', label: 'Cyberpunk' },
          { id: 'invert', label: 'Invert' },
        ].map((preset) => (
          <button
            key={preset.id}
            type="button"
            data-testid={`effect-preset-${preset.id}`}
            aria-label={`Preview ${preset.label} filter on selected ${isLayer ? 'layer' : 'clip'}`}
            title={`Preview ${preset.label}; Apply in the monitor to commit`}
            onClick={() => previewPreset(preset.id, preset.label)}
            className="min-h-6 truncate rounded border border-ink-800 bg-ink-950/50 px-1 text-[9px] text-ink-400 hover:border-brand hover:text-white"
          >
            {preset.label}
          </button>
        ))}
      </div>
      {CONTROL_DEFS.map((control) => (
        <label key={control.key} className="block" data-testid={`control-${control.key}`}>
          <span className="mb-0.5 flex items-center justify-between gap-2 text-[10px] text-ink-400">
            <span>{control.label}</span>
            <span className="font-mono text-[9px] text-ink-500">{control.valueLabel?.(effects[control.key] as number) ?? effects[control.key]}</span>
          </span>
          <input
            type="range"
            data-testid={`effect-slider-${String(control.key).toLowerCase()}`}
            aria-label={control.label}
            min={control.min}
            max={control.max}
            step={control.step}
            value={effects[control.key] as number}
            onChange={(event) => setClipEffect(clip.id, { [control.key]: parseFloat(event.target.value) })}
            className="of-range w-full"
          />
        </label>
      ))}
      {labels.length > 0 && (
        <div className="rounded-md border border-ink-800 bg-ink-950/40 px-2 py-1.5" data-testid="clip-effect-summary">
          <span className="block text-[9px] font-semibold uppercase tracking-wider text-ink-600">Active filters</span>
          <span className="block truncate text-[10px] text-ink-300" title={labels.join(', ')}>{labels.join(' · ')}</span>
        </div>
      )}
    </div>
  )
}

export function EffectsPanel() {
  const clips = useEditor((s) => s.clips)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const addAdjustmentLayer = useEditor((s) => s.addAdjustmentLayer)
  const selectedClip = clips.find((clip) => clip.id === selectedClipId)
  const layerCount = clips.filter((clip) => clip.kind === 'adjustment').length

  return (
    <div data-testid="effects-panel" className="text-xs text-ink-200 select-none">
      <div className="border-b border-ink-800 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
          <Wand2 size={12} /> Color &amp; Adjustments
        </div>
        <p className="mt-1 text-[10px] leading-snug text-ink-300">Choose a look, add a stackable layer, or grade one selected clip.</p>
      </div>

      <PanelSection title="LUT looks" hint="25" defaultOpen testId="adjustment-looks">
        <LutGallery />
      </PanelSection>

      <PanelSection title="Adjustment layers" hint={String(layerCount)} testId="adjustment-layers">
        <button
          type="button"
          data-testid="new-adjustment-layer-btn"
          onClick={() => addAdjustmentLayer()}
          className="flex min-h-9 w-full items-center justify-center gap-1.5 rounded-md border border-cyan-700/70 bg-cyan-950/45 px-2 text-[11px] font-medium text-cyan-100 transition-colors hover:border-cyan-400 hover:bg-cyan-900/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <Plus size={13} /> New adjustment layer
        </button>
        <p className="text-[10px] leading-snug text-ink-400">With footage selected, the layer matches its duration and sits above it, below higher tracks. Open a compound clip to place a layer inside its nested timeline.</p>
        <EffectLayerButtons />
        <PlacedAdjustments />
      </PanelSection>

      <PanelSection title="Clip controls" hint={selectedClip ? 'Selected' : undefined} testId="adjustment-controls">
        <ClipEffectsControls clip={selectedClip} />
      </PanelSection>
    </div>
  )
}
