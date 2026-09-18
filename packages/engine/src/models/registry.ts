/**
 * ModelRegistry — every AI/CV model that can be loaded, with its licence recorded
 * next to the code that uses it so the licence audit can fail on an incompatible
 * shipping dependency instead of at release time.
 *
 * Policy: shipping models must be MIT or Apache-2.0. CC-BY-NC / AGPL / unknown are
 * recorded here as research-only and are never offered as a shippable option.
 */

export type ModelTask = 'segmentation' | 'point-tracking' | 'background-removal' | 'depth' | 'inpainting' | 'super-resolution';
export type ModelRuntime = 'onnxruntime-web' | 'transformers.js' | 'wasm-cpu' | 'native';
export type LicenseId = 'Apache-2.0' | 'MIT' | 'BSD-3-Clause' | 'CC-BY-NC-4.0' | 'AGPL-3.0' | 'unknown';

export interface ModelDescriptor {
  id: string;
  displayName: string;
  task: ModelTask;
  /** code licence of the implementation we ship */
  license: LicenseId;
  /** licence of the pretrained weights */
  weightLicense: LicenseId;
  source: string;
  revision: string;
  /** approximate download size in bytes */
  size: number;
  quantizations: Array<'fp32' | 'fp16' | 'int8'>;
  runtime: ModelRuntime;
  /** maps to the Fast / Balanced / Quality selector in the normal UI */
  tier: 'fast' | 'balanced' | 'quality';
  capabilities: string[];
  /** true when the model may be shipped in a release build */
  shippable: boolean;
  /** false => shown in Advanced/research only, never offered by default */
  researchOnly: boolean;
  attribution: string;
  notes: string;
  browser: boolean;
  desktop: boolean;
}

