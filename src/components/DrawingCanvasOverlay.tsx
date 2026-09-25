import { useEffect, useRef } from 'react'
import { useEditor } from '../store'
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
  const isDrawingRef = useRef(false)
  const currentPointsRef = useRef<StrokePoint[]>([])
  const strokeStartTimeRef = useRef(0)
  const selectionStartPtRef = useRef<StrokePoint | null>(null)

  const drawingEnabled = useEditor((s) => s.drawingEnabled)
  const drawingTool = useEditor((s) => s.drawingTool)
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
  const playhead = useEditor((s) => s.playhead)
  const projectFps = useEditor((s) => s.projectFps)

  const currentFrame = Math.round(playhead * projectFps)
  const isSelectionTool =
    drawingTool === 'select-rect' || drawingTool === 'select-ellipse' || drawingTool === 'select-lasso'

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
  }, [activeSelection, drawingStrokes, paintLayers, playhead, projectFps, onionSkin, drawingScope, currentFrame, width, height])

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
        }
      }
      animId = requestAnimationFrame(renderLoop)
    }
    animId = requestAnimationFrame(renderLoop)
    return () => cancelAnimationFrame(animId)
  }, [activeSelection, drawingStrokes, paintLayers, playhead, projectFps, onionSkin, drawingScope, currentFrame, width, height])

  if (!drawingEnabled) return null

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0, timestamp: 0 }
    const rect = canvas.getBoundingClientRect()
    const rawX = (e.clientX - rect.left) / rect.width
    const rawY = (e.clientY - rect.top) / rect.height
    const x = Math.max(0, Math.min(1, rawX))
    const y = Math.max(0, Math.min(1, rawY))
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5
    const timestamp = Date.now() - strokeStartTimeRef.current
    return { x, y, pressure, timestamp }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    const canvas = canvasRef.current
    if (!canvas) return

    const pt = getCanvasCoords(e)

    if (isSelectionTool) {
      canvas.setPointerCapture(e.pointerId)
      isDrawingRef.current = true
      selectionStartPtRef.current = pt
      currentPointsRef.current = [pt]
      return
    }

    if (drawingTool === 'eyedropper') {
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
      return
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
        tool: drawingTool,
        color: drawingColor,
        size: drawingSize,
        opacity: drawingOpacity,
        points: currentPointsRef.current,
        temporalScope: drawingScope,
      }
      renderStroke(ctx, liveStroke, width, height)
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return

    const pt = getCanvasCoords(e)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

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
      tool: drawingTool,
      color: drawingColor,
      size: drawingSize,
      opacity: drawingOpacity,
      points: currentPointsRef.current,
      temporalScope: drawingScope,
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

    if (isSelectionTool && selectionStartPtRef.current) {
      const startPt = selectionStartPtRef.current
      const endPt = currentPointsRef.current[currentPointsRef.current.length - 1] || startPt
      selectionStartPtRef.current = null

      if (drawingTool === 'select-lasso') {
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
            type: 'lasso',
            bounds: { x: minX, y: minY, width: Math.max(0.01, maxX - minX), height: Math.max(0.01, maxY - minY) },
            points: pts,
          })
        }
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
        tool: drawingTool,
        color: drawingColor,
        size: drawingSize,
        opacity: drawingOpacity,
        points: [...currentPointsRef.current],
        temporalScope: { ...drawingScope },
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
    />
  )
}
