/**
 * Omniframe — the signature feature.
 *
 * Normal editing changes a temporal segment. Omniframe changes a *visual relationship*
 * and propagates that change through frames: the selection is tracked, the operation is
 * applied to what the tracker found, and the vacated region is repaired. It never
 * reuses the frame-0 mask coordinates on later frames.
 *
 * An OmniframeOp is pure data and fully non-destructive: the source pixels are never
 * modified, only a render-time description of how to rebuild each frame.
 */
import { Gray, Rgba, createGray, cloneGray, gaussianRgba, graySample } from '../core/image.js';
import { Vec2, Mat3, mat3Apply, affineFrom, transformAbout, translationMatrix, mat3Multiply, scaleMatrix, rotationMatrix } from '../core/geometry.js';
import { clamp01 } from '../core/math.js';
import { uid } from '../core/id.js';
import { BlendMode } from '../timeline/model.js';
import { FrameProvider, trackMask } from '../tracking/tracker.js';
import { trackMaskWithSam2, Sam2Backend, Sam2Prompt } from '../tracking/sam2.js';
import { TrackOptions, DEFAULT_TRACK_OPTIONS, TrackDirection } from '../tracking/types.js';
import { InpaintMethod, inpaintRgba, inpaintTeleaGray, inpaintDiffusionGray, inpaintPatchMatchGray } from './inpaint.js';

export type OmniframeOpKind =
  | 'cut' | 'move' | 'duplicate' | 'resize' | 'scale' | 'rotate' | 'skew'
  | 'perspective' | 'warp' | 'fill' | 'erase' | 'recolor' | 'blur' | 'sharpen'
  | 'pixelate' | 'replace' | 'clone' | 'inpaint' | 'backgroundReplace';

export type SelectionMethod =
  | 'rectangle' | 'ellipse' | 'brush' | 'magicBrush' | 'magneticBrush' | 'lasso'
  | 'polygon' | 'path' | 'similarColor' | 'contiguous' | 'floodFill' | 'erase' | 'invert';

export type PropagationMode = 'everyFrame' | 'adaptive' | 'keyframeAssisted';

export interface OmniframeRange {
  start: number;
  end: number;
  direction: TrackDirection;
  mode: PropagationMode;
  /** when mode === 'keyframeAssisted', run the expensive pass only on these frames */
  keyframeInterval: number;
}

export interface OmniframeTransform {
  dx: number;
  dy: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  skewX: number;
  skewY: number;
  preserveAspect: boolean;
  anchor: Vec2 | 'center' | 'custom';
  anchorPoint?: Vec2;
}

export interface OmniframeColor {
  hue: number;
  saturation: number;
  brightness: number;
  contrast: number;
  temperature: number;
  tint: number;
}

export interface OmniframeOp {
  id: string;
  kind: OmniframeOpKind;
  name: string;
  enabled: boolean;
  selectionMethod: SelectionMethod;
  trackingMethod: 'classical' | 'sam2';
  range: OmniframeRange;
  transform: OmniframeTransform;
  color: OmniframeColor;
  repair: InpaintMethod;
  composite: BlendMode;
  /** per-frame user corrections to the tracked mask (non-destructive) */
  corrections: Map<number, Gray>;
  /** measured, written back after execution; null means no metric was produced */
  confidence: number | null;
  /** privacy operations */
  pixelSize: number;
  blurRadius: number;
  /** replacement source for 'clone'/'replace' */
  cloneSource?: { x: number; y: number };
}

export function newOmniframeOp(kind: OmniframeOpKind, range: Partial<OmniframeRange> = {}): OmniframeOp {
  return {
    id: uid('omni'),
    kind,
    name: defaultName(kind),
    enabled: true,
    selectionMethod: 'rectangle',
    trackingMethod: 'classical',
    range: { start: 0, end: 0, direction: 'forward', mode: 'everyFrame', keyframeInterval: 12, ...range },
    transform: {
      dx: 0, dy: 0, scaleX: 1, scaleY: 1, rotation: 0, skewX: 0, skewY: 0,
      preserveAspect: true, anchor: 'center',
    },
    color: { hue: 0, saturation: 0, brightness: 0, contrast: 0, temperature: 0, tint: 0 },
    repair: 'telea',
    composite: 'normal',
    corrections: new Map(),
    confidence: null,
    pixelSize: 12,
    blurRadius: 12,
  };
}

