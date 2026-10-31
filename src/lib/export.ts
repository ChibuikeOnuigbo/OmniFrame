import { attachAudioElements, createRecordingAudioStream } from './audioBus'
// Real export: record the live preview canvas (driven by PreviewEngine) with
// MediaRecorder, mixing in audio from active media elements where possible.
// Footage never leaves the browser.

import { useEditor } from '../store'
import { allMediaElements } from './playback'

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

  const previousQuality = st.previewQuality
  const previousSpeed = st.speed
  let cleanup = () => {}
  st.setPreviewQuality('full')
  try {
  // Let React resize the engine itself; never resize its canvas behind it.
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
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
      attachAudioElements(allMediaElements())
      scalerCtx?.drawImage(canvas, 0, 0, targetW, targetH)
    } catch { /* live canvas momentarily unavailable */ }
    requestAnimationFrame(pumpScaler)
  }
  pumpScaler()

  opts.onStatus?.('Preparing recorder…')
  const stream = scaler.captureStream(30)
  const audio = createRecordingAudioStream()
  audio.stream.getAudioTracks().forEach(track => stream.addTrack(track))

  cleanup = () => { scalerRunning = false; stream.getTracks().forEach(track => track.stop()); audio.dispose() }
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 8_000_000,
  })
  cleanup = () => { scalerRunning = false; if (recorder.state !== 'inactive') recorder.stop(); stream.getTracks().forEach(track => track.stop()); audio.dispose() }
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve()
  })

  // In/Out range export: record only the marked slice (CapCut behaviour).
  const range = st.exportRange && st.exportRange.out > st.exportRange.in ? st.exportRange : null
  const recordFrom = range ? range.in : 0
  const recordTo = range ? range.out : st.duration
  st.pause()
  st.setSpeed(1)
  recorder.start(100)
  st.startVisualPreview({kind:'range-playback',label:'Export range',startTime:recordFrom,endTime:recordTo})
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
  // Each recording owns its initialization segment. Prepending a chunk from
  // an earlier export corrupts independent MP4/WebM streams.
  const blob = new Blob(chunks, { type: mime })
  st.setSpeed(previousSpeed)
  download(blob, `omniframe-export.${ext}`)
  opts.onStatus?.('Export complete')
  opts.onProgress?.(1)
  } finally {
    cleanup()
    st.stopVisualPreview()
    st.pause()
    st.setSpeed(previousSpeed)
    st.setPreviewQuality(previousQuality)
  }
}
