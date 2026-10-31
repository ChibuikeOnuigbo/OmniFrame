import type { ActiveSelection, Clip, DrawingStroke, MediaAsset, SmartPatchScope, StrokePoint } from '../types'
import { buildSmartPatchFrame } from '../lib/smartPatch'
import { uid } from '../lib/time'
import { loadRotoFrame, type RotoFrameScope } from './rotoMask'

export interface SmartPatchStatus {
  phase: 'idle' | 'processing' | 'done' | 'error'
  done: number
  total: number
  message: string
}

export interface SmartPatchSlice {
  smartPatchScope: SmartPatchScope
  smartPatchBrushRadius: number
  smartPatchFeather: number
  smartPatchStatus: SmartPatchStatus
  setSmartPatchScope: (patch: Partial<SmartPatchScope>) => void
  setSmartPatchBrushRadius: (radius: number) => void
  setSmartPatchFeather: (feather: number) => void
  applySmartPatch: (points: StrokePoint[], useSelection?: boolean) => Promise<boolean>
}

interface SmartPatchStoreState extends SmartPatchSlice {
  assets: MediaAsset[]
  clips: Clip[]
  selectedClipId: string | null
  playhead: number
  projectFps: number
  rotoScope: RotoFrameScope
  drawingStrokes: DrawingStroke[]
  activePaintLayerId: string
  cloneSourcePoint: { x: number; y: number; sampleDataUrl?: string } | null
  activeSelection: ActiveSelection | null
}

type SetState = (
  partial: Partial<SmartPatchStoreState & Record<string, unknown>> | ((s: SmartPatchStoreState) => Partial<SmartPatchStoreState & Record<string, unknown>>),
) => void

type GetState = () => SmartPatchStoreState

