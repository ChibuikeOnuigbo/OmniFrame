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
  BoxSelect,
  CircleDashed,
  LassoSelect,
  Scissors,
  FlipHorizontal,
  Maximize2,
  Minimize2,
  Stamp,
  type LucideIcon,
} from 'lucide-react'

const COLOR_SWATCHES = [
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#10b981', // Green
  '#a855f7', // Purple
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
  const activeSelection = useEditor((s) => s.activeSelection)
  const convertSelectionToMask = useEditor((s) => s.convertSelectionToMask)
  const invertSelection = useEditor((s) => s.invertSelection)
  const growSelection = useEditor((s) => s.growSelection)
  const shrinkSelection = useEditor((s) => s.shrinkSelection)
  const clearSelection = useEditor((s) => s.clearSelection)
  const playhead = useEditor((s) => s.playhead)
  const projectFps = useEditor((s) => s.projectFps)

  if (!drawingEnabled) return null

  const tools: { id: DrawingToolType; label: string; icon: LucideIcon }[] = [
    { id: 'brush', label: 'Brush', icon: Paintbrush },
    { id: 'pencil', label: 'Pencil (Pixel)', icon: Pencil },
    { id: 'marker', label: 'Highlighter', icon: Highlighter },
    { id: 'calligraphy', label: 'Calligraphy Chisel', icon: PenTool },
    { id: 'clone', label: 'Clone Stamp (Alt+Click to set source)', icon: Stamp },
    { id: 'fill', label: 'Fill / Recolor', icon: PaintBucket },
    { id: 'eraser', label: 'Eraser', icon: Eraser },
    { id: 'eyedropper', label: 'Eyedropper Color Picker', icon: Pipette },
    { id: 'line', label: 'Line', icon: Slash },
    { id: 'rectangle', label: 'Rectangle', icon: Square },
    { id: 'circle', label: 'Circle', icon: Circle },
    { id: 'arrow', label: 'Arrow', icon: MoveRight },
    { id: 'star', label: 'Star', icon: Star },
    { id: 'select-rect', label: 'Rectangular Marquee', icon: BoxSelect },
    { id: 'select-ellipse', label: 'Elliptical Marquee', icon: CircleDashed },
    { id: 'select-lasso', label: 'Lasso Selection', icon: LassoSelect },
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
      className="absolute top-12 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink-900/95 border border-ink-700 shadow-2xl backdrop-blur-md text-xs text-ink-200 select-none animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Tool Selector */}
      <div className="flex items-center gap-1 border-r border-ink-700 pr-2">
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
              className={`p-1.5 rounded-md transition-colors ${
                active
                  ? 'bg-brand text-white'
                  : 'hover:bg-ink-800 text-ink-300 hover:text-white'
              }`}
            >
              <Icon size={14} />
            </button>
          )
        })}
      </div>

      {/* Active Selection Actions */}
      {activeSelection && (
        <div className="flex items-center gap-1.5 border-r border-ink-700 pr-2 animate-in fade-in duration-100">
          <span
            data-testid="active-selection-badge"
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            {activeSelection.type.toUpperCase()}
          </span>

          <button
            type="button"
            data-testid="convert-selection-mask-btn"
            title="Convert selection to paint layer mask"
            aria-label="Convert selection to mask"
            onClick={() => convertSelectionToMask()}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand/20 hover:bg-brand/30 text-brand text-[10px] font-medium transition-colors"
          >
            <Scissors size={11} />
            <span>To Mask</span>
          </button>

          <button
            type="button"
            data-testid="invert-selection-btn"
            title="Invert active selection"
            aria-label="Invert selection"
            onClick={() => invertSelection()}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-ink-800 hover:bg-ink-700 text-ink-300 hover:text-white text-[10px] transition-colors"
          >
            <FlipHorizontal size={11} />
            <span>Invert</span>
          </button>

          <button
            type="button"
            data-testid="grow-selection-btn"
            title="Grow / Expand Selection (+10px)"
            aria-label="Grow selection"
            onClick={() => growSelection(10)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-ink-800 hover:bg-ink-700 text-ink-300 hover:text-white text-[10px] transition-colors"
          >
            <Maximize2 size={11} />
            <span>Grow</span>
          </button>

          <button
            type="button"
            data-testid="shrink-selection-btn"
            title="Shrink / Contract Selection (-10px)"
            aria-label="Shrink selection"
            onClick={() => shrinkSelection(10)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-ink-800 hover:bg-ink-700 text-ink-300 hover:text-white text-[10px] transition-colors"
          >
            <Minimize2 size={11} />
            <span>Shrink</span>
          </button>

          <button
            type="button"
            data-testid="clear-selection-btn"
            title="Deselect (Escape)"
            aria-label="Deselect"
            onClick={() => clearSelection()}
            className="p-1 rounded hover:bg-ink-800 text-ink-400 hover:text-white transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Color Swatches */}
      <div className="flex items-center gap-1 border-r border-ink-700 pr-2">
        {COLOR_SWATCHES.map((hex) => (
          <button
            key={hex}
            type="button"
            data-testid={`color-swatch-${hex.replace('#', '')}`}
            title={`Color ${hex}`}
            aria-label={`Color ${hex}`}
            onClick={() => setDrawingColor(hex)}
            className={`w-5 h-5 rounded-full border transition-transform ${
              drawingColor === hex ? 'border-white scale-110 shadow-sm' : 'border-ink-600 hover:scale-105'
            }`}
            style={{ backgroundColor: hex }}
          />
        ))}
        <input
          type="color"
          data-testid="drawing-color-input"
          value={drawingColor}
          onChange={(e) => setDrawingColor(e.target.value)}
          title="Custom Color"
          aria-label="Custom color picker"
          className="w-5 h-5 rounded-full border border-ink-600 cursor-pointer bg-transparent p-0 overflow-hidden"
        />
      </div>

      {/* Dynamic Controls based on tool */}
      {drawingTool === 'fill' ? (
        <div className="flex items-center gap-2 border-r border-ink-700 pr-2">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-ink-400 font-mono">Tol</span>
            <input
              type="range"
              data-testid="drawing-fill-tolerance-slider"
              aria-label="Fill tolerance"
              min={1}
              max={100}
              value={drawingFillTolerance}
              onChange={(e) => setDrawingFillTolerance(Number(e.target.value))}
              className="of-range w-16"
            />
            <span className="text-[10px] text-ink-400 font-mono w-4">{drawingFillTolerance}</span>
          </div>

          <label
            data-testid="drawing-preserve-luminance-toggle"
            className="flex items-center gap-1 cursor-pointer select-none px-1.5 py-0.5 rounded bg-ink-800 hover:bg-ink-750 text-[11px] text-ink-200"
            title="Preserve original luminance and shading (Hair/Cloth recoloring)"
          >
            <input
              type="checkbox"
              checked={drawingPreserveLuminance}
              onChange={(e) => setDrawingPreserveLuminance(e.target.checked)}
              className="accent-brand cursor-pointer w-3.5 h-3.5"
            />
            <Sparkles size={11} className={drawingPreserveLuminance ? 'text-brand' : 'text-ink-400'} />
            <span className={drawingPreserveLuminance ? 'text-brand font-medium' : 'text-ink-400'}>
              Shading
            </span>
          </label>
        </div>
      ) : (
        /* Size Slider */
        <div className="flex items-center gap-1.5 border-r border-ink-700 pr-2">
          <span className="text-[10px] text-ink-400 font-mono">Size</span>
          <input
            type="range"
            data-testid="drawing-size-slider"
            aria-label="Stroke width"
            min={1}
            max={40}
            value={drawingSize}
            onChange={(e) => setDrawingSize(Number(e.target.value))}
            className="of-range w-16"
          />
          <span className="text-[10px] text-ink-400 font-mono w-4">{drawingSize}</span>
        </div>
      )}

      {/* Temporal Scope Selector */}
      <div className="flex items-center gap-1 border-r border-ink-700 pr-2">
        <Clock size={12} className="text-ink-400" />
        <select
          data-testid="drawing-scope-select"
          aria-label="Drawing temporal scope"
          value={drawingScope.type}
          onChange={(e) => handleScopeChange(e.target.value as TemporalScopeType)}
          className="bg-ink-800 text-ink-200 border border-ink-700 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-brand"
        >
          <option value="global">All Frames (Global)</option>
          <option value="span">Span (2s from Playhead)</option>
          <option value="frame">Current Frame Cel</option>
        </select>
      </div>

      {/* Frame Animation / Rotoscoping Controls */}
      {drawingScope.type === 'frame' && (
        <div className="flex items-center gap-1 border-r border-ink-700 pr-2 animate-in fade-in duration-100">
          <button
            type="button"
            data-testid="step-prev-cel-btn"
            title="Step Previous Frame (,)"
            aria-label="Step previous frame"
            onClick={() => stepFrame(-1)}
            className="p-1 rounded hover:bg-ink-800 text-ink-300 hover:text-white"
          >
            <ChevronLeft size={13} />
          </button>
          <span
            data-testid="current-cel-badge"
            className="font-mono text-[10px] font-semibold text-brand px-1 py-0.5 rounded bg-brand/10 border border-brand/30"
          >
            F#{currentFrame}
          </span>
          <button
            type="button"
            data-testid="step-next-cel-btn"
            title="Step Next Frame (.)"
            aria-label="Step next frame"
            onClick={() => stepFrame(1)}
            className="p-1 rounded hover:bg-ink-800 text-ink-300 hover:text-white"
          >
            <ChevronRight size={13} />
          </button>

          {/* Hold Frames */}
          <select
            data-testid="cel-hold-frames-select"
            title="Exposure / Hold Frames"
            aria-label="Cel hold frames"
            value={drawingHoldFrames}
            onChange={(e) => {
              const val = Number(e.target.value)
              setDrawingHoldFrames(val)
              setDrawingScope({ ...drawingScope, holdFrames: val })
            }}
            className="bg-ink-800 text-ink-200 border border-ink-700 rounded px-1 py-0.5 text-[10px] font-mono focus:outline-none focus:border-brand"
          >
            <option value={1}>1f hold</option>
            <option value={2}>2f (twos)</option>
            <option value={3}>3f hold</option>
            <option value={4}>4f hold</option>
          </select>

          {/* Onion Skin Toggle */}
          <button
            type="button"
            data-testid="onion-skin-toggle"
            title={`Onion Skinning: ${onionSkin.enabled ? 'ON (ghosting adjacent cels)' : 'OFF'}`}
            aria-label="Toggle onion skinning"
            aria-pressed={onionSkin.enabled}
            onClick={() => toggleOnionSkin()}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
              onionSkin.enabled
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-ink-800 text-ink-400 hover:text-white'
            }`}
          >
            <Layers size={11} />
            <span>Onion</span>
          </button>
        </div>
      )}

      {/* Clear Strokes */}
      <button
        type="button"
        data-testid="drawing-clear-btn"
        title="Clear Drawing Strokes"
        aria-label="Clear drawing strokes"
        onClick={() => clearDrawingStrokes()}
        className="p-1.5 rounded-md hover:bg-red-500/20 text-ink-400 hover:text-red-400 transition-colors"
      >
        <Trash2 size={14} />
      </button>

      {/* Close Drawing Mode */}
      <button
        type="button"
        data-testid="drawing-exit-btn"
        title="Exit Drawing Mode"
        aria-label="Exit drawing mode"
        onClick={() => setDrawingEnabled(false)}
        className="p-1.5 rounded-md hover:bg-ink-800 text-ink-400 hover:text-white transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  )
}
