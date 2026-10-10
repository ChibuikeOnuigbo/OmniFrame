import React, { useRef, useState } from 'react'
import {
  MousePointerClick,
  MousePointerBan,
  Cpu,
  Upload,
  Play,
  Undo2,
  Trash2,
  Scissors,
  Bandage,
  Eraser,
  Layers,
  ImageDown,
  Brush,
  Eraser as EraserIcon,
  Crosshair,
  Check,
  Loader2,
  Clock,
} from 'lucide-react'
import { useEditor } from '../store'
import PanelSection from './PanelSection'
import { allRotoModels } from '../store/rotoMask'
import { ROTO_MODEL_CATALOG } from '../lib/rotoModels'

/**
 * RotoMask — the click-to-segment roto sub-tool (Sammie-Roto 2 style).
 *
 *   1. pick an engine (Smart, or one of the OmniRoto models, or import any
 *      saliency ONNX — U²-Net, IS-Net, Silueta… all work)
 *   2. click the subject on the preview — left-click/Alt-click to add,
 *      right-click to remove — the mask updates per click
 *   3. choose a frame scope (current / range / all) and Track
 *   4. apply: extract as a movable OmniFrame layer, cut out + patch the
 *      background, remove from the video, hand to the Drawing mask system,
 *      or export an After Effects style luma matte
 *
 * The brush section is the combo with the classic Masking sub-tool: the same
 * edge-snapping auto brush that improved Masking also refines a RotoMask
 * directly (add / subtract strokes on the live mask).
 */
