import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useEditor } from '../store'

const FPS_CHOICES = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60, 120]

/**
 * AE-style Composition Settings popup (Ctrl+K in After Effects): the exact
 * numeric sequence size, frame rate and background colour. Previously the
 * store exposed setCustomSequenceDimensions/setSequenceBackground with no UI
 * at all — this dialog is the missing surface, and every field writes through
 * to live state consumed by the renderer (playback base fill) and exports.
 */
export default function CompositionSettingsModal({ onClose }: { onClose: () => void }) {
  const sequenceSettings = useEditor((s) => s.sequenceSettings)
  const projectFps = useEditor((s) => s.projectFps)
  const sequenceBackground = useEditor((s) => s.sequenceBackground)
  const clips = useEditor((s) => s.clips)
  const setCustomSequenceDimensions = useEditor((s) => s.setCustomSequenceDimensions)
  const setProjectFps = useEditor((s) => s.setProjectFps)
  const setSequenceBackground = useEditor((s) => s.setSequenceBackground)

  const [w, setW] = useState(sequenceSettings.width)
  const [h, setH] = useState(sequenceSettings.height)

  const duration = useMemo(() => {
    let end = 0
    for (const c of clips) end = Math.max(end, (c.start ?? 0) + (c.duration ?? 0))
    return end
  }, [clips])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const applyDims = () => setCustomSequenceDimensions(Math.round(w), Math.round(h))

  return (
    <div
      data-testid="composition-settings-modal"
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Composition settings"
        className="w-[340px] rounded-xl border border-ink-600 bg-ink-900 shadow-[0_24px_80px_rgba(0,0,0,.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-300">Composition settings</span>
          <button
            type="button"
            aria-label="Close composition settings"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-md text-ink-400 hover:bg-ink-700 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
        <div className="grid gap-2 p-3 text-xs text-ink-200">
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1">
              <span className="text-[10px] uppercase tracking-wider text-ink-500">Width</span>
              <input
                type="number" min={64} max={7680} value={w}
                onChange={(e) => setW(Number(e.target.value))}
                onBlur={applyDims}
                data-testid="comp-width"
                className="h-8 rounded-md border border-ink-600 bg-ink-800 px-2 text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-[10px] uppercase tracking-wider text-ink-500">Height</span>
              <input
                type="number" min={64} max={7680} value={h}
                onChange={(e) => setH(Number(e.target.value))}
                onBlur={applyDims}
                data-testid="comp-height"
                className="h-8 rounded-md border border-ink-600 bg-ink-800 px-2 text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
            </label>
          </div>
          <label className="grid gap-1">
            <span className="text-[10px] uppercase tracking-wider text-ink-500">Frame rate</span>
            <select
              value={projectFps}
              onChange={(e) => setProjectFps(Number(e.target.value))}
              data-testid="comp-fps"
              className="h-8 rounded-md border border-ink-600 bg-ink-800 px-2 text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {FPS_CHOICES.map((f) => (
                <option key={f} value={f}>{f} fps</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-[10px] uppercase tracking-wider text-ink-500">Background</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={sequenceBackground}
                onChange={(e) => setSequenceBackground(e.target.value)}
                data-testid="comp-bg"
                className="h-8 w-10 cursor-pointer rounded-md border border-ink-600 bg-ink-800 p-1"
              />
              <span className="font-mono text-ink-400">{sequenceBackground}</span>
            </div>
          </label>
          <div className="grid grid-cols-2 gap-2 border-t border-ink-700 pt-2 text-[11px] text-ink-400">
            <span>Duration <strong className="text-ink-200">{duration.toFixed(1)}s</strong></span>
            <span className="text-right">{sequenceSettings.label}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
