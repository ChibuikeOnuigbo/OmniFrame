import type { SidebarSectionMode } from '../types'
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { HScrollStrip } from './HScrollStrip'

/**
 * Sections navigation: one system, two presentations.
 *
 * Side panels group their controls into collapsible sections (PanelSection /
 * ui.Section). Rendered flat, every section competes for vertical space and
 * the panel becomes an endless scroll. SectionsNavigator turns the same
 * sections into either:
 *
 *  - 'tabs' (default): a compact tab list at the top of the panel; exactly one
 *    tab panel (the active section) is rendered at a time. Minimal scrolling,
 *    minimal noise.
 *  - 'accordion': classic stacked disclosure headers, but single-open —
 *    expanding one section collapses the others, so the outline stays neat.
 *
 * Sections register themselves through context; no panel restructuring is
 * needed beyond mounting the provider around the panel body.
 */

interface SectionMeta {
  id: string
  title: string
  hint?: string
}

interface SectionsNavContextValue {
  mode: SidebarSectionMode
  sections: SectionMeta[]
  activeId: string | null
  activate: (id: string) => void
  register: (id: string, meta: { title: string; hint?: string; defaultOpen?: boolean }) => void
  unregister: (id: string) => void
}

const SectionsNavContext = createContext<SectionsNavContextValue | null>(null)

/**
 * True inside a rendered section body. Sections nested within another section
 * never join the navigator (their parent already gates rendering); they keep
 * their classic independent disclosure instead.
 */
export const NestedSectionContext = createContext(false)

export function useSectionsNav(): SectionsNavContextValue | null {
  return useContext(SectionsNavContext)
}

export function useIsNestedSection(): boolean {
  return useContext(NestedSectionContext)
}

const slug = (title: string) => title.toLowerCase().replace(/\s+/g, '-')

export interface SectionRailItem {
  id: string
  label: string
  icon: React.ComponentType<{ size?: number | string; className?: string }>
}

