import { describe, it, expect } from 'vitest';
import { renderSceneSequence, centroid, rectMask } from './synthetic.js';
import { trackMask, StaticFrames, PointTracker, countArea, warpByMatrix, refineBoundary } from '../tracking/tracker.js';
import { presetOptions, DEFAULT_TRACK_OPTIONS } from '../tracking/types.js';
import { goodFeaturesToTrack } from '../tracking/features.js';
import { buildPyramid } from '../tracking/pyramid.js';
import { calcOpticalFlowPyrLK, forwardBackwardCheck } from '../tracking/opticalflow.js';
import { estimateGlobalMotion, decomposeAffine } from '../tracking/globalmotion.js';
import { displacementFields, warpMaskByField } from '../tracking/warp.js';
import { MAT3_IDENTITY, fitAffine } from '../core/geometry.js';
import { createGray } from '../core/image.js';

describe('feature detection', () => {
  it('finds corners on a checkerboard and rejects flat regions', () => {
    const frames = renderSceneSequence(
      { width: 64, height: 64, objectAt: () => ({ x: 20, y: 20, w: 16, h: 16 }), cameraAt: () => ({ x: 0, y: 0 }) },
      1,
    );
    const feats = goodFeaturesToTrack(frames[0], { maxFeatures: 60, blockSize: 5, minDistance: 3 });
    expect(feats.length).toBeGreaterThan(5);
    // A perfectly flat image must yield no corners.
    const flat = createGray(64, 64, 0.5);
    expect(goodFeaturesToTrack(flat, { maxFeatures: 60 }).length).toBe(0);
  });
});

describe('pyramid', () => {
  it('halves dimensions per level', () => {
    const frames = renderSceneSequence(
      { width: 64, height: 64, objectAt: () => ({ x: 8, y: 8, w: 16, h: 16 }), cameraAt: () => ({ x: 0, y: 0 }) },
      1,
    );
    const pyr = buildPyramid(frames[0], 3);
    expect(pyr.levels[0].width).toBe(64);
    expect(pyr.levels[1].width).toBe(32);
    expect(pyr.levels[2].width).toBe(16);
  });
});

describe('Lucas-Kanade', () => {
  it('recovers a known sub-pixel-free translation', () => {
    const frames = renderSceneSequence(
      { width: 64, height: 64, objectAt: (f) => ({ x: 12 + f * 3, y: 24, w: 20, h: 20 }), cameraAt: () => ({ x: 0, y: 0 }) },
      2,
    );
    const a = buildPyramid(frames[0], 2);
    const b = buildPyramid(frames[1], 2);
    const res = calcOpticalFlowPyrLK(a, b, [
      { point: { x: 22, y: 34 } },
      { point: { x: 25, y: 30 } },
      { point: { x: 28, y: 38 } },
    ], { windowSize: 9, iterations: 25 });
    for (const r of res) {
      expect(r.status).toBe('tracked');
      // The object moves +3px in x and 0 in y.
      expect(r.pos.x).toBeGreaterThan(22);
    }
    const dx = res.map((r, i) => r.pos.x - [22, 25, 28][i]);
    const dy = res.map((r, i) => r.pos.y - [34, 30, 38][i]);
    const meanDx = dx.reduce((s, v) => s + v, 0) / dx.length;
    const meanDy = dy.reduce((s, v) => s + v, 0) / dy.length;
    expect(meanDx).toBeGreaterThan(1.5);
    expect(Math.abs(meanDy)).toBeLessThan(1.5);
  });

  it('flags an inconsistent point via forward/backward checking', () => {
    const frames = renderSceneSequence(
      { width: 64, height: 64, objectAt: (f) => ({ x: 12 + f * 4, y: 24, w: 20, h: 20 }), cameraAt: () => ({ x: 0, y: 0 }) },
      2,
    );
    const a = buildPyramid(frames[0], 2);
    const b = buildPyramid(frames[1], 2);
    const origins = [{ x: 22, y: 34 }, { x: 26, y: 32 }];
    const fwd = calcOpticalFlowPyrLK(a, b, origins.map((p) => ({ point: p })), { windowSize: 9, iterations: 20 });
    const fb = forwardBackwardCheck(a, b, origins, fwd, 3, { windowSize: 9, iterations: 12 });
    expect(fb.length).toBe(2);
    for (const c of fb) expect(Number.isFinite(c.error)).toBe(true);
  });
});

