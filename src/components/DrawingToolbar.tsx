import { useEffect, useState } from 'react'
import { useEditor } from '../store'
import { SlideDock } from './SlideDock'
import { Tooltip } from './Tooltip'
import type { DrawingToolType } from '../types'
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
  Sparkles,
  Pentagon,
  Spline,
  Blend,
  Scissors,
  Pipette,
  Fingerprint,
  SquareDashed,
  CircleDashed,
  Lasso,
  Hexagon,
  Wand2,
  Type as TypeIcon,
  type LucideIcon,
} from 'lucide-react'

const QUICK_COLORS = [
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#3b82f6', // Blue
]

/** Krita-style toolbox grouping (docs.krita.org reference_manual/tools): a short
 *  primary row of group tiles (≤ 9, UI law) and a scrollable icon sub-mode row
 *  with the group's tools — shapes/paths/fills live INSIDE their group instead
 *  of one long wrapped flat row. */
const TOOL_DEFS: Record<DrawingToolType, { label: string; icon: LucideIcon }> = {
  brush: { label: 'Brush', icon: Paintbrush },
  pencil: { label: 'Pencil', icon: Pencil },
  marker: { label: 'Marker', icon: Highlighter },
  calligraphy: { label: 'Chisel', icon: PenTool },
  clone: { label: 'Stamp', icon: Stamp },
  'smart-patch': { label: 'Smart Patch', icon: Sparkles },
  fill: { label: 'Fill', icon: PaintBucket },
  eraser: { label: 'Eraser', icon: Eraser },
  line: { label: 'Line', icon: Slash },
  rectangle: { label: 'Box', icon: Square },
  circle: { label: 'Circle', icon: Circle },
  arrow: { label: 'Arrow', icon: MoveRight },
  star: { label: 'Star', icon: Star },
  polygon: { label: 'Polygon', icon: Pentagon },
  polyline: { label: 'Polyline', icon: Scissors },
  bezier: { label: 'Bezier Path', icon: Spline },
  gradient: { label: 'Gradient', icon: Blend },
  eyedropper: { label: 'Color Sampler', icon: Pipette },
  smudge: { label: 'Smudge', icon: Fingerprint },
  'select-rect': { label: 'Select Box', icon: SquareDashed },
  'select-ellipse': { label: 'Select Ellipse', icon: CircleDashed },
  'select-lasso': { label: 'Select Lasso', icon: Lasso },
  'select-polygon': { label: 'Select Polygon', icon: Hexagon },
  'select-brush': { label: 'Select Brush', icon: Paintbrush },
  'select-magic-wand': { label: 'Magic Wand', icon: Wand2 },
  'select-character': { label: 'Select Character', icon: TypeIcon },
}

const GROUPS: { id: string; label: string; icon: LucideIcon; tools: DrawingToolType[] }[] = [
  { id: 'brushes', label: 'Brushes', icon: Paintbrush, tools: ['brush', 'pencil', 'marker', 'calligraphy', 'smudge'] },
  { id: 'shapes', label: 'Shapes', icon: Square, tools: ['rectangle', 'circle', 'star', 'polygon', 'arrow'] },
  { id: 'paths', label: 'Paths', icon: Spline, tools: ['line', 'polyline', 'bezier'] },
  { id: 'fills', label: 'Fills', icon: PaintBucket, tools: ['fill', 'gradient', 'eyedropper'] },
  { id: 'repair', label: 'Repair', icon: Sparkles, tools: ['clone', 'smart-patch'] },
  { id: 'erase', label: 'Erase', icon: Eraser, tools: ['eraser'] },
  { id: 'select', label: 'Select', icon: SquareDashed, tools: ['select-rect', 'select-ellipse', 'select-lasso', 'select-polygon', 'select-brush', 'select-magic-wand', 'select-character'] },
]

