import { useEffect, useRef } from 'react'
import { useEditor } from '../store'
import { uid } from '../lib/time'
import { renderStroke, renderAllPaintLayers, floodFillRegion } from '../lib/drawingEngine'
import type { StrokePoint, DrawingStroke } from '../types'

interface DrawingCanvasOverlayProps {
  width: number
  height: number
}

export function DrawingCanvasOverlay({ width, height }: DrawingCanvasOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const currentPointsRef = useRef<StrokePoint[]>([])
  const strokeStartTimeRef = useRef(0)

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
  const addDrawingStroke = useEditor((s) => s.addDrawingStroke)
  const playhead = useEditor((s) => s.playhead)
  const projectFps = useEditor((s) => s.projectFps)

  // Redraw existing strokes and layers whenever strokes, layers, or playhead changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)
    renderAllPaintLayers(ctx, width, height, drawingStrokes, paintLayers, playhead, projectFps)
  }, [drawingStrokes, paintLayers, playhead, projectFps, width, height])

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
    currentPointsRef.current.push(pt)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear and redraw all strokes plus active live stroke
    ctx.clearRect(0, 0, width, height)
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
      className="absolute inset-0 z-20 cursor-crosshair touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  )
}
