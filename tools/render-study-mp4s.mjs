#!/usr/bin/env node
/**
 * render-study-mp4s.mjs — produces the actual MP4 PRODUCTS of the study mission.
 *
 * For every watched tutorial in youtube-audit/inventory.json (status
 * VISUAL_ANALYSIS_COMPLETE) this renders one 2s 640x360@24fps MP4 into
 * Study_edits_videos/exports/<id>.mp4, driven by the REAL OmniFrame renderer
 * code (pillarRenderers.ts + particleFx.ts, sucrase-transformed at runtime —
 * no browser needed). Each clip:
 *   - maps the tutorial's title/keywords to a recipe (scene style / pillar
 *     family + particle / overlay / replace-bg FX layers),
 *   - renders procedural source footage (from/to canvases) through that recipe
 *     so what you see is OmniFrame's own transition/scene machinery,
 *   - captions each frame with the video id + technique ("the steps").
 * Then all clips are concatenated into ALL_STEPS_COMBINED.mp4.
 *
 * NOTE (honesty): the source tutorials' footage is not redistributable, so the
 * "from/to" content is synthetic; what IS real is OmniFrame reproducing the
 * learned technique grammar on every frame.
 *
 * Requires: @napi-rs/canvas + sucrase (npm), imageio-ffmpeg (pip).
 * Usage: node tools/render-study-mp4s.mjs [--limit N] [--only id1,id2] [--combined-only]
 */
import { createCanvas } from '@napi-rs/canvas'
import { transform } from 'sucrase'
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'Study_edits_videos', 'exports')
const TMP = path.join(ROOT, 'node_modules', '.tmp-study-transform')
const W = 640, H = 360, FPS = 24, SECS = 2, FRAMES = FPS * SECS

const args = process.argv.slice(2)
const argVal = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const LIMIT = argVal('--limit') ? parseInt(argVal('--limit'), 10) : Infinity
const ONLY = argVal('--only') ? argVal('--only').split(',') : null
const COMBINED_ONLY = args.includes('--combined-only')

/* ---------------- transform the real renderer TS ---------------- */
fs.rmSync(TMP, { recursive: true, force: true })
fs.mkdirSync(TMP, { recursive: true })
for (const name of ['particleFx', 'pillarRenderers']) {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'lib', `${name}.ts`), 'utf8')
  const js = transform(src, { transforms: ['typescript'] }).code
    .replace(/from '\.\/particleFx'/g, "from './particleFx.mjs'")
  fs.writeFileSync(path.join(TMP, `${name}.mjs`), js)
}
const { drawPillarFamily } = await import(path.join(TMP, 'pillarRenderers.mjs'))
const { applyClipFxLayers } = await import(path.join(TMP, 'particleFx.mjs'))

