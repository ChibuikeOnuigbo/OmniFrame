/**
 * LOUDNESS NORMALIZATION E2E
 * =========================
 * Tests BS.1770-4 integrated-LUFS measurement and the Normalize action on a
 * LOUD speech clip:
 *
 *  1. Anchor: a 1 kHz sine at -20 dBFS must measure ~ -23 LUFS.
 *  2. Build a loud speech asset in-page (fixture speech amplified +12 dB),
 *     place it, measure — must read loud (> -14 LUFS).
 *  3. Normalize to -16 LUFS: clip volume drops below 1 and the effective
 *     loudness lands near the target.
 *  4. Normalize to -24 LUFS: volume drops further (more reduction).
 */

import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = '/home/user/OmniFrame'
const REPORTS = join(ROOT, 'qa/reports')
mkdirSync(REPORTS, { recursive: true })

const results = []
const assert = (name, value, detail = '') => {
  const pass = !!value
  results.push({ name, status: pass ? 'PASS' : 'FAIL', detail: String(detail) })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!pass) process.exitCode = 1
}

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))

await page.goto('http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1200)

/* ---- 1. Measurement anchor: 1 kHz sine @ -20 dBFS => ~ -23 LUFS ---- */
const anchorLufs = await page.evaluate(async () => {
  const sr = 48000
  const x = new Float32Array(sr * 2)
  for (let i = 0; i < x.length; i++) x[i] = 0.1 * Math.sin((2 * Math.PI * 1000 * i) / sr)
  return window.__omniframe_lufs([x], sr)
})
assert('BS.1770 anchor: 1 kHz @ -20 dBFS measures ~ -23 LUFS', Math.abs(anchorLufs + 23) <= 1.0, `${anchorLufs.toFixed(2)} LUFS`)

/* ---- 2. Loud speech asset (fixture speech + 12 dB) ---- */
const clipId = await page.evaluate(async () => {
  // decode the fixture through the app's audio context
  const res = await fetch('/death_note_video.mp4').catch(() => null) // warm-up no-op
  void res
  const input = document.querySelector('input[type="file"]')
  return new Promise((resolve) => {
    const dt = new DataTransfer()
    resolve(dt)
  }).then(() => null)
})
// import the real speech fixture through the media panel (real user path)
const input = page.getByTestId('panel-all-import-input')
await input.setInputFiles(join(ROOT, 'qa/fixtures/test-audio-6s.ogg'))
await page.waitForTimeout(700)

const loudClipId = await page.evaluate(async () => {
  const store = window.__omniframe_store
  const s = store.getState()
  const asset = s.assets.find((a) => a.name.includes('test-audio-6s'))
  if (!asset) throw new Error('fixture asset missing')

  // decode -> amplify +12 dB -> re-encode as 16-bit PCM WAV
  const buf = await (await fetch(asset.url)).arrayBuffer()
  const Ctx = window.AudioContext || window.webkitAudioContext
  const ctx = new Ctx()
  const audio = await ctx.decodeAudioData(buf)
  const mono = new Float32Array(audio.length)
  for (let i = 0; i < audio.length; i++) mono[i] = Math.max(-1, Math.min(1, audio.getChannelData(0)[i] * 3.98)) // +12 dB
  await ctx.close()

  // WAV encode (mono 16-bit)
  const n = mono.length
  const bytes = new ArrayBuffer(44 + n * 2)
  const v = new DataView(bytes)
  const wstr = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)) }
  wstr(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); wstr(8, 'WAVE')
  wstr(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, audio.sampleRate, true); v.setUint32(28, audio.sampleRate * 2, true)
  v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  wstr(36, 'data'); v.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, mono[i] * 32767)), true)

  const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
  store.getState().addAsset({
    id: 'asset_loud_speech',
    name: 'loud-speech-test.wav',
    kind: 'audio',
    url,
    duration: audio.duration,
    width: 0,
    height: 0,
    size: bytes.byteLength,
  })
  const api = store.getState()
  const trackId = api.ensureTrack('audio')
  api.addClipToTrack(trackId, 'asset_loud_speech', 0)
  const fresh = store.getState()
  const clip = fresh.clips[fresh.clips.length - 1]
  store.setState({ selectedClipId: clip.id, rightOpen: true })
  return clip.id
})
await page.waitForTimeout(600)

