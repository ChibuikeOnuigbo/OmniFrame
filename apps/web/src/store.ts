import { create } from 'zustand';
import {
  type Asset,
  type Clip,
  type ProjectFile,
  type Sequence,
  type TrackKind,
  type Track,
  type MaskDisplayMode,
  type Gray,
  type TrackPreset,
  type EffectInstance,
  type OmniframeOp,
  type Scene3D,
  type Keyframe,
  newProject,
  newClip,
  newTrack,
  clipEnd,
  clipLength,
  splitClip,
  duplicateClip,
  rippleDelete,
  rippleTrim,
  trimClip,
  rollEdit,
  slipEdit,
  slideEdit,
  moveClip,
  snapFrame,
  collectMagnets,
  History,
  FnCommand,
  encodeRle,
  deserializeProject,
  serializeProject,
  validateProjectShape,
  recordAutosave,
  uid,
  getEffect,
  defaultParams,
} from '@omniframe/engine';

export type Page = 'landing' | 'editor';
export type Workspace = 'edit' | 'layers' | 'color' | 'mask' | 'maskTracking' | 'tracking' | 'omniframe' | '3d' | 'audio' | 'export';
export type LayoutMode = 'standard' | 'focus' | 'timeline' | 'viewer';
export type TimelineDisplay = 'timecode' | 'tenths' | 'frames';
export type MaskScope = 'frame' | 'range' | 'all';
export type ToolId = 'select' | 'trim' | 'blade' | 'mask' | 'brush' | 'lasso' | 'magic' | 'track' | 'omniframe' | 'text' | 'hand';
export type TrackFlag = 'locked' | 'muted' | 'solo' | 'hidden';

export interface JobView {
  id: string;
  title: string;
  stage: string;
  progress: number;
  status: 'idle' | 'running' | 'done' | 'failed' | 'cancelled';
  detail: string;
}

export interface EditorState {
  page: Page;
  workspace: Workspace;
  layoutMode: LayoutMode;
  showInspector: boolean;
  timelineDisplay: TimelineDisplay;
  project: ProjectFile;
  playhead: number;
  isPlaying: boolean;
  playbackRate: number;
  timelineZoom: number;
  previewZoom: string;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  activeTool: ToolId;
  snapping: boolean;
  guides: boolean;
  performance: 'AUTO' | 'QUALITY' | 'BALANCED' | 'PERFORMANCE' | 'ULTRA PREVIEW';
  maskScope: MaskScope;
  maskDisplay: MaskDisplayMode;
  maskBrushRadius: number;
  maskBrushHardness: number;
  trackingMethod: 'classical' | 'sam2';
  trackingPreset: TrackPreset;
  trackingRange: 'current' | 'inOut' | 'clip';
  selectedMask: Gray | null;
  maskPath: Array<{ x: number; y: number }>;
  frameBuffer: ImageData | null;
  importedAsset: Asset | null;
  showCommandPalette: boolean;
  showExport: boolean;
  showMediaBin: boolean;
  toast: string | null;
  job: JobView;
  history: History;
  set: (patch: Partial<EditorState>) => void;
  commitProject: (next: ProjectFile, label: string, patch?: Partial<Pick<EditorState, 'selectedClipId' | 'selectedTrackId' | 'toast'>>) => void;
  openEditor: () => void;
  openLanding: () => void;
  togglePlay: () => void;
  stepFrame: (delta: number, keepPlaying?: boolean) => void;
  setPlayhead: (frame: number) => void;
  setPlaybackRate: (rate: number) => void;
  setWorkspace: (workspace: Workspace) => void;
  setAspectRatio: (aspect: '16:9' | '1:1' | '9:16' | '4:5') => void;
  setTool: (tool: ToolId) => void;
  selectClip: (clipId: string | null, trackId?: string | null) => void;
  addTrack: (kind: TrackKind) => void;
  addAdjustmentTrack: () => void;
  toggleTrackFlag: (trackId: string, flag: TrackFlag) => void;
  addMarker: () => void;
  updateMarker: (id: string, patch: { label?: string; comment?: string; color?: string; endFrame?: number }) => void;
  splitAtPlayhead: () => void;
  duplicateSelected: () => void;
  deleteSelectedRipple: () => void;
  addTextClip: () => void;
  setClipOpacity: (opacity: number) => void;
  setClipBlend: (blend: Clip['blend']) => void;
  setClipTransform: (patch: Partial<Clip['transform']>) => void;
  setClipAudio: (patch: Partial<Pick<Clip, 'gain' | 'pan' | 'fadeIn' | 'fadeOut'>>) => void;
  trimSelected: (edge: 'head' | 'tail', frame: number, ripple?: boolean) => void;
  rollSelected: (delta: number) => void;
  slipSelected: (delta: number) => void;
  slideSelected: (delta: number) => void;
  moveSelected: (frame: number, ripple?: boolean) => void;
  setClipFlag: (flag: 'locked' | 'muted', value?: boolean) => void;
  addEffect: (effectId: string, params?: Record<string, number>) => void;
  removeEffect: (effectId: string) => void;
  setEffectParam: (effectId: string, key: string, value: number) => void;
  setKeyframe: (channel: string, value: number | number[] | string) => void;
  addOmniframeOp: (op: OmniframeOp) => void;
  addScene: (scene: Scene3D) => void;
  addImportedAsset: (asset: Asset) => void;
  updateAsset: (assetId: string, patch: Partial<Asset>) => void;
  commitMaskToClip: (mask: Gray, scope?: MaskScope) => void;
  commitTrackedMasks: (frames: Array<{ frame: number; mask: Gray }>, method: string, confidence: number | null) => void;
  setMask: (mask: Gray | null) => void;
  setMaskPath: (path: Array<{ x: number; y: number }>) => void;
  clearMask: () => void;
  saveProject: () => void;
  restoreAutosave: () => void;
  undo: () => void;
  redo: () => void;
  flash: (message: string) => void;
  runJob: (job: JobView) => void;
  finishJob: (patch: Partial<JobView>) => void;
}

