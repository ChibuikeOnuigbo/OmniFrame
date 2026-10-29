/**
 * Replace-Video-With-Video popup (CapCut parity — reference screenshots in
 * new_doc_toll_research/imgs/capcut-replace/). Opens when a video asset is
 * dropped onto a video clip on the timeline:
 *  - filmstrip of the FULL replacement source (thumbnails via <video> seek)
 *  - a view-window segment exactly as long as the target clip; drag it to
 *    slide the in-point (5 s clip over 8 s source ⇒ 0-5 … 3-8)
 *  - "Use the original video effect" checkbox (carries fx/LUT grade across)
 *  - Replace clip / Cancel buttons
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from '../store'
import { clampReplaceWindow } from '../lib/replaceVideo'

const THUMBS = 8

export default function ReplaceDialog() {
  const dlg = useEditor((s) => s.replaceDialog)
  const clip = useEditor((s) => s.clips.find((c) => dlg ? c.id === dlg.clipId : false))
  const asset = useEditor((s) => s.assets.find((a) => dlg ? a.id === dlg.assetId : false))
  const close = useEditor((s) => s.closeReplaceDialog)
  const commit = useEditor((s) => s.commitReplaceVideo)
  const [thumbs, setThumbs] = useState<string[]>([])
  const [start, setStart] = useState(0)
  const [carry, setCarry] = useState(true)
  const stripRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; start: number } | null>(null)

  const sourceDuration = asset?.duration || 0
  const clipDuration = clip?.duration || 0
  const win = useMemo(() => clampReplaceWindow(sourceDuration || 1, clipDuration || 1, start), [sourceDuration, clipDuration, start])

  useEffect(() => {
    setThumbs([])
    setStart(clip?.inPoint ?? 0)
    setCarry(true)
    if (!asset || asset.kind !== 'video') return
    let dead = false
    const frames: string[] = []
    const vid = document.createElement('video')
    vid.src = asset.url
    vid.muted = true
    vid.crossOrigin = 'anonymous'
    const n = THUMBS
    let i = 0
    const grab = () => {
      if (dead) return
      const c = document.createElement('canvas')
      c.width = 96; c.height = 54
      const x = c.getContext('2d')
      if (x) { try { x.drawImage(vid, 0, 0, 96, 54) } catch { /* seek race */ } }
      frames[i] = c.toDataURL('image/jpeg', 0.6)
      i += 1
      if (i < n) { vid.currentTime = (i / (n - 1)) * Math.max(0, (asset.duration || 1) - 0.05); }
      else setThumbs([...frames])
    }
    vid.addEventListener('seeked', grab)
    vid.addEventListener('loadedmetadata', () => { vid.currentTime = 0 })
    vid.addEventListener('error', () => { if (!dead) setThumbs([]) })
    return () => { dead = true; vid.removeAttribute('src') }
  }, [asset])

  if (!dlg || !clip || !asset) return null
  const frac = win.clipDuration / Math.max(0.001, sourceDuration)
  const leftPct = (win.start / Math.max(0.001, sourceDuration)) * 100
  const widthPct = Math.min(100, frac * 100)

  const onDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, start: win.start }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    const el = stripRef.current
    if (!d || !el) return
    const px = el.getBoundingClientRect().width
    if (!px) return
    const dt = ((e.clientX - d.x) / px) * sourceDuration
    setStart(clampReplaceWindow(sourceDuration, clipDuration, d.start + dt).start)
  }
  const onUp = () => { dragRef.current = null }
  const fmt = (t: number) => {
    const m = Math.floor(t / 60), s = Math.floor(t % 60), f = Math.floor((t % 1) * 100)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60" data-testid="replace-dialog">
      <div className="w-[560px] max-w-[92vw] rounded-lg border border-ink-700 bg-ink-900 p-4 shadow-2xl">
        <div className="mb-2 text-[12px] font-semibold text-ink-100">Replace</div>
        <div className="relative mb-3 aspect-video w-full overflow-hidden rounded bg-black" data-testid="replace-preview">
          {thumbs[0] ? (
            <img src={thumbs[Math.min(thumbs.length - 1, Math.floor((win.start / Math.max(0.001, sourceDuration)) * (thumbs.length - 1)))]} alt="replace source" className="h-full w-full object-cover" />
          ) : (
            <video src={asset.url} className="h-full w-full object-cover" muted playsInline />
          )}
        </div>
        <div
          ref={stripRef}
          className="relative h-14 w-full select-none overflow-hidden rounded border border-ink-700 bg-ink-950"
          data-testid="replace-filmstrip"
        >
          <div className="flex h-full w-full">
            {(thumbs.length ? thumbs : Array.from({ length: THUMBS }, () => '')).map((t, i) => (
              <div key={i} className="h-full flex-1 overflow-hidden bg-ink-800">
                {t ? <img src={t} alt="" className="h-full w-full object-cover" /> : null}
              </div>
            ))}
          </div>
          <div
            className="absolute inset-y-0 cursor-grab border-2 border-brand bg-brand/15 active:cursor-grabbing"
            style={{ left: `${leftPct}%`, width: `${Math.max(4, widthPct)}%` }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            data-testid="replace-window"
            title="Drag to slide the source window"
          />
        </div>
        <div className="mt-1 text-center font-mono text-[11px] text-ink-300" data-testid="replace-timecode">
          {fmt(win.start)} – {fmt(win.end)} (window {win.clipDuration.toFixed(2)} s of {sourceDuration.toFixed(2)} s source)
        </div>
        <label className="mt-3 flex items-center gap-2 text-[12px] text-ink-200">
          <input type="checkbox" checked={carry} onChange={(e) => setCarry(e.target.checked)} data-testid="replace-carry-fx" />
          Use the original video effect
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded bg-brand px-3 py-1.5 text-[12px] font-semibold text-ink-950 hover:brightness-110"
            data-testid="replace-confirm"
            onClick={() => commit(win.start, carry)}
          >
            Replace clip
          </button>
          <button type="button" className="rounded bg-ink-700 px-3 py-1.5 text-[12px] font-medium text-ink-100 hover:bg-ink-600" onClick={close}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
