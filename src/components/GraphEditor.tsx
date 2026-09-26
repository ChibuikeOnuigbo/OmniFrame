import React, { useRef, useState, useMemo, useEffect } from 'react'
import {
  Activity,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Diamond,
  Plus,
  Trash2,
  Sliders,
  Check,
  X,
  RefreshCw,
  Layers,
} from 'lucide-react'
import { useEditor } from '../store'
import {
  PropertyCurve,
  KeyframeNode,
  InterpolationType,
  ExtrapolationMode,
  TangentHandleMode,
  evaluateCurve,
  evaluateCurveDerivative,
  createDefaultClipAnimation,
  addOrUpdateKeyframe,
  applyEasingPreset,
  removeKeyframe,
} from '../lib/animation/CurveEngine'
import { BlenderRotationIcon } from './icons/BlenderRotationIcon'

const EASING_PRESETS: { id: InterpolationType; label: string; desc: string }[] = [
  { id: 'linear', label: 'Linear', desc: 'Constant rate of change' },
  { id: 'cubic-in', label: 'Cubic In', desc: 'Accelerating curve (t³)' },
  { id: 'cubic-out', label: 'Cubic Out', desc: 'Decelerating curve' },
  { id: 'ease-in-out', label: 'Ease In-Out', desc: 'Smooth S-curve acceleration & deceleration' },
  { id: 'ease-in', label: 'Ease In', desc: 'Quadratic ease in' },
  { id: 'ease-out', label: 'Ease Out', desc: 'Quadratic ease out' },
  { id: 'back', label: 'Back', desc: 'Overshoot anticipatory curve' },
  { id: 'bounce', label: 'Bounce', desc: 'Elastic bouncy settling' },
  { id: 'elastic', label: 'Elastic', desc: 'Damped spring oscillation' },
  { id: 'constant', label: 'Step / Hold', desc: 'Instantaneous value jump' },
]

