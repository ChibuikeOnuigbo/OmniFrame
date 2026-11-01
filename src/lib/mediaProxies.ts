import { create } from 'zustand'
import type { MediaAsset } from '../types'
import { previewDimensions } from './previewPerformance'

type ProxyEntry = { source: string; url: string; bytes: number; width: number; height: number }
export const useMediaProxies = create<{
  enabled: boolean; entries: Record<string, ProxyEntry>; active: string | null; progress: number; error: string
}>(() => ({ enabled: true, entries: {}, active: null, progress: 0, error: '' }))
let controller: AbortController | null = null
export function cancelProxy() { controller?.abort() }
export function proxySource(asset: MediaAsset, fullQuality: boolean) {
  const state = useMediaProxies.getState(), entry = state.entries[asset.id]
  return !fullQuality && state.enabled && entry?.source === asset.url ? entry.url : asset.url
}
export function clearProxies() {
  cancelProxy()
  for (const entry of Object.values(useMediaProxies.getState().entries)) URL.revokeObjectURL(entry.url)
  useMediaProxies.setState({ entries: {} })
}

/** Session-only silent video proxies. Playback keeps audio on the original asset. */
export async function generateProxy(asset: MediaAsset) {
  if (useMediaProxies.getState().active) return
  const abort = new AbortController(); controller = abort
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'; video.muted = true; video.playsInline = true; video.preload = 'auto'
  let timer: ReturnType<typeof setInterval> | undefined
  let recorder: MediaRecorder | undefined
  let stream: MediaStream | undefined
  useMediaProxies.setState({ active: asset.id, progress: 0, error: '' })
  try {
    if (asset.kind !== 'video') throw Error('Choose a video to prepare a proxy.')
    const mime = ['video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type))
    if (!mime) throw Error('This browser cannot encode WebM proxies.')
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => finish(Error('Video metadata timed out.')), 15000)
      const finish = (error?: Error) => {
        clearTimeout(timeout); video.onloadeddata = null; video.onerror = null
        abort.signal.removeEventListener('abort', cancel)
        error ? reject(error) : resolve()
      }
      const cancel = () => finish(Error('Proxy preparation cancelled.'))
      video.onloadeddata = () => finish()
      video.onerror = () => finish(Error('Could not decode the original video.'))
      abort.signal.addEventListener('abort', cancel, { once: true })
      video.src = asset.url
    })
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 300) throw Error('Browser proxies currently support videos up to five minutes.')
    const { width, height } = previewDimensions(video.videoWidth, video.videoHeight, 'medium')
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0, width, height)
    stream = canvas.captureStream(30)
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_500_000 })
    const chunks: Blob[] = []; let bytes = 0
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timeout); abort.signal.removeEventListener('abort', cancel)
        video.onended = null; video.onerror = null
        if (recorder!.state !== 'inactive') recorder!.stop()
        error ? reject(error) : resolve()
      }
      const cancel = () => finish(Error('Proxy preparation cancelled.'))
      const timeout = setTimeout(() => finish(Error('Proxy preparation stalled. Keep the editor tab visible and retry.')), video.duration * 1500 + 15000)
      recorder!.ondataavailable = event => {
        if (event.data.size) { chunks.push(event.data); bytes += event.data.size }
        if (bytes > 128 * 1024 * 1024) finish(Error('Proxy exceeded the 128 MB memory limit.'))
      }
      recorder!.onerror = () => finish(Error('Proxy encoder failed.'))
      recorder!.onstop = () => finish()
      video.onerror = () => finish(Error('Source decoding failed during proxy preparation.'))
      video.onended = () => recorder!.stop()
      abort.signal.addEventListener('abort', cancel, { once: true })
      timer = setInterval(() => {
        ctx.drawImage(video, 0, 0, width, height)
        useMediaProxies.setState({ progress: Math.min(1, video.currentTime / video.duration) })
      }, 1000 / 30)
      recorder!.start(500)
      void video.play().catch(() => finish(Error('Browser blocked proxy playback. Try again from the Prepare button.')))
    })
    if (abort.signal.aborted) throw Error('Proxy preparation cancelled.')
    const blob = new Blob(chunks, { type: mime })
    if (!blob.size) throw Error('Proxy encoder produced no video.')
    const state = useMediaProxies.getState()
    const total = Object.entries(state.entries).reduce((sum, [id, p]) => sum + (id === asset.id ? 0 : p.bytes), blob.size)
    if (total > 256 * 1024 * 1024) throw Error('Session proxies exceed 256 MB. Clear proxies before preparing more.')
    const previous = state.entries[asset.id]
    if (previous) URL.revokeObjectURL(previous.url)
    useMediaProxies.setState({ entries: { ...state.entries, [asset.id]: { source: asset.url, url: URL.createObjectURL(blob), bytes: blob.size, width, height } }, progress: 1 })
  } catch (error) {
    useMediaProxies.setState({ error: error instanceof Error ? error.message : String(error) })
  } finally {
    clearInterval(timer)
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    stream?.getTracks().forEach(track => track.stop())
    video.pause(); video.removeAttribute('src'); video.load()
    controller = null
    useMediaProxies.setState({ active: null })
  }
}
