/** Device transitions share rig mathematics across real GLB/WebGL rendering
 * and the perspective Canvas fallback. The browser preloads the bundled
 * authored/converted GLBs with a separately UV-mapped ScreenSurface. The live
 * composited incoming frame is the screen texture, including its alpha.
 * Legacy green-screen overlays remain separate and backwards compatible.
 */

export const DEVICE_KINDS = ['phone', 'monitor', 'tv', 'laptop'] as const
export type DeviceKind = (typeof DEVICE_KINDS)[number]

export interface DeviceRenderOptions {
  motion?: string
  model?: string
  fit?: 'cover' | 'contain' | 'stretch'
  fov?: number
  brightness?: number
  cameraDistance?: number
  yaw?: number
  pitch?: number
  roll?: number
  keyLight?: number
  rimLight?: number
  environmentLight?: number
}
let modelDrawer: typeof import('./deviceModelRenderer').drawModelDevice | null = null
let modelModule: Promise<typeof import('./deviceModelRenderer')> | null = null
export async function prepareDeviceModels(): Promise<void> {
  if (typeof window === 'undefined') return
  if (!modelModule) modelModule = import('./deviceModelRenderer')
  const module = await modelModule
  modelDrawer = module.drawModelDevice
  await Promise.all(module.DEVICE_MODELS.map(id => module.preloadDeviceModel(id)))
}
export async function deviceModelsStatus() { return (await modelModule)?.deviceRendererStatus() }
export interface DeviceRig {
  rotY: number // degrees
  rotZ?: number // degrees
  rotX: number // degrees
  scale: number
  x: number // fraction of frame width
  y: number // fraction of frame height
  fill: number // 0 = device view, 1 = screen fills frame (2D handoff)
  bodyAlpha: number
  staticAmount?: number
  staticSeed?: number
}

/* ------------------------------- easing -------------------------------- */
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a))

export const DEVICE_MOTIONS = ['pop-in','rotate-reveal','screen-replace','swing-in','fullscreen-burst','static-reveal','push','pullback','screen-tunnel','device-wall','laptop-reveal','flip','perspective-zoom','orbit','crash-zoom','float-pullback','spin-reveal','barrel-roll','drop-bounce'] as const

