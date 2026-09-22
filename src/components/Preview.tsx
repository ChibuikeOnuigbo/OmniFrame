import { useEffect, useMemo, useRef, useState } from 'react'
import { Maximize2, Scan, Grid3x3 } from 'lucide-react'
import { PreviewEngine } from '../lib/playback'
import { useEditor } from '../store'
import { IconButton } from './ui'

const CANVAS_W = 1280
const CANVAS_H = 720
const VIEW_PADDING = 16
const PREVIEW_DIMENSIONS = {
  low: { width: 640, height: 360 },
  medium: { width: 960, height: 540 },
  high: { width: 1280, height: 720 },
  ultra: { width: 1920, height: 1080 },
} as const

type Point = { x: number; y: number }

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<PreviewEngine | null>(null)
  const dragRef = useRef<{ pointerId: number; origin: Point; pan: Point } | null>(null)
  const clipCount = useEditor((s) => s.clips.length)
  const playing = useEditor((s) => s.playing)
  const previewQuality = useEditor((s) => s.previewQuality)
  const previewDimensions = PREVIEW_DIMENSIONS[previewQuality]
  const [display, setDisplay] = useState<'fit' | number>('fit')
  const [safe, setSafe] = useState(false)
  const [grid, setGrid] = useState(false)
  const [viewport, setViewport] = useState({ width: 1, height: 1 })
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })

  useEffect(() => {
    if (!canvasRef.current) return
    const engine = new PreviewEngine(canvasRef.current, previewDimensions.width, previewDimensions.height)
    engineRef.current = engine
    engine.start()
    return () => engine.dispose()
  }, [previewDimensions.width, previewDimensions.height])

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
      (viewport.width - VIEW_PADDING * 2) / CANVAS_W,
      (viewport.height - VIEW_PADDING * 2) / CANVAS_H,
    ),
  )
  const scale = display === 'fit' ? fitScale : display
  const canPan = display !== 'fit' &&
    (CANVAS_W * scale > viewport.width || CANVAS_H * scale > viewport.height)

  const clampPan = (next: Point): Point => {
    const maxX = Math.max(0, (CANVAS_W * scale - viewport.width) / 2)
    const maxY = Math.max(0, (CANVAS_H * scale - viewport.height) / 2)
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    }
  }

  useEffect(() => {
    setPan((current) => display === 'fit' ? { x: 0, y: 0 } : clampPan(current))
    // clampPan intentionally follows the current measured viewport and scale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display, viewport.width, viewport.height, scale])

  const stageStyle = useMemo<React.CSSProperties>(() => ({
    width: CANVAS_W,
    height: CANVAS_H,
    left: '50%',
    top: '50%',
    transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
    transformOrigin: 'center',
    willChange: 'transform',
  }), [pan.x, pan.y, scale])

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
      data-preview-width={previewDimensions.width}
      data-preview-height={previewDimensions.height}
      data-preview-pan-x={pan.x.toFixed(2)}
      data-preview-pan-y={pan.y.toFixed(2)}
      className="flex-1 min-h-0 min-w-0 relative bg-ink-950 overflow-hidden"
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button, input')) return
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
      <div className="absolute top-2 left-3 z-20 flex items-center gap-2 text-[11px] text-ink-400">
        <span className="px-2 py-0.5 rounded bg-ink-900/70 border border-ink-800">Preview · {previewDimensions.width}×{previewDimensions.height} · {previewQuality}</span>
        {playing && <span className="px-2 py-0.5 rounded bg-brand/20 text-brand border border-brand/40">LIVE</span>}
      </div>

      <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
        <IconButton title="Safe areas" active={safe} onClick={() => setSafe((v) => !v)}><Scan size={15} /></IconButton>
        <IconButton title="Grid" active={grid} onClick={() => setGrid((v) => !v)}><Grid3x3 size={15} /></IconButton>
        <div className="ml-1 flex h-8 items-stretch overflow-hidden rounded-md border border-ink-700 bg-ink-800">
          <button type="button" title="Auto fit preview" aria-label="Auto fit preview" aria-pressed={display === 'fit'} onClick={() => chooseDisplay('fit')} className={`grid w-9 place-items-center border-r border-ink-700 ${display === 'fit' ? 'bg-brand text-white' : 'text-ink-400 hover:bg-ink-700 hover:text-white'}`}><Maximize2 size={14} /></button>
          <div className="relative flex items-center px-2"><input data-testid="preview-zoom-slider" aria-label="Preview zoom" type="range" min={25} max={200} step={5} value={Math.max(25, Math.min(200, Math.round(scale * 100)))} onChange={(e) => chooseDisplay(Number(e.target.value) / 100)} className="of-range w-24 sm:w-28" /><i aria-hidden="true" title="Auto-fit point" className="pointer-events-none absolute top-1/2 h-3 w-px -translate-y-1/2 bg-white/60" style={{ left: `${8 + Math.max(0, Math.min(1, (fitScale * 100 - 25) / 175)) * 100}%` }} /></div>
          <output className="flex w-11 items-center justify-end border-l border-ink-700 pr-2 text-[10px] tabular-nums text-ink-400">{Math.round(scale * 100)}%</output>
        </div>
      </div>

      <div
        data-testid="preview-stage"
        className={`absolute ${canPan ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={stageStyle}
      >
        <canvas id="of-canvas" ref={canvasRef} className="block w-full h-full bg-black shadow-2xl rounded-sm" />
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
            <div className="text-xs mt-1">Import video, image or audio from the Media panel or drag a file in.</div>
          </div>
        </div>
      )}
    </div>
  )
}
