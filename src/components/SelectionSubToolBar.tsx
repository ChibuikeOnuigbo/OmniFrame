import React from 'react'
import { SlideDock } from './SlideDock'
import {
  Square,
  Circle,
  Lasso,
  Spline,
  Paintbrush,
  Wand2,
  FlipHorizontal,
  PaintBucket,
  Eye,
  Layers,
  Scissors,
  X,
} from 'lucide-react'
import { useEditor } from '../store'
import type { SelectionModeType } from '../types'
import { Tooltip } from './Tooltip'

export function SelectionSubToolBar() {
  const leftTab = useEditor((s) => s.leftTab)
  const leftOpen = useEditor((s) => s.leftOpen)
  const activeSelection = useEditor((s) => s.activeSelection)
  const selectionMode = useEditor((s) => s.selectionMode)
  const setSelectionMode = useEditor((s) => s.setSelectionMode)
  const invertSelection = useEditor((s) => s.invertSelection)
  const recolorActiveSelection = useEditor((s) => s.recolorActiveSelection)
  const toggleSelectionMaskView = useEditor((s) => s.toggleSelectionMaskView)
  const convertSelectionToOmniframeObject = useEditor((s) => s.convertSelectionToOmniframeObject)
  const clearSelection = useEditor((s) => s.clearSelection)

  // Only render if in OmniFrame mode or if an active selection exists
  const isVisible = (leftTab === 'omniframe' && leftOpen) || activeSelection !== null
  if (!isVisible) return null

  const selectionTypes: { id: SelectionModeType; label: string; icon: React.ElementType }[] = [
    { id: 'rect', label: 'Rectangle (Marquee)', icon: Square },
    { id: 'ellipse', label: 'Ellipse / Circle', icon: Circle },
    { id: 'freeform', label: 'Freeform Lasso', icon: Lasso },
    { id: 'polygon', label: 'Polygon Points', icon: Spline },
    { id: 'painting', label: 'Painting Brush Selection', icon: Paintbrush },
    { id: 'magic-wand', label: 'Magic Wand / Color Range', icon: Wand2 },
  ]

  return (
    <SlideDock id="selection-toolbar" label="selection tools" direction="down"
      className={`absolute z-30 bottom-3 top-auto left-1/2 -translate-x-1/2 ${leftOpen ? 'max-sm:hidden' : ''}`}
    >
    <div
      data-testid="selection-floating-toolbar"
      role="group"
      aria-label="Selection tools"
      className="flex min-w-0 w-auto max-w-[calc(100vw_-_4rem)] items-center gap-1 rounded-xl border border-ink-700/80 bg-ink-900/95 px-2 py-1.5 text-xs text-ink-200 shadow-2xl backdrop-blur-md select-none animate-in fade-in zoom-in-95 duration-150 overflow-x-auto scrollbar-none"
    >
      <div role="group" aria-label="Selection mode" className="flex items-center gap-0.5 border-r border-ink-800 pr-1 shrink-0">
        <span className="text-[10px] font-mono uppercase font-bold text-brand-400 px-1 py-0.5">
          MASK
        </span>
      </div>

      {/* 6 Selection Mode Buttons */}
      <div role="group" aria-label="Selection shape" className="flex items-center gap-0.5 border-r border-ink-800 pr-1.5 shrink-0">
        {selectionTypes.map((st) => {
          const Icon = st.icon
          const isActive = selectionMode === st.id
          return (
            <button
              key={st.id}
              type="button"
              data-testid={`floating-sel-${st.id}`}
              title={st.label}
              aria-label={st.label}
              aria-pressed={isActive}
              onClick={() => setSelectionMode(st.id)}
              className={`min-h-8 min-w-8 rounded-lg p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                isActive
                  ? 'bg-brand text-white shadow-xs'
                  : 'text-ink-300 hover:text-white hover:bg-ink-800'
              }`}
            >
              <Icon size={14} />
            </button>
          )
        })}
      </div>

      {/* Quick Action Tools */}
      <div role="group" aria-label="Selection actions" className="flex items-center gap-0.5 border-r border-ink-800 pr-1.5 shrink-0">
        <Tooltip label="Invert selection boundary">
<button
          type="button"
          data-testid="floating-invert-btn"
          title="Invert Selection Boundary"
          aria-label="Invert Selection"
          onClick={invertSelection}
          className="min-h-8 min-w-8 rounded-lg p-1.5 text-ink-300 transition-colors hover:bg-ink-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <FlipHorizontal size={14} />
        </button></Tooltip>

        <button
          type="button"
          data-testid="floating-recolor-blue-btn"
          title="Colorize: Royal Blue (Towel / Seat / Object)"
          aria-label="Recolor Blue"
          onClick={() => recolorActiveSelection('#2563eb')}
          className="min-h-8 min-w-8 rounded-lg p-1.5 text-blue-400 transition-colors hover:bg-blue-500/20 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <PaintBucket size={14} />
        </button>

        <button
          type="button"
          data-testid="floating-recolor-red-btn"
          title="Colorize: Apple Crimson Red"
          aria-label="Recolor Red"
          onClick={() => recolorActiveSelection('#dc2626')}
          className="min-h-8 min-w-8 rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <PaintBucket size={14} />
        </button>

        <button
          type="button"
          data-testid="floating-toggle-mask-btn"
          aria-pressed={!!activeSelection?.showMaskOnly}
          title={activeSelection?.showMaskOnly ? 'Hide Mask Layer' : 'Show Mask Layer'}
          aria-label="Show Mask"
          onClick={() => toggleSelectionMaskView()}
          className={`min-h-8 min-w-8 rounded-lg p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            activeSelection?.showMaskOnly
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'text-ink-300 hover:text-white hover:bg-ink-800'
          }`}
        >
          <Eye size={14} />
        </button>
      </div>

      {/* Convert to OmniFrame Object & Clear */}
      <div className="flex items-center gap-0.5 shrink-0">
        <Tooltip label="Convert selection to a movable OmniFrame object (clean inpainting)">
<button
          type="button"
          data-testid="floating-convert-omniframe-btn"
          title="Convert selection to movable OmniFrame Object with clean inpainting"
          aria-label="Convert to OmniFrame Object"
          onClick={() => convertSelectionToOmniframeObject()}
          className="flex min-h-8 min-w-8 items-center gap-1 rounded-lg border border-brand/40 bg-brand/20 px-2 py-1 text-[11px] font-medium text-brand-400 transition-colors hover:bg-brand/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Scissors size={12} />
          <span className="hidden sm:inline">To Object</span>
        </button></Tooltip>

        {activeSelection && (
          <button
            type="button"
            data-testid="floating-clear-btn"
            title="Clear Selection"
            aria-label="Clear Selection"
            onClick={clearSelection}
            className="min-h-8 min-w-8 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-red-500/20 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
    </SlideDock>
  )
}
