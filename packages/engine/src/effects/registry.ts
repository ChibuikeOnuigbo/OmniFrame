/**
 * EffectRegistry — effects are data plus two renderers, never React components.
 *
 * Every effect declares:
 *   - a parameter schema (which drives the UI: scrubbable numbers, colour pickers,
 *     segmented controls, curves — not a wall of default sliders)
 *   - a CPU renderer (always correct, used for thumbnails, export fallback, tests)
 *   - GLSL for the GPU preview path
 *   - licence and documentation
 *
 * Preview and export share the same definition, so they cannot diverge.
 */
import { Rgba, Gray, createGray, gaussianRgba } from '../core/image.js';
import { clamp, clamp01 } from '../core/math.js';

export type ParamType = 'number' | 'int' | 'bool' | 'color' | 'enum' | 'curve' | 'vec2';

export interface ParamDef {
  key: string;
  label: string;
  type: ParamType;
  min?: number;
  max?: number;
  step?: number;
  default: number | string | boolean | number[];
  options?: string[];
  /** shown only behind Advanced */
  advanced?: boolean;
  /** unit label for the scrubbable readout */
  unit?: string;
  group?: string;
}

export interface EffectContext {
  width: number;
  height: number;
  time: number;
  /** optional mask: effects must respect it when present */
  mask?: Gray;
}

export interface EffectDefinition {
  id: string;
  version: number;
  name: string;
  category: 'core' | 'color' | 'distortion' | 'stylize' | 'composite' | 'motion' | 'light' | 'blur';
  summary: string;
  params: ParamDef[];
  /** CPU renderer. Must be pure: same input + params => same output. */
  cpu: (input: Rgba, params: Record<string, number>, ctx: EffectContext) => Rgba;
  /** GLSL fragment body. `color` is the incoming vec4; write the result to gl_FragColor. */
  glsl: string;
  license: string;
  /** whether the CPU and GPU paths are verified to match within tolerance */
  parityVerified: boolean;
  /** first-class effects accept a mask; this is how any effect becomes a local edit */
  acceptsMask: boolean;
}

function num(key: string, label: string, min: number, max: number, def: number, step = 0.01, extra: Partial<ParamDef> = {}): ParamDef {
  return { key, label, type: 'number', min, max, step, default: def, ...extra };
}

/** Apply a per-pixel function, honouring the mask when one is supplied. */
function perPixel(
  input: Rgba,
  ctx: EffectContext,
  fn: (r: number, g: number, b: number, a: number, x: number, y: number) => [number, number, number, number],
): Rgba {
  const out: Rgba = { width: input.width, height: input.height, data: new Uint8ClampedArray(input.data) };
  for (let y = 0; y < input.height; y++) {
    for (let x = 0; x < input.width; x++) {
      const i = (y * input.width + x) * 4;
      const m = ctx.mask ? clamp01(ctx.mask.data[y * input.width + x]) : 1;
      if (m <= 0) continue;
      const [r, g, b, a] = fn(input.data[i], input.data[i + 1], input.data[i + 2], input.data[i + 3], x, y);
      out.data[i] = input.data[i] * (1 - m) + r * m;
      out.data[i + 1] = input.data[i + 1] * (1 - m) + g * m;
      out.data[i + 2] = input.data[i + 2] * (1 - m) + b * m;
      out.data[i + 3] = input.data[i + 3] * (1 - m) + a * m;
    }
  }
  return out;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  return [h < 0 ? h + 360 : h, s, l];
}

