/**
 * Global camera motion estimation.
 *
 * Separating camera motion from object motion is essential for handheld or panning
 * footage: without it a sideways camera move looks identical to the subject sliding.
 * We fit a 6-parameter affine by RANSAC over all correspondences, so the dominant
 * motion (the camera) wins and the subject's own motion shows up as outliers.
 */
import { Vec2, Mat3, fitAffine, mat3Apply, mat3Invert, MAT3_IDENTITY, fitHomography } from '../core/geometry.js';
import { makeRng } from '../core/math.js';

export type MotionModel = 'translation' | 'affine' | 'homography';

export interface MotionEstimate {
  model: MotionModel;
  matrix: Mat3;
  inliers: boolean[];
  inlierCount: number;
  /** mean reprojection error over the inliers, in pixels */
  residual: number;
}

export interface RansacOptions {
  model: MotionModel;
  /** inlier threshold in pixels */
  threshold: number;
  /** explicit iteration count; 0 = auto from the inlier ratio */
  iterations: number;
  /** stop early once this fraction of points are inliers */
  confidence: number;
  seed?: number;
}

export const DEFAULT_RANSAC: RansacOptions = {
  model: 'affine',
  threshold: 2.0,
  iterations: 0,
  confidence: 0.95,
  seed: 7,
};

export function estimateGlobalMotion(
  src: Vec2[],
  dst: Vec2[],
  opts: Partial<RansacOptions> = {},
): MotionEstimate {
  const o = { ...DEFAULT_RANSAC, ...opts };
  const n = Math.min(src.length, dst.length);
  if (n < 3) return identityEstimate(n);
  if (o.model === 'translation') return estimateTranslation(src, dst, o);

  const minSample = o.model === 'homography' ? 4 : 3;
  if (n < minSample) return identityEstimate(n);

  const rng = makeRng(o.seed);
  const fit = o.model === 'homography' ? fitHomography : fitAffine;
  const autoIters = o.iterations > 0 ? o.iterations : 200;
  let best: { matrix: Mat3; inliers: boolean[]; count: number } | null = null;

  for (let it = 0; it < autoIters; it++) {
    const idx = sampleIndices(n, minSample, rng);
    const s = idx.map((i) => src[i]);
    const d = idx.map((i) => dst[i]);
    const r = fit(s, d);
    if (!r) continue;
    const inliers = new Array<boolean>(n).fill(false);
    let count = 0;
    for (let i = 0; i < n; i++) {
      const p = mat3Apply(r.matrix, src[i]);
      if (Math.hypot(p.x - dst[i].x, p.y - dst[i].y) <= o.threshold) {
        inliers[i] = true;
        count++;
      }
    }
    if (!best || count > best.count) {
      best = { matrix: r.matrix, inliers, count };
      // Adaptive iteration count from the current best inlier ratio.
      if (o.iterations === 0 && count > minSample) {
        const w = count / n;
        const pAll = Math.pow(Math.max(w, 1e-6), minSample);
        if (pAll > 1e-9) {
          const needed = Math.log(1 - o.confidence) / Math.log(1 - pAll);
          if (it >= Math.min(autoIters, needed)) break;
        }
      }
    }
  }
  if (!best) return identityEstimate(n);

  // Refit on all inliers for a least-squares optimal model.
  const inSrc: Vec2[] = [];
  const inDst: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    if (best.inliers[i]) {
      inSrc.push(src[i]);
      inDst.push(dst[i]);
    }
  }
  const refined = fit(inSrc, inDst);
  const matrix = refined?.matrix ?? best.matrix;
  let residual = 0;
  for (let i = 0; i < inSrc.length; i++) {
    const p = mat3Apply(matrix, inSrc[i]);
    residual += Math.hypot(p.x - inDst[i].x, p.y - inDst[i].y);
  }
  residual = inSrc.length ? residual / inSrc.length : 0;
  return {
    model: o.model,
    matrix,
    inliers: best.inliers,
    inlierCount: best.count,
    residual,
  };
}

function estimateTranslation(src: Vec2[], dst: Vec2[], o: RansacOptions): MotionEstimate {
  const n = Math.min(src.length, dst.length);
  // Median of the displacement vectors is robust to a moving subject.
  const dxs = src.map((p, i) => dst[i].x - p.x).sort((a, b) => a - b);
  const dys = src.map((p, i) => dst[i].y - p.y).sort((a, b) => a - b);
  const tx = dxs[Math.floor(n / 2)] ?? 0;
  const ty = dys[Math.floor(n / 2)] ?? 0;
  const matrix: Mat3 = [1, 0, tx, 0, 1, ty, 0, 0, 1];
  const inliers = src.map((p, i) => Math.hypot(dst[i].x - p.x - tx, dst[i].y - p.y - ty) <= o.threshold);
  const count = inliers.filter(Boolean).length;
  let residual = 0;
  let c = 0;
  src.forEach((p, i) => {
    if (inliers[i]) {
      residual += Math.hypot(dst[i].x - p.x - tx, dst[i].y - p.y - ty);
      c++;
    }
  });
  return {
    model: 'translation',
    matrix,
    inliers,
    inlierCount: count,
    residual: c ? residual / c : 0,
  };
}

function identityEstimate(n: number): MotionEstimate {
  return {
    model: 'translation',
    matrix: MAT3_IDENTITY,
    inliers: new Array(n).fill(false),
    inlierCount: 0,
    residual: 0,
  };
}

function sampleIndices(n: number, k: number, rng: () => number): number[] {
  const out = new Set<number>();
  let guard = 0;
  while (out.size < k && guard++ < 100) out.add(Math.floor(rng() * n));
  return [...out];
}

/** Remove the camera component so what remains is object motion. */
export function removeGlobalMotion(points: Vec2[], motion: Mat3): Vec2[] {
  const inv = mat3Invert(motion);
  if (!inv) return points.slice();
  return points.map((p) => mat3Apply(inv, p));
}

/** Extract translation + rotation + scale from an affine matrix (for the UI readout). */
export function decomposeAffine(m: Mat3): {
  tx: number; ty: number; rotation: number; scaleX: number; scaleY: number; skew: number;
} {
  const a = m[0], b = m[1], c = m[3], d = m[4];
  const scaleX = Math.hypot(a, b);
  const scaleY = Math.hypot(c, d);
  const rotation = Math.atan2(b, a);
  const skew = Math.atan2(d, c) - Math.PI / 2 - rotation;
  return { tx: m[2], ty: m[5], rotation, scaleX, scaleY, skew };
}
