import * as THREE from 'three'
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js'
import type { Scene3DObject } from '../types'

function createPrimitive(object: Scene3DObject): THREE.Object3D {
  const group = new THREE.Group()
  group.name = object.name || object.type

  const addMesh = (geometry: THREE.BufferGeometry, name: string, color = object.color) => {
    const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(color) })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    group.add(mesh)
  }

  if (object.type === 'wheel') {
    const tire = new THREE.CylinderGeometry(0.9, 0.9, 0.4, 32)
    tire.rotateX(Math.PI / 2)
    addMesh(tire, `${group.name}-tire`, '#181e28')
    addMesh(new THREE.TorusGeometry(0.72, 0.1, 16, 32), `${group.name}-rim`)
    for (let index = 0; index < 6; index++) {
      const spoke = new THREE.CylinderGeometry(0.04, 0.04, 1.4, 12)
      spoke.rotateZ((index * Math.PI) / 3)
      addMesh(spoke, `${group.name}-spoke-${index + 1}`)
    }
    const hub = new THREE.CylinderGeometry(0.24, 0.24, 0.44, 16)
    hub.rotateX(Math.PI / 2)
    addMesh(hub, `${group.name}-hub`, '#f59e0b')
  } else if (object.type === 'cube') {
    addMesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), group.name)
  } else if (object.type === 'sphere') {
    addMesh(new THREE.SphereGeometry(0.8, 32, 32), group.name)
  } else if (object.type === 'torus') {
    addMesh(new THREE.TorusGeometry(0.7, 0.28, 24, 48), group.name)
  } else if (object.type === 'plane') {
    addMesh(new THREE.PlaneGeometry(1.4, 1.4), group.name)
  } else {
    addMesh(new THREE.OctahedronGeometry(0.9, 0), group.name)
  }

  group.position.set(object.position.x, object.position.y, object.position.z)
  group.rotation.set(object.rotation.x, object.rotation.y, object.rotation.z)
  group.scale.set(object.scale.x, object.scale.y, object.scale.z)
  return group
}

/**
 * Export only the editable primitive scene geometry to Wavefront OBJ. OBJ does
 * not carry OmniFrame's animation/timeline, video, audio, 2D layers, effects,
 * textures, or full material settings; callers must label this as a subset.
 */
export function exportPrimitiveSceneObj(objects: Scene3DObject[]): Blob {
  if (!objects.length) throw new Error('There are no editable 3D scene objects to export as OBJ.')
  const root = new THREE.Group()
  root.name = 'OmniFrame scene subset'
  for (const object of objects) root.add(createPrimitive(object))
  root.updateMatrixWorld(true)
  const text = new OBJExporter().parse(root)
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => material.dispose())
    }
  })
  return new Blob([text], { type: 'text/plain;charset=utf-8' })
}

/** Export the currently rendered Program Monitor frame as a flattened PNG. */
export async function exportProgramFramePng(): Promise<Blob> {
  const canvas = document.getElementById('of-canvas')
  if (!(canvas instanceof HTMLCanvasElement) || canvas.width <= 0 || canvas.height <= 0) {
    throw new Error('The Program Monitor has no rendered frame to export. Place a 2D image clip on the timeline first.')
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('The Program Monitor frame could not be encoded as PNG.'))
    }, 'image/png')
  })
}
