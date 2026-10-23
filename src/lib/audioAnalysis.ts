/** Lightweight, local key/BPM analysis for the Audio dock.
 * It is an estimate for review/arrangement, not a beat-grid or tuning master. */

export interface AudioAnalysisSummary {
  bpm: number | null
  bpmScore: number
  alternativeBpms: number[]
  key: string | null
  keyMargin: number
  analyzedSeconds: number
}

const MAX_ANALYSIS_SECONDS = 90
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

function monoSamples(buffer: AudioBuffer, maxSeconds: number): Float32Array {
  const length = Math.min(buffer.length, Math.floor(buffer.sampleRate * maxSeconds))
  const mono = new Float32Array(length)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const channel = buffer.getChannelData(c)
    for (let i = 0; i < length; i++) mono[i] += channel[i] / Math.max(1, buffer.numberOfChannels)
  }
  return mono
}

function estimateTempo(mono: Float32Array, sampleRate: number): { bpm: number | null; score: number; alternatives: number[] } {
  const hop = Math.max(128, Math.round(sampleRate * 0.02))
  const frames = Math.floor(mono.length / hop)
  if (frames < 80) return { bpm: null, score: 0, alternatives: [] }
  const energy = new Float64Array(frames)
  let previous = 0
  for (let f = 0; f < frames; f++) {
    const start = f * hop
    const end = Math.min(mono.length, start + hop)
    let sum = 0
    for (let i = start; i < end; i++) {
      const sample = mono[i]
      const highPassed = sample - previous
      previous = sample
      sum += highPassed * highPassed
    }
    energy[f] = Math.sqrt(sum / Math.max(1, end - start))
  }
  const onset = new Float64Array(frames)
  let mean = 0
  for (let f = 1; f < frames; f++) {
    const value = Math.max(0, energy[f] - energy[f - 1])
    onset[f] = value
    mean += value
  }
  mean /= Math.max(1, frames - 1)
  let variance = 0
  for (let f = 0; f < frames; f++) {
    onset[f] = Math.max(0, onset[f] - mean)
    variance += onset[f] * onset[f]
  }
  if (variance < 1e-12) return { bpm: null, score: 0, alternatives: [] }

  const hopSeconds = hop / sampleRate
  const minLag = Math.max(1, Math.floor(60 / (200 * hopSeconds)))
  const maxLag = Math.min(frames - 8, Math.ceil(60 / (50 * hopSeconds)))
  const peaks: { bpm: number; score: number; lag: number }[] = []
  for (let lag = minLag; lag <= maxLag; lag++) {
    let dot = 0
    let aa = 0
    let bb = 0
    for (let f = lag; f < frames; f++) {
      const a = onset[f]
      const b = onset[f - lag]
      dot += a * b
      aa += a * a
      bb += b * b
    }
    const overlap = (frames - lag) / frames
    const correlation = dot / Math.sqrt(Math.max(1e-18, aa * bb))
    const bpm = 60 / (lag * hopSeconds)
    // Mildly prefer the standard beat range when two metrical levels share a
    // near-identical correlation; keep half/double-time alternatives visible.
    const rangePrior = bpm >= 75 && bpm <= 160 ? 1.035 : 1
    peaks.push({ bpm, score: correlation * Math.pow(overlap, 0.12) * rangePrior, lag })
  }
  peaks.sort((a, b) => b.score - a.score)
  const best = peaks[0]
  if (!best || best.score < 0.06) return { bpm: null, score: best?.score ?? 0, alternatives: [] }

  const alternatives: number[] = []
  for (const candidate of [best.bpm / 2, best.bpm * 2]) {
    if (candidate >= 50 && candidate <= 200 && Math.abs(candidate - best.bpm) > 4) {
      const rounded = Math.round(candidate)
      if (!alternatives.includes(rounded)) alternatives.push(rounded)
    }
  }
  return { bpm: Math.round(best.bpm), score: best.score, alternatives }
}

