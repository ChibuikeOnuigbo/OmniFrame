/**
 * Alight-Motion-named procedural/time family, shared by playback.ts (booted
 * app) and tools/mcp/appRender.mjs (headless) so both move identically:
 *  - Echo Keyframes: ghost copies at past transform positions (motion trail)
 *  - Auto-Shake: seeded oscillation offset
 *  - Time Quantization: strobe hold of the evaluated time
 *  - Motion Blur: temporal sample stack
 *  - Speed reverse / freeze-frame hold: local time warps
 */
export interface PfxEffects {
  echo?: number; echoDecay?: number; echoSpacing?: number
  autoShake?: number; autoShakeFreq?: number
  timeQuantization?: number
  motionBlur?: number
  reverse?: number
  freezeHold?: number; freezeAt?: number
  oscillate?: number; oscillateFreq?: number; oscillateAngle?: number; oscillateWave?: 'sine' | 'triangle'; oscillatePhase?: number
}

export function pfxLocalTime(fx: PfxEffects | undefined, t: number, start: number, duration: number): number {
  if (!fx) return t
  let lt = t - start
  if (fx.reverse) lt = duration - lt
  if (fx.freezeHold && fx.freezeHold > 0) {
    const fa = fx.freezeAt ?? 0
    if (lt > fa) lt = lt < fa + fx.freezeHold ? fa : lt - fx.freezeHold
  }
  if (fx.timeQuantization && fx.timeQuantization > 0) {
    lt = Math.floor(lt / fx.timeQuantization) * fx.timeQuantization
  }
  return start + Math.max(0, Math.min(duration, lt))
}

export function pfxShake(fx: PfxEffects | undefined, t: number): { dx: number; dy: number } {
  const amp = fx?.autoShake || 0
  if (!amp) return { dx: 0, dy: 0 }
  const f = fx?.autoShakeFreq || 8
  return {
    dx: amp * (Math.sin(t * f * 2.13 + 1.7) * 0.6 + Math.sin(t * f * 5.71 + 0.3) * 0.4),
    dy: amp * (Math.sin(t * f * 1.71 + 4.1) * 0.6 + Math.sin(t * f * 4.37 + 2.2) * 0.4),
  }
}

/** AM Oscillate: property wobble — here applied to position (seq px). */
export function pfxOscillate(fx: PfxEffects | undefined, t: number): { dx: number; dy: number } {
  const amp = fx?.oscillate || 0 // AM Magnitude (px)
  if (!amp) return { dx: 0, dy: 0 }
  const f = fx?.oscillateFreq || 2 // AM Frequency (Hz)
  const ang = ((fx?.oscillateAngle ?? 45) * Math.PI) / 180 // AM Angle, clockwise
  const ph = (fx?.oscillatePhase || 0) / 100 // AM Phase 0..1000 -> cycles
  let u = t * f + ph
  const wave = fx?.oscillateWave || 'sine'
  const c = wave === 'triangle' ? 2 * Math.abs(2 * (u - Math.floor(u + 0.5))) - 1 : Math.sin(u * Math.PI * 2)
  return { dx: amp * Math.cos(ang) * c, dy: amp * Math.sin(ang) * c }
}

export function pfxEchoTimes(fx: PfxEffects | undefined, t: number): { time: number; alpha: number }[] {
  const n = Math.floor(fx?.echo || 0)
  if (n < 1) return []
  const sp = fx?.echoSpacing || 0.08
  const decay = fx?.echoDecay ?? 0.5
  const out: { time: number; alpha: number }[] = []
  for (let i = 1; i <= n; i++) out.push({ time: t - i * sp, alpha: Math.pow(decay, i) })
  return out
}

export function pfxMotionBlurSamples(fx: PfxEffects | undefined, t: number, fps: number): { time: number; alpha: number }[] {
  const k = fx?.motionBlur || 0
  if (k <= 0) return []
  const dt = 1 / Math.max(1, fps)
  return [
    { time: t - dt, alpha: 0.28 * k },
    { time: t - dt * 2, alpha: 0.16 * k },
  ]
}
