import { BLEND_MODES, putBlendKey } from '../../src/lib/blendModes.ts'
import { PNG } from 'pngjs'
// OmniFrame MCP layer v2 — UNIVERSAL tools only (vow.md universal-tools law).
// No task-shaped tools: puzzles are solved by recipes (JSON lists of these
// calls). The agent's eyes = snapshot; its hands = these calls. Rendering uses
// the app's own semantics (CurveEngine transforms, ClipVisualMask mattes,
// ClipEffect maths) via appRender.mjs, so outputs are app-made, not agent-made.
import fs from 'fs'
import path from 'path'
import { MCPTool, MCPRegistry, ToolResult, VideoEncoder, FrameProvider, makeCanvas, loadImage, cover, ffmpegExe, CanvasImage } from './core.mjs'
import { execFileSync } from 'child_process'
import { createHash } from 'crypto'
import * as pathModule from 'path'
import { Sequence, makeClip, renderFrame, CE, applyEffects, cardFlipFactor, loadAppTs, applyShapeMatte , setPaintGetter } from './appRender.mjs'
import { bedPainterLocal } from './beds.mjs'
import { hasAudio, audioMixPlan, muxAudio } from './audioExport.mjs'

const DEFORMATION=await loadAppTs('src/lib/deformation.ts')
const SPEED=await loadAppTs('src/lib/speedCurves.ts')
const ROOT = path.resolve(import.meta.dirname, '../..')
const TAR = path.join(ROOT, 'test_ans_result')

/* ---------- session (the booted headless app) ---------- */
export const SESSION = {
  seq: null, selection: null, trace: [], mode: 'omniframe', omniSelection: null,
  paint: { strokes: [], layers: [{ id: 'paint-1', name: 'paint', visible: true, locked: false, opacity: 1 }], clock: 0 },
  reset() {
    this.seq = null; this.selection = null; this.trace = []; this.mode = 'omniframe'; this.omniSelection = null
    this.compounds = []; this.seqStack = []; this.videoFrames = {}
    this.paint = { strokes: [], layers: [{ id: 'paint-1', name: 'paint', visible: true, locked: false, opacity: 1 }], clock: 0 }
    // Saved templates are a reusable library; only project-owned state resets.
  },
  note(tool, params, out) { this.trace.push({ tool, params, out }); return out },
}
const seq = () => { if (!SESSION.seq) throw new Error('no composition: call project_new first'); return SESSION.seq }
const sel = () => { if (!SESSION.selection) throw new Error('nothing selected: click a clip first'); return SESSION.selection }

function imgDraw(buf) {
  let im = null
  return async (sx, w, h) => { if (!im) im = await loadImage(buf); sx.drawImage(im, 0, 0, im.width, im.height, 0, 0, w, h) }
}

