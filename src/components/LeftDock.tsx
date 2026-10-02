import React from 'react'
import {
  LibraryBig,
  Palette,
  Type,
  Wand2,
  Shuffle,
  Box,
  Volume2,
  Target,
  Link2,
  X,
  Scissors,
  ChevronLeft,
  Sparkles,
  Layers,
  Camera,
  Paintbrush,
  type LucideIcon,
} from 'lucide-react'
import { useEditor, type LeftTab } from '../store'
import { MediaPanel } from './MediaPanel'
import { OmniFramePanel } from './OmniFramePanel'
import { VoiceIsolationPanel } from './VoiceIsolationPanel'
import { DrawingPanel } from './DrawingPanel'
import { TrackingPanel } from './TrackingPanel'
import { LinkPanel } from './LinkPanel'
import { TransitionsPanel } from './TransitionsPanel'
import { EffectsPanel } from './EffectsPanel'
import { TextPanel } from './TextPanel'
import { ThreePanel } from './ThreePanel'

export type ToolCategory = 'video' | '2d' | '3d'

interface TabDef {
  id: LeftTab
  label: string
  icon: LucideIcon
  category: ToolCategory
  desc: string
}

const TABS: TabDef[] = [
  // 1. VIDEO EDITING TOOLS (Premiere Pro / CapCut Style)
  { id: 'media', label: 'Media Library', icon: LibraryBig, category: 'video', desc: 'Assets & Media Import' },
  { id: 'text', label: 'Text & Titles', icon: Type, category: 'video', desc: 'Typography, Captions & Subtitles' },
  { id: 'transitions', label: 'Transitions', icon: Shuffle, category: 'video', desc: 'Dissolves, Wipes & Light Leaks' },
  { id: 'effects', label: 'Effects', icon: Wand2, category: 'video', desc: 'Color Grading, Lumetri & Filters' },
  { id: 'audio', label: 'Audio', icon: Volume2, category: 'video', desc: 'Vocal Isolation & Stems' },
  { id: 'relationships', label: 'Link & Groups', icon: Link2, category: 'video', desc: 'Parenting & Ripple Groups' },

  // 2. 2D CREATIVE & PAINT (Photoshop / Krita / LumaCut Style)
  { id: 'drawing', label: 'Drawing & Paint', icon: Palette, category: '2d', desc: 'Raster/Vector Brushes & Onion Skin' },
  { id: 'omniframe', label: 'OmniFrame Mask', icon: Scissors, category: '2d', desc: 'Segmentation & Clean Infill' },
  { id: 'tracking', label: 'Masking & Tracking', icon: Target, category: '2d', desc: 'Lucas-Kanade Tracking & Mattes' },

  // 3. 3D SCENE & COMPOSITING (Blender / After Effects 3D)
  { id: 'threed', label: '3D Scene', icon: Box, category: '3d', desc: '3D Viewport, Materials & Camera' },
]