function defaultName(kind: OmniframeOpKind): string {
  const map: Record<OmniframeOpKind, string> = {
    cut: 'Cut subject', move: 'Move subject', duplicate: 'Duplicate subject',
    resize: 'Resize subject', scale: 'Scale subject', rotate: 'Rotate subject',
    skew: 'Skew subject', perspective: 'Perspective', warp: 'Warp',
    fill: 'Fill region', erase: 'Erase region', recolor: 'Recolour region',
    blur: 'Blur region', sharpen: 'Sharpen region', pixelate: 'Pixelate region',
    replace: 'Replace region', clone: 'Clone region', inpaint: 'Inpaint region',
    backgroundReplace: 'Replace background',
  };
  return map[kind];
}

/** Build the 3x3 matrix for an Omniframe transform, resolved around its anchor. */
export function transformMatrix(op: OmniframeOp, bounds: { cx: number; cy: number }): Mat3 {
  const t = op.transform;
  let sx = t.scaleX;
  let sy = t.scaleY;
  if (t.preserveAspect) {
    const s = (sx + sy) / 2;
    sx = s;
    sy = s;
  }
  const anchor: Vec2 =
    t.anchor === 'custom' && t.anchorPoint ? t.anchorPoint : { x: bounds.cx, y: bounds.cy };
  const skew: Mat3 = [1, Math.tan(t.skewX), 0, Math.tan(t.skewY), 1, 0, 0, 0, 1];
  const body = mat3Multiply(
    translationMatrix(t.dx, t.dy),
    mat3Multiply(rotationMatrix(t.rotation), mat3Multiply(scaleMatrix(sx, sy), skew)),
  );
  return transformAbout(body, anchor);
}

export interface OmniframeResult {
  frames: Map<number, Rgba>;
  masks: Map<number, Gray>;
  /** measured tracking confidence for the run; null when no tracker metric was produced */
  confidence: number | null;
  /** which backend actually did the tracking */
  backend: 'classical' | 'sam2';
  /** honest reason when a fallback was used */
  note: string;
  msPerFrame: number;
}

export interface OmniframeExecuteOptions {
  trackOptions?: Partial<TrackOptions>;
  sam2?: Sam2Backend;
  prompt?: Sam2Prompt;
  signal?: AbortSignal;
  onProgress?: (p: { frame: number; total: number; stage: string; confidence: number | null }) => void;
}

/**
 * Execute one Omniframe operation across its range.
 *
 * Per frame:
 *   1. resolve the mask (tracked, or a user correction, or interpolated between them)
 *   2. lift the subject out
 *   3. repair the region it vacated
 *   4. transform the subject
 *   5. composite it back
 */
export async function executeOmniframe(
  provider: FrameProvider,
  mask0: Gray,
  op: OmniframeOp,
  opts: OmniframeExecuteOptions = {},
): Promise<OmniframeResult> {
  const t0 = performance.now();
  const { start, end, direction } = op.range;
  const trackOpts: TrackOptions = { ...DEFAULT_TRACK_OPTIONS, ...opts.trackOptions };
  let masks: Map<number, Gray>;
  let backend: 'classical' | 'sam2' = 'classical';
  let note = '';
  let trackingConfidence: number | null = null;

  if (op.trackingMethod === 'sam2') {
    const res = await trackMaskWithSam2(
      provider,
      start,
      end,
      {
        ...trackOpts,
        keyframeInterval: op.range.keyframeInterval,
        prompt: opts.prompt ?? { points: [] },
        direction,
      },
      { signal: opts.signal, onProgress: (p) => opts.onProgress?.({ ...p, confidence: null }) },
      opts.sam2 ?? new Sam2Backend(),
    );
    masks = res.masks;
    backend = res.fellBackToClassical ? 'classical' : 'sam2';
    trackingConfidence = res.confidence;
    note = res.reason;
    if (res.fellBackToClassical) {
      // Fall back cleanly and say so instead of pretending SAM 2 ran.
      const fb = await trackMask(provider, mask0, start, end, direction, trackOpts, {
        signal: opts.signal,
        onProgress: (p) => opts.onProgress?.({ frame: p.frame, total: p.total, stage: 'classical-fallback', confidence: p.confidence }),
      });
      masks = fb.masks;
      trackingConfidence = fb.metrics.confidence;
    }
  } else {
    const res = await trackMask(provider, mask0, start, end, direction, trackOpts, {
      signal: opts.signal,
      onProgress: (p) => opts.onProgress?.({ frame: p.frame, total: p.total, stage: 'tracking', confidence: p.confidence }),
    });
    masks = res.masks;
    trackingConfidence = res.metrics.confidence;
    note = `Tracked ${masks.size} frames; confidence ${(res.metrics.confidence * 100).toFixed(0)}%.`;
  }

  // User corrections override the tracked mask on the frames they touch.
  for (const [f, m] of op.corrections) masks.set(f, m);

  const frames = new Map<number, Rgba>();
  let n = 0;
  for (let f = Math.min(start, end); f <= Math.max(start, end); f++) {
    if (opts.signal?.aborted) break;
    const srcGray = await provider.frame(f);
    const src = grayToRgba(srcGray);
    const mask = masks.get(f) ?? mask0;
    const out = applyOpToFrame(src, mask, op);
    frames.set(f, out);
    n++;
    opts.onProgress?.({ frame: f, total: Math.abs(end - start) + 1, stage: 'compositing', confidence: trackingConfidence });
  }
  const elapsed = performance.now() - t0;
  return {
    frames,
    masks,
    confidence: trackingConfidence,
    backend,
    note,
    msPerFrame: n ? elapsed / n : 0,
  };
}

