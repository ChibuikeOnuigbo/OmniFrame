import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import {
  AppWindow,
  Clapperboard,
  LibraryBig,
  Palette,
  Scan,
  ChevronDown,
  Type,
  Bone,
  Shuffle,
  Box,
  Volume2,
  Target,
  Link2,
  X,
  Scissors,
  ChevronLeft,
  Replace,
  BoxSelect,
  History,
  Move,
  PaintBucket,
  Shapes,
  Stamp,
  Layers,
  Camera,
  Paintbrush,
  SlidersHorizontal,
  type LucideIcon,
  LayoutGrid,
  List,
  PictureInPicture2,
  PanelLeft,
  Search, Maximize2, Minimize2, CircleHelp } from 'lucide-react'
const SUB_ICON_BY_NAME: Record<string, LucideIcon> = {
  BoxSelect, History, Layers, Move, PaintBucket, Paintbrush, Shapes, Stamp, Type, LibraryBig,
}

import { useEditor, type LeftTab } from '../store'
import { FloatingWindow } from './FloatingWindow'
import { SectionsNavigator } from './SectionsNav'
import { Tooltip } from './Tooltip'
import { MediaPanel } from './MediaPanel'
import { OmniFramePanel } from './OmniFramePanel'
import { DesktopPackPanel } from './DesktopPackPanel'
import { StoryboardPanel } from './StoryboardPanel'
const VoiceIsolationPanel = lazy(() => import('./VoiceIsolationPanel').then((m) => ({ default: m.VoiceIsolationPanel })))
const DrawingPanel = lazy(() => import('./DrawingPanel').then((m) => ({ default: m.DrawingPanel })))
import { TrackingPanel } from './TrackingPanel'
import { LinkPanel } from './LinkPanel'
import { TransitionsPanel } from './TransitionsPanel'
import { EffectsPanel } from './EffectsPanel'
import { TextPanel } from './TextPanel'
const ThreePanel = lazy(() => import('./ThreePanel').then((m) => ({ default: m.ThreePanel })))
const Rigging = lazy(() => import('./Rigging'))

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
  { id: 'media', label: 'Media Library', icon: LibraryBig, category: 'video', desc: 'Import video, audio & images; ORA raster layers, PSD RGB/8-bit subset & KRA merged still (no Procreate)' },
  { id: 'text', label: 'Text & Titles', icon: Type, category: 'video', desc: 'Typography, Captions & Subtitles' },
  { id: 'transitions', label: 'Transitions', icon: Shuffle, category: 'video', desc: 'Dissolves, Wipes & Light Leaks' },
  { id: 'effects', label: 'Effects', icon: SlidersHorizontal, category: 'video', desc: 'Effect catalog (drag onto clips — all properties editable + keyframeable), LUT looks, adjustment layers & masks' },
  { id: 'audio', label: 'Audio', icon: Volume2, category: 'video', desc: 'Voice isolation, music split, mic recording, EQ/reverb, pitch/tempo, four stems & vocal patching' },
  { id: 'relationships', label: 'Link & Groups', icon: Link2, category: 'video', desc: 'Parenting & Ripple Groups' },
  { id: 'pack', label: 'Desktop Pack', icon: AppWindow, category: 'video', desc: 'Screen-life pack: fake macOS/Windows desktops, Chrome & Safari bars, cursor assets, overlay frames, edit presets & quick 3D' },
  { id: 'storyboard', label: 'Storyboard', icon: Clapperboard, category: 'video', desc: 'Plan shots in order: thumbnails, duration, track and shot notes; plan the plan, not the clips' },

  // 2. 2D CREATIVE & PAINT (Photoshop / Krita / LumaCut Style)
  { id: 'drawing', label: 'Drawing & Paint', icon: Palette, category: '2d', desc: 'Raster/Vector Brushes, Smart Patch donor/target clone across frames with OmniFrame scope sync & Onion Skin' },
  { id: 'omniframe', label: 'OmniFrame', icon: Scissors, category: '2d', desc: 'Frame-scope tool: apply edits to the whole frame or a selected region — drag, resize, shift, recolor, temporal inpaint' },
  { id: 'tracking', label: 'Masking & Tracking', icon: Target, category: '2d', desc: 'Lucas-Kanade Tracking & Mattes' },
  { id: 'rigging', label: 'Rigging', icon: Bone, category: '2d', desc: 'Bones, Pivots & Puppet Pins' },

  // 3. 3D SCENE & COMPOSITING (Blender / After Effects 3D)
  { id: 'threed', label: '3D Scene', icon: Box, category: '3d', desc: '3D Viewport, Geometry, Materials & Camera; OBJ geometry-subset export' },
]

