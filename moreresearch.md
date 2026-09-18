# OmniFrame — More Research / Decision Record

**Research date:** 2026-09-18 (UTC)
**Scope:** baking, lighting, 3D environments, animation, rigging, browser media, SAM2 tracking latency, editor behaviour, licence risk, and likely user demand.

This document is intentionally a decision record, not marketing copy. It records what was investigated, what is implemented in the current engine, and what is still a product gate.

## 1. The important SAM2 finding: why the demo was slow

The slow path is not “React is slow”. It is architectural:

1. SAM2’s image encoder is the expensive part. A browser Hiera-Tiny export can take seconds for an encoder pass depending on the browser, device, execution provider, and model export.
2. Running the encoder from scratch on every preview frame multiplies that cost by the frame count.
3. The decoder/prompt update is much cheaper than the encoder. Reusing the image embedding is therefore the first optimisation.
4. SAM2’s video memory is useful for propagation, but it still must be managed as a sparse analysis job rather than a render-loop dependency.
5. Plain ONNX exports can fail in `onnxruntime-web` shape inference. ORT-optimised exports are a separate packaging decision, not interchangeable weights.

### OmniFrame’s SAM2 option

The engine now exposes `Sam2Backend` and `trackMaskWithSam2` as an explicit **SAM2 option**:

```text
prompt keyframe
  -> SAM2 encoder + decoder
  -> classical pyramidal propagation for the next N frames
  -> confidence / forward-backward checks
  -> early keyframe if confidence collapses
  -> SAM2 correction keyframe
```

Default design target: keyframe interval 8–12 frames for preview, adaptive early re-analysis when confidence falls below the floor, and a full-resolution final pass. The interval is configurable in Advanced settings. The engine records `keyframesUsed`, measured encoder time, propagation time, and an observed speedup instead of inventing an FPS number.

If ONNX Runtime or the licensed model export is unavailable, the option reports the reason and falls back to the built-in hybrid tracker. It does **not** show fake model progress and it does **not** download a large model on page load.

### Licence decision

- SAM2 code/model entries are recorded as Apache-2.0 candidates, pending exact revision and weight verification.
- `ISNet-ONNX` is recorded as research-only because its current listing is AGPL-3.0.
- CoTracker is recorded as research-only because the current project reports CC-BY-NC restrictions.
- The normal UI offers Fast / Balanced / Quality, not a model catalogue. Model/runtime/device details belong in Advanced.

## 2. Light baking: what “baked” must mean

A bake is valid only when a real light transport pass has run and its inputs are recorded. The current CPU reference baker does:

1. validate triangles and lightmap UV coverage;
2. rasterise UVs to texel samples with barycentric world position and normal;
3. build a BVH for ray/triangle visibility;
4. evaluate direct lights with shadow rays;
5. evaluate environment contribution and optional diffuse bounces;
6. compute an AO channel;
7. denoise with an edge/chart-aware à-trous pass;
8. pad charts to prevent bilinear seam bleed;
9. emit a cache key from geometry, UVs, materials, lights, options, samples and bounce count.

### Bake inputs that invalidate a result

- geometry or topology;
- light position, type, direction, colour, intensity, range or shadow setting;
- material albedo, emissive or relevant texture;
- lightmap UVs/atlas resolution;
- sample count, bounce count, environment source/intensity/rotation;
- renderer colour-management settings when the stored output is display-transformed.

The project record stores `cacheKey`, `samples`, `bounces`, `bakeMs`, dimensions, and `valid`. It must never say “baked” when a preview approximation was merely displayed.

### Production path

- Browser preview: progressive WebGPU baking where supported, with pause/resume/cancel and a CPU reference fallback.
- Desktop final: Rust/native worker, optional GPU backend, same scene descriptor and cache-key rules.
- Dynamic objects/lights: do not bake them into a static lightmap. Use light probes, realtime lights, or a hybrid baked-static + dynamic pass.
- Animated geometry: reject or route to a per-frame/vertex-cache strategy; never reuse a static bake silently.

## 3. Lighting and environments