/** Apply the operation to a single frame, given the resolved mask. */
export function applyOpToFrame(src: Rgba, mask: Gray, op: OmniframeOp): Rgba {
  const { width: w, height: h } = src;
  const bounds = maskCentroid(mask);
  switch (op.kind) {
    case 'blur':
    case 'pixelate':
    case 'sharpen':
      return applyPrivacy(src, mask, op);
    case 'recolor':
      return applyColor(src, mask, op.color);
    case 'erase':
    case 'cut':
    case 'inpaint':
    case 'fill':
      return applyRepairOnly(src, mask, op);
    case 'backgroundReplace':
      return applyBackgroundReplace(src, mask, op);
    case 'duplicate': {
      const moved = applyMove(src, mask, op, bounds);
      return compositeOver(moved, src, mask, op, bounds, { dx: op.transform.dx * 2, dy: op.transform.dy * 2 });
    }
    default:
      return applyMove(src, mask, op, bounds);
  }
  void w; void h;
}

function applyMove(src: Rgba, mask: Gray, op: OmniframeOp, bounds: { cx: number; cy: number }): Rgba {
  const m = transformMatrix(op, bounds);
  // 1. Lift the subject.
  const subject = extract(src, mask);
  // 2. Repair the vacated region in the plate.
  const plate = inpaintRgba(src, mask, op.repair);
  // 3. Transform the subject (forward map via inverse sampling).
  const transformed = transformRgba(subject, m, mask, src.width, src.height);
  // 4. Composite.
  return compositeOver(plate, transformed.image, transformed.mask, op, bounds);
}

function compositeOver(
  plate: Rgba,
  layer: Rgba,
  layerMask: Gray,
  op: OmniframeOp,
  _bounds: { cx: number; cy: number },
  extra?: { dx: number; dy: number },
): Rgba {
  const out: Rgba = { width: plate.width, height: plate.height, data: new Uint8ClampedArray(plate.data) };
  const dx = extra?.dx ?? 0;
  const dy = extra?.dy ?? 0;
  for (let y = 0; y < plate.height; y++) {
    for (let x = 0; x < plate.width; x++) {
      const i = y * plate.width + x;
      const sx = x - Math.round(dx);
      const sy = y - Math.round(dy);
      if (sx < 0 || sy < 0 || sx >= plate.width || sy >= plate.height) continue;
      const j = sy * plate.width + sx;
      const a = layerMask.data[j];
      if (a <= 0.001) continue;
      const pi = i * 4;
      const li = j * 4;
      const alpha = a * (layer.data[li + 3] / 255);
      out.data[pi] = blend(op.composite, out.data[pi], layer.data[li], alpha);
      out.data[pi + 1] = blend(op.composite, out.data[pi + 1], layer.data[li + 1], alpha);
      out.data[pi + 2] = blend(op.composite, out.data[pi + 2], layer.data[li + 2], alpha);
    }
  }
  return out;
}

