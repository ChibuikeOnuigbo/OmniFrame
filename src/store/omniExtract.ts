/**
 * Omniframe extract slice: the REAL omniframe skills the rest of the app does
 * not duplicate — transparent selection, mind-main-element, cut-out extract to
 * a clip on the track above, and patch-under. The headless MCP tools
 * (tools/mcp/tools.mjs) run the identical maths from src/lib/selectionMattes.
 */
import { transparentMatte, mainElementMatte, type MatteResult } from '../lib/selectionMattes'
import type { Clip, MediaAsset } from '../types'

export interface OmniSelectionStats {
  clipId: string
  pixels: number
  bbox: { x0: number; y0: number; x1: number; y1: number } | null
}
export interface OmniExtractState {
  omniSelection: OmniSelectionStats | null
}
export interface OmniExtractSlice {
  omniTransparentSelect: (opts?: {
    ignore?: string; ignoreTol?: number; target?: 'dark' | 'light' | [number, number, number]; targetTol?: number
    rect?: [number, number, number, number]
  }) => Promise<{ pixels: number; bbox: [number, number, number, number] | null }>
  omniSelectMainElement: (rect?: [number, number, number, number], tol?: number) => Promise<{ pixels: number; bbox: [number, number, number, number] | null }>
  omniExtractCutout: () => { clipId: string; trackId: string } | null
  omniSetPatchUnder: (on: boolean) => void
}

interface Deps { pushSnapshot: () => void }
type Set = (p: Record<string, unknown>) => void
type Get = () => any

let sel: { clipId: string; matte: MatteResult; img: HTMLImageElement; mw: number; mh: number } | null = null

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image()
    im.onload = () => res(im)
    im.onerror = rej
    im.src = url
  })
}
const hex = (v: string): [number, number, number] =>
  v[0] === '#' ? [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)] : [255, 255, 255]

