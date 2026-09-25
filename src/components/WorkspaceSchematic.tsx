import React from 'react'
import type { WorkspacePreset, FocusMode } from '../types'

interface WorkspaceSchematicProps {
  preset?: WorkspacePreset
  focusMode?: FocusMode
  leftOpen?: boolean
  rightOpen?: boolean
  className?: string
}

export const WorkspaceSchematic: React.FC<WorkspaceSchematicProps> = ({
  preset,
  focusMode = 'none',
  leftOpen,
  rightOpen,
  className = '',
}) => {
  // Determine layout geometry based on preset or flags
  let showLeft = leftOpen ?? true
  let showRight = rightOpen ?? true
  let timelineRatio = 'h-[30%]'
  let previewRatio = 'flex-1'

  if (focusMode === 'canvas-only' || preset === 'full-canvas') {
    showLeft = false
    showRight = false
    timelineRatio = 'h-0 hidden'
  } else if (focusMode === 'preview' || preset === 'preview-focus') {
    showLeft = false
    showRight = false
    timelineRatio = 'h-[20%]'
  } else if (focusMode === 'timeline' || preset === 'timeline-focus') {
    showLeft = false
    showRight = false
    timelineRatio = 'h-[60%]'
  } else if (focusMode === 'one-panel') {
    showLeft = false
    showRight = true
    timelineRatio = 'h-[25%]'
  } else if (preset === 'edit') {
    showLeft = true
    showRight = false
    timelineRatio = 'h-[40%]'
  } else if (preset === 'drawing') {
    showLeft = true
    showRight = false
    timelineRatio = 'h-[25%]'
  } else if (preset === 'color') {
    showLeft = false
    showRight = true
    timelineRatio = 'h-[30%]'
  } else if (preset === '3d') {
    showLeft = true
    showRight = true
    timelineRatio = 'h-[25%]'
  } else if (preset === 'minimal') {
    showLeft = false
    showRight = false
    timelineRatio = 'h-[22%]'
  }

  return (
    <div
      data-testid="workspace-schematic"
      aria-hidden="true"
      className={`w-11 h-7 rounded border border-ink-700 bg-ink-950 flex flex-col overflow-hidden shrink-0 select-none pointer-events-none ${className}`}
    >
      {/* Top Workspace (Left Dock | Center Preview | Right Inspector) */}
      <div className={`flex flex-1 overflow-hidden w-full ${previewRatio}`}>
        {showLeft && (
          <div className="w-2.5 bg-brand/30 border-r border-ink-800" />
        )}
        <div className="flex-1 bg-ink-800/80 flex items-center justify-center">
          <div className="w-2 h-1.5 rounded-sm bg-ink-600/50" />
        </div>
        {showRight && (
          <div className="w-2.5 bg-amber-500/25 border-l border-ink-800" />
        )}
      </div>

      {/* Bottom Timeline */}
      {timelineRatio !== 'h-0 hidden' && (
        <div className={`w-full ${timelineRatio} bg-ink-900 border-t border-ink-800 flex items-center px-0.5 gap-0.5`}>
          <div className="w-1.5 h-1 bg-brand/50 rounded-[1px]" />
          <div className="w-2.5 h-1 bg-ink-700 rounded-[1px]" />
          <div className="w-2 h-1 bg-ink-700 rounded-[1px]" />
        </div>
      )}
    </div>
  )
}
