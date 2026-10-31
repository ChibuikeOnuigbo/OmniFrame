// 15 speed-curve presets (time-remap functions). f(0)=0, f(1)=1, monotonic or
// intentionally stylised (hold / spike) — all evaluated per-frame as u = f(p).
export const SPEED_CURVES = [
  { id: 'linear', name: 'Linear', fn: t => t },
  { id: 'ease-in-quad', name: 'Ease In Quad', fn: t => t * t },
  { id: 'ease-out-quad', name: 'Ease Out Quad', fn: t => 1 - (1 - t) * (1 - t) },
  { id: 'ease-in-out-cubic', name: 'Ease In-Out Cubic', fn: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) },
  { id: 'ease-out-back', name: 'Ease Out Back', fn: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2) } },
  { id: 'ease-in-out-back', name: 'Ease In-Out Back', fn: t => { const c = 1.70158 * 1.525; return t < 0.5 ? (Math.pow(2 * t, 2) * ((c + 1) * 2 * t - c)) / 2 : (Math.pow(2 * t - 2, 2) * ((c + 1) * (t * 2 - 2) + c) + 2) / 2 } },
  { id: 'elastic-out', name: 'Elastic Out', fn: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1 },
  { id: 'bounce-out', name: 'Bounce Out', fn: t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375 } },
  { id: 'expo-in', name: 'Expo In', fn: t => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)) },
  { id: 'expo-out', name: 'Expo Out', fn: t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)) },
  { id: 'circ-in-out', name: 'Circ In-Out', fn: t => (t < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2) },
  { id: 'sine-in-out', name: 'Sine In-Out', fn: t => -(Math.cos(Math.PI * t) - 1) / 2 },
  { id: 'hold-then-go', name: 'Hold Then Go', fn: t => (t < 0.4 ? 0 : clamp((t - 0.4) / 0.6)) },
  { id: 'ramp-hold-ramp', name: 'Ramp Hold Ramp', fn: t => (t < 0.35 ? t / 0.7 : t < 0.65 ? 0.5 : 0.5 + (t - 0.65) / 0.7) },
  { id: 'velocity-spike', name: 'Velocity Spike', fn: t => clamp(t + 0.22 * Math.sin(Math.PI * t) * Math.sin(2 * Math.PI * t)) },
]
function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v }
export const SPEED_CURVE_IDS = SPEED_CURVES.map(c => c.id)
export function evalCurve(id, t) {
  const c = SPEED_CURVES.find(c => c.id === id) || SPEED_CURVES[0]
  return c.fn(clamp(t))
}
