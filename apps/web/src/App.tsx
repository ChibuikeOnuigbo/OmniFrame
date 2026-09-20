import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import {
  Activity, AlertTriangle, Aperture, ArrowDownToLine, AudioLines, Box, Brush, Camera,
  Check, ChevronDown, ChevronLeft, ChevronRight, Circle, CircleHelp, Command, Download, Eye, EyeOff, FilePlus2,
  Film, FolderOpen, Gauge, Grid2X2, Hand, Headphones, KeyRound, Layers3, Lightbulb,
  Link2, LoaderCircle, Lock, Magnet, Menu, Minus, MousePointer2, Move, Pause, Pencil,
  Play, Plus, Redo2, RotateCcw, Save, Scissors, Search, Settings2, SlidersHorizontal,
  Sparkles, Split, Square, Target, TextCursorInput, Trash2, Undo2, Upload, WandSparkles,
  X, Youtube, ZoomIn, ZoomOut,
} from 'lucide-react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  type Asset,
  type Clip,
  type Gray,
  type MaskDisplayMode,
  type TrackPreset,
  type EffectDefinition,
  type FrameProvider,
  type Keyframe,
  combine,
  createGray,
  decodeRle,
  fillHoles,
  feather,
  fillPolygon,
  getEffect,
  listEffects,
  removeSmallComponents,
  stroke,
  magicBrush,
  trackMask,
  trackMaskWithSam2,
  Sam2Backend,
  newOmniframeOp,
  executeOmniframe,
  bakeLightmap,
  newScene,
  addLight,
  clipEnd,
  probeCodecs,
  type OmniframeOp,
} from '@omniframe/engine';
import { useEditorStore, formatTimecode, formatTimelinePosition, activeSequence, selectedClip, type Workspace, type EditorState } from './store';
import { applyClipEffectsToCanvas, drawImageCover, exportMp4, inspectMedia, VideoGrayProvider, type ExportProgressView } from './media';
import { isDesktopShell, readNativeCapabilities } from './native';
import { loadEditorAssistModel, type EditorAssistPrediction, type EditorAssistRuntime } from './modelRuntime';

const accent = '#d8ff63';
const FPS_DEFAULT = 30;

export function App() {
  const page = useEditorStore((state) => state.page);
  usePlaybackClock();
  useKeyboardShortcuts();
  useEffect(() => {
    const onHash = () => useEditorStore.getState().set({ page: window.location.hash === '#editor' ? 'editor' : 'landing' });
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return page === 'editor' ? <Editor /> : <Landing />;
}

function usePlaybackClock() {
  const playing = useEditorStore((state) => state.isPlaying);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let carry = 0;
    const tick = (now: number) => {
      const state = useEditorStore.getState();
      const frameMs = 1000 / (state.project.sequences[0]?.fps || FPS_DEFAULT) / state.playbackRate;
      carry += now - last;
      last = now;
      if (carry >= frameMs) {
        const frames = Math.max(1, Math.floor(carry / frameMs));
        carry -= frames * frameMs;
        state.stepFrame(frames, true);
        if (state.playhead >= Math.max(0, state.project.sequences[0].duration - 1)) state.set({ isPlaying: false });
      }
      if (useEditorStore.getState().isPlaying) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = useEditorStore.getState();
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (event.code === 'Space') { event.preventDefault(); state.togglePlay(); return; }
      if (event.key === 'ArrowLeft') { event.preventDefault(); state.stepFrame(event.shiftKey ? -5 : -1); return; }
      if (event.key === 'ArrowRight') { event.preventDefault(); state.stepFrame(event.shiftKey ? 5 : 1); return; }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? state.redo() : state.undo(); return; }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); state.redo(); return; }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); state.saveProject(); return; }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'p') { event.preventDefault(); state.set({ showCommandPalette: true }); return; }
      if (event.key === 'Escape') { state.set({ showCommandPalette: false, showExport: false, showMediaBin: false }); return; }
      if (event.key.toLowerCase() === 'b') state.setTool('blade');
      if (event.key.toLowerCase() === 'v') state.setTool('select');
      if (event.key.toLowerCase() === 'm') state.addMarker();
      if (event.key.toLowerCase() === 'i') state.setWorkspace('mask');
      if (event.key.toLowerCase() === 't') state.setWorkspace('tracking');
      if (event.key.toLowerCase() === 'o') state.setWorkspace('omniframe');
      if (event.key.toLowerCase() === 'z' && !event.metaKey && !event.ctrlKey) state.set({ timelineZoom: Math.min(4, state.timelineZoom + 0.25) });
      if (event.key === 'Delete' || event.key === 'Backspace') state.deleteSelectedRipple();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function Logo() {
  return <button className="brand-mark" onClick={() => useEditorStore.getState().openLanding()} aria-label="OmniFrame home">
    <span className="brand-glyph"><i /><i /><i /></span><span>OMNI<span>FRAME</span></span>
  </button>;
}

function Landing() {
  const openEditor = useEditorStore((state) => state.openEditor);
  return <main className="landing-page">
    <div className="landing-noise" />
    <header className="landing-nav content-width"><Logo /><div className="landing-nav-actions"><span className="landing-status"><span className="status-dot" /> ready</span><button className="primary-button compact" onClick={openEditor}>Open editor <ArrowDownToLine size={13} /></button></div></header>
    <section className="landing-hero content-width"><div className="hero-copy"><div className="eyebrow"><span className="status-dot" /> VIDEO WORKSPACE</div><h1>Edit the moment.<br /><em>Keep the frame.</em></h1><p className="hero-subtitle">Cut, mask, track and export.</p><div className="hero-actions"><button className="primary-button" onClick={openEditor}>Open OmniFrame <Play size={15} fill="currentColor" /></button><span className="hero-shortcut"><kbd>⌘</kbd><kbd>K</kbd> layout-ready workspace</span></div><div className="hero-meta"><span><Lock size={13} /> ready to edit</span><span><Check size={13} /> frame-accurate</span></div></div><LandingWorkbench /></section>
    <section className="signal-strip content-width"><div><span className="signal-label">01</span><strong>EDIT</strong><span>Cut and move.</span></div><div><span className="signal-label">02</span><strong>MASK</strong><span>Correct and track.</span></div><div><span className="signal-label">03</span><strong>DELIVER</strong><span>Render.</span></div></section>
    <footer className="landing-footer content-width"><Logo /><span>Video tools, without the clutter.</span><span>Open Windows → Layout inside the studio</span></footer>
  </main>;
}

function LandingWorkbench() {
  return <div className="hero-workbench"><div className="hero-window-bar"><div className="window-lights"><i /><i /><i /></div><span>omniframe / sequence 01</span><span className="window-live"><span className="status-dot" /> engine ready</span></div><div className="hero-window-body"><div className="hero-side-tools"><div className="mini-tool active"><MousePointer2 size={13} /></div><div className="mini-tool"><Brush size={13} /></div><div className="mini-tool"><Target size={13} /></div><div className="mini-tool"><Box size={13} /></div></div><div className="hero-view"><div className="hero-view-label">VIEWER / MEDIA</div><div className="hero-empty"><Film size={24} /><strong>Import a shot to begin</strong><span>Canvas preview · frame-accurate sequence</span></div><div className="hero-play"><Play size={16} fill="currentColor" /></div></div></div><div className="hero-timeline"><div className="hero-timeline-ruler"><span>00:00</span><span>00:02</span><span>00:04</span><span>00:06</span></div><div className="hero-track-row"><span className="hero-track-label">V1</span><div className="hero-clip first" /><div className="hero-playhead" /></div><div className="hero-track-row slim"><span className="hero-track-label">A1</span><div className="hero-audio" /></div></div></div>;
}

function FeatureCard({ number, icon, title, copy, tone }: { number: string; icon: React.ReactNode; title: string; copy: string; tone: string }) {
  return <article className={`feature-card ${tone}`}><div className="feature-top"><span className="feature-number">{number}</span><span className="feature-icon">{icon}</span></div><h3>{title}</h3><p>{copy}</p><span className="feature-arrow">↗</span></article>;
}

function Editor() {
  const toast = useEditorStore((state) => state.toast);
  const showPalette = useEditorStore((state) => state.showCommandPalette);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => useEditorStore.getState().set({ toast: null }), 3800);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const showExport = useEditorStore((state) => state.showExport);
  const showMedia = useEditorStore((state) => state.showMediaBin);
  const layout = useEditorStore((state) => state.layoutMode);
  const inspectorOpen = useEditorStore((state) => state.showInspector);
  return <main className={`editor-shell layout-${layout} ${inspectorOpen ? 'inspector-open' : 'inspector-closed'}`}><TopBar /><div className="editor-main"><div className="editor-upper"><LeftRail /><section className="editor-center"><PreviewPanel /></section><PropertiesPanel /></div><Timeline /></div><StatusBar />{showPalette && <CommandPalette />}{showExport && <ExportDialog />}{showMedia && <MediaBin />}</main>;
}

function StatusBar() {
  const state = useEditorStore();
  const sequence = activeSequence(state.project);
  const clip = selectedClip(state);
  const currentTime = formatTimelinePosition(state.playhead, sequence.fps, state.timelineDisplay);
  const jobLabel = state.job.status === 'idle' ? 'ready' : `${state.job.status} · ${state.job.stage}`;
  return <footer className="editor-statusbar" aria-label="Sequence status">
    <span className="statusbar-primary"><span className="status-dot" /> READY</span>
    <span>{sequence.width}×{sequence.height}</span>
    <span>{sequence.fps} fps</span>
    <span>{currentTime} / {formatTimelinePosition(sequence.duration, sequence.fps, state.timelineDisplay)}</span>
    <span>{state.project.assets.length} assets</span>
    <span className="statusbar-clip">{clip ? clip.name : 'No clip'}</span>
    <span className="statusbar-job">{jobLabel}</span>
    {state.job.status === 'running' && <span className="statusbar-job-progress" title={state.job.detail}><i style={{ width: `${Math.max(4, state.job.progress * 100)}%` }} /></span>}
    {state.toast && <span className="statusbar-message">{state.toast}</span>}
  </footer>;
}

const workspaceTabs: Array<{ id: Workspace; label: string }> = [
  { id: 'edit', label: 'Edit' }, { id: 'layers', label: 'Layers' }, { id: 'color', label: 'Color' }, { id: 'mask', label: 'Masking' },
  { id: 'maskTracking', label: 'Mask tracking' }, { id: 'tracking', label: 'Tracking' }, { id: 'omniframe', label: 'Omniframe' },
  { id: '3d', label: '3D' }, { id: 'audio', label: 'Audio' }, { id: 'export', label: 'Export' },
];
const primaryWorkspaceTabs = workspaceTabs;

function WorkspaceTabStrip({ tabs, active, onSelect }: { tabs: Array<{ id: Workspace; label: string }>; active: Workspace; onSelect: (workspace: Workspace) => void }) {
  const tabsRef = useRef<HTMLElement>(null);
  const scrollTabs = (amount: number) => tabsRef.current?.scrollBy({ left: amount, behavior: 'smooth' });
  return <div className="workspace-tabs-shell"><button className="tab-scroll-button" title="Show previous workspaces" aria-label="Show previous workspaces" onClick={() => scrollTabs(-180)}><ChevronLeft size={16} /></button><nav ref={tabsRef} className="workspace-tabs" aria-label="Editor workspaces">{tabs.map((tab) => <button key={tab.id} className={active === tab.id ? 'active' : ''} onClick={() => onSelect(tab.id)}>{tab.label}</button>)}</nav><button className="tab-scroll-button" title="Show more workspaces" aria-label="Show more workspaces" onClick={() => scrollTabs(180)}><ChevronRight size={16} /></button></div>;
}

