/** Board S: 20-version reinforcement pass on the RDT remake.
 *  Method (CEM / reward-shaped hill climb): sample 20 parameter vectors around a base
 *  policy, render each version, score it against descriptors MEASURED from the user's
 *  reference frames (rdt-frames f03/f13/f18: band colour cast, border blur energy,
 *  see-through text fraction, warmth), keep the elite 5, move the policy mean to the
 *  elite mean with shrunk variance, then render the learned best at full quality.
 *  Outputs: test_ans_result/rdt-versions/v01..v20.mp4 + scores.json + board_S_rdt_best.mp4 */
import { registry, SESSION } from '../tools/mcp/tools.mjs'
import { renderFrame } from '../tools/mcp/appRender.mjs'
import { loadImage } from '../tools/mcp/core.mjs'
import fs from 'fs'

const PHOTO = 'public/uploads/17908683167065917032696543501299.jpg'
const VW = 90, VH = 160
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const rng = mulberry(42)
const rand = (lo, hi) => lo + rng() * (hi - lo)
const pick = (arr) => arr[Math.floor(rng() * arr.length)]

/* ---- descriptors on a 90x160 grid ---- */
function descFromData(d, w, h) {
  const at = (x, y) => { const i = ((y * h) | 0) * w * 4 + ((x * w) | 0) * 4; return [d[i], d[i + 1], d[i + 2]] }
  let bR = 0, bG = 0, bB = 0, bn = 0, oR = 0, oG = 0, oB = 0, on = 0, hf = 0, hfn = 0, tf = 0, tn = 0
  for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) {
    const [r, g, b] = at(x / VW, y / VH)
    const band = y > 55 && y < 105
    const border = y < 25 || y > 135
    if (band) { bR += r; bG += g; bB += b; bn++ }
    if (border) { oR += r; oG += g; oB += b; on++; if (x + 1 < VW) { const [r2] = at((x + 1) / VW, y / VH); hf += Math.abs(r2 - r); hfn++ } }
    if (band) { const lum = (r + g + b) / 3; if (lum > 190) tf++; tn++ }
  }
  const bl = (bR + bG + bB) / (3 * bn) / 255, ol = (oR + oG + oB) / (3 * on) / 255
  const bsat = (Math.abs(bR / bn - bG / bn) + Math.abs(bG / bn - bB / bn)) / 255, osat = (Math.abs(oR / on - oG / on) + Math.abs(oG / on - oB / on)) / 255
  return {
    lumRatio: bl / Math.max(0.02, ol),          // exposure of band vs its own border (content-normalized)
    satLift: bsat - osat, // saturation of band vs its own border
    warmth: ((bR - bB) / bn - (oR - oB) / on) / 255, // warmth sign of band vs border
    borderHF: hf / hfn,
    borderLum: ol,
    textFrac: tf / tn,
  }
}
const descCanvas = (cv) => descFromData(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height)
async function descFile(p) { const im = await loadImage(fs.readFileSync(p)); const { makeCanvas } = await import('../tools/mcp/core.mjs'); const c = makeCanvas(im.width, im.height); c.getContext('2d').drawImage(im, 0, 0); return descCanvas(c) }
const dist = (a, b) => Math.abs(a.lumRatio - b.lumRatio)
  + Math.abs(a.satLift - b.satLift) * 1.5
  + Math.abs(a.warmth - b.warmth) * 2
  + Math.abs(a.borderHF - b.borderHF) / 60
  + Math.abs(a.borderLum - b.borderLum)
  + Math.abs(a.textFrac - b.textFrac) * 4

