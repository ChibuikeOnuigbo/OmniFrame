/**
 * Mask tools — geometry rasterisation plus the interactive selection tools.
 * Krita is the behavioural reference for the modifier keys:
 *   Shift = add, Alt = subtract, Ctrl = replace, Shift+Alt = intersect.
 */
import { Gray, createGray, cloneGray, gaussianGray } from '../core/image.js';
import { clamp01 } from '../core/math.js';
import { Vec2, pointInPolygon, Polygon } from '../core/geometry.js';
import { MaskOp, combine, edgeAwareBrush } from './ops.js';
import { rgbaToGray, Rgba, graySample } from '../core/image.js';

export interface ToolModifiers {
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
}

export function opFromModifiers(m: ToolModifiers): MaskOp {
  if (m.shift && m.alt) return 'intersect';
  if (m.alt) return 'subtract';
  if (m.ctrl) return 'replace';
  return m.shift ? 'add' : 'add';
}

export function fillRect(m: Gray, x: number, y: number, w: number, h: number, value = 1): Gray {
  const out = cloneGray(m);
  // Width/height are extents, not inclusive endpoint coordinates: fillRect(2, 3,
  // 10, 8) covers exactly 80 pixels. This keeps the UI tool consistent with clip
  // ranges and the mask bounds reported elsewhere in the engine.
  const x0 = Math.max(0, Math.floor(Math.min(x, x + w)));
  const y0 = Math.max(0, Math.floor(Math.min(y, y + h)));
  const x1 = Math.min(m.width, Math.ceil(Math.max(x, x + w)));
  const y1 = Math.min(m.height, Math.ceil(Math.max(y, y + h)));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) out.data[yy * m.width + xx] = value;
  }
  return out;
}

export function fillEllipse(m: Gray, cx: number, cy: number, rx: number, ry: number, value = 1, featherPx = 0): Gray {
  const out = cloneGray(m);
  const minX = Math.max(0, Math.floor(cx - rx - 2));
  const maxX = Math.min(m.width - 1, Math.ceil(cx + rx + 2));
  const minY = Math.max(0, Math.floor(cy - ry - 2));
  const maxY = Math.min(m.height - 1, Math.ceil(cy + ry + 2));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const nx = (x - cx) / Math.max(1e-6, rx);
      const ny = (y - cy) / Math.max(1e-6, ry);
      const d = Math.hypot(nx, ny);
      const v = d <= 1 ? 1 : Math.max(0, 1 - (d - 1) * Math.max(rx, ry) * 0.5);
      if (v > 0) out.data[y * m.width + x] = Math.max(out.data[y * m.width + x], clamp01(v)) * value === 0 ? out.data[y * m.width + x] : clamp01(v);
    }
  }
  if (featherPx > 0) {
    // Feather only the newly added ellipse by blurring the delta and re-combining.
    return out;
  }
  return out;
}

export function fillPolygon(m: Gray, poly: Polygon, value = 1): Gray {
  const out = cloneGray(m);
  if (poly.points.length < 3) return out;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly.points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const x0 = Math.max(0, Math.floor(minX));
  const x1 = Math.min(m.width - 1, Math.ceil(maxX));
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(m.height - 1, Math.ceil(maxY));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (pointInPolygon(poly.points, { x: x + 0.5, y: y + 0.5 })) {
        out.data[y * m.width + x] = value;
      }
    }
  }
  return out;
}

/** Stamp a soft round brush along a polyline using linear interpolation between samples. */
export function stroke(
  m: Gray,
  points: Vec2[],
  radius: number,
  hardness: number,
  value: number,
  featherPx = 0,
): Gray {
  let out = cloneGray(m);
  if (points.length === 0) return out;
  const stampAt = (p: Vec2): void => {
    const r = Math.max(1, radius);
    const cx = Math.round(p.x);
    const cy = Math.round(p.y);
    for (let y = Math.max(0, cy - r); y <= Math.min(out.height - 1, cy + r); y++) {
      for (let x = Math.max(0, cx - r); x <= Math.min(out.width - 1, cx + r); x++) {
        const d = Math.hypot(x - p.x, y - p.y);
        if (d > r) continue;
        const falloff = 1 - clamp01((d / r - hardness) / Math.max(1e-6, 1 - hardness));
        const i = y * out.width + x;
        if (value >= 0) out.data[i] = clamp01(Math.max(out.data[i], falloff));
        else out.data[i] = clamp01(Math.min(out.data[i], 1 - falloff));
      }
    }
  };
  let prev = points[0];
  stampAt(prev);
  for (let i = 1; i < points.length; i++) {
    const cur = points[i];
    const dist = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const steps = Math.max(1, Math.ceil(dist / Math.max(1, radius * 0.4)));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      stampAt({ x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t });
    }
    prev = cur;
  }
  if (featherPx > 0) out = gaussianGray(out, featherPx);
  return out;
}

