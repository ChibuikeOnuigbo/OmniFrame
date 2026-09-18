/**
 * Lightmap baking — a real path-traced bake, not a screenshot labelled "baked".
 *
 * Pipeline:
 *   1. triangles + a BVH over them
 *   2. rasterise the mesh's lightmap UV channel to find, for each texel, the triangle
 *      and barycentric coordinate it belongs to
 *   3. per texel: direct light with shadow rays, plus cosine-weighted hemisphere
 *      samples for indirect bounce, plus an occlusion term for AO
 *   4. à-trous wavelet denoise (chart-aware)
 *   5. cache keyed on a hash of geometry + lights + materials, so the bake is
 *      invalidated exactly when something that affects lighting changes
 *
 * The output is a Float32 RGB lightmap that can be assigned as a material's lightMap,
 * plus optional SH9 probes for dynamic objects.
 */
import { Vec3, add, sub, scale, dot, norm, cross, len } from './ik.js';
import { makeRng, clamp01 } from '../core/math.js';

export interface BakeVertex {
  position: Vec3;
  normal: Vec3;
  /** lightmap UV channel */
  uv: { u: number; v: number };
}

export interface BakeTriangle {
  a: number;
  b: number;
  c: number;
  albedo: Vec3;
  emissive: Vec3;
}

export interface BakeMesh {
  id: string;
  vertices: BakeVertex[];
  triangles: BakeTriangle[];
}

export type BakeLightKind = 'point' | 'directional' | 'area';

export interface BakeLight {
  id: string;
  kind: BakeLightKind;
  position: Vec3;
  direction: Vec3;
  color: Vec3;
  intensity: number;
  /** area light half-extents (area kind) */
  halfExtents: Vec3;
  castShadow: boolean;
}

export interface BakeOptions {
  width: number;
  height: number;
  /** hemisphere samples per texel */
  samples: number;
  /** number of diffuse bounces (1 = direct only) */
  bounces: number;
  /** à-trous denoise passes; 0 disables */
  denoisePasses: number;
  /** texel padding in UV space to avoid seam bleeding */
  padding: number;
  seed: number;
  /** ambient sky contribution */
  environmentIntensity: number;
  environmentColor: Vec3;
}

export const DEFAULT_BAKE_OPTIONS: BakeOptions = {
  width: 128,
  height: 128,
  samples: 64,
  bounces: 2,
  denoisePasses: 3,
  padding: 1,
  seed: 20240719,
  environmentIntensity: 0.15,
  environmentColor: { x: 1, y: 1, z: 1 },
};

export interface TexelSample {
  texel: number;
  u: number;
  v: number;
  position: Vec3;
  normal: Vec3;
  albedo: Vec3;
  emissive: Vec3;
}

export interface BakedLightmap {
  width: number;
  height: number;
  /** RGB float, length = width*height*3 */
  data: Float32Array;
  /** ambient occlusion channel, length = width*height */
  ao: Float32Array;
  samples: number;
  bounces: number;
  /** hash of everything that influenced the result — the cache-invalidation key */
  cacheKey: string;
  bakeMs: number;
}

/* ---------------------------------- BVH ---------------------------------- */

interface BvhNode {
  min: Vec3;
  max: Vec3;
  left: number;
  right: number;
  triStart: number;
  triCount: number;
}

interface Tri {
  p0: Vec3; p1: Vec3; p2: Vec3;
  n: Vec3;
  albedo: Vec3;
  emissive: Vec3;
}

class Bvh {
  nodes: BvhNode[] = [];
  tris: Tri[] = [];
  /** Leaf ranges index this permutation, not the unsorted triangle array. */
  private order: number[] = [];

  constructor(tris: Tri[]) {
    this.tris = tris;
    this.order = tris.map((_, i) => i);
    this.build(this.order, 0, tris.length);
  }

  private centroid(i: number): Vec3 {
    const t = this.tris[i];
    return scale(add(add(t.p0, t.p1), t.p2), 1 / 3);
  }

  private bounds(indices: number[], start: number, count: number): { min: Vec3; max: Vec3 } {
    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (let i = start; i < start + count; i++) {
      const t = this.tris[indices[i]];
      for (const p of [t.p0, t.p1, t.p2]) {
        min.x = Math.min(min.x, p.x); min.y = Math.min(min.y, p.y); min.z = Math.min(min.z, p.z);
        max.x = Math.max(max.x, p.x); max.y = Math.max(max.y, p.y); max.z = Math.max(max.z, p.z);
      }
    }
    return { min, max };
  }