export function RotoMaskSubTool({ context = 'omniframe' }: { context?: 'drawing' | 'omniframe' }) {
  const rotoModelId = useEditor((s) => s.rotoModelId)
  const rotoStatus = useEditor((s) => s.rotoStatus)
  const rotoClicks = useEditor((s) => s.rotoClicks)
  const rotoResult = useEditor((s) => s.rotoResult)
  const rotoBusy = useEditor((s) => s.rotoBusy)
  const rotoScope = useEditor((s) => s.rotoScope)
  const rotoFrames = useEditor((s) => s.rotoFrames)
  const rotoTracking = useEditor((s) => s.rotoTracking)
  const rotoTool = useEditor((s) => s.rotoTool)
  const rotoTolerance = useEditor((s) => s.rotoTolerance)
  const rotoBrushRadius = useEditor((s) => s.rotoBrushRadius)
  const rotoImportedModels = useEditor((s) => s.rotoImportedModels)
  const setRotoModel = useEditor((s) => s.setRotoModel)
  const loadRotoModel = useEditor((s) => s.loadRotoModel)
  const importRotoModelFile = useEditor((s) => s.importRotoModelFile)
  const addRotoModelFromCatalog = useEditor((s) => s.addRotoModelFromCatalog)
  const armRotoTool = useEditor((s) => s.armRotoTool)
  const undoRotoClick = useEditor((s) => s.undoRotoClick)
  const clearRoto = useEditor((s) => s.clearRoto)
  const setRotoScope = useEditor((s) => s.setRotoScope)
  const setRotoTolerance = useEditor((s) => s.setRotoTolerance)
  const setRotoBrushRadius = useEditor((s) => s.setRotoBrushRadius)
  const trackRotoMask = useEditor((s) => s.trackRotoMask)
  const rotoExtractToObject = useEditor((s) => s.rotoExtractToObject)
  const rotoToDrawingMask = useEditor((s) => s.rotoToDrawingMask)
  const rotoExportLumaMatte = useEditor((s) => s.rotoExportLumaMatte)

  const fileRef = useRef<HTMLInputElement>(null)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [applyNote, setApplyNote] = useState('')

  const models = allRotoModels({ rotoImportedModels })
  const posCount = rotoClicks.filter((c) => c.positive).length
  const negCount = rotoClicks.length - posCount

  const btn =
    'flex min-h-8 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-40'
  const btnIdle = `${btn} bg-ink-900 border-ink-800 text-ink-200 hover:bg-ink-800 hover:text-white`

  return (
    <div
      data-testid="rotomask-subtool"
      className="flex flex-col gap-2.5 p-2.5 rounded-xl bg-ink-950/70 border border-ink-800 text-xs text-ink-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-ink-800">
        <div className="flex items-center gap-1.5 font-semibold text-ink-100">
          <Crosshair size={13} className="text-fuchsia-400" />
          <span>RotoMask Sub-Tool</span>
        </div>
        <span className="text-[11px] px-1.5 py-0.5 rounded font-mono uppercase bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30">
          Click · Track · Apply
        </span>
      </div>

      <div
        role="note"
        data-testid="rotomask-scope-note"
        className="rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/5 px-2.5 py-2 text-[10px] leading-relaxed text-ink-300"
      >
        <div className="mb-0.5 font-semibold uppercase tracking-wide text-fuchsia-200">
          {context === 'omniframe' ? 'OmniFrame roto mask' : 'Drawing roto mask'}
        </div>
        <p>
          Roto selections are workflow data. Convert them to a Drawing mask (or an OmniFrame
          layer) for them to affect the final export — same rule as every other selection.
        </p>
      </div>

      {/* 1. Engine & Models */}
      <PanelSection title="Engine & Models" hint={rotoModelId === 'smart' ? 'Smart' : 'Model'} testId="roto-models" defaultOpen={true}>
        <div role="group" aria-label="Segmentation engine" className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            data-testid="roto-model-smart"
            aria-pressed={rotoModelId === 'smart'}
            onClick={() => setRotoModel('smart')}
            title="Smart engine — colour-model click segmentation, instant, no model download"
            className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg border p-1.5 text-center transition-all ${
              rotoModelId === 'smart'
                ? 'bg-fuchsia-500/25 border-fuchsia-500 text-white shadow-xs'
                : 'bg-ink-900 border-ink-800 text-ink-300 hover:text-white hover:bg-ink-800'
            }`}
          >
            <Cpu size={15} className="shrink-0" />
            <span className="text-[11px] font-medium leading-tight">Smart</span>
          </button>
          {models
            .filter((m) => m.source === 'builtin')
            .map((m) => {
              const active = rotoModelId === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  data-testid={`roto-model-${m.id}`}
                  aria-pressed={active}
                  onClick={() => setRotoModel(m.id)}
                  title={m.notes || m.label}
                  className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg border p-1.5 text-center transition-all ${
                    active
                      ? 'bg-fuchsia-500/25 border-fuchsia-500 text-white shadow-xs'
                      : 'bg-ink-900 border-ink-800 text-ink-300 hover:text-white hover:bg-ink-800'
                  }`}
                >
                  <span className="text-[15px] leading-none" aria-hidden="true">
                    {m.domain === 'human' ? '🧑' : m.domain === 'anime' ? '🎞️' : m.domain === 'hair' ? '💇' : '🧩'}
                  </span>
                  <span className="text-[11px] font-medium leading-tight truncate max-w-full">
                    {m.label.replace('OmniRoto · ', '')}
                  </span>
                </button>
              )
            })}
        </div>

        {models.some((m) => m.source !== 'builtin') && (
          <div className="flex flex-wrap gap-1 pt-1.5">
            {models
              .filter((m) => m.source !== 'builtin')
              .map((m) => (
                <button
                  key={m.id}
                  type="button"
                  data-testid={`roto-model-${m.id}`}
                  aria-pressed={rotoModelId === m.id}
                  onClick={() => setRotoModel(m.id)}
                  title={`${m.label} — ${m.notes || 'imported'}`}
                  className={`max-w-[150px] truncate rounded-md border px-2 py-1 text-[10px] font-medium ${
                    rotoModelId === m.id
                      ? 'bg-fuchsia-500/20 border-fuchsia-500 text-white'
                      : 'bg-ink-900 border-ink-800 text-ink-300 hover:bg-ink-800 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 pt-1.5">
          <button
            type="button"
            data-testid="roto-load-model-btn"
            onClick={() => void loadRotoModel()}
            className={`${btnIdle} flex-1 border-fuchsia-500/40 text-fuchsia-200 hover:bg-fuchsia-500/20`}
            title="Load the selected model into the ONNX runtime (Smart needs no load)"
          >
            <Cpu size={12} className="shrink-0" />
            <span className="truncate">Load Model</span>
          </button>
          <button
            type="button"
            data-testid="roto-import-btn"
            onClick={() => fileRef.current?.click()}
            className={btnIdle}
            title="Import any saliency ONNX model (U²-Net, IS-Net, Silueta, MODNet…)"
          >
            <Upload size={12} className="shrink-0" />
            <span>Import</span>
          </button>
          <button
            type="button"
            data-testid="roto-catalog-btn"
            aria-expanded={catalogOpen}
            onClick={() => setCatalogOpen((v) => !v)}
            className={btnIdle}
            title="Link a known community model by URL (not bundled — licences differ)"
          >
            <span>+</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".onnx"
            data-testid="roto-import-input"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) await importRotoModelFile(f)
              e.target.value = ''
            }}
          />
        </div>

        {catalogOpen && (
          <div role="listbox" aria-label="Community model catalog" className="flex flex-col gap-1 pt-1.5">
            {ROTO_MODEL_CATALOG.map((m) => (
              <button
                key={m.id}
                type="button"
                data-testid={`roto-catalog-${m.id}`}
                onClick={() => {
                  addRotoModelFromCatalog(m.id)
                  setCatalogOpen(false)
                }}
                title={`${m.homepage} · ~${m.approxMb}MB · ${m.notes}`}
                className="flex items-center justify-between gap-2 rounded-md border border-ink-800 bg-ink-900 px-2 py-1 text-left text-[10px] text-ink-300 hover:bg-ink-800 hover:text-white"
              >
                <span className="truncate font-medium">{m.label}</span>
                <span className="shrink-0 font-mono text-ink-500">{m.approxMb}MB</span>
              </button>
            ))}
          </div>
        )}

        <div
          data-testid="roto-model-status"
          className={`pt-1 font-mono text-[10px] leading-snug ${
            rotoStatus.state === 'error'
              ? 'text-red-300'
              : rotoStatus.state === 'ready'
                ? 'text-emerald-300'
                : 'text-ink-400'
          }`}
          title={rotoStatus.message}
        >
          {rotoStatus.state === 'loading' ? <Loader2 size={10} className="inline animate-spin" /> : null}{' '}
          {rotoStatus.message || 'idle'}
        </div>
      </PanelSection>

      {/* 2. Click to segment */}
      <PanelSection
        title="Click To Segment"
        hint={rotoClicks.length ? `+${posCount} / −${negCount}` : undefined}
        testId="roto-click"
        defaultOpen={true}
      >
        <div role="group" aria-label="Click modes" className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            data-testid="roto-click-add-btn"
            aria-pressed={rotoTool === 'click'}
            onClick={() => armRotoTool('click')}
            title="Arm click mode — left-click on the preview adds the subject, right-click removes background"
            className={`flex min-h-9 items-center justify-center gap-1.5 rounded-lg border text-[11px] font-medium transition-all ${
              rotoTool === 'click'
                ? 'bg-emerald-500/25 border-emerald-500 text-emerald-100 shadow-xs'
                : 'bg-ink-900 border-ink-800 text-ink-300 hover:bg-ink-800 hover:text-white'
            }`}
          >
            <MousePointerClick size={13} className="shrink-0" />
            <span>{rotoTool === 'click' ? 'Clicking…' : 'Add / Remove Clicks'}</span>
          </button>
          <button
            type="button"
            data-testid="roto-undo-click-btn"
            disabled={rotoClicks.length === 0 || rotoBusy}
            onClick={() => void undoRotoClick()}
            title="Undo the last click and re-segment"
            className={btnIdle}
          >
            <Undo2 size={12} className="shrink-0" />
            <span>Undo Click</span>
          </button>
        </div>
        <p className="pt-1 text-[10px] leading-snug text-ink-400">
          Left-click (or Add mode) marks subject, right-click / Alt-click marks background — the
          mask re-runs after every click, exactly like the reference tool's dots.
        </p>
        <div className="flex items-center gap-1.5 pt-1">
          <div
            data-testid="roto-clicks-summary"
            className="flex-1 font-mono text-[10px] text-ink-400"
          >
            {rotoClicks.length
              ? `${rotoClicks.length} clicks · +${posCount} subject · −${negCount} background`
              : 'no clicks yet'}
          </div>
          <button
            type="button"
            data-testid="roto-clear-btn"
            disabled={!rotoResult && rotoClicks.length === 0}
            onClick={() => clearRoto()}
            className={`${btnIdle} border-red-500/30 text-red-300 hover:bg-red-500/15`}
            title="Clear clicks, mask and tracked frames"
          >
            <Trash2 size={12} className="shrink-0" />
          </button>
        </div>

        {rotoResult && (
          <div className="grid grid-cols-2 gap-1 pt-1">
            <div className="relative rounded overflow-hidden border border-ink-800 bg-ink-950">
              <img
                data-testid="roto-matte-preview"
                src={rotoResult.maskDataUrl}
                alt="RotoMask matte"
                title={`matte · engine ${rotoResult.engine} · cover ${(rotoResult.coverage * 100).toFixed(1)}%`}
                className="w-full h-14 object-contain"
              />
              <span className="absolute bottom-0 left-0 right-0 text-center text-[10px] bg-black/60 text-ink-300">
                Matte · f{rotoResult.frame}
              </span>
            </div>
            <div className="relative rounded overflow-hidden border border-ink-800 bg-[repeating-conic-gradient(#222_0%_25%,#333_0%_50%)] bg-[length:8px_8px]">
              {rotoResult.cutoutDataUrl && (
                <img
                  data-testid="roto-cutout-preview"
                  src={rotoResult.cutoutDataUrl}
                  alt="RotoMask cutout"
                  title="cutout layered on transparency"
                  className="w-full h-14 object-contain"
                />
              )}
              <span className="absolute bottom-0 left-0 right-0 text-center text-[10px] bg-black/60 text-ink-300">
                Cutout
              </span>
            </div>
          </div>
        )}
      </PanelSection>

      {/* 3. Frame scope */}
      <PanelSection title="Frame Scope" hint={rotoScope.mode} testId="roto-scope" defaultOpen={false}>
        <div role="group" aria-label="Frame scope" className="grid grid-cols-3 gap-1">
          {(['current', 'range', 'all'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              data-testid={`roto-scope-${mode}`}
              aria-pressed={rotoScope.mode === mode}
              onClick={() => setRotoScope({ mode })}
              title={
                mode === 'current'
                  ? 'Segment only the frame under the playhead'
                  : mode === 'range'
                    ? 'Propagate across a chosen start–end range'
                    : 'Propagate across every frame of the clip (sampled by step)'
              }
              className={`py-1.5 rounded text-[11px] border capitalize transition-colors ${
                rotoScope.mode === mode
                  ? 'bg-brand/25 border-brand text-white'
                  : 'bg-ink-900 border-ink-800 text-ink-300 hover:bg-ink-800 hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        {rotoScope.mode === 'range' && (
          <div className="grid grid-cols-3 gap-1.5 pt-1.5">
            <label className="flex flex-col gap-0.5 text-[10px] text-ink-400">
              Start (s)
              <input
                type="number"
                data-testid="roto-scope-start"
                min={0}
                step={0.1}
                value={rotoScope.start}
                onChange={(e) => setRotoScope({ start: Math.max(0, Number(e.target.value) || 0) })}
                className="rounded border border-ink-700 bg-ink-900 px-1.5 py-1 text-[11px] text-ink-200"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[10px] text-ink-400">
              End (s)
              <input
                type="number"
                data-testid="roto-scope-end"
                min={0}
                step={0.1}
                value={rotoScope.end}
                onChange={(e) => setRotoScope({ end: Math.max(0, Number(e.target.value) || 0) })}
                className="rounded border border-ink-700 bg-ink-900 px-1.5 py-1 text-[11px] text-ink-200"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[10px] text-ink-400">
              Step (frames)
              <input
                type="number"
                data-testid="roto-scope-step"
                min={1}
                max={30}
                value={rotoScope.step}
                onChange={(e) => setRotoScope({ step: Math.max(1, Number(e.target.value) || 1) })}
                className="rounded border border-ink-700 bg-ink-900 px-1.5 py-1 text-[11px] text-ink-200"
              />
            </label>
          </div>
        )}
        <div className="flex items-center gap-1.5 pt-1.5">
          <Clock size={11} className="text-ink-500 shrink-0" />
          <span className="text-[10px] text-ink-400">
            Chosen-set moves: extracted layers inherit this scope — all frames, the chosen range,
            or the single frame.
          </span>
        </div>
      </PanelSection>

      {/* 4. Track */}
      <PanelSection
        title="Track & Review"
        hint={rotoFrames.length ? `${rotoFrames.length} frames` : undefined}
        testId="roto-track"
        defaultOpen={false}
      >
        <button
          type="button"
          data-testid="roto-track-btn"
          disabled={!rotoResult || rotoBusy || rotoTracking.running}
          onClick={() => void trackRotoMask()}
          title="Propagate the mask across the chosen frames (block-match warp + colour re-anchor)"
          className={`${btnIdle} w-full border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/20`}
        >
          {rotoTracking.running ? (
            <Loader2 size={12} className="shrink-0 animate-spin" />
          ) : (
            <Play size={12} className="shrink-0" />
          )}
          <span>{rotoTracking.running ? 'Tracking…' : 'Track Objects'}</span>
        </button>
        {rotoTracking.total > 0 && (
          <div
            data-testid="roto-track-progress"
            className="pt-1 font-mono text-[10px] text-ink-400"
          >
            {rotoTracking.done}/{rotoTracking.total} frames
          </div>
        )}
        {rotoFrames.length > 0 && (
          <div
            data-testid="roto-frames-strip"
            className="flex gap-1 overflow-x-auto pt-1 scrollbar-none"
          >
            {rotoFrames.slice(0, 24).map((f) => (
              <div
                key={f.frame}
                className="relative shrink-0 rounded border border-ink-800 bg-ink-950 overflow-hidden"
                title={`frame ${f.frame} · cover ${(f.coverage * 100).toFixed(1)}%`}
              >
                <img src={f.maskDataUrl} alt={`frame ${f.frame} mask`} className="h-10 w-auto object-contain" />
                <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] bg-black/60 text-ink-400 font-mono">
                  f{f.frame}
                </span>
              </div>
            ))}
          </div>
        )}
      </PanelSection>

      {/* 5. Apply */}
      <PanelSection title="Apply" testId="roto-apply" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            data-testid="roto-extract-btn"
            disabled={!rotoResult || rotoBusy}
            onClick={async () => {
              const r = await rotoExtractToObject({ patch: false })
              setApplyNote(r ? 'Extracted as OmniFrame layer — move it with the Transform controls' : 'nothing to extract')
            }}
            title="Extract the subject as a movable OmniFrame cutout layer"
            className={`${btnIdle} border-brand/40 text-brand-300 hover:bg-brand/15`}
          >
            <Scissors size={12} className="shrink-0" />
            <span>Extract to Layer</span>
          </button>
          <button
            type="button"
            data-testid="roto-patch-btn"
            disabled={!rotoResult || rotoBusy}
            onClick={async () => {
              const r = await rotoExtractToObject({ patch: true })
              setApplyNote(r ? 'Cut out + pasted back on a patched background — character is now its own layer' : 'nothing to extract')
            }}
            title="Copy-paste workflow: remove the subject, patch the background, paste the character back as a new layer on top"
            className={`${btnIdle} border-fuchsia-500/40 text-fuchsia-200 hover:bg-fuchsia-500/20`}
          >
            <Bandage size={12} className="shrink-0" />
            <span>Cut Out + Patch BG</span>
          </button>
          <button
            type="button"
            data-testid="roto-remove-btn"
            disabled={!rotoResult || rotoBusy}
            onClick={async () => {
              const r = await rotoExtractToObject({ patch: true, hideAfter: true })
              setApplyNote(r ? 'Removed from video — background patched, layer kept (hidden) for later' : 'nothing to remove')
            }}
            title="Object removal: patch the background and hide the extracted subject"
            className={btnIdle}
          >
            <Eraser size={12} className="shrink-0" />
            <span>Remove from Video</span>
          </button>
          <button
            type="button"
            data-testid="roto-to-drawing-btn"
            disabled={!rotoResult}
            onClick={() => {
              rotoToDrawingMask()
              setApplyNote('Applied to the active Drawing layer mask — now part of export')
            }}
            title="Apply the roto matte to the active Drawing paint layer (final export)"
            className={btnIdle}
          >
            <Layers size={12} className="shrink-0" />
            <span>To Drawing Mask</span>
          </button>
        </div>
        <button
          type="button"
          data-testid="roto-luma-btn"
          disabled={!rotoResult}
          onClick={() => {
            const r = rotoExportLumaMatte()
            setApplyNote(r ? `Luma matte exported for frame ${r.frame} (PNG download)` : 'nothing to export')
          }}
          title="Export the matte as a white-on-black luma matte PNG (After Effects / luma-matte workflow)"
          className={`${btnIdle} w-full`}
        >
          <ImageDown size={12} className="shrink-0" />
          <span>Export Luma Matte</span>
        </button>
        {applyNote && (
          <div data-testid="roto-apply-note" className="pt-0.5 text-[10px] text-emerald-300/90 leading-snug">
            <Check size={10} className="inline" /> {applyNote}
          </div>
        )}
      </PanelSection>

      {/* 6. Brush refine — the combo with the Masking sub-tool */}
      <PanelSection title="Brush Refine (Masking Combo)" testId="roto-brush" defaultOpen={false}>
        <div role="group" aria-label="Brush refine" className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            data-testid="roto-brush-add-btn"
            aria-pressed={rotoTool === 'brush-add'}
            disabled={!rotoResult}
            onClick={() => armRotoTool('brush-add')}
            title="Paint over missed regions — the edge-snapping auto brush adds them to the mask"
            className={`flex min-h-9 items-center justify-center gap-1.5 rounded-lg border text-[11px] font-medium transition-all ${
              rotoTool === 'brush-add'
                ? 'bg-emerald-500/25 border-emerald-500 text-emerald-100'
                : 'bg-ink-900 border-ink-800 text-ink-300 hover:bg-ink-800 hover:text-white'
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <Brush size={13} className="shrink-0" />
            <span>{rotoTool === 'brush-add' ? 'Adding…' : 'Add Brush'}</span>
          </button>
          <button
            type="button"
            data-testid="roto-brush-remove-btn"
            aria-pressed={rotoTool === 'brush-remove'}
            disabled={!rotoResult}
            onClick={() => armRotoTool('brush-remove')}
            title="Paint over extra regions — the auto brush subtracts them from the mask"
            className={`flex min-h-9 items-center justify-center gap-1.5 rounded-lg border text-[11px] font-medium transition-all ${
              rotoTool === 'brush-remove'
                ? 'bg-red-500/25 border-red-500 text-red-100'
                : 'bg-ink-900 border-ink-800 text-ink-300 hover:bg-ink-800 hover:text-white'
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <EraserIcon size={13} className="shrink-0" />
            <span>{rotoTool === 'brush-remove' ? 'Removing…' : 'Remove Brush'}</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1.5">
          <label className="flex flex-col gap-0.5 text-[10px] text-ink-400">
            Brush radius ({rotoBrushRadius}px)
            <input
              type="range"
              data-testid="roto-brush-radius"
              min={4}
              max={120}
              value={rotoBrushRadius}
              onChange={(e) => setRotoBrushRadius(Number(e.target.value))}
              className="accent-fuchsia-400"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[10px] text-ink-400">
            Edge tolerance ({rotoTolerance})
            <input
              type="range"
              data-testid="roto-tolerance"
              min={2}
              max={80}
              value={rotoTolerance}
              onChange={(e) => setRotoTolerance(Number(e.target.value))}
              className="accent-fuchsia-400"
            />
          </label>
        </div>
        <p className="text-[10px] leading-snug text-ink-500">
          Same auto-brush engine as the Masking sub-tool — strokes snap to real edges. Need the
          full toolset (wand, lasso, recolor)? Open the Selection &amp; Masking sub-tool.
        </p>
      </PanelSection>
    </div>
  )
}
