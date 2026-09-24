import { useEditor } from '../store'
import type { DrawingToolType, TemporalScopeType } from '../types'
import {
  Paintbrush,
  Eraser,
  Slash,
  Square,
  Circle,
  MoveRight,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  Clock,
  Palette,
  PaintBucket,
  Sliders,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

const COLOR_SWATCHES = [
  '#f59e0b',
  '#ef4444',
  '#3b82f6',
  '#10b981',
  '#a855f7',
  '#ffffff',
  '#000000',
]

const BLEND_MODES: { label: string; value: GlobalCompositeOperation }[] = [
  { label: 'Normal', value: 'source-over' },
  { label: 'Multiply (Darken / Shadow)', value: 'multiply' },
  { label: 'Screen (Brighten / Glow)', value: 'screen' },
  { label: 'Overlay (Vibrant Tone)', value: 'overlay' },
  { label: 'Color (Recolor / Hair Shading)', value: 'color' },
  { label: 'Darken', value: 'darken' },
  { label: 'Lighten', value: 'lighten' },
]

export function DrawingPanel() {
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
  const paintLayers = useEditor((s) => s.paintLayers)
  const activePaintLayerId = useEditor((s) => s.activePaintLayerId)
  const createPaintLayer = useEditor((s) => s.createPaintLayer)
  const togglePaintLayerVisibility = useEditor((s) => s.togglePaintLayerVisibility)
  const setPaintLayerBlendMode = useEditor((s) => s.setPaintLayerBlendMode)
  const setPaintLayerBlur = useEditor((s) => s.setPaintLayerBlur)
  const setPaintLayerOpacity = useEditor((s) => s.setPaintLayerOpacity)
  const drawingStrokes = useEditor((s) => s.drawingStrokes)
  const clearDrawingStrokes = useEditor((s) => s.clearDrawingStrokes)
  const playhead = useEditor((s) => s.playhead)
  const projectFps = useEditor((s) => s.projectFps)

  const tools: { id: DrawingToolType; label: string; icon: LucideIcon }[] = [
    { id: 'brush', label: 'Brush', icon: Paintbrush },
    { id: 'fill', label: 'Fill / Recolor', icon: PaintBucket },
    { id: 'eraser', label: 'Eraser', icon: Eraser },
    { id: 'line', label: 'Line', icon: Slash },
    { id: 'rectangle', label: 'Rectangle', icon: Square },
    { id: 'circle', label: 'Circle', icon: Circle },
    { id: 'arrow', label: 'Arrow', icon: MoveRight },
  ]

  const handleScopeChange = (type: TemporalScopeType) => {
    if (type === 'global') {
      setDrawingScope({ type: 'global' })
    } else if (type === 'span') {
      setDrawingScope({ type: 'span', startTime: playhead, duration: 2.0 })
    } else if (type === 'frame') {
      const currentFrame = Math.round(playhead * projectFps)
      setDrawingScope({ type: 'frame', frame: currentFrame })
    }
  }

  const activeLayer = paintLayers.find((l) => l.id === activePaintLayerId) || paintLayers[0]

  return (
    <div data-testid="drawing-panel" className="p-3 text-xs text-ink-200 flex flex-col gap-4">
      {/* Drawing Mode Toggle */}
      <div className="flex items-center justify-between pb-2 border-b border-ink-800">
        <span className="font-medium text-ink-100 flex items-center gap-1.5">
          <Palette size={14} className="text-brand" />
          Drawing & Paint Mode
        </span>
        <button
          type="button"
          data-testid="drawing-mode-toggle"
          onClick={() => setDrawingEnabled(!drawingEnabled)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
            drawingEnabled
              ? 'bg-brand text-white shadow-sm'
              : 'bg-ink-800 text-ink-400 hover:text-white'
          }`}
        >
          {drawingEnabled ? 'Active' : 'Disabled'}
        </button>
      </div>

      {/* Tools Selection */}
      <div>
        <div className="text-[11px] font-medium text-ink-400 uppercase tracking-wider mb-1.5">Tools</div>
        <div className="grid grid-cols-2 gap-1">
          {tools.map((t) => {
            const Icon = t.icon
            const active = drawingTool === t.id
            return (
              <button
                key={t.id}
                type="button"
                data-testid={`panel-tool-${t.id}`}
                onClick={() => {
                  setDrawingTool(t.id)
                  if (!drawingEnabled) setDrawingEnabled(true)
                }}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-left transition-colors ${
                  active
                    ? 'bg-brand/20 border-brand text-brand font-medium'
                    : 'bg-ink-900 border-ink-800 text-ink-300 hover:bg-ink-800 hover:text-white'
                }`}
              >
                <Icon size={13} />
                <span className="truncate">{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Color Selection */}
      <div>
        <div className="text-[11px] font-medium text-ink-400 uppercase tracking-wider mb-1.5">Color</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {COLOR_SWATCHES.map((hex) => (
            <button
              key={hex}
              type="button"
              data-testid={`panel-color-${hex.replace('#', '')}`}
              onClick={() => setDrawingColor(hex)}
              className={`w-6 h-6 rounded-full border transition-transform ${
                drawingColor === hex ? 'border-white scale-110 shadow-sm' : 'border-ink-700 hover:scale-105'
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
          <input
            type="color"
            value={drawingColor}
            onChange={(e) => setDrawingColor(e.target.value)}
            className="w-6 h-6 rounded-full border border-ink-700 cursor-pointer bg-transparent p-0 overflow-hidden"
          />
        </div>
      </div>

      {/* Tool Parameters */}
      {drawingTool === 'fill' ? (
        <div className="p-2.5 rounded-lg bg-ink-900/80 border border-ink-800 flex flex-col gap-2">
          <div className="flex justify-between items-center text-[11px] font-medium text-ink-400">
            <span>Fill Tolerance</span>
            <span className="font-mono text-ink-200">{drawingFillTolerance}</span>
          </div>
          <input
            type="range"
            data-testid="panel-fill-tolerance-slider"
            min={1}
            max={100}
            value={drawingFillTolerance}
            onChange={(e) => setDrawingFillTolerance(Number(e.target.value))}
            className="of-range w-full"
          />
          <label className="flex items-center gap-2 cursor-pointer pt-1 text-[11px] text-ink-300 hover:text-white select-none">
            <input
              type="checkbox"
              data-testid="panel-preserve-luminance-checkbox"
              checked={drawingPreserveLuminance}
              onChange={(e) => setDrawingPreserveLuminance(e.target.checked)}
              className="accent-brand rounded cursor-pointer"
            />
            <Sparkles size={13} className={drawingPreserveLuminance ? 'text-brand' : 'text-ink-400'} />
            <span className={drawingPreserveLuminance ? 'text-brand font-medium' : ''}>
              Preserve Hair/Cloth Shading (Luminance)
            </span>
          </label>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center text-[11px] font-medium text-ink-400 uppercase tracking-wider mb-1">
            <span>Stroke Width</span>
            <span className="font-mono text-ink-200">{drawingSize} px</span>
          </div>
          <input
            type="range"
            min={1}
            max={40}
            value={drawingSize}
            onChange={(e) => setDrawingSize(Number(e.target.value))}
            className="of-range w-full"
          />
        </div>
      )}

      {/* Temporal Scope */}
      <div>
        <div className="text-[11px] font-medium text-ink-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Clock size={12} />
          Temporal Scope
        </div>
        <select
          value={drawingScope.type}
          onChange={(e) => handleScopeChange(e.target.value as TemporalScopeType)}
          className="w-full bg-ink-900 text-ink-200 border border-ink-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-brand"
        >
          <option value="global">All Frames (Global Annotation)</option>
          <option value="span">Span (Current Playhead + 2.0s)</option>
          <option value="frame">Current Frame Only (Cel)</option>
        </select>
      </div>

      {/* Paint Layers */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-ink-400 uppercase tracking-wider">Paint Layers</span>
          <button
            type="button"
            data-testid="add-paint-layer-btn"
            onClick={() => createPaintLayer()}
            className="flex items-center gap-1 text-[11px] text-brand hover:underline"
          >
            <Plus size={12} />
            Add Layer
          </button>
        </div>
        <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
          {paintLayers.map((layer) => {
            const isActive = layer.id === activePaintLayerId
            return (
              <div
                key={layer.id}
                onClick={() => useEditor.setState({ activePaintLayerId: layer.id })}
                className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer border transition-colors ${
                  isActive
                    ? 'bg-ink-800 border-brand/50 text-white'
                    : 'bg-ink-900 border-ink-800 text-ink-300 hover:bg-ink-850'
                }`}
              >
                <span className="truncate">{layer.name}</span>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    data-testid={`toggle-layer-visibility-${layer.id}`}
                    onClick={() => togglePaintLayerVisibility(layer.id)}
                    className="p-1 rounded text-ink-400 hover:text-white hover:bg-ink-750"
                  >
                    {layer.visible ? <Eye size={13} /> : <EyeOff size={13} className="text-ink-600" />}
                  </button>
                  <button
                    type="button"
                    data-testid={`clear-layer-strokes-${layer.id}`}
                    onClick={() => clearDrawingStrokes(layer.id)}
                    title="Clear layer strokes"
                    className="p-1 rounded text-ink-400 hover:text-red-400 hover:bg-ink-750"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Active Layer Properties: Blend Mode & Blur */}
      {activeLayer && (
        <div className="p-2.5 rounded-lg bg-ink-900/80 border border-ink-800 flex flex-col gap-2.5">
          <div className="flex items-center gap-1 text-[11px] font-medium text-ink-300">
            <Sliders size={12} className="text-brand" />
            <span>Layer Blend & Blur ({activeLayer.name})</span>
          </div>

          <div>
            <div className="text-[10px] text-ink-400 uppercase font-mono mb-1">Blend Mode</div>
            <select
              data-testid="layer-blend-mode-select"
              value={activeLayer.blendMode || 'source-over'}
              onChange={(e) => setPaintLayerBlendMode(activeLayer.id, e.target.value as GlobalCompositeOperation)}
              className="w-full bg-ink-800 text-ink-200 border border-ink-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-brand"
            >
              {BLEND_MODES.map((bm) => (
                <option key={bm.value} value={bm.value}>
                  {bm.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center text-[10px] text-ink-400 uppercase font-mono mb-1">
              <span>Layer Blur</span>
              <span className="text-ink-200">{activeLayer.blur ?? 0} px</span>
            </div>
            <input
              type="range"
              data-testid="layer-blur-slider"
              min={0}
              max={30}
              value={activeLayer.blur ?? 0}
              onChange={(e) => setPaintLayerBlur(activeLayer.id, Number(e.target.value))}
              className="of-range w-full"
            />
          </div>

          <div>
            <div className="flex justify-between items-center text-[10px] text-ink-400 uppercase font-mono mb-1">
              <span>Layer Opacity</span>
              <span className="text-ink-200">{Math.round((activeLayer.opacity ?? 1) * 100)}%</span>
            </div>
            <input
              type="range"
              data-testid="layer-opacity-slider"
              min={0}
              max={100}
              value={Math.round((activeLayer.opacity ?? 1) * 100)}
              onChange={(e) => setPaintLayerOpacity(activeLayer.id, Number(e.target.value) / 100)}
              className="of-range w-full"
            />
          </div>
        </div>
      )}

      {/* Active Strokes Summary */}
      <div className="p-2 rounded bg-ink-900/60 border border-ink-800 text-[11px] text-ink-400 flex items-center justify-between">
        <span>Recorded Vector Strokes:</span>
        <span className="font-mono text-ink-200 font-semibold" data-testid="stroke-count">
          {drawingStrokes.length}
        </span>
      </div>
    </div>
  )
}
