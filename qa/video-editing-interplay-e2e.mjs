/**
 * Real-video editing interplay: a video clip + converted drawing clip +
 * text clip with Mask View, exercised through trim / split / move / delete /
 * undo (qa/video-editing-interplay-e2e.mjs).
 */
import { chromium as playwrightChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

const URL = process.env.URL || 'http://localhost:5173/#studio'
let executablePath = process.env.CHROME_PATH
if (!executablePath) {
  await inflate(join(process.cwd(), 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}${process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : ''}`
  executablePath = await serverlessChromium.executablePath()
}
const browser = await playwrightChromium.launch({ executablePath, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.setDefaultTimeout(15000)
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const pass = (label) => console.log(`[PASS] ${label}`)

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForFunction(() => Boolean(window.__omniframe_store))
pass('editor booted')

// Seed: real death-note video clip + one animated stroke over frames 0..59.
await page.evaluate(() => {
  const store = window.__omniframe_store
  const s = store.getState()
  const t = s.createTrack('video')
  s.addClipToTrack(t, 'asset-death-note-vid', 0)
  const id = `stroke-${Math.random().toString(36).slice(2, 9)}`
  s.addDrawingStroke({
    id,
    tool: 'pen',
    color: '#ff2222',
    size: 14,
    opacity: 1,
    points: [0.5, 0.5],
    frameMode: 'range',
    frameStart: 0,
    frameEnd: 59,
  })
})
const seeded = await page.evaluate(() => {
  const s = window.__omniframe_store.getState()
  return { clips: s.clips.map((c) => ({ id: c.id, kind: c.kind, duration: c.duration })), strokes: s.drawingStrokes.length }
})
assert.equal(seeded.clips.length, 1)
assert.equal(seeded.clips[0].kind, 'video')
assert.equal(seeded.strokes, 1)
pass(`video clip + stroke seeded (video duration ${seeded.clips[0].duration.toFixed(2)}s)`)

// Convert the stroke to a drawing clip; it must sit alongside the video.
const conv = await page.evaluate(() => {
  const store = window.__omniframe_store
  store.getState().convertDrawingToClips()
  const s = store.getState()
  const drawingClip = s.clips.find((c) => c.kind === 'drawing')
  return drawingClip ? { id: drawingClip.id, start: drawingClip.start, duration: drawingClip.duration, marked: s.drawingStrokes.filter((x) => x.convertedClipId === drawingClip.id).length } : null
})
assert.ok(conv, 'drawing clip created next to the video clip')
assert.equal(conv.marked, 1)
pass('drawing converted to a clip beside real video')

// Trim the drawing clip shorter: playback span shrinks, stroke stays stored.
await page.evaluate((id) => {
  const store = window.__omniframe_store
  const s = store.getState()
  const clip = s.clips.find((c) => c.id === id)
  s.trimClip(id, 'right', clip.start + 1)
}, conv.id)
const trimmed = await page.evaluate((id) => {
  const s = window.__omniframe_store.getState()
  const clip = s.clips.find((c) => c.id === id)
  return { duration: clip.duration, strokes: s.drawingStrokes.length }
}, conv.id)
assert.ok(trimmed.duration <= 1.01, `drawing clip trimmed (got ${trimmed.duration})`)
assert.equal(trimmed.strokes, 1)
pass('drawing clip trimmed without losing stroke data')

// Split the VIDEO clip at 1.5s: two video clips, drawing clip untouched.
await page.evaluate(() => {
  const store = window.__omniframe_store
  const s = store.getState()
  const video = s.clips.find((c) => c.kind === 'video')
  s.selectClip(video.id)
  s.setPlayhead(1.5)
  s.splitAt(1.5)
})
const afterSplit = await page.evaluate(() => {
  const s = window.__omniframe_store.getState()
  return { videos: s.clips.filter((c) => c.kind === 'video').length, drawings: s.clips.filter((c) => c.kind === 'drawing').length }
})
assert.equal(afterSplit.videos, 2)
assert.equal(afterSplit.drawings, 1)
pass('video split at playhead; drawing clip untouched')

// Undo the split, then delete the drawing clip: its stroke must return to
// the live drawing pass (convertedClipId cleared), not vanish.
await page.keyboard.press('Control+z')
await page.waitForFunction(() => window.__omniframe_store.getState().clips.filter((c) => c.kind === 'video').length === 1)
pass('undo restored the single video clip')
await page.evaluate((id) => window.__omniframe_store.getState().removeClip(id), conv.id)
const afterDelete = await page.evaluate(() => {
  const s = window.__omniframe_store.getState()
  return { clips: s.clips.length, strokes: s.drawingStrokes.length, marked: s.drawingStrokes.filter((x) => x.convertedClipId).length }
})
assert.equal(afterDelete.clips, 1)
assert.equal(afterDelete.strokes, 1)
assert.equal(afterDelete.marked, 0)
pass('deleting the drawing clip returned its stroke to the drawing pass')

// Text clip + Mask View split state survives a move edit.
await page.evaluate(() => {
  const store = window.__omniframe_store
  const s = store.getState()
  s.setPlayhead(0)
  s.addTextTitleClip('Interplay Title', 4)
  const text = store.getState().clips.find((c) => c.kind === 'text')
  if (text) {
    s.updateClipMask(text.id, { enabled: true, kind: 'split', splitPos: 0.35, splitAngle: 25, feather: 6, includeMode: 'inside' })
    s.moveClip(text.id, 3, text.trackId)
  }
})
const textState = await page.evaluate(() => {
  const s = window.__omniframe_store.getState()
  const text = s.clips.find((c) => c.kind === 'text')
  return text ? { start: text.start, mask: text.mask } : null
})
assert.ok(textState)
assert.equal(textState.mask.kind, 'split')
assert.equal(textState.mask.splitPos, 0.35)
assert.ok(Math.abs(textState.start - 3) < 0.001)
pass('text clip Mask View split survived a move edit')

assert.equal(errors.length, 0, `page errors: ${errors.join(' | ')}`)
pass('zero page errors')
await browser.close()
console.log('[DONE] video-editing-interplay-e2e')
