import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  Clock3,
  Film,
  Image as ImageIcon,
  LayoutTemplate,
  Music,
  Search,
  Sparkles,
  Type,
  X,
} from 'lucide-react'
import { useEditor } from '../store'
import { BUILTIN_TEMPLATES, MOTION_LAB_TEMPLATES, TEMPLATE_CATEGORIES, searchTemplates } from '../lib/templatePresets'
import type { Clip, TemplateCategory, TemplateDefinition, TemplateMotionPreset, TemplateSlot } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
}

const FALLBACK_PALETTE: [string, string, string] = ['#ff6b35', '#f7b267', '#111827']

function dimensionsFor(template: TemplateDefinition): { width: number; height: number } {
  if (template.aspect === '9:16') return { width: 1080, height: 1920 }
  if (template.aspect === '1:1') return { width: 1080, height: 1080 }
  if (template.aspect === '4:5') return { width: 1080, height: 1350 }
  return { width: 1920, height: 1080 }
}

function backgroundCss(template: TemplateDefinition): string {
  const [a, b, c] = template.palette ?? FALLBACK_PALETTE
  switch (template.backdrop) {
    case 'split': return `linear-gradient(110deg, ${c} 0 48%, ${a} 48% 53%, ${b} 53%)`
    case 'rings': return `radial-gradient(circle at 70% 30%, ${a} 0 8%, transparent 9% 18%, ${b} 19% 24%, transparent 25%), ${c}`
    case 'paper': return `linear-gradient(135deg, ${c}, ${b} 180%)`
    case 'glass': return `linear-gradient(135deg, ${c}, ${a}88, ${b}66)`
    case 'grid': return `linear-gradient(135deg, ${c}, ${a}55), linear-gradient(90deg, ${b}22 1px, transparent 1px)`
    case 'rays': return `conic-gradient(from 220deg at 75% 45%, ${c}, ${a}, ${c}, ${b}, ${c})`
    case 'noise': return `linear-gradient(145deg, ${c}, ${a}88, ${b}55)`
    default: return `linear-gradient(135deg, ${c}, ${a}, ${b})`
  }
}

function backdropSvg(template: TemplateDefinition): { url: string; width: number; height: number } {
  const { width, height } = dimensionsFor(template)
  const [a, b, c] = template.palette ?? FALLBACK_PALETTE
  const pattern = (() => {
    switch (template.backdrop) {
      case 'grid':
        return `<g opacity=".22" stroke="${b}" stroke-width="2"><path d="M0 ${height * .25}H${width}M0 ${height * .5}H${width}M0 ${height * .75}H${width}"/><path d="M${width * .25} 0V${height}M${width * .5} 0V${height}M${width * .75} 0V${height}"/></g>`
      case 'rings':
        return `<g fill="none" stroke="${a}" stroke-width="${Math.max(8, width * .008)}" opacity=".7"><circle cx="${width * .72}" cy="${height * .35}" r="${width * .08}"/><circle cx="${width * .72}" cy="${height * .35}" r="${width * .16}" opacity=".55"/><circle cx="${width * .72}" cy="${height * .35}" r="${width * .25}" opacity=".3"/></g>`
      case 'rays':
        return `<g fill="${a}" opacity=".25" transform="translate(${width * .76} ${height * .42})"><path d="M0 0L${width} -${height * .2}L${width} ${height * .2}Z"/><path d="M0 0L${width * .35} -${height}L${width * .6} -${height}Z"/><path d="M0 0L${width * .35} ${height}L${width * .65} ${height}Z"/></g>`
      case 'paper':
        return `<g fill="${a}" opacity=".12"><path d="M0 ${height * .78}L${width * .32} ${height * .62}L${width * .58} ${height * .8}L${width} ${height * .58}V${height}H0Z"/><circle cx="${width * .82}" cy="${height * .2}" r="${width * .07}"/></g>`
      case 'glass':
        return `<g fill="none" stroke="${b}" stroke-width="3" opacity=".38"><rect x="${width * .08}" y="${height * .12}" width="${width * .48}" height="${height * .7}" rx="48"/><rect x="${width * .48}" y="${height * .28}" width="${width * .42}" height="${height * .55}" rx="48"/></g>`
      case 'split':
        return `<path d="M${width * .5} 0H${width}V${height}H${width * .42}Z" fill="${b}" opacity=".78"/><path d="M${width * .47} 0L${width * .57} 0L${width * .49} ${height}L${width * .39} ${height}Z" fill="${a}"/>`
      case 'noise':
        return `<rect width="100%" height="100%" filter="url(#noise)" opacity=".25"/><path d="M0 ${height * .68}C${width * .2} ${height * .48},${width * .38} ${height * .88},${width * .58} ${height * .62}S${width * .86} ${height * .45},${width} ${height * .7}V${height}H0Z" fill="${a}" opacity=".38"/>`
      default:
        return `<circle cx="${width * .82}" cy="${height * .2}" r="${width * .22}" fill="${a}" opacity=".22"/><circle cx="${width * .12}" cy="${height * .9}" r="${width * .28}" fill="${b}" opacity=".2"/>`
    }
  })()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${c}"/><stop offset=".55" stop-color="${a}" stop-opacity=".6"/><stop offset="1" stop-color="${b}" stop-opacity=".72"/></linearGradient><filter id="noise"><feTurbulence baseFrequency=".72" numOctaves="3" seed="8"/></filter></defs><rect width="100%" height="100%" fill="url(#bg)"/>${pattern}</svg>`
  return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, width, height }
}

