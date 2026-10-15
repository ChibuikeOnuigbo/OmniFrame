# Artwork-file import: evidence, support boundaries, and interoperability plan

**Review date:** 13 October 2026  
**Purpose:** Let people bring existing artwork from common painting applications into OmniFrame for use in the video timeline and rigging workflow, while refusing to imply that an imported image is a lossless reconstruction of the source application project.  
**Coverage:** Prioritized Photoshop, Krita, GIMP/OpenRaster, Clip Studio Paint, Procreate, and Affinity; this is a focused compatibility matrix, not an exhaustive inventory of every creative application.

## Executive decision

A file extension alone does not guarantee that OmniFrame can recover every editable object, effect, color-management choice, mask, animation cel, application-specific property, and project metadata field. “Perfectly” is only a defensible claim when the exact file profile is defined and compared with the source application's own render and metadata.

**Status against the stricter full-data goal:** no native painting-app project format is certified here for lossless open-edit-save round trips. Existing PSD and ORA imports cover explicitly bounded raster subsets; KRA exposes only its saved merged image. These can make rendered artwork processable, but they do not collect every source-project field or save back to the source application format. No additional native importer should be advertised until it clears the verification gate below.

This pass therefore keeps deliberately bounded support:

- **Photoshop `.psd`:** imports a guarded RGB/8-bit visible-raster subset. Unsupported layer compositing now falls back to the PSD's saved merged image as one clearly flattened still when that image can be decoded; no source layer feature is silently represented as editable if we cannot reproduce it.
- **OpenRaster `.ora`:** imports supported visible PNG raster layers as individual Media assets; preserves names, top-first order, signed offsets, layer opacity, group-name path, and Canvas-supported blend modes. If the stack contains a feature whose compositing cannot be represented safely (for example, a non-normal group mode/opacity, vector/text layer, or unknown blend mode), it uses the archive's `mergedimage.png` as one flat Media asset instead of silently showing a wrong stack.
- **Krita `.kra`:** imports the saved `mergedimage.png` as one flat still. This is a dependable way to bring the rendered picture into the editor, but it is **not** a Krita layer/project importer. For editable raster layers, export from Krita as `.ora`; that exchange format is the path with the strongest inspectable structure.

All these paths import into the Media library only. Users explicitly place assets/clips on the timeline. The app does not reopen/save native PSD, KRA, or ORA projects, and this work does not claim round-trip fidelity.

## What the formats actually contain

