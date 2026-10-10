/**
 * Music & sound-bed generator for the voice-isolation study.
 *
 * Synthesizes five 20 s stereo WAV beds at 44.1 kHz with deliberate stereo
 * placement, so the mid/side voice-isolation DSP has realistic material to
 * work against:
 *
 *   pad-chords.wav     warm chord pad, gently wide (slight L/R detune)
 *   arp-synth.wav      16th-note arpeggio, hard-panned per note
 *   drums-groove.wav   kick/snare/hats groove (kick+snare centred, hats panned)
 *   ambient-noise.wav  pink-ish noise bed + slow whooshes, decorrelated L/R
 *   full-band.wav      pad + arp + drums combined (the realistic mix case)
 *
 * Pure Node, no dependencies. Run: node qa/generate-music-beds.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SR = 44100
const DURATION = 20
const N = SR * DURATION
const OUT_DIR = new URL('./assets/voice/', import.meta.url).pathname

mkdirSync(OUT_DIR, { recursive: true })

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/** Deterministic PRNG so every regeneration is bit-identical. */
function makeRng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function zeros() {
  return [new Float32Array(N), new Float32Array(N)]
}

/** Add a sine partial with per-channel detune/phase and an amplitude envelope. */
function addTone([L, R], freq, startSec, durSec, { gain = 0.1, detune = 0.0015, phase = 0, attack = 0.02, release = 0.25 } = {}) {
  const from = Math.floor(startSec * SR)
  const len = Math.floor(durSec * SR)
  const fL = freq * (1 + detune)
  const fR = freq * (1 - detune)
  for (let i = 0; i < len; i++) {
    const idx = from + i
    if (idx >= N) break
    const t = i / SR
    const env =
      Math.min(1, t / Math.max(1e-4, attack)) *
      Math.min(1, Math.max(0, (durSec - t) / Math.max(1e-4, release)))
    L[idx] += Math.sin(2 * Math.PI * fL * t + phase) * gain * env
    R[idx] += Math.sin(2 * Math.PI * fR * t + phase + 0.35) * gain * env
  }
}

/* ---------------------------------------------------------- pad chords -- */
function synthPad() {
  const out = zeros()
  // Am — F — C — G, two passes, 2.5 s per chord.
  const chords = [
    [220.0, 261.63, 329.63], // A3 C4 E4
    [174.61, 220.0, 261.63], // F3 A3 C4
    [196.0, 261.63, 329.63], // G3 C4 E4 (C major inversion walk)
    [196.0, 246.94, 293.66], // G3 B3 D4
  ]
  for (let pass = 0; pass < 2; pass++) {
    chords.forEach((chord, ci) => {
      const start = (pass * 4 + ci) * 2.5
      for (const f of chord) {
        addTone(out, f, start, 2.5, { gain: 0.075, detune: 0.002, attack: 0.35, release: 0.6 })
        addTone(out, f * 2, start, 2.5, { gain: 0.02, detune: 0.003, attack: 0.5, release: 0.7 })
      }
    })
  }
  return out
}

/* ----------------------------------------------------------- arp synth -- */
function synthArp() {
  const out = zeros()
  const rng = makeRng(20260104)
  // A-minor pentatonic arpeggio, 16th notes at 112 BPM.
  const bpm = 112
  const stepDur = 60 / bpm / 4
  const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33]
  const steps = Math.floor(DURATION / stepDur)
  for (let s = 0; s < steps; s++) {
    const t = s * stepDur
    const noteIdx = (s * 3 + Math.floor(rng() * 2)) % scale.length
    const f = scale[noteIdx]
    const from = Math.floor(t * SR)
    const len = Math.floor(stepDur * 0.9 * SR)
    const panLeft = s % 2 === 0 // hard-pan alternating notes
    for (let i = 0; i < len; i++) {
      const idx = from + i
      if (idx >= N) break
      const tt = i / SR
      const env = Math.exp(-tt * 18)
      // square-ish: fundamental + odd harmonics
      const wave =
        Math.sin(2 * Math.PI * f * tt) * 0.6 +
        Math.sin(2 * Math.PI * f * 3 * tt) * 0.18 +
        Math.sin(2 * Math.PI * f * 5 * tt) * 0.07
      const v = wave * env * 0.22
      if (panLeft) L_(out, idx, v)
      else R_(out, idx, v)
    }
  }
  return out
}
function L_(out, idx, v) {
  out[0][idx] += v
}
function R_(out, idx, v) {
  out[1][idx] += v
}

