// OmniFrame preview engine.
//
// This is the real renderer. It runs its own requestAnimationFrame loop and
// reads editor state imperatively (useEditor.getState()), so per-frame
// playback never triggers React re-renders of the whole tree. That is what
// keeps scrubbing/dragging smooth instead of "taking 2 seconds and blinking".
//
// Compositing model (a real, if foundational, one):
//   - each media asset gets one cached <video>/<audio>/<img> element
//   - for the current playhead we find the active clip on every track
//   - video tracks are drawn in z-order (later track = on top) onto the canvas
//   - audio tracks are synced/played in lock-step
//   - drift is corrected by occasional currentTime seeks, not per-frame seeks

import { applyPatchUnder, type PatchUnderSpec } from './patchUnder'

/** AM-named procedural family: warped local time + auto-shake offset. */
function evalClipPfx(clip: import('../types').Clip, time: number): ReturnType<typeof evaluateClipAnimation> {
  // Effect instances dropped on the clip join its own effects for the
  // procedural pass too (oscillate/auto-shake/strobe/echo are keyframeable
  // from the Effects tab exactly like the pixel engines).
  const eff = mergeFxInstances(clip, fxLocalTime(clip, time))
  const t2 = pfxLocalTime(eff, time, clip.start, clip.duration)
  const ev = evaluateClipAnimation(clip, t2)
  const sh = pfxShake(eff, time)
    const osc = pfxOscillate(eff, time)
    sh.dx += osc.dx; sh.dy += osc.dy
  ev.x += sh.dx
  ev.y += sh.dy
  return ev
}
import { pfxLocalTime, pfxShake, pfxEchoTimes, pfxMotionBlurSamples , pfxOscillate } from './proceduralFx'
import { mergeFxInstances, fxLocalTime } from './fxInstances'
import { remapClipLocal } from './speedCurves'
import { useEditor } from '../store'
import type { Clip, ClipAdjustmentMask, ClipEffect, ClipVisualMask, MediaAsset, RigPart, RigResolvedPart, Track, Transition } from '../types'
import { clamp } from './time'
import { renderAllPaintLayers } from './drawingEngine'
import { evaluateClipAnimation, rotationXYMatrix } from './animation/CurveEngine'

/** Applies orthographic Rotation X/Y (3-axis flip) to the current transform. */
function applyRotationXY(ctx: CanvasRenderingContext2D, rotationX?: number, rotationY?: number): void {
  if (!rotationX && !rotationY) return
  const m = rotationXYMatrix(rotationX || 0, rotationY || 0)
  ctx.transform(m.a, m.b, m.c, m.d, 0, 0)
}
import { applyLutStackToCanvas, resolveLutRef, whenLutsLoaded, type LutStackItem } from './lutEngine'
import { applyPixelGrade, hasPixelGrade } from './pixelGrade'
import { applyClipFxLayers, hasClipFxLayers, drawReplaceBg, drawParticleFx } from './particleFx'
import { drawDeviceScene, rigAt, hasDeviceOverlay, ensureKeyedDevice, drawDeviceOverlay, type DeviceKind } from './device3d'
import { evalNumKeys, evalColorKeys, type CharRange } from './textRuns'
import { applyGlitchNG, hasNg, type NgEffect } from './glitchNG'
import { inheritedWorld } from './parentChain'
import { resolveRig, stablePartSeed } from './rigging'
import { drawPuppetWarp } from './puppetWarp'
import { getLayeredArtworkInfo, toCanvasCompositeOperation } from './layeredArtworkMetadata'
import type { VisualPreview } from './visualPreview'
import { drawPillarFamily } from './pillarRenderers'
import { PILLAR_DEF_BY_TYPE } from './transitionPresets'

export const PW = 1280
export const PH = 720

const videoCache = new Map<string, HTMLVideoElement>()
const audioCache = new Map<string, HTMLAudioElement>()
const imageCache = new Map<string, HTMLImageElement>()

// A hidden host keeps media elements in the document so every browser
// reliably decodes frames for drawImage / captureStream.
let hostEl: HTMLElement | null = null
function mediaHost(): HTMLElement {
  if (!hostEl) {
    hostEl = document.createElement('div')
    hostEl.style.cssText =
      'position:absolute;left:-99999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;'
    document.body.appendChild(hostEl)
  }
  return hostEl
}

function getVideo(asset: MediaAsset): HTMLVideoElement {
  let v = videoCache.get(asset.id)
  if (!v) {
    v = document.createElement('video')
    v.src = asset.url
    v.preload = 'auto'
    v.muted = false
    v.playsInline = true
    v.loop = false
    videoCache.set(asset.id, v)
    mediaHost().appendChild(v)
  }
  return v
}

function getAudio(asset: MediaAsset): HTMLAudioElement {
  let a = audioCache.get(asset.id)
  if (!a) {
    a = document.createElement('audio')
    a.src = asset.url
    a.preload = 'auto'
    a.loop = false
    audioCache.set(asset.id, a)
    mediaHost().appendChild(a)
  }
  return a
}

function getImage(asset: MediaAsset): HTMLImageElement {
  let i = imageCache.get(asset.id)
  if (!i) {
    i = new Image()
    i.src = asset.url
    imageCache.set(asset.id, i)
  }
  return i
}

const urlImageCache = new Map<string, HTMLImageElement>()
let activePreviewEngine: PreviewEngine | null = null

export function preloadRoomAssets() {
  const urls = [
    '/assets/room/clean_room_background.png',
    '/assets/room/obj_towel.png',
    '/assets/room/obj_towel_blue.png',
    '/assets/room/obj_towel_red.png',
    '/assets/room/obj_towel_green.png',
    '/assets/room/obj_towel_gold.png',
    '/assets/room/obj_towel_purple.png',
    '/assets/room/obj_chair.png',
    '/assets/room/obj_curtain.png',
    '/assets/death_note/clean_background.png',
    '/assets/death_note/char_light.png',
    '/assets/death_note/char_l.png',
    '/assets/death_note/char_mello.png',
    '/assets/death_note/char_near.png',
    '/assets/death_note/char_ryuk.png',
  ]
  if (typeof window !== 'undefined') {
    urls.forEach((u) => getUrlImage(u))
  }
}

if (typeof window !== 'undefined') {
  preloadRoomAssets()
}

function getUrlImage(url: string): HTMLImageElement {
  let img = urlImageCache.get(url)
  if (!img) {
    img = new Image()
    img.onload = () => {
      if (activePreviewEngine) {
        activePreviewEngine.redraw()
      }
    }
    img.src = url
    urlImageCache.set(url, img)
  }
  return img
}

export function allMediaElements(): HTMLMediaElement[] {
  return [
    ...Array.from(videoCache.values()),
    ...Array.from(audioCache.values()),
  ]
}

function activeClipOnTrack(clips: Clip[], trackId: string, time: number): Clip | undefined {
  return clips.find(
    (c) => !c.hidden && c.trackId === trackId && time >= c.start && time < c.start + c.duration,
  )
}

function effectFilterString(effect?: ClipEffect): string {
  if (!effect) return ''
  const filters: string[] = []
  if (typeof effect.brightness === 'number' && effect.brightness !== 1) filters.push(`brightness(${effect.brightness})`)
  if (typeof effect.contrast === 'number' && effect.contrast !== 1) filters.push(`contrast(${effect.contrast})`)
  if (typeof effect.saturation === 'number' && effect.saturation !== 1) filters.push(`saturate(${effect.saturation})`)
  if (typeof effect.blur === 'number' && effect.blur > 0) filters.push(`blur(${effect.blur}px)`)
  if (typeof effect.grayscale === 'number' && effect.grayscale > 0) filters.push(`grayscale(${effect.grayscale})`)
  if (typeof effect.invert === 'number' && effect.invert > 0) filters.push(`invert(${effect.invert})`)
  if (typeof effect.sepia === 'number' && effect.sepia > 0) filters.push(`sepia(${effect.sepia})`)
  if (typeof effect.hueRotate === 'number' && effect.hueRotate > 0) filters.push(`hue-rotate(${effect.hueRotate}deg)`)
  return filters.join(' ')
}

/** Preserve a parent compound's filter while adding this clip's own filters. */
function applyClipFilter(ctx: CanvasRenderingContext2D, effect?: ClipEffect) {
  const local = effectFilterString(effect)
  if (!local) return
  const inherited = ctx.filter && ctx.filter !== 'none' ? ctx.filter : ''
  ctx.filter = inherited ? `${inherited} ${local}` : local
}

/** '#rrggbb'/'#rgb'/'rgb(...)' + alpha -> rgba() string (falls back to warm white). */
function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha))
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((ch) => ch + ch).join('') : hex[1]
    return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`
  }
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(color.trim())
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${a})`
  return `rgba(255, 217, 160, ${a})`
}

/**
 * Gold Motion-style light layer: a radial light (Point, or Spot = squashed
 * ellipse) composited with 'screen' over everything drawn so far.
 */
