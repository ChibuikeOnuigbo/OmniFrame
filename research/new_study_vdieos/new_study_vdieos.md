# new_study_vdieos — creative editor study, 2026-10-31

## Sources and what was actually reviewed

The current English Krita manual source was indexed at `KDE/documentation-docs-krita-org`, **master `8f58c40c49b7d0022e1553f487f4928762132f0c`**, dated 2026-10-26. Its default branch was a stale 2020 feature branch; the study explicitly switched to master. All **328 English RST pages** were read by the indexer. Transform and selection chapters were read closely. `documentation-index.json` preserves every indexed path, content SHA-256, heading and topic match. This is full-text indexing plus selected close reading, not a claim that every workflow has been implemented or manually mastered.

Adobe's official `AdobeDocs/uxp-photoshop` source was indexed at **`9bd99ffe`**: **499 Markdown pages**, including Photoshop Selection, Layer and Document APIs and UXP platform reference. Selection contraction/expansion/feather/grow, boundary transformations, layers and filter methods were examined. Adobe's Photoshop developer landing source was also read. These are developer/API documents, not the complete Photoshop HelpX user manual. The HelpX site and direct Krita site were denied by the current proxy; no environment configuration was changed. Official public GitHub sources were read normally.

Reference links:

- https://github.com/KDE/documentation-docs-krita-org/blob/master/reference_manual/tools/transform.rst
- https://github.com/KDE/documentation-docs-krita-org/blob/master/user_manual/selections.rst
- https://github.com/AdobeDocs/uxp-photoshop/blob/main/src/pages/ps-reference/classes/selection.md
- https://github.com/AdobeDocs/uxp-photoshop/blob/main/src/pages/ps-reference/classes/layer.md
- https://github.com/AdobeDocs/photoshop/blob/main/src/pages/index.md

Krita places Free, Perspective, Warp, Cage and Liquify within one transform workflow. Its liquify tools distinguish move, scale, rotate, offset and undo, with wash/build-up, pressure, amount, spacing and reversal. OmniFrame now groups its existing free transform, marquee and roto tools with new perspective and liquify modes. Four-corner homography and push/bulge/pinch/twirl raster brushes are implemented. Mesh/cage transforms, wash/build-up controls, stroke-local restore and full selection-bound deformation are still gaps. No new trained AI model was created or claimed.

## The requested short: 8hjWrzum_vQ

Direct YouTube access is blocked. The repository already contains source samples from `00_Earrings_Behind_The_Project_8hjWrzum_vQ.mp4` under `new_doc_toll_research/video_study/frames/`. Frames **00_t005.0.jpg**, **00_t015.0.jpg** and **00_t025.0.jpg** were visually inspected in this run. This is sampled frame review; the complete video/audio and the creator's complete catalog were not watched.

| Source sample | Visible observations | Editor implication |
|---|---|---|
| 5 s | Orange composition, separate blue word clips “in” / “her”, red Null Object rows, orange Solid Color clips, visibility icons, turquoise timeline markers; bottom creation tray Media/Text/Solid/Adjustment/Null/Shape | Preserve word-level timing and expose creation types and markers. Null rows are visible; parenting relationships are not proven by their presence. |
| 15 s | “then save” in two lines, staggered blue “then” / “save” / “why…” / “it” strips, orange camera row, multiple null rows, solid and object rows, waveform above the timeline | Separate text clips plus per-word keys, compositing layers, a camera track and readable waveform/markers. Exact camera/keyframe settings cannot be recovered from this frame alone. |
| 25 s | Small orange card, “from you”, imported PNG row, red Null Object 23, long blue rows with diamond-like markers, many stacked strips and a partially visible “Layer 3 copy (Exp…” label | Maintain source identity, layer order, keyframe diamonds and grouped navigation. The truncated label is not promoted to a fully identified effect recipe. |

`evidence_video/reala/motion design/word-stagger.mp4` is an original OmniFrame study of the observed word-stagger grammar, made using universal editor tools. It is not a recreation of the original short or RDT clip. Existing detailed notes and the 41-video source index remain in `new_doc_toll_research/video_study/`; older descriptions were not counted as newly watched footage.

## Drive access and actual source inventory

Published policy now allows Drive folder HTML. The main folder yielded **42 recognized entries**, including the exact `RDT_20261027_092910.mp4`, file ID **15pq2qW7qMQSpB1xtnJEeaJ2-ByDtEhCQ**. Its ordinary download endpoint redirects to a destination rejected by the current proxy. **The user subsequently uploaded the finished reference directly**, resolving local access to that file. Its source, hash, sampled study and derived render are documented in [rdt-upload-study.md](rdt-upload-study.md). Cookies would not resolve the destination-policy denial, so none were requested. Separate raw scene clips remain unavailable.

yt-dlp **2026.10.26** was installed in `/tmp/omniframe-research-tools` and invoked against `https://www.youtube.com/shorts/8hjWrzum_vQ` with no playlist, no retries and a 15-second socket timeout. It returned a proxy CONNECT **403 Forbidden**. No YouTube bytes were downloaded or newly watched; `youtube-access.json` records the attempt. Package installation does not alter the environment's published configuration.

The supplied pack listing yielded 50 recognized image entries; the BrandBird listing yielded `refernce.zip`; the clips listing yielded an engine-repair ZIP and a screen-recording MP4. These are observed HTML listings, not complete paginated inventories or downloaded assets. Normalized records are in `research/20261031-sources/{drive-index,pack,brandbird,glitch-clips}.json`. No private academic subfolder contents were studied. Raw HTML and third-party source caches are not included as product assets.

The BrandBird documentation in `brandbird_study/README.md` distinguishes a broken original ZIP from a later working RAR mirror. That extracted offline app is absent in this environment, so it was not newly booted or resized. Existing capture reports/screenshots and its grouping patterns were consulted. The supplied ZIP is not assumed to be a complete runnable app.

## Acceptance questions that remain open

- Can the separate raw RDT scene clips be recovered for an independent editable recreation? The directly uploaded finished reference has now been decoded, sampled and recomposed through MCP into `RDT_recopy.mp4`; baked-in typography/effects are explicitly disclosed. This resolves access to the reference, not independent reconstruction of its effects.
- Can all creator videos be acquired and assigned explicit sampled-visual/audio/recreation statuses? Metadata listings and old contradictory watched counts are insufficient.
- Can pack pagination and all original screenshot/archive bytes be recovered before further cut-outs and mockup assets are certified?
- Which AE/CapCut/Krita/Photoshop workflows pass equivalent interaction, render, persistence, undo and export tests? Tool-name inventories do not establish parity.
- Can official, licensed sources for Gold Motion and Toji Motion be verified before inspecting packages? No APK was downloaded or disassembled in this run.

See `docs/CREATIVE_WORKSPACE_20261031.md` for the current implementation, tests, limits and next work.
