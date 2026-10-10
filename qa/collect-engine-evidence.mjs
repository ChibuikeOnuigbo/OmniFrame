#!/usr/bin/env node
/**
 * Engine evidence collector — runs the isolation engines through the REAL
 * app path (processVoiceIsolation) on deterministic inputs and saves the
 * output WAVs + a JSON sidecar for the strict Python grader
 * (qa/strict_output_grader.py).
 *
 * Inputs are built in-page from the committed fixtures:
 *   noisy-speech: qa/fixtures/test-audio-6s.ogg + LCG white noise at 0 dB
 *                 (the RNNoise/unified E2E mix) — keep_vocal material
 *   song-mix:     tts-m1-numbers voice over pad-chords at 0 dB + hiss
 *                 (the unified E2E mix) — keep_vocal + remove_vocal
 *
 * Usage:
 *   node qa/collect-engine-evidence.mjs rnnoise omni-unified   # engines to run
 *   (default: both new engines; each engine runs on the mixes it supports)
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium as pwChromium } from 'playwright'
import { inflate } from '@sparticuz/chromium'
import serverlessChromium from '@sparticuz/chromium'

const ROOT = process.cwd()
const URL = process.env.TEST_URL || 'http://localhost:5173/#studio'
const EVID = join(ROOT, 'evidence/voice/engines')
mkdirSync(EVID, { recursive: true })

const engines = process.argv.slice(2).length ? process.argv.slice(2) : ['rnnoise-xiph', 'omni-unified']

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

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

  const results = await page.evaluate(async (engines) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const lib = await import('/src/lib/voiceIsolation.ts')
    const load = async (url) => ctx.decodeAudioData(await (await fetch(url)).arrayBuffer())
    const toB64 = (u8) => {
      let bin = ''
      for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000))
      return btoa(bin)
    }
    let seed = 99
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x3fffffff - 1 }

    // mix 1: real SPEECH + white noise at 0 dB (mono, native rate).
    // (test-audio-6s.ogg is music — 0% speech on the grader — never use it
    // as a speech source.)
    const speech = await load('qa/assets/voice/tts-m1-numbers.mp3')
    const sr = speech.sampleRate
    const len1 = Math.min(speech.length, Math.round(6 * sr))
    let p = 0
    const sc = speech.getChannelData(0)
    for (let i = 0; i < len1; i++) p += sc[i] * sc[i]
    const nAmp = Math.sqrt(p / len1)
    const noisy = ctx.createBuffer(1, len1, sr)
    const nd = noisy.getChannelData(0)
    for (let i = 0; i < len1; i++) nd[i] = sc[i] + rnd() * nAmp

    // mix 2: voice over pad-chords at 0 dB + hiss (stereo, native rate)
    const voice = await load('qa/assets/voice/tts-m1-numbers.mp3')
    const bed = await load('qa/assets/voice/pad-chords.wav')
    const len2 = Math.min(voice.length, bed.length, Math.round(4.5 * sr))
    let vr = 0, br = 0
    const vL = voice.getChannelData(0), bL = bed.getChannelData(0)
    const bR = bed.numberOfChannels > 1 ? bed.getChannelData(1) : bed.getChannelData(0)
    for (let i = 0; i < len2; i++) { vr += vL[i] * vL[i]; br += bL[i] * bL[i] }
    const vg = 0.16 / Math.sqrt(vr / len2), bg = 0.16 / Math.sqrt(br / len2)
    const songMix = ctx.createBuffer(2, len2, sr)
    const mL = songMix.getChannelData(0), mR = songMix.getChannelData(1)
    for (let i = 0; i < len2; i++) {
      const v = vL[i] * vg
      const n = rnd() * 0.04
      mL[i] = v + bL[i] * bg + n
      mR[i] = v + bR[i] * bg + n
    }

    const runJob = async (engine, mix, mode, name) => {
      const bytes = await lib.encodeAudioBufferToWavArrayBuffer(mix)
      const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
      const t0 = performance.now()
      const notes = []
      const out = await lib.processVoiceIsolation(url, { mode, model: engine, strength: 0.92 },
        (pct, note) => notes.push(`${pct}:${note}`))
      URL.revokeObjectURL(url)
      return { name, engine, mode, wavB64: toB64(new Uint8Array(await out.blob.arrayBuffer())), ms: Math.round(performance.now() - t0), notes }
    }

    const jobs = []
    for (const engine of engines) {
      if (engine === 'rnnoise-xiph') {
        jobs.push(await runJob(engine, noisy, 'keep_vocal', 'rnnoise-noisy-speech'))
      } else if (engine === 'omni-unified') {
        jobs.push(await runJob(engine, noisy, 'keep_vocal', 'unified-noisy-speech'))
        jobs.push(await runJob(engine, songMix, 'keep_vocal', 'unified-song-keepvocal'))
        jobs.push(await runJob(engine, songMix, 'remove_vocal', 'unified-song-removevocal'))
      }
    }
    await ctx.close()
    return { jobs, sr, len1, len2, errors: [] }
  }, engines)

  const manifest = []
  for (const job of results.jobs) {
    const wav = Buffer.from(job.wavB64, 'base64')
    const path = join(EVID, `${job.name}.wav`)
    writeFileSync(path, wav)
    manifest.push({ name: job.name, engine: job.engine, mode: job.mode, bytes: wav.length, ms: job.ms, notes: job.notes })
    console.log(`wrote ${path} (${(wav.length / 1024).toFixed(0)} KB, ${job.ms} ms, ${job.mode})`)
  }
  writeFileSync(join(EVID, 'manifest.json'), JSON.stringify({
    when: new Date().toISOString(),
    sampleRate: results.sr,
    jobs: manifest,
    pageErrors: errors,
  }, null, 2))
  if (errors.length) {
    console.log('PAGE ERRORS:', errors.join(' | '))
    process.exit(1)
  }
  console.log('done')
} finally {
  await browser.close()
}
