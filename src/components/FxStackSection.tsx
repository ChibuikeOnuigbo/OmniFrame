import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { useEditor } from '../store'
import type { Clip } from '../types'
import { PanelSection } from './PanelSection'
import { paramsForPatch } from '../lib/effectCatalog'
import { fxCatalogById } from '../lib/effectCatalog'
import { FX_MIN_DUR } from '../lib/fxInstances'

/**
 * Effect Stack — the CapCut-style list of effect instances dropped ONTO the
 * selected clip. The dropdown shows ALL of them; expanding any row exposes
 * every property: all editable, all numeric properties keyframeable (◆ sets
 * a key at the playhead, again removes it). Deleting here, from the timeline
 * bar's context menu or with Del/Backspace all flow through one undo stack.
 */
export function FxStackSection({ clip }: { clip: Clip }) {
  const playhead = useEditor((s) => s.playhead)
  const activeFx = useEditor((s) => s.activeFx)
  const setActiveFx = useEditor((s) => s.setActiveFx)
  const updateFxParams = useEditor((s) => s.updateFxParams)
  const setFxKey = useEditor((s) => s.setFxKey)
  const removeFxKey = useEditor((s) => s.removeFxKey)
  const toggleFxEnabled = useEditor((s) => s.toggleFxEnabled)
  const duplicateFxInstance = useEditor((s) => s.duplicateFxInstance)
  const removeFxInstance = useEditor((s) => s.removeFxInstance)
  const beginHistory = useEditor((s) => s.beginHistory)
  const endHistory = useEditor((s) => s.endHistory)
  const setLeftTab = useEditor((s) => s.setLeftTab)
  const [openId, setOpenId] = useState<string | null>(activeFx?.clipId === clip.id ? activeFx.fxId : null)

  const insts = clip.fxInstances || []
  const allowed = clip.kind === 'compound' || clip.kind === 'image' || clip.kind === 'video'
  const localT = playhead - clip.start

  return (
    <PanelSection
      title="FX Stack (dropped effects)"
      testId="fxstack"
      hint={`${insts.length}`}
      defaultOpen={insts.length > 0}
    >
      <div className="space-y-1.5" data-testid="fxstack-list">
        {!allowed && (
          <p className="text-[10px] text-ink-500" data-testid="fxstack-not-allowed">
            Effects drop onto image, video and compound clips only. Place as an adjustment layer instead — it grades every track below it.
          </p>
        )}
        {allowed && insts.length === 0 && (
          <p className="text-[10px] text-ink-500" data-testid="fxstack-empty">
            No effects dropped on this clip yet. Drag one from the Effects tab, right-click the clip → Add effect, or press ＋ below.
          </p>
        )}
        {insts.map((inst) => {
          const open = openId === inst.id
          const isActive = activeFx?.fxId === inst.id && activeFx?.clipId === clip.id
          const inside = localT >= inst.inP && localT < inst.inP + inst.duration
          const keyT = Math.max(0, Math.min(inst.duration - 1e-4, localT - inst.inP))
          const params = paramsForPatch(inst.params)
          return (
            <div
              key={inst.id}
              data-testid={`fxstack-item-${inst.id}`}
              className={`rounded-md border ${isActive ? 'border-cyan-300 bg-cyan-950/30' : 'border-ink-700 bg-ink-900/60'}`}
            >
              <div className="flex items-center gap-1 px-1.5 py-1">
                <button
                  type="button"
                  data-testid={`fxstack-toggleopen-${inst.id}`}
                  aria-label={open ? `Collapse ${inst.name}` : `Expand ${inst.name}`}
                  onClick={() => {
                    setOpenId(open ? null : inst.id)
                    setActiveFx({ clipId: clip.id, fxId: inst.id })
                  }}
                  className="grid h-5 w-5 place-items-center rounded text-ink-300 hover:bg-ink-800"
                >
                  {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-gradient-to-br from-cyan-400 to-blue-500" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-ink-100" title={inst.name}>
                  {inst.name}
                </span>
                <span className="shrink-0 font-mono text-[9px] text-ink-400" data-testid={`fxstack-range-${inst.id}`}>
                  {inst.inP.toFixed(1)}→{(inst.inP + inst.duration).toFixed(1)}s
                </span>
                <button
                  type="button"
                  data-testid={`fxstack-enable-${inst.id}`}
                  aria-label={inst.enabled ? `Disable ${inst.name}` : `Enable ${inst.name}`}
                  onClick={() => toggleFxEnabled(clip.id, inst.id)}
                  className="grid h-5 w-5 place-items-center rounded text-ink-300 hover:bg-ink-800"
                >
                  {inst.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
                <button
                  type="button"
                  data-testid={`fxstack-dup-${inst.id}`}
                  aria-label={`Duplicate ${inst.name}`}
                  onClick={() => duplicateFxInstance(clip.id, inst.id)}
                  className="grid h-5 w-5 place-items-center rounded text-ink-300 hover:bg-ink-800"
                >
                  <Copy size={12} />
                </button>
                <button
                  type="button"
                  data-testid={`fxstack-del-${inst.id}`}
                  aria-label={`Delete ${inst.name}`}
                  onClick={() => removeFxInstance(clip.id, inst.id)}
                  className="grid h-5 w-5 place-items-center rounded text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              {open && (
                <div className="space-y-1.5 border-t border-ink-800 px-2 py-1.5" data-testid={`fxstack-params-${inst.id}`}>
                  {!inside && (
                    <p className="text-[9px] text-amber-300/90">
                      Playhead is outside this effect's range ({inst.inP.toFixed(1)}–{(inst.inP + inst.duration).toFixed(1)}s of the clip) — keys land at its nearest edge.
                    </p>
                  )}
                  <div className="flex items-center gap-1.5" data-testid={`fxstack-range-inputs-${inst.id}`}>
                    <span className="w-24 shrink-0 truncate text-[10px] text-ink-300">In / Length (s)</span>
                    <input
                      type="number" min={0} max={Math.max(0, clip.duration - FX_MIN_DUR)} step={0.05}
                      value={Number(inst.inP.toFixed(2))}
                      aria-label="Effect in point (seconds into the clip)"
                      onFocus={() => beginHistory()}
                      onBlur={() => endHistory()}
                      onChange={(e) => useEditor.getState().setFxRange(clip.id, inst.id, Number(e.target.value), undefined)}
                      className="w-16 rounded border border-ink-700 bg-ink-900 px-1 py-0.5 text-right font-mono text-[10px] text-ink-100"
                    />
                    <input
                      type="number" min={FX_MIN_DUR} max={clip.duration} step={0.05}
                      value={Number(inst.duration.toFixed(2))}
                      aria-label="Effect length (seconds)"
                      onFocus={() => beginHistory()}
                      onBlur={() => endHistory()}
                      onChange={(e) => useEditor.getState().setFxRange(clip.id, inst.id, undefined, Number(e.target.value))}
                      className="w-16 rounded border border-ink-700 bg-ink-900 px-1 py-0.5 text-right font-mono text-[10px] text-ink-100"
                    />
                    <span className="font-mono text-[9px] text-ink-500">of {clip.duration.toFixed(1)}s</span>
                  </div>
                  {params.map((pd) => {
                    const raw = inst.params[pd.key]
                    const keys = inst.keys?.[pd.key] || []
                    const hasKeyHere = keys.some((k) => Math.abs(k.t - keyT) < 1e-4)
                    if (pd.kind === 'color') {
                      return (
                        <label key={pd.key} className="flex items-center gap-2 text-[10px] text-ink-300">
                          <span className="w-28 shrink-0 truncate">{pd.label}</span>
                          <input
                            type="color"
                            data-testid={`fxstack-color-${inst.id}-${pd.key}`}
                            value={String(raw ?? '#ffffff')}
                            onChange={(e) => updateFxParams(clip.id, inst.id, { [pd.key]: e.target.value })}
                            className="h-5 w-10 cursor-pointer rounded border border-ink-700 bg-transparent"
                          />
                        </label>
                      )
                    }
                    if (pd.kind === 'select') {
                      return (
                        <label key={pd.key} className="flex items-center gap-2 text-[10px] text-ink-300">
                          <span className="w-28 shrink-0 truncate">{pd.label}</span>
                          <select
                            data-testid={`fxstack-select-${inst.id}-${pd.key}`}
                            value={String(raw ?? pd.options?.[0] ?? '')}
                            onChange={(e) => updateFxParams(clip.id, inst.id, { [pd.key]: e.target.value })}
                            className="min-w-0 flex-1 rounded border border-ink-700 bg-ink-900 px-1 py-0.5 text-[10px] text-ink-100"
                          >
                            {(pd.options || []).map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                        </label>
                      )
                    }
                    const v = typeof raw === 'number' ? raw : Number(raw) || 0
                    return (
                      <div key={pd.key} className="flex items-center gap-1.5" data-testid={`fxstack-param-${inst.id}-${pd.key}`}>
                        <button
                          type="button"
                          data-testid={`fxstack-key-${inst.id}-${pd.key}`}
                          aria-label={hasKeyHere ? `Remove ${pd.label} keyframe here` : `Keyframe ${pd.label} at playhead`}
                          title={hasKeyHere ? 'Remove keyframe at playhead' : `Keyframe at playhead (${keys.length} keys)`}
                          onClick={() => {
                            if (hasKeyHere) removeFxKey(clip.id, inst.id, pd.key, keyT)
                            else setFxKey(clip.id, inst.id, pd.key, keyT, v)
                          }}
                          className={`grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] leading-none ${hasKeyHere ? 'bg-cyan-400 text-ink-950' : 'bg-ink-800 text-ink-400 hover:text-cyan-300'}`}
                        >
                          ◆
                        </button>
                        <span className="w-24 shrink-0 truncate text-[10px] text-ink-300" title={pd.label}>{pd.label}</span>
                        <input
                          type="range"
                          min={pd.min ?? 0}
                          max={pd.max ?? 1}
                          step={pd.step ?? 0.01}
                          value={v}
                          aria-label={pd.label}
                          onPointerDown={() => beginHistory()}
                          onPointerUp={() => endHistory()}
                          onChange={(e) => updateFxParams(clip.id, inst.id, { [pd.key]: Number(e.target.value) })}
                          className="min-w-0 flex-1 accent-cyan-400"
                        />
                        <input
                          type="number"
                          min={pd.min ?? 0}
                          max={pd.max ?? 1}
                          step={pd.step ?? 0.01}
                          value={Number(v.toFixed(3))}
                          aria-label={`${pd.label} value`}
                          onChange={(e) => updateFxParams(clip.id, inst.id, { [pd.key]: Number(e.target.value) })}
                          className="w-14 shrink-0 rounded border border-ink-700 bg-ink-900 px-1 py-0.5 text-right font-mono text-[10px] text-ink-100"
                        />
                      </div>
                    )
                  })}
                  <p className="text-[9px] text-ink-500">
                    Source: {fxCatalogById(inst.catalogId)?.trace || 'OmniFrame engine'}, min length {FX_MIN_DUR}s, keys interpolate inside the instance.
                  </p>
                </div>
              )}
            </div>
          )
        })}
        {allowed && (
          <button
            type="button"
            data-testid="fxstack-add"
            onClick={() => setLeftTab('effects')}
            className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-cyan-500/50 py-1.5 text-[10px] font-medium text-cyan-300 hover:bg-cyan-950/40"
          >
            <Plus size={12} /> Add effect from the Effects tab
          </button>
        )}
      </div>
    </PanelSection>
  )
}
