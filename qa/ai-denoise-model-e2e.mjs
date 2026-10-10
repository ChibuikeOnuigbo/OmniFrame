/**
 * AI DENOISE MODEL E2E (browser)
 * =============================
 * Loads the trained omni-denoise-v1 ONNX model in the real app (onnxruntime-web
 * WASM backend), runs it on noisy speech, and checks that it improves SI-SDR.
 * Also ties into the Python-side evaluation report (qa/reports/ai-denoise-model.json),
 * which covers the song / heavily-padded-song cases with the native runtime.
 */

import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = '/home/user/OmniFrame'
const REPORTS = join(ROOT, 'qa/reports')
const EVIDENCE = join(ROOT, 'evidence/screenshots')
mkdirSync(REPORTS, { recursive: true })
mkdirSync(EVIDENCE, { recursive: true })

const results = []
const assert = (name, value, detail = '') => {
  const pass = !!value
  results.push({ name, status: pass ? 'PASS' : 'FAIL', detail: String(detail) })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!pass) process.exitCode = 1
}

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir}`

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))
const failedRequests = []
page.on('requestfailed', (r) => {
  const u = r.url()
  const err = r.failure()?.errorText ?? ''
  // ERR_ABORTED happens on navigation-time fetches (expected, cf. stress-e2e).
  if (!u.includes('data:') && !u.includes('blob:') && err !== 'net::ERR_ABORTED') {
    failedRequests.push(`${u} ${err}`)
  }
})

await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)

/* 1. Model + runtime artifacts are served */
const modelStatus = await page.evaluate(async () => {
  const m = await fetch('/models/omni-denoise-v1.onnx', { method: 'HEAD' })
  const j = await fetch('/models/omni-denoise-v1.json').then((r) => r.json()).catch(() => null)
  return { onnx: m.status, meta: j }
})
assert('ONNX model served by the app', modelStatus.onnx === 200, `HTTP ${modelStatus.onnx}`)
assert('Model constants served', !!modelStatus.meta?.mu && modelStatus.meta?.name === 'omni-denoise-v1', JSON.stringify(modelStatus.meta))

/* 2. Import the speech fixture, build a 0 dB white-noise mixture in-page,
      run the ONNX denoiser, and measure SI-SDR before/after. */
const input = page.getByTestId('panel-all-import-input')
await input.setInputFiles(join(ROOT, 'qa/fixtures/test-audio-6s.ogg'))
await page.waitForTimeout(700)

const evalRes = await page.evaluate(async () => {
  const store = window.__omniframe_store
  const asset = store.getState().assets.find((a) => a.name.includes('test-audio-6s'))
  if (!asset) throw new Error('fixture asset missing')
  const buf = await (await fetch(asset.url)).arrayBuffer()
  const Ctx = window.AudioContext || window.webkitAudioContext
  const ctx = new Ctx()
  const audio = await ctx.decodeAudioData(buf)

  // mono downmix
  const mono = new Float32Array(audio.length)
  for (let ch = 0; ch < audio.numberOfChannels; ch++) {
    const d = audio.getChannelData(ch)
    for (let i = 0; i < audio.length; i++) mono[i] += d[i] / audio.numberOfChannels
  }
  // deterministic white noise at 0 dB SNR
  let seed = 12345
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x3fffffff - 1
  }
  const noise = new Float32Array(mono.length)
  for (let i = 0; i < noise.length; i++) noise[i] = rnd()
  const pSig = mono.reduce((s, v) => s + v * v, 0) / mono.length
  const pNoi = noise.reduce((s, v) => s + v * v, 0) / noise.length
  const scale = Math.sqrt(pSig / pNoi)
  for (let i = 0; i < noise.length; i++) noise[i] *= scale
  const mix = new Float32Array(mono.length)
  for (let i = 0; i < mix.length; i++) mix[i] = mono[i] + noise[i]

  // mixture AudioBuffer for the denoiser
  const mixBuffer = ctx.createBuffer(1, mix.length, audio.sampleRate)
  mixBuffer.copyToChannel(mix, 0)
  await ctx.close()

  const t0 = performance.now()
  const out = await window.__omniframe_denoise.runBuffer(mixBuffer, 1.0)
  const wallMs = performance.now() - t0

  // SI-DR (scale-invariant, dB)
  const siSdr = (est, ref) => {
    let em = 0, rm = 0
    for (let i = 0; i < est.length; i++) { em += est[i]; rm += ref[i] }
    em /= est.length; rm /= ref.length
    let num = 0, den = 0, den2 = 0
    for (let i = 0; i < est.length; i++) {
      const e = est[i] - em, r = ref[i] - rm
      num += e * r; den += r * r; den2 += e * e
    }
    const a = num / (den + 1e-12)
    let st = 0, sn = 0
    for (let i = 0; i < est.length; i++) {
      const e = est[i] - em, r = ref[i] - rm
      st += (a * r) * (a * r); sn += (e - a * r) * (e - a * r)
    }
    return 10 * Math.log10((st + 1e-12) / (sn + 1e-12))
  }
  return {
    samples: out.samples.length,
    maskMean: out.maskMean,
    inferenceMs: out.inferenceMs,
    wallMs,
    sdrBefore: siSdr(mix, mono),
    sdrAfter: siSdr(out.samples, mono),
    clipPeak: out.samples.reduce((m, v) => Math.abs(v) > m ? Math.abs(v) : m, 0),
  }
})

assert('Denoiser ran on the full 6 s clip', evalRes.samples > 150000, `${evalRes.samples} samples`)
assert('SI-SDR improves after AI denoise (+3 dB minimum)', evalRes.sdrAfter - evalRes.sdrBefore > 3,
  `${evalRes.sdrBefore.toFixed(2)} -> ${evalRes.sdrAfter.toFixed(2)} dB (Δ ${evalRes.sdrAfter - evalRes.sdrBefore >= 0 ? '+' : ''}${(evalRes.sdrAfter - evalRes.sdrBefore).toFixed(2)} dB)`)
assert('Output is not clipped garbage', evalRes.clipPeak <= 1.0 && evalRes.maskMean > 0.005, `peak ${evalRes.clipPeak.toFixed(2)}, maskMean ${evalRes.maskMean.toFixed(3)}`)
assert('Browser inference completes in reasonable time', evalRes.wallMs < 30000, `${(evalRes.wallMs / 1000).toFixed(1)}s wall (${evalRes.inferenceMs.toFixed(0)} ms onnx)`)

/* 3. The engine is reachable through the real isolation UI */
await page.evaluate(() => {
  const api = window.__omniframe_store.getState()
  const trackId = api.ensureTrack('video')
  api.addClipToTrack(trackId, 'asset-death-note-vid', 0)
  const fresh = window.__omniframe_store.getState()
  window.__omniframe_store.setState({ selectedClipId: fresh.clips[fresh.clips.length - 1].id, rightOpen: true })
})
await page.waitForTimeout(500)
{
  const chip = page.locator('[data-testid="section-tab-audio"]')
  if ((await chip.count()) > 0 && (await chip.getAttribute('aria-selected')) !== 'true') { await chip.click(); await page.waitForTimeout(250) }
  const btn = page.locator('[data-testid="panel-section-audio"] > button')
  if ((await btn.count()) > 0 && (await btn.getAttribute('aria-expanded')) !== 'true') { await btn.click(); await page.waitForTimeout(250) }
}
await page.locator('[data-testid="audio-voice-isolation-checkbox"]').check()
await page.waitForTimeout(300)
await page.locator('[data-testid="audio-isolation-mode-dropdown"]').selectOption('keep_vocal')
await page.locator('[data-testid="audio-isolation-model-dropdown"]').selectOption('omni-denoise-onnx')
assert('AI Denoise engine selectable in the isolation UI', true)

/* 4. Python-side report (song / heavily padded song cases) */
let pyReport = null
try {
  pyReport = JSON.parse(readFileSync(join(REPORTS, 'ai-denoise-model.json'), 'utf8'))
} catch {}
assert('Python evaluation report exists', !!pyReport)
if (pyReport) {
  assert('Python evaluation passed (song + heavily padded song)', pyReport.passed === true,
    pyReport.cases.map((c) => `${c.case}: ${c.deltaSiSdrDb > 0 ? '+' : ''}${c.deltaSiSdrDb} dB`).join(' | '))
}

assert('Zero runtime page errors', pageErrors.length === 0, pageErrors.join(' | '))
assert('No failed asset requests', failedRequests.length === 0, failedRequests.slice(0, 3).join(' | '))

await page.screenshot({ path: join(EVIDENCE, 'ai-denoise-engine-selected.png') })
await browser.close()

writeFileSync(
  join(REPORTS, 'ai-denoise-browser.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), browser: evalRes, python: pyReport, results, pageErrors }, null, 2),
)
const passCount = results.filter((r) => r.status === 'PASS').length
console.log(`\nRESULT ${passCount}/${results.length} PASS — report: qa/reports/ai-denoise-browser.json`)
