/**
 * OmniFrame Voice Isolation & Vocal Removal Subsystem
 *
 * Engines:
 *  A. 'htdemucs-v4' — REAL neural separation with Meta's Demucs v4 Hybrid
 *     Transformer (htdemucs) via ONNX Runtime Web (src/lib/demucs). Vocals
 *     stem for keep_vocal, drums+bass+other for remove_vocal. Requires
 *     public/models/htdemucs.onnx (`npm run fetch:demucs`).
 *  B. 'omni-denoise-onnx' — in-house GRU spectral masker (src/lib/aiDenoise).
 *  C. Everything else — fast local DSP fallback: stereo Mid/Side phase
 *     cancellation, 3-band crossover, and speech formant bandpass isolation
 *     in pure Web Audio PCM. (Fast, but cannot fully remove broadband music.)
 *
 * Modes:
 * 1. 'remove_vocal' (Instrumental / Karaoke):
 *    - Preserves low bass / kick drum below crossover (default 140Hz) in mono
 *    - Subtracts center-panned mid frequencies (L - R) in the vocal formant band (140Hz - 7500Hz)
 *    - Preserves stereo ambient sparkle and cymbals (> 7500Hz)
 * 2. 'keep_vocal' (Acapella / Voice Isolation):
 *    - Extracts center channel M = (L + R) / 2
 *    - Dynamically attenuates stereo side components (instruments / synths / guitars)
 *    - Applies human speech bandpass filtering (120Hz - 6500Hz) and speech presence boost
 */

import { useEditor } from '../store'
import type { MediaAsset, Clip } from '../types'
import { uid } from './time'
import { denoiseAudioBuffer, denoiseViaDesktop, isDesktopMode } from './aiDenoise'
import { rnnoiseDenoiseBuffer } from './rnnoise'
import { unifiedIsolateBuffer } from './omniUnified'

const UNIFIED_WASM_NOTE = 'onnxruntime-web WASM'
import { separateWithDemucs, isDemucsModelAvailable } from './demucs/index.ts'
import { computeSpeechGate, applyGainEnvelope, detectSlowedFactor, detectSpeech } from './vad.ts'
import { nativePeakScale, nativeNormalize } from './native/dspNative.js'

export type VoiceIsolationModel =
  | 'omni-voicetarget'
  | 'htdemucs-v4'
  | 'bs-roformer-lite'
  | 'dsp-crossover-fast'
  /** In-house GRU spectral masker trained with scripts/python/train_denoiser.py,
   * exported to ONNX; runs in-browser (onnxruntime-web) or natively in the
   * desktop shell (python sidecar + onnxruntime). */
  | 'omni-denoise-onnx'
  /** Xiph RNNoise — the trained GRU speech denoiser (weights embedded in the
   * vendored C sources), compiled to a freestanding wasm module
   * (public/wasm/rnnoise.wasm). keep-vocal only: it suppresses non-speech
   * noise around the voice. Bit-verified against a native gcc build of the
   * same sources (qa/rnnoise-parity.mjs). */
  | 'rnnoise-xiph'
  /** omni-unified-v1 — the in-house UNIFIED model (isolation + denoise +
   * loudness normalization in one graph, scripts/python/train_unified.py).
   * keep_vocal: masked voice + the model's own gain head; remove_vocal:
   * the instrumental as the mask's complement. */
  | 'omni-unified'

export interface VoiceIsolationOptions {
  mode: 'keep_vocal' | 'remove_vocal'
  model?: VoiceIsolationModel // default 'omni-voicetarget'
  strength?: number // 0.0 to 1.0 (default 0.92)
  preserveBass?: boolean // default true (preserves kick & bass below 140Hz in remove_vocal)
  vocalBandLow?: number // default 140Hz
  vocalBandHigh?: number // default 7500Hz
  speechFormantFocus?: boolean // default true (boosts 300Hz-3500Hz speech formants in keep_vocal)
  /** Silero-VAD pause cleanup on the Demucs vocal stem (default true, htdemucs-v4 only).
   *  Safely attenuates residual noise during speech pauses — the gate only
   *  closes where VAD probability is low AND the level is ≥18 dB below the
   *  speech reference, so breaths and sung vocals are preserved. */
  vadGate?: boolean
  /** Auto speed-normalization for slowed productions (default true, htdemucs-v4
   *  only). Detects "slowed + reverb" edits (vocals pitched below the model's
   *  learned range) via Silero VAD, separates at the corrected speed, then
   *  restores the original timing. Normal and instrumental tracks pass through
   *  untouched after one cheap detection pass. */
  speedNormalize?: boolean
  /** Optional manually selected speed-up factor for a known slowed edit.
   * Overrides automatic detection when speedNormalize is enabled; useful when
   * unusual reverb/pitch processing makes the detector conservative. */
  speedFactorOverride?: number
  /**
   * 'timeline' (default): the isolated acapella is slowed back to the input's
   * time base so it stays frame-aligned on the timeline. 'natural'
   * (keep_vocal only, when a slowed track was detected): the acapella stays
   * at the corrected speed — natural pitch and tempo, the most usable form
   * (88% vs 43% voice-like energy on the reference slowed track), at the
   * cost of no longer matching the timeline.
   */
  speedOutput?: 'timeline' | 'natural'
}

/**
 * Encodes an AudioBuffer into a canonical 16-bit PCM RIFF WAV Blob.
 */
