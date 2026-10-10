import { useEditor } from '../store'
import { SlideDock } from './SlideDock'
import type { DrawingToolType, TemporalScopeType } from '../types'
import {
  Paintbrush,
  Pencil,
  Highlighter,
  PenTool,
  Eraser,
  Slash,
  Square,
  Circle,
  MoveRight,
  Star,
  Trash2,
  X,
  PaintBucket,
  Stamp,
  Pentagon,
  Spline,
  Blend,
  Scissors,
  Pipette,
  type LucideIcon,
} from 'lucide-react'

const QUICK_COLORS = [
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#3b82f6', // Blue
]

export function DrawingToolbar() {
  const drawingEnabled = useEditor((s) => s.drawingEnabled)
  const leftOpen = useEditor((s) => s.leftOpen)
  const setDrawingEnabled = useEditor((s) => s.setDrawingEnabled)
  const drawingTool = useEditor((s) => s.drawingTool)
  const setDrawingTool = useEditor((s) => s.setDrawingTool)
  const drawingColor = useEditor((s) => s.drawingColor)
  const setDrawingColor = useEditor((s) => s.setDrawingColor)
  const drawingSize = useEditor((s) => s.drawingSize)
  const setDrawingSize = useEditor((s) => s.setDrawingSize)
  const clearDrawingStrokes = useEditor((s) => s.clearDrawingStrokes)

  if (!drawingEnabled) return null

  // Pure drawing tools with compact single-word labels
  const tools: { id: DrawingToolType; label: string; icon: LucideIcon }[] = [
    { id: 'brush', label: 'Brush', icon: Paintbrush },
    { id: 'pencil', label: 'Pencil', icon: Pencil },
    { id: 'marker', label: 'Marker', icon: Highlighter },
    { id: 'calligraphy', label: 'Chisel', icon: PenTool },
    { id: 'clone', label: 'Stamp', icon: Stamp },
    { id: 'fill', label: 'Fill', icon: PaintBucket },
    { id: 'eraser', label: 'Eraser', icon: Eraser },
    { id: 'line', label: 'Line', icon: Slash },
    { id: 'rectangle', label: 'Box', icon: Square },
    { id: 'circle', label: 'Circle', icon: Circle },
    { id: 'arrow', label: 'Arrow', icon: MoveRight },
    { id: 'star', label: 'Star', icon: Star },
    { id: 'polygon', label: 'Polygon', icon: Pentagon },
    { id: 'polyline', label: 'Polyline', icon: Scissors },
    { id: 'bezier', label: 'Bezier Path', icon: Spline },
    { id: 'gradient', label: 'Gradient', icon: Blend },
    { id: 'eyedropper', label: 'Color Sampler', icon: Pipette },
  ]

  return (
    <SlideDock id="drawing-toolbar" label="drawing tools" direction="down"
      className={`absolute z-30 max-sm:bottom-10 max-sm:top-auto sm:top-12 sm:bottom-auto left-1/2 -translate-x-1/2 ${leftOpen ? 'max-sm:hidden' : ''}`}
    >
    <div
      data-testid="drawing-toolbar"
      className="flex min-w-0 w-full max-w-full flex-wrap items-center justify-center gap-1 rounded-xl border border-ink-700 bg-ink-900/95 px-1.5 py-1 text-xs text-ink-200 shadow-xl backdrop-blur-md select-none animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
    >
      {/* Tool Selector */}
      <div className="flex min-w-0 items-center gap-0.5 border-r border-ink-800 pr-1 shrink-0 max-sm:w-full max-sm:flex-wrap max-sm:justify-center max-sm:border-r-0 max-sm:border-b max-sm:pb-1 max-sm:pr-0">
        {tools.map((t) => {
          const Icon = t.icon
          const active = drawingTool === t.id
          return (
            <button
              key={t.id}
              type="button"
              data-testid={`drawing-tool-${t.id}`}
              title={t.label}
              aria-label={t.label}
              aria-pressed={active}
              onClick={() => setDrawingTool(t.id)}
              className={`flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded p-0.5 transition-colors max-sm:min-h-8 max-sm:min-w-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                active
                  ? 'bg-brand text-white shadow-xs'
                  : 'hover:bg-ink-800 text-ink-400 hover:text-white'
              }`}
            >
              <Icon size={12} />
            </button>
          )
        })}
      </div>

      {/* Compact Quick Color Dots */}
      <div className="flex items-center gap-1 border-r border-ink-800 pr-1 shrink-0 max-sm:border-r-0 max-sm:pr-0">
        {QUICK_COLORS.map((hex) => (
          <button
            key={hex}
            type="button"
            data-testid={`color-swatch-${hex.replace('#', '')}`}
            title={`Color ${hex}`}
            aria-label={`Color ${hex}`}
            onClick={() => setDrawingColor(hex)}
            aria-pressed={drawingColor === hex}
            className="flex min-h-6 min-w-6 items-center justify-center rounded transition-transform max-sm:min-h-8 max-sm:min-w-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <span
              aria-hidden="true"
              className={`h-3 w-3 rounded-full border ${
                drawingColor === hex ? 'scale-110 border-white ring-1 ring-brand' : 'border-ink-700'
              }`}
              style={{ backgroundColor: hex }}
            />
          </button>
        ))}
        <input
          type="color"
          data-testid="drawing-color-picker"
          value={drawingColor}
          onChange={(e) => setDrawingColor(e.target.value)}
          title="Color"
          aria-label="Custom color picker"
          className="h-6 w-6 shrink-0 cursor-pointer rounded-full border border-ink-600 bg-transparent p-1 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand max-sm:min-h-8 max-sm:min-w-8"
        />
      </div>

      {/* Compact Size Slider */}
      <div className="flex items-center gap-1 border-r border-ink-800 pr-1 shrink-0 max-sm:border-r-0 max-sm:pr-0">
        <input
          type="range"
          data-testid="drawing-size-slider"
          aria-label="Stroke width"
          min={1}
          max={30}
          value={drawingSize}
          onChange={(e) => setDrawingSize(Number(e.target.value))}
          className="of-range w-8 max-sm:w-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        />
        <span className="w-3 text-right font-mono text-[10px] text-ink-300">{drawingSize}</span>
      </div>

      {/* Clear Drawing Strokes */}
      <button
        type="button"
        data-testid="clear-drawing-strokes-btn"
        title="Clear"
        aria-label="Clear drawing strokes"
        onClick={() => clearDrawingStrokes()}
        className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded p-0.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-red-400 max-sm:min-h-8 max-sm:min-w-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Trash2 size={12} />
      </button>

      {/* Done / Close Drawing */}
      <button
        type="button"
        data-testid="close-drawing-mode-btn"
        title="Close"
        aria-label="Close drawing mode"
        onClick={() => setDrawingEnabled(false)}
        className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded p-0.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-white max-sm:min-h-8 max-sm:min-w-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <X size={12} />
      </button>
    </div>
    </SlideDock>
  )
}
