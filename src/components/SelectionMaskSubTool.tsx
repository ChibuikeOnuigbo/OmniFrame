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

const PRESET_COLORS = [
  { id: 'blue', label: 'Towel Royal Blue', hex: '#2563eb' },
  { id: 'red', label: 'Crimson / Apple Red', hex: '#dc2626' },
  { id: 'amber', label: 'Golden Amber', hex: '#d97706' },
  { id: 'green', label: 'Emerald Green', hex: '#059669' },
  { id: 'purple', label: 'Royal Purple', hex: '#7c3aed' },
  { id: 'burgundy', label: 'Leather Burgundy', hex: '#831843' },
]

interface SelectionMaskSubToolProps {
  onOpenBgModal?: () => void
  compact?: boolean
}

export function SelectionMaskSubTool({ onOpenBgModal, compact = false }: SelectionMaskSubToolProps) {
  const activeSelection = useEditor((s) => s.activeSelection)
  const guidedMatte = useEditor((s) => s.guidedMatte)
  const guidedMatteBusy = useEditor((s) => s.guidedMatteBusy)
  const runGuidedRectBackgroundRemoval = useEditor((s) => s.runGuidedRectBackgroundRemoval)
  const clearGuidedMatte = useEditor((s) => s.clearGuidedMatte)
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
          <span className="text-[10px] px-1.5 py-0.2 rounded font-mono uppercase bg-brand/15 text-brand-400 border border-brand/30">
            LumaCut Mask Engine
          </span>
        </div>
      </div>

      {/* 1. Selection Types */}
      <div className="space-y-1">
        <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
          Selection Types
        </div>
        <div className="grid grid-cols-6 gap-1">
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
                onClick={() => setSelectionMode(st.id)}
                className={`flex flex-col items-center justify-center p-1.5 rounded-lg border transition-all text-center ${
                  isActive
                    ? 'bg-brand text-white border-brand shadow-xs'
                    : 'bg-ink-900 border-ink-800 text-ink-300 hover:text-white hover:bg-ink-800'
                }`}
              >
                <Icon size={14} className="shrink-0" />
                <span className="text-[9px] mt-0.5 truncate max-w-full font-mono capitalize">
                  {st.id === 'magic-wand' ? 'Wand' : st.id === 'freeform' ? 'Lasso' : st.id}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Detected Object Quick-Select (Towel, Chair, Light, etc.) */}
      {omniframeCharacters.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
            <span>Detected Object Selectors</span>
            <span className="text-[9px] text-ink-500 font-normal">Click to isolate</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {omniframeCharacters.map((char) => {
              const isSelected = selectedCharacterId === char.id
              return (
                <button
                  key={char.id}
                  type="button"
                  data-testid={`quick-select-${char.id}`}
                  onClick={() => handleSelectObjectPreset(char.id)}
                  title={`Select ${char.name}`}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium border transition-all truncate max-w-[170px] ${
                    isSelected
                      ? 'bg-brand/20 border-brand text-white shadow-xs'
                      : 'bg-ink-900 border-ink-800 text-ink-300 hover:bg-ink-850 hover:text-white'
                  }`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: char.recolorColor || '#a855f7' }}
                  />
                  <span className="truncate">{char.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 3. Sub-Tool Actions: Invert, Feather, Grow, Shrink */}
      <div className="space-y-1 pt-1 border-t border-ink-800/80">
        <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
          Boundary & Inversion Tools
        </div>
        <div className="grid grid-cols-4 gap-1">
          <button
            type="button"
            data-testid="subtool-invert-btn"
            title="Invert Selection boundary (outside vs inside)"
            aria-label="Invert Selection"
            onClick={invertSelection}
            className="flex items-center justify-center gap-1 py-1 px-1 rounded-lg bg-ink-900 border border-ink-800 hover:bg-ink-800 hover:text-white text-ink-300 transition-colors text-[10px]"
          >
            <FlipHorizontal size={11} />
            <span>Invert</span>
          </button>
          <button
            type="button"
            data-testid="subtool-grow-btn"
            title="Grow Selection boundary by 8px"
            aria-label="Grow Selection"
            onClick={() => growSelection(8)}
            className="flex items-center justify-center gap-1 py-1 px-1 rounded-lg bg-ink-900 border border-ink-800 hover:bg-ink-800 hover:text-white text-ink-300 transition-colors text-[10px]"
          >
            <Expand size={11} />
            <span>Grow</span>
          </button>
          <button
            type="button"
            data-testid="subtool-shrink-btn"
            title="Shrink Selection boundary by 8px"
            aria-label="Shrink Selection"
            onClick={() => shrinkSelection(8)}
            className="flex items-center justify-center gap-1 py-1 px-1 rounded-lg bg-ink-900 border border-ink-800 hover:bg-ink-800 hover:text-white text-ink-300 transition-colors text-[10px]"
          >
            <Shrink size={11} />
            <span>Shrink</span>
          </button>
          <button
            type="button"
            data-testid="subtool-clear-btn"
            title="Clear Active Selection"
            aria-label="Clear Selection"
            onClick={clearSelection}
            className="flex items-center justify-center gap-1 py-1 px-1 rounded-lg bg-ink-900 border border-ink-800 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-300 text-ink-300 transition-colors text-[10px]"
          >
            <X size={11} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* 4. Fill & Recolor Tool (Changing color of towel, chair seat, apple, shapes) */}
      <div className="space-y-1.5 pt-1 border-t border-ink-800/80">
        <div className="flex items-center justify-between text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
          <div className="flex items-center gap-1">
            <PaintBucket size={11} className="text-amber-400" />
            <span>Fill / Recolor Tool</span>
          </div>
          <label className="flex items-center gap-1 min-h-[24px] text-[9px] text-ink-400 cursor-pointer">
            <input
              type="checkbox"
              data-testid="preserve-luminance-toggle"
              aria-label="Preserve luminance"
              checked={preserveLuminance}
              onChange={(e) => setPreserveLuminance(e.target.checked)}
              className="w-4 h-4 rounded border-ink-700 bg-ink-800 text-brand-400"
            />
            <span>Keep Texture/Shading</span>
          </label>
        </div>

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
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-[10px] transition-colors shadow-xs"
              title="Apply recolor to selected area or active object"
            >
              <PaintBucket size={11} />
              <span>Colorize</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. Non-Destructive Background Removal (Show Mask vs Cutout) */}
      <div className="space-y-1.5 pt-1 border-t border-ink-800/80">
        <div className="flex items-center justify-between text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
          <div className="flex items-center gap-1">
            <Eye size={11} className="text-emerald-400" />
            <span>Non-Destructive Mask Layer (LumaCut Mode)</span>
          </div>
          <span className="text-[9px] text-ink-500 font-mono">Non-Destructive</span>
        </div>

        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            data-testid="mask-mode-rubylith-btn"
            onClick={() => setSelectionMaskDisplayMode('rubylith')}
            className={`py-1 px-1 rounded text-[10px] border transition-colors ${
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
            onClick={() => setSelectionMaskDisplayMode('matte')}
            className={`py-1 px-1 rounded text-[10px] border transition-colors ${
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
            onClick={() => setSelectionMaskDisplayMode('cutout')}
            className={`py-1 px-1 rounded text-[10px] border transition-colors ${
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
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[10px] font-medium transition-all ${
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
            onClick={() => convertSelectionToMask()}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-ink-900 border border-ink-800 text-ink-200 hover:bg-ink-800 hover:text-white text-[10px] font-medium transition-colors"
            title="Convert selection boundary into permanent non-destructive mask layer"
          >
            <Layers size={12} className="shrink-0" />
            <span>Create Mask Layer</span>
          </button>
        </div>
      </div>

      {/* 5b. Guided Rect Background Removal — draw a box, click remove, get a mask layer */}
      <div className="space-y-1.5 pt-1 border-t border-ink-800/80">
        <div className="flex items-center justify-between text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
          <div className="flex items-center gap-1">
            <ScanFace size={11} className="text-cyan-400" />
            <span>Guided Rect BG Removal</span>
          </div>
          <span className="text-[9px] text-ink-500 font-mono">Coordinate-Seeded</span>
        </div>

        <p className="text-[9px] text-ink-500 leading-snug">
          Draw a rectangle around the subject, then run. The box seeds the matte: its
          eroded core is treated as subject, the surrounding ring as background.
        </p>

        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            data-testid="guided-rect-bg-removal-btn"
            disabled={!activeSelection?.bounds || guidedMatteBusy}
            onClick={async () => {
              if (!activeSelection?.bounds) return
              await runGuidedRectBackgroundRemoval(activeSelection.bounds, guideHint || undefined)
            }}
            title="Run coordinate-seeded background removal from the current rectangle"
            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-cyan-500/20 border border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/30 text-[10px] font-medium transition-colors disabled:opacity-40 disabled:hover:bg-cyan-500/20 truncate"
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
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border text-[10px] font-medium transition-colors truncate ${
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
              className="text-[9px] font-mono text-cyan-200 leading-relaxed"
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
                <span className="absolute bottom-0 left-0 right-0 text-[10px] text-center bg-black/60 text-ink-300">
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
                <span className="absolute bottom-0 left-0 right-0 text-[10px] text-center bg-black/60 text-ink-300">
                  Cutout
                </span>
              </div>
            </div>
            <button
              type="button"
              data-testid="clear-guided-matte-btn"
              onClick={() => {
                clearGuidedMatte()
                setGuideHint(null)
              }}
              className="w-full py-1 rounded bg-ink-900 border border-ink-800 text-ink-300 hover:bg-ink-800 hover:text-white text-[10px] transition-colors"
            >
              Clear Guided Matte
            </button>
          </div>
        )}
      </div>

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
