/**
 * Hybrid tracking stack.
 *
 * Layer order (each layer is independently disableable through TrackOptions):
 *   1. multiscale Gaussian pyramid          -> absorbs large motion
 *   2. Shi-Tomasi seeding inside the region  -> identity carried by gradient structure
 *   3. pyramidal Lucas-Kanade                -> sub-pixel local motion
 *   4. forward/backward verification         -> rejects "something else moved in"
 *   5. RANSAC global motion                  -> separates camera from subject
 *   6. median/MAD outlier rejection          -> one bad point cannot deform the object
 *   7. inverse-distance displacement field   -> non-rigid deformation
 *   8. boundary patch refinement             -> snaps the silhouette to the real edge
 *   9. occlusion state + velocity memory     -> survives partial hiding
 *  10. re-initialisation                     -> recovers when confidence collapses
 *  11. measured confidence                   -> derived, never fabricated
 */
import { Gray, createGray, cloneGray, downsampleGray, upsampleGray, graySample } from '../core/image.js';
import { Vec2, mat3Apply, Mat3, MAT3_IDENTITY } from '../core/geometry.js';
import { clamp, clamp01, mad, median, stdev } from '../core/math.js';
import { buildPyramid, Pyramid } from './pyramid.js';
import { goodFeaturesToTrack, adaptiveSeedCount } from './features.js';
import { calcOpticalFlowPyrLK, forwardBackwardCheck, FlowResult } from './opticalflow.js';
import { estimateGlobalMotion } from './globalmotion.js';
import { displacementFields, warpMaskByField, smoothField, Displacement } from './warp.js';
import {
  DEFAULT_TRACK_OPTIONS, FrameTrack, TrackDirection, TrackMetrics, TrackOptions,
  TrackPoint, TrackQuality, qualityFromConfidence, EMPTY_METRICS,
} from './types.js';

export interface FrameProvider {
  readonly count: number;
  readonly width: number;
  readonly height: number;
  /** Returns the frame as a luma buffer in [0,1]. May be async for decoded video. */
  frame(index: number): Gray | Promise<Gray>;
}

export class StaticFrames implements FrameProvider {
  constructor(private readonly frames: Gray[]) {
    if (frames.length === 0) throw new Error('StaticFrames requires at least one frame');
  }
  get count(): number { return this.frames.length; }
  get width(): number { return this.frames[0].width; }
  get height(): number { return this.frames[0].height; }
  frame(index: number): Gray {
    const i = clamp(index, 0, this.frames.length - 1);
    return this.frames[i];
  }
}

export interface TrackProgress {
  frame: number;
  total: number;
  quality: TrackQuality;
  confidence: number;
}

export interface MaskTrackResult {
  /** mask per absolute frame index */
  masks: Map<number, Gray>;
  tracks: FrameTrack[];
  /** measured, never invented */
  metrics: TrackMetrics;
  /** which frames had to be re-initialised */
  reinitialisedFrames: number[];
  /** points that were lost for part of the range */
  occludedFrames: number[];
}

let nextPointId = 1;

export class PointTracker {
  private points: TrackPoint[] = [];
  private lastMask: Gray | null = null;

  constructor(private readonly opts: TrackOptions = DEFAULT_TRACK_OPTIONS) {}

  seed(mask: Gray, frame: Gray, count = this.opts.featureCount): TrackPoint[] {
    const area = countArea(mask);
    const target = adaptiveSeedCount(area, count);
    const features = goodFeaturesToTrack(frame, {
      mask,
      maxFeatures: target,
      minDistance: Math.max(3, Math.round(this.opts.windowSize * 0.6)),
      blockSize: Math.max(3, this.opts.windowSize - 2),
      edgeBias: this.opts.nonRigid ? 0.5 : 0.2,
      seed: this.opts.seed,
    });
    const bounds = maskBoundsFast(mask);
    this.points = features.map((f) => ({
      id: nextPointId++,
      pos: { ...f },
      ref: { ...f },
      velocity: { x: 0, y: 0 },
      confidence: 1,
      fbError: 0,
      occluded: false,
      lostFrames: 0,
      edgeProximity: edgeProximity(f, mask, bounds),
    }));
    this.lastMask = mask;
    return this.points;
  }

