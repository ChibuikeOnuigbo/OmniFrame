/**
 * Rigging and skinning.
 *
 * A rig is a bone hierarchy plus per-vertex skin weights. Poses are evaluated as a
 * linear blend skin (the same model glTF uses), so a glTF-sourced skeleton and one
 * built here behave identically. IK chains from ./ik.ts can drive any bone, which is
 * how "attach a tracked point to a bone" works.
 */
import { Vec3, add, sub, scale, norm, dot, cross, len, rotateVector } from './ik.js';
import { clamp, clamp01 } from '../core/math.js';

export interface Bone {
  id: string;
  name: string;
  /** index of the parent bone, or -1 for a root */
  parent: number;
  /** rest-space local transform */
  restPosition: Vec3;
  restRotation: Quaternion;
  restScale: Vec3;
  /** inverse bind matrix as 16 floats (column-major, glTF convention) */
  inverseBindMatrix: number[];
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface SkinWeight {
  vertex: number;
  /** up to 4 bone indices */
  joints: number[];
  /** matching weights, normalised to sum to 1 */
  weights: number[];
}

export interface Rig {
  id: string;
  name: string;
  bones: Bone[];
  weights: SkinWeight[];
}

export const QUAT_IDENTITY: Quaternion = { x: 0, y: 0, z: 0, w: 1 };

export function quatFromAxisAngle(axis: Vec3, angle: number): Quaternion {
  const a = norm(axis);
  const s = Math.sin(angle / 2);
  return { x: a.x * s, y: a.y * s, z: a.z * s, w: Math.cos(angle / 2) };
}

export function quatMultiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

export function quatNormalize(q: Quaternion): Quaternion {
  const l = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l };
}

/** Spherical linear interpolation, with a dot check so it takes the short way round. */
export function quatSlerp(a: Quaternion, b: Quaternion, t: number): Quaternion {
  let bx = b.x, by = b.y, bz = b.z, bw = b.w;
  let cos = a.x * bx + a.y * by + a.z * bz + a.w * bw;
  if (cos < 0) {
    bx = -bx; by = -by; bz = -bz; bw = -bw;
    cos = -cos;
  }
  if (cos > 0.9995) {
    return quatNormalize({
      x: a.x + (bx - a.x) * t,
      y: a.y + (by - a.y) * t,
      z: a.z + (bz - a.z) * t,
      w: a.w + (bw - a.w) * t,
    });
  }
  const theta = Math.acos(clamp(cos, -1, 1));
  const sin = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sin;
  const wb = Math.sin(t * theta) / sin;
  return quatNormalize({
    x: a.x * wa + bx * wb,
    y: a.y * wa + by * wb,
    z: a.z * wa + bz * wb,
    w: a.w * wa + bw * wb,
  });
}

export function quatToMatrix(q: Quaternion): number[] {
  const { x, y, z, w } = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    1 - (yy + zz), xy + wz, xz - wy, 0,
    xy - wz, 1 - (xx + zz), yz + wx, 0,
    xz + wy, yz - wx, 1 - (xx + yy), 0,
    0, 0, 0, 1,
  ];
}

export function quatRotate(q: Quaternion, v: Vec3): Vec3 {
  const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
  const ix = qw * v.x + qy * v.z - qz * v.y;
  const iy = qw * v.y + qz * v.x - qx * v.z;
  const iz = qw * v.z + qx * v.y - qy * v.x;
  const iw = -qx * v.x - qy * v.y - qz * v.z;
  return {
    x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
    y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
    z: iz * qw + iw * -qz + ix * -qy - iy * -qx,
  };
}

export interface BonePose {
  position: Vec3;
  rotation: Quaternion;
  scale: Vec3;
}

/** Compute world matrices for every bone from a pose array (index-aligned with rig.bones). */
export function computeWorldMatrices(rig: Rig, poses: BonePose[]): number[][] {
  const local = poses.map((p, i) => composeMatrix(p, rig.bones[i]));
  const world: number[][] = local.slice();
  for (let i = 0; i < rig.bones.length; i++) {
    const parent = rig.bones[i].parent;
    if (parent >= 0 && world[parent]) world[i] = multiplyMat4(world[parent], local[i]);
  }
  return world;
}

function composeMatrix(p: BonePose, bone: Bone): number[] {
  const r = quatToMatrix(p.rotation);
  const m = r.slice();
  for (let c = 0; c < 3; c++) {
    m[c * 4 + 0] *= p.scale.x;
    m[c * 4 + 1] *= p.scale.y;
    m[c * 4 + 2] *= p.scale.z;
  }
  m[12] = p.position.x;
  m[13] = p.position.y;
  m[14] = p.position.z;
  void bone;
  return m;
}

export function multiplyMat4(a: number[], b: number[]): number[] {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

/**
 * Linear blend skinning: vertex' = Σ w_i · (worldMat_i · inverseBind_i) · vertex.
 * Returns the skinned position.
 */
export function skinVertex(
  rig: Rig,
  worldMatrices: number[][],
  vertex: Vec3,
  weight: SkinWeight,
): Vec3 {
  let out: Vec3 = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < weight.joints.length; i++) {
    const bi = weight.joints[i];
    const w = weight.weights[i] ?? 0;
    if (w <= 0) continue;
    const bone = rig.bones[bi];
    if (!bone) continue;
    const skinMat = multiplyMat4(worldMatrices[bi] ?? identityMat4(), bone.inverseBindMatrix);
    const p = transformPoint(skinMat, vertex);
    out = add(out, scale(p, w));
  }
  return out;
}

export function identityMat4(): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

export function transformPoint(m: number[], p: Vec3): Vec3 {
  const w = m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15];
  const iw = w === 0 ? 1 : 1 / w;
  return {
    x: (m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12]) * iw,
    y: (m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13]) * iw,
    z: (m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14]) * iw,
  };
}

