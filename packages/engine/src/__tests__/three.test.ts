import { describe, it, expect } from 'vitest';
import { makeChain, solveIk, endEffector, dist, rotateVector } from '../three/ik.js';
import {
  quatSlerp, quatNormalize, quatFromAxisAngle, computeWorldMatrices, identityMat4, transformPoint,
  skinVertex, sampleClip, blendPoses, Rig, Bone, SkinWeight, QUAT_IDENTITY,
} from '../three/rig.js';
import { addLight, addObject, newScene, sceneBudgetReport, focalLengthToFov, fovToFocalLength } from '../three/scene.js';
import { bakeLightmap, sampleTexels, lightmapToUint8, padLightmap, BakeMesh, BakeLight } from '../three/bake.js';

describe('FABRIK and CCD IK', () => {
  it('reaches a reachable target with FABRIK', () => {
    const chain = makeChain([2, 2, 2]);
    const target = { x: 2.1, y: 3.2, z: 0 };
    const result = solveIk(chain, target, { solver: 'fabrik', iterations: 30, tolerance: 1e-3 });
    expect(result.unreachable).toBe(false);
    expect(result.finalError).toBeLessThan(0.02);
    expect(dist(endEffector(chain), target)).toBeLessThan(0.02);
  });

  it('points toward an unreachable target while preserving total length', () => {
    const chain = makeChain([1, 2]);
    const result = solveIk(chain, { x: 20, y: 0, z: 0 }, { iterations: 20 });
    expect(result.unreachable).toBe(true);
    expect(dist(endEffector(chain), { x: 0, y: 0, z: 0 })).toBeCloseTo(3, 3);
    expect(endEffector(chain).x).toBeGreaterThan(2.5);
  });

  it('CCD reaches the target too', () => {
    const chain = makeChain([2, 2, 2]);
    const result = solveIk(chain, { x: 2, y: 3, z: 0 }, { solver: 'ccd', iterations: 40, tolerance: 1e-3 });
    expect(result.finalError).toBeLessThan(0.1);
  });

  it('rotation uses Rodrigues and preserves vector length', () => {
    const y = rotateVector({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, Math.PI / 2);
    expect(y.x).toBeCloseTo(-1, 5);
    expect(y.y).toBeCloseTo(0, 5);
    expect(Math.hypot(y.x, y.y, y.z)).toBeCloseTo(1, 5);
  });
});

describe('rig transforms and animation', () => {
  const rig = (): Rig => ({
    id: 'r', name: 'test',
    bones: [
      { id: 'root', name: 'root', parent: -1, restPosition: { x: 0, y: 0, z: 0 }, restRotation: QUAT_IDENTITY, restScale: { x: 1, y: 1, z: 1 }, inverseBindMatrix: identityMat4() },
      { id: 'child', name: 'child', parent: 0, restPosition: { x: 0, y: 1, z: 0 }, restRotation: QUAT_IDENTITY, restScale: { x: 1, y: 1, z: 1 }, inverseBindMatrix: identityMat4() },
    ],
    weights: [],
  });

  it('computes parent-child world matrices', () => {
    const r = rig();
    const poses = r.bones.map((b) => ({ position: { ...b.restPosition }, rotation: { ...b.restRotation }, scale: { ...b.restScale } }));
    poses[0].position.x = 2;
    const world = computeWorldMatrices(r, poses);
    expect(world[0][12]).toBe(2);
    expect(world[1][12]).toBe(2);
    expect(world[1][13]).toBe(1);
  });

  it('skins a vertex with one bone', () => {
    const r = rig();
    const poses = r.bones.map((b) => ({ position: { ...b.restPosition }, rotation: { ...b.restRotation }, scale: { ...b.restScale } }));
    poses[0].position.x = 3;
    const world = computeWorldMatrices(r, poses);
    const p = skinVertex(r, world, { x: 0, y: 0, z: 0 }, { vertex: 0, joints: [0], weights: [1] });
    expect(p.x).toBe(3);
  });

  it('slerps rotations through the shortest path', () => {
    const a = QUAT_IDENTITY;
    const b = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI);
    const mid = quatSlerp(a, b, 0.5);
    expect(Math.abs(mid.z)).toBeCloseTo(Math.SQRT1_2, 5);
    expect(quatNormalize(mid).w).toBeCloseTo(mid.w, 5);
  });

  it('samples a clip and blends two poses', () => {
    const r = rig();
    const clip = {
      id: 'walk', name: 'walk', duration: 1, loop: false,
      tracks: [{ boneIndex: 0, channel: 'position' as const, keys: [{ time: 0, value: { x: 0, y: 0, z: 0 } }, { time: 1, value: { x: 4, y: 0, z: 0 } }] }],
    };
    const p = sampleClip(r, clip, 0.5);
    expect(p[0].position.x).toBeCloseTo(2);
    const q = sampleClip(r, clip, 1);
    const blend = blendPoses(p, q, 0.5);
    expect(blend[0].position.x).toBeCloseTo(3);
  });
});

