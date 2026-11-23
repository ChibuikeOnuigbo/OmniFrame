import React, { useEffect, useState } from 'react'
import { Film, Layers, Spline, Copy, Eraser, PenLine, Scissors, Diamond, RotateCcw } from 'lucide-react'
import { useEditor } from '../store'
import { DrawingPanel } from './DrawingPanel'
import { drawingTrimAt, isStrokeVisibleAtTime } from '../lib/drawingEngine'

function DrawingTrimControls() {
  const strokes = useEditor(s => s.drawingStrokes)
  const layer = useEditor(s => s.activePaintLayerId)
  const time = useEditor(s => s.playhead)
  const fps = useEditor(s => s.projectFps)
  const [selected, setSelected] = useState('')
  const available = strokes.filter(s => s.layerId === layer && ['brush', 'pencil', 'marker', 'calligraphy'].includes(s.tool) && s.points.length >= 2 && isStrokeVisibleAtTime(s, time, fps))
  const stroke = available.find(s => s.id === selected) ?? available[0]
  const trim = stroke ? drawingTrimAt(stroke, time) : { start: 0, end: 1, offset: 0 }
  const historyEnd = () => useEditor.getState().endHistory()
  return <fieldset disabled={!stroke} className="mx-2 mb-2 space-y-2 rounded-md border border-ink-700 p-2" data-testid="drawing-trim">
    <legend className="flex items-center gap-1 px-1 text-xs"><Scissors size={13}/>Trim path</legend>
    <div className="flex min-w-0 gap-1">
      <select aria-label="Trim stroke" value={stroke?.id ?? ''} onChange={e => setSelected(e.target.value)} className="min-w-0 flex-1 rounded border border-ink-700 bg-ink-900 p-1 text-xs">
        {!available.length && <option value="">Draw a stroke</option>}
        {available.map((s, index) => <option key={s.id} value={s.id}>{s.tool} {index + 1}</option>)}
      </select>
      <button type="button" aria-label="Reset path trim" title="Reset trim and its keys" onClick={() => stroke && useEditor.getState().resetDrawingTrim(stroke.id)} className="rounded border border-ink-700 p-1.5"><RotateCcw size={13}/></button>
    </div>
    {(['start', 'end', 'offset'] as const).map(field => <div key={field} className="grid grid-cols-[38px_minmax(0,1fr)_36px_26px] items-center gap-1 text-[11px]">
      <label htmlFor={`trim-${field}`} className="capitalize">{field}</label>
      <input id={`trim-${field}`} aria-label={`Trim ${field}`} type="range" min={field === 'offset' ? -100 : 0} max="100" step="1" value={Math.round(trim[field] * 100)}
        onPointerDown={() => useEditor.getState().beginHistory()} onPointerUp={historyEnd} onPointerCancel={historyEnd} onBlur={historyEnd}
        onChange={e => stroke && useEditor.getState().setDrawingTrim(stroke.id, field, Number(e.target.value) / 100)} className="min-w-0 w-full"/>
      <output htmlFor={`trim-${field}`} className="text-right tabular-nums">{Math.round(trim[field] * 100)}%</output>
      <button type="button" aria-label={`Keyframe trim ${field}`} title="Set key at playhead" onClick={() => stroke && useEditor.getState().setDrawingTrim(stroke.id, field, trim[field], true)} className="grid h-6 place-items-center rounded hover:bg-ink-800">
        <Diamond size={12} className={stroke?.pathTrim?.keys?.[field]?.some(k => Math.abs(k.t - time) < .5 / fps) ? 'fill-cyan-300 text-cyan-300' : 'text-ink-400'}/>
      </button>
    </div>)}
  </fieldset>
}

/** Cel-focused entry into the shared drawing engine; project clips stay intact. */
export function AnimationPanel() {
  const [revealSeconds, setRevealSeconds] = useState(2)
  const graph = useEditor(s => s.graphEditorOpen)
  const onion = useEditor(s => s.onionSkin.enabled)
  useEffect(() => {
    const s = useEditor.getState()
    s.pause()
    s.setDrawingScope({ type: 'frame', frame: Math.round(s.playhead * s.projectFps), holdFrames: s.drawingHoldFrames })
    s.setDrawingEnabled(true)
    s.setOnionSkin({ enabled: true })
  }, [])
  return <div data-testid="animation-workspace">
    <div className="grid grid-cols-3 gap-1 p-2" aria-label="Animation controls">
      <button className="flex h-9 items-center justify-center gap-1 rounded border border-ink-700 text-xs" onClick={() => useEditor.getState().setGraphEditorOpen(false)} aria-pressed={!graph}><Film size={14}/>Cels</button>
      <button className="flex h-9 items-center justify-center gap-1 rounded border border-ink-700 text-xs" onClick={() => useEditor.getState().setGraphEditorOpen(true)} aria-pressed={graph}><Spline size={14}/>Curves</button>
      <button className="flex h-9 items-center justify-center gap-1 rounded border border-ink-700 text-xs" onClick={() => useEditor.getState().setOnionSkin({enabled: !onion})} aria-pressed={onion}><Layers size={14}/>Onion</button>
    </div>
    <div className="grid grid-cols-2 gap-1 px-2 pb-2">
      <button data-testid="duplicate-cel" className="flex h-9 items-center justify-center gap-1 rounded border border-ink-700 text-xs" onClick={() => useEditor.getState().editDrawingCel('duplicate-next')} title="Copy the current cel into the next exposure"><Copy size={14}/>Duplicate next</button>
      <button data-testid="clear-cel" className="flex h-9 items-center justify-center gap-1 rounded border border-ink-700 text-xs" onClick={() => useEditor.getState().editDrawingCel('clear')} title="Clear this exposure on the active paint layer"><Eraser size={14}/>Clear cel</button>
    </div>
    <div className="mx-2 mb-2 flex items-center gap-2 text-xs">
      <label htmlFor="draw-on-duration" className="shrink-0">Draw on</label>
      <input id="draw-on-duration" data-testid="draw-on-duration" aria-label="Draw on duration in seconds" type="range" min="0.2" max="10" step="0.1" value={revealSeconds} onChange={e => setRevealSeconds(Number(e.target.value))} className="min-w-0 flex-1" />
      <span className="w-8 text-right tabular-nums">{revealSeconds.toFixed(1)}s</span>
      <button data-testid="draw-on-strokes" className="h-9 rounded border border-ink-700 px-2" onClick={() => useEditor.getState().animateDrawingStrokes(revealSeconds)} title="Reveal visible freehand strokes on the active layer"><PenLine size={14}/></button>
    </div>
    <DrawingTrimControls />
    <DrawingPanel />
  </div>
}
