# Professional Drawing & Rotoscoping Research Matrix (`research/DRAWING_RESEARCH_MATRIX.md`)

## Executive Summary
Video editors increasingly demand native drawing and paint capabilities—ranging from simple review annotations and arrow callouts to rotoscoping, clean-plate cloning, handwritten write-on effects, and full cel animation. This research matrix analyzes seven industry-leading drawing and painting engines across professional post-production and animation software to extract core principles for OmniFrame's Drawing Subsystem.

---

## 1. System Comparison Matrix

| System | Primary Paradigm | Temporal Representation | Stroke Recording Fidelity | Smoothing Algorithm | Blend Modes | Performance Architecture |
|---|---|---|---|---|---|---|
| **Adobe After Effects (Paint Engine)** | Vector-backed parametric strokes | Per-stroke duration: Single Frame, Custom Frame Span, or Write-on Duration | Position $(x, y)$, pressure, timestamp, radius, opacity | Moving average & Bézier fit | Normal, Multiply, Screen, Overlay, Dissolve, Lighten, Darken | Rendered dynamically onto layer raster buffer per frame |
| **Photoshop (Brush Engine)** | Raster stamp deposition | Static image canvas (Timeline video layers support frame cels) | Position, pressure, tilt, azimuth, velocity | Spring-mass "Streamline" lag smoothing | Full 27 Porter-Duff and separation blend modes | Tiled MIP-mapped 16-bit/32-bit raster buffers |
| **Krita** | Modular brush engines (Pixel, Color Smudge, Sketch, Deform) | Animation docker with cel-based timeline frames & onion skinning | High-frequency tablet events with pressure curve remapping | Basic, Weighted, Stabilizer (delay distance) | 70+ blend modes including spectral mixing | QPainter & OpenGL GPU texture tiles with asynchronous tile engine |
| **Procreate** | Hybrid procedural stamp engine | Animation Assist: layer-based timeline frames with onion skinning | 120Hz/240Hz Apple Pencil pressure, tilt, roll, velocity | Valkyrie engine streamline with position prediction | Standard 24 blend modes with alpha lock | Metal GPU compute shaders rendering tile caches |
| **Blender Grease Pencil** | Full 3D Vector stroke primitives | Keyframe cels on Grease Pencil dopesheet; temporal curve modifiers | 3D points $(x,y,z)$, pressure, vertex color, stroke UVs | Gaussian, Chaikin smoothing, active sculpting | Layer blend modes (Mix, Multiply, Screen, Add, Divide) | WebGL/OpenGL viewport shader pipelines directly composited with 3D scene |
| **TVPaint Animation** | Pixel-based traditional animation | Exposure sheet (XSheet) and timeline timeline layers | Pixel coordinates with custom stylus pressure response curves | Directional interpolation and smoothing buffers | Light, Shade, Color, Behind, Erase, Invert | Fast in-memory uncompressed frame buffers |
| **OpenToonz** | Vector & Toonz Raster Level system | XSheet column frames with palette-linked vectors | Vector spline points with automatic centerline/outline conversion | Real-time cubic spline fitting | Matte, Blend, Add, Subtract, Transparent | Level-based cache with disk swapping |

---

## 2. Key Architectural Deconstructions

### A. Temporal Scope: How Strokes Exist in Time
Video painting differs fundamentally from still-image painting because strokes possess temporal boundaries:
1. **Single Frame (Cel)**:
   - Stroke exists solely at frame $N$. Useful for frame-by-frame animation, rotoscoping mask adjustments, or frame repairs.
2. **Span Duration**:
   - Stroke persists from frame $N_{\text{start}}$ to $N_{\text{end}}$. Standard for callout annotations, highlight arrows, or title underlays.
3. **Clip Attachment**:
   - Stroke moves with the clip interval. If the clip is slipped or moved along the timeline, the drawing maintains its relative offset.
4. **Write-on Effect**:
   - Stroke length is interpolated over time: from $0\%$ drawn at $t_0$ to $100\%$ drawn at $t_1$.

### B. Vector Stroke Data vs Raster Stamp
- **Raster Stamp**: Renders circles of brush texture along the stroke line. High performance for organic textured brushes, but consumes fixed canvas memory per frame and cannot be easily recolored or path-edited later.
- **Parametric Vector Stroke**: Stores discrete samples:
  $$\mathbf{P}_i = (x_i, y_i, p_i, t_i)$$
  where $x, y$ are normalized canvas coordinates, $p$ is stylus pressure $[0, 1]$, and $t$ is relative stroke time.
  - *Advantages*: Infinite scalability without pixelation, resolution-independent export, non-destructive editing (change color, width, or tool after the fact), negligible memory footprint (kilobytes vs tens of megabytes per frame).

### C. Smoothing Algorithms for Natural Hand Drawing
Raw mouse and touch events suffer from jitter and quantization:
1. **Chaikin's Algorithm**: Iterative corner-cutting algorithm producing smooth curves from polyline segments.
2. **Catmull-Rom Splines**: Computes continuous cubic spline tangents passing directly through control points.
3. **Exponential Moving Average (EMA)**:
   $$\mathbf{x}_{\text{smooth}}^{(t)} = \alpha \mathbf{x}_{\text{raw}}^{(t)} + (1 - \alpha) \mathbf{x}_{\text{smooth}}^{(t-1)}$$
   Reduces high-frequency hand tremors with minimal lag.

---

## 3. OmniFrame Drawing Architecture Decisions
1. **Dual Representation**:
   - Primary: Parametric vector stroke records (`Stroke { id, tool, color, size, opacity, points, blendMode, temporalScope }`).
   - Secondary: Canvas 2D / WebGL fast rasterization buffer for instant interactive feedback at 60 FPS.
2. **Layer Hierarchy**:
   - Dedicated `PaintLayer` objects positioned in the project timeline or attached to video clips.
3. **Temporal Playback Integration**:
   - `playback.ts` and `export.ts` query visible paint layers for current playhead time and composite active strokes during video playback and WebM/MP4 export.
