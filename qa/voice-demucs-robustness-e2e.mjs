/**
 * Voice-isolation robustness E2E — edge cases real user uploads hit, in BOTH
 * modes: keep_vocal (isolate the voice) and remove_vocal (extract the
 * instrumental / karaoke).
 *
 *   keep_vocal:
 *     1. mono input     (voice memo / phone recording — upmix path)
 *     2. 48 kHz input   (real-browser context rate — resample path)
 *     3. 0.5 s clip     (shorter than one model chunk)
 *     4. two speakers   (overlapping voices — both must survive)
 *   remove_vocal (instrumental extraction):
 *     5. mono input     — instrumental must survive the upmix path
 *     6. 48 kHz input   — instrumental through the resample path
 *     7. voice-only mix — instrumental must be (near-)silent
 *
 * Every case runs the REAL app code through the dev server (the action path
 * where possible, separateWithDemucs directly where the action path cannot
 * produce the input, e.g. a 48 kHz AudioBuffer). One case per browser
 * process — consecutive separations in one renderer OOM the CI sandbox.
 *
 * Outputs:
 *   qa/reports/voice-demucs-robustness.json          (scores + PASS/FAIL)
 *   evidence/voice/robustness/{input,output}-*.mp3   (listenable pairs)
 *   evidence/voice/robustness/README.md
 *
 * Requires: dev server :5173, public/models/htdemucs.onnx.
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
const TMP = join(tmpdir(), 'voice-robustness')
const EVID = join(ROOT, 'evidence/voice/robustness')
mkdirSync(TMP, { recursive: true })
mkdirSync(EVID, { recursive: true })

if (!existsSync(join(ROOT, 'public/models/htdemucs.onnx'))) {
  throw new Error('public/models/htdemucs.onnx missing — run `npm run fetch:demucs` first')
}

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

// In-page helpers, installed on window once: load/decode an asset,
// RMS-normalize to the production recipe (0.16), encode bytes to base64.
const MIX_LIB = `
  async function load(ctx, url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error('fetch ' + url + ' -> ' + res.status)
    return ctx.decodeAudioData(await res.arrayBuffer())
  }
  function norm(buf, len) {
    const L = buf.getChannelData(0)
    const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0)
    let sum = 0
    for (let i = 0; i < len; i++) sum += (((L[i] + R[i]) / 2) ** 2)
    const rms = Math.sqrt(sum / len)
    const g = rms > 1e-9 ? 0.16 / rms : 1
    return { L, R, g }
  }
  function b64(bytes) {
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return btoa(bin)
  }
`

// ---------- browser plumbing ------------------------------------------------
async function withPage(fn) {
  const browser = await pwChromium.launch({
    executablePath: await serverlessChromium.executablePath(),
    args: [
      '--no-sandbox',
      // WASM separation peaks ~3.1 GB in the renderer; the software-GL GPU
      // process (~100 MB) is pure overhead for these audio-only cases —
      // disabling it buys the second shift-averaging pass enough headroom
      // on memory-tight CI boxes (the renderer OOM-kills otherwise).
      '--disable-gpu',
      '--disable-software-rasterizer',
    ],
  })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(URL, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-testid="preview-viewport"]', { timeout: 15000 })
    await page.evaluate(`(() => { ${MIX_LIB} window.__mix = { load, norm, b64 } })()`)
    const out = await fn(page)
    return { ...out, errors }
  } finally {
    await browser.close()
  }
}

async function runCase(name, caseBody) {
  // let the OS reclaim the previous case's ~2 GB of freed WASM pages before
  // the next renderer starts (consecutive heavy browsers OOM otherwise)
  await new Promise((r) => setTimeout(r, 12000))
  for (let attempt = 1; ; attempt++) {
    try {
      const t0 = Date.now()
      const result = await withPage(caseBody)
      console.log(`  ${name} done in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
      return result
    } catch (err) {
      if (attempt >= 4) throw err
      console.log(`  ${name} attempt ${attempt} failed (${String(err.message).split('\n')[0]}); retrying…`)
      await new Promise((r) => setTimeout(r, 10000))
    }
  }
}

/**
 * Resumable case: results are persisted to the tmp dir as they complete, so
 * a crashed run (renderer OOMs are stochastic in the CI sandbox) resumes
 * where it stopped instead of repeating ~2-minute separations.
 */
async function persisted(name, caseBody) {
  const p = join(TMP, `case-${name}.json`)
  if (existsSync(p)) {
    console.log(`  ${name}: cached`)
    return JSON.parse(readFileSync(p, 'utf8'))
  }
  const r = await runCase(name, caseBody)
  writeFileSync(p, JSON.stringify(r))
  return r
}

