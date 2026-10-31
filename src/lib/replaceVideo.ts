/**
 * Replace-Video-With-Video + TEMPLATE MODE — shared pure engine.
 *
 * Replace flow (CapCut parity, see new_doc_toll_research/imgs/capcut-replace/):
 * dropping a video asset ONTO an existing video clip opens a trim popup whose
 * view-window segment is exactly the target clip's duration; dragging the
 * segment slides the source in-point (a 5 s window over an 8 s source can sit
 * at 0-5, 3-8, …). The "use the original video effect" checkbox carries the
 * target clip's effects/fx/LUT grade onto the new footage.
 *
 * Template mode goes further: captureClipTemplate() snapshots EVERY processing
 * stage the original clip passed through (transform + keyframed animation,
 * effect instances + their keys, LUT/adjustment grade, masks, blend, opacity,
 * speed curve, text style, in-point ratio) into a JSON data-dump; applying it
 * to a brand-new clip (usually a freshly imported replacement video) replays
 * the whole edit chain on the new theme. Headless MCP tools and the browser
 * store both consume these pure functions so preview/export stay identical.
 */
import type { Clip } from '../types'

export interface ReplaceWindow {
  sourceDuration: number
  clipDuration: number
  start: number
  end: number
}

/** Clamp a requested in-point so the view window always fits the source. */
export function clampReplaceWindow(sourceDuration: number, clipDuration: number, requestedStart = 0): ReplaceWindow {
  const win = Math.min(clipDuration, Math.max(0.01, sourceDuration))
  const max = Math.max(0, sourceDuration - win)
  const start = Math.min(max, Math.max(0, requestedStart))
  return { sourceDuration, clipDuration: win, start, end: start + win }
}

export interface ReplacePatch {
  assetId: string
  inPoint: number
  duration: number
  /** fields cleared when carryEffects is false (CapCut checkbox unticked) */
  cleared: Array<'effects' | 'fxInstances' | 'adjustment'>
}

export function replaceVideoPatch(clip: Pick<Clip, 'duration'>, assetId: string, sourceDuration: number, windowStart: number, carryEffects: boolean): ReplacePatch {
  const w = clampReplaceWindow(sourceDuration, clip.duration, windowStart)
  return {
    assetId,
    inPoint: w.start,
    duration: w.clipDuration,
    cleared: carryEffects ? [] : ['effects', 'fxInstances', 'adjustment'],
  }
}

/** Every processing stage we remember, in pipeline order. */
export const TEMPLATE_FIELDS = [
  'transform', 'animation', 'effects', 'fxInstances', 'adjustment', 'adjustmentMask',
  'mask', 'blendMode', 'speedCurve', 'textStyle', 'volume', 'hidden',
] as const

export interface ClipTemplate {
  id: string
  name: string
  capturedAt: string
  sourceClipId: string
  sourceName: string
  sourceKind: string
  /** in-point as a RATIO of the source duration so templates re-time onto
   *  replacements of different length */
  inPointRatio: number
  duration: number
  fields: Record<string, unknown>
  fieldCount: number
}

export function captureClipTemplate(clip: Clip, name: string, id?: string): ClipTemplate {
  const fields: Record<string, unknown> = {}
  for (const f of TEMPLATE_FIELDS) {
    const v = (clip as unknown as Record<string, unknown>)[f]
    if (v !== undefined) fields[f] = JSON.parse(JSON.stringify(v))
  }
  return {
    id: id || `tmpl-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`,
    name: name || `Template ${clip.name}`,
    capturedAt: new Date().toISOString(),
    sourceClipId: clip.id,
    sourceName: clip.name,
    sourceKind: clip.kind,
    inPointRatio: clip.duration > 0 ? clip.inPoint / clip.duration : 0,
    duration: clip.duration,
    fields,
    fieldCount: Object.keys(fields).length,
  }
}

/** The patch a template applies onto a target clip (deep-copied, re-timed). */
export function templatePatch(template: ClipTemplate, targetDuration?: number): Record<string, unknown> {
  const patch: Record<string, unknown> = JSON.parse(JSON.stringify(template.fields))
  const dur = targetDuration ?? template.duration
  patch.inPoint = template.inPointRatio * dur
  patch.duration = dur
  return patch
}

export function templateSummary(t: ClipTemplate): string {
  return `${t.name} [${Object.keys(t.fields).join(', ')}] from ${t.sourceName}`
}
