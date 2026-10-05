/**
 * RotoMask model registry.
 *
 * Sammie-Roto 2 (the reference tool this feature is modelled on) wraps SAM2,
 * MatAnyone, VideoMaMa, MiniMax-Remover and ProPainterX behind one GUI with a
 * model picker. OmniFrame's RotoMask takes the same shape:
 *
 *   - a built-in family of small OmniRoto ONNX models trained in-repo
 *     (scripts/python/train_roto_models.py) on human, anime and hair
 *     imagery — they ship with the app and run in the browser via
 *     onnxruntime-web, exactly like omni-denoise-v1;
 *   - a catalog of well-known community models (U²-Net family, IS-Net,
 *     Silueta…) that users can import from a local file or a URL —
 *     licences differ per model, so we do not bundle them;
 *   - any user-dropped .onnx is auto-profiled (input shape, output map) and
 *     run through the same saliency runner.
 *
 * Model contract for the saliency runner: input [1,3,H,W] RGB in 0..1, one
 * output map [1,1,H,W] (or [1,H,W]) of subject likelihood. Everything in the
 * built-in family and the catalog satisfies this.
 */

import type * as Ort from 'onnxruntime-web'
import type { MaskBitmap } from './rotoBrush'

export type RotoModelDomain = 'human' | 'anime' | 'hair' | 'general' | 'imported'

export interface RotoModelDescriptor {
  id: string
  label: string
  domain: RotoModelDomain
  /** Square input resolution the model expects. */
  inputSize: number
  /** Where the bytes come from. */
  url: string
  source: 'builtin' | 'imported-file' | 'imported-url' | 'catalog'
  notes?: string
  /** Filled after a successful load. */
  loadedAt?: number
  /** Runner contract. 'saliency' (default) = whole-image subject map;
   * 'sam' = promptable encoder/decoder driven by the user's clicks. */
  kind?: 'saliency' | 'sam'
  /** SAM only: decoder ONNX url (url is the encoder). */
  decoderUrl?: string
}

/**
 * SAM Mobile — the promptable Segment Anything engine (MobileSAM: TinyViT
 * encoder + SAM decoder). The reference tool's headline model, now the
 * RotoMask default recommendation: the user's accumulated clicks are the
 * prompt, so it isolates precisely what was clicked (pale-on-white, busy
 * photos — the cases saliency models struggle with).
 */
export const SAM_MOBILE_MODEL: RotoModelDescriptor = {
  id: 'sam-mobile-v1',
  label: 'SAM Mobile · Segment Anything',
  domain: 'general',
  inputSize: 1024,
  url: '/models/sam-mobile-encoder.onnx',
  decoderUrl: '/models/sam-mobile-decoder.onnx',
  kind: 'sam',
  source: 'builtin',
  notes: 'Promptable: your clicks drive the mask. Apache-2.0 (MobileSAM/SAM).',
}

/** The OmniRoto family — trained in scripts/python/train_roto_models.py. */
export const BUILTIN_ROTO_MODELS: RotoModelDescriptor[] = [
  SAM_MOBILE_MODEL,
  {
    id: 'omni-roto-general-v1',
    label: 'OmniRoto · General',
    domain: 'general',
    inputSize: 128,
    url: '/models/omni-roto-general-v1.onnx',
    source: 'builtin',
    notes: 'Trained in-repo on mixed subjects (objects, people, scenes).',
  },
  {
    id: 'omni-roto-human-v1',
    label: 'OmniRoto · Human',
    domain: 'human',
    inputSize: 128,
    url: '/models/omni-roto-human-v1.onnx',
    source: 'builtin',
    notes: 'Trained in-repo on full-body and portrait photos of people.',
  },
  {
    id: 'omni-roto-anime-v1',
    label: 'OmniRoto · Anime',
    domain: 'anime',
    inputSize: 128,
    url: '/models/omni-roto-anime-v1.onnx',
    source: 'builtin',
    notes: 'Trained in-repo on anime characters (including the Death Note chibi set).',
  },
  {
    id: 'omni-roto-hair-v1',
    label: 'OmniRoto · Hair',
    domain: 'hair',
    inputSize: 128,
    url: '/models/omni-roto-hair-v1.onnx',
    source: 'builtin',
    notes: 'Trained in-repo on hair-dominant portraits for strand-level edges.',
  },
]

/**
 * Community models that fit the saliency runner. NOT bundled — licences are
 * model-specific (most are Apache-2.0 / non-commercial research). The user
 * imports the .onnx they downloaded; we keep only the recipe.
 */
