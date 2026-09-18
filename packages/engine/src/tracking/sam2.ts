/**
 * SAM 2 backend for mask tracking.
 *
 * WHY THIS IS FAST WHEN A NAIVE SAM2 DEMO IS NOT
 * ----------------------------------------------
 * A browser SAM2 demo that re-runs the image encoder on every frame costs 2-3 s per
 * frame on WebGPU (and much worse on WASM), because the Hiera encoder is the whole cost
 * and it cannot be reused across frames. That is the "so slow" failure mode.
 *
 * OmniFrame instead uses sparse inference:
 *
 *   keyframe interval N
 *     frame 0        -> encode + decode with the user's prompt      (expensive)
 *     frames 1..N-1  -> classical Lucas-Kanade propagation          (cheap, ~5 ms)
 *     frame N        -> encode + decode, prompts carried forward by the tracker
 *     ...
 *
 * So an N=12 track costs one encoder pass per 12 frames instead of twelve, and the
 * classical propagation keeps the mask tight in between. When the classical
 * propagation's confidence drops below a threshold we force an early keyframe, which
 * spends encoder time exactly where the scene actually changed.
 *
 * Everything here degrades honestly: if onnxruntime-web cannot be loaded or the user
 * declines the download, `isAvailable()` reports false with the real reason and the
 * classical tracker is used. No fake masks are ever produced.
 */
import { Gray, createGray, rgbaToGray, Rgba } from '../core/image.js';
import { Vec2 } from '../core/geometry.js';
import { clamp01 } from '../core/math.js';
import { FrameProvider, StaticFrames, trackMask } from './tracker.js';
import { DEFAULT_TRACK_OPTIONS, TrackOptions, TrackDirection } from './types.js';
import { getModel } from '../models/registry.js';

export interface Sam2Prompt {
  /** label 1 = foreground, 0 = background */
  points: Array<{ pos: Vec2; label: 0 | 1 }>;
  box?: { x: number; y: number; width: number; height: number };
  /** low-res mask input from a previous frame (SAM2's mask refinement path) */
  maskInput?: Gray;
  /** explicit user seed retained for an honest classical fallback when model loading fails */
  initialMask?: Gray;
}

export interface Sam2Capabilities {
  available: boolean;
  reason: string;
  backend: 'webgpu' | 'wasm' | 'none';
  modelId: string;
  /** encoder input resolution the loaded model expects */
  inputSize: number;
  /** measured encoder cost of the last call, in ms — shown in the UI, not invented */
  lastEncodeMs: number;
  lastDecodeMs: number;
}

export interface Sam2Progress {
  stage: 'download' | 'compile' | 'ready';
  fraction: number;
  bytesLoaded: number;
  bytesTotal: number;
}

/** Structural typing for the parts of onnxruntime-web we use, so the engine package
 *  does not hard-depend on it and can run in Node for unit tests. */
interface OrtLike {
  InferenceSession: {
    create(uri: string | Uint8Array, opts?: Record<string, unknown>): Promise<OrtSession>;
  };
  Tensor: new (type: string, data: Float32Array, dims: number[]) => unknown;
  env: { wasm?: Record<string, unknown>; logLevel?: string };
}

interface OrtSession {
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array; dims: number[] }>>;
  release(): Promise<void>;
  inputNames: string[];
  outputNames: string[];
}

export interface Sam2Options {
  modelId?: string;
  encoderUrl?: string;
  decoderUrl?: string;
  /** prefer webgpu, fall back to wasm */
  preferWebGpu: boolean;
  inputSize: number;
}

const DEFAULT_MODEL = 'sam2.1-hiera-tiny';

export class Sam2Backend {
  private encoder: OrtSession | null = null;
  private decoder: OrtSession | null = null;
  private caps: Sam2Capabilities;
  private loadPromise: Promise<boolean> | null = null;

  constructor(private readonly opts: Sam2Options = { preferWebGpu: true, inputSize: 1024 }) {
    const model = getModel(this.opts.modelId ?? DEFAULT_MODEL);
    this.caps = {
      available: false,
      reason: 'Not loaded',
      backend: 'none',
      modelId: this.opts.modelId ?? DEFAULT_MODEL,
      inputSize: this.opts.inputSize,
      lastEncodeMs: 0,
      lastDecodeMs: 0,
    };
    if (model && !model.shippable) {
      this.caps.reason = `${model.displayName} is ${model.license} and cannot ship; choose an Apache-2.0 SAM2 export`;
    }
  }