  /** Add an anchor the user clicked — anchors are never dropped by outlier rejection. */
  addAnchor(p: Vec2): void {
    this.points.push({
      id: nextPointId++,
      pos: { ...p },
      ref: { ...p },
      velocity: { x: 0, y: 0 },
      confidence: 1,
      fbError: 0,
      occluded: false,
      lostFrames: 0,
      edgeProximity: 0.5,
    });
  }

  removeAnchor(id: number): void {
    this.points = this.points.filter((p) => p.id !== id);
  }

  getPoints(): TrackPoint[] {
    return this.points;
  }

  /**
   * Advance one frame pair. Returns the per-frame record and the warped mask.
   */
  step(prev: Gray, cur: Gray, frameIndex: number): {
    track: FrameTrack;
    warped: Gray;
  } {
    const o = this.opts;
    const scale = clamp(o.analysisScale, 0.1, 1);
    const a = scale >= 1 ? prev : downsampleGray(prev, 1 / scale);
    const b = scale >= 1 ? cur : downsampleGray(cur, 1 / scale);
    const invScale = 1 / scale;

    const prevPyr = buildPyramid(a, o.pyramidLevels);
    const nextPyr = buildPyramid(b, o.pyramidLevels);

    // Motion prediction from the previous frame's velocity gives LK a good initial
    // guess, which is what lets it survive fast motion. Occluded points are still
    // offered — at their velocity-predicted position — so they can be recovered the
    // moment the subject reappears instead of being dropped permanently.
    const livePoints = this.points;
    const inputs = livePoints.map((p) => ({
      point: { x: p.pos.x / invScale, y: p.pos.y / invScale },
      guess: { x: p.velocity.x / invScale, y: p.velocity.y / invScale },
    }));

    const flow = calcOpticalFlowPyrLK(prevPyr, nextPyr, inputs, {
      windowSize: o.windowSize,
      iterations: o.iterations,
    });

    const fb = o.forwardBackward
      ? forwardBackwardCheck(prevPyr, nextPyr, inputs.map((i) => i.point), flow, o.fbThreshold / invScale, {
          windowSize: o.windowSize,
          iterations: Math.max(6, Math.round(o.iterations / 2)),
        })
      : flow.map(() => ({ ok: true, error: 0, back: { x: 0, y: 0 } }));

    // Scale everything back to level-0 pixel space.
    const src: Vec2[] = livePoints.map((p) => ({ x: p.pos.x, y: p.pos.y }));
    const dst: Vec2[] = flow.map((r: FlowResult) => ({ x: r.pos.x * invScale, y: r.pos.y * invScale }));

    // 5. Global camera motion.
    const motion = o.globalMotion
      ? estimateGlobalMotion(src, dst, {
          model: 'affine',
          threshold: Math.max(1.5, o.fbThreshold),
          iterations: 120,
          seed: o.seed,
        })
      : { model: 'translation' as const, matrix: MAT3_IDENTITY, inliers: src.map(() => true), inlierCount: src.length, residual: 0 };

    // 6. Robust outlier rejection against the global model.
    const residuals = src.map((p, i) => {
      const pred = mat3Apply(motion.matrix, p);
      return Math.hypot(dst[i].x - pred.x, dst[i].y - pred.y);
    });
    const medR = median(residuals);
    const madR = Math.max(0.25, mad(residuals));
    const robustLimit = medR + 3 * 1.4826 * madR;

    const disps: Displacement[] = [];
    let inliers = 0;
    let fbSum = 0;
    let dispMags: number[] = [];

    for (let i = 0; i < livePoints.length; i++) {
      const p = livePoints[i];
      const f = fb[i];
      const r = flow[i];
      const isOutlier = o.robustOutliers && residuals[i] > robustLimit && p.edgeProximity > 0.15;
      const ok = f.ok && r.status === 'tracked' && !isOutlier;
      p.fbError = f.error * invScale;
      fbSum += p.fbError;
      if (ok) {
        inliers++;
        const dx = dst[i].x - src[i].x;
        const dy = dst[i].y - src[i].y;
        p.velocity = { x: dx, y: dy };
        p.pos = { ...dst[i] };
        p.occluded = false;
        p.lostFrames = 0;
        p.confidence = clamp01(1 - p.fbError / Math.max(1, o.fbThreshold * 2));
        disps.push({ pos: { ...p.pos }, dx, dy, weight: p.confidence });
        dispMags.push(Math.hypot(dx, dy));
      } else if (o.occlusion) {
        // Keep the latent state and coast on velocity; do NOT snap to whatever
        // happens to be at the old location.
        p.occluded = true;
        p.lostFrames++;
        p.confidence = Math.max(0, p.confidence - 0.25);
        p.pos = { x: p.pos.x + p.velocity.x, y: p.pos.y + p.velocity.y };
        disps.push({ pos: { ...p.pos }, dx: p.velocity.x, dy: p.velocity.y, weight: 0.15 });
      } else {
        p.confidence = 0;
      }
    }

    const inlierRatio = livePoints.length ? inliers / livePoints.length : 0;

    // 7. Non-rigid displacement field -> warp the mask.
    let warped: Gray;
    const baseMask = this.lastMask ?? createGray(prev.width, prev.height, 0);
    if (o.nonRigid && disps.length >= 4) {
      const { dx, dy } = displacementFields(prev.width, prev.height, disps, {
        radius: Math.max(40, Math.round(Math.sqrt(prev.width * prev.height) / 12)),
        outlierClamp: 3,
      });
      const sdx = smoothField(dx, prev.width, prev.height, 2.5);
      const sdy = smoothField(dy, prev.width, prev.height, 2.5);
      warped = warpMaskByField(baseMask, sdx, sdy);
    } else {
      warped = warpByMatrix(baseMask, motion.matrix);
    }

    // 8. Boundary refinement — snap the warped silhouette onto the real edge.
    if (o.boundaryRefine > 0) {
      warped = refineBoundary(warped, prev, cur, invScale, o.boundaryRefine);
      if (scale < 1) warped = upsampleGray(warped, prev.width, prev.height);
    } else if (scale < 1) {
      warped = upsampleGray(warped, prev.width, prev.height);
    }

    const areaBefore = countArea(baseMask);
    const areaAfter = countArea(warped);
    const areaDrift = areaBefore > 0 ? Math.abs(areaAfter - areaBefore) / areaBefore : 0;

    const metrics: TrackMetrics = {
      fbError: livePoints.length ? fbSum / livePoints.length : 0,
      inlierRatio,
      areaDrift,
      boundaryJitter: 0,
      reinitialised: 0,
      displacement: median(dispMags),
      confidence: 0,
    };
    // 11. Confidence derived from measured quantities only.
    metrics.confidence = clamp01(
      0.45 * clamp01(1 - metrics.fbError / Math.max(1, o.fbThreshold * 2)) +
        0.35 * inlierRatio +
        0.2 * clamp01(1 - areaDrift * 2),
    );
    const quality = qualityFromConfidence(metrics.confidence, inlierRatio);

    this.lastMask = warped;
    return {
      track: {
        frame: frameIndex,
        points: this.points.map((p) => ({ ...p, pos: { ...p.pos }, ref: { ...p.ref }, velocity: { ...p.velocity } })),
        camera: { matrix: [...motion.matrix], inliers: motion.inlierCount, residual: motion.residual },
        warpValid: o.nonRigid && disps.length >= 4,
        quality,
        metrics,
        reinitialised: 0,
      },
      warped,
    };
  }

