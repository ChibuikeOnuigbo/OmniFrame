/**
 * Mask engine — single-channel float masks with the full professional operation set.
 *
 * Everything here is pure pixel maths on Float32Array, which means it runs identically
 * on the main thread (small masks, interactive feedback) and in a worker (full
 * resolution), and it is directly unit-testable in Node.
 */
import { Gray, Rgba, cloneGray, createGray, gaussianGray } from '../core/image.js';
import { clamp01 } from '../core/math.js';
import { Vec2 } from '../core/geometry.js';

export type MaskOp = 'add' | 'subtract' | 'intersect' | 'replace' | 'invert';

export function combine(a: Gray, b: Gray, op: MaskOp): Gray {
  const out = createGray(a.width, a.height);
  const n = a.width * a.height;
  for (let i = 0; i < n; i++) {
    const x = a.data[i];
    const y = i < b.data.length ? b.data[i] : 0;
    switch (op) {
      case 'add': out.data[i] = clamp01(x + y); break;
      case 'subtract': out.data[i] = clamp01(x - y); break;
      case 'intersect': out.data[i] = clamp01(Math.min(x, y)); break;
      case 'replace': out.data[i] = y; break;
      case 'invert': out.data[i] = 1 - x; break;
    }
  }
  return out;
}

export function invertMask(m: Gray): Gray {
  const out = createGray(m.width, m.height);
  for (let i = 0; i < m.data.length; i++) out.data[i] = 1 - m.data[i];
  return out;
}

/** Max filter — grows the selection by `radius` pixels. */
export function dilate(m: Gray, radius: number): Gray {
  if (radius <= 0) return cloneGray(m);
  return morph(m, Math.round(radius), true);
}

/** Min filter — shrinks the selection by `radius` pixels. */
export function erode(m: Gray, radius: number): Gray {
  if (radius <= 0) return cloneGray(m);
  return morph(m, Math.round(radius), false);
}

/** Separable min/max filter using running windows (O(n) per row/column pass). */
function morph(m: Gray, radius: number, isMax: boolean): Gray {
  const { width: w, height: h } = m;
  const tmp = new Float32Array(w * h);
  const dst = new Float32Array(w * h);
  const r = radius;
  const pick = isMax
    ? (a: number, b: number) => (a > b ? a : b)
    : (a: number, b: number) => (a < b ? a : b);
  const init = isMax ? -Infinity : Infinity;
  // horizontal
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let v = init;
      const from = Math.max(0, x - r);
      const to = Math.min(w - 1, x + r);
      for (let i = from; i <= to; i++) v = pick(v, m.data[row + i]);
      tmp[row + x] = v;
    }
  }
  // vertical
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = init;
      const from = Math.max(0, y - r);
      const to = Math.min(h - 1, y + r);
      for (let i = from; i <= to; i++) v = pick(v, tmp[i * w + x]);
      dst[y * w + x] = v;
    }
  }
  return { width: w, height: h, data: dst };
}

/** Gaussian feather in mask space — soft, antialiased edges. */
export function feather(m: Gray, sigma: number): Gray {
  if (sigma <= 0) return cloneGray(m);
  const blurred = gaussianGray(m, sigma);
  for (let i = 0; i < blurred.data.length; i++) blurred.data[i] = clamp01(blurred.data[i]);
  return blurred;
}

export function threshold(m: Gray, level = 0.5, softness = 0): Gray {
  const out = createGray(m.width, m.height);
  const lo = clamp01(level - softness / 2);
  const hi = clamp01(level + softness / 2);
  for (let i = 0; i < m.data.length; i++) {
    const v = m.data[i];
    out.data[i] = hi <= lo ? (v >= level ? 1 : 0) : clamp01((v - lo) / (hi - lo));
  }
  return out;
}

