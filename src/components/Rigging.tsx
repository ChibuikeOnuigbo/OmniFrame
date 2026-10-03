/**
 * Rigging mode.
 *
 * A rig turns one flat cutout into a named skeleton of parts: a parent/child
 * tree (move the torso, the arms follow), a pivot per part (rotation happens
 * about the shoulder, not the middle of the arm), and per-part bend and wind
 * so limbs flex and hair trails.
 *
 * The canvas is DOM rather than <canvas> on purpose: parts stay inspectable,
 * focusable and testable, and the existing DOM audits keep working over them.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from '../store'
import type { ClipTransform, Rig, RigPart, RigPartKind, RigResolvedPart, RigSide } from '../types'
import {
  DEFAULT_PIVOTS,
  PART_LABELS,
  identityTransform,
  resolvePart,
  sampleBend,
  sampleWind,
} from '../lib/rigging'
import { PanelSection } from './PanelSection'

// ---------------------------------------------------------------------------
// small shared controls
// ---------------------------------------------------------------------------

function NumberField({
  id,
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  id: string
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-0.5 block text-[10px] text-white/45">{label}</span>
      <input
        id={id}
        type="number"
        className="h-7 w-full rounded border border-white/15 bg-black/35 px-1.5 text-[11px] text-white/85 outline-none focus:border-brand-400"
        value={Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

function SliderField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
}: {
  id: string
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  format?: (v: number) => string
}) {
  return (
    <div className="mb-1.5" id={`${id}-wrap`}>
      <div className="mb-0.5 flex items-center justify-between">
        <label className="text-[10px] text-white/45" htmlFor={id}>
          {label}
        </label>
        <span className="font-mono text-[10px] text-white/55">
          {format ? format(value) : Math.round(value * 100) / 100}
        </span>
      </div>
      <input
        id={id}
        type="range"
        className="h-6 w-full accent-brand"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

function ToggleField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex h-6 items-center gap-2 text-[11px] text-white/70" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 accent-brand"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}

// ---------------------------------------------------------------------------
// the rig canvas
// ---------------------------------------------------------------------------

function RigCanvas({
  parts,
  selectedId,
  tool,
  showSkeleton,
  showPivots,
  time,
  onSelect,
  onPivotDrag,
  onPinDrag,
  onAddPin,
}: {
  parts: RigPart[]
  selectedId: string | null
  tool: string
  showSkeleton: boolean
  showPivots: boolean
  time: number
  onSelect: (id: string) => void
  onPivotDrag: (id: string, px: number, py: number) => void
  onPinDrag: (partId: string, pinId: string, dx: number, dy: number) => void
  onAddPin: (partId: string, x: number, y: number) => void
}) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ kind: 'pivot' | 'pin'; partId: string; pinId?: string } | null>(null)

  // resolvePart wants a Rig; wrap the current parts so the canvas can read
  // world transforms without the parent rig being persisted first.
  const rigObj = useMemo<Rig>(
    () => ({ id: 'preview', name: 'preview', parts, createdAt: 0, updatedAt: 0 }),
    [parts],
  )
  const resolved = useMemo(
    () => parts.map((p) => resolvePart(rigObj, p.id)).filter((n): n is RigResolvedPart => !!n),
    [parts, rigObj],
  )
  void time

  const localPoint = useCallback((clientX: number, clientY: number) => {
    const box = boxRef.current?.getBoundingClientRect()
    if (!box || !box.width || !box.height) return { x: 0.5, y: 0.5 }
    return {
      x: Math.min(1, Math.max(0, (clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (clientY - box.top) / box.height)),
    }
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const { x, y } = localPoint(e.clientX, e.clientY)
      if (drag.kind === 'pivot') onPivotDrag(drag.partId, x, y)
      else if (drag.pinId) onPinDrag(drag.partId, drag.pinId, x, y)
    },
    [localPoint, onPivotDrag, onPinDrag],
  )

  const endDrag = useCallback(() => {
    dragRef.current = null
  }, [])

  return (
    <div
      ref={boxRef}
      id="rig-canvas"
      className="relative min-h-[220px] flex-1 overflow-hidden rounded border border-white/10 bg-[repeating-linear-gradient(45deg,#151515_0,#151515_8px,#1a1a1a_8px,#1a1a1a_16px)]"
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      {parts.length === 0 && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-[11px] text-white/35">
          No parts yet. Add one per movable piece — head, hair, upper arm L, forearm L — then press
          Auto-rig to link them.
        </p>
      )}

      {[...resolved]
        .sort((a, b) => (a.part.z || 0) - (b.part.z || 0))
        .map((node) => {
          const { part, world } = node
          if (part.hidden) return null
          const selected = part.id === selectedId
          const pivotPx = { left: `${part.pivot.x * 100}%`, top: `${part.pivot.y * 100}%` }
          return (
            <div key={part.id}>
              {/* The part itself. Nested transform: world (incl. parents) then local. */}
              <div
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={`${part.name} — ${PART_LABELS[part.kind] || part.kind}`}
                className={`absolute cursor-grab rounded-sm border ${
                  selected ? 'border-brand-400 shadow-[0_0_0_1px_#9083ff]' : 'border-white/25'
                }`}
                style={{
                  left: `${part.bounds.x * 100}%`,
                  top: `${part.bounds.y * 100}%`,
                  width: `${part.bounds.width * 100}%`,
                  height: `${part.bounds.height * 100}%`,
                  opacity: world.opacity,
                  transform: `translate(${world.x}px, ${world.y}px) rotate(${world.rotation}deg) scale(${world.scale})`,
                  background: part.cutoutUrl
                    ? `center/contain no-repeat url(${part.cutoutUrl})`
                    : selected
                      ? 'rgba(109,94,252,0.35)'
                      : 'rgba(255,255,255,0.10)',
                  pointerEvents: part.locked ? 'none' : 'auto',
                }}
                onPointerDown={(e) => {
                  if (tool !== 'select' && tool !== 'pin') return
                  onSelect(part.id)
                  if (tool === 'pin') {
                    const { x, y } = localPoint(e.clientX, e.clientY)
                    onAddPin(part.id, x, y)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(part.id)
                  }
                }}
              />

              {/* Pivot: the point the part rotates about. */}
              {(showPivots || selected) && (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Pivot for ${part.name}`}
                  className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border-2 border-brand-400 bg-black/70"
                  style={pivotPx}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    onSelect(part.id)
                    dragRef.current = { kind: 'pivot', partId: part.id }
                  }}
                  onKeyDown={(e) => {
                    // Nudge with arrows so pivots are reachable without a mouse.
                    const step = e.shiftKey ? 0.05 : 0.01
                    const moves: Record<string, [number, number]> = {
                      ArrowLeft: [-step, 0],
                      ArrowRight: [step, 0],
                      ArrowUp: [0, -step],
                      ArrowDown: [0, step],
                    }
                    const move = moves[e.key]
                    if (!move) return
                    e.preventDefault()
                    onPivotDrag(part.id, part.pivot.x + move[0], part.pivot.y + move[1])
                  }}
                />
              )}

              {/* Puppet pins: free-form deformation handles. */}
              {(part.pins || []).map((pin) => (
                <div
                  key={pin.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Pin on ${part.name}`}
                  className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-sm border border-amber-300 bg-amber-400/70"
                  style={{ left: `${(pin.x + pin.dx) * 100}%`, top: `${(pin.y + pin.dy) * 100}%` }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    onSelect(part.id)
                    dragRef.current = { kind: 'pin', partId: part.id, pinId: pin.id }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                      e.preventDefault()
                      onPinDrag(part.id, pin.id, 0, 0)
                    }
                  }}
                />
              ))}
            </div>
          )
        })}

      {/* Skeleton: parent -> child bones, so the tree is visible at a glance. */}
      {showSkeleton && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
          focusable="false"
        >
          {resolved.map(({ part, pivotWorld }) =>
            part.parentId
              ? (() => {
                  const parent = resolved.find((n) => n.part.id === part.parentId)
                  if (!parent) return null
                  return (
                    <line
                      key={part.id}
                      x1={`${parent.pivotWorld.x * 100}%`}
                      y1={`${parent.pivotWorld.y * 100}%`}
                      x2={`${pivotWorld.x * 100}%`}
                      y2={`${pivotWorld.y * 100}%`}
                      stroke="rgba(144,131,255,0.55)"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                    />
                  )
                })()
              : null,
          )}
        </svg>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// mode
// ---------------------------------------------------------------------------

export default function Rigging() {
  const rigs = useEditor((s) => s.rigs)
  const activeRigId = useEditor((s) => s.activeRigId)
  const selectedPartId = useEditor((s) => s.selectedPartId)
  const rigTool = useEditor((s) => s.rigTool)

  const setRigTool = useEditor((s) => s.setRigTool)
  const setActiveRig = useEditor((s) => s.setActiveRig)
  const setSelectedPart = useEditor((s) => s.setSelectedPart)
  const createRig = useEditor((s) => s.createRig)
  const deleteRig = useEditor((s) => s.deleteRig)
  const addRigPart = useEditor((s) => s.addRigPart)
  const removeRigPart = useEditor((s) => s.removeRigPart)
  const renameRigPart = useEditor((s) => s.renameRigPart)
  const setRigPartParent = useEditor((s) => s.setRigPartParent)
  const setRigPartPivot = useEditor((s) => s.setRigPartPivot)
  const setRigPartTransform = useEditor((s) => s.setRigPartTransform)
  const setRigPartBend = useEditor((s) => s.setRigPartBend)
  const setRigPartWind = useEditor((s) => s.setRigPartWind)
  const reorderRigPart = useEditor((s) => s.reorderRigPart)
  const toggleRigPartHidden = useEditor((s) => s.toggleRigPartHidden)
  const toggleRigPartLocked = useEditor((s) => s.toggleRigPartLocked)
  const addRigPin = useEditor((s) => s.addRigPin)
  const moveRigPin = useEditor((s) => s.moveRigPin)
  const removeRigPin = useEditor((s) => s.removeRigPin)
  const autoRigParts = useEditor((s) => s.autoRigParts)
  const resetRigPivots = useEditor((s) => s.resetRigPivots)

  const [showSkeleton, setShowSkeleton] = useState(true)
  const [showPivots, setShowPivots] = useState(true)
  const [newKind, setNewKind] = useState<RigPartKind>('custom')
  const [newSide, setNewSide] = useState<RigSide>('center')
  const [scrub, setScrub] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [parentError, setParentError] = useState('')

  const rig = rigs.find((r) => r.id === activeRigId) || null
  const parts = rig?.parts ?? []
  const part = parts.find((p) => p.id === selectedPartId) ?? null

  // Preview loop: bend and wind only read as motion over time.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      setScrub((t) => t + dt)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const onPivotDrag = useCallback(
    (id: string, px: number, py: number) => {
      if (!rig) return
      const target = parts.find((p) => p.id === id)
      if (!target) return
      // Convert the character-space point back into part-local 0..1 space,
      // since bounds are in character space but pivots are relative to bounds.
      setRigPartPivot(rig.id, id, {
        x: (px - target.bounds.x) / target.bounds.width,
        y: (py - target.bounds.y) / target.bounds.height,
      })
    },
    [rig, parts, setRigPartPivot],
  )

  const onPinDrag = useCallback(
    (partId: string, pinId: string, dx: number, dy: number) => {
      if (!rig) return
      const target = parts.find((p) => p.id === partId)
      const pin = target?.pins?.find((p) => p.id === pinId)
      if (!target || !pin) return
      moveRigPin(rig.id, partId, pinId, dx - target.bounds.x, dy - target.bounds.y)
    },
    [rig, parts, moveRigPin],
  )

  const onAddPin = useCallback(
    (partId: string, x: number, y: number) => {
      if (rig) addRigPin(rig.id, partId, x, y)
    },
    [rig, addRigPin],
  )

  const setTransform = useCallback(
    (patch: Partial<ClipTransform>) => {
      if (rig && part) setRigPartTransform(rig.id, part.id, patch)
    },
    [rig, part, setRigPartTransform],
  )

  const bendPreview = part?.bend ? sampleBend(part.bend, 0.5) : 0
  const windPreview = part?.wind ? sampleWind(part.wind, scrub, 0) : 0

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0f0f11] text-white/90">
      {/* ---- header ---- */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <h2 className="text-[13px] font-semibold">Rigging</h2>

        <label className="sr-only" htmlFor="rig-select">
          Active rig
        </label>
        <select
          id="rig-select"
          className="h-7 max-w-[160px] rounded border border-white/15 bg-black/40 px-1.5 text-[11px] text-white/85"
          value={activeRigId ?? ''}
          onChange={(e) => setActiveRig(e.target.value || null)}
        >
          <option value="">No rig</option>
          {rigs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.parts.length})
            </option>
          ))}
        </select>

        <button
          type="button"
          id="rig-new"
          className="h-7 rounded border border-white/15 bg-white/5 px-2 text-[11px] text-white/80 hover:bg-white/10"
          onClick={() => createRig(`Rig ${rigs.length + 1}`)}
        >
          New rig
        </button>
        <button
          type="button"
          id="rig-delete"
          className="h-7 rounded border border-white/15 bg-white/5 px-2 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-40"
          disabled={!rig}
          onClick={() => rig && deleteRig(rig.id)}
        >
          Delete
        </button>

        <div
          className="ml-auto flex items-center gap-1"
          role="group"
          aria-label="Rigging tool"
          id="rig-tool-group"
        >
          {(['select', 'pivot', 'pin', 'bend'] as const).map((tool) => (
            <button
              key={tool}
              type="button"
              id={`rig-tool-${tool}`}
              aria-pressed={rigTool === tool}
              className={`h-7 rounded border px-2 text-[11px] ${
                rigTool === tool
                  ? 'border-brand-400 bg-brand text-white'
                  : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10'
              }`}
              onClick={() => setRigTool(tool)}
            >
              {tool[0].toUpperCase() + tool.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ---- body: canvas + inspector ---- */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <RigCanvas
            parts={parts}
            selectedId={selectedPartId}
            tool={rigTool}
            showSkeleton={showSkeleton}
            showPivots={showPivots}
            time={scrub}
            onSelect={setSelectedPart}
            onPivotDrag={onPivotDrag}
            onPinDrag={onPinDrag}
            onAddPin={onAddPin}
          />

          <div className="flex flex-wrap items-center gap-2" id="rig-preview-controls">
            <button
              type="button"
              id="rig-play"
              aria-pressed={playing}
              className="h-7 rounded border border-white/15 bg-white/5 px-2 text-[11px] text-white/80 hover:bg-white/10"
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <label className="text-[10px] text-white/45" htmlFor="rig-scrub">
              Preview t
            </label>
            <input
              id="rig-scrub"
              type="range"
              className="h-6 w-32 accent-brand"
              min={0}
              max={4}
              step={0.01}
              value={scrub % 4}
              onChange={(e) => setScrub(Number(e.target.value))}
            />
            <ToggleField
              id="rig-show-skeleton"
              label="Skeleton"
              checked={showSkeleton}
              onChange={setShowSkeleton}
            />
            <ToggleField
              id="rig-show-pivots"
              label="Pivots"
              checked={showPivots}
              onChange={setShowPivots}
            />
          </div>
        </div>

        {/* ---- inspector ---- */}
        <aside
          id="rig-inspector"
          className="flex w-full shrink-0 flex-col gap-2 overflow-y-auto lg:w-[300px]"
        >
          <PanelSection title="Parts" defaultOpen>
            {!rig ? (
              <p className="text-[11px] text-white/40">Create a rig first.</p>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap items-end gap-1.5" id="rig-add-part">
                  <label className="block" htmlFor="rig-new-kind">
                    <span className="mb-0.5 block text-[10px] text-white/45">Kind</span>
                    <select
                      id="rig-new-kind"
                      className="h-7 w-[110px] rounded border border-white/15 bg-black/40 px-1 text-[11px] text-white/85"
                      value={newKind}
                      onChange={(e) => setNewKind(e.target.value as RigPartKind)}
                    >
                      {(Object.keys(PART_LABELS) as RigPartKind[]).map((k) => (
                        <option key={k} value={k}>
                          {PART_LABELS[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block" htmlFor="rig-new-side">
                    <span className="mb-0.5 block text-[10px] text-white/45">Side</span>
                    <select
                      id="rig-new-side"
                      className="h-7 w-[70px] rounded border border-white/15 bg-black/40 px-1 text-[11px] text-white/85"
                      value={newSide}
                      onChange={(e) => setNewSide(e.target.value as RigSide)}
                    >
                      {(['left', 'right', 'center'] as const).map((k) => (
                        <option key={k} value={k}>
                          {k[0].toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    id="rig-add"
                    className="h-7 rounded border border-brand-400 bg-brand px-2 text-[11px] text-white hover:bg-brand-400"
                    onClick={() => addRigPart(rig.id, { kind: newKind, side: newSide })}
                  >
                    Add part
                  </button>
                </div>

                <div className="mb-2 flex flex-wrap gap-1.5" id="rig-bulk">
                  <button
                    type="button"
                    id="rig-auto"
                    className="h-7 rounded border border-white/15 bg-white/5 px-2 text-[11px] text-white/80 hover:bg-white/10"
                    onClick={() => autoRigParts(rig.id)}
                  >
                    Auto-rig
                  </button>
                  <button
                    type="button"
                    id="rig-reset-pivots"
                    className="h-7 rounded border border-white/15 bg-white/5 px-2 text-[11px] text-white/80 hover:bg-white/10"
                    onClick={() => resetRigPivots(rig.id)}
                  >
                    Reset pivots
                  </button>
                </div>

                {parts.length === 0 ? (
                  <p className="text-[11px] text-white/40">No parts yet.</p>
                ) : (
                  <ul className="flex flex-col gap-1" id="rig-part-list">
                    {[...parts]
                      .sort((a, b) => (b.z || 0) - (a.z || 0))
                      .map((p) => {
                        const selected = p.id === selectedPartId
                        return (
                          <li key={p.id}>
                            <div
                              className={`flex items-center gap-1 rounded border px-1.5 py-1 ${
                                selected
                                  ? 'border-brand-400 bg-brand/20'
                                  : 'border-white/10 bg-white/[0.03]'
                              }`}
                            >
                              <button
                                type="button"
                                id={`rig-select-${p.id}`}
                                aria-pressed={selected}
                                className="min-w-0 flex-1 truncate text-left text-[11px] text-white/85"
                                onClick={() => setSelectedPart(p.id)}
                                title={`${p.name} — ${p.parentId ? `child of ${parts.find((x) => x.id === p.parentId)?.name ?? '?'}` : 'root'}`}
                              >
                                {p.name}
                              </button>
                              <button
                                type="button"
                                id={`rig-hide-${p.id}`}
                                aria-label={`${p.hidden ? 'Show' : 'Hide'} ${p.name}`}
                                aria-pressed={!!p.hidden}
                                className="h-6 w-6 rounded text-[11px] text-white/60 hover:bg-white/10"
                                onClick={() => toggleRigPartHidden(rig.id, p.id)}
                              >
                                {p.hidden ? '◻' : '◼'}
                              </button>
                              <button
                                type="button"
                                id={`rig-lock-${p.id}`}
                                aria-label={`${p.locked ? 'Unlock' : 'Lock'} ${p.name}`}
                                aria-pressed={!!p.locked}
                                className="h-6 w-6 rounded text-[11px] text-white/60 hover:bg-white/10"
                                onClick={() => toggleRigPartLocked(rig.id, p.id)}
                              >
                                {p.locked ? '🔒' : '🔓'}
                              </button>
                            </div>
                          </li>
                        )
                      })}
                  </ul>
                )}
              </>
            )}
          </PanelSection>

          {rig && part && (
            <>
              <PanelSection title={`Part — ${part.name}`} defaultOpen>
                <div className="mb-1.5">
                  <label className="mb-0.5 block text-[10px] text-white/45" htmlFor="rig-part-name">
                    Name
                  </label>
                  <input
                    id="rig-part-name"
                    className="h-7 w-full rounded border border-white/15 bg-black/35 px-1.5 text-[11px] text-white/85 outline-none focus:border-brand-400"
                    value={part.name}
                    onChange={(e) => renameRigPart(rig.id, part.id, e.target.value)}
                  />
                </div>

                <div className="mb-1.5">
                  <label className="mb-0.5 block text-[10px] text-white/45" htmlFor="rig-part-parent">
                    Parent
                  </label>
                  <select
                    id="rig-part-parent"
                    className="h-7 w-full rounded border border-white/15 bg-black/40 px-1 text-[11px] text-white/85"
                    value={part.parentId ?? ''}
                    onChange={(e) => {
                      const next = e.target.value || null
                      const accepted = setRigPartParent(rig.id, part.id, next)
                      setParentError(accepted ? '' : 'That would put this part inside its own subtree.')
                    }}
                  >
                    <option value="">— none (root) —</option>
                    {parts
                      .filter((p) => p.id !== part.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                  {parentError && (
                    <p className="mt-1 text-[10px] text-rose-300" id="rig-parent-error" role="alert">
                      {parentError}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] leading-snug text-white/40">
                    A child follows its parent. Chain limbs: torso → upper arm → forearm → hand.
                  </p>
                </div>

                <div className="mb-1.5 flex gap-1.5" id="rig-z-order">
                  <span className="self-center text-[10px] text-white/45">Layer</span>
                  {(['back', 'down', 'up', 'front'] as const).map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      id={`rig-z-${dir}`}
                      aria-label={`Move ${part.name} ${dir}`}
                      className="h-6 min-w-[24px] rounded border border-white/15 bg-white/5 px-1 text-[10px] text-white/70 hover:bg-white/10"
                      onClick={() => reorderRigPart(rig.id, part.id, dir)}
                    >
                      {dir === 'back' ? '⤓' : dir === 'front' ? '⤒' : dir === 'up' ? '▲' : '▼'}
                    </button>
                  ))}
                </div>

                <div className="mb-1.5 grid grid-cols-2 gap-1.5" id="rig-pivot-fields">
                  <NumberField
                    id="rig-pivot-x"
                    label="Pivot x"
                    value={part.pivot.x}
                    step={0.01}
                    min={0}
                    max={1}
                    onChange={(v) => setRigPartPivot(rig.id, part.id, { ...part.pivot, x: v })}
                  />
                  <NumberField
                    id="rig-pivot-y"
                    label="Pivot y"
                    value={part.pivot.y}
                    step={0.01}
                    min={0}
                    max={1}
                    onChange={(v) => setRigPartPivot(rig.id, part.id, { ...part.pivot, y: v })}
                  />
                </div>
                <button
                  type="button"
                  id="rig-pivot-reset"
                  className="mb-1.5 h-6 rounded border border-white/15 bg-white/5 px-2 text-[10px] text-white/70 hover:bg-white/10"
                  onClick={() =>
                    setRigPartPivot(rig.id, part.id, DEFAULT_PIVOTS[part.kind] || { x: 0.5, y: 0.5 })
                  }
                >
                  Reset to joint ({PART_LABELS[part.kind] || part.kind} default)
                </button>

                <button
                  type="button"
                  id="rig-part-remove"
                  className="h-7 w-full rounded border border-rose-400/40 bg-rose-500/10 px-2 text-[11px] text-rose-200 hover:bg-rose-500/20"
                  onClick={() => {
                    removeRigPart(rig.id, part.id)
                    setSelectedPart(null)
                  }}
                >
                  Remove part
                </button>
              </PanelSection>

              <PanelSection title="Transform" defaultOpen>
                <SliderField
                  id="rig-tx"
                  label="X"
                  value={part.transform.x}
                  min={-400}
                  max={400}
                  onChange={(v) => setTransform({ x: v })}
                />
                <SliderField
                  id="rig-ty"
                  label="Y"
                  value={part.transform.y}
                  min={-400}
                  max={400}
                  onChange={(v) => setTransform({ y: v })}
                />
                <SliderField
                  id="rig-rot"
                  label="Rotation"
                  value={part.transform.rotation}
                  min={-180}
                  max={180}
                  format={(v) => `${Math.round(v)}°`}
                  onChange={(v) => setTransform({ rotation: v })}
                />
                <SliderField
                  id="rig-scale"
                  label="Scale"
                  value={part.transform.scale}
                  min={0.1}
                  max={3}
                  step={0.01}
                  onChange={(v) => setTransform({ scale: v })}
                />
                <SliderField
                  id="rig-opacity"
                  label="Opacity"
                  value={part.transform.opacity}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => setTransform({ opacity: v })}
                />
                <button
                  type="button"
                  id="rig-transform-reset"
                  className="h-6 rounded border border-white/15 bg-white/5 px-2 text-[10px] text-white/70 hover:bg-white/10"
                  onClick={() => setTransform(identityTransform())}
                >
                  Reset
                </button>
              </PanelSection>

              <PanelSection title="Bend" defaultOpen={!!part.bend}>
                <ToggleField
                  id="rig-bend-on"
                  label="Bend this part"
                  checked={!!part.bend}
                  onChange={(on) =>
                    setRigPartBend(rig.id, part.id, on ? { angle: 25, start: 0.15, end: 0.85 } : null)
                  }
                />
                {part.bend && (
                  <>
                    <SliderField
                      id="rig-bend-angle"
                      label="Angle"
                      value={part.bend.angle}
                      min={-180}
                      max={180}
                      format={(v) => `${Math.round(v)}°`}
                      onChange={(v) => setRigPartBend(rig.id, part.id, { angle: v })}
                    />
                    <SliderField
                      id="rig-bend-start"
                      label="Start"
                      value={part.bend.start}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(v) => setRigPartBend(rig.id, part.id, { start: v })}
                    />
                    <SliderField
                      id="rig-bend-end"
                      label="End"
                      value={part.bend.end}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(v) => setRigPartBend(rig.id, part.id, { end: v })}
                    />
                    <p className="text-[10px] leading-snug text-white/40" id="rig-bend-hint">
                      Tip reaches {Math.round(bendPreview)}°. Use bend so a limb curves instead of
                      creasing at the joint.
                    </p>
                  </>
                )}
              </PanelSection>

              <PanelSection title="Wind" defaultOpen={!!part.wind}>
                <ToggleField
                  id="rig-wind-on"
                  label="Wind / secondary motion"
                  checked={!!part.wind?.enabled}
                  onChange={(on) =>
                    setRigPartWind(rig.id, part.id, {
                      enabled: on,
                      ...(on ? { amplitude: 6, frequency: 1, lag: 0.5, bias: 0 } : {}),
                    })
                  }
                />
                {part.wind?.enabled && (
                  <>
                    <SliderField
                      id="rig-wind-amp"
                      label="Amplitude"
                      value={part.wind.amplitude}
                      min={0}
                      max={40}
                      onChange={(v) => setRigPartWind(rig.id, part.id, { amplitude: v })}
                    />
                    <SliderField
                      id="rig-wind-freq"
                      label="Frequency"
                      value={part.wind.frequency}
                      min={0.1}
                      max={4}
                      step={0.1}
                      onChange={(v) => setRigPartWind(rig.id, part.id, { frequency: v })}
                    />
                    <SliderField
                      id="rig-wind-lag"
                      label="Lag (deeper = later)"
                      value={part.wind.lag}
                      min={0}
                      max={2}
                      step={0.05}
                      onChange={(v) => setRigPartWind(rig.id, part.id, { lag: v })}
                    />
                    <SliderField
                      id="rig-wind-bias"
                      label="Bias (constant push)"
                      value={part.wind.bias}
                      min={-40}
                      max={40}
                      onChange={(v) => setRigPartWind(rig.id, part.id, { bias: v })}
                    />
                    <p className="text-[10px] leading-snug text-white/40" id="rig-wind-hint">
                      Now: {windPreview.toFixed(1)}°. Give hair and clothing a higher lag so they
                      trail the body.
                    </p>
                  </>
                )}
              </PanelSection>

              <PanelSection title="Pins" defaultOpen={(part.pins || []).length > 0}>
                <p className="mb-1.5 text-[10px] leading-snug text-white/45">
                  Pick the Pin tool, then click a part to drop a pin. Drag pins to deform that area
                  freely.
                </p>
                {(part.pins || []).length === 0 ? (
                  <p className="text-[11px] text-white/40">No pins on {part.name}.</p>
                ) : (
                  <ul className="flex flex-col gap-1" id="rig-pin-list">
                    {(part.pins || []).map((pin, i) => (
                      <li key={pin.id} className="flex items-center gap-1.5">
                        <span className="flex-1 font-mono text-[10px] text-white/60">
                          Pin {i + 1} ({pin.x.toFixed(2)}, {pin.y.toFixed(2)})
                        </span>
                        <button
                          type="button"
                          id={`rig-pin-clear-${pin.id}`}
                          aria-label={`Reset pin ${i + 1} on ${part.name}`}
                          className="h-6 rounded border border-white/15 bg-white/5 px-1.5 text-[10px] text-white/70 hover:bg-white/10"
                          onClick={() => moveRigPin(rig.id, part.id, pin.id, 0, 0)}
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          id={`rig-pin-del-${pin.id}`}
                          aria-label={`Delete pin ${i + 1} on ${part.name}`}
                          className="h-6 rounded border border-white/15 bg-white/5 px-1.5 text-[10px] text-white/70 hover:bg-white/10"
                          onClick={() => removeRigPin(rig.id, part.id, pin.id)}
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </PanelSection>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