  /**
   * Re-detect features inside the current hypothesis. Called when confidence collapses
   * so the track can recover without the user re-drawing the mask.
   */
  reinitialise(frame: Gray, mask: Gray): number {
    const before = this.points.length;
    const seeded = this.seed(mask, frame, this.opts.featureCount);
    return seeded.length - before;
  }
}

/* --------------------------------- helpers --------------------------------- */

export function countArea(m: Gray): number {
  let n = 0;
  for (let i = 0; i < m.data.length; i++) if (m.data[i] >= 0.5) n++;
  return n;
}

function maskBoundsFast(m: Gray): { x: number; y: number; w: number; h: number } {
  let minX = m.width, minY = m.height, maxX = -1, maxY = -1;
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      if (m.data[y * m.width + x] >= 0.5) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: m.width, h: m.height };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function edgeProximity(p: Vec2, m: Gray, b: { x: number; y: number; w: number; h: number }): number {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const rx = Math.max(1, b.w / 2);
  const ry = Math.max(1, b.h / 2);
  const nx = (p.x - cx) / rx;
  const ny = (p.y - cy) / ry;
  return clamp01(1 - Math.hypot(nx, ny));
}

/** Apply a homogeneous matrix to a mask via backward bilinear mapping. */
export function warpByMatrix(mask: Gray, m: Mat3): Gray {
  const out = createGray(mask.width, mask.height);
  // invert for backward mapping
  const a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5], g = m[6], h = m[7], i = m[8];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) return cloneGray(mask);
  const inv = [
    (e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det,
    (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det,
    (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det,
  ];
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      const w = inv[6] * x + inv[7] * y + inv[8];
      const iw = w === 0 ? 1 : 1 / w;
      const sx = (inv[0] * x + inv[1] * y + inv[2]) * iw;
      const sy = (inv[3] * x + inv[4] * y + inv[5]) * iw;
      out.data[y * mask.width + x] = graySample(mask, sx, sy);
    }
  }
  return out;
}

