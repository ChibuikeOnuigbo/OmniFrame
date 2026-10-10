/**
 * LUT engine: parses Adobe/Iridas .cube 3D LUTs and applies them with
 * intensity blending. Two paths:
 *  - CPU trilinear (applyLutToImageData): exact reference, used by tests
 *    and as a fallback when WebGL2 is unavailable.
 *  - WebGL2 (LutRenderer): renders the composite canvas through a chain of
 *    3D textures in one pass per LUT — the interactive-speed path used by
 *    the playback compositor.
 */

export interface CubeLut {
  size: number
  data: Float32Array // length size^3 * 3, order: r-major, then g, then b fastest
  title?: string
}

const CUBE_RE = /^\s*(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s+(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s+(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*$/

/** Parses a .cube file body. Throws on structurally invalid input. */
export function parseCubeLUT(text: string): CubeLut {
  let size = 0
  const rows: number[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('TITLE')) continue
    if (line.startsWith('LUT_1D_SIZE')) throw new Error('1D LUTs are not supported')
    if (line.startsWith('DOMAIN_MIN') || line.startsWith('DOMAIN_MAX')) continue
    if (line.startsWith('LUT_3D_SIZE')) {
      size = parseInt(line.split(/\s+/)[1], 10)
      if (!Number.isFinite(size) || size < 2 || size > 129) throw new Error(`bad LUT_3D_SIZE: ${line}`)
      continue
    }
    const m = CUBE_RE.exec(line)
    if (!m) throw new Error(`unparseable .cube line: ${line.slice(0, 60)}`)
    rows.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]))
  }
  if (!size) throw new Error('missing LUT_3D_SIZE')
  if (rows.length !== size * size * size * 3) {
    throw new Error(`expected ${size ** 3 * 3} values, found ${rows.length}`)
  }
  return { size, data: new Float32Array(rows) }
}

/** Fetch + parse a bundled LUT, memoized by URL. */
const lutCache = new Map<string, Promise<CubeLut>>()
export function loadCubeLut(url: string): Promise<CubeLut> {
  let p = lutCache.get(url)
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`failed to load LUT ${url}: ${r.status}`)
      return r.text()
    }).then(parseCubeLUT)
    lutCache.set(url, p)
    p.catch(() => lutCache.delete(url))
  }
  return p
}

export interface LutStackItem {
  lut: CubeLut
  intensity: number
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

/** Trilinear sample of a 3D LUT at [r,g,b] in 0..1. Writes to out[3i..]. */
export function sampleLut(lut: CubeLut, r: number, g: number, b: number, out: Float32Array | number[], i: number) {
  const s = lut.size - 1
  const fx = clamp01(r) * s
  const fy = clamp01(g) * s
  const fz = clamp01(b) * s
  const x0 = Math.min(s, fx | 0), y0 = Math.min(s, fy | 0), z0 = Math.min(s, fz | 0)
  const x1 = Math.min(s, x0 + 1), y1 = Math.min(s, y0 + 1), z1 = Math.min(s, z0 + 1)
  const dx = fx - x0, dy = fy - y0, dz = fz - z0
  const d = lut.data
  const st = lut.size
  // index helper: r-major, g-middle, b-fastest (matches our generator + spec)
  const idx = (rr: number, gg: number, bb: number) => (rr * st * st + gg * st + bb) * 3
  for (let c = 0; c < 3; c++) {
    const c000 = d[idx(x0, y0, z0) + c], c100 = d[idx(x1, y0, z0) + c]
    const c010 = d[idx(x0, y1, z0) + c], c110 = d[idx(x1, y1, z0) + c]
    const c001 = d[idx(x0, y0, z1) + c], c101 = d[idx(x1, y0, z1) + c]
    const c011 = d[idx(x0, y1, z1) + c], c111 = d[idx(x1, y1, z1) + c]
    const cx0 = c000 + (c100 - c000) * dx
    const cx1 = c010 + (c110 - c010) * dx
    const cx2 = c001 + (c101 - c001) * dx
    const cx3 = c011 + (c111 - c011) * dx
    const cy0 = cx0 + (cx1 - cx0) * dy
    const cy1 = cx2 + (cx3 - cx2) * dy
    out[i + c] = cy0 + (cy1 - cy0) * dz
  }
}

/**
 * Applies a stack of LUTs (bottom-to-top) to an ImageData in place,
 * honoring per-LUT intensity (linear blend between original and LUT output).
 */
export function applyLutStackToImageData(img: ImageData, stack: LutStackItem[]) {
  if (!stack.length) return
  const px = img.data
  const tmp = new Float32Array(3)
  const orig = new Float32Array(3)
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255
    for (const { lut, intensity } of stack) {
      if (intensity >= 1) {
        sampleLut(lut, r, g, b, tmp, 0)
        r = tmp[0]; g = tmp[1]; b = tmp[2]
      } else if (intensity > 0) {
        orig[0] = r; orig[1] = g; orig[2] = b
        sampleLut(lut, r, g, b, tmp, 0)
        r = orig[0] + (tmp[0] - orig[0]) * intensity
        g = orig[1] + (tmp[1] - orig[1]) * intensity
        b = orig[2] + (tmp[2] - orig[2]) * intensity
      }
    }
    px[i] = clamp01(r) * 255 + 0.5 | 0
    px[i + 1] = clamp01(g) * 255 + 0.5 | 0
    px[i + 2] = clamp01(b) * 255 + 0.5 | 0
  }
}

