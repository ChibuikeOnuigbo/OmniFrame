import {
  LibraryBig,
  Palette,
  Type,
  Wand2,
  Shuffle,
  Box,
  Volume2,
  Target,
  Link2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEditor, type LeftTab } from '../store'
import { MediaPanel } from './MediaPanel'
import { VoiceIsolationPanel } from './VoiceIsolationPanel'
import { DrawingPanel } from './DrawingPanel'
import { TrackingPanel } from './TrackingPanel'
import { LinkPanel } from './LinkPanel'
import { TransitionsPanel } from './TransitionsPanel'
import { EffectsPanel } from './EffectsPanel'
import { TextPanel } from './TextPanel'
import { ThreePanel } from './ThreePanel'

interface TabDef {
  id: LeftTab
  label: string
  icon: LucideIcon
}

const TABS: TabDef[] = [
  { id: 'media', label: 'Media Library', icon: LibraryBig },
  { id: 'audio', label: 'Audio', icon: Volume2 },
  { id: 'tracking', label: 'Masking & Tracking', icon: Target },
  { id: 'relationships', label: 'Link & Groups', icon: Link2 },
  { id: 'drawing', label: 'Drawing & Paint', icon: Palette },
  { id: 'transitions', label: 'Transitions', icon: Shuffle },
  { id: 'effects', label: 'Effects', icon: Wand2 },
  { id: 'text', label: 'Text & Titles', icon: Type },
  { id: 'threed', label: '3D Scene', icon: Box },
]

export function LeftDock() {
  const leftTab = useEditor((s) => s.leftTab)
  const leftOpen = useEditor((s) => s.leftOpen)
  const setLeftTab = useEditor((s) => s.setLeftTab)
  const setLeftOpen = useEditor((s) => s.setLeftOpen)
  const leftDockWidth = useEditor((s) => s.leftDockWidth)

  return (
    <div className="flex shrink-0 h-full">
      {/* icon rail */}
      <div className="w-12 shrink-0 bg-ink-900 border-r border-ink-700 flex flex-col items-center py-2 gap-1 overflow-y-auto">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = leftTab === t.id && leftOpen
          return (
            <button
              key={t.id}
              type="button"
              data-testid={`left-tab-${t.id}`}
              title={t.label}
              aria-label={t.label}
              aria-pressed={active}
              onClick={() => {
                if (leftTab === t.id && leftOpen) setLeftOpen(false)
                else {
                  setLeftTab(t.id)
                  setLeftOpen(true)
                }
              }}
              className={[
                'grid place-items-center h-9 w-9 rounded-md transition-colors shrink-0',
                active
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-ink-400 hover:text-white hover:bg-ink-700',
              ].join(' ')}
            >
              <Icon size={18} />
            </button>
          )
        })}
      </div>

      {/* expandable content panel */}
      <div
        data-testid="left-panel"
        data-open={leftOpen}
        style={{
          width: leftOpen
            ? `${Math.min(leftDockWidth - 48, typeof window !== 'undefined' && window.innerWidth < 640 ? window.innerWidth - 56 : leftDockWidth - 48)}px`
            : '0px',
        }}
        className="shrink-0 bg-ink-850 border-r border-ink-700 overflow-hidden transition-[width] duration-150 max-sm:absolute max-sm:left-12 max-sm:top-0 max-sm:bottom-0 max-sm:z-40 max-sm:shadow-2xl"
      >
        <div
          style={{
            width: `${Math.min(leftDockWidth - 48, typeof window !== 'undefined' && window.innerWidth < 640 ? window.innerWidth - 56 : leftDockWidth - 48)}px`,
          }}
          className="h-full flex flex-col"
        >
          <div className="h-9 shrink-0 flex items-center justify-between px-3 border-b border-ink-700">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-300">
              {TABS.find((t) => t.id === leftTab)?.label}
            </span>
            <button
              type="button"
              title="Collapse"
              aria-label="Collapse panel"
              onClick={() => setLeftOpen(false)}
              className="grid place-items-center h-7 w-7 rounded text-ink-400 hover:text-white hover:bg-ink-700"
            >
              <X size={15} />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {leftTab === 'media' && <MediaPanel />}
            {leftTab === 'audio' && <VoiceIsolationPanel />}
            {leftTab === 'tracking' && <TrackingPanel />}
            {leftTab === 'relationships' && <LinkPanel />}
            {leftTab === 'drawing' && <DrawingPanel />}
            {leftTab === 'transitions' && <TransitionsPanel />}
            {leftTab === 'effects' && <EffectsPanel />}
            {leftTab === 'text' && <TextPanel />}
            {leftTab === 'threed' && <ThreePanel />}
          </div>
        </div>
      </div>
    </div>
  )
}
