/**
 * RNNoise (Xiph) — trained recurrent-network speech denoiser, compiled to
 * freestanding wasm from the official C sources with the trained weights
 * embedded (native/rnnoise/src/rnn_data.c, int8 + 1/256 scale).
 *
 *   scripts/build-rnnoise-wasm.sh  ->  public/wasm/rnnoise.wasm (1.05 MB)
 *
 * The wasm module is the model: no ONNX runtime, no imports, pure linear
 * memory. Verified BIT-IDENTICAL to a native gcc build of the same sources
 * (qa/rnnoise-parity.mjs, reference vector from the gcc build).
 *
 * Pipeline contract (mirrors examples/rnnoise_demo.c):
 *   - operates on 48 kHz mono, FRAME_SIZE 480 (10 ms) frames
 *   - inputs are 16-bit-PCM-scaled: x * 32768 in, out / 32768 (the silence
 *     gate, feature offsets and VAD calibration all expect that scale)
 *   - one frame of algorithmic delay: the first output frame is discarded,
 *     exactly like the official demo skips writing frame 0
 *
 * Measured on the repo speech fixture + white noise at 0 dB SNR:
 *   +13.2 dB SNR vs the clean signal (lag-aligned), mean VAD 0.97 on speech.
 */

import { withModelLoadProgress } from './modelLoadStore.js'
import { resampleChannels } from './demucs/resample.js'

export const RNNOISE_WASM_URL = '/wasm/rnnoise.wasm'
export const RNNOISE_SR = 48000
export const RNNOISE_FRAME = 480
/** 16-bit PCM full scale — the scale the model was trained at. */
const PCM16_SCALE = 32768

interface RnnoiseExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory
  rnnoise_create(model: number): number
  rnnoise_destroy(st: number): void
  rnnoise_process_frame(st: number, out: number, input: number): number
  rnnoise_get_frame_size(): number
  malloc(bytes: number): number
  free(ptr: number): void
}

let instancePromise: Promise<WebAssembly.Instance> | null = null

/** Lazily fetch + instantiate the wasm module (progress-barred as a model load). */
export function getRnnoise(): Promise<WebAssembly.Instance> {
  if (!instancePromise) {
    instancePromise = (async () => {
      const { instance } = await withModelLoadProgress(
        RNNOISE_WASM_URL,
        { id: 'rnnoise', label: 'RNNoise (Xiph) · trained denoiser', approxMb: 1.1 },
        async (bytes) => {
          // No imports: pure linear-memory module (WASI reactor, stripped).
          // (With an empty import object TS resolves the sync-return overload.)
          const instance = await WebAssembly.instantiate(bytes, {})
          return instance
        },
      )
      return instance
    })()
  }
  return instancePromise
}

/** True when the wasm module is already instantiated (for UI gating). */
export function isRnnoiseInstantiated(): boolean {
  return instancePromise !== null
}

export interface RnnoiseResult {
  /** Denoised mono samples at the input's original sample rate. */
  samples: Float32Array
  /** Mean per-frame VAD (0..1) across processed frames. */
  meanVad: number
  /** Milliseconds spent inside the frame loop. */
  processMs: number
}

function monoMix(buffer: AudioBuffer): Float32Array {
  const mono = new Float32Array(buffer.length)
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const d = buffer.getChannelData(ch)
    for (let i = 0; i < buffer.length; i++) mono[i] += d[i] / buffer.numberOfChannels
  }
  return mono
}

/** The synchronous frame loop (runs once the module is instantiated). */
function denoiseSync(e: RnnoiseExports, at48k: Float32Array): { out: Float32Array; meanVad: number; processMs: number } {
  const nFrames = Math.floor(at48k.length / RNNOISE_FRAME)
  if (nFrames < 2) return { out: at48k.slice(), meanVad: 0, processMs: 0 }
  const st = e.rnnoise_create(0) // 0 = built-in trained model
  // wasm-owned scratch (never overlaps state allocations)
  const inPtr = e.malloc(RNNOISE_FRAME * 4)
  const outPtr = e.malloc(RNNOISE_FRAME * 4)
  try {
    // frame 0 is the pipeline's one-frame delay — dropped like the demo does
    const out = new Float32Array((nFrames - 1) * RNNOISE_FRAME)
    let vadSum = 0
    const t0 = performance.now()
    for (let f = 0; f < nFrames; f++) {
      // create/malloc/process may grow memory — bind views after every call
      let dv = new DataView(e.memory.buffer)
      for (let i = 0; i < RNNOISE_FRAME; i++) {
        dv.setFloat32(inPtr + i * 4, at48k[f * RNNOISE_FRAME + i] * PCM16_SCALE, true)
      }
      const vad = e.rnnoise_process_frame(st, outPtr, inPtr)
      dv = new DataView(e.memory.buffer)
      if (f > 0) {
        const base = (f - 1) * RNNOISE_FRAME
        for (let i = 0; i < RNNOISE_FRAME; i++) {
          out[base + i] = dv.getFloat32(outPtr + i * 4, true) / PCM16_SCALE
        }
      }
      vadSum += vad
    }
    return { out, meanVad: vadSum / nFrames, processMs: performance.now() - t0 }
  } finally {
    e.free(outPtr)
    e.free(inPtr)
    e.rnnoise_destroy(st)
  }
}

/**
 * Denoise an AudioBuffer at any sample rate:
 * mono mix -> resample to 48 kHz (polyphase sinc) -> frame loop ->
 * resample back. Returns mono samples at the original sample rate.
 */
export async function rnnoiseDenoiseBuffer(
  buffer: AudioBuffer,
  onProgress?: (fraction: number, note?: string) => void,
): Promise<RnnoiseResult> {
  const inst = await getRnnoise()
  onProgress?.(0.15, 'RNNoise: resampling to 48 kHz…')
  const mono = monoMix(buffer)
  const at48k =
    buffer.sampleRate === RNNOISE_SR
      ? mono
      : resampleChannels([mono], buffer.sampleRate / RNNOISE_SR).channelData[0]
  onProgress?.(0.3, 'RNNoise: running the trained GRU denoiser…')
  const e = inst.exports as unknown as RnnoiseExports
  const { out, meanVad, processMs } = denoiseSync(e, at48k)
  onProgress?.(0.9, 'RNNoise: restoring original sample rate…')
  const back =
    buffer.sampleRate === RNNOISE_SR
      ? out
      : resampleChannels([out], RNNOISE_SR / buffer.sampleRate).channelData[0]
  onProgress?.(1)
  return { samples: back, meanVad, processMs }
}
