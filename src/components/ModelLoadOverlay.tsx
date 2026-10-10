/**
 * Model-load progress overlay — the visible half of
 * src/lib/modelLoadStore.ts.
 *
 * A small stack of cards in the bottom-right corner showing every model
 * the web app is currently downloading/compiling: real byte counts and
 * speed while downloading (smoothed, monotonic — see the store), a calm
 * "compiling neural network" state while onnxruntime builds the session,
 * a brief green check on success, sticky red on failure. Desktop mode uses
 * the same cards — models load from the local bundle, so they flash by.
 *
 * Non-modal by design: the user can keep editing while weights arrive.
 */
import { CheckCircle2, Database, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { fmtMb, useModelLoadStore, type ModelLoadEntry } from '../lib/modelLoadStore'

function phaseLine(e: ModelLoadEntry): { title: string; detail: string } {
  if (e.phase === 'error') return { title: 'Could not load', detail: e.error ?? 'Unknown error' }
  if (e.phase === 'ready') return { title: 'Ready', detail: 'Cached for this session' }
  if (e.phase === 'compile') return { title: 'Compiling neural network…', detail: 'Optimising for this device' }
  if (e.fromDisk) return { title: 'Loading from disk…', detail: e.totalBytes ? `${fmtMb(e.receivedBytes)} / ${fmtMb(e.totalBytes)}` : fmtMb(e.receivedBytes) }
  const pctKnown = e.totalBytes != null && e.totalBytes > 0
  const speed = e.speedBps > 0 ? ` · ${fmtMb(e.speedBps)}/s` : ''
  if (pctKnown) return { title: 'Downloading model…', detail: `${fmtMb(e.receivedBytes)} / ${fmtMb(e.totalBytes!)}${speed}` }
  return { title: 'Downloading model…', detail: `${fmtMb(e.receivedBytes)}${e.approxMb ? ` of ~${e.approxMb} MB` : ''}${speed}` }
}

function Card({ e }: { e: ModelLoadEntry }) {
  const dismiss = useModelLoadStore((s) => s.dismiss)
  const [leaving, setLeaving] = useState(false)
  const { title, detail } = phaseLine(e)
  const isError = e.phase === 'error'
  const isReady = e.phase === 'ready'

  // fade the card out after it lingered in ready (the store dismisses the
  // entry; this just animates the unmount)
  useEffect(() => {
    if (isReady) {
      const t = setTimeout(() => setLeaving(true), 1600)
      return () => clearTimeout(t)
    }
  }, [isReady])

  return (
    <div
      data-testid="model-load-card"
      data-model={e.id}
      data-phase={e.phase}
      className={`w-[300px] rounded-xl border bg-ink-850/95 backdrop-blur px-3.5 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.5)] transition-all duration-300 ${
        isError ? 'border-red-500/60' : isReady ? 'border-emerald-500/50' : 'border-ink-600'
      } ${leaving ? 'opacity-0 translate-y-1' : 'opacity-100'}`}
    >
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 shrink-0 ${isError ? 'text-red-400' : isReady ? 'text-emerald-400' : 'text-brand'}`}>
          {isReady ? <CheckCircle2 size={16} /> : <Database size={16} className={e.phase !== 'error' ? 'animate-pulse' : ''} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[13px] font-semibold text-ink-100">{e.label}</span>
            <span className={`shrink-0 text-[11px] tabular-nums ${isError ? 'text-red-300' : 'text-ink-300'}`}>
              {isError ? '' : `${Math.round(e.displayPct)}%`}
            </span>
          </div>
          <div className={`mt-0.5 truncate text-[11px] ${isError ? 'text-red-300/90' : 'text-ink-400'}`}>
            {title} — {detail}
          </div>
          <div
            data-testid="model-load-bar"
            className={`mt-2 h-1.5 overflow-hidden rounded-full ${isError ? 'bg-red-950' : 'bg-ink-700/70'}`}
          >
            {!isError && (
              <div
                data-testid="model-load-fill"
                className={`h-full rounded-full ${isReady ? 'bg-emerald-400' : 'bg-brand'} ${
                  e.phase === 'compile' ? 'animate-pulse' : ''
                }`}
                style={{ width: `${e.displayPct}%`, transition: 'width 180ms linear' }}
              />
            )}
          </div>
        </div>
        {isError && (
          <button
            aria-label={`Dismiss ${e.label} error`}
            onClick={() => dismiss(e.id)}
            className="shrink-0 rounded p-1 text-ink-400 transition-colors hover:bg-ink-700 hover:text-white"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

/** Fixed bottom-right stack of live model-load cards. Rendered once by Studio. */
export function ModelLoadOverlay() {
  const entries = useModelLoadStore((s) => s.entries)
  const prevCount = useRef(entries.length)
  const [mounted, setMounted] = useState(entries.length > 0)

  // keep the container mounted briefly while the last card fades out
  useEffect(() => {
    if (entries.length > 0) {
      setMounted(true)
      prevCount.current = entries.length
    } else if (prevCount.current > 0) {
      const t = setTimeout(() => setMounted(false), 400)
      return () => clearTimeout(t)
    }
  }, [entries.length])

  if (!mounted) return null
  return (
    <div
      data-testid="model-load-overlay"
      className="pointer-events-none fixed bottom-4 right-4 z-[85] flex flex-col-reverse gap-2"
    >
      {entries.map((e) => (
        <div key={e.id} className="pointer-events-auto">
          <Card e={e} />
        </div>
      ))}
    </div>
  )
}
