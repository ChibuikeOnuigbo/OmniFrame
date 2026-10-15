import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEditor } from '../store'

/**
 * Advanced horizontal scroller used for chip/tab strips.
 *
 * When the "Hide horizontal overflow" setting is ON (default): the native
 * scrollbar is invisible; pinned arrows appear at the leftmost/rightmost
 * edges (hover an arrow to keep scrolling, click to page), the mouse wheel
 * scrolls sideways, and dragging scrolls too. When the setting is OFF the
 * strip falls back to a plain native scrollbar with no arrows — everything
 * behaves like a normal scroll area again.
 */
export function HScrollStrip({
  children,
  className = '',
  innerClassName = '',
  arrowTestIdPrefix = 'hstrip',
  ...rest
}: {
  children: React.ReactNode
  className?: string
  innerClassName?: string
  arrowTestIdPrefix?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  const hideOverflowX = useEditor((s) => s.hideOverflowX)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)
  const dragRef = useRef<{ x: number; left: number; moved: boolean } | null>(null)
  const suppressClickRef = useRef(false)
  const hoverTimerRef = useRef<number | null>(null)

  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 2)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
  }, [])

  useEffect(() => {
    updateArrows()
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(updateArrows)
    observer.observe(el)
    window.addEventListener('resize', updateArrows)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateArrows)
    }
  }, [updateArrows, children])

  // Native non-passive wheel listener: React attaches wheel as passive, so
  // preventDefault there only logs errors. Sideways wheel scrolling must
  // stop the page/panel from also scrolling vertically.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!useEditor.getState().hideOverflowX) return
      if (el.scrollWidth <= el.clientWidth) return
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY
        e.preventDefault()
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const stopHoverScroll = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      window.clearInterval(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  const startHoverScroll = (dir: -1 | 1) => {
    stopHoverScroll()
    hoverTimerRef.current = window.setInterval(() => {
      scrollRef.current?.scrollBy({ left: dir * 12 })
    }, 16)
  }

  const page = (dir: -1 | 1) => {
    const el = scrollRef.current
    if (el) el.scrollBy({ left: dir * Math.max(80, el.clientWidth * 0.8), behavior: 'smooth' })
  }

  return (
    <div className={`relative ${className}`}>
      <div
        ref={scrollRef}
        onScroll={updateArrows}
        onPointerDown={(e) => {
          if (!hideOverflowX) return
          dragRef.current = { x: e.clientX, left: scrollRef.current?.scrollLeft ?? 0, moved: false }
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current
          const el = scrollRef.current
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
        }}
        onClickCapture={(e) => {
          if (suppressClickRef.current) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
        className={`of-hstrip flex overflow-x-auto ${hideOverflowX ? 'scrollbar-none' : ''} ${innerClassName}`}
        {...rest}
      >
        {children}
      </div>
      {hideOverflowX && canLeft && (
        <button
          type="button"
          data-testid={`${arrowTestIdPrefix}-arrow-left`}
          aria-label="Scroll left"
          title="Scroll left (hover to keep scrolling)"
          onMouseEnter={() => startHoverScroll(-1)}
          onMouseLeave={stopHoverScroll}
          onClick={() => page(-1)}
          className="absolute left-0 top-1/2 z-10 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full border border-ink-600 bg-ink-900/95 text-ink-100 shadow-md transition-colors hover:bg-ink-700"
        >
          <ChevronLeft size={13} />
        </button>
      )}
      {hideOverflowX && canRight && (
        <button
          type="button"
          data-testid={`${arrowTestIdPrefix}-arrow-right`}
          aria-label="Scroll right"
          title="Scroll right (hover to keep scrolling)"
          onMouseEnter={() => startHoverScroll(1)}
          onMouseLeave={stopHoverScroll}
          onClick={() => page(1)}
          className="absolute right-0 top-1/2 z-10 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full border border-ink-600 bg-ink-900/95 text-ink-100 shadow-md transition-colors hover:bg-ink-700"
        >
          <ChevronRight size={13} />
        </button>
      )}
    </div>
  )
}