export function encodeAudioBufferToWav(buffer: AudioBuffer, options: { fixedGain?: number } = {}): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1 // PCM
  const bitDepth = 16

  const numSamples = buffer.length * numChannels
  const byteRate = (sampleRate * numChannels * bitDepth) / 8
  const blockAlign = (numChannels * bitDepth) / 8
  const dataSize = numSamples * (bitDepth / 8)
  const headerSize = 44
  const totalSize = headerSize + dataSize

  const arrayBuffer = new ArrayBuffer(totalSize)
  const view = new DataView(arrayBuffer)

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  // RIFF header
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')

  // fmt chunk
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // SubChunk1Size (16 for PCM)
  view.setUint16(20, format, true) // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)

  // data chunk
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  // Interleave channels & write 16-bit PCM samples
  const channelData: Float32Array[] = []
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(buffer.getChannelData(ch))
  }
  // Peak safety: separation / EQ stages can push peaks past ±1.0, which the
  // int16 encode below would hard-clip (audible crackle). For ordinary single
  // outputs, scale all channels together as before. A fixedGain is supplied
  // when encoding a set of stems so every stem receives the SAME gain and
  // their relative balance survives import/rebalancing in the timeline.
  const fixedGain = options.fixedGain === undefined
    ? undefined
    : Math.max(0, Math.min(1, Number.isFinite(options.fixedGain) ? options.fixedGain : 1))
  if (fixedGain === undefined && (channelData.length !== 2 || nativePeakScale(channelData[0] as Float32Array<ArrayBuffer>, channelData[1] as Float32Array<ArrayBuffer>) === null)) {
    let peak = 0
    for (const ch of channelData) for (let i = 0; i < ch.length; i++) { const a = Math.abs(ch[i]); if (a > peak) peak = a }
    if (peak > 0.999) {
      const g = 0.98 / peak
      for (const ch of channelData) for (let i = 0; i < ch.length; i++) ch[i] *= g
    }
  }

  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channelData[ch][i] * (fixedGain ?? 1)
      // Clamp between -1.0 and 1.0
      sample = Math.max(-1, Math.min(1, sample))
      // Scale to 16-bit signed integer [-32768, 32767]
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, intSample, true)
      offset += 2
    }
  }

  return new Blob([view], { type: 'audio/wav' })
}

/** AudioBuffer -> WAV ArrayBuffer (for the desktop sidecar pipe). */
export async function encodeAudioBufferToWavArrayBuffer(buffer: AudioBuffer): Promise<ArrayBuffer> {
  const blob = encodeAudioBufferToWav(buffer)
  return await blob.arrayBuffer()
}

/**
 * Computes 256-bin normalized RMS waveform peaks from an AudioBuffer.
 */
export function computeBufferWaveform(buffer: AudioBuffer, bins = 256): number[] {
  const peaks = new Array(bins).fill(0)
  const numChannels = buffer.numberOfChannels
  const totalLength = buffer.length
  const step = Math.max(1, Math.floor(totalLength / bins))

  for (let bin = 0; bin < bins; bin++) {
    const from = bin * step
    const to = Math.min(totalLength, from + step)
    let sumSquares = 0
    let count = 0

    for (let ch = 0; ch < numChannels; ch++) {
      const data = buffer.getChannelData(ch)
      const stride = Math.max(1, Math.floor((to - from) / 32))
      for (let i = from; i < to; i += stride) {
        sumSquares += data[i] * data[i]
        count++
      }
    }
    peaks[bin] = count > 0 ? Math.sqrt(sumSquares / count) : 0
  }

  const max = Math.max(...peaks, 0.001)
  return peaks.map((p) => Math.min(1.0, p / max))
}

export interface VocalInterval {
  id: string
  /** Start in seconds relative to the source media asset. */
  start: number
  /** End in seconds relative to the source media asset. */
  end: number
  /** Mean Silero voice probability across the unpadded detected span. */
  confidence: number
}

/** Detects likely vocal moments in a Demucs vocal stem. Silero VAD supplies
 * the speech/singing cue; a relative stem-energy check keeps lower-confidence
 * sung notes while rejecting near-silent leakage. Returned times are padded
 * slightly for breaths and reverb tails and are intended for human review. */
export async function detectVocalIntervals(
  vocalStem: AudioBuffer,
  onProgress?: (fraction: number) => void,
): Promise<VocalInterval[]> {
  const { probs, frameSamples, sr } = await detectSpeech(vocalStem, onProgress)
  if (probs.length === 0) return []
  const frameSeconds = frameSamples / sr
  const frameLength = Math.max(1, Math.round(frameSeconds * vocalStem.sampleRate))
  const levels = new Float32Array(probs.length)
  for (let f = 0; f < probs.length; f++) {
    const from = f * frameLength
    const to = Math.min(vocalStem.length, from + frameLength)
    let power = 0
    let count = 0
    for (let ch = 0; ch < vocalStem.numberOfChannels; ch++) {
      const data = vocalStem.getChannelData(ch)
      for (let i = from; i < to; i++) {
        power += data[i] * data[i]
        count++
      }
    }
    levels[f] = 10 * Math.log10(power / Math.max(1, count) + 1e-12)
  }
  const orderedLevels = Array.from(levels).sort((a, b) => a - b)
  const percentile = (p: number) => orderedLevels[Math.min(orderedLevels.length - 1, Math.floor(p * (orderedLevels.length - 1)))]
  const p90Db = percentile(0.9)
  const flags = new Uint8Array(probs.length)
  let confidentFrames = 0
  for (let f = 0; f < probs.length; f++) {
    const probability = probs[f]
    const energetic = levels[f] >= p90Db - 16
    // A strong VAD frame stands alone. Softer singing/held notes need both
    // meaningful VAD evidence and energy relative to this separated stem.
    if (probability >= 0.34 || (probability >= 0.16 && energetic) || (probability >= 0.12 && levels[f] >= p90Db - 7)) {
      flags[f] = 1
      if (probability >= 0.28) confidentFrames++
    }
  }
  const activeFrames = flags.reduce((n, v) => n + v, 0)
  // Near-silent, voice-free mixes can contain tiny model leakage. Do not turn
  // that noise into a long list of bogus replacement ranges.
  if (activeFrames < 4 || (confidentFrames < 3 && activeFrames < 10)) return []

  const rawSpans: { from: number; to: number; confidence: number }[] = []
  const maxGap = Math.max(1, Math.round(0.22 / frameSeconds))
  let start = -1
  let last = -1
  let probabilitySum = 0
  let probabilityCount = 0
  const close = () => {
    if (start < 0 || last < start) return
    const frameCount = last - start + 1
    if (frameCount >= Math.max(4, Math.round(0.14 / frameSeconds))) {
      rawSpans.push({ from: start, to: last + 1, confidence: probabilitySum / Math.max(1, probabilityCount) })
    }
    start = -1
    last = -1
    probabilitySum = 0
    probabilityCount = 0
  }
  for (let f = 0; f < flags.length; f++) {
    if (flags[f]) {
      if (start < 0) start = f
      last = f
      probabilitySum += probs[f]
      probabilityCount++
    } else if (start >= 0 && f - last > maxGap) {
      close()
    }
  }
  close()

  const padFrames = Math.round(0.12 / frameSeconds)
  const merged: VocalInterval[] = []
  for (const span of rawSpans) {
    const startTime = Math.max(0, (span.from - padFrames) * frameSeconds)
    const endTime = Math.min(vocalStem.duration, (span.to + padFrames) * frameSeconds)
    const previous = merged[merged.length - 1]
    if (previous && startTime <= previous.end + 0.08) {
      previous.end = endTime
      previous.confidence = (previous.confidence + span.confidence) / 2
    } else {
      merged.push({
        id: uid('vocal_interval'),
        start: startTime,
        end: endTime,
        confidence: Math.max(0, Math.min(1, span.confidence)),
      })
    }
  }
  return merged
}

