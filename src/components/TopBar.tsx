import { ProxyProgress } from './ProxyProgress'
import { PerformanceSettings } from './PerformanceSettings'
import { ViewportMenu } from './ViewportMenu'
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
  Settings2,
  MoreHorizontal,
  LayoutGrid,
  Check,
  Maximize,
  X,
  Sliders,
  HelpCircle,
  Monitor,
  Save,
  FolderOpen,
  ChevronDown,
  Image as ImageIcon,
  Box,
} from 'lucide-react'
import { useEditor } from '../store'
import type { WorkspacePreset, FocusMode } from '../types'
import { exportVideo } from '../lib/export'
import { exportPrimitiveSceneObj, exportProgramFramePng } from '../lib/projectSubsets'
import { EDITABLE_SHORTCUTS, SETTINGS_CATEGORIES, searchSettings, type SettingsCategory } from '../lib/settingsRegistry'
import { UI_STYLES, UI_PALETTES } from '../lib/uiStyles'
import { AI_PROVIDERS, testAiConnectionFull, submitFineTuneJob, getFineTuneJobStatus, type AiProviderId } from '../lib/aiProviders'
import { MODEL_CAPABILITIES, equivalentsFor, equivalentAcrossProviders, FINETUNE_BASES, type ModelCapability } from '../lib/modelCatalog'
import { buildFineTuneDataset, downloadTextFile } from '../lib/fineTune'
import { getGifProviderKey, setGifProviderKey } from '../lib/giphy'
import {
  getDesktopInfo,
  toggleDesktopFullscreen,
  type DesktopInfo,
} from '../lib/desktop'
import { IconButton } from './ui'
import { WorkspaceSchematic } from './WorkspaceSchematic'
import { LayoutManagerModal } from './LayoutManagerModal'
import CompositionSettingsModal from './CompositionSettingsModal'

