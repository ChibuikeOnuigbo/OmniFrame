import type * as Three from 'three'
import type { Scene3DObject } from '../types'
import { validateSculptDabs } from './sculptData'

/** Deterministic primitive construction shared by the live scene and OBJ export. */
export function sculptGeometry(THREE: typeof Three, object: Pick<Scene3DObject, 'type' | 'sculptDabs'>): Three.BufferGeometry {
  validateSculptDabs(object.sculptDabs)
  const detailed = !!object.sculptDabs?.length
  let geometry: Three.BufferGeometry
  switch (object.type) {
    case 'cube': geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2, detailed ? 20 : 1, detailed ? 20 : 1, detailed ? 20 : 1); break
    case 'sphere': geometry = new THREE.SphereGeometry(.8, 32, 32); break
    case 'torus': geometry = new THREE.TorusGeometry(.7, .28, 24, 48); break
    case 'plane': geometry = new THREE.PlaneGeometry(1.4, 1.4, detailed ? 32 : 1, detailed ? 32 : 1); break
    case 'diamond': geometry = new THREE.OctahedronGeometry(.9, detailed ? 4 : 0); break
    default: throw new Error('Choose a single primitive to sculpt')
  }
  const positions = geometry.getAttribute('position')
  for (const dab of object.sculptDabs ?? []) {
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i)
      const dx = x - dab.point.x, dy = y - dab.point.y, dz = z - dab.point.z
      const distance = Math.hypot(dx, dy, dz)
      if (distance >= dab.radius) continue
      const u = 1 - distance / dab.radius, falloff = u * u * (3 - 2 * u)
      const amount = dab.mode === 'flatten' ? -(dx * dab.normal.x + dy * dab.normal.y + dz * dab.normal.z) * dab.strength * falloff : (dab.mode === 'carve' ? -1 : 1) * dab.radius * .15 * dab.strength * falloff
      const bound = (v: number) => Math.max(-8, Math.min(8, v))
      positions.setXYZ(i, bound(x + dab.normal.x * amount), bound(y + dab.normal.y * amount), bound(z + dab.normal.z * amount))
    }
  }
  if (detailed) { positions.needsUpdate = true; geometry.computeVertexNormals() }
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  return geometry
}
