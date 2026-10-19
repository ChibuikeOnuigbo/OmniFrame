/**
 * UI style system (Settings → Appearance). Five interface styles that change
 * the STRUCTURE/feel of the studio — corner language, density, panel depth,
 * grouping — not just a colour swap, plus three accent palettes and the
 * light/dark theme carried by the Daylight style. Derived from the UI study
 * in data.md (Krita / CapCut / the 85-screenshot corpus statistics).
 * Styles are applied as html[data-ui-style] / html[data-ui-palette]
 * attributes; the actual rules live in index.css.
 */
export interface UiStyleDef {
  id: string
  name: string
  concept: string
  swatch: [string, string, string] // panel, surface, accent
}

export const UI_STYLES: UiStyleDef[] = [
  {
    id: 'omniframe',
    name: 'OmniFrame',
    concept: 'The house look — deep ink panels, violet brand, balanced radius and density.',
    swatch: ['#0c0e13', '#232a39', '#6d5efc'],
  },
  {
    id: 'capcut',
    name: 'Clean Cut',
    concept: 'CapCut study: lifted charcoal panels, big rounded cards, pill buttons, airy grouping.',
    swatch: ['#17181c', '#26282f', '#00c2c2'],
  },
  {
    id: 'krita',
    name: 'Workshop',
    concept: 'Krita study: warm neutral grays, near-square corners, dense docker-style controls.',
    swatch: ['#2e2e30', '#454548', '#e07b39'],
  },
  {
    id: 'premiere',
    name: 'Pro Blue',
    concept: 'NLE study: blue-gray panel stack, crisp 4px corners, engineering-blue accents.',
    swatch: ['#1d1f24', '#343842', '#3f8cff'],
  },
  {
    id: 'daylight',
    name: 'Daylight',
    concept: 'The light theme: paper surfaces, dark text, soft borders — for bright rooms and print checks.',
    swatch: ['#eef0f4', '#ffffff', '#6d5efc'],
  },
]

export interface UiPaletteDef {
  id: string
  name: string
  accent: string
  note: string
}

export const UI_PALETTES: UiPaletteDef[] = [
  { id: 'violet', name: 'Violet', accent: '#6d5efc', note: 'OmniFrame brand' },
  { id: 'amber', name: 'Amber', accent: '#d97706', note: 'Warm broadcast' },
  { id: 'teal', name: 'Teal', accent: '#0d9488', note: 'Clean Cut energy' },
]

export const uiStyleDef = (id?: string) => UI_STYLES.find((s) => s.id === id) || UI_STYLES[0]
export const uiPaletteDef = (id?: string) => UI_PALETTES.find((s) => s.id === id) || UI_PALETTES[0]