export function createOmniExtractSlice(set: Set, get: Get, { pushSnapshot }: Deps): OmniExtractSlice {
  const selClip = () => {
    const st = get()
    return (st.clips as Clip[]).find((c) => c.id === st.selectedClipId) || (st.clips as Clip[])[0] || null
  }
  const assetOf = (c: Clip) => (get().assets as MediaAsset[]).find((a) => a.id === c.assetId) || null
  const seq = () => get().sequenceSettings as { width: number; height: number }
  const coverScale = (c: Clip, mw: number, mh: number) => {
    const s = seq()
    return Math.max(s.width / mw, s.height / mh) * (c.transform?.scale ?? 1)
  }
  const pixels = async (c: Clip) => {
    const asset = assetOf(c)
    if (!asset) throw new Error('selected clip has no asset')
    const img = await loadImg(asset.url)
    const mw = asset.width || img.naturalWidth
    const mh = asset.height || img.naturalHeight
    const cv = document.createElement('canvas')
    cv.width = mw; cv.height = mh
    cv.getContext('2d')!.drawImage(img, 0, 0, mw, mh)
    return { img, mw, mh, data: cv.getContext('2d')!.getImageData(0, 0, mw, mh).data }
  }
  const stats = (clipId: string, m: MatteResult) => {
    const out = { pixels: m.pixels, bbox: m.bbox ? ([m.bbox.x0, m.bbox.y1 - (m.bbox.y1 - m.bbox.y1), m.bbox.x1, m.bbox.y1] as [number, number, number, number]) : null }
    if (m.bbox) out.bbox = [m.bbox.x0, m.bbox.y0, m.bbox.x1, m.bbox.y1]
    set({ omniSelection: { clipId, pixels: m.pixels, bbox: m.bbox } })
    return out
  }
  return {
    omniTransparentSelect: async (opts = {}) => {
      const c = selClip()
      if (!c) throw new Error('nothing selected')
      const { img, mw, mh, data } = await pixels(c)
      const r = opts.rect ? { x0: opts.rect[0], y0: opts.rect[1], x1: opts.rect[2], y1: opts.rect[3] } : { x0: 0, y0: 0, x1: mw, y1: mh }
      const m = transparentMatte(data, mw, mh, r, {
        ignore: hex(opts.ignore ?? '#ffffff'), ignoreTol: opts.ignoreTol ?? 40,
        target: opts.target ?? 'dark', targetTol: opts.targetTol ?? 90,
      })
      sel = { clipId: c.id, matte: m, img, mw, mh }
      return stats(c.id, m)
    },
    omniSelectMainElement: async (rect, tol = 48) => {
      const c = selClip()
      if (!c) throw new Error('nothing selected')
      const { img, mw, mh, data } = await pixels(c)
      const r = rect ? { x0: rect[0], y0: rect[1], x1: rect[2], y1: rect[3] } : { x0: 0, y0: 0, x1: mw, y1: mh }
      const m = mainElementMatte(data, mw, mh, r, tol)
      sel = { clipId: c.id, matte: m, img, mw, mh }
      return stats(c.id, m)
    },
    omniExtractCutout: () => {
      if (!sel || !sel.matte.bbox) return null
      pushSnapshot()
      const st = get()
      const src = (st.clips as Clip[]).find((c) => c.id === sel!.clipId)
      if (!src) return null
      const b = sel.matte.bbox
      const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1
      const cv = document.createElement('canvas')
      cv.width = sel.mw; cv.height = sel.mh
      const cx2 = cv.getContext('2d')!
      cx2.drawImage(sel.img, 0, 0, sel.mw, sel.mh)
      const md = cx2.createImageData(sel.mw, sel.mh)
      for (let i = 0, j = 0; i < sel.matte.alpha.length; i++, j += 4) {
        md.data[j] = 255; md.data[j + 1] = 255; md.data[j + 2] = 255; md.data[j + 3] = sel.matte.alpha[i]
      }
      const mc = document.createElement('canvas')
      mc.width = sel.mw; mc.height = sel.mh
      mc.getContext('2d')!.putImageData(md, 0, 0)
      cx2.globalCompositeOperation = 'destination-in'
      cx2.drawImage(mc, 0, 0)
      const crop = document.createElement('canvas')
      crop.width = bw; crop.height = bh
      crop.getContext('2d')!.drawImage(cv, b.x0, b.y0, bw, bh, 0, 0, bw, bh)
      const asset = assetOf(src)
      if (!asset) return null
      const newAsset: MediaAsset = { ...asset, id: `asset-omni-${Date.now()}`, url: crop.toDataURL('image/png'), name: 'omni cutout', width: bw, height: bh }
      st.addAsset(newAsset)
      const trackId = st.ensureTrack('video') as string
      st.addClipToTrack(trackId, newAsset.id, src.start)
      const s = seq()
      const sc = coverScale(src, sel.mw, sel.mh)
      const offX = (b.x0 + bw / 2 - sel.mw / 2) * sc
      const offY = (b.y0 + bh / 2 - sel.mh / 2) * sc
      const rw = sel.mw * sc, rh = sel.mh * sc
      const ccx = s.width / 2 + (src.transform?.x ?? 0), ccy = s.height / 2 + (src.transform?.y ?? 0)
      const hole = {
        x0: ccx - rw / 2 + (b.x0 / sel.mw) * rw, y0: ccy - rh / 2 + (b.y0 / sel.mh) * rh,
        x1: ccx - rw / 2 + ((b.x1 + 1) / sel.mw) * rw, y1: ccy - rh / 2 + ((b.y1 + 1) / sel.mh) * rh,
      }
      const newId = get().selectedClipId as string
      const clips = (get().clips as Clip[]).map((c) => {
        if (c.id === newId) return { ...c, duration: src.duration, transform: { ...c.transform, scale: src.transform?.scale ?? 1, x: (src.transform?.x ?? 0) + offX, y: (src.transform?.y ?? 0) + offY } }
        if (c.id === src.id) return { ...c, omniHole: hole }
        return c
      })
      set({ clips })
      return { clipId: newId, trackId }
    },
    omniSetPatchUnder: (on) => {
      const st = get()
      const cid = (st.clips as Clip[]).find((c) => c.omniHole)?.id || st.omniSelection?.clipId || st.selectedClipId
      const clip = (st.clips as Clip[]).find((c) => c.id === cid)
      if (!clip) return
      const hole = clip.omniHole
      if (!hole) return
      const s = seq()
      const clips = (st.clips as Clip[]).map((c) => {
        if (c.id !== cid) return c
        if (!on) {
          const { mask: _m, patch: _p, ...rest } = c as Clip & { mask?: unknown; patch?: unknown }
          return rest as Clip
        }
        return {
          ...c,
          mask: {
            enabled: true, kind: 'shape', shape: 'rectangle',
            centerX: (hole.x0 + hole.x1) / 2 / s.width, centerY: (hole.y0 + hole.y1) / 2 / s.height,
            width: (hole.x1 - hole.x0) / s.width, height: (hole.y1 - hole.y0) / s.height,
            feather: 0, inverted: true,
          },
          patch: { strategy: 'smart', x0: hole.x0, y0: hole.y0, x1: hole.x1, y1: hole.y1, feather: 2 },
        }
      })
      set({ clips })
    },
  }
}
