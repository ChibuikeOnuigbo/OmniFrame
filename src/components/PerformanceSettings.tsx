import { useEditor } from '../store'
import { useMediaProxies, generateProxy, cancelProxy, clearProxies } from '../lib/mediaProxies'
import { useEffect, useState } from 'react'
import { previewMetrics, usePerformanceSettings, type PreviewFps } from '../lib/performanceSettings'

export function PerformanceSettings() {
  const assets = useEditor(s => s.assets)
  const proxies = useMediaProxies()
  const [selected, setSelected] = useState('')
  const videos = assets.filter(a => a.kind === 'video')
  const asset = videos.find(a => a.id === selected) ?? videos[0]
  const { previewFps, setPreviewFps } = usePerformanceSettings()
  const [metrics, setMetrics] = useState({ ...previewMetrics })
  useEffect(() => {
    const id = setInterval(() => setMetrics({ ...previewMetrics }), 500)
    return () => clearInterval(id)
  }, [])
  return <div className="mt-4 space-y-3 border-t border-ink-700 pt-3" data-testid="performance-settings">
    <label className="flex items-center justify-between gap-2">Playback render limit
      <select aria-label="Playback render limit" value={previewFps} onChange={e => setPreviewFps(Number(e.target.value) as PreviewFps)} className="rounded border border-ink-600 bg-ink-800 p-2">
        {[15, 30, 60].map(fps => <option key={fps} value={fps}>{fps} fps</option>)}
      </select>
    </label>
    <p className="text-[11px] text-ink-400">Lower limits reduce compositing work during playback. Audio and timeline timing stay unchanged. Full quality bypasses the limit for export.</p>
    <output className="block text-[11px] text-ink-300" data-testid="render-metrics">{metrics.width} × {metrics.height} · last frame {metrics.renderMs.toFixed(1)} ms · {metrics.frames} frames rendered</output>
    <p className="text-[11px] text-ink-400">Paused previews refresh when edits change, with periodic checks for decoded media.</p>
    <section className="space-y-2 border-t border-ink-700 pt-3" aria-label="Media proxies">
      <h4 className="font-semibold">Media proxies</h4>
      <label className="flex items-center gap-2"><input type="checkbox" checked={proxies.enabled} onChange={e => useMediaProxies.setState({ enabled: e.target.checked })} />Use prepared proxies</label>
      <select aria-label="Proxy source video" value={asset?.id ?? ''} onChange={e => setSelected(e.target.value)} className="w-full min-w-0 bg-ink-800 p-2">
        {!videos.length && <option value="">Import a video first</option>}
        {videos.map(video => <option value={video.id} key={video.id}>{video.name}{proxies.entries[video.id]?.source === video.url ? ' · ready' : ''}</option>)}
      </select>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!asset || !!proxies.active} onClick={() => asset && void generateProxy(asset)} className="rounded border border-ink-600 px-2 py-1 disabled:opacity-40">Prepare proxy</button>
        {proxies.active && <button type="button" onClick={cancelProxy}>Cancel</button>}
        <button type="button" onClick={clearProxies}>Clear proxies</button>
      </div>
      {proxies.active && <div role="status">Preparing {Math.round(proxies.progress * 100)}%<progress className="w-full" value={proxies.progress} max={1} /></div>}
      {proxies.error && <p role="alert" className="text-amber-300">{proxies.error}</p>}
      <p className="text-[11px] text-ink-400">Prepares an 854 px video for smoother editing, in real time. Keep this tab visible. Original audio and export media stay intact. Proxies are temporary for this tab, support clips up to five minutes, and use up to 256 MB.</p>
    </section>
  </div>
}
