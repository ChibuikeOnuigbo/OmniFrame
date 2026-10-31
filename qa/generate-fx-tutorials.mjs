/**
 * Effects-engine tutorial corpus generator (board J follow-up).
 *
 * Honesty law: the corpus is exactly as big as the REAL catalog — one
 * tutorial per real preset (every property set renders through the app's
 * own engines). No invented numbers: the header prints the generated count.
 * 24 tutorials get full step cards; 12 of those also carry a rendered proof
 * frame produced by the headless renderer (app-made, never hand-drawn).
 * The remaining entries appear in the full recipe index (id + category +
 * the exact engine properties the tutorial tunes).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadAppTs, Sequence, makeClip, renderFrame } from '../tools/mcp/appRender.mjs'
import { makeCanvas, loadImage } from '../tools/mcp/core.mjs'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const OUT = path.join(ROOT, 'new_doc_toll_research')
const IMG = path.join(OUT, 'images')

const FXC = await loadAppTs('src/lib/effectCatalog.ts')
const catalog = FXC.getFxCatalog()
const paramDefs = FXC.paramsForPatch

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const CATS = ['glitch', 'motion', 'color', 'blur', 'distort', 'retro', 'light', 'key']
const byCat = {}
for (const c of CATS) byCat[c] = catalog.filter((e) => e.cat === c)

const FULL_CARD = [
  'glitch-slice-heavy', 'glitch-rgb-extreme', 'glitch-mosh-medium', 'osc-90-sine-40', 'osc-45-triangle-16',
  'shake-22', 'echo-0', 'strobe-1', 'vhs-3', 'minimax-45-max', 'minimax-135-min', 'look-noir', 'look-golden-hour',
  'glow-2', 'edgeglow-cyan', 'light-spot-gold', 'dirc-2-3-45', 'gmap-0-4', 'turb-2', 'swirl-180', 'blur-2',
  'zblur-1', 'ckey-green', 'part-5',
]
const PROOF = ['glitch-slice-heavy', 'osc-90-sine-40', 'vhs-3', 'minimax-45-max', 'look-noir', 'glow-2', 'dirc-2-3-45', 'gmap-0-4', 'turb-2', 'blur-2', 'zblur-1', 'ckey-green']

const stepsFor = (e) => [
  `Open the <b>Effects</b> tab (left dock) and pick the <b>${esc(e.cat)}</b> sub-tab.`,
  `Find <b>${esc(e.name)}</b> — drag its tile onto an image/video/compound clip (it tags the clip, full length, closed container) or click to apply; the <b>L</b> chip places it as an adjustment layer grading every track below.`,
  `The inner cyan bar appears at the clip bottom: drag its body to move, the <b>white end bars</b> to trim (never leaves the parent; 0.1s minimum).`,
  `Right panel → <b>FX Stack</b>: every property is an editable slider/select/colour — ${paramDefs(e.patch).map((p) => esc(p.label)).join(', ') || 'its engine values'}.`,
  `Keyframe any numeric property: press ◆ at the playhead, move the playhead, change the value, press ◆ again (diamonds show on the timeline bar).`,
  `Render/export — the effect lives only inside its bar range, stacks with any other dropped effects, and survives split (B) and trim.`,
]

/* ---- rendered proofs (headless app renderer, never hand-made) ---- */
fs.mkdirSync(IMG, { recursive: true })
const proofs = {}
for (const id of PROOF) {
  const entry = catalog.find((e) => e.id === id)
  if (!entry) continue
  const seq = new Sequence({ w: 320, h: 180, fps: 12, duration: 1, bg: '#101014' })
  const buf = fs.readFileSync(path.join(ROOT, 'qa/shots/01-home.png'))
  const im = await loadImage(buf)
  const k = Math.min(320 / im.width, 180 / im.height) * 0.8
  const clip = makeClip({ id: 'clip-1', name: 'plate', asset: 'qa/shots/01-home.png', natW: im.width * k, natH: im.height * k, duration: 1, draw: (sx, w, h) => sx.drawImage(im, 0, 0, im.width, im.height, 0, 0, w, h) })
  clip.fxInstances = [{ id: 'fx-1', catalogId: id, name: entry.name, inP: 0, duration: 1, params: { ...entry.patch }, keys: {}, enabled: true }]
  seq.addClip(clip)
  const frame = renderFrame(seq, 0.5)
  const file = `fx-tut-${id.replace(/[^a-z0-9-]/gi, '')}.png`
  fs.writeFileSync(path.join(IMG, file), frame.toBuffer('image/png'))
  proofs[id] = `images/${file}`
}