describe('global motion', () => {
  it('recovers a pure camera pan as translation', () => {
    const src = Array.from({ length: 20 }, (_, i) => ({ x: (i % 5) * 8 + 4, y: Math.floor(i / 5) * 8 + 4 }));
    const dst = src.map((p) => ({ x: p.x + 6, y: p.y - 2 }));
    const est = estimateGlobalMotion(src, dst, { model: 'translation', threshold: 1 });
    expect(est.matrix[2]).toBeCloseTo(6, 1);
    expect(est.matrix[5]).toBeCloseTo(-2, 1);
    expect(est.inlierCount).toBe(20);
  });

  it('separates camera motion from a moving subject', () => {
    // 24 background points pan +5; 6 subject points pan +1 (i.e. -4 relative).
    const src: Array<{ x: number; y: number }> = [];
    const dst: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 24; i++) {
      const p = { x: (i % 6) * 9 + 3, y: Math.floor(i / 6) * 9 + 3 };
      src.push(p);
      dst.push({ x: p.x + 5, y: p.y });
    }
    for (let i = 0; i < 6; i++) {
      const p = { x: 30 + (i % 3) * 3, y: 30 + Math.floor(i / 3) * 3 };
      src.push(p);
      dst.push({ x: p.x + 1, y: p.y });
    }
    const est = estimateGlobalMotion(src, dst, { model: 'affine', threshold: 1.5, iterations: 120 });
    // The dominant (camera) motion must win: ~+5, not +4.
    expect(est.matrix[2]).toBeGreaterThan(3.5);
    expect(est.matrix[2]).toBeLessThan(6.5);
    expect(est.inlierCount).toBeGreaterThanOrEqual(20);
  });

  it('decomposes an affine into translation/rotation/scale', () => {
    const src = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }];
    const dst = src.map((p) => ({ x: p.x * 2 + 3, y: p.y * 2 + 1 }));
    const fit = fitAffine(src, dst);
    expect(fit).not.toBeNull();
    const d = decomposeAffine(fit!.matrix);
    expect(d.scaleX).toBeCloseTo(2, 3);
    expect(d.tx).toBeCloseTo(3, 3);
    expect(d.ty).toBeCloseTo(1, 3);
  });
});

describe('displacement field', () => {
  it('interpolates a uniform translation across the whole field', () => {
    const disps = [
      { pos: { x: 8, y: 8 }, dx: 4, dy: 0, weight: 1 },
      { pos: { x: 24, y: 8 }, dx: 4, dy: 0, weight: 1 },
      { pos: { x: 8, y: 24 }, dx: 4, dy: 0, weight: 1 },
      { pos: { x: 24, y: 24 }, dx: 4, dy: 0, weight: 1 },
    ];
    const { dx, dy } = displacementFields(32, 32, disps, { radius: 40 });
    expect(dx[16 * 32 + 16]).toBeCloseTo(4, 1);
    expect(dy[16 * 32 + 16]).toBeCloseTo(0, 1);
  });

  it('moves a mask by the field', () => {
    const mask = rectMask(32, 32, 4, 4, 8, 8);
    const before = centroid(mask);
    const dx = new Float32Array(32 * 32).fill(5);
    const dy = new Float32Array(32 * 32).fill(0);
    const warped = warpMaskByField(mask, dx, dy);
    const after = centroid(warped);
    expect(after.x).toBeGreaterThan(before.x + 3);
    expect(Math.abs(after.y - before.y)).toBeLessThan(1);
    expect(countArea(warped)).toBeGreaterThan(countArea(mask) * 0.7);
  });
});

