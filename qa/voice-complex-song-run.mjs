// Runs the REAL product DSP isolation engine (src/lib/voiceIsolation.ts,
// bundled with rolldown; neural deps stubbed because this harness exercises
// the always-available DSP engine) on pre-decoded float32 stereo PCM in
// /tmp/voice-bench, writing both output stems as raw float32 so
// tools/voice_benchmark.py can measure and graph them.
//
// Usage: node qa/voice-complex-song-run.mjs <tag> [strength]
//   reads  /tmp/voice-bench/mix.f32
//   writes /tmp/voice-bench/instr-<tag>.f32 and vocal-<tag>.f32
import { rolldown } from 'rolldown'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = '/home/user/OmniFrame'
const WORK = process.env.VOICE_BENCH_DIR || '/tmp/voice-bench'
const tag = process.argv[2] || 'before'
const strength = process.argv[3] ? parseFloat(process.argv[3]) : 0.92

const stubPath = join(tmpdir(), 'ort-stub.mjs')
writeFileSync(stubPath, `
export class Tensor { constructor(type, data, dims) { this.type = type; this.data = data; this.dims = dims } }
export const InferenceSession = { create: async () => { throw new Error('neural runtime stubbed in DSP benchmark') } }
export const env = { wasm: {}, logLevel: 'error' }
export default { Tensor, InferenceSession, env }
`)

const stubPlugin = {
  name: 'stub-neural',
  resolveId(id) {
    if (id === 'onnxruntime-web' || id === 'onnxruntime-node') return stubPath
    if (id.endsWith('.wasm')) return stubPath
    return null
  },
}

const bundlePath = join(tmpdir(), 'voice-isolation-bundle.mjs')
const bundle = await rolldown({
  input: process.env.VOICE_ENTRY || join(ROOT, 'src/lib/voiceIsolation.ts'),
  platform: 'node',
  plugins: [stubPlugin],
  onLog: () => {},
})
await bundle.write({ format: 'esm', file: bundlePath, codeSplitting: false })

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} }
const mod = await import(bundlePath)
const { isolateVoiceFromAudioBuffer } = mod
if (typeof isolateVoiceFromAudioBuffer !== 'function') throw new Error('isolateVoiceFromAudioBuffer not exported')

const raw = readFileSync(join(WORK, 'mix.f32'))
const interleaved = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4)
const frames = Math.floor(interleaved.length / 2)
const left = new Float32Array(frames)
const right = new Float32Array(frames)
for (let i = 0; i < frames; i++) {
  left[i] = interleaved[i * 2]
  right[i] = interleaved[i * 2 + 1]
}

function makeBuffer(channels) {
  return {
    numberOfChannels: channels.length,
    sampleRate: 44100,
    length: channels[0].length,
    duration: channels[0].length / 44100,
    getChannelData: (i) => channels[i],
  }
}
const ctx = {
  createBuffer: (n, len) => makeBuffer(Array.from({ length: n }, () => new Float32Array(len))),
}

const input = makeBuffer([left, right])
const started = Date.now()
const instrumental = isolateVoiceFromAudioBuffer(ctx, input, { mode: 'remove_vocal', strength })
const vocal = isolateVoiceFromAudioBuffer(ctx, input, { mode: 'keep_vocal', strength })
console.log(`separation (${tag}) in ${((Date.now() - started) / 1000).toFixed(1)}s at strength ${strength}`)

function writeStem(buffer, name) {
  const L = buffer.getChannelData(0)
  const R = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : L
  const out = new Float32Array(L.length * 2)
  for (let i = 0; i < L.length; i++) {
    out[i * 2] = L[i]
    out[i * 2 + 1] = R[i]
  }
  writeFileSync(join(WORK, name), Buffer.from(out.buffer))
}
writeStem(instrumental, `instr-${tag}.f32`)
writeStem(vocal, `vocal-${tag}.f32`)
console.log('wrote stems for', tag)
