/**
 * Browser wrapper for the native DSP core — public/wasm/omni-dsp.wasm,
 * compiled from native/dsp-core/omni_dsp.cpp (C++, wasm32, freestanding)
 * by scripts/build-dsp-wasm.sh.
 *
 * Why native: the hot DSP loops of the pipeline (speed-normalize resample,
 * least-squares stem de-leak, shift-averaging of separation passes, peak
 * safety scaling) are pure number crunching over millions of samples. The
 * compiled core runs the same algorithms 2-3x faster than the JIT'd JS
 * fallbacks (qa/reports/native-dsp-parity.json) with bit-identical output
 * (max|diff| 0 on every op — same double arithmetic, same float32
 * rounding points).
 *
 * Contract — every public op is opportunistic:
 *   - If the module is loaded, the op runs natively and returns the result.
 *   - If not (fetch/instantiate failed, or not yet warm for sync callers),
 *     it returns null / no-ops, and the caller uses the pure-JS fallback
 *     in resample.js / demucs/index.ts / voiceIsolation.ts. Audio output is
 *     identical either way — that equivalence is asserted by
 *     qa/native-dsp-parity.mjs and E2E case N.
 *
 * Memory model (flat ABI, no allocator): the module exports its linear
 * memory and `__heap_base`. Each call bumps a cursor from __heap_base,
 * grows memory once if needed, builds views AFTER the grow (grow detaches
 * existing ArrayBuffers), runs, and resets the cursor. Scratch lifetime is
 * a single synchronous call — nothing persists below __heap_base except
 * the module's static polyphase table.
 */

const WASM_URL = '/wasm/omni-dsp.wasm'

interface DspExports {
  memory: WebAssembly.Memory
  omni_resample: (inPtr: number, inLen: number, rate: number, outPtr: number, outLen: number) => void
  omni_ls_leakage: (targetPtr: number, refPtr: number, len: number) => number
  omni_average_passes: (passesPtr: number, passCount: number, len: number, outPtr: number, missingPtr: number) => number
  omni_peak_scale: (aPtr: number, bPtr: number, len: number, threshold: number, target: number) => number
  omni_normalize: (aPtr: number, bPtr: number, len: number, targetRms: number, peakCeil: number, silenceRms: number) => number
  __heap_base: WebAssembly.Global
}

let mod: DspExports | null = null
let loadPromise: Promise<DspExports | null> | null = null

/** Starts (or joins) the one-time module load. Resolves false on any failure. */
export function initNativeDsp(): Promise<boolean> {
  if (mod) return Promise.resolve(true)
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const res = await fetch(WASM_URL)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const { instance } = await WebAssembly.instantiate(await res.arrayBuffer(), {})
        const e = instance.exports as unknown as DspExports
        if (!e.memory || !e.omni_resample || !e.omni_ls_leakage || !e.omni_average_passes || !e.omni_peak_scale || !e.omni_normalize || !e.__heap_base) {
          throw new Error('missing expected exports')
        }
        mod = e
        return e
      } catch (err) {
        console.warn('[dspNative] native DSP core unavailable, using JS fallback:', (err as Error).message)
        return null
      }
    })()
  }
  return loadPromise.then((m) => m !== null)
}

/** The loaded module, or null — for synchronous callers (peak scaling). */
function loaded(): DspExports | null {
  return mod
}

/** True once the native core is instantiated (used by tests and E2E). */
export function nativeDspActive(): boolean {
  return mod !== null
}

const PAGE = 65536

/** Grows module memory so [heapBase, byteEnd) is addressable. Returns heap base. */
function ensureCapacity(m: DspExports, byteEnd: number): number {
  const base = m.__heap_base.value
  const pages = Math.ceil((base + byteEnd) / PAGE)
  const have = m.memory.buffer.byteLength / PAGE
  if (pages > have) m.memory.grow(pages - have)
  return base
}

/**
 * Runs `fn` natively, degrading to null (JS fallback) if the linear memory
 * can't be grown to fit — e.g. a very long clip on a memory-tight machine.
 * The fallback is bit-identical, so this never changes the audio.
 */
function tryNative<T>(fn: () => T): T | null {
  try {
    return fn()
  } catch (err) {
    if (err instanceof RangeError) {
      console.warn('[dspNative] native op out of memory, using JS fallback')
      return null
    }
    throw err
  }
}

/**
 * Native resample — drop-in for resampleChannels() from
 * src/lib/demucs/resample.js (same 32-tap Blackman-windowed sinc, 2048
 * phases, per-phase DC normalization; length = ceil(len / rate)).
 * Returns null if the native core isn't loaded.
 */
export function nativeResampleChannels(
  channels: Float32Array[],
  rate: number,
): { channelData: Float32Array[]; length: number } | null {
  const m = loaded()
  if (!m || channels.length === 0) return null
  return tryNative(() => {
  const n = channels[0].length
  if (channels.some((c) => c.length !== n)) return null
  if (!Number.isFinite(rate) || rate <= 0) return null
  const outLen = Math.max(1, Math.ceil(n / rate))

  const base = ensureCapacity(m, (n + outLen) * 4)
  const inView = new Float32Array(m.memory.buffer, base, n)
  const outView = new Float32Array(m.memory.buffer, base + n * 4, outLen)
  const out: Float32Array[] = []
  for (const ch of channels) {
    inView.set(ch)
    m.omni_resample(base, n, rate, base + n * 4, outLen)
    out.push(Float32Array.from(outView))
  }
  return { channelData: out, length: outLen }
  })
}

