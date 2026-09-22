# Repository research matrix

This file supplements the prior 21-repository audit in `.audit/video-editors/`. Clones are kept under excluded `.audit/editor-research/`; production contains no copied upstream code.

| Repository | Commit inspected | License observed | Relevant source located | Decision |
|---|---|---|---|---|
| FreeCut | `4d62e8082c5eb387a96275bcbd323d28f6e41a62` | MIT | feature-scoped editor, compositing timeline tests, timeline context and transition docs | Architecture/test patterns only; inspect canonical action/state flow before adopting ideas. |
| OpenReel | `3be4be4a0eada4312f060dff01eb9c6826cd737e` | MIT | editor Timeline, TrackHeader, keyframe track, transition and motion-tracking bridges | Strong browser architecture reference; no blind component copying. |
| Cutie | `ec5cdd4cf16f75c73ad785a2f96fb97dbad4125a` | MIT | interactive video-object segmentation implementation | Research-only until model/checkpoint and browser/native resource audit is complete. |
| gl-transitions | `902218a1b63773ac0d0d9f491951da3392365bfe` | MIT collection | transition validation/render scripts and GLSL collection | Descriptor/interface research; every individual shader still requires header/provenance audit. |

## Execution status

Cloning and static license/source discovery succeeded. Full installations/builds were not attempted in this bounded iteration; dependencies are large and application work must not be displaced by bulk reference builds. This is recorded as **NOT YET RUN**, not PASS.

## Existing research continuity

The earlier audit records 21/21 requested reference clones and source/license observations in:

- `.audit/video-editors/reference-inventory.md`
- `.audit/video-editors/reference-license-audit.md`
- `.audit/video-editors/reference-build-results.md`
- `.audit/video-editors/source-observations.txt`
