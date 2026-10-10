#!/usr/bin/env node
/**
 * Chunked-separation parity — proves the WASM-fallback chunked pass runner
 * (src/lib/demucs/index.ts#runChunkedPassInWorker, math in chunked.js) is
 * EXACTLY equivalent to the vendored full-track overlap-add
 * (src/lib/demucs/apply.js#separateTracks with overlap 0.25).
 *
 * The runner exists because the onnxruntime-web WASM heap only frees on
 * worker termination: multi-chunk tracks crash without WebGPU, so each chunk
 * runs in its own throwaway worker (overlap 0 inside — one internal chunk)
 * and the host re-assembles. This test isolates the re-assembly math with a
 * deterministic MOCK model (no browser, no 174 MB weights, no memory spike):
 *
 *   reference : separateTracks(mock, fullTrack, cb, 0.25)   — vendored path
 *   chunked   : per-chunk separateTracks(mock, slice, cb, 0) — worker path
 *               + triangleWeights/accumulateChunk/normalizeChunked (chunked.js)
 *
 * The mock's stems are per-stem functions of the input samples (including
 * the reflect-padding), so any grid/weight/normalization difference between
 * the two paths shows up as a sample-level diff. PASS bar: max|diff| <=
 * 1e-6 (pure reordering of float ops).
 *
 * Run: node qa/demucs-chunked-parity.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { separateTracks } from '../src/lib/demucs/apply.js'
import { triangleWeights, accumulateChunk, normalizeChunked } from '../src/lib/demucs/chunked.js'

const SR = 44100
const SOURCES = ['drums', 'bass', 'other', 'vocals']
const SEGMENT = Math.floor(7.8 * SR) // 343,980 — the fixed ONNX input length
const OVERLAP = 0.25
const failures = []
const checks = []
let pass = 0
const check = (name, ok, detail = '') => {
  const line = `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`
  console.log(line)
  checks.push({ name, ok, detail })
  if (ok) pass++
  else failures.push(name)
}

// ---- deterministic mock model (same contract as ONNXHTDemucs) -----------
// stems[s][c][t] = (s + 1) * mix[c][t] — distinguishable per stem AND
// per channel, and dependent on the exact padded input the chunk sees.
const trainingLength = SEGMENT
const mockModel = {
  sources: SOURCES,
  samplerate: SR,
  segment: 7.8,
  validLength(length) {
    if (trainingLength < length) throw new Error(`length ${length} > training length`)
    return trainingLength
  },
  async forward(mix, magspec) {
    const [B, C, T] = mix.shape
    const [mb, mc, Fr, Tm] = magspec.shape
    const S = SOURCES.length
    // spectral branch: zeros. C=4 -> mask() -> zout [B, S, 2, Fr, Tm]
    // (stereo complex) -> ispec -> timeFromSpec [B, S, 2, trainingLength]
    const outX = { data: new Float32Array(B * S * 4 * Fr * Tm), shape: [B, S, 4, Fr, Tm] }
    // time branch: per-stem scaled copies of the (padded) input, shape
    // [B, S, 2, T] to match timeFromSpec in addTensors
    const outXt = { data: new Float32Array(B * S * 2 * T), shape: [B, S, 2, T] }
    for (let b = 0; b < B; b++) {
      for (let s = 0; s < S; s++) {
        for (let c = 0; c < 2; c++) {
          for (let t = 0; t < T; t++) {
            const src = mix.data[b * C * T + c * T + t]
            outXt.data[b * S * 2 * T + s * 2 * T + c * T + t] = (s + 1) * src
          }
        }
      }
    }
    return { outX, outXt }
  },
}

// ---- test track: 12 s stereo (3 chunks on the 0.25-overlap grid) --------
const SECONDS = 12
const N = SECONDS * SR
const L = new Float32Array(N)
const R = new Float32Array(N)
let seed = 42
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x3fffffff - 1 }
for (let i = 0; i < N; i++) {
  L[i] = 0.3 * Math.sin(2 * Math.PI * 220 * i / SR) + 0.1 * rnd()
  R[i] = 0.25 * Math.sin(2 * Math.PI * 331 * i / SR + 0.5) + 0.1 * rnd()
}

// ---- reference: the vendored full-track path ----------------------------
const t0 = Date.now()
const ref = await separateTracks(mockModel, { channelData: [L, R], sampleRate: SR }, null, OVERLAP)
const refMs = Date.now() - t0
check('reference: 4 stems at full length',
  Object.keys(ref).length === 4 && ref.vocals.channelData[0].length === N,
  `${Object.keys(ref).join(',')} len ${ref.vocals.channelData[0].length}`)

// sanity: the mock actually separates (stems differ per source)
let stemDelta = 0
for (let i = 0; i < N; i++) {
  stemDelta = Math.max(stemDelta, Math.abs(ref.drums.channelData[0][i] - ref.vocals.channelData[0][i]))
}
check('reference: stems are per-source distinct (mock sanity)', stemDelta > 0.1, `max|drums−vocals| ${stemDelta.toFixed(3)}`)

// ---- chunked: the runner's math, one "worker" per chunk -----------------
const stride = Math.floor((1 - OVERLAP) * SEGMENT)
const weight = triangleWeights(SEGMENT)
check('triangleWeights: peak 1.0 at the center, ~0 at both ends',
  Math.abs(weight[Math.floor(SEGMENT / 2)] - 1) < 1e-6 && weight[0] < 1e-5 && weight[SEGMENT - 1] < 1e-5,
  `w[0] ${weight[0].toExponential(2)} w[mid] ${weight[SEGMENT / 2].toFixed(6)} w[end] ${weight[SEGMENT - 1].toExponential(2)}`)

const acc = {}
for (const name of SOURCES) acc[name] = [new Float32Array(N), new Float32Array(N)]
const sumWeight = new Float32Array(N)
let chunks = 0
let offset = 0
while (offset < N) {
  const end = Math.min(offset + SEGMENT, N)
  const slice = [L.slice(offset, end), R.slice(offset, end)]
  // the worker runs separateTracks with overlap 0 on just this slice
  const stems = await separateTracks(mockModel, { channelData: slice, sampleRate: SR }, null, 0)
  accumulateChunk(acc, sumWeight, offset, stems, weight)
  offset += stride
  chunks++
}
normalizeChunked(acc, sumWeight)
check(`chunked: ${chunks} chunks cover the track (12 s on the 5.85 s stride grid)`, chunks === 3, `${chunks} chunks, stride ${(stride / SR).toFixed(2)} s`)

// ---- the equivalence -----------------------------------------------------
let maxDiff = 0
let worst = ''
for (const name of SOURCES) {
  for (let c = 0; c < 2; c++) {
    const a = acc[name][c]
    const b = ref[name].channelData[c]
    for (let i = 0; i < N; i++) {
      const d = Math.abs(a[i] - b[i])
      if (d > maxDiff) { maxDiff = d; worst = `${name}[${c}]@${i}` }
    }
  }
}
check('chunked accumulation === full-track separateTracks (max|diff| <= 1e-6)',
  maxDiff <= 1e-6, `max|diff| ${maxDiff.toExponential(2)} at ${worst}, reference ${refMs} ms`)

// sumWeight sanity: interior samples never fall to ~0 (no normalization
// blow-up mid-track). The triangle profile dips to ~0.5 exactly at chunk
// boundaries (previous chunk's tail weight) and peaks ~1.5 a quarter in.
const lastOffset = (chunks - 1) * stride
let minInterior = Infinity
for (let i = stride; i < lastOffset; i++) minInterior = Math.min(minInterior, sumWeight[i])
check('overlap-add: interior samples keep >= 0.4 accumulated weight',
  minInterior > 0.4, `min interior sumWeight ${minInterior.toFixed(3)}`)

const report = {
  when: new Date().toISOString(),
  test: 'demucs-chunked-parity',
  claim: 'per-chunk workers + host overlap-add === vendored full-track applySplits',
  seconds: SECONDS,
  chunks,
  checks: failures.length === 0 ? 'ALL PASS' : `${failures.length} FAIL: ${failures.join(', ')}`,
}
mkdirSync('qa/reports', { recursive: true })
writeFileSync('qa/reports/demucs-chunked-parity.json', JSON.stringify({ ...report, checks_detail: checks }, null, 2))
console.log(`\nRESULT ${pass}/${checks.length} ${failures.length === 0 ? 'PASS' : 'FAIL'} — report: qa/reports/demucs-chunked-parity.json`)
process.exit(failures.length === 0 ? 0 : 1)
