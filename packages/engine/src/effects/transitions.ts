/**
 * Transitions. Same rule as effects: data + a CPU reference renderer + GLSL, so preview
 * and export cannot diverge. `t` is normalised progress in [0,1].
 */
import { Rgba, gaussianRgba } from '../core/image.js';
import { clamp01 } from '../core/math.js';

export type TransitionEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export interface TransitionDef {
  id: string;
  name: string;
  category: 'basic' | 'wipe' | 'blur' | '3d' | 'stylize';
  summary: string;
  params: Array<{ key: string; label: string; min: number; max: number; default: number; step: number }>;
  cpu: (a: Rgba, b: Rgba, t: number, params: Record<string, number>) => Rgba;
  glsl: string;
  license: string;
}

function ease(t: number, e: TransitionEasing): number {
  switch (e) {
    case 'easeIn': return t * t;
    case 'easeOut': return 1 - (1 - t) * (1 - t);
    case 'easeInOut': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    default: return t;
  }
}

function out(w: number, h: number): Rgba {
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
}

function sampleAt(img: Rgba, x: number, y: number, o: number): void {
  const cx = Math.max(0, Math.min(img.width - 1, Math.round(x)));
  const cy = Math.max(0, Math.min(img.height - 1, Math.round(y)));
  const i = (cy * img.width + cx) * 4;
  o + 0;
  pixelCopyTarget[0] = img.data[i];
  pixelCopyTarget[1] = img.data[i + 1];
  pixelCopyTarget[2] = img.data[i + 2];
  pixelCopyTarget[3] = img.data[i + 3];
}

// Small scratch so sampleAt does not allocate per pixel.
const pixelCopyTarget = [0, 0, 0, 0];

function mixPix(dst: Rgba, i: number, a: Rgba, b: Rgba, k: number): void {
  dst.data[i] = a.data[i] * (1 - k) + b.data[i] * k;
  dst.data[i + 1] = a.data[i + 1] * (1 - k) + b.data[i + 1] * k;
  dst.data[i + 2] = a.data[i + 2] * (1 - k) + b.data[i + 2] * k;
  dst.data[i + 3] = a.data[i + 3] * (1 - k) + b.data[i + 3] * k;
}