| App / format | Observed format characteristics | OmniFrame decision |
| --- | --- | --- |
| **Photoshop — `.psd`** | The project uses `ag-psd`, whose own README lists unsupported CMYK/indexed/multichannel/duotone/Lab, 16-bit, PSB, animation, some metadata/new-version features, incomplete text, and other limitations. | RGB/8-bit visible raster layers are imported only when layer/group composition maps to OmniFrame. Masks, effects, text/vector/smart objects, adjustment/clipping features, isolated/non-normal groups, unsupported blends, animation, and other recognized special content fall back to the saved merged composite; failed composite decode is rejected. No PSB support or native PSD writer/round trip. |
| **Krita — `.kra`** | Krita's native archive contains `maindoc.xml`, a saved merged image, preview, and native per-layer paint-device data. Paint layers use tiled data; real documents can additionally carry groups, masks, filters, color profiles, animation, and non-RGBA color spaces. Decoding only the merged PNG is much safer than treating native tile bytes as ordinary PNGs. | Import only `mergedimage.png` as a still. Use Krita's `.ora` export to exchange supported raster layers. No claim of layer, mask, filter, color-profile, or animation import. |
| **Krita / GIMP / MyPaint — `.ora` (OpenRaster)** | Open interchange archive: ZIP members, `stack.xml`, individual raster PNGs, and a merged composite. The baseline models layer order, signed offsets, visibility, opacity, nested stacks, and compositing metadata. Extensions and app-specific modes are not guaranteed to be portable. | Implement the common visible-PNG subset. Retain raster layers only when the stack maps safely to OmniFrame; otherwise import the source merged composite as a visibly flat still. Hidden layers and unsupported editor-specific features are not imported. |
| **GIMP — `.xcf`** | Native XCF has versioned pointer layouts, tile compression/precision variants, groups, masks and blend/compositing semantics. A new community parser claims broad layer/tile decoding, but it is recent, has no verified current-GIMP fixture corpus in this repository, and is not a proof of exact output. | Not accepted as a project yet. Export to `.ora` for a tested common raster subset, or PNG for a flat render. Do not rename XCF to `.ora`. |
| **Clip Studio Paint — `.clip` / `.cmc`** | Proprietary, versioned format with no official public specification. The recently released `clipfile-rs` is an experimental Rust toolkit with validated container structures, typed layer/vector/raster/animation subsets, and conservative rewrite features; its own README still lists unimplemented rendering and encoder areas. | Not imported. A promising parser is not yet a completeness certificate or a drop-in browser dependency. Export a tested PSD/ORA/PNG copy from the source app and verify the render. |
| **Procreate — `.procreate`** | Archive containing a binary document archive and tiled/compressed layer payloads; community readers describe version-dependent compression/rendering. A thumbnail is not the complete project. | Not imported (per user constraint). Use Procreate export to PSD for a tested layer subset or PNG for a flat render; do not treat its ZIP thumbnail as the artwork. |
| **Affinity Photo — `.afphoto` / `.afdesign`** | Native application project formats with feature-rich, app-specific layers and live effects; no dependable in-repo parser or verified app-authored compatibility corpus was found. | Not imported. Export a PSD/PNG copy and check it in Affinity first. |
| **Paint.NET — `.pdn`** | Native project support has not been audited against an app-authored versioned fixture corpus in this repository. | Not imported. Use a source-app PNG for a flat render; do not infer layer support from a renamed image. |
| **FireAlpaca / MediBang — `.mdp`** | Native project support has not been audited against versioned app-authored fixtures here. | Not imported. Export a source-app PNG, or a PSD copy only after checking the result in the source application. |
| **Corel Painter — `.rif`** | Native project support has not been audited against versioned app-authored fixtures here. | Not imported. Use a source-app PNG/PSD export only after validating its render. |
| **Adobe Illustrator — `.ai`** | A PDF-compatible save or vector preview is not equivalent to recovering every Illustrator layer, live effect, font, linked asset, and edit state. | Not accepted as an editable project. Export a checked PDF/SVG/PNG render; ordinary SVG preview is not a native-project import claim. |
| **SVG artwork** | Standard vector syntax still permits external references, fonts, filters, scripts, and embedded resources that affect output. It is different from a layered raster project. | Existing generic image loading may preview ordinary SVGs; no new SVG project/interchange claim is added here. Embedded/external dependencies are not audited by this work. |

### Why not decode every native format now?

A reader that gets the canvas width, filenames, and layer names right can still render visibly wrong artwork if it mishandles a compression mode, group isolation, masks, linear-light compositing, alpha inheritance, embedded profiles, or a new format version. “It opened” is not proof that it recovered the original edit or even the original rendered pixels. The implementation errs toward the source application's merged composite when it is available; formats without a trustworthy composite are rejected with conversion guidance.

### Full-data acceptance gate

A format will not be described as fully supported until all of these are true for a named application/version and a named feature profile:

1. Real files saved by that application cover ordinary layers plus the feature classes the importer claims to support; each reference file has a source-app render and documented expected metadata.
2. Every visible pixel, alpha value, layer order/offset/name/opacity/blend setting, and in-scope project property is compared—not only archive structure or thumbnails. Unknown/unsupported content is preserved byte-for-byte or causes a clear reject/flatten choice; it is never silently discarded.
3. OmniFrame can save and reopen its own versioned project with the source bytes, extracted data, and edits intact. If native export is claimed, the exported file must also reopen in the source app and pass the same pixel/metadata checks.
4. The UI distinguishes an editable layered import from a flattened still and tells the user exactly which native properties are not carried. The source file is never overwritten during import.

