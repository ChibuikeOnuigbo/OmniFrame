/**
 * Voice-isolation listen pack — makes the test's input/output audible.
 *
 * The E2E suites verify the voice-isolation DSP with numbers (side-channel
 * collapse, band energies); this script additionally exports the produced
 * audio and arranges listenable MP3 pairs so a human can A/B them:
 *
 *   qa/exports/voice-isolation-listen/
 *     input_mix-showcase.mp3              TTS narration + full-band music bed (0 dB SNR)
 *     output_mix-showcase.mp3             Keep Vocal on the mix (the study case)
 *     input_test-audio-6s.mp3             the shared E2E audio fixture
 *     output_test-audio-6s-keep-vocal.mp3 Keep Vocal on the fixture
 *     output_test-audio-6s-remove-vocal.mp3 Remove Vocal (instrumental) on the fixture
 *
 * Runs the REAL app DSP (src/lib/voiceIsolation.ts via the dev server) — no
 * reimplementation. Requires the dev server on :5173 and the showcase E2E
 * (qa/voice-tts-mix-isolation-e2e.mjs) to have produced its WAVs.
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
const OUT_DIR = join(ROOT, 'qa/exports/voice-isolation-listen')
const TMP = join(ROOT, 'qa/exports/voice-isolation-listen/_wav')
mkdirSync(OUT_DIR, { recursive: true })
mkdirSync(TMP, { recursive: true })

for (const f of [
  ['input_mix-showcase.wav', join(ROOT, 'qa/assets/voice/mix-showcase.wav')],
  ['output_mix-showcase.wav', join(ROOT, 'evidence/voice/mix-showcase-isolated.wav')],
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
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-testid="preview-viewport"]', { timeout: 15000 })

// Register the fixture asset + clip through the store (same path the media
// panel's Add button drives: ensureTrack('audio') + addClipToTrack).
const fixtureB64 = readFileSync(join(ROOT, 'qa/fixtures/test-audio-6s.ogg')).toString('base64')
const clip = await page.evaluate((b64) => {
  const store = window.__omniframe_store
  const st = store.getState()
  st.addAsset({
    id: 'voice-listen-fixture',
    name: 'test-audio-6s.ogg',
    kind: 'audio',
    url: `data:audio/ogg;base64,${b64}`,
    duration: 6,
    width: 0,
    height: 0,
    size: 0,
  })
  const cur = store.getState()
  const trackId = cur.ensureTrack('audio')
  cur.addClipToTrack(trackId, 'voice-listen-fixture', 0)
  const c = store.getState().clips.find((x) => x.assetId === 'voice-listen-fixture')
  return { id: c?.id, name: c?.name }
}, fixtureB64)
if (!clip.id) throw new Error('fixture clip not on timeline')
console.log(`fixture on timeline: ${clip.name} (${clip.id})`)

for (const mode of ['keep_vocal', 'remove_vocal']) {
  console.log(`running ${mode} on ${clip.name}...`)
  const res = await page.evaluate(async ({ clipId, mode }) => {
    const lib = await import('/src/lib/voiceIsolation.ts')
    const out = await lib.executeVoiceIsolationForClip(clipId, {
      mode,
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
  }, { clipId: clip.id, mode })
  const file = `output_test-audio-6s-${mode === 'keep_vocal' ? 'keep-vocal' : 'remove-vocal'}.wav`
  writeFileSync(join(TMP, file), Buffer.from(res.b64, 'base64'))
  console.log(`  -> ${file} (${res.name})`)
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
  'output_mix-showcase.wav',
  'input_test-audio-6s.wav',
  'output_test-audio-6s-keep-vocal.wav',
  'output_test-audio-6s-remove-vocal.wav',
]) mp3(f)

// drop the intermediate WAVs, keep the MP3 pack clean
spawnSync('rm', ['-rf', TMP])
console.log(`\nListen pack ready: ${OUT_DIR}`)
