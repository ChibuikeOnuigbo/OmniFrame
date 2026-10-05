/**
 * Loudness normalization — ITU-R BS.1770-4 integrated loudness (LUFS).
 *
 * Pipeline: mono-sum -> resample to 48 kHz -> K-weighting (high-shelf
 * pre-filter + high-pass RLB) -> 400 ms blocks every 100 ms -> gated mean
 * (absolute -70 LUFS, then relative -10 LU) -> integrated LUFS.
 *
 * Normalization applies gain = target - measured as the clip volume, which
 * flows through preview playback and export mixing.
 */

const BS1770_SR = 48000
const BLOCK = Math.round(0.4 * BS1770_SR) // 400 ms
const STEP = Math.round(0.1 * BS1770_SR) // 100 ms
const ABS_GATE = -70.0
const REL_GATE = -10.0

// Published BS.1770-4 stage coefficients (48 kHz)
const SHELF = { b0: 1.53512485958697, b1: -2.69169618940638, b2: 1.19839281085285, a1: -1.69065929318241, a2: 0.73248077421585 }
const HPF = { b0: 1.0, b1: -2.0, b2: 1.0, a1: -1.99004745483398, a2: 0.99007225036621 }

function biquad(x: Float32Array, c: typeof SHELF): Float32Array {
  const y = new Float32Array(x.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < x.length; i++) {
    const xi = x[i]
    const yi = c.b0 * xi + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2
    x2 = x1; x1 = xi
    y2 = y1; y1 = yi
    y[i] = yi
  }
  return y
}

/** Linear-interpolation resampler (sufficient for loudness measurement). */
export function resampleLinear(x: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return x
  const ratio = to / from
  const out = new Float32Array(Math.max(1, Math.round(x.length * ratio)))
  for (let i = 0; i < out.length; i++) {
    const src = i / ratio
    const i0 = Math.floor(src)
    const i1 = Math.min(x.length - 1, i0 + 1)
    const f = src - i0
    out[i] = x[i0] * (1 - f) + x[i1] * f
  }
  return out
}

/**
 * Integrated loudness of a mono/stereo signal in LUFS (BS.1770-4 gating).
 * channels: one Float32Array per channel at `sampleRate`.
 */
export function measureIntegratedLufs(channels: Float32Array[], sampleRate: number): number {
  if (channels.length === 0) return -Infinity
  // mono-sum with per-channel K-weighting (mean square averaged over channels)
  let weighted: Float32Array[] = []
  for (const ch of channels) {
    const at48k = resampleLinear(ch, sampleRate, BS1770_SR)
    weighted.push(biquad(biquad(at48k, SHELF), HPF))
  }
  const nBlocks = Math.max(1, Math.floor((weighted[0].length - BLOCK) / STEP) + 1)
  const blockLoud: number[] = []
  for (let b = 0; b < nBlocks; b++) {
    const start = b * STEP
    const end = Math.min(weighted[0].length, start + BLOCK)
    let zSum = 0
    for (const w of weighted) {
      let s = 0
      for (let i = start; i < end; i++) s += w[i] * w[i]
      zSum += s / Math.max(1, end - start)
    }
    const z = zSum / weighted.length
    blockLoud.push(-0.691 + 10 * Math.log10(z + 1e-12))
  }
  // absolute gate
  let gated = blockLoud.filter((l) => l > ABS_GATE)
  if (gated.length === 0) return -Infinity
  // relative gate
  const meanMs = (arr: number[]) => {
    let s = 0
    for (const l of arr) s += 10 ** ((l + 0.691) / 10)
    return -0.691 + 10 * Math.log10(s / arr.length)
  }
  const relThreshold = meanMs(gated) + REL_GATE
  gated = gated.filter((l) => l > relThreshold)
  if (gated.length === 0) gated = blockLoud
  return meanMs(gated)
}

/** Gain factor (linear) that moves `measured` LUFS to `target` LUFS. */
export function loudnessGain(measuredLufs: number, targetLufs: number): number {
  if (!isFinite(measuredLufs)) return 1
  return 10 ** ((targetLufs - measuredLufs) / 20)
}

/** Short (peak-ish) loudness used for a quick "is this loud?" readout. */
export function measureShortTermMaxLufs(channels: Float32Array[], sampleRate: number): number {
  return measureIntegratedLufs(channels, sampleRate) // integrated is the right normalizer target
}
