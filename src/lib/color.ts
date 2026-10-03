/**
 * Colour helpers for choosing text that stays readable on arbitrary
 * backgrounds.
 *
 * Marker labels, clip colours and user-picked swatches all render text on top
 * of a colour the user chose, so the text colour cannot be hardcoded -- white
 * on a mid-blue measures 3.68:1, under the WCAG AA minimum of 4.5:1 for normal
 * text. These functions pick whichever of black/white actually clears the
 * threshold against the given background.
 */

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(r: number, g: number, b: number): number {
  const f = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** Contrast ratio between two relative luminances, 1:1 to 21:1. */
export function contrastRatio(l1: number, l2: number): number {
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

/** Parse `#rgb`, `#rrggbb` or `rgb(...)` into 0-255 channels. Returns null if
 *  the string is not a colour we can reason about (gradients, named colours
 *  that need a lookup, `transparent`). */
export function parseColor(input: string): [number, number, number] | null {
  const s = (input || '').trim()
  let m = s.match(/^#([0-9a-f]{3})$/i)
  if (m) {
    const [a, b, c] = m[1].split('')
    return [parseInt(a + a, 16), parseInt(b + b, 16), parseInt(c + c, 16)]
  }
  m = s.match(/^#([0-9a-f]{6})$/i)
  if (m) {
    const h = m[1]
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i)
  if (m) return [+m[1], +m[2], +m[3]]
  return null
}

/**
 * Pick black or white text for the given background, choosing whichever has
 * the higher contrast ratio. Ties and unparseable colours fall back to white,
 * which is the previous behaviour everywhere this is used.
 */
export function readableTextColor(background: string): string {
  const rgb = parseColor(background)
  if (!rgb) return '#ffffff'
  const bg = relativeLuminance(rgb[0], rgb[1], rgb[2])
  const white = contrastRatio(1, bg)
  const black = contrastRatio(0, bg)
  return black > white ? '#000000' : '#ffffff'
}
