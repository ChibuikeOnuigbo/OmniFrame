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
  stablePartSeed,
} from '../lib/rigging'
import { PanelSection } from './PanelSection'
import { drawPuppetWarp } from '../lib/puppetWarp'
import { getLayeredArtworkInfo, toCssArtworkBlendMode } from '../lib/layeredArtworkMetadata'

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
// puppet raster warp + rig canvas
// ---------------------------------------------------------------------------

function PuppetArtwork({
  src,
  pins,
  sway,
  time,
  seed,
  partName,
}: {
  src: string
  pins: RigPart['pins']
  sway: RigPart['sway']
  time: number
  seed: number
  partName: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [imageVersion, setImageVersion] = useState(0)

  useEffect(() => {
    let live = true
    const image = new Image()
    image.onload = () => {
      if (!live) return
      imageRef.current = image
      setImageVersion((version) => version + 1)
    }
    image.onerror = () => {
      if (live) imageRef.current = null
    }
    image.src = src
    return () => {
      live = false
      imageRef.current = null
    }
  }, [src])

  useEffect(() => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image || !image.complete || !image.naturalWidth || !image.naturalHeight) return
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (!width || !height) return
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    const pixelWidth = Math.max(1, Math.round(width * dpr))
    const pixelHeight = Math.max(1, Math.round(height * dpr))
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, width, height)
    context.imageSmoothingEnabled = true

    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight)
    const drawWidth = image.naturalWidth * scale
    const drawHeight = image.naturalHeight * scale
    const offsetX = (width - drawWidth) / 2
    const offsetY = (height - drawHeight) / 2
    const activePins = pins || []
    const hasWarp = activePins.some((pin) => Math.abs(pin.dx) > 1e-6 || Math.abs(pin.dy) > 1e-6) ||
      (!!sway?.enabled && sway.distance > 0 && activePins.length > 0)

    if (!hasWarp) {
      context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)
      return
    }

    drawPuppetWarp(
      context,
      image,
      image.naturalWidth,
      image.naturalHeight,
      activePins,
      sway,
      time,
      seed,
      { x: offsetX, y: offsetY, width: drawWidth, height: drawHeight },
      dpr,
    )
  }, [pins, sway, time, seed, imageVersion])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
      data-testid="puppet-artwork"
      data-puppet-pin-count={pins?.length || 0}
      data-sway-enabled={String(!!sway?.enabled)}
      data-sway-frame={Math.round(time * 100)}
      data-puppet-part-name={partName}
    />
  )
}

function hairPinLayout(part: RigPart): Array<{ x: number; y: number }> {
  return part.bounds.width > part.bounds.height
    ? [{ x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.5 }]
    : [{ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.9 }]
}