function ToolFinderDialog({ onClose, onSelect }: { onClose: () => void; onSelect: (tab: TabDef) => void }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const filteredTabs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return TABS.filter((tab) => !normalizedQuery ||
      `${tab.label} ${tab.desc} ${tab.category}`.toLowerCase().includes(normalizedQuery))
  }, [query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/70 px-3 pb-3 pt-[max(3.5rem,8vh)]"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
      data-testid="tool-finder-backdrop"
    >
      <section
        id="tool-finder-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tool-finder-title"
        aria-describedby="tool-finder-help"
        data-testid="tool-finder-dialog"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            onClose()
          } else if (event.key === 'Tab') {
            const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
            ))
            const first = controls[0]
            const last = controls[controls.length - 1]
            if (first && last && event.shiftKey && document.activeElement === first) {
              event.preventDefault()
              last.focus()
            } else if (last && !event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first?.focus()
            }
          }
        }}
        className="flex max-h-[min(640px,84vh)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-ink-600 bg-ink-950 shadow-[0_24px_80px_rgba(0,0,0,.6)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-ink-800 px-4 py-3">
          <div>
            <h2 id="tool-finder-title" className="text-sm font-semibold text-ink-100">Find a tool or panel</h2>

          </div>
          <button
            type="button"
            aria-label="Close tool finder"
            title="Close tool finder"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-400 hover:bg-ink-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X size={16} />
          </button>
        </header>

        <label className="mx-3 mt-3 flex h-10 shrink-0 items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-3 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
          <Search size={15} aria-hidden="true" className="text-ink-400" />
          <span className="sr-only">Search tools and panels</span>
          <input
            ref={inputRef}
            data-testid="tool-finder-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tools and features…"
            className="min-w-0 flex-1 bg-transparent text-xs text-ink-100 outline-none placeholder:text-ink-500"
          />
          {query && <button type="button" aria-label="Clear tool search" onClick={() => setQuery('')} className="text-[10px] text-ink-400 hover:text-white">Clear</button>}
        </label>

        <p className="px-4 pb-1 pt-2 text-[10px] text-ink-400" role="status" aria-live="polite">
          {filteredTabs.length} {filteredTabs.length === 1 ? 'panel' : 'panels'}
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto p-2" data-testid="tool-finder-results">
          {filteredTabs.length > 0 ? (
            <ul className="space-y-1">
              {filteredTabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <li key={tab.id}>
                    <button
                      type="button"
                      data-testid={`tool-finder-result-${tab.id}`}
                      aria-label={`${tab.label}. ${tab.desc}`}
                      onClick={() => onSelect(tab)}
                      className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-ink-700 hover:bg-ink-900 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-700 bg-ink-900 text-brand-300"><Icon size={17} aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-ink-100">{tab.label}</span>
                        <span className="mt-0.5 block text-[10px] leading-snug text-ink-400">{tab.desc}</span>
                      </span>
                      <span className="shrink-0 rounded border border-ink-700 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-400">{tab.category}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="rounded-lg border border-ink-800 bg-ink-900/50 p-4 text-center text-xs text-ink-300" data-testid="tool-finder-empty">
              No panels match “{query}”. Try another feature name or browse the category rail.
            </p>
          )}
        </div>
        <footer className="flex items-center justify-between gap-2 border-t border-ink-800 px-4 py-2 text-[10px] text-ink-500">
          <span>Choose a result to open its panel.</span>
          <span className="rounded border border-ink-700 px-1.5 py-0.5">Esc to close</span>
        </footer>
      </section>
    </div>
  )
}

