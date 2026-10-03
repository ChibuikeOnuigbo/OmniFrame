/**
 * Rigging state, extracted from the monolithic store.
 *
 * Holds the rigs themselves plus the editing selection. All the geometry —
 * hierarchy resolution, pivots, bend, wind — lives in ../lib/rigging.ts and is
 * pure; this slice only owns mutation and undo.
 *
 * `RiggingStoreState` is declared here rather than importing EditorState,
 * which would be circular. It lists exactly the fields this slice touches, so
 * the coupling stays visible instead of hiding behind `any`.
 */

import type {
  ClipTransform,
  Rig,
  RigBend,
  RigPart,
  RigPartKind,
  RigPin,
  RigSide,
  RigWind,
} from '../types'
import {
  autoRig,
  DEFAULT_PIVOTS,
  normaliseZ,
  suggestPartName,
  wouldCycle,
} from '../lib/rigging'
import { uid } from '../lib/time'

export interface RiggingStoreState {
  rigs: Rig[]
  activeRigId: string | null
  selectedPartId: string | null
  /** Which editing tool the rig canvas is using. */
  rigTool: 'select' | 'pivot' | 'pin' | 'bend'
}

export interface RiggingSlice {
  rigs: Rig[]
  activeRigId: string | null
  selectedPartId: string | null
  rigTool: 'select' | 'pivot' | 'pin' | 'bend'

  setRigTool: (t: RiggingStoreState['rigTool']) => void
  setActiveRig: (id: string | null) => void
  setSelectedPart: (id: string | null) => void

  createRig: (name?: string, characterId?: string, sourceUrl?: string) => string
  deleteRig: (rigId: string) => void
  /** Seed a rig from an existing segmented cutout. The "rigged in 1 tap" path. */
  createRigFromCharacter: (characterId: string) => string | null

  addRigPart: (
    rigId: string,
    input: { name?: string; kind?: RigPartKind; side?: RigSide; cutoutUrl?: string; bounds?: RigPart['bounds'] },
  ) => string | null
  removeRigPart: (rigId: string, partId: string) => void
  renameRigPart: (rigId: string, partId: string, name: string) => void
  setRigPartParent: (rigId: string, partId: string, parentId: string | null) => boolean
  /** Swap which cutout a part draws. Empty string = placeholder rectangle. */
  setRigPartCutout: (rigId: string, partId: string, cutoutUrl: string) => void
  setRigPartPivot: (rigId: string, partId: string, pivot: { x: number; y: number }) => void
  setRigPartTransform: (rigId: string, partId: string, transform: Partial<ClipTransform>) => void
  setRigPartBend: (rigId: string, partId: string, bend: Partial<RigBend> | null) => void
  setRigPartWind: (rigId: string, partId: string, wind: Partial<RigWind> | null) => void
  reorderRigPart: (rigId: string, partId: string, direction: 'up' | 'down' | 'front' | 'back') => void
  toggleRigPartHidden: (rigId: string, partId: string) => void
  toggleRigPartLocked: (rigId: string, partId: string) => void

  addRigPin: (rigId: string, partId: string, x: number, y: number) => string | null
  moveRigPin: (rigId: string, partId: string, pinId: string, dx: number, dy: number) => void
  removeRigPin: (rigId: string, partId: string, pinId: string) => void

  /** Fill in parent links from anatomical defaults. The "one tap" step. */
  autoRigParts: (rigId: string) => number
  /** Re-apply default pivots to every part that still has the centre pivot. */
  resetRigPivots: (rigId: string) => void
}

type SetState = (partial: any) => void

/** Apply `fn` to one rig, leaving the others untouched. */
function updateRig(set: SetState, rigId: string, fn: (rig: Rig) => Rig) {
  set((s: RiggingStoreState) => ({
    rigs: s.rigs.map((r) => (r.id === rigId ? fn(r) : r)),
  }))
}

function updatePart(set: SetState, rigId: string, partId: string, fn: (part: RigPart) => RigPart) {
  updateRig(set, rigId, (rig) => ({
    ...rig,
    parts: rig.parts.map((p) => (p.id === partId ? fn(p) : p)),
    updatedAt: Date.now(),
  }))
}