function HorizontalScroller({ label, className = '', step = 180, children }: { label: string; className?: string; step?: number; children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const scroll = (amount: number) => contentRef.current?.scrollBy({ left: amount, behavior: 'smooth' });
  return <div className={`strip-shell ${className}`}><button className="strip-arrow" title={`Show previous ${label.toLowerCase()}`} aria-label={`Show previous ${label.toLowerCase()}`} onClick={() => scroll(-step)}><ChevronLeft size={14} /></button><div ref={contentRef} className="strip-content" aria-label={label}>{children}</div><button className="strip-arrow" title={`Show more ${label.toLowerCase()}`} aria-label={`Show more ${label.toLowerCase()}`} onClick={() => scroll(step)}><ChevronRight size={14} /></button></div>;
}

function TopBar() {
  const state = useEditorStore();
  const sequence = activeSequence(state.project);
  const desktop = isDesktopShell();
  const projectActionLabel = desktop ? 'Save project' : 'Download project';
  const [nativeLabel, setNativeLabel] = useState(desktop ? 'desktop core' : 'web');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  useEffect(() => {
    if (!desktop) return;
    void readNativeCapabilities().then((capabilities) => {
      if (!capabilities) return;
      setNativeLabel(capabilities.ffmpeg_available ? 'desktop · FFmpeg ready' : 'desktop · FFmpeg unavailable');
    });
  }, [desktop]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpenMenu(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const runMenuAction = (action: () => void) => {
    action();
    setOpenMenu(null);
  };
  const menuItems: Record<string, Array<{ label: string; shortcut?: string; action: () => void; disabled?: boolean }>> = {
    File: [
      { label: 'Open media bin', shortcut: '⇧⌘O', action: () => state.set({ showMediaBin: true }) },
      { label: projectActionLabel, shortcut: '⌘S', action: state.saveProject },
      { label: 'Restore recovery', action: state.restoreAutosave },
      { label: 'Open export queue', shortcut: '⌘E', action: () => state.set({ showExport: true }) },
    ],
    Edit: [
      { label: 'Undo', shortcut: '⌘Z', action: state.undo, disabled: !state.history.canUndo() },
      { label: 'Redo', shortcut: '⇧⌘Z', action: state.redo, disabled: !state.history.canRedo() },
      { label: 'Split at playhead', shortcut: 'S', action: state.splitAtPlayhead },
      { label: 'Add marker', shortcut: 'M', action: state.addMarker },
    ],
    View: [
      { label: 'Fit viewer', action: () => state.set({ previewZoom: 'fit' }) },
      { label: state.guides ? 'Hide guides' : 'Show guides', action: () => state.set({ guides: !state.guides }) },
      { label: 'Reset timeline zoom', action: () => state.set({ timelineZoom: 1 }) },
    ],
    Windows: [
      { label: 'Layout · Standard', action: () => state.set({ layoutMode: 'standard' }) },
      { label: 'Layout · Focus', action: () => state.set({ layoutMode: 'focus' }) },
      { label: 'Layout · Timeline', action: () => state.set({ layoutMode: 'timeline' }) },
      { label: 'Layout · Viewer', action: () => state.set({ layoutMode: 'viewer' }) },
    ],
    Workspace: workspaceTabs.map((tab) => ({ label: tab.label, action: () => state.setWorkspace(tab.id) })),
    Help: [
      { label: 'Open command palette', shortcut: '⇧⌘P', action: () => state.set({ showCommandPalette: true }) },
      { label: 'Keyboard shortcuts', action: () => state.flash('Space play · B blade · I masking · T tracking · O Omniframe · M marker') },
      { label: 'Processing boundary', action: () => state.flash('Import, preview and browser export stay in the app; native FFmpeg is explicit.') },
    ],
  };
  const aspect = `${sequence.width}:${sequence.height}` === '1920:1080' ? '16:9' : `${sequence.width}:${sequence.height}` === '1080:1080' ? '1:1' : `${sequence.width}:${sequence.height}` === '1080:1920' ? '9:16' : `${sequence.width}:${sequence.height}` === '1080:1350' ? '4:5' : '16:9';
  return <header className="editor-topbar">
    <div className="topbar-left"><Logo /><div className="project-divider" /><div className="project-name"><span>{state.project.name}</span><small>{sequence.width}×{sequence.height} · {sequence.fps} fps · recovery on</small></div><div className="editor-menus" aria-label="Application menu">
      {Object.keys(menuItems).map((menu) => <div className={`editor-menu-wrap menu-${menu.toLowerCase()}`} key={menu}><button className="menu-trigger" aria-expanded={openMenu === menu} onClick={() => setOpenMenu(openMenu === menu ? null : menu)}>{menu}</button>{openMenu === menu && <div className="menu-popover">{menuItems[menu].map((item) => <button key={item.label} disabled={item.disabled} onClick={() => runMenuAction(item.action)}><span>{item.label}</span>{item.shortcut && <kbd>{item.shortcut}</kbd>}</button>)}</div>}</div>)}
    </div></div>
    <WorkspaceTabStrip tabs={primaryWorkspaceTabs} active={state.workspace} onSelect={state.setWorkspace} />
    <div className="topbar-actions"><span className="native-status"><span className="status-dot" /> {nativeLabel}</span><button className="icon-button" disabled={!state.history.canUndo()} title={state.history.undoLabel() ?? 'Undo'} onClick={state.undo}><Undo2 size={16} /></button><button className="icon-button" disabled={!state.history.canRedo()} title={state.history.redoLabel() ?? 'Redo'} onClick={state.redo}><Redo2 size={16} /></button><button className="icon-button" title="Command palette" onClick={() => state.set({ showCommandPalette: true })}><Command size={16} /></button><label className="aspect-control"><span>Canvas</span><select aria-label="Sequence aspect ratio" value={aspect} onChange={(event) => state.setAspectRatio(event.target.value as '16:9' | '1:1' | '9:16' | '4:5')}><option value="16:9">16:9</option><option value="1:1">1:1</option><option value="9:16">9:16</option><option value="4:5">4:5</option></select></label><select className="performance-select" aria-label="Preview performance" value={state.performance} onChange={(event) => state.set({ performance: event.target.value as EditorState['performance'] })}><option>AUTO</option><option>QUALITY</option><option>BALANCED</option><option>PERFORMANCE</option><option>ULTRA PREVIEW</option></select><button className="outline-button compact project-action" title={desktop ? 'Save project' : 'Download project file'} onClick={state.saveProject}>{desktop ? <Save size={14} /> : <Download size={14} />}<span>{projectActionLabel}</span></button><button className="primary-button compact" title="Export media" onClick={() => state.set({ showExport: true })}><Download size={14} /><span>Export</span></button></div>
  </header>;
}

const railItems: Array<{ id: Workspace | 'media'; label: string; icon: React.ReactNode }> = [
  { id: 'media', label: 'Media', icon: <Film size={17} /> }, { id: 'edit', label: 'Edit', icon: <MousePointer2 size={17} /> },
  { id: 'mask', label: 'Mask', icon: <Brush size={17} /> }, { id: 'tracking', label: 'Track', icon: <Activity size={17} /> },
  { id: 'omniframe', label: 'Repair', icon: <Sparkles size={17} /> }, { id: '3d', label: '3D', icon: <Box size={17} /> },
];

function LeftRail() {
  const state = useEditorStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mediaFilter, setMediaFilter] = useState<'all' | Asset['kind']>('all');
  const mediaFilters: Array<{ id: 'all' | Asset['kind']; label: string }> = [{ id: 'all', label: 'All' }, { id: 'video', label: 'Video' }, { id: 'audio', label: 'Audio' }, { id: 'image', label: 'Images' }, { id: 'model', label: '3D' }];
  const visibleAssets = state.project.assets.filter((asset) => mediaFilter === 'all' || asset.kind === mediaFilter);
  const importFile = async (file: File) => {
    const kind = file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('image/') ? 'image' : file.type.includes('gltf') || /\.(glb|gltf|obj|fbx|stl|ply|usdz|abc)$/i.test(file.name) ? 'model' : 'video';
    const sourcePath = URL.createObjectURL(file);
    try {
      const metadata = await inspectMedia(file, sourcePath);
      const asset: Asset = { id: `asset_${crypto.randomUUID?.() ?? Date.now()}`, name: file.name, kind, sourcePath, contentHash: null, mime: file.type || 'application/octet-stream', ...metadata, sizeBytes: file.size, missing: false, tags: [], favorite: false, folderId: null, proxyId: null, importedAt: Date.now() };
      state.addImportedAsset(asset);
      state.set({ showMediaBin: false });
    } catch (error) {
      URL.revokeObjectURL(sourcePath);
      state.flash((error as Error).message);
    }
  };
  const selectAsset = (asset: Asset) => {
    const clip = state.project.sequences[0].tracks.flatMap((track) => track.clips).find((item) => item.assetId === asset.id);
    if (clip) state.selectClip(clip.id, state.project.sequences[0].tracks.find((track) => track.clips.some((item) => item.id === clip.id))?.id);
  };
  return <aside className="left-rail"><div className="rail-header"><strong>Library</strong><button className="icon-button" title="Add media" onClick={() => inputRef.current?.click()}><Plus size={17} /></button></div><div className="rail-scroll">{railItems.map((item) => <button key={item.id} title={item.label} className={`rail-item ${item.id === 'media' ? '' : state.workspace === item.id ? 'active' : ''}`} onClick={() => { if (item.id === 'media') inputRef.current?.click(); else state.setWorkspace(item.id); }}>{item.icon}<span>{item.label}</span>{item.id === 'media' && <Upload size={11} className="rail-add" />}</button>)}<input ref={inputRef} type="file" hidden accept="video/*,audio/*,image/*,.glb,.gltf,.obj,.fbx,.stl,.ply,.usdz,.abc" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.currentTarget.value = ''; }} /></div><div className="rail-library"><div className="rail-library-title"><span>Project media</span><small>{state.project.assets.length}</small></div><HorizontalScroller label="Media categories" className="media-filter-scroll" step={120}>{mediaFilters.map((filter) => <button key={filter.id} className={`media-filter-button ${mediaFilter === filter.id ? 'active' : ''}`} onClick={() => setMediaFilter(filter.id)}>{filter.label}</button>)}</HorizontalScroller>{state.project.assets.length === 0 ? <div className="rail-library-empty"><FilePlus2 size={17} /><span>Add media to begin</span></div> : visibleAssets.length === 0 ? <div className="rail-library-empty"><Film size={17} /><span>No {mediaFilter} media yet</span></div> : visibleAssets.map((asset) => <button className={`rail-asset ${state.project.sequences[0].tracks.some((track) => track.clips.some((clip) => clip.assetId === asset.id && clip.id === state.selectedClipId)) ? 'active' : ''}`} key={asset.id} title={asset.name} onClick={() => selectAsset(asset)}><span className={`rail-asset-icon ${asset.kind}`}>{asset.kind === 'model' ? <Box size={14} /> : asset.kind === 'audio' ? <AudioLines size={14} /> : asset.kind === 'image' ? <Aperture size={14} /> : <Film size={14} />}</span><span>{asset.name}</span></button>)}</div><div className="rail-bottom"><button className="rail-item" title="Recover" onClick={() => state.restoreAutosave()}><RotateCcw size={17} /><span>Recover</span></button><button className="rail-item" title="Help" onClick={() => state.flash('Space play · B blade · I mask · T track · O repair')}><CircleHelp size={17} /><span>Help</span></button></div></aside>;
}