function RigCanvas({
  parts,
  documentWidth,
  documentHeight,
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
  documentWidth?: number
  documentHeight?: number
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
  const animatedRig = useMemo<Rig>(() => {
    const depths = new Map(parts.map((part) => [part.id, Math.max(0, (resolvePart(rigObj, part.id)?.chain.length || 1) - 1)]))
    return {
      ...rigObj,
      parts: rigObj.parts.map((part) => {
        const swayAngle = sampleWind(part.wind, time, depths.get(part.id) || 0, stablePartSeed(part.id))
        if (!swayAngle) return part
        return {
          ...part,
          transform: { ...part.transform, rotation: (part.transform.rotation || 0) + swayAngle },
        }
      }),
    }
  }, [parts, rigObj, time])
  const resolved = useMemo(
    () => animatedRig.parts.map((p) => resolvePart(animatedRig, p.id)).filter((n): n is RigResolvedPart => !!n),
    [animatedRig],
  )

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
          // Layered-artwork offsets use document pixels so the same transform scales
          // with the preview panel and the sequence canvas. CSS percentage
          // translation is relative to this part's own bounds.
          const translateX = documentWidth
            ? `${(world.x / Math.max(1e-6, part.bounds.width * documentWidth)) * 100}%`
            : `${world.x}px`
          const translateY = documentHeight
            ? `${(world.y / Math.max(1e-6, part.bounds.height * documentHeight)) * 100}%`
            : `${world.y}px`
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
                  opacity: world.opacity * (part.sourceOpacity ?? 1),
                  mixBlendMode: toCssArtworkBlendMode(part.sourceBlendMode),
                  transform: `translate(${translateX}, ${translateY}) rotate(${world.rotation}deg) scale(${world.scale})`,
                  transformOrigin: `${part.pivot.x * 100}% ${part.pivot.y * 100}%`,
                  background: part.cutoutUrl
                    ? 'transparent'
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
              >
                {part.cutoutUrl && (
                  <PuppetArtwork
                    src={part.cutoutUrl}
                    pins={part.pins}
                    sway={part.sway}
                    time={time}
                    seed={stablePartSeed(part.id)}
                    partName={part.name}
                  />
                )}
              </div>

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
  const assets = useEditor((s) => s.assets)
  const activeRigId = useEditor((s) => s.activeRigId)
  const selectedPartId = useEditor((s) => s.selectedPartId)
  const rigTool = useEditor((s) => s.rigTool)

  const setRigTool = useEditor((s) => s.setRigTool)
  const setActiveRig = useEditor((s) => s.setActiveRig)
  const setSelectedPart = useEditor((s) => s.setSelectedPart)
  const createRig = useEditor((s) => s.createRig)
  const createRigFromCharacter = useEditor((s) => s.createRigFromCharacter)
  const createRigFromLayeredArtwork = useEditor((s) => s.createRigFromLayeredArtwork)
  const placeLayeredArtworkOnTimeline = useEditor((s) => s.placeLayeredArtworkOnTimeline)
  const deleteRig = useEditor((s) => s.deleteRig)
  const setRigPartCutout = useEditor((s) => s.setRigPartCutout)
  const characters = useEditor((s) => s.omniframeCharacters)
  const addRigPart = useEditor((s) => s.addRigPart)
  const removeRigPart = useEditor((s) => s.removeRigPart)
  const renameRigPart = useEditor((s) => s.renameRigPart)
  const setRigPartParent = useEditor((s) => s.setRigPartParent)
  const setRigPartPivot = useEditor((s) => s.setRigPartPivot)
  const setRigPartTransform = useEditor((s) => s.setRigPartTransform)
  const setRigPartBend = useEditor((s) => s.setRigPartBend)
  const setRigPartWind = useEditor((s) => s.setRigPartWind)
  const setRigPartSway = useEditor((s) => s.setRigPartSway)
  const reorderRigPart = useEditor((s) => s.reorderRigPart)
  const toggleRigPartHidden = useEditor((s) => s.toggleRigPartHidden)
  const toggleRigPartLocked = useEditor((s) => s.toggleRigPartLocked)
  const addRigPin = useEditor((s) => s.addRigPin)
  const addRigPins = useEditor((s) => s.addRigPins)
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
  const [selectedArtworkDocumentId, setSelectedArtworkDocumentId] = useState('')

  const layeredDocuments = useMemo(() => {
    const documents = new Map<string, { id: string; name: string; layers: number; format: string }>()
    for (const asset of assets) {
      const source = getLayeredArtworkInfo(asset)
      if (!source) continue
      const current = documents.get(source.documentId)
      documents.set(source.documentId, {
        id: source.documentId,
        name: source.documentName,
        format: source.sourceFormat,
        layers: (current?.layers || 0) + 1,
      })
    }
    return [...documents.values()]
  }, [assets])
  const activeArtworkDocumentId = layeredDocuments.some((doc) => doc.id === selectedArtworkDocumentId)
    ? selectedArtworkDocumentId
    : layeredDocuments[0]?.id || ''

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
    (partId: string, pinId: string, canvasX: number, canvasY: number) => {
      if (!rig) return
      const target = parts.find((p) => p.id === partId)
      const pin = target?.pins?.find((p) => p.id === pinId)
      if (!target || !pin) return
      const localX = Math.max(0, Math.min(1, (canvasX - target.bounds.x) / Math.max(1e-6, target.bounds.width)))
      const localY = Math.max(0, Math.min(1, (canvasY - target.bounds.y) / Math.max(1e-6, target.bounds.height)))
      moveRigPin(rig.id, partId, pinId, localX - pin.x, localY - pin.y)
    },
    [rig, parts, moveRigPin],
  )

  const onAddPin = useCallback(
    (partId: string, canvasX: number, canvasY: number) => {
      if (!rig) return
      const target = parts.find((p) => p.id === partId)
      if (!target) return
      const x = Math.max(0, Math.min(1, (canvasX - target.bounds.x) / Math.max(1e-6, target.bounds.width)))
      const y = Math.max(0, Math.min(1, (canvasY - target.bounds.y) / Math.max(1e-6, target.bounds.height)))
      addRigPin(rig.id, partId, x, y)
    },
    [rig, parts, addRigPin],
  )

  const addMissingHairPins = useCallback(() => {
    if (!rig || !part) return
    const existing = part.pins || []
    const needed = Math.max(0, 3 - existing.length)
    if (!needed) return
    const candidates = hairPinLayout(part)
    const missing = candidates.filter((candidate) =>
      existing.every((pin) => Math.hypot(pin.x - candidate.x, pin.y - candidate.y) > 0.08),
    )
    const fill = [...missing, ...candidates.filter((candidate) => !missing.includes(candidate))]
    addRigPins(rig.id, part.id, fill.slice(0, needed))
  }, [rig, part, addRigPins])

  const createHairSway = useCallback(() => {
    if (!rig || !part) return
    addMissingHairPins()
    setRigPartSway(rig.id, part.id, {
      enabled: true,
      distance: part.sway?.distance ?? 0.08,
      speed: part.sway?.speed ?? 0.8,
      direction: part.sway?.direction ?? (part.bounds.width > part.bounds.height ? 'vertical' : 'horizontal'),
    })
    setPlaying(true)
  }, [rig, part, addMissingHairPins, setRigPartSway])

  const setTransform = useCallback(
    (patch: Partial<ClipTransform>) => {
      if (rig && part) setRigPartTransform(rig.id, part.id, patch)
    },
    [rig, part, setRigPartTransform],
  )

  const bendPreview = part?.bend ? sampleBend(part.bend, 0.5) : 0
  const windPreview = part?.wind ? sampleWind(part.wind, scrub, 0) : 0
  const isDocumentSpaceRig = !!((rig?.sourceDocumentId || rig?.psdDocumentId) && rig.canvasWidth && rig.canvasHeight)
  const documentPixelLabel = rig?.sourceFormat === 'psd' || rig?.psdDocumentId ? 'PSD px' : 'document px'
  const rigXLimit = isDocumentSpaceRig ? Math.min(400, Math.max(1, Math.round((rig?.canvasWidth || 1) / 2))) : 400
  const rigYLimit = isDocumentSpaceRig ? Math.min(400, Math.max(1, Math.round((rig?.canvasHeight || 1) / 2))) : 400

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
            documentWidth={rig?.canvasWidth}
            documentHeight={rig?.canvasHeight}
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
            <div className="mb-2 rounded-md border border-brand/25 bg-brand/5 p-2" id="rig-from-psd">
              <div className="mb-1 text-[10px] font-semibold text-brand-200">Layered artwork rigging workflow</div>
              <div className="flex items-end gap-1.5">
                <label className="block min-w-0 flex-1" htmlFor="rig-source-psd">
                  <span className="mb-0.5 block text-[10px] text-white/45">Layered artwork document</span>
                  <select
                    id="rig-source-psd"
                    className="h-7 w-full rounded border border-white/15 bg-black/40 px-1 text-[11px] text-white/85 disabled:opacity-50"
                    value={activeArtworkDocumentId}
                    onChange={(event) => setSelectedArtworkDocumentId(event.target.value)}
                    disabled={layeredDocuments.length === 0}
                  >
                    {layeredDocuments.length === 0 ? (
                      <option value="">Import PSD or OpenRaster layers first</option>
                    ) : layeredDocuments.map((document) => (
                      <option key={document.id} value={document.id}>
                        {document.name}, {document.format.toUpperCase()} ({document.layers} layers)
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  id="rig-from-psd-go"
                  disabled={!activeArtworkDocumentId}
                  className="h-7 shrink-0 rounded border border-brand-400 bg-brand px-2 text-[11px] text-white hover:bg-brand-400 disabled:opacity-40"
                  onClick={() => activeArtworkDocumentId && createRigFromLayeredArtwork(activeArtworkDocumentId)}
                >
                  Rig artwork layers
                </button>
              </div>
              <button
                type="button"
                id="rig-place-psd-timeline"
                disabled={!activeArtworkDocumentId}
                className="mt-2 h-7 w-full rounded border border-white/15 bg-white/5 px-2 text-[10px] text-white/75 hover:bg-white/10 disabled:opacity-40"
                onClick={() => activeArtworkDocumentId && placeLayeredArtworkOnTimeline(activeArtworkDocumentId)}
              >
                Place aligned artwork layers on timeline
              </button>
              <p className="mt-1 text-[9px] leading-snug text-white/40">
                Raster layer offsets and supported opacity/blend settings are retained. Placement creates synchronized still clips; a matching rig drives its layers in sequence playback and the canvas-capture export path. X/Y uses document pixels. Encoded export parity and unsupported source-app features remain unverified.
              </p>
            </div>
            {!rig ? (
              <p className="text-[11px] text-white/40">Import layered PSD/OpenRaster artwork above or create a rig to add parts manually.</p>
            ) : (
              <>
                {/* The one-tap path: an already-segmented cutout becomes a rig. */}
                {characters.length > 0 && (
                  <div className="mb-2 flex flex-wrap items-end gap-1.5" id="rig-from-character">
                    <label className="block min-w-0 flex-1" htmlFor="rig-source-character">
                      <span className="mb-0.5 block text-[10px] text-white/45">
                        Rig from a segmented cutout
                      </span>
                      <select
                        id="rig-source-character"
                        className="h-7 w-full rounded border border-white/15 bg-black/40 px-1 text-[11px] text-white/85"
                        defaultValue={characters[0]?.id}
                      >
                        {characters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      id="rig-from-character-go"
                      className="h-7 rounded border border-brand-400 bg-brand px-2 text-[11px] text-white hover:bg-brand-400"
                      onClick={() => {
                        const sel = document.getElementById(
                          'rig-source-character',
                        ) as HTMLSelectElement | null
                        if (sel?.value) createRigFromCharacter(sel.value)
                      }}
                    >
                      Rig in 1 tap
                    </button>
                  </div>
                )}

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
                  <label className="mb-0.5 block text-[10px] text-white/45" htmlFor="rig-part-cutout">
                    Cutout
                  </label>
                  <select
                    id="rig-part-cutout"
                    className="h-7 w-full rounded border border-white/15 bg-black/40 px-1 text-[11px] text-white/85"
                    value={part.cutoutUrl}
                    onChange={(e) => setRigPartCutout(rig.id, part.id, e.target.value)}
                  >
                    <option value="">— no artwork (placeholder) —</option>
                    {characters.map((c) => (
                      <option key={c.id} value={c.cutoutUrl}>
                        {c.name}
                      </option>
                    ))}
                  </select>
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
                  label={isDocumentSpaceRig ? `X, ${documentPixelLabel}` : 'X'}
                  value={part.transform.x}
                  min={-rigXLimit}
                  max={rigXLimit}
                  onChange={(v) => setTransform({ x: v })}
                />
                <SliderField
                  id="rig-ty"
                  label={isDocumentSpaceRig ? `Y, ${documentPixelLabel}` : 'Y'}
                  value={part.transform.y}
                  min={-rigYLimit}
                  max={rigYLimit}
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

              <PanelSection title="Hair / cloth sway" defaultOpen={!!part.sway}>
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    id="rig-create-sway"
                    className="h-7 rounded border border-brand-400 bg-brand px-2 text-[11px] text-white hover:bg-brand-400"
                    onClick={createHairSway}
                  >
                    {part.sway?.enabled ? 'Preview sway' : 'Create sway'}
                  </button>
                  <span className="text-[9px] text-white/40">Adds up to 3 distributed puppet pins.</span>
                </div>
                <ToggleField
                  id="rig-sway-on"
                  label="Enable pin deformation"
                  checked={!!part.sway?.enabled}
                  onChange={(enabled) => setRigPartSway(rig.id, part.id, {
                    enabled,
                    distance: part.sway?.distance ?? 0.08,
                    speed: part.sway?.speed ?? 0.8,
                    direction: part.sway?.direction ?? (part.bounds.width > part.bounds.height ? 'vertical' : 'horizontal'),
                  })}
                />
                {part.sway?.enabled && (
                  <>
                    <SliderField
                      id="rig-sway-distance"
                      label="Sway distance"
                      value={part.sway.distance}
                      min={0}
                      max={0.35}
                      step={0.005}
                      format={(value) => `${Math.round(value * 100)}%`}
                      onChange={(value) => setRigPartSway(rig.id, part.id, { distance: value })}
                    />
                    <SliderField
                      id="rig-sway-speed"
                      label="Sway speed"
                      value={part.sway.speed}
                      min={0.1}
                      max={3}
                      step={0.1}
                      format={(value) => `${value.toFixed(1)} cycles/s`}
                      onChange={(value) => setRigPartSway(rig.id, part.id, { speed: value })}
                    />
                    <label className="block text-[10px] text-white/45" htmlFor="rig-sway-direction">
                      Direction
                      <select
                        id="rig-sway-direction"
                        className="mt-0.5 h-7 w-full rounded border border-white/15 bg-black/40 px-1 text-[11px] text-white/85"
                        value={part.sway.direction}
                        onChange={(event) => setRigPartSway(rig.id, part.id, { direction: event.target.value as 'horizontal' | 'vertical' })}
                      >
                        <option value="horizontal">Side to side</option>
                        <option value="vertical">Up and down</option>
                      </select>
                    </label>
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
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    id="rig-add-three-pins"
                    disabled={(part.pins || []).length >= 3}
                    className="h-7 rounded border border-white/15 bg-white/5 px-2 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-40"
                    onClick={addMissingHairPins}
                  >
                    Add three hair pins
                  </button>
                  <span className="text-[9px] text-white/40">Root, middle, tip</span>
                </div>
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
