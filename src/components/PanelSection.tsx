import React, { useEffect, useId, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { NestedSectionContext, sectionIdFor, useSectionsNav, useIsNestedSection } from './SectionsNav'

/**
 * A collapsible group inside a side panel.
 *
 * The drawing panel renders 77 controls flat in a single scrolling column,
 * which is more than anyone can scan at a glance -- every control competes
 * with every other one for attention, and the ones you actually want are
 * always somewhere down the scroll. Grouping them into sections that start
 * collapsed (or open, where they are the point of the panel) puts the outline
 * back on screen and lets the user open only the part you are working in.
 *
 * `defaultOpen` is evaluated once on mount; after that the user's choice wins.
 *
 * Inside a <SectionsNavigator> the section additionally participates in the
 * panel-wide navigation: 'tabs' mode renders only the active section's body
 * (the tab chip replaces the header), 'accordion' mode keeps the headers but
 * is single-open (expanding one section collapses the others).
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
  const navCtx = useSectionsNav()
  const nested = useIsNestedSection()
  // Nested sections (a section inside another section's body) stay standalone.
  const nav = nested ? null : navCtx
  const id = sectionIdFor(testId, title)
  const [standaloneOpen, setStandaloneOpen] = useState(defaultOpen)
  const reactId = useId()
  const triggerId = `panel-section-trigger-${testId ?? reactId}`
  const bodyId = `panel-section-body-${testId ?? reactId}`

  // Depend on the stable register/unregister callbacks, NOT the whole nav
  // object (its identity changes with activeId/sections and would re-run
  // registration forever).
  const registerSection = nav?.register
  const unregisterSection = nav?.unregister
  useEffect(() => {
    if (!registerSection) return
    registerSection(id, { title, hint, defaultOpen })
    return () => unregisterSection?.(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerSection, unregisterSection, id, title, hint, defaultOpen])

  // ---- SectionsNavigator modes ----
  if (nav) {
    const isActive = nav.activeId === id
    if (nav.mode === 'tabs') {
      // Tab panel: only the active section renders; the tab chip is the header.
      if (!isActive) return null
      return (
        <section
          data-testid={testId ? `panel-section-${testId}` : undefined}
          aria-labelledby={triggerId}
          className="flex flex-col gap-3 px-2.5 py-2.5"
        >
          <div id={triggerId} className="sr-only">{title}</div>
          {alwaysVisible}
          <NestedSectionContext.Provider value={true}>
            <div className="flex flex-col gap-3">{children}</div>
          </NestedSectionContext.Provider>
        </section>
      )
    }
    // Accordion mode: stacked headers, single-open.
    return (
      <section
        data-testid={testId ? `panel-section-${testId}` : undefined}
        aria-labelledby={triggerId}
        className="overflow-hidden rounded-lg border border-ink-800 bg-ink-950/20"
      >
        <button
          id={triggerId}
          type="button"
          aria-expanded={isActive}
          aria-controls={isActive ? bodyId : undefined}
          onClick={() => nav.activate(id)}
          className="group w-full flex min-h-8 items-center gap-2 px-2.5 py-1.5 bg-ink-850 text-left transition-colors hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
        >
          <ChevronRight
            size={14}
            aria-hidden="true"
            className={`shrink-0 text-ink-400 transition-transform ${isActive ? 'rotate-90' : ''}`}
          />
          <span className="flex-1 truncate text-[11px] font-semibold uppercase tracking-wider text-ink-200">
            {title}
          </span>
          {hint ? (
            <span className="shrink-0 font-mono text-[10px] text-ink-400">{hint}</span>
          ) : null}
        </button>
        {alwaysVisible ? <div className="px-2.5 pt-2">{alwaysVisible}</div> : null}
        {isActive ? (
          <div id={bodyId} className="flex flex-col gap-3 border-t border-ink-800/80 px-2.5 py-2.5">
            <NestedSectionContext.Provider value={true}>{children}</NestedSectionContext.Provider>
          </div>
        ) : null}
      </section>
    )
  }

  // ---- Standalone (no navigator): original independent behavior ----
  const open = standaloneOpen
  return (
    <section
      data-testid={testId ? `panel-section-${testId}` : undefined}
      aria-labelledby={triggerId}
      className="overflow-hidden rounded-lg border border-ink-800 bg-ink-950/20"
    >
      <button
        id={triggerId}
        type="button"
        aria-expanded={open}
        aria-controls={open ? bodyId : undefined}
        onClick={() => setStandaloneOpen((v) => !v)}
        className="group w-full flex min-h-8 items-center gap-2 px-2.5 py-1.5 bg-ink-850 text-left transition-colors hover:bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
      >
        <ChevronRight
          size={14}
          aria-hidden="true"
          className={`shrink-0 text-ink-400 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <span className="flex-1 truncate text-[11px] font-semibold uppercase tracking-wider text-ink-200">
          {title}
        </span>
        {hint ? (
          <span className="shrink-0 font-mono text-[10px] text-ink-400">{hint}</span>
        ) : null}
      </button>

      {alwaysVisible ? <div className="px-2.5 pt-2">{alwaysVisible}</div> : null}

      {open ? (
        <div
          id={bodyId}
          className="flex flex-col gap-3 border-t border-ink-800/80 px-2.5 py-2.5"
        >
          <NestedSectionContext.Provider value={true}>{children}</NestedSectionContext.Provider>
        </div>
      ) : null}
    </section>
  )
}

export default PanelSection
