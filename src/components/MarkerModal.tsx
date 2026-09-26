import React, { useState, useEffect } from 'react'
import { X, Bookmark, Trash2, Check, Clock } from 'lucide-react'
import { useEditor } from '../store'
import type { MarkerColor, TimelineMarker } from '../types'
import { formatTimecode } from '../lib/time'

const MARKER_COLORS: { id: MarkerColor; label: string; hex: string; bgClass: string; textClass: string }[] = [
  { id: 'blue', label: 'Blue', hex: '#3b82f6', bgClass: 'bg-blue-500', textClass: 'text-blue-400' },
  { id: 'green', label: 'Green', hex: '#10b981', bgClass: 'bg-emerald-500', textClass: 'text-emerald-400' },
  { id: 'red', label: 'Red', hex: '#ef4444', bgClass: 'bg-red-500', textClass: 'text-red-400' },
  { id: 'yellow', label: 'Yellow', hex: '#f59e0b', bgClass: 'bg-amber-500', textClass: 'text-amber-400' },
  { id: 'purple', label: 'Purple', hex: '#a855f7', bgClass: 'bg-purple-500', textClass: 'text-purple-400' },
  { id: 'orange', label: 'Orange', hex: '#f97316', bgClass: 'bg-orange-500', textClass: 'text-orange-400' },
]

export function MarkerModal() {
  const activeMarkerModalId = useEditor((s) => s.activeMarkerModalId)
  const setActiveMarkerModalId = useEditor((s) => s.setActiveMarkerModalId)
  const markers = useEditor((s) => s.markers)
  const updateMarker = useEditor((s) => s.updateMarker)
  const removeMarker = useEditor((s) => s.removeMarker)
  const projectFps = useEditor((s) => s.projectFps)

  const activeMarker = markers.find((m) => m.id === activeMarkerModalId)

  const [label, setLabel] = useState('')
  const [notes, setNotes] = useState('')
  const [color, setColor] = useState<MarkerColor>('blue')
  const [duration, setDuration] = useState<number>(0)

  useEffect(() => {
    if (activeMarker) {
      setLabel(activeMarker.label)
      setNotes(activeMarker.notes || '')
      setColor(activeMarker.color)
      setDuration(activeMarker.duration || 0)
    }
  }, [activeMarker])

  if (!activeMarkerModalId || !activeMarker) return null

  const handleSave = () => {
    updateMarker(activeMarker.id, {
      label: label.trim() || 'Marker',
      notes: notes.trim(),
      color,
      duration: Math.max(0, duration),
    })
    setActiveMarkerModalId(null)
  }

  const handleDelete = () => {
    removeMarker(activeMarker.id)
    setActiveMarkerModalId(null)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="marker-dialog-title"
      data-testid="marker-modal"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none"
    >
      <div className="relative w-full max-w-sm rounded-xl border border-ink-700 bg-ink-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-800 px-4 py-3 bg-ink-950/70">
          <div className="flex items-center gap-2">
            <Bookmark size={16} className={MARKER_COLORS.find((c) => c.id === color)?.textClass} />
            <h3 id="marker-dialog-title" className="text-xs font-semibold text-white">
              Edit Timeline Marker
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setActiveMarkerModalId(null)}
            data-testid="close-marker-modal-btn"
            className="grid h-6 w-6 place-items-center rounded text-ink-400 hover:text-white hover:bg-ink-800"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-3.5 text-xs">
          {/* Label Input */}
          <div>
            <label className="block text-[11px] font-medium text-ink-300 mb-1">
              Marker Name
            </label>
            <input
              type="text"
              autoFocus
              data-testid="marker-name-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Marker name..."
              className="w-full h-8 rounded-md border border-ink-700 bg-ink-800 px-2.5 text-xs text-ink-100 outline-none focus:border-brand"
            />
          </div>

          {/* Time & Duration Info */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-ink-400 block mb-0.5">Timecode</span>
              <div className="font-mono text-ink-200 bg-ink-950/60 px-2 py-1 rounded border border-ink-800 flex items-center gap-1">
                <Clock size={11} className="text-ink-500" />
                <span>{formatTimecode(activeMarker.time, projectFps)}</span>
              </div>
            </div>
            <div>
              <span className="text-ink-400 block mb-0.5">Span Duration (s)</span>
              <input
                type="number"
                min={0}
                step={0.1}
                data-testid="marker-duration-input"
                value={duration}
                onChange={(e) => setDuration(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full h-7 rounded border border-ink-800 bg-ink-950/60 px-2 font-mono text-ink-200 outline-none focus:border-brand"
              />
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-[11px] font-medium text-ink-300 mb-1.5">
              Marker Color
            </label>
            <div className="flex items-center gap-2">
              {MARKER_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  data-testid={`marker-color-${c.id}`}
                  title={c.label}
                  aria-label={c.label}
                  onClick={() => setColor(c.id)}
                  className={`w-6 h-6 rounded-full transition-transform flex items-center justify-center ${c.bgClass} ${
                    color === c.id ? 'ring-2 ring-white scale-110 shadow-md' : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  {color === c.id && <Check size={12} className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Notes Textarea */}
          <div>
            <label className="block text-[11px] font-medium text-ink-300 mb-1">
              Comments / Notes
            </label>
            <textarea
              data-testid="marker-notes-textarea"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Editorial notes, cut instructions, cue notes..."
              className="w-full rounded-md border border-ink-700 bg-ink-800 p-2 text-xs text-ink-100 outline-none focus:border-brand resize-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-ink-800 px-4 py-2.5 bg-ink-950/80">
          <button
            type="button"
            data-testid="delete-marker-btn"
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-red-400 hover:bg-red-500/10 text-xs font-medium transition-colors"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveMarkerModalId(null)}
              className="px-3 py-1.5 rounded border border-ink-700 bg-ink-800 hover:bg-ink-750 text-xs text-ink-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="save-marker-btn"
              onClick={handleSave}
              className="px-3 py-1.5 rounded bg-brand hover:bg-brand-600 text-xs font-semibold text-white shadow-sm"
            >
              Save Marker
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
