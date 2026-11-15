import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Sparkles,
  CheckCircle2,
  X,
  RefreshCw,
  Eye,
} from 'lucide-react'
import { useEditor } from '../store'
import type { BgRemovalModelId, BgRemovalOptions } from '../types'
import { renderStillCutoutAsync, type StillCutoutResult } from '../lib/backgroundCutout'

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
  const projectGeneration = useEditor((s) => s.projectGeneration)
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
  const [previewAttempt, setPreviewAttempt] = useState(0)
  const [source, setSource] = useState<{ key: object; image: HTMLImageElement } | null>(null)
  const [result, setResult] = useState<{ key: object; output: StillCutoutResult } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const sourceKey = useMemo(() => ({ clipId: activeClip?.id, assetId: asset?.id, url: asset?.url, projectGeneration }),
    [activeClip?.id, asset?.id, asset?.url, projectGeneration])
  const sourceImage = source?.key === sourceKey ? source.image : null

  useEffect(() => {
    setSource(null)
    setResult(null)
    setPreviewGenerated(false)
    setIsProcessing(false)
    setError(null)
    if (!isOpen || !asset || asset.kind !== 'image' || activeClip?.kind !== 'image') return
    let cancelled = false
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => { if (!cancelled) setSource({ key: sourceKey, image }) }
    image.onerror = () => { if (!cancelled) setError('Could not load this image for cutout') }
    image.src = asset.url
    return () => { cancelled = true }
  }, [isOpen, sourceKey, activeClip?.kind])

  const options = useMemo<BgRemovalOptions>(() => ({ modelId, mode: bgMode, solidColor, blurRadius, featherRadius, chokeExpand }),
    [modelId, bgMode, solidColor, blurRadius, featherRadius, chokeExpand])
  const resultKey = useMemo(() => ({ sourceKey, options }), [sourceKey, options])

  useEffect(() => {
    if (!isOpen || !sourceImage || !previewCanvasRef.current) return
    const canvas = previewCanvasRef.current
    if (!previewGenerated) {
      canvas.width = Math.min(480, sourceImage.naturalWidth)
      canvas.height = Math.max(1, Math.round(sourceImage.naturalHeight * canvas.width / sourceImage.naturalWidth))
      canvas.getContext('2d')?.drawImage(sourceImage, 0, 0, canvas.width, canvas.height)
      return
    }
    const controller = new AbortController()
    setIsProcessing(true)
    setError(null)
    setResult(null)
    void renderStillCutoutAsync(sourceImage, options, controller.signal).then(async (output) => {
      const image = new Image()
      image.src = output.url
      await image.decode()
      if (controller.signal.aborted) return
      // Preview the exact PNG that Apply will commit, including its edge pixels.
      canvas.width = output.width; canvas.height = output.height
      canvas.getContext('2d')?.drawImage(image, 0, 0)
      setResult({ key: resultKey, output })
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause))
    }).finally(() => {
      if (!controller.signal.aborted) setIsProcessing(false)
    })
    return () => controller.abort()
  }, [isOpen, sourceImage, options, resultKey, previewGenerated, previewAttempt])

  if (!isOpen) return null

  const handleRunProcessing = () => {
    if (!sourceImage) return
    setError(null)
    setPreviewGenerated(true)
    setPreviewAttempt((attempt) => attempt + 1)
  }

  const handleApplyCutout = () => {
    if (!activeClip || !result || result.key !== resultKey || isProcessing) return
    setError(null)
    try {
      const id = applyStillCutout(activeClip.id, result.output)
      if (!id) throw new Error('The selected still clip is no longer available')
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <div
      data-testid="bg-removal-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Quick Background Cutout"
      aria-busy={isProcessing}
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
            aria-label="Close cutout"
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
                max={10}
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
              disabled={isProcessing || !result || result.key !== resultKey}
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