export function LeftDock() {
  const leftTab = useEditor((s) => s.leftTab)
  const leftOpen = useEditor((s) => s.leftOpen)
  const setLeftTab = useEditor((s) => s.setLeftTab)
  const setLeftOpen = useEditor((s) => s.setLeftOpen)
  const leftDockWidth = useEditor((s) => s.leftDockWidth)
  const activeCategory = useEditor((s) => s.activeCategory)
  const setActiveCategory = useEditor((s) => s.setActiveCategory)
  const activeSubMode = useEditor((s) => s.activeSubMode)
  const closeSubMode = useEditor((s) => s.closeSubMode)
  const contextualSubModes = useEditor((s) => s.contextualSubModes)
  const openSubMode = useEditor((s) => s.openSubMode)

  const filteredTabs = TABS.filter((t) => activeCategory === 'all' || t.category === activeCategory)
  const activeTabDef = TABS.find((t) => t.id === leftTab)
  const currentSubMode = contextualSubModes.find((m) => m.id === activeSubMode)

  return (
    <div className="flex shrink-0 h-full select-none">
      {/* Icon Rail */}
      <div className="w-12 shrink-0 bg-ink-900 border-r border-ink-700/80 flex flex-col items-center py-1.5 gap-1 overflow-y-auto scrollbar-none">
        {/* Category Filters: Reduces UI level across Video, 2D, 3D */}
        <div className="flex flex-col items-center gap-0.5 pb-1 mb-0.5 border-b border-ink-800 w-full px-1">
          <div className="grid grid-cols-2 gap-0.5 w-full">
            {(['all', 'video', '2d', '3d'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                data-testid={`category-filter-${cat}`}
                title={
                  cat === 'all'
                    ? 'All Tools'
                    : cat === 'video'
                    ? 'Video Editing Tools (Premiere/CapCut)'
                    : cat === '2d'
                    ? '2D Creative & Paint Tools (Photoshop/Krita)'
                    : '3D Scene Tools (Blender)'
                }
                onClick={() => setActiveCategory(cat)}
                className={`min-h-[24px] min-w-[24px] py-1 px-0.5 rounded text-[8px] font-mono font-bold uppercase transition-colors text-center ${
                  activeCategory === cat
                    ? 'bg-brand text-white shadow-xs'
                    : 'bg-ink-950/60 text-ink-400 hover:text-ink-200 hover:bg-ink-800'
                }`}
              >
                {cat === 'video' ? 'VID' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Primary Tool Icons */}
        <div className="flex flex-col items-center gap-1 w-full px-1">
          {filteredTabs.map((t) => {
            const Icon = t.icon
            const active = leftTab === t.id && leftOpen
            return (
              <button
                key={t.id}
                type="button"
                data-testid={`left-tab-${t.id}`}
                title={`${t.label} — ${t.desc}`}
                aria-label={t.label}
                aria-pressed={active}
                onClick={() => {
                  if (leftTab === t.id && leftOpen) {
                    setLeftOpen(false)
                  } else {
                    setLeftTab(t.id)
                    setLeftOpen(true)
                  }
                }}
                className={`grid place-items-center h-8.5 w-8.5 rounded-lg transition-all shrink-0 ${
                  active
                    ? 'bg-brand text-white shadow-md shadow-brand/30 ring-1 ring-brand-400'
                    : 'text-ink-400 hover:text-white hover:bg-ink-800'
                }`}
              >
                <Icon size={17} />
              </button>
            )
          })}
        </div>

        {/* Temporary Contextual Sub-Mode Rail Icons */}
        {contextualSubModes.length > 0 && (
          <div className="flex flex-col items-center gap-1 w-full pt-1.5 mt-1 border-t border-ink-800/80 px-1">
            <span className="text-[7px] font-mono font-bold text-brand uppercase tracking-tight">
              SUB
            </span>
            {contextualSubModes.map((sub) => {
              const isSubActive = activeSubMode === sub.id && leftOpen
              return (
                <div key={sub.id} className="relative group shrink-0">
                  <button
                    type="button"
                    data-testid={`temp-sub-icon-${sub.id}`}
                    title={`Focused Sub-Mode: ${sub.label}`}
                    aria-label={sub.label}
                    onClick={() => {
                      openSubMode(sub.parentTab, sub.id, sub.label, sub.icon)
                    }}
                    className={`grid place-items-center h-8 w-8 rounded-lg border transition-all ${
                      isSubActive
                        ? 'bg-brand/25 border-brand text-white shadow-sm ring-1 ring-brand'
                        : 'bg-ink-950 border-ink-800 text-ink-300 hover:text-white hover:border-ink-700'
                    }`}
                  >
                    <Sparkles size={14} className={isSubActive ? 'text-brand animate-pulse' : 'text-amber-400'} />
                  </button>
                  <button
                    type="button"
                    data-testid={`close-sub-icon-${sub.id}`}
                    title="Dismiss temporary sub-mode icon"
                    aria-label="Dismiss sub-mode"
                    onClick={(e) => {
                      e.stopPropagation()
                      useEditor.setState((s) => ({
                        contextualSubModes: s.contextualSubModes.filter((m) => m.id !== sub.id),
                        activeSubMode: s.activeSubMode === sub.id ? null : s.activeSubMode,
                      }))
                    }}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-ink-800 hover:bg-red-500 text-ink-300 hover:text-white hidden group-hover:grid place-items-center text-[8px] transition-colors border border-ink-700 shadow-xs"
                  >
                    <X size={8} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Expandable Content Panel */}
      <div
        data-testid="left-panel"
        data-open={leftOpen}
        style={{
          width: leftOpen
            ? `${Math.min(leftDockWidth - 48, typeof window !== 'undefined' && window.innerWidth < 640 ? window.innerWidth - 56 : leftDockWidth - 48)}px`
            : '0px',
        }}
        className="shrink-0 bg-ink-850 border-r border-ink-700/80 overflow-hidden transition-[width] duration-150 max-sm:absolute max-sm:left-12 max-sm:top-0 max-sm:bottom-0 max-sm:z-40 max-sm:shadow-2xl"
      >
        <div
          style={{
            width: `${Math.min(leftDockWidth - 48, typeof window !== 'undefined' && window.innerWidth < 640 ? window.innerWidth - 56 : leftDockWidth - 48)}px`,
          }}
          className="h-full flex flex-col"
        >
          {/* Header & Sub-Mode Channel Navigation */}
          <div className="h-8.5 shrink-0 flex items-center justify-between px-2.5 border-b border-ink-700/80 bg-ink-900/60">
            {activeSubMode && currentSubMode ? (
              <div className="flex items-center gap-1 min-w-0 pr-2">
                <button
                  type="button"
                  data-testid="submode-back-btn"
                  onClick={closeSubMode}
                  className="flex items-center gap-0.5 text-[11px] text-brand hover:text-white font-medium transition-colors shrink-0"
                  title="Return to main section overview"
                >
                  <ChevronLeft size={14} />
                  <span>Back</span>
                </button>
                <span className="text-ink-600">/</span>
                <span
                  data-testid="submode-focused-title"
                  className="text-xs font-semibold text-ink-100 truncate"
                  title={currentSubMode.label}
                >
                  {currentSubMode.label}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0 pr-2">
                <span
                  className="text-xs font-semibold uppercase tracking-wider text-ink-200 truncate"
                  title={activeTabDef?.label}
                >
                  {activeTabDef?.label}
                </span>
                <span className="text-[9px] px-1 py-0.2 rounded font-mono uppercase bg-ink-800 text-ink-400 shrink-0">
                  {activeTabDef?.category === 'video' ? 'Video NLE' : activeTabDef?.category === '2d' ? '2D Paint' : '3D'}
                </span>
              </div>
            )}

            <button
              type="button"
              title="Collapse"
              aria-label="Collapse panel"
              onClick={() => setLeftOpen(false)}
              className="grid place-items-center h-6.5 w-6.5 rounded text-ink-400 hover:text-white hover:bg-ink-750 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Panel Views */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {leftTab === 'media' && <MediaPanel />}
            {leftTab === 'omniframe' && <OmniFramePanel />}
            {leftTab === 'audio' && <VoiceIsolationPanel />}
            {leftTab === 'tracking' && <TrackingPanel />}
            {leftTab === 'relationships' && <LinkPanel />}
            {leftTab === 'drawing' && <DrawingPanel />}
            {leftTab === 'transitions' && <TransitionsPanel />}
            {leftTab === 'effects' && <EffectsPanel />}
            {leftTab === 'text' && <TextPanel />}
            {leftTab === 'threed' && <ThreePanel />}
          </div>
        </div>
      </div>
    </div>
  )
}
