/**
 * Demucs separation worker.
 *
 * Runs ONE shift-averaged separation pass and returns the four stems. The
 * host terminates the worker after the pass, which frees the onnxruntime-web
 * WASM heap entirely — the heap grows monotonically per session.run and cannot
 * be reclaimed any other way, so multi-pass separation recycles workers
 * instead of sessions. Bonus: the main thread stays free for the UI.
 */

import { ONNXHTDemucs } from './onnx-htdemucs.js'
import { separateTracks } from './apply.js'
import type { RawAudio } from './wav-utils.js'

const MODEL_URL = '/models/htdemucs.onnx'

async function loadWeights(): Promise<ArrayBuffer> {
  const res = await fetch(MODEL_URL)
  if (!res.ok) throw new Error(`Demucs weights not available (HTTP ${res.status})`)
  return res.arrayBuffer()
}

export interface SeparationRequest {
  id: number
  channelData: Float32Array[]
  sampleRate: number
}

self.onmessage = async (ev: MessageEvent<SeparationRequest>) => {
  const { id, channelData, sampleRate } = ev.data
  const post = (msg: Record<string, unknown>) =>
    (self as unknown as Worker).postMessage({ id, ...msg })
  try {
    post({ type: 'progress', pct: 5, msg: 'Loading Demucs v4 weights…' })
    const weights = await loadWeights()
    post({ type: 'progress', pct: 20, msg: 'Initializing Demucs v4 neural network…' })
    const model = await ONNXHTDemucs.init(weights)
    post({ type: 'progress', pct: 30, msg: 'Demucs v4: separating…' })
    const raw: RawAudio = { channelData, sampleRate }
    let last = 0
    const stems = await separateTracks(model, raw, (step, total) => {
      const pct = 30 + Math.round((step / Math.max(1, total)) * 65)
      if (pct >= last + 5 || step === total) {
        last = pct
        post({ type: 'progress', pct, msg: `Demucs v4: chunk ${step}/${total}` })
      }
    }, 0.25)
    // detach the views from the result buffer so they are transferable
    const out: Record<string, { channelData: Float32Array[]; sampleRate: number }> = {}
    const transfer: ArrayBuffer[] = []
    for (const [name, stem] of Object.entries(stems)) {
      out[name] = {
        channelData: stem.channelData.map((c) => {
          const copy = new Float32Array(c)
          transfer.push(copy.buffer as ArrayBuffer)
          return copy
        }),
        sampleRate: stem.sampleRate,
      }
    }
    post({ type: 'done', stems: out })
  } catch (err) {
    post({ type: 'error', message: (err as Error).message })
  }
}
