import { useEffect, useMemo, useRef, useState } from 'react'
import { Maximize2, Scan, Grid3x3, Paintbrush, MonitorPlay, Film } from 'lucide-react'
import { PreviewEngine } from '../lib/playback'
import { useEditor } from '../store'
import { IconButton } from './ui'
import { DrawingToolbar } from './DrawingToolbar'
import { DrawingCanvasOverlay } from './DrawingCanvasOverlay'
import { AspectRatioSelector } from './AspectRatioSelector'
import { SourceMonitor } from './SourceMonitor'

const VIEW_PADDING = 16

type Point = { x: number; y: number }

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<PreviewEngine | null>(null)
  const dragRef = useRef<{ pointerId: number; origin: Point; pan: Point } | null>(null)

  const clipCount = useEditor((s) => s.clips.length)
  const playing = useEditor((s) => s.playing)
  const previewQuality = useEditor((s) => s.previewQuality)
  const monitorMode = useEditor((s) => s.monitorMode)
  const setMonitorMode = useEditor((s) => s.setMonitorMode)
  const sequenceSettings = useEditor((s) => s.sequenceSettings)
  const drawingEnabled = useEditor((s) => s.drawingEnabled)
  const toggleDrawingEnabled = useEditor((s) => s.toggleDrawingEnabled)

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

  // Initialize or resize preview engine
  useEffect(() => {
    if (monitorMode !== 'program') return
    if (!canvasRef.current) return

    if (!engineRef.current) {
      const engine = new PreviewEngine(canvasRef.current, canvasW, canvasH)
      engineRef.current = engine
      engine.start()
    } else {
      engineRef.current.resize(canvasW, canvasH)
    }
  }, [canvasW, canvasH, monitorMode])

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
      className="flex-1 min-h-0 min-w-0 relative bg-ink-950 overflow-hidden"
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button, input, [role="dialog"], [role="tooltip"]')) return
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
      {/* Top Left: Monitor Mode Switcher (Source vs Program) */}
      <div className="absolute top-2 left-3 z-30 flex items-center gap-1.5 text-xs select-none">
        <div className="flex items-center rounded-lg bg-ink-900/90 border border-ink-700/80 p-0.5 shadow-lg backdrop-blur-md">
          <button
            type="button"
            data-testid="monitor-mode-program-btn"
            title="Program Monitor (Timeline Sequence)"
            onClick={() => setMonitorMode('program')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              monitorMode === 'program' ? 'bg-brand text-white shadow-sm' : 'text-ink-400 hover:text-white'
            }`}
          >
            <MonitorPlay size={13} />
            <span>Program</span>
          </button>
          <button
            type="button"
            data-testid="monitor-mode-source-btn"
            title="Source Monitor (Media Asset Preview)"
            onClick={() => setMonitorMode('source')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              monitorMode === 'source' ? 'bg-brand text-white shadow-sm' : 'text-ink-400 hover:text-white'
            }`}
          >
            <Film size={13} />
            <span>Source</span>
          </button>
        </div>

        {playing && (
          <span className="px-2 py-0.5 rounded-full bg-brand/20 text-brand text-[10px] font-bold border border-brand/40 shadow-sm animate-pulse">
            LIVE
          </span>
        )}
      </div>

      {/* Top Right: View Controls */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
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
        <div className="ml-1 flex h-8 items-stretch overflow-hidden rounded-md border border-ink-700 bg-ink-800">
          <button type="button" title="Auto fit preview" aria-label="Auto fit preview" aria-pressed={display === 'fit'} onClick={() => chooseDisplay('fit')} className={`grid w-9 place-items-center border-r border-ink-700 ${display === 'fit' ? 'bg-brand text-white' : 'text-ink-400 hover:bg-ink-700 hover:text-white'}`}><Maximize2 size={14} /></button>
          <div className="relative flex items-center px-2"><input data-testid="preview-zoom-slider" aria-label="Preview zoom" type="range" min={25} max={200} step={5} value={Math.max(25, Math.min(200, Math.round(scale * 100)))} onChange={(e) => chooseDisplay(Number(e.target.value) / 100)} className="of-range w-24 sm:w-28" /><i aria-hidden="true" title="Auto-fit point" className="pointer-events-none absolute top-1/2 h-3 w-px -translate-y-1/2 bg-white/60" style={{ left: `${8 + Math.max(0, Math.min(1, (fitScale * 100 - 25) / 175)) * 100}%` }} /></div>
          <output className="flex w-11 items-center justify-end border-l border-ink-700 pr-2 text-[10px] tabular-nums text-ink-400">{Math.round(scale * 100)}%</output>
        </div>
      </div>

      <DrawingToolbar />

      {/* Source Monitor View when in source mode */}
      {monitorMode === 'source' && (
        <div className="absolute inset-0 z-10 bg-ink-950 flex flex-col pt-12">
          <SourceMonitor />
        </div>
      )}

      {/* Canvas Viewport Stage (Program Monitor) */}
      <div
        data-testid="preview-stage"
        className={`absolute ${canPan ? 'cursor-grab active:cursor-grabbing' : ''} ${monitorMode === 'source' ? 'opacity-0 pointer-events-none' : ''}`}
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

      {clipCount === 0 && (
        <div className="absolute inset-0 z-10 grid place-items-center pointer-events-none">
          <div className="text-center text-ink-500">
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
