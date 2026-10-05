import { useEffect, useRef } from 'react'
import { useEditor } from '../store'
import type { DrawingToolType } from '../types'
import { uid } from '../lib/time'
import {
  renderStroke,
  renderAllPaintLayers,
  renderOnionSkin,
  floodFillRegion,
  renderSelectionMarchingAnts,
} from '../lib/drawingEngine'
import type { StrokePoint, DrawingStroke, ActiveSelection } from '../types'

interface DrawingCanvasOverlayProps {
  width: number
  height: number
}

export function DrawingCanvasOverlay({ width, height }: DrawingCanvasOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  /** Tool to return to after the eyedropper samples a colour (Krita behaviour). */
  const previousToolBeforeEyedropperRef = useRef<DrawingToolType | null>(null)
  /** Last non-utility paint tool, so the eyedropper can restore it. */
  const lastPaintToolRef = useRef<DrawingToolType | null>(null)
  const isDrawingRef = useRef(false)
  const currentPointsRef = useRef<StrokePoint[]>([])
  const strokeStartTimeRef = useRef(0)
  const selectionStartPtRef = useRef<StrokePoint | null>(null)

  const drawingEnabled = useEditor((s) => s.drawingEnabled)
  const drawingTool = useEditor((s) => s.drawingTool)
  useEffect(() => {
    if (drawingTool !== 'eyedropper') lastPaintToolRef.current = drawingTool
  }, [drawingTool])

  const drawingColor = useEditor((s) => s.drawingColor)
  const drawingSize = useEditor((s) => s.drawingSize)
  const drawingOpacity = useEditor((s) => s.drawingOpacity)
  const drawingScope = useEditor((s) => s.drawingScope)
  const drawingFillTolerance = useEditor((s) => s.drawingFillTolerance)
  const drawingPreserveLuminance = useEditor((s) => s.drawingPreserveLuminance)
  const activePaintLayerId = useEditor((s) => s.activePaintLayerId)
  const paintLayers = useEditor((s) => s.paintLayers)
  const drawingStrokes = useEditor((s) => s.drawingStrokes)
  const onionSkin = useEditor((s) => s.onionSkin)
  const addDrawingStroke = useEditor((s) => s.addDrawingStroke)
  const activeSelection = useEditor((s) => s.activeSelection)
  const setActiveSelection = useEditor((s) => s.setActiveSelection)
  const activeMaskId = useEditor((s) => s.activeMaskId)
  /**
   * A stroke may only be attached to a transparency mask when that mask is
   * genuinely mounted on the active paint layer. `activeMaskId` can point at a
   * clip mask (or at a placeholder mask) that the paint layer knows nothing
   * about; tagging a stroke with such an id makes it invisible, because
   * renderAllPaintLayers then excludes it from both the base and mask passes.
   */
  const activeLayer = paintLayers.find((l) => l.id === (activePaintLayerId || 'default-paint-layer'))
  const strokeMaskId =
    activeMaskId && activeLayer?.transparencyMask?.id === activeMaskId ? activeMaskId : undefined

  const brushDynamics = useEditor((s) => s.brushDynamics)
  const playhead = useEditor((s) => s.playhead)
  const projectFps = useEditor((s) => s.projectFps)
  const rotoTool = useEditor((s) => s.rotoTool)
  const rotoClicks = useEditor((s) => s.rotoClicks)
  const rotoResult = useEditor((s) => s.rotoResult)
  const rotoBusy = useEditor((s) => s.rotoBusy)
  const rotoMaskImgRef = useRef<HTMLImageElement | null>(null)
  const rotoMaskUrlRef = useRef<string>('')
  /** Active RotoMask brush stroke (working in normalised coords). */
  const rotoStrokeRef = useRef<StrokePoint[] | null>(null)

  const currentFrame = Math.round(playhead * projectFps)
  const isSelectionTool =
    drawingTool === 'select-rect' ||
    drawingTool === 'select-ellipse' ||
    drawingTool === 'select-lasso' ||
    drawingTool === 'select-polygon' ||
    drawingTool === 'select-brush' ||
    drawingTool === 'select-magic-wand' ||
    drawingTool === 'select-character'

  // Global Escape key to clear active selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && useEditor.getState().activeSelection) {
        useEditor.getState().clearSelection()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  /**
   * RotoMask overlay: tint the live roto matte and draw the +/- click
   * markers, exactly like the reference tool's dots on the preview.
   */
  const renderRotoOverlay = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (!rotoResult && rotoClicks.length === 0) return
    if (rotoResult?.maskDataUrl) {
      if (rotoMaskUrlRef.current !== rotoResult.maskDataUrl || !rotoMaskImgRef.current) {
        const img = new Image()
        img.src = rotoResult.maskDataUrl
        rotoMaskImgRef.current = img
        rotoMaskUrlRef.current = rotoResult.maskDataUrl
      }
      const img = rotoMaskImgRef.current
      if (img.complete && img.naturalWidth > 0) {
        ctx.save()
        ctx.globalAlpha = 0.32
        ctx.globalCompositeOperation = 'source-over'
        ctx.drawImage(img, 0, 0, w, h)
        ctx.restore()
      }
    }
    for (const c of rotoClicks) {
      const cx = c.x * w
      const cy = c.y * h
      const r = 7
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = c.positive ? 'rgba(16,185,129,0.85)' : 'rgba(239,68,68,0.85)'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()
      // + or - glyph
      ctx.beginPath()
      ctx.moveTo(cx - 3.5, cy)
      ctx.lineTo(cx + 3.5, cy)
      if (c.positive) {
        ctx.moveTo(cx, cy - 3.5)
        ctx.lineTo(cx, cy + 3.5)
      }
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.6
      ctx.stroke()
      ctx.restore()
    }
    if (rotoBusy) {
      ctx.save()
      ctx.font = '11px ui-monospace, monospace'
      ctx.fillStyle = 'rgba(232,121,249,0.95)'
      ctx.fillText('roto\u2026', 8, h - 8)
      ctx.restore()
    }
  }

  // Static re-render whenever state changes (when no marching ants anim loop is active)
  useEffect(() => {
    if (activeSelection) return // Handled by continuous animation loop below
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)

    // Render Onion Skinning ghost cels underneath active frame
    if (onionSkin.enabled && drawingScope.type === 'frame') {
      renderOnionSkin(ctx, width, height, drawingStrokes, currentFrame, projectFps, onionSkin)
    }

    renderAllPaintLayers(ctx, width, height, drawingStrokes, paintLayers, playhead, projectFps)
    renderRotoOverlay(ctx, width, height)
  }, [activeSelection, drawingStrokes, paintLayers, playhead, projectFps, onionSkin, drawingScope, currentFrame, width, height, rotoClicks, rotoResult, rotoBusy])

  // Continuous animation loop for active selection marching ants
  useEffect(() => {
    if (!activeSelection) return
    let animId: number
    const renderLoop = (timeMs: number) => {
      const canvas = canvasRef.current
      if (canvas && !isDrawingRef.current) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, width, height)
          if (onionSkin.enabled && drawingScope.type === 'frame') {
            renderOnionSkin(ctx, width, height, drawingStrokes, currentFrame, projectFps, onionSkin)
          }
          renderAllPaintLayers(ctx, width, height, drawingStrokes, paintLayers, playhead, projectFps)
          renderSelectionMarchingAnts(ctx, activeSelection, width, height, timeMs)
          renderRotoOverlay(ctx, width, height)
        }
      }
      animId = requestAnimationFrame(renderLoop)
    }
    animId = requestAnimationFrame(renderLoop)
    return () => cancelAnimationFrame(animId)
  }, [activeSelection, drawingStrokes, paintLayers, playhead, projectFps, onionSkin, drawingScope, currentFrame, width, height, rotoClicks, rotoResult, rotoBusy])

  // The overlay also mounts for RotoMask work (clicks / brush refine) even
  // when Drawing mode itself is off — the roto tools own the preview then.
  if (!drawingEnabled && !rotoTool) return null

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0, timestamp: 0 }
    const rect = canvas.getBoundingClientRect()
    const rawX = (e.clientX - rect.left) / rect.width
    const rawY = (e.clientY - rect.top) / rect.height
    const x = Math.max(0, Math.min(1, rawX))
    const y = Math.max(0, Math.min(1, rawY))
    const rawPressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5
    const pressure = brushDynamics?.pressureSize ? rawPressure : 0.5
    const timestamp = Date.now() - strokeStartTimeRef.current
    return { x, y, pressure, timestamp }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    // ---- RotoMask interception ----
    // Click mode: left-click adds subject, right-click / Alt-click removes
    // background (Sammie-Roto 2 semantics). Brush modes refine the live mask.
    if (rotoTool === 'click') {
      const pt = getCanvasCoords(e)
      const positive = e.button !== 2 && !e.altKey
      void useEditor.getState().addRotoClick(pt.x, pt.y, positive)
      return
    }
    if (rotoTool === 'brush-add' || rotoTool === 'brush-remove') {
      if (e.button !== 0) return
      const pt = getCanvasCoords(e)
      canvas.setPointerCapture(e.pointerId)
      isDrawingRef.current = true
      rotoStrokeRef.current = [pt]
      currentPointsRef.current = [pt]
      return
    }

    if (e.button !== 0) return

    const pt = getCanvasCoords(e)

    if (isSelectionTool) {
      canvas.setPointerCapture(e.pointerId)
      isDrawingRef.current = true
      selectionStartPtRef.current = pt
      currentPointsRef.current = [pt]
      return
    }

    if (drawingTool === 'eyedropper') {
      if (!previousToolBeforeEyedropperRef.current) {
        previousToolBeforeEyedropperRef.current = lastPaintToolRef.current || 'brush'
      }
      const previewCanvas = document.getElementById('of-canvas') as HTMLCanvasElement | null
      if (previewCanvas) {
        const pCtx = previewCanvas.getContext('2d', { willReadFrequently: true })
        if (pCtx) {
          const pxX = Math.max(0, Math.min(previewCanvas.width - 1, Math.round(pt.x * previewCanvas.width)))
          const pxY = Math.max(0, Math.min(previewCanvas.height - 1, Math.round(pt.y * previewCanvas.height)))
          const pixel = pCtx.getImageData(pxX, pxY, 1, 1).data
          const hex = '#' + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)
          useEditor.getState().setDrawingColor(hex)
        }
      }
      // Krita's Color Sampler Tool: after sampling, return to the tool that was
      // active before the pick so the artist can carry on working.
      const prev = previousToolBeforeEyedropperRef.current
      if (prev) {
        previousToolBeforeEyedropperRef.current = null
        useEditor.getState().setDrawingTool(prev)
      }
      return
    }

    if (drawingTool === 'clone') {
      if (e.altKey || !useEditor.getState().cloneSourcePoint) {
        const previewCanvas = document.getElementById('of-canvas') as HTMLCanvasElement | null
        const sampleUrl = previewCanvas ? previewCanvas.toDataURL() : undefined
        useEditor.getState().setCloneSourcePoint({ ...pt, sampleDataUrl: sampleUrl })
        return
      }
    }

    if (drawingTool === 'fill') {
      const previewCanvas = document.getElementById('of-canvas') as HTMLCanvasElement | null
      if (!previewCanvas) return

      const maskDataUrl = floodFillRegion(previewCanvas, pt.x, pt.y, {
        threshold: drawingFillTolerance,
        fillColor: drawingColor,
        preserveLuminance: drawingPreserveLuminance,
        grow: 1,
      })

      if (maskDataUrl) {
        const fillStroke: DrawingStroke = {
          id: uid('fill'),
          layerId: activePaintLayerId,
          tool: 'fill',
          color: drawingColor,
          size: drawingSize,
          opacity: drawingOpacity,
          points: [pt],
          temporalScope: { ...drawingScope },
          fillTolerance: drawingFillTolerance,
          preserveLuminance: drawingPreserveLuminance,
          maskDataUrl,
        }
        addDrawingStroke(fillStroke)
      }
      return
    }

    canvas.setPointerCapture(e.pointerId)
    isDrawingRef.current = true
    strokeStartTimeRef.current = Date.now()
    currentPointsRef.current = [pt]

    const ctx = canvas.getContext('2d')
    if (ctx) {
      const liveStroke: DrawingStroke = {
        id: 'preview',
        layerId: activePaintLayerId,
        maskId: strokeMaskId,
        tool: drawingTool,
        color: drawingColor,
        size: drawingSize,
        opacity: drawingOpacity,
        points: currentPointsRef.current,
        temporalScope: drawingScope,
        cloneSource: useEditor.getState().cloneSourcePoint || undefined,
        ...(drawingTool === 'polygon'
          ? {
              polygonSides: useEditor.getState().drawingPolygonSides,
              filled: useEditor.getState().drawingShapeFilled,
            }
          : {}),
        ...(drawingTool === 'gradient'
          ? { gradientColor: useEditor.getState().drawingGradientColor }
          : {}),
      }
      renderStroke(ctx, liveStroke, width, height)
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return

    const rawPt = getCanvasCoords(e)
    let pt = rawPt
    if (brushDynamics?.smoothingMode === 'stabilizer' && currentPointsRef.current.length > 0) {
      const lastPt = currentPointsRef.current[currentPointsRef.current.length - 1]
      const weight = 0.6
      pt = {
        ...rawPt,
        x: lastPt.x * (1 - weight) + rawPt.x * weight,
        y: lastPt.y * (1 - weight) + rawPt.y * weight,
      }
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Live RotoMask brush stroke: accumulate and draw the stroke band.
    if (rotoStrokeRef.current) {
      rotoStrokeRef.current.push(pt)
      currentPointsRef.current.push(pt)
      ctx.clearRect(0, 0, width, height)
      renderAllPaintLayers(ctx, width, height, drawingStrokes, paintLayers, playhead, projectFps)
      const st = useEditor.getState()
      ctx.save()
      ctx.strokeStyle = st.rotoTool === 'brush-remove' ? 'rgba(239,68,68,0.8)' : 'rgba(16,185,129,0.8)'
      ctx.lineWidth = Math.max(3, st.rotoBrushRadius * (width / Math.max(1, canvas.clientWidth || width)))
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      const pts = rotoStrokeRef.current
      if (pts.length === 1) {
        ctx.arc(pts[0].x * width, pts[0].y * height, ctx.lineWidth / 2, 0, Math.PI * 2)
        ctx.fillStyle = ctx.strokeStyle
        ctx.fill()
      } else {
        ctx.moveTo(pts[0].x * width, pts[0].y * height)
        for (const p of pts.slice(1)) ctx.lineTo(p.x * width, p.y * height)
        ctx.stroke()
      }
      ctx.restore()
      renderRotoOverlay(ctx, width, height)
      return
    }

    if (isSelectionTool && selectionStartPtRef.current) {
      const startPt = selectionStartPtRef.current
      currentPointsRef.current.push(pt)

      ctx.clearRect(0, 0, width, height)
      if (onionSkin.enabled && drawingScope.type === 'frame') {
        renderOnionSkin(ctx, width, height, drawingStrokes, currentFrame, projectFps, onionSkin)
      }
      renderAllPaintLayers(ctx, width, height, drawingStrokes, paintLayers, playhead, projectFps)

      const minX = Math.min(startPt.x, pt.x)
      const minY = Math.min(startPt.y, pt.y)
      const maxX = Math.max(startPt.x, pt.x)
      const maxY = Math.max(startPt.y, pt.y)
      const tempSelection: ActiveSelection = {
        type: drawingTool === 'select-ellipse' ? 'ellipse' : drawingTool === 'select-lasso' ? 'lasso' : 'rectangle',
        bounds: { x: minX, y: minY, width: Math.max(0.001, maxX - minX), height: Math.max(0.001, maxY - minY) },
        points: drawingTool === 'select-lasso' ? currentPointsRef.current : undefined,
      }
      renderSelectionMarchingAnts(ctx, tempSelection, width, height, performance.now())
      return
    }

    currentPointsRef.current.push(pt)

    // Clear and redraw all strokes plus active live stroke
    ctx.clearRect(0, 0, width, height)

    if (onionSkin.enabled && drawingScope.type === 'frame') {
      renderOnionSkin(ctx, width, height, drawingStrokes, currentFrame, projectFps, onionSkin)
    }

    renderAllPaintLayers(ctx, width, height, drawingStrokes, paintLayers, playhead, projectFps)

    const liveStroke: DrawingStroke = {
      id: 'preview',
      layerId: activePaintLayerId,
      maskId: strokeMaskId,
      tool: drawingTool,
      color: drawingColor,
      size: drawingSize,
      opacity: drawingOpacity,
      points: currentPointsRef.current,
      temporalScope: drawingScope,
      cloneSource: useEditor.getState().cloneSourcePoint || undefined,
    }
    renderStroke(ctx, liveStroke, width, height)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    const canvas = canvasRef.current
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    }

    // RotoMask brush stroke finished — apply add/remove refine.
    if (rotoStrokeRef.current) {
      const pts = rotoStrokeRef.current
      rotoStrokeRef.current = null
      const mode = useEditor.getState().rotoTool
      currentPointsRef.current = []
      if (pts.length > 0 && (mode === 'brush-add' || mode === 'brush-remove')) {
        void useEditor.getState().rotoBrushApply(pts, mode === 'brush-add' ? 'add' : 'subtract')
      }
      return
    }

    if (isSelectionTool && selectionStartPtRef.current) {
      const startPt = selectionStartPtRef.current
      const endPt = currentPointsRef.current[currentPointsRef.current.length - 1] || startPt
      selectionStartPtRef.current = null

      if (drawingTool === 'select-lasso' || drawingTool === 'select-polygon' || drawingTool === 'select-brush') {
        const pts = currentPointsRef.current
        if (pts.length > 2) {
          let minX = 1, minY = 1, maxX = 0, maxY = 0
          for (const p of pts) {
            if (p.x < minX) minX = p.x
            if (p.y < minY) minY = p.y
            if (p.x > maxX) maxX = p.x
            if (p.y > maxY) maxY = p.y
          }
          setActiveSelection({
            type: drawingTool === 'select-polygon' ? 'polygon' : drawingTool === 'select-brush' ? 'brush' : 'lasso',
            bounds: { x: minX, y: minY, width: Math.max(0.01, maxX - minX), height: Math.max(0.01, maxY - minY) },
            points: pts,
          })
          // Auto Brush: grow the painted band to the subject's real edges.
          if (drawingTool === 'select-brush' && useEditor.getState().selectionBrushAuto) {
            void useEditor.getState().refineBrushSelectionMask(pts)
          }
        }
      } else if (drawingTool === 'select-magic-wand') {
        // Real wand: colour-region flood from the clicked pixel (was a fake
        // fixed 0.2x0.2 rectangle before the auto-brush upgrade).
        void useEditor.getState().setWandSelectionAt(startPt)
      } else {
        const minX = Math.min(startPt.x, endPt.x)
        const minY = Math.min(startPt.y, endPt.y)
        const maxX = Math.max(startPt.x, endPt.x)
        const maxY = Math.max(startPt.y, endPt.y)
        const w = maxX - minX
        const h = maxY - minY
        if (w > 0.005 || h > 0.005) {
          setActiveSelection({
            type: drawingTool === 'select-ellipse' ? 'ellipse' : 'rectangle',
            bounds: { x: minX, y: minY, width: w, height: h },
          })
        }
      }
      currentPointsRef.current = []
      return
    }

    if (currentPointsRef.current.length > 0) {
      const finalStroke: DrawingStroke = {
        id: uid('strk'),
        layerId: activePaintLayerId,
        maskId: strokeMaskId,
        tool: drawingTool,
        color: drawingColor,
        size: drawingSize,
        opacity: drawingOpacity,
        points: [...currentPointsRef.current],
        temporalScope: { ...drawingScope },
        cloneSource: useEditor.getState().cloneSourcePoint || undefined,
        ...(drawingTool === 'polygon'
          ? {
              polygonSides: useEditor.getState().drawingPolygonSides,
              filled: useEditor.getState().drawingShapeFilled,
            }
          : {}),
        ...(drawingTool === 'gradient'
          ? { gradientColor: useEditor.getState().drawingGradientColor }
          : {}),
      }
      addDrawingStroke(finalStroke)
    }
    currentPointsRef.current = []
  }

  return (
    <canvas
      ref={canvasRef}
      id="of-drawing-canvas"
      data-testid="drawing-canvas"
      width={width}
      height={height}
      className={`absolute inset-0 z-20 touch-none ${
        isSelectionTool ? 'cursor-crosshair' : 'cursor-crosshair'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e) => {
        // Right-click is a Remove click while the RotoMask click tool is armed.
        if (useEditor.getState().rotoTool === 'click') e.preventDefault()
      }}
    />
  )
}
