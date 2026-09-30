import { useEffect, useRef, useState, useMemo } from 'react'
import { useEditor } from '../store'

export type CursorState =
  | 'default'
  | 'pointer'
  | 'drag'
  | 'help'
  | 'grab'
  | 'grabbing'
  | 'blade'
  | 'crosshair'
  | 'text'
  | 'resize-ew'
  | 'resize-ns'

interface ClickRipple {
  id: number
  x: number
  y: number
}

export function CustomCursor() {
  const cursorConfig = useEditor((s) => s.cursorConfig)
  const tool = useEditor((s) => s.tool)
  const drawingEnabled = useEditor((s) => s.drawingEnabled)

  const [pos, setPos] = useState({ x: -100, y: -100 })
  const [cursorState, setCursorState] = useState<CursorState>('default')
  const [isMouseDown, setIsMouseDown] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [ripples, setRipples] = useState<ClickRipple[]>([])
  const nextRippleId = useRef(0)

  // Determine size scale factor
  const scale = useMemo(() => {
    switch (cursorConfig.size) {
      case 'standard':
        return 0.9
      case 'mega':
        return 1.35
      case 'bigger':
      default:
        return 1.15 // "bugger" / enlarged gamified
    }
  }, [cursorConfig.size])

  // Theme styling colors
  const themeColors = useMemo(() => {
    switch (cursorConfig.theme) {
      case 'cyber-violet':
        return {
          fill: '#0f051d',
          stroke: '#a855f7',
          shadow: 'rgba(168, 85, 247, 0.6)',
          accent: '#06b6d4',
          plusBg: '#8b5cf6',
          helpBg: '#06b6d4',
        }
      case 'neo-stealth':
        return {
          fill: '#18181b',
          stroke: '#e4e4e7',
          shadow: 'rgba(0, 0, 0, 0.7)',
          accent: '#ffffff',
          plusBg: '#3f3f46',
          helpBg: '#52525b',
        }
      case 'mac-gamified':
      default:
        return {
          fill: '#09090b',
          stroke: '#ffffff',
          shadow: 'rgba(0, 0, 0, 0.55)',
          accent: '#8b5cf6',
          plusBg: '#10b981', // vibrant emerald
          helpBg: '#f59e0b', // vibrant amber
        }
    }
  }, [cursorConfig.theme])

  // Track global pointer events & element targets
  useEffect(() => {
    if (!cursorConfig.enabled) {
      document.documentElement.classList.remove('of-custom-cursor-active')
      return
    }

    document.documentElement.classList.add('of-custom-cursor-active')

    const onPointerMove = (e: PointerEvent) => {
      setPos({ x: e.clientX, y: e.clientY })
      if (!isVisible) setIsVisible(true)

      // Inspect target element for context-aware cursor states
      const target = e.target as HTMLElement | null
      if (!target) return

      // 1. Blade tool active
      if (tool === 'blade' && target.closest('[data-testid="timeline-lanes"], [data-testid="timeline-clip"]')) {
        setCursorState('blade')
        return
      }

      // 2. Help / Info: "cursor with question mark"
      if (
        cursorConfig.showBadges &&
        (target.closest('[data-testid="asset-info-btn"]') ||
          target.closest('[data-help="true"]') ||
          target.closest('button[title*="specifications"], button[title*="specs"], [title*="details"]'))
      ) {
        setCursorState('help')
        return
      }

      // 3. Dragging / Draggable: "cursor with plus for drag / day / drop"
      if (
        cursorConfig.showBadges &&
        (target.closest('[draggable="true"]') ||
          target.closest('[data-testid="media-asset"]') ||
          target.closest('[data-testid="add-to-timeline-btn"]') ||
          target.closest('[data-drop-target="true"]') ||
          target.closest('.cursor-grab') ||
          target.closest('.cursor-grabbing'))
      ) {
        setCursorState(isMouseDown ? 'drag' : 'drag')
        return
      }

      // 4. Resize handles
      if (target.closest('[data-testid*="trim"], .cursor-ew-resize')) {
        setCursorState('resize-ew')
        return
      }

      // 5. Drawing canvas crosshair
      if (drawingEnabled && target.closest('#drawing-paint-canvas, [data-testid="preview-stage"]')) {
        setCursorState('crosshair')
        return
      }

      // 6. Text inputs & editable titles
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        setCursorState('text')
        return
      }

      // 7. Clickable pointer
      if (
        target.closest('button') ||
        target.closest('a') ||
        target.closest('[role="button"]') ||
        target.closest('[role="menuitem"]') ||
        target.closest('input[type="checkbox"]') ||
        target.closest('select') ||
        target.closest('.cursor-pointer')
      ) {
        setCursorState('pointer')
        return
      }

      // Default state
      setCursorState('default')
    }

    const onPointerDown = (e: PointerEvent) => {
      setIsMouseDown(true)
      if (cursorConfig.showClickBurst) {
        const id = nextRippleId.current++
        setRipples((prev) => [...prev, { id, x: e.clientX, y: e.clientY }])
        setTimeout(() => {
          setRipples((prev) => prev.filter((r) => r.id !== id))
        }, 600)
      }
    }

    const onPointerUp = () => {
      setIsMouseDown(false)
    }

    const onPointerLeave = () => {
      setIsVisible(false)
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('mousemove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('mousedown', onPointerDown, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    window.addEventListener('mouseup', onPointerUp, { passive: true })
    document.addEventListener('mouseleave', onPointerLeave)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('mousemove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('mouseup', onPointerUp)
      document.removeEventListener('mouseleave', onPointerLeave)
      document.documentElement.classList.remove('of-custom-cursor-active')
    }
  }, [cursorConfig.enabled, cursorConfig.showBadges, cursorConfig.showClickBurst, isVisible, isMouseDown, tool, drawingEnabled])

  if (!cursorConfig.enabled || !isVisible) return null

  return (
    <div
      data-testid="custom-cursor-container"
      data-cursor-state={cursorState}
      data-cursor-size={cursorConfig.size}
      data-cursor-theme={cursorConfig.theme}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        pointerEvents: 'none',
        zIndex: 99999,
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        willChange: 'transform',
      }}
    >
      {/* Click Burst Particle Ripples */}
      {ripples.map((ripple) => (
        <div
          key={ripple.id}
          data-testid="cursor-click-burst"
          style={{
            position: 'absolute',
            left: -12,
            top: -12,
            width: 24,
            height: 24,
            borderRadius: '50%',
            border: `2px solid ${themeColors.accent}`,
            animation: 'ofCursorPing 0.5s cubic-bezier(0, 0, 0.2, 1) forwards',
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* SVG Vector Mac Cursors */}
      <div
        data-testid="custom-cursor-glyph"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
          filter: `drop-shadow(0 3px 6px ${themeColors.shadow})`,
        }}
      >
        {cursorState === 'default' && (
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            {/* Mac Arrow with crisp outline */}
            <path
              d="M2 2L2 22L7.5 17L12.5 26.5L16 24.5L11 15.5L18.5 15.5L2 2Z"
              fill={themeColors.fill}
              stroke={themeColors.stroke}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Gamified power core */}
            <circle cx="6" cy="6" r="1.8" fill={themeColors.accent} />
          </svg>
        )}

        {cursorState === 'pointer' && (
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            {/* Sleek Mac Pointing Hand */}
            <path
              d="M9 2C8 2 7 3 7 4.5V13L5 13C3.5 13 2.5 14 2.5 15.5C2.5 16.5 3 17.5 4 18.5L9.5 24C10.5 25 12 26 14 26H19C21 26 22.5 24.5 22.5 22.5V14C22.5 12.5 21.5 11.5 20 11.5C19.5 11.5 19 11.7 18.5 12V10C18.5 8.5 17.5 7.5 16 7.5C15.5 7.5 15 7.7 14.5 8V6C14.5 4.5 13.5 3.5 12 3.5C11.5 3.5 11 3.7 10.5 4V4.5C10.5 3 9.5 2 9 2Z"
              fill={themeColors.fill}
              stroke={themeColors.stroke}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            {/* Gamified Fingertip Glow */}
            <circle cx="9" cy="4" r="1.5" fill={themeColors.accent} />
          </svg>
        )}

        {cursorState === 'drag' && (
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" data-testid="cursor-drag-plus">
            {/* Mac Arrow */}
            <path
              d="M2 2L2 22L7.5 17L12.5 26.5L16 24.5L11 15.5L18.5 15.5L2 2Z"
              fill={themeColors.fill}
              stroke={themeColors.stroke}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Gamified Plus Badge: "cursor with plus for drag" */}
            <g transform="translate(14, 13)">
              <circle cx="7" cy="7" r="7" fill={themeColors.plusBg} stroke="#ffffff" strokeWidth="1.6" />
              <path
                d="M7 4V10M4 7H10"
                stroke="#ffffff"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
          </svg>
        )}

        {cursorState === 'help' && (
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" data-testid="cursor-help-question">
            {/* Mac Arrow */}
            <path
              d="M2 2L2 22L7.5 17L12.5 26.5L16 24.5L11 15.5L18.5 15.5L2 2Z"
              fill={themeColors.fill}
              stroke={themeColors.stroke}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Gamified Question Mark Badge: "cursor with question mark" */}
            <g transform="translate(14, 13)">
              <circle cx="7" cy="7" r="7" fill={themeColors.helpBg} stroke="#ffffff" strokeWidth="1.6" />
              <text
                x="7"
                y="10.5"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="10"
                fontWeight="bold"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                ?
              </text>
            </g>
          </svg>
        )}

        {cursorState === 'blade' && (
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            {/* Scalpel / Blade Razor */}
            <path
              d="M4 24L18 10L24 4L22 2L16 8L2 22L4 24Z"
              fill={themeColors.fill}
              stroke={themeColors.stroke}
              strokeWidth="1.8"
            />
            <line x1="2" y1="22" x2="26" y2="22" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 2" />
          </svg>
        )}

        {cursorState === 'crosshair' && (
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            {/* Precision Crosshair */}
            <circle cx="14" cy="14" r="8" stroke={themeColors.stroke} strokeWidth="1.6" />
            <circle cx="14" cy="14" r="2" fill={themeColors.accent} />
            <line x1="14" y1="2" x2="14" y2="9" stroke={themeColors.stroke} strokeWidth="1.6" />
            <line x1="14" y1="19" x2="14" y2="26" stroke={themeColors.stroke} strokeWidth="1.6" />
            <line x1="2" y1="14" x2="9" y2="14" stroke={themeColors.stroke} strokeWidth="1.6" />
            <line x1="19" y1="14" x2="26" y2="14" stroke={themeColors.stroke} strokeWidth="1.6" />
          </svg>
        )}

        {cursorState === 'text' && (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            {/* Mac I-Beam */}
            <path
              d="M9 4H15M12 4V20M9 20H15"
              stroke={themeColors.stroke}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M9 4H15M12 4V20M9 20H15"
              stroke={themeColors.fill}
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        )}

        {cursorState === 'resize-ew' && (
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            {/* Double-ended horizontal trim arrow */}
            <path
              d="M6 14L10 10V13H18V10L22 14L18 18V15H10V18L6 14Z"
              fill={themeColors.fill}
              stroke={themeColors.stroke}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </div>
  )
}