export function SectionsNavigator({
  mode,
  children,
  label = 'Panel sections',
  rail,
  focusRequest,
}: {
  mode: SidebarSectionMode
  children: React.ReactNode
  label?: string
  /**
   * Programmatic focus: when the app adds/selects an effect it auto-opens
   * the connected section here (store.rightFocus → {id, nonce}).
   */
  focusRequest?: { id: string; nonce: number } | null
  /**
   * "General" sections lifted out of the horizontal tab train into a
   * vertical icon rail pinned to the panel's right edge (inspector pattern:
   * General / Transform / Mask / Audio as icons; everything else keeps the
   * scrolling train on top). Rail buttons keep the section-tab testids.
   */
  rail?: SectionRailItem[]
}) {
  const [sections, setSections] = useState<SectionMeta[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  // Whether the user (or a test) has picked a section yet — initial active
  // otherwise prefers the first section marked defaultOpen.
  const touched = useRef(false)

  const register = useCallback((id: string, meta: { title: string; hint?: string; defaultOpen?: boolean }) => {
    // Re-registering (e.g. a hint change on a mounted section) updates the
    // meta in place — it must NOT reorder the strip or disturb the active id.
    setSections((prev) =>
      prev.some((s) => s.id === id)
        ? prev.map((s) => (s.id === id ? { ...s, title: meta.title, hint: meta.hint } : s))
        : [...prev, { id, title: meta.title, hint: meta.hint }],
    )
    if (meta.defaultOpen && !touched.current) {
      setActiveId((cur) => {
        // Only claim the initial slot if nothing was picked yet.
        if (cur === null || cur === id) return id
        return cur
      })
    }
  }, [])

  const unregister = useCallback((id: string) => {
    setSections((prev) => (prev.some((s) => s.id === id) ? prev.filter((s) => s.id !== id) : prev))
    setActiveId((cur) => (cur === id ? null : cur))
  }, [])

  const activate = useCallback((id: string) => {
    touched.current = true
    // In accordion mode, clicking the open header collapses it (− → closed),
    // so the user can fold every section away; + on a closed one reopens it.
    setActiveId((cur) => (mode === 'accordion' && cur === id ? null : id))
  }, [mode])

  // First registered section wins the initial active slot.
  useEffect(() => {
    setActiveId((cur) => cur ?? sections[0]?.id ?? null)
  }, [sections])

  // Auto-open the connected section when the store requests focus (e.g. an
  // effect was dropped on a clip → show its settings immediately).
  const focusNonce = focusRequest?.nonce
  useEffect(() => {
    if (focusRequest && focusRequest.id) {
      touched.current = true
      setActiveId(focusRequest.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce])

  // Keyboard arrow navigation across the tab list.
  const onTablistKeyDown = (e: React.KeyboardEvent) => {
    if (sections.length < 2) return
    const idx = sections.findIndex((s) => s.id === activeId)
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % sections.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + sections.length) % sections.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = sections.length - 1
    if (next >= 0) {
      e.preventDefault()
      const id = sections[next].id
      activate(id)
      document.querySelector<HTMLElement>(`[data-testid="section-tab-${CSS.escape(id)}"]`)?.focus()
    }
  }

  const value = useMemo(
    () => ({ mode, sections, activeId, activate, register, unregister }),
    [mode, sections, activeId, activate, register, unregister],
  )

  const railIds = useMemo(() => new Set((rail ?? []).map((r) => r.id)), [rail])
  const railSections = useMemo(
    () =>
      (rail ?? [])
        .map((r) => ({ def: r, meta: sections.find((s) => s.id === r.id) }))
        .filter((x): x is { def: SectionRailItem; meta: SectionMeta } => Boolean(x.meta)),
    [rail, sections],
  )
  const stripSections = useMemo(() => sections.filter((s) => !railIds.has(s.id)), [sections, railIds])
  const showStrip = mode === 'tabs' && (railSections.length > 0 ? stripSections.length > 0 : sections.length > 1)
  const showRail = mode === 'tabs' && railSections.length > 0

  const strip = showStrip ? (
    <HScrollStrip
      role="tablist"
      aria-label={label}
      data-testid="sections-tablist"
      arrowTestIdPrefix="sections"
      onKeyDown={onTablistKeyDown}
      className="shrink-0 border-b border-ink-800 bg-ink-900/70 px-1.5 py-1"
      innerClassName=""
    >
      {stripSections.map((s) => {
        const selected = s.id === activeId
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={selected}
            data-testid={`section-tab-${s.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => activate(s.id)}
            className={`min-h-7 shrink-0 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              selected
                ? 'border-brand bg-brand/25 text-white shadow-xs'
                : 'border-ink-700 bg-ink-850 text-ink-300 hover:bg-ink-800 hover:text-ink-100'
            }`}
          >
            {s.title}
            {s.hint ? <span className="ml-1.5 font-mono text-[9px] text-ink-400">{s.hint}</span> : null}
          </button>
        )
      })}
    </HScrollStrip>
  ) : null

  return (
    <SectionsNavContext.Provider value={value}>
      <div className="flex min-h-0 flex-1 flex-row">
        <div className="flex min-w-0 min-h-0 flex-1 flex-col">
          {strip}
          {children}
        </div>
        {showRail && (
          <div
            role="tablist"
            aria-orientation="vertical"
            aria-label={`${label} — general`}
            data-testid="sections-icon-rail"
            onKeyDown={onTablistKeyDown}
            className="flex w-10 shrink-0 flex-col items-center gap-1 border-l border-ink-800 bg-ink-900/70 py-1.5"
          >
            {railSections.map(({ def }) => {
              const selected = def.id === activeId
              const Icon = def.icon
              return (
                <button
                  key={def.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-label={`${def.label} section`}
                  title={`${def.label} section`}
                  data-testid={`section-tab-${def.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => activate(def.id)}
                  className={`grid h-8 w-8 place-items-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    selected
                      ? 'border-brand bg-brand/25 text-white shadow-xs'
                      : 'border-transparent text-ink-400 hover:bg-ink-800 hover:text-ink-100'
                  }`}
                >
                  <Icon size={15} />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </SectionsNavContext.Provider>
  )
}

/** Stable section id for PanelSection / Section consumers. */
export function sectionIdFor(testId: string | undefined, title: string): string {
  return testId ?? slug(title)
}
