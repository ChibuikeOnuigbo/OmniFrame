/**
 * device3d — procedural 3D device rigs for phone / monitor / TV transitions
 * and green-screen device overlays.
 *
 * Pipeline (as briefed, adapted to what this sandbox can honestly run):
 *   1. reference scan  — web image search over green-screen device mockups
 *      (image-search/*.png|jpg): proportions, bezel weights, stand shapes,
 *      glare language were measured off those stills.
 *   2. AI stills       — generate_image produced perfect-angle chroma-green
 *      device plates (public/devices/phone-greenscreen.png,
 *      monitor-greenscreen.png); keyDeviceImage() chroma+white-keys them into
 *      transparent overlays with a cached screen bounding box.
 *   3. NO Blender/3D MCP connector exists on Arena (checked: "unsupported") and
 *      blender.org is outside the egress allowlist — so the model is MOULDED IN
 *      CODE instead: parametric rounded-slab geometry, projected through a real
 *      perspective camera, extruded sides, perspective-correct screen texture
 *      mapping (triangle-grid affine warp), gradient-shaded metal, glare, soft
 *      shadows. Canvas2D gives native anti-aliasing.
 *   4. rig             — rigAt(kind, p) returns keyframed channels (rotY/rotX/
 *      scale/offset/fill) with cubic easing; the 3D→2D handoff expands the
 *      screen quad to the full frame while the body fades, so the transition
 *      ENDS in flat 2D.
 *   5. mp4             — rendered through the app's own render_export / QA
 *      harnesses (qa/device3d-transition.mjs).
 */

export const DEVICE_KINDS = ['phone', 'monitor', 'tv'] as const
export type DeviceKind = (typeof DEVICE_KINDS)[number]

export interface DeviceRig {
  rotY: number // degrees
  rotX: number // degrees
  scale: number
  x: number // fraction of frame width
  y: number // fraction of frame height
  fill: number // 0 = device view, 1 = screen fills frame (2D handoff)
  bodyAlpha: number
}

/* ------------------------------- easing -------------------------------- */
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a))

/** Keyframed rig channels for the 3D→2D device transition. */
export function rigAt(kind: DeviceKind, p: number): DeviceRig {
  const t = clamp01(p)
  const a = seg(t, 0, 0.45) // fly-in
  const b = seg(t, 0.45, 0.8) // settle
  const c = seg(t, 0.8, 1) // 3D→2D handoff
  const eA = easeOutCubic(a)
  const eB = easeInOutCubic(b)
  const eC = easeInOutCubic(c)
  const startRot = kind === 'phone' ? -74 : -58
  const rotY = lerp(lerp(startRot, -10, eA), 0, eB)
  const rotX = lerp(lerp(9, 3, eA), 0, eB)
  const scale = lerp(lerp(0.5, 0.9, eA), 1, eB) * lerp(1, 1.06, eC)
  const x = lerp(-0.14, 0, eA)
  const y = lerp(0.03, 0, eA)
  const fill = eC
  const bodyAlpha = 1 - easeInOutCubic(seg(t, 0.84, 0.99))
  return { rotY, rotX, scale, x, y, fill, bodyAlpha }
}

/* --------------------------- device geometry ---------------------------- */
interface DeviceSpec {
  screenW: number // device units (screen height = 1 for landscape, width = 1 for portrait)
  screenH: number
  bezel: number // fraction of the short screen side
  cornerR: number // fraction of the short BODY side
  depth: number // slab thickness in device units
  chin: number // aluminium chin under the screen (monitor only)
  stand: 'pedestal' | 'feet' | 'none'
  bodyTop: string
  bodyBottom: string
  glare: number
}
const SPECS: Record<DeviceKind, DeviceSpec> = {
  phone: { screenW: 1, screenH: 2.12, bezel: 0.045, cornerR: 0.16, depth: 0.07, chin: 0, stand: 'none', bodyTop: '#878d96', bodyBottom: '#4d525b', glare: 0.07 },
  monitor: { screenW: 1.7778, screenH: 1, bezel: 0.032, cornerR: 0.05, depth: 0.05, chin: 0.11, stand: 'pedestal', bodyTop: '#2b2e33', bodyBottom: '#101215', glare: 0.11 },
  tv: { screenW: 1.7778, screenH: 1, bezel: 0.018, cornerR: 0.03, depth: 0.04, chin: 0, stand: 'feet', bodyTop: '#26282c', bodyBottom: '#0d0e10', glare: 0.09 },
}