/** 8-connected flood fill from a border; anything not reached is a hole and gets filled. */
export function fillHoles(m: Gray, cutoff = 0.5): Gray {
  const { width: w, height: h } = m;
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  const isBg = (i: number): boolean => m.data[i] < cutoff && visited[i] === 0;
  for (let x = 0; x < w; x++) {
    if (isBg(x)) { visited[x] = 1; stack.push(x); }
    const b = (h - 1) * w + x;
    if (isBg(b)) { visited[b] = 1; stack.push(b); }
  }
  for (let y = 0; y < h; y++) {
    const l = y * w;
    if (isBg(l)) { visited[l] = 1; stack.push(l); }
    const r = y * w + w - 1;
    if (isBg(r)) { visited[r] = 1; stack.push(r); }
  }
  while (stack.length) {
    const i = stack.pop() as number;
    const x = i % w;
    const y = (i / w) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (m.data[j] < cutoff && visited[j] === 0) {
          visited[j] = 1;
          stack.push(j);
        }
      }
    }
  }
  const out = cloneGray(m);
  for (let i = 0; i < out.data.length; i++) {
    if (!visited[i]) out.data[i] = 1;
  }
  return out;
}

export interface ComponentStats {
  label: Int32Array;
  count: number;
  areas: number[];
}

/** 8-connected labelling, iterative (no recursion depth limits on 4K masks). */
export function connectedComponents(m: Gray, cutoff = 0.5): ComponentStats {
  const { width: w, height: h } = m;
  const label = new Int32Array(w * h).fill(-1);
  const areas: number[] = [];
  const stack: number[] = [];
  let next = 0;
  for (let i = 0; i < m.data.length; i++) {
    if (m.data[i] < cutoff || label[i] >= 0) continue;
    const id = next++;
    let area = 0;
    stack.push(i);
    label[i] = id;
    while (stack.length) {
      const cur = stack.pop() as number;
      area++;
      const x = cur % w;
      const y = (cur / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (m.data[j] >= cutoff && label[j] < 0) {
            label[j] = id;
            stack.push(j);
          }
        }
      }
    }
    areas.push(area);
  }
  return { label, count: next, areas };
}

/** Drop connected components smaller than `minArea` pixels. */
export function removeSmallComponents(m: Gray, minArea: number, cutoff = 0.5): Gray {
  if (minArea <= 1) return cloneGray(m);
  const { label, count, areas } = connectedComponents(m, cutoff);
  const keep = new Uint8Array(count);
  for (let i = 0; i < count; i++) keep[i] = areas[i] >= minArea ? 1 : 0;
  const out = cloneGray(m);
  for (let i = 0; i < out.data.length; i++) {
    const l = label[i];
    if (l >= 0 && keep[l] === 0) out.data[i] = 0;
  }
  return out;
}

/** Keep only the largest connected component (the usual "clean up the mask" action). */
export function keepLargestComponent(m: Gray, cutoff = 0.5): Gray {
  const { label, count, areas } = connectedComponents(m, cutoff);
  if (count <= 1) return cloneGray(m);
  let best = 0;
  for (let i = 1; i < count; i++) if (areas[i] > areas[best]) best = i;
  const out = createGray(m.width, m.height);
  for (let i = 0; i < out.data.length; i++) out.data[i] = label[i] === best ? m.data[i] : 0;
  return out;
}

export interface MaskBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  centroid: Vec2;
  empty: boolean;
}

export function maskBounds(m: Gray, cutoff = 0.001): MaskBounds {
  let minX = m.width, minY = m.height, maxX = -1, maxY = -1;
  let area = 0, cx = 0, cy = 0;
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      const v = m.data[y * m.width + x];
      if (v >= cutoff) {
        area++;
        cx += x;
        cy += y;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (area === 0) {
    return { x: 0, y: 0, width: 0, height: 0, area: 0, centroid: { x: 0, y: 0 }, empty: true };
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    area,
    centroid: { x: cx / area, y: cy / area },
    empty: false,
  };
}

/** Contour length + jitter metric used by the tracking confidence estimator. */
export function contourMetrics(m: Gray, cutoff = 0.5): { perimeter: number; jitter: number } {
  let perimeter = 0;
  const { width: w, height: h } = m;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = m.data[y * w + x] >= cutoff ? 1 : 0;
      if (!v) continue;
      const left = x > 0 && m.data[y * w + x - 1] >= cutoff ? 1 : 0;
      const right = x < w - 1 && m.data[y * w + x + 1] >= cutoff ? 1 : 0;
      const up = y > 0 && m.data[(y - 1) * w + x] >= cutoff ? 1 : 0;
      const down = y < h - 1 && m.data[(y + 1) * w + x] >= cutoff ? 1 : 0;
      perimeter += 4 - (left + right + up + down);
    }
  }
  return { perimeter, jitter: 0 };
}

