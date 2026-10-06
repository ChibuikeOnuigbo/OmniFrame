/**
 * Ground-truth stem exporter for the voice-isolation study.
 *
 * Replicates the EXACT mixture recipe from qa/voice-tts-mix-isolation-e2e.mjs
 * in-page (same WebAudio decode path, same RMS-0.16 normalization, same mix
 * loop) but additionally exports the *clean* stems that go into the mix:
 *
 *   mix-showcase-input.wav   the mixture (= E2E / listen-pack input)
 *   clean-voice.wav          voice stem exactly as mixed
 *   clean-music.wav          music stem exactly as mixed
 *
 * With those three files any isolation engine can be scored objectively
 * (SI-SDR, residual-music suppression) against ground truth.
 *
 * Run: node qa/voice-build-clean-stems.mjs [outDir]   (default: qa/assets/voice)
 * Requires: dev server on :5173, qa/assets/voice/{tts-f1-technical.mp3,full-band.wav}
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { tmpdir } from 'node:os'

const ROOT = process.cwd()
const URL = process.env.TEST_URL || 'http://localhost:5173/#studio'
const OUT_DIR = process.argv[2] ? process.argv[2] : join(ROOT, 'qa/assets/voice')
mkdirSync(OUT_DIR, { recursive: true })

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE:', m.text()) })
await page.goto(URL, { waitUntil: 'networkidle', timeout: 60_000 })

const recipe = await page.evaluate(async () => {
  const AC = window.AudioContext || window.webkitAudioContext
  const ctx = new AC({ sampleRate: 44100 })
  const lib = await import('/src/lib/voiceIsolation.ts')

  async function load(url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`)
    return ctx.decodeAudioData(await res.arrayBuffer())
  }
  const voice = await load('qa/assets/voice/tts-f1-technical.mp3')
  const bed = await load('qa/assets/voice/full-band.wav')

  const len = Math.min(voice.length, bed.length)
  const norm = (buf) => {
    const L = buf.getChannelData(0)
    const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0)
    let sum = 0
    for (let i = 0; i < len; i++) sum += (((L[i] + R[i]) / 2) ** 2)
    const g = Math.sqrt(sum / len) > 1e-9 ? 0.16 / Math.sqrt(sum / len) : 1
    return { L, R, g }
  }
  const v = norm(voice)
  const b = norm(bed)

  const mk = (fill) => {
    const buf = ctx.createBuffer(2, len, 44100)
    fill(buf.getChannelData(0), buf.getChannelData(1))
    return buf
  }
  const mixBuf = mk((oL, oR) => {
    for (let i = 0; i < len; i++) { oL[i] = v.L[i] * v.g + b.L[i] * b.g; oR[i] = v.R[i] * v.g + b.R[i] * b.g }
  })
  const voiceBuf = mk((oL, oR) => {
    for (let i = 0; i < len; i++) { oL[i] = v.L[i] * v.g; oR[i] = v.R[i] * v.g }
  })
  const musicBuf = mk((oL, oR) => {
    for (let i = 0; i < len; i++) { oL[i] = b.L[i] * b.g; oR[i] = b.R[i] * b.g }
  })

  const b64 = async (buf) => {
    const ab = await lib.encodeAudioBufferToWav(buf).arrayBuffer()
    const bytes = new Uint8Array(ab)
    let bin = ''
    const CHUNK = 0x8000
    for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
    return btoa(bin)
  }
  const out = {
    mix: await b64(mixBuf),
    voice: await b64(voiceBuf),
    music: await b64(musicBuf),
    duration: len / 44100,
  }
  await ctx.close()
  return out
})
await browser.close()

for (const [name, key] of [['mix-showcase-input.wav', 'mix'], ['clean-voice.wav', 'voice'], ['clean-music.wav', 'music']]) {
  const p = join(OUT_DIR, name)
  writeFileSync(p, Buffer.from(recipe[key], 'base64'))
  console.log(`wrote ${p} (${recipe.duration.toFixed(2)}s)`)
}
console.log(`Ground-truth stems exported (duration ${recipe.duration.toFixed(2)}s).`)