export function TopBar() {
  // Native desktop (Tauri) info — null in the plain browser build, so the
  // Desktop badge only renders when the app runs inside the Rust shell.
  const [desktopInfo, setDesktopInfo] = useState<DesktopInfo | null>(null)
  useEffect(() => {
    let cancelled = false
    getDesktopInfo().then((info) => {
      if (!cancelled) setDesktopInfo(info)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const importFiles = useEditor((s) => s.importFiles)
  const saveOmniProject = useEditor((s) => s.saveOmniProject)
  const loadOmniProject = useEditor((s) => s.loadOmniProject)
  const projectName = useEditor((s) => s.projectName)
  const setProjectName = useEditor((s) => s.setProjectName)
  const exportClips = useEditor((s) => s.clips)
  const exportTracks = useEditor((s) => s.tracks)
  const exportPlayhead = useEditor((s) => s.playhead)
  const monitorMode = useEditor((s) => s.monitorMode)
  const setMonitorMode = useEditor((s) => s.setMonitorMode)
  const is3DMode = useEditor((s) => s.is3DMode)
  const export3DObjects = useEditor((s) => s.scene3DObjects)
  const exportAssets = useEditor((s) => s.assets)
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
  const projectInput = useRef<HTMLInputElement>(null)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const [projectStatus, setProjectStatus] = useState('')
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [mobileToolsOpen,setMobileToolsOpen]=useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [layoutModalOpen, setLayoutModalOpen] = useState(false)
  const [compOpen, setCompOpen] = useState(false)
  const layoutRef = useRef<HTMLDivElement>(null)
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>('timeline')
  const [settingsSearch, setSettingsSearch] = useState('')
  const settingsMatches = searchSettings(settingsSearch)
  // Provider state lives in the store so every panel sees the same
  // connection; the key itself is memory-only (never persisted).
  const aiProvider = useEditor((s) => s.aiProvider) as AiProviderId
  const aiModel = useEditor((s) => s.aiModel)
  const aiEndpoint = useEditor((s) => s.aiEndpoint)
  const aiApiKey = useEditor((s) => s.aiApiKey)
  const setAiProviderState = useEditor((s) => s.setAiProvider)
  const setAiModel = useEditor((s) => s.setAiModel)
  const setAiEndpoint = useEditor((s) => s.setAiEndpoint)
  const setAiApiKey = useEditor((s) => s.setAiApiKey)
  const aiCapabilityModels = useEditor((s) => s.aiCapabilityModels)
  const setAiCapabilityModel = useEditor((s) => s.setAiCapabilityModel)
  const aiConnection = useEditor((s) => s.aiConnection)
  const setAiConnection = useEditor((s) => s.setAiConnection)
  const customEffects = useEditor((s) => s.customEffects)
  const [aiTestState, setAiTestState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [aiTestMessage, setAiTestMessage] = useState('')
  const [modelCap, setModelCap] = useState<ModelCapability>('chat')
  const [ftBase, setFtBase] = useState('gpt-4o-mini-2024-07-18')
  const [ftEpochs, setFtEpochs] = useState(3)
  const [ftSuffix, setFtSuffix] = useState('omniframe-effects')
  const [ftJob, setFtJob] = useState<{ id: string; status: string; model: string | null } | null>(null)
  const [ftBusy, setFtBusy] = useState(false)
  const [ftMessage, setFtMessage] = useState('')
  const [giphyApiKey, setGiphyApiKey] = useState(() => getGifProviderKey('giphy') || String(import.meta.env.VITE_GIPHY_API_KEY || ''))
  const [klipyApiKey, setKlipyApiKey] = useState(() => getGifProviderKey('klipy') || String(import.meta.env.VITE_KLIPY_API_KEY || ''))

  const selectAiProvider = (id: AiProviderId) => {
    const provider = AI_PROVIDERS.find((item) => item.id === id)!
    setAiProviderState(id)
    setAiModel(provider.defaultModel)
    setAiEndpoint(provider.endpoint)
    setAiTestState('idle')
    setAiTestMessage('')
  }

  const testProvider = async () => {
    setAiTestState('testing')
    setAiTestMessage('')
    setAiConnection({ status: 'testing', message: 'Pinging provider…', latencyMs: null })
    try {
      const report = await testAiConnectionFull({ provider: aiProvider, apiKey: aiApiKey, model: aiModel, endpoint: aiEndpoint })
      setAiTestState('success')
      const parts = [`Connected in ${report.latencyMs} ms — the model replied.`]
      if (report.modelsListed !== null) parts.push(`${report.modelsListed} models on this account.`)
      if (report.modelAvailable === false) parts.push(`Note: “${aiModel}” was not in the account's model list — check the ID.`)
      setAiTestMessage(parts.join(' '))
      setAiConnection({ status: 'connected', message: parts.join(' '), latencyMs: report.latencyMs, modelAvailable: report.modelAvailable })
    } catch (error) {
      setAiTestState('error')
      const message = error instanceof Error ? error.message : 'Connection failed.'
      setAiTestMessage(message)
      setAiConnection({ status: 'error', message, latencyMs: null })
    }
  }

  const providerConfig = { provider: aiProvider, apiKey: aiApiKey, model: aiModel, endpoint: aiEndpoint }
  const ftDataset = buildFineTuneDataset(customEffects)
  const submitFineTune = async () => {
    setFtBusy(true)
    setFtMessage('')
    try {
      const created = await submitFineTuneJob(providerConfig, { jsonl: ftDataset.jsonl, baseModel: ftBase, suffix: ftSuffix, epochs: ftEpochs })
      setFtJob({ id: created.jobId, status: created.status, model: null })
      setFtMessage(`Job ${created.jobId} created (${created.status}). Training runs on the provider — poll for status, then pick the tuned model above.`)
    } catch (error) {
      setFtMessage(error instanceof Error ? error.message : 'Fine-tune submit failed.')
    } finally {
      setFtBusy(false)
    }
  }
  const pollFineTune = async () => {
    if (!ftJob) return
    setFtBusy(true)
    try {
      const status = await getFineTuneJobStatus(providerConfig, ftJob.id)
      setFtJob({ ...ftJob, status: status.status, model: status.fineTunedModel })
      if (status.fineTunedModel) setFtMessage(`Done — your tuned model is “${status.fineTunedModel}”. It is now selected as the active model.`)
      if (status.fineTunedModel) setAiModel(status.fineTunedModel)
    } catch (error) {
      setFtMessage(error instanceof Error ? error.message : 'Status check failed.')
    } finally {
      setFtBusy(false)
    }
  }
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem('omniframe.reducedMotion') === 'true')
  const hideOverflowX = useEditor((s) => s.hideOverflowX)
  const uiStyle = useEditor((s) => s.uiStyle)
  const uiPalette = useEditor((s) => s.uiPalette)
  const setUiStyle = useEditor((s) => s.setUiStyle)
  const setUiPalette = useEditor((s) => s.setUiPalette)
  const dockerPrefs = useEditor((s) => s.dockerPrefs)
  const setDockerPref = useEditor((s) => s.setDockerPref)
  const leftTab = useEditor((s) => s.leftTab)
  const drawingEnabledTop = useEditor((s) => s.drawingEnabled)
  const setHideOverflowX = useEditor((s) => s.setHideOverflowX)
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

  useEffect(() => {
    if (!exportMenuOpen) return
    const closeOutside = (event: PointerEvent) => {
      if (!exportMenuRef.current?.contains(event.target as Node)) setExportMenuOpen(false)
    }
    const closeEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExportMenuOpen(false) }
    window.addEventListener('pointerdown', closeOutside)
    window.addEventListener('keydown', closeEscape)
    return () => { window.removeEventListener('pointerdown', closeOutside); window.removeEventListener('keydown', closeEscape) }
  }, [exportMenuOpen])

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length) importFiles(e.target.files)
    e.target.value = ''
  }

  const onSaveOmniProject = async () => {
    const requestedName = window.prompt('Save complete OmniFrame project as .omni', projectName || 'Untitled')
    if (requestedName === null) return
    const name = requestedName.trim() || 'Untitled'
    const safeName = (name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 120) || 'OmniFrame Project').replace(/\.omni$/i, '') || 'OmniFrame Project'
    setProjectStatus('Bundling project state and source media…')
    try {
      const bundle = await saveOmniProject(name)
      setProjectName(name)
      const url = URL.createObjectURL(bundle)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${safeName}.omni`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
      setProjectStatus(`Saved ${safeName}.omni, complete OmniFrame project bundle`)
    } catch (error) {
      setProjectStatus(`Could not save .omni: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const onPickOmniProject = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setProjectStatus(`Opening ${file.name}…`)
    void loadOmniProject(file).then(() => {
      setProjectStatus(`Opened ${file.name}, project state and embedded source media restored`)
    }).catch((error) => {
      setProjectStatus(`Could not open .omni: ${error instanceof Error ? error.message : String(error)}`)
    })
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

  const visibleTrackIds = new Set(exportTracks.filter((track) => !track.hidden).map((track) => track.id))
  const hasVisibleNonStillTimelineContent = exportClips.some((clip) =>
    ['video', 'audio', 'threed', 'compound'].includes(clip.kind) && !clip.hidden && visibleTrackIds.has(clip.trackId),
  )
  const hasVisibleVisualTimelineContent = exportClips.some((clip) =>
    ['video', 'image', 'text', 'threed', 'compound'].includes(clip.kind) && !clip.hidden && visibleTrackIds.has(clip.trackId),
  )
  const canExportVideo = hasVisibleNonStillTimelineContent && hasVisibleVisualTimelineContent
  const hasVisibleStillAtPlayhead = exportClips.some((clip) =>
    ['image', 'text'].includes(clip.kind) && !clip.hidden && visibleTrackIds.has(clip.trackId) &&
    exportPlayhead >= clip.start && exportPlayhead < clip.start + clip.duration,
  )
  // Still-only timelines are images, not video sequences. Video export also
  // needs visible picture content; audio-only timelines should not yield a blank video.
  // Mixed timelines with motion/audio/3D/compound content cannot be represented by PNG.
  const canExportPng = !is3DMode && !hasVisibleNonStillTimelineContent && hasVisibleStillAtPlayhead
  const canExportObj = is3DMode && export3DObjects.length > 0
  const hasImported3DModels = exportAssets.some((asset) => asset.kind === 'threed')

  const downloadSubset = (blob: Blob, extension: string) => {
    const safeName = (projectName || 'OmniFrame Project').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 120)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${safeName || 'OmniFrame Project'}.${extension}`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }

  const onExportPng = async () => {
    setExportMenuOpen(false)
    const previousMonitorMode = monitorMode
    try {
      // Program Monitor content is the rendered source of the flattened PNG.
      // Switching is temporary when the user was inspecting a source asset.
      if (previousMonitorMode !== 'program') setMonitorMode('program')
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      await new Promise((resolve) => window.setTimeout(resolve, 80))
      const blob = await exportProgramFramePng()
      downloadSubset(blob, 'png')
      setProjectStatus('Exported PNG, flattened current still frame only; use .omni for the editable project.')
    } catch (error) {
      setProjectStatus(`Could not export PNG: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      if (previousMonitorMode !== 'program') setMonitorMode(previousMonitorMode)
    }
  }

  const onExportObj = async () => {
    setExportMenuOpen(false)
    try {
      const blob = await exportPrimitiveSceneObj(export3DObjects)
      downloadSubset(blob, 'obj')
      setProjectStatus('Exported OBJ geometry subset, materials, animation, timeline, media and effects are not included.')
    } catch (error) {
      setProjectStatus(`Could not export OBJ: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return (
    <header className="h-12 min-w-0 shrink-0 flex items-center gap-1 px-1 bg-ink-900 border-b border-ink-700 sm:gap-2 sm:px-3">
      <button
        type="button"
        title={leftOpen ? 'Hide panel' : 'Show panel'}
        aria-label={leftOpen ? 'Hide tool panels' : 'Show tool panels'}
        aria-expanded={leftOpen}
        aria-controls="left-panel"
        onClick={() => setLeftOpen(!leftOpen)}
        className="grid h-8 w-8 place-items-center rounded-none text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {leftOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
      </button>

      <div className="flex shrink-0 items-center gap-1 pl-0.5 pr-0.5 sm:gap-2 sm:pl-1 sm:pr-2">
        <Film size={18} className="text-brand-400" />
        <span className="hidden sm:inline font-semibold tracking-tight text-sm">OmniFrame</span>
        {desktopInfo && (
          <button
            type="button"
            data-testid="desktop-badge"
            aria-label={`Desktop build ${desktopInfo.appVersion} on ${desktopInfo.os} ${desktopInfo.arch}. Toggle fullscreen.`}
            title={`Desktop build ${desktopInfo.appVersion}, ${desktopInfo.os}/${desktopInfo.arch} — click to toggle fullscreen`}
            onClick={async () => {
              const fullscreen = await toggleDesktopFullscreen()
              if (fullscreen !== null) {
                setDesktopInfo((d) => (d ? { ...d, fullscreen } : d))
              }
            }}
            className="hidden md:inline-flex items-center gap-1 rounded border border-ok/40 bg-ok/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ok transition-colors hover:bg-ok/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Monitor size={10} aria-hidden="true" />
            Desktop, {desktopInfo.os}
          </button>
        )}
      </div>

      <div className="flex-1" />

      {/* history group */}
      <div role="group" aria-label="History actions" className="flex items-center gap-1">
        <IconButton title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
          <Undo2 size={16} />
        </IconButton>
        <IconButton title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
          <Redo2 size={16} />
        </IconButton>
      </div>

      <div role="separator" aria-orientation="vertical" className="h-6 w-px bg-ink-700" />

      <div role="group" aria-label="Import media">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          title="Import media"
          aria-label="Import media"
          className="flex h-8 items-center gap-2 rounded-none bg-brand px-2 text-xs font-medium text-white transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 sm:px-3"
        >
          <Upload size={15} aria-hidden="true" />
          <span className="hidden sm:inline">Import</span>
        </button>
        <input id="topbar-import-input" data-testid="import-input" aria-label="Import media files" ref={fileInput} type="file" accept="video/*,image/*,audio/*,.psd,.ora,.kra,.psb,.xcf,.clip,.cmc,.procreate,.afphoto,.afdesign,.pdn,.mdp,.rif,.ai" multiple hidden onChange={onPickFiles} />
      </div>

      <div role="group" aria-label="OmniFrame project" className="hidden shrink-0 items-center gap-0.5 min-[420px]:flex sm:gap-1">
        <button
          type="button"
          data-testid="save-omni-project"
          onClick={onSaveOmniProject}
          title="Save the complete OmniFrame project as .omni"
          aria-label="Save .omni — complete OmniFrame project"
          className="flex h-8 shrink-0 items-center gap-1 rounded-none border border-ink-700 bg-ink-800 px-1 text-xs font-medium text-ink-200 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:gap-1.5 sm:px-2"
        >
          <Save size={14} aria-hidden="true" />
          <span className="hidden lg:inline">Save .omni</span>
        </button>
        <button
          type="button"
          data-testid="open-omni-project"
          onClick={() => projectInput.current?.click()}
          title="Open a saved OmniFrame .omni project"
          aria-label="Open OmniFrame project"
          className="grid h-8 w-8 place-items-center rounded-none border border-ink-700 bg-ink-800 text-ink-300 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <FolderOpen size={15} aria-hidden="true" />
        </button>
        <input
          ref={projectInput}
          type="file"
          accept=".omni,application/x-omniframe-project"
          aria-label="Open OmniFrame project file"
          data-testid="omni-project-input"
          hidden
          onChange={onPickOmniProject}
        />
      </div>
      {projectStatus && (
        <span role="status" data-testid="omni-project-status" className="hidden max-w-48 truncate text-[10px] text-ink-400 xl:inline">
          {projectStatus}
        </span>
      )}

      <div role="group" aria-label="Workspace layout" className="relative">
        <button
          type="button"
          data-testid="workspace-layout-btn"
          title="Workspace Layout & Focus Mode"
          aria-label="Workspace Layout"
          aria-haspopup="dialog"
          aria-expanded={layoutOpen}
          aria-controls={layoutOpen ? 'layout-popup' : undefined}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setLayoutOpen((open) => !open)}
          className={`hidden sm:grid h-8 w-8 place-items-center rounded-none border border-ink-700 bg-ink-800 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            layoutOpen ? 'bg-ink-700 text-white' : 'text-ink-400'
          }`}
        >
          <LayoutGrid size={15} />
        </button>

        {layoutOpen && (
          <div
            ref={layoutRef}
            id="layout-popup"
            data-testid="layout-popup"
            role="dialog"
            aria-label="Workspace Layouts"
            className="fixed right-16 top-12 z-[80] flex w-72 flex-col overflow-hidden rounded-xl border border-ink-600 bg-ink-900/[0.98] shadow-[0_20px_60px_rgba(0,0,0,.5)] backdrop-blur-xl p-2 text-xs text-ink-200"
          >
            <div role="group" aria-labelledby="workspace-presets-heading">
              <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                <span id="workspace-presets-heading">Workspace Presets</span>
                <button
                  type="button"
                  data-testid="open-layout-manager-btn"
                  onClick={() => {
                    setLayoutOpen(false)
                    setLayoutModalOpen(true)
                  }}
                  className="min-h-8 rounded px-1 capitalize text-brand-400 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
                { id: 'audio', label: 'Audio Suite' },
                { id: 'vfx', label: 'VFX & Tracking' },
                { id: 'rig', label: 'Rig & Animate' },
                { id: 'manga', label: 'Manga / MMV Edit' },
                { id: 'capcut', label: 'CapCut Studio' },
                { id: 'cinema', label: 'Cinema Review' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`preset-${p.id}`}
                  aria-pressed={workspacePreset === p.id && focusMode === 'none'}
                  onClick={() => {
                    setWorkspacePreset(p.id as WorkspacePreset)
                    setLayoutOpen(false)
                  }}
                  className={`flex min-h-8 items-center justify-between gap-2 rounded-none px-2 py-1.5 transition-colors hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${
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
            </div>

            <div className="my-1 border-t border-ink-700" />

            <div role="group" aria-labelledby="workspace-focus-heading">
              <div id="workspace-focus-heading" className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
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
                  aria-pressed={focusMode === m.id}
                  onClick={() => {
                    setFocusMode(m.id as FocusMode)
                    setLayoutOpen(false)
                  }}
                  className={`flex min-h-8 items-center justify-between rounded-none px-2 py-1.5 transition-colors hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${
                    focusMode === m.id ? 'bg-brand/20 text-brand-400 font-medium' : 'text-ink-300'
                  }`}
                >
                  <span>{m.label}</span>
                  {focusMode === m.id && <Check size={14} className="text-brand-400" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="sm:hidden">
        <button type="button" aria-label="Workspace tools" aria-haspopup="menu" aria-expanded={mobileToolsOpen} data-testid="mobile-workspace-tools" className="grid h-10 w-10 place-items-center rounded-md border border-ink-700 bg-ink-800 text-ink-300" onClick={()=>setMobileToolsOpen(!mobileToolsOpen)}><MoreHorizontal size={20}/></button>
        {mobileToolsOpen&&<><div className="fixed inset-0 z-[75]" onPointerDown={()=>setMobileToolsOpen(false)}/><ViewportMenu x={window.innerWidth-240} y={52} testId="mobile-workspace-menu" label="Workspace tools" onClose={()=>setMobileToolsOpen(false)}>{[
          {name:'Workspace layout',run:()=>setLayoutOpen(true)},
          {name:'Composition settings',run:()=>setCompOpen(true)},
          {name:'Appearance & palette',run:()=>{setSettingsCategory('appearance');setSettingsOpen(true)}},
          {name:'Help & shortcuts',run:()=>useEditor.getState().setHelpOpen(true)},
        ].map(item=><button key={item.name} type="button" className="flex min-h-10 w-full items-center rounded px-3 text-left text-xs hover:bg-ink-700 focus-visible:ring-2 focus-visible:ring-brand" onClick={()=>{setMobileToolsOpen(false);item.run()}}>{item.name}</button>)}</ViewportMenu></>}
      </div>
      <div role="group" aria-label="Help and settings" className="flex items-center gap-1">
        <button
          type="button"
          data-testid="help-info-button"
          data-help="true"
          title="Help and editor specifications (?)"
            aria-label="Help and specifications"
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
          aria-controls={settingsOpen ? 'settings-popup' : undefined}
          onClick={() => {
            setSettingsCategory('cursor')
            setSettingsOpen(true)
          }}
          className="hidden h-8 w-8 place-items-center rounded-none border border-ink-700 bg-ink-800 text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:grid"
        >
          <HelpCircle size={15} />
        </button>

        <button
          type="button"
          data-testid="settings-button"
          title="Settings"
            aria-label="Settings"
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
          aria-controls={settingsOpen ? 'settings-popup' : undefined}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setSettingsOpen((open) => !open)}
          className="grid h-8 w-8 place-items-center rounded-none border border-ink-700 bg-ink-800 text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Settings size={15} />
        </button>

        <button
          type="button"
          data-testid="composition-settings-button"
          title="Composition settings (size, frame rate, background)"
          aria-label="Composition settings"
          aria-haspopup="dialog"
          aria-expanded={compOpen}
          onClick={() => setCompOpen((open) => !open)}
          className="hidden sm:grid h-8 w-8 place-items-center rounded-none border border-ink-700 bg-ink-800 text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Settings2 size={15} />
        </button>
      </div>

      <div role="group" aria-label="Project exports" className="flex items-center gap-1">
        {canExportVideo && (
          <button
            type="button"
            data-testid="export-video-btn"
            onClick={onExport}
            disabled={exporting}
            title={exporting ? 'Exporting video' : 'Export the complete timeline as video'}
            aria-label={exporting ? 'Exporting video' : 'Export video'}
            className="flex h-8 items-center gap-2 rounded-none border border-ink-700 bg-ink-800 px-2 text-xs font-medium transition-colors hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
          >
            <Download size={15} />
            <span className="hidden sm:inline">{exporting ? 'Exporting…' : 'Export video'}</span>
          </button>
        )}
        <div className="relative" ref={exportMenuRef}>
          <button
            type="button"
            data-testid="export-options-toggle"
            onClick={() => setExportMenuOpen((open) => !open)}
            aria-label="More export formats"
            aria-haspopup="menu"
            aria-expanded={exportMenuOpen}
            title="Choose a content-compatible export format"
            className="grid h-8 w-8 place-items-center rounded-none border border-ink-700 bg-ink-800 text-ink-300 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <ChevronDown size={14} />
          </button>
          {exportMenuOpen && (
            <div role="menu" aria-label="Content-aware export formats" data-testid="subset-export-menu" className="absolute right-0 top-10 z-[90] w-80 max-w-[calc(100vw-24px)] rounded-xl border border-ink-600 bg-ink-900/[0.98] p-2 shadow-[0_20px_60px_rgba(0,0,0,.65)] backdrop-blur-xl">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Full editable project</div>
              <button
                type="button"
                role="menuitem"
                data-testid="export-omni-option"
                onClick={() => { setExportMenuOpen(false); void onSaveOmniProject() }}
                className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-xs text-ink-100 transition-colors hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Save size={14} className="text-brand-400" />
                <span><strong>Save .omni</strong><span className="ml-1 text-ink-400">— editable project + embedded media</span></span>
              </button>
              <div className="my-2 border-t border-ink-700" />
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Compatible subset exports</div>
              {canExportVideo && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="subset-export-video-option"
                    disabled={exporting}
                    onClick={() => { setExportMenuOpen(false); void onExport() }}
                    className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-xs text-ink-200 transition-colors hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
                  >
                    <Film size={14} className="text-amber-300" />
                    <span><strong>Video sequence</strong><span className="ml-1 text-ink-400">— rendered timeline; layers become frames</span></span>
                  </button>
                  <p data-testid="video-export-loss-warning" className="mx-2 my-1 rounded-none border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] leading-relaxed text-amber-200">
                    Video is a rendered copy, not an editable timeline. MediaRecorder chooses MP4 or WebM based on browser support.
                  </p>
                </>
              )}
              {canExportPng && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="subset-export-png-option"
                    onClick={() => void onExportPng()}
                    className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-xs text-ink-200 transition-colors hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <ImageIcon size={14} className="text-sky-300" />
                    <span><strong>PNG still</strong><span className="ml-1 text-ink-400">— flattened frame at playhead</span></span>
                  </button>
                  <p data-testid="png-export-loss-warning" className="mx-2 my-1 rounded-none border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] leading-relaxed text-amber-200">
                    PNG contains one flattened frame only; clip/layer structure, animation and all other frames are lost.
                  </p>
                </>
              )}
              {canExportObj && (
                <button
                  type="button"
                  role="menuitem"
                  data-testid="subset-export-obj-option"
                  onClick={onExportObj}
                  className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-xs text-ink-200 transition-colors hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <Box size={14} className="text-brand-300" />
                  <span><strong>OBJ 3D geometry</strong><span className="ml-1 text-ink-400">— scene primitives only</span></span>
                </button>
              )}
              {!canExportVideo && !canExportPng && !canExportObj && (
                <p data-testid="no-subset-export" className="px-2 py-2 text-xs text-ink-400">No compatible subset export is available for the current visible content. Save the editable project as .omni.</p>
              )}
              {(hasVisibleNonStillTimelineContent || is3DMode) && !canExportPng && (
                <p data-testid="png-export-loss-warning" className="mx-2 my-1 rounded-none border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] leading-relaxed text-amber-200">
                  PNG is withheld for this timeline because it contains video, audio, 3D, or compound content that a still image cannot represent.
                </p>
              )}
              {canExportObj && (
                <p data-testid="obj-export-loss-warning" className="mx-2 my-1 rounded-none border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] leading-relaxed text-amber-200">
                  OBJ contains geometry only; animation, materials/textures, effects, timeline media and 2D layers are omitted.
                </p>
              )}
              {canExportObj && hasImported3DModels && (
                <p className="mx-2 my-1 rounded-none border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] leading-relaxed text-amber-200">
                  Imported model files are also omitted; only OmniFrame scene primitives are written.
                </p>
              )}
              <div className="mt-2 border-t border-ink-700 px-2 pt-2 text-[10px] leading-relaxed text-ink-400">
                Subset exports discard content the target format cannot carry. Use <strong className="text-brand-300">.omni</strong> when you need the editable project or are unsure.
              </div>
            </div>
          )}
        </div>
      </div>

      <ProxyProgress />
      {settingsOpen && (
        <div
          ref={settingsRef}
          id="settings-popup"
          data-testid="settings-popup"
          role="dialog"
          aria-labelledby="settings-heading"
          className="fixed inset-x-2 top-14 sm:inset-auto sm:right-3 sm:top-12 z-[80] flex w-auto sm:w-[min(520px,calc(100vw-24px))] max-h-[min(540px,calc(100vh-64px))] flex-col overflow-hidden rounded-xl border border-ink-600 bg-ink-900/[0.98] shadow-[0_20px_60px_rgba(0,0,0,.6)] backdrop-blur-xl"
        >
          <header className="border-b border-ink-700 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 id="settings-heading" className="text-sm font-semibold">Settings</h2>
              <button
                type="button"
                aria-label="Close settings"
                onClick={() => setSettingsOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-none text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
              className="h-8 w-full rounded-none border border-ink-700 bg-ink-800 px-2 text-xs text-ink-200 outline-none placeholder:text-ink-500 focus:border-brand"
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
                      ? 'bg-brand/20 text-brand-200 font-medium'
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
                        className="block w-full rounded-none px-2 py-2 text-left hover:bg-ink-700"
                      >
                        <span className="block text-xs text-ink-200">{item.label}</span>
                        <span className="mt-0.5 block text-[10px] capitalize text-ink-500">
                          {item.category}, {item.scope}
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
                      className="h-8 w-full rounded-none border border-ink-700 bg-ink-800 px-2 text-xs text-ink-200"
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
                        className="h-4 w-4 accent-brand"
                      />
                    </label>
                  )}
                </div>
              )}

              {!settingsSearch && settingsCategory === 'playback' && (
                <div>
                  <div className="mb-2 text-xs text-ink-300">Preview quality</div>
                  <div role="radiogroup" aria-label="Preview quality" className="grid grid-cols-2 gap-2">
                    {(['low', 'medium', 'high', 'full'] as const).map((quality) => (
                      <button
                        key={quality}
                        type="button"
                        role="radio"
                        aria-checked={previewQuality === quality}
                        onClick={() => setPreviewQuality(quality)}
                        className={`h-9 rounded-none border px-3 text-xs capitalize ${
                          previewQuality === quality
                            ? 'border-brand bg-brand/15 text-brand-200'
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
                  <PerformanceSettings />
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
                            className="h-4 w-4 rounded border-ink-700 bg-ink-800 accent-brand cursor-pointer"
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
                      className="h-4 w-4 rounded border-ink-700 bg-ink-800 accent-brand cursor-pointer"
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
                          { id: 'pro-precision', label: 'Pro Precision', desc: 'Compact NLE-style, zero glow' },
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
                              ? 'border-brand bg-brand/20 text-brand-200 shadow-sm'
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
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { id: 'compact', label: 'Compact', desc: '0.70x precision work' },
                          { id: 'standard', label: 'Standard', desc: '0.85x native size' },
                          { id: 'bigger', label: 'Bigger', desc: '1.10x enlarged' },
                          { id: 'mega', label: 'Mega', desc: '1.35x high-vis' },
                        ] as const
                      ).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          data-testid={`cursor-size-${item.id}`}
                          onClick={() => setCursorConfig({ size: item.id })}
                          className={`p-2 rounded-lg border text-left transition-all ${
                            cursorConfig.size === item.id
                              ? 'border-brand bg-brand/20 text-brand-200 shadow-sm'
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
                        className="h-4 w-4 rounded border-ink-700 bg-ink-800 accent-brand cursor-pointer"
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
                        className="h-4 w-4 rounded border-ink-700 bg-ink-800 accent-brand cursor-pointer"
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
                        className="h-4 w-4 rounded border-ink-700 bg-ink-800 accent-brand cursor-pointer"
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
                        className="h-4 w-4 rounded border-ink-700 bg-ink-800 accent-brand cursor-pointer"
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
                <div className="space-y-3">
                <label className="flex items-center justify-between gap-4 text-xs">
                  <span>
                    <span className="block text-ink-200">Hide horizontal overflow</span>
                    <span className="mt-1 block text-ink-500">On: strips scroll with edge arrows, wheel, or drag — no visible horizontal scrollbar. Off: native scrollbars return.</span>
                  </span>
                  <input
                    data-testid="toggle-hide-overflow-x"
                    aria-label="Hide horizontal overflow"
                    type="checkbox"
                    checked={hideOverflowX}
                    onChange={(event) => setHideOverflowX(event.target.checked)}
                    className="h-4 w-4 shrink-0 accent-brand"
                  />
                </label>
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
                    className="h-4 w-4 accent-brand"
                  />
                </label>
                </div>
              )}

              {!settingsSearch && settingsCategory === 'appearance' && (
                <div className="space-y-3" data-testid="settings-appearance">
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Interface style</p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {UI_STYLES.map((style) => (
                        <button
                          key={style.id}
                          type="button"
                          data-testid={`ui-style-${style.id}`}
                          aria-pressed={uiStyle === style.id}
                          onClick={() => setUiStyle(style.id)}
                          className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${uiStyle === style.id ? 'border-brand bg-brand/15' : 'border-ink-700 bg-ink-900 hover:border-ink-500'}`}
                        >
                          <span className="flex shrink-0 overflow-hidden rounded border border-black/30" aria-hidden>
                            <span className="h-6 w-3.5" style={{ backgroundColor: style.swatch[0] }} />
                            <span className="h-6 w-3.5" style={{ backgroundColor: style.swatch[1] }} />
                            <span className="h-6 w-2" style={{ backgroundColor: style.swatch[2] }} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold text-ink-100">{style.name}</span>
                            <span className="block truncate text-[10px] text-ink-500" title={style.concept}>{style.concept}</span>
                          </span>
                          {uiStyle === style.id && <span className="ml-auto shrink-0 text-[10px] font-semibold text-brand-400">Active</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Accent palette</p>
                    <div role="group" aria-label="Accent palette" className="grid grid-cols-2 gap-2">
                      {UI_PALETTES.map((palette) => (
                        <button
                          key={palette.id}
                          type="button"
                          data-testid={`ui-palette-${palette.id}`}
                          aria-pressed={uiPalette === palette.id}
                          onClick={() => setUiPalette(palette.id)}
                          className={`flex min-h-12 min-w-0 items-center gap-2 rounded-md border px-2.5 text-left text-[11px] ${uiPalette === palette.id ? 'border-brand bg-brand/15 text-white' : 'border-ink-700 bg-ink-900 text-ink-300 hover:border-ink-500'}`}
                        >
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: palette.accent }} />
                          <span className="min-w-0"><span className="block font-medium">{palette.name}</span><span className="block text-[9px] text-ink-400">{palette.note}</span></span>
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-[10px] text-ink-500">Choose panel spacing and surfaces, then an accent for controls. Daylight uses a light background.</p>
                  </div>
                </div>
              )}

              {!settingsSearch && settingsCategory === 'dockers' && (
                <div className="space-y-3" data-testid="settings-dockers">
                  <p className="text-[11px] leading-snug text-ink-400">
                    Active mode: <span className="text-ink-100" data-testid="dockers-active-mode">{workspacePreset}</span>
                    {drawingEnabledTop ? ', Drawing on' : ''}{is3DMode ? ', 3D on' : ''}, showing the{' '}
                    <span className="text-ink-100">{leftTab}</span> panel. Toggle what stays on your rails — nothing here blocks the canvas.
                  </p>
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Left rail panels</p>
                    <div className="space-y-1">
                      {([
                        ['media', 'Media'], ['omniframe', 'OmniFrame'], ['audio', 'Audio'], ['tracking', 'Tracking'],
                        ['relationships', 'Relationships'], ['drawing', 'Drawing'], ['transitions', 'Transitions'],
                        ['effects', 'Effects / LUT'], ['text', 'Text'], ['threed', '3D Scene'], ['rigging', 'Rigging'], ['pack', 'Pack'],
                      ] as const).map(([id, label]) => (
                        <label key={id} className="flex items-center justify-between gap-4 text-xs">
                          <span className="text-ink-200">{label}</span>
                          <input
                            data-testid={`docker-toggle-left-${id}`}
                            aria-label={`Show ${label} on the left rail`}
                            type="checkbox"
                            checked={dockerPrefs.leftTabs[id] !== false}
                            onChange={(event) => setDockerPref('leftTabs', id, event.target.checked)}
                            className="h-4 w-4 shrink-0 accent-brand"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Right panel sub-tools</p>
                    <div className="space-y-1">
                      {([
                        ['masking', 'Masking'], ['smart-patch', 'Smart Patch'], ['rotomask', 'RotoMask'],
                      ] as const).map(([id, label]) => (
                        <label key={id} className="flex items-center justify-between gap-4 text-xs">
                          <span className="text-ink-200">{label}</span>
                          <input
                            data-testid={`docker-toggle-right-${id}`}
                            aria-label={`Show ${label} in the right sub-tool dock`}
                            type="checkbox"
                            checked={dockerPrefs.rightSubtools[id] !== false}
                            onChange={(event) => setDockerPref('rightSubtools', id, event.target.checked)}
                            className="h-4 w-4 shrink-0 accent-brand"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {!settingsSearch && settingsCategory === 'ai' && (
                <div className="space-y-3 text-xs">
                  <div className="rounded-none border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] leading-relaxed text-amber-200">
                    <strong>Enter an API key only.</strong> Never paste source code, prompts, passwords, recovery
                    codes, or other private information here. Browser requests expose the key to this tab and the
                    selected provider; use a restricted key with spending limits.
                  </div>
                  <div className="space-y-2 rounded-none border border-fuchsia-500/25 bg-fuchsia-500/5 p-2" data-testid="gif-provider-api-settings">
                    <div>
                      <p className="font-semibold text-ink-100">GIF and sticker provider keys</p>
                      <p className="mt-0.5 text-[10px] leading-snug text-ink-500">Used by Media → GIF Library. Keys stay in this browser tab and are never written into projects or exports.</p>
                    </div>
                    <label className="block text-ink-300">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider">GIPHY API key</span>
                      <input
                        data-testid="setting-giphy-api-key"
                        aria-label="GIPHY API key"
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        value={giphyApiKey}
                        onChange={(event) => { setGiphyApiKey(event.target.value); setGifProviderKey('giphy', event.target.value) }}
                        placeholder="GIPHY developer key"
                        className="h-8 w-full rounded-none border border-ink-700 bg-ink-800 px-2 text-xs"
                      />
                    </label>
                    <label className="block text-ink-300">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider">Klipy API key</span>
                      <input
                        data-testid="setting-klipy-api-key"
                        aria-label="Klipy API key"
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        value={klipyApiKey}
                        onChange={(event) => { setKlipyApiKey(event.target.value); setGifProviderKey('klipy', event.target.value) }}
                        placeholder="Klipy developer key"
                        className="h-8 w-full rounded-none border border-ink-700 bg-ink-800 px-2 text-xs"
                      />
                    </label>
                  </div>
                  <label className="block text-ink-300">
                    <span className="mb-1 block">Provider</span>
                    <select
                      data-testid="setting-ai-provider"
                      aria-label="AI provider"
                      value={aiProvider}
                      onChange={(event) => selectAiProvider(event.target.value as AiProviderId)}
                      className="h-8 w-full rounded-none border border-ink-700 bg-ink-800 px-2 text-xs"
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
                        className="h-8 w-full rounded-none border border-ink-700 bg-ink-800 px-2 text-xs"
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
                      className="h-8 w-full rounded-none border border-ink-700 bg-ink-800 px-2 text-xs"
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
                      className="h-8 w-full rounded-none border border-ink-700 bg-ink-800 px-2 text-xs"
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
                    className="h-8 rounded-none border border-ink-600 bg-ink-800 px-3 text-xs text-ink-200 hover:bg-ink-700 disabled:opacity-50"
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

                  <div className="rounded-none border border-ink-700 bg-ink-900 p-2" data-testid="ai-connection-card">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${aiConnection.status === 'connected' ? 'bg-emerald-400' : aiConnection.status === 'error' ? 'bg-red-400' : aiConnection.status === 'testing' ? 'bg-amber-400' : 'bg-ink-500'}`} />
                      <span className="font-semibold text-ink-100" data-testid="ai-connection-status">
                        {aiConnection.status === 'connected' ? 'Connected' : aiConnection.status === 'error' ? 'Connection failed' : aiConnection.status === 'testing' ? 'Testing…' : 'Not tested yet'}
                      </span>
                      {aiConnection.latencyMs !== null && <span className="text-ink-500">{aiConnection.latencyMs} ms</span>}
                      {aiConnection.at > 0 && <span className="ml-auto text-[10px] text-ink-500">{new Date(aiConnection.at).toLocaleTimeString()}</span>}
                    </div>
                    <p className="mt-1 text-[10px] leading-snug text-ink-500">
                      One connection for the whole studio: the key stays in this tab's memory, is sent only to {AI_PROVIDERS.find((provider) => provider.id === aiProvider)?.label || 'your provider'}, and is never saved to disk or into .omni projects.
                    </p>
                  </div>

                  <div className="rounded-none border border-ink-700 bg-ink-900 p-2" data-testid="model-equivalents">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Choose a model — equivalents per job</p>
                    <div className="mb-2 flex flex-wrap gap-1" role="group" aria-label="Model capability">
                      {MODEL_CAPABILITIES.map((cap) => (
                        <button
                          key={cap.id}
                          type="button"
                          data-testid={`model-cap-${cap.id}`}
                          aria-pressed={modelCap === cap.id}
                          onClick={() => setModelCap(cap.id)}
                          className={`h-6 rounded-full border px-2 text-[10px] ${modelCap === cap.id ? 'border-brand bg-brand/20 text-white' : 'border-ink-700 text-ink-400 hover:border-ink-500'}`}
                        >
                          {cap.label}
                        </button>
                      ))}
                    </div>
                    <p className="mb-1 text-[10px] text-ink-500">{MODEL_CAPABILITIES.find((c) => c.id === modelCap)?.note}, on {AI_PROVIDERS.find((provider) => provider.id === aiProvider)?.label}:</p>
                    <div className="space-y-1">
                      {equivalentsFor(modelCap, aiProvider).length ? equivalentsFor(modelCap, aiProvider).map((eq) => (
                        <button
                          key={eq.model}
                          type="button"
                          data-testid="model-option"
                          data-model-id={eq.model}
                          aria-pressed={aiModel === eq.model}
                          onClick={() => { setAiModel(eq.model); setAiCapabilityModel(modelCap, eq.model) }}
                          className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left ${aiModel === eq.model ? 'border-brand bg-brand/15 text-white' : 'border-ink-700 text-ink-300 hover:border-ink-500'}`}
                        >
                          <span className="min-w-0 flex-1 truncate font-mono text-[10px]">{eq.model}</span>
                          <span className={`shrink-0 rounded-full px-1.5 py-px text-[9px] ${eq.tier === 'flagship' ? 'bg-brand/25 text-brand-200' : eq.tier === 'fast' ? 'bg-sky-500/20 text-sky-200' : 'bg-emerald-500/20 text-emerald-200'}`}>{eq.tier}</span>
                          {aiCapabilityModels[modelCap] === eq.model && <span className="shrink-0 text-[9px] text-brand-400">in use</span>}
                        </button>
                      )) : (
                        <p className="text-[10px] text-ink-500">No curated {modelCap} model on this provider — type any model ID above, or pick an equivalent below and switch provider.</p>
                      )}
                    </div>
                    <p className="mt-2 text-[10px] text-ink-500">Same job on other providers:</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {equivalentAcrossProviders(modelCap).filter((eq) => eq.provider !== aiProvider).slice(0, 8).map((eq) => (
                        <button
                          key={`${eq.provider}:${eq.model}`}
                          type="button"
                          data-testid="model-equivalent-other"
                          onClick={() => { selectAiProvider(eq.provider); setAiModel(eq.model); setAiCapabilityModel(modelCap, eq.model) }}
                          className="rounded-full border border-ink-700 px-2 py-1 font-mono text-[9px] text-ink-400 hover:border-brand hover:text-white"
                          title={`Switch to ${eq.provider} and use ${eq.model}`}
                        >
                          {eq.provider}: {eq.model}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-none border border-ink-700 bg-ink-900 p-2" data-testid="training-center">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Train your own model</p>
                    <p className="text-[10px] leading-snug text-ink-500">
                      Your saved Custom Effects become training pairs (brief → effect JSON). Export the dataset, or submit a fine-tune job with your key — the tuned model is then yours to select above.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-400">
                      <span data-testid="finetune-stats">{ftDataset.examples} examples, ≈{ftDataset.estTokens} tokens</span>
                      <button type="button" data-testid="finetune-download" disabled={!ftDataset.examples} onClick={() => downloadTextFile('omniframe-training.jsonl', ftDataset.jsonl)} className="h-6 rounded border border-ink-600 bg-ink-800 px-2 text-[10px] text-ink-100 hover:border-brand disabled:opacity-40">
                        Download JSONL
                      </button>
                    </div>
                    {ftDataset.warnings.map((w) => (
                      <p key={w} className="mt-1 text-[10px] text-amber-300">{w}</p>
                    ))}
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      <label className="block text-[10px] text-ink-400">Base model
                        <select data-testid="finetune-base" value={ftBase} onChange={(e) => setFtBase(e.target.value)} className="mt-0.5 h-7 w-full rounded border border-ink-700 bg-ink-800 px-1 text-[10px] text-ink-100">
                          {(FINETUNE_BASES[aiProvider] || []).map((m) => (<option key={m} value={m}>{m}</option>))}
                          {!(FINETUNE_BASES[aiProvider] || []).length && <option value={ftBase}>{ftBase || '— pick OpenAI/Together/Mistral —'}</option>}
                        </select>
                      </label>
                      <label className="block text-[10px] text-ink-400">Epochs
                        <input data-testid="finetune-epochs" type="number" min={1} max={10} value={ftEpochs} onChange={(e) => setFtEpochs(Math.min(10, Math.max(1, Number(e.target.value) || 3)))} className="mt-0.5 h-7 w-full rounded border border-ink-700 bg-ink-800 px-1 text-[10px] text-ink-100" />
                      </label>
                      <label className="block text-[10px] text-ink-400">Name suffix
                        <input data-testid="finetune-suffix" value={ftSuffix} onChange={(e) => setFtSuffix(e.target.value)} className="mt-0.5 h-7 w-full rounded border border-ink-700 bg-ink-800 px-1 text-[10px] text-ink-100" />
                      </label>
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <button
                        type="button"
                        data-testid="finetune-submit"
                        disabled={ftBusy || !ftDataset.examples || aiConnection.status !== 'connected'}
                        onClick={submitFineTune}
                        className="h-7 flex-1 rounded bg-brand px-2 text-[11px] font-semibold text-white hover:bg-brand/85 disabled:opacity-40"
                        title={aiConnection.status !== 'connected' ? 'Test the connection first' : 'Upload the dataset and start the job'}
                      >
                        {ftBusy ? 'Working…' : 'Start fine-tune job'}
                      </button>
                      {ftJob && (
                        <button type="button" data-testid="finetune-poll" disabled={ftBusy} onClick={pollFineTune} className="h-7 rounded border border-ink-600 bg-ink-800 px-2 text-[10px] text-ink-100 hover:border-brand disabled:opacity-40">
                          Check status
                        </button>
                      )}
                    </div>
                    {ftJob && <p className="mt-1 font-mono text-[9px] text-ink-500" data-testid="finetune-job">{ftJob.id}, {ftJob.status}{ftJob.model ? `, ${ftJob.model}` : ''}</p>}
                    {ftMessage && <p className="mt-1 text-[10px] leading-snug text-ink-400" role="status">{ftMessage}</p>}
                                      </div>
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
      {compOpen && <CompositionSettingsModal onClose={() => setCompOpen(false)} />}
    </header>
  )
}