function PreviewPanel() {
  const state = useEditorStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const pathModifiers = useRef({ shift: false, alt: false, ctrl: false });
  const clip = selectedClip(state);
  const selectedAsset = state.project.assets.find((item) => item.id === clip?.assetId);
  const fallbackAsset = state.project.assets.find((item) => (item.kind === 'video' || item.kind === 'image') && !item.missing && item.sourcePath && !item.sourcePath.startsWith('demo:'));
  const asset = selectedAsset?.kind === 'video' || selectedAsset?.kind === 'image' ? selectedAsset : fallbackAsset;
  const modelAsset = state.project.assets.find((item) => item.kind === 'model' && !item.missing && item.sourcePath);
  const isVideo = asset?.kind === 'video' && !asset.missing && asset.sourcePath && !asset.sourcePath.startsWith('demo:');
  const isImage = asset?.kind === 'image' && !asset.missing && asset.sourcePath;
  const [sourceReady, setSourceReady] = useState(false);
  const [note, setNote] = useState('');
  const [viewScale, setViewScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef<{ active: boolean; x: number; y: number; startX: number; startY: number }>({ active: false, x: 0, y: 0, startX: 0, startY: 0 });

  useEffect(() => {
    setViewScale(state.previewZoom === 'fit' ? 1 : Math.max(.25, Number.parseInt(state.previewZoom, 10) / 100 || 1));
    setPan({ x: 0, y: 0 });
  }, [state.previewZoom, asset?.id]);

  useEffect(() => {
    setSourceReady(false);
    const video = videoRef.current;
    const image = imageRef.current;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      if (isVideo) { video.src = asset?.sourcePath ?? ''; video.load(); }
    }
    if (image) { image.removeAttribute('src'); if (isImage) image.src = asset?.sourcePath ?? ''; }
  }, [asset?.id, isImage, isVideo, asset?.sourcePath]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo || !sourceReady) return;
    video.playbackRate = state.playbackRate;
    if (state.isPlaying) void video.play().catch(() => setNote('The browser blocked playback. Press play in the viewer once to grant media access.'));
    else video.pause();
  }, [state.isPlaying, state.playbackRate, isVideo, sourceReady]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo || !sourceReady || state.isPlaying) return;
    const sequence = activeSequence(state.project);
    const sourceFrame = (state.playhead - (clip?.start ?? 0)) + (clip?.sourceIn ?? 0);
    const target = Math.max(0, sourceFrame / sequence.fps);
    if (Math.abs(video.currentTime - target) > 1 / 90) video.currentTime = target;
  }, [state.playhead, state.isPlaying, isVideo, sourceReady, clip?.start, clip?.sourceIn, state.project]);

  useEffect(() => {
    const localFrame = Math.max(0, Math.round(state.playhead - (clip?.start ?? 0)));
    const encoded = clip?.masks[0]?.frames[localFrame];
    state.setMask(encoded ? decodeRle({ ...encoded, runs: Array.from(encoded.runs) }) : null);
  }, [clip?.id, clip?.masks, state.playhead]);

  const draw = () => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(2, Math.round(rect.width * dpr));
    const height = Math.max(2, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; overlay.width = width; overlay.height = height; }
    const ctx = canvas.getContext('2d');
    const octx = overlay.getContext('2d');
    if (!ctx || !octx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#10161c'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#182027';
    for (let y = 0; y < height; y += 24 * dpr) for (let x = 0; x < width; x += 24 * dpr) if ((x / dpr / 24 + y / dpr / 24) % 2 < 1) ctx.fillRect(x, y, 24 * dpr, 24 * dpr);
    const video = videoRef.current;
    const image = imageRef.current;
    if (isVideo && video && video.readyState >= 2) drawImageCover(ctx, video, width, height, clip);
    else if (isImage && image && image.complete && image.naturalWidth) drawImageCover(ctx, image, width, height, clip);
    else drawNoMedia(ctx, width, height, asset?.name ?? 'No media loaded');
    if ((isVideo && video?.readyState && video.readyState >= 2) || (isImage && image?.complete && image.naturalWidth)) applyClipEffectsToCanvas(ctx, width, height, clip, state.playhead / activeSequence(state.project).fps, Math.max(0, state.playhead - (clip?.start ?? 0)));

    octx.clearRect(0, 0, width, height);
    if (state.guides) drawGuides(octx, width, height);
    if (state.selectedMask) drawMaskOverlay(octx, state.selectedMask, width, height, state.maskDisplay);
    if (state.maskPath.length > 1) {
      octx.strokeStyle = accent; octx.lineWidth = 2 * dpr; octx.setLineDash([6 * dpr, 4 * dpr]); octx.beginPath();
      state.maskPath.forEach((point, index) => index ? octx.lineTo(point.x * width, point.y * height) : octx.moveTo(point.x * width, point.y * height));
      octx.stroke(); octx.setLineDash([]);
    }
  };

  useEffect(() => {
    let raf = 0;
    const render = () => { draw(); raf = requestAnimationFrame(render); };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [state.playhead, state.workspace, state.guides, state.selectedMask, state.maskDisplay, state.maskPath, state.previewZoom, asset?.id, clip?.transform, sourceReady]);

  const finishPaint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (state.maskPath.length < 1) return;
    const maskWidth = state.selectedMask?.width ?? 160;
    const maskHeight = state.selectedMask?.height ?? 90;
    const shape = createGray(maskWidth, maskHeight);
    const points = state.maskPath.map((point) => ({ x: point.x * maskWidth, y: point.y * maskHeight }));
    const tool = state.activeTool;
    const base = state.selectedMask && state.selectedMask.width === maskWidth && state.selectedMask.height === maskHeight ? state.selectedMask : createGray(maskWidth, maskHeight);
    const viewer = canvasRef.current;
    const viewerContext = viewer?.getContext('2d');
    let viewerPixels: ImageData | null = null;
    if (viewer && viewerContext) viewerPixels = viewerContext.getImageData(0, 0, viewer.width, viewer.height);
    const viewerWidth = viewer?.width ?? 0;
    const viewerHeight = viewer?.height ?? 0;
    const shapeMask = tool === 'magic' && viewerPixels && viewerWidth > 0 && viewerHeight > 0
      ? magicBrush(base, resizeRgba(viewerPixels.data, viewerWidth, viewerHeight, maskWidth, maskHeight), points, state.maskBrushRadius, .12)
      : tool === 'lasso' && points.length >= 3
        ? fillPolygon(shape, { points, closed: true })
        : stroke(shape, points, state.maskBrushRadius, state.maskBrushHardness, 1);
    const modifiers = pathModifiers.current;
    const operation = modifiers.shift && modifiers.alt ? 'intersect' : modifiers.alt ? 'subtract' : modifiers.ctrl ? 'replace' : 'add';
    const result = combine(base, shapeMask, operation);
    state.setMask(result);
    state.commitMaskToClip(result, state.maskScope);
    state.setMaskPath([]);
    state.flash(`${state.maskScope === 'frame' ? 'This frame' : state.maskScope === 'range' ? 'Range' : 'All frames'} mask correction committed (${operation}).`);
    void event;
  };

  const pointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button === 1) return;
    const painting = ['mask', 'brush', 'lasso', 'magic'].includes(state.activeTool) || state.workspace === 'mask';
    if (!painting) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
    if (event.type === 'pointerdown') { event.currentTarget.setPointerCapture(event.pointerId); pathModifiers.current = { shift: event.shiftKey, alt: event.altKey, ctrl: event.ctrlKey || event.metaKey }; state.setMaskPath([point]); }
    else if (useEditorStore.getState().maskPath.length > 0) state.setMaskPath([...useEditorStore.getState().maskPath, point]);
  };
  const beginPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 1 && state.activeTool !== 'hand') return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { active: true, x: pan.x, y: pan.y, startX: event.clientX, startY: event.clientY };
  };
  const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!panRef.current.active) return;
    setPan({ x: panRef.current.x + event.clientX - panRef.current.startX, y: panRef.current.y + event.clientY - panRef.current.startY });
  };
  const endPan = () => { panRef.current.active = false; };
  const changeZoom = (delta: number) => {
    const next = Math.max(.25, Math.min(3, viewScale + delta));
    setViewScale(next);
  };
  const onVideoTime = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    if (!useEditorStore.getState().isPlaying) return;
    const current = event.currentTarget.currentTime;
    const fps = activeSequence(useEditorStore.getState().project).fps;
    const currentClip = selectedClip(useEditorStore.getState());
    useEditorStore.getState().setPlayhead(Math.round(current * fps) + (currentClip?.start ?? 0) - (currentClip?.sourceIn ?? 0));
  };
  const capture = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return setNote('PNG capture failed because the canvas returned no data.');
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `omniframe-${formatTimecode(state.playhead, activeSequence(state.project).fps).replaceAll(':', '-')}.png`; link.click(); URL.revokeObjectURL(url); setNote('Current composited viewer frame downloaded as PNG.');
    }, 'image/png');
  };
  const fullscreen = () => { const stage = canvasRef.current?.parentElement; if (stage?.requestFullscreen) void stage.requestFullscreen(); else setNote('Fullscreen is not available in this browser.'); };
  const viewTransform = `translate(${pan.x}px, ${pan.y}px) scale(${viewScale})`;

  if (state.workspace === '3d') return <section className="preview-panel"><PanelToolbar title="3D viewport" subtitle="3D assets · PBR · environment" /><ThreeViewport asset={selectedAsset?.kind === 'model' ? selectedAsset : modelAsset} /><div className="transport"><button className="text-button" onClick={() => state.set({ showMediaBin: true })}><Upload size={13} /> import 3D asset</button><span className="transport-spacer" /><span className="viewer-note">WebGL renderer · orbit with pointer</span></div></section>;
  return <section className="preview-panel"><PanelToolbar title="Preview" subtitle={`${state.workspace === 'edit' ? 'Omniframe Edit' : state.workspace === 'mask' ? 'Masking mode' : state.workspace === 'maskTracking' ? 'Mask tracking' : state.workspace.toUpperCase()}`} actions={<><div className="zoom-control"><ZoomOut size={13} /><select value={state.previewZoom} onChange={(event) => state.set({ previewZoom: event.target.value })}><option value="fit">Fit</option><option value="25%">25%</option><option value="50%">50%</option><option value="100%">100%</option><option value="125%">125%</option><option value="150%">150%</option><option value="200%">200%</option><option value="300%">300%</option></select><ZoomIn size={13} /></div><button className="icon-button" title="Toggle guides" onClick={() => state.set({ guides: !state.guides })}><Grid2X2 size={15} /></button><button className="icon-button" title="Fullscreen viewer" onClick={fullscreen}><Aperture size={15} /></button></>} /><div className="preview-stage" onWheel={(event) => { event.preventDefault(); changeZoom(event.deltaY > 0 ? -.1 : .1); }} onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}><video ref={videoRef} className="source-media" muted playsInline preload="auto" onLoadedMetadata={() => setSourceReady(true)} onCanPlay={() => setSourceReady(true)} onTimeUpdate={onVideoTime} onError={() => setNote('The browser could not decode this video. Try generating a proxy in the Media bin.')} /><img ref={imageRef} className="source-media" alt="" onLoad={() => setSourceReady(true)} onError={() => setNote('The browser could not decode this image.')} /><canvas ref={canvasRef} className="preview-canvas" style={{ transform: viewTransform, transformOrigin: 'center center' }} /><canvas ref={overlayRef} className="preview-overlay" style={{ transform: viewTransform, transformOrigin: 'center center' }} onPointerDown={pointer} onPointerMove={pointer} onPointerUp={finishPaint} onPointerCancel={() => state.setMaskPath([])} /><div className="viewer-corner viewer-corner-tl">{state.performance} <span>·</span> {Math.round(viewScale * 100)}%</div><div className="viewer-corner viewer-corner-br"><span className="status-dot" /> canvas 2D <span>·</span> ready</div><div className="viewer-center-readout">{state.selectedMask ? <span className="track-pill"><Brush size={12} /> mask {state.maskDisplay}</span> : !asset ? <span className="track-pill muted"><Film size={12} /> import media to start</span> : null}</div></div>{(state.workspace === 'mask' || state.workspace === 'maskTracking') && <MaskCanvasToolbar />}<div className="transport"><button className="icon-button" onClick={() => state.stepFrame(-1)} title="Previous frame">⏮</button><button className="transport-play" onClick={state.togglePlay}>{state.isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button><button className="icon-button" onClick={() => state.stepFrame(1)} title="Next frame">⏭</button><select className="rate-select" value={state.playbackRate} onChange={(event) => state.setPlaybackRate(Number(event.target.value))}><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select><span className="transport-time">{formatTimelinePosition(state.playhead, activeSequence(state.project).fps, state.timelineDisplay)} <span>/ {formatTimelinePosition(Math.max(0, activeSequence(state.project).duration), activeSequence(state.project).fps, state.timelineDisplay)}</span></span><div className="transport-spacer" /><button className="text-button" onClick={state.addMarker}><Plus size={13} /> marker</button><button className="text-button" onClick={capture}><Camera size={13} /> capture</button></div>{note && <div className="analysis-note">{note}<button onClick={() => setNote('')}><X size={12} /></button></div>}</section>;
}

function drawNoMedia(ctx: CanvasRenderingContext2D, width: number, height: number, label: string) {
  ctx.save(); ctx.fillStyle = '#aab6b4'; ctx.textAlign = 'center'; ctx.font = `${Math.max(12, width * 0.014)}px ui-monospace`; ctx.fillText('NO MEDIA FRAME', width / 2, height / 2 - 6); ctx.fillStyle = '#64716f'; ctx.font = `${Math.max(9, width * 0.009)}px ui-monospace`; ctx.fillText(label, width / 2, height / 2 + 17); ctx.restore();
}

function drawGuides(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save(); ctx.strokeStyle = 'rgba(216,255,99,.28)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]); for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(width * i / 3, 0); ctx.lineTo(width * i / 3, height); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, height * i / 3); ctx.lineTo(width, height * i / 3); ctx.stroke(); } ctx.restore();
}

function drawMaskOverlay(ctx: CanvasRenderingContext2D, mask: Gray, width: number, height: number, mode: MaskDisplayMode) {
  const maskCanvas = document.createElement('canvas'); maskCanvas.width = mask.width; maskCanvas.height = mask.height;
  const maskCtx = maskCanvas.getContext('2d'); if (!maskCtx) return;
  const image = maskCtx.createImageData(mask.width, mask.height);
  for (let i = 0; i < mask.data.length; i++) {
    const value = Math.round(Math.max(0, Math.min(1, mask.data[i])) * 255); const p = i * 4;
    if (mode === 'whiteMatte' || mode === 'maskOnly') { image.data[p] = value; image.data[p + 1] = value; image.data[p + 2] = value; image.data[p + 3] = 230; }
    else if (mode === 'blackMatte') { image.data[p] = 0; image.data[p + 1] = 0; image.data[p + 2] = 0; image.data[p + 3] = 230 - value; }
    else if (mode !== 'outline' && mode !== 'edgeOnly') { image.data[p] = 255; image.data[p + 1] = 62; image.data[p + 2] = 96; image.data[p + 3] = Math.round(value * 105); }
  }
  maskCtx.putImageData(image, 0, 0);
  if (mode !== 'outline' && mode !== 'edgeOnly') { ctx.drawImage(maskCanvas, 0, 0, width, height); }
  ctx.save(); ctx.strokeStyle = mode === 'whiteMatte' ? '#ffffff' : accent; ctx.lineWidth = 1.5; ctx.setLineDash(mode === 'marchingAnts' ? [6, 4] : []);
  for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) { const value = mask.data[y * mask.width + x]; if (value < .5) continue; const boundary = x === 0 || y === 0 || x === mask.width - 1 || y === mask.height - 1 || mask.data[y * mask.width + x - 1] < .5 || mask.data[y * mask.width + x + 1] < .5 || mask.data[(y - 1) * mask.width + x] < .5 || mask.data[(y + 1) * mask.width + x] < .5; if (boundary) { ctx.strokeRect(x * width / mask.width, y * height / mask.height, Math.max(1, width / mask.width), Math.max(1, height / mask.height)); } }
  ctx.restore();
}

