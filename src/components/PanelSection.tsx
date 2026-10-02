import React, { useState } from 'react'
import { ChevronRight } from 'lucide-react'

/**
 * A collapsible group inside a side panel.
 *
 * The drawing panel renders 77 controls flat in a single scrolling column,
 * which is more than anyone can scan at a glance -- every control competes
 * with every other one for attention, and the ones you actually want are
 * always somewhere down the scroll. Grouping them into sections that start
 * collapsed (or open, where they are the point of the panel) puts the outline
 * back on screen and lets the user open only the part they are working in.
 *
 * `defaultOpen` is evaluated once on mount; after that the user's choice wins.
 */
export interface PanelSectionProps {
  title: string
  /** Short right-aligned summary shown in the header, e.g. a count. */
  hint?: string
  defaultOpen?: boolean
  /** Rendered even while collapsed — use for status banners. */
  alwaysVisible?: React.ReactNode
  children: React.ReactNode
  testId?: string
}

export const PanelSection: React.FC<PanelSectionProps> = ({
  title,
  hint,
  defaultOpen = false,
  alwaysVisible,
  children,
  testId,
}) => {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section
      data-testid={testId ? `panel-section-${testId}` : undefined}
      className="border border-ink-800 rounded-lg overflow-hidden"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={testId ? `panel-section-body-${testId}` : undefined}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 bg-ink-850 hover:bg-ink-800 transition-colors text-left min-h-[24px]"
      >
        <ChevronRight
          size={12}
          aria-hidden="true"
          className={`shrink-0 text-ink-400 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-300 flex-1 truncate">
          {title}
        </span>
        {hint ? (
          <span className="text-[10px] text-ink-500 font-mono shrink-0">{hint}</span>
        ) : null}
      </button>

      {alwaysVisible ? <div className="px-2 pt-2">{alwaysVisible}</div> : null}

      {open ? (
        <div
          id={testId ? `panel-section-body-${testId}` : undefined}
          className="px-2 py-2 flex flex-col gap-3"
        >
          {children}
        </div>
      ) : null}
    </section>
  )
}

export default PanelSection
