import { useEffect, useRef, useState } from 'react'
import { Maximize2, Scan, Grid3x3 } from 'lucide-react'
import { PreviewEngine } from '../lib/playback'
import { useEditor } from '../store'
import { IconButton, Segmented } from './ui'

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<PreviewEngine | null>(null)
  const clipCount = useEditor((s) => s.clips.length)
  const playing = useEditor((s) => s.playing)
  const [display, setDisplay] = useState<'fit' | number>('fit')
  const [safe, setSafe] = useState(false)
  const [grid, setGrid] = useState(false)

  useEffect(() => {
    if (!canvasRef.current) return
    const engine = new PreviewEngine(canvasRef.current)
    engineRef.current = engine
    engine.start()
    return () => engine.dispose()
  }, [])

  // fit = scale to viewport; numbers = actual zoom (canvas can exceed the
  // viewport and the container scrolls so edges stay reachable).
  const canvasStyle: React.CSSProperties =
    display === 'fit'
      ? { maxWidth: '100%', maxHeight: '100%', aspectRatio: '16 / 9' }
      : { width: `${1280 * (display as number)}px`, height: `${720 * (display as number)}px` }

  return (
    <div className="flex-1 min-h-0 relative bg-ink-950 overflow-auto">
      <div className="absolute top-2 left-3 z-10 flex items-center gap-2 text-[11px] text-ink-400">
        <span className="px-2 py-0.5 rounded bg-ink-900/70 border border-ink-800">Preview · 1920×1080</span>
        {playing && (
          <span className="px-2 py-0.5 rounded bg-brand/20 text-brand border border-brand/40">LIVE</span>
        )}
      </div>

      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        <IconButton title="Safe areas" active={safe} onClick={() => setSafe((v) => !v)}>
          <Scan size={15} />
        </IconButton>
        <IconButton title="Grid" active={grid} onClick={() => setGrid((v) => !v)}>
          <Grid3x3 size={15} />
        </IconButton>
        <div className="ml-1">
          <Segmented
            options={[
              { value: 'fit', label: <Maximize2 size={13} /> },
              { value: 0.5, label: '50%' },
              { value: 1, label: '100%' },
              { value: 2, label: '200%' },
            ]}
            value={display}
            onChange={(v) => setDisplay(v as 'fit' | number)}
          />
        </div>
      </div>

      <div className="min-w-full min-h-full flex items-center justify-center p-4">
        <div className="relative" style={{ lineHeight: 0 }}>
          <canvas
            id="of-canvas"
            ref={canvasRef}
            className="block bg-black shadow-2xl rounded-sm"
            style={canvasStyle}
          />
          {safe && (
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-[5%] border border-dashed border-white/40" />
              <div className="absolute inset-[10%] border border-dashed border-white/20" />
            </div>
          )}
          {grid && (
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.15]"
              style={{
                backgroundImage:
                  'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
                backgroundSize: '10% 10%',
              }}
            />
          )}
        </div>
      </div>

      {clipCount === 0 && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center text-ink-500">
            <div className="text-sm font-medium text-ink-400">Your canvas is empty</div>
            <div className="text-xs mt-1">
              Import video, image or audio from the Media panel or drag a file in.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
