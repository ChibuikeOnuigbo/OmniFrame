/**
 * Board S cont.6 — gen-2 study-remake of the FULL Drive edit `MONTAGEM ADEUS.mp4`
 * (33s 1080p30 anime montagem, studied frame-by-frame via contact sheets in
 *  new_doc_toll_research/imgs/montagem-sheet/).
 *
 * Studied grammar reproduced here (honest approximations noted):
 *  1. blackout strobe frames between sections            -> 0.12s black clips
 *  2. iris/eye-mask reveal (char inside eye, zoom out)   -> contain band over aurora bed + crimson edge ring + zoom-out keys (no mask tool in engine: approximated)
 *  3. title card: main line + tiny subline over animated -> replaceBg bed + snow particle bed tinted,
 *     pattern bed, color-flipped red -> cyan on next beat    same two texts rebuilt with flipped tints
 *  4. alternating warm-natural <-> cool-duotone grades   -> golden-hour vs midnight-noir LUT cuts
 *  5. small lowercase serif credit label, right side     -> Georgia-italic 12px text clip
 *  6. hard cut to black at tail                          -> 0.5s black clip
 *  7. punch-ins + radial burst flare at section starts   -> scale keys + edgeglow
 */
import fs from 'fs'
import { registry, SESSION } from '../tools/mcp/tools.mjs'
import { createCanvas } from '@napi-rs/canvas'

const PHOTO = 'public/uploads/17908683167065917032696543501299.jpg'
const step = async (t, a = {}) => {
  const r = await registry.call(t, a)
  if (!r.ok) console.error('STEP FAIL', t, JSON.stringify(a), r.error)
  return r
}

// black strobe plate
const bc = createCanvas(16, 16)
const bx = bc.getContext('2d')
bx.fillStyle = '#000000'
bx.fillRect(0, 0, 16, 16)
fs.writeFileSync('/tmp/mont-black.png', bc.toBuffer('image/png'))

await step('project_new', { w: 360, h: 640, fps: 30, duration: 10, bg: '#000000' })

let t0 = 0
const black = async (dur) => {
  const b = await step('import_media', { path: '/tmp/mont-black.png', fit: 'cover', scale: 1 })
  await step('clip_stretch', { clipId: b.data.clipId, duration: dur })
  await step('clip_move_time', { clipId: b.data.clipId, start: t0 })
  t0 += dur
  return b
}

// ---- cut 1: warm natural action beat + punch-in + gold flare rim
{
  const bg = await step('import_media', { path: PHOTO, fit: 'cover', scale: 1.15 })
  await step('clip_stretch', { clipId: bg.data.clipId, duration: 1.5 })
  await step('clip_move_time', { clipId: bg.data.clipId, start: t0 })
  await step('select', { clipId: bg.data.clipId })
  await step('edit_element', { clipId: bg.data.clipId, patch: { adjustment: { luts: [{ id: 'c1', builtin: 'golden-hour', name: 'golden-hour', intensity: 1, enabled: true }] } } })
  for (const ch of ['X', 'Y']) {
    await step('keyframe_set', { property: 'scale', channel: ch, time: t0, value: 1.0, interpolation: 'linear' })
    await step('keyframe_set', { property: 'scale', channel: ch, time: t0 + 1.4, value: 1.14, interpolation: 'linear' })
  }
  t0 += 1.5
}
await black(0.12) // strobe

// ---- cut 2: iris/eye-mask reveal approx: small contain band over aurora bed + crimson ring + zoom-out
{
  const bed = await step('new_background', { kind: 'aurora' })
  await step('clip_stretch', { clipId: bed.data.clipId, duration: 1.5 })
  await step('clip_move_time', { clipId: bed.data.clipId, start: t0 })
  await step('fx_add', { clipId: bed.data.clipId, catalogId: 'part-1', params: { particleDensity: 0.5, particleTint: '#ff9a4d' } })
  const iris = await step('import_media', { path: PHOTO, fit: 'contain', scale: 0.5 })
  await step('clip_stretch', { clipId: iris.data.clipId, duration: 1.5 })
  await step('clip_move_time', { clipId: iris.data.clipId, start: t0 })
  await step('select', { clipId: iris.data.clipId })
  await step('fx_add', { catalogId: 'edgeglow-crimson' })
  for (const ch of ['X', 'Y']) {
    await step('keyframe_set', { property: 'scale', channel: ch, time: t0, value: 0.42, interpolation: 'linear' })
    await step('keyframe_set', { property: 'scale', channel: ch, time: t0 + 1.4, value: 0.78, interpolation: 'linear' })
  }
  t0 += 1.5
}