Three lighting sources need distinct controls:

1. **Punctual lights** — directional, point, spot. They have intensity, colour, range/cone, shadow, softness and bias.
2. **Image-based lighting** — HDRI or procedural room. It should be converted with PMREM so rough materials receive rough reflections.
3. **Visible background** — may use the same HDRI, a blurred version, a colour, or a separate plate. Background visibility is not the same as illumination.

The default environment is a procedural room because it is deterministic, asset-free and fast to initialise. HDRI is an explicit asset choice. Poly Haven and ambientCG are useful CC0 reference sources, but project imports still record source and licence metadata.

Colour rules:

- lighting/math is scene-linear;
- source images retain their transfer-function metadata;
- display output uses an explicit tone map/output transform;
- alpha remains unpremultiplied in engine CPU buffers and is premultiplied only at a renderer boundary that requires it;
- exposure/tone mapping is not hidden inside a creative “brightness” effect.

## 4. Rigging and animation

The 3D model is glTF-first:

- preserve nodes, skins, inverse bind matrices, materials, cameras, lights and animation clips;
- use linear-blend skinning for the baseline;
- keep rest pose, bind pose and animation pose separate;
- use FABRIK for stable interactive IK chains and CCD for quick posing;
- support ball and hinge constraints with explicit limits;
- overlay tracked anchors on animation only after converting the anchor into scene space;
- report IK solve error and unreachable targets.

Animation data is frame/timestamp based, never tied to React render cadence. A clip can be trimmed, looped, reversed where valid, retimed, cross-faded and sampled at an exact sequence frame. Anime.js/WAAPI are suitable for landing/workbench motion; they must not drive frame-accurate media playback.

## 5. What users are likely to want next

Observed demand across professional and open-source editors points to these high-value items:

### Near-term / high confidence

- import a video and see a correct first frame immediately;
- fast frame stepping, blade, trim, ripple, snap and undo;
- a mask that can be corrected on one frame without recomputing the entire clip;
- a tracker that tells the truth when it loses the target;
- privacy blur/pixelate that survives camera movement;
- proxy suggestions for 4K/long-GOP media;
- stable autosave/recovery and relink when a drive path changes;
- social export presets that do not crop the subject unexpectedly;
- waveform and thumbnail generation that happens in the background;
- one-command export with stage, frame, elapsed time, cancel and output path.

### Differentiating / medium confidence

- Omniframe move/duplicate/repair for short shots;
- promptable segmentation as a deliberate “quality assist”, not a mandatory AI cloud service;
- 2.5D depth planes and a tracked plane before promising a full 3D camera solve;
- template slots with validation and fit modes;
- a small but coherent effect registry with preview/export parity.

### High-cost / gate behind evidence

- dense video foundation models on every frame;
- full 3D camera reconstruction on arbitrary footage;
- dynamic global-illumination baking for animated scenes;
- arbitrary plugin execution or downloaded shaders;
- remote/cloud rendering without explicit user permission.

## 6. Product gates

The build order is not allowed to advance on appearance alone:

- a feature must have a real data model;
- its expensive path must be cancelable;
- its preview and export path must share a renderer or a reference test;
- its licence/weights must be recorded;
- at least one synthetic or fixture test must prove the important behaviour;
- visual QA must check clipping, overflow, disabled/dead controls and recovery/error states.

## 7. Reference inventory

See [`research/references.json`](research/references.json) for 136 named references and [`research/`](research/) for the conclusions by topic. The registry intentionally includes incompatible/research-only projects where they teach useful algorithms, but they are not silently promoted to shipping dependencies.

## 8. Source-file audit

The checkout started with only the placeholder README; `bgRemovalWorker(1).ts` and `lumacutEngine.ts` were not present anywhere in `/home/user/OmniFrame`. Their requested capabilities therefore could not be read or copied. The engine implements the named architectural responsibilities independently (model registry/loading contract, alpha/mask operations, vectorisation, morphology, colour sampling, manual frame masks and propagation) and does not claim to have preserved code that was not available in the checkout.