export const TRANSITIONS: TransitionDef[] = [
  {
    id: 'cut', name: 'Cut', category: 'basic', summary: 'Hard cut on the frame boundary.', params: [],
    cpu: (a, b, t) => (t < 0.5 ? a : b),
    glsl: 'gl_FragColor = u_t < 0.5 ? a : b;', license: 'MIT',
  },
  {
    id: 'crossfade', name: 'Crossfade', category: 'basic', summary: 'Linear dissolve.', params: [],
    cpu: (a, b, t) => {
      const o = out(a.width, a.height);
      for (let i = 0; i < o.data.length; i += 4) mixPix(o, i, a, b, t);
      return o;
    },
    glsl: 'gl_FragColor = mix(a, b, u_t);', license: 'MIT',
  },
  {
    id: 'dipToBlack', name: 'Dip to Black', category: 'basic', summary: 'Fade out then in through black.', params: [],
    cpu: (a, b, t) => {
      const o = out(a.width, a.height);
      const k = t < 0.5 ? 1 - t * 2 : (t - 0.5) * 2;
      const src = t < 0.5 ? a : b;
      for (let i = 0; i < o.data.length; i += 4) mixPix(o, i, src, { width: 1, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255]) }, 1 - k);
      return o;
    },
    glsl: 'float k = u_t < 0.5 ? 1.0 - u_t * 2.0 : (u_t - 0.5) * 2.0; gl_FragColor = (u_t < 0.5 ? a : b) * k;', license: 'MIT',
  },
  {
    id: 'wipeLeft', name: 'Wipe Left', category: 'wipe', summary: 'Hard-edged horizontal wipe.',
    params: [{ key: 'softness', label: 'Softness', min: 0, max: 0.3, default: 0.02, step: 0.005 }],
    cpu: (a, b, t, p) => {
      const o = out(a.width, a.height);
      const soft = Math.max(1e-4, p.softness);
      for (let y = 0; y < a.height; y++) {
        for (let x = 0; x < a.width; x++) {
          const i = (y * a.width + x) * 4;
          const k = clamp01((t * (1 + soft) - x / a.width) / soft);
          mixPix(o, i, a, b, k);
        }
      }
      return o;
    },
    glsl: 'gl_FragColor = mix(a, b, clamp((u_t * (1.0 + u_softness) - v_uv.x) / u_softness, 0.0, 1.0));', license: 'MIT',
  },
  {
    id: 'circle', name: 'Circle', category: 'wipe', summary: 'Radial iris wipe.',
    params: [{ key: 'softness', label: 'Softness', min: 0, max: 0.2, default: 0.02, step: 0.005 }],
    cpu: (a, b, t, p) => {
      const o = out(a.width, a.height);
      const soft = Math.max(1e-4, p.softness);
      const maxR = Math.hypot(a.width, a.height) / 2;
      for (let y = 0; y < a.height; y++) {
        for (let x = 0; x < a.width; x++) {
          const i = (y * a.width + x) * 4;
          const d = Math.hypot(x - a.width / 2, y - a.height / 2);
          const k = clamp01((t * maxR * (1 + soft) - d) / (maxR * soft));
          mixPix(o, i, a, b, k);
        }
      }
      return o;
    },
    glsl: 'float d = length(v_uv - 0.5); gl_FragColor = mix(a, b, clamp((u_t * 0.75 - d) / u_softness, 0.0, 1.0));', license: 'MIT',
  },
  {
    id: 'slideLeft', name: 'Slide Left', category: 'basic', summary: 'B pushes A off to the left.', params: [],
    cpu: (a, b, t) => {
      const o = out(a.width, a.height);
      const shift = Math.round(t * a.width);
      for (let y = 0; y < a.height; y++) {
        for (let x = 0; x < a.width; x++) {
          const i = (y * a.width + x) * 4;
          const ax = x + shift;
          const bx = x - (a.width - shift);
          if (bx >= 0) {
            sampleAt(b, bx, y, i);
            o.data[i] = pixelCopyTarget[0]; o.data[i + 1] = pixelCopyTarget[1];
            o.data[i + 2] = pixelCopyTarget[2]; o.data[i + 3] = pixelCopyTarget[3];
          } else if (ax < a.width) {
            sampleAt(a, ax, y, i);
            o.data[i] = pixelCopyTarget[0]; o.data[i + 1] = pixelCopyTarget[1];
            o.data[i + 2] = pixelCopyTarget[2]; o.data[i + 3] = pixelCopyTarget[3];
          }
        }
      }
      return o;
    },
    glsl: 'gl_FragColor = v_uv.x < u_t ? texture2D(u_b, v_uv + vec2(1.0 - u_t, 0.0)) : texture2D(u_a, v_uv - vec2(u_t, 0.0));', license: 'MIT',
  },
  {
    id: 'blurDissolve', name: 'Blur Dissolve', category: 'blur', summary: 'Both sides blur out and in through the mix.',
    params: [{ key: 'maxBlur', label: 'Max blur', min: 1, max: 40, default: 12, step: 1 }],
    cpu: (a, b, t, p) => {
      const blurA = gaussianRgba(a, p.maxBlur * t);
      const blurB = gaussianRgba(b, p.maxBlur * (1 - t));
      const o = out(a.width, a.height);
      for (let i = 0; i < o.data.length; i += 4) mixPix(o, i, blurA, blurB, t);
      return o;
    },
    glsl: 'gl_FragColor = mix(texture2D(u_aBlur, v_uv), texture2D(u_bBlur, v_uv), u_t);', license: 'MIT',
  },
  {
    id: 'zoom', name: 'Zoom', category: 'stylize', summary: 'Punch in on A, out of B.',
    params: [{ key: 'scale', label: 'Scale', min: 1, max: 3, default: 1.6, step: 0.05 }],
    cpu: (a, b, t, p) => {
      const o = out(a.width, a.height);
      const cx = a.width / 2, cy = a.height / 2;
      for (let y = 0; y < a.height; y++) {
        for (let x = 0; x < a.width; x++) {
          const i = (y * a.width + x) * 4;
          const kA = 1 + (p.scale - 1) * t;
          const kB = p.scale - (p.scale - 1) * t;
          const ax = cx + (x - cx) / kA;
          const ay = cy + (y - cy) / kA;
          const bx = cx + (x - cx) / kB;
          const by = cy + (y - cy) / kB;
          sampleAt(a, ax, ay, i);
          const ar = pixelCopyTarget[0], ag = pixelCopyTarget[1], ab = pixelCopyTarget[2], aa = pixelCopyTarget[3];
          sampleAt(b, bx, by, i);
          const k = clamp01(t);
          o.data[i] = ar * (1 - k) + pixelCopyTarget[0] * k;
          o.data[i + 1] = ag * (1 - k) + pixelCopyTarget[1] * k;
          o.data[i + 2] = ab * (1 - k) + pixelCopyTarget[2] * k;
          o.data[i + 3] = aa * (1 - k) + pixelCopyTarget[3] * k;
        }
      }
      return o;
    },
    glsl: 'vec2 za = (v_uv - 0.5) / mix(1.0, u_scale, u_t) + 0.5; gl_FragColor = mix(texture2D(u_a, za), b, u_t);', license: 'MIT',
  },
  {
    id: 'pixelize', name: 'Pixelize', category: 'stylize', summary: 'Mosaic ramps up, swaps, ramps down.',
    params: [{ key: 'maxBlock', label: 'Max block', min: 4, max: 64, default: 24, step: 2 }],
    cpu: (a, b, t, p) => {
      const k = t < 0.5 ? t * 2 : 2 - t * 2;
      const size = Math.max(1, Math.round(1 + k * p.maxBlock));
      const src = t < 0.5 ? a : b;
      const o = out(a.width, a.height);
      for (let by = 0; by < a.height; by += size) {
        for (let bx = 0; bx < a.width; bx += size) {
          let r = 0, g = 0, bb = 0, n = 0;
          for (let y = by; y < Math.min(a.height, by + size); y++) {
            for (let x = bx; x < Math.min(a.width, bx + size); x++) {
              const i = (y * a.width + x) * 4;
              r += src.data[i]; g += src.data[i + 1]; bb += src.data[i + 2]; n++;
            }
          }
          if (!n) continue;
          for (let y = by; y < Math.min(a.height, by + size); y++) {
            for (let x = bx; x < Math.min(a.width, bx + size); x++) {
              const i = (y * a.width + x) * 4;
              o.data[i] = r / n; o.data[i + 1] = g / n; o.data[i + 2] = bb / n; o.data[i + 3] = 255;
            }
          }
        }
      }
      return o;
    },
    glsl: 'vec2 c = floor(v_uv * u_resolution / u_block) * u_block / u_resolution; gl_FragColor = texture2D(u_t < 0.5 ? u_a : u_b, c);', license: 'MIT',
  },
];

const transitionMap = new Map(TRANSITIONS.map((t) => [t.id, t]));

export function getTransition(id: string): TransitionDef | undefined {
  return transitionMap.get(id);
}

export function listTransitions(category?: TransitionDef['category']): TransitionDef[] {
  return category ? TRANSITIONS.filter((t) => t.category === category) : TRANSITIONS.slice();
}

export function renderTransition(
  id: string,
  a: Rgba,
  b: Rgba,
  t: number,
  params: Record<string, number> = {},
  easing: TransitionEasing = 'linear',
): Rgba {
  const def = transitionMap.get(id);
  if (!def) throw new Error(`Unknown transition "${id}"`);
  const merged: Record<string, number> = {};
  for (const p of def.params) merged[p.key] = p.default;
  Object.assign(merged, params);
  return def.cpu(a, b, clamp01(ease(clamp01(t), easing)), merged);
}
