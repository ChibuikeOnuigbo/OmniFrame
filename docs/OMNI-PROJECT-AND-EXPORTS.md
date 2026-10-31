# OmniFrame Project Save/Load and Content-Aware Exports

## Purpose and user-facing contract

**`.omni` is the preferred save format for an editable OmniFrame project.** It stores editor state and embeds session media instead of persisting temporary `blob:` URLs. Use it when the project must remain editable, when it contains more than one media type, or when the right interchange format is uncertain.

Other formats are offered as **explicit subsets**, not as interchangeable project files. The export menu is derived from timeline/3D state and names what each target drops. A PNG option is withheld if a still cannot represent the timeline; OBJ is intentionally a geometry-only subset. No UI text claims that a PSD/KRA/ORA import is a complete native round trip.

## Save/Open workflow

- **Save `.omni`** opens a project-name prompt and downloads `<name>.omni`.
- **Open project** accepts `.omni` from the top bar. The general import/drop handler also recognizes `.omni`.
- A successful open replaces the current editor document, restores embedded media URLs, stops playback, clears transient busy indicators, and starts a fresh undo/redo history.
- A failed or tampered bundle is rejected before the current document is replaced; the top bar reports the reason.

## Schema v1

An `.omni` file is a ZIP archive containing a JSON manifest plus binary resources. Compression is currently stored (ZIP method 0) to avoid expensive/variable media recompression.

```text
manifest.json
media/file-000001.bin
media/file-000002.bin
...
```

Manifest outline:

```json
{
  "format": "omniframe-project",
  "schemaVersion": 1,
  "projectName": "Example",
  "createdAt": "ISO-8601 timestamp",
  "state": { "...": "serialized editor document" },
  "attachments": [
    {
      "id": "file-000001",
      "path": "media/file-000001.bin",
      "mimeType": "image/png",
      "size": 1234,
      "sha256": "lowercase SHA-256 hex",
      "fileName": "optional original name",
      "lastModified": 1700000000000
    }
  ]
}
```

### State and embedded-resource handling

- The serializable Zustand editor state is preserved; action functions are not serialized.
- Root undo/redo stacks and transient interaction/playback/import/job flags are excluded. Opening always clears undo/redo history.
- Plain objects, arrays, `Map`, `Set`, `Date`, `BigInt`, non-finite numbers, `ImageData`, `ArrayBuffer`, typed-array views, `Blob`, and `File` values have explicit encodings. Cycles and unsupported class instances fail with a save error rather than silently disappearing.
- `blob:`/`blob:`-containing text references are replaced with attachment references. Resource fields using remote HTTP(S) URLs are fetched and embedded; a CORS/network failure blocks saving rather than creating a knowingly fragile external link. Data URLs remain self-contained in the manifest.
- App-relative installed-resource URLs are left relative; they are expected to resolve against the same OmniFrame distribution and are not copied into every project.
- Original PSD/ORA/KRA files retained by the artwork-import workflow are included because their object-URL bytes are serialized. Imported raster layer assets are embedded as well. This preserves the source bytes for reopening in OmniFrame; it does **not** turn the importers into native PSD/ORA/KRA writers.
- On load, embedded binary URLs are recreated with `URL.createObjectURL`. Hashes and declared lengths are checked before state is applied.

### Safety limits

| Limit | Value |
|---|---:|
| Compressed `.omni` size | 1 GiB |
| Total expanded archive/resource bytes | 1.5 GiB |
| One attachment | 512 MiB |
| JSON manifest | 32 MiB |
| ZIP entries | 20,000 total, including manifest |
| Supported ZIP compression | Stored or deflated |

These are memory-safety ceilings, not a promise that a browser with little available memory can comfortably open a project near the ceiling. Save/load currently buffers the ZIP and resources in memory; it is not a streaming/native filesystem implementation.

## Capability-gated export matrix

The main **Export video** button is available only when visible video/audio/3D/compound timeline content exists **and** there is visible picture content to render; audio-only and still-only timelines expose no video option. The adjacent format menu shows only applicable subset options, plus `.omni`.

| Format | Offered when | What it contains | Deliberately omitted / warning |
|---|---|---|---|
| **`.omni`** | Always | Editable OmniFrame state, timeline, supported 3D scene state, and embedded session media | No undo history or active runtime jobs. Not a Photoshop/Krita/other-app native project. Unknown future schema versions are rejected rather than guessed. |
| **Video sequence** | Visible video/audio/3D/compound timeline content exists on visible tracks, plus visible picture content to render | Rendered timeline captured from the Program Monitor | Flattens layer/clip structure. Browser `MediaRecorder` selects MP4 when supported, otherwise WebM; audio or other non-video data may not map identically in every browser. Still-only timelines do not expose this option. Use `.omni` for continued editing. |
| **PNG still** | A visible image/text still is present at the playhead, there is no visible video/audio/3D/compound timeline content, and 3D mode is not active | One flattened Program Monitor frame at the playhead | No animation, track/layer editability, sound, or other frames. It is intentionally not offered for mixed image+video/audio/3D/compound timelines. |
| **OBJ geometry** | 3D mode is active and the editable primitive scene contains geometry | Geometry for the current OmniFrame scene primitives (wheel, cube, sphere, torus, diamond, plane) | Geometry subset only: no 2D image/video/audio, timeline, keyframe animation, materials/MTL, textures, effects, or imported model-file bytes. The menu warns when imported 3D assets would also be omitted. |