/** Rounded-rect outline sampled in device space (screen centred at 0,0). */
function bodyOutline(spec: DeviceSpec, n = 72): Array<[number, number]> {
  const bw = spec.screenW + spec.bezel * 2
  const bh = spec.screenH + spec.bezel * 2 + spec.chin
  const x0 = -bw / 2, y0 = -bh / 2 + spec.chin / 2 // body centre shifted up by chin/2
  const r = spec.cornerR * Math.min(bw, bh)
  const pts: Array<[number, number]> = []
  const corners: Array<[number, number, number]> = [
    [x0 + bw - r, y0 + r, 0], [x0 + bw - r, y0 + bh - r, Math.PI / 2],
    [x0 + r, y0 + bh - r, Math.PI], [x0 + r, y0 + r, Math.PI * 1.5],
  ]
  const per = Math.max(4, Math.round(n / 4))
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= per; i++) {
      const a = a0 + (i / per) * (Math.PI / 2)
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
    }
  }
  return pts
}

interface Cam { cy: number; cx: number; unit: number; persp: number; rotY: number; rotX: number; ox: number; oy: number }
function project(cam: Cam, x: number, y: number, z: number): [number, number] {
  const ry = (cam.rotY * Math.PI) / 180, rx = (cam.rotX * Math.PI) / 180
  // rotate Y then X
  const x1 = x * Math.cos(ry) + z * Math.sin(ry)
  const z1 = -x * Math.sin(ry) + z * Math.cos(ry)
  const y1 = y * Math.cos(rx) - z1 * Math.sin(rx)
  const z2 = y * Math.sin(rx) + z1 * Math.cos(rx)
  const k = cam.persp / Math.max(0.4, cam.persp - z2)
  return [cam.cx + cam.ox + x1 * k * cam.unit, cam.cy + cam.oy + y1 * k * cam.unit]
}

/** Perspective-correct texture map: source canvas onto a projected quad. */
function drawTexturedQuad(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, q: Array<[number, number]>, grid = 7) {
  // q = 4 projected corners TL,TR,BR,BL; bilinear subdivide in source space
  const uv = (u: number, v: number): [number, number] => {
    const top: [number, number] = [lerp(q[0][0], q[1][0], u), lerp(q[0][1], q[1][1], u)]
    const bot: [number, number] = [lerp(q[3][0], q[2][0], u), lerp(q[3][1], q[2][1], u)]
    return [lerp(top[0], bot[0], v), lerp(top[1], bot[1], v)]
  }
  const tri = (a: [number, number], b: [number, number], c: [number, number], sa: [number, number], sb: [number, number], sc: [number, number]) => {
    ctx.save()
    const gx = (a[0] + b[0] + c[0]) / 3, gy = (a[1] + b[1] + c[1]) / 3, bl = 1.03
    const ex2 = (p: [number, number]): [number, number] => [gx + (p[0] - gx) * bl, gy + (p[1] - gy) * bl]
    const [ax, ay] = ex2(a), [bx2, by2] = ex2(b), [cx2, cy2] = ex2(c)
    ctx.beginPath()
    ctx.moveTo(ax, ay); ctx.lineTo(bx2, by2); ctx.lineTo(cx2, cy2); ctx.closePath()
    ctx.clip()
    // affine map source-triangle -> dest-triangle
    const d = (sb[0] - sa[0]) * (sc[1] - sa[1]) - (sb[1] - sa[1]) * (sc[0] - sa[0])
    if (Math.abs(d) < 1e-9) { ctx.restore(); return }
    const m11 = ((b[0] - a[0]) * (sc[1] - sa[1]) - (c[0] - a[0]) * (sb[1] - sa[1])) / d
    const m12 = ((b[1] - a[1]) * (sc[1] - sa[1]) - (c[1] - a[1]) * (sb[1] - sa[1])) / d
    const m21 = ((c[0] - a[0]) * (sb[0] - sa[0]) - (b[0] - a[0]) * (sc[0] - sa[0])) / d
    const m22 = ((c[1] - a[1]) * (sb[0] - sa[0]) - (b[1] - a[1]) * (sc[0] - sa[0])) / d
    const dx = a[0] - m11 * sa[0] - m21 * sa[1]
    const dy = a[1] - m12 * sa[0] - m22 * sa[1]
    ctx.transform(m11, m12, m21, m22, dx, dy)
    ctx.drawImage(src, 0, 0)
    ctx.restore()
  }
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      const u0 = i / grid, u1 = (i + 1) / grid, v0 = j / grid, v1 = (j + 1) / grid
      const p00 = uv(u0, v0), p10 = uv(u1, v0), p11 = uv(u1, v1), p01 = uv(u0, v1)
      const s00: [number, number] = [u0 * sw, v0 * sh], s10: [number, number] = [u1 * sw, v0 * sh]
      const s11: [number, number] = [u1 * sw, v1 * sh], s01: [number, number] = [u0 * sw, v1 * sh]
      tri(p00, p10, p11, s00, s10, s11)
      tri(p00, p11, p01, s00, s11, s01)
    }
  }
}