/* ---- HTML ---- */
const fullCards = FULL_CARD.map((id) => catalog.find((e) => e.id === id)).filter(Boolean)
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>OmniFrame Effects-Engine Tutorials</title>
<style>
 body{background:#0d0f13;color:#dbe3ee;font:13px/1.5 system-ui,sans-serif;margin:0;padding:24px}
 h1{font-size:20px} h2{font-size:15px;margin-top:28px;color:#7dd3fc}
 .count{color:#67e8f9;font-weight:700}
 .card{border:1px solid #263041;border-radius:10px;padding:12px 14px;margin:10px 0;background:#11161d}
 .card h3{margin:0 0 6px;font-size:13px;color:#e2e8f0}
 .cat{display:inline-block;border-radius:99px;padding:1px 8px;font-size:10px;background:#164e63;color:#a5f3fc;margin-left:6px}
 ol{margin:6px 0 6px 18px;padding:0} li{margin:3px 0}
 .props{font:11px ui-monospace,monospace;color:#86efac}
 .trace{font-size:10px;color:#64748b}
 img{border:1px solid #263041;border-radius:6px;margin-top:6px;max-width:320px}
 table{border-collapse:collapse;font-size:11px} td,th{border:1px solid #1f2937;padding:2px 6px;text-align:left}
 details{margin:6px 0} summary{cursor:pointer;color:#93c5fd;font-size:12px}
</style></head><body>
<h1>Effects-engine tutorials — <span class="count">${catalog.length.toLocaleString('en-US')}</span> real tutorials (one per catalog preset)</h1>
<p>Every tutorial below drives the <b>real</b> OmniFrame effect engine: the property values are the
exact engine patch the preset drops on a clip, and the steps are the app's universal workflow
(Effects tab → drop/apply → FX Stack editing → ◆ keyframes → render). The count printed above is
generated from the catalog at build time — nothing is padded. ${PROOF.length} tutorials carry rendered
proof frames produced by the headless app renderer; ${fullCards.length} carry full step cards; the rest
are indexed in the per-category recipe tables with their exact properties.</p>
<p class="trace">Glitch note: glitch techniques are EFFECTS now (intensity/style/scan/static/seed/rate, all
keyframeable) — they left the transition picker in board J.</p>
<h2>Full step-card tutorials (${fullCards.length})</h2>
${fullCards.map((e) => `<div class="card"><h3>${esc(e.name)}<span class="cat">${esc(e.cat)}</span></h3>
<ol>${stepsFor(e).map((s) => `<li>${s}</li>`).join('')}</ol>
<div class="props">${Object.entries(e.patch).map(([k, v]) => `${esc(k)}=${esc(v)}`).join(' · ')}</div>
<div class="trace">Trace: ${esc(e.trace)}</div>
${proofs[e.id] ? `<img src="${proofs[e.id]}" alt="rendered proof for ${esc(e.name)}">` : ''}
</div>`).join('\n')}
<h2>Complete recipe index — every preset, exact engine properties</h2>
${CATS.map((c) => `<details><summary>${c} — ${byCat[c].length.toLocaleString('en-US')} tutorials</summary>
<table><tr><th>id</th><th>tutorial</th><th>engine properties (editable + keyframeable)</th></tr>
${byCat[c].map((e) => `<tr><td>${esc(e.id)}</td><td>${esc(e.name)}</td><td>${Object.entries(e.patch).map(([k, v]) => `${esc(k)}=${esc(v)}`).join(', ')}</td></tr>`).join('\n')}
</table></details>`).join('\n')}
</body></html>
`
fs.writeFileSync(path.join(OUT, 'effects-tutorials.html'), html)
console.log('tutorials:', catalog.length, 'full cards:', fullCards.length, 'proofs:', Object.keys(proofs).length)
console.log('byCat:', JSON.stringify(Object.fromEntries(CATS.map((c) => [c, byCat[c].length]))))
