import { useEffect, useState } from 'react'
import { Bookmark, ChevronLeft, ChevronRight, Palette, Plus, Trash2, X } from 'lucide-react'
import { useEditor } from '../store'
import type { MarkerKind } from '../types'
import { MARKER_KINDS, markerColorHex, markerKindDef, resolveMarkerTime } from '../lib/markers'
import { formatTimecode } from '../lib/time'

/**
 * Marker editor as a floating POPUP (CapCut-style), never a blocking modal:
 * no backdrop, the preview and timeline stay fully interactive while it is
 * open. Five purpose kinds with their colours, user custom colours that
 * grow the palette, and a scope toggle (main timeline ↔ clip top edge).
 */
export function MarkerPopup() {
  const activeMarkerModalId = useEditor((s) => s.activeMarkerModalId)
  const setActiveMarkerModalId = useEditor((s) => s.setActiveMarkerModalId)
  const markers = useEditor((s) => s.markers)
  const clips = useEditor((s) => s.clips)
  const updateMarker = useEditor((s) => s.updateMarker)
  const removeMarker = useEditor((s) => s.removeMarker)
  const jumpToMarker = useEditor((s) => s.jumpToMarker)
  const jumpToNextMarker = useEditor((s) => s.jumpToNextMarker)
  const jumpToPrevMarker = useEditor((s) => s.jumpToPrevMarker)
  const customColors = useEditor((s) => s.markerCustomColors)
  const addCustomMarkerColor = useEditor((s) => s.addCustomMarkerColor)
  const setLastMarkerKind = useEditor((s) => s.setLastMarkerKind)
  const moveMarkersToClip = useEditor((s) => s.moveMarkersToClip)
  const moveMarkersToTimeline = useEditor((s) => s.moveMarkersToTimeline)

  const marker = markers.find((m) => m.id === activeMarkerModalId)
  const [label, setLabel] = useState('')
  const [notes, setNotes] = useState('')
  const [customColor, setCustomColor] = useState('#ec4899')

  useEffect(() => {
    if (marker) {
      setLabel(marker.label)
      setNotes(marker.notes || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marker?.id])

  if (!marker) return null
  const hex = markerColorHex(marker.color, marker.kind)
  const kindDef = markerKindDef(marker.kind)
  const resolved = resolveMarkerTime(marker, clips)
  const hostClip = marker.clipId ? clips.find((c) => c.id === marker.clipId) : undefined
  const spanningClip = !marker.clipId
    ? clips.find((c) => resolved >= c.start && resolved <= c.start + c.duration && c.kind !== 'adjustment')
    : undefined

  const pickKind = (kind: MarkerKind) => {
    const def = markerKindDef(kind)!
    updateMarker(marker.id, { kind, color: def.color, label: label.trim() || def.label })
    setLastMarkerKind(kind)
  }
  const pickColor = (color: string) => updateMarker(marker.id, { color, kind: 'custom' })

  return (
    <div
      role="dialog"
      aria-label="Marker editor"
      data-testid="marker-popup"
      className="fixed right-4 top-20 z-[95] w-72 rounded-xl border border-ink-600 bg-ink-900/97 shadow-2xl backdrop-blur select-none"
    >
      <div className="flex items-center gap-2 border-b border-ink-800 px-3 py-2">
        <span className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ backgroundColor: hex }} />
        <input
          data-testid="marker-label-input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => updateMarker(marker.id, { label: label.trim() || 'Marker' })}
          onKeyDown={(e) => { if (e.key === 'Enter') updateMarker(marker.id, { label: label.trim() || 'Marker' }) }}
          placeholder="Marker name — e.g. drop comes here"
          className="h-7 min-w-0 flex-1 rounded border border-ink-700 bg-ink-950 px-2 text-xs text-ink-50 outline-none focus:border-brand"
        />
        <button type="button" data-testid="marker-close-btn" onClick={() => setActiveMarkerModalId(null)} className="grid h-6 w-6 shrink-0 place-items-center rounded text-ink-400 hover:bg-ink-800 hover:text-white" aria-label="Close marker editor">
          <X size={13} />
        </button>
      </div>

      <div className="space-y-2.5 px-3 py-2.5">
        <button type="button" onClick={() => jumpToMarker(marker.id)} className="flex items-center gap-1.5 text-[11px] text-ink-300 hover:text-white" title="Jump playhead to this marker">
          <Bookmark size={11} style={{ color: hex }} />
          <span className="font-mono">{formatTimecode(resolved)}</span>
          <span className="text-ink-500">· {marker.clipId ? `on clip “${hostClip?.name ?? 'clip'}”` : 'main timeline'}</span>
        </button>

        <div>
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-ink-500">Purpose — one job per marker</div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Marker purpose">
            {MARKER_KINDS.map((def) => (
              <button
                key={def.id}
                type="button"
                data-testid={`marker-kind-${def.id}`}
                onClick={() => pickKind(def.id)}
                className={`flex h-7 items-center gap-1.5 rounded-full border px-2 text-[11px] transition-colors ${marker.kind === def.id ? 'border-white/70 bg-ink-700 text-white' : 'border-ink-700 bg-ink-950 text-ink-300 hover:border-ink-500'}`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: def.color }} />
                {def.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] leading-snug text-ink-500" data-testid="marker-kind-hint">
            {kindDef ? kindDef.hint : 'Custom colour — your own meaning.'}
          </p>
        </div>

        <div>
          <div className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-ink-500">
            <Palette size={10} /> Colour
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {MARKER_KINDS.map((def) => (
              <button key={def.id} type="button" aria-label={`${def.label} colour`} onClick={() => pickColor(def.color)} className={`h-5 w-5 rounded-full border-2 ${hex === def.color ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: def.color }} />
            ))}
            {customColors.map((c) => (
              <button key={c} type="button" data-testid="marker-custom-swatch" aria-label={`Custom colour ${c}`} onClick={() => pickColor(c)} className={`h-5 w-5 rounded-full border-2 ${hex.toLowerCase() === c.toLowerCase() ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c }} />
            ))}
            <span className="mx-0.5 h-5 w-px bg-ink-700" />
            <input
              type="color"
              data-testid="marker-custom-color-input"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="h-6 w-8 cursor-pointer rounded border border-ink-700 bg-ink-950 p-0.5"
              title="Pick any colour"
            />
            <button
              type="button"
              data-testid="marker-add-color-btn"
              onClick={() => { addCustomMarkerColor(customColor); pickColor(customColor) }}
              className="flex h-6 items-center gap-0.5 rounded border border-ink-700 bg-ink-950 px-1.5 text-[10px] text-ink-200 hover:border-brand"
              title="Save this colour to your palette and use it"
            >
              <Plus size={10} /> Save
            </button>
          </div>
        </div>

        <input
          data-testid="marker-notes-input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => updateMarker(marker.id, { notes: notes.trim() })}
          placeholder="Note — e.g. singer comes in here"
          className="h-7 w-full rounded border border-ink-700 bg-ink-950 px-2 text-[11px] text-ink-100 outline-none focus:border-brand"
        />

        <div className="flex items-center gap-1.5">
          {marker.clipId ? (
            <button type="button" data-testid="marker-scope-timeline" onClick={() => moveMarkersToTimeline(marker.clipId!)} className="h-7 flex-1 rounded border border-ink-700 bg-ink-950 px-2 text-[10px] text-ink-200 hover:border-brand" title="Move this clip's markers to the main timeline ruler">
              Place on main timeline
            </button>
          ) : spanningClip ? (
            <button type="button" data-testid="marker-scope-clip" onClick={() => spanningClip && moveMarkersToClip(spanningClip.id)} className="h-7 flex-1 rounded border border-ink-700 bg-ink-950 px-2 text-[10px] text-ink-200 hover:border-brand" title={`Move timeline markers inside “${spanningClip.name}” onto the clip's top edge`}>
              Place on clip “{spanningClip.name.slice(0, 18)}”
            </button>
          ) : (
            <span className="flex-1 text-[10px] text-ink-600">No clip under this marker to move it onto.</span>
          )}
          <button type="button" onClick={jumpToPrevMarker} className="grid h-7 w-7 place-items-center rounded border border-ink-700 text-ink-300 hover:border-ink-500" title="Previous marker (Alt+Shift+M)" aria-label="Previous marker"><ChevronLeft size={13} /></button>
          <button type="button" onClick={jumpToNextMarker} className="grid h-7 w-7 place-items-center rounded border border-ink-700 text-ink-300 hover:border-ink-500" title="Next marker (Shift+M)" aria-label="Next marker"><ChevronRight size={13} /></button>
          <button type="button" data-testid="marker-delete-btn" onClick={() => removeMarker(marker.id)} className="grid h-7 w-7 place-items-center rounded border border-red-900/70 text-red-300 hover:bg-red-950/50" title="Delete marker" aria-label="Delete marker"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  )
}
