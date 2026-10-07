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

import type { RawAudio } from './wav-utils.js'
import { renderAtRate } from '../vad'
import { initNativeDsp, nativeRemoveLsLeakage, nativeAveragePasses } from '../native/dspNative.js'

export const DEMUCS_MODEL_ID = 'htdemucs-v4'
export const DEMUCS_MODEL_URL = '/models/htdemucs.onnx'
const DEMUCS_SAMPLE_RATE = 44100

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

/** Shift step between averaging passes (100 ms). */
const SHIFT_STEP_SAMPLES = 4410

export interface DemucsOptions {
  /**
   * Number of shift-averaged passes. Each pass separates a copy of the mix
   * pre-padded by k × 100 ms and the results are averaged, cancelling
   * chunk-boundary artifacts. Measured on the showcase study (SI-SDR vs
   * ground truth, finite-aware averaging): 1 pass 17.5 dB, 2 passes 20.5 dB,
   * 3 passes 20.6 dB. Default 3.
   *
   * Every pass runs in a dedicated Web Worker that is terminated afterwards:
   * the onnxruntime-web WASM heap grows per session.run and is only fully
   * reclaimed when the worker dies, so worker-recycling (not session
   * recycling) is what keeps multi-pass separation inside tight memory
   * budgets. The main thread only accumulates the (small) per-pass stem
   * averages and stays free for the UI.
   */
  passes?: number
  /**
   * Speed normalization for slowed productions ("slowed + reverb" edits).
   * When > 1, the input is resampled to play `speedFactor`x faster before
   * separation and both outputs are slowed back to the original time
   * afterwards. Slowed edits pitch vocals below the range Demucs learned
   * as "vocals"; separating at the corrected speed recovers them (measured
   * on a real "ultra slowed" track: acapella vocal-like energy 23% -> 45%).
   * `src/lib/vad.ts#detectSlowedFactor` finds the right value.
   */
  speedFactor?: number
  /**
   * When false (with speedFactor > 1) the VOCALS output is NOT slowed back —
   * it stays at the corrected speed (natural pitch and tempo). The
   * instrumental is always restored. The natural-pitch acapella is the most
   * usable form (measured on a real slowed track: 88% voice-like energy at
   * natural pitch vs 43% at the slowed time base) but it no longer matches
   * the timeline.
   */
  speedRestoreVocals?: boolean
}

interface WorkerStems {
  [name: string]: { channelData: Float32Array[]; sampleRate: number }
}

/** Runs one separation pass inside a throwaway worker; resolves with stems. */
function runPassInWorker(
  channelData: Float32Array[],
  sampleRate: number,
  onProgress?: (pct: number, msg: string) => void,
): Promise<WorkerStems> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./demucs-worker.ts', import.meta.url), { type: 'module' })
    // the 174 MB weights download streams its byte counts through the
    // worker boundary; drive the model-load progress card from here (the
    // store lives on the main thread)
    let modelCardStarted = false
    const modelCard = async (fn: 'begin' | 'bytes' | 'compile' | 'ready' | 'fail', arg?: unknown) => {
      const store = await import('../modelLoadStore.js')
      const s = store.useModelLoadStore.getState()
      if (fn === 'begin') s.begin('htdemucs-v4', 'Demucs v4 neural network', { approxMb: 174 })
      else if (fn === 'bytes') {
        const [loaded, total] = arg as [number, number | null]
        s.reportBytes('htdemucs-v4', loaded, total)
      } else if (fn === 'compile') s.markCompiling('htdemucs-v4')
      else if (fn === 'ready') s.markReady('htdemucs-v4')
      else if (fn === 'fail') s.markFailed('htdemucs-v4', String(arg))
    }
    worker.onmessage = (ev: MessageEvent) => {
      const d = ev.data as {
        type: string
        stems?: WorkerStems
        message?: string
        pct?: number
        msg?: string
        loaded?: number
        total?: number | null
      }
      if (d.type === 'model-progress') {
        if (!modelCardStarted) {
          modelCardStarted = true
          void modelCard('begin')
        }
        void modelCard('bytes', [d.loaded ?? 0, d.total ?? null] as [number, number | null])
        // coarse mapping into the separation progress line (5 -> 20 %)
        const frac = d.total ? Math.min(1, (d.loaded ?? 0) / d.total) : 0
        onProgress?.(5 + Math.round(frac * 15), 'Loading Demucs v4 weights…')
      } else if (d.type === 'progress') {
        if ((d.pct ?? 0) >= 20 && modelCardStarted && (d.pct ?? 0) < 30) {
          // weights fetched — the worker is compiling the session now
          void modelCard('compile')
        } else if ((d.pct ?? 0) >= 30 && modelCardStarted) {
          // session live — separation is running
          void modelCard('ready')
        }
        onProgress?.(d.pct ?? 0, d.msg ?? '')
      } else if (d.type === 'done') {
        worker.terminate()
        resolve(d.stems as WorkerStems)
      } else if (d.type === 'error') {
        worker.terminate()
        if (modelCardStarted) void modelCard('fail', d.message)
        reject(new Error(d.message))
      }
    }
    worker.onerror = (e) => {
      worker.terminate()
      if (modelCardStarted) void modelCard('fail', e.message)
      reject(new Error(`Demucs worker failed: ${e.message}`))
    }
    worker.postMessage({ id: 1, channelData, sampleRate })
  })
}

