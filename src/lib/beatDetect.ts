/**
 * Auto Beat — find the repeating beat in an audio waveform and mark it.
 *
 * Model (deliberately forgiving, per real-world beat tracking):
 *  1. Onset envelope = positive energy flux of the peak waveform.
 *  2. Period: autocorrelation of the envelope over 0.30–2.00s lags; the best
 *     lag wins, but a near-tie at double/half the lag is resolved toward the
 *     lag whose implied grid explains more onsets (perfect is the enemy —
 *     a 0.0001s-exact grid that fights the music is worse than a grid that
 *     sits on the hits).
 *  3. Phase: the offset whose grid collects the most onset energy.
 *  4. Snap: each grid point moves to the strongest onset within ±18% of the
 *     period, so markers land ON hits, not on sterile math.
 *
 * Custom Auto Beat: the user trims one beat (0.5–2.0s). That slice becomes
 * a template; normalized cross-correlation scans the whole track and every
 * strong, well-separated match gets a marker.
 */

export interface BeatGrid {
  times: number[]
  period: number
  confidence: number // 0..1 autocorrelation strength at the chosen period
}

function onsetEnvelope(waveform: ArrayLike<number>, duration: number): { env: Float32Array; hop: number } {
  const n = waveform.length
  const hop = duration / Math.max(1, n)
  const env = new Float32Array(n)
  let prev = 0
  for (let i = 0; i < n; i++) {
    const v = Math.abs(waveform[i] ?? 0)
    env[i] = Math.max(0, v - prev)
    prev = v
  }
  // light smoothing (3-tap) so single-sample spikes don't dominate
  const sm = new Float32Array(n)
  for (let i = 0; i < n; i++) sm[i] = (env[Math.max(0, i - 1)] + env[i] * 2 + env[Math.min(n - 1, i + 1)]) / 4
  return { env: sm, hop }
}

function autocorrAt(env: Float32Array, lag: number): number {
  let num = 0, den = 0
  for (let i = 0; i + lag < env.length; i++) {
    num += env[i] * env[i + lag]
    den += env[i] * env[i]
  }
  return den > 0 ? num / den : 0
}

/** Normal Auto Beat: best repeating grid over the whole waveform. */
export function detectBeatGrid(
  waveform: ArrayLike<number>,
  duration: number,
  opts: { minPeriod?: number; maxPeriod?: number } = {},
): BeatGrid | null {
  if (!waveform.length || duration <= 0) return null
  const { env, hop } = onsetEnvelope(waveform, duration)
  const minLag = Math.max(2, Math.floor((opts.minPeriod ?? 0.3) / hop))
  const maxLag = Math.min(env.length - 2, Math.ceil((opts.maxPeriod ?? 2.0) / hop))
  if (maxLag <= minLag) return null

  let bestLag = -1, bestScore = -1
  const scores: Array<[number, number]> = []
  for (let lag = minLag; lag <= maxLag; lag++) {
    const s = autocorrAt(env, lag)
    scores.push([lag, s])
    if (s > bestScore) { bestScore = s; bestLag = lag }
  }
  if (bestLag < 0 || bestScore <= 0.02) return null

  // Octave sanity: if half the lag scores within 88%, the faster grid is
  // usually the real beat (autocorrelation loves multiples).
  const half = scores.find(([l]) => l === Math.round(bestLag / 2))
  if (half && half[1] >= bestScore * 0.88 && bestLag / 2 >= minLag) {
    bestLag = half[0]; bestScore = half[1]
  }

  const period = bestLag * hop
  // Phase: offset (in samples) whose grid harvests the most onset energy.
  let bestPhase = 0, bestEnergy = -1
  for (let p = 0; p < bestLag; p++) {
    let e = 0
    for (let i = p; i < env.length; i += bestLag) e += env[i]
    if (e > bestEnergy) { bestEnergy = e; bestPhase = p }
  }

  // Snap each grid point to the strongest onset within ±18% of the period.
  const snapWin = Math.max(1, Math.floor(bestLag * 0.18))
  const times: number[] = []
  for (let i = bestPhase; i < env.length; i += bestLag) {
    let idx = i, peak = -1
    for (let j = Math.max(0, i - snapWin); j <= Math.min(env.length - 1, i + snapWin); j++) {
      if (env[j] > peak) { peak = env[j]; idx = j }
    }
    times.push(idx * hop)
  }
  return { times, period, confidence: Math.min(1, bestScore) }
}

/** Custom Auto Beat: template-match one user-trimmed beat across the track. */
export function detectCustomBeat(
  waveform: ArrayLike<number>,
  duration: number,
  segStart: number,
  segLength: number,
  opts: { thresholdRatio?: number } = {},
): { times: number[]; period: number } {
  const n = waveform.length
  if (!n || duration <= 0) return { times: [], period: segLength }
  const { env, hop } = onsetEnvelope(waveform, duration)
  const startIdx = Math.max(0, Math.floor(segStart / hop))
  const lenIdx = Math.max(4, Math.floor(segLength / hop))
  if (startIdx + lenIdx > env.length) return { times: [], period: segLength }

  const template = env.slice(startIdx, startIdx + lenIdx)
  // Markers anchor to the template's loudest onset, so a match reports the
  // HIT time (where the user's beat actually lands), not the segment start.
  let peakIdx = 0
  for (let j = 1; j < template.length; j++) if (template[j] > template[peakIdx]) peakIdx = j
  let tMean = 0
  for (const v of template) tMean += v
  tMean /= template.length

  // Normalized cross-correlation at every offset.
  const corr = new Float32Array(env.length)
  let maxCorr = 0
  for (let o = 0; o + lenIdx <= env.length; o++) {
    let num = 0, dA = 0, dB = 0, wMean = 0
    for (let j = 0; j < lenIdx; j++) wMean += env[o + j]
    wMean /= lenIdx
    for (let j = 0; j < lenIdx; j++) {
      const a = template[j] - tMean, b = env[o + j] - wMean
      num += a * b; dA += a * a; dB += b * b
    }
    const c = dA > 0 && dB > 0 ? num / Math.sqrt(dA * dB) : 0
    corr[o] = c
    if (c > maxCorr) maxCorr = c
  }

  // Period: strongest autocorrelation lag of the segment itself, else the
  // segment length (the user trimmed exactly one beat).
  let period = segLength
  let bestLag = -1, bestScore = 0.25
  const seg = env.slice(startIdx, startIdx + Math.min(env.length - startIdx, lenIdx * 3))
  for (let lag = Math.floor(lenIdx * 0.6); lag <= Math.min(seg.length - 2, Math.ceil(lenIdx * 1.6)); lag++) {
    const s = autocorrAt(seg, lag)
    if (s > bestScore) { bestScore = s; bestLag = lag }
  }
  if (bestLag > 0) period = bestLag * hop

  const threshold = Math.max(0.35, maxCorr * (opts.thresholdRatio ?? 0.62))
  const minDist = Math.max(2, Math.floor((period / hop) * 0.7))
  const times: number[] = []
  let last = -Infinity
  for (let o = 0; o < corr.length; o++) {
    if (corr[o] < threshold) continue
    // local maximum?
    if (o > 0 && corr[o] < corr[o - 1]) continue
    if (o < corr.length - 1 && corr[o] < corr[o + 1]) continue
    const t = o * hop + peakIdx * hop // the hit inside the matched window
    if (t - last < minDist * hop) continue
    times.push(t)
    last = t
  }
  return { times, period }
}
