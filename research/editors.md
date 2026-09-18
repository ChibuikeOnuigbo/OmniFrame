# Editor research and architecture decisions

**Checked:** 2026-09-18. Sources: OpenCut, Kdenlive/MLT, Olive, Shotcut, LosslessCut, OpenShot, OBS/libobs, OpenTimelineIO, Remotion, Resolve/Premiere/FCP behaviour references.

## Shared patterns worth adopting

| Pattern | Why it matters | OmniFrame decision |
|---|---|---|
| Integer/rational media time | Float seconds drift at cuts and retimes | Sequence clips store integer frames; assets retain source rate metadata |
| Timeline separate from render graph | UI edits should not hard-code effects | `Sequence`/`Track`/`Clip` are data; `EffectRegistry` and `OmniframeOp` render separately |
| Stable IDs | Nested clips, undo and relink need durable references | `uid()` IDs on persisted objects |
| Proxy/thumbnail caches | Decoding full 4K on every scrub is wasteful | cache/job layers are explicit and budgeted |
| Compound clips | Complexity must collapse into a reusable unit | nested sequence IDs preserve effects/masks/audio |
| Track roles/metadata | Audio/caption/adjustment/3D tracks need different behaviour | `TrackKind` is explicit; no generic “card” abstraction |
| One user gesture = one undo | Complex propagation should not create dozens of undo steps | `History` supports `MacroCommand` |
| Capability-aware export | Codec support varies | `probeCodecs()` and export presets are separate |

## Timeline interaction contract

- Selection, blade, trim, roll, slip, slide and ripple are different operations.
- Snap targets include clip edges, markers, in/out and playhead; snapping is a threshold, not a forced grid.
- At high zoom, a frame is an addressable unit. At low zoom, the timeline is virtualised/aggregated.
- Timeline scrolling is internal. The page itself must never gain horizontal overflow.
- Audio is not a decorative row: its waveform is multiresolution min/max/RMS data.

## What is deliberately not copied

GPL editor code is not copied into the MIT/Apache core. Behaviour is used as a reference and the native render adapter remains an explicit future boundary. The project format is original `.vxproj`; OpenTimelineIO is a future interchange path, not the internal schema.