/* ---------- universal tools ---------- */
class ProjectNew extends MCPTool {
  constructor() { super('project_new', 'Major tool: new composition (sequence settings).', { w: 'px', h: 'px', fps: '', duration: 's', bg: 'css' }) }
  async run(p) { SESSION.reset(); SESSION.seq = new Sequence(p); return SESSION.note('project_new', p, { w: p.w, h: p.h, fps: p.fps, duration: p.duration }) }
}
class OmniframeMode extends MCPTool {
  constructor() { super('omniframe_mode', 'Major tool: toggle omniframe mode on the session.', { on: 'bool' }) }
  async run({ on = true }) { SESSION.mode = on ? 'omniframe' : 'standard'; return SESSION.note('omniframe_mode', { on }, { mode: SESSION.mode }) }
}
class ImportMedia extends MCPTool {
  constructor() { super('import_media', 'Major tool: import media as a clip (fit or cover).', { path: 'repo-relative', fit: 'contain|cover', scale: 'number' }) }
  async run({ path: rel, fit = 'contain', scale }) {
    const buf = fs.readFileSync(path.isAbsolute(rel) ? rel : path.join(ROOT, rel))
    const im = await loadImage(buf)
    const s = seq()
    const f = fit === 'cover' ? Math.max(s.w / im.width, s.h / im.height) : Math.min(s.w / im.width, s.h / im.height)
    const k = (scale || 1) * f
    const draw = (sx, w, h) => sx.drawImage(im, 0, 0, im.width, im.height, 0, 0, w, h)
    const clip = makeClip({ id: `clip-${s.clips.length + 1}`, name: path.basename(rel), asset: rel, natW: im.width * k, natH: im.height * k, duration: s.duration, draw })
    s.addClip(clip)
    SESSION.selection = clip
    return SESSION.note('import_media', { path: rel, fit }, { clipId: clip.id, natW: Math.round(clip.natW), natH: Math.round(clip.natH) })
  }
}
function videoFrameStore(dir, files) {
  const cache = new Map()
  return (i) => {
    const idx = Math.max(0, Math.min(files.length - 1, Math.floor(i)))
    let entry = cache.get(idx)
    if (!entry) {
      const png=PNG.sync.read(fs.readFileSync(pathModule.join(dir, files[idx])))
      // Reuse the native canvas AND ImageData allocations after eviction.
      // Allocating a new native ImageData for every decoded frame grows RSS
      // throughout long moving exports despite the JS map's bounded size.
      if(cache.size>=40){const oldest=cache.keys().next().value;entry=cache.get(oldest);cache.delete(oldest)}
      if(!entry||entry.canvas.width!==png.width||entry.canvas.height!==png.height){
        const canvas=makeCanvas(png.width,png.height)
        entry={canvas,pixels:canvas.getContext('2d').createImageData(png.width,png.height)}
      }
      entry.pixels.data.set(png.data);entry.canvas.getContext('2d').putImageData(entry.pixels,0,0)
      cache.set(idx, entry)
    }
    return entry.canvas
  }
}
class ImportVideo extends MCPTool {
  constructor() { super('import_video', 'Major tool: import an mp4/mov/webm as a MOVING clip in headless renders (ffmpeg frame extraction cached under .cache/video-frames). Registers frames so text can mask the real footage inside glyphs (textStyle.insideVideo).', { path: 'repo-relative or absolute', fps: 'extract fps (default 12)', fit: 'contain|cover', scale: '' }) }
  async run({ path: rel, fps = 12, fit = 'cover', scale }) {
    const video = await extractVideoFrames(rel, fps)
    const {abs, files, get} = video; fps = video.fps
    const s = seq()
    const im = get(0)
    const f2 = fit === 'cover' ? Math.max(s.w / im.width, s.h / im.height) : Math.min(s.w / im.width, s.h / im.height)
    const k = (scale || 1) * f2
    const dur = files.length / Number(fps)
    const draw = (sx, w, h, t) => {
      const g = get(Math.max(0, t) * Number(fps))
      sx.drawImage(g, 0, 0, g.width, g.height, 0, 0, w, h)
    }
    const clip = makeClip({ id: `clip-${s.clips.length + 1}`, name: pathModule.basename(rel), asset: rel, natW: im.width * k, natH: im.height * k, duration: dur, draw })
    clip.sourceVideo = { path: abs, hasAudio: hasAudio(abs), fps: Number(fps) }
    clip.volume = 1
    s.addClip(clip)
    SESSION.selection = clip
    SESSION.videoFrames = SESSION.videoFrames || {}
    SESSION.videoFrames[rel] = { get, files, fps: Number(fps) }
    return SESSION.note('import_video', { path: rel, fps, fit, scale }, { clipId: clip.id, frames: files.length, duration: +dur.toFixed(2), hasAudio: clip.sourceVideo.hasAudio })
  }
}
class NewBackground extends MCPTool {
  constructor() { super('new_background', 'Major tool: add a replace-bg bed clip (app replaceBg family).', { kind: 'synthwave|aurora|grid|bokeh|sunset|studio|wedge' }) }
  async run({ kind }) {
    const s = seq()
    const clip = makeClip({ id: `clip-${s.clips.length + 1}`, name: `bg:${kind}`, asset: `bed:${kind}`, natW: s.w, natH: s.h, duration: s.duration, draw: (sx, w, h, t) => bedPainterLocal(kind)(sx, w, h, t) })
    s.clips.unshift(clip)
    SESSION.selection = clip
    return SESSION.note('new_background', { kind }, { clipId: clip.id })
  }
}
class Click extends MCPTool {
  constructor() { super('click', 'Major tool: click preview coords → selects topmost clip there (the agent points, the app selects).', { x: 'px', y: 'px', t: 's' }) }
  async run({ x, y, t = 0 }) {
    const hit = seq().hitTest(x, y, t)
    SESSION.selection = hit ? hit.clip : null
    return SESSION.note('click', { x, y, t }, hit ? { clipId: hit.clip.id, rect: hit.rect } : { hit: null })
  }
}
class MaskDraw extends MCPTool {
  constructor() { super('mask_draw', 'Masking sub-tool: draw rectangle/ellipse mask over preview region on the selected clip.', { shape: 'rectangle|ellipse', x0: '', y0: '', x1: '', y1: '', feather: 'px', inverted: 'bool' }) }
  async run({ shape = 'rectangle', x0, y0, x1, y1, feather = 0, inverted = false }) {
    const s = seq(), c = sel()
    // store mask in CLIP-CONTENT space so it survives moves/pastes/keys
    const r0 = s.clipRect(c, 0)
    const bw = r0.w, bh = r0.h, bx = r0.x, by = r0.y
    c.mask = { shape, kind: 'shape', centerX: ((x0 + x1) / 2 - bx) / bw, centerY: ((y0 + y1) / 2 - by) / bh, width: Math.abs(x1 - x0) / bw, height: Math.abs(y1 - y0) / bh, feather: feather / bw, inverted, enabled: true }
    return SESSION.note('mask_draw', { shape, x0, y0, x1, y1, feather }, { clipId: c.id, mask: c.mask })
  }
}
class MaskClear extends MCPTool {
  constructor() { super('mask_clear', 'Masking sub-tool: remove mask from selected clip.', {}) }
  async run() { const c = sel(); c.mask = undefined; return SESSION.note('mask_clear', {}, { clipId: c.id }) }
}
class KeyframeSet extends MCPTool {
  constructor() { super('keyframe_set', 'Major tool: set a position/scale/rotation/opacity keyframe on the selected clip (app CurveEngine). interpolation custom + points = your own dragged curve.', { property: 'position|scale|rotation|opacity|pivot', channel: 'X|Y|Z|Scalar', time: 's', value: '', interpolation: 'app InterpolationType', points: '[[x,y]..] for custom' }) }
  async run({ property, channel = 'Scalar', time, value, interpolation = 'linear', points, params }) {
    const c = sel()
    if (property === 'charStyle') {
      const [ri, prop] = String(channel).split('.')
      const idx = Number(ri)
      const ts = (c.textStyle ||= {})
      const ranges = (ts.charRanges ||= [])
      const text = String(c.name || '').replace(/^text:/, '')
      if (!ranges[idx]) ranges[idx] = { start: 0, end: [...text].length }
      const r = ranges[idx]
      r.keys = r.keys || {}
      const lt = (Number(time) || 0) - c.start
      const ks = (r.keys[prop] = (r.keys[prop] || []).filter(k => Math.abs(k.t - lt) > 1e-6))
      ks.push({ t: lt, v: value, interp: interpolation, params })
      ks.sort((a, b) => a.t - b.t)
      return SESSION.note('keyframe_set', { property, channel, time, value, interpolation }, { clipId: c.id, range: idx, prop, keys: ks.length })
    }
    const SCALAR = new Set(['opacity', 'playback_speed', 'wheel_rotation'])
    const key = SCALAR.has(property) ? property : `${property}_${channel.toLowerCase()}`
    const curve = c.animation.curves[key]
    if (!curve) throw new Error(`no curve ${key}; have ${Object.keys(c.animation.curves).join(',')}`)
    const { curve: updated, keyframe: kf } = CE.addOrUpdateKeyframe(curve, time, value, interpolation)
    if (interpolation === 'custom' && Array.isArray(points)) kf.points = points.map(([x, y]) => ({ x, y }))
    c.animation.curves[key] = updated
    return SESSION.note('keyframe_set', { property, channel, time, value, interpolation }, { clipId: c.id, curve: key, keyframeId: kf.id })
  }
}
class CurveSet extends MCPTool {
  constructor() { super('curve_set', 'Major tool: apply an app easing/interpolation preset to a property curve of the selected clip.', { property: '', channel: '', interpolation: 'app InterpolationType' }) }
  async run({ property, channel = 'Scalar', interpolation }) {
    const c = sel()
    const SCALAR = new Set(['opacity', 'playback_speed', 'wheel_rotation'])
    const key = SCALAR.has(property) ? property : `${property}_${channel.toLowerCase()}`
    let curve = c.animation.curves[key]
    for (const k of curve.keyframes) curve = CE.applyEasingPreset(curve, k.id, interpolation)
    c.animation.curves[key] = curve
    return SESSION.note('curve_set', { property, channel, interpolation }, { clipId: c.id, curve: key, keys: curve.keyframes.map(k => k.id) })
  }
}
class TransformSet extends MCPTool {
  constructor() { super('transform_set', 'Major tool: set base transform of selected clip (app ClipTransform fields: x, y, scale, rotation, opacity, pivot).', { x: '', y: '', scale: '', rotation: 'deg', opacity: '' }) }
  async run(p) { const c = sel(); Object.assign(c.transform, p); return SESSION.note('transform_set', p, { clipId: c.id, transform: c.transform }) }
}
class DuplicatePaste extends MCPTool {
  constructor() { super('duplicate_paste', 'Major tool: ctrl+x/ctrl+v (or ctrl+c/ctrl+v with copy:true) — paste a copy of selected clip at offset.', { dx: '', dy: '', copy: 'bool' }) }
  async run({ dx = 0, dy = 0, copy = false }) {
    const s = seq(), c = sel()
    const i = s.clips.indexOf(c)
    if (!copy) s.clips.splice(i, 1)
    const pasted = structuredCloneSafe(c)
    pasted.id = `clip-${s.clips.length + 1}`
    pasted.transform = { ...c.transform, x: c.transform.x + dx, y: c.transform.y + dy }
    pasted.animation = JSON.parse(JSON.stringify(c.animation))
    s.clips.push(pasted)
    SESSION.selection = pasted
    return SESSION.note('duplicate_paste', { dx, dy, copy }, { clipId: pasted.id })
  }
}
function structuredCloneSafe(c) {
  const { draw, ...rest } = c
  const copy = JSON.parse(JSON.stringify(rest))
  copy.draw = draw
  return copy
}
class BlendSet extends MCPTool {
  constructor() { super('blend_set', 'Major tool: composite blend + opacity of selected clip.', { mode: 'blend mode', opacity: '0..1', time: 'optional clip-local seconds; creates a hold keyframe' }) }
  async run({ mode, opacity, time }) {
    const c=sel()
    if(mode&&!BLEND_MODES.has(mode))throw Error('Unsupported blend mode')
    if(time!==undefined){if(!mode)throw Error('Mode required for keyframe');c.blendKeys=putBlendKey(c.blendKeys||[],time,mode)}
    else if(mode)c.blendMode=mode
    if(opacity!==undefined)c.opacity=opacity
    return SESSION.note('blend_set',{mode,opacity,time},{clipId:c.id,blendMode:c.blendMode,blendKeys:c.blendKeys,opacity:c.opacity})
  }
}
class EffectSet extends MCPTool {
  constructor() { super('effect_set', 'Major tool: set ClipEffect fields on selected clip (pixelate, chromaKey, fractalBlur, lumaKey, cardFlip…).', { patch: 'Partial<ClipEffect>' }) }
  async run({ patch }) { const c = sel(); c.effects = { ...c.effects, ...patch }; return SESSION.note('effect_set', { patch }, { clipId: c.id, effects: c.effects }) }
}
class FillCompositionArea extends MCPTool {
  constructor() { super('fill_composition_area', 'Major tool (clicked in Hancybox/CapCut tutorials): scale selected clip to cover the sequence.', {}) }
  async run() {
    const s = seq(), c = sel()
    const k = Math.max(s.w / c.natW, s.h / c.natH)
    c.transform.scale = k
    return SESSION.note('fill_composition_area', {}, { clipId: c.id, scale: +k.toFixed(4) })
  }
}
class CompoundClipCreate extends MCPTool {
  constructor() { super('compound_clip_create', 'Major tool: nest selected clips into a compound clip (persisted — list/rename/expand afterwards). nest:true builds the real inner sequence (compound_enter/uncompound_clip then work, children keep their native scale with no view cutoff); default records the descriptor only.', { ids: '[]', name: 'label', nest: 'bool (real inner sequence)' }) }
  async run({ ids, name, nest = false }) {
    const s = seq()
    SESSION.compounds = SESSION.compounds || []
    if (!nest) {
      const comp = { id: `compound-${SESSION.compounds.length + 1}`, kind: 'compound', name: name || `Compound ${SESSION.compounds.length + 1}`, memberIds: ids, nestedTrackCount: 1, createdFrom: s.clips.filter(c => ids.includes(c.id)).map(c => c.id) }
      SESSION.compounds.push(comp)
      return SESSION.note('compound_clip_create', { ids, name: comp.name, nest }, comp)
    }
    const members = s.clips.filter(c => ids.includes(c.id))
    if (!members.length) throw new Error('no member clips found for ids ' + JSON.stringify(ids))
    const cid = `compound-${SESSION.compounds.length + 1}`
    const { Sequence: Seq } = await import('./appRender.mjs')
    const child = new Seq({ w: s.w, h: s.h, fps: s.fps, duration: s.duration, bg: 'rgba(0,0,0,0)' })
    child.id = `seq-${cid}`
    child.clips = members
    child.tracks = [...s.tracks]
    s.clips = s.clips.filter(c => !ids.includes(c.id))
    const start = Math.min(...members.map(m => m.start))
    const end = Math.max(...members.map(m => m.start + m.duration))
    // A nested sequence starts at zero. Keeping absolute parent starts here
    // made compounds created later on the timeline render blank at the front.
    for (const member of members) member.start -= start
    child.duration = end - start
    const comp = makeClip({ id: cid, name: name || `Compound ${SESSION.compounds.length + 1}`, natW: s.w, natH: s.h, duration: end - start, draw: () => {} })
    comp.kind = 'compound'
    comp.sourceSequenceId = child.id
    comp.childSeq = child
    comp.memberIds = ids
    comp.start = start
    s.addClip(comp)
    SESSION.compounds.push({ id: cid, kind: 'compound', name: comp.name, memberIds: ids, nestedTrackCount: 1, createdFrom: ids })
    return SESSION.note('compound_clip_create', { ids, name: comp.name, nest:true }, { id: cid, memberIds: ids, name: comp.name })
  }
}
class ClipMoveTime extends MCPTool {
  constructor() { super('clip_move_time', 'Major tool (timeline): drag a clip horizontally — set its start time on the timeline (the CapCut/AM horizontal drag).', { clipId: '', start: 's' }) }
  async run({ clipId, start }) {
    const s = seq()
    const c = clipId ? s.clips.find(k => k.id === clipId) : sel()
    if (!c) throw new Error('no clip ' + clipId)
    const from = c.start
    c.start = Math.max(0, Number(start) || 0)
    return SESSION.note('clip_move_time', { clipId: c.id, start: c.start }, { clipId: c.id, from, to: c.start })
  }
}
class AlignClips extends MCPTool {
  constructor() { super('align_clips', 'Major tool (alignment): align every target clip (or ids) — hcenter/vcenter/left/right/top/bottom against the frame, or distribute-h to space centres evenly.', { mode: 'hcenter|vcenter|left|right|top|bottom|distribute-h', ids: '[] optional subset' }) }
  async run({ mode = 'hcenter', ids }) {
    const s = seq()
    const targets = s.clips.filter(c => c.kind !== 'adjustment' && c.kind !== 'compound' && (!ids || ids.includes(c.id)))
    if (!targets.length) throw new Error('no alignable clips')
    const rects = targets.map(c => ({ c, r: s.clipRect(c, 0) }))
    if (mode === 'distribute-h') {
      rects.sort((a, b) => (a.r.x + a.r.w / 2) - (b.r.x + b.r.w / 2))
      const first = rects[0].r.x + rects[0].r.w / 2
      const last = rects.at(-1).r.x + rects.at(-1).r.w / 2
      const n = rects.length
      rects.forEach(({ c, r }, i) => { const want = n === 1 ? first : first + ((last - first) * i) / (n - 1); const tr = (c.transform = c.transform || {}); tr.x = (tr.x || 0) + (want - (r.x + r.w / 2)) })
    } else {
      for (const { c, r } of rects) {
        const tr = (c.transform = c.transform || {})
        if (mode === 'hcenter') tr.x = (tr.x || 0) + (s.w / 2 - (r.x + r.w / 2))
        else if (mode === 'vcenter') tr.y = (tr.y || 0) + (s.h / 2 - (r.y + r.h / 2))
        else if (mode === 'left') tr.x = (tr.x || 0) + (0 - r.x)
        else if (mode === 'right') tr.x = (tr.x || 0) + (s.w - (r.x + r.w))
        else if (mode === 'top') tr.y = (tr.y || 0) + (0 - r.y)
        else if (mode === 'bottom') tr.y = (tr.y || 0) + (s.h - (r.y + r.h))
        else throw new Error(`unknown align mode ${mode}`)
      }
    }
    return SESSION.note('align_clips', { mode }, { clips: targets.map(c => { const r = s.clipRect(c, 0); return { id: c.id, cx: Math.round(r.x + r.w / 2), cy: Math.round(r.y + r.h / 2) } }) })
  }
}
class MotionAnalyze extends MCPTool {
  constructor() { super('motion_analyze', 'Major tool (detection): app-pixel motion/behaviour/micro-animation analysis between two times — changed-pixel ratio, changed bbox, centroid shift, 8x6 motion grid, morphScore (centroid travel + bbox aspect delta).', { t0: 's', t1: 's' }) }
  async run({ t0 = 0, t1 = 0.5 }) {
    const s = seq()
    const A = renderFrame(s, Number(t0)).getContext('2d')
    const B = renderFrame(s, Number(t1)).getContext('2d')
    const w = s.w, h = s.h
    const da = A.getImageData(0, 0, w, h).data
    const db = B.getImageData(0, 0, w, h).data
    let changed = 0, sx = 0, sy = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1
    const GW = 8, GH = 6
    const grid = new Array(GW * GH).fill(0)
    const gcnt = new Array(GW * GH).fill(0)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const la = 0.299 * da[i] + 0.587 * da[i + 1] + 0.114 * da[i + 2]
        const lb = 0.299 * db[i] + 0.587 * db[i + 1] + 0.114 * db[i + 2]
        const dd = Math.abs(la - lb)
        const gi = Math.min(GH - 1, Math.floor((y / h) * GH)) * GW + Math.min(GW - 1, Math.floor((x / w) * GW))
        grid[gi] += dd; gcnt[gi]++
        if (dd > 24) { changed++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
      }
    }
    const n = w * h
    const cxA = changed ? sx / changed : w / 2
    const cyA = changed ? sy / changed : h / 2
    const bw = x1 >= 0 ? x1 - x0 + 1 : 0
    const bh = y1 >= 0 ? y1 - y0 + 1 : 0
    const aspect = bw && bh ? bw / bh : 0
    return SESSION.note('motion_analyze', { t0, t1 }, {
      changedRatio: +(changed / n).toFixed(4),
      bbox: changed ? [x0, y0, bw, bh] : null,
      centroid: changed ? [Math.round(cxA), Math.round(cyA)] : null,
      grid: grid.map((v, i) => +(v / Math.max(1, gcnt[i])).toFixed(2)),
      morphScore: +((changed / n) * 10 + Math.abs(aspect - 1) * 0.5).toFixed(4),
    })
  }
}
class ShapeDetect extends MCPTool {
  constructor() { super('shape_detect', 'Major tool (detection): threshold a rendered frame to a black/white matte, connected-component the white blobs and classify each (square/rect/circle/line/blob). Matte scan saved to data_motiondesijg/scans/.', { t: 's', thresh: '0..255 luma cut', minPx: 'min blob px' }) }
  async run({ t = 0, thresh = 128, minPx = 40 }) {
    const s = seq()
    const cv = renderFrame(s, Number(t))
    const x = cv.getContext('2d')
    const w = s.w, h = s.h
    const d = x.getImageData(0, 0, w, h)
    const bw = new Uint8Array(w * h)
    for (let i = 0, j = 0; i < d.data.length; i += 4, j++) {
      bw[j] = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2] > thresh ? 1 : 0
    }
    const matte = makeCanvas(w, h)
    const mx = matte.getContext('2d')
    const mi = mx.createImageData(w, h)
    for (let j = 0; j < bw.length; j++) { const v = bw[j] ? 255 : 0; mi.data[j * 4] = v; mi.data[j * 4 + 1] = v; mi.data[j * 4 + 2] = v; mi.data[j * 4 + 3] = 255 }
    mx.putImageData(mi, 0, 0)
    const dir = path.join(ROOT, 'data_motiondesijg', 'scans')
    fs.mkdirSync(dir, { recursive: true })
    const mattePath = path.join(dir, `shape-matte-${Number(t).toFixed(2)}.png`)
    fs.writeFileSync(mattePath, matte.toBuffer('image/png'))
    const label = new Int32Array(w * h)
    const shapes = []
    let next = 1
    const stack = []
    for (let j = 0; j < bw.length; j++) {
      if (!bw[j] || label[j]) continue
      const id = next++
      stack.length = 0
      stack.push(j)
      label[j] = id
      let px = 0, bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1
      while (stack.length) {
        const q = stack.pop()
        const qy = Math.floor(q / w), qx = q % w
        px++
        if (qx < bx0) bx0 = qx; if (qx > bx1) bx1 = qx
        if (qy < by0) by0 = qy; if (qy > by1) by1 = qy
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx2 = qx + dx, ny2 = qy + dy
          if (nx2 < 0 || ny2 < 0 || nx2 >= w || ny2 >= h) continue
          const ni = ny2 * w + nx2
          if (bw[ni] && !label[ni]) { label[ni] = id; stack.push(ni) }
        }
      }
      if (px < minPx) continue
      const bwid = bx1 - bx0 + 1, bhid = by1 - by0 + 1
      const fill = px / (bwid * bhid)
      const aspect = bwid / bhid
      let cls = 'blob'
      if (fill > 0.88) cls = aspect > 0.8 && aspect < 1.25 ? 'square' : 'rect'
      else if (fill > 0.7 && aspect > 0.8 && aspect < 1.25) cls = 'circle'
      else if (fill < 0.3 && (aspect > 3 || aspect < 0.33)) cls = 'line'
      shapes.push({ class: cls, px, bbox: [bx0, by0, bwid, bhid], fill: +fill.toFixed(3), aspect: +aspect.toFixed(3) })
    }
    shapes.sort((a, b) => b.px - a.px)
    return SESSION.note('shape_detect', { t, thresh }, { matte: path.relative(ROOT, mattePath), shapes: shapes.slice(0, 12) })
  }
}
class CompoundList extends MCPTool {
  constructor() { super('compound_list', 'Compound extra: list persisted compound clip descriptors.', {}) }
  async run() { return SESSION.note('compound_list', {}, { compounds: SESSION.compounds || [] }) }
}
class CompoundRename extends MCPTool {
  constructor() { super('compound_rename', 'Compound extra: rename a persisted compound descriptor.', { id: '', name: '' }) }
  async run({ id, name }) {
    const c = (SESSION.compounds || []).find(k => k.id === id)
    if (!c) throw new Error(`no compound ${id}`)
    c.name = String(name || c.name)
    return SESSION.note('compound_rename', { id, name: c.name }, c)
  }
}
class CompoundEnter extends MCPTool {
  constructor() { super('compound_enter', 'Double-click equivalent: open a compound clip\'s inner sequence as the active timeline (compound_exit returns).', { id: 'compound clip id' }) }
  async run({ id }) {
    const s = seq()
    const c = s.clips.find((k) => k.id === id && k.kind === 'compound' && k.childSeq)
    if (!c) throw new Error(`compound ${id} not found in active sequence or has no inner sequence`)
    SESSION.seqStack = SESSION.seqStack || []
    SESSION.seqStack.push(s)
    SESSION.seq = c.childSeq
    SESSION.selection = null
    return SESSION.note('compound_enter', { id }, { activeSequenceId: c.childSeq.id })
  }
}
class CompoundExit extends MCPTool {
  constructor() { super('compound_exit', 'Leave the current nested sequence: pops back to the parent timeline.', {}) }
  async run() {
    if (!SESSION.seqStack || !SESSION.seqStack.length) throw new Error('already at the top-level timeline')
    SESSION.seq = SESSION.seqStack.pop()
    SESSION.selection = null
    return SESSION.note('compound_exit', {}, { activeSequenceId: SESSION.seq.id || 'main' })
  }
}
class UncompoundClip extends MCPTool {
  constructor() { super('uncompound_clip', 'Reverse a compound: restores the original child clips into the active timeline (app: undo-registered, Ctrl+Z also reverses).', { id: 'compound clip id' }) }
  async run({ id }) {
    const s = seq()
    const i = s.clips.findIndex((k) => k.id === id && k.kind === 'compound')
    if (i < 0) throw new Error(`no compound ${id} in active sequence`)
    const c = s.clips[i]
    if (c.inPoint || (c.speedCurve && c.speedCurve !== 'linear')) throw new Error('Clear the compound source trim and speed curve before uncompounding; baking retimed child clips is not supported')
    const kids = c.childSeq ? c.childSeq.clips : []
    for (const kid of kids) kid.start += c.start
    s.clips.splice(i, 1, ...kids)
    SESSION.compounds = (SESSION.compounds || []).filter((k) => k.id !== id)
    return SESSION.note('uncompound_clip', { id }, { ok: true, restored: kids.map(k => k.id) })
  }
}
class CompoundExpand extends MCPTool {
  constructor() { super('compound_expand', 'Compound extra: expand (drop) a compound descriptor back to its member clips.', { id: '' }) }
  async run({ id }) {
    const i = (SESSION.compounds || []).findIndex(k => k.id === id)
    if (i < 0) throw new Error(`no compound ${id}`)
    const [c] = SESSION.compounds.splice(i, 1)
    return SESSION.note('compound_expand', { id }, { memberIds: c.memberIds })
  }
}
class SmartPatch extends MCPTool {
  constructor() { super('smart_patch', 'Major tool: smart-patch/inpainter — donor-sample clone with brush radius + feather (app SmartPatchSlice params).', { x0: '', y0: '', x1: '', y1: '', donor: '[x,y]', brushRadius: '', feather: '', strategy: 'clone|blur|gradient' }) }
  async run(p) {
    const c = sel()
    if (!['x0','y0','x1','y1'].every(key=>Number.isFinite(p[key])) || p.x0===p.x1 || p.y0===p.y1) throw new Error('smart_patch requires a finite, nonempty target rectangle')
    if (p.strategy && !['smart','clone','donor','blur','gradient'].includes(p.strategy)) throw new Error('unknown smart_patch strategy')
    if (p.donor && (!Array.isArray(p.donor) || p.donor.length!==2 || !p.donor.every(Number.isFinite))) throw new Error('donor must contain two finite coordinates')
    c.patch = p
    return SESSION.note('smart_patch', p, { clipId: c.id, patchRegion: [p.x0, p.y0, p.x1, p.y1], feather: p.feather ?? 5, brushRadius: p.brushRadius ?? 52 })
  }
}
class Snapshot extends MCPTool {
  constructor() { super('snapshot', 'The agent\'s ONLY eyes: render current preview frame to png, or pull a frame of an exported mp4.', { time: 's', out: 'png path', video: 'mp4 path (frame pull)', index: 'frame#' }) }
  async run({ time = 0, out, video, index = 0 }) {
    if (video) { const v = path.isAbsolute(video) ? video : path.join(ROOT, video); const dest = FrameProvider.frame({ video: v, index, out: out ? path.join(ROOT, out) : undefined }); return SESSION.note('snapshot', { video, index }, { png: path.relative(ROOT, dest) }) }
    const c = renderFrame(seq(), time)
    const dest = out ? path.join(ROOT, out) : path.join(TAR, `snap-${Date.now()}.png`)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, c.toBuffer('image/png'))
    return SESSION.note('snapshot', { time }, { png: path.relative(ROOT, dest) })
  }
}
class RenderExport extends MCPTool {
  constructor() { super('render_export', 'Major tool: export the current composition to mp4 with imported video audio, source trims and volume (the app produces the output).', { out: 'repo-relative mp4', fps: '', duration: '', audio: 'bool (default true); top-level video clips only' }) }
  async run({ out, fps, duration, audio = true }) {
    const s = seq()
    const f = fps || s.fps, dur = duration || s.duration
    const N = Math.round(f * dur)
    if (!Number.isFinite(f) || f <= 0 || !Number.isFinite(dur) || dur <= 0 || !N) throw new Error('Export fps and duration must be positive finite numbers')
    const mix = audio ? audioMixPlan(s, N / f) : []
    const dest = path.join(ROOT, out)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    const staging = mix.length ? dest + `.${process.pid}.video.mp4` : dest
    const enc = new VideoEncoder({ w: s.w, h: s.h, fps: f, out: staging })
    const outCv = makeCanvas(s.w, s.h)
    for (let i = 0; i < N; i++) enc.addCanvas(renderFrame(s, i / f, outCv))
    const info = await enc.finish()
    if (mix.length) {
      try { info.audio = muxAudio(staging, dest, mix, N / f) }
      finally { fs.unlinkSync(staging) }
      info.out = dest; info.size = fs.statSync(dest).size
    } else info.audio = { tracks: 0 }
    SESSION.note('render_export', { out }, { frames: info.frames })
    const r = new ToolResult('render_export', true, {
      video: path.relative(ROOT, dest), ...info, mode: SESSION.mode,
      recipe: SESSION.trace, inspect: inspectPayload(),
    })
    const safeStringify = (v) => {
      const seen = new WeakSet()
      return JSON.stringify(v, (k, val) => {
        if (val && typeof val === 'object') { if (seen.has(val)) return '[same-object-ref]'; seen.add(val) }
        return val
      }, 1)
    }
    fs.writeFileSync(dest.replace(/\.mp4$/, '.json'), safeStringify({ ...r.toJSON(), chunks: r.chunkManifest(1500).manifest }))
    return r.data
  }
}
/* ---------- paint canvas: ibisPaint X workflow harvested from the NothingxArt
   sunset short (2yAZqtdc_qk): time-lapse recording, radial ruler, smudge ---------- */
