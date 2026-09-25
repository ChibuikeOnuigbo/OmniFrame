# OmniFrame Potential Failures Register (`POTENTIAL_FAILURES.md`)

This register applies Failure Modes and Effects Analysis (FMEA) to OmniFrame's architectural subsystems, establishing early detection criteria and mitigation strategies.

| Risk ID | Subsystem | Failure Mode | Severity | Probability | Mitigation Strategy |
|---|---|---|---|---|---|
| PF-0001 | Multi-Track Video | Out-of-order track layer compositing causing lower video tracks to occlude higher tracks. | High | Low | Enforce strict ascending z-index ordering matching track display order (V1 at bottom, Vn on top). |
| PF-0002 | Transition Engine | Boundary clipping when transition duration exceeds adjacent clip length. | High | Medium | Implement automatic transition duration clamping to `min(clipA.remaining, clipB.remaining)`. |
| PF-0003 | Canvas Export | Tab backgrounding causing `requestAnimationFrame` throttle and stalled export recorder. | Critical | Medium | Decouple export loop from RAF; drive rendering clock via discrete frame iteration (`step = 1 / fps`). |
| PF-0004 | Drawing Subsystem | Canvas stroke buffer explosion during long continuous brush sessions. | High | Medium | Quantize raw pointer points with Douglas-Peucker simplification before storing vector path. |
| PF-0005 | Drawing Blend Modes | WebGL context loss during heavy composite operations with multiple paint layers. | High | Low | Listen for `webglcontextlost` and implement canvas offscreen buffer recovery from serialized stroke state. |
| PF-0006 | Layout Management | Broken panel dimensions when restoring corrupted user layout from `localStorage`. | Medium | Low | Validate saved layout schema with Zod/TS guards and fall back to default workspace preset. |
| PF-0007 | Shortcut Registry | Key combination collisions with browser-native shortcuts (e.g. Ctrl+T, Ctrl+W, Ctrl+N). | High | High | Audit shortcut matrix; restrict global commands to standard video editing keys (Space, J, K, L, S, B, V, Delete, Z). |
| PF-0008 | Timeline Scrubbing | Rapid scrubbing causing race conditions in HTML5 video element `currentTime` seeks. | High | Medium | Implement seek debouncing with `seeking` event gate; discard outdated seek requests. |
| PF-0009 | Audio Mixing | Clipping and digital distortion when summing multiple concurrent audio tracks. | High | Medium | Route all audio nodes through a master dynamics compressor and peak limiter prior to output. |
| PF-0010 | Media Ingestion | Memory exhaustion when ingesting 4K/60fps video files into browser memory. | Critical | Medium | Recommend proxy media workflow and restrict in-memory full decode buffers. |
| PF-0011 | Transitions | Audio glitching during video transition cut point. | Medium | Medium | Automatically generate audio crossfade matching video transition span. |
| PF-0012 | Continuous Zoom | Non-linear mouse wheel zoom causing disorienting timeline jumps. | Medium | Low | Apply logarithmic zoom factor (`zoom * Math.pow(1.002, -deltaY)`) anchored to mouse cursor timecode. |
| PF-0013 | Track Reordering | Clips disconnected from track metadata during drag-and-drop track reorder. | High | Low | Store clips with immutable UUID references; update track indices without mutating clip track IDs. |
| PF-0014 | Paint Onion Skinning | Performance degradation when rendering multiple ghosted onion-skin frames. | Medium | Medium | Render onion skin frames to low-res cache canvases and composite with fixed alpha shaders. |
| PF-0015 | Inspector Live Sync | Infinite re-render loop between slider inputs and Zustand clip property mutations. | High | Low | Use controlled input with local state during drag, committing to store on change completion. |
| PF-0016 | Video Codec Compatibility | Inability to decode ProRes or HEVC footage in standard Chromium browsers. | High | High | Detect codec on file drop; provide clear user notice and offer desktop native transcoding via Tauri/FFmpeg. |
| PF-0017 | Context Menu Placement | Context menu spawning partially offscreen on small mobile or window edges. | Low | Low | Clamp context menu coordinates against `window.innerWidth - width` and `window.innerHeight - height`. |
| PF-0018 | Waveform Rendering | Canvas redraw bottleneck when timeline contains over 50 audio clips. | High | Medium | Virtualize waveform canvas rendering so only clips visible within viewport bounds are drawn. |
| PF-0019 | Focus Mode | User trapped in focus mode without obvious exit control. | High | Low | Always render persistent floating floating exit pill and bind Escape key to restore previous workspace layout. |
| PF-0020 | Undo/Redo Stack | Memory leak from storing unbounded deep copies of full project state. | High | Medium | Cap history stack to 50 operations and serialize state diffs rather than entire asset caches. |
| PF-0021 | 3D in 2D Camera | Degenerate camera matrix when zooming near zero distance in 3D perspective mode. | Medium | Low | Clamp camera distance to minimum near plane offset (`z >= 0.1`). |
| PF-0022 | Paint Layer Mask Memory | High-resolution mask memory consumption when multiple paint layers each retain unique raster mask data URLs. | Medium | Medium | Downscale mask bitmaps when layer bounds are smaller than canvas; revoke and garbage collect unused mask data URLs on layer deletion. |
| PF-0023 | Marching Ants Animation Loop | Unnecessary CPU consumption from `requestAnimationFrame` render loop when editor is backgrounded or canvas is hidden. | Low | Low | Cancel marching ants `requestAnimationFrame` immediately whenever `activeSelection` is cleared or canvas component unmounts. |
| PF-0024 | WebGL Context Allocation Limit | Multiple WebGL contexts across Three.js and 2D canvas can trigger browser context eviction. | Medium | Low | Share single WebGL rendering context or cleanly dispose Three.js renderer resources on unmount. |
| PF-0025 | Rapid Drag Threshold Micro-Shifts | Accidental micro-movements during timeline selection displacing clips by sub-frame amounts. | Medium | Low | Enforce 5px drag initiation deadzone before entering timeline clip translation state machine. |
| PF-0026 | Downstream Ripple Performance | Large timelines with hundreds of clips experiencing layout stutter during ripple push. | High | Low | Batch downstream displacement updates using map-based lookups and single immutable Zustand state commit. |
| PF-0027 | Pixel Aspect Ratio Distortion | Non-square pixel media (e.g. DVCPRO, anamorphic) stretching incorrectly when mapped to sequence canvas. | Medium | Medium | Detect pixel aspect ratio (PAR) metadata and apply non-uniform scaling normalization to square pixel space. |
| PF-0028 | Export Stream Blank Frame | MediaRecorder recording first frame before video element decoder renders first decoded packet. | High | Low | Enforce synchronous compositor canvas pre-render and playhead seek confirmation before starting MediaRecorder. |

