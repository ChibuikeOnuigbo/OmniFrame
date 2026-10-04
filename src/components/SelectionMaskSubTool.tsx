import React, { useState } from 'react'
import {
  Square,
  Circle,
  Lasso,
  Spline,
  Paintbrush,
  Wand2,
  FlipHorizontal,
  Expand,
  Shrink,
  Feather,
  PaintBucket,
  Eye,
  EyeOff,
  Layers,
  Sparkles,
  Scissors,
  Check,
  X,
  Palette,
  ScanFace,
  Crosshair,
} from 'lucide-react'
import { useEditor } from '../store'
import type { SelectionModeType } from '../types'
import PanelSection from './PanelSection'

const PRESET_COLORS = [
  { id: 'blue', label: 'Towel Royal Blue', hex: '#2563eb' },
  { id: 'red', label: 'Crimson / Apple Red', hex: '#dc2626' },
  { id: 'amber', label: 'Golden Amber', hex: '#d97706' },
  { id: 'green', label: 'Emerald Green', hex: '#059669' },
  { id: 'purple', label: 'Royal Purple', hex: '#7c3aed' },
  { id: 'burgundy', label: 'Leather Burgundy', hex: '#831843' },
]

const SHORT_SELECTION_LABELS: Record<SelectionModeType, string> = {
  rect: 'Rect',
  ellipse: 'Ellipse',
  freeform: 'Lasso',
  polygon: 'Polygon',
  painting: 'Brush',
  'magic-wand': 'Wand',
  character: 'Object',
}

type SelectionMaskContext = 'drawing' | 'omniframe'

interface SelectionMaskSubToolProps {
  onOpenBgModal?: () => void
  compact?: boolean
  context?: SelectionMaskContext
}

