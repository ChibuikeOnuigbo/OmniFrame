// OmniFrame MCP-style utility core (OOP, chunked JSON returns, frame access).
// Every tool returns a ToolResult; ToolResult.chunkManifest() splits the whole
// payload (meta + data) into fixed-size JSON chunks so callers can stream or
// verify it piece by piece. FrameProvider pulls any frame of any produced mp4.
import { createCanvas, loadImage, Image, GlobalFonts } from '@napi-rs/canvas'
import { execFileSync, spawn } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import os from 'os'

let _ff
export function ffmpegExe() {
  if (_ff) return _ff
  _ff = execFileSync('python3', ['-c', 'import imageio_ffmpeg,sys;sys.stdout.write(imageio_ffmpeg.get_ffmpeg_exe())']).toString()
  return _ff
}

export class ChunkedPayload {
  constructor(payload, chunkBytes = 1500) {
    this.string = typeof payload === 'string' ? payload : JSON.stringify(payload, (k, val) => {
      // cycle-safe: live engine objects (seq/clip graphs) may self-reference in
      // nested tool payloads; mark repeats instead of throwing (anti-cheat manifest must always write)
      if (val && typeof val === 'object') {
        const seen = (this._seen ||= new WeakSet())
        if (seen.has(val)) return '[same-object-ref]'
        seen.add(val)
      }
      return val
    })
    this.chunkBytes = chunkBytes
    this.sha256 = crypto.createHash('sha256').update(this.string).digest('hex')
  }
  get chunks() {
    const out = []
    for (let i = 0; i < this.string.length; i += this.chunkBytes) out.push(this.string.slice(i, i + this.chunkBytes))
    return out
  }
  get total() { return this.chunks.length }
  manifest() {
    return { bytes: this.string.length, chunkBytes: this.chunkBytes, chunks: this.total, sha256: this.sha256 }
  }
  static reassemble(chunks) { return JSON.parse(chunks.join('')) }
}

export class ToolResult {
  constructor(tool, ok, data, meta = {}) {
    this.tool = tool; this.ok = ok; this.data = data; this.meta = meta
  }
  chunkManifest(chunkBytes) {
    const p = new ChunkedPayload({ tool: this.tool, ok: this.ok, meta: this.meta, data: this.data }, chunkBytes)
    return { ...p.manifest(), reassemble: 'ChunkedPayload.reassemble(chunks)', chunks: p.chunks }
  }
  toJSON() { return { tool: this.tool, ok: this.ok, meta: this.meta, data: this.data } }
}

export class MCPTool {
  constructor(name, description, inputSchema = {}) {
    this.name = name; this.description = description; this.inputSchema = inputSchema
  }
  async run() { throw new Error(`${this.name}: run() not implemented`) }
  async call(params = {}, ctx = {}) {
    const t0 = Date.now()
    try {
      const data = await this.run(params, ctx)
      return new ToolResult(this.name, true, data, { ms: Date.now() - t0, ...ctx.meta })
    } catch (e) {
      return new ToolResult(this.name, false, { error: String((e && e.stack) || e) }, { ms: Date.now() - t0 })
    }
  }
}

export class MCPRegistry {
  constructor() { this.tools = new Map() }
  register(tool) { this.tools.set(tool.name, tool); return this }
  async call(name, params, ctx) {
    const t = this.tools.get(name)
    if (!t) return new ToolResult(name, false, { error: `unknown tool; have: ${[...this.tools.keys()].join(', ')}` })
    return t.call(params, ctx)
  }
  list() { return [...this.tools.values()].map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) }
}

export class VideoEncoder {
  constructor({ w = 640, h = 360, fps = 24, out }) {
    this.w = w; this.h = h; this.fps = fps; this.out = out
    // Pipe PNG frames straight into ffmpeg over stdin. getImageData() leaks
    // ~4 MB of NATIVE (non-GC-tracked) memory per call in @napi-rs/canvas, so
    // the old raw-RGB path OOMed long 720p exports; toBuffer('image/png') is
    // clean and skips the JS-side RGBA→RGB loop too.
    this.proc = spawn(ffmpegExe(), ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-vcodec', 'png', '-framerate', String(fps), '-i', '-', '-an', '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast', out], { stdio: ['pipe', 'pipe', 'pipe'] })
    this.err = ''
    this.proc.stderr.on('data', (d) => { this.err += d.toString() })
    this.exitP = new Promise((res, rej) => { this.proc.on('exit', (c) => (c === 0 ? res(c) : rej(new Error(`ffmpeg exit ${c}: ${this.err.slice(-400)}`)))) })
    this.n = 0
    this.writeP = Promise.resolve()
  }
  addCanvas(canvas) {
    const buf = canvas.toBuffer('image/png')
    this.writeP = this.writeP.then(() => new Promise((res) => {
      if (this.proc.stdin.write(buf)) res()
      else this.proc.stdin.once('drain', res)
    }))
    this.n++
    return this
  }
  get frames() { return this.n }
  async finish() {
    if (!this.n) throw new Error('no frames')
    await this.writeP
    this.proc.stdin.end()
    await this.exitP
    return { out: this.out, frames: this.n, fps: this.fps, size: fs.statSync(this.out).size }
  }
}

export class FrameProvider {
  // Pull any frame of any produced mp4 → png on disk (+ optional data-url chunk).
  static frame({ video, index = 0, out }) {
    const dest = out || video.replace(/\.mp4$/, `-_f${index}.png`)
    execFileSync(ffmpegExe(), ['-y', '-loglevel', 'error', '-i', video, '-vf', `select=eq(n\\,${index})`, '-frames:v', '1', dest])
    return dest
  }
  static frameDataUrl({ video, index = 0 }) {
    const p = FrameProvider.frame({ video, index, out: `/tmp/frame-${Date.now()}.png` })
    const url = `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`
    fs.unlinkSync(p)
    return new ChunkedPayload({ video, index, dataUrl: url }, 4000)
  }
}

// headless shim so the app's pixelGrade (document.createElement canvases)
// runs identically in node: same maths, two worlds
if (typeof globalThis.document === 'undefined') {
  globalThis.document = { createElement: () => createCanvas(1, 1) }
}
export function makeCanvas(w, h) { return createCanvas(w, h) }
export { Image as CanvasImage,  loadImage }
export function cover(ctx, img, w, h, ox = 0, oy = 0) {
  const s = Math.max(w / img.width, h / img.height)
  const dw = img.width * s, dh = img.height * s
  ctx.drawImage(img, ox + (w - dw) / 2, oy + (h - dh) / 2, dw, dh)
}
export function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t }
export function lerp(a, b, t) { return a + (b - a) * t }

// TYMM font pack registration (headless parity with the browser @font-face css):
// family name = file stem, exactly as the user named them.
export const FONT_PACK_FILES = []
try {
  const fdir = path.join(import.meta.dirname, '..', '..', 'public', 'fonts')
  if (fs.existsSync(fdir)) {
    for (const f of fs.readdirSync(fdir).sort()) {
      if (!/\.(ttf|otf|woff|woff2|ttc)$/i.test(f)) continue
      const stem = f.replace(/\.[^.]+$/, '')
      FONT_PACK_FILES.push(stem)
      try { GlobalFonts.registerFromPath(path.join(fdir, f), stem) } catch { /* dup */ }
    }
  }
} catch { /* headless-only */ }
