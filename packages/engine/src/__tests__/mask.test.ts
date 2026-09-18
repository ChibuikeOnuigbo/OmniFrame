import { describe, it, expect } from 'vitest';
import { createGray, createRgba } from '../core/image.js';
import {
  combine, dilate, erode, feather, fillHoles, removeSmallComponents, keepLargestComponent,
  maskBounds, floodFill, selectByColor, encodeRle, decodeRle, traceContours, smoothMask,
} from '../mask/ops.js';
import {
  fillRect, fillEllipse, fillPolygon, stroke, magneticSegment, applyShape, opFromModifiers,
  edgeAwareStroke, magicBrush,
} from '../mask/tools.js';
import { morphMasks, propagateRange, signedDistanceField } from '../mask/interpolate.js';

describe('mask boolean operations', () => {
  const a = (): ReturnType<typeof createGray> => fillRect(createGray(16, 16), 2, 2, 8, 8);
  const b = (): ReturnType<typeof createGray> => fillRect(createGray(16, 16), 6, 6, 8, 8);

  it('adds, subtracts and intersects masks', () => {
    const add = combine(a(), b(), 'add');
    const sub = combine(a(), b(), 'subtract');
    const inter = combine(a(), b(), 'intersect');
    let ca = 0, cs = 0, ci = 0;
    for (let i = 0; i < add.data.length; i++) {
      if (add.data[i] > 0.5) ca++;
      if (sub.data[i] > 0.5) cs++;
      if (inter.data[i] > 0.5) ci++;
    }
    expect(ca).toBeGreaterThan(64);
    expect(cs).toBeLessThan(64);
    expect(ci).toBe(16);
  });

  it('maps Krita modifier keys to the documented operation', () => {
    expect(opFromModifiers({ shift: true, alt: false, ctrl: false })).toBe('add');
    expect(opFromModifiers({ shift: false, alt: true, ctrl: false })).toBe('subtract');
    expect(opFromModifiers({ shift: false, alt: false, ctrl: true })).toBe('replace');
    expect(opFromModifiers({ shift: true, alt: true, ctrl: false })).toBe('intersect');
  });

  it('dilates then erodes the expected number of pixels', () => {
    const one = fillRect(createGray(16, 16), 7, 7, 2, 2);
    const grown = dilate(one, 2);
    const shrunk = erode(grown, 2);
    let before = 0, after = 0;
    for (const v of one.data) if (v > 0.5) before++;
    for (const v of shrunk.data) if (v > 0.5) after++;
    expect(grown.data.some((v) => v > 0.5)).toBe(true);
    expect(after).toBeGreaterThanOrEqual(before * 0.8);
  });

  it('feathers into fractional edge values', () => {
    const m = fillRect(createGray(32, 32), 8, 8, 16, 16);
    const f = feather(m, 2);
    expect(f.data[16 * 32 + 16]).toBeGreaterThan(0.9);
    expect(f.data[8 * 32 + 8]).toBeLessThan(1);
    expect(f.data[7 * 32 + 7]).toBeLessThan(0.5);
  });
});

