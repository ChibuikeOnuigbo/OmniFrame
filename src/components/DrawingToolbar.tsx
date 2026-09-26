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
  Pipette,
  Trash2,
  X,
  Clock,
  PaintBucket,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  Stamp,
  type LucideIcon,
} from 'lucide-react'

const COLOR_SWATCHES = [
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#10b981', // Green
  '#ffffff', // White
  '#000000', // Black
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
  const drawingFillTolerance = useEditor((s) => s.drawingFillTolerance)
  const setDrawingFillTolerance = useEditor((s) => s.setDrawingFillTolerance)
  const drawingPreserveLuminance = useEditor((s) => s.drawingPreserveLuminance)
  const setDrawingPreserveLuminance = useEditor((s) => s.setDrawingPreserveLuminance)
  const drawingScope = useEditor((s) => s.drawingScope)
  const setDrawingScope = useEditor((s) => s.setDrawingScope)
  const drawingHoldFrames = useEditor((s) => s.drawingHoldFrames)
  const setDrawingHoldFrames = useEditor((s) => s.setDrawingHoldFrames)
  const onionSkin = useEditor((s) => s.onionSkin)
  const toggleOnionSkin = useEditor((s) => s.toggleOnionSkin)
  const stepFrame = useEditor((s) => s.stepFrame)
  const clearDrawingStrokes = useEditor((s) => s.clearDrawingStrokes)
  const playhead = useEditor((s) => s.playhead)
  const projectFps = useEditor((s) => s.projectFps)

  if (!drawingEnabled) return null

  // Pure drawing tools with short, concise tooltips that never exceed phone width
  const tools: { id: DrawingToolType; label: string; icon: LucideIcon }[] = [
    { id: 'brush', label: 'Brush', icon: Paintbrush },
    { id: 'pencil', label: 'Pencil', icon: Pencil },
    { id: 'marker', label: 'Marker', icon: Highlighter },
    { id: 'calligraphy', label: 'Chisel', icon: PenTool },
    { id: 'clone', label: 'Stamp', icon: Stamp },
    { id: 'fill', label: 'Fill', icon: PaintBucket },
    { id: 'eraser', label: 'Eraser', icon: Eraser },
    { id: 'eyedropper', label: 'Picker', icon: Pipette },
    { id: 'line', label: 'Line', icon: Slash },
    { id: 'rectangle', label: 'Box', icon: Square },
    { id: 'circle', label: 'Circle', icon: Circle },
    { id: 'arrow', label: 'Arrow', icon: MoveRight },
    { id: 'star', label: 'Star', icon: Star },
  ]

  const handleScopeChange = (type: TemporalScopeType) => {
    if (type === 'global') {
      setDrawingScope({ type: 'global' })
    } else if (type === 'span') {
      setDrawingScope({ type: 'span', startTime: playhead, duration: 2.0 })
    } else if (type === 'frame') {
      const currentFrame = Math.round(playhead * projectFps)
      setDrawingScope({ type: 'frame', frame: currentFrame, holdFrames: drawingHoldFrames })
    }
  }

  const currentFrame = Math.round(playhead * projectFps)

  return (
    <div
      data-testid="drawing-toolbar"
      className="absolute top-12 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-ink-900/95 border border-ink-700 shadow-2xl backdrop-blur-md text-xs text-ink-200 select-none animate-in fade-in zoom-in-95 duration-150 max-w-[calc(100vw-16px)] overflow-x-auto scrollbar-none"
    >
      {/* Tool Selector */}
      <div className="flex items-center gap-0.5 border-r border-ink-700 pr-1.5 shrink-0">
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
              className={`p-1.5 rounded-md transition-colors shrink-0 ${
                active
                  ? 'bg-brand text-white shadow-xs'
                  : 'hover:bg-ink-800 text-ink-300 hover:text-white'
              }`}
            >
              <Icon size={14} />
            </button>
          )
        })}
      </div>

      {/* Color Swatches */}
      <div className="flex items-center gap-1 border-r border-ink-700 pr-1.5 shrink-0">
        {COLOR_SWATCHES.map((hex) => (
          <button
            key={hex}
            type="button"
            data-testid={`color-swatch-${hex.replace('#', '')}`}
            title={`Color ${hex}`}
            aria-label={`Color ${hex}`}
            onClick={() => setDrawingColor(hex)}
            className={`w-4 h-4 rounded-full border transition-transform ${
              drawingColor === hex
                ? 'scale-110 border-white ring-2 ring-brand/50'
                : 'border-ink-600 hover:scale-105'
            }`}
            style={{ backgroundColor: hex }}
          />
        ))}
        <input
          type="color"
          data-testid="drawing-color-picker"
          value={drawingColor}
          onChange={(e) => setDrawingColor(e.target.value)}
          title="Custom Color"
          aria-label="Custom color picker"
          className="w-4 h-4 rounded-full border border-ink-600 cursor-pointer bg-transparent p-0 overflow-hidden shrink-0"
        />
      </div>

      {/* Dynamic Controls based on tool */}
      {drawingTool === 'fill' ? (
        <div className="flex items-center gap-1.5 border-r border-ink-700 pr-1.5 shrink-0">
          <span className="text-[10px] text-ink-400 font-mono">Tol</span>
          <input
            type="range"
            data-testid="drawing-fill-tolerance-slider"
            aria-label="Fill tolerance"
            min={1}
            max={100}
            value={drawingFillTolerance}
            onChange={(e) => setDrawingFillTolerance(Number(e.target.value))}
            className="of-range w-14 max-sm:w-10"
          />
          <label
            data-testid="drawing-preserve-luminance-toggle"
            className="flex items-center gap-1 cursor-pointer select-none px-1 py-0.5 rounded bg-ink-800 hover:bg-ink-750 text-[10px] text-ink-200"
            title="Preserve shading"
          >
            <input
              type="checkbox"
              checked={drawingPreserveLuminance}
              onChange={(e) => setDrawingPreserveLuminance(e.target.checked)}
              className="accent-brand cursor-pointer w-3 h-3"
            />
            <span className={drawingPreserveLuminance ? 'text-brand font-medium' : 'text-ink-400'}>
              Shade
            </span>
          </label>
        </div>
      ) : (
        /* Size Slider */
        <div className="flex items-center gap-1 border-r border-ink-700 pr-1.5 shrink-0">
          <span className="text-[10px] text-ink-400 font-mono">Size</span>
          <input
            type="range"
            data-testid="drawing-size-slider"
            aria-label="Stroke width"
            min={1}
            max={40}
            value={drawingSize}
            onChange={(e) => setDrawingSize(Number(e.target.value))}
            className="of-range w-14 max-sm:w-10"
          />
          <span className="text-[10px] text-ink-400 font-mono w-3.5">{drawingSize}</span>
        </div>
      )}

      {/* Temporal Scope Selector */}
      <div className="flex items-center gap-1 border-r border-ink-700 pr-1.5 shrink-0">
        <Clock size={12} className="text-ink-400" />
        <select
          data-testid="drawing-scope-select"
          aria-label="Drawing temporal scope"
          value={drawingScope.type}
          onChange={(e) => handleScopeChange(e.target.value as TemporalScopeType)}
          className="bg-ink-800 text-ink-200 border border-ink-700 rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:border-brand"
        >
          <option value="global">All Frames</option>
          <option value="span">Span (2s)</option>
          <option value="frame">Current Cel</option>
        </select>
      </div>

      {/* Frame Cel Animation Controls */}
      {drawingScope.type === 'frame' && (
        <div className="flex items-center gap-1 border-r border-ink-700 pr-1.5 shrink-0 animate-in fade-in duration-100">
          <button
            type="button"
            data-testid="step-prev-cel-btn"
            title="Step Previous Frame"
            aria-label="Step previous frame"
            onClick={() => stepFrame(-1)}
            className="p-1 rounded hover:bg-ink-800 text-ink-300 hover:text-white"
          >
            <ChevronLeft size={13} />
          </button>
          <span
            data-testid="current-cel-badge"
            className="font-mono text-[9px] font-semibold text-brand px-1 py-0.2 rounded bg-brand/10 border border-brand/30"
          >
            F#{currentFrame}
          </span>
          <button
            type="button"
            data-testid="step-next-cel-btn"
            title="Step Next Frame"
            aria-label="Step next frame"
            onClick={() => stepFrame(1)}
            className="p-1 rounded hover:bg-ink-800 text-ink-300 hover:text-white"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}

      {/* Onion Skinning Toggle */}
      <button
        type="button"
        data-testid="onion-skin-toggle-btn"
        title="Onion Skinning"
        aria-label="Toggle onion skinning"
        onClick={() => toggleOnionSkin()}
        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors shrink-0 ${
          onionSkin.enabled
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            : 'hover:bg-ink-800 text-ink-400 hover:text-white'
        }`}
      >
        Onion
      </button>

      {/* Clear Strokes Action */}
      <button
        type="button"
        data-testid="clear-drawing-strokes-btn"
        title="Clear Drawing"
        aria-label="Clear drawing strokes"
        onClick={() => clearDrawingStrokes()}
        className="p-1 rounded hover:bg-ink-800 text-ink-400 hover:text-red-400 transition-colors shrink-0"
      >
        <Trash2 size={13} />
      </button>

      {/* Close Drawing Mode */}
      <button
        type="button"
        data-testid="close-drawing-mode-btn"
        title="Close Drawing"
        aria-label="Close drawing mode"
        onClick={() => setDrawingEnabled(false)}
        className="p-1 rounded hover:bg-ink-800 text-ink-400 hover:text-white transition-colors shrink-0"
      >
        <X size={13} />
      </button>
    </div>
  )
}
