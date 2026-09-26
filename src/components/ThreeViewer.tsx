import React, { useEffect, useRef, useState, useMemo } from 'react'
import * as THREE from 'three'
import {
  RotateCcw,
  Maximize2,
  Box,
  Eye,
  Grid,
  Film,
  Layers,
  Play,
  Pause,
  Sparkles,
  Camera,
  Paintbrush,
  Activity,
  Plus,
  Sliders,
  Check,
} from 'lucide-react'
import { BlenderRotationIcon } from './icons/BlenderRotationIcon'
import { useEditor } from '../store'
import type { BlenderMode, Primitive3D } from '../types'
import { evaluateCurve } from '../lib/animation/CurveEngine'

export type CameraAimTarget = 'video' | 'object' | 'composite' | 'camera_view' | 'free'

export interface ThreeViewerProps {
  width?: number
  height?: number
  videoElement?: HTMLVideoElement | null
  sourceCanvas?: HTMLCanvasElement | null
}

export function ThreeViewer({
  width = 800,
  height = 450,
  videoElement,
  sourceCanvas,
}: ThreeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)

  // Meshes
  const videoPlaneMeshRef = useRef<THREE.Mesh | null>(null)
  const objectMeshRef = useRef<THREE.Group | THREE.Mesh | null>(null)
  const videoTextureRef = useRef<THREE.Texture | null>(null)

  // Zustand state
  const playing = useEditor((s) => s.playing)
  const togglePlay = useEditor((s) => s.togglePlay)
  const playhead = useEditor((s) => s.playhead)
  const sequenceSettings = useEditor((s) => s.sequenceSettings)
  const activeBlenderMode = useEditor((s) => s.activeBlenderMode)
  const setActiveBlenderMode = useEditor((s) => s.setActiveBlenderMode)
  const setGraphEditorOpen = useEditor((s) => s.setGraphEditorOpen)
  const setActiveCurveProperty = useEditor((s) => s.setActiveCurveProperty)
  const clips = useEditor((s) => s.clips)
  const selectedClipId = useEditor((s) => s.selectedClipId)

  // Component UI state
  const [primitive, setPrimitive] = useState<Primitive3D>('wheel')
  const [wireframe, setWireframe] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [aimTarget, setAimTarget] = useState<CameraAimTarget>('composite')
  const [materialRoughness, setMaterialRoughness] = useState(0.25)
  const [materialMetalness, setMaterialMetalness] = useState(0.8)
  const [materialColor, setMaterialColor] = useState('#8b5cf6')

  // Project sequence aspect ratio for 2.5D plane and camera FOV
  const planeAspect = sequenceSettings.width / Math.max(1, sequenceSettings.height)
  const planeH = 2.0
  const planeW = planeH * planeAspect

  // Coordinates
  const objectPosition = useRef(new THREE.Vector3(planeW * 0.45 + 0.8, 0.15, 0.6))

  // Camera spherical coordinates for smooth orbit/pan/dolly
  const sphericalRef = useRef({ radius: 5.4, theta: 0.38, phi: 1.35 })
  const targetRef = useRef(new THREE.Vector3(objectPosition.current.x * 0.4, 0.1, 0.3))
  const isPointerDownRef = useRef(false)
  const lastPointerRef = useRef({ x: 0, y: 0, button: 0 })

  // Active clip animation for keyframed 3D wheel/object rotation
  const activeClip = clips.find((c) => c.id === selectedClipId) || clips[0]
  const clipPlayheadTime = activeClip ? Math.max(0, playhead - activeClip.start) : playhead

  // Active keys tracking for WASD navigation
  const keysPressedRef = useRef<Set<string>>(new Set())

  const updateCameraPosition = () => {
    const cam = cameraRef.current
    if (!cam) return
    const s = sphericalRef.current
    const sinPhiRadius = s.radius * Math.sin(Math.max(0.01, Math.min(Math.PI - 0.01, s.phi)))
    cam.position.x = targetRef.current.x + sinPhiRadius * Math.sin(s.theta)
    cam.position.y = targetRef.current.y + s.radius * Math.cos(s.phi)
    cam.position.z = targetRef.current.z + sinPhiRadius * Math.cos(s.theta)
    cam.lookAt(targetRef.current)
  }

  // Handle Aim / Camera transitions
  const handleAim = (target: CameraAimTarget) => {
    setAimTarget(target)
    if (target === 'camera_view') {
      // Direct Camera Perspective View (Unreal/Unity/Blender Numpad 0)
      targetRef.current.set(0, 0, 0)
      sphericalRef.current = { radius: Math.max(3.2, planeH * 2.2), theta: 0, phi: Math.PI / 2 }
    } else if (target === 'video') {
      targetRef.current.set(0, 0, 0)
      sphericalRef.current = { radius: Math.max(3.8, planeH * 2.1), theta: 0.05, phi: 1.5 }
    } else if (target === 'object') {
      targetRef.current.copy(objectPosition.current)
      sphericalRef.current = { radius: 2.8, theta: Math.PI / 4, phi: Math.PI / 3 }
    } else if (target === 'composite') {
      targetRef.current.set(objectPosition.current.x * 0.4, 0.1, 0.3)
      sphericalRef.current = { radius: 5.4, theta: 0.38, phi: 1.35 }
    }
    updateCameraPosition()
  }

  // Reset Camera
  const handleResetCamera = () => {
    handleAim('composite')
  }

  // Keyboard WASD camera listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in text inputs
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      const k = e.code
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(k)) {
        keysPressedRef.current.add(k)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current.delete(e.code)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // Initialize Three.js Scene
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x06080d)
    sceneRef.current = scene

    // Camera aspect matches project sequence aspect ratio
    const projAspect = sequenceSettings.width / Math.max(1, sequenceSettings.height)
    const camera = new THREE.PerspectiveCamera(45, projAspect, 0.1, 1000)
    cameraRef.current = camera
    updateCameraPosition()

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.domElement.id = 'of-three-canvas'
    renderer.domElement.setAttribute('data-testid', 'three-canvas-element')
    rendererRef.current = renderer
    container.replaceChildren(renderer.domElement)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85)
    scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5)
    keyLight.position.set(6, 10, 7)
    scene.add(keyLight)

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.4) // Electric cyan rim
    rimLight.position.set(-6, 4, -4)
    scene.add(rimLight)

    const fillLight = new THREE.DirectionalLight(0xf59e0b, 0.9) // Amber fill
    fillLight.position.set(4, -3, 3)
    scene.add(fillLight)

    // Ground Grid
    const gridHelper = new THREE.GridHelper(14, 28, 0x6366f1, 0x1e1e2d)
    gridHelper.position.y = -planeH * 0.52
    gridHelper.name = 'gridHelper'
    scene.add(gridHelper)

    // Coordinate Axes
    const axesHelper = new THREE.AxesHelper(1.8)
    axesHelper.position.set(-planeW * 0.6, -planeH * 0.5, 0)
    axesHelper.name = 'axesHelper'
    scene.add(axesHelper)

    // Render & Animation Loop
    let animId: number
    let lastTime = performance.now()

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const now = performance.now()
      const dt = (now - lastTime) / 1000
      lastTime = now

      // WASD Camera Navigation Processing
      if (keysPressedRef.current.size > 0 && cameraRef.current) {
        const cam = cameraRef.current
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
        forward.y = 0
        forward.normalize()

        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion)
        right.y = 0
        right.normalize()

        const speed = 3.5 * dt

        if (keysPressedRef.current.has('KeyW')) {
          targetRef.current.addScaledVector(forward, speed)
          cam.position.addScaledVector(forward, speed)
        }
        if (keysPressedRef.current.has('KeyS')) {
          targetRef.current.addScaledVector(forward, -speed)
          cam.position.addScaledVector(forward, -speed)
        }
        if (keysPressedRef.current.has('KeyA')) {
          targetRef.current.addScaledVector(right, -speed)
          cam.position.addScaledVector(right, -speed)
        }
        if (keysPressedRef.current.has('KeyD')) {
          targetRef.current.addScaledVector(right, speed)
          cam.position.addScaledVector(right, speed)
        }
        if (keysPressedRef.current.has('KeyQ')) {
          targetRef.current.y -= speed
          cam.position.y -= speed
        }
        if (keysPressedRef.current.has('KeyE')) {
          targetRef.current.y += speed
          cam.position.y += speed
        }
        setAimTarget('free')
      }

      // 3D Object Rotation (Keyframed or Auto-spin)
      if (objectMeshRef.current) {
        const wheelCurve = activeClip?.animation?.curves?.['wheel_rotation'] || activeClip?.animation?.curves?.['rotation_z']
        if (wheelCurve && wheelCurve.keyframes.length > 0) {
          // Evaluate exact curve at current playhead time
          const evalDeg = evaluateCurve(wheelCurve, clipPlayheadTime)
          objectMeshRef.current.rotation.z = (evalDeg * Math.PI) / 180
        } else if (playing) {
          // Continuous rotation when playing without static keyframes
          objectMeshRef.current.rotation.z += 0.04
          objectMeshRef.current.rotation.y += 0.01
        }
      }

      // Update live video / canvas texture
      if (videoTextureRef.current) {
        videoTextureRef.current.needsUpdate = true
      }

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animId)
      renderer.dispose()
      container.replaceChildren()
    }
  }, [width, height, sequenceSettings.width, sequenceSettings.height, playing, activeClip, clipPlayheadTime])

  // Synchronize Camera Aspect Ratio on sequence settings change
  useEffect(() => {
    if (cameraRef.current) {
      const projAspect = sequenceSettings.width / Math.max(1, sequenceSettings.height)
      cameraRef.current.aspect = projAspect
      cameraRef.current.updateProjectionMatrix()
    }
  }, [sequenceSettings.width, sequenceSettings.height])

  // Setup / Update 2.5D Video Plane
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // Clean up previous video plane
    if (videoPlaneMeshRef.current) {
      scene.remove(videoPlaneMeshRef.current)
      videoPlaneMeshRef.current.geometry.dispose()
      if (Array.isArray(videoPlaneMeshRef.current.material)) {
        videoPlaneMeshRef.current.material.forEach((m) => m.dispose())
      } else {
        videoPlaneMeshRef.current.material.dispose()
      }
      videoPlaneMeshRef.current = null
    }

    if (videoTextureRef.current) {
      videoTextureRef.current.dispose()
      videoTextureRef.current = null
    }

    // Determine texture source
    let texture: THREE.Texture

    if (videoElement) {
      texture = new THREE.VideoTexture(videoElement)
      texture.colorSpace = THREE.SRGBColorSpace
    } else if (sourceCanvas) {
      texture = new THREE.CanvasTexture(sourceCanvas)
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.generateMipmaps = false
      texture.colorSpace = THREE.SRGBColorSpace
    } else {
      // Fallback synthetic high-res preview canvas
      const fallbackCanvas = document.createElement('canvas')
      fallbackCanvas.width = 640
      fallbackCanvas.height = 360
      const ctx = fallbackCanvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(0, 0, 640, 360)
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 4
        ctx.strokeRect(8, 8, 624, 344)
        ctx.fillStyle = '#f8fafc'
        ctx.font = 'bold 28px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('OMNIFRAME 2.5D VIDEO', 320, 175)
        ctx.fillStyle = '#f59e0b'
        ctx.font = '16px monospace'
        ctx.fillText('LIVE SEQUENCE PLAYBACK', 320, 210)
      }
      texture = new THREE.CanvasTexture(fallbackCanvas)
      texture.colorSpace = THREE.SRGBColorSpace
    }

    videoTextureRef.current = texture

    // 2.5D Video Plane Group (Screen + Bezel Frame)
    const planeGroup = new THREE.Group()
    planeGroup.name = 'videoPlaneGroup'

    // Bezel frame behind the video
    const bezelGeom = new THREE.BoxGeometry(planeW + 0.08, planeH + 0.08, 0.04)
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.9,
      roughness: 0.2,
    })
    const bezelMesh = new THREE.Mesh(bezelGeom, bezelMat)
    bezelMesh.position.z = -0.02
    planeGroup.add(bezelMesh)

    // The live video plane
    const videoGeom = new THREE.PlaneGeometry(planeW, planeH)
    const videoMat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
    })
    const videoMesh = new THREE.Mesh(videoGeom, videoMat)
    videoMesh.position.z = 0.001
    planeGroup.add(videoMesh)

    // Cyan glowing rim border
    const edgeGeom = new THREE.EdgesGeometry(videoGeom)
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 })
    const edgeLines = new THREE.LineSegments(edgeGeom, edgeMat)
    edgeLines.position.z = 0.002
    planeGroup.add(edgeLines)

    videoPlaneMeshRef.current = videoMesh
    scene.add(planeGroup)
  }, [sourceCanvas, videoElement, planeW, planeH])

  // Setup / Update 3D Floating Object (Wheel, Cube, Sphere, Torus, Diamond, Plane)
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    if (objectMeshRef.current) {
      scene.remove(objectMeshRef.current)
      objectMeshRef.current = null
    }

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(materialColor),
      metalness: materialMetalness,
      roughness: materialRoughness,
      wireframe,
    })

    if (primitive === 'wheel') {
      // High-detail 3D Wheel: Rim + Spokes + Outer Tire + Center Hub
      const wheelGroup = new THREE.Group()
      wheelGroup.name = 'wheelGroup'

      // Outer Rubber Tire
      const tireGeom = new THREE.CylinderGeometry(0.9, 0.9, 0.4, 32)
      tireGeom.rotateX(Math.PI / 2)
      const tireMat = new THREE.MeshStandardMaterial({
        color: 0x181e28,
        metalness: 0.2,
        roughness: 0.85,
        wireframe,
      })
      const tireMesh = new THREE.Mesh(tireGeom, tireMat)
      wheelGroup.add(tireMesh)

      // Inner Metallic Rim
      const rimGeom = new THREE.TorusGeometry(0.72, 0.1, 16, 32)
      const rimMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(materialColor),
        metalness: 0.9,
        roughness: 0.2,
        wireframe,
      })
      const rimMesh = new THREE.Mesh(rimGeom, rimMat)
      wheelGroup.add(rimMesh)

      // 6 Spokes
      for (let i = 0; i < 6; i++) {
        const spokeGeom = new THREE.CylinderGeometry(0.04, 0.04, 1.4, 12)
        const spokeMesh = new THREE.Mesh(spokeGeom, rimMat)
        spokeMesh.rotation.z = (i * Math.PI) / 3
        wheelGroup.add(spokeMesh)
      }

      // Center Hub
      const hubGeom = new THREE.CylinderGeometry(0.24, 0.24, 0.44, 16)
      hubGeom.rotateX(Math.PI / 2)
      const hubMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.8,
        roughness: 0.3,
        wireframe,
      })
      const hubMesh = new THREE.Mesh(hubGeom, hubMat)
      wheelGroup.add(hubMesh)

      wheelGroup.position.copy(objectPosition.current)
      objectMeshRef.current = wheelGroup
      scene.add(wheelGroup)
    } else {
      let geom: THREE.BufferGeometry

      if (primitive === 'cube') {
        geom = new THREE.BoxGeometry(1.2, 1.2, 1.2)
      } else if (primitive === 'sphere') {
        geom = new THREE.SphereGeometry(0.8, 32, 32)
      } else if (primitive === 'torus') {
        geom = new THREE.TorusGeometry(0.7, 0.28, 24, 48)
      } else if (primitive === 'plane') {
        geom = new THREE.PlaneGeometry(1.4, 1.4)
      } else {
        // Diamond (Octahedron)
        geom = new THREE.OctahedronGeometry(0.9, 0)
      }

      const mesh = new THREE.Mesh(geom, mat)
      mesh.position.copy(objectPosition.current)
      objectMeshRef.current = mesh
      scene.add(mesh)
    }
  }, [primitive, wireframe, materialRoughness, materialMetalness, materialColor])

  // Toggle Grid Visibility
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const grid = scene.getObjectByName('gridHelper')
    if (grid) grid.visible = showGrid
  }, [showGrid])

  // Pointer Event Handlers for Free Orbit, Pan, and Dolly
  const handlePointerDown = (e: React.PointerEvent) => {
    isPointerDownRef.current = true
    lastPointerRef.current = { x: e.clientX, y: e.clientY, button: e.button }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDownRef.current) return
    const dx = e.clientX - lastPointerRef.current.x
    const dy = e.clientY - lastPointerRef.current.y
    lastPointerRef.current = { x: e.clientX, y: e.clientY, button: e.button }

    const s = sphericalRef.current

    if (e.button === 2 || e.shiftKey) {
      // Pan camera target and position together
      const cam = cameraRef.current
      if (!cam) return
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion)
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion)
      targetRef.current.addScaledVector(right, -dx * 0.005 * s.radius)
      targetRef.current.addScaledVector(up, dy * 0.005 * s.radius)
      setAimTarget('free')
    } else {
      // Orbit camera around target
      s.theta -= dx * 0.008
      s.phi = Math.max(0.08, Math.min(Math.PI - 0.08, s.phi - dy * 0.008))
      setAimTarget('free')
    }

    updateCameraPosition()
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    isPointerDownRef.current = false
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 0.88 : 1.12
    sphericalRef.current.radius = Math.max(1.0, Math.min(35, sphericalRef.current.radius * factor))
    updateCameraPosition()
  }

  return (
    <div
      data-testid="three-viewer-container"
      className="relative w-full h-full flex items-center justify-center overflow-hidden select-none bg-ink-950"
    >
      <div
        ref={containerRef}
        data-testid="three-canvas-wrapper"
        className="w-full h-full cursor-grab active:cursor-grabbing relative"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Unreal / Unity Style Camera Safe Frame Perspective Overlay */}
      <div
        data-testid="camera-safe-frame"
        className="absolute inset-4 pointer-events-none border border-cyan-500/40 rounded-sm shadow-[0_0_20px_rgba(56,189,248,0.15)] flex flex-col justify-between p-2"
      >
        <div className="flex items-center justify-between text-[10px] text-cyan-400 font-mono tracking-wider bg-ink-950/70 px-2 py-0.5 rounded backdrop-blur-xs self-start">
          <span>CAM: {sequenceSettings.aspectRatio} ({sequenceSettings.width}×{sequenceSettings.height})</span>
        </div>
        <div className="flex items-center justify-between text-[9px] text-ink-400 font-mono self-end">
          <span>SAFE ACTION / TITLE 90%</span>
        </div>
      </div>

      {/* Blender Modes Top Toolbar (Object Mode, Camera View, Texturing, Animation) */}
      <div
        data-testid="blender-modes-toolbar"
        className="absolute top-3 left-4 z-20 flex items-center gap-1 p-1 rounded-lg bg-ink-900/90 border border-ink-700/80 shadow-2xl backdrop-blur-md text-xs"
      >
        <button
          type="button"
          data-testid="blender-mode-object"
          title="Object Mode: Select & transform 3D meshes"
          onClick={() => {
            setActiveBlenderMode('object')
            handleAim('composite')
          }}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
            activeBlenderMode === 'object'
              ? 'bg-brand text-white font-semibold shadow-xs'
              : 'text-ink-400 hover:text-white hover:bg-ink-800'
          }`}
        >
          <Box size={13} />
          <span>Object Mode</span>
        </button>

        <button
          type="button"
          data-testid="blender-mode-camera"
          title="Camera View: Lock view to scene rendering perspective (Blender Numpad 0 / Unreal)"
          onClick={() => {
            setActiveBlenderMode('camera')
            handleAim('camera_view')
          }}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
            activeBlenderMode === 'camera'
              ? 'bg-amber-500 text-ink-950 font-semibold shadow-xs'
              : 'text-ink-400 hover:text-white hover:bg-ink-800'
          }`}
        >
          <Camera size={13} />
          <span>Camera View</span>
        </button>

        <button
          type="button"
          data-testid="blender-mode-texturing"
          title="Texturing / Material Mode: Inspect & edit connected textures and PBR materials"
          onClick={() => setActiveBlenderMode('texturing')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
            activeBlenderMode === 'texturing'
              ? 'bg-emerald-500 text-ink-950 font-semibold shadow-xs'
              : 'text-ink-400 hover:text-white hover:bg-ink-800'
          }`}
        >
          <Paintbrush size={13} />
          <span>Texturing</span>
        </button>

        <button
          type="button"
          data-testid="blender-mode-animation"
          title="Animation Mode: Open Keyframe Curve Editor"
          onClick={() => {
            setActiveBlenderMode('animation')
            setActiveCurveProperty('wheel_rotation')
            setGraphEditorOpen(true)
          }}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
            activeBlenderMode === 'animation'
              ? 'bg-violet-600 text-white font-semibold shadow-xs'
              : 'text-ink-400 hover:text-white hover:bg-ink-800'
          }`}
        >
          <Activity size={13} />
          <span>Curves</span>
        </button>
      </div>

      {/* Texturing / Material Drawer (Visible when in Texturing mode) */}
      {activeBlenderMode === 'texturing' && (
        <div
          data-testid="texturing-material-panel"
          className="absolute top-14 left-4 z-20 w-64 p-3 rounded-lg bg-ink-900/95 border border-ink-700/80 shadow-2xl backdrop-blur-md text-xs text-ink-200 space-y-2.5 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between border-b border-ink-800 pb-1.5 font-semibold text-ink-100">
            <span>Material & Textures</span>
            <span className="text-[10px] text-brand font-mono">PBR Shading</span>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] text-ink-400">Diffuse Color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                data-testid="material-color-picker"
                value={materialColor}
                onChange={(e) => setMaterialColor(e.target.value)}
                className="w-7 h-7 rounded border border-ink-700 bg-transparent cursor-pointer"
              />
              <span className="text-[11px] font-mono text-ink-300">{materialColor}</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-ink-400">
              <span>Roughness</span>
              <span className="font-mono">{materialRoughness.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={materialRoughness}
              onChange={(e) => setMaterialRoughness(parseFloat(e.target.value))}
              className="w-full accent-brand"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-ink-400">
              <span>Metalness</span>
              <span className="font-mono">{materialMetalness.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={materialMetalness}
              onChange={(e) => setMaterialMetalness(parseFloat(e.target.value))}
              className="w-full accent-brand"
            />
          </div>
        </div>
      )}

      {/* 3D Navigation & Viewport HUD Toolbar */}
      <div
        data-testid="three-hud-toolbar"
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-900/95 border border-ink-700/80 shadow-2xl backdrop-blur-md text-xs text-ink-200 max-w-[calc(100vw-32px)] overflow-x-auto scrollbar-none"
      >
        {/* Play/Pause live video sequence in 3D */}
        <button
          type="button"
          data-testid="three-play-btn"
          title={playing ? 'Pause Playback (Space)' : 'Play Live Video in 3D (Space)'}
          onClick={togglePlay}
          className={`flex items-center gap-1 px-2 py-1 rounded font-medium transition-colors ${
            playing ? 'bg-amber-500 text-ink-950 font-semibold' : 'bg-brand text-white hover:bg-brand/90'
          }`}
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}
          <span className="text-[11px]">{playing ? 'Pause' : 'Play'}</span>
        </button>

        <div className="w-px h-4 bg-ink-700 shrink-0" />

        {/* Camera Aim Selectors ("3D in 2D") */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            data-testid="aim-composite-btn"
            title="Aim: 3D in 2D Composite (Perspective angle viewing both video and 3D object)"
            onClick={() => handleAim('composite')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              aimTarget === 'composite'
                ? 'bg-ink-800 text-white border border-brand/50 shadow-xs'
                : 'text-ink-400 hover:bg-ink-800 hover:text-white'
            }`}
          >
            <Layers size={13} className="text-brand" />
            <span>3D in 2D</span>
          </button>

          <button
            type="button"
            data-testid="aim-video-btn"
            title="Aim: Focus on 2.5D Video Plane"
            onClick={() => handleAim('video')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              aimTarget === 'video'
                ? 'bg-ink-800 text-white border border-brand/50 shadow-xs'
                : 'text-ink-400 hover:bg-ink-800 hover:text-white'
            }`}
          >
            <Film size={13} className="text-amber-400" />
            <span>Video</span>
          </button>

          <button
            type="button"
            data-testid="aim-object-btn"
            title="Aim: Focus on 3D Floating Object"
            onClick={() => handleAim('object')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              aimTarget === 'object'
                ? 'bg-ink-800 text-white border border-brand/50 shadow-xs'
                : 'text-ink-400 hover:bg-ink-800 hover:text-white'
            }`}
          >
            <Box size={13} className="text-cyan-400" />
            <span>3D Object</span>
          </button>
        </div>

        <div className="w-px h-4 bg-ink-700 shrink-0" />

        {/* 3D Floating Primitive Selectors (Wheel, Cube, Sphere, Torus, Diamond, Plane) */}
        <div className="flex items-center gap-1 shrink-0">
          {(['wheel', 'cube', 'sphere', 'torus', 'diamond', 'plane'] as const).map((prim) => (
            <button
              key={prim}
              type="button"
              data-testid={`three-primitive-${prim}`}
              title={`Change 3D Object to ${prim}`}
              onClick={() => setPrimitive(prim)}
              className={`px-1.5 py-0.5 rounded text-[10px] capitalize font-medium transition-colors ${
                primitive === prim
                  ? 'bg-brand/20 text-brand border border-brand/40 font-semibold'
                  : 'text-ink-400 hover:bg-ink-800 hover:text-white'
              }`}
            >
              {prim}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-ink-700 shrink-0" />

        {/* Reset Camera */}
        <button
          type="button"
          data-testid="reset-camera-btn"
          title="Reset Camera Angle & Zoom"
          onClick={handleResetCamera}
          className="p-1 rounded hover:bg-ink-800 text-ink-400 hover:text-white shrink-0"
        >
          <RotateCcw size={14} />
        </button>

        {/* Wireframe toggle */}
        <button
          type="button"
          data-testid="wireframe-toggle-btn"
          title={`Wireframe: ${wireframe ? 'ON' : 'OFF'}`}
          onClick={() => setWireframe(!wireframe)}
          className={`p-1 rounded transition-colors shrink-0 ${
            wireframe ? 'bg-brand/20 text-brand' : 'text-ink-400 hover:bg-ink-800 hover:text-white'
          }`}
        >
          <Eye size={14} />
        </button>

        {/* Grid toggle */}
        <button
          type="button"
          data-testid="grid-toggle-btn"
          title={`Grid: ${showGrid ? 'ON' : 'OFF'}`}
          onClick={() => setShowGrid(!showGrid)}
          className={`p-1 rounded transition-colors shrink-0 ${
            showGrid ? 'bg-brand/20 text-brand' : 'text-ink-400 hover:bg-ink-800 hover:text-white'
          }`}
        >
          <Grid size={14} />
        </button>
      </div>

      {/* Camera Guidance & Aim Status Overlay */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2 pointer-events-none">
        <div
          data-testid="camera-aim-status"
          className="px-2 py-1 rounded bg-ink-900/80 border border-ink-700/60 text-[10px] text-ink-300 font-medium flex items-center gap-1.5 shadow-md"
        >
          <BlenderRotationIcon size={12} />
          <span>
            {aimTarget === 'camera_view'
              ? 'Camera View'
              : aimTarget === 'composite'
              ? '3D in 2D'
              : aimTarget === 'video'
              ? 'Video Plane'
              : aimTarget === 'object'
              ? '3D Object'
              : 'Free Orbit'}
          </span>
        </div>
      </div>
    </div>
  )
}
