/**
 * Voice isolation — REAL neural model E2E (Demucs v4 / htdemucs).
 *
 * Proves, end-to-end through the app's own UI, that the `htdemucs-v4` engine
 * performs genuine neural source separation:
 *
 *   1. rebuilds the deterministic showcase mix (TTS narration + full-band
 *      music bed, 0 dB SNR) together with its clean ground-truth stems
 *      (qa/voice-build-clean-stems.mjs)
 *   2. drives the REAL UI: select the clip, open Voice Isolation, pick the
 *      "Demucs v4 · real neural" model, click "Isolate Audio Track"
 *   3. downloads the produced asset and scores it against ground truth
 *      (SI-SDR + music-bleed), comparing with the previous DSP engine
 *
 * The engine runs 3 shift-averaged Demucs passes (17.35 dB single-pass →
 * 19.60 dB 3-pass on this study) plus the Silero-VAD pause cleanup gate.
 *
 * PASS bar: SI-SDR(vocals) > 14 dB, music bleed < -35 dB, pauses >= 20 dB
 * below speech level (old DSP scores ~0.6 dB / -25 dB).
 *
 * Requires: dev server :5173, public/models/htdemucs.onnx (npm run fetch:demucs).
 * Runtime: ~6-8 min in headless WASM (model load + 3 separation passes).
 */
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
const URL = process.env.TEST_URL || 'http://localhost:5173/#studio'
const TMP = join(tmpdir(), `voice-demucs-e2e-${Date.now()}`)
mkdirSync(TMP, { recursive: true })

if (!existsSync(join(ROOT, 'public/models/htdemucs.onnx'))) {
  throw new Error('public/models/htdemucs.onnx missing — run `npm run fetch:demucs` first')
}

// ---- 1. ground truth (deterministic showcase mix + clean stems) ----------
console.log('--- Step 1: Building deterministic showcase mix + clean ground-truth stems ---')
spawnSync('node', [join(ROOT, 'qa/voice-build-clean-stems.mjs'), TMP], { stdio: 'inherit', cwd: ROOT })
for (const f of ['mix-showcase-input.wav', 'clean-voice.wav', 'clean-music.wav']) {
  if (!existsSync(join(TMP, f))) throw new Error(`ground truth missing: ${f}`)
}

// ---- scoring helpers (SI-SDR etc. on 16-bit stereo WAVs) ------------------
function readWav(path) {
  const b = readFileSync(path)
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
  // find data chunk
  let off = 12
  let fmt = null
  while (off < b.length - 8) {
    const id = b.toString('ascii', off, off + 4)
    const size = v.getUint32(off + 4, true)
    if (id === 'fmt ') fmt = { ch: v.getUint16(off + 10, true), sr: v.getUint32(off + 12, true), bits: v.getUint16(off + 22, true) }
    if (id === 'data') {
      const n = Math.floor(size / (fmt.bits / 8))
      const x = new Float64Array(n)
      for (let i = 0; i < n; i++) x[i] = v.getInt16(off + 8 + i * 2, true) / 32768
      return { data: x, ch: fmt.ch, sr: fmt.sr }
    }
    off += 8 + size + (size % 2)
  }
  throw new Error(`no data chunk in ${path}`)
}
function channel(x, c) {
  const out = new Float64Array(Math.floor(x.data.length / x.ch))
  for (let i = 0; i < out.length; i++) out[i] = x.data[i * x.ch + c]
  return out
}
function siSdr(est, ref) {
  const m = Math.min(est.length, ref.length)
  let em = 0, rm = 0
  for (let i = 0; i < m; i++) { em += est[i]; rm += ref[i] }
  em /= m; rm /= m
  let stt = 0, srr = 0, see = 0
  for (let i = 0; i < m; i++) {
    const e = est[i] - em, r = ref[i] - rm
    stt += e * r; srr += r * r; see += e * e
  }
  const alpha = stt / (srr + 1e-12)
  const target = alpha, noise = see - (stt * stt) / (srr + 1e-12)
  // ||alpha*r||^2 / ||e - alpha*r||^2 ; expand via projections
  const tE = (stt * stt) / (srr + 1e-12)
  const nE = Math.max(see - tE, 1e-12)
  return 10 * Math.log10(tE / nE)
}
function bleedDb(est, comp) {
  // energy fraction of comp inside est after optimal gain
  const m = Math.min(est.length, comp.length)
  let em = 0, cm = 0
  for (let i = 0; i < m; i++) { em += est[i]; cm += comp[i] }
  em /= m; cm /= m
  let sc = 0, scc = 0, see2 = 0
  for (let i = 0; i < m; i++) {
    const e = est[i] - em, c = comp[i] - cm
    sc += e * c; scc += c * c; see2 += e * e
  }
  const alpha = sc / (scc + 1e-12)
  const proj = alpha * alpha * scc
  return 10 * Math.log10(proj / (see2 + 1e-12))
}
function scoreOutput(path, voicePath, musicPath, label) {
  const out = readWav(path)
  const voice = readWav(voicePath)
  const music = readWav(musicPath)
  const sdr = (siSdr(channel(out, 0), channel(voice, 0)) + siSdr(channel(out, 1), channel(voice, 1))) / 2
  const bleed = (bleedDb(channel(out, 0), channel(music, 0)) + bleedDb(channel(out, 1), channel(music, 1))) / 2
  console.log(`${label}: SI-SDR ${sdr.toFixed(2)} dB, music-bleed ${bleed.toFixed(2)} dB`)
  return { sdr, bleed }
}