/**
 * Boundary refinement by 1-D profile matching.
 *
 * Comparing raw gradient magnitude does not work inside a textured subject — every
 * pixel there has a strong gradient, so "the edge" cannot be found that way. Instead we
 * take the intensity profile along the mask normal in the previous frame (which contains
 * the inside -> outside transition) and search for the offset along that same normal in
 * the current frame that best matches it. The transition is a strong, unambiguous
 * signal, so this snaps the silhouette onto the real boundary even where the sparse
 * feature points did not reach — an extended arm, an opening hand.
 */
export function refineBoundary(
  mask: Gray,
  prevImg: Gray,
  curImg: Gray,
  invScale: number,
  radius: number,
): Gray {
  const out = cloneGray(mask);
  const { width: w, height: h } = mask;
  const r = Math.max(1, Math.round(radius * Math.max(1, invScale)));
  const profLen = 2 * r + 1;
  const ref = new Float32Array(profLen);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (mask.data[i] < 0.5) continue;
      const left = mask.data[i - 1] >= 0.5;
      const right = mask.data[i + 1] >= 0.5;
      const up = mask.data[i - w] >= 0.5;
      const down = mask.data[i + w] >= 0.5;
      if (left && right && up && down) continue; // interior pixel, nothing to refine
      let nx = (left ? 1 : 0) - (right ? 1 : 0);
      let ny = (up ? 1 : 0) - (down ? 1 : 0);
      const len = Math.hypot(nx, ny);
      if (len === 0) continue;
      nx /= len;
      ny /= len;
      // Reference profile from the previous frame, centred on this boundary pixel.
      let mean = 0;
      for (let k = 0; k < profLen; k++) {
        const t = k - r;
        ref[k] = graySample(prevImg, x + nx * t, y + ny * t);
        mean += ref[k];
      }
      mean /= profLen;
      let contrast = 0;
      for (let k = 0; k < profLen; k++) contrast += Math.abs(ref[k] - mean);
      // A flat profile carries no edge information; skip rather than guess.
      if (contrast < 0.05) continue;
      let bestShift = 0;
      let bestErr = Number.POSITIVE_INFINITY;
      for (let s = -r; s <= r; s++) {
        let err = 0;
        for (let k = 0; k < profLen; k++) {
          const t = k - r + s;
          const v = graySample(curImg, x + nx * t, y + ny * t);
          err += (v - ref[k]) * (v - ref[k]);
        }
        if (err < bestErr) {
          bestErr = err;
          bestShift = s;
        }
      }
      if (bestShift === 0) continue;
      // Accept only a meaningfully better match than staying put.
      let stay = 0;
      for (let k = 0; k < profLen; k++) {
        const t = k - r;
        const v = graySample(curImg, x + nx * t, y + ny * t);
        stay += (v - ref[k]) * (v - ref[k]);
      }
      if (bestErr > stay * 0.7) continue;
      const px = Math.round(x + nx * bestShift);
      const py = Math.round(y + ny * bestShift);
      if (px >= 0 && py >= 0 && px < w && py < h) {
        out.data[py * w + px] = 1;
        if (bestShift < 0) out.data[i] = 0;
      }
    }
  }
  return out;
}

/**
 * Full mask-tracking driver: seeds once, steps through the range, re-initialises when
 * confidence collapses, and returns one mask per frame.
 */
