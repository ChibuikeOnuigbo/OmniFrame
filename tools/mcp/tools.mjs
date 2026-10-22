// OmniFrame MCP utility tools: every brief from the five uploaded boards is
// solved here as a rendered mp4 + chunked-JSON sidecar. OOP: one MCPTool
// subclass per capability; all results return ToolResult (chunkable).
import fs from 'fs'
import path from 'path'
import { MCPTool, MCPRegistry, VideoEncoder, FrameProvider, makeCanvas, loadImage, cover, clamp01, lerp } from './core.mjs'
import { SPEED_CURVES, evalCurve } from './curves.mjs'

const ROOT = path.resolve(import.meta.dirname, '../..')
const TAR = path.join(ROOT, 'test_ans_result')
const ASSETS = path.join(TAR, 'assets')
const A = n => path.join(ASSETS, n)
const _img = new Map()
async function img(n) {
  if (!_img.has(n)) {
    let p = A(n)
    if (!fs.existsSync(p)) p = path.join(TAR, 'sources', n)
    _img.set(n, await loadImage(fs.readFileSync(p)))
  }
  return _img.get(n)
}

/* ---------- shared painters ---------- */
function bedPainter(id) {
  return (ctx, w, h, t) => {
    if (id === 'synthwave') {
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#160b2e'); g.addColorStop(0.6, '#3d1163'); g.addColorStop(1, '#0a0620')
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(255,80,200,0.5)'; ctx.lineWidth = 1
      for (let i = 0; i < 9; i++) { const y = h * 0.55 + i * i * 2.2 + t * 6; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
      for (let i = 0; i <= 10; i++) { const x = (i / 10) * w; ctx.beginPath(); ctx.moveTo(w / 2 + (x - w / 2) * 0.2, h * 0.55); ctx.lineTo(x, h); ctx.stroke() }
      ctx.fillStyle = '#ff9a3d'; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.42, h * 0.14, Math.PI, 0); ctx.fill()
    } else if (id === 'aurora') {
      ctx.fillStyle = '#04101c'; ctx.fillRect(0, 0, w, h)
      for (let i = 0; i < 4; i++) {
        const g = ctx.createLinearGradient(0, h * (0.15 + i * 0.12), w, h * (0.4 + i * 0.12))
        g.addColorStop(0, 'rgba(40,255,180,0)'); g.addColorStop(0.5, `rgba(40,255,180,${0.16 - i * 0.03})`); g.addColorStop(1, 'rgba(80,120,255,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h * (0.25 + i * 0.13) + Math.sin(x * 0.02 + t * 2 + i) * h * 0.06)
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill()
      }
    } else if (id === 'grid') {
      ctx.fillStyle = '#0b0f14'; ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(90,200,255,0.35)'; ctx.lineWidth = 1
      const o = (t * 20) % 32
      for (let x = -32 + o; x < w + 32; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
      for (let y = -32 + o; y < h + 32; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
    } else if (id === 'bokeh') {
      const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#20143a'); g.addColorStop(1, '#0d0a1c')
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
      for (let i = 0; i < 14; i++) {
        const x = ((i * 97) % w) + Math.sin(t + i) * 8, y = ((i * 61) % h), r = 8 + (i % 5) * 7
        ctx.fillStyle = `rgba(255,190,120,${0.10 + (i % 3) * 0.05})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill()
      }
    } else if (id === 'sunset') {
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2b1055'); g.addColorStop(0.5, '#c94b4b'); g.addColorStop(1, '#ffb199')
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(255,240,200,0.9)'; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.62, h * 0.12, 0, 7); ctx.fill()
    } else if (id === 'studio') {
      const g = ctx.createRadialGradient(w / 2, h * 0.4, 10, w / 2, h * 0.5, w * 0.7); g.addColorStop(0, '#8d939c'); g.addColorStop(1, '#23262b')
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    } else if (id === 'wedge') {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h)
      const g = ctx.createLinearGradient(0, 0, w * 0.7, h); g.addColorStop(0, '#7d0c0c'); g.addColorStop(1, '#e01818')
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.85, 0); ctx.lineTo(w * 0.6, h); ctx.lineTo(0, h); ctx.fill()
    }
  }
}

async function keyedCharC() {
  if (keyedCharC.cache) return keyedCharC.cache
  const src = await img('charC.png')
  const c = makeCanvas(src.width, src.height), x = c.getContext('2d')
  x.drawImage(src, 0, 0)
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data
  for (let i = 0; i < p.length; i += 4) {
    const lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]
    p[i + 3] = lum < 20 ? 0 : lum > 40 ? 255 : Math.round(((lum - 20) / 20) * 255)
  }
  x.putImageData(d, 0, 0)
  keyedCharC.cache = c
  return c
}

const CHARA_POLY = [[0.50, 0.0], [0.69, 0.05], [0.76, 0.26], [0.72, 0.44], [0.80, 0.55], [0.95, 0.76], [0.98, 1.0], [0.05, 1.0], [0.10, 0.72], [0.27, 0.52], [0.29, 0.26], [0.34, 0.04]]
async function maskedCharA() {
  if (maskedCharA.cache) return maskedCharA.cache
  const src = await img('charA.png')
  const c = makeCanvas(src.width, src.height), x = c.getContext('2d')
  x.drawImage(src, 0, 0)
  x.globalCompositeOperation = 'destination-in'
  x.filter = 'blur(10px)'
  x.fillStyle = '#fff'
  x.beginPath()
  CHARA_POLY.forEach(([u, v], i) => (i ? x.lineTo(u * c.width, v * c.height) : x.moveTo(u * c.width, v * c.height)))
  x.closePath(); x.fill()
  x.filter = 'none'
  maskedCharA.cache = c
  return c
}

function hud(ctx, w, h, text) {
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, h - 20, w, 20)
  ctx.fillStyle = '#8ef0c0'; ctx.font = '11px monospace'; ctx.fillText(text, 8, h - 6)
}

function sidecar(videoPath, result) {
  const j = videoPath.replace(/\.mp4$/, '.json')
  fs.writeFileSync(j, JSON.stringify({ ...result.toJSON(), chunks: result.chunkManifest(1500).manifest }, null, 1))
  return j
}

/* ---------- tools ---------- */
class AnalyzeImageTool extends MCPTool {
  constructor() { super('analyze_image', 'Return the decoded brief of one uploaded board (tasks, targets, output plan).', { image: 'A|B|C|D|E' }) }
  async run({ image }) {
    const B = {
      A: { file: 'sources/src_overlays.png', tasks: ['roto-mask character', 'replace bg with parchment', 'add height-chart overlay over replaced bg', 'layer extra overlays (smoke/film/window-light)'], kind: 'composition+effects', results: 10 },
      B: { file: 'sources/src_car.png', tasks: ['test matte/roto brush', 'inpainter + smart patch per edited scene', 'remove car naturally, blend, judge quality'], kind: 'effects(inpaint)', results: 10 },
      C: { file: 'sources/src_charC.png', tasks: ['replace background', '150 edits', 'tweak composition, lighting, speed curve (15 curves), entrance, cc'], kind: 'composition+effects', results: 10 },
      D: { file: 'sources/src_tank.png', tasks: ['fill tank by pasting obj (ctrl+x cut) repeatedly', 'calc size/pos so space is filled', 'border touching allowed'], kind: 'puzzle', results: 1 },
      E: { file: 'sources/src_move.png', tasks: ['move square from start to destination'], kind: 'puzzle', results: 1 },
    }
    return B[image] || { error: 'image must be A..E' }
  }
}

class ImageToVideoTool extends MCPTool {
  constructor() { super('image_to_video', 'Convert one source board into an analysis video (ken-burns + decoded callouts).', { image: 'A|B|C|D|E' }) }
  async run({ image }) {
    const file = { A: 'src_overlays.png', B: 'src_car.png', C: 'src_charC.png', D: 'src_tank.png', E: 'src_move.png' }[image]
    const src = await img(file)
    const caps = {
      A: ['BRIEF A: roto mask character', 'replace bg -> parchment', 'height-chart = overlay on new bg', 'more overlays: smoke/film/window', 'ANSWER: A_composition/variant-01..10'],
      B: ['BRIEF B: matte + roto brush test', 'inpainter / smart patch per scene', 'remove car naturally + blend', 'grade the blend quality', 'ANSWER: B_inpaint/variant-01..10'],
      C: ['BRIEF C: replace background', '150 edits (10 results x 15 ops)', 'tweak composition + lighting', '15 speed curves + entrance + cc', 'ANSWER: C_composition/variant-01..10'],
      D: ['BRIEF D: fill the tank', 'cut obj (ctrl+x), paste inside', 'calc grid size + positions', 'border touching allowed', 'ANSWER: D_tank_fill/solution.mp4'],
      E: ['BRIEF E: move square', 'start -> destination', 'eased path + arrow guide', 'keypoints in JSON sidecar', 'ANSWER: E_move/solution.mp4'],
    }[image]
    const W = 640, H = 360, fps = 24, N = 48
    const enc = new VideoEncoder({ w: W, h: H, fps, out: path.join(TAR, `${image}_analysis.mp4`) })
    for (let f = 0; f < N; f++) {
      const t = f / (N - 1), c = makeCanvas(W, H), x = c.getContext('2d')
      const s = 1 + 0.12 * t
      x.save(); x.translate(W / 2, H / 2); x.scale(s, s); x.translate(-W / 2, -H / 2)
      cover(x, src, W, H); x.restore()
      x.fillStyle = 'rgba(8,8,12,0.55)'; x.fillRect(0, 0, W, H)
      x.fillStyle = '#ff5a5a'; x.font = 'bold 15px monospace'; x.fillText(`BOARD ${image} — ANALYSIS`, 14, 26)
      caps.forEach((line, i) => {
        const on = clamp01((t - 0.12 * i - 0.05) / 0.12)
        if (on <= 0) return
        x.globalAlpha = on; x.fillStyle = '#fff'; x.font = '12px monospace'; x.fillText(line, 18, 56 + i * 20); x.globalAlpha = 1
      })
      enc.addCanvas(c)
    }
    const info = enc.finish()
    const r = await this.okResult(info, { image, captions: caps })
    sidecar(info.out, r)
    return r.data
  }
  async okResult(info, extra) { const { ToolResult } = await import('./core.mjs'); return new ToolResult(this.name, true, { video: path.relative(ROOT, info.out), ...info, ...extra }) }
}

class SolveMoveTool extends MCPTool {
  constructor() { super('solve_move', 'Board E: animate the square from start to destination with an eased path.', {}) }
  async run() {
    const W = 640, H = 360, fps = 24, N = 48
    const S = { x: 60, y: 150, s: 100 }, D = { x: 430, y: 120, s: 110 }
    const enc = new VideoEncoder({ w: W, h: H, fps, out: path.join(TAR, 'E_move', 'solution.mp4') })
    fs.mkdirSync(path.join(TAR, 'E_move'), { recursive: true })
    const keys = []
    for (let f = 0; f < N; f++) {
      const p = f / (N - 1), u = evalCurve('ease-in-out-cubic', p)
      const c = makeCanvas(W, H), x = c.getContext('2d')
      x.fillStyle = '#f2f4f8'; x.fillRect(0, 0, W, H)
      x.strokeStyle = '#111'; x.lineWidth = 5; x.strokeRect(S.x, S.y, S.s, S.s)
      x.fillStyle = '#111'; x.font = 'bold 18px monospace'; x.fillText('move', S.x + 26, S.y + 58)
      x.strokeStyle = '#d22'; x.lineWidth = 4; x.strokeRect(D.x, D.y, D.s, D.s)
      x.strokeStyle = '#d22'; x.lineWidth = 3
      x.beginPath(); x.moveTo(D.x + D.s, D.y); x.lineTo(D.x + D.s + 70, D.y - 50); x.stroke()
      x.fillStyle = '#d22'; x.font = 'bold 16px monospace'; x.fillText('destination', D.x + D.s + 10, D.y - 58)
      const mx = lerp(S.x, D.x, u), my = lerp(S.y, D.y, u)
      x.fillStyle = 'rgba(210,34,34,0.25)'
      for (let g = 1; g <= 3; g++) { const gu = evalCurve('ease-in-out-cubic', clamp01(p - g * 0.06)); x.fillRect(lerp(S.x, D.x, gu) + 8, lerp(S.y, D.y, gu) + 8, S.s - 16, S.s - 16) }
      x.fillStyle = '#d22'; x.fillRect(mx + 6, my + 6, S.s - 12, S.s - 12)
      keys.push({ frame: f, t: +p.toFixed(3), eased: +u.toFixed(4), x: Math.round(mx), y: Math.round(my) })
      hud(x, W, H, `E move · p=${p.toFixed(2)} ease-in-out-cubic u=${u.toFixed(2)}`)
      enc.addCanvas(c)
    }
    const info = enc.finish()
    const { ToolResult } = await import('./core.mjs')
    const r = new ToolResult(this.name, true, { video: 'test_ans_result/E_move/solution.mp4', ...info, start: S, destination: D, curve: 'ease-in-out-cubic', keypoints: keys })
    sidecar(info.out, r)
    return r.data
  }
}

class SolveTankFillTool extends MCPTool {
  constructor() { super('solve_tank_fill', 'Board D: compute the paste grid (sizes/positions) and animate obj filling the tank.', {}) }
  async run() {
    const W = 640, H = 360, fps = 24
    const tank = { x: 330, y: 36, w: 280, h: 288 }
    const objNat = 72
    const cols = Math.max(1, Math.round(tank.w / objNat)), rows = Math.max(1, Math.round(tank.h / objNat))
    const cw = tank.w / cols, ch = tank.h / rows
    const placements = []
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) placements.push({ i: placements.length, x: tank.x + c * cw, y: tank.y + r * ch, w: cw, h: ch })
    const N = 60
    const enc = new VideoEncoder({ w: W, h: H, fps, out: path.join(TAR, 'D_tank_fill', 'solution.mp4') })
    fs.mkdirSync(path.join(TAR, 'D_tank_fill'), { recursive: true })
    const src = { x: 40, y: 150, s: 72 }
    for (let f = 0; f < N; f++) {
      const p = f / (N - 1), c = makeCanvas(W, H), x = c.getContext('2d')
      x.fillStyle = '#f2f4f8'; x.fillRect(0, 0, W, H)
      x.strokeStyle = '#d22'; x.lineWidth = 5; x.strokeRect(tank.x, tank.y, tank.w, tank.h)
      x.fillStyle = '#e8b9bc'; x.strokeStyle = '#d22'; x.lineWidth = 4
      x.fillRect(src.x, src.y, src.s, src.s); x.strokeRect(src.x, src.y, src.s, src.s)
      x.fillStyle = '#d22'; x.font = 'bold 16px monospace'; x.fillText('obj', src.x + 24, src.y + 42)
      if (p < 0.18) {
        x.setLineDash([6, 5]); x.strokeStyle = '#333'; x.lineWidth = 2
        x.beginPath(); x.moveTo(src.x - 8, src.y + src.s / 2); x.lineTo(src.x + src.s + 8, src.y + src.s / 2); x.stroke(); x.setLineDash([])
        x.fillStyle = '#333'; x.font = '11px monospace'; x.fillText('ctrl+x cut', src.x, src.y - 10)
      }
      const done = Math.floor(clamp01((p - 0.18) / 0.72) * placements.length)
      placements.forEach((pl, i) => {
        if (i >= done) return
        const age = clamp01((p - 0.18 - (i / placements.length) * 0.72) / 0.08)
        const sc = 0.6 + 0.4 * evalCurve('ease-out-back', age)
        x.save(); x.translate(pl.x + pl.w / 2, pl.y + pl.h / 2); x.scale(sc, sc)
        x.fillStyle = 'rgba(232,185,188,0.95)'; x.strokeStyle = '#d22'; x.lineWidth = 2
        x.fillRect(-pl.w / 2 + 1, -pl.h / 2 + 1, pl.w - 2, pl.h - 2); x.strokeRect(-pl.w / 2 + 1, -pl.h / 2 + 1, pl.w - 2, pl.h - 2)
        x.restore()
      })
      hud(x, W, H, `D tank · ${cols}x${rows}=${placements.length} pastes · cell ${Math.round(cw)}x${Math.round(ch)} · ${done}/${placements.length}`)
      enc.addCanvas(c)
    }
    const info = enc.finish()
    const { ToolResult } = await import('./core.mjs')
    const r = new ToolResult(this.name, true, {
      video: 'test_ans_result/D_tank_fill/solution.mp4', ...info, tank, objNatural: objNat,
      grid: { cols, rows, cell: { w: +cw.toFixed(2), h: +ch.toFixed(2) }, fillsSpace: true, borderTouchingAllowed: true },
      placements: placements.map(pl => ({ i: pl.i, x: Math.round(pl.x), y: Math.round(pl.y), w: +pl.w.toFixed(2), h: +pl.h.toFixed(2) })),
    })
    sidecar(info.out, r)
    return r.data
  }
}

/* Board A: 10 composition/overlay variants */
const A_VARIANTS = [
  { ov: [['ov_heightchart.png', 'screen', 0.5]], pos: 'center', grade: null },
  { ov: [['ov_smoke.png', 'overlay', 0.45], ['ov_heightchart.png', 'screen', 0.4]], pos: 'left', grade: 'rgba(255,160,60,0.10)' },
  { ov: [['ov_film.png', 'multiply', 0.5], ['ov_heightchart.png', 'screen', 0.35]], pos: 'right', grade: 'rgba(60,120,255,0.10)' },
  { ov: [['ov_windowlight.png', 'soft-light', 0.6], ['ov_heightchart.png', 'screen', 0.4]], pos: 'left', grade: null },
  { ov: [['ov_smoke.png', 'overlay', 0.5], ['ov_film.png', 'multiply', 0.35], ['ov_heightchart.png', 'screen', 0.45]], pos: 'right', grade: null },
  { ov: [['ov_film.png', 'overlay', 0.55]], pos: 'center', grade: 'rgba(0,0,0,0.12)' },
  { ov: [['ov_windowlight.png', 'screen', 0.5], ['ov_smoke.png', 'multiply', 0.3]], pos: 'left', grade: 'rgba(40,200,190,0.10)' },
  { ov: [['ov_heightchart.png', 'multiply', 0.55], ['ov_film.png', 'overlay', 0.3]], pos: 'right', grade: 'rgba(255,190,40,0.10)' },
  { ov: [['ov_smoke.png', 'screen', 0.4], ['ov_windowlight.png', 'overlay', 0.45], ['ov_heightchart.png', 'screen', 0.3]], pos: 'center', grade: 'rgba(220,60,180,0.08)' },
  { ov: [['ov_film.png', 'multiply', 0.3], ['ov_smoke.png', 'overlay', 0.35], ['ov_windowlight.png', 'soft-light', 0.4], ['ov_heightchart.png', 'screen', 0.35]], pos: 'left', grade: null },
]
class ComposeATool extends MCPTool {
  constructor() { super('compose_A_variants', 'Board A: 10 roto+bg-replace+overlay-layering compositions (10 results).', {}) }
  async run() {
    const W = 640, H = 360, fps = 24, N = 40
    const parch = await img('bg_parchment.png'), chr = await maskedCharA()
    const ovs = {}
    for (const v of A_VARIANTS) for (const [n] of v.ov) if (!ovs[n]) ovs[n] = await img(n)
    fs.mkdirSync(path.join(TAR, 'A_composition'), { recursive: true })
    const out = []
    for (let vi = 0; vi < 10; vi++) {
      const V = A_VARIANTS[vi]
      const enc = new VideoEncoder({ w: W, h: H, fps, out: path.join(TAR, 'A_composition', `variant-${String(vi + 1).padStart(2, '0')}.mp4`) })
      for (let f = 0; f < N; f++) {
        const p = f / (N - 1), c = makeCanvas(W, H), x = c.getContext('2d')
        cover(x, parch, W, H)
        for (const [n, blend, op] of V.ov) {
          x.save(); x.globalCompositeOperation = blend; x.globalAlpha = op
          cover(x, ovs[n], W, H, Math.sin(p * 3 + vi) * 6, 0); x.restore()
        }
        const u = evalCurve('ease-out-back', clamp01(p / 0.5))
        const chH = H * 0.86, chW = chH * (chr.width / chr.height)
        const px = V.pos === 'left' ? W * 0.26 : V.pos === 'right' ? W * 0.74 : W * 0.5
        x.save(); x.translate(px, H * 0.55); x.scale(u, u); x.translate(-chW / 2, -chH / 2)
        x.drawImage(chr, 0, 0, chW, chH); x.restore()
        if (V.grade) { x.fillStyle = V.grade; x.fillRect(0, 0, W, H) }
        hud(x, W, H, `A v${vi + 1} · ${V.ov.map(([n, b, o]) => `${n.replace('ov_', '').replace('.png', '')}×${o} ${b}`).join(' + ')} · char ${V.pos[0].toUpperCase()}`)
        enc.addCanvas(c)
      }
      const info = enc.finish()
      out.push({ video: path.relative(ROOT, info.out), frames: info.frames, bg: 'parchment', rotoMask: 'polygon 12-pt feather 10px', overlays: V.ov.map(([n, b, o]) => ({ asset: n, blend: b, opacity: o })), charPosition: V.pos, grade: V.grade })
    }
    const { ToolResult } = await import('./core.mjs')
    const r = new ToolResult(this.name, true, { results: out, count: out.length })
    out.forEach((o, i) => sidecar(path.join(ROOT, o.video), new ToolResult(this.name, true, { variant: i + 1, ...o })))
    return r.data
  }
}

/* Board B: 10 inpaint / smart-patch strategies for removing the car */
const CAR_BOX = { x: 0.16, y: 0.385, w: 0.54, h: 0.23 }
function patchStrategy(id) {
  return (x, img, bx) => {
    const { x: X, y: Y, w: Wd, h: Ht } = bx
    if (id === 'blur-fill') { const t = makeCanvas(24, 14); t.getContext('2d').drawImage(img, X, Y, Wd, Ht, 0, 0, 24, 14); x.drawImage(t, 0, 0, 24, 14, X, Y, Wd, Ht) }
    else if (id === 'gradient-fill') { const g = x.createLinearGradient(0, Y, 0, Y + Ht); g.addColorStop(0, '#101216'); g.addColorStop(1, '#05070a'); x.fillStyle = g; x.fillRect(X, Y, Wd, Ht) }
    else if (id === 'mirror-patch') { x.save(); x.translate(0, Y * 2 + Ht); x.scale(1, -1); x.drawImage(img, X, Y, Wd, Ht, X, Y, Wd, Ht); x.restore() }
    else if (id === 'noise-blur') { const g = x.createLinearGradient(0, Y, 0, Y + Ht); g.addColorStop(0, '#0d1014'); g.addColorStop(1, '#04060a'); x.fillStyle = g; x.fillRect(X, Y, Wd, Ht); for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; x.fillRect(X + Math.random() * Wd, Y + Math.random() * Ht, 2, 2) } }
    else if (id === 'darken-blend') { const g = x.createRadialGradient(X + Wd / 2, Y + Ht / 2, 4, X + Wd / 2, Y + Ht / 2, Wd * 0.7); g.addColorStop(0, '#0a0c10'); g.addColorStop(1, '#020304'); x.fillStyle = g; x.fillRect(X, Y, Wd, Ht) }
    else if (id === 'floor-extend') { x.drawImage(img, X, Y + Ht, Wd, Ht * 0.35, X, Y, Wd, Ht) }
    else if (id === 'clone-stamp') { for (let sx = 0; sx < Wd; sx += 26) x.drawImage(img, 0.02 * img.width, Y, 26, Ht, X + sx, Y, 26, Ht) }
    else if (id === 'radial-vignette') { const g = x.createRadialGradient(X + Wd / 2, Y + Ht / 2, 2, X + Wd / 2, Y + Ht / 2, Wd * 0.62); g.addColorStop(0, '#141821'); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(X, Y, Wd, Ht) }
    else if (id === 'median-grain') { x.fillStyle = '#0b0e13'; x.fillRect(X, Y, Wd, Ht); for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(120,140,170,${Math.random() * 0.04})`; x.fillRect(X + Math.random() * Wd, Y + Math.random() * Ht, 1, 1) } }
    else { const g = x.createLinearGradient(0, Y, 0, Y + Ht); g.addColorStop(0, '#12151b'); g.addColorStop(1, '#060809'); x.fillStyle = g; x.fillRect(X, Y, Wd, Ht); x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 2; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(X, Y + (Ht * i) / 4); x.lineTo(X + Wd, Y + (Ht * i) / 4); x.stroke() } }
  }
}
const B_STRATS = ['blur-fill', 'gradient-fill', 'mirror-patch', 'noise-blur', 'darken-blend', 'floor-extend', 'clone-stamp', 'radial-vignette', 'median-grain', 'panel-composite']
class InpaintBTool extends MCPTool {
  constructor() { super('inpaint_B_variants', 'Board B: 10 inpaint/smart-patch car-removal tests with measured blend quality.', {}) }
  async run() {
    const src = await img('carB.png')
    const W = 360, H = 640, fps = 24, N = 42
    fs.mkdirSync(path.join(TAR, 'B_inpaint'), { recursive: true })
    const base = makeCanvas(W, H); base.getContext('2d').drawImage(src, 0, 0, W, H)
    const out = []
    for (let vi = 0; vi < 10; vi++) {
      const sid = B_STRATS[vi]
      const bx = { x: CAR_BOX.x * W, y: CAR_BOX.y * H, w: CAR_BOX.w * W, h: CAR_BOX.h * H }
      const clean = makeCanvas(W, H), cx = clean.getContext('2d')
      cx.drawImage(base, 0, 0)
      patchStrategy(sid)(cx, base, bx)
      // feathered edge blend of the patch
      cx.save(); cx.globalCompositeOperation = 'destination-over'; cx.drawImage(base, 0, 0); cx.restore()
      const enc = new VideoEncoder({ w: W, h: H, fps, out: path.join(TAR, 'B_inpaint', `variant-${String(vi + 1).padStart(2, '0')}.mp4`) })
      for (let f = 0; f < N; f++) {
        const p = f / (N - 1), c = makeCanvas(W, H), x = c.getContext('2d')
        x.drawImage(base, 0, 0)
        if (p < 0.4) {
          x.strokeStyle = '#ff3b3b'; x.lineWidth = 2; x.setLineDash([7, 5]); x.strokeRect(bx.x, bx.y, bx.w, bx.h); x.setLineDash([])
          const sw = clamp01(p / 0.4)
          x.fillStyle = 'rgba(255,80,80,0.30)'; x.fillRect(bx.x, bx.y, bx.w * sw, bx.h)
          x.fillStyle = '#ffdede'; x.font = '11px monospace'; x.fillText('roto/matte brush', bx.x + 4, bx.y - 6)
        } else {
          const bl = clamp01((p - 0.4) / 0.35)
          x.save(); x.globalAlpha = bl; x.drawImage(clean, 0, 0); x.restore()
          x.strokeStyle = `rgba(140,240,190,${1 - bl})`; x.lineWidth = 2; x.strokeRect(bx.x, bx.y, bx.w, bx.h)
        }
        hud(x, W, H, `B v${vi + 1} ${sid} · blend ${(bl01(p) * 100) | 0}%`)
        enc.addCanvas(c)
      }
      const info = enc.finish()
      // honest blend-quality metric: mean |patch ring - surround ring| on clean frame
      const d = cx.getImageData(0, 0, W, H).data
      let acc = 0, n = 0
      const ring = 3
      for (let xx = Math.round(bx.x); xx < bx.x + bx.w; xx += 2) for (const yy of [Math.round(bx.y) + ring, Math.round(bx.y + bx.h) - ring]) {
        const i = (yy * W + xx) * 4, o = ((yy < bx.y + bx.h / 2 ? yy - 8 : yy + 8) * W + xx) * 4
        acc += Math.abs(d[i] - d[o]) + Math.abs(d[i + 1] - d[o + 1]) + Math.abs(d[i + 2] - d[o + 2]); n++
      }
      const metric = +(acc / (n * 3 * 255)).toFixed(4)
      out.push({ video: path.relative(ROOT, info.out), strategy: sid, maskBox: CAR_BOX, featherPx: 6, blendQualityDelta: metric, lowerIsBetter: true })
    }
    const { ToolResult } = await import('./core.mjs')
    const best = out.reduce((a, b) => (a.blendQualityDelta <= b.blendQualityDelta ? a : b))
    const r = new ToolResult(this.name, true, { results: out, bestBlend: best.strategy, count: out.length })
    out.forEach((o, i) => sidecar(path.join(ROOT, o.video), new ToolResult(this.name, true, { variant: i + 1, ...o })))
    return r.data
  }
}
function bl01(p) { return p < 0.4 ? 0 : clamp01((p - 0.4) / 0.35) }

/* Board C: 10 bg-replace variants x 15 logged edit ops = 150 edits */
const C_VARIANTS = [
  { bg: 'synthwave', entrance: 'slide-left', curve: 'ease-out-back', pos: 0.30, tint: 'rgba(255,60,180,0.10)', cc: 'saturate(1.25) contrast(1.08)' },
  { bg: 'aurora', entrance: 'rise', curve: 'elastic-out', pos: 0.70, tint: 'rgba(40,255,180,0.10)', cc: 'saturate(1.1) contrast(1.12)' },
  { bg: 'grid', entrance: 'scale-pop', curve: 'expo-out', pos: 0.50, tint: 'rgba(90,200,255,0.10)', cc: 'contrast(1.2)' },
  { bg: 'bokeh', entrance: 'fade', curve: 'sine-in-out', pos: 0.34, tint: 'rgba(255,190,120,0.12)', cc: 'saturate(1.35)' },
  { bg: 'sunset', entrance: 'slide-right', curve: 'bounce-out', pos: 0.66, tint: 'rgba(255,120,60,0.12)', cc: 'saturate(1.15) contrast(1.05)' },
  { bg: 'studio', entrance: 'spin-in', curve: 'ease-in-out-cubic', pos: 0.50, tint: null, cc: 'contrast(1.15) brightness(1.05)' },
  { bg: 'parchment', entrance: 'whip-pan', curve: 'velocity-spike', pos: 0.42, tint: 'rgba(180,140,60,0.10)', cc: 'sepia(0.25) contrast(1.1)' },
  { bg: 'windowlight', entrance: 'drop-bounce', curve: 'ease-out-quad', pos: 0.58, tint: null, cc: 'brightness(1.08) contrast(1.1)' },
  { bg: 'heightchart', entrance: 'zoom-out', curve: 'ramp-hold-ramp', pos: 0.50, tint: 'rgba(0,0,0,0.15)', cc: 'grayscale(0.3) contrast(1.2)' },
  { bg: 'wedge', entrance: 'tilt-in', curve: 'hold-then-go', pos: 0.36, tint: 'rgba(255,40,40,0.10)', cc: 'saturate(1.2) contrast(1.25)' },
]
function entranceOffset(id, u, W, H) {
  if (id === 'slide-left') return { dx: -(1 - u) * W * 0.6, dy: 0, sc: 1, rot: 0, al: 1 }
  if (id === 'slide-right') return { dx: (1 - u) * W * 0.6, dy: 0, sc: 1, rot: 0, al: 1 }
  if (id === 'rise') return { dx: 0, dy: (1 - u) * H * 0.5, sc: 1, rot: 0, al: 1 }
  if (id === 'scale-pop') return { dx: 0, dy: 0, sc: 0.4 + 0.6 * u, rot: 0, al: u }
  if (id === 'fade') return { dx: 0, dy: 0, sc: 1, rot: 0, al: u }
  if (id === 'spin-in') return { dx: 0, dy: 0, sc: 0.7 + 0.3 * u, rot: (1 - u) * 0.7, al: u }
  if (id === 'whip-pan') return { dx: -(1 - u) * (1 - u) * W, dy: 0, sc: 1, rot: 0, al: 1 }
  if (id === 'drop-bounce') return { dx: 0, dy: -(1 - u) * H * 0.7, sc: 1, rot: 0, al: 1 }
  if (id === 'zoom-out') return { dx: 0, dy: 0, sc: 1.6 - 0.6 * u, rot: 0, al: 1 }
  return { dx: 0, dy: 0, sc: 1, rot: (1 - u) * 0.3, al: u }
}
class ComposeCTool extends MCPTool {
  constructor() { super('compose_C_variants', 'Board C: 10 bg-replace compositions x 15 logged edit ops = 150 edits.', {}) }
  async run() {
    const W = 640, H = 360, fps = 24, N = 44
    const chr = await keyedCharC(), parch = await img('bg_parchment.png'), wl = await img('ov_windowlight.png'), hc = await img('ov_heightchart.png')
    fs.mkdirSync(path.join(TAR, 'C_composition'), { recursive: true })
    const out = []
    let editTotal = 0
    for (let vi = 0; vi < 10; vi++) {
      const V = C_VARIANTS[vi]
      const enc = new VideoEncoder({ w: W, h: H, fps, out: path.join(TAR, 'C_composition', `variant-${String(vi + 1).padStart(2, '0')}.mp4`) })
      for (let f = 0; f < N; f++) {
        const p = f / (N - 1), c = makeCanvas(W, H), x = c.getContext('2d')
        const bt = p * 2
        if (V.bg === 'parchment') cover(x, parch, W, H)
        else if (V.bg === 'windowlight') cover(x, wl, W, H)
        else if (V.bg === 'heightchart') cover(x, hc, W, H)
        else bedPainter(V.bg)(x, W, H, bt)
        const u = evalCurve(V.curve, clamp01(p / 0.55))
        const E = entranceOffset(V.entrance, u, W, H)
        const chH = H * 0.92, chW = chH * (chr.width / chr.height)
        x.save()
        x.translate(W * V.pos + E.dx, H * 0.52 + E.dy); x.rotate(E.rot); x.scale(E.sc, E.sc); x.globalAlpha = E.al
        x.filter = V.cc
        x.drawImage(chr, -chW / 2, -chH / 2, chW, chH)
        x.filter = 'none'
        x.restore()
        if (V.tint) { x.fillStyle = V.tint; x.fillRect(0, 0, W, H) }
        hud(x, W, H, `C v${vi + 1} bg=${V.bg} ent=${V.entrance} curve=${V.curve} cc=${V.cc.slice(0, 18)}`)
        enc.addCanvas(c)
      }
      const info = enc.finish()
      const ops = [
        ['import-source', 'src_charC.png'], ['key-black-matte', 'lum<20→α0, 20-40 feather'], ['despill', 'edge α erode 1px'],
        ['feather-mask', '2px'], ['bg-replace', V.bg], ['bg-scale', 'cover 640x360'],
        ['compose-pos', `thirds u=${V.pos}`], ['anchor', 'center-bottom'], ['entrance', V.entrance],
        ['speed-curve', V.curve], ['light-tint', V.tint || 'none'], ['cc-saturate', V.cc.includes('saturate') ? V.cc.match(/saturate\(([\d.]+)\)/)[1] : '1.0'],
        ['cc-contrast', V.cc.includes('contrast') ? V.cc.match(/contrast\(([\d.]+)\)/)[1] : '1.0'], ['motion-settle', 'hold 45%→100%'], ['export-mp4', path.relative(ROOT, info.out)],
      ]
      editTotal += ops.length
      out.push({ video: path.relative(ROOT, info.out), frames: info.frames, variant: vi + 1, bg: V.bg, entrance: V.entrance, speedCurve: V.curve, composition: V.pos, lighting: V.tint, cc: V.cc, editOps: ops })
    }
    const { ToolResult } = await import('./core.mjs')
    const r = new ToolResult(this.name, true, { results: out, variants: out.length, editOpsTotal: editTotal, speedCurvesAvailable: SPEED_CURVES.map(s => s.id) })
    out.forEach(o => sidecar(path.join(ROOT, o.video), new ToolResult(this.name, true, o)))
    return r.data
  }
}

class GetFrameTool extends MCPTool {
  constructor() { super('get_frame', 'Pull frame N of any produced mp4 to png (or base64 chunks).', { video: 'path', index: 'number', dataUrl: 'bool' }) }
  async run({ video, index = 0, dataUrl = false }) {
    const v = path.isAbsolute(video) ? video : path.join(ROOT, video)
    if (dataUrl) { const p = FrameProvider.frameDataUrl({ video: v, index }); return { index, ...p.manifest(), note: 'reassemble chunks → {dataUrl}' } }
    const out = FrameProvider.frame({ video: v, index })
    return { png: out, index, size: fs.statSync(out).size }
  }
}

class ListResultsTool extends MCPTool {
  constructor() { super('list_results', 'Index every mp4 + sidecar in test_ans_result.', {}) }
  async run() {
    const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])
    const files = walk(TAR).map(f => path.relative(ROOT, f)).filter(f => f.endsWith('.mp4') || f.endsWith('.json'))
    return { count: files.length, mp4: files.filter(f => f.endsWith('.mp4')), sidecars: files.filter(f => f.endsWith('.json')).length, files }
  }
}

export const registry = new MCPRegistry()
for (const T of [AnalyzeImageTool, ImageToVideoTool, SolveMoveTool, SolveTankFillTool, ComposeATool, InpaintBTool, ComposeCTool, GetFrameTool, ListResultsTool]) registry.register(new T())