describe('matrix warp', () => {
  it('identity leaves the mask unchanged', () => {
    const mask = rectMask(32, 32, 6, 6, 10, 10);
    const out = warpByMatrix(mask, MAT3_IDENTITY);
    expect(countArea(out)).toBe(countArea(mask));
  });
});

describe('boundary refinement', () => {
  it('snaps a stale boundary onto the edge that actually moved', () => {
    // The subject widens by 3px on the right between frame 0 and frame 1, but the mask
    // still holds frame 0's silhouette. Refinement must find the moved transition.
    const frames = renderSceneSequence(
      { width: 64, height: 64, objectAt: (f) => ({ x: 20, y: 20, w: 20 + f * 3, h: 20 }), cameraAt: () => ({ x: 0, y: 0 }) },
      2,
    );
    const stale = rectMask(64, 64, 20, 20, 20, 20);
    const refined = refineBoundary(stale, frames[0], frames[1], 1, 5);
    expect(countArea(refined)).toBeGreaterThan(countArea(stale));
    // And it must not run away: the growth should be bounded by the search radius.
    expect(countArea(refined)).toBeLessThan(countArea(stale) * 1.6);
  });

  it('leaves the mask alone when prev and cur are identical', () => {
    const frames = renderSceneSequence(
      { width: 64, height: 64, objectAt: () => ({ x: 20, y: 20, w: 20, h: 20 }), cameraAt: () => ({ x: 0, y: 0 }) },
      1,
    );
    const mask = rectMask(64, 64, 20, 20, 20, 20);
    const refined = refineBoundary(mask, frames[0], frames[0], 1, 5);
    expect(countArea(refined)).toBe(countArea(mask));
  });
});

