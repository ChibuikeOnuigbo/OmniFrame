/**
 * FloatingWindow — the shared shell for popped-out dock panels.
 *
 * Any docker in the editor can pop out of the layout into one of these:
 * drag the dock's header away (or hit its pop-out button) and the panel
 * becomes a floating window with
 *   • header drag to move (and drag-in to dock back against the edge),
 *   • corner resize,
 *   • double-click header to maximize / restore,
 *   • click-to-front z-ordering (store floatZ allocator),
 *   • − / + collapse of the body down to the title bar,
 *   • a dock-back button in the header.
 *
 * The window body is simply the docked panel's content, so nothing is
 * re-implemented per panel.
 */

import React, { useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, PanelLeft, X } from 'lucide-react'
import { useEditor } from '../store'
import { CollapseChip } from './CollapseChip'

export interface FloatRect {
  x: number
  y: number
  w: number
  h: number
}

export function FloatingWindow({
  testId,
  title,
  rect,
  setRect,
  onDock,
  onClose,
  dockIcon,
  dockLabel = 'Dock back into the layout',
  headerExtra,
  children,
  initialFocusRef,
}: {
  testId: string
  title: string
  rect: FloatRect
  setRect: (patch: Partial<FloatRect>) => void
  /** return the panel to its dock slot */
  onDock: () => void
  /** optional hide (panel stays floating state is cleared by owner if desired) */
  onClose?: () => void
  dockIcon?: React.ReactNode
  dockLabel?: string
  /** extra header controls (panel-specific toggles) rendered before the chips */
  headerExtra?: React.ReactNode
  children: React.ReactNode
  initialFocusRef?: React.RefObject<HTMLElement | null>
}) {
  const bumpFloatZ = useEditor((s) => s.bumpFloatZ)
  // Start at the current top z, then claim a fresh one after mount (never
  // set() during render — that trips React's render-phase update guard).
  const [z, setZ] = useState(() => useEditor.getState().floatZ)
  useEffect(() => {
    setZ(useEditor.getState().bumpFloatZ())
  }, [])
  const [collapsed, setCollapsed] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const restoreRect = useRef<FloatRect | null>(null)

  const drag = useRef<{ kind: 'move' | 'resize'; startX: number; startY: number; base: FloatRect } | null>(null)

  const beginDrag = (kind: 'move' | 'resize', e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    drag.current = { kind, startX: e.clientX, startY: e.clientY, base: { ...rect } }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setZ(bumpFloatZ())
  }

  const onDragMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (d.kind === 'move') {
      setRect({ x: d.base.x + dx, y: d.base.y + dy })
    } else {
      setRect({ w: d.base.w + dx, h: d.base.h + dy })
    }
  }

  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // pointer already released
    }
    // Drag-in gesture: end a move-drag with the header near the left screen
    // edge → dock the panel back where it came from.
    if (d?.kind === 'move' && e.clientX <= 12) onDock()
  }

  const toggleMaximize = () => {
    if (maximized) {
      if (restoreRect.current) setRect(restoreRect.current)
      setMaximized(false)
    } else {
      restoreRect.current = { ...rect }
      setRect({ x: 24, y: 64, w: window.innerWidth - 48, h: window.innerHeight - 128 })
      setMaximized(true)
    }
  }

  const geometry = maximized
    ? { left: rect.x, top: rect.y, width: rect.w, height: collapsed ? 36 : rect.h }
    : { left: rect.x, top: rect.y, width: rect.w, height: collapsed ? 36 : rect.h }

  return (
    <div
      data-testid={testId}
      data-collapsed={collapsed ? 'true' : 'false'}
      data-maximized={maximized ? 'true' : 'false'}
      role="dialog"
      aria-label={title}
      ref={initialFocusRef as React.RefObject<HTMLDivElement>}
      tabIndex={-1}
      style={{ position: 'fixed', ...geometry, zIndex: z }}
      onPointerDown={() => setZ(bumpFloatZ())}
      className="flex flex-col rounded-xl border border-ink-600 bg-ink-850 shadow-[0_24px_64px_rgba(0,0,0,0.55)] overflow-hidden"
    >
      <div
        data-testid={`${testId}-header`}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return
          beginDrag('move', e)
        }}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return
          toggleMaximize()
        }}
        title="Drag to move · double-click to maximize · drag to the left edge to dock back"
        className="h-9 shrink-0 flex items-center justify-between gap-2 px-3 border-b border-ink-700 bg-ink-900/90 text-xs font-semibold uppercase tracking-wider text-ink-300 cursor-grab active:cursor-grabbing select-none touch-none"
      >
        <span className="truncate" title={title}>
          {title}
        </span>
        <div className="flex items-center gap-1">
          {headerExtra}
          <CollapseChip
            open={!collapsed}
            onToggle={() => setCollapsed((v) => !v)}
            label={`${title} window body`}
            compact
          />
          <button
            type="button"
            data-testid={`${testId}-maximize-btn`}
            title={maximized ? 'Restore window size' : 'Maximize window'}
            aria-label={maximized ? 'Restore window size' : 'Maximize window'}
            aria-pressed={maximized}
            onClick={toggleMaximize}
            className="grid h-7 w-7 place-items-center rounded text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button
            type="button"
            data-testid={`${testId}-dock-btn`}
            title={dockLabel}
            aria-label={dockLabel}
            onClick={onDock}
            className="grid h-7 w-7 place-items-center rounded text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {dockIcon ?? <PanelLeft size={13} />}
          </button>
          {onClose ? (
            <button
              type="button"
              data-testid={`${testId}-close-btn`}
              title="Hide panel"
              aria-label="Hide panel"
              onClick={onClose}
              className="grid h-7 w-7 place-items-center rounded text-ink-400 transition-colors hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
      </div>
      {!collapsed ? (
        <div data-testid={`${testId}-body`} className="flex min-h-0 flex-1 flex-col">
          {children}
        </div>
      ) : null}
      {!collapsed ? (
        <div
          data-testid={`${testId}-resize`}
          onPointerDown={(e) => beginDrag('resize', e)}
          onPointerMove={onDragMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          title="Drag to resize"
          aria-label={`Resize ${title} window`}
          className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize touch-none"
        >
          <div className="absolute bottom-1 right-1 h-2 w-2 border-b-2 border-r-2 border-ink-500" />
        </div>
      ) : null}
    </div>
  )
}
