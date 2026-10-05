/**
 * AI Denoise — ONNX GRU spectral masker (omni-denoise-v1).
 *
 * The model is trained in Python (scripts/python/train_denoiser.py) on
 * synthesized mixtures of a clean voice with SFX, competing voices, songs,
 * and "heavily padded" song stacks (structured audio acting as noise), then
 * exported to ONNX. This module runs the exact same graph in the browser via
 * onnxruntime-web:
 *
 *   audio -> STFT (n_fft 512, hop 128, hann, centered)
 *         -> x = (log10(|S| + 1e-4) - MU) / STD      [per frame]
 *         -> GRU masker in 64-frame blocks, state carried across blocks
 *         -> |S_hat| = mask^alpha * |S_mix|, phase from the mixture
 *         -> ISTFT (overlap-add)
 *
 * In desktop (Tauri) mode the same ONNX file is run natively through the
 * Python sidecar instead (see src-tauri command `ai_denoise_file`).
 */

import type * as Ort from 'onnxruntime-web'

export const DENOISE_MODEL_URL = '/models/omni-denoise-v1.onnx'
export const DENOISE_SR = 16000
export const DENOISE_NFFT = 512
export const DENOISE_HOP = 128
export const DENOISE_BINS = DENOISE_NFFT / 2 + 1 // 257
export const DENOISE_BLOCK = 64
export const DENOISE_HIDDEN = 96
const MU = -2.6
const STD = 0.55
const EPS = 1e-4

type OrtModule = typeof import('onnxruntime-web')
let ortModule: OrtModule | null = null
let sessionPromise: Promise<Ort.InferenceSession> | null = null

async function getOrt(): Promise<OrtModule> {
  if (!ortModule) ortModule = await import('onnxruntime-web')
  return ortModule
}

/** Lazily create the ONNX session (WASM backend, single-threaded). */
export async function getDenoiseSession(): Promise<Ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await getOrt()
      ort.env.wasm.numThreads = 1
      ort.env.wasm.simd = true
      // Runtime files live in /ort-runtime/ during dev (importable through
      // vite's transform pipeline) and /ort/ in production builds.
      ort.env.wasm.wasmPaths = import.meta.env.DEV ? '/ort-runtime/' : '/ort/'
      return await ort.InferenceSession.create(DENOISE_MODEL_URL, {
        executionProviders: ['wasm'],
      })
    })()
  }
  return sessionPromise
}

// ---------------------------------------------------------------------------
// FFT (iterative radix-2, matching numpy's rfft layout for real input)
// ---------------------------------------------------------------------------

function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length
  // bit reversal
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t
      t = im[i]; im[i] = im[j]; im[j] = t
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang), wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k]
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr
        re[i + k] = ur + vr; im[i + k] = ui + vi
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
}

function irfft(re: Float64Array, im: Float64Array, n: number): Float64Array {
  // full complex ifft of the hermitian-symmetric spectrum
  const N = n
  const fr = new Float64Array(N), fi = new Float64Array(N)
  for (let i = 0; i < re.length; i++) { fr[i] = re[i]; fi[i] = im[i] }
  for (let i = 1; i < N; i++) {
    if (i < re.length) {
      fr[N - i] = re[i]; fi[N - i] = -im[i]
    }
  }
  // inverse fft = conjugate-fft-conjugate
  for (let i = 0; i < N; i++) fi[i] = -fi[i]
  fftInPlace(fr, fi)
  const out = new Float64Array(N)
  for (let i = 0; i < N; i++) out[i] = fr[i] / N
  return out
}

// ---------------------------------------------------------------------------
// STFT / ISTFT
// ---------------------------------------------------------------------------

function hann(n: number): Float64Array {
  const w = new Float64Array(n)
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * (i + 1)) / (n + 1)))
  return w
}

const WINDOW = hann(DENOISE_NFFT)

export interface StftResult {
  mag: Float64Array[] // per frame [257]
  phase: Float64Array[] // per frame [257]
  length: number
}

export function stft(x: Float32Array): StftResult {
  // centered: reflect-pad n_fft/2 both ends
  const half = DENOISE_NFFT / 2
  const padded = new Float64Array(x.length + 2 * half)
  for (let i = 0; i < x.length; i++) padded[half + i] = x[i]
  for (let i = 0; i < half; i++) {
    padded[half - 1 - i] = x[Math.min(x.length - 1, i)] || 0
    padded[half + x.length + i] = x[Math.max(0, x.length - 1 - i)] || 0
  }
  const T = Math.max(1, Math.floor((padded.length - DENOISE_NFFT) / DENOISE_HOP) + 1)
  const mag: Float64Array[] = []
  const phase: Float64Array[] = []
  const re = new Float64Array(DENOISE_NFFT), im = new Float64Array(DENOISE_NFFT)
  for (let t = 0; t < T; t++) {
    const off = t * DENOISE_HOP
    re.fill(0); im.fill(0)
    for (let i = 0; i < DENOISE_NFFT; i++) re[i] = padded[off + i] * WINDOW[i]
    fftInPlace(re, im)
    const m = new Float64Array(DENOISE_BINS), p = new Float64Array(DENOISE_BINS)
    for (let f = 0; f < DENOISE_BINS; f++) {
      m[f] = Math.hypot(re[f], im[f])
      p[f] = Math.atan2(im[f], re[f])
    }
    mag.push(m); phase.push(p)
  }
  return { mag, phase, length: x.length }
}

