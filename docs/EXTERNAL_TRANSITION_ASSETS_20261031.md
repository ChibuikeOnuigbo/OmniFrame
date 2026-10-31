# Textured external 3D transition pack

Six new transition presets are available in the editor. Five externally authored models were downloaded; the fracture asset is original geometry using a downloaded material. All selected external geometry/materials are CC0. Runtime GLBs embed their textures, and all six editable `.blend` files pack their image dependencies.

| Preset | Asset and source | Editor location |
|---|---|---|
| Knob CRT TV | Gabriel Radić's **Television 01**, Poly Haven; original 1k PBR body maps, fitted live-video surface | Transitions → Device 3D |
| Silver CRT TV | Benny Weimer's **Television 02**, Poly Haven; original 1k PBR body maps, fitted live-video surface | Transitions → Device 3D |
| Arrow Sweep | Savino's OpenGameArt **Arrow symbols**, `arrow1.obj`; original gold material added to the untextured source geometry | Transitions → Object 3D |
| Bullet Shell Whip | AlexanderZotov's OpenGameArt **bulletShell.fbx**; original material colors with metallic shading; the pistol is excluded | Transitions → Object 3D |
| Payphone Orbit | UM JOORIN's Poly Haven **Korean Public Payphone 01**; normalized/decimated scan with embedded base color, normal and metallic/roughness maps | Transitions → Object 3D |
| Concrete Shatter | 35 original Voronoi prism fragments, full-image video UV fronts, and Dimitrios Savva's Poly Haven **Cracked Concrete** PBR material on backs/edges | Transitions → Object 3D |

Source links, authors and modifications: `public/models/transition_assets/CREDITS.md`. Original download hashes/sizes: `research/transition-assets/source-manifest.json`. Packed-file verification: `research/transition-assets/packed-source-check.json`. Search/access results: `research/transition-assets/site-access.json`.

## Product behavior

The TVs use the existing shared Three.js device renderer. Incoming media plays on an independent `ScreenSurface`; original scanned body materials remain intact. Bounds-aware fitting keeps deep CRT bodies in frame. Their presets select the appropriate model automatically, and both models also appear in the existing device selector. There are now nine device models, including the existing phones, monitors and laptop.

Object transitions use actual loaded GLB geometry in `src/lib/objectModelRenderer.ts`, deterministic normalized-time rigs in `src/lib/object3d.ts`, and the same `PreviewEngine` used by browser preview and recorder export. The arrow/shell cross directional reveals, the payphone orbits over a circular reveal, and independent 3D fragments carry the outgoing image while revealing incoming media. Fragment motion is kinematic, not a physical fracture simulation. Start/end frames preserve incoming/outgoing alpha exactly. WebGL-unavailable cases use a basic reveal fallback rather than claiming a rendered 3D model.

The Object 3D inspector exposes prop size, spin, direction, fragment spread, lighting, duration, preview and reset as appropriate to the asset. Credit links are visible in both inspectors. Parameters persist in project bundles and support undo/redo. The existing generic transition API lists/applies all six new presets; no task-shaped tool was added.

New preset cards have actual model-render thumbnails generated with original test colors. User-supplied anime footage is used only in review evidence, not library thumbnails. Category buttons adapt to panel width with separate count labels; 320/390/1440 px review found no page or button overflow. Latest screenshots are under `evidence_video/asset-transitions/ui/`.

## Rendered evidence and checks

Watch `evidence_video/asset-transitions/six-asset-reel.mp4`. It concatenates six actual editor-rendered sequences without further pixel processing. Each individual MP4 contains 49 distinct frames at 640×360 / 30 fps, sampled across the 1.6-second transition including both endpoints. The resulting endpoint-inclusive MP4 duration is about 1.633 seconds. Input is an original title card and the user-provided RDT edit, covered to the landscape frame. Its pre-existing cuts/effects stay baked in; these videos are transition demos, not independent RDT recreations.

`qa/render-external-asset-transitions.mjs` verified actual WebGL with all four prop GLBs loaded, visible live screens on both TVs, parameter-dependent pixel changes, exact endpoints, real source-video clock advancement from 7.2 to 8.8 seconds, actual inspector input/undo, bundle round-trip and generic agent API application. There were no page errors. The source video was decoded, not represented by a still image.

The product's native recorder also exported `editor-export.mp4` with H.264 video and source audio (measured audio RMS **0.06314**). This software-GPU capture is **1.63075 s / 19 distinct VFR video frames**; it does not establish fixed-rate realtime capture or 4K hardware performance. The six offline frame-sequence MP4s are the fixed-rate render proofs.

Executed checks: TypeScript and production build; deterministic object/fragment rigs and transparent endpoint identity; real GLB container/embedded-map/centering/scale checks; all six packed Blender sources reopened; existing device/glitch/drawing/persistence browser regression (nine models × seven sampled poses), context-menu and live MCP regressions. Movie manifests, UI measurements and source checks are saved alongside artifacts.

## Source access and reproduction

Poly Haven APIs/downloads and OpenGameArt pages/downloads worked. Sketchfab search worked; its download API returned **401 requiring authentication**. Restricted NC/ND candidates were not selected. Kenney pages returned **403**. No protected viewer caches or tunnel/gateway bypasses were used; no Sketchfab or Kenney model is claimed as acquired.

Run from the repository with dependencies installed and normal proxy/CA settings preserved:

```sh
python scripts/fetch-transition-sources.py
blender --background --disable-autoexec --threads 2 --python scripts/blender/build_external_transition_pack.py
blender --background --disable-autoexec --threads 2 --python scripts/blender/verify_transition_pack.py
node qa/object-transition-rig-unit.mjs
npm run dev -- --port 5176 --strictPort
# In another terminal:
URL=http://localhost:5176/#studio node qa/render-external-asset-transitions.mjs
```

The download cache defaults to `/workspace/reference-3d`; original site responses and unused archive contents stay outside the app. Runtime GLBs, generated thumbnails, credits and packed editable conversions are in the repository. Source Blend scripts are never executed. Original phone/device assets and project data are preserved. No environment configuration was changed or published.
