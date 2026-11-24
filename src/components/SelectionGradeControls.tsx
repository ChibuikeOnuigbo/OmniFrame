import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Diamond, RotateCcw, Square } from 'lucide-react'
import type { Clip, ClipEffect } from '../types'
import { useEditor } from '../store'
import { paramsForPatch } from '../lib/effectCatalog'
import { clipEffectsAt, clipEffectTime } from '../lib/clipEffectAnimation'
import { PanelSection } from './PanelSection'

/** Native layers and clip grades use the same parameter schema as dropped instances. */
export function SelectionGradeControls({ clip }: { clip: Clip }) {
  const ownsHistory = useRef(false)
  const begin = () => {
    if (!useEditor.getState().inInteraction) { useEditor.getState().beginHistory(); ownsHistory.current = true }
  }
  const end = () => {
    if (ownsHistory.current) { ownsHistory.current = false; useEditor.getState().endHistory() }
  }
  useEffect(() => () => { if (ownsHistory.current) { ownsHistory.current = false; useEditor.getState().endHistory() } }, [clip.id])
  const playhead = useEditor(s => s.playhead)
  const locked = useEditor(s => s.tracks.find(t => t.id === clip.trackId)?.locked ?? false)
  const localTime = Math.max(0, Math.min(clip.duration, playhead - clip.start))
  const time = clipEffectTime(clip, localTime)
  const values = Object.fromEntries(Object.entries(clipEffectsAt(clip, localTime) ?? {}).filter((entry): entry is [string, number | string] => typeof entry[1] === 'number' || typeof entry[1] === 'string'))
  const params = paramsForPatch(values)
  if (!params.length) return null
  const change = (key: string, value: number | string) => useEditor.getState().setClipEffect(clip.id, { [key]: value } as Partial<ClipEffect>)
  const jump = (sourceTime: number) => {
    const state = useEditor.getState()
    state.pause()
    state.setPlayhead(clip.start + sourceTime - clipEffectTime(clip, 0))
  }
  const buttonClass = 'grid h-6 w-6 shrink-0 place-items-center rounded border border-transparent text-ink-400 hover:border-ink-600 hover:text-white disabled:opacity-25 disabled:hover:border-transparent'
  return <PanelSection title="Effects" testId="effects" defaultOpen>
    <fieldset disabled={locked} className="min-w-0 space-y-3" data-testid="selection-grade-controls">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium" title={clip.name}>{clip.name}</span>
        <button type="button" aria-label="Reset native effects" title="Reset native effects and their keyframes" className={buttonClass} onClick={() => useEditor.getState().resetClipEffects(clip.id)}><RotateCcw size={13}/></button>
      </div>
      {params.map(param => {
        const keys = clip.effectKeys?.[param.key] ?? []
        const atKey = keys.some(k => Math.abs(k.t - time) < 1e-6)
        const visible = keys.map(k => k.t).filter(t => t >= clipEffectTime(clip, 0) - 1e-6 && t <= clipEffectTime(clip, clip.duration) + 1e-6).sort((a, b) => a - b)
        const previous = visible.filter(t => t < time - 1e-6).pop(), next = visible.find(t => t > time + 1e-6)
        const inputId = `native-effect-${clip.id}-${param.key}`
        return <div key={param.key} className="min-w-0 space-y-1" data-testid={`native-effect-${param.key}`}>
          <div className="flex min-w-0 items-center justify-between gap-1">
            <label htmlFor={inputId} className="min-w-0 truncate text-[11px]" title={param.label}>{param.label}</label>
            {param.kind === 'number' && <div className="flex shrink-0 items-center">
              <button type="button" className={buttonClass} aria-label={`Previous ${param.label} keyframe`} disabled={previous === undefined} onClick={() => previous !== undefined && jump(previous)}><ChevronLeft size={13}/></button>
              <button type="button" className={`${buttonClass} ${keys.length ? 'text-brand-300' : ''}`} aria-label={`${atKey ? 'Remove' : 'Add'} ${param.label} keyframe`} aria-pressed={atKey}
                title={`${atKey ? 'Remove' : 'Add'} keyframe; keyed sliders animate at the playhead`}
                onClick={() => atKey ? useEditor.getState().removeClipEffectKey(clip.id, param.key, localTime) : useEditor.getState().setClipEffectKey(clip.id, param.key, localTime, Number(values[param.key]))}><Diamond size={12} fill={atKey ? 'currentColor' : 'none'}/></button>
              <button type="button" className={buttonClass} aria-label={`Next ${param.label} keyframe`} disabled={next === undefined} onClick={() => next !== undefined && jump(next)}><ChevronRight size={13}/></button>
              <button type="button" className={buttonClass} aria-label={`Stop animating ${param.label}`} title="Keep this value and remove its keyframes" disabled={!keys.length} onClick={() => useEditor.getState().removeClipEffectKey(clip.id, param.key)}><Square size={10}/></button>
            </div>}
          </div>
          {param.key === 'directionalBlurAngle' && <div className="grid grid-cols-3 gap-1" role="group" aria-label="Blur direction presets">
            {[[0, 'Horizontal'], [90, 'Vertical'], [45, 'Diagonal']].map(([angle, name]) => <button key={name} type="button" aria-pressed={Number(values[param.key]) === angle} onClick={() => change(param.key, Number(angle))} className="min-w-0 truncate rounded border border-ink-700 px-1 py-1 text-[10px] hover:border-ink-500 aria-pressed:border-brand aria-pressed:bg-brand/20">{name}</button>)}
          </div>}
          {param.kind === 'select' ? <select id={inputId} value={String(values[param.key])} onChange={e => change(param.key, e.target.value)} className="w-full min-w-0 rounded border border-ink-700 bg-ink-900 p-1 text-xs">
            {param.options?.map(option => <option key={option}>{option}</option>)}
          </select> : param.kind === 'color' ? <input id={inputId} type="color" value={String(values[param.key])} onChange={e => change(param.key, e.target.value)} className="h-6 w-full"/> : <div className="flex min-w-0 items-center gap-2">
            <input id={inputId} type="range" min={param.min} max={param.max} step={param.step} value={Number(values[param.key])}
              onPointerDown={begin} onPointerUp={end} onPointerCancel={end} onBlur={end}
              onChange={e => change(param.key, Number(e.target.value))} className="min-w-0 flex-1"/>
            <output className="w-10 shrink-0 text-right text-[11px] tabular-nums">{Number(values[param.key]).toFixed((param.step ?? 1) < 1 ? 2 : 0)}</output>
          </div>}
        </div>
      })}
    </fieldset>
  </PanelSection>
}