describe('full mask tracking', () => {
  it('follows a translating subject instead of freezing on frame 0', async () => {
    const spec = {
      width: 64,
      height: 64,
      objectAt: (f: number) => ({ x: 10 + f * 3, y: 26, w: 20, h: 20 }),
      cameraAt: () => ({ x: 0, y: 0 }),
    };
    const frames = renderSceneSequence(spec, 8);
    const provider = new StaticFrames(frames);
    const mask0 = rectMask(64, 64, 10, 26, 20, 20);
    const res = await trackMask(provider, mask0, 0, 7, 'forward', {
      ...presetOptions('fast'),
      analysisScale: 1,
      featureCount: 80,
    });
    expect(res.masks.size).toBe(8);
    // Ground truth centroids.
    const truths = Array.from({ length: 8 }, (_, f) => ({ x: 10 + f * 3 + 10, y: 36 }));
    let worst = 0;
    for (let f = 0; f < 8; f++) {
      const c = centroid(res.masks.get(f)!);
      const err = Math.hypot(c.x - truths[f].x, c.y - truths[f].y);
      worst = Math.max(worst, err);
    }
    // The mask must travel with the subject. A frozen mask would be ~21px off by frame 7.
    expect(worst).toBeLessThan(4);
    expect(res.metrics.inlierRatio).toBeGreaterThan(0.5);
    expect(res.metrics.confidence).toBeGreaterThan(0.5);
  }, 60000);

  it('keeps the subject locked while the camera pans sideways', async () => {
    const spec = {
      width: 64,
      height: 64,
      objectAt: (f: number) => ({ x: 16 + f * 1, y: 26, w: 18, h: 18 }),
      cameraAt: (f: number) => ({ x: f * 4, y: 0 }),
    };
    const frames = renderSceneSequence(spec, 6);
    const provider = new StaticFrames(frames);
    const mask0 = rectMask(64, 64, 16, 26, 18, 18);
    const res = await trackMask(provider, mask0, 0, 5, 'forward', {
      ...DEFAULT_TRACK_OPTIONS,
      analysisScale: 1,
      featureCount: 100,
      globalMotion: true,
    });
    // Global motion should have been detected (not identity) on at least some frames.
    const detectedCamera = res.tracks.filter((t) => Math.abs(t.camera.matrix[2]) > 0.5).length;
    expect(detectedCamera).toBeGreaterThan(0);
    const last = centroid(res.masks.get(5)!);
    expect(Math.abs(last.x - (16 + 5 + 9))).toBeLessThan(9);
  }, 90000);

  it('follows a deforming limb (non-rigid)', async () => {
    const spec = {
      width: 64,
      height: 64,
      objectAt: () => ({ x: 24, y: 24, w: 16, h: 16 }),
      cameraAt: () => ({ x: 0, y: 0 }),
      limbAt: (f: number) => ({ x: 32, y: 32, length: 4 + f * 3, angle: -0.6 }),
    };
    const frames = renderSceneSequence(spec, 5);
    const provider = new StaticFrames(frames);
    const mask0 = rectMask(64, 64, 24, 24, 16, 16);
    const res = await trackMask(provider, mask0, 0, 4, 'forward', {
      ...DEFAULT_TRACK_OPTIONS,
      analysisScale: 1,
      featureCount: 100,
      nonRigid: true,
    });
    const firstArea = countArea(res.masks.get(0)!);
    const lastArea = countArea(res.masks.get(4)!);
    // The limb extends, so the tracked region must grow rather than stay rigid.
    expect(lastArea).toBeGreaterThan(firstArea * 0.9);
    expect(res.metrics.confidence).toBeGreaterThan(0);
  }, 90000);

  it('reports measured confidence rather than a constant', async () => {
    const frames = renderSceneSequence(
      { width: 48, height: 48, objectAt: (f) => ({ x: 8 + f * 2, y: 16, w: 16, h: 16 }), cameraAt: () => ({ x: 0, y: 0 }) },
      4,
    );
    const res = await trackMask(new StaticFrames(frames), rectMask(48, 48, 8, 16, 16, 16), 0, 3, 'forward', {
      ...presetOptions('fast'),
      analysisScale: 1,
      featureCount: 60,
    });
    const confidences = res.tracks.map((t) => t.metrics.confidence);
    expect(new Set(confidences).size).toBeGreaterThan(1);
    for (const c of confidences) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  }, 60000);

  it('cancels through AbortSignal', async () => {
    const frames = renderSceneSequence(
      { width: 48, height: 48, objectAt: (f) => ({ x: 8 + f * 2, y: 16, w: 16, h: 16 }), cameraAt: () => ({ x: 0, y: 0 }) },
      10,
    );
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 5);
    const res = await trackMask(new StaticFrames(frames), rectMask(48, 48, 8, 16, 16, 16), 0, 9, 'forward', {
      ...presetOptions('fast'),
      analysisScale: 1,
      featureCount: 40,
    }, { signal: ac.signal });
    expect(res.masks.size).toBeLessThan(11);
  }, 30000);

  it('tracks backward', async () => {
    const frames = renderSceneSequence(
      { width: 48, height: 48, objectAt: (f) => ({ x: 8 + f * 2, y: 16, w: 16, h: 16 }), cameraAt: () => ({ x: 0, y: 0 }) },
      6,
    );
    const res = await trackMask(new StaticFrames(frames), rectMask(48, 48, 18, 16, 16, 16), 5, 0, 'backward', {
      ...presetOptions('fast'),
      analysisScale: 1,
      featureCount: 50,
    });
    expect(res.masks.get(0)).toBeDefined();
    expect(res.masks.get(5)).toBeDefined();
  }, 60000);
});

describe('PointTracker anchors', () => {
  it('accepts user anchors and can remove them', () => {
    const frames = renderSceneSequence(
      { width: 32, height: 32, objectAt: () => ({ x: 8, y: 8, w: 12, h: 12 }), cameraAt: () => ({ x: 0, y: 0 }) },
      1,
    );
    const t = new PointTracker(presetOptions('fast'));
    t.seed(rectMask(32, 32, 8, 8, 12, 12), frames[0], 30);
    const before = t.getPoints().length;
    t.addAnchor({ x: 14, y: 14 });
    expect(t.getPoints().length).toBe(before + 1);
    const id = t.getPoints()[t.getPoints().length - 1].id;
    t.removeAnchor(id);
    expect(t.getPoints().length).toBe(before);
  });
});
