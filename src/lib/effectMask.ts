import type { ClipAdjustmentMask, ClipEffectMaskRegion } from '../types'

export const DEFAULT_EFFECT_MASK_REGION: ClipEffectMaskRegion = {
  id: 'effect-mask-1',
  shape: 'ellipse',
  centerX: 0.5,
  centerY: 0.5,
  width: 0.35,
  height: 0.35,
  rotation: 0,
  feather: 24,
  opacity: 1,
}

export const DEFAULT_EFFECT_MASK: ClipAdjustmentMask = {
  shape: 'ellipse',
  centerX: 0.5,
  centerY: 0.5,
  width: 0.35,
  height: 0.35,
  feather: 24,
  inverted: false,
  enabled: true,
  regions: [{ ...DEFAULT_EFFECT_MASK_REGION }],
}

export function effectMaskRegions(mask: ClipAdjustmentMask): ClipEffectMaskRegion[] {
  if (mask.enabled === false) return []
  if (mask.regions?.length) return mask.regions
  return [{
    id: 'effect-mask-legacy',
    shape: mask.shape,
    centerX: mask.centerX,
    centerY: mask.centerY,
    width: mask.width,
    height: mask.height,
    rotation: 0,
    feather: mask.feather,
    opacity: 1,
  }]
}

export function nextEffectMaskRegion(
  mask: ClipAdjustmentMask,
  shape: ClipEffectMaskRegion['shape'] = 'ellipse',
): ClipEffectMaskRegion {
  const used = new Set(effectMaskRegions(mask).map((region) => region.id))
  let n = used.size + 1
  while (used.has(`effect-mask-${n}`)) n += 1
  const circle = shape === 'circle'
  return {
    ...DEFAULT_EFFECT_MASK_REGION,
    id: `effect-mask-${n}`,
    shape,
    width: circle ? 0.18 : DEFAULT_EFFECT_MASK_REGION.width,
    height: circle ? 0.18 : DEFAULT_EFFECT_MASK_REGION.height,
    text: shape === 'text' ? 'MASK' : undefined,
    points: shape === 'custom'
      ? [{ x: 0.35, y: 0.35 }, { x: 0.65, y: 0.35 }, { x: 0.65, y: 0.65 }, { x: 0.35, y: 0.65 }]
      : undefined,
  }
}
