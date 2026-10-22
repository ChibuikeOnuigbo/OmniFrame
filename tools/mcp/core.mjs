// OmniFrame MCP-style utility core (OOP, chunked JSON returns, frame access).
// Every tool returns a ToolResult; ToolResult.chunkManifest() splits the whole
// payload (meta + data) into fixed-size JSON chunks so callers can stream or
// verify it piece by piece. FrameProvider pulls any frame of any produced mp4.
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { execFileSync } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'

let _ff
export function ffmpegExe() {
  if (_ff) return _ff
  _ff = execFileSync('python3', ['-c', 'import imageio_ffmpeg,sys;sys.stdout.write(imageio_ffmpeg.get_ffmpeg_exe())']).toString()
  return _ff
}

export class ChunkedPayload {
  constructor(payload, chunkBytes = 1500) {
    this.string = typeof payload === 'string' ? payload : JSON.stringify(payload)
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
    this.w = w; this.h = h; this.fps = fps; this.out = out; this.bufs = []
  }
  addCanvas(canvas) {
    const d = canvas.getContext('2d').getImageData(0, 0, this.w, this.h).data
    const rgb = Buffer.alloc(this.w * this.h * 3)
    for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { rgb[j] = d[i]; rgb[j + 1] = d[i + 1]; rgb[j + 2] = d[i + 2] }
    this.bufs.push(rgb)
    return this
  }
  get frames() { return this.bufs.length }
  finish() {
    if (!this.bufs.length) throw new Error('no frames')
    const raw = Buffer.concat(this.bufs)
    execFileSync(ffmpegExe(), ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
      '-s', `${this.w}x${this.h}`, '-r', String(this.fps), '-i', '-', '-an',
      '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast', this.out],
      { input: raw, maxBuffer: 1 << 30 })
    return { out: this.out, frames: this.bufs.length, fps: this.fps, size: fs.statSync(this.out).size }
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

export function makeCanvas(w, h) { return createCanvas(w, h) }
export { loadImage }
export function cover(ctx, img, w, h, ox = 0, oy = 0) {
  const s = Math.max(w / img.width, h / img.height)
  const dw = img.width * s, dh = img.height * s
  ctx.drawImage(img, ox + (w - dw) / 2, oy + (h - dh) / 2, dw, dh)
}
export function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t }
export function lerp(a, b, t) { return a + (b - a) * t }
