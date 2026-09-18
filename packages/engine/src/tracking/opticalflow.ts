/**
 * Pyramidal Lucas–Kanade optical flow (Bouguet's formulation).
 *
 * For every feature we solve, per pyramid level from coarse to fine,
 *
 *     G · δ = Σ_w ( I_prev(p+d) − I_cur(p+g+d) ) · ∇I_prev(p+d)
 *
 * with G the structure tensor of the previous image inside the window. The coarse
 * levels capture large motion; the finest level refines to sub-pixel accuracy.
 *
 * Deliberate design choice: identity is carried by the *gradient structure* of the local
 * window, not by raw RGB. That is why the tracker survives illumination and colour
 * change — the residual is a photometric difference weighted by ∇I, and a colour
 * change that preserves edge structure leaves the gradient field intact.
 */
import { Gray, graySample } from '../core/image.js';
import { Vec2 } from '../core/geometry.js';
import { Pyramid, toLevel } from './pyramid.js';

export interface FlowOptions {
  windowSize: number;
  iterations: number;
  minEigThreshold: number;
  /** early exit when the displacement update is below this (px at the current level) */
  epsilon: number;
}

export const DEFAULT_FLOW_OPTIONS: FlowOptions = {
  windowSize: 11,
  iterations: 20,
  minEigThreshold: 1e-4,
  epsilon: 0.03,
};

export interface FlowResult {
  pos: Vec2;
  status: 'tracked' | 'outOfBounds' | 'singular';
  error: number;
}

export interface FlowInput {
  /** position in level-0 coordinates */
  point: Vec2;
  /** optional initial guess for the displacement (level-0 px) */
  guess?: Vec2;
}

export function calcOpticalFlowPyrLK(
  prevPyr: Pyramid,
  nextPyr: Pyramid,
  inputs: FlowInput[],
  opts: Partial<FlowOptions> = {},
): FlowResult[] {
  const o = { ...DEFAULT_FLOW_OPTIONS, ...opts };
  const half = Math.max(1, Math.floor(o.windowSize / 2));
  const maxLevel = Math.min(prevPyr.levels.length, nextPyr.levels.length) - 1;
  const factor = prevPyr.factor;

  return inputs.map((input) => trackPoint(prevPyr, nextPyr, input, half, maxLevel, factor, o));
}