const AUTOSAVE_KEY = 'omniframe.autosave.v3';

function emptyProject(): ProjectFile {
  return newProject('Untitled sequence');
}

function loadAutosave(): ProjectFile | null {
  try {
    const value = localStorage.getItem(AUTOSAVE_KEY);
    if (!value) return null;
    const parsed = deserializeProject(value);
    if (!validateProjectShape(parsed).ok) return null;
    // Blob URLs are scoped to the previous browser session and cannot be reopened from
    // a recovery snapshot. Keep the asset record for relink, but never pretend it is
    // available after a reload.
    for (const asset of parsed.assets) {
      if (asset.sourcePath.startsWith('blob:')) asset.missing = true;
    }
    return parsed;
  } catch {
    return null;
  }
}

const initialProject = loadAutosave() ?? emptyProject();
const initialHistory = new History();

function persist(project: ProjectFile, playhead: number, reason: 'autosave' | 'manual' = 'autosave'): void {
  try {
    const snapshot = structuredClone(project);
    recordAutosave(snapshot, playhead, reason);
    localStorage.setItem(AUTOSAVE_KEY, serializeProject(snapshot));
  } catch {
    // Storage quotas are not fatal to editing; manual .vxproj export remains available.
  }
}

function findSelected(project: ProjectFile, clipId: string | null): { track: Track; clip: Clip } | null {
  if (!clipId) return null;
  for (const track of project.sequences[0].tracks) {
    const clip = track.clips.find((item) => item.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  page: window.location.hash === '#editor' ? 'editor' : 'landing',
  workspace: 'edit',
  layoutMode: 'standard',
  showInspector: false,
  timelineDisplay: 'timecode',
  project: initialProject,
  playhead: Math.min(0, initialProject.sequences[0]?.duration ?? 0),
  isPlaying: false,
  playbackRate: 1,
  timelineZoom: 1,
  previewZoom: 'fit',
  selectedClipId: null,
  selectedTrackId: initialProject.sequences[0]?.tracks[0]?.id ?? null,
  activeTool: 'select',
  snapping: true,
  guides: true,
  performance: 'AUTO',
  maskScope: 'frame',
  maskDisplay: 'red',
  maskBrushRadius: 24,
  maskBrushHardness: 0.7,
  trackingMethod: 'classical',
  trackingPreset: 'balanced',
  trackingRange: 'clip',
  selectedMask: null,
  maskPath: [],
  frameBuffer: null,
  importedAsset: null,
  showCommandPalette: false,
  showExport: false,
  showMediaBin: false,
  toast: null,
  job: { id: '', title: '', stage: '', progress: 0, status: 'idle', detail: '' },
  history: initialHistory,
  set: (patch) => set(patch),
  commitProject: (next, label, patch = {}) => {
    const before = structuredClone(get().project);
    const after = structuredClone(next);
    get().history.execute(new FnCommand(
      label,
      () => set({ project: structuredClone(after) }),
      () => set({ project: structuredClone(before) }),
    ));
    persist(after, get().playhead);
    set({ project: after, ...patch });
  },
  openEditor: () => {
    window.location.hash = '#editor';
    set({ page: 'editor' });
  },
  openLanding: () => {
    window.location.hash = '';
    set({ page: 'landing' });
  },
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  stepFrame: (delta, keepPlaying = false) => set((s) => {
    const seq = s.project.sequences[0];
    const magnets = collectMagnets(seq.tracks.flatMap((t) => t.clips), seq.markers.map((m) => m.frame));
    const raw = Math.max(0, Math.min(Math.max(0, seq.duration - 1), s.playhead + delta));
    const frame = s.snapping && Math.abs(delta) === 1 ? snapFrame(raw, magnets, 0) : raw;
    return keepPlaying ? { playhead: frame } : { playhead: frame, isPlaying: false };
  }),
  setPlayhead: (frame) => set((s) => ({ playhead: Math.max(0, Math.min(Math.max(0, s.project.sequences[0].duration - 1), Math.round(frame))) })),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  setWorkspace: (workspace) => set({ workspace, activeTool: workspace === 'mask' ? 'mask' : workspace === 'maskTracking' ? 'track' : workspace === 'tracking' ? 'track' : workspace === 'omniframe' ? 'omniframe' : 'select' }),
  setAspectRatio: (aspect) => {
    const dimensions: Record<'16:9' | '1:1' | '9:16' | '4:5', [number, number]> = {
      '16:9': [1920, 1080],
      '1:1': [1080, 1080],
      '9:16': [1080, 1920],
      '4:5': [1080, 1350],
    };
    const [width, height] = dimensions[aspect];
    const next = structuredClone(get().project);
    next.sequences[0].width = width;
    next.sequences[0].height = height;
    next.renderSettings.width = width;
    next.renderSettings.height = height;
    get().commitProject(next, `Set sequence to ${aspect}`);
  },
  setTool: (activeTool) => set({ activeTool }),
  selectClip: (selectedClipId, selectedTrackId = null) => set({ selectedClipId, selectedTrackId }),
  addTrack: (kind) => {
    const s = get();
    const next = structuredClone(s.project);
    const count = next.sequences[0].tracks.filter((t) => t.kind === kind).length + 1;
    next.sequences[0].tracks.push(newTrack(kind, `${kind === 'audio' ? 'A' : kind === 'scene3d' ? '3D' : 'V'}${count}`));
    s.commitProject(next, `Add ${kind} track`, { toast: `${kind} track added.` });
  },
  addAdjustmentTrack: () => {
    const s = get();
    const next = structuredClone(s.project);
    const track = newTrack('adjustment', `ADJ${next.sequences[0].tracks.filter((t) => t.kind === 'adjustment').length + 1}`);
    track.isAdjustment = true;
    next.sequences[0].tracks.unshift(track);
    s.commitProject(next, 'Add adjustment track', { selectedTrackId: track.id, toast: 'Adjustment track added above the stack.' });
  },
  toggleTrackFlag: (trackId, flag) => {
    const s = get();
    const next = structuredClone(s.project);
    const track = next.sequences[0].tracks.find((item) => item.id === trackId);
    if (!track) return;
    track[flag] = !track[flag];
    s.commitProject(next, `${track[flag] ? 'Enable' : 'Disable'} track ${flag}`, { toast: `${track.name} ${flag} ${track[flag] ? 'on' : 'off'}.` });
  },
  addMarker: () => {
    const s = get();
    const next = structuredClone(s.project);
    next.sequences[0].markers.push({ id: uid('marker'), frame: s.playhead, endFrame: s.playhead, label: 'Marker', comment: '', color: '#d8ff63' });
    s.commitProject(next, 'Add marker', { toast: `Marker added at ${formatTimecode(s.playhead, next.sequences[0].fps)}` });
  },
  updateMarker: (id, patch) => {
    const s = get();
    const next = structuredClone(s.project);
    const marker = next.sequences[0].markers.find((item) => item.id === id);
    if (!marker) return;
    Object.assign(marker, patch);
    s.commitProject(next, 'Update marker');
  },
  splitAtPlayhead: () => {
    const s = get();
    const selected = findSelected(s.project, s.selectedClipId);
    if (!selected) { set({ toast: 'Select a clip before splitting.' }); return; }
    if (s.playhead <= selected.clip.start || s.playhead >= clipEnd(selected.clip)) { set({ toast: 'The playhead must be inside the selected clip.' }); return; }
    const split = splitClip(selected.clip, s.playhead);
    if (!split) { set({ toast: 'This clip cannot be split at that frame.' }); return; }
    const next = structuredClone(s.project);
    const track = next.sequences[0].tracks.find((item) => item.id === selected.track.id)!;
    const index = track.clips.findIndex((item) => item.id === selected.clip.id);
    track.clips.splice(index, 1, split[0], split[1]);
    s.commitProject(next, 'Split clip', { selectedClipId: split[1].id, selectedTrackId: track.id, toast: 'Clip split at the playhead.' });
  },
  duplicateSelected: () => {
    const s = get();
    const selected = findSelected(s.project, s.selectedClipId);
    if (!selected) { set({ toast: 'Select a clip before duplicating.' }); return; }
    const next = structuredClone(s.project);
    const track = next.sequences[0].tracks.find((item) => item.id === selected.track.id)!;
    const copy = duplicateClip(selected.clip);
    track.clips.push(copy);
    next.sequences[0].duration = Math.max(next.sequences[0].duration, clipEnd(copy));
    s.commitProject(next, 'Duplicate clip', { selectedClipId: copy.id, selectedTrackId: track.id, toast: 'Clip duplicated after the source.' });
  },
  deleteSelectedRipple: () => {
    const s = get();
    const selected = findSelected(s.project, s.selectedClipId);
    if (!selected) { set({ toast: 'Select a clip before deleting.' }); return; }
    const next = structuredClone(s.project);
    const track = next.sequences[0].tracks.find((item) => item.id === selected.track.id)!;
    track.clips = rippleDelete(track.clips, selected.clip.id);
    next.sequences[0].duration = Math.max(1, Math.max(...next.sequences[0].tracks.flatMap((t) => t.clips.map(clipEnd)), 1));
    s.commitProject(next, 'Ripple delete', { selectedClipId: null, toast: 'Clip deleted and the gap was closed.' });
  },
  addTextClip: () => {
    const s = get();
    const next = structuredClone(s.project);
    let track = next.sequences[0].tracks.find((t) => t.kind === 'text');
    if (!track) {
      track = newTrack('text', 'Text 1');
      next.sequences[0].tracks.splice(1, 0, track);
    }
    const c = newClip({ id: uid('text'), kind: 'text', name: 'Title · double click to edit', start: s.playhead, sourceIn: 0, sourceOut: 60, color: '#7568a8' });
    track.clips.push(c);
    next.sequences[0].duration = Math.max(next.sequences[0].duration, clipEnd(c));
    s.commitProject(next, 'Add text clip', { selectedClipId: c.id, selectedTrackId: track.id, toast: 'Text clip added to the timeline.' });
  },
  setClipOpacity: (opacity) => get().setClipTransform({ opacity }),
  setClipBlend: (blend) => {
    const s = get();
    const next = structuredClone(s.project);
    const selected = findSelected(next, s.selectedClipId);
    if (!selected) return;
    selected.clip.blend = blend;
    s.commitProject(next, `Set clip blend to ${blend}`);
  },
  setClipTransform: (patch) => {
    const s = get();
    const next = structuredClone(s.project);
    const selected = findSelected(next, s.selectedClipId);
    if (!selected) return;
    selected.clip.transform = { ...selected.clip.transform, ...patch };
    s.commitProject(next, 'Set clip transform');
  },
  setClipAudio: (patch) => {
    const s = get();
    const next = structuredClone(s.project);
    const selected = findSelected(next, s.selectedClipId);
    if (!selected) return;
    Object.assign(selected.clip, patch);
    s.commitProject(next, 'Set clip audio');
  },
  trimSelected: (edge, frame, ripple = false) => {
    const s = get();
    const selected = findSelected(s.project, s.selectedClipId);
    if (!selected) { set({ toast: 'Select a clip before trimming.' }); return; }
    const next = structuredClone(s.project);
    const track = next.sequences[0].tracks.find((item) => item.id === selected.track.id)!;
    const clips = ripple ? rippleTrim(track.clips, selected.clip.id, { edge, frame }) : track.clips.map((item) => item.id === selected.clip.id ? trimClip(item, { edge, frame }) ?? item : item);
    track.clips = clips;
    next.sequences[0].duration = Math.max(1, Math.max(...next.sequences[0].tracks.flatMap((t) => t.clips.map(clipEnd)), 1));
    s.commitProject(next, `${ripple ? 'Ripple ' : ''}trim ${edge}`, { toast: `${ripple ? 'Ripple ' : ''}${edge} trim applied.` });
  },
  rollSelected: (delta) => {
    const s = get();
    const selected = findSelected(s.project, s.selectedClipId);
    if (!selected) return set({ toast: 'Select the left clip at a join to roll edit.' });
    const next = structuredClone(s.project);
    const track = next.sequences[0].tracks.find((item) => item.id === selected.track.id)!;
    const result = rollEdit(track.clips, selected.clip.id, delta);
    if (!result) return set({ toast: 'Roll edit needs adjacent clips and available source frames.' });
    track.clips = result;
    s.commitProject(next, 'Roll edit', { toast: 'Roll edit moved the join without changing sequence length.' });
  },
  slipSelected: (delta) => {
    const s = get();
    const selected = findSelected(s.project, s.selectedClipId);
    if (!selected) return set({ toast: 'Select a clip before slipping its source window.' });
    const next = structuredClone(s.project);
    const track = next.sequences[0].tracks.find((item) => item.id === selected.track.id)!;
    const result = slipEdit(track.clips, selected.clip.id, delta);
    if (!result) return set({ toast: 'Slip edit reached the source media boundary.' });
    track.clips = result;
    s.commitProject(next, 'Slip edit', { toast: 'Slip edit changed the source window, not the clip timing.' });
  },
  slideSelected: (delta) => {
    const s = get();
    const selected = findSelected(s.project, s.selectedClipId);
    if (!selected) return set({ toast: 'Select a clip before sliding it.' });
    const next = structuredClone(s.project);
    const track = next.sequences[0].tracks.find((item) => item.id === selected.track.id)!;
    const result = slideEdit(track.clips, selected.clip.id, delta);
    if (!result) return set({ toast: 'Slide edit needs neighbouring media with available frames.' });
    track.clips = result;
    s.commitProject(next, 'Slide edit', { toast: 'Slide edit moved the clip while preserving its neighbours.' });
  },
  moveSelected: (frame, ripple = false) => {
    const s = get();
    const selected = findSelected(s.project, s.selectedClipId);
    if (!selected) return;
    const next = structuredClone(s.project);
    const track = next.sequences[0].tracks.find((item) => item.id === selected.track.id)!;
    track.clips = moveClip(track.clips, selected.clip.id, frame, ripple);
    next.sequences[0].duration = Math.max(next.sequences[0].duration, ...track.clips.map(clipEnd));
    s.commitProject(next, 'Move clip', { toast: 'Clip moved with frame snapping.' });
  },
  setClipFlag: (flag, value) => {
    const s = get();
    const next = structuredClone(s.project);
    const selected = findSelected(next, s.selectedClipId);
    if (!selected) return;
    selected.clip[flag] = value ?? !selected.clip[flag];
    s.commitProject(next, `Set clip ${flag}`, { toast: `${selected.clip.name} ${flag} ${selected.clip[flag] ? 'on' : 'off'}.` });
  },
  addEffect: (effectId, params = {}) => {
    const s = get();
    const next = structuredClone(s.project);
    const selected = findSelected(next, s.selectedClipId);
    const def = getEffect(effectId);
    if (!selected || !def) return set({ toast: 'Select a clip before adding an effect.' });
    const effect: EffectInstance = { id: uid('effect'), effectId, version: def.version, enabled: true, params: { ...defaultParams(def), ...params }, keyframes: {}, blend: 'normal', opacity: 1 };
    selected.clip.effects.push(effect);
    s.commitProject(next, `Add ${def.name}`, { toast: `${def.name} added. Preview and export use the same CPU definition.` });
  },
  removeEffect: (effectId) => {
    const s = get();
    const next = structuredClone(s.project);
    const selected = findSelected(next, s.selectedClipId);
    if (!selected) return;
    selected.clip.effects = selected.clip.effects.filter((effect) => effect.id !== effectId);
    s.commitProject(next, 'Remove effect');
  },
  setEffectParam: (effectId, key, value) => {
    const s = get();
    const next = structuredClone(s.project);
    const selected = findSelected(next, s.selectedClipId);
    const effect = selected?.clip.effects.find((item) => item.id === effectId);
    if (!effect) return;
    effect.params[key] = value;
    s.commitProject(next, 'Set effect parameter');
  },
  setKeyframe: (channel, value) => {
    const s = get();
    const next = structuredClone(s.project);
    const selected = findSelected(next, s.selectedClipId);
    if (!selected) return set({ toast: 'Select a clip before setting a keyframe.' });
    const keyframe: Keyframe = { frame: Math.max(0, s.playhead - selected.clip.start), value, easing: 'easeInOut' };
    const channelKey = channel;
    const channelFrames = selected.clip.keyframes[channelKey] ?? [];
    selected.clip.keyframes[channelKey] = [...channelFrames.filter((item) => item.frame !== keyframe.frame), keyframe].sort((a, b) => a.frame - b.frame);
    s.commitProject(next, `Set ${channelKey} keyframe`, { toast: `Keyframe set at ${formatTimecode(s.playhead, next.sequences[0].fps)}.` });
  },
  addOmniframeOp: (op) => {
    const s = get();
    const next = structuredClone(s.project);
    next.omniframe.push(op);
    const selected = findSelected(next, s.selectedClipId);
    if (selected && !selected.clip.omniframeOpIds.includes(op.id)) selected.clip.omniframeOpIds.push(op.id);
    s.commitProject(next, 'Add Omniframe operation', { toast: `${op.name} stored as a non-destructive operation.` });
  },
  addScene: (scene) => {
    const s = get();
    const next = structuredClone(s.project);
    next.scenes3d.push(scene);
    s.commitProject(next, 'Add 3D scene', { toast: `${scene.name} stored in the project.` });
  },
  addImportedAsset: (asset) => set((s) => {
    const next = structuredClone(s.project);
    next.assets.push(asset);
    const sequence = next.sequences[0];
    const start = sequence.duration > 0 ? sequence.duration : 0;
    const isAudio = asset.kind === 'audio';
    const clip = newClip({ assetId: asset.id, name: asset.name, sourceIn: 0, sourceOut: Math.max(1, Math.round(asset.duration * (asset.fps || 30))), start, kind: isAudio ? 'audio' : asset.kind === 'model' ? 'scene3d' : 'video', color: isAudio ? '#7c6242' : asset.kind === 'model' ? '#8769bb' : '#2b7180' });
    let track = sequence.tracks.find((t) => t.kind === clip.kind);
    if (!track) { track = newTrack(clip.kind); sequence.tracks.push(track); }
    track.clips.push(clip);
    sequence.duration = Math.max(sequence.duration, clipEnd(clip));
    persist(next, s.playhead);
    return { project: next, importedAsset: asset, selectedClipId: clip.id, selectedTrackId: track.id, toast: `${asset.name} imported locally.` };
  }),
  updateAsset: (assetId, patch) => set((s) => {
    const next = structuredClone(s.project);
    const asset = next.assets.find((item) => item.id === assetId);
    if (!asset) return s;
    Object.assign(asset, patch);
    persist(next, s.playhead);
    return { project: next };
  }),
  commitMaskToClip: (mask, scope = get().maskScope) => {
    const s = get();
    const next = structuredClone(s.project);
    const selected = findSelected(next, s.selectedClipId);
    if (!selected) { set({ toast: 'Select a video clip before committing a mask.' }); return; }
    let instance = selected.clip.masks[0];
    if (!instance) {
      instance = { id: uid('mask'), name: 'Subject mask', frames: {}, inverted: false, feather: 0, grow: 0, mode: s.maskDisplay };
      selected.clip.masks.push(instance);
    }
    instance.mode = s.maskDisplay;
    const localPlayhead = Math.max(0, s.playhead - selected.clip.start);
    const start = scope === 'all' ? 0 : scope === 'range' ? Math.max(0, localPlayhead - 15) : localPlayhead;
    const end = scope === 'all' ? clipLength(selected.clip) : scope === 'range' ? Math.min(clipLength(selected.clip), start + 30) : start + 1;
    for (let frame = Math.max(0, start); frame < Math.max(start + 1, end); frame++) { const encoded = encodeRle(mask); instance.frames[frame] = { runs: Int32Array.from(encoded.runs), width: encoded.width, height: encoded.height }; }
    instance.trackedFrom = { frame: Math.max(0, s.playhead - selected.clip.start), method: 'manual', confidence: 1 };
    s.commitProject(next, `Commit ${scope} mask`, { toast: `${scope === 'frame' ? 'This frame' : scope === 'range' ? 'Range' : 'All frames'} mask stored non-destructively.` });
  },
  commitTrackedMasks: (frames, method, confidence) => {
    const s = get();
    const next = structuredClone(s.project);
    const selected = findSelected(next, s.selectedClipId);
    if (!selected) { set({ toast: 'Select a video clip before committing tracked masks.' }); return; }
    let instance = selected.clip.masks[0];
    if (!instance) {
      instance = { id: uid('mask'), name: 'Subject mask', frames: {}, inverted: false, feather: 0, grow: 0, mode: s.maskDisplay };
      selected.clip.masks.push(instance);
    }
    instance.mode = s.maskDisplay;
    for (const item of frames) {
      const frame = Math.max(0, Math.min(clipLength(selected.clip) - 1, Math.round(item.frame)));
      const encoded = encodeRle(item.mask);
      instance.frames[frame] = { runs: Int32Array.from(encoded.runs), width: encoded.width, height: encoded.height };
    }
    instance.trackedFrom = { frame: Math.max(0, s.playhead - selected.clip.start), method, ...(confidence === null ? {} : { confidence }) };
    s.commitProject(next, `Commit ${method} tracked masks`, { toast: `${frames.length} measured ${method} mask frames stored.` });
  },
  setMask: (selectedMask) => set({ selectedMask }),
  setMaskPath: (maskPath) => set({ maskPath }),
  clearMask: () => set({ selectedMask: null, maskPath: [], toast: 'Current viewer mask cleared.' }),
  saveProject: () => {
    const project = structuredClone(get().project);
    project.savedAt = Date.now();
    persist(project, get().playhead, 'manual');
    const text = serializeProject(project);
    const blob = new Blob([text], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = href; a.download = `${project.name.replace(/\s+/g, '-').toLowerCase()}.vxproj`; a.click(); URL.revokeObjectURL(href);
    set({ project, toast: 'Project saved as .vxproj and autosaved locally.' });
  },
  restoreAutosave: () => {
    const project = loadAutosave();
    if (!project) return set({ toast: 'No valid local recovery snapshot was found.' });
    set({ project, selectedClipId: null, selectedTrackId: project.sequences[0]?.tracks[0]?.id ?? null, toast: 'Local recovery snapshot restored.' });
  },
  undo: () => set((s) => { s.history.undo(); persist(s.project, s.playhead); return { project: structuredClone(s.project), toast: 'Undo.' }; }),
  redo: () => set((s) => { s.history.redo(); persist(s.project, s.playhead); return { project: structuredClone(s.project), toast: 'Redo.' }; }),
  flash: (toast) => set({ toast }),
  runJob: (job) => set({ job: { ...job, status: 'running' } }),
  finishJob: (patch) => set((s) => ({ job: { ...s.job, ...patch } })),
}));

export function formatTimecode(frame: number, fps: number): string {
  const safeFps = Math.max(1, fps);
  const totalSeconds = Math.floor(frame / safeFps);
  const ff = Math.floor(frame % safeFps).toString().padStart(2, '0');
  const ss = (totalSeconds % 60).toString().padStart(2, '0');
  const mm = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  return `${mm}:${ss}:${ff}`;
}

export function formatTimelinePosition(frame: number, fps: number, display: TimelineDisplay): string {
  const safeFrame = Math.max(0, Math.round(frame));
  if (display === 'frames') return `${safeFrame}f`;
  if (display === 'tenths') return `${(safeFrame / Math.max(1, fps)).toFixed(1)}s`;
  return formatTimecode(safeFrame, fps);
}

export function activeSequence(project: ProjectFile): Sequence {
  return project.sequences.find((item) => item.id === project.activeSequenceId) ?? project.sequences[0];
}

export function selectedClip(state: EditorState): Clip | null {
  return findSelected(state.project, state.selectedClipId)?.clip ?? null;
}

export function trackName(track: Track): string {
  return track.name || track.kind.toUpperCase();
}
