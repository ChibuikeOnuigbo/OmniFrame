/**
 * Template system.
 *
 * A template is structured data, never a screenshot. Every replaceable position is a
 * *slot* with a declared type, and slot content is validated before it is accepted:
 * a 3D_MODEL slot will not silently take a PNG unless the template declares a documented
 * static fallback.
 *
 * Replacing content preserves timing, animation intent, typography hierarchy, the effect
 * stack, layout constraints and transform relationships — only the media inside a slot
 * changes.
 */
import { uid } from '../core/id.js';
import { Sequence, newSequence } from '../timeline/model.js';
import { Scene3D } from '../three/scene.js';

export type SlotType =
  | 'VIDEO' | 'IMAGE' | 'AUDIO' | 'TEXT' | 'COLOR' | '3D_MODEL'
  | 'TEXTURE' | 'HDRI' | 'FONT' | 'MASK' | 'LUT';

export type FitMode = 'cover' | 'contain' | 'crop' | 'subjectFit' | 'center' | 'top' | 'bottom' | 'focalPoint';

export interface SlotAccepts {
  /** accepted asset mime kinds */
  mime: string[];
  /** a video slot may take an image only if this is true (documented static fallback) */
  allowStaticFallback: boolean;
  /** a 3D slot may take an image plane only if this is true */
  allowImagePlane: boolean;
  minWidth?: number;
  minHeight?: number;
  minDuration?: number;
  maxDuration?: number;
}

export interface TemplateSlot {
  id: string;
  name: string;
  type: SlotType;
  required: boolean;
  /** what the template ships with, used as a placeholder and for validation */
  defaultAssetId: string | null;
  accepts: SlotAccepts;
  fit: FitMode;
  /** focal point used by subjectFit / focalPoint fit modes, in 0..1 */
  focalPoint: { x: number; y: number };
  /** the clip / scene object this slot drives */
  target: { kind: 'clip' | 'sceneObject' | 'material' | 'text' | 'color'; id: string; property: string };
  label: string;
}

export interface TemplateDef {
  id: string;
  version: number;
  name: string;
  description: string;
  /** nominal duration in frames */
  duration: number;
  fps: number;
  width: number;
  height: number;
  aspectRatio: string;
  slots: TemplateSlot[];
  sequence: Sequence;
  scene?: Scene3D;
  /** fonts the template needs; the validator reports missing ones */
  fonts: Array<{ family: string; weights: number[]; license: string }>;
  /** effects the template uses; unknown ids fail validation */
  effectIds: string[];
  constraints: {
    minSlotsFilled: number;
    allowReorder: boolean;
    preserveTiming: boolean;
    preserveTypography: boolean;
  };
  renderSettings: {
    codec: string;
    bitrate: number;
    quality: number;
  };
  license: string;
}

export function newTemplate(name: string, width = 1920, height = 1080, fps = 30, duration = 150): TemplateDef {
  return {
    id: uid('tpl'),
    version: 1,
    name,
    description: '',
    duration,
    fps,
    width,
    height,
    aspectRatio: `${width}:${height}`,
    slots: [],
    sequence: newSequence(`${name} sequence`),
    fonts: [],
    effectIds: [],
    constraints: { minSlotsFilled: 0, allowReorder: false, preserveTiming: true, preserveTypography: true },
    renderSettings: { codec: 'avc1', bitrate: 12_000_000, quality: 0.85 },
    license: 'MIT',
  };
}

export function addSlot(
  tpl: TemplateDef,
  partial: Partial<TemplateSlot> & { type: SlotType; name: string; target: TemplateSlot['target'] },
): TemplateSlot {
  const slot: TemplateSlot = {
    id: uid('slot'),
    required: true,
    defaultAssetId: null,
    accepts: defaultAccepts(partial.type),
    fit: 'cover',
    focalPoint: { x: 0.5, y: 0.5 },
    label: partial.name,
    ...partial,
  };
  tpl.slots.push(slot);
  return slot;
}

