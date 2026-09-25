import React, { useState } from 'react'
import { Sparkles, Plus, Clock, Shuffle } from 'lucide-react'
import { useEditor } from '../store'
import type { TransitionType } from '../types'

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
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const addTransition = useEditor((s) => s.addTransition)
  const [duration, setDuration] = useState(1.0)

  const handleApplyToSelected = (type: TransitionType) => {
    const selectedClip = clips.find((c) => c.id === selectedClipId)
    if (!selectedClip) {
      // Find the first adjacent pair
      const videoClips = clips.filter((c) => c.kind !== 'audio').sort((a, b) => a.start - b.start)
      if (videoClips.length >= 2) {
        const c1 = videoClips[0]
        const c2 = videoClips[1]
        addTransition({
          type,
          fromClipId: c1.id,
          toClipId: c2.id,
          trackId: c1.trackId,
          startTime: Math.max(0, c1.start + c1.duration - duration / 2),
          duration,
          alignment: 'centered',
          enabled: true,
        })
      }
      return
    }

    // Find adjacent clip on same track
    const adj = clips.find(
      (c) => c.trackId === selectedClip.trackId && c.id !== selectedClip.id && Math.abs(c.start - (selectedClip.start + selectedClip.duration)) < 0.3,
    )

    addTransition({
      type,
      fromClipId: selectedClip.id,
      toClipId: adj ? adj.id : selectedClip.id,
      trackId: selectedClip.trackId,
      startTime: Math.max(0, selectedClip.start + selectedClip.duration - duration / 2),
      duration,
      alignment: 'centered',
      enabled: true,
    })
  }

  return (
    <div data-testid="transitions-panel" className="p-3 text-xs text-ink-200 select-none">
      {/* Duration configuration */}
      <div className="flex items-center justify-between mb-3 p-2 rounded-lg bg-ink-900 border border-ink-800">
        <span className="text-[11px] text-ink-400 flex items-center gap-1">
          <Clock size={12} />
          <span>Default Duration</span>
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

      <div className="text-[10px] uppercase font-semibold text-ink-500 mb-2 tracking-wider">
        Standard Dissolves & Wipes
      </div>

      <div className="grid grid-cols-1 gap-2">
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
              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded bg-ink-800 hover:bg-brand text-ink-300 hover:text-white text-[11px] transition-colors"
            >
              <Plus size={12} />
              <span>Apply</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