export function GraphEditor() {
  const clips = useEditor((s) => s.clips)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const playhead = useEditor((s) => s.playhead)
  const setPlayhead = useEditor((s) => s.setPlayhead)
  const graphMode = useEditor((s) => s.graphEditorMode)
  const setGraphMode = useEditor((s) => s.setGraphEditorMode)
  const activePropId = useEditor((s) => s.activeCurveProperty)
  const setActivePropId = useEditor((s) => s.setActiveCurveProperty)
  const setGraphEditorOpen = useEditor((s) => s.setGraphEditorOpen)
  const setClipKeyframe = useEditor((s) => s.setClipKeyframe)
  const removeClipKeyframe = useEditor((s) => s.removeClipKeyframe)
  const updateClipKeyframe = useEditor((s) => s.updateClipKeyframe)
  const setCurveExtrapolation = useEditor((s) => s.setCurveExtrapolation)

  const activeClip = clips.find((c) => c.id === selectedClipId) || clips[0]

  // Viewport transform (Pan & Zoom)
  const [viewTimeRange, setViewTimeRange] = useState<[number, number]>([0, 5])
  const [viewValRange, setViewValRange] = useState<[number, number]>([-100, 100])
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null)
  const [draggingTarget, setDraggingTarget] = useState<
    { type: 'key'; keyId: string; startPointer: { x: number; y: number }; startT: number; startV: number }
    | { type: 'inHandle' | 'outHandle'; keyId: string; startPointer: { x: number; y: number }; startDt: number; startDv: number }
    | { type: 'pan'; startPointer: { x: number; y: number }; origTimeRange: [number, number]; origValRange: [number, number] }
    | null
  >(null)

  const svgRef = useRef<SVGSVGElement | null>(null)

  // Ensure clip has animation curves
  const curves: Record<string, PropertyCurve> = useMemo(() => {
    if (!activeClip) return {}
    if (activeClip.animation?.curves) return activeClip.animation.curves
    return createDefaultClipAnimation(activeClip.transform, activeClip.duration).curves
  }, [activeClip])

  const activeCurve = curves[activePropId] || Object.values(curves)[0]

  // Clip relative time for playhead
  const clipPlayheadTime = activeClip ? Math.max(0, playhead - activeClip.start) : playhead

  // Auto-fit to curve range when property changes
  const handleFit = () => {
    if (!activeCurve) return
    const keys = activeCurve.keyframes
    const duration = activeClip ? activeClip.duration : 5
    if (keys.length === 0) {
      const def = activeCurve.defaultValue
      setViewTimeRange([0, Math.max(3, duration)])
      setViewValRange([def - 50, def + 50])
      return
    }
    const times = keys.map((k) => k.time)
    const values = keys.map((k) => k.value)
    const minT = Math.min(0, ...times)
    const maxT = Math.max(duration, ...times)
    const minV = Math.min(...values)
    const maxV = Math.max(...values)
    const vPadding = Math.max(20, (maxV - minV) * 0.25)
    setViewTimeRange([minT - 0.2, maxT + 0.5])
    setViewValRange([minV - vPadding, maxV + vPadding])
  }

  // Dimensions
  const [dims, setDims] = useState({ width: 800, height: 320 })
  useEffect(() => {
    if (!svgRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDims({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    ro.observe(svgRef.current)
    return () => ro.disconnect()
  }, [])

  // Coordinate transforms
  const timeToX = (t: number) => {
    const [t0, t1] = viewTimeRange
    return ((t - t0) / Math.max(0.001, t1 - t0)) * dims.width
  }
  const xToTime = (x: number) => {
    const [t0, t1] = viewTimeRange
    return t0 + (x / dims.width) * (t1 - t0)
  }
  const valToY = (v: number) => {
    const [v0, v1] = viewValRange
    return dims.height - ((v - v0) / Math.max(0.001, v1 - v0)) * dims.height
  }
  const yToVal = (y: number) => {
    const [v0, v1] = viewValRange
    return v0 + ((dims.height - y) / dims.height) * (v1 - v0)
  }

  // Generate SVG path for a property curve
  const generateCurvePath = (curve: PropertyCurve, isDerivative: boolean) => {
    const [t0, t1] = viewTimeRange
    const steps = 120
    const dt = (t1 - t0) / steps
    let d = ''
    for (let i = 0; i <= steps; i++) {
      const t = t0 + i * dt
      const val = isDerivative ? evaluateCurveDerivative(curve, t) : evaluateCurve(curve, t)
      const x = timeToX(t)
      const y = valToY(val)
      d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`
    }
    return d
  }

  // Pointer drag interactions
  const handlePointerDownKey = (e: React.PointerEvent, key: KeyframeNode) => {
    e.stopPropagation()
    setSelectedKeyframeId(key.id)
    setDraggingTarget({
      type: 'key',
      keyId: key.id,
      startPointer: { x: e.clientX, y: e.clientY },
      startT: key.time,
      startV: key.value,
    })
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  const handlePointerDownHandle = (e: React.PointerEvent, key: KeyframeNode, which: 'inHandle' | 'outHandle') => {
    e.stopPropagation()
    const handle = which === 'inHandle' ? (key.inHandle || { dt: -0.2, dv: 0 }) : (key.outHandle || { dt: 0.2, dv: 0 })
    setDraggingTarget({
      type: which,
      keyId: key.id,
      startPointer: { x: e.clientX, y: e.clientY },
      startDt: handle.dt,
      startDv: handle.dv,
    })
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingTarget || !activeClip || !activeCurve) return

    const dx = e.clientX - draggingTarget.startPointer.x
    const dy = e.clientY - draggingTarget.startPointer.y
    const dtDelta = (dx / dims.width) * (viewTimeRange[1] - viewTimeRange[0])
    const dvDelta = -(dy / dims.height) * (viewValRange[1] - viewValRange[0])

    if (draggingTarget.type === 'key') {
      const newT = Math.max(0, draggingTarget.startT + dtDelta)
      const newV = draggingTarget.startV + dvDelta
      updateClipKeyframe(activeClip.id, activeCurve.id, draggingTarget.keyId, {
        time: Math.round(newT * 100) / 100,
        value: Math.round(newV * 10) / 10,
      })
    } else if (draggingTarget.type === 'inHandle') {
      updateClipKeyframe(activeClip.id, activeCurve.id, draggingTarget.keyId, {
        inHandle: {
          dt: draggingTarget.startDt + dtDelta,
          dv: draggingTarget.startDv + dvDelta,
        },
      })
    } else if (draggingTarget.type === 'outHandle') {
      updateClipKeyframe(activeClip.id, activeCurve.id, draggingTarget.keyId, {
        outHandle: {
          dt: draggingTarget.startDt + dtDelta,
          dv: draggingTarget.startDv + dvDelta,
        },
      })
    } else if (draggingTarget.type === 'pan') {
      const [t0, t1] = draggingTarget.origTimeRange
      const [v0, v1] = draggingTarget.origValRange
      const timeSpan = t1 - t0
      const valSpan = v1 - v0
      const dTime = -(dx / dims.width) * timeSpan
      const dVal = (dy / dims.height) * valSpan
      setViewTimeRange([t0 + dTime, t1 + dTime])
      setViewValRange([v0 + dVal, v1 + dVal])
    }
  }

  const handlePointerUp = () => {
    setDraggingTarget(null)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 0.85 : 1.18
    const mouseT = xToTime(e.nativeEvent.offsetX)
    const mouseV = yToVal(e.nativeEvent.offsetY)

    const [t0, t1] = viewTimeRange
    const [v0, v1] = viewValRange

    const newT0 = mouseT + (t0 - mouseT) * zoomFactor
    const newT1 = mouseT + (t1 - mouseT) * zoomFactor
    const newV0 = mouseV + (v0 - mouseV) * zoomFactor
    const newV1 = mouseV + (v1 - mouseV) * zoomFactor

    setViewTimeRange([newT0, newT1])
    setViewValRange([newV0, newV1])
  }

  // Canvas Double Click -> Add Keyframe
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!activeClip || !activeCurve) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top
    const time = Math.max(0, Math.round(xToTime(clickX) * 100) / 100)
    const val = Math.round(yToVal(clickY) * 10) / 10
    setClipKeyframe(activeClip.id, activeCurve.id, time, val, 'bezier')
  }

  // Jump to Prev / Next Keyframe
  const handleNavKeyframe = (direction: 'prev' | 'next') => {
    if (!activeClip || !activeCurve) return
    const keys = activeCurve.keyframes
    if (keys.length === 0) return
    const curTime = clipPlayheadTime
    if (direction === 'prev') {
      const prevKeys = keys.filter((k) => k.time < curTime - 0.04)
      if (prevKeys.length > 0) {
        const target = prevKeys[prevKeys.length - 1]
        setPlayhead(activeClip.start + target.time)
        setSelectedKeyframeId(target.id)
      }
    } else {
      const nextKeys = keys.filter((k) => k.time > curTime + 0.04)
      if (nextKeys.length > 0) {
        const target = nextKeys[0]
        setPlayhead(activeClip.start + target.time)
        setSelectedKeyframeId(target.id)
      }
    }
  }

  // Toggle Keyframe at Playhead
  const handleToggleKeyframeAtPlayhead = () => {
    if (!activeClip || !activeCurve) return
    const existing = activeCurve.keyframes.find((k) => Math.abs(k.time - clipPlayheadTime) < 0.05)
    if (existing) {
      removeClipKeyframe(activeClip.id, activeCurve.id, existing.id)
      setSelectedKeyframeId(null)
    } else {
      const currentVal = evaluateCurve(activeCurve, clipPlayheadTime)
      setClipKeyframe(activeClip.id, activeCurve.id, clipPlayheadTime, currentVal, 'bezier')
    }
  }

  const selectedKeyframe =
    activeCurve?.keyframes.find((k) => k.id === selectedKeyframeId) ||
    (activeCurve?.keyframes && activeCurve.keyframes.length > 0 ? activeCurve.keyframes[0] : null)
  const isKeyAtPlayhead = activeCurve?.keyframes.some((k) => Math.abs(k.time - clipPlayheadTime) < 0.05)

  return (
    <div
      data-testid="graph-editor-panel"
      className="flex flex-col h-full w-full bg-ink-950 border-t border-ink-800 select-none overflow-hidden"
    >
      {/* Top Header Controls Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-ink-800/80 bg-ink-900/95 text-xs text-ink-200">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode Switcher: Value Graph vs Speed Graph */}
          <div className="flex items-center bg-ink-950 p-0.5 rounded border border-ink-800">
            <button
              type="button"
              data-testid="graph-mode-value"
              onClick={() => setGraphMode('value')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                graphMode === 'value'
                  ? 'bg-brand text-white shadow-xs'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              Value Graph
            </button>
            <button
              type="button"
              data-testid="graph-mode-speed"
              onClick={() => setGraphMode('speed')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                graphMode === 'speed'
                  ? 'bg-amber-500 text-ink-950 font-semibold shadow-xs'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              Speed Graph
            </button>
          </div>

          {/* Active Property Curve Selector Dropdown */}
          <select
            data-testid="graph-curve-selector"
            value={activeCurve?.id || ''}
            onChange={(e) => setActivePropId(e.target.value)}
            className="bg-ink-800 border border-ink-700 rounded px-2 py-1 text-xs text-ink-100 outline-none focus:border-brand"
          >
            {Object.values(curves).map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} ({c.unit || ''}) — {c.keyframes.length} keys
              </option>
            ))}
          </select>

          {/* Keyframe Prev / Toggle / Next Navigation */}
          <div className="flex items-center gap-0.5 bg-ink-950 px-1 py-0.5 rounded border border-ink-800">
            <button
              type="button"
              data-testid="graph-nav-prev"
              title="Previous Keyframe"
              onClick={() => handleNavKeyframe('prev')}
              className="p-1 rounded hover:bg-ink-800 text-ink-400 hover:text-white"
            >
              <ChevronLeft size={13} />
            </button>

            <button
              type="button"
              data-testid="graph-keyframe-toggle"
              title={isKeyAtPlayhead ? 'Remove Keyframe at Playhead' : 'Add Keyframe at Playhead'}
              onClick={handleToggleKeyframeAtPlayhead}
              className={`p-1 rounded transition-colors ${
                isKeyAtPlayhead ? 'text-brand' : 'text-ink-500 hover:text-ink-200'
              }`}
            >
              <Diamond size={13} fill={isKeyAtPlayhead ? 'currentColor' : 'none'} />
            </button>

            <button
              type="button"
              data-testid="graph-nav-next"
              title="Next Keyframe"
              onClick={() => handleNavKeyframe('next')}
              className="p-1 rounded hover:bg-ink-800 text-ink-400 hover:text-white"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Fit Viewport Button */}
          <button
            type="button"
            data-testid="curve-fit-btn"
            title="Fit All Curves into View"
            onClick={handleFit}
            className="flex items-center gap-1 px-2 py-1 rounded bg-ink-800 hover:bg-ink-700 text-ink-300 text-[11px] font-medium transition-colors"
          >
            <Maximize2 size={12} />
            <span>Fit View</span>
          </button>
        </div>

        {/* Close Button */}
        <button
          type="button"
          data-testid="close-graph-editor-btn"
          title="Close Graph Editor"
          onClick={() => setGraphEditorOpen(false)}
          className="p-1.5 rounded hover:bg-ink-800 text-ink-400 hover:text-white"
        >
          <X size={15} />
        </button>
      </div>

      {/* Main Workspace (Sidebar Channels + SVG Canvas Area) */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left Channel List Sidebar */}
        <div className="w-44 border-r border-ink-800/80 bg-ink-900/60 p-2 overflow-y-auto space-y-1 shrink-0 text-xs">
          <div className="text-[10px] uppercase font-semibold text-ink-400 px-1 py-0.5">
            Animatable Channels
          </div>
          {Object.values(curves).map((curve) => {
            const isActive = curve.id === activeCurve?.id
            const evalVal = evaluateCurve(curve, clipPlayheadTime)
            return (
              <button
                key={curve.id}
                type="button"
                data-testid={`channel-item-${curve.id}`}
                onClick={() => setActivePropId(curve.id)}
                className={`w-full flex items-center justify-between px-2 py-1 rounded text-left transition-colors ${
                  isActive
                    ? 'bg-ink-800 text-white font-medium shadow-xs'
                    : 'text-ink-400 hover:bg-ink-800/50 hover:text-ink-200'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: curve.color }}
                  />
                  <span className="truncate">{curve.label}</span>
                </div>
                <span className="text-[10px] text-ink-400 font-mono ml-1 shrink-0">
                  {evalVal.toFixed(1)}
                </span>
              </button>
            )
          })}
        </div>

        {/* SVG Curve Canvas */}
        <div className="flex-1 min-w-0 min-h-0 relative bg-ink-950 overflow-hidden">
          <svg
            ref={svgRef}
            data-testid="graph-svg-canvas"
            className="w-full h-full cursor-crosshair"
            onPointerDown={(e) => {
              if (e.target === svgRef.current) {
                setDraggingTarget({
                  type: 'pan',
                  startPointer: { x: e.clientX, y: e.clientY },
                  origTimeRange: [...viewTimeRange],
                  origValRange: [...viewValRange],
                })
                ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
              }
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            onDoubleClick={handleDoubleClick}
          >
            <defs>
              {/* Grid pattern */}
              <pattern id="graph-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              </pattern>
            </defs>

            <rect width="100%" height="100%" fill="url(#graph-grid)" />

            {/* Zero Axis Line */}
            {viewValRange[0] <= 0 && viewValRange[1] >= 0 && (
              <line
                x1="0"
                y1={valToY(0)}
                x2={dims.width}
                y2={valToY(0)}
                stroke="rgba(255,255,255,0.15)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            )}

            {/* Inactive Curves (Faint background lines) */}
            {Object.values(curves).map((c) => {
              if (c.id === activeCurve?.id) return null
              return (
                <path
                  key={c.id}
                  d={generateCurvePath(c, graphMode === 'speed')}
                  fill="none"
                  stroke={c.color}
                  strokeWidth="1.2"
                  strokeOpacity="0.3"
                />
              )
            })}

            {/* Active Property Curve */}
            {activeCurve && (
              <path
                data-testid="active-curve-path"
                d={generateCurvePath(activeCurve, graphMode === 'speed')}
                fill="none"
                stroke={activeCurve.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Tangent Handles for selected keyframe */}
            {selectedKeyframe && selectedKeyframe.interpolation === 'bezier' && (
              <g data-testid="curve-tangent-group">
                {/* In Handle */}
                {(() => {
                  const inH = selectedKeyframe.inHandle || { dt: -0.2, dv: 0 }
                  const kx = timeToX(selectedKeyframe.time)
                  const ky = valToY(selectedKeyframe.value)
                  const hx = timeToX(selectedKeyframe.time + inH.dt)
                  const hy = valToY(selectedKeyframe.value + inH.dv)
                  return (
                    <>
                      <line x1={kx} y1={ky} x2={hx} y2={hy} stroke="#94a3b8" strokeWidth="1.5" />
                      <circle
                        data-testid="curve-tangent-in"
                        cx={hx}
                        cy={hy}
                        r="5"
                        fill="#38bdf8"
                        stroke="#0f172a"
                        strokeWidth="1.5"
                        className="cursor-pointer hover:scale-125 transition-transform"
                        onPointerDown={(e) => handlePointerDownHandle(e, selectedKeyframe, 'inHandle')}
                      />
                    </>
                  )
                })()}

                {/* Out Handle */}
                {(() => {
                  const outH = selectedKeyframe.outHandle || { dt: 0.2, dv: 0 }
                  const kx = timeToX(selectedKeyframe.time)
                  const ky = valToY(selectedKeyframe.value)
                  const hx = timeToX(selectedKeyframe.time + outH.dt)
                  const hy = valToY(selectedKeyframe.value + outH.dv)
                  return (
                    <>
                      <line x1={kx} y1={ky} x2={hx} y2={hy} stroke="#94a3b8" strokeWidth="1.5" />
                      <circle
                        data-testid="curve-tangent-out"
                        cx={hx}
                        cy={hy}
                        r="5"
                        fill="#f59e0b"
                        stroke="#0f172a"
                        strokeWidth="1.5"
                        className="cursor-pointer hover:scale-125 transition-transform"
                        onPointerDown={(e) => handlePointerDownHandle(e, selectedKeyframe, 'outHandle')}
                      />
                    </>
                  )
                })()}
              </g>
            )}

            {/* Keyframe Nodes on Active Curve */}
            {activeCurve?.keyframes.map((key) => {
              const kx = timeToX(key.time)
              const ky = valToY(key.value)
              const isSelected = key.id === selectedKeyframeId
              return (
                <circle
                  key={key.id}
                  data-testid="curve-keyframe-node"
                  cx={kx}
                  cy={ky}
                  r={isSelected ? 6.5 : 5}
                  fill={isSelected ? '#ffffff' : activeCurve.color}
                  stroke="#0f172a"
                  strokeWidth="2"
                  className="cursor-pointer hover:scale-125 transition-transform"
                  onClick={() => setSelectedKeyframeId(key.id)}
                  onPointerDown={(e) => handlePointerDownKey(e, key)}
                />
              )
            })}

            {/* Synchronized Timeline Playhead Scrub Line */}
            {(() => {
              const px = timeToX(clipPlayheadTime)
              return (
                <g data-testid="graph-playhead-line">
                  <line x1={px} y1="0" x2={px} y2={dims.height} stroke="#ef4444" strokeWidth="2" />
                  <polygon
                    points={`${px - 5},0 ${px + 5},0 ${px},8`}
                    fill="#ef4444"
                  />
                </g>
              )
            })()}
          </svg>

          {/* Current Keyframe Info & Easing Bar */}
          <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between gap-2 p-1.5 rounded-lg bg-ink-900/90 border border-ink-800/90 backdrop-blur-md text-xs">
            {selectedKeyframe ? (
              <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-none w-full">
                <span className="font-semibold text-ink-200 shrink-0">
                  Key: {selectedKeyframe.time.toFixed(2)}s | {selectedKeyframe.value.toFixed(1)}{activeCurve?.unit || ''}
                </span>

                {/* Delete selected keyframe */}
                <button
                  type="button"
                  data-testid="graph-delete-keyframe-btn"
                  title="Delete Keyframe"
                  onClick={() => {
                    if (!activeClip || !activeCurve) return
                    removeClipKeyframe(activeClip.id, activeCurve.id, selectedKeyframe.id)
                    setSelectedKeyframeId(null)
                  }}
                  className="p-1 rounded hover:bg-red-500/20 text-ink-400 hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 size={13} />
                </button>

                {/* Tangent Handle Modes */}
                <div className="flex items-center gap-0.5 bg-ink-950 px-1 py-0.5 rounded border border-ink-800 shrink-0">
                  {(['free', 'aligned', 'mirrored', 'auto'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      data-testid={`handle-mode-${m}`}
                      title={`Handle Mode: ${m}`}
                      onClick={() => {
                        if (!activeClip || !activeCurve) return
                        updateClipKeyframe(activeClip.id, activeCurve.id, selectedKeyframe.id, { handleMode: m })
                      }}
                      className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-mono font-medium transition-colors ${
                        (selectedKeyframe.handleMode || 'aligned') === m
                          ? 'bg-brand text-white font-semibold'
                          : 'text-ink-400 hover:text-white hover:bg-ink-800'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {/* Easing Preset Selectors */}
                <div className="flex items-center gap-1 shrink-0">
                  {EASING_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      data-testid={`preset-${p.id}`}
                      title={p.desc}
                      onClick={() => {
                        if (!activeClip || !activeCurve) return
                        const updated = applyEasingPreset(activeCurve, selectedKeyframe.id, p.id)
                        useEditor.setState((s) => ({
                          clips: s.clips.map((c) =>
                            c.id === activeClip.id
                              ? {
                                  ...c,
                                  animation: {
                                    ...c.animation!,
                                    curves: {
                                      ...c.animation!.curves,
                                      [activeCurve.id]: updated,
                                    },
                                  },
                                }
                              : c,
                          ),
                        }))
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        selectedKeyframe.interpolation === p.id
                          ? 'bg-brand text-white font-semibold shadow-xs'
                          : 'bg-ink-800 text-ink-300 hover:bg-ink-700 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Extrapolation Mode Dropdown */}
                <div className="flex items-center gap-1 shrink-0 ml-auto">
                  <span className="text-[10px] text-ink-400">Extrapolation:</span>
                  <select
                    data-testid="extrapolation-mode-select"
                    value={activeCurve?.extrapolationAfter || 'constant'}
                    onChange={(e) => {
                      if (!activeClip || !activeCurve) return
                      setCurveExtrapolation(
                        activeClip.id,
                        activeCurve.id,
                        e.target.value as ExtrapolationMode,
                        e.target.value as ExtrapolationMode
                      )
                    }}
                    className="bg-ink-800 border border-ink-700 rounded px-1.5 py-0.5 text-[10px] text-ink-100 outline-none"
                  >
                    <option value="constant">Hold (Constant)</option>
                    <option value="linear">Linear Extrapolation</option>
                    <option value="cycle">Cycle (Repeat)</option>
                    <option value="ping-pong">Ping-Pong (Bounce)</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="text-ink-400 text-[11px]">
                Click a keyframe node or double-click curve to add keyframes. Drag handles to reshape Bezier tangents.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