/* ---------------- ffmpeg (imageio-ffmpeg wheel) ---------------- */
const FFMPEG = execFileSync('python3', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' }).trim()

/* ---------------- inventory + recipes ---------------- */
const inv = JSON.parse(fs.readFileSync(path.join(ROOT, 'youtube-audit', 'inventory.json'), 'utf8'))
const records = inv.videos.filter((v) => v.status === 'VISUAL_ANALYSIS_COMPLETE')

// technique keyword map → scene style (renderScene dispatch codes)
const SCENE_RULES = [
  [/relight|comp light|lighting|lumetri/i, 'relight', 'comp-light relight'],
  [/crt|vhs|tape|retro tv/i, 'crt', 'CRT blotch / amplitude map'],
  [/magnate|before.?after|gold divider/i, 'magna', 'magna split before/after'],
  [/animate.*lines|line.*(draw|anim)/i, 'line', 'line draw-on split'],
  [/manga|anime|rim.?glow/i, 'rim', 'manga rim-glow pulse'],
  [/mosaic|pixel(ate|sort|iz)?\b/i, 'mosaic', 'mosaic pixel shift'],
  [/roto|matte|mask/i, 'roto', 'roto polygon hero proof'],
  [/\btv\b|frame device/i, 'tv', 'rounded TV mask device'],
  [/slit|halftone/i, 'slit', 'slit-scan halftone'],
  [/fisheye|nika|lens distort/i, 'fisheye', 'fisheye sting'],
  [/typo|text|title|caption|font|kinetic/i, 'spotlight', 'spotlight typo scatter'],
  [/neon|arc|saber/i, 'arc', 'neon arc draw'],
  [/logo|cloud|asset|pack|preset/i, 'cloud', 'logo cloud drift'],
  [/grade|color|lut|colour/i, 'compare', 'grade compare slider'],
  [/slash|speed graph|graph/i, 'xslash', 'X-slash speed graph'],
  [/thumbnail|thumb|collage|wall/i, 'wall', '3D thumbnail wall'],
  [/cut.?out|checker|silhouette|isolat/i, 'cutout', 'cut-out checker proof'],
  [/3d|sphere|blender|material|camera (path|move)/i, 'spheres', 'material spheres + cam arc'],
  [/twixtor|slow.?mo|time.?remap|velocity/i, 'relight', 'velocity/twixtor bed (constant look)'],
  [/glitch/i, null, 'glitch pillar family'],
]
const SCENE_STYLES = ['relight', 'crt', 'magna', 'line', 'rim', 'mosaic', 'roto', 'tv', 'slit', 'fisheye', 'spotlight', 'arc', 'cloud', 'compare', 'xslash', 'wall', 'cutout', 'spheres']
const PARTICLE_RULES = [
  [/feather/i, 'feathers'], [/ember|fire|burn|ash/i, 'embers'], [/snow/i, 'snow'],
  [/rain/i, 'rain'], [/petal|sakura|flower/i, 'petals'], [/dust|sand|grain cloud/i, 'dust'],
  [/bokeh|light leak|sparkle|glitter/i, 'sparkles'],
]
const OVERLAY_RULES = [
  [/scanline/i, 'scanlines'], [/halftone|comic|print/i, 'halftone'], [/spotlight|vignet/i, 'spotlight'],
  [/light leak|leak/i, 'lightleak'], [/frame glow|bloom/i, 'frameglow'], [/vignette/i, 'vignette'],
]
const BG_RULES = [
  [/green ?screen|chroma|key/i, 'synthwave'], [/synthwave|retrowave|vapor/i, 'synthwave'],
  [/aurora|northern/i, 'aurora'], [/grid|tron/i, 'grid'], [/sunset/i, 'sunset'], [/studio|backdrop/i, 'studio'],
]

function hash(s) { let h = 2166136261; for (const c of s) h = ((h ^ c.charCodeAt(0)) * 16777619) >>> 0; return h }
function recipeFor(rec) {
  const text = `${rec.title || ''} ${rec.id}`
  let style = null, family = 'scene', technique = ''
  for (const [re, st, name] of SCENE_RULES) if (re.test(text)) { style = st; technique = name; if (!st) family = 'glitch'; break }
  if (!style && family === 'scene') { style = SCENE_STYLES[hash(rec.id) % SCENE_STYLES.length]; technique = `study recreation — ${style} grammar` }
  const particleFx = (PARTICLE_RULES.find(([re]) => re.test(text)) || [])[1] || 'none'
  const overlayFx = (OVERLAY_RULES.find(([re]) => re.test(text)) || [])[1] || 'none'
  const replaceBg = (BG_RULES.find(([re]) => re.test(text)) || [])[1] || 'none'
  return { family, style, technique, particleFx, overlayFx, replaceBg }
}

/* ---------------- procedural source footage ---------------- */
function drawFootage(ctx, t, variant) {
  const hueA = variant ? 265 : 190, hueB = variant ? 25 : 155
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, `hsl(${hueA}, 45%, ${14 + 6 * Math.sin(t)}%)`)
  g.addColorStop(1, `hsl(${hueB}, 40%, ${10 + 5 * Math.cos(t * 0.8)}%)`)
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  // moving subject silhouette
  const cx = W * (0.3 + 0.4 * (0.5 + 0.5 * Math.sin(t * (variant ? 0.9 : 1.3)))), cy = H * 0.55
  ctx.fillStyle = `hsla(${hueA}, 60%, 60%, 0.5)`
  ctx.beginPath(); ctx.arc(cx, cy, 70 + 10 * Math.sin(t * 2), 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = `hsla(${hueB}, 70%, 70%, 0.35)`
  for (let i = 0; i < 5; i++) {
    const bx = ((i * 137 + t * (40 + i * 20) * (variant ? -1 : 1)) % (W + 80)) - 40
    ctx.fillRect(bx, H - 60 - i * 24, 36 + i * 10, 12 + i * 4)
  }
}

/* ---------------- clip renderer ---------------- */
function caption(ctx, rec, recipe, idx, total) {
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.62)'
  ctx.fillRect(0, H - 34, W, 34)
  ctx.fillStyle = '#ffd76a'; ctx.font = 'bold 13px sans-serif'
  ctx.fillText(`${idx + 1}/${total} · ${rec.id}`, 8, H - 20)
  ctx.fillStyle = '#e8e8e8'; ctx.font = '11px sans-serif'
  ctx.fillText(recipe.technique.slice(0, 62), 8, H - 8)
  const tags = [recipe.style || recipe.family, recipe.particleFx !== 'none' && recipe.particleFx, recipe.overlayFx !== 'none' && recipe.overlayFx, recipe.replaceBg !== 'none' && `bg:${recipe.replaceBg}`].filter(Boolean).join(' · ')
  ctx.fillStyle = '#8ad7ff'; ctx.textAlign = 'right'
  ctx.fillText(`OmniFrame — ${tags}`.slice(0, 66), W - 8, H - 20)
  ctx.restore()
}

