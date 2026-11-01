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
const output = path.join(outDir, 'RDT_recopy2.mp4')
const fps = 24
const durations = [3.4, 3.4, 3.7, 3.4, 3.6, 3.5, 4.06]
const sourceStarts = [20, 48, 72, 104, 132, 165, 200]
const titles = ['ALL DARK', 'BLUE', 'NO ONE', 'ROCKWELL', 'MOMENT', 'UNDER', 'COVERS']
const curves = ['ease-out-back', 'velocity-spike', 'hold-then-go', 'ease-in-out-cubic', 'ramp-hold-ramp', 'expo-out', 'sine-in-out']
const total = durations.reduce((sum, value) => sum + value, 0)

const backgroundLooks = [
  { blur: 17, brightness: 0.55, contrast: 1.24, saturation: 0.88, vignette: 0.62, grain: 0.09 },
  { blur: 12, brightness: 0.64, contrast: 1.08, saturation: 1.42, hueRotate: 12, vignette: 0.36, glow: 0.12 },
  { blur: 19, brightness: 0.48, contrast: 1.35, saturation: 0.72, chromatic: 0.08, scanlines: 0.11 },
  { blur: 10, brightness: 0.66, contrast: 1.18, saturation: 1.05, sepia: 0.14, grain: 0.18 },
  { blur: 15, brightness: 0.58, contrast: 1.42, saturation: 1.32, zoomBlur: 0.11, vignette: 0.48 },
  { blur: 20, brightness: 0.52, contrast: 1.12, saturation: 0.82, directionalBlur: 0.09, directionalBlurAngle: 90, grain: 0.13 },
  { blur: 13, brightness: 0.62, contrast: 1.28, saturation: 1.18, hueRotate: -8, vignette: 0.55, flare: 0.08 },
]
const foregroundLooks = [
  { contrast: 1.18, saturation: 1.12, directionalBlur: 0.06, directionalBlurAngle: 90, motionBlur: 0.22 },
  { brightness: 1.05, contrast: 1.12, saturation: 1.36, hueRotate: 8, zoomBlur: 0.08, motionBlur: 0.14 },
  { contrast: 1.32, saturation: 0.84, chromatic: 0.11, grain: 0.12, motionBlur: 0.28 },
  { brightness: 0.96, contrast: 1.22, saturation: 1.02, sepia: 0.08, directionalBlur: 0.05, directionalBlurAngle: 32 },
  { brightness: 1.06, contrast: 1.38, saturation: 1.28, zoomBlur: 0.12, chromatic: 0.04 },
  { brightness: 1.03, contrast: 1.16, saturation: 0.92, directionalBlur: 0.12, directionalBlurAngle: 90, motionBlur: 0.34 },
  { brightness: 1.02, contrast: 1.26, saturation: 1.18, hueRotate: -5, grain: 0.07, motionBlur: 0.18 },
]
// Reference inspection: the title cores are brighter than the underlying band,
// which is consistent with Screen. Color Burn is retained as a short entrance
// or on two darker titles so the comparison remains visible in the final edit.
const settledBlend = ['screen', 'screen', 'color-burn', 'screen', 'screen', 'color-burn', 'screen']

fs.mkdirSync(path.join(outDir, 'scene_clips'), { recursive: true })
if (!fs.existsSync(source) || !fs.existsSync(reference)) throw new Error('Required RDT reference/source footage is missing')
const call = async (tool, params = {}) => {
  const result = await registry.call(tool, params)
  if (!result.ok) throw new Error(`${tool}: ${JSON.stringify(result.data)}`)
  return result.data
}

for (let i = 0; i < sourceStarts.length; i++) {
  const target = path.join(outDir, 'scene_clips', `gojo-${i + 1}.mp4`)
  if (!fs.existsSync(target)) execFileSync(ffmpegExe(), ['-y', '-v', 'error', '-ss', String(sourceStarts[i]), '-i', source, '-t', '5', '-vf', 'scale=960:-2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-c:a', 'aac', '-b:a', '128k', target])
}