function polyPath(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
}

/**
 * Renders one transition frame: the device (with `screen` live inside it)
 * over whatever the caller already painted. fill=1 == flat 2D full frame.
 */
export function drawDeviceScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  kind: DeviceKind,
  rig: DeviceRig,
  screen: HTMLCanvasElement,
) {
  const spec = SPECS[kind]
  if (rig.fill >= 0.999) { ctx.drawImage(screen, 0, 0, w, h); return }
  // device unit: fit screen (+body) inside the frame at rig.scale
  const portrait = kind === 'phone'
  const bodyW = spec.screenW + spec.bezel * 2
  const bodyH = spec.screenH + spec.bezel * 2 + spec.chin
  const fit = Math.min(w / bodyW, h / bodyH) * 0.86 * rig.scale
  const cam: Cam = { cx: w / 2, cy: h / 2, unit: fit, persp: 3.4, rotY: rig.rotY, rotX: rig.rotX, ox: rig.x * w, oy: rig.y * h }

  ctx.save()
  // soft ground shadow
  const [shx, shy] = project(cam, 0, bodyH / 2 + 0.06, 0)
  ctx.save()
  ctx.globalAlpha = 0.28 * rig.bodyAlpha
  ctx.filter = `blur(${Math.max(4, Math.round(h * 0.02))}px)`
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.ellipse(shx, shy, fit * bodyW * 0.42, fit * 0.055, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const outline = bodyOutline(spec)
  const front = outline.map(([x, y]) => project(cam, x, y, spec.depth / 2))
  const back = outline.map(([x, y]) => project(cam, x, y, -spec.depth / 2))

  // stand (behind the body)
  if (spec.stand !== 'none' && rig.bodyAlpha > 0.01) {
    ctx.save()
    ctx.globalAlpha = rig.bodyAlpha
    if (spec.stand === 'pedestal') {
      const ny0 = bodyH / 2 - spec.chin * 0.4, ny1 = bodyH / 2 + 0.16
      const nq = [project(cam, -0.09, ny0, -0.02), project(cam, 0.09, ny0, -0.02), project(cam, 0.13, ny1, -0.02), project(cam, -0.13, ny1, -0.02)]
      const g = ctx.createLinearGradient(nq[0][0], nq[0][1], nq[1][0], nq[1][1])
      g.addColorStop(0, '#b9bec6'); g.addColorStop(0.5, '#8d939c'); g.addColorStop(1, '#6c727b')
      polyPath(ctx, nq); ctx.fillStyle = g; ctx.fill()
      const fq = [project(cam, -0.34, ny1 + 0.02, 0.02), project(cam, 0.34, ny1 + 0.02, 0.02), project(cam, 0.3, ny1 + 0.075, 0.12), project(cam, -0.3, ny1 + 0.075, 0.12)]
      polyPath(ctx, fq); ctx.fillStyle = '#9aa0a8'; ctx.fill()
    } else {
      for (const fx of [-0.62, 0.62]) {
        const fq = [project(cam, fx - 0.1, bodyH / 2 - 0.02, -0.02), project(cam, fx + 0.1, bodyH / 2 - 0.02, -0.02), project(cam, fx + 0.13, bodyH / 2 + 0.05, 0.06), project(cam, fx - 0.13, bodyH / 2 + 0.05, 0.06)]
        polyPath(ctx, fq); ctx.fillStyle = '#3a3d42'; ctx.fill()
      }
    }
    ctx.restore()
  }

  // extruded sides (visible slivers when rotated)
  if (rig.bodyAlpha > 0.01) {
    ctx.save()
    ctx.globalAlpha = rig.bodyAlpha
    const ryR = (rig.rotY * Math.PI) / 180, rxR = (rig.rotX * Math.PI) / 180
    for (let i = 0; i < outline.length; i++) {
      const j = (i + 1) % outline.length
      // outward normal in device space (radial approx), rotated like the slab
      let nx = outline[i][0] / (bodyW / 2), ny = outline[i][1] / (bodyH / 2)
      const nl = Math.hypot(nx, ny) || 1
      nx /= nl; ny /= nl
      const nz = -nx * Math.sin(ryR) + ny * Math.sin(rxR) * Math.cos(ryR)
      if (nz <= 0.1) continue // faces away from the camera (margin kills corner fins)
      const shade = 0.45 + 0.35 * Math.cos((outline[i][0] / bodyW) * Math.PI + ryR)
      polyPath(ctx, [front[i], front[j], back[j], back[i]])
      ctx.fillStyle = `rgb(${Math.round(38 * shade + 14)},${Math.round(41 * shade + 14)},${Math.round(46 * shade + 16)})`
      ctx.fill()
    }
    ctx.restore()
  }

  // front slab
  ctx.save()
  ctx.globalAlpha = rig.bodyAlpha
  polyPath(ctx, front)
  const bg = ctx.createLinearGradient(front[0][0], front[0][1], front[Math.floor(outline.length / 2)][0], front[Math.floor(outline.length / 2)][1])
  bg.addColorStop(0, spec.bodyTop); bg.addColorStop(1, spec.bodyBottom)
  ctx.fillStyle = bg
  ctx.fill()
  ctx.restore()

  // screen quad (inset by bezel; expands to full frame during the handoff)
  const sw = spec.screenW / 2, sh2 = spec.screenH / 2
  const chinOff = spec.chin / 2
  const grow = rig.fill
  const ex = lerp(sw, (w / fit / 2) * 1.02, grow)
  const ey = lerp(sh2, (h / fit / 2) * 1.02, grow)
  const ez = lerp(spec.depth / 2 + 0.001, 0, grow)
  const q: Array<[number, number]> = [
    project(cam, -ex, -ey - chinOff * (1 - grow), ez),
    project(cam, ex, -ey - chinOff * (1 - grow), ez),
    project(cam, ex, ey - chinOff * (1 - grow), ez),
    project(cam, -ex, ey - chinOff * (1 - grow), ez),
  ]
  if (rig.bodyAlpha > 0.01) {
    drawTexturedQuad(ctx, screen, screen.width, screen.height, q, portrait ? 6 : 7)
    // glass glare streak
    ctx.save()
    polyPath(ctx, q); ctx.clip()
    ctx.globalAlpha = spec.glare * rig.bodyAlpha
    const gg = ctx.createLinearGradient(q[0][0], q[0][1], q[2][0], q[2][1])
    gg.addColorStop(0.32, 'rgba(255,255,255,0)'); gg.addColorStop(0.5, 'rgba(255,255,255,0.9)'); gg.addColorStop(0.62, 'rgba(255,255,255,0)')
    ctx.fillStyle = gg
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
    // device details
    ctx.save()
    ctx.globalAlpha = rig.bodyAlpha
    if (kind === 'phone') {
      const [px, py] = project(cam, 0, -sh2 - spec.bezel * 0.5 + chinOff, spec.depth / 2 + 0.002)
      ctx.fillStyle = '#0b0c0e'
      ctx.beginPath(); ctx.arc(px, py, Math.max(1.5, fit * 0.016), 0, Math.PI * 2); ctx.fill()
    } else if (spec.chin > 0) {
      const [lx, ly] = project(cam, 0, sh2 + spec.chin * 0.5 - chinOff, spec.depth / 2 + 0.002)
      ctx.fillStyle = 'rgba(210,215,222,0.75)'
      ctx.beginPath(); ctx.arc(lx, ly, Math.max(1.2, fit * 0.012), 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  } else {
    ctx.drawImage(screen, 0, 0, w, h)
  }
  ctx.restore()
}

/* -------------------- AI green-screen plate keying ---------------------- */
export interface KeyedDevice { canvas: HTMLCanvasElement; box: { x: number; y: number; w: number; h: number } }
const keyedCache = new Map<string, KeyedDevice>()

/**
 * Chroma-keys an AI green-screen device plate: removes pure chroma green AND
 * the near-white studio background, with soft alpha on mixed edge pixels.
 * Returns the transparent overlay plus the screen bounding box (green bbox).
 */
export function keyDeviceImage(key: string, img: HTMLImageElement | HTMLCanvasElement): KeyedDevice {
  const hit = keyedCache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = img.width || (img as HTMLImageElement).naturalWidth
  c.height = img.height || (img as HTMLImageElement).naturalHeight
  const x = c.getContext('2d', { willReadFrequently: true })!
  x.drawImage(img, 0, 0)
  const im = x.getImageData(0, 0, c.width, c.height)
  const d = im.data
  let minX = c.width, minY = c.height, maxX = -1, maxY = -1
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2]
    const greenness = Math.max(0, Math.min(1, (g - Math.max(r, b)) / 90))
    const whitish = r > 232 && g > 232 && b > 232 && Math.max(r, g, b) - Math.min(r, g, b) < 14
    let alpha = 255
    if (whitish) alpha = 0
    else if (greenness > 0) alpha = Math.round(255 * (1 - Math.min(1, greenness * 1.35)))
    d[i + 3] = Math.min(d[i + 3], alpha)
    if (alpha < 40 && greenness > 0.5) {
      const p = i / 4, px = p % c.width, py = Math.floor(p / c.width)
      if (px < minX) minX = px; if (px > maxX) maxX = px
      if (py < minY) minY = py; if (py > maxY) maxY = py
    }
  }
  // despill: pull green out of semi-transparent edge pixels
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 0 && d[i + 3] < 250) {
      const over = Math.max(0, d[i + 1] - Math.max(d[i], d[i + 2]))
      d[i + 1] -= over * 0.7
    }
  }
  x.putImageData(im, 0, 0)
  const out: KeyedDevice = { canvas: c, box: { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) } }
  keyedCache.set(key, out)
  return out
}

