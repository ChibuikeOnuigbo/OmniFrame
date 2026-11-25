# Primitive sculpt evidence — 25 November 2026

`editor.png` shows the native 3D controls. `editor-390.png` and
`editor-768.png` show the collapsible brush panel and scrolling toolbars.
`before.png` and `after.png` come from an actual mouse gesture on the WebGL
canvas. The sphere is placed in front of the video plane, avoiding occlusion
in the camera-aspect check.

`sculpt.obj` is the app's geometry-subset export. Browser tests verify its
vertices change after sculpting and its text is identical after Save/New/Open.
`omniframe-export.mp4` is downloaded from the app's `exportVideo` function,
not assembled from screenshots. It shows automatic scene rotation over a
2-second timeline. Export preserves the working viewport's proportions with
letterboxing; this is viewport capture, not an independent offline 3D renderer.
The exported frame and four-frame contact sheet were visually inspected.

Reproduce with Vite on port 5183:

```sh
node qa/sculpt-geometry-unit.mjs
URL=http://localhost:5183/#studio node qa/sculpt-e2e.mjs
PYTHONPATH=/tmp/omniframe-review-python python3 qa/verify-sculpt-opencv.py
```

OpenCV 4.12.0.88 and NumPy 2.2.6 were installed in the temporary Python path.
`report.json` lists the browser checks and layouts; `opencv-report.json` lists
actual decoded frames and pixel measurements. MediaRecorder frame counts can
vary with browser scheduling; these are not real-time performance benchmarks.

Supported: Raise, Carve, Flatten on five primitives, radius/strength, reset,
256 retained brush samples, gesture Undo/Redo and .omni persistence. Meshes are
rebuilt deterministically from object-local samples shared by preview and OBJ.
Unsupported: imported/multi-part sculpting, pressure, remeshing, topology tools,
animated sculpt strokes, or headless 3D scene rendering. Large brush radii can
affect nearby surfaces within the sphere of influence, including back surfaces.
