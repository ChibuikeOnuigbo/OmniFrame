# OmniFrame Drawing Feature Inventory (`research/DRAWING_FEATURE_INVENTORY.md`)

## Hierarchical Taxonomy of Drawing & Annotation Capabilities

```
1.0 BRUSH & DRAWING TOOLS
├── 1.1 Freehand Pen & Brush
│   ├── 1.1.1 Round Hard Brush (Solid antialiased stroke)
│   ├── 1.1.2 Round Soft Brush (Gaussian falloff edge)
│   ├── 1.1.3 Highlighter / Marker (Translucent multiply blending)
│   └── 1.1.4 Calligraphy / Chisel Pen (Angle-dependent stroke thickness)
├── 1.2 Eraser Subsystem
│   ├── 1.2.1 Stroke Eraser (Deletes entire intersected vector stroke)
│   └── 1.2.2 Point/Segment Eraser (Splits or trims stroke along contact path)
├── 1.3 Vector Shape Primitives
│   ├── 1.3.1 Straight Line (Shift-constrained to 0°, 45°, 90°)
│   ├── 1.3.2 Arrow & Double Arrow (Directional vector callouts with head scaling)
│   ├── 1.3.3 Rectangle & Rounded Rectangle (Corner radius control)
│   ├── 1.3.4 Ellipse & Circle (Constraint to perfect 1:1 aspect ratio)
│   └── 1.3.5 Star & Polygon (Configurable point count)
└── 1.4 Vector Path & Bézier Curve
    ├── 1.4.1 Pen Tool (Anchor points and Bézier control handles)
    └── 1.4.2 Path Edit Mode (Node manipulation, curvature adjustment)

2.0 STROKE DYNAMICS & INPUT SENSING
├── 2.1 Stylus / Pointer Events
│   ├── 2.1.1 Pressure Sensitivity (Remapped to radius and opacity)
│   ├── 2.1.2 Velocity Sensitivity (Thinner/lighter stroke at high drag speed)
│   └── 2.1.3 Coalesced Events (`getCoalescedEvents()` for high polling rates)
└── 2.2 Smoothing & Stabilization
    ├── 2.2.1 Exponential Smoothing ($\alpha$-weighted moving average)
    ├── 2.2.2 Catmull-Rom Spline Interpolation (Smooth cubic curve through points)
    └── 2.2.3 Lazy Mouse / Rope Stabilizer (Pulling point with virtual drag radius)

3.0 COLOR & PALETTE ENGINE
├── 3.1 Color Pickers
│   ├── 3.1.1 Quick Palette (Preset color swatches: White, Yellow, Red, Cyan, Green, Magenta)
│   ├── 3.1.2 Hex / RGB / HSL Sliders
│   └── 3.1.3 Eyedropper Tool (Sample pixel color from preview canvas)
└── 3.2 Stroke Attributes
    ├── 3.2.1 Stroke Width (1px to 100px with numerical and slider entry)
    ├── 3.2.2 Opacity (0% to 100%)
    ├── 3.2.3 Cap Style (Round, Butt, Square)
    ├── 3.2.4 Join Style (Round, Miter, Bevel)
    └── 3.2.5 Dash Patterns (Solid, Dotted, Dashed)

4.0 LAYER & TEMPORAL TIMELINE INTEGRATION
├── 4.1 Paint Layers
│   ├── 4.1.1 Layer Hierarchy (Multiple paint layers with z-index ordering)
│   ├── 4.1.2 Blend Modes (Normal, Multiply, Screen, Overlay, Add, Darken, Lighten)
│   ├── 4.1.3 Layer Visibility & Opacity
│   └── 4.1.4 Layer Lock (Prevent accidental stroke alteration)
└── 4.2 Temporal Scope & Animation
    ├── 4.2.1 Single Frame (Cel frame for animation and rotoscoping)
    ├── 4.2.2 Hold Frame (Persists until the next keyframe cel)
    ├── 4.2.3 Custom Duration Span (Defines specific in/out timestamps)
    ├── 4.2.4 Project Global (Visible across entire video timeline)
    ├── 4.2.5 Onion Skinning (Ghosting of previous $N$ and next $M$ frames with tinted overlays)
    └── 4.2.6 Write-on Animation (Interpolating stroke draw progress $0 \to 100\%$ along timeline)

5.0 INTERACTION & EDITING
├── 5.1 Non-Destructive Manipulation
│   ├── 5.1.1 Selection Tool (Box select, lasso select strokes)
│   ├── 5.1.2 Transform (Translate, scale, rotate selected strokes)
│   └── 5.1.3 Duplicate & Delete
└── 5.2 History & Persistence
    ├── 5.2.1 Multi-level Undo / Redo
    ├── 5.2.2 Project Serialization (JSON vector stroke definitions)
    └── 5.2.3 SVG Import / Export

6.0 RENDER & EXPORT INTEGRATION
├── 6.1 Viewport Rendering
│   ├── 6.1.1 Canvas2D Immediate Mode (Sub-millisecond interactive stylus rendering)
│   └── 6.1.2 WebGL Shader Pipeline (High-performance post-composite)
└── 6.2 Video Export Pipeline
    ├── 6.2.1 Real-time canvas blending during video frame generation
    └── 6.2.2 Transparent PNG sequence / WebM alpha video overlay export
```
