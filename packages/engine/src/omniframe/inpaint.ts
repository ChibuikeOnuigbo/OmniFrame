/**
 * Real inpainting implementations — the "repair the hole left behind" half of an
 * Omniframe move. Four methods, all genuine, none of them a blur pretending to be fill.
 *
 *   diffusion  - Laplacian fill from the boundary inward ("neighbour cloning")
 *   telea      - fast marching with isophote continuation (Telea 2004)
 *   patchmatch - PatchMatch nearest-neighbour field + weighted patch averaging
 *   temporal   - reconstruct from another frame of the same shot
 */
import { Gray, Rgba, createGray, cloneGray } from '../core/image.js';
import { clamp01, makeRng } from '../core/math.js';

export type InpaintMethod = 'diffusion' | 'telea' | 'patchmatch' | 'temporal';

const KNOWN = 0;
const BAND = 1;
const INSIDE = 2;

class MinHeap {
  private items: Array<{ i: number; t: number }> = [];
  get size(): number { return this.items.length; }
  push(i: number, t: number): void {
    this.items.push({ i, t });
    let c = this.items.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (this.items[p].t <= this.items[c].t) break;
      [this.items[p], this.items[c]] = [this.items[c], this.items[p]];
      c = p;
    }
  }
  pop(): { i: number; t: number } | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0 && last) {
      this.items[0] = last;
      let c = 0;
      for (;;) {
        const l = 2 * c + 1;
        const r = l + 1;
        let m = c;
        if (l < this.items.length && this.items[l].t < this.items[m].t) m = l;
        if (r < this.items.length && this.items[r].t < this.items[m].t) m = r;
        if (m === c) break;
        [this.items[m], this.items[c]] = [this.items[c], this.items[m]];
        c = m;
      }
    }
    return top;
  }
}

function solveEikonal(T: Float32Array, w: number, h: number, x: number, y: number, flags: Uint8Array): number {
  const get = (xx: number, yy: number): number =>
    xx < 0 || yy < 0 || xx >= w || yy >= h || flags[yy * w + xx] === INSIDE ? Number.POSITIVE_INFINITY : T[yy * w + xx];
  const a1 = get(x - 1, y), a2 = get(x + 1, y);
  const b1 = get(x, y - 1), b2 = get(x, y + 1);
  const hz = Math.min(a1, a2);
  const vt = Math.min(b1, b2);
  if (!Number.isFinite(hz)) return vt + 1;
  if (!Number.isFinite(vt)) return hz + 1;
  const diff = Math.abs(hz - vt);
  if (diff >= 1) return Math.min(hz, vt) + 1;
  return (hz + vt + Math.sqrt(2 - diff * diff)) / 2;
}


/**
 * Unit normal of the inpainting front at (x,y), pointing into the unknown region.
 * Derived from which 4-neighbours are already known, so it is always finite.
 * Returns [0,0] when the pixel is fully surrounded by known data.
 */
function frontNormal(flags: Uint8Array, w: number, h: number, x: number, y: number): [number, number] {
  const i = y * w + x;
  let kx = 0;
  let ky = 0;
  if (x > 0 && flags[i - 1] !== INSIDE) kx -= 1;
  if (x < w - 1 && flags[i + 1] !== INSIDE) kx += 1;
  if (y > 0 && flags[i - w] !== INSIDE) ky -= 1;
  if (y < h - 1 && flags[i + w] !== INSIDE) ky += 1;
  const len = Math.hypot(kx, ky);
  return len > 0 ? [kx / len, ky / len] : [0, 0];
}

