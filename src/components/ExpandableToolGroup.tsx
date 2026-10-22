import { useState, type ReactNode } from 'react'
import { ChevronDown, type LucideIcon } from 'lucide-react'

/**
 * Expandable main tool with connected sub-tools underneath — the user's
 * second requested pattern: instead of one tile hiding many features, the
 * main tool shows a down arrow; opening it reveals the connected sub-tools
 * indented under it (connector line), each a real control of its own.
 */
export default function ExpandableToolGroup({
  icon: Icon,
  label,
  children,
  testId,
  defaultOpen = false,
}: {
  icon: LucideIcon
  label: string
  children: ReactNode
  testId: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div data-testid={`${testId}-group`} className="space-y-1">
      <button
        type="button"
        data-testid={`${testId}-toggle`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-8 w-full items-center gap-2 rounded border px-2 text-left text-[10px] font-semibold uppercase tracking-wider transition-colors ${
          open ? 'border-sky-600/60 bg-sky-500/10 text-sky-200' : 'border-ink-700 bg-ink-900 text-ink-400 hover:text-white'
        }`}
      >
        <Icon size={13} className="shrink-0" />
        <span className="flex-1 truncate">{label}</span>
        <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div data-testid={`${testId}-subtools`} className="ml-3 space-y-2 border-l border-ink-700 pl-3">
          {children}
        </div>
      )}
    </div>
  )
}
