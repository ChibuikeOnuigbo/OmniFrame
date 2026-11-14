import { create } from 'zustand'

/** Transient program-monitor mask editing state; project geometry stays in useEditor. */
export const useEffectMaskEditor = create<{
  clipId: string | null
  regionId: string | null
  snap: boolean
  freehand: boolean
  selectedPointIndex: number
  selectPoint: (index:number) => void
  setFreehand: (freehand: boolean) => void
  setSnap: (snap: boolean) => void
  edit: (clipId: string, regionId: string) => void
  close: () => void
}>(set => ({
  clipId: null, regionId: null, snap: true, freehand: false, selectedPointIndex: 0,
  selectPoint: selectedPointIndex => set({selectedPointIndex}),
  setFreehand: freehand => set({freehand}),
  setSnap: snap => set({snap}),
  edit: (clipId, regionId) => set({clipId, regionId, selectedPointIndex: 0}),
  close: () => set({clipId: null, regionId: null}),
}))
