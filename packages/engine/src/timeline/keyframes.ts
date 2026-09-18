/**
 * Keyframe channel evaluation.
 *
 * Supports linear, hold, ease-in/out, cubic-bezier and a real spring solver.
 * Spring integration is a closed-form damped harmonic oscillator so evaluation is
 * O(1) per sample and identical on every platform (no dependence on frame timing).
 */
import { Keyframe, KeyframeEasing } from './model.js';
import { clamp01 } from '../core/math.js';

export function sortKeyframes(kfs: Keyframe[]): Keyframe[] {
  return [...kfs].sort((a, b) => a.frame - b.frame);
}

export function setKeyframe(channel: Keyframe[], kf: Keyframe): Keyframe[] {
  const out = channel.filter((k) => k.frame !== kf.frame);
  out.push({ ...kf });
  return sortKeyframes(out);
}

export function removeKeyframe(channel: Keyframe[], frame: number): Keyframe[] {
  return channel.filter((k) => k.frame !== frame);
}

/** Move the nearest keyframe within `tolerance` frames to `frame`. */
export function moveKeyframe(channel: Keyframe[], from: number, to: number, tolerance = 2): Keyframe[] {
  let bestIdx = -1;
  let bestDist = tolerance + 1;
  channel.forEach((k, i) => {
    const d = Math.abs(k.frame - from);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  });
  if (bestIdx < 0) return channel;
  const out = channel.map((k, i) => (i === bestIdx ? { ...k, frame: to } : k));
  return sortKeyframes(out);
}

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  // Newton-Raphson on the x(t) polynomial, with a bisection fallback.
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number): number => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number): number => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) return sampleY(t);
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 24; i++) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sampleY(t);
  };
}

/**
 * Closed-form damped harmonic oscillator response, normalised so that the steady
 * state is 1. `t` is normalised progress in [0,1] mapped onto `duration` seconds.
 */
export function springResponse(
  t: number,
  opts: { mass: number; stiffness: number; damping: number; duration?: number },
): number {
  const { mass, stiffness, damping, duration = 1 } = opts;
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const time = clamp01(t) * duration;
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const e = Math.exp(-zeta * w0 * time);
    return 1 - e * (Math.cos(wd * time) + ((zeta * w0) / wd) * Math.sin(wd * time));
  }
  if (Math.abs(zeta - 1) < 1e-6) {
    const e = Math.exp(-w0 * time);
    return 1 - e * (1 + w0 * time);
  }
  const s1 = -w0 * (zeta - Math.sqrt(zeta * zeta - 1));
  const s2 = -w0 * (zeta + Math.sqrt(zeta * zeta - 1));
  const c2 = -s1 / (s2 - s1);
  const c1 = 1 - c2;
  return 1 - (c1 * Math.exp(s1 * time) + c2 * Math.exp(s2 * time));
}

export const EASING_CURVES: Record<Exclude<KeyframeEasing, 'bezier' | 'spring' | 'hold'>, (t: number) => number> = {
  linear: (t) => t,
  easeIn: cubicBezier(0.42, 0, 1, 1),
  easeOut: cubicBezier(0, 0, 0.58, 1),
  easeInOut: cubicBezier(0.42, 0, 0.58, 1),
};

export function ease(easing: KeyframeEasing, t: number, kf?: Keyframe): number {
  switch (easing) {
    case 'hold':
      return 0;
    case 'bezier': {
      const b = kf?.bezier ?? { x1: 0.42, y1: 0, x2: 0.58, y2: 1 };
      return cubicBezier(b.x1, b.y1, b.x2, b.y2)(t);
    }
    case 'spring':
      return springResponse(t, kf?.spring ?? { mass: 1, stiffness: 100, damping: 10 });
    default:
      return EASING_CURVES[easing](t);
  }
}

function asNumber(v: number | string | number[]): number {
  if (typeof v === 'number') return v;
  if (Array.isArray(v)) return v[0] ?? 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function interpolateValue(
  a: Keyframe['value'],
  b: Keyframe['value'],
  t: number,
): number | number[] | string {
  // Discrete channels (e.g. a blend-mode string) hold the left-hand value.
  if (typeof a === 'string' || typeof b === 'string') {
    return typeof a === 'string' ? a : (b as string);
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    const av = Array.isArray(a) ? a : [a];
    const bv = Array.isArray(b) ? b : [b];
    const len = Math.max(av.length, bv.length);
    const out: number[] = [];
    for (let i = 0; i < len; i++) {
      const x = av[i] ?? 0;
      const y = bv[i] ?? 0;
      out.push(x + (y - x) * t);
    }
    return out;
  }
  return a + (b - a) * t;
}

/** Evaluate a keyframe channel at a frame. Returns the left value before the first key. */
export function evaluate(channel: Keyframe[] | undefined, frame: number, fallback = 0): number | number[] | string {
  if (!channel || channel.length === 0) return fallback;
  const kfs = channel;
  if (frame <= kfs[0].frame) return kfs[0].value;
  const last = kfs[kfs.length - 1];
  if (frame >= last.frame) return last.value;
  let i = 0;
  while (i < kfs.length - 1 && kfs[i + 1].frame <= frame) i++;
  const a = kfs[i];
  const b = kfs[i + 1];
  if (a.easing === 'hold') return a.value;
  const span = b.frame - a.frame;
  const t = span <= 0 ? 1 : clamp01((frame - a.frame) / span);
  return interpolateValue(a.value, b.value, ease(a.easing, t, a));
}

export function evaluateNumber(channel: Keyframe[] | undefined, frame: number, fallback = 0): number {
  const v = evaluate(channel, frame, fallback);
  return asNumber(v);
}

/** Bake a channel into a per-frame array (used for export and for the curve editor). */
export function bake(channel: Keyframe[], from: number, to: number, fallback = 0): number[] {
  const out: number[] = [];
  for (let f = from; f < to; f++) out.push(evaluateNumber(channel, f, fallback));
  return out;
}
