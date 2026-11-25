/** Perspective framing in degrees; independent of Three.js for validation/tests. */
function validProjection(fov: number, aspect: number): void {
  if (!Number.isFinite(fov) || fov <= 0 || fov >= 179 || !Number.isFinite(aspect) || aspect <= 0) throw new Error('Invalid camera projection')
}

export function sphereFitDistance(radius: number, fov: number, aspect: number, padding = 1.15): number {
  validProjection(fov, aspect)
  if (!Number.isFinite(radius) || radius < 0 || !Number.isFinite(padding) || padding < 1) throw new Error('Invalid camera bounds')
  const halfVertical = fov * Math.PI / 360
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect)
  return Math.max(.2, radius * padding / Math.sin(Math.min(halfVertical, halfHorizontal)))
}