/* ------------------------------------------------------------------ */
/* WebGL2 fast path                                                    */
/* ------------------------------------------------------------------ */

const VERT = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){
  // vUv.y flipped so a canvas-source texture (top-left origin) renders upright
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FRAG = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler2D uSrc;
uniform sampler3D uLut;
uniform float uIntensity;
in vec2 vUv;
out vec4 fragColor;
void main(){
  vec4 src = texture(uSrc, vUv);
  vec3 graded = texture(uLut, clamp(src.rgb, 0.0, 1.0)).rgb;
  fragColor = vec4(mix(src.rgb, graded, clamp(uIntensity, 0.0, 1.0)), src.a);
}`

/**
 * Applies a chain of LUT stacks to a source canvas by ping-ponging between
 * two FBO textures; one draw call per LUT. Falls back gracefully (caller
 * can use applyLutStackToImageData) when WebGL2 is missing.
 */
export class LutRenderer {
  private gl: WebGL2RenderingContext | null = null
  private program: WebGLProgram | null = null
  private srcTex: WebGLTexture | null = null
  private fbo: WebGLFramebuffer[] = []
  private tex: WebGLTexture[] = []
  private lutTex = new Map<CubeLut, WebGLTexture>()
  private w = 0
  private h = 0
  supported = false

  constructor() {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true })
      if (!gl) return
      this.gl = gl
      this.program = this.buildProgram(VERT, FRAG)
      this.supported = true
    } catch {
      this.supported = false
    }
  }

  private buildProgram(vs: string, fs: string): WebGLProgram {
    const gl = this.gl!
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error('shader: ' + gl.getShaderInfoLog(sh))
      }
      return sh
    }
    const p = gl.createProgram()!
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs))
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs))
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('link: ' + gl.getProgramInfoLog(p))
    }
    return p
  }

  private ensureSize(w: number, h: number) {
    const gl = this.gl!
    if (this.w === w && this.h === h && this.fbo.length) return
    this.w = w; this.h = h
    for (const t of this.tex) gl.deleteTexture(t)
    for (const f of this.fbo) gl.deleteFramebuffer(f)
    this.tex = []; this.fbo = []
    for (let i = 0; i < 2; i++) {
      const t = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      const f = gl.createFramebuffer()!
      gl.bindFramebuffer(gl.FRAMEBUFFER, f)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0)
      this.tex.push(t); this.fbo.push(f)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  private getLutTexture(lut: CubeLut): WebGLTexture {
    const gl = this.gl!
    let t = this.lutTex.get(lut)
    if (t) return t
    t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_3D, t)
    // gl.texImage3D expects rows in the order r-major, g-middle, b-fastest —
    // which is exactly the .cube file layout we parsed.
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA32F, lut.size, lut.size, lut.size, 0, gl.RGBA, gl.FLOAT, padToRGBA(lut))
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE)
    this.lutTex.set(lut, t)
    return t
  }

  /**
   * Renders `source` through the stack and returns a canvas holding the
   * result. The returned canvas is the renderer's own WebGL canvas —
   * it is overwritten by the next apply() call, so copy it if needed.
   * Intermediate passes ping-pong between FBOs; the last pass draws to the
   * default framebuffer so the GL canvas stays readable by 2D canvas
   * (preserveDrawingBuffer is set in the constructor).
   */
  apply(source: CanvasImageSource, stack: LutStackItem[], w: number, h: number): HTMLCanvasElement {
    const gl = this.gl!
    if (!this.supported || !stack.length) throw new Error('LutRenderer.apply called with empty stack / unsupported')
    this.ensureSize(w, h)
    const glc = gl.canvas as HTMLCanvasElement
    if (glc.width !== w || glc.height !== h) { glc.width = w; glc.height = h }
    if (!this.srcTex) this.srcTex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.useProgram(this.program!)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad())
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    const uSrc = gl.getUniformLocation(this.program!, 'uSrc')
    const uLut = gl.getUniformLocation(this.program!, 'uLut')
    const uIntensity = gl.getUniformLocation(this.program!, 'uIntensity')
    let read = this.srcTex
    for (let i = 0; i < stack.length; i++) {
      const { lut, intensity } = stack[i]
      const last = i === stack.length - 1
      gl.bindFramebuffer(gl.FRAMEBUFFER, last ? null : this.fbo[i % 2])
      gl.viewport(0, 0, w, h)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, read)
      gl.uniform1i(uSrc, 0)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_3D, this.getLutTexture(lut))
      gl.uniform1i(uLut, 1)
      gl.uniform1f(uIntensity, Math.min(1, Math.max(0, intensity)))
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      if (!last) read = this.tex[i % 2]
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return glc
  }

  private _quad: WebGLBuffer | null = null
  private quad(): WebGLBuffer {
    const gl = this.gl!
    if (!this._quad) {
      this._quad = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, this._quad)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this._quad)
    return this._quad
  }

  dispose() {
    const gl = this.gl
    if (!gl) return
    for (const t of this.lutTex.values()) gl.deleteTexture(t)
    for (const t of this.tex) gl.deleteTexture(t)
    for (const f of this.fbo) gl.deleteFramebuffer(f)
    if (this.srcTex) gl.deleteTexture(this.srcTex)
    this.lutTex.clear(); this.tex = []; this.fbo = []; this.srcTex = null
  }
}

/** expands an RGB float LUT to RGBA floats for texImage3D */
function padToRGBA(lut: CubeLut): Float32Array {
  const n = lut.size ** 3
  const out = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    out[i * 4] = lut.data[i * 3]
    out[i * 4 + 1] = lut.data[i * 3 + 1]
    out[i * 4 + 2] = lut.data[i * 3 + 2]
    out[i * 4 + 3] = 1
  }
  return out
}

/**
 * Applies a stack of already-parsed LUTs to the current contents of a 2D
 * canvas, in place, via the fastest available path (WebGL2, CPU fallback).
 * Synchronous — the caller must have parsed LUTs beforehand (see
 * LutResolver for async loading of builtin/uploaded refs).
 */
export function applyLutStackToCanvas(canvas: HTMLCanvasElement, stack: LutStackItem[]): void {
  if (!stack.length) return
  if (!lutRenderer) lutRenderer = new LutRenderer()
  const r = lutRenderer
  if (r.supported) {
    try {
      const out = r.apply(canvas, stack, canvas.width, canvas.height)
      const ctx = canvas.getContext('2d')!
      ctx.save()
      ctx.globalCompositeOperation = 'copy'
      ctx.drawImage(out, 0, 0)
      ctx.restore()
      return
    } catch {
      // fall through to CPU
    }
  }
  const ctx = canvas.getContext('2d')!
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  applyLutStackToImageData(img, stack)
  ctx.putImageData(img, 0, 0)
}

let lutRenderer: LutRenderer | null = null

/* ------------------------------------------------------------------ */
/* LUT reference resolution (builtin files + uploaded text)            */
/* ------------------------------------------------------------------ */

/** A reference to a LUT usable inside an adjustment layer. */
export interface LutRef {
  /** builtin manifest id, e.g. 'teal-orange' */
  builtin?: string
  /** raw .cube text (uploaded LUTs) */
  text?: string
}

const refCache = new Map<string, CubeLut>()
const refPending = new Map<string, Promise<CubeLut>>()

export function refKey(ref: LutRef): string {
  return ref.builtin ? `builtin:${ref.builtin}` : `text:${hashStr(ref.text || '')}`
}

function hashStr(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36) + ':' + s.length
}

/**
 * Returns the parsed LUT for a ref if it is already loaded (sync), else
 * kicks off loading and returns undefined. Callers re-render when the
 * promise resolves.
 */
export function resolveLutRef(ref: LutRef): CubeLut | undefined {
  const key = refKey(ref)
  const hit = refCache.get(key)
  if (hit) return hit
  if (!refPending.has(key)) {
    const p = ref.builtin
      ? loadCubeLut(`luts/${ref.builtin}.cube`)
      : Promise.resolve().then(() => parseCubeLUT(ref.text || ''))
    refPending.set(key, p)
    p.then((lut) => refCache.set(key, lut)).catch(() => refPending.delete(key))
  }
  return undefined
}

/** Await all pending LUT loads (used by tests / export). */
export async function whenLutsLoaded(): Promise<void> {
  while (refPending.size) {
    await Promise.allSettled([...refPending.values()])
  }
}
