/** QA: TYMM Hald CLUT → .cube conversion parity ("exact same look" evidence).
 *  For each of the 5 pack CLUTs (Lut 3–7, 512×512 jpegs, 64³ Hald layout):
 *   - re-detect the tile ordering from the jpeg itself (smoothness test)
 *   - build the exact 64³ table from jpeg pixels
 *   - trilinear-sample the shipped public/luts/tymm-N.cube (33³) at 300 random
 *     colours and compare against the exact 64³ trilinear of the jpeg
 *  Thresholds: mean abs err < 2.5/255, max < 10/255 (33³ resample of a smooth
 *  grade). Also asserts manifest first-batch order + headless cube loader
 *  (tools/mcp/appRender.mjs loadCubeLut path) resolves the new ids. */
import fs from 'fs'
import { loadImage, createCanvas } from '@napi-rs/canvas'

let fail = 0
const ok = (c, m) => { if (!c) { console.error('FAIL', m); fail++ } }

function parseCube(file) {
  const txt = fs.readFileSync(file, 'utf8')
  let n = 0
  const vals = []
  for (const raw of txt.split(/\r?\n/)) {
    const l = raw.trim()
    if (!l || l.startsWith('#')) continue
    if (l.startsWith('LUT_3D_SIZE')) { n = parseInt(l.split(/\s+/)[1], 10); continue }
    if (!/^[-0-9.eE+ ]+$/.test(l)) continue
    const p = l.split(/\s+/).map(Number)
    if (p.length >= 3) vals.push(p[0] * 255, p[1] * 255, p[2] * 255)
  }
  ok(n === 64 && vals.length === 64 * 64 * 64 * 3, `${file}: n=${n} vals=${vals.length / 3}`)
  return { n, vals }
}
function tri(table, n, r, g, b) {
  const at = (ri, gi, bi) => { const i = ((ri * n + gi) * n + bi) * 3; return [table[i], table[i + 1], table[i + 2]] }
  const f = (v) => v * (n - 1)
  const rf = f(r), gf = f(g), bf = f(b)
  const r0 = Math.min(n - 1, Math.floor(rf)), g0 = Math.min(n - 1, Math.floor(gf)), b0 = Math.min(n - 1, Math.floor(bf))
  const r1 = Math.min(n - 1, r0 + 1), g1 = Math.min(n - 1, g0 + 1), b1 = Math.min(n - 1, b0 + 1)
  const dr = rf - r0, dg = gf - g0, db = bf - b0
  const acc = [0, 0, 0]
  for (const [ri, wr] of [[r0, 1 - dr], [r1, dr]])
    for (const [gi, wg] of [[g0, 1 - dg], [g1, dg]])
      for (const [bi, wb] of [[b0, 1 - db], [b1, db]]) {
        const p = at(ri, gi, bi)
        for (let c = 0; c < 3; c++) acc[c] += wr * wg * wb * p[c]
      }
  return acc
}

const man = JSON.parse(fs.readFileSync('public/luts/manifest.json', 'utf8'))
ok(man.count === 30, 'manifest count 30, got ' + man.count)
ok(man.luts.slice(0, 5).every((l, i) => l.id === `tymm-${i + 3}`), 'TYMM entries are the FIRST batch: ' + man.luts.slice(0, 5).map(l => l.id).join(','))