No external painting-app format currently passes this whole gate in OmniFrame. The app now has a versioned `.omni` project bundle for OmniFrame-state/media save and restore, but that is not a PSD/ORA/KRA writer or a cross-app native round trip; its v1 scope and explicit omissions are documented in [the project/export matrix](OMNI-PROJECT-AND-EXPORTS.md). Current PSD/ORA/KRA workflows remain bounded raster import subsets, not full-fidelity promises.

## Implemented user paths

### Photoshop `.psd`

1. The Media and top-bar import pickers accept `.psd`; `.psb` is rejected.
2. `ag-psd` is run in strict missing-feature mode on an RGB/8-bit document. The importer validates the canvas and archive resource limits.
3. A simple supported stack imports visible raster pixels as separate Media assets and retains names, top-first order, offsets, opacity, supported blend operation, and pass-through group names. Layer data not represented by that subset is not advertised as editable.
4. Masks, effects, adjustment/text/vector/smart-object/clipping content, unsupported layer blends, isolated groups, and other recognized unsupported content use the saved composite as one flat asset. If no readable merged image exists, import fails with conversion guidance instead of returning a knowingly incomplete layer stack.
5. This still does not preserve all Photoshop metadata, embedded color-management data, hidden layers, arbitrary groups, every Photoshop version feature, or the original native structure. Import does not modify the original. OmniFrame has no PSD writer; save the editable OmniFrame state as `.omni` instead, understanding that this is not a Photoshop round trip.

### OpenRaster `.ora`

1. The Media and top-bar import pickers accept `.ora`.
2. The importer reads `stack.xml` and only extracts the PNG files referenced by visible raster layer nodes. It validates safe relative paths, duplicate required ZIP entries, compression methods, XML limits, image dimensions, layer count, and aggregate pixel/expanded-byte budgets.
3. Layer names, source document size, paint order, signed x/y offsets, opacity, supported blend operation, and flattened group path are attached to each Media asset.
4. Unrepresentable visible content falls back to `mergedimage.png`, when present. This preserves the source file's saved visible composite instead of guessing at unknown blend/group semantics. The notice says the result is flattened.
5. “Rig artwork layers” and “Place aligned artwork layers on timeline” reuse the existing document-space rig and synchronized-still workflow. Blend/opacity are applied by the common preview renderer for supported layers.

Not imported as editable layers: hidden layers, vector/text layers, masks, app-specific extensions, unsupported blend/group semantics, original group editability, and embedded color-profile data. Group names are retained as metadata, not as native editable timeline folders. A simple layer stack that passes the implemented subset is not a guarantee of cross-application equivalence for every ORA producer.

### Krita `.kra`

1. The Media and top-bar import pickers accept `.kra`.
2. The importer validates the archive identity when available and extracts only the root `mergedimage.png` member.
3. It validates the PNG signature, decoded dimensions, and resource caps, then adds the picture as an ordinary still image asset.
4. The notice expressly says this is flattened; for editable supported raster layers, export as `.ora` from Krita and import that file instead.

Not imported: native layer nodes/tiles, brushes, animation/timelapse, masks, filter/clone/vector/file layers, color profile/proofing state, and other KRA metadata. No KRA writer is present.

## Safety and fidelity gates

- Archive size cap: **256 MB**; requested ZIP entries must be stored or deflated; required paths must be safe relative paths.
- ZIP entry cap: **8,192**; expanded selected data cap: **768 MB**; per-entry cap: **256 MB**.
- Document raster cap: **100 megapixels**; aggregate imported visible layer cap: **160 megapixels**; visible layer cap: **300**; XML size/depth/node limits are enforced.
- A suspicious, unsupported, missing, or non-decodable ORA layer uses its merged composite when available; otherwise import fails with a conversion message. No source files are written or executed.
- Imported `File` object URLs and current project assets are runtime data; `.omni` embeds session URL bytes for OmniFrame restore, but it does not relink or rewrite a PSD/ORA/KRA file for editing in the source application.
- The browser Canvas renderer is 8-bit-oriented and is not a color-managed replacement for Krita/Photoshop. Exact color-match/parity across ICC profiles, HDR/high-bit-depth source layers, every blend mode, WebView version, and every desktop OS is not established.