/** Creates a non-destructive full-length mix where chosen vocal ranges are
 * replaced by the time-aligned Demucs instrumental stem. This preserves the
 * exact beat/harmony at the same moment, with short raised-cosine transitions
 * so the edit does not click. */
export function patchVocalIntervalsWithInstrumental(
  audioCtx: BaseAudioContext,
  source: AudioBuffer,
  instrumental: AudioBuffer,
  intervals: Pick<VocalInterval, 'start' | 'end'>[],
  crossfadeMs = 80,
): AudioBuffer {
  const output = audioCtx.createBuffer(source.numberOfChannels, source.length, source.sampleRate)
  const sourceChannels = Array.from({ length: source.numberOfChannels }, (_, c) => source.getChannelData(c))
  const instrumentalChannels = Array.from({ length: instrumental.numberOfChannels }, (_, c) => instrumental.getChannelData(c))
  const outputChannels = Array.from({ length: output.numberOfChannels }, (_, c) => output.getChannelData(c))
  for (let c = 0; c < outputChannels.length; c++) outputChannels[c].set(sourceChannels[c])

  const ordered = intervals
    .map((item) => ({
      start: Math.max(0, Math.min(source.duration, item.start)),
      end: Math.max(0, Math.min(source.duration, item.end)),
    }))
    .filter((item) => item.end > item.start)
    .sort((a, b) => a.start - b.start)
  const merged: { start: number; end: number }[] = []
  for (const item of ordered) {
    const previous = merged[merged.length - 1]
    if (previous && item.start <= previous.end) previous.end = Math.max(previous.end, item.end)
    else merged.push({ ...item })
  }

  for (const interval of merged) {
    const start = Math.max(0, Math.floor(interval.start * source.sampleRate))
    const end = Math.min(source.length, Math.ceil(interval.end * source.sampleRate))
    const span = Math.max(0, end - start)
    const fadeSamples = Math.min(Math.floor(span / 2), Math.max(1, Math.round(crossfadeMs * source.sampleRate / 1000)))
    for (let i = start; i < end; i++) {
      const edgeDistance = Math.min(i - start, end - 1 - i)
      const ramp = fadeSamples > 0 ? Math.min(1, edgeDistance / fadeSamples) : 1
      const amount = 0.5 - 0.5 * Math.cos(Math.PI * ramp)
      const instrumentalPosition = instrumental.sampleRate === source.sampleRate
        ? i
        : i * instrumental.sampleRate / source.sampleRate
      const instrumentalIndex = Math.min(instrumental.length - 1, Math.floor(instrumentalPosition))
      const fraction = instrumentalPosition - instrumentalIndex
      for (let c = 0; c < outputChannels.length; c++) {
        const donor = instrumentalChannels[Math.min(c, instrumentalChannels.length - 1)]
        const left = donor[instrumentalIndex] ?? 0
        const right = donor[Math.min(instrumental.length - 1, instrumentalIndex + 1)] ?? left
        const instrumentalSample = left * (1 - fraction) + right * fraction
        outputChannels[c][i] = sourceChannels[c][i] * (1 - amount) + instrumentalSample * amount
      }
    }
  }
  return output
}

/**
 * Processes an input AudioBuffer through the voice isolation / vocal removal DSP pipeline.
 */
