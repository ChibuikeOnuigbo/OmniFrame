/** Gaussian image pyramid (multiscale: coarse levels absorb large motion). */
import { Gray, createGray, gaussianGray } from '../core/image.js';

export interface Pyramid {
  levels: Gray[];
  /** scale factor between consecutive levels */
  factor: number;
}

export function buildPyramid(img: Gray, levels: number, factor = 2): Pyramid {
  const out: Gray[] = [img];
  let cur = img;
  for (let l = 1; l <= levels; l++) {
    const w = Math.max(1, Math.floor(cur.width / factor));
    const h = Math.max(1, Math.floor(cur.height / factor));
    if (w < 8 || h < 8) break;
    // Blur before decimating to avoid aliasing (standard Gaussian pyramid construction).
    const blurred = gaussianGray(cur, 1.0);
    const next = createGray(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        next.data[y * w + x] = blurred.data[Math.min(blurred.height - 1, y * factor) * blurred.width + Math.min(blurred.width - 1, x * factor)];
      }
    }
    out.push(next);
    cur = next;
  }
  return { levels: out, factor };
}

/** Scale a point from level 0 coordinates into the coordinates of `level`. */
export function toLevel(p: { x: number; y: number }, level: number, factor = 2): { x: number; y: number } {
  const s = Math.pow(factor, level);
  return { x: p.x / s, y: p.y / s };
}

export function toLevel0(p: { x: number; y: number }, level: number, factor = 2): { x: number; y: number } {
  const s = Math.pow(factor, level);
  return { x: p.x * s, y: p.y * s };
}