class DrawStroke extends MCPTool {
  constructor() { super('draw_stroke', 'Major tool: paint a stroke on the universal paint canvas (ibisPaint X engine). Tools: brush/pencil/marker/calligraphy/eraser/line/rectangle/rounded-rectangle/circle/triangle/diamond/pentagon/hexagon/octagon/heart/chevron/star/polygon/polyline/bezier/gradient/fill/smudge. radialCopies = symmetry/radial ruler (stroke repeated rotated around centre — sun rays, mandalas). Points are sequence pixels. Strokes appear sequentially in time so the canvas doubles as a process time-lapse.', { tool: 'text', points: '[[x,y],...] seq px', color: 'css', size: 'px', opacity: '0..1', gradientColor: 'css', radialCopies: '2..24 (Krita Multibrush symmetry)', mirrorX: 'bool — Krita Multibrush mirror across vertical axis', mirrorY: 'bool — mirror across horizontal axis', gradientShape: 'linear|radial (Krita Gradient tool shapes)', smoothing: '0..1 Krita Freehand Brush stabilizer', translateCopies: '2..12 Krita Multibrush Translate ring copies', translateRadius: 'px ring radius for translate copies', gradientRepeat: 'none|forward|alternating (Krita Gradient repeat modes)', filled: 'bool', appearAt: 's' }) }
  async run(p) {
    const st = SESSION.paint
    const w = SESSION.seq?.w || 640, h = SESSION.seq?.h || 360
    const at = typeof p.appearAt === 'number' ? p.appearAt : (st.clock = +(st.clock + 0.3).toFixed(2))
    const stroke = {
      id: 'stroke_' + Math.random().toString(36).slice(2, 8),
      layerId: 'paint-1',
      tool: p.tool || 'brush',
      color: p.color || '#ffffff',
      size: Math.max(1, Math.round(p.size ?? 12)),
      opacity: Math.min(1, Math.max(0.02, p.opacity ?? 1)),
      points: (p.points || []).map(([x, y]) => ({ x: +(x / w).toFixed(5), y: +(y / h).toFixed(5) })),
      temporalScope: { type: 'span', startTime: at, duration: 999 },
      radialCopies: p.radialCopies ? Math.min(24, Math.max(2, Math.round(p.radialCopies))) : undefined,
      mirrorX: !!p.mirrorX || undefined,
      mirrorY: !!p.mirrorY || undefined,
      gradientShape: p.gradientShape === 'radial' ? 'radial' : undefined,
      smoothing: typeof p.smoothing === 'number' ? Math.min(1, Math.max(0, p.smoothing)) : undefined,
      translateCopies: p.translateCopies ? Math.min(12, Math.max(2, Math.round(p.translateCopies))) : undefined,
      translateRadius: typeof p.translateRadius === 'number' ? Math.max(2, Math.round(p.translateRadius)) : undefined,
      gradientRepeat: p.gradientRepeat === 'forward' || p.gradientRepeat === 'alternating' ? p.gradientRepeat : undefined,
      radialCenter: Array.isArray(p.radialCenter) ? [+(p.radialCenter[0] / w).toFixed(5), +(p.radialCenter[1] / h).toFixed(5)] : undefined,
      gradientColor: p.gradientColor,
      filled: !!p.filled,
    }
    st.strokes.push(stroke)
    return SESSION.note('draw_stroke', { tool: stroke.tool, points: stroke.points.length, radialCopies: stroke.radialCopies }, { id: stroke.id, appearAt: at, totalStrokes: st.strokes.length })
  }
}
class PaintTimelapse extends MCPTool {
  constructor() { super('paint_timelapse', 'Major tool: render the paint canvas process time-lapse to mp4 — strokes appear in draw order, exactly like the ibisPaint X recording export. grade=dreamcore applies the NothingxArt sunset look (glow+grain+chromatic+vignette+dusk gradientMap). Returns video + final painting png.', { out: 'repo-relative mp4', grade: 'none|dreamcore', fps: 'n', duration: 's' }) }
  async run({ out, grade = 'none', fps, duration }) {
    const st = SESSION.paint
    if (!st.strokes.length) throw new Error('no strokes — call draw_stroke first')
    const s = SESSION.seq
    const w = s?.w || 1280, h = s?.h || 720
    const f = fps || s?.fps || 30
    const last = st.strokes.reduce((m, x) => Math.max(m, x.temporalScope.startTime || 0), 0)
    const dur = duration ?? +(last + 1).toFixed(2)
    const N = Math.max(2, Math.round(dur * f))
    const dest = path.join(ROOT, out)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    const DE = await loadAppTs('src/lib/drawingEngine.ts')
    const PG = await loadAppTs('src/lib/pixelGrade.ts')
    const DREAM = { glow: 0.5, grain: 0.35, chromatic: 2, vignette: 0.5, gradientMap: 0.35, gradientMapFrom: '#2b1e5a', gradientMapTo: '#ffb86b' }
    const enc = new VideoEncoder({ w, h, fps: f, out: dest })
    const canvas = makeCanvas(w, h)
    const cx = canvas.getContext('2d')
    for (let i = 0; i < N; i++) {
      const t = i / f
      cx.save(); cx.fillStyle = '#0b0a14'; cx.fillRect(0, 0, w, h); cx.restore()
      DE.renderAllPaintLayers(cx, w, h, st.strokes, st.layers, t, f)
      if (grade === 'dreamcore') PG.applyPixelGrade(canvas, DREAM, i)
      enc.addCanvas(canvas)
    }
    const info = await enc.finish()
    const finalPng = dest.replace(/\.mp4$/, '-final.png')
    fs.writeFileSync(finalPng, canvas.toBuffer('image/png'))
    SESSION.note('paint_timelapse', { out, grade }, { frames: info.frames, strokes: st.strokes.length })
    const r = new ToolResult('paint_timelapse', true, { video: path.relative(ROOT, dest), final: path.relative(ROOT, finalPng), grade, strokes: st.strokes.length, duration: dur, ...info })
    fs.writeFileSync(dest.replace(/\.mp4$/, '.json'), JSON.stringify(r.toJSON(), null, 1))
    return r.data
  }
}
class PaintClear extends MCPTool {
  constructor() { super('paint_clear', 'Clear the universal paint canvas (fresh time-lapse).', {}) }
  async run() { SESSION.paint = { strokes: [], layers: SESSION.paint.layers, clock: 0 }; return SESSION.note('paint_clear', {}, { ok: true }) }
}
class Inspect extends MCPTool {
  constructor() { super('inspect', 'Major tool: JSON dump of composition, selection, curves, trace (data info).', { scope: 'project|results' }) }
  async run({ scope = 'project' }) {
    if (scope === 'results') {
      const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])
      const files = walk(TAR).map(f => path.relative(ROOT, f))
      return { mp4: files.filter(f => f.endsWith('.mp4')), json: files.filter(f => f.endsWith('.json')) }
    }
    return inspectPayload()
  }
}
function inspectPayload() {
  const s = SESSION.seq
  return {
    mode: SESSION.mode,
    sequence: s ? { w: s.w, h: s.h, fps: s.fps, duration: s.duration, bg: s.bg } : null,
    selection: SESSION.selection ? SESSION.selection.id : null,
    clips: s ? s.clips.map(c => ({ id: c.id, name: c.name, start: c.start, duration: c.duration, inPoint: c.inPoint, speedCurve: c.speedCurve, volume: c.volume, asset: c.asset, deformation: c.deformation, transform: c.transform, mask: c.mask || null, blendMode: c.blendMode, blendKeys: c.blendKeys || [], opacity: c.opacity, effects: c.effects, patch: c.patch || null, curves: Object.fromEntries(Object.entries(c.animation.curves).map(([k, v]) => [k, v.keyframes.map(kf => ({ id: kf.id, time: kf.time, value: kf.value, interpolation: kf.interpolation }))])) })) : [],
    trace: SESSION.trace,
  }
}

