import { recipeFromEffect, type NgLayer, type NgEffect } from './glitchNG'
import type { Clip, ClipEffect, FxInstance, FxKey } from '../types'

/**
 * Effect instances dropped ONTO a clip (CapCut model): each instance is a
 * closed container inside the parent clip — it can be moved and trimmed but
 * its white edge bars can NEVER be pushed outside the parent. The app
 * re-clamps on every drag step (setFxRange) so a leak is impossible.
 *
 * Rendering: an instance's params (with per-property keyframes evaluated at
 * the instance-local time) merge into the clip's ClipEffect for that frame,
 * so every existing engine path — CSS filters, pixelGrade, proceduralFx,
 * fx layers — works unchanged for instances. Later instances win on
 * overlapping keys (stack order = drop order).
 */

export const FX_MIN_DUR = 0.1

/** Linear interpolation across a property's keyframes; ends clamp. */
export function evalFxKeys(keys: FxKey[] | undefined, t: number, fallback: number): number {
  if (!keys || keys.length === 0) return fallback
  const sorted = [...keys].sort((a, b) => a.t - b.t)
  if (t <= sorted[0].t) return sorted[0].v
  if (t >= sorted[sorted.length - 1].t) return sorted[sorted.length - 1].v
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t
      if (span <= 0) return b.v
      const k = (t - a.t) / span
      return a.v + (b.v - a.v) * k
    }
  }
  return fallback
}

/** Seconds from the parent clip's start. */
export function fxLocalTime(clip: Clip, time: number): number {
  return time - clip.start
}

/** True when the instance covers this clip-local time. */
export function fxActiveAt(inst: FxInstance, localT: number): boolean {
  return inst.enabled && localT >= inst.inP && localT < inst.inP + inst.duration
}

/** Resolve one instance's params at instance-local time (keyframes applied). */
export function fxParamsAt(inst: FxInstance, localT: number): Record<string, number | string> {
  const t = localT - inst.inP
  const out: Record<string, number | string> = { ...inst.params }
  if (inst.keys) {
    for (const [param, keys] of Object.entries(inst.keys)) {
      const base = out[param]
      if (typeof base === 'number') out[param] = evalFxKeys(keys, t, base)
    }
  }
  return out
}

/**
 * Merge the clip's own effects with every active instance at this time.
 * Returns undefined when there is nothing at all (keeps fast paths fast).
 */
export function mergeFxInstances(clip: Clip, localT: number): ClipEffect | undefined {
  const insts = clip.fxInstances
  if ((!insts || insts.length === 0) && !clip.effects?.ngFamily) return clip.effects
  let merged: ClipEffect | undefined = clip.effects ? { ...clip.effects } : undefined
  const layers: NgLayer[] = []
  const addNg = (e: NgEffect | undefined, id: string, offset: number) => {
    if (!e?.ngFamily) return
    const r = recipeFromEffect(e)
    layers.push({ id, family: e.ngFamily, seed: r.seed, palette: r.palette, timeline: r.timeline, parameters: r.parameters, timeOffset: offset, opacity: e.ngOpacity, blendMode: e.ngBlend })
  }
  addNg(clip.effects as NgEffect | undefined, 'clip', clip.start)
  for (const inst of insts || []) {
    if (!fxActiveAt(inst, localT)) continue
    const params = fxParamsAt(inst, localT) as unknown as ClipEffect
    addNg(params as NgEffect, inst.id, clip.start + inst.inP - (inst.sourceOffset ?? 0))
    merged = { ...(merged || {}), ...params }
  }
  if (merged && layers.length) (merged as ClipEffect & NgEffect).ngLayersJSON = JSON.stringify(layers)
  return merged
}

/** Clamp an instance inside its parent clip: the container is closed. */
export function clampFxToClip(inP: number, duration: number, clipDuration: number): { inP: number; duration: number } {
  const maxDur = Math.max(FX_MIN_DUR, clipDuration)
  let d = Math.max(FX_MIN_DUR, Math.min(duration, maxDur))
  if (d > clipDuration) d = Math.max(FX_MIN_DUR, clipDuration)
  let s = Math.max(0, Math.min(inP, Math.max(0, clipDuration - d)))
  if (s + d > clipDuration) {
    d = Math.max(FX_MIN_DUR, clipDuration - s)
    if (s + d > clipDuration) {
      s = Math.max(0, clipDuration - d)
    }
  }
  return { inP: s, duration: d }
}

/**
 * Split mapping: when the parent clip is cut at `offset` seconds, instances
 * are cut too — the left half keeps the covered head, the right half the
 * covered tail (re-based). Pieces shorter than FX_MIN_DUR are dropped.
 */
export function splitFxInstances(insts: FxInstance[] | undefined, offset: number): { left: FxInstance[]; right: FxInstance[] } {
  const left: FxInstance[] = []
  const right: FxInstance[] = []
  for (const inst of insts || []) {
    const end = inst.inP + inst.duration
    if (inst.inP < offset && offset < end) {
      const lDur = offset - inst.inP
      const rDur = end - offset
      if (lDur >= FX_MIN_DUR) left.push({ ...inst, duration: lDur, keys: inst.keys ? splitFxKeys(inst.keys,lDur).left : undefined })
      if (rDur >= FX_MIN_DUR) {
        right.push({
          ...inst,
          id: `${inst.id}r${Math.random().toString(36).slice(2, 7)}`,
          inP: 0,
          duration: rDur,
          sourceOffset: (inst.sourceOffset ?? 0) + lDur,
          keys: inst.keys ? splitFxKeys(inst.keys, lDur).right : undefined,
        })
      }
    } else if (end <= offset) {
      if (inst.duration >= FX_MIN_DUR) left.push({ ...inst })
    } else {
      // entirely right of the cut — re-base
      right.push({
        ...inst,
        id: `${inst.id}r${Math.random().toString(36).slice(2, 7)}`,
        inP: inst.inP - offset,
        keys: inst.keys ? shiftFxKeys(inst.keys, 0) : undefined,
      })
    }
  }
  return { left, right }
}

function shiftFxKeys(keys: Record<string, FxKey[]>, dt: number): Record<string, FxKey[]> {
  if (dt === 0) return { ...keys }
  const out: Record<string, FxKey[]> = {}
  for (const [p, ks] of Object.entries(keys)) out[p] = ks.map((k) => ({ ...k, t: Math.max(0, k.t - dt) }))
  return out
}

function splitFxKeys(keys: Record<string, FxKey[]>, cut: number) {
  const left: Record<string,FxKey[]>={}, right: Record<string,FxKey[]>={}
  for(const [name,values] of Object.entries(keys)) {
    if(!values.length) { left[name]=[]; right[name]=[]; continue }
    const sorted=[...values].sort((a,b)=>a.t-b.t), boundary=evalFxKeys(sorted,cut,sorted[0].v)
    left[name]=[...sorted.filter(k=>k.t<cut).map(k=>({...k})),{t:cut,v:boundary}]
    right[name]=[{t:0,v:boundary},...sorted.filter(k=>k.t>cut).map(k=>({...k,t:k.t-cut}))]
  }
  return {left,right}
}
