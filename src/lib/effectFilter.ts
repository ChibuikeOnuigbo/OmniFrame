import type { ClipEffect } from '../types'

/** Shared canvas filters for program rendering and photographic catalog previews. */
export function effectFilterString(effect?: ClipEffect): string {
  if (!effect) return ''
  const filters: string[] = []
  if (typeof effect.brightness === 'number' && effect.brightness !== 1) filters.push(`brightness(${effect.brightness})`)
  if (typeof effect.contrast === 'number' && effect.contrast !== 1) filters.push(`contrast(${effect.contrast})`)
  if (typeof effect.saturation === 'number' && effect.saturation !== 1) filters.push(`saturate(${effect.saturation})`)
  if (typeof effect.blur === 'number' && effect.blur > 0) filters.push(`blur(${effect.blur}px)`)
  if (typeof effect.grayscale === 'number' && effect.grayscale > 0) filters.push(`grayscale(${effect.grayscale})`)
  if (typeof effect.invert === 'number' && effect.invert > 0) filters.push(`invert(${effect.invert})`)
  if (typeof effect.sepia === 'number' && effect.sepia > 0) filters.push(`sepia(${effect.sepia})`)
  if (typeof effect.hueRotate === 'number' && effect.hueRotate > 0) filters.push(`hue-rotate(${effect.hueRotate}deg)`)
  return filters.join(' ')
}

