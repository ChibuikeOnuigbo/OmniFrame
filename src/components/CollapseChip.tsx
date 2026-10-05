/**
 * CollapseChip — the editor-wide collapse affordance.
 *
 * A small square − / + button: − collapses an open section, + brings a
 * collapsed one back. One consistent glyph pair everywhere (panel sections,
 * preview control clusters, floating windows) so the UI reads the same way
 * in every corner of the editor, instead of a different chevron dialect per
 * area. Sized to stay clickable without shouting (20px hit area, 12px glyph).
 */

import { Minus, Plus } from 'lucide-react'

export function CollapseChip({
  open,
  onToggle,
  label,
  testId,
  compact = false,
}: {
  /** true = section currently expanded (shows −); false = collapsed (shows +) */
  open: boolean
  onToggle: () => void
  /** used for the aria-label / tooltip: "Preview controls", "Transform", ... */
  label: string
  testId?: string
  /** compact = 18px chip for very tight rows */
  compact?: boolean
}) {
  const Icon = open ? Minus : Plus
  return (
    <button
      type="button"
      data-testid={testId}
      aria-expanded={open}
      aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
      title={`${open ? 'Collapse' : 'Expand'} ${label} (−/+ toggle)`}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={`grid shrink-0 place-items-center rounded-md border border-ink-700 bg-ink-800/90 text-ink-300 transition-all hover:border-ink-600 hover:bg-ink-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:scale-95 ${
        compact ? 'h-[18px] w-[18px]' : 'h-5 w-5'
      }`}
    >
      <Icon size={compact ? 11 : 12} strokeWidth={2.4} aria-hidden="true" />
    </button>
  )
}

/**
 * The pure glyph variant for use INSIDE another button (a header that is
 * itself the toggle) — a nested <button> would be invalid, so this renders
 * the same −/+ visual as a span.
 */
export function CollapseGlyph({ open, className = '' }: { open: boolean; className?: string }) {
  const Icon = open ? Minus : Plus
  return (
    <span
      aria-hidden="true"
      className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border border-ink-700/80 bg-ink-800/70 text-ink-300 transition-colors group-hover:border-ink-600 group-hover:text-white ${className}`}
    >
      <Icon size={11} strokeWidth={2.4} />
    </span>
  )
}
