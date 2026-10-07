/**
 * Full-track production-strength speed-fix evidence generator.
 *
 * Runs the EXACT algorithm the app runs on a slowed track when the auto
 * speed-fix fires — 3 shift-averaged passes (SHIFT_STEP_SAMPLES = 4410),
 * finite-aware per-sample averaging, LS cross-talk removal, polyphase-sinc
 * speed-up x1.45 (the factor in-app detection picks on this track) and
 * slow-back restored to the exact input length — on the FULL 108 s track,
 * outside the browser sandbox that caps the E2E at 6 s windows.
 *
 * Node-only, process-per-pass: the onnxruntime-web WASM heap grows
 * monotonically per session.run and can only be reclaimed by process exit
 * (same reason the browser worker is terminated after each pass).
 *
 * Usage (parent mode):
 *   node qa/voice-fulltrack-v3.mjs <input.mp3> <outPrefix> <factor>
 * Child mode is entered automatically via V3_PASS_IN / V3_PASS_OUT env vars.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FFMPEG = join(ROOT, 'node_modules/@ffmpeg-installer/linux-x64/ffmpeg')
const WORK = '/tmp/v3-work'
mkdirSync(WORK, { recursive: true })

// ---------- child mode: one separation pass -------------------------------
if (process.env.V3_PASS_IN) {
  const { ONNXHTDemucs } = await import(join(ROOT, 'src/lib/demucs/onnx-htdemucs.js'))
  const { separateTracks } = await import(join(ROOT, 'src/lib/demucs/apply.js'))
  const buf = readFileSync(process.env.V3_PASS_IN)
  const n = buf.length / 4 / 2
  const ch = [new Float32Array(n), new Float32Array(n)]
  for (let i = 0; i < n * 2; i++) (i % 2 === 0 ? ch[0] : ch[1])[i >> 1] = buf.readFloatLE(i * 4)
  const weights = readFileSync(join(ROOT, 'public/models/htdemucs.onnx')).buffer.slice(0)
  const model = await ONNXHTDemucs.init(weights)
  const stems = await separateTracks(model, { channelData: ch, sampleRate: 44100 }, () => {}, 0.25)
  for (const [name, stem] of Object.entries(stems)) {
    for (let c = 0; c < 2; c++) {
      writeFileSync(join(process.env.V3_PASS_OUT, `${name}-${c}.f32`), Buffer.from(stem.channelData[c].buffer, stem.channelData[c].byteOffset, stem.channelData[c].byteLength))
    }
  }
  console.log(`  pass done: ${Object.keys(stems).join(',')} @ ${n} samples/ch`)
  process.exit(0)
}

// ---------- parent mode ----------------------------------------------------
const input = process.argv[2] ?? join(ROOT, 'UPAST (Ultra Slowed) - HELLBLADE.mp3')
const outPrefix = process.argv[3] ?? 'v3'
const FACTOR = Number(process.argv[4] ?? 1.45)
const PASSES = 3
const SHIFT_STEP_SAMPLES = 4410 // mirrors src/lib/demucs/index.ts

const { resampleChannels } = await import(join(ROOT, 'src/lib/demucs/resample.js'))

function runFfmpeg(args) {
  const r = spawnSync(FFMPEG, ['-nostdin', '-hide_banner', '-loglevel', 'error', ...args], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + r.stderr.slice(-300))
}

// 1. decode the input to raw f32 stereo
runFfmpeg(['-y', '-i', input, '-f', 'f32le', '-acodec', 'pcm_f32le', '-ar', '44100', '-ac', '2', join(WORK, 'mix.f32')])
const mixBuf = readFileSync(join(WORK, 'mix.f32'))
const nOrig = mixBuf.length / 4 / 2
const mix = [new Float32Array(nOrig), new Float32Array(nOrig)]
for (let i = 0; i < nOrig * 2; i++) (i % 2 === 0 ? mix[0] : mix[1])[i >> 1] = mixBuf.readFloatLE(i * 4)
console.log(`input: ${input} — ${(nOrig / 44100).toFixed(1)}s stereo, factor x${FACTOR}, ${PASSES} passes`)

// 2. speed up with the app's own sinc resampler
const t0 = Date.now()
const sped = resampleChannels(mix, FACTOR)
console.log(`sinc speed-up x${FACTOR}: ${sped.length} samples (${(sped.length / 44100).toFixed(1)}s) in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
const nSped = sped.length
// free the native-speed mix — the child processes need every MB (the box has
// ~3.9 GB total and one pass peaks around 3 GB of WASM heap)
mixBuf.fill(0); mix[0].fill(0); mix[1].fill(0)

// 3. per-pass separation in child processes (padded by k*SHIFT like the app)
const perStem = {} // name -> [ch][pass]
for (let k = 0; k < PASSES; k++) {
  const pad = k * SHIFT_STEP_SAMPLES
  const padded = sped.channelData.map((c) => {
    if (pad === 0) return c
    const p = new Float32Array(c.length + pad)
    p.set(c, pad)
    return p
  })
  const passFile = join(WORK, `pass-${k}.f32`)
  const flat = Buffer.allocUnsafe(nSped * 2 * 4 * (pad === 0 ? 1 : 1))
  for (let i = 0; i < nSped; i++) {
    flat.writeFloatLE(padded[0][i], i * 8)
    flat.writeFloatLE(padded[1][i], i * 8 + 4)
  }
  writeFileSync(passFile, flat)
  // cache key includes the factor — different speed-up = different input
  const passOut = join(WORK, `f${FACTOR}-pass-${k}-out`)
  mkdirSync(passOut, { recursive: true })
  const t1 = Date.now()
  // resumable: a completed pass on disk is reused (OOM kills are stochastic)
  if (!existsSync(join(passOut, 'vocals-0.f32'))) {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
      env: { ...process.env, V3_PASS_IN: passFile, V3_PASS_OUT: passOut },
      stdio: ['ignore', 'inherit', 'inherit'],
      timeout: 1200000,
    })
    if (r.status !== 0) throw new Error(`pass ${k} failed (exit ${r.status}, signal ${r.signal})`)
  } else {
    console.log(`  pass ${k + 1}/${PASSES}: cached`)
  }
  console.log(`  pass ${k + 1}/${PASSES} done in ${((Date.now() - t1) / 1000).toFixed(0)}s`)
  for (const name of ['vocals', 'drums', 'bass', 'other']) {
    if (!perStem[name]) perStem[name] = [[], []]
    for (let c = 0; c < 2; c++) {
      const buf = readFileSync(join(passOut, `${name}-${c}.f32`))
      const arr = new Float32Array(buf.length / 4)
      for (let i = 0; i < arr.length; i++) arr[i] = buf.readFloatLE(i * 4)
      // undo the shift: drop the first `pad` samples, keep nSped
      perStem[name][c].push(pad === 0 ? arr : arr.subarray(pad, pad + nSped))
    }
  }
}

// 4. finite-aware per-sample average (mirrors index.ts)
function averaged(name) {
  const out = [new Float32Array(nSped), new Float32Array(nSped)]
  for (let c = 0; c < 2; c++) {
    const passesArr = perStem[name][c]
    for (let i = 0; i < nSped; i++) {
      let sum = 0, n = 0
      for (const p of passesArr) { const v = p[i]; if (Number.isFinite(v)) { sum += v; n++ } }
      out[c][i] = n > 0 ? sum / n : 0
    }
  }
  return out
}
const stems = {}
for (const name of Object.keys(perStem)) stems[name] = averaged(name)

// 5. instrumental = drums+bass+other, then LS cross-talk both ways (index.ts)
const instr = [new Float32Array(nSped), new Float32Array(nSped)]
for (let c = 0; c < 2; c++) for (const name of ['drums', 'bass', 'other']) for (let i = 0; i < nSped; i++) instr[c][i] += stems[name][c][i]

function removeLsLeakage(target, ref) {
  const CAP = 0.5
  for (let c = 0; c < target.length && c < ref.length; c++) {
    const t = target[c], r = ref[c]
    let dot = 0, rr = 0
    for (let i = 0; i < t.length; i++) { dot += t[i] * r[i]; rr += r[i] * r[i] }
    if (rr < 1e-12) continue
    const a = Math.min(CAP, Math.max(-CAP, dot / rr))
    if (a === 0) continue
    for (let i = 0; i < t.length; i++) t[i] -= a * r[i]
  }
}
removeLsLeakage(stems.vocals, instr)
removeLsLeakage(instr, stems.vocals)

// 6. slow back to the original time base, pad/trim to the exact length
function restore(chs) {
  const back = resampleChannels(chs, 1 / FACTOR)
  const out = [new Float32Array(nOrig), new Float32Array(nOrig)]
  const n = Math.min(back.length, nOrig)
  for (let c = 0; c < 2; c++) out[c].set(back.channelData[c].subarray(0, n))
  return out
}
const vocals = restore(stems.vocals)
const instrumental = restore(instr)

// 7. peak safety (same policy as the app encoder) + 16-bit wav + mp3
function writeWavMp3(chs, wavPath, mp3Path) {
  let peak = 0
  for (const ch of chs) for (let i = 0; i < ch.length; i++) { const a = Math.abs(ch[i]); if (a > peak) peak = a }
  if (peak > 0.999) { const g = 0.98 / peak; for (const ch of chs) for (let i = 0; i < ch.length; i++) ch[i] *= g }
  const n = chs[0].length
  const buf = Buffer.alloc(44 + n * 2 * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22)
  buf.writeUInt32LE(44100, 24); buf.writeUInt32LE(44100 * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40)
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) {
    const s = Math.max(-1, Math.min(1, chs[c][i]))
    buf.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), 44 + (i * 2 + c) * 2)
  }
  writeFileSync(wavPath, buf)
  runFfmpeg(['-y', '-i', wavPath, '-codec:a', 'libmp3lame', '-qscale:a', '2', mp3Path])
  return { peak: peak > 0.999 ? 0.98 : peak, samples: n }
}
const vocInfo = writeWavMp3(vocals, join(WORK, 'vocals.wav'), join(ROOT, `evidence/voice/realworld/output-track2-keep-vocal-demucs-${outPrefix}.mp3`))
const instInfo = writeWavMp3(instrumental, join(WORK, 'instrumental.wav'), join(ROOT, `evidence/voice/realworld/output-track2-remove-vocal-demucs-${outPrefix}.mp3`))
// bonus: the acapella WITHOUT the slow-back — vocals at natural pitch and
// tempo (x1.45 = the track's original ~160 BPM). Not what the app emits
// (the clip must stay timeline-aligned) but the most *usable* form for
// sampling/remixing, and the clearest listenable proof the vocals are real.
const natInfo = writeWavMp3(stems.vocals, join(WORK, 'vocals-natural.wav'), join(ROOT, `evidence/voice/realworld/output-track2-keep-vocal-naturalpitch-${outPrefix}.mp3`))
console.log(`wrote ${outPrefix} keep/remove/natural-pitch MP3s (vocals peak ${vocInfo.peak.toFixed(3)}, ${vocInfo.samples} samples = exact input length: ${vocInfo.samples === nOrig}; natural-pitch ${(natInfo.samples / 44100).toFixed(1)}s)`)
console.log(`total ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min`)
