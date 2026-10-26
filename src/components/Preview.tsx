import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
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
  Check,
} from 'lucide-react'
import { PreviewEngine } from '../lib/playback'
import { PW, PH } from '../lib/playback'
import { evaluateClipAnimation } from '../lib/animation/CurveEngine'
import { useEditor } from '../store'
import { IconButton } from './ui'
import { DrawingToolbar } from './DrawingToolbar'
import { SelectionSubToolBar } from './SelectionSubToolBar'
import { DrawingCanvasOverlay } from './DrawingCanvasOverlay'
import { SlideDock } from './SlideDock'
import { CollapseChip } from './CollapseChip'
import { Tooltip } from './Tooltip'
import { AspectRatioSelector } from './AspectRatioSelector'
// three.js (~600 KB) loads only when 3D mode is first opened — it must not
// ride in the initial bundle (see qa/bundle-budget-e2e.mjs).
const ThreeViewer = lazy(() =>
  import('./ThreeViewer').then((m) => ({ default: m.ThreeViewer })),
)
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
  const leftTab = useEditor((s) => s.leftTab)
  const pivotEditEnabled = useEditor((s) => s.pivotEditEnabled)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const allClips = useEditor((s) => s.clips)
  const allTracks = useEditor((s) => s.tracks)
  const playheadPos = useEditor((s) => s.playhead)
  const pivotDragRef = useRef<{ pointerId: number; clipId: string } | null>(null)
  const leftOpen = useEditor((s) => s.leftOpen)
  const playhead = useEditor((s) => s.playhead)
  const visualPreview = useEditor((s) => s.visualPreview)
  const applyVisualPreview = useEditor((s) => s.applyVisualPreview)
  const stopVisualPreview = useEditor((s) => s.stopVisualPreview)
  const omniframeCharacters = useEditor((s) => s.omniframeCharacters)
  const selectedCharacterId = useEditor((s) => s.selectedCharacterId)
  const setSelectedCharacterId = useEditor((s) => s.setSelectedCharacterId)
  const evaluateCharacterTransformAtTime = useEditor((s) => s.evaluateCharacterTransformAtTime)
  const maskEditClipId = useEditor((s) => s.maskEditClipId)
  const setMaskEditClip = useEditor((s) => s.setMaskEditClip)
  const updateClipMask = useEditor((s) => s.updateClipMask)
  const maskClip = useEditor((s) => s.clips.find((c) => c.id === s.maskEditClipId) || null)
  const maskDragRef = useRef<{
    mode: 'draw' | 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'split-move' | 'split-rotate' | 'point'
    anchor: Point
    orig: { centerX: number; centerY: number; width: number; height: number }
    pointIndex?: number
    origSplit?: { pos: number; angle: number }
  } | null>(null)

  useEffect(() => {
    if (!maskEditClipId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMaskEditClip(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [maskEditClipId, setMaskEditClip])

  // Active uploaded media asset if selected from media library in source monitor mode
  const previewAsset = assets.find((a) => a.id === sourcePreview.assetId)
  const isPreviewingAsset = Boolean(previewAsset) && monitorMode === 'source' && !drawingEnabled

  // 3D View mode
  const is3DMode = useEditor((s) => s.is3DMode)
  const setIs3DMode = useEditor((s) => s.setIs3DMode)
  useEffect(() => {
    if (workspacePreset === '3d') setIs3DMode(true)
  }, [workspacePreset, setIs3DMode])

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
  // − / + collapse for the view/zoom cluster (chip lives top-left; cluster top-right).
  const [viewControlsOpen, setViewControlsOpen] = useState(true)
  const [safe, setSafe] = useState(false)
  const [grid, setGrid] = useState(false)
  const [viewport, setViewport] = useState({ width: 1, height: 1 })
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })

  // Initialize or resize preview engine for timeline sequence playback
  useEffect(() => {
    if (isPreviewingAsset) {
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
  }, [canvasW, canvasH, isPreviewingAsset])

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
      {/* Top Right: View & 3D Controls.
          Must sit above preview-3d-stage (z-20), which is inset-0 and rendered
          later in the DOM: at an equal z-index it won and swallowed clicks on
          this bar, so turning 3D mode on made its own toggle unreachable.
          z-40 also clears the selection floating toolbar (z-30), which is
          centred and wide enough to reach this corner once several tools are
          shown -- it used to bury the 3D and drawing toggles. */}
      {/* Top Left: the −/+ chip that collapses the whole view & zoom cluster.
          Placed in the stage corner so it never competes with the controls
          themselves and stays discoverable when the cluster is gone. */}
      <div className="absolute top-2 left-2 z-40">
        <CollapseChip
          open={viewControlsOpen}
          onToggle={() => setViewControlsOpen((v) => !v)}
          label="preview view & zoom controls"
          testId="slide-dock-preview-view-controls-toggle"
        />
      </div>

      <div className="absolute top-2 right-2 z-40 flex items-center gap-1">
        <SlideDock
          id="preview-view-controls"
          label="view controls"
          direction="up"
          toggle="none"
          open={viewControlsOpen}
          onOpenChange={setViewControlsOpen}
        >
        {/* 3D Orbit Viewer Toggle */}
        <Tooltip label={is3DMode ? '3D Mode: on (orbit & drag to view)' : '3D Mode: off'}>
        <button
          type="button"
          data-testid="toggle-3d-btn"
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
        </Tooltip>

        <Tooltip label="Drawing & Paint">
        <IconButton
          data-testid="toggle-drawing-btn"

          active={drawingEnabled}
          onClick={() => toggleDrawingEnabled()}
        >
          <Paintbrush size={15} />
        </IconButton></Tooltip>
        <Tooltip label="Safe areas"><IconButton title="Toggle safe areas" active={safe} onClick={() => setSafe((v) => !v)}><Scan size={15} /></IconButton></Tooltip>
        <Tooltip label="Grid"><IconButton title="Toggle composition grid" active={grid} onClick={() => setGrid((v) => !v)}><Grid3x3 size={15} /></IconButton></Tooltip>
        <div className="ml-1 flex h-8 items-stretch overflow-hidden rounded-md border border-ink-700 bg-ink-800 max-sm:hidden">
          <Tooltip label="Auto fit preview"><button type="button" aria-label="Auto fit preview" aria-pressed={display === 'fit'} onClick={() => chooseDisplay('fit')} className={`grid w-9 place-items-center border-r border-ink-700 ${display === 'fit' ? 'bg-brand text-white' : 'text-ink-400 hover:bg-ink-700 hover:text-white'}`}><Maximize2 size={14} /></button></Tooltip>
          <div className="relative flex items-center px-2"><input data-testid="preview-zoom-slider" aria-label="Preview zoom" type="range" min={25} max={200} step={5} value={Math.max(25, Math.min(200, Math.round(scale * 100)))} onChange={(e) => chooseDisplay(Number(e.target.value) / 100)} className="of-range w-20 sm:w-28" /><i aria-hidden="true" title="Auto fit point" className="pointer-events-none absolute top-1/2 h-3 w-px -translate-y-1/2 bg-white/60" style={{ left: `${8 + Math.max(0, Math.min(1, (fitScale * 100 - 25) / 175)) * 100}%` }} /></div>
          <output className="hidden sm:flex w-11 items-center justify-end border-l border-ink-700 pr-2 text-[10px] tabular-nums text-ink-400">{Math.round(scale * 100)}%</output>
        </div>
        </SlideDock>
      </div>

      <DrawingToolbar />
      <SelectionSubToolBar />

      {visualPreview && !isPreviewingAsset && (
        <div
          data-testid="visual-preview-actions"
          className="pointer-events-auto absolute left-1/2 top-12 z-50 flex max-w-[min(92%,560px)] -translate-x-1/2 items-center gap-2 rounded-lg border border-amber-400/40 bg-ink-950/95 px-2.5 py-2 text-[10px] text-ink-200 shadow-2xl backdrop-blur-sm"
          role="status"
        >
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-400/15 text-amber-300">
            <Sparkles size={11} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-amber-200" title={visualPreview.label}>{visualPreview.label}</span>
            <span className="block text-[9px] text-ink-500">Temporary audition · not in the project until applied</span>
          </span>
          {visualPreview.kind !== 'clip-playback' && visualPreview.kind !== 'range-playback' && (
            <button
              type="button"
              data-testid="apply-visual-preview"
              onClick={applyVisualPreview}
              className="flex h-7 shrink-0 items-center gap-1 rounded-md bg-emerald-500/20 px-2 font-semibold text-emerald-200 hover:bg-emerald-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              title="Commit this audition to the timeline"
            >
              <Check size={12} /> Apply
            </button>
          )}
          <button
            type="button"
            data-testid="stop-visual-preview"
            onClick={stopVisualPreview}
            className="h-7 shrink-0 rounded-md border border-ink-700 px-2 text-ink-300 hover:border-red-400/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            title="Cancel this audition and restore the previous playhead"
          >
            Stop
          </button>
        </div>
      )}

      {/* Floating selection quick-bar (BrandBird study): contextual
          actions float over the monitor for the selected clip. */}
      {!visualPreview && !isPreviewingAsset && (() => {
        const clip = allClips.find((c) => c.id === selectedClipId)
        if (!clip) return null
        const isTitle = clip.kind === 'text' || !!clip.textStyle
        return (
          <div
            data-testid="selection-quick-bar"
            className="pointer-events-auto absolute left-1/2 top-12 z-40 flex max-w-[min(94%,520px)] -translate-x-1/2 items-center gap-1 rounded-full border border-ink-600/80 bg-ink-950/90 py-1 pl-3 pr-1 text-[10px] text-ink-200 shadow-2xl backdrop-blur-sm"
            role="toolbar"
            aria-label="Selected clip quick actions"
          >
            <span className="max-w-44 truncate font-medium text-ink-100" title={clip.name}>{clip.name}</span>
            <span className="h-4 w-px bg-ink-700" aria-hidden="true" />
            <button type="button" data-testid="quick-bar-effects" onClick={() => useEditor.getState().setLeftTab('effects')} className="h-6 rounded-full px-2 hover:bg-ink-800 hover:text-white" title="Open Effects for this clip">Effects</button>
            {isTitle && (
              <button type="button" data-testid="quick-bar-text" onClick={() => useEditor.getState().setLeftTab('text')} className="h-6 rounded-full px-2 hover:bg-ink-800 hover:text-white" title="Style this title">Text</button>
            )}
            <button type="button" data-testid="quick-bar-split" onClick={() => useEditor.getState().splitAt(useEditor.getState().playhead)} className="h-6 rounded-full px-2 hover:bg-ink-800 hover:text-white" title="Split at playhead (Ctrl+B)">Split</button>
            <button type="button" data-testid="quick-bar-delete" onClick={() => useEditor.getState().removeClip(clip.id)} className="grid h-6 w-6 place-items-center rounded-full text-ink-400 hover:bg-red-500/20 hover:text-red-200" title="Delete clip" aria-label="Delete selected clip">✕</button>
          </div>
        )
      })()}

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
      {is3DMode && (
        <div data-testid="preview-3d-stage" className="absolute inset-0 z-20 flex flex-col pt-12">
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center text-[11px] text-ink-400">
                Loading 3D stage…
              </div>
            }
          >
            <ThreeViewer
              width={viewport.width || canvasW}
              height={viewport.height || canvasH}
              videoElement={assetVideoRef.current}
              sourceCanvas={canvasRef.current}
            />
          </Suspense>
        </div>
      )}

      {isPreviewingAsset && previewAsset ? (
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
                <Volume2 size={32} className="text-brand-400" />
              </div>
              <h3 className="text-sm font-semibold text-ink-100 max-w-[280px] truncate" title={previewAsset.name}>{previewAsset.name}</h3>
              <p className="text-xs text-ink-400 mt-1">Audio Track · {formatTimecode(assetDuration, projectFps)}</p>
            </div>
          )}
        </div>
      ) : (
        /* Unified Timeline Sequence Canvas Viewport */
        <div
          data-testid="preview-stage"
          className={`absolute ${canPan ? 'cursor-grab active:cursor-grabbing' : ''} ${is3DMode ? 'opacity-0 pointer-events-none' : ''}`}
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

          {/* Pivot (anchor) handle — Krita armature technique: drag the hinge
              onto a joint; rotation/scale turn about it. Canvas coords map
              1:1 inside the stage. */}
          {pivotEditEnabled && (() => {
            const clip = allClips.find((c) => c.id === selectedClipId)
            if (!clip || clip.kind === 'audio' || clip.kind === 'adjustment') return null
            if (!allTracks.some((t) => t.id === clip.trackId)) return null
            if (playheadPos < clip.start || playheadPos >= clip.start + clip.duration) return null
            const asset = assets.find((a) => a.id === clip.assetId)
            let dw = canvasW
            let dh = canvasH
            if (clip.kind !== 'compound' && asset) {
              const vw = asset.width || PW
              const vh = asset.height || PH
              const cover = Math.max(canvasW / vw, canvasH / vh)
              dw = vw * cover
              dh = vh * cover
            } else if (clip.kind !== 'compound' && !asset) {
              return null
            }
            const evalT = evaluateClipAnimation(clip, playheadPos)
            const cxC = canvasW / 2 + evalT.x * (canvasW / PW)
            const cyC = canvasH / 2 + evalT.y * (canvasH / PH)
            const hx = cxC + (evalT.pivotX - 0.5) * dw
            const hy = cyC + (evalT.pivotY - 0.5) * dh
            const toCanvas = (e: React.PointerEvent) => {
              const rect = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect()
              return {
                x: (e.clientX - rect.left) * (canvasW / rect.width),
                y: (e.clientY - rect.top) * (canvasH / rect.height),
              }
            }
            return (
              <div
                data-testid="pivot-anchor-handle"
                role="slider"
                aria-label={`Pivot anchor for ${clip.name}: drag to move the rotation hinge`}
                aria-valuetext={`pivot ${(evalT.pivotX * 100).toFixed(0)} percent, ${(evalT.pivotY * 100).toFixed(0)} percent`}
                title="Pivot anchor — drag onto a joint; rotation hinges here"
                className="absolute z-30 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none place-items-center rounded-full border-2 border-pink-400 bg-pink-500/25 shadow-[0_0_0_3px_rgba(0,0,0,0.45)] active:cursor-grabbing"
                style={{ left: hx, top: hy }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  pivotDragRef.current = { pointerId: e.pointerId, clipId: clip.id }
                  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                }}
                onPointerMove={(e) => {
                  const drag = pivotDragRef.current
                  if (!drag || drag.pointerId !== e.pointerId || drag.clipId !== clip.id) return
                  const pt = toCanvas(e)
                  useEditor.getState().setClipTransform(clip.id, {
                    pivotX: Math.max(-1, Math.min(2, 0.5 + (pt.x - cxC) / dw)),
                    pivotY: Math.max(-1, Math.min(2, 0.5 + (pt.y - cyC) / dh)),
                  })
                }}
                onPointerUp={(e) => {
                  if (pivotDragRef.current?.pointerId === e.pointerId) pivotDragRef.current = null
                  try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* already released */ }
                }}
                onPointerCancel={() => { pivotDragRef.current = null }}
              >
                <span aria-hidden="true" className="pointer-events-none block h-1.5 w-1.5 rounded-full bg-pink-300" />
                <span aria-hidden="true" className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 rounded bg-black/70 px-1 text-[8px] font-semibold tracking-wider text-pink-200">PIVOT</span>
              </div>
            )
          })()}

          {/* OmniFrame Mode Character Overlays on Preview */}
          {leftTab === 'omniframe' && leftOpen && (
            <div
              data-testid="omniframe-canvas-overlay"
              className="absolute inset-0 pointer-events-auto select-none"
            >
              {omniframeCharacters.map((char) => {
                const evalTransform = evaluateCharacterTransformAtTime(char.id, playhead)
                if ((evalTransform.opacity ?? 1) <= 0.01) return null
                const isSelected = char.id === selectedCharacterId
                const leftPct = (char.bounds.x * 100).toFixed(2)
                const topPct = (char.bounds.y * 100).toFixed(2)
                const widthPct = (char.bounds.width * 100).toFixed(2)
                const heightPct = (char.bounds.height * 100).toFixed(2)

                return (
                  <div
                    key={char.id}
                    data-testid={`canvas-character-box-${char.id}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedCharacterId(char.id)
                    }}
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                      transform: `translate(${evalTransform.x}px, ${evalTransform.y}px) scale(${evalTransform.scale}) rotate(${evalTransform.rotation}deg)`,
                      transformOrigin: 'center center',
                    }}
                    className={`cursor-pointer transition-all rounded-md ${
                      isSelected
                        ? 'border-2 border-brand bg-brand/5 shadow-lg ring-2 ring-brand/50'
                        : 'border border-dashed border-ink-500/40 hover:border-brand/70 hover:bg-white/5'
                    }`}
                  >
                    {/* Badge */}
                    <div className={`absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wide whitespace-nowrap shadow-sm pointer-events-none z-10 flex items-center gap-1 max-w-[200px] ${
                      isSelected ? 'bg-brand text-white font-bold' : 'bg-ink-900/90 text-ink-300 border border-ink-700'
                    }`}>
                      <span className="truncate max-w-[120px]" title={char.name}>{char.name}</span>
                      {(evalTransform.x !== 0 || evalTransform.y !== 0) && (
                        <span className="text-[10px] opacity-90 font-mono text-amber-300 shrink-0">
                          ({evalTransform.x > 0 ? `+${evalTransform.x}` : evalTransform.x}, {evalTransform.y > 0 ? `+${evalTransform.y}` : evalTransform.y})
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {/* Clip Mask draw/edit overlay: drag to draw, inside to move, corners to resize */}
          {maskClip?.mask && !isPreviewingAsset && (() => {
            const m = maskClip.mask
            const toPoint = (e: React.PointerEvent) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              return {
                x: Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width))),
                y: Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height))),
              }
            }
            const bounds = {
              left: m.centerX - m.width / 2,
              top: m.centerY - m.height / 2,
              right: m.centerX + m.width / 2,
              bottom: m.centerY + m.height / 2,
            }
            const applyBounds = (left: number, top: number, right: number, bottom: number) => {
              const w = Math.max(0.02, Math.abs(right - left))
              const h = Math.max(0.02, Math.abs(bottom - top))
              updateClipMask(maskClip.id, {
                centerX: Math.max(0, Math.min(1, (left + right) / 2)),
                centerY: Math.max(0, Math.min(1, (top + bottom) / 2)),
                width: Math.min(1, w),
                height: Math.min(1, h),
              })
            }
            return (
              <div
                data-testid="clip-mask-overlay"
                className="absolute inset-0 z-30 select-none"
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => {
                  const p = toPoint(e)
                  const kind = m.kind || 'shape'
                  if (kind === 'custom') {
                    const pointIdx = (e.target as HTMLElement).dataset.maskPoint
                    if (pointIdx !== undefined) {
                      maskDragRef.current = { mode: 'point', anchor: p, orig: { centerX: m.centerX, centerY: m.centerY, width: m.width, height: m.height }, pointIndex: Number(pointIdx) }
                    } else {
                      updateClipMask(maskClip.id, { points: [...(m.points || []), p] })
                      maskDragRef.current = { mode: 'point', anchor: p, orig: { centerX: m.centerX, centerY: m.centerY, width: m.width, height: m.height }, pointIndex: (m.points || []).length }
                    }
                    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                    return
                  }
                  if (kind === 'split') {
                    const rotate = (e.target as HTMLElement).dataset.maskSplitRotate
                    maskDragRef.current = {
                      mode: rotate ? 'split-rotate' : 'split-move',
                      anchor: p,
                      orig: { centerX: m.centerX, centerY: m.centerY, width: m.width, height: m.height },
                      origSplit: { pos: m.splitPos ?? 0.5, angle: m.splitAngle ?? 0 },
                    }
                    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                    return
                  }
                  const handle = (e.target as HTMLElement).dataset.maskHandle
                  const inside = p.x >= bounds.left && p.x <= bounds.right && p.y >= bounds.top && p.y <= bounds.bottom
                  const mode = (handle as 'nw' | 'ne' | 'sw' | 'se' | undefined) || (inside ? 'move' : 'draw')
                  maskDragRef.current = { mode, anchor: p, orig: { centerX: m.centerX, centerY: m.centerY, width: m.width, height: m.height } }
                  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                  if (mode === 'draw') applyBounds(p.x, p.y, p.x, p.y)
                }}
                onPointerMove={(e) => {
                  const drag = maskDragRef.current
                  if (!drag) return
                  const p = toPoint(e)
                  if (drag.mode === 'point' && drag.pointIndex !== undefined) {
                    const pts = (m.points || []).map((pt, i) => (i === drag.pointIndex ? p : pt))
                    updateClipMask(maskClip.id, { points: pts })
                    return
                  }
                  if (drag.mode === 'split-move' && drag.origSplit) {
                    const a = ((drag.origSplit.angle * Math.PI) / 180)
                    const nx = Math.cos(a)
                    const ny = Math.sin(a)
                    const proj = (p.x - 0.5) * nx + (p.y - 0.5) * ny
                    updateClipMask(maskClip.id, { splitPos: Math.max(0, Math.min(1, 0.5 + proj)) })
                    return
                  }
                  if (drag.mode === 'split-rotate' && drag.origSplit) {
                    const a = ((drag.origSplit.angle * Math.PI) / 180)
                    const px = 0.5 + Math.cos(a) * ((drag.origSplit.pos - 0.5) * 1.4)
                    const py = 0.5 + Math.sin(a) * ((drag.origSplit.pos - 0.5) * 1.4)
                    const deg = (Math.atan2(p.y - py, p.x - px) * 180) / Math.PI - 90
                    updateClipMask(maskClip.id, { splitAngle: Math.max(-180, Math.min(180, deg)) })
                    return
                  }
                  const o = drag.orig
                  const ob = { left: o.centerX - o.width / 2, top: o.centerY - o.height / 2, right: o.centerX + o.width / 2, bottom: o.centerY + o.height / 2 }
                  if (drag.mode === 'draw') {
                    applyBounds(drag.anchor.x, drag.anchor.y, p.x, p.y)
                  } else if (drag.mode === 'move') {
                    const dx = p.x - drag.anchor.x
                    const dy = p.y - drag.anchor.y
                    updateClipMask(maskClip.id, {
                      centerX: Math.max(0, Math.min(1, o.centerX + dx)),
                      centerY: Math.max(0, Math.min(1, o.centerY + dy)),
                    })
                  } else {
                    const left = drag.mode.includes('w') ? p.x : ob.left
                    const right = drag.mode.includes('e') ? p.x : ob.right
                    const top = drag.mode.includes('n') ? p.y : ob.top
                    const bottom = drag.mode.includes('s') ? p.y : ob.bottom
                    // Keep the opposite corner anchored: the untouched edges
                    // above already hold the original bounds.
                    applyBounds(
                      drag.mode.includes('w') ? Math.min(p.x, ob.right - 0.02) : left,
                      drag.mode.includes('n') ? Math.min(p.y, ob.bottom - 0.02) : top,
                      drag.mode.includes('e') ? Math.max(p.x, ob.left + 0.02) : right,
                      drag.mode.includes('s') ? Math.max(p.y, ob.top + 0.02) : bottom,
                    )
                  }
                }}
                onPointerUp={() => {
                  maskDragRef.current = null
                }}
              >
                {(m.kind || 'shape') === 'split' && (() => {
                  const a = (((m.splitAngle ?? 0) * Math.PI) / 180)
                  const px = 0.5 + Math.cos(a) * (((m.splitPos ?? 0.5) - 0.5) * 1.4)
                  const py = 0.5 + Math.sin(a) * (((m.splitPos ?? 0.5) - 0.5) * 1.4)
                  return (
                    <>
                      <div
                        data-testid="clip-mask-split-line"
                        className={`pointer-events-none absolute h-[220%] w-0 border-l-2 border-dashed ${m.inverted ? 'border-amber-300' : 'border-teal-300'}`}
                        style={{ left: `${px * 100}%`, top: '-60%', transform: `rotate(${-(m.splitAngle ?? 0)}deg)`, transformOrigin: 'center' }}
                      />
                      <span
                        data-mask-split-rotate="1"
                        data-testid="clip-mask-split-rotate"
                        title="Drag to rotate the split line"
                        className="pointer-events-auto absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border border-black/50 bg-teal-200"
                        style={{ left: `${px * 100}%`, top: `${py * 100}%` }}
                      />
                    </>
                  )
                })()}
                {m.kind === 'custom' && (
                  <>
                    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                      {(m.points || []).length >= 2 && (
                        <polygon
                          points={(m.points || []).map((pt) => `${pt.x * 100},${pt.y * 100}`).join(' ')}
                          fill="rgba(45,212,191,0.10)"
                          stroke={m.inverted ? '#fcd34d' : '#5eead4'}
                          strokeWidth="0.5"
                        />
                      )}
                    </svg>
                    {(m.points || []).map((pt, i) => (
                      <span
                        key={i}
                        data-mask-point={i}
                        data-testid={`clip-mask-point-${i}`}
                        title={`Point ${i + 1} — drag to move`}
                        className="pointer-events-auto absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border border-black/50 bg-teal-200"
                        style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%` }}
                      />
                    ))}
                  </>
                )}
                {(m.kind || 'shape') !== 'split' && m.kind !== 'custom' && (
                <div
                  data-testid="clip-mask-outline"
                  className={`pointer-events-none absolute border-2 ${m.inverted ? 'border-amber-300' : 'border-teal-300'} bg-white/5 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]`}
                  style={{
                    left: `${bounds.left * 100}%`,
                    top: `${bounds.top * 100}%`,
                    width: `${m.width * 100}%`,
                    height: `${m.height * 100}%`,
                    transform: `rotate(${m.rotation}deg)`,
                    borderRadius: m.shape === 'ellipse' ? '50%' : '4px',
                  }}
                >
                  {(['nw', 'ne', 'sw', 'se'] as const).map((h) => (
                    <span
                      key={h}
                      data-mask-handle={h}
                      data-testid={`clip-mask-handle-${h}`}
                      className="pointer-events-auto absolute h-3 w-3 rounded-sm border border-black/50 bg-teal-200"
                      style={{
                        left: h.includes('w') ? -6 : undefined,
                        right: h.includes('e') ? -6 : undefined,
                        top: h.includes('n') ? -6 : undefined,
                        bottom: h.includes('s') ? -6 : undefined,
                        cursor: `${h}-resize`,
                      }}
                    />
                  ))}
                </div>
                )}
                <div className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-teal-100">
                  {m.kind === 'split'
                    ? `Split view (${m.inverted ? 'Exclude' : 'Include'}): drag to move the line · handle rotates · Esc done`
                    : m.kind === 'custom'
                      ? `Custom view (${m.inverted ? 'Exclude' : 'Include'}): click to add points · drag points · Esc done`
                      : `Mask (${m.inverted ? 'Outside' : 'Inside'}): drag to draw · inside moves · corners resize · Esc done`}
                </div>
              </div>
            )
          })()}
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

      {/* Source Media Details Banner (Bottom Left, resized and part of preview) */}
      {isPreviewingAsset && previewAsset && (
        <div
          data-testid="preview-asset-detail"
          className="absolute bottom-16 left-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink-950/90 border border-ink-700/80 shadow-xl text-xs backdrop-blur-xs animate-in fade-in duration-100 max-w-[280px] sm:max-w-md"
        >
          <Film size={14} className="text-brand-400 shrink-0" />
          <span
            data-testid="preview-asset-detail-name"
            title={previewAsset.name}
            className="font-medium text-ink-100 max-w-[130px] sm:max-w-[170px] truncate text-ellipsis overflow-hidden whitespace-nowrap block"
          >
            {previewAsset.name}
          </span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-brand/20 text-brand-400 font-semibold shrink-0">
            {previewAsset.kind}
          </span>
          <button
            type="button"
            data-testid="close-asset-preview-btn"
            title="Return to Timeline Sequence"
            aria-label="Return to timeline sequence"
            onClick={() => setSourcePreviewAsset(null)}
            className="p-1 rounded-md hover:bg-ink-800 text-ink-400 hover:text-white transition-colors ml-1 shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Expanded, High-Contrast Media Transport Bar for Asset Preview */}
      {isPreviewingAsset && (
        <div
          data-testid="asset-transport-bar"
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 w-[calc(100%-32px)] max-w-3xl h-11 flex items-center gap-2.5 px-4 rounded-xl bg-ink-950/95 border border-ink-700/80 shadow-2xl text-xs text-ink-200 backdrop-blur-xs animate-in fade-in duration-100"
        >
          <button
            type="button"
            data-testid="asset-play-pause-btn"
            onClick={toggleAssetPlay}
            aria-label={assetPlaying ? 'Pause asset playback' : 'Play asset'}
            className="h-8 w-8 rounded-lg bg-brand/20 hover:bg-brand/30 border border-brand/40 text-brand-400 flex items-center justify-center transition-colors shrink-0"
          >
            {assetPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </button>

          <button
            type="button"
            data-testid="asset-rewind-btn"
            onClick={() => handleAssetSeek(0)}
            aria-label="Rewind asset to start"
            className="h-8 w-8 rounded-lg bg-ink-850 hover:bg-ink-800 border border-ink-750 text-ink-300 hover:text-white flex items-center justify-center transition-colors shrink-0"
            title="Rewind to start"
          >
            <RotateCcw size={14} />
          </button>

          <span className="font-mono text-xs text-ink-300 tabular-nums shrink-0 select-none">
            {formatTimecode(assetCurrentTime, projectFps)} / {formatTimecode(assetDuration, projectFps)}
          </span>

          <input
            type="range"
            min={0}
            max={assetDuration || 1}
            step={0.05}
            value={assetCurrentTime}
            onChange={(e) => handleAssetSeek(parseFloat(e.target.value))}
            className="of-range flex-1 min-w-[80px]"
            aria-label="Seek source media"
          />

          <button
            type="button"
            onClick={() => setAssetMuted(!assetMuted)}
            aria-label={assetMuted ? 'Unmute asset audio' : 'Mute asset audio'}
            className="h-8 w-8 rounded-lg bg-ink-850 hover:bg-ink-800 border border-ink-750 text-ink-300 hover:text-white flex items-center justify-center transition-colors shrink-0"
            title={assetMuted ? 'Unmute' : 'Mute'}
          >
            {assetMuted ? <VolumeX size={15} className="text-red-400" /> : <Volume2 size={15} />}
          </button>
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
