import assert from 'node:assert/strict'
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
const URL = process.env.TEST_URL || 'http://localhost:5173/#studio'

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.message))

try {
  await page.addInitScript(() => {
    const fakeStream = { getTracks: () => [{ stop() {} }] }
    window.__denyMic = false
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => {
        if (window.__denyMic) throw new DOMException('Permission denied', 'NotAllowedError')
        return fakeStream
      } },
    })

    function oneSecondWav() {
      const sampleRate = 44100
      const frames = sampleRate
      const bytes = new ArrayBuffer(44 + frames * 2)
      const view = new DataView(bytes)
      const text = (value, offset) => {
        for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
      }
      text('RIFF', 0)
      view.setUint32(4, bytes.byteLength - 8, true)
      text('WAVE', 8)
      text('fmt ', 12)
      view.setUint32(16, 16, true)
      view.setUint16(20, 1, true)
      view.setUint16(22, 1, true)
      view.setUint32(24, sampleRate, true)
      view.setUint32(28, sampleRate * 2, true)
      view.setUint16(32, 2, true)
      view.setUint16(34, 16, true)
      text('data', 36)
      view.setUint32(40, frames * 2, true)
      for (let i = 0; i < frames; i++) view.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * 220 * i / sampleRate) * 5000), true)
      return new Blob([bytes], { type: 'audio/wav' })
    }

    window.MediaRecorder = class FakeMediaRecorder {
      static isTypeSupported() { return true }
      constructor(_stream, options = {}) {
        this.mimeType = options.mimeType || 'audio/webm'
        this.state = 'inactive'
        this.ondataavailable = null
        this.onstop = null
        this.onerror = null
      }
      start() { this.state = 'recording' }
      stop() {
        if (this.state === 'inactive') return
        this.state = 'inactive'
        setTimeout(() => {
          this.ondataavailable?.({ data: oneSecondWav() })
          this.onstop?.()
        }, 0)
      }
    }
  })

  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-testid="preview-viewport"]', { timeout: 20000 })
  await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    state.setLeftOpen(true)
    state.setLeftTab('audio')
  })
  await page.waitForSelector('[data-testid="voice-isolation-panel"]', { timeout: 10000 })
  await page.locator('[data-testid="audio-recorder-toggle"]').click()
  assert(await page.locator('[data-testid="audio-recorder-start"]').isVisible(), 'local mic recorder is discoverable in Audio')
  await page.locator('[data-testid="audio-recorder-airDb"]').fill('3')
  await page.locator('[data-testid="audio-recorder-reverb"]').fill('0.2')
  await page.locator('[data-testid="audio-recorder-start"]').click()
  await page.locator('[data-testid="audio-recorder-stop"]').waitFor({ state: 'visible' })
  await page.locator('[data-testid="audio-recorder-stop"]').click()
  await page.locator('[data-testid="audio-recorder-success"]').waitFor({ state: 'visible', timeout: 10000 })

  const result = await page.evaluate(() => {
    const state = window.__omniframe_store.getState()
    const asset = state.assets.find((item) => item.name.startsWith('Voice Recording '))
    const clip = asset && state.clips.find((item) => item.assetId === asset.id)
    return {
      asset: asset && { name: asset.name, duration: asset.duration, size: asset.size, waveformBins: asset.waveform?.length },
      clip: clip && { kind: clip.kind, start: clip.start, duration: clip.duration },
      selected: state.selectedClipId === clip?.id,
    }
  })
  assert(result.asset, 'recorded WAV asset is added to the Media Library')
  assert.equal(result.asset.waveformBins, 256, 'recorded asset receives a timeline waveform')
  assert(result.asset.duration >= 0.99 && result.asset.duration <= 1.01, 'recording duration survives decode and WAV encoding')
  assert.equal(result.clip?.kind, 'audio', 'recording is inserted as an audio timeline clip')
  assert.equal(result.clip?.start, 0, 'recording starts at the captured playhead')
  assert(result.selected, 'new recording clip becomes selected')
  await page.evaluate(() => { window.__denyMic = true })
  await page.locator('[data-testid="audio-recorder-start"]').click()
  const permissionError = await page.locator('[data-testid="audio-recorder-error"]').textContent()
  assert.match(permissionError || '', /Microphone permission was denied/i, 'microphone permission failures are explained to the user')
  assert.equal(pageErrors.length, 0, `no uncaught page errors: ${pageErrors.join(' | ')}`)
  console.log('[PASS] Audio recorder UI, mock mic capture, EQ/reverb rendering, WAV library asset and timeline placement.')
} finally {
  await browser.close()
}
