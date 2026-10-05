import React, { useState } from 'react'
import {
  LibraryBig,
  Palette,
  Type,
  Bone,
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
  LayoutGrid,
  List,
} from 'lucide-react'
import { useEditor, type LeftTab } from '../store'
import { SectionsNavigator } from './SectionsNav'
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
import Rigging from './Rigging'

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
  { id: 'rigging', label: 'Rigging', icon: Bone, category: '2d', desc: 'Bones, Pivots & Puppet Pins' },

  // 3. 3D SCENE & COMPOSITING (Blender / After Effects 3D)
  { id: 'threed', label: '3D Scene', icon: Box, category: '3d', desc: '3D Viewport, Materials & Camera' },
]

export function LeftDock() {
  const leftTab = useEditor((s) => s.leftTab)
  const leftOpen = useEditor((s) => s.leftOpen)
  const setLeftTab = useEditor((s) => s.setLeftTab)
  const setLeftOpen = useEditor((s) => s.setLeftOpen)
  const leftDockWidth = useEditor((s) => s.leftDockWidth)
  const setLeftDockWidth = useEditor((s) => s.setLeftDockWidth)
  const sidebarSectionMode = useEditor((s) => s.sidebarSectionMode)
  const setSidebarSectionMode = useEditor((s) => s.setSidebarSectionMode)
  // Width-drag state: suppress the width transition while the user slides the edge.
  const [dockResizing, setDockResizing] = useState(false)
  const dockDrag = React.useRef<{ startX: number; startW: number } | null>(null)
  const onDockResizeDown = (e: React.PointerEvent) => {
    dockDrag.current = { startX: e.clientX, startW: leftDockWidth }
    setDockResizing(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onDockResizeMove = (e: React.PointerEvent) => {
    const d = dockDrag.current
    if (d) setLeftDockWidth(d.startW + (e.clientX - d.startX))
  }
  const onDockResizeUp = (e: React.PointerEvent) => {
    dockDrag.current = null
    setDockResizing(false)
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // pointer already released
    }
  }
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
          <div role="group" aria-label="Tool categories" data-testid="category-filters" className="flex flex-col gap-0.5 w-full">
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
                aria-label={
                  cat === 'all'
                    ? 'Show all tool categories'
                    : cat === 'video'
                    ? 'Show video tools'
                    : cat === '2d'
                    ? 'Show 2D tools'
                    : 'Show 3D tools'
                }
                aria-pressed={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
                className={`min-h-[28px] min-w-[28px] py-1 px-0.5 rounded text-[10px] font-mono font-bold uppercase transition-colors text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
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
        <div
          role="group"
          aria-label={`${activeCategory === 'all' ? 'All' : activeCategory === 'video' ? 'Video' : activeCategory === '2d' ? '2D' : '3D'} tool panels`}
          className="flex flex-col items-center gap-1 w-full px-1"
        >
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
            <span className="text-[7px] font-mono font-bold text-brand-400 uppercase tracking-tight">
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
                    <Sparkles size={14} className={isSubActive ? 'text-brand-400 animate-pulse' : 'text-amber-400'} />
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
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-ink-800 hover:bg-red-500 text-ink-300 hover:text-white hidden group-hover:grid place-items-center text-[10px] transition-colors border border-ink-700 shadow-xs"
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
        id="left-panel"
        data-testid="left-panel"
        data-open={leftOpen}
        style={{
          width: leftOpen
            ? `${Math.min(leftDockWidth - 48, typeof window !== 'undefined' && window.innerWidth < 640 ? window.innerWidth - 56 : leftDockWidth - 48)}px`
            : '0px',
        }}
        className={`shrink-0 bg-ink-850 border-r border-ink-700/80 overflow-hidden transition-[width] duration-150 max-sm:absolute max-sm:left-12 max-sm:top-0 max-sm:bottom-0 max-sm:z-40 max-sm:shadow-2xl ${dockResizing ? 'transition-none' : ''}`}
      >
        <div
          style={{
            width: `${Math.min(leftDockWidth - 48, typeof window !== 'undefined' && window.innerWidth < 640 ? window.innerWidth - 56 : leftDockWidth - 48)}px`,
          }}
          className="h-full flex flex-col relative"
        >
          {/* Width drag handle: slide the panel edge to resize */}
          {leftOpen && (
            <div
              data-testid="left-panel-resize-handle"
              role="separator"
              aria-label="Resize media panel width"
              aria-orientation="vertical"
              onPointerDown={onDockResizeDown}
              onPointerMove={onDockResizeMove}
              onPointerUp={onDockResizeUp}
              onPointerCancel={onDockResizeUp}
              title="Drag to resize panel"
              className="absolute right-0 top-0 bottom-0 w-1.5 z-30 cursor-col-resize bg-transparent hover:bg-brand/60 transition-colors touch-none"
            />
          )}
          {/* Header & Sub-Mode Channel Navigation */}
          <div className="h-8.5 shrink-0 flex items-center justify-between px-2.5 border-b border-ink-700/80 bg-ink-900/60">
            {activeSubMode && currentSubMode ? (
              <div className="flex items-center gap-1 min-w-0 pr-2">
                <button
                  type="button"
                  data-testid="submode-back-btn"
                  onClick={closeSubMode}
                  className="flex items-center gap-0.5 text-[11px] text-brand-400 hover:text-white font-medium transition-colors shrink-0"
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

            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                data-testid="sidebar-section-mode-btn"
                title={
                  sidebarSectionMode === 'tabs'
                    ? 'Section style: Tabs — switch to single-open Accordion'
                    : 'Section style: Accordion — switch to Tabs'
                }
                aria-label={
                  sidebarSectionMode === 'tabs'
                    ? 'Section style Tabs. Activate to use single-open accordion sections.'
                    : 'Section style Accordion. Activate to use tabbed sections.'
                }
                aria-pressed={sidebarSectionMode === 'tabs'}
                onClick={() => setSidebarSectionMode(sidebarSectionMode === 'tabs' ? 'accordion' : 'tabs')}
                className={`grid place-items-center h-6.5 w-6.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  sidebarSectionMode === 'tabs' ? 'text-brand-400 hover:text-white hover:bg-ink-750' : 'text-ink-400 hover:text-white hover:bg-ink-750'
                }`}
              >
                {sidebarSectionMode === 'tabs' ? <LayoutGrid size={13} /> : <List size={13} />}
              </button>
              <button
                type="button"
                title="Collapse"
                aria-label="Collapse panel"
                onClick={() => setLeftOpen(false)}
                className="grid place-items-center h-6.5 w-6.5 rounded text-ink-400 hover:text-white hover:bg-ink-750 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Panel Views — SectionsNavigator presents the panel's sections as
              tabs (default) or a single-open accordion, per the header toggle */}
          <SectionsNavigator mode={sidebarSectionMode} label={`${activeTabDef?.label ?? 'Panel'} sections`}>
            <div tabIndex={0} aria-label="Panel contents, scrollable" className="flex-1 min-h-0 overflow-y-auto">
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
              {leftTab === 'rigging' && <Rigging />}
            </div>
          </SectionsNavigator>
        </div>
      </div>
    </div>
  )
}