export function createSmartPatchSlice(set: SetState, get: GetState, pushSnapshot: () => void): SmartPatchSlice {
  return {
    smartPatchScope: { mode: 'current', start: 0, end: 2, step: 1 },
    smartPatchBrushRadius: 52,
    smartPatchFeather: 5,
    smartPatchStatus: { phase: 'idle', done: 0, total: 0, message: '' },

    setSmartPatchScope: (patch) => set((state) => ({ smartPatchScope: { ...state.smartPatchScope, ...patch } })),
    setSmartPatchBrushRadius: (radius) => set({ smartPatchBrushRadius: Math.max(4, Math.min(240, radius)) }),
    setSmartPatchFeather: (feather) => set({ smartPatchFeather: Math.max(0, Math.min(36, feather)) }),

    applySmartPatch: async (points, useSelection = false) => {
      const state = get()
      const sourcePoint = state.cloneSourcePoint
      if (!sourcePoint?.sampleDataUrl || points.length === 0) {
        set({ smartPatchStatus: { phase: 'error', done: 0, total: 0, message: 'Set a donor point on the canvas first' } })
        return false
      }
      const clip =
        state.clips.find((candidate) => candidate.id === state.selectedClipId) ||
        state.clips.find((candidate) => state.playhead >= candidate.start && state.playhead <= candidate.start + candidate.duration)
      const asset = clip ? state.assets.find((candidate) => candidate.id === clip.assetId) : undefined
      if (!clip || !asset) {
        set({ smartPatchStatus: { phase: 'error', done: 0, total: 0, message: 'Select a still or video clip first' } })
        return false
      }

      const fps = Math.max(1, state.projectFps || 30)
      const scope = state.smartPatchScope.mode === 'omniframe'
        ? state.rotoScope
        : state.smartPatchScope
      const still = asset.kind === 'image' && !asset.imageSequence?.frames?.length
      const clipFrameCount = Math.max(1, Math.round(clip.duration * fps))
      let targetFrames: number[]
      if (still) {
        targetFrames = [0]
      } else if (scope.mode === 'current') {
        targetFrames = [Math.max(0, Math.min(clipFrameCount - 1, Math.round((state.playhead - clip.start) * fps)))]
      } else if (scope.mode === 'range') {
        const start = Math.max(0, Math.round(scope.start * fps))
        const end = Math.min(clipFrameCount - 1, Math.round(scope.end * fps))
        targetFrames = []
        for (let frame = start; frame <= end; frame += Math.max(1, scope.step)) targetFrames.push(frame)
      } else {
        targetFrames = []
        for (let frame = 0; frame < clipFrameCount; frame += Math.max(1, scope.step)) targetFrames.push(frame)
      }
      if (!targetFrames.length) {
        set({ smartPatchStatus: { phase: 'error', done: 0, total: 0, message: 'The selected scope contains no frames' } })
        return false
      }

      const selection = useSelection ? state.activeSelection : null
      const target = {
        points: points.map(({ x, y }) => ({ x, y })),
        ...(selection?.maskDataUrl ? { maskDataUrl: selection.maskDataUrl } : {}),
        ...(selection && !selection.maskDataUrl ? { bounds: selection.bounds, shape: selection.type === 'ellipse' ? 'ellipse' as const : 'rectangle' as const } : {}),
      }
      set({ smartPatchStatus: { phase: 'processing', done: 0, total: targetFrames.length, message: 'Building frame patches…' } })

      try {
        const frames: { time: number; dataUrl: string }[] = []
        for (const [index, frame] of targetFrames.entries()) {
          const timelineTime = still ? clip.start : clip.start + frame / fps
          let source: CanvasImageSource
          let width: number
          let height: number
          if (!still && (scope.mode !== 'current' || frame !== targetFrames[0])) {
            const sourceFrame = await loadRotoFrame(asset, clip.inPoint + frame / fps)
            if (!sourceFrame) throw new Error(`Could not read frame ${frame}`)
            source = sourceFrame.source
            width = sourceFrame.width
            height = sourceFrame.height
          } else if (!still && scope.mode === 'all') {
            const sourceFrame = await loadRotoFrame(asset, clip.inPoint + frame / fps)
            if (!sourceFrame) throw new Error(`Could not read frame ${frame}`)
            source = sourceFrame.source
            width = sourceFrame.width
            height = sourceFrame.height
          } else {
            const img = new Image()
            img.src = sourcePoint.sampleDataUrl
            if (!(img.complete && img.naturalWidth > 0)) {
              const loaded = await new Promise<boolean>((resolve) => {
                img.onload = () => resolve(true)
                img.onerror = () => resolve(false)
              })
              if (!loaded) throw new Error('Could not load the sampled donor frame')
            }
            source = img
            width = img.naturalWidth
            height = img.naturalHeight
          }
          const dataUrl = await buildSmartPatchFrame({
            source,
            width,
            height,
            sourcePoint: { x: sourcePoint.x, y: sourcePoint.y },
            target,
            brushRadius: state.smartPatchBrushRadius,
            feather: state.smartPatchFeather,
          })
          frames.push({ time: timelineTime, dataUrl })
          set((current) => ({ smartPatchStatus: { ...current.smartPatchStatus, done: index + 1 } }))
        }

        let temporalScope: DrawingStroke['temporalScope']
        if (still || scope.mode === 'all') {
          temporalScope = { type: 'span', startTime: clip.start, duration: clip.duration }
        } else if (scope.mode === 'range') {
          temporalScope = {
            type: 'span',
            startTime: clip.start + scope.start,
            duration: Math.max(1 / fps, scope.end - scope.start + 1 / fps),
          }
        } else {
          const frameNumber = Math.round((clip.start + targetFrames[0] / fps) * fps)
          temporalScope = { type: 'frame', frame: frameNumber, holdFrames: 1 }
        }
        const stroke: DrawingStroke = {
          id: uid('smart-patch'),
          layerId: state.activePaintLayerId || 'default-paint-layer',
          tool: 'smart-patch',
          color: '#ffffff',
          size: state.smartPatchBrushRadius,
          opacity: 1,
          points,
          temporalScope,
          cloneSource: { x: sourcePoint.x, y: sourcePoint.y },
          smartPatchFrames: frames.sort((a, b) => a.time - b.time),
        }
        pushSnapshot()
        set((current) => ({
          drawingStrokes: [...current.drawingStrokes, stroke],
          smartPatchStatus: {
            phase: 'done',
            done: frames.length,
            total: frames.length,
            message: `Patched ${frames.length} frame${frames.length === 1 ? '' : 's'}`,
          },
        }))
        return true
      } catch (err) {
        set({
          smartPatchStatus: {
            phase: 'error',
            done: 0,
            total: targetFrames.length,
            message: err instanceof Error ? err.message : 'Smart Patch failed',
          },
        })
        return false
      }
    },
  }
}
