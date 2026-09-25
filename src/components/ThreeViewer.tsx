import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  RotateCcw,
  Maximize2,
  Box,
  Circle,
  Eye,
  Grid,
  Sun,
  Video,
} from 'lucide-react'

export interface ThreeViewerProps {
  width?: number
  height?: number
  videoElement?: HTMLVideoElement | null
}

export function ThreeViewer({ width = 800, height = 450, videoElement }: ThreeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)

  const [primitive, setPrimitive] = useState<'cube' | 'sphere' | 'torus' | 'plane'>('cube')
  const [wireframe, setWireframe] = useState(false)
  const [showGrid, setShowGrid] = useState(true)

  // Camera spherical coordinates for robust orbit/pan/dolly
  const sphericalRef = useRef({ radius: 5, theta: Math.PI / 4, phi: Math.PI / 3 })
  const targetRef = useRef(new THREE.Vector3(0, 0, 0))
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

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0c14)
    sceneRef.current = scene

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    cameraRef.current = camera
    updateCameraPosition()

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    rendererRef.current = renderer
    container.replaceChildren(renderer.domElement)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
    keyLight.position.set(5, 8, 5)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0x6366f1, 0.6)
    fillLight.position.set(-5, 3, -5)
    scene.add(fillLight)

    // Ground Grid
    const gridHelper = new THREE.GridHelper(10, 20, 0x6366f1, 0x27273a)
    gridHelper.name = 'gridHelper'
    scene.add(gridHelper)

    // Coordinate Axes
    const axesHelper = new THREE.AxesHelper(2)
    axesHelper.name = 'axesHelper'
    scene.add(axesHelper)

    // Initial Object
    const geom = new THREE.BoxGeometry(1.8, 1.8, 1.8)
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.2,
      roughness: 0.4,
      wireframe,
    })
    const mesh = new THREE.Mesh(geom, mat)
    meshRef.current = mesh
    scene.add(mesh)

    let animId: number
    const animate = () => {
      animId = requestAnimationFrame(animate)
      if (meshRef.current && primitive !== 'plane') {
        meshRef.current.rotation.y += 0.005
      }
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animId)
      renderer.dispose()
      geom.dispose()
      mat.dispose()
      container.replaceChildren()
    }
  }, [])

  // Update object primitive or video texture
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    if (meshRef.current) {
      scene.remove(meshRef.current)
      meshRef.current.geometry.dispose()
      if (Array.isArray(meshRef.current.material)) {
        meshRef.current.material.forEach((m) => m.dispose())
      } else {
        meshRef.current.material.dispose()
      }
    }

    let geom: THREE.BufferGeometry
    let mat: THREE.Material

    if (primitive === 'cube') {
      geom = new THREE.BoxGeometry(1.8, 1.8, 1.8)
      mat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, wireframe })
    } else if (primitive === 'sphere') {
      geom = new THREE.SphereGeometry(1.2, 32, 32)
      mat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.2, wireframe })
    } else if (primitive === 'torus') {
      geom = new THREE.TorusGeometry(1.0, 0.4, 24, 48)
      mat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3, wireframe })
    } else {
      // 2.5D Video Plane
      geom = new THREE.PlaneGeometry(3.2, 1.8)
      if (videoElement) {
        const videoTex = new THREE.VideoTexture(videoElement)
        mat = new THREE.MeshBasicMaterial({ map: videoTex, side: THREE.DoubleSide })
      } else {
        mat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, side: THREE.DoubleSide, wireframe })
      }
    }

    const mesh = new THREE.Mesh(geom, mat)
    meshRef.current = mesh
    scene.add(mesh)
  }, [primitive, wireframe, videoElement])

  // Toggle Grid
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const grid = scene.getObjectByName('gridHelper')
    if (grid) grid.visible = showGrid
  }, [showGrid])

  // Mouse Orbit / Pan / Dolly event handlers
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
    } else {
      // Orbit camera
      s.theta -= dx * 0.008
      s.phi = Math.max(0.1, Math.min(Math.PI - 0.1, s.phi - dy * 0.008))
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
    sphericalRef.current.radius = Math.max(1, Math.min(40, sphericalRef.current.radius * factor))
    updateCameraPosition()
  }

  const handleResetCamera = () => {
    sphericalRef.current = { radius: 5, theta: Math.PI / 4, phi: Math.PI / 3 }
    targetRef.current.set(0, 0, 0)
    updateCameraPosition()
  }

  const handleFrameObject = () => {
    targetRef.current.set(0, 0, 0)
    sphericalRef.current.radius = 4.0
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
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-900/90 border border-ink-700/80 shadow-2xl backdrop-blur-md text-xs text-ink-200"
      >
        <button
          type="button"
          data-testid="reset-camera-btn"
          title="Reset Camera (Orbit / Dolly / Pan)"
          onClick={handleResetCamera}
          className="p-1 rounded hover:bg-ink-800 text-ink-400 hover:text-white"
        >
          <RotateCcw size={14} />
        </button>

        <button
          type="button"
          data-testid="frame-object-btn"
          title="Frame / Focus Object"
          onClick={handleFrameObject}
          className="p-1 rounded hover:bg-ink-800 text-ink-400 hover:text-white"
        >
          <Maximize2 size={14} />
        </button>

        <div className="w-px h-4 bg-ink-700" />

        {/* Primitive Selectors */}
        {(['cube', 'sphere', 'torus', 'plane'] as const).map((prim) => (
          <button
            key={prim}
            type="button"
            data-testid={`three-primitive-${prim}`}
            title={`Select ${prim.toUpperCase()}`}
            onClick={() => setPrimitive(prim)}
            className={`px-2 py-0.5 rounded text-[11px] capitalize font-medium transition-colors ${
              primitive === prim ? 'bg-brand text-white' : 'text-ink-400 hover:bg-ink-800 hover:text-white'
            }`}
          >
            {prim === 'plane' ? '2.5D Plane' : prim}
          </button>
        ))}

        <div className="w-px h-4 bg-ink-700" />

        {/* Wireframe toggle */}
        <button
          type="button"
          data-testid="wireframe-toggle-btn"
          title={`Wireframe: ${wireframe ? 'ON' : 'OFF'}`}
          onClick={() => setWireframe(!wireframe)}
          className={`p-1 rounded transition-colors ${
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
          className={`p-1 rounded transition-colors ${
            showGrid ? 'bg-brand/20 text-brand' : 'text-ink-400 hover:bg-ink-800 hover:text-white'
          }`}
        >
          <Grid size={14} />
        </button>
      </div>

      {/* Camera Guidance Overlay */}
      <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded bg-ink-900/60 border border-ink-800/60 text-[10px] text-ink-400 pointer-events-none">
        Left-drag: Orbit · Right-drag: Pan · Wheel: Dolly
      </div>
    </div>
  )
}
