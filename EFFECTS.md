# Effects and transitions

`EffectRegistry` is the source of truth. A definition contains id/version/name/category/parameter schema/defaults/CPU renderer/GLSL declaration/licence/documentation flags and mask support.

The current registry includes opacity, brightness, contrast, saturation, hue, temperature, tint, exposure, gamma, vibrance, posterize, threshold, pixelate, vignette, grain, scanlines, chromatic aberration, duotone, sharpen, Gaussian blur, edge detect and glow, plus crossfade/cut/dip/wipe/circle/slide/blur/zoom/pixelize transitions.

Custom effect manifests are validated for IDs, schema, renderer, GLSL and licence. Untrusted shaders are not executed without a sandbox. CPU/export parity is a gate, not a claim based on a matching button name.
