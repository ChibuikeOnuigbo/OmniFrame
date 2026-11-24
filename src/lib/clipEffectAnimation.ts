import type { Clip, ClipEffect, FxKey } from '../types'

/** Hold outside the keyed interval; interpolate between keys without changing the saved data. */
export function evalFxKeys(keys: FxKey[] | undefined, time: number, fallback: number): number {
  if (!Array.isArray(keys) || !keys.length || !Number.isFinite(time)) return fallback
  const sorted = keys.filter(k => k && Number.isFinite(k.t) && Number.isFinite(k.v)).slice().sort((a, b) => a.t - b.t)
  if (!sorted.length) return fallback
  if (time < sorted[0].t) return sorted[0].v
  let before = sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    const after = sorted[i]
    if (time < after.t) return before.v + (after.v - before.v) * (time - before.t) / (after.t - before.t)
    before = after // At duplicate times the last saved key wins.
  }
  return before.v
}

export function clipEffectTime(clip: Pick<Clip, 'effectSourceOffset'>, localTime: number): number {
  return localTime + (typeof clip.effectSourceOffset === 'number' && Number.isFinite(clip.effectSourceOffset) ? clip.effectSourceOffset : 0)
}

/** Base clip properties have their own clock; dropped effect instances keep their existing clocks. */
export function clipEffectsAt(clip: Pick<Clip, 'effects' | 'effectKeys' | 'effectSourceOffset'>, localTime: number): ClipEffect | undefined {
  if (!clip.effects || !clip.effectKeys || !Object.keys(clip.effectKeys).length) return clip.effects
  const values = { ...clip.effects }
  const time = clipEffectTime(clip, localTime)
  for (const [name, keys] of Object.entries(clip.effectKeys)) {
    if (!Object.prototype.hasOwnProperty.call(values, name)) continue
    const key = name as keyof ClipEffect, base = values[key]
    if (typeof base === 'number') Object.assign(values, { [name]: evalFxKeys(keys, time, base) })
  }
  return values
}

/** Trimming/cutting changes the visible window, not the stored curve or its future keys. */
export function shiftClipEffectClock(clip: Pick<Clip, 'effects' | 'effectKeys' | 'effectSourceOffset'>, delta: number): Pick<Clip, 'effectSourceOffset'> {
  if (!clip.effects && !clip.effectKeys && clip.effectSourceOffset === undefined) return {}
  return { effectSourceOffset: clipEffectTime(clip, delta) }
}

/** Shared import/tool validation, before any document mutation. Negative times support left extension. */
export function validateClipEffectAnimation(effects: unknown, keys: unknown, offset: unknown): void {
  if (offset !== undefined && (typeof offset !== 'number' || !Number.isFinite(offset))) throw new Error('Effect source offset must be finite')
  if (keys === undefined) return
  if (!keys || typeof keys !== 'object' || Array.isArray(keys) || Object.getPrototypeOf(keys) !== Object.prototype) throw new Error('Effect keys must be an object')
  if (!effects || typeof effects !== 'object' || Array.isArray(effects)) throw new Error('Effect keys need numeric effect properties')
  const fields = Object.entries(keys)
  if (fields.length > 512) throw new Error('Too many animated effect properties')
  let count = 0
  for (const [name, list] of fields) {
    if (['__proto__', 'prototype', 'constructor'].includes(name) || !Object.prototype.hasOwnProperty.call(effects, name) || typeof (effects as Record<string, unknown>)[name] !== 'number' || !Number.isFinite((effects as Record<string, number>)[name])) throw new Error('Effect keys need a finite numeric base property')
    if (!Array.isArray(list) || (count += list.length) > 20000) throw new Error('Invalid effect key collection')
    for (const key of list) if (!key || typeof key !== 'object' || Array.isArray(key) || typeof key.t !== 'number' || typeof key.v !== 'number' || !Number.isFinite(key.t) || !Number.isFinite(key.v)) throw new Error('Effect key times and values must be finite')
  }
}
