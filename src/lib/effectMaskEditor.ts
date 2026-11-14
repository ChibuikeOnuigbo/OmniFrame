import { create } from 'zustand'

/** Transient program-monitor mask editing state; project geometry stays in useEditor. */
export const useEffectMaskEditor = create<{
  clipId: string | null
  regionId: string | null
  snap: boolean
  freehand: boolean
  setFreehand: (freehand: boolean) => void
  setSnap: (snap: boolean) => void
  edit: (clipId: string, regionId: string) => void
  close: () => void
}>(set => ({
  clipId: null, regionId: null, snap: true, freehand: false,
  setFreehand: freehand => set({freehand}),
  setSnap: snap => set({snap}),
  edit: (clipId, regionId) => set({clipId, regionId}),
  close: () => set({clipId: null, regionId: null}),
}))
