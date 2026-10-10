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

/**
 * Streams the weights with live byte counts. Each ~120 ms the worker posts
 * a `model-progress` message so the host can drive the model-load progress
 * card (src/lib/modelLoadStore.ts) — 174 MB with zero feedback is the most
 * annoying load in the app. On a warm HTTP cache this completes almost
 * instantly, so cached passes don't spam the UI.
 */
async function loadWeights(onBytes: (loaded: number, total: number | null) => void): Promise<ArrayBuffer> {
  let res: Response
  try {
    res = await fetch(MODEL_URL)
  } catch (err) {
    // A raw TypeError("Failed to fetch") tells the user nothing — surface
    // WHAT failed (the 174 MB Demucs weights) and the likely remedies.
    throw new Error(
      `Demucs weights could not be downloaded (${(err as Error).message}) — check your connection, or pick another engine below.`,
    )
  }
  if (!res.ok) throw new Error(`Demucs weights not available (HTTP ${res.status})`)
  const totalHeader = res.headers.get('content-length')
  const total = totalHeader ? parseInt(totalHeader, 10) : null
  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let received = 0
    let lastPost = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.byteLength
      const now = performance.now()
      if (now - lastPost > 120 || received === total) {
        lastPost = now
        onBytes(received, total)
      }
    }
    onBytes(received, received)
    const bytes = new Uint8Array(received)
    let off = 0
    for (const c of chunks) {
      bytes.set(c, off)
      off += c.byteLength
    }
    return bytes.buffer
  }
  onBytes(0, total)
  return res.arrayBuffer()
}

export interface SeparationRequest {
  id: number
  channelData: Float32Array[]
  sampleRate: number
  /** Spectrogram-split overlap (default 0.25). The chunked WASM fallback
   *  (src/lib/demucs/index.ts#runChunkedPassInWorker) sends 0 so the worker
   *  processes exactly ONE chunk — its heap dies with the worker right
   *  after, keeping memory flat on arbitrarily long tracks. */
  overlap?: number
}

self.onmessage = async (ev: MessageEvent<SeparationRequest>) => {
  const { id, channelData, sampleRate, overlap } = ev.data
  const post = (msg: Record<string, unknown>) =>
    (self as unknown as Worker).postMessage({ id, ...msg })
  try {
    post({ type: 'progress', pct: 5, msg: 'Loading Demucs v4 weights…' })
    const weights = await loadWeights((loaded, total) => post({ type: 'model-progress', loaded, total }))
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
    }, overlap ?? 0.25)
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