/* ---- policy ---- */
const GLITCH = [null, 'glitch-slice-mild', 'glitch-slice-medium', 'glitch-slice-heavy']
const BLEND = ['screen', 'overlay', 'lighten']
const LUT1 = ['cyan-surge', 'steel-blue', 'winter-glass', 'teal-amber']      // cool cut 1
const LUT2 = ['crimson-pulse', 'violet-dream', 'golden-hour', 'warm-negative'] // warm/magenta cut 2
const LUT3 = ['midnight-noir', 'ink-cut', '35mm-fade', 'shadow-detail']        // dark cut 3
const base = { glitch: 1, blend: 0, opacity: 0.85, glow: 10, grade: 1, band: 1, blackbars: 0, punch: 0, chroma: 2, lut1: 0, lut2: 0, lut3: 0 }
const sample = (mean, std) => ({
  glitch: Math.max(0, Math.min(3, Math.round(mean.glitch + (rng() * 2 - 1) * std.glitch))),
  blend: Math.max(0, Math.min(2, Math.round(mean.blend + (rng() * 2 - 1) * std.blend))),
  opacity: Math.max(0.5, Math.min(0.95, mean.opacity + (rng() * 2 - 1) * std.opacity)),
  glow: Math.max(0, Math.min(18, mean.glow + (rng() * 2 - 1) * std.glow)),
  grade: Math.max(0.6, Math.min(1, mean.grade + (rng() * 2 - 1) * std.grade)),
  band: Math.max(0.68, Math.min(1, mean.band + (rng() * 2 - 1) * std.band)),
  blackbars: rng() < std.blackbars ? 1 - mean.blackbars : mean.blackbars,
  punch: rng() < std.punch ? 1 - mean.punch : mean.punch,
  lut1: Math.max(0, Math.min(3, Math.round(mean.lut1 + (rng() * 2 - 1) * std.lut1))),
  lut2: Math.max(0, Math.min(3, Math.round(mean.lut2 + (rng() * 2 - 1) * std.lut2))),
  lut3: Math.max(0, Math.min(3, Math.round(mean.lut3 + (rng() * 2 - 1) * std.lut3))),
  chroma: Math.max(0, Math.min(5, mean.chroma + (rng() * 2 - 1) * std.chroma)),
})

const step = async (tool, args = {}) => { const r = await registry.call(tool, args); if (!r.ok) throw new Error(tool + ' ' + JSON.stringify(r.data).slice(0, 120)); return r }
async function buildVersion(p, vi) {
  await step('project_new', { w: 360, h: 640, fps: 12, duration: 7.5, bg: '#000000' })
  const cuts = [
    { start: 0, dur: 2.5, scale: p.band, lut: LUT1[p.lut1], word: 'HALLMARK' },
    { start: 2.5, dur: 2.5, scale: p.band * 0.72, lut: LUT2[p.lut2], word: 'ME' },
    { start: 5, dur: 2.5, scale: p.band, lut: LUT3[p.lut3], word: 'UNDER' },
  ]
  for (const cut of cuts) {
    // the reference grades the WHOLE frame per cut — blur fill included
    const bgc = await step('import_media', { path: PHOTO, fit: 'cover', scale: 1.15 })
    await step('clip_stretch', { clipId: bgc.data.clipId, duration: cut.dur })
    await step('clip_move_time', { clipId: bgc.data.clipId, start: cut.start })
    await step('select', { clipId: bgc.data.clipId })
    if (!p.blackbars) await step('fx_add', { catalogId: 'blur-2' })
    await step('edit_element', { clipId: bgc.data.clipId, patch: { adjustment: { luts: [{ id: 'bg', name: cut.lut, builtin: cut.lut, intensity: p.grade, enabled: true }] } } })
    const c = await step('import_media', { path: PHOTO, fit: 'contain', scale: cut.scale })
    await step('clip_stretch', { clipId: c.data.clipId, duration: cut.dur })
    await step('clip_move_time', { clipId: c.data.clipId, start: cut.start })
    await step('edit_element', { clipId: c.data.clipId, patch: { adjustment: { luts: [{ id: 'g', name: cut.lut, builtin: cut.lut, intensity: p.grade, enabled: true }] } } })
    if (p.punch) {
      await step('select', { clipId: c.data.clipId })
      await step('keyframe_set', { property: 'scale', channel: 'X', time: cut.start + 0.05, value: 1.12, interpolation: 'linear' })
      await step('keyframe_set', { property: 'scale', channel: 'X', time: cut.start + 0.45, value: 1, interpolation: 'linear' })
      await step('keyframe_set', { property: 'scale', channel: 'Y', time: cut.start + 0.05, value: 1.12, interpolation: 'linear' })
      await step('keyframe_set', { property: 'scale', channel: 'Y', time: cut.start + 0.45, value: 1, interpolation: 'linear' })
    }
    const t = await step('create_text', { text: cut.word, preset: 'bar', x: 0, y: 0 })
    await step('clip_move_time', { clipId: t.data.clipId, start: cut.start + 0.2 })
    await step('clip_stretch', { clipId: t.data.clipId, duration: cut.dur - 0.4 })
    await step('select', { clipId: t.data.clipId })
    await step('blend_set', { mode: BLEND[p.blend] })
    await step('transform_set', { opacity: p.opacity })
    if (GLITCH[p.glitch]) await step('fx_add', { catalogId: GLITCH[p.glitch] })
    if (p.glow > 0.5) await step('edit_element', { clipId: t.data.clipId, patch: { textStyle: { glowColor: '#22d3ee', glowBlur: p.glow, glowMode: 'outward', chroma: p.chroma } } })
  }
  return SESSION.seq
}