export function istft(mag: Float64Array[], phase: Float64Array[], length: number): Float32Array {
  const T = mag.length
  const total = DENOISE_NFFT + DENOISE_HOP * (T - 1) + DENOISE_NFFT
  const out = new Float64Array(total)
  const wsum = new Float64Array(total)
  const re = new Float64Array(DENOISE_BINS), im = new Float64Array(DENOISE_BINS)
  const time = new Float64Array(DENOISE_NFFT)
  for (let t = 0; t < T; t++) {
    for (let f = 0; f < DENOISE_BINS; f++) {
      re[f] = mag[t][f] * Math.cos(phase[t][f])
      im[f] = mag[t][f] * Math.sin(phase[t][f])
    }
    time.set(irfft(re, im, DENOISE_NFFT))
    const off = t * DENOISE_HOP
    for (let i = 0; i < DENOISE_NFFT; i++) {
      out[off + i] += time[i] * WINDOW[i]
      wsum[off + i] += WINDOW[i] * WINDOW[i]
    }
  }
  const half = DENOISE_NFFT / 2
  const y = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const w = wsum[half + i]
    y[i] = w > 1e-8 ? out[half + i] / w : 0
  }
  return y
}

// ---------------------------------------------------------------------------
// Model application
// ---------------------------------------------------------------------------

export interface DenoiseResult {
  /** Denoised mono samples at 16 kHz. */
  samples: Float32Array
  /** Mean mask value (0..1) — rough "how much was kept". */
  maskMean: number
  inferenceMs: number
}

/**
 * Runs the ONNX masker over a 16 kHz mono signal.
 * alpha: mask exponent (1 = full suppression, 0.5 = gentler).
 */
export async function denoiseSignal16k(x: Float32Array, alpha = 1): Promise<DenoiseResult> {
  const session = await getDenoiseSession()
  const ort = await getOrt()
  const { mag, phase, length } = stft(x)
  const T = mag.length
  const mask: Float64Array[] = []
  let h = new ort.Tensor('float32', new Float32Array(DENOISE_HIDDEN), [1, DENOISE_HIDDEN])
  const t0 = performance.now()
  let maskSum = 0, maskCount = 0
  for (let b = 0; b * DENOISE_BLOCK < T; b++) {
    const nFrames = Math.min(DENOISE_BLOCK, T - b * DENOISE_BLOCK)
    const buf = new Float32Array(DENOISE_BLOCK * DENOISE_BINS)
    for (let t = 0; t < nFrames; t++) {
      const m = mag[b * DENOISE_BLOCK + t]
      for (let f = 0; f < DENOISE_BINS; f++) {
        buf[t * DENOISE_BINS + f] = (Math.log10(m[f] + EPS) - MU) / STD
      }
    }
    const xin = new ort.Tensor('float32', buf, [1, DENOISE_BLOCK, DENOISE_BINS])
    const out = await session.run({ X: xin, H0: h })
    const maskOut = out['MASK'].data as Float32Array
    h = out['HOUT'] as typeof h
    for (let t = 0; t < nFrames; t++) {
      const m = new Float64Array(DENOISE_BINS)
      for (let f = 0; f < DENOISE_BINS; f++) {
        const v = maskOut[t * DENOISE_BINS + f]
        m[f] = Math.pow(v, alpha)
        maskSum += v; maskCount++
      }
      mask.push(m)
    }
  }
  const inferenceMs = performance.now() - t0
  const magMasked = mask.map((m, t) => {
    const outM = new Float64Array(DENOISE_BINS)
    for (let f = 0; f < DENOISE_BINS; f++) outM[f] = m[f] * mag[t][f]
    return outM
  })
  const samples = istft(magMasked, phase, length)
  return { samples, maskMean: maskCount ? maskSum / maskCount : 0, inferenceMs }
}

/**
 * Full pipeline from an AudioBuffer at any sample rate:
 * resample to 16 kHz mono, denoise, resample back. Returns samples at the
 * original sample rate.
 */
export async function denoiseAudioBuffer(buffer: AudioBuffer, alpha = 1): Promise<{ samples: Float32Array; maskMean: number; inferenceMs: number }> {
  // mono mix
  const mono = new Float32Array(buffer.length)
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const d = buffer.getChannelData(ch)
    for (let i = 0; i < buffer.length; i++) mono[i] += d[i] / buffer.numberOfChannels
  }
  const down = resampleTo16k(mono, buffer.sampleRate)
  const res = await denoiseSignal16k(down, alpha)
  const up = resampleFrom16k(res.samples, buffer.sampleRate)
  return { samples: up, maskMean: res.maskMean, inferenceMs: res.inferenceMs }
}

function resampleTo16k(x: Float32Array, from: number): Float32Array {
  if (from === DENOISE_SR) return x
  return resampleLinearF(x, from, DENOISE_SR)
}

function resampleFrom16k(x: Float32Array, to: number): Float32Array {
  if (to === DENOISE_SR) return x
  return resampleLinearF(x, DENOISE_SR, to)
}

function resampleLinearF(x: Float32Array, from: number, to: number): Float32Array {
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

/** True when running inside the Tauri desktop shell. */
export function isDesktopMode(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * Desktop path: send the WAV bytes to the native sidecar
 * (`ai_denoise_wav` -> python3 onnxruntime) and decode the returned WAV.
 * Falls back to the in-browser WASM session when not in Tauri.
 */
export async function denoiseViaDesktop(wavBytes: ArrayBuffer, strength = 1): Promise<ArrayBuffer> {
  const { invoke } = (await import('@tauri-apps/api/core')) as unknown as {
    invoke: (cmd: string, args: Record<string, unknown>) => Promise<Uint8Array>
  }
  const out = await invoke('ai_denoise_wav', {
    wav: Array.from(new Uint8Array(wavBytes)),
    strength,
  })
  return out.buffer as ArrayBuffer
}