export function createRiggingSlice(
  set: SetState,
  _get: () => any,
  deps: { pushSnapshot: () => void },
): RiggingSlice {
  return {
    rigs: [],
    activeRigId: null,
    selectedPartId: null,
    rigTool: 'select',

    setRigTool: (t) => set({ rigTool: t }),
    setActiveRig: (id) => set({ activeRigId: id, selectedPartId: null }),
    setSelectedPart: (id) => set({ selectedPartId: id }),

    createRig: (name = 'New Rig', characterId, sourceUrl) => {
      deps.pushSnapshot()
      const id = `rig_${uid()}`
      const now = Date.now()
      const rig: Rig = {
        id,
        name,
        characterId,
        sourceUrl,
        parts: [],
        createdAt: now,
        updatedAt: now,
      }
      set((s: RiggingStoreState) => ({ rigs: [...s.rigs, rig], activeRigId: id, selectedPartId: null }))
      return id
    },

    createRigFromCharacter: (characterId) => {
      const state = _get() as any
      const character = (state.omniframeCharacters || []).find(
        (c: any) => c.id === characterId,
      )
      if (!character) return null

      deps.pushSnapshot()
      const rigId = `rig_${uid()}`
      const now = Date.now()
      const rootId = `part_${uid()}`
      // The segmented cutout becomes the torso: everything else hangs off it,
      // which is the anatomical root a skeleton wants.
      const root: RigPart = {
        id: rootId,
        name: character.name || 'Character',
        kind: 'torso',
        side: 'center',
        cutoutUrl: character.cutoutUrl || '',
        bounds: { ...character.bounds },
        pivot: { ...DEFAULT_PIVOTS.torso },
        parentId: null,
        z: 0,
        transform: { ...character.transform },
        pins: [],
      }
      const rig: Rig = {
        id: rigId,
        name: `${character.name || 'Character'} rig`,
        characterId,
        sourceUrl: character.cutoutUrl,
        parts: [root],
        createdAt: now,
        updatedAt: now,
      }
      set((s: RiggingStoreState) => ({
        rigs: [...s.rigs, rig],
        activeRigId: rigId,
        selectedPartId: rootId,
      }))
      return rigId
    },

    deleteRig: (rigId) => {
      deps.pushSnapshot()
      set((s: RiggingStoreState) => ({
        rigs: s.rigs.filter((r) => r.id !== rigId),
        activeRigId: s.activeRigId === rigId ? null : s.activeRigId,
        selectedPartId: null,
      }))
    },

    addRigPart: (rigId, input) => {
      deps.pushSnapshot()
      const id = `part_${uid()}`
      const kind = input.kind || 'custom'
      const side = input.side || 'center'
      let created = false

      updateRig(set, rigId, (rig) => {
        // Parts paint above what is already there.
        const maxZ = rig.parts.reduce((m, p) => Math.max(m, p.z || 0), -1)
        const part: RigPart = {
          id,
          name: input.name || suggestPartName(rig.parts, kind, side),
          kind,
          side,
          cutoutUrl: input.cutoutUrl || '',
          bounds: input.bounds || { x: 0.4, y: 0.4, width: 0.2, height: 0.2 },
          // Default to the anatomical joint, not the centre.
          pivot: { ...(DEFAULT_PIVOTS[kind] || { x: 0.5, y: 0.5 }) },
          parentId: null,
          z: maxZ + 1,
          transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
          pins: [],
        }
        created = true
        return { ...rig, parts: [...rig.parts, part], updatedAt: Date.now() }
      })

      if (created) set({ selectedPartId: id })
      return created ? id : null
    },

    removeRigPart: (rigId, partId) => {
      deps.pushSnapshot()
      updateRig(set, rigId, (rig) => {
        // Children of a removed part must not be orphaned into a broken rig:
        // they are re-parented to the removed part's own parent.
        const removed = rig.parts.find((p) => p.id === partId)
        const parts = rig.parts
          .filter((p) => p.id !== partId)
          .map((p) => (p.parentId === partId ? { ...p, parentId: removed?.parentId ?? null } : p))
        return { ...rig, parts: normaliseZ(parts), updatedAt: Date.now() }
      })
      set((s: RiggingStoreState) => ({ selectedPartId: s.selectedPartId === partId ? null : s.selectedPartId }))
    },

    renameRigPart: (rigId, partId, name) => {
      deps.pushSnapshot()
      updatePart(set, rigId, partId, (p) => ({ ...p, name }))
    },

    setRigPartParent: (rigId, partId, parentId) => {
      const state = _get() as RiggingStoreState
      const rig = state.rigs.find((r) => r.id === rigId)
      if (!rig) return false
      // Refuse anything that would orphan the subtree.
      if (wouldCycle(rig, partId, parentId)) return false
      deps.pushSnapshot()
      updatePart(set, rigId, partId, (p) => ({ ...p, parentId }))
      return true
    },

    setRigPartCutout: (rigId, partId, cutoutUrl) => {
      deps.pushSnapshot()
      updatePart(set, rigId, partId, (p) => ({ ...p, cutoutUrl }))
    },

    setRigPartPivot: (rigId, partId, pivot) => {
      deps.pushSnapshot()
      updatePart(set, rigId, partId, (p) => ({
        ...p,
        pivot: {
          x: Math.min(1, Math.max(0, pivot.x)),
          y: Math.min(1, Math.max(0, pivot.y)),
        },
      }))
    },

    setRigPartTransform: (rigId, partId, transform) => {
      // Transform edits are continuous (dragging), so they do not each get an
      // undo entry — the interaction pushes one snapshot when the drag opens.
      updatePart(set, rigId, partId, (p) => ({ ...p, transform: { ...p.transform, ...transform } }))
    },

    setRigPartBend: (rigId, partId, bend) => {
      deps.pushSnapshot()
      updatePart(set, rigId, partId, (p) => {
        if (!bend) {
          const { bend: _drop, ...rest } = p
          return rest as RigPart
        }
        const current: RigBend = p.bend || { angle: 0, start: 0.15, end: 0.85 }
        return { ...p, bend: { ...current, ...bend } }
      })
    },

    setRigPartWind: (rigId, partId, wind) => {
      deps.pushSnapshot()
      updatePart(set, rigId, partId, (p) => {
        if (!wind) {
          const { wind: _drop, ...rest } = p
          return rest as RigPart
        }
        const current: RigWind = p.wind || { enabled: false, amplitude: 0, frequency: 1, lag: 0.5, bias: 0 }
        return { ...p, wind: { ...current, ...wind } }
      })
    },

    reorderRigPart: (rigId, partId, direction) => {
      deps.pushSnapshot()
      updateRig(set, rigId, (rig) => {
        const idx = rig.parts.findIndex((p) => p.id === partId)
        if (idx === -1) return rig
        const ordered = [...rig.parts].sort((a, b) => (a.z || 0) - (b.z || 0))
        const at = ordered.findIndex((p) => p.id === partId)
        let next = at
        if (direction === 'up') next = Math.min(ordered.length - 1, at + 1)
        else if (direction === 'down') next = Math.max(0, at - 1)
        else if (direction === 'front') next = ordered.length - 1
        else next = 0
        if (next === at) return rig
        const [moved] = ordered.splice(at, 1)
        ordered.splice(next, 0, moved)
        return { ...rig, parts: normaliseZ(ordered), updatedAt: Date.now() }
      })
    },

    toggleRigPartHidden: (rigId, partId) => {
      deps.pushSnapshot()
      updatePart(set, rigId, partId, (p) => ({ ...p, hidden: !p.hidden }))
    },

    toggleRigPartLocked: (rigId, partId) => {
      deps.pushSnapshot()
      updatePart(set, rigId, partId, (p) => ({ ...p, locked: !p.locked }))
    },

    addRigPin: (rigId, partId, x, y) => {
      deps.pushSnapshot()
      const id = `pin_${uid()}`
      let created = false
      updatePart(set, rigId, partId, (p) => {
        const pin: RigPin = { id, x, y, radius: 0.25, dx: 0, dy: 0 }
        created = true
        return { ...p, pins: [...(p.pins || []), pin] }
      })
      return created ? id : null
    },

    moveRigPin: (rigId, partId, pinId, dx, dy) => {
      updatePart(set, rigId, partId, (p) => ({
        ...p,
        pins: (p.pins || []).map((pin) => (pin.id === pinId ? { ...pin, dx, dy } : pin)),
      }))
    },

    removeRigPin: (rigId, partId, pinId) => {
      deps.pushSnapshot()
      updatePart(set, rigId, partId, (p) => ({
        ...p,
        pins: (p.pins || []).filter((pin) => pin.id !== pinId),
      }))
    },

    autoRigParts: (rigId) => {
      deps.pushSnapshot()
      let linked = 0
      updateRig(set, rigId, (rig) => {
        const before = rig.parts.map((p) => p.parentId)
        const after = autoRig(rig.parts)
        linked = after.reduce(
          (n, p, i) => n + (p.parentId && p.parentId !== before[i] ? 1 : 0),
          0,
        )
        return { ...rig, parts: after, updatedAt: Date.now() }
      })
      return linked
    },

    resetRigPivots: (rigId) => {
      deps.pushSnapshot()
      updateRig(set, rigId, (rig) => ({
        ...rig,
        parts: rig.parts.map((p) => ({
          ...p,
          pivot: { ...(DEFAULT_PIVOTS[p.kind] || { x: 0.5, y: 0.5 }) },
        })),
        updatedAt: Date.now(),
      }))
    },
  }
}
