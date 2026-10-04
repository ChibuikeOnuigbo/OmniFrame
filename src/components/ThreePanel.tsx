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
  ChevronRight,
  Sliders,
} from 'lucide-react'
import { BlenderRotationIcon } from './icons/BlenderRotationIcon'
import { useEditor } from '../store'

export function ThreePanel() {
  const setWorkspacePreset = useEditor((s) => s.setWorkspacePreset)
  const setIs3DMode = useEditor((s) => s.setIs3DMode)
  const setLeftTab = useEditor((s) => s.setLeftTab)
  const setDrawingEnabled = useEditor((s) => s.setDrawingEnabled)
  const setDrawingTool = useEditor((s) => s.setDrawingTool)
  const textures = useEditor((s) => s.textures)
  const materials = useEditor((s) => s.materials)
  const shareTexture = useEditor((s) => s.shareTexture)
  const makeTextureUnique = useEditor((s) => s.makeTextureUnique)
  const activeSubMode = useEditor((s) => s.activeSubMode)
  const openSubMode = useEditor((s) => s.openSubMode)
  const threeMaskMode = useEditor((s) => s.threeMaskMode)
  const setThreeMaskMode = useEditor((s) => s.setThreeMaskMode)
  const threeMaskTargetKind = useEditor((s) => s.threeMaskTargetKind)
  const setThreeMaskTargetKind = useEditor((s) => s.setThreeMaskTargetKind)
  const threeMaskSelection = useEditor((s) => s.threeMaskSelection)
  const setThreeMaskSelection = useEditor((s) => s.setThreeMaskSelection)
  const clearThreeMaskSelection = useEditor((s) => s.clearThreeMaskSelection)
  const useThreeMaskSelectionInDrawing = useEditor((s) => s.useThreeMaskSelectionInDrawing)
  const setActiveBlenderMode = useEditor((s) => s.setActiveBlenderMode)

  const [cameraPaintActive, setCameraPaintActive] = useState(false)
  const [targetMatId, setTargetMatId] = useState<string>(materials[0]?.id || '')

  const currentMat = materials.find((m) => m.id === targetMatId) || materials[0]
  const currentTex = currentMat ? textures.find((t) => t.id === currentMat.textureId) : null
  const isShared = currentTex ? (currentTex.usersCount ?? 1) > 1 : false

  return (
    <div data-testid="three-panel" className="p-2.5 text-xs text-ink-200 select-none space-y-2.5 overflow-y-auto h-full">
      {/* Overview & Sub-Mode Quick Channel Bar */}
      {(!activeSubMode || activeSubMode === 'threed-overview') && (
        <>
          <div className="p-2.5 rounded-lg bg-ink-900 border border-ink-800">
            <div className="flex items-center justify-between font-semibold text-brand-400 mb-1">
              <div className="flex items-center gap-1.5">
                <Box size={14} />
                <span>3D & 2.5D Compositing</span>
              </div>
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-brand/15 text-brand-400 border border-brand/30">
                Blender Mode
              </span>
            </div>
            <p className="text-[11px] text-ink-400 leading-relaxed">
              WebGL viewport supporting camera orbit, pan, dolly, coordinate axes, and 2.5D video planes.
            </p>
          </div>

          {/* Quick Sub-Mode Jump Selectors (Channels side bar focus) */}
          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase text-ink-400 tracking-wider">
              Focused 3D Channels
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                data-testid="threed-submode-materials-btn"
                onClick={() => openSubMode('threed', 'threed-materials', '3D Materials & Textures', 'Sphere')}
                className="flex items-center justify-between p-2 rounded-lg bg-ink-900 border border-ink-800 hover:border-brand/60 hover:bg-ink-800 text-left transition-all"
              >
                <div>
                  <div className="font-semibold text-[11px] text-ink-100">Materials</div>
                  <div className="text-[9px] text-ink-400">PBR & Textures</div>
                </div>
                <ChevronRight size={13} className="text-ink-400" />
              </button>

              <button
                type="button"
                data-testid="threed-submode-paint-btn"
                onClick={() => openSubMode('threed', 'threed-paint', '3D Texture Painting', 'Paintbrush')}
                className="flex items-center justify-between p-2 rounded-lg bg-ink-900 border border-ink-800 hover:border-brand/60 hover:bg-ink-800 text-left transition-all"
              >
                <div>
                  <div className="font-semibold text-[11px] text-ink-100">3D Paint</div>
                  <div className="text-[9px] text-ink-400">Surface Stencils</div>
                </div>
                <ChevronRight size={13} className="text-ink-400" />
              </button>
              <button
                type="button"
                data-testid="threed-submode-mask-btn"
                aria-label="Open 3D mask and selection tools"
                onClick={() => {
                  setThreeMaskMode('scene')
                  setThreeMaskSelection(null)
                  // The texturing drawer overlays the viewport; the mask tool
                  // needs an unobstructed canvas for picking and dragging.
                  setActiveBlenderMode('object')
                  openSubMode('threed', 'threed-mask', '3D Mask & Selection', 'Layers')
                }}
                className="flex min-h-[74px] flex-col items-center justify-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-2 text-center transition-colors hover:border-cyan-400/60 hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <Layers size={17} className="text-cyan-300" aria-hidden="true" />
                <span className="font-semibold text-[11px] text-ink-100">Mask</span>
                <span className="text-[9px] leading-tight text-ink-400">Scene + camera</span>
              </button>
            </div>
          </div>

          {/* Preset workspace */}
          <div className="space-y-1">
            <button
              type="button"
              data-testid="activate-3d-preset-btn"
              onClick={() => setWorkspacePreset('3d')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-brand/20 hover:bg-brand/30 text-brand-400 text-xs font-medium transition-colors border border-brand/30"
            >
              <span>Open 3D Scene Workspace</span>
              <Box size={14} />
            </button>
          </div>
        </>
      )}

      {/* 3D Texture Sharing & Make Unique (Focused Channel or Standard) */}
      {(!activeSubMode || activeSubMode === 'threed-materials') && (
        <div data-testid="threed-materials-section" className="p-2.5 rounded-lg border border-ink-800 bg-ink-950/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase text-ink-400 tracking-wider">
              Textures & Materials
            </span>
            {isShared && (
              <span
                data-testid="texture-shared-badge"
                className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-medium border border-amber-500/30 font-mono"
              >
                Shared ({currentTex?.usersCount} users)
              </span>
            )}
          </div>

          {currentMat && (
            <div className="space-y-1.5">
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
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-brand hover:bg-brand/90 text-white font-medium text-[11px] transition-colors truncate"
                  title="Clone shared texture into independent asset so changes don't affect other objects"
                  aria-label="Make texture unique"
                >
                  <Scissors size={12} className="shrink-0" />
                  <span className="truncate">Make Unique (Branch Texture)</span>
                </button>
              ) : (
                <div className="text-[10px] text-ink-500 text-center py-0.5">
                  Texture is unique to this material.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Camera Paint Subsystem (Focused Channel or Standard) */}
      {(!activeSubMode || activeSubMode === 'threed-paint') && (
        <div data-testid="threed-paint-section" className="p-2.5 rounded-lg border border-ink-800 bg-ink-950/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase text-ink-400 tracking-wider">
              Camera Projection Paint
            </span>
            <button
              type="button"
              data-testid="camera-paint-toggle"
              aria-pressed={cameraPaintActive}
              onClick={() => setCameraPaintActive(!cameraPaintActive)}
              className={`px-2 py-1 min-h-[24px] rounded text-[10px] font-medium border transition-colors ${
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
      )}

      {activeSubMode === 'threed-mask' && (
        <section
          aria-labelledby="threed-mask-subtool-heading"
          data-testid="threed-mask-subtool"
          className="rounded-lg border border-cyan-500/30 bg-ink-950/50 p-2.5 space-y-2"
        >
          <div>
            <h3 id="threed-mask-subtool-heading" className="text-[11px] font-semibold uppercase tracking-wider text-cyan-200">
              3D Mask & Selection
            </h3>
            <p className="mt-1 text-[10px] leading-relaxed text-ink-400">
              Choose a scene target or draw a camera-space selection. Both are editing selections, not 3D texture edits.
            </p>
          </div>

          <div role="group" aria-label="3D mask selection mode" className="grid grid-cols-3 gap-1">
            <button
              type="button"
              data-testid="three-mask-mode-scene"
              aria-pressed={threeMaskMode === 'scene'}
              onClick={() => {
                setThreeMaskMode('scene')
                clearThreeMaskSelection()
              }}
              className={`min-h-8 rounded border px-1 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${threeMaskMode === 'scene' ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100' : 'border-ink-700 bg-ink-900 text-ink-300 hover:bg-ink-800'}`}
            >
              Scene target
            </button>
            <button
              type="button"
              data-testid="three-mask-mode-viewport"
              aria-pressed={threeMaskMode === 'viewport'}
              onClick={() => {
                setThreeMaskMode('viewport')
                clearThreeMaskSelection()
              }}
              className={`min-h-8 rounded border px-1 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${threeMaskMode === 'viewport' ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100' : 'border-ink-700 bg-ink-900 text-ink-300 hover:bg-ink-800'}`}
            >
              Camera-space
            </button>
            <button
              type="button"
              data-testid="three-mask-mode-off"
              aria-pressed={threeMaskMode === 'off'}
              onClick={() => setThreeMaskMode('off')}
              className={`min-h-8 rounded border px-1 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${threeMaskMode === 'off' ? 'border-ink-500 bg-ink-800 text-white' : 'border-ink-700 bg-ink-900 text-ink-300 hover:bg-ink-800'}`}
            >
              Off
            </button>
          </div>

          {threeMaskMode === 'scene' && (
            <>
              <div role="group" aria-label="Scene mask target type" className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  data-testid="three-mask-target-geometry"
                  aria-pressed={threeMaskTargetKind === 'geometry'}
                  onClick={() => {
                    setThreeMaskTargetKind('geometry')
                    clearThreeMaskSelection()
                  }}
                  className={`min-h-8 rounded border px-2 py-1 text-[10px] transition-colors ${threeMaskTargetKind === 'geometry' ? 'border-brand/60 bg-brand/15 text-white' : 'border-ink-700 bg-ink-900 text-ink-300 hover:bg-ink-800'}`}
                >
                  Geometry / mesh
                </button>
                <button
                  type="button"
                  data-testid="three-mask-target-material"
                  aria-pressed={threeMaskTargetKind === 'material'}
                  onClick={() => {
                    setThreeMaskTargetKind('material')
                    clearThreeMaskSelection()
                  }}
                  className={`min-h-8 rounded border px-2 py-1 text-[10px] transition-colors ${threeMaskTargetKind === 'material' ? 'border-brand/60 bg-brand/15 text-white' : 'border-ink-700 bg-ink-900 text-ink-300 hover:bg-ink-800'}`}
                >
                  Material / texture
                </button>
              </div>
              <p className="text-[10px] leading-relaxed text-ink-400">
                Click a visible mesh in the viewport. Geometry selects the hit mesh; Material selects visible meshes sharing its material.
              </p>
            </>
          )}

          {threeMaskMode === 'viewport' && (
            <p className="text-[10px] leading-relaxed text-ink-400">
              Drag a rectangle over the current camera view. Drawing transfer uses that 2D screen-space rectangle, not a 3D surface projection.
            </p>
          )}

          {threeMaskSelection && (
            <div
              data-testid="three-mask-selection-status"
              className="flex items-start justify-between gap-2 rounded border border-cyan-500/20 bg-cyan-500/5 px-2 py-1.5 text-[10px]"
            >
              <div className="min-w-0">
                <div className="font-semibold text-cyan-100">
                  {threeMaskSelection.mode === 'viewport'
                    ? 'Camera-space selection'
                    : `${threeMaskSelection.targetKind === 'material' ? 'Material' : 'Geometry'} target`}
                </div>
                <div className="truncate text-ink-300">{threeMaskSelection.targetName}</div>
                <div className="text-ink-500">
                  Bounds {Math.round(threeMaskSelection.bounds.x * 100)}%, {Math.round(threeMaskSelection.bounds.y * 100)}% · {Math.round(threeMaskSelection.bounds.width * 100)}% × {Math.round(threeMaskSelection.bounds.height * 100)}%
                </div>
              </div>
              <button
                type="button"
                data-testid="clear-three-mask-selection"
                aria-label="Clear 3D mask selection"
                onClick={clearThreeMaskSelection}
                className="shrink-0 rounded px-1.5 py-1 text-ink-400 hover:bg-ink-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                Clear
              </button>
            </div>
          )}

          <p data-testid="threed-mask-transfer-note" className="text-[10px] leading-relaxed text-cyan-100/80">
            The selection does not change a 3D material or export. Transfer its projected bounds to Drawing, then use To Drawing Mask to clip Drawing-layer strokes.
          </p>
          <button
            type="button"
            data-testid="three-mask-to-drawing-selection"
            disabled={!threeMaskSelection}
            onClick={useThreeMaskSelectionInDrawing}
            className="min-h-8 w-full rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-1.5 text-[10px] font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Use projected bounds in Drawing
          </button>
        </section>
      )}

      <section
        aria-labelledby="threed-mask-export-heading"
        data-testid="threed-mask-export-note"
        className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-2.5 space-y-2"
      >
        <div id="threed-mask-export-heading" className="text-[10px] font-semibold uppercase tracking-wider text-cyan-200">
          Mask & export scope
        </div>
        <p className="text-[11px] leading-relaxed text-ink-300">
          3D materials and camera work stay in the scene context. A mask enters the final video only after it is applied to a Drawing paint layer.
        </p>
        <button
          type="button"
          data-testid="open-drawing-mask-tools"
          onClick={() => {
            setThreeMaskMode('off')
            setIs3DMode(false)
            setDrawingEnabled(true)
            setDrawingTool('select-rect')
            setLeftTab('drawing')
          }}
          className="flex min-h-8 w-full items-center justify-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 text-[11px] font-medium text-cyan-100 transition-colors hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <Paintbrush size={13} aria-hidden="true" />
          Open Drawing Mask Tools
        </button>
      </section>

      {/* Camera Controls Guide */}
      {(!activeSubMode || activeSubMode === 'threed-overview') && (
        <div className="pt-2 border-t border-ink-800/80 space-y-1.5">
          <span className="text-[10px] font-semibold uppercase text-ink-500 tracking-wider block">
            Camera Controls Guide
          </span>
          <div className="space-y-1 text-[11px] text-ink-400">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-ink-300">
                <BlenderRotationIcon size={13} />
                <span>Orbit Camera:</span>
              </span>
              <span className="font-mono text-ink-500 text-[10px]">Left-click + Drag</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-300">Pan Target:</span>
              <span className="font-mono text-ink-500 text-[10px]">Right-click / Shift+Drag</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-300">Dolly / Zoom:</span>
              <span className="font-mono text-ink-500 text-[10px]">Mouse Wheel Scroll</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