export async function trackMask(
  provider: FrameProvider,
  initialMask: Gray,
  startFrame: number,
  endFrame: number,
  direction: TrackDirection,
  opts: Partial<TrackOptions> = {},
  hooks: {
    onProgress?: (p: TrackProgress) => void;
    signal?: AbortSignal;
    /** lower absolute frame bound for a backward pass, usually the clip source-in */
    rangeStart?: number;
  } = {},
): Promise<MaskTrackResult> {
  const o: TrackOptions = { ...DEFAULT_TRACK_OPTIONS, ...opts };
  const masks = new Map<number, Gray>();
  const tracks: FrameTrack[] = [];
  const reinitialisedFrames: number[] = [];
  const occludedFrames: number[] = [];

  const runs: Array<{ from: number; to: number; step: number }> = [];
  const lowerBound = Math.max(0, Math.min(startFrame, hooks.rangeStart ?? 0));
  if (direction === 'forward' || direction === 'both') runs.push({ from: startFrame, to: endFrame, step: 1 });
  if (direction === 'backward' || direction === 'both') runs.push({ from: startFrame, to: lowerBound, step: -1 });

  for (const run of runs) {
    const tracker = new PointTracker(o);
    const first = await provider.frame(clamp(run.from, 0, provider.count - 1));
    tracker.seed(initialMask, first, o.featureCount);
    masks.set(run.from, cloneGray(initialMask));
    let current = cloneGray(initialMask);
    const centroids: Vec2[] = [];

    for (let f = run.from; run.step > 0 ? f < run.to : f > run.to; f += run.step) {
      if (hooks.signal?.aborted) break;
      const nextIdx = clamp(f + run.step, 0, provider.count - 1);
      const prevImg = await provider.frame(clamp(f, 0, provider.count - 1));
      const curImg = await provider.frame(nextIdx);
      const { track, warped } = tracker.step(prevImg, curImg, nextIdx);
      current = warped;

      // 10. Re-initialisation when the track is falling apart.
      if (track.metrics.confidence < o.reinitThreshold && track.metrics.inlierRatio < 0.35) {
        const n = tracker.reinitialise(curImg, current);
        track.reinitialised = n;
        track.metrics.reinitialised = n;
        reinitialisedFrames.push(nextIdx);
      }
      if (track.points.some((p) => p.occluded)) occludedFrames.push(nextIdx);

      masks.set(nextIdx, current);
      tracks.push(track);
      const c = centroidOf(current);
      centroids.push(c);
      if (centroids.length >= 3) {
        // Boundary jitter = magnitude of the second difference of the centroid path.
        const n = centroids.length;
        const ax = centroids[n - 1].x - 2 * centroids[n - 2].x + centroids[n - 3].x;
        const ay = centroids[n - 1].y - 2 * centroids[n - 2].y + centroids[n - 3].y;
        track.metrics.boundaryJitter = Math.hypot(ax, ay);
      }
      hooks.onProgress?.({
        frame: nextIdx,
        total: Math.abs(run.to - run.from),
        quality: track.quality,
        confidence: track.metrics.confidence,
      });
      // Yield so the UI stays interactive during a long analyse.
      if ((nextIdx - run.from) % 4 === 0) await new Promise((r) => setTimeout(r, 0));
    }
  }

  // Aggregate the measured metrics over the whole run.
  const agg: TrackMetrics = { ...EMPTY_METRICS };
  if (tracks.length) {
    agg.fbError = median(tracks.map((t) => t.metrics.fbError));
    agg.inlierRatio = median(tracks.map((t) => t.metrics.inlierRatio));
    agg.areaDrift = median(tracks.map((t) => t.metrics.areaDrift));
    agg.boundaryJitter = stdev(tracks.map((t) => t.metrics.boundaryJitter));
    agg.reinitialised = reinitialisedFrames.length;
    agg.displacement = median(tracks.map((t) => t.metrics.displacement));
    agg.confidence = clamp01(median(tracks.map((t) => t.metrics.confidence)));
  }

  return { masks, tracks, metrics: agg, reinitialisedFrames, occludedFrames };
}

export function centroidOf(m: Gray): Vec2 {
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      if (m.data[y * m.width + x] >= 0.5) {
        sx += x;
        sy += y;
        n++;
      }
    }
  }
  return n ? { x: sx / n, y: sy / n } : { x: 0, y: 0 };
}

export type { Pyramid };