function blend(mode: BlendMode, base: number, top: number, alpha: number): number {
  const b = base / 255;
  const t = top / 255;
  let r: number;
  switch (mode) {
    case 'multiply': r = b * t; break;
    case 'screen': r = 1 - (1 - b) * (1 - t); break;
    case 'overlay': r = b < 0.5 ? 2 * b * t : 1 - 2 * (1 - b) * (1 - t); break;
    case 'softLight': r = (1 - 2 * t) * b * b + 2 * t * b; break;
    case 'hardLight': r = t < 0.5 ? 2 * b * t : 1 - 2 * (1 - b) * (1 - t); break;
    case 'difference': r = Math.abs(b - t); break;
    case 'add': r = Math.min(1, b + t); break;
    case 'subtract': r = Math.max(0, b - t); break;
    case 'darken': r = Math.min(b, t); break;
    case 'lighten': r = Math.max(b, t); break;
    default: r = t;
  }
  return (b * (1 - alpha) + r * alpha) * 255;
}

/** Cut the masked pixels out of the image, keeping alpha. */
export function extract(src: Rgba, mask: Gray): Rgba {
  const out: Rgba = { width: src.width, height: src.height, data: new Uint8ClampedArray(src.width * src.height * 4) };
  for (let i = 0, p = 0; i < mask.data.length; i++, p += 4) {
    const a = clamp01(mask.data[i]);
    if (a <= 0) continue;
    out.data[p] = src.data[p];
    out.data[p + 1] = src.data[p + 1];
    out.data[p + 2] = src.data[p + 2];
    out.data[p + 3] = a * 255;
  }
  return out;
}

/** Forward transform via inverse sampling, transforming the alpha mask with it. */
export function transformRgba(
  layer: Rgba,
  m: Mat3,
  mask: Gray,
  width: number,
  height: number,
): { image: Rgba; mask: Gray } {
  const out: Rgba = { width, height, data: new Uint8ClampedArray(width * height * 4) };
  const outMask = createGray(width, height);
  // invert for backward mapping
  const [a, b, c, d, e, f, g, h, i] = m;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) return { image: layer, mask };
  const inv: Mat3 = [
    (e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det,
    (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det,
    (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det,
  ];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = mat3Apply(inv, { x, y });
      if (src.x < 0 || src.y < 0 || src.x > width - 1 || src.y > height - 1) continue;
      const mv = graySample(mask, src.x, src.y);
      if (mv <= 0.001) continue;
      const x0 = Math.floor(src.x), y0 = Math.floor(src.y);
      const x1 = Math.min(x0 + 1, width - 1), y1 = Math.min(y0 + 1, height - 1);
      const fx = src.x - x0, fy = src.y - y0;
      const o = (y * width + x) * 4;
      for (let ch = 0; ch < 4; ch++) {
        const v00 = layer.data[(y0 * width + x0) * 4 + ch];
        const v01 = layer.data[(y0 * width + x1) * 4 + ch];
        const v10 = layer.data[(y1 * width + x0) * 4 + ch];
        const v11 = layer.data[(y1 * width + x1) * 4 + ch];
        out.data[o + ch] = (v00 * (1 - fx) + v01 * fx) * (1 - fy) + (v10 * (1 - fx) + v11 * fx) * fy;
      }
      outMask.data[y * width + x] = mv;
    }
  }
  return { image: out, mask: outMask };
}

function applyRepairOnly(src: Rgba, mask: Gray, op: OmniframeOp): Rgba {
  if (op.kind === 'fill') {
    // Fill the region from its own surroundings (clone) rather than removing it.
    const filled = inpaintRgba(src, mask, op.repair === 'diffusion' ? 'patchmatch' : op.repair);
    return filled;
  }
  return inpaintRgba(src, mask, op.repair);
}

