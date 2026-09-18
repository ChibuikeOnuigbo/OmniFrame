/**
 * Pixel buffers used by every CPU path in the engine.
 *
 * Colour model: all buffers are NON-premultiplied RGBA in linear-light sRGB primaries.
 * Masks are single-channel float in [0,1] where 1 = fully selected.
 */

export interface Gray {
  width: number;
  height: number;
  /** length === width*height, values in [0,1] (luma) or arbitrary float for masks. */
  data: Float32Array;
}

export interface Rgba {
  width: number;
  height: number;
  /** length === width*height*4, values in [0,255]. */
  data: Uint8ClampedArray;
}

export function createGray(width: number, height: number, fill = 0): Gray {
  return { width, height, data: new Float32Array(width * height).fill(fill) };
}

export function cloneGray(g: Gray): Gray {
  return { width: g.width, height: g.height, data: g.data.slice() };
}

export function createRgba(width: number, height: number): Rgba {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function rgbaToGray(img: Rgba): Gray {
  const out = createGray(img.width, img.height);
  const src = img.data;
  for (let i = 0, p = 0; i < out.data.length; i++, p += 4) {
    // Rec.709 luma on sRGB-encoded values (matches what OpenCV does for CV_8UC3->gray).
    out.data[i] = (0.2126 * src[p] + 0.7152 * src[p + 1] + 0.0722 * src[p + 2]) / 255;
  }
  return out;
}

export function rgbaToGrayLinear(img: Rgba): Gray {
  const out = createGray(img.width, img.height);
  const src = img.data;
  for (let i = 0, p = 0; i < out.data.length; i++, p += 4) {
    const r = srgbToLinear(src[p] / 255);
    const g = srgbToLinear(src[p + 1] / 255);
    const b = srgbToLinear(src[p + 2] / 255);
    out.data[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  return out;
}

export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(c: number): number {
  const v = Math.max(0, Math.min(1, c));
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

export function grayAt(g: Gray, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= g.width || y >= g.height) return 0;
  return g.data[(y | 0) * g.width + (x | 0)];
}

/** Bilinear sample, zero outside the buffer. */
export function graySample(g: Gray, x: number, y: number): number {
  if (x < 0 || y < 0 || x > g.width - 1 || y > g.height - 1) return 0;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, g.width - 1);
  const y1 = Math.min(y0 + 1, g.height - 1);
  const fx = x - x0;
  const fy = y - y0;
  const w = g.width;
  const d = g.data;
  const a = d[y0 * w + x0];
  const b = d[y0 * w + x1];
  const c = d[y1 * w + x0];
  const e = d[y1 * w + x1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy;
}

export function rgbaSample(
  img: Rgba,
  x: number,
  y: number,
  out: { r: number; g: number; b: number; a: number },
): void {
  if (x < 0 || y < 0 || x > img.width - 1 || y > img.height - 1) {
    out.r = out.g = out.b = out.a = 0;
    return;
  }
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, img.width - 1);
  const y1 = Math.min(y0 + 1, img.height - 1);
  const fx = x - x0;
  const fy = y - y0;
  const w = img.width;
  const d = img.data;
  const i00 = (y0 * w + x0) * 4;
  const i01 = (y0 * w + x1) * 4;
  const i10 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;
  const w00 = (1 - fx) * (1 - fy);
  const w01 = fx * (1 - fy);
  const w10 = (1 - fx) * fy;
  const w11 = fx * fy;
  out.r = d[i00] * w00 + d[i01] * w01 + d[i10] * w10 + d[i11] * w11;
  out.g = d[i00 + 1] * w00 + d[i01 + 1] * w01 + d[i10 + 1] * w10 + d[i11 + 1] * w11;
  out.b = d[i00 + 2] * w00 + d[i01 + 2] * w01 + d[i10 + 2] * w10 + d[i11 + 2] * w11;
  out.a = d[i00 + 3] * w00 + d[i01 + 3] * w01 + d[i10 + 3] * w10 + d[i11 + 3] * w11;
}

/** Separable 1-D Gaussian kernel (sigma in pixels). Radius is clamped to 1..3x sigma. */
export function gaussianKernel(sigma: number): Float32Array {
  if (sigma <= 0) return new Float32Array([1]);
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const size = radius * 2 + 1;
  const k = new Float32Array(size);
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const d = i - radius;
    const v = Math.exp(-(d * d) / (2 * sigma * sigma));
    k[i] = v;
    sum += v;
  }
  for (let i = 0; i < size; i++) k[i] /= sum;
  return k;
}

export function gaussianGray(src: Gray, sigma: number): Gray {
  if (sigma <= 0) return cloneGray(src);
  const k = gaussianKernel(sigma);
  const r = (k.length - 1) >> 1;
  const { width: w, height: h } = src;
  const tmp = new Float32Array(w * h);
  const dst = new Float32Array(w * h);
  // horizontal
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) {
        const xx = x + i;
        if (xx < 0 || xx >= w) continue;
        s += src.data[row + xx] * k[i + r];
      }
      tmp[row + x] = s;
    }
  }
  // vertical
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let i = -r; i <= r; i++) {
        const yy = y + i;
        if (yy < 0 || yy >= h) continue;
        s += tmp[yy * w + x] * k[i + r];
      }
      dst[y * w + x] = s;
    }
  }
  return { width: w, height: h, data: dst };
}