class TrackNew extends MCPTool {
  constructor() { super('track_new', 'Major tool: add a timeline track (cutouts live on their own track).', { name: '' }) }
  async run({ name }) {
    const s = seq()
    const id = Math.max(...s.tracks.map(t => t.id)) + 1
    s.tracks.push({ id, name: name || `track ${id + 1}` })
    return SESSION.note('track_new', { name }, { trackId: id })
  }
}
class TrackAssign extends MCPTool {
  constructor() { super('track_assign', 'Major tool: move selected (or named) clip to a track.', { clipId: '', track: 'id' }) }
  async run({ clipId, track }) {
    const s = seq()
    const c = clipId ? s.clips.find(c => c.id === clipId) : sel()
    if (!s.tracks.some(t => t.id === track)) s.tracks.push({ id: track, name: `track ${track + 1}` })
    c.track = track
    return SESSION.note('track_assign', { clipId: c.id, track }, { clipId: c.id, track })
  }
}
class TimelineScreenshot extends MCPTool {
  constructor() { super('timeline_screenshot', 'Anti-cheat proof: the APP\'s own timeline renderer (src/lib/timelineSnapshot.ts) draws tracks, clip blocks, MASK/ROTO badges, keyframe diamonds, playhead and the MCP log → png + data:img.', { out: 'png path', playhead: 's' }) }
  async run({ out, playhead = 0 }) {
    const mod = await loadAppTs('src/lib/timelineSnapshot.ts')
    const s = seq()
    const payload = {
      sequence: { width: s.w, height: s.h, fps: s.fps, duration: s.duration },
      tracks: s.tracks,
      clips: s.clips.map(c => ({
        id: c.id, name: c.name, start: c.start, duration: c.duration, track: c.track ?? 0,
        masked: Boolean(c.mask && c.mask.enabled), roto: c.mask?.kind === 'custom',
        keyed: Object.entries(c.animation.curves).filter(([, v]) => v.keyframes.length > 0).map(([k]) => k),
        selected: SESSION.selection === c, kind: c.asset && c.asset.startsWith('text:') ? 'text' : 'media',
      })),
      playhead, log: SESSION.trace.map(t => ({ tool: t.tool, ok: true })),
      title: `OmniFrame timeline — ${SESSION.mode} mode`,
    }
    const { w, h } = mod.timelineSnapshotSize(payload)
    const c = makeCanvas(w, h)
    mod.drawTimelineSnapshot(c.getContext('2d'), payload, w, h)
    const dest = out ? path.join(ROOT, out) : path.join(TAR, `timeline-${Date.now()}.png`)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, c.toBuffer('image/png'))
    const b64 = c.toBuffer('image/png').toString('base64')
    const sidecar = `${dest}.json`
    fs.writeFileSync(sidecar, JSON.stringify({ tool: 'timeline_screenshot', png: path.relative(ROOT, dest), 'data:img': `data:image/png;base64,${b64}` }, null, 1))
    return SESSION.note('timeline_screenshot', { out, playhead }, { png: path.relative(ROOT, dest), sidecar: path.relative(ROOT, sidecar), bytes: Math.round(b64.length * 0.75) })
  }
}
class RunRecipe extends MCPTool {
  constructor() { super('run_recipe', 'Execute a recipe: plain JSON list of universal tool calls (puzzles are data, not code).', { file: 'repo-relative json', overrides: '{}', variants: '[{overrides}]' }) }
  async run({ file, overrides = {}, variants }) {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'))
    const runs = variants && variants.length ? variants : (raw.variants && raw.variants.length ? raw.variants : [null])
    const out = []
    for (const v of runs) {
      const ov = { ...overrides, ...(v && v.overrides || {}) }
      SESSION.reset()
      const steps = JSON.parse(JSON.stringify(raw.steps))
      const applied = []
      for (const step of steps) {
        const params = JSON.parse(JSON.stringify(step.params || {})
          .replace(/"\{\{(\w+)\}\}"/g, (m, k) => (k in ov ? (typeof ov[k] === 'number' ? String(ov[k]) : JSON.stringify(String(ov[k]))) : m))
          .replace(/\{\{(\w+)\}\}/g, (m, k) => (k in ov ? String(ov[k]) : m)))
        const res = await registry.call(step.tool, params)
        if (!res.ok) throw new Error(`recipe step ${step.tool} failed: ${JSON.stringify(res.data)}`)
        applied.push({ tool: step.tool, ok: true })
      }
      out.push({ variant: v && v.name || null, steps: applied.length, last: SESSION.trace[SESSION.trace.length - 1] })
    }
    return { recipe: file, runs: out }
  }
}


/* ---------- professional-MCP layer: help / preset logs / create / edit /
   context menu / data dumps / bg-removal / roto ---------- */
