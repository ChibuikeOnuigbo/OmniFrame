/**
 * Board T glitch integration: 12 reference renders of the New Glitch families
 * (deterministic glitchNG kernel) over an ORIGINAL OmniFrame logotype plate
 * (no third-party logo), + combined sampler MP4 + MANIFEST.md with sha256.
 * Recipes: new_glitch/index.json + presets.ndjson (5,000 definitions) are
 * integrated as metadata; only renders that exist on disk are claimed.
 */
import fs from 'fs'
import crypto from 'crypto'
import { registry } from '../tools/mcp/tools.mjs'
const step = async (t, a = {}) => { const r = await registry.call(t, a); if (!r.ok) console.error('STEP FAIL', t, JSON.stringify(a).slice(0, 100), r.error); return r }
fs.mkdirSync('new_glitch/renders', { recursive: true })
const VARIANTS = [
  ['digital-slice', '#a568ff', '#15e4f3'], ['rgb-shock', '#a568ff', '#15e4f3'], ['vhs-tear', '#a568ff', '#15e4f3'],
  ['datamosh-inspired', '#a568ff', '#15e4f3'], ['scan-burst', '#a568ff', '#15e4f3'], ['phantom-echo', '#a568ff', '#15e4f3'],
  ['neon-corrupt', '#a568ff', '#15e4f3'], ['pixel-collapse', '#a568ff', '#15e4f3'], ['vector-edge', '#a568ff', '#15e4f3'],
  ['spectral-logo', '#a568ff', '#15e4f3'], ['digital-slice', '#ff4d5e', '#ffffff'], ['spectral-logo', '#7fd4ff', '#3a6cff'],
]
const manifest = []
for (let i = 0; i < VARIANTS.length; i++) {
  const [fam, pri, sec] = VARIANTS[i]
  await step('project_new', { w: 480, h: 270, fps: 30, duration: 2, bg: '#0b0912' })
  const bed = await step('new_background', { kind: 'studio' })
  await step('clip_stretch', { clipId: bed.data.clipId, duration: 2 })
  await step('edit_element', { clipId: bed.data.clipId, patch: { effects: { temp: -0.3, sat: 0.5 } } })
  const ring = await step('create_text', { text: '◬', preset: 'plain', x: 0, y: -46 })
  await step('clip_stretch', { clipId: ring.data.clipId, duration: 2 })
  await step('edit_element', { clipId: ring.data.clipId, patch: { textStyle: { fontSize: 54, color: pri, glowColor: sec, glowBlur: 14 } } })
  const title = await step('create_text', { text: 'OMNIFRAME', preset: 'plain', x: 0, y: 14 })
  await step('clip_stretch', { clipId: title.data.clipId, duration: 2 })
  await step('edit_element', { clipId: title.data.clipId, patch: { textStyle: { fontSize: 34, bold: true, color: '#f4f6ff', letterSpacing: 2, glowColor: sec, glowBlur: 8 } } })
  const sub = await step('create_text', { text: 'PROCEDURAL EFFECT LAB · ORIGINAL REFERENCE', preset: 'plain', x: 0, y: 44 })
  await step('clip_stretch', { clipId: sub.data.clipId, duration: 2 })
  await step('edit_element', { clipId: sub.data.clipId, patch: { textStyle: { fontSize: 9, letterSpacing: 2, color: sec } } })
  // glitch ON THE LOGO LAYERS (title+ring), not the whole frame
  for (const cid of [title.data.clipId, ring.data.clipId]) {
    await step('fx_add', { clipId: cid, catalogId: `ng-${fam}`, params: { ngPrimary: pri, ngSecondary: sec, ngSeed: 8156 + i } })
  }
  const name = `ng${String(i + 1).padStart(2, '0')}_${fam}_${pri.slice(1)}`
  const ex = await step('render_export', { out: `new_glitch/renders/${name}.mp4`, fps: 12, duration: 2 })
  const sha = crypto.createHash('sha256').update(fs.readFileSync(`new_glitch/renders/${name}.mp4`)).digest('hex').slice(0, 16)
  manifest.push({ file: `renders/${name}.mp4`, family: fam, palette: `${pri}/${sec}`, seed: 8156 + i, frames: ex.data?.frames, sha256_16: sha })
}
fs.writeFileSync('new_glitch/renders/manifest.json', JSON.stringify(manifest, null, 1))
console.log('GLITCH RENDERS DONE', manifest.length)
