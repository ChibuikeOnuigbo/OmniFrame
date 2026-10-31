/** One media-element audio graph for playback, actual meters and repeatable exports.
 * A media element may be wrapped by createMediaElementSource only once. */
let context: AudioContext | null = null
let output: GainNode | null = null
let left: AnalyserNode | null = null, right: AnalyserNode | null = null
const sources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>()
const connected = new Map<HTMLMediaElement, MediaElementAudioSourceNode>()
const leftSamples = new Float32Array(1024), rightSamples = new Float32Array(1024)

function ensureBus(): AudioContext {
  if (!context) {
    context = new AudioContext()
    output = context.createGain()
    output.channelCount = 2; output.channelCountMode = 'explicit'
    output.connect(context.destination)
    const split = context.createChannelSplitter(2)
    left = context.createAnalyser(); right = context.createAnalyser()
    left.fftSize = right.fftSize = 1024
    output.connect(split); split.connect(left, 0); split.connect(right, 1)
  }
  return context
}

export function attachAudioElements(elements: HTMLMediaElement[]): void {
  const ctx = ensureBus(), active = new Set(elements.filter(el => el instanceof HTMLAudioElement || !el.muted))
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  for (const [element, node] of connected) if (!active.has(element)) { node.disconnect(); connected.delete(element) }
  for (const element of active) {
    if (connected.has(element)) continue
    let node = sources.get(element)
    if (!node) { node = ctx.createMediaElementSource(element); sources.set(element, node) }
    node.connect(output!); connected.set(element, node)
  }
}

export function createRecordingAudioStream(): { stream: MediaStream; dispose: () => void } {
  const ctx = ensureBus(), destination = ctx.createMediaStreamDestination()
  output!.connect(destination)
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  return { stream: destination.stream, dispose: () => { output!.disconnect(destination); destination.stream.getTracks().forEach(track => track.stop()) } }
}

function measure(samples: Float32Array): { rms: number; peak: number } {
  let energy = 0, peak = 0
  for (const value of samples) { energy += value * value; peak = Math.max(peak, Math.abs(value)) }
  const db = (amplitude: number) => amplitude > 1e-8 ? 20 * Math.log10(amplitude) : -80
  return { rms: db(Math.sqrt(energy / samples.length)), peak: db(peak) }
}

export function readAudioLevels() {
  if (!left || !right) return { leftDb: -80, rightDb: -80, leftPeakDb: -80, rightPeakDb: -80 }
  left.getFloatTimeDomainData(leftSamples); right.getFloatTimeDomainData(rightSamples)
  const l = measure(leftSamples), r = measure(rightSamples)
  return { leftDb: l.rms, rightDb: r.rms, leftPeakDb: l.peak, rightPeakDb: r.peak }
}
