import type { Clip, ClipEffect, Sequence } from '../types'

/** Non-default effect keys present on a clip. */
export function activeEffectKeys(effects?: ClipEffect): string[] {
  if (!effects) return []
  const keys: string[] = []
  if (typeof effects.brightness === 'number' && effects.brightness !== 1) keys.push('brightness')
  if (typeof effects.contrast === 'number' && effects.contrast !== 1) keys.push('contrast')
  if (typeof effects.saturation === 'number' && effects.saturation !== 1) keys.push('saturation')
  if (typeof effects.blur === 'number' && effects.blur > 0) keys.push('blur')
  if (typeof effects.grayscale === 'number' && effects.grayscale > 0) keys.push('grayscale')
  if (typeof effects.invert === 'number' && effects.invert > 0) keys.push('invert')
  if (typeof effects.sepia === 'number' && effects.sepia > 0) keys.push('sepia')
  if (typeof effects.hueRotate === 'number' && effects.hueRotate > 0) keys.push('hue-rotate')
  if (typeof effects.lightIntensity === 'number' && effects.lightIntensity > 0) keys.push('light')
  if (typeof effects.vibrance === 'number' && effects.vibrance !== 1) keys.push('vibrance')
  if (typeof effects.solarize === 'number' && effects.solarize > 0) keys.push('solarize')
  if (typeof effects.posterize === 'number' && effects.posterize > 0) keys.push('posterize')
  if (typeof effects.grain === 'number' && effects.grain > 0) keys.push('grain')
  if (typeof effects.pixelate === 'number' && effects.pixelate > 0) keys.push('pixelate')
  return keys
}

const EFFECT_LABEL: Record<string, string> = {
  brightness: 'Brightness',
  contrast: 'Contrast',
  saturation: 'Saturation',
  blur: 'Blur',
  grayscale: 'Grayscale',
  invert: 'Invert',
  sepia: 'Sepia',
  hueRotate: 'Hue Rotate',
  vibrance: 'Vibrance',
  solarize: 'Solarize',
  posterize: 'Posterize',
  grain: 'Grain',
  pixelate: 'Pixelate',
  light: 'Light',
}

/**
 * Human labels for every effect/LUT placed on a clip: its own filter
 * effects, its LUT stack, and (for compounds) nested adjustment layers.
 */
export function placedEffectLabels(clip: Clip, sequences: Sequence[] = []): string[] {
  const labels: string[] = []
  for (const key of activeEffectKeys(clip.effects)) labels.push(EFFECT_LABEL[key] || key)
  for (const lut of clip.adjustment?.luts || []) {
    if (lut.enabled) labels.push(lut.name)
  }
  if (clip.adjustmentMask) labels.push(`${clip.adjustmentMask.shape} mask`)
  if (clip.kind === 'compound') {
    const seq = sequences.find((s) => s.id === clip.sourceSequenceId)
    const children = seq ? seq.clips : clip.originalChildClips || []
    for (const child of children) {
      if (child.kind !== 'adjustment') continue
      const inner = [
        ...activeEffectKeys(child.effects).map((k) => EFFECT_LABEL[k] || k),
        ...(child.adjustment?.luts || []).filter((l) => l.enabled).map((l) => l.name),
        ...(child.adjustmentMask ? [`${child.adjustmentMask.shape} mask`] : []),
      ]
      if (inner.length) labels.push(`Adj: ${inner.join(' + ')}`)
    }
  }
  return labels
}

/** True when a clip carries any placed effect / LUT (incl. nested layers). */
export function hasPlacedEffects(clip: Clip, sequences: Sequence[] = []): boolean {
  return placedEffectLabels(clip, sequences).length > 0
}