export function isolateVoiceFromAudioBuffer(
  audioCtx: AudioContext,
  inputBuffer: AudioBuffer,
  options: VoiceIsolationOptions,
): AudioBuffer {
  const numChannels = Math.max(2, inputBuffer.numberOfChannels)
  const sampleRate = inputBuffer.sampleRate
  const length = inputBuffer.length

  const outputBuffer = audioCtx.createBuffer(numChannels, length, sampleRate)
  const outL = outputBuffer.getChannelData(0)
  const outR = outputBuffer.getChannelData(1)

  const inL = inputBuffer.getChannelData(0)
  const inR = inputBuffer.numberOfChannels > 1 ? inputBuffer.getChannelData(1) : inputBuffer.getChannelData(0)

  const strength = options.strength !== undefined ? Math.max(0, Math.min(1, options.strength)) : 0.92
  const preserveBass = options.preserveBass !== false
  const vocalLow = options.vocalBandLow || 140
  const vocalHigh = options.vocalBandHigh || 7500
  const speechFocus = options.speechFormantFocus !== false

  // Chamberlin State Variable Filter (SVF) parameters for 3-band crossover
  // 1. Low crossover (Bass cutoff)
  const f_bass = 2 * Math.sin((Math.PI * Math.min(sampleRate / 4, vocalLow)) / sampleRate)
  // 2. High crossover (Air / cymbal cutoff)
  const f_high = 2 * Math.sin((Math.PI * Math.min(sampleRate / 4, vocalHigh)) / sampleRate)
  const Q = 0.7071 // Butterworth Q

  if (options.mode === 'remove_vocal') {
    // Mode: Remove Vocal (Karaoke / Instrumental)
    // SVF filter state for left and right
    let lpL_b = 0, bpL_b = 0
    let lpR_b = 0, bpR_b = 0
    let lpL_h = 0, bpL_h = 0
    let lpR_h = 0, bpR_h = 0

    // Vocal-activity gate for reverb leakage: on slowed/reverberant songs
    // the voice's reverb tail lives in the stereo side (S), so pure center
    // cancellation leaves it audible. Envelope followers estimate how
    // center-dominated the vocal band is right now; while a centered voice
    // is active the side is trimmed (scaled by strength), and while stereo
    // content dominates the side passes untouched so instruments keep
    // their width. Attack 3 ms / release 150 ms keeps it click-free.
    const gateAttack = Math.exp(-1 / (0.003 * sampleRate))
    const gateRelease = Math.exp(-1 / (0.15 * sampleRate))
    let envM = 0
    let envS = 0

    for (let i = 0; i < length; i++) {
      const sL = inL[i]
      const sR = inR[i]

      // Split bass band (< 140Hz)
      lpL_b += f_bass * bpL_b
      const hpL_b = sL - lpL_b - Q * bpL_b
      bpL_b += f_bass * hpL_b

      lpR_b += f_bass * bpR_b
      const hpR_b = sR - lpR_b - Q * bpR_b
      bpR_b += f_bass * hpR_b

      const bassMono = preserveBass ? (lpL_b + lpR_b) * 0.5 : 0

      // Upper component above bass
      const aboveBassL = sL - lpL_b
      const aboveBassR = sR - lpR_b

      // Split air band (> 7500Hz)
      lpL_h += f_high * bpL_h
      const hpL_h = aboveBassL - lpL_h - Q * bpL_h
      bpL_h += f_high * hpL_h

      lpR_h += f_high * bpR_h
      const hpR_h = aboveBassR - lpR_h - Q * bpR_h
      bpR_h += f_high * hpR_h

      const airL = hpL_h
      const airR = hpR_h

      // Vocal mid band (between vocalLow and vocalHigh)
      const midBandL = lpL_h
      const midBandR = lpR_h

      // Mid-Side decomposition in vocal band
      const M = (midBandL + midBandR) * 0.5
      const S = (midBandL - midBandR) * 0.5

      // Vocal cancellation: attenuate Center component M by strength factor
      // S contains side instruments (stereo guitars, backing synths, room reflections)
      const absM = Math.abs(M)
      const absS = Math.abs(S)
      envM = (absM > envM ? gateAttack : gateRelease) * envM + (1 - (absM > envM ? gateAttack : gateRelease)) * absM
      envS = (absS > envS ? gateAttack : gateRelease) * envS + (1 - (absS > envS ? gateAttack : gateRelease)) * absS
      const activity = envM / (envM + envS + 0.000001)
      const gate = Math.max(0, Math.min(1, (activity - 0.3) / 0.45)) * strength
      const sideScale = Math.max(0.25, 1 - 0.65 * gate)
      const remMidL = S * sideScale + (1 - strength) * M
      const remMidR = -S * sideScale + (1 - strength) * M

      // Reconstruct output stereo channels
      outL[i] = bassMono + remMidL + airL
      outR[i] = bassMono + remMidR + airR
    }
  } else {
    // Mode: Keep Vocal (Vocal Isolation / Speech Extraction)
    // Extract center channel M = (L + R) / 2
    // Suppress stereo side energy S = (L - R) / 2
    // Apply speech formant bandpass filter
    const f_speech_hp = 2 * Math.sin((Math.PI * 130) / sampleRate)
    const f_speech_lp = 2 * Math.sin((Math.PI * 6500) / sampleRate)

    let hp_lp = 0, hp_bp = 0
    let lp_lp = 0, lp_bp = 0

    // Side envelope follower for dynamic stereo rejection
    let envSide = 0
    let envMid = 0
    const envCoeff = Math.exp(-1 / (0.006 * sampleRate)) // 6ms attack/decay

    for (let i = 0; i < length; i++) {
      const sL = inL[i]
      const sR = inR[i]

      const M = (sL + sR) * 0.5
      const S = (sL - sR) * 0.5

      envSide = envCoeff * envSide + (1 - envCoeff) * Math.abs(S)
      envMid = envCoeff * envMid + (1 - envCoeff) * Math.abs(M)

      // Compute stereo side rejection gain:
      // When stereo instruments dominate (envSide high), suppress gain.
      // When center voice dominates (envSide low), retain full gain.
      const sideRatio = envSide / (envMid + 0.0001)
      const sideSuppression = Math.max(0.04, Math.min(1.0, 1.0 - strength * 1.25 * sideRatio))

      // Center vocal candidate
      let vocal = M * sideSuppression

      // Speech formant bandpass shaping (filter out rumble < 130Hz and hiss > 6500Hz)
      if (speechFocus) {
        // Highpass at 130Hz
        hp_lp += f_speech_hp * hp_bp
        const hp_out = vocal - hp_lp - Q * hp_bp
        hp_bp += f_speech_hp * hp_out
        vocal = hp_out

        // Lowpass at 6500Hz
        lp_lp += f_speech_lp * lp_bp
        const lp_hp = vocal - lp_lp - Q * lp_bp
        lp_bp += f_speech_lp * lp_hp
        vocal = lp_lp
      }

      // Mild speech presence boost (formant resonance around 2.5kHz)
      outL[i] = vocal
      outR[i] = vocal
    }
  }

  return outputBuffer
}

/**
 * Isolation-output finalization shared by EVERY engine (demucs, DSP,
 * ai-denoise, RNNoise, omni-unified): DC block (one-pole ~15 Hz) + loudness
 * normalization to -18 dBFS RMS with a 0.98 peak ceiling, gain clamped to
 * +12/-6 dB, and near-silence (< -50 dBFS RMS) skipped — keep_vocal of an
 * instrumental input stays near-silent instead of being amplified into
 * separation noise. Mutates the buffer in place and returns it.
 *
 * Runs the native wasm core first (`omni_normalize` in native/dsp-core);
 * the JS fallback below is a verbatim, bit-verified copy (qa/native-dsp-parity.mjs
 * runs both against the same inputs — max|diff| <= 1e-6).
 */
const FINALIZE_TARGET_RMS = Math.pow(10, -18 / 20) // -18 dBFS
const FINALIZE_PEAK_CEIL = 0.98
const FINALIZE_SILENCE_RMS = Math.pow(10, -50 / 20) // below this: leave untouched

