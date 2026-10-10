/**
 * clipFilmstrip — true frame-accurate timeline thumbnails.
 *
 * Every section of a clip on the timeline shows the frame the project will
 * actually show at that moment:
 *   • video clips: real decoded source frames, sampled across the clip's
 *     [inPoint, inPoint + duration] span (with the clip's transform/effects
 *     applied),
 *   • compound clips: the RENDERED composite of the nested sequence at each
 *     sample time — nested video/image/text layers, transforms and effects
 *     composited exactly like the preview draws them ("smart layer"),
 *   • image clips: the still frame.
 *
 * Rendering goes through a sampling-mode PreviewEngine (dedicated muted
 * media pool, never the live preview's elements). Jobs are serialized on a
 * small queue so dozens of clips don't fight over seeks, and results are
 * LRU-cached per (clip identity, span, tile count, content hash).
 */

import { PreviewEngine } from './playback'
import { useEditor } from '../store'
import type { Clip, MediaAsset } from '../types'

export interface FilmstripTile {
  /** JPEG dataURL of the rendered frame. */
  dataUrl: string
  /** Timeline time the tile represents (tile centre). */
  t: number
  /** Left edge of the tile, as a percentage of the clip's width. */
  leftPct: number
  /** Tile width as a percentage of the clip's width. */
  widthPct: number
}

const TILE_W = 96
const TILE_H = 54
const MAX_TILES = 20
const TILE_TARGET_PX = 56
const CACHE_CAP = 160
const SEEK_BUDGET_MS = 320

let sampleEngine: PreviewEngine | null = null

function engine(): PreviewEngine {
  if (!sampleEngine) {
    const canvas = document.createElement('canvas')
    sampleEngine = new PreviewEngine(canvas, TILE_W, TILE_H, { sampling: true })
  }
  return sampleEngine
}

// ---- caches --------------------------------------------------------------

const tileCache = new Map<string, FilmstripTile[]>()
const inFlight = new Map<string, Promise<FilmstripTile[]>>()

function cachePut(key: string, tiles: FilmstripTile[]) {
  if (tileCache.size >= CACHE_CAP) {
    const oldest = tileCache.keys().next().value
    if (oldest !== undefined) tileCache.delete(oldest)
  }
  tileCache.set(key, tiles)
}

// ---- content hashing (cache invalidation) --------------------------------

function transformKey(clip: Clip): string {
  const t = clip.transform
  if (!t) return ''
  return [
    Math.round((t.x || 0) * 4),
    Math.round((t.y || 0) * 4),
    Math.round((t.scale || 1) * 50),
    Math.round((t.opacity ?? 1) * 50),
    Math.round(t.rotation || 0),
  ].join('.')
}

function effectsKey(clip: Clip): string {
  const e = clip.effects
  if (!e) return ''
  return [
    e.brightness, e.contrast, e.saturation, e.blur, e.grayscale, e.invert, e.sepia, e.hueRotate,
  ]
    .map((v) => (typeof v === 'number' ? Math.round(v * 20) : '-'))
    .join('.')
}

/** Hash of a compound clip's nested content — changes when the inside does. */
export function compoundContentKey(
  clip: Clip,
  stArg?: ReturnType<typeof useEditor.getState>,
): string {
  const st = stArg ?? useEditor.getState()
  const seq = (st.sequences || []).find((s) => s.id === clip.sourceSequenceId)
  const clips = seq ? seq.clips : clip.originalChildClips || []
  const tracks = seq ? seq.tracks : clip.originalChildTracks || []
  const parts = clips
    .slice(0, 40)
    .map((c) =>
      `${c.kind}:${c.assetId ?? ''}:${Math.round(c.start * 10)}:${Math.round(c.duration * 10)}:${c.textStyle ? c.textStyle.text.slice(0, 24) : ''}:${transformKey(c)}`,
    )
  return `${tracks.length}|${clips.length}|${parts.join(',')}`
}

function jobKey(clip: Clip, tiles: number): string {
  const base =
    clip.kind === 'compound'
      ? `cmp|${clip.id}|${compoundContentKey(clip)}`
      : `clip|${clip.assetId}|${Math.round(clip.inPoint * 20)}|${Math.round(clip.duration * 20)}|${Math.round(clip.start * 20)}|${transformKey(clip)}|${effectsKey(clip)}`
  return `${base}|${tiles}`
}

// ---- seek settling --------------------------------------------------------

async function settleSeeks(eng: PreviewEngine, budgetMs = SEEK_BUDGET_MS): Promise<boolean> {
  const t0 = performance.now()
  for (;;) {
    const els = eng.sampleElements()
    const ready = els.every(
      (el) => !el.seeking && (el.readyState >= 2 || el.readyState === 0 || el.error),
    )
    if (ready && els.length > 0) {
      // One extra frame so the decoded picture is actually blittable.
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      return true
    }
    if (els.length === 0) return true
    if (performance.now() - t0 > budgetMs) return false
    await new Promise((r) => setTimeout(r, 24))
  }
}

// ---- serialized job queue --------------------------------------------------

let queueTail: Promise<unknown> = Promise.resolve()

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queueTail.then(job, job)
  queueTail = run.catch(() => {})
  return run
}

// ---- tile rendering ---------------------------------------------------------

function tileFromCanvas(c: HTMLCanvasElement): string {
  try {
    return c.toDataURL('image/jpeg', 0.72)
  } catch {
    return ''
  }
}

/**
 * Render the filmstrip tiles for one clip. `widthPx` is the clip's current
 * on-screen width — the tile count adapts to it (roughly one frame per 56px).
 */
export async function renderClipFilmstrip(clip: Clip, widthPx: number): Promise<FilmstripTile[]> {
  const duration = Math.max(0.05, clip.duration)
  const tiles = Math.max(1, Math.min(MAX_TILES, Math.round(widthPx / TILE_TARGET_PX)))
  const key = jobKey(clip, tiles)

  const cached = tileCache.get(key)
  if (cached) return cached
  const flying = inFlight.get(key)
  if (flying) return flying

  const job = enqueue(async (): Promise<FilmstripTile[]> => {
    // Another worker may have filled the cache while we waited in the queue.
    const again = tileCache.get(key)
    if (again) return again

    const st = useEditor.getState()
    const eng = engine()
    const out: FilmstripTile[] = []
    let allReady = true
    const step = duration / tiles

    for (let i = 0; i < tiles; i++) {
      const t = clip.start + step * (i + 0.5)
      // Pass 1 issues the seeks on the dedicated pool; pass 2 draws them.
      eng.renderClipTile(clip, t, st)
      const ready = await settleSeeks(eng)
      if (!ready) allReady = false
      const drew = eng.renderClipTile(clip, t, st)
      const url = drew ? tileFromCanvas(eng.sampleCanvas()) : ''
      out.push({
        dataUrl: url,
        t,
        leftPct: (i * step * 100) / duration,
        widthPct: (step * 100) / duration,
      })
    }

    if (allReady && out.every((tile) => tile.dataUrl)) cachePut(key, out)
    return out
  })

  inFlight.set(key, job)
  try {
    return await job
  } finally {
    inFlight.delete(key)
  }
}

/** Drop cached tiles (e.g. a compound clip's nested content changed). */
export function invalidateFilmstrip(clip: Clip): void {
  for (const k of [...tileCache.keys()]) {
    if (k.startsWith(`cmp|${clip.id}|`)) tileCache.delete(k)
  }
}
