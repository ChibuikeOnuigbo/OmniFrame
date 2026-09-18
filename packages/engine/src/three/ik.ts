/**
 * Inverse kinematics — FABRIK and CCD, with ball-socket and hinge constraints.
 *
 * FABRIK (Forward And Backward Reaching Inverse Kinematics, Aristidou & Lasenby) is a
 * position-based solver: it walks the chain to the target and back, projecting each
 * joint onto the bone-length sphere. It converges in a few iterations, handles
 * unreachable targets gracefully, and — unlike CCD — does not spiral.
 *
 * Everything operates on plain arrays of joints, so it runs identically in the 3D
 * viewport and inside a worker, and it is unit-testable without a renderer.
 */
import { clamp } from '../core/math.js';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type JointConstraint = 'none' | 'ball' | 'hinge';

export interface IkJoint {
  pos: Vec3;
  /** bone length to the NEXT joint (ignored on the last joint) */
  length: number;
  constraint: JointConstraint;
  /** max deviation in radians for a ball joint */
  maxAngle: number;
  /** hinge axis in the joint's local space */
  hingeAxis: Vec3;
  /** hinge travel limits in radians */
  hingeMin: number;
  hingeMax: number;
}

export interface IkChain {
  joints: IkJoint[];
  /** the root stays put unless `rootFixed` is false */
  rootFixed: boolean;
}

export interface IkOptions {
  iterations: number;
  /** stop when the end effector is within this distance of the target */
  tolerance: number;
  solver: 'fabrik' | 'ccd';
}

export const DEFAULT_IK_OPTIONS: IkOptions = { iterations: 12, tolerance: 1e-4, solver: 'fabrik' };

export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const len = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const norm = (a: Vec3): Vec3 => {
  const l = len(a);
  return l > 1e-12 ? scale(a, 1 / l) : { x: 0, y: 1, z: 0 };
};
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const dist = (a: Vec3, b: Vec3): number => len(sub(a, b));

export function makeChain(lengths: number[], root: Vec3 = { x: 0, y: 0, z: 0 }, constraint: JointConstraint = 'none'): IkChain {
  const joints: IkJoint[] = [];
  let p = { ...root };
  for (let i = 0; i < lengths.length; i++) {
    joints.push({
      pos: { ...p },
      length: lengths[i],
      constraint,
      maxAngle: Math.PI,
      hingeAxis: { x: 1, y: 0, z: 0 },
      hingeMin: -Math.PI,
      hingeMax: Math.PI,
    });
    p = { x: p.x, y: p.y + lengths[i], z: p.z };
  }
  joints.push({
    pos: { ...p },
    length: 0,
    constraint: 'none',
    maxAngle: Math.PI,
    hingeAxis: { x: 1, y: 0, z: 0 },
    hingeMin: -Math.PI,
    hingeMax: Math.PI,
  });
  return { joints, rootFixed: true };
}

export function chainTotalLength(chain: IkChain): number {
  return chain.joints.reduce((s, j) => s + j.length, 0);
}

export function endEffector(chain: IkChain): Vec3 {
  return { ...chain.joints[chain.joints.length - 1].pos };
}

/** Restore every bone to its rest length without changing the root. */
function enforceLengths(chain: IkChain, fromRoot: boolean): void {
  const joints = chain.joints;
  if (fromRoot) {
    for (let i = 0; i < joints.length - 1; i++) {
      const dir = norm(sub(joints[i + 1].pos, joints[i].pos));
      joints[i + 1].pos = add(joints[i].pos, scale(dir, joints[i].length));
    }
  } else {
    for (let i = joints.length - 2; i >= 0; i--) {
      const dir = norm(sub(joints[i].pos, joints[i + 1].pos));
      joints[i].pos = add(joints[i + 1].pos, scale(dir, joints[i].length));
    }
  }
}

