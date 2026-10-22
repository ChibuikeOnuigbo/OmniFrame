import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Segment carousel — the pattern from the user's sketch
 * (Study_edits_videos/ui-patterns/segment-carousel-ref.png):
 * a square LEFT arrow button, one wide segment view (every segment renders at
 * the same size in the same box), a square RIGHT arrow button. Arrows cycle
 * with wrap-around. Used instead of stuffing many controls into one tool.
 */
export default function SegmentCarousel({
  segments,
  value,
  onChange,
  ariaLabel,
  testId = 'segment-carousel',
}: {
  segments: Array<{ id: string; label: string }>
  value: string
  onChange: (id: string) => void
  ariaLabel: string
  testId?: string
}) {
  const idx = Math.max(0, segments.findIndex((s) => s.id === value))
  const current = segments[idx] || segments[0]
  const step = (dir: 1 | -1) => {
    const next = (idx + dir + segments.length) % segments.length
    onChange(segments[next].id)
  }
  return (
    <div data-testid={testId} className="flex items-stretch gap-1" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        data-testid={`${testId}-left`}
        aria-label={`${ariaLabel}: previous`}
        onClick={() => step(-1)}
        className="grid w-9 shrink-0 place-items-center rounded border border-ink-700 bg-ink-900 text-ink-300 hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <ChevronLeft size={14} />
      </button>
      <div
        data-testid={`${testId}-label`}
        title={current?.label}
        className="grid flex-1 place-items-center rounded border border-ink-700 bg-ink-950 px-2 py-1.5 text-center text-[10px] leading-tight text-ink-200"
      >
        <span className="line-clamp-2">{current?.label || '—'}</span>
      </div>
      <button
        type="button"
        data-testid={`${testId}-right`}
        aria-label={`${ariaLabel}: next`}
        onClick={() => step(1)}
        className="grid w-9 shrink-0 place-items-center rounded border border-ink-700 bg-ink-900 text-ink-300 hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  )
}
