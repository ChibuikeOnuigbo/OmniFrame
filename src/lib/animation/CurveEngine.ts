/**
 * OmniFrame Unified Curve & Keyframe Animation Engine
 * Non-negotiable chain:
 * PROPERTY -> CHANNEL -> KEYFRAMES -> SEGMENTS -> INTERPOLATION/CURVE -> EVALUATED VALUE -> RENDER/PREVIEW
 */

import { Clip, ClipTransform } from '../../types'

export type InterpolationType =
  | 'constant'
  | 'linear'
  | 'bezier'
  | 'cubic-in'
  | 'cubic-out'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'back'
  | 'bounce'
  | 'elastic'

export type ExtrapolationMode = 'constant' | 'linear' | 'cycle' | 'ping-pong'

export type TangentHandleMode = 'free' | 'aligned' | 'mirrored' | 'auto'

export interface TangentHandle {
  dt: number // delta time (seconds relative to keyframe node)
  dv: number // delta value relative to keyframe node
}

export interface KeyframeNode {
  id: string
  time: number // in seconds
  value: number
  interpolation: InterpolationType
  handleMode?: TangentHandleMode
  inHandle?: TangentHandle
  outHandle?: TangentHandle
  easingPreset?: string
}

export interface PropertyCurve {
  id: string // e.g. "position_x", "rotation_z", "scale_x", etc.
  property: string
  channel: 'X' | 'Y' | 'Z' | 'Scalar'
  label: string
  color: string
  defaultValue: number
  min?: number
  max?: number
  unit?: string
  keyframes: KeyframeNode[]
  extrapolationBefore: ExtrapolationMode
  extrapolationAfter: ExtrapolationMode
}

export interface ClipAnimation {
  curves: Record<string, PropertyCurve>
}

export interface EvaluatedClipTransform {
  x: number
  y: number
  z: number
  rotationX: number
  rotationY: number
  rotationZ: number
  scaleX: number
  scaleY: number
  scaleZ: number
  opacity: number
  speed: number
  width?: number
  height?: number
}

// UID generator for keyframes
function genKeyId(): string {
  return 'kf_' + Math.random().toString(36).slice(2, 9)
}

/**
 * Solve for parameter s in cubic Bezier where Bx(s) = targetT
 * Using Newton-Raphson with bisection fallback
 */
function solveBezierTime(
  p0x: number,
  p1x: number,
  p2x: number,
  p3x: number,
  targetT: number,
  epsilon = 1e-5,
  maxIterations = 12
): number {
  if (targetT <= p0x) return 0
  if (targetT >= p3x) return 1

  let s = (targetT - p0x) / (p3x - p0x) // Initial guess
  s = Math.max(0, Math.min(1, s))

  // Newton-Raphson iterations
  for (let i = 0; i < maxIterations; i++) {
    const oneMinusS = 1 - s
    // Evaluate Bx(s)
    const currentX =
      oneMinusS * oneMinusS * oneMinusS * p0x +
      3 * oneMinusS * oneMinusS * s * p1x +
      3 * oneMinusS * s * s * p2x +
      s * s * s * p3x

    const diff = currentX - targetT
    if (Math.abs(diff) < epsilon) return s

    // Evaluate derivative dBx/ds
    const derivativeX =
      3 * oneMinusS * oneMinusS * (p1x - p0x) +
      6 * oneMinusS * s * (p2x - p1x) +
      3 * s * s * (p3x - p2x)

    if (Math.abs(derivativeX) < 1e-6) break // Derivative too flat, fallback to bisection

    const nextS = s - diff / derivativeX
    if (nextS < 0 || nextS > 1) break // Overshoot, fallback to bisection
    s = nextS
  }

  // Bisection fallback
  let low = 0
  let high = 1
  for (let i = 0; i < 16; i++) {
    s = (low + high) * 0.5
    const oneMinusS = 1 - s
    const currentX =
      oneMinusS * oneMinusS * oneMinusS * p0x +
      3 * oneMinusS * oneMinusS * s * p1x +
      3 * oneMinusS * s * s * p2x +
      s * s * s * p3x

    if (Math.abs(currentX - targetT) < epsilon) return s
    if (currentX < targetT) {
      low = s
    } else {
      high = s
    }
  }

  return s
}

/**
 * Evaluate 1D cubic Bezier value at parameter s
 */