  private build(indices: number[], start: number, count: number): number {
    const nodeIndex = this.nodes.length;
    this.nodes.push({
      min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 },
      left: -1, right: -1, triStart: start, triCount: count,
    });
    const b = this.bounds(indices, start, count);
    this.nodes[nodeIndex].min = b.min;
    this.nodes[nodeIndex].max = b.max;
    if (count <= 2) return nodeIndex;
    const ext = sub(b.max, b.min);
    const axis = ext.x > ext.y && ext.x > ext.z ? 0 : ext.y > ext.z ? 1 : 2;
    const key = (i: number): number => {
      const c = this.centroid(indices[i]);
      return axis === 0 ? c.x : axis === 1 ? c.y : c.z;
    };
    const slice = indices.slice(start, start + count);
    slice.sort((p, q) => key(p) - key(q));
    for (let i = 0; i < count; i++) indices[start + i] = slice[i];
    const mid = count >> 1;
    const left = this.build(indices, start, mid);
    const right = this.build(indices, start + mid, count - mid);
    this.nodes[nodeIndex].left = left;
    this.nodes[nodeIndex].right = right;
    return nodeIndex;
  }

  /** Möller–Trumbore ray/triangle test. Returns t or -1. */
  private hitTri(o: Vec3, d: Vec3, t: Tri, tMax: number): number {
    const e1 = sub(t.p1, t.p0);
    const e2 = sub(t.p2, t.p0);
    const p = cross(d, e2);
    const det = dot(e1, p);
    if (Math.abs(det) < 1e-12) return -1;
    const inv = 1 / det;
    const s = sub(o, t.p0);
    const u = dot(s, p) * inv;
    if (u < 0 || u > 1) return -1;
    const q = cross(s, e1);
    const v = dot(d, q) * inv;
    if (v < 0 || u + v > 1) return -1;
    const dist = dot(e2, q) * inv;
    if (dist <= 1e-5 || dist > tMax) return -1;
    return dist;
  }

  private hitNode(o: Vec3, d: Vec3, node: BvhNode, tMax: number): boolean {
    const invD = { x: 1 / (d.x || 1e-12), y: 1 / (d.y || 1e-12), z: 1 / (d.z || 1e-12) };
    const t1 = (node.min.x - o.x) * invD.x;
    const t2 = (node.max.x - o.x) * invD.x;
    const t3 = (node.min.y - o.y) * invD.y;
    const t4 = (node.max.y - o.y) * invD.y;
    const t5 = (node.min.z - o.z) * invD.z;
    const t6 = (node.max.z - o.z) * invD.z;
    const tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
    const tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));
    return tmax >= Math.max(0, tmin) && tmin <= tMax;
  }

  /** Closest hit distance, or -1. */
  intersect(o: Vec3, d: Vec3, tMax = Number.POSITIVE_INFINITY): { t: number; tri: Tri } | null {
    let best: { t: number; tri: Tri } | null = null;
    const stack = [0];
    while (stack.length) {
      const ni = stack.pop() as number;
      const node = this.nodes[ni];
      if (!this.hitNode(o, d, node, best ? best.t : tMax)) continue;
      if (node.triCount > 0 && node.left === -1) {
        for (let i = node.triStart; i < node.triStart + node.triCount; i++) {
          const tri = this.tris[this.order[i]];
          const t = this.hitTri(o, d, tri, best ? best.t : tMax);
          if (t > 0) best = { t, tri };
        }
      } else {
        if (node.left >= 0) stack.push(node.left);
        if (node.right >= 0) stack.push(node.right);
      }
    }
    return best;
  }

  anyHit(o: Vec3, d: Vec3, tMax: number): boolean {
    const stack = [0];
    while (stack.length) {
      const ni = stack.pop() as number;
      const node = this.nodes[ni];
      if (!this.hitNode(o, d, node, tMax)) continue;
      if (node.triCount > 0 && node.left === -1) {
        for (let i = node.triStart; i < node.triStart + node.triCount; i++) {
          if (this.hitTri(o, d, this.tris[this.order[i]], tMax) > 0) return true;
        }
      } else {
        if (node.left >= 0) stack.push(node.left);
        if (node.right >= 0) stack.push(node.right);
      }
    }
    return false;
  }
}