function trackPoint(
  prevPyr: Pyramid,
  nextPyr: Pyramid,
  input: FlowInput,
  half: number,
  maxLevel: number,
  factor: number,
  o: FlowOptions,
): FlowResult {
  let gx = input.guess?.x ?? 0;
  let gy = input.guess?.y ?? 0;

  for (let level = maxLevel; level >= 0; level--) {
    const prev = prevPyr.levels[level];
    const next = nextPyr.levels[level];
    const scale = Math.pow(factor, level);
    const p = toLevel(input.point, level, factor);
    let dx = gx / scale;
    let dy = gy / scale;

    // Pre-compute the structure tensor and the reference patch for this level.
    let Gxx = 0, Gyy = 0, Gxy = 0;
    const win = (2 * half + 1) * (2 * half + 1);
    const refIx = new Float32Array(win);
    // Separate buffers: aliasing these two would silently make both axes use dI/dy.
    const refIy = new Float32Array(win);
    const refI = new Float32Array(win);
    let n = 0;
    for (let wy = -half; wy <= half; wy++) {
      for (let wx = -half; wx <= half; wx++) {
        const x = p.x + wx;
        const y = p.y + wy;
        const ix = (graySample(prev, x + 1, y) - graySample(prev, x - 1, y)) * 0.5;
        const iy = (graySample(prev, x, y + 1) - graySample(prev, x, y - 1)) * 0.5;
        const k = n++;
        refIx[k] = ix;
        refIy[k] = iy;
        refI[k] = graySample(prev, x, y);
        Gxx += ix * ix;
        Gyy += iy * iy;
        Gxy += ix * iy;
      }
    }
    const det = Gxx * Gyy - Gxy * Gxy;
    const trace = Gxx + Gyy;
    const minEig = trace / 2 - Math.sqrt(Math.max(0, (trace * trace) / 4 - det));
    if (Math.abs(det) < 1e-12 || minEig < o.minEigThreshold) {
      // Aperture problem: this window is flat or a pure edge. Cannot be resolved.
      if (level === 0) return { pos: { x: input.point.x + gx, y: input.point.y + gy }, status: 'singular', error: 0 };
      gx *= factor;
      gy *= factor;
      continue;
    }
    const invDet = 1 / det;
    let errSum = 0;
    for (let iter = 0; iter < o.iterations; iter++) {
      let bx = 0, by = 0;
      errSum = 0;
      let k = 0;
      for (let wy = -half; wy <= half; wy++) {
        for (let wx = -half; wx <= half; wx++) {
          const x = p.x + wx;
          const y = p.y + wy;
          const cur = graySample(next, x + dx, y + dy);
          const r = refI[k] - cur;
          errSum += r * r;
          bx += r * refIx[k];
          by += r * refIy[k];
          k++;
        }
      }
      const ddx = (Gyy * bx - Gxy * by) * invDet;
      const ddy = (Gxx * by - Gxy * bx) * invDet;
      dx += ddx;
      dy += ddy;
      if (Math.abs(ddx) < o.epsilon && Math.abs(ddy) < o.epsilon) break;
    }
    gx = dx * scale;
    gy = dy * scale;
  }

  const finalX = input.point.x + gx;
  const finalY = input.point.y + gy;
  const outOfBounds =
    finalX < 0 || finalY < 0 || finalX > nextPyr.levels[0].width - 1 || finalY > nextPyr.levels[0].height - 1;
  return {
    pos: { x: finalX, y: finalY },
    status: outOfBounds ? 'outOfBounds' : 'tracked',
    error: Math.sqrt(errSquaredAt(prevPyr.levels[0], nextPyr.levels[0], input.point, gx, gy, half)),
  };
}

/** Photometric residual at level 0 for the converged displacement (used as error metric). */
function errSquaredAt(prev: Gray, next: Gray, p: Vec2, gx: number, gy: number, half: number): number {
  let s = 0;
  let n = 0;
  for (let wy = -half; wy <= half; wy += 2) {
    for (let wx = -half; wx <= half; wx += 2) {
      const a = graySample(prev, p.x + wx, p.y + wy);
      const b = graySample(next, p.x + gx + wx, p.y + gy + wy);
      s += (a - b) * (a - b);
      n++;
    }
  }
  return n ? s / n : 0;
}

/**
 * Forward/backward consistency check.
 *
 * A point is tracked A->B and then B->A. If the round trip does not return close to the
 * origin the correspondence is unreliable — typically because something else moved into
 * the original location, or the point became occluded. This is the specific defence
 * against treating "same location" as "same pixel".
 */
export interface FbCheck {
  ok: boolean;
  /** round-trip reprojection error in level-0 pixels */
  error: number;
  /** where the backward pass thinks the point came from */
  back: Vec2;
}

export function forwardBackwardCheck(
  prevPyr: Pyramid,
  nextPyr: Pyramid,
  origins: Vec2[],
  results: FlowResult[],
  threshold: number,
  opts: Partial<FlowOptions> = {},
): FbCheck[] {
  const back = calcOpticalFlowPyrLK(
    nextPyr,
    prevPyr,
    results.map((r) => ({ point: r.pos })),
    opts,
  );
  return results.map((r, i) => {
    const b = back[i];
    const o = origins[i];
    const err =
      b && o
        ? Math.hypot(b.pos.x - o.x, b.pos.y - o.y)
        : Number.POSITIVE_INFINITY;
    return {
      ok: r.status === 'tracked' && Number.isFinite(err) && err <= threshold,
      error: err,
      back: b ? b.pos : { x: 0, y: 0 },
    };
  });
}