function evalBezierValue(p0y: number, p1y: number, p2y: number, p3y: number, s: number): number {
  const oneMinusS = 1 - s
  return (
    oneMinusS * oneMinusS * oneMinusS * p0y +
    3 * oneMinusS * oneMinusS * s * p1y +
    3 * oneMinusS * s * s * p2y +
    s * s * s * p3y
  )
}

/**
 * Standard Easing Formulas
 */
export function evaluateEasingProgress(u: number, interpolation: InterpolationType): number {
  const clampedU = Math.max(0, Math.min(1, u))

  switch (interpolation) {
    case 'constant':
      return 0
    case 'linear':
      return clampedU
    case 'cubic-in':
      return clampedU * clampedU * clampedU
    case 'cubic-out': {
      const inv = 1 - clampedU
      return 1 - inv * inv * inv
    }
    case 'ease-in':
      return clampedU * clampedU
    case 'ease-out': {
      const inv = 1 - clampedU
      return 1 - inv * inv
    }
    case 'ease-in-out':
      return clampedU < 0.5
        ? 2 * clampedU * clampedU
        : 1 - Math.pow(-2 * clampedU + 2, 2) / 2
    case 'back': {
      const c1 = 1.70158
      const c3 = c1 + 1
      return c3 * clampedU * clampedU * clampedU - c1 * clampedU * clampedU
    }
    case 'bounce': {
      let n1 = 7.5625
      let d1 = 2.75
      let x = clampedU
      if (x < 1 / d1) {
        return n1 * x * x
      } else if (x < 2 / d1) {
        return n1 * (x -= 1.5 / d1) * x + 0.75
      } else if (x < 2.5 / d1) {
        return n1 * (x -= 2.25 / d1) * x + 0.9375
      } else {
        return n1 * (x -= 2.625 / d1) * x + 0.984375
      }
    }
    case 'elastic': {
      if (clampedU === 0) return 0
      if (clampedU === 1) return 1
      return (
        -Math.pow(2, 10 * clampedU - 10) *
        Math.sin((clampedU * 10 - 10.75) * ((2 * Math.PI) / 3))
      )
    }
    case 'bezier':
    default:
      return clampedU
  }
}

/**
 * Evaluate property curve at arbitrary continuous time (seconds)
 */
