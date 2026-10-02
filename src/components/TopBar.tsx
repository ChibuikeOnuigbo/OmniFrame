import { useEffect, useRef, useState } from 'react'
import {
  Upload,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  Film,
  Undo2,
  Redo2,
  Settings,
  LayoutGrid,
  Check,
  Maximize,
  X,
  Sliders,
  HelpCircle,
} from 'lucide-react'
import { useEditor } from '../store'
import type { WorkspacePreset, FocusMode } from '../types'
import { exportVideo } from '../lib/export'
import { EDITABLE_SHORTCUTS, SETTINGS_CATEGORIES, searchSettings, type SettingsCategory } from '../lib/settingsRegistry'
import { AI_PROVIDERS, testAiConnection, type AiProviderId } from '../lib/aiProviders'
import { IconButton } from './ui'
import { WorkspaceSchematic } from './WorkspaceSchematic'
import { LayoutManagerModal } from './LayoutManagerModal'

export function TopBar() {
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const importFiles = useEditor((s) => s.importFiles)
  const leftOpen = useEditor((s) => s.leftOpen)
  const setLeftOpen = useEditor((s) => s.setLeftOpen)
  const projectFps = useEditor((s) => s.projectFps)
  const setProjectFps = useEditor((s) => s.setProjectFps)
  const dropFrameTimecode = useEditor((s) => s.dropFrameTimecode)
  const setDropFrameTimecode = useEditor((s) => s.setDropFrameTimecode)
  const previewQuality = useEditor((s) => s.previewQuality)
  const setPreviewQuality = useEditor((s) => s.setPreviewQuality)
  const workspacePreset = useEditor((s) => s.workspacePreset)
  const setWorkspacePreset = useEditor((s) => s.setWorkspacePreset)
  const focusMode = useEditor((s) => s.focusMode)
  const setFocusMode = useEditor((s) => s.setFocusMode)

  const customShortcuts = useEditor((s) => s.customShortcuts)
  const setCustomShortcut = useEditor((s) => s.setCustomShortcut)
  const resetCustomShortcuts = useEditor((s) => s.resetCustomShortcuts)
  const contextMenuEnabledCommands = useEditor((s) => s.contextMenuEnabledCommands)
  const toggleContextMenuCommand = useEditor((s) => s.toggleContextMenuCommand)
  const setContextMenuCommand = useEditor((s) => s.setContextMenuCommand)
  const resetContextMenuCommands = useEditor((s) => s.resetContextMenuCommands)
  const cursorConfig = useEditor((s) => s.cursorConfig)
  const setCursorConfig = useEditor((s) => s.setCursorConfig)
  const resetCursorConfig = useEditor((s) => s.resetCursorConfig)
  const [editingShortcutId, setEditingShortcutId] = useState<string | null>(null)
  const [editingKeyVal, setEditingKeyVal] = useState('')

  const fileInput = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [layoutModalOpen, setLayoutModalOpen] = useState(false)
  const layoutRef = useRef<HTMLDivElement>(null)
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>('timeline')
  const [settingsSearch, setSettingsSearch] = useState('')
  const settingsMatches = searchSettings(settingsSearch)
  const [aiProvider, setAiProvider] = useState<AiProviderId>('openrouter')
  const initialAiProvider = AI_PROVIDERS[0]
  const [aiModel, setAiModel] = useState(initialAiProvider.defaultModel)
  const [aiEndpoint, setAiEndpoint] = useState('')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiTestState, setAiTestState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [aiTestMessage, setAiTestMessage] = useState('')

  const selectAiProvider = (id: AiProviderId) => {
    const provider = AI_PROVIDERS.find((item) => item.id === id)!
    setAiProvider(id)
    setAiModel(provider.defaultModel)
    setAiEndpoint(provider.endpoint)
    setAiTestState('idle')
    setAiTestMessage('')
  }

  const testProvider = async () => {
    setAiTestState('testing')
    setAiTestMessage('')
    try {
      await testAiConnection({ provider: aiProvider, apiKey: aiApiKey, model: aiModel, endpoint: aiEndpoint })
      setAiTestState('success')
      setAiTestMessage('Connection succeeded.')
    } catch (error) {
      setAiTestState('error')
      setAiTestMessage(error instanceof Error ? error.message : 'Connection failed.')
    }
  }
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem('omniframe.reducedMotion') === 'true')
  const settingsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('of-reduced-motion', reducedMotion)
    localStorage.setItem('omniframe.reducedMotion', String(reducedMotion))
  }, [reducedMotion])

  useEffect(() => {
    if (!settingsOpen) return
    const closeOutside = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false)
    }
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSettingsOpen(false) }
    window.addEventListener('pointerdown', closeOutside)
    window.addEventListener('keydown', closeEscape)
    return () => { window.removeEventListener('pointerdown', closeOutside); window.removeEventListener('keydown', closeEscape) }
  }, [settingsOpen])

  useEffect(() => {
    if (!layoutOpen) return
    const closeOutside = (event: PointerEvent) => {
      if (!layoutRef.current?.contains(event.target as Node)) setLayoutOpen(false)
    }
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setLayoutOpen(false) }
    window.addEventListener('pointerdown', closeOutside)
    window.addEventListener('keydown', closeEscape)
    return () => { window.removeEventListener('pointerdown', closeOutside); window.removeEventListener('keydown', closeEscape) }
  }, [layoutOpen])

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length) importFiles(e.target.files)
    e.target.value = ''
  }

  const onExport = async () => {
    if (exporting) return
    setExporting(true)
    setProgress(0)
    setStatus('Starting…')
    try {
      await exportVideo({ onProgress: setProgress, onStatus: setStatus })
    } catch (err) {
      setStatus(`Export failed: ${(err as Error).message}`)
      setTimeout(() => setExporting(false), 2500)
      return
    }
    setTimeout(() => setExporting(false), 1200)
  }

  return (
    <header className="h-12 shrink-0 flex items-center gap-2 px-3 bg-ink-900 border-b border-ink-700">
      <button
        type="button"
        title={leftOpen ? 'Hide panel' : 'Show panel'}
        onClick={() => setLeftOpen(!leftOpen)}
        className="grid place-items-center h-8 w-8 rounded-md text-ink-400 hover:text-white hover:bg-ink-700"
      >
        {leftOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
      </button>

      <div className="flex items-center gap-2 pl-1 pr-1 sm:pr-2">
        <Film size={18} className="text-brand-400" />
        <span className="hidden sm:inline font-semibold tracking-tight text-sm">OmniFrame</span>
      </div>

      <div className="flex-1" />

      {/* history group */}
      <div className="flex items-center gap-1">
        <IconButton title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
          <Undo2 size={16} />
        </IconButton>
        <IconButton title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
          <Redo2 size={16} />
        </IconButton>
      </div>

      <div className="w-px h-6 bg-ink-700" />

      {/* actions group */}
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        title="Import media"
        aria-label="Import media"
        className="flex items-center gap-2 h-8 px-2 sm:px-3 rounded-md bg-brand text-white text-xs font-medium hover:bg-brand-600 transition-colors"
      >
        <Upload size={15} />
        <span className="hidden sm:inline">Import</span>
      </button>
      <input id="topbar-import-input" data-testid="import-input" aria-label="Import media files" ref={fileInput} type="file" accept="video/*,image/*,audio/*" multiple hidden onChange={onPickFiles} />

      <div className="relative">
        <button
          type="button"
          data-testid="workspace-layout-btn"
          title="Workspace Layout & Focus Mode"
          aria-label="Workspace Layout"
          aria-expanded={layoutOpen}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setLayoutOpen((open) => !open)}
          className={`grid h-8 w-8 place-items-center rounded-md border border-ink-700 bg-ink-800 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            layoutOpen ? 'bg-ink-700 text-white' : 'text-ink-400'
          }`}
        >
          <LayoutGrid size={15} />
        </button>

        {layoutOpen && (
          <div
            ref={layoutRef}
            data-testid="layout-popup"
            role="dialog"
            aria-label="Workspace Layouts"
            className="fixed right-16 top-12 z-[80] flex w-72 flex-col overflow-hidden rounded-xl border border-ink-600 bg-[#11131d]/[0.98] shadow-[0_20px_60px_rgba(0,0,0,.5)] backdrop-blur-xl p-2 text-xs text-ink-200"
          >
            <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              <span>Workspace Presets</span>
              <button
                type="button"
                data-testid="open-layout-manager-btn"
                onClick={() => {
                  setLayoutOpen(false)
                  setLayoutModalOpen(true)
                }}
                className="text-brand-400 hover:underline capitalize"
              >
                Manage...
              </button>
            </div>
            {[
              { id: 'default', label: 'Default' },
              { id: 'edit', label: 'Edit' },
              { id: 'timeline-focus', label: 'Timeline Focus' },
              { id: 'preview-focus', label: 'Preview Focus' },
              { id: 'drawing', label: 'Drawing & Paint' },
              { id: 'color', label: 'Color Grading' },
              { id: '3d', label: '3D Scene & Compositing' },
              { id: 'minimal', label: 'Minimal' },
              { id: 'full-canvas', label: 'Full Canvas' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                data-testid={`preset-${p.id}`}
                onClick={() => {
                  setWorkspacePreset(p.id as WorkspacePreset)
                  setLayoutOpen(false)
                }}
                className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-ink-700 transition-colors ${
                  workspacePreset === p.id && focusMode === 'none' ? 'bg-brand/20 text-brand-400 font-medium' : 'text-ink-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <WorkspaceSchematic preset={p.id as WorkspacePreset} />
                  <span className="truncate">{p.label}</span>
                </div>
                {workspacePreset === p.id && focusMode === 'none' && <Check size={14} className="shrink-0 text-brand-400" />}
              </button>
            ))}

            <div className="my-1 border-t border-ink-700" />

            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              Focus Mode
            </div>
            {[
              { id: 'none', label: 'Normal Workspace' },
              { id: 'preview', label: 'Preview Focus' },
              { id: 'timeline', label: 'Timeline Focus' },
              { id: 'one-panel', label: 'One Panel Only (Inspector)' },
              { id: 'canvas-only', label: 'Hide Everything (Zen)' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                data-testid={`focus-${m.id}`}
                onClick={() => {
                  setFocusMode(m.id as FocusMode)
                  setLayoutOpen(false)
                }}
                className={`flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-ink-700 transition-colors ${
                  focusMode === m.id ? 'bg-brand/20 text-brand-400 font-medium' : 'text-ink-300'
                }`}
              >
                <span>{m.label}</span>
                {focusMode === m.id && <Check size={14} className="text-brand-400" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        data-testid="help-info-button"
        data-help="true"
        title="Help and editor specifications (?)"
        aria-label="Help and specifications"
        onClick={() => {
          setSettingsCategory('cursor')
          setSettingsOpen(true)
        }}
        className="grid h-8 w-8 place-items-center rounded-md border border-ink-700 bg-ink-800 text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <HelpCircle size={15} />
      </button>

      <button
        type="button"
        data-testid="settings-button"
        title="Settings"
        aria-label="Settings"
        aria-expanded={settingsOpen}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => setSettingsOpen((open) => !open)}
        className="grid h-8 w-8 place-items-center rounded-md border border-ink-700 bg-ink-800 text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Settings size={15} />
      </button>

      <button
        type="button"
        data-testid="export-video-btn"
        onClick={onExport}
        disabled={exporting}
        title={exporting ? 'Exporting video' : 'Export video'}
        aria-label={exporting ? 'Exporting video' : 'Export video'}
        className="flex items-center gap-2 h-8 px-2 sm:px-3 rounded-md bg-ink-800 border border-ink-700 text-xs font-medium hover:bg-ink-700 transition-colors disabled:opacity-50"
      >
        <Download size={15} />
        <span className="hidden sm:inline">{exporting ? 'Exporting…' : 'Export'}</span>
      </button>

      {settingsOpen && (
        <div
          ref={settingsRef}
          data-testid="settings-popup"
          role="dialog"
          aria-label="Settings"
          className="fixed inset-x-2 top-14 sm:inset-auto sm:right-3 sm:top-12 z-[80] flex w-auto sm:w-[min(520px,calc(100vw-24px))] max-h-[min(540px,calc(100vh-64px))] flex-col overflow-hidden rounded-xl border border-ink-600 bg-[#11131d]/[0.98] shadow-[0_20px_60px_rgba(0,0,0,.6)] backdrop-blur-xl"
        >
          <header className="border-b border-ink-700 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Settings</h2>
              <button
                aria-label="Close settings"
                onClick={() => setSettingsOpen(false)}
                className="grid h-7 w-7 place-items-center rounded-md text-ink-400 hover:bg-ink-700 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
            <input
              type="search"
              aria-label="Search settings"
              placeholder="Search settings"
              value={settingsSearch}
              onChange={(event) => setSettingsSearch(event.target.value)}
              className="h-8 w-full rounded-md border border-ink-700 bg-ink-800 px-2 text-xs text-ink-200 outline-none placeholder:text-ink-500 focus:border-brand"
            />
          </header>
          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            <nav
              aria-label="Settings categories"
              className="flex flex-row sm:flex-col overflow-x-auto sm:overflow-x-visible sm:w-36 shrink-0 border-b sm:border-b-0 sm:border-r border-ink-700 p-1.5 sm:p-2 gap-1 scrollbar-none"
            >
              {SETTINGS_CATEGORIES.map((category) => (
                <button
                  key={category}
                  data-testid="settings-category"
                  data-category-id={category}
                  aria-pressed={settingsCategory === category}
                  title={category === 'contextMenu' ? 'Context Menu' : category === 'cursor' ? 'Cursor & Pointer' : category}
                  onClick={() => setSettingsCategory(category)}
                  className={`h-8 sm:h-9 shrink-0 rounded-lg px-2.5 sm:px-3 text-left text-xs capitalize outline-none transition-colors whitespace-nowrap focus-visible:ring-2 focus-visible:ring-brand truncate ${
                    settingsCategory === category
                      ? 'bg-brand/20 text-violet-200 font-medium'
                      : 'text-ink-400 hover:bg-ink-700 hover:text-white'
                  }`}
                >
                  <span className="truncate">
                    {category === 'contextMenu'
                      ? 'Context Menu'
                      : category === 'cursor'
                      ? 'Cursor & Pointer'
                      : category}
                  </span>
                </button>
              ))}
            </nav>
            <section className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-4 text-xs">
              <h3 className="mb-3 text-sm font-semibold capitalize text-ink-100">
                {settingsSearch
                  ? 'Search results'
                  : settingsCategory === 'contextMenu'
                  ? 'Context Menu Actions'
                  : settingsCategory === 'cursor'
                  ? 'Cursor & Pointer Customizer'
                  : settingsCategory}
              </h3>

              {settingsSearch && (
                <div data-testid="settings-search-results" className="space-y-1">
                  {settingsMatches.length === 0 ? (
                    <p className="text-xs text-ink-500">No available settings match.</p>
                  ) : (
                    settingsMatches.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSettingsCategory(item.category)
                          setSettingsSearch('')
                        }}
                        className="block w-full rounded-md px-2 py-2 text-left hover:bg-ink-700"
                      >
                        <span className="block text-xs text-ink-200">{item.label}</span>
                        <span className="mt-0.5 block text-[10px] capitalize text-ink-500">
                          {item.category} · {item.scope}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {!settingsSearch && settingsCategory === 'timeline' && (
                <div className="space-y-4">
                  <label className="block text-xs text-ink-300">
                    <span className="mb-2 block">Project frame rate</span>
                    <select
                      aria-label="Project frame rate"
                      value={projectFps}
                      onChange={(event) => setProjectFps(Number(event.target.value))}
                      className="h-8 w-full rounded-md border border-ink-700 bg-ink-800 px-2 text-xs text-ink-200"
                    >
                      {[23.976, 24, 25, 29.97, 30, 50, 59.94, 60, 120].map((rate) => (
                        <option key={rate} value={rate}>
                          {rate} fps
                        </option>
                      ))}
                    </select>
                  </label>
                  {(projectFps === 29.97 || projectFps === 59.94) && (
                    <label className="flex items-center justify-between gap-4 text-xs text-ink-300">
                      <span>
                        <span className="block">Drop frame timecode</span>
                        <span className="mt-1 block text-[10px] text-ink-500">
                          SMPTE clock aligned display; timing is unchanged.
                        </span>
                      </span>
                      <input
                        aria-label="Drop frame timecode"
                        type="checkbox"
                        checked={dropFrameTimecode}
                        onChange={(event) => setDropFrameTimecode(event.target.checked)}
                        className="h-4 w-4 accent-violet-500"
                      />
                    </label>
                  )}
                </div>
              )}

              {!settingsSearch && settingsCategory === 'playback' && (
                <div>
                  <div className="mb-2 text-xs text-ink-300">Preview quality</div>
                  <div role="radiogroup" aria-label="Preview quality" className="grid grid-cols-3 gap-2">
                    {(['low', 'medium', 'high'] as const).map((quality) => (
                      <button
                        key={quality}
                        type="button"
                        role="radio"
                        aria-checked={previewQuality === quality}
                        onClick={() => setPreviewQuality(quality)}
                        className={`h-9 rounded-md border px-3 text-xs capitalize ${
                          previewQuality === quality
                            ? 'border-brand bg-brand/15 text-violet-200'
                            : 'border-ink-700 bg-ink-800 text-ink-300 hover:bg-ink-700'
                        }`}
                      >
                        {quality}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] leading-relaxed text-ink-500">
                    Adjusts viewport preview resolution. Timeline timing and project FPS remain unchanged.
                  </p>
                </div>
              )}

              {!settingsSearch && settingsCategory === 'contextMenu' && (
                <div data-testid="settings-context-menu-section" className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-ink-800">
                    <p className="text-[11px] text-ink-400">
                      Customize which actions appear when right-clicking on clips and timeline tracks.
                    </p>
                    <button
                      type="button"
                      data-testid="reset-context-menu-btn"
                      onClick={resetContextMenuCommands}
                      className="text-[10px] text-brand-400 hover:underline shrink-0 ml-2"
                    >
                      Reset Defaults
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                    {[
                      { id: 'cut', label: 'Cut Clip', shortcut: 'Ctrl+X', desc: 'Cut clip to clipboard' },
                      { id: 'copy', label: 'Copy Clip', shortcut: 'Ctrl+C', desc: 'Copy clip to clipboard' },
                      { id: 'paste', label: 'Paste at Playhead', shortcut: 'Ctrl+V', desc: 'Paste copied clip' },
                      { id: 'duplicate', label: 'Duplicate Clip', shortcut: 'Ctrl+D', desc: 'Duplicate next to clip' },
                      { id: 'split', label: 'Split at Playhead', shortcut: 'Ctrl+B', desc: 'Split clip at current time' },
                      { id: 'marker', label: 'Add Marker', shortcut: 'M', desc: 'Place timeline marker pin' },
                      { id: 'remove-all-gaps', label: 'Remove All Gaps', shortcut: 'Shift+G', desc: 'Close every gap between clips' },
                      { id: 'select-gaps', label: 'Select Gaps', shortcut: 'G', desc: 'Hand-pick which gaps to close' },
                      { id: 'target-track', label: 'Target Track', shortcut: '', desc: 'Click a V1/A1 button, Shift-click to solo' },
                      { id: 'add-transition', label: 'Add Transition', shortcut: '', desc: 'Cross dissolve or wipe' },
                      { id: 'separate-audio', label: 'Separate Audio', shortcut: '', desc: 'Extract audio to new track' },
                      { id: 'isolate-voice', label: 'Voice Isolation', shortcut: '', desc: 'Vocal / Instrumental separation' },
                      { id: 'remove-bg-modal', label: 'AI Background Removal', shortcut: '', desc: 'Segment character foreground' },
                      { id: 'compound-clip', label: 'Compound Sequence', shortcut: 'Ctrl+G', desc: 'Group or decompose clips' },
                      { id: 'hide-toggle', label: 'Hide / Unhide Clip', shortcut: 'H', desc: 'Toggle clip visibility' },
                      { id: 'delete', label: 'Delete Clip', shortcut: 'Delete', desc: 'Remove clip from sequence' },
                    ].map((item) => {
                      const enabled = contextMenuEnabledCommands[item.id] !== false
                      return (
                        <label
                          key={item.id}
                          data-testid={`ctx-setting-toggle-${item.id}`}
                          className="flex items-center justify-between p-2 rounded-lg bg-ink-850 hover:bg-ink-800 transition-colors cursor-pointer select-none"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-ink-200">{item.label}</span>
                              {item.shortcut && (
                                <span className="px-1.5 py-0.5 rounded bg-ink-800 border border-ink-700 text-[9px] font-mono text-ink-400">
                                  {item.shortcut}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-ink-500 block truncate">{item.desc}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={() => toggleContextMenuCommand(item.id)}
                            className="h-4 w-4 rounded border-ink-700 bg-ink-800 accent-violet-500 cursor-pointer"
                          />
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {!settingsSearch && settingsCategory === 'shortcuts' && (
                <div data-testid="settings-shortcuts-section" className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-ink-800">
                    <p className="text-[11px] text-ink-400">
                      Customize keyboard shortcuts for high-speed editing.
                    </p>
                    <button
                      type="button"
                      data-testid="reset-shortcuts-btn"
                      onClick={resetCustomShortcuts}
                      className="text-[10px] text-brand-400 hover:underline shrink-0 ml-2"
                    >
                      Reset All
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {[
                      ...EDITABLE_SHORTCUTS,
                    ].map((item) => {
                      const curKey = customShortcuts[item.id] || item.defaultKey
                      const isEditing = editingShortcutId === item.id
                      return (
                        <div
                          key={item.id}
                          data-testid={`shortcut-row-${item.id}`}
                          className="flex items-center justify-between gap-3 p-1.5 rounded-lg bg-ink-850 hover:bg-ink-800 transition-colors"
                        >
                          <span className="text-xs text-ink-200">{item.label}</span>
                          <div className="flex items-center gap-1.5">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  autoFocus
                                  data-testid={`shortcut-input-${item.id}`}
                                  value={editingKeyVal}
                                  onChange={(e) => setEditingKeyVal(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      if (editingKeyVal.trim()) setCustomShortcut(item.id, editingKeyVal.trim())
                                      setEditingShortcutId(null)
                                    } else if (e.key === 'Escape') {
                                      setEditingShortcutId(null)
                                    }
                                  }}
                                  placeholder="Type key"
                                  className="w-16 h-6 rounded bg-ink-900 border border-brand px-1.5 font-mono text-[11px] text-white outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (editingKeyVal.trim()) setCustomShortcut(item.id, editingKeyVal.trim())
                                    setEditingShortcutId(null)
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-brand text-[10px] text-white"
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                data-testid={`edit-shortcut-${item.id}`}
                                title={`Click to customize shortcut for ${item.label}`}
                                onClick={() => {
                                  setEditingShortcutId(item.id)
                                  setEditingKeyVal(curKey)
                                }}
                                className="rounded border border-ink-700 bg-ink-800 px-2 py-1 font-mono text-[10px] text-ink-300 hover:border-brand hover:text-white transition-colors"
                              >
                                {curKey}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {!settingsSearch && settingsCategory === 'cursor' && (
                <div data-testid="settings-cursor-section" className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-ink-800">
                    <p className="text-[11px] text-ink-400">
                      Gamified macOS vector cursor with downloaded packs, + drag badges, ? help, and magnetized drop reticle.
                    </p>
                    <button
                      type="button"
                      data-testid="reset-cursor-btn"
                      onClick={resetCursorConfig}
                      className="text-[10px] text-brand-400 hover:underline shrink-0 ml-2"
                    >
                      Reset Defaults
                    </button>
                  </div>

                  {/* Master Toggle */}
                  <label className="flex items-center justify-between p-2.5 rounded-lg bg-ink-850 hover:bg-ink-800 transition-colors cursor-pointer select-none">
                    <div className="min-w-0 flex-1 pr-2">
                      <span className="text-xs font-medium text-ink-100 block">Custom Mac Cursor Follower</span>
                      <span className="text-[10px] text-ink-500 block">
                        Hardware-accelerated zero-latency cursor with crisp drop shadow and zero click-blocking.
                      </span>
                    </div>
                    <input
                      data-testid="toggle-custom-cursor"
                      type="checkbox"
                      checked={cursorConfig.enabled}
                      onChange={(e) => setCursorConfig({ enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-ink-700 bg-ink-800 accent-violet-500 cursor-pointer"
                    />
                  </label>

                  {/* Downloaded Cursor Packs */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-ink-300">Downloaded macOS Cursor Pack</span>
                      <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60">
                        40+ Authentic SVGs
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { id: 'mac-gamified', label: 'macOS Gamified', desc: 'Enlarged + power core & glow' },
                          { id: 'mac-sonoma-pro', label: 'macOS Sonoma Pro', desc: 'Authentic Apple vector curves' },
                          { id: 'cyber-violet', label: 'Cyber Violet', desc: 'Neon violet & cyan reticles' },
                          { id: 'neo-stealth', label: 'Neo Stealth', desc: 'Obsidian monochrome dark' },
                        ] as const
                      ).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          data-testid={`cursor-pack-${item.id}`}
                          onClick={() => setCursorConfig({ pack: item.id, theme: item.id })}
                          className={`p-2 rounded-lg border text-left transition-all ${
                            (cursorConfig.pack || cursorConfig.theme) === item.id
                              ? 'border-brand bg-brand/20 text-violet-200 shadow-sm'
                              : 'border-ink-700 bg-ink-850 text-ink-400 hover:bg-ink-800 hover:text-ink-200'
                          }`}
                        >
                          <div className="text-xs font-semibold">{item.label}</div>
                          <div className="text-[9px] text-ink-500">{item.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cursor Size */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium text-ink-300">Cursor Scale Profile</div>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'standard', label: 'Standard', desc: '0.95x classic' },
                          { id: 'bigger', label: 'Bigger (Gamified)', desc: '1.20x enlarged' },
                          { id: 'mega', label: 'Mega', desc: '1.40x high-vis' },
                        ] as const
                      ).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          data-testid={`cursor-size-${item.id}`}
                          onClick={() => setCursorConfig({ size: item.id })}
                          className={`p-2 rounded-lg border text-left transition-all ${
                            cursorConfig.size === item.id
                              ? 'border-brand bg-brand/20 text-violet-200 shadow-sm'
                              : 'border-ink-700 bg-ink-850 text-ink-400 hover:bg-ink-800 hover:text-ink-200'
                          }`}
                        >
                          <div className="text-xs font-semibold">{item.label}</div>
                          <div className="text-[9px] text-ink-500">{item.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Refined Contextual Feedback Toggles */}
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] font-medium text-ink-300">Gamified Interactive Feedback</div>

                    {/* Contextual Badges */}
                    <label className="flex items-center justify-between p-2 rounded-lg bg-ink-850 hover:bg-ink-800 transition-colors cursor-pointer select-none">
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="text-xs font-medium text-ink-200 block">
                          Context Badges (+ on Drag, ? on Info)
                        </span>
                        <span className="text-[10px] text-ink-500 block">
                          Emerald + badge over draggable assets, amber ? badge over help and specs buttons.
                        </span>
                      </div>
                      <input
                        data-testid="toggle-cursor-badges"
                        type="checkbox"
                        checked={cursorConfig.showBadges}
                        onChange={(e) => setCursorConfig({ showBadges: e.target.checked })}
                        className="h-4 w-4 rounded border-ink-700 bg-ink-800 accent-violet-500 cursor-pointer"
                      />
                    </label>

                    {/* Magnetized Drop Reticle */}
                    <label className="flex items-center justify-between p-2 rounded-lg bg-ink-850 hover:bg-ink-800 transition-colors cursor-pointer select-none">
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="text-xs font-medium text-ink-200 block">Magnetized Drop Reticle</span>
                        <span className="text-[10px] text-ink-500 block">
                          Pulsating target lock ring with downward insertion pin when dragging over timeline tracks.
                        </span>
                      </div>
                      <input
                        data-testid="toggle-cursor-drop-reticle"
                        type="checkbox"
                        checked={cursorConfig.showDropReticle !== false}
                        onChange={(e) => setCursorConfig({ showDropReticle: e.target.checked })}
                        className="h-4 w-4 rounded border-ink-700 bg-ink-800 accent-violet-500 cursor-pointer"
                      />
                    </label>

                    {/* Attached Drag Ghost Pill */}
                    <label className="flex items-center justify-between p-2 rounded-lg bg-ink-850 hover:bg-ink-800 transition-colors cursor-pointer select-none">
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="text-xs font-medium text-ink-200 block">Attached Drag Ghost Pill</span>
                        <span className="text-[10px] text-ink-500 block">
                          Floating metadata badge attached to cursor showing active asset title during dragging.
                        </span>
                      </div>
                      <input
                        data-testid="toggle-cursor-drag-pill"
                        type="checkbox"
                        checked={cursorConfig.showDragPill !== false}
                        onChange={(e) => setCursorConfig({ showDragPill: e.target.checked })}
                        className="h-4 w-4 rounded border-ink-700 bg-ink-800 accent-violet-500 cursor-pointer"
                      />
                    </label>

                    {/* Click Micro-Burst */}
                    <label className="flex items-center justify-between p-2 rounded-lg bg-ink-850 hover:bg-ink-800 transition-colors cursor-pointer select-none">
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="text-xs font-medium text-ink-200 block">Click Micro-Burst Ripple</span>
                        <span className="text-[10px] text-ink-500 block">
                          Expanding shockwave ring at cursor tip on every click.
                        </span>
                      </div>
                      <input
                        data-testid="toggle-cursor-burst"
                        type="checkbox"
                        checked={cursorConfig.showClickBurst}
                        onChange={(e) => setCursorConfig({ showClickBurst: e.target.checked })}
                        className="h-4 w-4 rounded border-ink-700 bg-ink-800 accent-violet-500 cursor-pointer"
                      />
                    </label>
                  </div>

                  {/* Interactive Cursor Test Playground */}
                  <div
                    data-testid="cursor-test-playground"
                    className="p-3 rounded-lg border border-ink-700/80 bg-ink-900/90 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                        Interactive Cursor Playground
                      </span>
                      <span className="text-[9px] text-ink-500">Test states live below</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {/* Test Draggable Asset */}
                      <div
                        draggable
                        data-testid="playground-drag-item"
                        data-asset-name="Cyber_Clip.mp4"
                        data-asset-kind="video"
                        className="p-2 rounded bg-ink-800 border border-ink-700 text-center cursor-grab hover:border-emerald-500 transition-colors select-none"
                      >
                        <div className="text-[10px] font-medium text-emerald-400">Draggable Card</div>
                        <div className="text-[10px] text-ink-500">Hover for + badge</div>
                      </div>

                      {/* Test Drop Zone */}
                      <div
                        data-drop-target="true"
                        data-testid="playground-drop-target"
                        className="p-2 rounded bg-emerald-950/30 border border-emerald-500/50 text-center select-none"
                      >
                        <div className="text-[10px] font-medium text-emerald-300">Drop Zone</div>
                        <div className="text-[10px] text-emerald-500">Drag here for reticle</div>
                      </div>

                      {/* Test Info Button */}
                      <button
                        type="button"
                        data-testid="playground-help-btn"
                        data-help="true"
                        title="OmniFrame Audio-Visual Codec & GPU Engine Specifications"
                        className="p-2 rounded bg-ink-800 border border-ink-700 text-center hover:border-amber-500 transition-colors"
                      >
                        <div className="text-[10px] font-medium text-amber-400">Help / Specs (?)</div>
                        <div className="text-[10px] text-ink-500">Hover for ? badge</div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!settingsSearch && settingsCategory === 'accessibility' && (
                <label className="flex items-center justify-between gap-4 text-xs">
                  <span>
                    <span className="block text-ink-200">Reduce motion</span>
                    <span className="mt-1 block text-ink-500">Minimize nonessential interface animation.</span>
                  </span>
                  <input
                    aria-label="Reduce motion"
                    type="checkbox"
                    checked={reducedMotion}
                    onChange={(event) => setReducedMotion(event.target.checked)}
                    className="h-4 w-4 accent-violet-500"
                  />
                </label>
              )}

              {!settingsSearch && settingsCategory === 'ai' && (
                <div className="space-y-3 text-xs">
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] leading-relaxed text-amber-200">
                    <strong>Enter an API key only.</strong> Never paste source code, prompts, passwords, recovery
                    codes, or other private information here. Browser requests expose the key to this tab and the
                    selected provider; use a restricted key with spending limits.
                  </div>
                  <label className="block text-ink-300">
                    <span className="mb-1 block">Provider</span>
                    <select
                      data-testid="setting-ai-provider"
                      aria-label="AI provider"
                      value={aiProvider}
                      onChange={(event) => selectAiProvider(event.target.value as AiProviderId)}
                      className="h-8 w-full rounded-md border border-ink-700 bg-ink-800 px-2 text-xs"
                    >
                      {AI_PROVIDERS.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {aiProvider === 'custom' && (
                    <label className="block text-ink-300">
                      <span className="mb-1 block">HTTPS API base URL</span>
                      <input
                        aria-label="Custom AI endpoint"
                        type="url"
                        placeholder="https://example.com/v1"
                        value={aiEndpoint}
                        onChange={(event) => setAiEndpoint(event.target.value)}
                        className="h-8 w-full rounded-md border border-ink-700 bg-ink-800 px-2 text-xs"
                      />
                      <span className="mt-1 block text-[10px] text-ink-500">
                        Must implement the OpenAI compatible /chat/completions endpoint. Do not paste JavaScript or
                        configuration code.
                      </span>
                    </label>
                  )}
                  <label className="block text-ink-300">
                    <span className="mb-1 block">Model ID</span>
                    <input
                      data-testid="setting-ai-model"
                      aria-label="AI model ID"
                      autoComplete="off"
                      value={aiModel}
                      onChange={(event) => setAiModel(event.target.value)}
                      className="h-8 w-full rounded-md border border-ink-700 bg-ink-800 px-2 text-xs"
                    />
                    <span className="mt-1 block text-[10px] text-ink-500">
                      Use the exact model ID shown by your provider, not code or a model description.
                    </span>
                  </label>
                  <label className="block text-ink-300">
                    <span className="mb-1 block">API key</span>
                    <input
                      data-testid="setting-ai-api-key"
                      aria-label="AI API key"
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={AI_PROVIDERS.find((provider) => provider.id === aiProvider)?.keyPrefixHint}
                      value={aiApiKey}
                      onChange={(event) => setAiApiKey(event.target.value)}
                      className="h-8 w-full rounded-md border border-ink-700 bg-ink-800 px-2 text-xs"
                    />
                    <span className="mt-1 block text-[10px] text-ink-500">
                      Stored in memory only; cleared when the tab closes. Obtain it from the provider's official
                      console.
                    </span>
                  </label>
                  <button
                    type="button"
                    disabled={aiTestState === 'testing'}
                    onClick={testProvider}
                    className="h-8 rounded-md border border-ink-600 bg-ink-800 px-3 text-xs text-ink-200 hover:bg-ink-700 disabled:opacity-50"
                  >
                    {aiTestState === 'testing' ? 'Testing…' : 'Test connection'}
                  </button>
                  {aiTestMessage && (
                    <p
                      role="status"
                      className={aiTestState === 'success' ? 'text-emerald-400' : 'text-red-400'}
                    >
                      {aiTestMessage}
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {exporting && (
        <div className="fixed bottom-4 right-4 z-50 w-72 bg-ink-850 border border-ink-700 rounded-lg shadow-xl p-3 of-fade">
          <div className="text-xs text-ink-300 mb-2">{status}</div>
          <div className="h-1.5 rounded-full bg-ink-700 overflow-hidden">
            <div className="h-full bg-brand transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className="text-[11px] text-ink-500 mt-1 text-right">{Math.round(progress * 100)}%</div>
        </div>
      )}

      <LayoutManagerModal isOpen={layoutModalOpen} onClose={() => setLayoutModalOpen(false)} />
    </header>
  )
}
