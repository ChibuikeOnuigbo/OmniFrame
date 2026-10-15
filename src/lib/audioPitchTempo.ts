import { useEditor } from '../store'
import type { Clip, MediaAsset } from '../types'
import { computeBufferWaveform, encodeAudioBufferToWav } from './voiceIsolation'
import { uid } from './time'

export interface AudioPitchTempoOptions {
  pitchSemitones: number
  /** Playback-speed percentage. 125% is faster/shorter; pitch remains independent. */
  tempoPercent: number
  pitchCharacter: 'music' | 'voice'
  muteSource?: boolean
}

export interface AudioPitchTempoProgress {
  percent: number
  status: string
}

interface WorkerDoneMessage {
  type: 'done'
  requestId: number
  channels: ArrayBuffer[]
  duration: number
  peakCeiling: number
}

interface WorkerErrorMessage {
  type: 'error'
  requestId: number
  message: string
}

interface WorkerProgressMessage {
  type: 'progress'
  requestId: number
  percent: number
  status: string
}

let nextRequestId = 1
const MAX_PROCESS_SECONDS = 5 * 60

function getAudioContextConstructor(): typeof AudioContext {
  const constructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!constructor) throw new Error('This browser does not support local audio rendering.')
  return constructor
}

function formatPitch(semitones: number): string {
  if (Math.abs(semitones) < 0.001) return '0 st'
  return `${semitones > 0 ? '+' : ''}${semitones} st`
}

async function runPitchTempoWorker(
  channels: Float32Array[],
  sampleRate: number,
  options: AudioPitchTempoOptions,
  onProgress?: (progress: AudioPitchTempoProgress) => void,
): Promise<{ channels: Float32Array[]; duration: number; peakCeiling: number }> {
  const requestId = nextRequestId++
  const worker = new Worker(new URL('./audioPitchTempo.worker.ts', import.meta.url), { type: 'module' })
  const buffers = channels.map((channel) => channel.buffer as ArrayBuffer)
  try {
    return await new Promise((resolve, reject) => {
      let settled = false
      const finish = (error?: Error, result?: { channels: Float32Array[]; duration: number; peakCeiling: number }) => {
        if (settled) return
        settled = true
        worker.terminate()
        if (error) reject(error)
        else if (result) resolve(result)
        else reject(new Error('The audio renderer returned no output.'))
      }
      worker.onmessage = (event: MessageEvent<WorkerDoneMessage | WorkerErrorMessage | WorkerProgressMessage>) => {
        const message = event.data
        if (message.requestId !== requestId) return
        if (message.type === 'progress') {
          onProgress?.({ percent: message.percent, status: message.status })
        } else if (message.type === 'error') {
          finish(new Error(message.message))
        } else if (message.type === 'done') {
          finish(undefined, {
            channels: message.channels.map((buffer) => new Float32Array(buffer)),
            duration: message.duration,
            peakCeiling: message.peakCeiling,
          })
        }
      }
      worker.onerror = (event) => finish(new Error(event.message || 'Audio processing worker failed.'))
      worker.postMessage({
        requestId,
        channels: buffers,
        sampleRate,
        pitchSemitones: options.pitchSemitones,
        tempoPercent: options.tempoPercent,
        pitchCharacter: options.pitchCharacter,
      }, buffers)
    })
  } catch (error) {
    worker.terminate()
    throw error
  }
}

/**
 * Renders a trimmed audio clip with independent pitch and tempo controls,
 * adds the result as one undoable generated track, and optionally mutes the
 * original clip so the new output is not doubled.
 */
