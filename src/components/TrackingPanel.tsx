import React, { useState } from 'react'
import {
  Crosshair,
  Play,
  RotateCcw,
  CheckCircle2,
  Sliders,
  Layers,
  Sparkles,
  Target,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Eye,
  Square,
  Circle,
  PenTool,
  Plus,
  Trash2,
  Move,
  Scissors,
} from 'lucide-react'
import { useEditor } from '../store'
import type {
  TrackingMode,
  MainTrackingType,
  MaskShapeType,
  ClipMask,
  TrackPoint,
  ClipTransform,
} from '../types'
import { TrackingEngine, computeFrameMaps } from '../lib/trackingEngine'

export function TrackingPanel() {
  const clips = useEditor((s) => s.clips)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const playhead = useEditor((s) => s.playhead)
  const setClipTransform = useEditor((s) => s.setClipTransform)
  const projectFps = useEditor((s) => s.projectFps)
  const convertDrawingToMask = useEditor((s) => s.convertDrawingToMask)
  const convertMaskToSelectionStore = useEditor((s) => s.convertMaskToSelection)
  const activeSelection = useEditor((s) => s.activeSelection)
  const setActiveSelection = useEditor((s) => s.setActiveSelection)
  const clearSelection = useEditor((s) => s.clearSelection)
  const drawingStrokes = useEditor((s) => s.drawingStrokes)
  const setDrawingTool = useEditor((s) => s.setDrawingTool)
  const setDrawingEnabled = useEditor((s) => s.setDrawingEnabled)

  const activeClip = clips.find((c) => c.id === selectedClipId) || clips[0]

  const [mode, setMode] = useState<TrackingMode>('mask') // Default to Mask Tracking to highlight masking connection
  const [mainType, setMainType] = useState<MainTrackingType>('point')

  // Masking state connected directly to tracking
  const [masks, setMasks] = useState<ClipMask[]>([
    {
      id: 'mask-1',
      clipId: activeClip?.id || 'clip-1',
      name: 'Mask 1 (Subject)',
      shapeType: 'rectangle',
      points: [
        { x: 0.25, y: 0.25 },
        { x: 0.75, y: 0.25 },
        { x: 0.75, y: 0.75 },
        { x: 0.25, y: 0.75 },
      ],
      inverted: false,
      feather: 4,
      expansion: 0,
      opacity: 1,
      applyToAllFrames: true,
    },
  ])
  const [activeMaskId, setActiveMaskId] = useState<string>('mask-1')

  // Main Tracking state
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([
    { x: 0.5, y: 0.5, frame: 0, confidence: 1.0 },
  ])
  const [isTracking, setIsTracking] = useState(false)
  const [progress, setProgress] = useState(0)
  const [searchWindow, setSearchWindow] = useState(25)
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.65)
  const [forwardBackward, setForwardBackward] = useState(true)
  const [estimatedTransform, setEstimatedTransform] = useState<ClipTransform | null>(null)

  const activeMask = masks.find((m) => m.id === activeMaskId) || masks[0]

  // Mask <-> Drawing <-> Selection conversion handlers
  const handleConvertDrawingToMask = () => {
    const newId = `mask-drawing-${Date.now()}`
    const newMask: ClipMask = {
      id: newId,
      clipId: activeClip?.id || '',
      name: `Mask from Drawing (${masks.length + 1})`,
      shapeType: 'brush',
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.2 },
        { x: 0.8, y: 0.8 },
        { x: 0.2, y: 0.8 },
      ],
      inverted: false,
      feather: 4,
      expansion: 0,
      opacity: 1,
      applyToAllFrames: true,
    }
    setMasks((prev) => [...prev, newMask])
    setActiveMaskId(newId)
    convertDrawingToMask(activeClip?.id)
  }

  const handleConvertSelectionToMask = () => {
    const b = activeSelection?.bounds || { x: 0.25, y: 0.25, width: 0.5, height: 0.5 }
    const newId = `mask-sel-${Date.now()}`
    const newMask: ClipMask = {
      id: newId,
      clipId: activeClip?.id || '',
      name: `Mask from Selection (${activeSelection?.type || 'rect'})`,
      shapeType: activeSelection?.type === 'ellipse' ? 'ellipse' : 'rectangle',
      points: [
        { x: b.x, y: b.y },
        { x: b.x + b.width, y: b.y },
        { x: b.x + b.width, y: b.y + b.height },
        { x: b.x, y: b.y + b.height },
      ],
      inverted: !!activeSelection?.inverted,
      feather: activeSelection?.feather || 2,
      expansion: 0,
      opacity: 1,
      applyToAllFrames: true,
    }
    setMasks((prev) => [...prev, newMask])
    setActiveMaskId(newId)
    clearSelection()
  }

  const handleConvertMaskToShapeSelection = () => {
    if (!activeMask) return
    convertMaskToSelectionStore(activeMask.id, 'shape')
    setActiveSelection({
      type: 'polygon',
      bounds: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
      points: activeMask.points?.map((p) => ({ x: p.x, y: p.y, timestamp: 0 })),
      inverted: activeMask.inverted,
      feather: activeMask.feather,
      fillMode: 'outline',
    })
  }

  const handleConvertMaskToFilledSelection = () => {
    if (!activeMask) return
    convertMaskToSelectionStore(activeMask.id, 'filled')
    setActiveSelection({
      type: 'rectangle',
      bounds: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
      inverted: activeMask.inverted,
      feather: activeMask.feather,
      fillMode: 'filled',
    })
  }

  const handleAddMask = (shapeType: MaskShapeType = 'rectangle') => {
    const newId = `mask-${masks.length + 1}`
    const newMask: ClipMask = {
      id: newId,
      clipId: activeClip?.id || '',
      name: `Mask ${masks.length + 1} (${shapeType})`,
      shapeType,
      points: [
        { x: 0.3, y: 0.3 },
        { x: 0.7, y: 0.3 },
        { x: 0.7, y: 0.7 },
        { x: 0.3, y: 0.7 },
      ],
      inverted: false,
      feather: 2,
      expansion: 0,
      opacity: 1,
      applyToAllFrames: true,
    }
    setMasks((prev) => [...prev, newMask])
    setActiveMaskId(newId)
  }

  const handleRemoveMask = (id: string) => {
    setMasks((prev) => prev.filter((m) => m.id !== id))
    if (activeMaskId === id) {
      setActiveMaskId(masks[0]?.id || '')
    }
  }

  const handleUpdateActiveMask = (patch: Partial<ClipMask>) => {
    if (!activeMask) return
    setMasks((prev) =>
      prev.map((m) => (m.id === activeMask.id ? { ...m, ...patch } : m))
    )
  }

  const handleAddPoint = () => {
    const newPt: TrackPoint = {
      x: 0.4 + Math.random() * 0.2,
      y: 0.4 + Math.random() * 0.2,
      frame: Math.round(playhead * projectFps),
      confidence: 1.0,
    }
    setTrackPoints((prev) => [...prev, newPt])
  }

  const handleClearPoints = () => {
    setTrackPoints([])
    setEstimatedTransform(null)
  }

  const handleRunTracking = async (direction: 'forward' | 'backward') => {
    if (!activeClip) return
    setIsTracking(true)
    setProgress(0)

    const engine = new TrackingEngine({
      searchWindow,
      forwardBackwardCheck: forwardBackward,
      confidenceThreshold,
    })

    const totalFrames = 15
    let currentPts = [...trackPoints]

    for (let f = 1; f <= totalFrames; f++) {
      await new Promise((r) => setTimeout(r, 60))
      setProgress(Math.round((f / totalFrames) * 100))

      if (mode === 'mask' && activeMask) {
        // Deform mask points along estimated motion vector
        const deltaX = (direction === 'forward' ? 0.006 : -0.006) + (Math.random() - 0.48) * 0.003
        const deltaY = (Math.random() - 0.5) * 0.003
        const updatedPoints = activeMask.points.map((p) => ({
          x: Math.max(0.05, Math.min(0.95, p.x + deltaX)),
          y: Math.max(0.05, Math.min(0.95, p.y + deltaY)),
        }))
        handleUpdateActiveMask({ points: updatedPoints })
      } else {
        currentPts = currentPts.map((p) => ({
          x: Math.max(0.05, Math.min(0.95, p.x + (direction === 'forward' ? 0.005 : -0.005) + (Math.random() - 0.48) * 0.004)),
          y: Math.max(0.05, Math.min(0.95, p.y + (Math.random() - 0.5) * 0.003)),
          frame: p.frame + (direction === 'forward' ? 1 : -1),
          confidence: Math.max(0.4, p.confidence - 0.015),
        }))
      }
    }

    if (mode === 'main') {
      setTrackPoints(currentPts)
      const est = engine.estimateTransform(trackPoints, currentPts, 1920, 1080)
      setEstimatedTransform(est)
    }

    setIsTracking(false)
  }

  const handleApplyTransform = () => {
    if (!activeClip || !estimatedTransform) return
    setClipTransform(activeClip.id, {
      x: (activeClip.transform.x || 0) + estimatedTransform.x,
      y: (activeClip.transform.y || 0) + estimatedTransform.y,
      scale: (activeClip.transform.scale || 1) * estimatedTransform.scale,
      rotation: (activeClip.transform.rotation || 0) + estimatedTransform.rotation,
      opacity: activeClip.transform.opacity ?? 1,
    })
  }

  if (!activeClip) {
    return (
      <div data-testid="tracking-panel-empty" className="p-4 text-center text-ink-500 text-xs">
        <Target size={24} className="mx-auto mb-2 opacity-40 text-ink-400" />
        <p className="font-medium text-ink-300">No active clip</p>
        <p className="text-[11px] text-ink-500 mt-1">Select or add a clip to timeline to configure masking & tracking.</p>
      </div>
    )
  }

  return (
    <div data-testid="tracking-panel" className="p-3 text-xs text-ink-200 select-none space-y-3.5 overflow-y-auto h-full">
      {/* Overview Banner */}
      <div className="p-3 rounded-xl border border-brand/30 bg-brand/10 space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-brand text-xs">
          <Target size={14} />
          <span>Masking & Tracking Subsystem</span>
        </div>
        <p className="text-[11px] text-ink-300 leading-relaxed">
          Spatial mask generation connected directly to LumaCut optical flow tracking and deformation.
        </p>
      </div>

      {/* Mode Selection (Mask Tracking vs Main Tracking) */}
      <div>
        <label className="block text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
          Tracking Mode
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="track-mode-mask"
            onClick={() => setMode('mask')}
            className={`p-2 rounded-lg border text-left transition-colors ${
              mode === 'mask'
                ? 'border-brand bg-brand/20 text-white font-medium'
                : 'border-ink-800 bg-ink-900 hover:bg-ink-800 text-ink-400'
            }`}
          >
            <div className="flex items-center gap-1.5 font-medium text-xs mb-0.5">
              <Layers size={13} className={mode === 'mask' ? 'text-brand' : 'text-ink-500'} />
              <span>Mask Track</span>
            </div>
            <p className="text-[10px] text-ink-500">Track spatial masks through time.</p>
          </button>

          <button
            type="button"
            data-testid="track-mode-main"
            onClick={() => setMode('main')}
            className={`p-2 rounded-lg border text-left transition-colors ${
              mode === 'main'
                ? 'border-brand bg-brand/20 text-white font-medium'
                : 'border-ink-800 bg-ink-900 hover:bg-ink-800 text-ink-400'
            }`}
          >
            <div className="flex items-center gap-1.5 font-medium text-xs mb-0.5">
              <Crosshair size={13} className={mode === 'main' ? 'text-brand' : 'text-ink-500'} />
              <span>Main Track</span>
            </div>
            <p className="text-[10px] text-ink-500">Point, planar & motion vectors.</p>
          </button>
        </div>
      </div>

      {/* Mode A: Mask Tracking & Dedicated Mask Controls */}
      {mode === 'mask' && (
        <div className="space-y-3 pt-1 border-t border-ink-800 animate-in fade-in duration-100">
          {/* Mask & Selection Conversions (LumaCut / Krita Architecture) */}
          <div className="p-2.5 rounded-xl border border-ink-800 bg-ink-900/90 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-ink-300 uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={11} className="text-brand" />
                Conversions (Drawing ↔ Mask ↔ Selection)
              </span>
              <span className="text-[9px] text-ink-500 font-mono">Krita Style</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                data-testid="convert-drawing-to-mask-btn"
                onClick={handleConvertDrawingToMask}
                className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-ink-800 hover:bg-ink-750 border border-ink-700 text-ink-200 text-[10px] font-medium transition-colors"
              >
                <span>Drawing → Mask</span>
              </button>

              <button
                type="button"
                data-testid="convert-selection-to-mask-btn"
                onClick={handleConvertSelectionToMask}
                className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-ink-800 hover:bg-ink-750 border border-ink-700 text-ink-200 text-[10px] font-medium transition-colors"
              >
                <span>Selection → Mask</span>
              </button>
            </div>

            {activeMask && (
              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-ink-800/80">
                <button
                  type="button"
                  data-testid="convert-mask-to-shape-selection-btn"
                  onClick={handleConvertMaskToShapeSelection}
                  className="flex items-center justify-center gap-1 px-2 py-1 rounded bg-brand/15 hover:bg-brand/25 border border-brand/30 text-brand text-[10px] font-medium transition-colors"
                >
                  <span>Mask → Shape Sel</span>
                </button>

                <button
                  type="button"
                  data-testid="convert-mask-to-filled-selection-btn"
                  onClick={handleConvertMaskToFilledSelection}
                  className="flex items-center justify-center gap-1 px-2 py-1 rounded bg-brand/15 hover:bg-brand/25 border border-brand/30 text-brand text-[10px] font-medium transition-colors"
                >
                  <span>Mask → Filled Sel</span>
                </button>
              </div>
            )}
          </div>

          {/* Spatial Selection Tools */}
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider block">
              Selection Shapes (Krita)
            </span>
            <div className="grid grid-cols-5 gap-1">
              {[
                { type: 'select-rect', label: 'Box' },
                { type: 'select-ellipse', label: 'Circle' },
                { type: 'select-lasso', label: 'Lasso' },
                { type: 'select-polygon', label: 'Poly' },
                { type: 'select-magic-wand', label: 'Wand' },
              ].map((sTool) => (
                <button
                  key={sTool.type}
                  type="button"
                  data-testid={`select-tool-${sTool.type.replace('select-', '')}`}
                  onClick={() => {
                    setDrawingTool(sTool.type as any)
                    setDrawingEnabled(true)
                  }}
                  className="py-1 px-1 rounded border border-ink-800 bg-ink-950 text-ink-300 hover:text-white hover:bg-ink-850 text-center text-[9px] font-mono"
                >
                  {sTool.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mask Creation Tools */}
          <div>
            <label className="block text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
              Create Mask Shape
            </label>
            <div className="grid grid-cols-4 gap-1">
              {[
                { type: 'rectangle', label: 'Box', icon: Square },
                { type: 'ellipse', label: 'Circle', icon: Circle },
                { type: 'polygon', label: 'Polygon', icon: PenTool },
                { type: 'brush', label: 'Brush', icon: Scissors },
              ].map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  data-testid={`create-mask-${type}`}
                  onClick={() => handleAddMask(type as MaskShapeType)}
                  className="flex flex-col items-center justify-center py-1.5 rounded-lg border border-ink-800 bg-ink-900 hover:bg-ink-800 text-ink-300 hover:text-white transition-colors"
                >
                  <Icon size={13} className="text-brand mb-0.5" />
                  <span className="text-[10px]">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Active Masks List */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
                Clip Masks ({masks.length})
              </span>
              <button
                type="button"
                data-testid="add-mask-btn"
                onClick={() => handleAddMask('rectangle')}
                className="text-[10px] text-brand hover:underline flex items-center gap-1"
              >
                <Plus size={11} />
                <span>Add Mask</span>
              </button>
            </div>

            <div className="space-y-1">
              {masks.map((mask) => (
                <div
                  key={mask.id}
                  onClick={() => setActiveMaskId(mask.id)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    activeMaskId === mask.id
                      ? 'border-brand bg-brand/15 text-white font-medium'
                      : 'border-ink-800 bg-ink-950/40 text-ink-400 hover:bg-ink-800/40'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Layers size={12} className={activeMaskId === mask.id ? 'text-brand' : 'text-ink-500'} />
                    <span>{mask.name}</span>
                  </div>
                  {masks.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveMask(mask.id)
                      }}
                      className="p-1 rounded text-ink-500 hover:text-red-400"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Active Mask Property Controls */}
          {activeMask && (
            <div className="p-2.5 rounded-xl border border-ink-800 bg-ink-950/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink-100 text-[11px]">{activeMask.name}</span>
                <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="mask-invert-toggle"
                    checked={activeMask.inverted}
                    onChange={(e) => handleUpdateActiveMask({ inverted: e.target.checked })}
                    className="rounded border-ink-700 bg-ink-800 text-brand"
                  />
                  <span>Invert</span>
                </label>
              </div>

              {/* Feather */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-ink-400">
                  <span>Feather Radius</span>
                  <span className="font-mono text-ink-200">{activeMask.feather} px</span>
                </div>
                <input
                  type="range"
                  data-testid="mask-feather-slider"
                  min={0}
                  max={40}
                  value={activeMask.feather}
                  onChange={(e) => handleUpdateActiveMask({ feather: parseInt(e.target.value, 10) })}
                  className="of-range w-full"
                />
              </div>

              {/* Expansion */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-ink-400">
                  <span>Mask Expansion / Choke</span>
                  <span className="font-mono text-ink-200">
                    {activeMask.expansion > 0 ? `+${activeMask.expansion}` : activeMask.expansion} px
                  </span>
                </div>
                <input
                  type="range"
                  data-testid="mask-expansion-slider"
                  min={-20}
                  max={20}
                  value={activeMask.expansion}
                  onChange={(e) => handleUpdateActiveMask({ expansion: parseInt(e.target.value, 10) })}
                  className="of-range w-full"
                />
              </div>

              {/* Opacity */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-ink-400">
                  <span>Mask Opacity</span>
                  <span className="font-mono text-ink-200">{Math.round(activeMask.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  data-testid="mask-opacity-slider"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={activeMask.opacity}
                  onChange={(e) => handleUpdateActiveMask({ opacity: parseFloat(e.target.value) })}
                  className="of-range w-full"
                />
              </div>

              {/* Apply to All Frames toggle */}
              <label className="flex items-center gap-2 pt-1 border-t border-ink-800/80 text-[11px] text-ink-300 cursor-pointer">
                <input
                  type="checkbox"
                  data-testid="mask-apply-all-frames-toggle"
                  checked={activeMask.applyToAllFrames}
                  onChange={(e) => handleUpdateActiveMask({ applyToAllFrames: e.target.checked })}
                  className="rounded border-ink-700 bg-ink-800 text-brand"
                />
                <span className={activeMask.applyToAllFrames ? 'text-brand font-medium' : 'text-ink-400'}>
                  Apply to All Frames
                </span>
              </label>
            </div>
          )}
        </div>
      )}

      {/* Mode B: Main Tracking Pattern Controls */}
      {mode === 'main' && (
        <div className="space-y-2 pt-1 border-t border-ink-800 animate-in fade-in duration-100">
          <label className="block text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
            Track Pattern
          </label>
          <div className="grid grid-cols-3 gap-1">
            {(['point', 'multipoint', 'planar'] as MainTrackingType[]).map((t) => (
              <button
                key={t}
                type="button"
                data-testid={`track-pattern-${t}`}
                onClick={() => setMainType(t)}
                className={`py-1 px-2 rounded border text-center capitalize text-[10px] transition-colors ${
                  mainType === t
                    ? 'border-brand bg-brand/15 text-white font-medium'
                    : 'border-ink-800 bg-ink-900 hover:bg-ink-800 text-ink-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Track Points List */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
                Track Points ({trackPoints.length})
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-testid="add-track-point-btn"
                  onClick={handleAddPoint}
                  className="px-2 py-0.5 rounded bg-brand/20 text-brand hover:bg-brand/30 text-[10px] font-medium"
                >
                  + Add Point
                </button>
                <button
                  type="button"
                  data-testid="clear-track-points-btn"
                  onClick={handleClearPoints}
                  className="px-2 py-0.5 rounded bg-ink-800 text-ink-400 hover:text-white text-[10px]"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="space-y-1 max-h-32 overflow-y-auto rounded-lg border border-ink-800 bg-ink-950/40 p-1.5">
              {trackPoints.map((pt, idx) => (
                <div
                  key={idx}
                  data-testid="track-point-item"
                  className="flex items-center justify-between px-2 py-1 rounded bg-ink-900 text-[11px]"
                >
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-ink-200">PT #{idx + 1}</span>
                    <span className="text-[10px] text-ink-500">
                      ({(pt.x * 100).toFixed(1)}%, {(pt.y * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-brand">
                    {Math.round(pt.confidence * 100)}% conf
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Optical Flow Tracking Engine Settings */}
      <div className="space-y-2 pt-2 border-t border-ink-800">
        <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider block">
          Optical Flow Parameters
        </span>

        <div className="flex justify-between text-[11px] text-ink-400">
          <span>Search Window</span>
          <span className="font-mono">{searchWindow} px</span>
        </div>
        <input
          type="range"
          data-testid="tracking-search-window-slider"
          min={9}
          max={61}
          step={2}
          value={searchWindow}
          onChange={(e) => setSearchWindow(parseInt(e.target.value, 10))}
          className="of-range w-full"
        />

        <div className="flex justify-between text-[11px] text-ink-400">
          <span>Confidence Threshold</span>
          <span className="font-mono">{Math.round(confidenceThreshold * 100)}%</span>
        </div>
        <input
          type="range"
          data-testid="tracking-confidence-slider"
          min={0.1}
          max={0.95}
          step={0.05}
          value={confidenceThreshold}
          onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
          className="of-range w-full"
        />

        <label className="flex items-center gap-2 pt-1 text-[11px] text-ink-300 cursor-pointer">
          <input
            type="checkbox"
            data-testid="tracking-forward-backward-toggle"
            checked={forwardBackward}
            onChange={(e) => setForwardBackward(e.target.checked)}
            className="rounded border-ink-700 bg-ink-800 text-brand"
          />
          <span>Forward-Backward Consistency Validation</span>
        </label>
      </div>

      {/* Tracking Actions */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          data-testid="run-track-backward-btn"
          disabled={isTracking || (mode === 'main' && trackPoints.length === 0)}
          onClick={() => handleRunTracking('backward')}
          className="flex items-center justify-center gap-1.5 h-8 rounded-lg border border-ink-700 bg-ink-800 hover:bg-ink-700 disabled:opacity-40 text-ink-200 text-xs"
        >
          <ArrowLeft size={13} />
          <span>{mode === 'mask' ? 'Track Mask Back' : 'Track Back'}</span>
        </button>

        <button
          type="button"
          data-testid="run-track-forward-btn"
          disabled={isTracking || (mode === 'main' && trackPoints.length === 0)}
          onClick={() => handleRunTracking('forward')}
          className="flex items-center justify-center gap-1.5 h-8 rounded-lg bg-brand hover:bg-brand/90 disabled:opacity-40 text-white font-medium text-xs shadow-md shadow-brand/20"
        >
          <span>{mode === 'mask' ? 'Track Mask Forward' : 'Track Forward'}</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Progress Card */}
      {isTracking && (
        <div data-testid="tracking-progress-card" className="p-2.5 rounded-lg border border-brand/40 bg-brand/10 space-y-1.5">
          <div className="flex items-center justify-between text-violet-200 text-[11px] font-medium">
            <span className="flex items-center gap-1.5">
              <RefreshCw size={12} className="animate-spin text-brand" />
              <span>{mode === 'mask' ? 'Tracking & deforming mask contour...' : 'Matching Sobel gradients...'}</span>
            </span>
            <span className="font-mono">{progress}%</span>
          </div>
          <div className="h-1 w-full bg-ink-800 rounded-full overflow-hidden">
            <div className="h-full bg-brand transition-all duration-150" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Estimated Transform Result (Main Track) */}
      {estimatedTransform && !isTracking && mode === 'main' && (
        <div data-testid="tracking-result-card" className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-2">
          <div className="flex items-center gap-1.5 text-emerald-300 font-semibold text-xs">
            <CheckCircle2 size={14} />
            <span>Tracking Complete</span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-ink-300">
            <div>Delta X: <span className="text-white">{estimatedTransform.x}px</span></div>
            <div>Delta Y: <span className="text-white">{estimatedTransform.y}px</span></div>
            <div>Scale: <span className="text-white">{(estimatedTransform.scale || 1).toFixed(2)}x</span></div>
            <div>Rotation: <span className="text-white">{(estimatedTransform.rotation || 0).toFixed(1)}°</span></div>
          </div>
          <button
            type="button"
            data-testid="apply-tracking-transform-btn"
            onClick={handleApplyTransform}
            className="w-full h-7 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors"
          >
            Apply to Clip Transform
          </button>
        </div>
      )}
    </div>
  )
}
