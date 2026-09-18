# Research log

| Date | Source cluster | Finding | Decision | Consequence |
|---|---|---|---|---|
| 2026-09-18 | OpenCut/Kdenlive/MLT/OTIO/Olive/Shotcut | Mature editors separate timeline data from render/effect graphs | Keep `Sequence`/`Track`/`Clip` and registries independent | Preview/export can share graph logic |
| 2026-09-18 | Krita | Selection modifiers and per-frame correction matter more than model novelty | Make Shift/Alt/Ctrl/Shift+Alt and frame/range/all visible | Manual masks remain useful when AI is unavailable |
| 2026-09-18 | OpenCV/LK/Shi–Tomasi/RANSAC | Local gradients, pyramids, robust model fitting and forward/backward checks solve a strong baseline | Implement a hybrid tracker with measured confidence | Fast path works offline and is testable without weights |
| 2026-09-18 | SAM2/ORT browser studies | Encoder-per-frame is the slow path; ORT export details matter | Add explicit SAM2 sparse-keyframe option | SAM2 is opt-in, cached/lazy, and falls back honestly |
| 2026-09-18 | BiRefNet/MODNet/ISNet | Background-removal model licences differ | Registry separates code/weight licence and shippability | AGPL ISNet is research-only |
| 2026-09-18 | Telea/PatchMatch/OpenCV inpaint | Repair needs real methods, not a blur labelled inpaint | Implement Telea, diffusion, PatchMatch and temporal hooks | Omniframe can repair a vacated region |
| 2026-09-18 | Three/glTF/RoomEnvironment/PMREM | Environment lighting and visible background are separate; glTF carries skin/clip data | Scene model stores environment/material/rig/clip metadata | 2.5D is offered before an unverified full 3D solve |
| 2026-09-18 | Lightmap baker projects/xatlas/PBRT | Baking needs UV charts, rays, denoise, padding and invalidation | Implement CPU reference bake and cache key | Never display “baked” for a fake preview approximation |
| 2026-09-18 | FABRIK/CCD/Blender rig docs | IK and animation need constraints/rest/bind separation | Implement FABRIK/CCD, skinning and clip sampling | tracked anchors can drive rig targets later |
| 2026-09-18 | WebCodecs/MP4Box/FFmpeg | Codec support/container muxing are separate and machine-specific | Capability probe + export adapter boundary | No preset claims a codec that the machine cannot encode |
| 2026-09-18 | VS Code/Krita/pro NLE UI | Dense workbenches work with contextual panels and keyboard paths | Separate landing and editor; contextual inspector/command palette | Avoid generic dashboard UI |
| 2026-09-18 | Tauri 2 / File System / IndexedDB | Native and web persistence need atomic/scoped storage | `.vxproj` migrations + Rust atomic-write boundary | Desktop remains honest until toolchain CI runs |