function applyConstraints(chain: IkChain): void {
  for (let i = 1; i < chain.joints.length - 1; i++) {
    const j = chain.joints[i];
    if (j.constraint === 'none') continue;
    const parent = chain.joints[i - 1];
    const child = chain.joints[i + 1];
    const toParent = norm(sub(parent.pos, j.pos));
    const toChild = norm(sub(child.pos, j.pos));
    if (j.constraint === 'ball') {
      const cosA = clamp(dot(toParent, toChild), -1, 1);
      const angle = Math.acos(cosA);
      const limit = Math.PI - j.maxAngle;
      if (angle < limit) {
        // Rotate the child bone away from the parent bone until the limit is met.
        const axis = norm(cross(toParent, toChild));
        const corrected = rotateVector(toParent, axis, limit);
        child.pos = add(j.pos, scale(corrected, j.length));
      }
    } else if (j.constraint === 'hinge') {
      const axis = norm(j.hingeAxis);
      const projected = sub(toChild, scale(axis, dot(toChild, axis)));
      const dir = len(projected) > 1e-9 ? norm(projected) : toChild;
      const reference = norm(sub(toParent, scale(axis, dot(toParent, axis))));
      const signed = Math.atan2(dot(cross(reference, dir), axis), dot(reference, dir));
      const limited = clamp(signed, j.hingeMin, j.hingeMax);
      const final = rotateVector(reference, axis, limited);
      child.pos = add(j.pos, scale(final, j.length));
    }
  }
}

/** Rodrigues' rotation formula. */
export function rotateVector(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const k = norm(axis);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const kxv = cross(k, v);
  const kdv = dot(k, v);
  return {
    x: v.x * c + kxv.x * s + k.x * kdv * (1 - c),
    y: v.y * c + kxv.y * s + k.y * kdv * (1 - c),
    z: v.z * c + kxv.z * s + k.z * kdv * (1 - c),
  };
}

export interface IkResult {
  iterationsUsed: number;
  finalError: number;
  /** true when the target was farther away than the chain can reach */
  unreachable: boolean;
}

export function solveIk(chain: IkChain, target: Vec3, opts: Partial<IkOptions> = {}): IkResult {
  const o = { ...DEFAULT_IK_OPTIONS, ...opts };
  const total = chainTotalLength(chain);
  const rootPos = { ...chain.joints[0].pos };
  const unreachable = dist(rootPos, target) > total;
  let iterationsUsed = 0;
  let error = dist(endEffector(chain), target);

  for (let it = 0; it < o.iterations; it++) {
    iterationsUsed = it + 1;
    if (o.solver === 'ccd') {
      ccdStep(chain, target);
    } else {
      if (unreachable) {
        // Point the whole chain straight at the target.
        const dir = norm(sub(target, chain.joints[0].pos));
        for (let i = 1; i < chain.joints.length; i++) {
          chain.joints[i].pos = add(chain.joints[i - 1].pos, scale(dir, chain.joints[i - 1].length));
        }
      } else {
        // Forward reach: pull the end effector onto the target, walking back.
        chain.joints[chain.joints.length - 1].pos = { ...target };
        enforceLengths(chain, false);
        // Backward reach: pin the root, walking forward.
        if (chain.rootFixed) chain.joints[0].pos = { ...rootPos };
        enforceLengths(chain, true);
      }
      applyConstraints(chain);
    }
    error = dist(endEffector(chain), target);
    if (error < o.tolerance) break;
  }
  return { iterationsUsed, finalError: error, unreachable };
}

/** Cyclic Coordinate Descent: rotate each joint, from tip to root, onto the target. */
function ccdStep(chain: IkChain, target: Vec3): void {
  const end = chain.joints.length - 1;
  for (let i = end - 1; i >= 0; i--) {
    const pivot = chain.joints[i].pos;
    const toEnd = sub(chain.joints[end].pos, pivot);
    const toTarget = sub(target, pivot);
    const axis = cross(toEnd, toTarget);
    const l = len(axis);
    if (l < 1e-9) continue;
    const cosA = clamp(dot(norm(toEnd), norm(toTarget)), -1, 1);
    const angle = Math.acos(cosA);
    const k = scale(axis, 1 / l);
    for (let j = i + 1; j <= end; j++) {
      const rel = sub(chain.joints[j].pos, pivot);
      chain.joints[j].pos = add(pivot, rotateVector(rel, k, angle));
    }
    applyConstraints(chain);
    enforceLengths(chain, true);
  }
}

/** Solve several chains at once (a full character rig) and report per-chain errors. */
export function solveRigIk(
  chains: IkChain[],
  targets: Vec3[],
  opts: Partial<IkOptions> = {},
): IkResult[] {
  return chains.map((c, i) => solveIk(c, targets[i], opts));
}