export function SelectionMaskSubTool({ onOpenBgModal, compact = false, context = 'drawing' }: SelectionMaskSubToolProps) {
  const activeSelection = useEditor((s) => s.activeSelection)
  const guidedMatte = useEditor((s) => s.guidedMatte)
  const guidedMatteBusy = useEditor((s) => s.guidedMatteBusy)
  const runGuidedRectBackgroundRemoval = useEditor((s) => s.runGuidedRectBackgroundRemoval)
  const applyGuidedMatteToDrawingLayer = useEditor((s) => s.applyGuidedMatteToDrawingLayer)
  const clearGuidedMatte = useEditor((s) => s.clearGuidedMatte)
  const paintLayers = useEditor((s) => s.paintLayers)
  const activePaintLayerId = useEditor((s) => s.activePaintLayerId)
  const activePaintLayer = paintLayers.find((layer) => layer.id === activePaintLayerId)
  const guidedMatteLayer = guidedMatte?.maskLayerId
    ? paintLayers.find(
        (layer) => layer.id === guidedMatte.maskLayerId && layer.maskDataUrl === guidedMatte.maskDataUrl,
      )
    : undefined
  const guidedMatteAppliedToActiveLayer = !!guidedMatteLayer && guidedMatteLayer.id === activePaintLayerId
  const [guideHint, setGuideHint] = useState<{ x: number; y: number } | null>(null)
  const selectionMode = useEditor((s) => s.selectionMode)
  const setSelectionMode = useEditor((s) => s.setSelectionMode)
  const invertSelection = useEditor((s) => s.invertSelection)
  const growSelection = useEditor((s) => s.growSelection)
  const shrinkSelection = useEditor((s) => s.shrinkSelection)
  const setSelectionFeather = useEditor((s) => s.setSelectionFeather)
  const clearSelection = useEditor((s) => s.clearSelection)
  const recolorActiveSelection = useEditor((s) => s.recolorActiveSelection)
  const convertSelectionToOmniframeObject = useEditor((s) => s.convertSelectionToOmniframeObject)
  const convertSelectionToMask = useEditor((s) => s.convertSelectionToMask)
  const setSelectionMaskDisplayMode = useEditor((s) => s.setSelectionMaskDisplayMode)
  const toggleSelectionMaskView = useEditor((s) => s.toggleSelectionMaskView)
  const omniframeCharacters = useEditor((s) => s.omniframeCharacters)
  const selectedCharacterId = useEditor((s) => s.selectedCharacterId)
  const setSelectedCharacterId = useEditor((s) => s.setSelectedCharacterId)
  const setActiveSelection = useEditor((s) => s.setActiveSelection)

  const [selectedColor, setSelectedColor] = useState('#2563eb')
  const [customHex, setCustomHex] = useState('#2563eb')
  const [featherVal, setFeatherVal] = useState(activeSelection?.feather || 2)
  const [preserveLuminance, setPreserveLuminance] = useState(true)

  const selectionTypes: { id: SelectionModeType; label: string; icon: React.ElementType }[] = [
    { id: 'rect', label: 'Rectangle (Marquee)', icon: Square },
    { id: 'ellipse', label: 'Ellipse / Circle', icon: Circle },
    { id: 'freeform', label: 'Freeform Lasso', icon: Lasso },
    { id: 'polygon', label: 'Polygon Points', icon: Spline },
    { id: 'painting', label: 'Paint Selection Brush', icon: Paintbrush },
    { id: 'magic-wand', label: 'Magic Wand / Color Range', icon: Wand2 },
  ]

  const handleApplyColorize = (colorToApply: string) => {
    recolorActiveSelection(colorToApply)
  }

  const handleSelectObjectPreset = (charId: string) => {
    setSelectedCharacterId(charId)
    const char = omniframeCharacters.find((c) => c.id === charId)
    if (char) {
      setActiveSelection({
        type: 'character',
        bounds: { ...char.bounds },
        characterName: char.name,
        showMaskOnly: false,
        maskDisplayMode: 'cutout',
      })
    }
  }

  return (
    <div
      data-testid="selection-mask-subtool"
      className="flex flex-col gap-2.5 p-2.5 rounded-xl bg-ink-950/70 border border-ink-800 text-xs text-ink-200"
    >
      {/* Header & Sub-tool Mode Indicator */}
      <div className="flex items-center justify-between pb-1.5 border-b border-ink-800">
        <div className="flex items-center gap-1.5 font-semibold text-ink-100">
          <Sparkles size={13} className="text-brand-400" />
          <span>Selection & Masking Sub-Tool</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] px-1.5 py-0.2 rounded font-mono uppercase bg-brand/15 text-brand-400 border border-brand/30">
            LumaCut Mask Engine
          </span>
        </div>
      </div>

      <div
        role="note"
        data-testid="mask-export-scope-note"
        className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 px-2.5 py-2 text-[10px] leading-relaxed text-ink-300"
      >
        <div className="mb-0.5 font-semibold uppercase tracking-wide text-cyan-200">
          {context === 'omniframe' ? 'OmniFrame selection mask' : 'Drawing selection mask'}
        </div>
        <p>
          {context === 'omniframe'
            ? 'OmniFrame masks are selection and segmentation data, not final-video effects. Convert the selection to a Drawing mask to include it in export.'
            : 'A selection mask is an editing guide until converted. Only masks applied to a Drawing paint layer are composited into the final video.'}
        </p>
      </div>

      {/* 1. Selection Types */}
      <PanelSection title="Selection Types" hint="Choose a tool" testId="mask-selection-types" defaultOpen={true}>
        <div role="group" aria-label="Selection tools" className="grid grid-cols-2 gap-1.5">
          {selectionTypes.map((st) => {
            const Icon = st.icon
            const isActive = selectionMode === st.id
            return (
              <button
                key={st.id}
                type="button"
                data-testid={`sel-type-${st.id}`}
                title={st.label}
                aria-label={st.label}
                aria-pressed={isActive}
                onClick={() => setSelectionMode(st.id)}
                className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border p-1.5 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  isActive
                    ? 'bg-brand text-white border-brand shadow-xs'
                    : 'bg-ink-900 border-ink-800 text-ink-300 hover:text-white hover:bg-ink-800'
                }`}
              >
                <Icon size={16} className="shrink-0" />
                <span className="max-w-full truncate text-[11px] font-medium leading-tight">
                  {SHORT_SELECTION_LABELS[st.id]}
                </span>
              </button>
            )
          })}
        </div>
      </PanelSection>

      {/* 2. Detected Object Quick-Select (Towel, Chair, Light, etc.) */}
      {omniframeCharacters.length > 0 && (
        <PanelSection
          title="Detected Objects"
          hint={`${omniframeCharacters.length} found`}
          testId="mask-objects"
          defaultOpen={true}
        >
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Detected objects">
            {omniframeCharacters.map((char) => {
              const isSelected = selectedCharacterId === char.id
              return (
                <button
                  key={char.id}
                  type="button"
                  data-testid={`quick-select-${char.id}`}
                  onClick={() => handleSelectObjectPreset(char.id)}
                  title={`Select ${char.name}`}
                  aria-pressed={isSelected}
                  className={`flex min-h-7 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-all truncate max-w-[170px] ${
                    isSelected
                      ? 'bg-brand/20 border-brand text-white shadow-xs'
                      : 'bg-ink-900 border-ink-800 text-ink-300 hover:bg-ink-850 hover:text-white'
                  }`}
                >
                  <div
                    aria-hidden="true"
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: char.recolorColor || '#a855f7' }}
                  />
                  <span className="truncate">{char.name}</span>
                </button>
              )
            })}
          </div>
        </PanelSection>
      )}

      {/* 3. Selection operations: invert, grow, shrink and clear. */}
      <PanelSection
        key={activeSelection ? 'selection-adjustments-active' : 'selection-adjustments-idle'}
        title="Selection Adjustments"
        hint={activeSelection ? 'Ready' : undefined}
        testId="mask-detected"
        defaultOpen={Boolean(activeSelection)}
      >
        <div role="group" aria-label="Selection adjustment actions" className="grid grid-cols-4 gap-1">
          <button
            type="button"
            data-testid="subtool-invert-btn"
            title="Invert Selection boundary (outside vs inside)"
            aria-label="Invert Selection"
            onClick={invertSelection}
            className="flex min-h-8 min-w-0 items-center justify-center gap-1 rounded-lg border border-ink-800 bg-ink-900 px-1 py-1 text-[11px] text-ink-300 transition-colors hover:bg-ink-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <FlipHorizontal size={13} />
            <span className="min-w-0 truncate">Invert</span>
          </button>
          <button
            type="button"
            data-testid="subtool-grow-btn"
            title="Grow Selection boundary by 8px"
            aria-label="Grow Selection"
            onClick={() => growSelection(8)}
            className="flex min-h-8 min-w-0 items-center justify-center gap-1 rounded-lg border border-ink-800 bg-ink-900 px-1 py-1 text-[11px] text-ink-300 transition-colors hover:bg-ink-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Expand size={13} />
            <span className="min-w-0 truncate">Grow</span>
          </button>
          <button
            type="button"
            data-testid="subtool-shrink-btn"
            title="Shrink Selection boundary by 8px"
            aria-label="Shrink Selection"
            onClick={() => shrinkSelection(8)}
            className="flex min-h-8 min-w-0 items-center justify-center gap-1 rounded-lg border border-ink-800 bg-ink-900 px-1 py-1 text-[11px] text-ink-300 transition-colors hover:bg-ink-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Shrink size={13} />
            <span className="min-w-0 truncate">Shrink</span>
          </button>
          <button
            type="button"
            data-testid="subtool-clear-btn"
            title="Clear Active Selection"
            aria-label="Clear Selection"
            onClick={clearSelection}
            className="flex min-h-8 min-w-0 items-center justify-center gap-1 rounded-lg border border-ink-800 bg-ink-900 px-1 py-1 text-[11px] text-ink-300 transition-colors hover:border-red-500/40 hover:bg-red-500/20 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X size={13} />
            <span className="min-w-0 truncate">Clear</span>
          </button>
        </div>
      </PanelSection>

      {/* 4. Fill & Recolor Tool (Changing color of towel, chair seat, apple, shapes) */}
      <PanelSection title="Fill & Recolor" testId="mask-boundary" defaultOpen={false}>
        {/* Title and toggle share a row until the panel is too narrow for
            both, at which point the toggle drops to its own line rather
            than pushing the section 21px past its container. */}

        {/* Preset Palette Swatches */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 flex-wrap flex-1">
            {PRESET_COLORS.map((c) => {
              const isPicked = selectedColor === c.hex
              return (
                <button
                  key={c.id}
                  type="button"
                  data-testid={`recolor-swatch-${c.id}`}
                  title={`${c.label} (${c.hex})`}
                  aria-label={`Apply ${c.label} recolor`}
                  aria-pressed={isPicked}
                  onClick={() => {
                    setSelectedColor(c.hex)
                    setCustomHex(c.hex)
                    handleApplyColorize(c.hex)
                  }}
                  style={{ backgroundColor: c.hex }}
                  className={`w-6 h-6 rounded-md border transition-all ${
                    isPicked
                      ? 'border-white ring-2 ring-brand scale-110 shadow-sm'
                      : 'border-white/20 hover:scale-105'
                  }`}
                />
              )
            })}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <input
              type="color"
              data-testid="recolor-custom-picker"
              aria-label="Choose custom recolor"
              value={customHex}
              onChange={(e) => {
                setCustomHex(e.target.value)
                setSelectedColor(e.target.value)
              }}
              className="w-6 h-6 rounded border border-ink-700 bg-transparent cursor-pointer p-0"
              title="Pick custom hex color"
            />
            <button
              type="button"
              data-testid="apply-recolor-btn"
              onClick={() => handleApplyColorize(selectedColor)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-[11px] transition-colors shadow-xs"
              title="Apply recolor to selected area or active object"
            >
              <PaintBucket size={11} />
              <span>Colorize</span>
            </button>
          </div>
        </div>
      </PanelSection>

      {/* 5. Non-Destructive Background Removal (Show Mask vs Cutout) */}
      <PanelSection title="Mask Preview" testId="mask-fill" defaultOpen={false}>

        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            data-testid="mask-mode-rubylith-btn"
            aria-pressed={activeSelection?.maskDisplayMode === 'rubylith'}
            onClick={() => setSelectionMaskDisplayMode('rubylith')}
            className={`py-1 px-1 rounded text-[11px] border transition-colors ${
              activeSelection?.maskDisplayMode === 'rubylith'
                ? 'bg-red-500/30 border-red-500 text-red-200'
                : 'bg-ink-900 border-ink-800 text-ink-300 hover:bg-ink-800 hover:text-white'
            }`}
            title="Red rubylith overlay shows protected areas"
          >
            Rubylith Mask
          </button>
          <button
            type="button"
            data-testid="mask-mode-matte-btn"
            aria-pressed={activeSelection?.maskDisplayMode === 'matte'}
            onClick={() => setSelectionMaskDisplayMode('matte')}
            className={`py-1 px-1 rounded text-[11px] border transition-colors ${
              activeSelection?.maskDisplayMode === 'matte'
                ? 'bg-white/20 border-white text-white'
                : 'bg-ink-900 border-ink-800 text-ink-300 hover:bg-ink-800 hover:text-white'
            }`}
            title="Black and White alpha matte"
          >
            B&W Matte
          </button>
          <button
            type="button"
            data-testid="mask-mode-cutout-btn"
            aria-pressed={!activeSelection?.maskDisplayMode || activeSelection?.maskDisplayMode === 'cutout'}
            onClick={() => setSelectionMaskDisplayMode('cutout')}
            className={`py-1 px-1 rounded text-[11px] border transition-colors ${
              !activeSelection?.maskDisplayMode || activeSelection?.maskDisplayMode === 'cutout'
                ? 'bg-brand/25 border-brand text-white'
                : 'bg-ink-900 border-ink-800 text-ink-300 hover:bg-ink-800 hover:text-white'
            }`}
            title="Composite Cutout with transparent background"
          >
            Cutout Mode
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          <button
            type="button"
            data-testid="toggle-show-mask-btn"
            aria-pressed={!!activeSelection?.showMaskOnly}
            onClick={() => toggleSelectionMaskView()}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[11px] font-medium transition-all ${
              activeSelection?.showMaskOnly
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : 'bg-ink-900 border-ink-800 text-ink-200 hover:bg-ink-800 hover:text-white'
            }`}
            title="Toggle Show Mask layer rather than editing the actual image"
          >
            <Eye size={12} className="shrink-0" />
            <span>{activeSelection?.showMaskOnly ? 'Hide Mask Layer' : 'Show Mask Layer'}</span>
          </button>

          <button
            type="button"
            data-testid="convert-mask-layer-btn"
            aria-label="Convert selection to Drawing paint-layer mask"
            disabled={!activeSelection}
            onClick={() => convertSelectionToMask()}
            className="flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-ink-800 bg-ink-900 px-2 py-1.5 text-[10px] font-medium text-ink-200 transition-colors hover:bg-ink-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-40"
            title="Apply the current selection to the active Drawing paint layer; the mask then appears in preview and final export."
          >
            <Layers size={12} className="shrink-0" />
            <span className="min-w-0 truncate">To Drawing Mask</span>
          </button>
        </div>
      </PanelSection>

      {/* 5b. Guided Rect Background Removal — draw a box, click remove, get a mask layer */}
      <PanelSection title="Guided Background Removal" testId="mask-layer" defaultOpen={false}>

        <p className="text-[10px] text-ink-500 leading-snug">
          Draw a rectangle around the subject, then run. The box seeds the matte: its
          eroded core is treated as subject, the surrounding ring as background.
        </p>
        <p className="text-[10px] leading-snug text-cyan-200/80">
          {context === 'drawing'
            ? 'In Drawing mode, the matte is applied to the active paint layer.'
            : 'In OmniFrame, this creates an OmniFrame cutout object. Its matte stays separate from Drawing layers unless you apply it there.'}
        </p>

        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            data-testid="guided-rect-bg-removal-btn"
            disabled={!activeSelection?.bounds || guidedMatteBusy}
            onClick={async () => {
              if (!activeSelection?.bounds) return
              await runGuidedRectBackgroundRemoval(
                activeSelection.bounds,
                guideHint || undefined,
                context === 'drawing' ? 'drawing' : 'omniframe',
              )
            }}
            title="Run coordinate-seeded background removal from the current rectangle"
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-cyan-500/20 border border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/30 text-[11px] font-medium transition-colors disabled:opacity-40 disabled:hover:bg-cyan-500/20 truncate"
          >
            <ScanFace size={11} className="shrink-0" />
            <span className="truncate">{guidedMatteBusy ? 'Analyzing…' : 'Remove BG from Box'}</span>
          </button>

          <button
            type="button"
            data-testid="guided-hint-center-btn"
            disabled={!activeSelection?.bounds}
            onClick={() => {
              const b = activeSelection?.bounds
              if (!b) return
              setGuideHint({ x: b.x + b.width / 2, y: b.y + b.height / 2 })
            }}
            title="Mark the centre of the box as a definite subject hint"
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border text-[11px] font-medium transition-colors truncate ${
              guideHint
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200'
                : 'bg-ink-900 border-ink-800 text-ink-300 hover:bg-ink-800 hover:text-white'
            }`}
          >
            <Crosshair size={11} className="shrink-0" />
            <span className="truncate">{guideHint ? 'Hint Set' : 'Mark Subject'}</span>
          </button>
        </div>

        {guidedMatte && (
          <div className="space-y-1 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-1.5">
            <div
              data-testid="guided-matte-status"
              className="text-[10px] font-mono text-cyan-200 leading-relaxed"
              title={`coverage ${(guidedMatte.coverage * 100).toFixed(1)}% · confidence ${(guidedMatte.confidence * 100).toFixed(1)}%`}
            >
              cover {(guidedMatte.coverage * 100).toFixed(1)}% · conf{' '}
              {(guidedMatte.confidence * 100).toFixed(1)}% · {guidedMatte.iterations} iters ·{' '}
              {guidedMatte.timings.total.toFixed(0)}ms
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div className="relative rounded overflow-hidden border border-ink-800 bg-[repeating-conic-gradient(#222_0%_25%,#333_0%_50%)] bg-[length:8px_8px]">
                <img
                  data-testid="guided-matte-preview"
                  src={guidedMatte.maskDataUrl}
                  alt="Extracted matte"
                  title="Alpha matte (white = subject)"
                  className="w-full h-12 object-contain"
                />
                <span className="absolute bottom-0 left-0 right-0 text-[11px] text-center bg-black/60 text-ink-300">
                  Matte
                </span>
              </div>
              <div className="relative rounded overflow-hidden border border-ink-800 bg-[repeating-conic-gradient(#222_0%_25%,#333_0%_50%)] bg-[length:8px_8px]">
                <img
                  data-testid="guided-cutout-preview"
                  src={guidedMatte.cutoutDataUrl}
                  alt="Layered cutout"
                  title="Cutout layered non-destructively"
                  className="w-full h-12 object-contain"
                />
                <span className="absolute bottom-0 left-0 right-0 text-[11px] text-center bg-black/60 text-ink-300">
                  Cutout
                </span>
              </div>
            </div>
            <p
              role="note"
              data-testid="guided-matte-export-scope-note"
              className="text-[10px] leading-snug text-ink-400"
            >
              {guidedMatteLayer
                ? `Applied to ${guidedMatteLayer.name}; it masks that Drawing layer's strokes in preview/export.`
                : 'Editing-only matte. Apply it to a Drawing paint layer to mask its strokes in preview/export.'}
            </p>
            <button
              type="button"
              data-testid="apply-guided-matte-to-drawing-btn"
              aria-label={
                guidedMatteAppliedToActiveLayer
                  ? 'Guided matte is applied to the active Drawing layer'
                  : `Apply guided matte to ${activePaintLayer?.name || 'active Drawing layer'}`
              }
              disabled={!activePaintLayer || guidedMatteAppliedToActiveLayer || guidedMatteBusy}
              onClick={() => applyGuidedMatteToDrawingLayer()}
              title="Apply this matte to the active Drawing paint layer so it can mask that layer's strokes in preview/export."
              className="flex min-h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-1.5 text-[11px] font-medium text-cyan-100 transition-colors hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-default disabled:opacity-60"
            >
              {guidedMatteAppliedToActiveLayer ? <Check size={12} /> : <Layers size={12} />}
              <span>
                {guidedMatteAppliedToActiveLayer
                  ? 'Applied to Active Drawing Layer'
                  : `Apply Matte to ${activePaintLayer?.name || 'Drawing Layer'}`}
              </span>
            </button>
            <button
              type="button"
              data-testid="clear-guided-matte-btn"
              title="Clear the matte preview and workflow record; this does not remove masks already applied to Drawing layers or the OmniFrame cutout object"
              onClick={() => {
                clearGuidedMatte()
                setGuideHint(null)
              }}
              className="w-full py-1 rounded bg-ink-900 border border-ink-800 text-ink-300 hover:bg-ink-800 hover:text-white text-[11px] transition-colors"
            >
              Clear Guided Matte
            </button>
          </div>
        )}
      </PanelSection>

      {/* 6. Convert Selection to OmniFrame Object */}
      <div className="pt-1 border-t border-ink-800/80">
        <button
          type="button"
          data-testid="convert-to-omniframe-obj-btn"
          onClick={() => convertSelectionToOmniframeObject()}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-brand/20 border border-brand/50 text-brand-400 font-medium hover:bg-brand/30 hover:text-white text-xs transition-colors"
          title="Extract active selection into an interactive OmniFrame object with clean background infill"
        >
          <Scissors size={13} className="shrink-0" />
          <span>Convert to OmniFrame Object (Clean Infill)</span>
        </button>
      </div>
    </div>
  )
}
