/**
 * The .vxproj project format.
 *
 * Versioned, with stable ids on every object and an explicit migration chain, so a file
 * written by an older build still opens. Serialisation is JSON with a small extension
 * for typed arrays (mask runs), because a project must be diffable and must survive
 * IndexedDB on the web and atomic file writes on desktop.
 */
import { Sequence, newSequence, Clip, MaskInstance, MaskFrameData } from '../timeline/model.js';
import { Scene3D } from '../three/scene.js';
import { TemplateDef } from '../templates/schema.js';
import { OmniframeOp } from '../omniframe/ops.js';

export const PROJECT_EXTENSION = '.vxproj';
export const TEMPLATE_EXTENSION = '.vxtemplate';
export const EFFECT_EXTENSION = '.vxeffect';
export const MASK_EXTENSION = '.vxmask';
export const TRACK_EXTENSION = '.vxtrack';
export const CURRENT_PROJECT_VERSION = 3;

export type MediaKind = 'video' | 'audio' | 'image' | 'model' | 'texture' | 'hdri' | 'font' | 'lut' | 'mask';

export interface Asset {
  id: string;
  name: string;
  kind: MediaKind;
  /** original source path or blob url; never rewritten on relink failure */
  sourcePath: string;
  /** content hash used to detect a moved-but-identical file during relink */
  contentHash: string | null;
  mime: string;
  width: number;
  height: number;
  duration: number;
  fps: number;
  sampleRate: number;
  channels: number;
  sizeBytes: number;
  missing: boolean;
  tags: string[];
  favorite: boolean;
  folderId: string | null;
  /** proxy asset id, when one has been generated */
  proxyId: string | null;
  importedAt: number;
}

export interface AssetFolder {
  id: string;
  name: string;
  parentId: string | null;
}

export interface RenderSettings {
  presetId: string;
  width: number;
  height: number;
  fps: number;
  codecString: string;
  bitrate: number;
  audioCodec: string;
  audioBitrate: number;
  container: 'mp4' | 'webm';
  pixelFormat: 'yuv420p' | 'yuv420p10';
  /** when true, export uses full-resolution analysis and full-quality effects */
  finalQuality: boolean;
}

export interface CacheMetadata {
  thumbnails: number;
  waveforms: number;
  proxies: number;
  masks: number;
  tracks: number;
  lightmaps: number;
  bytes: number;
}

export interface RecoveryRecord {
  savedAt: number;
  reason: 'autosave' | 'manual' | 'crash';
  playheadFrame: number;
  version: number;
}

export interface ProjectFile {
  format: 'omniframe.vxproj';
  projectVersion: number;
  savedAt: number;
  applicationVersion: string;
  name: string;
  assets: Asset[];
  folders: AssetFolder[];
  sequences: Sequence[];
  activeSequenceId: string | null;
  scenes3d: Scene3D[];
  templates: TemplateDef[];
  omniframe: OmniframeOp[];
  fonts: Array<{ family: string; source: string; license: string }>;
  renderSettings: RenderSettings;
  cacheMetadata: CacheMetadata;
  recovery: RecoveryRecord[];
  /** user-defined workspace layouts */
  workspaces: Array<{ id: string; name: string; layout: Record<string, unknown> }>;
  shortcuts: Record<string, string>;
}

export function newProject(name = 'Untitled Project'): ProjectFile {
  const seq = newSequence();
  return {
    format: 'omniframe.vxproj',
    projectVersion: CURRENT_PROJECT_VERSION,
    savedAt: Date.now(),
    applicationVersion: '0.1.0',
    name,
    assets: [],
    folders: [],
    sequences: [seq],
    activeSequenceId: seq.id,
    scenes3d: [],
    templates: [],
    omniframe: [],
    fonts: [],
    renderSettings: {
      presetId: 'yt1080', width: 1920, height: 1080, fps: 30,
      codecString: 'avc1.640028', bitrate: 8_000_000,
      audioCodec: 'mp4a.40.2', audioBitrate: 192_000,
      container: 'mp4', pixelFormat: 'yuv420p', finalQuality: true,
    },
    cacheMetadata: { thumbnails: 0, waveforms: 0, proxies: 0, masks: 0, tracks: 0, lightmaps: 0, bytes: 0 },
    recovery: [],
    workspaces: [],
    shortcuts: {},
  };
}

/* ----------------------------- serialisation ------------------------------ */

/** Typed arrays cannot round-trip through JSON, so mask runs get an explicit marker. */
interface TypedArrayRef {
  __typed: 'Int32Array';
  values: number[];
}

function isTypedRef(v: unknown): v is TypedArrayRef {
  return typeof v === 'object' && v !== null && (v as TypedArrayRef).__typed === 'Int32Array';
}

export function serializeProject(project: ProjectFile): string {
  return JSON.stringify(project, (_key, value: unknown) => {
    if (value instanceof Int32Array) {
      return { __typed: 'Int32Array', values: Array.from(value) } satisfies TypedArrayRef;
    }
    if (value instanceof Map) {
      return { __map: Array.from(value.entries()) };
    }
    return value;
  });
}

export function deserializeProject(text: string): ProjectFile {
  const raw = JSON.parse(text) as ProjectFile;
  const migrated = migrateProject(raw);
  return revived(migrated);
}

function revived<T>(value: T): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v !== 'object' || v === null) return v;
    if (isTypedRef(v)) return Int32Array.from(v.values);
    const rec = v as Record<string, unknown>;
    if (Array.isArray(rec.__map)) {
      return new Map((rec.__map as Array<[unknown, unknown]>).map(([k, val]) => [walk(k), walk(val)] as [unknown, unknown]));
    }
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(rec)) out[k] = walk(val);
    return out;
  };
  return walk(value) as T;
}

