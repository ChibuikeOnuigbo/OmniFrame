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
  | 'bounce-param'
  | 'bounce-uniform'
  | 'rebound-in'
  | 'rebound-out'
  | 'physical'
  | 'sine-in' | 'sine-out' | 'sine-in-out' | 'quad-in' | 'quad-out' | 'quad-in-out'
  | 'cubic-in-out' | 'quart-in' | 'quart-out' | 'quart-in-out' | 'quint-in' | 'quint-out' | 'quint-in-out'
  | 'expo-in' | 'expo-out' | 'expo-in-out' | 'circ-in' | 'circ-out' | 'circ-in-out'
  | 'back-in' | 'back-out' | 'back-in-out' | 'elastic-in' | 'elastic-out' | 'elastic-in-out'
  | 'bounce-in' | 'bounce-out' | 'bounce-in-out' | 'smoothstep' | 'smootherstep' | 'hold'
  | 'spring-soft' | 'spring-wild' | 'anticipate-settle'
  | 'custom'

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
  /** user-dragged custom curve: normalized [0..1]x[0..1] points, monotone in x */
  points?: { x: number; y: number }[]
  interpolation: InterpolationType
  handleMode?: TangentHandleMode
  inHandle?: TangentHandle
  outHandle?: TangentHandle
  easingPreset?: string
  /** Jitter-style easing intensity: 1 = preset as-is, 0 = linear, up to 1.5 = exaggerated (default 1) */
  easingIntensity?: number
  /** Params for the parametric families (Board T): bounce-param / bounce-uniform
   *  (steps, bounciness, firstBounce — uploaded Easing-Curve popup ref),
   *  rebound-in/out (overshoot), physical (freq, damping). */
  easeParams?: { steps?: number; bounciness?: number; firstBounce?: number; overshoot?: number; freq?: number; damping?: number }
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
  pivotX: number
  pivotY: number
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
 * Progress through a user-dragged custom curve: piecewise-linear through the
 * normalized points (x monotone). This is exactly what dragging handles in the
 * curve editor produces — no preset easing involved.
 */
export function customProgress(points: { x: number; y: number }[], u: number): number {
  const pts = [...points].sort((a, b) => a.x - b.x)
  const cu = Math.max(0, Math.min(1, u))
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    if (cu >= a.x && cu <= b.x) {
      const span = b.x - a.x
      const t = span <= 1e-6 ? 0 : (cu - a.x) / span
      return a.y + t * (b.y - a.y)
    }
  }
  return cu <= pts[0].x ? pts[0].y : pts[pts.length - 1].y
}

/**
 * Standard Easing Formulas
 */
/** Canonical value-curves ported from the Engine Repair Pack tools/curves.py
 * (deterministic, endpoints pinned): full Penner family + normalized
 * underdamped-spring rebounds + equal-contact decaying bounce + springs.
 * bounce-param maps the uploaded Easing-Curve popup params
 * (steps->cycles, bounciness->decay, firstBounce->amplitude). */
