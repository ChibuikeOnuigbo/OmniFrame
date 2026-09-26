import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Maximize2,
  Scan,
  Grid3x3,
  Paintbrush,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Plus,
  X,
  Box,
  Film,
  Sparkles,
} from 'lucide-react'
import { PreviewEngine } from '../lib/playback'
import { useEditor } from '../store'
import { IconButton } from './ui'
import { DrawingToolbar } from './DrawingToolbar'
import { DrawingCanvasOverlay } from './DrawingCanvasOverlay'
import { AspectRatioSelector } from './AspectRatioSelector'
import { ThreeViewer } from './ThreeViewer'
import { formatTimecode } from '../lib/time'

const VIEW_PADDING = 16

type Point = { x: number; y: number }

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<PreviewEngine | null>(null)
  const dragRef = useRef<{ pointerId: number; origin: Point; pan: Point } | null>(null)
  const assetVideoRef = useRef<HTMLVideoElement>(null)

  const clipCount = useEditor((s) => s.clips.length)
  const playing = useEditor((s) => s.playing)
  const previewQuality = useEditor((s) => s.previewQuality)
  const sequenceSettings = useEditor((s) => s.sequenceSettings)
  const drawingEnabled = useEditor((s) => s.drawingEnabled)
  const toggleDrawingEnabled = useEditor((s) => s.toggleDrawingEnabled)
  const workspacePreset = useEditor((s) => s.workspacePreset)
  const assets = useEditor((s) => s.assets)
  const sourcePreview = useEditor((s) => s.sourcePreview)
  const monitorMode = useEditor((s) => s.monitorMode)
  const setSourcePreviewAsset = useEditor((s) => s.setSourcePreviewAsset)
  const projectFps = useEditor((s) => s.projectFps)

  // Active uploaded media asset if selected from media library in source monitor mode
  const previewAsset = assets.find((a) => a.id === sourcePreview.assetId)
  const isPreviewingAsset = Boolean(previewAsset) && monitorMode === 'source' && !drawingEnabled

  // 3D View mode
  const [is3DMode, setIs3DMode] = useState(workspacePreset === '3d')
  useEffect(() => {
    if (workspacePreset === '3d') setIs3DMode(true)
  }, [workspacePreset])

  // Asset video local playback state
  const [assetPlaying, setAssetPlaying] = useState(false)
  const [assetCurrentTime, setAssetCurrentTime] = useState(0)
  const [assetDuration, setAssetDuration] = useState(0)
  const [assetMuted, setAssetMuted] = useState(false)

  const isPortrait = sequenceSettings.width < sequenceSettings.height
  const canvasW = previewQuality === 'low'
    ? (isPortrait ? Math.round(426 * (sequenceSettings.width / sequenceSettings.height)) : 426)
    : previewQuality === 'medium'
      ? (isPortrait ? Math.round(854 * (sequenceSettings.width / sequenceSettings.height)) : 854)
      : previewQuality === 'high'
        ? (isPortrait ? Math.round(1440 * (sequenceSettings.width / sequenceSettings.height)) : 1440)
        : sequenceSettings.width
  const canvasH = Math.round(canvasW / (sequenceSettings.width / sequenceSettings.height))

  const [display, setDisplay] = useState<'fit' | number>('fit')
  const [safe, setSafe] = useState(false)
  const [grid, setGrid] = useState(false)
  const [viewport, setViewport] = useState({ width: 1, height: 1 })
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })

  // Initialize or resize preview engine for timeline sequence playback
  useEffect(() => {
    if (isPreviewingAsset || is3DMode) {
      engineRef.current?.dispose()
      engineRef.current = null
      return
    }
    if (!canvasRef.current) return

    if (!engineRef.current) {
      const engine = new PreviewEngine(canvasRef.current, canvasW, canvasH)
      engineRef.current = engine
      engine.start()
    } else {
      engineRef.current.resize(canvasW, canvasH)
    }
  }, [canvasW, canvasH, isPreviewingAsset, is3DMode])

  useEffect(() => {
    return () => {
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const measure = () => setViewport({ width: el.clientWidth, height: el.clientHeight })
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    measure()
    return () => observer.disconnect()
  }, [])

  const fitScale = Math.max(
    0.01,
    Math.min(
      (viewport.width - VIEW_PADDING * 2) / canvasW,
      (viewport.height - VIEW_PADDING * 2) / canvasH,
    ),
  )
  const scale = display === 'fit' ? fitScale : display
  const canPan = display !== 'fit' &&
    (canvasW * scale > viewport.width || canvasH * scale > viewport.height)

  const clampPan = (next: Point): Point => {
    const maxX = Math.max(0, (canvasW * scale - viewport.width) / 2)
    const maxY = Math.max(0, (canvasH * scale - viewport.height) / 2)
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    }
  }

  useEffect(() => {
    setPan((current) => display === 'fit' ? { x: 0, y: 0 } : clampPan(current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display, viewport.width, viewport.height, scale, canvasW, canvasH])

  const stageStyle = useMemo<React.CSSProperties>(() => ({
    width: canvasW,
    height: canvasH,
    left: '50%',
    top: '50%',
    transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
    transformOrigin: 'center',
    willChange: 'transform',
  }), [pan.x, pan.y, scale, canvasW, canvasH])

  const chooseDisplay = (value: 'fit' | number) => {
    setDisplay(value)
    setPan({ x: 0, y: 0 })
  }

  const toggleAssetPlay = () => {
    const video = assetVideoRef.current
    if (!video) return
    if (video.paused) {
      video.play().catch(() => {})
      setAssetPlaying(true)
    } else {
      video.pause()
      setAssetPlaying(false)
    }
  }

  const handleAssetSeek = (t: number) => {
    const video = assetVideoRef.current
    if (!video) return
    video.currentTime = t
    setAssetCurrentTime(t)
  }

  const addAssetToTimeline = (asset: typeof previewAsset) => {
    if (!asset) return
    const st = useEditor.getState()
    const trkId = st.ensureTrack(asset.kind === 'audio' ? 'audio' : 'video')
    st.addClipToTrack(trkId, asset.id)
    // Return to timeline preview
    setSourcePreviewAsset(null)
  }

  return (
    <div
      ref={viewportRef}
      data-testid="preview-viewport"
      data-preview-scale={scale.toFixed(4)}
      data-preview-quality={previewQuality}
      data-preview-width={canvasW}
      data-preview-height={canvasH}
      data-preview-pan-x={pan.x.toFixed(2)}
      data-preview-pan-y={pan.y.toFixed(2)}
      className="flex-1 min-h-0 min-w-0 relative bg-ink-950 overflow-hidden select-none"
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button, input, [role="dialog"], [role="tooltip"], [data-testid="three-canvas-wrapper"]')) return
        if (!canPan || e.button !== 0) return
        dragRef.current = { pointerId: e.pointerId, origin: { x: e.clientX, y: e.clientY }, pan }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== e.pointerId) return
        setPan(clampPan({
          x: drag.pan.x + e.clientX - drag.origin.x,
          y: drag.pan.y + e.clientY - drag.origin.y,
        }))
      }}
      onPointerUp={(e) => {
        if (dragRef.current?.pointerId !== e.pointerId) return
        dragRef.current = null
        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* already released */ }
      }}
      onPointerCancel={() => { dragRef.current = null }}
      onDoubleClick={() => setPan({ x: 0, y: 0 })}
    >
      {/* Top Left: Media Asset Ingestion / Preview Pill (Only active when previewing source media) */}
      {isPreviewingAsset && (
        <div className="absolute top-2 left-3 z-30 flex items-center gap-1.5 text-xs">
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-ink-900/95 border border-brand/50 shadow-xl backdrop-blur-md">
            <Film size={13} className="text-brand" />
            <span className="font-medium text-ink-100 max-w-[140px] sm:max-w-xs truncate">
              {previewAsset.name}
            </span>
            <span className="text-[10px] uppercase font-mono px-1 rounded bg-brand/20 text-brand">
              {previewAsset.kind}
            </span>
            <button
              type="button"
              data-testid="add-preview-asset-timeline-btn"
              title="Add this asset to timeline"
              onClick={() => addAssetToTimeline(previewAsset)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand hover:bg-brand-600 text-white text-[10px] font-medium transition-colors ml-1"
            >
              <Plus size={11} />
              <span className="hidden sm:inline">Add to Timeline</span>
            </button>
            <button
              type="button"
              data-testid="close-asset-preview-btn"
              title="Return to Timeline Sequence"
              onClick={() => setSourcePreviewAsset(null)}
              className="p-1 rounded hover:bg-ink-800 text-ink-400 hover:text-white transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Top Right: View & 3D Controls */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
        {/* 3D Orbit Viewer Toggle */}
        <button
          type="button"
          data-testid="toggle-3d-btn"
          title={`3D Mode: ${is3DMode ? 'Active (Orbit & Drag to view)' : 'Disabled'}`}
          aria-label="Toggle 3D View"
          aria-pressed={is3DMode}
          onClick={() => setIs3DMode(!is3DMode)}
          className={`grid h-8 w-8 place-items-center rounded-md border transition-colors ${
            is3DMode
              ? 'bg-brand text-white border-brand shadow-sm'
              : 'border-ink-700 bg-ink-800 text-ink-400 hover:bg-ink-700 hover:text-white'
          }`}
        >
          <Box size={15} />
        </button>

        <IconButton
          title="Drawing & Paint"
          data-testid="toggle-drawing-btn"
          active={drawingEnabled}
          onClick={() => toggleDrawingEnabled()}
        >
          <Paintbrush size={15} />
        </IconButton>
        <IconButton title="Safe areas" active={safe} onClick={() => setSafe((v) => !v)}><Scan size={15} /></IconButton>
        <IconButton title="Grid" active={grid} onClick={() => setGrid((v) => !v)}><Grid3x3 size={15} /></IconButton>
        <div className="ml-1 flex h-8 items-stretch overflow-hidden rounded-md border border-ink-700 bg-ink-800 max-sm:hidden">
          <button type="button" title="Auto fit preview" aria-label="Auto fit preview" aria-pressed={display === 'fit'} onClick={() => chooseDisplay('fit')} className={`grid w-9 place-items-center border-r border-ink-700 ${display === 'fit' ? 'bg-brand text-white' : 'text-ink-400 hover:bg-ink-700 hover:text-white'}`}><Maximize2 size={14} /></button>
          <div className="relative flex items-center px-2"><input data-testid="preview-zoom-slider" aria-label="Preview zoom" type="range" min={25} max={200} step={5} value={Math.max(25, Math.min(200, Math.round(scale * 100)))} onChange={(e) => chooseDisplay(Number(e.target.value) / 100)} className="of-range w-20 sm:w-28" /><i aria-hidden="true" title="Auto fit point" className="pointer-events-none absolute top-1/2 h-3 w-px -translate-y-1/2 bg-white/60" style={{ left: `${8 + Math.max(0, Math.min(1, (fitScale * 100 - 25) / 175)) * 100}%` }} /></div>
          <output className="hidden sm:flex w-11 items-center justify-end border-l border-ink-700 pr-2 text-[10px] tabular-nums text-ink-400">{Math.round(scale * 100)}%</output>
        </div>
      </div>

      <DrawingToolbar />

      {/* Bottom Left: Very small & short Sequence Ping Icon down close to timeline */}
      {!isPreviewingAsset && (
        <div
          data-testid="timeline-sequence-indicator"
          className="absolute bottom-2 left-2 z-20 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-ink-900/80 border border-ink-800/80 shadow-xs backdrop-blur-sm text-[9px] text-ink-400 pointer-events-none"
          title="Active Timeline Sequence"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${playing ? 'bg-emerald-400 animate-ping' : 'bg-brand'}`} />
          <span className="font-mono text-ink-300">Seq</span>
        </div>
      )}

      {/* 3D Mode Canvas Stage: Full Orbit / Drag / Rotate around View */}
      {is3DMode ? (
        <div data-testid="preview-3d-stage" className="absolute inset-0 z-10 flex flex-col pt-12">
          <ThreeViewer
            width={canvasW}
            height={canvasH}
            videoElement={assetVideoRef.current}
          />
        </div>
      ) : isPreviewingAsset ? (
        /* Uploaded Media Asset Interactive Player */
        <div
          data-testid="preview-asset-stage"
          className="absolute z-10 flex flex-col items-center justify-center"
          style={stageStyle}
        >
          {previewAsset.kind === 'video' ? (
            <video
              ref={assetVideoRef}
              data-testid="preview-asset-video"
              src={previewAsset.url}
              playsInline
              muted={assetMuted}
              className="w-full h-full object-contain bg-black shadow-2xl rounded-sm"
              onTimeUpdate={(e) => setAssetCurrentTime((e.target as HTMLVideoElement).currentTime)}
              onLoadedMetadata={(e) => setAssetDuration((e.target as HTMLVideoElement).duration)}
              onEnded={() => setAssetPlaying(false)}
            />
          ) : previewAsset.kind === 'image' ? (
            <img
              src={previewAsset.url}
              alt={previewAsset.name}
              className="w-full h-full object-contain bg-black shadow-2xl rounded-sm select-none"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-ink-900 border border-ink-800 rounded-sm p-6 text-center">
              <audio
                ref={assetVideoRef as any}
                src={previewAsset.url}
                muted={assetMuted}
                onTimeUpdate={(e) => setAssetCurrentTime((e.target as HTMLAudioElement).currentTime)}
                onLoadedMetadata={(e) => setAssetDuration((e.target as HTMLAudioElement).duration)}
                onEnded={() => setAssetPlaying(false)}
              />
              <div className="w-16 h-16 rounded-full bg-brand/20 border border-brand/40 grid place-items-center mb-3">
                <Volume2 size={32} className="text-brand" />
              </div>
              <h3 className="text-sm font-semibold text-ink-100">{previewAsset.name}</h3>
              <p className="text-xs text-ink-400 mt-1">Audio Track · {formatTimecode(assetDuration, projectFps)}</p>
            </div>
          )}

          {/* Floating Media Transport Bar for Asset Preview */}
          <div
            data-testid="asset-transport-bar"
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink-900/90 border border-ink-700/80 shadow-2xl backdrop-blur-md text-xs text-ink-200"
          >
            <button
              type="button"
              data-testid="asset-play-pause-btn"
              onClick={toggleAssetPlay}
              className="p-1 rounded hover:bg-ink-800 text-white"
            >
              {assetPlaying ? <Pause size={15} /> : <Play size={15} />}
            </button>

            <button
              type="button"
              data-testid="asset-rewind-btn"
              onClick={() => handleAssetSeek(0)}
              className="p-1 rounded hover:bg-ink-800 text-ink-400 hover:text-white"
            >
              <RotateCcw size={13} />
            </button>

            <span className="font-mono text-[10px] text-ink-400 min-w-[50px]">
              {formatTimecode(assetCurrentTime, projectFps)} / {formatTimecode(assetDuration, projectFps)}
            </span>

            <input
              type="range"
              min={0}
              max={assetDuration || 1}
              step={0.05}
              value={assetCurrentTime}
              onChange={(e) => handleAssetSeek(parseFloat(e.target.value))}
              className="of-range w-24 sm:w-36"
            />

            <button
              type="button"
              onClick={() => setAssetMuted(!assetMuted)}
              className="p-1 rounded hover:bg-ink-800 text-ink-400 hover:text-white"
            >
              {assetMuted ? <VolumeX size={14} className="text-red-400" /> : <Volume2 size={14} />}
            </button>
          </div>
        </div>
      ) : (
        /* Unified Timeline Sequence Canvas Viewport */
        <div
          data-testid="preview-stage"
          className={`absolute ${canPan ? 'cursor-grab active:cursor-grabbing' : ''}`}
          style={stageStyle}
        >
          <canvas
            id="of-canvas"
            ref={canvasRef}
            width={canvasW}
            height={canvasH}
            data-quality-effect={previewQuality === 'low' ? 'pixelated' : previewQuality === 'medium' ? 'soft' : 'clear'}
            className="block w-full h-full bg-black shadow-2xl rounded-sm"
            style={{
              imageRendering: previewQuality === 'low' ? 'pixelated' : 'auto',
              filter: previewQuality === 'medium' ? 'contrast(0.99)' : previewQuality === 'high' ? 'contrast(1.025) saturate(1.01)' : 'none',
            }}
          />
          <DrawingCanvasOverlay width={canvasW} height={canvasH} />
          {safe && (
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-[5%] border border-dashed border-white/40" />
              <div className="absolute inset-[10%] border border-dashed border-white/20" />
            </div>
          )}
          {grid && (
            <div className="pointer-events-none absolute inset-0 opacity-[0.15]" style={{
              backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
              backgroundSize: '10% 10%',
            }} />
          )}
        </div>
      )}

      {/* Empty canvas notice: hidden when playback is running, media is active, or canvas is non-empty */}
      {clipCount === 0 && !playing && !assetPlaying && !isPreviewingAsset && !is3DMode && !drawingEnabled && (
        <div className="absolute inset-0 z-10 grid place-items-center pointer-events-none">
          <div className="text-center text-ink-500 px-4">
            <div className="text-sm font-medium text-ink-400">Your canvas is empty</div>
            <div className="text-xs mt-1">Select media from the library to preview or add to timeline.</div>
          </div>
        </div>
      )}

      {/* Aspect Ratio Selector fixed to BOTTOM-RIGHT of preview */}
      <AspectRatioSelector />
    </div>
  )
}