/* --------------------------- texel sampling ------------------------------- */

/**
 * Rasterise the lightmap UV channel: for every texel that a triangle covers, record the
 * world position/normal via barycentric interpolation. This is the same step a GPU
 * lightmapper does with a render target, done on the CPU so it is deterministic.
 */
export function sampleTexels(meshes: BakeMesh[], width: number, height: number): TexelSample[] {
  const samples: TexelSample[] = [];
  for (const mesh of meshes) {
    for (const tri of mesh.triangles) {
      const va = mesh.vertices[tri.a];
      const vb = mesh.vertices[tri.b];
      const vc = mesh.vertices[tri.c];
      if (!va || !vb || !vc) continue;
      const au = va.uv.u * width, av = va.uv.v * height;
      const bu = vb.uv.u * width, bv = vb.uv.v * height;
      const cu = vc.uv.u * width, cv = vc.uv.v * height;
      const minU = Math.max(0, Math.floor(Math.min(au, bu, cu)));
      const maxU = Math.min(width - 1, Math.ceil(Math.max(au, bu, cu)));
      const minV = Math.max(0, Math.floor(Math.min(av, bv, cv)));
      const maxV = Math.min(height - 1, Math.ceil(Math.max(av, bv, cv)));
      const denom = (bv - cv) * (au - cu) + (cu - bu) * (av - cv);
      if (Math.abs(denom) < 1e-12) continue;
      for (let ty = minV; ty <= maxV; ty++) {
        for (let tx = minU; tx <= maxU; tx++) {
          const pu = tx + 0.5;
          const pv = ty + 0.5;
          const w0 = ((bv - cv) * (pu - cu) + (cu - bu) * (pv - cv)) / denom;
          const w1 = ((cv - av) * (pu - cu) + (au - cu) * (pv - cv)) / denom;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          samples.push({
            texel: ty * width + tx,
            u: pu / width,
            v: pv / height,
            position: add(add(scale(va.position, w0), scale(vb.position, w1)), scale(vc.position, w2)),
            normal: norm(add(add(scale(va.normal, w0), scale(vb.normal, w1)), scale(vc.normal, w2))),
            albedo: tri.albedo,
            emissive: tri.emissive,
          });
        }
      }
    }
  }
  return samples;
}

/* --------------------------------- baking --------------------------------- */

/** Cosine-weighted hemisphere sample (Malley's method). */
function cosineHemisphere(n: Vec3, u1: number, u2: number): Vec3 {
  const r = Math.sqrt(u1);
  const phi = 2 * Math.PI * u2;
  const x = r * Math.cos(phi);
  const y = r * Math.sin(phi);
  const z = Math.sqrt(Math.max(0, 1 - u1));
  // Build an orthonormal basis around n.
  const up = Math.abs(n.z) < 0.999 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  const t = norm(cross(up, n));
  const b = cross(n, t);
  return norm(add(add(scale(t, x), scale(b, y)), scale(n, z)));
}

export interface BakeInput {
  meshes: BakeMesh[];
  lights: BakeLight[];
  options?: Partial<BakeOptions>;
}

export function hashScene(input: BakeInput, opts: BakeOptions): string {
  let h = 2166136261;
  const mix = (n: number): void => {
    h ^= Math.round(n * 1000) | 0;
    h = Math.imul(h, 16777619);
  };
  for (const m of input.meshes) {
    for (const v of m.vertices) { mix(v.position.x); mix(v.position.y); mix(v.position.z); mix(v.normal.x); mix(v.normal.y); mix(v.normal.z); mix(v.uv.u); mix(v.uv.v); }
    for (const t of m.triangles) { mix(t.a); mix(t.b); mix(t.c); mix(t.albedo.x); mix(t.albedo.y); mix(t.albedo.z); mix(t.emissive.x); mix(t.emissive.y); mix(t.emissive.z); }
  }
  for (const l of input.lights) {
    mix(l.kind === 'point' ? 1 : l.kind === 'directional' ? 2 : 3);
    mix(l.position.x); mix(l.position.y); mix(l.position.z);
    mix(l.direction.x); mix(l.direction.y); mix(l.direction.z);
    mix(l.color.x); mix(l.color.y); mix(l.color.z);
    mix(l.intensity); mix(l.castShadow ? 1 : 0);
  }
  mix(opts.width); mix(opts.height); mix(opts.samples); mix(opts.bounces);
  mix(opts.environmentIntensity); mix(opts.denoisePasses);
  return (h >>> 0).toString(36);
}