export function LeftDock() {
  const leftTab = useEditor((s) => s.leftTab)
  const leftOpen = useEditor((s) => s.leftOpen)
  const setLeftTab = useEditor((s) => s.setLeftTab)
  const setLeftOpen = useEditor((s) => s.setLeftOpen)
  const drawingEnabled = useEditor((s) => s.drawingEnabled)
  const is3DMode = useEditor((s) => s.is3DMode)
  const workspacePreset = useEditor((s) => s.workspacePreset)
  // Krita-style context following: enabling drawing / 3D brings the matching
  // docker forward on its own — the user never has to re-open panels that a
  // mode hid. Turning the mode off does not yank the panel away.
  const prevDrawingEnabled = useRef(drawingEnabled)
  useEffect(() => {
    const was = prevDrawingEnabled.current
    prevDrawingEnabled.current = drawingEnabled
    // Only follow the transition, and never yank the user out of a panel
    // that hosts drawing controls itself (Tracking / OmniFrame turn drawing
    // on for their own tools — the user is already where they need to be).
    if (drawingEnabled && !was && !['drawing', 'tracking', 'omniframe'].includes(leftTab)) {
      setLeftTab('drawing')
      setLeftOpen(true)
    }
  }, [drawingEnabled, leftTab, setLeftTab, setLeftOpen])
  const prev3DMode = useRef(is3DMode)
  useEffect(() => {
    const was = prev3DMode.current
    prev3DMode.current = is3DMode
    // Same rule as drawing: follow the transition, but never pull the user
    // out of a panel that hosts 3D controls itself (3D / Pack quick-add).
    if (is3DMode && !was && !['threed', 'pack'].includes(leftTab)) {
      setLeftTab('threed')
      setLeftOpen(true)
    }
  }, [is3DMode, leftTab, setLeftTab, setLeftOpen])
  // Workspace rail scoping: the Drawing workspace shelves Audio/Transitions
  // out of the rail (Krita workspaces hide irrelevant dockers); the user can
  // still switch the category filter back by hand at any time.
  useEffect(() => {
    if (workspacePreset === 'drawing') setActiveCategory('2d')
    else if (workspacePreset === '3d') setActiveCategory('3d')
  }, [workspacePreset])
  const leftDockWidth = useEditor((s) => s.leftDockWidth)
  const setLeftDockWidth = useEditor((s) => s.setLeftDockWidth)
  const sidebarSectionMode = useEditor((s) => s.sidebarSectionMode)
  const setSidebarSectionMode = useEditor((s) => s.setSidebarSectionMode)
  // Pop-out floating window state: the panel can leave its dock slot entirely.
  const leftPanelFloating = useEditor((s) => s.leftPanelFloating)
  const setLeftPanelFloating = useEditor((s) => s.setLeftPanelFloating)
  const leftPanelFloat = useEditor((s) => s.leftPanelFloat)
  const setLeftPanelFloat = useEditor((s) => s.setLeftPanelFloat)
  // Header drag-out: dragging the dock header ≥24px pops the panel out into a
  // floating window centered on the pointer — CapCut-style tear-off.
  const headerDrag = React.useRef<{ startX: number; startY: number } | null>(null)
  const onHeaderDragDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, summary, input, select')) return
    headerDrag.current = { startX: e.clientX, startY: e.clientY }
    // Capture so the 34px-tall header keeps receiving moves once the pointer
    // leaves its bounds — without this the tear-off dies on the first step.
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onHeaderDragMove = (e: React.PointerEvent) => {
    const d = headerDrag.current
    if (!d || useEditor.getState().leftPanelFloating) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (Math.hypot(dx, dy) < 24) return
    headerDrag.current = null
    const cur = useEditor.getState().leftPanelFloat
    const w = cur.w || 380
    const h = cur.h || 560
    setLeftPanelFloat({
      x: Math.max(8, Math.min(e.clientX - w / 2, window.innerWidth - w - 8)),
      y: Math.max(40, Math.min(e.clientY - 18, window.innerHeight - 120)),
      w,
      h,
    })
    setLeftPanelFloating(true)
  }
  const onHeaderDragUp = (e: React.PointerEvent) => {
    headerDrag.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // pointer already released
    }
  }
  // Width-drag state: suppress the width transition while the user slides the edge.
  const [dockResizing, setDockResizing] = useState(false)
  const [toolFinderOpen, setToolFinderOpen] = useState(false)
  const toolFinderTrigger = useRef<HTMLButtonElement>(null)
  const toolFinderWasOpen = useRef(false)
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
  const panelMaximized = useEditor((s) => s.panelMaximized)
  const setPanelMaximized = useEditor((s) => s.setPanelMaximized)
  const setHelpOpen = useEditor((s) => s.setHelpOpen)
  const closeSubMode = useEditor((s) => s.closeSubMode)
  const contextualSubModes = useEditor((s) => s.contextualSubModes)
  const openSubMode = useEditor((s) => s.openSubMode)

  useEffect(() => {
    if (toolFinderWasOpen.current && !toolFinderOpen) toolFinderTrigger.current?.focus()
    toolFinderWasOpen.current = toolFinderOpen
  }, [toolFinderOpen])

  const selectFoundTool = (tab: TabDef) => {
    setActiveCategory(tab.category)
    setLeftTab(tab.id)
    setLeftOpen(true)
    closeSubMode()
    setToolFinderOpen(false)
  }

  const dockerPrefs = useEditor((s) => s.dockerPrefs)
  const requestDrawingSection = useEditor((s) => s.requestDrawingSection)
  const setDrawingTool = useEditor((s) => s.setDrawingTool)
  const [drawingFlyoutOpen, setDrawingFlyoutOpen] = useState(false)
  const filteredTabs = TABS.filter(
    (t) =>
      (activeCategory === 'all' || t.category === activeCategory) &&
      dockerPrefs.leftTabs[t.id] !== false,
  )
  const activeTabDef = TABS.find((t) => t.id === leftTab)
  const currentSubMode = contextualSubModes.find((m) => m.id === activeSubMode)

  return (
    <div data-testid="left-dock-root" className="relative z-[60] flex shrink-0 h-full select-none">
      {leftOpen&&!panelMaximized&&<div data-testid="mobile-panel-dismiss" className="fixed bottom-0 left-12 right-0 top-12 -z-10 bg-black/20 sm:hidden" onPointerDown={()=>setLeftOpen(false)} aria-hidden="true"/>}
      {/* Icon Rail */}
      <div className="w-12 shrink-0 bg-ink-900 border-r border-ink-700/80 flex flex-col items-center py-1.5 gap-1 overflow-y-auto scrollbar-none">
        <button
          ref={toolFinderTrigger}
          type="button"
          data-testid="tool-finder-open"
          title="Find a tool or panel"
          aria-label="Find a tool or panel"
          aria-haspopup="dialog"
          aria-controls={toolFinderOpen ? 'tool-finder-dialog' : undefined}
          onClick={() => setToolFinderOpen(true)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-ink-800 bg-ink-950/50 text-ink-300 transition-colors hover:border-brand hover:bg-ink-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Search size={15} aria-hidden="true" />
        </button>
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
                    ? 'all — every tool category'
                    : cat === 'video'
                    ? 'VID — video editing tools'
                    : cat === '2d'
                    ? '2d — paint tools'
                    : '3d — scene tools'
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
            const button = (
              <button
                key={t.id}
                type="button"
                data-testid={`left-tab-${t.id}`}
                title={`${t.label} — ${t.desc}`}
                aria-label={t.id === 'effects' ? `LUT — ${t.label}` : t.label}
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
                {t.id === 'effects' ? (
                  <span className="flex flex-col items-center justify-center gap-0.5" aria-hidden="true">
                    <Icon size={17} />
                    <span
                      data-testid="left-tab-effects-lut-label"
                      className={`min-w-[22px] rounded-sm bg-emerald-950/70 px-0.5 py-[1px] text-[9px] leading-[10px] font-extrabold uppercase tracking-[0.04em] ${active ? 'text-white' : 'text-emerald-200'}`}
                    >
                      LUT
                    </span>
                  </span>
                ) : (
                  <Icon size={17} />
                )}
              </button>
            )
            if (t.id !== 'drawing') return button
            // Drawing flyout: a chevron under the Drawing icon collects the
            // drawing sub-tools into one brand-tinted icon group.
            const flyoutItems = [
              { id: 'brush', label: 'Paint tools', icon: Paintbrush, section: 'brush' },
              { id: 'masking', label: 'Selection & masking', icon: Scan, section: 'masking' },
              { id: 'smart-patch', label: 'Smart Patch', icon: Replace, section: 'smart-patch' },
              { id: 'layers', label: 'Paint layers', icon: Layers, section: 'layers' },
              { id: 'colour', label: 'Colour', icon: Palette, section: 'drawing-colour' },
            ] as const
            return (
              <div key={t.id} className="group flex flex-col items-center gap-0.5">
                {button}
                <button
                  type="button"
                  data-testid="left-tab-drawing-chevron"
                  title={drawingFlyoutOpen ? 'Hide drawing sub-tools' : 'Show drawing sub-tools'}
                  aria-label={drawingFlyoutOpen ? 'Hide drawing sub-tools' : 'Show drawing sub-tools'}
                  aria-expanded={drawingFlyoutOpen}
                  onClick={() => {
                    setLeftTab('drawing')
                    setLeftOpen(true)
                    setDrawingFlyoutOpen((v) => !v)
                  }}
                  className="grid h-6 w-8.5 place-items-center rounded text-ink-500 transition-colors hover:text-brand-300 group-hover:animate-[of-nudge-y_0.7s_ease-in-out_infinite]"
                >
                  <ChevronDown size={12} className={`transition-transform duration-200 ${drawingFlyoutOpen ? 'rotate-180' : ''}`} />
                </button>
                {drawingFlyoutOpen && (
                  <div
                    data-testid="drawing-flyout"
                    role="group"
                    aria-label="Drawing sub-tools"
                    className="flex flex-col items-center gap-1 rounded-lg border border-brand/40 bg-brand/10 p-1 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.12)]"
                  >
                    {flyoutItems.map((item) => {
                      const ItemIcon = item.icon
                      return (
                        <Tooltip key={item.id} label={item.label}>
                          <button
                            type="button"
                            data-testid={`drawing-flyout-${item.id}`}
                            aria-label={item.label}
                            onClick={() => {
                              setLeftTab('drawing')
                              setLeftOpen(true)
                              if (item.id === 'smart-patch') setDrawingTool('smart-patch')
                              requestDrawingSection(item.section)
                            }}
                            className="grid h-7 w-7 place-items-center rounded-md text-brand-200 transition-colors hover:bg-brand/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                          >
                            <ItemIcon size={14} />
                          </button>
                        </Tooltip>
                      )
                    })}
                  </div>
                )}
              </div>
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
              const SubIcon = SUB_ICON_BY_NAME[sub.icon] ?? Layers
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
                    <SubIcon size={14} className={isSubActive ? 'text-brand-400' : 'text-amber-400'} />
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
      {panelMaximized && leftOpen && (
        <div data-testid="left-panel-backdrop" className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm" onClick={() => setPanelMaximized(false)} aria-hidden="true" />
      )}
      <div
        id="left-panel"
        data-testid="left-panel"
        data-open={leftOpen}
        data-maximized={panelMaximized || undefined}
        style={{
          width: panelMaximized && leftOpen
            ? '95vw'
            : leftOpen
              ? `${Math.min(leftDockWidth - 48, typeof window !== 'undefined' && window.innerWidth < 640 ? window.innerWidth - 56 : leftDockWidth - 48)}px`
              : '0px',
        }}
        className={panelMaximized && leftOpen
          ? 'fixed left-1/2 top-1/2 z-[80] h-[95vh] w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-ink-600 bg-ink-850 shadow-[0_32px_120px_rgba(0,0,0,.7)] overflow-hidden'
          : `shrink-0 bg-ink-850 border-r border-ink-700/80 overflow-hidden transition-[width] duration-150 max-sm:absolute max-sm:left-12 max-sm:top-0 max-sm:bottom-0 max-sm:z-40 max-sm:max-w-[calc(100vw-3.5rem)] max-sm:shadow-2xl ${dockResizing ? 'transition-none' : ''}`}
      >
        <div
          style={{
            width: '100%',
          }}
          className="h-full flex flex-col relative"
        >
          {/* Width drag handle: slide the panel edge to resize */}
          {leftOpen && !leftPanelFloating && (
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
          {/* Header & Sub-Mode Channel Navigation — dragging it out of the dock
              tears the panel off into a floating window. */}
          <div
            onPointerDown={onHeaderDragDown}
            onPointerMove={onHeaderDragMove}
            onPointerUp={onHeaderDragUp}
            onPointerCancel={onHeaderDragUp}
            data-testid="left-panel-header"
            className="min-h-10 shrink-0 flex items-center justify-between px-2.5 py-0.5 border-b border-ink-700/80 bg-ink-900/60 touch-none select-none"
          >
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
                  className="text-xs font-semibold text-ink-100 whitespace-normal break-words leading-tight"
                  title={currentSubMode.label}
                >
                  {currentSubMode.label}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0 pr-2">
                <span
                  className="min-w-0 truncate text-xs font-semibold uppercase tracking-wider text-ink-200"
                  title={activeTabDef?.label}
                >
                  {activeTabDef?.label}
                </span>
                {leftTab !== 'effects' && (
                  <span className="hidden lg:inline text-[9px] px-1 py-0.2 rounded font-mono uppercase bg-ink-800 text-ink-400 shrink-0">
                    {activeTabDef?.category === 'video' ? 'Video NLE' : activeTabDef?.category === '2d' ? '2D Paint' : '3D'}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-0.5 shrink-0">
              <details className="relative sm:hidden" data-testid="mobile-panel-options" onKeyDown={event=>{if(event.key==='Escape')event.currentTarget.open=false}}>
                <summary aria-label="Panel options" className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-md border border-ink-700 text-ink-300"><ChevronDown size={17}/></summary>
                <div className="absolute right-0 top-10 z-50 w-56 rounded-md border border-ink-600 bg-ink-900 p-1 shadow-xl">
                  {[
                    {label:sidebarSectionMode==='tabs'?'Use accordion sections':'Use tabbed sections',run:()=>setSidebarSectionMode(sidebarSectionMode==='tabs'?'accordion':'tabs')},
                    {label:panelMaximized?'Restore panel size':'Expand panel',run:()=>setPanelMaximized(!panelMaximized)},
                    {label:'Float panel',run:()=>setLeftPanelFloating(true)},
                    {label:'Panel help',run:()=>setHelpOpen(true)},
                  ].map(item=><button key={item.label} type="button" className="min-h-10 w-full rounded px-3 text-left text-xs text-ink-200 hover:bg-ink-700" onClick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');item.run()}}>{item.label}</button>)}
                </div>
              </details>

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
                className={`hidden sm:grid place-items-center h-6.5 w-6.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  sidebarSectionMode === 'tabs' ? 'text-brand-400 hover:text-white hover:bg-ink-750' : 'text-ink-400 hover:text-white hover:bg-ink-750'
                }`}
              >
                {sidebarSectionMode === 'tabs' ? <LayoutGrid size={13} /> : <List size={13} />}
              </button>
              <button
                type="button"
                data-testid="left-panel-maximize-btn"
                title={panelMaximized ? 'Restore panel size' : 'Open panel as a full window (95%)'}
                aria-label={panelMaximized ? 'Restore panel size' : 'Open panel as a full window'}
                aria-pressed={panelMaximized}
                onClick={() => setPanelMaximized(!panelMaximized)}
                className="hidden sm:grid place-items-center h-6.5 w-6.5 rounded text-ink-400 hover:text-white hover:bg-ink-750 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {panelMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
              <button
                type="button"
                data-testid="help-open-btn"
                title="Help — tutorials & info"
                aria-label="Open help: tutorials and info"
                onClick={() => setHelpOpen(true)}
                className="hidden sm:grid place-items-center h-6.5 w-6.5 rounded text-ink-400 hover:text-white hover:bg-ink-750 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <CircleHelp size={14} />
              </button>
              {!leftPanelFloating && (
                <button
                  type="button"
                  data-testid="left-panel-popout-btn"
                  title="Pop out into floating window (or drag the panel header)"
                  aria-label="Pop panel out into a floating window"
                  onClick={() => setLeftPanelFloating(true)}
                  className="hidden sm:grid place-items-center h-6.5 w-6.5 rounded text-ink-400 hover:text-white hover:bg-ink-750 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <PictureInPicture2 size={13} />
                </button>
              )}
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
              tabs (default) or a single-open accordion, per the header toggle.
              While the panel is popped out, the dock slot shows a slim
              placeholder instead; the real content lives in the window. */}
          {leftPanelFloating ? (
            <div
              data-testid="left-panel-float-placeholder"
              className="flex flex-1 min-h-0 flex-col items-center justify-center gap-2 border-r border-ink-700/80 bg-ink-900/40 px-2 text-center"
            >
              <PanelLeft size={20} className="text-ink-500" aria-hidden="true" />
              <p className="text-[10px] leading-tight text-ink-400">
                {activeTabDef?.label ?? 'Panel'} is floating
              </p>
              <button
                type="button"
                data-testid="left-panel-dock-back-btn"
                onClick={() => setLeftPanelFloating(false)}
                className="rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-[10px] text-ink-300 transition-colors hover:border-ink-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                Dock back
              </button>
            </div>
          ) : (
          <SectionsNavigator mode={sidebarSectionMode} label={`${activeTabDef?.label ?? 'Panel'} sections`}>
            <div tabIndex={0} aria-label="Panel contents, scrollable" className="flex-1 min-h-0 overflow-y-auto">
              <Suspense fallback={<div className="p-3 text-[11px] text-ink-400" role="status">Loading panel…</div>}>
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
              {leftTab === 'pack' && <DesktopPackPanel />}
              {leftTab === 'storyboard' && <StoryboardPanel />}
              </Suspense>
            </div>
          </SectionsNavigator>
          )}
        </div>
      </div>

      {/* Popped-out panel: the same panel content in a draggable,
          resizable floating window (drag its header to the left screen
          edge or hit the dock button to slot it back in). */}
      {leftPanelFloating ? (
        <FloatingWindow
          testId="left-panel-float-window"
          title={activeTabDef?.label ?? 'Panel'}
          rect={leftPanelFloat}
          setRect={setLeftPanelFloat}
          onDock={() => setLeftPanelFloating(false)}
          onClose={() => {
            setLeftPanelFloating(false)
            setLeftOpen(false)
          }}
          dockIcon={<PanelLeft size={13} />}
          dockLabel="Dock panel back into the layout"
        >
          <SectionsNavigator mode={sidebarSectionMode} label={`${activeTabDef?.label ?? 'Panel'} sections`}>
            <div tabIndex={0} aria-label="Panel contents, scrollable" className="flex-1 min-h-0 overflow-y-auto">
              <Suspense fallback={<div className="p-3 text-[11px] text-ink-400" role="status">Loading panel…</div>}>
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
              {leftTab === 'pack' && <DesktopPackPanel />}
              {leftTab === 'storyboard' && <StoryboardPanel />}
              </Suspense>
            </div>
          </SectionsNavigator>
        </FloatingWindow>
      ) : null}
      {toolFinderOpen && <ToolFinderDialog onClose={() => setToolFinderOpen(false)} onSelect={selectFoundTool} />}
    </div>
  )
}
