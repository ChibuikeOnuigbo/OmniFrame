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
} from 'lucide-react'
import { useEditor } from '../store'
import type { WorkspacePreset, FocusMode } from '../types'
import { exportVideo } from '../lib/export'
import { SETTINGS_CATEGORIES, searchSettings, type SettingsCategory } from '../lib/settingsRegistry'
import { AI_PROVIDERS, testAiConnection, type AiProviderId } from '../lib/aiProviders'
import { IconButton } from './ui'

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

  const fileInput = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [layoutOpen, setLayoutOpen] = useState(false)
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
        <Film size={18} className="text-brand" />
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
            className="fixed right-16 top-12 z-[80] flex w-64 flex-col overflow-hidden rounded-xl border border-ink-600 bg-[#11131d]/[0.98] shadow-[0_20px_60px_rgba(0,0,0,.5)] backdrop-blur-xl p-2 text-xs text-ink-200"
          >
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              Workspace Presets
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
                className={`flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-ink-700 transition-colors ${
                  workspacePreset === p.id ? 'bg-brand/20 text-brand font-medium' : 'text-ink-300'
                }`}
              >
                <span>{p.label}</span>
                {workspacePreset === p.id && <Check size={14} />}
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
                  focusMode === m.id ? 'bg-brand/20 text-brand font-medium' : 'text-ink-300'
                }`}
              >
                <span>{m.label}</span>
                {focusMode === m.id && <Check size={14} />}
              </button>
            ))}
          </div>
        )}
      </div>

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
        <div ref={settingsRef} data-testid="settings-popup" role="dialog" aria-label="Settings" className="fixed right-3 top-12 z-[80] flex w-[min(440px,calc(100vw-24px))] max-h-[min(420px,calc(100vh-64px))] flex-col overflow-hidden rounded-xl border border-ink-600 bg-[#11131d]/[0.98] shadow-[0_20px_60px_rgba(0,0,0,.5)] backdrop-blur-xl">
          <header className="border-b border-ink-700 p-3">
            <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">Settings</h2><button aria-label="Close settings" onClick={() => setSettingsOpen(false)} className="grid h-7 w-7 place-items-center rounded-md text-ink-400 hover:bg-ink-700 hover:text-white"><X size={14} /></button></div>
            <input type="search" aria-label="Search settings" placeholder="Search settings" value={settingsSearch} onChange={(event) => setSettingsSearch(event.target.value)} className="h-8 w-full rounded-md border border-ink-700 bg-ink-800 px-2 text-xs text-ink-200 outline-none placeholder:text-ink-500 focus:border-brand" />
          </header>
          <div className="flex min-h-0 flex-1">
          <nav aria-label="Settings categories" className="w-32 shrink-0 border-r border-ink-700 p-2">
            {SETTINGS_CATEGORIES.map((category) => (
              <button key={category} data-testid="settings-category" aria-pressed={settingsCategory === category} onClick={() => setSettingsCategory(category)} className={`mb-1 h-9 w-full rounded-lg px-3 text-left text-xs capitalize outline-none focus-visible:ring-2 focus-visible:ring-brand ${settingsCategory === category ? 'bg-brand/15 text-violet-200' : 'text-ink-400 hover:bg-ink-700 hover:text-white'}`}>{category}</button>
            ))}
          </nav>
          <section className="min-w-0 flex-1 overflow-y-auto p-4">
            <h3 className="mb-4 text-sm font-semibold capitalize">{settingsSearch ? 'Search results' : settingsCategory}</h3>
            {settingsSearch && <div data-testid="settings-search-results" className="space-y-1">{settingsMatches.length === 0 ? <p className="text-xs text-ink-500">No available settings match.</p> : settingsMatches.map((item) => <button key={item.id} type="button" onClick={() => { setSettingsCategory(item.category); setSettingsSearch('') }} className="block w-full rounded-md px-2 py-2 text-left hover:bg-ink-700"><span className="block text-xs text-ink-200">{item.label}</span><span className="mt-0.5 block text-[10px] capitalize text-ink-500">{item.category} · {item.scope}</span></button>)}</div>}
            {!settingsSearch && settingsCategory === 'timeline' && <div className="space-y-4"><label className="block text-xs text-ink-300"><span className="mb-2 block">Project frame rate</span><select aria-label="Project frame rate" value={projectFps} onChange={(event) => setProjectFps(Number(event.target.value))} className="h-8 w-full rounded-md border border-ink-700 bg-ink-800 px-2 text-xs text-ink-200">{[23.976,24,25,29.97,30,50,59.94,60,120].map((rate)=><option key={rate} value={rate}>{rate} fps</option>)}</select></label>{(projectFps === 29.97 || projectFps === 59.94) && <label className="flex items-center justify-between gap-4 text-xs text-ink-300"><span><span className="block">Drop-frame timecode</span><span className="mt-1 block text-[10px] text-ink-500">SMPTE clock-aligned display; timing is unchanged.</span></span><input aria-label="Drop-frame timecode" type="checkbox" checked={dropFrameTimecode} onChange={(event) => setDropFrameTimecode(event.target.checked)} className="h-4 w-4 accent-violet-500" /></label>}</div>}
            {!settingsSearch && settingsCategory === 'playback' && <div><div className="mb-2 text-xs text-ink-300">Preview quality</div><div role="radiogroup" aria-label="Preview quality" className="grid grid-cols-3 gap-2">{(['low','medium','high'] as const).map((quality)=><button key={quality} type="button" role="radio" aria-checked={previewQuality === quality} onClick={() => setPreviewQuality(quality)} className={`h-9 rounded-md border px-3 text-xs capitalize ${previewQuality === quality ? 'border-brand bg-brand/15 text-violet-200' : 'border-ink-700 bg-ink-800 text-ink-300 hover:bg-ink-700'}`}>{quality}</button>)}</div><p className="mt-3 text-[10px] leading-relaxed text-ink-500">Low is intentionally more pixelated for the lightest workload. Medium is only slightly soft. High adds a small clarity increase. Timeline timing and project FPS stay unchanged.</p></div>}
            {!settingsSearch && settingsCategory === 'shortcuts' && <dl className="space-y-2 text-xs">{[['Hide / unhide selected clip','H'],['Select tool','V'],['Blade tool','B'],['Undo','Ctrl / Cmd + Z']].map(([label,key])=><div key={label} className="flex items-center justify-between gap-3"><dt className="text-ink-300">{label}</dt><dd className="rounded border border-ink-700 bg-ink-800 px-2 py-1 font-mono text-[10px] text-ink-400">{key}</dd></div>)}</dl>}
            {!settingsSearch && settingsCategory === 'accessibility' && <label className="flex items-center justify-between gap-4 text-xs"><span><span className="block text-ink-200">Reduce motion</span><span className="mt-1 block text-ink-500">Minimize nonessential interface animation.</span></span><input aria-label="Reduce motion" type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} className="h-4 w-4 accent-violet-500" /></label>}
            {!settingsSearch && settingsCategory === 'ai' && <div className="space-y-3 text-xs">
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] leading-relaxed text-amber-200"><strong>Enter an API key only.</strong> Never paste source code, prompts, passwords, recovery codes, or other private information here. Browser requests expose the key to this tab and the selected provider; use a restricted key with spending limits.</div>
              <label className="block text-ink-300"><span className="mb-1 block">Provider</span><select data-testid="setting-ai-provider" aria-label="AI provider" value={aiProvider} onChange={(event) => selectAiProvider(event.target.value as AiProviderId)} className="h-8 w-full rounded-md border border-ink-700 bg-ink-800 px-2 text-xs">{AI_PROVIDERS.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}</select></label>
              {aiProvider === 'custom' && <label className="block text-ink-300"><span className="mb-1 block">HTTPS API base URL</span><input aria-label="Custom AI endpoint" type="url" placeholder="https://example.com/v1" value={aiEndpoint} onChange={(event) => setAiEndpoint(event.target.value)} className="h-8 w-full rounded-md border border-ink-700 bg-ink-800 px-2 text-xs" /><span className="mt-1 block text-[10px] text-ink-500">Must implement the OpenAI-compatible /chat/completions endpoint. Do not paste JavaScript or configuration code.</span></label>}
              <label className="block text-ink-300"><span className="mb-1 block">Model ID</span><input data-testid="setting-ai-model" aria-label="AI model ID" autoComplete="off" value={aiModel} onChange={(event) => setAiModel(event.target.value)} className="h-8 w-full rounded-md border border-ink-700 bg-ink-800 px-2 text-xs" /><span className="mt-1 block text-[10px] text-ink-500">Use the exact model ID shown by your provider—not code or a model description.</span></label>
              <label className="block text-ink-300"><span className="mb-1 block">API key</span><input data-testid="setting-ai-api-key" aria-label="AI API key" type="password" autoComplete="off" spellCheck={false} placeholder={AI_PROVIDERS.find((provider) => provider.id === aiProvider)?.keyPrefixHint} value={aiApiKey} onChange={(event) => setAiApiKey(event.target.value)} className="h-8 w-full rounded-md border border-ink-700 bg-ink-800 px-2 text-xs" /><span className="mt-1 block text-[10px] text-ink-500">Stored in memory only; cleared when the tab closes. Obtain it from the provider's official console.</span></label>
              <button type="button" disabled={aiTestState === 'testing'} onClick={testProvider} className="h-8 rounded-md border border-ink-600 bg-ink-800 px-3 text-xs text-ink-200 hover:bg-ink-700 disabled:opacity-50">{aiTestState === 'testing' ? 'Testing…' : 'Test connection'}</button>
              {aiTestMessage && <p role="status" className={aiTestState === 'success' ? 'text-emerald-400' : 'text-red-400'}>{aiTestMessage}</p>}
            </div>}
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
    </header>
  )
}
