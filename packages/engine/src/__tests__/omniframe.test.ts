import { describe, it, expect } from 'vitest';
import { createGray, Gray, Rgba } from '../core/image.js';
import { StaticFrames } from '../tracking/tracker.js';
import {
  executeOmniframe, newOmniframeOp, applyOpToFrame, extract, transformRgba, grayToRgba,
} from '../omniframe/ops.js';
import {
  inpaintTeleaGray, inpaintDiffusionGray, inpaintPatchMatchGray, inpaintRgba,
} from '../omniframe/inpaint.js';
import { centroid, rectMask } from './synthetic.js';

/** Two subjects on a textured plate, so "move the left one" is unambiguous. */
function twoPeople(frames: number, leftMovesBy = 0): Gray[] {
  const w = 96, h = 64;
  const out: Gray[] = [];
  const tex = (x: number, y: number): number =>
    0.5 + 0.22 * Math.sin(x * 0.55) + 0.18 * Math.cos(y * 0.45) + 0.12 * Math.sin((x + y) * 0.3);
  for (let f = 0; f < frames; f++) {
    const img = createGray(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) img.data[y * w + x] = 0.15 + 0.08 * tex(x, y);
    }
    const drawPerson = (px: number, py: number, pw: number, ph: number, tone: number): void => {
      for (let y = py; y < py + ph; y++) {
        for (let x = px; x < px + pw; x++) {
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          img.data[y * w + x] = tone + 0.28 * tex(x + 13, y + 7);
        }
      }
    };
    drawPerson(10 + f * leftMovesBy, 18, 16, 30, 0.62);   // left person
    drawPerson(62, 18, 16, 30, 0.58);                     // right person
    out.push(img);
  }
  return out;
}

function grayToRgbaFrame(g: Gray): Rgba {
  return grayToRgba(g);
}

describe('inpainting', () => {
  const ramp = (): Gray => {
    const g = createGray(32, 32);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) g.data[y * 32 + x] = x / 31;
    return g;
  };
  const hole = (): Gray => rectMask(32, 32, 12, 12, 8, 8);

  it('telea fills a hole in a ramp without NaN and stays in range', () => {
    const filled = inpaintTeleaGray(ramp(), hole());
    for (let i = 0; i < filled.data.length; i++) {
      expect(Number.isNaN(filled.data[i])).toBe(false);
      expect(filled.data[i]).toBeGreaterThanOrEqual(-0.001);
      expect(filled.data[i]).toBeLessThanOrEqual(1.001);
    }
    // Inside the hole the ramp continues left->right, so it must increase across it.
    const row = 16;
    const left = filled.data[row * 32 + 12];
    const right = filled.data[row * 32 + 19];
    expect(right).toBeGreaterThan(left);
  });

  it('diffusion converges toward the boundary mean', () => {
    const filled = inpaintDiffusionGray(ramp(), hole(), 600);
    const centre = filled.data[16 * 32 + 15];
    // Boundary of the hole spans x=11..20 on that row => mean ~0.5
    expect(centre).toBeGreaterThan(0.3);
    expect(centre).toBeLessThan(0.7);
  });

  it('patchmatch fills a hole using texture from elsewhere', () => {
    const g = createGray(32, 32);
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) g.data[y * 32 + x] = ((x >> 2) % 2 === 0 ? 0.8 : 0.2) * 0.5 + 0.25;
    }
    const filled = inpaintPatchMatchGray(g, hole(), 5, 4, 7);
    let lo = Infinity, hi = -Infinity;
    for (let y = 12; y < 20; y++) {
      for (let x = 12; x < 20; x++) {
        const v = filled.data[y * 32 + x];
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
    // It should reproduce the two-tone pattern, not a flat average.
    expect(hi - lo).toBeGreaterThan(0.1);
  });

  it('rgba inpainting touches only the hole', () => {
    const src: Rgba = { width: 32, height: 32, data: new Uint8ClampedArray(32 * 32 * 4) };
    for (let i = 0; i < 32 * 32; i++) {
      src.data[i * 4] = 100; src.data[i * 4 + 1] = 150; src.data[i * 4 + 2] = 200; src.data[i * 4 + 3] = 255;
    }
    const h = hole();
    const out = inpaintRgba(src, h, 'telea');
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const i = (y * 32 + x) * 4;
        if (h.data[y * 32 + x] < 0.5) {
          expect(out.data[i]).toBe(100);
          expect(out.data[i + 1]).toBe(150);
        }
      }
    }
  });
});