export const MODELS: ModelDescriptor[] = [
  {
    id: 'sam2.1-hiera-tiny',
    displayName: 'SAM 2.1 Hiera-Tiny',
    task: 'segmentation',
    license: 'Apache-2.0',
    weightLicense: 'Apache-2.0',
    source: 'https://huggingface.co/facebook/sam2.1-hiera-tiny',
    revision: 'main',
    size: 39_000_000,
    quantizations: ['fp32', 'fp16'],
    runtime: 'onnxruntime-web',
    tier: 'balanced',
    capabilities: ['point-prompt', 'box-prompt', 'negative-point', 'mask-refinement', 'webgpu'],
    shippable: true,
    researchOnly: false,
    attribution: '© Meta AI (FAIR). SAM 2: Segment Anything in Images and Videos. Apache-2.0.',
    notes:
      'Encoder must be exported in ONNX Runtime (.ort) format: the plain ONNX export fails ' +
      'shape inference inside onnxruntime-web on /vision_encoder/backbone/Concat_3_output_0.',
    browser: true,
    desktop: true,
  },
  {
    id: 'sam2.1-hiera-small',
    displayName: 'SAM 2.1 Hiera-Small',
    task: 'segmentation',
    license: 'Apache-2.0',
    weightLicense: 'Apache-2.0',
    source: 'https://huggingface.co/facebook/sam2.1-hiera-small',
    revision: 'main',
    size: 118_000_000,
    quantizations: ['fp32', 'fp16'],
    runtime: 'onnxruntime-web',
    tier: 'quality',
    capabilities: ['point-prompt', 'box-prompt', 'negative-point', 'mask-refinement', 'webgpu'],
    shippable: true,
    researchOnly: false,
    attribution: '© Meta AI (FAIR). Apache-2.0.',
    notes: 'Higher-quality masks than Tiny; roughly 3x the encoder cost.',
    browser: true,
    desktop: true,
  },
  {
    id: 'birefnet-lite-512',
    displayName: 'BiRefNet Lite 512',
    task: 'background-removal',
    license: 'MIT',
    weightLicense: 'MIT',
    source: 'https://huggingface.co/studioludens/birefnet-lite-512',
    revision: 'main',
    size: 60_000_000,
    quantizations: ['fp32', 'fp16'],
    runtime: 'transformers.js',
    tier: 'quality',
    capabilities: ['dichotomous-segmentation', 'hair-detail'],
    shippable: true,
    researchOnly: false,
    attribution: 'BiRefNet Lite 512 — MIT.',
    notes: 'Best hair/detail preservation of the three reviewed background-removal models.',
    browser: true,
    desktop: true,
  },
  {
    id: 'modnet',
    displayName: 'MODNet (Xenova)',
    task: 'background-removal',
    license: 'Apache-2.0',
    weightLicense: 'Apache-2.0',
    source: 'https://huggingface.co/Xenova/modnet',
    revision: 'main',
    size: 25_000_000,
    quantizations: ['fp32', 'fp16'],
    runtime: 'transformers.js',
    tier: 'balanced',
    capabilities: ['portrait-matting'],
    shippable: true,
    researchOnly: false,
    attribution: 'MODNet — Apache-2.0.',
    notes: 'Portrait-specialised; faster than BiRefNet, less general.',
    browser: true,
    desktop: true,
  },
  {
    id: 'isnet-onnx',
    displayName: 'ISNet-ONNX',
    task: 'background-removal',
    license: 'AGPL-3.0',
    weightLicense: 'unknown',
    source: 'https://huggingface.co/onnx-community/ISNet-ONNX',
    revision: 'main',
    size: 170_000_000,
    quantizations: ['fp32'],
    runtime: 'onnxruntime-web',
    tier: 'quality',
    capabilities: ['dichotomous-segmentation'],
    shippable: false,
    researchOnly: true,
    attribution: 'ISNet — AGPL-3.0 (repo listing).',
    notes:
      'BLOCKED. The Hugging Face listing is AGPL-3.0, which is incompatible with the ' +
      'MIT/Apache-only shipping policy. Recorded for algorithm study only.',
    browser: true,
    desktop: false,
  },
  {
    id: 'cotracker',
    displayName: 'CoTracker',
    task: 'point-tracking',
    license: 'CC-BY-NC-4.0',
    weightLicense: 'CC-BY-NC-4.0',
    source: 'https://github.com/facebookresearch/co-tracker',
    revision: 'main',
    size: 90_000_000,
    quantizations: ['fp32'],
    runtime: 'onnxruntime-web',
    tier: 'quality',
    capabilities: ['dense-point-tracking'],
    shippable: false,
    researchOnly: true,
    attribution: 'CoTracker — most of the repository is CC-BY-NC.',
    notes:
      'BLOCKED. CC-BY-NC forbids commercial redistribution, so it cannot ship. Its ' +
      'correlation-volume ideas informed our own boundary refinement instead.',
    browser: false,
    desktop: false,
  },
  {
    id: 'lucas-kanade-pyr',
    displayName: 'Pyramidal Lucas-Kanade (built in)',
    task: 'point-tracking',
    license: 'MIT',
    weightLicense: 'MIT',
    source: 'internal:packages/engine/src/tracking',
    revision: '0.1.0',
    size: 0,
    quantizations: ['fp32'],
    runtime: 'wasm-cpu',
    tier: 'fast',
    capabilities: ['sparse-point-tracking', 'forward-backward', 'global-motion', 'non-rigid-warp'],
    shippable: true,
    researchOnly: false,
    attribution: 'Original implementation for OmniFrame (MIT).',
    notes: 'No download, no licence risk, runs on every platform. This is the default.',
    browser: true,
    desktop: true,
  },
];

export function getModel(id: string): ModelDescriptor | undefined {
  return MODELS.find((m) => m.id === id);
}

export function modelsForTask(task: ModelTask): ModelDescriptor[] {
  return MODELS.filter((m) => m.task === task);
}

export function shippableModelsForTask(task: ModelTask): ModelDescriptor[] {
  return MODELS.filter((m) => m.task === task && m.shippable);
}

/** What the normal user sees: three words, not a model catalogue. */
export function modelForTier(task: ModelTask, tier: 'fast' | 'balanced' | 'quality'): ModelDescriptor | undefined {
  return MODELS.find((m) => m.task === task && m.tier === tier && m.shippable);
}

export interface LicenceIssue {
  modelId: string;
  reason: string;
}

/** Fails the licence audit when a blocked model is marked shippable. */
export function auditModelLicences(): LicenceIssue[] {
  const issues: LicenceIssue[] = [];
  for (const m of MODELS) {
    const bad = (l: LicenseId): boolean => l === 'CC-BY-NC-4.0' || l === 'AGPL-3.0' || l === 'unknown';
    if (m.shippable && (bad(m.license) || bad(m.weightLicense))) {
      issues.push({ modelId: m.id, reason: `${m.license} weights ${m.weightLicense} cannot ship under the MIT/Apache policy` });
    }
  }
  return issues;
}
