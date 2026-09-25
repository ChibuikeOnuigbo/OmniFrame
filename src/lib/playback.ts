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

import { useEditor } from '../store'
import type { Clip, MediaAsset, Track, Transition } from '../types'
import { clamp } from './time'
import { renderAllPaintLayers } from './drawingEngine'

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

  constructor(canvas: HTMLCanvasElement, width = PW, height = PH) {
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
    const st = useEditor.getState()
    let time = st.playhead
    if (st.playing && !st.scrubbing) {
      time += dt * st.speed
      if (time >= st.duration) {
        time = st.duration
        st.pause()
      } else if (time <= 0 && st.speed < 0) {
        time = 0
        st.pause()
      }
      st.setPlayhead(time)
    }
    this.renderFrame(time, st)
    this.raf = requestAnimationFrame(this.loop)
  }

  private renderFrame(time: number, st: ReturnType<typeof useEditor.getState>) {
    const ctx = this.backCtx
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, this.width, this.height)
    this.usedThisFrame.clear()
    let visualPending = false

    // Standard NLE visual compositing: lower tracks drawn first, higher visual tracks composite on top
    const renderTracks = [...st.tracks].reverse()

    for (const track of renderTracks) {
      if (track.type === 'video' && track.hidden) {
        continue
      }

      // Check if an active transition is playing on this track
      const activeTrans = (st.transitions || []).find(
        (tr) =>
          tr.trackId === track.id &&
          tr.enabled &&
          time >= tr.startTime &&
          time <= tr.startTime + tr.duration,
      )

      if (activeTrans && track.type === 'video') {
        const fromClip = st.clips.find((c) => c.id === activeTrans.fromClipId)
        const toClip = st.clips.find((c) => c.id === activeTrans.toClipId)
        const fromAsset = fromClip ? st.assets.find((a) => a.id === fromClip.assetId) : null
        const toAsset = toClip ? st.assets.find((a) => a.id === toClip.assetId) : null
        if (fromClip && toClip && fromAsset && toAsset) {
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
          continue
        }
      }

      const clip = activeClipOnTrack(st.clips, track.id, time)
      if (!clip) continue
      const asset = st.assets.find((a) => a.id === clip.assetId)
      if (!asset) continue
      const el = this.syncElement(asset, time, clip, st.playing, track.muted, st.speed)
      if (!el) {
        if (track.type === 'video') visualPending = true
        continue
      }
      if (track.type === 'video') {
        const media = asset.kind === 'video' ? el as HTMLVideoElement : null
        if (media && (media.seeking || media.readyState < HTMLMediaElement.HAVE_CURRENT_DATA)) {
          visualPending = true
          continue
        }
        this.drawClip(ctx, el as CanvasImageSource, clip, asset)
      }
    }

    // Composite Paint Layers & Vector Drawing Strokes
    if (st.drawingStrokes && st.drawingStrokes.length > 0) {
      renderAllPaintLayers(
        ctx,
        this.width,
        this.height,
        st.drawingStrokes,
        st.paintLayers || [],
        time,
        st.projectFps || 30,
      )
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
    fromAsset: MediaAsset,
    toAsset: MediaAsset,
    time: number,
    st: ReturnType<typeof useEditor.getState>,
    trackMuted: boolean,
  ) {
    const fromEl = this.syncElement(fromAsset, time, fromClip, st.playing, trackMuted, st.speed)
    const toEl = this.syncElement(toAsset, time, toClip, st.playing, trackMuted, st.speed)
    if (!fromEl && !toEl) return

    const progress = clamp((time - trans.startTime) / Math.max(0.001, trans.duration), 0, 1)

    ctx.save()
    switch (trans.type) {
      case 'cross_dissolve': {
        if (fromEl) {
          ctx.save()
          ctx.globalAlpha = 1 - progress
          this.drawClip(ctx, fromEl as CanvasImageSource, fromClip, fromAsset)
          ctx.restore()
        }
        if (toEl) {
          ctx.save()
          ctx.globalAlpha = progress
          this.drawClip(ctx, toEl as CanvasImageSource, toClip, toAsset)
          ctx.restore()
        }
        break
      }
      case 'dip_to_black': {
        if (progress < 0.5) {
          if (fromEl) {
            ctx.save()
            ctx.globalAlpha = 1 - progress * 2
            this.drawClip(ctx, fromEl as CanvasImageSource, fromClip, fromAsset)
            ctx.restore()
          }
        } else {
          if (toEl) {
            ctx.save()
            ctx.globalAlpha = (progress - 0.5) * 2
            this.drawClip(ctx, toEl as CanvasImageSource, toClip, toAsset)
            ctx.restore()
          }
        }
        break
      }
      case 'dip_to_white': {
        if (progress < 0.5) {
          if (fromEl) this.drawClip(ctx, fromEl as CanvasImageSource, fromClip, fromAsset)
          ctx.fillStyle = `rgba(255, 255, 255, ${progress * 2})`
          ctx.fillRect(0, 0, this.width, this.height)
        } else {
          if (toEl) this.drawClip(ctx, toEl as CanvasImageSource, toClip, toAsset)
          ctx.fillStyle = `rgba(255, 255, 255, ${(1 - progress) * 2})`
          ctx.fillRect(0, 0, this.width, this.height)
        }
        break
      }
      case 'wipe_left': {
        if (fromEl) this.drawClip(ctx, fromEl as CanvasImageSource, fromClip, fromAsset)
        if (toEl) {
          ctx.save()
          ctx.beginPath()
          ctx.rect(this.width * (1 - progress), 0, this.width * progress, this.height)
          ctx.clip()
          this.drawClip(ctx, toEl as CanvasImageSource, toClip, toAsset)
          ctx.restore()
        }
        break
      }
      case 'wipe_right': {
        if (fromEl) this.drawClip(ctx, fromEl as CanvasImageSource, fromClip, fromAsset)
        if (toEl) {
          ctx.save()
          ctx.beginPath()
          ctx.rect(0, 0, this.width * progress, this.height)
          ctx.clip()
          this.drawClip(ctx, toEl as CanvasImageSource, toClip, toAsset)
          ctx.restore()
        }
        break
      }
      case 'slide_left': {
        if (fromEl) {
          ctx.save()
          ctx.translate(-progress * this.width, 0)
          this.drawClip(ctx, fromEl as CanvasImageSource, fromClip, fromAsset)
          ctx.restore()
        }
        if (toEl) {
          ctx.save()
          ctx.translate((1 - progress) * this.width, 0)
          this.drawClip(ctx, toEl as CanvasImageSource, toClip, toAsset)
          ctx.restore()
        }
        break
      }
      case 'slide_right': {
        if (fromEl) {
          ctx.save()
          ctx.translate(progress * this.width, 0)
          this.drawClip(ctx, fromEl as CanvasImageSource, fromClip, fromAsset)
          ctx.restore()
        }
        if (toEl) {
          ctx.save()
          ctx.translate(-(1 - progress) * this.width, 0)
          this.drawClip(ctx, toEl as CanvasImageSource, toClip, toAsset)
          ctx.restore()
        }
        break
      }
      case 'zoom': {
        if (fromEl) {
          ctx.save()
          const s = 1.0 + progress * 0.4
          ctx.translate(this.width / 2, this.height / 2)
          ctx.scale(s, s)
          ctx.translate(-this.width / 2, -this.height / 2)
          ctx.globalAlpha = 1 - progress
          this.drawClip(ctx, fromEl as CanvasImageSource, fromClip, fromAsset)
          ctx.restore()
        }
        if (toEl) {
          ctx.save()
          const s = 1.4 - progress * 0.4
          ctx.translate(this.width / 2, this.height / 2)
          ctx.scale(s, s)
          ctx.translate(-this.width / 2, -this.height / 2)
          ctx.globalAlpha = progress
          this.drawClip(ctx, toEl as CanvasImageSource, toClip, toAsset)
          ctx.restore()
        }
        break
      }
      default: {
        if (fromEl) this.drawClip(ctx, fromEl as CanvasImageSource, fromClip, fromAsset)
        break
      }
    }
    ctx.restore()
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
  ): HTMLVideoElement | HTMLAudioElement | HTMLImageElement | null {
    if (asset.kind === 'image') {
      const img = getImage(asset)
      if (!img.complete || img.naturalWidth === 0) return null
      return img
    }
    const el = (asset.kind === 'video' ? getVideo(asset) : getAudio(asset)) as
      | HTMLVideoElement
      | HTMLAudioElement
    const target = clip.inPoint + (time - clip.start)
    const srcDur = asset.duration || (el as HTMLVideoElement).duration || 0
    if (target < -0.001 || target > srcDur + 0.05) return null
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

  private drawClip(
    ctx: CanvasRenderingContext2D,
    el: CanvasImageSource,
    clip: Clip,
    asset: MediaAsset,
  ) {
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
    const dw = vw * cover
    const dh = vh * cover

    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, clip.transform.opacity))

    // Apply Real Clip Effects (brightness, contrast, saturation, blur, grayscale, invert, sepia)
    if (clip.effects) {
      const eff = clip.effects
      const filters: string[] = []
      if (typeof eff.brightness === 'number') filters.push(`brightness(${eff.brightness})`)
      if (typeof eff.contrast === 'number') filters.push(`contrast(${eff.contrast})`)
      if (typeof eff.saturation === 'number') filters.push(`saturate(${eff.saturation})`)
      if (typeof eff.blur === 'number' && eff.blur > 0) filters.push(`blur(${eff.blur}px)`)
      if (typeof eff.grayscale === 'number' && eff.grayscale > 0) filters.push(`grayscale(${eff.grayscale})`)
      if (typeof eff.invert === 'number' && eff.invert > 0) filters.push(`invert(${eff.invert})`)
      if (typeof eff.sepia === 'number' && eff.sepia > 0) filters.push(`sepia(${eff.sepia})`)
      if (filters.length > 0) ctx.filter = filters.join(' ')
    }

    const cx = this.width / 2 + clip.transform.x * (this.width / PW)
    const cy = this.height / 2 + clip.transform.y * (this.height / PH)
    ctx.translate(cx, cy)
    ctx.rotate((clip.transform.rotation * Math.PI) / 180)
    ctx.scale(clip.transform.scale, clip.transform.scale)
    try {
      ctx.drawImage(el, -dw / 2, -dh / 2, dw, dh)
    } catch {
      /* not ready */
    }

    // Render Title / Text Overlay if clip has text style
    if (clip.textStyle) {
      ctx.save()
      const t = clip.textStyle
      ctx.font = `${t.bold ? 'bold ' : ''}${t.italic ? 'italic ' : ''}${t.fontSize || 48}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const metrics = ctx.measureText(t.text)
      const textW = metrics.width + 40
      const textH = (t.fontSize || 48) + 24
      if (t.backgroundColor) {
        ctx.fillStyle = t.backgroundColor
        ctx.fillRect(-textW / 2, -textH / 2, textW, textH)
      }
      ctx.fillStyle = t.color || '#ffffff'
      ctx.fillText(t.text, 0, 0)
      ctx.restore()
    }

    ctx.restore()
  }

  dispose() {
    this.running = false
    cancelAnimationFrame(this.raf)
    this.unsubscribe?.()
    this.unsubscribe = null
    videoCache.forEach((v) => v.pause())
    audioCache.forEach((a) => a.pause())
  }
}