/** Build the mono edge-case mix + both ground-truth stems. */
async function buildMono(page) {
  return page.evaluate(async () => {
    const { load, norm, b64 } = window.__mix
    const AC = window.AudioContext || window.webkitAudioContext
    const ctx = new AC({ sampleRate: 44100 })
    const lib = await import('/src/lib/voiceIsolation.ts')
    const voice = await load(ctx, 'qa/assets/voice/tts-m1-numbers.mp3')
    const bed = await load(ctx, 'qa/assets/voice/pad-chords.wav')
    const len = Math.min(voice.length, bed.length, 6 * 44100)
    const v = norm(voice, len), b = norm(bed, len)
    const mix = ctx.createBuffer(1, len, 44100) // MONO
    const gtV = ctx.createBuffer(1, len, 44100)
    const gtM = ctx.createBuffer(1, len, 44100)
    const m = mix.getChannelData(0), g = gtV.getChannelData(0), q = gtM.getChannelData(0)
    for (let i = 0; i < len; i++) { m[i] = (v.L[i] * v.g + b.L[i] * b.g) / 2; g[i] = v.L[i] * v.g; q[i] = b.L[i] * b.g }
    return {
      mixB64: b64(new Uint8Array(await (await lib.encodeAudioBufferToWav(mix)).arrayBuffer())),
      gtVB64: b64(new Uint8Array(await (await lib.encodeAudioBufferToWav(gtV)).arrayBuffer())),
      gtMB64: b64(new Uint8Array(await (await lib.encodeAudioBufferToWav(gtM)).arrayBuffer())),
    }
  })
}

/** Build the 48 kHz-path mix (44.1 kHz WAV + stereo ground truths). */
async function build48k(page) {
  return page.evaluate(async () => {
    const { load, norm, b64 } = window.__mix
    const AC = window.AudioContext || window.webkitAudioContext
    const ctx = new AC({ sampleRate: 44100 })
    const lib = await import('/src/lib/voiceIsolation.ts')
    const voice = await load(ctx, 'qa/assets/voice/tts-f1-questions.mp3')
    const bed = await load(ctx, 'qa/assets/voice/drums-groove.wav')
    const len = Math.min(voice.length, bed.length, 6 * 44100)
    const v = norm(voice, len), b = norm(bed, len)
    const mix = ctx.createBuffer(2, len, 44100)
    const gtV = ctx.createBuffer(2, len, 44100)
    const gtM = ctx.createBuffer(2, len, 44100)
    const mL = mix.getChannelData(0), mR = mix.getChannelData(1)
    const gL = gtV.getChannelData(0), gR = gtV.getChannelData(1)
    const qL = gtM.getChannelData(0), qR = gtM.getChannelData(1)
    for (let i = 0; i < len; i++) {
      mL[i] = v.L[i]*v.g + b.L[i]*b.g; mR[i] = v.R[i]*v.g + b.R[i]*b.g
      gL[i] = v.L[i]*v.g; gR[i] = v.R[i]*v.g
      qL[i] = b.L[i]*b.g; qR[i] = b.R[i]*b.g
    }
    return {
      mixB64: b64(new Uint8Array(await (await lib.encodeAudioBufferToWav(mix)).arrayBuffer())),
      gtVB64: b64(new Uint8Array(await (await lib.encodeAudioBufferToWav(gtV)).arrayBuffer())),
      gtMB64: b64(new Uint8Array(await (await lib.encodeAudioBufferToWav(gtM)).arrayBuffer())),
    }
  })
}

/** Build the two-overlapping-speakers mix (voices only, no bed). */
async function buildDuo(page) {
  return page.evaluate(async () => {
    const { load, norm, b64 } = window.__mix
    const AC = window.AudioContext || window.webkitAudioContext
    const ctx = new AC({ sampleRate: 44100 })
    const lib = await import('/src/lib/voiceIsolation.ts')
    const a = await load(ctx, 'qa/assets/voice/tts-m1-numbers.mp3')
    const b = await load(ctx, 'qa/assets/voice/tts-f1-questions.mp3')
    const len = Math.min(a.length, b.length, 6 * 44100)
    const na = norm(a, len), nb = norm(b, len)
    const mix = ctx.createBuffer(2, len, 44100)
    const gt = ctx.createBuffer(2, len, 44100) // "vocals" = both speakers
    const mL = mix.getChannelData(0), mR = mix.getChannelData(1)
    const gL = gt.getChannelData(0), gR = gt.getChannelData(1)
    for (let i = 0; i < len; i++) {
      mL[i] = na.L[i]*na.g + nb.L[i]*nb.g; mR[i] = na.R[i]*na.g + nb.R[i]*nb.g
      gL[i] = na.L[i]*na.g + nb.L[i]*nb.g; gR[i] = na.R[i]*na.g + nb.R[i]*nb.g
    }
    return {
      mixB64: b64(new Uint8Array(await (await lib.encodeAudioBufferToWav(mix)).arrayBuffer())),
      gtVB64: b64(new Uint8Array(await (await lib.encodeAudioBufferToWav(gt)).arrayBuffer())),
    }
  })
}