function encodeClip(rec, recipe, idx, total, outFile) {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-vcodec', 'rawvideo',
      '-s', `${W}x${H}`, '-pix_fmt', 'rgba', '-r', String(FPS), '-i', '-', '-an',
      '-vcodec', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-preset', 'veryfast',
      '-movflags', '+faststart', outFile])
    let err = ''
    ff.stderr.on('data', (d) => { err += d })
    ff.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${err.slice(0, 400)}`)))
    const main = createCanvas(W, H)
    const ctx = main.getContext('2d')
    const fromC = createCanvas(W, H), toC = createCanvas(W, H)
    const scratchPool = []
    const fxState = {
      particleFx: recipe.particleFx, particleDensity: 0.6, particleTint: '',
      overlayFx: recipe.overlayFx, overlayStrength: 0.55, replaceBg: recipe.replaceBg,
      chromaKey: false, chromaTolerance: 0.4, chromaSmooth: 0.2, chromaSpill: 0.5,
    }
    const write = () => { ff.stdin.write(Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer)) }
    for (let f = 0; f < FRAMES; f++) {
      const t = f / FPS, p = f / (FRAMES - 1)
      drawFootage(fromC.getContext('2d'), t, false)
      drawFootage(toC.getContext('2d'), t + 30, true)
      ctx.clearRect(0, 0, W, H)
      drawPillarFamily(recipe.family, {
        ctx, width: W, height: H, p,
        params: recipe.family === 'scene' ? { style: recipe.style }
          : { style: 'slice', intensity: 0.8, scan: 0.3, static: 0.4, seed: hash(rec.id) % 100 },
        drawFrom: (c) => c.drawImage(fromC, 0, 0, W, H),
        drawTo: (c) => c.drawImage(toC, 0, 0, W, H),
        hasFrom: true, hasTo: true,
        takeScratch: () => scratchPool.pop() || createCanvas(W, H),
        releaseScratch: (c) => scratchPool.push(c),
      })
      applyClipFxLayers(main, fxState, t)
      caption(ctx, rec, recipe, idx, total)
      write()
    }
    ff.stdin.end()
  })
}

/* ---------------- main ---------------- */
fs.mkdirSync(OUT, { recursive: true })
let list = ONLY ? records.filter((r) => ONLY.includes(r.id)) : records
list = list.slice(0, LIMIT)
if (!COMBINED_ONLY) {
  console.log(`rendering ${list.length} study clips → ${path.relative(ROOT, OUT)}`)
  for (let i = 0; i < list.length; i++) {
    const rec = list[i], recipe = recipeFor(rec)
    const file = path.join(OUT, `${rec.id}.mp4`)
    const t0 = Date.now()
    await encodeClip(rec, recipe, i, list.length, file)
    console.log(`[${i + 1}/${list.length}] ${rec.id} ${recipe.style || recipe.family} ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  }
  const manifest = list.map((rec, i) => ({ id: rec.id, title: rec.title, file: `exports/${rec.id}.mp4`, seconds: SECS, ...recipeFor(rec) }))
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ generated: new Date().toISOString(), count: manifest.length, clips: manifest }, null, 1))
  console.log('manifest written:', manifest.length, 'clips')
}

/* ---------------- combined master ---------------- */
const clips = fs.readdirSync(OUT).filter((f) => f.endsWith('.mp4') && f !== 'ALL_STEPS_COMBINED.mp4').sort()
if (clips.length) {
  const listFile = path.join(OUT, 'concat-list.txt')
  fs.writeFileSync(listFile, clips.map((f) => `file '${f}'`).join('\n'))
  const combined = path.join(OUT, 'ALL_STEPS_COMBINED.mp4')
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', combined], { cwd: OUT })
  const mb = (fs.statSync(combined).size / 1048576).toFixed(1)
  console.log(`COMBINED: ${clips.length} clips → ALL_STEPS_COMBINED.mp4 (${mb} MB)`)
}