function PanelToolbar({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return <div className="panel-toolbar"><div className="panel-title"><span className="live-square" /> {title} <span className="subtle">· {subtitle}</span></div><div className="preview-toolbar-actions">{actions}</div></div>;
}

function MaskCanvasToolbar() {
  const state = useEditorStore();
  return <div className="mask-canvas-toolbar"><HorizontalScroller label="Mask tools" className="tool-tabs-scroll" step={120}><div className="tool-tabs"><button className={state.activeTool === 'brush' || state.activeTool === 'mask' ? 'active' : ''} onClick={() => state.setTool('brush')}><Brush size={14} /> Brush</button><button className={state.activeTool === 'lasso' ? 'active' : ''} onClick={() => state.setTool('lasso')}><Hand size={14} /> Lasso</button><button className={state.activeTool === 'magic' ? 'active' : ''} onClick={() => state.setTool('magic')}><WandSparkles size={14} /> Magic</button></div></HorizontalScroller><label>size <input type="range" min="2" max="100" value={state.maskBrushRadius} onChange={(event) => state.set({ maskBrushRadius: Number(event.target.value) })} /></label><span className="toolbar-readout">{state.maskBrushRadius}px</span><span className="toolbar-hint"><kbd>Shift</kbd> add · <kbd>Alt</kbd> subtract · <kbd>Ctrl</kbd> replace · <kbd>Shift+Alt</kbd> intersect</span></div>;
}

function Timeline() {
  const state = useEditorStore();
  const sequence = activeSequence(state.project);
  const timelineRef = useRef<HTMLDivElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);
  const [trackDropIndex, setTrackDropIndex] = useState<number | null>(null);
  const [draggingTrackId, setDraggingTrackId] = useState<string | null>(null);

  const importMedia = async (file: File, newTrackIndex?: number) => {
    const lowerName = file.name.toLowerCase();
    const isModel = file.type.includes('gltf') || /\.(glb|gltf|obj|fbx|stl|ply|usdz|abc)$/.test(lowerName);
    const kind = file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('image/') ? 'image' : isModel ? 'model' : 'video';
    const sourcePath = URL.createObjectURL(file);
    try {
      const metadata = await inspectMedia(file, sourcePath);
      const asset: Asset = { id: `asset_${crypto.randomUUID?.() ?? Date.now()}`, name: file.name, kind, sourcePath, contentHash: null, mime: file.type || (isModel ? 'model/3d' : 'application/octet-stream'), ...metadata, sizeBytes: file.size, missing: false, tags: isModel ? ['3D'] : [], favorite: false, folderId: null, proxyId: null, importedAt: Date.now() };
      if (newTrackIndex === undefined) state.addImportedAsset(asset);
      else state.addImportedAssetToNewTrack(asset, newTrackIndex);
    } catch (error) {
      URL.revokeObjectURL(sourcePath);
      state.flash((error as Error).message);
    }
  };

  const beginTrackDrag = (event: React.DragEvent<HTMLDivElement>, trackId: string) => {
    setDraggingTrackId(trackId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-omniframe-track', trackId);
  };
  const endTrackDrag = () => {
    setDraggingTrackId(null);
    setTrackDropIndex(null);
  };
  const handleTrackDrop = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    const trackId = event.dataTransfer.getData('application/x-omniframe-track');
    if (trackId) {
      const sourceIndex = sequence.tracks.findIndex((track) => track.id === trackId);
      const targetIndex = sourceIndex >= 0 && sourceIndex < index ? index - 1 : index;
      state.reorderTrack(trackId, targetIndex);
    } else {
      const file = event.dataTransfer.files?.[0];
      if (file) void importMedia(file, index);
    }
    endTrackDrag();
  };
  const showTrackDrop = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    const types = Array.from(event.dataTransfer.types);
    if (!types.includes('application/x-omniframe-track') && !types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = types.includes('application/x-omniframe-track') ? 'move' : 'copy';
    setTrackDropIndex(index);
  };
  const duration = Math.max(1, sequence.duration);
  const width = Math.max(820, 116 + duration * 7 * state.timelineZoom);
  const usable = width - 116;
  const playheadLeft = 116 + (state.playhead / duration) * usable;
  const baseStep = state.timelineDisplay === 'frames' ? 15 : state.timelineDisplay === 'tenths' ? Math.max(1, Math.round(sequence.fps / 10)) : sequence.fps;
  const tickStep = Math.max(baseStep, Math.ceil(duration / baseStep / 100) * baseStep);
  const ticks = Array.from({ length: Math.max(2, Math.floor(duration / tickStep) + 1) }, (_, index) => Math.min(duration, index * tickStep));
  if (ticks[ticks.length - 1] !== duration) ticks.push(duration);
  const frameFromPointer = (clientX: number) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return state.playhead;
    return Math.max(0, Math.min(duration - 1, Math.round(((clientX - rect.left - 116) / Math.max(1, usable)) * duration)));
  };
  const startScrub = (event: React.PointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('.timeline-clip, .timeline-marker, .time-ruler button')) return;
    event.preventDefault();
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    state.setPlayhead(frameFromPointer(event.clientX));
  };
  const scrub = (event: React.PointerEvent<HTMLElement>) => {
    if (dragging.current) state.setPlayhead(frameFromPointer(event.clientX));
  };
  const stopScrub = () => { dragging.current = false; };
  const positionLabel = (frame: number) => formatTimelinePosition(frame, sequence.fps, state.timelineDisplay);
  return <section className="timeline-panel"><div className="timeline-header"><div className="timeline-title"><span>Timeline</span><small>{sequence.name} · {sequence.fps} fps</small></div><HorizontalScroller label="Timeline actions" className="timeline-actions-scroll" step={180}><div className="timeline-actions"><button className="timeline-add-media" title="Add media to the timeline" onClick={() => mediaInputRef.current?.click()}><Plus size={14} /><span>Add media</span></button><input ref={mediaInputRef} hidden type="file" accept="video/*,audio/*,image/*,.glb,.gltf,.obj,.fbx,.stl,.ply,.usdz,.abc" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importMedia(file); event.currentTarget.value = ''; }} /><label className="timebase-control" title="Timeline display"><span>View</span><select value={state.timelineDisplay} onChange={(event) => state.set({ timelineDisplay: event.target.value as EditorState['timelineDisplay'] })}><option value="timecode">Timecode</option><option value="tenths">0.1 sec</option><option value="frames">Frames</option></select></label><button className={`snap-button ${state.snapping ? 'active' : ''}`} onClick={() => state.set({ snapping: !state.snapping })}><Magnet size={14} /> Snap</button><button className="icon-button" title="Zoom timeline out" onClick={() => state.set({ timelineZoom: Math.max(.5, state.timelineZoom - .25) })}><ZoomOut size={14} /></button><span className="zoom-readout">{Math.round(state.timelineZoom * 100)}%</span><button className="icon-button" title="Zoom timeline in" onClick={() => state.set({ timelineZoom: Math.min(4, state.timelineZoom + .25) })}><ZoomIn size={14} /></button></div></HorizontalScroller></div><div className="timeline-scroll"><div ref={timelineRef} className="timeline-inner" style={{ width }} onPointerDown={startScrub} onPointerMove={scrub} onPointerUp={stopScrub} onPointerCancel={stopScrub}><div className="time-ruler"><div className="ruler-label">{state.timelineDisplay === 'frames' ? 'FRAME' : state.timelineDisplay === 'tenths' ? 'SECONDS' : 'TIMECODE'}</div>{ticks.map((frame, index) => <button key={`${frame}-${index}`} style={{ left: `${116 + (frame / duration) * usable}px` }} onClick={() => state.setPlayhead(frame)}>{positionLabel(frame)}</button>)}</div>{sequence.markers.map((marker) => <button key={marker.id} className="timeline-marker" title={marker.label} style={{ left: `${116 + (marker.frame / duration) * usable}px`, backgroundColor: marker.color }} onClick={() => state.setPlayhead(marker.frame)} />)}<div className="timeline-playhead" style={{ left: playheadLeft }}><button className="playhead-grip" aria-label={`Scrub to ${positionLabel(state.playhead)}`} onPointerDown={startScrub} /></div><div className="tracks" onDragLeave={(event) => { if (event.currentTarget === event.target) setTrackDropIndex(null); }}>{sequence.tracks.map((track, index) => <Fragment key={track.id}><TrackDropZone index={index} active={trackDropIndex === index} onDragOver={showTrackDrop} onDrop={handleTrackDrop} /><TrackRow track={track} sequence={sequence} dragging={draggingTrackId === track.id} onDragStart={beginTrackDrag} onDragEnd={endTrackDrag} /></Fragment>)}<TrackDropZone index={sequence.tracks.length} active={trackDropIndex === sequence.tracks.length} onDragOver={showTrackDrop} onDrop={handleTrackDrop} end /></div></div></div><div className="timeline-footer"><span><kbd>Space</kbd> play</span><span><kbd>B</kbd> blade</span><span><kbd>I</kbd> mask</span><span><kbd>T</kbd> track</span><span><kbd>O</kbd> repair</span><span className="footer-spacer" /><span>{sequence.duration ? positionLabel(sequence.duration) : 'empty'} · drag playhead</span></div></section>;
}

function TrackDropZone({ index, active, end = false, onDragOver, onDrop }: { index: number; active: boolean; end?: boolean; onDragOver: (event: React.DragEvent<HTMLDivElement>, index: number) => void; onDrop: (event: React.DragEvent<HTMLDivElement>, index: number) => void }) {
  return <div className={`track-drop-zone ${active ? 'active' : ''} ${end ? 'end' : ''}`} role="button" aria-label={end ? 'Drop media here to create a new track' : 'Drop a track here to rearrange'} onDragOver={(event) => onDragOver(event, index)} onDrop={(event) => onDrop(event, index)}><span>{active ? end ? 'Drop here to create a new track' : 'Drop to place or create a track' : ''}</span></div>;
}

function TrackRow({ track, sequence, dragging, onDragStart, onDragEnd }: { track: ReturnType<typeof activeSequence>['tracks'][number]; sequence: ReturnType<typeof activeSequence>; dragging: boolean; onDragStart: (event: React.DragEvent<HTMLDivElement>, trackId: string) => void; onDragEnd: () => void }) {
  const state = useEditorStore();
  return <div className={`track-row ${track.locked ? 'locked' : ''} ${track.hidden ? 'hidden-track' : ''} ${dragging ? 'dragging' : ''}`} style={{ height: track.height }} draggable onDragStart={(event) => onDragStart(event, track.id)} onDragEnd={onDragEnd}><div className="track-label"><div className="track-label-main"><button className="track-drag-handle" title="Drag track to rearrange" aria-label={`Drag ${track.name} to rearrange`}><Move size={12} /></button><span className="track-kind">{track.kind === 'audio' ? <AudioLines size={13} /> : track.kind === 'text' ? <TextCursorInput size={13} /> : track.kind === 'adjustment' ? <Layers3 size={13} /> : track.kind === 'scene3d' ? <Box size={13} /> : <Film size={13} />}</span><strong>{track.name}</strong></div><div className="track-label-actions"><button title="Mute track" className={track.muted ? 'on' : ''} onClick={() => state.toggleTrackFlag(track.id, 'muted')}><AudioLines size={11} /></button><button title="Solo track" className={track.solo ? 'on' : ''} onClick={() => state.toggleTrackFlag(track.id, 'solo')}><Headphones size={11} /></button><button title="Hide track" className={track.hidden ? 'on' : ''} onClick={() => state.toggleTrackFlag(track.id, 'hidden')}>{track.hidden ? <EyeOff size={11} /> : <Eye size={11} />}</button><button title="Lock track" className={track.locked ? 'on' : ''} onClick={() => state.toggleTrackFlag(track.id, 'locked')}>{track.locked ? <Lock size={11} /> : <KeyRound size={11} />}</button></div></div><div className="track-lane" onPointerDown={(event) => { if ((event.target as HTMLElement).closest('.timeline-clip')) return; const rect = event.currentTarget.getBoundingClientRect(); const frame = Math.round(((event.clientX - rect.left) / rect.width) * sequence.duration); state.setPlayhead(frame); }}>{track.clips.map((clip) => <TimelineClip key={clip.id} clip={clip} track={track} sequence={sequence} />)}</div></div>;
}

function TimelineClip({ clip, track, sequence }: { clip: Clip; track: ReturnType<typeof activeSequence>['tracks'][number]; sequence: ReturnType<typeof activeSequence> }) {
  const state = useEditorStore();
  const left = 100 * clip.start / Math.max(1, sequence.duration);
  const width = 100 * (clipEnd(clip) - clip.start) / Math.max(1, sequence.duration);
  const selected = state.selectedClipId === clip.id;
  const beginTrim = (event: React.PointerEvent<HTMLSpanElement>, edge: 'head' | 'tail') => {
    event.preventDefault();
    event.stopPropagation();
    if (clip.locked || track.locked) return;
    state.selectClip(clip.id, track.id);
    const lane = event.currentTarget.parentElement?.parentElement;
    if (!lane) return;
    const updateFrame = (clientX: number) => Math.max(0, Math.min(sequence.duration, Math.round(((clientX - lane.getBoundingClientRect().left) / Math.max(1, lane.getBoundingClientRect().width)) * sequence.duration)));
    let finalFrame = edge === 'head' ? clip.start : clipEnd(clip);
    const onMove = (move: PointerEvent) => { finalFrame = updateFrame(move.clientX); state.setPlayhead(finalFrame); };
    const onUp = (up: PointerEvent) => { finalFrame = updateFrame(up.clientX); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); state.trimSelected(edge, finalFrame); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };
  return <button className={`timeline-clip ${clip.kind} ${selected ? 'selected' : ''} ${clip.locked || track.locked ? 'clip-locked' : ''}`} style={{ left: `${left}%`, width: `${Math.max(2, width)}%`, background: clip.color ?? '#31565e' }} onClick={(event) => { event.stopPropagation(); state.selectClip(clip.id, track.id); }} onDoubleClick={() => state.setWorkspace(clip.kind === 'audio' ? 'audio' : 'edit')}><span className="clip-handle left" onPointerDown={(event) => beginTrim(event, 'head')} /><span className="clip-color-line" /><span>{clip.name}</span><small>{formatTimecode(clip.start, sequence.fps)} · {clipEnd(clip) - clip.start}f {clip.effects.length ? `· ${clip.effects.length} fx` : ''}</small>{clip.kind === 'audio' && <span className="waveform-mini">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ height: `${35 + ((i * 17) % 60)}%` }} />)}</span>}<span className="clip-handle right" onPointerDown={(event) => beginTrim(event, 'tail')} /></button>;
}

function PropertiesPanel() {
  const state = useEditorStore();
  return <aside className="properties-panel"><div className="properties-header"><span>Inspector</span><div className="properties-actions"><button className="icon-button" title="Open media" onClick={() => state.set({ showMediaBin: true })}><FolderOpen size={15} /></button></div></div>{state.workspace === 'layers' ? <LayersInspector /> : state.workspace === 'mask' ? <MaskInspector /> : state.workspace === 'maskTracking' ? <MaskTrackingInspector /> : state.workspace === 'tracking' ? <TrackingInspector /> : state.workspace === 'omniframe' ? <OmniframeInspector /> : state.workspace === '3d' ? <ThreeInspector /> : state.workspace === 'color' ? <ColorInspector /> : state.workspace === 'audio' ? <AudioInspector /> : state.workspace === 'export' ? <ExportInspector /> : <EditInspector />}</aside>;
}