/** Isolate/Remove through the real app action (asset + clip on timeline). */
async function isolateAction({ mixB64, assetId, mode }) {
  // speedNormalize:false — the fixtures here are synthetic TTS+bed mixes, never
  // slowed productions, and loading Silero into the MAIN renderer before the
  // passes inflates the baseline the ~3.1 GB WASM pass heaps stack on (the
  // renderer OOM-kills on memory-tight boxes). The slowed-detection path is
  // covered end-to-end by qa/voice-slowed-fix-e2e.mjs (18/18).
  const { b64 } = window.__mix
  const lib = await import('/src/lib/voiceIsolation.ts')
  const store = window.__omniframe_store
  store.getState().addAsset({ id: assetId, name: assetId + '.wav', kind: 'audio', url: 'data:audio/wav;base64,' + mixB64, duration: 6, width: 0, height: 0, size: 0 })
  const cur = store.getState()
  cur.addClipToTrack(cur.ensureTrack('audio'), assetId, 0)
  const clip = store.getState().clips.find((x) => x.assetId === assetId)
  const res = await lib.executeVoiceIsolationForClip(clip.id, { mode, model: 'htdemucs-v4', strength: 0.75, speedNormalize: false })
  const st = store.getState()
  const asset = st.assets.find((a) => a.id === res.assetId)
  const buf = new Uint8Array(await (await fetch(asset.url)).arrayBuffer())
  return b64(buf)
}

/** Feed the mix to the separator as a 48 kHz buffer (resample path). */
async function separateAt48k({ mixB64, want }) {
  const { b64 } = window.__mix
  const demucs = await import('/src/lib/demucs/index.ts')
  const lib = await import('/src/lib/voiceIsolation.ts')
  const bytes = Uint8Array.from(atob(mixB64), (c) => c.charCodeAt(0)).buffer
  const AC = window.AudioContext || window.webkitAudioContext
  const ctx48 = new AC({ sampleRate: 48000 })
  const buf48 = await ctx48.decodeAudioData(bytes)
  const ctx44 = new AC({ sampleRate: 44100 })
  const res = await demucs.separateWithDemucs(ctx44, buf48, null, { passes: 2 })
  const out = want === 'instrumental' ? res.instrumental : res.vocals
  await ctx48.close(); await ctx44.close()
  return {
    b64: b64(new Uint8Array(await (await lib.encodeAudioBufferToWav(out)).arrayBuffer())),
    inRate: buf48.sampleRate, outRate: out.sampleRate, outCh: out.numberOfChannels, duration: out.duration,
  }
}

// ---------- keep_vocal cases -------------------------------------------------
const mono = await persisted('mono keep_vocal', async (page) => {
  const built = await buildMono(page)
  const out = await page.evaluate(isolateAction, { mixB64: built.mixB64, assetId: 'rob-mono', mode: 'keep_vocal' })
  return { input: built.mixB64, gtV: built.gtVB64, gtM: built.gtMB64, output: out }
})

const hz48 = await persisted('48kHz keep_vocal', async (page) => {
  const built = await build48k(page)
  const out = await page.evaluate(separateAt48k, { mixB64: built.mixB64, want: 'vocals' })
  return { input: built.mixB64, gtV: built.gtVB64, gtM: built.gtMB64, output: out.b64, meta: { inRate: out.inRate, outCh: out.outCh } }
})