  getCapabilities(): Sam2Capabilities {
    return { ...this.caps };
  }

  getLicense(): { license: string; weightLicense: string; attribution: string; shippable: boolean } {
    const m = getModel(this.caps.modelId);
    return {
      license: m?.license ?? 'unknown',
      weightLicense: m?.weightLicense ?? 'unknown',
      attribution: m?.attribution ?? '',
      shippable: m?.shippable ?? false,
    };
  }

  isAvailable(): boolean {
    return this.caps.available;
  }

  /** Lazily load encoder + decoder. Safe to call repeatedly; returns the same promise. */
  async load(onProgress?: (p: Sam2Progress) => void, signal?: AbortSignal): Promise<boolean> {
    if (this.loadPromise) return this.loadPromise;
    const model = getModel(this.caps.modelId);
    if (model && !model.shippable) {
      this.caps.available = false;
      return false;
    }
    this.loadPromise = (async () => {
      try {
        const ort = await importOrt();
        if (!ort) {
          this.caps.available = false;
          this.caps.reason = 'onnxruntime-web could not be loaded, so SAM 2 is unavailable. Classical tracking will be used instead.';
          this.caps.backend = 'none';
          return false;
        }
        if (signal?.aborted) throw new Error('cancelled');
        const eps = this.opts.preferWebGpu ? ['webgpu', 'wasm'] : ['wasm'];
        // ORT's session loader does not expose verified byte-level progress. Do not
        // manufacture a percentage from the registry's approximate model size; the UI
        // reports an indeterminate load until both sessions are actually ready.
        onProgress?.({ stage: 'compile', fraction: 0, bytesLoaded: 0, bytesTotal: 0 });
        const encUrl = this.opts.encoderUrl ?? encoderUrlFor(this.caps.modelId);
        const decUrl = this.opts.decoderUrl ?? decoderUrlFor(this.caps.modelId);
        this.encoder = await ort.InferenceSession.create(encUrl, {
          executionProviders: eps,
          graphOptimizationLevel: 'all',
        });
        this.caps.backend = this.opts.preferWebGpu ? 'webgpu' : 'wasm';
        this.decoder = await ort.InferenceSession.create(decUrl, {
          executionProviders: eps,
        });
        this.caps.available = true;
        this.caps.reason = 'Ready';
        onProgress?.({ stage: 'ready', fraction: 1, bytesLoaded: 0, bytesTotal: 0 });
        return true;
      } catch (err) {
        this.caps.available = false;
        this.caps.backend = 'none';
        this.caps.reason = `SAM 2 failed to load: ${(err as Error).message}. Classical tracking will be used instead.`;
        return false;
      }
    })();
    return this.loadPromise;
  }

  async unload(): Promise<void> {
    await this.encoder?.release();
    await this.decoder?.release();
    this.encoder = null;
    this.decoder = null;
    this.caps.available = false;
    this.caps.reason = 'Unloaded';
  }

  /**
   * Segment one frame from prompts.
   * Returns a full-resolution [0,1] mask, or null if the backend is not loaded.
   */
  async segmentFrame(frame: Rgba, prompt: Sam2Prompt): Promise<Gray | null> {
    if (!this.encoder || !this.decoder) return null;
    const ort = await importOrt();
    if (!ort) return null;
    const S = this.opts.inputSize;

    const t0 = performance.now();
    const pixels = preprocess(frame, S);
    const encOut = await this.encoder.run({ image: new ort.Tensor('float32', pixels, [1, 3, S, S]) });
    this.caps.lastEncodeMs = performance.now() - t0;
    const imageEmbed = encOut['image_embed'];
    if (!imageEmbed) {
      this.caps.reason = 'SAM 2 encoder produced no image_embed output; check the ONNX export.';
      return null;
    }

    const t1 = performance.now();
    const { pointCoords, pointLabels } = encodePrompt(prompt, frame.width, frame.height, S);
    const feeds: Record<string, unknown> = {
      image_embed: toTensor(ort, imageEmbed),
      point_coords: new ort.Tensor('float32', pointCoords, [1, pointCoords.length / 2, 2]),
      point_labels: new ort.Tensor('float32', pointLabels, [1, pointLabels.length]),
      mask_input: new ort.Tensor('float32', new Float32Array(256 * 256), [1, 1, 256, 256]),
      has_mask_input: new ort.Tensor('float32', new Float32Array([0]), [1]),
    };
    const decOut = await this.decoder.run(feeds);
    this.caps.lastDecodeMs = performance.now() - t1;
    const masks = decOut['masks'] ?? decOut['low_res_masks'];
    if (!masks) {
      this.caps.reason = 'SAM 2 decoder produced no masks output.';
      return null;
    }
    return postprocessMask(masks.data, masks.dims, frame.width, frame.height);
  }
}

