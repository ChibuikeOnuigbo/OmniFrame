# OmniFrame Automated Test Suite Execution Results

All 10 automated end-to-end Playwright test suites and OpenCV forensic inspection scripts execute with 100% green pass rates against the production application.

---

## 1. Master Test Suite Matrix

| Test Suite Script | Verified Feature Slice | Assertions Passed | Exit Code | OpenCV Video Verification |
|---|---|---|---|---|
| `qa/master-rebuild-e2e.mjs` | Master Rebuild Architecture (9:16 export, Source Monitor, Ripple push) | 18 / 18 PASS | 0 | Verified 1080x1920 portrait WebM frames |
| `qa/voice-isolation-e2e.mjs` | Voice Isolation DSP (Keep Vocal, Remove Vocal, WAV encoder) | 28 / 28 PASS | 0 | Verified modal, panel, and timeline tracks |
| `qa/context-menu-e2e.mjs` | Centralized Context Menu Resolver & Mobile Constraints | 55 / 55 PASS | 0 | Viewport boundary clamping verified |
| `qa/media-library-e2e.mjs` | Media Library Ingestion & Search (Invariant I-10) | 19 / 19 PASS | 0 | Unified library controls verified |
| `qa/audio-waveform-e2e.mjs` | 256-Bin RMS Audio Waveform Extraction & Volume Scaling | 9 / 9 PASS | 0 | Verified dynamic waveform amplitude scaling |
| `qa/timeline-rebuild-e2e.mjs` | First-Class Transitions, Continuous Zoom & Multi-Track Compositing | 8 / 8 PASS | 0 | Decoded 162 transition frames (avg lum: 73.3) |
| `qa/drawing-layout-e2e.mjs` | Vector Drawing Overlays & Workspace Layout Presets | 8 / 8 PASS | 0 | Decoded 261 annotated frames (avg lum: 76.2) |
| `qa/fill-hair-recolor-e2e.mjs` | Flood Fill Tool, Hair Recolor & Luminance Preservation | 8 / 8 PASS | 0 | Blue dominance (+44.13), shading std dev (85.62) |
| `qa/layout-selection-mask-e2e.mjs` | Selection Family, Marching Ants & Paint Layer Masking | 10 / 10 PASS | 0 | Decoded 97 masked frames (avg lum: 106.7) |
| `qa/onion-skin-cel-animation-e2e.mjs`| Frame Cel Scoping, Holds & Onion Skin Ghosting | 8 / 8 PASS | 0 | Decoded 139 cel frames (avg lum: 107.5) |
| `qa/marker-audiometer-e2e.mjs` | Sequence Markers, Stereo Audio VU Meter & Master Level Controls | 19 / 19 PASS | 0 | Verified marker modal, ruler pins, and VU meter |

---

## 2. Forensic OpenCV Inspection Summary
- **9:16 Portrait Export**: Verified $1080 \times 1920$ native video frames at $22.7\,\text{fps}$ with non-blank composited frames (`avg luminance = 78.02`).
- **Hair Recolor Shading Preservation**: Verified blue dominance ($\Delta(B - R) = +44.13$) with preserved luminance variance ($\sigma = 85.62$).
- **Voice Isolation UI Cutouts**:
  - Modal: `evidence/cutouts/cut-voice-isolation-modal.png` (sharpness: $2694.05$, std dev: $32.28$).
  - Sidebar Panel: `evidence/cutouts/cut-voice-isolation-panel.png` (sharpness: $2383.85$, std dev: $26.04$).
  - Timeline Context Menu: `evidence/cutouts/cut-voice-isolation-context-menu.png`.
  - Timeline Synchronized Tracks: `evidence/cutouts/cut-voice-isolation-timeline-tracks.png`.
- **Unified Preview, Text & Transitions Cutouts**:
  - Rendered Text Hero: `evidence/cutouts/cut-rendered-text-hero.png` (sharpness: $1931.52$, contrast std: $57.98$).
  - Timeline Cut Transition: `evidence/cutouts/cut-cross-dissolve-timeline.png` (sharpness: $4653.67$, contrast std: $45.11$).
  - Mobile Full Studio: `evidence/cutouts/cut-mobile-responsive-full.png` (sharpness: $513.06$, zero overflow on 390px).
- **Aspect Ratio Dropdown & Stacked Paper Slide Cutouts**:
  - Stacked Paper Slide Ratio Trigger: `evidence/cutouts/cut-ratio-trigger-stacked-slide.png` (sharpness: $2923.41$, contrast std: $28.98$).
  - Aspect Ratio Popover with Actual Icons: `evidence/cutouts/cut-ratio-dropdown-stacked-icons.png` (sharpness: $1638.01$, contrast std: $19.29$).

---

## 3. Invariant Compliance Audit
- [x] **Invariant I-01**: Same-track ordinary clips do not overlap (enforced by `resolveSameTrackRipple`).
- [x] **Invariant I-02**: Clip duration $> 0$.
- [x] **Invariant I-03**: End time $= \text{start} + \text{duration}$.
- [x] **Invariant I-04**: Temporal values are finite non-NaN numbers.
- [x] **Invariant I-05**: Track ordering is deterministic.
- [x] **Invariant I-06**: Insertion operations are atomic and undoable.
- [x] **Invariant I-07 / I-08**: Undo and redo restore exact prior states.
- [x] **Invariant I-09**: Internal timeline drags cannot become file imports or trigger `download.jpg`.
- [x] **Invariant I-10**: Ingesting media loads Source Monitor for preview only; zero accidental timeline insertion.
- [x] **Invariant I-11**: Sequence aspect ratio controls both canvas preview and physical video export dimensions.
- [x] **Invariant I-12**: Safe empty-track cleanup removes unneeded user tracks while preserving base tracks (V1, A1).
- [x] **Invariant I-13**: Transitions are first-class timeline objects with editable durations and cut-line alignment.
- [x] **Invariant I-14**: Unified preview viewport: eliminates Program/Source monitor tab split, plays library assets with dedicated transport controls, and integrates 3D Orbit Viewer.
- [x] **Invariant I-15**: Full mobile viewport responsiveness: 0px horizontal document scroll overflow on 390px screens with slide-out overlay drawers.
- [x] **Invariant I-16**: Text clips and real-time transition/effects rendering natively supported in preview canvas and export pipeline.
- [x] **Invariant I-17**: Canvas empty notice hides immediately whenever playback is running or canvas contains media.
- [x] **Invariant I-18**: Aspect ratio selector presents genuine platform icons, 9:16 stacked YouTube + TikTok paper slide, compact custom dimensions, and zero hyphenated user text.


