import React, { useEffect, useRef } from 'react'
import { Wand2, Sliders, RotateCcw, Sparkles, Upload, Trash2, Layers, Power, X } from 'lucide-react'
import { useEditor } from '../store'
import type { ClipEffect, Clip } from '../types'
import { placedEffectLabels } from '../lib/adjustment'

/** LUT gallery: built-in tiles + uploads + the user's stored LUTs. */
function LutGallery() {
  const lutLibrary = useEditor((s) => s.lutLibrary)
  const userLuts = useEditor((s) => s.userLuts)
  const loadLutLibrary = useEditor((s) => s.loadLutLibrary)
  const placeLut = useEditor((s) => s.placeLut)
  const addUserLut = useEditor((s) => s.addUserLut)
  const removeUserLut = useEditor((s) => s.removeUserLut)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const clips = useEditor((s) => s.clips)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = React.useState<string | null>(null)

  useEffect(() => {
    loadLutLibrary()
  }, [loadLutLibrary])

  const selected = clips.find((c) => c.id === selectedClipId)
  const placementHint = selected
    ? `LUTs go INSIDE "${selected.name}" (only that clip is graded)`
    : 'Nothing selected — LUTs become an adjustment layer grading everything below it'

  const handleUploadAndPlace = async (files: FileList | null) => {
    if (!files?.length) return
    setUploadError(null)
    let placed = 0
    let failed = 0
    for (const file of Array.from(files)) {
      const text = await file.text()
      const name = file.name.replace(/\.cube$/i, '')
      const id = addUserLut(name, text)
      if (id) {
        placeLut({ name, cubeText: text })
        placed++
      } else {
        failed++
      }
    }
    if (failed) setUploadError(`${failed} file(s) were not valid .cube LUTs`)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div data-testid="lut-gallery" className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase text-ink-500 tracking-wider">
          LUTs ({lutLibrary.luts.length + userLuts.length})
        </span>
        <button
          type="button"
          data-testid="upload-lut-btn"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-ink-800 hover:bg-ink-700 text-[10px] text-ink-400 hover:text-white transition-colors"
        >
          <Upload size={10} />
          <span>Upload .cube</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".cube,text/plain"
          multiple
          className="hidden"
          data-testid="upload-lut-input"
          onChange={(e) => handleUploadAndPlace(e.target.files)}
        />
      </div>
      <p className="text-[10px] text-ink-500 leading-snug" data-testid="lut-placement-hint">
        {placementHint}
      </p>
      {!lutLibrary.loaded && (
        <p className="text-[10px] text-ink-600">Loading built-in LUTs…</p>
      )}
      <div className="grid grid-cols-3 gap-1.5">
        {lutLibrary.luts.map((lut) => (
          <button
            key={lut.id}
            type="button"
            data-testid={`lut-tile-${lut.id}`}
            title={`${lut.name} — ${lut.description}`}
            aria-label={`Place LUT ${lut.name}`}
            onClick={() => placeLut({ name: lut.name, builtin: lut.id })}
            className="group rounded-md border border-ink-800 hover:border-brand overflow-hidden text-left transition-colors"
          >
            <span
              className="block h-8 w-full"
              style={{
                background: `linear-gradient(135deg, ${lut.swatch} 0%, rgba(10,12,18,.9) 130%)`,
              }}
            />
            <span className="block px-1 py-1 text-[10px] text-ink-300 group-hover:text-white truncate">
              {lut.name}
            </span>
          </button>
        ))}
        {userLuts.map((lut) => (
          <button
            key={lut.id}
            type="button"
            data-testid={`lut-tile-user-${lut.id}`}
            title={`Uploaded LUT ${lut.name}`}
            onClick={() => placeLut({ name: lut.name, cubeText: lut.cubeText })}
            className="group relative rounded-md border border-emerald-900 hover:border-emerald-400 overflow-hidden text-left transition-colors"
          >
            <span className="block h-8 w-full bg-gradient-to-br from-emerald-800/70 to-ink-900" />
            <span className="block px-1 py-1 text-[10px] text-ink-300 group-hover:text-white truncate pr-4">
              {lut.name}
            </span>
            <span
              role="button"
              tabIndex={-1}
              aria-label={`Delete uploaded LUT ${lut.name}`}
              className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/60 text-ink-400 hover:text-red-300 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                removeUserLut(lut.id)
              }}
            >
              <X size={9} />
            </span>
          </button>
        ))}
      </div>
      {uploadError && (
        <p className="text-[10px] text-red-400" data-testid="lut-upload-error">
          {uploadError}
        </p>
      )}
    </div>
  )
}