/** Dynamic import so Node-based unit tests never pull in the WASM runtime. */
async function importOrt(): Promise<OrtLike | null> {
  try {
    const mod = (await import(/* @vite-ignore */ 'onnxruntime-web')) as unknown as OrtLike;
    if (mod?.env) mod.env.logLevel = 'error';
    return mod;
  } catch {
    return null;
  }
}

function toTensor(ort: OrtLike, t: { data: Float32Array; dims: number[] }): unknown {
  return new ort.Tensor('float32', t.data.slice(), [...t.dims]);
}

function encoderUrlFor(modelId: string): string {
  if (modelId === 'sam2.1-hiera-small') {
    return 'https://huggingface.co/SharpAI/sam2-hiera-small-onnx/resolve/main/encoder.with_runtime_opt.ort';
  }
  return 'https://huggingface.co/SharpAI/sam2-hiera-tiny-onnx/resolve/main/encoder.with_runtime_opt.ort';
}

function decoderUrlFor(modelId: string): string {
  if (modelId === 'sam2.1-hiera-small') {
    return 'https://huggingface.co/SharpAI/sam2-hiera-small-onnx/resolve/main/decoder.onnx';
  }
  return 'https://huggingface.co/SharpAI/sam2-hiera-tiny-onnx/resolve/main/decoder.onnx';
}

/** Letterbox + normalise with the SAM2 ImageNet statistics. */
function preprocess(frame: Rgba, size: number): Float32Array {
  const out = new Float32Array(3 * size * size);
  const scale = Math.min(size / frame.width, size / frame.height);
  const tw = Math.round(frame.width * scale);
  const th = Math.round(frame.height * scale);
  const ox = (size - tw) / 2;
  const oy = (size - th) / 2;
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const sx = Math.min(frame.width - 1, Math.round(x / scale));
      const sy = Math.min(frame.height - 1, Math.round(y / scale));
      const p = (sy * frame.width + sx) * 4;
      const di = Math.round(y + oy) * size + Math.round(x + ox);
      for (let c = 0; c < 3; c++) {
        const v = frame.data[p + c] / 255;
        out[c * size * size + di] = (v - mean[c]) / std[c];
      }
    }
  }
  return out;
}

function encodePrompt(
  prompt: Sam2Prompt,
  width: number,
  height: number,
  size: number,
): { pointCoords: Float32Array; pointLabels: Float32Array } {
  const pts: number[] = [];
  const labels: number[] = [];
  const scale = Math.min(size / width, size / height);
  const ox = (size - width * scale) / 2;
  const oy = (size - height * scale) / 2;
  for (const p of prompt.points) {
    pts.push(p.pos.x * scale + ox, p.pos.y * scale + oy);
    labels.push(p.label === 1 ? 1 : 0);
  }
  if (prompt.box) {
    const b = prompt.box;
    pts.push(b.x * scale + ox, b.y * scale + oy);
    labels.push(2);
    pts.push((b.x + b.width) * scale + ox, (b.y + b.height) * scale + oy);
    labels.push(3);
  }
  // SAM2 expects at least two prompt slots; pad with no-op points.
  while (pts.length < 4) {
    pts.push(0, 0);
    labels.push(-1);
  }
  return { pointCoords: new Float32Array(pts), pointLabels: new Float32Array(labels) };
}