/** In-place radix-2 complex FFT. */
function fft(real: Float64Array, imag: Float64Array): void {
  const n = real.length
  let j = 0
  for (let i = 1; i < n; i++) {
    let bit = n >> 1
    while (j & bit) { j ^= bit; bit >>= 1 }
    j ^= bit
    if (i < j) {
      const tr = real[i]; real[i] = real[j]; real[j] = tr
      const ti = imag[i]; imag[i] = imag[j]; imag[j] = ti
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = -2 * Math.PI / size
    const stepReal = Math.cos(angle)
    const stepImag = Math.sin(angle)
    for (let offset = 0; offset < n; offset += size) {
      let wr = 1
      let wi = 0
      const half = size >> 1
      for (let k = 0; k < half; k++) {
        const even = offset + k
        const odd = even + half
        const oddReal = real[odd] * wr - imag[odd] * wi
        const oddImag = real[odd] * wi + imag[odd] * wr
        const evenReal = real[even]
        const evenImag = imag[even]
        real[even] = evenReal + oddReal
        imag[even] = evenImag + oddImag
        real[odd] = evenReal - oddReal
        imag[odd] = evenImag - oddImag
        const nextWr = wr * stepReal - wi * stepImag
        wi = wr * stepImag + wi * stepReal
        wr = nextWr
      }
    }
  }
}

function correlation(a: number[], b: number[]): number {
  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length
  let dot = 0
  let aa = 0
  let bb = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i] - meanA
    const y = b[i] - meanB
    dot += x * y
    aa += x * x
    bb += y * y
  }
  return dot / Math.sqrt(Math.max(1e-18, aa * bb))
}

function estimateKey(mono: Float32Array, sampleRate: number): { key: string | null; margin: number } {
  const fftSize = 8192
  const hop = 4096
  const frameCount = Math.max(1, Math.ceil(Math.max(0, mono.length - fftSize) / hop) + 1)
  const window = new Float64Array(fftSize)
  for (let i = 0; i < fftSize; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1))
  const chroma = new Array(12).fill(0)
  const real = new Float64Array(fftSize)
  const imag = new Float64Array(fftSize)
  for (let frame = 0; frame < frameCount; frame++) {
    const start = frame * hop
    real.fill(0)
    imag.fill(0)
    for (let i = 0; i < fftSize && start + i < mono.length; i++) real[i] = mono[start + i] * window[i]
    fft(real, imag)
    for (let bin = 2; bin < fftSize / 2; bin++) {
      const frequency = bin * sampleRate / fftSize
      if (frequency < 55 || frequency > 5000) continue
      const midi = Math.round(69 + 12 * Math.log2(frequency / 440))
      const pitchClass = ((midi % 12) + 12) % 12
      const magnitude = Math.hypot(real[bin], imag[bin])
      chroma[pitchClass] += magnitude * Math.pow(frequency / 440, 0.15)
    }
  }
  const chromaTotal = chroma.reduce((sum, value) => sum + value, 0)
  if (chromaTotal < 1e-8) return { key: null, margin: 0 }
  for (let i = 0; i < 12; i++) chroma[i] /= chromaTotal

  const candidates: { key: string; score: number }[] = []
  for (let root = 0; root < 12; root++) {
    for (const [mode, profile] of [['Major', MAJOR_PROFILE], ['Minor', MINOR_PROFILE]] as const) {
      const rotated = new Array(12)
      for (let pc = 0; pc < 12; pc++) rotated[pc] = profile[(pc - root + 12) % 12]
      candidates.push({ key: `${NOTE_NAMES[root]} ${mode}`, score: correlation(chroma, rotated) })
    }
  }
  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]
  const second = candidates[1]
  if (!best || best.score < 0.05) return { key: null, margin: 0 }
  return { key: best.key, margin: Math.max(0, best.score - (second?.score ?? best.score)) }
}

/** Estimates key and tempo from a buffer, analyzing at most the first 90 s. */
export function analyzeAudioBuffer(buffer: AudioBuffer): AudioAnalysisSummary {
  const analyzedSeconds = Math.min(buffer.duration, MAX_ANALYSIS_SECONDS)
  const mono = monoSamples(buffer, MAX_ANALYSIS_SECONDS)
  const tempo = estimateTempo(mono, buffer.sampleRate)
  const key = estimateKey(mono, buffer.sampleRate)
  return {
    bpm: tempo.bpm,
    bpmScore: tempo.score,
    alternativeBpms: tempo.alternatives,
    key: key.key,
    keyMargin: key.margin,
    analyzedSeconds,
  }
}

/** Loads and analyzes an audio URL in the browser without uploading it. */
export async function analyzeAudioUrl(
  url: string,
  onProgress?: (percent: number, status: string) => void,
): Promise<AudioAnalysisSummary> {
  const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const context = new AudioCtxClass()
  try {
    onProgress?.(5, 'Loading audio for local analysis…')
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Could not load audio (HTTP ${response.status})`)
    const buffer = await context.decodeAudioData(await response.arrayBuffer())
    onProgress?.(45, 'Estimating musical key and tempo…')
    // FFT/autocorrelation are synchronous CPU work; yield once so the dock can
    // paint the status before analyzing the buffer.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    const result = analyzeAudioBuffer(buffer)
    onProgress?.(100, 'Key and tempo estimate ready')
    return result
  } finally {
    await context.close()
  }
}
