/**
 * Model-load progress system — one store, one fetcher, every model.
 *
 * Why: on the web every AI feature has to bring its own weights before it
 * can run — Demucs v4 is 174 MB, the background-removal catalog models are
 * 4-170 MB, and onnxruntime's InferenceSession.create(url) reports NOTHING
 * while it downloads and compiles them. A user clicking "isolate vocals"
 * used to see a single frozen line for tens of seconds. This module gives
 * every model load a real, smooth, well-behaved progress bar:
 *
 *   - REAL progress whenever it exists: the fetcher streams the response
 *     body and counts bytes (Content-Length known → exact %).
 *   - SMOOTH by construction: the displayed percentage is a monotonic
 *     EMA of the real target (network bursts don't jump the bar) with a
 *     guaranteed minimum creep rate (it never visually freezes).
 *   - SIMULATED only where reality is unmeurable: unknown Content-Length
 *     and the post-download "compiling neural network" phase creep
 *     asymptotically toward 97% and snap to 100% the moment the phase
 *     actually completes — the bar never claims 100% before it's true,
 *     never goes backward, and never stalls.
 *   - Desktop mode: the same pipeline runs, but models load from the
 *     local bundle, so the bar flashes by with real (fast) progress —
 *     nothing is artificially slowed down.
 *
 * Usage (see rotoModels.ts / aiDenoise.ts / vad.ts / demucs):
 *   const { bytes } = await fetchModelBytes(url, { id, label, approxMb })
 *   markModelCompiling(id)
 *   const session = await ort.InferenceSession.create(bytes, …)
 *   markModelReady(id)
 *
 * The UI lives in src/components/ModelLoadOverlay.tsx (bottom-right stack,
 * auto-dismiss on success, sticky on error).
 */
import { create } from 'zustand'
import { isDesktopApp } from './desktop'

export type ModelLoadPhase = 'download' | 'compile' | 'ready' | 'error'

export interface ModelLoadEntry {
  id: string
  label: string
  /** True while at least one of download/compile is running. */
  phase: ModelLoadPhase
  receivedBytes: number
  totalBytes: number | null
  approxMb: number | null
  /** What the bar renders — monotonic, EMA-smoothed, 0..100. */
  displayPct: number
  /** Target the EMA chases (real %, or the simulated creep). */
  targetPct: number
  speedBps: number
  startedAt: number
  lastTickAt: number
  fromDisk: boolean
  error?: string
}

interface ModelLoadStore {
  entries: ModelLoadEntry[]
  begin: (id: string, label: string, opts?: { approxMb?: number | null }) => string
  patch: (id: string, patch: Partial<ModelLoadEntry>) => void
  /** Byte-level update from the streaming fetcher. */
  reportBytes: (id: string, received: number, total: number | null) => void
  markCompiling: (id: string) => void
  markReady: (id: string) => void
  markFailed: (id: string, message: string) => void
  dismiss: (id: string) => void
}

/** How long a finished card lingers so the user sees it completed. */
const READY_LINGER_MS = 2200

export const useModelLoadStore = create<ModelLoadStore>((set, get) => ({
  entries: [],
  begin: (id, label, opts) => {
    const existing = get().entries.find((e) => e.id === id)
    if (existing && (existing.phase === 'download' || existing.phase === 'compile')) return id
    const now = performance.now()
    set((s) => ({
      entries: [
        ...s.entries.filter((e) => e.id !== id),
        {
          id,
          label,
          phase: 'download' as ModelLoadPhase,
          receivedBytes: 0,
          totalBytes: null,
          approxMb: opts?.approxMb ?? null,
          displayPct: 0,
          targetPct: 0,
          speedBps: 0,
          startedAt: now,
          lastTickAt: now,
          fromDisk: isDesktopApp(),
        },
      ],
    }))
    startTicker()
    return id
  },
  patch: (id, p) =>
    set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, ...p } : e)) })),
  reportBytes: (id, received, total) => {
    const e = get().entries.find((x) => x.id === id)
    if (!e || e.phase !== 'download') return
    const dt = Math.max(1, performance.now() - e.lastTickAt) / 1000
    const speed = (Math.max(0, received - e.receivedBytes) / dt) * 0.7 + e.speedBps * 0.3
    const realPct = total && total > 0 ? Math.min(100, (received / total) * 100) : null
    set((s) => ({
      entries: s.entries.map((x) =>
        x.id === id
          ? {
              ...x,
              receivedBytes: received,
              totalBytes: total ?? x.totalBytes,
              speedBps: speed,
              targetPct: realPct ?? x.targetPct,
            }
          : x,
      ),
    }))
  },
  markCompiling: (id) => {
    set((s) => ({
      entries: s.entries.map((e) => (e.id === id ? { ...e, phase: 'compile' as ModelLoadPhase } : e)),
    }))
  },
  markReady: (id) => {
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === id ? { ...e, phase: 'ready' as ModelLoadPhase, displayPct: 100, targetPct: 100, speedBps: 0 } : e,
      ),
    }))
    setTimeout(() => {
      const e = useModelLoadStore.getState().entries.find((x) => x.id === id)
      if (e?.phase === 'ready') get().dismiss(id)
    }, READY_LINGER_MS)
  },
  markFailed: (id, message) => {
    set((s) => ({
      entries: s.entries.map((e) => (e.id === id ? { ...e, phase: 'error' as ModelLoadPhase, error: message } : e)),
    }))
  },
  dismiss: (id) => {
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }))
    if (!useModelLoadStore.getState().entries.some((e) => e.phase === 'download' || e.phase === 'compile')) {
      stopTicker()
    }
  },
}))

