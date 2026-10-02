/**
 * OmniFrame character manipulation, extracted from the monolithic store.
 *
 * Everything here acts on the cutout objects OmniFrame segments out of a
 * frame: their transforms, propagation scope, duplication, deletion, and the
 * drawing/mask conversions around them. See ./gapTools.ts for the slice
 * pattern this follows.
 *
 * `OmniframeStoreState` is declared here rather than importing EditorState,
 * which would be circular. It is deliberately narrow: it lists exactly the
 * store fields this slice reads and writes, so the coupling stays visible
 * instead of hiding behind `any`.
 */

import type {
  ActiveSelection,
  Clip,
  ClipTransform,
  DrawingStroke,
  OmniframeCharacter,
  OmniframeScopeType,
  TrackType,
} from '../types'
import { uid } from '../lib/time'

export interface OmniframeStoreState {
  omniframeCharacters: OmniframeCharacter[]
  selectedCharacterId: string | null
  clips: Clip[]
  selectedClipId: string | null
  projectFps: number
  drawingStrokes: DrawingStroke[]
  createTrack: (
    type?: TrackType,
    position?: 'above' | 'below',
    referenceTrackId?: string,
  ) => string
}

export interface OmniframeCharacterSlice {
  setOmniframeMode: (v: boolean) => void
  setSelectedCharacterId: (id: string | null) => void
  setOmniframeCharacterTransform: (
    charId: string,
    transform: Partial<ClipTransform>,
    scope?: OmniframeScopeType,
    sectionRange?: { start: number; end: number },
    frame?: number
  ) => void
  evaluateCharacterTransformAtTime: (charId: string, time: number) => ClipTransform
  cutCharacterToNewTrack: (charId: string) => string
  duplicateCharacter: (charId: string) => string
  removeCharacterInfill: (charId: string) => void
  deleteCharacter: (charId: string) => void
  restoreCharacter: (charId: string) => void
  resetCharacterPosition: (charId: string) => void
  setAttachDirectlyToVideo: (attach: boolean, targetClipId?: string) => void
  convertDrawingToMask: (clipId?: string, layerId?: string) => string | null
  convertMaskToSelection: (maskId: string, mode?: 'shape' | 'filled') => void
}

/** Dependencies the slice needs from the surrounding store. */
export interface OmniframeCharacterDeps {
  pushSnapshot: () => void
}

type SetState = (
  partial:
    | Partial<OmniframeStoreState & Record<string, unknown>>
    | ((s: OmniframeStoreState) => Partial<OmniframeStoreState & Record<string, unknown>>),
) => void

