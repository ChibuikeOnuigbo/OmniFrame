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
  // The download navigation has captured the blob synchronously; release our
  // URL on the next task instead of retaining every export for four seconds.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function exportVideo(opts: ExportOptions = {}): Promise<void> {
  const canvas = document.getElementById('of-canvas') as HTMLCanvasElement | null
  if (!canvas) throw new Error('Preview canvas not found')
  const st = useEditor.getState()
  if (st.clips.length === 0) throw new Error('Add a clip to the timeline before exporting.')

  const mime = pickMime()
  if (!mime) throw new Error('MediaRecorder is not supported in this browser.')

  // Ensure Program monitor is active and canvas dimensions match authoritative sequence settings
  if (st.monitorMode !== 'program') {
    st.setMonitorMode('program')
  }

  const targetW = st.sequenceSettings?.width || 1920
  const targetH = st.sequenceSettings?.height || 1080
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW
    canvas.height = targetH
  }

  opts.onStatus?.('Preparing recorder…')
  const stream = canvas.captureStream(30)
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
  st.setSpeed(1)
  st.setPlayhead(0)
  recorder.start(100)
  st.play()
  opts.onStatus?.('Recording timeline…')

  // Wait for playback to finish (engine pauses itself at duration).
  const start = performance.now()
  while (true) {
    const s = useEditor.getState()
    const frac = s.duration > 0 ? s.playhead / s.duration : 1
    opts.onProgress?.(Math.min(1, Math.max(0, frac)))
    if (!s.playing || s.playhead >= s.duration - 0.02) break
    if (performance.now() - start > 5 * 60 * 1000) break // safety timeout
    await new Promise((r) => setTimeout(r, 100))
  }

  // Let the recorder flush the final frames.
  await new Promise((r) => setTimeout(r, 400))
  if (recorder.state !== 'inactive') recorder.stop()
  await stopped

  const ext = mime.includes('mp4') ? 'mp4' : 'webm'
  const parts = recorderInitChunk ? [recorderInitChunk, ...chunks] : chunks
  const blob = new Blob(parts, { type: mime })
  if (!recorderInitChunk && chunks[0] instanceof Blob) recorderInitChunk = chunks[0]
  st.setSpeed(previousSpeed)
  download(blob, `omniframe-export.${ext}`)
  opts.onStatus?.('Export complete')
  opts.onProgress?.(1)
}
