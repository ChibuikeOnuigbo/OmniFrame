import React, { useEffect, useRef, useState } from 'react'
import ExpandableToolGroup from './ExpandableToolGroup'
import { SPEED_CURVES, type SpeedCurveId } from '../lib/speedCurves'
import { mcpLog, omniMcpCall, OMNI_MCP_CATALOG } from '../lib/mcpBridge'
import SegmentCarousel from './SegmentCarousel'
import {
  Activity,
  AudioLines,
  Columns2,
  Diamond,
  Eraser,
  Feather,
  FileVideo,
  Flame,
  FlipHorizontal2,
  FlipVertical2,
  FolderOpen,
  FolderOutput,
  Grid3x3,
  Layers,
  Lightbulb,
  Palette,
  PanelRight,
  PanelRightClose,
  PanelRightOpen,
  PenTool,
  PictureInPicture2,
  Rainbow,
  Scaling,
  Scan,
  ScanFace,
  ScanLine,
  Scissors,
  Settings2,
  Shapes,
  Slice,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Tv,
  Type,
  Volume2,
  Wand2,
  Waves,
  X,
  Gauge,
} from 'lucide-react'
import { BlenderRotationIcon } from './icons/BlenderRotationIcon'
import { SelectionMaskSubTool } from './SelectionMaskSubTool'
import { SmartPatchSubTool } from './SmartPatchSubTool'
import { RotoMaskSubTool } from './RotoMaskSubTool'
import { Tooltip } from './Tooltip'
import { InfoTip } from './InfoTip'
import { useEditor } from '../store'
import type { Clip, ClipAdjustmentMask, ClipEffect, ClipVisualMask } from '../types'
import { Field, Section, Slider, AccordionGroup } from './ui'
import { formatClock } from '../lib/time'
import { executeVoiceIsolationForClip, type VoiceIsolationModel } from '../lib/voiceIsolation'
import { isDemucsModelAvailable } from '../lib/demucs/index.ts'
import { loudnessGain, measureIntegratedLufs } from '../lib/loudness'
import { SectionsNavigator } from './SectionsNav'
import { placedEffectLabels, activeEffectKeys } from '../lib/adjustment'

/**
 * "Placed Effects" inspector section: every LUT / effect placed on the
 * selected clip (its own grade + nested adjustment layers for compounds).
 * Clicking a listed LUT re-selects the clip, which re-shows its blue
 * timeline border.
 */
function PlacedEffectsSection({ clip }: { clip: Clip }) {
  const sequences = useEditor((s) => s.sequences)
  const selectClip = useEditor((s) => s.selectClip)
  const setLutIntensity = useEditor((s) => s.setLutIntensity)
  const toggleLutEnabled = useEditor((s) => s.toggleLutEnabled)
  const removeLutFromClip = useEditor((s) => s.removeLutFromClip)

  const labels = placedEffectLabels(clip, sequences)
  const ownLuts = clip.adjustment?.luts || []
  const effectKeys = activeEffectKeys(clip.effects)
  const nested: Clip[] =
    clip.kind === 'compound'
      ? (() => {
          const seq = sequences.find((s) => s.id === clip.sourceSequenceId)
          return seq ? seq.clips : clip.originalChildClips || []
        })().filter((c) => c.kind === 'adjustment')
      : []

  if (!labels.length && clip.kind !== 'adjustment') return null

  return (
    <Section title="Placed Effects">
      {labels.length === 0 && clip.kind === 'adjustment' && (
        <p className="text-[11px] text-ink-500">Empty adjustment layer. Add a LUT or effect from the Adjustments panel; it will grade the composite below this track.</p>
      )}
      {effectKeys.length > 0 && (
        <Field label="Clip effects">
          <span className="text-[11px] text-ink-300">{effectKeys.map((k) => k.replace(/([A-Z])/g, ' $1')).join(', ')}</span>
        </Field>
      )}
      {ownLuts.map((lut) => (
        <div key={lut.id} data-testid={`inspector-lut-${lut.id}`} className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid={`inspector-lut-power-${lut.id}`}
            title={lut.enabled ? 'Disable' : 'Enable'}
            aria-label={`Toggle ${lut.name}`}
            onClick={() => toggleLutEnabled(clip.id, lut.id)}
            className={`p-0.5 rounded ${lut.enabled ? 'text-emerald-300' : 'text-ink-600'}`}
          >
            <Activity size={11} />
          </button>
          <button
            type="button"
            className="flex-1 min-w-0 truncate text-left text-[11px] text-ink-200 hover:text-white"
            title={`${lut.name} — click to re-show the timeline border`}
            onClick={() => selectClip(clip.id)}
          >
            {lut.name}
          </button>
          <input
            type="range"
            data-testid={`inspector-lut-intensity-${lut.id}`}
            min={0}
            max={1}
            step={0.05}
            value={lut.intensity}
            aria-label={`Intensity of ${lut.name}`}
            onChange={(e) => setLutIntensity(clip.id, lut.id, parseFloat(e.target.value))}
            className="of-range w-20"
          />
          <span className="w-8 text-right text-[10px] text-ink-400 tabular-nums">{Math.round(lut.intensity * 100)}%</span>
          <button
            type="button"
            data-testid={`inspector-lut-remove-${lut.id}`}
            aria-label={`Remove ${lut.name}`}
            title={`Remove ${lut.name}`}
            onClick={() => removeLutFromClip(clip.id, lut.id)}
            className="p-0.5 rounded text-ink-500 hover:text-red-300"
          >
            <Trash2 size={11} />
          </button>
        </div>
      ))}
      {nested.map((layer) => {
        const inner = [
          ...activeEffectKeys(layer.effects).map((k) => k),
          ...(layer.adjustment?.luts || []).map((l) => l.name),
        ]
        return (
          <div key={layer.id} data-testid={`inspector-nested-${layer.id}`} className="flex items-center gap-1.5">
            <Diamond size={10} className="text-cyan-300 shrink-0" />
            <button
              type="button"
              className="flex-1 min-w-0 truncate text-left text-[11px] text-ink-200 hover:text-white"
              title="Nested adjustment layer — click to select it"
              onClick={() => selectClip(layer.id)}
            >
              {layer.name}
            </button>
            <span className="text-[10px] text-ink-500 truncate max-w-[45%]">{inner.join(', ')}</span>
          </div>
        )
      })}
    </Section>
  )
}

/**
 * Mask inspector section: the CapCut/AE-style clip visibility mask. This is
 * deliberately separate from selection/roto "masking" (OmniFrame/RotoMask)
 * and from the adjustment-layer Effect Mask: it hides part of the selected
 * clip itself — Inside keeps only the region, Outside keeps frame − region.
 */
