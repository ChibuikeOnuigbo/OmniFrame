import { useState } from 'react'
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
  Plus,
  Eye,
  EyeOff,
  Trash2,
  Clock,
  Palette,
  PaintBucket,
  Sliders,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CornerDownRight,
  Shield,
  type LucideIcon,
} from 'lucide-react'
import { SelectionMaskSubTool } from './SelectionMaskSubTool'
import PanelSection from './PanelSection'
import { Tooltip } from './Tooltip'

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
  { label: 'Soft Light', value: 'soft-light' },
  { label: 'Hard Light', value: 'hard-light' },
  { label: 'Darken', value: 'darken' },
  { label: 'Lighten', value: 'lighten' },
  { label: 'Color Dodge', value: 'color-dodge' },
  { label: 'Color Burn', value: 'color-burn' },
  { label: 'Difference', value: 'difference' },
  { label: 'Exclusion', value: 'exclusion' },
  { label: 'Hue', value: 'hue' },
  { label: 'Saturation', value: 'saturation' },
  { label: 'Color (Recolor / Shading)', value: 'color' },
  { label: 'Luminosity', value: 'luminosity' },
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
  const drawingPolygonSides = useEditor((s) => s.drawingPolygonSides)
  const setDrawingPolygonSides = useEditor((s) => s.setDrawingPolygonSides)
  const drawingShapeFilled = useEditor((s) => s.drawingShapeFilled)
  const setDrawingShapeFilled = useEditor((s) => s.setDrawingShapeFilled)
  const drawingGradientColor = useEditor((s) => s.drawingGradientColor)
  const setDrawingGradientColor = useEditor((s) => s.setDrawingGradientColor)
  const drawingPreserveLuminance = useEditor((s) => s.drawingPreserveLuminance)
  const setDrawingPreserveLuminance = useEditor((s) => s.setDrawingPreserveLuminance)
  const drawingScope = useEditor((s) => s.drawingScope)
  const setDrawingScope = useEditor((s) => s.setDrawingScope)
  const drawingHoldFrames = useEditor((s) => s.drawingHoldFrames)
  const setDrawingHoldFrames = useEditor((s) => s.setDrawingHoldFrames)
  const attachDirectlyToVideo = useEditor((s) => s.attachDirectlyToVideo)
  const setAttachDirectlyToVideo = useEditor((s) => s.setAttachDirectlyToVideo)
  const attachedVideoClipId = useEditor((s) => s.attachedVideoClipId)
  const clips = useEditor((s) => s.clips)
  const onionSkin = useEditor((s) => s.onionSkin)
  const setOnionSkin = useEditor((s) => s.setOnionSkin)
  const toggleOnionSkin = useEditor((s) => s.toggleOnionSkin)
  const stepFrame = useEditor((s) => s.stepFrame)
  const paintLayers = useEditor((s) => s.paintLayers)
  const activePaintLayerId = useEditor((s) => s.activePaintLayerId)
  const createPaintLayer = useEditor((s) => s.createPaintLayer)
  const togglePaintLayerVisibility = useEditor((s) => s.togglePaintLayerVisibility)
  const setPaintLayerBlendMode = useEditor((s) => s.setPaintLayerBlendMode)
  const setPaintLayerBlur = useEditor((s) => s.setPaintLayerBlur)
  const setPaintLayerOpacity = useEditor((s) => s.setPaintLayerOpacity)
  const clearPaintLayerRasterMask = useEditor((s) => s.clearPaintLayerRasterMask)
  const drawingStrokes = useEditor((s) => s.drawingStrokes)
  const clearDrawingStrokes = useEditor((s) => s.clearDrawingStrokes)
  const activeMaskId = useEditor((s) => s.activeMaskId)
  const setActiveMask = useEditor((s) => s.setActiveMask)
  const addTransparencyMask = useEditor((s) => s.addTransparencyMask)
  const removeTransparencyMask = useEditor((s) => s.removeTransparencyMask)
  const toggleTransparencyMask = useEditor((s) => s.toggleTransparencyMask)
  const invertTransparencyMask = useEditor((s) => s.invertTransparencyMask)
  const setTransparencyMaskOpacity = useEditor((s) => s.setTransparencyMaskOpacity)
  const applyTransparencyMask = useEditor((s) => s.applyTransparencyMask)
  const brushDynamics = useEditor((s) => s.brushDynamics)
  const setBrushDynamics = useEditor((s) => s.setBrushDynamics)
  const playhead = useEditor((s) => s.playhead)
  const projectFps = useEditor((s) => s.projectFps)

  const videoClips = clips.filter((c) => c.kind === 'video' && !c.name.includes('Drawing Overlay'))
  const [selectedMergeSourceClipId, setSelectedMergeSourceClipId] = useState<string>(
    attachedVideoClipId || videoClips[0]?.id || ''
  )

  const toolGroups = [
    {
      group: 'Freehand Paint',
      items: [
        { id: 'brush' as DrawingToolType, label: 'Brush', icon: Paintbrush },
        { id: 'pencil' as DrawingToolType, label: 'Pencil', icon: Pencil },
        { id: 'marker' as DrawingToolType, label: 'Marker', icon: Highlighter },
      ],
    },
    {
      group: 'Shapes & Vectors',
      items: [
        { id: 'line' as DrawingToolType, label: 'Line', icon: Slash },
        { id: 'rectangle' as DrawingToolType, label: 'Box', icon: Square },
        { id: 'circle' as DrawingToolType, label: 'Circle', icon: Circle },
        { id: 'arrow' as DrawingToolType, label: 'Arrow', icon: MoveRight },
        { id: 'star' as DrawingToolType, label: 'Star', icon: Star },
      ],
    },
    {
      group: 'Color & Tools',
      items: [
        { id: 'fill' as DrawingToolType, label: 'Fill / Recolor', icon: PaintBucket },
        { id: 'eraser' as DrawingToolType, label: 'Eraser', icon: Eraser },
        { id: 'eyedropper' as DrawingToolType, label: 'Eyedropper', icon: Pipette },
      ],
    },
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

  const activeLayer = paintLayers.find((l) => l.id === activePaintLayerId) || paintLayers[0]
  const currentFrame = Math.round(playhead * projectFps)

  return (
    <div data-testid="drawing-panel" className="p-3 text-xs text-ink-200 flex flex-col gap-2">
      {/* Drawing Mode Toggle */}
      <div className="flex items-center justify-between pb-2 border-b border-ink-800">
        <span className="font-medium text-ink-100 flex items-center gap-1.5">
          <Palette size={14} className="text-brand-400" />
          Drawing & Paint Mode
        </span>
        <button
          type="button"
          data-testid="drawing-mode-toggle"
          aria-pressed={drawingEnabled}
          onClick={() => setDrawingEnabled(!drawingEnabled)}
          className={`min-h-[24px] px-2 py-1 rounded text-[11px] font-medium transition-colors ${
            drawingEnabled
              ? 'bg-brand text-white shadow-sm'
              : 'bg-ink-800 text-ink-400 hover:text-white'
          }`}
        >
          {drawingEnabled ? 'Active' : 'Disabled'}
        </button>
      </div>

      {/* Krita-Style Transparency Mask Active Editing Banner */}
      {activeMaskId && (
        <div data-testid="mask-editing-banner" className="p-2.5 rounded-lg bg-indigo-950/70 border border-indigo-700/60 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
              <Layers size={13} className="text-indigo-400" />
              <span>Editing Transparency Mask</span>
            </span>
            <button
              type="button"
              data-testid="exit-mask-editing-btn"
              onClick={() => setActiveMask(null)}
              className="text-[10px] text-indigo-200 hover:text-white px-1.5 py-0.5 rounded bg-indigo-800/60 hover:bg-indigo-700 transition-colors"
            >
              Back to Layer
            </button>
          </div>
          <div className="text-[10px] text-indigo-200/80 leading-relaxed">
            Non-destructive: Black hides pixels, White reveals, Gray creates semi-transparency.
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <button
              type="button"
              data-testid="mask-swatch-black"
              onClick={() => setDrawingColor('#000000')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border ${
                drawingColor === '#000000'
                  ? 'bg-black text-white border-brand'
                  : 'bg-black/60 text-ink-300 border-ink-700 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-black border border-white/40" />
              <span>Hide (Black)</span>
            </button>
            <button
              type="button"
              data-testid="mask-swatch-white"
              onClick={() => setDrawingColor('#ffffff')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border ${
                drawingColor === '#ffffff'
                  ? 'bg-white text-ink-950 border-brand font-bold'
                  : 'bg-white/10 text-ink-200 border-ink-700 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-white border border-ink-400" />
              <span>Reveal (White)</span>
            </button>
            <button
              type="button"
              data-testid="mask-swatch-gray"
              onClick={() => setDrawingColor('#808080')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border ${
                drawingColor === '#808080'
                  ? 'bg-ink-700 text-white border-brand'
                  : 'bg-ink-800 text-ink-300 border-ink-700 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              <span>50% Gray</span>
            </button>
          </div>
        </div>
      )}

      <PanelSection title="Tool & Selection" defaultOpen={true} testId="tools">
        <PanelSection title="Drawing Tools" defaultOpen={true} testId="drawing-tools">
      {/* Tools Selection */}
      <div className="flex flex-col gap-2.5">
        <div className="text-[11px] font-medium text-ink-400 uppercase tracking-wider">Drawing Tools</div>
        {toolGroups.map((grp) => (
          <div key={grp.group} className="space-y-1">
            <span className="text-[10px] text-ink-500 font-semibold uppercase">{grp.group}</span>
            {/* Icon-first, like Krita/Photoshop toolbars: at three columns a
                10px label truncates to noise, so the name moves to the
                tooltip and the accessible name instead of being shown. */}
            <div className="grid grid-cols-4 gap-1">
              {grp.items.map((t) => {
                const Icon = t.icon
                const active = drawingTool === t.id
                return (
                  <Tooltip key={t.id} label={t.label}>
                  <button
                    type="button"
                    data-testid={`panel-tool-${t.id}`}
                    aria-label={t.label}
                    aria-pressed={active}
                    onClick={() => {
                      setDrawingTool(t.id)
                      if (!drawingEnabled) setDrawingEnabled(true)
                    }}
                    className={`flex h-8 items-center justify-center rounded-md border transition-colors ${
                      active
                        ? 'bg-brand/20 border-brand text-brand-400'
                        : 'bg-ink-900 border-ink-800 text-ink-300 hover:bg-ink-800 hover:text-white'
                    }`}
                  >
                    <Icon size={14} className="shrink-0" />
                  </button></Tooltip>
                )
              })}
            </div>
          </div>
        ))}
      </div>
        </PanelSection>

        <PanelSection title="Selection & Masking" defaultOpen={true} testId="masking">
      {/* Unified Selection & Masking Sub-Tool */}
      <SelectionMaskSubTool context="drawing" />
        </PanelSection>

        <PanelSection title="Timeline Attachment" defaultOpen={true} testId="attachment">
      {/* Add Directly to Video (Attached vs Separate Track) */}
      <div className="p-2.5 rounded-lg bg-ink-900 border border-ink-800 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-ink-200 text-[11px] flex items-center gap-1.5">
            <Layers size={13} className="text-brand-400" />
            Timeline Attachment
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-ink-300">
            <input
              type="checkbox"
              data-testid="attach-directly-to-video-toggle"
              checked={attachDirectlyToVideo}
              onChange={(e) => setAttachDirectlyToVideo(e.target.checked, selectedMergeSourceClipId)}
              className="accent-brand rounded cursor-pointer"
            />
            <span className={attachDirectlyToVideo ? 'text-brand-400 font-medium' : 'text-amber-400 font-medium'}>
              {attachDirectlyToVideo ? 'Direct Video Overlay' : 'Separate Track'}
            </span>
          </label>
        </div>
        {!attachDirectlyToVideo && videoClips.length > 1 && (
          <div className="flex items-center justify-between gap-1 pt-1 border-t border-ink-800 text-[10px]">
            <span className="text-ink-400">Target Video:</span>
            <select
              data-testid="drawing-merge-source-select"
              value={selectedMergeSourceClipId}
              onChange={(e) => setSelectedMergeSourceClipId(e.target.value)}
              className="bg-ink-950 border border-ink-700 rounded px-1.5 py-0.5 text-[10px] text-ink-200"
            >
              {videoClips.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
        </PanelSection>

      </PanelSection>
      <PanelSection title="Colour & Frames" defaultOpen={true} testId="colour-frames">
        <PanelSection
          title="Frame Hold"
          hint={`${drawingHoldFrames} ${drawingHoldFrames === 1 ? 'frame' : 'frames'}`}
          defaultOpen={true}
          testId="frame-hold"
        >
      {/* Frame Attach Count Picker */}
      <div className="p-2.5 rounded-lg bg-ink-900/80 border border-ink-800 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] font-medium text-ink-400 uppercase tracking-wider">
          <span>Attach Frame Count</span>
          <span className="font-mono text-brand-400 font-bold" data-testid="active-attach-frames-label">
            {drawingHoldFrames} {drawingHoldFrames === 1 ? 'frame' : 'frames'} ({(drawingHoldFrames / projectFps).toFixed(2)}s)
          </span>
        </div>

        {/* Presets */}
        <div role="group" aria-label="Frame hold presets" className="grid grid-cols-2 gap-1.5">
          {[
            { f: 1, label: '1f' },
            { f: 2, label: '2f' },
            { f: 6, label: '6f' },
            { f: 12, label: '12f' },
            { f: 24, label: '24f' },
            { f: 90, label: 'All' },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              data-testid={`attach-preset-${preset.label.toLowerCase()}`}
              aria-pressed={drawingHoldFrames === preset.f}
              onClick={() => {
                setDrawingHoldFrames(preset.f)
                if (drawingScope.type === 'frame') {
                  setDrawingScope({ ...drawingScope, holdFrames: preset.f })
                }
              }}
              className={`min-h-8 rounded text-[11px] font-mono font-medium border text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                drawingHoldFrames === preset.f
                  ? 'bg-brand text-white border-brand shadow-xs'
                  : 'bg-ink-950 border-ink-800 text-ink-400 hover:text-white hover:bg-ink-850'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[10px] text-ink-400">Custom Frame Hold:</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid="attach-frame-decrement"
              onClick={() => {
                const next = Math.max(1, drawingHoldFrames - 1)
                setDrawingHoldFrames(next)
                if (drawingScope.type === 'frame') setDrawingScope({ ...drawingScope, holdFrames: next })
              }}
              aria-label="Decrease frames to attach"
              className="grid h-7 w-7 place-items-center rounded bg-ink-800 text-ink-200 font-bold hover:bg-ink-750 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              -
            </button>
            <input
              type="number"
              data-testid="attach-frame-count-input"
              aria-label="Frames to attach"
              min={1}
              max={240}
              value={drawingHoldFrames}
              onChange={(e) => {
                const val = Math.max(1, Math.min(240, parseInt(e.target.value, 10) || 1))
                setDrawingHoldFrames(val)
                if (drawingScope.type === 'frame') setDrawingScope({ ...drawingScope, holdFrames: val })
              }}
              className="h-7 w-12 bg-ink-950 border border-ink-700 rounded px-1 py-0.5 text-[11px] font-mono text-center text-ink-100"
            />
            <button
              type="button"
              data-testid="attach-frame-increment"
              onClick={() => {
                const next = Math.min(240, drawingHoldFrames + 1)
                setDrawingHoldFrames(next)
                if (drawingScope.type === 'frame') setDrawingScope({ ...drawingScope, holdFrames: next })
              }}
              aria-label="Increase frames to attach"
              className="grid h-7 w-7 place-items-center rounded bg-ink-800 text-ink-200 font-bold hover:bg-ink-750 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              +
            </button>
          </div>
        </div>
      </div>
        </PanelSection>

        <PanelSection title="Drawing Colour" defaultOpen={true} testId="drawing-colour">
      {/* Color Selection */}
      <div>
        <div className="text-[11px] font-medium text-ink-400 uppercase tracking-wider mb-1.5">Color</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {COLOR_SWATCHES.map((hex) => (
            <button
              key={hex}
              type="button"
              data-testid={`panel-color-${hex.replace('#', '')}`}
              aria-label={`Set drawing colour to ${hex}`}
              aria-pressed={drawingColor === hex}
              title={`Drawing colour ${hex}`}
              onClick={() => setDrawingColor(hex)}
              className={`h-7 w-7 rounded-full border transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                drawingColor === hex ? 'border-white scale-110 shadow-sm' : 'border-ink-700 hover:scale-105'
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
          <input
            type="color"
            aria-label="Drawing colour"
            value={drawingColor}
            onChange={(e) => setDrawingColor(e.target.value)}
            className="h-7 w-7 rounded-full border border-ink-700 cursor-pointer bg-transparent p-0 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          />
        </div>
      </div>
        </PanelSection>
      </PanelSection>
      <PanelSection title="Tool Parameters" defaultOpen={true} testId="tool-params">
      {/* Tool Parameters */}
      {(drawingTool === 'polygon' || drawingTool === 'gradient') ? (
        <div className="p-2.5 rounded-lg bg-ink-900/80 border border-ink-800 flex flex-col gap-2">
          {drawingTool === 'polygon' ? (
            <>
              <div className="flex justify-between items-center text-[11px] font-medium text-ink-400">
                <span>Polygon Sides</span>
                <span className="font-mono text-ink-200">{drawingPolygonSides}</span>
              </div>
              <input
                type="range"
                data-testid="panel-polygon-sides-slider"
                min={3}
                max={12}
                value={drawingPolygonSides}
                onChange={(e) => setDrawingPolygonSides(Number(e.target.value))}
                className="of-range w-full"
              />
              <label className="flex items-center gap-2 cursor-pointer pt-1 text-[11px] text-ink-300 hover:text-white select-none">
                <input
                  type="checkbox"
                  data-testid="panel-shape-filled-checkbox"
                  checked={drawingShapeFilled}
                  onChange={(e) => setDrawingShapeFilled(e.target.checked)}
                  className="accent-brand rounded cursor-pointer"
                />
                <Square size={13} className={drawingShapeFilled ? 'text-brand-400' : 'text-ink-400'} />
                <span className={drawingShapeFilled ? 'text-brand-400 font-medium' : ''}>Fill Shape</span>
              </label>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center text-[11px] font-medium text-ink-400">
                <span>Gradient End Colour</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Gradient colour"
                  data-testid="panel-gradient-color-input"
                  value={drawingGradientColor.slice(0, 7)}
                  onChange={(e) => setDrawingGradientColor(e.target.value)}
                  className="w-8 h-7 rounded cursor-pointer bg-transparent border border-ink-700 p-0"
                />
                <button
                  type="button"
                  data-testid="panel-gradient-transparent-btn"
                  onClick={() => setDrawingGradientColor('#00000000')}
                  className="px-2 py-1 rounded border border-ink-700 text-[10px] hover:bg-ink-800"
                >
                  Fade to transparent
                </button>
              </div>
            </>
          )}
        </div>
      ) : drawingTool === 'fill' ? (
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
            <Sparkles size={13} className={drawingPreserveLuminance ? 'text-brand-400' : 'text-ink-400'} />
            <span className={drawingPreserveLuminance ? 'text-brand-400 font-medium' : ''}>
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

      </PanelSection>
      <PanelSection title="Timing & Onion Skin" defaultOpen={true} testId="timing">
      {/* Temporal Scope & Apply to All Frames */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-medium text-ink-400 uppercase tracking-wider flex items-center gap-1">
            <Clock size={12} />
            Temporal Scope
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-ink-300">
            <input
              type="checkbox"
              data-testid="apply-to-all-frames-toggle"
              checked={drawingScope.type === 'global'}
              onChange={(e) => {
                if (e.target.checked) {
                  setDrawingScope({ type: 'global' })
                } else {
                  setDrawingScope({ type: 'frame', frame: currentFrame, holdFrames: drawingHoldFrames })
                }
              }}
              className="rounded border-ink-700 bg-ink-800 text-brand-400"
            />
            <span className={drawingScope.type === 'global' ? 'text-brand-400 font-medium' : 'text-ink-400'}>
              Apply to All Frames
            </span>
          </label>
        </div>
        <select
          value={drawingScope.type}
          onChange={(e) => handleScopeChange(e.target.value as TemporalScopeType)}
          aria-label="Apply to frames"
          className="w-full bg-ink-900 text-ink-200 border border-ink-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-brand"
        >
          <option value="global">All Frames (Global Annotation)</option>
          <option value="span">Span (Current Playhead + 2.0s)</option>
          <option value="frame">Current Frame Cel (Animation / Roto)</option>
        </select>

        {drawingScope.type === 'frame' && (
          <div className="p-2.5 rounded-lg bg-ink-900/80 border border-ink-800 flex flex-col gap-2 animate-in fade-in duration-150">
            {/* Cel Stepping */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-ink-400 uppercase font-mono">Cel Frame</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-testid="panel-step-prev-cel"
                  title="Step Previous Frame (,)"
                  onClick={() => stepFrame(-1)}
                  className="p-1 rounded bg-ink-800 hover:bg-ink-750 text-ink-300 hover:text-white"
                >
                  <ChevronLeft size={13} />
                </button>
                <span
                  data-testid="current-cel-badge"
                  data-cel-frame={currentFrame}
                  className="font-mono text-[11px] font-bold text-brand-400 px-1.5 py-0.5 rounded bg-brand/10 border border-brand/30"
                >
                  Frame #{currentFrame}
                </span>
                <button
                  type="button"
                  data-testid="panel-step-next-cel"
                  title="Step Next Frame (.)"
                  onClick={() => stepFrame(1)}
                  className="p-1 rounded bg-ink-800 hover:bg-ink-750 text-ink-300 hover:text-white"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* Hold / Exposure */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-ink-400 uppercase font-mono">Hold / Exposure</span>
              <select
                data-testid="panel-cel-hold-frames"
                value={drawingHoldFrames}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  setDrawingHoldFrames(val)
                  setDrawingScope({ ...drawingScope, holdFrames: val })
                }}
                className="bg-ink-800 text-ink-200 border border-ink-700 rounded px-2 py-0.5 text-xs font-mono focus:outline-none focus:border-brand"
              >
                <option value={1}>1 frame (on ones)</option>
                <option value={2}>2 frames (on twos)</option>
                <option value={3}>3 frames (on threes)</option>
                <option value={4}>4 frames (on fours)</option>
              </select>
            </div>

            {/* Onion Skinning Controls */}
            <div className="pt-2 border-t border-ink-800 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-ink-400 uppercase font-mono flex items-center gap-1">
                  <Layers size={11} className={onionSkin.enabled ? 'text-amber-400' : ''} />
                  Onion Skinning
                </span>
                <button
                  type="button"
                  data-testid="panel-onion-skin-toggle"
                  onClick={() => toggleOnionSkin()}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                    onionSkin.enabled
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-ink-800 text-ink-400 hover:text-white'
                  }`}
                >
                  {onionSkin.enabled ? 'Active (Ghosting)' : 'Disabled'}
                </button>
              </div>

              {onionSkin.enabled && (
                <div className="flex flex-col gap-1.5 pt-1 text-[10px] text-ink-400">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                      Prev Ghost Frames
                    </span>
                    <span className="font-mono text-ink-200">{onionSkin.beforeFrames}f</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    value={onionSkin.beforeFrames}
                    onChange={(e) => setOnionSkin({ beforeFrames: Number(e.target.value) })}
                    className="of-range w-full"
                  />

                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      Next Ghost Frames
                    </span>
                    <span className="font-mono text-ink-200">{onionSkin.afterFrames}f</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    value={onionSkin.afterFrames}
                    onChange={(e) => setOnionSkin({ afterFrames: Number(e.target.value) })}
                    className="of-range w-full"
                  />

                  <div className="flex justify-between items-center">
                    <span>Ghost Opacity</span>
                    <span className="font-mono text-ink-200">{Math.round(onionSkin.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={80}
                    value={Math.round(onionSkin.opacity * 100)}
                    onChange={(e) => setOnionSkin({ opacity: Number(e.target.value) / 100 })}
                    className="of-range w-full"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      </PanelSection>
      <PanelSection title="Paint Layers" defaultOpen={true} testId="layers">
      {/* Paint Layers */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-ink-400 uppercase tracking-wider">Paint Layers</span>
          <button
            type="button"
            data-testid="add-paint-layer-btn"
            onClick={() => createPaintLayer()}
            className="flex items-center gap-1 text-[11px] text-brand-400 hover:underline"
          >
            <Plus size={12} />
            Add Layer
          </button>
        </div>
        <div tabIndex={0} aria-label="Paint layers, scrollable" className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
          {paintLayers.map((layer) => {
            const isLayerActive = layer.id === activePaintLayerId && !activeMaskId
            const isMaskActive = layer.transparencyMask && layer.transparencyMask.id === activeMaskId
            return (
              <div key={layer.id} className="flex flex-col gap-1">
                {/* Main Layer Row */}
                <div
                  data-testid={`paint-layer-item-${layer.id}`}
                  onClick={() => {
                    useEditor.setState({ activePaintLayerId: layer.id })
                    setActiveMask(null)
                  }}
                  className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer border transition-colors ${
                    isLayerActive
                      ? 'bg-ink-800 border-brand/50 text-white'
                      : 'bg-ink-900 border-ink-800 text-ink-300 hover:bg-ink-850'
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                    <span className="min-w-0 flex-1 truncate">{layer.name}</span>
                    {layer.transparencyMask && (
                      <span className="shrink-0 text-[9px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                        +Mask
                      </span>
                    )}
                    {layer.maskDataUrl && (
                      <span
                        data-testid={`paint-layer-raster-mask-${layer.id}`}
                        title="Raster Drawing mask applied to this paint layer"
                        className="shrink-0 text-[9px] px-1 py-0.2 rounded bg-cyan-500/15 text-cyan-200 font-mono"
                      >
                        Raster Mask
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {!layer.transparencyMask && (
                      <button
                        type="button"
                        data-testid={`add-transparency-mask-${layer.id}`}
                        onClick={() => addTransparencyMask(layer.id)}
                        title="Add Krita-style Transparency Mask"
                        className="text-[10px] text-indigo-300 hover:text-white px-1.5 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 font-medium"
                      >
                        + Mask
                      </button>
                    )}
                    <Tooltip label={layer.visible ? `Hide layer ${layer.name}` : `Show layer ${layer.name}`}>
                    <button
                      type="button"
                      data-testid={`toggle-layer-visibility-${layer.id}`}
                      aria-pressed={!!layer.visible}
                      aria-label={layer.visible ? `Hide layer ${layer.name}` : `Show layer ${layer.name}`}
                      onClick={() => togglePaintLayerVisibility(layer.id)}
                      className="p-1 rounded text-ink-400 hover:text-white hover:bg-ink-750"
                    >
                      {layer.visible ? <Eye size={13} /> : <EyeOff size={13} className="text-ink-600" />}
                    </button>
                    </Tooltip>
                    {layer.maskDataUrl && (
                      <Tooltip label={`Remove raster mask from ${layer.name}`}>
                        <button
                          type="button"
                          data-testid={`clear-paint-layer-raster-mask-${layer.id}`}
                          aria-label={`Clear raster mask from ${layer.name}`}
                          onClick={() => clearPaintLayerRasterMask(layer.id)}
                          className="p-1 rounded text-cyan-300 hover:text-red-300 hover:bg-ink-750 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        >
                          <Trash2 size={11} />
                        </button>
                      </Tooltip>
                    )}
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

                {/* Indented Transparency Mask Child Node (Krita KisTransparencyMask) */}
                {layer.transparencyMask && (
                  <div
                    data-testid={`transparency-mask-item-${layer.id}`}
                    onClick={() => {
                      useEditor.setState({ activePaintLayerId: layer.id })
                      setActiveMask(layer.transparencyMask!.id)
                    }}
                    className={`ml-3.5 flex items-center justify-between px-2 py-1 rounded cursor-pointer border text-xs transition-colors ${
                      isMaskActive
                        ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-xs'
                        : 'bg-ink-950/60 border-ink-800/80 text-ink-400 hover:bg-ink-900'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <CornerDownRight size={11} className="text-indigo-400 shrink-0" />
                      <span className="truncate">Transparency Mask</span>
                      {layer.transparencyMask.inverted && (
                        <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                          INV
                        </span>
                      )}
                      {isMaskActive && (
                        <span className="text-[10px] px-1 py-0.2 rounded bg-indigo-500 text-white font-bold">
                          EDITING
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        data-testid={`invert-mask-${layer.id}`}
                        onClick={() => invertTransparencyMask(layer.id)}
                        title="Invert Mask (Black <-> White)"
                        className="p-1 rounded text-ink-400 hover:text-amber-300 hover:bg-ink-800"
                      >
                        <RotateCcw size={11} />
                      </button>
                      <button
                        type="button"
                        data-testid={`toggle-mask-enabled-${layer.id}`}
                        onClick={() => toggleTransparencyMask(layer.id)}
                        title={layer.transparencyMask.enabled ? 'Bypass Mask' : 'Enable Mask'}
                        className="p-1 rounded text-ink-400 hover:text-white hover:bg-ink-800"
                      >
                        {layer.transparencyMask.enabled ? (
                          <Eye size={12} className="text-indigo-400" />
                        ) : (
                          <EyeOff size={12} className="text-ink-600" />
                        )}
                      </button>
                      <button
                        type="button"
                        data-testid={`delete-mask-${layer.id}`}
                        onClick={() => removeTransparencyMask(layer.id)}
                        title="Delete Transparency Mask"
                        className="p-1 rounded text-ink-400 hover:text-red-400 hover:bg-ink-800"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      </PanelSection>
      <PanelSection title="Brush & Layer Properties" defaultOpen={true} testId="brush">
      {/* Krita Professional Brush Dynamics & Tablet Stylus */}
      <div className="p-2.5 rounded-lg bg-ink-900/80 border border-ink-800 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] font-medium text-ink-300">
          <span className="flex items-center gap-1">
            <Sliders size={12} className="text-brand-400" />
            <span>Brush Dynamics & Stabilizer (Krita Engine)</span>
          </span>
          <span className="text-[9px] font-mono text-ink-400">Stylus / Pen</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer text-ink-300 hover:text-white">
            <input
              type="checkbox"
              data-testid="brush-pressure-size-checkbox"
              checked={brushDynamics.pressureSize}
              onChange={(e) => setBrushDynamics({ pressureSize: e.target.checked })}
              className="rounded border-ink-700 text-brand-400 focus:ring-brand bg-ink-800"
            />
            <span className="text-[11px]">Pressure Size</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-ink-300 hover:text-white">
            <input
              type="checkbox"
              data-testid="brush-pressure-opacity-checkbox"
              checked={brushDynamics.pressureOpacity}
              onChange={(e) => setBrushDynamics({ pressureOpacity: e.target.checked })}
              className="rounded border-ink-700 text-brand-400 focus:ring-brand bg-ink-800"
            />
            <span className="text-[11px]">Pressure Opacity</span>
          </label>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[10px] text-ink-400 uppercase font-mono">
            <span>Smoothing Mode</span>
            <span className="text-brand-400 font-semibold capitalize">{brushDynamics.smoothingMode}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 bg-ink-950 p-0.5 rounded border border-ink-800">
            {(['none', 'smooth', 'stabilizer'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                data-testid={`smoothing-mode-${mode}`}
                onClick={() => setBrushDynamics({ smoothingMode: mode })}
                className={`py-1 rounded text-[10px] font-medium capitalize transition-colors ${
                  brushDynamics.smoothingMode === mode
                    ? 'bg-brand text-white'
                    : 'text-ink-400 hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Layer Properties: Blend Mode & Blur */}
      {activeLayer && (
        <div className="p-2.5 rounded-lg border border-ink-800 bg-ink-900/80 flex flex-col gap-2.5">
          <div className="flex items-center gap-1 text-[11px] font-medium text-ink-300">
            <Sliders size={12} className="text-brand-400" />
            <span>Drawing Layer Properties ({activeLayer.name})</span>
          </div>
          <p
            role="note"
            data-testid="drawing-layer-compositing-note"
            className="text-[10px] leading-relaxed text-ink-400"
          >
            Blend mode, blur, opacity, and an applied mask affect this Drawing layer only. Its strokes and mask are composited into preview and final export.
          </p>

          <div>
            <div className="text-[10px] text-ink-400 uppercase font-mono mb-1">Paint Layer Blend Mode</div>
            <select
              data-testid="layer-blend-mode-select"
              aria-label="Drawing paint layer blend mode"
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
      </PanelSection>
    </div>
  )
}
