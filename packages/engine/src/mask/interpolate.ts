/**
 * Frame-to-frame mask interpolation.
 *
 * Naive alpha-crossfade between two silhouettes produces ghosting when the subject
 * moves a lot. We crossfade in *signed-distance* space instead, which is what After
 * Effects and Nuke do for shape morphs: the zero-crossing of the blended SDF stays a
 * clean silhouette all the way through.
 */
import { Gray, createGray, cloneGray } from '../core/image.js';
import { clamp01 } from '../core/math.js';

/** Two-pass Felzenszwalb-style Euclidean distance transform (exact EDT, O(n)). */
export function distanceTransform(binary: Uint8Array, width: number, height: number): Float32Array {
  const INF = 1e20;
  const d = new Float32Array(width * height);
  for (let i = 0; i < d.length; i++) d[i] = binary[i] ? 0 : INF;
  // columns
  for (let x = 0; x < width; x++) {
    dt1d(d, x, height, width, 1);
  }
  // rows
  for (let y = 0; y < height; y++) {
    dt1d(d, y * width, width, 1, 1);
  }
  for (let i = 0; i < d.length; i++) d[i] = Math.sqrt(d[i]);
  return d;
}

function dt1d(f: Float32Array, offset: number, n: number, stride: number, _w: number): void {
  const INF = 1e20;
  const v = new Int32Array(n);
  const z = new Float32Array(n + 1);
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[offset + q * stride] + q * q) - (f[offset + v[k] * stride] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k] && k > 0) {
      k--;
      s = ((f[offset + q * stride] + q * q) - (f[offset + v[k] * stride] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    if (s > z[k]) {
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const dq = q - v[k];
    f[offset + q * stride] = dq * dq + f[offset + v[k] * stride];
  }
}

/** Signed distance field: negative inside, positive outside. */
export function signedDistanceField(m: Gray, cutoff = 0.5): Float32Array {
  const { width: w, height: h } = m;
  const inside = new Uint8Array(w * h);
  const outside = new Uint8Array(w * h);
  for (let i = 0; i < m.data.length; i++) {
    const on = m.data[i] >= cutoff;
    inside[i] = on ? 1 : 0;
    outside[i] = on ? 0 : 1;
  }
  const dIn = distanceTransform(inside, w, h);
  const dOut = distanceTransform(outside, w, h);
  const sdf = new Float32Array(w * h);
  for (let i = 0; i < sdf.length; i++) sdf[i] = dOut[i] - dIn[i];
  return sdf;
}

export function sdfToMask(sdf: Float32Array, width: number, height: number, softness = 1): Gray {
  const out = createGray(width, height);
  for (let i = 0; i < sdf.length; i++) {
    out.data[i] = clamp01(0.5 - sdf[i] / (2 * Math.max(0.5, softness)));
  }
  return out;
}

/** Morph between two masks in SDF space. t=0 -> a, t=1 -> b. */
export function morphMasks(a: Gray, b: Gray, t: number, softness = 1): Gray {
  if (t <= 0) return cloneGray(a);
  if (t >= 1) return cloneGray(b);
  if (a.width !== b.width || a.height !== b.height) return t < 0.5 ? cloneGray(a) : cloneGray(b);
  const sa = signedDistanceField(a);
  const sb = signedDistanceField(b);
  const blended = new Float32Array(sa.length);
  for (let i = 0; i < sa.length; i++) blended[i] = sa[i] * (1 - t) + sb[i] * t;
  return sdfToMask(blended, a.width, a.height, softness);
}

/** Copy a mask forward/backward across a frame range with optional morphing. */
export function propagateRange(
  keyframes: Map<number, Gray>,
  from: number,
  to: number,
  width: number,
  height: number,
  mode: 'copy' | 'morph',
): Map<number, Gray> {
  const out = new Map<number, Gray>();
  const keys = [...keyframes.keys()].sort((a, b) => a - b);
  if (keys.length === 0) {
    for (let f = from; f <= to; f++) out.set(f, createGray(width, height));
    return out;
  }
  for (let f = from; f <= to; f++) {
    const explicit = keyframes.get(f);
    if (explicit) {
      out.set(f, explicit);
      continue;
    }
    let prev = keys[0];
    let next = keys[keys.length - 1];
    for (const k of keys) {
      if (k <= f) prev = k;
    }
    for (const k of keys) {
      if (k >= f) {
        next = k;
        break;
      }
    }
    const a = keyframes.get(prev) as Gray;
    const b = keyframes.get(next) as Gray;
    if (mode === 'copy' || prev === next) {
      out.set(f, cloneGray(f - prev <= next - f ? a : b));
    } else {
      const span = next - prev;
      const t = span === 0 ? 0 : (f - prev) / span;
      out.set(f, morphMasks(a, b, t));
    }
  }
  return out;
}