function springRaw(u: number, damping = 6, frequency = 11): number {
  return 1 - Math.exp(-damping * u) * (Math.cos(frequency * u) + (damping / frequency) * Math.sin(frequency * u))
}
function normSpring(u: number, damping = 6, frequency = 11): number {
  const d = springRaw(1, damping, frequency)
  return d === 0 ? u : springRaw(u, damping, frequency) / d
}
function bounceOutEqual(t: number, contact = 0.52, cycles = 3, amplitude = 0.24, decay = 0.5): number {
  if (t <= contact) return 1 - (1 - t / contact) ** 2
  const interval = (1 - contact) / cycles
  const i = Math.min(cycles - 1, Math.floor((t - contact) / interval))
  const u = (t - contact - i * interval) / interval
  return 1 - amplitude * decay ** i * Math.sin(Math.PI * u) ** 2
}
function elasticOut(t: number): number {
  if (t === 0 || t === 1) return t
  return 2 ** (-10 * t) * Math.sin((10 * t - 0.75) * ((2 * Math.PI) / 3)) + 1
}
function backIn(t: number): number {
  const c = 1.70158
  return (c + 1) * t * t * t - c * t * t
}
export function evaluateEasingProgress(u: number, interpolation: InterpolationType, ep?: KeyframeNode['easeParams']): number {
  const t = Math.max(0, Math.min(1, u))
  if (t === 0) return 0
  if (t === 1) return 1
  const cycles = Math.max(1, Math.round(ep?.steps ?? 3))
  const decay = Math.max(0.05, Math.min(0.98, ep?.bounciness ?? 0.5))
  const amp = Math.max(0.02, Math.min(0.9, ep?.firstBounce ?? 0.24))
  const ov = Math.max(0.01, Math.min(0.9, ep?.overshoot ?? 0.15))
  const damp = ep?.damping ?? 5.5
  const freq = ep?.freq ?? 11
  const bo = (x: number) => bounceOutEqual(x, 0.52, cycles, amp, decay)
  switch (interpolation) {
    case 'constant': return 0
    case 'linear': return t
    case 'smoothstep': return t * t * (3 - 2 * t)
    case 'smootherstep': return t * t * t * (t * (t * 6 - 15) + 10)
    case 'hold': return 0
    case 'sine-in': return 1 - Math.cos((t * Math.PI) / 2)
    case 'sine-out': return Math.sin((t * Math.PI) / 2)
    case 'sine-in-out': return (1 - Math.cos(Math.PI * t)) / 2
    case 'ease-in': case 'quad-in': return t * t
    case 'ease-out': case 'quad-out': return 1 - (1 - t) ** 2
    case 'ease-in-out': case 'quad-in-out': return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
    case 'cubic-in': return t ** 3
    case 'cubic-out': return 1 - (1 - t) ** 3
    case 'cubic-in-out': return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
    case 'quart-in': return t ** 4
    case 'quart-out': return 1 - (1 - t) ** 4
    case 'quart-in-out': return t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2
    case 'quint-in': return t ** 5
    case 'quint-out': return 1 - (1 - t) ** 5
    case 'quint-in-out': return t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2
    case 'expo-in': return 2 ** (10 * (t - 1))
    case 'expo-out': return 1 - 2 ** (-10 * t)
    case 'expo-in-out': return t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2
    case 'circ-in': return 1 - Math.sqrt(1 - t * t)
    case 'circ-out': return Math.sqrt(1 - (t - 1) ** 2)
    case 'circ-in-out': return t < 0.5 ? (1 - Math.sqrt(1 - (2 * t) ** 2)) / 2 : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2
    case 'back': case 'back-in': return backIn(t)
    case 'back-out': return 1 - backIn(1 - t)
    case 'back-in-out': {
      const c = 1.70158 * 1.525
      return t < 0.5
        ? ((2 * t) ** 2 * ((c + 1) * 2 * t - c)) / 2
        : ((2 * t - 2) ** 2 * ((c + 1) * (2 * t - 2) + c) + 2) / 2
    }
    case 'elastic': case 'elastic-out': return elasticOut(t)
    case 'elastic-in': return 1 - elasticOut(1 - t)
    case 'elastic-in-out': return t < 0.5 ? (1 - elasticOut(1 - 2 * t)) / 2 : (1 + elasticOut(2 * t - 1)) / 2
    case 'bounce': case 'bounce-out': case 'bounce-param': return bo(t)
    case 'bounce-in': return 1 - bo(1 - t)
    case 'bounce-in-out': return t < 0.5 ? (1 - bo(1 - 2 * t)) / 2 : (1 + bo(2 * t - 1)) / 2
    case 'bounce-uniform': return bounceOutEqual(t, 0.52, cycles, amp, decay)
    case 'rebound-out': return normSpring(t, damp, freq)
    case 'rebound-in': {
      // Anticipation dip BELOW 0, then steep launch that overshoots past 1
      // and regresses with damped up-down corrections (uploaded refs: both
      // rebounds move more than intended, then correct themselves).
      if (t < 0.38) { const x = t / 0.38; return -ov * (x * x * (3 - 2 * x)) }
      return -ov + (1 + ov) * normSpring((t - 0.38) / 0.62, damp, freq)
    }
    case 'physical': case 'spring-soft': return normSpring(t, ep?.damping ?? 9, ep?.freq ?? 10)
    case 'spring-wild': return normSpring(t, 3.5, 16)
    case 'anticipate-settle': {
      if (t < 0.38) { const x = t / 0.38; return -0.15 * (x * x * (3 - 2 * x)) }
      return -0.15 + 1.15 * normSpring((t - 0.38) / 0.62, 6, 10)
    }
    case 'bezier':
    default:
      return t
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

  // Custom curve: points the user dragged in the curve editor (polyline progress)
  if (k0.interpolation === 'custom' && k0.points && k0.points.length >= 2) {
    return k0.value + customProgress(k0.points, u) * (k1.value - k0.value)
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
  // Easing intensity (Jitter-style): blend the eased progress toward/away from linear.
  const rawProgress = evaluateEasingProgress(u, k0.interpolation)
  const intensity = Math.min(1.5, Math.max(0, k0.easingIntensity ?? 1))
  const progress = u + (rawProgress - u) * intensity
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
      pivot_x: makeCurve('pivot_x', 'pivot', 'X', 'Pivot X', '#f472b6', initial.pivotX ?? 0.5, '', -1, 2),
      pivot_y: makeCurve('pivot_y', 'pivot', 'Y', 'Pivot Y', '#fb923c', initial.pivotY ?? 0.5, '', -1, 2),
      playback_speed: makeCurve('playback_speed', 'speed', 'Scalar', 'Playback Speed', '#eab308', 1.0, 'x', 0.1, 10),
      wheel_rotation: makeCurve('wheel_rotation', 'wheel', 'Z', '3D Wheel Rotation', '#8b5cf6', 0, '°', -3600, 3600),
    },
  }
}