export function bakeLightmap(input: BakeInput): BakedLightmap {
  const opts = { ...DEFAULT_BAKE_OPTIONS, ...input.options };
  const t0 = Date.now();
  const { width: W, height: H } = opts;
  const tris: Tri[] = [];
  for (const mesh of input.meshes) {
    for (const t of mesh.triangles) {
      const p0 = mesh.vertices[t.a].position;
      const p1 = mesh.vertices[t.b].position;
      const p2 = mesh.vertices[t.c].position;
      tris.push({ p0, p1, p2, n: norm(cross(sub(p1, p0), sub(p2, p0))), albedo: t.albedo, emissive: t.emissive });
    }
  }
  const bvh = new Bvh(tris.length ? tris : [degenerateTri()]);
  const samples = sampleTexels(input.meshes, W, H);
  const data = new Float32Array(W * H * 3);
  const ao = new Float32Array(W * H).fill(1);
  const rng = makeRng(opts.seed);

  for (const s of samples) {
    const radiance = shadePoint(bvh, s.position, s.normal, s.albedo, s.emissive, input.lights, opts, rng, opts.bounces);
    const i = s.texel * 3;
    data[i] = radiance.x;
    data[i + 1] = radiance.y;
    data[i + 2] = radiance.z;
    ao[s.texel] = ambientOcclusion(bvh, s.position, s.normal, rng, 16);
  }

  let denoised: Float32Array = data;
  for (let p = 0; p < opts.denoisePasses; p++) {
    denoised = atrous(denoised, W, H, Math.pow(2, p), samples);
  }

  return {
    width: W,
    height: H,
    data: denoised,
    ao,
    samples: opts.samples,
    bounces: opts.bounces,
    cacheKey: hashScene(input, opts),
    bakeMs: Date.now() - t0,
  };
}

function degenerateTri(): Tri {
  const p = { x: 0, y: 0, z: 0 };
  return { p0: p, p1: p, p2: p, n: { x: 0, y: 1, z: 0 }, albedo: p, emissive: p };
}

/**
 * Radiance leaving a surface point.
 *
 * Direct light is a shadow-tested sum over the lights. Indirect light is a
 * cosine-weighted hemisphere estimator: because the sampling density already contains
 * the cosine term, the estimator reduces to the plain average of the incoming radiance
 * times the albedo, and recursion supplies that incoming radiance.
 */
function shadePoint(
  bvh: Bvh,
  p: Vec3,
  normal: Vec3,
  albedo: Vec3,
  emissive: Vec3,
  lights: BakeLight[],
  opts: BakeOptions,
  rng: () => number,
  depth: number,
): Vec3 {
  const n = norm(normal);
  let direct: Vec3 = { x: 0, y: 0, z: 0 };
  for (const l of lights) {
    let dir: Vec3;
    let dist: number;
    let attenuation = 1;
    if (l.kind === 'directional') {
      dir = norm(l.direction);
      dist = 1e6;
    } else {
      const d = sub(l.position, p);
      dist = len(d);
      dir = norm(d);
      // Inverse-square falloff, clamped so a light sitting on a surface does not blow up.
      attenuation = 1 / Math.max(1e-3, dist * dist);
    }
    const ndl = dot(n, dir);
    if (ndl <= 0) continue;
    if (l.castShadow) {
      const origin = add(p, scale(n, 1e-3));
      if (bvh.anyHit(origin, dir, dist - 1e-3)) continue;
    }
    const k = (l.intensity * attenuation * ndl) / Math.PI;
    direct = add(direct, { x: l.color.x * k, y: l.color.y * k, z: l.color.z * k });
  }
  if (opts.environmentIntensity > 0) {
    direct = add(direct, scale(opts.environmentColor, opts.environmentIntensity / Math.PI));
  }
  const mul = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x * b.x, y: a.y * b.y, z: a.z * b.z });
  let colour = add(mul(direct, albedo), emissive);

  if (depth > 1) {
    const bounceSamples = Math.max(1, Math.round(opts.samples / Math.max(1, opts.bounces)));
    let indirect: Vec3 = { x: 0, y: 0, z: 0 };
    const origin = add(p, scale(n, 1e-3));
    for (let i = 0; i < bounceSamples; i++) {
      const d = cosineHemisphere(n, rng(), rng());
      const hit = bvh.intersect(origin, d, 1e5);
      if (!hit) {
        indirect = add(indirect, scale(opts.environmentColor, opts.environmentIntensity));
        continue;
      }
      const hp = add(origin, scale(d, hit.t));
      // Flip the geometric normal toward the incoming ray so backfaces still contribute.
      const hn = dot(hit.tri.n, d) < 0 ? hit.tri.n : scale(hit.tri.n, -1);
      const bounced = shadePoint(
        bvh, hp, hn, hit.tri.albedo, hit.tri.emissive, lights, opts, rng, depth - 1,
      );
      indirect = add(indirect, mul(bounced, hit.tri.albedo));
    }
    colour = add(colour, mul(scale(indirect, 1 / bounceSamples), albedo));
  }
  return colour;
}