function animateClip(clip: Clip, motion: TemplateMotionPreset | undefined, order: number): void {
  const s = useEditor.getState()
  const x = clip.transform.x
  const y = clip.transform.y
  const sx = clip.transform.scaleX ?? clip.transform.scale
  const sy = clip.transform.scaleY ?? clip.transform.scale
  const opacity = clip.transform.opacity
  const enter = 0.46 + Math.min(order, 3) * 0.06
  const key = (property: string, time: number, value: number, interpolation: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'back' = 'ease-out') =>
    s.setClipKeyframe(clip.id, property, time, value, interpolation)

  switch (motion) {
    case 'slide':
    case 'wipe':
      key('position_x', 0, x - 220); key('position_x', enter, x); key('opacity', 0, 0); key('opacity', enter * .8, opacity)
      break
    case 'pop':
      key('scale_x', 0, sx * .38, 'back'); key('scale_x', enter, sx, 'back'); key('scale_y', 0, sy * .38, 'back'); key('scale_y', enter, sy, 'back'); key('opacity', 0, 0); key('opacity', enter * .6, opacity)
      break
    case 'zoom':
      key('scale_x', 0, sx * 1.45); key('scale_x', enter, sx); key('scale_y', 0, sy * 1.45); key('scale_y', enter, sy); key('opacity', 0, 0); key('opacity', enter, opacity)
      break
    case 'flip':
      key('rotation_y', 0, (clip.transform.rotationY ?? 0) - 82); key('rotation_y', enter, clip.transform.rotationY ?? 0); key('opacity', 0, 0); key('opacity', enter * .75, opacity)
      break
    case 'swing':
      key('rotation_z', 0, clip.transform.rotation - 14); key('rotation_z', enter * .45, clip.transform.rotation + 7); key('rotation_z', enter, clip.transform.rotation); key('opacity', 0, 0); key('opacity', enter * .5, opacity)
      break
    case 'pulse':
      key('scale_x', 0, sx * .75, 'back'); key('scale_x', enter * .65, sx * 1.08, 'back'); key('scale_x', enter, sx, 'ease-in-out'); key('scale_y', 0, sy * .75, 'back'); key('scale_y', enter * .65, sy * 1.08, 'back'); key('scale_y', enter, sy, 'ease-in-out')
      break
    case 'orbit':
      key('position_x', 0, x - 90); key('position_y', 0, y + 80); key('rotation_z', 0, clip.transform.rotation - 12); key('position_x', enter, x); key('position_y', enter, y); key('rotation_z', enter, clip.transform.rotation)
      break
    case 'drift':
      key('position_x', 0, x - 34, 'ease-in-out'); key('position_x', clip.duration, x + 34, 'ease-in-out'); key('scale_x', 0, sx); key('scale_x', clip.duration, sx * 1.06); key('scale_y', 0, sy); key('scale_y', clip.duration, sy * 1.06)
      break
    case 'typewriter':
      key('opacity', 0, 0, 'linear'); key('opacity', .12, opacity, 'linear'); key('position_x', 0, x - 18, 'linear'); key('position_x', enter, x, 'linear')
      break
    case 'stagger':
    case 'fade-rise':
    default:
      key('position_y', 0, y + 64); key('position_y', enter, y); key('opacity', 0, 0); key('opacity', enter, opacity)
      break
  }
}

