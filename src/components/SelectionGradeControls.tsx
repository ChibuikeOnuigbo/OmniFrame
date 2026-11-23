import type { Clip } from '../types'
import { useEditor } from '../store'
import { paramsForPatch } from '../lib/effectCatalog'

/** Native adjustment layers share the same parameter schema as dropped instances. */
export function SelectionGradeControls({ clip }: { clip: Clip }) {
  const keys = new Set(['boxBlur', 'colorHold', 'holdColor', 'holdSimilarity', 'holdSoftness', 'lumaRange', 'lumaLow', 'lumaHigh', 'lumaFeather', 'lumaInvert', 'despill', 'despillChannel', 'despillBalance', 'despillLuma', 'channelMixer', 'mixRR', 'mixRG', 'mixRB', 'mixGR', 'mixGG', 'mixGB', 'mixBR', 'mixBG', 'mixBB'])
  const values = Object.fromEntries(Object.entries(clip.effects ?? {}).filter((entry): entry is [string, number | string] => typeof entry[1] === 'number' || typeof entry[1] === 'string'))
  const params = paramsForPatch(values).filter(p => keys.has(p.key))
  if (!params.length) return null
  const change = (key: string, value: number | string) => {
    const state = useEditor.getState(), standalone = !state.inInteraction
    if (standalone) state.beginHistory()
    state.setClipProp(clip.id, { effects: { ...clip.effects, [key]: value } })
    if (standalone) state.endHistory()
  }
  const end = () => useEditor.getState().endHistory()
  return <div className="space-y-2 rounded border border-ink-700 p-2" data-testid="selection-grade-controls">
    <span className="text-xs font-medium">Effect controls</span>
    {params.map(param => <label key={param.key} className="grid min-w-0 grid-cols-[88px_minmax(0,1fr)] items-center gap-2 text-[11px]">
      <span className="truncate" title={param.label}>{param.label}</span>
      {param.kind === 'select' ? <select aria-label={param.label} value={String(values[param.key])} onChange={e => change(param.key, e.target.value)} className="min-w-0 rounded border border-ink-700 bg-ink-900 p-1">
        {param.options?.map(option => <option key={option}>{option}</option>)}
      </select> : param.kind === 'color' ? <input type="color" aria-label={param.label} value={String(values[param.key])} onChange={e => change(param.key, e.target.value)} className="h-6 w-full"/> : <div className="flex min-w-0 items-center gap-1">
        <input type="range" aria-label={param.label} min={param.min} max={param.max} step={param.step} value={Number(values[param.key])}
          onPointerDown={() => useEditor.getState().beginHistory()} onPointerUp={end} onPointerCancel={end} onBlur={end}
          onChange={e => change(param.key, Number(e.target.value))} className="min-w-0 flex-1"/>
        <output className="w-8 shrink-0 text-right tabular-nums">{Number(values[param.key]).toFixed((param.step ?? 1) < 1 ? 2 : 0)}</output>
      </div>}
    </label>)}
  </div>
}
