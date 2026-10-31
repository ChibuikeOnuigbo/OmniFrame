// Real export: record the live preview canvas (driven by PreviewEngine) with
// MediaRecorder, mixing in audio from active media elements where possible.
// Footage never leaves the browser.

import { useEditor } from '../store'
import { allMediaElements } from './playback'

let recorderCache: MediaRecorder | null = null
let recorderStream: MediaStream | null = null
let recorderCanvas: HTMLCanvasElement | null = null
let recorderRaf = 0
let recorderInitChunk: Blob | null = null

export interface ExportOptions {
  onProgress?: (fraction: number) => void
  onStatus?: (status: string) => void
}

function pickMime(forceWebm = false): string {
  const candidates = [
    ...(forceWebm ? [] : ['video/mp4;codecs=avc1.42E01E', 'video/mp4']),
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ]
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c
  }
  return ''
}

function mixAudio(): MediaStream | null {
  try {
    const elements = allMediaElements().filter((el) => {
      if (el instanceof HTMLAudioElement) return true
      if (el instanceof HTMLVideoElement && !el.muted && el.volume > 0) return true
      return false
    })
    if (elements.length === 0) return null

    const Ctx =
      (window as any).AudioContext || (window as any).webkitAudioContext
    const ctx: AudioContext = new Ctx()
    const dest = ctx.createMediaStreamDestination()
    const seen = new Set<HTMLMediaElement>()
    for (const el of elements) {
      if (seen.has(el)) continue
      seen.add(el)
      try {
        const src = ctx.createMediaElementSource(el)
        src.connect(dest)
      } catch {
        // element already routed elsewhere — skip
      }
    }
    const tracks = dest.stream.getAudioTracks()
    return tracks.length > 0 ? dest.stream : null
  } catch {
    return null
  }
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the browser a beat to actually start the download: revoking the blob
  // URL on the next task can cancel it before it commits, which silently
  // produces no file at all.
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export async function exportVideo(opts: ExportOptions = {}): Promise<void> {
  const st = useEditor.getState()
  if (st.clips.length === 0) throw new Error('Add a clip to the timeline before exporting.')

  // Ensure Program monitor is active and canvas dimensions match authoritative sequence settings
  if (st.monitorMode !== 'program') {
    st.setMonitorMode('program')
  }

  const mime = pickMime()
  if (!mime) throw new Error('MediaRecorder is not supported in this browser.')

  // Look the canvas up only AFTER the monitor switch. In Source mode the
  // program canvas is not mounted at all, so resolving it first always threw
  // "Preview canvas not found" and exported nothing.
  const initial = useEditor.getState()
  if (initial.monitorMode !== 'program') {
    initial.setMonitorMode('program')
  }

  // React does not always mount the program monitor within a fixed number of
  // frames, so poll for the canvas instead of assuming two rAF is enough.
  const findCanvas = async (timeoutMs = 3000): Promise<HTMLCanvasElement | null> => {
    const deadline = performance.now() + timeoutMs
    for (;;) {
      const live = useEditor.getState()
      const preferred = live.is3DMode ? 'of-three-canvas' : 'of-canvas'
      const el =
        (document.getElementById(preferred) as HTMLCanvasElement | null) ??
        (document.getElementById('of-canvas') as HTMLCanvasElement | null)
      if (el) return el
      if (performance.now() >= deadline) return null
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }
  }

  const canvas = await findCanvas()
  if (!canvas) throw new Error('Preview canvas not found')

  const targetW = st.sequenceSettings?.width || 1920
  const targetH = st.sequenceSettings?.height || 1080
  // Record from a scaler canvas, NOT by resizing the live preview canvas:
  // the PreviewEngine caches its render size, so mutating the live canvas
  // behind its back used to bake the (smaller, quality-scaled) preview into
  // the top-left of the export with black bars right/bottom. The scaler
  // draws the live canvas stretched to the exact sequence size each frame.
  const scaler = document.createElement('canvas')
  scaler.width = targetW
  scaler.height = targetH
  const scalerCtx = scaler.getContext('2d')
  let scalerRunning = true
  const pumpScaler = () => {
    if (!scalerRunning) return
    try {
      scalerCtx?.drawImage(canvas, 0, 0, targetW, targetH)
    } catch { /* live canvas momentarily unavailable */ }
    requestAnimationFrame(pumpScaler)
  }
  pumpScaler()

  opts.onStatus?.('Preparing recorder…')
  const stream = scaler.captureStream(30)
  const audio = mixAudio()
  if (audio) {
    audio.getAudioTracks().forEach((t) => stream.addTrack(t))
  }

  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 8_000_000,
  })
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve()
  })

  const previousSpeed = st.speed
  // In/Out range export: record only the marked slice (CapCut behaviour).
  const range = st.exportRange && st.exportRange.out > st.exportRange.in ? st.exportRange : null
  const recordFrom = range ? range.in : 0
  const recordTo = range ? range.out : st.duration
  st.setSpeed(1)
  st.setPlayhead(recordFrom)
  recorder.start(100)
  st.play()
  opts.onStatus?.(range ? 'Recording selected range…' : 'Recording timeline…')

  // Wait for playback to finish (engine pauses itself at duration).
  const start = performance.now()
  while (true) {
    const s = useEditor.getState()
    const frac = recordTo > recordFrom ? (s.playhead - recordFrom) / (recordTo - recordFrom) : 1
    opts.onProgress?.(Math.min(1, Math.max(0, frac)))
    if (!s.playing || s.playhead >= recordTo - 0.02) break
    if (performance.now() - start > 5 * 60 * 1000) break // safety timeout
    await new Promise((r) => setTimeout(r, 100))
  }

  // Stop promptly: the engine renders an empty (black) frame once the
  // playhead passes the last clip, so lingering here bakes a black tail
  // into every export. MediaRecorder flushes pending data on stop().
  await new Promise((r) => setTimeout(r, 50))
  if (recorder.state !== 'inactive') recorder.stop()
  await stopped
  scalerRunning = false

  const ext = mime.includes('mp4') ? 'mp4' : 'webm'
  const parts = recorderInitChunk ? [recorderInitChunk, ...chunks] : chunks
  const blob = new Blob(parts, { type: mime })
  if (!recorderInitChunk && chunks[0] instanceof Blob) recorderInitChunk = chunks[0]
  st.setSpeed(previousSpeed)
  download(blob, `omniframe-export.${ext}`)
  opts.onStatus?.('Export complete')
  opts.onProgress?.(1)
}