// activate the Audio section (tabs mode => chip; accordion => header)
{
  const chip = page.locator('[data-testid="section-tab-audio"]')
  if ((await chip.count()) > 0 && (await chip.getAttribute('aria-selected')) !== 'true') {
    await chip.click(); await page.waitForTimeout(250)
  }
  const btn = page.locator('[data-testid="panel-section-audio"] > button')
  if ((await btn.count()) > 0 && (await btn.getAttribute('aria-expanded')) !== 'true') {
    await btn.click(); await page.waitForTimeout(250)
  }
}

// enable loudness + measure
const loudBox = page.locator('[data-testid="audio-loudness-checkbox"]')
if (!(await loudBox.isChecked())) await loudBox.check()
await page.waitForTimeout(300)
await page.locator('[data-testid="audio-loudness-remasure-btn"]').click()
await page.waitForTimeout(1500)
let measured = await page.locator('[data-testid="audio-loudness-measured"]').innerText()
measured = measured.replace('LUFS', '').trim()
const measuredNum = parseFloat(measured)
assert('Loud speech measured as loud (> -14 LUFS)', measuredNum > -14, `${measuredNum} LUFS (fixture was -24.1 before +12 dB)`)

/* ---- 3. Normalize to -16 LUFS ---- */
const slider = page.locator('[data-testid="audio-loudness-target-slider"]')
await slider.fill('-16')
await page.waitForTimeout(200)
await page.locator('[data-testid="audio-loudness-apply-btn"]').click()
await page.waitForTimeout(400)

let volume = await page.evaluate((cid) => window.__omniframe_store.getState().clips.find((c) => c.id === cid).volume, loudClipId)
assert('Normalize to -16 LUFS reduces the clip volume below 1', volume < 1, `volume ${volume.toFixed(3)}`)
const status1 = await page.locator('[data-testid="audio-loudness-status"]').innerText().catch(() => '')
assert('Status reports the applied gain', /LUFS/.test(status1) && /dB/.test(status1), status1)

// effective loudness after gain ~ target (measure scaled signal in-page)
const effective = await page.evaluate(async (cid) => {
  const clip = window.__omniframe_store.getState().clips.find((c) => c.id === cid)
  const asset = window.__omniframe_store.getState().assets.find((a) => a.id === clip.assetId)
  const buf = await (await fetch(asset.url)).arrayBuffer()
  const Ctx = window.AudioContext || window.webkitAudioContext
  const ctx = new Ctx()
  const audio = await ctx.decodeAudioData(buf)
  await ctx.close()
  const mono = new Float32Array(audio.length)
  for (let i = 0; i < audio.length; i++) mono[i] = audio.getChannelData(0)[i] * clip.volume
  return window.__omniframe_lufs([mono], audio.sampleRate)
}, loudClipId)
assert('Effective loudness lands near -16 LUFS', Math.abs(effective + 16) <= 1.5, `${effective.toFixed(1)} LUFS`)

/* ---- 4. Normalize to -24 LUFS (further reduction) ---- */
await slider.fill('-24')
await page.waitForTimeout(200)
await page.locator('[data-testid="audio-loudness-apply-btn"]').click()
await page.waitForTimeout(400)
const volume2 = await page.evaluate((cid) => window.__omniframe_store.getState().clips.find((c) => c.id === cid).volume, loudClipId)
assert('Normalize to -24 LUFS reduces volume further', volume2 < volume, `${volume.toFixed(3)} -> ${volume2.toFixed(3)}`)

assert('Zero runtime page errors', pageErrors.length === 0, pageErrors.join(' | '))

await browser.close()
writeFileSync(
  join(REPORTS, 'loudness-normalization.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      anchorLufs,
      measuredLufs: measuredNum,
      effectiveLufsAtTarget: effective,
      volumeAfterMinus16: volume,
      volumeAfterMinus24: volume2,
      results,
      pageErrors,
    },
    null,
    2,
  ),
)
const passCount = results.filter((r) => r.status === 'PASS').length
console.log(`\nRESULT ${passCount}/${results.length} PASS — report: qa/reports/loudness-normalization.json`)