export const ROTO_MODEL_CATALOG: (RotoModelDescriptor & { homepage: string; approxMb: number })[] = [
  {
    id: 'u2net',
    label: 'U²-Net (full)',
    domain: 'general',
    inputSize: 320,
    url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx',
    source: 'catalog',
    homepage: 'https://github.com/xuebinqin/U-2-Net',
    approxMb: 176,
    notes: 'The classic salient-object segmenter. Best quality, heaviest.',
  },
  {
    id: 'u2netp',
    label: 'U²-Net (lite)',
    domain: 'general',
    inputSize: 320,
    url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx',
    source: 'catalog',
    homepage: 'https://github.com/xuebinqin/U-2-Net',
    approxMb: 4.7,
    notes: '4.7 MB portable version of U²-Net — closest in spirit to OmniRoto.',
  },
  {
    id: 'isnet-general-use',
    label: 'IS-Net · General',
    domain: 'general',
    inputSize: 1024,
    url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx',
    source: 'catalog',
    homepage: 'https://github.com/xuebinqin/DIS',
    approxMb: 176,
    notes: 'Dichotomous Image Segmentation — very crisp boundaries.',
  },
  {
    id: 'isnet-anime',
    label: 'IS-Net · Anime',
    domain: 'anime',
    inputSize: 1024,
    url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-anime.onnx',
    source: 'catalog',
    homepage: 'https://github.com/SkyTNT/anime-segmentation',
    approxMb: 176,
    notes: 'Fine-tuned on anime illustrations — the "anime model" of the reference tool.',
  },
  {
    id: 'silueta',
    label: 'Silueta (human)',
    domain: 'human',
    inputSize: 320,
    url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/silueta.onnx',
    source: 'catalog',
    homepage: 'https://github.com/altyrq/silueta',
    approxMb: 4.5,
    notes: 'Small human-silhouette segmenter.',
  },
]

type OrtModule = typeof import('onnxruntime-web')
let ortModule: OrtModule | null = null

async function getOrt(): Promise<OrtModule> {
  if (!ortModule) ortModule = await import('onnxruntime-web')
  return ortModule
}

const sessionCache = new Map<string, Promise<Ort.InferenceSession>>()

/** Lazily create (and cache) the ONNX session for a model. */
export async function getRotoSession(model: RotoModelDescriptor): Promise<Ort.InferenceSession> {
  let p = sessionCache.get(model.id)
  if (!p) {
    p = (async () => {
      const ort = await getOrt()
      ort.env.wasm.numThreads = 1
      ort.env.wasm.simd = true
      ort.env.wasm.wasmPaths = import.meta.env.DEV ? '/ort-runtime/' : '/ort/'
      return await ort.InferenceSession.create(model.url, { executionProviders: ['wasm'] })
    })()
    sessionCache.set(model.id, p)
    p.catch(() => sessionCache.delete(model.id))
  }
  return p
}

export function dropRotoSession(modelId: string): void {
  sessionCache.delete(modelId)
  samSessionCache.delete(modelId)
}

/** SAM sessions: encoder (image -> embedding) + decoder (embedding + points -> mask). */
export interface RotoSamSessions {
  encoder: Ort.InferenceSession
  decoder: Ort.InferenceSession
}

const samSessionCache = new Map<string, Promise<RotoSamSessions>>()

/** Lazily create (and cache) the encoder+decoder session pair for a SAM model. */
export async function getRotoSamSessions(model: RotoModelDescriptor): Promise<RotoSamSessions> {
  let p = samSessionCache.get(model.id)
  if (!p) {
    p = (async () => {
      const ort = await getOrt()
      ort.env.wasm.numThreads = 1
      ort.env.wasm.simd = true
      ort.env.wasm.wasmPaths = import.meta.env.DEV ? '/ort-runtime/' : '/ort/'
      const encoderUrl = model.url
      const decoderUrl = model.decoderUrl ?? model.url.replace('encoder', 'decoder')
      const [encoder, decoder] = await Promise.all([
        ort.InferenceSession.create(encoderUrl, { executionProviders: ['wasm'] }),
        ort.InferenceSession.create(decoderUrl, { executionProviders: ['wasm'] }),
      ])
      return { encoder, decoder }
    })()
    samSessionCache.set(model.id, p)
    p.catch(() => samSessionCache.delete(model.id))
  }
  return p
}