// ---------------------------------------------------------------------------
// The ticker — advances every active load's simulated/smoothed percentage.
// One interval for all loads; started on first begin, stopped when idle.
// ---------------------------------------------------------------------------

let ticker: ReturnType<typeof setInterval> | null = null
/** Minimum visible progress per tick so the bar never freezes (~1.2%/s). */
const MIN_CREEP_PER_TICK = 0.15
/** Simulated asymptote: never claim more than this before it's real. */
const SIM_CEIL = 97
const TICK_MS = 120

function simulatedTarget(e: ModelLoadEntry, now: number): number {
  // time-based creep toward SIM_CEIL; bigger models creep slower (tau from
  // approxMb) but the minimum creep rate below keeps it visibly alive
  const tau = e.approxMb ? Math.min(14, Math.max(2, e.approxMb / 14)) : 6
  const t = (now - e.startedAt) / 1000
  return SIM_CEIL * (1 - Math.exp(-t / tau))
}

function startTicker() {
  if (ticker) return
  ticker = setInterval(() => {
    const { entries, patch } = useModelLoadStore.getState()
    const now = performance.now()
    let active = 0
    for (const e of entries) {
      if (e.phase !== 'download' && e.phase !== 'compile') continue
      active++
      // target: real % when known, otherwise the simulated creep
      let target = e.targetPct
      if (e.phase === 'compile') {
        // unmeasurable phase: creep from wherever download left us
        target = Math.max(e.targetPct, simulatedTarget(e, now) * 0.98 + 2)
      } else if (e.totalBytes == null || e.targetPct <= 0) {
        target = simulatedTarget(e, now)
      }
      // monotonic EMA + guaranteed minimum creep, capped below SIM_CEIL
      const ema = e.displayPct + (target - e.displayPct) * 0.22
      const next = Math.min(SIM_CEIL, Math.max(e.displayPct + MIN_CREEP_PER_TICK, ema))
      if (next !== e.displayPct) patch(e.id, { displayPct: next, targetPct: Math.max(e.targetPct, target), lastTickAt: now })
    }
    if (active === 0) stopTicker()
  }, TICK_MS)
}

function stopTicker() {
  if (ticker) {
    clearInterval(ticker)
    ticker = null
  }
}

// ---------------------------------------------------------------------------
// Streaming fetcher — real byte counts whenever the server provides them.
// ---------------------------------------------------------------------------

export interface ModelFetchMeta {
  id: string
  label: string
  approxMb?: number | null
  /**
   * Raw byte callback for callers that can't use the store directly
   * (e.g. inside a worker) — receives (loaded, total) per chunk.
   */
  onBytes?: (loaded: number, total: number | null) => void
}

/** Human-readable byte size for the UI. */
export function fmtMb(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

/**
 * Fetches model bytes with live progress. Updates the model-load store
 * (id/label) and streams real byte counts; falls back to the smooth
 * simulation when the body can't be streamed or the length is unknown.
 * The caller owns the compile phase: markModelCompiling → create session →
 * markModelReady (see the module doc).
 */
export async function fetchModelBytes(url: string, meta: ModelFetchMeta): Promise<{ bytes: ArrayBuffer; id: string }> {
  const { begin, reportBytes, markFailed, dismiss } = useModelLoadStore.getState()
  begin(meta.id, meta.label, { approxMb: meta.approxMb ?? null })
  const fail = (message: string) => {
    markFailed(meta.id, message)
    throw new Error(message)
  }
  let res: Response
  try {
    res = await fetch(url)
  } catch (err) {
    return fail(`Network error loading ${meta.label}: ${(err as Error).message}`)
  }
  if (!res.ok) return fail(`${meta.label} not available (HTTP ${res.status})`)

  const totalHeader = res.headers.get('content-length')
  const total = totalHeader ? parseInt(totalHeader, 10) : null

  // stream with real byte counts when possible
  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let received = 0
    let lastPost = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.byteLength
      // throttle store writes (and worker postMessage) to ~8/s
      const now = performance.now()
      if (now - lastPost > 120 || received === total) {
        lastPost = now
        reportBytes(meta.id, received, total)
        meta.onBytes?.(received, total)
      }
    }
    const bytes = new Uint8Array(received)
    let off = 0
    for (const c of chunks) {
      bytes.set(c, off)
      off += c.byteLength
    }
    reportBytes(meta.id, received, received)
    meta.onBytes?.(received, received)
    return { bytes: bytes.buffer, id: meta.id }
  }

  // no streaming (shouldn't happen in browsers, but be safe): arrayBuffer
  // with pure simulated progress — the ticker covers it
  const bytes = await res.arrayBuffer()
  reportBytes(meta.id, bytes.byteLength, bytes.byteLength)
  meta.onBytes?.(bytes.byteLength, bytes.byteLength)
  return { bytes, id: meta.id }
}

/** Convenience wrapper for the common "fetch → compile → session" flow. */
export async function withModelLoadProgress<T>(
  url: string,
  meta: ModelFetchMeta,
  create: (bytes: ArrayBuffer) => Promise<T>,
): Promise<T> {
  const { bytes, id } = await fetchModelBytes(url, meta)
  const { markCompiling, markReady, markFailed } = useModelLoadStore.getState()
  markCompiling(id)
  try {
    const result = await create(bytes)
    markReady(id)
    return result
  } catch (err) {
    markFailed(id, (err as Error).message)
    throw err
  }
}
