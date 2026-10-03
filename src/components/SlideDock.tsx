/**
 * SlideDock — a control cluster that slides out of the way.
 *
 * Overlays like the preview's view/3D/zoom cluster float above the canvas and
 * permanently eat a strip of it. This lets the user collapse any such cluster
 * down to a single handle, sliding the controls away to reclaim the space.
 *
 * The toggle is a real button with aria-expanded/aria-controls, and the
 * collapsed state is remembered per dock id so the choice survives a reload.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'

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

const HANDLE_ICON: Record<SlideDirection, typeof ChevronUp> = {
  up: ChevronUp,
  down: ChevronDown,
  left: ChevronLeft,
  right: ChevronRight,
}

/** When collapsed, the handle rotates to point where the content went. */
const HANDLE_ROTATION: Record<SlideDirection, string> = {
  up: 'rotate-180',
  down: '',
  left: 'rotate-90',
  right: '-rotate-90',
}

export function SlideDock({
  id,
  label,
  children,
  direction = 'up',
  defaultOpen = true,
  className = '',
}: {
  /** Stable id: used for aria wiring and for remembering the collapsed state. */
  id: string
  label: string
  children: ReactNode
  direction?: SlideDirection
  defaultOpen?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(() => readStored(id, defaultOpen))
  const contentId = useId()
  const first = useRef(true)

  useEffect(() => {
    // Skip the initial render so we don't write the default over a stored
    // value before it has been read.
    if (first.current) { first.current = false; return }
    writeStored(id, open)
  }, [id, open])

  const Icon = HANDLE_ICON[direction]
  const vertical = direction === 'up' || direction === 'down'

  return (
    <div
      data-testid={`slide-dock-${id}`}
      data-open={open ? 'true' : 'false'}
      className={`flex items-center gap-1 ${vertical ? 'flex-row' : 'flex-col'} ${className}`}
    >
      {/* The handle stays put so the dock is always recoverable. */}
      <button
        type="button"
        data-testid={`slide-dock-${id}-toggle`}
        aria-expanded={open}
        aria-controls={contentId}
        aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
        title={`${open ? 'Collapse' : 'Expand'} ${label}`}
        onClick={() => setOpen((v) => !v)}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-ink-700 bg-ink-800 text-ink-400 transition-colors hover:bg-ink-700 hover:text-white"
      >
        <Icon size={13} className={`transition-transform duration-150 ${open ? HANDLE_ROTATION[direction] : ''}`} />
      </button>

      <div
        id={contentId}
        aria-hidden={!open}
        className={[
          'flex items-center gap-1 overflow-hidden transition-all duration-200 ease-out',
          open
            ? 'max-w-[720px] max-h-40 translate-x-0 translate-y-0 opacity-100'
            : `max-w-0 max-h-0 opacity-0 ${TRANSFORM[direction]}`,
        ].join(' ')}
        style={{ pointerEvents: open ? 'auto' : 'none' }}
      >
        {children}
      </div>
    </div>
  )
}