function applyLightComposite(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  effect?: ClipEffect,
): void {
  const intensity = effect?.lightIntensity ?? 0
  if (!effect || intensity <= 0) return
  const cx = (effect.lightX ?? 0.5) * width
  const cy = (effect.lightY ?? 0.4) * height
  const radius = Math.max(24, (effect.lightFalloff ?? 0.45) * Math.max(width, height))
  const color = effect.lightColor || '#ffd9a0'
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
  gradient.addColorStop(0, withAlpha(color, Math.min(1, intensity)))
  gradient.addColorStop(1, withAlpha(color, 0))
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = 1
  ctx.filter = 'none'
  if (effect.lightType === 'spot') {
    ctx.translate(cx, cy)
    ctx.scale(1, 0.55)
    ctx.translate(-cx, -cy)
  }
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

export class PreviewEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private backCanvas: HTMLCanvasElement
  private backCtx: CanvasRenderingContext2D
  private raf = 0
  private last = 0
  private running = false
  private width: number
  private height: number
  private unsubscribe: (() => void) | null = null
  private usedThisFrame = new Set<HTMLMediaElement>()
  private requestedTime = new WeakMap<HTMLMediaElement, number>()
  private sampling = false
  private samplePool = new Map<string, HTMLVideoElement | HTMLAudioElement>()

  constructor(canvas: HTMLCanvasElement, width = PW, height = PH, opts: { sampling?: boolean } = {}) {
    this.canvas = canvas
    this.width = width
    this.height = height
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('2D canvas context unavailable')
    this.ctx = ctx
    this.backCanvas = document.createElement('canvas')
    this.backCanvas.width = width
    this.backCanvas.height = height
    const backCtx = this.backCanvas.getContext('2d', { alpha: false })
    if (!backCtx) throw new Error('2D back-buffer context unavailable')
    this.backCtx = backCtx
    this.sampling = !!opts.sampling
    if (!this.sampling) activePreviewEngine = this
  }

  resize(width: number, height: number) {
    if (this.width === width && this.height === height) return
    this.width = width
    this.height = height
    this.canvas.width = width
    this.canvas.height = height
    this.backCanvas.width = width
    this.backCanvas.height = height
  }

  // ---- adjustment layers & LUT rendering -------------------------------

  /** Offscreen canvases used to isolate per-clip/compound LUT grading. */
  private padPool: HTMLCanvasElement[] = []
  private padInUse = new Set<HTMLCanvasElement>()
  private scratchPool: HTMLCanvasElement[] = []
  private scratchInUse = new Set<HTMLCanvasElement>()
  private adjustmentMaskCanvas: HTMLCanvasElement | null = null
  private shapeMatteCanvas: HTMLCanvasElement | null = null
  /** One bounded reusable surface avoids a full-canvas allocation per rigged layer. */
  private puppetCanvas: HTMLCanvasElement | null = null
  /** Resolve each PSD rig's hierarchy once per rendered frame. */
  private resolvedArtworkRigCache = new Map<string, Map<string, RigResolvedPart>>()
  /** Oversized (3× frame) scratch pool: isolated renders (LUT/mask/grade inside a
   *  compound, or a graded oversized clip) must NOT bitmap-clip children at the
   *  frame edge — a 1000×1000 element in a 100×100 view used to lose everything
   *  outside the view once compounded+graded, then scaling the compound showed
   *  only the clipped snapshot. ±1 frame of margin keeps the element alive. */
  private takePadScratch(): HTMLCanvasElement {
    let c = this.padPool.find((x) => !this.padInUse.has(x))
    if (!c) {
      c = document.createElement('canvas')
      c.width = this.width * 3
      c.height = this.height * 3
      this.padPool.push(c)
    }
    this.padInUse.add(c)
    const c2 = c.getContext('2d')!
    c2.setTransform(1, 0, 0, 1, 0, 0)
    c2.filter = 'none'
    c2.globalAlpha = 1
    c2.globalCompositeOperation = 'source-over'
    c2.clearRect(0, 0, c.width, c.height)
    return c
  }
  private releasePadScratch(c: HTMLCanvasElement) { this.padInUse.delete(c) }

  private takeScratch(): HTMLCanvasElement {
    let c = this.scratchPool.find((x) => !this.scratchInUse.has(x))
    if (!c) {
      c = document.createElement('canvas')
      c.width = this.width
      c.height = this.height
      this.scratchPool.push(c)
    }
    this.scratchInUse.add(c)
    const c2 = c.getContext('2d')!
    c2.setTransform(1, 0, 0, 1, 0, 0)
    c2.filter = 'none'
    c2.globalAlpha = 1
    c2.globalCompositeOperation = 'source-over'
    c2.clearRect(0, 0, this.width, this.height)
    return c
  }
  private releaseScratch(c: HTMLCanvasElement) {
    this.scratchInUse.delete(c)
  }

  /**
   * Build a shape matte and multiply it into the scratch canvas alpha.
   * Normal mode keeps the shape region (strength = mask opacity); inverted
   * mode keeps frame − shape. Feather blurs the shape coverage so the
   * boundary falls off smoothly in both modes.
   */
  private applyShapeMatte(
    scratch: HTMLCanvasElement,
    opts: {
      shape: 'ellipse' | 'rectangle'
      centerX: number
      centerY: number
      width: number
      height: number
      rotation?: number
      feather: number
      expansion?: number
      inverted: boolean
      opacity?: number
    },
    coveragePainter?: (shctx: CanvasRenderingContext2D) => void,
  ) {
    if (!this.adjustmentMaskCanvas) this.adjustmentMaskCanvas = document.createElement('canvas')
    if (!this.shapeMatteCanvas) this.shapeMatteCanvas = document.createElement('canvas')
    const matte = this.adjustmentMaskCanvas
    const shapeCanvas = this.shapeMatteCanvas
    for (const c of [matte, shapeCanvas]) {
      if (c.width !== this.width) c.width = this.width
      if (c.height !== this.height) c.height = this.height
    }
    const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
    const scale = this.width / PW
    const centerX = clamp01(opts.centerX) * this.width
    const centerY = clamp01(opts.centerY) * this.height
    const expandPx = (opts.expansion || 0) * scale
    const width = Math.max(1, clamp01(opts.width) * this.width + expandPx * 2)
    const height = Math.max(1, clamp01(opts.height) * this.height + expandPx * 2)
    const feather = Math.max(0, Math.min(240, opts.feather || 0)) * scale
    const opacity = clamp01(opts.opacity ?? 1)
    const outsideAlpha = opts.inverted ? 1 : 1 - opacity

    // Shape coverage (white, blurred edges), drawn rotated about its center.
    const shctx = shapeCanvas.getContext('2d')!
    shctx.save()
    shctx.setTransform(1, 0, 0, 1, 0, 0)
    shctx.filter = 'none'
    shctx.globalAlpha = 1
    shctx.globalCompositeOperation = 'source-over'
    shctx.clearRect(0, 0, this.width, this.height)
    if (coveragePainter) {
      if (feather > 0) shctx.filter = `blur(${feather}px)`
      coveragePainter(shctx)
      shctx.restore()
    } else {
    shctx.translate(centerX, centerY)
    if (opts.rotation) shctx.rotate(((opts.rotation || 0) * Math.PI) / 180)
    if (feather > 0) shctx.filter = `blur(${feather}px)`
    shctx.fillStyle = '#fff'
    if (opts.shape === 'ellipse') {
      shctx.beginPath()
      shctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2)
      shctx.fill()
    } else {
      shctx.fillRect(-width / 2, -height / 2, width, height)
    }
    shctx.restore()
    }

    const mctx = matte.getContext('2d')!
    mctx.save()
    mctx.setTransform(1, 0, 0, 1, 0, 0)
    mctx.filter = 'none'
    mctx.globalAlpha = 1
    mctx.globalCompositeOperation = 'source-over'
    mctx.clearRect(0, 0, this.width, this.height)
    mctx.fillStyle = `rgba(255, 255, 255, ${outsideAlpha})`
    mctx.fillRect(0, 0, this.width, this.height)
    if (opts.inverted) {
      // Erase the shape coverage at mask strength, leaving frame − shape.
      mctx.globalCompositeOperation = 'destination-out'
      mctx.globalAlpha = opacity
    }
    mctx.drawImage(shapeCanvas, 0, 0)
    mctx.restore()

    const sctx = scratch.getContext('2d')!
    sctx.save()
    sctx.setTransform(1, 0, 0, 1, 0, 0)
    sctx.filter = 'none'
    sctx.globalAlpha = 1
    sctx.globalCompositeOperation = 'destination-in'
    sctx.drawImage(matte, 0, 0)
    sctx.restore()
  }

  /** Effect-region matte for adjustment clips. */
  private applyAdjustmentMask(scratch: HTMLCanvasElement, mask: ClipAdjustmentMask) {
    this.applyShapeMatte(scratch, { ...mask, rotation: 0, expansion: 0, opacity: 1 })
  }

  /** On-screen view region of a clip (canvas px): its placed frame,
   *  narrowed to the Video Mask View window when a shape mask is enabled
   *  (a 100x100 clip masked to 10x10 is a 10x10 target for drawing). */
  private clipViewRect(
    clip: import('../types').Clip,
    st: ReturnType<typeof useEditor.getState>,
    time: number,
  ): { x: number; y: number; w: number; h: number } | null {
    const asset = st.assets.find((a) => a.id === clip.assetId)
    const vw = asset?.width || PW
    const vh = asset?.height || PH
    const cover = Math.max(this.width / vw, this.height / vh)
    const evalT = evalClipPfx(clip, time)
    const w = vw * cover * Math.abs(evalT.scaleX || 1)
    const h = vh * cover * Math.abs(evalT.scaleY || 1)
    const cx = this.width / 2 + evalT.x * (this.width / PW)
    const cy = this.height / 2 + evalT.y * (this.height / PH)
    let rect = { x: cx - w / 2, y: cy - h / 2, w, h }
    const mask = clip.mask
    if (mask?.enabled && (!mask.kind || mask.kind === 'shape')) {
      const eff = this.effectiveMask(mask, Math.max(0, time - clip.start))
      const mx = (eff.centerX - eff.width / 2) * this.width
      const my = (eff.centerY - eff.height / 2) * this.height
      const mw = eff.width * this.width
      const mh = eff.height * this.height
      const ix = Math.max(rect.x, mx)
      const iy = Math.max(rect.y, my)
      const iw = Math.min(rect.x + rect.w, mx + mw) - ix
      const ih = Math.min(rect.y + rect.h, my + mh) - iy
      if (iw <= 0 || ih <= 0) return null
      rect = { x: ix, y: iy, w: iw, h: ih }
    }
    return rect
  }

  /** Mask geometry at a clip-local time, with keyframe interpolation. */
  private effectiveMask(mask: import('../types').ClipVisualMask, localTime: number): import('../types').ClipVisualMask {
    const kfs = [...(mask.keyframes || [])].sort((a, b) => a.time - b.time)
    if (kfs.length === 0) return mask
    const apply = (k: import('../types').MaskViewKeyframe): import('../types').ClipVisualMask => ({
      ...mask,
      centerX: k.centerX,
      centerY: k.centerY,
      width: k.width,
      height: k.height,
      rotation: k.rotation,
      splitPos: k.splitPos ?? mask.splitPos,
    })
    if (localTime <= kfs[0].time) return apply(kfs[0])
    if (localTime >= kfs[kfs.length - 1].time) return apply(kfs[kfs.length - 1])
    let i = 0
    while (i < kfs.length - 2 && kfs[i + 1].time <= localTime) i++
    const a = kfs[i]
    const b = kfs[i + 1]
    const span = Math.max(1e-6, b.time - a.time)
    let t = Math.max(0, Math.min(1, (localTime - a.time) / span))
    if (b.easing === 'smooth') t = t * t * (3 - 2 * t)
    else if (b.easing === 'ease-in') t = t * t
    else if (b.easing === 'ease-out') t = 1 - (1 - t) * (1 - t)
    const lerp = (u: number, v: number) => u + (v - u) * t
    return {
      ...mask,
      centerX: lerp(a.centerX, b.centerX),
      centerY: lerp(a.centerY, b.centerY),
      width: lerp(a.width, b.width),
      height: lerp(a.height, b.height),
      rotation: lerp(a.rotation, b.rotation),
      splitPos: lerp(a.splitPos ?? mask.splitPos ?? 0.5, b.splitPos ?? mask.splitPos ?? 0.5),
    }
  }

  /** Clip Mask: hide part of the clip itself (after its filters/LUTs). */
  private applyClipVisualMask(scratch: HTMLCanvasElement, mask: ClipVisualMask, localTime = 0) {
    if (!mask.enabled) return
    const eff = this.effectiveMask(mask, localTime)
    const kind = eff.kind || 'shape'
    if (kind === 'shape') {
      this.applyShapeMatte(scratch, eff)
      return
    }
    const W = this.width
    const H = this.height
    const coverage = (shctx: CanvasRenderingContext2D) => {
      shctx.fillStyle = '#fff'
      if (kind === 'split') {
        // Infinite dividing line: draggable position + any rotation.
        const angle = ((eff.splitAngle ?? 0) * Math.PI) / 180
        const nx = Math.cos(angle)
        const ny = Math.sin(angle)
        const d = ((eff.splitPos ?? 0.5) - 0.5) * Math.hypot(W, H)
        const px = W / 2 + nx * d
        const py = H / 2 + ny * d
        const diag = Math.hypot(W, H)
        shctx.save()
        shctx.translate(px, py)
        shctx.rotate(angle + Math.PI / 2)
        shctx.fillRect(-diag, -diag, diag * 2, diag)
        shctx.restore()
      } else if (kind === 'custom') {
        const pts = (eff.points || []).map((pt) => ({ x: pt.x * W, y: pt.y * H }))
        if (pts.length >= 3) {
          shctx.beginPath()
          if (eff.curved && pts.length > 2) {
            shctx.moveTo((pts[0].x + pts[pts.length - 1].x) / 2, (pts[0].y + pts[pts.length - 1].y) / 2)
            for (let i = 0; i < pts.length; i++) {
              const p = pts[i]
              const q = pts[(i + 1) % pts.length]
              shctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2)
            }
          } else {
            shctx.moveTo(pts[0].x, pts[0].y)
            for (let i = 1; i < pts.length; i++) shctx.lineTo(pts[i].x, pts[i].y)
          }
          shctx.closePath()
          shctx.fill()
        }
      } else if (kind === 'text') {
        const size = Math.max(8, (eff.fontSize ?? 0.25) * H)
        shctx.font = `700 ${size}px ${eff.fontFamily ? `"${eff.fontFamily}", ` : ''}sans-serif`
        shctx.textAlign = 'center'
        shctx.textBaseline = 'middle'
        shctx.fillText(eff.text || 'MASK', eff.centerX * W, eff.centerY * H)
      }
    }
    this.applyShapeMatte(scratch, { ...eff, shape: 'rectangle' }, coverage)
  }

  private activeVisualPreviewAt(
    time: number,
    st: ReturnType<typeof useEditor.getState> = useEditor.getState(),
  ): VisualPreview | null {
    if (this.sampling) return null
    const preview = st.visualPreview
    return preview && time >= preview.startTime && time <= preview.endTime ? preview : null
  }

  private effectsForRender(clip: Clip, time: number): ClipEffect | undefined {
    const preview = this.activeVisualPreviewAt(time)
    // CapCut-style instances dropped on the clip merge over its own effects
    // (per-property keyframes evaluated at instance-local time).
    const base = mergeFxInstances(clip, fxLocalTime(clip, time))
    if (preview?.kind !== 'clip-effect' || preview.clipId !== clip.id) return base
    return { ...base, ...preview.effect }
  }

  private hasPreviewLutFor(clip: Clip, time: number) {
    const preview = this.activeVisualPreviewAt(time)
    return preview?.kind === 'clip-lut' && preview.clipId === clip.id && preview.lut.enabled
  }

  /** Resolve a clip's enabled LUT stack; flags pending loads. */
  private buildLutStack(clip: Clip, time = useEditor.getState().playhead): { stack: LutStackItem[]; pending: boolean } {
    const luts = clip.adjustment?.luts?.filter((l) => l.enabled) ?? []
    const stack: LutStackItem[] = []
    let pending = false
    for (const l of luts) {
      const lut = resolveLutRef({ builtin: l.builtin, text: l.cubeText })
      if (!lut) {
        pending = true
        continue
      }
      stack.push({ lut, intensity: Math.max(0, Math.min(1, l.intensity)) })
    }

    // A LUT audition is composited last, after any currently applied LUTs,
    // without touching the clip's persisted adjustment stack.
    const preview = this.activeVisualPreviewAt(time)
    if (preview?.kind === 'clip-lut' && preview.clipId === clip.id && preview.lut.enabled) {
      const lut = resolveLutRef({ builtin: preview.lut.builtin, text: preview.lut.cubeText })
      if (!lut) pending = true
      else stack.push({ lut, intensity: Math.max(0, Math.min(1, preview.lut.intensity)) })
    }

    if (pending && !this.pendingLutRedraw) {
      this.pendingLutRedraw = true
      whenLutsLoaded().then(() => {
        this.pendingLutRedraw = false
        this.redraw()
      })
    }
    return { stack, pending }
  }
  private pendingLutRedraw = false

  /**
   * Applies an adjustment-layer clip (LUT stack + filter effects) to the
   * current contents of the target canvas — i.e. everything already drawn
   * below it. Returns true when a LUT is still loading.
   */
  private applyAdjustmentLayer(
    ctx: CanvasRenderingContext2D,
    target: HTMLCanvasElement,
    clip: Clip,
    time = useEditor.getState().playhead,
  ): boolean {
    const { stack, pending } = this.buildLutStack(clip, time)
    const effects = this.effectsForRender(clip, time)
    const effectFilter = effectFilterString(effects)

    // A spatial matte requires grading an isolated copy, then compositing the
    // graded pixels back through the mask. Without a mask we retain the fast
    // in-place path below.
    if (clip.adjustmentMask && (stack.length > 0 || effectFilter)) {
      const graded = this.takeScratch()
      const gctx = graded.getContext('2d')!
      try {
        gctx.drawImage(target, 0, 0)
        if (effectFilter) {
          gctx.save()
          gctx.setTransform(1, 0, 0, 1, 0, 0)
          gctx.filter = effectFilter
          gctx.globalAlpha = 1
          gctx.globalCompositeOperation = 'source-over'
          gctx.drawImage(target, 0, 0)
          gctx.restore()
        }
        if (stack.length) applyLutStackToCanvas(graded, stack)
        if (hasPixelGrade(effects)) applyPixelGrade(graded, effects!, Math.round(time * 24))
        if (hasNg(effects as NgEffect)) applyGlitchNG(graded, effects as NgEffect, time)
        if (hasClipFxLayers(effects)) applyClipFxLayers(graded, effects!, time)
        this.applyAdjustmentMask(graded, clip.adjustmentMask)
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.filter = 'none'
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'source-over'
        ctx.drawImage(graded, 0, 0)
        ctx.restore()
      } finally {
        this.releaseScratch(graded)
      }
      applyLightComposite(ctx, this.width, this.height, effects)
      return pending
    }

    // filter effects (blur/brightness/...): filtered self-draw over the canvas
    if (effectFilter) {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.filter = effectFilter
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(target, 0, 0)
      ctx.restore()
    }
    if (stack.length) applyLutStackToCanvas(target, stack)
    if (hasPixelGrade(effects)) applyPixelGrade(target, effects!, Math.round(time * 24))
    if (hasNg(effects as NgEffect)) applyGlitchNG(target, effects as NgEffect, time)
    if (hasClipFxLayers(effects)) applyClipFxLayers(target, effects!, time)
    applyLightComposite(ctx, this.width, this.height, effects)
    return pending
  }

  /** Temporarily grades the already-composited footage below an audition layer. */
  private applyPreviewAdjustmentLayer(
    ctx: CanvasRenderingContext2D,
    target: HTMLCanvasElement,
    preview: Extract<VisualPreview, { kind: 'adjustment-layer' }>,
  ): boolean {
    const filter = effectFilterString(preview.effect)
    if (filter) {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.filter = filter
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(target, 0, 0)
      ctx.restore()
    }
    applyLightComposite(ctx, this.width, this.height, preview.effect)

    let pending = false
    if (preview.lut?.enabled) {
      const lut = resolveLutRef({ builtin: preview.lut.builtin, text: preview.lut.cubeText })
      if (lut) {
        applyLutStackToCanvas(target, [{ lut, intensity: Math.max(0, Math.min(1, preview.lut.intensity)) }])
      } else {
        pending = true
        if (!this.pendingLutRedraw) {
          this.pendingLutRedraw = true
          whenLutsLoaded().then(() => {
            this.pendingLutRedraw = false
            this.redraw()
          })
        }
      }
    }
    return pending
  }

  start() {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    // Pause decoded media synchronously with state. Waiting for the next rAF
    // made Space/click pause feel delayed under main-thread load.
    this.unsubscribe = useEditor.subscribe((state, previous) => {
      if (!state.playing && previous.playing) {
        videoCache.forEach((video) => video.pause())
        audioCache.forEach((audio) => audio.pause())
      }
    })
    this.raf = requestAnimationFrame(this.loop)
  }

  private loop = (ts: number) => {
    const dt = Math.min(0.05, (ts - this.last) / 1000)
    this.last = ts
    let frameState = useEditor.getState()
    let time = frameState.playhead
    if (frameState.playing && !frameState.scrubbing) {
      time += dt * frameState.speed
      const auditionEnd = !this.sampling ? frameState.visualPreview?.endTime : undefined
      if (auditionEnd !== undefined && frameState.speed > 0 && time >= auditionEnd) {
        // Keep the temporary look active on the last audition frame so the
        // user can inspect it or Apply it after playback pauses.
        time = auditionEnd
        frameState.setPlayhead(time)
        frameState.pause()
      } else if (time >= frameState.duration) {
        time = frameState.duration
        frameState.setPlayhead(time)
        frameState.pause()
      } else if (time <= 0 && frameState.speed < 0) {
        time = 0
        frameState.setPlayhead(time)
        frameState.pause()
      } else {
        frameState.setPlayhead(time)
      }
      frameState = useEditor.getState()
    }
    this.renderFrame(time, frameState)
    this.raf = requestAnimationFrame(this.loop)
  }

  /**
   * Repaint the preview from outside the engine. Used when an asset finishes
   * decoding so a newly available frame is shown without waiting for the next
   * tick of the loop.
   */
  public redraw() {
    const st = useEditor.getState()
    this.renderFrame(st.playhead, st)
  }

  private renderFrame(time: number, st: ReturnType<typeof useEditor.getState>) {
    this.resolvedArtworkRigCache.clear()
    const ctx = this.backCtx
    ctx.fillStyle = st.sequenceBackground || '#000000'
    ctx.fillRect(0, 0, this.width, this.height)
    this.usedThisFrame.clear()
    let visualPending = false

    // Standard NLE visual compositing: lower tracks drawn first, higher visual tracks composite on top
    const renderTracks = [...st.tracks].reverse()

    const renderTrackContents = (track: Track): boolean => {
      const preview = this.activeVisualPreviewAt(time, st)
      const previewTransition = preview?.kind === 'transition' && preview.transition.trackId === track.id
        ? preview.transition
        : null
      const activeTrans = previewTransition || (st.transitions || []).find(
        (tr) =>
          tr.trackId === track.id &&
          tr.enabled &&
          time >= tr.startTime &&
          time <= tr.startTime + tr.duration,
      )

      if (activeTrans && track.type === 'video') {
        const fromClip = st.clips.find((c) => c.id === activeTrans.fromClipId)
        const toClip = st.clips.find((c) => c.id === activeTrans.toClipId)
        const fromAsset = fromClip ? st.assets.find((a) => a.id === fromClip.assetId) || null : null
        const toAsset = toClip ? st.assets.find((a) => a.id === toClip.assetId) || null : null
        if (fromClip && toClip && (fromAsset || fromClip.textStyle) && (toAsset || toClip.textStyle)) {
          this.drawTransition(
            ctx,
            activeTrans,
            fromClip,
            toClip,
            fromAsset,
            toAsset,
            time,
            st,
            track.muted,
          )
          return false
        }
      }

      const clip = activeClipOnTrack(st.clips, track.id, time)
      if (!clip) return false
      // AE/AM null objects render no pixels — they only control children.
      if (clip.kind === 'null') return false
      // Per-clip blend (watermarks: lighten/splice…). Restored by the
      // caller's save/restore around renderTrackContents.
      if (clip.blendMode && clip.blendMode !== 'source-over') ctx.globalCompositeOperation = clip.blendMode

      // Adjustment layer: grades everything already drawn (all tracks below)
      if (clip.kind === 'adjustment' && track.type === 'video') {
        return this.applyAdjustmentLayer(ctx, this.backCanvas, clip, time)
      }

      if (clip.kind === 'drawing' && track.type === 'video') {
        // Converted drawing: strokes render here, in track order, with
        // their original payloads — placement changed, appearance didn't.
        const ids = new Set(clip.drawingStrokeIds || [])
        const sts = (st.drawingStrokes || []).filter((x) => ids.has(x.id))
        if (sts.length > 0) {
          ctx.save()
          ctx.globalAlpha *= Math.max(0, Math.min(1, clip.transform?.opacity ?? 1))
          renderAllPaintLayers(ctx, this.width, this.height, sts, st.paintLayers || [], time, st.projectFps || 30)
          ctx.restore()
        }
        return false
      }

      if (clip.kind === 'compound' && track.type === 'video') {
        this.drawCompoundClip(ctx, clip, time, st, track.muted)
        return false
      }

      const asset = st.assets.find((a) => a.id === clip.assetId)
      if (!asset) {
        if (clip.textStyle && track.type === 'video') this.drawTextClip(ctx, clip, time)
        return false
      }
      const el = this.syncElement(asset, time, clip, st.playing, track.muted, st.speed)
      if (!el) return track.type === 'video'
      if (track.type === 'video') {
        const media = asset.kind === 'video' ? el as HTMLVideoElement : null
        if (media && (media.seeking || media.readyState < HTMLMediaElement.HAVE_CURRENT_DATA)) return true
        this.drawClip(ctx, el as CanvasImageSource, clip, asset, time)
      }
      return false
    }

    // View-as-layers: strokes stamped while the mode was on composite
    // directly above their topmost active anchor clip, clipped to the
    // union of their anchor clips' view regions. Everything else (mode
    // off, unstamped, converted) keeps the classic on-top pass below.
    const layeredOn = Boolean((st as { viewVideosAsLayers?: boolean }).viewVideosAsLayers)
    const layeredByTrack = new Map<string, { stroke: import('../types').DrawingStroke; rects: { x: number; y: number; w: number; h: number }[] }[]>()
    if (layeredOn) {
      for (const stroke of st.drawingStrokes || []) {
        if (!stroke.layered || stroke.convertedClipId || !stroke.anchorClipIds?.length) continue
        const anchors = stroke.anchorClipIds
          .map((id) => st.clips.find((c) => c.id === id))
          .filter((c): c is NonNullable<typeof c> => Boolean(c) && time >= c!.start && time < c!.start + c!.duration)
        if (anchors.length === 0) continue
        const top = anchors.reduce((a, b) =>
          st.tracks.findIndex((t) => t.id === a.trackId) <= st.tracks.findIndex((t) => t.id === b.trackId) ? a : b,
        )
        const rects = anchors.map((c) => this.clipViewRect(c, st, time)).filter((r): r is NonNullable<typeof r> => Boolean(r))
        if (rects.length === 0) continue
        const list = layeredByTrack.get(top.trackId) || []
        list.push({ stroke, rects })
        layeredByTrack.set(top.trackId, list)
      }
    }

    for (const track of renderTracks) {
      if (track.type === 'video' && track.hidden) continue
      ctx.save()
      if (renderTrackContents(track)) visualPending = true
      ctx.restore()
      const layeredHere = layeredByTrack.get(track.id)
      if (layeredHere && layeredHere.length > 0) {
        ctx.save()
        ctx.beginPath()
        for (const item of layeredHere) for (const r of item.rects) ctx.rect(r.x, r.y, r.w, r.h)
        ctx.clip()
        renderAllPaintLayers(ctx, this.width, this.height, layeredHere.map((i) => i.stroke), st.paintLayers || [], time, st.projectFps || 30)
        ctx.restore()
      }

      // Virtual adjustment layer: composite after its anchor track, just like
      // a placed layer, but keep it outside clips/history/project data.
      const preview = this.activeVisualPreviewAt(time, st)
      if (preview?.kind === 'adjustment-layer' && preview.afterTrackId === track.id) {
        if (this.applyPreviewAdjustmentLayer(ctx, this.backCanvas, preview)) visualPending = true
      }
    }

    // A temporary title is an overlay audition: draw it above the timeline
    // composite without inserting a clip into any track.
    const textPreview = this.activeVisualPreviewAt(time, st)
    if (textPreview?.kind === 'text-clip') {
      this.drawTextClip(ctx, textPreview.clip, time)
    }

    // Composite Paint Layers & Vector Drawing Strokes (on-top pass:
    // converted strokes render inside their clips; layered strokes were
    // composited in-stack above when the mode is on).
    if (st.drawingStrokes && st.drawingStrokes.length > 0) {
      const topStrokes = st.drawingStrokes.filter(
        (x) => !x.convertedClipId && !(layeredOn && x.layered && x.anchorClipIds?.length),
      )
      if (topStrokes.length > 0) {
        renderAllPaintLayers(ctx, this.width, this.height, topStrokes, st.paintLayers || [], time, st.projectFps || 30)
      }
    }

    // Never flash black while Chromium is decoding a newly requested frame.
    // Commit the complete back buffer atomically once all active visuals are ready.
    if (!visualPending) this.ctx.drawImage(this.backCanvas, 0, 0)

    // Pause any media element that is no longer part of the active frame.
    const pause = (m: HTMLMediaElement) => {
      if (!this.usedThisFrame.has(m) && !m.paused) m.pause()
    }
    videoCache.forEach(pause)
    audioCache.forEach(pause)
  }

  private drawTransition(
    ctx: CanvasRenderingContext2D,
    trans: Transition,
    fromClip: Clip,
    toClip: Clip,
    fromAsset: MediaAsset | null,
    toAsset: MediaAsset | null,
    time: number,
    st: ReturnType<typeof useEditor.getState>,
    trackMuted: boolean,
  ) {
    const fromEl = fromAsset ? this.syncElement(fromAsset, time, fromClip, st.playing, trackMuted, st.speed, true) : null
    const toEl = toAsset ? this.syncElement(toAsset, time, toClip, st.playing, trackMuted, st.speed, true) : null
    const hasFrom = !!fromEl || !!fromClip.textStyle
    const hasTo = !!toEl || !!toClip.textStyle
    if (!hasFrom && !hasTo) return

    const drawFrom = (context: CanvasRenderingContext2D) => {
      if (fromEl && fromAsset) this.drawClip(context, fromEl as CanvasImageSource, fromClip, fromAsset, time)
      else if (fromClip.textStyle) this.drawTextClip(context, fromClip, time)
    }

    const drawTo = (context: CanvasRenderingContext2D) => {
      if (toEl && toAsset) this.drawClip(context, toEl as CanvasImageSource, toClip, toAsset, time)
      else if (toClip.textStyle) this.drawTextClip(context, toClip, time)
    }

    const progress = clamp((time - trans.startTime) / Math.max(0.001, trans.duration), 0, 1)
    // Pillar-deep families (350 generated presets) + the reworked legacy glitch
    const pillarDef = PILLAR_DEF_BY_TYPE[trans.type]
    if (pillarDef) {
      drawPillarFamily(pillarDef.family, {
        ctx, width: this.width, height: this.height, p: progress, params: pillarDef.params,
        drawFrom, drawTo, hasFrom, hasTo,
        takeScratch: () => this.takeScratch(), releaseScratch: (c) => this.releaseScratch(c),
      })
      return
    }
    if (trans.type === 'glitch') {
      drawPillarFamily('glitch', {
        ctx, width: this.width, height: this.height, p: progress,
        params: { style: 'slice', intensity: 0.8, scan: 0.3, static: 0.4, seed: 7 },
        drawFrom, drawTo, hasFrom, hasTo,
        takeScratch: () => this.takeScratch(), releaseScratch: (c) => this.releaseScratch(c),
      })
      return
    }

    ctx.save()
    switch (trans.type) {
      case 'cross_dissolve': {
        if (hasFrom) {
          ctx.save()
          ctx.globalAlpha = 1 - progress
          drawFrom(ctx)
          ctx.restore()
        }
        if (hasTo) {
          ctx.save()
          ctx.globalAlpha = progress
          drawTo(ctx)
          ctx.restore()
        }
        break
      }
      case 'dip_to_black': {
        if (progress < 0.5) {
          if (hasFrom) {
            ctx.save()
            ctx.globalAlpha = 1 - progress * 2
            drawFrom(ctx)
            ctx.restore()
          }
        } else {
          if (hasTo) {
            ctx.save()
            ctx.globalAlpha = (progress - 0.5) * 2
            drawTo(ctx)
            ctx.restore()
          }
        }
        break
      }
      case 'dip_to_white': {
        if (progress < 0.5) {
          if (hasFrom) drawFrom(ctx)
          ctx.fillStyle = `rgba(255, 255, 255, ${progress * 2})`
          ctx.fillRect(0, 0, this.width, this.height)
        } else {
          if (hasTo) drawTo(ctx)
          ctx.fillStyle = `rgba(255, 255, 255, ${(1 - progress) * 2})`
          ctx.fillRect(0, 0, this.width, this.height)
        }
        break
      }
      case 'wipe_left': {
        if (hasFrom) drawFrom(ctx)
        if (hasTo) {
          ctx.save()
          ctx.beginPath()
          ctx.rect(this.width * (1 - progress), 0, this.width * progress, this.height)
          ctx.clip()
          drawTo(ctx)
          ctx.restore()
        }
        break
      }
      case 'wipe_right': {
        if (hasFrom) drawFrom(ctx)
        if (hasTo) {
          ctx.save()
          ctx.beginPath()
          ctx.rect(0, 0, this.width * progress, this.height)
          ctx.clip()
          drawTo(ctx)
          ctx.restore()
        }
        break
      }
      case 'slide_left': {
        if (hasFrom) {
          ctx.save()
          ctx.translate(-progress * this.width, 0)
          drawFrom(ctx)
          ctx.restore()
        }
        if (hasTo) {
          ctx.save()
          ctx.translate((1 - progress) * this.width, 0)
          drawTo(ctx)
          ctx.restore()
        }
        break
      }
      case 'slide_right': {
        if (hasFrom) {
          ctx.save()
          ctx.translate(progress * this.width, 0)
          drawFrom(ctx)
          ctx.restore()
        }
        if (hasTo) {
          ctx.save()
          ctx.translate(-(1 - progress) * this.width, 0)
          drawTo(ctx)
          ctx.restore()
        }
        break
      }
      case 'zoom': {
        if (hasFrom) {
          ctx.save()
          const s = 1.0 + progress * 0.4
          ctx.translate(this.width / 2, this.height / 2)
          ctx.scale(s, s)
          ctx.translate(-this.width / 2, -this.height / 2)
          ctx.globalAlpha = 1 - progress
          drawFrom(ctx)
          ctx.restore()
        }
        if (hasTo) {
          ctx.save()
          const s = 1.4 - progress * 0.4
          ctx.translate(this.width / 2, this.height / 2)
          ctx.scale(s, s)
          ctx.translate(-this.width / 2, -this.height / 2)
          ctx.globalAlpha = progress
          drawTo(ctx)
          ctx.restore()
        }
        break
      }
      case 'zoom_out': {
        if (hasFrom) {
          ctx.save()
          const s = 1.0 - progress * 0.45
          ctx.translate(this.width / 2, this.height / 2)
          ctx.scale(s, s)
          ctx.translate(-this.width / 2, -this.height / 2)
          ctx.globalAlpha = 1 - progress
          drawFrom(ctx)
          ctx.restore()
        }
        if (hasTo) {
          ctx.save()
          const s = 0.55 + progress * 0.45
          ctx.translate(this.width / 2, this.height / 2)
          ctx.scale(s, s)
          ctx.translate(-this.width / 2, -this.height / 2)
          ctx.globalAlpha = progress
          drawTo(ctx)
          ctx.restore()
        }
        break
      }
      case 'film_dissolve': {
        if (hasFrom) { ctx.save(); ctx.globalAlpha = Math.pow(1 - progress, 1.4); drawFrom(ctx); ctx.restore() }
        if (hasTo) { ctx.save(); ctx.globalAlpha = Math.pow(progress, 0.7); drawTo(ctx); ctx.restore() }
        break
      }
      case 'additive_dissolve': {
        if (hasFrom) drawFrom(ctx)
        if (hasTo) {
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          ctx.globalAlpha = progress
          drawTo(ctx)
          ctx.restore()
        }
        break
      }
      case 'blur_dissolve': {
        const blurPx = Math.round(Math.sin(progress * Math.PI) * 22)
        if (hasFrom) {
          ctx.save()
          ctx.filter = `blur(${Math.round(progress * 22)}px)`
          ctx.globalAlpha = 1 - progress
          drawFrom(ctx)
          ctx.restore()
        }
        if (hasTo) {
          ctx.save()
          ctx.filter = `blur(${Math.round((1 - progress) * 22)}px)`
          ctx.globalAlpha = progress
          drawTo(ctx)
          ctx.restore()
        }
        void blurPx
        break
      }
      case 'light_leak': {
        if (hasFrom) { ctx.save(); ctx.globalAlpha = 1 - progress * 0.6; drawFrom(ctx); ctx.restore() }
        if (hasTo) { ctx.save(); ctx.globalAlpha = 0.4 + progress * 0.6; drawTo(ctx); ctx.restore() }
        const g = ctx.createRadialGradient(this.width * 0.3, this.height * 0.25, 10, this.width * 0.3, this.height * 0.25, this.width * 0.75)
        const a = Math.sin(progress * Math.PI) * 0.65
        g.addColorStop(0, `rgba(255, 214, 150, ${a})`)
        g.addColorStop(0.5, `rgba(255, 140, 60, ${a * 0.55})`)
        g.addColorStop(1, 'rgba(255, 120, 40, 0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, this.width, this.height)
        break
      }
      case 'wipe_up': {
        if (hasFrom) drawFrom(ctx)
        if (hasTo) {
          ctx.save()
          ctx.beginPath()
          ctx.rect(0, this.height * (1 - progress), this.width, this.height * progress)
          ctx.clip()
          drawTo(ctx)
          ctx.restore()
        }
        break
      }
      case 'wipe_down': {
        if (hasFrom) drawFrom(ctx)
        if (hasTo) {
          ctx.save()
          ctx.beginPath()
          ctx.rect(0, 0, this.width, this.height * progress)
          ctx.clip()
          drawTo(ctx)
          ctx.restore()
        }
        break
      }
      case 'slide_up': {
        if (hasFrom) { ctx.save(); ctx.translate(0, -progress * this.height); drawFrom(ctx); ctx.restore() }
        if (hasTo) { ctx.save(); ctx.translate(0, (1 - progress) * this.height); drawTo(ctx); ctx.restore() }
        break
      }
      case 'slide_down': {
        if (hasFrom) { ctx.save(); ctx.translate(0, progress * this.height); drawFrom(ctx); ctx.restore() }
        if (hasTo) { ctx.save(); ctx.translate(0, -(1 - progress) * this.height); drawTo(ctx); ctx.restore() }
        break
      }
      case 'whip_left':
      case 'whip_right': {
        const dir = trans.type === 'whip_left' ? -1 : 1
        const blurPx = Math.max(0, Math.round(Math.sin(progress * Math.PI) * 26))
        if (hasFrom) {
          ctx.save()
          ctx.filter = `blur(${blurPx}px)`
          ctx.translate(dir * -progress * this.width, 0)
          drawFrom(ctx)
          ctx.restore()
        }
        if (hasTo) {
          ctx.save()
          ctx.filter = `blur(${blurPx}px)`
          ctx.translate(dir * (1 - progress) * this.width, 0)
          drawTo(ctx)
          ctx.restore()
        }
        break
      }
      case 'clock_wipe':
      case 'pinwheel': {
        if (hasFrom) drawFrom(ctx)
        if (hasTo) {
          const cx = this.width / 2, cy = this.height / 2
          const blades = trans.type === 'pinwheel' ? 2 : 1
          ctx.save()
          ctx.beginPath()
          for (let b = 0; b < blades; b++) {
            const start = -Math.PI / 2 + (b * Math.PI * 2) / blades
            ctx.moveTo(cx, cy)
            ctx.arc(cx, cy, Math.max(this.width, this.height), start, start + (progress * Math.PI * 2) / blades)
            ctx.closePath()
          }
          ctx.clip()
          drawTo(ctx)
          ctx.restore()
        }
        break
      }
      case 'checker_wipe': {
        if (hasFrom) drawFrom(ctx)
        if (hasTo) {
          const cols = 8, rows = 5
          const cw = this.width / cols, ch = this.height / rows
          ctx.save()
          ctx.beginPath()
          for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
              const parity = (x + y) % 2
              const lp = Math.max(0, Math.min(1, progress * 2 - parity))
              if (lp <= 0) continue
              const insetX = (cw * (1 - lp)) / 2, insetY = (ch * (1 - lp)) / 2
              ctx.rect(x * cw + insetX, y * ch + insetY, cw - insetX * 2, ch - insetY * 2)
            }
          }
          ctx.clip()
          drawTo(ctx)
          ctx.restore()
        }
        break
      }
      case 'blinds_h':
      case 'blinds_v': {
        if (hasFrom) drawFrom(ctx)
        if (hasTo) {
          const bands = trans.type === 'blinds_h' ? 6 : 9
          ctx.save()
          ctx.beginPath()
          for (let i = 0; i < bands; i++) {
            if (trans.type === 'blinds_h') {
              const bh = this.height / bands
              ctx.rect(0, i * bh, this.width, bh * progress)
            } else {
              const bw = this.width / bands
              ctx.rect(i * bw, 0, bw * progress, this.height)
            }
          }
          ctx.clip()
          drawTo(ctx)
          ctx.restore()
        }
        break
      }
      case 'barn_doors': {
        if (hasTo) drawTo(ctx)
        if (hasFrom) {
          // Each door is half the frame sliding outward; the clip region is
          // the door's CURRENT screen rect, so a gap opens in the middle.
          const halfW = this.width / 2
          const doorW = halfW * (1 - progress)
          ctx.save()
          ctx.beginPath(); ctx.rect(0, 0, doorW, this.height); ctx.clip()
          ctx.translate(-progress * halfW, 0)
          drawFrom(ctx)
          ctx.restore()
          ctx.save()
          ctx.beginPath(); ctx.rect(this.width - doorW, 0, doorW, this.height); ctx.clip()
          ctx.translate(progress * halfW, 0)
          drawFrom(ctx)
          ctx.restore()
        }
        break
      }
      case 'center_split': {
        if (hasFrom) drawFrom(ctx)
        if (hasTo) {
          ctx.save()
          ctx.beginPath()
          ctx.rect(this.width / 2 - (progress * this.width) / 2, 0, progress * this.width, this.height)
          ctx.clip()
          drawTo(ctx)
          ctx.restore()
        }
        break
      }
      case 'page_turn': {
        if (hasTo) drawTo(ctx)
        if (hasFrom) {
          const edge = this.width * (1 - progress)
          ctx.save()
          ctx.beginPath(); ctx.rect(0, 0, edge, this.height); ctx.clip()
          drawFrom(ctx)
          ctx.restore()
          const g = ctx.createLinearGradient(edge - 46, 0, edge + 6, 0)
          g.addColorStop(0, 'rgba(0,0,0,0)')
          g.addColorStop(1, 'rgba(0,0,0,0.45)')
          ctx.fillStyle = g
          ctx.fillRect(Math.max(0, edge - 46), 0, 52, this.height)
        }
        break
      }
      case 'iris_circle':
      case 'iris_diamond':
      case 'iris_box': {
        if (hasFrom) drawFrom(ctx)
        if (hasTo) {
          const cx = this.width / 2, cy = this.height / 2
          ctx.save()
          ctx.beginPath()
          if (trans.type === 'iris_circle') {
            ctx.arc(cx, cy, progress * Math.max(this.width, this.height) * 0.72, 0, Math.PI * 2)
          } else if (trans.type === 'iris_diamond') {
            const rx = progress * this.width * 0.72, ry = progress * this.height * 0.72
            ctx.moveTo(cx, cy - ry); ctx.lineTo(cx + rx, cy); ctx.lineTo(cx, cy + ry); ctx.lineTo(cx - rx, cy); ctx.closePath()
          } else {
            ctx.rect(cx - (progress * this.width) / 2, cy - (progress * this.height) / 2, progress * this.width, progress * this.height)
          }
          ctx.clip()
          drawTo(ctx)
          ctx.restore()
        }
        break
      }
      case 'spin': {
        const cx = this.width / 2, cy = this.height / 2
        if (hasFrom) {
          ctx.save()
          ctx.translate(cx, cy); ctx.rotate(-progress * Math.PI); ctx.scale(1 - progress * 0.6, 1 - progress * 0.6); ctx.translate(-cx, -cy)
          ctx.globalAlpha = 1 - progress
          drawFrom(ctx)
          ctx.restore()
        }
        if (hasTo) {
          ctx.save()
          ctx.translate(cx, cy); ctx.rotate((1 - progress) * Math.PI); ctx.scale(0.4 + progress * 0.6, 0.4 + progress * 0.6); ctx.translate(-cx, -cy)
          ctx.globalAlpha = progress
          drawTo(ctx)
          ctx.restore()
        }
        break
      }
      case 'flip_h': {
        const cx = this.width / 2
        if (progress < 0.5) {
          if (hasFrom) {
            ctx.save()
            ctx.translate(cx, 0); ctx.scale(Math.cos(progress * Math.PI), 1); ctx.translate(-cx, 0)
            drawFrom(ctx)
            ctx.restore()
          }
        } else if (hasTo) {
          ctx.save()
          ctx.translate(cx, 0); ctx.scale(Math.cos((1 - progress) * Math.PI), 1); ctx.translate(-cx, 0)
          drawTo(ctx)
          ctx.restore()
        }
        break
      }
      case 'device_phone':
      case 'device_monitor':
      case 'device_tv': {
        // 3D device flies in with the incoming clip live on its screen, then
        // the screen expands to the full frame: a true 3D→2D handoff.
        const kind: DeviceKind = trans.type === 'device_phone' ? 'phone' : trans.type === 'device_monitor' ? 'monitor' : 'tv'
        if (hasFrom) drawFrom(ctx)
        if (hasTo) {
          const scr = this.takeScratch()
          const sctx = scr.getContext('2d')!
          sctx.setTransform(1, 0, 0, 1, 0, 0)
          sctx.clearRect(0, 0, scr.width, scr.height)
          drawTo(sctx)
          drawDeviceScene(ctx, this.width, this.height, kind, rigAt(kind, progress), scr)
          this.releaseScratch(scr)
        }
        break
      }
      default: {
        if (hasFrom) drawFrom(ctx)
        break
      }
    }
    ctx.restore()
  }

  /** Live preview: shared per-asset pool. Sampling: dedicated muted elements. */
  private pickVideo(asset: MediaAsset): HTMLVideoElement {
    if (!this.sampling) return getVideo(asset)
    let v = this.samplePool.get(asset.id) as HTMLVideoElement | undefined
    if (!v) {
      if (this.samplePool.size >= 8) {
        const firstKey = this.samplePool.keys().next().value
        if (firstKey !== undefined) {
          const dropped = this.samplePool.get(firstKey)
          dropped?.pause()
          dropped?.removeAttribute('src')
          this.samplePool.delete(firstKey)
        }
      }
      v = document.createElement('video')
      v.src = asset.url
      v.preload = 'auto'
      v.muted = true
      v.playsInline = true
      v.loop = false
      mediaHost().appendChild(v)
      this.samplePool.set(asset.id, v)
    }
    return v
  }

  private pickAudio(asset: MediaAsset): HTMLAudioElement {
    if (!this.sampling) return getAudio(asset)
    let a = this.samplePool.get(asset.id) as HTMLAudioElement | undefined
    if (!a) {
      a = document.createElement('audio')
      a.src = asset.url
      a.preload = 'auto'
      a.muted = true
      a.loop = false
      mediaHost().appendChild(a)
      this.samplePool.set(asset.id, a)
    }
    return a
  }

  public renderClipTile(
    clip: Clip,
    time: number,
    st: ReturnType<typeof useEditor.getState> = useEditor.getState(),
  ): boolean {
    const ctx = this.backCtx
    this.usedThisFrame.clear()
    ctx.filter = 'none'
    ctx.fillStyle = st.sequenceBackground || '#000000'
    ctx.fillRect(0, 0, this.width, this.height)
    if (clip.kind === 'compound') {
      this.drawCompoundClip(ctx, clip, time, st, true)
      return true
    }
    const asset = st.assets.find((a) => a.id === clip.assetId)
    if (!asset) {
      if (clip.textStyle) {
        this.drawTextClip(ctx, clip, time)
        return true
      }
      return false
    }
    if (asset.kind === 'audio') return false
    const el = this.syncElement(asset, time, clip, false, true, 1, true)
    if (!el) return false
    this.drawClip(ctx, el as CanvasImageSource, clip, asset, time)
    return true
  }

  public sampleCanvas(): HTMLCanvasElement {
    return this.backCanvas
  }

  public sampleElements(): HTMLMediaElement[] {
    return [...this.usedThisFrame]
  }

  private seekTo(el: HTMLMediaElement, target: number, tolerance: number) {
    const clamped = Math.max(0, target)
    this.requestedTime.set(el, clamped)
    if (el.seeking || Math.abs(el.currentTime - clamped) <= tolerance) return
    try {
      // One seek per decoder completion. The latest target remains in the
      // vector map and is applied by the next rAF, coalescing rapid scrubs.
      el.currentTime = clamped
    } catch {
      /* metadata may not be ready yet; the next frame retries */
    }
  }

  private syncElement(
    asset: MediaAsset,
    time: number,
    clip: Clip,
    playing: boolean,
    trackMuted: boolean,
    speed: number,
    allowClamping = false,
  ): HTMLVideoElement | HTMLAudioElement | HTMLImageElement | null {
    if (asset.kind === 'image') {
      const sequence = asset.imageSequence
      if (sequence?.frames?.length) {
        const sourceTime = Math.max(0, clip.inPoint + remapClipLocal(clip, time - clip.start))
        let frameIndex = 0
        for (let i = 1; i < sequence.frames.length; i++) {
          if (sequence.frames[i].time > sourceTime) break
          frameIndex = i
        }
        const frame = sequence.frames[frameIndex]
        const img = getImage({ ...asset, id: `${asset.id}:frame:${frameIndex}`, url: frame.url })
        if (!img.complete || img.naturalWidth === 0) return null
        return img
      }
      const img = getImage(asset)
      if (!img.complete || img.naturalWidth === 0) return null
      return img
    }
    const el = (asset.kind === 'video'
      ? this.pickVideo(asset)
      : this.pickAudio(asset)) as HTMLVideoElement | HTMLAudioElement
    const rawTarget = clip.inPoint + remapClipLocal(clip, time - clip.start)
    const srcDur = asset.duration || (el as HTMLVideoElement).duration || 0
    if (!allowClamping && (rawTarget < -0.05 || rawTarget > srcDur + 0.05)) return null
    const target = clamp(rawTarget, 0, Math.max(0, srcDur))
    el.muted = trackMuted
    el.volume = clip.volume
    // HTMLMediaElement does not support negative playbackRate reliably.
    // Reverse transport is driven by the canvas clock and seeks decoded media.
    el.playbackRate = Math.abs(speed)
    this.usedThisFrame.add(el)

    if (playing && speed > 0) {
      if (el.paused) {
        this.seekTo(el, target, 0.04)
        el.play().catch(() => {})
      } else {
        this.seekTo(el, target, 0.18)
      }
    } else {
      if (!el.paused) el.pause()
      this.seekTo(el, target, 0.02)
    }
    return el
  }

  private drawTextClip(
    ctx: CanvasRenderingContext2D,
    clip: Clip,
    time = useEditor.getState().playhead,
    skipLutIsolation = false,
  ) {
    if (!clip.textStyle) return
    // Per-clip LUT isolation for text clips (same semantics as drawClip).
    if (!skipLutIsolation && (clip.adjustment?.luts?.some((l) => l.enabled) || this.hasPreviewLutFor(clip, time) || clip.mask?.enabled)) {
      const scratch = this.takeScratch()
      const octx = scratch.getContext('2d')!
      this.drawTextClip(octx, clip, time, true)
      const { stack } = this.buildLutStack(clip, time)
      if (stack.length) applyLutStackToCanvas(scratch, stack)
      if (clip.mask?.enabled) this.applyClipVisualMask(scratch, clip.mask, Math.max(0, time - clip.start))
      const puSpec = (clip as unknown as { patch?: PatchUnderSpec }).patch
      if (puSpec?.strategy) {
        applyPatchUnder(scratch.getContext('2d')!, puSpec, { x: 0, y: 0, w: this.width, h: this.height }, this.width, this.height)
      }
      const t = ctx.getTransform()
      if (t.a === 1 && t.b === 0 && t.c === 0 && t.d === 1 && t.e === 0 && t.f === 0) {
        ctx.drawImage(scratch, 0, 0)
      } else {
        ctx.drawImage(scratch, -this.width / 2, -this.height / 2)
      }
      this.releaseScratch(scratch)
      return
    }
    ctx.save()
    this.applyParentWorld(ctx, clip, time)
    const effNow = this.effectsForRender(clip, time)
    applyClipFilter(ctx, effNow)
    const evalT = evalClipPfx(clip, time)
    ctx.globalAlpha *= Math.max(0, Math.min(1, evalT.opacity ?? clip.transform.opacity))

    const cx = this.width / 2 + evalT.x * (this.width / PW)
    const cy = this.height / 2 + evalT.y * (this.height / PH)

    const t = clip.textStyle
    const scaleFactor = this.width / PW
    const fontSize = Math.max(14, Math.round((t.fontSize || 48) * scaleFactor))
    const fontFamily = t.fontFamily || 'sans-serif'
    // Quote single family names (imported fonts often contain spaces);
    // comma stacks like "Georgia, serif" are already valid as-is.
    const fam = fontFamily.includes(',') ? fontFamily : `"${fontFamily.replace(/"/g, '')}"`
    ctx.font = `${t.bold ? 'bold ' : ''}${t.italic ? 'italic ' : ''}${fontSize}px ${fam}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Text Randomizer (Alight Motion effects method): glyphs scramble with
    // a per-frame seeded RNG and settle left-to-right into the real text.
    let displayText = t.text || ''
    if (t.randomizer && t.randomizer.untilSec > 0) {
      const local = Math.max(0, time - clip.start)
      if (local < t.randomizer.untilSec) {
        const charset = t.randomizer.charset || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$'
        const frame = Math.floor(local * 30)
        const progress = local / t.randomizer.untilSec
        let rngState = (t.randomizer.seed * 2654435761 + frame * 97) >>> 0 || 1
        const rnd = () => { rngState ^= rngState << 13; rngState ^= rngState >>> 17; rngState ^= rngState << 5; return (rngState >>> 0) / 4294967295 }
        const chars = [...displayText]
        const settleAt = progress * 1.3 // settle front runs ahead of progress
        let pos = 0
        displayText = chars.map((ch) => {
          const idx = pos++
          if (ch === ' ' || ch === '\n') return ch
          const settled = idx / Math.max(1, chars.length) < settleAt && rnd() < progress + 0.25
          return settled ? ch : charset[Math.floor(rnd() * charset.length)]
        }).join('')
      }
    }
    const lines = displayText.split('\n')
    const lineHeight = fontSize * 1.3
    const tracking = (t.letterSpacing || 0) * scaleFactor

    let maxLineW = 0
    for (const line of lines) {
      const w = ctx.measureText(line).width + Math.max(0, line.length - 1) * tracking
      if (w > maxLineW) maxLineW = w
    }

    const padX = 24 * scaleFactor
    const padY = 16 * scaleFactor
    const totalH = lines.length * lineHeight
    const boxW = maxLineW + padX * 2
    const boxH = totalH + padY * 2

    // Pivot about the text box (same anchor semantics as media clips).
    ctx.translate(cx, cy)
    const pvx = (evalT.pivotX - 0.5) * boxW
    const pvy = (evalT.pivotY - 0.5) * boxH
    ctx.translate(pvx, pvy)
    ctx.rotate((evalT.rotationZ * Math.PI) / 180)
    applyRotationXY(ctx, evalT.rotationX, evalT.rotationY)
    ctx.scale(evalT.scaleX, evalT.scaleY)
    ctx.translate(-pvx, -pvy)

    // Background pill if configured
    if (t.backgroundColor && t.backgroundColor !== 'transparent') {
      ctx.fillStyle = t.backgroundColor
      const radius = 8 * scaleFactor
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, radius)
      } else {
        ctx.rect(-boxW / 2, -boxH / 2, boxW, boxH)
      }
      ctx.fill()
    }

    // Glow / shadow (Photoshop model): outward glow takes the shadow slot;
    // an outer (drop) shadow takes it when there is no outward glow; inward
    // glow / inner shadow are composited inside the glyphs further below.
    const hexA = (hex: string, a: number) => {
      const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
      if (!m) return hex
      const n = parseInt(m[1], 16)
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a))})`
    }
    const glowActive = !!(t.glowColor && (t.glowBlur || 0) > 0)
    const glowInward = glowActive && t.glowMode === 'inward'
    const shadowInner = t.shadowMode === 'inner'
    const needsInner = glowInward || shadowInner
    if (glowActive && !glowInward) {
      ctx.shadowColor = t.glowColor as string
      ctx.shadowBlur = (t.glowBlur || 18) * scaleFactor
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
    } else if (t.shadowMode === 'outer') {
      ctx.shadowColor = hexA(t.shadowColor || '#000000', t.shadowOpacity ?? 0.6)
      ctx.shadowBlur = (t.shadowBlur ?? 8) * scaleFactor
      ctx.shadowOffsetX = (t.shadowOffsetX ?? 3) * scaleFactor
      ctx.shadowOffsetY = (t.shadowOffsetY ?? 3) * scaleFactor
    } else if (t.shadowMode === 'none' || t.shadowMode === 'inner' || glowActive) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0)'
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)'
      ctx.shadowBlur = 10 * scaleFactor
      ctx.shadowOffsetX = 2 * scaleFactor
      ctx.shadowOffsetY = 2 * scaleFactor
    }

    // Board T ("omega change"): per-character-range overrides with their OWN
    // keyframes (CapCut sub-range editing). Ranges may overlap; later wins.
    const ranges = (t as unknown as { charRanges?: CharRange[] }).charRanges
    const localT = Math.max(0, time - clip.start)
    const lineStarts: number[] = []
    { let acc = 0; for (const ln of lines) { lineStarts.push(acc); acc += ln.length + 1 } }
    const charAt = (gpos: number) => {
      if (!ranges || !ranges.length) return null
      const st: Record<string, unknown> = {}
      let ks: Record<string, { t: number; v: number | string; interp?: string; params?: unknown }[]> = {}
      let hit = false
      for (const r of ranges) if (gpos >= r.start && gpos < r.end) {
        hit = true
        Object.assign(st, r.style || {})
        if (r.keys) ks = { ...ks, ...r.keys }
      }
      if (!hit) return null
      const has = (p: string) => st[p] != null || !!ks[p]
      return {
        color: st.color || ks.color ? evalColorKeys(ks.color as never, localT, String(st.color ?? t.color ?? '#ffffff')) : undefined,
        fontSize: has('fontSize') ? evalNumKeys(ks.fontSize as never, localT, Number(st.fontSize ?? t.fontSize ?? 0)) : undefined,
        opacity: has('opacity') ? evalNumKeys(ks.opacity as never, localT, Number(st.opacity ?? 1)) : undefined,
        spacing: has('letterSpacing') ? evalNumKeys(ks.letterSpacing as never, localT, Number(st.letterSpacing ?? 0)) : undefined,
      }
    }
    // Draw text lines (per-glyph when tracking/stroke needs it)
    ctx.fillStyle = t.color || '#ffffff'
    // Text Transform (AM panel: Start % / End % / Phase %) — per-char reveal sweep.
    // Phase 100 = fully revealed (default); keyframe/patch phase 0→100 sweeps chars.
    const ttPhase = effNow?.textTransformPhase
    const ttActive = ttPhase !== undefined && ttPhase < 99.999
    const totalChars = Math.max(1, [...(t.text ?? '')].length)
    const ttQ = (gi: number): number => {
      if (!ttActive || ttPhase === undefined) return 1
      const g = totalChars <= 1 ? 0 : Math.min(1, gi / (totalChars - 1))
      const s0 = (effNow!.textTransformStart ?? 0) / 100
      const s1 = Math.max(s0 + 0.02, (effNow!.textTransformEnd ?? 100) / 100)
      const a0 = s0 + g * (s1 - s0)
      const p = ttPhase / 100
      return Math.max(0, Math.min(1, (p * 1.12 - a0) / 0.12))
    }
    const startY = -(lines.length - 1) * (lineHeight / 2)
    const drawLine = (c2: CanvasRenderingContext2D, line: string, y: number, gstart = 0) => {
      const csArr = ranges && ranges.length ? [...line].map((_, ci) => charAt(gstart + ci)) : null
      if (!tracking && !t.strokeWidth && !csArr && !ttActive) { c2.fillText(line, 0, y); return }
      const chars = [...line]
      const widths = chars.map((ch) => c2.measureText(ch).width)
      const extra = csArr ? csArr.map((cs) => (cs && cs.spacing ? cs.spacing * scaleFactor : 0)) : chars.map(() => 0)
      const total = widths.reduce((a, b) => a + b, 0) + Math.max(0, line.length - 1) * tracking + extra.reduce((a, b) => a + b, 0)
      let x = -total / 2
      ;chars.forEach((ch, ci) => {
        const cs = csArr ? csArr[ci] : null
        const tq = ttQ(gstart + ci)
        if (!t.strokeOnly) {
          if (cs && (cs.color || cs.fontSize || cs.opacity)) {
            c2.save()
            if (cs.opacity != null) c2.globalAlpha = Math.max(0, Math.min(1, c2.globalAlpha * cs.opacity))
            if (cs.color) c2.fillStyle = cs.color
            if (cs.fontSize) c2.font = `${t.bold ? 'bold ' : ''}${t.italic ? 'italic ' : ''}${Math.round(cs.fontSize * scaleFactor)}px ${fam}`
            c2.fillText(ch, x + widths[ci] / 2, y)
            c2.restore()
          } else if (tq < 1) {
            c2.save()
            c2.globalAlpha *= tq
            c2.fillText(ch, x + widths[ci] / 2, y + (1 - tq) * fontSize * 0.35)
            c2.restore()
          } else c2.fillText(ch, x + widths[ci] / 2, y)
        }
        if (t.strokeWidth && t.strokeColor) {
          c2.save()
          c2.shadowBlur = 0
          c2.strokeStyle = t.strokeColor
          c2.lineWidth = t.strokeWidth * scaleFactor
          c2.strokeText(ch, x + widths[ci] / 2, y)
          c2.restore()
        }
        x += widths[ci] + tracking + extra[ci]
      })
    }
    // RGB-split chromatic fringes (the reference-edit look): tinted glyph
    // silhouettes offset UNDER the main pass so colour fringes ride the edges
    if ((t.chroma || 0) > 0) {
      const co = (t.chroma as number) * scaleFactor
      const fringes: [number, string][] = [[-co, 'rgba(0, 255, 255, 0.8)'], [co, 'rgba(255, 0, 90, 0.8)']]
      for (const [dx, col] of fringes) {
        ctx.save()
        ctx.translate(dx, 0)
        ctx.shadowColor = 'rgba(0, 0, 0, 0)'
        ctx.shadowBlur = 0
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
        ctx.fillStyle = col
        lines.forEach((line, i) => drawLine(ctx, line, startY + i * lineHeight))
        ctx.restore()
      }
    }
    const insideBed = (t as unknown as { insideBed?: string }).insideBed
    if (insideBed && insideBed !== 'none') {
      // In-Video Text: faint base pass for legibility, then the animated bed
      // (fire/rain/cloud/…) confined INSIDE the glyph silhouettes.
      ctx.save()
      ctx.globalAlpha *= (t as unknown as { insideBaseAlpha?: number }).insideBaseAlpha ?? 0.28
      lines.forEach((line, i) => drawLine(ctx, line, startY + i * lineHeight, lineStarts[i]))
      ctx.restore()
      const bw = Math.max(2, Math.ceil(boxW)), bh = Math.max(2, Math.ceil(boxH))
      const boff = document.createElement('canvas')
      boff.width = bw; boff.height = bh
      const bctx = boff.getContext('2d')!
      bctx.font = ctx.font; bctx.textAlign = 'center'; bctx.textBaseline = 'middle'
      bctx.translate(bw / 2, bh / 2)
      lines.forEach((line, i) => drawLine(bctx, line, startY + i * lineHeight, lineStarts[i]))
      bctx.setTransform(1, 0, 0, 1, 0, 0)
      bctx.globalCompositeOperation = 'source-atop'
      drawReplaceBg(bctx, bw, bh, localT, insideBed as never)
      const ip = (t as unknown as { insideParticle?: string }).insideParticle
      if (ip && ip !== 'none') drawParticleFx(bctx, bw, bh, localT, ip as never, (t as unknown as { insideDensity?: number }).insideDensity ?? 0.6, (t as unknown as { insideTint?: string }).insideTint || '#ffffff')
      ctx.drawImage(boff, -bw / 2, -bh / 2)
    } else if (!needsInner) {
      lines.forEach((line, i) => {
        // double-pass for a stronger glow core
        drawLine(ctx, line, startY + i * lineHeight, lineStarts[i])
        if (glowActive && !glowInward) drawLine(ctx, line, startY + i * lineHeight, lineStarts[i])
      })
    } else {
      // Inward effects: render glyphs offscreen, then let blurred shadows of
      // the glyphs fall INSIDE their own alpha ('source-atop'), like
      // Photoshop's Inner Glow / Inner Shadow. Two passes deepen the light.
      const blurPad = Math.ceil(Math.max(glowInward ? (t.glowBlur || 18) : 0, shadowInner ? (t.shadowBlur ?? 8) : 0) * scaleFactor) + 8
      const offW = Math.max(2, Math.ceil(boxW) + blurPad * 2)
      const offH = Math.max(2, Math.ceil(boxH) + blurPad * 2)
      const off = document.createElement('canvas')
      off.width = offW
      off.height = offH
      const octx = off.getContext('2d')!
      octx.font = ctx.font
      octx.textAlign = 'center'
      octx.textBaseline = 'middle'
      octx.fillStyle = ctx.fillStyle
      octx.translate(offW / 2, offH / 2)
      lines.forEach((line, i) => drawLine(octx, line, startY + i * lineHeight, lineStarts[i]))
      octx.save()
      octx.globalCompositeOperation = 'source-atop'
      if (glowInward) {
        // NOTE: a transparent fill casts no shadow in canvas — the redraw
        // must carry the glow colour at low alpha; 'source-atop' confines
        // fill + shadow to the glyph interior, strongest at the edges.
        octx.shadowColor = t.glowColor as string
        octx.shadowBlur = (t.glowBlur || 18) * scaleFactor
        octx.shadowOffsetX = 0
        octx.shadowOffsetY = 0
        octx.fillStyle = hexA(t.glowColor as string, 0.35)
        lines.forEach((line, i) => drawLine(octx, line, startY + i * lineHeight))
        lines.forEach((line, i) => drawLine(octx, line, startY + i * lineHeight))
        lines.forEach((line, i) => drawLine(octx, line, startY + i * lineHeight))
      }
      if (shadowInner) {
        octx.shadowColor = hexA(t.shadowColor || '#000000', t.shadowOpacity ?? 0.6)
        octx.shadowBlur = (t.shadowBlur ?? 8) * scaleFactor
        octx.shadowOffsetX = (t.shadowOffsetX ?? 3) * scaleFactor
        octx.shadowOffsetY = (t.shadowOffsetY ?? 3) * scaleFactor
        octx.fillStyle = hexA(t.shadowColor || '#000000', 0.18)
        lines.forEach((line, i) => drawLine(octx, line, startY + i * lineHeight))
        lines.forEach((line, i) => drawLine(octx, line, startY + i * lineHeight))
      }
      octx.restore()
      ctx.drawImage(off, -offW / 2, -offH / 2)
    }

    ctx.restore()
  }

  private resolveLayeredArtworkRigPart(asset: MediaAsset, state: ReturnType<typeof useEditor.getState>) {
    const documentId = getLayeredArtworkInfo(asset)?.documentId
    if (!documentId) return undefined
    const matchingRigs = (state.rigs || []).filter((rig) => (rig.sourceDocumentId || rig.psdDocumentId) === documentId)
    const rig = matchingRigs.find((candidate) => candidate.id === state.activeRigId) ||
      (matchingRigs.length === 1 ? matchingRigs[0] : undefined)
    if (!rig) return undefined

    let partsByAsset = this.resolvedArtworkRigCache.get(rig.id)
    if (!partsByAsset) {
      partsByAsset = new Map<string, RigResolvedPart>()
      for (const resolved of resolveRig(rig)) {
        if (resolved.part.sourceAssetId) partsByAsset.set(resolved.part.sourceAssetId, resolved)
      }
      this.resolvedArtworkRigCache.set(rig.id, partsByAsset)
    }
    const node = partsByAsset.get(asset.id)
    return node ? { rig, node } : undefined
  }

  private drawPsdPuppetLayer(
    ctx: CanvasRenderingContext2D,
    image: CanvasImageSource,
    asset: MediaAsset,
    part: RigPart,
    time: number,
    drawX: number,
    drawY: number,
    drawWidth: number,
    drawHeight: number,
  ): boolean {
    const pins = part.pins || []
    const hasWarp = pins.some((pin) => Math.abs(pin.dx) > 1e-6 || Math.abs(pin.dy) > 1e-6) ||
      (!!part.sway?.enabled && part.sway.distance > 0 && pins.length > 0)
    if (!hasWarp) return false

    const width = Math.max(1, Math.ceil(drawWidth))
    const height = Math.max(1, Math.ceil(drawHeight))
    const surface = this.puppetCanvas || (this.puppetCanvas = document.createElement('canvas'))
    if (surface.width !== width) surface.width = width
    if (surface.height !== height) surface.height = height

    const surfaceContext = surface.getContext('2d')
    if (!surfaceContext) return false
    surfaceContext.setTransform(1, 0, 0, 1, 0, 0)
    surfaceContext.globalAlpha = 1
    surfaceContext.globalCompositeOperation = 'source-over'
    surfaceContext.filter = 'none'
    surfaceContext.imageSmoothingEnabled = true
    surfaceContext.clearRect(0, 0, width, height)

    const imageWidth = (image as HTMLImageElement).naturalWidth || asset.width
    const imageHeight = (image as HTMLImageElement).naturalHeight || asset.height
    drawPuppetWarp(
      surfaceContext,
      image,
      imageWidth,
      imageHeight,
      pins,
      part.sway,
      Math.max(0, time),
      stablePartSeed(part.id),
      { x: 0, y: 0, width: drawWidth, height: drawHeight },
    )
    ctx.drawImage(surface, drawX, drawY, drawWidth, drawHeight)
    return true
  }

  /** AE/Alight-Motion parenting: pre-apply the parent hierarchy's world motion
   *  (position/rotation/scale gated per link; opacity never inherits). */
  private applyParentWorld(ctx: CanvasRenderingContext2D, clip: Clip, time: number) {
    const st = useEditor.getState()
    const rels = st.parentRelationships
    if (!rels || !rels.length) return
    const w = inheritedWorld(
      rels,
      (id) => {
        const c = st.clips.find((cc) => cc.id === id)
        if (!c) return { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }
        const e = evaluateClipAnimation(c, time)
        return { x: e.x, y: e.y, scale: e.scaleX, rotation: e.rotationZ, opacity: e.opacity }
      },
      clip.id,
    )
    if (w.x === 0 && w.y === 0 && w.rot === 0 && w.sx === 1 && w.sy === 1) return
    ctx.translate(this.width / 2, this.height / 2)
    ctx.translate(w.x * (this.width / PW), w.y * (this.height / PH))
    ctx.rotate((w.rot * Math.PI) / 180)
    ctx.scale(w.sx, w.sy)
    ctx.translate(-this.width / 2, -this.height / 2)
  }

  private drawClip(
    ctx: CanvasRenderingContext2D,
    el: CanvasImageSource,
    clip: Clip,
    asset: MediaAsset,
    time: number = 0,
    skipLutIsolation = false,
  ) {
    // Per-clip LUT grade ("effect placed inside the clip"): render the clip
    // into an isolated scratch canvas, grade it there, composite back so
    // sibling content on the target canvas is untouched. A clip Mask uses the
    // same isolation: it mattes the clip's own graded pixels (only).
    const fxEff = this.effectsForRender(clip, time)
    if (!skipLutIsolation && (clip.adjustment?.luts?.some((l) => l.enabled) || this.hasPreviewLutFor(clip, time) || clip.mask?.enabled || hasPixelGrade(fxEff) || hasClipFxLayers(fxEff) || hasDeviceOverlay(fxEff) || !!(clip as unknown as { patch?: unknown }).patch)) {
      const scratch = this.takePadScratch()
      const octx = scratch.getContext('2d')!
      octx.translate(this.width, this.height) // frame origin at pad centre
      this.drawClip(octx, el, clip, asset, time, true)
      const { stack } = this.buildLutStack(clip, time)
      if (stack.length) applyLutStackToCanvas(scratch, stack)
      if (hasPixelGrade(fxEff)) applyPixelGrade(scratch, fxEff!, Math.round(time * 24))
      if (hasNg(fxEff as NgEffect)) applyGlitchNG(scratch, fxEff as NgEffect, time)
      if (hasClipFxLayers(fxEff) || hasDeviceOverlay(fxEff)) applyClipFxLayers(scratch, fxEff!, time)
      if (clip.mask?.enabled) this.applyClipVisualMask(scratch, clip.mask, Math.max(0, time - clip.start))
      // Composite with the caller's current state (alpha/filter/transform of
      // an enclosing compound must keep applying to this clip's pixels).
      const t = ctx.getTransform()
      if (t.a === 1 && t.b === 0 && t.c === 0 && t.d === 1 && t.e === 0 && t.f === 0) {
        ctx.drawImage(scratch, -this.width, -this.height) // screen-space target
      } else {
        ctx.drawImage(scratch, -this.width / 2 - this.width, -this.height / 2 - this.height) // compound-local target
      }
      // AM Echo Keyframes / Motion Blur: ghost the rendered clip at past times
      const ghosts = [...pfxEchoTimes(fxEff, time), ...pfxMotionBlurSamples(fxEff, time, (this as unknown as { projectFps?: number }).projectFps || 24)]
      for (const g of ghosts) {
        if (g.time < clip.start) continue
        const gev = evalClipPfx(clip, g.time)
        const vw = (asset.width || this.width) * Math.abs(gev.scaleX || 1)
        const vh = (asset.height || this.height) * Math.abs(gev.scaleY || 1)
        const gx = this.width / 2 + gev.x * (this.width / PW) - vw / 2
        const gy = this.height / 2 + gev.y * (this.height / PH) - vh / 2
        ctx.save()
        ctx.globalAlpha = (ctx.globalAlpha || 1) * g.alpha
        ctx.drawImage(scratch, gx + this.width, gy + this.height, vw, vh)
        ctx.restore()
      }
      // device overlay lives in FRAME space, so it composites after the pad
      if (hasDeviceOverlay(fxEff)) {
        const kdOv2 = ensureKeyedDevice(fxEff)
        if (kdOv2) {
          ctx.save()
          ctx.setTransform(1, 0, 0, 1, 0, 0)
          ctx.filter = 'none'
          ctx.globalAlpha = 1
          drawDeviceOverlay(ctx, this.width, this.height, kdOv2, time)
          ctx.restore()
        }
      }
      this.releasePadScratch(scratch)
      return
    }
    const vw =
      (el as HTMLVideoElement).videoWidth ||
      (el as HTMLImageElement).naturalWidth ||
      asset.width ||
      PW
    const vh =
      (el as HTMLVideoElement).videoHeight ||
      (el as HTMLImageElement).naturalHeight ||
      asset.height ||
      PH
    const cover = Math.max(this.width / vw, this.height / vh)
    const artwork = getLayeredArtworkInfo(asset)
    const artworkComposite = toCanvasCompositeOperation(artwork?.blendMode)
    const hasArtworkCanvas = Boolean(artwork && artwork.documentWidth > 0 && artwork.documentHeight > 0)
    // Cropped source layers share one document-space fit and retain their
    // signed offsets rather than independently covering the frame.
    const artworkFit = hasArtworkCanvas
      ? Math.min(this.width / artwork!.documentWidth, this.height / artwork!.documentHeight)
      : null
    const layoutScale = artworkFit ?? cover
    const dw = vw * layoutScale
    const dh = vh * layoutScale
    const drawX = hasArtworkCanvas
      ? -(artwork!.documentWidth * artworkFit!) / 2 + (artwork!.left || 0) * artworkFit!
      : -dw / 2
    const drawY = hasArtworkCanvas
      ? -(artwork!.documentHeight * artworkFit!) / 2 + (artwork!.top || 0) * artworkFit!
      : -dh / 2

    const evalT = evalClipPfx(clip, time)
    ctx.save()
    this.applyParentWorld(ctx, clip, time)
    ctx.globalAlpha *= Math.max(0, Math.min(1, evalT.opacity))
    if (artwork && !artwork.opacityBaked) {
      ctx.globalAlpha *= Math.max(0, Math.min(1, artwork.opacity))
    }
    if (artworkComposite) ctx.globalCompositeOperation = artworkComposite

    // Clip filters stack on top of any enclosing compound filter.
    applyClipFilter(ctx, this.effectsForRender(clip, time))

    const cx = this.width / 2 + evalT.x * (this.width / PW)
    const cy = this.height / 2 + evalT.y * (this.height / PH)
    ctx.translate(cx, cy)
    // Pivot (anchor): rotation/scale hinge on this point of the drawn rect
    // (Krita armature technique). pivot == 0.5/0.5 reproduces centre rotation.
    const pvx = drawX + evalT.pivotX * dw
    const pvy = drawY + evalT.pivotY * dh
    ctx.translate(pvx, pvy)
    ctx.rotate((evalT.rotationZ * Math.PI) / 180)
    applyRotationXY(ctx, evalT.rotationX, evalT.rotationY)
    ctx.scale(evalT.scaleX, evalT.scaleY)
    ctx.translate(-pvx, -pvy)

    const st = useEditor.getState()
    const resolvedPsdPart = artwork ? this.resolveLayeredArtworkRigPart(asset, st) : undefined
    const rigPart = resolvedPsdPart?.node.part
    const isOmniFrameEligible =
      asset.id === 'asset-death-note-vid' ||
      clip.assetId === 'asset-death-note-vid' ||
      asset.id === 'asset-death-note-img' ||
      clip.assetId === 'asset-death-note-img' ||
      asset.id === 'asset-room-chair-towel' ||
      clip.assetId === 'asset-room-chair-towel' ||
      asset.name.toLowerCase().includes('death note') ||
      clip.name.toLowerCase().includes('death note') ||
      asset.name.toLowerCase().includes('room') ||
      clip.name.toLowerCase().includes('room') ||
      asset.name.toLowerCase().includes('chair') ||
      clip.name.toLowerCase().includes('chair')
    if (!rigPart?.hidden) {
      if (!resolvedPsdPart && isOmniFrameEligible && st.omniframeCharacters && st.omniframeCharacters.length > 0) {
        this.drawOmniframeCharacters(ctx, dw, dh, time, st, asset)
      } else {
        const drawSource = () => {
          try {
            const warped = rigPart
              ? this.drawPsdPuppetLayer(ctx, el, asset, rigPart, time - clip.start, drawX, drawY, dw, dh)
              : false
            if (!warped) ctx.drawImage(el, drawX, drawY, dw, dh)
          } catch {
            /* not ready */
          }
        }

        if (resolvedPsdPart) {
          const { rig, node } = resolvedPsdPart
          const world = node.world
          const sourceDocumentWidth = Math.max(1, artwork?.documentWidth || rig.canvasWidth || 1)
          const sourceDocumentHeight = Math.max(1, artwork?.documentHeight || rig.canvasHeight || 1)
          const rigScaleX = (artworkFit ?? 1) * (sourceDocumentWidth / Math.max(1, rig.canvasWidth || sourceDocumentWidth))
          const rigScaleY = (artworkFit ?? 1) * (sourceDocumentHeight / Math.max(1, rig.canvasHeight || sourceDocumentHeight))
          const pivotX = drawX + node.part.pivot.x * dw
          const pivotY = drawY + node.part.pivot.y * dh
          ctx.save()
          ctx.globalAlpha *= Math.max(0, Math.min(1, world.opacity ?? 1))
          ctx.translate(pivotX + world.x * rigScaleX, pivotY + world.y * rigScaleY)
          ctx.rotate(((world.rotation || 0) * Math.PI) / 180)
          ctx.scale(world.scale ?? 1, world.scale ?? 1)
          ctx.translate(-pivotX, -pivotY)
          drawSource()
          ctx.restore()
        } else {
          drawSource()
        }
      }
    }

    // Render Title / Text Overlay if clip has text style
    if (clip.textStyle) {
      this.drawTextClip(ctx, clip, time)
    }

    // Green-screen device overlay (AI chroma plates, public/devices/): the
    // keyed plate floats over the composited clip; clip pixels show through
    // the chroma hole. Drawn in project space, above everything of this clip.
    if (hasDeviceOverlay(fxEff)) {
      const kdOv = ensureKeyedDevice(fxEff)
      if (kdOv) {
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.filter = 'none'
        ctx.globalAlpha = 1
        drawDeviceOverlay(ctx, this.width, this.height, kdOv, time)
        ctx.restore()
      }
    }

    ctx.restore()
  }

  private drawOmniframeCharacters(
    ctx: CanvasRenderingContext2D,
    dw: number,
    dh: number,
    time: number,
    st: ReturnType<typeof useEditor.getState>,
    asset?: any,
  ) {
    const isRoom =
      asset?.id === 'asset-room-chair-towel' ||
      asset?.name?.toLowerCase()?.includes('room') ||
      asset?.name?.toLowerCase()?.includes('chair') ||
      st.omniframeCharacters?.some((c) => c.id.startsWith('char_towel') || c.id.startsWith('char_chair'))

    const bgPath = isRoom
      ? '/assets/room/clean_room_background.png'
      : '/assets/death_note/clean_background.png'

    const bgImg = getUrlImage(bgPath)
    if (bgImg.complete && bgImg.naturalWidth > 0) {
      ctx.drawImage(bgImg, -dw / 2, -dh / 2, dw, dh)
    } else {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(-dw / 2, -dh / 2, dw, dh)
    }

    const characters = st.omniframeCharacters || []
    for (const char of characters) {
      const evalT = st.evaluateCharacterTransformAtTime(char.id, time)
      if ((evalT.opacity ?? 1) <= 0.01) continue

      let sequenceUrl: string | null = null
      if (!char.recolorUrl && char.cutoutSequence?.length) {
        let sequenceFrame: { time: number; url: string } | undefined
        for (const frame of char.cutoutSequence) {
          if (frame.time > time) break
          sequenceFrame = frame
        }
        if (sequenceFrame) sequenceUrl = sequenceFrame.url
      }
      const imgUrl = char.recolorUrl || sequenceUrl || char.cutoutUrl
      const charImg = getUrlImage(imgUrl)
      if (!charImg.complete || charImg.naturalWidth === 0) continue

      const baseLeft = -dw / 2 + char.bounds.x * dw
      const baseTop = -dh / 2 + char.bounds.y * dh
      const baseW = char.bounds.width * dw
      const baseH = char.bounds.height * dh

      const scale = evalT.scale ?? 1
      const cx = baseLeft + baseW / 2 + (evalT.x ?? 0) * (dw / PW)
      const cy = baseTop + baseH / 2 + (evalT.y ?? 0) * (dh / PH)
      const cw = baseW * scale
      const ch = baseH * scale

      ctx.save()
      ctx.globalAlpha *= Math.max(0, Math.min(1, evalT.opacity ?? 1))
      ctx.translate(cx, cy)
      if (evalT.rotation) {
        ctx.rotate((evalT.rotation * Math.PI) / 180)
      }
      ctx.drawImage(charImg, -cw / 2, -ch / 2, cw, ch)

      // Dynamic tint / recolor if set
      if (char.recolorColor) {
        ctx.save()
        ctx.globalCompositeOperation = 'color'
        ctx.fillStyle = char.recolorColor
        ctx.fillRect(-cw / 2, -ch / 2, cw, ch)
        ctx.restore()
      }

      ctx.restore()
    }
  }

  private drawCompoundClip(
    ctx: CanvasRenderingContext2D,
    clip: Clip,
    time: number,
    st: ReturnType<typeof useEditor.getState>,
    trackMuted: boolean,
    skipLutIsolation = false,
  ) {
    const childSeq = (st.sequences || []).find((s) => s.id === clip.sourceSequenceId)
    const childClips = childSeq ? childSeq.clips : (clip.originalChildClips || [])
    const childTracks = childSeq ? childSeq.tracks : (clip.originalChildTracks || [])

    // Nested adjustment layers (inside this compound) or the compound's own
    // LUT grade require isolated rendering so the grade stays scoped to this
    // compound's pixels only.
    const hasNestedAdjustment = childClips.some((c) => c.kind === 'adjustment')
    const { stack: ownLuts } = this.buildLutStack(clip, time)
    const cFxEff = this.effectsForRender(clip, time)
    if (!skipLutIsolation && (hasNestedAdjustment || ownLuts.length > 0 || clip.mask?.enabled || hasPixelGrade(cFxEff) || hasClipFxLayers(cFxEff) || hasDeviceOverlay(cFxEff))) {
      const scratch = this.takePadScratch()
      const octx = scratch.getContext('2d')!
      octx.translate(this.width, this.height) // frame origin at pad centre
      this.drawCompoundContents(octx, clip, time, st, trackMuted, childClips, childTracks)
      if (ownLuts.length) applyLutStackToCanvas(scratch, ownLuts)
      if (hasPixelGrade(cFxEff)) applyPixelGrade(scratch, cFxEff!, Math.round(time * 24))
      if (hasClipFxLayers(cFxEff) || hasDeviceOverlay(cFxEff)) applyClipFxLayers(scratch, cFxEff!, time)
      if (clip.mask?.enabled) this.applyClipVisualMask(scratch, clip.mask, Math.max(0, time - clip.start))
      // Composite with the caller's current state intact (outer opacity /
      // filter / transform keep applying, exactly like non-isolated draws).
      const t = ctx.getTransform()
      if (t.a === 1 && t.b === 0 && t.c === 0 && t.d === 1 && t.e === 0 && t.f === 0) {
        ctx.drawImage(scratch, -this.width, -this.height)
      } else {
        ctx.drawImage(scratch, -this.width / 2 - this.width, -this.height / 2 - this.height)
      }
      this.releasePadScratch(scratch)
      return
    }
    this.drawCompoundContents(ctx, clip, time, st, trackMuted, childClips, childTracks)
  }

  private drawCompoundContents(
    ctx: CanvasRenderingContext2D,
    clip: Clip,
    time: number,
    st: ReturnType<typeof useEditor.getState>,
    trackMuted: boolean,
    childClips: Clip[],
    childTracks: Track[],
  ) {
    const evalT = evalClipPfx(clip, time)
    ctx.save()
    ctx.globalAlpha *= Math.max(0, Math.min(1, evalT.opacity))

    applyClipFilter(ctx, this.effectsForRender(clip, time))

    const cx = this.width / 2 + evalT.x * (this.width / PW)
    const cy = this.height / 2 + evalT.y * (this.height / PH)
    ctx.translate(cx, cy)
    // Compound pivot is a fraction of the whole frame: rotating the compound
    // about a linkage point carries every nested clip with it (FK chain).
    const pvx = (evalT.pivotX - 0.5) * this.width
    const pvy = (evalT.pivotY - 0.5) * this.height
    ctx.translate(pvx, pvy)
    ctx.rotate((evalT.rotationZ * Math.PI) / 180)
    applyRotationXY(ctx, evalT.rotationX, evalT.rotationY)
    ctx.scale(evalT.scaleX, evalT.scaleY)
    ctx.translate(-pvx, -pvy)
    // Children are placed with the same convention as the main timeline:
    // drawClip/drawTextClip translate by (frame/2 + position). Without this
    // shift the compound's centre-origin frame double-translates every
    // child by (+width/2, +height/2) — compounded media used to render in
    // the bottom-right corner (drawing children were unaffected because
    // they paint in absolute frame coordinates).
    ctx.translate(-this.width / 2, -this.height / 2)

    const innerTime = remapClipLocal(clip, time - clip.start) + clip.inPoint

    const renderChildTracks = [...childTracks].reverse()
    for (const childTrack of renderChildTracks) {
      if (childTrack.type === 'video' && childTrack.hidden) continue

      const childClip = activeClipOnTrack(childClips, childTrack.id, innerTime)
      if (!childClip) continue

      // Nested adjustment layer: grades only what has been drawn inside
      // this compound so far (the scratch canvas when isolated).
      if (childClip.kind === 'adjustment' && childTrack.type === 'video') {
        this.applyAdjustmentLayer(ctx, ctx.canvas, childClip, innerTime)
        continue
      }

      if (childClip.kind === 'compound') {
        this.drawCompoundClip(ctx, childClip, innerTime, st, trackMuted || childTrack.muted)
        continue
      }

      const childAsset = st.assets.find((a) => a.id === childClip.assetId)
      if (!childAsset) {
        if (childClip.textStyle && childTrack.type === 'video') {
          this.drawTextClip(ctx, childClip, innerTime)
        }
        continue
      }

      const el = this.syncElement(childAsset, innerTime, childClip, st.playing, trackMuted || childTrack.muted, st.speed)
      if (!el) continue

      if (childTrack.type === 'video') {
        this.drawClip(ctx, el as CanvasImageSource, childClip, childAsset, innerTime)
      }
    }

    ctx.restore()
  }

  dispose() {
    this.running = false
    cancelAnimationFrame(this.raf)
    this.unsubscribe?.()
    this.unsubscribe = null
    if (activePreviewEngine === this) activePreviewEngine = null
    this.puppetCanvas = null
    if (this.sampling) {
      this.samplePool.forEach((el) => {
        el.pause()
        el.removeAttribute('src')
      })
      this.samplePool.clear()
      return
    }
    videoCache.forEach((v) => v.pause())
    audioCache.forEach((a) => a.pause())
  }
}
