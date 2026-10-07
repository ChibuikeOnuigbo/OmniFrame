/**
 * Slowed-production speed-fix E2E — proves the in-app auto feature end to end:
 *
 *   A. real "ultra slowed" track (UPAST - HELLBLADE, repo root):
 *      detectSlowedFactor must fire on the REAL track the feature was built
 *      for (voice undetectable at native speed, clearly detectable sped up).
 *   B. mechanism proof with ground truth: a 4.5 s showcase mix slowed ×0.75
 *      (WebAudio playbackRate render = the same asetrate semantics the real
 *      edits use). Separating at the corrected speed (speedFactor 4/3) must
 *      beat separating the slowed mix directly (SI-SDR vs slowed GT voice),
 *      and the output must be restored to the exact input length.
 *   C. no-op safety: the normal-speed showcase mix must NOT be flagged
 *      (detection returns 1 after the cheap first pass).
 *   D. real track, user-facing action path: a 6 s window of the real track
 *      (60-66 s — Silero cannot hear the slowed vocals in the mix natively
 *      but clearly can when sped up) through executeVoiceIsolationForClip —
 *      auto speed-fix ON (default) vs speedNormalize:false (old behavior),
 *      both at strength 0.5 (1-pass — the sandbox cannot fit the action
 *      path's default 3-pass; the full-track default-strength run is
 *      validated offline in evidence/voice/realworld). Detection must fire
 *      in the action log, timing must be restored exactly, and the fixed
 *      acapella must not be degraded.
 *   E. where the fix actually pays: the 78-84 s window of the real track.
 *      Full-track evidence (Req 11, committed MP3s) shows the speed fix's
 *      gain is concentrated in buried-vocal sections like this one (Silero
 *      mean 0.105 -> 0.329, 3x) while prominent hooks are near-equal — and
 *      detection needs hook context, so a 6 s buried-vocal clip cannot fire
 *      it standalone. E therefore forces the factor the full-track
 *      detection chose (x1.45) through the real separator and asserts the
 *      recovered voice content.
 *   R. resampler fidelity: the polyphase sinc in renderAtRate must beat
 *      WebAudio's playbackRate rendering (measured 10.5 dB bandlimited
 *      round-trip) by a wide margin — bar > 45 dB.
 *   G. natural-pitch output: keep_vocal with speedOutput 'natural' on the
 *      real-track segment — the acapella must come back at the corrected
 *      speed (shorter), named distinctly, with real voice at natural pitch
 *      directly audible to Silero (no re-speeding needed).
 *   F. instrumental false-positive guard: a music-only mix through the
 *      action path with the auto fix ON. Detection scans all four factors,
 *      finds no voice at any speed, and must return 1 — the old behavior,
 *      unchanged. (The legacy model/robustness suites exceed this sandbox
 *      instance's memory — 20 s x3-pass / two-evaluate action cases — and
 *      their committed reports stand from the instance they ran on; C + F
 *      are this instance's no-op regression coverage for the detector.)
 *
 * One case per browser process (consecutive separations OOM the sandbox);
 * results cached per case in tmp so crashed runs resume.
 *
 * Outputs:
 *   qa/reports/voice-slowed-fix.json
 *   evidence/voice/slowed/{input,output}-*.mp3 (listenable pairs)
 *   evidence/voice/slowed/README.md is written by hand, not here.
 *
 * Requires: dev server :5173, public/models/{htdemucs,silero-vad-v5}.onnx.
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
const TMP = join(tmpdir(), 'voice-slowed')
const EVID = join(ROOT, 'evidence/voice/slowed')
mkdirSync(TMP, { recursive: true })
mkdirSync(EVID, { recursive: true })

const REAL_TRACK = join(ROOT, 'UPAST (Ultra Slowed) - HELLBLADE.mp3')
if (!existsSync(REAL_TRACK)) throw new Error('real track missing at repo root')
for (const m of ['htdemucs.onnx', 'silero-vad-v5.onnx']) {
  if (!existsSync(join(ROOT, 'public/models', m))) throw new Error(`public/models/${m} missing — run npm run fetch:demucs`)
}

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

const REAL_B64 = readFileSync(REAL_TRACK).toString('base64')

// In-page helpers (installed on window once).
const PAGE_LIB = `
  async function load(ctx, url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error('fetch ' + url + ' -> ' + res.status)
    return ctx.decodeAudioData(await res.arrayBuffer())
  }
  function b64(bytes) {
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return btoa(bin)
  }
  function fromB64(s) {
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer
  }
  async function wavB64(lib, buf) {
    return b64(new Uint8Array(await (await lib.encodeAudioBufferToWav(buf)).arrayBuffer()))
  }
`

// ---------- browser plumbing ------------------------------------------------
async function withPage(fn) {
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
    await page.evaluate(`(() => { ${PAGE_LIB} window.__h = { load, b64, fromB64, wavB64 } })()`)
    const out = await fn(page)
    return { ...out, errors }
  } finally {
    await browser.close()
  }
}

async function runCase(name, caseBody) {
  // let the OS reclaim the previous case's WASM pages before the next renderer
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

// ---------- case A: detection on the REAL full track ------------------------
const caseA = await persisted('A real-track detection', async (page) => {
  return page.evaluate(async (mp3B64) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 })
    const buf = await ctx.decodeAudioData(window.__h.fromB64(mp3B64))
    const vad = await import('/src/lib/vad.ts')
    const det = await vad.detectSlowedFactor(buf)
    await ctx.close()
    return {
      duration: buf.duration,
      factor: det.factor,
      baselineMean: det.baselineMean,
      bestMean: det.bestMean,
      scanned: det.scanned,
    }
  }, REAL_B64)
})

// ---------- case C: normal mix must be a no-op -------------------------------
const caseC = await persisted('C no-op safety', async (page) => {
  return page.evaluate(async () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 })
    const voice = await window.__h.load(ctx, 'qa/assets/voice/tts-m1-numbers.mp3')
    const bed = await window.__h.load(ctx, 'qa/assets/voice/pad-chords.wav')
    const len = Math.min(voice.length, bed.length, 6 * 44100)
    const mix = ctx.createBuffer(2, len, 44100)
    const vL = voice.getChannelData(0), vR = voice.numberOfChannels > 1 ? voice.getChannelData(1) : voice.getChannelData(0)
    const bL = bed.getChannelData(0), bR = bed.numberOfChannels > 1 ? bed.getChannelData(1) : bed.getChannelData(0)
    const mL = mix.getChannelData(0), mR = mix.getChannelData(1)
    let vr = 0, br = 0, n = 0
    for (let i = 0; i < len; i++) { vr += vL[i] * vL[i]; br += bL[i] * bL[i]; n++ }
    const vg = 0.16 / Math.sqrt(vr / n), bg = 0.16 / Math.sqrt(br / n)
    for (let i = 0; i < len; i++) { mL[i] = vL[i] * vg + bL[i] * bg; mR[i] = vR[i] * vg + bR[i] * bg }
    const vad = await import('/src/lib/vad.ts')
    const det = await vad.detectSlowedFactor(mix)
    await ctx.close()
    return { factor: det.factor, baselineMean: det.baselineMean, scanned: det.scanned, mixB64: null }
  })
})

// ---------- case R: resampler fidelity ----------------------------------------
const caseR = await persisted('R resampler fidelity', async (page) => {
  return page.evaluate(async () => {
    const vad = await import('/src/lib/vad.ts')
    const sr = 44100, len = 3 * sr
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: sr })
    const buf = ctx.createBuffer(2, len, sr)
    // fully bandlimited <= 12 kHz (sum of tones) so the anti-aliasing cut at
    // the x1.45 new Nyquist (~15.2 kHz) removes nothing legitimate
    const tones = []
    for (let f = 200; f <= 12000; f += 137) tones.push(f)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < len; i++) {
        const t = i / sr
        let v = 0
        for (let k = 0; k < tones.length; k++) v += Math.sin(2 * Math.PI * tones[k] * t + k)
        d[i] = (v / tones.length) * 3
      }
    }
    async function snr(f) {
      const sped = await vad.renderAtRate(buf, f)
      const back = await vad.renderAtRate(sped, 1 / f)
      const a = buf.getChannelData(0), b = back.getChannelData(0)
      const n = Math.min(a.length, b.length)
      let bestOff = 0, bestCor = -Infinity
      for (let off = -64; off <= 64; off++) {
        let cor = 0
        for (let i = 4096; i < n - 4096; i += 13) cor += a[i] * b[i + off]
        if (cor > bestCor) { bestCor = cor; bestOff = off }
      }
      let es = 0, en = 0
      for (let i = 8192; i < n - 8192; i++) { const e = a[i] - b[i + bestOff]; en += e * e; es += a[i] * a[i] }
      return 10 * Math.log10(es / en)
    }
    const r = { x145: await snr(1.45), x133: await snr(4 / 3) }
    await ctx.close()
    return r
  })
})

// ---------- case B: synthetic slowed mix, forced fix, SI-SDR ------------------
// Sandbox memory is razor-thin: each case must do its build AND its (single)
// separation in ONE evaluate with ONE closed AudioContext — a second
// separation, or leftover open contexts, OOM the renderer (probed: 6 s x2
// passes fits with ~3.9 GB total RAM; 8 s or 3 passes does not).
const caseB1 = await persisted('B1 synthetic direct', async (page) => {
  return page.evaluate(async () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 })
    const lib = await import('/src/lib/voiceIsolation.ts')
    const vad = await import('/src/lib/vad.ts')
    const demucs = await import('/src/lib/demucs/index.ts')
    const enc = (buf) => window.__h.wavB64(lib, buf)
    const voice = await window.__h.load(ctx, 'qa/assets/voice/tts-m1-numbers.mp3')
    const bed = await window.__h.load(ctx, 'qa/assets/voice/pad-chords.wav')
    // 4.5 s native → 6 s slowed: the sandbox OOMs 2-pass separation above ~6 s
    const len = Math.min(voice.length, bed.length, Math.round(4.5 * 44100))
    const mix = ctx.createBuffer(2, len, 44100)
    const gtV = ctx.createBuffer(2, len, 44100)
    const vL = voice.getChannelData(0), vR = voice.numberOfChannels > 1 ? voice.getChannelData(1) : voice.getChannelData(0)
    const bL = bed.getChannelData(0), bR = bed.numberOfChannels > 1 ? bed.getChannelData(1) : bed.getChannelData(0)
    const mL = mix.getChannelData(0), mR = mix.getChannelData(1)
    const gL = gtV.getChannelData(0), gR = gtV.getChannelData(1)
    let vr = 0, br = 0, n = 0
    for (let i = 0; i < len; i++) { vr += vL[i] * vL[i]; br += bL[i] * bL[i]; n++ }
    const vg = 0.16 / Math.sqrt(vr / n), bg = 0.16 / Math.sqrt(br / n)
    for (let i = 0; i < len; i++) {
      mL[i] = vL[i] * vg + bL[i] * bg; mR[i] = vR[i] * vg + bR[i] * bg
      gL[i] = vL[i] * vg; gR[i] = vR[i] * vg
    }
    // slow the whole production x0.75 (playbackRate render = asetrate
    // semantics: pitch and time scale together, like the real edits)
    const slowedMix = await vad.renderAtRate(mix, 0.75)
    const slowedGT = await vad.renderAtRate(gtV, 0.75)
    const mixB64 = await enc(slowedMix)
    const gtB64 = await enc(slowedGT)
    // round-trip the mix through wav bytes like a real asset upload
    const mixBack = await ctx.decodeAudioData(window.__h.fromB64(mixB64))
    const direct = await demucs.separateWithDemucs(ctx, mixBack, null, { passes: 2 })
    const directB64 = await enc(direct.vocals)
    const res = { mixB64, gtB64, directB64, directLen: direct.vocals.length, inLen: mixBack.length, nativeLen: len }
    await ctx.close()
    return res
  })
})

const caseB2 = await persisted('B2 synthetic fixed', async (page) => {
  return page.evaluate(async (mixB64) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 })
    const lib = await import('/src/lib/voiceIsolation.ts')
    const demucs = await import('/src/lib/demucs/index.ts')
    const slowedMix = await ctx.decodeAudioData(window.__h.fromB64(mixB64))
    const fixed = await demucs.separateWithDemucs(ctx, slowedMix, null, { passes: 2, speedFactor: 4 / 3 })
    const fixedB64 = await window.__h.wavB64(lib, fixed.vocals)
    const res = { fixedB64, fixedLen: fixed.vocals.length }
    await ctx.close()
    return res
  }, caseB1.mixB64)
})

// ---------- case D: real segment through the user-facing action ---------------
// D0 builds the segment + runs detection (light). D1/D2 each do exactly ONE
// isolation through the real action — D1 = old behavior (speedNormalize:false),
// D2 = new default (auto). Segment = 60-66 s: a window in the REAL failure
// mode (py study tool: native Silero 0.012 — cannot hear the slowed vocals —
// but 0.79-0.83 when sped x1.3-x1.6). The loudest hook (42-51 s) is natively
// detectable (0.45-0.53) yet Demucs still fails to separate it: Silero-
// hearable is not Demucs-separable, and detection keys on the full-track
// average (0.0005 native → decisive). Strength 0.5 = 1-pass: the action path
// also loads main-thread Silero (vadGate) + asset buffers on top of the
// demucs worker, and 2-pass OOMs the sandbox there (see header).
const caseD0 = await persisted('D0 real segment build', async (page) => {
  return page.evaluate(async (mp3B64) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 })
    const lib = await import('/src/lib/voiceIsolation.ts')
    const vad = await import('/src/lib/vad.ts')
    const full = await ctx.decodeAudioData(window.__h.fromB64(mp3B64))
    // 60-66 s = the real failure mode (see case-D comment above)
    const sr = full.sampleRate
    const start = 60 * sr, len = 6 * sr
    const seg = ctx.createBuffer(2, len, sr)
    for (let c = 0; c < 2; c++) seg.copyToChannel(full.getChannelData(c).subarray(start, start + len), c)
    const det = await vad.detectSlowedFactor(seg)
    const res = {
      segB64: await window.__h.wavB64(lib, seg),
      len, sr,
      detection: { factor: det.factor, baselineMean: det.baselineMean, bestMean: det.bestMean, scanned: det.scanned },
    }
    await ctx.close()
    return res
  }, REAL_B64)
})

// Silero vet at natural pitch: speed the acapella up by the detected factor
// so real voice is in-distribution for the VAD model.
async function isolateViaAction(page, { segB64, len, factor, assetId, options }) {
  return page.evaluate(async ({ segB64, len, factor, assetId, options }) => {
    const lib = await import('/src/lib/voiceIsolation.ts')
    const vad = await import('/src/lib/vad.ts')
    const store = window.__omniframe_store
    store.getState().addAsset({ id: assetId, name: assetId + '.wav', kind: 'audio', url: 'data:audio/wav;base64,' + segB64, duration: len / 44100, width: 0, height: 0, size: 0 })
    const cur = store.getState()
    cur.addClipToTrack(cur.ensureTrack('audio'), assetId, 0)
    const clip = store.getState().clips.find((x) => x.assetId === assetId)
    const msgs = []
    const res = await lib.executeVoiceIsolationForClip(clip.id, options, (pct, msg) => msgs.push(`${pct}: ${msg}`))
    const asset = store.getState().assets.find((a) => a.id === res.assetId)
    const outB64 = window.__h.b64(new Uint8Array(await (await fetch(asset.url)).arrayBuffer()))
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 })
    const buf = await ctx.decodeAudioData(window.__h.fromB64(outB64))
    const { probs } = await vad.detectSpeech(await vad.renderAtRate(buf, factor || 1.3))
    let sum = 0, hot = 0, peak = 0
    for (const p of probs) { sum += p; if (p > 0.5) hot++; if (p > peak) peak = p }
    await ctx.close()
    return {
      outB64, outLen: buf.length,
      vet: { mean: sum / probs.length, frames: hot / probs.length, peak },
      slowMsgs: msgs.filter((m) => /slow/i.test(m)),
    }
  }, { segB64, len, factor, assetId, options })
}

const caseD1 = await persisted('D1 real direct', async (page) => {
  return isolateViaAction(page, {
    segB64: caseD0.segB64, len: caseD0.len, factor: caseD0.detection.factor,
    assetId: 'rw-direct',
    options: { mode: 'keep_vocal', model: 'htdemucs-v4', strength: 0.5, speedNormalize: false },
  })
})

const caseD2 = await persisted('D2 real fixed', async (page) => {
  return isolateViaAction(page, {
    segB64: caseD0.segB64, len: caseD0.len, factor: caseD0.detection.factor,
    assetId: 'rw-fixed',
    options: { mode: 'keep_vocal', model: 'htdemucs-v4', strength: 0.5 },
  })
})

// ---------- case F: instrumental input must be a no-op ------------------------
// F0 builds the mix + runs detection standalone (light); F1 runs the action on
// the cached mix (same shape as D1/D2, which fit the sandbox).
const caseF0 = await persisted('F0 instrumental detect', async (page) => {
  return page.evaluate(async () => {
    const lib = await import('/src/lib/voiceIsolation.ts')
    const vad = await import('/src/lib/vad.ts')
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 })
    const bed = await window.__h.load(ctx, 'qa/assets/voice/pad-chords.wav')
    const len = Math.min(bed.length, 6 * 44100)
    const mix = ctx.createBuffer(2, len, 44100)
    for (let c = 0; c < 2; c++) {
      const b = bed.getChannelData(Math.min(c, bed.numberOfChannels - 1))
      mix.getChannelData(c).set(b.subarray(0, len))
    }
    const mixB64 = await window.__h.wavB64(lib, mix)
    const det = await vad.detectSlowedFactor(mix)
    const d = mix.getChannelData(0)
    let e = 0
    for (let i = 0; i < d.length; i++) e += d[i] * d[i]
    const res = {
      mixB64, len, mixLvl: 10 * Math.log10(e / d.length),
      detection: { factor: det.factor, baselineMean: det.baselineMean, scanned: det.scanned },
    }
    await ctx.close()
    return res
  })
})

const caseF1 = await persisted('F1 instrumental action', async (page) => {
  return page.evaluate(async ({ mixB64, len }) => {
    const lib = await import('/src/lib/voiceIsolation.ts')
    const store = window.__omniframe_store
    store.getState().addAsset({ id: 'rw-inst', name: 'rw-inst.wav', kind: 'audio', url: 'data:audio/wav;base64,' + mixB64, duration: len / 44100, width: 0, height: 0, size: 0 })
    const cur = store.getState()
    cur.addClipToTrack(cur.ensureTrack('audio'), 'rw-inst', 0)
    const clip = store.getState().clips.find((x) => x.assetId === 'rw-inst')
    const msgs = []
    const res = await lib.executeVoiceIsolationForClip(clip.id, { mode: 'keep_vocal', model: 'htdemucs-v4', strength: 0.5 }, (pct, msg) => msgs.push(`${pct}: ${msg}`))
    const asset = store.getState().assets.find((a) => a.id === res.assetId)
    const outB64 = window.__h.b64(new Uint8Array(await (await fetch(asset.url)).arrayBuffer()))
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 })
    const out = await ctx.decodeAudioData(window.__h.fromB64(outB64))
    const d = out.getChannelData(0)
    let e = 0
    for (let i = 0; i < d.length; i++) e += d[i] * d[i]
    const r = {
      outB64, outLen: out.length,
      outLvl: 10 * Math.log10(e / d.length),
      slowMsgs: msgs.filter((m) => /slow/i.test(m)),
    }
    await ctx.close()
    return r
  }, { mixB64: caseF0.mixB64, len: caseF0.len })
})

// ---------- case G: natural-pitch output through the action -------------------
const caseG = await persisted('G natural pitch', async (page) => {
  return page.evaluate(async ({ segB64, len, factor }) => {
    const lib = await import('/src/lib/voiceIsolation.ts')
    const vad = await import('/src/lib/vad.ts')
    const store = window.__omniframe_store
    store.getState().addAsset({ id: 'rw-nat', name: 'rw-nat.wav', kind: 'audio', url: 'data:audio/wav;base64,' + segB64, duration: len / 44100, width: 0, height: 0, size: 0 })
    const cur = store.getState()
    cur.addClipToTrack(cur.ensureTrack('audio'), 'rw-nat', 0)
    const clip = store.getState().clips.find((x) => x.assetId === 'rw-nat')
    const msgs = []
    const res = await lib.executeVoiceIsolationForClip(clip.id, { mode: 'keep_vocal', model: 'htdemucs-v4', strength: 0.5, speedOutput: 'natural' }, (pct, msg) => msgs.push(`${pct}: ${msg}`))
    const asset = store.getState().assets.find((a) => a.id === res.assetId)
    const outB64 = window.__h.b64(new Uint8Array(await (await fetch(asset.url)).arrayBuffer()))
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 })
    const buf = await ctx.decodeAudioData(window.__h.fromB64(outB64))
    // the output is ALREADY at natural pitch — Silero hears it directly
    const { probs } = await vad.detectSpeech(buf)
    let sum = 0, hot = 0, peak = 0, clipd = 0, nonFinite = 0
    for (const p of probs) { sum += p; if (p > 0.5) hot++; if (p > peak) peak = p }
    const d = buf.getChannelData(0)
    let maxA = 0
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > maxA) maxA = a; if (!Number.isFinite(d[i])) nonFinite++ }
    const r = {
      name: asset.name,
      duration: buf.duration,
      expectedDuration: len / 44100 / (factor || 1.45),
      silero: { mean: sum / probs.length, frames: hot / probs.length, peak },
      maxAbs: maxA, clipped: clipd, nonFinite,
      msgs: msgs.filter((m) => /slow|natural|pitch/i.test(m)),
    }
    await ctx.close()
    return { ...r, outB64 }
  }, { segB64: caseD0.segB64, len: caseD0.len, factor: caseD0.detection.factor })
})

// ---------- rich vet (energy-weighted, non-saturating) -----------------------
// Silero mean/frames saturate near 1.0 on dense windows (both acapellas score
// ~0.9) — they cannot separate "all the vocals" from "the loud half". The py
// study tool's energy-weighted metrics discriminate: voiceLikeFrac = share of
// the acapella's energy that is voice-like; recovery = voice-like energy kept
// vs the sped-up mix. All computed in-page with the real app code.
async function richVetCase(name, { segB64, factor, aB64, bB64 }) {
  return persisted(name, async (page) => {
    return page.evaluate(async ({ segB64, factor, aB64, bB64 }) => {
      const vad = await import('/src/lib/vad.ts')
      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 })
      const fromB64 = window.__h.fromB64
      const seg = await ctx.decodeAudioData(fromB64(segB64))
      const a = await ctx.decodeAudioData(fromB64(aB64))
      const b = await ctx.decodeAudioData(fromB64(bB64))
      const f = factor || 1.45
      async function vet(buf) {
        const sped = await vad.renderAtRate(buf, f)
        const { probs } = await vad.detectSpeech(sped)
        const m = sped.getChannelData(0)
        const sr = sped.sampleRate
        const fl = Math.round((512 * sr) / 16000) // 32 ms frame at buffer rate
        const nf = Math.min(probs.length, Math.floor(m.length / fl))
        let tot = 0, voc = 0
        for (let i = 0; i < nf; i++) {
          let e = 0
          for (let j = i * fl; j < (i + 1) * fl; j++) e += m[j] * m[j]
          tot += e
          voc += e * probs[i]
        }
        let sum = 0, hot = 0
        for (const p of probs) { sum += p; if (p > 0.5) hot++ }
        const mono = buf.getChannelData(0)
        let rms = 0
        for (let i = 0; i < mono.length; i++) rms += mono[i] * mono[i]
        return {
          voiceLikeFrac: voc / Math.max(tot, 1e-12),
          voiceEnergy: voc,
          spedMean: sum / probs.length,
          spedFrames: hot / probs.length,
          rms: Math.sqrt(rms / mono.length),
        }
      }
      const [segV, aV, bV] = await Promise.all([vet(seg), vet(a), vet(b)])
      const res = {
        factor: f,
        segment: segV,
        a: aV, b: bV,
        aRecovery: aV.voiceEnergy / Math.max(segV.voiceEnergy, 1e-12),
        bRecovery: bV.voiceEnergy / Math.max(segV.voiceEnergy, 1e-12),
      }
      await ctx.close()
      return res
    }, { segB64, factor, aB64, bB64 })
  })
}

const caseDV = await richVetCase('D vet rich', {
  segB64: caseD0.segB64, factor: caseD0.detection.factor,
  aB64: caseD1.outB64, bB64: caseD2.outB64,
})

// ---------- case E: buried-vocal window, forced factor ------------------------
// 78-84 s is where the committed full-track evidence shows the fix's gain
// (v1 Silero mean 0.105 -> v2 0.329). Detection cannot fire on this 6 s clip
// standalone (the mix buries the vocals even when sped up) — the factor the
// FULL-track detection chose (case A / D0: x1.45) is forced through the real
// separator. passes:1 = the CI ceiling (see header).
const caseE0 = await persisted('E0 buried-window build', async (page) => {
  return page.evaluate(async (mp3B64) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 })
    const lib = await import('/src/lib/voiceIsolation.ts')
    const full = await ctx.decodeAudioData(window.__h.fromB64(mp3B64))
    const sr = full.sampleRate
    const start = 78 * sr, len = 6 * sr
    const seg = ctx.createBuffer(2, len, sr)
    for (let c = 0; c < 2; c++) seg.copyToChannel(full.getChannelData(c).subarray(start, start + len), c)
    const res = { segB64: await window.__h.wavB64(lib, seg), len }
    await ctx.close()
    return res
  }, REAL_B64)
})

const caseE1 = await persisted('E1 buried direct', async (page) => {
  return page.evaluate(async ({ segB64 }) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 })
    const lib = await import('/src/lib/voiceIsolation.ts')
    const demucs = await import('/src/lib/demucs/index.ts')
    const seg = await ctx.decodeAudioData(window.__h.fromB64(segB64))
    const direct = await demucs.separateWithDemucs(ctx, seg, null, { passes: 1 })
    const res = { outB64: await window.__h.wavB64(lib, direct.vocals), outLen: direct.vocals.length }
    await ctx.close()
    return res
  }, { segB64: caseE0.segB64 })
})

const caseE2 = await persisted('E2 buried fixed', async (page) => {
  return page.evaluate(async ({ segB64 }) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 })
    const lib = await import('/src/lib/voiceIsolation.ts')
    const demucs = await import('/src/lib/demucs/index.ts')
    const seg = await ctx.decodeAudioData(window.__h.fromB64(segB64))
    const fixed = await demucs.separateWithDemucs(ctx, seg, null, { passes: 1, speedFactor: 1.45 })
    const res = { outB64: await window.__h.wavB64(lib, fixed.vocals), outLen: fixed.vocals.length }
    await ctx.close()
    return res
  }, { segB64: caseE0.segB64 })
})

const caseEV = await richVetCase('E vet rich', {
  segB64: caseE0.segB64, factor: 1.45,
  aB64: caseE1.outB64, bB64: caseE2.outB64,
})

// ---------- scoring ----------------------------------------------------------
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
  const n = Math.min(e[0].length, r[0].length)
  let s = 0
  for (let c = 0; c < ch; c++) s += siSdr(e[c].subarray(0, n), r[c].subarray(0, n))
  return s / ch
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

// A — detection on the real track
{
  const grid = caseA.scanned.map((s) => `x${s.factor}=${s.mean.toFixed(3)}`).join(' ')
  check('A: real slowed track detected',
    caseA.factor >= 1.15 && caseA.factor <= 1.6,
    `factor x${caseA.factor} on ${caseA.duration.toFixed(0)}s track (grid ${grid}), native voice-detectability ${caseA.baselineMean.toFixed(4)}`)
}

// C — normal mix untouched
{
  check('C: normal-speed mix is a no-op',
    caseC.factor === 1 && caseC.scanned.length === 1,
    `factor ${caseC.factor} after ${caseC.scanned.length} Silero pass(es), baseline ${caseC.baselineMean.toFixed(3)} (>0.08 = clearly voiced at native speed)`)
}

// B — forced fix beats direct on the synthetic slowed mix
{
  save('b-mix', caseB1.mixB64); save('b-gt', caseB1.gtB64)
  save('b-direct', caseB1.directB64); save('b-fixed', caseB2.fixedB64)
  const sDirect = score(wav(join(TMP, 'b-direct.wav')), wav(join(TMP, 'b-gt.wav')))
  const sFixed = score(wav(join(TMP, 'b-fixed.wav')), wav(join(TMP, 'b-gt.wav')))
  check('B: speed-corrected separation beats direct (SI-SDR)',
    sFixed > sDirect,
    `fixed ${sFixed.toFixed(2)} dB vs direct ${sDirect.toFixed(2)} dB (${(sFixed - sDirect).toFixed(2)} dB gain)`)
  check('B: output restored to exact input length',
    caseB2.fixedLen === caseB1.inLen,
    `fixed ${caseB2.fixedLen} samples vs input ${caseB1.inLen} (direct ${caseB1.directLen}, native mix ${caseB1.nativeLen})`)
}

// D — real track through the action path: mechanics + never-degraded
{
  const dv = caseD1.vet, fv = caseD2.vet
  const rv = caseDV
  check('D: auto-detection fired in the action',
    caseD0.detection.factor > 1 && caseD2.slowMsgs.some((m) => /Slowed production detected/.test(m)) && caseD1.slowMsgs.length === 0,
    `factor x${caseD0.detection.factor}, action log: "${caseD2.slowMsgs[0] || '—'}"; old path log had ${caseD1.slowMsgs.length} speed messages`)
  check('D: fixed acapella keeps the input timing',
    caseD2.outLen === caseD0.len,
    `fixed ${caseD2.outLen} samples vs input ${caseD0.len}`)
  check('D: auto fix never degrades the output',
    rv.b.voiceLikeFrac >= rv.a.voiceLikeFrac - 0.02 && rv.bRecovery >= rv.aRecovery - 0.02,
    `voice-like energy ${rv.a.voiceLikeFrac.toFixed(3)} → ${rv.b.voiceLikeFrac.toFixed(3)}, recovery ${rv.aRecovery.toFixed(3)} → ${rv.bRecovery.toFixed(3)} on this prominent-vocal window (both approaches already work here — the fix's big win is on buried vocals, see E and the full-track evidence)`)
}

// E — buried-vocal window: the fix recovers voice the direct pass misses
{
  const rv = caseEV
  check('E: speed-corrected separation recovers buried vocals',
    rv.b.spedMean > 1.3 * rv.a.spedMean && rv.b.voiceLikeFrac > rv.a.voiceLikeFrac + 0.1,
    `Silero at natural pitch — direct mean ${rv.a.spedMean.toFixed(3)} / voice-like energy ${(rv.a.voiceLikeFrac * 100).toFixed(1)}% vs fixed mean ${rv.b.spedMean.toFixed(3)} / voice-like energy ${(rv.b.voiceLikeFrac * 100).toFixed(1)}% (recovery ${(rv.aRecovery * 100).toFixed(0)}% → ${(rv.bRecovery * 100).toFixed(0)}%)`)
  check('E: fixed acapella keeps the input timing',
    caseE2.outLen === caseE0.len,
    `fixed ${caseE2.outLen} samples vs input ${caseE0.len}`)
}

// R — resampler fidelity
{
  check('R: polyphase sinc round-trip fidelity',
    caseR.x145 > 45 && caseR.x133 > 45,
    `bandlimited (<=12 kHz) speed-up/slow-back SNR — x1.45: ${caseR.x145.toFixed(1)} dB, x4:3: ${caseR.x133.toFixed(1)} dB (bar 45; WebAudio playbackRate measured 10.5-11.4 dB)`)
}

// G — natural-pitch output
{
  check('G: natural-pitch acapella comes back at the corrected speed',
    Math.abs(caseG.duration - caseG.expectedDuration) < 0.05 && /natural pitch/.test(caseG.name),
    `duration ${caseG.duration.toFixed(3)}s vs expected ${caseG.expectedDuration.toFixed(3)}s (input ${(caseD0.len / 44100).toFixed(1)}s / factor), asset "${caseG.name}"`)
  check('G: real voice directly audible at natural pitch',
    caseG.silero.mean > 0.5 && caseG.nonFinite === 0 && caseG.maxAbs <= 1,
    `Silero on the raw output: mean ${caseG.silero.mean.toFixed(3)}, voiced ${Math.round(caseG.silero.frames * 100)}%, peak ${caseG.silero.peak.toFixed(2)}; peak |sample| ${caseG.maxAbs.toFixed(3)}, non-finite ${caseG.nonFinite}`)
}

// F — instrumental input: detection scans and correctly declines
{
  const grid = caseF0.detection.scanned.map((x) => `x${x.factor}=${x.mean.toFixed(3)}`).join(' ')
  check('F: instrumental track not flagged',
    caseF0.detection.factor === 1 && !caseF1.slowMsgs.some((m) => /Slowed production detected/.test(m)),
    `factor 1 after scanning ${caseF0.detection.scanned.length - 1} factors (${grid}) — the harmonic pad scores 0.02-0.05 on Silero at every speed but never decisively, so the gate declines; action log shows the routine check and no detection`)
  check('F: instrumental keep_vocal output stays near-silent',
    caseF0.mixLvl - caseF1.outLvl > 20,
    `output ${caseF1.outLvl.toFixed(1)} dBFS vs mix ${caseF0.mixLvl.toFixed(1)} dBFS (${(caseF0.mixLvl - caseF1.outLvl).toFixed(1)} dB below, bar 20), length ${caseF1.outLen} === ${caseF0.len}`)
}

check('zero runtime page errors', [caseA, caseC, caseR, caseB1, caseB2, caseD0, caseD1, caseD2, caseG, caseE0, caseE1, caseE2, caseF0, caseF1].every((c) => c.errors.length === 0),
  [caseA, caseC, caseR, caseB1, caseB2, caseD0, caseD1, caseD2, caseG, caseE0, caseE1, caseE2, caseF0, caseF1].flatMap((c) => c.errors).join(' | ') || 'clean')

// ---------- evidence pack ------------------------------------------------------
const mp3 = (src, dst) => {
  const out = spawnSync(ffmpegInstaller.path, ['-nostdin', '-hide_banner', '-y', '-i', src, '-codec:a', 'libmp3lame', '-qscale:a', '2', dst], { encoding: 'utf8' })
  if (out.status !== 0) throw new Error(`ffmpeg failed: ${out.stderr.slice(-300)}`)
}
mp3(join(TMP, 'b-mix.wav'), join(EVID, 'input-showcase-slowed-x075.mp3'))
mp3(join(TMP, 'b-direct.wav'), join(EVID, 'output-showcase-slowed-direct-keep-vocal-demucs.mp3'))
mp3(join(TMP, 'b-fixed.wav'), join(EVID, 'output-showcase-slowed-speedfix-keep-vocal-demucs.mp3'))
mp3(save('d-seg', caseD0.segB64), join(EVID, 'input-realtrack-segment.mp3'))
mp3(save('d-direct', caseD1.outB64), join(EVID, 'output-realtrack-direct-keep-vocal-demucs.mp3'))
mp3(save('d-fixed', caseD2.outB64), join(EVID, 'output-realtrack-speedfix-keep-vocal-demucs.mp3'))
mp3(save('f-out', caseF1.outB64), join(EVID, 'output-instrumental-keep-vocal-demucs.mp3'))
mp3(save('g-out', caseG.outB64), join(EVID, 'output-realtrack-naturalpitch-keep-vocal-demucs.mp3'))
mp3(save('e-seg', caseE0.segB64), join(EVID, 'input-realtrack-buried-segment.mp3'))
mp3(save('e-direct', caseE1.outB64), join(EVID, 'output-realtrack-buried-direct-keep-vocal-demucs.mp3'))
mp3(save('e-fixed', caseE2.outB64), join(EVID, 'output-realtrack-buried-speedfix-keep-vocal-demucs.mp3'))

writeFileSync(join(ROOT, 'qa/reports/voice-slowed-fix.json'), JSON.stringify({
  date: new Date().toISOString(),
  results,
  detail: {
    realTrackDetection: { factor: caseA.factor, baselineMean: caseA.baselineMean, bestMean: caseA.bestMean, scanned: caseA.scanned },
    synthetic: {
      siSdrDirect: Number(score(wav(join(TMP, 'b-direct.wav')), wav(join(TMP, 'b-gt.wav'))).toFixed(2)),
      siSdrFixed: Number(score(wav(join(TMP, 'b-fixed.wav')), wav(join(TMP, 'b-gt.wav'))).toFixed(2)),
    },
    realSegment: {
      detection: caseD0.detection,
      actionLog: caseD2.slowMsgs,
      richVet: { direct: caseDV.a, fixed: caseDV.b, directRecovery: caseDV.aRecovery, fixedRecovery: caseDV.bRecovery },
    },
    buriedWindow: {
      direct: caseEV.a, fixed: caseEV.b,
      directRecovery: caseEV.aRecovery, fixedRecovery: caseEV.bRecovery,
    },
    instrumentalNoOp: {
      detection: caseF0.detection,
      mixLvl: caseF0.mixLvl, outLvl: caseF1.outLvl,
    },
    resamplerFidelity: caseR,
    naturalPitch: {
      name: caseG.name,
      duration: caseG.duration,
      expectedDuration: caseG.expectedDuration,
      silero: caseG.silero,
      actionLog: caseG.msgs,
    },
  },
}, null, 2))

const passed = results.filter((r) => r.ok).length
console.log(`\nRESULT ${passed}/${results.length} PASS — report: qa/reports/voice-slowed-fix.json`)
if (passed !== results.length) process.exit(1)
