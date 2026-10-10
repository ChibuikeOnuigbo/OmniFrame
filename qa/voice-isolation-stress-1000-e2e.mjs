/**
 * VOICE ISOLATION MODEL STRESS TEST — 1000 iterations
 * ===================================================
 *
 * Full-scale evaluation of OmniFrame's voice isolation DSP using a real TTS
 * voice corpus (synthesized for this study) mixed with synthesized music and
 * sound beds, run through the production `src/lib/voiceIsolation.ts` module
 * imported live from the dev server — the exact code the app ships.
 *
 * Pipeline per iteration:
 *   TTS voice + music bed  ->  mix at a controlled SNR  ->  isolateVoiceFromAudioBuffer()
 *   ->  score against the clean references.
 *
 * Measured per iteration:
 *   - inputSNR (by construction) and output SNR after separation
 *   - separationGain  = outputSNR - inputSNR          (superposition metric)
 *   - dSiSdr          = SI-SDR(out,voice) - SI-SDR(mix,voice)  (direct metric)
 *   - nonlinearity residual (how far the run deviates from sum of parts)
 *   - NaN/Inf integrity, wall-clock ms
 *
 * The grid spans 6 voices x 5 beds x 5 SNRs x 2 modes x 4 strengths x
 * 2 speech-focus settings (2400 combos); a coprime stride samples exactly
 * ITERATIONS combos with full coverage of every axis. Reference passes
 * (voice-only / bed-only through the DSP) are cached per (source, params).
 *
 * Extra checks: bit-exact determinism on a repeat run, and equality of the
 * four "model" tags on identical input (documents whether the model selector
 * changes the DSP).
 *
 * Usage:
 *   node qa/voice-isolation-stress-1000-e2e.mjs            # 1000 iterations
 *   ITERATIONS=40 node qa/voice-isolation-stress-1000-e2e.mjs   # pilot
 */
import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
const URL = process.env.TEST_URL || 'http://localhost:5173/#studio'
const REPORTS = join(ROOT, 'qa', 'reports')
const ITERATIONS = Number(process.env.ITERATIONS || 1000)
mkdirSync(REPORTS, { recursive: true })

// The music beds are deterministically synthesized; regenerate them when a
// fresh checkout has not built them yet.
const BEDS = [
  'pad-chords.wav',
  'arp-synth.wav',
  'drums-groove.wav',
  'ambient-noise.wav',
  'full-band.wav',
]
if (BEDS.some((bed) => !existsSync(join(ROOT, 'qa', 'assets', 'voice', bed)))) {
  console.log('[stress] synthesizing music beds (qa/generate-music-beds.mjs)...')
  const gen = spawnSync(process.execPath, [join('qa', 'generate-music-beds.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  if (gen.status !== 0) throw new Error('music bed generation failed')
}

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))

await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1000)

/**
 * Everything runs inside the page: fetch assets from the dev server, decode
 * with a 44.1 kHz AudioContext, import the live TS module, mix, isolate,
 * and score. No store shortcuts — the production DSP function itself.
 */
