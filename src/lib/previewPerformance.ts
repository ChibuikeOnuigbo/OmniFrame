/** Preview resolution never enlarges source compositions. Export uses full size. */
export function previewDimensions(width: number, height: number, quality: string) {
  const cap = quality === 'low' ? 426 : quality === 'medium' ? 854 : quality === 'high' ? 1440 : Infinity
  const scale = Math.min(1, cap / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** A paused preview still polls for asynchronously decoded media at 4 Hz. */
export function shouldRenderPreview(elapsed: number, playing: boolean, changed: boolean, fps: number) {
  return changed || elapsed >= (playing ? 1000 / fps : 250)
}