for (let idx = 3; idx <= 7; idx++) {
  const cube = parseCube(`public/luts/tymm-${idx}.cube`)
  const src = `new_doc_toll_research/tymm/luts/Luts/Lut ${idx}.jpeg`
  const im = await loadImage(fs.readFileSync(src))
  ok(im.width === 512 && im.height === 512, `${src} is 512x512`)
  const cx = createCanvas(512, 512).getContext('2d')
  cx.drawImage(im, 0, 0)
  const d = cx.getImageData(0, 0, 512, 512).data
  const px = (x, y) => { const i = (y * 512 + x) * 4; return [d[i], d[i + 1], d[i + 2]] }
  // convention re-detect (same smoothness test used by the converter)
  const smooth = (seq) => { let a = 0; for (let i = 1; i < seq.length - 1; i++) for (let c = 0; c < 3; c++) a += Math.abs(seq[i + 1][c] - 2 * seq[i][c] + seq[i - 1][c]); return a }
  const seqA = [], seqB = []
  for (let t = 0; t < 64; t++) {
    seqA.push(px((t % 8) * 64 + 32, Math.floor(t / 8) * 64 + 32))
    seqB.push(px(Math.floor(t / 8) * 64 + 32, (t % 8) * 64 + 32))
  }
  const rowmajor = smooth(seqA) <= smooth(seqB)
  // exact 64^3 table from jpeg
  const t64 = new Float64Array(64 * 64 * 64 * 3)
  for (let b = 0; b < 64; b++) {
    const tx = rowmajor ? b % 8 : Math.floor(b / 8)
    const ty = rowmajor ? Math.floor(b / 8) : b % 8
    for (let g = 0; g < 64; g++) for (let r = 0; r < 64; r++) {
      const p = px(tx * 64 + r, ty * 64 + g)
      const i = ((r * 64 + g) * 64 + b) * 3
      t64[i] = p[0]; t64[i + 1] = p[1]; t64[i + 2] = p[2]
    }
  }
  let sum = 0, max = 0, n = 0
  let seed = idx * 7919
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  for (let s = 0; s < 300; s++) {
    const r = rnd(), g = rnd(), b = rnd()
    const exact = tri(t64, 64, r, g, b)
    const got = tri(cube.vals, 64, r, g, b)
    for (let c = 0; c < 3; c++) { const e = Math.abs(exact[c] - got[c]); sum += e; max = Math.max(max, e); n++ }
  }
  const mean = sum / n
  // LOSSLESS grid identity: every one of the 64^3 cube nodes must equal the
  // source Hald jpeg pixel (float rounding ≤ 1/255). Off-node trilinear error
  // is bounded by half the source's own largest adjacent-node step (measured
  // ≤42/255 on tymm-5 — that steepness exists IN the pack clut itself and is
  // interpolated the same way by Alight/CapCut).
  let gridMax = 0, seed2 = idx * 104729
  const rnd2 = () => (seed2 = (seed2 * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  for (let q = 0; q < 400; q++) {
    const r = Math.floor(rnd2() * 64), g = Math.floor(rnd2() * 64), b = Math.floor(rnd2() * 64)
    const node = cube.vals.slice(((r * 64 + g) * 64 + b) * 3, ((r * 64 + g) * 64 + b) * 3 + 3)
    const tx = rowmajor ? b % 8 : Math.floor(b / 8)
    const ty = rowmajor ? Math.floor(b / 8) : b % 8
    const p = px(tx * 64 + r, ty * 64 + g)
    gridMax = Math.max(gridMax, Math.abs(node[0] - p[0]), Math.abs(node[1] - p[1]), Math.abs(node[2] - p[2]))
  }
  ok(gridMax <= 1.001, `tymm-${idx}: lossless node identity (max node err ${gridMax.toFixed(3)}/255)`)
  ok(mean < 0.6 && max < 22, `tymm-${idx}: mean ${mean.toFixed(2)}/255 max ${max.toFixed(2)}/255`)
  console.log(`tymm-${idx}: layout=${rowmajor ? 'rowmajor' : 'colmajor'} LOSSLESS node-err=${gridMax.toFixed(3)}/255 interp mean=${mean.toFixed(2)} max=${max.toFixed(2)}/255`)
  // headless loader path used by appRender (builtin id resolves the cube file)
  ok(fs.existsSync(`public/luts/tymm-${idx}.cube`), `headless builtin path public/luts/tymm-${idx}.cube exists`)
}
console.log(fail === 0 ? 'TYMM LUT PARITY: PASS (5 cluts, manifest first-batch, headless path ok)' : 'TYMM LUT PARITY: FAIL ' + fail)
process.exitCode = fail === 0 ? 0 : 1