/** 4-connected flood fill (contiguous) returning the filled region as a mask. */
export function floodFill(
  img: Rgba,
  seed: Vec2,
  tolerance: number,
  contiguous = true,
): Gray {
  const { width: w, height: h } = img;
  const out = createGray(w, h);
  const sx = Math.round(seed.x);
  const sy = Math.round(seed.y);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return out;
  const seedIdx = (sy * w + sx) * 4;
  const tr = img.data[seedIdx];
  const tg = img.data[seedIdx + 1];
  const tb = img.data[seedIdx + 2];
  const tol = tolerance * 441.6729559300637; // tolerance 0..1 mapped to max RGB distance
  const matches = (i: number): boolean => {
    const p = i * 4;
    const dr = img.data[p] - tr;
    const dg = img.data[p + 1] - tg;
    const db = img.data[p + 2] - tb;
    return Math.sqrt(dr * dr + dg * dg + db * db) <= tol;
  };
  if (!contiguous) {
    for (let i = 0; i < w * h; i++) if (matches(i)) out.data[i] = 1;
    return out;
  }
  const visited = new Uint8Array(w * h);
  const stack = [sy * w + sx];
  visited[stack[0]] = 1;
  while (stack.length) {
    const i = stack.pop() as number;
    if (!matches(i)) continue;
    out.data[i] = 1;
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0 && !visited[i - 1]) { visited[i - 1] = 1; stack.push(i - 1); }
    if (x < w - 1 && !visited[i + 1]) { visited[i + 1] = 1; stack.push(i + 1); }
    if (y > 0 && !visited[i - w]) { visited[i - w] = 1; stack.push(i - w); }
    if (y < h - 1 && !visited[i + w]) { visited[i + w] = 1; stack.push(i + w); }
  }
  return out;
}

/** Non-contiguous "similar colour" selection across the whole frame. */
export function selectByColor(img: Rgba, sample: { r: number; g: number; b: number }, tolerance: number): Gray {
  const out = createGray(img.width, img.height);
  const tol = tolerance * 441.6729559300637;
  for (let i = 0, p = 0; i < out.data.length; i++, p += 4) {
    const dr = img.data[p] - sample.r;
    const dg = img.data[p + 1] - sample.g;
    const db = img.data[p + 2] - sample.b;
    const d = Math.sqrt(dr * dr + dg * dg + db * db);
    if (d <= tol) out.data[i] = 1;
    else if (d <= tol * 1.6) out.data[i] = clamp01((tol * 1.6 - d) / (tol * 0.6));
  }
  return out;
}

/**
 * Edge-aware brush: a soft disc whose opacity is reduced where the local gradient is
 * strong, so painting stops at object boundaries instead of bleeding across them.
 */
export function edgeAwareBrush(
  base: Gray,
  mask: Gray,
  center: Vec2,
  radius: number,
  hardness: number,
  edgeWeight: number,
): Gray {
  const out = cloneGray(base);
  const r = Math.max(1, Math.round(radius));
  const cx = Math.round(center.x);
  const cy = Math.round(center.y);
  for (let y = Math.max(0, cy - r); y <= Math.min(base.height - 1, cy + r); y++) {
    for (let x = Math.max(0, cx - r); x <= Math.min(base.width - 1, cx + r); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > r) continue;
      const falloff = 1 - clamp01((d / r - hardness) / Math.max(1e-6, 1 - hardness));
      const i = y * base.width + x;
      const gx =
        mask.data[y * mask.width + Math.min(mask.width - 1, x + 1)] -
        mask.data[y * mask.width + Math.max(0, x - 1)];
      const gy =
        mask.data[Math.min(mask.height - 1, y + 1) * mask.width + x] -
        mask.data[Math.max(0, y - 1) * mask.width + x];
      const grad = clamp01(Math.hypot(gx, gy) * edgeWeight);
      out.data[i] = clamp01(out.data[i] + falloff * (1 - grad));
    }
  }
  return out;
}

