/**
 * Non-rigid displacement interpolation.
 *
 * Tracked points give us displacement at sparse locations. To move a deforming
 * silhouette (an arm lifting, a hand opening) we need displacement everywhere inside
 * the region, so we interpolate with inverse-distance weighting, robustly:
 *   - only inliers contribute;
 *   - the weight uses a power falloff so a nearby point dominates but a distant one
 *     still stabilises the result;
 *   - the output is clamped against the local consensus so a single bad point cannot
 *     tear the silhouette apart.
 *
 * This is the "mesh deformation" layer of the hybrid stack, without needing an
 * explicit triangulation.
 */
import { Vec2 } from '../core/geometry.js';
import { Gray, createGray } from '../core/image.js';
import { clamp } from '../core/math.js';

export interface Displacement {
  pos: Vec2;
  dx: number;
  dy: number;
  weight: number;
}

export interface WarpOptions {
  /** weight exponent; 2 = classic Shepard interpolation */
  power: number;
  /** maximum influence radius (px); beyond this a point contributes nothing */
  radius: number;
  /** clamp displacement to this multiple of the local median */
  outlierClamp: number;
}

export const DEFAULT_WARP_OPTIONS: WarpOptions = { power: 2, radius: 120, outlierClamp: 3 };

/**
 * Build dense dx/dy fields from sparse displacements.
 * Returns two Float32Arrays of size width*height.
 */
export function displacementFields(
  width: number,
  height: number,
  disps: Displacement[],
  opts: Partial<WarpOptions> = {},
): { dx: Float32Array; dy: Float32Array } {
  const o = { ...DEFAULT_WARP_OPTIONS, ...opts };
  const dx = new Float32Array(width * height);
  const dy = new Float32Array(width * height);
  const usable = disps.filter((d) => d.weight > 0.05);
  if (usable.length === 0) return { dx, dy };

  // Local consensus magnitude for clamping.
  const mags = usable.map((d) => Math.hypot(d.dx, d.dy)).sort((a, b) => a - b);
  const medMag = mags[mags.length >> 1] ?? 0;
  const maxMag = Math.max(2, medMag * o.outlierClamp);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let wSum = 0, ax = 0, ay = 0;
      for (const d of usable) {
        const dist = Math.hypot(d.pos.x - x, d.pos.y - y);
        if (dist > o.radius) continue;
        const w = (d.weight / Math.pow(dist + 1e-3, o.power));
        wSum += w;
        ax += w * clamp(d.dx, -maxMag, maxMag);
        ay += w * clamp(d.dy, -maxMag, maxMag);
      }
      const i = y * width + x;
      if (wSum > 0) {
        dx[i] = ax / wSum;
        dy[i] = ay / wSum;
      }
    }
  }
  return { dx, dy };
}

/** Warp a mask by a dense displacement field (backward mapping with bilinear sampling). */
export function warpMaskByField(
  mask: Gray,
  dx: Float32Array,
  dy: Float32Array,
): Gray {
  const out = createGray(mask.width, mask.height);
  const { width: w, height: h } = mask;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const sx = x - dx[i];
      const sy = y - dy[i];
      out.data[i] = bilinear(mask, sx, sy);
    }
  }
  return out;
}

function bilinear(g: Gray, x: number, y: number): number {
  if (x < 0 || y < 0 || x > g.width - 1 || y > g.height - 1) return 0;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, g.width - 1), y1 = Math.min(y0 + 1, g.height - 1);
  const fx = x - x0, fy = y - y0;
  const a = g.data[y0 * g.width + x0];
  const b = g.data[y0 * g.width + x1];
  const c = g.data[y1 * g.width + x0];
  const d = g.data[y1 * g.width + x1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/**
 * Smooth a displacement field so the deformation is spatially coherent without
 * over-smoothing articulated parts. A small Gaussian preserves limbs; a large one
 * would weld them together, so the sigma is tied to the field's own gradient scale.
 */
export function smoothField(field: Float32Array, width: number, height: number, sigma: number): Float32Array {
  if (sigma <= 0) return field;
  const r = Math.max(1, Math.ceil(sigma * 2));
  const kernel: number[] = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(v);
    sum += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
  const tmp = new Float32Array(field.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let s = 0, w = 0;
      for (let k = -r; k <= r; k++) {
        const xx = x + k;
        if (xx < 0 || xx >= width) continue;
        const kw = kernel[k + r];
        s += field[y * width + xx] * kw;
        w += kw;
      }
      tmp[y * width + x] = w ? s / w : 0;
    }
  }
  const out = new Float32Array(field.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let s = 0, w = 0;
      for (let k = -r; k <= r; k++) {
        const yy = y + k;
        if (yy < 0 || yy >= height) continue;
        const kw = kernel[k + r];
        s += tmp[yy * width + x] * kw;
        w += kw;
      }
      out[y * width + x] = w ? s / w : 0;
    }
  }
  return out;
}
