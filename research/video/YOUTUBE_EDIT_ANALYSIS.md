# Reverse-Engineered Video Editing & Compositing Techniques
## Source: Invincible Edit — "Bro killed 99.9% of the Viltrumites" (`https://www.youtube.com/watch?v=YzdJiZomYjs`)

### Executive Engineering Analysis
This document details the complete breakdown and OmniFrame mathematical implementation of every animation, transition, compositing, and spatial technique utilized in high-velocity anime/action edits (exemplified by the Viltrumite Invincible edit).

---

### Technique 1: Cubic Bezier Whip Zoom & Snap Transitions
* **Visual Phenotype**: Violent punch-in zoom accelerating exponentially before snapping into the next frame with minor overshoot.
* **Mathematical Function**: 
  $$\text{Scale}(t) = S_0 + (S_1 - S_0) \cdot u^3 \quad \text{where } u = \frac{t - t_0}{t_1 - t_0}$$
  Followed by overshoot:
  $$\text{Overshoot}(u) = (c_1 + 1)u^3 - c_1 u^2 \quad (c_1 = 1.70158)$$
* **OmniFrame Implementation**:
  - `src/lib/animation/CurveEngine.ts`: `evaluateEasingProgress(u, 'cubic-in')` and `'back'`
  - Channels: `scale_x`, `scale_y`, `position_x`, `position_y`
  - Editable via interactive Graph Editor tangent handles.

---

### Technique 2: "3D in 2D" Spatial Tilt & Video Plane Tumbling
* **Visual Phenotype**: Video frame is treated as a physical card in 3D perspective space, rotating about Euler axes (Z, Y, X) while the video continues live playback inside the tilted plane.
* **Mathematical Function**:
  $$\mathbf{R} = \mathbf{R}_z(\theta_z) \cdot \mathbf{R}_y(\theta_y) \cdot \mathbf{R}_x(\theta_x)$$
  Camera projection matching sequence aspect ratio:
  $$\mathbf{P} = \text{Perspective}(\text{FOV} = 45^\circ, \text{Aspect} = W/H, z_{\text{near}} = 0.1, z_{\text{far}} = 1000)$$
* **OmniFrame Implementation**:
  - `src/components/ThreeViewer.tsx`: WebGL 2.5D video plane with `THREE.PlaneGeometry` driven by live `<canvas>` texture.
  - Interactive WASD camera navigation and Blender Camera Perspective safe frame overlay (`data-testid="camera-safe-frame"`).

---

### Technique 3: Dynamic Speed Ramping (Velocity Curve)
* **Visual Phenotype**: Hyper-accelerated motion (250% speed) instantly dropping into hyper-slow motion (35% speed) on audio transients.
* **Mathematical Function**:
  Continuous time evaluation along rate derivative:
  $$v(t) = \frac{d\Phi(t)}{dt}$$
* **OmniFrame Implementation**:
  - `src/lib/animation/CurveEngine.ts`: `evaluateCurveDerivative(curve, t)`
  - Graph Editor Speed Graph view (`data-testid="graph-mode-speed"`).

---

### Technique 4: Luminescence Flash & High-Contrast Strobe
* **Visual Phenotype**: Single-frame brightness boost to 180% followed by quick exponential falloff to standard exposure.
* **Mathematical Function**:
  $$B(t) = B_{\text{base}} + \Delta B \cdot e^{-\lambda(t - t_{\text{hit}})}$$
* **OmniFrame Implementation**:
  - `src/lib/playback.ts`: Real-time canvas filter `brightness(...) contrast(...)` driven by keyframe curves.

---

### Technique 5: 3D Object Insertion & Cubic Easing Spin
* **Visual Phenotype**: 3D geometric primitives (e.g. rotating wheel, diamond, torus) hovering and spinning in perspective alignment with the video plane.
* **Mathematical Function**:
  $$\text{Rot}_z(t) = \text{Rot}_0 + \Delta \text{Rot} \cdot u^3$$
* **OmniFrame Implementation**:
  - `src/components/ThreeViewer.tsx`: Procedural 3D Wheel model (outer rubber tire, chrome rim, 6 radial spokes, center hub) animated with `wheel_rotation` keyframe curve.
  - 3D rendering exported directly from the WebGL camera perspective.
