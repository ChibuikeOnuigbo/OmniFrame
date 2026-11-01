import { useMediaProxies, cancelProxy } from '../lib/mediaProxies'
import { useEditor } from '../store'

export function ProxyProgress() {
  const active = useMediaProxies(s => s.active)
  const progress = useMediaProxies(s => s.progress)
  const name = useEditor(s => s.assets.find(a => a.id === active)?.name)
  if (!active) return null
  return <aside role="status" aria-label="Proxy preparation" className="fixed bottom-4 left-4 z-[90] w-64 max-w-[calc(100vw-32px)] rounded-lg border border-ink-600 bg-ink-900 p-3 text-xs shadow-xl">
    <div className="flex items-center justify-between gap-2"><strong>Preparing proxy · {Math.round(progress * 100)}%</strong><button type="button" onClick={cancelProxy} className="text-brand-300">Cancel</button></div>
    <div className="mt-1 truncate text-ink-300">{name}</div>
    <progress aria-label="Proxy preparation progress" value={progress} max={1} className="mt-2 w-full" />
  </aside>
}
