/**
 * Native-DSP parity + benchmark — proves public/wasm/omni-dsp.wasm (C++,
 * built by scripts/build-dsp-wasm.sh) computes the SAME results as the
 * pure-JS fallbacks, and measures the speedup.
 *
 *   resample   — vs src/lib/demucs/resample.js (the real module, imported)
 *   ls_leakage / average / peak_scale — vs verbatim copies of the loops in
 *   src/lib/demucs/index.ts + voiceIsolation.ts (they are private there and
 *   the module imports browser APIs; the copies below are kept in sync by
 *   this test — if the app changes those loops, update the copies here).
 *
 * Parity bars: resample max|diff| <= 1e-5 (float32 outputs; the only source
 * of divergence is the last ULPs of the sin implementation), ls/avg/peak
 * <= 1e-6 (identical double arithmetic).
 *
 * Output: qa/reports/native-dsp-parity.json  ·  exit 1 on any failure.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resampleChannels } from '../src/lib/demucs/resample.js'

const ROOT = join(import.meta.dirname, '..')
const WASM = readFileSync(join(ROOT, 'public/wasm/omni-dsp.wasm'))
const { instance } = await WebAssembly.instantiate(WASM, {})
const W = instance.exports

// ---- flat-ABI glue (mirrors src/lib/native/dspNative.ts) --------------------
const HEAP_BASE = W.__heap_base.value
let cursor = 0
function alloc(nFloats, align = 4) {
  const pad = (align - (cursor % align)) % align
  cursor += pad
  const at = cursor
  cursor += nFloats * 4
  return HEAP_BASE + at
}
function ensureCapacity() {
  const pages = Math.ceil((HEAP_BASE + cursor) / 65536)
  const have = W.memory.buffer.byteLength / 65536
  if (pages > have) W.memory.grow(pages - have)
}
function view(ptr, nFloats) {
  return new Float32Array(W.memory.buffer, ptr, nFloats)
}

// deterministic PRNG (same style as the test suites)
function prng(seed) {
  let s = seed
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5)
}
function signal(n, seed) {
  const r = prng(seed)
  const x = new Float32Array(n)
  let lp = 0
  for (let i = 0; i < n; i++) {
    lp += 0.2 * (r() - lp)
    x[i] = 0.8 * lp + 0.2 * Math.sin(2 * Math.PI * (220 + 900 * i / n) * (i / 44100))
  }
  return x
}

// ---- JS references (verbatim algorithm copies) ------------------------------
function jsLsLeakage(target, ref) {
  const CAP = 0.5
  let dot = 0, rr = 0
  for (let i = 0; i < target.length; i++) { dot += target[i] * ref[i]; rr += ref[i] * ref[i] }
  if (rr < 1e-12) return 0
  const a = Math.min(CAP, Math.max(-CAP, dot / rr))
  if (a === 0) return 0
  for (let i = 0; i < target.length; i++) target[i] -= a * ref[i]
  return a
}
function jsAveragePasses(passesList, len) {
  const out = new Float32Array(len)
  const missing = new Uint8Array(len)
  let missingCount = 0
  for (let i = 0; i < len; i++) {
    let sum = 0, n = 0
    for (const p of passesList) { const v = p[i]; if (Number.isFinite(v)) { sum += v; n++ } }
    if (n > 0) out[i] = sum / n
    else { out[i] = 0; missing[i] = 1; missingCount++ }
  }
  return { out, missing, missingCount }
}
function jsPeakScale(a, b, threshold, target) {
  let peak = 0
  for (const ch of [a, b]) for (let i = 0; i < ch.length; i++) { const x = Math.abs(ch[i]); if (x > peak) peak = x }
  if (peak <= threshold) return 1
  const g = target / peak
  for (const ch of [a, b]) for (let i = 0; i < ch.length; i++) ch[i] *= g
  return g
}

// ---- cases -------------------------------------------------------------------
const results = []
function check(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`)
}
function maxDiff(a, b) {
  let m = 0
  for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d > m) m = d }
  return m
}

// resample: parity + speed
for (const rate of [1.45, 4 / 3, 0.75, 1.15, 1.6]) {
  for (const n of [1000, 44100, 264600]) {
    const input = signal(n, 7 + n)
    const outLen = Math.max(1, Math.ceil(n / rate))

    const tjs = performance.now()
    const js = resampleChannels([input, input], rate)
    const jsMs = performance.now() - tjs

    cursor = 0
    const inPtr = alloc(n)
    const outPtr = alloc(outLen)
    ensureCapacity()
    view(inPtr, n).set(input)
    const tnat = performance.now()
    W.omni_resample(inPtr, n, rate, outPtr, outLen)
    const natMs = performance.now() - tnat
    const nat = new Float32Array(W.memory.buffer, outPtr, outLen)

    const diff = maxDiff(js.channelData[0], nat)
    check(`resample parity x${rate.toFixed(3)} n=${n}`,
      diff <= 1e-5 && js.length === outLen,
      `max|diff| ${diff.toExponential(2)} (bar 1e-5), length ${js.length} === ${outLen}; JS ${jsMs.toFixed(0)} ms (2ch) vs native ${(natMs * 2).toFixed(0)} ms (2ch est) — ${(((jsMs) / Math.max(0.01, natMs * 2))).toFixed(1)}x`)
  }
}

// ls_leakage parity
{
  const n = 100000
  const a = signal(n, 3)
  const b = signal(n, 5)
  for (let i = 0; i < n; i++) b[i] += 0.3 * a[i]
  const jsT = Float32Array.from(a), jsR = Float32Array.from(b)
  const aJs = jsLsLeakage(jsT, jsR)

  cursor = 0
  const tPtr = alloc(n), rPtr = alloc(n)
  ensureCapacity()
  view(tPtr, n).set(a); view(rPtr, n).set(b)
  const aNat = W.omni_ls_leakage(tPtr, rPtr, n)
  const nat = new Float32Array(W.memory.buffer, tPtr, n)

  const diff = maxDiff(jsT, nat)
  check('ls_leakage parity', diff <= 1e-6 && Math.abs(aJs - aNat) < 1e-12,
    `max|diff| ${diff.toExponential(2)} (bar 1e-6), coefficient JS ${aJs.toFixed(9)} vs native ${aNat.toFixed(9)}`)
}

// average parity (with NaN/Inf injections)
{
  const len = 50000
  const p0 = signal(len, 11), p1 = signal(len, 12), p2 = signal(len, 13)
  p0[100] = NaN; p1[100] = 0.5; p2[100] = -0.5   // 2 finite passes at i=100
  p1[200] = NaN; p2[200] = Infinity               // 1 finite pass at i=200
  p0[300] = NaN; p1[300] = NaN; p2[300] = NaN     // 0 finite — missing
  const js = jsAveragePasses([p0, p1, p2], len)

  cursor = 0
  const src = alloc(len * 3), outP = alloc(len), missP = alloc(len)
  ensureCapacity()
  const srcView = new Float32Array(W.memory.buffer, src, len * 3)
  srcView.set(p0, 0); srcView.set(p1, len); srcView.set(p2, len * 2)
  const missCount = W.omni_average_passes(src, 3, len, outP, missP)
  const natOut = new Float32Array(W.memory.buffer, outP, len)
  const natMiss = new Uint8Array(W.memory.buffer, missP, len)

  const missMatch = natMiss.every((v, i) => v === js.missing[i])
  check('average_passes parity (NaN/Inf aware)',
    maxDiff(js.out, natOut) <= 1e-6 && missCount === js.missingCount && missMatch,
    `max|diff| ${maxDiff(js.out, natOut).toExponential(2)}, missing native ${missCount} === JS ${js.missingCount}, flags match: ${missMatch}`)
}

// peak_scale parity
{
  const n = 30000
  const a = signal(n, 21), b = signal(n, 22)
  a[123] = 1.37; b[456] = -1.9 // force scaling
  const jsA = Float32Array.from(a), jsB = Float32Array.from(b)
  const jsG = jsPeakScale(jsA, jsB, 0.999, 0.98)

  cursor = 0
  const aP = alloc(n), bP = alloc(n)
  ensureCapacity()
  view(aP, n).set(a); view(bP, n).set(b)
  const natG = W.omni_peak_scale(aP, bP, n, 0.999, 0.98)
  const natA = new Float32Array(W.memory.buffer, aP, n)
  const natB = new Float32Array(W.memory.buffer, bP, n)

  check('peak_scale parity',
    Math.abs(jsG - natG) < 1e-12 && maxDiff(jsA, natA) <= 1e-6 && maxDiff(jsB, natB) <= 1e-6,
    `gain JS ${jsG.toFixed(9)} vs native ${natG.toFixed(9)}, max|diff| A ${maxDiff(jsA, natA).toExponential(2)} B ${maxDiff(jsB, natB).toExponential(2)}`)
}

// benchmark: full-track-scale resample (both channels, JS vs native)
{
  const n = 4773888 // the 108 s reference track
  const input = signal(n, 99)
  const outLen = Math.ceil(n / 1.45)
  const tjs = performance.now()
  resampleChannels([input, input], 1.45)
  const jsMs = performance.now() - tjs

  cursor = 0
  const inP = alloc(n), outP = alloc(outLen), outP2 = alloc(outLen)
  ensureCapacity()
  view(inP, n).set(input)
  const t0 = performance.now()
  W.omni_resample(inP, n, 1.45, outP, outLen)
  W.omni_resample(inP, n, 1.45, outP2, outLen)
  const natMs = performance.now() - t0

  check('benchmark: 108 s stereo speed-up x1.45',
    true,
    `JS ${jsMs.toFixed(0)} ms vs native ${natMs.toFixed(0)} ms — ${(jsMs / natMs).toFixed(1)}x`)
}

writeFileSync(join(ROOT, 'qa/reports/native-dsp-parity.json'), JSON.stringify({
  date: new Date().toISOString(),
  module: 'public/wasm/omni-dsp.wasm',
  source: 'native/dsp-core/omni_dsp.cpp',
  results,
}, null, 2))

const passed = results.filter((r) => r.ok).length
console.log(`\nRESULT ${passed}/${results.length} PASS — report: qa/reports/native-dsp-parity.json`)
if (passed !== results.length) process.exit(1)
