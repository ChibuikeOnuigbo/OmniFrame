# Hancybox compound, flip, mask, and glow implementation study

Date: 2026-11-01

This change uses the repository's existing Hancybox evidence catalog rather than claiming a new continuous watch of the full channel. The local audit currently records 79 catalogued entries from the 123-entry channel listing; some entries are full local media, while others are metadata, sampled frames, transcripts, or contact sheets. The distinction is preserved in `yt_hancy/hancy_explantion.md` and `yt_hancy/hancybox-all-tools-once.md`.

## Evidence applied

| Local evidence ID | Observed workflow | OmniFrame behavior covered here |
|---|---|---|
| `Q9Aka1vrJVQ` | Flip layer using Y rotation and a radial/linear wedge | Existing keyframeable 3D rotation and card-flip effects remain available on ordinary and compound clips. |
| `lthFvh04iVY` | Card animation with 3D rotation, position fan, and shadow | A compound remains a reusable clip after nesting, so its outer flip/effect stack acts on the combined child result. |
| `jaa8Lpvo8h8` | Curl/flip treatment using rotation and a mask wedge | Visibility masks remain separate from the new effect-only masks. |
| `AQV-mQzAs-U` | Frosted blur, feather, and glow | Each effect-mask region exposes feather and opacity, while blur/glow values stay editable and keyframeable through effect instances. |
| `7blzGS1OaK4` | Mask reveal with glow | The renderer now composites the processed result through the region union over an untouched source result. |

## Implemented editing law

1. Compound children render first into a reusable nested result.
2. The compound's outer effect and LUT stack processes a copy of that result.
3. Rectangle, circle, ellipse, text, and custom-path regions form one additive effect matte.
4. The processed copy replaces the original only at matte coverage; feathered edges interpolate between the two.
5. A normal Video Mask View still controls clip visibility independently.
6. Numeric effect-instance properties keep their existing per-property keyframe curves.

The five-light QA recipe imports an original 640×360 image, nests it through `compound_clip_create`, applies one keyframed glow/blur instance to the compound, and assigns five circle regions through `edit_element.adjustmentMask`. Its pixel assertion checks all five bulb centers changed and four outside points remained byte-identical.
