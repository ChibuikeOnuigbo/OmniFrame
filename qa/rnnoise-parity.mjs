#!/usr/bin/env node
/**
 * RNNoise wasm parity + functional bar.
 *
 * Part 1 — BIT-EXACT PARITY: public/wasm/rnnoise.wasm (built by
 * scripts/build-rnnoise-wasm.sh with zig cc) must produce bit-identical
 * output to a NATIVE gcc build of the same vendored C sources on the
 * deterministic fixture qa/fixtures/rnnoise-parity-input.f32
 * (reference output: qa/fixtures/rnnoise-parity-ref.f32, produced by
 * qa/rnnoise-ref-driver.c — see its header for the exact build line).
 *
 * Part 2 — FUNCTIONAL BAR (same wasm, deterministic):
 *   a. fixture: speech-like segments preserved within 3 dB, noise-only
 *      segments suppressed by >= 18 dB (measured: -0.5 dB / -24.5 dB)
 *   b. real speech (qa/fixtures/test-audio-6s.ogg, decoded to 48 kHz mono)
 *      mixed with LCG white noise at 0 dB SNR: denoised-vs-clean SNR
 *      must improve by >= 8 dB at zero lag (the output is delay-aligned by
 *      dropping frame 0; measured: +13.2 dB)
 *
 * Run: node qa/rnnoise-parity.mjs
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const REPO = new URL('..', import.meta.url).pathname

let failures = 0
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

// ---------------------------------------------------------------------------
// frame loop — mirrors src/lib/rnnoise.ts denoiseSync() exactly
// ---------------------------------------------------------------------------
const FRAME = 480
const SCALE = 32768

async function denoise(wasmBytes, input) {
  const { instance } = await WebAssembly.instantiate(wasmBytes, {})
  const e = instance.exports
  const nFrames = Math.floor(input.length / FRAME)
  const out = new Float32Array((nFrames - 1) * FRAME)
  const st = e.rnnoise_create(0)
  const inPtr = e.malloc(FRAME * 4)
  const outPtr = e.malloc(FRAME * 4)
  let vadSum = 0
  try {
    for (let f = 0; f < nFrames; f++) {
      let dv = new DataView(e.memory.buffer)
      for (let i = 0; i < FRAME; i++) dv.setFloat32(inPtr + i * 4, input[f * FRAME + i] * SCALE, true)
      const vad = e.rnnoise_process_frame(st, outPtr, inPtr)
      dv = new DataView(e.memory.buffer)
      if (f > 0) {
        const base = (f - 1) * FRAME
        for (let i = 0; i < FRAME; i++) out[base + i] = dv.getFloat32(outPtr + i * 4, true) / SCALE
      }
      vadSum += vad
    }
  } finally {
    e.free(outPtr)
    e.free(inPtr)
    e.rnnoise_destroy(st)
  }
  return { out, meanVad: vadSum / nFrames }
}

const wasmBytes = readFileSync(`${REPO}/public/wasm/rnnoise.wasm`)
const fixtureIn = new Float32Array(readFileSync(`${REPO}/qa/fixtures/rnnoise-parity-input.f32`).buffer)
const ref = new Float32Array(readFileSync(`${REPO}/qa/fixtures/rnnoise-parity-ref.f32`).buffer)

console.log(`module: ${(wasmBytes.length / 1024).toFixed(0)} KB, fixture: ${fixtureIn.length} samples, ref: ${ref.length} samples`)

// ---- Part 1: bit-exact parity vs the native gcc reference -----------------
const { out, meanVad } = await denoise(wasmBytes, fixtureIn)
check(
  'parity: output length matches reference (frame-0 delay drop)',
  out.length === ref.length,
  `${out.length} vs ${ref.length}`,
)
let maxDiff = 0
for (let i = 0; i < Math.min(out.length, ref.length); i++) {
  const d = Math.abs(out[i] - ref[i])
  if (d > maxDiff) maxDiff = d
}
check('parity: bit-exact vs native gcc build', maxDiff === 0, `max|diff| = ${maxDiff.toExponential(2)}`)

// ---- Part 2a: fixture functional bar ---------------------------------------
const rms = (x) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length)
const spIn = [], spOut = [], nsIn = [], nsOut = []
for (let i = 0; i < out.length; i++) {
  const seg = Math.floor(i / 24000) % 2
  if (seg === 0) { spIn.push(fixtureIn[i]); spOut.push(out[i]) }
  else { nsIn.push(fixtureIn[i]); nsOut.push(out[i]) }
}
const spDb = 20 * Math.log10(rms(spOut) / rms(spIn))
const nsDb = 20 * Math.log10(rms(nsOut) / rms(nsIn))
check('fixture: speech segments preserved (>= -3 dB)', spDb >= -3, `${spDb.toFixed(2)} dB`)
check('fixture: noise segments suppressed (>= 18 dB)', -nsDb >= 18, `${nsDb.toFixed(2)} dB`)
check('fixture: model engaged (mean VAD > 0.3 on speech fixture)', meanVad > 0.3, `mean VAD ${meanVad.toFixed(3)}`)

// ---- Part 2b: real speech at 0 dB SNR --------------------------------------
// NOTE: qa/fixtures/test-audio-6s.ogg is MUSIC (grader: 0% speech / 80%
// music) — it must never be used as a speech source. The TTS fixture is
// real speech.
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
const tmp = `${REPO}/tmp`
import { mkdirSync } from 'node:fs'
mkdirSync(tmp, { recursive: true })
execFileSync(ffmpegPath, ['-i', `${REPO}/qa/assets/voice/tts-m1-numbers.mp3`, '-ar', '48000', '-ac', '1', '-f', 'f32le', '-y', `${tmp}/rnnoise-speech48k.f32`], { stdio: 'ignore' })
const clean = Array.from(new Float32Array(readFileSync(`${tmp}/rnnoise-speech48k.f32`).buffer))

// deterministic LCG white noise, 0 dB SNR (same generator the corpus scripts use)
let seed = 99
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x3fffffff - 1
}
const p = clean.reduce((s, v) => s + v * v, 0)
const nAmp = Math.sqrt(p / clean.length)
const mix = clean.map((v) => v + rnd() * nAmp)

const res = await denoise(wasmBytes, Float32Array.from(mix))
let sc = 0, se = 0, cnt = 0
for (let i = 48000; i < res.out.length - 48000; i++) {
  sc += clean[i] ** 2
  se += (res.out[i] - clean[i]) ** 2
  cnt++
}
const snrDb = 10 * Math.log10(sc / se)
check('real speech 0 dB mix: SNR vs clean improves >= 8 dB (lag 0)', snrDb >= 8, `${snrDb.toFixed(2)} dB (input was 0 dB by construction)`)

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
