/**
 * Silero VAD v5 (ONNX) — speech-activity detection for voice isolation.
 *
 * A second real neural model in the isolation pipeline: after Demucs separates
 * the vocal stem, Silero VAD finds the speech regions and a *safe* gate cleans
 * residual noise in the pauses (only where BOTH the VAD probability is low AND
 * the local level is far below the speech level, so breaths and sung vocals
 * with energy are never chopped).
 *
 * Model: silero-vad v5 (MIT, https://github.com/snakers4/silero-vad), ONNX
 * export shipped inside the `silero-vad` PyPI package; committed at
 * public/models/silero-vad-v5.onnx (2.3 MB).
 *
 * Inference contract (v5, 16 kHz):
 *   inputs : input [1, 576] float32 (64-sample context + 512 new samples),
 *            state [2, 1, 128] float32, sr int64 scalar (16000)
 *   outputs: output [1, 1] speech probability, stateN [2, 1, 128]
 */

import * as ort from 'onnxruntime-web'

export const VAD_MODEL_URL = '/models/silero-vad-v5.onnx'
const VAD_SR = 16000
const CHUNK = 512
const CONTEXT = 64

let vadSession: Promise<ort.InferenceSession> | null = null

function loadVadSession(): Promise<ort.InferenceSession> {
  if (!vadSession) {
    vadSession = (async () => {
      const res = await fetch(VAD_MODEL_URL)
      if (!res.ok) throw new Error(`Silero VAD model unavailable (HTTP ${res.status})`)
      const bytes = await res.arrayBuffer()
      return ort.InferenceSession.create(bytes, { executionProviders: ['webgpu', 'wasm'] })
    })()
  }
  return vadSession
}

/** Downmixes to mono and resamples to 16 kHz for the VAD. */
async function toMono16k(buffer: AudioBuffer): Promise<Float32Array> {
  let mono: Float32Array
  if (buffer.numberOfChannels === 1) {
    mono = buffer.getChannelData(0)
  } else {
    const L = buffer.getChannelData(0)
    const R = buffer.getChannelData(buffer.numberOfChannels > 1 ? 1 : 0)
    mono = new Float32Array(L.length)
    for (let i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) / 2
  }
  if (buffer.sampleRate === VAD_SR) return mono
  const length = Math.ceil((mono.length * VAD_SR) / buffer.sampleRate)
  const offline = new OfflineAudioContext(1, length, VAD_SR)
  const src = offline.createBufferSource()
  const tmp = offline.createBuffer(1, mono.length, buffer.sampleRate)
  tmp.copyToChannel(mono as Float32Array<ArrayBuffer>, 0)
  src.buffer = tmp
  src.connect(offline.destination)
  src.start()
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0) as Float32Array<ArrayBuffer>
}

/** Streams the whole buffer through Silero VAD; returns one probability per 32 ms. */
export async function detectSpeech(
  buffer: AudioBuffer,
  onProgress?: (fraction: number) => void,
): Promise<{ probs: Float32Array; frameSamples: number; sr: number }> {
  const session = await loadVadSession()
  const x = await toMono16k(buffer)
  const nFrames = Math.max(1, Math.floor(x.length / CHUNK))
  const probs = new Float32Array(nFrames)
  let state: ort.Tensor = new ort.Tensor('float32', new Float32Array(2 * 1 * 128), [2, 1, 128])
  let context = new Float32Array(CONTEXT)
  const srTensor = new ort.Tensor('int64', BigInt64Array.from([16000n]), [])
  const inputNames = session.inputNames
  for (let f = 0; f < nFrames; f++) {
    const inp = new Float32Array(CONTEXT + CHUNK)
    inp.set(context, 0)
    inp.set(x.subarray(f * CHUNK, f * CHUNK + CHUNK), CONTEXT)
    const input = new ort.Tensor('float32', inp, [1, CONTEXT + CHUNK])
    const out = await session.run({ [inputNames[0]]: input, [inputNames[1]]: state, [inputNames[2]]: srTensor })
    const outNames = session.outputNames
    probs[f] = (out[outNames[0]].data as Float32Array)[0]
    state = out[outNames[1]]
    context = inp.subarray(CHUNK) // last 64 samples
    if (onProgress && (f & 31) === 0) onProgress(f / nFrames)
  }
  return { probs, frameSamples: CHUNK, sr: VAD_SR }
}

export interface SpeechGateOptions {
  /** 0..1 — how deep the gate closes in pauses (maps to −12…−56 dB floor) */
  strength?: number
}

