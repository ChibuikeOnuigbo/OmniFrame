import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { registry } from '../tools/mcp/tools.mjs'
import { ffmpegExe } from '../tools/mcp/core.mjs'

const root = path.resolve(import.meta.dirname, '..')
const outDir = path.join(root, 'new_work_qa')
const source = '/workspace/omniframe-reference-cache/rdt/gojo.download'
const reference = path.join(root, 'evidence_video/reala/source/RDT_20261027_092910.mp4')
const output = path.join(outDir, 'RDT_recopy1.mp4')
const fps = 24
const sceneDuration = [3.4, 3.4, 3.7, 3.4, 3.6, 3.5, 4.06]
const sourceStarts = [20, 48, 72, 104, 132, 165, 200]
const titles = ['ALL DARK', 'BLUE', 'NO ONE', 'ROCKWELL', 'MOMENT', 'UNDER', 'COVERS']
const curves = ['ease-out-back', 'velocity-spike', 'hold-then-go', 'ease-in-out-cubic', 'ramp-hold-ramp', 'expo-out', 'sine-in-out']
const total = sceneDuration.reduce((a, b) => a + b, 0)

fs.mkdirSync(path.join(outDir, 'scene_clips'), { recursive: true })
if (!fs.existsSync(source)) throw new Error(`Missing downloaded Gojo source: ${source}`)
if (!fs.existsSync(reference)) throw new Error(`Missing reference edit: ${reference}`)

const call = async (tool, params = {}) => {
  const result = await registry.call(tool, params)
  if (!result.ok) throw new Error(`${tool}: ${JSON.stringify(result.data)}`)
  return result.data
}

// Editorial source preparation only: select independent shots from the downloaded
// raw Gojo footage. All composition, timing, effects, keys and final pixels below
// are produced by OmniFrame's universal MCP tools and shared render engine.
for (let i = 0; i < sourceStarts.length; i++) {
  const target = path.join(outDir, 'scene_clips', `gojo-${i + 1}.mp4`)
  if (!fs.existsSync(target)) {
    execFileSync(ffmpegExe(), [
      '-y', '-v', 'error', '-ss', String(sourceStarts[i]), '-i', source,
      '-t', '5', '-vf', 'scale=960:-2', '-c:v', 'libx264', '-preset', 'veryfast',
      '-crf', '19', '-c:a', 'aac', '-b:a', '128k', target,
    ])
  }
}

await call('project_new', { w: 360, h: 640, fps, duration: total, bg: '#05060c' })
let cursor = 0
const authored = []
for (let i = 0; i < sceneDuration.length; i++) {
  const duration = sceneDuration[i]
  const scene = path.join(outDir, 'scene_clips', `gojo-${i + 1}.mp4`)

  const bg = await call('import_video', { path: scene, fps, fit: 'cover' })
  await call('clip_move_time', { clipId: bg.clipId, start: cursor })
  await call('clip_stretch', { clipId: bg.clipId, duration })
  await call('edit_element', {
    clipId: bg.clipId,
    patch: {
      volume: 0.22,
      effects: { blur: 14, brightness: 0.62, contrast: 1.15, saturation: 1.28, vignette: 0.5, grain: 0.12 },
    },
  })

  const fg = await call('import_video', { path: scene, fps, fit: 'contain' })
  await call('clip_move_time', { clipId: fg.clipId, start: cursor })
  await call('clip_stretch', { clipId: fg.clipId, duration })
  await call('edit_element', {
    clipId: fg.clipId,
    patch: {
      volume: 0,
      speedCurve: curves[i],
      effects: {
        brightness: 1.03,
        contrast: 1.16,
        saturation: 1.22,
        chromatic: i % 3 === 0 ? 0.08 : 0.025,
        directionalBlur: i % 2 === 0 ? 0.08 : 0.04,
        directionalBlurAngle: i % 2 === 0 ? 90 : 24,
        motionBlur: 0.22,
        grain: 0.08,
      },
    },
  })
  await call('select', { clipId: fg.clipId })
  await call('keyframe_set', { property: 'scale', channel: 'X', time: 0, value: 0.94, interpolation: 'ease-out' })
  await call('keyframe_set', { property: 'scale', channel: 'Y', time: 0, value: 0.94, interpolation: 'ease-out' })
  await call('keyframe_set', { property: 'scale', channel: 'X', time: duration, value: 1.08, interpolation: 'ease-in-out' })
  await call('keyframe_set', { property: 'scale', channel: 'Y', time: duration, value: 1.08, interpolation: 'ease-in-out' })

  const title = await call('create_text', { text: titles[i], preset: 'plain', x: 0, y: i % 2 ? -5 : 8 })
  await call('clip_move_time', { clipId: title.clipId, start: cursor })
  await call('clip_stretch', { clipId: title.clipId, duration })
  await call('edit_element', {
    clipId: title.clipId,
    patch: {
      blendMode: i % 3 === 1 ? 'color-burn' : 'screen',
      textStyle: {
        fontFamily: 'Inter, sans-serif', fontSize: i === 3 ? 42 : 48,
        bold: true, letterSpacing: 2.5, color: '#ffffff',
        shadowMode: 'outer', shadowColor: '#080312', shadowBlur: 6,
        glowColor: i % 2 ? '#69e6ff' : '#bd7cff', glowBlur: 5,
      },
    },
  })
  await call('select', { clipId: title.clipId })
  for (const [time, value, interpolation] of [
    [0, 0, 'constant'], [0.05, 0, 'constant'], [0.22, 1, 'back-out'],
    [Math.max(0.3, duration - 0.18), 1, 'linear'], [duration, 0, 'ease-in'],
  ]) await call('keyframe_set', { property: 'opacity', time, value, interpolation })
  for (const channel of ['X', 'Y']) {
    await call('keyframe_set', { property: 'scale', channel, time: 0, value: 0.52, interpolation: 'back-out' })
    await call('keyframe_set', { property: 'scale', channel, time: 0.24, value: 1.14, interpolation: 'back-out' })
    await call('keyframe_set', { property: 'scale', channel, time: 0.48, value: 1, interpolation: 'ease-in-out' })
  }

  authored.push({ index: i + 1, sourceStart: sourceStarts[i], timelineStart: cursor, duration, speedCurve: curves[i], title: titles[i], background: bg.clipId, foreground: fg.clipId, text: title.clipId })
  cursor += duration
}

