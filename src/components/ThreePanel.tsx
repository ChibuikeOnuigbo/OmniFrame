import React from 'react'
import { Box, Eye, Grid, RotateCcw, Maximize2, Layers } from 'lucide-react'
import { useEditor } from '../store'

export function ThreePanel() {
  const setWorkspacePreset = useEditor((s) => s.setWorkspacePreset)

  return (
    <div data-testid="three-panel" className="p-3 text-xs text-ink-200 select-none space-y-3">
      <div className="p-2.5 rounded-lg bg-ink-900 border border-ink-800">
        <div className="flex items-center gap-1.5 font-semibold text-brand mb-1">
          <Box size={14} />
          <span>3D & 2.5D Compositing</span>
        </div>
        <p className="text-[11px] text-ink-400 leading-relaxed">
          Interactive WebGL viewport supporting camera orbit, pan, dolly, coordinate axes, and 2.5D video planes.
        </p>
      </div>

      <div className="space-y-1.5">
        <span className="text-[10px] font-semibold uppercase text-ink-500 block">Workspace Modes</span>
        <button
          type="button"
          data-testid="activate-3d-preset-btn"
          onClick={() => setWorkspacePreset('3d')}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-brand/20 hover:bg-brand/30 text-brand text-xs font-medium transition-colors border border-brand/30"
        >
          <span>Open 3D Scene Workspace</span>
          <Box size={14} />
        </button>
      </div>

      <div className="pt-2 border-t border-ink-800 space-y-2">
        <span className="text-[10px] font-semibold uppercase text-ink-500 block">Camera Controls Guide</span>
        <div className="space-y-1 text-[11px] text-ink-400">
          <div className="flex justify-between">
            <span className="text-ink-300">Orbit Camera:</span>
            <span className="font-mono text-ink-500">Left-click + Drag</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-300">Pan Target:</span>
            <span className="font-mono text-ink-500">Right-click / Shift+Drag</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-300">Dolly / Zoom:</span>
            <span className="font-mono text-ink-500">Mouse Wheel Scroll</span>
          </div>
        </div>
      </div>
    </div>
  )
}