const payload = await page.evaluate(async (iterCount) => {
  const VOICES = [
    'qa/assets/voice/tts-f1-technical.mp3',
    'qa/assets/voice/tts-f1-questions.mp3',
    'qa/assets/voice/tts-f1-staccato.mp3',
    'qa/assets/voice/tts-m1-conversation.mp3',
    'qa/assets/voice/tts-m1-numbers.mp3',
    'qa/assets/voice/tts-m1-slow.mp3',
  ]
  const BEDS = [
    'qa/assets/voice/pad-chords.wav',
    'qa/assets/voice/arp-synth.wav',
    'qa/assets/voice/drums-groove.wav',
    'qa/assets/voice/ambient-noise.wav',
    'qa/assets/voice/full-band.wav',
  ]
  const MODELS = ['omni-voicetarget', 'htdemucs-v4', 'bs-roformer-lite', 'dsp-crossover-fast']
  const SNRS = [-10, -5, 0, 5, 10]
  const STRENGTHS = [0.5, 0.75, 0.92, 1.0]
  const FOCUS = [true, false]
  const ANALYSIS_SEC = 6
  const RATE = 44100

  const AC = window.AudioContext || window.webkitAudioContext
  const ctx = new AC({ sampleRate: RATE })
  const lib = await import('/src/lib/voiceIsolation.ts')

  async function loadStereo(url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`)
    const ab = await res.arrayBuffer()
    const buf = await ctx.decodeAudioData(ab)
    const L = Float32Array.from(buf.getChannelData(0))
    const R = Float32Array.from(buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0))
    return { L, R, nativeRate: buf.sampleRate, nativeChannels: buf.numberOfChannels }
  }

  const voices = []
  for (const url of VOICES) voices.push(await loadStereo(url))
  const beds = []
  for (const url of BEDS) beds.push(await loadStereo(url))

  const analysisLen = Math.floor(ANALYSIS_SEC * RATE)

  /** RMS of the mid channel over the analysis window; used for gain staging. */
  function midRms(src) {
    let sum = 0
    for (let i = 0; i < analysisLen; i++) {
      const m = (src.L[i] + src.R[i]) / 2
      sum += m * m
    }
    return Math.sqrt(sum / analysisLen)
  }

  /** Normalize a source so its mid channel RMS hits `target`. */
  function normalizeMid(src, target = 0.16) {
    const rms = midRms(src)
    const g = rms > 1e-9 ? target / rms : 1
    const L = new Float32Array(analysisLen)
    const R = new Float32Array(analysisLen)
    for (let i = 0; i < analysisLen; i++) {
      L[i] = src.L[i] * g
      R[i] = src.R[i] * g
    }
    return { L, R }
  }

  const voiceN = voices.map((v) => normalizeMid(v))
  const bedN = beds.map((b) => normalizeMid(b))

  // All sources are RMS-staged now, so unit gains put voice/bed at 0 dB SNR;
  // the bed gain then sets the requested SNR directly.
  function bedGainForSnr(snrDb) {
    return Math.pow(10, -snrDb / 20)
  }

  function toAudioBuffer(L, R) {
    const buf = ctx.createBuffer(2, analysisLen, RATE)
    buf.getChannelData(0).set(L)
    buf.getChannelData(1).set(R)
    return buf
  }

  function mixBuffers(voice, bed, bedGain) {
    const L = new Float32Array(analysisLen)
    const R = new Float32Array(analysisLen)
    for (let i = 0; i < analysisLen; i++) {
      L[i] = voice.L[i] + bed.L[i] * bedGain
      R[i] = voice.R[i] + bed.R[i] * bedGain
    }
    return { L, R }
  }

  function runDsp(src, opts) {
    const out = lib.isolateVoiceFromAudioBuffer(ctx, toAudioBuffer(src.L, src.R), opts)
    return { L: Float32Array.from(out.getChannelData(0)), R: Float32Array.from(out.getChannelData(1)) }
  }

  function midOf(src) {
    const m = new Float32Array(analysisLen)
    for (let i = 0; i < analysisLen; i++) m[i] = (src.L[i] + src.R[i]) / 2
    return m
  }

  function energy(arr) {
    let s = 0
    for (let i = 0; i < arr.length; i++) s += arr[i] * arr[i]
    return s / arr.length
  }

  /** Scale-invariant SDR between a clean reference and an estimate. */
  function siSdr(ref, est) {
    let dot = 0
    let refE = 0
    for (let i = 0; i < ref.length; i++) {
      dot += est[i] * ref[i]
      refE += ref[i] * ref[i]
    }
    if (refE < 1e-12) return NaN
    const alpha = dot / refE
    let err = 0
    let sig = 0
    for (let i = 0; i < ref.length; i++) {
      const s = alpha * ref[i]
      err += (est[i] - s) * (est[i] - s)
      sig += s * s
    }
    if (err < 1e-12) return 99
    return 10 * Math.log10(sig / err)
  }

  function hasNonFinite(src) {
    for (let i = 0; i < analysisLen; i++) {
      if (!Number.isFinite(src.L[i]) || !Number.isFinite(src.R[i])) return true
    }
    return false
  }

  /** Cached unit-gain single-source passes: DSP is (effectively) homogeneous,
   *  so energies at gain g scale by g^2 and the pass needs computing once per
   *  (source, mode, strength, focus). */
  const passCache = new Map()
  function unitPass(srcId, src, mode, strength, focus) {
    const key = `${srcId}|${mode}|${strength}|${focus}`
    let hit = passCache.get(key)
    if (!hit) {
      hit = runDsp(src, {
        mode,
        strength,
        speechFormantFocus: focus,
        preserveBass: true,
        model: 'omni-voicetarget',
      })
      hit.mid = midOf(hit)
      passCache.set(key, hit)
    }
    return hit
  }

  // ---- decode the (voice, bed, snr, params) grid ----
  const VOICE_COUNT = voiceN.length
  const BED_COUNT = bedN.length
  const PARAM_COUNT = MODELS && 2 * STRENGTHS.length * FOCUS.length // 16
  const MIXTURE_COUNT = VOICE_COUNT * BED_COUNT * SNRS.length // 150
  const TOTAL_COMBOS = MIXTURE_COUNT * PARAM_COUNT // 2400
  const STRIDE = 7 // coprime with 2400 -> distinct, well-spread samples

  const decodeCombo = (idx) => {
    const paramIdx = idx % PARAM_COUNT
    const rest = Math.floor(idx / PARAM_COUNT)
    const snrIdx = rest % SNRS.length
    const rest2 = Math.floor(rest / SNRS.length)
    const bedIdx = rest2 % BED_COUNT
    const voiceIdx = Math.floor(rest2 / BED_COUNT)
    const focusIdx = paramIdx % 2
    const strengthIdx = Math.floor(paramIdx / 2) % STRENGTHS.length
    const modeIdx = Math.floor(paramIdx / (2 * STRENGTHS.length)) % 2
    return { voiceIdx, bedIdx, snrIdx, modeIdx, strengthIdx, focusIdx }
  }

  const results = []
  const t0 = performance.now()
  let mixRunMsTotal = 0

  for (let i = 0; i < iterCount; i++) {
    const idx = (i * STRIDE) % TOTAL_COMBOS
    const { voiceIdx, bedIdx, snrIdx, modeIdx, strengthIdx, focusIdx } = decodeCombo(idx)
    const mode = modeIdx === 0 ? 'keep_vocal' : 'remove_vocal'
    const strength = STRENGTHS[strengthIdx]
    const focus = FOCUS[focusIdx]
    const model = MODELS[i % MODELS.length]
    const snrDb = SNRS[snrIdx]
    const bedGain = bedGainForSnr(snrDb)

    const voice = voiceN[voiceIdx]
    const bed = bedN[bedIdx]
    const opts = { mode, strength, speechFormantFocus: focus, preserveBass: true, model }

    // mixture -> production DSP
    const mixture = mixBuffers(voice, bed, bedGain)
    const mixMid = midOf(mixture)
    const tRun = performance.now()
    const out = runDsp(mixture, opts)
    const runMs = performance.now() - tRun
    mixRunMsTotal += runMs
    const outMid = midOf(out)

    // unit-gain reference passes (cached)
    const vPass = unitPass(`v${voiceIdx}`, voice, mode, strength, focus)
    const mPass = unitPass(`b${bedIdx}`, bed, mode, strength, focus)
    const vOutE = energy(vPass.mid) // unit gain
    const mOutE = energy(mPass.mid)

    const inputSnrVoice = snrDb // voice vs bed, mid energy
    // Superposition metrics. keep mode: voice is the target.
    // remove mode: the bed (instrumental) is the target.
    const outVoiceSnr = 10 * Math.log10(vOutE / (mOutE * bedGain * bedGain))
    const outBedSnr = 10 * Math.log10((mOutE * bedGain * bedGain) / vOutE)
    const separationGain =
      mode === 'keep_vocal' ? outVoiceSnr - inputSnrVoice : outBedSnr + inputSnrVoice

    // Direct metrics on the actual mixture run
    const voiceMid = midOf(voice)
    const bedMid = midOf(bed)
    const target = mode === 'keep_vocal' ? voiceMid : bedMid
    const siBefore = siSdr(target, mixMid)
    const siAfter = siSdr(target, outMid)

    // Nonlinearity residual: y vs (v_out + g*m_out)
    let resNum = 0
    let resDen = 0
    for (let j = 0; j < analysisLen; j++) {
      const pred = vPass.mid[j] + bedGain * mPass.mid[j]
      resNum += (outMid[j] - pred) * (outMid[j] - pred)
      resDen += outMid[j] * outMid[j]
    }
    const residual = Math.sqrt(resNum / Math.max(1e-12, resDen))

    results.push({
      i,
      voice: VOICES[voiceIdx].split('/').pop(),
      bed: BEDS[bedIdx].split('/').pop(),
      snrDb,
      mode,
      strength,
      focus,
      model,
      inputSnrVoice,
      outVoiceSnr,
      outBedSnr,
      separationGain,
      siBefore,
      siAfter,
      dSiSdr: siAfter - siBefore,
      residual,
      nonFinite: hasNonFinite(out),
      runMs,
    })

    if ((i + 1) % 100 === 0) {
      console.log(`[stress] ${i + 1}/${iterCount} iterations (mix DSP total ${mixRunMsTotal.toFixed(0)}ms)`)
    }
  }

  // ---- determinism: repeat iteration 0's exact config, compare bit-for-bit
  const det0 = decodeCombo(0)
  const detOpts = (m) => ({
    mode: m.modeIdx === 0 ? 'keep_vocal' : 'remove_vocal',
    strength: STRENGTHS[m.strengthIdx],
    speechFormantFocus: FOCUS[m.focusIdx],
    preserveBass: true,
  })
  const detVoice = voiceN[det0.voiceIdx]
  const detBed = bedN[det0.bedIdx]
  const detMix1 = mixBuffers(detVoice, detBed, bedGainForSnr(SNRS[det0.snrIdx]))
  const detOut1 = runDsp(detMix1, detOpts(det0))
  const detOut2 = runDsp(detMix1, detOpts(det0))
  let deterministic = detOut1.L.length === detOut2.L.length
  if (deterministic) {
    for (let i = 0; i < analysisLen; i++) {
      if (detOut1.L[i] !== detOut2.L[i] || detOut1.R[i] !== detOut2.R[i]) {
        deterministic = false
        break
      }
    }
  }

  // ---- model tag equivalence: same input + params, all four tags
  const tagBase = detOpts(det0)
  const tagOuts = MODELS.map((tag) =>
    runDsp(detMix1, { ...tagBase, model: tag }),
  )
  let tagsEquivalent = true
  for (const t of tagOuts) {
    for (let i = 0; i < analysisLen; i++) {
      if (t.L[i] !== tagOuts[0].L[i] || t.R[i] !== tagOuts[0].R[i]) {
        tagsEquivalent = false
        break
      }
    }
    if (!tagsEquivalent) break
  }

  const wallMs = performance.now() - t0
  await ctx.close()

  return {
    iterations: results.length,
    wallMs,
    mixRunMsTotal,
    dspPasses: passCache.size,
    deterministic,
    tagsEquivalent,
    models: MODELS,
    results,
    corpus: {
      voices: VOICES.map((v) => v.split('/').pop()),
      beds: BEDS.map((b) => b.split('/').pop()),
      snrs: SNRS,
      strengths: STRENGTHS,
    },
  }
}, ITERATIONS)

await browser.close()

/* ------------------------------------------------------------ aggregation */
const results = payload.results
const quantile = (arr, q) => {
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]
}
const stats = (arr) => {
  const clean = arr.filter(Number.isFinite)
  if (!clean.length) return null
  const mean = clean.reduce((a, b) => a + b, 0) / clean.length
  return {
    n: clean.length,
    mean,
    median: quantile(clean, 0.5),
    p10: quantile(clean, 0.1),
    p90: quantile(clean, 0.9),
    min: Math.min(...clean),
    max: Math.max(...clean),
  }
}

const byMode = {}
for (const mode of ['keep_vocal', 'remove_vocal']) {
  const rows = results.filter((r) => r.mode === mode)
  byMode[mode] = {
    separationGain: stats(rows.map((r) => r.separationGain)),
    dSiSdr: stats(rows.map((r) => r.dSiSdr)),
  }
}

const groupBy = (keyFn) => {
  const groups = {}
  for (const r of results) {
    const k = keyFn(r)
    ;(groups[k] ||= []).push(r)
  }
  const out = {}
  for (const [k, rows] of Object.entries(groups)) {
    out[k] = {
      n: rows.length,
      keepGain: stats(rows.filter((r) => r.mode === 'keep_vocal').map((r) => r.separationGain)),
      keepDsiSdr: stats(rows.filter((r) => r.mode === 'keep_vocal').map((r) => r.dSiSdr)),
      removeGain: stats(rows.filter((r) => r.mode === 'remove_vocal').map((r) => r.separationGain)),
    }
  }
  return out
}

const report = {
  generatedAt: new Date().toISOString(),
  iterations: payload.iterations,
  wallMs: payload.wallMs,
  avgMixRunMs: payload.mixRunMsTotal / payload.iterations,
  cachedReferencePasses: payload.dspPasses,
  corpus: payload.corpus,
  checks: {
    deterministic: payload.deterministic,
    modelTagsEquivalent: payload.tagsEquivalent,
    nonFiniteRuns: results.filter((r) => r.nonFinite).length,
  },
  byMode,
  byStrength: groupBy((r) => `strength_${r.strength}`),
  bySnr: groupBy((r) => `snr_${r.snrDb}dB`),
  byBed: groupBy((r) => r.bed),
  byVoice: groupBy((r) => r.voice),
  byFocus: groupBy((r) => `speechFocus_${r.focus}`),
  byModel: groupBy((r) => r.model),
  results,
}

writeFileSync(join(REPORTS, 'voice-isolation-stress-1000.json'), JSON.stringify(report, null, 2))

const fmt = (s) => (s ? `${s.median.toFixed(1)}dB median (mean ${s.mean.toFixed(1)}, p10 ${s.p10.toFixed(1)}, p90 ${s.p90.toFixed(1)})` : 'n/a')
console.log('========================================================================')
console.log(`VOICE ISOLATION STRESS: ${payload.iterations} iterations in ${(payload.wallMs / 1000).toFixed(1)}s wall (${(payload.mixRunMsTotal / payload.iterations).toFixed(1)}ms avg per mixture DSP run)`)
console.log(`Determinism (bit-exact repeat):        ${payload.deterministic ? 'PASS' : 'FAIL'}`)
console.log(`Model tags produce identical output:   ${payload.tagsEquivalent ? 'YES (tags are labels only)' : 'NO (DSP differs per tag)'}`)
console.log(`Runs with NaN/Inf:                     ${report.checks.nonFiniteRuns}`)
for (const [mode, m] of Object.entries(byMode)) {
  console.log(`-- ${mode} (${m.separationGain.n} runs)`)
  console.log(`   separationGain: ${fmt(m.separationGain)}`)
  console.log(`   delta SI-SDR:   ${fmt(m.dSiSdr)}`)
}
console.log('-- separationGain by bed (keep_vocal | remove_vocal medians)')
for (const [bed, b] of Object.entries(report.byBed)) {
  console.log(`   ${bed.padEnd(20)} keep ${b.keepGain ? b.keepGain.median.toFixed(1) + 'dB' : 'n/a'} | remove ${b.removeGain ? b.removeGain.median.toFixed(1) + 'dB' : 'n/a'}  (n=${b.n})`)
}
console.log('-- separationGain by strength (keep median)')
for (const [k, v] of Object.entries(report.byStrength)) {
  console.log(`   ${k}: ${v.keepGain ? v.keepGain.median.toFixed(1) + 'dB' : 'n/a'}`)
}
console.log(`Report: qa/reports/voice-isolation-stress-1000.json`)
console.log('========================================================================')

if (pageErrors.length) {
  console.error('PAGE ERRORS:', pageErrors.join(' | '))
  process.exitCode = 1
}
if (!payload.deterministic) process.exitCode = 1
if (report.checks.nonFiniteRuns > 0) process.exitCode = 1