function jsIsolationNormalize(a: Float32Array, b: Float32Array): number {
  const n = a.length
  if (n <= 0) return 1
  const POLE = 1 - 2 * Math.PI * 15 / 44100
  // 1) DC block (double state, float32 store — same rounding points as omni_dsp.cpp)
  {
    let x1a = 0, y1a = 0, x1b = 0, y1b = 0
    for (let i = 0; i < n; i++) {
      const xa = a[i], xb = b[i]
      const ya = xa - x1a + POLE * y1a
      const yb = xb - x1b + POLE * y1b
      x1a = xa; y1a = ya; x1b = xb; y1b = yb
      a[i] = ya; b[i] = yb
    }
  }
  // 2) loudness normalize (skip near-silence)
  let sa = 0, sb = 0
  for (let i = 0; i < n; i++) { sa += a[i] * a[i]; sb += b[i] * b[i] }
  const rms = Math.sqrt((sa + sb) / (2 * n))
  if (rms < FINALIZE_SILENCE_RMS) return 1
  let g = FINALIZE_TARGET_RMS / rms
  g = Math.min(g, 3.9810717055349722) // +12 dB cap
  g = Math.max(g, 0.5011872336272722) // -6 dB floor
  if (!(g > 0.98 && g < 1.02)) {
    // peak safety: never exceed the ceiling
    let peak = 0
    for (const ch of [a, b]) for (let i = 0; i < n; i++) { const v = Math.abs(ch[i] * g); if (v > peak) peak = v }
    if (peak > FINALIZE_PEAK_CEIL) g *= FINALIZE_PEAK_CEIL / peak
    if (!(g > 0.98 && g < 1.02)) {
      for (const ch of [a, b]) for (let i = 0; i < n; i++) ch[i] *= g
      return g
    }
  }
  return 1
}

export function finalizeIsolationOutput(buffer: AudioBuffer): AudioBuffer {
  if (buffer.length === 0) return buffer
  const a = buffer.getChannelData(0) as Float32Array<ArrayBuffer>
  // mono: run a copy through the 2-channel core (bit-identical to the stereo
  // path — the copy keeps the fallback's per-channel loops alias-free)
  const b = buffer.numberOfChannels > 1
    ? buffer.getChannelData(1) as Float32Array<ArrayBuffer>
    : new Float32Array(a)
  const g = nativeNormalize(a, b, FINALIZE_TARGET_RMS, FINALIZE_PEAK_CEIL, FINALIZE_SILENCE_RMS)
  if (g === null) jsIsolationNormalize(a, b)
  return buffer
}

/**
 * Downloads audio from URL, processes voice isolation, and returns WAV blob + metadata.
 */
