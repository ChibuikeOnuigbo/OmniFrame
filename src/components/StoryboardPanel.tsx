import { useMemo } from 'react'
import { Clapperboard, Film, Image as ImageIcon, Type, Brush, Layers, Wand2, FolderOpen } from 'lucide-react'
import { useEditor } from '../store'
import type { Clip } from '../types'

/**
 * Storyboard (Krita Storyboard-docker model + Hyperframes "plan the plan"):
 * one card per timeline shot, in playback order, with a per-shot note saved
 * on the clip itself. Planning surface only — notes never render into output.
 */

const KIND_META: Record<string, { label: string; color: string; Icon: typeof Film }> = {
  video: { label: 'Video', color: '#38bdf8', Icon: Film },
  image: { label: 'Image', color: '#a78bfa', Icon: ImageIcon },
  text: { label: 'Text', color: '#f472b6', Icon: Type },
  drawing: { label: 'Drawing', color: '#facc15', Icon: Brush },
  compound: { label: 'Compound', color: '#34d399', Icon: Layers },
  adjustment: { label: 'Adjustment', color: '#fbbf24', Icon: Wand2 },
}

function fmt(t: number): string {
  const clamped = Math.max(0, t)
  const m = Math.floor(clamped / 60)
  const s = Math.floor(clamped % 60)
  const d = Math.floor((clamped % 1) * 10)
  return `${m}:${String(s).padStart(2, '0')}.${d}`
}

export function StoryboardPanel() {
  const clips = useEditor((s) => s.clips)
  const tracks = useEditor((s) => s.tracks)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const selectClip = useEditor((s) => s.selectClip)
  const setPlayhead = useEditor((s) => s.setPlayhead)
  const setClipNotes = useEditor((s) => s.setClipNotes)
  const openSequence = useEditor((s) => s.openSequence)

  const shots = useMemo(() => {
    const order = new Map(tracks.map((t, i) => [t.id, i]))
    return clips
      .filter((c) => c.kind !== 'audio')
      .slice()
      .sort((a, b) => a.start - b.start || (order.get(a.trackId) ?? 99) - (order.get(b.trackId) ?? 99))
  }, [clips, tracks])

  const total = shots.reduce((m, c) => Math.max(m, c.start + c.duration), 0)
  const trackName = (id: string) => tracks.find((t) => t.id === id)?.name ?? 'Track'

  const jumpTo = (clip: Clip) => {
    selectClip(clip.id)
    setPlayhead(clip.start)
  }

  return (
    <div data-testid="storyboard-panel" className="flex h-full flex-col text-xs text-ink-200">
      <div className="border-b border-ink-800 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-300">
          <Clapperboard size={12} /> Storyboard
        </div>
        <p className="mt-1 text-[10px] leading-snug text-ink-400">
          Plan the whole edit first: one card per shot in timeline order. Notes live on the clips and never
          render into exports.
        </p>
        <p className="mt-1 font-mono text-[9px] text-ink-500" data-testid="storyboard-summary">
          {shots.length} shots · {fmt(total)} total
        </p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-2.5 py-2.5">
        {shots.length === 0 && (
          <div
            className="rounded-md border border-dashed border-ink-800 p-3 text-center text-[10px] leading-snug text-ink-400"
            data-testid="storyboard-empty"
          >
            No shots yet. Add clips to the timeline and they will appear here as storyboard cards.
          </div>
        )}
        {shots.map((clip, i) => {
          const meta = KIND_META[clip.kind] ?? KIND_META.video
          const selected = clip.id === selectedClipId
          return (
            <article
              key={clip.id}
              data-testid={`storyboard-card-${clip.id}`}
              className={`overflow-hidden rounded-md border transition-colors ${
                selected ? 'border-brand/70 bg-brand/10' : 'border-ink-800 bg-ink-950/50 hover:border-ink-600'
              }`}
            >
              <button
                type="button"
                onClick={() => jumpTo(clip)}
                className="flex w-full items-stretch gap-0 text-left"
                title="Select this shot and move the playhead to it"
              >
                <span className="w-1.5 shrink-0" style={{ background: meta.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1 px-2 py-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="rounded bg-ink-800 px-1 font-mono text-[9px] font-semibold text-ink-200">
                      S{i + 1}
                    </span>
                    <meta.Icon size={11} style={{ color: meta.color }} className="shrink-0" />
                    <span className="truncate text-[11px] font-medium text-ink-100">{clip.name}</span>
                  </span>
                  <span className="mt-0.5 block font-mono text-[9px] text-ink-500">
                    {fmt(clip.start)} → {fmt(clip.start + clip.duration)} · {clip.duration.toFixed(1)}s ·{' '}
                    {trackName(clip.trackId)}
                    {clip.kind === 'compound' && clip.nestedClipCount != null
                      ? ` · ${clip.nestedClipCount} nested`
                      : ''}
                  </span>
                </span>
              </button>
              <div className="px-2 pb-2">
                <textarea
                  data-testid={`storyboard-note-${clip.id}`}
                  value={clip.notes ?? ''}
                  onChange={(e) => setClipNotes(clip.id, e.target.value)}
                  placeholder="Shot note — intent, dialogue, camera…"
                  rows={2}
                  className="w-full resize-none rounded border border-ink-800 bg-ink-900/70 px-1.5 py-1 text-[10px] leading-snug text-ink-200 placeholder:text-ink-600 focus:border-brand/60 focus:outline-none"
                />
                {clip.kind === 'compound' && clip.sourceSequenceId && (
                  <button
                    type="button"
                    data-testid={`storyboard-open-${clip.id}`}
                    onClick={() => openSequence(clip.sourceSequenceId!)}
                    className="mt-1 flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-300 hover:bg-emerald-500/20"
                  >
                    <FolderOpen size={10} /> Open nested sequence
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
