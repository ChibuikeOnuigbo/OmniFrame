import React, { useEffect } from 'react'
import { Film, Layers, Spline, Copy, Eraser } from 'lucide-react'
import { useEditor } from '../store'
import { DrawingPanel } from './DrawingPanel'

/** Cel-focused entry into the shared drawing engine; project clips stay intact. */
export function AnimationPanel() {
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
    <DrawingPanel />
  </div>
}
