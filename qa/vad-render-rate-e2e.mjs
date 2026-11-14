import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import chrome, { inflate } from '@sparticuz/chromium'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
await inflate(join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}:${process.env.LD_LIBRARY_PATH || ''}`
const browser = await chromium.launch({ executablePath: await chrome.executablePath(), args: ['--no-sandbox'] })
try {
  const page = await browser.newPage()
  await page.goto(process.env.URL || 'http://localhost:5173/#studio', { waitUntil: 'domcontentloaded' })
  const result = await page.evaluate(async () => {
    const { renderAtRate } = await import('/src/lib/vad.ts')
    const input = new AudioBuffer({ length: 4800, numberOfChannels: 1, sampleRate: 48000 })
    const samples = input.getChannelData(0)
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(2 * Math.PI * 440 * i / 48000) * .5
    const output = await renderAtRate(input, 1.25)
    const data = output.getChannelData(0)
    return { length: output.length, finite: data.every(Number.isFinite), peak: Math.max(...data) }
  })
  assert.equal(result.length, 3840)
  assert.equal(result.finite, true)
  assert(result.peak > .1 && result.peak <= 1, JSON.stringify(result))
  console.log('PASS VAD renderAtRate yields finite, audible samples at the expected speed')
} finally {
  await browser.close()
}
