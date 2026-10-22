// OmniFrame MCP layer v2 — UNIVERSAL tools only (vow.md universal-tools law).
// No task-shaped tools: puzzles are solved by recipes (JSON lists of these
// calls). The agent's eyes = snapshot; its hands = these calls. Rendering uses
// the app's own semantics (CurveEngine transforms, ClipVisualMask mattes,
// ClipEffect maths) via appRender.mjs, so outputs are app-made, not agent-made.
import fs from 'fs'
import path from 'path'
import { MCPTool, MCPRegistry, ToolResult, VideoEncoder, FrameProvider, makeCanvas, loadImage, cover } from './core.mjs'
import { Sequence, makeClip, renderFrame, CE, applyEffects, cardFlipFactor, loadAppTs, applyShapeMatte } from './appRender.mjs'
import { bedPainterLocal } from './beds.mjs'

const ROOT = path.resolve(import.meta.dirname, '../..')
const TAR = path.join(ROOT, 'test_ans_result')

/* ---------- session (the booted headless app) ---------- */
export const SESSION = {
  seq: null, selection: null, trace: [], mode: 'omniframe', omniSelection: null,
  reset() { this.seq = null; this.selection = null; this.trace = []; },
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
  async run({ property, channel = 'Scalar', time, value, interpolation = 'linear', points }) {
    const c = sel()
    const key = `${property}_${channel.toLowerCase()}`
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
    const key = `${property}_${channel.toLowerCase()}`
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
  constructor() { super('blend_set', 'Major tool: composite blend + opacity of selected clip.', { mode: 'GlobalCompositeOperation', opacity: '0..1' }) }
  async run({ mode, opacity }) { const c = sel(); if (mode) c.blendMode = mode; if (opacity !== undefined) c.opacity = opacity; return SESSION.note('blend_set', { mode, opacity }, { clipId: c.id, blendMode: c.blendMode, opacity: c.opacity }) }
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
  constructor() { super('compound_clip_create', 'Major tool: nest selected clips into a compound clip descriptor.', { ids: '[]' }) }
  async run({ ids }) {
    const s = seq()
    const members = s.clips.filter(c => ids.includes(c.id))
    const comp = { id: `compound-${ids.length}`, kind: 'compound', memberIds: ids, nestedTrackCount: 1 }
    return SESSION.note('compound_clip_create', { ids }, comp)
  }
}
class SmartPatch extends MCPTool {
  constructor() { super('smart_patch', 'Major tool: smart-patch/inpainter — donor-sample clone with brush radius + feather (app SmartPatchSlice params).', { x0: '', y0: '', x1: '', y1: '', donor: '[x,y]', brushRadius: '', feather: '', strategy: 'clone|blur|gradient' }) }
  async run(p) {
    const c = sel()
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
  constructor() { super('render_export', 'Major tool: export the current composition to mp4 (the app produces the output).', { out: 'repo-relative mp4', fps: '', duration: '' }) }
  async run({ out, fps, duration }) {
    const s = seq()
    const f = fps || s.fps, dur = duration || s.duration
    const N = Math.round(f * dur)
    const dest = path.join(ROOT, out)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    const enc = new VideoEncoder({ w: s.w, h: s.h, fps: f, out: dest })
    for (let i = 0; i < N; i++) enc.addCanvas(renderFrame(s, i / f))
    const info = enc.finish()
    SESSION.note('render_export', { out }, { frames: info.frames })
    const r = new ToolResult('render_export', true, {
      video: path.relative(ROOT, dest), ...info, mode: SESSION.mode,
      recipe: SESSION.trace, inspect: inspectPayload(),
    })
    fs.writeFileSync(dest.replace(/\.mp4$/, '.json'), JSON.stringify({ ...r.toJSON(), chunks: r.chunkManifest(1500).manifest }, null, 1))
    return r.data
  }
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
    clips: s ? s.clips.map(c => ({ id: c.id, name: c.name, start: c.start, duration: c.duration, transform: c.transform, mask: c.mask || null, blendMode: c.blendMode, opacity: c.opacity, effects: c.effects, patch: c.patch || null, curves: Object.fromEntries(Object.entries(c.animation.curves).map(([k, v]) => [k, v.keyframes.map(kf => ({ id: kf.id, time: kf.time, value: kf.value, interpolation: kf.interpolation }))])) })) : [],
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
  create: ['text (TEXT_PRESETS)', 'null object', 'shape mask', 'background bed (replaceBg family)', 'compound clip', 'import media'],
  edit: ['transform (pos/size/rot)', 'mask draw/clear', 'roto points mask', 'effects inside', 'blend+opacity', 'speed curve', 'convert to compound'],
  select: ['click preview coords', 'select by id', 'expand to group'],
  contextMenu: ['group', 'ungroup', 'new-null', 'compound', 'duplicate', 'delete', 'bring-front', 'send-back'],
  effects: ['pixelate', 'waveWarp', 'chromaKey', 'lumaKey (bg removal)', 'fractalBlur', 'cardFlip', 'posterize', 'grain', 'chromatic', 'lightType/intensity/color/falloff', 'particleFx: feathers/embers/dust/bokeh/sparkles/snow/rain/petals', 'overlayFx: scanlines/halftone/spotlight/vignette/lightleak/frameglow', 'replaceBg: synthwave/aurora/grid/bokeh/sunset/studio'],
  keyframes: ['position_x/y/z', 'rotation_x/y/z', 'scale_x/y/z', 'opacity', 'pivot_x/y', 'interpolations: constant/linear/bezier/ease-in/ease-out/ease-in-out/cubic-in/cubic-out/back/bounce/elastic'],
  presetsCatalogs: ['TEXT_PRESETS', 'PILLAR_PRESETS', 'TRANSITION_PRESETS', 'RATIO_PRESETS', 'speedCurves (15)'],
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
  constructor() { super('list_presets', 'Log of existing presets BEFORE choosing; optional data:img swatches for vision models.', { catalog: 'text|pillar|transition|ratios|speed', limit: 'n', dataImg: 'bool' }) }
  async run({ catalog = 'text', limit = 8, dataImg = false }) {
    let entries = []
    const scan = (rel) => {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
      const out = []
      const re = /\{\s*id:\s*'([^']+)',\s*name:\s*["']([^"']+)["']/g
      let m
      while ((m = re.exec(src))) out.push({ id: m[1], name: m[2] })
      return out
    }
    if (catalog === 'text') entries = scan('src/lib/textPresets.ts')
    else if (catalog === 'pillar') entries = scan('src/lib/pillarPresets.ts')
    else if (catalog === 'transition') entries = scan('src/lib/transitionPresets.ts')
    else if (catalog === 'ratios') entries = scan('src/lib/aspectRatios.ts')
    else entries = (await import('./curves.mjs')).SPEED_CURVES.map(c => ({ id: c.id, name: c.name }))
    entries = entries.slice(0, limit)
    if (dataImg) for (const e of entries) e['data:img'] = swatch(catalog, e.id)
    return SESSION.note('list_presets', { catalog, limit, dataImg }, { catalog, count: entries.length, entries })
  }
}
function swatch(catalog, id) {
  const c = makeCanvas(96, 54), x = c.getContext('2d')
  if (catalog === 'text') { x.fillStyle = '#14161c'; x.fillRect(0, 0, 96, 54); x.fillStyle = '#fff'; x.font = 'bold 14px sans-serif'; x.fillText(id.slice(0, 10), 6, 32) }
  else { bedPainterLocal(id === 'synthwave' || id === 'aurora' || id === 'grid' || id === 'bokeh' || id === 'sunset' || id === 'studio' || id === 'wedge' ? id : 'studio')(x, 96, 54, 0.5); x.fillStyle = 'rgba(255,255,255,0.85)'; x.font = '9px monospace'; x.fillText(id.slice(0, 12), 4, 50) }
  return `data:image/png;base64,${c.toBuffer('image/png').toString('base64')}`
}
class CreateText extends MCPTool {
  constructor() { super('create_text', 'Create a text clip with a preset from TEXT_PRESETS (log first via list_presets).', { text: '', preset: 'TEXT_PRESETS id', x: '', y: '', scale: '' }) }
  async run({ text, preset, x = 0, y = 0, scale = 1 }) {
    const m = await loadAppTs('src/lib/textPresets.ts')
    const def = m.TEXT_PRESETS.find(p => p.id === preset) || m.TEXT_PRESETS[0]
    const s = seq()
    const clip = makeClip({ id: `text-${s.clips.length + 1}`, name: `text:${text}`, asset: `text:${preset}`, natW: s.w * 0.6 * scale, natH: s.h * 0.2 * scale, duration: s.duration, draw: (sx, w, h) => { sx.fillStyle = (def.style && def.style.color) || '#ffffff'; sx.font = `bold ${Math.round(h * 0.5)}px ${(def.style && def.style.fontFamily) || 'sans-serif'}`; sx.textAlign = 'center'; sx.fillText(text, w / 2, h * 0.65); sx.textAlign = 'left' } })
    clip.transform.x = x; clip.transform.y = y; clip.textPreset = def.id
    s.addClip(clip)
    SESSION.selection = clip
    return SESSION.note('create_text', { text, preset, x, y }, { clipId: clip.id, presetApplied: def.id })
  }
}
class EditElement extends MCPTool {
  constructor() { super('edit_element', 'Edit an existing element: pos/size/rot, mask, effects inside, blend, or convert to compound clip.', { clipId: '', patch: '{transform?,mask?,effects?,opacity?,blendMode?}', convert: 'compound|null' }) }
  async run({ clipId, patch = {}, convert }) {
    const s = seq()
    const c = clipId ? s.clips.find(c => c.id === clipId) : sel()
    if (!c) throw new Error('clip not found')
    if (patch.transform) Object.assign(c.transform, patch.transform)
    if (patch.mask !== undefined) c.mask = patch.mask
    if (patch.effects) c.effects = { ...c.effects, ...patch.effects }
    if (patch.opacity !== undefined) c.opacity = patch.opacity
    if (patch.blendMode) c.blendMode = patch.blendMode
    let compounded = null
    if (convert === 'compound') compounded = { id: `compound-${c.id}`, memberIds: [c.id], nestedTrackCount: 1 }
    return SESSION.note('edit_element', { clipId: c.id, patch, convert }, { clipId: c.id, compounded })
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
        c.draw(cx, w, h, 0)
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
  constructor() { super('roto_mask', 'Roto masking sub-tool: custom point polygon mask over the clicked subject.', { points: '[[x,y]…] preview px', feather: 'px', curved: 'bool' }) }
  async run({ points, feather = 4, curved = false }) {
    const s = seq(), c = sel()
    const r0 = s.clipRect(c, 0)
    const bw = r0.w, bh = r0.h, bx = r0.x, by = r0.y
    c.mask = { shape: 'rectangle', kind: 'custom', points: points.map(([x, y]) => ({ x: (x - bx) / bw, y: (y - by) / bh })), curved, centerX: 0.5, centerY: 0.5, width: 1, height: 1, feather: feather / bw, inverted: false, enabled: true }
    return SESSION.note('roto_mask', { n: points.length, feather }, { clipId: c.id, kind: 'custom' })
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
  c.draw(mc.getContext('2d'), mw, mh, 0)
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
    const lr = seqToLocal(s, c, { x0, y0, x1, y1 })
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
class SelectMainElement extends MCPTool {
  constructor() { super('select_main_element', 'Masking-mode "mind main element": flood the background from the rect border; whatever survives is the main element of the frame.', { clipId: '', x0: '', y0: '', x1: '', y1: '', tol: '' }) }
  async run({ clipId, x0, y0, x1, y1, tol = 48 }) {
    const s = seq(), c = clipId ? s.clips.find(k => k.id === clipId) : sel()
    const { mw, mh, data } = mediaPixels(c)
    const m = SM.mainElementMatte(data, mw, mh, seqToLocal(s, c, { x0, y0, x1, y1 }), tol)
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
for (const T of [ProjectNew, OmniframeMode, ImportMedia, NewBackground, Click, MaskDraw, MaskClear, KeyframeSet, CurveSet, TransformSet, DuplicatePaste, BlendSet, EffectSet, FillCompositionArea, CompoundClipCreate, SmartPatch, Snapshot, RenderExport, Inspect, RunRecipe, Help, ListPresets, CreateText, EditElement, Select, ContextMenu, DataDump, RemoveBackground, RotoMask, TrackNew, TrackAssign, TimelineScreenshot, ClipStretch, ClipRemove, TransparentSelect, BrushSelect, SelectMainElement, OmniExtract, PatchUnder, OmniMove]) registry.register(new T())