await call('project_new', { w: 360, h: 640, fps, duration: total, bg: '#05060c' })
let cursor = 0
const authored = []
for (let i = 0; i < durations.length; i++) {
  const duration = durations[i]
  const scene = path.join(outDir, 'scene_clips', `gojo-${i + 1}.mp4`)

  const background = await call('import_video', { path: scene, fps, fit: 'cover' })
  await call('clip_move_time', { clipId: background.clipId, start: cursor })
  await call('clip_stretch', { clipId: background.clipId, duration })
  await call('edit_element', { clipId: background.clipId, patch: { volume: 0.2, effects: backgroundLooks[i] } })

  const foreground = await call('import_video', { path: scene, fps, fit: 'contain' })
  await call('clip_move_time', { clipId: foreground.clipId, start: cursor })
  await call('clip_stretch', { clipId: foreground.clipId, duration })
  await call('edit_element', { clipId: foreground.clipId, patch: { volume: 0, speedCurve: curves[i], effects: foregroundLooks[i] } })
  await call('select', { clipId: foreground.clipId })
  const startScale = i % 2 ? 1.08 : 0.92
  const endScale = i % 2 ? 0.96 : 1.1
  for (const channel of ['X', 'Y']) {
    await call('keyframe_set', { property: 'scale', channel, time: 0, value: startScale, interpolation: 'back-out' })
    await call('keyframe_set', { property: 'scale', channel, time: duration, value: endScale, interpolation: 'ease-in-out' })
  }
  await call('keyframe_set', { property: 'position', channel: 'X', time: 0, value: i % 2 ? -18 : 18, interpolation: 'ease-out' })
  await call('keyframe_set', { property: 'position', channel: 'X', time: duration, value: i % 2 ? 12 : -12, interpolation: 'ease-in-out' })

  const title = await call('create_text', { text: titles[i], preset: 'plain', x: 0, y: i % 3 === 0 ? 10 : -4 })
  await call('clip_move_time', { clipId: title.clipId, start: cursor })
  await call('clip_stretch', { clipId: title.clipId, duration })
  await call('edit_element', { clipId: title.clipId, patch: { textStyle: {
    fontFamily: 'Inter, sans-serif', fontSize: i === 3 ? 50 : 56, bold: true,
    letterSpacing: i % 2 ? 3.5 : 2.2, color: '#f4f7ff',
    shadowMode: 'outer', shadowColor: '#05020b', shadowBlur: i % 2 ? 3 : 7,
    glowColor: i % 2 ? '#64ddff' : '#b88aff', glowBlur: i % 2 ? 3 : 5,
  } } })
  await call('text_crop_video', {
    clipId: title.clipId, video: scene, invert: true,
    // Negative footage tends to be highlight-heavy. Pull it down before the
    // blend so scene detail remains visible instead of reading as white type.
    brightness: 0.48 + (i % 3) * 0.07, contrast: 1.58 + (i % 2) * 0.18,
    saturation: i % 2 ? 2.15 : 1.85, baseAlpha: 0,
    blendMode: settledBlend[i],
  })
  await call('select', { clipId: title.clipId })
  const entranceBlend = settledBlend[i] === 'screen' ? 'color-burn' : 'screen'
  await call('blend_set', { mode: entranceBlend, time: 0 })
  await call('blend_set', { mode: settledBlend[i], time: 0.16 + (i % 2) * 0.05 })
  for (const [time, value, interpolation] of [[0, 0, 'constant'], [0.06, 0, 'constant'], [0.2, 1, 'back-out'], [duration - 0.15, 1, 'linear'], [duration, 0, 'ease-in']]) {
    await call('keyframe_set', { property: 'opacity', time, value, interpolation })
  }
  const textStart = i % 2 ? 1.28 : 0.46
  for (const channel of ['X', 'Y']) {
    await call('keyframe_set', { property: 'scale', channel, time: 0, value: textStart, interpolation: 'back-out' })
    await call('keyframe_set', { property: 'scale', channel, time: 0.22, value: i % 2 ? 0.92 : 1.13, interpolation: 'back-out' })
    await call('keyframe_set', { property: 'scale', channel, time: 0.48, value: 1, interpolation: 'ease-in-out' })
  }
  if (i % 2) {
    await call('keyframe_set', { property: 'rotation', channel: 'Z', time: 0, value: -4, interpolation: 'back-out' })
    await call('keyframe_set', { property: 'rotation', channel: 'Z', time: 0.48, value: 0, interpolation: 'ease-in-out' })
  }

  authored.push({
    index: i + 1, sourceStart: sourceStarts[i], timelineStart: cursor, duration,
    speedCurve: curves[i], title: titles[i], backgroundLook: backgroundLooks[i], foregroundLook: foregroundLooks[i],
    textCrop: { video: scene, negative: true, entranceBlend, settledBlend: settledBlend[i] },
    clips: { background: background.clipId, foreground: foreground.clipId, text: title.clipId },
  })
  cursor += duration
}