// baseline: the previous DSP engine (its committed showcase output)
console.log('--- Step 2: Baseline (previous DSP output) ---')
const dspScore = scoreOutput(
  join(ROOT, 'evidence/voice/mix-showcase-isolated.wav'),
  join(TMP, 'clean-voice.wav'), join(TMP, 'clean-music.wav'), '  DSP (mid/side)')

// ---- 3. run the REAL model through the REAL UI ---------------------------
console.log('--- Step 3: Demucs v4 through the app UI (this runs the neural net; ~2 min) ---')
await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-testid="preview-viewport"]', { timeout: 15000 })

const mixB64 = readFileSync(join(TMP, 'mix-showcase-input.wav')).toString('base64')
await page.evaluate((b64) => {
  const store = window.__omniframe_store
  store.getState().addAsset({ id: 'demucs-e2e-mix', name: 'mix-showcase.wav', kind: 'audio', url: `data:audio/wav;base64,${b64}`, duration: 20, width: 0, height: 0, size: 0 })
  const cur = store.getState()
  const trackId = cur.ensureTrack('audio')
  cur.addClipToTrack(trackId, 'demucs-e2e-mix', 0)
  const c = store.getState().clips.find((x) => x.assetId === 'demucs-e2e-mix')
  window.__omniframe_store.setState({ selectedClipId: c.id, rightOpen: true })
}, mixB64)
await page.waitForTimeout(500)
{
  const chip = page.locator('[data-testid="section-tab-audio"]')
  if ((await chip.count()) > 0 && (await chip.getAttribute('aria-selected')) !== 'true') { await chip.click(); await page.waitForTimeout(250) }
  const btn = page.locator('[data-testid="panel-section-audio"] > button')
  if ((await btn.count()) > 0 && (await btn.getAttribute('aria-expanded')) !== 'true') { await btn.click(); await page.waitForTimeout(250) }
}
await page.locator('[data-testid="audio-voice-isolation-checkbox"]').check()
await page.waitForSelector('[data-testid="audio-isolation-model-dropdown"]', { timeout: 15000 })
await page.locator('[data-testid="audio-isolation-mode-dropdown"]').selectOption('keep_vocal')
await page.locator('[data-testid="audio-isolation-model-dropdown"]').selectOption('htdemucs-v4')
await page.waitForTimeout(1000) // allow the availability probe to re-assert the selection

const t0 = Date.now()
await page.locator('[data-testid="apply-audio-isolation-btn"]').click()
await page.waitForFunction(() => {
  const s = document.querySelector('[data-testid="audio-isolation-status"], [data-testid="isolation-status"]')
  const txt = s ? s.textContent : ''
  return /Error|Completed/.test(txt) || window.__omniframe_store.getState().assets.some((a) => a.name.includes('Vocal Isolated · htdemucs-v4'))
}, null, { timeout: 900_000 })
console.log(`  UI isolation finished in ${((Date.now() - t0) / 1000).toFixed(0)}s`)