/**
 * Builds a per-sample gain envelope (0..1) that is 1 during speech and drops
 * to a floor during pauses. Frame state machine (32 ms frames):
 *
 *   1. vadOpen  — Silero probability (96 ms centered mean) > 0.35
 *   2. loudOpen — frame level within 12 dB of the speech reference (p90),
 *                 96 ms centered mean — protects sung vocals, emphatic
 *                 breaths, any energetic event from being gated
 *   3. open     — vadOpen || loudOpen
 *   4. morphology: re-open gaps shorter than 128 ms (never chop inside
 *      words); close islands shorter than 96 ms (avoid clicks)
 *   5. 32 ms linear gain ramps between states (no clicks, no pumping)
 *
 * Short symmetric smearing is deliberately avoided: pauses >= ~160 ms close
 * crisply, speech transitions stay untouched.
 */
export async function computeSpeechGate(
  buffer: AudioBuffer,
  options: SpeechGateOptions = {},
  onProgress?: (fraction: number) => void,
): Promise<Float32Array> {
  const strength = options.strength ?? 0.92
  const { probs } = await detectSpeech(buffer, onProgress)

  const sr = buffer.sampleRate
  const N = buffer.length
  const frameDur = CHUNK / VAD_SR
  const nFrames = Math.max(1, Math.floor(N / sr / frameDur))
  const floor = Math.pow(10, -(12 + 44 * strength) / 20)

  // --- per-frame level (dB) on the same 32 ms grid -------------------------
  const mono = buffer.getChannelData(0)
  const rmsDb = new Float32Array(nFrames)
  const frameLen = Math.round(frameDur * sr)
  for (let f = 0; f < nFrames; f++) {
    let acc = 0
    const start = Math.round((f * frameDur) * sr)
    const stop = Math.min(N, start + frameLen)
    for (let i = start; i < stop; i++) acc += mono[i] * mono[i]
    rmsDb[f] = 10 * Math.log10(acc / Math.max(1, stop - start) + 1e-12)
  }
  const sorted = Float32Array.from(rmsDb).sort()
  const ref = sorted[Math.min(nFrames - 1, Math.floor(nFrames * 0.9))]

  // --- frame states with 3-frame (96 ms) centered means ---------------------
  const smooth3 = (arr: Float32Array, f: number) => {
    let s = 0, n = 0
    for (let k = f - 1; k <= f + 1; k++) if (k >= 0 && k < arr.length) { s += arr[k]; n++ }
    return s / Math.max(1, n)
  }
  const open: boolean[] = new Array(nFrames).fill(true)
  for (let f = 0; f < nFrames; f++) {
    const vadOpen = smooth3(probs, f) > 0.35
    const loudOpen = smooth3(rmsDb, f) > ref - 12
    open[f] = vadOpen || loudOpen
  }

  // --- morphology -----------------------------------------------------------
  const REOPEN_GAP_FRAMES = 4   // 128 ms: never gate inside speech
  const CLOSE_ISLAND_FRAMES = 3 // 96 ms: avoid sub-perceptual gating
  for (let f = 0; f < nFrames; f++) {
    if (open[f]) continue
    let gapEnd = f
    while (gapEnd < nFrames && !open[gapEnd]) gapEnd++
    if (gapEnd - f <= REOPEN_GAP_FRAMES) {
      for (let k = f; k < gapEnd; k++) open[k] = true // re-open short gaps
    } else {
      // close short open islands inside this gap
      let i = f
      while (i < gapEnd) {
        if (open[i]) {
          let islandEnd = i
          while (islandEnd < gapEnd && open[islandEnd]) islandEnd++
          if (islandEnd - i <= CLOSE_ISLAND_FRAMES) for (let k = i; k < islandEnd; k++) open[k] = false
          i = islandEnd
        } else i++
      }
    }
    f = gapEnd
  }

  // --- frame gains with one-frame ramps, then upsample ----------------------
  const frameGain = new Float32Array(nFrames)
  for (let f = 0; f < nFrames; f++) {
    const target = open[f] ? 1 : floor
    const prev = f > 0 ? open[f - 1] ? 1 : floor : target
    frameGain[f] = (prev + target) / 2 // 32 ms linear ramp across the boundary
  }

  const gate = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const pos = (i / sr) / frameDur
    const f0 = Math.min(nFrames - 1, Math.floor(pos))
    const f1 = Math.min(nFrames - 1, f0 + 1)
    const t = pos - f0
    gate[i] = frameGain[f0] * (1 - t) + frameGain[f1] * t
  }
  onProgress?.(1)
  return gate
}

/** Applies a per-sample gain envelope, returning a new AudioBuffer. */
export function applyGainEnvelope(ctx: BaseAudioContext, buffer: AudioBuffer, gain: Float32Array): AudioBuffer {
  const out = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c)
    const dst = new Float32Array(src.length)
    for (let i = 0; i < src.length; i++) dst[i] = src[i] * gain[i]
    out.copyToChannel(dst as Float32Array<ArrayBuffer>, c)
  }
  return out
}
