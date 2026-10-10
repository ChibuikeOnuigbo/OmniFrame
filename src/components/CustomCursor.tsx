import { useEffect, useRef, useState, useMemo } from 'react'
import { useEditor } from '../store'

export type CursorState =
  | 'default'
  | 'pointer'
  | 'drag'
  | 'drop'
  | 'no-drop'
  | 'help'
  | 'grab'
  | 'grabbing'
  | 'blade'
  | 'crosshair'
  | 'text'
  | 'resize-ew'
  | 'resize-ns'
  | 'rotate'
  | 'beachball'

interface ClickRipple {
  id: number
  x: number
  y: number
}

interface DragItemInfo {
  label: string
  kind: string
}

export function CustomCursor() {
  const cursorConfig = useEditor((s) => s.cursorConfig)
  const tool = useEditor((s) => s.tool)
  const drawingEnabled = useEditor((s) => s.drawingEnabled)
  // `viewMode` never existed on the store; the 3D toggle is `is3DMode`.
  const is3DMode = useEditor((s) => s.is3DMode)

  const [pos, setPos] = useState({ x: -100, y: -100 })
  const [cursorState, setCursorState] = useState<CursorState>('default')
  const [isMouseDown, setIsMouseDown] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragItem, setDragItem] = useState<DragItemInfo | null>(null)
  const [helpText, setHelpText] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [ripples, setRipples] = useState<ClickRipple[]>([])
  const nextRippleId = useRef(0)

  // Determine size scale factor. Real OS cursors render ~13-22 CSS px tall;
  // the base SVGs are 26-40px boxes, so "standard" is 0.85 to land near
  // native size and "compact" goes smaller for precision work (blade/drawing).
  const scale = useMemo(() => {
    switch (cursorConfig.size) {
      case 'compact':
        return 0.7
      case 'mega':
        return 1.35
      case 'bigger':
        return 1.1
      case 'standard':
      default:
        return 0.85
    }
  }, [cursorConfig.size])

  // Pro Precision keeps the glyph itself clean: no energy dots or glow accents.
  const isProPack = (cursorConfig.pack || cursorConfig.theme) === 'pro-precision'

  // Theme styling colors based on pack / theme
  const themeColors = useMemo(() => {
    const activePack = cursorConfig.pack || cursorConfig.theme
    switch (activePack) {
      case 'pro-precision':
        return {
          fill: '#0b0d13',
          stroke: '#f8fafc',
          shadow: 'rgba(0, 0, 0, 0.5)',
          accent: '#6d5efc',
          plusBg: '#6d5efc',
          helpBg: '#d97706',
          dropBg: '#059669',
          noDropBg: '#dc2626',
        }
      case 'cyber-violet':
        return {
          fill: '#0f051d',
          stroke: '#a855f7',
          shadow: 'rgba(168, 85, 247, 0.65)',
          accent: '#06b6d4',
          plusBg: '#8b5cf6',
          helpBg: '#06b6d4',
          dropBg: '#06b6d4',
          noDropBg: '#ef4444',
        }
      case 'neo-stealth':
        return {
          fill: '#18181b',
          stroke: '#f4f4f5',
          shadow: 'rgba(0, 0, 0, 0.8)',
          accent: '#ffffff',
          plusBg: '#3f3f46',
          helpBg: '#52525b',
          dropBg: '#3b82f6',
          noDropBg: '#991b1b',
        }
      case 'mac-sonoma-pro':
        return {
          fill: '#000000',
          stroke: '#ffffff',
          shadow: 'rgba(0, 0, 0, 0.45)',
          accent: '#3b82f6',
          plusBg: '#22c55e',
          helpBg: '#f59e0b',
          dropBg: '#10b981',
          noDropBg: '#ef4444',
        }
      case 'mac-gamified':
      default:
        return {
          fill: '#050508',
          stroke: '#ffffff',
          shadow: 'rgba(0, 0, 0, 0.6)',
          accent: '#8b5cf6', // neon purple core
          plusBg: '#10b981', // vibrant emerald
          helpBg: '#f59e0b', // vibrant amber
          dropBg: '#10b981', // magnetized emerald
          noDropBg: '#ef4444',
        }
    }
  }, [cursorConfig.pack, cursorConfig.theme])

  // Global pointer & drag event listeners
  useEffect(() => {
    if (!cursorConfig.enabled) {
      document.documentElement.classList.remove('of-custom-cursor-active')
      return
    }

    document.documentElement.classList.add('of-custom-cursor-active')

    const updatePositionAndTarget = (clientX: number, clientY: number, target: HTMLElement | null) => {
      setPos({ x: clientX, y: clientY })
      if (!isVisible) setIsVisible(true)
      if (!target) return

      // 1. Blade tool active over timeline clips / lanes
      if (tool === 'blade' && target.closest('[data-testid="timeline-lanes"], [data-testid="timeline-clip"]')) {
        setCursorState('blade')
        setHelpText(null)
        return
      }

      // 2. Active Drag & Drop handling: "more refined form for drag, drop etc"
      if (isDragging) {
        // If over a valid drop target (timeline lanes or track lanes)
        if (target.closest('[data-drop-target="true"], [data-testid="timeline-lanes"], [data-testid^="track-lane-"]')) {
          setCursorState('drop') // Magnetized drop reticle!
          return
        }
        // If over non-droppable forbidden area during drag
        if (target.closest('[data-no-drop="true"], header, nav, [data-testid="top-bar"]')) {
          setCursorState('no-drop') // Red forbidden circle-slash
          return
        }
        // Default drag state
        setCursorState('drag')
        return
      }

      // 3. Hovering over draggable media asset or drag handle
      if (
        cursorConfig.showBadges &&
        (target.closest('[draggable="true"]') ||
          target.closest('[data-testid="media-asset"]') ||
          target.closest('[data-testid="add-to-timeline-btn"]'))
      ) {
        const assetEl = target.closest('[data-testid="media-asset"]') as HTMLElement | null
        if (assetEl) {
          const name = assetEl.getAttribute('data-asset-name') || 'Media Asset'
          const kind = assetEl.getAttribute('data-asset-kind') || 'video'
          setDragItem({ label: name, kind })
        }
        setCursorState('drag')
        setHelpText(null)
        return
      }

      // 4. Help / Info: "cursor with question mark"
      if (
        cursorConfig.showBadges &&
        (target.closest('[data-testid="asset-info-btn"]') ||
          target.closest('[data-help="true"]') ||
          target.closest('button[title*="specifications"], button[title*="specs"], [title*="details"]'))
      ) {
        const title = target.getAttribute('title') || 'Inspect details & specifications'
        setHelpText(title.replace(/\s*\(.*?\)\s*/g, '').slice(0, 32))
        setCursorState('help')
        return
      }
      setHelpText(null)

      // 5. 3D Rotation / Orbit in 3D mode
      if (is3DMode && target.closest('[data-testid="three-canvas-wrapper"], canvas')) {
        setCursorState('rotate')
        return
      }

      // 6. Resize handles
      if (target.closest('[data-testid*="trim"], .cursor-ew-resize')) {
        setCursorState('resize-ew')
        return
      }
      if (target.closest('[data-testid="timeline-splitter"], .cursor-row-resize')) {
        setCursorState('resize-ns')
        return
      }

      // 7. Drawing canvas crosshair
      if (drawingEnabled && target.closest('#drawing-paint-canvas, [data-testid="preview-stage"]')) {
        setCursorState('crosshair')
        return
      }

      // 8. Text inputs & editable titles
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        setCursorState('text')
        return
      }

      // 9. Active Grab / Grabbing
      if (target.closest('.cursor-grabbing')) {
        setCursorState('grabbing')
        return
      }
      if (target.closest('.cursor-grab')) {
        setCursorState('grab')
        return
      }

      // 10. Clickable pointer for buttons & interactive elements
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

      // Default macOS Arrow state
      setCursorState('default')
    }

    const onPointerMove = (e: PointerEvent | MouseEvent) => {
      updatePositionAndTarget(e.clientX, e.clientY, e.target as HTMLElement | null)
    }

    const onPointerDown = (e: PointerEvent | MouseEvent) => {
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
      setIsDragging(false)
    }

    // HTML5 Drag and Drop event tracking to keep custom cursor active during dragging
    const onDragStart = (e: DragEvent) => {
      setIsDragging(true)
      const target = e.target as HTMLElement | null
      const assetEl = target?.closest('[data-testid="media-asset"]') as HTMLElement | null
      if (assetEl) {
        const name = assetEl.getAttribute('data-asset-name') || 'Media Asset'
        const kind = assetEl.getAttribute('data-asset-kind') || 'video'
        setDragItem({ label: name, kind })
      }
    }

    const onDragOver = (e: DragEvent) => {
      updatePositionAndTarget(e.clientX, e.clientY, e.target as HTMLElement | null)
    }

    const onDragEnd = () => {
      setIsDragging(false)
      setDragItem(null)
    }

    const onDrop = () => {
      setIsDragging(false)
      setDragItem(null)
    }

    const onPointerLeave = () => {
      setIsVisible(false)
    }

    const onMouseEnter = () => {
      setIsVisible(true)
    }

    const onWindowBlur = () => {
      setIsVisible(false)
    }

    const onWindowFocus = () => {
      setIsVisible(true)
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('mousemove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('mousedown', onPointerDown, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    window.addEventListener('mouseup', onPointerUp, { passive: true })
    window.addEventListener('dragstart', onDragStart)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragend', onDragEnd)
    window.addEventListener('drop', onDrop)
    document.addEventListener('mouseleave', onPointerLeave)
    document.addEventListener('mouseenter', onMouseEnter)
    window.addEventListener('blur', onWindowBlur)
    window.addEventListener('focus', onWindowFocus)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('mousemove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('mouseup', onPointerUp)
      window.removeEventListener('dragstart', onDragStart)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragend', onDragEnd)
      window.removeEventListener('drop', onDrop)
      document.removeEventListener('mouseleave', onPointerLeave)
      document.removeEventListener('mouseenter', onMouseEnter)
      window.removeEventListener('blur', onWindowBlur)
      window.removeEventListener('focus', onWindowFocus)
      document.documentElement.classList.remove('of-custom-cursor-active')
    }
  }, [
    cursorConfig.enabled,
    cursorConfig.showBadges,
    cursorConfig.showClickBurst,
    isVisible,
    isMouseDown,
    isDragging,
    tool,
    drawingEnabled,
    is3DMode,
  ])

  // Hotspot offset based on cursor state
  const hotspotOffset = useMemo(() => {
    switch (cursorState) {
      case 'pointer':
        return { x: -9 * scale, y: -2 * scale }
      case 'crosshair':
        return { x: -15 * scale, y: -15 * scale }
      case 'text':
        return { x: -13 * scale, y: -13 * scale }
      case 'resize-ew':
      case 'resize-ns':
        return { x: -15 * scale, y: -15 * scale }
      case 'rotate':
        return { x: -16 * scale, y: -16 * scale }
      case 'drop':
        return { x: -20 * scale, y: -20 * scale }
      case 'beachball':
        return { x: -14 * scale, y: -14 * scale }
      case 'grab':
      case 'grabbing':
        return { x: -10 * scale, y: -6 * scale }
      case 'default':
      case 'drag':
      case 'no-drop':
      case 'help':
      default:
        return { x: 0, y: 0 }
    }
  }, [cursorState, scale])

  if (!cursorConfig.enabled || !isVisible) return null

  return (
    <div
      data-testid="custom-cursor-container"
      data-cursor-state={cursorState}
      data-cursor-size={cursorConfig.size}
      data-cursor-theme={cursorConfig.theme}
      data-cursor-pack={cursorConfig.pack}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        pointerEvents: 'none',
        zIndex: 9999999,
        transform: `translate3d(${pos.x + hotspotOffset.x}px, ${pos.y + hotspotOffset.y}px, 0)`,
        willChange: 'transform',
      }}
    >
      {/* Click Burst Shockwave Ripples */}
      {ripples.map((ripple) => (
        <div
          key={ripple.id}
          data-testid="cursor-click-burst"
          style={{
            position: 'absolute',
            left: -14,
            top: -14,
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: `2px solid ${themeColors.accent}`,
            boxShadow: `0 0 12px ${themeColors.accent}`,
            animation: 'ofCursorPing 0.5s cubic-bezier(0, 0, 0.2, 1) forwards',
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Primary SVG Vector macOS Cursors */}
      <div
        data-testid="custom-cursor-glyph"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
          filter: `drop-shadow(0 3px 6px ${themeColors.shadow})`,
        }}
      >
        {/* 1. DEFAULT: Authentic Apple macOS Sonoma Arrow */}
        {cursorState === 'default' && (
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            {/* Crisp Apple White Backing */}
            <path
              d="m6.148 18.473 1.863-1.003 1.615-.839-2.568-4.816h4.332l-11.379-11.408v16.015l3.316-3.221z"
              fill={themeColors.stroke}
              stroke={themeColors.stroke}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Crisp Apple Black Core */}
            <path
              d="m6.431 17 1.765-.941-2.775-5.202h3.604l-8.025-8.043v11.188l2.53-2.442z"
              fill={themeColors.fill}
            />
            {/* Gamified Core Energy Dot (suppressed in Pro Precision) */}
            {!isProPack && (
              <circle cx="2.6" cy="3.6" r="1.3" fill={themeColors.accent} opacity="0.9" />
            )}
          </svg>
        )}

        {/* 2. POINTER: Authentic Apple macOS Pointing Hand */}
        {cursorState === 'pointer' && (
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
            {/* Apple Pointing Hand White Backing */}
            <path
              d="m9 2c-1.5 0-2.5 1-2.5 2.5v9.5h-1.5c-1.5 0-2.5 1-2.5 2.5 0 1 0.5 2 1.5 3l5.5 5.5c1 1 2.5 2 4.5 2h5c2 0 3.5-1.5 3.5-3.5v-8.5c0-1.5-1-2.5-2.5-2.5-0.5 0-1 0.2-1.5 0.5v-2c0-1.5-1-2.5-2.5-2.5-0.5 0-1 0.2-1.5 0.5v-2c0-1.5-1-2.5-2.5-2.5-0.5 0-1 0.2-1.5 0.5v-4c0-1.5-1-2.5-1.5-2.5z"
              fill={themeColors.stroke}
              stroke={themeColors.stroke}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Apple Pointing Hand Core */}
            <path
              d="m9 2.8c-1 0-1.8 0.8-1.8 1.8v9.8h-2.2c-1 0-1.8 0.8-1.8 1.8 0 0.8 0.4 1.5 1.1 2.2l5.4 5.4c0.8 0.8 2 1.6 3.6 1.6h5c1.5 0 2.6-1.1 2.6-2.6v-8.7c0-1-0.8-1.8-1.8-1.8-0.4 0-0.8 0.1-1.1 0.4v-1.8c0-1-0.8-1.8-1.8-1.8-0.4 0-0.8 0.1-1.1 0.4v-1.8c0-1-0.8-1.8-1.8-1.8-0.4 0-0.8 0.1-1.1 0.4v-3.3c0-1-0.8-1.8-1.2-1.8z"
              fill={themeColors.fill}
            />
            {/* Tactile Fingertip Glow (suppressed in Pro Precision) */}
            {!isProPack && <circle cx="9" cy="4.2" r="1.4" fill={themeColors.accent} />}
          </svg>
        )}

        {/* 3. DRAG: Refined Apple Arrow + Vibrant Emerald `+` Badge */}
        {cursorState === 'drag' && (
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" data-testid="cursor-drag-plus">
            {/* Apple White Arrow */}
            <path
              d="m2 2 13 13h-7.5l2.8 5.4-2 1-2.8-5.4-3.5 3.5z"
              fill={themeColors.stroke}
              stroke={themeColors.stroke}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {/* Apple Black Arrow */}
            <path
              d="m2 2 13 13h-7.5l2.8 5.4-2 1-2.8-5.4-3.5 3.5z"
              fill={themeColors.fill}
            />
            {/* Refined Emerald `+` Badge */}
            <g transform="translate(16, 15)">
              <circle cx="8" cy="8" r="8" fill={themeColors.plusBg} stroke="#ffffff" strokeWidth="1.8" />
              <path
                d="M8 4.5V11.5M4.5 8H11.5"
                stroke="#ffffff"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </g>
          </svg>
        )}

        {/* 4. DROP: Magnetized Drop Reticle */}
        {cursorState === 'drop' && (
          <div data-testid="cursor-drop-target" className="relative -left-4 -top-4">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              {/* Outer Magnetized Pulsing Circle */}
              <circle
                cx="20"
                cy="20"
                r="16"
                stroke={themeColors.dropBg}
                strokeWidth="2.2"
                strokeDasharray="4 3"
                className="animate-spin"
                style={{ animationDuration: '6s', transformOrigin: 'center' }}
              />
              {/* Target Brackets */}
              <path
                d="M12 8H8V12M28 8H32V12M12 32H8V28M28 32H32V28"
                stroke={themeColors.dropBg}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Downward Drop Insertion Arrow */}
              <path
                d="M20 12V26M15 21L20 27L25 21"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="20" cy="20" r="3" fill={themeColors.dropBg} />
            </svg>
          </div>
        )}

        {/* 5. NO-DROP / FORBIDDEN: Arrow + Red Circle-Slash */}
        {cursorState === 'no-drop' && (
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" data-testid="cursor-no-drop">
            <path
              d="m2 2 13 13h-7.5l2.8 5.4-2 1-2.8-5.4-3.5 3.5z"
              fill={themeColors.stroke}
              stroke={themeColors.stroke}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path
              d="m2 2 13 13h-7.5l2.8 5.4-2 1-2.8-5.4-3.5 3.5z"
              fill={themeColors.fill}
            />
            {/* Red Circle Slash Badge */}
            <g transform="translate(16, 15)">
              <circle cx="8" cy="8" r="8" fill={themeColors.noDropBg} stroke="#ffffff" strokeWidth="1.8" />
              <line x1="4" y1="4" x2="12" y2="12" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
            </g>
          </svg>
        )}

        {/* 6. HELP: Authentic Apple Arrow + Amber `?` Badge */}
        {cursorState === 'help' && (
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" data-testid="cursor-help-question">
            <path
              d="m2 2 13 13h-7.5l2.8 5.4-2 1-2.8-5.4-3.5 3.5z"
              fill={themeColors.stroke}
              stroke={themeColors.stroke}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path
              d="m2 2 13 13h-7.5l2.8 5.4-2 1-2.8-5.4-3.5 3.5z"
              fill={themeColors.fill}
            />
            {/* Amber `?` Badge */}
            <g transform="translate(16, 15)">
              <circle cx="8" cy="8" r="8" fill={themeColors.helpBg} stroke="#ffffff" strokeWidth="1.8" />
              <text
                x="8"
                y="11.8"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="11"
                fontWeight="900"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                ?
              </text>
            </g>
          </svg>
        )}

        {/* 7. OPEN HAND (Grab) */}
        {cursorState === 'grab' && (
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path
              d="M10 4C9 4 8 5 8 6.5V14H6.5C5 14 4 15 4 16.5C4 17.5 4.5 18.5 5.5 19.5L10 24C11 25 12.5 26 14.5 26H19C21 26 22.5 24.5 22.5 22.5V15C22.5 13.5 21.5 12.5 20 12.5C19.5 12.5 19 12.7 18.5 13V11C18.5 9.5 17.5 8.5 16 8.5C15.5 8.5 15 8.7 14.5 9V7C14.5 5.5 13.5 4.5 12 4.5C11.5 4.5 11 4.7 10.5 5V6.5C10.5 5 9.5 4 9 4Z"
              fill={themeColors.fill}
              stroke={themeColors.stroke}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        )}

        {/* 8. CLENCHED FIST (Grabbing) */}
        {cursorState === 'grabbing' && (
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
            <path
              d="M8 12C7 12 6 13 6 14.5V18C6 22 9 25 13 25H18C21 25 23 23 23 20V15C23 13.5 22 12.5 20.5 12.5C20 12.5 19.5 12.7 19 13V12C19 10.5 18 9.5 16.5 9.5C16 9.5 15.5 9.7 15 10V9C15 7.5 14 6.5 12.5 6.5C11 6.5 10 7.5 10 9V12H8Z"
              fill={themeColors.fill}
              stroke={themeColors.stroke}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <circle cx="14" cy="14" r="1.5" fill={themeColors.accent} />
          </svg>
        )}

        {/* 9. BLADE TOOL: Razor Scalpel */}
        {cursorState === 'blade' && (
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
            <path
              d="M4 26L18 12L24 6L22 4L16 10L2 24L4 26Z"
              fill={themeColors.fill}
              stroke={themeColors.stroke}
              strokeWidth="2"
            />
            <line x1="2" y1="24" x2="28" y2="24" stroke="#ef4444" strokeWidth="1.6" strokeDasharray="3 2" />
          </svg>
        )}

        {/* 10. CROSSHAIR */}
        {cursorState === 'crosshair' && (
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <circle cx="15" cy="15" r="9" stroke={themeColors.stroke} strokeWidth="1.8" />
            <circle cx="15" cy="15" r="2" fill={themeColors.accent} />
            <line x1="15" y1="2" x2="15" y2="10" stroke={themeColors.stroke} strokeWidth="1.8" />
            <line x1="15" y1="20" x2="15" y2="28" stroke={themeColors.stroke} strokeWidth="1.8" />
            <line x1="2" y1="15" x2="10" y2="15" stroke={themeColors.stroke} strokeWidth="1.8" />
            <line x1="20" y1="15" x2="28" y2="15" stroke={themeColors.stroke} strokeWidth="1.8" />
          </svg>
        )}

        {/* 11. TEXT I-BEAM */}
        {cursorState === 'text' && (
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <path
              d="M9 4H17M13 4V22M9 22H17"
              stroke={themeColors.stroke}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M9 4H17M13 4V22M9 22H17"
              stroke={themeColors.fill}
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* 12. HORIZONTAL RESIZE */}
        {cursorState === 'resize-ew' && (
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <path
              d="M6 15L11 10V13H19V10L24 15L19 20V17H11V20L6 15Z"
              fill={themeColors.fill}
              stroke={themeColors.stroke}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        )}

        {/* 13. VERTICAL RESIZE */}
        {cursorState === 'resize-ns' && (
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <path
              d="M15 6L20 11H17V19H20L15 24L10 19H13V11H10L15 6Z"
              fill={themeColors.fill}
              stroke={themeColors.stroke}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        )}

        {/* 14. 3D ROTATION / ORBIT */}
        {cursorState === 'rotate' && (
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="10" stroke={themeColors.stroke} strokeWidth="2" strokeDasharray="14 4" />
            <path d="M22 6L26 8L22 12" fill={themeColors.accent} stroke={themeColors.stroke} strokeWidth="1.2" />
            <path d="M10 26L6 24L10 20" fill={themeColors.accent} stroke={themeColors.stroke} strokeWidth="1.2" />
            <circle cx="16" cy="16" r="3" fill={themeColors.fill} stroke={themeColors.stroke} strokeWidth="1.5" />
          </svg>
        )}

        {/* 15. BEACHBALL: Authentic Spinning macOS Pinwheel */}
        {cursorState === 'beachball' && (
          <div className="animate-spin" style={{ animationDuration: '1.2s' }}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="14" fill="#000000" stroke="#ffffff" strokeWidth="2" />
              <path d="M16 16L16 2A14 14 0 0 1 28 9Z" fill="#ff4332" />
              <path d="M16 16L28 9A14 14 0 0 1 28 23Z" fill="#ffd305" />
              <path d="M16 16L28 23A14 14 0 0 1 16 30Z" fill="#3bbd1c" />
              <path d="M16 16L16 30A14 14 0 0 1 4 23Z" fill="#14adf6" />
              <path d="M16 16L4 23A14 14 0 0 1 4 9Z" fill="#ca70e1" />
              <path d="M16 16L4 9A14 14 0 0 1 16 2Z" fill="#fbb114" />
            </svg>
          </div>
        )}
      </div>

      {/* Gamified Attached Drag Ghost Pill */}
      {cursorConfig.showDragPill && (cursorState === 'drag' || cursorState === 'drop') && (
        <div
          data-testid="cursor-drag-pill"
          title={cursorState === 'drop' ? 'Release to Drop at Playhead' : dragItem?.label || 'Dragging Media Asset'}
          className="absolute left-6 top-5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink-900/95 border border-emerald-500/80 shadow-2xl backdrop-blur-md text-[11px] font-medium text-emerald-200 max-w-[240px] sm:max-w-[320px] animate-in fade-in zoom-in-95 duration-150"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="truncate">
            {cursorState === 'drop' ? 'Release to Drop at Playhead' : dragItem?.label || 'Dragging Media Asset'}
          </span>
          <span className="px-1 py-0.2 rounded bg-emerald-950/80 border border-emerald-500/50 text-[9px] text-emerald-300 font-mono shrink-0">
            {cursorState === 'drop' ? 'LOCKED' : '+COPY'}
          </span>
        </div>
      )}

      {/* Gamified Attached Help Info Pill */}
      {cursorState === 'help' && helpText && (
        <div
          data-testid="cursor-help-pill"
          title={helpText}
          className="absolute left-6 top-5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink-900/95 border border-amber-500/80 shadow-2xl backdrop-blur-md text-[11px] font-medium text-amber-200 max-w-[240px] sm:max-w-[320px] animate-in fade-in zoom-in-95 duration-150"
        >
          <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
          <span className="truncate">{helpText}</span>
          <span className="px-1 py-0.2 rounded bg-amber-950/80 border border-amber-500/50 text-[9px] text-amber-300 font-mono shrink-0">
            ? INFO
          </span>
        </div>
      )}
    </div>
  )
}
