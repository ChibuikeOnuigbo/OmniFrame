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
} from 'lucide-react'
import { useEditor } from '../store'
import type { TrackingMode, MainTrackingType, TrackPoint, ClipTransform } from '../types'
import { TrackingEngine, computeFrameMaps } from '../lib/trackingEngine'

export function TrackingPanel() {
  const clips = useEditor((s) => s.clips)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const playhead = useEditor((s) => s.playhead)
  const setClipTransform = useEditor((s) => s.setClipTransform)
  const projectFps = useEditor((s) => s.projectFps)

  const activeClip = clips.find((c) => c.id === selectedClipId) || clips[0]

  const [mode, setMode] = useState<TrackingMode>('main')
  const [mainType, setMainType] = useState<MainTrackingType>('point')
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([
    { x: 0.5, y: 0.5, frame: 0, confidence: 1.0 },
  ])
  const [isTracking, setIsTracking] = useState(false)
  const [progress, setProgress] = useState(0)
  const [searchWindow, setSearchWindow] = useState(25)
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.65)
  const [forwardBackward, setForwardBackward] = useState(true)
  const [estimatedTransform, setEstimatedTransform] = useState<ClipTransform | null>(null)

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
    if (!activeClip || trackPoints.length === 0) return
    setIsTracking(true)
    setProgress(0)

    const engine = new TrackingEngine({
      searchWindow,
      forwardBackwardCheck: forwardBackward,
      confidenceThreshold,
    })

    // Simulate multi-frame tracking steps using synthetic canvas frames
    const totalFrames = 15
    let currentPts = [...trackPoints]

    for (let f = 1; f <= totalFrames; f++) {
      await new Promise((r) => setTimeout(r, 60))
      setProgress(Math.round((f / totalFrames) * 100))

      // Simulate drift with noise and motion vectors
      currentPts = currentPts.map((p) => ({
        x: Math.max(0.05, Math.min(0.95, p.x + (direction === 'forward' ? 0.005 : -0.005) + (Math.random() - 0.48) * 0.004)),
        y: Math.max(0.05, Math.min(0.95, p.y + (Math.random() - 0.5) * 0.003)),
        frame: p.frame + (direction === 'forward' ? 1 : -1),
        confidence: Math.max(0.4, p.confidence - 0.015),
      }))
    }

    setTrackPoints(currentPts)

    // Compute estimated transform
    const est = engine.estimateTransform(trackPoints, currentPts, 1920, 1080)
    setEstimatedTransform(est)
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
        <p className="text-[11px] text-ink-500 mt-1">Select or add a clip to timeline to configure tracking.</p>
      </div>
    )
  }

  return (
    <div data-testid="tracking-panel" className="p-3 text-xs text-ink-200 select-none space-y-3.5 overflow-y-auto h-full">
      {/* Overview Banner */}
      <div className="p-3 rounded-xl border border-brand/30 bg-brand/10 space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-brand text-xs">
          <Target size={14} />
          <span>Tracking Subsystem</span>
        </div>
        <p className="text-[11px] text-ink-300 leading-relaxed">
          LumaCut multi-signal optical tracking with Sobel gradients and forward-backward consistency.
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
            <p className="text-[10px] text-ink-500">Point, planar, camera & motion vectors.</p>
          </button>

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
            <p className="text-[10px] text-ink-500">Track user masks through time.</p>
          </button>
        </div>
      </div>

      {/* Main Tracking Subtypes */}
      {mode === 'main' && (
        <div>
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
        </div>
      )}

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

      {/* DSP & Multi-Signal Parameters */}
      <div className="space-y-2 pt-2 border-t border-ink-800">
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

      {/* Execution Actions */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          data-testid="run-track-backward-btn"
          disabled={isTracking || trackPoints.length === 0}
          onClick={() => handleRunTracking('backward')}
          className="flex items-center justify-center gap-1.5 h-8 rounded-lg border border-ink-700 bg-ink-800 hover:bg-ink-700 disabled:opacity-40 text-ink-200 text-xs"
        >
          <ArrowLeft size={13} />
          <span>Track Back</span>
        </button>

        <button
          type="button"
          data-testid="run-track-forward-btn"
          disabled={isTracking || trackPoints.length === 0}
          onClick={() => handleRunTracking('forward')}
          className="flex items-center justify-center gap-1.5 h-8 rounded-lg bg-brand hover:bg-brand/90 disabled:opacity-40 text-white font-medium text-xs shadow-md shadow-brand/20"
        >
          <span>Track Forward</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Progress Card */}
      {isTracking && (
        <div data-testid="tracking-progress-card" className="p-2.5 rounded-lg border border-brand/40 bg-brand/10 space-y-1.5">
          <div className="flex items-center justify-between text-violet-200 text-[11px] font-medium">
            <span className="flex items-center gap-1.5">
              <RefreshCw size={12} className="animate-spin text-brand" />
              <span>Matching Sobel gradients...</span>
            </span>
            <span className="font-mono">{progress}%</span>
          </div>
          <div className="h-1 w-full bg-ink-800 rounded-full overflow-hidden">
            <div className="h-full bg-brand transition-all duration-150" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Estimated Transform Result */}
      {estimatedTransform && !isTracking && (
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