/* ------------------------------- pose blending ---------------------------- */

export interface AnimationKey {
  time: number;
  value: Vec3 | Quaternion;
}

export interface AnimationTrack {
  boneIndex: number;
  channel: 'position' | 'rotation' | 'scale';
  keys: AnimationKey[];
}

export interface AnimationClip {
  id: string;
  name: string;
  duration: number;
  tracks: AnimationTrack[];
  loop: boolean;
}

export function sampleTrack(track: AnimationTrack, time: number): Vec3 | Quaternion {
  const keys = track.keys;
  if (keys.length === 0) {
    return track.channel === 'rotation' ? QUAT_IDENTITY : { x: 0, y: 0, z: 0 };
  }
  if (time <= keys[0].time) return keys[0].value;
  const last = keys[keys.length - 1];
  if (time >= last.time) return last.value;
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].time <= time) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const span = b.time - a.time;
  const t = span <= 0 ? 0 : clamp01((time - a.time) / span);
  if (track.channel === 'rotation') {
    return quatSlerp(a.value as Quaternion, b.value as Quaternion, t);
  }
  const av = a.value as Vec3;
  const bv = b.value as Vec3;
  return { x: av.x + (bv.x - av.x) * t, y: av.y + (bv.y - av.y) * t, z: av.z + (bv.z - av.z) * t };
}

/** Evaluate a clip at a time, returning one pose per bone (falling back to rest). */
export function sampleClip(rig: Rig, clip: AnimationClip, time: number): BonePose[] {
  const t = clip.loop && clip.duration > 0 ? ((time % clip.duration) + clip.duration) % clip.duration : clamp(time, 0, clip.duration);
  const poses: BonePose[] = rig.bones.map((b) => ({
    position: { ...b.restPosition },
    rotation: { ...b.restRotation },
    scale: { ...b.restScale },
  }));
  for (const track of clip.tracks) {
    const pose = poses[track.boneIndex];
    if (!pose) continue;
    const v = sampleTrack(track, t);
    if (track.channel === 'rotation') pose.rotation = v as Quaternion;
    else pose[track.channel] = v as Vec3;
  }
  return poses;
}

/** Blend two poses (used for crossfading clips and for IK-over-animation layers). */
export function blendPoses(a: BonePose[], b: BonePose[], t: number): BonePose[] {
  return a.map((pa, i) => {
    const pb = b[i] ?? pa;
    return {
      position: {
        x: pa.position.x + (pb.position.x - pa.position.x) * t,
        y: pa.position.y + (pb.position.y - pa.position.y) * t,
        z: pa.position.z + (pb.position.z - pa.position.z) * t,
      },
      rotation: quatSlerp(pa.rotation, pb.rotation, t),
      scale: {
        x: pa.scale.x + (pb.scale.x - pa.scale.x) * t,
        y: pa.scale.y + (pb.scale.y - pa.scale.y) * t,
        z: pa.scale.z + (pb.scale.z - pa.scale.z) * t,
      },
    };
  });
}

/** Apply an IK solve on top of an animation pose for the given bone chain. */
export function applyIkToPose(
  rig: Rig,
  poses: BonePose[],
  boneChain: number[],
  target: Vec3,
  iterations = 12,
): BonePose[] {
  if (boneChain.length < 2) return poses;
  const world = computeWorldMatrices(rig, poses);
  // Convert the chain to world positions, solve, then write the result back as rotations.
  const joints = boneChain.map((bi) => {
    const m = world[bi] ?? identityMat4();
    return { x: m[12], y: m[13], z: m[14] };
  });
  const solved = solveChainPositions(joints, target, iterations);
  const out = poses.map((p) => ({ ...p, position: { ...p.position }, rotation: { ...p.rotation }, scale: { ...p.scale } }));
  for (let i = 0; i < boneChain.length - 1; i++) {
    const bi = boneChain[i];
    const from = solved[i];
    const to = solved[i + 1];
    const dir = norm(sub(to, from));
    // Aim the bone's local +Y at the target direction (the glTF bone convention).
    const rest = norm(rotateVector({ x: 0, y: 1, z: 0 }, out[bi].rotation, 0));
    const axis = cross(rest, dir);
    const l = len(axis);
    if (l < 1e-6) continue;
    const cosA = clamp(dot(rest, dir), -1, 1);
    const angle = Math.acos(cosA);
    out[bi].rotation = quatNormalize(quatMultiply(quatFromAxisAngle(scale(axis, 1 / l), angle), out[bi].rotation));
  }
  return out;
}

/** Minimal FABRIK over raw world positions (the rig-level solver used by applyIkToPose). */
function solveChainPositions(joints: Vec3[], target: Vec3, iterations: number): Vec3[] {
  const pts = joints.map((p) => ({ ...p }));
  const lengths: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) lengths.push(len(sub(pts[i + 1], pts[i])));
  const root = { ...pts[0] };
  for (let it = 0; it < iterations; it++) {
    pts[pts.length - 1] = { ...target };
    for (let i = pts.length - 2; i >= 0; i--) {
      pts[i] = add(pts[i + 1], scale(norm(sub(pts[i], pts[i + 1])), lengths[i]));
    }
    pts[0] = { ...root };
    for (let i = 0; i < pts.length - 1; i++) {
      pts[i + 1] = add(pts[i], scale(norm(sub(pts[i + 1], pts[i])), lengths[i]));
    }
    if (len(sub(pts[pts.length - 1], target)) < 1e-4) break;
  }
  return pts;
}

export { add, sub, scale, norm, dot };
export type { Vec3, IkChain, IkJoint, IkOptions, IkResult } from './ik.js';
