# OmniFrame device transition + Glitch NG quality implementation

## Workstream status
This branch intentionally preserves the existing `device3d.ts` projection renderer and `transitionPresets.ts` device transition IDs. They are not rewritten to another framework. The new `scripts/blender/generate_device_pack.py` gives a fully procedural Blender source for seven real mesh variants with a named `DeviceRig_ROOT`, independent `ScreenSurface` mesh and GLB/JSON export. **Blender was not installed in the current execution container; GLB export, Blender image previews, and OmniFrame MP4 exports are not claimed.** It is a buildable source recipe rather than a fake finished pack.

## Run the native 3D pipeline
Install Blender 4.2+ in the agent environment, then run:

```sh
blender --background --python scripts/blender/generate_device_pack.py -- --out public/models/device_transitions
```

Check all seven GLBs import in Blender and Three.js with their `ScreenSurface` object, including transparent screen alpha and perspective camera. Use real user footage dynamically as the material texture, not a green JPEG. Render front, three-quarter, side, and rotating views; quality-gate the UV orientation, occlusion, bezel shape, hinge, stand, glare and edge aliasing.

## Existing repo integration points
- `src/lib/device3d.ts`: existing procedural projected device scenes, live media screen quad and 3D-to-2D handoff; preserve as fallback when GLB not loaded.
- `src/lib/transitionPresets.ts`: existing `device_phone`, `device_monitor`, `device_tv` IDs and placement logic; add other IDs only alongside updates to transition types, browser rendering, headless rendering and QA.
- `src/lib/glitchNG.ts`: formerly one family per effect; now optional `layers` compose ordered independent families with opacity, timing windows, seed and blend modes, while retaining legacy single-family recipes.
- `src/lib/effectCatalog.ts` and `src/components/EffectsPanel.tsx`: future editable layer-list inspector. Do not falsely claim these UI controls are added yet.
- `qa/glitch-ng-layers-unit.mjs`: deterministic offline unit checks that do not require GPU.
- `tools/mcp/appRender.mjs` / `src/lib/playback.ts`: ensure shared layered-recipe serialization and identical evaluation for actual native editor export and preview before marking integrated.

## Remaining acceptance gates (not completed here)
1. Validate Python script syntax and Blender glTF export on an installed Blender binary.
2. Produce actual GLB assets, render PNG beauty/alpha/screen matte with correct screen metadata.
3. Import GLBs as actual loaded Three.js models and animate device rig through defined timeline keyframes.
4. Preserve live, perspective-correct editable video in the screen in browser and headless renders.
5. Expose independent per-layer glitch inspector and keyframes in editor, persistence and undo/redo.
6. Export reference-comparable 1080p/30fps individual MP4s using the actual OmniFrame renderer; combine and score blind against the supplied video.
7. Run all existing E2E suites and desktop package CI; ensure no regression.
8. Review existing transition QA for phone/monitor/TV; laptop is not wired to the runtime transition enum yet.
9. Review licensed inspiration references; do not redistribute downloaded Pinterest imagery as model textures.
10. Provide a genuine visual evidence manifest with output file paths, source license and measured results.
