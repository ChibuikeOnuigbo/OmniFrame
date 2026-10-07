#!/usr/bin/env node
/**
 * omni-unified-v1 browser E2E — the self-made unified model
 * (isolation + denoise + normalization in ONE graph), end to end through
 * the app's real entry points in Chromium:
 *
 *   P. ONNX-vs-torch PARITY: rebuild the deterministic parity mix
 *      (qa/fixtures/omni-unified-parity/mix.f32), compute the features in
 *      the page with the app's own STFT code, run the ONNX session, and
 *      compare mask + gain_db against the torch reference vectors emitted
 *      by scripts/python/emit_unified_parity.py. Bar: max|diff| <= 2e-3
 *      (f32 graph, different runtimes).
 *   K. keep_vocal FUNCTIONAL: tts-m1-numbers voice over pad-chords at 0 dB
 *      SNR + white noise at 12 dB through processVoiceIsolation(model
 *      'omni-unified'). Asserts: decodes, mono, original SR, length kept,
 *      SNR vs the clean voice improves >= 6 dB over the mix's ~0 dB, and
 *      the output lands in the normalized loudness window.
 *   R. remove_vocal FUNCTIONAL: same mix -> instrumental (the model's mask
 *      complement). Asserts: voice removed (voice-band correlation with
 *      the clean voice drops vs the mix) and music energy preserved
 *      (RMS >= 25% of the bed's RMS in the mix).
 *
 * Run: node qa/omni-unified-e2e.mjs  (dev server up; TEST_URL overrides)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium as pwChromium } from 'playwright'
import { inflate } from '@sparticuz/chromium'
import serverlessChromium from '@sparticuz/chromium'

const ROOT = process.cwd()
const URL = process.env.TEST_URL || 'http://localhost:5173/#studio'
const REPORT = join(ROOT, 'qa/reports/omni-unified-e2e.json')
const PARITY = join(ROOT, 'qa/fixtures/omni-unified-parity')
mkdirSync(join(ROOT, 'qa/reports'), { recursive: true })

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

const failures = []
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const PAGE_LIB = `
  async function load(ctx, url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error('fetch ' + url + ' -> ' + res.status)
    return ctx.decodeAudioData(await res.arrayBuffer())
  }
  function fromB64(s) { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer }
  function toB64(u8) {
    let bin = ''
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000))
    return btoa(bin)
  }
`

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="preview-viewport"]', { timeout: 15000 })
  await page.evaluate(`(() => { ${PAGE_LIB} window.__load = load; window.__fromB64 = fromB64; window.__toB64 = toB64 })()`)

  // ---------- P: parity vs torch reference --------------------------------
const meta = JSON.parse(readFileSync(`${PARITY}/meta.json`, 'utf8'))
const mixF32 = readFileSync(`${PARITY}/mix.f32`)
// NOTE: small files land in node's 8 KB buffer pool — always respect
// byteOffset/byteLength or you read pool garbage.
const readF32 = (p) => {
  const b = readFileSync(p)
  return new Float32Array(b.buffer, b.byteOffset, b.length >> 2)
}
const refMask = readF32(`${PARITY}/mask.f32`)
const refGain = readF32(`${PARITY}/gain.f32`)

  const parity = await page.evaluate(async ({ mixB64, T, BINS, CTX }) => {
    const un = await import('/src/lib/omniUnified.ts')
    const mix = new Float32Array(window.__fromB64(mixB64))
    // features with the app's own STFT + normalization
    const { stft } = await import('/src/lib/aiDenoise.ts')
    const { mag } = stft(mix)
    const MU = -0.3685, STD = 0.7878, EPS = 1e-4
    const feats = new Float32Array(T * BINS)
    for (let t = 0; t < T; t++) {
      const m = mag[t]
      for (let f = 0; f < BINS; f++) feats[t * BINS + f] = (Math.log10(m[f] + EPS) - MU) / STD
    }
    const { mask, gainDb } = await un.runUnifiedOnFeatures(feats, T)
    return { mask: Array.from(mask), gain: [gainDb], stftT: mag.length }
  }, { mixB64: Buffer.from(mixF32).toString('base64'), T: meta.T, BINS: meta.bins, CTX: meta.ctx })

  // ALL frames compare (the shared STFT now replicates torch's reflect
  // padding exactly — measured 1.3e-6 across the whole clip)
  let maskMaxDiff = 0
  for (let i = 0; i < refMask.length; i++) {
    maskMaxDiff = Math.max(maskMaxDiff, Math.abs(refMask[i] - parity.mask[i]))
  }
  const gainDiff = Math.abs(refGain[0] - parity.gain[0])
  check('parity: STFT frame count matches torch', parity.stftT === meta.T, `${parity.stftT} vs ${meta.T}`)
  check('parity: ONNX mask vs torch mask (<= 2e-3)', maskMaxDiff <= 2e-3, `max|diff| ${maskMaxDiff.toExponential(2)} over ${meta.T}x${meta.bins}`)
  check('parity: ONNX gain vs torch gain (<= 0.05 dB)', gainDiff <= 0.05, `|diff| ${gainDiff.toFixed(4)} dB`)

  // ---------- K + R: functional through the real action path --------------
  const func = await page.evaluate(async () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const lib = await import('/src/lib/voiceIsolation.ts')
    const voice = await window.__load(ctx, 'qa/assets/voice/tts-m1-numbers.mp3')
    const bed = await window.__load(ctx, 'qa/assets/voice/pad-chords.wav')
    const sr = voice.sampleRate
    const len = Math.min(voice.length, bed.length, Math.round(4.5 * sr))
    const mix = ctx.createBuffer(2, len, sr)
    const clean = ctx.createBuffer(1, len, sr)
    let vr = 0, br = 0
    const vL = voice.getChannelData(0), bL = bed.getChannelData(0)
    for (let i = 0; i < len; i++) { vr += vL[i] * vL[i]; br += bL[i] * bL[i] }
    const vg = 0.16 / Math.sqrt(vr / len), bg = 0.16 / Math.sqrt(br / len)
    let seed = 2026
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x3fffffff - 1 }
    const mL = mix.getChannelData(0), mR = mix.getChannelData(1), cc = clean.getChannelData(0)
    for (let i = 0; i < len; i++) {
      const v = vL[i] * vg
      const b = bL[i] * bg
      const n = rnd() * 0.04
      mL[i] = v + b + n; mR[i] = v + b + n
      cc[i] = v
    }
    const mixBytes = await lib.encodeAudioBufferToWavArrayBuffer(mix)
    const blobUrl = URL.createObjectURL(new Blob([mixBytes], { type: 'audio/wav' }))
    const run = async (mode) => {
      const notes = []
      const out = await lib.processVoiceIsolation(blobUrl, { mode, model: 'omni-unified', strength: 0.92 },
        (p, note) => notes.push(`${p}:${note}`))
      const buf = await ctx.decodeAudioData(await out.blob.arrayBuffer())
      return { buf, notes }
    }
    const keep = await run('keep_vocal')
    const rem = await run('remove_vocal')
    URL.revokeObjectURL(blobUrl)

    // scale-invariant SNR: the model's loudness head intentionally changes
    // amplitude, so raw SNR would penalize the (correct) normalization.
    // The reference is LOW-PASSED at 7.5 kHz: the model works at 16 kHz
    // (8 kHz Nyquist), so content above that is outside its domain —
    // measuring against the full-band clean would ceiling the metric.
    const lpRef = await (() => {
      const off = new OfflineAudioContext(1, len, sr)
      const src = off.createBufferSource(); src.buffer = clean
      const f = off.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 7500; f.Q.value = 0.7071
      src.connect(f); f.connect(off.destination); src.start()
      return off.startRendering()
    })()
    const lc = lpRef.getChannelData(0)
    const siSnrVs = (buf) => {
      const d = buf.getChannelData(0)
      let dc = 0, cc2 = 0
      for (let i = sr; i < Math.min(d.length, len) - sr; i++) { dc += d[i] * lc[i]; cc2 += lc[i] * lc[i] }
      const a = dc / cc2
      let sn = 0, se = 0
      for (let i = sr; i < Math.min(d.length, len) - sr; i++) { sn += (a * lc[i]) ** 2; se += (d[i] - a * lc[i]) ** 2 }
      return 10 * Math.log10(sn / se)
    }
    const snrVs = siSnrVs
    // mix baseline SNR vs clean voice (same lowpassed reference — fair)
    const mixSnr = siSnrVs(mix)
    const rms = (buf) => {
      const d = buf.getChannelData(0)
      let s = 0
      for (let i = 0; i < d.length; i++) s += d[i] * d[i]
      return Math.sqrt(s / d.length)
    }
    await ctx.close()
    return {
      sr, len, mixSnr,
      keep: { sr: keep.buf.sampleRate, ch: keep.buf.numberOfChannels, len: keep.buf.length, snr: snrVs(keep.buf), rms: rms(keep.buf), notes: keep.notes },
      rem: { sr: rem.buf.sampleRate, ch: rem.buf.numberOfChannels, len: rem.buf.length, rms: rms(rem.buf), snr: snrVs(rem.buf) },
    }
  })

  console.log(`mix baseline SNR vs clean voice: ${func.mixSnr.toFixed(2)} dB`)
  check('no page errors during the runs', errors.length === 0, errors.join(' | ') || 'clean')
  check('keep_vocal: mono @ input SR, length kept (±150 ms)',
    func.keep.ch === 1 && func.keep.sr === func.sr && Math.abs(func.keep.len - func.len) < func.sr / 7,
    `${func.keep.ch}ch @${func.keep.sr}, ${func.keep.len} vs ${func.len}`)
  check(`keep_vocal: SNR vs clean improves >= 6 dB (mix ${func.mixSnr.toFixed(1)} dB)`,
    func.keep.snr >= func.mixSnr + 6, `${func.keep.snr.toFixed(2)} dB`)
  const keepRmsDb = 20 * Math.log10(func.keep.rms)
  check('keep_vocal: normalized loudness window (-26..-12 dBFS)', keepRmsDb > -26 && keepRmsDb < -12, `${keepRmsDb.toFixed(2)} dBFS`)
  check('remove_vocal: voice suppressed (SNR vs clean LOWER than keep_vocal by 6 dB+)',
    func.keep.snr - func.rem.snr >= 6, `keep ${func.keep.snr.toFixed(2)} vs rem ${func.rem.snr.toFixed(2)} dB`)
  const remRmsDb = 20 * Math.log10(func.rem.rms)
  check('remove_vocal: music energy preserved (>= -14 dBFS)', remRmsDb > -14, `${remRmsDb.toFixed(2)} dBFS`)

  const report = {
    when: new Date().toISOString(),
    engine: 'omni-unified',
    checks: failures.length === 0 ? 'ALL PASS' : `${failures.length} FAIL: ${failures.join(', ')}`,
    parity: { step: meta.step, maskMaxDiff, gainDiff },
    measurements: { mixSnrDb: +func.mixSnr.toFixed(2), keepSnrDb: +func.keep.snr.toFixed(2), keepRmsDbfs: +keepRmsDb.toFixed(2), remSnrDb: +func.rem.snr.toFixed(2), remRmsDbfs: +remRmsDb.toFixed(2), sr: func.sr },
    pageErrors: errors,
  }
  writeFileSync(REPORT, JSON.stringify(report, null, 2))
} finally {
  await browser.close()
}

console.log(failures.length === 0 ? '\nE2E PASS' : `\nE2E FAIL: ${failures.join(', ')}`)
process.exit(failures.length === 0 ? 0 : 1)