describe('scene environment and budgets', () => {
  it('creates a room-lit scene with a camera', () => {
    const s = newScene('test');
    expect(s.environment.mode).toBe('room');
    expect(s.activeCameraId).not.toBeNull();
    const model = addObject(s, { kind: 'model', name: 'Cube' });
    expect(s.objects).toContain(model);
  });

  it('reports shadow and draw-call budgets', () => {
    const s = newScene();
    for (let i = 0; i < 6; i++) addLight(s, 'point', { x: i, y: 2, z: 2 });
    const report = sceneBudgetReport(s);
    expect(report.shadowCastingLights).toBe(6);
    expect(report.warnings.length).toBeGreaterThan(0);
  });

  it('round-trips focal length and FOV', () => {
    expect(fovToFocalLength(focalLengthToFov(50))).toBeCloseTo(50, 5);
  });
});

describe('real CPU lightmap bake', () => {
  const plane = (): BakeMesh => ({
    id: 'plane',
    vertices: [
      { position: { x: -1, y: 0, z: -1 }, normal: { x: 0, y: 1, z: 0 }, uv: { u: 0, v: 0 } },
      { position: { x: 1, y: 0, z: -1 }, normal: { x: 0, y: 1, z: 0 }, uv: { u: 1, v: 0 } },
      { position: { x: 1, y: 0, z: 1 }, normal: { x: 0, y: 1, z: 0 }, uv: { u: 1, v: 1 } },
      { position: { x: -1, y: 0, z: 1 }, normal: { x: 0, y: 1, z: 0 }, uv: { u: 0, v: 1 } },
    ],
    triangles: [
      { a: 0, b: 1, c: 2, albedo: { x: 0.8, y: 0.8, z: 0.8 }, emissive: { x: 0, y: 0, z: 0 } },
      { a: 0, b: 2, c: 3, albedo: { x: 0.8, y: 0.8, z: 0.8 }, emissive: { x: 0, y: 0, z: 0 } },
    ],
  });
  const light: BakeLight = { id: 'sun', kind: 'directional', position: { x: 0, y: 5, z: 0 }, direction: { x: 0, y: 1, z: 0 }, color: { x: 1, y: 1, z: 1 }, intensity: 3, halfExtents: { x: 0, y: 0, z: 0 }, castShadow: true };

  it('rasterises UVs into texel samples', () => {
    const samples = sampleTexels([plane()], 16, 16);
    expect(samples.length).toBeGreaterThan(100);
    expect(samples.every((s) => s.position.y === 0)).toBe(true);
  });

  it('bakes direct light and returns a cache key', () => {
    const lm = bakeLightmap({ meshes: [plane()], lights: [light], options: { width: 16, height: 16, samples: 4, bounces: 1, denoisePasses: 1 } });
    expect(lm.data.length).toBe(16 * 16 * 3);
    expect(lm.cacheKey.length).toBeGreaterThan(2);
    const filled = Array.from(lm.data).filter((v) => v > 0.01).length;
    expect(filled).toBeGreaterThan(100);
    expect(lm.bakeMs).toBeGreaterThanOrEqual(0);
  });

  it('exports alpha AO and pads lightmap borders', () => {
    const lm = bakeLightmap({ meshes: [plane()], lights: [light], options: { width: 8, height: 8, samples: 2, bounces: 1, denoisePasses: 0 } });
    const padded = padLightmap(lm, 1);
    const bytes = lightmapToUint8(padded);
    expect(bytes.length).toBe(8 * 8 * 4);
    expect(bytes.some((v) => v > 0)).toBe(true);
  });
});
