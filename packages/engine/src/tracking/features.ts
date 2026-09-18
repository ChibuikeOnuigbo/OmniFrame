/**
 * Shi-Tomasi corner detection ("good features to track").
 *
 * Score = min eigenvalue of the 3x3 structure tensor. Corners (not edges, not flat
 * areas) score high, which is exactly what a tracker needs: a corner constrains motion
 * in both axes, an edge only in one.
 */
import { Gray } from '../core/image.js';
import { Vec2 } from '../core/geometry.js';
import { makeRng } from '../core/math.js';

export interface FeatureOptions {
  maxFeatures: number;
  quality: number;
  minDistance: number;
  blockSize: number;
  /** restrict detection to a region (mask), values > 0.5 are considered */
  mask?: Gray;
  /** bias sampling towards the boundary: 0 = uniform, 1 = boundary only */
  edgeBias?: number;
  seed?: number;
}

export const DEFAULT_FEATURE_OPTIONS: FeatureOptions = {
  maxFeatures: 200,
  quality: 0.05,
  minDistance: 8,
  blockSize: 5,
  edgeBias: 0.4,
  seed: 1337,
};

export interface Feature extends Vec2 {
  score: number;
}

export function goodFeaturesToTrack(img: Gray, opts: Partial<FeatureOptions> = {}): Feature[] {
  const o: FeatureOptions = { ...DEFAULT_FEATURE_OPTIONS, ...opts };
  const { width: w, height: h } = img;
  const r = Math.max(1, Math.floor(o.blockSize / 2));
  const scores = new Float32Array(w * h);
  let maxScore = 0;
  for (let y = r; y < h - r; y++) {
    for (let x = r; x < w - r; x++) {
      if (o.mask && o.mask.data[y * w + x] <= 0.5) continue;
      let sxx = 0, syy = 0, sxy = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const i = (y + dy) * w + (x + dx);
          const ix = (img.data[i + 1] - img.data[i - 1]) * 0.5;
          const iy = (img.data[i + w] - img.data[i - w]) * 0.5;
          sxx += ix * ix;
          syy += iy * iy;
          sxy += ix * iy;
        }
      }
      const trace = sxx + syy;
      const det = sxx * syy - sxy * sxy;
      const disc = Math.sqrt(Math.max(0, trace * trace / 4 - det));
      const minEig = trace / 2 - disc;
      // Boundary bias: multiply the score by proximity to a gradient so that points
      // concentrate where the silhouette can actually be observed.
      let weight = 1;
      if (o.edgeBias && o.mask) {
        const c = o.mask.data[y * w + x];
        const l = o.mask.data[y * w + Math.max(0, x - 3)];
        const rr = o.mask.data[y * w + Math.min(w - 1, x + 3)];
        const u = o.mask.data[Math.max(0, y - 3) * w + x];
        const d = o.mask.data[Math.min(h - 1, y + 3) * w + x];
        const nearEdge = Math.abs(c - l) + Math.abs(c - rr) + Math.abs(c - u) + Math.abs(c - d);
        weight = 1 + o.edgeBias * 3 * Math.min(1, nearEdge * 4);
      }
      const s = minEig * weight;
      scores[y * w + x] = s;
      if (s > maxScore) maxScore = s;
    }
  }
  // A genuinely flat image has no trackable structure. Returning "uniform" points here
  // would let the tracker claim motion it cannot observe, so we return nothing.
  if (maxScore <= 0) return [];
  const cutoff = maxScore * o.quality;
  const candidates: Feature[] = [];
  for (let y = r; y < h - r; y++) {
    for (let x = r; x < w - r; x++) {
      const s = scores[y * w + x];
      if (s <= cutoff) continue;
      // non-maximum suppression in a 3x3
      let isMax = true;
      for (let dy = -1; dy <= 1 && isMax; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (scores[(y + dy) * w + (x + dx)] > s) {
            isMax = false;
            break;
          }
        }
      }
      if (isMax) candidates.push({ x, y, score: s });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const kept = enforceMinDistance(candidates, o.minDistance, o.maxFeatures);
  // Only pad with a uniform grid when real corners exist but are too sparse to cover
  // the region; never on an image with no structure at all.
  if (kept.length < Math.max(4, o.maxFeatures * 0.2) && maxScore > 0) {
    const pad = uniformFallback(img, { ...o, maxFeatures: o.maxFeatures - kept.length });
    for (const q of pad) {
      if (kept.length >= o.maxFeatures) break;
      const far = kept.every((k) => (k.x - q.x) ** 2 + (k.y - q.y) ** 2 >= o.minDistance ** 2);
      if (far) kept.push({ ...q, score: maxScore * 0.01 });
    }
  }
  return kept;
}

function uniformFallback(img: Gray, o: FeatureOptions): Feature[] {
  const rng = makeRng(o.seed);
  const pts: Feature[] = [];
  const step = Math.max(4, Math.round(Math.sqrt((img.width * img.height) / Math.max(1, o.maxFeatures))));
  for (let y = step; y < img.height - step; y += step) {
    for (let x = step; x < img.width - step; x += step) {
      if (o.mask && o.mask.data[y * img.width + x] <= 0.5) continue;
      if (pts.length >= o.maxFeatures) return pts;
      pts.push({ x: x + (rng() - 0.5) * 2, y: y + (rng() - 0.5) * 2, score: 1 });
    }
  }
  return pts;
}

export function enforceMinDistance(points: Feature[], minDistance: number, max: number): Feature[] {
  const out: Feature[] = [];
  const md2 = minDistance * minDistance;
  for (const p of points) {
    let ok = true;
    for (const q of out) {
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      if (dx * dx + dy * dy < md2) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(p);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Adaptive seeding: denser near the boundary, sparser in the interior, scaled by the
 * area of the region. This is what keeps small stable objects cheap and large
 * deforming objects accurate.
 */
export function adaptiveSeedCount(areaPx: number, targetCount: number): number {
  const scaled = Math.round(Math.sqrt(areaPx) * 0.9);
  return Math.max(24, Math.min(targetCount * 2, scaled));
}