/* -------------------------------------------------------- drums groove -- */
function synthDrums() {
  const out = zeros()
  const rng = makeRng(777)
  const bpm = 112
  const beat = 60 / bpm
  const beats = Math.floor(DURATION / beat)
  const noise = () => rng() * 2 - 1

  const kickAt = (t) => {
    const from = Math.floor(t * SR)
    const len = Math.floor(0.28 * SR)
    for (let i = 0; i < len; i++) {
      const idx = from + i
      if (idx >= N) break
      const tt = i / SR
      const f = 120 * Math.exp(-tt * 14) + 44
      const env = Math.exp(-tt * 9)
      const v = Math.sin(2 * Math.PI * f * tt) * env * 0.85
      out[0][idx] += v // centred
      out[1][idx] += v
    }
  }
  const snareAt = (t) => {
    const from = Math.floor(t * SR)
    const len = Math.floor(0.18 * SR)
    for (let i = 0; i < len; i++) {
      const idx = from + i
      if (idx >= N) break
      const tt = i / SR
      const env = Math.exp(-tt * 26)
      const tone = Math.sin(2 * Math.PI * 189 * tt) * 0.35
      const burst = noise() * 0.55
      const v = (tone + burst) * env * 0.5
      out[0][idx] += v // centred
      out[1][idx] += v
    }
  }
  const hatAt = (t, open, pan) => {
    const from = Math.floor(t * SR)
    const len = Math.floor((open ? 0.22 : 0.06) * SR)
    // crude one-pole highpass state per hit
    let hp = 0
    for (let i = 0; i < len; i++) {
      const idx = from + i
      if (idx >= N) break
      const tt = i / SR
      const env = Math.exp(-tt * (open ? 14 : 60))
      const x = noise()
      hp = 0.72 * hp + 0.28 * x // lowpass...
      const bright = x - hp // ...subtracted => highpass-ish
      const v = bright * env * 0.32
      if (pan < 0) out[0][idx] += v * -pan
      else out[1][idx] += v * pan
    }
  }

  for (let b = 0; b < beats; b++) {
    const t = b * beat
    kickAt(t)
    if (b % 4 === 1 || b % 4 === 3) snareAt(t + beat / 2) // snare on 2 & 4
    kickAt(t + beat * 0.75) // extra syncopated kick
    for (let h = 0; h < 4; h++) {
      hatAt(t + (h * beat) / 4, h === 3, h % 2 === 0 ? -0.7 : 0.7)
    }
  }
  return out
}

/* ------------------------------------------------------ ambient noise -- */
function synthAmbient() {
  const out = zeros()
  const rng = makeRng(424242)
  // pink-ish noise via two cascaded one-pole lowpasses, decorrelated L/R,
  // plus a slow swell every ~4 s (the "whoosh").
  let lp1L = 0, lp2L = 0, lp1R = 0, lp2R = 0
  const a = 0.045
  for (let i = 0; i < N; i++) {
    const t = i / SR
    const swell = 0.5 + 0.5 * Math.sin(2 * Math.PI * t / 4.0 - Math.PI / 2)
    const xL = rng() * 2 - 1
    const xR = rng() * 2 - 1
    lp1L += a * (xL - lp1L); lp2L += a * (lp1L - lp2L)
    lp1R += a * (xR - lp1R); lp2R += a * (lp1R - lp2R)
    const base = 0.16 + 0.5 * Math.pow(swell, 2.2)
    out[0][i] = lp2L * base * 1.9
    out[1][i] = lp2R * base * 1.9
  }
  return out
}

/* ------------------------------------------------------------- mixing -- */
function mixBeds(parts) {
  const out = zeros()
  for (const [bed, gain] of parts) {
    for (let i = 0; i < N; i++) {
      out[0][i] += bed[0][i] * gain
      out[1][i] += bed[1][i] * gain
    }
  }
  return out
}

function normalize([L, R], peakDb = -1.0) {
  let max = 0
  for (let i = 0; i < N; i++) {
    max = Math.max(max, Math.abs(L[i]), Math.abs(R[i]))
  }
  const target = Math.pow(10, peakDb / 20)
  const g = max > 0 ? target / max : 1
  for (let i = 0; i < N; i++) {
    L[i] = clamp(L[i] * g, -1, 1)
    R[i] = clamp(R[i] * g, -1, 1)
  }
  return [L, R]
}

function writeWav(name, [L, R]) {
  const dataSize = N * 2 * 2
  const buf = new ArrayBuffer(44 + dataSize)
  const v = new DataView(buf)
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); v.setUint32(4, 36 + dataSize, true); str(8, 'WAVE')
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true)
  v.setUint32(24, SR, true); v.setUint32(28, SR * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true)
  str(36, 'data'); v.setUint32(40, dataSize, true)
  let off = 44
  for (let i = 0; i < N; i++) {
    for (const ch of [L, R]) {
      const s = clamp(ch[i], -1, 1)
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      off += 2
    }
  }
  const path = join(OUT_DIR, name)
  writeFileSync(path, Buffer.from(buf))
  return path
}

/* --------------------------------------------------------------- run -- */
const pad = synthPad()
const arp = synthArp()
const drums = synthDrums()
const ambient = synthAmbient()
const full = mixBeds([
  [pad, 0.9],
  [arp, 0.7],
  [drums, 0.85],
])

const rms = ([L, R]) => {
  let s = 0
  for (let i = 0; i < N; i++) s += (L[i] * L[i] + R[i] * R[i]) / 2
  return Math.sqrt(s / N)
}

for (const [name, bed] of [
  ['pad-chords.wav', pad],
  ['arp-synth.wav', arp],
  ['drums-groove.wav', drums],
  ['ambient-noise.wav', ambient],
  ['full-band.wav', full],
]) {
  normalize(bed)
  const path = writeWav(name, bed)
  // Stereo width metric: side energy fraction (what mid/side DSP can attack).
  let mid = 0, side = 0
  for (let i = 0; i < N; i++) {
    const m = (bed[0][i] + bed[1][i]) / 2
    const s = (bed[0][i] - bed[1][i]) / 2
    mid += m * m
    side += s * s
  }
  const sideFrac = side / (side + mid)
  console.log(
    `wrote ${path}  rms=${rms(bed).toFixed(4)}  sideEnergyFraction=${(sideFrac * 100).toFixed(1)}%`,
  )
}
console.log('Music & sound beds generated.')
