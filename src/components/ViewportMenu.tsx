import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

/** Measure the real menu instead of guessing its height. Keep long menus usable
 * on short displays, with keyboard navigation and focus restoration. */
export function ViewportMenu({ x, y, onClose, children, menuRef, testId='timeline-context-menu', label='Timeline actions', attributes={} }: { x: number; y: number; onClose: () => void; children: ReactNode; menuRef?: RefObject<HTMLDivElement>; testId?: string; label?: string; attributes?: Record<string,string|number> }) {
  const localRef = useRef<HTMLDivElement>(null)
  const ref = menuRef || localRef
  const close = useRef(onClose); close.current = onClose
  useLayoutEffect(() => {
    const element = ref.current!
    const previous = document.activeElement as HTMLElement | null
    const place = () => {
      const view = window.visualViewport
      const width = view?.width ?? window.innerWidth, height = view?.height ?? window.innerHeight
      const ox = view?.offsetLeft ?? 0, oy = view?.offsetTop ?? 0
      element.style.maxHeight = `${Math.max(32, height - 16)}px`
      element.style.maxWidth = `${Math.max(32, width - 16)}px`
      const box = element.getBoundingClientRect()
      element.style.left = `${ox + Math.max(8, Math.min(x - ox, width - box.width - 8))}px`
      element.style.top = `${oy + Math.max(8, Math.min(y - oy, height - box.height - 8))}px`
      element.querySelectorAll('button').forEach(button => button.setAttribute('role', 'menuitem'))
    }
    place()
    const observer = new ResizeObserver(place); observer.observe(element)
    window.addEventListener('resize', place); window.visualViewport?.addEventListener('resize', place)
    element.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
    return () => {
      observer.disconnect(); window.removeEventListener('resize', place); window.visualViewport?.removeEventListener('resize', place)
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [x, y])
  return createPortal(<div ref={ref} data-testid={testId} {...attributes} role="menu" aria-label={label} onPointerDown={event=>event.stopPropagation()} onContextMenu={event=>event.preventDefault()}
    className="fixed z-[100] w-56 overflow-y-auto overscroll-contain rounded-lg border border-ink-600 bg-ink-850 p-1.5 text-xs text-ink-200 shadow-2xl"
    style={{ left: x, top: y }} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); return }
      if (event.key === 'Tab') { close.current(); return }
      if (!(event.target instanceof HTMLButtonElement)) return
      const buttons = [...ref.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter(button => button.getClientRects().length)
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : event.key === 'ArrowDown' ? (index + 1) % buttons.length : event.key === 'ArrowUp' ? (index - 1 + buttons.length) % buttons.length : -1
      if (next >= 0) { event.preventDefault(); event.stopPropagation(); buttons[next]?.focus({ preventScroll: true }); buttons[next]?.scrollIntoView({ block: 'nearest' }) }
    }}>{children}</div>, document.body)
}