export function gaussianRgba(src: Rgba, sigma: number): Rgba {
  if (sigma <= 0) return { width: src.width, height: src.height, data: src.data.slice() };
  const k = gaussianKernel(sigma);
  const r = (k.length - 1) >> 1;
  const { width: w, height: h } = src;
  const tmp = new Float32Array(w * h * 4);
  const dst = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let cr = 0, cg = 0, cb = 0, ca = 0;
      for (let i = -r; i <= r; i++) {
        const xx = x + i;
        if (xx < 0 || xx >= w) continue;
        const p = (y * w + xx) * 4;
        const kw = k[i + r];
        cr += src.data[p] * kw;
        cg += src.data[p + 1] * kw;
        cb += src.data[p + 2] * kw;
        ca += src.data[p + 3] * kw;
      }
      const o = (y * w + x) * 4;
      tmp[o] = cr; tmp[o + 1] = cg; tmp[o + 2] = cb; tmp[o + 3] = ca;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let cr = 0, cg = 0, cb = 0, ca = 0;
      for (let i = -r; i <= r; i++) {
        const yy = y + i;
        if (yy < 0 || yy >= h) continue;
        const p = (yy * w + x) * 4;
        const kw = k[i + r];
        cr += tmp[p] * kw;
        cg += tmp[p + 1] * kw;
        cb += tmp[p + 2] * kw;
        ca += tmp[p + 3] * kw;
      }
      const o = (y * w + x) * 4;
      dst[o] = cr; dst[o + 1] = cg; dst[o + 2] = cb; dst[o + 3] = ca;
    }
  }
  return { width: w, height: h, data: dst };
}

/** Box downsample by an integer-ish factor using a 2x2 average (mip-style). */
export function downsampleGray(src: Gray, factor: number): Gray {
  const w = Math.max(1, Math.round(src.width / factor));
  const h = Math.max(1, Math.round(src.height / factor));
  const out = createGray(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x * factor;
      const sy = y * factor;
      let s = 0;
      let n = 0;
      for (let dy = 0; dy < factor; dy++) {
        const yy = Math.min(src.height - 1, Math.floor(sy + dy));
        for (let dx = 0; dx < factor; dx++) {
          const xx = Math.min(src.width - 1, Math.floor(sx + dx));
          s += src.data[yy * src.width + xx];
          n++;
        }
      }
      out.data[y * w + x] = n ? s / n : 0;
    }
  }
  return out;
}

export function upsampleGray(src: Gray, width: number, height: number): Gray {
  const out = createGray(width, height);
  if (src.width === 0 || src.height === 0) return out;
  for (let y = 0; y < height; y++) {
    const sy = (y / height) * src.height;
    for (let x = 0; x < width; x++) {
      const sx = (x / width) * src.width;
      out.data[y * width + x] = graySample(src, Math.min(src.width - 1, sx), Math.min(src.height - 1, sy));
    }
  }
  return out;
}

export function sobel(g: Gray): { gx: Gray; gy: Gray } {
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
