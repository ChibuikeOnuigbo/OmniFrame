import { useState, useEffect, useRef } from 'react'
import {
  Sparkles,
  CheckCircle2,
  X,
  RefreshCw,
  Eye,
} from 'lucide-react'
import { useEditor } from '../store'
import type { BgRemovalModelId, BgRemovalOptions } from '../types'
import {
  generateMattingMask,
  compositeCutout,
} from '../lib/bgRemovalEngine'

function renderStillCutout(image: HTMLImageElement, options: BgRemovalOptions, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))
  const source = document.createElement('canvas')
  source.width = Math.max(1, Math.round(image.naturalWidth * scale))
  source.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const sourceContext = source.getContext('2d', { willReadFrequently: true })
  if (!sourceContext) throw new Error('Canvas processing is unavailable')
  sourceContext.drawImage(image, 0, 0, source.width, source.height)
  const pixels = sourceContext.getImageData(0, 0, source.width, source.height)
  const mask = generateMattingMask(pixels, options.modelId, options)
  const output = document.createElement('canvas')
  compositeCutout(source, mask, options, output)
  return output
}

interface Props {
  isOpen: boolean
  onClose: () => void
  clipId?: string
}

export function BackgroundRemovalModal({ isOpen, onClose, clipId }: Props) {
  const clips = useEditor((s) => s.clips)
  const assets = useEditor((s) => s.assets)
  const applyStillCutout = useEditor((s) => s.applyStillCutout)
  const selectedClipId = useEditor((s) => s.selectedClipId)
  const activeClip = clips.find((c) => c.id === (clipId || selectedClipId)) || null
  const asset = activeClip ? assets.find((a) => a.id === activeClip.assetId) : null

  const [modelId, setModelId] = useState<BgRemovalModelId>('birefnet-general')
  const [bgMode, setBgMode] = useState<'transparent' | 'solid' | 'blur'>('transparent')
  const [solidColor, setSolidColor] = useState('#00FF00')
  const [blurRadius, setBlurRadius] = useState(12)
  const [featherRadius, setFeatherRadius] = useState(2)
  const [chokeExpand, setChokeExpand] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [previewGenerated, setPreviewGenerated] = useState(false)
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null)
  const [error, setError] = useState<string | null>(null)

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    setSourceImage(null)
    setPreviewGenerated(false)
    setError(null)
    if (!isOpen || !asset || asset.kind !== 'image' || activeClip?.kind !== 'image') return
    let cancelled = false
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => { if (!cancelled) setSourceImage(image) }
    image.onerror = () => { if (!cancelled) setError('Could not load this image for cutout') }
    image.src = asset.url
    return () => { cancelled = true }
  }, [isOpen, asset?.id, asset?.url, activeClip?.kind])

  const options: BgRemovalOptions = { modelId, mode: bgMode, solidColor, blurRadius, featherRadius, chokeExpand }

  useEffect(() => {
    if (!isOpen || !sourceImage || !previewCanvasRef.current) return
    const canvas = previewCanvasRef.current
    try {
      const output = previewGenerated
        ? renderStillCutout(sourceImage, options, 480)
        : sourceImage
      canvas.width = previewGenerated ? (output as HTMLCanvasElement).width : Math.min(480, sourceImage.naturalWidth)
      canvas.height = previewGenerated ? (output as HTMLCanvasElement).height
        : Math.max(1, Math.round(sourceImage.naturalHeight * canvas.width / sourceImage.naturalWidth))
      canvas.getContext('2d')?.drawImage(output, 0, 0, canvas.width, canvas.height)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [isOpen, sourceImage, modelId, bgMode, solidColor, blurRadius, featherRadius, chokeExpand, previewGenerated])

  if (!isOpen) return null

  const handleRunProcessing = () => {
    if (!sourceImage) return
    setError(null)
    setPreviewGenerated(true)
  }

  const handleApplyCutout = async () => {
    if (!activeClip || !sourceImage || isProcessing) return
    setIsProcessing(true)
    setError(null)
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const output = renderStillCutout(sourceImage, options, 2048)
      const url = output.toDataURL('image/png')
      const id = applyStillCutout(activeClip.id, {
        url, width: output.width, height: output.height,
        size: Math.floor((url.length - 'data:image/png;base64,'.length) * 0.75),
      })
      if (!id) throw new Error('The selected still clip is no longer available')
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div
      data-testid="bg-removal-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none"
    >
      <div className="w-full max-w-xl rounded-2xl border border-ink-700 bg-ink-900 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink-800 bg-ink-950/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-brand/20 text-brand-400">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Quick Background Cutout</h3>
              <div className="flex items-center gap-1.5 text-[11px] text-ink-400">
                <span>Color-edge matte for still images</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-bg-removal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-400 hover:text-white hover:bg-ink-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Detection profile */}
          <div>
            <label className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
              Edge Sensitivity
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'modnet-photographic', title: 'Tight', desc: 'Keep more edge detail' },
                { id: 'birefnet-general', title: 'Balanced', desc: 'Good starting point' },
                { id: 'isnet-anime', title: 'Wide', desc: 'Remove more backdrop' },
                { id: 'slimsam-fast', title: 'Widest', desc: 'For uneven backdrops' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  data-testid={`bg-model-${m.id}`}
                  onClick={() => setModelId(m.id as BgRemovalModelId)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    modelId === m.id
                      ? 'border-brand bg-brand/15 text-white'
                      : 'border-ink-800 bg-ink-950/40 text-ink-400 hover:bg-ink-800/50'
                  }`}
                >
                  <div className="font-medium text-xs text-ink-100">{m.title}</div>
                  <div className="text-[10px] text-ink-500 mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Replacement Mode */}
          <div>
            <label className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">
              Replacement Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'transparent', label: 'Transparent Alpha' },
                { id: 'solid', label: 'Solid Color' },
                { id: 'blur', label: 'Blur Backdrop' },
              ].map((b) => (
                <button
                  key={b.id}
                  type="button"
                  data-testid={`bg-mode-${b.id}`}
                  onClick={() => setBgMode(b.id as 'transparent' | 'solid' | 'blur')}
                  className={`py-2 px-2 rounded-xl border text-center text-xs capitalize font-medium transition-colors ${
                    bgMode === b.id
                      ? 'border-brand bg-brand/20 text-white'
                      : 'border-ink-800 bg-ink-950/40 text-ink-400 hover:bg-ink-800'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Additional controls depending on mode */}
          {bgMode === 'solid' && (
            <div className="flex items-center gap-3 p-2.5 rounded-xl border border-ink-800 bg-ink-950/30">
              <label className="text-xs text-ink-300">Background Color:</label>
              <input
                type="color"
                aria-label="Background colour"
                data-testid="bg-solid-color-picker"
                value={solidColor}
                onChange={(e) => setSolidColor(e.target.value)}
                className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
              />
              <span className="font-mono text-xs text-ink-400">{solidColor}</span>
              <button
                type="button"
                onClick={() => setSolidColor('#00FF00')}
                className="ml-auto px-2 py-0.5 text-[10px] rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/50"
              >
                Green Screen Preset
              </button>
            </div>
          )}

          {bgMode === 'blur' && (
            <div className="space-y-1.5 p-2.5 rounded-xl border border-ink-800 bg-ink-950/30">
              <div className="flex justify-between text-xs text-ink-300">
                <span>Blur Radius</span>
                <span className="font-mono">{blurRadius} px</span>
              </div>
              <input
                type="range"
                data-testid="bg-blur-slider"
                min={2}
                max={40}
                value={blurRadius}
                onChange={(e) => setBlurRadius(parseInt(e.target.value, 10))}
                className="of-range w-full"
              />
            </div>
          )}

          {/* Edge Refinement Settings */}
          <div className="p-3 rounded-xl border border-ink-800 bg-ink-950/40 space-y-3">
            <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider block">
              Edge Refinement
            </span>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-ink-300">
                <span>Feathering Radius</span>
                <span className="font-mono">{featherRadius} px</span>
              </div>
              <input
                type="range"
                data-testid="bg-feather-slider"
                min={0}
                max={15}
                value={featherRadius}
                onChange={(e) => setFeatherRadius(parseInt(e.target.value, 10))}
                className="of-range w-full"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-ink-300">
                <span>Edge Choke / Expand</span>
                <span className="font-mono">{chokeExpand > 0 ? `+${chokeExpand}` : chokeExpand} px</span>
              </div>
              <input
                type="range"
                data-testid="bg-choke-slider"
                min={-10}
                max={10}
                value={chokeExpand}
                onChange={(e) => setChokeExpand(parseInt(e.target.value, 10))}
                className="of-range w-full"
              />
            </div>

          </div>

          {/* Preview Canvas */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider block">
              Matte & Composition Preview
            </span>
            <div className="relative aspect-video rounded-xl overflow-hidden border border-ink-800 bg-checkerboard flex items-center justify-center">
              <canvas ref={previewCanvasRef} className="w-full h-full object-contain" />
              {isProcessing && (
                <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
                  <RefreshCw size={24} className="animate-spin text-brand-400" />
                  <span className="text-xs font-mono text-white">Processing image…</span>
                </div>
              )}
            </div>
          </div>

          <p
            role="note"
            data-testid="bg-removal-mask-scope-note"
            className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 px-3 py-2 text-[11px] leading-relaxed text-ink-300"
          >
            {error || (asset?.kind === 'image' && activeClip?.kind === 'image'
              ? 'Applies a color-edge matte to this still clip at up to 2048 px. The original stays in the library; Undo restores the clip. Complex backgrounds may need Guided Background Removal.'
              : 'Select an image clip to make a cutout. Video requires frame-by-frame matting in the Roto tools.')}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-ink-800 bg-ink-950/60">
          <button
            type="button"
            data-testid="preview-bg-removal-btn"
            disabled={isProcessing || !sourceImage}
            onClick={handleRunProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ink-700 bg-ink-800 hover:bg-ink-700 text-ink-200 text-xs font-medium disabled:opacity-40"
          >
            <Eye size={13} />
            <span>Generate Preview</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="cancel-bg-removal-btn"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-ink-400 hover:text-white text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="apply-bg-removal-btn"
              disabled={isProcessing || !sourceImage}
              onClick={handleApplyCutout}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand hover:bg-brand/90 text-white font-medium text-xs shadow-md shadow-brand/20 disabled:opacity-40"
            >
              <CheckCircle2 size={13} />
              <span>Apply Cutout</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
