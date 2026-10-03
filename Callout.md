# Callout — requested vs actually added

A vetting pass over the whole project history: what was asked for, what actually
landed in `src/`, and the correspondence between the two.

## Headline: two numbers, measured two ways

| Measure | Scope | Result |
|:---|:---|---:|
| **Hand-verified correspondence** | 78 topics inspected by reading the code | **66.7%** |
| Automated lexical correspondence | all 10,152 distinct requested items | **14.7%** |

The hand-verified number is the trustworthy one: every row below was checked by
reading the actual source. Scoring: IMPLEMENTED = 1.0, PARTIAL = 0.5,
NAMED-ONLY / ABSENT = 0.0 → 52 / 78 = **66.7%**.
Breakdown: 47 implemented, 10 partial,
7 named-only, 14 absent.

The automated number scans all 10,151 distinct requested items for lexical
evidence in `src/`. It is an estimate with error in both directions and is
reported for completeness, not as the verdict.

> Read this honestly. The request ledgers were expanded to a very large
> specification (tens of thousands of atomic items) while the shipped application
> implements on the order of 1,492 of them. A spec that large cannot be
> built by the code that exists, so this figure is expected to be low. It is
> reported as measured, not adjusted.

## How the number is produced

1. **Requested** — the union of every named feature across
   `FEATURE_LEDGER_10000_PLUS.md`, `new_feature_addede.md`,
   `FEATURE_SYNTHESIS_20000_PLUS.md`, the dated work packages in `MEMORY.md`,
   and the explicit asks from the current session. Deduplicated on a normalised
   name → **10,152** unique items.
2. **Implemented (automated)** — a requested feature counts as implemented only
   when >=60% of its significant tokens appear as identifiers inside a SINGLE
   `src/` module (co-location), AND at least one of them is distinctive
   (appears in <=5% of source files), or its leading phrase appears verbatim.
   → **1,492** items.
3. **Implemented (hand-verified)** — the 64 recurring ledger topics plus this
   session's asks were checked by reading the source and classified
   IMPLEMENTED / PARTIAL / NAMED-ONLY / ABSENT.
4. **Correspondence** = implemented / requested, reported both ways.

### Why the two numbers differ so much

The ledgers list ~10k distinct atomic items, most of them narrow
(a specific filter topology, a specific solver). The app cannot contain 10k
distinct behaviours — its entire addressable surface is 190 store actions,
35 components, 88 exported library symbols and 402 `data-testid` hooks. So the
automated pass over the full list is necessarily low. The hand-verified pass
covers the topics the ledgers actually keep returning to, and is the number to
act on.

### The "named but not real" problem

The clearest scope gap: `src/components/BackgroundRemovalModal.tsx` offers four
AI models — **BiRefNet General**, **MODNet Portrait**, **ISNet Graphic**,
**SlimSAM Interactive** — described to the user as "Ultra-fine hair & edge
detail", "Fast human/person matting", and so on. `src/lib/bgRemovalEngine.ts`
implements each of them as a few lines of hand-written heuristics:

```
case 'birefnet-general':   // centre-weight + channel-contrast threshold
case 'modnet-photographic':// isSkin || (centreWeight > 0.35 && luma in range)
case 'isnet-anime':        // saturation > 30 || centreWeight > 0.4
case 'slimsam-fast':       // centreWeight > 0.35
```

