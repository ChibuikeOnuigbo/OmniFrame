import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { DeviceKind, DeviceRig, DeviceRenderOptions } from './device3d'
import {DEVICE_MODEL_OPTIONS} from './transitionAssetCatalog'

export const DEVICE_MODELS = DEVICE_MODEL_OPTIONS.map(model=>model.id)
const defaults: Record<DeviceKind, string> = { phone: DEVICE_MODELS[0], monitor: DEVICE_MODELS[3], tv: DEVICE_MODELS[5], laptop: DEVICE_MODELS[6] }
type Model = { root: THREE.Group; screen: THREE.Mesh; screenSize: THREE.Vector3; bodySize: THREE.Vector3; scale: number }
const models = new Map<string, Model>(), pending = new Map<string, Promise<void>>()
let renderer: THREE.WebGLRenderer | null = null, failed = false
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, .01, 100)
const input = document.createElement('canvas')
input.width = 1024; input.height = 1024
const texture = new THREE.CanvasTexture(input)
texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false
texture.minFilter = THREE.LinearFilter; texture.generateMipmaps = false
const display = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, transparent: true, side: THREE.FrontSide })
const staticAmount = { value: 0 }, staticSeed = { value: 0 }
display.onBeforeCompile = shader => {
  shader.uniforms.deviceStaticAmount = staticAmount; shader.uniforms.deviceStaticSeed = staticSeed
  shader.fragmentShader = 'uniform float deviceStaticAmount; uniform float deviceStaticSeed;\n' + shader.fragmentShader
  shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233)) + deviceStaticSeed*43.12)*43758.5453);
    gl_FragColor.rgb = mix(gl_FragColor.rgb,vec3(grain),deviceStaticAmount);
  `)
}
const environment = new THREE.HemisphereLight(0xddeeff, 0x171422, 2); scene.add(environment)
const key = new THREE.DirectionalLight(0xfff1d8, 3); key.position.set(-2, 3, 4); scene.add(key)
const rim = new THREE.DirectionalLight(0x7eaaff, 4); rim.position.set(3, 1, -2); scene.add(rim)
camera.position.z = 5

export function preloadDeviceModel(id: string): Promise<void> {
  if (!DEVICE_MODELS.includes(id as typeof DEVICE_MODELS[number])) return Promise.reject(new Error('Unknown device model'))
  if (models.has(id)) return Promise.resolve()
  if (!pending.has(id)) pending.set(id, new GLTFLoader().loadAsync(`/models/device_transitions/${id}.glb`).then(gltf => {
    const root = gltf.scene, screen = root.getObjectByName('ScreenSurface') as THREE.Mesh | undefined
    if (!screen?.isMesh) throw new Error(`${id}: missing ScreenSurface`)
    root.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(screen), size = box.getSize(new THREE.Vector3())
    if (!(size.x > 0 && size.y > 0)) throw new Error(`${id}: invalid screen orientation`)
    const scale = (id.startsWith('phone') ? 2.12 : 1) / size.y
    screen.material = display
    models.set(id, { root, screen, screenSize: size, bodySize:new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()), scale })
  }).catch(error => { pending.delete(id); throw error }))
  return pending.get(id)!
}

export function drawModelDevice(ctx: CanvasRenderingContext2D, w: number, h: number, kind: DeviceKind, rig: DeviceRig, source: HTMLCanvasElement, options: DeviceRenderOptions): boolean {
  const id = options.model || defaults[kind], model = models.get(id)
  if (!model || failed) return false
  if (rig.fill >= .9999) { ctx.drawImage(source, 0, 0, w, h); return true }
  try {
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: true })
      renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.setClearColor(0, 0)
    }
    if (renderer.domElement.width !== w || renderer.domElement.height !== h) renderer.setSize(w, h, false)
    const bounded=(value: number | undefined,base:number,min:number,max:number)=>Number.isFinite(value)?Math.max(min,Math.min(max,value!)):base
    camera.position.z=bounded(options.cameraDistance,5,2,10)
    key.intensity=bounded(options.keyLight,3,0,8);rim.intensity=bounded(options.rimLight,4,0,8);environment.intensity=bounded(options.environmentLight,2,0,5)
    camera.fov = bounded(options.fov,40,25,70); camera.aspect = w / h; camera.updateProjectionMatrix()
    const visibleH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z, visibleW = visibleH * w / h
    const normalizedW = model.screenSize.x * model.scale, normalizedH = model.screenSize.y * model.scale
    const fit = Math.min(visibleW / Math.max(normalizedW*1.12,model.bodySize.x*model.scale*1.06), visibleH / Math.max(normalizedH*1.25,model.bodySize.y*model.scale*1.06)) * .8 * rig.scale
    model.root.scale.setScalar(model.scale * fit)
    model.root.rotation.set(THREE.MathUtils.degToRad(-rig.rotX), THREE.MathUtils.degToRad(rig.rotY), THREE.MathUtils.degToRad(-(rig.rotZ||0)))
    model.root.position.set(rig.x * visibleW, -rig.y * visibleH, 0)
    model.screen.scale.set(1, 1, 1); model.root.updateMatrixWorld(true)
    const screenZ = model.screen.getWorldPosition(new THREE.Vector3()).z
    const screenH = visibleH * (camera.position.z - screenZ) / camera.position.z, screenW = screenH * w / h
    const fullX = screenW / (model.screenSize.x * model.scale * fit), fullY = screenH / (model.screenSize.y * model.scale * fit)
    model.screen.scale.set(THREE.MathUtils.lerp(1, fullX, rig.fill), THREE.MathUtils.lerp(1, fullY, rig.fill), 1)
    const aspect = normalizedW / normalizedH * model.screen.scale.x / model.screen.scale.y
    // Keep texture storage fixed across the handoff. Resizing an uploaded
    // CanvasTexture leaves stale GPU dimensions and caused invalid copies.
    const tw = input.width, th = input.height, x = input.getContext('2d')!
    x.clearRect(0, 0, tw, th)
    const mode = options.fit ?? 'cover', sourceAspect = source.width / source.height
    if (mode === 'cover') {
      const cw = sourceAspect > aspect ? source.height * aspect : source.width
      const ch = sourceAspect > aspect ? source.height : source.width / aspect
      x.drawImage(source, (source.width-cw)/2, (source.height-ch)/2, cw, ch, 0, 0, tw, th)
    } else if (mode === 'contain') {
      const dw = sourceAspect > aspect ? tw : tw * sourceAspect / aspect
      const dh = sourceAspect > aspect ? th * aspect / sourceAspect : th
      x.drawImage(source, (tw-dw)/2, (th-dh)/2, dw, dh)
    } else x.drawImage(source, 0, 0, tw, th)
    texture.needsUpdate = true
    display.color.setScalar(THREE.MathUtils.lerp(options.brightness ?? 1, 1, rig.fill))
    staticAmount.value = rig.staticAmount ?? 0; staticSeed.value = rig.staticSeed ?? 0
    model.root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || object === model.screen) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) { material.transparent = true; material.opacity = rig.bodyAlpha }
    })
    scene.add(model.root); renderer.render(scene, camera); scene.remove(model.root)
    ctx.drawImage(renderer.domElement, 0, 0, w, h)
    return true
  } catch (error) {
    failed = true
    console.warn('Device WebGL renderer unavailable; using perspective canvas fallback', error)
    return false
  }
}

export function deviceRendererStatus() { return { loadedModels: models.size, webgl: renderer !== null && !failed } }
