import { useState } from 'react'
import { AlertCircle, Clock, Play, Sparkles, Trash2 } from 'lucide-react'
import { useEditor } from '../store'
import type { Clip, Transition, TransitionType } from '../types'

interface TransitionPresetDef {
  id: TransitionType
  name: string
  description: string
}

const TRANSITIONS: TransitionPresetDef[] = [
  { id: 'cross_dissolve', name: 'Cross Dissolve', description: 'Smooth opacity blend from outgoing to incoming frame.' },
  { id: 'dip_to_black', name: 'Dip to Black', description: 'Fades down to pure black, then fades up to incoming media.' },
  { id: 'dip_to_white', name: 'Dip to White', description: 'Flashes to pure white, then resolves into next clip.' },
  { id: 'wipe_left', name: 'Wipe Left', description: 'Horizontal edge wipes across from right to left.' },
  { id: 'wipe_right', name: 'Wipe Right', description: 'Horizontal edge wipes across from left to right.' },
  { id: 'slide_left', name: 'Slide Left', description: 'Incoming clip pushes outgoing clip smoothly offscreen.' },
  { id: 'zoom', name: 'Zoom Push', description: 'Camera pushes forward through outgoing into incoming clip.' },
]

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
      // A transition needs an actual cut (or a very small edit gap) and enough
      // material on both sides of it for the centred audition window.
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

export function TransitionsPanel() {
  const transitions = useEditor((s) => s.transitions || [])
  const removeTransition = useEditor((s) => s.removeTransition)
  const startVisualPreview = useEditor((s) => s.startVisualPreview)
  const [duration, setDuration] = useState(1.0)
  const [notice, setNotice] = useState<string | null>(null)

  const previewTransition = (preset: TransitionPresetDef) => {
    const candidate = findNearestTransitionCandidate(duration)
    if (!candidate) {
      setNotice(`No usable cut found. Place two adjacent clips near the playhead, each at least ${(duration / 2).toFixed(1)}s long.`)
      return
    }
    setNotice(null)
    const startTime = Math.max(candidate.fromClip.start, candidate.cut - duration / 2)
    const transition: Transition = {
      id: 'visual-preview-transition',
      type: preset.id,
      fromClipId: candidate.fromClip.id,
      toClipId: candidate.toClip.id,
      trackId: candidate.fromClip.trackId,
      startTime,
      duration,
      alignment: 'centered',
      enabled: true,
    }
    startVisualPreview({
      kind: 'transition',
      transition,
      label: `${preset.name} · ${candidate.fromClip.name} → ${candidate.toClip.name}`,
      startTime,
      endTime: startTime + duration,
    })
  }

  const previewPlacedTransition = (transition: Transition) => {
    setNotice(null)
    startVisualPreview({
      kind: 'range-playback',
      label: `${transition.type.replace(/_/g, ' ')} · placed transition`,
      startTime: transition.startTime,
      endTime: transition.startTime + transition.duration,
    })
  }

  return (
    <div data-testid="transitions-panel" className="p-3 text-xs text-ink-200 select-none space-y-3">
      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-ink-900 border border-ink-800">
        <span className="text-[11px] text-ink-400 flex items-center gap-1">
          <Clock size={12} />
          <span>Transition Duration</span>
        </span>
        <div className="flex items-center gap-1">
          {[0.5, 1.0, 1.5, 2.0].map((d) => (
            <button
              key={d}
              type="button"
              data-testid={`transition-dur-${d}`}
              onClick={() => setDuration(d)}
              className={`min-h-[24px] px-1.5 py-1 rounded text-[10px] font-mono transition-colors ${
                duration === d ? 'bg-brand text-white font-semibold' : 'bg-ink-800 text-ink-400 hover:text-white'
              }`}
            >
              {d}s
            </button>
          ))}
        </div>
      </div>


      {notice && (
        <div data-testid="transition-preview-notice" className="flex items-start gap-1.5 p-2 rounded-md bg-amber-950/30 border border-amber-900/70 text-amber-200 text-[11px]" role="status">
          <AlertCircle size={13} className="mt-px shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="text-[10px] uppercase font-semibold text-ink-500 tracking-wider">
        Video Transitions
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        {TRANSITIONS.map((preset) => (
          <div
            key={preset.id}
            data-testid={`transition-card-${preset.id}`}
            onClick={() => previewTransition(preset)}
            className="group cursor-pointer p-2.5 rounded-lg bg-ink-900 border border-ink-800 hover:border-brand/60 transition-all flex items-center justify-between"
          >
            <div className="min-w-0 flex-1 pr-2">
              <div className="font-medium text-ink-100 flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-400 shrink-0" />
                <span>{preset.name}</span>
              </div>
              <div className="text-[10px] text-ink-400 mt-0.5 leading-tight">{preset.description}</div>
            </div>

            <button
              type="button"
              data-testid={`apply-trans-btn-${preset.id}`}
              title={`Preview ${preset.name}; Apply from the monitor to add it`}
              aria-label={`Preview ${preset.name} transition`}
              onClick={(event) => { event.stopPropagation(); previewTransition(preset) }}
              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded bg-brand/20 hover:bg-brand text-brand-400 hover:text-white text-[11px] font-medium transition-colors"
            >
              <Play size={12} className="shrink-0" />
              <span>Preview</span>
            </button>
          </div>
        ))}
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
