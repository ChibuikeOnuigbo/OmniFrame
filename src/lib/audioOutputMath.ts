/** Shared PCM safeguards. All gains are linked across channels to preserve stereo. */
export function denoiseExponent(strength: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(strength) ? strength : .92))
}

export function enforceAudioPeak(channels: Float32Array[], ceiling = .98): number {
  let peak = 0
  for (const channel of channels) for (let i = 0; i < channel.length; i++) {
    if (!Number.isFinite(channel[i])) channel[i] = 0
    peak = Math.max(peak, Math.abs(channel[i]))
  }
  const gain = peak > ceiling ? ceiling / peak : 1
  if (gain < 1) for (const channel of channels) for (let i = 0; i < channel.length; i++) channel[i] *= gain
  return gain
}

/** Stereo-linked DC blocking and RMS normalization at the actual sample rate.
 * Near-silence is never boosted; a peak guard runs even at unity RMS gain. */
export function normalizeIsolationPCM(channels: Float32Array[], sampleRate: number): number {
  if (!(sampleRate > 0) || !Number.isFinite(sampleRate)) throw new Error('Invalid sample rate')
  const pole = Math.exp(-2 * Math.PI * 15 / sampleRate)
  let energy = 0, count = 0
  for (const ch of channels) {
    let previousInput = 0, previousOutput = 0
    for (let i = 0; i < ch.length; i++) {
      const input = Number.isFinite(ch[i]) ? ch[i] : 0
      const output = input - previousInput + pole * previousOutput
      previousInput = input; previousOutput = output; ch[i] = output
      energy += ch[i] * ch[i]; count++
    }
  }
  const rms = Math.sqrt(energy / Math.max(1, count))
  let gain = rms < 10 ** (-50 / 20) ? 1 : Math.max(10 ** (-6 / 20), Math.min(10 ** (12 / 20), 10 ** (-18 / 20) / rms))
  let peak = 0
  for (const ch of channels) for (const value of ch) peak = Math.max(peak, Math.abs(value))
  if (peak * gain > .98) gain = .98 / peak
  // Skip imperceptible normalization, but never skip required peak protection.
  if (gain > .98 && gain < 1.02 && peak <= .98) gain = 1
  if (gain !== 1) for (const ch of channels) for (let i = 0; i < ch.length; i++) ch[i] *= gain
  return gain
}
