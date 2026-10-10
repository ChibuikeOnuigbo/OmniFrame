/**
 * SlideDock — a control cluster that collapses out of the way.
 *
 * Overlays like the preview's view/3D/zoom cluster float above the canvas and
 * permanently eat a strip of it. This lets the user collapse any such cluster
 * down to nothing, sliding the controls away to reclaim the space.
 *
 * The toggle is the editor-wide − / + CollapseChip (minus while open, plus
 * while collapsed) with aria-expanded/aria-controls, and the collapsed state
 * is remembered per dock id so the choice survives a reload. Owners can also
 * drive it controlled (toggle="none") and place the chip elsewhere — the
 * preview keeps its chip in the stage's top-left corner.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { CollapseChip } from './CollapseChip'

export type SlideDirection = 'up' | 'down' | 'left' | 'right'

const OPEN_KEY = 'omniframe.slideDock.open'

function readStored(id: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(`${OPEN_KEY}.${id}`)
    return raw === null ? fallback : raw === '1'
  } catch {
    return fallback
  }
}

function writeStored(id: string, open: boolean) {
  try {
    localStorage.setItem(`${OPEN_KEY}.${id}`, open ? '1' : '0')
  } catch {
    /* private mode; the dock still works, it just forgets */
  }
}

// Collapsed, the content slides along `direction` and fades out. Expanded, it
// rests at zero with full opacity.
const TRANSFORM: Record<SlideDirection, string> = {
  up: '-translate-y-3',
  down: 'translate-y-3',
  left: '-translate-x-3',
  right: 'translate-x-3',
}

export function SlideDock({
  id,
  label,
  children,
  direction = 'up',
  defaultOpen = true,
  className = '',
  toggle = 'leading',
  open: openProp,
  onOpenChange,
}: {
  /** Stable id: used for aria wiring and for remembering the collapsed state. */
  id: string
  label: string
  children: ReactNode
  direction?: SlideDirection
  defaultOpen?: boolean
  className?: string
  /** 'leading' renders the −/+ chip inline; 'none' for owners that place the chip themselves. */
  toggle?: 'leading' | 'none'
  /** Controlled open state (with onOpenChange). Uncontrolled otherwise. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [storedOpen, setStoredOpen] = useState(() => readStored(id, defaultOpen))
  const open = openProp ?? storedOpen
  const setOpen = (v: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof v === 'function' ? v(open) : v
    if (onOpenChange) onOpenChange(next)
    else setStoredOpen(next)
  }
  const contentId = useId()
  const first = useRef(true)

  useEffect(() => {
    // Skip the initial render so we don't write the default over a stored
    // value before it has been read.
    if (first.current) { first.current = false; return }
    if (openProp === undefined) writeStored(id, storedOpen)
  }, [id, storedOpen, openProp])

  const vertical = direction === 'up' || direction === 'down'

  return (
    <div
      data-testid={`slide-dock-${id}`}
      data-open={open ? 'true' : 'false'}
      className={`flex items-center gap-1 ${vertical ? 'flex-row' : 'flex-col'} ${className}`}
    >
      {/* The −/+ chip stays put so the dock is always recoverable. */}
      {toggle === 'leading' ? (
        <span aria-controls={contentId} className="contents">
          <CollapseChip
            open={open}
            onToggle={() => setOpen((v) => !v)}
            label={label}
            testId={`slide-dock-${id}-toggle`}
          />
        </span>
      ) : null}

      <div
        id={contentId}
        aria-hidden={!open}
        className={[
          'flex w-max min-w-0 items-center gap-1 overflow-hidden transition-all duration-200 ease-out',
          open
            ? 'max-w-[720px] max-sm:max-w-[calc(100vw_-_3rem)] max-h-40 translate-x-0 translate-y-0 opacity-100'
            : `max-w-0 max-h-0 opacity-0 ${TRANSFORM[direction]}`,
        ].join(' ')}
        style={{ pointerEvents: open ? 'auto' : 'none' }}
      >
        {children}
      </div>
    </div>
  )
}
