import { useEditor } from '../store'
import { useMediaProxies, generateProxy, cancelProxy, clearProxies } from '../lib/mediaProxies'
import { useEffect, useRef, useState } from 'react'
import { previewMetrics, usePerformanceSettings, type PreviewFps } from '../lib/performanceSettings'
import { Check, Cpu, Gauge, HardDrive, Layers3 } from 'lucide-react'

export function PerformanceSettings() {
  const assets = useEditor(s => s.assets)
  const proxies = useMediaProxies()
  const [selected, setSelected] = useState('')
  const videos = assets.filter(a => a.kind === 'video')
  const asset = videos.find(a => a.id === selected) ?? videos[0]
  const { previewFps, setPreviewFps } = usePerformanceSettings()
  const previewQuality = useEditor(s => s.previewQuality)
  const setPreviewQuality = useEditor(s => s.setPreviewQuality)
  const [metrics, setMetrics] = useState({ ...previewMetrics })
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null)
  const stopBatch = useRef(false)
  useEffect(() => {
    const id = setInterval(() => setMetrics({ ...previewMetrics }), 500)
    return () => clearInterval(id)
  }, [])
  const prepared = videos.filter(video => proxies.entries[video.id]?.source === video.url).length
  const cacheBytes = Object.values(proxies.entries).reduce((sum, entry) => sum + entry.bytes, 0)
  const cacheLabel = cacheBytes >= 1024 * 1024 ? `${(cacheBytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(cacheBytes / 1024)} KB`
  const threads = typeof navigator === 'undefined' ? 0 : navigator.hardwareConcurrency || 0
  const applyProfile = (profile: 'fast' | 'balanced' | 'quality') => {
    const next = profile === 'fast' ? { quality: 'low' as const, fps: 30 as const, proxies: true }
      : profile === 'balanced' ? { quality: 'high' as const, fps: 30 as const, proxies: true }
        : { quality: 'full' as const, fps: 60 as const, proxies: false }
    setPreviewQuality(next.quality); setPreviewFps(next.fps); useMediaProxies.setState({ enabled: next.proxies })
  }
  const activeProfile = previewQuality === 'low' && previewFps === 30 && proxies.enabled ? 'fast'
    : previewQuality === 'high' && previewFps === 30 && proxies.enabled ? 'balanced'
      : previewQuality === 'full' && previewFps === 60 && !proxies.enabled ? 'quality' : null
  const prepareAll = async () => {
    stopBatch.current = false
    const pending = videos.filter(video => proxies.entries[video.id]?.source !== video.url)
    setBatch({ done: 0, total: pending.length })
    for (let index = 0; index < pending.length; index += 1) {
      if (stopBatch.current) break
      await generateProxy(pending[index])
      setBatch({ done: index + 1, total: pending.length })
    }
    setBatch(null)
  }
  const stopPreparing = () => { stopBatch.current = true; cancelProxy() }

  return <div className="mt-4 space-y-4 border-t border-ink-700 pt-4" data-testid="performance-settings">
    <section aria-labelledby="performance-profile-heading">
      <div className="mb-2 flex items-center justify-between gap-2"><h4 id="performance-profile-heading" className="font-semibold text-ink-100">Performance profile</h4><span className="text-[9px] text-ink-500">Applies immediately</span></div>
      <div className="grid grid-cols-3 gap-2">
        {([
          ['fast', 'Fast', 'Low · 30 fps · proxies'],
          ['balanced', 'Balanced', 'High · 30 fps · proxies'],
          ['quality', 'Full Quality', 'Full · 60 fps · originals'],
        ] as const).map(([id, label, note]) => <button key={id} type="button" data-testid={`performance-profile-${id}`} aria-pressed={activeProfile === id} onClick={() => applyProfile(id)} className={`relative min-h-16 rounded-lg border p-2 text-left transition-colors ${activeProfile === id ? 'border-brand bg-brand/15' : 'border-ink-700 bg-ink-950/35 hover:border-ink-500'}`}><span className="block text-[11px] font-semibold text-ink-100">{label}</span><span className="mt-1 block text-[9px] leading-snug text-ink-500">{note}</span>{activeProfile === id && <Check size={11} className="absolute right-2 top-2 text-brand-300" />}</button>)}
      </div>
    </section>
    <section className="rounded-xl border border-ink-800 bg-ink-950/30 p-3">
      <label className="flex items-center justify-between gap-3 font-medium text-ink-100"><span className="flex items-center gap-2"><Gauge size={13} className="text-brand-300" />Playback render limit</span>
        <select aria-label="Playback render limit" value={previewFps} onChange={e => setPreviewFps(Number(e.target.value) as PreviewFps)} className="h-8 rounded-lg border border-ink-600 bg-ink-800 px-2 text-[11px]">
          {[15, 30, 60].map(fps => <option key={fps} value={fps}>{fps} fps</option>)}
        </select>
      </label>
      <p className="mt-2 text-[10px] leading-relaxed text-ink-500">Caps preview compositing work. Audio, timeline timing and final export cadence remain unchanged.</p>
      <output className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-ink-800 bg-ink-900 px-2.5 py-2 text-[10px] text-ink-300" data-testid="render-metrics"><span>{metrics.width} × {metrics.height}</span><span>{metrics.renderMs.toFixed(1)} ms/frame</span><span>{metrics.frames} frames</span></output>
    </section>
    <section className="space-y-3 rounded-xl border border-ink-700 bg-ink-950/30 p-3" aria-label="Media proxies">
      <div className="flex items-start justify-between gap-3"><span><h4 className="flex items-center gap-2 font-semibold text-ink-100"><Layers3 size={13} className="text-brand-300" />Media proxies</h4><span className="mt-1 block text-[10px] text-ink-500">Temporary 854 px editing copies; exports always use originals.</span></span><label className="flex shrink-0 items-center gap-2 text-[10px] text-ink-300"><input aria-label="Use prepared proxies" type="checkbox" checked={proxies.enabled} onChange={e => useMediaProxies.setState({ enabled: e.target.checked })} className="accent-brand" />Enabled</label></div>
      <div className="grid grid-cols-3 gap-2 text-[9px]">
        <span className="rounded-lg border border-ink-800 bg-ink-900 p-2"><HardDrive size={11} className="mb-1 text-ink-400" /><strong className="block text-[11px] text-ink-100">{prepared}/{videos.length}</strong>prepared</span>
        <span className="rounded-lg border border-ink-800 bg-ink-900 p-2"><Gauge size={11} className="mb-1 text-ink-400" /><strong className="block text-[11px] text-ink-100">{cacheLabel}</strong>session cache</span>
        <span className="rounded-lg border border-ink-800 bg-ink-900 p-2"><Cpu size={11} className="mb-1 text-ink-400" /><strong className="block text-[11px] text-ink-100">{threads || '—'}</strong>browser threads</span>
      </div>
      <select aria-label="Proxy source video" value={asset?.id ?? ''} onChange={e => setSelected(e.target.value)} className="h-9 w-full min-w-0 rounded-lg border border-ink-700 bg-ink-800 px-2 text-[11px] outline-none focus:border-brand">
        {!videos.length && <option value="">Import a video to prepare proxies</option>}
        {videos.map(video => <option value={video.id} key={video.id}>{video.name}{proxies.entries[video.id]?.source === video.url ? ' · ready' : ''}</option>)}
      </select>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" disabled={!asset || !!proxies.active || !!batch} onClick={() => asset && void generateProxy(asset)} className="h-8 rounded-lg border border-ink-600 text-[10px] text-ink-200 disabled:opacity-40">Prepare selected</button>
        <button type="button" data-testid="prepare-all-proxies" disabled={!videos.length || prepared === videos.length || !!proxies.active || !!batch} onClick={() => void prepareAll()} className="h-8 rounded-lg border border-brand/40 bg-brand/10 text-[10px] font-medium text-brand-200 disabled:opacity-40">Prepare all</button>
        <button type="button" disabled={!Object.keys(proxies.entries).length && !proxies.active} onClick={clearProxies} className="h-8 rounded-lg border border-ink-700 text-[10px] text-ink-400 disabled:opacity-40">Clear cache</button>
      </div>
      {(proxies.active || batch) && <div role="status" className="rounded-lg border border-brand/20 bg-brand/5 p-2 text-[10px] text-ink-300"><div className="mb-1 flex justify-between"><span>{batch ? `Preparing ${Math.min(batch.done + 1, batch.total)} of ${batch.total}` : 'Preparing selected proxy'}</span><button type="button" onClick={stopPreparing} className="text-amber-300">Cancel</button></div><progress className="h-1.5 w-full accent-brand" value={proxies.progress} max={1} /></div>}
      {proxies.error && <p role="alert" className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-2 text-[10px] text-amber-200">{proxies.error}</p>}
      <p className="text-[9px] leading-relaxed text-ink-500">Browser proxy preparation supports sources up to five minutes and a 256 MB session cache. Keep this tab visible while preprocessing. Original audio stays attached during preview.</p>
    </section>
  </div>
}
