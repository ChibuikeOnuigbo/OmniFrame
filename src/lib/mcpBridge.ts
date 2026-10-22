/**
 * In-app MCP bridge: the SAME universal tool names as tools/mcp operate the
 * REAL store from inside the booted app (window.omniMCP.call(...)). Every call
 * is logged; the RightPanel "MCP Console" shows the log so a human (or the
 * agent's snapshot) can verify the app — not the agent — did the work.
 */
import { useEditor } from '../store'
import { addOrUpdateKeyframe, applyEasingPreset } from './animation/CurveEngine'

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
