import type {
  TemplateBackdropStyle,
  TemplateCategory,
  TemplateDefinition,
  TemplateMotionPreset,
  TemplateSlot,
  TemplateSlotType,
} from '../types'

/**
 * Original OmniFrame Motion Lab recipes.
 *
 * These editable compositions use OmniFrame primitives. They contain no
 * third-party project files, previews, or copied assets. The broad catalogue
 * covers common motion-design jobs with OmniFrame-owned names and styling.
 */

interface Family {
  id: string
  name: string
  category: TemplateCategory
  description: string
  duration: number
  aspect: TemplateDefinition['aspect']
  backdrop: TemplateBackdropStyle
  slots: Array<{ name: string; type: TemplateSlotType; required?: boolean; content?: string }>
  tags: string[]
}

interface StyleVariant {
  id: string
  name: string
  palette: [string, string, string]
  motion: TemplateMotionPreset
  backdrop?: TemplateBackdropStyle
}

const FAMILIES: Family[] = [
  { id: 'kinetic-title', name: 'Kinetic Title', category: 'Titles', description: 'Layered headline and supporting copy with editable entrance timing.', duration: 5, aspect: '16:9', backdrop: 'gradient', tags: ['text', 'title', 'kinetic'], slots: [{ name: 'Headline', type: 'text', required: true, content: 'MAKE IT MOVE' }, { name: 'Supporting line', type: 'text', content: 'Editable motion design' }] },
  { id: 'logo-reveal', name: 'Logo Reveal', category: 'Brand', description: 'Logo or mark reveal with a concise brand line.', duration: 4, aspect: '16:9', backdrop: 'rays', tags: ['logo', 'brand', 'reveal'], slots: [{ name: 'Brand mark', type: 'logo', required: true }, { name: 'Brand line', type: 'text', content: 'YOUR BRAND' }] },
  { id: 'lower-third', name: 'Lower Third', category: 'Lower thirds', description: 'Name and role package positioned for interviews and explainers.', duration: 6, aspect: '16:9', backdrop: 'glass', tags: ['name', 'caption', 'interview'], slots: [{ name: 'Name', type: 'text', required: true, content: 'ALEX MORGAN' }, { name: 'Role', type: 'text', content: 'CREATIVE DIRECTOR' }] },
  { id: 'data-story', name: 'Data Story', category: 'Data', description: 'A headline, value and source line for charts and statistics.', duration: 7, aspect: '16:9', backdrop: 'grid', tags: ['chart', 'counter', 'statistics'], slots: [{ name: 'Metric', type: 'text', required: true, content: '84%' }, { name: 'Insight', type: 'text', content: 'GROWTH THIS QUARTER' }, { name: 'Source', type: 'text', content: 'SOURCE · 2026' }] },
  { id: 'process-flow', name: 'Process Flow', category: 'Diagrams', description: 'Three editable steps for product and learning videos.', duration: 8, aspect: '16:9', backdrop: 'paper', tags: ['steps', 'diagram', 'workflow'], slots: [{ name: 'Step one', type: 'text', required: true, content: '01 · DISCOVER' }, { name: 'Step two', type: 'text', content: '02 · DESIGN' }, { name: 'Step three', type: 'text', content: '03 · DELIVER' }] },
  { id: 'route-story', name: 'Route Story', category: 'Maps', description: 'Location-led story with origin, destination and route media.', duration: 8, aspect: '16:9', backdrop: 'grid', tags: ['map', 'route', 'travel'], slots: [{ name: 'Map or place image', type: 'image', required: true }, { name: 'Origin', type: 'text', content: 'START' }, { name: 'Destination', type: 'text', content: 'DESTINATION' }] },
  { id: 'product-spot', name: 'Product Spotlight', category: 'Product', description: 'Hero media, product name and concise benefit copy.', duration: 7, aspect: '4:5', backdrop: 'rays', tags: ['product', 'promo', 'advert'], slots: [{ name: 'Product media', type: 'image', required: true }, { name: 'Product name', type: 'text', content: 'NEW FORM' }, { name: 'Benefit', type: 'text', content: 'BUILT FOR EVERY DAY' }] },
  { id: 'device-demo', name: 'Device Demo', category: 'Devices', description: 'Screen media and caption staged as a device presentation.', duration: 7, aspect: '16:9', backdrop: 'glass', tags: ['phone', 'laptop', 'mockup'], slots: [{ name: 'Screen recording', type: 'video', required: true }, { name: 'Feature title', type: 'text', content: 'MEET THE WORKFLOW' }] },
  { id: 'social-hook', name: 'Social Hook', category: 'Social', description: 'Fast vertical opener with hook, proof and call to action.', duration: 6, aspect: '9:16', backdrop: 'split', tags: ['reel', 'short', 'vertical'], slots: [{ name: 'Hook media', type: 'video', required: true }, { name: 'Hook', type: 'text', content: 'STOP SCROLLING' }, { name: 'Call to action', type: 'text', content: 'WATCH THIS' }, { name: 'Beat', type: 'audio' }] },
  { id: 'news-card', name: 'News Card', category: 'News', description: 'Headline, location and supporting media for updates.', duration: 7, aspect: '16:9', backdrop: 'split', tags: ['news', 'headline', 'update'], slots: [{ name: 'Story image', type: 'image' }, { name: 'Headline', type: 'text', required: true, content: 'THE STORY NOW' }, { name: 'Location', type: 'text', content: 'LIVE · CITY' }] },
  { id: 'countdown', name: 'Countdown', category: 'Countdowns', description: 'Bold count and event message with beat-ready motion.', duration: 5, aspect: '1:1', backdrop: 'rings', tags: ['timer', 'count', 'launch'], slots: [{ name: 'Count', type: 'text', required: true, content: '03 · 02 · 01' }, { name: 'Event', type: 'text', content: 'START NOW' }] },
  { id: 'photo-story', name: 'Photo Story', category: 'Photos', description: 'Editorial image sequence with title and caption.', duration: 9, aspect: '4:5', backdrop: 'paper', tags: ['photo', 'gallery', 'editorial'], slots: [{ name: 'Feature photo', type: 'image', required: true }, { name: 'Story title', type: 'text', content: 'A MOMENT IN TIME' }, { name: 'Caption', type: 'text', content: 'YOUR CAPTION HERE' }] },
  { id: 'ui-walkthrough', name: 'UI Walkthrough', category: 'UI demos', description: 'Screen capture, feature label and focused callout.', duration: 8, aspect: '16:9', backdrop: 'grid', tags: ['app', 'screen', 'tutorial'], slots: [{ name: 'Screen capture', type: 'video', required: true }, { name: 'Feature', type: 'text', content: 'ONE CLEAR WORKFLOW' }, { name: 'Callout', type: 'text', content: 'CLICK · CREATE · SHARE' }] },
  { id: 'abstract-loop', name: 'Abstract Loop', category: 'Backgrounds', description: 'Loop-ready color field for titles and music edits.', duration: 6, aspect: '16:9', backdrop: 'noise', tags: ['loop', 'abstract', 'background'], slots: [{ name: 'Overlay title', type: 'text', content: 'IN MOTION' }, { name: 'Music', type: 'audio' }] },
  { id: 'music-card', name: 'Music Card', category: 'Music', description: 'Artwork, track title and artist information.', duration: 10, aspect: '1:1', backdrop: 'rings', tags: ['audio', 'visualizer', 'album'], slots: [{ name: 'Artwork', type: 'image', required: true }, { name: 'Track title', type: 'text', content: 'MIDNIGHT SIGNAL' }, { name: 'Artist', type: 'text', content: 'ARTIST NAME' }, { name: 'Track', type: 'audio', required: true }] },
  { id: 'comparison', name: 'Comparison Board', category: 'Comparisons', description: 'Two media slots with clear labels and a verdict.', duration: 8, aspect: '16:9', backdrop: 'split', tags: ['before', 'after', 'versus'], slots: [{ name: 'Option A', type: 'image', required: true }, { name: 'Option B', type: 'image', required: true }, { name: 'Left label', type: 'text', content: 'BEFORE' }, { name: 'Right label', type: 'text', content: 'AFTER' }] },
  { id: 'feature-stack', name: 'Feature Stack', category: 'Product', description: 'Four concise product benefits with a media anchor.', duration: 8, aspect: '16:9', backdrop: 'glass', tags: ['features', 'saas', 'launch'], slots: [{ name: 'Product media', type: 'video' }, { name: 'Headline', type: 'text', content: 'EVERYTHING IN ONE PLACE' }, { name: 'Feature one', type: 'text', content: 'FAST' }, { name: 'Feature two', type: 'text', content: 'FOCUSED' }] },
]

