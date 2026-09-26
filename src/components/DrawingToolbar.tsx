import { useEditor } from '../store'
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
  type LucideIcon,
} from 'lucide-react'

const QUICK_COLORS = [
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#3b82f6', // Blue
]

export function DrawingToolbar() {
  const drawingEnabled = useEditor((s) => s.drawingEnabled)
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
  ]

  return (
    <div
      data-testid="drawing-toolbar"
      className="absolute z-30 max-sm:bottom-10 max-sm:top-auto sm:top-2 sm:bottom-auto left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1.5 py-1 rounded-xl bg-ink-900/95 border border-ink-700 shadow-xl backdrop-blur-md text-xs text-ink-200 select-none animate-in fade-in zoom-in-95 duration-150 max-w-[calc(100vw-32px)] w-auto overflow-x-auto scrollbar-none"
    >
      {/* Tool Selector */}
      <div className="flex items-center gap-0.5 border-r border-ink-800 pr-1 shrink-0">
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
              className={`p-0.5 h-5.5 w-5.5 rounded flex items-center justify-center transition-colors shrink-0 ${
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
      <div className="flex items-center gap-1 border-r border-ink-800 pr-1 shrink-0">
        {QUICK_COLORS.map((hex) => (
          <button
            key={hex}
            type="button"
            data-testid={`color-swatch-${hex.replace('#', '')}`}
            title={`Color ${hex}`}
            aria-label={`Color ${hex}`}
            onClick={() => setDrawingColor(hex)}
            className={`w-3 h-3 rounded-full border transition-transform ${
              drawingColor === hex
                ? 'scale-110 border-white ring-1 ring-brand'
                : 'border-ink-700 hover:scale-105'
            }`}
            style={{ backgroundColor: hex }}
          />
        ))}
        <input
          type="color"
          data-testid="drawing-color-picker"
          value={drawingColor}
          onChange={(e) => setDrawingColor(e.target.value)}
          title="Color"
          aria-label="Custom color picker"
          className="w-3 h-3 rounded-full border border-ink-600 cursor-pointer bg-transparent p-0 overflow-hidden shrink-0"
        />
      </div>

      {/* Compact Size Slider */}
      <div className="flex items-center gap-0.5 border-r border-ink-800 pr-1 shrink-0">
        <input
          type="range"
          data-testid="drawing-size-slider"
          aria-label="Stroke width"
          min={1}
          max={30}
          value={drawingSize}
          onChange={(e) => setDrawingSize(Number(e.target.value))}
          className="of-range w-8"
        />
        <span className="text-[9px] text-ink-400 font-mono w-2.5 text-right">{drawingSize}</span>
      </div>

      {/* Clear Drawing Strokes */}
      <button
        type="button"
        data-testid="clear-drawing-strokes-btn"
        title="Clear"
        aria-label="Clear drawing strokes"
        onClick={() => clearDrawingStrokes()}
        className="p-0.5 h-5.5 w-5.5 rounded flex items-center justify-center hover:bg-ink-800 text-ink-400 hover:text-red-400 transition-colors shrink-0"
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
        className="p-0.5 h-5.5 w-5.5 rounded flex items-center justify-center hover:bg-ink-800 text-ink-400 hover:text-white transition-colors shrink-0"
      >
        <X size={12} />
      </button>
    </div>
  )
}