/** List of every adjustment layer + clip carrying placed LUTs. */
function PlacedAdjustments() {
  const clips = useEditor((s) => s.clips)
  const tracks = useEditor((s) => s.tracks)
  const sequences = useEditor((s) => s.sequences)
  const selectClip = useEditor((s) => s.selectClip)
  const setLutIntensity = useEditor((s) => s.setLutIntensity)
  const toggleLutEnabled = useEditor((s) => s.toggleLutEnabled)
  const removeLutFromClip = useEditor((s) => s.removeLutFromClip)
  const removeClip = useEditor((s) => s.removeClip)
  const selectedClipId = useEditor((s) => s.selectedClipId)

  const carriers = clips.filter(
    (c) => c.kind === 'adjustment' || (c.adjustment?.luts?.length ?? 0) > 0,
  )
  if (!carriers.length) return null

  return (
    <div data-testid="placed-adjustments" className="space-y-1.5">
      <span className="text-[10px] font-semibold uppercase text-ink-500 tracking-wider">
        Placed Adjustment Layers ({carriers.length})
      </span>
      {carriers.map((clip) => {
        const labels = placedEffectLabels(clip, sequences)
        const trackName = tracks.find((t) => t.id === clip.trackId)?.name || 'Track'
        const isSel = clip.id === selectedClipId
        return (
          <div
            key={clip.id}
            data-testid={`placed-adjustment-${clip.id}`}
            data-selected={isSel ? 'true' : 'false'}
            className={`rounded-md border p-1.5 space-y-1 transition-colors ${
              isSel ? 'border-cyan-400/70 bg-cyan-950/30' : 'border-ink-800 hover:border-ink-600'
            }`}
          >
            <button
              type="button"
              onClick={() => selectClip(clip.id)}
              className="w-full flex items-center gap-1 text-left"
              title="Select this layer (shows its border on the timeline)"
            >
              <Sliders size={10} className="text-cyan-300 shrink-0" />
              <span className="truncate text-[11px] text-ink-200 flex-1">{clip.name}</span>
              {clip.kind === 'adjustment' && (
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Delete adjustment layer ${clip.name}`}
                  className="p-0.5 rounded text-ink-500 hover:text-red-300"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeClip(clip.id)
                  }}
                >
                  <Trash2 size={10} />
                </span>
              )}
            </button>
            <div className="text-[9px] text-ink-600 pl-3.5">
              {trackName} · {clip.start.toFixed(1)}s→{(clip.start + clip.duration).toFixed(1)}s
              {labels.length ? ` · ${labels.join(', ')}` : ''}
            </div>
            {(clip.adjustment?.luts?.length ?? 0) > 0 && (
              <div className="space-y-1 pl-1">
                {clip.adjustment!.luts.map((lut) => (
                  <div key={lut.id} data-testid={`placed-lut-${lut.id}`} className="flex items-center gap-1">
                    <button
                      type="button"
                      data-testid={`lut-power-${lut.id}`}
                      title={lut.enabled ? 'Disable LUT' : 'Enable LUT'}
                      onClick={() => toggleLutEnabled(clip.id, lut.id)}
                      className={`p-0.5 rounded ${lut.enabled ? 'text-emerald-300' : 'text-ink-600'}`}
                    >
                      <Power size={10} />
                    </button>
                    <span
                      className={`flex-1 truncate text-[10px] ${lut.enabled ? 'text-ink-200' : 'text-ink-600 line-through'}`}
                      title={`${lut.name} — click to re-select its layer`}
                      onClick={() => selectClip(clip.id)}
                    >
                      {lut.name}
                    </span>
                    <input
                      type="range"
                      data-testid={`lut-intensity-${lut.id}`}
                      min={0}
                      max={1}
                      step={0.05}
                      value={lut.intensity}
                      aria-label={`Intensity of ${lut.name}`}
                      onChange={(e) => setLutIntensity(clip.id, lut.id, parseFloat(e.target.value))}
                      className="of-range w-16"
                    />
                    <span className="w-7 text-right text-[9px] text-ink-500 tabular-nums">
                      {Math.round(lut.intensity * 100)}%
                    </span>
                    <button
                      type="button"
                      data-testid={`lut-remove-${lut.id}`}
                      title={`Remove ${lut.name}`}
                      aria-label={`Remove LUT ${lut.name}`}
                      onClick={() => removeLutFromClip(clip.id, lut.id)}
                      className="p-0.5 rounded text-ink-500 hover:text-red-300"
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

/** Effect layers: place filter effects as clip-format layers affecting below. */
function EffectLayerButtons() {
  const placeEffectAsLayer = useEditor((s) => s.placeEffectAsLayer)
  const layers: Array<{ id: string; label: string; effect: ClipEffect }> = [
    { id: 'blur', label: 'Blur Layer', effect: { blur: 6 } },
    { id: 'bw', label: 'B&W Layer', effect: { grayscale: 1, contrast: 1.15 } },
    { id: 'invert', label: 'Invert Layer', effect: { invert: 1 } },
    { id: 'brighten', label: 'Brighten Layer', effect: { brightness: 1.25 } },
    { id: 'darken', label: 'Darken Layer', effect: { brightness: 0.75, contrast: 1.1 } },
    { id: 'sharpenwarm', label: 'Warm Layer', effect: { saturation: 1.2, brightness: 1.05 } },
  ]
  return (
    <div className="space-y-1.5">
      <span className="text-[10px] font-semibold uppercase text-ink-500 tracking-wider">
        Effect Layers (affect everything below)
      </span>
      <div className="grid grid-cols-2 gap-1.5">
        {layers.map((l) => (
          <button
            key={l.id}
            type="button"
            data-testid={`effect-layer-${l.id}`}
            onClick={() => placeEffectAsLayer(l.label, l.effect)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-ink-900 border border-ink-800 hover:border-cyan-500 text-[11px] text-ink-300 hover:text-white transition-colors text-left truncate"
          >
            <Layers size={10} className="text-cyan-400 shrink-0" />
            <span className="truncate">{l.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function EffectsPanel() {
  const clips = useEditor((s) => s.clips)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const selectClip = useEditor((s) => s.selectClip)
  const setClipEffect = useEditor((s) => s.setClipEffect)
  const playhead = useEditor((s) => s.playhead)

  // Find selected clip or active clip under playhead, or first clip
  const clipUnderPlayhead = clips.find((c) => playhead >= c.start && playhead <= c.start + c.duration)
  const activeClip = clips.find((c) => c.id === selectedClipId) || clipUnderPlayhead || clips[0]

  const effects: ClipEffect = activeClip?.effects || {
    brightness: 1,
    contrast: 1,
    saturation: 1,
    blur: 0,
    grayscale: 0,
    invert: 0,
    sepia: 0,
    hueRotate: 0,
  }

  const handleChange = (key: keyof ClipEffect, val: number) => {
    if (!activeClip) return
    if (selectedClipId !== activeClip.id) {
      selectClip(activeClip.id)
    }
    setClipEffect(activeClip.id, { [key]: val })
  }

  const handleReset = () => {
    if (!activeClip) return
    setClipEffect(activeClip.id, {
      brightness: 1,
      contrast: 1,
      saturation: 1,
      blur: 0,
      grayscale: 0,
      invert: 0,
      sepia: 0,
      hueRotate: 0,
    })
  }

  const applyPreset = (preset: 'cinematic' | 'noir' | 'vintage' | 'warm' | 'cyberpunk' | 'invert') => {
    if (!activeClip) return
    if (selectedClipId !== activeClip.id) {
      selectClip(activeClip.id)
    }
    if (preset === 'cinematic') {
      setClipEffect(activeClip.id, { contrast: 1.25, saturation: 1.15, brightness: 0.95, sepia: 0.1, hueRotate: 0 })
    } else if (preset === 'noir') {
      setClipEffect(activeClip.id, { grayscale: 1, contrast: 1.4, brightness: 0.9, sepia: 0, hueRotate: 0 })
    } else if (preset === 'vintage') {
      setClipEffect(activeClip.id, { sepia: 0.6, contrast: 0.9, brightness: 1.05, hueRotate: 0 })
    } else if (preset === 'warm') {
      setClipEffect(activeClip.id, { brightness: 1.05, saturation: 1.25, sepia: 0.25, hueRotate: 0 })
    } else if (preset === 'cyberpunk') {
      setClipEffect(activeClip.id, { hueRotate: 280, contrast: 1.35, saturation: 1.45, brightness: 1.0 })
    } else if (preset === 'invert') {
      setClipEffect(activeClip.id, { invert: 1, contrast: 1.2, brightness: 1.0 })
    }
  }

  if (!activeClip) {
    return (
      <div data-testid="effects-panel" className="p-3 text-xs text-ink-200 select-none space-y-3">
        <div className="text-center py-2">
          <Wand2 size={24} className="mx-auto mb-2 opacity-40 text-ink-400" />
          <p className="font-medium text-ink-300">No media clips</p>
          <p className="text-[11px] text-ink-500 mt-1">
            LUTs and effect layers below still work — they become adjustment layers on the timeline.
          </p>
        </div>
        <LutGallery />
        <EffectLayerButtons />
      </div>
    )
  }

  return (
    <div data-testid="effects-panel" className="p-3 text-xs text-ink-200 select-none space-y-3">
      {/* Target clip badge & Reset */}
      <div className="flex items-center justify-between pb-2 border-b border-ink-800">
        <div className="min-w-0 pr-2">
          <span className="text-[10px] text-brand-400 uppercase tracking-wider font-semibold block">Target Clip</span>
          <span className="font-medium text-ink-100 truncate block text-[11px]" title={activeClip.name}>{activeClip.name}</span>
        </div>
        <button
          type="button"
          data-testid="reset-effects-btn"
          onClick={handleReset}
          title="Reset effects"
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-ink-800 hover:bg-ink-700 text-[10px] text-ink-400 hover:text-white transition-colors"
        >
          <RotateCcw size={10} />
          <span>Reset</span>
        </button>
      </div>

      {/* LUT gallery + uploads */}
      <LutGallery />

      {/* Effect layers (clip-format layers affecting everything below) */}
      <EffectLayerButtons />

      {/* Placed adjustment layers with intensity controls */}
      <PlacedAdjustments />

      {/* Quick Color Presets */}
      <div className="pt-2 border-t border-ink-800">
        <span className="text-[10px] font-semibold uppercase text-ink-500 tracking-wider block mb-1.5">
          Stylistic Color Presets
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: 'cinematic', label: 'Cinematic' },
            { id: 'noir', label: 'Film Noir (B&W)' },
            { id: 'vintage', label: 'Vintage 70s' },
            { id: 'warm', label: 'Golden Hour' },
            { id: 'cyberpunk', label: 'Cyberpunk' },
            { id: 'invert', label: 'Invert / X Ray' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              data-testid={`effect-preset-${p.id}`}
              title={`Apply ${p.label} preset`}
              aria-label={`Apply ${p.label} preset`}
              onClick={() => applyPreset(p.id as any)}
              className="px-2 py-1.5 rounded-md bg-ink-900 border border-ink-800 hover:border-brand text-[11px] text-ink-300 hover:text-white transition-colors text-left truncate"
            >
              <span className="truncate">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-2 pt-1 border-t border-ink-800">
        <div>
          <div className="flex justify-between text-[11px] text-ink-400 mb-1">
            <span>Brightness</span>
            <span className="font-mono">{Math.round((effects.brightness ?? 1) * 100)}%</span>
          </div>
          <input
            type="range"
            data-testid="effect-slider-brightness"
            aria-label="Brightness"
            min={0}
            max={2}
            step={0.05}
            value={effects.brightness ?? 1}
            onChange={(e) => handleChange('brightness', parseFloat(e.target.value))}
            className="of-range w-full"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-ink-400 mb-1">
            <span>Contrast</span>
            <span className="font-mono">{Math.round((effects.contrast ?? 1) * 100)}%</span>
          </div>
          <input
            type="range"
            data-testid="effect-slider-contrast"
            aria-label="Contrast"
            min={0}
            max={2}
            step={0.05}
            value={effects.contrast ?? 1}
            onChange={(e) => handleChange('contrast', parseFloat(e.target.value))}
            className="of-range w-full"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-ink-400 mb-1">
            <span>Saturation</span>
            <span className="font-mono">{Math.round((effects.saturation ?? 1) * 100)}%</span>
          </div>
          <input
            type="range"
            data-testid="effect-slider-saturation"
            aria-label="Saturation"
            min={0}
            max={2}
            step={0.05}
            value={effects.saturation ?? 1}
            onChange={(e) => handleChange('saturation', parseFloat(e.target.value))}
            className="of-range w-full"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-ink-400 mb-1">
            <span>Hue Rotate</span>
            <span className="font-mono">{effects.hueRotate ?? 0}&deg;</span>
          </div>
          <input
            type="range"
            data-testid="effect-slider-huerotate"
            aria-label="Hue rotate"
            min={0}
            max={360}
            step={5}
            value={effects.hueRotate ?? 0}
            onChange={(e) => handleChange('hueRotate', parseFloat(e.target.value))}
            className="of-range w-full"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-ink-400 mb-1">
            <span>Blur</span>
            <span className="font-mono">{effects.blur ?? 0}px</span>
          </div>
          <input
            type="range"
            data-testid="effect-slider-blur"
            aria-label="Blur"
            min={0}
            max={20}
            step={0.5}
            value={effects.blur ?? 0}
            onChange={(e) => handleChange('blur', parseFloat(e.target.value))}
            className="of-range w-full"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-ink-400 mb-1">
            <span>Grayscale</span>
            <span className="font-mono">{Math.round((effects.grayscale ?? 0) * 100)}%</span>
          </div>
          <input
            type="range"
            data-testid="effect-slider-grayscale"
            aria-label="Grayscale"
            min={0}
            max={1}
            step={0.05}
            value={effects.grayscale ?? 0}
            onChange={(e) => handleChange('grayscale', parseFloat(e.target.value))}
            className="of-range w-full"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-ink-400 mb-1">
            <span>Invert</span>
            <span className="font-mono">{Math.round((effects.invert ?? 0) * 100)}%</span>
          </div>
          <input
            type="range"
            data-testid="effect-slider-invert"
            min={0}
            max={1}
            step={0.05}
            value={effects.invert ?? 0}
            onChange={(e) => handleChange('invert', parseFloat(e.target.value))}
            className="of-range w-full"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-ink-400 mb-1">
            <span>Sepia</span>
            <span className="font-mono">{Math.round((effects.sepia ?? 0) * 100)}%</span>
          </div>
          <input
            type="range"
            data-testid="effect-slider-sepia"
            aria-label="Sepia"
            min={0}
            max={1}
            step={0.05}
            value={effects.sepia ?? 0}
            onChange={(e) => handleChange('sepia', parseFloat(e.target.value))}
            className="of-range w-full"
          />
        </div>
      </div>
    </div>
  )
}