const refs = [await descFile('new_doc_toll_research/imgs/rdt-frames/f03.png'), await descFile('new_doc_toll_research/imgs/rdt-frames/f13.png'), await descFile('new_doc_toll_research/imgs/rdt-frames/f18.png')]
const TIMES = [1.2, 3.7, 6.2]
fs.mkdirSync('test_ans_result/rdt-versions', { recursive: true })

let mean = { ...base }, std = { glitch: 1.5, blend: 1, opacity: 0.15, glow: 7, grade: 0.2, band: 0.15, blackbars: 0.4, punch: 0.4, lut1: 1.5, lut2: 1.5, lut3: 1.5, chroma: 2 }
const scores = []
for (let v = 21; v <= 40; v++) {
  const p = v === 1 ? { ...base } : sample(mean, std)
  const seq = await buildVersion(p, v)
  let d = 0
  for (let i = 0; i < 3; i++) {
    const cv = renderFrame(seq, TIMES[i])
    d += dist(descCanvas(cv), refs[i]) / 3
  }
  const ex = await registry.call('render_export', { out: `test_ans_result/rdt-versions/v${String(v).padStart(2, '0')}.mp4`, fps: 12, duration: 7.5 })
  scores.push({ v, reward: -d, p })
  console.log(`v${String(v).padStart(2, '0')} reward ${(-d).toFixed(3)}`, JSON.stringify(p))
}
scores.sort((a, b) => b.reward - a.reward)
const elite = scores.slice(0, 5)
for (const k of Object.keys(mean)) {
  if (typeof mean[k] !== 'number') continue
  mean[k] = elite.reduce((s, e) => s + e.p[k], 0) / elite.length
  std[k] = (std[k] || 0.2) * 0.5
}
for (const k of ['glitch', 'blend', 'blackbars', 'punch', 'lut1', 'lut2', 'lut3']) mean[k] = Math.max(0, Math.min(3, Math.round(mean[k])))
fs.writeFileSync('test_ans_result/rdt-versions/scores-gen2.json', JSON.stringify({ method: 'CEM reward-shaped hill climb vs reference-frame descriptors', scores, learnedMean: mean }, null, 1))
// learned best at full quality
await buildVersion(mean, 99)
const ex = await registry.call('render_export', { out: 'test_ans_result/board_S_rdt_best2.mp4', fps: 30, duration: 7.5 })
console.log('BEST', ex.ok, ex.data.video, 'elite rewards', elite.map(e => e.reward.toFixed(3)).join(','))
