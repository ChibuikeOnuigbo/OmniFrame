import { create } from 'zustand'

export type PreviewFps = 15 | 30 | 60
function readFps(): PreviewFps {
  try {
    const value = Number(localStorage.getItem('omniframe.previewFps'))
    return value === 15 || value === 30 ? value : 60
  } catch { return 60 }
}
export const usePerformanceSettings = create<{
  previewFps: PreviewFps
  setPreviewFps: (value: PreviewFps) => void
}>((set) => ({
  previewFps: readFps(),
  setPreviewFps: (previewFps) => {
    if (![15, 30, 60].includes(previewFps)) return
    try { localStorage.setItem('omniframe.previewFps', String(previewFps)) } catch { /* session preference still works */ }
    set({ previewFps })
  },
}))

// Kept outside React/store state: observing a render must never trigger a render.
export const previewMetrics = { frames: 0, renderMs: 0, width: 0, height: 0 }
