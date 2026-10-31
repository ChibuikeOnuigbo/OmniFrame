/** OmniFrame new_glitch 5000-recipe batch runner (REBUILT 2026-10-30).
 *
 * WHY REBUILT: the original glitch_batch.mjs was never committed (untracked) and
 * rollback #8 wiped it. This reconstruction continues from checkpoint.json
 * (next=364) using the scheme reverse-engineered from the committed artifacts:
 *   - seed(n)      = 7919*n + 237                    (exact: verified n=13..363)
 *   - palette(n)   = PALETTES[floor((n-1)/100) % 4]   (exact: verified against b01xx/b02xx/b03xx)
 *   - bg(n)        = BGS[palette index]               (exact: #120d27/#160609/#091824/#0c160c)
 *   - family       = 'digital-slice'                  (all 183 kept entries are digital-slice)
 *   - ng params    = mulberry32(seed) through the documented ranges below.
 *     NOTE (honest): the ORIGINAL per-param rng draw order is not recoverable;
 *     the ranges bracket every historical value (lead .6-2.2, amp 10-40, ...).
 *     Versions >=364 are therefore deterministic-but-fresh derivations.
 *   - dedupe       = sha256 of the gray byte signature (48 frames x 15x12 grid,
 *     ffmpeg fps=12,scale=15:12,format=gray → 8640 bytes). A version is a dup
 *     only when its luma grid is byte-identical to an already-kept render.
 *     Keys live in sigkeys.json, SEEDED FROM THE 183 HISTORICAL MP4s with this
 *     same extractor, so cross-era dedupe is real. (The historical sigs.json
 *     float signatures used the ORIGINAL extractor, which this rebuild could
 *     not reproduce bit-exactly — it is frozen at 183 entries as an artifact;
 *     the first rebuild attempt deduped on 4-decimal quantisation of MY sigs
 *     and false-duped 97/98 of a slice — rolled back, hence this scheme.)
 *
 * NOTE: historical recipes contain clip_stretch{from:4,to:4} no-ops; the CURRENT
 * harness blanks the render when clip_stretch is called (bisected: 8KB blank vs
 * 98KB real), so the rebuild omits it — clips already span the 4s project.
 *
 * Renders via the UNIVERSAL MCP tool registry (tools/mcp/tools.mjs) — omniframe
 * law: the app engine produces every frame; render_export writes the mp4.
 * Usage: SLICE=100 node new_glitch/batch/glitch_batch.mjs   (ffmpeg on PATH)
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { execFileSync } from 'child_process'
import { registry, SESSION } from '../../tools/mcp/tools.mjs'

const ROOT = process.cwd()
const DIR = 'new_glitch/batch'
const CP = path.join(DIR, 'checkpoint.json')
const SIGS = path.join(DIR, 'sigs.json')
const TOTAL = 5000
const SLICE = Number(process.env.SLICE || 100)

const PALETTES = [['#a568ff', '#15e4f3'], ['#ff375f', '#eaf9ff'], ['#25d7fb', '#ff3ac2'], ['#a0ff3c', '#fffa8b']]
const BGS = ['#120d27', '#160609', '#091824', '#0c160c']
const FAMILY = 'digital-slice'

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const r1 = (v) => Math.round(v * 10) / 10
const r2 = (v) => Math.round(v * 100) / 100
const r3 = (v) => Math.round(v * 1000) / 1000

function ngParams(seed) {
  const rnd = mulberry32(seed)
  return {
    ngFamily: FAMILY, ngSeed: seed,
    ngLead: r1(0.6 + 1.6 * rnd()),        // 0.6..2.2 s
    ngAttack: r2(0.4 + 0.7 * rnd()),      // 0.4..1.1 s
    ngHold: r2(1.2 + 1.4 * rnd()),        // 1.2..2.6 s
    ngDecay: r2(0.6 + 1.0 * rnd()),       // 0.6..1.6 s
    ngSliceAmp: r1(10 + 30 * rnd()),      // 10..40 px
    ngSliceDensity: Math.round(5 + 20 * rnd()),   // 5..25 slices
    ngChroma: r1(3 + 12 * rnd()),         // 3..15 px split
    ngScanOpacity: r3(0.12 + 0.3 * rnd()),// .12..42
    ngScanSpacing: 3,
    ngNoise: r3(0.08 + 0.22 * rnd()),     // .08..30
    ngBlock: Math.round(12 + 43 * rnd()), // 12..55 px blocks
    ngBlockRate: r3(0.06 + 0.14 * rnd()), // .06..20
  }
}

/** 48 frames x (15x12 gray grid) = 8640 raw bytes; dedupe key = sha256(bytes) */
function lumaSigBytes(mp4) {
  const W = 15, H = 12
  const raw = execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', mp4,
    '-vf', `fps=12,scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 28 })
  const need = 48 * W * H
  if (raw.length < need) { const b = Buffer.alloc(need); raw.copy(b); return b } // short video guard
  return raw.subarray(0, need)
}
const sigKey = (buf) => crypto.createHash('sha256').update(buf).digest('hex')

async function call(tool, params) {
  const r = await registry.call(tool, params)
  if (!r.ok) throw new Error(`${tool} failed: ${JSON.stringify(r.data).slice(0, 200)}`)
  return r
}

async function renderVersion(n, palIdx) {
  const seed = 7919 * n + 237
  const [P, S] = PALETTES[palIdx]
  const bg = BGS[palIdx]
  const params = ngParams(seed)
  params.ngPrimary = P; params.ngSecondary = S
  const out = `${DIR}/b${String(n).padStart(4, '0')}_${FAMILY}.mp4`
  await call('project_new', { w: 480, h: 270, fps: 30, duration: 4, bg })
  const bgc = await call('new_background', { kind: 'studio' })
  await call('edit_element', { clipId: bgc.data.clipId, patch: { effects: { temp: -0.3, sat: 0.5 } } })
  const t2 = await call('create_text', { text: '◬', preset: 'plain', x: 0, y: -46 })
  await call('edit_element', { clipId: t2.data.clipId, patch: { textStyle: { fontSize: 54, color: P, glowColor: S, glowBlur: 14 } } })
  const t3 = await call('create_text', { text: 'OMNIFRAME', preset: 'plain', x: 0, y: 14 })
  await call('edit_element', { clipId: t3.data.clipId, patch: { textStyle: { fontSize: 34, bold: true, color: '#f4f6ff', letterSpacing: 2, glowColor: S, glowBlur: 8 } } })
  await call('fx_add', { clipId: t3.data.clipId, catalogId: 'ng-digital-slice', params })
  await call('fx_add', { clipId: t2.data.clipId, catalogId: 'ng-digital-slice', params })
  const rr = await call('render_export', { out, fps: 12, duration: 4 })
  fs.writeFileSync(path.join(ROOT, out.replace(/\.mp4$/, '.json')),
    JSON.stringify({ tool: rr.tool, ok: rr.ok, meta: rr.meta || {}, data: rr.data }, null, 1))
  return { seed, params, out }
}

// ---- main loop (crash-safe: checkpoint written after every version) ----
const cp = JSON.parse(fs.readFileSync(CP, 'utf8'))
const KEYS = path.join(DIR, 'sigkeys.json')
let keyStore
if (fs.existsSync(KEYS)) {
  keyStore = JSON.parse(fs.readFileSync(KEYS, 'utf8'))
} else {
  // first run: seed from the 183 historical kept mp4s using THIS extractor
  keyStore = { seededFrom: 'historical kept mp4s (183)', keys: [] }
  for (const k of cp.kept) {
    const p = path.join(ROOT, k.file)
    if (fs.existsSync(p)) keyStore.keys.push(sigKey(lumaSigBytes(p)))
  }
  console.log(`sigkeys seeded from ${keyStore.keys.length} historical renders`)
}
const seen = new Set(keyStore.keys)
let n = cp.next
const stop = Math.min(TOTAL, n + SLICE - 1)
console.log(`batch slice: ${n}..${stop} of ${TOTAL} (kept so far ${cp.kept.length})`)
for (; n <= stop; n++) {
  const palIdx = Math.floor((n - 1) / 100) % 4
  const t0 = Date.now()
  try {
    const { seed, out } = await renderVersion(n, palIdx)
    const mp4 = path.join(ROOT, out)
    const sha = crypto.createHash('sha256').update(fs.readFileSync(mp4)).digest('hex').slice(0, 16)
    const key = sigKey(lumaSigBytes(mp4))
    if (seen.has(key)) {
      fs.rmSync(mp4); fs.rmSync(mp4.replace(/\.mp4$/, '.json'))
      cp.dups.push(n)
    } else {
      seen.add(key)
      keyStore.keys.push(key)
      const [P, S] = PALETTES[palIdx]
      cp.kept.push({ n, id: `ng-${String(n).padStart(4, '0')}`, family: FAMILY, palette: `${P}/${S}`, seed, file: out, sha256_16: sha })
    }
  } catch (e) {
    cp.failed.push(n)
    console.error(`n=${n} FAILED: ${e.message}`)
  }
  cp.next = n + 1
  fs.writeFileSync(CP, JSON.stringify(cp))
  fs.writeFileSync(KEYS, JSON.stringify(keyStore))
  if (n % 10 === 0) console.log(`  n=${n} kept=${cp.kept.length} dups=${cp.dups.length} failed=${cp.failed.length} (${Date.now() - t0}ms)`)
}

// ---- manifest + continue.md refresh ----
const lines = cp.kept.map((k) => `| ${k.n} | ${k.id} | ${k.family} | ${k.palette} | ${k.seed} | [${path.basename(k.file)}](${k.file}) | ${k.sha256_16} |`)
fs.writeFileSync(path.join(DIR, 'batch-manifest.md'), `# New Glitch batch manifest (rendered + validated in-app)

Checkpoint: recipe ${cp.next} of ${TOTAL} queued next · kept ${cp.kept.length} · dup-skipped ${cp.dups.length} · failed ${cp.failed.length}

| # | recipe | family | palette | seed | file | sha256:16 |
|---|---|---|---|---|---|---|
${lines.join('\n')}
`)
let cont = fs.readFileSync('continue.md', 'utf8')
cont = cont.replace(/next=\d+/, `next=${cp.next}`).replace(/kept \d+/, `kept ${cp.kept.length}`)
fs.writeFileSync('continue.md', cont)
console.log(`SLICE DONE: next=${cp.next} kept=${cp.kept.length} dups=${cp.dups.length} failed=${cp.failed.length}`)
process.exit(0)