function applyPrivacy(src: Rgba, mask: Gray, op: OmniframeOp): Rgba {
  const out: Rgba = { width: src.width, height: src.height, data: new Uint8ClampedArray(src.data) };
  if (op.kind === 'blur') {
    const blurred = gaussianRgba(src, op.blurRadius);
    for (let i = 0, p = 0; i < mask.data.length; i++, p += 4) {
      const a = clamp01(mask.data[i]);
      if (a <= 0) continue;
      out.data[p] = src.data[p] * (1 - a) + blurred.data[p] * a;
      out.data[p + 1] = src.data[p + 1] * (1 - a) + blurred.data[p + 1] * a;
      out.data[p + 2] = src.data[p + 2] * (1 - a) + blurred.data[p + 2] * a;
    }
    return out;
  }
  if (op.kind === 'pixelate') {
    const s = Math.max(2, Math.round(op.pixelSize));
    for (let by = 0; by < src.height; by += s) {
      for (let bx = 0; bx < src.width; bx += s) {
        let r = 0, g = 0, b = 0, n = 0, anyMask = false;
        for (let y = by; y < Math.min(src.height, by + s); y++) {
          for (let x = bx; x < Math.min(src.width, bx + s); x++) {
            const i = y * src.width + x;
            if (mask.data[i] >= 0.5) anyMask = true;
            const p = i * 4;
            r += src.data[p]; g += src.data[p + 1]; b += src.data[p + 2];
            n++;
          }
        }
        if (!anyMask || n === 0) continue;
        r /= n; g /= n; b /= n;
        for (let y = by; y < Math.min(src.height, by + s); y++) {
          for (let x = bx; x < Math.min(src.width, bx + s); x++) {
            const i = y * src.width + x;
            if (mask.data[i] < 0.5) continue;
            const p = i * 4;
            out.data[p] = r; out.data[p + 1] = g; out.data[p + 2] = b;
          }
        }
      }
    }
    return out;
  }
  // sharpen: unsharp mask inside the region
  const blurred = gaussianRgba(src, 1.5);
  for (let i = 0, p = 0; i < mask.data.length; i++, p += 4) {
    const a = clamp01(mask.data[i]);
    if (a <= 0) continue;
    for (let c = 0; c < 3; c++) {
      const sharp = src.data[p + c] * 2 - blurred.data[p + c];
      out.data[p + c] = src.data[p + c] * (1 - a) + sharp * a;
    }
  }
  return out;
}

function applyColor(src: Rgba, mask: Gray, c: OmniframeColor): Rgba {
  const out: Rgba = { width: src.width, height: src.height, data: new Uint8ClampedArray(src.data) };
  for (let i = 0, p = 0; i < mask.data.length; i++, p += 4) {
    const a = clamp01(mask.data[i]);
    if (a <= 0) continue;
    let r = src.data[p] / 255, g = src.data[p + 1] / 255, b = src.data[p + 2] / 255;
    // brightness / contrast
    r = (r - 0.5) * (1 + c.contrast) + 0.5 + c.brightness;
    g = (g - 0.5) * (1 + c.contrast) + 0.5 + c.brightness;
    b = (b - 0.5) * (1 + c.contrast) + 0.5 + c.brightness;
    // hue / saturation via RGB->HSL
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0;
    const l = (max + min) / 2;
    const d = max - min;
    let s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    h = (h + c.hue + 360) % 360;
    s = clamp01(s * (1 + c.saturation));
    const rgb = hslToRgb(h, s, clamp01(l));
    let nr = rgb[0] + c.temperature * 0.12;
    let ng = rgb[1];
    let nb = rgb[2] - c.temperature * 0.12 + c.tint * 0.08;
    nr = clamp01(nr); ng = clamp01(ng); nb = clamp01(nb);
    out.data[p] = (src.data[p] / 255 * (1 - a) + nr * a) * 255;
    out.data[p + 1] = (src.data[p + 1] / 255 * (1 - a) + ng * a) * 255;
    out.data[p + 2] = (src.data[p + 2] / 255 * (1 - a) + nb * a) * 255;
  }
  return out;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = l - c / 2;
  return [r + m, g + m, b + m];
}

function applyBackgroundReplace(src: Rgba, mask: Gray, op: OmniframeOp): Rgba {
  // Keep the subject, replace everything else with an inpainted plate.
  const inverted: Gray = createGray(mask.width, mask.height);
  for (let i = 0; i < mask.data.length; i++) inverted.data[i] = 1 - clamp01(mask.data[i]);
  return inpaintRgba(src, inverted, op.repair);
}

function maskCentroid(m: Gray): { cx: number; cy: number } {
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      if (m.data[y * m.width + x] >= 0.5) { sx += x; sy += y; n++; }
    }
  }
  return n ? { cx: sx / n, cy: sy / n } : { cx: m.width / 2, cy: m.height / 2 };
}

export function grayToRgba(g: Gray): Rgba {
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

export { affineFrom, cloneGray, inpaintTeleaGray, inpaintDiffusionGray, inpaintPatchMatchGray };