/* ------------------------------- migrations ------------------------------- */

export type Migration = {
  from: number;
  to: number;
  apply: (project: Record<string, unknown>) => Record<string, unknown>;
};

/**
 * The migration chain. Each step is a pure function of the previous version's shape.
 * Add a new step at the end; never rewrite an existing one.
 */
export const MIGRATIONS: Migration[] = [
  {
    from: 1,
    to: 2,
    // v1 stored a single `timeline` object; v2 introduced multiple sequences.
    apply: (p) => {
      if (!p.sequences && p.timeline) {
        p.sequences = [p.timeline];
        p.activeSequenceId = (p.timeline as { id?: string }).id ?? null;
        delete p.timeline;
      }
      p.projectVersion = 2;
      return p;
    },
  },
  {
    from: 2,
    to: 3,
    // v3 split rendering concerns out of the sequence into renderSettings, and gave
    // masks a display mode.
    apply: (p) => {
      if (!p.renderSettings) {
        p.renderSettings = {
          presetId: 'yt1080', width: 1920, height: 1080, fps: 30,
          codecString: 'avc1.640028', bitrate: 8_000_000,
          audioCodec: 'mp4a.40.2', audioBitrate: 192_000,
          container: 'mp4', pixelFormat: 'yuv420p', finalQuality: true,
        };
      }
      const seqs = (p.sequences as Sequence[]) ?? [];
      for (const s of seqs) {
        for (const t of s.tracks ?? []) {
          for (const c of t.clips ?? []) {
            for (const m of (c as Clip).masks ?? []) {
              const mask = m as MaskInstance;
              if (!mask.mode) mask.mode = 'red';
              if (typeof mask.feather !== 'number') mask.feather = 0;
              if (typeof mask.grow !== 'number') mask.grow = 0;
              if (typeof mask.inverted !== 'boolean') mask.inverted = false;
              if (!mask.frames) mask.frames = {};
            }
            if (typeof (c as Clip).omniframeOpIds === 'undefined') (c as Clip).omniframeOpIds = [];
            if (typeof (c as Clip).speedSegments === 'undefined') (c as Clip).speedSegments = [];
          }
        }
      }
      p.projectVersion = 3;
      return p;
    },
  },
];

export function migrateProject(project: unknown): ProjectFile {
  let p = project as Record<string, unknown>;
  let version = typeof p.projectVersion === 'number' ? p.projectVersion : 1;
  let guard = 0;
  while (version < CURRENT_PROJECT_VERSION && guard++ < 64) {
    const step = MIGRATIONS.find((m) => m.from === version);
    if (!step) {
      throw new Error(
        `No migration path from project version ${version} to ${CURRENT_PROJECT_VERSION}. ` +
        `Open this project in the version that wrote it and re-save.`,
      );
    }
    p = step.apply(p);
    version = step.to;
  }
  if (version > CURRENT_PROJECT_VERSION) {
    throw new Error(
      `This project was written by a newer OmniFrame (format v${version}); this build understands up to v${CURRENT_PROJECT_VERSION}.`,
    );
  }
  return p as unknown as ProjectFile;
}

/* --------------------------------- relink --------------------------------- */

export interface RelinkResult {
  resolved: string[];
  unresolved: string[];
}

/**
 * Relink missing media. The project structure is never destroyed: an asset that cannot
 * be found stays in the bin, still marked missing, with its original path intact.
 */
export function relinkAssets(
  project: ProjectFile,
  resolutions: Map<string, string>,
  hashLookup?: (path: string) => string | null,
): RelinkResult {
  const resolved: string[] = [];
  const unresolved: string[] = [];
  for (const asset of project.assets) {
    if (!asset.missing) continue;
    const explicit = resolutions.get(asset.id);
    if (explicit) {
      asset.sourcePath = explicit;
      asset.missing = false;
      resolved.push(asset.id);
      continue;
    }
    // Try to find the file by content hash elsewhere.
    if (asset.contentHash && hashLookup) {
      const found = hashLookup(asset.contentHash);
      if (found) {
        asset.sourcePath = found;
        asset.missing = false;
        resolved.push(asset.id);
        continue;
      }
    }
    unresolved.push(asset.id);
  }
  return { resolved, unresolved };
}

export function missingAssets(project: ProjectFile): Asset[] {
  return project.assets.filter((a) => a.missing);
}

/* ---------------------------- autosave / recovery -------------------------- */

export function recordAutosave(project: ProjectFile, playheadFrame: number, reason: RecoveryRecord['reason'] = 'autosave'): void {
  project.recovery.push({ savedAt: Date.now(), reason, playheadFrame, version: project.projectVersion });
  // Keep the last 20 recovery points.
  if (project.recovery.length > 20) project.recovery.splice(0, project.recovery.length - 20);
}

/** Shape validation before trusting a file from disk or IndexedDB. */
export function validateProjectShape(value: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const p = value as Partial<ProjectFile>;
  if (!p || typeof p !== 'object') return { ok: false, errors: ['Project is not an object'] };
  if (p.format !== 'omniframe.vxproj') errors.push(`Unexpected format "${String(p.format)}"; expected "omniframe.vxproj"`);
  if (typeof p.projectVersion !== 'number') errors.push('projectVersion is missing');
  if (!Array.isArray(p.sequences)) errors.push('sequences must be an array');
  if (!Array.isArray(p.assets)) errors.push('assets must be an array');
  return { ok: errors.length === 0, errors };
}

export function emptyMaskFrame(width: number, height: number): MaskFrameData {
  return { runs: new Int32Array(0), width, height };
}
