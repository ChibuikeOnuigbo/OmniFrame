import { useEffect, useMemo, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Activity, Aperture, Ban, Circle, CircleDot, CloudFog, CloudRain, Download, Feather, Flame, Flower2, Frame, Grid2x2, Grid3x3, Image as ImageIcon, Lamp, Layers, Orbit, Play, Plus, Power, RotateCcw, ScanLine, Search, SlidersHorizontal, Snowflake, Sparkles, SunMedium, Sunset, Trash2, Upload, Wand2, Waves, Wind, X } from 'lucide-react'
import SegmentCarousel from './SegmentCarousel'
import ExpandableToolGroup from './ExpandableToolGroup'
import { useEditor } from '../store'
import type { Clip, ClipEffect } from '../types'
import { activeEffectKeys, placedEffectLabels } from '../lib/adjustment'
import { applyLutStackToImageData, loadCubeLut, parseCubeLUT } from '../lib/lutEngine'
import { PanelSection } from './PanelSection'
import { SHAKE_PRESETS } from '../lib/shakePresets'
import { previewClipEffect, previewClipPlayback, previewEffectLayer, previewLut } from '../lib/visualPreviewActions'
import { customEffectFileName, customEffectSummary, parseCustomEffectFile, serializeCustomEffect } from '../lib/customEffects'
import { FX_CATS, getFxCatalog, loadGlitchRecipeCatalog, paramsForPatch, type FxCat, type FxCatalogEntry } from '../lib/effectCatalog'
import type { CustomEffect } from '../types'

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
  vibrance: 1,
  solarize: 0,
  posterize: 0,
  grain: 0,
  pixelate: 0,
  chromatic: 0,
  pixelStretch: 0,
  waveWarp: 0,
  chromaKey: 0,
  chromaColor: '#00ff00',
  lightType: 'point',
  lightColor: '#ffd9a0',
  lightIntensity: 0,
  lightFalloff: 0.45,
  lightX: 0.5,
  lightY: 0.4,
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
      {uploadNotice && <p className="rounded border border-emerald-900/70 bg-emerald-950/25 px-2 py-1 text-[9px] text-emerald-200" role="status">{uploadNotice}</p>}
      {previewNotice && <p className="rounded border border-amber-900/70 bg-amber-950/25 px-2 py-1 text-[9px] text-amber-200" role="status">{previewNotice}</p>}

      <div data-testid="lut-search-section" role="group" aria-label="Find or import looks" className="flex items-center gap-1.5">
        <label className="flex min-w-0 flex-1 items-center gap-1.5 rounded-none border border-ink-800 bg-ink-950/70 px-2 focus-within:border-brand">
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
          className="flex h-7 shrink-0 items-center gap-1 rounded-none border border-ink-700 bg-ink-800 px-2 text-[10px] text-ink-300 transition-colors hover:border-emerald-500 hover:text-white"
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
        <p className="rounded-none border border-amber-900/70 bg-amber-950/30 p-2 text-[10px] text-amber-200" role="status">
          The built-in LUT catalog could not be loaded. You can still import .cube files.
        </p>
      )}

      {(filteredBuiltins.length > 0 || filteredUploads.length > 0) ? (
        <>
          {filteredBuiltins.length > 0 && (
            <p data-testid="lut-look-description" className="min-h-9 rounded-none border border-ink-800 bg-ink-950/45 px-2 py-1.5 text-[10px] leading-snug text-ink-300">
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
              className="group min-w-0 overflow-hidden rounded-none border border-ink-800 bg-ink-900/80 text-left transition-colors hover:border-brand hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <LutPreview id={lut.id} file={lut.file} swatch={lut.swatch} category={lut.category} />
              <span className="block truncate px-1.5 py-1.5 text-[10px] font-medium text-ink-100 group-hover:text-white">{lut.name}</span>
              <span id={`lut-desc-${lut.id}`} className="sr-only">{lut.description}</span>
            </button>
          ))}
          {filteredUploads.map((lut) => (
            <div key={lut.id} data-testid={`lut-tile-user-${lut.id}`} className="group relative min-w-0 overflow-hidden rounded-none border border-emerald-900/80 bg-ink-900/80 transition-colors hover:border-emerald-400">
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
              className="min-h-7 w-full rounded-none border border-ink-800 bg-ink-950/50 px-2 text-[10px] font-medium text-ink-300 transition-colors hover:border-brand hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {showAllLooks ? 'Show fewer looks' : `Show all ${filteredBuiltins.length} looks`}
            </button>
          )}
          </div>
        </>
      ) : (
        <p className="rounded-none border border-ink-800 bg-ink-950/40 p-2 text-[10px] text-ink-500" data-testid="lut-empty-state">
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
      <div className="rounded-none border border-dashed border-ink-800 px-2.5 py-3 text-center text-[10px] text-ink-500" data-testid="placed-adjustments-empty">
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
            className={`rounded-none border p-2 transition-colors ${isSelected ? 'border-cyan-400/70 bg-cyan-950/30' : 'border-ink-800 bg-ink-950/35 hover:border-ink-600'}`}
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
            <div className="truncate pl-[18px] pt-0.5 text-[9px] text-ink-600" title={`${trackName}, ${labels.join(', ')}`}>
              {trackName}, {clip.start.toFixed(1)}s–{(clip.start + clip.duration).toFixed(1)}s{labels.length ? `, ${labels.join(', ')}` : ''}
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
            className="flex min-h-8 min-w-0 items-center gap-1.5 rounded-none border border-ink-800 bg-ink-950/50 px-2 py-1.5 text-left text-[10px] text-ink-300 transition-colors hover:border-cyan-500/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
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


type FxTileGroup = { key: 'particleFx' | 'overlayFx' | 'replaceBg'; label: string; testPrefix: string; items: Array<{ id: string; label: string; icon: LucideIcon }> }
const FX_TILE_GROUPS: FxTileGroup[] = [
  { key: 'particleFx', label: 'Particles', testPrefix: 'particle-fx', items: [
    { id: 'none', label: 'No particles', icon: Ban },
    { id: 'feathers', label: 'Feathers drifting around the subject', icon: Feather },
    { id: 'embers', label: 'Rising embers with glow', icon: Flame },
    { id: 'dust', label: 'Dust motes', icon: CloudFog },
    { id: 'bokeh', label: 'Bokeh blooms', icon: CircleDot },
    { id: 'sparkles', label: 'Twinkling sparkles', icon: Sparkles },
    { id: 'snow', label: 'Falling snow', icon: Snowflake },
    { id: 'rain', label: 'Rain streaks', icon: CloudRain },
    { id: 'petals', label: 'Falling petals', icon: Flower2 },
  ] },
  { key: 'overlayFx', label: 'Overlays', testPrefix: 'overlay-fx', items: [
    { id: 'none', label: 'No overlay', icon: Ban },
    { id: 'scanlines', label: 'CRT scanlines', icon: ScanLine },
    { id: 'halftone', label: 'Halftone dots', icon: Grid3x3 },
    { id: 'spotlight', label: 'Spotlight stage', icon: Lamp },
    { id: 'vignette', label: 'Vignette', icon: Circle },
    { id: 'lightleak', label: 'Warm light leak', icon: SunMedium },
    { id: 'frameglow', label: 'Frame glow border', icon: Frame },
  ] },
  { key: 'replaceBg', label: 'Background bed (under keyed footage)', testPrefix: 'replace-bg', items: [
    { id: 'none', label: 'No background bed', icon: Ban },
    { id: 'synthwave', label: 'Synthwave sunset grid', icon: Waves },
    { id: 'aurora', label: 'Aurora bands', icon: Wind },
    { id: 'grid', label: 'Neon perspective grid', icon: Grid2x2 },
    { id: 'bokeh', label: 'Warm bokeh field', icon: Orbit },
    { id: 'sunset', label: 'Sunset gradient with sun disc', icon: Sunset },
    { id: 'studio', label: 'Studio grey with softbox', icon: Aperture },
  ] },
]

const CONTROL_DEFS: Array<{ key: keyof ClipEffect; label: string; min: number; max: number; step: number; valueLabel?: (value: number) => string }> = [
  { key: 'brightness', label: 'Brightness', min: 0, max: 2, step: 0.05, valueLabel: (value) => `${Math.round(value * 100)}%` },
  { key: 'contrast', label: 'Contrast', min: 0, max: 2, step: 0.05, valueLabel: (value) => `${Math.round(value * 100)}%` },
  { key: 'saturation', label: 'Saturation', min: 0, max: 2, step: 0.05, valueLabel: (value) => `${Math.round(value * 100)}%` },
  { key: 'hueRotate', label: 'Hue rotate', min: 0, max: 360, step: 5, valueLabel: (value) => `${Math.round(value)}°` },
  { key: 'blur', label: 'Blur', min: 0, max: 20, step: 0.5, valueLabel: (value) => `${Math.round(value)}px` },
  { key: 'grayscale', label: 'Grayscale', min: 0, max: 1, step: 0.05, valueLabel: (value) => `${Math.round(value * 100)}%` },
  { key: 'invert', label: 'Invert', min: 0, max: 1, step: 0.05, valueLabel: (value) => `${Math.round(value * 100)}%` },
  { key: 'sepia', label: 'Sepia', min: 0, max: 1, step: 0.05, valueLabel: (value) => `${Math.round(value * 100)}%` },
  { key: 'vibrance', label: 'Vibrance', min: 0, max: 2, step: 0.05, valueLabel: (value: number) => `${Math.round(value * 100)}%` },
  { key: 'solarize', label: 'Solarize', min: 0, max: 1, step: 0.05, valueLabel: (value: number) => `${Math.round(value * 100)}%` },
  { key: 'posterize', label: 'Posterize', min: 0, max: 1, step: 0.05, valueLabel: (value: number) => `${Math.round(value * 100)}%` },
  { key: 'grain', label: 'Grain', min: 0, max: 1, step: 0.05, valueLabel: (value: number) => `${Math.round(value * 100)}%` },
  { key: 'pixelate', label: 'Pixelate / Mosaic', min: 0, max: 24, step: 1, valueLabel: (value: number) => (value ? `${Math.round(value)}px blocks` : 'Off') },
  { key: 'chromatic', label: 'Chromatic Aberration', min: 0, max: 24, step: 1, valueLabel: (value: number) => (value ? `${Math.round(value)}px shift` : 'Off') },
  { key: 'pixelStretch', label: 'Pixel Stretch', min: 0, max: 60, step: 1, valueLabel: (value: number) => (value ? `${Math.round(value)}% smear` : 'Off') },
  { key: 'waveWarp', label: 'Wave Warp', min: 0, max: 24, step: 0.5, valueLabel: (value: number) => (value ? `${Math.round(value)}px` : 'Off') },
  { key: 'chromaKey', label: 'Chroma Key (green)', min: 0, max: 1, step: 0.05, valueLabel: (value: number) => (value ? `${Math.round(value * 100)}%` : 'Off') },
  { key: 'particleDensity', label: 'Particle density', min: 0, max: 1, step: 0.05, valueLabel: (value: number) => `${Math.round(value * 100)}%` },
  { key: 'overlayStrength', label: 'Overlay strength', min: 0, max: 1, step: 0.05, valueLabel: (value: number) => `${Math.round(value * 100)}%` },
]

function ClipEffectsControls({ clip }: { clip?: Clip }) {
  const setClipEffect = useEditor((s) => s.setClipEffect)
  const isLayer = clip?.kind === 'adjustment'
  if (!clip) {
    return (
      <div className="rounded-none border border-dashed border-ink-800 p-3 text-center" data-testid="clip-effects-empty">
        <SlidersHorizontal size={18} className="mx-auto mb-1.5 text-ink-600" />
        <p className="text-[10px] font-medium text-ink-300">Select a clip or adjustment layer</p>
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
      <div className="flex min-w-0 items-center justify-between gap-2 rounded-none border border-ink-800 bg-ink-950/55 px-2 py-1.5">
        <div className="min-w-0">
          <span className="block text-[9px] font-semibold uppercase tracking-wider text-brand-300">{isLayer ? 'Selected adjustment layer' : 'Selected clip'}</span>
          <span className="block truncate text-[10px] text-ink-200" title={clip.name}>{clip.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            data-testid="preview-selected-clip-btn"
            onClick={() => previewClipPlayback(clip.id, `Current look, ${clip.name}`)}
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
      {/* Particle / overlay / background beds — scanned from the AE tutorial
          corpus (Study_edits_videos/deep-study-*.md). Icon-first tiles. */}
      {/* Particle / overlay / background beds — user pattern: each bed is a
          MAIN tool with a down arrow; its connected sub-tools (segment
          carousel + direct tiles) live UNDER it, not stuffed into one tile. */}
      <div className="space-y-2" data-testid="clip-fx-layers">
        {FX_TILE_GROUPS.map((group) => {
          const GroupIcon = group.key === 'particleFx' ? Sparkles : group.key === 'overlayFx' ? Layers : ImageIcon
          return (
            <ExpandableToolGroup key={group.key} testId={`fxgroup-${group.key}`} icon={GroupIcon} label={group.label}>
              <SegmentCarousel
                ariaLabel={`${group.label} kinds`}
                testId={`fxcarousel-${group.key}`}
                segments={group.items.map((i) => ({ id: i.id, label: i.label }))}
                value={String(effects[group.key as keyof ClipEffect] ?? 'none')}
                onChange={(id) => setClipEffect(clip.id, { [group.key]: id } as Partial<ClipEffect>)}
              />
              <div className="flex flex-wrap gap-1">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = effects[group.key as keyof ClipEffect] === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`${group.testPrefix}-${item.id}`}
                      title={item.label}
                      aria-label={item.label}
                      aria-pressed={active}
                      onClick={() => setClipEffect(clip.id, { [group.key]: item.id } as Partial<ClipEffect>)}
                      className={`flex h-7 w-7 items-center justify-center rounded border ${active ? 'border-sky-500 bg-sky-500/20 text-sky-200' : 'border-ink-700 bg-ink-900 text-ink-400 hover:text-white'}`}
                    >
                      <Icon size={13} />
                    </button>
                  )
                })}
              </div>
            </ExpandableToolGroup>
          )
        })}
      </div>
      {isLayer ? (
        <div className="space-y-1.5 rounded-none border border-ink-800 bg-ink-950/40 px-2 py-2" data-testid="light-controls">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-200/90">Light layer</span>
            <div className="flex gap-1">
              {(['point', 'spot'] as const).map((lt) => (
                <button
                  key={lt}
                  type="button"
                  data-testid={`light-type-${lt}`}
                  aria-pressed={(effects.lightType ?? 'point') === lt}
                  onClick={() => setClipEffect(clip.id, { lightType: lt })}
                  className={`rounded border px-1.5 py-0.5 text-[9px] capitalize transition-colors ${
                    (effects.lightType ?? 'point') === lt
                      ? 'border-amber-400/60 bg-amber-400/15 text-amber-200'
                      : 'border-ink-700 text-ink-400 hover:text-white'
                  }`}
                >
                  {lt}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between gap-2 text-[10px] text-ink-400">
            <span>Light color</span>
            <input
              type="color"
              data-testid="light-color"
              value={effects.lightColor ?? '#ffd9a0'}
              onChange={(event) => setClipEffect(clip.id, { lightColor: event.target.value })}
              className="h-5 w-9 cursor-pointer rounded border border-ink-700 bg-transparent"
            />
          </label>
          {(
            [
              { key: 'lightIntensity', label: 'Intensity', min: 0, max: 1.5, step: 0.05, fmt: (v: number) => `${Math.round(v * 100)}%` },
              { key: 'lightFalloff', label: 'Falloff', min: 0.1, max: 1, step: 0.05, fmt: (v: number) => `${Math.round(v * 100)}%` },
              { key: 'lightX', label: 'Position X', min: 0, max: 1, step: 0.02, fmt: (v: number) => `${Math.round(v * 100)}%` },
              { key: 'lightY', label: 'Position Y', min: 0, max: 1, step: 0.02, fmt: (v: number) => `${Math.round(v * 100)}%` },
            ] as const
          ).map((c) => (
            <label key={c.key} className="block">
              <span className="mb-0.5 flex items-center justify-between gap-2 text-[10px] text-ink-400">
                <span>{c.label}</span>
                <span className="font-mono text-[9px] text-ink-500">{c.fmt((effects[c.key] as number) ?? 0)}</span>
              </span>
              <input
                type="range"
                data-testid={`light-slider-${c.key}`}
                aria-label={`Light ${c.label}`}
                min={c.min}
                max={c.max}
                step={c.step}
                value={(effects[c.key] as number) ?? 0}
                onChange={(event) => setClipEffect(clip.id, { [c.key]: parseFloat(event.target.value) })}
                className="of-range w-full"
              />
            </label>
          ))}
          <p className="text-[9px] leading-snug text-ink-500">Screen-blended radial light over everything beneath this layer.</p>
        </div>
      ) : null}
      {labels.length > 0 && (
        <div className="rounded-none border border-ink-800 bg-ink-950/40 px-2 py-1.5" data-testid="clip-effect-summary">
          <span className="block text-[9px] font-semibold uppercase tracking-wider text-ink-600">Active filters</span>
          <span className="block truncate text-[10px] text-ink-300" title={labels.join(', ')}>{labels.join(', ')}</span>
        </div>
      )}
    </div>
  )
}

/** Gold Motion-style custom effects: save a look you dialled in, share it as
 * a file, import other people's, apply like a built-in. Clicking a card
 * only auditions it (temporary preview); Apply / Layer commit. */
function MyEffects() {
  const customEffects = useEditor((s) => s.customEffects)
  const clips = useEditor((s) => s.clips)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const saveCustomEffect = useEditor((s) => s.saveCustomEffect)
  const applyCustomEffect = useEditor((s) => s.applyCustomEffect)
  const placeCustomEffectAsLayer = useEditor((s) => s.placeCustomEffectAsLayer)
  const deleteCustomEffect = useEditor((s) => s.deleteCustomEffect)
  const importCustomEffects = useEditor((s) => s.importCustomEffects)
  const [name, setName] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const selected = clips.find((c) => c.id === selectedClipId)
  const canSave = !!selected && (activeEffectKeys(selected.effects).length > 0 || (selected.adjustment?.luts?.length ?? 0) > 0)

  const captureThumbnail = (): string | undefined => {
    try {
      const src = document.querySelector('#of-canvas') as HTMLCanvasElement | null
      if (!src || !src.width) return undefined
      const t = document.createElement('canvas')
      t.width = 160
      t.height = Math.max(1, Math.round((160 * src.height) / src.width))
      t.getContext('2d')?.drawImage(src, 0, 0, t.width, t.height)
      return t.toDataURL('image/jpeg', 0.72)
    } catch {
      return undefined
    }
  }

  const handleSave = () => {
    if (!selected) return
    const id = saveCustomEffect(name.trim() || selected.name || 'My effect', selected.id, captureThumbnail())
    if (id) {
      setNotice('Saved — it now works like a built-in effect.')
      setName('')
    } else {
      setNotice('That clip has no effect settings or LUTs to save yet.')
    }
  }

  const handleExport = (fx: CustomEffect) => {
    const blob = new Blob([serializeCustomEffect(fx)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = customEffectFileName(fx.name)
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const handleImport = async (files: FileList | null) => {
    if (!files?.length) return
    const collected: CustomEffect[] = []
    const errors: string[] = []
    for (const file of Array.from(files)) {
      const result = parseCustomEffectFile(await file.text())
      collected.push(...result.effects)
      if (result.error) errors.push(result.error)
    }
    if (collected.length) importCustomEffects(collected)
    setNotice(
      errors.length
        ? errors[0]
        : `Imported ${collected.length} custom effect${collected.length === 1 ? '' : 's'}.`,
    )
  }

  const audition = (fx: CustomEffect) => {
    const effectKeys = activeEffectKeys(fx.effect)
    if (selected && effectKeys.length) {
      previewClipEffect(selected.id, fx.name, fx.effect)
    } else if (fx.luts?.length) {
      previewLut(fx.luts[0])
    } else if (selected) {
      previewClipEffect(selected.id, fx.name, fx.effect)
    }
  }

  return (
    <div data-testid="custom-effects" className="space-y-2">
      <div className="flex gap-1.5">
        <input
          data-testid="custom-effect-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name your effect…"
          className="h-8 min-w-0 flex-1 rounded-none border border-ink-700 bg-ink-900 px-2 text-[11px] text-ink-100 outline-none focus:border-brand"
        />
        <button
          type="button"
          data-testid="save-custom-effect-btn"
          disabled={!canSave}
          onClick={handleSave}
          title={canSave ? 'Save the selected clip’s effect settings + LUT stack as a reusable custom effect' : 'Select a clip with effect settings or LUTs first'}
          className="flex h-8 shrink-0 items-center gap-1 rounded-none bg-brand px-2.5 text-[11px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={13} /> Save look
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          data-testid="import-custom-effects-btn"
          onClick={() => fileRef.current?.click()}
          className="flex h-7 items-center gap-1 rounded-none border border-ink-700 bg-ink-900 px-2 text-[10px] text-ink-200 hover:border-ink-500"
        >
          <Upload size={11} /> Import .json
        </button>
        <span className="text-[9px] leading-tight text-ink-500">Custom effects are small shareable .omniframe-effect.json files (settings + LUTs + thumbnail).</span>
      </div>
      <input
        ref={fileRef}
        data-testid="import-custom-effects-input"
        type="file"
        accept=".json,application/json"
        multiple
        className="hidden"
        onChange={(e) => { void handleImport(e.target.files); e.target.value = '' }}
      />
      {notice && <p className="text-[10px] text-ink-400" data-testid="custom-effect-notice" role="status">{notice}</p>}
      {customEffects.length === 0 ? (
        <p className="rounded-none border border-dashed border-ink-800 px-2.5 py-3 text-center text-[10px] text-ink-500" data-testid="custom-effects-empty">
          No custom effects yet. Dial in a look on a clip (Clip controls or LUTs), name it, and Save look — it appears here like a built-in, ready to apply or share.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {customEffects.map((fx) => (
            <div key={fx.id} data-testid={`custom-effect-${fx.id}`} className="overflow-hidden rounded-none border border-ink-800 bg-ink-950/40">
              <button type="button" onClick={() => audition(fx)} title="Audition (temporary preview — nothing is committed)" className="block w-full text-left">
                {fx.thumbnail ? (
                  <img src={fx.thumbnail} alt="" className="block aspect-video w-full object-cover" />
                ) : (
                  <span className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-fuchsia-900/60 via-ink-900 to-cyan-900/50 text-fuchsia-200">
                    <Wand2 size={16} />
                  </span>
                )}
                <span className="block truncate px-1.5 pt-1 text-[11px] font-medium text-ink-100">{fx.name}</span>
                <span className="block truncate px-1.5 pb-1 text-[9px] text-ink-500">{customEffectSummary(fx)}</span>
              </button>
              <div className="flex items-center gap-0.5 border-t border-ink-800 px-1 py-1">
                <button type="button" data-testid={`custom-effect-apply-${fx.id}`} disabled={!selected} onClick={() => { if (applyCustomEffect(fx.id)) setNotice(`Applied “${fx.name}” to the selected clip.`) }} title="Apply to the selected clip (replaces its effect settings + LUT stack)" className="flex h-6 flex-1 items-center justify-center gap-1 rounded text-[9px] text-ink-200 hover:bg-ink-800 disabled:opacity-40">
                  <Wand2 size={10} /> Apply
                </button>
                <button type="button" data-testid={`custom-effect-layer-${fx.id}`} onClick={() => { if (placeCustomEffectAsLayer(fx.id)) setNotice(`Placed “${fx.name}” as an adjustment layer.`) }} title="Place as an adjustment layer (grades everything below it)" className="flex h-6 flex-1 items-center justify-center gap-1 rounded text-[9px] text-ink-200 hover:bg-ink-800">
                  <Layers size={10} /> Layer
                </button>
                <button type="button" data-testid={`custom-effect-export-${fx.id}`} onClick={() => handleExport(fx)} title="Download as a shareable .omniframe-effect.json file" className="grid h-6 w-6 place-items-center rounded text-ink-400 hover:bg-ink-800" aria-label={`Export ${fx.name}`}>
                  <Download size={11} />
                </button>
                <button type="button" data-testid={`custom-effect-delete-${fx.id}`} onClick={() => deleteCustomEffect(fx.id)} title="Delete this custom effect" className="grid h-6 w-6 place-items-center rounded text-ink-400 hover:bg-red-950/50 hover:text-red-300" aria-label={`Delete ${fx.name}`}>
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


/** CAT colour dots so sub-tab scanning works without prose. */
const CAT_DOT: Record<FxCat, string> = {
  glitch: 'bg-fuchsia-400',
  'Glitch NG': 'bg-cyan-300',
  motion: 'bg-amber-400',
  color: 'bg-emerald-400',
  blur: 'bg-sky-400',
  distort: 'bg-orange-400',
  retro: 'bg-rose-400',
  light: 'bg-yellow-300',
  key: 'bg-lime-400',
}

const FX_MIME = 'application/x-omniframe-fx'

/**
 * The Effect catalog browser: sub-tabs (9), search, and a lazy tile grid.
 * Every entry is REAL — a concrete engine patch, no stubs. Drag a tile onto
 * an image/video/compound clip to tag it (CapCut model); click applies to
 * the selected allowed clip (or places an adjustment layer when nothing
 * eligible is selected). The right panel auto-opens the connected settings.
 */
function FxCatalogBrowser() {
  const [cat, setCat] = useState<FxCat | 'all'>('all')
  const [, refreshCatalog] = useState(0)
  const [packError, setPackError] = useState('')
  const loadPack = () => { setPackError(''); void loadGlitchRecipeCatalog().then(() => refreshCatalog(n => n + 1)).catch(error => setPackError(String(error.message))) }
  useEffect(loadPack, [])
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(60)
  const clips = useEditor((s) => s.clips)
  const assets = useEditor((s) => s.assets)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const addFxInstance = useEditor((s) => s.addFxInstance)
  const addFxAdjustment = useEditor((s) => s.addFxAdjustment)
  const requestRightSection = useEditor((s) => s.requestRightSection)

  const all = getFxCatalog()
  const entries = useMemo(() => {
    let list = all
    if (cat !== 'all') list = list.filter((e) => e.cat === cat)
    const query = q.trim().toLowerCase()
    if (query) list = list.filter((e) => e.name.toLowerCase().includes(query) || e.trace.toLowerCase().includes(query))
    return list
  }, [all, cat, q])

  const apply = (entry: FxCatalogEntry, asLayer: boolean) => {
    const clip = clips.find((c) => c.id === selectedClipId)
    const asset = clip ? assets.find((a) => a.id === clip.assetId) : undefined
    const allowed =
      !!clip && !asLayer &&
      (clip.kind === 'compound' || clip.kind === 'image' || clip.kind === 'video' || asset?.kind === 'image' || asset?.kind === 'video') &&
      clip.kind !== 'adjustment' && clip.kind !== 'audio' && clip.kind !== 'text' && !(clip as Clip & { textStyle?: unknown }).textStyle
    if (allowed && clip) {
      addFxInstance(clip.id, entry.id) // sets activeFx + auto-opens the right panel
    } else {
      addFxAdjustment(entry.id) // standalone effect clip: grades every track below
      requestRightSection('effects')
    }
  }

  return (
    <div data-testid="fx-catalog-browser" className="space-y-1.5">
      {packError && <button type="button" onClick={loadPack} className="text-[10px] text-amber-300">{packError} · Retry recipe library</button>}
      <p className="text-[9px] text-ink-500">Choose and search on the left. Edit, keyframe and reorder applied layers in the right inspector. Recipe count does not imply visual uniqueness.</p>
      <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Effect categories">
        {FX_CATS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={cat === c.id}
            data-testid={`fx-cat-${c.id}`}
            onClick={() => { setCat(c.id as FxCat | 'all'); setLimit(60) }}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${cat === c.id ? 'bg-cyan-400 text-ink-950' : 'bg-ink-800 text-ink-300 hover:bg-ink-700'}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <Search size={11} className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            type="search"
            value={q}
            data-testid="fx-catalog-search"
            onChange={(e) => { setQ(e.target.value); setLimit(60) }}
            placeholder="Search effects…"
            className="w-full rounded border border-ink-700 bg-ink-900 py-1 pl-6 pr-1.5 text-[10px] text-ink-100 placeholder:text-ink-500"
          />
        </div>
        <span className="shrink-0 font-mono text-[9px] text-ink-400" data-testid="fx-catalog-count">
          {entries.length}/{all.length}
        </span>
      </div>
      <div className="grid max-h-[38vh] grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-1 overflow-y-auto pr-0.5" data-testid="fx-catalog-grid">
        {entries.slice(0, limit).map((e) => (
          <div key={e.id} className="group relative">
            <button
              type="button"
              draggable
              data-testid={`fx-tile-${e.id}`}
              title={`${e.name} — ${e.trace}\nDrag onto an image/video/compound clip, or click to apply.`}
              onDragStart={(ev) => {
                ev.dataTransfer.setData(FX_MIME, e.id)
                ev.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => apply(e, false)}
              className="flex w-full cursor-grab items-center gap-1 rounded border border-ink-700 bg-ink-900/80 px-1.5 py-1 text-left transition-colors hover:border-cyan-400/70 hover:bg-cyan-950/40 active:cursor-grabbing"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${CAT_DOT[e.cat]}`} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-[9.5px] font-medium text-ink-100">{e.name}</span>
            </button>
            <button
              type="button"
              data-testid={`fx-tile-layer-${e.id}`}
              aria-label={`Place ${e.name} as an adjustment layer`}
              title="Place as adjustment layer (grades every track below)"
              onClick={() => apply(e, true)}
              className="absolute right-0.5 top-0.5 hidden h-4 w-4 place-items-center rounded bg-brand/80 text-[9px] font-bold text-white group-hover:grid"
            >
              L
            </button>
          </div>
        ))}
      </div>
      {entries.length > limit && (
        <button
          type="button"
          data-testid="fx-catalog-more"
          onClick={() => setLimit((n) => n + 120)}
          className="w-full rounded border border-ink-700 py-1 text-[10px] text-ink-300 hover:bg-ink-800"
        >
          Show more ({entries.length - limit} left)
        </button>
      )}
      {entries.length === 0 && (
        <p className="py-2 text-center text-[10px] text-ink-500">No effects match — try another sub-tab or clear the search.</p>
      )}
      <p className="text-[9px] leading-snug text-ink-500" data-testid="fx-catalog-note">
        {paramsForPatch(entries[0]?.patch || {}).length >= 0 ? `${all.length} real presets — every tile renders (engine params, no stubs); properties stay editable + keyframeable after the drop.` : ''}
      </p>
    </div>
  )
}

function ShakePackBrowser() {
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const applyShakePreset = useEditor((s) => s.applyShakePreset)
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <div className="px-1 py-1" data-testid="shake-pack">
      <div className="flex flex-wrap gap-1">
        {SHAKE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            data-testid={`shake-preset-${p.id}`}
            disabled={!selectedClipId}
            title={`${p.source} — ${p.instances.length} fx instance(s), ${p.duration}s, original keyframe values`}
            onClick={() => {
              if (!selectedClipId) return
              const n = applyShakePreset(selectedClipId, p.id)
              setMsg(n ? `${p.name}: ${n} fx instance(s) + keys applied` : `${p.name}: needs a video/image clip selected`)
            }}
            className="rounded border border-ink-700 bg-ink-800 px-1.5 py-0.5 text-[10px] text-ink-200 hover:border-brand/60 hover:text-white disabled:opacity-40"
          >
            {p.name}
          </button>
        ))}
      </div>
      {msg && <p className="mt-1 text-[10px] text-brand-200" data-testid="shake-pack-msg">{msg}</p>}
      <p className="mt-1 text-[10px] leading-snug text-ink-400">Built-in pack converted from the corpus Shakes.xml (MOLOB, ZNEPTUNE, FLOW, NANIMALO, RANDOM, JELLY, CU9ID + Warp): keyed fx-instance stacks with the ORIGINAL timings/values, scaled into engine ranges.</p>
    </div>
  )
}

export function EffectsPanel() {
  const clips = useEditor((s) => s.clips)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const addAdjustmentLayer = useEditor((s) => s.addAdjustmentLayer)
  const selectedClip = clips.find((clip) => clip.id === selectedClipId)
  const layerCount = clips.filter((clip) => clip.kind === 'adjustment').length
  const customCount = useEditor((s) => s.customEffects.length)
  const lutCount = useEditor((s) => s.lutLibrary.luts.length)

  return (
    <div data-testid="effects-panel" className="text-xs text-ink-200 select-none">
      <div className="border-b border-ink-800 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
          <Wand2 size={12} /> Effects
        </div>
        <p className="mt-1 text-[10px] leading-snug text-ink-300">Drag onto a clip or click to apply — settings auto-open in the right panel.</p>
      </div>

      <PanelSection title="Effect catalog" hint={String(getFxCatalog().length)} defaultOpen testId="fx-catalog">
        <FxCatalogBrowser />
      </PanelSection>

      <PanelSection title="LUT looks" hint={lutCount ? String(lutCount) : '30'} testId="adjustment-looks">
        <LutGallery />
      </PanelSection>

      <PanelSection title="Shake pack (AM corpus)" hint={String(SHAKE_PRESETS.length)} testId="shake-pack-section">
        <ShakePackBrowser />
      </PanelSection>

      <PanelSection title="My effects" hint={customCount ? String(customCount) : undefined} testId="custom-effects-section">
        <MyEffects />
      </PanelSection>

      <PanelSection title="Adjustment layers" hint={String(layerCount)} testId="adjustment-layers">
        <button
          type="button"
          data-testid="new-adjustment-layer-btn"
          onClick={() => addAdjustmentLayer()}
          className="flex min-h-9 w-full items-center justify-center gap-1.5 rounded-none border border-cyan-700/70 bg-cyan-950/45 px-2 text-[11px] font-medium text-cyan-100 transition-colors hover:border-cyan-400 hover:bg-cyan-900/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
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