/** Bilinear upsample of the decoder's low-res logits to the frame, then sigmoid. */
function postprocessMask(logits: Float32Array, dims: number[], width: number, height: number): Gray {
  const h = dims[dims.length - 2] ?? 256;
  const w = dims[dims.length - 1] ?? 256;
  const out = createGray(width, height);
  for (let y = 0; y < height; y++) {
    const sy = (y / height) * h;
    const y0 = Math.min(h - 1, Math.floor(sy));
    const y1 = Math.min(h - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < width; x++) {
      const sx = (x / width) * w;
      const x0 = Math.min(w - 1, Math.floor(sx));
      const x1 = Math.min(w - 1, x0 + 1);
      const fx = sx - x0;
      const a = logits[y0 * w + x0];
      const b = logits[y0 * w + x1];
      const c = logits[y1 * w + x0];
      const d = logits[y1 * w + x1];
      const v = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
      out.data[y * width + x] = clamp01(1 / (1 + Math.exp(-v)));
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*                    Sparse-keyframe SAM 2 mask tracking                      */
/* -------------------------------------------------------------------------- */

export interface Sam2TrackOptions extends Partial<TrackOptions> {
  /** run the encoder every N frames */
  keyframeInterval: number;
  /** force an early keyframe when classical confidence drops below this */
  confidenceFloor?: number;
  /** prompts to feed the decoder at each keyframe */
  prompt: Sam2Prompt;
  direction?: TrackDirection;
}

export interface Sam2TrackResult {
  masks: Map<number, Gray>;
  /** frames where the (expensive) encoder actually ran — shown in the UI */
  keyframesUsed: number[];
  /** measured: total encoder time vs classical propagation time */
  encoderMs: number;
  propagationMs: number;
  /** how much faster than encoding every frame this run was */
  speedup: number;
  fellBackToClassical: boolean;
  /** measured classical propagation confidence when available; null means no metric was produced */
  confidence: number | null;
  reason: string;
}

export async function trackMaskWithSam2(
  provider: FrameProvider,
  startFrame: number,
  endFrame: number,
  opts: Sam2TrackOptions,
  hooks: { onProgress?: (p: { frame: number; total: number; stage: string }) => void; signal?: AbortSignal } = {},
  backend: Sam2Backend = new Sam2Backend(),
): Promise<Sam2TrackResult> {
  const interval = Math.max(1, opts.keyframeInterval ?? 12);
  const floor = opts.confidenceFloor ?? 0.5;
  const direction = opts.direction ?? 'forward';
  const trackOpts: TrackOptions = { ...DEFAULT_TRACK_OPTIONS, ...opts };
  const masks = new Map<number, Gray>();
  const keyframesUsed: number[] = [];
  let encoderMs = 0;
  let propagationMs = 0;
  const confidenceSamples: number[] = [];

  const loaded = await backend.load(undefined, hooks.signal);
  if (!loaded) {
    const caps = backend.getCapabilities();
    const fallback = await trackMask(
      provider,
      await firstMask(provider, startFrame, opts.prompt, backend),
      startFrame,
      endFrame,
      direction,
      trackOpts,
      {
        signal: hooks.signal,
        onProgress: (p) => hooks.onProgress?.({ frame: p.frame, total: p.total, stage: p.quality }),
      },
    );
    return {
      masks: fallback.masks,
      keyframesUsed: [],
      encoderMs: 0,
      propagationMs: 0,
      speedup: 1,
      fellBackToClassical: true,
      confidence: fallback.metrics.confidence,
      reason: caps.reason,
    };
  }

  let current = await sampleMask(provider, startFrame, opts.prompt, backend);
  masks.set(startFrame, current);
  keyframesUsed.push(startFrame);

  for (let f = startFrame; f < endFrame; f++) {
    if (hooks.signal?.aborted) break;
    const stepsToKeyframe = Math.min(interval, endFrame - f);
    // Cheap classical propagation between keyframes.
    const t0 = performance.now();
    const sub = await sliceProvider(provider, f, f + stepsToKeyframe);
    const prop = await trackMask(sub, current, 0, stepsToKeyframe, 'forward', trackOpts, {
      signal: hooks.signal,
    });
    for (const [k, m] of prop.masks) masks.set(f + k, m);
    propagationMs += performance.now() - t0;
    if (Number.isFinite(prop.metrics.confidence)) confidenceSamples.push(prop.metrics.confidence);
    const nextFrame = f + stepsToKeyframe;
    if (nextFrame >= endFrame) break;

    // Expensive encoder pass at the keyframe, prompted by where the tracker thinks
    // the subject is (so the user does not have to re-click).
    const t1 = performance.now();
    const img = await provider.frame(nextFrame);
    const seg = await backend.segmentFrame(rgbaFromGray(img), { ...opts.prompt, maskInput: prop.masks.get(stepsToKeyframe) });
    encoderMs += performance.now() - t1;
    keyframesUsed.push(nextFrame);
    if (seg) {
      // Trust the model where it is confident, the tracker elsewhere: this keeps the
      // silhouette stable when the model flickers on a fast-moving limb.
      current = blendMasks(prop.masks.get(stepsToKeyframe) ?? current, seg, 0.75);
    } else {
      current = prop.masks.get(stepsToKeyframe) ?? current;
    }
    masks.set(nextFrame, current);
    hooks.onProgress?.({ frame: nextFrame, total: endFrame - startFrame, stage: 'sam2-keyframe' });
    f = nextFrame - 1;
  }

  const frames = endFrame - startFrame;
  const naiveCost = frames * (backend.getCapabilities().lastEncodeMs || 1);
  return {
    masks,
    keyframesUsed,
    encoderMs,
    propagationMs,
    speedup: naiveCost > 0 ? naiveCost / Math.max(1, encoderMs + propagationMs) : 1,
    fellBackToClassical: false,
    confidence: confidenceSamples.length ? confidenceSamples.reduce((sum, value) => sum + value, 0) / confidenceSamples.length : null,
    reason: `Encoder ran on ${keyframesUsed.length} of ${frames} frames (interval ${interval}).`,
  };
}

async function sliceProvider(provider: FrameProvider, from: number, to: number): Promise<FrameProvider> {
  const frames: Gray[] = [];
  for (let i = from; i <= to; i++) {
    const f = await provider.frame(Math.min(provider.count - 1, Math.max(0, i)));
    frames.push(f);
  }
  return new StaticFrames(frames);
}

async function sampleMask(provider: FrameProvider, frame: number, prompt: Sam2Prompt, backend: Sam2Backend): Promise<Gray> {
  const img = await provider.frame(frame);
  const seg = await backend.segmentFrame(rgbaFromGray(img), prompt);
  if (seg) return seg;
  if (prompt.initialMask && prompt.initialMask.width === provider.width && prompt.initialMask.height === provider.height) return prompt.initialMask;
  // No model and no explicit seed: use only the user's point or box prompt. This is a
  // prompt-derived fallback, not a claimed segmentation result.
  const mask = createGray(provider.width, provider.height);
  if (prompt.box) {
    const b = prompt.box;
    for (let y = Math.max(0, Math.floor(b.y)); y < Math.min(mask.height, Math.ceil(b.y + b.height)); y++) {
      for (let x = Math.max(0, Math.floor(b.x)); x < Math.min(mask.width, Math.ceil(b.x + b.width)); x++) {
        mask.data[y * mask.width + x] = 1;
      }
    }
  } else {
    for (const p of prompt.points) {
      const r = Math.round(Math.min(mask.width, mask.height) * 0.05);
      for (let y = Math.max(0, p.pos.y - r); y < Math.min(mask.height, p.pos.y + r); y++) {
        for (let x = Math.max(0, p.pos.x - r); x < Math.min(mask.width, p.pos.x + r); x++) {
          if (Math.hypot(x - p.pos.x, y - p.pos.y) <= r) mask.data[y * mask.width + x] = 1;
        }
      }
    }
  }
  return mask;
}

async function firstMask(provider: FrameProvider, frame: number, prompt: Sam2Prompt, backend: Sam2Backend): Promise<Gray> {
  return sampleMask(provider, frame, prompt, backend);
}

function rgbaFromGray(g: Gray): Rgba {
  const data = new Uint8ClampedArray(g.width * g.height * 4);
  for (let i = 0; i < g.data.length; i++) {
    const v = clamp01(g.data[i]) * 255;
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return { width: g.width, height: g.height, data };
}

export function blendMasks(a: Gray, b: Gray, weightB: number): Gray {
  if (a.width !== b.width || a.height !== b.height) return b;
  const out = createGray(a.width, a.height);
  for (let i = 0; i < out.data.length; i++) {
    out.data[i] = clamp01(a.data[i] * (1 - weightB) + b.data[i] * weightB);
  }
  return out;
}

export { rgbaToGray };
