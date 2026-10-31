import assert from 'node:assert/strict'
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = '/home/user/OmniFrame'
const URL = process.env.TEST_URL || 'http://localhost:5173/#studio'

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})

function tinyWavDataUrl() {
  const sampleRate = 44100
  const frames = sampleRate
  const bytes = Buffer.alloc(44 + frames * 2)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVE', 8)
  bytes.write('fmt ', 12)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(sampleRate, 24)
  bytes.writeUInt32LE(sampleRate * 2, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(frames * 2, 40)
  for (let i = 0; i < frames; i++) bytes.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 220 * i / sampleRate) * 5000), 44 + i * 2)
  return `data:audio/wav;base64,${bytes.toString('base64')}`
}

const pageErrors = []
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (err) => pageErrors.push(err.message))
try {
  // Keep the model-present UI branch deterministic; the separator itself is
  // not run in this smoke test.
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window)
    window.fetch = (resource, init) => {
      const url = typeof resource === 'string' ? resource : resource instanceof URL ? resource.href : resource.url
      const method = (init?.method || (resource instanceof Request ? resource.method : 'GET')).toUpperCase()
      if (url.includes('/models/htdemucs.onnx') && method === 'HEAD') {
        return Promise.resolve(new Response(null, { status: 200, headers: { 'content-type': 'application/octet-stream', 'content-length': '174000000' } }))
      }
      return nativeFetch(resource, init)
    }
  })
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="preview-viewport"]', { timeout: 20000 })
  const availabilityChecks = await page.evaluate(async () => {
    const { isDemucsModelResponseAvailable } = await import('/src/lib/demucs/index.ts')
    return {
      spaFallback: isDemucsModelResponseAvailable(new Response('<html/>', { status: 200, headers: { 'content-type': 'text/html', 'content-length': '285' } })),
      truncatedModel: isDemucsModelResponseAvailable(new Response(null, { status: 200, headers: { 'content-type': 'application/octet-stream', 'content-length': '1024' } })),
      modelFile: isDemucsModelResponseAvailable(new Response(null, { status: 200, headers: { 'content-type': 'application/octet-stream', 'content-length': '174000000' } })),
    }
  })
  assert.deepEqual(availabilityChecks, { spaFallback: false, truncatedModel: false, modelFile: true }, 'Demucs availability rejects SPA fallback pages and missing weights')
  await page.evaluate((url) => {
    const store = window.__omniframe_store
    const state = store.getState()
    const assetId = 'audio-panel-smoke-source'
    state.addAsset({ id: assetId, name: 'audio-panel-smoke.wav', kind: 'audio', url, duration: 1, width: 0, height: 0, size: 88244 })
    const trackId = state.ensureTrack('audio')
    state.addClipToTrack(trackId, assetId, 0)
    state.addClipToTrack(trackId, assetId, 1.25)
    const clips = store.getState().clips.filter((item) => item.assetId === assetId)
    store.getState().selectClips(clips.map((clip) => clip.id))
  }, tinyWavDataUrl())

  await page.locator('[data-testid="left-tab-audio"]').click()
  await page.waitForSelector('[data-testid="voice-isolation-panel"]', { timeout: 10000 })
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="panel-demucs-status"]')
    return !!el && !el.textContent?.includes('Checking for')
  }, { timeout: 30000 })

  const engine = page.locator('[data-testid="panel-engine-select"]')
  const status = await page.locator('[data-testid="panel-demucs-status"]').innerText()
  const engineValue = await engine.inputValue()
  assert.equal(engineValue, 'htdemucs-v4', 'local Demucs installs as the quality-first Audio dock default')
  assert.match(status, /found locally/i)
  assert(await page.locator('[data-testid="panel-speedfix-toggle"]').isVisible(), 'slowed + reverb correction is exposed')
  const manualOverride = page.locator('[data-testid="panel-manual-speed-override-toggle"] input')
  assert(await manualOverride.isVisible(), 'known slowdown can override conservative auto-detection')
  await manualOverride.check()
  assert(await page.locator('[data-testid="panel-manual-speed-factor"]').isVisible(), 'manual speed correction factor is adjustable')
  assert(await page.locator('[data-testid="panel-vad-toggle"]').isVisible(), 'Silero pause cleanup is exposed')
  assert(await page.locator('[data-testid="panel-stem-separate-btn"]').isEnabled(), 'four-stem separation action is enabled')
  assert(await page.locator('[data-testid="panel-batch-isolate-btn"]').isEnabled(), 'batch isolation is available for multiple selected clips')
  assert(await page.locator('[data-testid="panel-source-preview-btn"]').isVisible(), 'source audition is exposed')
  assert(await page.locator('[data-testid="panel-audio-analysis-btn"]').isEnabled(), 'key/BPM analysis is accessible')
  await page.locator('[data-testid="panel-audio-analysis-btn"]').click()
  await page.waitForSelector('[data-testid="panel-audio-analysis-result"]', { timeout: 10000 })
  await page.locator('[data-testid="panel-mode-remove-vocal"]').click()
  assert.equal(await engine.inputValue(), 'htdemucs-v4', 'Demucs remains available for both keep and remove modes')
  assert(await page.locator('[data-testid="panel-execute-voice-btn"]').isEnabled())
  const decodeFailure = await page.evaluate(async () => {
    const lib = await import('/src/lib/voiceIsolation.ts')
    try {
      await lib.processVoiceIsolation('data:text/plain,not-an-audio-file', { mode: 'keep_vocal', model: 'omni-voicetarget' })
      return null
    } catch (error) {
      return error.message
    }
  })
  assert.match(decodeFailure || '', /Could not decode the selected audio/i, 'real decode failures never return a synthetic tone as a successful result')
  await engine.selectOption('omni-voicetarget')
  await page.locator('[data-testid="panel-batch-isolate-btn"]').click()
  await page.waitForFunction(() => {
    const state = window.__omniframe_store.getState()
    return state.assets.filter((asset) => asset.name.includes('[Vocal Removed · omni-voicetarget]')).length >= 2
  }, { timeout: 15000 })
  await page.getByText(/2 selected audio clips processed sequentially/).waitFor({ timeout: 10000 })
  assert.equal(await page.locator('[data-testid="panel-batch-isolate-btn"]').count(), 1, 'batch selection is restored after processing')
  assert.equal(pageErrors.length, 0, `no uncaught page errors: ${pageErrors.join('; ')}`)
  console.log('[PASS] Audio dock exposes Demucs, slowed-track cleanup, four stems, source preview and both isolation modes.')
} finally {
  await browser.close()
}