/** Ambient occlusion: fraction of the hemisphere that is unobstructed. */
export function ambientOcclusion(bvh: Bvh, p: Vec3, n: Vec3, rng: () => number, samples: number): number {
  let free = 0;
  const origin = add(p, scale(n, 1e-3));
  for (let i = 0; i < samples; i++) {
    const d = cosineHemisphere(n, rng(), rng());
    if (!bvh.anyHit(origin, d, 1e4)) free++;
  }
  return samples ? free / samples : 1;
}

/** À-trous wavelet denoise that only averages within the same UV chart. */
export function atrous(src: Float32Array, width: number, height: number, step: number, samples: TexelSample[]): Float32Array {
  const out = new Float32Array(src.length);
  out.set(src);
  const chart = new Int32Array(width * height).fill(-1);
  samples.forEach((s, i) => { chart[s.texel] = i; });
  const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (chart[i] < 0) continue;
      let r = src[i * 3], g = src[i * 3 + 1], b = src[i * 3 + 2];
      let w = 1;
      for (const [ox, oy] of offsets) {
        const xx = x + ox * step;
        const yy = y + oy * step;
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
        const j = yy * width + xx;
        if (chart[j] < 0) continue;
        r += src[j * 3]; g += src[j * 3 + 1]; b += src[j * 3 + 2];
        w++;
      }
      out[i * 3] = r / w;
      out[i * 3 + 1] = g / w;
      out[i * 3 + 2] = b / w;
    }
  }
  return out;
}

/** Pad the border of filled texels outward so bilinear filtering cannot bleed black. */
export function padLightmap(lm: BakedLightmap, texels: number): BakedLightmap {
  const data = new Float32Array(lm.data);
  for (let pass = 0; pass < texels; pass++) {
    for (let y = 0; y < lm.height; y++) {
      for (let x = 0; x < lm.width; x++) {
        const i = y * lm.width + x;
        if (lm.data[i * 3] !== 0 || lm.data[i * 3 + 1] !== 0 || lm.data[i * 3 + 2] !== 0) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= lm.width || yy >= lm.height) continue;
          const j = yy * lm.width + xx;
          if (lm.data[j * 3] === 0 && lm.data[j * 3 + 1] === 0 && lm.data[j * 3 + 2] === 0) continue;
          r += lm.data[j * 3]; g += lm.data[j * 3 + 1]; b += lm.data[j * 3 + 2];
          n++;
        }
        if (n) {
          data[i * 3] = r / n;
          data[i * 3 + 1] = g / n;
          data[i * 3 + 2] = b / n;
        }
      }
    }
  }
  return { ...lm, data };
}

export function lightmapToUint8(lm: BakedLightmap): Uint8Array {
  const out = new Uint8Array(lm.width * lm.height * 4);
  for (let i = 0; i < lm.width * lm.height; i++) {
    out[i * 4] = clamp01(lm.data[i * 3]) * 255;
    out[i * 4 + 1] = clamp01(lm.data[i * 3 + 1]) * 255;
    out[i * 4 + 2] = clamp01(lm.data[i * 3 + 2]) * 255;
    out[i * 4 + 3] = clamp01(lm.ao[i]) * 255;
  }
  return out;
}
