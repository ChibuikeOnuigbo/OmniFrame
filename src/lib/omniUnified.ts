/**
 * omni-unified-v1 — the in-house UNIFIED model: isolation + denoise +
 * loudness-normalization in ONE graph (scripts/python/train_unified.py).
 *
 *   input  : normalized log-magnitude STFT frames (16 kHz mono, n_fft 512,
 *            hop 128, hann, centered — the same domain object as
 *            omni-denoise-v1, src/lib/aiDenoise.ts) with 3-frame context
 *   outputs: mask   [T, 257]  sigmoid spectral mask for the VOICE
 *            gain_db scalar    loudness head — the gain that lands the
 *                              isolated voice at -18 dBFS RMS (the app
 *                              finalizer's target), +-12 dB window
 *
 * keep_vocal  : |S_v| = mask^alpha * |S_mix|, mix phase, then the model's
 *               predicted gain is applied (finalizeIsolationOutput then
 *               verifies/finishes normalization — its gain converges to
 *               ~0 dB when the model already landed the target).
 * remove_vocal: |S_i| = (1 - mask^alpha) * |S_mix| — the instrumental is the
 *               model's own complement; the voice gain head is NOT applied.
 *
 * The model is trained on synthesized mixes with KNOWN clean components
 * (repo TTS voice fixtures x music beds x white/pink/hum noise at random
 * SNRs), so the mask learns isolation and denoising jointly from ground
 * truth. Training counts and loss curves: RUNS.md, qa/reports/.
 */

import type * as Ort from 'onnxruntime-web'
import { stft, istft } from './aiDenoise'
import { resampleChannels } from './demucs/resample.js'
import { withModelLoadProgress } from './modelLoadStore.js'

export const UNIFIED_MODEL_URL = '/models/omni-unified-v1.onnx'
export const UNIFIED_SR = 16000
export const UNIFIED_BINS = 257
// per-frame log-magnitude normalization — MEASURED on the training corpus
// (--recalibrate); must match scripts/python/train_unified.py exactly.
const MU = -0.3685
const STD = 0.7878
const EPS = 1e-4

type OrtModule = typeof import('onnxruntime-web')
let ortModule: OrtModule | null = null
let sessionPromise: Promise<Ort.InferenceSession> | null = null

async function getOrt(): Promise<OrtModule> {
  if (!ortModule) ortModule = await import('onnxruntime-web')
  return ortModule
}

/** Lazily create the ONNX session (WASM backend, single-threaded). */
export async function getUnifiedSession(): Promise<Ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await getOrt()
      ort.env.wasm.numThreads = 1
      ort.env.wasm.simd = true
      ort.env.wasm.wasmPaths = import.meta.env.DEV ? '/ort-runtime/' : '/ort/'
      return await withModelLoadProgress(
        UNIFIED_MODEL_URL,
        { id: 'omni-unified', label: 'Unified Isolator (OmniFrame v1)' },
        (bytes) => ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] }),
      )
    })()
  }
  return sessionPromise
}

/** Anti-aliased polyphase sinc resampler (src/lib/demucs/resample.js) —
 * linear interpolation aliases badly when decimating 44.1 kHz -> 16 kHz. */
function resampleTo(x: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return x
  return resampleChannels([x], from / to).channelData[0]
}

/**
 * Run the raw graph on precomputed feature frames [T, 771] and return
 * {mask, gainDb}. Used by the app pipeline above and by the parity E2E
 * (qa/omni-unified-e2e.mjs) so the test exercises the app's own session.
 */
export async function runUnifiedOnFeatures(
  feats: Float32Array,
  T: number,
): Promise<{ mask: Float32Array; gainDb: number }> {
  const session = await getUnifiedSession()
  const ort = await getOrt()
  const input = new ort.Tensor('float32', feats, [1, T, UNIFIED_BINS])
  const outs = await session.run({ features: input })
  return {
    mask: outs.mask.data as Float32Array,
    gainDb: (outs.gain_db.data as Float32Array)[0],
  }
}

export interface UnifiedResult {
  /** Processed mono samples at the original sample rate. */
  samples: Float32Array
  /** Mean predicted mask value (voice presence energy-weighted signal). */
  meanMask: number
  /** The loudness head's predicted gain in dB (voice modes only). */
  gainDb: number
  inferenceMs: number
}

/**
 * Run the unified model on an AudioBuffer at any sample rate.
 * mode 'keep_vocal' -> isolated + denoised + gain-normalized voice
 * mode 'remove_vocal' -> instrumental (mask complement)
 */
export async function unifiedIsolateBuffer(
  buffer: AudioBuffer,
  mode: 'keep_vocal' | 'remove_vocal',
  strength = 0.92,
): Promise<UnifiedResult> {
  const session = await getUnifiedSession()

  // mono mix -> 16 kHz
  const mono = new Float32Array(buffer.length)
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const d = buffer.getChannelData(ch)
    for (let i = 0; i < buffer.length; i++) mono[i] += d[i] / buffer.numberOfChannels
  }
  const x = resampleTo(mono, buffer.sampleRate, UNIFIED_SR)

  // spectral domain (identical to the training transform)
  const t0 = performance.now()
  const { mag, phase, length } = stft(x)
  const T = mag.length
  if (T < 4) {
    return { samples: mono, meanMask: 0, gainDb: 0, inferenceMs: 0 }
  }

  // features [1, T, 257]: normalized frames — the 3-frame context stack is
  // built INSIDE the graph (UnifiedNet.forward), so the runner just feeds
  // the raw normalized frames
  const feats = new Float32Array(T * UNIFIED_BINS)
  for (let t = 0; t < T; t++) {
    const m = mag[t]
    const off = t * UNIFIED_BINS
    for (let f = 0; f < UNIFIED_BINS; f++) feats[off + f] = (Math.log10(m[f] + EPS) - MU) / STD
  }
  const { mask, gainDb } = await runUnifiedOnFeatures(feats, T)
  const inferenceMs = performance.now() - t0

  // strength -> mask sharpness. The model is trained with NO shaping
  // (mask applied directly), so the DEFAULT strength 0.92 maps to exactly
  // alpha 1.0. Higher strength = more aggressive:
  //   keep_vocal  : alpha up   (m^a smaller -> more suppression)
  //   remove_vocal: alpha down (m^a bigger  -> more voice subtracted)
  const s = Math.min(1, Math.max(0, strength)) / 0.92
  const alpha = mode === 'keep_vocal' ? 0.5 + 0.5 * s : 1.5 - 0.5 * s
  const outMag: Float64Array[] = new Array(T)
  let maskSum = 0
  for (let t = 0; t < T; t++) {
    const m = new Float64Array(UNIFIED_BINS)
    const src = mag[t]
    for (let f = 0; f < UNIFIED_BINS; f++) {
      const mk = mask[t * UNIFIED_BINS + f]
      maskSum += mk
      const shaped = Math.pow(mk, alpha)
      m[f] = (mode === 'keep_vocal' ? shaped : 1 - shaped) * src[f]
    }
    outMag[t] = m
  }

  let y = istft(outMag, phase, length)
  // the loudness head's gain applies to the VOICE output only
  if (mode === 'keep_vocal') {
    const g = Math.pow(10, Math.max(-12, Math.min(12, gainDb)) / 20)
    for (let i = 0; i < y.length; i++) y[i] *= g
  }
  const back = resampleTo(y, UNIFIED_SR, buffer.sampleRate)
  return { samples: back, meanMask: maskSum / (T * UNIFIED_BINS), gainDb, inferenceMs }
}