const short = await persisted('short', async (page) => {
  const out = await page.evaluate(async () => {
    const { load, norm, b64 } = window.__mix
    const AC = window.AudioContext || window.webkitAudioContext
    const ctx = new AC({ sampleRate: 44100 })
    const lib = await import('/src/lib/voiceIsolation.ts')
    const demucs = await import('/src/lib/demucs/index.ts')
    const voice = await load(ctx, 'qa/assets/voice/tts-f1-staccato.mp3')
    const len = Math.min(voice.length, Math.round(0.5 * 44100))
    const v = norm(voice, len)
    const mix = ctx.createBuffer(2, len, 44100)
    const mL = mix.getChannelData(0), mR = mix.getChannelData(1)
    for (let i = 0; i < len; i++) { mL[i] = v.L[i] * v.g; mR[i] = v.R[i] * v.g }
    const res = await demucs.separateWithDemucs(ctx, mix, null, { passes: 1 })
    const d = res.vocals.getChannelData(0)
    let nonFinite = 0, energy = 0
    for (let i = 0; i < d.length; i++) { if (!Number.isFinite(d[i])) nonFinite++; energy += d[i] ** 2 }
    return { b64: b64(new Uint8Array(await (await lib.encodeAudioBufferToWav(res.vocals)).arrayBuffer())), duration: res.vocals.duration, nonFinite, rms: Math.sqrt(energy / d.length) }
  })
  return { output: out.b64, meta: { duration: out.duration, nonFinite: out.nonFinite, rms: out.rms } }
})

const duo = await persisted('two-speakers keep_vocal', async (page) => {
  const built = await buildDuo(page)
  const out = await page.evaluate(isolateAction, { mixB64: built.mixB64, assetId: 'rob-duo', mode: 'keep_vocal' })
  return { input: built.mixB64, gtV: built.gtVB64, output: out }
})

// ---------- remove_vocal cases (instrumental extraction) ---------------------
const monoRmv = await persisted('mono remove_vocal', async (page) => {
  const built = await buildMono(page)
  const out = await page.evaluate(isolateAction, { mixB64: built.mixB64, assetId: 'rob-mono-r', mode: 'remove_vocal' })
  return { output: out }
})

const hz48Rmv = await persisted('48kHz remove_vocal', async (page) => {
  const built = await build48k(page)
  const out = await page.evaluate(separateAt48k, { mixB64: built.mixB64, want: 'instrumental' })
  return { output: out.b64, meta: { duration: out.duration } }
})

const duoRmv = await persisted('voice-only remove_vocal', async (page) => {
  const built = await buildDuo(page)
  const out = await page.evaluate(isolateAction, { mixB64: built.mixB64, assetId: 'rob-duo-r', mode: 'remove_vocal' })
  return { input: built.mixB64, output: out }
})

// ---------- persist + score ---------------------------------------------------
function wav(p) {
  const b = readFileSync(p); const d = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const ch = b.readUInt16LE(22); let o = 12
  while (o < b.length - 8) { const id = b.toString('ascii', o, o + 4), sz = d.getUint32(o + 4, true); if (id === 'data') break; o += 8 + sz + (sz & 1) }
  const n = d.getUint32(o + 4, true) / (ch * 2)
  const out = Array.from({ length: ch }, () => new Float32Array(n))
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) out[c][i] = d.getInt16(o + 8 + (i * ch + c) * 2, true) / 32768
  return out
}
function siSdr(est, ref) {
  let se = 0, ss = 0
  for (let i = 0; i < est.length; i++) { se += est[i] * ref[i]; ss += est[i] * est[i] }
  const a = se / ss; let num = 0, den = 0
  for (let i = 0; i < est.length; i++) { const t = a * est[i]; num += (ref[i] - t) ** 2; den += ref[i] ** 2 }
  return 10 * Math.log10(den / num)
}
const score = (e, r) => {
  const ch = Math.min(e.length, r.length)
  let s = 0
  for (let c = 0; c < ch; c++) s += siSdr(e[c], r[c])
  return s / ch
}
const rmsDb = (chans) => {
  let s = 0, n = 0
  for (const c of chans) for (let i = 0; i < c.length; i++) { s += c[i] ** 2; n++ }
  return 10 * Math.log10(s / Math.max(1, n))
}
function save(name, b64) {
  const p = join(TMP, `${name}.wav`)
  writeFileSync(p, Buffer.from(b64, 'base64'))
  return p
}

