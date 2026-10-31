// Runs the REAL htdemucs model (public/models/htdemucs.onnx) through the
// product's vendored separation code (src/lib/demucs/apply.js separateTracks
// + ONNXHTDemucs.forward) on the pre-decoded complex-song PCM, using
// onnxruntime-web's WASM backend under Node (the same runtime the browser
// build ships; the browser worker path is environment-limited headlessly).
//
// Reads  /tmp/voice-bench/mix.f32
// Writes /tmp/voice-bench/instr-demucs.f32 (drums+bass+other) and
//        /tmp/voice-bench/vocal-demucs.f32 (vocals stem)
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ort from 'onnxruntime-web'
import { ONNXHTDemucs } from '../src/lib/demucs/onnx-htdemucs.js'
import { separateTracks } from '../src/lib/demucs/apply.js'

const WORK = process.env.VOICE_BENCH_DIR || '/tmp/voice-bench'
const tag = process.argv[2] || 'demucs'

ort.env.wasm.numThreads = 4

const raw = readFileSync(join(WORK, 'mix.f32'))
const interleaved = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4)
const frames = Math.floor(interleaved.length / 2)
const left = new Float32Array(frames)
const right = new Float32Array(frames)
for (let i = 0; i < frames; i++) {
  left[i] = interleaved[i * 2]
  right[i] = interleaved[i * 2 + 1]
}
console.log(`mix: ${(frames / 44100).toFixed(1)}s`)

const weights = readFileSync('/home/user/OmniFrame/public/models/htdemucs.onnx')
const session = await ort.InferenceSession.create(weights, { executionProviders: ['wasm'] })
const model = new ONNXHTDemucs()
model.session = session
model.inputNames = session.inputNames
model.outputNames = session.outputNames
console.log('htdemucs session ready:', session.inputNames, '->', session.outputNames)

const t0 = Date.now()
const tracks = await separateTracks(
  model,
  { channelData: [left, right], sampleRate: 44100 },
  (f) => console.log(`progress ${(f * 100).toFixed(0)}% (${((Date.now() - t0) / 1000).toFixed(0)}s)`),
)
console.log(`separation done in ${((Date.now() - t0) / 1000).toFixed(0)}s; stems:`, Object.keys(tracks))

function stemToInterleaved(stem) {
  const [L, R] = stem.channelData
  const out = new Float32Array(L.length * 2)
  for (let i = 0; i < L.length; i++) {
    out[i * 2] = L[i]
    out[i * 2 + 1] = R[i]
  }
  return out
}
// remove_vocal in the product = drums + bass + other summed
const n = frames
const instr = new Float32Array(n * 2)
for (const name of ['drums', 'bass', 'other']) {
  const s = stemToInterleaved(tracks[name])
  const len = Math.min(s.length, instr.length)
  for (let i = 0; i < len; i++) instr[i] += s[i]
}
writeFileSync(join(WORK, `instr-${tag}.f32`), Buffer.from(instr.buffer))
writeFileSync(join(WORK, `vocal-${tag}.f32`), Buffer.from(stemToInterleaved(tracks.vocals).buffer))
console.log('wrote demucs stems', tag)