### Gating examples

- **Image-only timeline:** PNG is available only when a still is visible at the playhead; there is no primary or menu video-export option. PNG is a single flattened frame.
- **Audio-only timeline:** video is withheld because no visible picture content exists; use `.omni` to keep the editable audio timeline.
- **Image + video timeline:** video sequence remains available; PNG is withheld with a loss warning because it would discard time-varying footage.
- **Image + 3D scene:** OBJ can be selected in 3D mode as a geometry-only subset; 2D content is omitted and `.omni` remains the full-project option.
- **No timeline content and no active 3D scene:** `.omni` is the only project-level option. Place supported content on the timeline or enter 3D mode to expose applicable subset exports.

## Known limits / fidelity boundary

1. **`.omni` v1 is OmniFrame-to-OmniFrame state restoration**, not a universal interchange format. It does not contain app-installed model/LUT resources that ship with OmniFrame, undo history, temporary active-job objects, or every view-only component setting (for example, the 3D camera orbit/aim and grid visibility). Save limits are finite and resource bytes are held in browser memory.
2. **External painting-app formats remain bounded imports.** PSD is a guarded RGB/8-bit raster subset with merged-composite fallback for recognized unsupported composition; ORA imports visible raster PNG layers with fallback; KRA imports its saved flattened composite. No PSD/KRA writer or verified full-fidelity native round trip exists. Procreate remains unsupported. Details and verification are in [ARTWORK-FORMAT-IMPORT-RESEARCH.md](ARTWORK-FORMAT-IMPORT-RESEARCH.md).
3. **PNG and OBJ intentionally lose project content.** The menu and this table are explicit about flattened frames and geometry-only output. Do not infer material/texture or timeline fidelity from a valid OBJ file.
4. **Video output is browser-dependent.** The current exporter uses the browser's supported `MediaRecorder` MIME type and live preview capture; MP4 is not guaranteed on every browser/WebView. The chosen extension follows the actual MIME type.
5. **Large/remote resources can block saving.** Browser memory, cross-origin fetch policy, unavailable remote URLs, per-resource limits, or serialization of unsupported runtime objects can prevent a save; the app reports an error instead of claiming success.

## Per-feature implementation / QA checklist

- [x] Versioned ZIP manifest with schema identifier and project name.
- [x] Embed object-URL/File/binary state resources; retain PSD/ORA/KRA source bytes from artwork import.
- [x] SHA-256 + byte-length checks for every attachment before replacing current state.
- [x] ZIP path, duplicate-entry, entry-count, manifest-size, attachment-size, expanded-size, and archive-size validation.
- [x] Rehydrate media references to fresh object URLs and restore timeline/project state.
- [x] Top-bar Save/Open controls and `.omni` drop/import path.
- [x] Export menu communicates full-project preference and subset loss.
- [x] Offer video only when visible video/audio/3D/compound timeline content exists; still-only timelines do not expose video export.
- [x] Offer a flattened PNG only for a still-only timeline with visible content at the playhead; explicitly suppress it for mixed video/audio/3D/compound content.
- [x] Offer OBJ only in active 3D mode with an editable scene; exporter writes valid primitive geometry and warns about omitted data.
- [x] The 3D primitive/material controls used by the viewer are backed by project scene state so `.omni` restoration and OBJ geometry agree on the current primitive/color/basic material settings. OBJ still does not preserve those materials.
- [x] Targeted browser round-trip and subset-matrix test: `BASE=http://localhost:5173 npm run qa:omni-project` — **14 passed / 0 failed**. Coverage includes visible Save/Open controls, named UI save, versioned ZIP, byte-exact PSD attachment, imported pixels, timeline/state restoration, fresh URLs, PNG signature, image-only PNG with no primary or menu video option, audio-only no-video/no-still gating, image+video gating, OBJ vertices/faces, hash-tamper rejection without document replacement, and no browser errors.
- [x] Regression checks after source-document and 3D scene-state integration: `BASE=http://localhost:5173 npm run qa:artwork-import` — **23 passed / 0 failed**; `BASE=http://localhost:5173 npm run qa:psd-hair` — **28 passed / 0 failed**; `node qa/three-d-video-plane-e2e.mjs` passed, including a new assertion that primitive/wireframe controls synchronize into project scene state.
- [x] `npm run typecheck` and `npm run build` pass after this implementation; Vite still reports existing non-fatal chunk-size and dynamic-import warnings.
- [ ] Native Tauri file-dialog/streaming persistence adapter and desktop package execution; requires the Rust/Tauri toolchain and platform WebView dependencies.
- [ ] Cross-version migration tests for a later `.omni` schema. Schema v1 rejects unknown versions by design until a migration is implemented.
- [ ] Cross-application native-format round-trip certification; explicitly outside the claims made here.
