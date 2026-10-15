import assert from 'node:assert/strict'
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = process.cwd()
const URL = process.env.TEST_URL || 'http://localhost:5173/#studio'
await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))

function stereoToneWavDataUrl() {
  const sampleRate = 44100
  const frames = sampleRate
  const bytes = Buffer.alloc(44 + frames * 2 * 2)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVE', 8)
  bytes.write('fmt ', 12)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(2, 22)
  bytes.writeUInt32LE(sampleRate, 24)
  bytes.writeUInt32LE(sampleRate * 2 * 2, 28)
  bytes.writeUInt16LE(4, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(frames * 2 * 2, 40)
  for (let i = 0; i < frames; i++) {
    const phase = 2 * Math.PI * 440 * i / sampleRate
    bytes.writeInt16LE(Math.round(Math.sin(phase) * 7000), 44 + i * 4)
    bytes.writeInt16LE(Math.round(Math.sin(phase + Math.PI / 3) * 7000), 46 + i * 4)
  }
  return `data:audio/wav;base64,${bytes.toString('base64')}`
}

function setRange(page, selector, value) {
  return page.locator(selector).evaluate((input, next) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, String(next))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

try {
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="preview-viewport"]', { timeout: 20000 })
  const sourceId = 'audio-pitch-tempo-source'
  const sourceClipId = await page.evaluate(({ url, sourceId }) => {
    const store = window.__omniframe_store
    const state = store.getState()
    state.addAsset({ id: sourceId, name: 'pitch-tempo-tone.wav', kind: 'audio', url, duration: 1, width: 0, height: 0, size: 176444 })
    const trackId = state.ensureTrack('audio')
    state.addClipToTrack(trackId, sourceId, 2)
    const clip = store.getState().clips.find((item) => item.assetId === sourceId)
    store.getState().selectClip(clip.id)
    return clip.id
  }, { url: stereoToneWavDataUrl(), sourceId })

  await page.locator('[data-testid="left-tab-audio"]').click()
  const panel = page.locator('[data-testid="audio-pitch-tempo-panel"]')
  await panel.waitFor({ state: 'visible' })
  assert.equal(await page.locator('[data-testid="audio-pitch-tempo-toggle"]').getAttribute('aria-expanded'), 'true')

  await setRange(page, '[data-testid="audio-pitch-tempo-pitch"]', 12)
  await setRange(page, '[data-testid="audio-pitch-tempo-tempo"]', 120)
  await page.locator('[data-testid="audio-pitch-tempo-render"]').click()
  await page.locator('[data-testid="audio-pitch-tempo-success"]').waitFor({ timeout: 30000 })

  const first = await page.evaluate(async ({ sourceId }) => {
    const state = window.__omniframe_store.getState()
    const sourceClip = state.clips.find((clip) => clip.assetId === sourceId)
    const outputAsset = state.assets.find((asset) => asset.name.includes('pitch-tempo-tone') && asset.name.includes('pitch +12 st') && asset.name.includes('tempo 120%'))
    const outputClip = state.clips.find((clip) => clip.assetId === outputAsset?.id)
    if (!sourceClip || !outputAsset || !outputClip) throw new Error('First rendered clip was not inserted.')
    const context = new AudioContext()
    const decoded = await context.decodeAudioData(await (await fetch(outputAsset.url)).arrayBuffer())
    const data = decoded.getChannelData(0)
    const start = Math.floor(decoded.sampleRate * 0.2)
    const end = Math.min(data.length, Math.floor(decoded.sampleRate * 0.7))
    let crossings = 0
    for (let i = start + 1; i < end; i++) if (data[i - 1] < 0 && data[i] >= 0) crossings++
    const seconds = (end - start) / decoded.sampleRate
    const frequency = crossings / seconds
    await context.close()
    return {
      sourceVolume: sourceClip.volume,
      start: outputClip.start,
      duration: outputAsset.duration,
      clipDuration: outputClip.duration,
      channels: decoded.numberOfChannels,
      frequency,
      sampleRate: decoded.sampleRate,
      outputName: outputAsset.name,
    }
  }, { sourceId })
  assert.equal(first.sourceVolume, 0, 'original source is muted by default but remains in the project')
  assert.equal(first.start, 2, 'rendered output starts exactly with the selected clip')
  assert.ok(Math.abs(first.duration - (1 / 1.2)) < 0.002, `120% tempo shortens the 1 s clip to about 0.833 s; got ${first.duration}`)
  assert.ok(Math.abs(first.clipDuration - first.duration) < 0.002, 'timeline clip duration matches rendered media')
  assert.equal(first.channels, 2, 'stereo channel layout survives processing')
  assert.ok(Math.abs(first.frequency - 880) < 24, `+12 semitones shifts 440 Hz to about 880 Hz; got ${first.frequency}`)

  await page.locator('[data-testid="audio-pitch-tempo-clip-select"]').selectOption(sourceClipId)
  await setRange(page, '[data-testid="audio-pitch-tempo-pitch"]', 0)
  await setRange(page, '[data-testid="audio-pitch-tempo-tempo"]', 80)
  await page.locator('[data-testid="audio-pitch-tempo-render"]').click()
  await page.locator('[data-testid="audio-pitch-tempo-success"]').waitFor({ timeout: 30000 })
  const second = await page.evaluate(async ({ sourceId }) => {
    const state = window.__omniframe_store.getState()
    const outputAsset = state.assets.find((asset) => asset.name.includes('pitch-tempo-tone') && asset.name.includes('pitch 0 st') && asset.name.includes('tempo 80%'))
    const outputClip = state.clips.find((clip) => clip.assetId === outputAsset?.id)
    if (!outputAsset || !outputClip) throw new Error('Tempo-only rendered clip was not inserted.')
    const context = new AudioContext()
    const decoded = await context.decodeAudioData(await (await fetch(outputAsset.url)).arrayBuffer())
    const data = decoded.getChannelData(0)
    const start = Math.floor(decoded.sampleRate * 0.2)
    const end = Math.min(data.length, Math.floor(decoded.sampleRate * 0.7))
    let crossings = 0
    for (let i = start + 1; i < end; i++) if (data[i - 1] < 0 && data[i] >= 0) crossings++
    const seconds = (end - start) / decoded.sampleRate
    await context.close()
    return { duration: outputAsset.duration, clipDuration: outputClip.duration, frequency: crossings / seconds, sourceStillThere: state.clips.some((clip) => clip.assetId === sourceId) }
  }, { sourceId })
  assert.ok(Math.abs(second.duration - 1.25) < 0.003, `80% tempo lengthens the 1 s clip to 1.25 s; got ${second.duration}`)
  assert.ok(Math.abs(second.frequency - 440) < 18, `tempo change leaves pitch near 440 Hz; got ${second.frequency}`)
  assert.ok(Math.abs(second.clipDuration - second.duration) < 0.002, 'slowed timeline clip duration matches rendered media')
  assert.equal(second.sourceStillThere, true, 'source remains available after rendering')

  await page.locator('[data-testid="audio-pitch-tempo-clip-select"]').selectOption(sourceClipId)
  await setRange(page, '[data-testid="audio-pitch-tempo-pitch"]', 7)
  await setRange(page, '[data-testid="audio-pitch-tempo-tempo"]', 100)
  const characterSelect = page.locator('[data-testid="audio-pitch-tempo-character"]')
  await characterSelect.selectOption('voice')
  assert.equal(await characterSelect.inputValue(), 'voice', 'voice-character pitch mode is selected')
  await page.locator('[data-testid="audio-pitch-tempo-render"]').click()
  await page.locator('[data-testid="audio-pitch-tempo-success"]').waitFor({ timeout: 30000 })
  const voicePitch = await page.evaluate(async () => {
    const state = window.__omniframe_store.getState()
    const asset = state.assets.find((item) => item.name.includes('pitch +7 st') && item.name.includes('tempo 100%'))
    if (!asset) throw new Error(`Voice-character pitch output is missing: ${state.assets.map((item) => item.name).filter((name) => name.includes('pitch-tempo')).join(' | ')}`)
    const context = new AudioContext()
    const decoded = await context.decodeAudioData(await (await fetch(asset.url)).arrayBuffer())
    const data = decoded.getChannelData(0)
    const start = Math.floor(decoded.sampleRate * 0.2)
    const end = Math.min(data.length, Math.floor(decoded.sampleRate * 0.7))
    let crossings = 0
    for (let i = start + 1; i < end; i++) if (data[i - 1] < 0 && data[i] >= 0) crossings++
    const frequency = crossings / ((end - start) / decoded.sampleRate)
    const duration = asset.duration
    await context.close()
    return { frequency, duration }
  })
  const expectedVoiceFrequency = 440 * (2 ** (7 / 12))
  assert.ok(Math.abs(voicePitch.frequency - expectedVoiceFrequency) < 25, `formant-aware voice mode shifts 440 Hz by seven semitones; got ${voicePitch.frequency}`)
  assert.ok(Math.abs(voicePitch.duration - 1) < 0.002, 'voice pitch shift preserves source duration')
  assert.equal(errors.length, 0, `zero uncaught page errors: ${errors.join(' | ')}`)
  console.log('[PASS] Synthetic stereo renders verify independent pitch/tempo behavior, voice pitch mode, timeline alignment, source retention and muting.')
} finally {
  await browser.close()
}