const results = []
function check(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`)
}

// keep_vocal scoring
{
  save('mono-input', mono.input); save('mono-gt-voice', mono.gtV); save('mono-gt-music', mono.gtM); save('mono-output', mono.output)
  const s = score(wav(join(TMP, 'mono-output.wav')), wav(join(TMP, 'mono-gt-voice.wav')))
  check('mono keep_vocal: keeps the voice', s > 14, `SI-SDR ${s.toFixed(2)} dB vs clean mono voice (bar 14)`)
}
{
  save('48k-input', hz48.input); save('48k-gt-voice', hz48.gtV); save('48k-gt-music', hz48.gtM); save('48k-output', hz48.output)
  const s = score(wav(join(TMP, '48k-output.wav')), wav(join(TMP, '48k-gt-voice.wav')))
  const dur = wav(join(TMP, '48k-output.wav'))[0].length / 44100
  check('48 kHz keep_vocal: resample path correct', s > 14, `SI-SDR ${s.toFixed(2)} dB (input decoded at ${hz48.meta.inRate} Hz)`)
  check('48 kHz keep_vocal: duration preserved', Math.abs(dur - 6) < 0.02, `output ${dur.toFixed(3)}s (input 6.000s)`)
}
{
  save('short-output', short.output)
  const d = short.meta
  check('0.5 s clip: separation succeeds', d.nonFinite === 0 && d.rms > 1e-4, `duration ${d.duration.toFixed(3)}s, non-finite ${d.nonFinite}, rms ${d.rms.toFixed(4)}`)
}
{
  save('duo-input', duo.input); save('duo-gt-voice', duo.gtV); save('duo-output', duo.output)
  const s = score(wav(join(TMP, 'duo-output.wav')), wav(join(TMP, 'duo-gt-voice.wav')))
  check('two speakers keep_vocal: both voices survive', s > 14, `SI-SDR ${s.toFixed(2)} dB vs both-voices reference (bar 14)`)
}
// remove_vocal scoring
{
  save('mono-rmv-output', monoRmv.output)
  const s = score(wav(join(TMP, 'mono-rmv-output.wav')), wav(join(TMP, 'mono-gt-music.wav')))
  check('mono remove_vocal: instrumental survives the upmix path', s > 14, `SI-SDR ${s.toFixed(2)} dB vs clean mono music (bar 14)`)
}
{
  save('48k-rmv-output', hz48Rmv.output)
  const s = score(wav(join(TMP, '48k-rmv-output.wav')), wav(join(TMP, '48k-gt-music.wav')))
  const dur = wav(join(TMP, '48k-rmv-output.wav'))[0].length / 44100
  check('48 kHz remove_vocal: instrumental through the resample path', s > 14, `SI-SDR ${s.toFixed(2)} dB vs clean music (bar 14), duration ${dur.toFixed(3)}s`)
}
{
  save('duo-rmv-output', duoRmv.output)
  const residue = rmsDb(wav(join(TMP, 'duo-rmv-output.wav')))
  const mixLvl = rmsDb(wav(join(TMP, 'duo-input.wav')))
  check('voice-only remove_vocal: karaoke of a voice-only mix is (near-)silent', mixLvl - residue > 20, `residue ${residue.toFixed(1)} dBFS vs mix ${mixLvl.toFixed(1)} dBFS (${(mixLvl - residue).toFixed(1)} dB below, bar 20)`)
}

const runtimeErrors = [...mono.errors, ...hz48.errors, ...short.errors, ...duo.errors, ...monoRmv.errors, ...hz48Rmv.errors, ...duoRmv.errors]
check('zero runtime page errors', runtimeErrors.length === 0, runtimeErrors.join(' | ') || 'clean')

// ---------- evidence pack (listenable MP3 pairs) -----------------------------
const mp3 = (src, dst) => {
  const out = spawnSync(ffmpegInstaller.path, ['-nostdin', '-hide_banner', '-y', '-i', src, '-codec:a', 'libmp3lame', '-qscale:a', '2', dst], { encoding: 'utf8' })
  if (out.status !== 0) throw new Error(`ffmpeg failed: ${out.stderr.slice(-300)}`)
}
for (const [n, src] of [
  ['mono', 'mono-input'], ['48k', '48k-input'], ['duo', 'duo-input'],
]) mp3(join(TMP, `${src}.wav`), join(EVID, `input-${n}.mp3`))
for (const [n, src] of [
  ['mono', 'mono-output'], ['48k', '48k-output'], ['duo', 'duo-output'],
]) mp3(join(TMP, `${src}.wav`), join(EVID, `output-${n}-keep-vocal-demucs.mp3`))
for (const [n, src] of [
  ['mono', 'mono-rmv-output'], ['48k', '48k-rmv-output'], ['duo', 'duo-rmv-output'],
]) mp3(join(TMP, `${src}.wav`), join(EVID, `output-${n}-remove-vocal-demucs.mp3`))
mp3(join(TMP, 'short-output.wav'), join(EVID, 'output-short-clip-keep-vocal-demucs.mp3'))

writeFileSync(join(ROOT, 'qa/reports/voice-demucs-robustness.json'), JSON.stringify({
  date: new Date().toISOString(),
  results,
  summary: `${results.filter((r) => r.ok).length}/${results.length} PASS`,
}, null, 2))

const passed = results.filter((r) => r.ok).length
console.log(`\nRESULT ${passed}/${results.length} PASS — report: qa/reports/voice-demucs-robustness.json`)
if (passed !== results.length) process.exit(1)
