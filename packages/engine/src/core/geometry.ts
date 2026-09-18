/** 2D geometry + 3x3 homogeneous transforms used by masking, tracking and compositing. */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Polygon {
  points: Vec2[];
  closed: boolean;
}

/** Row-major 3x3 homogeneous matrix. */
export type Mat3 = [
  number, number, number,
  number, number, number,
  number, number, number,
];

export const MAT3_IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function mat3Multiply(a: Mat3, b: Mat3): Mat3 {
  const out: Mat3 = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] =
        a[r * 3 + 0] * b[0 * 3 + c] + a[r * 3 + 1] * b[1 * 3 + c] + a[r * 3 + 2] * b[2 * 3 + c];
    }
  }
  return out;
}

export function mat3Apply(m: Mat3, p: Vec2): Vec2 {
  const w = m[6] * p.x + m[7] * p.y + m[8];
  const iw = w === 0 ? 1 : 1 / w;
  return {
    x: (m[0] * p.x + m[1] * p.y + m[2]) * iw,
    y: (m[3] * p.x + m[4] * p.y + m[5]) * iw,
  };
}

export function mat3Invert(m: Mat3): Mat3 | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det;
  return [
    (e * i - f * h) * inv,
    (c * h - b * i) * inv,
    (b * f - c * e) * inv,
    (f * g - d * i) * inv,
    (a * i - c * g) * inv,
    (c * d - a * f) * inv,
    (d * h - e * g) * inv,
    (b * g - a * h) * inv,
    (a * e - b * d) * inv,
  ];
}

export function translationMatrix(x: number, y: number): Mat3 {
  return [1, 0, x, 0, 1, y, 0, 0, 1];
}

export function scaleMatrix(sx: number, sy: number): Mat3 {
  return [sx, 0, 0, 0, sy, 0, 0, 0, 1];
}

export function rotationMatrix(radians: number): Mat3 {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

export function skewMatrix(sx: number, sy: number): Mat3 {
  return [1, Math.tan(sx), 0, Math.tan(sy), 1, 0, 0, 0, 1];
}

/**
 * Apply `m` about an arbitrary anchor: T(anchor) · m · T(-anchor).
 * The anchor is the pivot for rotation/scale, so the point itself does not move.
 */
export function transformAbout(m: Mat3, anchor: Vec2): Mat3 {
  return mat3Multiply(
    mat3Multiply(translationMatrix(anchor.x, anchor.y), m),
    translationMatrix(-anchor.x, -anchor.y),
  );
}

export function affineFrom(
  tx: number,
  ty: number,
  rot: number,
  sx: number,
  sy: number,
  anchor: Vec2 = { x: 0, y: 0 },
): Mat3 {
  const local = mat3Multiply(
    translationMatrix(tx, ty),
    mat3Multiply(rotationMatrix(rot), scaleMatrix(sx, sy)),
  );
  // Apply the rotation/scale about the anchor.
  return transformAbout(local, anchor);
}

/** Least-squares fit of an affine transform from >=3 correspondences. */
export function fitAffine(
  src: Vec2[],
  dst: Vec2[],
): { matrix: Mat3; residual: number } | null {
  const n = Math.min(src.length, dst.length);
  if (n < 3) return null;
  // Solve A * p = b for the 6 affine coefficients (two independent 3x3 normal systems).
  let sxx = 0, sxy = 0, syy = 0, sx = 0, sy = 0;
  for (let i = 0; i < n; i++) {
    const p = src[i];
    sxx += p.x * p.x;
    sxy += p.x * p.y;
    syy += p.y * p.y;
    sx += p.x;
    sy += p.y;
  }
  const A: Mat3 = [sxx, sxy, sx, sxy, syy, sy, sx, sy, n];
  const invA = mat3Invert(A);
  if (!invA) return null;
  const bx: number[] = [0, 0, 0];
  const by: number[] = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const p = src[i];
    const q = dst[i];
    bx[0] += p.x * q.x;
    bx[1] += p.y * q.x;
    bx[2] += q.x;
    by[0] += p.x * q.y;
    by[1] += p.y * q.y;
    by[2] += q.y;
  }
  const apply = (inv: Mat3, v: number[]): number[] => [
    inv[0] * v[0] + inv[1] * v[1] + inv[2] * v[2],
    inv[3] * v[0] + inv[4] * v[1] + inv[5] * v[2],
    inv[6] * v[0] + inv[7] * v[1] + inv[8] * v[2],
  ];
  const px = apply(invA, bx);
  const py = apply(invA, by);
  const matrix: Mat3 = [px[0], px[1], px[2], py[0], py[1], py[2], 0, 0, 1];
  let err = 0;
  for (let i = 0; i < n; i++) {
    const q = mat3Apply(matrix, src[i]);
    err += Math.hypot(q.x - dst[i].x, q.y - dst[i].y);
  }
  return { matrix, residual: err / n };
}