export async function processVoiceIsolation(
  sourceUrl: string,
  options: VoiceIsolationOptions,
  onProgress?: (percent: number, status: string) => void,
): Promise<{ blob: Blob; url: string; duration: number; waveform: number[]; naturalPitch?: boolean }> {
  onProgress?.(10, 'Fetching audio stream…')

  const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const audioCtx = new AudioCtxClass()

  let naturalPitch = false
  try {
    let inputBuffer: AudioBuffer
    try {
      const response = await fetch(sourceUrl)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const arrayBuffer = await response.arrayBuffer()
      onProgress?.(30, 'Decoding audio samples…')
      inputBuffer = await audioCtx.decodeAudioData(arrayBuffer)
    } catch (decodeError) {
      // Keep the sine fixture only for explicit mock URLs used by UI tests.
      // A real fetch/decode failure must never look like successful isolation
      // of the wrong (synthetic) sound — this is especially important for
      // compressed/slowed files where a decoder failure can otherwise hide.
      if (!sourceUrl.startsWith('blob:mock')) {
        const message = decodeError instanceof Error ? decodeError.message : String(decodeError)
        throw new Error(`Could not decode the selected audio (${message}). Import a supported audio file or extract an audio-only track from the video.`)
      }
      const sampleRate = 44100
      const length = sampleRate * 3
      inputBuffer = audioCtx.createBuffer(2, length, sampleRate)
      const left = inputBuffer.getChannelData(0)
      const right = inputBuffer.getChannelData(1)
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate
        left[i] = Math.sin(2 * Math.PI * 440 * t) * 0.25
        right[i] = Math.sin(2 * Math.PI * 440 * t) * 0.25
      }
    }

    const modelTag = options.model || 'omni-voicetarget'

    let processedBuffer: AudioBuffer
    if (modelTag === 'htdemucs-v4') {
      // REAL neural separation: Meta Demucs v4 Hybrid Transformer (htdemucs)
      // via ONNX Runtime Web. Vocals stem for keep_vocal; drums+bass+other
      // (instrumental) for remove_vocal. Downloads /models/htdemucs.onnx once
      // (npm run fetch:demucs), runs on WebGPU with WASM CPU fallback.
      // strength drives shift-averaging passes (measured SI-SDR on the
      // showcase study: 1 pass 17.5 dB → 2 passes 20.5 dB → 3 passes 20.6 dB,
      // finite-aware averaging + LS cross-talk removal).
      // Each pass runs in a throwaway Web Worker, so memory stays flat on
      // every backend (the wasm heap dies with the worker).
      const strength = options.strength ?? 0.92
      const passes = strength >= 0.85 ? 3 : strength >= 0.6 ? 2 : 1
      // Slowed-production detection (cheap: one Silero pass on normal tracks).
      // Separating at the corrected speed then slowing the stems back restores
      // vocals that "slowed + reverb" edits pitch out of the model's range.
      let speedFactor = 1
      if (options.speedNormalize !== false) {
        const override = options.speedFactorOverride
        if (Number.isFinite(override) && (override ?? 1) > 1) {
          speedFactor = Math.max(1.01, Math.min(2, override as number))
          onProgress?.(40, `Using manual slowed-track correction ×${speedFactor.toFixed(2)}…`)
        } else {
          onProgress?.(40, 'Checking for slowed production…')
          const detection = await detectSlowedFactor(inputBuffer)
          speedFactor = detection.factor
        }
        if (speedFactor > 1) {
          onProgress?.(42, `Slowed production correction ×${speedFactor.toFixed(2)} — separating at corrected speed`)
        }
      }
      // natural pitch: keep the acapella at the corrected speed (shorter,
      // natural-pitch output — only meaningful when a fix actually fired)
      naturalPitch = speedFactor > 1 && options.speedOutput === 'natural' && options.mode === 'keep_vocal'
      if (naturalPitch) {
        onProgress?.(44, `Keeping the vocals at natural pitch (×${speedFactor.toFixed(2)} speed, not slowed back)`)
      }
      const separation = await separateWithDemucs(audioCtx, inputBuffer, onProgress, {
        passes,
        speedFactor,
        speedRestoreVocals: !naturalPitch,
      })
      if (options.mode === 'keep_vocal') {
        processedBuffer = separation.vocals
        if (options.vadGate !== false) {
          // Second neural model: Silero VAD finds speech; a safe gate cleans
          // residual separation noise in the pauses (never touches energetic
          // breaths/sung vocals — see computeSpeechGate).
          onProgress?.(93, 'Silero VAD: cleaning speech pauses…')
          const gate = await computeSpeechGate(
            processedBuffer,
            { strength },
            (f) => onProgress?.(93 + Math.round(f * 4), `Silero VAD: ${(f * 100).toFixed(0)}%`),
          )
          processedBuffer = applyGainEnvelope(audioCtx, processedBuffer, gate)
        }
      } else {
        processedBuffer = separation.instrumental
      }
      onProgress?.(98, `Demucs v4 ${options.mode === 'keep_vocal' ? 'vocals' : 'instrumental'} ready`)
    } else if (modelTag === 'omni-denoise-onnx' && options.mode === 'keep_vocal') {
      // Neural path: the ONNX GRU masker extracts the main voice and treats
      // everything else (hiss, hum, SFX, songs — even heavily padded song
      // stacks that turn to noise) as interference to suppress.
      onProgress?.(50, `AI Denoise: loading omni-denoise-v1 (${isDesktopMode() ? 'native desktop runtime' : 'WASM'})…`)
      const alpha = 1.08 - 0.55 * (options.strength ?? 0.92) // strength 1 -> 0.53 gentle, 0 -> full
      if (isDesktopMode()) {
        const wavBytes = await encodeAudioBufferToWavArrayBuffer(inputBuffer)
        const result = await denoiseViaDesktop(wavBytes, alpha)
        processedBuffer = await audioCtx.decodeAudioData(result)
      } else {
        const res = await denoiseAudioBuffer(inputBuffer, alpha)
        processedBuffer = audioCtx.createBuffer(1, res.samples.length, inputBuffer.sampleRate)
        processedBuffer.copyToChannel(res.samples as Float32Array<ArrayBuffer>, 0)
      }
      onProgress?.(85, 'AI Denoise complete')
    } else if (modelTag === 'omni-unified') {
      // Self-made unified model: one graph isolates the voice, denoises it,
      // and predicts its loudness-normalizing gain (applied in-graph output;
      // finalizeIsolationOutput then verifies the landing window).
      onProgress?.(50, `Unified model: loading omni-unified-v1 (${UNIFIED_WASM_NOTE})…`)
      const res = await unifiedIsolateBuffer(inputBuffer, options.mode, options.strength ?? 0.92)
      processedBuffer = audioCtx.createBuffer(1, res.samples.length, inputBuffer.sampleRate)
      processedBuffer.copyToChannel(res.samples as Float32Array<ArrayBuffer>, 0)
      onProgress?.(85, options.mode === 'keep_vocal'
        ? `Unified isolation complete (mean mask ${(res.meanMask * 100).toFixed(0)}%, gain ${res.gainDb >= 0 ? '+' : ''}${res.gainDb.toFixed(1)} dB)`
        : `Instrumental (mask complement) complete`)
    } else if (modelTag === 'rnnoise-xiph' && options.mode === 'keep_vocal') {
      // Imported neural denoiser: Xiph RNNoise (trained GRU, wasm build of the
      // official C sources). Suppresses broadband/hiss/hum noise around
      // speech — measured +13.2 dB SNR at 0 dB input SNR on the speech
      // fixture. Output is mono; final loudness normalization (and DC
      // blocking) is applied by finalizeIsolationOutput like every engine.
      onProgress?.(50, 'RNNoise: loading the trained denoiser module…')
      const res = await rnnoiseDenoiseBuffer(inputBuffer, (f, note) => {
        onProgress?.(50 + Math.round(f * 35), note ?? 'RNNoise denoising…')
      })
      processedBuffer = audioCtx.createBuffer(1, res.samples.length, inputBuffer.sampleRate)
      processedBuffer.copyToChannel(res.samples as Float32Array<ArrayBuffer>, 0)
      onProgress?.(85, `RNNoise complete (mean VAD ${(res.meanVad * 100).toFixed(0)}%)`)
    } else {
      onProgress?.(55, options.mode === 'keep_vocal'
        ? `Isolating vocal formants using ${modelTag}…`
        : `Removing vocal stems using ${modelTag}…`)
      processedBuffer = isolateVoiceFromAudioBuffer(audioCtx, inputBuffer, options)
    }
    // Shared finalization — every engine lands the same output contract:
    // DC-blocked, -18 dBFS RMS (0.98 peak ceiling, +12/-6 dB gain window),
    // near-silence left untouched.
    processedBuffer = finalizeIsolationOutput(processedBuffer)
    onProgress?.(80, 'Encoding to WAV format…')

    const blob = encodeAudioBufferToWav(processedBuffer)
    const url = URL.createObjectURL(blob)
    const duration = processedBuffer.duration
    const waveform = computeBufferWaveform(processedBuffer, 256)

    onProgress?.(100, 'Voice isolation complete')
    return { blob, url, duration, waveform, naturalPitch }
  } finally {
    await audioCtx.close()
  }
}

export type DemucsStemRole = 'vocals' | 'drums' | 'bass' | 'other'

export interface DemucsStemSeparationOptions {
  strength?: number
  speedNormalize?: boolean
  speedFactorOverride?: number
}

export interface DemucsStemSeparationResult {
  groupId: string
  intervals: VocalInterval[]
  stemAssetIds: Record<DemucsStemRole, string>
  stemClipIds: string[]
  instrumentalAssetId: string
  speedFactor: number
}

/** Runs the high-quality four-stem Demucs model, detects candidate vocal
 * ranges on the sped-domain vocal output (when speed correction is active),
 * then restores every stem to the source timeline. A shared peak-safety gain
 * preserves the relative loudness between stems. */
