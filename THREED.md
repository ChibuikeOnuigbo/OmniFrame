# 3D

The scene model is glTF-oriented and stores objects, cameras, lights, materials, environment, animation bindings and lightmap records without storing renderer objects.

## Environments

Room, HDRI, colour and none are explicit modes. PMREM is required for image-based PBR lighting. Visible background can be decoupled from illumination.

## Baking

The current CPU reference baker rasterises lightmap UVs, traces BVH shadow rays, evaluates direct/environment/diffuse bounce light, computes AO, denoises, pads seams and emits a cache hash. It reports bake time and validity. Dynamic/animated input is not silently baked into static output.

## Rigging

Bones preserve rest transforms/inverse bind matrices; linear blend skinning is the baseline. FABRIK and CCD solvers have limits and report error/unreachable targets. Imported clips can be sampled, looped, trimmed and blended. A reliable 2D track can drive a 2.5D/3D anchor only after coordinate conversion.
