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
  X,
} from 'lucide-react'
import { useEditor } from '../store'
import { exportVideo } from '../lib/export'
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

  const fileInput = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsCategory, setSettingsCategory] = useState<'timeline' | 'playback' | 'shortcuts' | 'accessibility'>('timeline')
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
        <div ref={settingsRef} data-testid="settings-popup" role="dialog" aria-label="Settings" className="fixed right-3 top-12 z-[80] flex w-[min(440px,calc(100vw-24px))] max-h-[min(420px,calc(100vh-64px))] overflow-hidden rounded-xl border border-ink-600 bg-[#11131d]/[0.98] shadow-[0_20px_60px_rgba(0,0,0,.5)] backdrop-blur-xl">
          <nav aria-label="Settings categories" className="w-32 shrink-0 border-r border-ink-700 p-2">
            {(['timeline', 'playback', 'shortcuts', 'accessibility'] as const).map((category) => (
              <button key={category} data-testid="settings-category" aria-pressed={settingsCategory === category} onClick={() => setSettingsCategory(category)} className={`mb-1 h-9 w-full rounded-lg px-3 text-left text-xs capitalize outline-none focus-visible:ring-2 focus-visible:ring-brand ${settingsCategory === category ? 'bg-brand/15 text-violet-200' : 'text-ink-400 hover:bg-ink-700 hover:text-white'}`}>{category}</button>
            ))}
          </nav>
          <section className="min-w-0 flex-1 overflow-y-auto p-4">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold capitalize">{settingsCategory}</h2><button aria-label="Close settings" onClick={() => setSettingsOpen(false)} className="grid h-7 w-7 place-items-center rounded-md text-ink-400 hover:bg-ink-700 hover:text-white"><X size={14} /></button></div>
            {settingsCategory === 'timeline' && <div className="space-y-4"><label className="block text-xs text-ink-300"><span className="mb-2 block">Project frame rate</span><select aria-label="Project frame rate" value={projectFps} onChange={(event) => setProjectFps(Number(event.target.value))} className="h-8 w-full rounded-md border border-ink-700 bg-ink-800 px-2 text-xs text-ink-200">{[23.976,24,25,29.97,30,50,59.94,60,120].map((rate)=><option key={rate} value={rate}>{rate} fps</option>)}</select></label>{(projectFps === 29.97 || projectFps === 59.94) && <label className="flex items-center justify-between gap-4 text-xs text-ink-300"><span><span className="block">Drop-frame timecode</span><span className="mt-1 block text-[10px] text-ink-500">SMPTE clock-aligned display; timing is unchanged.</span></span><input aria-label="Drop-frame timecode" type="checkbox" checked={dropFrameTimecode} onChange={(event) => setDropFrameTimecode(event.target.checked)} className="h-4 w-4 accent-violet-500" /></label>}</div>}
            {settingsCategory === 'playback' && <div><div className="mb-2 text-xs text-ink-300">Preview quality</div><div role="radiogroup" aria-label="Preview quality" className="grid grid-cols-2 gap-2">{(['low','medium','high','ultra'] as const).map((quality)=><button key={quality} type="button" role="radio" aria-checked={previewQuality === quality} onClick={() => setPreviewQuality(quality)} className={`h-9 rounded-md border px-3 text-xs capitalize ${previewQuality === quality ? 'border-brand bg-brand/15 text-violet-200' : 'border-ink-700 bg-ink-800 text-ink-300 hover:bg-ink-700'}`}>{quality}</button>)}</div><p className="mt-3 text-[10px] leading-relaxed text-ink-500">Lower quality reduces preview canvas pixels and GPU/compositing work. Timeline timing and project FPS stay unchanged.</p></div>}
            {settingsCategory === 'shortcuts' && <dl className="space-y-2 text-xs">{[['Hide / unhide selected clip','H'],['Select tool','V'],['Blade tool','B'],['Undo','Ctrl / Cmd + Z']].map(([label,key])=><div key={label} className="flex items-center justify-between gap-3"><dt className="text-ink-300">{label}</dt><dd className="rounded border border-ink-700 bg-ink-800 px-2 py-1 font-mono text-[10px] text-ink-400">{key}</dd></div>)}</dl>}
            {settingsCategory === 'accessibility' && <label className="flex items-center justify-between gap-4 text-xs"><span><span className="block text-ink-200">Reduce motion</span><span className="mt-1 block text-ink-500">Minimize nonessential interface animation.</span></span><input aria-label="Reduce motion" type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} className="h-4 w-4 accent-violet-500" /></label>}
          </section>
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