export function evaluateCurve(curve: PropertyCurve, time: number): number {
  const keys = curve.keyframes
  if (!keys || keys.length === 0) {
    return curve.defaultValue
  }

  // Single keyframe returns constant value
  if (keys.length === 1) {
    return keys[0].value
  }

  const firstKey = keys[0]
  const lastKey = keys[keys.length - 1]

  // Time before first keyframe -> Extrapolation Before
  if (time <= firstKey.time) {
    switch (curve.extrapolationBefore) {
      case 'linear': {
        const nextKey = keys[1]
        const dt = nextKey.time - firstKey.time
        if (dt > 1e-6) {
          const slope = (nextKey.value - firstKey.value) / dt
          return firstKey.value + slope * (time - firstKey.time)
        }
        return firstKey.value
      }
      case 'cycle': {
        const period = lastKey.time - firstKey.time
        if (period > 1e-6) {
          const modTime = firstKey.time + (((time - firstKey.time) % period) + period) % period
          return evaluateCurve({ ...curve, extrapolationBefore: 'constant', extrapolationAfter: 'constant' }, modTime)
        }
        return firstKey.value
      }
      case 'ping-pong': {
        const period = lastKey.time - firstKey.time
        if (period > 1e-6) {
          let rel = (((time - firstKey.time) % (2 * period)) + 2 * period) % (2 * period)
          if (rel > period) rel = 2 * period - rel
          return evaluateCurve({ ...curve, extrapolationBefore: 'constant', extrapolationAfter: 'constant' }, firstKey.time + rel)
        }
        return firstKey.value
      }
      case 'constant':
      default:
        return firstKey.value
    }
  }

  // Time after last keyframe -> Extrapolation After
  if (time >= lastKey.time) {
    switch (curve.extrapolationAfter) {
      case 'linear': {
        const prevKey = keys[keys.length - 2]
        const dt = lastKey.time - prevKey.time
        if (dt > 1e-6) {
          const slope = (lastKey.value - prevKey.value) / dt
          return lastKey.value + slope * (time - lastKey.time)
        }
        return lastKey.value
      }
      case 'cycle': {
        const period = lastKey.time - firstKey.time
        if (period > 1e-6) {
          const modTime = firstKey.time + (((time - firstKey.time) % period) + period) % period
          return evaluateCurve({ ...curve, extrapolationBefore: 'constant', extrapolationAfter: 'constant' }, modTime)
        }
        return lastKey.value
      }
      case 'ping-pong': {
        const period = lastKey.time - firstKey.time
        if (period > 1e-6) {
          let rel = (((time - firstKey.time) % (2 * period)) + 2 * period) % (2 * period)
          if (rel > period) rel = 2 * period - rel
          return evaluateCurve({ ...curve, extrapolationBefore: 'constant', extrapolationAfter: 'constant' }, firstKey.time + rel)
        }
        return lastKey.value
      }
      case 'constant':
      default:
        return lastKey.value
    }
  }

  // Locate the segment containing time: keys[i] <= time <= keys[i+1]
  let idx = 0
  for (let i = 0; i < keys.length - 1; i++) {
    if (time >= keys[i].time && time <= keys[i + 1].time) {
      idx = i
      break
    }
  }

  const k0 = keys[idx]
  const k1 = keys[idx + 1]
  const dt = k1.time - k0.time
  if (dt <= 1e-6) return k0.value

  const u = (time - k0.time) / dt

  // Constant step interpolation
  if (k0.interpolation === 'constant') {
    return k0.value
  }

  // Linear interpolation
  if (k0.interpolation === 'linear') {
    return k0.value + u * (k1.value - k0.value)
  }

  // Custom 1D cubic Bezier with explicit tangent handles
  if (k0.interpolation === 'bezier') {
    const p0x = k0.time
    const p0y = k0.value
    const p3x = k1.time
    const p3y = k1.value

    // Tangent control points (default to 1/3 segment distance if not defined)
    const outHandle = k0.outHandle || { dt: dt / 3, dv: 0 }
    const inHandle = k1.inHandle || { dt: -dt / 3, dv: 0 }

    const p1x = p0x + Math.max(0, outHandle.dt)
    const p1y = p0y + outHandle.dv
    const p2x = p3x + Math.min(0, inHandle.dt)
    const p2y = p3y + inHandle.dv

    const s = solveBezierTime(p0x, p1x, p2x, p3x, time)
    return evalBezierValue(p0y, p1y, p2y, p3y, s)
  }

  // Standard easing presets (cubic-in, cubic-out, ease-in, ease-out, back, bounce, etc.)
  const progress = evaluateEasingProgress(u, k0.interpolation)
  return k0.value + progress * (k1.value - k0.value)
}

/**
 * Evaluate rate of change (derivative) dv/dt for the Speed Graph
 */
export function evaluateCurveDerivative(curve: PropertyCurve, time: number, epsilon = 0.005): number {
  const v1 = evaluateCurve(curve, time - epsilon)
  const v2 = evaluateCurve(curve, time + epsilon)
  return (v2 - v1) / (2 * epsilon)
}

/**
 * Add or update keyframe on a curve
 */
export function addOrUpdateKeyframe(
  curve: PropertyCurve,
  time: number,
  value: number,
  interpolation: InterpolationType = 'bezier'
): { curve: PropertyCurve; keyframe: KeyframeNode } {
  const keys = [...curve.keyframes]
  const existingIdx = keys.findIndex((k) => Math.abs(k.time - time) < 0.03)

  let node: KeyframeNode

  if (existingIdx >= 0) {
    node = {
      ...keys[existingIdx],
      time,
      value,
      interpolation: keys[existingIdx].interpolation || interpolation,
    }
    keys[existingIdx] = node
  } else {
    node = {
      id: genKeyId(),
      time,
      value,
      interpolation,
      handleMode: 'aligned',
      inHandle: { dt: -0.2, dv: 0 },
      outHandle: { dt: 0.2, dv: 0 },
    }
    keys.push(node)
    keys.sort((a, b) => a.time - b.time)
  }

  return {
    curve: { ...curve, keyframes: keys },
    keyframe: node,
  }
}

/**
 * Remove keyframe by ID
 */
export function removeKeyframe(curve: PropertyCurve, keyframeId: string): PropertyCurve {
  return {
    ...curve,
    keyframes: curve.keyframes.filter((k) => k.id !== keyframeId),
  }
}