function ClipMaskSection({ clip }: { clip: Clip }) {
  const playhead = useEditor((s) => s.playhead)
  // Uploaded mask fonts persist on this device (desktop keeps them in
  // local storage; the web build keeps them for this browser profile).
  const projectFonts = useEditor((s) => s.customFonts)
  const [customFonts, setCustomFonts] = useState<string[]>(() => {
    try {
      return (JSON.parse(localStorage.getItem('omniframe.customFonts') || '[]') as { name: string }[]).map((f) => f.name)
    } catch { return [] }
  })
  useEffect(() => {
    try {
      const list = JSON.parse(localStorage.getItem('omniframe.customFonts') || '[]') as { name: string; dataUrl: string }[]
      for (const f of list) {
        const face = new FontFace(f.name, `url(${f.dataUrl})`)
        void face.load().then((loaded) => document.fonts.add(loaded)).catch(() => undefined)
      }
    } catch { /* no stored fonts */ }
  }, [])
  const uploadMaskFont = async (file: File, clipId: string) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = reject
      r.readAsDataURL(file)
    })
    const name = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[^a-zA-Z0-9 -]/g, ' ').trim() || 'Custom Font'
    try {
      const list = JSON.parse(localStorage.getItem('omniframe.customFonts') || '[]') as { name: string; dataUrl: string }[]
      localStorage.setItem('omniframe.customFonts', JSON.stringify([...list.filter((f) => f.name !== name), { name, dataUrl }]))
    } catch { /* storage full/blocked: font still applies this session */ }
    try {
      const face = new FontFace(name, `url(${dataUrl})`)
      document.fonts.add(await face.load())
    } catch { /* renderer falls back to sans for this session */ }
    setCustomFonts((prev) => [...new Set([...prev, name])])
    updateClipMask(clipId, { kind: 'text', fontFamily: name })
  }
  const addClipMask = useEditor((s) => s.addClipMask)
  const updateClipMask = useEditor((s) => s.updateClipMask)
  const removeClipMask = useEditor((s) => s.removeClipMask)
  const maskEditClipId = useEditor((s) => s.maskEditClipId)
  const setMaskEditClip = useEditor((s) => s.setMaskEditClip)
  const activeSelection = useEditor((s) => s.activeSelection)
  const mask = clip.mask
  const drawing = maskEditClipId === clip.id

  return (
    <Section title="Video Mask View">
      {!mask ? (
        <div className="space-y-1.5">
          <button
            type="button"
            data-testid="add-clip-mask-btn"
            onClick={() => addClipMask(clip.id)}
            className="flex h-8 w-full items-center justify-center rounded-md border border-teal-800 bg-teal-950/30 text-xs text-teal-100 transition-colors hover:border-teal-500"
          >
            Add mask — hide part of this clip
          </button>
          <p className="text-[10px] leading-snug text-ink-500">
            Shows or hides a region of this image/video (like CapCut / After Effects masks). Not the selection or roto masking tools.
          </p>
        </div>
      ) : (
        <div data-testid="clip-mask-controls" className="space-y-1.5">
          <div className="flex items-center gap-1" role="group" aria-label="Mask mode">
            <button
              type="button"
              data-testid="mask-mode-inside-btn"
              aria-pressed={!mask.inverted}
              title="Keep only the masked region visible"
              onClick={() => updateClipMask(clip.id, { inverted: false })}
              className={`h-7 flex-1 rounded border text-[11px] ${!mask.inverted ? 'border-teal-500 bg-teal-950/50 text-teal-100' : 'border-ink-700 text-ink-400 hover:text-ink-100'}`}
            >
              Inside
            </button>
            <button
              type="button"
              data-testid="mask-mode-outside-btn"
              aria-pressed={mask.inverted}
              title="Keep everything except the masked region (frame minus mask)"
              onClick={() => updateClipMask(clip.id, { inverted: true })}
              className={`h-7 flex-1 rounded border text-[11px] ${mask.inverted ? 'border-teal-500 bg-teal-950/50 text-teal-100' : 'border-ink-700 text-ink-400 hover:text-ink-100'}`}
            >
              Outside
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="clip-mask-shape" className="text-xs text-ink-400">Shape</label>
            <select
              id="clip-mask-shape"
              data-testid="clip-mask-shape"
              value={mask.shape}
              onChange={(event) => updateClipMask(clip.id, { shape: event.target.value as ClipVisualMask['shape'] })}
              className="h-7 rounded border border-ink-700 bg-ink-900 px-2 text-[11px] text-ink-100"
            >
              <option value="ellipse">Ellipse</option>
              <option value="rectangle">Rectangle</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-ink-300">
            <input
              type="checkbox"
              data-testid="clip-mask-enabled"
              checked={mask.enabled}
              onChange={(event) => updateClipMask(clip.id, { enabled: event.target.checked })}
              className="accent-teal-400"
            />
            Mask enabled
          </label>
          <Field label="Center X">
            <Slider label="Mask center X" min={0} max={1} step={0.01} value={mask.centerX} onChange={(value) => updateClipMask(clip.id, { centerX: value })} />
            <span className="w-9 text-right text-[10px] text-ink-400 tabular-nums">{Math.round(mask.centerX * 100)}%</span>
          </Field>
          <Field label="Center Y">
            <Slider label="Mask center Y" min={0} max={1} step={0.01} value={mask.centerY} onChange={(value) => updateClipMask(clip.id, { centerY: value })} />
            <span className="w-9 text-right text-[10px] text-ink-400 tabular-nums">{Math.round(mask.centerY * 100)}%</span>
          </Field>
          <Field label="Width">
            <Slider label="Mask width" min={0.02} max={1} step={0.01} value={mask.width} onChange={(value) => updateClipMask(clip.id, { width: value })} />
            <span className="w-9 text-right text-[10px] text-ink-400 tabular-nums">{Math.round(mask.width * 100)}%</span>
          </Field>
          <Field label="Height">
            <Slider label="Mask height" min={0.02} max={1} step={0.01} value={mask.height} onChange={(value) => updateClipMask(clip.id, { height: value })} />
            <span className="w-9 text-right text-[10px] text-ink-400 tabular-nums">{Math.round(mask.height * 100)}%</span>
          </Field>
          <Field label="Rotation">
            <Slider label="Mask rotation" min={-180} max={180} step={1} value={mask.rotation} onChange={(value) => updateClipMask(clip.id, { rotation: value })} />
            <span className="w-9 text-right text-[10px] text-ink-400 tabular-nums">{Math.round(mask.rotation)}°</span>
          </Field>
          <Field label="Feather">
            <Slider label="Mask feather" min={0} max={240} step={2} value={mask.feather} onChange={(value) => updateClipMask(clip.id, { feather: value })} />
            <span className="w-9 text-right text-[10px] text-ink-400 tabular-nums">{Math.round(mask.feather)}px</span>
          </Field>
          <Field label="Expand">
            <Slider label="Mask expansion" min={-120} max={120} step={2} value={mask.expansion} onChange={(value) => updateClipMask(clip.id, { expansion: value })} />
            <span className="w-9 text-right text-[10px] text-ink-400 tabular-nums">{Math.round(mask.expansion)}px</span>
          </Field>
          <Field label="Opacity">
            <Slider label="Mask opacity" min={0} max={1} step={0.01} value={mask.opacity} onChange={(value) => updateClipMask(clip.id, { opacity: value })} />
            <span className="w-9 text-right text-[10px] text-ink-400 tabular-nums">{Math.round(mask.opacity * 100)}%</span>
          </Field>
          {/* Video Mask View kind: icon-first, names in tooltips. */}
          <div className="flex items-center gap-1" role="group" aria-label="Mask view kind">
            {([
              { id: 'shape', label: 'Shape view (rectangle / ellipse)', icon: Square },
              { id: 'split', label: 'Split view (infinite line)', icon: Columns2 },
              { id: 'custom', label: 'Custom shape view', icon: PenTool },
              { id: 'text', label: 'Text view', icon: Type },
            ] as const).map((k) => {
              const Icon = k.icon
              const on = (mask.kind || 'shape') === k.id
              return (
                <Tooltip key={k.id} label={k.label}>
                  <button
                    type="button"
                    data-testid={`mask-view-kind-${k.id}`}
                    aria-label={k.label}
                    aria-pressed={on}
                    onClick={() => updateClipMask(clip.id, { kind: k.id })}
                    className={`grid h-7 w-7 place-items-center rounded-md border transition-colors ${on ? 'border-teal-400 bg-teal-950/50 text-teal-200' : 'border-ink-700 text-ink-400 hover:text-white'}`}
                  >
                    <Icon size={13} />
                  </button>
                </Tooltip>
              )
            })}
            <InfoTip label="The mask is the clip's view window: the editor treats the output as a new video with the view's dimensions. Include keeps the inside; Exclude keeps frame minus inside. Split is an infinite rotatable line; Text uses any font, including uploaded ones." />
          </div>
          {(mask.kind || 'shape') === 'split' && (
            <div className="space-y-1.5" data-testid="mask-view-split-controls">
              <Field label="Position">
                <Slider label="Split position" min={0} max={1} step={0.01} value={mask.splitPos ?? 0.5} onChange={(v) => updateClipMask(clip.id, { splitPos: v })} />
                <span className="w-9 text-right text-[10px] text-ink-400 tabular-nums">{Math.round((mask.splitPos ?? 0.5) * 100)}%</span>
              </Field>
              <Field label="Angle">
                <Slider label="Split angle" min={-180} max={180} step={1} value={mask.splitAngle ?? 0} onChange={(v) => updateClipMask(clip.id, { splitAngle: v })} />
                <span className="w-9 text-right text-[10px] text-ink-400 tabular-nums">{Math.round(mask.splitAngle ?? 0)}°</span>
              </Field>
              <div className="flex items-center gap-1">
                <Tooltip label="Flip horizontal (line across)">
                  <button type="button" data-testid="mask-view-flip-h" aria-label="Flip horizontal" onClick={() => updateClipMask(clip.id, { splitAngle: 90 })} className="grid h-7 w-7 place-items-center rounded border border-ink-700 text-ink-300 hover:text-white"><FlipHorizontal2 size={13} /></button>
                </Tooltip>
                <Tooltip label="Flip vertical (line down)">
                  <button type="button" data-testid="mask-view-flip-v" aria-label="Flip vertical" onClick={() => updateClipMask(clip.id, { splitAngle: 0 })} className="grid h-7 w-7 place-items-center rounded border border-ink-700 text-ink-300 hover:text-white"><FlipVertical2 size={13} /></button>
                </Tooltip>
                <button type="button" data-testid="mask-view-flip-side" onClick={() => updateClipMask(clip.id, { inverted: !mask.inverted })} className="h-7 flex-1 rounded border border-ink-700 text-[11px] text-ink-300 hover:text-white">Flip side</button>
              </div>
            </div>
          )}
          {mask.kind === 'custom' && (
            <div className="space-y-1.5" data-testid="mask-view-custom-controls">
              <p className="text-[10px] text-ink-500">{(mask.points || []).length} points — enable “Draw on monitor”, click to add points, drag points to reshape.</p>
              <div className="flex items-center gap-1">
                <label className="flex flex-1 items-center gap-1.5 text-[11px] text-ink-300">
                  <input type="checkbox" data-testid="mask-view-curved" checked={Boolean(mask.curved)} onChange={(e) => updateClipMask(clip.id, { curved: e.target.checked })} className="accent-teal-400" />
                  Curved lines
                </label>
                <button type="button" data-testid="mask-view-clear-points" onClick={() => updateClipMask(clip.id, { points: [] })} className="h-7 rounded border border-ink-700 px-2 text-[11px] text-ink-300 hover:text-white">Clear</button>
              </div>
            </div>
          )}
          {mask.kind === 'text' && (
            <div className="space-y-1.5" data-testid="mask-view-text-controls">
              <input
                data-testid="mask-view-text"
                value={mask.text || ''}
                onChange={(e) => updateClipMask(clip.id, { text: e.target.value })}
                placeholder="Mask text"
                className="h-7 w-full rounded border border-ink-700 bg-ink-900 px-2 text-[11px] text-ink-100"
              />
              <div className="flex items-center gap-1">
                <select
                  data-testid="mask-view-font"
                  value={mask.fontFamily || ''}
                  onChange={(e) => updateClipMask(clip.id, { fontFamily: e.target.value || undefined })}
                  className="h-7 min-w-0 flex-1 rounded border border-ink-700 bg-ink-900 px-1 text-[11px] text-ink-100"
                >
                  <option value="">System sans</option>
                  {['Georgia', 'Impact', 'Courier New', 'Trebuchet MS', 'Verdana'].map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                  {customFonts.map((f) => (
                    <option key={f} value={f}>{f} (uploaded)</option>
                  ))}
                  {projectFonts.filter((f) => !customFonts.includes(f.name)).map((f) => (
                    <option key={f.id} value={f.name}>{f.name} (project)</option>
                  ))}
                </select>
                <label className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded border border-ink-700 text-ink-300 hover:text-white" title="Upload a font (.ttf/.otf/.woff) — saved on this device">
                  <Type size={13} />
                  <input
                    type="file"
                    data-testid="mask-view-font-upload"
                    accept=".ttf,.otf,.woff,.woff2,font/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void uploadMaskFont(file, clip.id)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
              <Field label="Size">
                <Slider label="Text size" min={0.05} max={0.9} step={0.01} value={mask.fontSize ?? 0.25} onChange={(v) => updateClipMask(clip.id, { fontSize: v })} />
                <span className="w-9 text-right text-[10px] text-ink-400 tabular-nums">{Math.round((mask.fontSize ?? 0.25) * 100)}%</span>
              </Field>
            </div>
          )}
          {/* Keyframed view window (curves: linear / smooth / ease). */}
          <div className="space-y-1" data-testid="mask-view-keyframes">
            <div className="flex items-center gap-1">
              <Tooltip label="Add a view keyframe at the playhead">
                <button
                  type="button"
                  data-testid="mask-view-add-keyframe"
                  aria-label="Add view keyframe at playhead"
                  onClick={() => {
                    const local = Math.max(0, playhead - clip.start)
                    const kf = {
                      time: local,
                      centerX: mask.centerX, centerY: mask.centerY,
                      width: mask.width, height: mask.height, rotation: mask.rotation,
                      splitPos: mask.splitPos ?? 0.5,
                      easing: 'smooth' as const,
                    }
                    const next = [...(mask.keyframes || []).filter((k) => Math.abs(k.time - local) > 0.01), kf].sort((a, b) => a.time - b.time)
                    updateClipMask(clip.id, { keyframes: next })
                  }}
                  className="grid h-7 w-7 place-items-center rounded border border-ink-700 text-ink-300 hover:text-white"
                >
                  <Diamond size={13} />
                </button>
              </Tooltip>
              <span className="text-[10px] text-ink-500">{(mask.keyframes || []).length} keyframes</span>
            </div>
            {(mask.keyframes || []).map((k, i) => (
              <div key={`${k.time}-${i}`} className="flex items-center gap-1 text-[10px] text-ink-400">
                <span className="w-12 tabular-nums">{k.time.toFixed(2)}s</span>
                <select
                  data-testid={`mask-view-kf-easing-${i}`}
                  value={k.easing}
                  onChange={(e) => {
                    const next = (mask.keyframes || []).map((kk, j) => j === i ? { ...kk, easing: e.target.value as typeof kk.easing } : kk)
                    updateClipMask(clip.id, { keyframes: next })
                  }}
                  className="h-6 flex-1 rounded border border-ink-700 bg-ink-900 px-1 text-[10px]"
                >
                  <option value="linear">Linear</option>
                  <option value="smooth">Smooth</option>
                  <option value="ease-in">Ease in</option>
                  <option value="ease-out">Ease out</option>
                </select>
                <button
                  type="button"
                  data-testid={`mask-view-kf-remove-${i}`}
                  aria-label={`Remove keyframe ${i + 1}`}
                  onClick={() => updateClipMask(clip.id, { keyframes: (mask.keyframes || []).filter((_, j) => j !== i) })}
                  className="grid h-6 w-6 place-items-center rounded border border-ink-800 text-ink-500 hover:text-red-300"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            data-testid="clip-mask-draw-btn"
            aria-pressed={drawing}
            title="Drag on the monitor to draw the mask; drag inside to move, corners to resize"
            onClick={() => setMaskEditClip(drawing ? null : clip.id)}
            className={`h-7 w-full rounded border text-[11px] transition-colors ${drawing ? 'border-teal-400 bg-teal-950/60 text-teal-100' : 'border-ink-700 text-ink-300 hover:border-teal-600 hover:text-teal-100'}`}
          >
            {drawing ? 'Done drawing' : 'Draw on monitor'}
          </button>
          {activeSelection && (
            <button
              type="button"
              data-testid="clip-mask-from-selection-btn"
              title="Set the mask bounds from the current selection"
              onClick={() => {
                const b = activeSelection.bounds
                updateClipMask(clip.id, {
                  centerX: b.x + b.width / 2,
                  centerY: b.y + b.height / 2,
                  width: Math.max(0.02, b.width),
                  height: Math.max(0.02, b.height),
                  shape: activeSelection.type === 'ellipse' ? 'ellipse' : 'rectangle',
                })
              }}
              className="h-7 w-full rounded border border-ink-700 text-[11px] text-ink-300 transition-colors hover:border-teal-600 hover:text-teal-100"
            >
              Use current selection bounds
            </button>
          )}
          <button
            type="button"
            data-testid="remove-clip-mask-btn"
            onClick={() => removeClipMask(clip.id)}
            className="h-7 w-full rounded border border-ink-800 text-[10px] text-ink-400 transition-colors hover:border-red-800 hover:text-red-200"
          >
            Remove mask
          </button>
        </div>
      )}
    </Section>
  )
}

function ClipInspector({ clip }: { clip: Clip }) {
  const assets = useEditor((s) => s.assets)
  const setClipProp = useEditor((s) => s.setClipProp)
  const setClipTransform = useEditor((s) => s.setClipTransform)
  const removeClip = useEditor((s) => s.removeClip)
  const splitAt = useEditor((s) => s.splitAt)
  const extractAudio = useEditor((s) => s.extractAudio)
  const defaultModel = useEditor((s) => s.audioIsolationModel)
  const playhead = useEditor((s) => s.playhead)
  const setClipKeyframe = useEditor((s) => s.setClipKeyframe)
  const pivotEditEnabled = useEditor((s) => s.pivotEditEnabled)
  const setPivotEditEnabled = useEditor((s) => s.setPivotEditEnabled)
  const removeClipKeyframe = useEditor((s) => s.removeClipKeyframe)
  const setGraphEditorOpen = useEditor((s) => s.setGraphEditorOpen)
  const setActiveCurveProperty = useEditor((s) => s.setActiveCurveProperty)
  const asset = assets.find((a) => a.id === clip.assetId)
  const t = clip.transform
  const adjustmentMaskDefaults: ClipAdjustmentMask = {
    shape: 'ellipse',
    centerX: 0.5,
    centerY: 0.5,
    width: 0.75,
    height: 0.75,
    feather: 36,
    inverted: false,
  }
  const updateAdjustmentMask = (patch: Partial<ClipAdjustmentMask>) => {
    setClipProp(clip.id, {
      adjustmentMask: { ...adjustmentMaskDefaults, ...clip.adjustmentMask, ...patch },
    })
  }

  const [isolationEnabled, setIsolationEnabled] = useState(false)
  const [isolationMode, setIsolationMode] = useState<'remove_vocal' | 'keep_vocal'>('remove_vocal')
  const [isolationModel, setIsolationModel] = useState<VoiceIsolationModel>(defaultModel || 'omni-voicetarget')
  const [isolationStrength, setIsolationStrength] = useState(0.92)
  const [demucsReady, setDemucsReady] = useState<boolean | null>(null)
  const [vadCleanup, setVadCleanup] = useState(true)
  const [speedFix, setSpeedFix] = useState(true)
  const [speedNatural, setSpeedNatural] = useState(false)
  useEffect(() => {
    let alive = true
    isDemucsModelAvailable().then((ok) => {
      if (!alive) return
      setDemucsReady(ok)
      // Auto-select the real neural model when its weights are downloaded
      // (public/models/htdemucs.onnx via `npm run fetch:demucs`).
      if (ok) setIsolationModel((m) => (m === 'omni-voicetarget' ? 'htdemucs-v4' : m))
    })
    return () => { alive = false }
  }, [])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isolationStatus, setIsolationStatus] = useState<string | null>(null)

  // Loudness normalization (BS.1770-4 integrated LUFS)
  const [loudnessEnabled, setLoudnessEnabled] = useState(false)
  const [targetLufs, setTargetLufs] = useState(-16)
  const [measuredLufs, setMeasuredLufs] = useState<number | null>(null)
  const [loudnessBusy, setLoudnessBusy] = useState(false)
  const [loudnessStatus, setLoudnessStatus] = useState<string | null>(null)

  const measureClipLoudness = async (): Promise<number | null> => {
    if (!asset) return null
    setLoudnessBusy(true)
    try {
      const res = await fetch(asset.url)
      const buf = await res.arrayBuffer()
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      const audio = await ctx.decodeAudioData(buf)
      const mono = new Float32Array(audio.length)
      for (let ch = 0; ch < audio.numberOfChannels; ch++) {
        const d = audio.getChannelData(ch)
        for (let i = 0; i < audio.length; i++) mono[i] += d[i] / audio.numberOfChannels
      }
      await ctx.close()
      const lufs = measureIntegratedLufs([mono], audio.sampleRate)
      setMeasuredLufs(lufs)
      return lufs
    } catch {
      setLoudnessStatus('Could not decode audio for measurement')
      return null
    } finally {
      setLoudnessBusy(false)
    }
  }

  const clipTime = Math.max(0, playhead - clip.start)

  // Helper to render keyframe toggle diamond and curve button
  const renderKeyframeControl = (propertyId: string, currentValue: number) => {
    const curve = clip.animation?.curves?.[propertyId]
    const existingKey = curve?.keyframes?.find((k) => Math.abs(k.time - clipTime) < 0.05)
    const hasKey = !!existingKey

    const handleToggle = () => {
      if (hasKey && existingKey) {
        removeClipKeyframe(clip.id, propertyId, existingKey.id)
      } else {
        setClipKeyframe(clip.id, propertyId, clipTime, currentValue, 'bezier')
      }
    }

    const handleOpenCurve = () => {
      setActiveCurveProperty(propertyId)
      setGraphEditorOpen(true)
    }

    return (
      <div className="flex items-center gap-1 shrink-0 ml-1">
        <button
          type="button"
          data-testid={`keyframe-diamond-${propertyId}`}
          title={hasKey ? 'Remove Keyframe at Current Time' : 'Add Keyframe at Current Time'}
          aria-label={hasKey ? 'Remove keyframe at current time' : 'Add keyframe at current time'}
          aria-pressed={hasKey}
          onClick={handleToggle}
          className={`flex min-h-8 min-w-8 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            hasKey ? 'text-brand-400' : 'text-ink-500 hover:text-ink-200'
          }`}
        >
          <Diamond size={13} fill={hasKey ? 'currentColor' : 'none'} />
        </button>
        <button
          type="button"
          data-testid={`open-curve-${propertyId}`}
          title="Open in Curve Graph Editor"
          aria-label={`Open ${propertyId.replace(/_/g, ' ')} in curve graph editor`}
          onClick={handleOpenCurve}
          className="flex min-h-8 min-w-8 items-center justify-center rounded text-ink-500 transition-colors hover:bg-ink-800 hover:text-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Activity size={12} />
        </button>
      </div>
    )
  }

  return (
    <div>
      <Section title="Clip">
        <div className="flex items-center justify-between gap-2">
          <input
            aria-label="Clip name"
            value={clip.name}
            onChange={(e) => setClipProp(clip.id, { name: e.target.value })}
            className="bg-ink-800 border border-ink-700 rounded px-2 h-7 text-xs text-ink-100 outline-none focus:border-brand w-full"
          />
        </div>
        <div className="text-[10px] text-ink-500 mt-1">
          {clip.kind === 'adjustment' ? 'Adjustment layer' : asset?.kind || clip.kind} · {formatClock(clip.duration)} on track
        </div>
        {clip.kind === 'adjustment' && (
          <p className="mt-1 rounded border border-cyan-900/70 bg-cyan-950/25 px-2 py-1 text-[10px] leading-snug text-cyan-100/75" data-testid="adjustment-layer-scope-note">
            Grades layers below this clip. Higher tracks, including text above it, remain unaffected.
          </p>
        )}
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => splitAt(useEditor.getState().playhead)}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md bg-ink-800 border border-ink-700 text-xs hover:bg-ink-700"
          >
            <Scissors size={13} /> Split
          </button>
          <button
            type="button"
            data-testid={clip.kind === 'adjustment' ? 'delete-adjustment-layer-btn' : 'delete-clip-btn'}
            onClick={() => removeClip(clip.id)}
            className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-ink-800 border border-ink-700 text-xs text-bad hover:bg-ink-700"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
        {clip.kind === 'compound' && (
          <div className="mt-2 p-2 rounded bg-indigo-950/60 border border-indigo-500/30 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-indigo-200">
              <span className="font-semibold flex items-center gap-1.5">
                <Layers size={13} className="text-indigo-400" />
                <span>Compound Sequence</span>
              </span>
              <span className="text-[10px] font-mono text-indigo-300">
                {clip.nestedTrackCount || 1} Tracks · {clip.nestedClipCount || 1} Clips
              </span>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                data-testid="inspector-open-compound-btn"
                title="Open Compound Clip Timeline"
                aria-label="Open compound clip timeline"
                onClick={() => {
                  if (clip.sourceSequenceId) useEditor.getState().openSequence(clip.sourceSequenceId)
                }}
                className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-xs font-medium transition-colors truncate"
              >
                <FolderOpen size={12} className="shrink-0" />
                <span className="truncate">Open Timeline</span>
              </button>
              <button
                type="button"
                data-testid="inspector-uncompound-btn"
                title="Decompose Compound Clip into Individual Tracks"
                aria-label="Decompose compound clip"
                onClick={() => useEditor.getState().uncompoundClip(clip.id)}
                className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-medium transition-colors truncate"
              >
                <FolderOutput size={12} className="shrink-0" />
                <span className="truncate">Decompose</span>
              </button>
            </div>
          </div>
        )}
        {clip.kind === 'video' && !assets.some((item) => item.extractedFromClipId === clip.id) && (
          <button
            type="button"
            title="Extract audio stream to separate audio track"
            aria-label="Extract audio"
            onClick={() => void extractAudio(clip.id)}
            className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-ink-700 bg-ink-800 text-xs hover:bg-ink-700 truncate"
          >
            <AudioLines size={13} className="shrink-0" />
            <span className="truncate">Extract audio</span>
          </button>
        )}
      </Section>

      {clip.kind === 'adjustment' && (
        <Section title="Effect Mask">
          {!clip.adjustmentMask ? (
            <button
              type="button"
              data-testid="add-adjustment-mask-btn"
              onClick={() => updateAdjustmentMask({})}
              className="flex h-8 w-full items-center justify-center rounded-md border border-cyan-800 bg-cyan-950/30 text-xs text-cyan-100 transition-colors hover:border-cyan-500"
            >
              Add ellipse mask
            </button>
          ) : (
            <div data-testid="adjustment-mask-controls" className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="adjustment-mask-shape" className="text-xs text-ink-400">Shape</label>
                <select
                  id="adjustment-mask-shape"
                  data-testid="adjustment-mask-shape"
                  value={clip.adjustmentMask.shape}
                  onChange={(event) => updateAdjustmentMask({ shape: event.target.value as ClipAdjustmentMask['shape'] })}
                  className="h-7 rounded border border-ink-700 bg-ink-900 px-2 text-[11px] text-ink-100"
                >
                  <option value="ellipse">Ellipse</option>
                  <option value="rectangle">Rectangle</option>
                </select>
              </div>
              <Field label="Center X">
                <Slider label="Adjustment mask center X" min={0} max={1} step={0.01} value={clip.adjustmentMask.centerX} onChange={(value) => updateAdjustmentMask({ centerX: value })} />
                <span className="w-9 text-right text-[10px] text-ink-400 tabular-nums">{Math.round(clip.adjustmentMask.centerX * 100)}%</span>
              </Field>
              <Field label="Center Y">
                <Slider label="Adjustment mask center Y" min={0} max={1} step={0.01} value={clip.adjustmentMask.centerY} onChange={(value) => updateAdjustmentMask({ centerY: value })} />
                <span className="w-9 text-right text-[10px] text-ink-400 tabular-nums">{Math.round(clip.adjustmentMask.centerY * 100)}%</span>
              </Field>
              <Field label="Width">
                <Slider label="Adjustment mask width" min={0.05} max={1} step={0.01} value={clip.adjustmentMask.width} onChange={(value) => updateAdjustmentMask({ width: value })} />
                <span className="w-9 text-right text-[10px] text-ink-400 tabular-nums">{Math.round(clip.adjustmentMask.width * 100)}%</span>
              </Field>
              <Field label="Height">
                <Slider label="Adjustment mask height" min={0.05} max={1} step={0.01} value={clip.adjustmentMask.height} onChange={(value) => updateAdjustmentMask({ height: value })} />
                <span className="w-9 text-right text-[10px] text-ink-400 tabular-nums">{Math.round(clip.adjustmentMask.height * 100)}%</span>
              </Field>
              <Field label="Feather">
                <Slider label="Adjustment mask feather" min={0} max={240} step={2} value={clip.adjustmentMask.feather} onChange={(value) => updateAdjustmentMask({ feather: value })} />
                <span className="w-9 text-right text-[10px] text-ink-400 tabular-nums">{Math.round(clip.adjustmentMask.feather)}px</span>
              </Field>
              <label className="flex items-center gap-2 text-[11px] text-ink-300">
                <input
                  type="checkbox"
                  data-testid="invert-adjustment-mask"
                  checked={clip.adjustmentMask.inverted}
                  onChange={(event) => updateAdjustmentMask({ inverted: event.target.checked })}
                  className="accent-cyan-400"
                />
                Invert mask
              </label>
              <button
                type="button"
                data-testid="remove-adjustment-mask-btn"
                onClick={() => setClipProp(clip.id, { adjustmentMask: undefined })}
                className="h-7 w-full rounded border border-ink-800 text-[10px] text-ink-400 transition-colors hover:border-red-800 hover:text-red-200"
              >
                Remove mask
              </button>
            </div>
          )}
        </Section>
      )}

      {clip.kind !== 'adjustment' && clip.kind !== 'audio' && <ClipMaskSection clip={clip} />}
      {clip.kind !== 'adjustment' && clip.kind !== 'audio' && <MaskingRotoSection clip={clip} />}
      {clip.kind !== 'adjustment' && clip.kind !== 'audio' && <AeToolRackSection clip={clip} />}
      {clip.kind !== 'adjustment' && clip.kind !== 'audio' && <SpeedCurveSection clip={clip} />}
      <McpConsoleSection />

      <Section title="Transform">
        <Field label="Position X">
          <Slider label="Position X" min={-960} max={960} value={t.x} onChange={(v) => setClipTransform(clip.id, { x: v })} />
          <span className="w-8 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.x)}</span>
          {renderKeyframeControl('position_x', t.x)}
        </Field>
        <Field label="Position Y">
          <Slider label="Position Y" min={-540} max={540} value={t.y} onChange={(v) => setClipTransform(clip.id, { y: v })} />
          <span className="w-8 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.y)}</span>
          {renderKeyframeControl('position_y', t.y)}
        </Field>
        <Field label="Scale">
          <Slider label="Scale" min={0.1} max={3} step={0.01} value={t.scale} onChange={(v) => setClipTransform(clip.id, { scale: v })} />
          <span className="w-8 text-right text-[11px] text-ink-400 tabular-nums">{t.scale.toFixed(2)}</span>
          {renderKeyframeControl('scale_x', t.scale)}
        </Field>
        <Field label={<span className="flex items-center gap-1.5"><BlenderRotationIcon size={13} /><span>Rotation</span></span>}>
          <Slider label="Rotation" min={-180} max={180} value={t.rotation} onChange={(v) => setClipTransform(clip.id, { rotation: v })} />
          <span className="w-8 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.rotation)}°</span>
          {renderKeyframeControl('rotation_z', t.rotation)}
        </Field>
        <Field label="Pivot X (Anchor)">
          <Slider label="Pivot X" min={0} max={1} step={0.01} value={t.pivotX ?? 0.5} onChange={(v) => setClipTransform(clip.id, { pivotX: v })} />
          <span className="w-8 text-right text-[11px] text-ink-400 tabular-nums">{Math.round((t.pivotX ?? 0.5) * 100)}%</span>
          {renderKeyframeControl('pivot_x', t.pivotX ?? 0.5)}
        </Field>
        <Field label="Pivot Y (Anchor)">
          <Slider label="Pivot Y" min={0} max={1} step={0.01} value={t.pivotY ?? 0.5} onChange={(v) => setClipTransform(clip.id, { pivotY: v })} />
          <span className="w-8 text-right text-[11px] text-ink-400 tabular-nums">{Math.round((t.pivotY ?? 0.5) * 100)}%</span>
          {renderKeyframeControl('pivot_y', t.pivotY ?? 0.5)}
        </Field>
        <div className="space-y-1.5" data-testid="pivot-controls">
          <div className="flex flex-wrap gap-1">
            {[
              { label: 'Centre', x: 0.5, y: 0.5 },
              { label: 'Joint L', x: 0, y: 0.5 },
              { label: 'Joint R', x: 1, y: 0.5 },
              { label: 'Top', x: 0.5, y: 0 },
              { label: 'Bottom', x: 0.5, y: 1 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                data-testid={`pivot-preset-${preset.label.toLowerCase().replace(/\s+/g, '-')}`}
                title={`Set pivot to ${preset.label} (${Math.round(preset.x * 100)}%, ${Math.round(preset.y * 100)}%)`}
                onClick={() => setClipTransform(clip.id, { pivotX: preset.x, pivotY: preset.y })}
                className="px-1.5 py-1 rounded bg-ink-800 hover:bg-brand text-ink-300 hover:text-white text-[10px] transition-colors"
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              data-testid="pivot-edit-toggle"
              aria-pressed={pivotEditEnabled}
              title="Show the draggable anchor on the preview: drag it onto a joint so rotation hinges there (Krita armature technique)"
              onClick={() => setPivotEditEnabled(!pivotEditEnabled)}
              className={`px-1.5 py-1 rounded text-[10px] transition-colors ${pivotEditEnabled ? 'bg-brand text-white' : 'bg-ink-800 hover:bg-brand text-ink-300 hover:text-white'}`}
            >
              {pivotEditEnabled ? 'Anchor: drag on preview' : 'Edit anchor on preview'}
            </button>
          </div>
          <p className="text-[10px] leading-snug text-ink-500">
            Rotation and scale hinge on this anchor. Drag it onto a joint, then keyframe Rotation.
            Keyframe the pivot itself to move the hinge mid-animation; with no pivot keyframes the anchor stays put.
          </p>
        </div>
        {/* 3D Spatial Properties: Clean Accordion Sub-Group */}
        <AccordionGroup
          title="3D Spatial (Depth, Tilt, Pan)"
          defaultOpen={Boolean(t.z || t.rotationX || t.rotationY)}
        >
          <Field label="3D Depth (Z)">
            <Slider label="3D Depth (Z)" min={-1000} max={1000} value={t.z ?? 0} onChange={(v) => setClipTransform(clip.id, { z: v })} />
            <span className="w-8 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.z ?? 0)}</span>
            {renderKeyframeControl('position_z', t.z ?? 0)}
          </Field>
          <Field label="Rotation X (Tilt)">
            <Slider label="Rotation X (Tilt)" min={-180} max={180} value={t.rotationX ?? 0} onChange={(v) => setClipTransform(clip.id, { rotationX: v })} />
            <span className="w-8 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.rotationX ?? 0)}°</span>
            {renderKeyframeControl('rotation_x', t.rotationX ?? 0)}
          </Field>
          <Field label="Rotation Y (Pan)">
            <Slider label="Rotation Y (Pan)" min={-180} max={180} value={t.rotationY ?? 0} onChange={(v) => setClipTransform(clip.id, { rotationY: v })} />
            <span className="w-8 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.rotationY ?? 0)}°</span>
            {renderKeyframeControl('rotation_y', t.rotationY ?? 0)}
          </Field>
        </AccordionGroup>
      </Section>

      <Section title="Appearance">
        <Field label="Opacity">
          <Slider label="Opacity" min={0} max={1} step={0.01} value={t.opacity} onChange={(v) => setClipTransform(clip.id, { opacity: v })} />
          <span className="w-8 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.opacity * 100)}</span>
          {renderKeyframeControl('opacity', t.opacity)}
        </Field>
      </Section>

      {(clip.kind === 'audio' || clip.kind === 'video') && (
        <Section title="Audio">
          <Field label="Volume">
            <Slider label="Volume"
              min={0}
              max={2}
              step={0.01}
              value={clip.volume ?? 1}
              onChange={(v) => setClipProp(clip.id, { volume: v })}
            />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">
              {Math.round((clip.volume ?? 1) * 100)}%
            </span>
          </Field>

          {/* Loudness Normalization (BS.1770-4 LUFS) */}
          <div className="pt-2 border-t border-ink-800 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none" title="Measure integrated loudness (ITU-R BS.1770-4) and apply gain to hit the target LUFS">
              <input
                type="checkbox"
                data-testid="audio-loudness-checkbox"
                checked={loudnessEnabled}
                onChange={(e) => {
                  setLoudnessEnabled(e.target.checked)
                  if (e.target.checked && measuredLufs === null) void measureClipLoudness()
                }}
                className="h-3.5 w-3.5 rounded border-ink-700 bg-ink-800 text-brand-400 focus:ring-brand focus:ring-offset-ink-900 cursor-pointer"
              />
              <span className="text-xs font-medium text-ink-200">Loudness Normalization</span>
              <span className="ml-auto font-mono text-[10px] text-ink-400" data-testid="audio-loudness-measured">
                {measuredLufs === null ? '' : `${measuredLufs.toFixed(1)} LUFS`}
              </span>
            </label>

            {loudnessEnabled && (
              <div data-testid="audio-loudness-controls" className="p-2.5 rounded-lg border border-ink-800 bg-ink-900/60 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[10px] font-semibold uppercase text-ink-400">Target</label>
                  <span className="font-mono text-[11px] text-brand-400" data-testid="audio-loudness-target-label">
                    {targetLufs.toFixed(1)} LUFS
                  </span>
                </div>
                <input
                  type="range"
                  data-testid="audio-loudness-target-slider"
                  aria-label="Target loudness in LUFS"
                  min={-24}
                  max={-10}
                  step={0.5}
                  value={targetLufs}
                  onChange={(e) => setTargetLufs(parseFloat(e.target.value))}
                  className="of-range w-full"
                />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="audio-loudness-remasure-btn"
                    disabled={loudnessBusy}
                    onClick={() => void measureClipLoudness()}
                    className="flex-1 h-7.5 rounded-md bg-ink-800 hover:bg-ink-750 border border-ink-700 text-ink-200 text-[11px] font-medium transition-colors disabled:opacity-50"
                  >
                    {loudnessBusy ? 'Measuring…' : 'Measure'}
                  </button>
                  <button
                    type="button"
                    data-testid="audio-loudness-apply-btn"
                    disabled={loudnessBusy}
                    onClick={async () => {
                      const lufs = measuredLufs ?? (await measureClipLoudness())
                      if (lufs === null || !isFinite(lufs)) {
                        setLoudnessStatus('No measurable audio')
                        return
                      }
                      const gain = loudnessGain(lufs, targetLufs)
                      const clamped = Math.max(0.02, Math.min(2, gain))
                      setClipProp(clip.id, { volume: clamped })
                      const db = 20 * Math.log10(clamped)
                      setLoudnessStatus(
                        `${lufs.toFixed(1)} → ${targetLufs.toFixed(1)} LUFS (gain ${db >= 0 ? '+' : ''}${db.toFixed(1)} dB` +
                          `${clamped !== gain ? `, capped at ${(20 * Math.log10(clamped)).toFixed(1)} dB` : ''})`,
                      )
                    }}
                    className="flex-1 h-7.5 rounded-md bg-brand hover:bg-brand-600 text-white text-[11px] font-medium transition-colors disabled:opacity-50"
                  >
                    Normalize
                  </button>
                </div>
                {loudnessStatus && <p className="text-[10px] text-ink-400 font-mono truncate" data-testid="audio-loudness-status">{loudnessStatus}</p>}
                <p className="text-[9px] leading-relaxed text-ink-500">
                  Streaming target −16 LUFS (podcast), −14 for music platforms. Gain above +0 dB is capped by browser playback.
                </p>
              </div>
            )}
          </div>

          {/* Voice Isolation Checkbox */}
          <div className="pt-2 border-t border-ink-800 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                data-testid="audio-voice-isolation-checkbox"
                checked={isolationEnabled}
                onChange={(e) => setIsolationEnabled(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-ink-700 bg-ink-800 text-brand-400 focus:ring-brand focus:ring-offset-ink-900 cursor-pointer"
              />
              <span className="text-xs font-medium text-ink-200">Voice Isolation</span>
            </label>

            {/* Custom dropdown underneath when checkbox is selected */}
            {isolationEnabled && (
              <div
                data-testid="audio-isolation-controls"
                className="p-2.5 rounded-lg border border-ink-800 bg-ink-900/60 space-y-2.5 animate-in fade-in duration-150"
              >
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase text-ink-400 block">
                    Mode
                  </label>
                  <select
                    data-testid="audio-isolation-mode-dropdown"
                    value={isolationMode}
                    onChange={(e) => setIsolationMode(e.target.value as 'remove_vocal' | 'keep_vocal')}
                    className="w-full h-7 rounded border border-ink-700 bg-ink-800 px-2 text-xs text-ink-100 outline-none focus:border-brand"
                  >
                    <option value="remove_vocal">Remove Vocal (Instrumental)</option>
                    <option value="keep_vocal">Keep Vocal (Dialogue Only)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase text-ink-400 block">
                    AI Neural Model
                  </label>
                  <select
                    data-testid="audio-isolation-model-dropdown"
                    value={isolationModel}
                    onChange={(e) => {
                      setIsolationModel(e.target.value as VoiceIsolationModel)
                      useEditor.getState().setAudioIsolationModel(e.target.value as VoiceIsolationModel)
                    }}
                    className="w-full h-7 rounded border border-ink-700 bg-ink-800 px-2 text-xs text-ink-100 outline-none focus:border-brand"
                  >
                    <option value="htdemucs-v4">Demucs v4 · real neural{demucsReady === false ? ' (weights not downloaded)' : ' — best quality'}</option>
                    <option value="omni-voicetarget">omni-voicetarget · fast DSP (mid/side crossover)</option>
                    <option value="bs-roformer-lite" disabled>BS-Roformer Lite (planned, unavailable)</option>
                    <option value="dsp-crossover-fast">Fast Crossover DSP (Offline)</option>
                    {isolationMode === 'keep_vocal' && (
                      <option value="omni-denoise-onnx">AI Denoise ONNX (voice extractor · keep-vocal only)</option>
                    )}
                    {isolationMode === 'keep_vocal' && (
                      <option value="rnnoise-xiph">RNNoise (Xiph) · trained speech denoiser</option>
                    )}
                    <option value="omni-unified">omni-unified-v1 · isolation + denoise + normalize (both modes)</option>
                  </select>
                </div>

                {isolationModel === 'htdemucs-v4' && (
                  <label className="flex items-center gap-2 cursor-pointer select-none" data-testid="audio-isolation-vad-toggle">
                    <input
                      type="checkbox"
                      checked={vadCleanup}
                      onChange={(e) => setVadCleanup(e.target.checked)}
                      className="h-3 w-3 rounded border-ink-700 bg-ink-800 text-brand-400 focus:ring-brand cursor-pointer"
                    />
                    <span className="text-[10px] text-ink-300">Silero VAD pause cleanup <span className="text-ink-500">(mutes residual noise between phrases)</span></span>
                  </label>
                )}

                {isolationModel === 'htdemucs-v4' && (
                  <label className="flex items-center gap-2 cursor-pointer select-none" data-testid="audio-isolation-speedfix-toggle">
                    <input
                      type="checkbox"
                      checked={speedFix}
                      onChange={(e) => setSpeedFix(e.target.checked)}
                      className="h-3 w-3 rounded border-ink-700 bg-ink-800 text-brand-400 focus:ring-brand cursor-pointer"
                    />
                    <span className="text-[10px] text-ink-300">Auto-fix slowed tracks <span className="text-ink-500">(separates at corrected speed, restores timing)</span></span>
                  </label>
                )}

                <div className="flex items-center justify-between gap-2" data-testid="audio-isolation-strength-row">
                  <span className="text-[10px] text-ink-300 shrink-0">Strength</span>
                  <input
                    type="range"
                    data-testid="audio-isolation-strength-slider"
                    aria-label="Isolation strength"
                    min={0.1}
                    max={1.0}
                    step={0.01}
                    value={isolationStrength}
                    disabled={isProcessing}
                    onChange={(e) => setIsolationStrength(parseFloat(e.target.value))}
                    className="w-full h-1 accent-brand cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-ink-400 shrink-0 w-8 text-right">{Math.round(isolationStrength * 100)}%</span>
                </div>

                {isolationModel === 'htdemucs-v4' && speedFix && isolationMode === 'keep_vocal' && (
                  <label className="flex items-center gap-2 cursor-pointer select-none ml-3" data-testid="audio-isolation-naturalpitch-toggle">
                    <input
                      type="checkbox"
                      checked={speedNatural}
                      onChange={(e) => setSpeedNatural(e.target.checked)}
                      className="h-3 w-3 rounded border-ink-700 bg-ink-800 text-brand-400 focus:ring-brand cursor-pointer"
                    />
                    <span className="text-[10px] text-ink-300">Vocals at natural pitch <span className="text-ink-500">(skip the slow-back — usable acapella, no longer timeline-aligned)</span></span>
                  </label>
                )}

                {isolationStatus && (
                  <p className="text-[10px] text-ink-400 font-mono truncate">{isolationStatus}</p>
                )}

                <button
                  type="button"
                  data-testid="apply-audio-isolation-btn"
                  disabled={isProcessing}
                  onClick={async () => {
                    setIsProcessing(true)
                    setIsolationStatus('Processing isolation…')
                    try {
                      await executeVoiceIsolationForClip(
                        clip.id,
                        { mode: isolationMode, model: isolationModel, strength: isolationStrength, vadGate: isolationModel === 'htdemucs-v4' ? vadCleanup : undefined, speedNormalize: isolationModel === 'htdemucs-v4' ? speedFix : undefined, speedOutput: isolationModel === 'htdemucs-v4' && speedFix && isolationMode === 'keep_vocal' && speedNatural ? 'natural' : 'timeline' },
                        (pct, msg) => setIsolationStatus(`${pct}%: ${msg}`),
                      )
                      setIsolationStatus('Completed!')
                      setTimeout(() => setIsolationStatus(null), 3000)
                    } catch (err) {
                      setIsolationStatus(`Error: ${(err as Error).message}`)
                    } finally {
                      setIsProcessing(false)
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 h-7.5 rounded-md bg-brand hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-medium transition-colors shadow-sm"
                >
                  {isProcessing ? 'Processing Audio…' : 'Isolate Audio Track'}
                </button>
              </div>
            )}
          </div>
        </Section>
      )}

      {clip.textStyle && (
        <Section title="Text & Title">
          <Field label="Text">
            <input
              value={clip.textStyle.text}
              onChange={(e) => {
                const text = e.target.value
                useEditor.setState((s) => ({
                  clips: s.clips.map((c) => (c.id === clip.id ? { ...c, name: text, textStyle: { ...c.textStyle!, text } } : c)),
                }))
              }}
              aria-label="Clip name"
              className="bg-ink-800 border border-ink-700 rounded px-2 h-7 text-xs text-ink-100 outline-none focus:border-brand w-full"
            />
          </Field>
          <Field label="Font Size">
            <Slider label="Font Size"
              min={16}
              max={128}
              step={2}
              value={clip.textStyle.fontSize ?? 32}
              onChange={(v) => {
                useEditor.setState((s) => ({
                  clips: s.clips.map((c) => (c.id === clip.id ? { ...c, textStyle: { ...c.textStyle!, fontSize: v } } : c)),
                }))
              }}
            />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{(clip.textStyle.fontSize ?? 32)}px</span>
          </Field>
        </Section>
      )}

      <PlacedEffectsSection clip={clip} />

      {clip.effects && (
        <Section title="Effects">
          <Field label="Brightness">
            <Slider label="Brightness" min={0} max={2} step={0.05} value={clip.effects.brightness ?? 1} onChange={(v) => useEditor.getState().setClipEffect(clip.id, { brightness: v })} />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{(clip.effects.brightness ?? 1).toFixed(2)}</span>
          </Field>
          <Field label="Contrast">
            <Slider label="Contrast" min={0} max={2} step={0.05} value={clip.effects.contrast ?? 1} onChange={(v) => useEditor.getState().setClipEffect(clip.id, { contrast: v })} />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{(clip.effects.contrast ?? 1).toFixed(2)}</span>
          </Field>
          <Field label="Saturation">
            <Slider label="Saturation" min={0} max={2} step={0.05} value={clip.effects.saturation ?? 1} onChange={(v) => useEditor.getState().setClipEffect(clip.id, { saturation: v })} />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{(clip.effects.saturation ?? 1).toFixed(2)}</span>
          </Field>
          <Field label="Blur">
            <Slider label="Blur" min={0} max={20} step={0.5} value={clip.effects.blur ?? 0} onChange={(v) => useEditor.getState().setClipEffect(clip.id, { blur: v })} />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{(clip.effects.blur ?? 0).toFixed(0)}px</span>
          </Field>
          <Field label="Hue rotate">
            <Slider label="Hue rotate" min={0} max={360} step={5} value={clip.effects.hueRotate ?? 0} onChange={(v) => useEditor.getState().setClipEffect(clip.id, { hueRotate: v })} />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(clip.effects.hueRotate ?? 0)}°</span>
          </Field>
          <Field label="Grayscale">
            <Slider label="Grayscale" min={0} max={1} step={0.05} value={clip.effects.grayscale ?? 0} onChange={(v) => useEditor.getState().setClipEffect(clip.id, { grayscale: v })} />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{Math.round((clip.effects.grayscale ?? 0) * 100)}%</span>
          </Field>
          <Field label="Invert">
            <Slider label="Invert" min={0} max={1} step={0.05} value={clip.effects.invert ?? 0} onChange={(v) => useEditor.getState().setClipEffect(clip.id, { invert: v })} />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{Math.round((clip.effects.invert ?? 0) * 100)}%</span>
          </Field>
          <Field label="Sepia">
            <Slider label="Sepia" min={0} max={1} step={0.05} value={clip.effects.sepia ?? 0} onChange={(v) => useEditor.getState().setClipEffect(clip.id, { sepia: v })} />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{Math.round((clip.effects.sepia ?? 0) * 100)}%</span>
          </Field>
        </Section>
      )}

      <Section title="Source">
        <Field label="In point">
          <span className="text-[11px] text-ink-300 tabular-nums">{formatClock(clip.inPoint)}</span>
        </Field>
        <Field label="Duration">
          <span className="text-[11px] text-ink-300 tabular-nums">{formatClock(clip.duration)}</span>
        </Field>
      </Section>
    </div>
  )
}

function ProjectInspector() {
  const projectFps = useEditor((s) => s.projectFps)
  const sequenceSettings = useEditor((s) => s.sequenceSettings)
  return (
    <div>
      <Section title="Project">
        <Field label="Resolution">
          <span className="text-[11px] text-ink-300">{sequenceSettings.width} × {sequenceSettings.height} ({sequenceSettings.aspectRatio})</span>
        </Field>
        <Field label="Frame rate">
          <span className="text-[11px] text-ink-300">{projectFps} fps</span>
        </Field>
      </Section>
      <Section title="Tips">
        <ul className="text-[11px] text-ink-400 leading-relaxed list-disc pl-4 space-y-1">
          <li>Drag a file anywhere to import.</li>
          <li>Click a clip to select it, then edit here.</li>
          <li>Drag clip edges to trim, body to move.</li>
          <li>Blade tool or Split to cut at the playhead.</li>
          <li>Scroll the timeline to zoom time.</li>
        </ul>
      </Section>
    </div>
  )
}


/** Dedicated Masking & Roto workspace section (extracted from the general
 *  tool stack per review: masking sub-tools get their own right-panel
 *  section with icon-first tiles, never mixed into generic sections). */
function MaskingRotoSection({ clip }: { clip: Clip }) {
  const toggleSelectionMaskView = useEditor((s) => s.toggleSelectionMaskView)
  const runGuidedRectBackgroundRemoval = useEditor((s) => s.runGuidedRectBackgroundRemoval)
  const rotoBrushRadius = useEditor((s) => s.rotoBrushRadius)
  void clip
  return (
    <Section title="Masking & Roto">
      <div className="space-y-2 rounded-md border border-rose-500/40 bg-rose-500/5 p-2" data-testid="masking-roto-section">
        <div className="flex flex-wrap gap-1">
          <button type="button" data-testid="mr-mask-view" title="Toggle selection mask view" aria-label="Toggle selection mask view"
            onClick={() => toggleSelectionMaskView()}
            className="flex h-7 w-7 items-center justify-center rounded border border-ink-700 bg-ink-900 text-ink-300 hover:text-white">
            <Scan size={13} />
          </button>
          <button type="button" data-testid="mr-roto" title="Roto brush mask sub-tool (drawing panel)" aria-label="Roto brush mask sub-tool"
            onClick={() => useEditor.setState({ leftTab: 'drawing' })}
            className="flex h-7 w-7 items-center justify-center rounded border border-ink-700 bg-ink-900 text-ink-300 hover:text-white">
            <PenTool size={13} />
          </button>
          <button type="button" data-testid="mr-guided-matte" title="Guided rect matte / background cut-out" aria-label="Guided rect matte"
            onClick={() => { void runGuidedRectBackgroundRemoval() }}
            className="flex h-7 w-7 items-center justify-center rounded border border-ink-700 bg-ink-900 text-ink-300 hover:text-white">
            <Wand2 size={13} />
          </button>
          {[12, 24, 48].map((r) => (
            <button key={r} type="button" data-testid={`mr-roto-radius-${r}`} title={`Roto brush radius ${r}px`} aria-label={`Roto brush radius ${r}px`}
              onClick={() => useEditor.setState({ rotoBrushRadius: r })}
              className={`flex h-7 min-w-7 items-center justify-center rounded border px-1 font-mono text-[9px] ${rotoBrushRadius === r ? 'border-rose-500 bg-rose-500/20 text-rose-200' : 'border-ink-700 bg-ink-900 text-ink-400 hover:text-white'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>
    </Section>
  )
}

/** One-click rack of the settings combos scanned off the AE tutorial popups
 *  (Study_edits_videos/deep-study-*.md): comp light, CRT blotch, mosaic,
 *  RGB fringe, wave warp, green key, feather/ember beds, scanlines. */
const AE_RACK: Array<{ id: string; label: string; icon: typeof Tv; effect: Record<string, unknown>; group: 'light' | 'pixel' | 'beds' }> = [
  { id: 'complight', group: 'light', label: 'Comp light (warm point light + falloff)', icon: Lightbulb, effect: { lightType: 'point', lightIntensity: 1.1, lightColor: '#ffd9a0', lightFalloff: 0.5 } },
  { id: 'crt', group: 'light', label: 'CRT look (posterize + grain + fringe)', icon: Tv, effect: { posterize: 0.55, grain: 0.35, chromatic: 3 } },
  { id: 'mosaic', group: 'pixel', label: 'Mosaic pixel shift bed', icon: Grid3x3, effect: { pixelate: 12 } },
  { id: 'fringe', group: 'light', label: 'RGB fringe attack', icon: Rainbow, effect: { chromatic: 9 } },
  { id: 'warp', group: 'pixel', label: 'Wave warp bend', icon: Waves, effect: { waveWarp: 10 } },
  { id: 'greenkey', group: 'pixel', label: 'Green-screen key (CTA card)', icon: Eraser, effect: { chromaKey: 0.85 } },
  { id: 'feathers', group: 'beds', label: 'Feather particle bed', icon: Feather, effect: { particleFx: 'feathers', particleDensity: 0.6 } },
  { id: 'embers', group: 'beds', label: 'Ember particle bed', icon: Flame, effect: { particleFx: 'embers', particleDensity: 0.5 } },
  { id: 'scan', group: 'beds', label: 'Scanline overlay', icon: ScanLine, effect: { overlayFx: 'scanlines', overlayStrength: 0.6 } },
  { id: 'fractalblur', group: 'pixel', label: 'Fractal blur (stacked octaves)', icon: Waves, effect: { fractalBlur: 8 } },
  { id: 'lumakey', group: 'pixel', label: 'Luma key bg removal', icon: Eraser, effect: { lumaKey: 0.85 } },
  { id: 'cardflip', group: 'pixel', label: 'Card flip fold', icon: Tv, effect: { cardFlip: 0.5 } },
  // Alight-Motion-named family (rewatch 2026-10, guide.alightmotion.com/effects)
  { id: 'amzoomblur', group: 'pixel', label: 'Zoom blur (AM)', icon: Waves, effect: { zoomBlur: 0.8 } },
  { id: 'amdirblur', group: 'pixel', label: 'Directional blur (AM)', icon: Waves, effect: { directionalBlur: 0.7, directionalBlurAngle: 35 } },
  { id: 'amglow', group: 'pixel', label: 'Glow (AM)', icon: Sparkles, effect: { glow: 0.9 } },
  { id: 'amedgeglow', group: 'pixel', label: 'Edge glow (AM)', icon: Sparkles, effect: { edgeGlow: 0.9 } },
  { id: 'amtilt', group: 'pixel', label: 'Tilt shift (AM)', icon: Waves, effect: { tiltShift: 0.9 } },
  { id: 'amvignette', group: 'pixel', label: 'Vignette (AM)', icon: Sparkles, effect: { vignette: 0.8 } },
  { id: 'amflicker', group: 'pixel', label: 'Flicker (AM)', icon: Sparkles, effect: { flicker: 0.6 } },
  { id: 'amtiles', group: 'pixel', label: 'Tiles mirror (AM)', icon: Tv, effect: { tiles: 3 } },
  { id: 'ambuldge', group: 'pixel', label: 'Pinch/Bulge (AM)', icon: Waves, effect: { pinchBulge: 0.6 } },
  { id: 'amswirl', group: 'pixel', label: 'Swirl (AM)', icon: Waves, effect: { swirl: 90 } },
  { id: 'amgradmap', group: 'pixel', label: 'Gradient map (AM)', icon: Sparkles, effect: { gradientMap: 1 } },
  { id: 'amthresh', group: 'pixel', label: 'Threshold (AM)', icon: Tv, effect: { threshold: 0.5 } },
  { id: 'amsharpen', group: 'pixel', label: 'Unsharp mask (AM)', icon: Sparkles, effect: { sharpen: 0.8 } },
  { id: 'amedges', group: 'pixel', label: 'Find edges (AM)', icon: Tv, effect: { findEdges: 1 } },
  { id: 'amecho', group: 'pixel', label: 'Echo keyframes (AM)', icon: Waves, effect: { echo: 4, echoSpacing: 0.1 } },
  { id: 'amshake', group: 'pixel', label: 'Auto-shake (AM)', icon: Waves, effect: { autoShake: 8 } },
  { id: 'amstrobe', group: 'pixel', label: 'Time quantization (AM)', icon: Tv, effect: { timeQuantization: 0.2 } },
  { id: 'ammblur', group: 'pixel', label: 'Motion blur (AM)', icon: Waves, effect: { motionBlur: 0.8 } },
  { id: 'dreamcore', group: 'pixel', label: 'Dreamcore sunset (NothingxArt)', icon: Sparkles, effect: { glow: 0.5, grain: 0.35, chromatic: 2, vignette: 0.5, gradientMap: 0.35, gradientMapFrom: '#2b1e5a', gradientMapTo: '#ffb86b' } },
]

/** Speed-curve rack (board C brief: 15 curves). One main tool with a down
 *  arrow; the connected sub-tool beneath is the segment carousel of curves. */

/** MCP Console: live log of universal-tool calls that operated this app
 *  (window.omniMCP). Proof + feedback channel: the app did the work. */
function McpConsoleSection() {
  const [, force] = useState(0)
  return (
    <Section title="MCP Console">
      <div className="space-y-1" data-testid="mcp-console">
        <div className="flex gap-1">
          <button type="button" data-testid="mcp-refresh" onClick={() => force(v => v + 1)}
            className="h-7 rounded border border-ink-700 bg-ink-900 px-2 font-mono text-[9px] text-ink-300 hover:text-white">refresh</button>
          <button type="button" data-testid="mcp-copy-log" onClick={() => { navigator.clipboard?.writeText(JSON.stringify(mcpLog, null, 1)) }}
            className="h-7 rounded border border-ink-700 bg-ink-900 px-2 font-mono text-[9px] text-ink-300 hover:text-white">copy log json</button>
          <button type="button" data-testid="mcp-help" onClick={() => { omniMcpCall('help'); force(v => v + 1) }}
            className="h-7 rounded border border-ink-700 bg-ink-900 px-2 font-mono text-[9px] text-ink-300 hover:text-white">help</button>
        </div>
        <div className="max-h-44 space-y-0.5 overflow-y-auto rounded border border-ink-800 bg-ink-950 p-1">
          {mcpLog.length === 0 && <div className="font-mono text-[9px] text-ink-500">no calls yet — window.omniMCP.call(tool, params)</div>}
          {mcpLog.slice(-40).map((e, i) => (
            <div key={i} data-testid={`mcp-log-${i}`} className={`truncate font-mono text-[9px] ${e.ok ? 'text-emerald-300' : 'text-rose-400'}`}>
              {e.ok ? '✓' : '✗'} {e.tool} {JSON.stringify(e.params).slice(0, 70)}
            </div>
          ))}
        </div>
        <div className="truncate font-mono text-[8px] text-ink-500">{OMNI_MCP_CATALOG.join(' · ')}</div>
      </div>
    </Section>
  )
}

function SpeedCurveSection({ clip }: { clip: Clip }) {
  const setClipSpeedCurve = useEditor((s) => s.setClipSpeedCurve)
  return (
    <Section title="Speed Curves">
      <div className="space-y-2" data-testid="speed-curve-group">
        <ExpandableToolGroup testId="speedcurve-main" icon={Gauge} label="Speed curve (time remap)">
          <SegmentCarousel
            ariaLabel="Speed curves"
            testId="speedcurve-carousel"
            segments={SPEED_CURVES.map((c) => ({ id: c.id, label: c.name }))}
            value={clip.speedCurve || 'linear'}
            onChange={(id) => setClipSpeedCurve(clip.id, id as SpeedCurveId)}
          />
        </ExpandableToolGroup>
      </div>
    </Section>
  )
}

function AeToolRackSection({ clip }: { clip: Clip }) {
  const setClipEffect = useEditor((s) => s.setClipEffect)
  return (
    <Section title="AE Tool Rack">
      {/* User pattern: main tools with a down arrow, connected sub-tools under. */}
      <div className="space-y-2" data-testid="ae-tool-rack">
        {([
          { key: 'light', label: 'Light & look', icon: Lightbulb },
          { key: 'pixel', label: 'Pixel & warp', icon: Grid3x3 },
          { key: 'beds', label: 'Particle & overlay beds', icon: Feather },
        ] as const).map((g) => {
          const tools = AE_RACK.filter((t) => t.group === g.key)
          return (
            <ExpandableToolGroup key={g.key} testId={`aerack-${g.key}`} icon={g.icon} label={g.label}>
              <SegmentCarousel
                ariaLabel={`${g.label} combos`}
                testId={`aerack-carousel-${g.key}`}
                segments={tools.map((t) => ({ id: t.id, label: t.label }))}
                value={tools[0]?.id || ''}
                onChange={(id) => {
                  const t = tools.find((x) => x.id === id)
                  if (t) setClipEffect(clip.id, t.effect as Partial<ClipEffect>)
                }}
              />
              <div className="flex flex-wrap gap-1">
                {tools.map((tool) => {
                  const Icon = tool.icon
                  return (
                    <button key={tool.id} type="button" data-testid={`ae-rack-${tool.id}`} title={tool.label} aria-label={tool.label}
                      onClick={() => setClipEffect(clip.id, tool.effect as Partial<ClipEffect>)}
                      className="flex h-7 w-7 items-center justify-center rounded border border-ink-700 bg-ink-900 text-ink-300 hover:text-white">
                      <Icon size={13} />
                    </button>
                  )
                })}
              </div>
            </ExpandableToolGroup>
          )
        })}
      </div>
    </Section>
  )
}

export function RightPanel() {
  const rightOpen = useEditor((s) => s.rightOpen)
  const setRightOpen = useEditor((s) => s.setRightOpen)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const rightPanelWidth = useEditor((s) => s.rightPanelWidth)
  const setRightPanelWidth = useEditor((s) => s.setRightPanelWidth)
  const rightPanelFloating = useEditor((s) => s.rightPanelFloating)
  const setRightPanelFloating = useEditor((s) => s.setRightPanelFloating)
  const rightPanelFloat = useEditor((s) => s.rightPanelFloat)
  const setRightPanelFloat = useEditor((s) => s.setRightPanelFloat)
  const unclusterInspector = useEditor((s) => s.unclusterInspector)
  const setUnclusterInspector = useEditor((s) => s.setUnclusterInspector)
  const sidebarSectionMode = useEditor((s) => s.sidebarSectionMode)
  const clip = useEditor((s) => s.clips.find((c) => c.id === s.selectedClipId) ?? null)

  const dragState = useRef<{ kind: 'width' | 'move' | 'resize'; startX: number; startY: number; startW: number; startH: number; baseX: number; baseY: number } | null>(null)

  // Shared pointer-drag helper: width (docked), move (float header), resize (float corner).
  const beginDrag = (
    kind: 'width' | 'move' | 'resize',
    e: React.PointerEvent,
  ) => {
    const float = useEditor.getState().rightPanelFloat
    dragState.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      startW: kind === 'width' ? useEditor.getState().rightPanelWidth : float.w,
      startH: float.h,
      baseX: float.x,
      baseY: float.y,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onDragMove = (e: React.PointerEvent) => {
    const d = dragState.current
    if (!d) return
    if (d.kind === 'width') {
      // Dragging the left edge outward (negative dx) widens the panel.
      setRightPanelWidth(d.startW + (d.startX - e.clientX))
    } else if (d.kind === 'move') {
      setRightPanelFloat({
        x: d.baseX + (e.clientX - d.startX),
        y: d.baseY + (e.clientY - d.startY),
      })
    } else if (d.kind === 'resize') {
      setRightPanelFloat({
        w: d.startW + (e.clientX - d.startX),
        h: d.startH + (e.clientY - d.startY),
      })
    }
  }

  const endDrag = (e: React.PointerEvent) => {
    dragState.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // pointer already released
    }
  }

  const inspectorTitle = selectedClipId ? 'Clip Inspector' : 'Project Inspector'
  const dockerPrefs = useEditor((s) => s.dockerPrefs)
  const [activeSubtool, setActiveSubtool] = useState<'masking' | 'smart-patch' | 'rotomask' | null>(null)
  const subtoolDefs = [
    { id: 'masking' as const, label: 'Masking sub-tool', icon: ScanFace },
    { id: 'smart-patch' as const, label: 'Smart Patch sub-tool', icon: Sparkles },
    { id: 'rotomask' as const, label: 'RotoMask sub-tool', icon: Slice },
  ].filter((d) => dockerPrefs.rightSubtools[d.id] !== false)

  const inspectorBody = (
    <SectionsNavigator
      mode={sidebarSectionMode}
      label="Inspector sections"
      rail={[
        { id: 'clip', label: 'General', icon: Settings2 },
        { id: 'transform', label: 'Transform', icon: Scaling },
        { id: 'video-mask-view', label: 'Mask', icon: Shapes },
        { id: 'appearance', label: 'Appearance', icon: Palette },
        { id: 'audio', label: 'Audio', icon: Volume2 },
        { id: 'effects', label: 'Effects', icon: Sparkles },
        { id: 'text-&-title', label: 'Text', icon: Type },
        { id: 'source', label: 'Source', icon: FileVideo },
      ]}
    >
      {/* Sub-tool dock: shared sub-tools live on the right panel as icons.
          Which ones appear is chosen in Settings > Dockers. */}
      {subtoolDefs.length > 0 && (
        <div className="shrink-0 border-b border-ink-800 px-2 py-1.5">
          <div className="flex items-center gap-1" role="group" aria-label="Sub-tools">
            {subtoolDefs.map((d) => {
              const Icon = d.icon
              const on = activeSubtool === d.id
              return (
                <Tooltip key={d.id} label={d.label}>
                  <button
                    type="button"
                    data-testid={`right-subtool-${d.id}`}
                    aria-label={d.label}
                    aria-pressed={on}
                    onClick={() => setActiveSubtool(on ? null : d.id)}
                    className={`grid h-7 w-7 place-items-center rounded-md border transition-colors ${on ? 'border-teal-400 bg-teal-950/50 text-teal-200' : 'border-ink-700 text-ink-400 hover:text-white'}`}
                  >
                    <Icon size={14} />
                  </button>
                </Tooltip>
              )
            })}
            <InfoTip label="Sub-tools are shared across modes — masking, patching and rotoscoping live here. Choose which appear in Settings → Dockers." />
          </div>
          {activeSubtool === 'masking' && (
            <div className="mt-1.5 max-h-[46vh] overflow-y-auto" data-testid="right-subtool-masking-body">
              <SelectionMaskSubTool context="drawing" />
            </div>
          )}
          {activeSubtool === 'smart-patch' && (
            <div className="mt-1.5 max-h-[46vh] overflow-y-auto" data-testid="right-subtool-smart-patch-body">
              <SmartPatchSubTool />
            </div>
          )}
          {activeSubtool === 'rotomask' && (
            <div className="mt-1.5 max-h-[46vh] overflow-y-auto" data-testid="right-subtool-rotomask-body">
              <RotoMaskSubTool context="drawing" />
            </div>
          )}
        </div>
      )}
      <div
        id="inspector-panel"
        data-testid="inspector-panel"
        role="region"
        aria-labelledby="inspector-heading"
        tabIndex={0}
        className={`flex-1 min-h-0 overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${unclusterInspector ? 'space-y-0.5' : ''}`}
      >
        {clip ? <ClipInspector clip={clip} /> : <ProjectInspector />}
      </div>
    </SectionsNavigator>
  )

  // ---- Floating window mode: draggable + resizable inspector overlay ----
  if (rightPanelFloating) {
    return (
      <>
        <div
          data-testid="right-panel-float-window"
          role="dialog"
          aria-label={inspectorTitle}
          style={{
            position: 'fixed',
            left: rightPanelFloat.x,
            top: rightPanelFloat.y,
            width: rightPanelFloat.w,
            height: rightPanelFloat.h,
            zIndex: 60,
          }}
          className="flex flex-col rounded-xl border border-ink-600 bg-ink-850 shadow-[0_24px_64px_rgba(0,0,0,0.55)] overflow-hidden"
        >
          <div
            data-testid="right-panel-float-header"
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest('button')) return
              beginDrag('move', e)
            }}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            title="Drag to move the inspector"
            className="h-9 shrink-0 flex items-center justify-between gap-2 px-3 border-b border-ink-700 bg-ink-900/90 text-xs font-semibold uppercase tracking-wider text-ink-300 cursor-grab active:cursor-grabbing select-none touch-none"
          >
            <h2 id="inspector-heading" className="truncate" title={inspectorTitle}>
              {inspectorTitle}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="inspector-uncluster-btn"
                title={unclusterInspector ? 'Expanded View' : 'Uncluster / Compact Mode'}
                aria-label={unclusterInspector ? 'Expanded View' : 'Uncluster / Compact Mode'}
                aria-pressed={unclusterInspector}
                onClick={() => setUnclusterInspector(!unclusterInspector)}
                className={`grid h-7 w-7 place-items-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  unclusterInspector ? 'bg-brand text-white shadow-xs' : 'text-ink-400 hover:text-white hover:bg-ink-750'
                }`}
              >
                <SlidersHorizontal size={12} />
              </button>
              <button
                type="button"
                data-testid="inspector-dock-btn"
                title="Dock inspector back into the layout"
                aria-label="Dock inspector"
                onClick={() => setRightPanelFloating(false)}
                className="grid h-7 w-7 place-items-center rounded text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <PanelRight size={13} />
              </button>
              <button
                type="button"
                title="Hide inspector"
                aria-label="Hide inspector"
                onClick={() => setRightOpen(false)}
                className="grid h-7 w-7 place-items-center rounded text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <X size={13} />
              </button>
            </div>
          </div>
          {inspectorBody}
          <div
            data-testid="right-panel-float-resize"
            onPointerDown={(e) => beginDrag('resize', e)}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            title="Drag to resize"
            aria-label="Resize inspector window"
            className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize touch-none"
          >
            <div className="absolute bottom-1 right-1 h-2 w-2 border-b-2 border-r-2 border-ink-500" />
          </div>
        </div>
        {/* Rail keeps dock-side controls available while floating */}
        <div className="w-9 shrink-0 border-l border-ink-700 flex flex-col items-center pt-2">
          <button
            type="button"
            data-testid="inspector-dock-btn-rail"
            title="Dock inspector back into the layout"
            aria-label="Dock inspector"
            onClick={() => setRightPanelFloating(false)}
            className="grid h-8 w-8 place-items-center rounded-md text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <PanelRight size={18} />
          </button>
        </div>
      </>
    )
  }

  // ---- Docked mode (collapsible + width-draggable) ----
  return (
    <div className="shrink-0 flex h-full bg-ink-900 border-l border-ink-700">
      {rightOpen && (
        <div style={{ width: `${rightPanelWidth}px` }} className="relative shrink-0 bg-ink-850 flex flex-col h-full">
          {/* Width drag handle: slide the inspector edge to resize */}
          <div
            data-testid="right-panel-resize-handle"
            role="separator"
            aria-label="Resize inspector width"
            aria-orientation="vertical"
            onPointerDown={(e) => beginDrag('width', e)}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            title="Drag to resize inspector"
            className="absolute left-0 top-0 bottom-0 w-1.5 z-10 cursor-col-resize bg-transparent hover:bg-brand/60 transition-colors touch-none"
          />
          <div className="h-9 shrink-0 flex items-center justify-between px-3 border-b border-ink-700 text-xs font-semibold uppercase tracking-wider text-ink-300">
            <h2 id="inspector-heading" className="truncate pr-2" title={inspectorTitle}>
              {inspectorTitle}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="inspector-uncluster-btn"
                title={unclusterInspector ? 'Expanded View' : 'Uncluster / Compact Mode'}
                aria-label={unclusterInspector ? 'Expanded View' : 'Uncluster / Compact Mode'}
                aria-pressed={unclusterInspector}
                onClick={() => setUnclusterInspector(!unclusterInspector)}
                className={`grid h-8 w-8 place-items-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  unclusterInspector ? 'bg-brand text-white shadow-xs' : 'text-ink-400 hover:text-white hover:bg-ink-750'
                }`}
              >
                <SlidersHorizontal size={12} />
              </button>
              <button
                type="button"
                data-testid="inspector-float-btn"
                title="Float inspector into a movable window"
                aria-label="Float inspector into a movable window"
                onClick={() => setRightPanelFloating(true)}
                className="grid h-8 w-8 place-items-center rounded text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <PictureInPicture2 size={13} />
              </button>
            </div>
          </div>
          {inspectorBody}
        </div>
      )}
      <div className="w-9 shrink-0 border-l border-ink-700 flex flex-col items-center pt-2 gap-1">
        <button
          type="button"
          title={rightOpen ? 'Hide inspector' : 'Show inspector'}
          aria-label={rightOpen ? 'Hide inspector' : 'Show inspector'}
          aria-expanded={rightOpen}
          aria-controls={rightOpen ? 'inspector-panel' : undefined}
          onClick={() => setRightOpen(!rightOpen)}
          className="grid h-8 w-8 place-items-center rounded-md text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {rightOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </button>
        {rightOpen && (
          <button
            type="button"
            data-testid="inspector-rail-float-btn"
            title="Float inspector into a movable window"
            aria-label="Float inspector into a movable window"
            onClick={() => setRightPanelFloating(true)}
            className="grid h-8 w-8 place-items-center rounded-md text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <PictureInPicture2 size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