// ---- cut 3+4: title card, color-flipped red -> cyan (same two texts rebuilt)
const card = async (mode) => {
  const bed = await step('new_background', { kind: mode === 'red' ? 'sunset' : 'grid' })
  await step('clip_stretch', { clipId: bed.data.clipId, duration: 1.6 })
  await step('clip_move_time', { clipId: bed.data.clipId, start: t0 })
  await step('fx_add', {
    clipId: bed.data.clipId, catalogId: 'part-5',
    params: mode === 'red'
      ? { particleDensity: 0.85, particleTint: '#ff2d55' }
      : { particleDensity: 0.85, particleTint: '#22d3ee' },
  })
  const main = await step('create_text', { text: 'ADEUS', preset: 'minimal-fade', x: 0, y: -10 })
  await step('clip_move_time', { clipId: main.data.clipId, start: t0 })
  await step('clip_stretch', { clipId: main.data.clipId, duration: 1.6 })
  await step('edit_element', {
    clipId: main.data.clipId,
    patch: { textStyle: { fontSize: 46, bold: true, letterSpacing: 6, color: '#ffffff', glowColor: mode === 'red' ? '#ff2d55' : '#22d3ee', glowBlur: 14, chroma: 2 } },
  })
  const sub = await step('create_text', { text: 'MONTAGEM · STUDY REMAKE', preset: 'minimal-fade', x: 0, y: 34, scale: 2 })
  await step('clip_move_time', { clipId: sub.data.clipId, start: t0 })
  await step('clip_stretch', { clipId: sub.data.clipId, duration: 1.6 })
  await step('edit_element', {
    clipId: sub.data.clipId,
    patch: { textStyle: { fontSize: 12, letterSpacing: 5, color: mode === 'red' ? '#ffd7de' : '#d7f6ff' } },
  })
  t0 += 1.6
}
await card('red')
await card('cyan')
await black(0.12) // strobe

// ---- cut 5: cool duotone action beat + cobalt rim + shake
{
  const bg = await step('import_media', { path: PHOTO, fit: 'cover', scale: 1.15 })
  await step('clip_stretch', { clipId: bg.data.clipId, duration: 1.5 })
  await step('clip_move_time', { clipId: bg.data.clipId, start: t0 })
  await step('select', { clipId: bg.data.clipId })
  await step('fx_add', { clipId: bg.data.clipId, catalogId: 'glow-0', params: { edgeGlow: 0.7, edgeGlowColor: '#38bdf8' } })
  await step('edit_element', { clipId: bg.data.clipId, patch: { adjustment: { luts: [{ id: 'c5', builtin: 'midnight-noir', name: 'midnight-noir', intensity: 1, enabled: true }] } } })
  await step('fx_add', { catalogId: 'osc-0-sine-6' })
  t0 += 1.5
}

// ---- cut 6: serif credit label right side over studio bed, then black tail
{
  const bed = await step('new_background', { kind: 'studio' })
  await step('clip_stretch', { clipId: bed.data.clipId, duration: 1.5 })
  await step('clip_move_time', { clipId: bed.data.clipId, start: t0 })
  const cr = await step('create_text', { text: 'omniframe edit', preset: 'minimal-fade', x: 92, y: 150 })
  await step('clip_move_time', { clipId: cr.data.clipId, start: t0 })
  await step('clip_stretch', { clipId: cr.data.clipId, duration: 1.5 })
  await step('edit_element', { clipId: cr.data.clipId, patch: { textStyle: { fontSize: 12, fontFamily: 'Georgia, serif', italic: true, color: '#e8e8e8' } } })
  t0 += 1.5
}
await black(0.5) // hard cut to black tail

// evidence frames at the studied beats
for (const [name, t] of [['iris', 2.3], ['card-red', 3.9], ['card-cyan', 5.5], ['credit', 8.6]]) {
  const { renderFrame } = await import('../tools/mcp/appRender.mjs')
  const cv = renderFrame(SESSION.seq, t)
  fs.writeFileSync(`test_ans_result/evidence/S-mont2-${name}.png`, cv.toBuffer('image/png'))
}

const ex = await step('render_export', { out: 'test_ans_result/board_S_montagem2.mp4', fps: 12, duration: t0 })
console.log('MONTAGEM2 DONE', ex.ok, ex.data?.out ?? ex.error, 'frames', ex.data?.frames, 'dur', t0.toFixed(2))
