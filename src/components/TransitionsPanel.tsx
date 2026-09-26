import React, { useState } from 'react'
import { Sparkles, Plus, Clock, Shuffle, Trash2, CheckCircle2 } from 'lucide-react'
import { useEditor } from '../store'
import type { Clip, TransitionType } from '../types'

interface TransitionPresetDef {
  id: TransitionType
  name: string
  description: string
  previewClass: string
}

const TRANSITIONS: TransitionPresetDef[] = [
  {
    id: 'cross_dissolve',
    name: 'Cross Dissolve',
    description: 'Smooth opacity blend from outgoing to incoming frame.',
    previewClass: 'from-brand/40 to-violet-500/40',
  },
  {
    id: 'dip_to_black',
    name: 'Dip to Black',
    description: 'Fades down to pure black, then fades up to incoming media.',
    previewClass: 'from-black to-ink-950',
  },
  {
    id: 'dip_to_white',
    name: 'Dip to White',
    description: 'Flashes to pure white flash, then resolves into next clip.',
    previewClass: 'from-white/30 to-amber-200/30',
  },
  {
    id: 'wipe_left',
    name: 'Wipe Left',
    description: 'Horizontal edge wipes across from right to left.',
    previewClass: 'from-cyan-500/30 to-blue-600/30',
  },
  {
    id: 'wipe_right',
    name: 'Wipe Right',
    description: 'Horizontal edge wipes across from left to right.',
    previewClass: 'from-blue-500/30 to-indigo-600/30',
  },
  {
    id: 'slide_left',
    name: 'Slide Left',
    description: 'Incoming clip pushes outgoing clip smoothly offscreen.',
    previewClass: 'from-emerald-500/30 to-teal-600/30',
  },
  {
    id: 'zoom',
    name: 'Zoom Push',
    description: 'Camera pushes forward through outgoing into incoming clip.',
    previewClass: 'from-amber-500/30 to-red-500/30',
  },
]

export function TransitionsPanel() {
  const clips = useEditor((s) => s.clips)
  const transitions = useEditor((s) => s.transitions || [])
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const addTransition = useEditor((s) => s.addTransition)
  const removeTransition = useEditor((s) => s.removeTransition)
  const [duration, setDuration] = useState(1.0)
  const [lastApplied, setLastApplied] = useState<string | null>(null)

  const handleApplyToSelected = (type: TransitionType) => {
    const st = useEditor.getState()
    const allClips = st.clips.filter((c) => c.kind !== 'audio').sort((a, b) => a.start - b.start)
    if (allClips.length === 0) return

    let fromClip: Clip | undefined
    let toClip: Clip | undefined

    if (selectedClipId) {
      const sel = allClips.find((c) => c.id === selectedClipId)
      if (sel) {
        // Check following adjacent clip on same track
        const next = allClips.find(
          (c) => c.trackId === sel.trackId && c.id !== sel.id && Math.abs(c.start - (sel.start + sel.duration)) < 0.5,
        )
        if (next) {
          fromClip = sel
          toClip = next
        } else {
          // Check preceding adjacent clip on same track
          const prev = allClips.find(
            (c) => c.trackId === sel.trackId && c.id !== sel.id && Math.abs(sel.start - (c.start + c.duration)) < 0.5,
          )
          if (prev) {
            fromClip = prev
            toClip = sel
          }
        }
      }
    }

    // Fallback: take first adjacent pair on any track
    if (!fromClip || !toClip) {
      for (let i = 0; i < allClips.length - 1; i++) {
        const c1 = allClips[i]
        const c2 = allClips[i + 1]
        if (c1.trackId === c2.trackId && Math.abs(c2.start - (c1.start + c1.duration)) < 0.5) {
          fromClip = c1
          toClip = c2
          break
        }
      }
    }

    // Single clip fallback
    if (!fromClip) fromClip = allClips[0]
    if (!toClip) toClip = allClips[1] || allClips[0]

    const cutPoint = fromClip.start + fromClip.duration
    const startTime = Math.max(0, cutPoint - duration / 2)

    addTransition({
      type,
      fromClipId: fromClip.id,
      toClipId: toClip.id,
      trackId: fromClip.trackId,
      startTime,
      duration,
      alignment: 'centered',
      enabled: true,
    })

    // Seek playhead to start of transition to preview immediately
    st.setPlayhead(startTime)
    setLastApplied(type)
    setTimeout(() => setLastApplied(null), 2500)
  }

  return (
    <div data-testid="transitions-panel" className="p-3 text-xs text-ink-200 select-none space-y-3">
      {/* Duration configuration */}
      <div className="flex items-center justify-between p-2 rounded-lg bg-ink-900 border border-ink-800">
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
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                duration === d ? 'bg-brand text-white font-semibold' : 'bg-ink-800 text-ink-400 hover:text-white'
              }`}
            >
              {d}s
            </button>
          ))}
        </div>
      </div>

      {lastApplied && (
        <div className="flex items-center gap-1.5 p-2 rounded-md bg-brand/10 border border-brand/30 text-brand text-[11px] animate-in fade-in duration-100">
          <CheckCircle2 size={13} />
          <span>Applied {lastApplied.replace(/_/g, ' ')} to timeline cut!</span>
        </div>
      )}

      <div className="text-[10px] uppercase font-semibold text-ink-500 tracking-wider">
        Video Transitions
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        {TRANSITIONS.map((tr) => (
          <div
            key={tr.id}
            data-testid={`transition-card-${tr.id}`}
            className="group p-2.5 rounded-lg bg-ink-900 border border-ink-800 hover:border-brand/60 transition-all flex items-center justify-between"
          >
            <div className="min-w-0 pr-2">
              <div className="font-medium text-ink-100 flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-400 shrink-0" />
                <span>{tr.name}</span>
              </div>
              <div className="text-[10px] text-ink-400 mt-0.5 leading-tight">{tr.description}</div>
            </div>

            <button
              type="button"
              data-testid={`apply-trans-btn-${tr.id}`}
              title={`Apply ${tr.name} to cut`}
              onClick={() => handleApplyToSelected(tr.id)}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded bg-brand/20 hover:bg-brand text-brand hover:text-white text-[11px] font-medium transition-colors"
            >
              <Plus size={12} />
              <span>Apply</span>
            </button>
          </div>
        ))}
      </div>

      {/* Active Transitions in Project */}
      {transitions.length > 0 && (
        <div className="pt-2 border-t border-ink-800">
          <div className="text-[10px] uppercase font-semibold text-ink-500 mb-1.5 tracking-wider">
            Active Cut Transitions ({transitions.length})
          </div>
          <div className="space-y-1">
            {transitions.map((tr) => (
              <div
                key={tr.id}
                className="flex items-center justify-between px-2 py-1.5 rounded bg-ink-900/60 border border-ink-800 text-[11px]"
              >
                <div className="truncate pr-2">
                  <span className="font-medium text-ink-200 capitalize">{tr.type.replace(/_/g, ' ')}</span>
                  <span className="text-ink-500 text-[10px] ml-1.5 font-mono">({tr.duration}s @ {tr.startTime.toFixed(2)}s)</span>
                </div>
                <button
                  type="button"
                  title="Remove transition"
                  onClick={() => removeTransition(tr.id)}
                  className="p-1 rounded text-ink-400 hover:text-red-400 transition-colors"
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