/**
 * Static-ish device overlay: the keyed AI plate floats over the clip with a
 * gentle bob/tilt; the clip's own pixels show through the chroma hole.
 */
export function drawDeviceOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, keyed: KeyedDevice, time: number) {
  const { canvas: kc, box } = keyed
  const margin = 0.9
  const s = Math.min((w * margin) / kc.width, (h * margin) / kc.height)
  const dw = kc.width * s, dh = kc.height * s
  const bob = Math.sin(time * 1.35) * h * 0.008
  const tilt = Math.sin(time * 0.85) * 0.014
  ctx.save()
  ctx.translate(w / 2, h / 2 + bob)
  ctx.rotate(tilt)
  // soft drop shadow under the plate
  ctx.save()
  ctx.globalAlpha = 0.3
  ctx.filter = `blur(${Math.max(6, Math.round(h * 0.02))}px)`
  ctx.fillStyle = '#000'
  ctx.beginPath(); ctx.ellipse(0, dh / 2 - 6 * s, dw * 0.34, 10 * s, 0, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
  ctx.drawImage(kc, -dw / 2, -dh / 2, dw, dh)
  ctx.restore()
  return { box, s, dw, dh }
}

/* ---------------- async plate loading for the overlay pass -------------- */
const plateState = new Map<string, KeyedDevice | 'loading' | 'missing'>()

/** Returns the keyed AI plate once loaded (null while loading/missing). */
export function ensureKeyedDevice(e?: { deviceOverlay?: 'none' | 'phone' | 'monitor' } | null): KeyedDevice | null {
  const kind = e?.deviceOverlay
  if (!kind || kind === 'none') return null
  const cur = plateState.get(kind)
  if (cur && cur !== 'loading' && cur !== 'missing') return cur
  if (!cur && typeof document !== 'undefined' && typeof Image !== 'undefined') {
    plateState.set(kind, 'loading')
    const img = new Image()
    img.onload = () => {
      try { plateState.set(kind, keyDeviceImage(`plate-${kind}`, img)) } catch { plateState.set(kind, 'missing') }
    }
    img.onerror = () => plateState.set(kind, 'missing')
    img.src = `/devices/${kind}-greenscreen.png`
  }
  return null
}
export function hasDeviceOverlay(e?: { deviceOverlay?: 'none' | 'phone' | 'monitor' } | null): boolean {
  return !!e?.deviceOverlay && e.deviceOverlay !== 'none'
}