function slotAsset(templateSlot: TemplateSlot, assignments: Record<string, string>): string | undefined {
  const state = useEditor.getState()
  const selected = assignments[templateSlot.id]
  if (selected && state.assets.some((asset) => asset.id === selected)) return selected
  const kind = templateSlot.type === 'logo' ? 'image' : templateSlot.type
  return state.assets.find((asset) => asset.kind === kind)?.id
}

function applyEditableTemplate(template: TemplateDefinition, assignments: Record<string, string>): { clips: number; missing: number } {
  const state = useEditor.getState()
  const start = Math.max(0, state.playhead)
  const duration = template.duration ?? 6
  const palette = template.palette ?? FALLBACK_PALETTE
  state.beginHistory()
  if (template.aspect) state.setSequenceAspectRatio(template.aspect)

  const baseTrack = state.ensureTrack('video')
  const backgroundTrack = state.createTrack('video', 'below', baseTrack)
  const background = backdropSvg(template)
  const backgroundId = `template-bg-${template.id}`
  if (!useEditor.getState().assets.some((asset) => asset.id === backgroundId)) {
    useEditor.getState().addAsset({
      id: backgroundId,
      name: `${template.name} background.svg`,
      kind: 'image',
      url: background.url,
      thumbnail: background.url,
      duration,
      width: background.width,
      height: background.height,
      size: background.url.length,
      attribution: 'Original OmniFrame Motion Lab artwork',
    })
  }
  useEditor.getState().addClipToTrack(backgroundTrack, backgroundId, start)
  const backgroundClipId = useEditor.getState().selectedClipId
  if (backgroundClipId) {
    useEditor.getState().setClipProp(backgroundClipId, { duration, name: `${template.name} · Backdrop` })
    const clip = useEditor.getState().clips.find((item) => item.id === backgroundClipId)
    if (clip) {
      useEditor.getState().setClipKeyframe(clip.id, 'scale_x', 0, 1.02, 'ease-in-out')
      useEditor.getState().setClipKeyframe(clip.id, 'scale_x', duration, 1.1, 'ease-in-out')
      useEditor.getState().setClipKeyframe(clip.id, 'scale_y', 0, 1.02, 'ease-in-out')
      useEditor.getState().setClipKeyframe(clip.id, 'scale_y', duration, 1.1, 'ease-in-out')
    }
  }

  let created = backgroundClipId ? 1 : 0
  let missing = 0
  let visualOrder = 0
  let textOrder = 0

  for (const slot of template.slots) {
    if (slot.type === 'text') {
      const offset = Math.min(duration * .15, textOrder * .12)
      useEditor.getState().setPlayhead(start + offset)
      const content = slot.defaultContent || slot.name
      useEditor.getState().addTextTitleClip(content, Math.max(1, duration - offset))
      const id = useEditor.getState().selectedClipId
      const clip = useEditor.getState().clips.find((item) => item.id === id)
      if (clip) {
        const primary = textOrder === 0
        const low = template.category === 'Lower thirds'
        const y = low ? 260 + textOrder * 72 : -60 + textOrder * 112
        const style = {
          ...clip.textStyle!,
          text: content,
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          fontSize: primary ? 88 : 38,
          color: primary ? palette[0] : palette[1],
          backgroundColor: 'transparent',
          bold: primary,
          letterSpacing: primary ? 2 : 5,
          glowColor: template.backdrop === 'rings' ? palette[0] : undefined,
          glowBlur: template.backdrop === 'rings' ? 18 : 0,
          shadowMode: 'outer' as const,
          shadowColor: '#000000',
          shadowBlur: 12,
          shadowOpacity: .45,
        }
        useEditor.getState().setClipProp(clip.id, {
          name: `${template.name} · ${slot.name}`,
          textStyle: style,
          transform: { ...clip.transform, y, scale: primary ? 1 : .82 },
        })
        const updated = useEditor.getState().clips.find((item) => item.id === clip.id)
        if (updated) animateClip(updated, template.motion, textOrder)
        created++
      }
      textOrder++
      continue
    }

    const assetId = slotAsset(slot, assignments)
    if (!assetId) {
      if (slot.required) missing++
      continue
    }
    const asset = useEditor.getState().assets.find((item) => item.id === assetId)
    if (!asset) continue
    if (slot.type === 'audio') {
      const audioTrack = useEditor.getState().createTrack('audio')
      useEditor.getState().addClipToTrack(audioTrack, assetId, start)
      const id = useEditor.getState().selectedClipId
      if (id) useEditor.getState().setClipProp(id, { duration: Math.min(duration, asset.duration || duration), name: `${template.name} · ${slot.name}` })
      created++
      continue
    }

    const track = useEditor.getState().createTrack('video', 'above', baseTrack)
    useEditor.getState().addClipToTrack(track, assetId, start)
    const id = useEditor.getState().selectedClipId
    const clip = useEditor.getState().clips.find((item) => item.id === id)
    if (clip) {
      const comparison = template.category === 'Comparisons'
      const scale = comparison ? .46 : .72
      const x = comparison ? (visualOrder % 2 === 0 ? -470 : 470) : 310
      useEditor.getState().setClipProp(clip.id, {
        duration: Math.min(duration, asset.duration || duration),
        name: `${template.name} · ${slot.name}`,
        transform: { ...clip.transform, x, y: 50, scale },
        effects: { ...clip.effects, contrast: 1.06, saturation: 1.08 },
      })
      const updated = useEditor.getState().clips.find((item) => item.id === clip.id)
      if (updated) animateClip(updated, template.motion, visualOrder)
      created++
      visualOrder++
    }
  }

  useEditor.getState().setPlayhead(start)
  useEditor.getState().endHistory()
  useEditor.setState({
    mediaImportNotice: `${template.name}: built ${created} editable layers${missing ? ` · ${missing} required media slot${missing === 1 ? '' : 's'} left open` : ''}.`,
  })
  return { clips: created, missing }
}

