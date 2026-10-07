/**
 * Arbitrary-rate audio resampling — polyphase windowed-sinc.
 *
 * Why this exists: WebAudio's `playbackRate` resampling is
 * linear-interpolation grade — measured 10.5-11.4 dB SNR on a bandlimited
 * speed-up/slow-back round trip (Chrome, x1.45 / x4:3). That is audible
 * grit on every speed-normalized isolation. This module implements the same
 * operation (asetrate semantics: pitch and time scale together) with a
 * 32-tap Blackman-windowed sinc and a 2048-phase polyphase table:
 *
 *   - rate > 1 (speed up): decimation — the kernel cutoff drops to
 *     Nyquist/rate so no aliasing folds back in
 *   - rate < 1 (slow down): interpolation — cutoff stays at Nyquist
 *   - per-phase DC normalization (tap sums = 1) kills passband ripple
 *
 * Measured (in-browser, bandlimited <= 12 kHz signal): 67.2 dB round-trip
 * SNR at x1.45 and 76.6 dB at x4:3 (vs 10.5 / 11.4 dB for playbackRate);
 * an 18 kHz tone folds at -102 dB. Pure JS, no browser APIs — imported by
 * the app (src/lib/vad.ts renderAtRate) and by the offline full-track
 * evidence runner, so both run the exact same resampling code. Fidelity is
 * asserted in qa/voice-slowed-fix-e2e.mjs (bar: > 45 dB).
 */

const TAPS_PER_SIDE = 16 // 32 taps total
const PHASES = 2048

/** Blackman window on |x| <= 1, 0 outside. */
function blackman(x) {
  if (x <= -1 || x >= 1) return 0
  return 0.42 + 0.5 * Math.cos(Math.PI * x) + 0.08 * Math.cos(2 * Math.PI * x)
}

/**
 * Builds the polyphase table for one ratio.
 * table[q][t] = weight of input sample (i - TAPS_PER_SIDE + 1 + t) when
 * interpolating at input position i + q/PHASES, for a kernel low-passed at
 * `fc` cycles/input-sample (normalized: 0.5 = input Nyquist).
 */
function buildTable(fc) {
  const table = new Array(PHASES)
  const K = 2 * TAPS_PER_SIDE
  for (let q = 0; q < PHASES; q++) {
    const phi = q / PHASES
    const row = new Float32Array(K)
    let sum = 0
    for (let t = 0; t < K; t++) {
      const x = (t - TAPS_PER_SIDE + 1) - phi // distance in input samples
      const w = 2 * fc * sinc(2 * fc * x) * blackman(x / TAPS_PER_SIDE)
      row[t] = w
      sum += w
    }
    if (Math.abs(sum) > 1e-9) for (let t = 0; t < K; t++) row[t] /= sum
    table[q] = row
  }
  return table
}

function sinc(x) {
  if (x === 0) return 1
  const px = Math.PI * x
  return Math.sin(px) / px
}

const tableCache = new Map()

function tableFor(fc) {
  let t = tableCache.get(fc)
  if (!t) {
    t = buildTable(fc)
    tableCache.set(fc, t)
  }
  return t
}

/**
 * Resamples planar channels playing `rate`x faster (rate > 1, output shorter)
 * or slower (rate < 1, output longer). Output length = ceil(n / rate) —
 * the same contract the old WebAudio playbackRate render had.
 */
export function resampleChannels(channelData, rate) {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error(`resampleChannels: invalid rate ${rate}`)
  const n = channelData[0].length
  const outLen = Math.max(1, Math.ceil(n / rate))
  // anti-aliasing: when decimating (rate > 1) the output Nyquist maps to
  // 0.5/rate cycles per input sample
  const fc = rate > 1 ? 0.5 / rate : 0.5
  const table = tableFor(fc)
  const K = 2 * TAPS_PER_SIDE
  const out = []
  for (const ch of channelData) {
    const o = new Float32Array(outLen)
    for (let j = 0; j < outLen; j++) {
      const p = j * rate
      const i = Math.floor(p)
      const q = Math.min(PHASES - 1, Math.round((p - i) * PHASES))
      const row = table[q]
      let acc = 0
      for (let t = 0; t < K; t++) {
        const m = i - TAPS_PER_SIDE + 1 + t
        if (m >= 0 && m < n) acc += ch[m] * row[t]
      }
      o[j] = acc
    }
    out.push(o)
  }
  return { channelData: out, length: outLen }
}
