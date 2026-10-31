import { prepareDeviceModels } from '../lib/device3d'
import SegmentCarousel from './SegmentCarousel'
import { useEffect, useState } from 'react'
import { AlertCircle, Check, Clock, Play, Sparkles, Trash2 } from 'lucide-react'
import { useEditor } from '../store'
import type { Clip, Transition } from '../types'
import { TRANSITION_PRESETS, applyTransitionPreset, TRANSITION_MIN_DURATION, TRANSITION_MAX_DURATION, type TransitionPresetDef } from '../lib/transitionPresets'

interface TransitionCandidate {
  fromClip: Clip
  toClip: Clip
  cut: number
  distance: number
  selected: boolean
}

function findNearestTransitionCandidate(duration: number): TransitionCandidate | null {
  const state = useEditor.getState()
  const half = duration / 2
  const candidates: TransitionCandidate[] = []

  for (const track of state.tracks) {
    if (track.type !== 'video' || track.hidden) continue
    const clips = state.clips
      .filter((clip) => clip.trackId === track.id && !clip.hidden && clip.kind !== 'audio' && clip.kind !== 'adjustment')
      .sort((a, b) => a.start - b.start)

    for (let index = 0; index < clips.length - 1; index++) {
      const fromClip = clips[index]
      const toClip = clips[index + 1]
      const cut = fromClip.start + fromClip.duration
      const gap = toClip.start - cut
      if (gap < -0.01 || gap > 0.5) continue
      if (fromClip.duration < half || toClip.duration < half) continue
      candidates.push({
        fromClip,
        toClip,
        cut,
        distance: Math.abs(cut - state.playhead),
        selected: state.selectedClipId === fromClip.id || state.selectedClipId === toClip.id,
      })
    }
  }

  candidates.sort((a, b) => Number(b.selected) - Number(a.selected) || a.distance - b.distance || a.cut - b.cut)
  return candidates[0] ?? null
}

// One tile per pillar (BrandBird-style sub-modes): selecting a pillar shows
// only its variants in an inner-scroll list, keeping the panel short.
// Glitch is NOT a transition anymore — it moved to the Effects tab where
// every property (intensity, style, scanlines, static, seed, rate) is
// editable and keyframeable. The pillar remains for legacy saved projects.
const PILLARS: { key: string; label: string; cats: TransitionPresetDef['category'][] }[] = [
  { key: 'device', label: 'Device 3D', cats: ['Device 3D'] },
  { key: 'blur', label: 'Blur', cats: ['Blur'] },
  { key: 'dissolve', label: 'Dissolve', cats: ['Dissolve'] },
  { key: 'light', label: 'Light', cats: ['Light'] },
  { key: 'flicker', label: 'Flicker', cats: ['Flicker'] },
  { key: 'tv', label: 'TV', cats: ['TV'] },
  { key: 'overlay', label: 'Overlay', cats: ['Overlay'] },
  { key: 'scene', label: 'Scene', cats: ['Scene'] },
  { key: 'classic', label: 'Classic', cats: ['Wipe', 'Slide', 'Shapes', 'Zoom & Motion', 'Special'] },
]

