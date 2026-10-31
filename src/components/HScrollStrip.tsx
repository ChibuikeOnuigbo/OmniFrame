import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEditor } from '../store'

/**
 * Segmented strip — one bar, three regions, per the design sketch:
 *
 *   [ ◀ cell ][ viewport: segments, every segment the SAME size ][ ▶ cell ]
 *
 * The maths that keep it honest:
 *  - visible = clamp(floor(viewportW / targetW), 1, total)
 *  - cellW   = viewportW / visible          (exact division)
 *  - offsets are always whole multiples of cellW (snapped on scroll-end)
 *
 * Because the viewport width is an exact multiple of the segment width,
 * at rest every visible segment is fully inside the view and every other
 * segment is fully hidden — a segment is never sliced at the edge
 * ("cut out"). The arrows are full-height cells in the layout flow,
 * never overlays floating on top of segments. Clicking an arrow pages
 * by `visible` segments and lands flush.
 *
 * When the "Hide horizontal overflow" setting is OFF the strip falls
 * back to a plain native-scrollbar strip with natural-width children
 * and no arrows.
 */
export function HScrollStrip({
  children,
  className = '',
  innerClassName = '',
  arrowTestIdPrefix = 'hstrip',
  segmentTargetWidth = 88,
  ...rest
}: {
  children: React.ReactNode
  className?: string
  innerClassName?: string
  arrowTestIdPrefix?: string
  /** Target segment width in px; the real width is viewportW / visible. */
  segmentTargetWidth?: number
} & React.HTMLAttributes<HTMLDivElement>) {
  const hideOverflowX = useEditor((s) => s.hideOverflowX)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [viewportW, setViewportW] = useState(0)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)
  const [hasOverflow, setHasOverflow] = useState(false)
  const dragRef = useRef<{ x: number; left: number; moved: boolean } | null>(null)
  const suppressClickRef = useRef(false)
  const hoverTimerRef = useRef<number | null>(null)
  const snapTimerRef = useRef<number | null>(null)
  const snappingRef = useRef(false)

  const items = React.Children.toArray(children)
  const total = items.length
  // Segments size to their CONTENT: the widest label (measured from the
  // rendered children, +8px cell padding) sets the desired segment width,
  // so full text is visible whenever the viewport can afford it. The
  // exact-division rule still holds: cellW = viewportW / visible.
  const [contentW, setContentW] = useState(0)
  const desiredW = Math.min(viewportW || Infinity, Math.max(segmentTargetWidth, contentW))
  const visible = Math.max(1, Math.min(total || 1, Math.floor(viewportW / desiredW) || 1))
  const cellW = viewportW > 0 ? viewportW / visible : segmentTargetWidth

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    let max = 0
    el.querySelectorAll('[data-segment-cell] > *').forEach((child) => {
      max = Math.max(max, (child as HTMLElement).scrollWidth)
    })
    const needed = max > 0 ? max + 8 : 0
    setContentW((prev) => (Math.abs(prev - needed) > 1 ? needed : prev))
  })

  const updateArrows = useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 2)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
    setHasOverflow(el.scrollWidth > el.clientWidth + 2)
  }, [])

  // Keep the resting offset on a whole-segment boundary: no cut-outs.
  const snapToSegment = useCallback(() => {
    const el = viewportRef.current
    if (!el || cellW <= 0) return
    const max = Math.max(0, el.scrollWidth - el.clientWidth)
    const target = Math.min(max, Math.max(0, Math.round(el.scrollLeft / cellW) * cellW))
    if (Math.abs(target - el.scrollLeft) < 1) return
    snappingRef.current = true
    el.scrollTo({ left: target, behavior: 'smooth' })
    window.setTimeout(() => { snappingRef.current = false }, 350)
  }, [cellW])

  const scheduleSnap = useCallback(() => {
    if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current)
    snapTimerRef.current = window.setTimeout(() => { if (!snappingRef.current) snapToSegment() }, 130)
  }, [snapToSegment])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const measure = () => { setViewportW(el.clientWidth); updateArrows() }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [updateArrows, total])

  // Native non-passive wheel listener (React attaches wheel as passive).
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!useEditor.getState().hideOverflowX) return
      if (el.scrollWidth <= el.clientWidth) return
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY
        e.preventDefault()
        scheduleSnap()
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [scheduleSnap])

  const stopHoverScroll = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      window.clearInterval(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    scheduleSnap()
  }, [scheduleSnap])

  const startHoverScroll = (dir: -1 | 1) => {
    if (hoverTimerRef.current !== null) window.clearInterval(hoverTimerRef.current)
    hoverTimerRef.current = window.setInterval(() => {
      viewportRef.current?.scrollBy({ left: dir * 12 })
    }, 16)
  }

  const page = (dir: -1 | 1) => {
    // A click is a deliberate page: kill any hover-scroll so the train
    // lands exactly on the segment boundary instead of drifting past it.
    if (hoverTimerRef.current !== null) {
      window.clearInterval(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    const el = viewportRef.current
    if (!el || cellW <= 0) return
    const max = Math.max(0, el.scrollWidth - el.clientWidth)
    const index = Math.round(el.scrollLeft / cellW) + dir * visible
    const target = Math.min(max, Math.max(0, index * cellW))
    snappingRef.current = true
    el.scrollTo({ left: target, behavior: 'smooth' })
    window.setTimeout(() => { snappingRef.current = false }, 350)
  }

  const arrowBtn =
    'grid w-9 shrink-0 cursor-pointer place-items-center self-stretch text-ink-300 transition-colors hover:bg-brand/15 hover:text-white disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand'

  if (!hideOverflowX) {
    return (
      <div className={className}>
        <div ref={viewportRef} className={`of-hstrip flex overflow-x-auto ${innerClassName}`} {...rest}>
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-stretch overflow-hidden rounded-xl border border-ink-700/80 bg-ink-900/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${className}`}>
      {hasOverflow && (
        <button
          type="button"
          data-testid={`${arrowTestIdPrefix}-arrow-left`}
          aria-label="Scroll left"
          title="Previous segments (hover to keep scrolling)"
          disabled={!canLeft}
          onMouseEnter={() => startHoverScroll(-1)}
          onMouseLeave={stopHoverScroll}
          onClick={() => page(-1)}
          className={`${arrowBtn} rounded-l-[11px] border-r border-ink-700/70`}
        >
          <ChevronLeft size={16} />
        </button>
      )}
      <div
        ref={viewportRef}
        onScroll={() => { updateArrows(); if (!snappingRef.current) scheduleSnap() }}
        onPointerDown={(e) => {
          dragRef.current = { x: e.clientX, left: viewportRef.current?.scrollLeft ?? 0, moved: false }
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current
          const el = viewportRef.current
          if (!drag || !el) return
          const dx = e.clientX - drag.x
          if (Math.abs(dx) > 4) drag.moved = true
          if (drag.moved) el.scrollLeft = drag.left - dx
        }}
        onPointerUp={() => {
          if (dragRef.current?.moved) {
            suppressClickRef.current = true
            window.setTimeout(() => { suppressClickRef.current = false }, 50)
          }
          dragRef.current = null
          scheduleSnap()
        }}
        onClickCapture={(e) => {
          if (suppressClickRef.current) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
        className="of-hstrip scrollbar-none min-w-0 flex-1 overflow-x-auto"
        {...rest}
      >
        <div className={`flex items-stretch ${innerClassName}`} style={{ width: total * cellW }}>
          {items.map((child, i) => (
            <div
              key={(child as React.ReactElement)?.key ?? i}
              data-segment-cell={i}
              className="shrink-0 overflow-hidden px-0.5 py-1"
              style={{ width: cellW }}
            >
              {React.isValidElement(child)
                ? React.cloneElement(child as React.ReactElement<{ className?: string }>, {
                    className: `${(child.props as { className?: string }).className ?? ''} flex h-full w-full items-center justify-center whitespace-nowrap truncate leading-none`,
                  })
                : child}
            </div>
          ))}
        </div>
      </div>
      {hasOverflow && (
        <button
          type="button"
          data-testid={`${arrowTestIdPrefix}-arrow-right`}
          aria-label="Scroll right"
          title="Next segments (hover to keep scrolling)"
          disabled={!canRight}
          onMouseEnter={() => startHoverScroll(1)}
          onMouseLeave={stopHoverScroll}
          onClick={() => page(1)}
          className={`${arrowBtn} rounded-r-[11px] border-l border-ink-700/70`}
        >
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  )
}