/**
 * Runs full neural separation of a stereo mix.
 * `ctx` is only used to allocate the output AudioBuffers.
 */
export async function separateWithDemucs(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
  onProgress?: (percent: number, status: string) => void,
  options: DemucsOptions = {},
): Promise<DemucsSeparationResult> {
  const passes = Math.max(1, Math.min(4, options.passes ?? 3))
  const speedFactor = Math.max(1, Math.min(2, options.speedFactor ?? 1))
  const originalLength = buffer.length
  if (speedFactor > 1.001) {
    onProgress?.(6, `Demucs v4: speed-normalizing ×${speedFactor.toFixed(2)} (slowed production)…`)
    buffer = await renderAtRate(buffer, speedFactor)
  }
  const raw = await bufferToRawAudio(buffer)
  const samples = raw.channelData[0].length
  await initNativeDsp() // warm the compiled DSP core (JS fallback if unavailable)

  // Per-pass stem storage. Passes are averaged per-sample over FINITE values
  // only: on some WASM builds the ONNX inference intermittently emits NaN in a
  // stem channel around chunk tails. Averaging blindly would silently poison
  // those samples (audible as a mangled channel); skipping the non-finite
  // values recovers the exact result of the healthy passes.
  const passStems: Record<string, Float32Array[][]> = {} // [stem][channel][pass]
  let completed = 0
  for (let k = 0; k < passes; k++) {
    const pad = k * SHIFT_STEP_SAMPLES
    const padded = raw.channelData.map((c) => {
      if (pad === 0) return c
      const p = new Float32Array(c.length + pad)
      p.set(c, pad)
      return p
    })
    try {
      const stems = await runPassInWorker(padded, raw.sampleRate, (pct, msg) => {
        onProgress?.(46 + Math.round(((k + pct / 100) / passes) * 46), `Demucs v4: pass ${k + 1}/${passes} · ${msg}`)
      })
      for (const [name, stem] of Object.entries(stems)) {
        if (!passStems[name]) passStems[name] = stem.channelData.map(() => [] as Float32Array[])
        for (let c = 0; c < passStems[name].length; c++) {
          const src = stem.channelData[c]
          const view = pad === 0 ? src : src.subarray(pad, pad + samples)
          passStems[name][c].push(Float32Array.from(view))
        }
      }
      completed++
      // let the renderer reclaim the terminated worker's WASM heap before the
      // next pass starts (its high-water pages are released asynchronously;
      // 200 ms was too tight on memory-constrained machines — the next pass
      // then OOMs on top of the un-reclaimed pages, so wait longer)
      await new Promise((r) => setTimeout(r, 1500))
    } catch (err) {
      if (k === 0) throw err // the first pass must succeed
      onProgress?.(46, `Demucs v4: pass ${k + 1} failed (${(err as Error).message}); averaging ${completed} pass(es)`)
      break
    }
  }

  const stems: Record<string, RawAudio> = {}
  for (const [name, channels] of Object.entries(passStems)) {
    stems[name] = {
      // native path first (identical finite-aware arithmetic in one wasm
      // call — see native/dsp-core/omni_dsp.cpp); the JS loop below is the
      // fallback for when the compiled core isn't loaded
      channelData: channels.map((perChannel) => {
        const native = nativeAveragePasses(perChannel, samples)
        if (native) {
          if (native.missingCount > 0) interpolateMissing(native.out, native.missing, samples, name)
          return native.out
        }
        const out = new Float32Array(samples)
        const missing = new Uint8Array(samples)
        for (let i = 0; i < samples; i++) {
          let sum = 0
          let n = 0
          for (let k = 0; k < perChannel.length; k++) {
            const v = perChannel[k][i]
            if (Number.isFinite(v)) { sum += v; n++ }
          }
          if (n > 0) out[i] = sum / n
          else missing[i] = 1
        }
        let m = 0
        for (let i = 0; i < samples; i++) m += missing[i]
        if (m > 0) interpolateMissing(out, missing, samples, name)
        return out
      }),
      sampleRate: raw.sampleRate,
    }
  }

  // Cross-talk clean-up between the two products. After separation the vocal
  // and instrumental estimates are near-orthogonal, so the least-squares
  // projection of one onto the other is almost pure leakage from the other
  // stem. Subtracting it costs ≈0.02 dB SI-SDR and cuts music bleed in the
  // vocals by ~10 dB (showcase study: −42.3 → −52.8 dB; neutral on easy mixes
  // where leakage already sits at the noise floor). Guarded both ways: a
  // silent reference (e.g. instrumental-only input) skips the subtraction,
  // and the coefficient is capped so a degenerate correlation can never eat
  // the stem.
  const vocalsRaw = stems.vocals
  const instrumentalRaw = sumStems([stems.drums, stems.bass, stems.other], samples, raw.sampleRate)
  removeLsLeakage(vocalsRaw.channelData, instrumentalRaw.channelData)
  removeLsLeakage(instrumentalRaw.channelData, vocalsRaw.channelData)

  let vocals = rawAudioToBuffer(ctx, vocalsRaw)
  let instrumental = rawAudioToBuffer(ctx, instrumentalRaw)
  if (speedFactor > 1.001) {
    // restore the original time base: slow both outputs back and pad/trim to
    // the exact input length so the isolated clip stays frame-aligned
    const restore = async (b: AudioBuffer): Promise<AudioBuffer> => {
      const slowed = await renderAtRate(b, 1 / speedFactor)
      if (slowed.length === originalLength) return slowed
      // pad/trim to the exact input length so the clip stays frame-aligned
      const out = ctx.createBuffer(slowed.numberOfChannels, originalLength, slowed.sampleRate)
      const n = Math.min(slowed.length, originalLength)
      for (let c = 0; c < slowed.numberOfChannels; c++) {
        const dst = new Float32Array(originalLength)
        dst.set(slowed.getChannelData(c).subarray(0, n))
        out.copyToChannel(dst as Float32Array<ArrayBuffer>, c)
      }
      return out
    }
    instrumental = await restore(instrumental)
    if (options.speedRestoreVocals !== false) {
      vocals = await restore(vocals)
    }
    // else: keep the sped-domain vocals — natural pitch, deliberately a
    // different (shorter) length than the input
  }
  onProgress?.(92, 'Demucs v4 separation complete')
  return { stems, vocals, instrumental, backend: 'onnxruntime-web worker (webgpu → wasm fallback)' }
}

