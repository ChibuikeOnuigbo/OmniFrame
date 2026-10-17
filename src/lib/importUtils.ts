/**
 * Small import utilities for user files that are not media: subtitle files
 * (.srt/.vtt) become caption text clips, and palette files (.gpl GIMP,
 * .pal JASC, or .json) become drawing colour palettes. Both parse locally
 * from the exact file the user picked — nothing is uploaded anywhere.
 */

export interface SubtitleCue {
  start: number
  end: number
  text: string
}

function parseTimestamp(raw: string): number | null {
  const m = raw.trim().match(/(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/)
  if (!m) return null
  const hours = m[1] ? parseInt(m[1], 10) : 0
  const minutes = parseInt(m[2], 10)
  const seconds = parseInt(m[3], 10)
  const millis = parseInt(m[4].padEnd(3, '0'), 10)
  return hours * 3600 + minutes * 60 + seconds + millis / 1000
}

function stripCueMarkup(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/\{\\[^}]*\}/g, '')
    .trim()
}

/**
 * Parse SRT or WebVTT content into cues. Tolerant of CRLF, numeric indices,
 * NOTE/metadata blocks, and cue settings after the end timestamp.
 */
export function parseSubtitles(content: string, fileName = ''): SubtitleCue[] {
  const isVtt = /^\s*WEBVTT/i.test(content) || /\.vtt$/i.test(fileName)
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  const cues: SubtitleCue[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.includes('-->')) { i++; continue }
    const [startRaw, endPart] = line.split('-->')
    const endRaw = (endPart || '').trim().split(/\s+/)[0]
    const start = parseTimestamp(startRaw)
    const end = parseTimestamp(endRaw)
    i++
    const textLines: string[] = []
    while (i < lines.length && lines[i].trim() !== '') {
      if (isVtt && /^(NOTE|STYLE|REGION)\b/.test(lines[i])) { i++; continue }
      textLines.push(lines[i])
      i++
    }
    const text = stripCueMarkup(textLines.join('\n'))
    if (start !== null && end !== null && end > start && text) {
      cues.push({ start, end, text })
    }
  }
  return cues.sort((a, b) => a.start - b.start)
}

function toHex(r: number, g: number, b: number): string {
  const part = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

export interface ParsedPalette {
  name: string
  colors: string[]
}

/**
 * Parse a colour palette file:
 *  - GIMP .gpl: header lines, then "R G B  optional-name" rows.
 *  - JASC .pal: "JASC-PAL" header, version, count, then "R G B" rows.
 *  - JSON: an array of hex strings, or { colors: [...] } / { palette: [...] }.
 * Returns null when no colours could be read.
 */
export function parsePalette(content: string, fileName = ''): ParsedPalette | null {
  const fallbackName = fileName.replace(/\.[^.]+$/, '').trim() || 'Imported Palette'
  const trimmed = content.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      const rawList: unknown[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { colors?: unknown }).colors)
          ? ((parsed as { colors: unknown[] }).colors)
          : Array.isArray((parsed as { palette?: unknown }).palette)
            ? ((parsed as { palette: unknown[] }).palette)
            : []
      const colors: string[] = []
      for (const item of rawList) {
        if (typeof item === 'string') {
          const hex = item.trim()
          if (/^#[0-9a-fA-F]{6}$/.test(hex)) colors.push(hex.toLowerCase())
          else if (/^[0-9a-fA-F]{6}$/.test(hex)) colors.push(`#${hex.toLowerCase()}`)
        } else if (item && typeof item === 'object') {
          const o = item as { r?: number; g?: number; b?: number; hex?: string }
          if (typeof o.hex === 'string' && /^#?[0-9a-fA-F]{6}$/.test(o.hex)) {
            colors.push(o.hex.startsWith('#') ? o.hex.toLowerCase() : `#${o.hex.toLowerCase()}`)
          } else if (typeof o.r === 'number' && typeof o.g === 'number' && typeof o.b === 'number') {
            colors.push(toHex(o.r, o.g, o.b))
          }
        }
      }
      const named = !Array.isArray(parsed) && typeof (parsed as { name?: unknown }).name === 'string'
        ? String((parsed as { name: string }).name)
        : fallbackName
      return colors.length ? { name: named, colors: [...new Set(colors)] } : null
    } catch {
      return null
    }
  }

  // GIMP palette carries an explicit "Name:" header.
  let name = fallbackName
  const nameMatch = content.match(/^Name:\s*(.+)$/m)
  if (nameMatch) name = nameMatch[1].trim() || fallbackName

  const colors: string[] = []
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith('GIMP') || line.startsWith('Name:') || line.startsWith('Columns:') || line.startsWith('JASC')) continue
    const m = line.match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s|$)/)
    if (m) colors.push(toHex(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)))
  }
  return colors.length ? { name, colors: [...new Set(colors)] } : null
}
