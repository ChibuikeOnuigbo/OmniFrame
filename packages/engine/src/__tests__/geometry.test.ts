import { describe, expect, it } from 'vitest';
import {
  affineFrom,
  fitAffine,
  fitHomography,
  mat3Apply,
  mat3Invert,
  mat3Multiply,
  rotationMatrix,
  type Vec2,
} from '../core/geometry.js';

const close = (actual: number, expected: number, precision = 6) => expect(actual).toBeCloseTo(expected, precision);
const pointClose = (actual: Vec2, expected: Vec2, precision = 6) => { close(actual.x, expected.x, precision); close(actual.y, expected.y, precision); };

describe('geometry and transform contracts', () => {
  it('rotates vectors counter-clockwise and preserves length', () => {
    const point = mat3Apply(rotationMatrix(Math.PI / 2), { x: 1, y: 0 });
    pointClose(point, { x: 0, y: 1 });
    close(Math.hypot(point.x, point.y), 1);
  });

  it('inverts composed affine matrices without changing a point', () => {
    const matrix = affineFrom(12, -4, Math.PI / 7, 1.4, 0.75, { x: 2, y: -1 });
    const inverse = mat3Invert(matrix);
    expect(inverse).not.toBeNull();
    const original = { x: -3.5, y: 8.25 };
    const moved = mat3Apply(matrix, original);
    pointClose(mat3Apply(inverse!, moved), original);
    const identity = mat3Multiply(matrix, inverse!);
    pointClose(mat3Apply(identity, { x: 2, y: 5 }), { x: 2, y: 5 });
  });

  it('fits an affine relationship from vector correspondences', () => {
    const source: Vec2[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 4, y: 3 }];
    const destination = source.map(({ x, y }) => ({ x: 2 * x - 0.5 * y + 5, y: 0.25 * x + 1.5 * y - 2 }));
    const result = fitAffine(source, destination);
    expect(result).not.toBeNull();
    expect(result!.residual).toBeLessThan(1e-8);
    pointClose(mat3Apply(result!.matrix, { x: 2, y: -3 }), { x: 10.5, y: -6 });
  });

  it('fits a perspective mapping for four corners', () => {
    const source: Vec2[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    const destination: Vec2[] = [{ x: 0.1, y: 0.2 }, { x: 1.2, y: 0.05 }, { x: 1.1, y: 1.3 }, { x: -0.1, y: 1.1 }];
    const result = fitHomography(source, destination);
    expect(result).not.toBeNull();
    expect(result!.residual).toBeLessThan(1e-4);
    for (let index = 0; index < source.length; index++) pointClose(mat3Apply(result!.matrix, source[index]), destination[index], 3);
  });
});
