/**
 * Timeline snapshot renderer — app code that draws the timeline state exactly
 * as the editor holds it: one row per track, clip blocks (name, kind colour,
 * MASK/ROTO badges), keyframe diamonds per curve, selection highlight,
 * playhead, and the MCP call log underneath. Used by:
 *  - the booted app (window.omniMCP.call('timeline_screenshot') → data:img)
 *  - the headless MCP layer (same module, same pixels) for evidence PNGs.
 * Pure canvas: no store/DOM imports, so headless and app render identically.
 */
export interface TimelineSnapClip {
  id: string
  name: string
  start: number
  duration: number
  track: number
  masked?: boolean
  roto?: boolean
  keyed?: string[] // curve keys that carry keyframes
  selected?: boolean
  kind?: string
}
export interface TimelineSnapPayload {
  sequence: { width: number; height: number; fps: number; duration: number }
  tracks: Array<{ id: number; name: string }>
  clips: TimelineSnapClip[]
  playhead?: number
  log?: Array<{ tool: string; ok: boolean }>
  title?: string
}

const TRACK_H = 34
const HEAD_H = 26
const LOG_H = 74

export function timelineSnapshotSize(p: TimelineSnapPayload): { w: number; h: number } {
  const rows = Math.max(1, p.tracks.length)
  return { w: 900, h: HEAD_H + rows * TRACK_H + LOG_H + 8 }
}

export function drawTimelineSnapshot(ctx: CanvasRenderingContext2D, p: TimelineSnapPayload, w: number, h: number): void {
  const rows = Math.max(1, p.tracks.length)
  ctx.fillStyle = '#101216'
  ctx.fillRect(0, 0, w, h)
  // ruler
  ctx.fillStyle = '#181b22'
  ctx.fillRect(0, 0, w, HEAD_H)
  ctx.strokeStyle = '#2a2f3a'
  ctx.fillStyle = '#8b93a7'
  ctx.font = '10px monospace'
  const dur = Math.max(0.001, p.sequence.duration)
  for (let s = 0; s <= dur + 1e-9; s += Math.max(0.25, Math.round(dur / 8 * 4) / 4)) {
    const x = 320 + (s / dur) * (w - 340)
    ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x, HEAD_H - 4); ctx.stroke()
    ctx.fillText(`${s.toFixed(2)}s`, x + 2, 16)
  }
  ctx.fillStyle = '#e5e9f2'
  ctx.font = 'bold 11px monospace'
  ctx.fillText(p.title || 'OmniFrame timeline', 8, 16)
  // tracks + clips
  p.tracks.forEach((tr, ri) => {
    const y = HEAD_H + ri * TRACK_H
    ctx.fillStyle = ri % 2 ? '#14171d' : '#12151b'
    ctx.fillRect(0, y, w, TRACK_H)
    ctx.fillStyle = '#6b7385'
    ctx.font = '9px monospace'
    ctx.fillText(`T${tr.id} ${tr.name.slice(0, 14)}`, 6, y + 20)
    for (const c of p.clips.filter(c => c.track === tr.id)) {
      const x = 320 + (c.start / dur) * (w - 340)
      const cw = Math.max(14, (c.duration / dur) * (w - 340))
      ctx.fillStyle = c.masked ? '#3b2a4d' : c.kind === 'text' ? '#24402c' : '#1f3040'
      ctx.fillRect(x, y + 4, cw, TRACK_H - 10)
      ctx.strokeStyle = c.selected ? '#ff5a5a' : '#394050'
      ctx.lineWidth = c.selected ? 2 : 1
      ctx.strokeRect(x, y + 4, cw, TRACK_H - 10)
      ctx.fillStyle = '#cdd4e2'
      ctx.font = '9px monospace'
      ctx.fillText(c.name.slice(0, 18), x + 4, y + 15)
      let bx = x + 4
      if (c.masked) { ctx.fillStyle = '#c084fc'; ctx.fillText('MASK', bx, y + 26); bx += 34 }
      if (c.roto) { ctx.fillStyle = '#f472b6'; ctx.fillText('ROTO', bx, y + 26); bx += 32 }
      // keyframe diamonds
      (c.keyed || []).forEach((k, ki) => {
        ctx.fillStyle = ['#ef4444', '#22c55e', '#3b82f6'][ki % 3]
        for (const t of [c.start, c.start + c.duration]) {
          const kx = 320 + (t / dur) * (w - 340)
          ctx.save(); ctx.translate(kx, y + 24); ctx.rotate(Math.PI / 4); ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore()
        }
        ctx.fillStyle = '#8b93a7'
        ctx.fillText(k.replace('_', ''), bx, y + 26); bx += 26
      })
    }
  })
  // playhead
  if (p.playhead !== undefined) {
    const x = 320 + (p.playhead / dur) * (w - 340)
    ctx.strokeStyle = '#ff5a5a'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(x, HEAD_H); ctx.lineTo(x, HEAD_H + rows * TRACK_H); ctx.stroke()
  }
  // log strip
  const ly = HEAD_H + rows * TRACK_H + 6
  ctx.fillStyle = '#0b0d11'
  ctx.fillRect(0, ly, w, LOG_H)
  ctx.fillStyle = '#8ef0c0'
  ctx.font = '9px monospace'
  ctx.fillText('MCP call log (window.omniMCP / cli trace):', 8, ly + 12)
  const entries = (p.log || []).slice(-24)
  entries.forEach((e, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    ctx.fillStyle = e.ok ? '#6ee7b7' : '#fda4af'
    ctx.fillText(`${e.ok ? '✓' : '✗'}${e.tool}`, 8 + col * 440, ly + 24 + row * 12)
  })
}
