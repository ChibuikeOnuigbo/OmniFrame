import type { ReactNode } from 'react'

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
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  className?: string
}) {
  return (
    <input
      type="range"
      className={`of-range w-full ${className}`}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-ink-400 text-xs shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">{children}</div>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="px-3 py-3 border-b border-ink-800">
      <div className="text-[11px] uppercase tracking-wider text-ink-400 mb-2 font-semibold">
        {title}
      </div>
      {children}
    </div>
  )
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="p-4 text-ink-400 text-xs leading-relaxed">{children}</div>
  )
}
