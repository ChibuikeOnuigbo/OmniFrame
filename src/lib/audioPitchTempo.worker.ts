import shiftTransient from '@audio/shift-transient'
import shiftFormant from '@audio/shift-formant'
import stretchTransient from '@audio/stretch-transient'

interface PitchTempoRequest {
  requestId: number
  channels: ArrayBuffer[]
  sampleRate: number
  pitchSemitones: number
  tempoPercent: number
  pitchCharacter: 'music' | 'voice'
}

type AudioChunkWriter = {
  (chunk: Float32Array): Float32Array
  (chunk: Float32Array[]): Float32Array[]
  (): Float32Array | Float32Array[]
}

const worker = self as unknown as Worker

function postProgress(requestId: number, percent: number, status: string) {
  worker.postMessage({ type: 'progress', requestId, percent, status })
}

function collectChannels(
  inputs: Float32Array[],
  writer: AudioChunkWriter,
  chunkSize: number,
  progress?: (fraction: number) => void,
): Float32Array[] {
  const chunksByChannel: Float32Array[][] = inputs.map(() => [])
  const inputLength = inputs[0]?.length ?? 0
  for (let start = 0; start < inputLength; start += chunkSize) {
    const end = Math.min(inputLength, start + chunkSize)
    const slices = inputs.map((channel) => channel.subarray(start, end))
    const output = writer(slices) as Float32Array[]
    if (!Array.isArray(output) || output.length !== inputs.length) {
      throw new Error('Pitch processor returned an unexpected channel layout.')
    }
    output.forEach((channel, index) => {
      if (channel.length) chunksByChannel[index].push(channel)
    })
    progress?.(end / Math.max(1, inputLength))
  }
  const tail = writer() as Float32Array[]
  if (Array.isArray(tail)) tail.forEach((channel, index) => {
    if (channel?.length) chunksByChannel[index].push(channel)
  })
  return chunksByChannel.map((chunks) => {
    const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const result = new Float32Array(length)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    return result
  })
}

function resizeToLength(channels: Float32Array[], length: number): Float32Array[] {
  return channels.map((channel) => {
    if (channel.length === length) return channel
    const difference = Math.abs(channel.length - length)
    // The STFT stream has a small window-sized edge allowance. A larger
    // discrepancy means the plugin output contract changed and should fail
    // loudly rather than silently desynchronize pitch and timeline length.
    if (difference > Math.max(8192, Math.ceil(length * 0.03))) {
      throw new Error(`Audio processor returned ${channel.length} samples; expected about ${length}.`)
    }
    const resized = new Float32Array(length)
    resized.set(channel.subarray(0, Math.min(length, channel.length)))
    return resized
  })
}

function toMidSide(left: Float32Array, right: Float32Array): Float32Array[] {
  const mid = new Float32Array(Math.min(left.length, right.length))
  const side = new Float32Array(mid.length)
  for (let i = 0; i < mid.length; i++) {
    mid[i] = (left[i] + right[i]) * 0.5
    side[i] = (left[i] - right[i]) * 0.5
  }
  return [mid, side]
}

function fromMidSide(mid: Float32Array, side: Float32Array): Float32Array[] {
  const length = Math.min(mid.length, side.length)
  const left = new Float32Array(length)
  const right = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    left[i] = mid[i] + side[i]
    right[i] = mid[i] - side[i]
  }
  return [left, right]
}

function peakSafe(channels: Float32Array[], ceiling = 0.98): void {
  let peak = 0
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const value = channel[i]
      if (!Number.isFinite(value)) throw new Error('The pitch/time processor produced a non-finite sample.')
      peak = Math.max(peak, Math.abs(value))
    }
  }
  if (peak > ceiling) {
    const gain = ceiling / peak
    for (const channel of channels) {
      for (let i = 0; i < channel.length; i++) channel[i] *= gain
    }
  }
}

worker.onmessage = (event: MessageEvent<PitchTempoRequest>) => {
  const { requestId, channels: transferred, sampleRate, pitchSemitones, tempoPercent, pitchCharacter } = event.data
  try {
    if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
      throw new Error('This audio sample rate is not supported (expected 8–192 kHz).')
    }
    if (!Number.isFinite(pitchSemitones) || Math.abs(pitchSemitones) > 12) {
      throw new Error('Pitch shift must be between −12 and +12 semitones.')
    }
    if (!Number.isFinite(tempoPercent) || tempoPercent < 50 || tempoPercent > 150) {
      throw new Error('Tempo must be between 50% and 150%.')
    }
    const inputs = transferred.map((buffer) => new Float32Array(buffer))
    if (!inputs.length || inputs.some((channel) => channel.length !== inputs[0].length)) {
      throw new Error('The audio channels are empty or have inconsistent lengths.')
    }

    const expectedPitch = inputs[0].length
    const chunkSize = Math.max(16384, Math.min(65536, Math.round(sampleRate)))
    let work: Float32Array[] = inputs.length === 2 ? toMidSide(inputs[0], inputs[1]) : inputs

    if (Math.abs(pitchSemitones) > 0.001) {
      postProgress(requestId, 4, pitchCharacter === 'voice' ? 'Pitch shifting · preserving vocal formants…' : 'Pitch shifting · transient-aware music mode…')
      const processor = (pitchCharacter === 'voice' ? shiftFormant : shiftTransient) as unknown as (options: { semitones: number; sampleRate: number }) => AudioChunkWriter
      const writer = processor({ semitones: pitchSemitones, sampleRate })
      work = collectChannels(work, writer, chunkSize, (fraction) => {
        postProgress(requestId, 4 + Math.round(fraction * 43), 'Pitch shifting…')
      })
      work = resizeToLength(work, expectedPitch)
    }

    const factor = 100 / tempoPercent
    const expectedOutputLength = Math.max(1, Math.round(expectedPitch * factor))
    if (Math.abs(tempoPercent - 100) > 0.001) {
      postProgress(requestId, 49, 'Time stretching · preserving pitch and attacks…')
      const stretched: Float32Array[] = []
      for (let index = 0; index < work.length; index++) {
        // Use the library's batch renderer here. Its streaming wrapper trims
        // short fills at the final analysis frame, which caused duration drift
        // at modest factors; the batch path returns a continuous frame and is
        // still isolated from the UI in this Worker.
        stretched.push(stretchTransient(work[index], { factor }) as Float32Array)
        postProgress(
          requestId,
          49 + Math.round(((index + 1) / work.length) * 45),
          `Time stretching · channel ${index + 1}/${work.length}…`,
        )
      }
      work = resizeToLength(stretched, expectedOutputLength)
    } else {
      work = resizeToLength(work, expectedOutputLength)
    }

    if (inputs.length === 2) work = fromMidSide(work[0], work[1])
    peakSafe(work)
    const outputLength = work[0]?.length ?? 0
    if (!outputLength || work.some((channel) => channel.length !== outputLength)) {
      throw new Error('The rendered channels do not have a matching duration.')
    }
    const transfer = work.map((channel) => channel.buffer as ArrayBuffer)
    worker.postMessage({
      type: 'done',
      requestId,
      channels: transfer,
      duration: outputLength / sampleRate,
      peakCeiling: 0.98,
    }, transfer)
  } catch (error) {
    worker.postMessage({
      type: 'error',
      requestId,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