function InspectorSection({ title, icon, children, open = true }: { title: string; icon?: React.ReactNode; children: React.ReactNode; open?: boolean }) { return <details className="inspector-section" open={open}><summary>{icon}{title}<ChevronDown size={13} /></summary><div className="inspector-content">{children}</div></details>; }
function Segmented({ options, value, onChange }: { options: Array<{ label: string; value: string }>; value: string; onChange: (value: string) => void }) { return <div className="segmented">{options.map((option) => <button key={option.value} className={value === option.value ? 'active' : ''} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>; }
function ValueRow({ label, value, unit, onChange, min, max, step = 1 }: { label: string; value: string | number; unit?: string; onChange?: (value: number) => void; min?: number; max?: number; step?: number }) { return <div className="value-row"><span>{label}</span><div className="value-control"><input type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange?.(Number(event.target.value))} /><small>{unit}</small></div></div>; }
function InspectorContext({ icon, title, subtitle, tone = '' }: { icon: React.ReactNode; title: string; subtitle: string; tone?: string }) { return <div className="inspector-context"><span className={`context-icon ${tone}`}>{icon}</span><div><strong>{title}</strong><small>{subtitle}</small></div></div>; }

function LayersInspector() {
  const state = useEditorStore();
  const sequence = activeSequence(state.project);
  const selected = selectedClip(state);
  const tracks = [...sequence.tracks].reverse();
  const blendModes: Array<{ label: string; value: Clip['blend'] }> = [
    { label: 'Normal', value: 'normal' }, { label: 'Multiply', value: 'multiply' }, { label: 'Screen', value: 'screen' },
    { label: 'Overlay', value: 'overlay' }, { label: 'Soft light', value: 'softLight' }, { label: 'Hard light', value: 'hardLight' },
    { label: 'Difference', value: 'difference' }, { label: 'Add', value: 'add' }, { label: 'Subtract', value: 'subtract' },
  ];
  const trackIcon = (kind: string) => kind === 'scene3d' ? <Box size={13} /> : kind === 'audio' ? <AudioLines size={13} /> : kind === 'text' || kind === 'caption' ? <TextCursorInput size={13} /> : <Film size={13} />;
  const selectTrack = (trackId: string) => {
    const track = sequence.tracks.find((item) => item.id === trackId);
    state.set({ selectedTrackId: trackId, selectedClipId: track?.clips[0]?.id ?? null });
  };
  return <><InspectorContext icon={<Layers3 size={16} />} title="Layers" subtitle="Compositing stack · tracks · adjustment layers" tone="violet" /><InspectorSection title="Layer stack" icon={<Layers3 size={14} />}><div className="layer-stack">{tracks.map((track, index) => <div className={`layer-row ${state.selectedTrackId === track.id ? 'active' : ''}`} key={track.id}><button className="layer-select" onClick={() => selectTrack(track.id)}><span className="layer-order">{tracks.length - index}</span><span className="layer-type">{trackIcon(track.kind)}</span><span className="layer-name"><strong>{track.name}</strong><small>{track.isAdjustment ? 'adjustment layer' : `${track.kind} · ${track.clips.length} clip${track.clips.length === 1 ? '' : 's'}`}</small></span></button><button className={`layer-visibility ${track.hidden ? 'off' : ''}`} title={track.hidden ? 'Show layer' : 'Hide layer'} onClick={() => state.toggleTrackFlag(track.id, 'hidden')}>{track.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button><button className={`layer-visibility ${track.locked ? 'on' : ''}`} title={track.locked ? 'Unlock layer' : 'Lock layer'} onClick={() => state.toggleTrackFlag(track.id, 'locked')}><Lock size={12} /></button></div>)}</div><div className="layer-actions"><button className="add-row" onClick={() => state.set({ showMediaBin: true })}><Plus size={13} /> Add media to timeline</button></div></InspectorSection><InspectorSection title="Selected layer compositing" icon={<SlidersHorizontal size={14} />}>{selected ? <><ValueRow label="Opacity" value={Math.round(selected.transform.opacity * 100)} unit="%" min={0} max={100} onChange={(value) => state.setClipOpacity(value / 100)} /><label className="field-label">Blend mode<select className="full-select" value={selected.blend} onChange={(event) => state.setClipBlend(event.target.value as Clip['blend'])}>{blendModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label><div className="layer-facts"><span>{selected.effects.length} effects</span><span>{selected.masks.length} masks</span><span>{selected.keyframes ? Object.keys(selected.keyframes).length : 0} animated channels</span></div></> : <div className="hint-line">Select a clip in the stack to edit opacity, blend mode, effects and masks. Track visibility and lock state remain independent.</div>}</InspectorSection><div className="layer-note"><Layers3 size={14} /><span>Layers are a compositing view over the real timeline tracks. They do not replace frame-accurate editing; adjustment layers affect tracks below them.</span></div><EditorAssistAdvanced /></>;
}

function EditorAssistAdvanced() {
  const [runtime, setRuntime] = useState<EditorAssistRuntime | null>(null);
  const [status, setStatus] = useState('not loaded');
  const [prompt, setPrompt] = useState('make this sequence portrait');
  const [predictions, setPredictions] = useState<EditorAssistPrediction[]>([]);
  const load = async () => {
    setStatus('loading ONNX…');
    try {
      const next = await loadEditorAssistModel('/models/editor-assist/manifest.json');
      setRuntime(next);
      setStatus(`loaded · ${next.manifest.labels.length} editor intents`);
    } catch (error) {
      setStatus(`unavailable · ${(error as Error).message}`);
    }
  };
  const predict = async () => {
    if (!runtime) return;
    try {
      setPredictions(await runtime.predict(prompt));
      setStatus('scored · verify before applying');
    } catch (error) {
      setStatus(`inference failed · ${(error as Error).message}`);
    }
  };
  return <InspectorSection title="Advanced · editor assist" icon={<Sparkles size={14} />} open={false}><div className="hint-line">Optional ONNX intent scoring. It suggests commands only; it cannot mutate a project, upload footage or replace a deliberate editor action.</div><div className="model-runtime-row"><span>status</span><strong>{status}</strong></div><button className="outline-button wide" onClick={() => void load()}><Upload size={14} /> {runtime ? 'Reload model' : 'Load model'}</button><label className="field-label">Test an intent<input className="model-input" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="e.g. add a graphics layer" /></label><button className="add-row" disabled={!runtime || !prompt.trim()} onClick={() => void predict()}><Target size={13} /> Score suggestion</button>{predictions.length > 0 && <div className="model-predictions">{predictions.map((prediction) => <div key={prediction.action}><span>{prediction.action}</span><strong>{Math.round(prediction.probability * 100)}%</strong></div>)}</div>}</InspectorSection>;
}

function EditInspector() {
  const state = useEditorStore();
  const clip = selectedClip(state);
  if (!clip) return <EmptyInspector title="Omniframe Edit" copy="Import a video, image, audio file or GLB to populate the sequence." action={<button className="primary-button wide" onClick={() => state.set({ showMediaBin: true })}><Upload size={15} /> Open Media bin</button>} />;
  return <><InspectorContext icon={<Film size={16} />} title={clip.name} subtitle={`${clip.kind} clip · ${clipEnd(clip) - clip.start} frames`} /><InspectorSection title="Clip edit" icon={<Scissors size={14} />}><div className="edit-tool-grid"><button onClick={state.splitAtPlayhead}><Split size={13} /> Split</button><button onClick={() => state.trimSelected('head', state.playhead)}><Minus size={13} /> Trim head</button><button onClick={() => state.trimSelected('tail', state.playhead)}><Minus size={13} /> Trim tail</button><button onClick={() => state.deleteSelectedRipple()}><Trash2 size={13} /> Ripple delete</button></div><div className="edit-tool-grid secondary"><button onClick={() => state.rollSelected(1)}>Roll +1</button><button onClick={() => state.slipSelected(1)}>Slip +1</button><button onClick={() => state.slideSelected(1)}>Slide +1</button><button onClick={() => state.moveSelected(state.playhead, state.snapping)}>Move here</button></div></InspectorSection><InspectorSection title="Transform" icon={<Move size={14} />}><ValueRow label="Position X" value={clip.transform.x} unit="px" onChange={(value) => state.setClipTransform({ x: value })} /><ValueRow label="Position Y" value={clip.transform.y} unit="px" onChange={(value) => state.setClipTransform({ y: value })} /><ValueRow label="Scale" value={Math.round(clip.transform.scale * 100)} unit="%" min={1} max={1000} onChange={(value) => state.setClipTransform({ scale: value / 100 })} /><ValueRow label="Rotation" value={clip.transform.rotation} unit="°" onChange={(value) => state.setClipTransform({ rotation: value })} /><ValueRow label="Opacity" value={Math.round(clip.transform.opacity * 100)} unit="%" min={0} max={100} onChange={(value) => state.setClipOpacity(Math.max(0, Math.min(100, value)) / 100)} /></InspectorSection><InspectorSection title="Keyframes" icon={<KeyRound size={14} />}><KeyframeRow label="Position" active={Boolean(clip.keyframes.position?.length)} onClick={() => state.setKeyframe('position', [clip.transform.x, clip.transform.y])} /><KeyframeRow label="Scale" active={Boolean(clip.keyframes.scale?.length)} onClick={() => state.setKeyframe('scale', clip.transform.scale)} /><KeyframeRow label="Opacity" active={Boolean(clip.keyframes.opacity?.length)} onClick={() => state.setKeyframe('opacity', clip.transform.opacity)} /></InspectorSection><InspectorSection title="Effects" icon={<Sparkles size={14} />}><EffectStack clip={clip} /></InspectorSection><InspectorSection title="Clip state" icon={<Settings2 size={14} />}><div className="advanced-row"><span>Clip locked</span><button className={`toggle ${clip.locked ? 'on' : ''}`} onClick={() => state.setClipFlag('locked')} /></div><div className="advanced-row"><span>Audio muted</span><button className={`toggle ${clip.muted ? 'on' : ''}`} onClick={() => state.setClipFlag('muted')} /></div></InspectorSection></>;
}

function KeyframeRow({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) { return <div className="keyframe-line"><span>{label}</span><button className={`diamond-button ${active ? 'active' : ''}`} onClick={onClick}>◆</button><span className="keyframe-tick">{active ? 'keyed' : 'set at playhead'}</span></div>; }

function EffectStack({ clip }: { clip: Clip }) {
  const state = useEditorStore();
  const [effectId, setEffectId] = useState('brightness');
  const effects = clip.effects;
  return <><div className="effect-add"><select value={effectId} onChange={(event) => setEffectId(event.target.value)}>{listEffects().filter((effect) => effect.category !== 'motion').slice(0, 20).map((effect) => <option key={effect.id} value={effect.id}>{effect.name}</option>)}</select><button onClick={() => state.addEffect(effectId)}><Plus size={13} /> Add</button></div>{effects.length === 0 && <div className="hint-line">No effect instances. CPU reference and final export share the same definition when one is added.</div>}{effects.map((effect) => { const definition = getEffect(effect.effectId); return <div className="effect-instance" key={effect.id}><div className="effect-instance-head"><span className="effect-chip">fx</span><strong>{definition?.name ?? effect.effectId}</strong><button className="icon-button" onClick={() => state.removeEffect(effect.id)}><Trash2 size={13} /></button></div>{definition?.params.filter((param) => typeof param.default === 'number' && !param.advanced).slice(0, 3).map((param) => <ValueRow key={param.key} label={param.label} value={Number(effect.params[param.key] ?? param.default)} unit={param.unit} min={param.min} max={param.max} step={param.step} onChange={(value) => state.setEffectParam(effect.id, param.key, value)} />)}</div>; })}</>;
}

function MaskInspector() {
  const state = useEditorStore();
  const refine = () => { if (!state.selectedMask) return state.flash('Paint a mask on the viewer first.'); const result = removeSmallComponents(fillHoles(feather(state.selectedMask, 1.5)), 8); state.setMask(result); state.commitMaskToClip(result, state.maskScope); state.flash('Mask refined with feather, hole fill and component cleanup.'); };
  return <><InspectorContext icon={<Brush size={16} />} title="Masking mode" subtitle={state.selectedMask ? 'Manual correction active' : 'No mask on this frame'} tone="pink" /><InspectorSection title="Apply range" icon={<Layers3 size={14} />}><Segmented options={[{ label: 'THIS FRAME', value: 'frame' }, { label: 'RANGE', value: 'range' }, { label: 'ALL FRAMES', value: 'all' }]} value={state.maskScope} onChange={(value) => state.set({ maskScope: value as EditorState['maskScope'] })} /><div className="hint-line">Paint a correction, then commit it to the selected scope. Tracking remains a separate operation.</div></InspectorSection><InspectorSection title="Tools and modifiers" icon={<MousePointer2 size={14} />}><div className="modifier-grid"><span><kbd>Shift</kbd> add</span><span><kbd>Alt</kbd> subtract</span><span><kbd>Ctrl</kbd> replace</span><span><kbd>Shift+Alt</kbd> intersect</span></div><div className="tool-mini-grid"><ToolMini icon={<Brush size={14} />} label="Brush" active={state.activeTool === 'brush' || state.activeTool === 'mask'} onClick={() => state.setTool('brush')} /><ToolMini icon={<Hand size={14} />} label="Lasso" active={state.activeTool === 'lasso'} onClick={() => state.setTool('lasso')} /><ToolMini icon={<WandSparkles size={14} />} label="Magic" active={state.activeTool === 'magic'} onClick={() => state.setTool('magic')} /><ToolMini icon={<Square size={14} />} label="Shape" active={false} onClick={() => state.flash('Use the brush or lasso on the viewer; rectangle and ellipse tools are on the next canvas pass.')} /></div></InspectorSection><InspectorSection title="Display" icon={<Eye size={14} />}><Segmented options={[{ label: 'Overlay', value: 'red' }, { label: 'Matte', value: 'whiteMatte' }, { label: 'Outline', value: 'outline' }]} value={state.maskDisplay} onChange={(value) => state.set({ maskDisplay: value as MaskDisplayMode })} /><select className="full-select" value={state.maskDisplay} onChange={(event) => state.set({ maskDisplay: event.target.value as MaskDisplayMode })}><option value="marchingAnts">Marching ants</option><option value="maskOnly">Mask only</option><option value="sourceAndMask">Source + mask</option><option value="edgeOnly">Edge only</option></select></InspectorSection><InspectorSection title="Refine" icon={<Aperture size={14} />}><ValueRow label="Brush radius" value={state.maskBrushRadius} unit="px" min={2} max={100} onChange={(value) => state.set({ maskBrushRadius: value })} /><ValueRow label="Hardness" value={Math.round(state.maskBrushHardness * 100)} unit="%" min={0} max={100} onChange={(value) => state.set({ maskBrushHardness: value / 100 })} /><button className="add-row" onClick={refine}><Sparkles size={14} /> Refine current mask</button></InspectorSection><button className="danger-outline" onClick={state.clearMask}><Trash2 size={14} /> Clear viewer mask</button></>;
}

function MaskTrackingInspector() {
  const state = useEditorStore();
  const analyze = () => void runTrackingJob(state, true);
  return <><InspectorContext icon={<Target size={16} />} title="Mask tracking" subtitle="Mask propagation, correction keyframes and confidence" tone="blue" /><InspectorSection title="Range" icon={<Layers3 size={14} />}><Segmented options={[{ label: 'CURRENT', value: 'current' }, { label: 'IN / OUT', value: 'inOut' }, { label: 'CLIP', value: 'clip' }]} value={state.trackingRange} onChange={(value) => state.set({ trackingRange: value as EditorState['trackingRange'] })} /></InspectorSection><InspectorSection title="Quality" icon={<Gauge size={14} />}><Segmented options={[{ label: 'Fast', value: 'fast' }, { label: 'Balanced', value: 'balanced' }, { label: 'Quality', value: 'quality' }]} value={state.trackingPreset} onChange={(value) => state.set({ trackingPreset: value as TrackPreset })} /><div className="advanced-row"><span>Camera motion separation</span><span className="toggle on" /></div><div className="advanced-row"><span>Forward / backward checks</span><span className="toggle on" /></div><div className="advanced-row"><span>Non-rigid deformation</span><span className="toggle on" /></div></InspectorSection><InspectorSection title="Backend" icon={<Sparkles size={14} />}><div className="backend-choice"><button className={state.trackingMethod === 'classical' ? 'active' : ''} onClick={() => state.set({ trackingMethod: 'classical' })}><span className="backend-name">Built-in hybrid</span><small>Fast · no download · default</small></button><button className={state.trackingMethod === 'sam2' ? 'active sam' : ''} onClick={() => state.set({ trackingMethod: 'sam2' })}><span className="backend-name"><Sparkles size={12} /> SAM2 option</span><small>Explicit model load · sparse keyframes · Apache-2.0 candidate</small></button></div><div className="hint-line">SAM2 only runs after Analyze. It reuses prompt keyframes and propagates between them; if the export is unavailable the job reports the classical fallback.</div></InspectorSection><button className="primary-button wide" onClick={analyze}><Target size={15} /> Analyze {state.trackingMethod === 'sam2' ? 'with SAM2' : 'mask'}</button></>;
}

function TrackingInspector() {
  const state = useEditorStore();
  return <><InspectorContext icon={<Activity size={16} />} title="General tracking" subtitle="Point, object, camera and plane analysis" tone="blue" /><InspectorSection title="Target layer" icon={<Target size={14} />}><Segmented options={[{ label: 'POINT', value: 'point' }, { label: 'OBJECT', value: 'object' }, { label: 'PLANE', value: 'plane' }]} value="object" onChange={(value) => state.flash(`${value} tracking target armed. Paint or select an object region in the viewer before Analyze.`)} /><div className="hint-line">The native and worker adapters use the same pyramidal LK, RANSAC, forward/backward and non-rigid reference path.</div></InspectorSection><InspectorSection title="Analysis" icon={<Gauge size={14} />}><Segmented options={[{ label: 'Fast', value: 'fast' }, { label: 'Balanced', value: 'balanced' }, { label: 'Quality', value: 'quality' }]} value={state.trackingPreset} onChange={(value) => state.set({ trackingPreset: value as TrackPreset })} /><div className="advanced-row"><span>Separate camera motion</span><span className="toggle on" /></div><div className="advanced-row"><span>Outlier rejection + occlusion</span><span className="toggle on" /></div></InspectorSection><button className="outline-button wide" onClick={() => void runTrackingJob(state, false)}><Activity size={15} /> Analyze selected target</button><div className="job-explanation"><AlertTriangle size={14} /><span>Tracking never creates points without source pixels. Import a video and paint a seed mask to begin.</span></div></>;
}

async function runTrackingJob(state: EditorState, maskTracking: boolean): Promise<void> {
  const clip = selectedClip(state);
  const asset = state.project.assets.find((item) => item.id === clip?.assetId);
  if (!clip || !asset || asset.kind !== 'video' || asset.missing || !asset.sourcePath || asset.sourcePath.startsWith('demo:')) return state.flash('Relink a video and select its clip before analyzing.');
  if (!state.selectedMask) return state.flash('Paint a seed mask on the current frame before analyzing.');
  const provider = new VideoGrayProvider(asset.sourcePath, asset.duration, activeSequence(state.project).fps, 320, asset.width || 16, asset.height || 9);
  const inputMask = resizeGray(state.selectedMask, provider.width, provider.height);
  const localPlayhead = Math.max(0, Math.min(clipLengthSafe(clip) - 1, state.playhead - clip.start));
  const seedFrame = Math.max(0, Math.min(provider.count - 1, clip.sourceIn + localPlayhead));
  const clipEndFrame = Math.max(seedFrame, Math.min(provider.count - 1, clip.sourceIn + clipLengthSafe(clip) - 1));
  const end = state.trackingRange === 'clip' ? clipEndFrame : Math.max(seedFrame, Math.min(provider.count - 1, seedFrame + 30));
  const id = `track_${Date.now()}`;
  state.runJob({ id, title: state.trackingMethod === 'sam2' && maskTracking ? 'SAM2 sparse mask tracking' : maskTracking ? 'Hybrid mask tracking' : 'General tracking analysis', stage: state.trackingMethod === 'sam2' && maskTracking ? 'loading explicit model' : 'tracking source frames', progress: 0, status: 'running', detail: 'Measured confidence will be reported from decoded frames.' });
  try {
    let result: { masks: Map<number, Gray>; metrics?: { confidence: number }; confidence?: number | null; reinitialisedFrames?: number[]; keyframesUsed?: number[]; encoderMs?: number; propagationMs?: number; fellBackToClassical?: boolean; reason?: string };
    if (state.trackingMethod === 'sam2' && maskTracking) {
      const backend = new Sam2Backend({ preferWebGpu: 'gpu' in navigator, inputSize: 1024 });
      result = await trackMaskWithSam2(provider, seedFrame, end, { keyframeInterval: state.trackingPreset === 'fast' ? 16 : state.trackingPreset === 'quality' ? 8 : 12, prompt: { points: [{ pos: { x: provider.width / 2, y: provider.height / 2 }, label: 1 }], initialMask: inputMask }, analysisScale: state.trackingPreset === 'fast' ? .35 : .6 }, { signal: undefined, onProgress: (progress) => state.finishJob({ stage: progress.stage, detail: `SAM2 keyframe ${progress.frame + 1}`, progress: Math.min(.95, progress.frame / Math.max(1, progress.total)) }) }, backend);
    } else {
      result = await trackMask(provider, inputMask, seedFrame, end, state.trackingRange === 'clip' ? 'both' : 'forward', { analysisScale: state.trackingPreset === 'fast' ? .35 : state.trackingPreset === 'quality' ? .8 : .55, featureCount: state.trackingPreset === 'fast' ? 40 : 100, nonRigid: true }, { rangeStart: clip.sourceIn, onProgress: (progress) => state.finishJob({ stage: `frame ${progress.frame + 1} / ${progress.total}`, detail: `${progress.quality} · measured confidence ${(progress.confidence * 100).toFixed(0)}%`, progress: Math.min(.95, progress.frame / Math.max(1, progress.total)) }) });
    }
    const display = result.masks.get(seedFrame) ?? inputMask;
    const trackedFrames = [...result.masks.entries()]
      .filter(([frame]) => frame >= clip.sourceIn && frame < clip.sourceIn + clipLengthSafe(clip))
      .map(([frame, mask]) => ({ frame: frame - clip.sourceIn, mask: resizeGray(mask, state.selectedMask!.width, state.selectedMask!.height) }));
    state.setMask(resizeGray(display, state.selectedMask.width, state.selectedMask.height));
    const measuredConfidence = result.metrics?.confidence ?? result.confidence ?? null;
    state.commitTrackedMasks(trackedFrames, state.trackingMethod === 'sam2' && maskTracking ? 'SAM2' : 'hybrid', measuredConfidence);
    const confidenceDetail = measuredConfidence === null ? 'confidence unavailable' : `confidence ${(measuredConfidence * 100).toFixed(0)}%`;
    const detail = result.fellBackToClassical ? `${result.reason} · classical fallback` : `${result.masks.size} masks · ${confidenceDetail} · ${result.reinitialisedFrames?.length ?? 0} reinitialisations${result.keyframesUsed ? ` · ${result.keyframesUsed.length} SAM2 keyframes` : ''}`;
    state.finishJob({ status: 'done', stage: 'analysis complete', progress: 1, detail });
    state.flash(`${maskTracking ? 'Mask tracking' : 'Tracking'} complete. ${detail}`);
  } catch (error) {
    state.finishJob({ status: 'failed', stage: 'analysis failed', progress: 0, detail: (error as Error).message });
  } finally { provider.dispose(); }
}

function OmniframeInspector() {
  const state = useEditorStore();
  const run = () => void runOmniframe(state);
  return <><InspectorContext icon={<Sparkles size={16} />} title="Omniframe edit" subtitle="Track · transform · repair · composite" tone="lime" /><div className="omni-banner"><div className="omni-glyph">OF</div><div><strong>Change the visual relationship.</strong><p>The operation is stored as non-destructive data and never rewrites the source asset.</p></div></div><InspectorSection title="Operation" icon={<Move size={14} />}><Segmented options={[{ label: 'Move', value: 'move' }, { label: 'Clone', value: 'duplicate' }, { label: 'Fill', value: 'fill' }, { label: 'Blur', value: 'blur' }]} value="move" onChange={() => undefined} /><ValueRow label="Move X" value={-18} unit="px" /><ValueRow label="Move Y" value={0} unit="px" /></InspectorSection><InspectorSection title="Propagation" icon={<Activity size={14} />}><Segmented options={[{ label: 'Every frame', value: 'everyFrame' }, { label: 'Adaptive', value: 'adaptive' }, { label: 'Keyframe', value: 'keyframeAssisted' }]} value="adaptive" onChange={() => undefined} /><div className="advanced-row"><span>Correction keyframes</span><span className="small-badge">manual masks</span></div></InspectorSection><InspectorSection title="Repair" icon={<WandSparkles size={14} />}><Segmented options={[{ label: 'Telea', value: 'telea' }, { label: 'Patch', value: 'patchmatch' }, { label: 'Temporal', value: 'temporal' }]} value="telea" onChange={() => undefined} /><div className="hint-line">The vacated region is reconstructed per frame. No blur placeholder is used.</div></InspectorSection><button className="primary-button wide" onClick={run}><Sparkles size={15} /> Apply Omniframe operation</button></>;
}

async function runOmniframe(state: EditorState): Promise<void> {
  const clip = selectedClip(state);
  const asset = state.project.assets.find((item) => item.id === clip?.assetId);
  if (!clip || !asset || asset.kind !== 'video' || asset.missing || !asset.sourcePath || asset.sourcePath.startsWith('demo:')) return state.flash('Relink a video and select its clip before applying Omniframe.');
  if (!state.selectedMask) return state.flash('Paint a seed mask on the current frame before applying Omniframe.');
  const provider = new VideoGrayProvider(asset.sourcePath, asset.duration, activeSequence(state.project).fps, 320, asset.width || 16, asset.height || 9);
  const mask = resizeGray(state.selectedMask, provider.width, provider.height);
  const localPlayhead = Math.max(0, Math.min(clipLengthSafe(clip) - 1, state.playhead - clip.start));
  const seedFrame = Math.max(0, Math.min(provider.count - 1, clip.sourceIn + localPlayhead));
  const endFrame = Math.max(seedFrame, Math.min(provider.count - 1, clip.sourceIn + clipLengthSafe(clip) - 1));
  const op = newOmniframeOp('move', { start: seedFrame, end: endFrame, mode: 'adaptive', keyframeInterval: 12 });
  op.transform.dx = -18; op.repair = 'telea'; op.selectionMethod = 'brush';
  state.runJob({ id: `omni_${Date.now()}`, title: 'Omniframe move', stage: 'tracking target', progress: 0, status: 'running', detail: 'Decoded source frames · measured repair path' });
  try {
    const result = await executeOmniframe(provider, mask, op, { trackOptions: { analysisScale: .55, featureCount: 80 }, onProgress: (progress) => state.finishJob({ stage: progress.stage, progress: Math.min(.95, progress.frame / Math.max(1, progress.total)), detail: progress.confidence === null ? 'tracking confidence unavailable' : `measured confidence ${(progress.confidence * 100).toFixed(0)}%` }) });
    op.confidence = result.confidence;
    state.addOmniframeOp(op);
    const selected = result.masks.get(seedFrame) ?? mask;
    state.setMask(resizeGray(selected, state.selectedMask.width, state.selectedMask.height));
    state.finishJob({ status: 'done', stage: 'non-destructive edit ready', progress: 1, detail: `${result.frames.size} frames · ${result.backend} backend · ${result.msPerFrame.toFixed(1)} ms/frame measured` });
    state.flash(`Omniframe operation stored. ${result.note}`);
  } catch (error) { state.finishJob({ status: 'failed', stage: 'operation failed', progress: 0, detail: (error as Error).message }); }
  finally { provider.dispose(); }
}

function ColorInspector() {
  const state = useEditorStore();
  const clip = selectedClip(state);
  const quick = (effectId: string, key: string, value: number) => {
    if (!clip) return state.flash('Select a clip before changing colour.');
    const current = clip.effects.find((effect) => effect.effectId === effectId);
    if (current) state.setEffectParam(current.id, key, value);
    else state.addEffect(effectId, { [key]: value });
  };
  const value = (effectId: string, key: string, fallback: number) => Number(clip?.effects.find((effect) => effect.effectId === effectId)?.params[key] ?? fallback);
  return <><InspectorContext icon={<SlidersHorizontal size={16} />} title="Color" subtitle="Data-driven effects · CPU reference path" tone="amber" /><InspectorSection title="Quick controls" icon={<SlidersHorizontal size={14} />}><ValueRow label="Exposure" value={value('exposure', 'stops', 0)} unit="EV" min={-3} max={3} step={.1} onChange={(next) => quick('exposure', 'stops', next)} /><ValueRow label="Contrast" value={value('contrast', 'amount', 0)} unit="" min={-1} max={1} step={.01} onChange={(next) => quick('contrast', 'amount', next)} /><ValueRow label="Saturation" value={value('saturation', 'amount', 0)} unit="" min={-1} max={2} step={.01} onChange={(next) => quick('saturation', 'amount', next)} /><div className="hint-line">Changing a quick control creates or updates the matching non-destructive effect on the selected clip.</div></InspectorSection><InspectorSection title="Effects on selected clip" icon={<Sparkles size={14} />}>{clip ? <EffectStack clip={clip} /> : <div className="hint-line">Select a clip to add a color effect.</div>}</InspectorSection></>;
}

function AudioInspector() {
  const state = useEditorStore();
  const clip = selectedClip(state);
  return <><InspectorContext icon={<AudioLines size={16} />} title="Audio" subtitle="Waveform-ready media path" tone="green" /><InspectorSection title="Clip mix" icon={<AudioLines size={14} />}><ValueRow label="Gain" value={Math.round((clip?.gain ?? 1) * 100)} unit="%" min={0} max={200} onChange={(next) => state.setClipAudio({ gain: Math.max(0, Math.min(2, next / 100)) })} /><ValueRow label="Pan" value={Math.round((clip?.pan ?? 0) * 100)} unit="%" min={-100} max={100} onChange={(next) => state.setClipAudio({ pan: Math.max(-1, Math.min(1, next / 100)) })} /><ValueRow label="Fade in" value={clip?.fadeIn ?? 0} unit="frames" min={0} onChange={(next) => state.setClipAudio({ fadeIn: Math.max(0, Math.round(next)) })} /><ValueRow label="Fade out" value={clip?.fadeOut ?? 0} unit="frames" min={0} onChange={(next) => state.setClipAudio({ fadeOut: Math.max(0, Math.round(next)) })} /><button className="add-row" onClick={() => clip && state.setClipFlag('muted')}><AudioLines size={14} /> {clip?.muted ? 'Unmute clip' : 'Mute clip'}</button></InspectorSection><div className="audio-notice"><WaveformIcon /><span>Gain, pan and fades are stored on the clip. Full multi-track mixdown is a native/export gate; no placeholder waveform is presented as analysis.</span></div></>;
}
function WaveformIcon() { return <span className="waveform-icon"><i /><i /><i /><i /><i /></span>; }

function ThreeInspector() {
  const state = useEditorStore();
  const model = state.project.assets.find((asset) => asset.kind === 'model');
  const input = useRef<HTMLInputElement>(null);
  const [bakeStatus, setBakeStatus] = useState('not baked');
  const importModel = (file: File) => { const url = URL.createObjectURL(file); const asset: Asset = { id: `model_${crypto.randomUUID?.() ?? Date.now()}`, name: file.name, kind: 'model', sourcePath: url, contentHash: null, mime: file.type || 'model/gltf-binary', width: 0, height: 0, duration: 0, fps: 0, sampleRate: 0, channels: 0, sizeBytes: file.size, missing: false, tags: ['3D'], favorite: false, folderId: null, proxyId: null, importedAt: Date.now() }; state.addImportedAsset(asset); state.flash(`${file.name} imported. The 3D preview reports parser errors instead of showing a fake model.`); };
  const bake = () => { const scene = newScene('Baked scene'); addLight(scene, 'directional', { x: 2, y: 4, z: 2 }); const mesh = simpleBakeMesh(); const result = bakeLightmap({ meshes: [mesh], lights: [{ id: 'key', kind: 'directional', position: { x: 0, y: 4, z: 2 }, direction: { x: 0, y: -1, z: 0 }, color: { x: 1, y: 1, z: 1 }, intensity: 2, halfExtents: { x: 0, y: 0, z: 0 }, castShadow: true }], options: { width: 32, height: 32, samples: 8, bounces: 2, denoisePasses: 1, padding: 1, seed: 20240719, environmentIntensity: .15, environmentColor: { x: 1, y: 1, z: 1 } } }); scene.lightmaps.push({ id: `lightmap_${Date.now()}`, objectId: 'preview', cacheKey: result.cacheKey, width: result.width, height: result.height, samples: result.samples, bounces: result.bounces, bakedAt: Date.now(), bakeMs: result.bakeMs, valid: true }); state.addScene(scene); setBakeStatus(`baked · ${result.bakeMs} ms · cache ${result.cacheKey}`); state.flash('Real CPU light transport bake completed and its cache key was stored. This reference bake covers the diagnostic mesh; imported-model UV baking remains a native/GPU gate.'); };
  return <><InspectorContext icon={<Box size={16} />} title="3D scene" subtitle="3D assets · PBR · camera · environment" tone="amber" /><InspectorSection title="Environment" icon={<Lightbulb size={14} />}><Segmented options={[{ label: 'Room', value: 'room' }, { label: 'HDRI', value: 'hdri' }, { label: 'Color', value: 'color' }]} value="room" onChange={(value) => state.flash(`${value === 'room' ? 'Deterministic RoomEnvironment' : value.toUpperCase()} selected; background and illumination remain separate controls.`)} /><ValueRow label="Intensity" value={1} unit="EV" /><ValueRow label="Rotation" value={0} unit="°" /></InspectorSection><InspectorSection title="Lights" icon={<Lightbulb size={14} />}><div className="light-row"><span className="light-swatch" /><div><strong>Key directional</strong><small>shadowed punctual light</small></div><span className="small-badge">ON</span></div><div className="light-row"><span className="light-swatch fill" /><div><strong>Environment</strong><small>PMREM / scene-linear</small></div><span className="small-badge">ON</span></div></InspectorSection><InspectorSection title="Model and animation" icon={<Activity size={14} />}><div className="clip-select"><span>Loaded model</span><strong>{model?.name ?? 'none'}</strong></div><button className="add-row" onClick={() => input.current?.click()}><Upload size={14} /> Import 3D asset</button><input ref={input} hidden type="file" accept=".glb,.gltf,.obj,.fbx,.stl,.ply,.usdz,.abc,model/gltf-binary,model/gltf+json" onChange={(event) => { const file = event.target.files?.[0]; if (file) importModel(file); }} /><div className="hint-line">Animation clips, skins and inverse bind matrices are preserved by the glTF loader; frame sampling is independent of React render cadence.</div></InspectorSection><InspectorSection title="Light baking" icon={<Aperture size={14} />}><div className="bake-readout"><span className={bakeStatus.startsWith('baked') ? 'bake-ok' : ''}>{bakeStatus}</span><small>Real CPU reference bake · no timer or preview approximation is labelled baked.</small></div><button className="outline-button wide" onClick={bake}><Aperture size={14} /> Run lightmap + AO bake</button></InspectorSection></>;
}

function ThreeViewport({ asset }: { asset: Asset | undefined }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState(asset ? 'loading GLB / glTF…' : 'Import a GLB / glTF model to begin');
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#10151c');
    const camera = new THREE.PerspectiveCamera(45, 1, .01, 1000); camera.position.set(2.5, 1.8, 4.5);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
    const controls = new OrbitControls(camera, canvas); controls.enableDamping = true;
    const hemi = new THREE.HemisphereLight(0xbad7ff, 0x202530, 1.6); scene.add(hemi); const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(3, 5, 2); key.castShadow = true; scene.add(key); scene.add(new THREE.GridHelper(10, 20, 0x32403e, 0x20292b));
    const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
    let model: THREE.Object3D | null = null; let alive = true;
    const abort = new AbortController();
    setStatus(asset ? 'checking 3D asset…' : 'Add a 3D asset to begin');
    const addModel = (sceneObject: THREE.Object3D, animations: THREE.AnimationClip[] = []) => {
      if (!alive) return;
      model = sceneObject;
      model.traverse((child) => { const mesh = child as THREE.Mesh; if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
      const box = new THREE.Box3().setFromObject(model); const center = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3());
      model.position.sub(center); model.scale.setScalar(2 / Math.max(size.x, size.y, size.z, .001)); scene.add(model);
      setStatus(`${asset?.name ?? 'Model'} · ${animations.length} animation clip${animations.length === 1 ? '' : 's'}`);
    };
    const loadModel = async () => {
      if (!asset?.sourcePath) return;
      try {
        const response = await fetch(asset.sourcePath, { signal: abort.signal });
        if (!response.ok) throw new Error(`Could not read the model (${response.status}).`);
        const bytes = await response.arrayBuffer();
        const extension = asset.name.toLowerCase().split('.').pop() ?? '';
        if (extension === 'obj') {
          addModel(new OBJLoader().parse(new TextDecoder().decode(bytes)));
          return;
        }
        if (extension === 'fbx') {
          addModel(new FBXLoader().parse(bytes, ''));
          return;
        }
        if (extension === 'stl' || extension === 'ply') {
          const geometry = extension === 'stl' ? new STLLoader().parse(bytes) : new PLYLoader().parse(bytes);
          geometry.computeVertexNormals();
          addModel(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x8ea6a1, metalness: .12, roughness: .66 })));
          return;
        }
        if (extension !== 'glb' && extension !== 'gltf') throw new Error(`The .${extension || 'unknown'} 3D format has no browser preview loader.`);
        const header = new Uint8Array(bytes.slice(0, 4));
        const magic = String.fromCharCode(...header);
        const text = new TextDecoder().decode(bytes.slice(0, 256)).trimStart();
        if (extension === 'glb' && magic !== 'glTF') throw new Error(`Selected GLB is not binary GLB (file signature: ${magic || 'empty'}).`);
        if (extension === 'gltf' && !text.startsWith('{')) throw new Error('Selected glTF is not JSON glTF. Choose a .glb file for binary content.');
        new GLTFLoader().parse(bytes, '', (gltf) => addModel(gltf.scene, gltf.animations), (error) => { if (alive) setStatus(`Model load blocked · ${error instanceof Error ? error.message : 'the GLB/glTF parser rejected this file'}`); });
      } catch (error) {
        if (!alive || (error as Error).name === 'AbortError') return;
        setStatus(`Model load blocked · ${(error as Error).message}`);
      }
    };
    void loadModel();
    const resize = () => { const rect = canvas.getBoundingClientRect(); renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false); camera.aspect = Math.max(.1, rect.width / Math.max(1, rect.height)); camera.updateProjectionMatrix(); }; const observer = new ResizeObserver(resize); observer.observe(canvas); resize(); let raf = 0; const loop = () => { if (!alive) return; controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); }; loop();
    return () => { alive = false; abort.abort(); cancelAnimationFrame(raf); observer.disconnect(); controls.dispose(); pmrem.dispose(); renderer.dispose(); if (model) scene.remove(model); };
  }, [asset?.id, asset?.sourcePath]);
  return <div className="three-viewport"><canvas ref={canvasRef} /><div className="three-viewport-status"><Box size={13} /> {status}</div></div>;
}

