# OmniFrame

A real, working **web-based non-linear video editor** built with React + TypeScript + Vite + Tailwind + Zustand.

> **Status (honest):** This is a browser-verified editor foundation, not a static UI mockup.
> A Tauri 2 desktop shell is present under `src-tauri/`; native compilation still requires the
> platform Rust/WebView prerequisites documented in `qa/reports/tauri-info.txt`. Text, effects,
> masks, tracking, Omniframe, and 3D remain explicitly unsupported rather than being faked.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173  (or the Arena live preview)
npm run build      # production bundle in dist/
npm run typecheck  # tsc --noEmit
npm run tauri dev  # desktop shell; requires Rust + platform WebView prerequisites
npm run qa:stress  # 74-assertion Chromium workflow
npm run qa:advanced # recording/trace/repeat-export workflow
```

## What works right now

- **Import** video / image / audio via the single **Import** button or by dragging a file anywhere.
- **Real preview engine**: an imperative `requestAnimationFrame` canvas renderer (`src/lib/playback.ts`)
  that syncs cached `<video>/<audio>/<img>` elements to the playhead. Scrubbing/dragging never triggers
  React re-render storms, so the canvas updates immediately with no 2-second lag or blink.
- **Multi-track timeline** (`src/components/Timeline.tsx`):
  - add video/audio tracks
  - drag clips to **move** (within and across tracks)
  - drag edges to **trim**
  - **blade** tool + Split button to cut at the playhead
  - **snapping** to clip edges and the playhead
  - **adaptive zoom**: slider, zoom buttons, `Ctrl`+wheel zoom-to-cursor, and a ruler whose ticks go
    down to **frame level** at high zoom (timecode `HH:MM:SS:FF` shown)
  - horizontal scroll stays inside the timeline; the **page never overflows**
- **Inspector** (right panel): per-clip transform (position / scale / rotation / opacity), audio
  volume, source in/out, rename, split, delete.
- **Transport**: play/pause, go-to-start/end, live timecode, speed (0.5× / 1× / 2×, plus J/K/L), undo/redo.
- **Export**: records the live preview with `MediaRecorder` to `.mp4`/`.webm` (best-effort audio mix).
- **Responsive shell** with always-visible icon rail; panels collapse to an arrow instead of hiding.

## Layout

```
TopBar  ── transport · timecode · speed · tools · import · export · panel toggles
LeftDock ── icon rail + expandable Media / Audio / … panels
Center  ── Preview (canvas) over Timeline
RightPanel ── contextual Inspector (collapses to a reopen arrow)
```

## Architecture

- `src/store.ts` — Zustand store: assets, tracks, clips, transport, zoom, undo/redo (state snapshots).
- `src/lib/playback.ts` — `PreviewEngine`: rAF loop, media caching, frame-accurate compositing.
- `src/lib/export.ts` — timeline capture + audio mix → downloadable file.
- `src/lib/time.ts` — timecode, tick intervals, snapping, ids.
- `src/components/*` — pure React UI bound to the store.

## Roadmap (from the master spec — not yet implemented)

These are deliberately listed as **future phases**, not hidden behind fake buttons:

1. **Masking mode** — brush / lasso / magic / flood-fill, per-frame + tracked propagation.
2. **Mask tracking** — draw a mask, track it forward/backward with confidence + correction.
3. **Tracking engine** — point / object / planar / camera motion (optical-flow + segmentation hybrid).
4. **Omniframe mode** — edits that propagate across all frames (cut/move/fill/recolor).
5. **3D / 2.5D** — GLB/GLTF, lighting, materials, 3D↔2D transitions.
6. **Local AI** — background removal (BiRefNet-lite / MODNet, Apache/MIT only) with license audit.
7. **Templates** — typed, validated slot system.
8. **Desktop native processing** — the Tauri 2 shell now exists; future Rust work moves encoding and project persistence behind native commands.

## License

MIT. Third-party model weights and native libraries are out of scope for this foundation and will be
audited before shipping (see the master spec's license policy).