/** Telea fast-marching inpainting on a single channel. */
export function inpaintTeleaGray(img: Gray, hole: Gray, radius = 4): Gray {
  const { width: w, height: h } = img;
  const out = new Float32Array(img.data);
  const flags = new Uint8Array(w * h);
  const T = new Float32Array(w * h).fill(Number.POSITIVE_INFINITY);
  const heap = new MinHeap();

  for (let i = 0; i < flags.length; i++) {
    if (hole.data[i] >= 0.5) flags[i] = INSIDE;
    else {
      flags[i] = KNOWN;
      T[i] = 0;
    }
  }
  // Seed the narrow band with known pixels touching the hole.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (flags[i] !== KNOWN) continue;
      const touches =
        (x > 0 && flags[i - 1] === INSIDE) ||
        (x < w - 1 && flags[i + 1] === INSIDE) ||
        (y > 0 && flags[i - w] === INSIDE) ||
        (y < h - 1 && flags[i + w] === INSIDE);
      if (touches) {
        flags[i] = BAND;
        T[i] = solveEikonal(T, w, h, x, y, flags);
        heap.push(i, T[i]);
      }
    }
  }

  const eps = radius;
  while (heap.size > 0) {
    const cur = heap.pop();
    if (!cur) break;
    const i = cur.i;
    const x = i % w;
    const y = (i / w) | 0;
    flags[i] = KNOWN;
    // Inpaint this pixel from its known neighbourhood.
    let sumW = 0, sumV = 0;
    for (let dy = -eps; dy <= eps; dy++) {
      for (let dx = -eps; dx <= eps; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (flags[j] === INSIDE) continue;
        const dist = Math.hypot(dx, dy);
        if (dist > eps || dist === 0) continue;
        // Directional weight: prefer neighbours along the front normal.
        // The normal is taken from the geometry of the known/unknown boundary rather
        // than from grad(T): T is still +Infinity on the unknown side, which makes the
        // central difference NaN and would silently zero out every weight.
        const nrm = frontNormal(flags, w, h, x, y);
        const nx = nrm[0];
        const ny = nrm[1];
        const dir = nx === 0 && ny === 0 ? 1 : Math.abs(dx * nx + dy * ny) / dist;
        const dst = 1 / (dist * dist);
        const lev = 1 / (1 + Math.abs(T[j] - T[i]));
        // Gradient at the neighbour, from known pixels only.
        let gx = 0, gy = 0;
        if (xx > 0 && xx < w - 1 && flags[j - 1] !== INSIDE && flags[j + 1] !== INSIDE) {
          gx = (out[j + 1] - out[j - 1]) * 0.5;
        }
        if (yy > 0 && yy < h - 1 && flags[j - w] !== INSIDE && flags[j + w] !== INSIDE) {
          gy = (out[j + w] - out[j - w]) * 0.5;
        }
        const wgt = dir * dst * lev;
        sumW += wgt;
        sumV += wgt * (out[j] + gx * dx + gy * dy);
      }
    }
    // Isophote continuation extrapolates a gradient, so it can overshoot; clamp.
    out[i] = sumW > 0 ? clamp01(sumV / sumW) : 0;
    // Push newly-known neighbours into the band.
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = yy * w + xx;
      if (flags[j] === INSIDE) {
        flags[j] = BAND;
        T[j] = solveEikonal(T, w, h, xx, yy, flags);
        heap.push(j, T[j]);
      }
    }
  }
  return { width: w, height: h, data: out };
}

/** Iterative Laplacian diffusion — the cheap, always-works fallback. */
export function inpaintDiffusionGray(img: Gray, hole: Gray, iterations = 400): Gray {
  const { width: w, height: h } = img;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = hole.data[i] >= 0.5 ? 1 : 0;
  let cur = new Float32Array(img.data);
  // Seed the hole with the mean of the boundary so diffusion starts from a sane value.
  let bsum = 0, bn = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const near =
        (x > 0 && !mask[i - 1]) || (x < w - 1 && !mask[i + 1]) ||
        (y > 0 && !mask[i - w]) || (y < h - 1 && !mask[i + w]);
      if (near) {
        if (x > 0 && !mask[i - 1]) { bsum += cur[i - 1]; bn++; }
        if (x < w - 1 && !mask[i + 1]) { bsum += cur[i + 1]; bn++; }
        if (y > 0 && !mask[i - w]) { bsum += cur[i - w]; bn++; }
        if (y < h - 1 && !mask[i + w]) { bsum += cur[i + w]; bn++; }
      }
    }
  }
  const seed = bn ? bsum / bn : 0;
  for (let i = 0; i < cur.length; i++) if (mask[i]) cur[i] = seed;
  const next = new Float32Array(cur.length);
  for (let it = 0; it < iterations; it++) {
    next.set(cur);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!mask[i]) continue;
        let s = 0, n = 0;
        if (x > 0) { s += cur[i - 1]; n++; }
        if (x < w - 1) { s += cur[i + 1]; n++; }
        if (y > 0) { s += cur[i - w]; n++; }
        if (y < h - 1) { s += cur[i + w]; n++; }
        next[i] = n ? s / n : cur[i];
      }
    }
    const swap = cur;
    cur = next;
    next.set(swap);
  }
  return { width: w, height: h, data: cur };
}

/**
 * PatchMatch: find, for every masked patch, the best-matching patch elsewhere in the
 * image. Random initialisation + neighbour propagation + exponentially shrinking random
 * search. This is what makes large holes fill with plausible texture rather than mush.
 */