await call('snapshot', { time: 8.2, out: 'new_work_qa/RDT_recopy2-preview.png' })
await call('timeline_screenshot', { playhead: 8.2, out: 'new_work_qa/RDT_recopy2-timeline.png' })
const exported = await call('render_export', { out: 'new_work_qa/RDT_recopy2.mp4', fps, duration: total, audio: true })
const dump = await call('data_dump', { withImages: false })
const decoded = execFileSync(ffmpegExe(), ['-v', 'error', '-i', output, '-map', '0:v:0', '-f', 'framemd5', '-'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).split('\n').filter((line) => line && !line.startsWith('#'))
const hashes = new Set(decoded.map((line) => line.split(',').at(-1).trim()))
if (decoded.length < 590 || hashes.size < 400) throw new Error(`RDT text-crop export validation failed: ${decoded.length} frames, ${hashes.size} distinct`)
execFileSync(ffmpegExe(), ['-y', '-v', 'error', '-i', output, '-vf', 'fps=1/3,scale=180:-2,tile=3x3', '-frames:v', '1', path.join(outDir, 'RDT_recopy2-review.png')])
const manifest = {
  output: path.relative(root, output),
  classification: 'Independent second recreation using separate Gojo scene footage. Text uses duplicated negative scene footage cropped inside glyphs; the finished reference is analysis-only.',
  blendInference: 'Screen best matches the bright title cores visible in the reference samples. Color Burn is used for two darker titles and as a short keyed entrance for the other titles; Linear Burn is not claimed because Canvas has no native Linear Burn compositor in this build.',
  reference: { path: path.relative(root, reference), sha256: createHash('sha256').update(fs.readFileSync(reference)).digest('hex') },
  source: { path: source, sha256: createHash('sha256').update(fs.readFileSync(source)).digest('hex') },
  authored,
  workflow: ['project_new', 'import_video', 'clip_move_time', 'clip_stretch', 'edit_element', 'text_crop_video', 'blend_set', 'keyframe_set', 'snapshot', 'timeline_screenshot', 'render_export', 'data_dump'],
  validation: { width: 360, height: 640, fps, duration: total, decodedFrames: decoded.length, distinctFrameHashes: hashes.size, outputBytes: fs.statSync(output).size, audioTracks: exported.audio?.tracks ?? 0 },
  project: { mode: dump.mode, sequence: dump.sequence, selection: dump.selection, clips: dump.clips },
}
fs.writeFileSync(path.join(outDir, 'RDT_recopy2-manifest.json'), JSON.stringify(manifest, null, 2))
console.log(JSON.stringify(manifest.validation))