/**
 * Import a model from a local file: create it, probe input/output shapes so
 * arbitrary saliency ONNX files work without code changes.
 */
export async function importRotoModelFromFile(file: File): Promise<RotoModelDescriptor> {
  const buf = await file.arrayBuffer()
  const ort = await getOrt()
  ort.env.wasm.numThreads = 1
  const probe = await ort.InferenceSession.create(buf, { executionProviders: ['wasm'] })
  const inputMeta = probe.inputNames[0]
  if (!inputMeta) throw new Error('model has no inputs')
  const meta0 = (
    probe as unknown as { inputMetadata?: Array<{ dimensions?: (number | string)[] }> }
  ).inputMetadata?.[0]
  const size = meta0?.dimensions?.find((d) => typeof d === 'number' && d > 32)
  const inputSize = typeof size === 'number' && size > 32 ? size : 320
  await probe.release()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/octet-stream' }))
  const id = `imported-${file.name.replace(/\.onnx$/i, '').replace(/[^a-z0-9-]+/gi, '_').slice(0, 40)}-${Date.now().toString(36)}`
  return {
    id,
    label: file.name.replace(/\.onnx$/i, ''),
    domain: 'imported',
    inputSize,
    url,
    source: 'imported-file',
    notes: `Imported ${file.name} · detected ${inputSize}px input`,
  }
}

/** Import from a URL (e.g. one of the catalog entries). */
export function rotoModelFromUrl(id: string, label: string, url: string, inputSize: number, domain: RotoModelDomain = 'imported'): RotoModelDescriptor {
  return { id: `url-${id}`, label, domain, inputSize, url, source: 'imported-url' }
}

// ---------------------------------------------------------------------------
// Pre/post-processing for the saliency contract
// ---------------------------------------------------------------------------

/** Draw the source into a square inputSize canvas → NCHW float32 0..1. */
export async function preprocessSaliency(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  inputSize: number,
): Promise<Float32Array> {
  const c = document.createElement('canvas')
  c.width = inputSize
  c.height = inputSize
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2d context unavailable')
  ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, inputSize, inputSize)
  const img = ctx.getImageData(0, 0, inputSize, inputSize)
  const out = new Float32Array(3 * inputSize * inputSize)
  for (let i = 0; i < inputSize * inputSize; i++) {
    out[i] = img.data[i * 4] / 255
    out[inputSize * inputSize + i] = img.data[i * 4 + 1] / 255
    out[2 * inputSize * inputSize + i] = img.data[i * 4 + 2] / 255
  }
  return out
}

export interface SaliencyOutput {
  /** Subject-likelihood map at the model's input resolution, 0..1. */
  prob: Float32Array
  size: number
}

/** Find the map-like output tensor and min-max normalise it to 0..1. */
export function postprocessSaliency(output: Record<string, unknown>, inputSize: number): SaliencyOutput {
  let best: Float32Array | null = null
  let bestLen = 0
  for (const v of Object.values(output)) {
    const arr = v as { data?: Float32Array; dims?: number[] }
    if (arr && typeof arr === 'object' && arr.data instanceof Float32Array) {
      const dims = arr.dims ?? []
      const pixels = dims.length >= 2 ? dims.slice(-2).reduce((a, b) => a * b, 1) : arr.data.length
      if (pixels >= inputSize * inputSize / 4 && arr.data.length > bestLen) {
        best = arr.data
        bestLen = arr.data.length
      }
    }
  }
  if (!best) throw new Error('no map-like output tensor found')
  let mn = Infinity
  let mx = -Infinity
  for (let i = 0; i < best.length; i++) {
    if (best[i] < mn) mn = best[i]
    if (best[i] > mx) mx = best[i]
  }
  const span = mx - mn || 1
  const prob = new Float32Array(best.length)
  for (let i = 0; i < best.length; i++) prob[i] = (best[i] - mn) / span
  return { prob, size: Math.round(Math.sqrt(best.length)) || inputSize }
}

/** Upscale a probability map back to a working-resolution mask grid. */
export function probToMask(prob: Float32Array, probSize: number, width: number, height: number, threshold = 0.5): MaskBitmap {
  const data = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    const py = Math.min(probSize - 1, Math.floor((y / height) * probSize))
    for (let x = 0; x < width; x++) {
      const px = Math.min(probSize - 1, Math.floor((x / width) * probSize))
      data[y * width + x] = prob[py * probSize + px] >= threshold ? 255 : 0
    }
  }
  return { width, height, data }
}