const APP_FUNCTION_CATALOG = {
  drawingShapes: ['rectangle', 'rounded-rectangle', 'circle', 'triangle', 'diamond', 'pentagon', 'hexagon', 'octagon', 'heart', 'chevron', 'star', 'polygon (3–12 sides)'],
  create: ['text (TEXT_PRESETS)', 'null object', 'shape mask', 'background bed (replaceBg family)', 'compound clip', 'import media'],
  edit: ['transform (pos/size/rot)', 'mask draw/clear', 'roto points mask', 'effects inside', 'blend+opacity', 'speed curve', 'convert to compound'],
  select: ['click preview coords', 'select by id', 'expand to group'],
  contextMenu: ['group', 'ungroup', 'new-null', 'compound', 'duplicate', 'delete', 'bring-front', 'send-back'],
  effects: ['pixelate', 'waveWarp', 'chromaKey', 'lumaKey (bg removal)', 'fractalBlur', 'cardFlip', 'posterize', 'grain', 'chromatic', 'lightType/intensity/color/falloff', 'particleFx: feathers/embers/dust/bokeh(+shape beds bokeh-square/plus/triangle/hexagon/star/bowtie/slash)/sparkles/snow/rain/petals', 'overlayFx: scanlines/halftone/spotlight/vignette/lightleak/frameglow', 'replaceBg: synthwave/aurora/grid/bokeh/sunset/studio', 'fx catalog (9k+ real presets, 8 sub-tabs) via fx_catalog/fx_add/fx_update/fx_remove', 'glitch EFFECT (intensity/style/scan/static/seed/rate, keyframeable — no longer a transition)', 'deviceOverlay: none/phone/monitor (AI chroma-green plates keyed live)', 'transitions: device_phone/device_monitor/device_tv (procedural 3D device fly-in → 2D handoff)'],
  keyframes: ['position_x/y/z', 'rotation_x/y/z', 'scale_x/y/z', 'opacity', 'pivot_x/y', 'interpolations: constant/linear/bezier/ease-in/ease-out/ease-in-out/cubic-in/cubic-out/back/bounce/elastic'],
  presetsCatalogs: ['TEXT_PRESETS', 'PILLAR_PRESETS (glitch family now EFFECTS)', 'TRANSITION_PRESETS (glitch removed)', 'RATIO_PRESETS', 'speedCurves (15)', 'effectCatalog (9k+)'],
}
class Help extends MCPTool {
  constructor() { super('help', 'Explains EVERY tool + lists all app functions/creation types so an agent can discover instead of guess.', {}) }
  async run() {
    return SESSION.note('help', {}, {
      tools: registry.list(),
      appFunctions: APP_FUNCTION_CATALOG,
      creationTypes: ['text', 'null', 'shape-mask', 'background', 'compound', 'media'],
      workflow: ['project_new', 'import_media/new_background/create_text', 'click or select', 'mask_draw/roto_mask/effect_set/keyframe_set', 'snapshot to see', 'render_export'],
    })
  }
}
class ListPresets extends MCPTool {
  constructor() { super('list_presets', 'Paginated log of existing presets BEFORE choosing. Use preset_preview for rendered pixels.', { catalog: 'effect|text|pillar|transition|lut|ratios|speed|shake', offset: 'n', limit: 'n' }) }
  async run({ catalog = 'text', offset = 0, limit = 8 }) {
    let entries = []
    const scan = (rel) => {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
      const out = []
      const re = /\{\s*id:\s*'([^']+)',\s*name:\s*["']([^"']+)["']/g
      let m
      while ((m = re.exec(src))) out.push({ id: m[1], name: m[2] })
      return out
    }
    if (catalog === 'effect') entries = FXC.getFxCatalog().map(({ id, name, cat }) => ({ id, name, category: cat }))
    else if (catalog === 'lut') {
      const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/luts/manifest.json'), 'utf8'))
      entries = (manifest.luts || []).map(({ id, name, category, file }) => ({ id, name, category, file }))
    }
    else if (catalog === 'text') entries = scan('src/lib/textPresets.ts')
    else if (catalog === 'pillar') entries = scan('src/lib/pillarPresets.ts')
    else if (catalog === 'transition') entries = scan('src/lib/transitionPresets.ts')
    else if (catalog === 'ratios') entries = scan('src/lib/aspectRatios.ts')
    else if (catalog === 'shake') entries = (await loadAppTs('src/lib/shakePresets.ts')).SHAKE_PRESETS.map(p => ({ id: p.id, name: p.name }))
    else entries = SPEED.SPEED_CURVES.map(c => ({ id: c.id, name: c.name }))
    const total = entries.length
    offset = Math.max(0, Number(offset) || 0)
    limit = Math.max(1, Math.min(200, Number(limit) || 8))
    entries = entries.slice(offset, offset + limit)
    return SESSION.note('list_presets', { catalog, offset, limit }, { catalog, total, offset, count: entries.length, nextOffset: offset + entries.length < total ? offset + entries.length : null, entries })
  }
}
function swatch(catalog, id) {
  const c = makeCanvas(96, 54), x = c.getContext('2d')
  if (catalog === 'text') { x.fillStyle = '#14161c'; x.fillRect(0, 0, 96, 54); x.fillStyle = '#fff'; x.font = 'bold 14px sans-serif'; x.fillText(id.slice(0, 10), 6, 32) }
  else { bedPainterLocal(id === 'synthwave' || id === 'aurora' || id === 'grid' || id === 'bokeh' || id === 'sunset' || id === 'studio' || id === 'wedge' ? id : 'studio')(x, 96, 54, 0.5); x.fillStyle = 'rgba(255,255,255,0.85)'; x.font = '9px monospace'; x.fillText(id.slice(0, 12), 4, 50) }
  return `data:image/png;base64,${c.toBuffer('image/png').toString('base64')}`
}
class PresetPreview extends MCPTool {
  constructor() { super('preset_preview', 'Render a real effect, LUT, or text preset through the shared editor engine and return data:img. Transition previews use the live in-app MCP bridge because they require the browser playback transition engine and two adjacent clips.', { catalog: 'effect|lut|text', id: 'preset id', text: 'optional demo text', time: 'seconds', out: 'optional PNG path' }) }
  async run({ catalog, id, text = 'OMNIFRAME', time = 0.7, out }) {
    if (catalog === 'transition') throw new Error('Use the live app preset_preview for transitions; it previews the actual cut between two adjacent timeline clips')
    const saved = {
      seq: SESSION.seq, selection: SESSION.selection, trace: SESSION.trace, mode: SESSION.mode,
      omniSelection: SESSION.omniSelection, paint: SESSION.paint, compounds: SESSION.compounds,
      seqStack: SESSION.seqStack, videoFrames: SESSION.videoFrames,
    }
    try {
      await registry.call('project_new', { w: 320, h: 180, fps: 12, duration: 2, bg: '#101626' })
      const bg = await registry.call('new_background', { kind: 'studio' })
      if (!bg.ok) throw new Error(JSON.stringify(bg.data))
      let label = id
      if (catalog === 'effect') {
        const preset = FXC.fxCatalogById(id)
        if (!preset) throw new Error(`unknown effect preset: ${id}`)
        label = preset.name
        const applied = await registry.call('effect_set', { patch: preset.patch })
        if (!applied.ok) throw new Error(JSON.stringify(applied.data))
      } else if (catalog === 'lut') {
        const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/luts/manifest.json'), 'utf8'))
        const preset = (manifest.luts || []).find(item => item.id === id)
        if (!preset) throw new Error(`unknown LUT preset: ${id}`)
        label = preset.name
        const cubeText = fs.readFileSync(path.join(ROOT, 'public', preset.file), 'utf8')
        const edited = await registry.call('edit_element', { clipId: bg.data.clipId, patch: { adjustment: { luts: [{ id, name: preset.name, cubeText, intensity: 1, enabled: true }] } } })
        if (!edited.ok) throw new Error(JSON.stringify(edited.data))
      } else if (catalog === 'text') {
        const presets = await loadAppTs('src/lib/textPresets.ts')
        const preset = presets.TEXT_PRESETS.find(item => item.id === id)
        if (!preset) throw new Error(`unknown text preset: ${id}`)
        label = preset.name
        const made = await registry.call('create_text', { text: text || preset.demo, preset: id, x: 0, y: 0 })
        if (!made.ok) throw new Error(JSON.stringify(made.data))
      } else throw new Error('catalog must be effect, lut, or text')
      const canvas = renderFrame(SESSION.seq, Math.max(0, Math.min(1.99, Number(time) || 0.7)))
      const buffer = canvas.toBuffer('image/png')
      if (out) {
        const destination = path.isAbsolute(out) ? out : path.join(ROOT, out)
        fs.mkdirSync(path.dirname(destination), { recursive: true })
        fs.writeFileSync(destination, buffer)
      }
      return { catalog, id, label, width: 320, height: 180, 'data:img': `data:image/png;base64,${buffer.toString('base64')}`, out: out || null }
    } finally { Object.assign(SESSION, saved) }
  }
}
class CreateText extends MCPTool {
  constructor() { super('create_text', 'Create a text clip with a preset from TEXT_PRESETS (log first via list_presets).', { text: '', preset: 'TEXT_PRESETS id', x: '', y: '', scale: '' }) }
  async run({ text, preset, x = 0, y = 0, scale = 1 }) {
    const m = await loadAppTs('src/lib/textPresets.ts')
    const def = m.TEXT_PRESETS.find(p => p.id === preset) || m.TEXT_PRESETS[0]
    const TRM = await loadAppTs('src/lib/textRuns.ts')
    const PFX = await loadAppTs('src/lib/particleFx.ts')
    const s = seq()
    const clip = makeClip({ id: `text-${s.clips.length + 1}`, name: `text:${text}`, asset: `text:${preset}`, natW: s.w * scale, natH: s.h * 0.2 * scale, duration: s.duration, draw: (sx, w, h, tt) => {
        // Board T: shared per-char runner (ranges + own keys + in-video beds +
        // real footage masked inside glyphs via insideVideo).
        const ts = clip.textStyle || {}
        const k = h / (s.h * 0.2 * scale)
        TRM.paintTextRuns(sx, w, h, {
          text, t: tt, pxScale: k,
          base: { fontSize: ts.fontSize ? ts.fontSize * k : undefined, fontFamily: ts.fontFamily, color: ts.color, bold: ts.bold, italic: ts.italic, letterSpacing: ts.letterSpacing, glowColor: ts.glowColor, glowBlur: ts.glowBlur, opacity: ts.opacity },
          ranges: ts.charRanges,
          insideBaseAlpha: ts.insideBaseAlpha,
          inside: ts.insideVideo && SESSION.videoFrames?.[ts.insideVideo] ? (c2, w2, h2, t2) => {
            const vf = SESSION.videoFrames[ts.insideVideo]
            const g = vf.get(Math.max(0, t2) * vf.fps)
            const kk = Math.max(w2 / g.width, h2 / g.height)
            c2.save()
            c2.filter = `${ts.insideInvert ? 'invert(1) ' : ''}brightness(${ts.insideBrightness ?? 1}) contrast(${ts.insideContrast ?? 1}) saturate(${ts.insideSaturation ?? 1})`
            c2.drawImage(g, 0, 0, g.width, g.height, (w2 - g.width * kk) / 2, (h2 - g.height * kk) / 2, g.width * kk, g.height * kk)
            c2.restore()
          } : ts.insideBed ? (c2, w2, h2, t2) => {
            PFX.drawReplaceBg(c2, w2, h2, t2, ts.insideBed)
            if (ts.insideParticle && ts.insideParticle !== 'none') PFX.drawParticleFx(c2, w2, h2, t2, ts.insideParticle, ts.insideDensity ?? 0.6, ts.insideTint || '#ffffff')
          } : undefined,
          makeCanvas: (mw, mh) => makeCanvas(mw, mh),
        })
      } })
    clip.transform.x = x; clip.transform.y = y; clip.textPreset = def.id
    if (def.id === 'plain') {
      clip.textStyle = { ...clip.textStyle, fontFamily: 'Inter, sans-serif', bold: false, fontSize: 48, color: '#ffffff' }
    } else if (def.id.startsWith('inv-')) {
      const [, bed, part] = def.id.split('-')
      const TINTS = { embers: '#ff9a4d', rain: '#9fd8ff', snow: '#e8f6ff', sparkles: '#22d3ee', bokeh: '#ffd166', dust: '#c9b8ff', petals: '#ffb3c8', clean: '#ffffff' }
      const tint = TINTS[part || 'clean'] || '#ffffff'
      clip.textStyle = { ...clip.textStyle, fontFamily: 'Inter, sans-serif', bold: true, fontSize: 64, color: '#ffffff', glowColor: tint, glowBlur: 12, insideBed: bed, insideParticle: part === 'clean' ? 'none' : (part || 'none'), insideTint: tint, insideDensity: 0.7 }
    }
    s.addClip(clip)
    SESSION.selection = clip
    const mc = makeCanvas(Math.max(2, Math.round(clip.natW)), Math.max(2, Math.round(clip.natH)))
    const mtx = mc.getContext('2d')
    const ts0 = clip.textStyle || {}
    const metrics = mtx ? TRM.paintTextRuns(mtx, mc.width, mc.height, { text, t: 0, base: { fontSize: ts0.fontSize, fontFamily: ts0.fontFamily, color: ts0.color, bold: ts0.bold, italic: ts0.italic, letterSpacing: ts0.letterSpacing }, ranges: ts0.charRanges, makeCanvas: (mw, mh) => makeCanvas(mw, mh) }).map(mm => ({ pos: mm.pos, ch: mm.ch, x: +mm.x.toFixed(1), y: +mm.y.toFixed(1), w: +mm.w.toFixed(1), h: +mm.h.toFixed(1) })) : []
    return SESSION.note('create_text', { text, preset, x, y }, { clipId: clip.id, presetApplied: def.id, charMetrics: metrics, project: { w: s.w, h: s.h } })
  }
}
class EditElement extends MCPTool {
  constructor() { super('edit_element', 'Edit an existing element: transform, deformation (corner pin/liquify), speedCurve (15 shared presets, null clears), visibility mask, multi-region effect mask, effects, blend/blend keyframes, or compound clip.', { clipId: '', patch: '{transform?,deformation?,speedCurve?,inPoint?,volume?,mask?,adjustmentMask?{enabled,inverted,regions[]},effects?,opacity?,blendMode?,blendKeys?,textStyle?,adjustment?{luts}}', convert: 'compound|null' }) }
  async run({ clipId, patch = {}, convert }) {
    const s = seq()
    const c = clipId ? s.clips.find(c => c.id === clipId) : sel()
    if (!c) throw new Error('clip not found')
    for (const key of ['inPoint', 'volume']) if (patch[key] !== undefined) {
      if (!Number.isFinite(patch[key]) || patch[key] < 0 || (key === 'volume' && patch[key] > 1)) throw new Error(`${key} is outside its valid range`)
    }
    if (patch.speedCurve !== undefined && patch.speedCurve !== null && !SPEED.SPEED_CURVE_IDS.includes(patch.speedCurve)) throw new Error('Unknown speed curve')
    if (patch.blendMode !== undefined && !BLEND_MODES.has(patch.blendMode)) throw new Error('Unsupported blend mode')
    let blendKeys
    if (patch.blendKeys !== undefined) {
      if (!Array.isArray(patch.blendKeys)) throw new Error('blendKeys must be an array')
      blendKeys = patch.blendKeys.reduce((keys, key) => putBlendKey(keys, key.time, key.mode), [])
    }
    const deformation = patch.deformation !== undefined ? DEFORMATION.validateDeformation(patch.deformation) : undefined
    if (patch.inPoint !== undefined) c.inPoint = patch.inPoint
    if (patch.volume !== undefined) c.volume = patch.volume
    if (patch.transform) Object.assign(c.transform, patch.transform)
    if (patch.deformation !== undefined) c.deformation = deformation
    if (patch.speedCurve === null) delete c.speedCurve
    else if (patch.speedCurve !== undefined) c.speedCurve = patch.speedCurve
    if (patch.mask !== undefined) c.mask = patch.mask
    if (patch.adjustmentMask !== undefined) c.adjustmentMask = patch.adjustmentMask
    if (patch.effects) c.effects = { ...c.effects, ...patch.effects }
    if (patch.opacity !== undefined) c.opacity = patch.opacity
    if (patch.blendMode) c.blendMode = patch.blendMode
    if (blendKeys) c.blendKeys = blendKeys
    if (patch.textStyle) c.textStyle = Object.assign({}, c.textStyle || {}, patch.textStyle)
    if (patch.adjustment) c.adjustment = { ...(c.adjustment || { luts: [] }), ...patch.adjustment }
    let compounded = null
    if (convert === 'compound') compounded = { id: `compound-${c.id}`, memberIds: [c.id], nestedTrackCount: 1 }
    return SESSION.note('edit_element', { clipId: c.id, patch, convert }, { clipId: c.id, compounded, textStyle: c.textStyle, adjustment: c.adjustment })
  }
}
class TextCropVideo extends MCPTool {
  constructor() { super('text_crop_video', 'Crop registered moving footage inside the selected text glyphs; optional negative processing and text-layer blend mode.', { clipId: 'text clip (default selected)', video: 'path previously registered with import_video', invert: 'bool', brightness: 'number', contrast: 'number', saturation: 'number', baseAlpha: '0..1', blendMode: 'source-over|screen|color-burn|...' }) }
  async run({ clipId, video, invert = true, brightness = 1, contrast = 1, saturation = 1, baseAlpha = 0.08, blendMode = 'screen' }) {
    const c = clipId ? seq().clips.find(item => item.id === clipId) : sel()
    if (!c?.textStyle) throw new Error('text_crop_video requires a text clip')
    if (!SESSION.videoFrames?.[video]) throw new Error('video must first be registered with import_video')
    if (!BLEND_MODES.has(blendMode)) throw new Error('Unsupported blend mode')
    for (const [name, value] of Object.entries({ brightness, contrast, saturation, baseAlpha })) if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative finite number`)
    c.textStyle = { ...c.textStyle, insideVideo: video, insideInvert: Boolean(invert), insideBrightness: brightness, insideContrast: contrast, insideSaturation: saturation, insideBaseAlpha: Math.min(1, baseAlpha) }
    c.blendMode = blendMode
    return SESSION.note('text_crop_video', { clipId: c.id, video, invert, brightness, contrast, saturation, baseAlpha, blendMode }, { clipId: c.id, textStyle: c.textStyle, blendMode: c.blendMode })
  }
}
class Select extends MCPTool {
  constructor() { super('select', 'Select a clip by id (selection for mask/keys/edit).', { clipId: '' }) }
  async run({ clipId }) { const c = seq().clips.find(c => c.id === clipId); if (!c) throw new Error('no clip ' + clipId); SESSION.selection = c; return SESSION.note('select', { clipId }, { selected: c.id }) }
}
class ContextMenu extends MCPTool {
  constructor() { super('context_menu', 'The clip context menu as functions: list, or run one action on selection.', { action: 'list|group|ungroup|new-null|compound|duplicate|delete|bring-front|send-back' }) }
  async run({ action = 'list' }) {
    const s = seq()
    if (action === 'list') return SESSION.note('context_menu', { action }, { actions: APP_FUNCTION_CATALOG.contextMenu })
    const c = sel()
    if (action === 'duplicate') return registry.call('duplicate_paste', { dx: 20, dy: 20 })
    if (action === 'delete') { s.clips = s.clips.filter(x => x.id !== c.id); SESSION.selection = null; return SESSION.note('context_menu', { action }, { deleted: c.id }) }
    if (action === 'bring-front') { s.clips = [...s.clips.filter(x => x.id !== c.id), c]; return SESSION.note('context_menu', { action }, { clipId: c.id }) }
    if (action === 'send-back') { s.clips = [c, ...s.clips.filter(x => x.id !== c.id)]; return SESSION.note('context_menu', { action }, { clipId: c.id }) }
    if (action === 'compound') return registry.call('edit_element', { clipId: c.id, convert: 'compound' })
    if (action === 'new-null') { const n = makeClip({ id: `null-${s.clips.length + 1}`, name: 'null', asset: 'null', natW: 0, natH: 0, duration: s.duration, draw: () => {} }); s.addClip(n); return SESSION.note('context_menu', { action }, { clipId: n.id }) }
    return SESSION.note('context_menu', { action }, { note: 'group/ungroup operate on multi-selection in the app UI' })
  }
}
setPaintGetter(() => ({ strokes: SESSION.paint.strokes, layers: SESSION.paint.paintLayers || [] }))
class DataDump extends MCPTool {
  constructor() { super('data_dump', 'Full JSON dump: every clip pos/size/colour/curves + preview frames and per-clip thumbs as data:img; withVideo embeds the exported mp4 as data:video (chunked).', { withImages: 'bool', times: '[s]', withVideo: 'mp4 path' }) }
  async run({ withImages = false, times = [0], withVideo }) {
    const base = inspectPayload()
    const out = { ...base }
    if (withImages && SESSION.seq) {
      out.previews = times.map(t => ({ t, 'data:img': `data:image/png;base64,${renderFrame(SESSION.seq, t).toBuffer('image/png').toString('base64')}` }))
      out.clipThumbs = SESSION.seq.clips.map(c => {
        const r = SESSION.seq.clipRect(c, 0)
        const w = Math.max(8, Math.min(160, Math.round(r.w))), h = Math.max(8, Math.min(160, Math.round(r.h)))
        const cc = makeCanvas(w, h), cx = cc.getContext('2d')
        c.draw(cx, w, h, c.inPoint || 0)
        if (c.mask?.enabled) { const m = c.mask; applyShapeMatteLocal(cx, m, r, SESSION.seq) }
        return { clipId: c.id, rect: r, 'data:img': `data:image/png;base64,${cc.toBuffer('image/png').toString('base64')}` }
      })
    }
    if (withVideo) {
      const v = path.isAbsolute(withVideo) ? withVideo : path.join(ROOT, withVideo)
      const b64 = fs.readFileSync(v).toString('base64')
      out['data:video'] = `data:video/mp4;base64,${b64}`
      out.videoBytes = fs.statSync(v).size
    }
    return SESSION.note('data_dump', { withImages, times, withVideo }, out)
  }
}
function applyShapeMatteLocal(x, m, r, seq) {
  const lm = { ...m, centerX: (m.centerX * seq.w - r.x) / r.w, centerY: (m.centerY * seq.h - r.y) / r.h, width: (m.width * seq.w) / r.w, height: (m.height * seq.h) / r.h, feather: (m.feather || 0) * (seq.w / r.w) }
  applyShapeMatte(x, lm, x.canvas.width, x.canvas.height)
}
class RemoveBackground extends MCPTool {
  constructor() { super('remove_background', 'Major tool (bg removal): luma/chroma key the selected clip\'s background away.', { method: 'luma|chroma', strength: '0..1' }) }
  async run({ method = 'luma', strength = 0.8 }) {
    const c = sel()
    c.effects = { ...c.effects, [method === 'luma' ? 'lumaKey' : 'chromaKey']: strength }
    return SESSION.note('remove_background', { method, strength }, { clipId: c.id, effects: c.effects })
  }
}
class RotoMask extends MCPTool {
  constructor() { super('roto_mask', 'Roto masking sub-tool v2 (Sammie-Roto-2 Smart shape): mode click = add/sub clicks segment with soft matting band; mode polygon = custom point polygon. exportMatte writes an AE-ready white-on-black luma matte png.', { mode: 'click|polygon', add: '[[x,y]..] seq px', sub: '[[x,y]..]', tol: '0..100', points: '[[x,y]..] polygon', feather: 'px', exportMatte: 'png path', setMask: 'bool default true' }) }
  async run({ mode, add = [], sub = [], tol = 26, points, feather = 4, curved = false, exportMatte, setMask = true }) {
    mode = mode || (points ? 'polygon' : 'click')
    const s = seq(), c = sel()
    if (mode === 'polygon') {
      const r0 = s.clipRect(c, 0)
      c.mask = { shape: 'rectangle', kind: 'custom', points: points.map(([x, y]) => ({ x: (x - r0.x) / r0.w, y: (y - r0.y) / r0.h })), curved, centerX: 0.5, centerY: 0.5, width: 1, height: 1, feather: feather / r0.w, inverted: false, enabled: true }
      return SESSION.note('roto_mask', { mode, n: points.length, feather }, { clipId: c.id, kind: 'custom' })
    }
    const RC = await loadAppTs('src/lib/rotoClick.ts')
    const { mw, mh, data } = mediaPixels(c)
    const toN = ([x, y]) => { const l = seqToLocal(s, c, { x0: x, y0: y, x1: x, y1: y }); return { x: l.x0 / mw, y: l.y0 / mh } }
    const r = RC.clickSegment(data, mw, mh, add.map(toN), sub.map(toN), tol, true)
    if (!r.bbox) throw new Error('roto click segment found nothing: adjust clicks/tol')
    SESSION.omniSelection = { clipId: c.id, method: 'roto-click', matte: r, mw, mh }
    if (exportMatte) {
      const dest = path.isAbsolute(exportMatte) ? exportMatte : path.join(ROOT, exportMatte)
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      const lc = makeCanvas(mw, mh)
      const ld = lc.getContext('2d').createImageData(mw, mh)
      ld.data.set(RC.lumaMatteBytes(r.alpha))
      lc.getContext('2d').putImageData(ld, 0, 0)
      fs.writeFileSync(dest, lc.toBuffer('image/png'))
    }
    if (setMask) {
      c.mask = { kind: 'matte', alpha: r.alpha, mw, mh, feather: feather / mw, enabled: true, shape: 'rectangle', centerX: 0.5, centerY: 0.5, width: 1, height: 1, inverted: false }
    }
    const bq = localToSeq(s, c, r.bbox)
    return SESSION.note('roto_mask', { mode, add: add.length, sub: sub.length, tol, exportMatte: exportMatte || null, setMask }, { clipId: c.id, engine: 'click-segment+matting', pixels: r.pixels, bbox: [Math.round(bq.x0), Math.round(bq.y0), Math.round(bq.x1), Math.round(bq.y1)] })
  }
}
export const registry = new MCPRegistry()
/* ---- omniframe selection maths: shared app module, identical in the booted app ---- */
const SM = await loadAppTs('src/lib/selectionMattes.ts')
function baseRect(s, c) {
  return { x: s.w / 2 - c.natW / 2 + (c.transform?.x || 0), y: s.h / 2 - c.natH / 2 + (c.transform?.y || 0), w: c.natW, h: c.natH }
}
function mediaPixels(c) {
  const mw = Math.max(2, Math.round(c.natW)), mh = Math.max(2, Math.round(c.natH))
  const mc = makeCanvas(mw, mh)
  c.draw(mc.getContext('2d'), mw, mh, c.inPoint || 0)
  return { mw, mh, data: mc.getContext('2d').getImageData(0, 0, mw, mh).data, canvas: mc }
}
function seqToLocal(s, c, r) {
  const b = baseRect(s, c)
  return { x0: ((r.x0 - b.x) / b.w) * c.natW, y0: ((r.y0 - b.y) / b.h) * c.natH, x1: ((r.x1 - b.x) / b.w) * c.natW, y1: ((r.y1 - b.y) / b.h) * c.natH }
}
function localToSeq(s, c, l) {
  const b = baseRect(s, c)
  return { x0: b.x + (l.x0 / c.natW) * b.w, y0: b.y + (l.y0 / c.natH) * b.h, x1: b.x + (l.x1 / c.natW) * b.w, y1: b.y + (l.y1 / c.natH) * b.h }
}
function parseCol(v, d) {
  if (Array.isArray(v)) return v
  if (typeof v === 'string' && v[0] === '#') return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)]
  return d
}
class ClipStretch extends MCPTool {
  constructor() { super('clip_stretch', 'Major tool: drag a clip edge on the timeline. Images stretch infinitely (app rule); the 1s still becomes any length before compounding.', { clipId: '', duration: 's' }) }
  async run({ clipId, duration }) {
    const s = seq(), c = clipId ? s.clips.find(k => k.id === clipId) : sel()
    const from = c.duration
    c.duration = Math.max(0.1, duration)
    return SESSION.note('clip_stretch', { clipId: c.id, from, to: c.duration }, { clipId: c.id, duration: c.duration })
  }
}
class ClipRemove extends MCPTool {
  constructor() { super('clip_remove', 'Major tool: delete a clip from the timeline (app clip context menu > remove).', { clipId: '' }) }
  async run({ clipId }) {
    const s = seq(); const i = s.clips.findIndex(k => k.id === clipId)
    if (i < 0) throw new Error(`no clip ${clipId}`)
    s.clips.splice(i, 1)
    if (SESSION.selection?.id === clipId) SESSION.selection = s.clips[0] || null
    return SESSION.note('clip_remove', { clipId }, { left: s.clips.length })
  }
}
class TransparentSelect extends MCPTool {
  constructor() { super('transparent_select', 'Omniframe transparent selection: draw a rect BIGGER than the element; the ignore colour (white bg) is skipped, only the target (black box) is selected.', { clipId: '', x0: '', y0: '', x1: '', y1: '', ignore: '#ffffff', ignoreTol: '', target: 'dark|light|[r,g,b]', targetTol: '' }) }
  async run({ clipId, x0, y0, x1, y1, ignore = '#ffffff', ignoreTol = 40, target = 'dark', targetTol = 90 }) {
    const s = seq(), c = clipId ? s.clips.find(k => k.id === clipId) : sel()
    const { mw, mh, data } = mediaPixels(c)
    const lr = x0 == null ? { x0: 0, y0: 0, x1: mw, y1: mh } : seqToLocal(s, c, { x0, y0, x1, y1 })
    const m = SM.transparentMatte(data, mw, mh, lr, { ignore: parseCol(ignore, [255, 255, 255]), ignoreTol, target: Array.isArray(target) ? target : target, targetTol })
    SESSION.omniSelection = { clipId: c.id, method: 'transparent', matte: m, mw, mh }
    const bq = m.bbox ? localToSeq(s, c, m.bbox) : null
    return SESSION.note('transparent_select', { clipId: c.id, rect: [x0, y0, x1, y1], ignore, target }, { method: 'transparent', pixels: m.pixels, bbox: bq && [Math.round(bq.x0), Math.round(bq.y0), Math.round(bq.x1), Math.round(bq.y1)] })
  }
}
class BrushSelect extends MCPTool {
  constructor() { super('brush_select', 'Omniframe brush selection: paint strokes (seq-space points + radius) into the selection matte.', { clipId: '', strokes: '[{points:[[x,y]..],radius}]' }) }
  async run({ clipId, strokes = [] }) {
    const s = seq(), c = clipId ? s.clips.find(k => k.id === clipId) : sel()
    const { mw, mh } = mediaPixels(c)
    const local = strokes.map(st => ({ radius: st.radius || 8, points: (st.points || []).map(([x, y]) => { const l = seqToLocal(s, c, { x0: x, y0: y, x1: x, y1: y }); return [l.x0, l.y0] }) }))
    const m = SM.brushMatte(mw, mh, local)
    SESSION.omniSelection = { clipId: c.id, method: 'brush', matte: m, mw, mh }
    const bq = m.bbox ? localToSeq(s, c, m.bbox) : null
    return SESSION.note('brush_select', { clipId: c.id, strokes: strokes.length }, { method: 'brush', pixels: m.pixels, bbox: bq && [Math.round(bq.x0), Math.round(bq.y0), Math.round(bq.x1), Math.round(bq.y1)] })
  }
}
class LassoSelect extends MCPTool {
  constructor() { super('lasso_select', 'AM-style lasso: freeform polygon selection (seq-space points) into the omniframe selection matte — 7th selection method alongside roto/sub-tool/video-view/transparent/brush/main-element.', { clipId: '', points: '[[x,y],...] seq px (>=3)' }) }
  async run({ clipId, points = [] }) {
    const s = seq(), c = clipId ? s.clips.find(k => k.id === clipId) : sel()
    const { mw, mh } = mediaPixels(c)
    const poly = (points || []).map(([x, y]) => { const l = seqToLocal(s, c, { x0: x, y0: y, x1: x, y1: y }); return [l.x0, l.y0] })
    const m = SM.lassoMatte(mw, mh, poly)
    SESSION.omniSelection = { clipId: c.id, method: 'lasso', matte: m, mw, mh }
    const bq = m.bbox ? localToSeq(s, c, m.bbox) : null
    return SESSION.note('lasso_select', { clipId: c.id, points: poly.length }, { method: 'lasso', pixels: m.pixels, bbox: bq && [Math.round(bq.x0), Math.round(bq.y0), Math.round(bq.x1), Math.round(bq.y1)] })
  }
}
class SelectMainElement extends MCPTool {
  constructor() { super('select_main_element', 'Masking-mode "mind main element": flood the background from the rect border; whatever survives is the main element of the frame.', { clipId: '', x0: '', y0: '', x1: '', y1: '', tol: '' }) }
  async run({ clipId, x0, y0, x1, y1, tol = 48 }) {
    const s = seq(), c = clipId ? s.clips.find(k => k.id === clipId) : sel()
    const { mw, mh, data } = mediaPixels(c)
    const mr = x0 == null ? { x0: 0, y0: 0, x1: mw, y1: mh } : seqToLocal(s, c, { x0, y0, x1, y1 })
    const m = SM.mainElementMatte(data, mw, mh, mr, tol)
    SESSION.omniSelection = { clipId: c.id, method: 'main-element', matte: m, mw, mh }
    const bq = m.bbox ? localToSeq(s, c, m.bbox) : null
    return SESSION.note('select_main_element', { clipId: c.id, tol }, { method: 'main-element', pixels: m.pixels, bbox: bq && [Math.round(bq.x0), Math.round(bq.y0), Math.round(bq.x1), Math.round(bq.y1)] })
  }
}
class OmniExtract extends MCPTool {
  constructor() { super('omniframe_extract', 'Omniframe button: from the active selection, create a NEW clip on the track above holding only the cut-out section (all frames); the source keeps the hole.', { trackId: '' }) }
  async run({ trackId }) {
    const s = seq(), o = SESSION.omniSelection
    if (!o) throw new Error('no omniframe selection; use transparent_select / brush_select / select_main_element / roto_mask first')
    const src = s.clips.find(k => k.id === o.clipId)
    const { mw, mh, canvas } = mediaPixels(src)
    const mcanvas = makeCanvas(mw, mh)
    const md = mcanvas.getContext('2d').createImageData(mw, mh)
    for (let i = 0, j = 0; i < o.matte.alpha.length; i++, j += 4) { md.data[j] = 255; md.data[j + 1] = 255; md.data[j + 2] = 255; md.data[j + 3] = o.matte.alpha[i] }
    mcanvas.getContext('2d').putImageData(md, 0, 0)
    const sx = canvas.getContext('2d')
    sx.globalCompositeOperation = 'destination-in'
    sx.drawImage(mcanvas, 0, 0)
    sx.globalCompositeOperation = 'source-over'
    const b = o.matte.bbox
    if (!b) throw new Error('selection matte is empty')
    const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1
    const crop = makeCanvas(bw, bh)
    crop.getContext('2d').drawImage(canvas, b.x0, b.y0, bw, bh, 0, 0, bw, bh)
    const rb = baseRect(s, src)
    const natW = (bw / mw) * rb.w, natH = (bh / mh) * rb.h
    const cxSeq = rb.x + ((b.x0 + bw / 2) / mw) * rb.w, cySeq = rb.y + ((b.y0 + bh / 2) / mh) * rb.h
    let track = trackId
    if (!track) { track = String(s.tracks.length); s.tracks.push({ id: s.tracks.length, name: 'omni cutout' }) }
    const clip = makeClip({ id: `clip-${s.clips.length + 1}`, name: 'omni cutout', asset: 'omni-cutout', natW, natH, start: src.start, duration: src.duration, draw: (x, w, h) => x.drawImage(crop, 0, 0, w, h) })
    clip.track = Number(track)
    clip.transform.x = cxSeq - s.w / 2
    clip.transform.y = cySeq - s.h / 2
    s.addClip(clip)
    src.omniHole = localToSeq(s, src, b)
    SESSION.selection = clip
    return SESSION.note('omniframe_extract', { src: src.id, track }, { clipId: clip.id, track, natW: Math.round(natW), natH: Math.round(natH), pixels: o.matte.pixels })
  }
}
class PatchUnder extends MCPTool {
  constructor() { super('patch_under', 'Omniframe toggle: patch UNDER the cut-out on the source clip for every frame (smart ring-average fill), hiding the hole.', { clipId: '', on: 'bool', feather: '' }) }
  async run({ clipId, on = true, feather = 2 }) {
    const s = seq()
    const c = clipId ? s.clips.find(k => k.id === clipId) : (s.clips.find(k => k.omniHole) || sel())
    if (!on) { delete c.mask; delete c.patch; return SESSION.note('patch_under', { clipId: c.id, on }, { clipId: c.id }) }
    const hole = c.omniHole || SESSION.omniSelection && localToSeq(s, c, SESSION.omniSelection.matte.bbox)
    if (!hole) throw new Error('no hole on this clip; run omniframe_extract first')
    const b = baseRect(s, c)
    c.mask = {
      enabled: true, shape: 'rectangle', kind: 'rect',
      centerX: ((hole.x0 + hole.x1) / 2 - b.x) / b.w, centerY: ((hole.y0 + hole.y1) / 2 - b.y) / b.h,
      width: (hole.x1 - hole.x0) / b.w, height: (hole.y1 - hole.y0) / b.h,
      feather: 0, inverted: true,
    }
    c.patch = { strategy: 'smart', x0: hole.x0, y0: hole.y0, x1: hole.x1, y1: hole.y1, feather }
    return SESSION.note('patch_under', { clipId: c.id, on, feather }, { clipId: c.id, hole: [Math.round(hole.x0), Math.round(hole.y0), Math.round(hole.x1), Math.round(hole.y1)] })
  }
}
class OmniMove extends MCPTool {
  constructor() { super('omniframe_move', 'Omniframe move: reposition the cut-out with CONSTANT interpolation from t (step, no slide) — the same offset applies to every frame of the span, exactly like dragging in omniframe mode.', { x: '', y: '', t: '' }) }
  async run({ x, y, t = 0 }) {
    const c = sel()
    let curve = c.animation.curves.position_x
    const rx = CE.addOrUpdateKeyframe(curve, t, x, 'constant'); c.animation.curves.position_x = rx.curve
    curve = c.animation.curves.position_y
    const ry = CE.addOrUpdateKeyframe(curve, t, y, 'constant'); c.animation.curves.position_y = ry.curve
    return SESSION.note('omniframe_move', { x, y, t }, { clipId: c.id, interpolation: 'constant', slide: false })
  }
}
/* ---------- CapCut-style effect instances (board J) ---------- */
const FXC = await loadAppTs('src/lib/effectCatalog.ts')
const FXI = await loadAppTs('src/lib/fxInstances.ts')

class FxCatalog extends MCPTool {
  constructor() { super('fx_catalog', 'Major tool: the Effects tab catalog — real engine presets (glitch/motion/color/blur/distort/retro/light/key). Every entry renders; all properties stay editable + keyframeable after the drop.', { cat: 'all|glitch|motion|color|blur|distort|retro|light|key', q: 'name search', limit: 'max entries returned (default 12)' }) }
  async run({ cat = 'all', q = '', limit = 12 }) {
    const all = FXC.getFxCatalog()
    let list = cat && cat !== 'all' ? all.filter(e => e.cat === cat) : all
    if (q) list = list.filter(e => e.name.toLowerCase().includes(String(q).toLowerCase()))
    const byCat = {}
    for (const e of all) byCat[e.cat] = (byCat[e.cat] || 0) + 1
    return SESSION.note('fx_catalog', { cat, q, limit }, {
      total: all.length, byCat,
      entries: list.slice(0, Number(limit) || 12).map(e => ({ id: e.id, name: e.name, cat: e.cat, params: Object.keys(e.patch), trace: e.trace })),
    })
  }
}
class FxAdd extends MCPTool {
  constructor() { super('fx_add', 'Major tool: drop a catalog effect ONTO a clip (image/video/compound) — CapCut model. Defaults to FULL clip length inside the closed container; or asLayer=true places a standalone effect clip that grades every track below it. keyParam/keyFrom/keyTo build a 2-point keyframe ramp (every numeric property is keyframeable).', { clipId: '(default selected)', catalogId: 'fx_catalog id', inP: 's from clip start', duration: 's (min 0.1)', params: '{key:value} overrides', keys: '{param:[[t,v],...]} keyframes', keyParam: 'ramp property', keyFrom: 'ramp start value', keyTo: 'ramp end value', asLayer: 'bool' }) }
  async run({ clipId, catalogId, inP, duration, params, keys, keyParam, keyFrom, keyTo, asLayer }) {
    const s = seq()
    const entry = FXC.fxCatalogById(catalogId)
    if (!entry) throw new Error(`unknown catalog id "${catalogId}": browse fx_catalog first`)
    if (asLayer) {
      const layer = makeClip({ id: `fxlayer-${s.clips.length + 1}`, name: `FX: ${entry.name}`, asset: 'fx-layer', natW: s.w, natH: s.h, start: inP || 0, duration: duration || s.duration, draw: () => {} })
      layer.kind = 'adjustment'
      layer.effects = { ...entry.patch, ...(params || {}) }
      if (keys) layer.fxInstances = undefined
      s.addClip(layer) // drawn last = above = grades everything below it
      SESSION.selection = layer
      return SESSION.note('fx_add', { catalogId, asLayer: true }, { clipId: layer.id, kind: 'adjustment', affects: 'all tracks below' })
    }
    const c = clipId ? s.clips.find(k => k.id === clipId) : sel()
    if (!c) throw new Error('no target clip')
    const range = FXI.clampFxToClip(Number(inP) || 0, Number(duration) || c.duration, c.duration)
    const fxId = `fx-${(c.fxInstances || []).length + 1}`
    const normKeys = {}
    for (const [kp, arr] of Object.entries(keys || {})) normKeys[kp] = (arr || []).map(k => Array.isArray(k) ? { t: Number(k[0]) || 0, v: Number(k[1]) || 0 } : k)
    const inst = { id: fxId, catalogId, name: entry.name, inP: range.inP, duration: range.duration, params: { ...entry.patch, ...(params || {}) }, keys: normKeys, enabled: true }
    if (keyParam) inst.keys[keyParam] = [{ t: 0, v: Number(keyFrom) || 0 }, { t: inst.duration, v: Number(keyTo) || 0 }]
    c.fxInstances = [...(c.fxInstances || []), inst]
    return SESSION.note('fx_add', { clipId: c.id, catalogId }, { fxId, inP: +range.inP.toFixed(3), duration: +range.duration.toFixed(3), params: inst.params })
  }
}
class FxUpdate extends MCPTool {
  constructor() { super('fx_update', 'Major tool: edit a dropped effect instance — params, per-property keyframes, enabled, and range (the closed container re-clamps inP/duration against the parent clip every call).', { clipId: '', fxId: '', params: '{key:value}', keys: '{param:[[t,v],...]}', inP: '', duration: '', enabled: 'bool' }) }
  async run({ clipId, fxId, params, keys, inP, duration, enabled }) {
    const s = seq(), c = clipId ? s.clips.find(k => k.id === clipId) : sel()
    const inst = (c?.fxInstances || []).find(f => f.id === fxId)
    if (!inst) throw new Error(`no fx instance "${fxId}" on clip ${c?.id}`)
    if (params) inst.params = { ...inst.params, ...params }
    if (keys) {
      inst.keys = inst.keys || {}
      for (const [k, pts] of Object.entries(keys)) inst.keys[k] = (pts || []).map(([t, v]) => ({ t: Number(t), v: Number(v) })).sort((a, b) => a.t - b.t)
    }
    if (enabled !== undefined) inst.enabled = !!enabled
    if (inP !== undefined || duration !== undefined) {
      const range = FXI.clampFxToClip(inP !== undefined ? Number(inP) : inst.inP, duration !== undefined ? Number(duration) : inst.duration, c.duration)
      inst.inP = range.inP; inst.duration = range.duration
    }
    return SESSION.note('fx_update', { clipId: c.id, fxId }, { inP: +inst.inP.toFixed(3), duration: +inst.duration.toFixed(3), params: inst.params, keys: Object.fromEntries(Object.entries(inst.keys || {}).map(([k, v]) => [k, v.length])) })
  }
}
class FxRemove extends MCPTool {
  constructor() { super('fx_remove', 'Major tool: delete a dropped effect instance (Del/Backspace in the app; Ctrl+Z brings it back there).', { clipId: '', fxId: '' }) }
  async run({ clipId, fxId }) {
    const s = seq(), c = clipId ? s.clips.find(k => k.id === clipId) : sel()
    const before = (c?.fxInstances || []).length
    if (c) c.fxInstances = (c.fxInstances || []).filter(f => f.id !== fxId)
    if (!c || (c.fxInstances || []).length === before) throw new Error(`no fx instance "${fxId}" on clip ${c?.id}`)
    return SESSION.note('fx_remove', { clipId: c.id, fxId }, { remaining: c.fxInstances.length })
  }
}


/* ---------- Replace-Video-With-Video + TEMPLATE MODE (MCP endpoints) ---------- */
const RVE = await loadAppTs('src/lib/replaceVideo.ts')
SESSION.templates = SESSION.templates || {}

/** shared: extract video frames (cache under .cache/video-frames) -> frame getter */
async function extractVideoFrames(rel, fps) {
  fps = Number(fps)
  if (!Number.isFinite(fps) || fps <= 0 || fps > 120) throw new Error('Import fps must be between 0 and 120')
  const abs = rel.startsWith('/') ? rel : pathModule.join(ROOT, rel)
  const stat=fs.statSync(abs)
  const hash = createHash('md5').update(`${abs}:${fps}:${stat.size}:${stat.mtimeMs}`).digest('hex').slice(0, 10)
  const dir = pathModule.join(ROOT, '.cache', 'video-frames', hash)
  if (!fs.existsSync(pathModule.join(dir, '0001.png'))) {
    fs.mkdirSync(dir, { recursive: true })
    execFileSync(ffmpegExe(), ['-y', '-i', abs, '-vf', `fps=${fps},scale=480:-2`, pathModule.join(dir, '%04d.png')], { stdio: 'pipe' })
  }
  const files = fs.readdirSync(dir).sort().filter(f => f.endsWith('.png'))
  if(!files.length)throw new Error('Video decoding produced no frames')
  return { get: videoFrameStore(dir, files), files, fps: Number(fps), abs }
}

class ReplaceVideo extends MCPTool {
  constructor() { super('replace_video', 'Major tool: REPLACE the footage of an existing clip with another video (CapCut Replace popup, headless parity). The view window is exactly the target clip\'s duration; windowStart slides the source in-point (0-5 vs 3-8). carryEffects=true keeps every processing stage of the original clip (fx, keys, grade, mask...) on the new footage; false clears effects/fxInstances/adjustment.', { clipId: 'target clip', path: 'replacement video (repo-relative or absolute)', windowStart: 'source in-point seconds (default 0)', carryEffects: 'true|false (default true)', fps: 'extract fps (default 12)' }) }
  async run({ clipId, path: rel, windowStart = 0, carryEffects = true, fps = 12 }) {
    const s = seq()
    const c = clipId ? s.clips.find(x => x.id === clipId) : sel()
    if (!c) throw new Error('clip not found')
    const v = await extractVideoFrames(rel, fps)
    const dur = v.files.length / v.fps
    const win = RVE.clampReplaceWindow(dur, c.duration, Number(windowStart))
    const patch = RVE.replaceVideoPatch({ duration: c.duration }, rel, dur, win.start, carryEffects === true || carryEffects === 'true')
    c.draw = (sx, w, h, t) => {
      const g = v.get(Math.max(0, t) * v.fps)
      sx.drawImage(g, 0, 0, g.width, g.height, 0, 0, w, h)
    }
    c.asset = patch.assetId
    c.sourceVideo = { path: v.abs, hasAudio: hasAudio(v.abs), fps: v.fps }
    c.inPoint = patch.inPoint
    c.duration = patch.duration
    c.name = pathModule.basename(rel)
    for (const k of patch.cleared) { c[k] = undefined }
    SESSION.videoFrames = SESSION.videoFrames || {}
    SESSION.videoFrames[rel] = { get: v.get, files: v.files, fps: v.fps }
    SESSION.selection = c
    return SESSION.note('replace_video', { clipId: c.id, path: rel, windowStart: +win.start.toFixed(3), carryEffects }, { clipId: c.id, sourceDuration: +dur.toFixed(2), window: { start: +win.start.toFixed(2), end: +win.end.toFixed(2), length: +win.clipDuration.toFixed(2) }, carried: patch.cleared.length === 0, cleared: patch.cleared })
  }
}

class TemplateCapture extends MCPTool {
  constructor() { super('template_capture', 'Major tool: TEMPLATE MODE — snapshot EVERY processing stage a clip passed through (transform+keys, effects, fx instances, LUT grade, masks, blend, opacity, speed, text style, in-point ratio) into a reusable JSON data-dump under data_motiondesijg/templates/. Apply with template_apply to re-cut a new video through the identical chain.', { clipId: 'source clip (default: selection)', name: 'template name' }) }
  async run({ clipId, name }) {
    const c = clipId ? seq().clips.find(x => x.id === clipId) : sel()
    if (!c) throw new Error('clip not found')
    const jsonClip = { ...c, draw: undefined, transform: c.transform, animation: c.animation }
    const t = RVE.captureClipTemplate(jsonClip, name || `Template ${c.name}`)
    SESSION.templates[t.id] = t
    const dir = pathModule.join(ROOT, 'data_motiondesijg', 'templates')
    fs.mkdirSync(dir, { recursive: true })
    const file = pathModule.join(dir, `${t.id}.json`)
    fs.writeFileSync(file, JSON.stringify(t, null, 2))
    return SESSION.note('template_capture', { clipId: c.id, name: t.name }, { templateId: t.id, file: pathModule.relative(ROOT, file), fields: Object.keys(t.fields), fieldCount: t.fieldCount, inPointRatio: +t.inPointRatio.toFixed(3) })
  }
}

class TemplateApply extends MCPTool {
  constructor() { super('template_apply', 'Major tool: re-play a captured processing chain (see template_capture) onto another clip — usually a freshly imported replacement video — so the new theme passes through EVERY stage the original did.', { templateId: 'id or name', clipId: 'target clip (default: selection)' }) }
  async run({ templateId, clipId }) {
    const s = seq()
    const t = Object.values(SESSION.templates).find(x => x.id === templateId || x.name === templateId)
    if (!t) throw new Error('template not found: ' + templateId)
    const c = clipId ? s.clips.find(x => x.id === clipId) : sel()
    if (!c) throw new Error('clip not found')
    const patch = RVE.templatePatch(t, c.duration)
    const applied = []
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'inPoint' || k === 'duration') { c[k] = v; applied.push(k); continue }
      if (v === undefined) continue
      if (k === 'transform' && c.transform) { Object.assign(c.transform, v); applied.push('transform'); continue }
      if (k === 'effects' && c.effects) { Object.assign(c.effects, v); applied.push('effects'); continue }
      if (k === 'textStyle') { c.textStyle = Object.assign({}, c.textStyle || {}, v); applied.push('textStyle'); continue }
      if (k === 'animation' && v) { c.animation = JSON.parse(JSON.stringify(v)); applied.push('animation'); continue }
      c[k] = v; applied.push(k)
    }
    SESSION.selection = c
    return SESSION.note('template_apply', { templateId: t.id, clipId: c.id }, { clipId: c.id, template: t.name, applied, inPoint: +c.inPoint.toFixed(2) })
  }
}

class ListTemplates extends MCPTool {
  constructor() { super('list_templates', 'List captured processing-chain templates (template_capture) with their fields and data-dump files.', {}) }
  async run() {
    const dir = pathModule.join(ROOT, 'data_motiondesijg', 'templates')
    return SESSION.note('list_templates', {}, { templates: Object.values(SESSION.templates).map(t => ({ id: t.id, name: t.name, source: t.sourceName, fields: Object.keys(t.fields), file: `data_motiondesijg/templates/${t.id}.json` })), dir })
  }
}

class ListFonts extends MCPTool {
  constructor() { super('list_fonts', 'List every font registered for create_text/text runs: the TYMM pack (each named by its FILE STEM, e.g. "blood-crow italic", "Quicksand_Bold") plus browser generics.', {}) }
  async run() {
    const core = await import('./core.mjs')
    return SESSION.note('list_fonts', {}, { count: (core.FONT_PACK_FILES || []).length, fonts: core.FONT_PACK_FILES || [], generics: ['sans-serif', 'serif', 'monospace'] })
  }
}


class AlightImport extends MCPTool {
  constructor() { super('alight_import', 'Major tool: open + read an ALIGHT MOTION v5 project XML (parser: src/lib/alightXml.ts, studied on 11 corpus projects). Rebuilds the composition: layers→clips (solid/text/media-placeholder), AM effects→site fx patches (AM_FX_CATALOG), keyframed transforms+effect props→app CurveEngine keys with the original cubicBezier easing carried as custom curve points, gain→volume. Full data dump (every AM effect incl. unmapped, nullobj rigs, bookmarks, media refs) lands in data_motiondesijg/alight/.', { path: 'repo-relative .xml', includeNulls: 'true = also materialise rig nulls as clips' }) }
  async run({ path: rel, includeNulls = false }) {
    const AX = await loadAppTs('src/lib/alightXml.ts')
    const abs = rel.startsWith('/') ? rel : pathModule.join(ROOT, rel)
    const proj = AX.parseAlightXml(fs.readFileSync(abs, 'utf8'))
    const imp = AX.alightToImport(proj)
    SESSION.reset()
    SESSION.seq = new Sequence({ w: imp.project.w, h: imp.project.h, fps: imp.project.fps, duration: imp.project.duration, bg: imp.project.bg })
    const s = seq()
    let n = 0, keyed = 0
    const setKeys = (clip, k) => {
      const add = (curveId, keys) => {
        let curve = clip.animation.curves[curveId]
        if (!curve || keys.length < 2) return
        for (const kf of keys) {
          const r = CE.addOrUpdateKeyframe(curve, +kf.time.toFixed(3), kf.value, kf.points ? 'custom' : 'linear')
          if (kf.points) r.keyframe.points = [[0, 0], ...kf.points, [1, 1]].map(([x, y]) => ({ x, y }))
          curve = r.curve; keyed++
        }
        clip.animation.curves[curveId] = curve
      }
      add('position_x', k.positionX); add('position_y', k.positionY)
      add('scale_x', k.scale); add('scale_y', k.scale)
      add('rotation_z', k.rotation); add('opacity', k.opacity)
    }
    for (const c of imp.clips) {
      if (c.kind === 'null' && !includeNulls) continue
      n++
      const w = imp.project.w, h = imp.project.h
      const sizeW = Math.max(24, c.kind === 'solid' ? w * 0.5 : w), sizeH = Math.max(24, c.kind === 'solid' ? h * 0.5 : h)
      let draw
      if (c.kind === 'text') {
        const txt = c.text || c.name
        draw = (sx, dw, dh) => {
          sx.fillStyle = c.fillColor || '#ffffff'
          sx.font = `700 ${Math.max(12, Math.round(dh * 0.5))}px sans-serif`
          sx.textAlign = 'center'; sx.textBaseline = 'middle'
          sx.fillText(txt, dw / 2, dh / 2, dw)
        }
      } else if (c.kind === 'solid') {
        draw = (sx, dw, dh) => { sx.fillStyle = c.fillColor || '#333344'; sx.fillRect(0, 0, dw, dh) }
      } else if (c.kind === 'null') {
        draw = () => {}
      } else {
        // media layer: AM points at content:// device media — placeholder card,
        // re-link by replacing with replace_video (template chain carries over).
        draw = (sx, dw, dh) => {
          sx.fillStyle = '#1b1b26'; sx.fillRect(0, 0, dw, dh)
          sx.strokeStyle = '#4a4a63'; sx.strokeRect(2, 2, dw - 4, dh - 4)
          sx.fillStyle = '#8888a8'; sx.font = '12px sans-serif'; sx.textAlign = 'center'
          sx.fillText('AM media (re-link)', dw / 2, dh / 2 - 8, dw - 12)
          sx.font = '9px sans-serif'; sx.fillText(c.name.slice(0, 60), dw / 2, dh / 2 + 8, dw - 12)
        }
      }
      const clip = makeClip({ id: `clip-${n}`, name: c.name, asset: c.mediaRef || `alight:${c.amId}`, natW: sizeW * (c.scale || 1), natH: sizeH * (c.scale || 1), start: c.start, duration: c.duration, draw })
      clip.inPoint = c.inPoint
      clip.transform.x = c.x; clip.transform.y = c.y
      clip.transform.rotation = c.rotation
      clip.transform.scale = c.scale || 1
      clip.transform.opacity = c.opacity
      clip.volume = c.volume
      if (Object.keys(c.effects).length) clip.effects = { ...c.effects }
      if (c.mappedFx.length) clip.fxInstances = c.mappedFx.map((fid, i) => ({ id: `amfx-${n}-${i}`, catalogId: fid, inP: 0, duration: c.duration }))
      clip.amEffects = c.amEffects // full AM data on the clip
      setKeys(clip, c.keys)
      s.addClip(clip)
    }
    const dumpDir = pathModule.join(ROOT, 'data_motiondesijg', 'alight')
    fs.mkdirSync(dumpDir, { recursive: true })
    const slug = proj.title.replace(/[^\w-]+/g, '-').slice(0, 48)
    const dumpFile = pathModule.join(dumpDir, `${slug}.json`)
    fs.writeFileSync(dumpFile, JSON.stringify({ source: pathModule.relative(ROOT, abs), imported: imp, raw: proj }, null, 1))
    SESSION.selection = s.clips[0] || null
    return SESSION.note('alight_import', { path: rel, includeNulls }, {
      project: imp.project, clips: s.clips.length, layersParsed: imp.clips.length,
      stats: imp.stats, bookmarks: imp.bookmarks.length,
      dump: pathModule.relative(ROOT, dumpFile),
      hint: 'media layers are placeholders — swap footage with replace_video (carryEffects keeps the AM chain)',
    })
  }
}


/* ---------- XML EXPORT (project + templates) + SHAKE PACK (MCP endpoints) ---------- */

class AlightExport extends MCPTool {
  constructor() { super('alight_export', 'Major tool: EXPORT the current composition as Alight Motion v5 dialect XML (inverse of alight_import). Round-trip lossless for OmniFrame: engine effect values travel in omniframe.fx blocks, the LUT stack in omniframe.lut, fx instances incl. per-param keys in omniframe.fxinst.<catalogId>, keyframed transforms as normalised <kf> with cubicBezier easing; clips imported FROM AM re-emit their original effect blocks verbatim. AM itself reads the scene/shape/text/transform skeleton.', { path: 'output .xml (default data_motiondesijg/alight/<title>-export.xml)', title: '' }) }
  async run({ path: rel, title }) {
    const AX = await loadAppTs('src/lib/alightXml.ts')
    const s = seq()
    const curveIds = ['position_x', 'position_y', 'scale_x', 'rotation_z', 'opacity']
    const clips = s.clips.filter(c => c.kind !== 'audio' && c.kind !== 'adjustment').map(c => {
      const curves = {}
      if (c.animation) for (const id of curveIds) {
        const cv = c.animation.curves[id]
        if (cv && cv.keyframes && cv.keyframes.length > 1) curves[id] = cv.keyframes.map(k => ({ time: k.time, value: k.value, points: k.points }))
      }
      const isText = !!c.textStyle
      const isVideo = !isText && /(\.mp4|\.mov|\.webm|^content:|^alight:)/i.test(String(c.asset || ''))
      return {
        name: c.name || c.id, kind: isText ? 'text' : isVideo ? 'video' : 'image',
        start: c.start || 0, duration: c.duration, inPoint: c.inPoint || 0,
        x: c.transform?.x || 0, y: c.transform?.y || 0, scale: c.transform?.scale ?? 1,
        rotation: c.transform?.rotation || 0, opacity: c.transform?.opacity ?? 1, volume: c.volume,
        text: isText ? String(c.name || '').replace(/^text:/, '') : undefined,
        fontFamily: c.textStyle?.fontFamily, fontSize: c.textStyle?.fontSize, color: c.textStyle?.color,
        mediaRef: c.asset, effects: c.effects,
        luts: c.adjustment?.luts?.map(l => ({ builtin: l.builtin, id: l.id, intensity: l.intensity ?? 1 })),
        fxInstances: c.fxInstances?.map(f => ({ catalogId: f.catalogId, inP: f.inP ?? 0, duration: f.duration ?? c.duration, params: f.params || {}, keys: f.keys })),
        curves, amEffects: c.amEffects,
      }
    })
    const xml = AX.exportAlightXml({ title: title || `OmniFrame ${s.clips.length}-clip composition`, w: s.w, h: s.h, fps: s.fps || 30, duration: s.duration }, clips)
    const out = rel ? (rel.startsWith('/') ? rel : pathModule.join(ROOT, rel)) : pathModule.join(ROOT, 'data_motiondesijg', 'alight', `${(title || 'composition').replace(/[^\w-]+/g, '-').slice(0, 48)}-export.xml`)
    fs.mkdirSync(pathModule.dirname(out), { recursive: true })
    fs.writeFileSync(out, xml)
    return SESSION.note('alight_export', { path: pathModule.relative(ROOT, out), title }, { file: pathModule.relative(ROOT, out), bytes: xml.length, clips: clips.length })
  }
}

class TemplateExport extends MCPTool {
  constructor() { super('template_export', 'Major tool: export a captured template (template_capture) as XML — the FULL processing chain rides inside a marked comment (lossless re-import via template_import / the browser Import Alight XML button) with an AM-readable skeleton summarising the chain. format json writes the raw dump only.', { templateId: 'id or name', path: 'output .xml (default data_motiondesijg/templates/<id>.xml)', format: 'xml|json (default xml)' }) }
  async run({ templateId, path: rel, format = 'xml' }) {
    const AX = await loadAppTs('src/lib/alightXml.ts')
    const t = Object.values(SESSION.templates).find(x => x.id === templateId || x.name === templateId)
    if (!t) throw new Error('template not found: ' + templateId)
    const dir = pathModule.join(ROOT, 'data_motiondesijg', 'templates')
    fs.mkdirSync(dir, { recursive: true })
    const out = rel ? (rel.startsWith('/') ? rel : pathModule.join(ROOT, rel)) : pathModule.join(dir, `${t.id}.${format === 'json' ? 'json' : 'xml'}`)
    const body = format === 'json' ? JSON.stringify(t, null, 2) : AX.exportTemplateXml(t)
    fs.writeFileSync(out, body)
    return SESSION.note('template_export', { templateId: t.id, format }, { file: pathModule.relative(ROOT, out), bytes: body.length, fields: Object.keys(t.fields) })
  }
}

class TemplateImport extends MCPTool {
  constructor() { super('template_import', 'Major tool: import a template XML (template_export) back into the session — registers the full processing chain so template_apply can replay it. Plain AM project XML is rejected here (use alight_import).', { path: '.xml file' }) }
  async run({ path: rel }) {
    const AX = await loadAppTs('src/lib/alightXml.ts')
    const abs = rel.startsWith('/') ? rel : pathModule.join(ROOT, rel)
    const t = AX.importTemplateXml(fs.readFileSync(abs, 'utf8'))
    if (!t) throw new Error('not an OmniFrame template XML (no omniframe-template marker): use alight_import for AM projects')
    SESSION.templates[t.id] = t
    const dir = pathModule.join(ROOT, 'data_motiondesijg', 'templates')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(pathModule.join(dir, `${t.id}.json`), JSON.stringify(t, null, 2))
    return SESSION.note('template_import', { path: rel }, { templateId: t.id, name: t.name, fields: Object.keys(t.fields), fieldCount: t.fieldCount })
  }
}

class ShakeApply extends MCPTool {
  constructor() { super('shake_apply', 'Major tool: apply a built-in SHAKE PACK preset (corpus Shakes.xml — MOLOB, ZNEPTUNE, FLOW, NANIMALO, RANDOM, JELLY, CU9ID, WARP; log via list_presets catalog=shake). Each preset = the original keyed fx-instance stack (shake/oscillate/turbulent/exposure/zoomblur/squeeze/stretch params with the ORIGINAL keyframe values and timings) + transform keys where the AM rig used them (CU9ID scale/rotation).', { clipId: '(default selected)', preset: 'shake preset id or name' }) }
  async run({ clipId, preset }) {
    const SP = await loadAppTs('src/lib/shakePresets.ts')
    const s = seq()
    const c = clipId ? s.clips.find(x => x.id === clipId) : sel()
    if (!c) throw new Error('clip not found')
    const p = SP.SHAKE_PRESETS.find(x => x.id === preset || x.name.toLowerCase() === String(preset).toLowerCase())
    if (!p) throw new Error(`unknown shake preset: ${preset} (ids: ${SP.SHAKE_PRESETS.map(x => x.id).join(', ')})`)
    const applied = []
    for (const inst of p.instances) {
      const keys = {}
      for (const [param, arr] of Object.entries(inst.keys || {})) keys[param] = arr.map(k => [Math.min(k.t, p.duration), k.v])
      const r = await registry.call('fx_add', { clipId: c.id, catalogId: inst.catalogId, inP: 0, duration: Math.min(p.duration, c.duration), params: inst.params, keys: Object.keys(keys).length ? keys : undefined })
      if (r.ok) applied.push(inst.catalogId)
    }
    await registry.call('select', { clipId: c.id })
    let tkeys = 0
    for (const [prop, arr] of Object.entries(p.transformKeys || {})) {
      for (const k of arr || []) {
        const property = prop === 'scale' ? 'scale' : 'rotation'
        const channel = prop === 'scale' ? 'X' : 'Z'
        const r = await registry.call('keyframe_set', { property, channel, time: Math.min(k.t, c.duration), value: k.v, interpolation: 'linear' })
        if (r.ok) tkeys++
        if (prop === 'scale') { const r2 = await registry.call('keyframe_set', { property: 'scale', channel: 'Y', time: Math.min(k.t, c.duration), value: k.v, interpolation: 'linear' }); if (r2.ok) tkeys++ }
      }
    }
    return SESSION.note('shake_apply', { clipId: c.id, preset: p.id }, { clipId: c.id, preset: p.name, fxInstances: applied, transformKeys: tkeys, duration: p.duration })
  }
}

for (const T of [ProjectNew, OmniframeMode, ImportMedia, ImportVideo, NewBackground, Click, MaskDraw, MaskClear, KeyframeSet, CurveSet, TransformSet, DuplicatePaste, BlendSet, EffectSet, FillCompositionArea, CompoundClipCreate, AlignClips, ClipMoveTime, MotionAnalyze, ShapeDetect, CompoundList, CompoundRename, CompoundExpand, CompoundEnter, CompoundExit, UncompoundClip, SmartPatch, Snapshot, RenderExport, Inspect, RunRecipe, Help, ListPresets, PresetPreview, CreateText, EditElement, TextCropVideo, Select, ContextMenu, DataDump, RemoveBackground, RotoMask, TrackNew, TrackAssign, TimelineScreenshot, ClipStretch, ClipRemove, TransparentSelect, BrushSelect, SelectMainElement, OmniExtract, PatchUnder, OmniMove, DrawStroke, PaintTimelapse, PaintClear, LassoSelect, FxCatalog, FxAdd, FxUpdate, FxRemove, ReplaceVideo, TemplateCapture, TemplateApply, ListTemplates, ListFonts, AlightImport, AlightExport, TemplateExport, TemplateImport, ShakeApply]) registry.register(new T())
