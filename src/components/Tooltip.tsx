/**
 * Draggable, collision-aware tooltip.
 *
 * The app previously relied on the native `title` attribute, which the browser
 * renders at its own size after its own delay, in a position we cannot control
 * — so tooltips were oversized, slow, and landed on top of whatever happened to
 * be nearby (notably the preview controls).
 *
 * This replaces it: a small, consistent floating label that
 *  - flips and clamps so it never leaves the viewport,
 *  - can be dragged anywhere once shown, and remembers where you put it,
 *  - dismisses on Escape,
 *  - stays out of the way of the pointer.
 *
 * Usage:
 *   <Tooltip label="Pencil" hint="B">
 *     <button ... />
 *   </Tooltip>
 *
 * For a bare element that only needs a tooltip, <Tooltip label="..."> renders a
 * wrapper span, so it works with any child.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

const SHOW_DELAY = 320
const EDGE_PAD = 8

/** Where the user last dragged each tooltip, so the choice sticks. */
const positions = new Map<string, { x: number; y: number }>()

type Side = 'top' | 'bottom'

export function Tooltip({
  label,
  hint,
  children,
  side = 'top',
  disabled = false,
}: {
  label: string
  /** Optional secondary line, e.g. a keyboard shortcut. */
  hint?: string
  children: ReactNode
  side?: Side
  disabled?: boolean
}) {
  const anchorRef = useRef<HTMLSpanElement | null>(null)
  const tipRef = useRef<HTMLDivElement | null>(null)
  const timer = useRef<number | null>(null)
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)

  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [moved, setMoved] = useState(false)
  // While the pointer is over the tooltip (or dragging it), leaving the
  // trigger must not close it -- otherwise the tooltip vanishes the instant
  // you reach for it and it can never be dragged.
  const holdRef = useRef(false)

  const id = useId()

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const show = useCallback(() => {
    if (disabled) return
    clearTimer()
    timer.current = window.setTimeout(() => setOpen(true), SHOW_DELAY)
  }, [clearTimer, disabled])

  // Closing is deferred by a short grace period. pointerleave on the trigger
  // fires *before* pointerenter on the tooltip, so without the delay the
  // tooltip closes in the gap between the two and can never be grabbed.
  const GRACE_MS = 140
  const hideTimer = useRef<number | null>(null)

  const cancelHide = useCallback(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])

  const hide = useCallback(() => {
    cancelHide()
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null
      if (holdRef.current) return
      clearTimer()
      setOpen(false)
    }, GRACE_MS)
  }, [cancelHide, clearTimer])

  /** Immediate close, for Escape and for when the anchor itself moves. */
  const hideNow = useCallback(() => {
    cancelHide()
    if (holdRef.current) return
    clearTimer()
    setOpen(false)
  }, [cancelHide, clearTimer])

  useEffect(() => clearTimer, [clearTimer])

  // Position against the anchor once it is on screen. Flips above/below and
  // clamps to the viewport so the tooltip is never cut off or off-screen.
  useLayoutEffect(() => {
    if (!open) { setPos(null); holdRef.current = false; return }
    const anchor = anchorRef.current
    if (!anchor) return

    const remember = positions.get(label)
    if (remember) { setPos(remember); return }

    const a = anchor.getBoundingClientRect()
    const measure = () => {
      const t = tipRef.current?.getBoundingClientRect()
      const w = t?.width ?? 160
      const h = t?.height ?? 30

      let x = a.left + a.width / 2 - w / 2
      x = Math.max(EDGE_PAD, Math.min(x, window.innerWidth - w - EDGE_PAD))

      let y = side === 'top' ? a.top - h - 8 : a.bottom + 8
      // Flip rather than overflow.
      if (side === 'top' && y < EDGE_PAD) y = a.bottom + 8
      if (side === 'bottom' && y + h > window.innerHeight - EDGE_PAD) y = a.top - h - 8
      y = Math.max(EDGE_PAD, Math.min(y, window.innerHeight - h - EDGE_PAD))

      return { x, y }
    }

    setPos(measure())
  }, [open, label, side])

  // Escape closes; scrolling or resizing closes too, since the anchor moved.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hideNow() }
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', hideNow, true)
    window.addEventListener('resize', hideNow)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', hideNow, true)
      window.removeEventListener('resize', hideNow)
      cancelHide()
    }
  }, [open, hideNow, cancelHide])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!pos) return
    e.preventDefault()
    e.stopPropagation()
    drag.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }, [pos])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    setPos({ x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) })
    if (!moved) setMoved(true)
  }, [moved])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return
    drag.current = null
    ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
    // Remember where the user parked it.
    setPos((p) => {
      if (p) positions.set(label, p)
      return p
    })
  }, [label])

  /** Press R while dragging (or click the reset dot) to undo a placement. */
  const resetPosition = useCallback(() => {
    positions.delete(label)
    setMoved(false)
    setOpen(false)
  }, [label])

  return (
    <>
      <span
        ref={anchorRef}
        className="contents"
        onPointerEnter={() => { holdRef.current = false; cancelHide(); show() }}
        onPointerLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-describedby={open ? id : undefined}
      >
        {children}
      </span>

      {open &&
        pos &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            data-testid="of-tooltip"
            data-draggable="true"
            className={[
              'fixed z-[9999] max-w-[240px] select-none rounded-md border border-ink-700',
              'bg-ink-950/95 px-2 py-1 text-[11px] leading-snug text-ink-100 shadow-lg backdrop-blur-xs',
              moved ? 'cursor-grabbing' : 'cursor-grab',
            ].join(' ')}
            style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
            onPointerEnter={() => { holdRef.current = true; cancelHide() }}
            onPointerLeave={() => { holdRef.current = false; hide() }}
            onPointerDown={(e) => { holdRef.current = true; onPointerDown(e) }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={(e) => { if (e.key === 'r' || e.key === 'R') resetPosition() }}
            tabIndex={-1}
          >
            <span className="flex items-center gap-1.5">
              <span>{label}</span>
              {hint && (
                <kbd className="rounded border border-ink-700 bg-ink-900 px-1 font-mono text-[10px] text-ink-400">
                  {hint}
                </kbd>
              )}
              {moved && (
                <button
                  type="button"
                  aria-label={`Reset ${label} tooltip position`}
                  className="ml-0.5 grid h-3.5 w-3.5 place-items-center rounded-sm text-[9px] text-ink-500 hover:bg-ink-800 hover:text-ink-200"
                  onClick={resetPosition}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  ⟲
                </button>
              )}
            </span>
            <span className="mt-0.5 block text-[9px] text-ink-500">
              {moved ? 'Drag to move · R to reset' : 'Drag to move'}
            </span>
          </div>,
          document.body,
        )}
    </>
  )
}