export function defaultAccepts(type: SlotType): SlotAccepts {
  switch (type) {
    case 'VIDEO':
      return { mime: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'], allowStaticFallback: false, allowImagePlane: false, minDuration: 0.1 };
    case 'IMAGE':
      return { mime: ['image/png', 'image/jpeg', 'image/webp'], allowStaticFallback: true, allowImagePlane: false, minWidth: 64, minHeight: 64 };
    case 'AUDIO':
      return { mime: ['audio/wav', 'audio/mpeg', 'audio/aac', 'audio/flac', 'audio/ogg'], allowStaticFallback: false, allowImagePlane: false };
    case 'TEXT':
      return { mime: ['text/plain'], allowStaticFallback: true, allowImagePlane: false };
    case 'COLOR':
      return { mime: ['application/x-color'], allowStaticFallback: true, allowImagePlane: false };
    case '3D_MODEL':
      return { mime: ['model/gltf-binary', 'model/gltf+json', 'model/obj'], allowStaticFallback: false, allowImagePlane: false };
    case 'TEXTURE':
      return { mime: ['image/png', 'image/jpeg', 'image/webp'], allowStaticFallback: true, allowImagePlane: false, minWidth: 4, minHeight: 4 };
    case 'HDRI':
      return { mime: ['image/vnd.radiance', 'image/png', 'image/jpeg'], allowStaticFallback: false, allowImagePlane: false };
    case 'FONT':
      return { mime: ['font/ttf', 'font/otf', 'font/woff2'], allowStaticFallback: false, allowImagePlane: false };
    case 'MASK':
      return { mime: ['image/png', 'application/x-vxmask'], allowStaticFallback: true, allowImagePlane: false };
    case 'LUT':
      return { mime: ['application/x-cube-lut', 'image/png'], allowStaticFallback: false, allowImagePlane: false };
  }
}

/* ------------------------------- validation ------------------------------- */

export interface AssetProbe {
  id: string;
  mime: string;
  width?: number;
  height?: number;
  duration?: number;
  name: string;
}

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: ValidationSeverity;
  slotId: string | null;
  code: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  filled: number;
  total: number;
}

export interface ValidateContext {
  assets: AssetProbe[];
  knownEffectIds: string[];
  availableFonts: string[];
}

/**
 * Validate a template (optionally with candidate slot content) before use or publish.
 * Returns errors that must block, and warnings that the UI can surface without blocking.
 */
export function validateTemplate(tpl: TemplateDef, content: Map<string, string>, ctx: ValidateContext): ValidationResult {
  const issues: ValidationIssue[] = [];
  let filled = 0;

  for (const slot of tpl.slots) {
    const assetId = content.get(slot.id) ?? slot.defaultAssetId;
    if (!assetId) {
      if (slot.required) {
        issues.push({ severity: 'error', slotId: slot.id, code: 'missing-required', message: `"${slot.name}" is required but has no content.` });
      }
      continue;
    }
    filled++;
    const asset = ctx.assets.find((a) => a.id === assetId);
    if (!asset) {
      issues.push({ severity: 'error', slotId: slot.id, code: 'asset-not-found', message: `"${slot.name}" references asset ${assetId}, which is not in the project.` });
      continue;
    }
    if (!slot.accepts.mime.includes(asset.mime)) {
      // Documented fallbacks are allowed; anything else is a hard error.
      const isImage = asset.mime.startsWith('image/');
      if (isImage && slot.type === 'VIDEO' && slot.accepts.allowStaticFallback) {
        issues.push({ severity: 'warning', slotId: slot.id, code: 'static-fallback', message: `"${slot.name}" is a video slot; the image "${asset.name}" will be held as a still.` });
      } else if (isImage && slot.type === '3D_MODEL' && slot.accepts.allowImagePlane) {
        issues.push({ severity: 'warning', slotId: slot.id, code: 'image-plane', message: `"${slot.name}" is a 3D model slot; "${asset.name}" will be used as a flat image plane.` });
      } else {
        issues.push({
          severity: 'error',
          slotId: slot.id,
          code: 'type-mismatch',
          message: `"${slot.name}" needs ${slot.accepts.mime.join(' or ')} but "${asset.name}" is ${asset.mime}.`,
        });
        continue;
      }
    }
    if (slot.accepts.minWidth && (asset.width ?? Infinity) < slot.accepts.minWidth) {
      issues.push({ severity: 'warning', slotId: slot.id, code: 'low-resolution', message: `"${asset.name}" is ${asset.width}px wide; "${slot.name}" wants at least ${slot.accepts.minWidth}px.` });
    }
    if (slot.accepts.minHeight && (asset.height ?? Infinity) < slot.accepts.minHeight) {
      issues.push({ severity: 'warning', slotId: slot.id, code: 'low-resolution', message: `"${asset.name}" is ${asset.height}px tall; "${slot.name}" wants at least ${slot.accepts.minHeight}px.` });
    }
    if (slot.accepts.minDuration && (asset.duration ?? Infinity) < slot.accepts.minDuration) {
      issues.push({ severity: 'error', slotId: slot.id, code: 'too-short', message: `"${asset.name}" is ${(asset.duration ?? 0).toFixed(2)}s; "${slot.name}" needs at least ${slot.accepts.minDuration}s.` });
    }
    if (slot.accepts.maxDuration && (asset.duration ?? 0) > slot.accepts.maxDuration) {
      issues.push({ severity: 'warning', slotId: slot.id, code: 'will-be-trimmed', message: `"${asset.name}" will be trimmed to ${slot.accepts.maxDuration}s to fit "${slot.name}".` });
    }
  }

  if (filled < tpl.constraints.minSlotsFilled) {
    issues.push({ severity: 'error', slotId: null, code: 'not-enough-slots', message: `This template needs at least ${tpl.constraints.minSlotsFilled} filled slots; ${filled} are filled.` });
  }
  for (const id of tpl.effectIds) {
    if (!ctx.knownEffectIds.includes(id)) {
      issues.push({ severity: 'error', slotId: null, code: 'unknown-effect', message: `Template uses effect "${id}", which is not available in this build.` });
    }
  }
  for (const f of tpl.fonts) {
    if (!ctx.availableFonts.includes(f.family)) {
      issues.push({ severity: 'warning', slotId: null, code: 'missing-font', message: `Font "${f.family}" is not installed; a substitute will be used and the typography hierarchy may shift.` });
    }
  }

  return { ok: !issues.some((i) => i.severity === 'error'), issues, filled, total: tpl.slots.length };
}

