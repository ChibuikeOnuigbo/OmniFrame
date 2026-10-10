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

export function SectionsNavigator({
  mode,
  children,
  label = 'Panel sections',
}: {
  mode: SidebarSectionMode
  children: React.ReactNode
  label?: string
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

  const showStrip = mode === 'tabs' && sections.length > 1

  return (
    <SectionsNavContext.Provider value={value}>
      <div className="flex min-h-0 flex-1 flex-col">
        {showStrip && (
          <div
            role="tablist"
            aria-label={label}
            data-testid="sections-tablist"
            onKeyDown={onTablistKeyDown}
            className="flex flex-wrap items-center gap-1 border-b border-ink-800 bg-ink-900/70 px-2 py-1.5 shrink-0"
          >
            {sections.map((s) => {
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
                  className={`min-h-7 max-w-full truncate rounded-full border px-2.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
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
          </div>
        )}
        {children}
      </div>
    </SectionsNavContext.Provider>
  )
}

/** Stable section id for PanelSection / Section consumers. */
export function sectionIdFor(testId: string | undefined, title: string): string {
  return testId ?? slug(title)
}