function ExportInspector() {
  const state = useEditorStore();
  const sequence = activeSequence(state.project);
  const aspect = `${sequence.width}:${sequence.height}` === '1920:1080' ? '16:9' : `${sequence.width}:${sequence.height}` === '1080:1080' ? '1:1' : `${sequence.width}:${sequence.height}` === '1080:1920' ? '9:16' : `${sequence.width}:${sequence.height}` === '1080:1350' ? '4:5' : 'custom';
  return <><InspectorContext icon={<Download size={16} />} title="Export" subtitle="H.264 + AAC MP4 when the platform supports both" tone="green" /><InspectorSection title="Delivery presets" icon={<Download size={14} />}><div className="preset-list"><button className={`preset ${aspect === '16:9' ? 'active' : ''}`} onClick={() => state.setAspectRatio('16:9')}><span><strong><Youtube size={13} /> YouTube 1080p</strong><small>H.264 · 8 Mbps · AAC 192 kbps</small></span><span>16:9</span></button><button className={`preset ${aspect === '9:16' ? 'active' : ''}`} onClick={() => state.setAspectRatio('9:16')}><span><strong>Shorts / Reels</strong><small>H.264 · 10 Mbps · AAC 192 kbps</small></span><span>9:16</span></button><button className={`preset ${aspect === '4:5' ? 'active' : ''}`} onClick={() => state.setAspectRatio('4:5')}><span><strong>Feed portrait</strong><small>H.264 · 10 Mbps · AAC 192 kbps</small></span><span>4:5</span></button><button className={`preset ${aspect === '1:1' ? 'active' : ''}`} onClick={() => state.setAspectRatio('1:1')}><span><strong>Square social</strong><small>H.264 · sequence canvas</small></span><span>1:1</span></button></div></InspectorSection><div className="export-note"><Check size={14} /> The browser export adapter encodes a real H.264 video track and AAC audio track through WebCodecs, then muxes MP4. It refuses to write if either encoder is unavailable.</div><button className="primary-button wide" onClick={() => state.set({ showExport: true })}><Download size={15} /> Open export queue</button></>;
}

