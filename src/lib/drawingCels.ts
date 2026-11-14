import type { DrawingStroke } from '../types'

/** Replace an exposure without altering neighboring cels or other layers. */
export function replaceCelExposure(strokes: DrawingStroke[], layerId: string, frame: number, hold: number, replacement: DrawingStroke[], id: () => string): DrawingStroke[] {
  const start = Math.max(0, Math.floor(frame)), end = start + Math.max(1, Math.floor(hold))
  const result: DrawingStroke[] = []
  for (const stroke of strokes) {
    const scope = stroke.temporalScope
    if (stroke.layerId !== layerId || scope.type !== 'frame') { result.push(stroke); continue }
    const a = scope.frame ?? 0, b = a + Math.max(1, scope.holdFrames ?? 1)
    if (b <= start || a >= end) { result.push(stroke); continue }
    if (a < start) result.push({ ...stroke, temporalScope: { ...scope, holdFrames: start - a } })
    if (b > end) result.push({ ...stroke, id: a < start ? id() : stroke.id, temporalScope: { ...scope, frame: end, holdFrames: b - end } })
  }
  return [...result, ...replacement.map(stroke => ({ ...structuredClone(stroke), id: id(), temporalScope: { type: 'frame' as const, frame: start, holdFrames: end - start } }))]
}