const STYLES: StyleVariant[] = [
  { id: 'ember', name: 'Ember', palette: ['#ff5a36', '#ffb45e', '#20102f'], motion: 'pop', backdrop: 'rays' },
  { id: 'glacier', name: 'Glacier', palette: ['#22d3ee', '#60a5fa', '#0a1630'], motion: 'slide', backdrop: 'grid' },
  { id: 'aurora', name: 'Aurora', palette: ['#34d399', '#a78bfa', '#071c24'], motion: 'drift', backdrop: 'gradient' },
  { id: 'mono', name: 'Mono', palette: ['#f8fafc', '#94a3b8', '#09090b'], motion: 'fade-rise', backdrop: 'noise' },
  { id: 'neon', name: 'Neon', palette: ['#f0abfc', '#22d3ee', '#140623'], motion: 'pulse', backdrop: 'rings' },
  { id: 'paper', name: 'Paper', palette: ['#111827', '#ef4444', '#f5f0e8'], motion: 'stagger', backdrop: 'paper' },
  { id: 'glass', name: 'Glass', palette: ['#e0f2fe', '#818cf8', '#111827'], motion: 'flip', backdrop: 'glass' },
  { id: 'citrus', name: 'Citrus', palette: ['#facc15', '#fb7185', '#172554'], motion: 'swing', backdrop: 'split' },
  { id: 'violet', name: 'Violet', palette: ['#c084fc', '#6366f1', '#160c2f'], motion: 'zoom', backdrop: 'gradient' },
  { id: 'ocean', name: 'Ocean', palette: ['#2dd4bf', '#38bdf8', '#082f49'], motion: 'wipe', backdrop: 'grid' },
  { id: 'rose', name: 'Rose', palette: ['#fb7185', '#fda4af', '#3f0d24'], motion: 'orbit', backdrop: 'rings' },
  { id: 'studio', name: 'Studio', palette: ['#ffffff', '#ff6b35', '#12151d'], motion: 'typewriter', backdrop: 'glass' },
]