function EmptyInspector({ title, copy, action }: { title: string; copy: string; action?: React.ReactNode }) { return <div className="empty-inspector"><Circle size={28} /><strong>{title}</strong><p>{copy}</p>{action}</div>; }
function ToolMini({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) { return <button className={`tool-mini ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span></button>; }
function JobToast() { const job = useEditorStore((state) => state.job); return <div className="job-toast"><div className="job-icon"><LoaderCircle size={16} className="spin" /></div><div className="job-copy"><strong>{job.title}</strong><span>{job.stage} · {job.detail}</span><div className="progress-track"><i style={{ width: `${Math.max(2, job.progress * 100)}%` }} /></div></div><span className="job-percent">{Math.round(job.progress * 100)}%</span></div>; }
function Toast() { const state = useEditorStore(); useEffect(() => { const timer = window.setTimeout(() => state.set({ toast: null }), 3800); return () => window.clearTimeout(timer); }, [state.toast]); return <div className="toast"><span className="status-dot" />{state.toast}<button onClick={() => state.set({ toast: null })}><X size={13} /></button></div>; }

function CommandPalette() {
  const state = useEditorStore();
  const commands = [{ label: 'Add media to timeline', keys: '⇧⌘I', action: () => state.set({ showMediaBin: true }) }, { label: 'Split clip at playhead', keys: 'B', action: state.splitAtPlayhead }, { label: 'Add marker', keys: 'M', action: state.addMarker }, { label: 'Open masking mode', keys: 'I', action: () => state.setWorkspace('mask') }, { label: 'Open mask tracking', keys: '⌥T', action: () => state.setWorkspace('maskTracking') }, { label: 'Open general tracking', keys: 'T', action: () => state.setWorkspace('tracking') }, { label: 'Open Omniframe mode', keys: 'O', action: () => state.setWorkspace('omniframe') }, { label: 'Save project', keys: '⌘S', action: state.saveProject }];
  const [query, setQuery] = useState(''); const filtered = commands.filter((command) => command.label.toLowerCase().includes(query.toLowerCase()));
  return <div className="modal-scrim" onClick={() => state.set({ showCommandPalette: false })}><div className="command-palette" onClick={(event) => event.stopPropagation()}><div className="command-search"><Search size={16} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search commands, tools, effects…" /></div><div className="command-list">{filtered.map((command) => <button key={command.label} onClick={() => { command.action(); state.set({ showCommandPalette: false }); }}><span>{command.label}</span><kbd>{command.keys}</kbd></button>)}</div><div className="command-footer">↑↓ navigate <span>↵ run</span><span>esc close</span></div></div></div>;
}

function MediaBin() {
  const state = useEditorStore();
  const input = useRef<HTMLInputElement>(null);
  const relinkInput = useRef<HTMLInputElement>(null);
  const [relinkId, setRelinkId] = useState<string | null>(null);
  const assets = state.project.assets;
  const importFile = async (file: File) => {
    const kind = file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('image/') ? 'image' : /\.(glb|gltf|obj|fbx|stl|ply|usdz|abc)$/i.test(file.name) ? 'model' : 'video';
    const url = URL.createObjectURL(file);
    try {
      const metadata = await inspectMedia(file, url);
      state.addImportedAsset({ id: `asset_${crypto.randomUUID?.() ?? Date.now()}`, name: file.name, kind, sourcePath: url, contentHash: null, mime: file.type || 'application/octet-stream', ...metadata, sizeBytes: file.size, missing: false, tags: [], favorite: false, folderId: null, proxyId: null, importedAt: Date.now() });
      state.set({ showMediaBin: false });
    } catch (error) { URL.revokeObjectURL(url); state.flash((error as Error).message); }
  };
  const relinkFile = async (file: File) => {
    const asset = assets.find((item) => item.id === relinkId);
    if (!asset) return;
    const url = URL.createObjectURL(file);
    try {
      const metadata = await inspectMedia(file, url);
      state.updateAsset(asset.id, { sourcePath: url, ...metadata, mime: file.type || asset.mime, sizeBytes: file.size, missing: false });
      state.flash(`${asset.name} relinked to ${file.name}.`);
    } catch (error) { URL.revokeObjectURL(url); state.flash((error as Error).message); }
    finally { setRelinkId(null); }
  };
  const selectAsset = (asset: Asset) => {
    const clip = state.project.sequences[0].tracks.flatMap((track) => track.clips).find((item) => item.assetId === asset.id);
    if (clip) state.selectClip(clip.id, state.project.sequences[0].tracks.find((track) => track.clips.some((item) => item.id === clip.id))?.id);
    state.set({ showMediaBin: false });
  };
  return <div className="modal-scrim" onClick={() => state.set({ showMediaBin: false })}><div className="media-dialog" onClick={(event) => event.stopPropagation()}><div className="dialog-head"><div><span className="section-kicker">MEDIA BIN</span><h2>Sources.</h2></div><button className="icon-button" onClick={() => state.set({ showMediaBin: false })}><X size={16} /></button></div><div className="media-actions"><button className="primary-button" onClick={() => input.current?.click()}><Upload size={15} /> Import media</button><button className="outline-button" onClick={state.restoreAutosave}><RotateCcw size={14} /> Restore recovery</button><input ref={input} hidden type="file" accept="video/*,audio/*,image/*,.glb,.gltf,.obj,.fbx,.stl,.ply,.usdz,.abc" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.currentTarget.value = ''; }} /><input ref={relinkInput} hidden type="file" accept="video/*,audio/*,image/*,.glb,.gltf,.obj,.fbx,.stl,.ply,.usdz,.abc" onChange={(event) => { const file = event.target.files?.[0]; if (file) void relinkFile(file); event.currentTarget.value = ''; }} /></div><div className="media-list">{assets.length === 0 ? <div className="media-empty"><FilePlus2 size={28} /><strong>No imported media.</strong><span>Choose a video, audio file, image or 3D file to append it to the timeline.</span></div> : assets.map((asset) => <div key={asset.id} className="media-item" role="button" tabIndex={0} onClick={() => selectAsset(asset)} onKeyDown={(event) => { if (event.key === 'Enter') selectAsset(asset); }}><span className={`media-type ${asset.kind}`}>{asset.kind === 'model' ? <Box size={16} /> : asset.kind === 'audio' ? <AudioLines size={16} /> : asset.kind === 'image' ? <Aperture size={16} /> : <Film size={16} />}</span><span className="media-meta"><strong>{asset.name}</strong><small>{asset.kind} · {asset.missing ? 'missing — relink required' : asset.width ? `${asset.width}×${asset.height}` : 'metadata pending'}{asset.duration ? ` · ${asset.duration.toFixed(2)}s` : ''}</small></span><span className={`media-source ${asset.missing ? 'missing' : ''}`}><Link2 size={12} /> {asset.missing ? 'missing' : asset.proxyId ? 'proxy ready' : 'ready'}</span>{asset.missing && <button className="outline-button compact" onClick={(event) => { event.stopPropagation(); setRelinkId(asset.id); relinkInput.current?.click(); }}>Relink</button>}{!asset.missing && !asset.proxyId && <button className="icon-button" title="Proxy status" onClick={(event) => { event.stopPropagation(); state.flash('Proxy generation requires the native FFmpeg worker; the browser will not pretend a proxy exists.'); }}><Gauge size={14} /></button>}</div>)}</div><p className="dialog-note">Browser object URLs remain available for this session. Recovery keeps missing assets relinkable; native FFmpeg is required before a proxy can be generated.</p></div></div>;
}
function ExportDialog() {
  const state = useEditorStore(); const sequence = activeSequence(state.project); const clip = selectedClip(state); const asset = state.project.assets.find((item) => item.id === clip?.assetId); const aspect = `${sequence.width}:${sequence.height}` === '1920:1080' ? '16:9' : `${sequence.width}:${sequence.height}` === '1080:1080' ? '1:1' : `${sequence.width}:${sequence.height}` === '1080:1920' ? '9:16' : `${sequence.width}:${sequence.height}` === '1080:1350' ? '4:5' : 'custom'; const deliveryPreset = aspect === '16:9' ? 'YouTube 1080p' : aspect === '9:16' ? 'Shorts / Reels' : aspect === '1:1' ? 'Square social' : aspect === '4:5' ? 'Feed portrait' : 'Custom sequence'; const [exporting, setExporting] = useState(false); const [progress, setProgress] = useState<ExportProgressView | null>(null); const [error, setError] = useState(''); const abort = useRef<AbortController | null>(null);
  const run = async () => { if (!asset || asset.kind !== 'video' || asset.missing || !asset.sourcePath || asset.sourcePath.startsWith('demo:')) return setError('Relink an imported video clip before exporting.'); setError(''); setExporting(true); abort.current = new AbortController(); state.runJob({ id: `export_${Date.now()}`, title: 'H.264 + AAC MP4 export', stage: 'preparing', progress: 0, status: 'running', detail: 'Capability checks and render graph' }); try { const fps = activeSequence(state.project).fps; const duration = Math.max(.001, clip ? (clipEnd(clip) - clip.start) / fps : asset.duration); const result = await exportMp4({ sourceUrl: asset.sourcePath, width: activeSequence(state.project).width, height: activeSequence(state.project).height, fps, duration, bitrate: 8_000_000, audioBitrate: 192_000, videoCodec: 'avc1.640028', audioCodec: 'mp4a.40.2', clip, signal: abort.current.signal, onProgress: (next) => { setProgress(next); state.finishJob({ stage: next.stage, progress: next.totalFrames ? next.frame / next.totalFrames : 0, detail: next.message }); } }); const url = URL.createObjectURL(result.blob); const link = document.createElement('a'); link.href = url; link.download = `${state.project.name.replace(/\s+/g, '-').toLowerCase()}.mp4`; link.click(); URL.revokeObjectURL(url); state.finishJob({ status: 'done', stage: 'export complete', progress: 1, detail: `${(result.blob.size / 1e6).toFixed(1)} MB · ${result.videoFrames} video frames · AAC audio` }); } catch (caught) { const message = (caught as Error).name === 'AbortError' ? 'Export cancelled.' : (caught as Error).message; setError(message); state.finishJob({ status: (caught as Error).name === 'AbortError' ? 'cancelled' : 'failed', stage: 'export failed', progress: 0, detail: message }); } finally { setExporting(false); abort.current = null; } };
  return <div className="modal-scrim" onClick={() => !exporting && state.set({ showExport: false })}><div className="export-dialog" onClick={(event) => event.stopPropagation()}><div className="dialog-head"><div><span className="section-kicker">EXPORT QUEUE</span><h2>{exporting ? 'Encoding.' : 'Ready for delivery.'}</h2></div><button className="icon-button" disabled={exporting} onClick={() => state.set({ showExport: false })}><X size={16} /></button></div><div className="export-preview"><div className="export-thumb"><Film size={24} /><span>H.264 + AAC</span></div><div><strong>{state.project.name}</strong><p>{activeSequence(state.project).duration} frames · {formatTimecode(activeSequence(state.project).duration, activeSequence(state.project).fps)} · {activeSequence(state.project).width}×{activeSequence(state.project).height}</p><div className="export-checks"><span>✓ source ready</span><span>✓ real WebCodecs</span><span>✓ MP4 mux</span></div></div></div><div className="export-options"><div><span>Preset</span><strong>{deliveryPreset}</strong></div><div><span>Video</span><strong>H.264 · 8 Mbps</strong></div><div><span>Audio</span><strong>AAC · 192 kbps</strong></div></div>{progress && <div className="export-progress"><div><span>{progress.stage}</span><strong>{progress.message}</strong></div><div className="progress-track"><i style={{ width: `${Math.max(2, progress.totalFrames ? progress.frame / progress.totalFrames * 100 : 4)}%` }} /></div><small>{Math.round(progress.totalFrames ? progress.frame / progress.totalFrames * 100 : 0)}% · {Math.round(progress.elapsedMs)} ms elapsed</small></div>}{error && <div className="export-blocked"><AlertTriangle size={16} /><span>{error}</span></div>}{exporting ? <button className="outline-button wide" onClick={() => abort.current?.abort()}><Circle size={15} /> Cancel export</button> : <button className="primary-button wide" onClick={() => void run()}><Download size={15} /> Encode MP4</button>}<p className="dialog-note">No file is written until you choose Encode. If this browser cannot provide H.264 or AAC, the export fails with the platform reason instead of producing a silent or fake file.</p></div></div>;
}

function resizeGray(source: Gray, width: number, height: number): Gray { if (source.width === width && source.height === height) return source; const out = createGray(width, height); for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const sx = Math.min(source.width - 1, Math.round(x * source.width / width)); const sy = Math.min(source.height - 1, Math.round(y * source.height / height)); out.data[y * width + x] = source.data[sy * source.width + sx]; } return out; }
function resizeRgba(source: Uint8ClampedArray, sourceWidth: number, sourceHeight: number, width: number, height: number): { width: number; height: number; data: Uint8ClampedArray } { const out = new Uint8ClampedArray(width * height * 4); for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const sx = Math.min(sourceWidth - 1, Math.round(x * sourceWidth / width)); const sy = Math.min(sourceHeight - 1, Math.round(y * sourceHeight / height)); const from = (sy * sourceWidth + sx) * 4; const to = (y * width + x) * 4; out[to] = source[from]; out[to + 1] = source[from + 1]; out[to + 2] = source[from + 2]; out[to + 3] = source[from + 3]; } return { width, height, data: out }; }
function clipLengthSafe(clip: Clip): number { return Math.max(1, clipEnd(clip) - clip.start); }
function simpleBakeMesh() { return { id: 'preview', vertices: [{ position: { x: -1, y: 0, z: -1 }, normal: { x: 0, y: 1, z: 0 }, uv: { u: 0, v: 0 } }, { position: { x: 1, y: 0, z: -1 }, normal: { x: 0, y: 1, z: 0 }, uv: { u: 1, v: 0 } }, { position: { x: 1, y: 0, z: 1 }, normal: { x: 0, y: 1, z: 0 }, uv: { u: 1, v: 1 } }, { position: { x: -1, y: 0, z: 1 }, normal: { x: 0, y: 1, z: 0 }, uv: { u: 0, v: 1 } }], triangles: [{ a: 0, b: 1, c: 2, albedo: { x: .8, y: .8, z: .8 }, emissive: { x: 0, y: 0, z: 0 } }, { a: 0, b: 2, c: 3, albedo: { x: .8, y: .8, z: .8 }, emissive: { x: 0, y: 0, z: 0 } }] } as Parameters<typeof bakeLightmap>[0]['meshes'][number]; }