export function TemplatePickerModal({ isOpen, onClose }: Props) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(MOTION_LAB_TEMPLATES[0].id)
  const [slotAssignments, setSlotAssignments] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'All' | TemplateCategory>('All')
  const assets = useEditor((s) => s.assets)

  const filtered = useMemo(() => searchTemplates(query, category), [query, category])
  const currentTemplate = BUILTIN_TEMPLATES.find((template) => template.id === selectedTemplateId) || filtered[0] || BUILTIN_TEMPLATES[0]

  if (!isOpen) return null

  const getSlotIcon = (type: string) => {
    if (type === 'video') return <Film size={13} className="text-blue-400" />
    if (type === 'image' || type === 'logo') return <ImageIcon size={13} className="text-emerald-400" />
    if (type === 'text') return <Type size={13} className="text-amber-400" />
    if (type === 'audio') return <Music size={13} className="text-purple-400" />
    return <Film size={13} className="text-ink-400" />
  }

  return (
    <div data-testid="template-picker-modal" className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm select-none sm:p-4">
      <div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-2xl sm:max-h-[92vh] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-ink-800 bg-ink-950/70 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-brand/20 p-1.5 text-brand-400"><LayoutTemplate size={16} /></div>
            <div>
              <div className="flex items-center gap-2"><h3 className="text-sm font-semibold text-white">Motion Lab</h3><span className="rounded-full bg-brand/15 px-2 py-0.5 font-mono text-[10px] text-brand-300">{MOTION_LAB_TEMPLATES.length} original recipes</span></div>
              <p className="text-[10px] text-ink-400">Editable layers, media slots and keyframes</p>
            </div>
          </div>
          <button type="button" data-testid="close-template-modal-btn" onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-white"><X size={16} /></button>
        </div>

        <div className="border-b border-ink-800 px-5 py-3">
          <div className="relative mb-2.5">
            <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-ink-500" />
            <input data-testid="template-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, charts, maps, social…" className="h-9 w-full rounded-lg border border-ink-700 bg-ink-950 pl-9 pr-3 text-xs text-ink-100 outline-none focus:border-brand" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {(['All', ...TEMPLATE_CATEGORIES] as const).map((item) => (
              <button key={item} type="button" data-testid={`template-category-${String(item).toLowerCase().replace(/\s+/g, '-')}`} onClick={() => setCategory(item)} className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] ${category === item ? 'border-brand bg-brand/20 text-brand-200' : 'border-ink-700 text-ink-400 hover:text-ink-100'}`}>{item}</button>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1.2fr)_minmax(330px,.8fr)] md:overflow-hidden">
          <div className="border-b border-ink-800 p-3 md:overflow-y-auto md:border-b-0 md:border-r md:p-4">
            <div className="mb-2 flex items-center justify-between text-[10px] text-ink-500"><span>{filtered.length} recipes</span><span>Click to inspect</span></div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((template) => {
                const colors = template.palette ?? FALLBACK_PALETTE
                return (
                  <button key={template.id} type="button" data-testid={`template-item-${template.id}`} onClick={() => setSelectedTemplateId(template.id)} className={`overflow-hidden rounded-xl border text-left transition-all ${selectedTemplateId === template.id ? 'border-brand bg-brand/10 shadow-lg shadow-brand/10' : 'border-ink-800 bg-ink-950/50 hover:border-ink-600'}`}>
                    <div className="h-20 p-3" style={{ background: backgroundCss(template) }}>
                      <div className="flex h-full items-end"><span className="max-w-full truncate rounded bg-black/45 px-2 py-1 text-[10px] font-bold tracking-wide text-white backdrop-blur">{template.name.split(' · ')[0]}</span></div>
                    </div>
                    <div className="p-2.5">
                      <div className="truncate text-[11px] font-semibold text-ink-100">{template.name}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-[9px] text-ink-500"><span>{template.category}</span><span>·</span><span>{template.aspect}</span><span className="ml-auto flex gap-0.5">{colors.map((color) => <i key={color} className="h-2.5 w-2.5 rounded-full border border-white/15" style={{ backgroundColor: color }} />)}</span></div>
                    </div>
                  </button>
                )
              })}
            </div>
            {filtered.length === 0 && <div className="grid h-48 place-items-center text-xs text-ink-500">No matching recipes</div>}
          </div>

          <div className="min-h-0 bg-ink-950/35 p-3 md:overflow-y-auto md:p-4">
            <div data-testid="template-preview" className="mb-4 h-36 overflow-hidden rounded-xl border border-white/10 p-4" style={{ background: backgroundCss(currentTemplate) }}>
              <div className="flex h-full flex-col justify-end">
                <div className="text-2xl font-black tracking-tight text-white drop-shadow-lg">{currentTemplate.slots.find((slot) => slot.type === 'text')?.defaultContent || currentTemplate.name.split(' · ')[0]}</div>
                <div className="mt-1 text-[10px] font-medium uppercase tracking-[.28em] text-white/70">{currentTemplate.motion || 'editable motion'}</div>
              </div>
            </div>

            <div className="mb-3 flex items-start justify-between gap-3">
              <div><h4 className="text-sm font-semibold text-white">{currentTemplate.name}</h4><p className="mt-1 text-[11px] leading-relaxed text-ink-400">{currentTemplate.description}</p></div>
              <div className="shrink-0 space-y-1 text-right text-[9px] text-ink-400"><div className="flex items-center justify-end gap-1"><Clock3 size={10} /> {currentTemplate.duration ?? 6}s</div><div>{currentTemplate.aspect ?? '16:9'}</div></div>
            </div>

            <div className="space-y-2">
              {currentTemplate.slots.map((slot) => (
                <div key={slot.id} data-testid="template-slot-card" className="space-y-1.5 rounded-lg border border-ink-800 bg-ink-900 p-2.5 text-xs">
                  <div className="flex items-center justify-between"><div className="flex items-center gap-1.5 font-medium text-ink-100">{getSlotIcon(slot.type)}<span>{slot.name}</span></div>{slot.required && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-300">Slot</span>}</div>
                  {slot.type === 'text' ? <div className="truncate text-[10px] italic text-ink-500">{slot.defaultContent || 'Editable text'}</div> : (
                    <select value={slotAssignments[slot.id] || ''} onChange={(event) => setSlotAssignments((previous) => ({ ...previous, [slot.id]: event.target.value }))} className="h-7 w-full rounded border border-ink-700 bg-ink-950 px-2 text-[10px] text-ink-200">
                      <option value="">Auto-fill or leave open</option>
                      {assets.filter((asset) => {
                        const kind = slot.type === 'logo' ? 'image' : slot.type
                        return asset.kind === kind
                      }).map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-ink-800 bg-ink-950/70 px-5 py-3">
          <div className="hidden items-center gap-1.5 text-[10px] text-ink-500 sm:flex"><Sparkles size={11} /> Built with original OmniFrame layers</div>
          <div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-ink-400 hover:text-white">Cancel</button><button type="button" data-testid="apply-template-btn" onClick={() => { applyEditableTemplate(currentTemplate, slotAssignments); onClose() }} className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 text-xs font-medium text-white shadow-md shadow-brand/20 hover:bg-brand/90"><CheckCircle2 size={13} /> Build editable scene</button></div>
        </div>
      </div>
    </div>
  )
}
