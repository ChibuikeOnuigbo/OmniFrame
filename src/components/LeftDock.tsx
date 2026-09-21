import {
  Clapperboard,
  Music,
  Type,
  Wand2,
  Shuffle,
  LayoutTemplate,
  Brush,
  Crosshair,
  Layers,
  Box,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEditor, type LeftTab } from '../store'
import { MediaPanel } from './MediaPanel'

interface TabDef {
  id: LeftTab
  label: string
  icon: LucideIcon
}

const TABS: TabDef[] = [
  { id: 'media', label: 'Media', icon: Clapperboard },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'effects', label: 'Effects', icon: Wand2 },
  { id: 'transitions', label: 'Transitions', icon: Shuffle },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'masks', label: 'Masks', icon: Brush },
  { id: 'tracking', label: 'Tracking', icon: Crosshair },
  { id: 'omniframe', label: 'Omniframe', icon: Layers },
  { id: 'threed', label: '3D', icon: Box },
]

function PlannedPanel({ title, note }: { title: string; note: string }) {
  return (
    <div className="p-4 text-xs text-ink-400 leading-relaxed">
      <div className="text-ink-200 font-medium mb-1">{title}</div>
      {note}
    </div>
  )
}

export function LeftDock() {
  const leftTab = useEditor((s) => s.leftTab)
  const leftOpen = useEditor((s) => s.leftOpen)
  const setLeftTab = useEditor((s) => s.setLeftTab)
  const setLeftOpen = useEditor((s) => s.setLeftOpen)

  return (
    <div className="flex shrink-0 h-full">
      {/* icon rail — always visible so options are never hidden */}
      <div className="w-12 shrink-0 bg-ink-900 border-r border-ink-700 flex flex-col items-center py-2 gap-1">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = leftTab === t.id && leftOpen
          return (
            <button
              key={t.id}
              type="button"
              title={t.label}
              aria-pressed={active}
              onClick={() => {
                if (leftTab === t.id && leftOpen) setLeftOpen(false)
                else setLeftTab(t.id)
              }}
              className={[
                'grid place-items-center h-9 w-9 rounded-md transition-colors',
                active
                  ? 'bg-brand text-white'
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
        className={[
          'shrink-0 bg-ink-850 border-r border-ink-700 overflow-hidden transition-[width] duration-150',
          leftOpen ? 'w-[232px]' : 'w-0',
        ].join(' ')}
      >
        <div className="w-[232px] h-full flex flex-col">
          <div className="h-9 shrink-0 flex items-center justify-between px-3 border-b border-ink-700">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-300">
              {TABS.find((t) => t.id === leftTab)?.label}
            </span>
            <button
              type="button"
              title="Collapse"
              onClick={() => setLeftOpen(false)}
              className="grid place-items-center h-7 w-7 rounded text-ink-400 hover:text-white hover:bg-ink-700"
            >
              <X size={15} />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {leftTab === 'media' && <MediaPanel kind="all" />}
            {leftTab === 'audio' && <MediaPanel kind="audio" />}
            {leftTab === 'text' && (
              <PlannedPanel title="Text & titles" note="Rich text, presets and per-letter animation are part of the next phase. Timeline editing, trimming, splitting and export are working now." />
            )}
            {leftTab === 'effects' && (
              <PlannedPanel title="Effects" note="An extensible effect registry (blur, color, stylize, composite) is scaffolded in the architecture. The first effects ship in the next phase." />
            )}
            {leftTab === 'transitions' && (
              <PlannedPanel title="Transitions" note="Cut, crossfade, dip, wipe, slide and 3D pushes will plug into the same render graph used by the preview." />
            )}
            {leftTab === 'templates' && (
              <PlannedPanel title="Templates" note="Typed template slots (video / image / 3D / text) with validation are specified and will be implemented next." />
            )}
            {leftTab === 'masks' && (
              <PlannedPanel title="Masking" note="Brush / lasso / magic / flood-fill masking with per-frame and tracked propagation is a core planned feature." />
            )}
            {leftTab === 'tracking' && (
              <PlannedPanel title="Tracking" note="Point, object, planar and mask tracking with a hybrid optical-flow + segmentation engine is specified and next." />
            )}
            {leftTab === 'omniframe' && (
              <PlannedPanel title="Omniframe" note="The signature cross-frame edit mode (cut/move/fill that propagates through all frames) is specified and next." />
            )}
            {leftTab === 'threed' && (
              <PlannedPanel title="3D / 2.5D" note="GLB/GLTF import, lighting, materials and 3D-to-2D transitions are specified and next." />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
