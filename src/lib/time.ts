// Time + timecode helpers. FPS is read from project settings so the
// timeline and timecode stay consistent.

export function fps(): number {
  // Single source of truth for the working framerate used by the UI.
  return 30
}

export function formatTimecode(seconds: number, frameRate = fps()): string {
  const s = Math.max(0, seconds)
  const totalFrames = Math.round(s * frameRate)
  const f = totalFrames % frameRate
  const totalSeconds = Math.floor(totalFrames / frameRate)
  const sec = totalSeconds % 60
  const min = Math.floor(totalSeconds / 60) % 60
  const hr = Math.floor(totalSeconds / 3600)
  const pad = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${pad(hr)}:${pad(min)}:${pad(sec)}:${pad(f)}`
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, seconds)
  const min = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.floor((s - Math.floor(s)) * 100)
  const pad = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${pad(min)}:${pad(sec)}.${pad(ms)}`
}

// Pick a "nice" ruler tick interval (seconds) so labels are ~>= minPx apart.
const NICE_INTERVALS = [
  1 / 120, 1 / 60, 1 / 30, 1 / 15, 1 / 10, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600,
]

export function chooseTickInterval(pxPerSec: number, minPx = 64): number {
  for (const interval of NICE_INTERVALS) {
    if (interval * pxPerSec >= minPx) return interval
  }
  return NICE_INTERVALS[NICE_INTERVALS.length - 1]
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
