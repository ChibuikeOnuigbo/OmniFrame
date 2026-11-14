import React, { useEffect, useState } from 'react'
import { Film, Layers, Spline, Copy, Eraser, PenLine } from 'lucide-react'
import { useEditor } from '../store'
import { DrawingPanel } from './DrawingPanel'

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
    <DrawingPanel />
  </div>
}
