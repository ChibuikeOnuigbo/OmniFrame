/**
 * In-app MCP bridge: the SAME universal tool names as tools/mcp operate the
 * REAL store from inside the booted app (window.omniMCP.call(...)). Every call
 * is logged; the RightPanel "MCP Console" shows the log so a human (or the
 * agent's snapshot) can verify the app — not the agent — did the work.
 */
import { useEditor } from '../store'
import { addOrUpdateKeyframe, applyEasingPreset } from './animation/CurveEngine'
import { drawTimelineSnapshot, timelineSnapshotSize, type TimelineSnapPayload } from './timelineSnapshot'

export interface McpLogEntry { tool: string; params: Record<string, unknown>; ok: boolean; out?: unknown; error?: string; at: number }
export const mcpLog: McpLogEntry[] = []

function push(e: McpLogEntry) {
  mcpLog.push(e)
  if (mcpLog.length > 300) mcpLog.shift()
  useEditor.setState({ mcpLogVersion: ((useEditor.getState() as unknown as { mcpLogVersion?: number }).mcpLogVersion ?? 0) + 1 } as Partial<never>)
}

export const OMNI_MCP_CATALOG = [
  'help', 'select', 'click', 'mask_draw', 'mask_clear', 'keyframe_set', 'curve_set',
  'effect_set', 'remove_background', 'fill_composition_area', 'snapshot', 'dump',
  'timeline_screenshot', 'track_assign', 'log', 'clip_stretch', 'transparent_select',
  'select_main_element', 'omniframe_extract', 'patch_under', 'omniframe_move',
]

export async function omniMcpCall(tool: string, params: Record<string, any> = {}): Promise<{ ok: boolean; out?: unknown; error?: string }> {
  const st = () => useEditor.getState() as any
  const clips = () => (st().clips || []) as any[]
  const selClip = () => clips().find(c => c.id === st().selectedClipId) || clips().find(c => (st().selectedClipIds || []).includes(c.id))
  try {
    let out: any = null
    const seq = st().sequenceSettings || { width: 1920, height: 1080 }
    switch (tool) {
      case 'help':
        out = { catalog: OMNI_MCP_CATALOG, note: 'universal tools operate the real store; every call is logged in the MCP Console' }
        break
      case 'select':
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
        c.mask = {
          shape: params.shape || 'rectangle', kind: 'shape',
          centerX: ((params.x0 + params.x1) / 2) / seq.width, centerY: ((params.y0 + params.y1) / 2) / seq.height,
          width: Math.abs(params.x1 - params.x0) / seq.width, height: Math.abs(params.y1 - params.y0) / seq.height,
          feather: params.feather ?? 0, inverted: !!params.inverted, enabled: true,
        }
        useEditor.setState({ clips: [...clips()] }); out = { clipId: c.id, mask: c.mask }
        break
      }
      case 'mask_clear': {
        const c = selClip(); if (c) { c.mask = undefined; useEditor.setState({ clips: [...clips()] }) }
        out = { clipId: c ? c.id : null }
        break
      }
      case 'keyframe_set': {
        const c = selClip(); if (!c) throw new Error('nothing selected')
        c.animation = c.animation || { curves: {} }
        const key = `${params.property}_${String(params.channel || 'Scalar').toLowerCase()}`
        if (!c.animation.curves[key]) throw new Error(`no curve ${key}`)
        const r = addOrUpdateKeyframe(c.animation.curves[key], params.time, params.value, params.interpolation || 'linear')
        c.animation.curves[key] = r.curve
        useEditor.setState({ clips: [...clips()] }); out = { clipId: c.id, curve: key, keyframeId: r.keyframe.id }
        break
      }
      case 'curve_set': {
        const c = selClip(); if (!c) throw new Error('nothing selected')
        const key = `${params.property}_${String(params.channel || 'Scalar').toLowerCase()}`
        let curve = c.animation && c.animation.curves[key]
        if (curve) for (const k of curve.keyframes) curve = applyEasingPreset(curve, k.id, params.interpolation)
        useEditor.setState({ clips: [...clips()] }); out = { curve: key }
        break
      }
      case 'effect_set':
        st().setClipEffect(selClip() ? selClip().id : undefined, params.patch || {}); out = { clipId: selClip() ? selClip().id : null }
        break
      case 'remove_background':
        st().setClipEffect(selClip() ? selClip().id : undefined, { [params.method === 'chroma' ? 'chromaKey' : 'lumaKey']: params.strength ?? 0.85 })
        out = { clipId: selClip() ? selClip().id : null }
        break
      case 'fill_composition_area': {
        const c = selClip(); if (!c) throw new Error('nothing selected')
        const asset = (st().assets || []).find((a: any) => a.id === c.assetId)
        const aw = (asset && asset.width) || seq.width, ah = (asset && asset.height) || seq.height
        const k = Math.max(seq.width / aw, seq.height / ah)
        c.transform = { ...c.transform, scale: k }
        useEditor.setState({ clips: [...clips()] }); out = { scale: k }
        break
      }
      case 'snapshot': {
        const el = document.querySelector('[data-testid="preview-stage"] canvas') as HTMLCanvasElement | null
        if (!el) throw new Error('preview canvas not mounted')
        out = { 'data:img': el.toDataURL('image/png') }
        break
      }
      case 'track_assign': {
        const c = selClip(); if (!c) throw new Error('nothing selected')
        const tracks = (st().tracks || []) as any[]
        if (!tracks.some(t => t.id === params.track)) tracks.push({ id: params.track, name: `track ${params.track + 1}`, type: 'video' })
        c.trackId = params.track
        useEditor.setState({ clips: [...clips()], tracks: [...tracks] })
        out = { clipId: c.id, track: params.track }
        break
      }
      case 'log':
        out = { entries: mcpLog.slice(-(params.limit || 50)) }
        break
      case 'clip_stretch': {
        const c = selClip(); if (!c) throw new Error('nothing selected')
        c.duration = Math.max(0.1, params.duration ?? c.duration)
        useEditor.setState({ clips: [...clips()] }); out = { clipId: c.id, duration: c.duration }
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
        const t = params.t ?? 0
        c.animation.curves.position_x = addOrUpdateKeyframe(c.animation.curves.position_x, t, params.x ?? 0, 'constant').curve
        c.animation.curves.position_y = addOrUpdateKeyframe(c.animation.curves.position_y, t, params.y ?? 0, 'constant').curve
        useEditor.setState({ clips: [...clips()] }); out = { clipId: c.id, interpolation: 'constant', slide: false }
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