const groupOfTool = (t: DrawingToolType) => GROUPS.find((g) => g.tools.includes(t))?.id ?? 'brushes'

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

  const [openGroup, setOpenGroup] = useState<string>(groupOfTool(drawingTool))
  useEffect(() => setOpenGroup(groupOfTool(drawingTool)), [drawingTool])

  if (!drawingEnabled) return null

  const group = GROUPS.find((g) => g.id === openGroup) ?? GROUPS[0]

  const pickGroup = (gid: string, tools: DrawingToolType[]) => {
    setOpenGroup(gid)
    if (!tools.includes(drawingTool)) setDrawingTool(tools[0])
  }

  return (
    <SlideDock id="drawing-toolbar" label="drawing tools" direction="down"
      className={`absolute z-30 max-sm:bottom-10 max-sm:top-auto sm:top-12 sm:bottom-auto left-1/2 -translate-x-1/2 ${leftOpen ? 'max-sm:hidden' : ''}`}
    >
    <div
      data-testid="drawing-toolbar"
      className="flex min-w-0 w-full max-w-full flex-col items-stretch gap-1 rounded-xl border border-ink-700 bg-ink-900 px-1.5 py-1.5 text-xs text-ink-200 shadow-md select-none animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
    >
      {/* Row 1: primary group tiles (≤ 9) + colour + size + clear + close */}
      <div className="flex min-w-0 items-center gap-1">
        <div
          data-testid="drawing-group-row"
          className="flex min-w-0 items-center gap-0.5 overflow-x-auto border-r border-ink-800 pr-1 shrink-0"
        >
          {GROUPS.map((g) => {
            const Icon = g.icon
            const active = g.id === openGroup
            return (
              <Tooltip label={g.label}><button
                key={g.id}
                type="button"
                data-testid={`drawing-group-${g.id}`}
                aria-label={g.label}
                aria-pressed={active}
                onClick={() => pickGroup(g.id, g.tools)}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded p-0.5 transition-colors max-sm:min-h-8 max-sm:min-w-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  active
                    ? 'bg-ink-700 text-white shadow-xs'
                    : 'hover:bg-ink-800 text-ink-400 hover:text-white'
                }`}
              >
                <Icon size={13} />
              </button></Tooltip>
            )
          })}
        </div>

        <div className="flex items-center gap-1 border-r border-ink-800 pr-1 shrink-0">
          {QUICK_COLORS.map((hex) => (
            <Tooltip label={`Color ${hex}`}><button
              key={hex}
              type="button"
              data-testid={`color-swatch-${hex.replace('#', '')}`}
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
            </button></Tooltip>
          ))}
          <Tooltip label="Custom color"><input
            type="color"
            data-testid="drawing-color-picker"
            value={drawingColor}
            onChange={(e) => setDrawingColor(e.target.value)}
            aria-label="Custom color picker"
            className="h-6 w-6 shrink-0 cursor-pointer rounded-full border border-ink-600 bg-transparent p-1 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand max-sm:min-h-8 max-sm:min-w-8"
          /></Tooltip>
        </div>

        <div className="flex items-center gap-1 border-r border-ink-800 pr-1 shrink-0">
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

        <Tooltip label="Clear strokes"><button
          type="button"
          data-testid="clear-drawing-strokes-btn"
          aria-label="Clear drawing strokes"
          onClick={() => clearDrawingStrokes()}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded p-0.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-red-400 max-sm:min-h-8 max-sm:min-w-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Trash2 size={13} />
        </button></Tooltip>

        <Tooltip label="Close drawing mode"><button
          type="button"
          data-testid="close-drawing-mode-btn"
          aria-label="Close drawing mode"
          onClick={() => setDrawingEnabled(false)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded p-0.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-white max-sm:min-h-8 max-sm:min-w-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <X size={13} />
        </button></Tooltip>
      </div>

      {/* Row 2: icon sub-mode tiles for the open group (inner scroll, never wraps) */}
      <div
        data-testid={`drawing-subtools-${group.id}`}
        className="flex min-w-0 items-center gap-0.5 overflow-x-auto border-t border-ink-800 pt-1"
      >
        {group.tools.map((id) => {
          const def = TOOL_DEFS[id]
          const Icon = def.icon
          const active = drawingTool === id
          return (
            <Tooltip label={def.label}><button
              key={id}
              type="button"
              data-testid={`drawing-tool-${id}`}
              aria-label={def.label}
              aria-pressed={active}
              onClick={() => setDrawingTool(id)}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded p-0.5 transition-colors max-sm:min-h-8 max-sm:min-w-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                active
                  ? 'bg-brand text-white shadow-xs'
                  : 'hover:bg-ink-800 text-ink-400 hover:text-white'
              }`}
            >
              <Icon size={13} />
            </button></Tooltip>
          )
        })}
      </div>
    </div>
    </SlideDock>
  )
}
