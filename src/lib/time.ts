// Time + timecode helpers. FPS is read from project settings so the
// timeline and timecode stay consistent.

export function fps(): number {
  // Single source of truth for the working framerate used by the UI.
  return 30
}

export function formatTimecode(seconds: number, frameRate = fps(), dropFrame = false): string {
  const s = Math.max(0, seconds)
  const nominalFps = Math.max(1, Math.round(frameRate))
  let totalFrames = Math.round(s * frameRate)
  const supportsDropFrame = frameRate === 29.97 || frameRate === 59.94
  if (dropFrame && supportsDropFrame) {
    const droppedPerMinute = nominalFps === 60 ? 4 : 2
    const framesPerTenMinutes = Math.round(frameRate * 600)
    const framesPerMinute = Math.round(frameRate * 60)
    const tenMinuteBlocks = Math.floor(totalFrames / framesPerTenMinutes)
    const remainder = totalFrames % framesPerTenMinutes
    const extraMinutes = Math.max(0, Math.floor((remainder - droppedPerMinute) / framesPerMinute))
    totalFrames += droppedPerMinute * (tenMinuteBlocks * 9 + extraMinutes)
  }
  const f = totalFrames % nominalFps
  const totalSeconds = Math.floor(totalFrames / nominalFps)
  const sec = totalSeconds % 60
  const min = Math.floor(totalSeconds / 60) % 60
  const hr = Math.floor(totalSeconds / 3600)
  const pad = (n: number, l = 2) => String(n).padStart(l, '0')
  const frameSeparator = dropFrame && supportsDropFrame ? ';' : ':'
  return `${pad(hr)}:${pad(min)}:${pad(sec)}${frameSeparator}${pad(f)}`
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, seconds)
  const min = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.floor((s - Math.floor(s)) * 100)
  const pad = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${pad(min)}:${pad(sec)}.${pad(ms)}`
}

// Pick the finest collision-safe interval from a 1/2/5 ladder plus exact
// project-frame intervals. The ruler is a view of time, never a unit mode.
export function chooseTickInterval(pxPerSec: number, minPx = 72, frameRate = fps()): number {
  const frame = 1 / Math.max(1, frameRate)
  const candidates = [
    frame, frame * 2, frame * 5, frame * 10,
    0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 30,
    60, 120, 300, 600, 1200, 1800, 3600,
  ].filter((value, index, values) => value > 0 && values.indexOf(value) === index).sort((a, b) => a - b)
  return candidates.find((interval) => interval * pxPerSec >= minPx) ?? candidates[candidates.length - 1]
}

export function formatRulerLabel(seconds: number, interval: number, frameRate = fps(), dropFrame = false): string {
  if (!Number.isFinite(seconds)) return '00:00'
  if (interval < 1) return formatTimecode(seconds, frameRate, dropFrame)
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor(total / 60) % 60
  const secs = total % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(secs)}` : `${pad(Math.floor(total / 60))}:${pad(secs)}`
}

export function snap(value: number, increment: number): number {
  return Math.round(value / increment) * increment
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`
}