/** Bridges samples where every pass was non-finite by linear interpolation. */
function interpolateMissing(out: Float32Array, missing: Uint8Array, samples: number, stem: string): void {
  console.warn(`[demucs] ${stem}: ${missing.reduce((a, b) => a + b, 0)} samples had no finite pass value; interpolated`)
  for (let i = 0; i < samples; i++) {
    if (!missing[i]) continue
    let a = i - 1
    while (a >= 0 && missing[a]) a--
    let b = i + 1
    while (b < samples && missing[b]) b++
    const va = a >= 0 ? out[a] : 0
    const vb = b < samples ? out[b] : 0
    out[i] = va + ((vb - va) * (i - a)) / Math.max(1, b - a)
  }
}

/**
 * In-place least-squares leakage removal: for each channel subtracts
 * `a · ref` from `target`, where `a = <target,ref> / <ref,ref>` clamped to
 * ±0.5. Skips silent reference channels. Runs in the native wasm core
 * (native/dsp-core/omni_dsp.cpp) when loaded — identical arithmetic — with
 * this pure-JS loop as the fallback.
 */
function removeLsLeakage(target: Float32Array[], ref: Float32Array[]): void {
  // opportunistic native path (returns null only when the core isn't loaded)
  if (nativeRemoveLsLeakage(target, ref) !== null) return

  const CAP = 0.5
  for (let c = 0; c < target.length && c < ref.length; c++) {
    const t = target[c]
    const r = ref[c]
    let dot = 0
    let rr = 0
    for (let i = 0; i < t.length; i++) {
      dot += t[i] * r[i]
      rr += r[i] * r[i]
    }
    if (rr < 1e-12) continue // reference is silent — nothing to remove
    const a = Math.min(CAP, Math.max(-CAP, dot / rr))
    if (a === 0) continue
    for (let i = 0; i < t.length; i++) t[i] -= a * r[i]
  }
}
