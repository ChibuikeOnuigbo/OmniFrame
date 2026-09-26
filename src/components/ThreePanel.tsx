import React, { useState } from 'react'
import {
  Box,
  Eye,
  Grid,
  RotateCcw,
  Maximize2,
  Layers,
  Copy,
  Scissors,
  Paintbrush,
  Sparkles,
  Link,
  Unlink,
} from 'lucide-react'
import { BlenderRotationIcon } from './icons/BlenderRotationIcon'
import { useEditor } from '../store'

export function ThreePanel() {
  const setWorkspacePreset = useEditor((s) => s.setWorkspacePreset)
  const textures = useEditor((s) => s.textures)
  const materials = useEditor((s) => s.materials)
  const shareTexture = useEditor((s) => s.shareTexture)
  const makeTextureUnique = useEditor((s) => s.makeTextureUnique)

  const [cameraPaintActive, setCameraPaintActive] = useState(false)
  const [targetMatId, setTargetMatId] = useState<string>(materials[0]?.id || '')

  const currentMat = materials.find((m) => m.id === targetMatId) || materials[0]
  const currentTex = currentMat ? textures.find((t) => t.id === currentMat.textureId) : null
  const isShared = currentTex ? currentTex.usersCount > 1 : false

  return (
    <div data-testid="three-panel" className="p-3 text-xs text-ink-200 select-none space-y-3.5 overflow-y-auto h-full">
      {/* Overview */}
      <div className="p-2.5 rounded-lg bg-ink-900 border border-ink-800">
        <div className="flex items-center gap-1.5 font-semibold text-brand mb-1">
          <Box size={14} />
          <span>3D & 2.5D Compositing</span>
        </div>
        <p className="text-[11px] text-ink-400 leading-relaxed">
          WebGL viewport supporting camera orbit, pan, dolly, coordinate axes, and 2.5D video planes.
        </p>
      </div>

      {/* Preset workspace */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-semibold uppercase text-ink-500 block">Workspace Modes</span>
        <button
          type="button"
          data-testid="activate-3d-preset-btn"
          onClick={() => setWorkspacePreset('3d')}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-brand/20 hover:bg-brand/30 text-brand text-xs font-medium transition-colors border border-brand/30"
        >
          <span>Open 3D Scene Workspace</span>
          <Box size={14} />
        </button>
      </div>

      {/* 3D Texture Sharing & Make Unique */}
      <div className="p-2.5 rounded-lg border border-ink-800 bg-ink-950/40 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase text-ink-400">
            Textures & Materials
          </span>
          {isShared && (
            <span
              data-testid="texture-shared-badge"
              className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-medium border border-amber-500/30"
            >
              Shared ({currentTex?.usersCount} users)
            </span>
          )}
        </div>

        {currentMat && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-ink-300">
              <span>Active Material:</span>
              <span className="font-semibold text-ink-100">{currentMat.name}</span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-ink-300">
              <span>Linked Texture:</span>
              <span className="font-mono text-ink-400">{currentTex?.name || 'Default Grid'}</span>
            </div>

            {isShared ? (
              <button
                type="button"
                data-testid="make-texture-unique-btn"
                onClick={() => makeTextureUnique(currentMat.id)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-brand hover:bg-brand/90 text-white font-medium text-[11px] transition-colors"
                title="Clone shared texture into independent asset so changes don't affect other objects"
              >
                <Scissors size={12} />
                <span>Make Unique (Branch Texture)</span>
              </button>
            ) : (
              <div className="text-[10px] text-ink-500 text-center py-1">
                Texture is unique to this material.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Camera Paint Subsystem */}
      <div className="p-2.5 rounded-lg border border-ink-800 bg-ink-950/40 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase text-ink-400">
            Camera Projection Paint
          </span>
          <button
            type="button"
            data-testid="camera-paint-toggle"
            onClick={() => setCameraPaintActive(!cameraPaintActive)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
              cameraPaintActive
                ? 'border-brand bg-brand/20 text-white'
                : 'border-ink-700 bg-ink-900 text-ink-400'
            }`}
          >
            {cameraPaintActive ? 'Active' : 'Off'}
          </button>
        </div>
        <p className="text-[11px] text-ink-400 leading-relaxed">
          Paint brush strokes directly onto 3D geometry or 2.5D video surfaces from camera viewpoint.
        </p>
      </div>

      {/* Camera Controls Guide */}
      <div className="pt-2 border-t border-ink-800 space-y-2">
        <span className="text-[10px] font-semibold uppercase text-ink-500 block">Camera Controls Guide</span>
        <div className="space-y-1.5 text-[11px] text-ink-400">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-ink-300">
              <BlenderRotationIcon size={13} />
              <span>Orbit Camera:</span>
            </span>
            <span className="font-mono text-ink-500">Left-click + Drag</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-300">Pan Target:</span>
            <span className="font-mono text-ink-500">Right-click / Shift+Drag</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-300">Dolly / Zoom:</span>
            <span className="font-mono text-ink-500">Mouse Wheel Scroll</span>
          </div>
        </div>
      </div>
    </div>
  )
}
