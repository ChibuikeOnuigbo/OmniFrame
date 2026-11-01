import { validateDeformation } from './deformation'
import { SPEED_CURVE_IDS } from './speedCurves'
/**
 * In-app MCP bridge: the SAME universal tool names as tools/mcp operate the
 * REAL store from inside the booted app (window.omniMCP.call(...)). Every call
 * is logged; the RightPanel "MCP Console" shows the log so a human (or the
 * agent's snapshot) can verify the app — not the agent — did the work.
 */
import { useEditor } from '../store'
import { addOrUpdateKeyframe, applyEasingPreset, createDefaultClipAnimation } from './animation/CurveEngine'
import { drawTimelineSnapshot, timelineSnapshotSize, type TimelineSnapPayload } from './timelineSnapshot'
import { fxCatalogById } from './effectCatalog'
import { buildTextPreset, TEXT_PRESETS } from './textPresets'
import { findTransitionPair, TRANSITION_PRESETS } from './transitionPresets'
import { previewClipEffect, previewEffectLayer, previewLut } from './visualPreviewActions'
import { BLEND_MODES } from './blendModes'

export interface McpLogEntry { tool: string; params: Record<string, unknown>; ok: boolean; out?: unknown; error?: string; at: number }
export const mcpLog: McpLogEntry[] = []

function push(e: McpLogEntry) {
  mcpLog.push(e)
  if (mcpLog.length > 300) mcpLog.shift()
  useEditor.setState({ mcpLogVersion: ((useEditor.getState() as unknown as { mcpLogVersion?: number }).mcpLogVersion ?? 0) + 1 } as Partial<never>)
}

export const OMNI_MCP_CATALOG = [
  'help', 'select', 'click', 'mask_draw', 'mask_clear', 'keyframe_set', 'curve_set',
  'transform_set', 'edit_element', 'effect_set', 'remove_background', 'fill_composition_area', 'snapshot', 'dump',
  'preset_preview', 'text_crop_video',
  'timeline_screenshot', 'track_assign', 'log', 'clip_stretch', 'transparent_select',
  'select_main_element', 'omniframe_extract', 'patch_under', 'omniframe_move',
]