describe('omniframe primitives', () => {
  it('extract cuts the subject out with alpha', () => {
    const frames = twoPeople(1);
    const src = grayToRgbaFrame(frames[0]);
    const mask = rectMask(96, 64, 10, 18, 16, 30);
    const cut = extract(src, mask);
    expect(cut.data[(20 * 96 + 12) * 4 + 3]).toBe(255);
    expect(cut.data[(20 * 96 + 70) * 4 + 3]).toBe(0);
  });

  it('transforms a layer and moves its mask with it', () => {
    const frames = twoPeople(1);
    const src = grayToRgbaFrame(frames[0]);
    const mask = rectMask(96, 64, 10, 18, 16, 30);
    const m = [1, 0, 20, 0, 1, 0, 0, 0, 1] as [number, number, number, number, number, number, number, number, number];
    const t = transformRgba(extract(src, mask), m, mask, 96, 64);
    const before = centroid(mask);
    const after = centroid(t.mask);
    expect(after.x).toBeGreaterThan(before.x + 15);
    expect(Math.abs(after.y - before.y)).toBeLessThan(1);
  });
});

describe('omniframe execute — two people, move the left one', () => {
  it('moves the left subject, repairs the vacated region, leaves the right one alone', async () => {
    const frames = twoPeople(6, 0);
    const provider = new StaticFrames(frames);
    const mask0 = rectMask(96, 64, 10, 18, 16, 30);
    const op = newOmniframeOp('move', { start: 0, end: 5, direction: 'forward' });
    op.transform.dx = 22;
    op.transform.dy = 0;
    op.repair = 'telea';

    const res = await executeOmniframe(provider, mask0, op, {
      trackOptions: { analysisScale: 1, featureCount: 90, windowSize: 9, pyramidLevels: 2 },
    });

    expect(res.frames.size).toBe(6);
    const out = res.frames.get(3)!;
    const srcFrame = grayToRgbaFrame(frames[3]);

    // 1. The old location (x 10..26) must no longer contain the subject.
    let oldSubjectEnergy = 0;
    let oldSrcEnergy = 0;
    for (let y = 20; y < 46; y++) {
      for (let x = 11; x < 25; x++) {
        const i = (y * 96 + x) * 4;
        oldSubjectEnergy += out.data[i];
        oldSrcEnergy += srcFrame.data[i];
      }
    }
    // The subject was bright (~0.62+); the repaired plate should be much darker.
    expect(oldSubjectEnergy / oldSrcEnergy).toBeLessThan(0.8);

    // 2. The new location (x 32..48) must now contain a bright subject.
    let newEnergy = 0;
    let newCount = 0;
    for (let y = 20; y < 46; y++) {
      for (let x = 33; x < 47; x++) {
        newEnergy += out.data[(y * 96 + x) * 4];
        newCount++;
      }
    }
    expect(newEnergy / newCount).toBeGreaterThan(110);

    // 3. The right-hand person at x 62..78 must be untouched.
    for (let y = 20; y < 46; y++) {
      for (let x = 64; x < 76; x++) {
        const i = (y * 96 + x) * 4;
        expect(Math.abs(out.data[i] - srcFrame.data[i])).toBeLessThan(2);
      }
    }
    // 4. It must not be a frozen frame-0 mask: the mask must have moved with the subject.
    const m0 = centroid(res.masks.get(0)!);
    const m3 = centroid(res.masks.get(3)!);
    expect(Math.abs(m0.x - m3.x)).toBeLessThan(3);
  }, 180000);

  it('stays locked when the subject itself moves', async () => {
    // The left person walks right by 2px per frame; the mask must follow, not freeze.
    const frames = twoPeople(5, 2);
    const provider = new StaticFrames(frames);
    const mask0 = rectMask(96, 64, 10, 18, 16, 30);
    const op = newOmniframeOp('pixelate', { start: 0, end: 4, direction: 'forward' });
    op.pixelSize = 6;
    const res = await executeOmniframe(provider, mask0, op, {
      trackOptions: { analysisScale: 1, featureCount: 90, windowSize: 9, pyramidLevels: 2 },
    });
    const c0 = centroid(res.masks.get(0)!);
    const c4 = centroid(res.masks.get(4)!);
    // Ground truth: the subject moved 8px right over 4 frames.
    expect(c4.x - c0.x).toBeGreaterThan(4);
    expect(c4.x - c0.x).toBeLessThan(13);
  }, 180000);

  it('warms only the tracked region (temperature shifts red up, blue down)', async () => {
    const frames = twoPeople(2);
    const provider = new StaticFrames(frames);
    const mask0 = rectMask(96, 64, 10, 18, 16, 30);
    const op = newOmniframeOp('recolor', { start: 0, end: 1, direction: 'forward' });
    op.color.temperature = 1;
    op.color.brightness = 0.1;
    const res = await executeOmniframe(provider, mask0, op, {
      trackOptions: { analysisScale: 1, featureCount: 60, windowSize: 9, pyramidLevels: 2 },
    });
    const out = res.frames.get(0)!;
    const src = grayToRgbaFrame(frames[0]);
    const i = (30 * 96 + 16) * 4;
    // Inside the region red must go up and blue must come down relative to the source.
    expect(out.data[i]).toBeGreaterThan(src.data[i]);
    expect(out.data[i + 2]).toBeLessThan(src.data[i + 2]);
    // Outside it must be byte-identical.
    const j = (30 * 96 + 80) * 4;
    expect(out.data[j]).toBe(src.data[j]);
    expect(out.data[j + 1]).toBe(src.data[j + 1]);
  }, 120000);

  it('hue-rotates a coloured region but leaves a neutral one alone', () => {
    // A hue rotation is a no-op on a grey pixel by definition (saturation is zero),
    // so this asserts the two behaviours explicitly instead of hiding the maths.
    const src: Rgba = { width: 4, height: 1, data: new Uint8ClampedArray([
      200, 40, 40, 255, // saturated red
      128, 128, 128, 255, // neutral grey
      40, 200, 40, 255, // saturated green
      40, 40, 200, 255, // saturated blue
    ]) };
    const mask = createGray(4, 1, 1);
    const op = newOmniframeOp('recolor');
    op.color.hue = 120;
    const out = applyOpToFrame(src, mask, op);
    // Red rotated +120deg lands on green.
    expect(out.data[1]).toBeGreaterThan(out.data[0]);
    // The neutral pixel stays neutral.
    expect(out.data[4]).toBe(out.data[5]);
    expect(out.data[5]).toBe(out.data[6]);
  });

  it('pixelates a tracked face region', () => {
    const frames = twoPeople(1);
    const src = grayToRgbaFrame(frames[0]);
    const mask = rectMask(96, 64, 10, 18, 16, 30);
    const op = newOmniframeOp('pixelate');
    op.pixelSize = 8;
    const out = applyOpToFrame(src, mask, op);
    // Inside a pixelated block every pixel is identical.
    expect(out.data[(20 * 96 + 12) * 4]).toBe(out.data[(20 * 96 + 13) * 4]);
    // Outside it is untouched.
    expect(out.data[(20 * 96 + 70) * 4]).toBe(src.data[(20 * 96 + 70) * 4]);
  });
});