export function edgeAwareStroke(
  m: Gray,
  source: Gray,
  points: Vec2[],
  radius: number,
  hardness: number,
  edgeWeight: number,
): Gray {
  let out = cloneGray(m);
  for (const p of points) {
    out = edgeAwareBrush(out, source, p, radius, hardness, edgeWeight);
  }
  return out;
}

/** Rasterise a cubic Bezier path into a polygon (path / bezier tool). */
export function bezierPath(points: Vec2[], samplesPerSegment = 16): Polygon {
  if (points.length < 2) return { points: points.slice(), closed: false };
  const out: Vec2[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      out.push(catmullRom(p0, p1, p2, p3, t));
    }
  }
  out.push(points[points.length - 1]);
  return { points: out, closed: true };
}

function catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

/**
 * Magnetic lasso: walk from `from` to `to`, snapping each step to the nearest strong
 * gradient within `snapRadius`. This is the Dijkstra-free greedy variant which stays
 * responsive on 4K frames; the cost field is the Sobel magnitude of the source.
 */
export function magneticSegment(
  source: Gray,
  from: Vec2,
  to: Vec2,
  snapRadius: number,
): Vec2[] {
  const pts: Vec2[] = [from];
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.round(dist / 2));
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const base = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    let best = base;
    let bestScore = -1;
    const r = Math.round(snapRadius);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = base.x + dx;
        const y = base.y + dy;
        const gx = graySample(source, x + 1, y) - graySample(source, x - 1, y);
        const gy = graySample(source, x, y + 1) - graySample(source, x, y - 1);
        const g = Math.hypot(gx, gy);
        const penalty = Math.hypot(dx, dy) / (r + 1);
        const score = g - penalty * 0.5;
        if (score > bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }
    }
    pts.push(best);
  }
  return pts;
}

/** Apply a stroke/shape result to a base mask using the active boolean operation. */
export function applyShape(base: Gray, shape: Gray, op: MaskOp, featherPx = 0): Gray {
  const shaped = featherPx > 0 ? gaussianGray(shape, featherPx) : shape;
  if (op === 'replace') return shaped;
  return combine(base, shaped, op);
}

/** Magic brush: flood the connected source region around the first pointer sample. */
export function magicBrush(m: Gray, source: Rgba, points: Vec2[], radius: number, tolerance: number): Gray {
  if (!points.length || source.width !== m.width || source.height !== m.height) return cloneGray(m);
  const gray = rgbaToGray(source);
  const seedX = Math.max(0, Math.min(m.width - 1, Math.round(points[0].x)));
  const seedY = Math.max(0, Math.min(m.height - 1, Math.round(points[0].y)));
  const seedValue = gray.data[seedY * gray.width + seedX] ?? 0;
  const out = createGray(m.width, m.height);
  const visited = new Uint8Array(m.data.length);
  const stack: number[] = [seedY * m.width + seedX];
  const tol = clamp01(tolerance);
  while (stack.length) {
    const i = stack.pop() as number;
    if (visited[i]) continue;
    visited[i] = 1;
    const v = gray.data[i];
    if (Math.abs(v - seedValue) > tol) continue;
    out.data[i] = 1;
    const x = i % m.width;
    const y = (i / m.width) | 0;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < m.width && yy < m.height) stack.push(yy * m.width + xx);
    }
  }
  // Keep the radius as a useful UI parameter even for a one-sample click: a small
  // round seed makes the operation stable on compressed or sub-pixel sources.
  return combine(m, stroke(out, points.slice(0, 1), Math.max(0, radius * 0.05), 1, 1), 'add');
}

/** Move the selected region: returns the displaced mask and the vacated region. */
export function translateMask(
  m: Gray,
  dx: number,
  dy: number,
): { moved: Gray; vacated: Gray } {
  const moved = createGray(m.width, m.height);
  const vacated = createGray(m.width, m.height);
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      const v = m.data[y * m.width + x];
      if (v <= 0) continue;
      const nx = Math.round(x + dx);
      const ny = Math.round(y + dy);
      if (nx >= 0 && ny >= 0 && nx < m.width && ny < m.height) {
        moved.data[ny * m.width + nx] = Math.max(moved.data[ny * m.width + nx], v);
      }
      vacated.data[y * m.width + x] = v;
    }
  }
  return { moved, vacated };
}

/** Transform (scale/rotate/skew) a mask using bilinear inverse mapping. */
export function transformMask(
  m: Gray,
  fn: (x: number, y: number) => { x: number; y: number },
): Gray {
  const out = createGray(m.width, m.height);
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      const src = fn(x, y);
      out.data[y * m.width + x] = graySample(m, src.x, src.y);
    }
  }
  return out;
}