/* --------------------------- style-preserving swap ------------------------ */

export interface SlotSwap {
  slotId: string;
  assetId: string;
  /** how the new asset should be fitted into the slot's frame */
  fit?: FitMode;
}

/**
 * Replace slot content without disturbing the template's style:
 * timing, transform relationships, effect stack and typography are copied verbatim;
 * only the asset reference and (for a different aspect) the fit crop change.
 */
export function applySlotSwaps(
  tpl: TemplateDef,
  swaps: SlotSwap[],
  assets: AssetProbe[],
): { template: TemplateDef; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const next: TemplateDef = JSON.parse(JSON.stringify({ ...tpl, sequence: tpl.sequence, scene: tpl.scene }));
  next.slots = tpl.slots.map((s) => ({ ...s, accepts: { ...s.accepts }, focalPoint: { ...s.focalPoint }, target: { ...s.target } }));
  for (const swap of swaps) {
    const slot = next.slots.find((s) => s.id === swap.slotId);
    if (!slot) {
      issues.push({ severity: 'error', slotId: swap.slotId, code: 'no-such-slot', message: `Template has no slot ${swap.slotId}.` });
      continue;
    }
    const asset = assets.find((a) => a.id === swap.assetId);
    if (!asset) {
      issues.push({ severity: 'error', slotId: swap.slotId, code: 'asset-not-found', message: `Asset ${swap.assetId} is not in the project.` });
      continue;
    }
    slot.defaultAssetId = swap.assetId;
    if (swap.fit) slot.fit = swap.fit;
    // Preserve timing: the clip's start/length are untouched by design.
    const track = next.sequence.tracks.find((t) => t.clips.some((c) => c.id === slot.target.id));
    const clip = track?.clips.find((c) => c.id === slot.target.id);
    if (clip && slot.target.kind === 'clip') {
      clip.assetId = swap.assetId;
      // Keep the slot's duration; only adjust sourceOut when the new asset is shorter.
      const want = clip.sourceOut - clip.sourceIn;
      const haveFrames = Math.round((asset.duration ?? 0) * next.fps);
      if (haveFrames > 0 && haveFrames < want) {
        clip.sourceOut = clip.sourceIn + haveFrames;
        issues.push({ severity: 'warning', slotId: swap.slotId, code: 'shortened', message: `"${asset.name}" is shorter than the slot, so the slot now ends early.` });
      }
    }
  }
  return { template: next, issues };
}

/** Compute the crop rect for a fit mode, in source pixels. */
export function computeFit(
  mode: FitMode,
  src: { width: number; height: number },
  dst: { width: number; height: number },
  focal: { x: number; y: number } = { x: 0.5, y: 0.5 },
): { x: number; y: number; width: number; height: number; scale: number } {
  if (mode === 'contain') {
    const scale = Math.min(dst.width / src.width, dst.height / src.height);
    return { x: 0, y: 0, width: src.width, height: src.height, scale };
  }
  // Every other mode crops the source to the destination aspect; they differ only in
  // where the crop window is anchored.
  const anchor =
    mode === 'center' ? { x: 0.5, y: 0.5 }
    : mode === 'top' ? { x: 0.5, y: 0 }
    : mode === 'bottom' ? { x: 0.5, y: 1 }
    : focal;
  const scale = Math.max(dst.width / src.width, dst.height / src.height);
  const cropW = dst.width / scale;
  const cropH = dst.height / scale;
  const x = Math.max(0, Math.min(src.width - cropW, (src.width - cropW) * anchor.x));
  const y = Math.max(0, Math.min(src.height - cropH, (src.height - cropH) * anchor.y));
  return { x, y, width: cropW, height: cropH, scale };
}