const outInfo = await page.evaluate(async () => {
  const st = window.__omniframe_store.getState()
  const asset = st.assets.find((a) => a.name.includes('Vocal Isolated · htdemucs-v4'))
  if (!asset) return null
  const buf = new Uint8Array(await (await fetch(asset.url)).arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return { name: asset.name, duration: asset.duration, b64: btoa(bin) }
})
if (!outInfo) throw new Error('no Demucs-isolated asset produced by the UI')

const outWav = join(TMP, 'demucs-isolated.wav')
writeFileSync(outWav, Buffer.from(outInfo.b64, 'base64'))
console.log(`  asset: ${outInfo.name} (${outInfo.duration.toFixed(2)}s, ${(outWav.length / 1e6).toFixed(1)} MB)`)

// speech regions of the ground-truth voice, via the app's own Silero VAD
const voiceB64 = readFileSync(join(TMP, 'clean-voice.wav')).toString('base64')
const vadProbs = await page.evaluate(async (b64) => {
  const AC = window.AudioContext || window.webkitAudioContext
  const ctx = new AC({ sampleRate: 44100 })
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const buf = await ctx.decodeAudioData(bytes.buffer)
  const vad = await import('/src/lib/vad.ts')
  const { probs } = await vad.detectSpeech(buf)
  await ctx.close()
  return Array.from(probs)
}, voiceB64)
await browser.close()

// ---- 4. score the model output -------------------------------------------
console.log('--- Step 4: Scoring Demucs output against ground truth ---')
const demucsScore = scoreOutput(outWav, join(TMP, 'clean-voice.wav'), join(TMP, 'clean-music.wav'), '  Demucs v4 (app UI)')

// pause-region levels (VAD gate check): how quiet is the output between phrases?
{
  const out = readWav(outWav)
  const N = Math.min(out.data.length / out.ch, vadProbs.length * 512 * (44100 / 16000))
  const frameDur = 0.032
  const speechRms = [], pauseRms = []
  for (let c = 0; c < 2; c++) {
    const ch = channel(out, c)
    let sE = 0, sN = 0, pE = 0, pN = 0
    for (let i = 0; i < ch.length; i++) {
      const f = Math.min(Math.floor((i / 44100) / frameDur), vadProbs.length - 1)
      const e = ch[i] * ch[i]
      if (vadProbs[f] > 0.5) { sE += e; sN++ } else { pE += e; pN++ }
    }
    speechRms.push(10 * Math.log10(sE / Math.max(1, sN) + 1e-12))
    pauseRms.push(10 * Math.log10(pE / Math.max(1, pN) + 1e-12))
  }
  const speechDb = (speechRms[0] + speechRms[1]) / 2
  const pauseDb = (pauseRms[0] + pauseRms[1]) / 2
  console.log(`  pause cleanup: speech ${speechDb.toFixed(1)} dB, pauses ${pauseDb.toFixed(1)} dB (${(pauseDb - speechDb).toFixed(1)} dB below speech)`)
  globalThis.__pauseDelta = pauseDb - speechDb
}

// ---- 5. verdict -----------------------------------------------------------
let pass = 0, total = 0
const check = (name, ok) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (ok) pass++ }
check('Demucs SI-SDR > 14 dB (3-pass shift-averaged separation)', demucsScore.sdr > 14)
check('Demucs music-bleed < -35 dB (music inaudible)', demucsScore.bleed < -35)
check('Demucs at least 10 dB better than old DSP', demucsScore.sdr > dspScore.sdr + 10)
check('VAD pause cleanup: pauses >= 20 dB below speech', (globalThis.__pauseDelta ?? 0) < -20)
check('Duration preserved (20.00s ± 0.05)', Math.abs(outInfo.duration - 20) < 0.05)
check('Zero runtime page errors', pageErrors.length === 0)

console.log(`\nRESULT ${pass}/${total} ${pass === total ? 'PASS' : 'FAIL'} — Demucs ${demucsScore.sdr.toFixed(1)} dB vs DSP ${dspScore.sdr.toFixed(1)} dB SI-SDR`)
process.exit(pass === total ? 0 : 1)
