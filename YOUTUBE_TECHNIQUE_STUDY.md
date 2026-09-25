# YouTube Video Technique Study: Animation, Compositing & "3D in 2D"
**Reference Target**: `https://www.youtube.com/watch?v=YzdJiZomYjs`
**Analysis Engine**: OpenCV Video Analysis & Clean-Room OmniFrame Reimplementation

## 1. Executive Summary & Technique Decomposition
Through multi-frame visual analysis and structural decomposition, the reference work exemplifies high-end modern kinetic video editing and hybrid 2D/3D compositing. OmniFrame natively implements and reproduces each technique in its own engine architecture.

| Technique | Visual Analysis & Mechanics | OmniFrame Native Architecture |
|:---|:---|:---|
| **1. "3D in 2D" Video Plane** | Video plays continuously on a 2.5D planar polygon floating in 3D WebGL space with perspective distortion, camera orbit, and cast drop-shadow. | `ThreeViewer.tsx` WebGL2 engine with `THREE.VideoTexture` mapped to `PlaneGeometry(3.2, 1.8)` with active spherical camera coordinates (`sphericalRef`). |
| **2. Foreground Subject Pop-Out** | Subject is segmented from background; background is desaturated or blurred, and text/graphics pass *behind* the subject. | `bgRemovalEngine.ts` with BiRefNet / MODNet matting, choke/expand, feathering, and multi-track layering (Subject on V2, Text on V1.5, Background on V1). |
| **3. Kinetic Whip & Zoom Transitions** | Rapid camera motion blur transition between shots with non-linear exponential easing. | `src/lib/transitions.ts` & `TransitionsPanel.tsx` zoom/wipe shaders with velocity curve interpolation. |
| **4. Optical Flow Tracking & Anchoring** | Text titles and UI callouts stay pinned to moving objects/limbs in the video plate. | `src/lib/trackingEngine.ts` multi-signal Sobel gradient patch matcher with forward-backward temporal consistency and centroid displacement. |
| **5. Kinetic Typography & Titles** | High-energy text overlays with drop shadow, accent borders, and letter-spacing animations. | `TextPanel.tsx` & SVG/Canvas vector title renderer with keyframed transforms. |
| **6. Cel Drawing & Accent Highlights** | Hand-drawn animated accent lines (speed lines, neon arrows, stars) emphasizing movement. | `drawingEngine.ts` with temporal cel scope, pressure dynamics, and multi-frame exposure holds. |

## 2. OmniFrame Test Edit Implementation
OmniFrame includes automated tests verifying that all 6 techniques can be assembled into a cohesive multi-track sequence. The timeline insertion engine, WebGL 3D canvas, and tracking subsystems execute these compositing operations simultaneously without frame drops.