export function TransitionsPanel() {
  useEffect(() => { void prepareDeviceModels().catch(error => console.warn('Device models could not preload; canvas fallback available', error)) }, [])
  const transitions = useEditor((s) => s.transitions || [])
  const removeTransition = useEditor((s) => s.removeTransition)
  const startVisualPreview = useEditor((s) => s.startVisualPreview)
  const [duration, setDuration] = useState(1.0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pillar, setPillar] = useState('blur')
  const [notice, setNotice] = useState<string | null>(null)
  const [placedMsg, setPlacedMsg] = useState<string | null>(null)

  const selectedPreset = TRANSITION_PRESETS.find((p) => p.id === selectedId) || null

  const clampDuration = (d: number) => Math.min(TRANSITION_MAX_DURATION, Math.max(TRANSITION_MIN_DURATION, Math.round(d * 10) / 10))

  const previewTransition = (preset: TransitionPresetDef, durOverride?: number) => {
    const dur = durOverride ?? duration
    const candidate = findNearestTransitionCandidate(dur)
    if (!candidate) {
      setNotice(`No usable cut found. Place two adjacent clips near the playhead, each at least ${(dur / 2).toFixed(1)}s long.`)
      return
    }
    setNotice(null)
    const startTime = Math.max(candidate.fromClip.start, candidate.cut - dur / 2)
    const transition: Transition = {
      id: 'visual-preview-transition',
      type: preset.id,
      fromClipId: candidate.fromClip.id,
      toClipId: candidate.toClip.id,
      trackId: candidate.fromClip.trackId,
      startTime,
      duration: dur,
      alignment: 'centered',
      enabled: true,
    }
    startVisualPreview({
      kind: 'transition',
      transition,
      label: `${preset.name}, ${candidate.fromClip.name} → ${candidate.toClip.name}`,
      startTime,
      endTime: startTime + dur,
    })
  }

  // Selecting a preset loads its BASE seconds into the duration control;
  // the user then raises/lowers it inside the 0.1–5s cap.
  const selectPreset = (preset: TransitionPresetDef) => {
    setSelectedId(preset.id)
    const base = clampDuration(preset.baseDuration)
    setDuration(base)
    previewTransition(preset, base)
  }

  const placeTransition = (preset: TransitionPresetDef) => {
    const result = applyTransitionPreset(preset.id, duration)
    if (!result.ok) {
      setPlacedMsg(null)
      setNotice(result.error || 'Could not place the transition.')
      return
    }
    setNotice(null)
    setPlacedMsg(`${preset.name} placed: ${result.from?.name} → ${result.to?.name} (${duration.toFixed(1)}s at the cut).`)
  }

  const previewPlacedTransition = (transition: Transition) => {
    setNotice(null)
    startVisualPreview({
      kind: 'range-playback',
      label: `${transition.type.replace(/_/g, ' ')}, placed transition`,
      startTime: transition.startTime,
      endTime: transition.startTime + transition.duration,
    })
  }

  return (
    <div data-testid="transitions-panel" className="p-3 text-xs text-ink-200 select-none space-y-3">
      <div className="p-2 rounded-lg bg-ink-900 border border-ink-800 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-ink-400 flex items-center gap-1">
            <Clock size={12} />
            <span>Transition Duration</span>
          </span>
          <span data-testid="transition-duration-value" className="font-mono text-[11px] text-ink-100">{duration.toFixed(1)}s</span>
        </div>
        <input
          type="range"
          data-testid="transition-duration-slider"
          min={TRANSITION_MIN_DURATION}
          max={TRANSITION_MAX_DURATION}
          step={0.1}
          value={duration}
          onChange={(e) => setDuration(clampDuration(Number(e.target.value)))}
          className="w-full accent-fuchsia-400"
          aria-label="Transition duration in seconds (0.1 to 5)"
        />
        <div className="flex items-center gap-1">
          {[0.5, 1.0, 1.5, 2.0, 3.0, 5.0].map((d) => (
            <button
              key={d}
              type="button"
              data-testid={`transition-dur-${d}`}
              onClick={() => setDuration(d)}
              className={`min-h-[24px] px-1.5 py-1 rounded text-[10px] font-mono whitespace-nowrap leading-none transition-colors ${
                duration === d ? 'bg-brand text-white font-semibold' : 'bg-ink-800 text-ink-400 hover:text-white'
              }`}
            >
              {d}s
            </button>
          ))}
        </div>
        <p className="text-[10px] text-ink-500" data-testid="transition-requirement">
          0.1–5s. Needs a cut with at least {(duration / 2).toFixed(2)}s of clip on each side — pick clips long enough for the duration you choose.
        </p>
        {selectedPreset && (
          <p className="text-[10px] text-ink-400" data-testid="transition-base-loaded">
            {selectedPreset.name}: base {selectedPreset.baseDuration}s loaded — raise or lower it above (0.1s floor, 5s cap).
          </p>
        )}
      </div>

      {notice && (
        <div data-testid="transition-preview-notice" className="flex items-start gap-1.5 p-2 rounded-md bg-amber-950/30 border border-amber-900/70 text-amber-200 text-[11px]" role="status">
          <AlertCircle size={13} className="mt-px shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {placedMsg && (
        <div data-testid="transition-placed-notice" className="flex items-start gap-1.5 p-2 rounded-md bg-emerald-950/30 border border-emerald-900/70 text-emerald-200 text-[11px]" role="status">
          <Check size={13} className="mt-px shrink-0" />
          <span>{placedMsg}</span>
        </div>
      )}

      <div>
        <div className="text-[10px] uppercase font-semibold text-ink-500 tracking-wider mb-1.5">Pillars</div>
        <div className="grid grid-cols-4 gap-1">
          {PILLARS.map((pl) => {
            const count = TRANSITION_PRESETS.filter((p) => pl.cats.includes(p.category)).length
            return (
              <button
                key={pl.key}
                type="button"
                data-testid={`transition-pillar-${pl.key}`}
                onClick={() => setPillar(pl.key)}
                className={`min-h-[26px] px-1 py-1 rounded text-[10px] font-medium whitespace-nowrap leading-none transition-colors ${
                  pillar === pl.key ? 'bg-brand text-white font-semibold' : 'bg-ink-800 text-ink-400 hover:text-white'
                }`}
              >
                {pl.label} <span className="opacity-70 font-mono">{count}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-1.5">
          <SegmentCarousel
            ariaLabel={`${pillar} presets`}
            testId={`pillar-carousel-${pillar}`}
            segments={TRANSITION_PRESETS.filter((p) => (PILLARS.find((pl) => pl.key === pillar)?.cats || []).includes(p.category)).map((p) => ({ id: p.id, label: p.name }))}
            value={selectedId || TRANSITION_PRESETS.filter((p) => (PILLARS.find((pl) => pl.key === pillar)?.cats || []).includes(p.category))[0]?.id || ''}
            onChange={(id) => {
              const p = TRANSITION_PRESETS.find((x) => x.id === id)
              if (p) selectPreset(p)
            }}
          />
        </div>
        <div data-testid="transition-variant-list" className="mt-1.5 max-h-[430px] overflow-y-auto pr-1 space-y-1.5">
          {TRANSITION_PRESETS.filter((p) => (PILLARS.find((pl) => pl.key === pillar)?.cats || []).includes(p.category)).map((preset) => (
            <div
              key={preset.id}
              data-testid={`transition-card-${preset.id}`}
              onClick={() => selectPreset(preset)}
              className={`group cursor-pointer p-2 rounded-lg bg-ink-900 border hover:border-brand/60 transition-all flex items-center justify-between ${selectedId === preset.id ? 'border-brand ring-1 ring-brand/50' : 'border-ink-800'}`}
            >
              <div className="min-w-0 flex-1 pr-2">
                <div className="font-medium text-ink-100 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-amber-400 shrink-0" />
                  <span className="truncate">{preset.name}</span>
                  <span data-testid={`transition-base-${preset.id}`} className="text-[9px] font-mono px-1 py-px rounded bg-ink-800 text-ink-400 whitespace-nowrap">base {preset.baseDuration}s</span>
                </div>
                <div className="text-[10px] text-ink-400 mt-0.5 leading-tight truncate">{preset.description}</div>
              </div>
              <div className="shrink-0 flex items-center gap-1">
                <button
                  type="button"
                  data-testid={`apply-trans-btn-${preset.id}`}
                  title={`Preview ${preset.name}; Apply from the monitor to add it`}
                  aria-label={`Preview ${preset.name} transition`}
                  onClick={(event) => { event.stopPropagation(); previewTransition(preset) }}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-brand/20 hover:bg-brand text-brand-400 hover:text-white text-[11px] font-medium whitespace-nowrap leading-none transition-colors"
                >
                  <Play size={12} className="shrink-0" />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  data-testid={`place-trans-btn-${preset.id}`}
                  title={`Place ${preset.name} at the nearest usable cut`}
                  aria-label={`Apply ${preset.name} transition`}
                  onClick={(event) => { event.stopPropagation(); placeTransition(preset) }}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white text-[11px] font-medium whitespace-nowrap leading-none transition-colors"
                >
                  <Check size={12} className="shrink-0" />
                  <span>Apply</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {transitions.length > 0 && (
        <div className="pt-2 border-t border-ink-800">
          <div className="text-[10px] uppercase font-semibold text-ink-500 mb-1.5 tracking-wider">
            Active Cut Transitions ({transitions.length})
          </div>
          <div className="space-y-1">
            {transitions.map((transition) => (
              <div
                key={transition.id}
                data-testid={`placed-transition-${transition.id}`}
                className="flex items-center justify-between px-2 py-1.5 rounded bg-ink-900/60 border border-ink-800 text-[11px]"
              >
                <button
                  type="button"
                  data-testid={`preview-existing-transition-${transition.id}`}
                  onClick={() => previewPlacedTransition(transition)}
                  className="min-w-0 flex-1 truncate pr-2 text-left"
                  title="Play this placed transition from its start"
                >
                  <span className="font-medium text-ink-200 capitalize">{transition.type.replace(/_/g, ' ')}</span>
                  <span className="text-ink-500 text-[10px] ml-1.5 font-mono">({transition.duration}s @ {transition.startTime.toFixed(2)}s)</span>
                </button>
                <button
                  type="button"
                  data-testid={`preview-transition-btn-${transition.id}`}
                  onClick={() => previewPlacedTransition(transition)}
                  className="mr-1 grid h-6 w-6 shrink-0 place-items-center rounded text-brand-300 hover:bg-brand/20"
                  title="Preview this placed transition"
                  aria-label={`Preview placed ${transition.type.replace(/_/g, ' ')} transition`}
                >
                  <Play size={11} />
                </button>
                <button
                  type="button"
                  title="Remove transition"
                  aria-label={`Remove ${transition.type.replace(/_/g, ' ')} transition`}
                  onClick={() => removeTransition(transition.id)}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded text-ink-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
