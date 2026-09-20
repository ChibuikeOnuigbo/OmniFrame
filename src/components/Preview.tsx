import { useEffect, useMemo, useRef, useState } from 'react'
import { Maximize2, Scan, Grid3x3 } from 'lucide-react'
import { PreviewEngine } from '../lib/playback'
import { useEditor } from '../store'
import { IconButton, Segmented } from './ui'

const CANVAS_W = 1280
const CANVAS_H = 720
const VIEW_PADDING = 16

type Point = { x: number; y: number }

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<PreviewEngine | null>(null)
  const dragRef = useRef<{ pointerId: number; origin: Point; pan: Point } | null>(null)
  const clipCount = useEditor((s) => s.clips.length)
  const playing = useEditor((s) => s.playing)
  const [display, setDisplay] = useState<'fit' | number>('fit')
  const [safe, setSafe] = useState(false)
  const [grid, setGrid] = useState(false)
  const [viewport, setViewport] = useState({ width: 1, height: 1 })
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })

  useEffect(() => {
    if (!canvasRef.current) return
    const engine = new PreviewEngine(canvasRef.current)
    engineRef.current = engine
    engine.start()
    return () => engine.dispose()
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
        <span className="px-2 py-0.5 rounded bg-ink-900/70 border border-ink-800">Preview · 1920×1080</span>
        {playing && <span className="px-2 py-0.5 rounded bg-brand/20 text-brand border border-brand/40">LIVE</span>}
      </div>

      <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
        <IconButton title="Safe areas" active={safe} onClick={() => setSafe((v) => !v)}><Scan size={15} /></IconButton>
        <IconButton title="Grid" active={grid} onClick={() => setGrid((v) => !v)}><Grid3x3 size={15} /></IconButton>
        <div className="ml-1">
          <Segmented
            options={[
              { value: 'fit', label: <Maximize2 size={13} />, title: 'Fit preview' },
              { value: 0.5, label: '50%' },
              { value: 1, label: '100%' },
              { value: 2, label: '200%' },
            ]}
            value={display}
            onChange={(v) => chooseDisplay(v as 'fit' | number)}
          />
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