There is no ONNX runtime, no model file, no weight download and no tensor
execution anywhere in `src/`. `detectBackend()` returns the string `webgpu`
but the matting runs as scalar JavaScript on the CPU. The requested feature
(a neural matting pipeline) and the shipped feature (a colour heuristic with
the model's name on it) do not correspond, and a user selecting 'BiRefNet'
would reasonably believe they are running BiRefNet.

The same pattern applies to **Hardware WebCodecs Acceleration**, which appears
only as a descriptive string in `MediaPanel.tsx`.

Regenerate with `python3 qa/build_feature_correspondence.py`.
Machine-readable detail: `qa/reports/feature-correspondence.json`.

## Inflation check — the "10,000+" / "20,000+" claims

| Ledger | Raw declarations | Distinct names | Repetition factor |
|:---|---:|---:|---:|
| `new_feature_addede.md` | 10,052 | 10,052 | x1 |
| `FEATURE_LEDGER_10000_PLUS.md` | 10,194 | 64 | x159 |
| `FEATURE_SYNTHESIS_20000_PLUS.md` | 2,098 | 64 | x33 |

`FEATURE_LEDGER_10000_PLUS.md` and `FEATURE_SYNTHESIS_20000_PLUS.md` cycle the same
64 subsystem names. Only `new_feature_addede.md` carries genuinely distinct entries.
The correspondence below is computed on distinct names.

## Hand-verified register

| Topic | Verdict | Evidence |
|:---|:---|:---|
| Contextual sidebar that changes with the active tool | **IMPLEMENTED** | qa/reports/contextual-sidebar-report.json 17/17 |
| Cursors and cursor fidelity per tool | **IMPLEMENTED** | cursor-opencv-metrics.json / cursor-frame-inspection-report.json |
| Feature parity audit against CapCut / Premiere / After Effects / Photoshop / Krita / DaVinci | **PARTIAL** | qa/feature-parity-audit.mjs runs 123/123 on its own checklist; not a full per-app audit |
| Fill and recolor inside a selection on images and video | **IMPLEMENTED** | apply-recolor-btn + recolor swatches; towel workflow W1-W4 |
| Gripped group delete / drag / shorten on the timeline | **IMPLEMENTED** | removeSelectedClips / moveSelectedClips / trimSelectedClips; uniform deltas proven |
| Guided-rectangle background removal (draw box, click remove, get layered mask) | **IMPLEMENTED** | src/lib/guidedMatting.ts + runGuidedRectBackgroundRemoval; box_fill_ratio 0.505 proves it is not a crop |
| Layout gapping and overflow audit | **IMPLEMENTED** | qa/layout-gapping-audit.mjs 0 overflow / 30 panels |
| LumaCut multi-signal masking and tracking subsystem | **IMPLEMENTED** | src/lib/trackingEngine.ts (Sobel + NCC + forward/backward) + drawingEngine mask modes |
| Non-destructive background removal producing a mask layer | **IMPLEMENTED** | guidedMatte attaches transparencyMask + maskDataUrl; qa/reports/guided-matte-opencv-metrics.json |
| OmniFrame object move with clean background infill | **IMPLEMENTED** | omniframe-clean-infill-motion-e2e.mjs |
| Recreations of canonical editor looks | **PARTIAL** | RECREATIONS.md + recreations-runner 303/303 self-checks |
| Selection invert, grow, shrink, feather | **IMPLEMENTED** | subtool-invert/grow/shrink + feather, proven by towel workflow W4 |
| Unified selection sub-tool (rect/ellipse/lasso/polygon/brush/magic wand) | **IMPLEMENTED** | src/components/SelectionMaskSubTool.tsx, 6 selection types, qa/towel-masking-workflow-e2e.mjs 28/28 |
| Windows-style rubber-band right-drag timeline multi-select | **IMPLEMENTED** | qa/timeline-rubber-band-e2e.mjs 25/25, alpha 0.45 dark translucent band |
| 3-Band State Variable Filter Crossover | **IMPLEMENTED** | 3-band crossover DSP in src/lib/voiceIsolation.ts |
| 6-Pixel Deadzone Drag State Machine | **PARTIAL** | real threshold state machine, but 5px not 6px (Timeline startClipDrag) |
| Active Contour Boundary Competition | **ABSENT** | no level-set / active contour solver |
| Arrange Linked Elements Time-Alignment | **IMPLEMENTED** | LinkPanel time-alignment actions |
| Atomic Multi-Element Delete Cascade | **IMPLEMENTED** | removeSelectedClips + linkSet cascade delete |
| Audio Buffer Resampling & Drift Correction | **ABSENT** | no resampler / drift corrector |
| Automatic Empty Track Housekeeping | **IMPLEMENTED** | cleanupEmptyTracks in store |
| BiRefNet High-Resolution Boundary Refinement | **NAMED-ONLY** | bgRemovalEngine 'birefnet-general' = centre-weight + contrast threshold, ~10 lines. No bilateral reference network, no weights, no inference. |
| Bidirectional Consistency Validation | **IMPLEMENTED** | src/lib/trackingEngine.ts forward/backward track consistency check |
| Camera View Projection Surface Paint | **PARTIAL** | 3D painting UI present; no camera-projection surface paint solver |
| Centralized Context Menu Target Resolver | **IMPLEMENTED** | src/components/Timeline.tsx target-aware context resolver |
| Continuous Video Texture Streaming | **IMPLEMENTED** | THREE.VideoTexture driven by the preview media element |
| Cross-Track Group Instance Aggregation | **IMPLEMENTED** | groups[] with memberIds across tracks in store |
| Decoded Frame Memory Pooling | **ABSENT** | no ring-buffer frame cache |
| Deforming Triangular Mesh Tracking | **ABSENT** | no triangular mesh / Delaunay tracking |
| Directional DAG Parenting Resolution | **IMPLEMENTED** | parentRelationships DAG resolution in store |
| Dominant Global Affine Motion | **ABSENT** | no RANSAC global affine estimation |
| Dynamic Aspect Ratio Popover Presentation | **IMPLEMENTED** | src/components/AspectRatioSelector.tsx |
| Dynamic Range Compression & Limiting | **IMPLEMENTED** | compressor/limiter nodes in voiceIsolation + AudioMeter |
| Frame-Rate Decoupled Exposure Holds | **IMPLEMENTED** | cel exposure / 'on twos' in DrawingPanel |
| Frustum Culling & Viewport Scalability | **ABSENT** | no frustum culling |
| GOP Boundary Keyframe Fast Seeking | **ABSENT** | seeking is via HTMLMediaElement.currentTime |
| Gaussian Spatial Alpha Feathering | **IMPLEMENTED** | refineAlphaMask feather pass in src/lib/bgRemovalEngine.ts |
| Hardware WebCodecs Acceleration | **NAMED-ONLY** | the string appears as a MediaPanel label; decoding uses HTMLVideoElement, no WebCodecs API call |
| ISNet Graphic Silhouette Extraction | **NAMED-ONLY** | 'isnet-anime' = saturation > 30 threshold. No intermediate-supervision network. |
| Invariant I-01 Non-Overlapping Track Lanes | **IMPLEMENTED** | resolveSameTrackRipple in store |
| Invariant I-10 Decoupled Media Ingestion | **IMPLEMENTED** | MediaPanel import decoupled from timeline insertion |
| Luminance-Preserving Flood Fill | **IMPLEMENTED** | src/lib/drawingEngine.ts floodFillRegion, luminance-preserving recolor |
| MODNet Real-Time Portrait Matting | **NAMED-ONLY** | 'modnet-photographic' = skin-tone + centre-weight heuristic. No tripartite network, no inference. |
| Make Unique Deep Asset Branching | **NAMED-ONLY** | no make-unique / deep asset branching implementation found |
| Mid-Side Stereo Matrix Processing | **IMPLEMENTED** | Mid/Side decomposition in src/lib/voiceIsolation.ts |
| Morphological Alpha Choke and Dilation | **IMPLEMENTED** | refineAlphaMask choke/expand in src/lib/bgRemovalEngine.ts |
| Motion Vector Kalman Filtering | **ABSENT** | no kalman filter anywhere in src/ |
| Multi-scale Gaussian Image Pyramids | **ABSENT** | guidedMatting works at a single downscaled scale; no pyramid |
| Normalized Cross-Correlation Patch Matching | **IMPLEMENTED** | src/lib/trackingEngine.ts matchPatch — zero-mean NCC over RGB/luma |
| PTS / DTS Presentation Clock | **ABSENT** | no presentation timestamp queue; playback is media-element driven |
| Per-Layer Blend Mode Composition | **IMPLEMENTED** | src/components/DrawingPanel.tsx setPaintLayerBlendMode -> canvas globalCompositeOperation |
| Perspective-Correct Depth Testing | **ABSENT** | no depth-test configuration |
| Phase-Inverted Cancellation Matrix | **ABSENT** | mid/side processing exists, no phase-inversion cancellation matrix |
| Policy-Based LinkSet Synchronization | **IMPLEMENTED** | linkSets + rules in store, LinkPanel UI |
| Preserve Apparent World Transform on Reparent | **PARTIAL** | parenting exists; reparent world-transform preservation is not verified |
| Pressure-Sensitive Bezier Stroke Interpolation | **IMPLEMENTED** | DrawingCanvasOverlay reads e.pressure + brushDynamics pressureSize |
| Real-Time Clone Stamp Sampling | **IMPLEMENTED** | clone tool with cloneSourcePoint in store/overlay |
| Real-Time Peak Metering & Ballistics | **IMPLEMENTED** | src/components/AudioMeter.tsx peak ballistics |
| SMPTE Drop-Frame Timecode Math | **IMPLEMENTED** | dropFrameTimecode + formatTimecode in Timeline/time.ts |
| Safe Keyboard Shortcut Collision Avoidance | **PARTIAL** | shortcut registry exists, no collision-avoidance solver |
| Seamless Audio Gapless Loop Splicing | **IMPLEMENTED** | per-track gapless flag, DEVELOPMENT_LOG gapless ripple slice |
| Selection Mask Morphological Operations | **IMPLEMENTED** | grow/shrink/feather in OmniFramePanel + drawingEngine |
| Shared Data-Block Texture Architecture | **PARTIAL** | three.js materials shared, but no data-block instancing bookkeeping |
| SlimSAM Interactive Segment Anything | **NAMED-ONLY** | 'slimsam-fast' = centreWeight > 0.35. No prompt encoder, no SAM variant. |
| Sobel Edge Tensor Extraction | **IMPLEMENTED** | src/lib/trackingEngine.ts computeFrameMaps builds real Sobel gradient/direction maps |
| Source-Aware Duration Boundary Expansion | **IMPLEMENTED** | source-aware trim bounds in Timeline |
| Speech Formant Bandpass Attenuation | **IMPLEMENTED** | formant bandpass isolate in src/lib/voiceIsolation.ts |
| Spherical Coordinates Orbit/Pan/Dolly Camera | **IMPLEMENTED** | src/components/ThreeViewer.tsx sphericalRef radius/theta/phi |
| Sub-Millisecond Playhead Scrub Responsiveness | **PARTIAL** | scrub is responsive but no measured sub-ms budget; no evidence of the specified pipeline |
| Sub-frame Scrubbing & Jitter Suppression | **ABSENT** | no sub-frame interpolation |
| Temporal Alpha History Smoothing | **PARTIAL** | temporalSmoothing toggle exists in BackgroundRemovalModal; smoothing is per-request, not a persistent alpha history |
| Temporal Cel Onion-Skinning | **IMPLEMENTED** | src/lib/drawingEngine.ts renderOnionSkin + DrawingPanel exposure holds |
| Three-Point Lighting Rig Simulation | **IMPLEMENTED** | ThreeViewer ambient + key + rim directional lights |
| Variable Frame Rate (VFR) Normalization | **ABSENT** | no VFR handling |
| Vector Stroke to Raster Mask Conversion | **IMPLEMENTED** | convert-mask-layer -> createSelectionMask rasterisation |
| WAV RIFF PCM Encoding | **IMPLEMENTED** | encodeAudioBufferToWav in src/lib/voiceIsolation.ts |
| WebGPU Compute Shader Tensor Execution | **NAMED-ONLY** | detectBackend() reports a 'webgpu' string; the matting path is scalar CPU JS. No WGSL, no tensor kernels. |
| World-to-Local Transform Propagation | **PARTIAL** | transform propagation exists for OmniFrame objects; no generic world/local matrix chain |

## Correspondence by category (automated, all requested items)

| Category | Requested | Implemented | Correspondence |
|:---|---:|---:|---:|
| WebGL2 & Three.js Composite Shader Engine | 1,258 | 28 | 2.2% |
| 3D WebGL Compositing & Blender Rotation System | 1,256 | 181 | 14.4% |
| Audio DSP Architecture & Voice Processing | 1,256 | 181 | 14.4% |
| Drawing Subsystem & Cel Animation Engine | 1,256 | 350 | 27.9% |
| LumaCut Optical Flow & Computer Vision | 1,256 | 38 | 3.0% |
| Neural Background Matting & Alpha Generation | 1,256 | 327 | 26.0% |
| Responsive Mobile UX & Layout Systems | 1,256 | 157 | 12.5% |
| Universal Linking & Spatial Transform Architecture | 1,256 | 181 | 14.4% |
| Conversation work package | 22 | 5 | 22.7% |
| 3D WebGL Compositing & 2.5D Video Planes | 8 | 4 | 50.0% |
| Audio DSP Architecture & Voice Isolation | 8 | 3 | 37.5% |
| Drawing Subsystem & Temporal Cel Animation | 8 | 7 | 87.5% |
| Neural Background Matting & Segmentation | 8 | 5 | 62.5% |
| Optical Flow & LumaCut Tracking Engine | 8 | 5 | 62.5% |
| Temporal Video Engine & Synchronization | 8 | 4 | 50.0% |
| Timeline Architecture, Ripple Engine & Ergonomics | 8 | 4 | 50.0% |
| Universal Linking, Parenting & Spatial Hierarchies | 8 | 3 | 37.5% |
| Selection & Masking | 5 | 3 | 60.0% |
| UI/UX | 3 | 1 | 33.3% |
| Parity | 2 | 0 | 0.0% |
| Timeline | 2 | 2 | 100.0% |
| OmniFrame | 1 | 0 | 0.0% |
| Pointer Events & Custom Cursor System | 1 | 1 | 100.0% |
| Tracking | 1 | 1 | 100.0% |
| UI Workspace & Left Dock Navigation Architecture | 1 | 1 | 100.0% |

## Where the gap is largest (unimplemented count by category)

| Category | Unimplemented |
|:---|---:|
| WebGL2 & Three.js Composite Shader Engine | 1,230 |
| LumaCut Optical Flow & Computer Vision | 1,218 |
| Responsive Mobile UX & Layout Systems | 1,099 |
| 3D WebGL Compositing & Blender Rotation System | 1,075 |
| Universal Linking & Spatial Transform Architecture | 1,075 |
| Audio DSP Architecture & Voice Processing | 1,075 |
| Neural Background Matting & Alpha Generation | 929 |
| Drawing Subsystem & Cel Animation Engine | 906 |
| Conversation work package | 17 |
| Universal Linking, Parenting & Spatial Hierarchies | 5 |
| Audio DSP Architecture & Voice Isolation | 5 |
| Temporal Video Engine & Synchronization | 4 |
| 3D WebGL Compositing & 2.5D Video Planes | 4 |
| Timeline Architecture, Ripple Engine & Ergonomics | 4 |
| Neural Background Matting & Segmentation | 3 |

## What IS genuinely in the code (evidence counts)

| Shipped surface | Count |
|:---|---:|
| Store actions | 190 |
| Store state fields | 97 |
| React components | 35 |
| Library modules | 16 |
| Exported library symbols | 88 |
| `data-testid` hooks | 402 |

These are measured from source, so they are the defensible ceiling on how many
of the requested behaviours can possibly be present.

## Sample of requested features with NO implementation evidence

| Feature | Category | Evidence |
|:---|:---|---:|
| OmniFrame object move with clean background infill | OmniFrame | 1.00 |
| Selection invert, grow, shrink, feather | Selection & Masking | 1.00 |
| Studio-wide custom right-click menu | Conversation work package | 1.00 |
| Unified selection sub-tool (rect/ellipse/lasso/polygon/brush/magic wand) | Selection & Masking | 0.91 |
| Timeline render isolation and hidden media-error audit | Conversation work package | 0.86 |
| Functional timeline right-click menu | Conversation work package | 0.80 |
| SMPTE Drop-Frame Timecode Math | Temporal Video Engine & Synchronization | 0.80 |
| Continuous Video Texture Streaming | 3D WebGL Compositing & 2.5D Video Planes | 0.75 |
| Cross-Track Group Instance Aggregation | Universal Linking, Parenting & Spatial Hierarchies | 0.75 |
| Temporal Alpha History Smoothing | Neural Background Matting & Segmentation | 0.75 |
| World-to-Local Transform Propagation | Universal Linking, Parenting & Spatial Hierarchies | 0.75 |
| Clip-level hide and compact Settings checkpoint | Conversation work package | 0.67 |
| Compact Timeline Sequence Ping Indicator — Phase 16 | Responsive Mobile UX & Layout Systems | 0.67 |
| Compact Timeline Sequence Ping Indicator — Phase 24 | Responsive Mobile UX & Layout Systems | 0.67 |
| Compact Timeline Sequence Ping Indicator — Phase 32 | Responsive Mobile UX & Layout Systems | 0.67 |
| Compact Timeline Sequence Ping Indicator — Phase 40 | Responsive Mobile UX & Layout Systems | 0.67 |
| Compact Timeline Sequence Ping Indicator — Phase 48 | Responsive Mobile UX & Layout Systems | 0.67 |
| Compact Timeline Sequence Ping Indicator — Phase 56 | Responsive Mobile UX & Layout Systems | 0.67 |
| Compact Timeline Sequence Ping Indicator — Phase 64 | Responsive Mobile UX & Layout Systems | 0.67 |
| Compact Timeline Sequence Ping Indicator — Phase 72 | Responsive Mobile UX & Layout Systems | 0.67 |
| Compact Timeline Sequence Ping Indicator — Phase 8 | Responsive Mobile UX & Layout Systems | 0.67 |
| Compact Timeline Sequence Ping Indicator — Phase 80 | Responsive Mobile UX & Layout Systems | 0.67 |
| Compact Timeline Sequence Ping Indicator — Phase 88 | Responsive Mobile UX & Layout Systems | 0.67 |
| Compact Timeline Sequence Ping Indicator — Phase 96 | Responsive Mobile UX & Layout Systems | 0.67 |
| Contextual sidebar that changes with the active tool | UI/UX | 0.67 |
| Continuous Video Texture Streaming Engine — Phase 14 | 3D WebGL Compositing & Blender Rotation System | 0.67 |
| Continuous Video Texture Streaming Engine — Phase 22 | 3D WebGL Compositing & Blender Rotation System | 0.67 |
| Continuous Video Texture Streaming Engine — Phase 30 | 3D WebGL Compositing & Blender Rotation System | 0.67 |
| Continuous Video Texture Streaming Engine — Phase 38 | 3D WebGL Compositing & Blender Rotation System | 0.67 |
| Continuous Video Texture Streaming Engine — Phase 46 | 3D WebGL Compositing & Blender Rotation System | 0.67 |
| Continuous Video Texture Streaming Engine — Phase 54 | 3D WebGL Compositing & Blender Rotation System | 0.67 |
| Continuous Video Texture Streaming Engine — Phase 6 | 3D WebGL Compositing & Blender Rotation System | 0.67 |
| Continuous Video Texture Streaming Engine — Phase 62 | 3D WebGL Compositing & Blender Rotation System | 0.67 |
| Continuous Video Texture Streaming Engine — Phase 70 | 3D WebGL Compositing & Blender Rotation System | 0.67 |
| Continuous Video Texture Streaming Engine — Phase 78 | 3D WebGL Compositing & Blender Rotation System | 0.67 |
| Continuous Video Texture Streaming Engine — Phase 86 | 3D WebGL Compositing & Blender Rotation System | 0.67 |
| Continuous Video Texture Streaming Engine — Phase 94 | 3D WebGL Compositing & Blender Rotation System | 0.67 |
| Cross-Track Group Bounding Box Aggregator — Phase 13 | Universal Linking & Spatial Transform Architecture | 0.67 |
| Cross-Track Group Bounding Box Aggregator — Phase 21 | Universal Linking & Spatial Transform Architecture | 0.67 |
| Cross-Track Group Bounding Box Aggregator — Phase 29 | Universal Linking & Spatial Transform Architecture | 0.67 |

(8,660 features in this state — see `features.md` for the full list.)