export async function executeAudioPitchTempoForClip(
  clipId: string,
  options: AudioPitchTempoOptions,
  onProgress?: (progress: AudioPitchTempoProgress) => void,
): Promise<{ assetId: string; clipId: string; trackId: string; duration: number }> {
  const state = useEditor.getState()
  const clip = state.clips.find((item) => item.id === clipId)
  if (!clip || clip.kind !== 'audio') {
    throw new Error('Select an audio clip on the timeline. For a video soundtrack, extract its audio first.')
  }
  const asset = state.assets.find((item) => item.id === clip.assetId)
  if (!asset || asset.kind !== 'audio') throw new Error('The selected clip has no available audio source.')
  if (!Number.isFinite(options.pitchSemitones) || Math.abs(options.pitchSemitones) > 12) {
    throw new Error('Pitch shift must be between −12 and +12 semitones.')
  }
  if (!Number.isFinite(options.tempoPercent) || options.tempoPercent < 50 || options.tempoPercent > 150) {
    throw new Error('Tempo must be between 50% and 150%.')
  }
  if (Math.abs(options.pitchSemitones) < 0.001 && Math.abs(options.tempoPercent - 100) < 0.001) {
    throw new Error('Change pitch or tempo before rendering.')
  }

  const AudioContextConstructor = getAudioContextConstructor()
  const context = new AudioContextConstructor()
  try {
    onProgress?.({ percent: 1, status: 'Loading source audio…' })
    const response = await fetch(asset.url)
    if (!response.ok) throw new Error(`Could not load source audio (HTTP ${response.status}).`)
    const decoded = await context.decodeAudioData(await response.arrayBuffer())
    const visibleStart = Math.max(0, clip.inPoint)
    const visibleEnd = Math.min(decoded.duration, clip.inPoint + clip.duration)
    if (visibleEnd <= visibleStart) throw new Error('The selected clip range contains no audio.')
    const duration = visibleEnd - visibleStart
    if (duration > MAX_PROCESS_SECONDS) {
      throw new Error(`This tool currently renders clips up to ${MAX_PROCESS_SECONDS / 60} minutes. Trim the source clip and try again.`)
    }
    const startSample = Math.max(0, Math.floor(visibleStart * decoded.sampleRate))
    const endSample = Math.min(decoded.length, Math.ceil(visibleEnd * decoded.sampleRate))
    const inputChannels = Array.from({ length: decoded.numberOfChannels }, (_, channel) =>
      decoded.getChannelData(channel).slice(startSample, endSample),
    )
    if (!inputChannels.length || !inputChannels[0].length) throw new Error('The selected clip range contains no decodable samples.')

    const rendered = await runPitchTempoWorker(inputChannels, decoded.sampleRate, options, onProgress)
    const outputLength = rendered.channels[0]?.length ?? 0
    if (!outputLength || rendered.channels.some((channel) => channel.length !== outputLength)) {
      throw new Error('The rendered audio channels have inconsistent lengths.')
    }
    const outputBuffer = context.createBuffer(rendered.channels.length, outputLength, decoded.sampleRate)
    rendered.channels.forEach((channel, index) => outputBuffer.copyToChannel(channel as Float32Array<ArrayBuffer>, index))
    const blob = encodeAudioBufferToWav(outputBuffer)
    const url = URL.createObjectURL(blob)
    const baseName = asset.name.replace(/\.[^/.]+$/, '')
    const pitchLabel = `pitch ${formatPitch(options.pitchSemitones)}`
    const tempoLabel = `tempo ${Math.round(options.tempoPercent)}%`
    const outputName = `${baseName} · ${pitchLabel} · ${tempoLabel}.wav`
    const outputAsset: MediaAsset = {
      id: uid('asset_pitch_tempo'),
      name: outputName,
      kind: 'audio',
      url,
      duration: outputBuffer.duration,
      width: 0,
      height: 0,
      size: blob.size,
      waveform: computeBufferWaveform(outputBuffer, 256),
    }
    const outputClip: Omit<Clip, 'trackId'> = {
      id: uid('clip_pitch_tempo'),
      assetId: outputAsset.id,
      start: clip.start,
      duration: outputBuffer.duration,
      inPoint: 0,
      name: outputName,
      kind: 'audio',
      volume: 1,
      hidden: false,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    }
    onProgress?.({ percent: 97, status: 'Adding rendered audio to the project…' })
    const inserted = useEditor.getState().addGeneratedAudioTracks([
      { asset: outputAsset, clip: outputClip, trackName: `Pitch/Tempo · ${baseName.slice(0, 28)}` },
    ], {
      muteClipIds: options.muteSource === false ? [] : [clip.id],
      selectedClipId: outputClip.id,
    })
    onProgress?.({ percent: 100, status: 'Pitch/tempo render added to the timeline.' })
    return {
      assetId: outputAsset.id,
      clipId: inserted.clipIds[0] ?? outputClip.id,
      trackId: inserted.trackIds[0] ?? '',
      duration: outputBuffer.duration,
    }
  } finally {
    await context.close()
  }
}
