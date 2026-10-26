import { Check, CircleDot, Crosshair, Loader2, MousePointer2, RotateCcw, Sparkles } from 'lucide-react'
import { useEditor } from '../store'

const buttonClass = 'flex min-h-8 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed'

export function SmartPatchSubTool() {
  const scope = useEditor((s) => s.smartPatchScope)
  const omniScope = useEditor((s) => s.rotoScope)
  const radius = useEditor((s) => s.smartPatchBrushRadius)
  const feather = useEditor((s) => s.smartPatchFeather)
  const status = useEditor((s) => s.smartPatchStatus)
  const source = useEditor((s) => s.cloneSourcePoint)
  const selection = useEditor((s) => s.activeSelection)
  const setScope = useEditor((s) => s.setSmartPatchScope)
  const setRadius = useEditor((s) => s.setSmartPatchBrushRadius)
  const setFeather = useEditor((s) => s.setSmartPatchFeather)
  const setTool = useEditor((s) => s.setDrawingTool)
  const setDrawingEnabled = useEditor((s) => s.setDrawingEnabled)
  const setCloneSourcePoint = useEditor((s) => s.setCloneSourcePoint)
  const applySmartPatch = useEditor((s) => s.applySmartPatch)

  const armSource = () => {
    setCloneSourcePoint(null)
    setTool('smart-patch')
    setDrawingEnabled(true)
  }

  const statusHint = source
    ? 'Donor ready · click/brush target'
    : 'Alt-click canvas for donor'
  const statusHelp = source
    ? 'Click or brush target points, or use an active selection to define the patch mask.'
    : 'Alt-click the canvas to choose donor pixels; then paint, click, or mask the target.'

  const useSelection = () => {
    const point = selection?.bounds
      ? { x: selection.bounds.x + selection.bounds.width / 2, y: selection.bounds.y + selection.bounds.height / 2, timestamp: Date.now() }
      : { x: 0.5, y: 0.5, timestamp: Date.now() }
    void applySmartPatch([point], true)
  }

  return (
    <div data-testid="smart-patch-subtool" className="flex flex-col gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.04] p-2.5 text-xs text-ink-200">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-semibold text-ink-100">
          <Sparkles size={14} className="text-cyan-300" />
          <span>Smart Patch</span>
        </div>
        <span className="rounded border border-cyan-500/25 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wide text-cyan-200">
          Donor → Target
        </span>
      </div>

      <div role="group" aria-label="Smart Patch frame scope" className="grid grid-cols-4 gap-1">
        {([
          { mode: 'current', label: 'Current', title: 'Patch the playhead frame' },
          { mode: 'range', label: 'Range', title: 'Patch a clip-relative frame range' },
          { mode: 'all', label: 'All', title: 'Patch the full selected clip' },
          { mode: 'omniframe', label: 'Omni', title: 'Match the frame scope selected in OmniFrame' },
        ] as const).map((option) => (
          <button
            key={option.mode}
            type="button"
            data-testid={`smart-patch-scope-${option.mode}`}
            aria-label={option.mode === 'omniframe' ? 'Use OmniFrame scope' : `${option.label} frame scope`}
            aria-pressed={scope.mode === option.mode}
            title={option.title}
            onClick={() => setScope({ mode: option.mode })}
            className={`${buttonClass} min-w-0 px-1 text-[10px] ${scope.mode === option.mode ? 'border-cyan-400 bg-cyan-500/20 text-white' : 'border-ink-800 bg-ink-900 text-ink-300 hover:bg-ink-800'}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {scope.mode === 'omniframe' && (
        <div data-testid="smart-patch-omniframe-scope" className="rounded-md border border-ink-800 bg-ink-950/55 px-2 py-1 text-[9px] text-ink-400">
          OmniFrame · {omniScope.mode === 'range'
            ? `${omniScope.start.toFixed(1)}–${omniScope.end.toFixed(1)}s · step ${omniScope.step}`
            : omniScope.mode === 'all' ? 'all clip frames' : 'current frame'}
        </div>
      )}

      {scope.mode === 'range' && (
        <div className="grid grid-cols-3 gap-1.5">
          <label className="flex flex-col gap-0.5 text-[9px] text-ink-400">Start (s)
            <input data-testid="smart-patch-range-start" type="number" min={0} step={0.1} value={scope.start} onChange={(e) => setScope({ start: Math.max(0, Number(e.target.value) || 0) })} className="min-w-0 rounded border border-ink-700 bg-ink-900 px-1.5 py-1 text-[10px] text-white" />
          </label>
          <label className="flex flex-col gap-0.5 text-[9px] text-ink-400">End (s)
            <input data-testid="smart-patch-range-end" type="number" min={0} step={0.1} value={scope.end} onChange={(e) => setScope({ end: Math.max(0, Number(e.target.value) || 0) })} className="min-w-0 rounded border border-ink-700 bg-ink-900 px-1.5 py-1 text-[10px] text-white" />
          </label>
          <label className="flex flex-col gap-0.5 text-[9px] text-ink-400">Step
            <input data-testid="smart-patch-range-step" type="number" min={1} max={30} value={scope.step} onChange={(e) => setScope({ step: Math.max(1, Number(e.target.value) || 1) })} className="min-w-0 rounded border border-ink-700 bg-ink-900 px-1.5 py-1 text-[10px] text-white" />
          </label>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-ink-800 bg-ink-950/80 p-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-ink-700 bg-ink-900">
          {source?.sampleDataUrl ? <img src={source.sampleDataUrl} alt="Donor frame preview" className="h-full w-full object-cover" /> : <Crosshair size={15} className="text-ink-500" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[10px] font-semibold text-ink-200">{source ? `Donor · ${Math.round(source.x * 100)}%, ${Math.round(source.y * 100)}%` : 'No donor selected'}</div>
          <div className="truncate text-[9px] text-ink-500">{source ? 'Draw or click a target on the preview' : 'Choose a clean source point first'}</div>
        </div>
        {source && <Check size={14} className="shrink-0 text-emerald-300" />}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" data-testid="smart-patch-set-source" onClick={armSource} className={`${buttonClass} border-cyan-500/35 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25`}>
          <MousePointer2 size={12} />
          <span>{source ? 'New donor' : 'Set donor'}</span>
        </button>
        <button type="button" data-testid="smart-patch-target-tool" disabled={!source} onClick={() => { setTool('smart-patch'); setDrawingEnabled(true) }} className={`${buttonClass} ${source ? 'border-ink-700 bg-ink-900 text-ink-100 hover:bg-ink-800' : 'border-ink-700 bg-ink-900 text-ink-400'}`}>
          <CircleDot size={12} />
          <span>Paint target</span>
        </button>
      </div>

      {selection && source && (
        <button type="button" data-testid="smart-patch-selection-btn" onClick={useSelection} className={`${buttonClass} w-full border-brand/30 bg-brand/10 text-brand-200 hover:bg-brand/20`}>
          <Sparkles size={12} /> Apply to active selection
        </button>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[9px] text-ink-400">
          Brush · {radius}px
          <input data-testid="smart-patch-radius" type="range" min={4} max={160} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="of-range w-full" />
        </label>
        <label className="flex flex-col gap-1 text-[9px] text-ink-400">
          Feather · {feather}px
          <input data-testid="smart-patch-feather" type="range" min={0} max={24} value={feather} onChange={(e) => setFeather(Number(e.target.value))} className="of-range w-full" />
        </label>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-ink-800 pt-1.5">
        <span data-testid="smart-patch-status" title={status.message || statusHelp} aria-live="polite" className={`min-w-0 truncate text-[9px] ${status.phase === 'error' ? 'text-red-300' : status.phase === 'done' ? 'text-emerald-300' : 'text-ink-500'}`}>
          {status.message || statusHint}
        </span>
        {status.phase === 'processing' && <Loader2 size={12} className="shrink-0 animate-spin text-cyan-300" />}
        {source && status.phase !== 'processing' && <button type="button" title="Clear donor" aria-label="Clear Smart Patch donor" onClick={() => setCloneSourcePoint(null)} className="shrink-0 rounded p-1 text-ink-500 hover:bg-ink-800 hover:text-white"><RotateCcw size={12} /></button>}
      </div>
      {status.phase === 'processing' && status.total > 0 && (
        <div className="h-1 overflow-hidden rounded bg-ink-800"><div className="h-full bg-cyan-400 transition-all" style={{ width: `${Math.round((status.done / status.total) * 100)}%` }} /></div>
      )}
    </div>
  )
}