/**
 * Apply easing preset to a keyframe
 */
export function applyEasingPreset(
  curve: PropertyCurve,
  keyframeId: string,
  preset: InterpolationType
): PropertyCurve {
  return {
    ...curve,
    keyframes: curve.keyframes.map((k) => {
      if (k.id !== keyframeId) return k
      return {
        ...k,
        interpolation: preset,
        easingPreset: preset,
      }
    }),
  }
}

/**
 * Create standard animatable property curves for a clip
 */
export function createDefaultClipAnimation(
  initial: ClipTransform,
  duration: number
): ClipAnimation {
  const makeCurve = (
    id: string,
    property: string,
    channel: 'X' | 'Y' | 'Z' | 'Scalar',
    label: string,
    color: string,
    defaultValue: number,
    unit: string,
    min?: number,
    max?: number
  ): PropertyCurve => ({
    id,
    property,
    channel,
    label,
    color,
    defaultValue,
    unit,
    min,
    max,
    keyframes: [],
    extrapolationBefore: 'constant',
    extrapolationAfter: 'constant',
  })

  return {
    curves: {
      position_x: makeCurve('position_x', 'position', 'X', 'Position X', '#ef4444', initial.x, 'px'),
      position_y: makeCurve('position_y', 'position', 'Y', 'Position Y', '#22c55e', initial.y, 'px'),
      position_z: makeCurve('position_z', 'position', 'Z', 'Position Z', '#3b82f6', 0, 'px'),
      rotation_x: makeCurve('rotation_x', 'rotation', 'X', 'Rotation X', '#f87171', 0, '°', -180, 180),
      rotation_y: makeCurve('rotation_y', 'rotation', 'Y', 'Rotation Y', '#4ade80', 0, '°', -180, 180),
      rotation_z: makeCurve('rotation_z', 'rotation', 'Z', 'Rotation Z', '#06b6d4', initial.rotation, '°', -180, 180),
      scale_x: makeCurve('scale_x', 'scale', 'X', 'Scale X', '#f59e0b', initial.scale, '%', 0.01, 10),
      scale_y: makeCurve('scale_y', 'scale', 'Y', 'Scale Y', '#a855f7', initial.scale, '%', 0.01, 10),
      scale_z: makeCurve('scale_z', 'scale', 'Z', 'Scale Z', '#ec4899', 1.0, '%', 0.01, 10),
      opacity: makeCurve('opacity', 'opacity', 'Scalar', 'Opacity', '#14b8a6', initial.opacity, '%', 0, 1),
      playback_speed: makeCurve('playback_speed', 'speed', 'Scalar', 'Playback Speed', '#eab308', 1.0, 'x', 0.1, 10),
      wheel_rotation: makeCurve('wheel_rotation', 'wheel', 'Z', '3D Wheel Rotation', '#8b5cf6', 0, '°', -3600, 3600),
    },
  }
}

/**
 * Evaluate all clip animation channels at a given timeline time
 */
export function evaluateClipAnimation(clip: Clip, timelineTime: number): EvaluatedClipTransform {
  const base = clip.transform
  const anim = clip.animation

  if (!anim || !anim.curves) {
    return {
      x: base.x,
      y: base.y,
      z: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: base.rotation,
      scaleX: base.scale,
      scaleY: base.scale,
      scaleZ: 1,
      opacity: base.opacity,
      speed: 1.0,
    }
  }

  // Clip-relative time in seconds
  const clipTime = timelineTime - clip.start

  const getVal = (propId: string, fallback: number): number => {
    const c = anim.curves[propId]
    if (!c || c.keyframes.length === 0) return fallback
    return evaluateCurve(c, clipTime)
  }

  return {
    x: getVal('position_x', base.x),
    y: getVal('position_y', base.y),
    z: getVal('position_z', 0),
    rotationX: getVal('rotation_x', 0),
    rotationY: getVal('rotation_y', 0),
    rotationZ: getVal('rotation_z', base.rotation),
    scaleX: getVal('scale_x', base.scale),
    scaleY: getVal('scale_y', base.scale),
    scaleZ: getVal('scale_z', 1.0),
    opacity: getVal('opacity', base.opacity),
    speed: getVal('playback_speed', 1.0),
  }
}