/** Least-squares homography fit (DLT, >=4 correspondences) with normalisation. */
export function fitHomography(
  src: Vec2[],
  dst: Vec2[],
): { matrix: Mat3; residual: number } | null {
  const n = Math.min(src.length, dst.length);
  if (n < 4) return null;
  // Build the 2n x 9 system and solve via normal equations + Gaussian elimination
  // on the 9x9 (A^T A) matrix with its smallest eigenvector.
  const at: number[][] = Array.from({ length: 9 }, () => new Array(2 * n).fill(0));
  for (let i = 0; i < n; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    const c1 = 2 * i;
    const c2 = 2 * i + 1;
    at[0][c1] = -x; at[1][c1] = -y; at[2][c1] = -1;
    at[6][c1] = u * x; at[7][c1] = u * y; at[8][c1] = u;
    at[3][c2] = -x; at[4][c2] = -y; at[5][c2] = -1;
    at[6][c2] = v * x; at[7][c2] = v * y; at[8][c2] = v;
  }
  const ata: number[][] = Array.from({ length: 9 }, () => new Array(9).fill(0));
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      let s = 0;
      for (let k = 0; k < 2 * n; k++) s += at[i][k] * at[j][k];
      ata[i][j] = s;
    }
  }
  const v = smallestEigenvector9(ata);
  if (!v) return null;
  if (Math.abs(v[8]) < 1e-9) return null;
  const m: Mat3 = [
    v[0] / v[8], v[1] / v[8], v[2] / v[8],
    v[3] / v[8], v[4] / v[8], v[5] / v[8],
    v[6] / v[8], v[7] / v[8], 1,
  ];
  let err = 0;
  for (let i = 0; i < n; i++) {
    const q = mat3Apply(m, src[i]);
    err += Math.hypot(q.x - dst[i].x, q.y - dst[i].y);
  }
  return { matrix: m, residual: err / n };
}

/** Inverse power iteration for the eigenvector of the smallest eigenvalue (9x9). */
function smallestEigenvector9(a: number[][]): number[] | null {
  const n = 9;
  const m = a.map((row) => row.slice());
  for (let i = 0; i < n; i++) m[i][i] += 1e-6;
  // Invert m by Gauss-Jordan.
  const inv: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
    if (Math.abs(m[piv][c]) < 1e-12) return null;
    [m[c], m[piv]] = [m[piv], m[c]];
    [inv[c], inv[piv]] = [inv[piv], inv[c]];
    const d = m[c][c];
    for (let j = 0; j < n; j++) {
      m[c][j] /= d;
      inv[c][j] /= d;
    }
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r][c];
      if (f === 0) continue;
      for (let j = 0; j < n; j++) {
        m[r][j] -= f * m[c][j];
        inv[r][j] -= f * inv[c][j];
      }
    }
  }
  let v = new Array(n).fill(1 / Math.sqrt(n));
  for (let iter = 0; iter < 64; iter++) {
    const nv = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < n; j++) s += inv[i][j] * v[j];
      nv[i] = s;
    }
    const norm = Math.hypot(...nv) || 1;
    v = nv.map((x) => x / norm);
  }
  return v;
}

export function rectContains(r: Rect, p: Vec2): boolean {
  return p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;
}

export function rectFromPoints(a: Vec2, b: Vec2): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export function polygonArea(poly: Vec2[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  }
  return Math.abs(a / 2);
}

export function pointInPolygon(poly: Vec2[], p: Vec2): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect =
      yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