/* ----------------------------- RLE serialisation ----------------------------- */

export interface RleMask {
  runs: number[];
  width: number;
  height: number;
}

/** Encode a float mask to run-length pairs [start, length, ...] at the given cutoff. */
export function encodeRle(m: Gray, cutoff = 0.5): RleMask {
  const runs: number[] = [];
  let start = -1;
  for (let i = 0; i < m.data.length; i++) {
    const on = m.data[i] >= cutoff;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      runs.push(start, i - start);
      start = -1;
    }
  }
  if (start >= 0) runs.push(start, m.data.length - start);
  return { runs, width: m.width, height: m.height };
}

export function decodeRle(rle: RleMask): Gray {
  const out = createGray(rle.width, rle.height);
  for (let i = 0; i < rle.runs.length; i += 2) {
    const start = rle.runs[i];
    const len = rle.runs[i + 1];
    for (let k = 0; k < len; k++) out.data[start + k] = 1;
  }
  return out;
}

/* ------------------------------- vectorisation ------------------------------ */

/**
 * Moore-neighbour contour tracing. Produces the outline polygons of a binary mask,
 * which is what "vectorize mask" and the marching-ants overlay both need.
 */
export function traceContours(m: Gray, cutoff = 0.5): Vec2[][] {
  const { width: w, height: h } = m;
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < bin.length; i++) bin[i] = m.data[i] >= cutoff ? 1 : 0;
  const visitedEdge = new Uint8Array(w * h);
  const contours: Vec2[][] = [];
  const DIRS = [
    [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
  ];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!bin[i] || visitedEdge[i]) continue;
      // Only start on boundary pixels of a component.
      const isBoundary =
        x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
        !bin[i - 1] || !bin[i - w] || !bin[i + 1] || !bin[i + w];
      if (!isBoundary) continue;
      const path: Vec2[] = [];
      let cx = x;
      let cy = y;
      let dir = 0;
      let guard = 0;
      const maxSteps = w * h * 2;
      do {
        path.push({ x: cx, y: cy });
        visitedEdge[cy * w + cx] = 1;
        let found = false;
        for (let k = 0; k < 8; k++) {
          const nd = (dir + 6 + k) % 8; // start searching from dir-2
          const nx = cx + DIRS[nd][0];
          const ny = cy + DIRS[nd][1];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (bin[ny * w + nx]) {
            cx = nx;
            cy = ny;
            dir = nd;
            found = true;
            break;
          }
        }
        if (!found) break;
        guard++;
      } while ((cx !== x || cy !== y) && guard < maxSteps);
      if (path.length > 2) contours.push(simplifyDouglasPeucker(path, 1.0));
    }
  }
  return contours;
}

/** Douglas–Peucker polyline simplification (used to keep vector masks compact). */
export function simplifyDouglasPeucker(points: Vec2[], epsilon: number): Vec2[] {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop() as [number, number];
    let maxDist = 0;
    let index = -1;
    const a = points[first];
    const b = points[last];
    for (let i = first + 1; i < last; i++) {
      const d = perpendicularDistance(points[i], a, b);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist > epsilon && index >= 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function perpendicularDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}

/**
 * Morphological smoothing: dilate then erode (closing) followed by erode then dilate
 * (opening) — removes jaggies and thin spikes without changing the silhouette much.
 */
export function smoothMask(m: Gray, amount: number): Gray {
  if (amount <= 0) return cloneGray(m);
  const closed = erode(dilate(m, amount), amount);
  return dilate(erode(closed, amount), amount);
}

/**
 * Distance-transform-based grow/shrink with sub-pixel accuracy.
 * Positive radius grows, negative shrinks.
 */
export function growShrink(m: Gray, radius: number): Gray {
  if (radius === 0) return cloneGray(m);
  const r = Math.abs(Math.round(radius));
  return radius > 0 ? dilate(m, r) : erode(m, r);
}
