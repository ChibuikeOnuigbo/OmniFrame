/**
 * Drawing -> Clips planner verification: 10,000 randomized scenarios.
 *
 * Asserts, for every scenario:
 *  1. Coverage is exact — the union of generated clip frames equals the
 *     union of stroke frames per (layer, anchors) signature. Frames 1-15
 *     plus 123-126 must yield two clips, never one spanning the gap.
 *  2. No stroke is lost, duplicated, or invented; payloads ride along by id.
 *  3. Clips sharing a generated track never overlap in time.
 *  4. Track order respects anchor strata: a drawing made on a lower clip
 *     is never placed above a drawing made on the clip over it when they
 *     overlap in time (the layered exception to "same track naturally").
 *  5. Unanchored drawings go to the top stratum.
 *
 * Run: node qa/drawing-to-clips-fuzz.mjs  (uses Node type stripping)
 */
import { planDrawingToClips, strokeFrameInterval } from '../src/lib/drawingToClips.ts'

const ITERATIONS = 10000
let seed = 123456789
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}
const ri = (n) => Math.floor(rand() * n)
const pick = (arr) => arr[ri(arr.length)]

let failures = 0
const fail = (msg) => {
  failures++
  if (failures <= 5) console.error('[FAIL]', msg)
}

for (let iter = 0; iter < ITERATIONS; iter++) {
  const fps = pick([24, 25, 30, 60])
  const projectDuration = 2 + rand() * 20
  const projectEndFrame = Math.round(projectDuration * fps)
  const trackIdsTopToBottom = Array.from({ length: 1 + ri(4) }, (_, i) => `track-${i}`)
  const clips = trackIdsTopToBottom.flatMap((trackId, ti) =>
    Array.from({ length: ri(3) }, (_, ci) => ({ id: `clip-${ti}-${ci}`, trackId })),
  )
  const layerIds = ['layer-a', 'layer-b']

  const strokes = []
  const strokeCount = ri(14)
  for (let i = 0; i < strokeCount; i++) {
    const kind = pick(['global', 'span', 'frame'])
    const layered = rand() < 0.6
    const anchorCount = layered ? ri(Math.min(3, clips.length) + 1) : 0
    const anchors = [...new Set(Array.from({ length: anchorCount }, () => pick(clips)?.id).filter(Boolean))]
    strokes.push({
      id: `stroke-${iter}-${i}`,
      layerId: pick(layerIds),
      tool: 'brush',
      color: '#ff0000',
      size: 6,
      opacity: 1,
      points: [{ x: 0.1, y: 0.1, timestamp: 0 }],
      layered,
      anchorClipIds: anchors,
      temporalScope:
        kind === 'global'
          ? { type: 'global' }
          : kind === 'span'
            ? { type: 'span', startTime: rand() * projectDuration, duration: rand() * 3 }
            : { type: 'frame', frame: ri(projectEndFrame + 4), holdFrames: 1 + ri(12) },
    })
  }

  const plan = planDrawingToClips({ strokes, clips, trackIdsTopToBottom, fps, projectDuration })

  // (2) partition of converted ids
  const expectedConverted = strokes
    .filter((s) => strokeFrameInterval(s, fps, projectEndFrame))
    .map((s) => s.id)
    .sort()
  if (JSON.stringify([...plan.convertedStrokeIds].sort()) !== JSON.stringify(expectedConverted)) {
    fail(`iter ${iter}: converted stroke partition mismatch`)
    continue
  }

  // (1) coverage per signature
  const sigOf = (layerId, anchors) => `${layerId}|${[...anchors].sort().join(',')}`
  const expected = new Map()
  for (const s of strokes) {
    const iv = strokeFrameInterval(s, fps, projectEndFrame)
    if (!iv) continue
    const key = sigOf(s.layerId, s.layered ? s.anchorClipIds : [])
    const set = expected.get(key) || new Set()
    for (let f = iv[0]; f < iv[1]; f++) set.add(f)
    expected.set(key, set)
  }
  const actual = new Map()
  for (const c of plan.clips) {
    const key = sigOf(c.layerId, c.anchorClipIds)
    const set = actual.get(key) || new Set()
    for (let f = c.startFrame; f < c.endFrame; f++) {
      if (set.has(f)) fail(`iter ${iter}: frame ${f} covered twice in ${key}`)
      set.add(f)
    }
    actual.set(key, set)
    if (Math.abs(c.start - c.startFrame / fps) > 1e-9 || Math.abs(c.duration - (c.endFrame - c.startFrame) / fps) > 1e-9) {
      fail(`iter ${iter}: clip seconds do not match frames`)
    }
  }
  for (const [key, set] of expected) {
    const got = actual.get(key)
    if (!got || got.size !== set.size || [...set].some((f) => !got.has(f))) {
      fail(`iter ${iter}: coverage mismatch for ${key}`)
    }
  }

  // (3) no same-track overlap
  const byTrack = new Map()
  for (const c of plan.clips) {
    const list = byTrack.get(c.trackKey) || []
    list.push(c)
    byTrack.set(c.trackKey, list)
  }
  for (const [key, list] of byTrack) {
    const sorted = [...list].sort((a, b) => a.startFrame - b.startFrame)
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startFrame < sorted[i - 1].endFrame) fail(`iter ${iter}: overlapping clips on ${key}`)
    }
  }

  // (4) + (5) strata ordering for overlapping segments
  const trackOrder = new Map(plan.tracks.map((t, i) => [t.key, i])) // sorted bottom->top strata
  for (const a of plan.clips) {
    if (a.anchorClipIds.length === 0 && a.stratum !== Infinity) fail(`iter ${iter}: unanchored not on top stratum`)
    for (const b of plan.clips) {
      const overlap = a.startFrame < b.endFrame && b.startFrame < a.endFrame
      if (overlap && a.stratum < b.stratum && trackOrder.get(a.trackKey) > trackOrder.get(b.trackKey)) {
        fail(`iter ${iter}: lower-stratum drawing placed above higher-stratum drawing`)
      }
    }
  }
}

console.log(
  failures === 0
    ? `drawing-to-clips-fuzz: passed (${ITERATIONS} scenarios)`
    : `drawing-to-clips-fuzz: ${failures} failure(s) over ${ITERATIONS} scenarios`,
)
process.exit(failures === 0 ? 0 : 1)