function slotsFor(family: Family, variant: StyleVariant): TemplateSlot[] {
  return family.slots.map((slot, index) => ({
    id: `slot-${family.id}-${variant.id}-${index + 1}`,
    name: slot.name,
    type: slot.type,
    required: slot.required ?? false,
    defaultContent: slot.content,
    durationConstraint: slot.type === 'audio' ? family.duration : undefined,
  }))
}

export const MOTION_LAB_TEMPLATES: TemplateDefinition[] = FAMILIES
  .flatMap((family) => STYLES.map((variant) => ({
    id: `motion-lab-${family.id}-${variant.id}`,
    name: `${family.name} · ${variant.name}`,
    description: family.description,
    category: family.category,
    tags: [...family.tags, variant.id, variant.motion],
    duration: family.duration,
    aspect: family.aspect,
    palette: variant.palette,
    motion: variant.motion,
    backdrop: variant.backdrop ?? family.backdrop,
    origin: 'omniframe-original' as const,
    slots: slotsFor(family, variant),
  })))
  .slice(0, 201)

const LEGACY_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'tmpl-cinematic-intro', name: 'Cinematic Title Intro', category: 'Titles', origin: 'legacy', aspect: '16:9', duration: 5,
    description: 'Dramatic opening sequence with title card, letterboxing, and sound fx slot.',
    slots: [
      { id: 'slot-video-1', name: 'Cinematic B-Roll', type: 'video', required: true, durationConstraint: 5 },
      { id: 'slot-title-1', name: 'Main Film Title', type: 'text', required: true, defaultContent: 'MAIN FILM TITLE' },
      { id: 'slot-sub-1', name: 'Subtitle / Director', type: 'text', required: false, defaultContent: 'A FILM BY YOU' },
      { id: 'slot-audio-1', name: 'Atmospheric Bed', type: 'audio', required: false },
    ],
  },
  {
    id: 'tmpl-social-reel', name: 'Dynamic 9:16 Reel Hook', category: 'Social', origin: 'legacy', aspect: '9:16', duration: 6,
    description: 'Fast-paced vertical video template with kinetic title and bottom call to action.',
    slots: [
      { id: 'slot-video-hook', name: 'Hook Footage', type: 'video', required: true, durationConstraint: 3 },
      { id: 'slot-logo-badge', name: 'Channel Avatar / Logo', type: 'image', required: false },
      { id: 'slot-hook-text', name: 'Hook Headline', type: 'text', required: true, defaultContent: 'WATCH THIS' },
      { id: 'slot-music-beat', name: 'Trending Audio Track', type: 'audio', required: true },
    ],
  },
  {
    id: 'tmpl-instagram-portrait', name: 'Instagram 4:5 Showcase', category: 'Social', origin: 'legacy', aspect: '4:5', duration: 10,
    description: 'Portrait showcase with upper-frame title and a replaceable brand mark.',
    slots: [
      { id: 'slot-hero-video', name: 'Feature Showcase', type: 'video', required: true, durationConstraint: 10 },
      { id: 'slot-brand-mark', name: 'Watermark / Badge', type: 'image', required: false },
      { id: 'slot-caption', name: 'Caption Banner', type: 'text', required: true, defaultContent: 'FEATURE SHOWCASE' },
    ],
  },
  {
    id: 'tmpl-split-comparison', name: 'Split Screen Comparison', category: 'Comparisons', origin: 'legacy', aspect: '16:9', duration: 8,
    description: 'Dual footage comparison with side-by-side synchronized playback.',
    slots: [
      { id: 'slot-left-video', name: 'Before / Angle A', type: 'video', required: true },
      { id: 'slot-right-video', name: 'After / Angle B', type: 'video', required: true },
      { id: 'slot-center-label', name: 'Comparison Label', type: 'text', required: false, defaultContent: 'BEFORE / AFTER' },
    ],
  },
]

export const BUILTIN_TEMPLATES: TemplateDefinition[] = [...MOTION_LAB_TEMPLATES, ...LEGACY_TEMPLATES]

export const TEMPLATE_CATEGORIES: TemplateCategory[] = Array.from(
  new Set(MOTION_LAB_TEMPLATES.map((template) => template.category).filter(Boolean)),
) as TemplateCategory[]

export function searchTemplates(query: string, category: 'All' | TemplateCategory = 'All'): TemplateDefinition[] {
  const needle = query.trim().toLowerCase()
  return BUILTIN_TEMPLATES.filter((template) => {
    if (category !== 'All' && template.category !== category) return false
    if (!needle) return true
    return [template.name, template.description, template.category, ...(template.tags ?? [])]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle))
  })
}
