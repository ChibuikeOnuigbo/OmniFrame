import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

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
        'grid place-items-center h-8 w-8 rounded-md transition-colors',
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
  return (
    <div className="border-b border-ink-800">
      <div
        data-testid={`section-header-${title.toLowerCase().replace(/\s+/g, '-')}`}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? open : undefined}
        onClick={collapsible ? () => setOpen(!open) : undefined}
        onKeyDown={collapsible ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open) } } : undefined}
        className={`px-3 py-2.5 flex items-center justify-between select-none ${
          collapsible ? 'cursor-pointer hover:bg-ink-800/50 transition-colors' : ''
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {collapsible && (
            <ChevronDown
              size={13}
              className={`text-ink-400 shrink-0 transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
            />
          )}
          <span className="text-[11px] uppercase tracking-wider text-ink-300 font-semibold truncate">
            {title}
          </span>
          {badge}
        </div>
        {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
      </div>
      {open && <div className="px-3 pb-3 pt-0.5">{children}</div>}
    </div>
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
  return (
    <div className="mt-2 rounded-lg border border-ink-800 bg-ink-900/40 overflow-hidden">
      <button
        type="button"
        data-testid={`accordion-${title.toLowerCase().replace(/\s+/g, '-')}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="w-full px-2.5 py-1.5 flex items-center justify-between text-left text-xs font-medium text-ink-300 hover:text-white hover:bg-ink-800/60 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <ChevronDown
            size={12}
            className={`text-ink-500 transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
          />
          <span className="text-[11px] font-semibold">{title}</span>
          {badge}
        </div>
        <span className="text-[10px] text-ink-500">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && <div className="p-2 border-t border-ink-800 space-y-1.5">{children}</div>}
    </div>
  )
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="p-4 text-ink-400 text-xs leading-relaxed">{children}</div>
  )
}
