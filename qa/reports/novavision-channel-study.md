# NovaVisionHub / SnowProductions — channel study, implementation checklist, and verification

**Review date:** 12–13 October 2026
**Coverage:** selected NovaVisionHub recent-feed videos plus selected SnowProductions collaborations and workflow videos—not a complete channel archive. RSS exposed 11 recent NovaVisionHub uploads; this is only a recent-upload window.
**Review method:** accessible page text and caption transcripts; audiovisual playback was not confirmed, transcript completeness varies, and source-by-source status is recorded below. Product statements are publisher claims unless separately verified.
**Status:** PSD import, rig setup, pin/sway deformation, and aligned timeline placement use the shared web/Tauri code path. For placed PSD layers with the matching rig active, the same Puppet mesh and resolved part translation/rotation/scale/opacity now render in Program Monitor playback and the live canvas used by export capture; PSD-rig X/Y transforms use document pixels. Browser E2E checks both time-varying sway and parent-to-hair translation. Native Tauri launch, encoded-export round trip, durable project save/load, full archive review, audiovisual playback, and automatic semantic segmentation are **not** verified/completed. Joint behavior on complex rigs and multiple-rig binding UX remain open. This file is the consolidated canonical study/checklist; there is no separate NovaVision research duplicate.

---

## 1. Executive summary

The requested tutorial describes a short, repeatable pipeline: import a layered character PSD, isolate/select each hair-strand layer, place about three Puppet pins, create a sway motion, tune its distance and speed, and repeat for the other strands. OmniFrame previously had a rigging panel, pin records, and a wind parameter, but pins did not deform the artwork and the panel did not apply wind to its preview. A `.psd` file was also not accepted by the media importer.

This update closes the most direct workflow gaps:

1. **Layered PSD import:** visible raster layers are imported as separate transparent image assets with names, layer offsets, document dimensions, and normalized opacity.
2. **Rig from PSD:** a one-action path makes the imported layers into rig parts, restores their positions, assigns front/back order, and suggests anatomical types from names.
3. **Puppet deformation:** three distributed pins can be added in one action; the shared triangular-mesh evaluator follows pin displacement in the Rigging preview and on placed PSD clips.
4. **Hair / cloth sway:** “Create sway” seeds pins if needed, enables distance/speed/direction controls, and starts the rig preview. Its per-part phase and clip-local motion now render on the main sequence too.
5. **Explicit timeline placement and animation:** users can place the original PSD layers as same-time, same-duration still clips, aligned in shared document space. With the matching PSD rig active, pin/sway and resolved part translation/rotation/scale/opacity render in the Program Monitor. PSD-rig X/Y values are in source document pixels. `exportVideo` captures that same live preview canvas; encoded-export motion parity has not yet had a round-trip test.
6. **Web + desktop code path:** these features use the shared React editor components and browser APIs used by both the web app and Tauri desktop shell. The browser path was tested; a native Tauri build/launch was not run here.

**Important boundary:** pin-driven deformation, sway, and the current Rigging resolver’s per-part transforms now reach placed PSD clips during sequence preview and the canvas-capture export path. Complex joint/pivot behavior, durable rig/project persistence, multiple-rig binding UX, and encoded-export parity remain unverified; the separate rotational Wind feature is still Rigging-preview-only. Imported PSD layers remain in the Media library until the user explicitly rigs or places them. The review also does not claim to have watched video frames: the research tool returned captions/page text, not audiovisual playback.

**Model decision:** no additional epochs, model merge, or new model training was performed. The repository already contains small custom OmniRoto models, but the current hair model is a single-mask saliency model trained with pseudo-labels; it does not output separate hair/eye/arm classes. Its metadata cites five raw images, and the training corpus is described as image-search material without per-image rights records. The present training script also has no checkpoint-resume path. More epochs are therefore neither a safe legal choice nor the right technical step for automatic layered-part segmentation.

---

## 2. Evidence and review method

### 2.1 What was reviewed