export async function executeDemucsStemSeparationForClip(
  clipId: string,
  options: DemucsStemSeparationOptions = {},
  onProgress?: (percent: number, status: string) => void,
): Promise<DemucsStemSeparationResult> {
  const store = useEditor.getState()
  const clip = store.clips.find((item) => item.id === clipId)
  if (!clip) throw new Error('Selected clip not found on timeline')
  const sourceAsset = store.assets.find((item) => item.id === clip.assetId)
  if (!sourceAsset) throw new Error('Media asset for clip not found')
  if (!(await isDemucsModelAvailable())) {
    throw new Error('Demucs v4 weights are missing. Run `npm run fetch:demucs` and reload the editor.')
  }

  const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const audioCtx = new AudioCtxClass()
  try {
    onProgress?.(4, 'Loading source audio…')
    const response = await fetch(sourceAsset.url)
    if (!response.ok) throw new Error(`Could not load source audio (HTTP ${response.status})`)
    const inputBuffer = await audioCtx.decodeAudioData(await response.arrayBuffer())

    let speedFactor = 1
    if (options.speedNormalize !== false) {
      const override = options.speedFactorOverride
      if (Number.isFinite(override) && (override ?? 1) > 1) {
        speedFactor = Math.max(1.01, Math.min(2, override as number))
        onProgress?.(8, `Using manual slowed-track correction ×${speedFactor.toFixed(2)}…`)
      } else {
        onProgress?.(8, 'Checking for slowed + reverb production…')
        speedFactor = (await detectSlowedFactor(inputBuffer)).factor
      }
      if (speedFactor > 1) onProgress?.(10, `Slowed production correction ×${speedFactor.toFixed(2)} before separation`)
    }
    const strength = options.strength ?? 0.92
    const passes = strength >= 0.85 ? 3 : strength >= 0.6 ? 2 : 1
    const separation = await separateWithDemucs(audioCtx, inputBuffer, onProgress, {
      passes,
      speedFactor,
      speedRestoreVocals: true,
    })
    const rawVocal = separation.stems.vocals
    if (!rawVocal) throw new Error('Demucs did not return a vocal stem')
    const analysisBuffer = audioCtx.createBuffer(rawVocal.channelData.length, rawVocal.channelData[0].length, rawVocal.sampleRate)
    for (let c = 0; c < rawVocal.channelData.length; c++) {
      analysisBuffer.copyToChannel(rawVocal.channelData[c] as Float32Array<ArrayBuffer>, c)
    }
    onProgress?.(93, 'Finding vocal ranges with Silero VAD…')
    const foundIntervals = await detectVocalIntervals(analysisBuffer, (fraction) => {
      onProgress?.(93 + Math.round(fraction * 5), `Finding vocal ranges · ${(fraction * 100).toFixed(0)}%`)
    })
    const intervals = foundIntervals.map((item) => ({
      ...item,
      start: Math.max(0, Math.min(inputBuffer.duration, item.start * speedFactor)),
      end: Math.max(0, Math.min(inputBuffer.duration, item.end * speedFactor)),
    })).filter((item) => item.end > item.start)

    const baseName = sourceAsset.name.replace(/\.[^/.]+$/, '')
    const groupId = uid('demucs_group')
    const roles: DemucsStemRole[] = ['vocals', 'drums', 'bass', 'other']
    const buffers = roles.map((role) => {
      const buffer = separation.timelineStems[role]
      if (!buffer) throw new Error(`Demucs did not return the ${role} stem`)
      return buffer
    })
    const instrumentalBuffer = separation.instrumental
    let maximumPeak = 0
    for (const buffer of [...buffers, instrumentalBuffer]) {
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        const data = buffer.getChannelData(c)
        for (let i = 0; i < data.length; i++) maximumPeak = Math.max(maximumPeak, Math.abs(data[i]))
      }
    }
    const fixedGain = maximumPeak > 0.98 ? 0.98 / maximumPeak : 1
    const labels: Record<DemucsStemRole, string> = { vocals: 'Vocals', drums: 'Drums', bass: 'Bass', other: 'Other' }
    const stemAssets = {} as Record<DemucsStemRole, MediaAsset>
    for (let i = 0; i < roles.length; i++) {
      const role = roles[i]
      const buffer = buffers[i]
      const blob = encodeAudioBufferToWav(buffer, { fixedGain })
      stemAssets[role] = {
        id: uid('asset_stem'),
        name: `[Demucs v4 · ${labels[role]}] ${baseName}.wav`,
        kind: 'audio',
        url: URL.createObjectURL(blob),
        duration: buffer.duration,
        width: 0,
        height: 0,
        waveform: computeBufferWaveform(buffer, 256),
        size: blob.size,
        extractedFromClipId: clip.id,
        audioStemRole: role,
        audioStemGroupId: groupId,
      }
    }
    const instrumentalBlob = encodeAudioBufferToWav(instrumentalBuffer, { fixedGain })
    const instrumentalAsset: MediaAsset = {
      id: uid('asset_stem'),
      name: `[Demucs v4 · Instrumental] ${baseName}.wav`,
      kind: 'audio',
      url: URL.createObjectURL(instrumentalBlob),
      duration: instrumentalBuffer.duration,
      width: 0,
      height: 0,
      waveform: computeBufferWaveform(instrumentalBuffer, 256),
      size: instrumentalBlob.size,
      extractedFromClipId: clip.id,
      audioStemRole: 'instrumental',
      audioStemGroupId: groupId,
    }

    const entries = roles.map((role) => {
      const asset = stemAssets[role]
      const id = uid('clip_stem')
      const duration = Math.max(0, Math.min(clip.duration, asset.duration - clip.inPoint))
      if (duration <= 0) throw new Error(`The selected clip has no ${labels[role].toLowerCase()} audio in its visible range`)
      const timelineClip: Omit<Clip, 'trackId'> = {
        id,
        assetId: asset.id,
        start: clip.start,
        duration,
        inPoint: clip.inPoint,
        name: asset.name,
        kind: 'audio',
        volume: 1,
        hidden: false,
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      }
      return { asset, clip: timelineClip, trackName: `${labels[role]} · ${baseName}` }
    })
    const added = useEditor.getState().addGeneratedAudioTracks(entries, {
      extraAssets: [instrumentalAsset],
      muteClipIds: [clip.id],
      selectedClipId: clip.id,
    })
    onProgress?.(100, `Four Demucs stems ready · ${intervals.length} vocal range${intervals.length === 1 ? '' : 's'} detected`)
    return {
      groupId,
      intervals,
      stemAssetIds: {
        vocals: stemAssets.vocals.id,
        drums: stemAssets.drums.id,
        bass: stemAssets.bass.id,
        other: stemAssets.other.id,
      },
      stemClipIds: added.clipIds,
      instrumentalAssetId: instrumentalAsset.id,
      speedFactor,
    }
  } finally {
    await audioCtx.close()
  }
}