/** Keyframed rig channels for the 3D→2D device transition. */
export function rigAt(kind: DeviceKind, p: number, motion = 'rotate-reveal'): DeviceRig {
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
  const rig: DeviceRig = { rotY, rotX, scale, x, y, fill, bodyAlpha }
  const enter = 1-eA, settle = 1-eB
  switch(motion) {
    case 'spin-reveal': rig.rotY=-360*enter; rig.rotX=12*enter; rig.scale*=1-.4*enter; break;
    case 'barrel-roll': rig.rotZ=-120*enter; rig.rotY=-30*enter; rig.x=-.3*enter; break;
    case 'drop-bounce': rig.y=-.7*enter+.1*Math.sin(a*Math.PI*3)*settle; rig.rotX=25*enter; rig.rotY*=.35; break;
    case 'pop-in': rig.scale *= 1-.8*enter; rig.y += .22*enter - .04*Math.sin(a*Math.PI)*settle; rig.rotY *= .25; break;
    case 'screen-replace': rig.rotY=0; rig.rotX=0; rig.x=0; rig.scale*=1-.25*enter; break;
    case 'swing-in': rig.x=-.65*enter; rig.rotY=-100*enter-8*settle; break;
    case 'fullscreen-burst': rig.scale*=1-.7*enter; rig.fill=Math.max(fill,easeInOutCubic(seg(t,.6,1))); break;
    case 'static-reveal': rig.staticAmount=enter*.85; rig.staticSeed=Math.floor(t*30); rig.rotY=0; rig.x=Math.sin(t*170)*.015*enter; rig.scale*=1-.25*enter; break;
    case 'push': rig.rotY=-25*enter; rig.scale*=.5+.5*eA; rig.fill=Math.max(fill,easeInOutCubic(seg(t,.65,1))); break;
    case 'pullback': rig.fill=1-easeInOutCubic(seg(t,0,.65)); rig.rotY=25*Math.sin(t*Math.PI)*settle; rig.scale*=1-.3*eA; rig.x=.15*eA; break;
    case 'screen-tunnel': rig.rotY=40*Math.sin(t*Math.PI*3)*enter; rig.scale*=1-.7*enter; break;
    case 'device-wall': rig.rotY=35*enter; rig.x=.3*enter; break;
    case 'laptop-reveal': rig.rotX=-65*enter; rig.rotY=18*enter; rig.y=.15*enter; break;
    case 'flip': rig.rotY=-180*enter; rig.rotX=0; break;
    case 'perspective-zoom': rig.rotY=-55*settle*(1-fill); rig.rotX=15*settle*(1-fill); rig.scale*=.7+.3*eA; break;
    case 'orbit': rig.rotY=-85*enter+20*Math.sin(t*Math.PI)*settle; rig.x=.25*Math.sin(t*Math.PI*2)*enter; rig.y=-.15*Math.sin(t*Math.PI)*enter; break;
    case 'crash-zoom': rig.scale*=.8+.2*eA; rig.fill=easeOutCubic(seg(t,.9,1)); break;
    case 'float-pullback': rig.scale*=1.7-.7*eA; rig.y=-.18*Math.sin(t*Math.PI)*settle; rig.rotX=18*enter; break;
  }
  return rig
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
  laptop: { screenW: 1.63, screenH: 1, bezel: .035, cornerR: .04, depth: .04, chin: .06, stand: 'pedestal', bodyTop: '#424650', bodyBottom: '#181b24', glare: .08 },
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
    [x0 + bw - r, y0 + r, -Math.PI / 2], [x0 + bw - r, y0 + bh - r, 0],
    [x0 + r, y0 + bh - r, Math.PI / 2], [x0 + r, y0 + r, Math.PI],
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
function drawTexturedQuad(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, q: Array<[number, number]>, grid = 7, crop = { x: 0, y: 0, w: sw, h: sh }) {
  // A homography maps a rectangle to a perspective quad. Bilinear
  // interpolation warped straight screen edges and stretched the far side.
  const dx1=q[1][0]-q[2][0], dx2=q[3][0]-q[2][0], dx3=q[0][0]-q[1][0]+q[2][0]-q[3][0]
  const dy1=q[1][1]-q[2][1], dy2=q[3][1]-q[2][1], dy3=q[0][1]-q[1][1]+q[2][1]-q[3][1]
  const det=dx1*dy2-dx2*dy1
  const g=Math.abs(det)<1e-9?0:(dx3*dy2-dx2*dy3)/det, hh=Math.abs(det)<1e-9?0:(dx1*dy3-dx3*dy1)/det
  const aa=q[1][0]-q[0][0]+g*q[1][0], bb=q[3][0]-q[0][0]+hh*q[3][0]
  const dd=q[1][1]-q[0][1]+g*q[1][1], ee=q[3][1]-q[0][1]+hh*q[3][1]
  const uv=(u:number,v:number):[number,number]=>{
    const z=g*u+hh*v+1
    return [(aa*u+bb*v+q[0][0])/z,(dd*u+ee*v+q[0][1])/z]
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
      const s00: [number, number] = [crop.x + u0 * crop.w, crop.y + v0 * crop.h], s10: [number, number] = [crop.x + u1 * crop.w, crop.y + v0 * crop.h]
      const s11: [number, number] = [crop.x + u1 * crop.w, crop.y + v1 * crop.h], s01: [number, number] = [crop.x + u0 * crop.w, crop.y + v1 * crop.h]
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
  options: DeviceRenderOptions = {},
) {
  const angle=(value: number | undefined) => Number.isFinite(value) ? Math.max(-180,Math.min(180,value!)) : 0
  rig={...rig,rotY:rig.rotY+angle(options.yaw)*(1-rig.fill),rotX:rig.rotX+angle(options.pitch)*(1-rig.fill),rotZ:(rig.rotZ||0)+angle(options.roll)*(1-rig.fill)}
  if (modelDrawer && rig.fill < .8 && (options.motion === 'device-wall' || options.motion === 'screen-tunnel')) {
    const copies = options.motion === 'device-wall' ? [-1, 1] : [-2, -1, 1, 2]
    for (const n of copies) {
      ctx.save(); ctx.globalAlpha *= (1-rig.fill) * .7
      modelDrawer(ctx, w, h, kind, { ...rig, x: rig.x+n*.24*(1-rig.fill), y: rig.y+Math.abs(n)*.05, scale:rig.scale*(.6/Math.abs(n)), rotY:rig.rotY-n*18 }, screen, options)
      ctx.restore()
    }
  }
  if (modelDrawer?.(ctx, w, h, kind, rig, screen, options)) return
  const spec = SPECS[kind]
  if (rig.fill >= 0.999) { ctx.drawImage(screen, 0, 0, w, h); return }
  // device unit: fit screen (+body) inside the frame at rig.scale
  const portrait = kind === 'phone'
  const bodyW = spec.screenW + spec.bezel * 2
  const bodyH = spec.screenH + spec.bezel * 2 + spec.chin
  const fit = Math.min(w / bodyW, h / bodyH) * 0.86 * rig.scale
  const cam: Cam = { cx: w / 2, cy: h / 2, unit: fit, persp: 3.4, rotY: rig.rotY, rotX: rig.rotX, ox: rig.x * w, oy: rig.y * h }

  ctx.save()
  ctx.translate(w/2,h/2);ctx.rotate((rig.rotZ||0)*Math.PI/180);ctx.translate(-w/2,-h/2)
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
  const targetAspect=lerp(spec.screenW/spec.screenH,w/h,rig.fill), sourceAspect=screen.width/screen.height
  const mode=options.fit ?? 'cover'
  const cropW=mode==='cover' && sourceAspect>targetAspect ? screen.height*targetAspect : screen.width
  const cropH=mode==='cover' && sourceAspect<targetAspect ? screen.width/targetAspect : screen.height
  ctx.save()
  if(options.brightness!==undefined)ctx.filter=`brightness(${lerp(options.brightness,1,rig.fill)})`
  drawTexturedQuad(ctx, screen, screen.width, screen.height, q, portrait ? 8 : 9, {x:(screen.width-cropW)/2,y:(screen.height-cropH)/2,w:cropW,h:cropH})
  ctx.restore()
  if (rig.bodyAlpha > 0.01) {
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
