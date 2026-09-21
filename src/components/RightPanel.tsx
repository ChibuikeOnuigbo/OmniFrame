import { PanelRightClose, PanelRightOpen, Trash2, Scissors, AudioLines } from 'lucide-react'
import { useEditor } from '../store'
import type { Clip } from '../types'
import { Field, Section, Slider } from './ui'
import { formatClock } from '../lib/time'

function ClipInspector({ clip }: { clip: Clip }) {
  const assets = useEditor((s) => s.assets)
  const setClipProp = useEditor((s) => s.setClipProp)
  const setClipTransform = useEditor((s) => s.setClipTransform)
  const removeClip = useEditor((s) => s.removeClip)
  const splitAt = useEditor((s) => s.splitAt)
  const extractAudio = useEditor((s) => s.extractAudio)
  const asset = assets.find((a) => a.id === clip.assetId)
  const t = clip.transform

  return (
    <div>
      <Section title="Clip">
        <div className="flex items-center justify-between gap-2">
          <input
            value={clip.name}
            onChange={(e) => setClipProp(clip.id, { name: e.target.value })}
            className="bg-ink-800 border border-ink-700 rounded px-2 h-7 text-xs text-ink-100 outline-none focus:border-brand w-full"
          />
        </div>
        <div className="text-[10px] text-ink-500 mt-1">
          {asset?.kind} · {formatClock(clip.duration)} on track
        </div>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => splitAt(useEditor.getState().playhead)}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md bg-ink-800 border border-ink-700 text-xs hover:bg-ink-700"
          >
            <Scissors size={13} /> Split
          </button>
          <button
            type="button"
            onClick={() => removeClip(clip.id)}
            className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-ink-800 border border-ink-700 text-xs text-bad hover:bg-ink-700"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
        {clip.kind === 'video' && !assets.some((item) => item.extractedFromClipId === clip.id) && (
          <button
            type="button"
            onClick={() => void extractAudio(clip.id)}
            className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-ink-700 bg-ink-800 text-xs hover:bg-ink-700"
          >
            <AudioLines size={13} /> Extract audio
          </button>
        )}
      </Section>

      <Section title="Transform">
        <Field label="Position X">
          <Slider min={-960} max={960} value={t.x} onChange={(v) => setClipTransform(clip.id, { x: v })} />
          <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.x)}</span>
        </Field>
        <Field label="Position Y">
          <Slider min={-540} max={540} value={t.y} onChange={(v) => setClipTransform(clip.id, { y: v })} />
          <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.y)}</span>
        </Field>
        <Field label="Scale">
          <Slider min={0.1} max={3} step={0.01} value={t.scale} onChange={(v) => setClipTransform(clip.id, { scale: v })} />
          <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{t.scale.toFixed(2)}</span>
        </Field>
        <Field label="Rotation">
          <Slider min={-180} max={180} value={t.rotation} onChange={(v) => setClipTransform(clip.id, { rotation: v })} />
          <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.rotation)}°</span>
        </Field>
        <Field label="Opacity">
          <Slider min={0} max={1} step={0.01} value={t.opacity} onChange={(v) => setClipTransform(clip.id, { opacity: v })} />
          <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(t.opacity * 100)}</span>
        </Field>
      </Section>

      {clip.kind === 'audio' && (
        <Section title="Audio">
          <Field label="Volume">
            <Slider min={0} max={1} step={0.01} value={clip.volume} onChange={(v) => setClipProp(clip.id, { volume: v })} />
            <span className="w-9 text-right text-[11px] text-ink-400 tabular-nums">{Math.round(clip.volume * 100)}</span>
          </Field>
        </Section>
      )}

      <Section title="Source">
        <Field label="In point">
          <span className="text-[11px] text-ink-300 tabular-nums">{formatClock(clip.inPoint)}</span>
        </Field>
        <Field label="Duration">
          <span className="text-[11px] text-ink-300 tabular-nums">{formatClock(clip.duration)}</span>
        </Field>
      </Section>
    </div>
  )
}

function ProjectInspector() {
  return (
    <div>
      <Section title="Project">
        <Field label="Resolution">
          <span className="text-[11px] text-ink-300">1920 × 1080</span>
        </Field>
        <Field label="Frame rate">
          <span className="text-[11px] text-ink-300">30 fps</span>
        </Field>
      </Section>
      <Section title="Tips">
        <ul className="text-[11px] text-ink-400 leading-relaxed list-disc pl-4 space-y-1">
          <li>Drag a file anywhere to import.</li>
          <li>Click a clip to select it, then edit here.</li>
          <li>Drag clip edges to trim, body to move.</li>
          <li>Blade tool or Split to cut at the playhead.</li>
          <li>Scroll the timeline to zoom time.</li>
        </ul>
      </Section>
    </div>
  )
}

export function RightPanel() {
  const rightOpen = useEditor((s) => s.rightOpen)
  const setRightOpen = useEditor((s) => s.setRightOpen)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const clip = useEditor((s) => s.clips.find((c) => c.id === s.selectedClipId) ?? null)

  return (
    <div className="shrink-0 flex h-full bg-ink-900 border-l border-ink-700">
      {rightOpen && (
        <div className="w-72 shrink-0 bg-ink-850 flex flex-col h-full">
          <div className="h-9 shrink-0 flex items-center px-3 border-b border-ink-700 text-xs font-semibold uppercase tracking-wider text-ink-300">
            {selectedClipId ? 'Clip' : 'Inspector'}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {clip ? <ClipInspector clip={clip} /> : <ProjectInspector />}
          </div>
        </div>
      )}
      <div className="w-9 shrink-0 border-l border-ink-700 flex flex-col items-center pt-2">
        <button
          type="button"
          title={rightOpen ? 'Hide inspector' : 'Show inspector'}
          aria-label={rightOpen ? 'Hide inspector' : 'Show inspector'}
          aria-expanded={rightOpen}
          onClick={() => setRightOpen(!rightOpen)}
          className="grid place-items-center h-8 w-8 rounded-md text-ink-400 hover:text-white hover:bg-ink-700"
        >
          {rightOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </button>
      </div>
    </div>
  )
}
