import React from 'react'
import { X, BookOpen } from 'lucide-react'
import { useEditor } from '../store'

/**
 * Help — Tutorials & Info. All explanatory prose that used to clutter the
 * panels lives HERE now (user direction: panels are for pros; help goes
 * in one docker). Open via the ? button in the panel header or the
 * right-click context menu → "Tutorial & Info".
 */
export const HELP_ENTRIES: { id: string; title: string; body: string }[] = [
  { id: 'temporary-previews', title: 'Temporary previews', body: 'Clicking a visual effect, transition, title or pack item previews it over the timeline without committing anything. Apply in the monitor to make it a real clip. Nothing is silently added to your timeline.' },
  { id: 'titles', title: 'Titles: preview, then apply', body: 'Text tools preview the title over the timeline first; Apply in the monitor adds the title clip at the playhead. Select a title clip later to restyle it in the Text panel.' },
  { id: 'preset-text-mapping', title: 'Text presets & character counts', body: 'Presets are procedures, not recordings: stagger, settles and waves key off each letter\u2019s normalized position u = i/(n\u22121), so any text length works. The character/word spacing caps keep text inside the frame: cap = (1766 \u2212 measured text width) \u00f7 (letters \u2212 1). Full maths in animation_study.md.' },
  { id: 'watermark-levels', title: 'Watermark Studio levels', body: 'Levels 1\u20136 follow the CapCut tutorial ladder (fade text \u2192 character + chroma \u2192 pixel stretch \u2192 part animation \u2192 logo \u2192 free splice/lighten). Everything is editable clips \u2014 keyframes, graphs, effects \u2014 never a baked render. Green-screen footage: Effects \u2192 Chroma Key.' },
  { id: 'lut-placement', title: 'LUTs & adjustment layers', body: 'An adjustment/LUT layer grades only the clips below it on the timeline. Drag one inside a compound clip to grade just that nest. Import your own .cube files and tweak intensity per layer.' },
  { id: 'layer-vs-clip', title: 'Layer effects vs clip effects', body: 'Clip controls stay scoped to the selected clip; a timeline effect layer grades the composite below it. Click an effect layer to audition it from its start before keeping it.' },
  { id: 'light-layers', title: 'Light layers', body: 'Light layers are screen-blended radial light over everything beneath them. Feather and intensity shape the falloff; place inside compounds to light a single nest.' },
  { id: 'tool-finder', title: 'Finding tools fast', body: 'Search the tool finder by task or feature \u2014 try \u201cvoice isolation\u201d, \u201cLUT\u201d, \u201cdrawing\u201d or \u201c3D\u201d. Sub-modes (icon chips under a tool) keep long studios one click away without stacking panels.' },
  { id: 'brief-files', title: 'Scene brief files', body: 'Briefs are plain JSON (title, captions, format, duration, backdrop, style). OmniFrame builds them into editable titles, captions, pack layers, trims and keyframes \u2014 no locked renders.' },
  { id: 'pack-overlays', title: 'Pack overlays & bundles', body: 'Overlays land at the playhead on their own layer \u2014 trim or stretch like any clip. Bundles stack a whole scene (window + cursor + highlights) in one click. Open the Pack Browser (Desktop Pack \u2192 Open Pack Browser) for the Explorer view with search, folders and tags.' },
  { id: 'demo-assets', title: 'Demo assets', body: 'The Media Library starts empty \u2014 import your own media. The OmniFrame region tool has two demo loaders (Room Chair, Death Note Chibi) that add their demo asset only when you click them.' },
]

export function HelpModal() {
  const helpOpen = useEditor((s) => s.helpOpen)
  const setHelpOpen = useEditor((s) => s.setHelpOpen)
  if (!helpOpen) return null
  return (
    <div data-testid="help-modal" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setHelpOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Help — tutorials and info"
        className="flex max-h-[88vh] w-[min(680px,94vw)] flex-col overflow-hidden rounded-xl border border-ink-600 bg-ink-950 shadow-[0_32px_120px_rgba(0,0,0,.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-white"><BookOpen size={16} className="text-brand-400" /> Tutorial & Info</span>
          <button type="button" data-testid="help-close-btn" onClick={() => setHelpOpen(false)} className="grid h-7 w-7 place-items-center rounded text-ink-400 hover:bg-ink-800 hover:text-white" aria-label="Close help">
            <X size={15} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {HELP_ENTRIES.map((e) => (
            <article key={e.id} data-testid={`help-entry-${e.id}`} className="rounded-lg border border-ink-800 bg-ink-900/60 px-3 py-2.5">
              <h3 className="text-xs font-semibold text-ink-100">{e.title}</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-400">{e.body}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