/**
 * Native least-squares de-leak — drop-in for removeLsLeakage() in
 * src/lib/demucs/index.ts: for each channel pair subtracts a·ref from
 * target, a = <t,r>/<r,r> clamped to ±0.5, skipping silent references.
 * Mutates `target` in place, exactly like the JS loop. Returns the
 * per-channel coefficients, or null if the native core isn't loaded.
 */
export function nativeRemoveLsLeakage(target: Float32Array[], ref: Float32Array[]): number[] | null {
  const m = loaded()
  if (!m) return null
  return tryNative(() => {
  const pairs: number[] = []
  const count = Math.min(target.length, ref.length)
  let maxLen = 0
  for (let c = 0; c < count; c++) maxLen = Math.max(maxLen, target[c].length, ref[c].length)
  if (maxLen === 0) return []
  const base = ensureCapacity(m, maxLen * 8)
  const tView = new Float32Array(m.memory.buffer, base, maxLen)
  const rView = new Float32Array(m.memory.buffer, base + maxLen * 4, maxLen)
  for (let c = 0; c < count; c++) {
    const t = target[c]
    const r = ref[c]
    const len = Math.min(t.length, r.length)
    if (len === 0) { pairs.push(0); continue }
    tView.set(len === t.length ? t : t.subarray(0, len))
    rView.set(len === r.length ? r : r.subarray(0, len))
    const a = m.omni_ls_leakage(base, base + maxLen * 4, len)
    pairs.push(a)
    if (a !== 0) {
      // copy back the de-leaked region (in-place contract of removeLsLeakage)
      t.set(tView.subarray(0, len), 0)
    }
  }
  return pairs
  })
}

/**
 * Native pass averaging — the finite-aware average of the shift-averaged
 * separation passes (pass-major layout: passes[p][i]). Returns per-sample
 * mean over finite values, a missing-flag row (0 = finite pass existed,
 * 1 = every pass was non-finite), and how many samples had no finite pass.
 * Null if the native core isn't loaded.
 */
export function nativeAveragePasses(
  passes: Float32Array[],
  len: number,
): { out: Float32Array; missing: Uint8Array; missingCount: number } | null {
  const m = loaded()
  if (!m || passes.length === 0 || len <= 0) return null
  return tryNative(() => {
  if (passes.some((p) => p.length !== len)) return null

  const base = ensureCapacity(m, passes.length * len * 4 + len * 4 + len)
  const src = new Float32Array(m.memory.buffer, base, passes.length * len)
  for (let p = 0; p < passes.length; p++) src.set(passes[p], p * len)
  const outPtr = base + passes.length * len * 4
  const missingPtr = outPtr + len * 4
  const missingCount = m.omni_average_passes(base, passes.length, len, outPtr, missingPtr)
  return {
    out: Float32Array.from(new Float32Array(m.memory.buffer, outPtr, len)),
    missing: Uint8Array.from(new Uint8Array(m.memory.buffer, missingPtr, len)),
    missingCount,
  }
  })
}

/**
 * Native peak-safety scaling — the encode policy of
 * encodeAudioBufferToWav() in src/lib/voiceIsolation.ts: if either channel
 * exceeds `threshold`, scale both by `target / peak` (in place) and return
 * the gain; otherwise return 1. Null if the native core isn't loaded.
 */
export function nativePeakScale(a: Float32Array, b: Float32Array, threshold = 0.999, target = 0.98): number | null {
  const m = loaded()
  if (!m) return null
  return tryNative(() => {
  const len = Math.min(a.length, b.length)
  if (len === 0) return 1
  const base = ensureCapacity(m, a.length * 4 + b.length * 4)
  const aView = new Float32Array(m.memory.buffer, base, a.length)
  const bView = new Float32Array(m.memory.buffer, base + a.length * 4, b.length)
  aView.set(a)
  bView.set(b)
  const g = m.omni_peak_scale(base, base + a.length * 4, len, threshold, target)
  if (g !== 1) {
    a.set(aView)
    b.set(bView)
  }
  return g
  })
}

/**
 * Native output finalization — DC block (one-pole ~15 Hz) + loudness
 * normalization to `targetRms` with a `peakCeil` guard, +12/−6 dB gain
 * window, and near-silence skipping (`silenceRms`): keep_vocal of an
 * instrumental input must stay near-silent instead of being amplified
 * into separation noise. Mutates both channels in place; returns the
 * applied gain (1 = untouched). Null if the native core isn't loaded.
 */
export function nativeNormalize(
  a: Float32Array,
  b: Float32Array,
  targetRms: number,
  peakCeil: number,
  silenceRms: number,
): number | null {
  const m = loaded()
  if (!m) return null
  return tryNative(() => {
    const len = Math.min(a.length, b.length)
    if (len === 0) return 1
    const base = ensureCapacity(m, a.length * 4 + b.length * 4)
    const aView = new Float32Array(m.memory.buffer, base, a.length)
    const bView = new Float32Array(m.memory.buffer, base + a.length * 4, b.length)
    aView.set(a)
    bView.set(b)
    const g = m.omni_normalize(base, base + a.length * 4, len, targetRms, peakCeil, silenceRms)
    a.set(aView)
    b.set(bView)
    return g
  })
}
