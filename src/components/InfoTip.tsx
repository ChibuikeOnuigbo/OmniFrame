import { Info } from 'lucide-react'
import { Tooltip } from './Tooltip'

/**
 * Info tip: the "i" affordance that carries explanations so panels can stay
 * icon-first. Text lives here (and in tooltips), not as big in-panel copy.
 */
export function InfoTip({ label, testId }: { label: string; testId?: string }) {
  return (
    <Tooltip label={label}>
      <span
        data-testid={testId}
        role="img"
        aria-label={label}
        className="inline-grid h-4 w-4 shrink-0 cursor-help place-items-center rounded-full text-ink-500 transition-colors hover:text-brand-300"
      >
        <Info size={12} />
      </span>
    </Tooltip>
  )
}
