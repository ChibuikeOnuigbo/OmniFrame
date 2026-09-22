import type { Clip } from '../types'

let clip: Clip | null = null

export function readClipClipboard(): Clip | null {
  return clip ? structuredClone(clip) : null
}

export function writeClipClipboard(value: Clip): void {
  clip = structuredClone(value)
}
