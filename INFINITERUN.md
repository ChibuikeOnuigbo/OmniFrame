# OmniFrame Infinite Run Continuous Engineering Loop (`INFINITERUN.md`)

## 1. Executive Directive & Philosophy
OmniFrame is developed under an uninterrupted continuous engineering loop. Work is driven by rigorous, automated end-to-end verification, forensic video inspection with OpenCV, mathematical precision, clean-room TypeScript architectures, and zero placeholder compromise.

### Core Operating Principles:
1. **Never Stop on Failure**: When an assertion, compile step, or test fails, diagnose the exact root cause, rectify the code, re-verify with automated E2E suites, and record the post-mortem in `FIXED_FAILURES.md`.
2. **Never Declare Done from Inspection Alone**: A feature is only verified when executed in a real headless browser session, interacted with via synthetic input, visually captured in full-frame screenshots and zoomed cutouts, and mathematically verified.
3. **No Fake Placeholders**: Never substitute real rendering pipelines with CSS stub animations or empty mockup containers. Drawing must write real vector stroke data and rasterize onto Canvas/WebGL buffers; video exports must encode real decodable frames; transitions must interpolate mathematical blend equations.
4. **Clean-Room Engineering**: Research GPL and proprietary benchmarks (Kdenlive, Shotcut, OpenShot, Olive, CapCut, After Effects) for algorithmic paradigms and interfaces, documenting all insights in `RESEARCH_SOURCES.md` while authoring 100% original TypeScript and React code.

---

## 2. Engineering Milestones & Architectural Roadmap

### Milestone 1: Timeline & Track Rebuild (COMPLETED & FULLY VERIFIED)
- Invariant temporal interval data model (`start`, `duration`, `trackId`).
- Dynamic multi-track vertical stacking and creation above/below.
- First-class transition entities (`Transition`) with real cut-line visual representations, trim handles, and context menu preset switching.
- Continuous timeline zoom with frame-accurate adaptive timecode ruler.
- Headless video export with live transition compositing, verified by Python OpenCV frame decoding (187 frames decoded at 132.83 avg luminance).
- 2,000 timeline specification concepts authored in `timeline_ideas.md`.

### Milestone 2: Professional Drawing & Paint Subsystem (ACTIVE)
- Non-destructive paint layer data model (`PaintLayer`, `Stroke`, `Point`, `BrushTool`, `BlendMode`).
- Stroke recording capturing timestamp, pressure, coordinates, color, stroke width, and smoothing.
- Temporal paint scope (frame-by-frame cel animation, hold frame, track duration, clip attachment).
- Feature-Slice 01 (Basic Paint): Brush, Eraser, Line, Rectangle, Circle, Color Picker, Stroke Width, and Real-time Canvas Renderer. (VERIFIED - Run #1).
- Feature-Slice 03 (Fill Tool & Hair Recolor Workflow): Contiguous flood fill with threshold, grow dilation, luminance/shading preservation, non-destructive layer blend modes (Normal, Multiply, Screen, Overlay, Color), and layer blur. (VERIFIED - Run #2).
- Comprehensive research documentation: `drawingtool.md`, `research/DRAWING_RESEARCH_MATRIX.md`, `research/DRAWING_FEATURE_INVENTORY.md`.
- Automated Playwright E2E suites (`qa/drawing-layout-e2e.mjs` and `qa/fill-hair-recolor-e2e.mjs`) verifying stroke recording, hair recoloring, layer manipulation, and visual video exports decoded by OpenCV.
- Next Candidate: Feature-Slice 02: Multi-Frame Paint & Rotoscoping (onion skinning, cel keyframes, frame hold/propagation).

---

## 3. Run History & Continuous Execution Ledger

| Run | Date | Subsystem / Feature Slice | Status | Verification Evidence | Next Objective |
|---|---|---|---|---|---|
| Run 1 | 2026-09-24 | Feature-Slice 01: Basic Paint | VERIFIED | `qa/drawing-layout-e2e.mjs`, OpenCV 365 frames decoded, `evidence/drawing/omniframe-drawing-active-mode.png` | Feature-Slice 03: Fill & Hair Recolor |
| Run 2 | 2026-09-24 | Feature-Slice 03: Fill & Hair Recolor | VERIFIED | `qa/fill-hair-recolor-e2e.mjs`, OpenCV 152 frames decoded (hair ROI blue dom: +118.60, shading std: 11.12), `evidence/drawing/omniframe-hair-recolor-active.png` | Feature-Slice 02: Multi-Frame Paint & Onion Skinning |

---

## 4. Autonomous Verification Protocol
For each subsystem under construction, the following loop must be executed:
1. **Model Definition**: Define strict TypeScript interfaces in `src/types.ts`.
2. **State & Store Integration**: Implement actions in `src/store.ts` with immutable state transitions and undo/redo history.
3. **UI & Canvas Implementation**: Build React components and canvas drawing routines.
4. **Static Verification**: Run `npm run build && npx tsc --noEmit` to guarantee 0 compiler warnings or errors.
5. **E2E Automation**: Execute standalone Playwright script running against local Vite server (`0.0.0.0:5173`).
6. **Visual Evidence**: Capture full-screen screenshots and element cutouts into `evidence/` and register in `screenshot.md` and `cut.md`.
7. **Post-Mortem Maintenance**: Record all resolved issues in `FIXED_FAILURES.md` and assess future risks in `POTENTIAL_FAILURES.md`.
