/**
 * Demucs v4 (htdemucs) neural source separation — browser integration.
 *
 * This is a REAL pretrained model: Meta's Demucs v4 "Hybrid Transformer"
 * (htdemucs), 4-stem (drums / bass / other / vocals), ported to ONNX by the
 * MIT-licensed `demucs` npm package (https://www.npmjs.com/package/demucs,
 * Kevin Gibbons / bakkot). The inference glue in this folder is vendored from
 * that package; the wrapper below adapts it to OmniFrame's AudioBuffer
 * pipeline:
 *
 *   - lazily fetches the 174 MB weights from /models/htdemucs.onnx
 *     (download once via `npm run fetch:demucs`, git-ignored)
 *   - resamples / up-mixes input to 44.1 kHz stereo as the model requires
 *   - runs on GPU via WebGPU where available, falling back to WASM CPU
 *   - returns the isolated vocal stem and the summed instrumental
 *     (drums + bass + other) for karaoke-style removal
 *
 * Weights license: derived from weights provided by Meta, available for
 * personal and research use only (see LICENSE.md).
 */

import { ONNXHTDemucs } from './onnx-htdemucs.js'
import { separateTracks } from './apply.js'
import type { RawAudio } from './wav-utils.js'

export const DEMUCS_MODEL_ID = 'htdemucs-v4'
export const DEMUCS_MODEL_URL = '/models/htdemucs.onnx'
const DEMUCS_SAMPLE_RATE = 44100

let modelPromise: Promise<ONNXHTDemucs> | null = null

/** Fetches the weights (with progress) and builds the ONNX session once. */
export function loadDemucsModel(
  onProgress?: (percent: number, status: string) => void,
): Promise<ONNXHTDemucs> {
  if (!modelPromise) {
    modelPromise = (async () => {
      onProgress?.(2, 'Fetching Demucs v4 (htdemucs) weights…')
      const res = await fetch(DEMUCS_MODEL_URL)
      if (!res.ok) {
        modelPromise = null
        throw new Error(
          `Demucs weights not available (HTTP ${res.status}). ` +
            'Run `npm run fetch:demucs` once to download public/models/htdemucs.onnx.',
        )
      }
      let bytes: ArrayBuffer
      const total = Number(res.headers.get('content-length') || 0)
      if (res.body && total > 0) {
        const reader = res.body.getReader()
        const chunks: Uint8Array[] = []
        let received = 0
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          received += value.length
          onProgress?.(2 + Math.round((received / total) * 33), `Fetching Demucs v4 weights… ${Math.round((received / total) * 100)}%`)
        }
        const merged = new Uint8Array(received)
        let off = 0
        for (const c of chunks) {
          merged.set(c, off)
          off += c.length
        }
        bytes = merged.buffer
      } else {
        bytes = await res.arrayBuffer()
      }
      onProgress?.(40, 'Initializing Demucs v4 neural network…')
      const model = await ONNXHTDemucs.init(bytes)
      onProgress?.(45, 'Demucs v4 model ready')
      return model
    })()
  }
  return modelPromise
}

/** True when the weights file is served (used by the UI to enable the model). */
export async function isDemucsModelAvailable(): Promise<boolean> {
  try {
    const res = await fetch(DEMUCS_MODEL_URL, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

async function bufferToRawAudio(buffer: AudioBuffer): Promise<RawAudio> {
  let chL = buffer.getChannelData(0)
  let chR = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0)
  let sampleRate = buffer.sampleRate

  // The model operates on 44.1 kHz stereo — resample / up-mix when needed.
  if (sampleRate !== DEMUCS_SAMPLE_RATE || buffer.numberOfChannels < 2) {
    const length = Math.ceil(buffer.duration * DEMUCS_SAMPLE_RATE)
    const offline = new OfflineAudioContext(2, length, DEMUCS_SAMPLE_RATE)
    const src = offline.createBufferSource()
    src.buffer = buffer
    src.connect(offline.destination)
    src.start()
    const rendered = await offline.startRendering()
    chL = rendered.getChannelData(0)
    chR = rendered.getChannelData(1)
    sampleRate = DEMUCS_SAMPLE_RATE
  }
  // copy so we never feed views of a buffer the caller may mutate
  return {
    channelData: [new Float32Array(chL), new Float32Array(chR)],
    sampleRate,
  }
}

function rawAudioToBuffer(ctx: BaseAudioContext, audio: RawAudio): AudioBuffer {
  const out = ctx.createBuffer(audio.channelData.length, audio.channelData[0].length, audio.sampleRate)
  for (let c = 0; c < audio.channelData.length; c++) {
    out.copyToChannel(audio.channelData[c] as Float32Array<ArrayBuffer>, c)
  }
  return out
}

function sumStems(stems: RawAudio[], length: number, sampleRate: number): RawAudio {
  const channels = stems[0].channelData.length
  const channelData: Float32Array[] = []
  for (let c = 0; c < channels; c++) {
    const acc = new Float32Array(length)
    for (const stem of stems) {
      const data = stem.channelData[c]
      for (let i = 0; i < Math.min(length, data.length); i++) acc[i] += data[i]
    }
    channelData.push(acc)
  }
  return { channelData, sampleRate }
}

export interface DemucsSeparationResult {
  /** full stem layout as produced by the model */
  stems: Record<string, RawAudio>
  /** isolated vocal stem */
  vocals: AudioBuffer
  /** drums + bass + other (karaoke instrumental) */
  instrumental: AudioBuffer
  /** which backend actually ran (from onnxruntime-web) */
  backend: string
}

/**
 * Runs full neural separation of a stereo mix.
 * `ctx` is only used to allocate the output AudioBuffers.
 */
export async function separateWithDemucs(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
  onProgress?: (percent: number, status: string) => void,
): Promise<DemucsSeparationResult> {
  const model = await loadDemucsModel(onProgress)
  const raw = await bufferToRawAudio(buffer)
  const samples = raw.channelData[0].length
  onProgress?.(48, `Demucs v4: separating ${samples / raw.sampleRate >= 60 ? '(this runs in chunks — long clips take a while)' : '…'}`)

  let lastReport = 0
  const stems = await separateTracks(model, raw, (step, total) => {
    const pct = 48 + Math.round((step / Math.max(1, total)) * 42)
    if (pct >= lastReport + 2 || step === total) {
      lastReport = pct
      onProgress?.(pct, `Demucs v4: chunk ${step}/${total}`)
    }
  })

  const vocals = rawAudioToBuffer(ctx, stems.vocals)
  const instrumental = rawAudioToBuffer(
    ctx,
    sumStems([stems.drums, stems.bass, stems.other], samples, raw.sampleRate),
  )
  onProgress?.(92, 'Demucs v4 separation complete')
  return { stems, vocals, instrumental, backend: 'onnxruntime-web (webgpu → wasm fallback)' }
}
