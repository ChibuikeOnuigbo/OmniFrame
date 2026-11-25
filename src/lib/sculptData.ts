import type { SculptDab } from '../types'
export const MAX_SCULPT_DABS = 256
export function validateSculptDabs(value: unknown): asserts value is SculptDab[] | undefined {
  if (value === undefined) return
  if (!Array.isArray(value) || value.length > MAX_SCULPT_DABS) throw new Error('Sculpt strokes exceed the supported limit')
  for (const dab of value) {
    if (!dab || !['raise', 'carve', 'flatten'].includes(dab.mode)) throw new Error('Invalid sculpt brush')
    for (const key of ['point', 'normal']) {
      if (!dab[key] || !['x', 'y', 'z'].every(axis => typeof dab[key][axis] === 'number' && Number.isFinite(dab[key][axis]) && Math.abs(dab[key][axis]) <= 20)) throw new Error('Invalid sculpt coordinates')
    }
    const length = Math.hypot(dab.normal.x, dab.normal.y, dab.normal.z)
    if (Math.abs(length - 1) > .001 || !Number.isFinite(dab.radius) || dab.radius < .02 || dab.radius > 2 || !Number.isFinite(dab.strength) || dab.strength < 0 || dab.strength > 1) throw new Error('Invalid sculpt brush settings')
  }
}
