import type { TemplateDefinition } from '../types'

export const BUILTIN_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'tmpl-cinematic-intro',
    name: 'Cinematic Title Intro',
    description: 'Dramatic opening sequence with title card, letterboxing, and sound fx slot.',
    slots: [
      { id: 'slot-video-1', name: 'Cinematic B-Roll', type: 'video', required: true, durationConstraint: 5 },
      { id: 'slot-title-1', name: 'Main Film Title', type: 'text', required: true },
      { id: 'slot-sub-1', name: 'Subtitle / Director', type: 'text', required: false },
      { id: 'slot-audio-1', name: 'Atmospheric Bed', type: 'audio', required: false },
    ],
  },
  {
    id: 'tmpl-social-reel',
    name: 'Dynamic 9:16 Reel Hook',
    description: 'Fast-paced vertical video template with kinetic title and bottom call to action.',
    slots: [
      { id: 'slot-video-hook', name: 'Hook Footage', type: 'video', required: true, durationConstraint: 3 },
      { id: 'slot-logo-badge', name: 'Channel Avatar / Logo', type: 'image', required: false },
      { id: 'slot-hook-text', name: 'Hook Headline', type: 'text', required: true },
      { id: 'slot-music-beat', name: 'Trending Audio Track', type: 'audio', required: true },
    ],
  },
  {
    id: 'tmpl-instagram-portrait',
    name: 'Instagram 3:4 Showcase',
    description: 'Optimized for 2026 Instagram profile grid standard with upper frame title.',
    slots: [
      { id: 'slot-hero-video', name: 'Feature Showcase', type: 'video', required: true, durationConstraint: 10 },
      { id: 'slot-brand-mark', name: 'Watermark / Badge', type: 'image', required: false },
      { id: 'slot-caption', name: 'Caption Banner', type: 'text', required: true },
    ],
  },
  {
    id: 'tmpl-split-comparison',
    name: 'Split Screen Comparison',
    description: 'Dual footage comparison with side-by-side synchronized playback.',
    slots: [
      { id: 'slot-left-video', name: 'Before / Angle A', type: 'video', required: true },
      { id: 'slot-right-video', name: 'After / Angle B', type: 'video', required: true },
      { id: 'slot-center-label', name: 'Comparison Label', type: 'text', required: false },
    ],
  },
]