- Direct YouTube page/caption retrieval was used where available.
- The target hair tutorial’s complete 2:52 caption transcript was retrieved. A full textual transcript is available; audiovisual playback was not.
- The 2:47 After Effects project-import tutorial’s full caption transcript was retrieved.
- NovaVisionHub’s channel page did not provide a complete historical video listing. Its RSS feed at [`youtube.com/feeds/videos.xml?channel_id=UC0jFaVIChu_VbFJ2HFApJPQ`](https://www.youtube.com/feeds/videos.xml?channel_id=UC0jFaVIChu_VbFJ2HFApJPQ) exposed 11 recent uploads. That feed is a recent-upload window, **not** proof of a full archive scan.
- Several long-video transcript requests returned recommendations/player UI instead of later caption chunks. They are marked partial below.
- Product-video statements are treated as **publisher claims**, not independent feature verification.
- Some linked videos are After Effects training/collaboration material. Their technique is documented as reference workflow, not silently reclassified as a Nova Editor capability.

### 2.2 NovaVisionHub recent-feed ledger

| Video | Length | Caption/page coverage | Relevant observations |
| --- | ---: | --- | --- |
| [How to animate hair in Nova Editor](https://www.youtube.com/watch?v=cGwakSsyk1Q) | 2:52 | **Full caption transcript** | Layered PSD → separate hair-strand layer → about three Puppet pins → create sway → tune distance/speed → repeat for other strands. This is the direct implementation target. |
| [Import your After Effects project in Nova Editor](https://www.youtube.com/watch?v=d_Bhvl_ehE8) | 2:47 | **Full caption transcript** | Describes importing an AE project/archive with assets; warns for missing assets and offers replacement/relinking; claims preservation of effects, comps, keyframes, adjustment layers, and positioning. The captions do not define an XML schema or guarantee compatibility across AE versions. |
| [Tutorial: The Best Mobile App — NovaEditor](https://www.youtube.com/watch?v=bYeM_of-02s) | 9:58 | **Partial**; later chunks returned 401/player text | Opening portion mentions composition size/FPS/background, collaboration/extensions, performance/frame meter, layer visibility/isolation, speed/cuts, Puppet, duplicate/lock/presets, snapshots/grid/zoom, AI tools, library, effects, keyframes/graphs, camera/3D, and depth of field. Treat the remainder as unreviewed. |
| [How to Make Manga EDITs Like a PRO (Beginner Tutorial)](https://www.youtube.com/watch?v=VN_dUBPWqwk) | 16:47 | **Partial** | Captions describe a RAP Geek / composition workflow including parallax, shadows, Optical Flares, overlays, and light rays. This is editing technique; it is not a Nova Editor product specification. |
| [part 01](https://www.youtube.com/watch?v=-XlPwVdYeuA) | 22:18 | **Partial** | Opening captions cover an After Effects composition, layered PSD import, 3D layers/null scaling, parallax staging, and hair masking. Later transcript chunks were inaccessible. |
| [How to create advanced compositions in After Effects](https://www.youtube.com/watch?v=8JNRL8XIt7Y) | 40:27 | **Partial; first transcript chunk only** | Early captions cover 1920×1080/24fps setup, PSD/precomp, pivots at joints, position/rotation keyframes, and graph easing. Most of the long video was not retrieved. |
| [link na descrição! #aftereffects #premierepro](https://www.youtube.com/watch?v=acJ5kbVZpvY) | 0:45 | **Full short transcript** | Nova Vision Flow is pitched as a cloud asset library inside After Effects; search for PSDs, overlays, transitions, textures, PNGs, icons; no local bulk download required. Product-promo claim. |
| [17 de agosto de 2026](https://www.youtube.com/watch?v=VoMGktFyeOc) | 0:04 | Page/title only | No useful editing feature or transcript was available. |
| [watch what happened 💀](https://www.youtube.com/watch?v=d6_49cMOwvg) | 0:42 | **Full short transcript** | NovaVision Library promo: searchable PSDs, overlays, transitions, VFX elements, custom folders/favorites. Product-promo claim. |
| [The best IA Segmentation for manga animation!](https://www.youtube.com/watch?v=9oA3Z7fJyH0) | 0:36 | **Full short transcript** | Promotes separated/redrawn anime PSDs and library assets as a shortcut to masking hair, eyes, and arms. It does not disclose the segmentation model, data, accuracy, or API. |
| [NovaVision Library](https://www.youtube.com/watch?v=0tOvsjCS0mg) | 0:50 | **Full short transcript** | Promo claims 5,000+ assets, cut/separated PSD characters, overlays, transitions, particles, and other elements. Counts are publisher claims, not audited totals. |

### 2.3 Related team/collaboration videos used as context

These add product claims and practical editor workflows, but they are not proof of the complete NovaVisionHub channel history.

| Video | Coverage | What the accessible captions support |
| --- | --- | --- |
| [CapCut sucks, so I built my own video editor](https://www.youtube.com/watch?v=Jqy_eQ7c27A) — SnowProductions / NovaVisionHub collaboration | Full 5:07 transcript | Product pitch claims native 3D, depth maps, upscaling, background removal, rotobrush, character segmentation, beat marking, captions, sound-effect generation, 2D→3D, tracking, camera tracking, VFX and image/video generation, and an integrated cloud library. Also names effects. Treat all as stated/claimed capabilities, not independently tested. |
| [I got tired of Alight Motion so I made my own app](https://www.youtube.com/watch?v=QCxWb2NBAAg) — SnowProductions / NovaVisionHub collaboration | Full 5:23 transcript | Q&A claims Puppet/bones, vocal/instrument separation, pitch shift, automatic beat marking, time remapping, RSMB-style motion blur, depth maps, AI segmentation, collaboration, 4K export, subtitles, and a PC version under development. |
| [I tried editing in my own editing app LOL](https://www.youtube.com/watch?v=Z8ClfRyy4lM) — SnowProductions / NovaVisionHub | **Partial 14:09 transcript**; accessible through the hair section, later chunks returned recommendations | Direct workflow visible in captions: obtain PSD/background assets from the library, import PSD as separate layers, group layers, add effects/blend modes/particles, create a camera and parallax move, isolate hair layers, place Puppet pins, click “create sway,” repeat per hair strand. It ends mid-sentence during that sequence in the retrieved chunk. |
| [This style makes video editors rich](https://www.youtube.com/watch?v=m-_LQW0brxQ) — SnowProductions | **Partial 21:54 transcript** | Captions retrieved cover an After Effects 3D gaming-style build: textured planes, camera, lights/shadows, auto-trace/extrusion, anchor/group controls, posterize time, flicker, vignette, aberration, and optics. The rest is unavailable. |
| [How to Make TikTok Edits in After Effects](https://www.youtube.com/watch?v=bB5r17HrYRo) — SnowProductions | **Partial 15:56 transcript** | Captions cover manually marking kick beats, clip splitting, speed-graph easing, repeated shake/zoom/halftone/Twitch effect chains, opacity ramps, and copy/paste reuse. Not a Nova Editor capability test. |

### 2.4 Publisher feature, pricing, and workflow claims captured in launch/Q&A videos

The following are claims from the publisher’s launch and Q&A captions, not independently verified current product behavior. Prices and availability may have changed since publication.

| Tier as described in the videos | Publisher-stated examples |
| --- | --- |
| Free | Effects, 4K export, subtitles, depth maps, audio extraction, vocal/instrument separation, pitch shift, automatic beat marking, and no ads. |
| Paid / server-cost rationale | Real-time collaboration, background removal, image generation, in-app asset library, and some templates; a cited promo price was R$18/month or R$100/year. Treat as dated promotional pricing, not a current quote. |

The broader capability pitch also names native 3D (lights, 3D models, mapping video onto objects), depth maps, upscaling, rotobrush/background removal, character segmentation, beat marking, subtitles, generated sound effects, 2D-to-3D, video/camera tracking, VFX/image/video generation, an in-house “Nova Model 1,” Puppet/bone rigging, Twixtor-style time remapping, RSMB-style pixel-vector motion blur, plugin-like effects, and a cloud asset library. The matrix in §4 separates these statements from OmniFrame’s verified implementation; captions are not a feature-parity or quality benchmark.

### 2.5 Technique extraction from the selected editing tutorials

These are caption/page-text-supported editing techniques, not a claim that Nova Editor itself implements every technique. Several supporting videos are partial, as noted in the evidence ledger.

1. **MMV/manga composition:** common AE setup described as 1920×1080 at 24 fps; use pre-cut PSD layers, parent related parts to a null, and space layers in Z for parallax while scaling to fill.
2. **Rigging and animation:** place pivots at joints before rotation; animate limbs/head/details separately; ease motion in a graph editor; hair/capes use Puppet pins or duplicated cutouts. A displacement-map layer can soften paper-doll head-turn artifacts.
3. **Lighting/compositing:** captions describe shadow-only contact shadows, screen-blended flares, gradient overlays, light rays, curves/tint/tritone matching, particles, and blend modes.
4. **Parallax:** separate layers into depth, move an eased camera, enlarge layers to avoid uncovered frame edges, and use edge/motion-tile techniques where needed.
5. **Camera tracking:** one selected AE tutorial recommends high-resolution/high-frame-rate footage and a sharpen/detail-analysis pre-pass before solving; this is workflow advice, not a tested OmniFrame feature.
6. **Beat editing:** mark kicks, split on beats, ease speed/opacity, and reuse a per-beat shake/zoom/halftone/Twitch effect chain. This is manual kick marking in the tutorial, not evidence of automatic downbeat detection.

### 2.6 Market-positioning statements (creator opinion, not independent market evidence)

The selected videos argue that mobile-first editors want an accessible, all-in-one editor and that server-side AI, cloud assets, and collaboration justify a paid tier. They also suggest a content loop of style tutorials → asset library → editor automation. Treat these as the publisher’s thesis, not a market survey, verified pricing rationale, or evidence of product demand.

---

## 3. Target tutorial: complete hair-animation workflow

### 3.1 Demonstrated sequence

The linked 2:52 tutorial and the accessible segment of the 14:09 collaboration video agree on this workflow:

1. Start with a layered character PSD, preferably with hair already separated into strand layers.
2. Import the PSD with its layers kept distinct; identify/select one strand.
3. Add roughly three Puppet pins along that strand (root, middle, tip is the useful mental model).
4. Invoke the “create sway” operation.
5. Adjust the motion’s distance/amplitude and speed until it reads correctly.
6. Repeat for each independently moving strand.

The tutorial is a caption-based review; the exact pointer gestures, internal file format, model behavior, curve shape, and export path cannot be verified from the retrieved transcript alone.

### 3.2 OmniFrame implementation details

- **PSD parser:** [`src/lib/psdImport.ts`](../../src/lib/psdImport.ts) uses [`ag-psd`](https://github.com/Agamnentzar/ag-psd), an MIT-licensed JavaScript PSD reader. It runs only when a PSD is selected (dynamic import). Visible raster leaf layers become transparent PNG-backed Media assets. Each asset retains the PSD document id/name, layer name/order, original canvas size, layer offset/size, and normalized opacity. An E2E caught and fixed a reader-value mismatch: ag-psd exposes opacity in 0..1, so the previous raw-byte division made opaque layers nearly transparent.
- **Import UI:** Media and top-bar file pickers accept `.psd`; successful imports stay in the Media library and show a status notice. Importing does not silently populate the timeline.
- **Rig creation:** the Rigging panel has “Rig PSD layers.” It builds a part per imported visible layer, restores document-space bounds and z-order, infers common body-part names, and selects the first inferred hair part when available.
- **Timeline placement:** “Place aligned layers on timeline” creates one same-start, same-duration still-image clip per visible layer on a stacked video track, inserts them as one undoable operation, and switches back to the Program Monitor. `src/lib/playback.ts` fits every crop against the original PSD canvas and applies its original left/top offset, so the layers align and composite in PSD front/back order. When a matching PSD rig is active, its pins/sway and resolved part translation/rotation/scale/opacity are evaluated at clip-local time. X/Y transforms are mapped from PSD document pixels. Browser E2E shows sway across six playhead samples and confirms a head-parent translation moves its hair child in the Program Monitor.
- **Pins/deformation:** “Add three hair pins” places three distributed pins (or fills the count up to three). The shared mesh evaluator applies localized pin displacement in both the rig canvas and main sequence renderer. Static pin offsets and time-varying sway are both rendered.
- **Sway:** “Create sway” enables an eased sinusoidal tail motion, adds pins if needed, and starts the rig panel’s preview. Distance and speed sliders, plus side-to-side/up-down direction, are exposed. The same per-part seed and local-time evaluation now drive placed PSD clips; the existing rotational Wind control remains separate and preview-only.
- **Shared platform path:** the importer and panel are React/browser code, shared by web and Tauri. No platform-specific AI service or remote URL is required. Native Tauri UI launch was not executed in this review.

### 3.3 PSD import boundaries

Current safeguards: `.psd` only (not `.psb`), 256 MB source-file cap, 100-megapixel document cap, 160-megapixel aggregate visible-layer raster cap, and 300 visible raster-layer cap. Hidden layers are skipped; group containers are flattened into their visible raster descendants while retaining child order. Layer offsets, dimensions, names, and opacity are applied.

This is **not** Photoshop round-trip fidelity. ag-psd documents limitations around some color modes, 16-bit/PSB files, newer Photoshop constructs, text, vector/smart-object rendering, effects, and blending. Import does not reconstruct live PSD masks/effects, provide relinkable embedded smart objects, or persist the original PSD across reloads. It does not auto-create clips; the separate timeline action explicitly places aligned still layers, whose pin/sway motion follows the active matching PSD rig. The source PSD is not modified.

---

## 4. Broader demonstrated feature inventory

Evidence is categorized so a tutorial technique or marketing statement is not mistaken for a shipped feature.

| Feature area | What captions/demo claim or show | OmniFrame status / recommended interpretation |
| --- | --- | --- |
| **Layered art / PSD** | PSD characters can be imported as separate layers, grouped, positioned, and animated; library promos emphasize pre-cut PSDs. | PSD raster import, rig seeding, aligned layer-clip placement, and active-rig pin/sway plus per-part transforms are implemented. Full Photoshop fidelity, complex joint/pivot validation, and project persistence remain open. |
| **Puppet / hair** | Select a strand, add pins, create sway, tune distance/speed, repeat. A collaboration caption shows the same flow. | Pin mesh warp, sway, and current resolver-based parent transforms render in the Rigging preview and, for placed PSD clips with a matching active rig, in Program Monitor and the shared export-capture canvas. Encoded-export parity and complex joint/pivot behavior remain open. |
| **Composition setup** | Mobile overview opening mentions preset/custom dimensions, FPS, background, and performance/frame meter. | Transcript is partial. OmniFrame already has project/sequence settings; parity should be checked against its current UI and persisted project behavior. |
| **Layer operations** | Visibility/isolation, speed, cut positions, copy/duplicate, lock, save-as-preset, snapshots, grid and zoom are mentioned in the partial overview. | Product-level audit needed. The transcript does not prove exact semantics or whether every control ships. |
| **Keyframes / graph** | Keyframes and graph editing are mentioned in the overview; AE tutorials demonstrate joint pivots, rotation/position keyframes, easing, and camera moves. | OmniFrame has a graph editor and clip animation engine. The rig model is still a separate preview object rather than timeline-keyframed character parts. |
| **2.5D camera / parallax** | PSD layers are placed at different depth, camera zooms and eased keyframes create parallax; layer scale compensates for depth. | OmniFrame has 3D tools, but a PSD-to-parallax staging wizard is not in this change. Treat AE captions as technique, not proof of Nova’s mobile camera implementation. |
| **Effects / compositing** | Collaborator applies effects, blend modes, adjustment layers, particles, glow, distortion, shadows, gradients, overlays and light effects. | Effects and adjustment layers exist in OmniFrame. The transcript is not an effects compatibility specification. Individual effect names shown from third-party AE are not guaranteed Nova effects. |
| **AEP/project import** | AE project/archive import, missing-asset warnings, relink/replace, and claimed preservation of effects/comps/keyframes/adjustment layers/positions. | Research only. No AEP parser/importer was added. The transcript does not define an XML schema or promise support for all AE plugins. |
| **Segmentation / background removal** | Promos describe separate hair/eyes/arms, ready PSDs and in-house AI segmentation; product videos claim character segmentation, rotobrush, background removal and upscaling. | OmniFrame has click/mask/roto and small ONNX segmentation models. No evidence supports Nova model parity or automatic semantic decomposition from this transcript. |
| **Audio** | Product Q&A claims vocal/instrument separation, pitch shift, automatic beat marking, subtitles and sound-effect generation. | OmniFrame has local Demucs four-stem isolation, VAD-based slowed-edit correction, an optional natural-pitch vocal output, estimated key/BPM with editable (not downbeat-verified) markers, detected vocal-range suggestions for user review, same-time instrumental-stem patching with crossfades, and independent pitch/tempo rendering. E2Es verify wiring and synthetic DSP behavior—not DeVoice parity or perceptual quality; subtitles and generated-SFX parity remain unverified. |
| **Time remapping / motion blur** | Product Q&A claims Twixtor-like time remapping and RSMB-like motion blur, describing pixel motion vectors; another video mentions depth maps. | Research only here. No new time-remap/RSMB/depth-map code was added in this task. Require optical-flow quality tests and export parity before any claim. |
| **Native 3D / tracking** | Product pitch claims 3D models/lights, camera/object tracking, 2D-to-3D, depth maps, VFX and creation tools. | OmniFrame has a Three.js scene and tracking tools. Product-parity scope is large; this research does not certify those claims. |
| **Cloud asset library** | Flow promos pitch searchable cloud PSDs, overlays, transitions, textures, icons, particles, 3D assets and custom folders/favorites. | OmniFrame has no authenticated NovaVision cloud integration. Do not scrape or copy their assets. A local user-owned asset library is a separate possible product feature. |
| **Collaboration / extensions** | The partial mobile overview mentions beta collaboration/extensions; product Q&A claims real-time collaboration and server-side paid AI/library options. | These are publisher statements. OmniFrame's present local editor code does not implement NovaVision services or a real-time collaborative backend. |

### 4.1 Real-track voice-isolation evidence and remaining quality gap

The DeVoice reference MP3s are absent from the current working tree but remain recoverable from Git commit `22ecf32` (`Vocal_1791637488052.mp3` and `Other stems_1791637479716.mp3`). On 12 Oct 2026, they were extracted to `/tmp` with `git show`—without restoring the binaries into the worktree—and the first-minute comparison was rerun. The sum of the two stems matches the first **60.00 seconds** of `UPAST (Ultra Slowed) - HELLBLADE.mp3` (108.25 seconds): 100 ms log-RMS envelopes correlate at **0.9894**; full-rate mono correlation peaks at **0.9881** after aligning a **576-sample / 13.06 ms** stem delay (zero-lag correlation is −0.177 because of that delay). This identifies the likely reference source; it does not establish separator quality. Reproduce with [`qa/devoice_reference_study.py`](../../qa/devoice_reference_study.py) and see [`qa/reports/devoice-reference-study.json`](devoice-reference-study.json).

A fresh run of the same Silero-based heuristic on the matched 60-second window reports DeVoice at **85.5% vocal-like energy / 72.0% voiced frames**; the DeVoice `other` stem scores **0.1% / 0.0%**. The first 60.00 seconds of OmniFrame's existing v3 timeline-aligned output score **46.5% / 35.8%**, a gap of 39.0 and 36.3 percentage points respectively. The full-track v3 report remains **43.2% / 28.8%** at the slowed time base (**+2.7 dB of this VAD energy metric vs direct v1**, which measured 23.2% / 13.0%). A previous one-pass HTDemucs v4 CPU/WASM run measured **50.9% / 42.5%** on non-overlapping 8-second slices; it was not rerun in this turn. These VAD values are directional heuristics, not separation ground truth or a substitute for listening. The v3 **natural-pitch** output measured **87.7% / 65.0%**, but is only 74.66 seconds rather than the original 108.25 seconds, so it is not an apples-to-apples timeline-aligned comparison. The separate five-second synthetic mix passes model metrics; that is not evidence of real-song parity.

**Existing slowed-edit workflow:** the app’s Silero detector scans candidate speed factors, corrects the separation speed, and restores timeline timing; an optional “natural pitch” output keeps the recovered vocal at the corrected, shorter duration. A fresh E2E run on 12 Oct recorded **18/18 passing assertions**: it picked ×1.45 on the 108-second track, preserved exact timing, improved the current 4-second buried-vocal excerpt from 50.1% to 68.7% voice-like energy, and retained no-op guards for voiced and instrumental inputs. One initial rerun crashed at longer model windows; shortening action fixtures below the model’s chunk stride made the suite pass at one pass. `public/models/htdemucs.onnx` is fetched locally for testing but Git-ignored; clean checkouts need `npm run fetch:demucs` (the weights have personal/research-only terms).

**Interval patching:** the four-stem action estimates candidate vocal ranges from the separated vocal stem with Silero, maps them back to source time, and asks the user to review/edit them. The patch replaces selected intervals with the **same-time aligned instrumental stem** using a raised-cosine crossfade. Mocked workflow and synthetic patch E2Es pass; this is not phrase retrieval from an external library, and VAD ranges still need listening review. The standalone beat-tempo script also exposed a strong 117.5/58.7 BPM half-time alias on UPAST, so it now reports ambiguity rather than claiming the track is at normal speed; the app’s slowed-edit decision is based on voice detectability, not BPM alone.

**Conclusion:** the real slowed/reverb DeVoice-quality gap remains a primary target; none of the metrics establishes parity. “upfast.p3” may refer to a different supplied file—confirm only if the repository’s matched UPAST track is not intended. Full method/caveats are in [`docs/AUDIO-TOOLS-RESEARCH.md`](../../docs/AUDIO-TOOLS-RESEARCH.md).

Related open-source editor references are summarized in [`docs/ADJUSTMENTS-AND-LOOKS-RESEARCH.md`](../../docs/ADJUSTMENTS-AND-LOOKS-RESEARCH.md): FilmCraft is the prioritized color-grading/NLE reference, while EffectCraft informs layer-based effect-stack and preset workflows. No code or assets from those projects are copied into OmniFrame.

---

## 5. Model options, licensing, and training decision

### 5.1 Candidate comparison

| Candidate | Useful capability | License / rights notes | Fit for the hair-layer workflow |
| --- | --- | --- | --- |
| **OmniRoto hair/anime models already in this repo** — [`public/models/omni-roto-hair-v1.json`](../../public/models/omni-roto-hair-v1.json), `omni-roto-anime-v1.onnx` | Small, local, browser-friendly binary saliency masks. Hair metadata reports 142,001 parameters, 128×128 input, 12 epochs, 240 augmented samples, 5 raw images, and `valIoU: 0.8878`; pseudo-label teacher is OpenCV GrabCut. | Sidecar declares MIT, but [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md) says the raw corpus came from image search and is not redistributed. No per-image rights manifest is present in the working tree; `training_data/` is absent here. A model-code license does not independently clear training-image rights. | Can propose one foreground-ish mask; it does not output named hair strands, eyes, arms, etc. It is not an automatic layered-character importer. The tiny image count and same-source augmented validation split make the reported IoU unsuitable as a broad quality claim. |
| **MobileSAM already bundled** — [MobileSAM](https://github.com/ChaoningZhang/MobileSAM) | Promptable point/box masks; OmniFrame has encoder/decoder ONNX weights for local RotoMask interaction. | Upstream repo is Apache-2.0; preserve attribution/model notices and verify the exact checkpoint provenance. | Useful as a human-guided cutout assistant, not an anime semantic parser. User still needs to identify each strand/part. |
| **Meta SAM 2 / 2.1** — [Meta announcement](https://ai.meta.com/blog/segment-anything-2/) and [official repo](https://github.com/facebookresearch/sam2) | Promptable image/video object masks; video propagation is relevant to tracking a manually selected object. | Meta announced code and weights under Apache-2.0; re-check the exact checkpoint/revision notice at adoption time. | Strong mask/track baseline, but not semantic labels for hair vs. skin and not “one click = separate every strand.” Full model/runtime, memory, WebGPU/CPU, and browser export costs need benchmarking. |
| **Anime-Segmentation (SkyTNT)** — [repository](https://github.com/SkyTNT/anime-segmentation) / [model card](https://huggingface.co/skytnt/anime-seg) | Anime-character foreground segmentation with several supported architectures and ONNX export instructions. | Repository declares Apache-2.0. Its README says the training dataset combines AniSeg and character-background data and was cleaned with DeepDanbooru; that software license does not establish image/annotation redistribution rights. Audit the exact weights and dataset terms separately. | Foreground mask, not named limbs or multiple hair strands. Could be tested as an optional anime cutout model only after weight/data review. |
| **Anime face semantic segmentation** — [siyeong0/Anime-Face-Segmentation](https://github.com/siyeong0/Anime-Face-Segmentation) | UNet, 512×512 input, seven classes: background, hair, eye, mouth, face, skin, clothes; repository added an MIT license in 2025. | The repository license is not a complete provenance statement for its checkpoint, pretrained encoder, or training images. Verify these before bundling/serving weights. | Most directly semantic for face/hair color labels, but face-only, older/small, and not strand-instance segmentation; no established OmniFrame ONNX/browser benchmark. |
| **Nova Model 1** (NovaVisionHub creator claim) | Described in collaboration captions as an in-house image segmentation model that cuts images into pieces. | No public weights/model card, architecture, training data, benchmark, license, or API was accessible in the reviewed sources. | Cannot legally or technically reproduce or benchmark from captions. Do not claim compatibility or infer its implementation. |

Sources for model facts: [Meta SAM 2 announcement](https://ai.meta.com/blog/segment-anything-2/), [SkyTNT anime segmentation README](https://github.com/SkyTNT/anime-segmentation), [SkyTNT anime model card](https://huggingface.co/skytnt/anime-seg), [Anime Face Segmentation repository](https://github.com/siyeong0/Anime-Face-Segmentation), [MobileSAM repository](https://github.com/ChaoningZhang/MobileSAM).

### 5.2 Is additional training technically feasible?

**Yes in principle, but not as “turn the epoch count up” for the requested result.** The repository’s [`scripts/python/train_roto_models.py`](../../scripts/python/train_roto_models.py) can run a chosen number of epochs for a domain and export ONNX. It initializes model parameters from scratch and does not expose a checkpoint-resume/pretrained-checkpoint argument. Its current target is a single foreground/saliency mask; separate named part masks need a new multi-class/instance-label task, data schema, loss, and export path. Additional epochs on that one-mask target cannot turn it into a layer separator.

The current metadata reports only five raw hair images and a synthetic/augmented sample count. The code creates many augmented patches and splits those patches into train/validation, so crops from the same source images can occur on both sides of that split. The resulting validation score is not an independent-character generalization test. The raw `training_data/` corpus is not present in this checkout, and no per-image source/license manifest was found.

### 5.3 Legal and technical gate before any custom model

No retraining, ensembling, or weight redistribution is authorized by this research note. Proceed only after all of these are true:

- [ ] Each source image/PSD has a documented creator, acquisition path, explicit training permission, and redistribution/commercial-use decision.
- [ ] The model, base checkpoint, code, labels, and any synthetic assets have separately reviewed licenses; do not infer data rights from the code license.
- [ ] Training/test splits are grouped by source artwork/artist/series, not random augmented crops from the same image.
- [ ] Labels match the goal: instance masks per movable strand/part, not one foreground silhouette; mask overlaps/occlusion and invisible inpainted regions have a documented policy.
- [ ] A held-out validation set and a human-review protocol are established before training; report per-class IoU, boundary quality, failure cases, latency, peak memory and output size.
- [ ] A checkpoint-resume path, reproducible seed/config, optimizer schedule, early stopping and ONNX parity tests are added before “additional epochs” are attempted.
- [ ] The model is benchmarked in both browser and desktop runtimes on realistic PSDs; model weights remain outside Git unless their size and license require otherwise.

**Decision for this turn:** do not train or merge models. Use the manual layered-PSD workflow for artist-provided assets, and treat SAM/MobileSAM as optional future point-prompt helpers rather than automatic semantic part extraction.

---

## 6. Implementation checklist by feature

Status legend: **Done** = implemented and tested here; **Partial** = present with stated gaps; **Not started** = no implementation in this change; **Research only** = documented claim, not product verification.

### A. Layered PSD import — **Done, with format limits**

- [x] Add `.psd` to Media and top-bar pickers.
- [x] Parse visible raster leaf layers into separate transparent PNG Media assets.
- [x] Retain source document/layer name, order, original document size, crop dimensions, and x/y offset.
- [x] Skip hidden layers and flatten visible group descendants without duplicating a group composite.
- [x] Show import success/error notice and identify PSD layers in the Media panel.
- [x] Avoid automatic timeline insertion; preserve the editor’s “import to library only” behavior.
- [x] Add size/memory safeguards: 256 MB file, 100 MP document, 160 MP aggregate raster area, 300 visible layers.
- [x] Run a generated two-layer PSD fixture through the real browser import path.
- [ ] Add fixtures for nested groups, hidden ancestors, non-255 opacity, zero/negative offsets, complex blend modes, 16-bit files, and malformed/truncated PSDs.
- [ ] Support PSB, editable text/vector/smart-object semantics, PSD effects/blending fidelity, and persisted original-source relinking.

### B. Rig a layered PSD — **Done for visible raster layers**

- [x] Provide a “Rig PSD layers” action in Rigging with a document selector.
- [x] Create one rig part per imported layer and preserve layer bounds/z-order.
- [x] Infer common part types (`hair`, `head`, `face`, limbs, clothing) from names and select a hair part when available.
- [x] Test two-layer rig construction and retained hair-layer offset in a browser E2E test.
- [ ] Add a layer-to-part review screen for ambiguous names and manual kind/side mapping before creating the rig.
- [ ] Test source PSDs with real-world nested group hierarchies and wide layer-name variations.
- [x] Offer explicit “Place aligned layers on timeline”: one synchronized still clip per visible layer, shared document-space fit/offsets, front/back compositing, Program Monitor switch, and atomic undo/redo.
- [x] When the matching PSD rig is active, reuse its source-linked pin/sway and resolved part transforms on placed clips in sequence playback and the canvas stream used by export; PSD X/Y uses document pixels.
- [x] Browser E2E checks the overlap pixel, six time-varying sway samples, and parent-to-hair translation through the Program Monitor.
- [ ] Add explicit rig-to-sequence binding UI when multiple rigs share one PSD document; validate rotation/scale/pivot behavior on complex licensed PSDs.

### C. Puppet pins / mesh deformation — **Rig preview + active PSD sequence path**

- [x] Add up to three distributed hair pins in one undoable store operation.
- [x] Keep click-to-place and drag-to-move pins available.
- [x] Render pin influence with a Gaussian falloff on a subdivided triangular mesh; artwork changes with the pin offsets.
- [x] Keep pin coordinates local to the imported layer crop and display them in that layer’s bounds.
- [x] Unit-test local displacement, influence falloff, fixed hair root, and time-varying tip movement.
- [ ] Tune mesh density/influence radii on detailed strand artwork and large layers; the current preview uses a lightweight bounded grid.
- [x] Integrate Puppet pin/sway mesh deformation for the active matching PSD rig into Program Monitor playback and the shared canvas-capture export renderer; browser E2E verifies time-varying pixels.
- [x] Apply the active PSD rig's resolved per-part translation, rotation, scale, and opacity in the timeline renderer; X/Y transform values are document-space pixels.
- [ ] Add a recorded-export round-trip test, durable project persistence, and explicit rig binding/relink UX for documents with multiple rigs.
- [ ] Add a public pin radius/rigidity control and test overlapping pins, extreme drags, and degenerate/transparent layers.

### D. Hair sway controls — **Rigging preview + placed PSD sequence playback**

- [x] Add “Create sway”; seed missing pins, enable pin-driven motion, and start preview playback.
- [x] Expose sway distance, speed, and horizontal/vertical direction.
- [x] Use a relatively fixed root and increasing tip travel, with phase variation between pins.
- [x] Keep the existing rotational Wind control distinct from the new Puppet-pin displacement motion.
- [x] Verify the controls change saved rig settings and that canvas pixels are redrawn at different times.
- [x] Reuse a stable per-part phase seed and clip-local time for placed PSD layers; a browser E2E verifies the Program Monitor changes across six timeline samples.
- [ ] Add sway presets (subtle breeze, slow drift, energetic bounce) and keyframe/curve editing.
- [ ] Add a MediaRecorder round-trip test comparing exported frames with the Program Monitor; keep deterministic offline export and broader render-parity claims open.

### E. Web and desktop parity — **Shared path implemented; web tested**

- [x] Use one React component/parser path for browser and Tauri desktop.
- [x] Keep PSD decoding local; no network service or proprietary Nova API is required.
- [x] Build the web bundle and run the browser PSD/hair E2E.
- [ ] Run a Tauri native build/launch and repeat the import/rig/sway flow on the target OS/WebView.
- [ ] Verify desktop memory limits, file picker behavior, and object-URL lifetime with large PSDs.

### F. Timeline, Program Monitor, project persistence, and export — **Partial: active PSD rig transforms render; durability/export checks open**

- [ ] Persist rigs and source-asset links through project save/load; current runtime rig state is not a verified durable project format.
- [x] Provisional representation: a PSD rig stays a project-level record linked to source layers; explicit placement creates synchronized still clips and resolves the active matching rig by PSD document/source asset.
- [x] Evaluate Puppet pin/sway and resolved per-part translation/rotation/scale/opacity at the main sequence playhead; browser E2E confirms a parent translation carries to the hair layer.
- [ ] Validate joint/pivot semantics on complex real PSD hierarchies; add explicit rig selection/binding when multiple rigs share a document.
- [ ] Add layer selection and pin editing over the main preview.
- [x] Use the same PreviewEngine draw path for Program Monitor and live export-capture canvas.
- [ ] Record an export round trip and compare decoded frames with the preview.
- [ ] Implement deterministic offline rendering, nested/compound sequence behavior, range rendering, and explicit audio/video synchronization tests for animated rigs.
- [ ] Test reopening a project without the original PSD file and provide clear missing-source recovery.

### G. AEP / project / XML import — **Research only**

- [ ] Obtain a legally distributable test project containing assets, comps, keyframes, adjustment layers, and representative effects.
- [ ] Define supported After Effects versions and distinguish native `.aep` parsing from an exported interchange/XML format.
- [ ] Implement archive/project parsing and asset manifest extraction without executing project scripts.
- [ ] Show a preflight report with missing/unsupported assets, effect compatibility, and relink/replace actions.
- [ ] Preserve project graph, nesting, keyframes, layer order, transforms, and adjustment layers where semantics map cleanly.
- [ ] Warn rather than silently approximate unsupported plugins/expression scripts.
- [ ] Add round-trip fixture tests and compare rendered frames against a reference export.

### H. Automatic semantic segmentation / custom models — **Research only; training intentionally deferred**

- [ ] Verify source/checkpoint/dataset licensing and model-card provenance before downloading or bundling weights.
- [ ] Benchmark current OmniRoto and MobileSAM on user-owned anime/manga PSDs; report mask accuracy and user corrections.
- [ ] Define whether the desired target is whole-character mask, semantic class mask, instance-separated limbs, or individual hair strands.
- [ ] Build consented, properly licensed ground-truth data with one annotation mask per movable part.
- [ ] Add independent artist/character holdouts and per-class edge/IoU evaluation.
- [ ] Add checkpoint continuation and multi-class/instance training only if the dataset and target justify it.
- [ ] Convert to ONNX, verify browser/desktop parity, memory and runtime, and publish notices/model card.
- [ ] Do not claim parity with Nova Model 1: its weights, training data, and benchmark are not public in the reviewed sources.

### I. Other creator-video features — **Existing partial implementations audited; full Nova feature parity is not claimed**

- [ ] Composition presets/custom dimensions/FPS/background and frame-rate/performance meter: visually audit exact controls; the source says 120 FPS was planned, not that it shipped.
- [x] Core timeline/layer operations: browser QA covers media import/drop, locks, trims/splits, undo/redo, snapping, zoom/ruler, export and lifecycle. **Still audit:** duplicate/group/preset save, frame snapshots, visibility/isolation, and mobile-specific gestures.
- [x] Keyframe/graph workflow: browser QA covers position/rotation keys, graph/value/speed modes, easing presets, handles and keyframe deletion.
- [x] LUT/effect-layer placement: the side rail visibly labels the entry “LUT” (8px badge) and the panel exposes “LUT looks · 25”; desktop visual inspection and QA cover the bundled catalog, clip-scoped grading, uploaded LUT stacking, adjustment-layer order/matte, selection border and persistence.
- [x] Local key/BPM estimate and editable beat-grid insertion: synthetic C-major/120 BPM fixture yields 24 beats and inserts purple markers at the clip offset; repeat insertion avoids nearby duplicates.
- [ ] Kick/downbeat/onset accuracy: validate against multiple genres, changing tempo, syncopation, swing, pickups and existing manual markers; the current grid is an estimate, not verified downbeat detection.
- [x] Slowed-edit correction: Silero scans candidate rates, speed-normalizes before Demucs, restores aligned timing, and offers a separate natural-pitch output. The 12 Oct memory-safe real-track E2E assertion run is 18/18 passing; DeVoice-quality parity remains open.
- [x] Vocal-interval review and patch: four-stem separation proposes VAD ranges; users may edit/add/exclude ranges, then patch selected spans with the same-time aligned instrumental stem and crossfade. E2Es cover mocked stem handoff and synthetic donor alignment; phrase retrieval from a separate library is not implemented and real-song concealment still needs listening validation.
- [x] Independent pitch-preserving pitch shift and tempo rendering: Audio dock offers ±12 semitones and 50–150% tempo separately; synthetic-tone E2E verifies frequency and duration remain independent. **Still open:** listening/quality benchmarks on complex music and voice at wide shifts; this is not a parity claim for VocalRemover or a studio-grade engine.
- [ ] Subtitles, generated SFX and automatic speech transcription: define artifact/quality tests before claiming parity.
- [ ] Time remapping, optical-flow/RSMB-like motion blur, depth maps and 2D-to-3D: measure artifacts, temporal stability, speed and export parity.
- [x] Existing Three.js/3D workflow: QA verifies scene/camera controls, safe-frame/aspect sync, 3D-in-2D video plane and continued playback. **Still open:** Nova-specific scene UX/effects, tracking quality and full final-export parity.
- [ ] Cloud library/favorites/custom folders, real-time collaboration, and server-side AI: define privacy, licensing, sync, moderation, availability, cost and offline behavior before implementation.

---

## 7. Verification record

| Check | Result |
| --- | --- |
| `node qa/rigging-unit.mjs` | **49 passed / 0 failed**; hierarchy, pivots, bend/wind, pin falloff, sway sampling and naming. |
| `BASE=http://localhost:5173 npm run qa:psd-hair` | **24 passed / 0 failed** on 13 Oct: nested PSD import/hidden-layer skipping, pixel colors/full/half opacity/offsets, rigging/pins/sway, synchronized placement, Program Monitor alignment/front-to-back order, active-rig sway (34.826 px hair-centroid range over six timeline times), parent-to-hair translation (68.009 px centroid shift for +4 PSD px), atomic undo/redo, no browser errors. |
| `BASE=http://localhost:5173 node qa/rigging-smoke.mjs` | **15 passed / 0 failed**; previous rig creation, auto-rig, parent links, character seeding, no browser errors. |
| `npm run typecheck` | Passed on 13 Oct after PSD-rig document-space X/Y controls and resolved per-part translation/rotation/scale/opacity were added to timeline rendering, alongside the shared Puppet mesh and aligned PSD placement. |
| `npm run build` | Passed on 13 Oct with PSD pin/sway and resolved part transforms in the timeline renderer; pitch/tempo Worker emitted as a separate 25.73 kB asset. Existing large main-chunk and ineffective dynamic-import warnings remain; PSD reader stays in its separate on-demand chunk. |
| `URL=http://localhost:5173/#studio npm run qa:adjustments` | Passed: persistent 8px side-rail LUT badge, visible 25-look gallery, clip-scoped grade isolation, uploaded LUT stacking, adjustment matte/order, selection border and persistence/delete controls. Desktop panel was visually inspected. |
| `npm run qa:advanced` | **43 passed**; media import/drop, clip lock, trim/split, snapping/zoom/ruler, undo/redo, export and lifecycle cleanup. Playwright’s bundled FFmpeg was missing; a local cache symlink to the installed FFmpeg was used. |
| `TEST_URL=http://localhost:5173/#studio node qa/keyframe-graph-3d-e2e.mjs` | Passed keyframe graph/easing controls, 3D camera safe frame/aspect update, object controls and scene selection/mask workflow. |
| `TEST_URL=http://localhost:5173/#studio node qa/three-d-video-plane-e2e.mjs` | Passed 3D-in-2D video-plane controls, primitive/grid controls and continued video playback. |
| `npm run qa:audio-analysis` | Passed: synthetic C-major/120 BPM analysis returns 24 beat times, inserts offset purple markers, and avoids nearby duplicates on repeat. |
| `TEST_URL=http://localhost:5173/#studio npm run qa:audio-pitch-tempo` | Passed: 440 Hz stereo +12 semitones / 120% tempo measured near 880 Hz at 0.833 s; 80% tempo kept ≈440 Hz at 1.25 s; formant-aware voice mode shifted +7 semitones at 1.0 s. Default source muting and source retention verified. |
| `URL=http://localhost:5173/#studio node qa/audio-waveform-e2e.mjs` | **9 passed**; 256-bin waveform reflects decoded amplitude, clip volume and mute. |
| `node qa/loudness-normalization-e2e.mjs` | **7/7 passed**; BS.1770 LUFS anchor and normalization to −16/−24 LUFS. |
| `URL=http://localhost:5173/#studio node qa/marker-audiometer-e2e.mjs` | **19 passed**; master VU/volume/mute plus marker create/seek/edit/delete. |
| `npm run qa:audio-recorder` | Passed: mocked capture/permission error, EQ/reverb, WAV asset/waveform and timeline insertion. |
| `npm run qa:audio-patch` | Passed: selected-range donor replacement, untouched samples and synchronized state. |
| `TEST_URL=http://localhost:5173/#studio node qa/audio-demucs-stems-e2e.mjs` | Passed: mocked separator drives the four-stem timeline, VAD range mapping, user-approved patch handoff and source/stem muting; not a neural-quality test. |
| `TEST_URL=http://localhost:5173/#studio node qa/audio-vocal-patch-e2e.mjs` | Passed: synthetic patch preserves unselected samples and uses the time-aligned instrumental donor. |
| `npm run qa:audio-panel` | Passed Audio dock controls and sequential multi-clip flow. |
| `node qa/voice-isolation-e2e.mjs` | **30 assertions passed** for sidebar/modal, keep/remove flows, assets/clips, waveforms and runtime errors (fast DSP path). |
| `TEST_URL=http://localhost:5173/#studio node qa/voice-demucs-model-e2e.mjs` | Re-run 12 Oct: **6/6 passed** on the five-second synthetic mix (18.19 dB SI-SDR, −46.30 dB music bleed); not a real-song or DeVoice-quality claim. |
| `TEST_URL=http://localhost:5173/#studio node qa/voice-slowed-fix-e2e.mjs` | **18/18 passed** on 12 Oct: full-track ×1.45 detection, synthetic correction, one-pass real action on 4 s excerpts, exact timing, natural-pitch option, instrumental no-op, resampler, native DSP and model-progress checks. |
| `python3 qa/voice_realtrack_study_test.py` | **4/4 passed**; strong 2:1 tempo alias is reported as ambiguous, not normal-speed. |
| `python3 qa/voice_realtrack_study.py speed 'UPAST (Ultra Slowed) - HELLBLADE.mp3'` | Run: 117.5 BPM (0.80) and 58.7 BPM (0.76) trigger an explicit half/double-time ambiguity warning. |
| `python3 qa/devoice_reference_study.py` | Reproduced 12 Oct from DeVoice MP3s extracted from Git history: 0.9894 envelope correlation, 0.9881 aligned sample correlation at 13.06 ms; DeVoice VAD 85.5% / 72.0% vs OmniFrame v3 46.5% / 35.8%. See JSON; heuristic only. |
| `npm audit --omit=dev --audit-level=moderate` | **0 production dependency vulnerabilities**. A clean `npm ci` reports 8 dev-inclusive findings (2 moderate, 6 high); those development-tool findings were not remediated in this change. |
| `git diff --check` | Passed on 13 Oct; no whitespace errors. |
| Tauri native build / launch | Not run. Shared source path is implemented, but native runtime parity remains an explicit checklist item. |
| Audiovisual video review | Not performed/available through the caption-fetch path. This report relies on captions/page text and documents partial retrieval. |

---

## 8. Source register

- [Hair-animation tutorial](https://www.youtube.com/watch?v=cGwakSsyk1Q)
- [AEP/project-import tutorial](https://www.youtube.com/watch?v=d_Bhvl_ehE8)
- [Nova Editor mobile overview](https://www.youtube.com/watch?v=bYeM_of-02s)
- [RAP Geek composition tutorial](https://www.youtube.com/watch?v=VN_dUBPWqwk)
- [Beginner composition, part 1](https://www.youtube.com/watch?v=-XlPwVdYeuA)
- [Advanced After Effects compositions](https://www.youtube.com/watch?v=8JNRL8XIt7Y)
- [Nova Vision Flow short](https://www.youtube.com/watch?v=acJ5kbVZpvY)
- [17 August short](https://www.youtube.com/watch?v=VoMGktFyeOc)
- [Nova Vision Library short](https://www.youtube.com/watch?v=d6_49cMOwvg)
- [AI segmentation / library short](https://www.youtube.com/watch?v=9oA3Z7fJyH0)
- [NovaVision Library promo](https://www.youtube.com/watch?v=0tOvsjCS0mg)
- [Editing in the Nova app collaboration](https://www.youtube.com/watch?v=Z8ClfRyy4lM)
- [CapCut / Nova Editor product pitch](https://www.youtube.com/watch?v=Jqy_eQ7c27A)
- [Alight Motion / Nova Editor product Q&A](https://www.youtube.com/watch?v=QCxWb2NBAAg)
- [After Effects gaming-style tutorial](https://www.youtube.com/watch?v=m-_LQW0brxQ)
- [TikTok edit tutorial](https://www.youtube.com/watch?v=bB5r17HrYRo)
- [NovaVision creator tools site](https://links.novavisionlibrary.com/)
- [ag-psd source and license](https://github.com/Agamnentzar/ag-psd)
- [MobileSAM source](https://github.com/ChaoningZhang/MobileSAM)
- [Meta SAM 2 release/license announcement](https://ai.meta.com/blog/segment-anything-2/)
- [SkyTNT anime segmentation](https://github.com/SkyTNT/anime-segmentation)
- [Anime face semantic segmentation](https://github.com/siyeong0/Anime-Face-Segmentation)

---

## 9. Recommended next steps

1. **Complete rig-sequence parity:** persist explicit rig bindings, validate joint/pivot behavior on complex PSDs, and round-trip an encoded export against Program Monitor frames.
2. **Test real licensed PSDs:** nested groups, hidden layers, masks, opacity, transparency, unexpected dimensions, and recovery after reload.
3. **Complete the video scan only with an actual listing/source:** obtain a reliable complete NovaVisionHub upload inventory, retrieve the remaining transcripts, and keep “caption reviewed” distinct from “watched.”
4. **Audit model rights and data before training:** request explicit source provenance/permission for any image-search-derived corpus, then define a multi-class/instance dataset rather than extending single-mask epochs.
5. **Prioritize one high-value model experiment:** benchmark promptable MobileSAM/SAM 2 and the existing OmniRoto on user-provided artwork; compare user correction time, not only IoU.
6. **Implement AEP/XML import only after a licensed fixture exists:** treat format claims, missing-media recovery, and plugin effects as a compatibility project with reference renders.