describe('selection tools', () => {
  it('rasterises rectangle, ellipse and polygon', () => {
    const base = createGray(32, 32);
    const r = fillRect(base, 2, 3, 10, 8);
    const e = fillEllipse(createGray(32, 32), 16, 16, 6, 4);
    const p = fillPolygon(createGray(32, 32), { points: [{ x: 20, y: 4 }, { x: 28, y: 4 }, { x: 24, y: 12 }], closed: true });
    expect(r.data.filter((v) => v > 0.5).length).toBe(80);
    expect(e.data.filter((v) => v > 0.5).length).toBeGreaterThan(50);
    expect(p.data.filter((v) => v > 0.5).length).toBeGreaterThan(20);
  });

  it('strokes a continuous round brush through sparse pointer samples', () => {
    const out = stroke(createGray(32, 32), [{ x: 3, y: 16 }, { x: 28, y: 16 }], 2, 0.5, 1);
    for (let x = 4; x < 28; x += 3) expect(out.data[16 * 32 + x]).toBeGreaterThan(0.5);
  });

  it('flood fills a contiguous colour region but not a separated one', () => {
    const img = createRgba(16, 16);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = 10; img.data[i + 1] = 10; img.data[i + 2] = 10; img.data[i + 3] = 255;
    }
    for (let y = 2; y < 8; y++) for (let x = 2; x < 8; x++) {
      const i = (y * 16 + x) * 4;
      img.data[i] = 200; img.data[i + 1] = 20; img.data[i + 2] = 20;
    }
    for (let y = 10; y < 14; y++) for (let x = 10; x < 14; x++) {
      const i = (y * 16 + x) * 4;
      img.data[i] = 200; img.data[i + 1] = 20; img.data[i + 2] = 20;
    }
    const f = floodFill(img, { x: 3, y: 3 }, 0.05, true);
    const similar = selectByColor(img, { r: 200, g: 20, b: 20 }, 0.05);
    expect(f.data[3 * 16 + 3]).toBe(1);
    expect(f.data[11 * 16 + 11]).toBe(0);
    expect(similar.data[11 * 16 + 11]).toBe(1);
  });

  it('magnetic lasso follows a strong synthetic edge', () => {
    const g = createGray(64, 32, 0.1);
    for (let y = 0; y < 32; y++) for (let x = 32; x < 64; x++) g.data[y * 64 + x] = 0.9;
    const segment = magneticSegment(g, { x: 8, y: 10 }, { x: 52, y: 10 }, 4);
    expect(segment.length).toBeGreaterThan(10);
    expect(segment.some((p) => Math.abs(p.x - 32) <= 4)).toBe(true);
  });

  it('magic brush and edge-aware brush return bounded masks', () => {
    const img = createRgba(24, 24);
    for (let i = 0; i < img.data.length; i += 4) {
      const x = (i / 4) % 24;
      const v = x < 12 ? 220 : 20;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    const base = createGray(24, 24);
    const magic = magicBrush(base, img, [{ x: 4, y: 10 }], 5, 0.2);
    const edge = edgeAwareStroke(base, magic, [{ x: 4, y: 10 }], 5, 0.5, 2);
    for (const v of edge.data) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('mask cleanup and serialisation', () => {
  it('fills holes', () => {
    let m = fillRect(createGray(20, 20), 3, 3, 14, 14);
    m.data[10 * 20 + 10] = 0;
    const f = fillHoles(m);
    expect(f.data[10 * 20 + 10]).toBe(1);
  });

  it('removes small components but keeps the large one', () => {
    let m = fillRect(createGray(24, 24), 4, 4, 10, 10);
    m = fillRect(m, 20, 20, 1, 1);
    const clean = removeSmallComponents(m, 4);
    expect(clean.data[20 * 24 + 20]).toBe(0);
    expect(clean.data[8 * 24 + 8]).toBe(1);
  });

  it('keeps only the largest component', () => {
    let m = fillRect(createGray(24, 24), 2, 2, 5, 5);
    m = fillRect(m, 14, 14, 7, 7);
    const largest = keepLargestComponent(m);
    expect(largest.data[3 * 24 + 3]).toBe(0);
    expect(largest.data[16 * 24 + 16]).toBe(1);
  });

  it('reports bounds, centroid and area', () => {
    const m = fillRect(createGray(20, 20), 4, 6, 8, 10);
    const b = maskBounds(m);
    expect(b.x).toBe(4);
    expect(b.y).toBe(6);
    expect(b.width).toBe(8);
    expect(b.height).toBe(10);
    expect(b.area).toBe(80);
    expect(b.centroid.x).toBeCloseTo(7.5);
    expect(b.centroid.y).toBeCloseTo(10.5);
  });

  it('RLE round-trips a mask', () => {
    const m = fillRect(createGray(20, 20), 3, 5, 8, 6);
    const decoded = decodeRle(encodeRle(m));
    expect(decoded.data).toEqual(m.data);
  });

  it('traces contours and simplifies them', () => {
    const m = fillRect(createGray(32, 32), 8, 8, 12, 10);
    const contours = traceContours(m);
    expect(contours.length).toBeGreaterThan(0);
    expect(contours[0].length).toBeGreaterThan(3);
  });

  it('smooths a noisy selection without leaving the range', () => {
    const m = fillRect(createGray(24, 24), 5, 5, 12, 12);
    m.data[2] = 1;
    const out = smoothMask(m, 1);
    for (const v of out.data) expect(v).toBeGreaterThanOrEqual(0);
    for (const v of out.data) expect(v).toBeLessThanOrEqual(1);
  });
});

describe('mask interpolation and propagation', () => {
  it('produces a clean signed-distance interpolation', () => {
    const a = fillRect(createGray(32, 32), 4, 10, 8, 8);
    const b = fillRect(createGray(32, 32), 20, 10, 8, 8);
    const mid = morphMasks(a, b, 0.5);
    const bounds = maskBounds(mid);
    expect(bounds.centroid.x).toBeGreaterThan(10);
    expect(bounds.centroid.x).toBeLessThan(22);
    expect(bounds.area).toBeGreaterThan(20);
    const sdf = signedDistanceField(a);
    expect(sdf.length).toBe(32 * 32);
  });

  it('copies or morphs between explicit mask keyframes', () => {
    const a = fillRect(createGray(16, 16), 1, 2, 4, 4);
    const b = fillRect(createGray(16, 16), 10, 2, 4, 4);
    const keys = new Map([[0, a], [10, b]]);
    const copied = propagateRange(keys, 0, 10, 16, 16, 'copy');
    const morphed = propagateRange(keys, 0, 10, 16, 16, 'morph');
    expect(maskBounds(copied.get(5)!).centroid.x).toBeCloseTo(maskBounds(a).centroid.x);
    expect(maskBounds(morphed.get(5)!).centroid.x).toBeGreaterThan(4);
    expect(maskBounds(morphed.get(5)!).centroid.x).toBeLessThan(11);
  });
});
