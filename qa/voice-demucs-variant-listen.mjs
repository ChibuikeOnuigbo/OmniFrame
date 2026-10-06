/**
 * Voice isolation listen pack — variant #2 (different voice, different bed).
 *
 * Same recipe as the showcase mix (RMS-normalized 0 dB SNR mix, built in-page
 * with the production decoder) but with a male conversational TTS voice over
 * the drums-groove bed, so the listen pack shows the Demucs v4 engine
 * generalizes beyond the single study case.
 *
 * Produces:
 *   evidence/voice/listen/input_mix-variant2.mp3
 *   evidence/voice/listen/output_mix-variant2-keep-vocal-demucs.mp3
 *
 * Requires: dev server :5173, public/models/htdemucs.onnx, dev server must
 * serve qa/assets/voice/* (Vite does from project root).
 */
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
const URL = process.env.TEST_URL || 'http://localhost:5173/#studio'
const OUT_DIR = join(ROOT, 'evidence/voice/listen')
const TMP = join(OUT_DIR, '_wav2')
mkdirSync(TMP, { recursive: true })
if (!existsSync(join(ROOT, 'public/models/htdemucs.onnx'))) {
  throw new Error('public/models/htdemucs.onnx missing — run `npm run fetch:demucs` first')
}

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message))
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-testid="preview-viewport"]', { timeout: 15000 })

// Build the variant mix in-page with the production recipe.
const mix = await page.evaluate(async () => {
  const AC = window.AudioContext || window.webkitAudioContext
  const ctx = new AC({ sampleRate: 44100 })
  const lib = await import('/src/lib/voiceIsolation.ts')
  async function load(url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`)
    return ctx.decodeAudioData(await res.arrayBuffer())
  }
  const voice = await load('qa/assets/voice/tts-m1-conversation.mp3')
  const bed = await load('qa/assets/voice/drums-groove.wav')
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
  const mixBuf = ctx.createBuffer(2, len, 44100)
  const oL = mixBuf.getChannelData(0)
  const oR = mixBuf.getChannelData(1)
  for (let i = 0; i < len; i++) { oL[i] = v.L[i] * v.g + b.L[i] * b.g; oR[i] = v.R[i] * v.g + b.R[i] * b.g }
  const ab = await lib.encodeAudioBufferToWav(mixBuf).arrayBuffer()
  const bytes = new Uint8Array(ab)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  await ctx.close()
  return { b64: btoa(bin), duration: len / 44100 }
})
writeFileSync(join(TMP, 'input_mix-variant2.wav'), Buffer.from(mix.b64, 'base64'))
console.log(`variant2 mix built (${mix.duration.toFixed(2)}s)`)

// Register + run the real engine (same action the UI drives).
const clip = await page.evaluate((b64) => {
  const store = window.__omniframe_store
  store.getState().addAsset({ id: 'voice-variant2', name: 'mix-variant2.wav', kind: 'audio', url: `data:audio/wav;base64,${b64}`, duration: 20, width: 0, height: 0, size: 0 })
  const cur = store.getState()
  const trackId = cur.ensureTrack('audio')
  cur.addClipToTrack(trackId, 'voice-variant2', 0)
  const c = store.getState().clips.find((x) => x.assetId === 'voice-variant2')
  return { id: c?.id, name: c?.name }
}, mix.b64)
if (!clip.id) throw new Error('variant2 clip not on timeline')

const t0 = Date.now()
const res = await page.evaluate(async ({ clipId }) => {
  const lib = await import('/src/lib/voiceIsolation.ts')
  const out = await lib.executeVoiceIsolationForClip(clipId, {
    mode: 'keep_vocal',
    model: 'htdemucs-v4',
    strength: 0.92,
    preserveBass: true,
    speechFormantFocus: true,
  })
  const st = window.__omniframe_store.getState()
  const asset = st.assets.find((a) => a.id === out.assetId)
  const buf = new Uint8Array(await (await fetch(asset.url)).arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return { name: asset.name, b64: btoa(bin) }
}, { clipId: clip.id })
writeFileSync(join(TMP, 'output_mix-variant2-keep-vocal-demucs.wav'), Buffer.from(res.b64, 'base64'))
console.log(`  -> ${res.name} [${((Date.now() - t0) / 1000).toFixed(0)}s]`)
await browser.close()

for (const f of ['input_mix-variant2.wav', 'output_mix-variant2-keep-vocal-demucs.wav']) {
  const out = spawnSync(ffmpegInstaller.path, ['-nostdin', '-hide_banner', '-y', '-i', join(TMP, f), '-codec:a', 'libmp3lame', '-qscale:a', '2', join(OUT_DIR, f.replace(/\.wav$/, '.mp3'))], { encoding: 'utf8' })
  if (out.status !== 0) throw new Error(`ffmpeg failed on ${f}: ${out.stderr.slice(-300)}`)
  console.log(`MP3 ${f.replace(/\.wav$/, '.mp3')}`)
}
spawnSync('rm', ['-rf', TMP])
console.log(`\nVariant pair ready in ${OUT_DIR}`)