## Verification to record for this change

- [x] `BASE=http://localhost:5173 npm run qa:artwork-import`: **23 passed / 0 failed**. Generated ORA fixtures check visible PNG layer pixels/names/order/offsets/group metadata/opacity, rig/timeline placement, Program Monitor alpha and `multiply` compositing, and safe merged-image fallback. A generated KRA archive confirms flattened-composite import. Synthetic selections confirm safe guidance for XCF, Clip Studio, Procreate, Affinity, Paint.NET, FireAlpaca/MediBang, Corel Painter, Illustrator, and PSB.
- [x] `BASE=http://localhost:5173 npm run qa:psd-hair`: **28 passed / 0 failed**. Checks supported RGB/8-bit PSD raster pixels/alpha/metadata, pass-through group names, color-dodge labels, isolated-group fallback to a generated saved composite `[13,71,201,255]`, rig/timeline placement, and animation regression (sway sample range 35.073 px; parent +4 PSD px moved hair centroid 67.778 px).
- [x] `npm run qa:rigging-unit`: **49 passed / 0 failed**.
- [x] Final verification on 13 Oct after the stricter PSD fallback and broader rejection guidance: `npm run typecheck`, both E2Es, `npm run qa:rigging-unit`, `npm run build`, `npm audit --omit=dev --audit-level=moderate` (**0 production vulnerabilities**), and `git diff --check` all passed. Build emits a dedicated 15.42 kB artwork-import chunk (6.30 kB gzip); existing large-main-chunk and ineffective-dynamic-import warnings remain.
- [ ] Real files saved by current Krita, GIMP, Photoshop, and other apps plus source-app reference renders are still needed. Generated fixtures validate parser logic, not actual app writers or full-fidelity round trips.
- [ ] Real files written by current Krita, GIMP, and Photoshop versions still needed for interoperability review; generated fixtures validate parser logic, not every app's actual writer.

## Sources reviewed

- [ag-psd](https://github.com/Agamnentzar/ag-psd) — browser reader/writer used by OmniFrame; its own limitations list explicitly excludes PSB, 16-bit, several color modes, some metadata/new Photoshop features, complete text rendering, and other areas.
- [OpenRaster specification repository](https://github.com/openraster/ora-spec)
- [OpenRaster baseline file layout](https://www.openraster.org/baseline/file-layout-spec.html)
- [OpenRaster layer-stack/compositing rules](https://www.openraster.org/baseline/layer-stack-spec.html)
- [Secondary KRA format notes: archive members, maindoc.xml, and tiled layer bytes](https://github.com/2shady4u/godot-kra-psd-importer/blob/master/docs/KRA_FORMAT.md) — older community documentation, not a guarantee for all KRA versions.
- [KDE KImageFormats read-only format overview](https://github.com/KDE/kimageformats) — useful reminder that some viewers deliberately read only merged render members for KRA/ORA.
- [KRA parser project](https://github.com/AlsaiSamo/kra-rs) — its README states metadata parsing is implemented while raster decoding and round-trip file creation remain future work.
- [Recent XCF parser](https://github.com/WillKirkmanM/parse-xcf) and [PhotoCraft XCF reader work](https://github.com/storytold/photocraft/pull/2945) — community parser evidence, not current-GIMP app-authored golden fixtures or proof of every precision/composite path.
- [Clip Studio `clipfile-rs`](https://github.com/Aodaruma/clipfile-rs) — July/August 2026 project describes `.clip`/`.cmc` as proprietary with no official specification, calls itself experimental, and lists unimplemented full-fidelity rendering/encoding areas despite meaningful validated parser/writer subsets.
- [Community Procreate `.procreate` reader](https://github.com/Avarel/silicate) — documents ZIP, tiled payload, compression, and binary archive structures; not treated as a stable interchange contract.
- [fflate](https://github.com/101arrowz/fflate) — MIT ZIP library used for bounded archive extraction.
