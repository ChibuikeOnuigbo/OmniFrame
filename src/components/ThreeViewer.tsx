import React, { useEffect, useRef, useState } from 'react'
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
} from 'lucide-react'
import { BlenderRotationIcon } from './icons/BlenderRotationIcon'
import { useEditor } from '../store'

export type CameraAimTarget = 'video' | 'object' | 'composite' | 'free'

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
  const objectMeshRef = useRef<THREE.Mesh | null>(null)
  const videoTextureRef = useRef<THREE.Texture | null>(null)

  // Zustand state
  const playing = useEditor((s) => s.playing)
  const togglePlay = useEditor((s) => s.togglePlay)
  const sequenceSettings = useEditor((s) => s.sequenceSettings)

  // Component UI state
  const [primitive, setPrimitive] = useState<'cube' | 'sphere' | 'torus' | 'diamond'>('cube')
  const [wireframe, setWireframe] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [aimTarget, setAimTarget] = useState<CameraAimTarget>('composite')

  // Aspect ratio calculation for the 2.5D plane
  const planeAspect = sequenceSettings.width / Math.max(1, sequenceSettings.height)
  const planeH = 2.0
  const planeW = planeH * planeAspect

  // Coordinates
  const objectPosition = useRef(new THREE.Vector3(planeW * 0.5 + 0.7, 0.2, 0.8))

  // Camera spherical coordinates for smooth orbit/pan/dolly
  const sphericalRef = useRef({ radius: 5.2, theta: 0.42, phi: 1.32 })
  const targetRef = useRef(new THREE.Vector3(objectPosition.current.x * 0.5, 0.1, 0.4))
  const isPointerDownRef = useRef(false)
  const lastPointerRef = useRef({ x: 0, y: 0, button: 0 })

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

  // Handle Aim transitions
  const handleAim = (target: CameraAimTarget) => {
    setAimTarget(target)
    if (target === 'video') {
      targetRef.current.set(0, 0, 0)
      sphericalRef.current = { radius: Math.max(3.8, planeH * 2.1), theta: 0.05, phi: 1.5 }
    } else if (target === 'object') {
      targetRef.current.copy(objectPosition.current)
      sphericalRef.current = { radius: 2.6, theta: Math.PI / 4, phi: Math.PI / 3 }
    } else if (target === 'composite') {
      targetRef.current.set(objectPosition.current.x * 0.45, 0.1, 0.35)
      sphericalRef.current = { radius: 5.2, theta: 0.42, phi: 1.32 }
    }
    updateCameraPosition()
  }

  // Reset Camera
  const handleResetCamera = () => {
    handleAim('composite')
  }

  // Initialize Three.js Scene
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x07090e)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    cameraRef.current = camera
    updateCameraPosition()

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    rendererRef.current = renderer
    container.replaceChildren(renderer.domElement)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75)
    scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4)
    keyLight.position.set(6, 9, 6)
    scene.add(keyLight)

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2) // Electric cyan rim light
    rimLight.position.set(-6, 4, -4)
    scene.add(rimLight)

    const fillLight = new THREE.DirectionalLight(0xf59e0b, 0.8) // Amber fill light
    fillLight.position.set(4, -3, 3)
    scene.add(fillLight)

    // Ground Grid
    const gridHelper = new THREE.GridHelper(12, 24, 0x6366f1, 0x1e1e2d)
    gridHelper.position.y = -planeH * 0.52
    gridHelper.name = 'gridHelper'
    scene.add(gridHelper)

    // Coordinate Axes
    const axesHelper = new THREE.AxesHelper(1.8)
    axesHelper.position.set(-planeW * 0.6, -planeH * 0.5, 0)
    axesHelper.name = 'axesHelper'
    scene.add(axesHelper)

    // Render Animation Loop
    let animId: number
    const animate = () => {
      animId = requestAnimationFrame(animate)

      // Rotate floating 3D object
      if (objectMeshRef.current) {
        objectMeshRef.current.rotation.y += 0.012
        objectMeshRef.current.rotation.x += 0.006
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
  }, [width, height])

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

  // Setup / Update 3D Floating Object
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    if (objectMeshRef.current) {
      scene.remove(objectMeshRef.current)
      objectMeshRef.current.geometry.dispose()
      if (Array.isArray(objectMeshRef.current.material)) {
        objectMeshRef.current.material.forEach((m) => m.dispose())
      } else {
        objectMeshRef.current.material.dispose()
      }
      objectMeshRef.current = null
    }

    let geom: THREE.BufferGeometry
    let color = 0x38bdf8

    if (primitive === 'cube') {
      geom = new THREE.BoxGeometry(1.2, 1.2, 1.2)
      color = 0xf59e0b // Amber gold
    } else if (primitive === 'sphere') {
      geom = new THREE.SphereGeometry(0.8, 32, 32)
      color = 0x10b981 // Emerald green
    } else if (primitive === 'torus') {
      geom = new THREE.TorusGeometry(0.7, 0.28, 24, 48)
      color = 0xa855f7 // Violet purple
    } else {
      // Diamond (Octahedron)
      geom = new THREE.OctahedronGeometry(0.9, 0)
      color = 0x38bdf8 // Sky cyan
    }

    const mat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.7,
      roughness: 0.25,
      wireframe,
    })

    const mesh = new THREE.Mesh(geom, mat)
    mesh.position.copy(objectPosition.current)
    objectMeshRef.current = mesh
    scene.add(mesh)
  }, [primitive, wireframe])

  // Toggle Grid Visibility
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const grid = scene.getObjectByName('gridHelper')
    if (grid) grid.visible = showGrid
  }, [showGrid])

  // Mouse / Pointer Event Handlers for Free Orbit, Pan, and Dolly
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
      // Pan camera target
      const cam = cameraRef.current
      if (!cam) return
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion)
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion)
      targetRef.current.addScaledVector(right, -dx * 0.005 * s.radius)
      targetRef.current.addScaledVector(up, dy * 0.005 * s.radius)
      setAimTarget('free')
    } else {
      // Orbit camera
      s.theta -= dx * 0.008
      s.phi = Math.max(0.1, Math.min(Math.PI - 0.1, s.phi - dy * 0.008))
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
    const factor = e.deltaY < 0 ? 0.9 : 1.1
    sphericalRef.current.radius = Math.max(1.2, Math.min(30, sphericalRef.current.radius * factor))
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
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />

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

        {/* 3D Floating Primitive Selectors */}
        <div className="flex items-center gap-1 shrink-0">
          {(['cube', 'sphere', 'torus', 'diamond'] as const).map((prim) => (
            <button
              key={prim}
              type="button"
              data-testid={`three-primitive-${prim}`}
              title={`Change 3D Object to ${prim}`}
              onClick={() => setPrimitive(prim)}
              className={`px-1.5 py-0.5 rounded text-[10px] capitalize font-medium transition-colors ${
                primitive === prim ? 'bg-brand/20 text-brand border border-brand/40' : 'text-ink-400 hover:bg-ink-800 hover:text-white'
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
            {aimTarget === 'composite'
              ? '3D in 2D Composite'
              : aimTarget === 'video'
              ? 'Aim: 2.5D Video Plane'
              : aimTarget === 'object'
              ? 'Aim: 3D Object'
              : 'Free Orbit Camera'}
          </span>
        </div>

        <div className="px-2 py-1 rounded bg-ink-900/60 border border-ink-800/60 text-[10px] text-ink-400 hidden sm:block">
          Left-drag: Orbit · Right-drag: Pan · Wheel: Dolly
        </div>
      </div>
    </div>
  )
}