/**
 * Evaluate all clip animation channels at a given timeline time
 */
/**
 * Orthographic 3-axis rotation matrix for canvas 2D (Gold Motion / Alight-style
 * Rotation X/Y flip): returns the affine {a,b,c,d} for ctx.transform(a,b,c,d,0,0).
 * rotationY foreshortens horizontally (cos), rotationX foreshortens vertically,
 * and combined angles add the correct diagonal shear (Rx·Ry orthographic
 * projection). 90° = edge-on, 180° = mirrored flip. Canvas 2D has no true
 * perspective, so this is the standard orthographic model, not a fake 3D claim.
 */
export function rotationXYMatrix(
  rotationXDeg: number,
  rotationYDeg: number,
): { a: number; b: number; c: number; d: number } {
  const rx = ((rotationXDeg || 0) * Math.PI) / 180
  const ry = ((rotationYDeg || 0) * Math.PI) / 180
  const sx = Math.sin(rx)
  const cx = Math.cos(rx)
  const sy = Math.sin(ry)
  const cy = Math.cos(ry)
  return { a: cy, b: sx * sy, c: 0, d: cx }
}

/** Format evaluated progress samples (0..1 time) as a CSS linear() timing function. */
function progressToCssLinear(samples: number[]): string {
  const stops = samples.map((p, i) => {
    const pct = Math.round((i / (samples.length - 1)) * 1000) / 10
    const val = Math.round(p * 1000) / 10
    return `${val}% ${pct}%`
  })
  return `linear(${stops.join(', ')})`
}

/**
 * CSS timing-function for an easing preset (Jitter-style "Copy as CSS").
 * Standard presets are sampled from the exact evaluated curve (including
 * intensity), so back/bounce/elastic overshoot survives as linear() stops;
 * only the trivially exact cases use keyword forms.
 */
export function easingToCss(interpolation: InterpolationType, intensity = 1): string {
  if (interpolation === 'constant') return 'steps(1, end)'
  const inten = Math.min(1.5, Math.max(0, intensity))
  if (interpolation === 'linear' && inten === 1) return 'linear'
  const N = 20
  const samples: number[] = []
  for (let i = 0; i <= N; i++) {
    const u = i / N
    const raw = evaluateEasingProgress(u, interpolation)
    samples.push(u + (raw - u) * inten)
  }
  return progressToCssLinear(samples)
}

/**
 * CSS timing-function for one concrete keyframe segment, sampled from the
 * real evaluated curve — bezier handles and easing intensity included.
 * Returns null when the keyframe has no following segment to describe.
 */
export function keyframeSegmentToCss(curve: PropertyCurve, keyframeId: string): string | null {
  const keys = [...curve.keyframes].sort((a, b) => a.time - b.time)
  const idx = keys.findIndex((k) => k.id === keyframeId)
  if (idx < 0 || idx >= keys.length - 1) return null
  const k0 = keys[idx]
  const k1 = keys[idx + 1]
  if (k0.interpolation === 'constant') return 'steps(1, end)'
  const dt = k1.time - k0.time
  const dv = k1.value - k0.value
  if (dt <= 1e-6 || Math.abs(dv) <= 1e-9) return null
  const N = 20
  const samples: number[] = []
  for (let i = 0; i <= N; i++) {
    const t = k0.time + (i / N) * dt
    samples.push((evaluateCurve(curve, t) - k0.value) / dv)
  }
  return progressToCssLinear(samples)
}

export function evaluateClipAnimation(clip: Clip, timelineTime: number): EvaluatedClipTransform {
  const base = clip.transform
  const anim = clip.animation

  if (!anim || !anim.curves) {
    return {
      x: base.x,
      y: base.y,
      z: 0,
      rotationX: base.rotationX ?? 0,
      rotationY: base.rotationY ?? 0,
      rotationZ: base.rotation,
      scaleX: base.scale,
      scaleY: base.scale,
      scaleZ: 1,
      opacity: base.opacity,
      speed: 1.0,
      pivotX: base.pivotX ?? 0.5,
      pivotY: base.pivotY ?? 0.5,
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
    rotationX: getVal('rotation_x', base.rotationX ?? 0),
    rotationY: getVal('rotation_y', base.rotationY ?? 0),
    rotationZ: getVal('rotation_z', base.rotation),
    scaleX: getVal('scale_x', base.scale),
    scaleY: getVal('scale_y', base.scale),
    scaleZ: getVal('scale_z', 1.0),
    opacity: getVal('opacity', base.opacity),
    speed: getVal('playback_speed', 1.0),
    pivotX: getVal('pivot_x', base.pivotX ?? 0.5),
    pivotY: getVal('pivot_y', base.pivotY ?? 0.5),
  }
}
