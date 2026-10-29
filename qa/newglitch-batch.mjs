/**
 * New Glitch BATCH QUEUE (resumable): renders the next slice of the 5,000
 * recipe definitions in new_glitch/presets.ndjson through the REAL in-app
 * effect graph (Glitch NG catalog → glitchNG kernel), one mp4 each, with
 * perceptual dedupe (32x18 grayscale MAD) so near-identical outputs are not
 * counted twice. Checkpoint: new_glitch/batch/checkpoint.json — re-running
 * this script continues where it stopped. Per-batch manifest + combined
 * review reel are written at the end of every run.
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { registry } from '../tools/mcp/tools.mjs'
import { loadImage, makeCanvas, ffmpegExe } from '../tools/mcp/core.mjs'
import { execFileSync } from 'child_process'

const START = 12 // recipes 1-12 already rendered by qa/board-T-glitch.mjs
const COUNT = 88 // this slice
const OUT = 'new_glitch/batch'
fs.mkdirSync(OUT, { recursive: true })
const CK = path.join(OUT, 'checkpoint.json')
const ck = fs.existsSync(CK) ? JSON.parse(fs.readFileSync(CK, 'utf8')) : { next: START, kept: [], dups: [], failed: [] }
const lines = fs.readFileSync('new_glitch/presets.ndjson', 'utf8').trim().split('\n')

const step = async (t, a = {}) => { const r = await registry.call(t, a); if (!r.ok) console.error('STEP FAIL', t, JSON.stringify(a).slice(0, 110), String(r.error).slice(0, 140)); return r }

let SIGFRAMES = [6, 12, 18]
async function sigOf(mp4) {
  // 3 sampled frames, centre crop (the logo band where glitch actually acts):
  // whole-frame grayscale diluted differences so much that every recipe
  // looked like a duplicate of every other.
  const g = []
  for (const n of SIGFRAMES) {
    const png = `/tmp/sig-${Date.now()}-${n}.png`
    execFileSync(ffmpegExe(), ['-y', '-loglevel', 'error', '-i', mp4, '-vf', `select=eq(n\\,${n})`, '-frames:v', '1', png])
    const im = await loadImage(fs.readFileSync(png))
    const c = makeCanvas(96, 30), x = c.getContext('2d')
    x.drawImage(im, 0, im.height * 0.3, im.width, im.height * 0.55, 0, 0, 96, 30)
    const d = x.getImageData(0, 0, 96, 30).data
    for (let i = 0; i < d.length; i += 4) g.push((0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255)
    fs.unlinkSync(png)
  }
  return g
}
const mad = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length

const sigs = [] // kept signatures this run (+ reload from keptSigs file)
const SIGF = path.join(OUT, 'sigs.json')
if (fs.existsSync(SIGF)) sigs.push(...JSON.parse(fs.readFileSync(SIGF, 'utf8')))

const end = Math.min(lines.length, ck.next + COUNT)
for (let idx = ck.next; idx < end; idx++) {
  const r = JSON.parse(lines[idx])
  const p = r.parameters || {}, tl = r.timeline || {}, pal = r.palette || {}
  const pri = pal.primary || '#a568ff', sec = pal.secondary || '#15e4f3'
  const dur = Math.min(4, Math.max(2, Number(r.duration) || 4))
  SIGFRAMES = [Math.round(dur * 12 * 0.3), Math.round(dur * 12 * 0.55), Math.round(dur * 12 * 0.8)]
  await step('project_new', { w: 480, h: 270, fps: 30, duration: dur, bg: pal.bg || '#0b0912' })
  const bed = await step('new_background', { kind: 'studio' })
  await step('clip_stretch', { clipId: bed.data.clipId, duration: dur })
  await step('edit_element', { clipId: bed.data.clipId, patch: { effects: { temp: -0.3, sat: 0.5 } } })
  const ring = await step('create_text', { text: '◬', preset: 'plain', x: 0, y: -46 })
  await step('clip_stretch', { clipId: ring.data.clipId, duration: dur })
  await step('edit_element', { clipId: ring.data.clipId, patch: { textStyle: { fontSize: 54, color: pri, glowColor: sec, glowBlur: 14 } } })
  const title = await step('create_text', { text: 'OMNIFRAME', preset: 'plain', x: 0, y: 14 })
  await step('clip_stretch', { clipId: title.data.clipId, duration: dur })
  await step('edit_element', { clipId: title.data.clipId, patch: { textStyle: { fontSize: 34, bold: true, color: '#f4f6ff', letterSpacing: 2, glowColor: sec, glowBlur: 8 } } })
  const params = {
    ngFamily: r.family, ngSeed: r.seed, ngPrimary: pri, ngSecondary: sec,
    // recipe timelines are FRACTIONS of recipe duration; kernel takes seconds
    ngLead: (tl.lead ?? 0.1) * dur, ngAttack: (tl.attack ?? 0.1) * dur, ngHold: (tl.hold ?? 0.4) * dur, ngDecay: (tl.decay ?? 0.2) * dur,
    ngSliceAmp: p.sliceAmplitudePx, ngSliceDensity: p.sliceDensity, ngChroma: p.chromaticAberrationPx,
    ngScanOpacity: p.scanOpacity, ngScanSpacing: p.scanSpacingPx, ngNoise: p.noiseOpacity,
    ngBlock: p.blockScalePx, ngBlockRate: p.blockDropRate,
  }
  for (const c of [title, ring]) await step('fx_add', { clipId: c.data.clipId, catalogId: `ng-${r.family}`, params })
  const file = `${OUT}/b${String(idx + 1).padStart(4, '0')}_${r.family}.mp4`
  const ex = await step('render_export', { out: file, fps: 12, duration: dur })
  if (!ex.ok) { ck.failed.push(idx + 1); ck.next = idx + 1; fs.writeFileSync(CK, JSON.stringify(ck)); continue }
  const sig = await sigOf(file)
  const dup = sigs.find(s => mad(s, sig) < 0.6 / 255)
  if (dup) { fs.unlinkSync(file); if (fs.existsSync(file.replace(/\.mp4$/, '.json'))) fs.unlinkSync(file.replace(/\.mp4$/, '.json')); ck.dups.push(idx + 1) } else {
    sigs.push(sig)
    ck.kept.push({ n: idx + 1, id: r.id, family: r.family, palette: `${pri}/${sec}`, seed: r.seed, file, sha256_16: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16) })
  }
  ck.next = idx + 1
  fs.writeFileSync(CK, JSON.stringify(ck))
  fs.writeFileSync(SIGF, JSON.stringify(sigs))
  console.log(`batch ${idx + 1}/${end} ${r.family} ${dup ? 'DUP-skipped' : 'kept'}`)
}

// per-run manifest + combined review reel of everything kept so far
const md = ['# New Glitch batch manifest (rendered + validated in-app)', '',
  `Checkpoint: recipe ${ck.next} of ${lines.length} queued next · kept ${ck.kept.length} · dup-skipped ${ck.dups.length} · failed ${ck.failed.length}`, '',
  '| # | recipe | family | palette | seed | file | sha256:16 |', '|---|---|---|---|---|---|---|']
for (const k of ck.kept) md.push(`| ${k.n} | ${k.id} | ${k.family} | ${k.palette} | ${k.seed} | [${path.basename(k.file)}](${k.file}) | ${k.sha256_16} |`)
fs.writeFileSync(`${OUT}/batch-manifest.md`, md.join('\n') + '\n')
const reelList = ck.kept.slice(-60).map(k => `file '${path.resolve(k.file)}'`).join('\n')
fs.writeFileSync('.cache/reel.txt', reelList + '\n')
if (ck.kept.length) execFileSync(ffmpegExe(), ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.resolve('.cache/reel.txt'), '-c', 'copy', 'new_glitch/batch_reel.mp4'])
console.log('BATCH RUN DONE kept', ck.kept.length, 'dups', ck.dups.length, 'next', ck.next)
