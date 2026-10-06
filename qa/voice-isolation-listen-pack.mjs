/**
 * Voice-isolation listen pack — makes the study's input/output audible.
 *
 * The E2E suites verify the voice-isolation engines with numbers; this script
 * exports the produced audio as listenable MP3 pairs so a human can A/B them.
 * It runs the REAL app code (src/lib/voiceIsolation.ts via the dev server,
 * same executeVoiceIsolationForClip action the UI calls) — no reimplementation.
 *
 *   evidence/voice/listen/  (tracked in git)
 *     input_mix-showcase.mp3                        TTS narration + full-band music bed (0 dB SNR)
 *     output_mix-showcase-keep-vocal-demucs.mp3     Demucs v4 neural isolation (the study case)
 *     output_mix-showcase-remove-vocal-demucs.mp3   Demucs v4 instrumental (karaoke)
 *     output_mix-showcase-keep-vocal-dsp-old.mp3    previous DSP output (kept for A/B)
 *     input_test-audio-6s.mp3                       the shared E2E audio fixture
 *     output_test-audio-6s-keep-vocal-demucs.mp3    Demucs v4 on the fixture
 *     output_test-audio-6s-remove-vocal-demucs.mp3  Demucs v4 instrumental on the fixture
 *
 * Requires:
 *   - dev server on :5173
 *   - qa/voice-tts-mix-isolation-e2e.mjs run first (produces the showcase mix
 *     + the old DSP isolated WAV used for the A/B reference)
 *   - public/models/htdemucs.onnx  (npm run fetch:demucs)
 */
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
const URL = process.env.TEST_URL || 'http://localhost:5173/#studio'
const OUT_DIR = join(ROOT, 'evidence/voice/listen')
const TMP = join(ROOT, 'evidence/voice/listen/_wav')
mkdirSync(OUT_DIR, { recursive: true })
mkdirSync(TMP, { recursive: true })

if (!existsSync(join(ROOT, 'public/models/htdemucs.onnx'))) {
  throw new Error('public/models/htdemucs.onnx missing — run `npm run fetch:demucs` first')
}
for (const f of [
  ['input_mix-showcase.wav', join(ROOT, 'qa/assets/voice/mix-showcase.wav')],
  ['output_mix-showcase-keep-vocal-dsp-old.wav', join(ROOT, 'evidence/voice/mix-showcase-isolated.wav')],
]) {
  if (!existsSync(f[1])) throw new Error(`missing ${f[1]} — run qa/voice-tts-mix-isolation-e2e.mjs first`)
  writeFileSync(join(TMP, f[0]), readFileSync(f[1]))
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

// Register assets + clips through the store (same path the media panel drives).
function addAssetClip(page, id, name, path, duration) {
  const b64 = readFileSync(path).toString('base64')
  return page.evaluate(({ id, name, b64, duration }) => {
    const store = window.__omniframe_store
    store.getState().addAsset({
      id, name, kind: 'audio',
      url: `data:audio/${name.endsWith('.ogg') ? 'ogg' : 'wav'};base64,${b64}`,
      duration, width: 0, height: 0, size: 0,
    })
    const cur = store.getState()
    const trackId = cur.ensureTrack('audio')
    cur.addClipToTrack(trackId, id, 0)
    const c = store.getState().clips.find((x) => x.assetId === id)
    return { id: c?.id, name: c?.name }
  }, { id, name, b64, duration })
}

const fixture = await addAssetClip(page, 'voice-listen-fixture', 'test-audio-6s.ogg', join(ROOT, 'qa/fixtures/test-audio-6s.ogg'), 6)
if (!fixture.id) throw new Error('fixture clip not on timeline')
console.log(`fixture on timeline: ${fixture.name} (${fixture.id})`)

const showcase = await addAssetClip(page, 'voice-listen-showcase', 'mix-showcase.wav', join(ROOT, 'qa/assets/voice/mix-showcase.wav'), 20)
if (!showcase.id) throw new Error('showcase clip not on timeline')
console.log(`showcase on timeline: ${showcase.name} (${showcase.id})`)

// Run the REAL neural engine (Demucs v4 / htdemucs via onnxruntime-web) through
// the app's own action for both modes and both clips.
const jobs = [
  { clip: showcase, mode: 'keep_vocal', file: 'output_mix-showcase-keep-vocal-demucs.wav' },
  { clip: showcase, mode: 'remove_vocal', file: 'output_mix-showcase-remove-vocal-demucs.wav' },
  { clip: fixture, mode: 'keep_vocal', file: 'output_test-audio-6s-keep-vocal-demucs.wav' },
  { clip: fixture, mode: 'remove_vocal', file: 'output_test-audio-6s-remove-vocal-demucs.wav' },
]
for (const job of jobs) {
  const t0 = Date.now()
  console.log(`running Demucs ${job.mode} on ${job.clip.name}...`)
  const res = await page.evaluate(async ({ clipId, mode }) => {
    const lib = await import('/src/lib/voiceIsolation.ts')
    const out = await lib.executeVoiceIsolationForClip(clipId, {
      mode,
      model: 'htdemucs-v4',
      strength: 0.92,
      preserveBass: true,
      speechFormantFocus: true,
    }, (pct, msg) => { /* progress */ })
    const st = window.__omniframe_store.getState()
    const asset = st.assets.find((a) => a.id === out.assetId)
    const buf = new Uint8Array(await (await fetch(asset.url)).arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return { name: asset.name, b64: btoa(bin) }
  }, { clipId: job.clip.id, mode: job.mode })
  writeFileSync(join(TMP, job.file), Buffer.from(res.b64, 'base64'))
  console.log(`  -> ${job.file} (${res.name}) [${((Date.now() - t0) / 1000).toFixed(0)}s]`)
}

// copy the fixture input alongside
writeFileSync(join(TMP, 'input_test-audio-6s.wav'), readFileSync(join(ROOT, 'qa/fixtures/test-audio-6s.ogg')))

await browser.close()

// ---- convert everything to MP3 pairs ------------------------------------
const mp3 = (wavName) => {
  const src = join(TMP, wavName)
  const dst = join(OUT_DIR, wavName.replace(/\.wav$/, '.mp3'))
  const out = spawnSync(ffmpegInstaller.path, ['-nostdin', '-hide_banner', '-y', '-i', src, '-codec:a', 'libmp3lame', '-qscale:a', '2', dst], { encoding: 'utf8' })
  if (out.status !== 0) throw new Error(`ffmpeg failed on ${wavName}: ${out.stderr.slice(-400)}`)
  console.log(`MP3 ${wavName.replace(/\.wav$/, '.mp3')}`)
}
for (const f of [
  'input_mix-showcase.wav',
  'output_mix-showcase-keep-vocal-demucs.wav',
  'output_mix-showcase-remove-vocal-demucs.wav',
  'output_mix-showcase-keep-vocal-dsp-old.wav',
  'input_test-audio-6s.wav',
  'output_test-audio-6s-keep-vocal-demucs.wav',
  'output_test-audio-6s-remove-vocal-demucs.wav',
]) mp3(f)

// keep the exact study input alongside its output for full-fidelity checks
writeFileSync(join(ROOT, 'evidence/voice/mix-showcase-input.wav'), readFileSync(join(ROOT, 'qa/assets/voice/mix-showcase.wav')))

// drop the intermediate WAVs, keep the MP3 pack clean
spawnSync('rm', ['-rf', TMP])
console.log(`\nListen pack ready: ${OUT_DIR}`)
