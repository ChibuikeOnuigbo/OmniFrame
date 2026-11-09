import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { useEditor } from '../store'
import type { ClipEffect } from '../types'
import { applyPixelGrade } from '../lib/pixelGrade'
import { effectFilterString } from '../lib/effectFilter'
import { pfxMotionBlurSamples } from '../lib/proceduralFx'

/** Only the active square copies the program monitor. Idle cards draw once. */
export function PreviewSquare({ id, name, image, effect, preview, add, dragId }: {
  id: string; name: string; image: string; effect?: ClipEffect
  preview: () => void; add: () => void; dragId?: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const progress = useRef<HTMLDivElement>(null)
  const owner = useRef<string | null>(null)
  const [active, setActive] = useState(false)
  const dragging = useRef(false)
  const resume = useRef(false)
  useEffect(() => {
    if (active) return
    let disposed = false
    const img = new Image()
    img.onload = () => {
      if (disposed || !canvas.current) return
      const c = canvas.current, ctx = c.getContext('2d')!
      const size = Math.min(img.naturalWidth, img.naturalHeight)
      ctx.clearRect(0, 0, c.width, c.height)
      ctx.save()
      ctx.filter = effectFilterString(effect) || 'none'
      ctx.drawImage(img, (img.naturalWidth-size)/2, (img.naturalHeight-size)/2, size, size, 0, 0, c.width, c.height)
      // A staged horizontal pan makes temporal blur legible in an idle photograph.
      // Use the same temporal sample weights as project rendering; never alter the preset.
      for (const sample of pfxMotionBlurSamples(effect, 1, 30)) {
        ctx.globalAlpha = sample.alpha
        ctx.drawImage(img, (img.naturalWidth-size)/2, (img.naturalHeight-size)/2, size, size,
          (sample.time - 1) * 240, 0, c.width, c.height)
      }
      ctx.restore()
      if (effect) applyPixelGrade(c, effect, 17)
    }
    img.src = image
    return () => { disposed = true }
  }, [image, effect, active])
  useEffect(() => {
    let raf = 0
    const paint = () => {
      const s = useEditor.getState(), p = s.visualPreview
      if (!p || p.id !== owner.current) { owner.current = null; setActive(false); return }
      const source = document.querySelector<HTMLCanvasElement>('[data-testid="program-preview-canvas"]')
      const c = canvas.current
      if (source && c) {
        const ctx = c.getContext('2d')!
        ctx.fillStyle = '#090d14'; ctx.fillRect(0, 0, c.width, c.height)
        const scale = Math.min(c.width / source.width, c.height / source.height)
        ctx.drawImage(source, (c.width-source.width*scale)/2, (c.height-source.height*scale)/2, source.width*scale, source.height*scale)
      }
      if (progress.current) {
        const value = Math.max(0, Math.min(1,(s.playhead-p.startTime)/(p.endTime-p.startTime)))*100
        progress.current.style.left = `${value}%`
        progress.current.parentElement?.setAttribute('aria-valuenow', String(Math.round(value)))
      }
      raf = requestAnimationFrame(paint)
    }
    if (active) raf = requestAnimationFrame(paint)
    return () => { cancelAnimationFrame(raf); if (dragging.current) { useEditor.getState().setScrubbing(false); dragging.current = false } }
  }, [active])
  useEffect(() => () => {
    const s = useEditor.getState()
    if (owner.current && s.visualPreview?.id === owner.current) s.stopVisualPreview()
  }, [])
  const audition = () => {
    preview()
    owner.current = useEditor.getState().visualPreview?.id ?? null
    setActive(!!owner.current)
  }
  const commit = () => {
    const s = useEditor.getState(), time = s.playhead
    s.stopVisualPreview(); s.setPlayhead(time)
    owner.current = null; setActive(false); add()
  }
  const seek = (event: React.PointerEvent<HTMLDivElement>) => {
    const p = useEditor.getState().visualPreview
    if (!p || p.id !== owner.current) return
    const box = event.currentTarget.getBoundingClientRect()
    useEditor.getState().setPlayhead(p.startTime + Math.max(0,Math.min(1,(event.clientX-box.left)/box.width))*(p.endTime-p.startTime))
  }
  const end = () => {
    dragging.current = false
    const s = useEditor.getState(); s.setScrubbing(false)
    if (resume.current) s.play()
  }
  return <div className="group relative min-w-0" data-testid={`preview-card-${id}`}>
    <button type="button" data-testid={id} aria-label={`Preview ${name}`} title={`${name} — click to preview; double-click to add`}
      draggable={!!dragId} onDragStart={e => { if(dragId) e.dataTransfer.setData('application/x-omniframe-fx',dragId) }}
      onClick={e => { if(e.detail < 2) audition() }} onDoubleClick={commit}
      className={`block aspect-square w-full overflow-hidden rounded-lg border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${active?'border-cyan-300':'border-transparent hover:border-ink-500'}`}>
      <canvas ref={canvas} width={160} height={160} className="h-full w-full bg-ink-950" />
    </button>
    <button type="button" data-testid={`add-${id}`} aria-label={`Add ${name}`} onClick={commit}
      className="absolute bottom-12 right-1 z-10 grid h-7 w-7 place-items-center rounded bg-cyan-300 text-black opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100"><Plus size={16}/></button>
    {active && <div role="slider" aria-label={`Scrub ${name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} tabIndex={0}
      data-testid={`scrub-${id}`} className="absolute inset-x-1 bottom-6 h-6 cursor-ew-resize touch-none bg-black/40"
      onKeyDown={e => { if(e.key==='ArrowLeft'||e.key==='ArrowRight') {e.preventDefault(); const s=useEditor.getState(); s.setPlayhead(s.playhead+(e.key==='ArrowRight'?1:-1)/s.projectFps)} }}
      onPointerDown={e => {e.stopPropagation(); resume.current=useEditor.getState().playing; dragging.current=true; useEditor.getState().setScrubbing(true); e.currentTarget.setPointerCapture(e.pointerId); seek(e)}}
      onPointerMove={e => {if(dragging.current) seek(e)}} onPointerUp={end} onPointerCancel={end}>
      <div className="absolute inset-x-0 bottom-1 h-px bg-white/50"/>
      <div ref={progress} className="absolute bottom-0 h-6 w-[3px] bg-cyan-300"><span className="absolute bottom-0 -left-1 h-2.5 w-2.5 rounded-full bg-white"/></div>
    </div>}
    <span className="block h-6 truncate pt-1 text-[10px] text-ink-100" title={name}>{name}</span>
  </div>
}
