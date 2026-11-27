import * as THREE from 'three'
import type { ThreeExportSession } from './threeExportBridge'

/** Render the live scene at output resolution without resizing the working viewport. */
export function createThreeSceneExport(
  sourceRenderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
): ThreeExportSession {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.domElement.dataset.renderSource = '3d-export'
  try {
    if (width > renderer.capabilities.maxTextureSize || height > renderer.capabilities.maxTextureSize) {
      throw new Error('3D export dimensions exceed this device’s graphics limit.')
    }
    renderer.setPixelRatio(1)
    renderer.setSize(width, height, false)
    renderer.toneMapping = sourceRenderer.toneMapping
    renderer.toneMappingExposure = sourceRenderer.toneMappingExposure
    renderer.outputColorSpace = sourceRenderer.outputColorSpace
  } catch (error) {
    renderer.dispose()
    renderer.forceContextLoss()
    throw error
  }
  const outputCamera = camera.clone()
  let disposed = false
  return {
    canvas: renderer.domElement,
    render() {
      if (disposed || renderer.getContext().isContextLost()) throw new Error('The 3D export renderer is unavailable.')
      outputCamera.copy(camera, false)
      outputCamera.aspect = width / height
      outputCamera.updateProjectionMatrix()
      const guides: Array<{ object: THREE.Object3D; visible: boolean }> = []
      scene.traverse(object => {
        if (object.userData.editorOnly === true) {
          guides.push({ object, visible: object.visible })
          object.visible = false
        }
      })
      try { renderer.render(scene, outputCamera) }
      finally { for (const { object, visible } of guides) object.visible = visible }
    },
    dispose() {
      if (disposed) return
      disposed = true
      // Own GPU resources only; scene geometries/materials belong to the viewport.
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