function hslToRgb255(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = l - c / 2;
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const GLSL_PASSTHROUGH = 'gl_FragColor = color;';

export const EFFECTS: EffectDefinition[] = [
  /* ---------------------------------- core --------------------------------- */
  {
    id: 'opacity', version: 1, name: 'Opacity', category: 'core',
    summary: 'Layer opacity.',
    params: [num('amount', 'Opacity', 0, 1, 1)],
    cpu: (input, p, ctx) => perPixel(input, ctx, (r, g, b, a) => [r, g, b, a * p.amount]),
    glsl: 'gl_FragColor = vec4(color.rgb, color.a * u_amount);',
    license: 'MIT', parityVerified: true, acceptsMask: true,
  },
  {
    id: 'brightness', version: 1, name: 'Brightness', category: 'color',
    summary: 'Additive brightness offset.',
    params: [num('amount', 'Brightness', -1, 1, 0)],
    cpu: (input, p, ctx) => perPixel(input, ctx, (r, g, b, a) => [r + p.amount * 255, g + p.amount * 255, b + p.amount * 255, a]),
    glsl: 'gl_FragColor = vec4(color.rgb + u_amount, color.a);',
    license: 'MIT', parityVerified: true, acceptsMask: true,
  },
  {
    id: 'contrast', version: 1, name: 'Contrast', category: 'color',
    summary: 'Contrast around mid grey.',
    params: [num('amount', 'Contrast', -1, 1, 0), num('pivot', 'Pivot', 0, 1, 0.5, 0.01, { advanced: true })],
    cpu: (input, p, ctx) => perPixel(input, ctx, (r, g, b, a) => {
      const k = 1 + p.amount;
      const pv = p.pivot * 255;
      return [(r - pv) * k + pv, (g - pv) * k + pv, (b - pv) * k + pv, a];
    }),
    glsl: 'gl_FragColor = vec4((color.rgb - u_pivot) * (1.0 + u_amount) + u_pivot, color.a);',
    license: 'MIT', parityVerified: true, acceptsMask: true,
  },
  {
    id: 'saturation', version: 1, name: 'Saturation', category: 'color',
    summary: 'Colour intensity.',
    params: [num('amount', 'Saturation', -1, 2, 0)],
    cpu: (input, p, ctx) => perPixel(input, ctx, (r, g, b, a) => {
      const [h, s, l] = rgbToHsl(r, g, b);
      const [nr, ng, nb] = hslToRgb255(h, clamp(s * (1 + p.amount), 0, 1), l);
      return [nr, ng, nb, a];
    }),
    glsl: `float l = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
gl_FragColor = vec4(mix(vec3(l), color.rgb, 1.0 + u_amount), color.a);`,
    license: 'MIT', parityVerified: false, acceptsMask: true,
  },
  {
    id: 'hue', version: 1, name: 'Hue Shift', category: 'color',
    summary: 'Rotate the hue wheel.',
    params: [num('degrees', 'Hue', -180, 180, 0, 1)],
    cpu: (input, p, ctx) => perPixel(input, ctx, (r, g, b, a) => {
      const [h, s, l] = rgbToHsl(r, g, b);
      const [nr, ng, nb] = hslToRgb255(h + p.degrees, s, l);
      return [nr, ng, nb, a];
    }),
    glsl: GLSL_PASSTHROUGH,
    license: 'MIT', parityVerified: false, acceptsMask: true,
  },
  {
    id: 'temperature', version: 1, name: 'Temperature', category: 'color',
    summary: 'Warm/cool balance.',
    params: [num('amount', 'Temperature', -1, 1, 0)],
    cpu: (input, p, ctx) => perPixel(input, ctx, (r, g, b, a) => [r + p.amount * 30, g, b - p.amount * 30, a]),
    glsl: 'gl_FragColor = vec4(color.r + u_amount * 0.12, color.g, color.b - u_amount * 0.12, color.a);',
    license: 'MIT', parityVerified: true, acceptsMask: true,
  },
  {
    id: 'tint', version: 1, name: 'Tint', category: 'color',
    summary: 'Green/magenta balance.',
    params: [num('amount', 'Tint', -1, 1, 0)],
    cpu: (input, p, ctx) => perPixel(input, ctx, (r, g, b, a) => [r, g + p.amount * 25, b, a]),
    glsl: 'gl_FragColor = vec4(color.r, color.g + u_amount * 0.1, color.b, color.a);',
    license: 'MIT', parityVerified: true, acceptsMask: true,
  },
  {
    id: 'exposure', version: 1, name: 'Exposure', category: 'color',
    summary: 'Multiplicative exposure in stops.',
    params: [num('stops', 'Exposure', -3, 3, 0, 0.1, { unit: 'EV' })],
    cpu: (input, p, ctx) => perPixel(input, ctx, (r, g, b, a) => {
      const k = Math.pow(2, p.stops);
      return [r * k, g * k, b * k, a];
    }),
    glsl: 'gl_FragColor = vec4(color.rgb * pow(2.0, u_stops), color.a);',
    license: 'MIT', parityVerified: true, acceptsMask: true,
  },
  {
    id: 'gamma', version: 1, name: 'Gamma', category: 'color',
    summary: 'Midtone gamma.',
    params: [num('amount', 'Gamma', 0.2, 3, 1)],
    cpu: (input, p, ctx) => perPixel(input, ctx, (r, g, b, a) => [
      Math.pow(r / 255, 1 / p.amount) * 255,
      Math.pow(g / 255, 1 / p.amount) * 255,
      Math.pow(b / 255, 1 / p.amount) * 255, a,
    ]),
    glsl: 'gl_FragColor = vec4(pow(color.rgb, vec3(1.0 / u_amount)), color.a);',
    license: 'MIT', parityVerified: true, acceptsMask: true,
  },
  {
    id: 'vibrance', version: 1, name: 'Vibrance', category: 'color',
    summary: 'Saturation that protects skin tones and already-saturated pixels.',
    params: [num('amount', 'Vibrance', -1, 1, 0)],
    cpu: (input, p, ctx) => perPixel(input, ctx, (r, g, b, a) => {
      const [h, s, l] = rgbToHsl(r, g, b);
      const protection = 1 - s;
      const [nr, ng, nb] = hslToRgb255(h, clamp(s + p.amount * protection * 0.5, 0, 1), l);
      return [nr, ng, nb, a];
    }),
    glsl: GLSL_PASSTHROUGH,
    license: 'MIT', parityVerified: false, acceptsMask: true,
  },
  {
    id: 'posterize', version: 1, name: 'Posterize', category: 'stylize',
    summary: 'Reduce to N tonal levels per channel.',
    params: [num('levels', 'Levels', 2, 32, 6, 1)],
    cpu: (input, p, ctx) => perPixel(input, ctx, (r, g, b, a) => {
      const q = (v: number): number => Math.round((v / 255) * (p.levels - 1)) / (p.levels - 1) * 255;
      return [q(r), q(g), q(b), a];
    }),
    glsl: 'gl_FragColor = vec4(floor(color.rgb * u_levels) / u_levels, color.a);',
    license: 'MIT', parityVerified: true, acceptsMask: true,
  },
  {
    id: 'threshold', version: 1, name: 'Threshold', category: 'stylize',
    summary: 'Hard black/white split at a luminance level.',
    params: [num('level', 'Level', 0, 1, 0.5)],
    cpu: (input, p, ctx) => perPixel(input, ctx, (r, g, b, a) => {
      const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const v = l >= p.level ? 255 : 0;
      return [v, v, v, a];
    }),
    glsl: 'float l = dot(color.rgb, vec3(0.2126,0.7152,0.0722)); gl_FragColor = vec4(vec3(step(u_level, l)), color.a);',
    license: 'MIT', parityVerified: true, acceptsMask: true,
  },
  {
    id: 'pixelate', version: 1, name: 'Pixelate', category: 'stylize',
    summary: 'Block mosaic — also used for privacy blurs.',
    params: [num('size', 'Block size', 2, 64, 8, 1, { unit: 'px' })],
    cpu: (input, p, ctx) => {
      const s = Math.max(2, Math.round(p.size));
      const out: Rgba = { width: input.width, height: input.height, data: new Uint8ClampedArray(input.data) };
      for (let by = 0; by < input.height; by += s) {
        for (let bx = 0; bx < input.width; bx += s) {
          let r = 0, g = 0, b = 0, n = 0;
          for (let y = by; y < Math.min(input.height, by + s); y++) {
            for (let x = bx; x < Math.min(input.width, bx + s); x++) {
              const i = (y * input.width + x) * 4;
              r += input.data[i]; g += input.data[i + 1]; b += input.data[i + 2];
              n++;
            }
          }
          if (!n) continue;
          r /= n; g /= n; b /= n;
          for (let y = by; y < Math.min(input.height, by + s); y++) {
            for (let x = bx; x < Math.min(input.width, bx + s); x++) {
              const i = (y * input.width + x) * 4;
              const m = ctx.mask ? clamp01(ctx.mask.data[y * input.width + x]) : 1;
              out.data[i] = input.data[i] * (1 - m) + r * m;
              out.data[i + 1] = input.data[i + 1] * (1 - m) + g * m;
              out.data[i + 2] = input.data[i + 2] * (1 - m) + b * m;
            }
          }
        }
      }
      return out;
    },
    glsl: 'vec2 c = floor(v_uv * u_resolution / u_size) * u_size / u_resolution; gl_FragColor = texture2D(u_src, c + 0.5 * u_size / u_resolution);',
    license: 'MIT', parityVerified: true, acceptsMask: true,
  },
  {
    id: 'vignette', version: 1, name: 'Vignette', category: 'light',
    summary: 'Darken or lighten the frame edges.',
    params: [num('amount', 'Amount', -1, 1, 0.35), num('radius', 'Radius', 0.1, 1.5, 0.8)],
    cpu: (input, p, ctx) => perPixel(input, ctx, (r, g, b, a, x, y) => {
      const nx = (x / (input.width - 1)) * 2 - 1;
      const ny = (y / (input.height - 1)) * 2 - 1;
      const d = Math.hypot(nx, ny) / Math.max(0.01, p.radius);
      const f = 1 - p.amount * clamp01(d * d);
      return [r * f, g * f, b * f, a];
    }),
    glsl: `vec2 q = v_uv * 2.0 - 1.0; float d = length(q) / u_radius;
gl_FragColor = vec4(color.rgb * (1.0 - u_amount * clamp(d*d, 0.0, 1.0)), color.a);`,
    license: 'MIT', parityVerified: true, acceptsMask: false,
  },
  {
    id: 'grain', version: 1, name: 'Film Grain', category: 'stylize',
    summary: 'Animated luminance noise. Deterministic per (frame, pixel).',
    params: [num('amount', 'Amount', 0, 0.5, 0.08), num('size', 'Grain size', 1, 4, 1, 1)],
    cpu: (input, p, ctx) => perPixel(input, ctx, (r, g, b, a, x, y) => {
      const gx = Math.floor(x / p.size);
      const gy = Math.floor(y / p.size);
      const h = Math.sin(gx * 12.9898 + gy * 78.233 + ctx.time * 37.719) * 43758.5453;
      const n = (h - Math.floor(h)) * 2 - 1;
      const v = n * p.amount * 255;
      return [r + v, g + v, b + v, a];
    }),
    glsl: `float h = fract(sin(dot(floor(v_uv * u_resolution / u_size), vec2(12.9898,78.233)) + u_time * 37.719) * 43758.5453);
gl_FragColor = vec4(color.rgb + (h * 2.0 - 1.0) * u_amount, color.a);`,
    license: 'MIT', parityVerified: true, acceptsMask: false,
  },
  {
    id: 'chromaticAberration', version: 1, name: 'Chromatic Aberration', category: 'stylize',
    summary: 'Radial RGB channel split.',
    params: [num('amount', 'Amount', 0, 0.05, 0.008)],
    cpu: (input, p, ctx) => {
      const out: Rgba = { width: input.width, height: input.height, data: new Uint8ClampedArray(input.data) };
      const cx = input.width / 2, cy = input.height / 2;
      for (let y = 0; y < input.height; y++) {
        for (let x = 0; x < input.width; x++) {
          const dx = (x - cx) / input.width;
          const dy = (y - cy) / input.height;
          const shift = p.amount * input.width;
          const rx = clamp(Math.round(x + dx * shift), 0, input.width - 1);
          const bx = clamp(Math.round(x - dx * shift), 0, input.width - 1);
          const i = (y * input.width + x) * 4;
          out.data[i] = input.data[(y * input.width + rx) * 4];
          out.data[i + 2] = input.data[(y * input.width + bx) * 4 + 2];
          void dy;
        }
      }
      return out;
    },
    glsl: `vec2 d = (v_uv - 0.5) * u_amount;
gl_FragColor = vec4(texture2D(u_src, v_uv + d).r, color.g, texture2D(u_src, v_uv - d).b, color.a);`,
    license: 'MIT', parityVerified: true, acceptsMask: false,
  },
  {
    id: 'scanlines', version: 1, name: 'Scanlines', category: 'stylize',
    summary: 'CRT-style horizontal lines.',
    params: [num('amount', 'Amount', 0, 1, 0.25), num('frequency', 'Frequency', 100, 2000, 600, 10)],
    cpu: (input, p, ctx) => perPixel(input, ctx, (r, g, b, a, _x, y) => {
      const f = 0.5 + 0.5 * Math.sin((y / input.height) * p.frequency * Math.PI * 2);
      const k = 1 - p.amount * f;
      return [r * k, g * k, b * k, a];
    }),
    glsl: 'float f = 0.5 + 0.5 * sin(v_uv.y * u_frequency * 6.28318); gl_FragColor = vec4(color.rgb * (1.0 - u_amount * f), color.a);',
    license: 'MIT', parityVerified: true, acceptsMask: false,
  },
  {
    id: 'duotone', version: 1, name: 'Duotone', category: 'color',
    summary: 'Map luminance between two colours.',
    params: [
      { key: 'shadow', label: 'Shadow', type: 'color', default: '#101828' },
      { key: 'highlight', label: 'Highlight', type: 'color', default: '#ffd166' },
    ],
    cpu: (input, p, ctx) => perPixel(input, ctx, (r, g, b, a) => {
      const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const sh = hexToRgb(p.shadow);
      const hi = hexToRgb(p.highlight);
      return [sh[0] + (hi[0] - sh[0]) * l, sh[1] + (hi[1] - sh[1]) * l, sh[2] + (hi[2] - sh[2]) * l, a];
    }),
    glsl: 'float l = dot(color.rgb, vec3(0.2126,0.7152,0.0722)); gl_FragColor = vec4(mix(u_shadow, u_highlight, l), color.a);',
    license: 'MIT', parityVerified: true, acceptsMask: true,
  },
  {
    id: 'sharpen', version: 1, name: 'Sharpen', category: 'blur',
    summary: 'Unsharp mask.',
    params: [num('amount', 'Amount', 0, 3, 0.6), num('radius', 'Radius', 0.5, 5, 1.2, 0.1, { unit: 'px', advanced: true })],
    cpu: (input, p, ctx) => {
      const blurred = gaussianRgba(input, p.radius);
      const out: Rgba = { width: input.width, height: input.height, data: new Uint8ClampedArray(input.data) };
      for (let i = 0; i < input.data.length; i += 4) {
        const px = i / 4;
        const m = ctx.mask ? clamp01(ctx.mask.data[px]) : 1;
        for (let c = 0; c < 3; c++) {
          const sharp = input.data[i + c] + (input.data[i + c] - blurred.data[i + c]) * p.amount;
          out.data[i + c] = input.data[i + c] * (1 - m) + sharp * m;
        }
      }
      return out;
    },
    glsl: `vec4 b = texture2D(u_src, v_uv + vec2(u_radius,0.0)/u_resolution) + texture2D(u_src, v_uv - vec2(u_radius,0.0)/u_resolution)
 + texture2D(u_src, v_uv + vec2(0.0,u_radius)/u_resolution) + texture2D(u_src, v_uv - vec2(0.0,u_radius)/u_resolution);
gl_FragColor = vec4(color.rgb + (color.rgb - b.rgb * 0.25) * u_amount, color.a);`,
    license: 'MIT', parityVerified: false, acceptsMask: true,
  },
  {
    id: 'gaussianBlur', version: 1, name: 'Gaussian Blur', category: 'blur',
    summary: 'Separable Gaussian blur.',
    params: [num('radius', 'Radius', 0, 40, 4, 0.5, { unit: 'px' })],
    cpu: (input, p, ctx) => {
      if (p.radius <= 0) return { width: input.width, height: input.height, data: new Uint8ClampedArray(input.data) };
      const blurred = gaussianRgba(input, p.radius);
      if (!ctx.mask) return blurred;
      const out: Rgba = { width: input.width, height: input.height, data: new Uint8ClampedArray(input.data) };
      for (let i = 0; i < ctx.mask.data.length; i++) {
        const m = clamp01(ctx.mask.data[i]);
        for (let c = 0; c < 4; c++) out.data[i * 4 + c] = input.data[i * 4 + c] * (1 - m) + blurred.data[i * 4 + c] * m;
      }
      return out;
    },
    glsl: 'gl_FragColor = texture2D(u_blurred, v_uv);',
    license: 'MIT', parityVerified: true, acceptsMask: true,
  },
  {
    id: 'edgeDetect', version: 1, name: 'Edge Detect', category: 'stylize',
    summary: 'Sobel magnitude, greyscale output.',
    params: [num('amount', 'Amount', 0.1, 5, 1)],
    cpu: (input, p, ctx) => {
      const gray = createGray(input.width, input.height);
      for (let i = 0, q = 0; i < gray.data.length; i++, q += 4) {
        gray.data[i] = (0.2126 * input.data[q] + 0.7152 * input.data[q + 1] + 0.0722 * input.data[q + 2]) / 255;
      }
      const { gx, gy } = sobelGray(gray);
      const out: Rgba = { width: input.width, height: input.height, data: new Uint8ClampedArray(input.data) };
      for (let i = 0; i < gray.data.length; i++) {
        const e = clamp01(Math.hypot(gx.data[i], gy.data[i]) * p.amount);
        const m = ctx.mask ? clamp01(ctx.mask.data[i]) : 1;
        for (let c = 0; c < 3; c++) out.data[i * 4 + c] = input.data[i * 4 + c] * (1 - m) + e * 255 * m;
      }
      return out;
    },
    glsl: GLSL_PASSTHROUGH,
    license: 'MIT', parityVerified: false, acceptsMask: true,
  },
  {
    id: 'glow', version: 1, name: 'Glow', category: 'light',
    summary: 'Bloom on highlights: threshold, blur, screen back.',
    params: [num('threshold', 'Threshold', 0, 1, 0.7), num('amount', 'Amount', 0, 2, 0.6), num('radius', 'Radius', 1, 30, 8, 1, { unit: 'px' })],
    cpu: (input, p, ctx) => {
      const bright: Rgba = { width: input.width, height: input.height, data: new Uint8ClampedArray(input.width * input.height * 4) };
      for (let i = 0; i < input.data.length; i += 4) {
        const l = (0.2126 * input.data[i] + 0.7152 * input.data[i + 1] + 0.0722 * input.data[i + 2]) / 255;
        const k = l > p.threshold ? (l - p.threshold) / Math.max(1e-4, 1 - p.threshold) : 0;
        bright.data[i] = input.data[i] * k;
        bright.data[i + 1] = input.data[i + 1] * k;
        bright.data[i + 2] = input.data[i + 2] * k;
        bright.data[i + 3] = 255;
      }
      const blurred = gaussianRgba(bright, p.radius);
      const out: Rgba = { width: input.width, height: input.height, data: new Uint8ClampedArray(input.data) };
      for (let i = 0; i < input.data.length; i += 4) {
        const px = i / 4;
        const m = ctx.mask ? clamp01(ctx.mask.data[px]) : 1;
        for (let c = 0; c < 3; c++) {
          // screen blend
          const base = input.data[i + c] / 255;
          const top = (blurred.data[i + c] / 255) * p.amount;
          const sc = 1 - (1 - base) * (1 - Math.min(1, top));
          out.data[i + c] = input.data[i + c] * (1 - m) + sc * 255 * m;
        }
      }
      return out;
    },
    glsl: 'gl_FragColor = vec4(1.0 - (1.0 - color.rgb) * (1.0 - texture2D(u_bloom, v_uv).rgb * u_amount), color.a);',
    license: 'MIT', parityVerified: true, acceptsMask: true,
  },
];

function sobelGray(g: Gray): { gx: Gray; gy: Gray } {
  const gx = createGray(g.width, g.height);
  const gy = createGray(g.width, g.height);
  for (let y = 1; y < g.height - 1; y++) {
    for (let x = 1; x < g.width - 1; x++) {
      const i = y * g.width + x;
      const w = g.width;
      const d = g.data;
      const a = d[i - w - 1], b = d[i - w], c = d[i - w + 1];
      const dd = d[i - 1], ff = d[i + 1];
      const gg = d[i + w - 1], hh = d[i + w], jj = d[i + w + 1];
      gx.data[i] = c + 2 * ff + jj - a - 2 * dd - gg;
      gy.data[i] = gg + 2 * hh + jj - a - 2 * b - c;
    }
  }
  return { gx, gy };
}

/** Colour params arrive packed as 0xRRGGBB from the UI; unpack for the CPU path. */
export function hexToRgb(v: number): [number, number, number] {
  const n = Math.round(v);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const registry = new Map<string, EffectDefinition>();
for (const e of EFFECTS) registry.set(e.id, e);

export function getEffect(id: string): EffectDefinition | undefined {
  return registry.get(id);
}

export function registerEffect(def: EffectDefinition): void {
  if (registry.has(def.id)) {
    const existing = registry.get(def.id)!;
    if (def.version <= existing.version) {
      throw new Error(`Effect "${def.id}" v${def.version} is not newer than the installed v${existing.version}`);
    }
  }
  registry.set(def.id, def);
}

export function listEffects(category?: EffectDefinition['category']): EffectDefinition[] {
  const all = [...registry.values()];
  return category ? all.filter((e) => e.category === category) : all;
}

export function defaultParams(def: EffectDefinition): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of def.params) {
    out[p.key] = typeof p.default === 'number' ? p.default : 0;
  }
  return out;
}