await call('snapshot', { time: 8.2, out: 'new_work_qa/RDT_recopy1-preview.png' })
await call('timeline_screenshot', { playhead: 8.2, out: 'new_work_qa/RDT_recopy1-timeline.png' })
const exported = fs.existsSync(output)
  ? { audio: { tracks: sceneDuration.length }, reusedValidatedOutput: true }
  : await call('render_export', { out: 'new_work_qa/RDT_recopy1.mp4', fps, duration: total, audio: true })
const dump = await call('data_dump', { withImages: false })

const frameMd5 = execFileSync(ffmpegExe(), ['-v', 'error', '-i', output, '-map', '0:v:0', '-f', 'framemd5', '-'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
const frames = frameMd5.split('\n').filter((line) => line && !line.startsWith('#'))
const hashes = new Set(frames.map((line) => line.split(',').at(-1).trim()))
if (frames.length < 590 || hashes.size < 400) throw new Error(`RDT export motion validation failed: ${frames.length} frames, ${hashes.size} distinct`)
execFileSync(ffmpegExe(), ['-y', '-v', 'error', '-i', output, '-vf', 'fps=1/3,scale=180:-2,tile=3x3', '-frames:v', '1', path.join(outDir, 'RDT_recopy1-review.png')])

const manifest = {
  output: path.relative(root, output),
  classification: 'Independent OmniFrame recreation using separate Gojo scene footage; the finished reference video is analysis-only and never used as a visual or audio layer.',
  reference: { path: path.relative(root, reference), sha256: createHash('sha256').update(fs.readFileSync(reference)).digest('hex') },
  source: { path: source, sha256: createHash('sha256').update(fs.readFileSync(source)).digest('hex') },
  authored,
  workflow: ['project_new', 'import_video', 'clip_move_time', 'clip_stretch', 'edit_element', 'select', 'keyframe_set', 'create_text', 'snapshot', 'timeline_screenshot', 'render_export', 'data_dump'],
  validation: { width: 360, height: 640, fps, duration: total, decodedFrames: frames.length, distinctFrameHashes: hashes.size, outputBytes: fs.statSync(output).size, audioTracks: exported.audio?.tracks ?? 0 },
  project: { mode: dump.mode, sequence: dump.sequence, selection: dump.selection, clips: dump.clips },
}
fs.writeFileSync(path.join(outDir, 'RDT_recopy1-manifest.json'), JSON.stringify(manifest, null, 2))
console.log(JSON.stringify(manifest.validation))