export function createOmniframeCharacterSlice(
  set: SetState,
  get: () => OmniframeStoreState,
  deps: OmniframeCharacterDeps
): OmniframeCharacterSlice {
  const { pushSnapshot } = deps
  return {
    // ---- OmniFrame & Character Manipulation actions ----
    setOmniframeMode: (v) => set({ omniframeMode: v }),
    setSelectedCharacterId: (id) => set({ selectedCharacterId: id }),
    setOmniframeCharacterTransform: (charId, transform, scope, sectionRange, frame) => {
      pushSnapshot()
      set((s) => ({
        omniframeCharacters: s.omniframeCharacters.map((c) => {
          if (c.id !== charId) return c
          return {
            ...c,
            transform: { ...c.transform, ...transform },
            scope: scope ?? c.scope,
            sectionRange: sectionRange !== undefined ? sectionRange : c.sectionRange,
            frameNumber: frame !== undefined ? frame : c.frameNumber,
          }
        }),
      }))
    },
    evaluateCharacterTransformAtTime: (charId, time) => {
      const char = get().omniframeCharacters.find((c) => c.id === charId)
      if (!char) return { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }
      const fps = get().projectFps || 30
      const currentFrame = Math.round(time * fps)

      if (char.scope === 'all') {
        return char.transform
      } else if (char.scope === 'section') {
        const range = char.sectionRange || { start: 2.0, end: 5.0 }
        if (time >= range.start && time <= range.end) {
          return char.transform
        }
        return { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }
      } else if (char.scope === 'frame') {
        const targetFrame = char.frameNumber ?? Math.round((char.sectionRange?.start || 0) * fps)
        if (Math.abs(currentFrame - targetFrame) <= 0.5) {
          return char.transform
        }
        return { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 }
      }
      return char.transform
    },
    cutCharacterToNewTrack: (charId) => {
      const char = get().omniframeCharacters.find((c) => c.id === charId)
      if (!char) return ''
      pushSnapshot()
      const activeClip = get().clips.find((c) => c.id === get().selectedClipId) || get().clips[0]
      const trkId = get().createTrack('video', 'above')
      const newClipId = uid('clip_char')
      const newClip: Clip = {
        id: newClipId,
        trackId: trkId,
        assetId: char.id,
        start: activeClip ? activeClip.start : 0,
        duration: activeClip ? activeClip.duration : 8.0,
        inPoint: 0,
        name: `${char.name} (Cut Track)`,
        kind: 'video',
        volume: 1,
        hidden: false,
        transform: { ...char.transform },
      }
      set((s) => ({
        clips: [...s.clips, newClip],
        selectedClipId: newClip.id,
      }))
      return newClipId
    },
    duplicateCharacter: (charId) => {
      const char = get().omniframeCharacters.find((c) => c.id === charId)
      if (!char) return ''
      pushSnapshot()
      const newId = `char_${char.id}_dup_${Date.now()}`
      const newChar: OmniframeCharacter = {
        ...structuredClone(char),
        id: newId,
        name: `${char.name} (Copy)`,
        label: `${char.label} Copy`,
        transform: {
          ...char.transform,
          x: char.transform.x + 40,
          y: char.transform.y + 20,
        },
      }
      set((s) => ({
        omniframeCharacters: [...s.omniframeCharacters, newChar],
        selectedCharacterId: newId,
      }))
      return newId
    },
    removeCharacterInfill: (charId) => {
      pushSnapshot()
      set((s) => ({
        omniframeCharacters: s.omniframeCharacters.map((c) =>
          c.id === charId
            ? {
                ...c,
                transform: { ...c.transform, opacity: 0 },
              }
            : c
        ),
      }))
    },
    deleteCharacter: (charId) => {
      pushSnapshot()
      const remaining = get().omniframeCharacters.filter((c) => c.id !== charId)
      set({
        omniframeCharacters: remaining,
        selectedCharacterId: remaining[0]?.id || null,
      })
    },
    restoreCharacter: (charId) => {
      pushSnapshot()
      set((s) => ({
        omniframeCharacters: s.omniframeCharacters.map((c) =>
          c.id === charId
            ? {
                ...c,
                transform: { ...c.transform, opacity: 1 },
              }
            : c
        ),
      }))
    },
    resetCharacterPosition: (charId) => {
      pushSnapshot()
      set((s) => ({
        omniframeCharacters: s.omniframeCharacters.map((c) =>
          c.id === charId
            ? {
                ...c,
                transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
                scope: 'all',
              }
            : c
        ),
      }))
    },

    setAttachDirectlyToVideo: (attach, targetClipId) => {
      pushSnapshot()
      if (!attach) {
        const trkId = get().createTrack('video', 'above')
        const videoClip = get().clips.find((c) => c.kind === 'video') || get().clips[0]
        const drawingClipId = uid('clip_drawing')
        const drawingClip: Clip = {
          id: drawingClipId,
          trackId: trkId,
          assetId: 'asset-drawing-overlay',
          start: videoClip ? videoClip.start : 0,
          duration: videoClip ? videoClip.duration : 8.0,
          inPoint: 0,
          name: 'Drawing Overlay (Separate Track)',
          kind: 'video',
          volume: 1,
          hidden: false,
          transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        }
        set((s) => ({
          clips: [...s.clips, drawingClip],
          selectedClipId: drawingClip.id,
          attachDirectlyToVideo: false,
          attachedVideoClipId: videoClip?.id || null,
        }))
      } else {
        const targetClip = targetClipId
          ? get().clips.find((c) => c.id === targetClipId)
          : get().clips.find((c) => c.kind === 'video' && !c.name.includes('Drawing Overlay'))
        set((s) => ({
          clips: s.clips.filter((c) => !c.name.includes('Drawing Overlay')),
          attachDirectlyToVideo: true,
          attachedVideoClipId: targetClip?.id || null,
        }))
      }
    },

    convertDrawingToMask: (clipId, layerId) => {
      const activeClip = clipId
        ? get().clips.find((c) => c.id === clipId)
        : get().clips.find((c) => c.id === get().selectedClipId) || get().clips[0]
      if (!activeClip) return null
      const strokes = layerId
        ? get().drawingStrokes.filter((s) => s.layerId === layerId)
        : get().drawingStrokes

      const allPts = strokes.flatMap((st) => st.points || [])
      let pts = [
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.2 },
        { x: 0.8, y: 0.8 },
        { x: 0.2, y: 0.8 },
      ]
      if (allPts.length > 0) {
        const xs = allPts.map((p) => p.x)
        const ys = allPts.map((p) => p.y)
        const minX = Math.max(0, Math.min(...xs))
        const maxX = Math.min(1, Math.max(...xs))
        const minY = Math.max(0, Math.min(...ys))
        const maxY = Math.min(1, Math.max(...ys))
        pts = [
          { x: minX, y: minY },
          { x: maxX, y: minY },
          { x: maxX, y: maxY },
          { x: minX, y: maxY },
        ]
      }

      const newMaskId = uid('mask_from_drawing')
      pushSnapshot()
      return newMaskId
    },

    convertMaskToSelection: (maskId, mode = 'shape') => {
      pushSnapshot()
      const b = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 }
      const newSel: ActiveSelection = {
        type: mode === 'shape' ? 'polygon' : 'rectangle',
        bounds: b,
        inverted: false,
        feather: 2,
        fillMode: mode === 'shape' ? 'outline' : 'filled',
      }
      set({ activeSelection: newSel })
    },
  }
}
