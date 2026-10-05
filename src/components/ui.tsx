import { useEffect, useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { NestedSectionContext, sectionIdFor, useSectionsNav, useIsNestedSection } from './SectionsNav'

export function IconButton({
  active,
  onClick,
  title,
  children,
  disabled,
  className = '',
}: {
  active?: boolean
  onClick?: () => void
  title?: string
  children?: ReactNode
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onClick={onClick}
      className={[
        'grid place-items-center h-8 w-8 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900',
        active ? 'bg-brand text-white' : 'text-ink-400 hover:text-white hover:bg-ink-700',
        disabled ? 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-ink-400' : '',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export interface SegOption<T extends string | number> {
  value: T
  label: ReactNode
  title?: string
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: SegOption<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={`inline-flex rounded-md bg-ink-800 p-0.5 border border-ink-700 ${className}`}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.title}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={[
            'px-2.5 h-7 rounded text-xs font-medium transition-colors',
            o.value === value ? 'bg-brand text-white' : 'text-ink-400 hover:text-white',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  className = '',
  label,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  className?: string
  /** Accessible name. Every slider should pass one -- without it a screen
   *  reader announces only "slider". */
  label?: string
}) {
  return (
    <input
      type="range"
      aria-label={label}
      className={`of-range w-full ${className}`}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
  )
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-ink-400 text-xs shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">{children}</div>
    </div>
  )
}

export function Section({
  title,
  children,
  collapsible = true,
  defaultOpen = true,
  badge,
  action,
}: {
  title: string
  children: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  badge?: ReactNode
  action?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const headerId = useId()
  const bodyId = useId()
  const navCtx = useSectionsNav()
  const nested = useIsNestedSection()
  const nav = nested ? null : navCtx
  const navId = sectionIdFor(undefined, title)
  const headerTestId = `section-header-${navId}`

  // Depend on the stable register/unregister callbacks, NOT the whole nav
  // object (its identity changes with activeId/sections and would re-run
  // registration forever).
  const registerSection = nav?.register
  const unregisterSection = nav?.unregister
  useEffect(() => {
    if (!registerSection || !collapsible) return
    registerSection(navId, { title, defaultOpen })
    return () => unregisterSection?.(navId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerSection, unregisterSection, navId, collapsible, title, defaultOpen])

  // Inside a SectionsNavigator: 'tabs' renders only the active section (the
  // tab chip replaces the header); 'accordion' is single-open.
  if (nav && collapsible) {
    const isActive = nav.activeId === navId
    if (nav.mode === 'tabs') {
      if (!isActive) return null
      return (
        <section aria-labelledby={headerId} className="px-3 pb-3 pt-1">
          <div id={headerId} data-testid={headerTestId} className="flex min-h-8 items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-ink-300">{title}</span>
              {badge}
            </span>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
          <div id={bodyId} aria-labelledby={headerId}>
            <NestedSectionContext.Provider value={true}>{children}</NestedSectionContext.Provider>
          </div>
        </section>
      )
    }
    return (
      <section aria-labelledby={headerId} className="border-b border-ink-800">
        <div className="flex items-center justify-between gap-2 px-3 py-0.5">
          <button
            id={headerId}
            type="button"
            data-testid={headerTestId}
            aria-expanded={isActive}
            aria-controls={isActive ? bodyId : undefined}
            onClick={() => nav.activate(navId)}
            className="flex min-h-8 min-w-0 flex-1 items-center rounded text-left transition-colors hover:bg-ink-800/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
          >
            <span className="flex min-w-0 items-center gap-1.5 text-left">
              <ChevronDown
                size={13}
                aria-hidden="true"
                className={`shrink-0 text-ink-400 transition-transform duration-150 ${isActive ? '' : '-rotate-90'}`}
              />
              <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-ink-300">
                {title}
              </span>
              {badge}
            </span>
          </button>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        {isActive ? (
          <div id={bodyId} aria-labelledby={headerId} className="px-3 pb-3 pt-0.5">
            <NestedSectionContext.Provider value={true}>{children}</NestedSectionContext.Provider>
          </div>
        ) : null}
      </section>
    )
  }

  const heading = (
    <span className="flex min-w-0 items-center gap-1.5 text-left">
      {collapsible && (
        <ChevronDown
          size={13}
          aria-hidden="true"
          className={`shrink-0 text-ink-400 transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
        />
      )}
      <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-ink-300">
        {title}
      </span>
      {badge}
    </span>
  )

  return (
    <section aria-labelledby={headerId} className="border-b border-ink-800">
      <div className="flex items-center justify-between gap-2 px-3 py-0.5">
        {collapsible ? (
          <button
            id={headerId}
            type="button"
            data-testid={headerTestId}
            aria-expanded={open}
            aria-controls={open ? bodyId : undefined}
            onClick={() => setOpen((value) => !value)}
            className="flex min-h-8 min-w-0 flex-1 items-center rounded text-left transition-colors hover:bg-ink-800/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
          >
            {heading}
          </button>
        ) : (
          <div id={headerId} data-testid={headerTestId} className="flex min-h-8 min-w-0 flex-1 items-center">
            {heading}
          </div>
        )}
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {open ? (
        <div id={bodyId} aria-labelledby={headerId} className="px-3 pb-3 pt-0.5">
          <NestedSectionContext.Provider value={true}>{children}</NestedSectionContext.Provider>
        </div>
      ) : null}
    </section>
  )
}

export function AccordionGroup({
  title,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  badge?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()
  const triggerId = `${bodyId}-trigger`
  return (
    <section aria-labelledby={triggerId} className="mt-2 overflow-hidden rounded-lg border border-ink-800 bg-ink-900/40">
      <button
        id={triggerId}
        type="button"
        data-testid={`accordion-${title.toLowerCase().replace(/\s+/g, '-')}`}
        aria-expanded={open}
        aria-controls={open ? bodyId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-8 w-full items-center justify-between px-2.5 py-1.5 text-left text-xs font-medium text-ink-300 transition-colors hover:bg-ink-800/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
      >
        <div className="flex items-center gap-1.5">
          <ChevronDown
            size={12}
            aria-hidden="true"
            className={`text-ink-500 transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
          />
          <span className="text-[11px] font-semibold">{title}</span>
          {badge}
        </div>
      </button>
      {open && (
        <div id={bodyId} aria-labelledby={triggerId} className="space-y-1.5 border-t border-ink-800 p-2">
          {children}
        </div>
      )}
    </section>
  )
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="p-4 text-ink-400 text-xs leading-relaxed">{children}</div>
  )
}
