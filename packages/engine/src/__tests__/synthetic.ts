/**
 * Synthetic scene generator used by the tracking tests.
 *
 * These are real images fed to the real tracker — no recorded fixtures, no mocks.
 * The texture is deliberately low-frequency (characteristic scale ~10 px) because a
 * high-frequency checkerboard aliases away in a Gaussian pyramid and is pathological
 * for any multiscale tracker; real footage does not look like that.
 */
import { Gray, Rgba, createGray } from '../core/image.js';

export interface SceneSpec {
  width: number;
  height: number;
  objectAt: (frame: number) => { x: number; y: number; w: number; h: number };
  cameraAt: (frame: number) => { x: number; y: number };
  limbAt?: (frame: number) => { x: number; y: number; length: number; angle: number };
}

/** Smooth pseudo-random texture field, characteristic scale ~10 px. */
function tex(x: number, y: number): number {
  return (
    0.5 +
    0.22 * Math.sin(x * 0.7 + y * 0.13) +
    0.18 * Math.cos(y * 0.55 - x * 0.09) +
    0.14 * Math.sin((x + y) * 0.31) +
    0.1 * Math.cos(x * 0.42 - y * 0.37)
  );
}

export function renderScene(spec: SceneSpec, frame: number): Gray {
  const { width: w, height: h } = spec;
  const img = createGray(w, h);
  const cam = spec.cameraAt(frame);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      img.data[y * w + x] = 0.16 + 0.1 * tex(x + cam.x, y + cam.y);
    }
  }
  const o = spec.objectAt(frame);
  const ox = Math.floor(o.x);
  const oy = Math.floor(o.y);
  for (let y = oy; y < Math.ceil(o.y + o.h); y++) {
    for (let x = ox; x < Math.ceil(o.x + o.w); x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      // Subject uses a different phase and a much higher contrast than the backdrop,
      // so the silhouette edge is a genuine, findable transition.
      img.data[y * w + x] = 0.55 + 0.32 * tex(x - ox + 31, y - oy + 17);
    }
  }
  if (spec.limbAt) {
    const l = spec.limbAt(frame);
    for (let s = 0; s < l.length; s++) {
      const x = Math.round(l.x + Math.cos(l.angle) * s);
      const y = Math.round(l.y + Math.sin(l.angle) * s);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          img.data[yy * w + xx] = 0.6 + 0.3 * tex(xx + 7, yy + 3);
        }
      }
    }
  }
  return img;
}

export function renderSceneSequence(spec: SceneSpec, frames: number): Gray[] {
  return Array.from({ length: frames }, (_, i) => renderScene(spec, i));
}

export function grayToRgba(g: Gray): Rgba {
  const data = new Uint8ClampedArray(g.width * g.height * 4);
  for (let i = 0; i < g.data.length; i++) {
    const v = Math.max(0, Math.min(255, g.data[i] * 255));
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return { width: g.width, height: g.height, data };
}

export function centroid(m: Gray): { x: number; y: number; area: number } {
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
  return n ? { x: sx / n, y: sy / n, area: n } : { x: 0, y: 0, area: 0 };
}

export function rectMask(width: number, height: number, x: number, y: number, w: number, h: number): Gray {
  const m = createGray(width, height);
  for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(height, Math.ceil(y + h)); yy++) {
    for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(width, Math.ceil(x + w)); xx++) {
      m.data[yy * width + xx] = 1;
    }
  }
  return m;
}
