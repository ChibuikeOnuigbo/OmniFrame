import assert from 'node:assert/strict'
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = '/home/user/OmniFrame'
const URL = process.env.TEST_URL || 'http://localhost:5173/#studio'
await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`
const browser = await pwChromium.launch({ executablePath: await serverlessChromium.executablePath(), args: ['--no-sandbox', '--use-gl=swiftshader'] })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.goto(URL, { waitUntil: 'networkidle' })
  const result = await page.evaluate(async () => {
    const { analyzeAudioBuffer } = await import('/src/lib/audioAnalysis.ts')
    const sr = 22050
    const duration = 12
    const buffer = new AudioBuffer({ numberOfChannels: 1, length: sr * duration, sampleRate: sr })
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      const t = i / sr
      const beat = t % 0.5
      const click = beat < 0.002 ? 0.35 * (1 - beat / 0.002) : 0
      data[i] = 0.08 * (Math.sin(2 * Math.PI * 261.63 * t) + Math.sin(2 * Math.PI * 329.63 * t) + Math.sin(2 * Math.PI * 392 * t)) / 3 + click
    }
    return analyzeAudioBuffer(buffer)
  })
  console.log(`Synthetic test estimate: ${result.key || 'unknown'}, ${result.bpm || 'unknown'} BPM`)
  assert(result.bpm !== null && Math.abs(result.bpm - 120) <= 3, `expected approximately 120 BPM, got ${result.bpm}`)
  assert.equal(result.key, 'C Major', `expected C Major chroma estimate, got ${result.key}`)
  console.log('[PASS] Local key/BPM analyzer identifies a synthetic C-major 120 BPM test mix.')
} finally {
  await browser.close()
}
