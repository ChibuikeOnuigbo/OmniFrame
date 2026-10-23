/**
 * Speed-curve presets (time remap). Learned from board C of the user's
 * "15 curves" brief (test_ans_result/sources/src_charC.png) and shipped as a
 * first-class clip property: u = f(p) remaps a clip's local time so media
 * sampling, entrances and holds follow the curve.
 */
export type SpeedCurveId =
  | 'linear' | 'ease-in-quad' | 'ease-out-quad' | 'ease-in-out-cubic'
  | 'ease-out-back' | 'ease-in-out-back' | 'elastic-out' | 'bounce-out'
  | 'expo-in' | 'expo-out' | 'circ-in-out' | 'sine-in-out'
  | 'hold-then-go' | 'ramp-hold-ramp' | 'velocity-spike'

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t)

export const SPEED_CURVES: Array<{ id: SpeedCurveId; name: string; fn: (t: number) => number }> = [
  { id: 'linear', name: 'Linear', fn: t => t },
  { id: 'ease-in-quad', name: 'Ease In Quad', fn: t => t * t },
  { id: 'ease-out-quad', name: 'Ease Out Quad', fn: t => 1 - (1 - t) * (1 - t) },
  { id: 'ease-in-out-cubic', name: 'Ease In-Out Cubic', fn: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) },
  { id: 'ease-out-back', name: 'Ease Out Back', fn: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2) } },
  { id: 'ease-in-out-back', name: 'Ease In-Out Back', fn: t => { const c = 2.5949; return t < 0.5 ? (Math.pow(2 * t, 2) * ((c + 1) * 2 * t - c)) / 2 : (Math.pow(2 * t - 2, 2) * ((c + 1) * (t * 2 - 2) + c) + 2) / 2 } },
  { id: 'elastic-out', name: 'Elastic Out', fn: t => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1) },
  { id: 'bounce-out', name: 'Bounce Out', fn: t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375 } },
  { id: 'expo-in', name: 'Expo In', fn: t => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)) },
  { id: 'expo-out', name: 'Expo Out', fn: t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)) },
  { id: 'circ-in-out', name: 'Circ In-Out', fn: t => (t < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2) },
  { id: 'sine-in-out', name: 'Sine In-Out', fn: t => -(Math.cos(Math.PI * t) - 1) / 2 },
  { id: 'hold-then-go', name: 'Hold Then Go', fn: t => (t < 0.4 ? 0 : clamp01((t - 0.4) / 0.6)) },
  { id: 'ramp-hold-ramp', name: 'Ramp Hold Ramp', fn: t => (t < 0.35 ? t / 0.7 : t < 0.65 ? 0.5 : 0.5 + (t - 0.65) / 0.7) },
  { id: 'velocity-spike', name: 'Velocity Spike', fn: t => clamp01(t + 0.22 * Math.sin(Math.PI * t) * Math.sin(2 * Math.PI * t)) },
]

export const SPEED_CURVE_IDS = SPEED_CURVES.map(c => c.id)

export function evaluateSpeedCurve(id: SpeedCurveId | undefined, t: number): number {
  if (!id || id === 'linear') return clamp01(t)
  const c = SPEED_CURVES.find(c => c.id === id)
  return c ? c.fn(clamp01(t)) : clamp01(t)
}

/** Remap a clip-local time (seconds) through the clip's speed curve. */
export function remapClipLocal(clip: { speedCurve?: SpeedCurveId; duration: number }, local: number): number {
  const dur = Math.max(0.0001, clip.duration)
  if (!clip.speedCurve || clip.speedCurve === 'linear') return local
  return evaluateSpeedCurve(clip.speedCurve, local / dur) * dur
}