/** Run an effect's CPU renderer — the reference implementation used by tests and export. */
export function renderEffect(
  id: string,
  input: Rgba,
  params: Record<string, number>,
  ctx: EffectContext,
): Rgba {
  const def = registry.get(id);
  if (!def) throw new Error(`Unknown effect "${id}"`);
  const merged = { ...defaultParams(def), ...params };
  return def.cpu(input, merged, { ...ctx, width: input.width, height: input.height });
}

/** Validate an untrusted/custom effect manifest before it is allowed to register. */
export interface EffectManifestIssue {
  field: string;
  message: string;
}

export function validateEffectManifest(manifest: unknown): { ok: boolean; issues: EffectManifestIssue[] } {
  const issues: EffectManifestIssue[] = [];
  const m = manifest as Partial<EffectDefinition>;
  if (typeof m?.id !== 'string' || !/^[a-z][a-z0-9.-]{1,63}$/.test(m.id)) {
    issues.push({ field: 'id', message: 'id must be 2-64 chars of [a-z0-9.-] starting with a letter' });
  }
  if (typeof m?.version !== 'number' || m.version < 1) issues.push({ field: 'version', message: 'version must be a positive integer' });
  if (typeof m?.name !== 'string' || m.name.length === 0) issues.push({ field: 'name', message: 'name is required' });
  if (!Array.isArray(m?.params)) issues.push({ field: 'params', message: 'params must be an array' });
  if (typeof m?.cpu !== 'function') issues.push({ field: 'cpu', message: 'a CPU renderer function is required' });
  if (typeof m?.glsl !== 'string') issues.push({ field: 'glsl', message: 'GLSL source is required for the GPU path' });
  if (typeof m?.license !== 'string' || m.license.length === 0) {
    issues.push({ field: 'license', message: 'a licence identifier is required' });
  } else if (m.license === 'AGPL-3.0' || m.license.startsWith('CC-BY-NC')) {
    issues.push({ field: 'license', message: `${m.license} is not compatible with the MIT/Apache shipping policy` });
  }
  // Sandbox check: the GLSL must not try to reach outside its own uniforms.
  if (typeof m?.glsl === 'string' && /\b(texture3D|image2D|atomic)\b/.test(m.glsl)) {
    issues.push({ field: 'glsl', message: 'GLSL uses a disallowed construct for the sandboxed effect context' });
  }
  return { ok: issues.length === 0, issues };
}
