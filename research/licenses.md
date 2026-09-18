# Licence research and shipping policy

**Checked:** 2026-09-18. This is an engineering gate, not legal advice. Re-check every dependency, revision, model and asset before release.

## Policy

Preferred shipping licences are MIT, Apache-2.0, BSD-2-Clause/BSD-3-Clause, ISC and other explicitly compatible permissive licences after review. GPL/LGPL/AGPL, CC-BY-NC, unknown model weights and unclear assets do not enter the default shipping bundle without an explicit legal decision.

## Current registry decisions

| Item | Decision |
|---|---|
| Three.js / React Three Fiber / Drei | permissive candidates; version and transitive audit required |
| onnxruntime-web | MIT candidate; model/weights are separate records |
| SAM2 Apache-2.0 export | candidate after exact revision/weight verification |
| BiRefNet Lite / MODNet | candidates after exact weight verification |
| ISNet-ONNX | research-only: current listing is AGPL-3.0 |
| CoTracker | research-only: current project reports CC-BY-NC restrictions |
| Kdenlive/MLT/Olive/Shotcut/OpenShot/LosslessCut | behaviour/research references; not copied into the permissive core |
| Poly Haven / ambientCG | useful environment/texture sources; imported files still need source/licence records |

## Required records

- `CREDITS.md`;
- `LICENSES.md`;
- `THIRD_PARTY_NOTICES.md`;
- `MODEL_REGISTRY.md`;
- `research/references.json`;
- SPDX/checksum/revision for shipped code, weights, fonts, templates and assets.

The model registry has `license`, `weightLicense`, `source`, `revision`, `shippable`, `researchOnly` and attribution fields. A model marked incompatible cannot pass the audit just because its UI entry exists.
