/** A 30 fps recorder does not need a full render on every display refresh. */
export function nextExportFrameTime(now: number, previous: number): number | null {
  if (!Number.isFinite(previous)) return now
  const interval = 1000 / 30
  const elapsed = now - previous
  // Small scheduling jitter must not accidentally halve the capture rate.
  if (elapsed + 0.5 < interval) return null
  // Skip missed slots rather than rendering a burst to catch up after a stall.
  return previous + Math.floor((elapsed + 0.5) / interval) * interval
}
