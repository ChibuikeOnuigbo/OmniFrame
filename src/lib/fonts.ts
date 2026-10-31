/**
 * Custom font registry: wraps the CSS FontFace API so imported font files
 * become usable by both canvas rendering (playback/export) and DOM UI.
 *
 * Fonts live in project state as data URLs (see CustomFont in types.ts), so
 * Save .omni embeds them and a reopened project re-registers them here.
 * Nothing about this is AI or remote: the file the user picked is loaded
 * locally into the document font set.
 */
import type { CustomFont } from '../types'

const faces = new Map<string, FontFace>()

export function fontFormatFromFileName(fileName: string): CustomFont['format'] {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.woff2')) return 'woff2'
  if (lower.endsWith('.woff')) return 'woff'
  if (lower.endsWith('.otf')) return 'otf'
  if (lower.endsWith('.ttf')) return 'ttf'
  return 'font'
}

/** "MyFont-Bold_v2.TTF" -> "MyFont Bold v2" (a stable, quotable family name). */
export function fontFamilyFromFileName(fileName: string): string {
  const base = fileName.replace(/\.(ttf|otf|woff2?)$/i, '')
  const cleaned = base.replace(/[^a-zA-Z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim()
  return cleaned || 'Custom Font'
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error || new Error(`Could not read ${file.name}`))
    reader.readAsDataURL(file)
  })
}

/** Approximate decoded byte size of a base64 data URL (for display/limits). */
export function dataUrlByteSize(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding)
}

/** Register (or re-register) one imported font with the document. */
export async function registerCustomFont(font: Pick<CustomFont, 'name' | 'dataUrl'>): Promise<boolean> {
  try {
    unregisterCustomFont(font.name)
    const face = new FontFace(font.name, `url(${font.dataUrl})`)
    const loaded = await face.load()
    document.fonts.add(loaded)
    faces.set(font.name, loaded)
    return true
  } catch {
    return false
  }
}

export function unregisterCustomFont(name: string): void {
  const face = faces.get(name)
  if (face) {
    try { document.fonts.delete(face) } catch { /* already gone */ }
    faces.delete(name)
  }
}

/** Re-register every project font (used after opening a .omni project). */
export async function registerAllCustomFonts(fonts: ReadonlyArray<Pick<CustomFont, 'name' | 'dataUrl'>>): Promise<number> {
  let ok = 0
  for (const font of fonts) {
    if (await registerCustomFont(font)) ok++
  }
  return ok
}

/** True when the family is actually usable for canvas/DOM text right now. */
export async function isCustomFontReady(name: string): Promise<boolean> {
  try {
    await document.fonts.load(`16px "${name}"`)
    return faces.has(name)
  } catch {
    return false
  }
}

/** Quote a family name for safe use inside a canvas `ctx.font` string. */
export function canvasFontFamily(name: string): string {
  return `"${name.replace(/["\\]/g, '')}"`
}