export async function omniMcpCall(tool: string, params: Record<string, any> = {}): Promise<{ ok: boolean; out?: unknown; error?: string }> {
  const st = () => useEditor.getState() as any
  const clips = () => (st().clips || []) as any[]
  const selClip = () => clips().find(c => c.id === st().selectedClipId) || clips().find(c => (st().selectedClipIds || []).includes(c.id))
  const requireClip = () => { const c = selClip(); if (!c) throw new Error('nothing selected: select a valid clip first'); return c }
  const edit = (c: any, patch: any) => {
    st().beginHistory()
    try { st().setClipProp(c.id, patch) } finally { st().endHistory() }
  }
  const finite = (name: string, value: unknown): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`)
    return value
  }
  try {
    let out: any = null
    const seq = st().sequenceSettings || { width: 1920, height: 1080 }
    switch (tool) {
      case 'help':
        out = { catalog: OMNI_MCP_CATALOG, editElementFields:['transform','deformation','speedCurve','inPoint','volume'], note: 'universal tools operate the real store; every call is logged in the MCP Console' }
        break
      case 'select':
        if (params.clipId != null && !clips().some(c => c.id === params.clipId)) throw new Error('clip not found')
        st().selectClip(params.clipId ?? null); out = { selected: params.clipId ?? null }
        break
      case 'click': {
        const t = params.t ?? st().playhead ?? 0
        const active = clips().filter(c => t >= c.start && t < c.start + c.duration)
        const hit = active[active.length - 1]
        if (hit) st().selectClip(hit.id)
        out = { clipId: hit ? hit.id : null }
        break
      }
      case 'mask_draw': {
        const c = selClip(); if (!c) throw new Error('nothing selected: select or click first')
        const x0=finite('x0',params.x0),x1=finite('x1',params.x1),y0=finite('y0',params.y0),y1=finite('y1',params.y1)
        if (!['rectangle','ellipse'].includes(params.shape || 'rectangle')) throw new Error('mask shape must be rectangle or ellipse')
        st().updateClipMask(c.id, {
          shape: params.shape || 'rectangle', kind: 'shape',
          centerX: (x0+x1)/2/seq.width, centerY: (y0+y1)/2/seq.height,
          width: Math.abs(x1-x0)/seq.width, height: Math.abs(y1-y0)/seq.height,
          feather: Math.max(0,finite('feather',params.feather ?? 0)), inverted: !!params.inverted, enabled: true,
        })
        out = { clipId: c.id, mask: clips().find(v=>v.id===c.id).mask }
        break
      }
      case 'mask_clear': {
        const c = requireClip(); st().removeClipMask(c.id)
        out = { clipId: c ? c.id : null }
        break
      }
      case 'keyframe_set': {
        const c = selClip(); if (!c) throw new Error('nothing selected')
        const animation = structuredClone(c.animation || createDefaultClipAnimation(c.transform,c.duration))
        const key = `${params.property}_${String(params.channel || 'Scalar').toLowerCase()}`
        if (!animation.curves[key]) throw new Error(`no curve ${key}`)
        const r = addOrUpdateKeyframe(animation.curves[key], finite('time',params.time), finite('value',params.value), params.interpolation || 'linear')
        animation.curves[key] = r.curve
        edit(c,{animation}); out = { clipId: c.id, curve: key, keyframeId: r.keyframe.id }
        break
      }
      case 'curve_set': {
        const c = selClip(); if (!c) throw new Error('nothing selected')
        const key = `${params.property}_${String(params.channel || 'Scalar').toLowerCase()}`
        const animation=structuredClone(c.animation || createDefaultClipAnimation(c.transform,c.duration))
        let curve = animation.curves[key]
        if (!curve) throw new Error(`no curve ${key}`)
        for (const k of curve.keyframes) curve = applyEasingPreset(curve, k.id, params.interpolation)
        animation.curves[key]=curve
        edit(c,{animation}); out = { curve: key }
        break
      }
      case 'transform_set': {
        const c=requireClip(),allowed=['x','y','z','scale','scaleX','scaleY','scaleZ','rotation','rotationX','rotationY','opacity','pivotX','pivotY']
        for(const key of Object.keys(params)){if(!allowed.includes(key))throw new Error('Unsupported transform field '+key);finite(key,params[key])}
        edit(c,{transform:{...c.transform,...params}});out={clipId:c.id,transform:clips().find(v=>v.id===c.id).transform};break
      }
      case 'edit_element': {
        const c=params.clipId?clips().find(c=>c.id===params.clipId):requireClip();if(!c)throw new Error('clip not found')
        const patch=params.patch||{};for(const key of Object.keys(patch))if(!['transform','deformation','speedCurve','inPoint','volume'].includes(key))throw new Error('Unsupported live edit_element field '+key)
        const next:any={}
        if(patch.transform){for(const [key,value]of Object.entries(patch.transform)){if(!['x','y','z','scale','scaleX','scaleY','scaleZ','rotation','rotationX','rotationY','opacity','pivotX','pivotY'].includes(key))throw new Error('Unknown transform field');finite(key,value)}next.transform={...c.transform,...patch.transform}}
        if('deformation'in patch)next.deformation=validateDeformation(patch.deformation)
        if('speedCurve'in patch){if(patch.speedCurve!==null&&!SPEED_CURVE_IDS.includes(patch.speedCurve))throw new Error('Unknown speed curve');next.speedCurve=patch.speedCurve??undefined}
        for(const key of ['inPoint','volume'])if(key in patch){const value=finite(key,patch[key]);if(value<0||(key==='volume'&&value>1))throw new Error(key+' is outside its valid range');next[key]=value}
        edit(c,next);out={clipId:c.id,...next};break
      }
      case 'effect_set':
        st().setClipEffect(requireClip().id, params.patch || {}); out = { clipId: requireClip().id }
        break
      case 'remove_background':
        st().setClipEffect(requireClip().id, { [params.method === 'chroma' ? 'chromaKey' : 'lumaKey']: params.strength ?? 0.85 })
        out = { clipId: selClip() ? selClip().id : null }
        break
      case 'fill_composition_area': {
        const c = selClip(); if (!c) throw new Error('nothing selected')
        const asset = (st().assets || []).find((a: any) => a.id === c.assetId)
        const aw = (asset && asset.width) || seq.width, ah = (asset && asset.height) || seq.height
        const k = Math.max(seq.width / aw, seq.height / ah)
        edit(c,{ transform: { ...c.transform, scale: k } }); out = { scale: k }
        break
      }
      case 'snapshot': {
        const el = document.querySelector('[data-testid="preview-stage"] canvas') as HTMLCanvasElement | null
        if (!el) throw new Error('preview canvas not mounted')
        out = { 'data:img': el.toDataURL('image/png') }
        break
      }
      case 'preset_preview': {
        const catalog = String(params.catalog || '')
        const id = String(params.id || '')
        const original = useEditor.getState()
        let label = id
        let previewAt = original.playhead
        try {
          if (catalog === 'effect') {
            const preset = fxCatalogById(id)
            if (!preset) throw new Error(`unknown effect preset: ${id}`)
            label = preset.name
            const selected = selClip()
            const started = selected
              ? previewClipEffect(selected.id, preset.name, preset.patch)
              : previewEffectLayer(preset.name, preset.patch)
            if (!started) throw new Error('effect preview needs a visible clip at the playhead')
            previewAt = useEditor.getState().visualPreview?.startTime ?? original.playhead
          } else if (catalog === 'lut') {
            await original.loadLutLibrary()
            const lut = useEditor.getState().lutLibrary.luts.find((item) => item.id === id)
            if (!lut) throw new Error(`unknown LUT preset: ${id}`)
            label = lut.name
            if (!previewLut({ name: lut.name, builtin: lut.id })) throw new Error('LUT preview needs a visible clip at the playhead')
            previewAt = useEditor.getState().visualPreview?.startTime ?? original.playhead
          } else if (catalog === 'transition') {
            const preset = TRANSITION_PRESETS.find((item) => item.id === id)
            if (!preset) throw new Error(`unknown transition preset: ${id}`)
            const pair = findTransitionPair(preset.baseDuration)
            if (!pair) throw new Error('transition preview needs two adjacent clips on one video track')
            label = preset.name
            const startTime = Math.max(pair.fromClip.start, pair.cut - preset.baseDuration / 2)
            original.startVisualPreview({
              kind: 'transition',
              transition: {
                id: 'mcp-preset-preview', type: preset.id, fromClipId: pair.fromClip.id,
                toClipId: pair.toClip.id, trackId: pair.fromClip.trackId,
                startTime, duration: preset.baseDuration, alignment: 'centered', enabled: true,
              },
              label: preset.name,
              startTime,
              endTime: startTime + preset.baseDuration,
            })
            previewAt = startTime + preset.baseDuration / 2
          } else if (catalog === 'text') {
            const preset = TEXT_PRESETS.find((item) => item.id === id)
            if (!preset) throw new Error(`unknown text preset: ${id}`)
            label = preset.name
            const ids = buildTextPreset(id, String(params.text || preset.demo), { duration: 3, seed: 7 })
            if (!ids.length) throw new Error('text preset did not create a preview')
            previewAt = original.playhead + 1.5
          } else {
            throw new Error('catalog must be effect, transition, lut, or text')
          }
          useEditor.setState({ playhead: previewAt, playing: false })
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
          const canvas = document.querySelector('[data-testid="preview-stage"] canvas') as HTMLCanvasElement | null
          if (!canvas) throw new Error('preview canvas not mounted')
          out = { catalog, id, label, previewAt, 'data:img': canvas.toDataURL('image/png') }
        } finally {
          useEditor.setState(original, true)
        }
        break
      }
      case 'text_crop_video': {
        const c = params.clipId ? clips().find((item) => item.id === params.clipId) : requireClip()
        if (!c?.textStyle) throw new Error('text_crop_video requires a text clip')
        const asset = st().assets.find((item: any) => item.id === params.assetId && item.kind === 'video')
        if (!asset) throw new Error('assetId must identify an imported video')
        const mode = String(params.blendMode || 'screen')
        if (!BLEND_MODES.has(mode)) throw new Error('Unsupported blend mode')
        const value = (name: string, fallback: number) => params[name] === undefined ? fallback : finite(name, params[name])
        const baseAlpha = value('baseAlpha', 0.08)
        if (baseAlpha < 0 || baseAlpha > 1) throw new Error('baseAlpha must be between 0 and 1')
        edit(c, {
          textStyle: {
            ...c.textStyle,
            insideVideo: asset.id,
            insideInvert: params.invert !== false,
            insideBrightness: value('brightness', 1),
            insideContrast: value('contrast', 1),
            insideSaturation: value('saturation', 1),
            insideBaseAlpha: baseAlpha,
          },
          blendMode: mode,
        })
        out = { clipId: c.id, assetId: asset.id, blendMode: mode, cropped: true }
        break
      }
      case 'track_assign': {
        const c = selClip(); if (!c) throw new Error('nothing selected')
        const tracks = (st().tracks || []) as any[]
        if (!tracks.some(t => t.id === params.track)) throw new Error('track not found: use an existing track ID')
        edit(c,{trackId:params.track})
        out = { clipId: c.id, track: params.track }
        break
      }
      case 'log':
        out = { entries: mcpLog.slice(-(params.limit || 50)) }
        break
      case 'clip_stretch': {
        const c = selClip(); if (!c) throw new Error('nothing selected')
        const duration=Math.max(0.1,finite('duration',params.duration ?? c.duration))
        edit(c,{duration}); out = { clipId: c.id, duration }
        break
      }
      case 'transparent_select':
        out = await st().omniTransparentSelect(params)
        break
      case 'select_main_element':
        out = await st().omniSelectMainElement(params.rect, params.tol)
        break
      case 'omniframe_extract':
        out = st().omniExtractCutout()
        break
      case 'patch_under':
        st().omniSetPatchUnder(params.on !== false); out = { on: params.on !== false }
        break
      case 'omniframe_move': {
        const c = selClip(); if (!c) throw new Error('nothing selected')
        const t = finite('t',params.t ?? 0)
        const animation=structuredClone(c.animation || createDefaultClipAnimation(c.transform,c.duration))
        animation.curves.position_x = addOrUpdateKeyframe(animation.curves.position_x, t, finite('x',params.x ?? 0), 'constant').curve
        animation.curves.position_y = addOrUpdateKeyframe(animation.curves.position_y, t, finite('y',params.y ?? 0), 'constant').curve
        edit(c,{animation}); out = { clipId: c.id, interpolation: 'constant', slide: false }
        break
      }
      case 'timeline_screenshot': {
        const tracks = (st().tracks || []) as any[]
        const payload: TimelineSnapPayload = {
          sequence: { width: seq.width, height: seq.height, fps: st().projectFps || 30, duration: params.duration ?? 4 },
          tracks: tracks.map((t: any, i: number) => ({ id: t.id ?? i, name: t.name || `track ${i + 1}` })),
          clips: clips().map(c => ({
            id: c.id, name: c.name, start: c.start, duration: c.duration,
            track: tracks.findIndex((t: any) => t.id === c.trackId),
            masked: Boolean(c.mask && c.mask.enabled), roto: c.mask?.kind === 'custom',
            keyed: Object.entries((c.animation && (c.animation as any).curves) || {}).filter(([, v]: any) => v.keyframes && v.keyframes.length > 0).map(([k]) => k),
            selected: (st().selectedClipIds || []).includes(c.id), kind: c.kind,
          })),
          playhead: params.playhead ?? st().playhead ?? 0,
          log: mcpLog.map(e => ({ tool: e.tool, ok: e.ok })),
          title: 'OmniFrame timeline (live app)',
        }
        const { w, h } = timelineSnapshotSize(payload)
        const cv = document.createElement('canvas')
        cv.width = w; cv.height = h
        drawTimelineSnapshot(cv.getContext('2d')!, payload, w, h)
        out = { 'data:img': cv.toDataURL('image/png') }
        break
      }
      case 'dump':
        out = {
          sequence: seq, fps: st().projectFps, selection: st().selectedClipIds,
          clips: clips().map(c => ({ id: c.id, name: c.name, start: c.start, duration: c.duration, transform: c.transform, mask: c.mask || null, effects: c.effects || null, speedCurve: c.speedCurve || null })),
        }
        break
      default:
        throw new Error(`unknown tool ${tool}; catalog: ${OMNI_MCP_CATALOG.join(', ')}`)
    }
    push({ tool, params, ok: true, out, at: Date.now() })
    return { ok: true, out }
  } catch (e) {
    push({ tool, params, ok: false, error: String(e), at: Date.now() })
    return { ok: false, error: String(e) }
  }
}

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).omniMCP = { call: omniMcpCall, log: mcpLog, catalog: OMNI_MCP_CATALOG }
}
