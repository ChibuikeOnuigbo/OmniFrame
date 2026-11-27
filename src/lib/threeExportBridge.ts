/** Lazy bridge: importing video export must not eagerly load Three.js. */
export interface ThreeExportSession {
  canvas: HTMLCanvasElement
  render: () => void
  dispose: () => void
}

type Factory = (width: number, height: number) => ThreeExportSession
let factory: Factory | null = null

export function registerThreeExportFactory(next: Factory): () => void {
  factory = next
  return () => { if (factory === next) factory = null }
}

export function beginThreeExport(width: number, height: number): ThreeExportSession {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Invalid 3D export dimensions.')
  }
  if (!factory) throw new Error('The 3D scene is not ready to export.')
  return factory(width, height)
}