/** Builds a full-length replacement mix from a reviewed set of vocal ranges,
 * using the matching time-aligned instrumental passage as the patch donor. The
 * source and separated tracks are muted together so the new mix is not doubled. */
export async function executeVocalPatchForClip(
  clipId: string,
  instrumentalAssetId: string,
  intervals: Pick<VocalInterval, 'start' | 'end'>[],
  options: { crossfadeMs?: number; stemClipIds?: string[]; groupId?: string } = {},
  onProgress?: (percent: number, status: string) => void,
): Promise<{ assetId: string; clipId: string; trackId: string }> {
  if (intervals.length === 0) throw new Error('Select at least one detected vocal range to patch')
  const store = useEditor.getState()
  const sourceClip = store.clips.find((item) => item.id === clipId)
  if (!sourceClip) throw new Error('Selected source clip is no longer on the timeline')
  const sourceAsset = store.assets.find((item) => item.id === sourceClip.assetId)
  const instrumentalAsset = store.assets.find((item) => item.id === instrumentalAssetId)
  if (!sourceAsset || !instrumentalAsset) throw new Error('The source or matching instrumental stem is no longer available')

  const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const audioCtx = new AudioCtxClass()
  try {
    onProgress?.(5, 'Loading source and time-matched instrumental…')
    const [sourceResponse, instrumentalResponse] = await Promise.all([
      fetch(sourceAsset.url),
      fetch(instrumentalAsset.url),
    ])
    if (!sourceResponse.ok || !instrumentalResponse.ok) throw new Error('Could not reload the audio assets for patching')
    const [source, instrumental] = await Promise.all([
      sourceResponse.arrayBuffer().then((data) => audioCtx.decodeAudioData(data)),
      instrumentalResponse.arrayBuffer().then((data) => audioCtx.decodeAudioData(data)),
    ])
    onProgress?.(45, `Patching ${intervals.length} reviewed vocal range${intervals.length === 1 ? '' : 's'} with the matching instrumental…`)
    const patched = patchVocalIntervalsWithInstrumental(
      audioCtx,
      source,
      instrumental,
      intervals,
      options.crossfadeMs ?? 80,
    )
    const blob = encodeAudioBufferToWav(patched)
    const baseName = sourceAsset.name.replace(/\.[^/.]+$/, '')
    const patchedAsset: MediaAsset = {
      id: uid('asset_patch'),
      name: `[Vocal Patch · ${intervals.length} range${intervals.length === 1 ? '' : 's'}] ${baseName}.wav`,
      kind: 'audio',
      url: URL.createObjectURL(blob),
      duration: patched.duration,
      width: 0,
      height: 0,
      waveform: computeBufferWaveform(patched, 256),
      size: blob.size,
      extractedFromClipId: sourceClip.id,
      audioStemRole: 'patched-mix',
      audioStemGroupId: options.groupId,
    }
    const newClip: Omit<Clip, 'trackId'> = {
      id: uid('clip_patch'),
      assetId: patchedAsset.id,
      start: sourceClip.start,
      duration: Math.max(0, Math.min(sourceClip.duration, patched.duration - sourceClip.inPoint)),
      inPoint: sourceClip.inPoint,
      name: patchedAsset.name,
      kind: 'audio',
      volume: 1,
      hidden: false,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    }
    if (newClip.duration <= 0) throw new Error('The selected source clip has no audio in its visible range')
    const added = useEditor.getState().addGeneratedAudioTracks([
      { asset: patchedAsset, clip: newClip, trackName: `Patched Mix · ${baseName}` },
    ], { muteClipIds: [sourceClip.id, ...(options.stemClipIds || [])], selectedClipId: sourceClip.id })
    onProgress?.(100, 'Vocal patch mix added to the timeline')
    return { assetId: patchedAsset.id, clipId: added.clipIds[0], trackId: added.trackIds[0] }
  } finally {
    await audioCtx.close()
  }
}

/**
 * High-level action: Runs voice isolation on a target clip, creates an isolated
 * MediaAsset in the library, and inserts a synchronized clip on a new audio track.
 */
export async function executeVoiceIsolationForClip(
  clipId: string,
  options: VoiceIsolationOptions,
  onProgress?: (percent: number, status: string) => void,
): Promise<{ assetId: string; clipId: string; trackId: string }> {
  const store = useEditor.getState()
  const clip = store.clips.find((c) => c.id === clipId)
  if (!clip) {
    throw new Error('Selected clip not found on timeline')
  }

  const asset = store.assets.find((a) => a.id === clip.assetId)
  if (!asset) {
    throw new Error('Media asset for clip not found')
  }

  const activeModel = options.model || (store as any).audioIsolationModel || 'omni-voicetarget'
  const labelPrefix = options.mode === 'keep_vocal' ? `[Vocal Isolated · ${activeModel}]` : `[Vocal Removed · ${activeModel}]`
  const baseName = asset.name.replace(/\.[^/.]+$/, '')

  const result = await processVoiceIsolation(asset.url, { ...options, model: activeModel }, onProgress)

  const newAssetName = result.naturalPitch
    ? `${labelPrefix} ${baseName} · natural pitch.wav`
    : `${labelPrefix} ${baseName}.wav`

  const newAssetId = uid('asset_voice')
  const newAsset: MediaAsset = {
    id: newAssetId,
    name: newAssetName,
    kind: 'audio',
    url: result.url,
    duration: result.duration,
    width: 0,
    height: 0,
    waveform: result.waveform,
    size: result.blob.size,
  }

  // Add new asset to project Media Library
  useEditor.getState().addAsset(newAsset)

  // Ensure dedicated audio track
  const audioTrackId = useEditor.getState().ensureTrack('audio')

  // Create isolated audio clip placed exactly in sync with the source clip
  const newClipId = uid('clip_voice')
  const newClip: Clip = {
    id: newClipId,
    trackId: audioTrackId,
    assetId: newAssetId,
    start: clip.start,
    duration: clip.duration,
    inPoint: clip.inPoint,
    name: newAssetName,
    kind: 'audio',
    volume: 1,
    hidden: false,
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
  }

  useEditor.setState((s) => ({
    clips: [
      ...s.clips.map((c) => (c.id === clip.id ? { ...c, volume: 0 } : c)),
      newClip,
    ],
    selectedClipId: newClip.id,
  }))

  return {
    assetId: newAssetId,
    clipId: newClipId,
    trackId: audioTrackId,
  }
}