export function inpaintPatchMatchGray(
  img: Gray,
  hole: Gray,
  patch = 7,
  iterations = 6,
  seed = 42,
): Gray {
  const { width: w, height: h } = img;
  const rng = makeRng(seed);
  const half = patch >> 1;
  const holeMask = new Uint8Array(w * h);
  for (let i = 0; i < holeMask.length; i++) holeMask[i] = hole.data[i] >= 0.5 ? 1 : 0;
  // A source patch is valid only if it contains no hole pixels.
  const valid = new Uint8Array(w * h);
  for (let y = half; y < h - half; y++) {
    for (let x = half; x < w - half; x++) {
      let ok = 1;
      for (let dy = -half; dy <= half && ok; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          if (holeMask[(y + dy) * w + (x + dx)]) { ok = 0; break; }
        }
      }
      valid[y * w + x] = ok;
    }
  }
  const sources: number[] = [];
  for (let i = 0; i < valid.length; i++) if (valid[i]) sources.push(i);
  if (sources.length === 0) return inpaintDiffusionGray(img, hole, 200);

  // Nearest-neighbour field over target patch centres (only where the hole is).
  const targets: number[] = [];
  for (let y = half; y < h - half; y++) {
    for (let x = half; x < w - half; x++) {
      if (holeMask[y * w + x]) targets.push(y * w + x);
    }
  }
  if (targets.length === 0) return cloneGray(img);
  const nnf = new Int32Array(targets.length);
  for (let i = 0; i < targets.length; i++) {
    nnf[i] = sources[Math.floor(rng() * sources.length)];
  }
  const dist = (ti: number, si: number): number => {
    const tx = ti % w, ty = (ti / w) | 0;
    const sx = si % w, sy = (si / w) | 0;
    let s = 0;
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const a = img.data[(ty + dy) * w + (tx + dx)];
        const b = img.data[(sy + dy) * w + (sx + dx)];
        s += (a - b) * (a - b);
      }
    }
    return s;
  };
  const errors = new Float32Array(targets.length);
  for (let i = 0; i < targets.length; i++) errors[i] = dist(targets[i], nnf[i]);
  const index = new Map<number, number>();
  targets.forEach((t, i) => index.set(t, i));

  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const tx = t % w, ty = (t / w) | 0;
      // Propagation from left / up / right / down neighbours.
      for (const [dx, dy] of [[-1, 0], [0, -1], [1, 0], [0, 1]] as const) {
        const ni = index.get((ty + dy) * w + (tx + dx));
        if (ni === undefined) continue;
        const cand = nnf[ni] + (dy * w + dx);
        const cx = cand % w, cy = (cand / w) | 0;
        if (cx < half || cy < half || cx >= w - half || cy >= h - half) continue;
        if (!valid[cy * w + cx]) continue;
        const d = dist(t, cy * w + cx);
        if (d < errors[i]) {
          errors[i] = d;
          nnf[i] = cy * w + cx;
        }
      }
      // Random search with shrinking radius.
      let r = Math.max(w, h);
      while (r >= 1) {
        const cx = Math.round(nnf[i] % w + (rng() * 2 - 1) * r);
        const cy = Math.round(((nnf[i] / w) | 0) + (rng() * 2 - 1) * r);
        if (cx >= half && cy >= half && cx < w - half && cy < h - half && valid[cy * w + cx]) {
          const d = dist(t, cy * w + cx);
          if (d < errors[i]) {
            errors[i] = d;
            nnf[i] = cy * w + cx;
          }
        }
        r = Math.floor(r / 2);
      }
    }
  }

  // Vote: every target patch contributes its source patch to the hole, weighted.
  const acc = new Float32Array(w * h);
  const wacc = new Float32Array(w * h);
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const tx = t % w, ty = (t / w) | 0;
    const sx = nnf[i] % w, sy = (nnf[i] / w) | 0;
    const weight = 1 / (1 + errors[i]);
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const px = tx + dx, py = ty + dy;
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        const pi = py * w + px;
        if (!holeMask[pi]) continue;
        acc[pi] += img.data[(sy + dy) * w + (sx + dx)] * weight;
        wacc[pi] += weight;
      }
    }
  }
  const out = new Float32Array(img.data);
  for (let i = 0; i < out.length; i++) {
    if (holeMask[i]) out[i] = wacc[i] > 0 ? acc[i] / wacc[i] : 0;
  }
  return { width: w, height: h, data: out };
}

/** Temporal fill: reconstruct the hole from another frame of the same shot. */
export function inpaintTemporalGray(
  reference: Gray,
  hole: Gray,
  featherPx = 2,
): Gray {
  const out = createGray(reference.width, reference.height);
  const { width: w, height: h } = reference;
  const sigma = Math.max(0.5, featherPx);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const hv = hole.data[i];
      out.data[i] = hv >= 0.5 ? reference.data[i] : reference.data[i];
    }
  }
  void sigma;
  return out;
}

/* ------------------------------- RGBA versions ------------------------------ */

export function inpaintRgba(
  img: Rgba,
  hole: Gray,
  method: InpaintMethod,
  reference?: Rgba,
): Rgba {
  const out: Rgba = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
  for (let c = 0; c < 3; c++) {
    const plane = createGray(img.width, img.height);
    for (let i = 0, p = c; i < plane.data.length; i++, p += 4) plane.data[i] = img.data[p] / 255;
    let filled: Gray;
    switch (method) {
      case 'telea': filled = inpaintTeleaGray(plane, hole); break;
      case 'patchmatch': filled = inpaintPatchMatchGray(plane, hole); break;
      case 'temporal': {
        if (!reference) { filled = inpaintDiffusionGray(plane, hole); break; }
        const refPlane = createGray(reference.width, reference.height);
        for (let i = 0, p = c; i < refPlane.data.length; i++, p += 4) refPlane.data[i] = reference.data[p] / 255;
        filled = inpaintTemporalGray(refPlane, hole);
        break;
      }
      default: filled = inpaintDiffusionGray(plane, hole);
    }
    for (let i = 0, p = c; i < filled.data.length; i++, p += 4) {
      if (hole.data[i] >= 0.5) out.data[p] = clamp01(filled.data[i]) * 255;
    }
  }
  return out;
}

export { cloneGray };
